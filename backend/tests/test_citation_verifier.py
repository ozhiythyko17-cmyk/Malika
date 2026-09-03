"""Uji gerbang anti-halusinasi sitasi — prioritas teknis #1 produk ini."""

from typing import Optional

import pytest

from app.citation.verifier import (
    CitationVerifier,
    author_overlap,
    decide_verdict,
    normalize_title,
    title_similarity,
)
from app.schemas import Author, ClaimedReference, Reference, Verdict

REAL_TITLE = "Analisis Sentimen Ulasan Produk Menggunakan Naive Bayes"


class FakeIndex:
    """Indeks tiruan: hanya tahu record yang didaftarkan secara eksplisit."""

    def __init__(
        self,
        by_doi: Optional[dict[str, Reference]] = None,
        by_title: Optional[dict[str, Reference]] = None,
    ) -> None:
        self.by_doi = by_doi or {}
        self.by_title = by_title or {}
        self.doi_calls: list[str] = []
        self.title_calls: list[str] = []

    def lookup_doi(self, doi: str) -> Optional[Reference]:
        self.doi_calls.append(doi)
        return self.by_doi.get(doi)

    def search_title(self, title: str, author: Optional[str] = None) -> Optional[Reference]:
        self.title_calls.append(title)
        return self.by_title.get(normalize_title(title))


def record(**overrides) -> Reference:
    base = dict(
        key="",
        title=REAL_TITLE,
        authors=[Author(family="Wijaya", given="Rudi")],
        year=2021,
        doi="10.1234/real",
    )
    base.update(overrides)
    return Reference(**base)


def claim(**overrides) -> ClaimedReference:
    base = dict(
        title=REAL_TITLE,
        authors=[Author(family="Wijaya", given="Rudi")],
        year=2021,
        doi=None,
    )
    base.update(overrides)
    return ClaimedReference(**base)


# --- fungsi murni ---------------------------------------------------------- #


def test_normalize_title_strips_punctuation_case_and_diacritics():
    assert normalize_title("Kajian  Éfektivitas: Sebuah Studi!") == (
        "kajian efektivitas sebuah studi"
    )


def test_title_similarity_identical_and_disjoint():
    assert title_similarity(REAL_TITLE, REAL_TITLE.upper()) == 1.0
    assert title_similarity(REAL_TITLE, "Perancangan Jembatan Beton Pratekan") < 0.5


def test_author_overlap_counts_claimed_surnames_present_in_record():
    claimed = [Author(family="Wijaya"), Author(family="Santoso")]
    found = [Author(family="Wijaya"), Author(family="Lestari")]
    assert author_overlap(claimed, found) == pytest.approx(0.5)


def test_author_overlap_is_lenient_when_no_authors_claimed():
    assert author_overlap([], [Author(family="Wijaya")]) == 1.0


def test_author_overlap_zero_when_record_has_no_authors():
    assert author_overlap([Author(family="Wijaya")], []) == 0.0


# --- keputusan ------------------------------------------------------------- #


def test_verdict_not_found_when_no_candidate():
    result = decide_verdict(claim(), None, title_threshold=0.82, author_threshold=0.34)
    assert result.verdict is Verdict.NOT_FOUND
    assert "fiktif" in result.reason


def test_verdict_verified_on_matching_record():
    result = decide_verdict(claim(), record(), title_threshold=0.82, author_threshold=0.34)
    assert result.verdict is Verdict.VERIFIED
    assert result.resolved is not None


def test_verdict_mismatch_on_different_title():
    result = decide_verdict(
        claim(title="Implementasi Kriptografi AES pada Perangkat IoT"),
        record(),
        title_threshold=0.82,
        author_threshold=0.34,
    )
    assert result.verdict is Verdict.MISMATCH
    assert "Judul tidak cocok" in result.reason


def test_verdict_mismatch_when_authors_do_not_match():
    result = decide_verdict(
        claim(authors=[Author(family="Halim", given="Budi")]),
        record(),
        title_threshold=0.82,
        author_threshold=0.34,
    )
    assert result.verdict is Verdict.MISMATCH
    assert "Penulis tidak cocok" in result.reason


def test_verdict_mismatch_when_year_is_off_by_more_than_one():
    result = decide_verdict(
        claim(year=2015), record(year=2021), title_threshold=0.82, author_threshold=0.34
    )
    assert result.verdict is Verdict.MISMATCH
    assert "Tahun tidak cocok" in result.reason


def test_year_off_by_one_is_tolerated_preprint_vs_publication():
    result = decide_verdict(
        claim(year=2020), record(year=2021), title_threshold=0.82, author_threshold=0.34
    )
    assert result.verdict is Verdict.VERIFIED


# --- verifier end-to-end (indeks tiruan) ----------------------------------- #


def verifier(index: FakeIndex) -> CitationVerifier:
    return CitationVerifier(index, title_threshold=0.82, author_threshold=0.34)


def test_fabricated_doi_is_rejected_without_title_fallback():
    """DOI yang tidak resolve = halusinasi; jangan diselamatkan lewat pencarian judul."""
    index = FakeIndex(by_title={normalize_title(REAL_TITLE): record()})
    result = verifier(index).verify_one(claim(doi="10.9999/tidak-ada"))

    assert result.verdict is Verdict.NOT_FOUND
    assert index.doi_calls == ["10.9999/tidak-ada"]
    assert index.title_calls == []


def test_title_search_used_when_doi_absent():
    index = FakeIndex(by_title={normalize_title(REAL_TITLE): record()})
    result = verifier(index).verify_one(claim())

    assert result.verdict is Verdict.VERIFIED
    assert index.title_calls == [REAL_TITLE]


def test_verify_all_splits_accepted_and_rejected():
    index = FakeIndex(
        by_doi={"10.1234/real": record()},
        by_title={normalize_title(REAL_TITLE): record()},
    )
    claims = [
        claim(doi="10.1234/real"),
        claim(title="Judul Yang Tidak Pernah Ada Di Indeks Mana Pun", doi=None),
    ]
    results = verifier(index).verify_all(claims)

    accepted = CitationVerifier.accepted(results)
    rejected = CitationVerifier.rejected(results)

    assert len(accepted) == 1
    assert accepted[0].title == REAL_TITLE
    assert len(rejected) == 1
    assert rejected[0].verdict is Verdict.NOT_FOUND


def test_accepted_uses_index_metadata_not_claimed_metadata():
    """Metadata yang dipakai draft harus versi indeks, bukan versi klaim LLM."""
    authoritative = record(container_title="Jurnal Teknologi Informasi", year=2021)
    index = FakeIndex(by_title={normalize_title(REAL_TITLE): authoritative})

    # Klaim tidak menyebut jurnal sama sekali (ClaimedReference tidak punya field itu);
    # metadata jurnal harus muncul dari indeks.
    results = verifier(index).verify_all([claim()])
    accepted = CitationVerifier.accepted(results)

    assert accepted[0].container_title == "Jurnal Teknologi Informasi"
