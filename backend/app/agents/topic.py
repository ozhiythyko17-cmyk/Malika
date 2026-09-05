"""Topic Agent — mengusulkan topik skripsi untuk mahasiswa yang belum punya ide.

Dua sumber kelayakan yang dipakai:

1. **LLM** menyusun kandidat topik yang masuk akal untuk jurusan, minat, dan
   akses data mahasiswa.
2. **Indeks literatur** memberi angka nyata berapa banyak pustaka yang benar-benar
   ada untuk topik itu. Label "referensi melimpah" tidak boleh berasal dari
   klaim model — itu dihitung dari hasil pencarian.

Pertanyaan "data apa yang realistis Anda dapat" sengaja ditanyakan sebelum topik
diusulkan: topik bagus yang datanya tidak terjangkau adalah penyebab skripsi
mandek yang paling sering ditemui.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..literature import ChainedIndex, make_key
from ..majors import resolve
from ..schemas import Difficulty, TopicRequest, TopicResponse, TopicSuggestion
from .base import ClaudeAgent


class TopicDraft(BaseModel):
    judul: str = Field(description="Judul skripsi yang spesifik, bukan tema umum")
    rumusan_masalah: str = Field(description="Satu-dua pertanyaan penelitian")
    metode: str = Field(description="mis. 'Kuantitatif · survei'")
    difficulty: Difficulty
    data_needed: str = Field(description="Data yang harus dikumpulkan mahasiswa")
    why_relevant: str = Field(description="Kenapa topik ini layak, satu kalimat")
    search_query: str = Field(description="Query pencarian literatur untuk topik ini")


class TopicDraftList(BaseModel):
    topics: list[TopicDraft]


class TopicAgent(ClaudeAgent):
    name = "topic"
    system_prompt = (
        "Anda dosen pembimbing yang membantu mahasiswa memilih topik skripsi yang "
        "REALISTIS dikerjakan satu semester.\n\n"
        "Aturan:\n"
        "1. Topik harus bisa dikerjakan dengan akses data yang mahasiswa sebutkan. "
        "Jangan usulkan topik yang menuntut data yang jelas di luar jangkauannya.\n"
        "2. Judul harus spesifik (ada variabel dan objek penelitian), bukan tema umum.\n"
        "3. Sesuaikan metode dengan tradisi penelitian jurusannya.\n"
        "4. Jangan mengarang nama peneliti, judul jurnal, atau angka temuan — "
        "penilaian ketersediaan pustaka dilakukan sistem, bukan Anda."
    )

    def __init__(self, *args, index: ChainedIndex, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._index = index

    def suggest(self, request: TopicRequest) -> TopicResponse:
        major = resolve(request.major)
        self.report(f"Menyusun usulan topik untuk {major.name}...")

        prompt = (
            f"Jurusan: {major.name}"
            f"{f' (fakultas {major.faculty})' if major.faculty != '—' else ''}\n"
            f"{f'Tradisi metode di jurusan ini: {major.traditions}' if major.traditions else ''}\n"
            f"Minat mahasiswa: {', '.join(request.interests) or 'belum disebutkan'}\n"
            f"Data yang realistis bisa didapat: {request.data_access}\n\n"
            f"Usulkan {request.count} topik skripsi yang berbeda satu sama lain. "
            "Untuk tiap topik sertakan query pencarian literatur akademik yang tepat "
            "(campur istilah Indonesia dan Inggris bila perlu)."
        )

        drafts = self.parse(prompt, TopicDraftList).topics[: request.count]

        suggestions: list[TopicSuggestion] = []
        for draft in drafts:
            found = self._index.search_many(draft.search_query, limit=8)
            taken: set[str] = set()
            samples = []
            for ref in found[:3]:
                copy = ref.model_copy()
                copy.key = make_key(copy, taken)
                taken.add(copy.key)
                samples.append(copy)

            self.report(
                f"“{draft.judul[:48]}…” — {len(found)} pustaka ditemukan di indeks."
            )
            suggestions.append(
                TopicSuggestion(
                    judul=draft.judul,
                    rumusan_masalah=draft.rumusan_masalah,
                    metode=draft.metode,
                    difficulty=draft.difficulty,
                    data_needed=draft.data_needed,
                    why_relevant=draft.why_relevant,
                    reference_count=len(found),
                    sample_references=samples,
                )
            )

        return TopicResponse(major=major.name, suggestions=suggestions)
