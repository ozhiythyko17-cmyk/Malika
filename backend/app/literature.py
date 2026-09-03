"""Klien sumber literatur: Crossref (utama) dan OpenAlex (fallback).

Metadata referensi HANYA berasal dari sini. Agent penulis tidak pernah boleh
mengarang metadata sendiri — itulah kenapa pencarian literatur dijalankan
sebagai langkah terpisah sebelum penulisan.
"""

from __future__ import annotations

import re
from typing import Any, Optional

import httpx

from .config import Settings
from .schemas import Author, Reference

_SLUG = re.compile(r"[^a-z0-9]+")


def make_key(ref: Reference, taken: set[str]) -> str:
    """Kunci sitasi stabil & unik, mis. 'sugiyono2019', 'sugiyono2019b'."""
    base = _SLUG.sub("", ref.first_surname.lower()) or "anon"
    key = f"{base}{ref.year or 'nd'}"
    if key not in taken:
        return key
    for suffix in "bcdefghijklmnopqrstuvwxyz":
        candidate = f"{key}{suffix}"
        if candidate not in taken:
            return candidate
    return f"{key}{len(taken)}"


def _authors_from_crossref(raw: list[dict[str, Any]] | None) -> list[Author]:
    authors: list[Author] = []
    for entry in raw or []:
        family = (entry.get("family") or entry.get("name") or "").strip()
        if not family:
            continue
        authors.append(Author(family=family, given=(entry.get("given") or "").strip()))
    return authors


def _year_from_crossref(item: dict[str, Any]) -> Optional[int]:
    for field in ("issued", "published-print", "published-online", "created"):
        parts = (item.get(field) or {}).get("date-parts") or []
        if parts and parts[0] and parts[0][0]:
            return int(parts[0][0])
    return None


def _first(seq: Any) -> Optional[str]:
    if isinstance(seq, list) and seq:
        return str(seq[0])
    if isinstance(seq, str) and seq:
        return seq
    return None


class CrossrefIndex:
    """Implementasi `LiteratureIndex` untuk Crossref REST API."""

    def __init__(self, settings: Settings, client: Optional[httpx.Client] = None) -> None:
        self._settings = settings
        self._client = client or httpx.Client(
            base_url=settings.crossref_base_url,
            timeout=settings.http_timeout_seconds,
            headers={"User-Agent": f"SkripsiKu (mailto:{settings.crossref_mailto})"},
        )

    # -- parsing ---------------------------------------------------------- #

    def _to_reference(self, item: dict[str, Any]) -> Optional[Reference]:
        title = _first(item.get("title"))
        if not title:
            return None
        doi = item.get("DOI")
        return Reference(
            key="",  # diisi pemanggil via make_key()
            title=title.strip(),
            authors=_authors_from_crossref(item.get("author")),
            year=_year_from_crossref(item),
            container_title=_first(item.get("container-title")) or item.get("publisher"),
            volume=item.get("volume"),
            issue=item.get("issue"),
            pages=item.get("page"),
            doi=doi,
            url=f"https://doi.org/{doi}" if doi else item.get("URL"),
            source="crossref",
        )

    # -- kontrak LiteratureIndex ------------------------------------------ #

    def lookup_doi(self, doi: str) -> Optional[Reference]:
        cleaned = doi.strip().removeprefix("https://doi.org/").removeprefix("doi:").strip()
        if not cleaned:
            return None
        try:
            response = self._client.get(f"/works/{cleaned}")
        except httpx.HTTPError:
            return None
        if response.status_code != 200:
            return None
        return self._to_reference(response.json().get("message", {}))

    def search_title(self, title: str, author: Optional[str] = None) -> Optional[Reference]:
        query = title if not author else f"{title} {author}"
        try:
            response = self._client.get(
                "/works",
                params={
                    "query.bibliographic": query,
                    "rows": 3,
                    "select": (
                        "DOI,title,author,issued,container-title,publisher,"
                        "volume,issue,page,URL"
                    ),
                },
            )
        except httpx.HTTPError:
            return None
        if response.status_code != 200:
            return None
        items = response.json().get("message", {}).get("items", [])
        for item in items:
            ref = self._to_reference(item)
            if ref is not None:
                return ref
        return None

    # -- pencarian untuk Research Agent ----------------------------------- #

    def search_many(self, query: str, limit: int = 8) -> list[Reference]:
        """Ambil kandidat literatur untuk satu query topik."""
        try:
            response = self._client.get(
                "/works",
                params={
                    "query.bibliographic": query,
                    "rows": limit,
                    "sort": "relevance",
                    "select": (
                        "DOI,title,author,issued,container-title,publisher,"
                        "volume,issue,page,URL,abstract"
                    ),
                },
            )
        except httpx.HTTPError:
            return []
        if response.status_code != 200:
            return []
        refs: list[Reference] = []
        for item in response.json().get("message", {}).get("items", []):
            ref = self._to_reference(item)
            if ref is not None:
                refs.append(ref)
        return refs

    def close(self) -> None:
        self._client.close()


