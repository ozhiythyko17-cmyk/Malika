# PRD — SkripsiKu

**Versi:** 0.1 · **Tanggal:** 5 September 2026 · **Status:** draft untuk ditinjau

Dokumen ini adalah acuan produk. Rencana awal ada di
[perencanaan-aplikasi-skripsi.md](perencanaan-aplikasi-skripsi.md); spesifikasi teknis
mendalam ada di [spec-citation-agent.md](spec-citation-agent.md) dan
[spec-template-kampus.md](spec-template-kampus.md).

---

## 1. Ringkasan

SkripsiKu adalah aplikasi pendamping mahasiswa menyusun skripsi **dari penentuan topik
sampai sidang**. Mahasiswa memberi prompt (atau meminta dibantu mencari topik), lalu
pipeline multi-agent mencari literatur nyata, menyusun kerangka, dan menulis BAB I–V.
Hasilnya **draft berbantuan AI** yang wajib direview mahasiswa per bab sebelum bisa
diekspor, dengan asisten AI yang bisa ditanya kapan saja soal isi draftnya sendiri.

**Masalah yang diselesaikan**

| Masalah | Bukti/alasan |
|---|---|
| Mahasiswa stuck di titik nol — belum punya topik | Tahap paling lama pada banyak kasus; salah pilih topik berujung ganti judul di tengah jalan |
| Topik dipilih tanpa memeriksa ketersediaan data | Penyebab skripsi mandek paling umum: topik bagus, datanya tak terjangkau |
| Menulis dari nol memakan waktu berbulan-bulan | Terutama BAB I–III yang polanya berulang antar-skripsi |
| Referensi salah kutip atau tidak ada wujudnya | Alat AI umum mengarang judul/DOI yang terlihat sah — fatal saat sidang |
| Progres tidak terpantau, bimbingan tercecer | Feedback dosen tersebar di WA/email, revisi hilang |

**Yang membedakan dari alat AI umum:** setiap referensi diverifikasi ke indeks nyata,
bagian yang butuh data primer ditolak untuk diisi AI, dan ekspor dikunci sampai
mahasiswa membaca tiap bab.

## 2. Sasaran & bukan sasaran

**Sasaran**

- S-1 Mahasiswa tanpa ide bisa keluar dari aplikasi dengan topik yang layak dikerjakan.
- S-2 Draft BAB I–III tersusun dalam hitungan menit, bukan bulan.
- S-3 Nol referensi fiktif pada dokumen yang diekspor.
- S-4 Mahasiswa memahami isi draftnya sendiri (bisa mempertahankannya saat sidang).
- S-5 Bisa dipakai lintas jurusan, bukan hanya rumpun teknologi.

**Bukan sasaran (eksplisit)**

- B-1 **Bukan jasa joki.** Aplikasi tidak menyembunyikan keterlibatan AI, tidak mengisi
  data penelitian, dan tidak menghasilkan dokumen siap-submit tanpa keterlibatan penulis.
  Di Indonesia jual-beli karya ilmiah untuk memperoleh gelar diatur UU No. 12/2012
  Pasal 90, dengan sanksi bagi penyedia maupun pengguna.
- B-2 Bukan pengganti dosen pembimbing.
- B-3 Bukan alat analisis statistik/pengolah data penelitian.
- B-4 Tidak menjanjikan kelulusan atau nilai tertentu.

## 3. Pengguna

| Persona | Situasi | Kebutuhan utama |
|---|---|---|
| **Mahasiswa buntu** (belum punya topik) | Semester akhir, belum tahu mau meneliti apa | Usulan topik realistis sesuai jurusan & akses datanya |
| **Mahasiswa jalan** (sudah punya topik) | Judul disetujui, belum mulai menulis | Draft cepat + referensi sahih + pendamping saat bingung |
| **Mahasiswa revisi** | Draft ada, kena coretan pembimbing | Revisi terarah per bab tanpa menulis ulang semuanya |
| **Dosen pembimbing** (v1.1) | Membimbing 10–20 mahasiswa | Melihat progres & jejak penggunaan AI, komentar per bab |

## 4. Perjalanan pengguna

Tujuh tahap yang menjadi tulang punggung aplikasi (status tiap tahap **diturunkan dari
keadaan draft**, bukan diklaim pengguna, kecuali dua tahap manual):

