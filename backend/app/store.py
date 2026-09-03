"""Persistensi proyek, draft, dan log progres.

SQLAlchemy dipakai sebagai satu-satunya sumber skema (SQLite untuk dev,
PostgreSQL untuk produksi). Dokumen disimpan sebagai JSON karena bentuknya
masih akan sering berubah selama iterasi; tabel `events` menjadi jejak audit
langkah agent, dan `prompt_log` menjadi jejak transparansi penggunaan AI.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, create_engine, select
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    sessionmaker,
)

from .schemas import (
    JobStatus,
    Project,
    ProgressEvent,
    ThesisDocument,
    ThesisRequest,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class ProjectRow(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(16), default=JobStatus.QUEUED.value)
    request_json: Mapped[dict] = mapped_column(JSON)
    document_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class EventRow(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    agent: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PromptLogRow(Base):
    """Jejak setiap prompt mahasiswa (awal & revisi).

    Bagian dari guardrail transparansi: dosen/kampus dapat melihat draft ini
    lahir dari prompt apa saja, bukan sekadar hasil akhir.
    """

    __tablename__ = "prompt_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # "initial" | "revision"
    prompt: Mapped[str] = mapped_column(Text)
    chapter_key: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ProjectStore:
    def __init__(self, database_url: str) -> None:
        connect_args = (
            {"check_same_thread": False} if database_url.startswith("sqlite") else {}
        )
        self._engine = create_engine(database_url, connect_args=connect_args, future=True)
        self._sessions = sessionmaker(self._engine, expire_on_commit=False, future=True)
        Base.metadata.create_all(self._engine)

    def session(self) -> Session:
        return self._sessions()

    # -- tulis ------------------------------------------------------------ #

    def create(self, request: ThesisRequest) -> Project:
        project_id = str(uuid.uuid4())
        with self.session() as session:
            session.add(
                ProjectRow(
                    id=project_id,
                    status=JobStatus.QUEUED.value,
                    request_json=request.model_dump(mode="json"),
                )
            )
            session.add(
                PromptLogRow(project_id=project_id, kind="initial", prompt=request.prompt)
            )
            session.commit()
        return Project(id=project_id, request=request, status=JobStatus.QUEUED)

    def log_prompt(
        self, project_id: str, kind: str, prompt: str, chapter_key: Optional[str] = None
    ) -> None:
        with self.session() as session:
            session.add(
                PromptLogRow(
                    project_id=project_id, kind=kind, prompt=prompt, chapter_key=chapter_key
                )
            )
            session.commit()

    def set_status(
        self, project_id: str, status: JobStatus, error: Optional[str] = None
    ) -> None:
        with self.session() as session:
            row = session.get(ProjectRow, project_id)
            if row is None:
                return
            row.status = status.value
            row.error = error
            session.commit()

    def save_document(self, project_id: str, document: ThesisDocument) -> None:
        with self.session() as session:
            row = session.get(ProjectRow, project_id)
            if row is None:
                return
            row.document_json = document.model_dump(mode="json")
            session.commit()

    def append_event(self, project_id: str, agent: str, message: str) -> None:
        with self.session() as session:
            session.add(EventRow(project_id=project_id, agent=agent, message=message))
            session.commit()

    # -- baca ------------------------------------------------------------- #

    def get(self, project_id: str) -> Optional[Project]:
        with self.session() as session:
            row = session.get(ProjectRow, project_id)
            if row is None:
                return None
            events = session.scalars(
                select(EventRow).where(EventRow.project_id == project_id).order_by(EventRow.id)
            ).all()

        return Project(
            id=row.id,
            request=ThesisRequest.model_validate(row.request_json),
            status=JobStatus(row.status),
            document=(
                ThesisDocument.model_validate(row.document_json)
                if row.document_json
                else None
            ),
            events=[
                ProgressEvent(agent=e.agent, message=e.message, at=e.at) for e in events
            ],
            error=row.error,
            created_at=row.created_at,
        )

    def events_since(self, project_id: str, after_id: int = 0) -> list[tuple[int, ProgressEvent]]:
        with self.session() as session:
            rows = session.scalars(
                select(EventRow)
                .where(EventRow.project_id == project_id, EventRow.id > after_id)
                .order_by(EventRow.id)
            ).all()
        return [
            (row.id, ProgressEvent(agent=row.agent, message=row.message, at=row.at))
            for row in rows
        ]

    def prompt_log(self, project_id: str) -> list[dict]:
        with self.session() as session:
            rows = session.scalars(
                select(PromptLogRow)
                .where(PromptLogRow.project_id == project_id)
                .order_by(PromptLogRow.id)
            ).all()
        return [
            {
                "kind": row.kind,
                "prompt": row.prompt,
                "chapter_key": row.chapter_key,
                "at": row.at.isoformat(),
            }
            for row in rows
        ]
