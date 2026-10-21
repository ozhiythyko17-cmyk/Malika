# UMKM Plus — Dapur Bakar

Aplikasi web lengkap (frontend + backend + database) untuk menjalankan usaha kuliner online dari HP: catat pesanan, stok, untung-rugi, pelanggan, dan buat caption promosi dengan AI. Ini "Tahap 0" dari rencana UMKM Plus: dipakai sendiri dulu oleh Dapur Bakar sebelum dikembangkan jadi produk berbayar.

## Fitur

| Menu | Isi |
|---|---|
| 🔐 Login | Akun pemilik dibuat saat pertama dibuka. Pemilik bisa menambah akun **staf** (bisa catat pesanan & stok, tidak bisa lihat keuangan/modal/iklan) |
| 🏠 Beranda | Omzet & untung kotor hari ini, pesanan aktif, grafik 7 hari, menu terlaris, peringatan stok menipis |
| 🧾 Pesanan | Pesanan dari WhatsApp/IG/GoFood/GrabFood/ShopeeFood, potongan aplikasi otomatis, ongkir, diskon, status (baru → selesai), tanda belum bayar, kirim struk ke WhatsApp pelanggan |
| 🍱 Produk | Menu dengan harga jual & modal per porsi (HPP), persentase untung, stok opsional + riwayat stok |
| 💰 Keuangan | Uang keluar, laporan untung-rugi bulanan (omzet − HPP − potongan aplikasi − biaya − iklan), omzet per saluran, unduh CSV/Excel |
| ✨ Marketing | **Studio Konten AI** (lihat di bawah), konten tersimpan, daftar pelanggan otomatis (setia / lama tidak order) + tombol chat WA, catatan iklan dengan rapor BAGUS / CUKUP / PERLU DIPERBAIKI |
| ⚙️ Pengaturan | Profil usaha, saluran & persen potongan, akun staf, ganti kata sandi, unduh cadangan data |

## Studio Konten AI

Dua cara membuat konten:

| Mode | Masukan | Hasil |
|---|---|---|
| ✍️ **Dari prompt** | Tulis saja konten yang diinginkan (mis. "promo paket keluarga akhir pekan"), opsional pilih menu | 3 caption + hashtag, **gambar promo buatan AI**, **video pendek otomatis** dari gambar AI per adegan |
| 📁 **Dari Google Drive** | Pilih 1–4 foto/video dari folder Drive usaha | AI **melihat bahanmu** lalu menulis caption yang sesuai; gambar promo berupa **poster dari foto asli** (gratis) atau **foto asli dipercantik AI**; **video pendek otomatis** dari potongan foto/video aslimu |

- Caption & naskah: Claude (bisa melihat foto; untuk video yang dilihat satu cuplikan frame).
- Gambar: Gemini (model bisa diganti lewat `GEMINI_IMAGE_MODEL`). Perkiraan biaya beberapa ratus rupiah per gambar — cek harga terbaru di Google.
- Poster: digambar langsung di HP (judul + teks + nama usaha + WA), tanpa biaya.
- **Video otomatis** (`src/video/render.ts`): AI menyusun 4–6 adegan (lama, bahan yang dipakai, teks di layar). Aplikasi merender di HP: foto diberi gerak zoom pelan, video Drive diputar (berlanjut bila dipakai di beberapa adegan), teks besar ala Reels/TikTok, musik latar dari file MP3/WAV di folder Drive, dan penutup berisi nama usaha + WA. Hasilnya file MP4 720×1280 (9:16) atau 720×720 (1:1) yang bisa diunduh.
  - Perekaman berjalan seperti memutar video (video 20 detik ≈ 20 detik); layar harus tetap menyala dan aplikasi tetap terbuka selama proses.
  - Mode prompt membuat satu gambar AI per adegan (4–6 gambar per video).
  - Narasi suara belum dibuat otomatis; teks narasi tetap ditampilkan per adegan.
  - Chrome terbaru menyimpan MP4; browser yang belum bisa MP4 menyimpan WebM.
  - File video Drive diambil lewat server per potongan 4 MB (batas Vercel), maksimal ±160 MB.
- Folder Drive dibagikan "Siapa saja yang memiliki link" (hanya-lihat). Server hanya memakai file yang ada di folder itu.

## Arsitektur

