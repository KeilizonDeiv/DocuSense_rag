import io
import uuid


def _upload_text(client, name: str, text: str):
    return client.post(
        "/api/documents",
        files={"file": (name, io.BytesIO(text.encode()), "text/plain")},
    )


def test_invalid_session_cookie_is_replaced_with_a_valid_uuid(client):
    client.cookies.set("session_id", "../../evil")

    response = client.get("/api/stats")

    assert response.status_code == 200
    # Read off this response's own Set-Cookie rather than the client's
    # merged jar: the jar now holds both the bad manually-set cookie and
    # the server's replacement (different domains), which is ambiguous.
    new_session_id = response.cookies.get("session_id")
    assert new_session_id is not None
    assert new_session_id != "../../evil"
    uuid.UUID(new_session_id)  # raises ValueError if not a real UUID


def test_invalid_session_cookie_does_not_break_an_error_response(client):
    client.cookies.set("session_id", "not-a-uuid")

    response = client.post("/api/query", json={"question": "hello?"})

    assert response.status_code == 400  # no documents uploaded - not the point of this test
    new_session_id = response.cookies.get("session_id")
    assert new_session_id is not None
    uuid.UUID(new_session_id)


def test_secure_cookie_flag_follows_setting(make_client):
    with make_client(COOKIE_SECURE="true") as c:
        response = c.get("/api/stats")

        set_cookie = response.headers.get("set-cookie", "")
        assert "Secure" in set_cookie


def test_upload_rejects_content_that_does_not_match_extension(client):
    response = client.post(
        "/api/documents",
        files={"file": ("fake.pdf", io.BytesIO(b"this is not a real pdf"), "application/pdf")},
    )

    assert response.status_code == 400


def test_upload_rejects_file_exceeding_size_cap(make_client):
    with make_client(MAX_FILE_SIZE_MB="1") as c:
        oversized = b"x" * (2 * 1024 * 1024)  # 2MB, over the 1MB cap
        response = c.post(
            "/api/documents",
            files={"file": ("big.txt", io.BytesIO(oversized), "text/plain")},
        )

        assert response.status_code == 413
        assert c.get("/api/stats").json()["total_chunks"] == 0


def test_upload_rejects_when_document_count_cap_reached(make_client):
    with make_client(MAX_DOCUMENTS_PER_SESSION="1") as c:
        first = _upload_text(c, "a.txt", "first document content.")
        assert first.status_code == 200

        second = _upload_text(c, "b.txt", "second document content.")
        assert second.status_code == 400


def test_upload_rejects_when_total_bytes_cap_reached(make_client):
    with make_client(MAX_TOTAL_UPLOAD_MB_PER_SESSION="1", MAX_DOCUMENTS_PER_SESSION="10") as c:
        large_text = "word " * 400_000  # ~2MB, over the 1MB session-total cap
        first = _upload_text(c, "big.txt", large_text)
        assert first.status_code == 200

        second = _upload_text(c, "small.txt", "tiny")
        assert second.status_code == 400


def test_upload_rate_limit_returns_429_after_threshold(make_client):
    with make_client(RATE_LIMIT_UPLOAD_PER_MINUTE="1") as c:
        first = _upload_text(c, "a.txt", "some content here.")
        assert first.status_code == 200

        second = _upload_text(c, "b.txt", "more content here.")
        assert second.status_code == 429


def test_query_rate_limit_returns_429_after_threshold(make_client):
    with make_client(RATE_LIMIT_QUERY_PER_MINUTE="1") as c:
        first = c.post("/api/query", json={"question": "hello?"})
        assert first.status_code == 400  # no documents uploaded - still counts as a hit

        second = c.post("/api/query", json={"question": "hello again?"})
        assert second.status_code == 429
