"""FastAPI application factory and HTTP endpoints.

The API is intentionally simple:
- submit analysis jobs (local path or GitHub URL),
- poll status,
- retrieve graph and derived analytics.
"""

from __future__ import annotations

import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from github_viz.api.schemas import AnalyzeLocalRequest, AnalyzeRequest
from github_viz.api.state import SessionStore
from github_viz.analysis.graph import analyze_repo
from github_viz.analysis.stats import compute_stats, find_shortest_path, search_nodes
from github_viz.config import Settings, get_settings
from github_viz.logging_config import configure_logging

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application instance."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(title=settings.app_name, version=settings.app_version)
    app.state.settings = settings
    app.state.sessions = SessionStore(max_sessions=settings.max_sessions)
    app.state.executor = ThreadPoolExecutor(max_workers=settings.analysis_workers)
    app.state.started_at = time.time()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_timing_middleware(request: Request, call_next):
        """Capture request timing and add response timing headers."""
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        t0 = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        response.headers["x-request-id"] = request_id
        response.headers["x-process-time-ms"] = f"{elapsed_ms:.2f}"
        logger.info(
            "request_id=%s method=%s path=%s status=%d duration_ms=%.2f",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response

    @app.get("/health")
    def health() -> dict:
        """Return liveness and in-memory session metrics."""
        uptime_s = round(time.time() - app.state.started_at, 2)
        return {
            "status": "ok",
            "uptime_s": uptime_s,
            "sessions": app.state.sessions.session_count(),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def _analysis_worker(
        session_id: str,
        *,
        path: str | None,
        repo_url: str | None,
        granularity: str,
        languages: list[str],
        with_ai: bool,
    ) -> None:
        """Run analysis in background and persist status/results."""
        app.state.sessions.set_status(session_id, "running", "Analyzing repository")
        try:
            graph = analyze_repo(
                path=path,
                repo_url=repo_url,
                granularity=granularity,
                languages=languages,
                with_ai=with_ai,
            )
            graph["meta"]["session_id"] = session_id
            app.state.sessions.set_graph(session_id, graph)
            app.state.sessions.set_status(session_id, "done", "Complete")
        except Exception as exc:
            logger.exception("Analysis failed for session_id=%s", session_id)
            app.state.sessions.set_status(session_id, "error", str(exc))

    @app.post("/analyze")
    def analyze(req: AnalyzeRequest):
        """Start background analysis for a GitHub repository URL."""
        session_id = str(uuid.uuid4())
        app.state.sessions.set_status(session_id, "pending", "Queued")
        app.state.executor.submit(
            _analysis_worker,
            session_id,
            path=None,
            repo_url=req.repo_url,
            granularity=req.granularity,
            languages=req.languages,
            with_ai=req.with_ai,
        )
        return {"id": session_id, "status": "pending"}

    @app.post("/analyze/local")
    def analyze_local(req: AnalyzeLocalRequest):
        """Run local-path analysis synchronously for quick local feedback."""
        session_id = str(uuid.uuid4())
        app.state.sessions.set_status(session_id, "running", "Analyzing repository")
        try:
            graph = analyze_repo(
                path=req.path,
                repo_url=None,
                granularity=req.granularity,
                languages=req.languages,
                with_ai=req.with_ai,
            )
        except FileNotFoundError as exc:
            app.state.sessions.set_status(session_id, "error", str(exc))
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            logger.exception("Local analysis failed for path=%s", req.path)
            app.state.sessions.set_status(session_id, "error", str(exc))
            raise HTTPException(status_code=500, detail=str(exc))

        graph["meta"]["session_id"] = session_id
        app.state.sessions.set_graph(session_id, graph)
        app.state.sessions.set_status(session_id, "done", "Complete")
        return {"id": session_id, "status": "done"}

    @app.get("/analyze/status/{session_id}")
    def analysis_status(session_id: str):
        """Return current analysis status for a session."""
        status = app.state.sessions.get_status(session_id)
        if status is None:
            raise HTTPException(status_code=404, detail="session not found")
        body = {"id": session_id, "status": status.status, "detail": status.detail}
        graph = app.state.sessions.get_graph(session_id)
        if status.status == "done" and graph:
            body["nodes"] = len(graph.get("nodes", []))
            body["links"] = len(graph.get("links", []))
        return body

    @app.get("/sessions")
    def list_sessions():
        """List cached graph sessions."""
        return {"sessions": app.state.sessions.list_sessions()}

    @app.get("/graph/{session_id}")
    def get_graph(session_id: str):
        """Return graph JSON for a completed session."""
        graph = app.state.sessions.get_graph(session_id)
        if graph is not None:
            return graph
        status = app.state.sessions.get_status(session_id)
        if status and status.status in {"pending", "running"}:
            raise HTTPException(status_code=202, detail="Analysis in progress")
        raise HTTPException(status_code=404, detail="session not found")

    @app.get("/graph/{session_id}/stats")
    def get_stats(session_id: str):
        """Return computed analytics for the graph."""
        graph = app.state.sessions.get_graph(session_id)
        if graph is None:
            raise HTTPException(status_code=404, detail="session not found")
        return compute_stats(graph)

    @app.get("/graph/{session_id}/search")
    def search(session_id: str, q: str = Query(..., min_length=1)):
        """Search node ids, labels, and summaries."""
        graph = app.state.sessions.get_graph(session_id)
        if graph is None:
            raise HTTPException(status_code=404, detail="session not found")
        return {"query": q, "results": search_nodes(graph, q)}

    @app.get("/graph/{session_id}/path")
    def shortest_path(
        session_id: str,
        source: str = Query(..., alias="from"),
        target: str = Query(..., alias="to"),
    ):
        """Find shortest path between two node IDs."""
        graph = app.state.sessions.get_graph(session_id)
        if graph is None:
            raise HTTPException(status_code=404, detail="session not found")
        path = find_shortest_path(graph, source, target)
        if path is None:
            raise HTTPException(status_code=404, detail="No path found between the given nodes")
        return {"source": source, "target": target, "path": path, "hops": len(path) - 1}

    try:
        app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
    except Exception:
        @app.get("/", response_class=HTMLResponse)
        def fallback_ui():
            """Serve lightweight fallback UI if the built frontend is missing."""
            return _fallback_html()

    return app


def _fallback_html() -> str:
    """Return minimal HTML fallback UI served directly by FastAPI."""
    return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CodeGraph 3D</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #05060a; color: #f2f4f8; }
      #app { display: grid; grid-template-columns: 320px 1fr; height: 100vh; }
      #sidebar { padding: 20px; background: #0e1117; border-right: 1px solid #1f2633; overflow-y: auto; }
      #viewport { position: relative; }
      input, select, button { width: 100%; padding: 10px; margin-top: 8px; background: #111826; border: 1px solid #1f2633; color: #f2f4f8; border-radius: 6px; box-sizing: border-box; }
      button { background: #ff6a3d; color: #0a0d12; font-weight: bold; cursor: pointer; }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      .muted { color: #9aa4b2; font-size: 13px; }
      .status { margin-top: 12px; padding: 8px; background: #111826; border-radius: 6px; font-size: 13px; }
      @media (max-width: 900px) { #app { grid-template-columns: 1fr; grid-template-rows: auto 1fr; } #sidebar { border-right: none; border-bottom: 1px solid #1f2633; } }
    </style>
  </head>
  <body>
    <div id="app">
      <div id="sidebar">
        <h2>CodeGraph 3D</h2>
        <div class="muted">No build found. Using fallback UI.</div>
        <label>GitHub URL</label>
        <input id="repoUrl" placeholder="https://github.com/user/repo" />
        <label>Granularity</label>
        <select id="granularity">
          <option value="files">Files</option>
          <option value="classes">Files + Classes</option>
          <option value="functions">Files + Functions</option>
        </select>
        <label><input type="checkbox" id="withAi" /> Enable AI summaries</label>
        <button id="analyzeBtn">Analyze</button>
        <div id="statusBox" class="status" style="display:none;"></div>
        <div id="session" class="muted"></div>
      </div>
      <div id="viewport"></div>
    </div>
    <script type="module">
      import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
      import { OrbitControls } from 'https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js';

      const viewport = document.getElementById('viewport');
      const repoUrlInput = document.getElementById('repoUrl');
      const granularityInput = document.getElementById('granularity');
      const withAiInput = document.getElementById('withAi');
      const analyzeBtn = document.getElementById('analyzeBtn');
      const sessionEl = document.getElementById('session');
      const statusBox = document.getElementById('statusBox');

      const params = new URLSearchParams(window.location.search);
      const session = params.get('session');
      if (session) loadGraph(session);

      analyzeBtn.addEventListener('click', async () => {
        const repo_url = repoUrlInput.value.trim();
        if (!repo_url) return;
        analyzeBtn.disabled = true;
        statusBox.style.display = 'block';
        statusBox.textContent = 'Starting analysis...';

        const res = await fetch('/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo_url,
            granularity: granularityInput.value,
            with_ai: withAiInput.checked,
            languages: ['py','js','ts','rs']
          })
        });
        const data = await res.json();
        if (data.id) {
          history.replaceState(null, '', `/?session=${data.id}`);
          pollStatus(data.id);
        }
      });

      async function pollStatus(id) {
        const poll = setInterval(async () => {
          try {
            const res = await fetch(`/analyze/status/${id}`);
            const st = await res.json();
            statusBox.textContent = `Status: ${st.status} — ${st.detail || ''}`;
            if (st.status === 'done') {
              clearInterval(poll);
              analyzeBtn.disabled = false;
              loadGraph(id);
            } else if (st.status === 'error') {
              clearInterval(poll);
              analyzeBtn.disabled = false;
              statusBox.textContent = `Error: ${st.detail}`;
            }
          } catch(e) {
            clearInterval(poll);
            analyzeBtn.disabled = false;
          }
        }, 2000);
      }

      async function loadGraph(id) {
        sessionEl.textContent = `Session: ${id}`;
        statusBox.style.display = 'block';
        statusBox.textContent = 'Loading graph...';
        const res = await fetch(`/graph/${id}`);
        if (res.status === 202) {
          statusBox.textContent = 'Analysis still running...';
          setTimeout(() => loadGraph(id), 2000);
          return;
        }
        const graph = await res.json();
        statusBox.textContent = `Nodes: ${(graph.nodes||[]).length} · Links: ${(graph.links||[]).length}`;
        render(graph);
      }

      function render(graph) {
        viewport.innerHTML = '';
        const width = viewport.clientWidth;
        const height = viewport.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#05060a');
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
        camera.position.set(0, 0, 120);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        viewport.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        const nodes = graph.nodes || [];
        const links = graph.links || [];
        const geometry = new THREE.SphereGeometry(1, 16, 16);
        const group = new THREE.Group();
        const positions = new Map();

        nodes.forEach((node, i) => {
          const angle = i * 0.35;
          const radius = 30 + (i % 20);
          const y = (i % 15) * 2 - 15;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const color = heatColor(node.issues || 0);
          const size = Math.max(0.8, Math.min(4, (node.complexity || 1) / 4));
          const material = new THREE.MeshBasicMaterial({ color });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.scale.set(size, size, size);
          mesh.position.set(x, y, z);
          group.add(mesh);
          positions.set(node.id, mesh.position);
        });

        const lineMat = new THREE.LineBasicMaterial({ color: 0x3b3f4a, transparent: true, opacity: 0.6 });
        links.forEach((link) => {
          const start = positions.get(link.source);
          const end = positions.get(link.target);
          if (!start || !end) return;
          const points = [start, end];
          const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(lineGeo, lineMat);
          group.add(line);
        });

        scene.add(group);
        const animate = () => {
          controls.update();
          renderer.render(scene, camera);
          requestAnimationFrame(animate);
        };
        animate();
        window.addEventListener('resize', () => {
          const w = viewport.clientWidth;
          const h = viewport.clientHeight;
          renderer.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        });
      }

      function heatColor(value) {
        const v = Math.max(0, Math.min(10, value));
        const t = v / 10;
        const r = Math.floor(60 + 195 * t);
        const g = Math.floor(80 - 40 * t);
        const b = Math.floor(160 - 120 * t);
        return new THREE.Color(`rgb(${r},${g},${b})`);
      }
    </script>
  </body>
</html>"""
