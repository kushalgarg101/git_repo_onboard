import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildPathEdges, prepareGraph } from "./layout";

// --- ZEN-CYBER SHADERS ---
const glowVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vColor;
  varying float vDist;
  
  attribute vec3 color;
  attribute float size;

  void main() {
    vColor = color;
    vec4 worldPosition = instanceMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position * size, 1.0);
    
    vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vViewPosition = -mvPosition.xyz;
    vDist = length(mvPosition.xyz);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const glowFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vColor;
  varying float vDist;

  uniform float time;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    
    // Fresnel Rim Glow
    float fresnel = pow(1.2 - dot(normal, viewDir), 3.0);
    
    // Inner Pulse Core
    float pulse = 0.5 + 0.5 * sin(time * 3.0);
    float core = pow(dot(normal, viewDir), 2.0);
    
    vec3 finalColor = vColor * (0.8 + 0.4 * fresnel);
    finalColor += vColor * core * 0.3; // Core glow
    
    // Atmospheric fog effect for distant nodes
    float fog = smoothstep(800.0, 2500.0, vDist);
    
    gl_FragColor = vec4(finalColor, 0.95 - fog * 0.5);
  }
`;

const linkVertexShader = `
  varying float vProgress;
  attribute float progress;
  void main() {
    vProgress = progress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const linkFragmentShader = `
  uniform float time;
  uniform vec3 color;
  uniform float isFlowing;
  varying float vProgress;

  void main() {
    float alpha = 0.15;
    if (isFlowing > 0.5) {
      // Marching energy pattern
      float flow = mod(vProgress - time * 1.5, 1.0);
      float pulse = smoothstep(0.0, 0.1, flow) * smoothstep(0.2, 0.1, flow);
      alpha = 0.2 + pulse * 0.8;
    }
    gl_FragColor = vec4(color, alpha);
  }
`;

// --- CONFIG ---
const COLORS = {
  file: 0x00f2ff,    // Electric Blue
  class: 0x07f9a2,   // Cyber Green
  function: 0xff00d4, // Neon Magenta
  path: 0xffd700,    // Solar Gold
  selected: 0xffffff,
  default: 0x4a5568
};

const GEOMETRY = new THREE.IcosahedronGeometry(1, 4);

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
  const pathNodeSet = useMemo(() => new Set(pathNodeIds || []), [pathNodeIds]);
  const pathEdges = useMemo(() => buildPathEdges(pathNodeIds), [pathNodeIds]);

  useEffect(() => {
    if (!mountRef.current || !graph) return undefined;

    const root = mountRef.current;
    const scene = new THREE.Scene();
    const width = root.clientWidth;
    const height = root.clientHeight;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(0, 300, 800);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    root.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.04;
    controls.rotateSpeed = 0.8;
    controls.minDistance = 20;
    controls.maxDistance = 3500;

    // --- NODE LAYER ---
    const nodeMaterial = new THREE.ShaderMaterial({
      vertexShader: glowVertexShader,
      fragmentShader: glowFragmentShader,
      transparent: true,
      uniforms: { time: { value: 0 } }
    });

    const nodeCount = prepared.nodes.length;
    const instancedMesh = new THREE.InstancedMesh(GEOMETRY, nodeMaterial, nodeCount);

    const colorAttr = new Float32Array(nodeCount * 3);
    const sizeAttr = new Float32Array(nodeCount);
    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    prepared.nodes.forEach((node, i) => {
      const isSelected = node.id === selectedNodeId;
      const isPath = pathNodeSet.has(node.id);

      const rawSize = Math.max(0.6, Math.min(10, Math.log2((node.line_count || 1) / 4 + 2) * 2.2));
      const sizeMultiplier = isSelected ? 3.0 : (isPath ? 1.6 : 1.0);
      sizeAttr[i] = rawSize * sizeMultiplier;

      tempMatrix.makeTranslation(node.x, node.y, node.z);
      instancedMesh.setMatrixAt(i, tempMatrix);

      const colorHex = isSelected ? COLORS.selected : (isPath ? COLORS.path : (COLORS[node.type] || COLORS.default));
      tempColor.set(colorHex);
      colorAttr[i * 3] = tempColor.r;
      colorAttr[i * 3 + 1] = tempColor.g;
      colorAttr[i * 3 + 2] = tempColor.b;
    });

    GEOMETRY.setAttribute('color', new THREE.InstancedBufferAttribute(colorAttr, 3));
    GEOMETRY.setAttribute('size', new THREE.InstancedBufferAttribute(sizeAttr, 1));
    instancedMesh.instanceMatrix.needsUpdate = true;
    scene.add(instancedMesh);

    // --- LINK LAYER ---
    const linkMaterial = new THREE.ShaderMaterial({
      vertexShader: linkVertexShader,
      fragmentShader: linkFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x00f2ff) },
        isFlowing: { value: 0 }
      }
    });

    const flowMaterial = linkMaterial.clone();
    flowMaterial.uniforms.isFlowing.value = 1.0;
    flowMaterial.uniforms.color.value.set(0xffffff);

    const pathFlowMaterial = linkMaterial.clone();
    pathFlowMaterial.uniforms.isFlowing.value = 1.0;
    pathFlowMaterial.uniforms.color.value.set(COLORS.path);

    prepared.links.forEach(link => {
      const src = prepared.nodes.find(n => n.id === link.source);
      const dst = prepared.nodes.find(n => n.id === link.target);
      if (!src || !dst) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        src.x, src.y, src.z,
        dst.x, dst.y, dst.z
      ], 3));
      geometry.setAttribute('progress', new THREE.Float32BufferAttribute([0, 1], 1));

      const isActive = selectedNodeId && (link.source === selectedNodeId || link.target === selectedNodeId);
      const isPath = pathEdges.has(`${link.source}=>${link.target}`);

      const mat = isPath ? pathFlowMaterial : (isActive ? flowMaterial : linkMaterial);
      scene.add(new THREE.Line(geometry, mat));
    });

    // --- INTERACTION ---
    const labelEl = document.createElement("div");
    labelEl.className = "cg-node-label";
    labelEl.style.display = "none";
    root.appendChild(labelEl);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerMove = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObject(instancedMesh);
      if (intersections.length > 0) {
        const node = prepared.nodes[intersections[0].instanceId];
        labelEl.textContent = node.label;
        labelEl.style.display = "block";
        labelEl.style.left = `${event.clientX - bounds.left}px`;
        labelEl.style.top = `${event.clientY - bounds.top}px`;
        labelEl.style.opacity = "1";
      } else {
        labelEl.style.opacity = "0";
      }
    };

    const handlePointerDown = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObject(instancedMesh);
      if (intersections.length > 0) {
        onSelectNode(prepared.nodes[intersections[0].instanceId].id);
      }
    };

    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    let frameId;
    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();
      controls.update();

      nodeMaterial.uniforms.time.value = time;
      linkMaterial.uniforms.time.value = time;
      flowMaterial.uniforms.time.value = time;
      pathFlowMaterial.uniforms.time.value = time;

      if (selectedNodeId) {
        const node = prepared.nodes.find(n => n.id === selectedNodeId);
        if (node) {
          controls.target.lerp(new THREE.Vector3(node.x, node.y, node.z), 0.04);
        }
      }

      instancedMesh.rotation.y += 0.00008;
      scene.children.forEach(child => {
        if (child instanceof THREE.Line) child.rotation.y += 0.00008;
      });

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = root.clientWidth, h = root.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      root.removeChild(labelEl);
      controls.dispose();
      renderer.dispose();
      root.removeChild(renderer.domElement);
    };
  }, [graph, onSelectNode, pathEdges, pathNodeSet, prepared, selectedNodeId]);

  return <div className="cg-graph-scene" ref={mountRef} />;
}
