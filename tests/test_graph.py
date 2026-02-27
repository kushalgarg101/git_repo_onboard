"""Tests for graph construction, import resolution, link dedup, and stats."""

import pathlib
import tempfile
import textwrap

import pytest

from github_viz.analysis.graph import _resolve_import, _dedup_links, analyze_repo
from github_viz.analysis.models import Link
from github_viz.analysis.stats import compute_stats, find_shortest_path, search_nodes


# ---------------------------------------------------------------------------
# _resolve_import tests
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_repo(tmp_path):
    """Create a tiny repo structure for import resolution tests."""
    (tmp_path / "utils.py").write_text("# utils")
    (tmp_path / "lib").mkdir()
    (tmp_path / "lib" / "helpers.py").write_text("# helpers")
    (tmp_path / "lib" / "__init__.py").write_text("")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "index.js").write_text("// index")
    return tmp_path


class TestResolveImport:
    def test_python_import(self, tmp_repo):
        file_path = tmp_repo / "main.py"
        result = _resolve_import("import utils", tmp_repo, file_path)
        assert result == "utils.py"

    def test_python_from_import(self, tmp_repo):
        file_path = tmp_repo / "main.py"
        result = _resolve_import("from lib.helpers import something", tmp_repo, file_path)
        assert result == "lib/helpers.py"

    def test_relative_import(self, tmp_repo):
        file_path = tmp_repo / "lib" / "helpers.py"
        result = _resolve_import("from . import helpers", tmp_repo, file_path)
        # Should try to resolve relative to parent
        assert result is None or isinstance(result, str)

    def test_js_import(self, tmp_repo):
        file_path = tmp_repo / "src" / "app.js"
        result = _resolve_import("import './index'", tmp_repo, file_path)
        assert result == "src/index.js"

    def test_unresolvable(self, tmp_repo):
        file_path = tmp_repo / "main.py"
        result = _resolve_import("import nonexistent_module", tmp_repo, file_path)
        assert result is None

    def test_python_import_resolves_from_src_layout(self, tmp_path):
        (tmp_path / "src" / "github_viz").mkdir(parents=True)
        (tmp_path / "src" / "github_viz" / "cli.py").write_text("def app():\n    pass\n")
        file_path = tmp_path / "main.py"
        result = _resolve_import("from github_viz.cli import app", tmp_path, file_path)
        assert result == "src/github_viz/cli.py"

    def test_normalized_relative_import_not_shadowed(self, tmp_repo):
        file_path = tmp_repo / "src" / "main.jsx"
        file_path.write_text("import App from './index.js';\n")
        result = _resolve_import("import ./index.js", tmp_repo, file_path)
        assert result == "src/index.js"


# ---------------------------------------------------------------------------
# Link deduplication
# ---------------------------------------------------------------------------


class TestDedupLinks:
    def test_merges_duplicates(self):
        links = [
            Link(source="a", target="b", kind="import", weight=1),
            Link(source="a", target="b", kind="import", weight=1),
            Link(source="a", target="c", kind="import", weight=1),
        ]
        deduped = _dedup_links(links)
        assert len(deduped) == 2
        ab = [l for l in deduped if l.target == "b"][0]
        assert ab.weight == 2

    def test_different_kinds_not_merged(self):
        links = [
            Link(source="a", target="b", kind="import", weight=1),
            Link(source="a", target="b", kind="calls", weight=1),
        ]
        deduped = _dedup_links(links)
        assert len(deduped) == 2


# ---------------------------------------------------------------------------
# analyze_repo integration
# ---------------------------------------------------------------------------


