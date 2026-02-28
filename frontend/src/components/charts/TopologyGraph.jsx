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

    const stage = svg.append("g");

    const zoom = d3.zoom().scaleExtent([0.35, 3]).on("zoom", (event) => {
      stage.attr("transform", event.transform);
    });

    svg.call(zoom);

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(82).strength(0.36))
      .force("charge", d3.forceManyBody().strength(-155))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d) => nodeRadius(d) + 7));

    const link = stage
      .append("g")
      .attr("class", "cg-topology-links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) =>
        linkEndpointId(d.source) === selectedNodeId || linkEndpointId(d.target) === selectedNodeId
          ? "rgba(142, 197, 232, 0.92)"
          : "rgba(89, 120, 147, 0.34)"
      )
      .attr("stroke-width", (d) =>
        linkEndpointId(d.source) === selectedNodeId || linkEndpointId(d.target) === selectedNodeId ? 1.7 : 1.0
      );

    const node = stage
      .append("g")
      .attr("class", "cg-topology-nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "cg-topology-node")
      .on("click", (_, d) => onSelectNode(d.id));

    node
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", (d) => nodeFill(d, selectedNodeId))
      .attr("stroke", "rgba(230, 245, 255, 0.6)")
      .attr("stroke-width", 0.8);

    node
      .append("text")
      .attr("x", (d) => nodeRadius(d) + 6)
      .attr("y", 3)
      .text((d) => d.label || d.id)
      .attr("class", "cg-topology-label");

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => linkEndpointCoord(d.source, "x"))
        .attr("y1", (d) => linkEndpointCoord(d.source, "y"))
        .attr("x2", (d) => linkEndpointCoord(d.target, "x"))
        .attr("y2", (d) => linkEndpointCoord(d.target, "y"));

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [graph, onSelectNode, selectedNodeId]);

  return <div className="cg-topology-container" ref={containerRef} />;
}

function nodeRadius(node) {
  return Math.max(3.2, Math.min(9.6, Math.log2((node.line_count || 1) + 6) * 1.1));
}

function nodeFill(node, selectedNodeId) {
  if (node.id === selectedNodeId) return "rgba(251, 146, 60, 0.95)";
  if (node.type === "class") return "rgba(52, 211, 153, 0.86)";
  if (node.type === "function") return "rgba(245, 158, 11, 0.86)";
  return "rgba(56, 189, 248, 0.84)";
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
