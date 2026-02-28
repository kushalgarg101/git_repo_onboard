import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, LayoutDashboard, Terminal } from "lucide-react";

export default function TopBar({ sessionId, analysisState, analysisDetail, onClearPath }) {
  const phase = analysisState || "idle";
  const detail = analysisDetail || phaseLabel(phase);

  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-3 bg-zinc-950/50 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
          <LayoutDashboard className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
            Agentic <span className="text-zinc-500 font-normal">Code Graph</span>
          </h1>
          <p className="text-xs text-zinc-400 font-medium">Unified workspace for code structure and agentic analysis</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {sessionId && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900/50 border border-zinc-800">
            <Terminal className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-mono text-zinc-300">{sessionId.slice(0, 12)}</span>
          </div>
        )}

        <Badge
          variant={phase === "error" ? "destructive" : phase === "running" ? "default" : "secondary"}
          className={`capitalize flex items-center gap-1.5 ${phase === "running" ? "bg-indigo-500 hover:bg-indigo-600" : ""}`}
        >
          {phase === "running" && <Activity className="w-3 h-3 animate-pulse" />}
          {phaseLabel(phase)}
        </Badge>

        <Button variant="ghost" size="sm" onClick={onClearPath} className="text-zinc-400 hover:text-zinc-100">
          Clear Path
        </Button>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
    </header>
  );
}

function phaseLabel(state) {
  switch (state) {
    case "pending":
      return "Queued";
    case "running":
      return "Running";
    case "done":
      return "Ready";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}
