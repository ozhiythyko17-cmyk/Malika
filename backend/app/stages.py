"""Tahapan skripsi dari penentuan topik sampai sidang.

Status tiap tahap **diturunkan dari keadaan dokumen**, bukan disimpan sebagai
flag terpisah, supaya tidak pernah berbohong: bab yang belum ditulis tidak bisa
membuat tahap "Proposal" tampak selesai.

Dua tahap yang tidak terlihat oleh aplikasi — bimbingan/seminar dan sidang —
hanya bisa ditandai manual oleh mahasiswa (`stage_overrides`).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

from .schemas import Stage, StageState, ThesisDocument

NEED_DATA_MARKER = "[BUTUH DATA"
PROPOSAL_KEYS = ("bab1", "bab2", "bab3")
RESULT_KEYS = ("bab4", "bab5")


@dataclass(frozen=True)
class StageSpec:
    id: str
    name: str
    note: str
    tool: str
    hint: str
    manual_only: bool
    is_done: Callable[[Optional[ThesisDocument]], bool]


def _has_document(document: Optional[ThesisDocument]) -> bool:
    return document is not None and bool(document.chapters)


def _title_settled(document: Optional[ThesisDocument]) -> bool:
    return (
        document is not None
        and bool(document.outline.working_title.strip())
        and bool(document.outline.problem_statement)
    )


def _chapters_reviewed(document: Optional[ThesisDocument], keys: tuple[str, ...]) -> bool:
    if document is None:
        return False
    chapters = [document.chapter(key) for key in keys]
    if any(chapter is None for chapter in chapters):
        return False
    return all(chapter.reviewed_by_student for chapter in chapters)  # type: ignore[union-attr]


def _no_pending_data_markers(document: Optional[ThesisDocument]) -> bool:
    if not _has_document(document):
        return False
    return not any(
        NEED_DATA_MARKER in chapter.body_markdown for chapter in document.chapters  # type: ignore[union-attr]
    )


def _data_filled(document: Optional[ThesisDocument]) -> bool:
    """Data primer dianggap sudah masuk hanya bila dua-duanya terpenuhi.

    Tidak cukup melihat hilangnya penanda [BUTUH DATA]: draft yang baru
    digenerate bisa saja tidak memuat penanda sama sekali, dan itu tidak berarti
    mahasiswa sudah mengambil data. Karena itu bab hasil harus sudah dibaca dan
    ditandai mahasiswa — tanda bahwa ia benar-benar melewati bagian tersebut.
    """
    return _no_pending_data_markers(document) and _chapters_reviewed(document, ("bab4",))


SPECS: tuple[StageSpec, ...] = (
    StageSpec(
        id="s1",
        name="Tentukan topik",
        note="Topik dipilih & disaring kelayakannya",
        tool="topik",
        hint="Belum punya topik? Jawab 3 pertanyaan, aplikasi mengusulkan topik beserta kelayakannya.",
        manual_only=False,
        is_done=_has_document,
    ),
    StageSpec(
        id="s2",
        name="Susun judul & rumusan masalah",
        note="Judul dikunci sebagai acuan seluruh bab",
        tool="judul",
        hint="Pastikan rumusan masalah sudah terkunci sebelum menulis — ini penyebab revisi berulang nomor satu.",
        manual_only=False,
        is_done=_title_settled,
    ),
    StageSpec(
        id="s3",
        name="Proposal (BAB I–III)",
        note="Draft proposal disusun & direview",
        tool="draft",
        hint="Baca tiap bab dan tandai sudah direview — ekspor terkunci sampai semuanya ditandai.",
        manual_only=False,
        is_done=lambda doc: _chapters_reviewed(doc, PROPOSAL_KEYS),
    ),
    StageSpec(
        id="s4",
        name="Bimbingan & seminar proposal",
        note="Ditandai manual — aplikasi tidak tahu jadwal kampus Anda",
        tool="bimbingan",
        hint="Siapkan ringkasan progres dan pertanyaan untuk pembimbing, lalu tandai tahap ini selesai.",
        manual_only=True,
        is_done=lambda doc: False,
    ),
    StageSpec(
        id="s5",
        name="Ambil & olah data",
        note="Bagian ini pekerjaan Anda, bukan AI",
        tool="data",
        hint="Isi bagian bertanda [BUTUH DATA] dengan hasil penelitian Anda sendiri.",
        manual_only=False,
        is_done=_data_filled,
    ),
    StageSpec(
        id="s6",
        name="Hasil & pembahasan (BAB IV–V)",
        note="Draft dilanjutkan dengan data Anda",
        tool="draft",
        hint="Setelah data masuk, minta revisi BAB IV–V lewat prompt, lalu review ulang.",
        manual_only=False,
        is_done=lambda doc: _data_filled(doc) and _chapters_reviewed(doc, RESULT_KEYS),
    ),
    StageSpec(
        id="s7",
        name="Sidang skripsi",
        note="Ditandai manual setelah sidang",
        tool="sidang",
        hint="Latihan menjawab pertanyaan penguji dari titik lemah draft Anda.",
        manual_only=True,
        is_done=lambda doc: False,
    ),
)


def derive_stages(
    document: Optional[ThesisDocument], overrides: Optional[list[str]] = None
) -> list[Stage]:
    """Susun status seluruh tahap. Tahap pertama yang belum selesai = `current`."""
    marked = set(overrides or [])
    stages: list[Stage] = []
    current_assigned = False

    for index, spec in enumerate(SPECS, start=1):
        done = spec.id in marked or spec.is_done(document)
        if done:
            state = StageState.DONE
        elif not current_assigned:
            state = StageState.CURRENT
            current_assigned = True
        else:
            state = StageState.PENDING

        stages.append(
            Stage(
                id=spec.id,
                number=index,
                name=spec.name,
                note=spec.note,
                state=state,
                tool=spec.tool,
                hint=spec.hint,
            )
        )
    return stages


def current_stage(
    document: Optional[ThesisDocument], overrides: Optional[list[str]] = None
) -> Stage:
    stages = derive_stages(document, overrides)
    return next((s for s in stages if s.state is StageState.CURRENT), stages[-1])


def stage_ids() -> list[str]:
    return [spec.id for spec in SPECS]
