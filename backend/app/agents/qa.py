"""QA Agent — pemeriksaan mutu & integritas sebelum draft diserahkan.

Dua lapis:

1. **Deterministik** (tidak bisa dinegosiasi model): kunci sitasi tak dikenal,
   bab hilang, naskah terlalu pendek, penanda [BUTUH DATA] yang belum diisi,
   skor kemiripan di atas ambang.
2. **LLM**: konsistensi antar bab, istilah yang berubah-ubah, rumusan masalah
   yang tidak terjawab di kesimpulan.
"""

from __future__ import annotations

from typing import Optional, Protocol

from pydantic import BaseModel, Field

from ..config import Settings
from ..schemas import Chapter, Outline, QAIssue, QAReport, Reference
from ..templates import TemplateConfig
from .base import ClaudeAgent
from .citation import CitationAgent


class SimilarityChecker(Protocol):
    """Kontrak layanan cek kemiripan (Turnitin/API pihak ketiga/self-hosted)."""

    def score(self, text: str) -> Optional[float]: ...


class NullSimilarityChecker:
    """Default: belum ada penyedia yang dikonfigurasi.

    Mengembalikan None (bukan 0.0) supaya tidak ada yang salah menyimpulkan
    "aman" hanya karena pemeriksaan belum pernah berjalan.
    """

    def score(self, text: str) -> Optional[float]:  # noqa: ARG002
        return None


class ConsistencyFindings(BaseModel):
    issues: list[QAIssue] = Field(default_factory=list)


class QAAgent(ClaudeAgent):
    name = "qa"
    system_prompt = (
        "Anda adalah penguji skripsi yang teliti. Cari inkonsistensi antar bab: "
        "istilah yang berubah makna, rumusan masalah yang tidak dijawab, metode "
        "yang tidak sesuai dengan hasil, klaim tanpa dukungan sitasi. "
        "Gunakan severity 'blocker' hanya untuk masalah yang membuat draft tidak "
        "layak diserahkan ke dosen, 'warning' untuk yang perlu diperbaiki, "
        "'info' untuk saran."
    )

    def __init__(
        self,
        *args,
        similarity: Optional[SimilarityChecker] = None,
        **kwargs,
    ) -> None:
        super().__init__(*args, **kwargs)
        self._similarity = similarity or NullSimilarityChecker()

    # -- lapis 1: deterministik ------------------------------------------- #

    @staticmethod
    def structural_issues(
        chapters: list[Chapter],
        references: list[Reference],
        template: TemplateConfig,
    ) -> list[QAIssue]:
        issues: list[QAIssue] = []

        present = {chapter.key for chapter in chapters}
        for expected in template.chapters:
            if expected.key not in present:
                issues.append(
                    QAIssue(
                        severity="blocker",
                        chapter_key=expected.key,
                        message=f"BAB {expected.number} ({expected.title}) belum ada.",
                    )
                )

        for key in CitationAgent.unknown_keys(chapters, references):
            issues.append(
                QAIssue(
                    severity="blocker",
                    message=(
                        f"Kunci sitasi [@{key}] tidak ada di daftar referensi "
                        "terverifikasi — kemungkinan referensi fiktif."
                    ),
                )
            )

        for chapter in chapters:
            expected = template.chapter(chapter.key)
            word_count = len(chapter.body_markdown.split())
            if expected and word_count < expected.min_words * 0.6:
                issues.append(
                    QAIssue(
                        severity="warning",
                        chapter_key=chapter.key,
                        message=(
                            f"Naskah {chapter.key} hanya {word_count} kata, "
                            f"jauh di bawah target {expected.min_words} kata."
                        ),
                    )
                )
            if "[BUTUH DATA" in chapter.body_markdown:
                issues.append(
                    QAIssue(
                        severity="blocker",
                        chapter_key=chapter.key,
                        message=(
                            "Masih ada penanda [BUTUH DATA] — bagian ini menunggu "
                            "data primer dari mahasiswa, tidak boleh diisi AI."
                        ),
                    )
                )
            if not chapter.citation_keys and chapter.key in {"bab1", "bab2"}:
                issues.append(
                    QAIssue(
                        severity="warning",
                        chapter_key=chapter.key,
                        message="Bab ini tidak memuat satu pun sitasi.",
                    )
                )
        return issues

    # -- lapis 2: LLM ----------------------------------------------------- #

    def consistency_issues(self, outline: Outline, chapters: list[Chapter]) -> list[QAIssue]:
        self.report("Memeriksa konsistensi antar bab...")
        digest = "\n\n".join(
            f"### {chapter.key} — {chapter.title}\n{chapter.body_markdown[:4000]}"
            for chapter in chapters
        )
        prompt = (
            f"Judul: {outline.working_title}\n"
            f"Rumusan masalah: {'; '.join(outline.problem_statement)}\n"
            f"Tujuan: {'; '.join(outline.objectives)}\n\n"
            f"Naskah (dipotong per bab):\n{digest}\n\n"
            "Laporkan inkonsistensi yang Anda temukan."
        )
        try:
            return self.parse(prompt, ConsistencyFindings).issues
        except Exception as exc:  # noqa: BLE001 - QA tidak boleh menjatuhkan pipeline
            self.report(f"Pemeriksaan konsistensi gagal, dilewati: {exc}")
            return [
                QAIssue(
                    severity="info",
                    message="Pemeriksaan konsistensi otomatis tidak berjalan.",
                )
            ]

    # -- gabungan --------------------------------------------------------- #

    def run(
        self,
        outline: Outline,
        chapters: list[Chapter],
        references: list[Reference],
        template: TemplateConfig,
        settings: Settings,
    ) -> QAReport:
        issues = self.structural_issues(chapters, references, template)
        issues.extend(self.consistency_issues(outline, chapters))

        full_text = "\n\n".join(chapter.body_markdown for chapter in chapters)
        score = self._similarity.score(full_text)
        if score is not None and score > settings.similarity_score_max:
            issues.append(
                QAIssue(
                    severity="blocker",
                    message=(
                        f"Skor kemiripan {score:.0%} melebihi ambang "
                        f"{settings.similarity_score_max:.0%}."
                    ),
                )
            )
        elif score is None:
            issues.append(
                QAIssue(
                    severity="warning",
                    message=(
                        "Cek kemiripan belum dijalankan (penyedia belum dikonfigurasi) — "
                        "draft belum bisa diklaim bebas kemiripan."
                    ),
                )
            )

        self.report(f"QA selesai: {len(issues)} temuan.")
        return QAReport(issues=issues, similarity_score=score)
