from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"
    anthropic_rewrite_model: str = "claude-haiku-4-5"

    upload_dir: Path = BACKEND_DIR / "uploads"
    vector_db_path: Path = BACKEND_DIR / "vector_db"
    # Built by `npm run build` in frontend/ - absent in a fresh clone or when
    # only working on the backend. A Settings field (not a plain module
    # constant) so tests can point it at a fixture directory instead of the
    # real filesystem path.
    frontend_dist_path: Path = BACKEND_DIR.parent / "frontend" / "dist"
    max_file_size_mb: int = 10
    max_documents_per_session: int = 50
    max_total_upload_mb_per_session: int = 100

    # Best-effort, single-process limits (see app/core/rate_limit.py) - not a
    # substitute for a real gateway/WAF in front of a multi-instance deployment.
    rate_limit_query_per_minute: int = 20
    rate_limit_upload_per_minute: int = 10

    # Defaults to False deliberately (not just "for convenience"): browsers
    # do not send `Secure` cookies over plain HTTP even to localhost/127.0.0.1
    # - confirmed empirically against real Chromium while building this,
    # which silently breaks the entire session mechanism (every request looks
    # like a brand-new visitor) for the most common way to run this app.
    # Set to True when actually deployed behind HTTPS.
    cookie_secure: bool = False

    chunk_size: int = 1000
    chunk_overlap: int = 200

    embedding_model: str = "all-MiniLM-L6-v2"
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    rerank_candidate_multiplier: int = 3

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    log_level: str = "INFO"

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    @property
    def has_api_key(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
