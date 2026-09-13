#!/usr/bin/env python3
"""Rakit satu berkas HTML mandiri untuk model 3D SPPG Tanjungsari #004.

Semua dependensi (Three.js r160 UMD + OrbitControls) di-inline sehingga
berkas hasil bisa dibuka langsung dari disk tanpa koneksi internet.

    python3 build.py [-o Layout-SPPG-Tanjungsari-3D.html]
"""
from __future__ import annotations

import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
VENDOR = ROOT / "vendor"

ORBIT_IMPORT = re.compile(r"^import\s*\{(.*?)\}\s*from\s*'three';", re.S | re.M)


def orbit_to_classic(text: str) -> str:
    """Ubah OrbitControls dari modul ESM menjadi skrip klasik.

    Pernyataan `import { ... } from 'three'` diganti destructuring dari global
    THREE, dan `export { OrbitControls }` dihapus.
    """
    m = ORBIT_IMPORT.search(text)
    if not m:
        raise SystemExit("OrbitControls: baris import tidak ditemukan")
    names = ", ".join(n.strip() for n in m.group(1).split(",") if n.strip())
    text = text[: m.start()] + f"const {{ {names} }} = THREE;" + text[m.end():]
    text = re.sub(r"^export\s*\{[^}]*\};?\s*$", "", text, flags=re.M)
    return text


def read(path: pathlib.Path) -> str:
    if not path.exists():
        raise SystemExit(f"berkas tidak ditemukan: {path}")
    return path.read_text(encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--out", default="Layout-SPPG-Tanjungsari-3D.html")
    args = ap.parse_args()

    parts = {
        "__CSS__": read(SRC / "style.css"),
        "__THREE__": read(VENDOR / "three.min.js"),
        "__ORBIT__": orbit_to_classic(read(VENDOR / "OrbitControls.js")),
        "__WALLS__": read(SRC / "walls.js"),
        "__DATA__": read(SRC / "data.js"),
        "__APP__": read(SRC / "app.js"),
    }

    html = read(SRC / "shell.html")
    for token, body in parts.items():
        marker = f"/*{token}*/"
        if marker not in html:
            raise SystemExit(f"penanda {marker} tidak ada di shell.html")
        html = html.replace(marker, body)

    out = ROOT / args.out
    out.write_text(html, encoding="utf-8")
    print(f"{out}  —  {out.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
