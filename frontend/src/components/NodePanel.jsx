export default function NodePanel({ node, onSetPathFrom, onSetPathTo }) {
  if (!node) {
    return (
      <section className="cg-panel cg-node-panel">
        <h3>Node Details</h3>
        <p className="cg-muted">Select a node in the graph to inspect its metadata and relationships.</p>
        <div className="cg-empty-visual" />
      </section>
    );
  }

  return (
    <section className="cg-panel cg-node-panel">
      <header className="cg-panel-header">
        <div className={`node-type-icon type-${node.type}`}>{node.type?.[0]?.toUpperCase()}</div>
        <div className="cg-panel-title-group">
          <h3>{node.label || node.id}</h3>
          <p className="mono cg-node-id">{node.id}</p>
        </div>
      </header>

      <div className="cg-metrics-stack">
        <MetricBar label="Complexity" value={node.complexity} max={30} />
        <MetricBar label="Churn" value={node.churn} max={60} />
        <MetricBar label="Issues" value={node.issues} max={12} />
      </div>

      <dl className="cg-stats-grid">
        <Stat term="Language" value={node.language || "--"} />
        <Stat term="Lines" value={node.line_count ?? "--"} />
        <Stat term="Authors" value={node.contributors ?? "--"} />
        <Stat term="Updated" value={formatDate(node.last_modified)} />
      </dl>

      <div className="cg-summary-block">
        <label>Summary</label>
        <p>{node.summary || "No automated summary available for this node."}</p>
      </div>

      <div className="cg-actions">
        <button className="cg-ghost-btn" type="button" onClick={() => onSetPathFrom(node.id)}>
          Set as Start
        </button>
        <button className="cg-ghost-btn" type="button" onClick={() => onSetPathTo(node.id)}>
          Set as End
        </button>
      </div>
    </section>
  );
}

function MetricBar({ label, value, max }) {
  const safeValue = Number(value || 0);
  const safeMax = Math.max(1, Number(max || 1));
  const percent = Math.min(100, (safeValue / safeMax) * 100);

  return (
    <div className="cg-metric-bar-group">
      <div className="bar-header">
        <span>{label}</span>
        <strong>{safeValue}</strong>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Stat({ term, value }) {
  return (
    <div className="cg-stat-item">
      <dt>{term}</dt>
      <dd>{String(value ?? "--")}</dd>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "N/A";
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "N/A";
  }
}
