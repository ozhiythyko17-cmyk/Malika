// ═══════════════════════════════════════════════════════════════════════════
//  SPPG TANJUNGSARI #004 — SIRNARASA, BOGOR
//  Basis data model 3D. Semua satuan panjang dalam milimeter.
//
//  Sumber:
//   [A] GBR_SPPG_TANJUNGSARI_004.pdf — CorelDRAW, 4 lembar, skala 1:100
//       hal.1 DENAH · hal.2 DENAH PENUTUP LANTAI · hal.3 INSTALASI ELEKTRIKAL
//       hal.4 INST. AIR KOTOR DAN LIMBAH
//   [B] 26-12-2025_SPPG-TANJUNGSARI.pdf — lembar kerja teknis, 13 halaman
//       denah berperabot + aksonometri + render per ruang
//
//  Geometri arsitektur (dinding, ruang, gutter, septictank) diekstrak langsung
//  dari vektor [A] sehingga presisi terhadap gambar kerja. Dimensi peralatan
//  yang tidak tercantum pada gambar ditandai estimated:true — angkanya
//  diturunkan dari simbol denah [B] dan harus dikunci ulang saat BoQ terbit.
// ═══════════════════════════════════════════════════════════════════════════

// Titik nol = perpotongan as-1 / as-Q (sudut barat laut bangunan).
// Sumbu X ke timur, sumbu Y (denah) ke selatan. Bangunan 20.000 × 20.000 mm.
const GRID_X = { 1: 0, 2: 2000, 3: 2500, 4: 3500, 5: 5500, 6: 7000, 7: 7500,
                 8: 8750, 9: 10000, 10: 11750, 11: 13000, 12: 16500, 13: 20000 };
const GRID_Y = { Q: 0, P: 1500, O: 3000, N: 3500, M: 4000, L: 6000, K: 6500,
                 J: 8000, H: 9500, "H'": 11500, G: 12000, F: 13500, E: 14500,
                 D: 15000, C: 16500, B: 18000, A: 20000 };

const BUILDING = { w: 20000, d: 20000, wallH: 3200, cutH: 1250, wallT: 150 };

const ZONES = {
  produksi:   { label: "Produksi",        color: 0xd9534f, tint: 0x3a2422 },
  distribusi: { label: "Distribusi",      color: 0xe0a33a, tint: 0x3a3222 },
  servis:     { label: "Servis basah",    color: 0x3fa7d6, tint: 0x1f3038 },
  gudang:     { label: "Gudang",          color: 0x6b8f71, tint: 0x24302a },
  sanitasi:   { label: "Sanitasi",        color: 0x7d8ba1, tint: 0x272d36 },
  staff:      { label: "Staf & loker",    color: 0x9a7bbd, tint: 0x2c2636 },
  kantor:     { label: "Kantor",          color: 0x5f8dd3, tint: 0x232b38 },
  publik:     { label: "Publik",          color: 0xc98a6b, tint: 0x342a24 },
  sirkulasi:  { label: "Sirkulasi",       color: 0x7f8c8d, tint: 0x2a2d2e },
  utilitas:   { label: "Utilitas",        color: 0xf1ca48, tint: 0x38321d },
};

