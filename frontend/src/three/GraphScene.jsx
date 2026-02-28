import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildPathEdges, prepareGraph } from "./layout";

const NODE_COLORS = {
  file: 0x5fd7ff,
  class: 0x4df5cb,
  function: 0xffc857,
  default: 0xe4efff,
  selected: 0xfff6d8,
  connected: 0x58ffd5,
  highlighted: 0xbff1ff,
  path: 0xffb261,
};

const LINK_COLORS = {
  base: 0x9ecbff,
  selected: 0x7fffe4,
  path: 0xffc17d,
  search: 0xc3f2ff,
};

export default function GraphScene({
  graph,
  selectedNodeId,
  highlightedNodeIds,
  pathNodeIds,
  onSelectNode,
}) {
  const mountRef = useRef(null);
  const prepared = useMemo(() => prepareGraph(graph), [graph]);
  const highlightedSet = useMemo(() => new Set(highlightedNodeIds || []), [highlightedNodeIds]);
  const pathEdgeSet = useMemo(() => buildPathEdges(pathNodeIds), [pathNodeIds]);
  const connectedNodeSet = useMemo(
    () => buildConnectedNodeSet(prepared.links, selectedNodeId),
    [prepared.links, selectedNodeId]
  );

  useEffect(() => {
    if (!mountRef.current || !prepared.nodes.length) return undefined;

    const root = mountRef.current;
    const width = Math.max(root.clientWidth, 320);
    const height = Math.max(root.clientHeight, 320);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 8000);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    root.appendChild(renderer.domElement);

    const sceneRadius = computeSceneRadius(prepared.nodes);
    camera.position.set(sceneRadius * 0.86, sceneRadius * 0.58, sceneRadius * 1.02);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = Math.max(16, sceneRadius * 0.22);
    controls.maxDistance = Math.max(800, sceneRadius * 6);
    controls.target.set(0, 0, 0);

    const ambient = new THREE.HemisphereLight(0xd7edff, 0x0a1120, 1.02);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xe6f6ff, 0.92);
    keyLight.position.set(180, 280, 240);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x58ffd5, 0.88, sceneRadius * 5);
    rimLight.position.set(-sceneRadius * 0.8, sceneRadius * 0.5, -sceneRadius * 0.7);
    scene.add(rimLight);

    const stars = createStarfield(sceneRadius * 7);
    scene.add(stars);

    const nodeGeometry = new THREE.SphereGeometry(1, 15, 12);
    const nodeMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      shininess: 24,
    });

    const nodeMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, prepared.nodes.length);
    nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    nodeMesh.frustumCulled = false;

    const tempMatrix = new THREE.Matrix4();
    const tempQuaternion = new THREE.Quaternion();
    const tempScale = new THREE.Vector3(1, 1, 1);
    const tempColor = new THREE.Color();

    const nodesByIndex = [];
    const nodePositions = new Map();

    prepared.nodes.forEach((node, index) => {
      const isSelected = node.id === selectedNodeId;
      const isPath = isNodeInPath(node.id, pathNodeIds);
      const isHighlighted = highlightedSet.has(node.id);
      const isConnected = connectedNodeSet.has(node.id);

      const size = resolveNodeSize(node, { isSelected, isPath, isConnected, isHighlighted });
      tempScale.set(size, size, size);
      tempMatrix.compose(
        new THREE.Vector3(node.x, node.y, node.z),
        tempQuaternion,
        tempScale
      );

      nodeMesh.setMatrixAt(index, tempMatrix);
      tempColor.setHex(resolveNodeColor(node, { isSelected, isPath, isConnected, isHighlighted }));
      nodeMesh.setColorAt(index, tempColor);

      const position = new THREE.Vector3(node.x, node.y, node.z);
      nodesByIndex[index] = { ...node, position };
      nodePositions.set(node.id, position);
    });

    nodeMesh.instanceMatrix.needsUpdate = true;
    if (nodeMesh.instanceColor) {
      nodeMesh.instanceColor.needsUpdate = true;
    }

    scene.add(nodeMesh);

    const baseLinks = buildLinksGeometry(prepared.links, nodePositions, {
      selectedNodeId,
      highlightedSet,
      pathEdgeSet,
      mode: "base",
    });
    if (baseLinks) {
      scene.add(baseLinks);
    }

    const accentLinks = buildLinksGeometry(prepared.links, nodePositions, {
      selectedNodeId,
      highlightedSet,
      pathEdgeSet,
      mode: "accent",
    });
    if (accentLinks) {
      scene.add(accentLinks);
    }

    const selectedHalo = createSelectionHalo(selectedNodeId, nodePositions);
    if (selectedHalo) {
      scene.add(selectedHalo);
    }

    const label = document.createElement("div");
    label.className = "cg-node-label";
    label.style.opacity = "0";
    root.appendChild(label);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const focusTarget = new THREE.Vector3(0, 0, 0);

    function updatePointer(event) {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      return bounds;
    }

    const onPointerMove = (event) => {
      const bounds = updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(nodeMesh);
      if (!hits.length) {
        label.style.opacity = "0";
        return;
      }

      const index = hits[0].instanceId;
      const node = nodesByIndex[index];
      if (!node) {
        label.style.opacity = "0";
        return;
      }

      label.textContent = `${node.label || node.id}  [${node.type}]`;
      label.style.opacity = "1";
      label.style.left = `${event.clientX - bounds.left + 16}px`;
      label.style.top = `${event.clientY - bounds.top - 12}px`;
    };

    const onPointerLeave = () => {
      label.style.opacity = "0";
    };

    const onPointerDown = (event) => {
      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(nodeMesh);
      if (!hits.length) return;
      const node = nodesByIndex[hits[0].instanceId];
      if (node) {
        onSelectNode(node.id);
      }
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const onResize = () => {
      const nextWidth = Math.max(root.clientWidth, 320);
      const nextHeight = Math.max(root.clientHeight, 320);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };
    window.addEventListener("resize", onResize);

    let rafId = 0;

    const animate = () => {
      if (selectedNodeId && nodePositions.has(selectedNodeId)) {
        focusTarget.copy(nodePositions.get(selectedNodeId));
      } else {
        focusTarget.set(0, 0, 0);
      }

      controls.target.lerp(focusTarget, 0.08);
      controls.update();

      stars.rotation.y += 0.00006;
      stars.rotation.x += 0.00003;

      if (selectedHalo) {
        selectedHalo.lookAt(camera.position);
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);

      if (root.contains(label)) {
        root.removeChild(label);
      }

      controls.dispose();

      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (root.contains(renderer.domElement)) {
        root.removeChild(renderer.domElement);
      }
    };
  }, [
    onSelectNode,
    pathEdgeSet,
    pathNodeIds,
    prepared,
    selectedNodeId,
    highlightedSet,
    connectedNodeSet,
  ]);

  return (
    <div className="cg-graph-scene" ref={mountRef}>
      <div className="cg-scene-legend" aria-hidden="true">
        <span><i className="dot file" />File</span>
        <span><i className="dot class" />Class</span>
        <span><i className="dot function" />Function</span>
        <span><i className="dot connected" />Connected</span>
        <span><i className="dot path" />Path</span>
      </div>
    </div>
  );
}

