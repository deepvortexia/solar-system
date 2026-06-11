import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PLANET_DATA, ORBITS } from './planetData.js';
import './style.css';

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);

const camera = new THREE.PerspectiveCamera(
  50, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(55, 30, 90);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2;
controls.maxDistance = 450;

// ---------- lights ----------
const sunLight = new THREE.PointLight(0xfff1dc, 2.6, 0, 0); // decay 0: even lighting across the system
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x223344, 0.5));

// ---------- starfield ----------
{
  const count = 3000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 350 + Math.random() * 250;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xcdd6ff, size: 1.1, sizeAttenuation: true,
    transparent: true, opacity: 0.85, depthWrite: false,
  });
  scene.add(new THREE.Points(geo, mat));
}

// ---------- post-processing (no bloom: its separable blur creates boxy halos) ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());

// ---------- circular sun halo ----------
// Additive blending adds the texture's RGB to the screen, so the gradient must
// fade to pure BLACK at the edge: black adds nothing, making the visible halo
// exactly the circular gradient with zero contribution from the sprite's corners.
function makeHaloTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.00, 'rgb(255, 240, 205)');
  g.addColorStop(0.10, 'rgb(255, 218, 150)');
  g.addColorStop(0.22, 'rgb(235, 160, 85)');
  g.addColorStop(0.38, 'rgb(160, 95, 42)');
  g.addColorStop(0.55, 'rgb(90, 48, 20)');
  g.addColorStop(0.75, 'rgb(36, 18, 8)');
  g.addColorStop(1.00, 'rgb(0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- soft self-illumination ----------
// Reuse each body's color texture as its emissive map so the full texture is
// visible even on the side facing away from the sun.
function selfIlluminate(obj, intensity = 0.6) {
  obj.traverse((c) => {
    if (c.isMesh && c.material && 'emissive' in c.material) {
      c.material.emissiveMap = c.material.map;
      c.material.emissive = new THREE.Color(0xffffff);
      c.material.emissiveIntensity = intensity;
      c.material.needsUpdate = true;
    }
  });
}

// ---------- load the Blender-built GLTF ----------
const orbitPivots = [];   // { pivot, speed }
const spinners = [];      // { mesh, speed }
const clickable = [];     // meshes that respond to clicks
let moonPivot = null;

new GLTFLoader().load('/solar-system.gltf', (gltf) => {
  const root = gltf.scene;
  scene.add(root);

  const sun = root.getObjectByName('Sun');
  if (sun) {
    spinners.push({ mesh: sun, speed: 0.02 });
    clickable.push(sun);
    // depth-tested sprite: the sun sphere covers its center, planets occlude it
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeHaloTexture(),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }));
    halo.scale.set(32, 32, 1);
    sun.add(halo);
  }

  const ORBIT_BASE = 0.25; // rad/s for a 1-Earth-year orbit
  const SPIN_BASE = 0.35;  // rad/s for a 24-hour day

  for (const [name, orbit] of Object.entries(ORBITS)) {
    const planet = root.getObjectByName(name);
    if (!planet) continue;

    const pivot = new THREE.Group();
    root.add(pivot);
    pivot.attach(planet); // keeps world transform
    pivot.rotation.y = Math.random() * Math.PI * 2; // scatter starting angles
    // sqrt scaling: outer planets orbit slower but stay visibly in motion
    // (true 1/period would leave Uranus/Neptune ~660x slower than Earth)
    orbitPivots.push({ pivot, speed: ORBIT_BASE / Math.sqrt(orbit.period) });
    spinners.push({ mesh: planet, speed: SPIN_BASE / orbit.day });
    clickable.push(planet);

    if (name === 'Earth') {
      const moon = root.getObjectByName('Moon');
      if (moon) {
        moonPivot = new THREE.Group();
        moonPivot.position.copy(planet.position);
        pivot.add(moonPivot);
        moonPivot.attach(moon);
        clickable.push(moon);
      }
    }
    if (name === 'Saturn') {
      const rings = root.getObjectByName('SaturnRings');
      if (rings) clickable.push(rings);
    }
  }

  for (const obj of clickable) {
    if (obj.name !== 'Sun') selfIlluminate(obj);
  }

  document.getElementById('loading').classList.add('hidden');
}, undefined, (err) => {
  document.querySelector('#loading p').textContent = 'Failed to load scene: ' + err.message;
});

// ---------- picking ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tooltip = document.getElementById('tooltip');
const panel = document.getElementById('info-panel');
let followTarget = null;

function pick(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickable, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj && !PLANET_DATA[obj.name] && obj.name !== 'SaturnRings') obj = obj.parent;
  if (obj && obj.name === 'SaturnRings') obj = obj.parent; // rings count as Saturn
  return obj && PLANET_DATA[obj.name] ? obj : null;
}

function showInfo(name) {
  const d = PLANET_DATA[name];
  document.getElementById('info-name').textContent = name;
  document.getElementById('info-type').textContent = d.type;
  document.getElementById('info-stats').innerHTML = Object.entries(d.stats)
    .map(([k, v]) => `<div class="stat"><span>${k}</span><strong>${v}</strong></div>`)
    .join('');
  document.getElementById('info-fact').textContent = d.fact;
  panel.classList.add('open');
}

let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return; // it was a drag, not a click
  const obj = pick(e);
  if (obj) {
    followTarget = obj;
    showInfo(obj.name);
  } else {
    panel.classList.remove('open');
    followTarget = null;
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  const obj = pick(e);
  renderer.domElement.style.cursor = obj ? 'pointer' : 'grab';
  if (obj) {
    tooltip.textContent = obj.name;
    tooltip.style.left = e.clientX + 14 + 'px';
    tooltip.style.top = e.clientY + 10 + 'px';
    tooltip.classList.add('visible');
  } else {
    tooltip.classList.remove('visible');
  }
});

document.getElementById('close-panel').addEventListener('click', () => {
  panel.classList.remove('open');
  followTarget = null;
});

// ---------- animation ----------
const clock = new THREE.Clock();
const targetPos = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  for (const { pivot, speed } of orbitPivots) pivot.rotation.y += speed * dt;
  for (const { mesh, speed } of spinners) mesh.rotateY(speed * dt);
  if (moonPivot) moonPivot.rotation.y += 0.4 * dt;

  if (followTarget) {
    followTarget.getWorldPosition(targetPos);
    controls.target.lerp(targetPos, 0.06);
  }

  controls.update();
  composer.render();
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