// ── RUANG ──────────────────────────────────────────────────────────────────
// rect: [x0, y0, x1, y1] pada as dinding. level: peil lantai (mm).
// Semua koordinat dibaca langsung dari vektor DENAH [A].
const ROOMS = [
  { code: "T-01", name: "Toilet Staf 1",              rect: [-9, -15, 1991, 1485],      zone: "sanitasi",  level: -50 },
  { code: "A-01", name: "R. Tidur Staf SPPG 1",       rect: [-9, -15, 3491, 3986],      zone: "staff",     level: 0, carve: [[-9, -15, 1991, 1485]] },
  { code: "T-02", name: "Toilet Staf 2",              rect: [-9, 6486, 1991, 7986],     zone: "sanitasi",  level: -50 },
  { code: "A-02", name: "R. Tidur Staf SPPG 2",       rect: [-9, 3986, 3491, 7986],     zone: "staff",     level: 0, carve: [[-9, 6486, 1991, 7986]] },
  { code: "T-03", name: "Toilet Kepala SPPG",         rect: [-9, 7986, 1991, 9486],     zone: "sanitasi",  level: -50 },
  { code: "A-03", name: "R. Tidur Kepala SPPG",       rect: [-9, 7986, 3491, 11986],    zone: "staff",     level: 0, carve: [[-9, 7986, 1991, 9486]] },
  { code: "T-04", name: "Toilet R. Kerja",            rect: [-9, 11986, 1991, 13486],   zone: "sanitasi",  level: -50 },
  { code: "K-01", name: "R. Kerja SPPI",              rect: [-9, 11986, 3491, 16486],   zone: "kantor",    level: 0, carve: [[-9, 11986, 1991, 13486]] },
  { code: "K-02", name: "R. Konsultasi Gizi",         rect: [-9, 16486, 2491, 19987],   zone: "kantor",    level: 0 },
  { code: "T-05", name: "Toilet Umum 1",              rect: [3491, -15, 5491, 1485],    zone: "sanitasi",  level: -50 },
  { code: "T-06", name: "Toilet Umum 2",              rect: [5491, -15, 7491, 1485],    zone: "sanitasi",  level: -50 },
  { code: "G-01", name: "Gudang Janitor",             rect: [3491, 1485, 7491, 2986],   zone: "gudang",    level: 0 },
  { code: "G-02", name: "Gudang Bahan Kering",        rect: [3491, 2986, 7491, 5986],   zone: "gudang",    level: 0 },
  { code: "G-03", name: "Gudang Bahan Basah",         rect: [3491, 5986, 7491, 9486],   zone: "gudang",    level: 0 },
  { code: "G-04", name: "R. Simpan Susu",             rect: [3491, 9486, 7491, 11486],  zone: "gudang",    level: 0 },
  { code: "S-01", name: "R. Cuci Bahan Makanan",      rect: [3491, 11486, 6991, 14486], zone: "servis",    level: 0 },
  { code: "S-02", name: "R. Penerimaan Bahan Makanan", rect: [3491, 14486, 6991, 16486], zone: "servis",   level: 0 },
  { code: "P-01", name: "Lobby / R. Tamu",            rect: [2491, 16486, 6991, 19987], zone: "publik",    level: 0 },
  { code: "G-05", name: "Gudang Alat Dapur",          rect: [8741, -15, 11741, 3486],   zone: "gudang",    level: 0 },
  { code: "S-03", name: "Area Persiapan Bahan Makanan", rect: [7491, 1485, 11741, 7986], zone: "servis",   level: 0, carve: [[8741, -15, 11741, 3486]] },
  { code: "R-01", name: "R. Produksi",                rect: [11741, -15, 19992, 7986],  zone: "produksi",  level: 0 },
  { code: "D-01", name: "R. Simpan Hasil Pengolahan", rect: [9991, 7986, 12991, 11486], zone: "distribusi", level: 0 },
  { code: "D-02", name: "R. Pemorsian / Packing",     rect: [12991, 7986, 19992, 14986], zone: "distribusi", level: 0 },
  { code: "C-01", name: "Area Loading",               rect: [6991, 11486, 12991, 19987], zone: "sirkulasi", level: 0 },
  { code: "A-04", name: "Loker Wanita",               rect: [12991, 14986, 16492, 16486], zone: "staff",   level: 0 },
  { code: "A-05", name: "Loker Pria",                 rect: [12991, 16486, 16492, 17987], zone: "staff",   level: 0 },
  { code: "D-03", name: "R. Simpan Food Tray",        rect: [16492, 14986, 19992, 17987], zone: "distribusi", level: 0 },
  { code: "S-04", name: "R. Cuci Food Tray",          rect: [12991, 17987, 19992, 19987], zone: "servis",  level: 0 },
  { code: "U-01", name: "R. Gas",                     rect: [19992, 2485, 21492, 4986], zone: "utilitas",  level: 0 },
];

