"""Writing Agent — menulis naskah satu bab.

Kontrak ketat: agent hanya boleh menyitasi dari daftar referensi terverifikasi
yang diberikan, memakai penanda `[@kunci]`. Penanda ini nanti diganti Citation
Agent menjadi sitasi bergaya APA/IEEE. Kunci di luar daftar akan tertangkap
sebagai blocker oleh QA Agent.
"""

from __future__ import annotations

import re

from ..citation.style import format_apa7
from ..schemas import Chapter, Outline, OutlineChapter, Reference, ThesisRequest
from ..templates import TemplateConfig, roman
from .base import ClaudeAgent

CITATION_MARKER = re.compile(r"\[@([A-Za-z0-9_-]+)\]")


def extract_citation_keys(markdown: str) -> list[str]:
    """Kunci sitasi yang benar-benar dipakai di naskah, urut kemunculan, unik."""
    seen: set[str] = set()
    keys: list[str] = []
    for match in CITATION_MARKER.finditer(markdown):
        key = match.group(1)
        if key not in seen:
            seen.add(key)
            keys.append(key)
    return keys


class WritingAgent(ClaudeAgent):
    name = "writing"
    system_prompt = (
        "Anda menulis naskah bab skripsi dalam bahasa akademik Indonesia yang "
        "baku, runtut, dan padat isi.\n\n"
        "Aturan yang tidak boleh dilanggar:\n"
        "1. Sitasi HANYA boleh memakai kunci dari daftar referensi yang diberikan, "
        "dengan format penanda [@kunci]. Jangan pernah membuat kunci baru.\n"
        "2. Jangan mengarang data, angka, hasil wawancara, atau temuan empiris. "
        "Bila bagian tersebut memerlukan data primer yang belum ada, tulis "
        "penanda [BUTUH DATA: penjelasan] agar mahasiswa mengisinya.\n"
        "3. Jangan menulis kalimat yang mengklaim penulis telah melakukan sesuatu "
        "yang belum terjadi (mis. 'peneliti telah menyebarkan kuesioner').\n"
        "4. Keluarkan Markdown: '## ' untuk subbab, tanpa mengulang judul bab."
    )

    def run(
        self,
        request: ThesisRequest,
        outline: Outline,
        outline_chapter: OutlineChapter,
        references: list[Reference],
        template: TemplateConfig,
    ) -> Chapter:
        template_chapter = template.chapter(outline_chapter.key)
        min_words = template_chapter.min_words if template_chapter else 800

        self.report(f"Menulis BAB {roman(outline_chapter.number)} — {outline_chapter.title}...")

        sections = "\n".join(
            f"- {section.number} {section.title}: {'; '.join(section.points) or 'kembangkan sesuai konteks'}"
            for section in outline_chapter.sections
        ) or "- (kembangkan subbab sesuai pedoman)"

        literature = "\n".join(
            f"- [@{ref.key}] {format_apa7(ref)}" for ref in references
        ) or "- (tidak ada referensi terverifikasi; tulis tanpa sitasi dan tandai [BUTUH REFERENSI])"

        prompt = (
            f"Prompt asli mahasiswa: {request.prompt}\n"
            f"Judul kerja: {outline.working_title}\n"
            f"Rumusan masalah: {'; '.join(outline.problem_statement)}\n"
            f"Jenis penelitian: {request.research_type.value}\n\n"
            f"Bab yang ditulis: BAB {roman(outline_chapter.number)} — {outline_chapter.title}\n"
            f"Subbab dan poin yang harus dibahas:\n{sections}\n\n"
            f"Referensi terverifikasi yang boleh disitasi:\n{literature}\n\n"
            f"Panjang minimal: sekitar {min_words} kata. Tulis naskahnya sekarang."
        )

        body = self.write(prompt)
        return Chapter(
            key=outline_chapter.key,
            number=outline_chapter.number,
            title=outline_chapter.title,
            body_markdown=body,
            citation_keys=extract_citation_keys(body),
        )

    def revise(
        self,
        chapter: Chapter,
        instruction: str,
        references: list[Reference],
    ) -> Chapter:
        """Regenerate satu bab berdasarkan prompt revisi, tanpa menyentuh bab lain."""
        self.report(f"Merevisi {chapter.key} sesuai arahan mahasiswa...")

        literature = "\n".join(f"- [@{ref.key}] {format_apa7(ref)}" for ref in references)
        prompt = (
            f"Berikut naskah bab yang sudah ada (BAB {chapter.number} — {chapter.title}):\n\n"
            f"{chapter.body_markdown}\n\n"
            f"--- \nArahan revisi dari mahasiswa: {instruction}\n\n"
            f"Referensi terverifikasi yang boleh disitasi:\n{literature}\n\n"
            "Tulis ulang bab ini secara utuh dengan arahan tersebut diterapkan. "
            "Pertahankan bagian yang tidak diminta berubah."
        )
        body = self.write(prompt)
        return chapter.model_copy(
            update={
                "body_markdown": body,
                "citation_keys": extract_citation_keys(body),
                "revision": chapter.revision + 1,
                # Revisi membatalkan status review — mahasiswa harus baca ulang.
                "reviewed_by_student": False,
            }
        )
