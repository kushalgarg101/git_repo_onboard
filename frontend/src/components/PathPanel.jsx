import { useMemo } from "react";

export default function PathPanel({
  graph,
  selectedNodeId,
  fromId,
  toId,
  onFromChange,
  onToChange,
  onRunPath,
  loading,
  pathResult,
  onFocusNode,
}) {
  const nodeIds = useMemo(() => (graph?.nodes || []).map((node) => node.id), [graph]);

  const useSelectedAsFrom = () => {
    if (selectedNodeId) onFromChange(selectedNodeId);
  };

  const useSelectedAsTo = () => {
    if (selectedNodeId) onToChange(selectedNodeId);
  };

  return (
    <section className="cg-panel cg-path-panel">
      <h3>Path Finder</h3>
      <p className="cg-muted" style={{ marginBottom: '20px', fontSize: '0.85rem' }}>Calculate the shortest relationship between two nodes.</p>

      <div className="cg-path-inputs">
        <div className="path-field">
          <label>Starting Point</label>
          <div className="cg-input-wrapper" style={{ position: 'relative' }}>
            <input
              value={fromId}
              onChange={(event) => onFromChange(event.target.value)}
              list="path-node-options"
              placeholder="Search or select node..."
            />
            <button className="in-input-btn" onClick={useSelectedAsFrom} title="Use Selected" style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cg-muted)' }}>
              🎯
            </button>
          </div>
        </div>

        <div className="path-field" style={{ marginTop: '12px' }}>
          <label>Destination</label>
          <div className="cg-input-wrapper" style={{ position: 'relative' }}>
            <input
              value={toId}
              onChange={(event) => onToChange(event.target.value)}
              list="path-node-options"
              placeholder="Search or select node..."
            />
            <button className="in-input-btn" onClick={useSelectedAsTo} title="Use Selected" style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cg-muted)' }}>
              🎯
            </button>
          </div>
        </div>
      </div>

      <datalist id="path-node-options">
        {nodeIds.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>

      <button
        className="cg-analyze-btn"
        type="button"
        onClick={() => onRunPath(fromId, toId)}
        disabled={!fromId || !toId || loading}
        style={{ marginTop: '24px' }}
      >
        {loading ? "Calculating..." : "Find Path"}
      </button>

      {pathResult?.path?.length ? (
        <div className="cg-path-visualization">
          <div className="path-meta">
            <span>Distance: <strong>{pathResult.hops} hops</strong></span>
          </div>
          <div className="path-stepper">
            {pathResult.path.map((step, idx) => (
              <div key={step} className="path-step">
                <div className="step-indicator">
                  <div className="dot" />
                  {idx < pathResult.path.length - 1 && <div className="line" />}
                </div>
                <button className="step-btn mono" type="button" onClick={() => onFocusNode(step)} style={{ fontSize: '0.75rem' }}>
                  {step}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pathResult && !pathResult.path?.length && (
        <div className="cg-path-empty">
          No direct or indirect connections found between these nodes.
        </div>
      )}
    </section>
  );
}
