def _fake_dist(tmp_path, with_favicon=False):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>fake spa shell</html>")
    (dist / "assets").mkdir()
    (dist / "assets" / "app.js").write_text("console.log('hi')")
    if with_favicon:
        (dist / "favicon.svg").write_text("<svg></svg>")
    return dist


def test_serves_index_html_for_unknown_client_route(make_client, tmp_path):
    dist = _fake_dist(tmp_path)

    with make_client(FRONTEND_DIST_PATH=str(dist)) as c:
        resp = c.get("/some/client/route")
        assert resp.status_code == 200
        assert "fake spa shell" in resp.text


def test_api_and_health_prefixes_404_instead_of_serving_the_spa(make_client, tmp_path):
    dist = _fake_dist(tmp_path)

    with make_client(FRONTEND_DIST_PATH=str(dist)) as c:
        assert c.get("/api/does-not-exist").status_code == 404
        assert c.get("/health/nope").status_code == 404
        assert c.get("/health").status_code == 200  # the real route, unaffected


def test_real_static_file_is_served_directly_not_the_spa_shell(make_client, tmp_path):
    dist = _fake_dist(tmp_path, with_favicon=True)

    with make_client(FRONTEND_DIST_PATH=str(dist)) as c:
        resp = c.get("/favicon.svg")
        assert resp.status_code == 200
        assert "<svg>" in resp.text


def test_missing_frontend_dist_does_not_break_app_startup(make_client, tmp_path):
    # StaticFiles raises at mount time if its directory doesn't exist - the
    # whole point of guarding on frontend_dist_path.is_dir() is that a
    # backend-only checkout (no `npm run build` yet) must still start and
    # serve the API normally, just without a catch-all SPA route.
    with make_client(FRONTEND_DIST_PATH=str(tmp_path / "does-not-exist")) as c:
        assert c.get("/health").status_code == 200
        assert c.get("/some/client/route").status_code == 404