| # | Tahap | Selesai bila | Alat bantu |
|---|---|---|---|
| 1 | Tentukan topik | Draft sudah dibuat dari sebuah topik | Cari topik skripsi |
| 2 | Susun judul & rumusan masalah | Judul kerja + rumusan masalah terisi | Cek kelayakan judul |
| 3 | Proposal (BAB I–III) | BAB I–III ditandai sudah direview mahasiswa | Draft |
| 4 | Bimbingan & seminar proposal | **Manual** — aplikasi tidak tahu jadwal kampus | Siapkan bimbingan |
| 5 | Ambil & olah data | Tidak ada penanda `[BUTUH DATA]` **dan** BAB IV sudah direview | — (pekerjaan mahasiswa) |
| 6 | Hasil & pembahasan (BAB IV–V) | Data terisi **dan** BAB IV–V direview | Draft + revisi |
| 7 | Sidang | **Manual** | Latihan sidang |

Urutan ini disengaja: seminar proposal mendahului pengambilan data, sesuai praktik umum
prodi di Indonesia.

## 5. Kebutuhan fungsional

Status: ✅ selesai · 🟡 sebagian · ⬜ belum

### 5.1 Onboarding & pembuatan proyek

| ID | Kebutuhan | Kriteria penerimaan | Status |
|---|---|---|---|
| F-01 | Buat skripsi baru dari satu tombol di Beranda | Wizard terbuka; proyek baru terbentuk dan tersimpan | ✅ |
| F-02 | Pilih jurusan lintas fakultas | ≥12 jurusan dengan pencarian; prodi di luar daftar tetap diterima | ✅ |
| F-03 | Dua titik mulai: "belum punya topik" / "sudah punya" | Wizard bercabang sesuai pilihan | ✅ |
| F-04 | Pilih template pedoman kampus | Template dibaca dari data, bukan kode | 🟡 satu template generik |

### 5.2 Pencari topik

| ID | Kebutuhan | Kriteria penerimaan | Status |
|---|---|---|---|
| F-05 | Usulkan ≥3 topik dari jurusan, minat, dan akses data | Tiap usulan memuat judul spesifik, rumusan masalah, metode | ✅ |
| F-06 | Tanyakan ketersediaan data **sebelum** mengusulkan topik | Pertanyaan akses data wajib dijawab sebelum lanjut | ✅ |
| F-07 | Label kelayakan tiap topik | Tingkat kesulitan, data yang dibutuhkan, jumlah pustaka | ✅ |
| F-08 | Jumlah pustaka berasal dari pencarian nyata | Angka diambil dari hasil Crossref/OpenAlex, bukan klaim model | ✅ |
| F-09 | Cek kelayakan judul (terlalu luas/sempit/jenuh) | Penilaian disertai alasan dan saran perbaikan | 🟡 lewat asisten, belum alat khusus |

### 5.3 Penyusunan draft

| ID | Kebutuhan | Kriteria penerimaan | Status |
|---|---|---|---|
| F-10 | Susun BAB I–V lengkap dengan subbab wajib template | Semua bab template ada; subbab mengikuti pedoman | ✅ |
| F-11 | Progres agent terlihat saat penyusunan | Event per langkah tersimpan & bisa dibaca | ✅ |
| F-12 | Revisi per bab lewat prompt | Hanya bab yang disebut ditulis ulang | ✅ |
| F-13 | Revisi mereset status review bab tersebut | `reviewed_by_student` kembali false, ekspor terkunci lagi | ✅ |
| F-14 | Naskah panjang & padat (bukan kerangka kosong) | Tiap bab memenuhi ≥60% target kata template | 🟡 bergantung keluaran model; QA memberi peringatan |

### 5.4 Referensi & verifikasi

| ID | Kebutuhan | Kriteria penerimaan | Status |
|---|---|---|---|
| F-15 | Cari literatur nyata sebelum menulis | Kandidat berasal dari Crossref/OpenAlex | ✅ |
| F-16 | Verifikasi tiap referensi ke indeks | DOI tidak resolve → ditolak tanpa jalur penyelamatan | ✅ |
| F-17 | Referensi tak lolos dibuang **dan** dilaporkan | Daftar penolakan + alasan tampil ke mahasiswa | ✅ |
| F-18 | Sitasi & daftar pustaka sesuai gaya | APA 7 dan IEEE, urutan sesuai aturan masing-masing | ✅ |
| F-19 | Kunci sitasi tak dikenal = temuan blocker | Ekspor tertahan sampai diperbaiki | ✅ |
| F-20 | Cakupan jurnal nasional Indonesia | Referensi Garuda/Sinta tidak ditolak sebagai fiktif | ⬜ **prioritas berikutnya** |

