export default function TopBar({ sessionId, analysisState, analysisDetail, onClearPath }) {
  const phase = analysisState || "idle";
  const detail = analysisDetail || phaseLabel(phase);

  return (
    <header className="cg-topbar">
      <div className="cg-brand">
        <div className="cg-brand-mark" aria-hidden="true">
          <div className="mark-core" />
        </div>
        <div className="cg-brand-copy">
          <h1>CodeGraph + Agentic</h1>
          <p>Analyze code graph and agentic graph in one workspace</p>
        </div>
      </div>

      <div className="cg-topbar-right">
        <div className="cg-status-capsule mono" title={sessionId || "No active session"}>
          <span className="capsule-label">Session</span>
          <span className="capsule-value">{sessionId ? sessionId.slice(0, 12) : "--"}</span>
        </div>

        <div className={`cg-status-capsule state-${phase}`}>
          <span className="status-dot" />
          <span className="capsule-value">{phaseLabel(phase)}</span>
        </div>

        <button className="cg-ghost-btn" type="button" onClick={onClearPath}>
          Clear Path
        </button>
      </div>

      <div className="cg-analysis-ticker" aria-live="polite">
        <span className="ticker-label">Status</span>
        <span className="ticker-content">{detail}</span>
      </div>
    </header>
  );
}

function phaseLabel(state) {
  switch (state) {
    case "pending":
      return "Queued";
    case "running":
      return "Running";
    case "done":
      return "Ready";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}
