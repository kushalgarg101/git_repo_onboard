"""Lightweight multi-language static parser.

The parser is intentionally heuristic and regex-based to keep dependency weight
low and startup fast. It extracts:
- import-like dependencies,
- class and function definitions,
- function call candidates,
- complexity proxies.
"""

from __future__ import annotations

import pathlib
import re
from dataclasses import dataclass
from typing import Callable, Iterable


@dataclass
class ParsedFile:
    """Normalized parse output for a single source file."""

    path: pathlib.Path
    language: str
    imports: list[str]
    class_defs: list[str]
    func_defs: list[str]
    calls: list[str]
    complexity: int
    size: int
    line_count: int


_LANGUAGE_BY_SUFFIX = {
    ".py": "py",
    ".js": "js",
    ".jsx": "js",
    ".ts": "ts",
    ".tsx": "ts",
    ".rs": "rs",
    ".go": "go",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".hh": "cpp",
}


def parse_file(path: pathlib.Path) -> ParsedFile:
    """Parse a source file and return extracted structural features."""
    language = _detect_language(path)
    code = path.read_text(encoding="utf-8", errors="ignore")
    parser = _PARSERS.get(language)
    if parser is None:
        imports, class_defs, func_defs, calls, complexity = [], [], [], [], 1
    else:
        imports, class_defs, func_defs, calls, complexity = parser(code)

    return ParsedFile(
        path=path,
        language=language,
        imports=imports,
        class_defs=class_defs,
        func_defs=func_defs,
        calls=_dedupe_preserve_order(calls),
        complexity=complexity,
        size=len(code),
        line_count=_count_lines(code),
    )


def parse_files(paths: Iterable[pathlib.Path]) -> list[ParsedFile]:
    """Parse a collection of files in sequence."""
    return [parse_file(path) for path in paths]


def _detect_language(path: pathlib.Path) -> str:
    """Detect canonical language key from path suffix."""
    return _LANGUAGE_BY_SUFFIX.get(path.suffix.lower(), "unknown")


def _count_lines(text: str) -> int:
    """Return logical line count."""
    if not text:
        return 0
    return text.count("\n") + (0 if text.endswith("\n") else 1)


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    """Deduplicate while preserving first-seen order."""
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def _parse_python(code: str) -> tuple[list[str], list[str], list[str], list[str], int]:
    imports: list[str] = []
    class_defs: list[str] = []
    func_defs: list[str] = []
    calls: list[str] = []
    complexity = 1

    for line in code.splitlines():
        if match := re.match(r"^\s*import\s+([\w\., ]+)", line):
            for module in match.group(1).split(","):
                imports.append(f"import {module.strip()}")
        if match := re.match(r"^\s*from\s+([.\w]+)\s+import", line):
            imports.append(f"from {match.group(1)} import")
        if match := re.match(r"^\s*class\s+(\w+)", line):
            class_defs.append(match.group(1))
        if match := re.match(r"^\s*def\s+(\w+)", line):
            func_defs.append(match.group(1))
        if re.search(r"\b(if|elif|for|while|try|except|match)\b", line):
            complexity += 1
        if match := re.search(r"\b([A-Za-z_]\w*)\s*\(", line):
            calls.append(match.group(1))

    return imports, class_defs, func_defs, calls, complexity


def _parse_js_ts(code: str) -> tuple[list[str], list[str], list[str], list[str], int]:
    imports: list[str] = []
    class_defs: list[str] = []
    func_defs: list[str] = []
    calls: list[str] = []
    complexity = 1

    for line in code.splitlines():
        if match := re.match(r"^\s*import\s+.*from\s+['\"](.+?)['\"]", line):
            imports.append(f"import {match.group(1)}")
        elif match := re.match(r"^\s*import\s+['\"](.+?)['\"]", line):
            imports.append(f"import {match.group(1)}")
        if match := re.search(r"require\(['\"](.+?)['\"]\)", line):
            imports.append(f"require({match.group(1)})")

        if match := re.match(r"^\s*class\s+([A-Za-z_]\w*)", line):
            class_defs.append(match.group(1))

        if match := re.match(r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_]\w*)", line):
            func_defs.append(match.group(1))

        # Arrow functions:
        # const fn = (...) => ...
        # const fn: Type = (...) => ...
        if match := re.match(
            r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>",
            line,
        ):
            func_defs.append(match.group(1))

        if re.search(r"\b(if|for|while|switch|try|catch)\b", line):
            complexity += 1
        if match := re.search(r"\b([A-Za-z_]\w*)\s*\(", line):
            calls.append(match.group(1))

    return imports, class_defs, func_defs, calls, complexity