### 5.5 Asisten AI

| ID | Kebutuhan | Kriteria penerimaan | Status |
|---|---|---|---|
| F-21 | Asisten menjawab berdasarkan isi draft nyata | Konteks memuat bab, status review, temuan QA, referensi | ✅ |
| F-22 | Asisten dapat diakses dari mana saja | Tombol mengambang di tiap layar + dari halaman bab | ✅ |
| F-23 | Jawaban membawa tindakan lanjutan | Tombol membuka bab/layar/alat yang relevan | ✅ |
| F-24 | Tindakan yang menunjuk sasaran tak ada dibuang | Action divalidasi terhadap dokumen sebelum ditampilkan | ✅ |
| F-25 | Percakapan tersimpan & masuk jejak AI | Riwayat bisa dibuka ulang; ikut di log transparansi | ✅ |
| F-26 | Asisten menolak permintaan yang melanggar integritas | Mis. diminta menyembunyikan keterlibatan AI → ditolak | ✅ lewat system prompt |

### 5.6 Gerbang integritas & ekspor

| ID | Kebutuhan | Kriteria penerimaan | Status |
|---|---|---|---|
| F-27 | Ekspor ditolak bila ada bab belum direview | HTTP 409 + daftar bab yang menahan | ✅ |
| F-28 | Ekspor ditolak bila ada temuan blocker | 409 + daftar temuan | ✅ |
| F-29 | Catatan penggunaan AI tercetak di dokumen | Selalu ada di berkas ekspor | ✅ |
| F-30 | Log transparansi bisa ditunjukkan ke pembimbing | Prompt awal, revisi, pertanyaan asisten, referensi ditolak | ✅ |
| F-31 | Ekspor DOCX/PDF sesuai margin & font template | Berkas terbuka rapi di Word | ⬜ |
| F-32 | Cek kemiripan sebelum ekspor | Skor kemiripan di bawah ambang | ⬜ *placeholder jujur: mengembalikan "belum dijalankan"* |

### 5.7 Tahapan & pendampingan

| ID | Kebutuhan | Kriteria penerimaan | Status |
|---|---|---|---|
| F-33 | Peta 7 tahap dengan status | Tepat satu tahap berstatus "sekarang" | ✅ |
| F-34 | Status tahap diturunkan dari draft | Bab belum ditulis tak bisa membuat tahap tampak selesai | ✅ |
| F-35 | Tahap tak terpantau ditandai manual | Seminar & sidang hanya berubah lewat aksi mahasiswa | ✅ |
| F-36 | Bahan bimbingan & latihan sidang | Ringkasan progres, pertanyaan pembimbing/penguji | 🟡 lewat asisten |
| F-37 | Peran dosen pembimbing (lihat & komentari) | Dosen login, komentar per bab | ⬜ |

## 6. Aturan integritas akademik (mengikat)

Aturan berikut bukan preferensi desain — melanggarnya mengubah produk menjadi layanan
yang dilarang.

| ID | Aturan |
|---|---|
| I-1 | AI tidak pernah mengisi data primer. Bagian yang membutuhkannya ditandai `[BUTUH DATA]` dan menjadi temuan blocker. |
| I-2 | Metadata referensi hanya dari indeks pihak ketiga; keluaran model tentang referensi tidak pernah dipercaya. |
| I-3 | Ekspor final terkunci sampai mahasiswa menandai tiap bab sudah direview. |
| I-4 | Setiap ekspor memuat catatan penggunaan AI; tidak ada mode "sembunyikan". |
| I-5 | Jejak prompt & percakapan asisten tersimpan dan dapat ditunjukkan ke pembimbing. |
| I-6 | Tidak ada klaim "bebas plagiarisme" selama cek kemiripan belum berjalan. |
| I-7 | Pemasaran produk tidak boleh memakai posisi "joki", "skripsi instan", atau sejenisnya. |

## 7. Kebutuhan non-fungsional

| ID | Kebutuhan | Target |
|---|---|---|
| N-1 | Waktu penyusunan draft lengkap | ≤10 menit; progres terlihat selama proses |
| N-2 | Biaya model per draft | Diukur dan dilaporkan sebelum peluncuran berbayar |
| N-3 | Respons asisten | ≤15 detik untuk pertanyaan biasa |
| N-4 | Ketahanan proses panjang | Generate tidak hilang saat proses restart (butuh queue) — ⬜ |
| N-5 | Privasi | Draft privat per pengguna; tidak dipakai melatih model |
| N-6 | Bahasa | Antarmuka & keluaran bahasa Indonesia baku |
| N-7 | Perangkat | Mobile-first; berjalan baik pada layar 360px |
| N-8 | Aksesibilitas | Kontras memadai, fokus keyboard terlihat, animasi menghormati `prefers-reduced-motion` |
| N-9 | Keamanan | Autentikasi & otorisasi sebelum data nyata masuk — ⬜ |

