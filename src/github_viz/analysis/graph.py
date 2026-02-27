"""Graph construction and enrichment pipeline."""

from __future__ import annotations

import logging
import pathlib
import re
import shutil
import time
import uuid
from collections import defaultdict
from pathlib import PurePosixPath
from typing import Optional

from github_viz.analysis.github_client import GitHubClient
from github_viz.analysis.llm import summarize_nodes
from github_viz.analysis.models import Link, Node, NodeType
from github_viz.analysis.parser import parse_files
from github_viz.analysis.scanner import count_files, ensure_local_repo, walk_repo

logger = logging.getLogger(__name__)

ALL_SOURCE_EXTS = [".py", ".js", ".ts", ".tsx", ".jsx", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".hpp", ".cc", ".cxx", ".hh"]


def analyze_repo(
    path: Optional[str],
    repo_url: Optional[str],
    granularity: str,
    languages: list[str],
    with_ai: bool,
) -> dict:
    """Analyze repository and return graph JSON consumed by API/UI."""
    started_at = time.monotonic()
    repo_root, cleanup_dir = _resolve_repo_root(path, repo_url)
    cleanup_required = cleanup_dir is not None

    try:
        scan_report = count_files(repo_root, languages)
        files = list(walk_repo(repo_root, languages))
        parsed_files = parse_files(files)

        nodes: dict[str, Node] = {}
        links: list[Link] = []
        total_lines = 0
        languages_seen: dict[str, int] = defaultdict(int)

        for parsed in parsed_files:
            rel_path = _as_repo_relative(parsed.path, repo_root)
            total_lines += parsed.line_count
            languages_seen[parsed.language] += 1
            group = _infer_group(rel_path)
            label = parsed.path.name

            if granularity == "files":
                nodes[rel_path] = _build_file_node(parsed, rel_path, group, label)
            elif granularity == "classes":
                nodes.setdefault(rel_path, _build_file_node(parsed, rel_path, group, label))
                for class_name in parsed.class_defs:
                    class_id = f"{rel_path}::{class_name}"
                    nodes[class_id] = _build_symbol_node(parsed, class_id, "class", group, class_name)
                    links.append(Link(source=class_id, target=rel_path, kind="declares", weight=1))
            elif granularity == "functions":
                nodes.setdefault(rel_path, _build_file_node(parsed, rel_path, group, label))
                for function_name in parsed.func_defs:
                    function_id = f"{rel_path}::{function_name}"
                    nodes[function_id] = _build_symbol_node(parsed, function_id, "function", group, function_name)
                    links.append(Link(source=function_id, target=rel_path, kind="declares", weight=1))
            else:
                raise ValueError(f"Unsupported granularity: {granularity}")

            for import_statement in parsed.imports:
                target = _resolve_import(import_statement, repo_root, parsed.path)
                if target:
                    links.append(Link(source=rel_path, target=target, kind="import", weight=1))

            if granularity == "functions":
                local_functions = set(parsed.func_defs)
                for call in parsed.calls:
                    candidate = call.split(".")[-1]
                    if candidate in local_functions:
                        links.append(
                            Link(source=rel_path, target=f"{rel_path}::{candidate}", kind="calls", weight=1)
                        )

        links = _dedup_links(links)
        github = GitHubClient.from_repo(repo_root, repo_url)
        if github:
            _apply_github_metrics(nodes, github, repo_root)

        if with_ai:
            summarize_nodes(nodes, repo_root)

        elapsed = round(time.monotonic() - started_at, 2)
        return {
            "meta": {
                "repo": github.repo if github else (repo_url or str(repo_root)),
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "granularity": granularity,
                "session_id": str(uuid.uuid4()),
                "stats": {
                    "files_scanned": scan_report.files,
                    "scan_bytes": scan_report.bytes,
                    "scan_language_distribution": scan_report.by_language,
                    "monorepo_markers": scan_report.monorepo_markers,
                    "parsed_files": len(parsed_files),
                    "total_nodes": len(nodes),
                    "total_links": len(links),
                    "total_lines": total_lines,
                    "languages": dict(languages_seen),
                    "analysis_time_s": elapsed,
                },
            },
            "nodes": [node.to_dict() for node in nodes.values()],
            "links": [link.to_dict() for link in links],
        }
    finally:
        if cleanup_required and cleanup_dir:
            shutil.rmtree(cleanup_dir, ignore_errors=True)


