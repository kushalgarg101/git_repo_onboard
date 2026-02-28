import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Route, Search, Navigation } from "lucide-react";

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
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-6 border-b border-white/5">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Route className="w-5 h-5 text-indigo-400" />
            Path Finder
          </h3>
          <p className="text-sm text-zinc-400">Compute the shortest connection between two nodes.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cg-path-from" className="text-zinc-300">Start Node</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  id="cg-path-from"
                  value={fromId}
                  onChange={(event) => onFromChange(event.target.value)}
                  list="path-node-options"
                  placeholder="Node id"
                  className="pl-8 bg-zinc-900/50 border-white/10 text-zinc-200 focus-visible:ring-indigo-500"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 border border-white/5"
                onClick={() => selectedNodeId && onFromChange(selectedNodeId)}
              >
                Use selected
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cg-path-to" className="text-zinc-300">End Node</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  id="cg-path-to"
                  value={toId}
                  onChange={(event) => onToChange(event.target.value)}
                  list="path-node-options"
                  placeholder="Node id"
                  className="pl-8 bg-zinc-900/50 border-white/10 text-zinc-200 focus-visible:ring-indigo-500"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 border border-white/5"
                onClick={() => selectedNodeId && onToChange(selectedNodeId)}
              >
                Use selected
              </Button>
            </div>
          </div>
        </div>

        <datalist id="path-node-options">
          {nodeIds.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>

        <Button
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
          onClick={() => onRunPath(fromId, toId)}
          disabled={!fromId || !toId || loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Calculating...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Navigation className="w-4 h-4" /> Find Path
            </span>
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4 bg-zinc-950/20">
        {pathResult?.path?.length ? (
          <div className="space-y-4">
            <div className="text-xs font-medium text-zinc-500 p-2 border-b border-white/5 flex justify-between items-center">
              <span>Shortest route found</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {pathResult.hops} hops
              </span>
            </div>

            <div className="space-y-2 relative before:absolute before:inset-y-0 before:left-3.5 before:w-px before:bg-white/10 before:z-0">
              {pathResult.path.map((step, index) => (
                <div key={step} className="relative z-10 flex items-center gap-3">
                  <div className="w-7 h-7 shrink-0 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-xs font-medium text-zinc-400 shadow-sm">
                    {index + 1}
                  </div>
                  <button
                    className="flex-1 text-left p-2.5 rounded-lg bg-zinc-900/50 hover:bg-zinc-800 transition-colors border border-transparent hover:border-white/5 font-mono text-xs text-zinc-300 truncate"
                    type="button"
                    onClick={() => onFocusNode(step)}
                  >
                    {step}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}
