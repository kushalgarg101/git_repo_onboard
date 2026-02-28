import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, FileCode, Clock, Users, ArrowRight, Code2, Info } from "lucide-react";
import Editor from "@monaco-editor/react";

export default function NodePanel({ node, onSetPathFrom, onSetPathTo }) {
  const [tab, setTab] = useState("code");

  useEffect(() => {
    if (node) {
      setTab("code");
    }
  }, [node?.id]);

  if (!node) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center text-zinc-500">
        <MapPin className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-lg font-medium text-zinc-300 mb-2">Select a Node</h3>
        <p className="text-sm">Click on any node in the graph to inspect its metadata and relationships.</p>
      </div>
    );
  }

  // Determine Monaco language based on node language or extension
  const getLanguage = () => {
    if (node.language) {
      const lang = node.language.toLowerCase();
      if (lang === "py") return "python";
      if (lang === "js") return "javascript";
      if (lang === "ts") return "typescript";
      return lang;
    }
    // fallback parsing out of the id (e.g., path/to/file.tsx)
    const parts = String(node.id).split(".");
    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
    if (ext === "py") return "python";
    if (ext === "js" || ext === "jsx") return "javascript";
    if (ext === "ts" || ext === "tsx") return "typescript";
    if (ext === "json") return "json";
    if (ext === "html") return "html";
    if (ext === "css") return "css";
    return "javascript"; // default fallback
  };

  const hasCode = !!node.content;

  return (
    <div className="flex flex-col h-full text-zinc-200">
      {/* 🏷️ Header */}
      <div className="p-4 border-b border-white/10 shrink-0 bg-zinc-950/40">
        <div className="flex justify-between items-start gap-2 mb-3">
          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 capitalize shrink-0">
            {node.type || "unknown"}
          </Badge>
          <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            <button
              className={`p-1.5 rounded-md transition-all ${tab === "info" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
              onClick={() => setTab("info")}
              title="Information"
            >
              <Info className="w-4 h-4" />
            </button>
            <button
              className={`p-1.5 rounded-md transition-all ${tab === "code" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
              onClick={() => setTab("code")}
              title="Source Code"
            >
              <Code2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-zinc-100 break-words leading-tight mb-1">
          {node.label || node.id}
        </h3>
        <p className="text-xs font-mono text-zinc-500 break-all">{node.id}</p>
      </div>

      {/* 📄 Content Area */}
      <div className="flex-1 min-h-0 relative">
        {tab === "info" && (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              <div className="flex gap-2 w-full">
                <Button variant="secondary" className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs h-8 text-zinc-300" onClick={() => onSetPathFrom(node.id)}>
                  Set as Start
                </Button>
                <Button variant="secondary" className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-xs h-8 text-zinc-300" onClick={() => onSetPathTo(node.id)}>
                  Set as End
                </Button>
              </div>

              <Card className="bg-zinc-900/40 border-white/5 rounded-xl shadow-none">
                <CardContent className="p-4 space-y-4">
                  <MetricBar label="Complexity" value={node.complexity} max={30} color="bg-amber-500" />
                  <MetricBar label="Churn" value={node.churn} max={60} color="bg-blue-500" />
                  <MetricBar label="Issues" value={node.issues} max={12} color="bg-red-500" />
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat icon={<FileCode />} term="Language" value={node.language} />
                <Stat icon={<ArrowRight />} term="Lines" value={node.line_count} />
                <Stat icon={<Users />} term="Authors" value={node.contributors} />
                <Stat icon={<Clock />} term="Updated" value={formatDate(node.last_modified)} />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-zinc-300">Summary</h4>
                <div className="text-sm leading-relaxed text-zinc-400 bg-zinc-900/30 p-3 rounded-xl border border-white/5">
                  {node.summary || "No automated summary available for this node."}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        {tab === "code" && (
          <div className="h-full w-full bg-[#1e1e1e]">
            {hasCode ? (
              <Editor
                height="100%"
                language={getLanguage()}
                theme="vs-dark"
                value={node.content}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  padding: { top: 16, bottom: 16 },
                  renderLineHighlight: "all",
                }}
              />
            ) : (
              <div className="flex flex-col h-full items-center justify-center p-6 text-center text-zinc-500">
                <Code2 className="w-8 h-8 mb-3 opacity-20" />
                <p className="text-sm">Source code is not available in the current graph context payload.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricBar({ label, value, max, color }) {
  const safeValue = Number(value || 0);
  const safeMax = Math.max(1, Number(max || 1));
  const percent = Math.min(100, (safeValue / safeMax) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end text-xs">
        <span className="text-zinc-400 font-medium">{label}</span>
        <span className="text-zinc-200 font-mono">{safeValue}</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 overflow-hidden rounded-full">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Stat({ icon, term, value }) {
  return (
    <div className="flex flex-col p-3 bg-zinc-900/40 rounded-xl border border-white/5 gap-1">
      <div className="flex items-center gap-1.5 text-zinc-500">
        <div className="[&>svg]:w-3 [&>svg]:h-3">{icon}</div>
        <span className="text-xs font-medium">{term}</span>
      </div>
      <span className="text-sm text-zinc-200 truncate">{String(value ?? "--")}</span>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "--";
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "--";
  }
}
