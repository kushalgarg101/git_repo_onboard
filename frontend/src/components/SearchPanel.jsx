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
    }, 320);
    return () => clearTimeout(timeout);
  }, [onSearch, query]);

  return (
    <section className="cg-panel cg-search-panel">
      <h3>Search Entities</h3>
      <div className="cg-search-input-container">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search symbols, files, functions..."
          autoComplete="off"
        />
      </div>

      <div className="cg-search-status">
        {loading ? (
          <span className="scanning-text">Searching codebase...</span>
        ) : (
          <span className="results-count">
            Found {results.length} matches
          </span>
        )}
      </div>

      <ul className="cg-search-results">
        {results.length === 0 && !loading && query && (
          <li className="no-results error">No matches found</li>
        )}
        {results.map((result) => (
          <li key={result.id} className="search-result-item">
            <button type="button" onClick={() => onFocusNode(result.id)}>
              <div className="result-main">
                <span className="result-label">{result.label || result.id}</span>
                <span className="result-path mono">{result.id}</span>
              </div>
              <div className={`result-badge type-${result.type}`}>
                {result.type}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
