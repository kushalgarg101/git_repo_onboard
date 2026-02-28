import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2 } from "lucide-react";

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
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-4 border-b border-white/5">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-400" />
            Search
          </h3>
          <p className="text-sm text-zinc-400">Find files, symbols, and summaries across the graph.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keywords..."
            className="pl-9 bg-zinc-900/50 border-white/10 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-indigo-500"
            autoComplete="off"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{loading ? "Searching..." : "Status"}</span>
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          ) : (
            <span className="font-mono bg-zinc-900/50 px-2 py-0.5 rounded-full border border-white/5">
              {results.length} matches
            </span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-2">
        {results.length === 0 && !loading && query ? (
          <div className="p-4 text-center text-sm text-zinc-500 italic">No matches found.</div>
        ) : null}

        <div className="space-y-1">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              className="w-full text-left p-3 rounded-xl hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-white/5 group"
              onClick={() => onFocusNode(result.id)}
            >
              <div className="flex justify-between items-start gap-2 mb-1">
                <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-indigo-300 transition-colors">
                  {result.label || result.id}
                </span>
                <Badge variant="outline" className="text-[10px] capitalize shrink-0 border-white/10 bg-zinc-900 text-zinc-400">
                  {result.type}
                </Badge>
              </div>
              <span className="block text-xs font-mono text-zinc-500 truncate">
                {result.id}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
