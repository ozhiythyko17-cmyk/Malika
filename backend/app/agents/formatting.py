"""Formatting Agent — merakit dokumen akhir sesuai pedoman kampus.

Deterministik (tanpa LLM). Keluaran: Markdown kanonik + metadata halaman
(margin/font/spasi) yang dipakai eksporter DOCX/PDF.

Spesifikasi template: docs/spec-template-kampus.md
"""

from __future__ import annotations

from ..citation.style import format_bibliography
from ..schemas import CitationStyle, ThesisDocument
from ..templates import TemplateConfig, roman

# Ditempelkan ke setiap ekspor. Guardrail transparansi: dosen/kampus bisa tahu
# bagian mana yang dibuat dengan bantuan AI tanpa harus menebak.
AI_DISCLOSURE = (
    "> **Catatan penggunaan AI.** Draft ini disusun dengan bantuan AI "
    "(agent penyusun draft) berdasarkan prompt penulis, lalu ditinjau dan "
    "disetujui penulis per bab. Referensi telah diverifikasi otomatis ke "
    "Crossref/OpenAlex. Penulis bertanggung jawab atas isi akhir."
)


class FormattingAgent:
    name = "formatting"

    def __init__(self, progress=None) -> None:
        self._progress = progress

    def report(self, message: str) -> None:
        if self._progress is not None:
            self._progress(self.name, message)

    def render_markdown(
        self, document: ThesisDocument, template: TemplateConfig
    ) -> str:
        self.report("Merakit dokumen sesuai pedoman kampus...")

        style = document.citation_style
        parts: list[str] = [
            f"# {document.outline.working_title}",
            "",
            AI_DISCLOSURE,
            "",
        ]

        if document.outline.problem_statement:
            parts += ["## Rumusan Masalah", ""]
            parts += [f"{i}. {item}" for i, item in enumerate(document.outline.problem_statement, 1)]
            parts.append("")

        parts += ["## Daftar Isi", ""]
        for chapter in sorted(document.chapters, key=lambda c: c.number):
            status = "sudah direview" if chapter.reviewed_by_student else "BELUM direview"
            parts.append(f"- BAB {roman(chapter.number)} — {chapter.title} ({status})")
        parts.append("")

        for chapter in sorted(document.chapters, key=lambda c: c.number):
            heading = template.chapter_heading_format.format(
                roman=roman(chapter.number), title=chapter.title
            )
            parts += [f"# {heading.replace(chr(10), ' — ')}", "", chapter.body_markdown, ""]

        used = [
            ref
            for ref in document.references
            if ref.key in {k for c in document.chapters for k in c.citation_keys}
        ]
        parts += [f"# {template.bibliography_heading}", ""]
        if used:
            entries = format_bibliography(used, style)
            parts += [f"{entry}  " for entry in entries]
        else:
            parts.append("_Belum ada referensi yang disitasi._")
        parts.append("")

        if document.rejected_references:
            parts += [
                "# Lampiran: Referensi yang Ditolak Sistem",
                "",
                "Referensi berikut disebut dalam proses penyusunan tetapi TIDAK "
                "lolos verifikasi ke Crossref/OpenAlex, sehingga dikeluarkan dari draft:",
                "",
            ]
            for rejected in document.rejected_references:
                parts.append(
                    f"- {rejected.claimed.title!r} "
                    f"({rejected.claimed.year or 'n.d.'}) — {rejected.verdict.value}: "
                    f"{rejected.reason}"
                )
            parts.append("")

        return "\n".join(parts)

    @staticmethod
    def page_metadata(template: TemplateConfig) -> dict:
        """Dipakai eksporter DOCX/PDF (langkah berikutnya, lihat README)."""
        page = template.page
        return {
            "paper": page.paper,
            "margins_cm": {
                "top": page.margin_top_cm,
                "bottom": page.margin_bottom_cm,
                "left": page.margin_left_cm,
                "right": page.margin_right_cm,
            },
            "font": {"family": page.font_family, "size_pt": page.font_size_pt},
            "line_spacing": page.line_spacing,
        }

    @staticmethod
    def bibliography_preview(document: ThesisDocument) -> list[str]:
        return format_bibliography(document.references, document.citation_style)


def default_style(template: TemplateConfig) -> CitationStyle:
    return CitationStyle(template.default_citation_style)
