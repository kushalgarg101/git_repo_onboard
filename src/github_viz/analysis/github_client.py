"""GitHub and git metadata enrichment utilities."""

from __future__ import annotations

import logging
import os
import pathlib
import re
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import requests

logger = logging.getLogger(__name__)

REQUEST_RETRIES = 4
BACKOFF_SECONDS = 1.5
ISSUES_PER_PAGE = 100
MAX_ISSUE_PAGES = 20


def _request_with_retry(method: str, url: str, **kwargs) -> requests.Response:
    """Execute an HTTP request with retry and basic rate-limit awareness."""
    for attempt in range(REQUEST_RETRIES):
        try:
            response = requests.request(method, url, **kwargs)
            if response.status_code == 403 and response.headers.get("X-RateLimit-Remaining") == "0":
                reset_raw = response.headers.get("X-RateLimit-Reset", "0")
                reset_epoch = int(reset_raw) if reset_raw.isdigit() else 0
                wait_seconds = max(0, reset_epoch - int(time.time())) + 1
                logger.warning("GitHub rate limit hit; waiting %ds", wait_seconds)
                time.sleep(min(wait_seconds, 60))
                continue
            response.raise_for_status()
            return response
        except requests.RequestException:
            if attempt >= REQUEST_RETRIES - 1:
                raise
            sleep_seconds = BACKOFF_SECONDS ** (attempt + 1)
            logger.debug("Retrying GitHub request in %.1fs", sleep_seconds)
            time.sleep(sleep_seconds)
    raise RuntimeError("Failed to execute request with retries")


@dataclass
class GitHubClient:
    """Metadata provider for repository-level and file-level git/GitHub signals."""

    repo: str
    token: Optional[str]

    @classmethod
    def from_repo(cls, repo_root: pathlib.Path, repo_url: Optional[str]) -> Optional["GitHubClient"]:
        """Build client from explicit repo URL or git origin remote."""
        token = os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_PAT")
        repo = _parse_repo(repo_url) if repo_url else _repo_from_git(repo_root)
        if not repo:
            return None
        return cls(repo=repo, token=token)

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/vnd.github+json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def get_issue_counts(self) -> dict[str, int]:
        """Return per-file issue mention counts from paginated GitHub issues."""
        if not self.repo:
            return {}

        counts: dict[str, int] = {}
        for page in range(1, MAX_ISSUE_PAGES + 1):
            url = (
                f"https://api.github.com/repos/{self.repo}/issues"
                f"?state=all&per_page={ISSUES_PER_PAGE}&page={page}"
            )
            try:
                response = _request_with_retry("GET", url, headers=self._headers(), timeout=30)
            except Exception:
                logger.warning("Unable to fetch issues page=%d repo=%s", page, self.repo)
                break

            issues = response.json()
            if not issues:
                break

            for issue in issues:
                if "pull_request" in issue:
                    continue
                text = f"{issue.get('title', '')} {issue.get('body', '')}"
                for path in _extract_paths(text):
                    counts[path] = counts.get(path, 0) + 1

            if len(issues) < ISSUES_PER_PAGE:
                break

        return counts

    def get_churn(self, repo_root: pathlib.Path) -> dict[str, int]:
        """Return per-file commit touch counts from local git history."""
        churn: dict[str, int] = {}
        try:
            output = subprocess.check_output(
                ["git", "-C", str(repo_root), "log", "--name-only", "--pretty=format:"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            return churn
        for line in output.splitlines():
            path = line.strip()
            if not path:
                continue
            churn[path] = churn.get(path, 0) + 1
        return churn

    def get_file_contributors(self, repo_root: pathlib.Path) -> dict[str, int]:
        """Return unique contributor counts per file from local git history."""
        try:
            author_output = subprocess.check_output(
                ["git", "-C", str(repo_root), "log", "--format=%H %ae"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            file_output = subprocess.check_output(
                ["git", "-C", str(repo_root), "log", "--format=%H", "--name-only"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            return {}

        commit_author: dict[str, str] = {}
        for row in author_output.splitlines():
            parts = row.strip().split(maxsplit=1)
            if len(parts) == 2:
                commit_author[parts[0]] = parts[1]

        file_authors: dict[str, set[str]] = {}
        current_commit = ""
        for row in file_output.splitlines():
            value = row.strip()
            if not value:
                continue
            if len(value) == 40 and all(ch in "0123456789abcdef" for ch in value):
                current_commit = value
                continue
            author = commit_author.get(current_commit)
            if author:
                file_authors.setdefault(value, set()).add(author)

        return {path: len(authors) for path, authors in file_authors.items()}

    def get_last_commit_dates(self, repo_root: pathlib.Path) -> dict[str, str]:
        """Return most recent commit timestamp (ISO8601) per file."""
        dates: dict[str, str] = {}
        try:
            output = subprocess.check_output(
                ["git", "-C", str(repo_root), "log", "--name-only", "--format=%ct"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            return dates

        current_epoch: int | None = None
        for row in output.splitlines():
            value = row.strip()
            if not value:
                continue
            if value.isdigit():
                current_epoch = int(value)
                continue
            if current_epoch is None:
                continue
            if value not in dates:
                dates[value] = _epoch_to_iso(current_epoch)
        return dates


def _parse_repo(url: Optional[str]) -> Optional[str]:
    """Extract `owner/repo` from supported GitHub remote URL formats."""
    if not url:
        return None
    match = re.search(r"github\.com[:/](.+?)(\.git)?$", url.strip())
    if not match:
        return None
    return match.group(1).rstrip("/")


def _repo_from_git(repo_root: pathlib.Path) -> Optional[str]:
    """Read origin URL from local git repository and parse owner/repo."""
    try:
        origin = subprocess.check_output(
            ["git", "-C", str(repo_root), "remote", "get-url", "origin"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return None
    return _parse_repo(origin)


def _extract_paths(text: str) -> list[str]:
    """Extract file paths from free text for supported source extensions."""
    pattern = r"[\w/\.\-]+\.(?:py|js|ts|rs|go|java|c|cpp|h|hpp|cc|cxx)"
    return [match.group(0) for match in re.finditer(pattern, text)]


def _epoch_to_iso(epoch_seconds: int) -> str:
    """Convert Unix epoch to UTC ISO8601 timestamp."""
    return datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).isoformat()
