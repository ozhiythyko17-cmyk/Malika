"""Model data yang dipakai lintas agent, API, dan penyimpanan."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ResearchType(str, Enum):
    KUANTITATIF = "kuantitatif"
    KUALITATIF = "kualitatif"
    STUDI_KASUS = "studi_kasus"
    PENGEMBANGAN = "pengembangan"  # R&D / rekayasa perangkat lunak
    LITERATUR = "literatur"


class CitationStyle(str, Enum):
    APA7 = "apa7"
    IEEE = "ieee"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class Verdict(str, Enum):
    """Hasil verifikasi satu referensi terhadap sumber otoritatif."""

    VERIFIED = "verified"
    MISMATCH = "mismatch"  # ada di indeks, tapi metadata tidak cocok
    NOT_FOUND = "not_found"  # tidak ditemukan sama sekali (indikasi halusinasi)


# --------------------------------------------------------------------------- #
# Input
# --------------------------------------------------------------------------- #


class ThesisRequest(BaseModel):
    """Satu prompt dari mahasiswa — satu-satunya input wajib adalah `prompt`."""

    prompt: str = Field(min_length=10, description="Topik/ide skripsi dalam bahasa bebas")
    field_of_study: Optional[str] = None
    research_type: ResearchType = ResearchType.KUALITATIF
    citation_style: CitationStyle = CitationStyle.APA7
    template_id: str = "generik-id"
    language: str = "id"


class RevisionRequest(BaseModel):
    """Prompt revisi; hanya bagian yang disebut yang di-regenerate."""

    prompt: str = Field(min_length=3)
    chapter_key: Optional[str] = Field(
        default=None,
        description="Kunci bab yang direvisi (mis. 'bab2'). None = biarkan agent memutuskan.",
    )


# --------------------------------------------------------------------------- #
# Referensi & verifikasi
# --------------------------------------------------------------------------- #


class Author(BaseModel):
    family: str
    given: str = ""


class Reference(BaseModel):
    """Referensi yang metadatanya berasal dari indeks (Crossref/OpenAlex), bukan dari LLM."""

    key: str = Field(description="Kunci sitasi yang dipakai di draft, mis. 'sugiyono2019'")
    title: str
    authors: list[Author] = Field(default_factory=list)
    year: Optional[int] = None
    container_title: Optional[str] = Field(default=None, description="Nama jurnal/penerbit")
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    source: str = "crossref"

    @property
    def first_surname(self) -> str:
        return self.authors[0].family if self.authors else self.title


class ClaimedReference(BaseModel):
    """Referensi yang *diklaim* ada (mis. hasil ekstraksi dari draft) — belum dipercaya."""

    title: str
    authors: list[Author] = Field(default_factory=list)
    year: Optional[int] = None
    doi: Optional[str] = None


class VerificationResult(BaseModel):
    claimed: ClaimedReference
    verdict: Verdict
    reason: str
    resolved: Optional[Reference] = None
    title_similarity: float = 0.0


# --------------------------------------------------------------------------- #
# Struktur dokumen
# --------------------------------------------------------------------------- #


class OutlineSection(BaseModel):
    number: str = Field(description="Penomoran, mis. '1.1'")
    title: str
    points: list[str] = Field(default_factory=list, description="Poin yang harus dibahas")


class OutlineChapter(BaseModel):
    key: str = Field(description="Kunci stabil, mis. 'bab1'")
    number: int
    title: str
    sections: list[OutlineSection] = Field(default_factory=list)


class Outline(BaseModel):
    working_title: str
    problem_statement: list[str] = Field(default_factory=list)
    objectives: list[str] = Field(default_factory=list)
    chapters: list[OutlineChapter] = Field(default_factory=list)


class Chapter(BaseModel):
    key: str
    number: int
    title: str
    body_markdown: str = ""
    citation_keys: list[str] = Field(default_factory=list)
    # Guardrail: draft tidak bisa diekspor sebelum ditandai sudah dibaca mahasiswa.
    reviewed_by_student: bool = False
    ai_generated: bool = True
    revision: int = 1


class QAIssue(BaseModel):
    severity: str = Field(description="blocker | warning | info")
    chapter_key: Optional[str] = None
    message: str


class QAReport(BaseModel):
    issues: list[QAIssue] = Field(default_factory=list)
    similarity_score: Optional[float] = None

    @property
    def blockers(self) -> list[QAIssue]:
        return [i for i in self.issues if i.severity == "blocker"]


class ThesisDocument(BaseModel):
    outline: Outline
    chapters: list[Chapter] = Field(default_factory=list)
    references: list[Reference] = Field(default_factory=list)
    rejected_references: list[VerificationResult] = Field(default_factory=list)
    citation_style: CitationStyle = CitationStyle.APA7
    template_id: str = "generik-id"
    qa: Optional[QAReport] = None

    def chapter(self, key: str) -> Optional[Chapter]:
        return next((c for c in self.chapters if c.key == key), None)


# --------------------------------------------------------------------------- #
# Progres & proyek
# --------------------------------------------------------------------------- #


class ProgressEvent(BaseModel):
    agent: str
    message: str
    at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Project(BaseModel):
    id: str
    request: ThesisRequest
    status: JobStatus = JobStatus.QUEUED
    document: Optional[ThesisDocument] = None
    events: list[ProgressEvent] = Field(default_factory=list)
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
