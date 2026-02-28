"""Graph analytics utilities for dashboard and search endpoints."""

from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any


def compute_stats(graph: dict) -> dict[str, Any]:
    """Compute graph-level analytics used by the API and frontend."""
    nodes = graph.get("nodes", [])
    links = graph.get("links", [])

    in_degree: dict[str, int] = defaultdict(int)
    out_degree: dict[str, int] = defaultdict(int)
    for link in links:
        source = link.get("source")
        target = link.get("target")
        if source is None or target is None:
            continue
        out_degree[source] += 1
        in_degree[target] += 1

    node_ids = {node.get("id") for node in nodes if node.get("id")}
    orphan_ids = sorted([node_id for node_id in node_ids if in_degree[node_id] == 0 and out_degree[node_id] == 0])
    degree = {node_id: in_degree[node_id] + out_degree[node_id] for node_id in node_ids}
    most_connected = sorted(degree.items(), key=lambda item: item[1], reverse=True)[:10]

    hotspots = sorted(nodes, key=_node_hotspot_score, reverse=True)[:10]
    group_health = _group_health(nodes)
    language_distribution = _language_distribution(nodes)
    freshness = _freshness_summary(nodes)

    return {
        "total_nodes": len(nodes),
        "total_links": len(links),
        "orphan_nodes": len(orphan_ids),
        "orphan_ids": orphan_ids[:20],
        "max_degree": max(degree.values(), default=0),
        "most_connected": [{"id": node_id, "degree": value} for node_id, value in most_connected],
        "hotspots": [
            {
                "id": node.get("id"),
                "label": node.get("label"),
                "type": node.get("type"),
                "issues": node.get("issues", 0),
                "complexity": node.get("complexity", 0),
                "churn": node.get("churn", 0),
                "contributors": node.get("contributors", 0),
                "risk_score": _node_hotspot_score(node),
            }
            for node in hotspots
        ],
        "group_health": group_health,
        "language_distribution": language_distribution,
        "freshness": freshness,
    }


def find_shortest_path(graph: dict, source: str, target: str) -> list[str] | None:
    """Run BFS shortest path search on an undirected graph projection."""
    node_ids = {node.get("id") for node in graph.get("nodes", []) if node.get("id")}
    if source not in node_ids or target not in node_ids:
        return None
    if source == target:
        return [source]

    adjacency: dict[str, list[str]] = defaultdict(list)
    for link in graph.get("links", []):
        src = link.get("source")
        dst = link.get("target")
        if not src or not dst:
            continue
        adjacency[src].append(dst)
        adjacency[dst].append(src)

    queue: deque[list[str]] = deque([[source]])
    visited: set[str] = {source}

    while queue:
        path = queue.popleft()
        current = path[-1]
        for neighbor in adjacency[current]:
            if neighbor in visited:
                continue
            candidate = [*path, neighbor]
            if neighbor == target:
                return candidate
            visited.add(neighbor)
            queue.append(candidate)
    return None


def search_nodes(graph: dict, query: str) -> list[dict]:
    """Case-insensitive fuzzy-ish search over node id/label/summary fields."""
    needle = query.strip().lower()
    if not needle:
        return []

    results: list[dict] = []
    for node in graph.get("nodes", []):
        node_id = str(node.get("id", "")).lower()
        label = str(node.get("label", "")).lower()
        summary = str(node.get("summary", "")).lower()
        score = 0
        if needle == label:
            score += 8
        if needle in label:
            score += 5
        if needle in node_id:
            score += 3
        if needle in summary:
            score += 2
        if score > 0:
            results.append({**node, "_search_score": score})

    results.sort(key=lambda item: item["_search_score"], reverse=True)
    return results[:50]


def _node_hotspot_score(node: dict) -> float:
    """Compute node risk score used for hotspot ranking."""
    issues = float(node.get("issues", 0))
    complexity = float(node.get("complexity", 0))
    churn = float(node.get("churn", 0))
    contributors = float(node.get("contributors", 0))
    # Lower contributor count can indicate ownership bottleneck, so invert it.
    contributor_penalty = 1.0 / max(contributors, 1.0)
    return round((issues * 10.0) + complexity + churn + (4.0 * contributor_penalty), 3)


def _group_health(nodes: list[dict]) -> dict[str, dict]:
    """Aggregate file-level health signals by top-level group."""
    grouped: dict[str, dict[str, float]] = defaultdict(
        lambda: {"files": 0.0, "issues": 0.0, "complexity": 0.0, "churn": 0.0}
    )
    for node in nodes:
        group = str(node.get("group", "root"))
        grouped[group]["files"] += 1
        grouped[group]["issues"] += float(node.get("issues", 0))
        grouped[group]["complexity"] += float(node.get("complexity", 0))
        grouped[group]["churn"] += float(node.get("churn", 0))

    health: dict[str, dict] = {}
    for group, values in grouped.items():
        file_count = max(values["files"], 1.0)
        risk = (values["issues"] * 10.0 + values["complexity"] + values["churn"]) / file_count
        health[group] = {
            "files": int(values["files"]),
            "avg_complexity": round(values["complexity"] / file_count, 2),
            "total_issues": int(values["issues"]),
            "total_churn": int(values["churn"]),
            "risk_score": round(risk, 2),
        }
    return health


def _language_distribution(nodes: list[dict]) -> dict[str, int]:
    """Return language distribution over node set."""
    counts: dict[str, int] = defaultdict(int)
    for node in nodes:
        language = str(node.get("language", "unknown"))
        counts[language] += 1
    return dict(counts)


def _freshness_summary(nodes: list[dict]) -> dict[str, int]:
    """Classify files by last-modified age buckets when timestamps exist."""
    now = datetime.now(tz=timezone.utc)
    buckets = {"lt_30d": 0, "d30_180": 0, "gt_180d": 0, "unknown": 0}
    for node in nodes:
        value = node.get("last_modified")
        if not value:
            buckets["unknown"] += 1
            continue
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            buckets["unknown"] += 1
            continue
        age_days = (now - parsed).days
        if age_days < 30:
            buckets["lt_30d"] += 1
        elif age_days <= 180:
            buckets["d30_180"] += 1
        else:
            buckets["gt_180d"] += 1
    return buckets
