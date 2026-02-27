"""Command-line interface for CodeGraph 3D."""

from __future__ import annotations

import json
import logging
import socket
import threading
import time
import webbrowser
from typing import Optional

import requests
import typer
import uvicorn

from github_viz.analysis.graph import analyze_repo
from github_viz.config import get_settings
from github_viz.logging_config import configure_logging
from github_viz.server import create_app

logger = logging.getLogger(__name__)
app = typer.Typer(add_completion=False, no_args_is_help=True)


def _find_free_port(preferred: int) -> int:
    """Return preferred port if available, otherwise pick an ephemeral port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            sock.bind(("127.0.0.1", 0))
            return int(sock.getsockname()[1])


def _open_browser(url: str) -> None:
    """Best-effort browser open without hard failing CLI execution."""
    try:
        webbrowser.open(url, new=2)
    except Exception:
        logger.debug("Failed to open browser for url=%s", url, exc_info=True)


def _parse_languages(raw: str) -> list[str]:
    """Parse comma-separated language list."""
    return [item.strip() for item in raw.split(",") if item.strip()]


@app.command()
def analyze(
    path: Optional[str] = typer.Option(None, "--path", help="Local repository path"),
    repo_url: Optional[str] = typer.Option(None, "--repo-url", help="GitHub repository URL"),
    granularity: str = typer.Option("files", "--granularity", help="files|classes|functions"),
    languages: str = typer.Option("py,js,ts,rs", "--languages", help="Comma-separated language codes"),
    with_ai: bool = typer.Option(False, "--with-ai", help="Enable AI summaries"),
    ui: bool = typer.Option(False, "--ui", help="Start local API+UI and open browser"),
    open_browser: bool = typer.Option(True, "--open/--no-open", help="Open browser automatically"),
) -> None:
    """Run repository analysis and print graph JSON, or launch UI mode."""
    configure_logging(get_settings().log_level)

    if not path and not repo_url:
        typer.echo("Provide --path or --repo-url", err=True)
        raise typer.Exit(2)
    if path and repo_url:
        typer.echo("Provide only one of --path or --repo-url", err=True)
        raise typer.Exit(2)

    options = {
        "granularity": granularity,
        "languages": _parse_languages(languages),
        "with_ai": with_ai,
    }

    if ui:
        port = _find_free_port(get_settings().port)
        api_app = create_app()
        config = uvicorn.Config(api_app, host="127.0.0.1", port=port, log_level="info")
        server = uvicorn.Server(config)

        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        time.sleep(0.5)

        url = f"http://127.0.0.1:{port}/analyze/local" if path else f"http://127.0.0.1:{port}/analyze"
        payload = {"path": path, **options} if path else {"repo_url": repo_url, **options}
        try:
            response = requests.post(url, json=payload, timeout=600)
            response.raise_for_status()
            session_id = response.json()["id"]
        except Exception as exc:
            typer.echo(f"Failed to start analysis: {exc}", err=True)
            raise typer.Exit(1)

        ui_url = f"http://127.0.0.1:{port}/?session={session_id}"
        if open_browser:
            _open_browser(ui_url)
        typer.echo(f"UI: {ui_url}")
        typer.echo(f"Session: {session_id}")
        return

    try:
        graph = analyze_repo(path=path, repo_url=repo_url, **options)
    except FileNotFoundError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(2)
    typer.echo(json.dumps(graph, indent=2))


@app.command()
def serve(
    port: int = typer.Option(get_settings().port, "--port", help="API port"),
) -> None:
    """Start the FastAPI server."""
    configure_logging(get_settings().log_level)
    uvicorn.run(create_app(), host=get_settings().host, port=port, log_level="info")


if __name__ == "__main__":
    app()
