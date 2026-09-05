"""Uji penurunan tahapan skripsi dari keadaan dokumen."""

import pytest

from app.schemas import (
    Chapter,
    Outline,
    OutlineChapter,
    StageState,
    ThesisDocument,
)
from app.stages import current_stage, derive_stages

CHAPTER_TITLES = [
    (1, "PENDAHULUAN"),
    (2, "TINJAUAN PUSTAKA"),
    (3, "METODE PENELITIAN"),
    (4, "HASIL DAN PEMBAHASAN"),
    (5, "KESIMPULAN DAN SARAN"),
]


def build_document(
    *, reviewed: set[str] = frozenset(), need_data: set[str] = frozenset(), title: str = "Judul kerja"
) -> ThesisDocument:
    return ThesisDocument(
        outline=Outline(
            working_title=title,
            problem_statement=["Bagaimana pengaruh X terhadap Y?"],
            chapters=[
                OutlineChapter(key=f"bab{n}", number=n, title=t) for n, t in CHAPTER_TITLES
            ],
        ),
        chapters=[
            Chapter(
                key=f"bab{n}",
                number=n,
                title=t,
                body_markdown=(
                    "Isi bab. [BUTUH DATA: hasil pengujian]" if f"bab{n}" in need_data else "Isi bab."
                ),
                reviewed_by_student=f"bab{n}" in reviewed,
            )
            for n, t in CHAPTER_TITLES
        ],
    )


def state_of(stages, stage_id):
    return next(s.state for s in stages if s.id == stage_id)


def test_without_document_only_first_stage_is_current():
    stages = derive_stages(None)

    assert state_of(stages, "s1") is StageState.CURRENT
    assert all(s.state is StageState.PENDING for s in stages[1:])
    assert current_stage(None).id == "s1"


def test_document_marks_topic_and_title_done():
    stages = derive_stages(build_document())

    assert state_of(stages, "s1") is StageState.DONE
    assert state_of(stages, "s2") is StageState.DONE
    assert state_of(stages, "s3") is StageState.CURRENT


def test_title_stage_not_done_without_problem_statement():
    document = build_document()
    document.outline.problem_statement = []

    assert state_of(derive_stages(document), "s2") is StageState.CURRENT


def test_proposal_done_only_after_bab1_to_3_reviewed():
    partial = build_document(reviewed={"bab1", "bab2"})
    assert state_of(derive_stages(partial), "s3") is StageState.CURRENT

    full = build_document(reviewed={"bab1", "bab2", "bab3"})
    assert state_of(derive_stages(full), "s3") is StageState.DONE


def test_seminar_comes_before_data_collection():
    """Urutan sengaja: seminar proposal dulu, baru ambil data."""
    document = build_document(reviewed={"bab1", "bab2", "bab3"})

    assert state_of(derive_stages(document), "s4") is StageState.CURRENT
    assert state_of(derive_stages(document), "s5") is StageState.PENDING


def test_data_stage_blocked_while_need_data_marker_present():
    document = build_document(reviewed={"bab1", "bab2", "bab3"}, need_data={"bab4"})
    stages = derive_stages(document, ["s4"])  # seminar sudah ditandai selesai

    assert state_of(stages, "s5") is StageState.CURRENT
    assert state_of(stages, "s6") is StageState.PENDING


def test_missing_marker_alone_does_not_mean_data_collected():
    """Draft tanpa penanda [BUTUH DATA] bukan bukti mahasiswa sudah mengambil data."""
    document = build_document(reviewed={"bab1", "bab2", "bab3"})
    stages = derive_stages(document, ["s4"])

    assert state_of(stages, "s5") is StageState.CURRENT
    assert state_of(stages, "s6") is StageState.PENDING


def test_result_stage_needs_both_data_and_review():
    results_read = build_document(reviewed={"bab1", "bab2", "bab3", "bab4"})
    stages = derive_stages(results_read, ["s4"])
    assert state_of(stages, "s5") is StageState.DONE
    assert state_of(stages, "s6") is StageState.CURRENT

    complete = derive_stages(build_document(reviewed={f"bab{n}" for n in range(1, 6)}), ["s4"])
    assert state_of(complete, "s5") is StageState.DONE
    assert state_of(complete, "s6") is StageState.DONE


def test_manual_stages_never_derive_themselves():
    """Seminar & sidang tidak bisa dianggap selesai oleh aplikasi."""
    complete = build_document(reviewed={f"bab{n}" for n in range(1, 6)})
    stages = derive_stages(complete)

    assert state_of(stages, "s4") is StageState.CURRENT
    assert state_of(stages, "s7") is StageState.PENDING


def test_manual_override_marks_stage_done():
    complete = build_document(reviewed={f"bab{n}" for n in range(1, 6)})
    stages = derive_stages(complete, ["s4"])

    assert state_of(stages, "s4") is StageState.DONE
    assert state_of(stages, "s7") is StageState.CURRENT


def test_exactly_one_current_stage():
    for document in (None, build_document(), build_document(reviewed={"bab1"})):
        stages = derive_stages(document)
        assert sum(1 for s in stages if s.state is StageState.CURRENT) == 1


def test_stage_numbers_are_sequential():
    stages = derive_stages(None)
    assert [s.number for s in stages] == list(range(1, len(stages) + 1))


@pytest.mark.parametrize("stage_id, tool", [("s1", "topik"), ("s5", "data"), ("s7", "sidang")])
def test_each_stage_points_at_a_tool(stage_id, tool):
    stages = derive_stages(None)
    assert next(s.tool for s in stages if s.id == stage_id) == tool
