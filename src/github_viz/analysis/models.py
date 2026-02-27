"""Core graph domain models used across analysis and API layers."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

NodeType = Literal["file", "class", "function"]


@dataclass
class Node:
    """Represents a graph node for a file, class, or function."""

    id: str
    type: NodeType
    language: str
    size: int = 0
    complexity: int = 0
    issues: int = 0
    churn: int = 0
    summary: str = ""
    group: str = ""
    label: str = ""
    line_count: int = 0
    contributors: int = 0
    last_modified: str = ""
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Serialize node into plain dict for JSON output."""
        return asdict(self)


@dataclass
class Link:
    """Represents a directional relationship between two nodes."""

    source: str
    target: str
    kind: str
    weight: int = 1

    def to_dict(self) -> dict:
        """Serialize link into plain dict for JSON output."""
        return asdict(self)
