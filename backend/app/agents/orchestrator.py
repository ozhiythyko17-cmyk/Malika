"""Orchestrator — memecah satu prompt mahasiswa menjadi pipeline sub-agent.

Urutan: research -> verifikasi sitasi -> outline -> penulisan per bab ->
rendering sitasi -> QA. Formatting dijalankan saat ekspor.

Revisi memanggil ulang HANYA bagian yang diminta, sehingga prompt revisi
("perbaiki BAB II") tidak menghabiskan biaya regenerasi seluruh dokumen.
"""

from __future__ import annotations

from typing import Optional, Protocol

import anthropic

from ..citation.verifier import CitationVerifier
from ..config import Settings
from ..literature import ChainedIndex
from ..schemas import (
    CitationStyle,
    RevisionRequest,
    ThesisDocument,
    ThesisRequest,
)
from ..templates import TemplateConfig, load_template
from .base import ProgressHook
from .citation import CitationAgent
from .outline import OutlineAgent
from .qa import QAAgent, SimilarityChecker
from .research import ResearchAgent
from .writing import WritingAgent


class ThesisPipeline(Protocol):
    """Kontrak yang dipakai lapisan API (memudahkan pengujian tanpa API Claude)."""

    def generate(self, request: ThesisRequest, progress: ProgressHook) -> ThesisDocument: ...

    def revise(
        self,
        document: ThesisDocument,
        request: RevisionRequest,
        progress: ProgressHook,
    ) -> ThesisDocument: ...


class Orchestrator:
    """Implementasi pipeline sungguhan (memanggil Claude + indeks literatur)."""

    def __init__(
        self,
        client: anthropic.Anthropic,
        settings: Settings,
        index: ChainedIndex,
        similarity: Optional[SimilarityChecker] = None,
    ) -> None:
        self._client = client
        self._settings = settings
        self._index = index
        self._similarity = similarity

    # -- pembentukan sub-agent -------------------------------------------- #

    def _verifier(self) -> CitationVerifier:
        return CitationVerifier(
            self._index,
            title_threshold=self._settings.title_match_threshold,
            author_threshold=self._settings.author_match_threshold,
        )

    def _agents(self, progress: ProgressHook):
        research = ResearchAgent(
            self._client, self._settings, progress, index=self._index
        )
        outline = OutlineAgent(self._client, self._settings, progress)
        writing = WritingAgent(self._client, self._settings, progress)
        citation = CitationAgent(self._verifier(), progress)
        qa = QAAgent(
            self._client, self._settings, progress, similarity=self._similarity
        )
        return research, outline, writing, citation, qa

    # -- generate --------------------------------------------------------- #

    def generate(self, request: ThesisRequest, progress: ProgressHook) -> ThesisDocument:
        template: TemplateConfig = load_template(request.template_id)
        style = request.citation_style or CitationStyle(template.default_citation_style)
        research, outline_agent, writing, citation, qa = self._agents(progress)

        # 1. Literatur nyata dulu — penulisan tidak boleh mendahului riset.
        candidates = research.run(request)

        # 2. Gerbang verifikasi: hanya referensi yang resolve ke indeks yang lolos.
        references, rejected = citation.verify_references(candidates)

        # 3. Kerangka.
        outline = outline_agent.run(request, references, template)

        # 4. Naskah per bab.
        chapters = [
            writing.run(request, outline, outline_chapter, references, template)
            for outline_chapter in sorted(outline.chapters, key=lambda c: c.number)
        ]

        # 5. Sitasi dalam teks (deterministik).
        chapters = citation.render_intext(chapters, references, style)

        document = ThesisDocument(
            outline=outline,
            chapters=chapters,
            references=references,
            rejected_references=rejected,
            citation_style=style,
            template_id=template.id,
        )

        # 6. QA — termasuk deteksi kunci sitasi tak dikenal.
        document.qa = qa.run(outline, chapters, references, template, self._settings)
        progress("orchestrator", "Draft selesai. Menunggu review mahasiswa per bab.")
        return document

    # -- revise ----------------------------------------------------------- #

    def revise(
        self,
        document: ThesisDocument,
        request: RevisionRequest,
        progress: ProgressHook,
    ) -> ThesisDocument:
        template = load_template(document.template_id)
        _, _, writing, citation, qa = self._agents(progress)

        target_key = request.chapter_key or self._infer_target(document, request.prompt)
        chapter = document.chapter(target_key) if target_key else None
        if chapter is None:
            raise ValueError(
                f"Bab {target_key!r} tidak ada di dokumen. "
                f"Bab tersedia: {[c.key for c in document.chapters]}"
            )

        revised = writing.revise(chapter, request.prompt, document.references)
        chapters = [revised if c.key == revised.key else c for c in document.chapters]
        chapters = citation.render_intext(chapters, document.references, document.citation_style)

        updated = document.model_copy(update={"chapters": chapters})
        updated.qa = qa.run(
            document.outline, chapters, document.references, template, self._settings
        )
        progress("orchestrator", f"Revisi {revised.key} selesai (revisi ke-{revised.revision}).")
        return updated

    @staticmethod
    def _infer_target(document: ThesisDocument, prompt: str) -> Optional[str]:
        """Tebak bab sasaran dari teks prompt ('perbaiki bab 2' -> 'bab2')."""
        lowered = prompt.lower()
        for chapter in document.chapters:
            number = chapter.number
            aliases = (
                chapter.key,
                f"bab {number}",
                f"bab{number}",
                chapter.title.lower(),
            )
            if any(alias in lowered for alias in aliases):
                return chapter.key
        return None
