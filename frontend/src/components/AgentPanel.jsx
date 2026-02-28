import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Network, Search, Filter } from "lucide-react";

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
      <div className="flex flex-col h-full items-center justify-center p-6 text-center text-zinc-500">
        <Network className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-lg font-medium text-zinc-300 mb-2">No Agents Available</h3>
        <p className="text-sm">No agentic categories are available for this graph.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-6 border-b border-white/5">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            {category.label}
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Browse the {category.label.toLowerCase()} detected inside the active Agentic graph.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat term="Category Nodes" value={category.nodes?.length || 0} />
          <Stat term="Filtered Matches" value={filteredNodes.length} />
          <Stat term="Agentic Nodes" value={totalAgenticNodes} />
          <Stat term="Agentic Links" value={totalAgenticLinks} />
        </div>

        <div className="space-y-2">
          <label htmlFor="agent-query" className="text-sm font-medium text-zinc-300 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-zinc-500" /> Filter
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              id="agent-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search by id or summary...`}
              className="pl-9 bg-zinc-900/50 border-white/10 text-zinc-200 focus-visible:ring-indigo-500"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-2">
        {!filteredNodes.length ? (
          <div className="p-4 text-center text-sm text-zinc-500 italic">No matching nodes in this category.</div>
        ) : null}

        <div className="space-y-1">
          {filteredNodes.slice(0, 120).map((node) => (
            <button
              key={node.id}
              type="button"
              className="w-full text-left p-3 rounded-xl hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-white/5 group"
              onClick={() => onFocusNode(node.id)}
            >
              <div className="flex justify-between items-start gap-2 mb-1">
                <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-indigo-300 transition-colors">
                  {node.label || node.id}
                </span>
                <Badge variant="outline" className="text-[10px] capitalize shrink-0 border-white/10 bg-zinc-900 text-zinc-400">
                  {node.type}
                </Badge>
              </div>
              <span className="block text-xs font-mono text-zinc-500 truncate">
                {node.id}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function Stat({ term, value }) {
  return (
    <div className="flex flex-col p-3 bg-zinc-900/40 rounded-xl border border-white/5 gap-1">
      <span className="text-xs font-medium text-zinc-500 truncate">{term}</span>
      <span className="text-lg font-mono text-zinc-200">{Number(value || 0)}</span>
    </div>
  );
}
