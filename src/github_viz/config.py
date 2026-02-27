"""Centralized runtime configuration for CodeGraph 3D.

This module reads environment variables once and exposes a typed `Settings`
object that can be shared across CLI, API, and analysis layers.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    """Immutable runtime settings loaded from the environment."""

    app_name: str = "CodeGraph 3D API"
    app_version: str = "0.3.0"
    host: str = "127.0.0.1"
    port: int = 8000
    max_sessions: int = 50
    analysis_workers: int = 4
    default_languages: tuple[str, ...] = ("py", "js", "ts", "rs")
    log_level: str = "INFO"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return process-wide settings.

    Values are loaded from environment variables with safe defaults.
    """
    return Settings(
        host=os.getenv("CODEGRAPH_HOST", "127.0.0.1"),
        port=int(os.getenv("CODEGRAPH_PORT", "8000")),
        max_sessions=int(os.getenv("CODEGRAPH_MAX_SESSIONS", "50")),
        analysis_workers=int(os.getenv("CODEGRAPH_ANALYSIS_WORKERS", "4")),
        log_level=os.getenv("CODEGRAPH_LOG_LEVEL", "INFO").upper(),
    )