```
HP / laptop (browser, bisa dipasang seperti aplikasi)
   │  React + TypeScript (src/)
   ▼
/api/*  ── Vercel Function (api/app.ts) ── router & logika bisnis (server/)
   │                                   ├── Claude API (caption & naskah)
   │                                   ├── Gemini API (gambar)
   │                                   └── Google Drive API (bahan foto/video)
   ▼
PostgreSQL (Neon lewat Vercel, gratis untuk skala kecil)
```

- Data tersimpan di database online: bisa dibuka dari beberapa HP sekaligus, tidak hilang kalau HP rusak.
- Login memakai kata sandi ter-hash (scrypt) dan cookie sesi yang ditandatangani. Ganti kata sandi otomatis mengeluarkan perangkat lain.
- Harga & modal pesanan diambil dari server (bukan dari HP), stok dikurangi/dikembalikan dalam transaksi database.
- Tabel database dibuat otomatis saat server pertama kali jalan.

## Cara pasang (sekali saja, ±30 menit)

1. **Vercel** — buka https://vercel.com → masuk dengan GitHub → *Add New… → Project* → pilih repo `Malika` → di **Root Directory** pilih folder `umkm-plus` → *Deploy*.
2. **Database** — di project Vercel: tab *Storage* → *Create Database* → pilih **Neon (Postgres)** paket gratis → hubungkan ke project ini. Vercel otomatis menambahkan `DATABASE_URL`.
3. **Kunci sesi** — *Settings → Environment Variables* → tambah `SESSION_SECRET` berisi teks acak minimal 32 karakter (mis. ketik acak huruf & angka; jangan dibagikan).
4. **AI (opsional)** — buka https://console.anthropic.com → isi kredit → *API Keys → Create Key*. Tambahkan `ANTHROPIC_API_KEY` di Environment Variables. Disarankan pasang **batas belanja bulanan** (mis. US$5) di Anthropic Console.
5. **Google (gambar AI & Drive)** — buka https://aistudio.google.com/apikey → *Create API key* (ini membuat project Google Cloud). Di https://console.cloud.google.com, pada project yang sama: aktifkan **Google Drive API**, dan aktifkan billing bila diminta untuk pembuatan gambar. Tambahkan `GOOGLE_API_KEY` di Environment Variables Vercel. Lalu di aplikasi: Pengaturan → tempel link folder Drive bahan konten.
6. **Redeploy** — tab *Deployments* → titik tiga di deploy terakhir → *Redeploy* (agar variabel baru terbaca).
7. **Buka di HP** — buka alamat Vercel (mis. `umkm-plus-xxx.vercel.app`) → buat akun pemilik → isi Pengaturan & 10 menu. Pasang ke layar utama: Chrome ⋮ → *Tambahkan ke layar utama* (iPhone: Safari → Bagikan → *Tambah ke Layar Utama*).

Tanpa `ANTHROPIC_API_KEY` semua fitur tetap jalan; tombol AI menawarkan "Salin perintah AI" untuk ditempel manual di aplikasi Claude.

## Versi demo (tanpa server)

`npm run build:demo` membuat `dist-demo/`: aplikasi yang sama, tapi server (`server/`) dijalankan di dalam browser dengan PostgreSQL WASM (PGlite), data contoh Dapur Bakar, serta Google Drive/Gemini/Claude tiruan (lihat `demo/`). Dipakai untuk mencoba aplikasi sebelum dipasang online. Akun demo: `dapurbakar` / `demo1234` (pemilik), `sari` / `demo1234` (staf).

## Untuk pengembang

```bash
npm install
npm run dev     # http://localhost:5173 — API ikut jalan, database lokal otomatis (PGlite di .data/)
npm test        # 16 tes API end-to-end (PostgreSQL di memori; Google & Claude ditiru)
TEST_DATABASE_URL=postgres://... npm test   # tes ke PostgreSQL sungguhan (database kosong)
npm run build   # cek tipe + build frontend ke dist/
```

| Folder | Isi |
|---|---|
| `src/` | Frontend React: `App.tsx` (login, navigasi), `pages/*`, `api.ts` (klien API) |
| `server/` | Backend: `app.ts` (router + hak akses), `routes/*` (pesanan, produk, keuangan, marketing, studio, akun), `google.ts` (Drive & Gemini), `db.ts` (koneksi & skema), `auth.ts` |
| `shared/` | Tipe data & prompt AI yang dipakai frontend dan backend |
| `api/app.ts` | Pintu masuk Vercel Function (semua `/api/*` diteruskan lewat `vercel.json`) |
| `tests/` | Tes API |
