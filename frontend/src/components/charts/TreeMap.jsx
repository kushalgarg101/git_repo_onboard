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
      .paddingOuter(5)
      .paddingTop(20)
      .paddingInner(2)(root);

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("class", "cg-treemap-svg");

    const leaves = svg
      .append("g")
      .attr("class", "cg-treemap-leaves")
      .selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    leaves
      .append("rect")
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("fill", (d) => tileColor(d.data))
      .attr("stroke", (d) => (d.data.id === selectedNodeId ? "rgba(248, 250, 252, 0.95)" : "rgba(148, 174, 196, 0.22)"))
      .attr("stroke-width", (d) => (d.data.id === selectedNodeId ? 1.5 : 0.8))
      .attr("class", "cg-treemap-tile")
      .on("click", (_, d) => onSelectNode(d.data.id));

    leaves
      .append("text")
      .attr("x", 5)
      .attr("y", 15)
      .attr("class", "cg-treemap-label")
      .text((d) => ((d.x1 - d.x0 > 48 && d.y1 - d.y0 > 22) ? d.data.name : ""));

    svg
      .append("g")
      .attr("class", "cg-treemap-groups")
      .selectAll("text")
      .data(root.descendants().filter((d) => d.depth > 0 && d.children))
      .join("text")
      .attr("x", (d) => d.x0 + 6)
      .attr("y", (d) => d.y0 + 14)
      .attr("class", "cg-treemap-group-label")
      .text((d) => ((d.x1 - d.x0 > 70 ? d.data.name : "")));

    return undefined;
  }, [graph, onSelectNode, selectedNodeId]);

  return <div className="cg-treemap-container" ref={containerRef} />;
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
  const stress = Math.min(1, (churn + issues * 7) / 120);

  return d3.interpolateRgb("rgba(29, 54, 74, 0.58)", "rgba(251, 146, 60, 0.84)")(stress);
}
