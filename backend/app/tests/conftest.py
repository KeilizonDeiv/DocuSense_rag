import json

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings


def parse_sse(response_text: str) -> list[dict]:
    """Parse a `data: {...}\\n\\n`-delimited SSE body into a list of event dicts."""
    events = []
    for block in response_text.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        for line in block.splitlines():
            if line.startswith("data:"):
                events.append(json.loads(line[len("data:") :].strip()))
    return events


@pytest.fixture
def client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("VECTOR_DB_PATH", str(tmp_path / "vector_db"))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    # TestClient talks to "http://testserver" (plain http, no TLS) - a
    # `Secure` cookie would never be echoed back by httpx's cookie jar over
    # that scheme, breaking session persistence across requests in tests.
    # This is the documented "local http dev" exception for COOKIE_SECURE.
    monkeypatch.setenv("COOKIE_SECURE", "false")
    get_settings.cache_clear()

    from app.main import create_app

    app = create_app()
    with TestClient(app) as c:
        yield c

    get_settings.cache_clear()


@pytest.fixture
def make_client(tmp_path, monkeypatch):
    """Factory version of `client`: make_client(SOME_SETTING="value") lets a
    test override specific settings (e.g. a low rate limit or file-size cap)
    before the app is constructed, for cases the shared `client` fixture
    can't parametrize.
    """

    def _make(**env_overrides) -> TestClient:
        monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "uploads"))
        monkeypatch.setenv("VECTOR_DB_PATH", str(tmp_path / "vector_db"))
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        monkeypatch.setenv("COOKIE_SECURE", "false")
        for key, value in env_overrides.items():
            monkeypatch.setenv(key, value)
        get_settings.cache_clear()

        from app.main import create_app

        return TestClient(create_app())

    yield _make
    get_settings.cache_clear()