def _parse_rust(code: str) -> tuple[list[str], list[str], list[str], list[str], int]:
    imports: list[str] = []
    class_defs: list[str] = []
    func_defs: list[str] = []
    calls: list[str] = []
    complexity = 1

    for line in code.splitlines():
        if match := re.match(r"^\s*use\s+([^;]+);", line):
            imports.append(f"use {match.group(1)}")
        if match := re.match(r"^\s*struct\s+([A-Za-z_]\w*)", line):
            class_defs.append(match.group(1))
        if match := re.match(r"^\s*(?:pub\s+)?fn\s+([A-Za-z_]\w*)", line):
            func_defs.append(match.group(1))
        if re.search(r"\b(if|for|while|match)\b", line):
            complexity += 1
        if match := re.search(r"\b([A-Za-z_]\w*)\s*\(", line):
            calls.append(match.group(1))

    return imports, class_defs, func_defs, calls, complexity


def _parse_go(code: str) -> tuple[list[str], list[str], list[str], list[str], int]:
    imports: list[str] = []
    class_defs: list[str] = []
    func_defs: list[str] = []
    calls: list[str] = []
    complexity = 1
    in_import_block = False

    for line in code.splitlines():
        stripped = line.strip()
        if stripped == "import (":
            in_import_block = True
            continue
        if in_import_block:
            if stripped == ")":
                in_import_block = False
                continue
            if match := re.match(r'^\s*(?:\w+\s+)?"(.+?)"', line):
                imports.append(f'import {match.group(1)}')
            continue
        if match := re.match(r'^\s*import\s+"(.+?)"', line):
            imports.append(f'import {match.group(1)}')
        if match := re.match(r"^\s*type\s+([A-Za-z_]\w*)\s+struct", line):
            class_defs.append(match.group(1))
        if match := re.match(r"^\s*func\s+(?:\([^)]*\)\s+)?([A-Za-z_]\w*)", line):
            func_defs.append(match.group(1))
        if re.search(r"\b(if|for|switch|select)\b", line):
            complexity += 1
        if match := re.search(r"\b([A-Za-z_]\w*)\s*\(", line):
            calls.append(match.group(1))

    return imports, class_defs, func_defs, calls, complexity


def _parse_java(code: str) -> tuple[list[str], list[str], list[str], list[str], int]:
    imports: list[str] = []
    class_defs: list[str] = []
    func_defs: list[str] = []
    calls: list[str] = []
    complexity = 1

    for line in code.splitlines():
        if match := re.match(r"^\s*import\s+([\w\.]+)\s*;", line):
            imports.append(f"import {match.group(1)};")
        if match := re.match(
            r"^\s*(?:public|private|protected)?\s*(?:abstract\s+|final\s+)?class\s+([A-Za-z_]\w*)",
            line,
        ):
            class_defs.append(match.group(1))
        if match := re.match(
            r"^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\(",
            line,
        ):
            name = match.group(1)
            if name not in {"if", "for", "while", "switch", "catch", "return", "new"}:
                func_defs.append(name)
        if re.search(r"\b(if|for|while|switch|try|catch)\b", line):
            complexity += 1
        if match := re.search(r"\b([A-Za-z_]\w*)\s*\(", line):
            calls.append(match.group(1))

    return imports, class_defs, func_defs, calls, complexity


def _parse_c_cpp(code: str) -> tuple[list[str], list[str], list[str], list[str], int]:
    imports: list[str] = []
    class_defs: list[str] = []
    func_defs: list[str] = []
    calls: list[str] = []
    complexity = 1

    for line in code.splitlines():
        if match := re.match(r'^\s*#include\s+[<"](.+?)[>"]', line):
            imports.append(f'#include "{match.group(1)}"')
        if match := re.match(r"^\s*(?:class|struct)\s+([A-Za-z_]\w*)", line):
            class_defs.append(match.group(1))
        if match := re.match(r"^\s*(?:[\w:*&<>\[\]]+\s+)+([A-Za-z_]\w*)\s*\([^;]*\)\s*[{]?$", line):
            name = match.group(1)
            if name not in {"if", "for", "while", "switch", "return", "else", "class", "struct", "typedef"}:
                func_defs.append(name)
        if re.search(r"\b(if|for|while|switch)\b", line):
            complexity += 1
        if match := re.search(r"\b([A-Za-z_]\w*)\s*\(", line):
            calls.append(match.group(1))

    return imports, class_defs, func_defs, calls, complexity


_PARSERS: dict[str, Callable[[str], tuple[list[str], list[str], list[str], list[str], int]]] = {
    "py": _parse_python,
    "js": _parse_js_ts,
    "ts": _parse_js_ts,
    "rs": _parse_rust,
    "go": _parse_go,
    "java": _parse_java,
    "c": _parse_c_cpp,
    "cpp": _parse_c_cpp,
}
