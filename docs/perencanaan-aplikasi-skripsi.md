# Perencanaan Aplikasi Bantu Skripsi/Tugas Akhir Mahasiswa

## 1. Ringkasan

**Nama kerja:** SkripsiKu (nama sementara, bisa diganti)

**Tujuan:** Membantu mahasiswa S1/D4 (dan bisa diperluas ke S2) menyusun skripsi/tugas akhir secara lebih terstruktur, lebih cepat, dan lebih rapi — mulai dari pencarian topik, penyusunan outline, penulisan bab per bab, sitasi, sampai revisi bersama dosen pembimbing.

**Masalah yang diselesaikan:**
- Mahasiswa sering stuck menentukan topik/judul dan kerangka penelitian.
- Proses bimbingan tidak terlacak rapi (revisi hilang, feedback dosen tercecer di WA/email).
- Manajemen referensi & sitasi manual, rawan salah format (APA/IEEE/Chicago/format kampus).
- Progres penulisan tidak terpantau → banyak yang telat sidang.
- Takut plagiarisme tapi tidak ada alat cek yang terjangkau.
- Format penulisan (margin, penomoran, daftar isi) sering revisi berkali-kali karena tidak sesuai pedoman kampus.

## 2. Target Pengguna

| Persona | Kebutuhan utama |
|---|---|
| Mahasiswa tingkat akhir | Panduan terstruktur, template, AI bantu nulis & parafrase, tracker progres |
| Dosen pembimbing | Melihat progres bimbingan, memberi komentar/revisi langsung di dokumen |
| Prodi/Kampus (opsional, B2B) | Standarisasi template, rekap progres mahasiswa bimbingan per dosen |

## 3. Fitur — MVP (Fase 1, ~3 bulan)

1. **Manajemen Proyek Skripsi**
   - Buat proyek: judul, jurusan, dosen pembimbing, target sidang.
   - Struktur bab standar (BAB I–V) yang bisa disesuaikan per template kampus.
2. **Outline & Mind Map Generator**
   - Bantu menyusun kerangka bab berdasarkan topik & rumusan masalah (AI-assisted).
3. **AI Writing Assistant**
   - Bantu mengembangkan paragraf dari poin-poin, parafrase, ringkas jurnal/artikel.
   - Deteksi kalimat tidak baku / saran perbaikan tata bahasa Indonesia & Inggris akademik.
4. **Manajemen Referensi & Sitasi**
   - Simpan referensi (import dari DOI/Google Scholar), auto-generate sitasi & daftar pustaka (APA 7, IEEE, dll).
5. **Progress Tracker**
   - Checklist per bab, target tanggal, riwayat revisi (versioning dokumen).
6. **Editor Dokumen**
   - Editor teks dasar dengan dukungan format akademik (heading, tabel, gambar, nomor halaman), export ke Word/PDF sesuai template kampus.
7. **Autentikasi & Peran**
   - Role mahasiswa & dosen pembimbing; dosen bisa komentar & approve per bab.

## 4. Fitur — Fase 2 (Pengembangan lanjutan)

- **Cek Kemiripan/Plagiarisme** (integrasi API pihak ketiga atau self-hosted).
- **Rekomendasi Literatur** — cari jurnal relevan (integrasi Semantic Scholar/Crossref/Google Scholar API) berdasarkan topik.
- **Kolaborasi real-time** ala Google Docs antara mahasiswa & dosen, dengan komentar inline.
- **Reminder & Jadwal Bimbingan** — kalender, notifikasi WA/email H-1 sebelum bimbingan.
- **Analisis Data Bantu** — bantu interpretasi hasil statistik sederhana (jika relevan dengan skripsi kuantitatif).
- **Template Multi-Kampus** — library template sesuai pedoman berbagai universitas.

## 5. Fitur — Fase 3 (Skalabilitas & B2B)

- Dashboard untuk Prodi: rekap progres seluruh mahasiswa bimbingan.
- Integrasi dengan sistem akademik kampus (SIAKAD) via API.
- Mode multi-bahasa & multi-jenjang (S1/S2/S3).
- Mobile app (iOS/Android) untuk baca & komentar cepat saat bimbingan.

## 6. Arsitektur Teknis (usulan)