function isNodeInPath(nodeId, pathNodeIds) {
  if (!Array.isArray(pathNodeIds) || !pathNodeIds.length) return false;
  return pathNodeIds.includes(nodeId);
}

function resolveNodeColor(node, { isSelected, isPath, isConnected, isHighlighted }) {
  if (isSelected) return NODE_COLORS.selected;
  if (isPath) return NODE_COLORS.path;
  if (isConnected) return NODE_COLORS.connected;
  if (isHighlighted) return NODE_COLORS.highlighted;
  return NODE_COLORS[node.type] || NODE_COLORS.default;
}

function resolveNodeSize(node, { isSelected, isPath, isConnected, isHighlighted }) {
  const base = Math.max(0.95, Math.min(3.2, Math.log2((node.line_count || 1) + 8) * 0.33));
  if (isSelected) return base * 1.5;
  if (isPath) return base * 1.3;
  if (isConnected) return base * 1.2;
  if (isHighlighted) return base * 1.18;
  return base;
}

function buildLinksGeometry(links, nodePositions, context) {
  const positions = [];
  const colors = [];

  for (const link of links) {
    const source = nodePositions.get(link.source);
    const target = nodePositions.get(link.target);
    if (!source || !target) continue;

    const isPath = context.pathEdgeSet.has(`${link.source}=>${link.target}`);
    const isSelected = !!context.selectedNodeId &&
      (link.source === context.selectedNodeId || link.target === context.selectedNodeId);
    const isSearch = context.highlightedSet.has(link.source) && context.highlightedSet.has(link.target);

    if (context.mode === "base" && (isPath || isSelected || isSearch)) {
      continue;
    }
    if (context.mode === "accent" && !(isPath || isSelected || isSearch)) {
      continue;
    }

    positions.push(source.x, source.y, source.z, target.x, target.y, target.z);

    let colorHex = LINK_COLORS.base;
    if (isPath) {
      colorHex = LINK_COLORS.path;
    } else if (isSelected) {
      colorHex = LINK_COLORS.selected;
    } else if (isSearch) {
      colorHex = LINK_COLORS.search;
    }

    const color = new THREE.Color(colorHex);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  if (!positions.length) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const isAccent = context.mode === "accent";
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: isAccent ? 1 : 0.78,
    blending: isAccent ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
    depthTest: !isAccent,
  });

  return new THREE.LineSegments(geometry, material);
}

function createSelectionHalo(selectedNodeId, positionsById) {
  if (!selectedNodeId || !positionsById.has(selectedNodeId)) {
    return null;
  }

  const position = positionsById.get(selectedNodeId);
  const geometry = new THREE.RingGeometry(6.4, 8.8, 48);
  const material = new THREE.MeshBasicMaterial({
    color: 0xfff4cc,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.position.copy(position);
  return ring;
}

function createStarfield(radius) {
  const starCount = 1800;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i += 1) {
    const r = radius * (0.35 + Math.random() * 0.75);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x95b8d7,
    size: 1.45,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function computeSceneRadius(nodes) {
  if (!nodes.length) return 72;
  let maxDistance = 0;
  for (const node of nodes) {
    const distance = Math.sqrt(node.x * node.x + node.y * node.y + node.z * node.z);
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  }
  return Math.max(56, maxDistance * 1.12);
}

function buildConnectedNodeSet(links, selectedNodeId) {
  const connected = new Set();
  if (!selectedNodeId) {
    return connected;
  }
  for (const link of links || []) {
    if (link.source === selectedNodeId || link.target === selectedNodeId) {
      connected.add(link.source);
      connected.add(link.target);
    }
  }
  return connected;
}
