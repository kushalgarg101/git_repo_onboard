import { useEffect, useMemo, useState } from "react";

export default function AgentPanel({ category, totalAgenticNodes, totalAgenticLinks, onFocusNode }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery("");
  }, [category?.id]);

  const filteredNodes = useMemo(() => {
    const nodes = category?.nodes || [];
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return nodes;
    }
    return nodes.filter((node) => {
      const content = `${node.id} ${node.label || ""} ${node.summary || ""}`.toLowerCase();
      return content.includes(needle);
    });
  }, [category, query]);

  if (!category) {
    return (
      <section className="cg-panel cg-agent-panel">
        <h3>Agents</h3>
        <p className="cg-muted">No agentic categories are available for this graph.</p>
      </section>
    );
  }

  return (
    <section className="cg-panel cg-agent-panel">
      <h3>{category.label}</h3>
      <p className="cg-panel-subtitle">
        Browse the {category.label.toLowerCase()} detected inside the active Agentic graph.
      </p>

      <dl className="cg-stats-grid">
        <Stat term="Category Nodes" value={category.nodes?.length || 0} />
        <Stat term="Filtered Matches" value={filteredNodes.length} />
        <Stat term="Agentic Nodes" value={totalAgenticNodes} />
        <Stat term="Agentic Links" value={totalAgenticLinks} />
      </dl>

      <div className="cg-field-group">
        <label htmlFor="agent-query">Filter</label>
        <input
          id="agent-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${category.label.toLowerCase()} by id or summary`}
          autoComplete="off"
        />
      </div>

      <ul className="cg-search-results agent-results">
        {!filteredNodes.length ? (
          <li className="cg-empty-list">No matching nodes in this category.</li>
        ) : null}
        {filteredNodes.slice(0, 120).map((node) => (
          <li key={node.id} className="search-result-item">
            <button type="button" onClick={() => onFocusNode(node.id)}>
              <div className="result-main">
                <span className="result-label">{node.label || node.id}</span>
                <span className="result-path mono">{node.id}</span>
              </div>
              <span className={`result-badge type-${node.type}`}>{node.type}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ term, value }) {
  return (
    <div className="cg-stat-item">
      <dt>{term}</dt>
      <dd>{Number(value || 0)}</dd>
    </div>
  );
}
