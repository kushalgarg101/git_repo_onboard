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

  return (
    <section className="cg-panel cg-path-panel">
      <h3>Path Finder</h3>
      <p className="cg-panel-subtitle">Compute the shortest connection between two nodes.</p>

      <div className="cg-field-group">
        <label htmlFor="cg-path-from">Start Node</label>
        <div className="cg-input-action-row">
          <input
            id="cg-path-from"
            value={fromId}
            onChange={(event) => onFromChange(event.target.value)}
            list="path-node-options"
            placeholder="Select or type node id"
          />
          <button
            className="cg-input-action"
            type="button"
            onClick={() => selectedNodeId && onFromChange(selectedNodeId)}
          >
            Use selected
          </button>
        </div>
      </div>

      <div className="cg-field-group">
        <label htmlFor="cg-path-to">End Node</label>
        <div className="cg-input-action-row">
          <input
            id="cg-path-to"
            value={toId}
            onChange={(event) => onToChange(event.target.value)}
            list="path-node-options"
            placeholder="Select or type node id"
          />
          <button
            className="cg-input-action"
            type="button"
            onClick={() => selectedNodeId && onToChange(selectedNodeId)}
          >
            Use selected
          </button>
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
      >
        {loading ? "Calculating..." : "Find Path"}
      </button>

      {pathResult?.path?.length ? (
        <div className="cg-path-visualization">
          <div className="path-meta">Shortest route: {pathResult.hops} hops</div>
          <div className="path-stepper">
            {pathResult.path.map((step, index) => (
              <div key={step} className="path-step">
                <div className="step-index">{index + 1}</div>
                <button className="step-btn mono" type="button" onClick={() => onFocusNode(step)}>
                  {step}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