## 8. Model data (ringkas)

```
Project ── ThesisDocument ── Chapter*        (naskah, status review, revisi)
   │             ├── Reference*              (terverifikasi, dari indeks)
   │             ├── VerificationResult*     (yang ditolak + alasan)
   │             └── QAReport                (temuan, skor kemiripan)
   ├── ProgressEvent*                        (langkah agent)
   ├── PromptLog*                            (prompt awal, revisi, asisten)
   ├── ChatMessage*                          (percakapan asisten)
   └── stage_overrides[]                     (tahap yang ditandai manual)
```

Tahapan **tidak disimpan** sebagai status; diturunkan dari dokumen + overrides.

## 9. Metrik keberhasilan

| Metrik | Target awal | Cara ukur |
|---|---|---|
| Mahasiswa buntu keluar dengan topik terpilih | ≥60% dari yang membuka pencari topik | Rasio wizard selesai |
| Draft lengkap tersusun | ≥90% percobaan tanpa kegagalan | Rasio status `done` |
| Referensi fiktif lolos ke ekspor | **0** | Audit sampel dokumen ekspor |
| Bab dibaca sebelum ekspor | 100% (dipaksa sistem) | Gerbang ekspor |
| Draft lolos review pembimbing tanpa revisi besar | ≥50% | Survei ke pengguna beta |
| Ketepatan penolakan referensi | ≥95% (false positive rendah) | Uji manual pada referensi jurnal nasional |

## 10. Lingkup rilis

**MVP (sekarang)** — F-01…F-19, F-21…F-30, F-33…F-35. Backend + frontend berjalan lokal;
data contoh dan uji otomatis tersedia.

**v1.1 (sebelum uji ke pengguna nyata)**
- F-20 integrasi Garuda/Sinta *(paling mendesak: referensi nyata jurnal nasional kini bisa ditolak sebagai fiktif)*
- N-9 autentikasi + peran mahasiswa/dosen
- N-4 queue produksi + progres streaming
- F-31 ekspor DOCX

**v1.2** — F-32 cek kemiripan, F-37 peran dosen penuh, template kampus asli pertama.

**v2** — dashboard prodi, integrasi SIAKAD, aplikasi mobile native, multi-jenjang (S2/S3).

**Di luar lingkup** — pengolahan data statistik, pembuatan kuesioner otomatis,
pencarian dosen pembimbing, penerbitan jurnal.

## 11. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Referensi nyata jurnal nasional ditolak (false positive) | Kepercayaan pengguna jatuh | Integrasi Garuda/Sinta (F-20) sebelum peluncuran |
| Kampus melarang penggunaan AI | Produk tidak terpakai | Jejak transparansi + mode kontrol prodi; posisikan sebagai alat berbantuan, bukan pengganti |
| Kualitas naskah tidak seragam antar-jurusan | Nilai produk timpang | Template per prodi + uji keluaran lintas jurusan sebelum rilis |
| Biaya model membengkak saat skala | Margin negatif | Ukur biaya per draft (N-2), caching riset, batas fair-use |
| Mahasiswa tetap submit tanpa membaca | Risiko akademik bagi pengguna | Gerbang ekspor + catatan AI; tidak bisa dihilangkan dari produk |

## 12. Pertanyaan terbuka (butuh keputusan pemilik produk)

1. **Model bisnis**: freemium per mahasiswa, atau lisensi kampus lebih dulu? Menentukan apakah autentikasi harus mendukung SSO kampus sejak awal.
2. **Kampus prioritas**: template pedoman kampus mana yang dipakai sebagai yang pertama? Dibutuhkan buku pedoman resminya.
3. **Penyedia cek kemiripan**: pakai API berbayar (mis. layanan komersial) atau bangun pembanding korpus sendiri?
4. **Batas gratis**: berapa draft/revisi per bulan sebelum berbayar? Bergantung pada hasil pengukuran biaya per draft.
5. **Posisi terhadap kampus**: apakah kita aktif menawarkan mode kontrol prodi (kampus bisa menetapkan aturan), atau menunggu permintaan?
