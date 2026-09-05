"""Uji fitur pendamping: pencari topik, asisten AI, dan penandaan tahapan."""

import pytest
from fastapi.testclient import TestClient

from app.agents.assistant import AssistantAgent, build_context
from app.main import (
    app,
    get_assistant_agent,
    get_pipeline,
    get_store,
    get_topic_agent,
)
from app.schemas import (
    AssistantAction,
    AssistantReply,
    Difficulty,
    Project,
    Reference,
    ThesisRequest,
    TopicResponse,
    TopicSuggestion,
)
from app.stages import derive_stages
from app.store import ProjectStore

from .test_api_guardrail import FakePipeline, build_document


class FakeTopicAgent:
    def __init__(self) -> None:
        self.calls = []

    def suggest(self, request) -> TopicResponse:
        self.calls.append(request)
        return TopicResponse(
            major="Manajemen",
            suggestions=[
                TopicSuggestion(
                    judul="Pengaruh Kualitas Layanan terhadap Loyalitas Pelanggan Kedai Kopi",
                    rumusan_masalah="Seberapa besar pengaruh kualitas layanan terhadap loyalitas?",
                    metode="Kuantitatif · survei",
                    difficulty=Difficulty.RINGAN,
                    data_needed="Kuesioner ke 100 pelanggan",
                    why_relevant="Datanya terjangkau dan literaturnya banyak.",
                    reference_count=12,
                    sample_references=[
                        Reference(key="contoh2021", title="Service quality and loyalty", year=2021)
                    ],
                )
            ],
        )


class FakeAssistantAgent:
    def __init__(self, reply: AssistantReply | None = None) -> None:
        self.reply = reply or AssistantReply(
            answer="BAB II Anda sudah memuat empat penelitian terdahulu.",
            action=AssistantAction(label="Buka BAB II", kind="chapter", target="bab2"),
        )
        self.seen_questions = []
        self.seen_history = []

    def answer(self, question, project, stages, history=None):
        self.seen_questions.append(question)
        self.seen_history.append(list(history or []))
        return self.reply


@pytest.fixture
def client(tmp_path):
    store = ProjectStore(f"sqlite+pysqlite:///{tmp_path/'test.db'}")
    pipeline = FakePipeline(build_document())
    topic_agent = FakeTopicAgent()
    assistant = FakeAssistantAgent()

    app.dependency_overrides[get_store] = lambda: store
    app.dependency_overrides[get_pipeline] = lambda: pipeline
    app.dependency_overrides[get_topic_agent] = lambda: topic_agent
    app.dependency_overrides[get_assistant_agent] = lambda: assistant

    with TestClient(app) as test_client:
        test_client.topic_agent = topic_agent
        test_client.assistant = assistant
        yield test_client

    app.dependency_overrides.clear()


def create_project(client: TestClient) -> str:
    response = client.post("/api/projects", json={"prompt": "Topik apa saja yang cukup panjang"})
    return response.json()["project_id"]


# --- jurusan & pencarian topik --------------------------------------------- #


def test_majors_endpoint_covers_many_faculties(client):
    majors = client.get("/api/majors").json()["majors"]
    faculties = {m["faculty"] for m in majors}

    assert len(majors) >= 12
    assert {"Ilmu Komputer", "Ekonomi & Bisnis", "Ilmu Kesehatan", "Hukum"} <= faculties


def test_topic_suggestion_returns_feasibility_signals(client):
    response = client.post(
        "/api/topics/suggest",
        json={
            "major": "mnj",
            "interests": ["Bisnis & keuangan"],
            "data_access": "Kuesioner ke responden",
        },
    )
    assert response.status_code == 200

    suggestion = response.json()["suggestions"][0]
    assert suggestion["difficulty"] == "ringan"
    assert suggestion["reference_count"] == 12
    assert suggestion["data_needed"]
    assert client.topic_agent.calls[0].data_access == "Kuesioner ke responden"


def test_topic_agent_failure_is_reported_as_502(client):
    class Broken:
        def suggest(self, request):
            raise RuntimeError("indeks tidak bisa dihubungi")

    app.dependency_overrides[get_topic_agent] = lambda: Broken()
    response = client.post("/api/topics/suggest", json={"major": "si"})

    assert response.status_code == 502
    assert "indeks tidak bisa dihubungi" in response.json()["detail"]


# --- tahapan skripsi -------------------------------------------------------- #


