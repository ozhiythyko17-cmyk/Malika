"""Fondasi semua sub-agent: pemanggilan Claude yang seragam.

Dua mode pemanggilan:

- `parse()`   -> keluaran terstruktur tervalidasi Pydantic (outline, daftar isu QA, dll).
- `write()`   -> keluaran panjang (naskah bab), streaming agar tidak kena timeout HTTP.
"""

from __future__ import annotations

import logging
from typing import Callable, Optional, TypeVar

import anthropic
from pydantic import BaseModel

from ..config import Settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

ProgressHook = Callable[[str, str], None]


class AgentError(RuntimeError):
    """Kegagalan yang bisa dilaporkan ke pengguna tanpa membocorkan detail internal."""


class AgentRefusal(AgentError):
    """Model menolak permintaan (stop_reason='refusal')."""


class ClaudeAgent:
    """Kelas dasar; setiap sub-agent mengisi `name` dan `system_prompt`."""

    name: str = "agent"
    system_prompt: str = ""

    def __init__(
        self,
        client: anthropic.Anthropic,
        settings: Settings,
        progress: Optional[ProgressHook] = None,
    ) -> None:
        self._client = client
        self._settings = settings
        self._progress = progress

    # -- util ------------------------------------------------------------- #

    def report(self, message: str) -> None:
        logger.info("[%s] %s", self.name, message)
        if self._progress is not None:
            self._progress(self.name, message)

    @staticmethod
    def _text_of(message: anthropic.types.Message) -> str:
        return "".join(block.text for block in message.content if block.type == "text")

    def _guard(self, message: anthropic.types.Message) -> None:
        if message.stop_reason == "refusal":
            category = getattr(message.stop_details, "category", None)
            raise AgentRefusal(
                f"Permintaan ditolak oleh model (kategori: {category})."
            )

    # -- pemanggilan ------------------------------------------------------ #

    def parse(self, user_prompt: str, output_format: type[T]) -> T:
        """Minta keluaran JSON yang tervalidasi terhadap skema Pydantic."""
        try:
            response = self._client.messages.parse(
                model=self._settings.claude_model,
                max_tokens=self._settings.max_tokens_structured,
                system=self.system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                output_format=output_format,
            )
        except anthropic.APIStatusError as exc:  # 4xx/5xx dari API
            raise AgentError(f"{self.name}: panggilan API gagal ({exc.status_code}).") from exc
        except anthropic.APIConnectionError as exc:
            raise AgentError(f"{self.name}: koneksi ke API gagal.") from exc

        self._guard(response)
        parsed = response.parsed_output
        if parsed is None:
            raise AgentError(f"{self.name}: model tidak mengembalikan keluaran terstruktur.")
        return parsed

    def write(self, user_prompt: str, *, max_tokens: Optional[int] = None) -> str:
        """Keluaran panjang (naskah). Streaming wajib untuk max_tokens besar."""
        try:
            with self._client.messages.stream(
                model=self._settings.claude_model,
                max_tokens=max_tokens or self._settings.max_tokens_chapter,
                system=self.system_prompt,
                thinking={"type": "adaptive"},
                output_config={"effort": self._settings.writing_effort},
                messages=[{"role": "user", "content": user_prompt}],
            ) as stream:
                message = stream.get_final_message()
        except anthropic.APIStatusError as exc:
            raise AgentError(f"{self.name}: panggilan API gagal ({exc.status_code}).") from exc
        except anthropic.APIConnectionError as exc:
            raise AgentError(f"{self.name}: koneksi ke API gagal.") from exc

        self._guard(message)
        text = self._text_of(message).strip()
        if not text:
            raise AgentError(f"{self.name}: model mengembalikan naskah kosong.")
        return text
