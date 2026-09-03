from app.citation.style import (
    format_apa7,
    format_bibliography,
    format_ieee,
    intext_citation,
)
from app.schemas import Author, CitationStyle, Reference


def ref(**overrides) -> Reference:
    base = dict(
        key="sugiyono2019",
        title="Metode Penelitian Kuantitatif, Kualitatif, dan R&D",
        authors=[Author(family="Sugiyono", given="Sugiyono")],
        year=2019,
        container_title="Alfabeta",
        doi="10.1234/abcd",
    )
    base.update(overrides)
    return Reference(**base)


def test_apa7_single_author():
    assert format_apa7(ref()) == (
        "Sugiyono, S. (2019). Metode Penelitian Kuantitatif, Kualitatif, dan R&D. "
        "Alfabeta. https://doi.org/10.1234/abcd"
    )


def test_apa7_two_authors_uses_ampersand():
    formatted = format_apa7(
        ref(
            authors=[
                Author(family="Nasution", given="Andi Putra"),
                Author(family="Halim", given="Budi"),
            ]
        )
    )
    assert formatted.startswith("Nasution, A. P., & Halim, B. (2019).")


def test_apa7_journal_includes_volume_issue_pages():
    formatted = format_apa7(
        ref(
            container_title="Jurnal Sistem Informasi",
            volume="12",
            issue="3",
            pages="45-67",
        )
    )
    assert "Jurnal Sistem Informasi, 12(3), 45-67." in formatted


def test_apa7_missing_year_uses_nd():
    assert "(n.d.)" in format_apa7(ref(year=None))


def test_apa7_falls_back_to_url_when_no_doi():
    formatted = format_apa7(ref(doi=None, url="https://repository.example.ac.id/1"))
    assert formatted.endswith("https://repository.example.ac.id/1")


def test_ieee_numbering_and_shape():
    formatted = format_ieee(
        ref(
            authors=[Author(family="Sugiyono", given="Sugiyono")],
            container_title="Jurnal Sistem Informasi",
            volume="12",
            issue="3",
            pages="45-67",
        ),
        index=3,
    )
    assert formatted.startswith('[3] S. Sugiyono, "Metode Penelitian')
    assert "vol. 12, no. 3, pp. 45-67," in formatted
    assert formatted.endswith("doi: 10.1234/abcd.")


def test_ieee_four_authors_uses_et_al():
    formatted = format_ieee(
        ref(
            authors=[
                Author(family="A", given="Aa"),
                Author(family="B", given="Bb"),
                Author(family="C", given="Cc"),
                Author(family="D", given="Dd"),
            ]
        ),
        index=1,
    )
    assert "A. A et al.," in formatted


def test_intext_citation_per_style():
    assert intext_citation(ref(), CitationStyle.APA7) == "(Sugiyono, 2019)"
    assert intext_citation(ref(), CitationStyle.IEEE, index=7) == "[7]"


def test_bibliography_apa_sorted_alphabetically():
    refs = [
        ref(key="zulkifli2020", authors=[Author(family="Zulkifli", given="Zul")]),
        ref(key="ahmad2018", authors=[Author(family="Ahmad", given="Ali")]),
    ]
    entries = format_bibliography(refs, CitationStyle.APA7)
    assert entries[0].startswith("Ahmad")
    assert entries[1].startswith("Zulkifli")


def test_bibliography_ieee_keeps_citation_order_and_numbers():
    refs = [
        ref(key="zulkifli2020", authors=[Author(family="Zulkifli", given="Zul")]),
        ref(key="ahmad2018", authors=[Author(family="Ahmad", given="Ali")]),
    ]
    entries = format_bibliography(refs, CitationStyle.IEEE)
    assert entries[0].startswith("[1] Z. Zulkifli")
    assert entries[1].startswith("[2] A. Ahmad")
