"""Uji gerbang integritas akademik di lapisan API.

Aturan yang diuji: draft hasil generate TIDAK BISA diekspor sebagai dokumen
final sebelum (a) setiap bab ditandai sudah direview mahasiswa dan (b) tidak
ada temuan QA berkategori blocker.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_pipeline, get_store
from app.schemas import (
    Author,
    Chapter,
    CitationStyle,
    Outline,
    OutlineChapter,
    QAIssue,
    QAReport,
    Reference,
    RevisionRequest,
    ThesisDocument,
    ThesisRequest,
)
from app.store import ProjectStore

TEMPLATE_CHAPTERS = [
    (1, "PENDAHULUAN"),
    (2, "TINJAUAN PUSTAKA"),
    (3, "METODE PENELITIAN"),
    (4, "HASIL DAN PEMBAHASAN"),
    (5, "KESIMPULAN DAN SARAN"),
]


def build_document(qa_issues: list[QAIssue] | None = None) -> ThesisDocument:
    reference = Reference(
        key="wijaya2021",
        title="Analisis Sentimen Ulasan Produk",
        authors=[Author(family="Wijaya", given="Rudi")],
        year=2021,
        container_title="Jurnal Teknologi Informasi",
        doi="10.1234/real",
    )
    return ThesisDocument(
        outline=Outline(
            working_title="Analisis Sentimen Ulasan Marketplace",
            problem_statement=["Bagaimana akurasi Naive Bayes pada ulasan berbahasa Indonesia?"],
            objectives=["Mengukur akurasi model"],
            chapters=[
                OutlineChapter(key=f"bab{n}", number=n, title=title)
                for n, title in TEMPLATE_CHAPTERS
            ],
        ),
        chapters=[
            Chapter(
                key=f"bab{n}",
                number=n,
                title=title,
                body_markdown=f"## Isi {title}\n\nNaskah bab (Wijaya, 2021).",
                citation_keys=["wijaya2021"],
            )
            for n, title in TEMPLATE_CHAPTERS
        ],
        references=[reference],
        citation_style=CitationStyle.APA7,
        template_id="generik-id",
        qa=QAReport(issues=qa_issues or []),
    )


class FakePipeline:
    """Pipeline tiruan: tidak memanggil Claude maupun Crossref."""

    def __init__(self, document: ThesisDocument) -> None:
        self.document = document
        self.revisions: list[RevisionRequest] = []

    def generate(self, request: ThesisRequest, progress) -> ThesisDocument:
        progress("research", "Mencari literatur...")
        progress("writing", "Menulis bab...")
        return self.document

    def revise(self, document, request: RevisionRequest, progress) -> ThesisDocument:
        self.revisions.append(request)
        progress("writing", f"Merevisi {request.chapter_key}...")
        target = request.chapter_key or "bab2"
        chapters = [
            c.model_copy(
                update={
                    "body_markdown": c.body_markdown + "\n\nParagraf hasil revisi.",
                    "revision": c.revision + 1,
                    "reviewed_by_student": False,
                }
            )
            if c.key == target
            else c
            for c in document.chapters
        ]
        return document.model_copy(update={"chapters": chapters})


@pytest.fixture
def client(tmp_path, request):
    qa_issues = getattr(request, "param", None)
    store = ProjectStore(f"sqlite+pysqlite:///{tmp_path/'test.db'}")
    pipeline = FakePipeline(build_document(qa_issues))

    app.dependency_overrides[get_store] = lambda: store
    app.dependency_overrides[get_pipeline] = lambda: pipeline
    with TestClient(app) as test_client:
        test_client.pipeline = pipeline
        yield test_client
    app.dependency_overrides.clear()


def create_project(client: TestClient) -> str:
    response = client.post(
        "/api/projects",
        json={"prompt": "Analisis sentimen ulasan marketplace dengan Naive Bayes"},
    )
    assert response.status_code == 202
    return response.json()["project_id"]


# --- alur dasar ------------------------------------------------------------ #


def test_prompt_produces_full_draft(client):
    project_id = create_project(client)

    project = client.get(f"/api/projects/{project_id}").json()
    assert project["status"] == "done"
    assert [c["key"] for c in project["document"]["chapters"]] == [
        "bab1",
        "bab2",
        "bab3",
        "bab4",
        "bab5",
    ]
    assert [e["agent"] for e in project["events"]] == ["research", "writing"]


def test_unknown_template_is_rejected(client):
    response = client.post(
        "/api/projects",
        json={"prompt": "Topik apa saja yang cukup panjang", "template_id": "tidak-ada"},
    )
    assert response.status_code == 400
    assert "tidak ada" in response.json()["detail"].lower()


# --- gerbang ekspor -------------------------------------------------------- #


def test_export_blocked_while_chapters_unreviewed(client):
    project_id = create_project(client)

    response = client.get(f"/api/projects/{project_id}/export")
    assert response.status_code == 409

    detail = response.json()["detail"]
    assert detail["unreviewed_chapters"] == ["bab1", "bab2", "bab3", "bab4", "bab5"]


def test_export_allowed_after_every_chapter_reviewed(client):
    project_id = create_project(client)
    for key in ["bab1", "bab2", "bab3", "bab4", "bab5"]:
        assert (
            client.post(
                f"/api/projects/{project_id}/chapters/{key}/review", json={"reviewed": True}
            ).status_code
            == 200
        )

    response = client.get(f"/api/projects/{project_id}/export")
    assert response.status_code == 200

    content = response.json()["content"]
    assert "DAFTAR PUSTAKA" in content
    assert "Catatan penggunaan AI" in content  # watermark transparansi selalu ikut
    assert "Wijaya, R. (2021)." in content
    assert response.json()["page"]["margins_cm"]["left"] == 4.0


@pytest.mark.parametrize(
    "client",
    [[QAIssue(severity="blocker", message="Kunci sitasi [@ghost2020] tidak dikenal.")]],
    indirect=True,
)
def test_export_blocked_by_qa_blocker_even_when_reviewed(client):
    project_id = create_project(client)
    for key in ["bab1", "bab2", "bab3", "bab4", "bab5"]:
        client.post(
            f"/api/projects/{project_id}/chapters/{key}/review", json={"reviewed": True}
        )

    response = client.get(f"/api/projects/{project_id}/export")
    assert response.status_code == 409
    assert response.json()["detail"]["qa_blockers"] == [
        "Kunci sitasi [@ghost2020] tidak dikenal."
    ]


def test_revision_resets_review_status_of_target_chapter(client):
    project_id = create_project(client)
    for key in ["bab1", "bab2", "bab3", "bab4", "bab5"]:
        client.post(
            f"/api/projects/{project_id}/chapters/{key}/review", json={"reviewed": True}
        )

    assert (
        client.post(
            f"/api/projects/{project_id}/revise",
            json={"prompt": "Perbanyak studi kasus", "chapter_key": "bab2"},
        ).status_code
        == 202
    )

    chapters = client.get(f"/api/projects/{project_id}").json()["document"]["chapters"]
    by_key = {c["key"]: c for c in chapters}
    assert by_key["bab2"]["reviewed_by_student"] is False
    assert by_key["bab1"]["reviewed_by_student"] is True

    # Konsekuensinya: ekspor terblokir lagi sampai bab yang direvisi dibaca ulang.
    assert client.get(f"/api/projects/{project_id}/export").status_code == 409


def test_revision_requires_existing_draft(client):
    response = client.post(
        "/api/projects/tidak-ada-id/revise", json={"prompt": "Perbaiki bab 2"}
    )
    assert response.status_code == 404


# --- transparansi ---------------------------------------------------------- #


def test_ai_disclosure_logs_initial_and_revision_prompts(client):
    project_id = create_project(client)
    client.post(
        f"/api/projects/{project_id}/revise",
        json={"prompt": "Ganti metode jadi kualitatif", "chapter_key": "bab3"},
    )

    disclosure = client.get(f"/api/projects/{project_id}/ai-disclosure").json()
    kinds = [entry["kind"] for entry in disclosure["prompts"]]
    assert kinds == ["initial", "revision"]
    assert disclosure["prompts"][1]["chapter_key"] == "bab3"
    assert all(chapter["ai_generated"] for chapter in disclosure["chapters"])


def test_progress_events_are_streamed_as_sse(client):
    project_id = create_project(client)

    response = client.get(f"/api/projects/{project_id}/events")
    assert response.status_code == 200
    assert "Mencari literatur" in response.text
    assert "event: status" in response.text
