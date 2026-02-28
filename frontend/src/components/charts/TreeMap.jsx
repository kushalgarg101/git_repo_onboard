import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function TreeMap({ graph, selectedNodeId, onSelectNode }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !graph?.nodes?.length) return undefined;

    const container = containerRef.current;
    container.innerHTML = "";

    const width = Math.max(container.clientWidth, 640);
    const height = Math.max(container.clientHeight, 440);

    const rootData = buildHierarchy(graph.nodes);

    const root = d3
      .hierarchy(rootData)
      .sum((node) => Number(node.line_count || node.size || 1))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3
      .treemap()
      .size([width, height])
      .paddingOuter(6)
      .paddingTop(24)
      .paddingInner(2)
      .round(true)(root);

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("class", "cg-treemap-svg");

    // Add gradients for a glassmorphic/premium shine on tiles
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "tile-shine")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "rgba(255,255,255,0.15)");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "rgba(255,255,255,0)");

    // Add shadow filter
    const filter = defs.append("filter").attr("id", "drop-shadow").attr("x", "-10%").attr("y", "-10%").attr("width", "130%").attr("height", "130%");
    filter.append("feDropShadow").attr("dx", "2").attr("dy", "4").attr("stdDeviation", "4").attr("flood-opacity", "0.3");

    const leaves = svg
      .append("g")
      .attr("class", "cg-treemap-leaves")
      .selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      // Add simple enter transition
      .style("opacity", 0)
      .transition()
      .duration(500)
      .delay((d, i) => i * 3)
      .style("opacity", 1)
      .selection(); // retrieve selection after transition

    // Base color
    leaves
      .append("rect")
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("fill", (d) => tileColor(d.data))
      .attr("stroke", (d) => (d.data.id === selectedNodeId ? "#ffffff" : "rgba(255, 255, 255, 0.1)"))
      .attr("stroke-width", (d) => (d.data.id === selectedNodeId ? 2.5 : 1))
      .style("filter", "url(#drop-shadow)")
      .attr("class", "cursor-pointer transition-all duration-200 hover:brightness-125")
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelectNode(d.data.id);
      });

    // Overlay shine
    leaves
      .append("rect")
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("fill", "url(#tile-shine)")
      .attr("pointer-events", "none");

    // Labels
    leaves
      .append("text")
      .attr("x", 8)
      .attr("y", 18)
      .text((d) => ((d.x1 - d.x0 > 50 && d.y1 - d.y0 > 24) ? getShortLabel(d.data.name) : ""))
      .attr("class", "text-[11px] font-medium fill-white pointer-events-none drop-shadow-md truncate")
      .style("opacity", (d) => d.data.id === selectedNodeId ? 1 : 0.9);

    // Group headers (Folders)
    svg
      .append("g")
      .attr("class", "cg-treemap-groups pointer-events-none")
      .selectAll("text")
      .data(root.descendants().filter((d) => d.depth > 0 && d.children))
      .join("text")
      .attr("x", (d) => d.x0 + 6)
      .attr("y", (d) => d.y0 + 16)
      .attr("class", "text-[10px] font-bold fill-zinc-400 uppercase tracking-wider drop-shadow-lg")
      .text((d) => ((d.x1 - d.x0 > 80 ? d.data.name : "")));

    return undefined;
  }, [graph, onSelectNode]); // 🛑 Removed selectedNodeId so the treemap only builds once

  // 🎨 Separate effect just for visual highlights without rebuilding the hierarchy
  useEffect(() => {
    if (!containerRef.current) return;
    const svg = d3.select(containerRef.current).select("svg");
    if (svg.empty()) return;

    svg.selectAll(".cg-treemap-leaves rect.cursor-pointer")
      .attr("stroke", (d) => (d.data.id === selectedNodeId ? "#ffffff" : "rgba(255, 255, 255, 0.1)"))
      .attr("stroke-width", (d) => (d.data.id === selectedNodeId ? 2.5 : 1));

    svg.selectAll(".cg-treemap-leaves text")
      .style("opacity", (d) => d.data.id === selectedNodeId ? 1 : 0.9);

  }, [selectedNodeId]);

  return (
    <div className="absolute inset-0 z-0 h-full w-full">
      <div className="absolute inset-0" ref={containerRef} />
      <div className="absolute bottom-6 left-6 flex items-center gap-4 px-4 py-2 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 shadow-lg pointer-events-none z-10 text-xs font-medium text-zinc-300 select-none">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ background: "rgba(59, 130, 246, 0.8)" }} />Low Risk</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(236,72,153,0.6)]" style={{ background: "rgba(236, 72, 153, 0.8)" }} />High Risk</span>
      </div>
    </div>
  );
}

function buildHierarchy(nodes) {
  const root = { name: "root", children: [] };

  for (const node of nodes) {
    const parts = String(node.id || "unknown").split("/");
    let cursor = root;

    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        cursor.children.push({
          ...node,
          name: part,
        });
        return;
      }

      let existing = cursor.children.find((entry) => entry.name === part && entry.children);
      if (!existing) {
        existing = { name: part, children: [] };
        cursor.children.push(existing);
      }
      cursor = existing;
    });
  }

  return root;
}

function tileColor(node) {
  const churn = Number(node.churn || 0);
  const issues = Number(node.issues || 0);
  const size = Number(node.line_count || node.size || 0);

  let stress = 0;
  if (churn > 0 || issues > 0) {
    stress = Math.min(1, Math.max(0, (churn + issues * 5) / 100));
  } else {
    stress = Math.min(1, Math.max(0, size / 1000));
  }

  // Deep indigo/blue to vibrant pink/purple
  return d3.interpolateRgb("rgba(59, 130, 246, 0.4)", "rgba(236, 72, 153, 0.8)")(stress);
}

function getShortLabel(label) {
  const parts = String(label).split("/");
  return parts[parts.length - 1];
}
