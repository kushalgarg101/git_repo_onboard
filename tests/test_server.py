"""Tests for the FastAPI server endpoints."""

import pytest
from fastapi.testclient import TestClient

from github_viz.server import create_app


@pytest.fixture
def client(tmp_path):
    """Create a test client and seed a local analysis."""
    app = create_app()
    client = TestClient(app)

    # Create a small test repo
    (tmp_path / "hello.py").write_text("import os\ndef greet():\n    print('hi')\n")
    (tmp_path / "utils.py").write_text("def helper():\n    return 1\n")

    # Analyze it
    resp = client.post("/analyze/local", json={
        "path": str(tmp_path),
        "granularity": "files",
        "languages": ["py"],
        "with_ai": False,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    client._session_id = data["id"]
    return client


class TestHealthEndpoint:
    def test_health(self):
        app = create_app()
        c = TestClient(app)
        resp = c.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "sessions" in body


class TestAnalyzeLocal:
    def test_success(self, client):
        assert hasattr(client, "_session_id")
        assert client._session_id

    def test_bad_path(self):
        app = create_app()
        c = TestClient(app)
        resp = c.post("/analyze/local", json={
            "path": "/nonexistent/path/xyz",
            "granularity": "files",
            "languages": ["py"],
        })
        assert resp.status_code == 400


class TestGraphEndpoints:
    def test_get_graph(self, client):
        resp = client.get(f"/graph/{client._session_id}")
        assert resp.status_code == 200
        graph = resp.json()
        assert "nodes" in graph
        assert "links" in graph
        assert "meta" in graph

    def test_get_graph_not_found(self, client):
        resp = client.get("/graph/nonexistent-session-id")
        assert resp.status_code == 404

    def test_get_stats(self, client):
        resp = client.get(f"/graph/{client._session_id}/stats")
        assert resp.status_code == 200
        stats = resp.json()
        assert "total_nodes" in stats
        assert "hotspots" in stats
        assert "group_health" in stats

    def test_search(self, client):
        resp = client.get(f"/graph/{client._session_id}/search", params={"q": "hello"})
        assert resp.status_code == 200
        body = resp.json()
        assert "results" in body

    def test_search_empty_query(self, client):
        resp = client.get(f"/graph/{client._session_id}/search", params={"q": ""})
        assert resp.status_code == 422  # validation error

    def test_shortest_path(self, client):
        # Get node IDs first
        graph = client.get(f"/graph/{client._session_id}").json()
        node_ids = [n["id"] for n in graph["nodes"]]
        if len(node_ids) >= 2:
            resp = client.get(
                f"/graph/{client._session_id}/path",
                params={"from": node_ids[0], "to": node_ids[1]},
            )
            # Could be 200 or 404 depending on connectivity
            assert resp.status_code in (200, 404)


class TestSessions:
    def test_list(self, client):
        resp = client.get("/sessions")
        assert resp.status_code == 200
        body = resp.json()
        assert "sessions" in body
        assert len(body["sessions"]) >= 1

    def test_analysis_status(self, client):
        resp = client.get(f"/analyze/status/{client._session_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "done"
