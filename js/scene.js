// Three.js scene: particles, clickable nodes, scroll-driven camera, raycasting.
// This file never touches the DOM outside of #bg-canvas.
// To open a project it dispatches: window.dispatchEvent(new CustomEvent('scene:open-project', { detail:{ index } }))

import * as THREE from 'three';
import { clamp, prefersReducedMotion } from './utils.js';

export async function initScene() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) throw new Error('Canvas #bg-canvas not found');

  /* ---------- shared state ---------- */
  const state = {
    scrollProgress: 0,
    pointer: { x: 0, y: 0 },
    hovered: null
  };

  /* ---------- input ---------- */
  function updateScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    state.scrollProgress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', updateScroll);

  window.addEventListener('pointermove', (e) => {
    state.pointer.x = (e.clientX / window.innerWidth)  * 2 - 1;
    state.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, { passive: true });

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x05060a, 1);

  /* ---------- scene / camera ---------- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060a, 0.026);

  const camera = new THREE.PerspectiveCamera(
    60, window.innerWidth / window.innerHeight, 0.1, 300
  );
  camera.position.set(0, 0, 14);

  /* ---------- lights ---------- */
  scene.add(new THREE.AmbientLight(0x4a5580, 1.6));

  const key = new THREE.DirectionalLight(0x5eead4, 2.4);
  key.position.set(6, 9, 8);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xa78bfa, 2.0);
  rim.position.set(-7, -5, 5);
  scene.add(rim);

  /* ---------- particle texture (canvas-generated, no network request) ---------- */
  const dotTexture = (() => {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0,   'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(190,225,255,0.65)');
    g.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  /* ---------- particle field ---------- */
  const PARTICLE_COUNT = window.innerWidth < 700 ? 900 : 1700;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 46;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 62 - 6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 34 - 4;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
    size: 0.16,
    map: dotTexture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    color: 0xb9d4ff
  }));
  scene.add(particles);

  /* ---------- clickable project nodes ---------- */
  const NODE_CONFIG = [
    { pos: [-2.9, -13.0,  1.0], color: 0x5eead4 },
    { pos: [ 2.9, -16.5, -1.0], color: 0xa78bfa },
    { pos: [-2.6, -20.0,  1.5], color: 0x60a5fa },
    { pos: [ 2.7, -23.5,  0.0], color: 0xf472b6 }
  ];

  const nodes = NODE_CONFIG.map((cfg, i) => {
    const group = new THREE.Group();

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.85, 0),
      new THREE.MeshStandardMaterial({
        color: 0x0d1120,
        emissive: cfg.color,
        emissiveIntensity: 0.6,
        metalness: 0.7,
        roughness: 0.25,
        flatShading: true
      })
    );

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.3, 0),
      new THREE.MeshBasicMaterial({
        color: cfg.color,
        wireframe: true,
        transparent: true,
        opacity: 0.28
      })
    );

    group.add(core, shell);
    group.position.set(...cfg.pos);
    group.userData = {
      index: i,
      baseY: cfg.pos[1],
      spin: 0.18 + Math.random() * 0.22,
      core,
      shell
    };
    scene.add(group);
    return group;
  });

  /* ---------- raycasting (hover + click) ---------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function pickNode() {
    ndc.set(state.pointer.x, state.pointer.y);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(nodes, true);

    let found = null;
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && obj.userData?.index === undefined) obj = obj.parent;
      if (obj) found = obj;
    }

    if (found !== state.hovered) {
      state.hovered = found;
      document.body.style.cursor = found ? 'pointer' : '';
    }
  }

  window.addEventListener('click', (e) => {
    if (!state.hovered) return;
    // Don't hijack clicks on real interactive elements.
    if (e.target.closest('a, button, input, textarea, select, label, dialog')) return;

    window.dispatchEvent(new CustomEvent('scene:open-project', {
      detail: { index: state.hovered.userData.index }
    }));
  });

  /* ---------- resize ---------- */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  /* ---------- animation ---------- */
  const reduced = prefersReducedMotion();
  let camY = 0, camX = 0;
  let rafId = null;
  let last = performance.now();
  const start = performance.now();

  function update(dt, elapsed) {
    // scroll-driven camera
    const targetY = -state.scrollProgress * 28;
    camY += (targetY - camY) * Math.min(1, dt * 4);

    // mouse parallax
    const targetX = state.pointer.x * 1.6;
    camX += (targetX - camX) * Math.min(1, dt * 3);

    camera.position.set(camX, camY + state.pointer.y * 0.7, 14);
    camera.lookAt(camX * 0.35, camY - 2.4, 0);

    // particle drift
    particles.rotation.y = elapsed * 0.012;
    particles.rotation.x = Math.sin(elapsed * 0.08) * 0.05;

    // nodes
    nodes.forEach((node, i) => {
      const u = node.userData;
      node.rotation.y += dt * u.spin;
      node.rotation.x += dt * u.spin * 0.35;
      node.position.y = u.baseY + Math.sin(elapsed * 0.9 + i * 1.7) * 0.16;

      const hovered = state.hovered === node;
      const targetScale = hovered ? 1.28 : 1;
      const s = node.scale.x + (targetScale - node.scale.x) * Math.min(1, dt * 8);
      node.scale.setScalar(s);

      const targetEmissive = hovered ? 1.5 : 0.6;
      u.core.material.emissiveIntensity +=
        (targetEmissive - u.core.material.emissiveIntensity) * Math.min(1, dt * 8);

      u.shell.material.opacity = hovered ? 0.7 : 0.28;
    });

    // Hover raycast only on devices with a real pointer.
    if (window.matchMedia('(hover: hover)').matches) pickNode();
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt, (now - start) / 1000);
    renderer.render(scene, camera);
  }

  function startLoop() {
    if (rafId !== null) return;
    last = performance.now();
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Pause rendering when the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else if (!reduced) startLoop();
  });

  /* ---------- go ---------- */
  updateScroll();

  if (reduced) {
    // Static frame; only re-render on scroll so it's still scroll-driven.
    const renderStatic = () => {
      camY = -state.scrollProgress * 28;
      camera.position.set(0, camY, 14);
      camera.lookAt(0, camY - 2.4, 0);
      renderer.render(scene, camera);
    };
    renderStatic();
    window.addEventListener('scroll', renderStatic, { passive: true });
  } else {
    startLoop();
  }

  // Resolve after one painted frame so main.js can hide the loader.
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}