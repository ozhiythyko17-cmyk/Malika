# Summit Bareng JOTI 2026 — Kwarcab Kota Tangerang (Roblox)

Game Roblox "naik gunung bareng" (summit/obby) untuk acara **JOTI 2026**.
Peta dibangun **otomatis oleh script**, jadi cukup pasang script lalu tekan Play.

## Isi game

- **Gunung Tunas Kelapa** setinggi ±290 stud dengan jalur pijakan kayu melingkar.
- **Basecamp → Pos 1 … Pos 7 → Puncak** (jumlahnya bisa diatur).
  - Jatuh dari jalur = mendarat di teras Pos sebelumnya (tidak langsung mati).
  - Kalau karakter mati/reset, pemain muncul lagi di Pos terakhirnya.
  - Pos harus dilewati berurutan, jadi tidak bisa dilompati.
- **Leaderboard**: `Posisi` (Pos saat ini) dan `Summit` (berapa kali sampai puncak).
- **Pengumuman ke semua pemain** saat ada yang sampai puncak, lengkap dengan waktu tempuhnya.
- **Papan "Buku Puncak"** di Basecamp berisi 10 pendaki terakhir yang sampai puncak.
- **HUD**: nama acara, Pos sekarang → Pos berikutnya, stopwatch, rekor pribadi,
  dan tombol **Turun ke Basecamp** untuk mendaki ulang.
- **Bendera Merah Putih** dan papan nama di puncak, serta papan selamat datang di Basecamp.
- **Data tersimpan** lewat DataStore: jumlah summit, rekor waktu, dan Pos terakhir
  (kalau keluar di tengah jalan, pemain lanjut dari Pos itu saat masuk lagi).

## Struktur file

```
roblox-joti-summit/
├── default.project.json          # konfigurasi Rojo
└── src/
    ├── shared/Config.luau             → ReplicatedStorage/SummitShared/Config (ModuleScript)
    ├── server/MapBuilder.luau         → ServerScriptService/SummitServer/MapBuilder (ModuleScript)
    ├── server/Main.server.luau        → ServerScriptService/SummitServer/Main (Script)
    └── client/SummitHUD.client.luau   → StarterPlayer/StarterPlayerScripts/SummitClient/SummitHUD (LocalScript)
```

## Cara pasang

### Opsi A — Copy-paste manual di Roblox Studio (paling mudah)

1. Buka **Roblox Studio** → **New** → pilih template **Baseplate**, lalu hapus part `Baseplate`
   dan `SpawnLocation` bawaan di Workspace.
2. Di **ReplicatedStorage**, buat **Folder** bernama `SummitShared`.
   Di dalamnya buat **ModuleScript** bernama `Config`, lalu tempel isi `src/shared/Config.luau`.
3. Di **ServerScriptService**, buat **Folder** bernama `SummitServer`. Di dalamnya:
   - **ModuleScript** bernama `MapBuilder` → tempel isi `src/server/MapBuilder.luau`
   - **Script** bernama `Main` → tempel isi `src/server/Main.server.luau`
4. Di **StarterPlayer → StarterPlayerScripts**, buat **LocalScript** bernama `SummitHUD`
   → tempel isi `src/client/SummitHUD.client.luau`.
5. Tekan **Play** untuk mencoba.

> Nama folder dan script harus sama persis (`SummitShared`, `Config`, `MapBuilder`),
> karena script saling memanggil dengan nama tersebut.

### Opsi B — Pakai Rojo (untuk yang terbiasa coding)

```bash
cd roblox-joti-summit
rojo serve        # lalu Connect dari plugin Rojo di Studio
# atau buat file place langsung:
rojo build -o JOTI2026-Summit.rbxlx
```

## Publish dan jadikan server acara

1. **File → Publish to Roblox**, beri nama misalnya *Summit Bareng JOTI 2026 Kwarcab Kota Tangerang*.
2. **Game Settings → Security → Enable Studio Access to API Services** = ON
   (agar data summit tersimpan; tanpa ini game tetap jalan tapi data tidak disimpan).
3. **Game Settings → Places → Max Players**: misal 30–50 per server.
   Kalau peserta banyak, Roblox otomatis membuka server baru.
4. **Server khusus per kontingen/gugus depan (opsional)**:
   di halaman game Roblox (Creator Dashboard → Monetization/Access), aktifkan
   **Private Servers** (bisa gratis), lalu bagikan link private server ke tiap kelompok
   supaya bisa summit bareng dalam satu server.
5. Ubah game menjadi **Public** saat acara dimulai (Creator Dashboard → Experience → Public).
   Untuk peserta anak-anak, atur **Maturity/Content questionnaire** agar game bisa dimainkan semua umur.

## Mengatur game (`Config.luau`)

| Pengaturan | Default | Fungsi |
|---|---|---|
| `EVENT_NAME`, `ORGANIZER`, `MOUNTAIN_NAME` | JOTI 2026, Kwarcab Kota Tangerang, Gunung Tunas Kelapa | Teks di papan, HUD, dan pengumuman |
| `STAGES` | 8 | Jumlah tahap (Pos 1–7 + Puncak) |
| `STAGE_HEIGHT` | 36 | Tinggi tiap tahap |
| `PLATFORMS_PER_STAGE` | 9 | Jumlah pijakan per tahap |
| `PLATFORM_SIZE` | 6 | Lebar pijakan (lebih kecil = lebih sulit) |
| `PLATFORM_SPACING` | 10 | Jarak antar-pijakan (lebih besar = lebih sulit; jangan lebih dari 13) |
| `BASE_RADIUS`, `RADIUS_STEP` | 150, 16 | Ukuran gunung dan lebar teras Pos |

Kalau `STAGES` dinaikkan, naikkan juga `BASE_RADIUS` (minimal `RADIUS_STEP × (STAGES-1) + 15`).

**Mau menghias peta sendiri?** Tekan Play di Studio, lalu salin folder `JOTISummitMap` dari
Workspace saat game berjalan dan tempel ke Workspace saat game berhenti.
Setelah itu script memakai peta yang sudah ada dan tidak membangun ulang,
jadi kamu bebas menambah tenda, api unggun, logo Tunas Kelapa, dan lainnya.
Bagian yang wajib dipertahankan adalah folder `Checkpoints` (part dengan atribut `Index`)
dan part `BukuPuncak`.
