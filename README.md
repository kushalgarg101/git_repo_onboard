# CodeGraph

CodeGraph analyzes repositories and renders a navigable graph of files, classes, and functions with optional GitHub and AI enrichment.

## Features

- Multi-language parsing: Python, JavaScript/TypeScript, Rust, Go, Java, C/C++
- Granularity modes: `files`, `classes`, `functions`
- GitHub enrichment: issue mentions, churn, contributors, freshness
- Optional LLM file summaries via OpenAI-compatible endpoints
- FastAPI backend with async analysis status polling
- React + Three.js frontend
- Graph analytics APIs: stats, search, shortest path

## Repository Layout

```text
src/github_viz/
  api/            # API schemas and runtime session store
  analysis/       # parsing, graph construction, metadata, analytics
  cli.py          # CLI commands
  server.py       # FastAPI application factory
tests/            # unit and integration tests
frontend/         # Vite + React + Three.js UI
```

## Prerequisites

- Python `>=3.12`
- `uv` package manager
- Node.js `>=18` for frontend dev mode

## Quick Start

1. Install dependencies:

```bash
uv sync --group dev
```

2. Analyze local repo and print JSON:

```bash
uv run main.py analyze --path ./some-repo
```

3. Run API:

```bash
uv run main.py serve --port 8000
```

4. Run frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Environment Variables

- `GITHUB_TOKEN` or `GITHUB_PAT` for GitHub API enrichment
- `OPENAI_API_KEY` for AI summaries
- `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`, supports local endpoints)
- `CODEGRAPH_MAX_SESSIONS` (default: `50`)
- `CODEGRAPH_ANALYSIS_WORKERS` (default: `4`)
- `CODEGRAPH_LOG_LEVEL` (default: `INFO`)

## API Endpoints

- `GET /health`
- `POST /analyze`
- `POST /analyze/local`
- `GET /analyze/status/{session_id}`
- `GET /sessions`
- `GET /graph/{session_id}`
- `GET /graph/{session_id}/stats`
- `GET /graph/{session_id}/search?q=...`
- `GET /graph/{session_id}/path?from=...&to=...`

## Testing

```bash
uv run -m pytest
```

## CLI

```bash
uv run main.py analyze --path ./repo --granularity files --languages py,js,ts,rs
uv run main.py analyze --repo-url https://github.com/huggingface/transformers --ui
uv run main.py serve --port 8000
```
