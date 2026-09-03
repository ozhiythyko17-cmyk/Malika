# Spesifikasi Template Pedoman Kampus

Status: **implementasi awal sudah ada** — `backend/app/templates.py` +
`backend/app/templates_data/generik-id.json`.

## 1. Masalah yang diselesaikan

Setiap kampus (bahkan tiap prodi) punya pedoman penulisan sendiri: struktur bab,
nama subbab wajib, margin, font, spasi, gaya sitasi. Kalau ini di-hardcode,
menambah kampus baru berarti mengubah kode dan menguji ulang seluruh pipeline.

Karena itu template disimpan sebagai **data (JSON)**, bukan kode. Menambah kampus
= menambah satu file JSON.

## 2. Peran template di pipeline

Template dibaca oleh tiga komponen:

| Komponen | Yang dipakai |
|---|---|
| Outline Agent | `chapters[].key/number/title`, `chapters[].required_sections` — kerangka wajib mengikuti pedoman, bukan tebakan model |
| QA Agent | `chapters[].min_words`, kelengkapan bab — dasar temuan `blocker`/`warning` |
| Formatting Agent | `page`, `front_matter`, `bibliography_heading`, `chapter_heading_format` |

Kunci bab (`bab1`…`bab5`) adalah **identitas stabil** yang dipakai lintas
komponen: prompt revisi ("perbaiki bab 2"), status review mahasiswa, dan
penomoran ulang semuanya bersandar pada kunci ini. Outline Agent menormalkan
keluaran model ke kunci template (`OutlineAgent._normalize`) supaya model tidak
bisa "mengarang" struktur bab di luar pedoman.

## 3. Skema

```jsonc
{
  "id": "generik-id",                  // = nama file, dipakai di API (template_id)
  "name": "Pedoman Generik Skripsi S1 Indonesia",
  "institution": null,                 // isi bila template milik kampus tertentu
  "default_citation_style": "apa7",    // apa7 | ieee
  "page": {
    "paper": "A4",
    "margin_top_cm": 3.0,
    "margin_bottom_cm": 3.0,
    "margin_left_cm": 4.0,             // margin kiri lebih lebar untuk penjilidan
    "margin_right_cm": 3.0,
    "font_family": "Times New Roman",
    "font_size_pt": 12.0,
    "line_spacing": 2.0
  },
  "front_matter": ["halaman_judul", "halaman_pengesahan", "..."],
  "chapters": [
    {
      "key": "bab1",                   // identitas stabil, jangan diubah setelah dipakai
      "number": 1,
      "title": "PENDAHULUAN",
      "required_sections": ["Latar Belakang", "Rumusan Masalah"],
      "min_words": 1200
    }
  ],
  "bibliography_heading": "DAFTAR PUSTAKA",
  "chapter_heading_format": "BAB {roman}\n{title}"
}
```

## 4. Cara menambah template kampus baru

1. Salin `backend/app/templates_data/generik-id.json` menjadi
   `<slug-kampus>.json` (mis. `unpad-fmipa.json`).
2. Sesuaikan `chapters`, `page`, `front_matter` dengan buku pedoman resmi prodi.
3. Isi `institution` dengan nama kampus/prodi.
4. Template langsung muncul di `GET /api/templates` (dibaca dari direktori,
   tidak ada registry yang perlu diubah).
5. Uji dengan satu prompt nyata dan periksa: kunci bab tidak berubah, subbab
   wajib muncul, dan `min_words` realistis (kalau terlalu tinggi, QA akan
   membanjiri temuan `warning`).

## 5. Keputusan rancangan

- **`min_words` per bab, bukan global.** BAB II (tinjauan pustaka) wajar 2000
  kata, BAB V (kesimpulan) wajar 600. Satu angka global menghasilkan bab yang
  digelembungkan atau QA yang cerewet.
- **Ambang peringatan 60% dari `min_words`.** Menghukum bab yang jelas kurang
  garap tanpa menolak variasi wajar antar topik.
- **Margin/font disimpan sebagai data numerik**, bukan string CSS, supaya bisa
  dipakai langsung oleh eksporter DOCX (`python-docx`) maupun PDF.
- **`front_matter` baru berupa daftar nama bagian**, belum berisi isinya.
  Halaman pengesahan butuh nama dosen pembimbing & NIP yang tidak boleh diarang
  AI — bagian ini akan diisi dari data proyek mahasiswa, bukan digenerate.

## 6. Yang belum dikerjakan

- **Eksporter DOCX/PDF.** `FormattingAgent.page_metadata()` sudah menyiapkan
  metadata halaman; renderer `.docx` (python-docx) dan PDF belum ada. Saat ini
  ekspor menghasilkan Markdown.
- **Daftar isi otomatis dengan nomor halaman** (hanya mungkin setelah render
  DOCX/PDF, karena butuh paginasi nyata).
- **Front matter terisi** (halaman judul, pengesahan) dari data proyek.
- **Template per prodi nyata.** `generik-id` sengaja netral; sebelum peluncuran
  perlu minimal satu template kampus asli yang diverifikasi ke buku pedomannya.
- **Validasi template saat startup** (mis. nomor bab berurutan, kunci unik) —
  sekarang kesalahan template baru terlihat saat dipakai.
