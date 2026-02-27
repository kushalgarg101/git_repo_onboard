import { useCallback, useEffect, useMemo, useState } from "react";
import { findPath, getAnalyzeStatus, getGraph, getStats, searchGraph, startAnalyze } from "../api/client";

const DEFAULT_LANGUAGES = ["py", "js", "ts", "rs", "go", "java", "c", "cpp"];
const STATUS_POLL_INTERVAL_MS = 1700;
const STATUS_MAX_POLLS = 360;

export function useAppState() {
  const [repoUrl, setRepoUrl] = useState("");
  const [granularity, setGranularity] = useState("files");
  const [withAi, setWithAi] = useState(false);

  const [sessionId, setSessionId] = useState(getSessionFromUrl());
  const [analysisState, setAnalysisState] = useState("idle");
  const [analysisDetail, setAnalysisDetail] = useState("");

  const [graph, setGraph] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState("");

  const [statusTone, setStatusTone] = useState("info");
  const [statusMessage, setStatusMessage] = useState("Ready");

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathResult, setPathResult] = useState(null);

  const [busy, setBusy] = useState(false);

  const nodeMap = useMemo(() => {
    const map = new Map();
    for (const node of graph?.nodes || []) {
      map.set(node.id, node);
    }
    return map;
  }, [graph]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;
  const pathNodeIds = pathResult?.path || [];

  useEffect(() => {
    if (!sessionId) return;
    loadSession(sessionId, { pollGraphIfPending: true });
  }, [sessionId]);

  useEffect(() => {
    if (!graph?.nodes?.length) return;
    if (!selectedNodeId || !nodeMap.has(selectedNodeId)) {
      setSelectedNodeId(graph.nodes[0].id);
    }
  }, [graph, nodeMap, selectedNodeId]);

  const loadSession = useCallback(
    async (id, { pollGraphIfPending }) => {
      setBusy(true);
      try {
        const graphData = await waitForGraph(id, pollGraphIfPending, setStatusMessage);
        setGraph(graphData);
        if (!selectedNodeId && graphData?.nodes?.length) {
          setSelectedNodeId(graphData.nodes[0].id);
        }

        try {
          const statsData = await getStats(id);
          setStats(statsData);
        } catch (error) {
          setStats(null);
          setStatusTone("error");
          setStatusMessage(error.message || "Unable to load graph stats");
        }

        setStatusTone("success");
        setStatusMessage("Graph loaded");
      } catch (error) {
        setStatusTone("error");
        setStatusMessage(error.message || "Unable to load graph");
      } finally {
        setBusy(false);
      }
    },
    [selectedNodeId]
  );

  const startRemoteAnalysis = useCallback(async () => {
    const normalizedRepoUrl = normalizeGitHubRepoInput(repoUrl);
    if (!normalizedRepoUrl || !normalizedRepoUrl.includes("github.com")) {
      setStatusTone("error");
      setStatusMessage("Enter a GitHub repository URL or owner/repo");
      return;
    }

    setBusy(true);
    setAnalysisState("pending");
    setAnalysisDetail("Queued");
    setStatusTone("info");
    setStatusMessage("Starting analysis...");

    try {
      const analysis = await startAnalyze({
        repoUrl: normalizedRepoUrl,
        granularity,
        withAi,
        languages: DEFAULT_LANGUAGES,
      });
      setSessionAndUrl(analysis.id, setSessionId);
      setPathResult(null);
      setSearchResults([]);
      await pollAnalysisUntilComplete(analysis.id, {
        onTick: (state, detail) => {
          setAnalysisState(state);
          setAnalysisDetail(detail || "");
          setStatusTone(state === "error" ? "error" : "info");
          setStatusMessage(`Analysis ${state}: ${detail || ""}`.trim());
        },
      });
      setAnalysisState("done");
      setAnalysisDetail("Complete");
      await loadSession(analysis.id, { pollGraphIfPending: false });
    } catch (error) {
      setAnalysisState("error");
      setAnalysisDetail(error.message || "Analysis failed");
      setStatusTone("error");
      setStatusMessage(error.message || "Analysis failed");
    } finally {
      setBusy(false);
    }
  }, [granularity, loadSession, repoUrl, withAi]);

  const runSearch = useCallback(
    async (query) => {
      if (!sessionId) return;
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const response = await searchGraph(sessionId, query.trim());
        setSearchResults(response.results || []);
      } catch (error) {
        setStatusTone("error");
        setStatusMessage(error.message || "Search failed");
      } finally {
        setSearchLoading(false);
      }
    },
    [sessionId]
  );

  const runPath = useCallback(
    async (fromId, toId) => {
      if (!sessionId || !fromId || !toId) return;
      setPathLoading(true);
      try {
        const response = await findPath(sessionId, fromId, toId);
        setPathResult(response);
        setStatusTone("success");
        setStatusMessage(`Path found with ${response.hops} hops`);
      } catch (error) {
        setPathResult(null);
        setStatusTone("error");
        setStatusMessage(error.message || "Path not found");
      } finally {
        setPathLoading(false);
      }
    },
    [sessionId]
  );

  const clearPath = useCallback(() => setPathResult(null), []);

  return {
    repoUrl,
    setRepoUrl,
    granularity,
    setGranularity,
    withAi,
    setWithAi,
    sessionId,
    analysisState,
    analysisDetail,
    graph,
    stats,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    statusTone,
    statusMessage,
    busy,
    startRemoteAnalysis,
    searchLoading,
    searchResults,
    runSearch,
    pathLoading,
    pathResult,
    pathNodeIds,
    runPath,
    clearPath,
  };
}