def _resolve_repo_root(path: Optional[str], repo_url: Optional[str]) -> tuple[pathlib.Path, pathlib.Path | None]:
    """Resolve local path or clone remote repository into temporary directory."""
    if path:
        root = pathlib.Path(path).resolve()
        if not root.exists():
            raise FileNotFoundError(f"Path not found: {root}")
        return root, None
    repo_root, cleanup_dir = ensure_local_repo(repo_url or "")
    return repo_root, cleanup_dir


def _build_file_node(parsed, node_id: str, group: str, label: str) -> Node:
    """Construct a file-level node from parser output."""
    return Node(
        id=node_id,
        type="file",
        language=parsed.language,
        size=parsed.size,
        complexity=parsed.complexity,
        group=group,
        label=label,
        line_count=parsed.line_count,
    )


def _build_symbol_node(parsed, node_id: str, node_type: NodeType, group: str, label: str) -> Node:
    """Construct a class/function node from parser output."""
    return Node(
        id=node_id,
        type=node_type,
        language=parsed.language,
        size=parsed.size,
        complexity=parsed.complexity,
        group=group,
        label=label,
        line_count=parsed.line_count,
    )


def _as_repo_relative(path: pathlib.Path, repo_root: pathlib.Path) -> str:
    """Return POSIX-style path relative to repository root."""
    return str(path.resolve().relative_to(repo_root.resolve())).replace("\\", "/")


def _infer_group(relative_path: str) -> str:
    """Infer node group from top-level path segment."""
    parts = relative_path.split("/")
    return parts[0] if len(parts) > 1 else "root"


def _dedup_links(links: list[Link]) -> list[Link]:
    """Merge duplicate edges by summing weights."""
    merged: dict[tuple[str, str, str], Link] = {}
    for link in links:
        key = (link.source, link.target, link.kind)
        if key in merged:
            merged[key].weight += link.weight
        else:
            merged[key] = Link(source=link.source, target=link.target, kind=link.kind, weight=link.weight)
    return list(merged.values())


def _resolve_import(statement: str, repo_root: pathlib.Path, file_path: pathlib.Path) -> Optional[str]:
    """Resolve normalized import statements to repository-relative paths."""
    text = statement.strip()

    # Normalized import tokens emitted by parser, e.g. `import ./foo` or `import pkg/sub`.
    match = re.search(r"^import\s+([./\w\-]+)$", text)
    if match:
        return _import_to_path(match.group(1), repo_root, file_path)

    # Python module import form: `import pkg.module`
    match = re.search(r"^import\s+([A-Za-z_][\w\.]*)$", text)
    if match:
        return _import_to_path(match.group(1), repo_root, file_path)

    match = re.search(r"^from\s+([.\w]+)\s+import", text)
    if match:
        return _import_to_path(match.group(1), repo_root, file_path)

    match = re.search(r"""from\s+['"](.+?)['"]""", text)
    if match:
        return _import_to_path(match.group(1), repo_root, file_path)

    match = re.search(r"""^import\s+['"](.+?)['"]""", text)
    if match:
        return _import_to_path(match.group(1), repo_root, file_path)

    match = re.search(r"""require\(['"](.+?)['"]\)""", text)
    if match:
        return _import_to_path(match.group(1), repo_root, file_path)

    # Normalized parser output also emits `require(module)` without quotes.
    match = re.search(r"^require\((.+?)\)$", text)
    if match:
        return _import_to_path(match.group(1), repo_root, file_path)

    match = re.search(r"^use\s+([\w:]+)", text)
    if match:
        return _import_to_path(match.group(1).replace("::", "/"), repo_root, file_path)

    match = re.search(r'^import\s+"(.+?)"', text)
    if match:
        return _import_to_path(match.group(1), repo_root, file_path)

    match = re.search(r"^import\s+([\w\.]+);$", text)
    if match:
        return _import_to_path(match.group(1), repo_root, file_path)

    match = re.search(r'^#include\s+([<"])(.+?)[>"]', text)
    if match:
        delimiter, include = match.group(1), match.group(2)
        return _import_to_path(
            include,
            repo_root,
            file_path,
            prefer_local=delimiter == '"',
        )

    return None