def test_stages_reflect_draft_state(client):
    project_id = create_project(client)
    stages = client.get(f"/api/projects/{project_id}/stages").json()

    by_id = {s["id"]: s for s in stages}
    assert by_id["s1"]["state"] == "done"
    assert by_id["s3"]["state"] == "current"
    assert len(stages) == 7


def test_marking_manual_stage_moves_current_forward(client):
    project_id = create_project(client)
    for key in ["bab1", "bab2", "bab3", "bab4", "bab5"]:
        client.post(f"/api/projects/{project_id}/chapters/{key}/review", json={"reviewed": True})

    stages = client.post(f"/api/projects/{project_id}/stages/s4", json={"done": True}).json()
    by_id = {s["id"]: s for s in stages}

    assert by_id["s4"]["state"] == "done"
    assert by_id["s7"]["state"] == "current"


def test_unknown_stage_is_rejected(client):
    project_id = create_project(client)
    assert client.post(f"/api/projects/{project_id}/stages/s99", json={"done": True}).status_code == 404


# --- asisten AI ------------------------------------------------------------- #


def test_assistant_answers_and_persists_conversation(client):
    project_id = create_project(client)

    response = client.post(
        f"/api/projects/{project_id}/assistant", json={"message": "Bab 2 saya sudah cukup belum?"}
    )
    assert response.status_code == 200
    assert response.json()["action"]["target"] == "bab2"

    history = client.get(f"/api/projects/{project_id}/assistant").json()
    assert [m["role"] for m in history] == ["user", "assistant"]
    assert history[0]["text"] == "Bab 2 saya sudah cukup belum?"


def test_assistant_conversation_enters_ai_disclosure_log(client):
    project_id = create_project(client)
    client.post(f"/api/projects/{project_id}/assistant", json={"message": "Metodologi saya lemah di mana?"})

    disclosure = client.get(f"/api/projects/{project_id}/ai-disclosure").json()
    kinds = [p["kind"] for p in disclosure["prompts"]]

    assert "asisten" in kinds


def test_assistant_receives_previous_turns_as_history(client):
    project_id = create_project(client)
    client.post(f"/api/projects/{project_id}/assistant", json={"message": "Pertanyaan pertama"})
    client.post(f"/api/projects/{project_id}/assistant", json={"message": "Pertanyaan kedua"})

    assert client.assistant.seen_history[0] == []
    assert [m.text for m in client.assistant.seen_history[1]] == [
        "Pertanyaan pertama",
        "BAB II Anda sudah memuat empat penelitian terdahulu.",
    ]


def test_assistant_failure_is_reported_as_502(client):
    project_id = create_project(client)

    class Broken:
        def answer(self, *args, **kwargs):
            raise RuntimeError("model tidak tersedia")

    app.dependency_overrides[get_assistant_agent] = lambda: Broken()
    response = client.post(f"/api/projects/{project_id}/assistant", json={"message": "Halo"})

    assert response.status_code == 502
    assert client.get(f"/api/projects/{project_id}/assistant").json() == []


# --- konteks & pembersihan action ------------------------------------------ #


def project_with_document() -> Project:
    return Project(
        id="p1",
        request=ThesisRequest(prompt="Analisis sentimen ulasan marketplace"),
        document=build_document(),
    )


def test_context_digest_names_state_the_assistant_must_know():
    project = project_with_document()
    context = build_context(project, derive_stages(project.document))

    assert "BELUM direview" in context
    assert "[@wijaya2021]" in context
    assert "Tahap sekarang" in context


def test_context_marks_chapters_waiting_for_primary_data():
    project = project_with_document()
    project.document.chapters[3].body_markdown += "\n[BUTUH DATA: hasil uji]"

    context = build_context(project, derive_stages(project.document))
    assert "menunggu data primer mahasiswa" in context


def test_action_pointing_at_unknown_chapter_is_dropped():
    project = project_with_document()
    reply = AssistantReply(
        answer="…", action=AssistantAction(label="Buka BAB IX", kind="chapter", target="bab9")
    )

    assert AssistantAgent._sanitize(reply, project).action is None


def test_valid_screen_action_is_kept():
    project = project_with_document()
    reply = AssistantReply(
        answer="…", action=AssistantAction(label="Buka sumber", kind="screen", target="sumber")
    )

    assert AssistantAgent._sanitize(reply, project).action is not None