async function waitForGraph(sessionId, pollGraphIfPending, setStatusMessage) {
  let polls = 0;
  while (polls < STATUS_MAX_POLLS) {
    const graph = await getGraph(sessionId);
    if (!graph?.inProgress) {
      return graph;
    }
    if (!pollGraphIfPending) {
      throw new Error("Graph not available yet");
    }
    polls += 1;
    setStatusMessage("Preparing graph...");
    await sleep(STATUS_POLL_INTERVAL_MS);
  }
  throw new Error("Timed out waiting for graph");
}

async function pollAnalysisUntilComplete(sessionId, { onTick }) {
  for (let attempt = 0; attempt < STATUS_MAX_POLLS; attempt += 1) {
    const status = await getAnalyzeStatus(sessionId);
    onTick(status.status, status.detail);
    if (status.status === "done") {
      return;
    }
    if (status.status === "error") {
      throw new Error(status.detail || "Analysis failed");
    }
    await sleep(STATUS_POLL_INTERVAL_MS);
  }
  throw new Error("Timed out waiting for analysis");
}

function getSessionFromUrl() {
  const query = new URLSearchParams(window.location.search);
  return query.get("session") || "";
}

function setSessionAndUrl(sessionId, setter) {
  setter(sessionId);
  const query = new URLSearchParams(window.location.search);
  query.set("session", sessionId);
  window.history.replaceState(null, "", `/?${query.toString()}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeGitHubRepoInput(value) {
  const input = value.trim();
  if (!input) return "";

  // Support git@github.com:owner/repo.git format directly.
  if (/^git@github\.com:/i.test(input)) {
    return input;
  }

  if (/^[\w.-]+\/[\w.-]+$/.test(input)) {
    return `https://github.com/${input}`;
  }

  let candidate = input;
  if (input.startsWith("github.com/")) {
    candidate = `https://${input}`;
  }

  if (!/^https?:\/\//i.test(candidate)) {
    return input;
  }

  try {
    const url = new URL(candidate);
    if (!/github\.com$/i.test(url.hostname)) {
      return input;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return input;
    }
    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/i, "");
    return `https://github.com/${owner}/${repo}`;
  } catch {
    return input;
  }
}
