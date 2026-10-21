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
| ✨ Marketing | AI caption (3 variasi + ide video), konten tersimpan, daftar pelanggan otomatis (setia / lama tidak order) + tombol chat WA, catatan iklan dengan rapor BAGUS / CUKUP / PERLU DIPERBAIKI |
| ⚙️ Pengaturan | Profil usaha, saluran & persen potongan, akun staf, ganti kata sandi, unduh cadangan data |

## Arsitektur

```
HP / laptop (browser, bisa dipasang seperti aplikasi)
   │  React + TypeScript (src/)
   ▼
/api/*  ── Vercel Function (api/app.ts) ── router & logika bisnis (server/)
   │                                   └── Claude API (caption AI)
   ▼
PostgreSQL (Neon lewat Vercel, gratis untuk skala kecil)
```

- Data tersimpan di database online: bisa dibuka dari beberapa HP sekaligus, tidak hilang kalau HP rusak.
- Login memakai kata sandi ter-hash (scrypt) dan cookie sesi yang ditandatangani. Ganti kata sandi otomatis mengeluarkan perangkat lain.
- Harga & modal pesanan diambil dari server (bukan dari HP), stok dikurangi/dikembalikan dalam transaksi database.
- Tabel database dibuat otomatis saat server pertama kali jalan.

## Cara pasang (sekali saja, ±30 menit)

1. **Vercel** — buka https://vercel.com → masuk dengan GitHub → *Add New… → Project* → pilih repo `umkm-plus` → *Deploy*.
2. **Database** — di project Vercel: tab *Storage* → *Create Database* → pilih **Neon (Postgres)** paket gratis → hubungkan ke project ini. Vercel otomatis menambahkan `DATABASE_URL`.
3. **Kunci sesi** — *Settings → Environment Variables* → tambah `SESSION_SECRET` berisi teks acak minimal 32 karakter (mis. ketik acak huruf & angka; jangan dibagikan).
4. **AI (opsional)** — buka https://console.anthropic.com → isi kredit → *API Keys → Create Key*. Tambahkan `ANTHROPIC_API_KEY` di Environment Variables. Disarankan pasang **batas belanja bulanan** (mis. US$5) di Anthropic Console.
5. **Redeploy** — tab *Deployments* → titik tiga di deploy terakhir → *Redeploy* (agar variabel baru terbaca).
6. **Buka di HP** — buka alamat Vercel (mis. `umkm-plus-xxx.vercel.app`) → buat akun pemilik → isi Pengaturan & 10 menu. Pasang ke layar utama: Chrome ⋮ → *Tambahkan ke layar utama* (iPhone: Safari → Bagikan → *Tambah ke Layar Utama*).

Tanpa `ANTHROPIC_API_KEY` semua fitur tetap jalan; tombol AI menawarkan "Salin perintah AI" untuk ditempel manual di aplikasi Claude.

## Untuk pengembang

```bash
npm install
npm run dev     # http://localhost:5173 — API ikut jalan, database lokal otomatis (PGlite di .data/)
npm test        # 9 tes API end-to-end (PostgreSQL di memori)
TEST_DATABASE_URL=postgres://... npm test   # tes ke PostgreSQL sungguhan (database kosong)
npm run build   # cek tipe + build frontend ke dist/
```

| Folder | Isi |
|---|---|
| `src/` | Frontend React: `App.tsx` (login, navigasi), `pages/*`, `api.ts` (klien API) |
| `server/` | Backend: `app.ts` (router + hak akses), `routes/*` (pesanan, produk, keuangan, marketing, akun), `db.ts` (koneksi & skema), `auth.ts` |
| `shared/` | Tipe data & prompt AI yang dipakai frontend dan backend |
| `api/app.ts` | Pintu masuk Vercel Function (semua `/api/*` diteruskan lewat `vercel.json`) |
| `tests/` | Tes API |
