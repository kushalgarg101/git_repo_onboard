"""Optional LLM enrichment for file summaries."""

from __future__ import annotations

import json
import logging
import os
import pathlib
import re
import time
from collections.abc import Callable

import requests

from github_viz.analysis.models import Node

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
BACKOFF_SECONDS = 1.5
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_BASE_URL = "https://api.openai.com/v1"


def summarize_nodes(
    nodes: dict[str, Node],
    repo_root: pathlib.Path,
    *,
    progress_callback: Callable[[int, int], None] | None = None,
    batch_size: int = 4,
    token_budget: int = 6000,
) -> None:
    """Summarize file nodes in batches using an OpenAI-compatible endpoint.

    Args:
    - nodes: graph node dictionary (mutated in place)
    - repo_root: repository root used to read file snippets
    - progress_callback: optional callback called as `(done, total)`
    - batch_size: number of files per request
    - token_budget: rough per-request token budget for snippet packing
    """
    base_url = os.getenv("OPENAI_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    model = os.getenv("OPENAI_MODEL", DEFAULT_MODEL)
    api_key = os.getenv("OPENAI_API_KEY", "")

    if not _can_call_llm(base_url, api_key):
        logger.info("LLM summaries skipped: missing credentials for non-local endpoint")
        return

    file_nodes = [node for node in nodes.values() if node.type == "file"]
    total = len(file_nodes)
    if total == 0:
        return

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    endpoint = f"{base_url}/chat/completions"

    done = 0
    for start in range(0, total, max(1, batch_size)):
        batch = file_nodes[start : start + batch_size]
        prompt = _build_batch_prompt(batch, repo_root, token_budget=token_budget)
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": 512,
        }

        raw = _call_with_retry(endpoint, headers, payload)
        summaries = _parse_batch_response(raw)
        for node in batch:
            node.summary = summaries.get(node.id, node.summary)
            done += 1
            if progress_callback:
                progress_callback(done, total)


def _build_batch_prompt(batch: list[Node], repo_root: pathlib.Path, *, token_budget: int) -> str:
    """Build a compact JSON-returning prompt for a batch of files."""
    sections: list[str] = []
    used_tokens = 0
    for node in batch:
        snippet = _read_snippet(repo_root / node.id, max_chars=2500)
        approx_tokens = _estimate_tokens(snippet)
        if used_tokens + approx_tokens > token_budget:
            snippet = snippet[: max(200, int((token_budget - used_tokens) * 3))]
            approx_tokens = _estimate_tokens(snippet)
        used_tokens += max(0, approx_tokens)
        sections.append(f"FILE: {node.id}\n```\n{snippet}\n```")

    joined_sections = "\n\n".join(sections)
    return (
        "Summarize each FILE in exactly one sentence. "
        "Return strict JSON object mapping file path to summary. "
        "Do not include markdown.\n\n"
        f"{joined_sections}"
    )


def _call_with_retry(url: str, headers: dict[str, str], payload: dict) -> str:
    """Call completion endpoint with exponential backoff."""
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=45)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            if attempt >= MAX_RETRIES - 1:
                logger.warning("LLM request failed after retries: %s", exc)
                return ""
            wait = BACKOFF_SECONDS ** (attempt + 1)
            logger.debug("Retrying LLM request in %.1fs", wait)
            time.sleep(wait)
    return ""


def _parse_batch_response(text: str) -> dict[str, str]:
    """Parse JSON mapping from model output with tolerant fallback."""
    if not text:
        return {}
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return {str(k): str(v).strip() for k, v in parsed.items()}
    except json.JSONDecodeError:
        pass

    # Fallback: extract first JSON object inside text.
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group(0))
        if isinstance(parsed, dict):
            return {str(k): str(v).strip() for k, v in parsed.items()}
    except json.JSONDecodeError:
        return {}
    return {}


def _read_snippet(path: pathlib.Path, *, max_chars: int) -> str:
    """Read source snippet safely from disk."""
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""
    return content[:max_chars]


def _estimate_tokens(text: str) -> int:
    """Estimate tokens from text length with coarse 4-char/token heuristic."""
    return max(1, len(text) // 4)


def _can_call_llm(base_url: str, api_key: str) -> bool:
    """Allow local endpoints without API key; require key for remote endpoints."""
    if api_key:
        return True
    return "localhost" in base_url or "127.0.0.1" in base_url
