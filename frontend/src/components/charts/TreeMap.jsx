import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function TreeMap({ graph, selectedNodeId, onSelectNode }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current || !graph) return;

        const container = containerRef.current;
        container.innerHTML = '';
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Transform flat graph to hierarchy
        const rootData = { id: 'root', children: [] };
        const nodeMap = new Map();

        graph.nodes.forEach(node => {
            const parts = node.id.split('/');
            let current = rootData;
            parts.forEach((part, i) => {
                if (i === parts.length - 1) {
                    current.children.push({ ...node, name: part });
                } else {
                    let found = current.children.find(c => c.name === part);
                    if (!found) {
                        found = { name: part, children: [] };
                        current.children.push(found);
                    }
                    current = found;
                }
            });
        });

        const root = d3.hierarchy(rootData)
            .sum(d => d.line_count || 1)
            .sort((a, b) => b.value - a.value);

        d3.treemap()
            .size([width, height])
            .paddingOuter(4)
            .paddingTop(20)
            .paddingInner(1)
            .round(true)(root);

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('font-family', 'var(--cg-font-mono)')
            .style('font-size', '10px');

        const leaf = svg.selectAll('g')
            .data(root.leaves())
            .join('g')
            .attr('transform', d => `translate(${d.x0},${d.y0})`);

        leaf.append('rect')
            .attr('width', d => d.x1 - d.x0)
            .attr('height', d => d.y1 - d.y0)
            .attr('fill', d => {
                if (d.data.id === selectedNodeId) return 'var(--cg-text)';
                const churn = d.data.churn || 0;
                return d3.interpolateRgb('rgba(39, 39, 42, 0.4)', 'rgba(248, 113, 113, 0.8)')(Math.min(1, churn / 50));
            })
            .attr('stroke', 'rgba(255, 255, 255, 0.1)')
            .attr('cursor', 'pointer')
            .on('click', (event, d) => onSelectNode(d.data.id));

        leaf.append('text')
            .attr('x', 4)
            .attr('y', 14)
            .attr('fill', 'var(--cg-text)')
            .attr('pointer-events', 'none')
            .text(d => (d.x1 - d.x0 > 40 && d.y1 - d.y0 > 20) ? d.data.name : '');

        // Add titles for parent groups
        svg.selectAll('text.parent')
            .data(root.descendants().filter(d => d.depth > 0 && d.children))
            .join('text')
            .attr('class', 'parent')
            .attr('x', d => d.x0 + 6)
            .attr('y', d => d.y0 + 14)
            .attr('fill', 'var(--cg-muted)')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text(d => (d.x1 - d.x0 > 60) ? d.data.name : '');

    }, [graph, selectedNodeId, onSelectNode]);

    return <div className="cg-treemap-container" ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />;
}
