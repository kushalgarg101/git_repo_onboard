import { useMemo } from "react";

export default function NodePanel({ node, onSetPathFrom, onSetPathTo }) {
  if (!node) {
    return (
      <section className="cg-panel">
        <h3>Node Details</h3>
        <p className="cg-muted">Select an entity in the graph to view details.</p>
        <div className="cg-empty-visual" />
      </section>
    );
  }

  return (
    <section className="cg-panel cg-node-panel">
      <header className="cg-panel-header">
        <div className={`node-type-icon type-${node.type}`}>{node.type?.[0]?.toUpperCase()}</div>
        <div>
          <h3>{node.label || node.id}</h3>
          <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--cg-muted)', wordBreak: 'break-all' }}>{node.id}</p>
        </div>
      </header>

      <div className="cg-metrics-stack">
        <MetricBar label="Complexity" value={node.complexity} max={25} />
        <MetricBar label="Maintainability" value={node.churn} max={50} />
        <MetricBar label="Active Issues" value={node.issues} max={10} />
      </div>

      <dl className="cg-stats-grid" style={{ marginTop: '24px' }}>
        <Stat term="Language" value={node.language} />
        <Stat term="Lines" value={node.line_count} />
        <Stat term="Authors" value={node.contributors} />
        <Stat term="Updated" value={_formatDate(node.last_modified)} />
      </dl>

      <div style={{ margin: '20px 0' }}>
        <label>Summary</label>
        <p style={{ fontSize: '0.85rem', color: 'var(--cg-text)', lineHeight: '1.6' }}>
          {node.summary || "No automated summary available for this node."}
        </p>
      </div>

      <div className="cg-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: 'auto' }}>
        <button className="cg-ghost-btn" style={{ border: '1px solid var(--cg-panel-border)' }} type="button" onClick={() => onSetPathFrom(node.id)}>
          Set as Start
        </button>
        <button className="cg-ghost-btn" style={{ border: '1px solid var(--cg-panel-border)' }} type="button" onClick={() => onSetPathTo(node.id)}>
          Set as Target
        </button>
      </div>
    </section>
  );
}

function MetricBar({ label, value, max }) {
  const percent = Math.min(100, (value / max) * 100);

  return (
    <div className="cg-metric-bar-group">
      <div className="bar-header">
        <span>{label}</span>
        <strong>{value}</strong>
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

function _formatDate(iso) {
  if (!iso) return "N/A";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return "N/A";
  }
}
