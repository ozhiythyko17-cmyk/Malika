"""HTTP API SkripsiKu.

Alur utama: POST /api/projects (satu prompt) -> pipeline agent jalan di
background -> progres dipantau lewat SSE -> mahasiswa review per bab ->
ekspor final.

Gerbang integritas akademik ditegakkan di lapisan ini (bukan cuma di dokumen
perencanaan): `GET /api/projects/{id}/export` menolak permintaan selama masih
ada bab yang belum ditandai sudah direview mahasiswa atau masih ada temuan QA
berkategori blocker.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Iterator, Optional

import anthropic
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .agents.formatting import FormattingAgent
from .agents.orchestrator import Orchestrator, ThesisPipeline
from .config import Settings, get_settings
from .literature import build_index
from .schemas import JobStatus, Project, RevisionRequest, ThesisRequest
from .store import ProjectStore
from .templates import TemplateNotFound, list_templates, load_template

logger = logging.getLogger(__name__)

app = FastAPI(
    title="SkripsiKu API",
    version="0.1.0",
    description="Agentic AI penyusun draft skripsi (draft berbantuan AI, wajib direview mahasiswa).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Dependencies
# --------------------------------------------------------------------------- #


@lru_cache
def get_store() -> ProjectStore:
    return ProjectStore(get_settings().database_url)


@lru_cache
def get_pipeline() -> ThesisPipeline:
    settings: Settings = get_settings()
    return Orchestrator(
        client=anthropic.Anthropic(),
        settings=settings,
        index=build_index(settings),
    )


# --------------------------------------------------------------------------- #
# Payload
# --------------------------------------------------------------------------- #


class CreateProjectResponse(BaseModel):
    project_id: str
    status: JobStatus


class ReviewRequest(BaseModel):
    reviewed: bool = True


class ExportBlocked(BaseModel):
    reason: str
    unreviewed_chapters: list[str] = []
    qa_blockers: list[str] = []


# --------------------------------------------------------------------------- #
# Background jobs
# --------------------------------------------------------------------------- #


def _run_generation(
    project_id: str, request: ThesisRequest, store: ProjectStore, pipeline: ThesisPipeline
) -> None:
    def progress(agent: str, message: str) -> None:
        store.append_event(project_id, agent, message)

    store.set_status(project_id, JobStatus.RUNNING)
    try:
        document = pipeline.generate(request, progress)
        store.save_document(project_id, document)
        store.set_status(project_id, JobStatus.DONE)
    except Exception as exc:  # noqa: BLE001 - kegagalan harus terlihat di status proyek
        logger.exception("Generasi draft gagal untuk proyek %s", project_id)
        store.append_event(project_id, "orchestrator", f"Gagal: {exc}")
        store.set_status(project_id, JobStatus.FAILED, error=str(exc))


def _run_revision(
    project_id: str, request: RevisionRequest, store: ProjectStore, pipeline: ThesisPipeline
) -> None:
    def progress(agent: str, message: str) -> None:
        store.append_event(project_id, agent, message)

    project = store.get(project_id)
    if project is None or project.document is None:
        return

    store.set_status(project_id, JobStatus.RUNNING)
    try:
        document = pipeline.revise(project.document, request, progress)
        store.save_document(project_id, document)
        store.set_status(project_id, JobStatus.DONE)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Revisi gagal untuk proyek %s", project_id)
        store.append_event(project_id, "orchestrator", f"Revisi gagal: {exc}")
        store.set_status(project_id, JobStatus.FAILED, error=str(exc))


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/templates")
def templates() -> dict:
    return {"templates": list_templates()}


@app.post("/api/projects", response_model=CreateProjectResponse, status_code=202)
def create_project(
    request: ThesisRequest,
    background: BackgroundTasks,
    store: ProjectStore = Depends(get_store),
    pipeline: ThesisPipeline = Depends(get_pipeline),
) -> CreateProjectResponse:
    try:
        load_template(request.template_id)
    except TemplateNotFound as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    project = store.create(request)
    background.add_task(_run_generation, project.id, request, store, pipeline)
    return CreateProjectResponse(project_id=project.id, status=project.status)


@app.get("/api/projects/{project_id}", response_model=Project)
def get_project(project_id: str, store: ProjectStore = Depends(get_store)) -> Project:
    project = store.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan.")
    return project


@app.post("/api/projects/{project_id}/revise", status_code=202)
def revise_project(
    project_id: str,
    request: RevisionRequest,
    background: BackgroundTasks,
    store: ProjectStore = Depends(get_store),
    pipeline: ThesisPipeline = Depends(get_pipeline),
) -> dict:
    project = store.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan.")
    if project.document is None:
        raise HTTPException(
            status_code=409, detail="Draft awal belum selesai; revisi belum bisa dijalankan."
        )

    store.log_prompt(project_id, "revision", request.prompt, request.chapter_key)
    background.add_task(_run_revision, project_id, request, store, pipeline)
    return {"status": "accepted"}


@app.post("/api/projects/{project_id}/chapters/{chapter_key}/review")
def review_chapter(
    project_id: str,
    chapter_key: str,
    payload: ReviewRequest,
    store: ProjectStore = Depends(get_store),
) -> dict:
    """Mahasiswa menyatakan sudah membaca & memverifikasi satu bab.

    Ini bukan formalitas: tanpa ini ekspor final diblokir.
    """
    project = store.get(project_id)
    if project is None or project.document is None:
        raise HTTPException(status_code=404, detail="Draft tidak ditemukan.")

    chapter = project.document.chapter(chapter_key)
    if chapter is None:
        raise HTTPException(status_code=404, detail=f"Bab {chapter_key} tidak ada.")

    updated_chapters = [
        c.model_copy(update={"reviewed_by_student": payload.reviewed})
        if c.key == chapter_key
        else c
        for c in project.document.chapters
    ]
    document = project.document.model_copy(update={"chapters": updated_chapters})
    store.save_document(project_id, document)
    store.append_event(
        project_id,
        "review",
        f"Bab {chapter_key} ditandai {'sudah' if payload.reviewed else 'belum'} direview mahasiswa.",
    )
    return {"chapter_key": chapter_key, "reviewed_by_student": payload.reviewed}


@app.get("/api/projects/{project_id}/ai-disclosure")
def ai_disclosure(project_id: str, store: ProjectStore = Depends(get_store)) -> dict:
    """Log transparansi: prompt apa saja yang dipakai & status review per bab."""
    project = store.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan.")

    chapters = project.document.chapters if project.document else []
    return {
        "project_id": project_id,
        "prompts": store.prompt_log(project_id),
        "chapters": [
            {
                "key": c.key,
                "ai_generated": c.ai_generated,
                "revision": c.revision,
                "reviewed_by_student": c.reviewed_by_student,
            }
            for c in chapters
        ],
        "rejected_references": [
            {"title": r.claimed.title, "verdict": r.verdict.value, "reason": r.reason}
            for r in (project.document.rejected_references if project.document else [])
        ],
    }


@app.get("/api/projects/{project_id}/export")
def export_project(
    project_id: str,
    fmt: str = Query(default="markdown", pattern="^(markdown)$"),
    store: ProjectStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Ekspor draft final — diblokir bila gerbang integritas belum terlewati."""
    project = store.get(project_id)
    if project is None or project.document is None:
        raise HTTPException(status_code=404, detail="Draft tidak ditemukan.")

    document = project.document
    unreviewed = [c.key for c in document.chapters if not c.reviewed_by_student]
    blockers = [i.message for i in (document.qa.blockers if document.qa else [])]

    if settings.require_student_review_before_export and (unreviewed or blockers):
        raise HTTPException(
            status_code=409,
            detail=ExportBlocked(
                reason=(
                    "Ekspor final diblokir: draft berbantuan AI harus direview "
                    "mahasiswa per bab dan bebas temuan blocker."
                ),
                unreviewed_chapters=unreviewed,
                qa_blockers=blockers,
            ).model_dump(),
        )

    template = load_template(document.template_id)
    formatter = FormattingAgent()
    return {
        "format": fmt,
        "content": formatter.render_markdown(document, template),
        "page": FormattingAgent.page_metadata(template),
    }


@app.get("/api/projects/{project_id}/events")
def stream_events(
    project_id: str,
    after_id: int = 0,
    store: ProjectStore = Depends(get_store),
) -> StreamingResponse:
    """SSE progres agent.

    Implementasi MVP: satu putaran pembacaan event yang tersedia. Untuk
    streaming berkelanjutan, jalankan di worker terpisah dengan pub/sub
    (lihat README, bagian 'Batasan MVP').
    """
    project = store.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan.")

    def event_source() -> Iterator[str]:
        last_id = after_id
        for event_id, event in store.events_since(project_id, last_id):
            last_id = event_id
            payload = {
                "id": event_id,
                "agent": event.agent,
                "message": event.message,
                "at": event.at.isoformat(),
            }
            yield f"id: {event_id}\ndata: {json.dumps(payload)}\n\n"

        current: Optional[Project] = store.get(project_id)
        status = current.status.value if current else "unknown"
        yield f"event: status\ndata: {json.dumps({'status': status})}\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")
