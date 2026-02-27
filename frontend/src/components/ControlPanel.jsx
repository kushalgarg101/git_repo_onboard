export default function ControlPanel({
  repoUrl,
  onRepoUrlChange,
  granularity,
  onGranularityChange,
  withAi,
  onWithAiChange,
  onAnalyze,
  busy,
  graph,
}) {
  return (
    <section className="cg-panel cg-controls">
      <h3>Analyze Repository</h3>

      <div className="cg-field-group">
        <label htmlFor="repo-url">Repository URL</label>
        <div className="cg-input-wrapper">
          <input
            id="repo-url"
            value={repoUrl}
            onChange={(event) => onRepoUrlChange(event.target.value)}
            placeholder="e.g. https://github.com/owner/repo or owner/repo"
          />
        </div>
      </div>

      <div className="cg-field-group">
        <label htmlFor="granularity">Analysis Level</label>
        <select
          id="granularity"
          value={granularity}
          onChange={(event) => onGranularityChange(event.target.value)}
        >
          <option value="files">Standard (Files)</option>
          <option value="classes">Detailed (Classes)</option>
          <option value="functions">Deep (Functions)</option>
        </select>
      </div>

      <div className="cg-field-group">
        <label className="cg-inline-checkbox" htmlFor="with-ai" style={{ display: 'flex', gap: '10px', cursor: 'pointer', alignItems: 'center' }}>
          <div className="cg-checkbox-container">
            <input
              id="with-ai"
              type="checkbox"
              checked={withAi}
              onChange={(event) => onWithAiChange(event.target.checked)}
            />
            <div className="checkbox-visual" />
          </div>
          <div className="checkbox-text">
            <strong>Enable AI Insights</strong>
          </div>
        </label>
      </div>

      <button
        className="cg-analyze-btn"
        type="button"
        onClick={onAnalyze}
        disabled={busy || !repoUrl.trim()}
      >
        {busy ? (
          <span className="btn-content">Analyzing...</span>
        ) : (
          "Run Analysis"
        )}
      </button>

      {graph && (
        <div className="cg-mini-stats">
          <div className="mini-stat">
            <span className="label">Nodes</span>
            <span className="value">{graph.nodes?.length || 0}</span>
          </div>
          <div className="mini-stat">
            <span className="label">Links</span>
            <span className="value">{graph.links?.length || 0}</span>
          </div>
        </div>
      )}
    </section>
  );
}
