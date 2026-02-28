import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, PieChart, AlertTriangle } from "lucide-react";

export default function StatsPanel({ stats }) {
  if (!stats) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center text-zinc-500">
        <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-lg font-medium text-zinc-300 mb-2">Graph Statistics</h3>
        <p className="text-sm">Run an analysis to load graph-level telemetry.</p>
      </div>
    );
  }

  const topHotspots = stats.hotspots?.slice(0, 6) || [];
  const languageDist = Object.entries(stats.language_distribution || {}).sort((a, b) => b[1] - a[1]);
  const maxDegree = stats.max_degree ?? (stats.most_connected?.[0]?.degree || 0);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Graph Statistics
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatItem label="Total Nodes" value={stats.total_nodes} />
          <StatItem label="Total Links" value={stats.total_links} />
          <StatItem label="Orphans" value={stats.orphan_nodes} />
          <StatItem label="Max Degree" value={maxDegree} />
        </div>

        {topHotspots.length > 0 && (
          <div className="space-y-4 pt-2">
            <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2 border-b border-white/5 pb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Risk Hotspots
            </h4>
            <ul className="space-y-2">
              {topHotspots.map((item) => (
                <li key={item.id} className="flex justify-between items-center p-2 rounded-lg bg-zinc-900/40 border border-white/5">
                  <span className="font-mono text-xs text-zinc-300 truncate pr-4">{item.label || item.id}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    {item.risk_score ?? item.complexity ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {languageDist.length > 0 && (
          <div className="space-y-4 pt-2 mb-4">
            <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2 border-b border-white/5 pb-2">
              <PieChart className="w-4 h-4 text-emerald-500" />
              Language Distribution
            </h4>
            <div className="space-y-3 p-3 rounded-xl bg-zinc-900/40 border border-white/5">
              {languageDist.map(([lang, count]) => (
                <LanguageBar key={lang} lang={lang} count={count} total={stats.total_nodes || 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="flex flex-col p-3 bg-zinc-900/40 rounded-xl border border-white/5 gap-0.5">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <span className="text-xl font-mono text-zinc-200">{Number(value || 0)}</span>
    </div>
  );
}

function LanguageBar({ lang, count, total }) {
  const percent = Math.round((Number(count || 0) / Math.max(1, total)) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end text-xs">
        <span className="text-zinc-300 capitalize font-medium">{lang}</span>
        <span className="text-zinc-500 font-mono">{percent}%</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 overflow-hidden rounded-full">
        <div className="h-full bg-emerald-500/80" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