// ── PERALATAN ──────────────────────────────────────────────────────────────
// x / y = titik tengah unit pada denah (mm). rot = rotasi terhadap sumbu Y (derajat).
// estimated:true → dimensi belum terkunci di gambar/BoQ, diturunkan dari simbol denah.
const EQUIPMENT = [
  // ── R. PRODUKSI · hot line di sisi utara ────────────────────────────────
  { code: "PR-01", name: "Kompor Gas + Panci Perebus", room: "R-01", kind: "kettle",
    w: 700, d: 700, h: 850, x: 14784, y: 540, rot: 0, hot: true, estimated: true,
    basis: "Enam unit masak berjajar di dinding utara R. Produksi pada denah berperabot [B]. Dua unit paling barat bersimbol panci bertutup. Pitch as-ke-as terukur 900 mm; ukuran unit 700 × 700 mm estimasi dari simbol." },
  { code: "PR-02", name: "Kompor Gas + Panci Perebus", room: "R-01", kind: "kettle",
    w: 700, d: 700, h: 850, x: 15735, y: 540, rot: 0, hot: true, estimated: true,
    basis: "Unit kedua pada hot line, simbol sama dengan PR-01. Ukuran estimasi 700 × 700 mm." },
  { code: "PR-03", name: "Kompor Gas + Wajan/Kuali", room: "R-01", kind: "wok",
    w: 700, d: 700, h: 850, x: 16640, y: 540, rot: 0, hot: true, estimated: true,
    basis: "Empat unit timur pada hot line bersimbol kuali/panci besar dengan sambungan gas di sisi bawah. Ukuran estimasi 700 × 700 mm." },
  { code: "PR-04", name: "Kompor Gas + Wajan/Kuali", room: "R-01", kind: "wok",
    w: 700, d: 700, h: 850, x: 17527, y: 540, rot: 0, hot: true, estimated: true,
    basis: "Unit keempat pada hot line. Ukuran estimasi 700 × 700 mm." },
  { code: "PR-05", name: "Kompor Gas + Wajan/Kuali", room: "R-01", kind: "wok",
    w: 700, d: 700, h: 850, x: 18414, y: 540, rot: 0, hot: true, estimated: true,
    basis: "Unit kelima pada hot line. Ukuran estimasi 700 × 700 mm." },
  { code: "PR-06", name: "Kompor Gas + Wajan/Kuali", room: "R-01", kind: "wok",
    w: 700, d: 700, h: 850, x: 19264, y: 540, rot: 0, hot: true, estimated: true,
    basis: "Unit paling timur pada hot line, berjarak ±430 mm dari dinding timur. Ukuran estimasi 700 × 700 mm." },
  { code: "PR-07", name: "Meja Kerja Stainless 1500", room: "R-01", kind: "table",
    w: 1500, d: 600, h: 850, x: 14770, y: 4600, rot: 0, estimated: true,
    basis: "Meja kerja di tengah R. Produksi, terbaca ±1.420 × 510 mm pada denah berperabot [B]; dibulatkan ke ukuran fabrikasi lazim 1.500 × 600 mm." },
  { code: "PR-08", name: "Meja Kerja Stainless 1500", room: "R-01", kind: "table",
    w: 1500, d: 800, h: 850, x: 16340, y: 4590, rot: 0, estimated: true,
    basis: "Meja kedua menempel di sisi timur PR-07, terbaca ±1.490 × 780 mm pada [B]." },
  { code: "PR-09", name: "Rak Stainless 3 Tingkat", room: "R-01", kind: "rack",
    w: 2100, d: 700, h: 1800, x: 12195, y: 6800, rot: 90, estimated: true,
    basis: "Rak bertingkat menempel dinding barat R. Produksi, tiga segmen, total ±660 × 2.130 mm pada [B]. Tinggi 1.800 mm estimasi." },
  { code: "PR-10", name: "Meja Kerja Stainless 900", room: "R-01", kind: "table",
    w: 900, d: 600, h: 850, x: 16035, y: 7640, rot: 0, estimated: true,
    basis: "Sepasang meja di dinding selatan R. Produksi, masing-masing ±900 × 530 mm pada [B]." },
  { code: "PR-11", name: "Meja Kerja Stainless 900", room: "R-01", kind: "table",
    w: 900, d: 600, h: 850, x: 16970, y: 7640, rot: 0, estimated: true,
    basis: "Pasangan dari PR-10." },
  { code: "PR-12", name: "Sink Cuci 1 Bak", room: "R-01", kind: "sink",
    w: 700, d: 700, h: 850, x: 19590, y: 6260, rot: 0, estimated: true,
    basis: "Dua bak cuci menempel dinding timur R. Produksi pada [B], masing-masing ±720 × 675 mm. Terletak di ujung selatan jalur gutter sisi timur." },
  { code: "PR-13", name: "Sink Cuci 1 Bak", room: "R-01", kind: "sink",
    w: 700, d: 700, h: 850, x: 19590, y: 6930, rot: 0, estimated: true,
    basis: "Pasangan dari PR-12." },
  { code: "PR-14", name: "Tong Sampah Beroda 660 L", room: "R-01", kind: "bin",
    w: 950, d: 680, h: 1200, x: 12400, y: 3130, rot: 0, estimated: true,
    basis: "Tong sampah hijau beroda di sudut barat laut R. Produksi pada [B] dan render R. Produksi. Ukuran mengacu tipe 660 L (±1.370 × 780 mm) — di sini dipakai ±950 × 680 mm sesuai simbol denah." },

  // ── AREA PERSIAPAN BAHAN MAKANAN ────────────────────────────────────────
  { code: "PS-01", name: "Meja Persiapan + Overshelf", room: "S-03", kind: "table-shelf",
    w: 1500, d: 600, h: 1500, x: 9750, y: 3870, rot: 0, estimated: true,
    basis: "Meja kerja dengan rak gantung dua tingkat, terlihat pada render R. PERSIAPAN [B] hal.3–4. Terbaca ±1.490 × 500 mm pada denah berperabot." },
  { code: "PS-02", name: "Meja Persiapan Stainless", room: "S-03", kind: "table",
    w: 1500, d: 700, h: 850, x: 9750, y: 5340, rot: 0, estimated: true,
    basis: "Meja kerja kedua di Area Persiapan, terbaca ±1.490 × 663 mm pada [B]." },
  { code: "PS-03", name: "Showcase Chiller 2 Pintu", room: "S-03", kind: "upright",
    w: 1500, d: 700, h: 1950, x: 9750, y: 6040, rot: 0, estimated: true,
    basis: "Dua showcase chiller kaca berdiri berdampingan pada render R. PERSIAPAN [B]. Pada denah terbaca satu blok ±1.490 × 719 mm." },
  { code: "PS-04", name: "Rak Stainless 4 Tingkat", room: "S-03", kind: "rack",
    w: 1160, d: 500, h: 1800, x: 9700, y: 8580, rot: 90, estimated: true,
    basis: "Rak tinggi di sisi selatan Area Persiapan pada [B]; pada render tampak empat tingkat." },
  { code: "PS-05", name: "Chest Freezer", room: "S-03", kind: "freezer",
    w: 1100, d: 600, h: 900, x: 11130, y: 7610, rot: 0, estimated: true,
    basis: "Unit rendah ±1.100 × 600 mm di batas Area Persiapan–R. Produksi pada [B]; pada render R. PERSIAPAN tampak chest freezer putih." },

  // ── R. SIMPAN HASIL PENGOLAHAN ──────────────────────────────────────────
  { code: "SH-01", name: "Rak Simpan Stainless", room: "D-01", kind: "rack",
    w: 1500, d: 700, h: 1800, x: 10460, y: 8960, rot: 90, estimated: true,
    basis: "Dua rak berjajar menempel dinding barat R. Simpan Hasil Pengolahan, masing-masing ±690 × 1.490 mm pada [B]." },
  { code: "SH-02", name: "Rak Simpan Stainless", room: "D-01", kind: "rack",
    w: 1500, d: 700, h: 1800, x: 10460, y: 10460, rot: 90, estimated: true,
    basis: "Pasangan dari SH-01." },

  // ── R. PEMORSIAN / PACKING ──────────────────────────────────────────────
  { code: "PM-01", name: "Meja Pemorsian 1500 × 700", room: "D-02", kind: "tray-table",
    w: 1500, d: 700, h: 850, x: 14880, y: 10620, rot: 90, estimated: true,
    basis: "Blok barat R. Pemorsian: empat meja disusun 2 × 2 membentuk pulau ±1.355 × 2.982 mm pada [B]. Render R. PEMORSIAN memperlihatkan ompreng tertata penuh di atasnya." },
  { code: "PM-02", name: "Meja Pemorsian 1500 × 700", room: "D-02", kind: "tray-table",
    w: 1500, d: 700, h: 850, x: 15570, y: 10620, rot: 90, estimated: true, basis: "Bagian dari pulau blok barat." },
  { code: "PM-03", name: "Meja Pemorsian 1500 × 700", room: "D-02", kind: "tray-table",
    w: 1500, d: 700, h: 850, x: 14880, y: 12110, rot: 90, estimated: true, basis: "Bagian dari pulau blok barat." },
  { code: "PM-04", name: "Meja Pemorsian 1500 × 700", room: "D-02", kind: "tray-table",
    w: 1500, d: 700, h: 850, x: 15570, y: 12110, rot: 90, estimated: true, basis: "Bagian dari pulau blok barat." },
  { code: "PM-05", name: "Meja Pemorsian 1500 × 700", room: "D-02", kind: "tray-table",
    w: 1500, d: 700, h: 850, x: 17990, y: 10620, rot: 90, estimated: true,
    basis: "Blok timur R. Pemorsian: empat meja disusun 2 × 2, pulau ±1.383 × 2.982 mm pada [B]." },
  { code: "PM-06", name: "Meja Pemorsian 1500 × 700", room: "D-02", kind: "tray-table",
    w: 1500, d: 700, h: 850, x: 18680, y: 10620, rot: 90, estimated: true, basis: "Bagian dari pulau blok timur." },
  { code: "PM-07", name: "Meja Pemorsian 1500 × 700", room: "D-02", kind: "tray-table",
    w: 1500, d: 700, h: 850, x: 17990, y: 12110, rot: 90, estimated: true, basis: "Bagian dari pulau blok timur." },
  { code: "PM-08", name: "Meja Pemorsian 1500 × 700", room: "D-02", kind: "tray-table",
    w: 1500, d: 700, h: 850, x: 18680, y: 12110, rot: 90, estimated: true, basis: "Bagian dari pulau blok timur." },
  { code: "PM-09", name: "Tong Sampah Beroda", room: "D-02", kind: "bin",
    w: 900, d: 600, h: 1100, x: 13350, y: 10950, rot: 90, estimated: true,
    basis: "Tong sampah hijau di sisi barat R. Pemorsian pada [B], juga tampak pada render." },

  // ── R. CUCI FOOD TRAY ───────────────────────────────────────────────────
  { code: "CT-01", name: "Sink Cuci Food Tray 2 Bak", room: "S-04", kind: "sink2",
    w: 1190, d: 600, h: 850, x: 14295, y: 19290, rot: 0, estimated: true,
    basis: "Tiga unit sink dua bak berjajar di dinding selatan, total ±3.570 × 560 mm pada [B]. Sejajar dengan gutter + grill sepanjang 6.850 mm di sisi utaranya." },
  { code: "CT-02", name: "Sink Cuci Food Tray 2 Bak", room: "S-04", kind: "sink2",
    w: 1190, d: 600, h: 850, x: 15485, y: 19290, rot: 0, estimated: true, basis: "Unit kedua dari rangkaian sink cuci food tray." },
  { code: "CT-03", name: "Sink Cuci Food Tray 2 Bak", room: "S-04", kind: "sink2",
    w: 1190, d: 600, h: 850, x: 16675, y: 19290, rot: 0, estimated: true, basis: "Unit ketiga dari rangkaian sink cuci food tray." },
  { code: "CT-04", name: "Rak Tiris Food Tray", room: "S-04", kind: "rack",
    w: 750, d: 600, h: 1500, x: 18500, y: 19230, rot: 90, estimated: true,
    basis: "Unit terpisah di ujung timur R. Cuci Food Tray pada [B], ±600 × 745 mm. Fungsi diasumsikan rak tiris." },

  // ── R. CUCI BAHAN MAKANAN ───────────────────────────────────────────────
  { code: "CB-01", name: "Sink Cuci Bahan Makanan", room: "S-01", kind: "sink2",
    w: 1800, d: 700, h: 850, x: 3941, y: 12986, rot: 90, estimated: true,
    basis: "Unit cuci menempel dinding barat R. Cuci Bahan Makanan, tepat di sisi gutter + grill vertikal 2.850 mm yang terbaca pada DENAH PENUTUP LANTAI [A] hal.2." },

  // ── GUDANG & PENERIMAAN ─────────────────────────────────────────────────
  { code: "GD-01", name: "Rak Gudang Bahan Kering", room: "G-02", kind: "rack",
    w: 2500, d: 500, h: 1800, x: 3841, y: 4486, rot: 90, estimated: true,
    basis: "Rak dinding pada denah berperabot [B]; ukuran rak gudang standar 500 mm dalam, panjang mengikuti bentang dinding." },
  { code: "GD-02", name: "Rak Gudang Bahan Basah", room: "G-03", kind: "rack",
    w: 2500, d: 500, h: 1800, x: 3841, y: 7736, rot: 90, estimated: true,
    basis: "Rak dinding pada denah berperabot [B]; dimensi estimasi." },
  { code: "GD-03", name: "Chiller Simpan Susu", room: "G-04", kind: "upright",
    w: 1200, d: 700, h: 1950, x: 4141, y: 9886, rot: 0, estimated: true,
    basis: "Unit dingin di R. Simpan Susu pada [B]; dimensi estimasi mengikuti chiller 2 pintu." },
  { code: "PN-01", name: "Meja Penerimaan + Timbangan", room: "S-02", kind: "table",
    w: 1500, d: 700, h: 850, x: 5241, y: 15486, rot: 0, estimated: true,
    basis: "Meja di R. Penerimaan Bahan Makanan pada [B]; dimensi estimasi." },

  // ── LOKER & FOOD TRAY ───────────────────────────────────────────────────
  { code: "LK-01", name: "Loker Karyawan Wanita", room: "A-04", kind: "locker",
    w: 2400, d: 500, h: 1800, x: 14500, y: 15236, rot: 0, estimated: true,
    basis: "Deret loker pada denah berperabot [B]; dimensi estimasi modul loker 6 pintu." },
  { code: "LK-02", name: "Loker Karyawan Pria", room: "A-05", kind: "locker",
    w: 2400, d: 500, h: 1800, x: 14500, y: 16736, rot: 0, estimated: true,
    basis: "Deret loker pada denah berperabot [B]; dimensi estimasi modul loker 6 pintu." },
  { code: "FT-01", name: "Rak Simpan Food Tray", room: "D-03", kind: "rack",
    w: 2400, d: 600, h: 1800, x: 16942, y: 16486, rot: 90, estimated: true,
    basis: "Rak di R. Simpan Food Tray pada [B]; dimensi estimasi." },
  { code: "FT-02", name: "Rak Simpan Food Tray", room: "D-03", kind: "rack",
    w: 2400, d: 600, h: 1800, x: 19542, y: 16486, rot: 90, estimated: true,
    basis: "Rak kedua di R. Simpan Food Tray; dimensi estimasi." },

  // ── KANTOR, LOBBY, HUNIAN ───────────────────────────────────────────────
  { code: "KJ-01", name: "Meja Kerja SPPI", room: "K-01", kind: "desk",
    w: 1400, d: 700, h: 750, x: 2291, y: 14100, rot: 0, estimated: true,
    basis: "Dua meja kerja berhadapan dengan lemari arsip pada render R. KERJA [B] hal.13." },
  { code: "KJ-02", name: "Meja Kerja SPPI", room: "K-01", kind: "desk",
    w: 1400, d: 700, h: 750, x: 2291, y: 15400, rot: 0, estimated: true, basis: "Pasangan dari KJ-01." },
  { code: "KJ-03", name: "Lemari Arsip", room: "K-01", kind: "cabinet",
    w: 900, d: 450, h: 1800, x: 3041, y: 12900, rot: 0, estimated: true,
    basis: "Lemari kayu berpintu kaca pada render R. KERJA [B] hal.13." },
  { code: "KG-01", name: "Meja Konsultasi Gizi", room: "K-02", kind: "desk",
    w: 1800, d: 900, h: 750, x: 1191, y: 18236, rot: 0, estimated: true,
    basis: "Meja rapat dengan enam kursi pada render R. KONSULTASI [B] hal.12." },
  { code: "KG-02", name: "Lemari Arsip", room: "K-02", kind: "cabinet",
    w: 900, d: 450, h: 1800, x: 1191, y: 16886, rot: 0, estimated: true,
    basis: "Lemari kayu berpintu kaca pada render R. KONSULTASI [B] hal.12." },
  { code: "LB-01", name: "Kursi Tunggu 4 Dudukan", room: "P-01", kind: "bench",
    w: 2000, d: 600, h: 850, x: 4741, y: 19587, rot: 0, estimated: true,
    basis: "Bangku tunggu dan meja rendah pada render LOBBY / R. TAMU [B] hal.11." },
  { code: "LB-02", name: "Meja Tamu", room: "P-01", kind: "table",
    w: 900, d: 500, h: 450, x: 4741, y: 18700, rot: 0, estimated: true,
    basis: "Meja rendah di depan kursi tunggu pada render LOBBY [B] hal.11." },
  { code: "TD-01", name: "Tempat Tidur + Lemari", room: "A-01", kind: "bed",
    w: 2000, d: 1000, h: 500, x: 2791, y: 2700, rot: 90, estimated: true,
    basis: "Dua tempat tidur single dan lemari pakaian pada denah berperabot [B]." },
  { code: "TD-02", name: "Tempat Tidur + Lemari", room: "A-02", kind: "bed",
    w: 2000, d: 1000, h: 500, x: 2791, y: 5200, rot: 90, estimated: true,
    basis: "Dua tempat tidur single dan lemari pakaian pada denah berperabot [B]." },
  { code: "TD-03", name: "Tempat Tidur + Lemari", room: "A-03", kind: "bed",
    w: 2000, d: 1000, h: 500, x: 2791, y: 10600, rot: 90, estimated: true,
    basis: "Tempat tidur kepala SPPG pada denah berperabot [B]." },
];

