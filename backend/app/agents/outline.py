"""Outline Agent — menyusun kerangka BAB I–V dari prompt + literatur."""

from __future__ import annotations

from ..schemas import Outline, Reference, ThesisRequest
from ..templates import TemplateConfig
from .base import ClaudeAgent


class OutlineAgent(ClaudeAgent):
    name = "outline"
    system_prompt = (
        "Anda adalah dosen pembimbing yang menyusun kerangka skripsi. "
        "Kerangka harus mengikuti pedoman penulisan yang diberikan, logis, "
        "dan spesifik terhadap topik — bukan template generik."
    )

    def run(
        self,
        request: ThesisRequest,
        references: list[Reference],
        template: TemplateConfig,
    ) -> Outline:
        self.report("Menyusun kerangka bab...")

        literature = "\n".join(
            f"- [{ref.key}] {ref.title} ({ref.year or 'n.d.'})" for ref in references[:25]
        ) or "- (belum ada literatur yang lolos verifikasi)"

        structure = "\n".join(
            f"- {chapter.key} (BAB {chapter.number}): {chapter.title}; "
            f"subbab wajib: {', '.join(chapter.required_sections) or 'bebas'}"
            for chapter in template.chapters
        )

        prompt = (
            f"Prompt mahasiswa: {request.prompt}\n"
            f"Bidang studi: {request.field_of_study or 'tidak disebutkan'}\n"
            f"Jenis penelitian: {request.research_type.value}\n"
            f"Bahasa: {request.language}\n\n"
            f"Struktur bab wajib menurut pedoman kampus ({template.name}):\n"
            f"{structure}\n\n"
            f"Literatur yang tersedia:\n{literature}\n\n"
            "Susun: judul kerja, rumusan masalah, tujuan penelitian, dan kerangka "
            "tiap bab beserta subbab dan poin yang harus dibahas. Gunakan kunci bab "
            "persis seperti yang tertulis di struktur wajib di atas (mis. 'bab1'), "
            "dan penomoran subbab bergaya '1.1', '1.2', dst."
        )
        outline = self.parse(prompt, Outline)
        return self._normalize(outline, template)

    @staticmethod
    def _normalize(outline: Outline, template: TemplateConfig) -> Outline:
        """Pastikan kunci & nomor bab konsisten dengan template, apa pun keluaran model."""
        expected = {chapter.key: chapter for chapter in template.chapters}
        normalized = []
        for position, chapter in enumerate(outline.chapters):
            key = chapter.key.strip().lower().replace(" ", "")
            if key not in expected and position < len(template.chapters):
                key = template.chapters[position].key
            chapter = chapter.model_copy(
                update={
                    "key": key,
                    "number": expected[key].number if key in expected else position + 1,
                }
            )
            normalized.append(chapter)
        return outline.model_copy(update={"chapters": normalized})
