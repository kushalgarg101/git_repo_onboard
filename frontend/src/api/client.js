/**
 * API client wrappers for CodeGraph backend endpoints.
 *
 * All methods return parsed JSON on success and throw normalized Error objects
 * on failure so UI layers can render consistent messages.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "";
const DEFAULT_TIMEOUT_MS = 45000;

export async function startAnalyze({ repoUrl, granularity, withAi, languages, ai }) {
  return requestJSON("/analyze", {
    method: "POST",
    body: JSON.stringify({
      repo_url: repoUrl,
      granularity,
      with_ai: withAi,
      languages,
      ai: withAi ? ai || null : null,
    }),
  });
}

export async function getAnalyzeStatus(sessionId) {
  return requestJSON(`/analyze/status/${encodeURIComponent(sessionId)}`, { method: "GET" });
}

export async function getGraph(sessionId) {
  const response = await request(`/graph/${encodeURIComponent(sessionId)}`, { method: "GET" });
  if (response.status === 202) {
    return { inProgress: true };
  }
  return parseJSON(response);
}

export async function getStats(sessionId) {
  return requestJSON(`/graph/${encodeURIComponent(sessionId)}/stats`, { method: "GET" });
}

export async function searchGraph(sessionId, query) {
  const params = new URLSearchParams({ q: query });
  return requestJSON(`/graph/${encodeURIComponent(sessionId)}/search?${params.toString()}`, {
    method: "GET",
  });
}

export async function findPath(sessionId, fromId, toId) {
  const params = new URLSearchParams({ from: fromId, to: toId });
  return requestJSON(`/graph/${encodeURIComponent(sessionId)}/path?${params.toString()}`, {
    method: "GET",
  });
}

async function request(path, init, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    throw normalizeError(error);
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJSON(path, init, timeoutMs) {
  const response = await request(path, init, timeoutMs);
  return parseJSON(response);
}

async function parseJSON(response) {
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const detail = payload?.detail || payload?.message || `HTTP ${response.status}`;
    const error = new Error(detail);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function normalizeError(error) {
  if (error?.name === "AbortError") {
    const timeoutError = new Error("Request timed out");
    timeoutError.code = "timeout";
    return timeoutError;
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error("Unexpected network error");
}
