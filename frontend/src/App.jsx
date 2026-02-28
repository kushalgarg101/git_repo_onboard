import { useCallback, useEffect, useMemo, useState } from "react";
import AgentPanel from "./components/AgentPanel";
import CodeModal from "./components/CodeModal";
import ControlPanel from "./components/ControlPanel";
import NodePanel from "./components/NodePanel";
import PathPanel from "./components/PathPanel";
import SearchPanel from "./components/SearchPanel";
import StatsPanel from "./components/StatsPanel";
import StatusToast from "./components/StatusToast";
import TopBar from "./components/TopBar";
import TreeMap from "./components/charts/TreeMap";
import TopologyGraph from "./components/charts/TopologyGraph";
import AnimatedBackground from "./components/AnimatedBackground";
import { AGENT_TABS, deriveAgenticModel } from "./lib/agenticGraph";
import { useAppState } from "./state/useAppState";

const CODE_TABS = ["node", "stats", "search", "path"];
const CONTEXTS = [
  { id: "code", label: "Code" },
  { id: "agents", label: "Agents" },
];
const VIEW_MODES = [
  { id: "topology", label: "Topology Graph" },
  { id: "treemap", label: "Tree Map" },
];

export default function App() {
  const [activeContext, setActiveContext] = useState("code");
  const [activeCodeTab, setActiveCodeTab] = useState("node");
  const [activeAgentTab, setActiveAgentTab] = useState(AGENT_TABS[0]?.id || "hooks");
  const [viewMode, setViewMode] = useState("topology");
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

  // 🎛️ Interaction State for Blueprint Features
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [showImports, setShowImports] = useState(true);
  const [showCalls, setShowCalls] = useState(true);

  // 🖥️ Floating Code Modal
  const [codeModalNode, setCodeModalNode] = useState(null);

  // Close modal on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") setCodeModalNode(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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

  const handleFocusNode = useCallback((nodeId, context = "code") => {
    if (context === "code") {
      setActiveContext("code");
      setActiveCodeTab("node");
    } else {
      setActiveContext("agents");
    }
    setSelectedNodeId(nodeId);

    // Open the floating code modal
    if (context === "code" && activeGraph?.nodes) {
      const node = activeGraph.nodes.find((n) => n.id === nodeId);
      if (node) setCodeModalNode(node);
    }
  }, [activeGraph, setSelectedNodeId]);

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
    <div className="cg-shell text-foreground font-sans">
      <AnimatedBackground />

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
          showImports={showImports}
          onShowImportsChange={setShowImports}
          showCalls={showCalls}
          onShowCallsChange={setShowCalls}
        />

        <section className="flex-1 relative flex flex-col min-w-0 z-10">
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-4 px-3 py-1.5 rounded-full bg-zinc-950/60 backdrop-blur-md border border-white/10 pointer-events-auto shadow-lg">
              <span className="text-xs font-medium text-zinc-400">Nodes: <span className="text-zinc-100">{activeGraph?.nodes?.length || 0}</span></span>
              <div className="w-px h-3 bg-white/20"></div>
              <span className="text-xs font-medium text-zinc-400">Links: <span className="text-zinc-100">{activeGraph?.links?.length || 0}</span></span>
            </div>
            <div className="flex items-center p-1 rounded-full bg-zinc-950/60 backdrop-blur-md border border-white/10 pointer-events-auto shadow-lg">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${viewMode === mode.id
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent"
                    }`}
                  onClick={() => setViewMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 relative bg-transparent">
            {activeGraph?.nodes?.length ? (
              <>

                {viewMode === "treemap" && (
                  <TreeMap
                    graph={activeGraph}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={(id) => {
                      if (id) handleFocusNode(id, "code");
                      else setSelectedNodeId(null);
                    }}
                  />
                )}
                {viewMode === "topology" && (
                  <TopologyGraph
                    graph={activeGraph}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={(id) => {
                      if (id) handleFocusNode(id, "code");
                      else setSelectedNodeId(null);
                    }}
                    hoveredNodeId={hoveredNodeId}
                    onHoverNode={setHoveredNodeId}
                    showImports={showImports}
                    showCalls={showCalls}
                  />
                )}
              </>
            ) : (
              <div className="cg-empty">
                <h2>{activeContext === "agents" ? "Agentic Graph" : "Agentic Code Graph"}</h2>
                <p className="cg-muted">
                  {graph
                    ? "No agentic entities detected yet. Try another repository or a deeper granularity."
                    : "Analyze a repository to generate an interactive Agentic Code Graph."}
                </p>
              </div>
            )}
          </div>

          {busy ? (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/60 backdrop-blur-sm">
              <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <span className="text-zinc-100 font-medium tracking-wide">Running analysis...</span>
            </div>
          ) : null}

          {/* 🖥️ Floating Code Modal */}
          <CodeModal node={codeModalNode} onClose={() => setCodeModalNode(null)} />
        </section>

        <aside className="w-[400px] flex flex-col bg-zinc-950/80 backdrop-blur-xl border-l border-white/10 shadow-[-8px_0_32px_-8px_rgba(0,0,0,0.5)] z-20">
          <div className="flex p-2 gap-1 border-b border-white/10 bg-zinc-950/40">
            {CONTEXTS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeContext === entry.id
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent"
                  }`}
                onClick={() => setActiveContext(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="flex p-2 gap-1 border-b border-white/5 bg-zinc-900/20 overflow-x-auto no-scrollbar">
            {activeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${activeTab === tab.id
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent"
                  }`}
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

          <div className="flex-1 overflow-hidden relative">
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
