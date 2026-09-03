"""Verifikasi referensi terhadap indeks otoritatif (anti-halusinasi sitasi).

Aturan yang ditegakkan modul ini:

1. Referensi TIDAK PERNAH dipercaya hanya karena LLM menuliskannya.
2. Setiap referensi harus resolve ke satu record di Crossref/OpenAlex, dan
   metadata (judul + penulis) harus cocok di atas ambang batas.
3. Yang tidak lolos dibuang dari draft dan dilaporkan ke mahasiswa —
   bukan diam-diam dibiarkan lewat.

Logika pencocokan dipisah sebagai fungsi murni supaya bisa diuji tanpa jaringan.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher
from typing import Iterable, Optional, Protocol

from ..schemas import Author, ClaimedReference, Reference, VerificationResult, Verdict

_PUNCT = re.compile(r"[^\w\s]", flags=re.UNICODE)
_SPACE = re.compile(r"\s+")


def normalize_title(title: str) -> str:
    """Turunkan judul ke bentuk kanonik untuk perbandingan.

    Menghapus diakritik, tanda baca, dan merapikan spasi.
    """
    decomposed = unicodedata.normalize("NFKD", title)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    cleaned = _PUNCT.sub(" ", ascii_only.lower())
    return _SPACE.sub(" ", cleaned).strip()


def title_similarity(a: str, b: str) -> float:
    """Kemiripan 0..1 antara dua judul yang sudah dinormalisasi."""
    na, nb = normalize_title(a), normalize_title(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    return SequenceMatcher(None, na, nb).ratio()


def _surnames(authors: Iterable[Author]) -> set[str]:
    return {normalize_title(a.family) for a in authors if a.family.strip()}


def author_overlap(claimed: list[Author], found: list[Author]) -> float:
    """Proporsi nama keluarga yang diklaim dan benar-benar ada di record.

    Mengembalikan 1.0 bila klaim tidak menyebut penulis (tidak ada yang bisa
    dibantah) — pencocokan judul dan DOI yang menanggung keputusan.
    """
    claimed_set, found_set = _surnames(claimed), _surnames(found)
    if not claimed_set:
        return 1.0
    if not found_set:
        return 0.0
    return len(claimed_set & found_set) / len(claimed_set)


def decide_verdict(
    claimed: ClaimedReference,
    candidate: Optional[Reference],
    *,
    title_threshold: float,
    author_threshold: float,
) -> VerificationResult:
    """Putuskan status satu referensi. Fungsi murni — tanpa I/O."""
    if candidate is None:
        return VerificationResult(
            claimed=claimed,
            verdict=Verdict.NOT_FOUND,
            reason="Tidak ditemukan di Crossref/OpenAlex — indikasi referensi fiktif.",
        )

    similarity = title_similarity(claimed.title, candidate.title)
    if similarity < title_threshold:
        return VerificationResult(
            claimed=claimed,
            verdict=Verdict.MISMATCH,
            reason=(
                f"Judul tidak cocok (kemiripan {similarity:.2f} < {title_threshold:.2f}). "
                f"Record ditemukan: {candidate.title!r}"
            ),
            resolved=candidate,
            title_similarity=similarity,
        )

    overlap = author_overlap(claimed.authors, candidate.authors)
    if overlap < author_threshold:
        return VerificationResult(
            claimed=claimed,
            verdict=Verdict.MISMATCH,
            reason=(
                f"Penulis tidak cocok (kecocokan {overlap:.2f} < {author_threshold:.2f}) "
                "untuk judul yang sama."
            ),
            resolved=candidate,
            title_similarity=similarity,
        )

    if claimed.year and candidate.year and abs(claimed.year - candidate.year) > 1:
        return VerificationResult(
            claimed=claimed,
            verdict=Verdict.MISMATCH,
            reason=(
                f"Tahun tidak cocok: diklaim {claimed.year}, "
                f"record {candidate.year}."
            ),
            resolved=candidate,
            title_similarity=similarity,
        )

    return VerificationResult(
        claimed=claimed,
        verdict=Verdict.VERIFIED,
        reason="Cocok dengan record di indeks.",
        resolved=candidate,
        title_similarity=similarity,
    )


class LiteratureIndex(Protocol):
    """Kontrak minimal sumber literatur (diimplementasi Crossref/OpenAlex)."""

    def lookup_doi(self, doi: str) -> Optional[Reference]: ...

    def search_title(self, title: str, author: Optional[str] = None) -> Optional[Reference]: ...


class CitationVerifier:
    """Menjalankan resolusi + keputusan untuk sekumpulan referensi yang diklaim."""

    def __init__(
        self,
        index: LiteratureIndex,
        *,
        title_threshold: float = 0.82,
        author_threshold: float = 0.34,
    ) -> None:
        self._index = index
        self._title_threshold = title_threshold
        self._author_threshold = author_threshold

    def verify_one(self, claimed: ClaimedReference) -> VerificationResult:
        candidate: Optional[Reference] = None

        # DOI adalah jalur paling kuat: kalau DOI diklaim tapi tidak resolve,
        # itu sinyal halusinasi yang paling jelas.
        if claimed.doi:
            candidate = self._index.lookup_doi(claimed.doi)
            if candidate is None:
                return VerificationResult(
                    claimed=claimed,
                    verdict=Verdict.NOT_FOUND,
                    reason=f"DOI {claimed.doi} tidak resolve — referensi fiktif.",
                )

        if candidate is None:
            first_author = claimed.authors[0].family if claimed.authors else None
            candidate = self._index.search_title(claimed.title, first_author)

        return decide_verdict(
            claimed,
            candidate,
            title_threshold=self._title_threshold,
            author_threshold=self._author_threshold,
        )

    def verify_all(self, claims: Iterable[ClaimedReference]) -> list[VerificationResult]:
        return [self.verify_one(c) for c in claims]

    @staticmethod
    def accepted(results: Iterable[VerificationResult]) -> list[Reference]:
        """Hanya yang VERIFIED yang boleh masuk draft."""
        return [
            r.resolved
            for r in results
            if r.verdict is Verdict.VERIFIED and r.resolved is not None
        ]

    @staticmethod
    def rejected(results: Iterable[VerificationResult]) -> list[VerificationResult]:
        return [r for r in results if r.verdict is not Verdict.VERIFIED]
