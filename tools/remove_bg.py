#!/usr/bin/env python3
"""
remove_bg.py — ubah artwork di atas background gelap solid menjadi PNG transparan.

Dibuat untuk artwork monokrom kontras tinggi (potret hasil engraving/halftone,
desain sablon, line art) yang dicetak sebagai tinta terang di atas latar hitam.

Kenapa bukan sekadar "hapus warna hitam":
    Pada artwork seperti ini, hitam bukan cuma latar — hitam juga jadi bagian
    dari subjeknya (bayangan rambut, sisi gelap wajah, badan gitar). Subjek
    tidak punya siluet tertutup; ia meleleh ke latar. Menghapus semua piksel
    hitam dengan tolerance akan melubangi desainnya.

    Jawaban yang benar untuk produksi adalah luminance-as-alpha: alpha =
    ketebalan tinta. Hitam -> transparan penuh, putih -> opaque penuh, abu-abu
    -> semi transparan. Hasilnya persis sama saat ditumpuk di atas hitam, dan
    tetap benar di atas warna apa pun. Ini juga format yang diminta percetakan
    DTF/sablon/DTG.

Mode:
    luminance  (default) alpha = luminansi. Untuk artwork yang menyatu ke latar.
    floodfill            hanya buang hitam yang nyambung ke tepi kanvas.
                         Hitam di dalam desain tetap solid (mode "stiker").
    threshold            alpha 1-bit keras. Untuk cutting vinyl / sablon 1 warna.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Rec.709 luma — bobot persepsi mata terhadap R/G/B.
LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def load_rgb(path: Path) -> np.ndarray:
    """Baca gambar apa pun jadi array RGB float 0..1.

    Kalau sumbernya sudah punya alpha, di-composite dulu di atas hitam supaya
    asumsi 'artwork di atas latar hitam' tetap berlaku.
    """
    img = Image.open(path)
    if img.mode in ("RGBA", "LA") or "transparency" in img.info:
        img = img.convert("RGBA")
        flat = Image.new("RGBA", img.size, (0, 0, 0, 255))
        img = Image.alpha_composite(flat, img)
    return np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb @ LUMA


def apply_levels(x: np.ndarray, black: float, white: float, gamma: float) -> np.ndarray:
    """Regangkan rentang [black, white] ke [0, 1], lalu terapkan gamma.

    Menaikkan black point membuang mush JPEG di sekitar garis — noise ringan di
    latar yang mestinya transparan penuh tapi terbaca abu-abu 3-10/255.
    """
    if white <= black:
        raise ValueError(f"--white ({white}) harus lebih besar dari --black ({black})")
    out = np.clip((x - black) / (white - black), 0.0, 1.0)
    if gamma != 1.0:
        out = out ** (1.0 / gamma)
    return out


def auto_levels(lum: np.ndarray, lo_pct: float, hi_pct: float) -> tuple[float, float]:
    """Tebak black/white point dari persentil histogram."""
    return float(np.percentile(lum, lo_pct)), float(np.percentile(lum, hi_pct))


def border_floodfill_mask(lum: np.ndarray, tol: float) -> np.ndarray:
    """True untuk piksel latar: gelap DAN terhubung ke tepi kanvas.

    Kanvas di-pad 1px hitam supaya satu seed di pojok menjangkau seluruh tepi,
    termasuk saat artwork menyentuh sisi gambar.
    """
    h, w = lum.shape
    # Clip ke 254 supaya nilai sentinel 255 milik flood fill tidak bentrok
    # dengan piksel artwork yang memang putih murni.
    scaled = np.clip(lum * 254.0, 0, 254).astype(np.uint8)
    padded = Image.new("L", (w + 2, h + 2), 0)
    padded.paste(Image.fromarray(scaled), (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 255, thresh=int(tol * 255))
    return np.asarray(padded)[1:-1, 1:-1] == 255


def build_alpha(lum: np.ndarray, args) -> np.ndarray:
    black, white = args.black, args.white
    if args.auto_levels:
        black, white = auto_levels(lum, args.auto_lo, args.auto_hi)
        print(f"  auto-levels -> black={black:.4f} white={white:.4f}")

    if args.mode == "luminance":
        alpha = apply_levels(lum, black, white, args.gamma)

    elif args.mode == "threshold":
        alpha = (lum >= args.threshold).astype(np.float32)

    elif args.mode == "floodfill":
        bg = border_floodfill_mask(lum, args.tolerance)
        alpha = np.ones_like(lum, dtype=np.float32)
        alpha[bg] = 0.0
        if args.soft_edge:
            # Ramp luminance hanya di zona sempit dekat batas, supaya tepi tidak
            # bergerigi tapi bagian dalam desain tetap solid.
            edge = np.asarray(
                Image.fromarray((bg * 255).astype(np.uint8))
                .filter(ImageFilter.GaussianBlur(args.soft_edge)),
                dtype=np.float32,
            ) / 255.0
            ramp = apply_levels(lum, black, white, args.gamma)
            blend = np.clip(edge * 2.0, 0.0, 1.0)
            alpha = alpha * (1.0 - blend) + np.minimum(alpha, ramp) * blend
    else:
        raise ValueError(f"mode tidak dikenal: {args.mode}")

    if args.min_alpha > 0:
        # Buang debu semi-transparan yang cuma bikin file besar dan kotor.
        alpha[alpha < args.min_alpha] = 0.0
    if args.max_alpha < 1.0:
        alpha[alpha > args.max_alpha] = 1.0
    if args.feather > 0:
        alpha = np.asarray(
            Image.fromarray((alpha * 255).astype(np.uint8))
            .filter(ImageFilter.GaussianBlur(args.feather)),
            dtype=np.float32,
        ) / 255.0
    return np.clip(alpha, 0.0, 1.0)


def build_rgb(rgb: np.ndarray, alpha: np.ndarray, ink: str) -> np.ndarray:
    """Tentukan warna yang tersisa setelah latar dicabut.

    unpremultiply : sumbernya sudah ter-composite di atas hitam (src = ink*a),
                    jadi warna tinta asli = src / a. Ini yang bikin hasilnya
                    tetap benar di atas latar terang — tanpa ini, abu-abu 50%
                    jadi gelap DAN semi transparan sekaligus, hasilnya kusam.
    white         : paksa putih murni, semua nada dibawa alpha. Paling bersih
                    untuk sablon tinta putih di atas kain gelap.
    keep          : biarkan RGB apa adanya.
    """
    if ink == "keep":
        return rgb
    if ink == "white":
        return np.ones_like(rgb)

    safe = np.maximum(alpha, 1e-4)[..., None]
    out = np.clip(rgb / safe, 0.0, 1.0)
    # Piksel transparan penuh diputihkan supaya tidak ada halo gelap di viewer
    # yang mengabaikan alpha.
    return np.where(alpha[..., None] <= 0.0, 1.0, out)


def trim(rgba: np.ndarray, pad: int) -> np.ndarray:
    """Potong margin yang sepenuhnya transparan."""
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    if ys.size == 0:
        return rgba
    h, w = rgba.shape[:2]
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + 1 + pad)
    return rgba[y0:y1, x0:x1]


def checkerboard(size: tuple[int, int], step: int = 16) -> Image.Image:
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    tile = ((yy // step) + (xx // step)) % 2
    grey = np.where(tile == 0, 255, 205).astype(np.uint8)
    return Image.fromarray(np.dstack([grey] * 3), "RGB")


def make_preview(png: Image.Image, colors: list[str], out: Path) -> None:
    """Susun hasil di atas beberapa latar supaya gampang dicek mata."""
    panels = [checkerboard(png.size)]
    for c in colors:
        panels.append(Image.new("RGB", png.size, c))
    for p in panels:
        p.paste(png, (0, 0), png)

    gap, w, h = 12, png.width, png.height
    strip = Image.new("RGB", (w * len(panels) + gap * (len(panels) - 1), h), "#7a7a7a")
    for i, p in enumerate(panels):
        strip.paste(p, (i * (w + gap), 0))
    strip.save(out)
    print(f"  preview  -> {out}  ({', '.join(['transparan'] + colors)})")


def report(alpha: np.ndarray) -> None:
    total = alpha.size
    clear = int((alpha == 0).sum())
    solid = int((alpha == 1).sum())
    print(
        f"  alpha    -> transparan penuh {clear / total:6.2%} | "
        f"opaque penuh {solid / total:6.2%} | "
        f"semi {1 - (clear + solid) / total:6.2%}"
    )


def parse_args(argv: list[str] | None = None):
    p = argparse.ArgumentParser(
        description="Hapus background gelap, hasilkan PNG transparan.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Contoh:\n"
            "  # default: artwork terang di atas hitam -> PNG transparan\n"
            "  python3 tools/remove_bg.py desain.jpg -o out/desain.png --preview\n\n"
            "  # bersihkan noise JPEG lebih agresif\n"
            "  python3 tools/remove_bg.py desain.jpg -o out/desain.png --black 0.10\n\n"
            "  # mode stiker: hitam di dalam desain tetap solid\n"
            "  python3 tools/remove_bg.py desain.jpg -o out/desain.png --mode floodfill\n"
        ),
    )
    p.add_argument("input", type=Path)
    p.add_argument("-o", "--output", type=Path, help="default: <input>-transparent.png")
    p.add_argument(
        "--mode", choices=["luminance", "floodfill", "threshold"], default="luminance"
    )
    p.add_argument("--ink", choices=["unpremultiply", "white", "keep"], default="unpremultiply")

    p.add_argument("--black", type=float, default=0.04,
                   help="luminansi yang dianggap transparan penuh (default 0.04)")
    p.add_argument("--white", type=float, default=1.0,
                   help="luminansi yang dianggap opaque penuh (default 1.0)")
    p.add_argument("--gamma", type=float, default=1.0,
                   help=">1 menebalkan nada tengah, <1 menipiskan")
    p.add_argument("--auto-levels", action="store_true",
                   help="hitung black/white point dari histogram")
    p.add_argument("--auto-lo", type=float, default=40.0)
    p.add_argument("--auto-hi", type=float, default=99.7)

    p.add_argument("--threshold", type=float, default=0.5, help="untuk --mode threshold")
    p.add_argument("--tolerance", type=float, default=0.12, help="untuk --mode floodfill")
    p.add_argument("--soft-edge", type=float, default=0.0,
                   help="haluskan tepi pada --mode floodfill (radius px)")

    p.add_argument("--min-alpha", type=float, default=0.0, help="alpha di bawah ini -> 0")
    p.add_argument("--max-alpha", type=float, default=1.0, help="alpha di atas ini -> 1")
    p.add_argument("--feather", type=float, default=0.0, help="blur alpha (radius px)")

    p.add_argument("--trim", action="store_true", help="potong margin transparan")
    p.add_argument("--trim-pad", type=int, default=0)
    p.add_argument("--scale", type=float, default=1.0, help="perbesar sebelum simpan")
    p.add_argument("--dpi", type=int, help="tulis metadata DPI (mis. 300 untuk cetak)")
    p.add_argument("--preview", action="store_true",
                   help="simpan strip preview di atas beberapa warna latar")
    p.add_argument("--preview-colors", nargs="*", default=["white", "#1b1b1b", "#c8102e"])
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not args.input.exists():
        print(f"error: file tidak ditemukan: {args.input}", file=sys.stderr)
        return 1

    out_path = args.output or args.input.with_name(f"{args.input.stem}-transparent.png")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    rgb = load_rgb(args.input)
    print(f"  input    -> {args.input}  {rgb.shape[1]}x{rgb.shape[0]}  mode={args.mode} ink={args.ink}")

    alpha = build_alpha(luminance(rgb), args)
    rgba = np.dstack([build_rgb(rgb, alpha, args.ink), alpha])
    report(alpha)

    if args.trim:
        before = rgba.shape[:2]
        rgba = trim(rgba, args.trim_pad)
        print(f"  trim     -> {before[1]}x{before[0]} jadi {rgba.shape[1]}x{rgba.shape[0]}")

    png = Image.fromarray((np.clip(rgba, 0, 1) * 255).round().astype(np.uint8), "RGBA")
    if args.scale != 1.0:
        png = png.resize(
            (round(png.width * args.scale), round(png.height * args.scale)),
            Image.LANCZOS,
        )
        print(f"  scale    -> {png.width}x{png.height}")

    save_kw = {"dpi": (args.dpi, args.dpi)} if args.dpi else {}
    png.save(out_path, "PNG", optimize=True, **save_kw)
    print(f"  output   -> {out_path}  ({out_path.stat().st_size / 1024:.0f} KB)")

    if args.preview:
        make_preview(png, args.preview_colors, out_path.with_name(f"{out_path.stem}-preview.png"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
