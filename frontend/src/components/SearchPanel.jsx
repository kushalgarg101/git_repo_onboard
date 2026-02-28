import { useEffect, useState } from "react";

export default function SearchPanel({ onSearch, results, loading, onFocusNode }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!query.trim()) {
      onSearch("");
      return undefined;
    }
    const timeout = setTimeout(() => {
      onSearch(query);
    }, 280);
    return () => clearTimeout(timeout);
  }, [onSearch, query]);

  return (
    <section className="cg-panel cg-search-panel">
      <h3>Search</h3>
      <p className="cg-panel-subtitle">Find files, symbols, and summaries across the active graph.</p>

      <div className="cg-field-group">
        <label htmlFor="cg-search">Query</label>
        <input
          id="cg-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a file name, class, function, or keyword"
          autoComplete="off"
        />
      </div>

      <div className="cg-search-status">
        {loading ? "Searching..." : `Matches: ${results.length}`}
      </div>

      <ul className="cg-search-results">
        {results.length === 0 && !loading && query ? (
          <li className="cg-empty-list">No matches found.</li>
        ) : null}

        {results.map((result) => (
          <li key={result.id} className="search-result-item">
            <button type="button" onClick={() => onFocusNode(result.id)}>
              <div className="result-main">
                <span className="result-label">{result.label || result.id}</span>
                <span className="result-path mono">{result.id}</span>
              </div>
              <span className={`result-badge type-${result.type}`}>{result.type}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