// ── UTILITAS ───────────────────────────────────────────────────────────────
// Gutter + grill: koordinat presisi dari vektor DENAH PENUTUP LANTAI [A] hal.2.
const GUTTERS = [
  { code: "GT-01", name: "Gutter + Grill R. Produksi — segmen utara", rect: [11816, 1635, 18667, 1835],
    basis: "Diekstrak dari vektor [A] hal.2. Lebar 200 mm, panjang 6.851 mm, melintang di depan hot line." },
  { code: "GT-02", name: "Gutter + Grill R. Produksi — segmen timur", rect: [18467, 1835, 18667, 7911],
    basis: "Diekstrak dari vektor [A] hal.2. Lebar 200 mm, panjang 6.076 mm, menyusur ke selatan menuju sink PR-12/13." },
  { code: "GT-03", name: "Gutter + Grill R. Cuci Bahan Makanan", rect: [4366, 11561, 4566, 14411],
    basis: "Diekstrak dari vektor [A] hal.2. Lebar 200 mm, panjang 2.850 mm, sejajar sink CB-01." },
  { code: "GT-04", name: "Gutter + Grill R. Cuci Food Tray", rect: [13066, 18912, 19917, 19112],
    basis: "Diekstrak dari vektor [A] hal.2. Lebar 200 mm, panjang 6.851 mm, di sisi utara deret sink CT-01…03." },
];

