import { useMemo, useState } from "react";
import ControlPanel from "./components/ControlPanel";
import NodePanel from "./components/NodePanel";
import PathPanel from "./components/PathPanel";
import SearchPanel from "./components/SearchPanel";
import StatsPanel from "./components/StatsPanel";
import StatusToast from "./components/StatusToast";
import TopBar from "./components/TopBar";
import TreeMap from "./components/charts/TreeMap";
import TopologyGraph from "./components/charts/TopologyGraph";
import { useAppState } from "./state/useAppState";
import GraphScene from "./three/GraphScene";

const TABS = ["node", "stats", "search", "path"];

export default function App() {
  const [activeTab, setActiveTab] = useState("node");
  const [viewMode, setViewMode] = useState("3d"); // 3d, treemap, topology
  const [pathFromId, setPathFromId] = useState("");
  const [pathToId, setPathToId] = useState("");

  const {
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
  } = useAppState();

  const highlightedNodeIds = useMemo(
    () => (searchResults || []).slice(0, 120).map((result) => result.id),
    [searchResults]
  );

  const handleFocusNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    setActiveTab("node");
  };

  const handleSetPathFrom = (nodeId) => {
    setPathFromId(nodeId);
    setActiveTab("path");
  };

  const handleSetPathTo = (nodeId) => {
    setPathToId(nodeId);
    setActiveTab("path");
  };

  const handleTracePath = (fromId, toId) => {
    runPath(fromId, toId);
  };

  const handleClearPath = () => {
    clearPath();
    setPathFromId("");
    setPathToId("");
  };

  return (
    <div className="cg-shell">
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
          onAnalyze={startRemoteAnalysis}
          busy={busy}
          graph={graph}
        />

        <section className="cg-viewport-panel">
          <div className="cg-view-switcher">
            <button className={viewMode === '3d' ? 'active' : ''} onClick={() => setViewMode('3d')}>3D View</button>
            <button className={viewMode === 'treemap' ? 'active' : ''} onClick={() => setViewMode('treemap')}>Hierarchical</button>
            <button className={viewMode === 'topology' ? 'active' : ''} onClick={() => setViewMode('topology')}>Topology</button>
          </div>

          {graph ? (
            <>
              {viewMode === "3d" && (
                <GraphScene
                  graph={graph}
                  selectedNodeId={selectedNodeId}
                  highlightedNodeIds={highlightedNodeIds}
                  pathNodeIds={pathNodeIds}
                  onSelectNode={setSelectedNodeId}
                />
              )}
              {viewMode === "treemap" && (
                <TreeMap
                  graph={graph}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              )}
              {viewMode === "topology" && (
                <TopologyGraph
                  graph={graph}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              )}
            </>
          ) : (
            <div className="cg-empty">
              <h2>Awaiting Input</h2>
              <p className="cg-muted">Enter a repository URL to begin visualization.</p>
            </div>
          )}
          {busy ? <div className="cg-busy-overlay">Analyzing codebase...</div> : null}
        </section>

        <aside className="cg-right-panel">
          <div className="cg-tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="cg-tab-content">
            {activeTab === "node" ? (
              <NodePanel
                node={selectedNode}
                onSetPathFrom={handleSetPathFrom}
                onSetPathTo={handleSetPathTo}
              />
            ) : null}
            {activeTab === "stats" ? <StatsPanel stats={stats} /> : null}
            {activeTab === "search" ? (
              <SearchPanel
                onSearch={runSearch}
                results={searchResults}
                loading={searchLoading}
                onFocusNode={handleFocusNode}
              />
            ) : null}
            {activeTab === "path" ? (
              <PathPanel
                graph={graph}
                selectedNodeId={selectedNodeId}
                fromId={pathFromId}
                toId={pathToId}
                onFromChange={setPathFromId}
                onToChange={setPathToId}
                onRunPath={handleTracePath}
                loading={pathLoading}
                pathResult={pathResult}
                onFocusNode={handleFocusNode}
              />
            ) : null}
          </div>
        </aside>
      </main>

      <StatusToast tone={statusTone} message={statusMessage} />
    </div>
  );
}