- **Frontend:** Next.js (React) + TypeScript, editor berbasis rich-text (mis. TipTap/ProseMirror) untuk pengalaman menulis seperti Word/Google Docs.
- **Backend:** Node.js (NestJS) atau Python (FastAPI) — REST/GraphQL API.
- **Database:** PostgreSQL (data terstruktur) + object storage (S3-compatible) untuk file dokumen/referensi.
- **AI Layer:** LLM API (Claude) untuk writing assistant, ringkasan, & saran outline; embedding + vector DB untuk pencarian referensi semantik.
- **Autentikasi:** OAuth (Google/kampus SSO jika tersedia) + email/password.
- **Infrastruktur:** containerized (Docker), deploy ke cloud (mis. Railway/Fly.io/AWS) untuk mulai kecil dulu, scalable belakangan.

## 7. Alur Pengguna Utama (Happy Path)

1. Mahasiswa daftar → buat proyek skripsi → pilih template kampus.
2. Isi rumusan masalah & topik → AI bantu susun outline bab.
3. Menulis per bab di editor, AI membantu mengembangkan/parafrase, referensi otomatis tersitasi.
4. Submit bab ke dosen pembimbing → dosen beri komentar/revisi.
5. Mahasiswa revisi, progress tracker ter-update.
6. Setelah semua bab disetujui → export dokumen final sesuai format kampus untuk sidang.

## 8. Model Bisnis (opsional, untuk didiskusikan)

- **Freemium:** fitur dasar gratis (outline, editor, sitasi manual), fitur AI premium (parafrase tak terbatas, cek similarity) berlangganan bulanan per mahasiswa.
- **B2B Kampus:** lisensi tahunan untuk Prodi/Fakultas dengan dashboard monitoring dosen.

## 9. Roadmap Bertahap

| Fase | Durasi | Output |
|---|---|---|
| Riset & Desain | 2–3 minggu | Riset kebutuhan mahasiswa/dosen, wireframe, pemilihan template kampus prioritas |
| MVP Development | 8–10 minggu | Fitur di Fase 1 (manajemen proyek, editor, sitasi dasar, AI assistant dasar) |
| Beta Testing | 3–4 minggu | Uji coba dengan 20–50 mahasiswa & beberapa dosen, kumpulkan feedback |
| Iterasi & Fase 2 | Berkelanjutan | Plagiarism check, rekomendasi literatur, kolaborasi real-time |

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Akurasi AI kurang tepat untuk konteks akademik Indonesia | Fine-tune prompt dengan contoh skripsi nyata, beri disclaimer & opsi edit manual |
| Kekhawatiran plagiarisme/etika akademik (mahasiswa "curang" pakai AI) | Posisikan sebagai *assistant* (bukan generator otomatis), sertakan mode "cek similarity" untuk transparansi ke dosen |
| Privasi data skripsi (topik penelitian belum publish) | Enkripsi data, kebijakan privasi jelas, opsi dokumen private per default |
| Adopsi dosen pembimbing rendah (masih pakai cara manual) | Buat fitur dosen sesederhana mungkin (cukup lihat & komen, tanpa perlu setup rumit) |
| Ketergantungan API pihak ketiga (LLM, plagiarism checker) mahal saat scale | Rancang caching & batas pemakaian fair-use di tier gratis |

## 11. Metrik Keberhasilan (KPI)

- Jumlah mahasiswa aktif menyelesaikan minimal 1 bab lewat aplikasi.
- Rata-rata waktu penyelesaian skripsi (dibandingkan baseline sebelum pakai app).
- Tingkat retensi mingguan/bulanan.
- Skor kepuasan dosen pembimbing terhadap fitur kolaborasi.

## 12. Langkah Selanjutnya

1. Validasi masalah & fitur prioritas lewat wawancara singkat ke 5–10 mahasiswa tingkat akhir.
2. Tentukan template kampus mana yang jadi prioritas MVP (mulai dari 1 kampus/format dulu).
3. Buat wireframe/prototype fitur inti (proyek → outline → editor → sitasi).
4. Setup repo & arsitektur teknis awal (frontend, backend, database).
5. Bangun MVP sesuai Fase 1 di atas.
