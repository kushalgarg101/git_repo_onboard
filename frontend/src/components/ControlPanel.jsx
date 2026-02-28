import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { AlertCircle, Play, Settings2 } from "lucide-react";

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
    <Card className="w-80 rounded-none border-y-0 border-l-0 border-r border-white/10 bg-zinc-950/60 backdrop-blur-xl flex flex-col h-full shadow-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-indigo-400" />
          Analyze Repo
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Run static analysis from a GitHub URL to explore relationships.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2 pb-2">
        <div className="space-y-2">
          <Label htmlFor="repo-url" className="text-zinc-300">Repository URL</Label>
          <Input
            id="repo-url"
            value={repoUrl}
            onChange={(event) => onRepoUrlChange(event.target.value)}
            placeholder="owner/repo"
            className="bg-zinc-900/50 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="granularity" className="text-zinc-300">Granularity</Label>
          <Select value={granularity} onValueChange={onGranularityChange}>
            <SelectTrigger id="granularity" className="bg-zinc-900/50 border-white/10 text-zinc-100 focus:ring-indigo-500">
              <SelectValue placeholder="Select granularity" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10 text-zinc-200">
              <SelectItem value="files">Files</SelectItem>
              <SelectItem value="classes">Files + Classes</SelectItem>
              <SelectItem value="functions">Files + Functions</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 bg-zinc-900/30 p-3 rounded-lg border border-white/5">
          <input
            id="with-ai"
            type="checkbox"
            checked={withAi}
            onChange={(event) => onWithAiChange(event.target.checked)}
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-950"
          />
          <Label htmlFor="with-ai" className="text-sm font-medium text-zinc-300 cursor-pointer">
            Enable AI summarization
          </Label>
        </div>

        {withAi && (
          <div className="space-y-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
            <div className="space-y-2">
              <Label htmlFor="ai-api-key" className="text-xs text-indigo-200/70">API Key</Label>
              <Input
                id="ai-api-key"
                type="password"
                value={aiApiKey}
                onChange={(event) => onAiApiKeyChange(event.target.value)}
                placeholder="sk-... (optional if env set)"
                autoComplete="off"
                spellCheck={false}
                className="bg-zinc-900/80 border-indigo-500/20 text-indigo-100 focus-visible:ring-indigo-500 h-8 text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-base-url" className="text-xs text-indigo-200/70">Base URL</Label>
              <Input
                id="ai-base-url"
                value={aiBaseUrl}
                onChange={(event) => onAiBaseUrlChange(event.target.value)}
                placeholder="https://api.openai.com/v1"
                autoComplete="off"
                spellCheck={false}
                className="bg-zinc-900/80 border-indigo-500/20 text-indigo-100 focus-visible:ring-indigo-500 h-8 text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model" className="text-xs text-indigo-200/70">Model</Label>
              <Input
                id="ai-model"
                value={aiModel}
                onChange={(event) => onAiModelChange(event.target.value)}
                placeholder="gpt-4o-mini"
                autoComplete="off"
                spellCheck={false}
                className="bg-zinc-900/80 border-indigo-500/20 text-indigo-100 focus-visible:ring-indigo-500 h-8 text-xs"
              />
            </div>

            {aiValidation.errors.length > 0 && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md space-y-1">
                {aiValidation.errors.map((item) => (
                  <p key={item} className="text-xs text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {item}
                  </p>
                ))}
              </div>
            )}

            {aiValidation.warnings.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md space-y-1">
                {aiValidation.warnings.map((item) => (
                  <p key={item} className="text-xs text-amber-400 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {item}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-4 border-t border-white/10 pt-4 bg-zinc-950/40">
        <Button
          onClick={onAnalyze}
          disabled={busy || !repoUrl.trim() || aiValidation.errors.length > 0}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/20"
          size="lg"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Play className="w-4 h-4 fill-current" />
              Run Analysis
            </span>
          )}
        </Button>

        <div className="flex w-full justify-between px-2 text-xs">
          <div className="flex flex-col items-center">
            <span className="text-zinc-500 font-medium">Nodes</span>
            <span className="text-zinc-200 font-mono text-sm">{graph?.nodes?.length || 0}</span>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex flex-col items-center">
            <span className="text-zinc-500 font-medium">Links</span>
            <span className="text-zinc-200 font-mono text-sm">{graph?.links?.length || 0}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
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
    warnings.push("No credentials. Backend env vars will be used.");
  }

  if (apiKey && apiKey.length < 8) {
    warnings.push("API Key looks too short.");
  }

  if (model && model.length < 3) {
    warnings.push("Model name looks too short.");
  }

  return { errors, warnings };
}
