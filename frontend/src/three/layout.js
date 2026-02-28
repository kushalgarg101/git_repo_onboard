/**
 * Graph layout and rendering data helpers.
 */

const MAX_NODES = 1400;
const MAX_LINKS = 5000;

export function prepareGraph(graph) {
  const nodes = graph?.nodes || [];
  const links = graph?.links || [];

  const rankedNodes = pickNodes(nodes, links, MAX_NODES);
  const selectedLinks = pickLinks(links, MAX_LINKS, rankedNodes);
  const positionedNodes = positionNodes(rankedNodes);

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

function pickNodes(nodes, links, maxNodes) {
  if (nodes.length <= maxNodes) {
    return nodes;
  }

  const degree = new Map();
  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) || 0) + 1);
    degree.set(link.target, (degree.get(link.target) || 0) + 1);
  }

  return [...nodes]
    .sort((left, right) => scoreNode(right, degree) - scoreNode(left, degree))
    .slice(0, maxNodes);
}

function scoreNode(node, degree) {
  const complexity = Number(node.complexity || 0);
  const lineCount = Number(node.line_count || node.size || 0);
  const issues = Number(node.issues || 0);
  const churn = Number(node.churn || 0);
  const connectivity = Number(degree.get(node.id) || 0);
  return complexity * 2 + Math.log2(lineCount + 1) + issues * 2 + churn * 0.6 + connectivity * 3;
}

function pickLinks(links, maxLinks, selectedNodes) {
  const selectedIds = new Set(selectedNodes.map((node) => node.id));
  const filtered = links.filter((link) => selectedIds.has(link.source) && selectedIds.has(link.target));
  if (filtered.length <= maxLinks) {
    return filtered;
  }
  return [...filtered]
    .sort((left, right) => Number(right.weight || 1) - Number(left.weight || 1))
    .slice(0, maxLinks);
}

function positionNodes(nodes) {
  const groups = groupNodes(nodes);
  const groupKeys = [...groups.keys()].sort();

  if (!groupKeys.length) {
    return [];
  }

  const groupCount = groupKeys.length;
  const densityFactor = nodes.length <= 30 ? 8 : 12;
  const groupRadius = clamp(Math.cbrt(nodes.length + groupCount) * densityFactor, 18, 120);
  const groupCenters = groupKeys.map((_, index) => fibonacciSphere(index, groupKeys.length, groupRadius));

  const positioned = [];
  for (let groupIndex = 0; groupIndex < groupKeys.length; groupIndex += 1) {
    const key = groupKeys[groupIndex];
    const groupNodesList = groups.get(key) || [];
    const center = groupCenters[groupIndex];
    const localRadius = clamp(Math.cbrt(groupNodesList.length || 1) * 7.5, 8, 52);

    groupNodesList.forEach((node, nodeIndex) => {
      const localPoint = fibonacciSphere(nodeIndex, groupNodesList.length, localRadius);
      const jitter = stableJitter(node.id);
      positioned.push({
        ...node,
        x: center.x + localPoint.x + jitter.x,
        y: center.y + localPoint.y + jitter.y,
        z: center.z + localPoint.z + jitter.z,
      });
    });
  }

  return positioned;
}

function groupNodes(nodes) {
  const grouped = new Map();
  for (const node of nodes) {
    const key = node.group || "root";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(node);
  }

  for (const list of grouped.values()) {
    list.sort((left, right) => String(left.id).localeCompare(String(right.id)));
  }

  return grouped;
}

function fibonacciSphere(index, total, radius) {
  if (total <= 1) {
    return { x: 0, y: 0, z: 0 };
  }
  const offset = 2 / total;
  const increment = Math.PI * (3 - Math.sqrt(5));
  const y = index * offset - 1 + offset / 2;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = index * increment;
  const x = Math.cos(phi) * ring;
  const z = Math.sin(phi) * ring;
  return { x: x * radius, y: y * radius, z: z * radius };
}

function stableJitter(id) {
  return {
    x: jitterValue(id, 1),
    y: jitterValue(id, 2),
    z: jitterValue(id, 3),
  };
}

function jitterValue(id, channel) {
  const hash = hashString(`${id}|${channel}`);
  const normalized = (hash % 1000) / 1000;
  return (normalized - 0.5) * 2.6;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
