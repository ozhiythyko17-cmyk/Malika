# Spesifikasi Citation Agent (anti-halusinasi sitasi)

Status: **implementasi awal sudah ada** — `backend/app/citation/` +
`backend/app/agents/citation.py`, diuji di `backend/tests/test_citation_verifier.py`.

## 1. Mengapa ini prioritas teknis #1

Kalau draft memuat referensi yang tidak ada, mahasiswa ketahuan di sidang dan
produk kehilangan kredibilitas sekaligus. Semua fitur lain (kecepatan generate,
kualitas bahasa, template kampus) tidak menyelamatkan produk dari kegagalan ini.
LLM bisa mengarang judul, penulis, tahun, dan DOI yang terlihat sangat masuk akal
— jadi asumsi dasarnya: **keluaran LLM tentang referensi tidak pernah dipercaya.**

## 2. Prinsip desain

1. **Metadata referensi tidak pernah berasal dari LLM.** LLM hanya merumuskan
   query pencarian dan menilai relevansi. Judul/penulis/tahun/DOI selalu diambil
   dari indeks (Crossref, fallback OpenAlex).
2. **Verifikasi deterministik.** Tidak ada keputusan lolos/tidak yang diserahkan
   ke model. Semua keputusan lewat fungsi murni yang bisa diuji.
3. **Gagal secara terbuka, bukan diam-diam.** Referensi yang tidak lolos
   dikeluarkan dari draft *dan* dilaporkan ke mahasiswa beserta alasannya.
4. **Tidak boleh ada jalur pintas.** Kunci sitasi yang muncul di naskah tapi
   tidak ada di daftar terverifikasi = temuan **blocker** yang memblokir ekspor.

## 3. Alur

```
Research Agent                     Citation Agent                     Writing Agent
──────────────                     ──────────────                     ─────────────
query (LLM)                        
   ↓                               
Crossref/OpenAlex  ──kandidat──▶   verify_references()
   ↓                                  ├─ VERIFIED  ──▶ daftar referensi ──▶ boleh disitasi
saring relevansi (LLM)                ├─ MISMATCH  ──▶ dibuang + dilaporkan
                                      └─ NOT_FOUND ──▶ dibuang + dilaporkan
                                                                            ↓
                                   render_intext()  ◀──── naskah dengan [@kunci]
                                      ↓
                                   sitasi APA/IEEE + daftar pustaka
```

## 4. Aturan keputusan

Urutan resolusi untuk satu referensi yang diklaim:

| Langkah | Kondisi | Hasil |
|---|---|---|
| 1 | DOI diklaim, **tidak** resolve di indeks | `NOT_FOUND` — **berhenti**, tidak boleh diselamatkan lewat pencarian judul |
| 2 | DOI diklaim dan resolve | lanjut ke pencocokan metadata |
| 3 | Tidak ada DOI | cari berdasarkan judul (+ nama penulis pertama) |
| 4 | Tidak ada kandidat sama sekali | `NOT_FOUND` |
| 5 | Kemiripan judul < `title_match_threshold` (default 0.82) | `MISMATCH` |
| 6 | Kecocokan nama keluarga penulis < `author_match_threshold` (default 0.34) | `MISMATCH` |
| 7 | Selisih tahun > 1 | `MISMATCH` |
| 8 | Lolos semua | `VERIFIED`, metadata dipakai **versi indeks** |

Catatan rancangan:

- **DOI palsu tidak boleh punya jalur penyelamatan.** Ini kasus halusinasi yang
  paling sering dan paling berbahaya (formatnya terlihat sah). Kalau kita
  bolehkan fallback ke pencarian judul, DOI karangan akan lolos selama judulnya
  mirip sesuatu yang nyata.
- **Toleransi tahun ±1** untuk beda tahun preprint vs terbit resmi.
- **Ambang penulis rendah (0.34)** karena nama penulis Indonesia sering
  tercatat tidak konsisten di indeks (nama tunggal, urutan berbeda,
  singkatan). Yang ditolak adalah kasus "judul sama, penulis sama sekali lain".
- **Klaim tanpa penulis diperlakukan longgar** (skor 1.0) — tidak ada yang bisa
  dibantah; keputusan ditanggung pencocokan judul dan DOI.

## 5. Normalisasi judul

`normalize_title()`: hapus diakritik (NFKD), lowercase, hapus tanda baca,
rapikan spasi. Kemiripan dihitung dengan `difflib.SequenceMatcher` (stdlib,
deterministik, tanpa dependensi eksternal).

Alasan pakai rasio karakter, bukan token: judul skripsi/jurnal Indonesia sering
punya subtitel setelah tanda titik dua yang hilang atau muncul sebagian.

## 6. Kontrak sumber literatur

```python
class LiteratureIndex(Protocol):
    def lookup_doi(self, doi: str) -> Optional[Reference]: ...
    def search_title(self, title: str, author: Optional[str]) -> Optional[Reference]: ...
```

Implementasi saat ini: `CrossrefIndex` (utama), `OpenAlexIndex` (fallback),
digabung oleh `ChainedIndex`. Karena verifier hanya bergantung pada protocol ini,
menambah sumber baru (mis. Garuda/Sinta untuk jurnal nasional, Scopus) tidak
mengubah logika keputusan.

**Prioritas integrasi berikutnya:** indeks jurnal nasional (Garuda) — banyak
referensi skripsi Indonesia tidak ada di Crossref, sehingga saat ini akan
ditolak sebagai `NOT_FOUND` walaupun nyata. Ini false-positive yang harus
ditekan sebelum peluncuran.

## 7. Perilaku yang wajib dipertahankan

Diuji di `backend/tests/test_citation_verifier.py`:

- DOI fiktif → `NOT_FOUND`, dan **tanpa** panggilan pencarian judul.
- Judul berbeda → `MISMATCH` (bukan lolos).
- Penulis berbeda pada judul sama → `MISMATCH`.
- Selisih tahun > 1 → `MISMATCH`; ±1 → lolos.
- Metadata pada draft = metadata indeks, bukan metadata klaim.
- `accepted()` hanya memuat status `VERIFIED`.

## 8. Yang belum dikerjakan

- Integrasi Garuda/Sinta (lihat §6).
- Cache hasil verifikasi per DOI (hemat kuota + latensi; Crossref punya rate limit).
- Verifikasi **kutipan langsung**: memastikan kalimat yang dikutip benar-benar
  ada di sumber (butuh akses fulltext; hanya mungkin untuk sumber open access).
- Deteksi *retracted paper* (Crossref punya flag `update-to`; belum dibaca).
