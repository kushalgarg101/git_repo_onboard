import { useEffect, useRef } from "react";
import * as d3 from "d3";

const MAX_NODES = 350;
const MAX_LINKS = 1000;

export default function TopologyGraph({ graph, selectedNodeId, onSelectNode }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !graph?.nodes?.length) return undefined;

    const container = containerRef.current;
    container.innerHTML = "";

    const width = Math.max(container.clientWidth, 640);
    const height = Math.max(container.clientHeight, 440);

    const nodes = [...graph.nodes]
      .sort((a, b) => Number(b.complexity || 0) - Number(a.complexity || 0))
      .slice(0, MAX_NODES)
      .map((node) => ({ ...node }));

    const nodeIds = new Set(nodes.map((node) => node.id));
    const links = (graph.links || [])
      .filter((link) => nodeIds.has(link.source) && nodeIds.has(link.target))
      .slice(0, MAX_LINKS)
      .map((link) => ({ ...link }));

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("class", "cg-topology-svg");

    // Defs for glowing effects and shadows
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const stage = svg.append("g");

    const zoom = d3.zoom().scaleExtent([0.15, 6]).on("zoom", (event) => {
      stage.attr("transform", event.transform);
    });

    svg.call(zoom);

    // Initial transform to center graph a bit better
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8).translate(-width / 2, -height / 2));

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(70).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.06))
      .force("y", d3.forceY(height / 2).strength(0.06))
      .force("collide", d3.forceCollide().radius((d) => nodeRadius(d) + 12).iterations(3));

    const link = stage
      .append("g")
      .attr("class", "cg-topology-links")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", (d) =>
        linkEndpointId(d.source) === selectedNodeId || linkEndpointId(d.target) === selectedNodeId
          ? "rgba(45, 212, 191, 0.9)" // Teal-400
          : "rgba(100, 116, 139, 0.25)" // Slate-500
      )
      .attr("stroke-width", (d) =>
        linkEndpointId(d.source) === selectedNodeId || linkEndpointId(d.target) === selectedNodeId ? 2.5 : 1
      )
      .attr("stroke-dasharray", (d) =>
        linkEndpointId(d.source) === selectedNodeId || linkEndpointId(d.target) === selectedNodeId ? "4,4" : "none"
      );

    const nodeGroup = stage
      .append("g")
      .attr("class", "cg-topology-nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "cg-topology-node cursor-pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelectNode(d.id);
      })
      .call(drag(simulation));

    nodeGroup
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", (d) => nodeFill(d, selectedNodeId))
      .attr("stroke", (d) => d.id === selectedNodeId ? "#ffffff" : "rgba(255, 255, 255, 0.15)")
      .attr("stroke-width", (d) => d.id === selectedNodeId ? 2 : 1)
      .style("filter", (d) => d.id === selectedNodeId ? "url(#glow)" : "none");

    const labels = nodeGroup
      .append("text")
      .attr("x", (d) => nodeRadius(d) + 8)
      .attr("y", 4)
      .text((d) => getShortLabel(d.label || d.id))
      .attr("class", "text-xs font-semibold fill-zinc-200 pointer-events-none")
      .style("opacity", (d) => d.id === selectedNodeId ? 1 : 0.6);

    // Optional: add a backdrop to text for readability
    labels.clone(true)
      .lower()
      .attr("stroke", "rgba(9, 9, 11, 0.95)") // inc-950
      .attr("stroke-width", 3)
      .attr("class", "text-xs font-semibold pointer-events-none");

    simulation.on("tick", () => {
      link.attr("d", (d) => {
        const sx = linkEndpointCoord(d.source, "x");
        const sy = linkEndpointCoord(d.source, "y");
        const tx = linkEndpointCoord(d.target, "x");
        const ty = linkEndpointCoord(d.target, "y");
        const dx = tx - sx;
        const dy = ty - sy;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; // Curve radius
        return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
      });

      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => simulation.stop();
  }, [graph, onSelectNode]); // 🛑 Removed selectedNodeId so the physics map doesn't rebuild / shuffle on click

  // 🎨 Separate effect just for updating visual highlights without touching the physics simulation
  useEffect(() => {
    if (!containerRef.current) return;
    const svg = d3.select(containerRef.current).select("svg");
    if (svg.empty()) return;

    // 1. Calculate connected node IDs
    const connectedNodeIds = new Set();
    if (selectedNodeId && graph?.links) {
      for (const link of graph.links) {
        const sourceId = linkEndpointId(link.source);
        const targetId = linkEndpointId(link.target);
        if (sourceId === selectedNodeId) connectedNodeIds.add(targetId);
        if (targetId === selectedNodeId) connectedNodeIds.add(sourceId);
      }
    }

    // Helper to check if a link is part of the highlighted cluster
    const isLinkActive = (d) => {
      const sourceId = linkEndpointId(d.source);
      const targetId = linkEndpointId(d.target);
      return sourceId === selectedNodeId || targetId === selectedNodeId;
    };

    // Helper to check if a node is part of the highlighted cluster
    const isNodeActive = (id) => {
      return id === selectedNodeId || connectedNodeIds.has(id);
    };

    svg.selectAll(".cg-topology-links path")
      .attr("stroke", (d) =>
        isLinkActive(d)
          ? "rgba(45, 212, 191, 0.9)" // Teal for active edges
          : "rgba(100, 116, 139, 0.15)" // Fade out non-active edges
      )
      .attr("stroke-width", (d) => isLinkActive(d) ? 2.5 : 1)
      .attr("stroke-dasharray", (d) => isLinkActive(d) ? "4,4" : "none");

    svg.selectAll(".cg-topology-node circle")
      // Primary selected is white, connected are their normal color but bright
      .attr("fill", (d) => d.id === selectedNodeId ? "#ffffff" : nodeFill(d, null))
      // Add heavy white stroke to selected, soft white stroke to connected
      .attr("stroke", (d) => {
        if (d.id === selectedNodeId) return "#ffffff";
        if (connectedNodeIds.has(d.id)) return "rgba(255, 255, 255, 0.6)";
        return "rgba(255, 255, 255, 0.1)";
      })
      .attr("stroke-width", (d) => d.id === selectedNodeId ? 2.5 : (connectedNodeIds.has(d.id) ? 1.5 : 1))
      // Glow the active cluster, turn off others
      .style("filter", (d) => isNodeActive(d.id) ? "url(#glow)" : "none")
      // Fade out inactive nodes
      .style("opacity", (d) => {
        if (!selectedNodeId) return 1; // No selection = fully visible
        return isNodeActive(d.id) ? 1 : 0.25;
      });

    svg.selectAll(".cg-topology-node text")
      .style("opacity", (d) => {
        if (!selectedNodeId) return 0.6; // Base opacity
        return isNodeActive(d.id) ? 1 : 0.15;
      });

  }, [selectedNodeId, graph]);

  return (
    <div className="absolute inset-0 z-0 h-full w-full">
      <div className="absolute inset-0" ref={containerRef} />
      <div className="absolute bottom-6 left-6 flex items-center gap-4 px-4 py-2 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 shadow-lg pointer-events-none z-10 text-xs font-medium text-zinc-300 select-none">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />File</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />Class</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />Function</span>
        <div className="w-px h-3 bg-white/20 mx-1"></div>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(251, 146, 60, 0.95)" }} />Selected</span>
      </div>
    </div>
  );
}

function nodeRadius(node) {
  return Math.max(5, Math.min(14, Math.log2((node.line_count || 1) + 6) * 1.8));
}

function nodeFill(node, selectedNodeId) {
  if (node.id === selectedNodeId) return "#ffffff"; // White
  if (node.type === "class") return "#06b6d4"; // Cyan-500
  if (node.type === "function") return "#f59e0b"; // Amber-500
  if (node.type === "file") return "#a855f7"; // Purple-500
  return "#94a3b8"; // Slate-400
}

function linkEndpointId(endpoint) {
  return typeof endpoint === "object" ? endpoint.id : endpoint;
}

function linkEndpointCoord(endpoint, axis) {
  if (typeof endpoint === "object" && typeof endpoint[axis] === "number") {
    return endpoint[axis];
  }
  return 0;
}

function getShortLabel(label) {
  const parts = String(label).split("/");
  return parts[parts.length - 1];
}
