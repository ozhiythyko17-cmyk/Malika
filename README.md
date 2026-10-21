# UMKM Plus — versi uji coba (usaha kuliner online)

Aplikasi web untuk menjalankan usaha kuliner online dari HP: catat pesanan, stok, untung-rugi, dan buat caption promosi dengan AI. Ini "Tahap 0" dari rencana UMKM Plus: dipakai sendiri dulu sebelum dikembangkan jadi produk berbayar.

## Fitur

| Menu | Isi |
|---|---|
| 🏠 Beranda | Omzet & untung kotor hari ini, pesanan aktif, grafik 7 hari, menu terlaris, peringatan stok menipis, pengingat backup |
| 🧾 Pesanan | Catat pesanan dari WhatsApp/IG/GoFood/GrabFood/ShopeeFood, potongan aplikasi otomatis, ongkir, diskon, status (baru → selesai), tanda belum bayar, kirim struk ke WhatsApp pelanggan |
| 🍱 Produk | Menu dengan harga jual & modal per porsi (HPP), persentase untung, stok opsional (untuk produk siap jual) + riwayat stok |
| 💰 Keuangan | Catat uang keluar, laporan untung-rugi bulanan (omzet − HPP − potongan aplikasi − biaya − iklan), omzet per saluran, unduh laporan CSV/Excel |
| ✨ Marketing | AI pembuat caption (3 variasi + ide video pendek), simpan konten favorit, catatan hasil iklan dengan rapor BAGUS / CUKUP / PERLU DIPERBAIKI |
| ⚙️ Pengaturan | Profil usaha, saluran & persen potongan, backup / pulihkan data, cara pasang di layar utama HP |

## Penting: di mana data disimpan?

Semua data tersimpan **di browser HP yang dipakai** (tidak di server). Artinya gratis dan bisa dipakai tanpa internet, tapi:

- Data **tidak** otomatis muncul di HP/laptop lain.
- Kalau HP hilang atau data browser dihapus, data ikut hilang → **backup tiap minggu** (Pengaturan → Unduh backup) dan simpan filenya di Google Drive/WhatsApp sendiri.

Penyimpanan online (bisa dibuka dari banyak perangkat) direncanakan untuk tahap berikutnya.

## Cara pasang (sekali saja, ±20 menit)

1. **Vercel (hosting gratis)** — buka https://vercel.com, daftar/masuk pakai akun GitHub → *Add New… → Project* → pilih repo `umkm-plus` → *Deploy*. Pengaturan bawaan sudah benar (terdeteksi sebagai Vite).
2. **Kunci API AI** (untuk fitur caption) — buka https://console.anthropic.com → isi kredit (bayar sesuai pemakaian) → *API Keys → Create Key* → salin kuncinya.
   - Di Vercel: *Project → Settings → Environment Variables* → nama `ANTHROPIC_API_KEY`, isi dengan kunci tadi → *Save* → tab *Deployments* → *Redeploy*.
   - Disarankan pasang **batas belanja bulanan** di Anthropic Console (mis. US$5) supaya biaya AI tidak pernah melebihi anggaran.
3. **Buka di HP** — buka alamat dari Vercel (mis. `umkm-plus-xxx.vercel.app`) di Chrome → menu ⋮ → *Tambahkan ke layar utama*. (iPhone: Safari → Bagikan → *Tambah ke Layar Utama*.)
4. **Isi data awal** — Pengaturan (nama usaha, WA, potongan GoFood/GrabFood/ShopeeFood sesuai kontrakmu) → Produk (10 menu, harga jual & modal per porsi).

Tanpa kunci API, semua fitur tetap jalan; tombol AI akan menawarkan "Salin perintah AI" untuk ditempel manual di aplikasi Claude.

## Untuk pengembang

```bash
npm install
cp .env.example .env   # isi ANTHROPIC_API_KEY jika ingin mencoba fitur AI
npm run dev            # http://localhost:5173 (api/ ikut jalan lewat plugin dev di vite.config.ts)
npm run build          # cek tipe + build produksi ke dist/
```

- Frontend: React + TypeScript + Vite, data lokal di IndexedDB (Dexie). File utama: `src/db.ts` (model data & logika stok), `src/pages/*`.
- Backend: satu Vercel Function `api/konten.ts` yang memanggil Claude API; prompt ada di `src/prompt.ts`.
- PWA: `public/manifest.webmanifest` + `public/sw.js` (aplikasi tetap terbuka saat offline).