def _import_to_path(
    module: str,
    repo_root: pathlib.Path,
    file_path: pathlib.Path,
    *,
    prefer_local: bool = False,
) -> Optional[str]:
    """Resolve module/import token to a file path within the repository."""
    token = module.strip().strip(";").strip("'\"")
    repo_root = repo_root.resolve()
    file_path = file_path.resolve()

    if token.startswith(("./", "../", "/")):
        base = (repo_root / token.lstrip("/")).resolve() if token.startswith("/") else (file_path.parent / token).resolve()
    elif token.startswith(".") and "/" not in token:
        dots = len(token) - len(token.lstrip("."))
        relative = token.lstrip(".").replace(".", "/")
        base_dir = file_path.parent
        for _ in range(max(dots - 1, 0)):
            base_dir = base_dir.parent
        base = (base_dir / relative).resolve()
    else:
        module_path = _normalize_import_token(token)
        candidate_bases: list[pathlib.Path] = []
        if prefer_local:
            candidate_bases.append((file_path.parent / module_path).resolve())

        candidate_roots = [repo_root]
        src_root = repo_root / "src"
        if src_root.exists() and src_root.is_dir():
            candidate_roots.append(src_root)

        for root in candidate_roots:
            candidate_bases.append((root / module_path).resolve())

        for base in candidate_bases:
            for candidate in _path_variants(base):
                if candidate.exists():
                    try:
                        return _as_repo_relative(candidate, repo_root)
                    except Exception:
                        return str(candidate).replace("\\", "/")
        return None

    for candidate in _path_variants(base):
        if candidate.exists():
            try:
                return _as_repo_relative(candidate, repo_root)
            except Exception:
                return str(candidate).replace("\\", "/")
    return None


def _path_variants(base: pathlib.Path) -> list[pathlib.Path]:
    """Generate possible source file variants for a base import path."""
    variants = [base]
    variants.extend(base.with_suffix(ext) for ext in ALL_SOURCE_EXTS)
    if base.is_dir():
        variants.append(base / "__init__.py")
        variants.extend(base / f"index{ext}" for ext in ALL_SOURCE_EXTS)
    # Preserve order while removing duplicates generated by with_suffix.
    return list(dict.fromkeys(variants))


def _normalize_import_token(token: str) -> str:
    """Normalize import token while preserving explicit file extensions."""
    normalized = token.replace("\\", "/")
    if "/" in normalized:
        return normalized

    suffix = PurePosixPath(normalized).suffix.lower()
    if suffix in ALL_SOURCE_EXTS:
        return normalized

    if re.fullmatch(r"[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*", normalized):
        return normalized.replace(".", "/")

    return normalized


def _apply_github_metrics(nodes: dict[str, Node], github: GitHubClient, repo_root: pathlib.Path) -> None:
    """Attach churn, issue, contributor and freshness metrics to nodes."""
    churn = github.get_churn(repo_root)
    issue_counts = github.get_issue_counts()
    contributors = github.get_file_contributors(repo_root)
    last_modified = github.get_last_commit_dates(repo_root)

    for node in nodes.values():
        file_key = node.id if node.type == "file" else node.id.split("::")[0]
        node.churn = churn.get(file_key, 0)
        node.issues = issue_counts.get(file_key, 0)
        node.contributors = contributors.get(file_key, 0)
        node.last_modified = last_modified.get(file_key, "")
