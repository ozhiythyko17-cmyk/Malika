"""Assistant Agent — asisten yang menjawab pertanyaan mahasiswa soal draftnya sendiri.

Bedanya dengan chatbot umum: asisten ini selalu diberi **ringkasan keadaan draft
yang sebenarnya** (bab apa saja yang ada, mana yang sudah direview, temuan QA,
referensi yang lolos dan yang dibuang, tahap yang sedang berjalan), sehingga
jawabannya menunjuk isi dokumen, bukan menebak.

Batasan yang ditegakkan lewat system prompt:
- tidak mengarang referensi, angka hasil penelitian, atau temuan;
- bagian yang menunggu data primer diarahkan ke mahasiswa, bukan diisi;
- tidak menjanjikan draft bebas plagiarisme selama cek kemiripan belum berjalan.
"""

from __future__ import annotations

from typing import Optional

from ..schemas import (
    AssistantAction,
    AssistantReply,
    ChatMessage,
    Project,
    Stage,
    StageState,
    ThesisDocument,
)
from ..stages import NEED_DATA_MARKER
from .base import ClaudeAgent

MAX_HISTORY_TURNS = 6
CHAPTER_EXCERPT_CHARS = 600


def build_context(project: Project, stages: list[Stage]) -> str:
    """Ringkasan keadaan draft yang dikirim ke model sebagai konteks."""
    document: Optional[ThesisDocument] = project.document
    lines = [f"Prompt awal mahasiswa: {project.request.prompt}"]

    current = next((s for s in stages if s.state is StageState.CURRENT), None)
    done = [s.name for s in stages if s.state is StageState.DONE]
    lines.append(f"Tahap sekarang: {current.name if current else 'selesai semua'}")
    lines.append(f"Tahap yang sudah selesai: {', '.join(done) if done else 'belum ada'}")

    if document is None:
        lines.append("Draft belum tersusun.")
        return "\n".join(lines)

    lines.append(f"Judul kerja: {document.outline.working_title}")
    if document.outline.problem_statement:
        lines.append("Rumusan masalah: " + " | ".join(document.outline.problem_statement))

    lines.append("\nIsi draft per bab:")
    for chapter in sorted(document.chapters, key=lambda c: c.number):
        words = len(chapter.body_markdown.split())
        flags = []
        flags.append("sudah direview" if chapter.reviewed_by_student else "BELUM direview")
        if NEED_DATA_MARKER in chapter.body_markdown:
            flags.append("menunggu data primer mahasiswa")
        if chapter.revision > 1:
            flags.append(f"revisi ke-{chapter.revision}")
        lines.append(
            f"- BAB {chapter.number} ({chapter.key}) {chapter.title}: {words} kata, "
            f"{len(chapter.citation_keys)} sitasi, {', '.join(flags)}."
        )
        excerpt = chapter.body_markdown[:CHAPTER_EXCERPT_CHARS].replace("\n", " ")
        lines.append(f"  Cuplikan: {excerpt}…")

    lines.append("\nReferensi terverifikasi:")
    for ref in document.references:
        lines.append(f"- [@{ref.key}] {ref.title} ({ref.year or 'n.d.'})")

    if document.rejected_references:
        lines.append("\nReferensi yang DIBUANG sistem (jangan disebut sebagai sumber sah):")
        for rejected in document.rejected_references:
            lines.append(
                f"- {rejected.claimed.title} — {rejected.verdict.value}: {rejected.reason}"
            )

    if document.qa and document.qa.issues:
        lines.append("\nTemuan QA:")
        for issue in document.qa.issues:
            lines.append(f"- [{issue.severity}] {issue.message}")
        if document.qa.similarity_score is None:
            lines.append("- Cek kemiripan BELUM dijalankan (belum ada penyedia).")

    return "\n".join(lines)


class AssistantAgent(ClaudeAgent):
    name = "asisten"
    system_prompt = (
        "Anda asisten skripsi yang membaca draft mahasiswa dan menjawab dengan "
        "menunjuk isi draft itu, bukan memberi nasihat umum. Bahasa Indonesia, "
        "ringkas (maksimal 4 paragraf pendek), langsung ke poinnya, boleh memakai "
        "daftar bila memperjelas.\n\n"
        "Aturan yang tidak boleh dilanggar:\n"
        "1. Jangan mengarang referensi, nama peneliti, DOI, angka hasil penelitian, "
        "atau temuan. Hanya boleh menyebut referensi yang ada di konteks.\n"
        "2. Bagian bertanda [BUTUH DATA] adalah pekerjaan mahasiswa. Jangan tawarkan "
        "untuk mengisinya; bantu menyiapkan cara menyajikannya saja.\n"
        "3. Jangan menyatakan draft bebas plagiarisme bila cek kemiripan belum berjalan.\n"
        "4. Bila mahasiswa meminta sesuatu yang melanggar integritas akademik "
        "(mis. menyamarkan bahwa draft dibantu AI), tolak dengan jelas dan tawarkan "
        "jalan yang jujur.\n"
        "5. Bila informasi di konteks tidak cukup untuk menjawab, katakan apa yang "
        "kurang — jangan menebak.\n\n"
        "Sertakan satu tindakan lanjutan (`action`) bila ada yang jelas berguna: "
        "kind 'chapter' dengan target kunci bab (bab1..bab5), kind 'screen' dengan "
        "target 'draft'|'sumber'|'periksa'|'jejak', atau kind 'tool' dengan target "
        "'topik'|'judul'|'bimbingan'|'sidang'. Kosongkan bila tidak relevan."
    )

    def answer(
        self,
        question: str,
        project: Project,
        stages: list[Stage],
        history: Optional[list[ChatMessage]] = None,
    ) -> AssistantReply:
        self.report(f"Menjawab pertanyaan mahasiswa: {question[:60]}")

        parts = [
            "=== KEADAAN DRAFT MAHASISWA ===",
            build_context(project, stages),
        ]

        recent = (history or [])[-MAX_HISTORY_TURNS:]
        if recent:
            parts.append("\n=== PERCAKAPAN SEBELUMNYA ===")
            for message in recent:
                who = "Mahasiswa" if message.role == "user" else "Anda"
                parts.append(f"{who}: {message.text}")

        parts.append("\n=== PERTANYAAN SEKARANG ===")
        parts.append(question)

        reply = self.parse("\n".join(parts), AssistantReply)
        return self._sanitize(reply, project)

    @staticmethod
    def _sanitize(reply: AssistantReply, project: Project) -> AssistantReply:
        """Buang action yang menunjuk sasaran yang tidak ada di aplikasi."""
        action = reply.action
        if action is None:
            return reply

        valid_screens = {"draft", "sumber", "periksa", "jejak", "beranda"}
        valid_tools = {"topik", "judul", "bimbingan", "sidang", "referensi"}
        chapter_keys = {c.key for c in (project.document.chapters if project.document else [])}

        allowed = (
            (action.kind == "chapter" and action.target in chapter_keys)
            or (action.kind == "screen" and action.target in valid_screens)
            or (action.kind == "tool" and action.target in valid_tools)
        )
        return reply if allowed else AssistantReply(answer=reply.answer, action=None)


__all__ = ["AssistantAgent", "AssistantAction", "build_context"]
