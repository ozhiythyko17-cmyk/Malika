"""Uji tools/remove_bg.py memakai fixture yang meniru artwork terang di atas latar hitam.

Jalankan: python3 tests/test_remove_bg.py
"""

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
TOOL = ROOT / "tools" / "remove_bg.py"


def make_fixture(path: Path) -> None:
    """Subjek terang yang meleleh ke latar hitam, plus artefak JPEG — seperti aslinya."""
    W, H = 380, 542
    rng = np.random.default_rng(7)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    face = np.exp(-(((xx - 150) / 78.0) ** 2 + ((yy - 200) / 105.0) ** 2))
    shade = np.clip((xx - 80) / 150.0, 0, 1)          # sisi kiri jatuh ke hitam
    canvas = face * (0.25 + 0.75 * shade)

    for _ in range(26):                                # rambut: ujungnya hilang ke latar
        a = rng.uniform(0, np.pi)
        cx, cy = 150 + 70 * np.cos(a), 120 + 55 * np.sin(a)
        streak = np.exp(-(((xx - cx) / 5.0) ** 2 + ((yy - cy) / 26.0) ** 2))
        canvas = np.maximum(canvas, streak * rng.uniform(0.35, 1.0))

    img = Image.fromarray((np.clip(canvas, 0, 1) * 255).astype(np.uint8), "L")
    d = ImageDraw.Draw(img)
    d.ellipse([236, 300, 356, 430], fill=8, outline=205, width=3)   # gitar: badan segelap latar
    d.rectangle([272, 40, 300, 305], fill=14, outline=190, width=2)
    for f in range(60, 300, 22):
        d.line([274, f, 298, f], fill=170, width=1)
    d.line([110, 470, 150, 455, 190, 480, 230, 458], fill=235, width=2)  # tanda tangan tipis

    arr = np.clip(np.asarray(img).astype(np.float32) + rng.normal(0, 2.0, (H, W)), 0, 255)
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(arr.astype(np.uint8), "L").convert("RGB").filter(
        ImageFilter.GaussianBlur(0.4)
    ).save(path, quality=78)


def run(*args: str) -> None:
    subprocess.run([sys.executable, str(TOOL), *args], check=True, capture_output=True)


def rgba(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32)


def over_black(path: Path) -> np.ndarray:
    a = rgba(path)
    return a[..., :3] * (a[..., 3:4] / 255.0)


def main() -> int:
    out = ROOT / "assets" / "out"
    src_path = ROOT / "assets" / "fixture.jpg"
    make_fixture(src_path)
    src = np.asarray(Image.open(src_path).convert("RGB"), dtype=np.float32)

    run(str(src_path), "-o", str(out / "exact.png"), "--black", "0.0")
    run(str(src_path), "-o", str(out / "lum.png"))
    run(str(src_path), "-o", str(out / "flood.png"), "--mode", "floodfill", "--soft-edge", "1.5")
    run(str(src_path), "-o", str(out / "thresh.png"), "--mode", "threshold")

    checks: list[tuple[str, bool, str]] = []

    # Tanpa lift black point, luminance-as-alpha lossless di atas hitam.
    d0 = np.abs(over_black(out / "exact.png") - src)
    checks.append(("round-trip lossless di atas hitam",
                   d0.max() <= 1.0, f"maks {d0.max():.2f}/255"))

    # Default black=0.04 hanya membuang mush near-black; efeknya meluruh ke nol
    # seiring tinta makin terang, jadi artwork-nya sendiri praktis tak tersentuh.
    d = np.abs(over_black(out / "lum.png") - src).max(axis=2)
    lum = src.max(axis=2)
    checks.append(("pembersihan terbatas black point",
                   d.max() <= 0.04 * 255 + 1, f"maks {d.max():.2f}/255"))
    checks.append(("tinta paling terang tak tersentuh",
                   d[lum > 240].max() <= 1.0, f"maks {d[lum > 240].max():.2f}/255"))
    bands = [d[(lum >= lo) & (lum < hi)].max() for lo, hi in [(0, 64), (64, 192), (192, 256)]]
    checks.append(("efek meluruh saat tinta menerang",
                   bands[0] >= bands[1] >= bands[2], " > ".join(f"{b:.0f}" for b in bands)))

    # Latar benar-benar transparan, bukan sekadar dicat hitam.
    al = rgba(out / "lum.png")[..., 3]
    corners = [al[5, 5], al[-5, -5], al[5, -5], al[-5, 5]]
    checks.append(("latar transparan penuh", max(corners) == 0, f"pojok {corners}"))

    # Detail tipis (tanda tangan) tidak ikut terbuang.
    sig = al[450:485, 105:235]
    checks.append(("detail tipis selamat", sig.max() > 150, f"alpha maks {sig.max():.0f}"))

    # Mode floodfill menjaga hitam DI DALAM desain tetap solid.
    af = rgba(out / "flood.png")[..., 3]
    checks.append(("floodfill jaga hitam interior", af[365, 296] == 255,
                   f"badan gitar alpha {af[365, 296]:.0f} (luminance: {al[365, 296]:.0f})"))
    checks.append(("floodfill buang latar tepi", af[5, 5] == 0, f"pojok alpha {af[5, 5]:.0f}"))

    # Un-premultiply memindahkan nada ke alpha, jadi tinta tidak kusam di latar terang.
    lp = rgba(out / "lum.png")
    ink = lp[..., :3][lp[..., 3] > 25].mean()
    checks.append(("tinta putih bersih setelah unpremultiply", ink > 200, f"rata-rata RGB {ink:.0f}/255"))

    # Threshold menghasilkan alpha 1-bit untuk cutting vinyl.
    at = rgba(out / "thresh.png")[..., 3]
    checks.append(("threshold alpha 1-bit", bool(np.isin(at, [0, 255]).all()),
                   f"nilai unik {len(np.unique(at))}"))

    failed = 0
    for name, ok, detail in checks:
        print(f"  [{'LULUS' if ok else 'GAGAL'}] {name:38s} {detail}")
        failed += not ok
    print(f"\n{len(checks) - failed}/{len(checks)} pemeriksaan lulus")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
