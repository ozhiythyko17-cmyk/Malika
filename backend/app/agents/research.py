"""Research Agent — mencari literatur nyata untuk dijadikan basis penulisan.

Desain penting: LLM hanya dipakai untuk (a) merumuskan query pencarian dan
(b) menyaring relevansi kandidat. Metadata referensi selalu datang dari indeks
(Crossref/OpenAlex), sehingga referensi fiktif tidak mungkin masuk lewat jalur ini.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..literature import ChainedIndex, make_key
from ..schemas import Reference, ThesisRequest
from .base import ClaudeAgent


class SearchPlan(BaseModel):
    queries: list[str] = Field(
        description="3-6 query pencarian literatur akademik, campuran Indonesia & Inggris"
    )
    keywords: list[str] = Field(default_factory=list)


class RelevanceFilter(BaseModel):
    relevant_indexes: list[int] = Field(
        description="Indeks kandidat (0-based) yang relevan dengan topik"
    )
    reason: str = Field(default="", description="Alasan singkat pemilihan")


class ResearchAgent(ClaudeAgent):
    name = "research"
    system_prompt = (
        "Anda adalah pustakawan riset akademik. Tugas Anda merumuskan query "
        "pencarian literatur dan menilai relevansi kandidat hasil pencarian. "
        "Anda TIDAK PERNAH mengarang judul, penulis, tahun, atau DOI — semua "
        "metadata berasal dari indeks yang diberikan kepada Anda."
    )

    def __init__(self, *args, index: ChainedIndex, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._index = index

    # -- langkah 1: rencana pencarian ------------------------------------- #

    def plan(self, request: ThesisRequest) -> SearchPlan:
        self.report("Merumuskan query pencarian literatur...")
        prompt = (
            f"Topik skripsi (dari mahasiswa): {request.prompt}\n"
            f"Bidang studi: {request.field_of_study or 'tidak disebutkan'}\n"
            f"Jenis penelitian: {request.research_type.value}\n\n"
            "Rumuskan query pencarian untuk basis data akademik. Sertakan "
            "variasi bahasa Indonesia dan Inggris agar cakupannya luas."
        )
        return self.parse(prompt, SearchPlan)

    # -- langkah 2: eksekusi pencarian ------------------------------------ #

    def collect_candidates(self, plan: SearchPlan, per_query: int = 8) -> list[Reference]:
        seen: set[str] = set()
        candidates: list[Reference] = []
        for query in plan.queries:
            self.report(f"Mencari literatur: {query!r}")
            for ref in self._index.search_many(query, limit=per_query):
                fingerprint = (ref.doi or ref.title).lower()
                if fingerprint in seen:
                    continue
                seen.add(fingerprint)
                candidates.append(ref)
        self.report(f"{len(candidates)} kandidat literatur terkumpul.")
        return candidates

    # -- langkah 3: penyaringan relevansi --------------------------------- #

    def filter_relevant(
        self, request: ThesisRequest, candidates: list[Reference], keep: int = 25
    ) -> list[Reference]:
        if not candidates:
            return []

        listing = "\n".join(
            f"{i}. {ref.title} ({ref.year or 'n.d.'}) — "
            f"{ref.container_title or 'sumber tidak diketahui'}"
            for i, ref in enumerate(candidates)
        )
        prompt = (
            f"Topik skripsi: {request.prompt}\n"
            f"Jenis penelitian: {request.research_type.value}\n\n"
            f"Kandidat literatur:\n{listing}\n\n"
            f"Pilih maksimal {keep} kandidat yang paling relevan dan layak "
            "dijadikan tinjauan pustaka. Kembalikan indeksnya."
        )
        self.report("Menyaring relevansi kandidat literatur...")
        decision = self.parse(prompt, RelevanceFilter)

        chosen: list[Reference] = []
        taken_keys: set[str] = set()
        for idx in decision.relevant_indexes[:keep]:
            if 0 <= idx < len(candidates):
                ref = candidates[idx].model_copy()
                ref.key = make_key(ref, taken_keys)
                taken_keys.add(ref.key)
                chosen.append(ref)

        self.report(f"{len(chosen)} referensi dipilih sebagai basis penulisan.")
        return chosen

    # -- orkestrasi internal ---------------------------------------------- #

    def run(self, request: ThesisRequest) -> list[Reference]:
        plan = self.plan(request)
        candidates = self.collect_candidates(plan)
        return self.filter_relevant(request, candidates)