class OpenAlexIndex:
    """Fallback bila Crossref tidak mengembalikan hasil (cakupan berbeda)."""

    def __init__(self, settings: Settings, client: Optional[httpx.Client] = None) -> None:
        self._settings = settings
        self._client = client or httpx.Client(
            base_url=settings.openalex_base_url,
            timeout=settings.http_timeout_seconds,
            headers={"User-Agent": f"SkripsiKu (mailto:{settings.crossref_mailto})"},
        )

    def _to_reference(self, item: dict[str, Any]) -> Optional[Reference]:
        title = item.get("display_name") or item.get("title")
        if not title:
            return None
        authors = [
            Author(family=(name.split()[-1] if name else ""), given=" ".join(name.split()[:-1]))
            for name in (
                (a.get("author") or {}).get("display_name")
                for a in item.get("authorships") or []
            )
            if name
        ]
        doi = (item.get("doi") or "").removeprefix("https://doi.org/") or None
        source = ((item.get("primary_location") or {}).get("source") or {}).get("display_name")
        return Reference(
            key="",
            title=str(title).strip(),
            authors=[a for a in authors if a.family],
            year=item.get("publication_year"),
            container_title=source,
            doi=doi,
            url=f"https://doi.org/{doi}" if doi else item.get("id"),
            source="openalex",
        )

    def lookup_doi(self, doi: str) -> Optional[Reference]:
        cleaned = doi.strip().removeprefix("https://doi.org/").removeprefix("doi:").strip()
        if not cleaned:
            return None
        try:
            response = self._client.get(f"/works/https://doi.org/{cleaned}")
        except httpx.HTTPError:
            return None
        if response.status_code != 200:
            return None
        return self._to_reference(response.json())

    def search_title(self, title: str, author: Optional[str] = None) -> Optional[Reference]:
        try:
            response = self._client.get(
                "/works", params={"search": title, "per-page": 3}
            )
        except httpx.HTTPError:
            return None
        if response.status_code != 200:
            return None
        for item in response.json().get("results", []):
            ref = self._to_reference(item)
            if ref is not None:
                return ref
        return None

    def close(self) -> None:
        self._client.close()


class ChainedIndex:
    """Coba Crossref dulu, lalu OpenAlex. Dipakai verifier & research agent."""

    def __init__(self, primary: CrossrefIndex, fallback: OpenAlexIndex) -> None:
        self._primary = primary
        self._fallback = fallback

    def lookup_doi(self, doi: str) -> Optional[Reference]:
        return self._primary.lookup_doi(doi) or self._fallback.lookup_doi(doi)

    def search_title(self, title: str, author: Optional[str] = None) -> Optional[Reference]:
        return self._primary.search_title(title, author) or self._fallback.search_title(
            title, author
        )

    def search_many(self, query: str, limit: int = 8) -> list[Reference]:
        return self._primary.search_many(query, limit)


def build_index(settings: Settings) -> ChainedIndex:
    return ChainedIndex(CrossrefIndex(settings), OpenAlexIndex(settings))
