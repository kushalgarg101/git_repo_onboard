export default function TopBar({ sessionId, analysisState, analysisDetail, onClearPath }) {
  const isRunning = analysisState === "running" || analysisState === "pending";

  return (
    <header className="cg-topbar">
      <div className="cg-brand">
        <div className="cg-brand-mark" aria-hidden="true">
          <div className="mark-core" />
        </div>
        <div>
          <h1>CodeGraph</h1>
          <p>Visualizing software topology</p>
        </div>
      </div>
      <div className="cg-topbar-right">
        {sessionId && (
          <div className="cg-status-capsule">
            <span className="capsule-label">Session:</span>
            <span className="capsule-value mono">{sessionId.slice(0, 8)}</span>
          </div>
        )}
        <div className={`cg-status-capsule state-${analysisState || "idle"}`}>
          <div className="status-dot" />
          <span className="capsule-value">{analysisState || "Ready"}</span>
        </div>
        <button className="cg-ghost-btn" onClick={onClearPath} type="button">
          Reset view
        </button>
      </div>
      {analysisDetail && (
        <div className="cg-analysis-ticker">
          <span className="ticker-label">Progress:</span>
          <span className="ticker-content">{analysisDetail}</span>
        </div>
      )}
    </header>
  );
}
