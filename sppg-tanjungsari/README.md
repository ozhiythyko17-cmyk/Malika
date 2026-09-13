# Layout SPPG Tanjungsari #004 — Model 3D

Visualisasi 3D interaktif untuk **SPPG Tanjungsari #004 — Sirnarasa, Bogor**
(Yayasan Alqoyyim Al Qoyidiyah Bina Mulia), dikemas sebagai **satu berkas HTML
mandiri**: buka `Layout-SPPG-Tanjungsari-3D.html` langsung dari disk, tanpa
server dan tanpa koneksi internet.

**Deliverable:** [`Layout-SPPG-Tanjungsari-3D.html`](Layout-SPPG-Tanjungsari-3D.html) (±770 KB)

---

## Isi model

| Lapisan | Sumber | Ketelitian |
|---|---|---|
| Dinding (45 segmen, tebal 150 mm) | vektor DENAH | presisi 1:1 terhadap as-grid 1–13 / A–Q |
| 29 ruang + peil lantai | vektor DENAH | presisi |
| 19 pintu + arah ayun & titik engsel | vektor DENAH (busur ayun) | presisi di denah; tinggi asumsi |
| 15 jendela · 9 bukaan tanpa daun | vektor DENAH | presisi di denah; ambang asumsi |
| Gutter + grill (4 segmen, 22.628 mm) | vektor DENAH PENUTUP LANTAI | presisi |
| R. Gas + 6 tabung LPG | vektor DENAH + denah berperabot | presisi (posisi ruang) |
| Septictank · grease trap / IPAL · sumur resapan | vektor INST. AIR KOTOR DAN LIMBAH | presisi |
| 16 titik lampu TL LED 2 × 40 W | vektor INSTALASI ELEKTRIKAL | presisi |
| 53 unit peralatan dapur | denah berperabot + render | **estimasi** |
| Kitchen hood | render R. Produksi | **estimasi** (panjang diturunkan) |
| Jalur pipa gas | — | **skematik**, tidak ada lembar instalasi gas |

Tab **Sumber** di dalam aplikasi memuat rincian yang sama beserta catatan
terbuka, sehingga siapa pun yang membuka model langsung tahu angka mana yang
boleh dipakai dan mana yang masih perlu dikunci.

## Cara pakai

- **Sudut pandang** — Isometrik, Denah atas, Hot line, Pemorsian.
  Pada Denah atas, kitchen hood otomatis dibuat tembus pandang agar hot line
  di bawahnya tetap terbaca.
- **Fokus area** — mengisolasi satu kelompok ruang dan memindahkan kamera.
- **Lapisan** — nyala/mati per sistem: peralatan, pintu & jendela, gutter, hood,
  jalur gas, air kotor, lampu, nama ruang, kode peralatan.
- **Pintu** digambar terbuka 90° persis seperti arah ayun pada denah, lengkap
  dengan busur ayun di lantai — jadi bentrokan ruang bebas ayun terhadap
  peralatan langsung terlihat.
- **Klik objek** di 3D atau baris di panel kanan untuk melihat dimensi dan
  catatan `basis` — dari mana angka itu berasal.

## Konvensi

| | |
|---|---|
| Titik nol | as-1 / as-Q (sudut barat laut bangunan) |
| Sumbu | X ke timur, Y denah ke selatan (dipetakan ke Z pada Three.js) |
| Skala | 1 unit = 1 meter |
| Satuan data | milimeter |
| Tinggi potong dinding | 1.250 mm (model cutaway, bukan tinggi dinding asli) |
| Tebal dinding | 150 mm |
| Peil toilet | − 0,05 m |
| Ambang / kusen jendela | 900 / 2.100 mm (asumsi) |

## Membangun ulang

```
python3 build.py                       # → Layout-SPPG-Tanjungsari-3D.html
python3 build.py -o nama-lain.html
```

Skrip merakit `src/` menjadi satu HTML dan meng-inline Three.js r160 (UMD) serta
OrbitControls dari `vendor/`. Tidak ada langkah npm dan tidak ada unduhan saat
build maupun saat berkas dibuka.

```
src/
  shell.html   kerangka HTML + penanda penyisipan
  style.css    tema gelap teknis
  walls.js     42 segmen dinding hasil ekstraksi vektor CAD
  data.js      ruang, peralatan, gutter, gas, limbah, lampu — plus catatan basis
  app.js       pembangun scene Three.js + antarmuka
vendor/
  three.min.js        Three.js r160 UMD
  OrbitControls.js    ESM, dikonversi ke skrip klasik saat build
```

## Yang perlu dikonfirmasi

1. **BoQ / daftar peralatan dapur** — 53 dari 53 unit memakai dimensi estimasi.
   Panjang-lebar diukur dari simbol pada denah berperabot, tinggi memakai ukuran
   fabrikasi lazim.
2. **Lembar instalasi gas** — rute, diameter, tekanan, regulator, dan titik
   shut-off belum ada. Yang ditampilkan sekarang hanya skematik.
3. **Dimensi kitchen hood** — model memakai bentang hot line 5.180 mm +
   overhang 150 mm di tiap ujung (total 5.480 mm). Overhang ini asumsi.
4. **Jenis unit masak** — PR-01/02 bersimbol panci bertutup, PR-03…06 bersimbol
   kuali. Tipe kompor dan kapasitasnya belum tercantum di gambar.
5. **Ketinggian bukaan** — lebar dan posisi pintu/jendela presisi dari denah,
   tetapi tinggi daun, ambang, dan kusen memakai angka lazim karena paket
   gambar tidak memuat gambar potongan.
