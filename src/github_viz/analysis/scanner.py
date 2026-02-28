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
import requests
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
        # Attempt standard git clone first
        subprocess.check_call(
            ["git", "clone", "--depth", "1", repo_url, str(tmp_dir)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as exc:
        # Fallback to ZIP download for environments without git (e.g., Vercel Serverless)
        try:
            _download_zipball(repo_url, tmp_dir)
        except Exception as zip_exc:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            raise RuntimeError(
                f"Failed to clone or download repo: {repo_url}. "
                f"Inner errors: git={str(exc)}, zip={str(zip_exc)}"
            ) from zip_exc
    return tmp_dir, tmp_dir


def _download_zipball(repo_url: str, target_dir: pathlib.Path) -> None:
    """Download and extract a GitHub repository as a ZIP archive."""
    import zipfile
    import io

    # Extract owner/repo from URL
    match = re.search(r"github\.com/([^/]+)/([^/]+?)(?:\.git)?$", repo_url.rstrip("/"))
    if not match:
        raise ValueError(f"Could not parse GitHub owner/repo from {repo_url}")
    
    owner, repo = match.groups()
    zip_url = f"https://api.github.com/repos/{owner}/{repo}/zipball/main"
    
    headers = {}
    token = os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_PAT")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    response = requests.get(zip_url, headers=headers, timeout=30)
    # If main fails, try master as a fallback
    if response.status_code == 404:
        zip_url = f"https://api.github.com/repos/{owner}/{repo}/zipball/master"
        response = requests.get(zip_url, headers=headers, timeout=30)
    
    response.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(response.content)) as zip_ref:
        # GitHub zipballs contain a top-level directory like "owner-repo-hash/"
        # We want to extract its contents directly into target_dir
        top_level_dir = zip_ref.namelist()[0].split('/')[0]
        for member in zip_ref.namelist():
            if not member.startswith(top_level_dir):
                continue
            
            # Remove the top-level directory component
            rel_path = member[len(top_level_dir)+1:]
            if not rel_path:
                continue
            
            target_path = target_dir / rel_path
            if member.endswith('/'):
                target_path.mkdir(parents=True, exist_ok=True)
            else:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with zip_ref.open(member) as source, open(target_path, "wb") as target:
                    shutil.copyfileobj(source, target)


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
