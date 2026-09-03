# Perencanaan Aplikasi Agentic AI Penyusun Skripsi/Tugas Akhir

## 1. Ringkasan

**Nama kerja:** SkripsiKu (nama sementara, bisa diganti)

**Konsep inti:** Mahasiswa cukup memberi **satu prompt** (topik, jurusan, rumusan masalah singkat, atau bahkan sekadar ide kasar) melalui aplikasi. Sebuah **AI agent** kemudian secara otomatis mengerjakan pipeline penyusunan skripsi — riset literatur, susun kerangka, tulis tiap bab, sitasi, sampai format akhir — dan menghasilkan **draft skripsi lengkap** yang siap direview mahasiswa.

Aplikasi ini bukan sekadar "asisten nulis", tapi **agen otomatis end-to-end**: mahasiswa mengarahkan lewat prompt (di awal & saat revisi), agent yang mengeksekusi seluruh proses penelitian-tulisan.

## 2. Target Pengguna

| Persona | Kebutuhan utama |
|---|---|
| Mahasiswa tingkat akhir | Draft skripsi cepat dari prompt, bisa diarahkan ulang/direvisi lewat prompt lanjutan |
| Dosen pembimbing | Melihat draft hasil agent, memberi komentar/revisi, riwayat perubahan jelas |
| Prodi/Kampus (opsional, B2B) | Kontrol kebijakan penggunaan AI, standarisasi template, audit trail penggunaan |

## 3. Alur Inti: Prompt → Draft Skripsi Otomatis

1. **Input prompt** — mahasiswa mengisi form/prompt: topik, bidang studi, rumusan masalah (opsional), jenis penelitian (kualitatif/kuantitatif/studi kasus/dsb), kampus & format sitasi yang dipakai.
2. **Agent Orchestrator** memecah proses jadi rangkaian sub-agent (lihat Bab 4) yang berjalan otomatis secara berurutan/paralel.
3. Progres tiap tahap ditampilkan real-time ke mahasiswa (mis. "Mencari referensi... Menyusun BAB I... Menulis BAB II...").
4. **Output:** draft skripsi lengkap (BAB I–V + daftar pustaka) dalam editor yang bisa diedit, lengkap dengan sitasi & sumber yang dipakai agent.
5. Mahasiswa bisa memberi **prompt revisi** ("perbanyak studi kasus di BAB II", "ganti metode jadi kualitatif", "perbaiki BAB IV sesuai catatan dosen ini: ...") → agent regenerate bagian terkait, bukan seluruh dokumen.
6. Sebelum submit ke dosen/sidang, mahasiswa **wajib melalui tahap review** (lihat Bab 6) — aplikasi tidak mengizinkan ekspor final tanpa mahasiswa menandai tiap bab sudah dibaca/diverifikasi.

## 4. Arsitektur Multi-Agent (Detail Pipeline)

| Agent | Tugas |
|---|---|
| **Orchestrator Agent** | Menerima prompt, menyusun rencana kerja, mengatur urutan/paralelisasi sub-agent, menangani prompt revisi |
| **Research Agent** | Mencari & meringkas literatur relevan (Semantic Scholar/Crossref/Google Scholar API), memilih sumber kredibel & terbaru |
| **Outline Agent** | Menyusun kerangka BAB I–V (latar belakang, rumusan masalah, tinjauan pustaka, metodologi, dst) sesuai jenis penelitian & pedoman kampus |
| **Writing Agent** (per bab) | Menulis draf tiap bab berdasarkan outline + hasil riset, dengan gaya bahasa akademik |
| **Citation Agent** | Menyisipkan sitasi in-text & menyusun daftar pustaka otomatis sesuai gaya (APA/IEEE/Chicago), memverifikasi setiap sitasi merujuk sumber nyata (anti-halusinasi referensi) |
| **Consistency/QA Agent** | Cek koherensi antar bab, konsistensi istilah, kelengkapan struktur, dan menjalankan **similarity/plagiarism check** |
| **Formatting Agent** | Menata dokumen sesuai template kampus (margin, penomoran, cover, daftar isi otomatis), export ke Word/PDF |

Pipeline ini didesain agar tiap sub-agent bisa **dipanggil ulang secara terisolasi** saat mahasiswa merevisi satu bagian — tidak perlu re-generate seluruh dokumen.

## 5. Fitur Pendukung (di sekitar mesin agent)

1. **Manajemen Proyek** — riwayat versi tiap generate/revisi, bisa rollback ke draft sebelumnya.
2. **Editor Dokumen** — hasil agent muncul di editor rich-text yang bisa diedit manual langsung oleh mahasiswa.
3. **Panel Sumber/Referensi** — semua referensi yang dipakai agent ditampilkan transparan, mahasiswa bisa cek/ganti sumber.
4. **Similarity/Plagiarism Report** — skor kemiripan otomatis tiap kali draft digenerate/direvisi, ditampilkan ke mahasiswa (dan opsional ke dosen).
5. **Kolaborasi Dosen** — dosen bisa lihat draft, comment per paragraf, dan riwayat prompt yang dipakai mahasiswa (transparansi penggunaan AI).
6. **Log Transparansi Penggunaan AI** — mencatat bagian mana yang di-generate agent vs. ditulis/diedit manual mahasiswa (penting untuk kejujuran akademik & kebijakan kampus terkait AI).

## 6. Guardrail Integritas Akademik (wajib, bukan opsional)

Karena aplikasi men-generate draf secara otomatis, ini adalah risiko terbesar yang harus didesain sejak awal:

- **Mode "draft berbantuan AI", bukan "submit otomatis"** — hasil generate selalu berstatus draft; mahasiswa harus menandai review selesai per bab sebelum bisa export final.
- **Anti-halusinasi sitasi** — Citation Agent wajib verifikasi tiap referensi benar-benar ada (cross-check ke DOI/API), tidak boleh mengarang sumber.
- **Watermark/metadata** — dokumen hasil ekspor menyertakan log "bagian ini dibuat dengan bantuan AI" agar mahasiswa & kampus punya transparansi (mencegah tuduhan plagiarisme mendadak saat sidang).
- **Disclaimer & edukasi** — saat onboarding, jelaskan ke mahasiswa bahwa hasil AI adalah starting point yang tetap perlu dipahami & dipertanggungjawabkan sendiri (karena akan diuji saat sidang).
- **Kontrol tingkat kampus (opsional)** — Prodi bisa set kebijakan (mis. wajib similarity score di bawah X%, wajib approval dosen per bab) sebelum mahasiswa bisa lanjut ke bab berikutnya.

## 7. Arsitektur Teknis (usulan)

- **Frontend:** Next.js (React) + TypeScript, editor rich-text (TipTap/ProseMirror) + panel progress agent real-time (streaming status).
- **Backend/Agent Layer:** Python (FastAPI) menjalankan agent orchestration (mis. pola multi-agent dengan LLM Claude sebagai reasoning engine tiap agent), job queue (mis. Redis/Celery atau task queue serupa) untuk proses generate yang berjalan async & bisa lama.
- **AI Layer:** LLM API (Claude) untuk tiap sub-agent; embedding + vector DB (mis. pgvector) untuk pencarian & pencocokan referensi semantik.
- **Database:** PostgreSQL — data proyek, versi draft, log prompt & sumber yang dipakai tiap generate.
- **Storage:** object storage (S3-compatible) untuk dokumen final & referensi (PDF jurnal, dsb).
- **Autentikasi:** OAuth (Google/kampus SSO) + email/password; role mahasiswa/dosen/admin prodi.
- **Infrastruktur:** containerized (Docker), deploy cloud (mulai kecil: Railway/Fly.io, scale ke AWS/GCP saat traffic naik).

## 8. Model Bisnis (opsional, untuk didiskusikan)

- **Freemium:** generate terbatas (mis. 1 draft lengkap gratis, revisi terbatas), berlangganan bulanan untuk generate/revisi tak terbatas + similarity check.
- **B2B Kampus:** lisensi tahunan per Prodi/Fakultas dengan dashboard kontrol kebijakan AI & monitoring dosen.

## 9. Roadmap Bertahap

| Fase | Durasi | Output |
|---|---|---|
| Riset & Desain | 2–3 minggu | Validasi kebutuhan, desain pipeline agent, pilih 1 template kampus prioritas |
| MVP: Single-shot Generator | 6–8 minggu | Prompt → outline → draft BAB I–V dasar (tanpa multi-agent kompleks dulu, 1 pipeline linear) + editor + export |
| MVP+: Multi-Agent Pipeline | 4–6 minggu | Pecah jadi Research/Outline/Writing/Citation/QA/Formatting Agent terpisah + revisi per-bagian |
| Guardrail & QA | 3–4 minggu | Anti-halusinasi sitasi, similarity check, watermark transparansi, log penggunaan AI |
| Beta Testing | 3–4 minggu | Uji coba 20–50 mahasiswa & beberapa dosen, evaluasi kualitas draft & risiko integritas |
| Iterasi Lanjutan | Berkelanjutan | Kolaborasi dosen real-time, dashboard prodi, multi-template kampus |

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| **Integritas akademik** — draft "terlalu otomatis" dianggap kecurangan oleh kampus/dosen | Positioning jelas sebagai "AI-assisted draft", wajib review manusia, watermark transparansi (Bab 6) |
| **Halusinasi sitasi** — LLM mengarang referensi yang tidak ada | Citation Agent wajib verifikasi via API sumber asli sebelum dimasukkan ke draft |
| **Kualitas/relevansi draft rendah** untuk konteks riset spesifik | Beri opsi mahasiswa upload data/sumber sendiri sebagai konteks tambahan agent |
| **Similarity/plagiarism tinggi** karena draft antar mahasiswa mirip (topik sejenis) | QA Agent jalankan similarity check tiap generate, beri peringatan sebelum export |
| **Ketergantungan API pihak ketiga (LLM, literature API) mahal saat scale** | Rancang caching hasil riset, batasi jumlah generate di tier gratis |
| **Resistensi kampus/dosen terhadap tools generate-otomatis** | Sediakan mode "kontrol kampus" (Bab 6) agar Prodi bisa atur batasan penggunaan resmi |

## 11. Metrik Keberhasilan (KPI)

- Jumlah mahasiswa yang berhasil generate draft lengkap dari 1 prompt.
- Rata-rata jumlah revisi/prompt lanjutan sampai draft dianggap siap direview dosen.
- Similarity score rata-rata draft yang dihasilkan (target: di bawah ambang batas kampus).
- Tingkat kelulusan review dosen tanpa revisi besar (indikator kualitas draft awal).

## 12. Langkah Selanjutnya

1. Validasi ke 5–10 mahasiswa: apakah mereka nyaman submit ke dosen draft yang di-generate otomatis (cek sentimen soal integritas akademik).
2. Bangun **prototype single-shot** dulu: prompt → 1 pipeline linear (bukan multi-agent penuh) yang menghasilkan outline + BAB I sebagai proof of concept.
3. Uji kualitas Citation Agent (anti-halusinasi) sebagai prioritas teknis #1 sebelum fitur lain — ini risiko kredibilitas terbesar.
4. Setelah proof of concept jalan, pecah jadi arsitektur multi-agent penuh (Bab 4) dan tambah guardrail (Bab 6).
5. Setup repo & skeleton teknis (frontend, backend/agent layer, database).