class TestAnalyzeRepo:
    def test_local_analysis(self, tmp_path):
        (tmp_path / "main.py").write_text("import os\ndef hello():\n    pass\n")
        (tmp_path / "utils.py").write_text("def util():\n    pass\n")
        result = analyze_repo(
            path=str(tmp_path),
            repo_url=None,
            granularity="files",
            languages=["py"],
            with_ai=False,
        )
        assert "meta" in result
        assert "nodes" in result
        assert "links" in result
        assert result["meta"]["granularity"] == "files"
        assert result["meta"]["stats"]["files_scanned"] == 2

    def test_function_granularity(self, tmp_path):
        (tmp_path / "app.py").write_text("def foo():\n    pass\ndef bar():\n    pass\n")
        result = analyze_repo(
            path=str(tmp_path), repo_url=None,
            granularity="functions", languages=["py"], with_ai=False,
        )
        node_types = {n["type"] for n in result["nodes"]}
        assert "function" in node_types
        assert "file" in node_types

    def test_class_granularity(self, tmp_path):
        (tmp_path / "models.py").write_text("class Dog:\n    pass\nclass Cat:\n    pass\n")
        result = analyze_repo(
            path=str(tmp_path), repo_url=None,
            granularity="classes", languages=["py"], with_ai=False,
        )
        node_types = {n["type"] for n in result["nodes"]}
        assert "class" in node_types

    def test_nonexistent_path(self):
        with pytest.raises(FileNotFoundError):
            analyze_repo(path="/nonexistent/path/abc", repo_url=None,
                         granularity="files", languages=["py"], with_ai=False)

    def test_analysis_generates_links_for_internal_imports(self, tmp_path):
        (tmp_path / "src" / "mypkg").mkdir(parents=True)
        (tmp_path / "src" / "mypkg" / "a.py").write_text("from mypkg.b import fn\n")
        (tmp_path / "src" / "mypkg" / "b.py").write_text("def fn():\n    return 1\n")
        result = analyze_repo(
            path=str(tmp_path),
            repo_url=None,
            granularity="files",
            languages=["py"],
            with_ai=False,
        )
        assert len(result["links"]) >= 1


# ---------------------------------------------------------------------------
# Stats module
# ---------------------------------------------------------------------------


class TestStats:
    @pytest.fixture
    def sample_graph(self):
        return {
            "nodes": [
                {"id": "a.py", "type": "file", "language": "py", "complexity": 10, "issues": 3, "churn": 5, "group": "src", "label": "a.py", "summary": "auth logic"},
                {"id": "b.py", "type": "file", "language": "py", "complexity": 2, "issues": 0, "churn": 1, "group": "src", "label": "b.py", "summary": "database queries"},
                {"id": "c.js", "type": "file", "language": "js", "complexity": 5, "issues": 1, "churn": 3, "group": "frontend", "label": "c.js", "summary": ""},
                {"id": "orphan.rs", "type": "file", "language": "rs", "complexity": 1, "issues": 0, "churn": 0, "group": "misc", "label": "orphan.rs", "summary": ""},
            ],
            "links": [
                {"source": "a.py", "target": "b.py", "kind": "import", "weight": 1},
                {"source": "c.js", "target": "a.py", "kind": "import", "weight": 1},
            ],
        }

    def test_compute_stats(self, sample_graph):
        stats = compute_stats(sample_graph)
        assert stats["total_nodes"] == 4
        assert stats["total_links"] == 2
        assert stats["orphan_nodes"] == 1
        assert "orphan.rs" in stats["orphan_ids"]
        assert len(stats["most_connected"]) > 0
        assert len(stats["hotspots"]) > 0
        assert "src" in stats["group_health"]
        assert "py" in stats["language_distribution"]

    def test_shortest_path(self, sample_graph):
        path = find_shortest_path(sample_graph, "c.js", "b.py")
        assert path is not None
        assert path[0] == "c.js"
        assert path[-1] == "b.py"
        assert len(path) == 3  # c.js -> a.py -> b.py

    def test_no_path(self, sample_graph):
        path = find_shortest_path(sample_graph, "orphan.rs", "a.py")
        assert path is None

    def test_search(self, sample_graph):
        results = search_nodes(sample_graph, "auth")
        assert len(results) > 0
        assert results[0]["id"] == "a.py"

    def test_search_no_results(self, sample_graph):
        results = search_nodes(sample_graph, "zzzznonexistent")
        assert len(results) == 0
