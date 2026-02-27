import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function TopologyGraph({ graph, selectedNodeId, onSelectNode }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current || !graph || !graph.nodes.length) return;

        const container = containerRef.current;
        container.innerHTML = '';

        // Use container dimensions, with a fallback
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // CRITICAL FIX: Ensure all links connect to existing nodes to prevent D3 crashes
        const nodeIds = new Set(graph.nodes.map(n => n.id));
        const validLinks = graph.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

        // Deep clone data to avoid mutating global state
        const nodes = graph.nodes.map(d => ({ ...d }));
        const links = validLinks.map(d => ({ ...d }));

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', [0, 0, width, height])
            .style('display', 'block')
            .call(d3.zoom().on('zoom', (event) => {
                g.attr('transform', event.transform);
            }));

        const g = svg.append('g');

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(140).strength(0.6))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(45));

        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke-width', 1.5)
            .attr('stroke', d => {
                const isRelated = d.source.id === selectedNodeId || d.target.id === selectedNodeId;
                return isRelated ? 'var(--cg-accent)' : 'rgba(255, 255, 255, 0.05)';
            })
            .attr('stroke-opacity', d => (d.source.id === selectedNodeId || d.target.id === selectedNodeId) ? 1 : 0.4);

        const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .attr('cursor', 'pointer')
            .on('click', (event, d) => onSelectNode(d.id));

        // "Zen-Cyber" 2D Node Aesthetic
        node.append('rect')
            .attr('width', 10)
            .attr('height', 10)
            .attr('x', -5)
            .attr('y', -5)
            .attr('rx', 2)
            .attr('fill', d => d.id === selectedNodeId ? 'var(--cg-accent)' : 'var(--cg-info)')
            .style('filter', d => d.id === selectedNodeId ? 'drop-shadow(0 0 6px var(--cg-accent-glow))' : 'none');

        node.append('text')
            .attr('x', 12)
            .attr('y', 4)
            .attr('fill', d => d.id === selectedNodeId ? 'var(--cg-text)' : 'var(--cg-muted)')
            .style('font-size', '11px')
            .style('font-weight', d => d.id === selectedNodeId ? 'bold' : 'normal')
            .style('pointer-events', 'none')
            .text(d => d.label);

        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // Initial warm-up
        for (let i = 0; i < 40; ++i) simulation.tick();

        return () => simulation.stop();
    }, [graph, selectedNodeId, onSelectNode]);

    return (
        <div
            className="cg-topology-container"
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                background: 'rgba(5, 7, 12, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        />
    );
}
