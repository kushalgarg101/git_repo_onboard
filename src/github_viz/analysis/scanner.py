"""Repository scanning utilities.

This module is responsible for file discovery, clone-to-temp handling for
remote repositories, and lightweight repository metadata collection.
"""

from __future__ import annotations

import fnmatch
import os
import pathlib
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from typing import Iterable


SKIP_DIRS = {
    ".git",
    ".venv",
    ".uv_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    ".tox",
    ".eggs",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".next",
    "target",
    "vendor",
    "bin",
    "obj",
}

LANGUAGE_EXTENSIONS = {
    "py": {".py"},
    "js": {".js", ".jsx"},
    "ts": {".ts", ".tsx"},
    "rs": {".rs"},
    "go": {".go"},
    "java": {".java"},
    "c": {".c", ".h"},
    "cpp": {".cpp", ".cc", ".cxx", ".hpp", ".hh"},
}

MONOREPO_MARKERS = {"package.json", "go.mod", "pyproject.toml", "Cargo.toml"}


@dataclass(frozen=True)
class ScanReport:
    """Summary information produced during repository scanning."""

    files: int
    bytes: int
    by_language: dict[str, int]
    monorepo_markers: dict[str, int]


def is_source_file(path: pathlib.Path, languages: list[str]) -> bool:
    """Return True when file extension belongs to selected language set."""
    selected_exts: set[str] = set()
    for language in languages:
        selected_exts.update(LANGUAGE_EXTENSIONS.get(language, set()))
    return path.suffix.lower() in selected_exts


def walk_repo(root: pathlib.Path, languages: list[str]) -> Iterable[pathlib.Path]:
    """Yield source files from a repository while honoring ignore rules."""
    gitignore_patterns = _load_gitignore_patterns(root)
    for dirpath, dirnames, filenames in os.walk(root):
        current = pathlib.Path(dirpath)
        rel_dir = _safe_relative(current, root)
        dirnames[:] = [
            dirname
            for dirname in dirnames
            if dirname not in SKIP_DIRS
            and not _is_ignored(_join_rel(rel_dir, dirname), gitignore_patterns)
        ]
        for filename in filenames:
            rel_file = _join_rel(rel_dir, filename)
            if _is_ignored(rel_file, gitignore_patterns):
                continue
            path = current / filename
            if is_source_file(path, languages):
                yield path


def count_files(root: pathlib.Path, languages: list[str]) -> ScanReport:
    """Return file/size/language distribution and monorepo marker counts."""
    by_language: dict[str, int] = {}
    files = 0
    total_bytes = 0
    for file_path in walk_repo(root, languages):
        files += 1
        total_bytes += _safe_stat_size(file_path)
        lang = _language_for_suffix(file_path.suffix.lower())
        if lang:
            by_language[lang] = by_language.get(lang, 0) + 1

    return ScanReport(
        files=files,
        bytes=total_bytes,
        by_language=by_language,
        monorepo_markers=detect_monorepo(root),
    )


def detect_monorepo(root: pathlib.Path) -> dict[str, int]:
    """Count monorepo markers found under the repository tree."""
    counts = {marker: 0 for marker in MONOREPO_MARKERS}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            if filename in counts:
                counts[filename] += 1
    return counts


def ensure_local_repo(repo_url: str) -> tuple[pathlib.Path, pathlib.Path]:
    """Clone a repository into a temporary directory.

    Returns:
    - repo_root path
    - cleanup path (same value)
    """
    if not repo_url:
        raise ValueError("repo_url cannot be empty")

    tmp_dir = pathlib.Path(tempfile.mkdtemp(prefix="codegraph_"))
    try:
        subprocess.check_call(
            ["git", "clone", "--depth", "1", repo_url, str(tmp_dir)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as exc:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError(f"Failed to clone repo: {repo_url}") from exc
    return tmp_dir, tmp_dir


def _load_gitignore_patterns(root: pathlib.Path) -> list[str]:
    """Load `.gitignore` patterns from repository root."""
    path = root / ".gitignore"
    if not path.exists():
        return []
    patterns: list[str] = []
    try:
        for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            patterns.append(line.rstrip("/"))
    except Exception:
        return []
    return patterns


def _is_ignored(relative_path: str, patterns: list[str]) -> bool:
    """Evaluate a repo-relative path against simplified gitignore patterns."""
    rel = relative_path.replace("\\", "/").lstrip("./")
    for pattern in patterns:
        if pattern.startswith("!"):
            # Negation patterns are intentionally ignored in this lightweight matcher.
            continue
        pat = pattern.replace("\\", "/")
        if "/" in pat:
            if fnmatch.fnmatch(rel, pat):
                return True
        else:
            name = pathlib.Path(rel).name
            if fnmatch.fnmatch(name, pat):
                return True
    return False


def _join_rel(base: str, name: str) -> str:
    """Compose a portable repo-relative path."""
    if not base:
        return name
    return f"{base}/{name}"


def _safe_relative(path: pathlib.Path, root: pathlib.Path) -> str:
    """Return path relative to root as posix string."""
    try:
        return str(path.relative_to(root)).replace("\\", "/")
    except Exception:
        return ""


def _safe_stat_size(path: pathlib.Path) -> int:
    """Return file size; zero when stat fails."""
    try:
        return int(path.stat().st_size)
    except OSError:
        return 0


def _language_for_suffix(suffix: str) -> str | None:
    """Map extension to language key."""
    for language, exts in LANGUAGE_EXTENSIONS.items():
        if suffix in exts:
            return language
    return None
