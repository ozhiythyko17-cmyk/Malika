"""Template pedoman penulisan kampus.

Satu template = satu pedoman kampus/prodi. Template disimpan sebagai JSON
(lihat `templates_data/`) supaya menambah kampus baru tidak perlu ubah kode.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field

TEMPLATE_DIR = Path(__file__).parent / "templates_data"


class PageSetup(BaseModel):
    paper: str = "A4"
    margin_top_cm: float = 3.0
    margin_bottom_cm: float = 3.0
    margin_left_cm: float = 4.0
    margin_right_cm: float = 3.0
    font_family: str = "Times New Roman"
    font_size_pt: float = 12.0
    line_spacing: float = 2.0


class TemplateChapter(BaseModel):
    key: str
    number: int
    title: str
    required_sections: list[str] = Field(default_factory=list)
    min_words: int = 800


class TemplateConfig(BaseModel):
    id: str
    name: str
    institution: Optional[str] = None
    default_citation_style: str = "apa7"
    page: PageSetup = Field(default_factory=PageSetup)
    front_matter: list[str] = Field(default_factory=list)
    chapters: list[TemplateChapter] = Field(default_factory=list)
    bibliography_heading: str = "DAFTAR PUSTAKA"
    chapter_heading_format: str = "BAB {roman}\n{title}"

    def chapter(self, key: str) -> Optional[TemplateChapter]:
        return next((c for c in self.chapters if c.key == key), None)


_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII"}


def roman(number: int) -> str:
    return _ROMAN.get(number, str(number))


class TemplateNotFound(LookupError):
    pass


@lru_cache
def load_template(template_id: str) -> TemplateConfig:
    path = TEMPLATE_DIR / f"{template_id}.json"
    if not path.exists():
        raise TemplateNotFound(
            f"Template {template_id!r} tidak ada. Tersedia: {', '.join(list_templates())}"
        )
    return TemplateConfig.model_validate(json.loads(path.read_text(encoding="utf-8")))


def list_templates() -> list[str]:
    return sorted(p.stem for p in TEMPLATE_DIR.glob("*.json"))
