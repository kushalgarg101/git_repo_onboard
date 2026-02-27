"""Pydantic schemas for API requests and responses."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


Granularity = Literal["files", "classes", "functions"]
Language = Literal["py", "js", "ts", "rs", "go", "java", "c", "cpp"]


class AnalyzeRequest(BaseModel):
    """Request payload for remote GitHub URL analysis."""

    repo_url: str = Field(..., description="GitHub repository URL")
    granularity: Granularity = "files"
    languages: list[Language] = Field(default_factory=lambda: ["py", "js", "ts", "rs"])
    with_ai: bool = False

    @field_validator("repo_url")
    @classmethod
    def validate_repo_url(cls, value: str) -> str:
        """Ensure repo URL is non-empty and points to GitHub."""
        value = value.strip()
        if not value:
            raise ValueError("repo_url cannot be empty")
        if "github.com" not in value:
            raise ValueError("repo_url must be a GitHub URL")
        return value


class AnalyzeLocalRequest(BaseModel):
    """Request payload for local-path analysis."""

    path: str
    granularity: Granularity = "files"
    languages: list[Language] = Field(default_factory=lambda: ["py", "js", "ts", "rs"])
    with_ai: bool = False

    @field_validator("path")
    @classmethod
    def validate_path(cls, value: str) -> str:
        """Ensure path is not empty."""
        value = value.strip()
        if not value:
            raise ValueError("path cannot be empty")
        return value
