export default function StatsPanel({ stats }) {
  if (!stats) {
    return (
      <section className="cg-panel">
        <h3>System Overview</h3>
        <p className="cg-muted">Analysis telemetry will appear once the graph is generated.</p>
        <div className="cg-empty-visual stats" />
      </section>
    );
  }

  const topHotspots = stats.hotspots?.slice(0, 5) || [];
  const languageDist = Object.entries(stats.language_distribution || {}).sort((a, b) => b[1] - a[1]);

  return (
    <section className="cg-panel cg-stats-panel">
      <h3>System Overview</h3>
      <div className="cg-stats-grid">
        <StatItem label="Total Nodes" value={stats.total_nodes} />
        <StatItem label="Connections" value={stats.total_links} />
        <StatItem label="Decoupled" value={stats.orphan_nodes} />
        <StatItem label="Max Degree" value={stats.max_degree} />
      </div>

      <section style={{ marginTop: '32px' }}>
        <h3>Risk Hotspots</h3>
        <ul className="cg-search-results" style={{ margin: 0 }}>
          {topHotspots.map((item) => (
            <li key={item.id} className="search-result-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px', border: '1px solid var(--cg-panel-border)', borderRadius: 'var(--cg-radius-md)' }}>
                <span className="mono" style={{ fontSize: '0.8rem' }}>{item.label || item.id}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--cg-error)' }}>{item.risk_score ?? item.complexity}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h3>Language Distribution</h3>
        <div className="cg-metrics-stack">
          {languageDist.map(([lang, count]) => (
            <LanguageBar key={lang} lang={lang} count={count} total={stats.total_nodes} />
          ))}
        </div>
      </section>
    </section>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="cg-stat-item">
      <dt>{label}</dt>
      <dd>{value || 0}</dd>
    </div>
  );
}

function LanguageBar({ lang, count, total }) {
  const percent = Math.round((count / total) * 100);

  return (
    <div className="cg-metric-bar-group">
      <div className="bar-header">
        <span>{lang}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${percent}%`, background: 'var(--cg-info)' }} />
      </div>
    </div>
  );
}
