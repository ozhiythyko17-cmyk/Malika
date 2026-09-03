"""Citation Agent — verifikasi referensi & rendering sitasi.

Ini komponen paling kritis untuk kredibilitas produk: kalau referensi fiktif
lolos ke draft, mahasiswa yang menanggung akibatnya di sidang. Karena itu
agent ini deterministik — tidak ada keputusan yang diserahkan ke LLM.

Spesifikasi lengkap: docs/spec-citation-agent.md
"""

from __future__ import annotations

from ..citation.style import format_bibliography, intext_citation
from ..citation.verifier import CitationVerifier
from ..schemas import (
    Chapter,
    CitationStyle,
    ClaimedReference,
    Reference,
    VerificationResult,
)
from .writing import CITATION_MARKER


class CitationAgent:
    """Tidak memanggil LLM — hanya verifikasi indeks + formatting deterministik."""

    name = "citation"

    def __init__(self, verifier: CitationVerifier, progress=None) -> None:
        self._verifier = verifier
        self._progress = progress

    def report(self, message: str) -> None:
        if self._progress is not None:
            self._progress(self.name, message)

    # -- verifikasi ------------------------------------------------------- #

    def verify_references(
        self, references: list[Reference]
    ) -> tuple[list[Reference], list[VerificationResult]]:
        """Re-verifikasi setiap referensi terhadap indeks; buang yang tidak lolos.

        Referensi hasil pencarian sudah berasal dari indeks, tetapi langkah ini
        tetap dijalankan agar referensi dari jalur lain (impor manual mahasiswa,
        hasil revisi) melewati gerbang yang sama.
        """
        self.report(f"Memverifikasi {len(references)} referensi ke Crossref/OpenAlex...")

        claims = [
            ClaimedReference(
                title=ref.title, authors=ref.authors, year=ref.year, doi=ref.doi
            )
            for ref in references
        ]
        results = self._verifier.verify_all(claims)

        accepted: list[Reference] = []
        for original, result in zip(references, results):
            if result.verdict.value == "verified" and result.resolved is not None:
                # Pertahankan kunci sitasi asli, pakai metadata dari indeks.
                accepted.append(result.resolved.model_copy(update={"key": original.key}))

        rejected = CitationVerifier.rejected(results)
        if rejected:
            self.report(
                f"{len(rejected)} referensi DIBUANG karena tidak terverifikasi."
            )
        else:
            self.report("Semua referensi terverifikasi.")
        return accepted, rejected

    # -- rendering -------------------------------------------------------- #

    @staticmethod
    def render_intext(
        chapters: list[Chapter], references: list[Reference], style: CitationStyle
    ) -> list[Chapter]:
        """Ganti penanda `[@kunci]` menjadi sitasi bergaya APA/IEEE.

        Nomor IEEE mengikuti urutan kemunculan pertama di seluruh dokumen.
        Kunci yang tidak dikenal DIBIARKAN apa adanya agar tertangkap QA Agent —
        jangan pernah menyembunyikannya.
        """
        by_key = {ref.key: ref for ref in references}
        order: dict[str, int] = {}
        for chapter in chapters:
            for key in chapter.citation_keys:
                if key in by_key and key not in order:
                    order[key] = len(order) + 1

        rendered: list[Chapter] = []
        for chapter in chapters:

            def replace(match) -> str:
                key = match.group(1)
                ref = by_key.get(key)
                if ref is None:
                    return match.group(0)
                return intext_citation(ref, style, index=order.get(key, 1))

            rendered.append(
                chapter.model_copy(
                    update={"body_markdown": CITATION_MARKER.sub(replace, chapter.body_markdown)}
                )
            )
        return rendered

    @staticmethod
    def bibliography(references: list[Reference], style: CitationStyle) -> list[str]:
        return format_bibliography(references, style)

    @staticmethod
    def used_references(
        chapters: list[Chapter], references: list[Reference]
    ) -> list[Reference]:
        """Daftar pustaka hanya memuat referensi yang benar-benar disitasi."""
        used_keys = {key for chapter in chapters for key in chapter.citation_keys}
        return [ref for ref in references if ref.key in used_keys]

    @staticmethod
    def unknown_keys(chapters: list[Chapter], references: list[Reference]) -> list[str]:
        known = {ref.key for ref in references}
        return sorted(
            {
                key
                for chapter in chapters
                for key in chapter.citation_keys
                if key not in known
            }
        )
