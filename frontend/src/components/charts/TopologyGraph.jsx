import { useEffect, useRef } from "react";
import * as d3 from "d3";

const MAX_NODES = 350;
const MAX_LINKS = 1000;

// 🎨 A rich 20-color vibrant palette for maximum variety
const VIBRANT_PALETTE = [
  "#f94144", "#f3722c", "#f8961e", "#f9844a", "#f9c74f",
  "#90be6d", "#43aa8b", "#4d908e", "#577590", "#277da1",
  "#e63946", "#a8dadc", "#457b9d", "#1d3557", "#ff6b6b",
  "#c084fc", "#818cf8", "#38bdf8", "#34d399", "#fbbf24",
];
const colorScale = d3.scaleOrdinal(VIBRANT_PALETTE);

export default function TopologyGraph({
  graph,
  selectedNodeId,
  onSelectNode,
  hoveredNodeId,
  onHoverNode,
  showImports,
  showCalls
}) {
  const containerRef = useRef(null);
  const zoomBehaviorRef = useRef(null); // 🎥 Save D3 zoom behavior
  const svgRef = useRef(null); // 🎥 Save SVG reference

  // ⚡ Keep latest callbacks without triggering re-renders of the massive D3 setup
  const callbacksRef = useRef({ onSelectNode, onHoverNode });
  useEffect(() => {
    callbacksRef.current = { onSelectNode, onHoverNode };
  }, [onSelectNode, onHoverNode]);

  useEffect(() => {
    if (!containerRef.current || !graph?.nodes?.length) return undefined;

    const container = containerRef.current;
    container.innerHTML = "";

    const width = Math.max(container.clientWidth, 640);
    const height = Math.max(container.clientHeight, 440);

    const nodes = [...graph.nodes]
      .sort((a, b) => Number(b.complexity || 0) - Number(a.complexity || 0))
      .slice(0, MAX_NODES)
      .map((node) => ({ ...node, degree: 0 }));

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

    svgRef.current = svg;

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

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Initial transform to center graph a bit better
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8).translate(-width / 2, -height / 2));

    // Handle double click to reset zoom
    svg.on("dblclick.zoom", null); // disable default
    svg.on("dblclick", () => {
      if (callbacksRef.current.onSelectNode) callbacksRef.current.onSelectNode(null);
      svg.transition().duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8).translate(-width / 2, -height / 2));
    });

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
      .attr("stroke", "rgba(100, 116, 139, 0.25)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "none");

    const nodeGroup = stage
      .append("g")
      .attr("class", "cg-topology-nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "cg-topology-node cursor-pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        if (callbacksRef.current.onSelectNode) callbacksRef.current.onSelectNode(d.id);
      })
      .on("mouseenter", (event, d) => {
        if (callbacksRef.current.onHoverNode) callbacksRef.current.onHoverNode(d.id);
      })
      .on("mouseleave", () => {
        if (callbacksRef.current.onHoverNode) callbacksRef.current.onHoverNode(null);
      })
      .call(drag(simulation));

    nodeGroup
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", (d) => nodeFill(d, null))
      .attr("stroke", "rgba(255, 255, 255, 0.15)")
      .attr("stroke-width", 1)
      .style("filter", "none");

    const labels = nodeGroup
      .append("text")
      .attr("x", (d) => nodeRadius(d) + 8)
      .attr("y", 4)
      .text((d) => getShortLabel(d.label || d.id))
      .attr("class", "text-xs font-semibold fill-zinc-200 pointer-events-none")
      .style("opacity", 0.6);

    labels.clone(true)
      .lower()
      .attr("stroke", "rgba(9, 9, 11, 0.95)")
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
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
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

    // Save simulation to attach node coordinates later if needed
    containerRef.current.__simulation = simulation;

    return () => simulation.stop();
  }, [graph]); // 🛑 ONLY redraw when the core graph data changes, NEVER on hover/select

  // 🎛️ FILTER EFFECT (Dynamic Edge Removal based on Type)
  useEffect(() => {
    if (!containerRef.current || !svgRef.current || !graph?.links) return;
    const svg = svgRef.current;

    // Smoothly hide/show links based on active toggles
    svg.selectAll(".cg-topology-links path")
      .style("display", (d) => {
        const type = (d.type || "").toLowerCase();
        if (type === "imports" && !showImports) return "none";
        if ((type === "calls" || type === "uses") && !showCalls) return "none";
        return "inline";
      });
  }, [showImports, showCalls, graph]);

  // 🎨 HIGHLIGHT & HOVER EFFECT (Real-time visual updates)
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;
    const svg = svgRef.current;

    // Use hoveredNodeId if active, fallback to selectedNodeId
    const activeId = hoveredNodeId || selectedNodeId;

    // 1. Calculate connected node IDs
    const connectedNodeIds = new Set();

    if (activeId && graph?.links) {
      for (const link of graph.links) {
        // Only count connections if the link is currently visible through filters
        const type = (link.type || "").toLowerCase();
        if (type === "imports" && !showImports) continue;
        if ((type === "calls" || type === "uses") && !showCalls) continue;

        const sourceId = linkEndpointId(link.source);
        const targetId = linkEndpointId(link.target);
        if (sourceId === activeId) connectedNodeIds.add(targetId);
        if (targetId === activeId) connectedNodeIds.add(sourceId);
      }
    }

    const isLinkActive = (d) => {
      const sourceId = linkEndpointId(d.source);
      const targetId = linkEndpointId(d.target);
      return sourceId === activeId || targetId === activeId;
    };

    const isNodeActive = (id) => {
      return id === activeId || connectedNodeIds.has(id);
    };

    // Update visuals
    svg.selectAll(".cg-topology-links path")
      .attr("stroke", (d) =>
        isLinkActive(d)
          ? "rgba(45, 212, 191, 0.9)" // Teal for active edges
          : "rgba(100, 116, 139, 0.15)" // Fade out non-active edges
      )
      .attr("stroke-width", (d) => isLinkActive(d) ? 2.5 : 1)
      .attr("stroke-dasharray", (d) => isLinkActive(d) ? "4,4" : "none");

    svg.selectAll(".cg-topology-node circle")
      // Primary active is white, connected are their normal color
      .attr("fill", (d) => d.id === activeId ? "#ffffff" : nodeFill(d, null))
      .attr("stroke", (d) => {
        if (d.id === activeId) return "#ffffff";
        if (connectedNodeIds.has(d.id)) return "rgba(255, 255, 255, 0.6)";
        return "rgba(255, 255, 255, 0.1)";
      })
      .attr("stroke-width", (d) => d.id === activeId ? 2.5 : (connectedNodeIds.has(d.id) ? 1.5 : 1))
      .style("filter", (d) => isNodeActive(d.id) ? "url(#glow)" : "none")
      .style("opacity", (d) => {
        if (!activeId) return 1; // No active focus = fully visible
        return isNodeActive(d.id) ? 1 : 0.25;
      });

    svg.selectAll(".cg-topology-node text")
      .style("opacity", (d) => {
        if (!activeId) return 0.6; // Base opacity
        return isNodeActive(d.id) ? 1 : 0.15;
      });

  }, [selectedNodeId, hoveredNodeId, graph, showImports, showCalls]);

  return (
    <div className="absolute inset-0 z-0 h-full w-full">
      <div className="absolute inset-0" ref={containerRef} />
      <div className="absolute bottom-6 left-6 flex items-center gap-4 px-4 py-2 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 shadow-lg pointer-events-none z-10 text-xs font-medium text-zinc-300 select-none">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: colorScale("src") }} />Core UI</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: colorScale("components") }} />Components</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: colorScale("api") }} />Backend/API</span>
        <div className="w-px h-3 bg-white/20 mx-1"></div>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255, 255, 255, 0.95)" }} />Selected Focus</span>
      </div>
    </div>
  );
}

function nodeRadius(node) {
  const lines = node.line_count || 1;
  return Math.max(5, Math.min(35, 4 + Math.sqrt(lines) * 0.6));
}

function nodeFill(node, selectedNodeId) {
  if (node.id === selectedNodeId) return "#ffffff"; // White for active

  // Use parent directory as the color key for fine-grained variety
  const id = String(node.id || "");
  const parts = id.split("/");

  // Get parent directory for finer grouping (e.g. "components/charts" instead of just "src")
  let colorKey;
  if (parts.length >= 3) {
    // Use last two directory segments, e.g. "components/charts"
    colorKey = parts.slice(-3, -1).join("/");
  } else if (parts.length === 2) {
    colorKey = parts[0];
  } else {
    // For root-level files, use the file extension
    const ext = id.split(".").pop() || "other";
    colorKey = "root-" + ext;
  }

  return colorScale(colorKey);
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
