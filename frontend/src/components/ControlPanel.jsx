export default function ControlPanel({
  repoUrl,
  onRepoUrlChange,
  granularity,
  onGranularityChange,
  withAi,
  onWithAiChange,
  aiApiKey,
  onAiApiKeyChange,
  aiBaseUrl,
  onAiBaseUrlChange,
  aiModel,
  onAiModelChange,
  onAnalyze,
  busy,
  graph,
}) {
  const aiValidation = validateAiConfig({
    withAi,
    aiApiKey,
    aiBaseUrl,
    aiModel,
  });

  return (
    <section className="cg-panel cg-controls">
      <h3>Analyze Repository</h3>
      <p className="cg-panel-subtitle">Run static analysis from a GitHub URL and explore file/class/function relationships.</p>

      <div className="cg-field-group">
        <label htmlFor="repo-url">Repository</label>
        <input
          id="repo-url"
          value={repoUrl}
          onChange={(event) => onRepoUrlChange(event.target.value)}
          placeholder="https://github.com/owner/repo or owner/repo"
        />
      </div>

      <div className="cg-field-group">
        <label htmlFor="granularity">Granularity</label>
        <select
          id="granularity"
          value={granularity}
          onChange={(event) => onGranularityChange(event.target.value)}
        >
          <option value="files">Files</option>
          <option value="classes">Files + Classes</option>
          <option value="functions">Files + Functions</option>
        </select>
      </div>

      <label className="cg-inline-checkbox" htmlFor="with-ai">
        <input
          id="with-ai"
          type="checkbox"
          checked={withAi}
          onChange={(event) => onWithAiChange(event.target.checked)}
        />
        <span>Enable AI summaries</span>
      </label>

      {withAi ? (
        <div className="cg-ai-settings">
          <div className="cg-field-group">
            <label htmlFor="ai-api-key">API Key</label>
            <input
              id="ai-api-key"
              type="password"
              value={aiApiKey}
              onChange={(event) => onAiApiKeyChange(event.target.value)}
              placeholder="sk-... (optional if backend env already set)"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="cg-field-group">
            <label htmlFor="ai-base-url">Base URL</label>
            <input
              id="ai-base-url"
              value={aiBaseUrl}
              onChange={(event) => onAiBaseUrlChange(event.target.value)}
              placeholder="https://api.openai.com/v1"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="cg-field-group">
            <label htmlFor="ai-model">Model</label>
            <input
              id="ai-model"
              value={aiModel}
              onChange={(event) => onAiModelChange(event.target.value)}
              placeholder="gpt-4o-mini"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {aiValidation.errors.length ? (
            <div className="cg-form-alert is-error" role="alert" aria-live="polite">
              {aiValidation.errors.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}

          {aiValidation.warnings.length ? (
            <div className="cg-form-alert is-warning" aria-live="polite">
              {aiValidation.warnings.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        className="cg-analyze-btn"
        type="button"
        onClick={onAnalyze}
        disabled={busy || !repoUrl.trim() || aiValidation.errors.length > 0}
        title={aiValidation.errors.length ? "Fix AI settings errors before running analysis." : ""}
      >
        {busy ? "Analyzing..." : "Run Analysis"}
      </button>

      <div className="cg-mini-stats">
        <div className="mini-stat">
          <span className="label">Nodes</span>
          <span className="value">{graph?.nodes?.length || 0}</span>
        </div>
        <div className="mini-stat">
          <span className="label">Links</span>
          <span className="value">{graph?.links?.length || 0}</span>
        </div>
      </div>
    </section>
  );
}

function validateAiConfig({ withAi, aiApiKey, aiBaseUrl, aiModel }) {
  const errors = [];
  const warnings = [];

  if (!withAi) {
    return { errors, warnings };
  }

  const apiKey = String(aiApiKey || "").trim();
  const baseUrl = String(aiBaseUrl || "").trim();
  const model = String(aiModel || "").trim();

  let parsedBaseUrl = null;
  if (baseUrl) {
    try {
      parsedBaseUrl = new URL(baseUrl);
      if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
        errors.push("AI Base URL must start with http:// or https://.");
      }
    } catch {
      errors.push("AI Base URL is not a valid URL.");
    }
  }

  const isLocalBaseUrl = parsedBaseUrl
    ? ["localhost", "127.0.0.1"].includes(parsedBaseUrl.hostname)
    : false;

  if (baseUrl && !isLocalBaseUrl && !apiKey) {
    errors.push("API Key is required when using a non-local AI Base URL.");
  }

  if (!apiKey && !baseUrl) {
    warnings.push("No AI credentials entered. Backend environment variables will be used.");
  }

  if (apiKey && apiKey.length < 8) {
    warnings.push("API Key looks too short. Double-check it.");
  }

  if (model && model.length < 3) {
    warnings.push("Model value looks too short. Verify the model name.");
  }

  return { errors, warnings };
}
