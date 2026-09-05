# SkripsiKu — Agentic AI Penyusun Draft Skripsi

Mahasiswa memberi **satu prompt**; pipeline multi-agent menjalankan riset
literatur, menyusun kerangka, menulis BAB I–V, menyitasi, dan merakit dokumen
sesuai pedoman kampus. Keluarannya **draft berbantuan AI** yang wajib direview
mahasiswa per bab sebelum bisa diekspor.

> Repo ini sebelumnya berisi README untuk proyek lain ("Malika" — sales
> admin/CS agent). Proyek SkripsiKu berdiri sebagai kode baru di `backend/`,
> `frontend/`, dan `docs/`.

## Dokumen

| Dokumen | Isi |
|---|---|
| [docs/prd-skripsiku.md](docs/prd-skripsiku.md) | **PRD** — sasaran, persona, kebutuhan fungsional ber-ID + kriteria penerimaan, lingkup rilis |
| [docs/perencanaan-aplikasi-skripsi.md](docs/perencanaan-aplikasi-skripsi.md) | Rencana produk: konsep, pipeline agent, guardrail, roadmap, risiko |
| [docs/spec-citation-agent.md](docs/spec-citation-agent.md) | Spesifikasi anti-halusinasi sitasi (prioritas teknis #1) |
| [docs/spec-template-kampus.md](docs/spec-template-kampus.md) | Skema template pedoman kampus & cara menambah kampus baru |

## Arsitektur

```
frontend/ (Next.js)  ──HTTP──▶  backend/ (FastAPI)
                                   │
                                   ├─ agents/orchestrator.py   urutan & revisi terisolasi
                                   ├─ agents/research.py       query (LLM) + Crossref/OpenAlex
                                   ├─ agents/outline.py        kerangka BAB I–V (LLM, terstruktur)
                                   ├─ agents/writing.py        naskah per bab (LLM, streaming)
                                   ├─ agents/citation.py       verifikasi + sitasi (deterministik)
                                   ├─ agents/qa.py             konsistensi + integritas
                                   └─ agents/formatting.py     rakit dokumen per template
```

Prinsip yang menentukan bentuk kode ini:

- **Referensi tidak pernah berasal dari LLM.** Metadata diambil dari
  Crossref/OpenAlex; LLM hanya merumuskan query dan menilai relevansi.
- **Verifikasi sitasi deterministik.** Tidak ada keputusan lolos/tidak yang
  diserahkan ke model (`app/citation/verifier.py`).
- **Revisi terisolasi.** Prompt "perbaiki bab 2" hanya memanggil ulang bab itu,
  bukan seluruh dokumen.
- **Guardrail ditegakkan di kode, bukan cuma di dokumen.** `GET /export`
  menolak (409) selama ada bab yang belum direview mahasiswa atau masih ada
  temuan QA `blocker`; setiap revisi mereset status review bab tersebut.

## Menjalankan (dev)

Backend:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # isi ANTHROPIC_API_KEY
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                 # http://localhost:3000
```

Docker (API + PostgreSQL):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
docker compose up --build
```

## Pengujian

```bash
cd backend && python -m pytest      # 63 test, tanpa memanggil API Claude/Crossref
cd frontend && npm run typecheck
```

Test suite menutup tiga hal yang paling mudah rusak diam-diam:

1. Format sitasi APA 7 & IEEE (`tests/test_citation_style.py`).
2. Gerbang anti-halusinasi sitasi (`tests/test_citation_verifier.py`) — termasuk
   memastikan DOI fiktif **tidak** punya jalur penyelamatan lewat pencarian judul.
3. Gerbang ekspor & transparansi AI (`tests/test_api_guardrail.py`).
4. Penurunan tahapan skripsi dari keadaan draft (`tests/test_stages.py`).
5. Pencari topik, asisten AI, dan penandaan tahap (`tests/test_assistant_topic_api.py`).

Pipeline agent yang memanggil Claude diuji lewat `FakePipeline`, jadi test tidak
memerlukan kredensial dan tidak mengeluarkan biaya.

## API

| Endpoint | Fungsi |
|---|---|
| `POST /api/projects` | Kirim prompt → draft disusun di background (202) |
| `GET /api/projects/{id}` | Status, progres, dan dokumen |
| `GET /api/projects/{id}/events` | Progres agent (SSE) |
| `POST /api/projects/{id}/revise` | Prompt revisi (bab tertentu atau ditebak dari teks) |
| `POST /api/projects/{id}/chapters/{key}/review` | Mahasiswa menandai satu bab sudah direview |
| `GET /api/majors` | Daftar jurusan lintas fakultas untuk pencari topik |
| `POST /api/topics/suggest` | Usulan topik + kelayakan (jumlah pustaka dari indeks nyata) |
| `GET /api/projects/{id}/stages` | Tahapan skripsi, diturunkan dari keadaan draft |
| `POST /api/projects/{id}/stages/{stage_id}` | Tandai tahap manual (seminar, sidang) |
| `POST /api/projects/{id}/assistant` | Tanya asisten AI tentang draft sendiri |
| `GET /api/projects/{id}/assistant` | Riwayat percakapan asisten |
| `GET /api/projects/{id}/ai-disclosure` | Log prompt + status review + referensi yang ditolak |
| `GET /api/projects/{id}/export` | Markdown final — **409** bila gerbang belum terlewati |
| `GET /api/templates` | Daftar template pedoman kampus |

## Batasan MVP (jujur, bukan roadmap pemasaran)

- **Job runner**: memakai `BackgroundTasks` FastAPI. Cukup untuk satu proses dev;
  produksi butuh queue nyata (Celery/RQ) agar generate panjang tidak hilang saat
  proses restart.
- **SSE** mengirim event yang sudah tersimpan lalu menutup koneksi; streaming
  berkelanjutan menunggu worker terpisah + pub/sub. Frontend sementara polling.
- **Ekspor** baru Markdown. DOCX/PDF sesuai margin/font template belum ada
  (metadata halaman sudah disiapkan `FormattingAgent.page_metadata()`).
- **Cek kemiripan/plagiarisme** belum terpasang: `NullSimilarityChecker`
  mengembalikan `None`, dan QA menandainya sebagai `warning` — sengaja, supaya
  tidak ada yang menyimpulkan "aman" dari pemeriksaan yang belum pernah jalan.
- **Cakupan indeks**: banyak jurnal nasional Indonesia tidak ada di
  Crossref/OpenAlex, jadi referensi nyata bisa ditolak sebagai `not_found`.
  Integrasi Garuda/Sinta adalah pekerjaan berikutnya sebelum peluncuran.
- **Autentikasi & peran (mahasiswa/dosen) belum ada.** Semua endpoint terbuka;
  jangan dipakai dengan data nyata sebelum ini dikerjakan.

## Catatan integritas akademik

Produk ini diposisikan sebagai **alat percepatan riset & penulisan dengan draft
berbantuan AI**, bukan jasa pengerjaan skripsi. Implikasinya di kode:

- setiap ekspor menyertakan catatan penggunaan AI (`AI_DISCLOSURE`);
- `GET /ai-disclosure` membuka jejak prompt dan status review per bab agar bisa
  ditunjukkan ke dosen pembimbing;
- bagian yang memerlukan data primer ditandai `[BUTUH DATA: ...]` dan menjadi
  temuan `blocker` — AI tidak mengisi data lapangan yang tidak pernah diambil.

Di Indonesia, jual-beli karya ilmiah untuk memperoleh gelar diatur di UU No.
12/2012 tentang Pendidikan Tinggi (Pasal 90) dengan sanksi bagi penyedia maupun
pengguna jasa. Guardrail di atas bukan hiasan — itu yang membedakan produk ini
dari layanan yang melanggar ketentuan tersebut.