// Tabung LPG di R. Gas — posisi dibaca dari denah berperabot [B].
const LPG = [
  [20393, 2869], [20880, 3060], [20400, 3350],
  [20870, 3555], [20390, 3880], [20870, 3890],
];

// Jalur gas — SKEMATIK. Paket gambar [A] tidak memuat lembar instalasi gas;
// rute di bawah menghubungkan R. Gas ke hot line mengikuti garis pipa yang
// tergambar menembus keenam unit masak pada denah berperabot [B].
const GAS_ROUTE = [
  [20600, 3735], [19700, 3735], [19700, 900], [14300, 900],
];

// Instalasi air kotor & limbah — vektor [A] hal.4, di utara bangunan.
const WASTE = [
  { code: "W-01", name: "Sumur Resapan",      shape: "circle", rect: [6591, -4615, 7891, -3315],
    basis: "Lingkaran Ø1.300 mm pada INST. AIR KOTOR DAN LIMBAH [A] hal.4." },
  { code: "W-02", name: "Grease Trap / IPAL", shape: "box",    rect: [10741, -4615, 14291, -3315],
    basis: "Kotak 3.550 × 1.300 mm pada [A] hal.4, menerima limbah dapur sebelum ke sumur resapan." },
  { code: "W-03", name: "Septictank",         shape: "box",    rect: [17142, -4615, 19992, -3315],
    basis: "Kotak 2.850 × 1.300 mm pada [A] hal.4." },
];
const WASTE_PIPE = [
  [7241, -3315], [7241, -1000], [19000, -1000], [19000, -3315],
];

// Lampu TL LED 2 × 40 W — posisi presisi dari vektor INSTALASI ELEKTRIKAL [A] hal.3.
const LAMPS = [
  [13616, 1485], [13616, 3986], [13616, 6486],
  [15867, 1485], [15867, 3986], [15867, 6486],
  [18117, 1485], [18117, 3986], [18117, 6486],
  [15366, 9486], [15366, 11486], [15366, 13486],
  [17617, 9486], [17617, 11486], [17617, 13486],
  [11491, 9736],
];

// Penanda sirkulasi pada denah.
const MARKERS = [
  { text: "MASUK",  x: 7981,  y: 21100, color: "#f1ca48" },
  { text: "KELUAR", x: 11983, y: 21100, color: "#f1ca48" },
];
