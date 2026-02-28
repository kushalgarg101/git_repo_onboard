import { useEffect, useMemo, useState } from "react";
import AgentPanel from "./components/AgentPanel";
import ControlPanel from "./components/ControlPanel";
import NodePanel from "./components/NodePanel";
import PathPanel from "./components/PathPanel";
import SearchPanel from "./components/SearchPanel";
import StatsPanel from "./components/StatsPanel";
import StatusToast from "./components/StatusToast";
import TopBar from "./components/TopBar";
import TreeMap from "./components/charts/TreeMap";
import TopologyGraph from "./components/charts/TopologyGraph";
import { AGENT_TABS, deriveAgenticModel } from "./lib/agenticGraph";
import { useAppState } from "./state/useAppState";
import GraphScene from "./three/GraphScene";

const CODE_TABS = ["node", "stats", "search", "path"];
const CONTEXTS = [
  { id: "code", label: "Code" },
  { id: "agents", label: "Agents" },
];
const VIEW_MODES = [
  { id: "3d", label: "3D Graph" },
  { id: "treemap", label: "Treemap" },
  { id: "topology", label: "Topology" },
];

export default function App() {
  const [activeContext, setActiveContext] = useState("code");
  const [activeCodeTab, setActiveCodeTab] = useState("node");
  const [activeAgentTab, setActiveAgentTab] = useState(AGENT_TABS[0]?.id || "hooks");
  const [viewMode, setViewMode] = useState("3d");
  const [pathFromId, setPathFromId] = useState("");
  const [pathToId, setPathToId] = useState("");

  const {
    repoUrl,
    setRepoUrl,
    granularity,
    setGranularity,
    withAi,
    setWithAi,
    aiApiKey,
    setAiApiKey,
    aiBaseUrl,
    setAiBaseUrl,
    aiModel,
    setAiModel,
    sessionId,
    analysisState,
    analysisDetail,
    graph,
    stats,
    selectedNodeId,
    setSelectedNodeId,
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
  } = useAppState();

  const { categories: agentCategories, agenticGraph } = useMemo(
    () => deriveAgenticModel(graph),
    [graph]
  );
  const activeGraph = activeContext === "agents" ? agenticGraph : graph;
  const activeTabs = activeContext === "agents" ? AGENT_TABS : CODE_TABS.map((id) => ({ id, label: id }));
  const activeTab = activeContext === "agents" ? activeAgentTab : activeCodeTab;

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !activeGraph?.nodes?.length) return null;
    return activeGraph.nodes.find((node) => node.id === selectedNodeId) || null;
  }, [activeGraph, selectedNodeId]);

  useEffect(() => {
    if (!activeGraph?.nodes?.length) return;
    if (!activeGraph.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(activeGraph.nodes[0].id);
    }
  }, [activeGraph, selectedNodeId, setSelectedNodeId]);

  const highlightedNodeIds = useMemo(
    () => (activeContext === "code" ? (searchResults || []).slice(0, 120).map((result) => result.id) : []),
    [activeContext, searchResults]
  );

  const handleFocusNode = (nodeId, context = activeContext) => {
    if (context === "code") {
      setActiveContext("code");
      setActiveCodeTab("node");
    } else {
      setActiveContext("agents");
    }
    setSelectedNodeId(nodeId);
  };

  const handleSetPathFrom = (nodeId) => {
    setPathFromId(nodeId);
    setActiveContext("code");
    setActiveCodeTab("path");
  };

  const handleSetPathTo = (nodeId) => {
    setPathToId(nodeId);
    setActiveContext("code");
    setActiveCodeTab("path");
  };

  const handleClearPath = () => {
    clearPath();
    setPathFromId("");
    setPathToId("");
  };

  return (
    <div className="cg-shell">
      <div className="cg-atmosphere" aria-hidden="true" />

      <TopBar
        sessionId={sessionId}
        analysisState={analysisState}
        analysisDetail={analysisDetail}
        onClearPath={handleClearPath}
      />

      <main className="cg-main">
        <ControlPanel
          repoUrl={repoUrl}
          onRepoUrlChange={setRepoUrl}
          granularity={granularity}
          onGranularityChange={setGranularity}
          withAi={withAi}
          onWithAiChange={setWithAi}
          aiApiKey={aiApiKey}
          onAiApiKeyChange={setAiApiKey}
          aiBaseUrl={aiBaseUrl}
          onAiBaseUrlChange={setAiBaseUrl}
          aiModel={aiModel}
          onAiModelChange={setAiModel}
          onAnalyze={startRemoteAnalysis}
          busy={busy}
          graph={graph}
        />

        <section className="cg-viewport-panel">
          <div className="cg-viewport-toolbar">
            <div className="cg-viewport-meta">
              <span>Nodes: {activeGraph?.nodes?.length || 0}</span>
              <span>Links: {activeGraph?.links?.length || 0}</span>
            </div>
            <div className="cg-view-switcher">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={viewMode === mode.id ? "active" : ""}
                  onClick={() => setViewMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cg-viewport-content">
            {activeGraph?.nodes?.length ? (
              <>
                {viewMode === "3d" && (
                  <GraphScene
                    graph={activeGraph}
                    selectedNodeId={selectedNodeId}
                    highlightedNodeIds={highlightedNodeIds}
                    pathNodeIds={pathNodeIds}
                    onSelectNode={setSelectedNodeId}
                  />
                )}
                {viewMode === "treemap" && (
                  <TreeMap
                    graph={activeGraph}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                  />
                )}
                {viewMode === "topology" && (
                  <TopologyGraph
                    graph={activeGraph}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                  />
                )}
              </>
            ) : (
              <div className="cg-empty">
                <h2>{activeContext === "agents" ? "Agentic Graph" : "Repository Visualization"}</h2>
                <p className="cg-muted">
                  {graph
                    ? "No agentic entities detected yet. Try another repository or a deeper granularity."
                    : "Analyze a GitHub repository to generate an interactive code + agentic map."}
                </p>
              </div>
            )}
          </div>

          {busy ? (
            <div className="cg-busy-overlay">
              <div className="spinner" />
              <span>Running analysis...</span>
            </div>
          ) : null}
        </section>

        <aside className="cg-right-panel">
          <div className="cg-tabs cg-context-tabs">
            {CONTEXTS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={activeContext === entry.id ? "active" : ""}
                onClick={() => setActiveContext(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="cg-tabs">
            {activeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => {
                  if (activeContext === "agents") {
                    setActiveAgentTab(tab.id);
                  } else {
                    setActiveCodeTab(tab.id);
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="cg-tab-content">
            {activeContext === "code" && activeCodeTab === "node" ? (
              <NodePanel
                node={selectedNode}
                onSetPathFrom={handleSetPathFrom}
                onSetPathTo={handleSetPathTo}
              />
            ) : null}
            {activeContext === "code" && activeCodeTab === "stats" ? <StatsPanel stats={stats} /> : null}
            {activeContext === "code" && activeCodeTab === "search" ? (
              <SearchPanel
                onSearch={runSearch}
                results={searchResults}
                loading={searchLoading}
                onFocusNode={(nodeId) => handleFocusNode(nodeId, "code")}
              />
            ) : null}
            {activeContext === "code" && activeCodeTab === "path" ? (
              <PathPanel
                graph={graph}
                selectedNodeId={selectedNodeId}
                fromId={pathFromId}
                toId={pathToId}
                onFromChange={setPathFromId}
                onToChange={setPathToId}
                onRunPath={runPath}
                loading={pathLoading}
                pathResult={pathResult}
                onFocusNode={(nodeId) => handleFocusNode(nodeId, "code")}
              />
            ) : null}
            {activeContext === "agents" ? (
              <AgentPanel
                category={agentCategories.find((entry) => entry.id === activeAgentTab) || agentCategories[0]}
                totalAgenticNodes={agenticGraph?.nodes?.length || 0}
                totalAgenticLinks={agenticGraph?.links?.length || 0}
                onFocusNode={(nodeId) => handleFocusNode(nodeId, "agents")}
              />
            ) : null}
          </div>
        </aside>
      </main>

      <StatusToast tone={statusTone} message={statusMessage} />
    </div>
  );
}
