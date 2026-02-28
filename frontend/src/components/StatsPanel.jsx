export default function StatsPanel({ stats }) {
  if (!stats) {
    return (
      <section className="cg-panel cg-stats-panel">
        <h3>Graph Statistics</h3>
        <p className="cg-muted">Run an analysis to load graph-level telemetry.</p>
        <div className="cg-empty-visual stats" />
      </section>
    );
  }

  const topHotspots = stats.hotspots?.slice(0, 6) || [];
  const languageDist = Object.entries(stats.language_distribution || {}).sort((a, b) => b[1] - a[1]);
  const maxDegree = stats.max_degree ?? (stats.most_connected?.[0]?.degree || 0);

  return (
    <section className="cg-panel cg-stats-panel">
      <h3>Graph Statistics</h3>

      <dl className="cg-stats-grid">
        <StatItem label="Total Nodes" value={stats.total_nodes} />
        <StatItem label="Total Links" value={stats.total_links} />
        <StatItem label="Orphans" value={stats.orphan_nodes} />
        <StatItem label="Max Degree" value={maxDegree} />
      </dl>

      <section className="cg-stats-section">
        <h4>Risk Hotspots</h4>
        <ul className="cg-hotspot-list">
          {topHotspots.map((item) => (
            <li key={item.id}>
              <span className="mono hotspot-name">{item.label || item.id}</span>
              <span className="hotspot-score">{item.risk_score ?? item.complexity ?? 0}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="cg-stats-section">
        <h4>Language Distribution</h4>
        <div className="cg-metrics-stack">
          {languageDist.map(([lang, count]) => (
            <LanguageBar key={lang} lang={lang} count={count} total={stats.total_nodes || 1} />
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
      <dd>{Number(value || 0)}</dd>
    </div>
  );
}

function LanguageBar({ lang, count, total }) {
  const percent = Math.round((Number(count || 0) / Math.max(1, total)) * 100);

  return (
    <div className="cg-metric-bar-group">
      <div className="bar-header">
        <span>{lang}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="bar-track">
        <div className="bar-fill info" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
