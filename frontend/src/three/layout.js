/**
 * Graph layout and rendering data helpers.
 */

const MAX_NODES = 1800;
const MAX_LINKS = 4200;

export function prepareGraph(graph) {
  const nodes = graph?.nodes || [];
  const links = graph?.links || [];

  const selectedNodes = pickNodes(nodes, MAX_NODES);
  const selectedLinks = pickLinks(links, MAX_LINKS, selectedNodes);
  const positionedNodes = positionNodes(selectedNodes);

  return {
    nodes: positionedNodes,
    links: selectedLinks,
  };
}

export function buildPathEdges(pathNodeIds) {
  const edges = new Set();
  if (!Array.isArray(pathNodeIds) || pathNodeIds.length < 2) {
    return edges;
  }
  for (let index = 0; index < pathNodeIds.length - 1; index += 1) {
    const a = pathNodeIds[index];
    const b = pathNodeIds[index + 1];
    edges.add(`${a}=>${b}`);
    edges.add(`${b}=>${a}`);
  }
  return edges;
}

function pickNodes(nodes, maxNodes) {
  if (nodes.length <= maxNodes) {
    return nodes;
  }
  return [...nodes]
    .sort((left, right) => (right.complexity || 0) - (left.complexity || 0))
    .slice(0, maxNodes);
}

function pickLinks(links, maxLinks, selectedNodes) {
  const selectedIds = new Set(selectedNodes.map((node) => node.id));
  const filtered = links.filter((link) => selectedIds.has(link.source) && selectedIds.has(link.target));
  if (filtered.length <= maxLinks) {
    return filtered;
  }
  return filtered.slice(0, maxLinks);
}

function positionNodes(nodes) {
  const radius = Math.max(80, Math.cbrt(nodes.length || 1) * 16);
  return nodes.map((node, index) => {
    const point = fibonacciSphere(index, nodes.length, radius);
    return {
      ...node,
      x: point.x + (Math.random() - 0.5) * 5,
      y: point.y + (Math.random() - 0.5) * 5,
      z: point.z + (Math.random() - 0.5) * 5,
    };
  });
}

function fibonacciSphere(index, total, radius) {
  const offset = 2 / total;
  const increment = Math.PI * (3 - Math.sqrt(5));
  const y = index * offset - 1 + offset / 2;
  const ring = Math.sqrt(1 - y * y);
  const phi = index * increment;
  const x = Math.cos(phi) * ring;
  const z = Math.sin(phi) * ring;
  return { x: x * radius, y: y * radius, z: z * radius };
}
