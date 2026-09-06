# remove_bg.py — artwork di latar gelap jadi PNG transparan

Untuk artwork monokrom kontras tinggi (potret engraving/halftone, desain sablon,
line art) yang aslinya dibuat sebagai tinta terang di atas latar hitam.

```bash
pip install pillow numpy
python3 tools/remove_bg.py desain.jpg -o hasil/desain.png --preview
```

## Kenapa bukan "hapus semua piksel hitam"

Pada artwork begini, hitam bukan cuma latar — hitam juga bagian dari subjeknya:
bayangan rambut, sisi gelap wajah, badan gitar. Subjeknya tidak punya siluet
tertutup; ia meleleh ke latar. Menghapus hitam pakai tolerance akan melubangi
desainnya.

Yang benar untuk produksi adalah **luminance-as-alpha**: alpha = ketebalan tinta.
Hitam jadi transparan penuh, putih jadi opaque penuh, abu-abu jadi semi
transparan. Sifatnya lossless — ditumpuk ulang di atas hitam hasilnya identik
dengan sumbernya (dibuktikan di `tests/test_remove_bg.py`) — dan tetap benar di
atas warna latar apa pun.

## Mode

| Mode | Kapan dipakai |
|---|---|
| `luminance` (default) | Artwork yang menyatu ke latar. Menghasilkan tepi lembut dan gradasi utuh. |
| `floodfill` | Hanya buang hitam yang nyambung ke tepi kanvas; hitam di dalam desain tetap solid. Mode "stiker". |
| `threshold` | Alpha 1-bit keras, untuk cutting vinyl atau sablon 1 warna. |

## Opsi yang sering dipakai

- `--black 0.10` — naikkan kalau latar masih terlihat abu-abu berkabut (mush JPEG).
  Efeknya meluruh sendiri saat tinta makin terang, jadi artwork-nya tidak tergerus.
- `--auto-levels` — tebak black/white point dari histogram.
- `--ink white` — paksa tinta putih murni, semua nada dibawa alpha. Paling bersih
  untuk sablon tinta putih di kain gelap.
- `--ink keep` — pertahankan warna asli apa adanya.
- `--trim` — potong margin transparan.
- `--scale 3 --dpi 300` — siapkan ukuran cetak.
- `--preview` — simpan strip perbandingan di atas beberapa warna latar.

## Catatan penting

Kalau tintanya putih, hasilnya **tidak akan terlihat di atas latar putih** — itu
benar, bukan gagal. Pakai `--preview` untuk mengeceknya di atas latar gelap.

## Uji

```bash
python3 tests/test_remove_bg.py
```
