"""Formatter sitasi & daftar pustaka (fungsi murni, tanpa I/O).

Hanya referensi yang sudah TERVERIFIKASI boleh masuk ke sini — verifikasi
dilakukan di `verifier.py`, bukan di formatter.
"""

from __future__ import annotations

from ..schemas import Author, CitationStyle, Reference


def _initials(given: str) -> str:
    """'Muhammad Rizki' -> 'M. R.'"""
    parts = [p for p in given.replace(".", " ").split() if p]
    return " ".join(f"{p[0].upper()}." for p in parts)


def _apa_author(author: Author) -> str:
    initials = _initials(author.given)
    return f"{author.family}, {initials}".strip().rstrip(",") if initials else author.family


def _apa_authors(authors: list[Author]) -> str:
    """APA 7: sampai 20 penulis; 21+ dipangkas dengan '...' sebelum penulis terakhir."""
    if not authors:
        return ""
    names = [_apa_author(a) for a in authors]
    if len(names) == 1:
        return names[0]
    if len(names) <= 20:
        return ", ".join(names[:-1]) + f", & {names[-1]}"
    return ", ".join(names[:19]) + ", ... " + names[-1]


def _ieee_author(author: Author) -> str:
    initials = _initials(author.given)
    return f"{initials} {author.family}".strip()


def _ieee_authors(authors: list[Author]) -> str:
    """IEEE: 1-3 penulis ditulis semua; 4+ jadi 'penulis pertama et al.'"""
    if not authors:
        return ""
    names = [_ieee_author(a) for a in authors]
    if len(names) == 1:
        return names[0]
    if len(names) > 3:
        return f"{names[0]} et al."
    return ", ".join(names[:-1]) + f", and {names[-1]}"


def _doi_url(ref: Reference) -> str:
    if ref.doi:
        return f"https://doi.org/{ref.doi}"
    return ref.url or ""


def format_apa7(ref: Reference) -> str:
    """Contoh: Sugiyono, S. (2019). Metode penelitian. Alfabeta. https://doi.org/10.x"""
    year = ref.year if ref.year else "n.d."
    bits = [f"{_apa_authors(ref.authors)} ({year}).".lstrip(), f"{ref.title.rstrip('.')}."]

    if ref.container_title:
        source = ref.container_title
        if ref.volume:
            source += f", {ref.volume}"
            if ref.issue:
                source += f"({ref.issue})"
        if ref.pages:
            source += f", {ref.pages}"
        bits.append(f"{source}.")

    link = _doi_url(ref)
    if link:
        bits.append(link)
    return " ".join(b for b in bits if b).strip()


def format_ieee(ref: Reference, index: int) -> str:
    """Contoh: [1] S. Sugiyono, "Metode penelitian," Alfabeta, 2019, doi: 10.x."""
    bits = [f"[{index}]"]
    authors = _ieee_authors(ref.authors)
    if authors:
        bits.append(f"{authors},")
    bits.append(f'"{ref.title.rstrip(".")},"')

    if ref.container_title:
        source = ref.container_title
        if ref.volume:
            source += f", vol. {ref.volume}"
        if ref.issue:
            source += f", no. {ref.issue}"
        if ref.pages:
            source += f", pp. {ref.pages}"
        bits.append(f"{source},")

    if ref.year:
        bits.append(f"{ref.year},")
    if ref.doi:
        bits.append(f"doi: {ref.doi}.")
    else:
        bits[-1] = bits[-1].rstrip(",") + "."
    return " ".join(bits)


def intext_citation(ref: Reference, style: CitationStyle, index: int = 1) -> str:
    """Sitasi dalam teks: APA '(Sugiyono, 2019)', IEEE '[1]'."""
    if style is CitationStyle.IEEE:
        return f"[{index}]"
    year = ref.year if ref.year else "n.d."
    return f"({ref.first_surname}, {year})"


def format_bibliography(refs: list[Reference], style: CitationStyle) -> list[str]:
    """Daftar pustaka.

    APA: diurutkan alfabetis berdasarkan nama keluarga penulis pertama.
    IEEE: mengikuti urutan sitasi (urutan list dipertahankan) dan diberi nomor.
    """
    if style is CitationStyle.IEEE:
        return [format_ieee(ref, i) for i, ref in enumerate(refs, start=1)]

    ordered = sorted(refs, key=lambda r: (r.first_surname.lower(), r.year or 0))
    return [format_apa7(ref) for ref in ordered]
