"""Konfigurasi aplikasi (env-driven)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="SKRIPSIKU_", extra="ignore"
    )

    # --- Claude ---
    claude_model: str = "claude-opus-5"
    # Effort untuk penulisan bab (panjang, butuh penalaran); struktur pakai default.
    writing_effort: str = "high"
    max_tokens_chapter: int = 64_000
    max_tokens_structured: int = 16_000

    # --- Sumber literatur ---
    crossref_base_url: str = "https://api.crossref.org"
    # Crossref "polite pool": kirim email kontak agar tidak di-throttle.
    crossref_mailto: str = "dev@skripsiku.local"
    openalex_base_url: str = "https://api.openalex.org"
    http_timeout_seconds: float = 20.0

    # --- Ambang verifikasi sitasi ---
    # Di bawah ambang ini, referensi dianggap tidak terverifikasi dan DIBUANG.
    title_match_threshold: float = 0.82
    author_match_threshold: float = 0.34

    # --- Persistensi ---
    # Dev: SQLite. Produksi: postgresql+psycopg://user:pass@host:5432/skripsiku
    database_url: str = "sqlite+pysqlite:///./skripsiku.db"

    # --- Guardrail integritas akademik ---
    # Export final diblokir sampai mahasiswa menandai setiap bab sudah direview.
    require_student_review_before_export: bool = True
    similarity_score_max: float = 0.25


@lru_cache
def get_settings() -> Settings:
    return Settings()
