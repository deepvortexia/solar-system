import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PLANET_DATA, ORBITS } from './planetData.js';
import './style.css';

// ---------- device profile ----------
const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// lower pixel-ratio cap on phones: full DPR + ACES tonemapping cooks low-end GPUs
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);

const camera = new THREE.PerspectiveCamera(
  50, window.innerWidth / window.innerHeight, 0.1, 2000);
// portrait screens need a wider pull-back so the horizontally-spread system fits
const fit = THREE.MathUtils.clamp(window.innerHeight / window.innerWidth, 1, 1.9);
camera.position.set(55, 30, 90).multiplyScalar(fit);
const HOME_POS = camera.position.clone();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2;
controls.maxDistance = isSmallScreen ? 300 : 450;
if (isCoarsePointer) {
  controls.enablePan = false; // two-finger pan strands touch users in empty space
  document.getElementById('hint').textContent =
    'Drag to orbit · Pinch to zoom · Tap a planet';
}

// ---------- lights ----------
const sunLight = new THREE.PointLight(0xfff1dc, 2.6, 0, 0); // decay 0: even lighting across the system
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x223344, 0.5));

// ---------- starfield ----------
{
  const count = isSmallScreen ? 1800 : 3000;
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

// ---------- floating name labels ----------
// Canvas-rendered text on a sprite: always faces the camera, glow comes from
// drawing the text twice with a wide then tight shadow blur.
function makeLabelTexture(text) {
  const fontSize = 80;
  const pad = 48; // room for the glow to bleed
  const font = `300 ${fontSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
  const canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  ctx.font = font;
  ctx.letterSpacing = '6px';
  canvas.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
  canvas.height = fontSize + pad * 2;
  ctx = canvas.getContext('2d'); // resizing the canvas resets its state
  ctx.font = font;
  ctx.letterSpacing = '6px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(170, 200, 255, 0.85)';
  ctx.shadowBlur = 22;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.shadowBlur = 7;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const labels = []; // { sprite, body, offset }

function addLabel(body) {
  // measure the body's own mesh, not Box3.setFromObject: that would include
  // children (sun halo sprite, Saturn's rings) and inflate by the box diagonal
  let radius = 1;
  if (body.isMesh) {
    if (!body.geometry.boundingSphere) body.geometry.computeBoundingSphere();
    const s = body.getWorldScale(new THREE.Vector3());
    radius = body.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z);
  }
  const tex = makeLabelTexture(body.name);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false, // never occluded: labels stay visible at any zoom
  }));
  sprite.renderOrder = 999; // draw after the scene so depthTest:false can't be overdrawn
  const h = isSmallScreen
    ? THREE.MathUtils.clamp(radius * 0.8, 1.6, 3.2) // legible on a 6" screen
    : THREE.MathUtils.clamp(radius * 0.55, 1.1, 2.4);
  sprite.scale.set(h * tex.image.width / tex.image.height, h, 1);
  scene.add(sprite);
  labels.push({ sprite, body, offset: radius + h * 0.75 });
}

// ---------- load the Blender-built GLTF ----------
const orbitPivots = [];   // { pivot, speed }
const spinners = [];      // { mesh, speed }
const clickable = [];     // meshes that respond to clicks

new GLTFLoader().load('/solar-system.gltf', (gltf) => {
  const root = gltf.scene;
  scene.add(root);

  const moon = root.getObjectByName('Moon');
  if (moon) moon.removeFromParent();

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

    // visible-scale boost: the rocky planets are only a few px wide on phones,
    // making them invisible and untappable at the default zoom
    if (isSmallScreen && ['Mercury', 'Venus', 'Earth', 'Mars'].includes(name)) {
      planet.scale.multiplyScalar(1.5);
    }

    if (name === 'Saturn') {
      const rings = root.getObjectByName('SaturnRings');
      if (rings) clickable.push(rings);
    }
  }

  for (const obj of clickable) {
    if (obj.name !== 'Sun') selfIlluminate(obj);
  }

  root.updateMatrixWorld(true); // labels measure bodies in world space
  for (const obj of clickable) {
    if (PLANET_DATA[obj.name]) addLabel(obj);
  }

  document.getElementById('loading').classList.add('hidden');
}, undefined, (err) => {
  document.querySelector('#loading p').textContent = 'Failed to load scene: ' + err.message;
});

// ---------- mascot ----------
// Earth-headed astronaut, floating above the Sun near the centre of the system.
let mascot = null;          // a pivot group; bobbed/swayed in the render loop
const flames = [];          // thruster-flame meshes, flickered in the render loop
const MASCOT_Y = 13;        // above the Sun surface (r=5) and the orbital plane
const MASCOT_HEIGHT = 6;    // normalised world height — small against the system

new GLTFLoader().load('/mascot.gltf', (gltf) => {
  const model = gltf.scene;

  // normalise to a fixed height and re-centre on its own origin, regardless of
  // how the Blender export happened to be positioned/scaled
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = MASCOT_HEIGHT / size.y;
  model.scale.setScalar(s);
  model.position.set(-center.x * s, -center.y * s, -center.z * s);

  // the Sun's point light decays toward the orbital plane and the mascot floats
  // well above it, so give it its own light so it reads clearly against space
  const mascotLight = new THREE.PointLight(0xffffff, 3, 0, 0);
  mascotLight.position.set(0, MASCOT_Y, 6);
  scene.add(mascotLight);

  // emissive flames/halo/buttons already carry emission from the glTF; make sure
  // they aren't dimmed, and record the flame meshes so they can flicker
  model.traverse((c) => {
    if (c.isMesh && c.material && c.material.emissive &&
        !c.material.emissive.equals(new THREE.Color(0x000000))) {
      c.material.emissiveIntensity = 1;
      c.material.needsUpdate = true;
    }
    if (c.isMesh && c.name.includes('Flame')) {
      flames.push({ mesh: c, baseScaleY: c.scale.y });
    }
  });

  const pivot = new THREE.Group();
  pivot.add(model);
  pivot.position.set(0, MASCOT_Y, 0);
  scene.add(pivot);
  mascot = pivot;
}, undefined, (err) => {
  console.error('Mascot failed to load:', err); // non-fatal: the system still renders
});

// ---------- picking ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tooltip = document.getElementById('tooltip');
const panel = document.getElementById('info-panel');
let followTarget = null;

const screenPos = new THREE.Vector3();

function pick(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  // labels are tap targets too: they're bigger than the small planets
  const sprites = labels.map((l) => l.sprite);
  const hits = raycaster.intersectObjects([...clickable, ...sprites], true);
  if (hits.length) {
    let obj = hits[0].object;
    const label = labels.find((l) => l.sprite === obj);
    if (label) return label.body;
    while (obj && !PLANET_DATA[obj.name] && obj.name !== 'SaturnRings') obj = obj.parent;
    if (obj && obj.name === 'SaturnRings') obj = obj.parent; // rings count as Saturn
    if (obj && PLANET_DATA[obj.name]) return obj;
  }
  // near-miss fallback: snap to the closest body within a finger-sized radius
  const maxPx = event.pointerType === 'touch' ? 36 : 18;
  let best = null;
  let bestD = maxPx;
  for (const obj of clickable) {
    if (!PLANET_DATA[obj.name]) continue;
    obj.getWorldPosition(screenPos).project(camera);
    if (screenPos.z > 1) continue; // behind the camera
    const sx = (screenPos.x + 1) / 2 * window.innerWidth;
    const sy = (1 - screenPos.y) / 2 * window.innerHeight;
    const d = Math.hypot(sx - event.clientX, sy - event.clientY);
    if (d < bestD) { bestD = d; best = obj; }
  }
  return best;
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

let resetting = false;

function resetView() {
  followTarget = null;
  panel.classList.remove('open');
  resetting = true; // animated in the render loop
}

let downAt = null;
let lastEmptyTap = { t: 0, x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
  resetting = false; // user grabbed the view mid-reset
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  // fingers wobble: a touch "tap" drifts far more px than a mouse click
  if (moved > (e.pointerType === 'touch' ? 14 : 6)) return;
  const obj = pick(e);
  if (obj) {
    followTarget = obj;
    showInfo(obj.name);
  } else {
    panel.classList.remove('open');
    followTarget = null;
    // double-tap on empty space resets the view
    const now = performance.now();
    if (now - lastEmptyTap.t < 350 &&
        Math.hypot(e.clientX - lastEmptyTap.x, e.clientY - lastEmptyTap.y) < 40) {
      resetView();
    }
    lastEmptyTap = { t: now, x: e.clientX, y: e.clientY };
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return; // no hover on touch; labels cover it
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

document.getElementById('reset-view').addEventListener('click', resetView);

// swipe down dismisses the bottom-sheet info panel on phones
let sheetTouch = null;
panel.addEventListener('touchstart', (e) => {
  sheetTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
panel.addEventListener('touchend', (e) => {
  if (!sheetTouch) return;
  const dy = e.changedTouches[0].clientY - sheetTouch.y;
  const dx = Math.abs(e.changedTouches[0].clientX - sheetTouch.x);
  sheetTouch = null;
  if (!window.matchMedia('(max-width: 600px)').matches) return; // sheet layout only
  if (panel.scrollTop <= 0 && dy > 70 && dx < 80) {
    panel.classList.remove('open');
    followTarget = null;
  }
}, { passive: true });

// ---------- animation ----------
const clock = new THREE.Clock();
const targetPos = new THREE.Vector3();
const ORIGIN = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  for (const { pivot, speed } of orbitPivots) pivot.rotation.y += speed * dt;
  for (const { mesh, speed } of spinners) mesh.rotateY(speed * dt);

  if (mascot) {
    const t = clock.elapsedTime;
    mascot.position.y = MASCOT_Y + Math.sin(t * 1.1) * 0.6; // gentle bob
    mascot.rotation.y = Math.sin(t * 0.4) * 0.4;            // sway, keeps the face toward you
    // flicker the thruster flames: a fast sine wobbles each flame's length
    for (const { mesh, baseScaleY } of flames) {
      mesh.scale.y = baseScaleY * (1 + Math.sin(t * 25) * 0.25);
    }
  }

  for (const { sprite, body, offset } of labels) {
    body.getWorldPosition(sprite.position);
    sprite.position.y += offset;
    // fade distant labels so small screens aren't wallpapered in text
    const d = sprite.position.distanceTo(camera.position);
    sprite.material.opacity = THREE.MathUtils.clamp(1.25 - d / 400, 0.35, 1);
  }

  if (resetting) {
    camera.position.lerp(HOME_POS, 0.08);
    controls.target.lerp(ORIGIN, 0.08);
    if (camera.position.distanceTo(HOME_POS) < 0.4) {
      camera.position.copy(HOME_POS);
      controls.target.copy(ORIGIN);
      resetting = false;
    }
  }

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
