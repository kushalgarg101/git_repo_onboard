const AGENT_CATEGORY_DEFINITIONS = [
  {
    id: "hooks",
    label: "Hooks",
    patterns: [/\bhooks?\b/i, /\bpre[-_ ]?hook\b/i, /\bpost[-_ ]?hook\b/i, /\buse[A-Z][A-Za-z0-9_]*\b/],
  },
  {
    id: "skills",
    label: "Skills",
    patterns: [/\bskills?\b/i, /\bcapabilit(?:y|ies)\b/i, /\btooling\b/i],
  },
  {
    id: "subagents",
    label: "Subagents",
    patterns: [/\bsub[-_ ]?agents?\b/i, /\bworker[-_ ]?agents?\b/i, /\bdelegate[-_ ]?agents?\b/i],
  },
  {
    id: "agents",
    label: "Agents",
    patterns: [/\bagents?\b/i, /\bassistant(s)?\b/i],
  },
  {
    id: "multi_agents",
    label: "Multi Agents",
    patterns: [/\bmulti[-_ ]?agents?\b/i, /\bswarms?\b/i, /\borchestrat(?:or|ion)\b/i],
  },
  {
    id: "mcps",
    label: "MCPs",
    patterns: [/\bmcps?\b/i, /\bmodel context protocol\b/i],
  },
  {
    id: "plugins",
    label: "Plug-ins",
    patterns: [/\bplug[-_ ]?ins?\b/i, /\bextensions?\b/i, /\badapters?\b/i],
  },
];

export const AGENT_TABS = AGENT_CATEGORY_DEFINITIONS.map((entry) => ({
  id: entry.id,
  label: entry.label,
}));

export function deriveAgenticModel(graph) {
  const nodes = graph?.nodes || [];
  const links = graph?.links || [];

  const categories = AGENT_CATEGORY_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    nodes: [],
  }));

  const nodesById = new Map();
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const nodeCategoryMap = new Map();

  for (const node of nodes) {
    const categoriesForNode = classifyNode(node);
    if (!categoriesForNode.length) {
      continue;
    }

    nodesById.set(node.id, node);
    nodeCategoryMap.set(node.id, categoriesForNode);
    for (const categoryId of categoriesForNode) {
      categoryById.get(categoryId)?.nodes.push(node);
    }
  }

  const agenticNodes = [...nodesById.values()];
  const agenticNodeIds = new Set(agenticNodes.map((node) => node.id));
  const agenticLinks = links.filter(
    (link) => agenticNodeIds.has(link.source) && agenticNodeIds.has(link.target)
  );

  return {
    categories,
    nodeCategoryMap,
    agenticGraph: {
      ...(graph || {}),
      nodes: agenticNodes,
      links: agenticLinks,
    },
  };
}

function classifyNode(node) {
  const content = buildSearchContent(node);
  const matches = [];

  for (const definition of AGENT_CATEGORY_DEFINITIONS) {
    if (definition.patterns.some((pattern) => pattern.test(content))) {
      matches.push(definition.id);
    }
  }

  if (matches.includes("agents")) {
    if (matches.includes("subagents") || matches.includes("multi_agents")) {
      return matches.filter((id) => id !== "agents");
    }
  }

  return matches;
}

function buildSearchContent(node) {
  const parts = [
    node?.id,
    node?.label,
    node?.summary,
    node?.group,
    node?.type,
    JSON.stringify(node?.meta || {}),
  ];
  return parts.filter(Boolean).join(" ");
}
