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
// Each star twinkles at its own rhythm: a custom shader reads a per-vertex `size`
// and `alpha` attribute (a plain PointsMaterial only supports one shared size),
// and the render loop drives them from a random phase + speed stored per star.
const STAR_BASE_SIZE = 1.1;
let starGeo = null;
let starMat = null;
let starPhases = null;
let starSpeeds = null;
{
  const count = isSmallScreen ? 1800 : 3000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  starPhases = new Float32Array(count);
  starSpeeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 350 + Math.random() * 250;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    starPhases[i] = Math.random() * Math.PI * 2;       // own starting point in the cycle
    starSpeeds[i] = 0.5 + Math.random();               // own twinkle speed (0.5..1.5)
    sizes[i] = STAR_BASE_SIZE;
    alphas[i] = 0.85;
  }
  starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  starGeo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0xcdd6ff) },
      // matches PointsMaterial size-attenuation: gl_PointSize = size * scale / -z
      uScale: { value: window.innerHeight * 0.5 * renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (uScale / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        if (dot(d, d) > 0.25) discard; // soft round point
        gl_FragColor = vec4(uColor, vAlpha);
      }
    `,
  });
  scene.add(new THREE.Points(starGeo, starMat));
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

function addLabel(body, text = body.name, offsetOverride = null) {
  // measure the body's own mesh, not Box3.setFromObject: that would include
  // children (sun halo sprite, Saturn's rings) and inflate by the box diagonal
  let radius = 1;
  if (body.isMesh) {
    if (!body.geometry.boundingSphere) body.geometry.computeBoundingSphere();
    const s = body.getWorldScale(new THREE.Vector3());
    radius = body.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z);
  }
  const tex = makeLabelTexture(text);
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
  labels.push({ sprite, body, offset: offsetOverride ?? radius + h * 0.75 });
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

  // override the orbital radii authored in the GLTF (planets sit on +X from the
  // origin) to spread the system out, especially the bunched-up inner planets
  const ORBIT_RADII = {
    Mercury: 14, Venus: 20, Earth: 28, Mars: 38,
    Jupiter: 55, Saturn: 78, Uranus: 100, Neptune: 118,
  };

  for (const [name, orbit] of Object.entries(ORBITS)) {
    const planet = root.getObjectByName(name);
    if (!planet) continue;

    // push the planet to its new radius before attaching, so the pivot captures it
    if (ORBIT_RADII[name] !== undefined) planet.position.x = ORBIT_RADII[name];

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
let mascotLight = null;     // point light that follows the mascot (set on load)
const flames = [];          // thruster-flame meshes, flickered in the render loop
const eyes = [];            // { mesh, baseY, blinkStart, nextBlink } — blink independently
const arms = [];            // { mesh, baseZ, phase, bigStart, nextBig } — idle + big waves
let halo = null;            // thin energy ring above Terra's head — pulses/breathes
let mouth = null;           // { mesh, originalPosition, baseZ, target, nextExpr }
const MASCOT_Y = 13;        // above the Sun surface (r=5) and the orbital plane
const MASCOT_HEIGHT = 6;    // normalised world height — small against the system
const MASCOT_HOME = new THREE.Vector3(0, MASCOT_Y, 0);

// faces the mouth cycles between — rotation.z only (relative to its rest pose).
// Scaling shifted the mesh off the face because its geometry isn't centred on
// its own origin, so expressions are pure rotation and the position is pinned.
const MOUTH_SHAPES = [0.0, 0.3, -0.3]; // happy (flat), sad (curl up), surprised

// flight state: the mascot flies to a clicked planet, orbits it, then flies home
let mascotTarget = null;    // planet to orbit, or null to return home
let mascotOrbitRadius = 0;  // distance from the planet centre to circle at
let mascotFlying = false;   // true during the 2s transit (boost the flames)
let mascotArrivalCb = null; // called once when a flight to a planet completes
let flightStart = 0;        // clock time the current flight began
const FLIGHT_TIME = 2;      // seconds
const flightFrom = new THREE.Vector3();
const _planetWorld = new THREE.Vector3();
const _mascotDest = new THREE.Vector3();
const _lightDir = new THREE.Vector3(); // mascot -> camera, for the follow light
const _flyDir = new THREE.Vector3();   // mascot -> destination, for flight heading
const _ringColor = new THREE.Color();  // scratch for the gold<->white ring cycle
const _white = new THREE.Color(0xffffff);

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
  // well above it, so give it its own light; it follows the mascot every frame
  mascotLight = new THREE.PointLight(0xffffff, 3, 0, 0);
  mascotLight.position.set(0, MASCOT_Y, 6);
  scene.add(mascotLight);

  const galaxyTex = makeGalaxyTexture(); // shared starfield map for the ring(s)
  let haloMesh = null;                   // outer ring — anchors the orbiting particles

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
    // the back/jetpack ("Pack"/"Back") can read as a black bar when the light is
    // on the far side, so give those a faint self-fill of their own colour. Only
    // touch matte parts (black emissive) so the glowing pack lights stay bright.
    if (c.isMesh && (c.name.includes('Pack') || c.name.includes('Back')) &&
        c.material && c.material.emissive && c.material.emissive.equals(new THREE.Color(0x000000))) {
      c.material.emissive = c.material.color ? c.material.color.clone() : new THREE.Color(0x888888);
      c.material.emissiveIntensity = 0.25;
      c.material.needsUpdate = true;
    }
    // each eye keeps its own randomized blink clock so the two blink independently
    if (c.isMesh && c.name.includes('Eye')) {
      eyes.push({ mesh: c, baseY: c.scale.y, blinkStart: -10, nextBlink: 1 + Math.random() * 4 });
    }
    // each arm gets a random phase plus its own timer for the occasional big wave
    if (c.isMesh && c.name.includes('Arm')) {
      arms.push({
        mesh: c, baseZ: c.rotation.z,
        phase: Math.random() * Math.PI * 2,
        bigStart: -10, nextBig: 3 + Math.random() * 4,
      });
    }
    // ring / halo: lay it flat and turn it into a "mini galaxy" — a starfield
    // emissive map glowing gold/white, spun fast on Y (pulse/colour in the loop).
    // The orbiting golden particles are built after the pivot exists.
    if (c.isMesh && (c.name.includes('Ring') || c.name.includes('Halo'))) {
      c.rotation.x = 0;
      c.rotation.z = 0;
      if (c.material && 'emissive' in c.material) {
        c.material.emissive = new THREE.Color(0xFFD700);
        c.material.emissiveMap = galaxyTex;
        c.material.emissiveIntensity = 3;
        c.material.needsUpdate = true;
      }
      ringSpins.push({ mesh: c });
      if (!c.name.includes('Inner')) haloMesh = c; // outer ring anchors the particles
    }
    // mouth/smile: the glTF bakes the mouth's offset into its geometry (the node
    // sits at the model origin), so rotating the mesh would swing it off the face
    // around a far pivot. Re-centre the geometry on the node origin and shift the
    // node to compensate, so expression rotations spin the smile about its own
    // centre and stay put. (Safe here: the Smile node has identity rotation/scale.)
    if (c.isMesh && !mouth && (c.name.includes('Smile') || c.name.includes('Mouth'))) {
      c.geometry.computeBoundingBox();
      const gc = c.geometry.boundingBox.getCenter(new THREE.Vector3());
      c.geometry.translate(-gc.x, -gc.y, -gc.z);
      c.position.add(gc);
      mouth = {
        mesh: c, originalPosition: c.position.clone(), baseZ: c.rotation.z,
        target: MOUTH_SHAPES[0], nextExpr: 4 + Math.random() * 4,
      };
    }
  });

  const pivot = new THREE.Group();
  pivot.add(model);
  pivot.position.set(0, MASCOT_Y, 0);
  scene.add(pivot);
  mascot = pivot;

  // golden particles orbiting the head at the ring's height. Parented to the
  // pivot (scale 1, so world-unit sizes) they travel with the mascot anywhere.
  if (haloMesh) {
    pivot.updateMatrixWorld(true);
    haloMesh.geometry.computeBoundingBox();
    const bb = haloMesh.geometry.boundingBox;
    const tube = (bb.max.y - bb.min.y) / 2;
    const major = (bb.max.x - bb.min.x) / 2 - tube;
    const ws = haloMesh.getWorldScale(new THREE.Vector3());
    const ringR = major * Math.max(ws.x, ws.z); // ring radius in world units
    const galaxy = new THREE.Group();
    galaxy.position.copy(pivot.worldToLocal(haloMesh.getWorldPosition(new THREE.Vector3())));
    pivot.add(galaxy);
    for (let i = 0; i < 24; i++) {
      const sparkle = i % 4 === 0; // every 4th: larger + brighter gold sparkle
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(sparkle ? 0.12 : 0.08, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0x000000,
          emissive: new THREE.Color(sparkle ? 0xFFA500 : 0xFFD700),
          emissiveIntensity: sparkle ? 2.6 : 1.6,
        }),
      );
      galaxy.add(mesh);
      ringParticles.push({
        mesh,
        radius: ringR + Math.random() * 0.8, // ringR .. ringR + 0.8
        speed: 0.4 + Math.random() * 1.2,    // each orbits at its own pace
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  // floating name label, same sprite/canvas system as the planets. The model is
  // re-centred to span ±MASCOT_HEIGHT/2, so this sits just above the head/ring.
  addLabel(mascot, 'Terra', MASCOT_HEIGHT / 2 + 1.3);
}, undefined, (err) => {
  console.error('Mascot failed to load:', err); // non-fatal: the system still renders
});

// send the mascot off to orbit a clicked planet, just clear of its surface
function flyMascotTo(planet, onArrival = null) {
  let radius = 1;
  if (planet.isMesh) {
    if (!planet.geometry.boundingSphere) planet.geometry.computeBoundingSphere();
    const sc = planet.getWorldScale(new THREE.Vector3());
    radius = planet.geometry.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z);
  }
  mascotTarget = planet;
  mascotOrbitRadius = radius + 2.5; // ~2-3 units clear of the surface
  mascotArrivalCb = onArrival;      // fired once the flight completes
  startMascotFlight();
}

function flyMascotHome() {
  if (!mascotTarget && !mascotFlying) return; // already home — nothing to do
  mascotTarget = null;
  mascotOrbitRadius = 0;
  mascotArrivalCb = null; // cancel any pending arrival reveal
  startMascotFlight();
}

function startMascotFlight() {
  if (!mascot) return;
  flightFrom.copy(mascot.position);
  flightStart = clock.elapsedTime;
  mascotFlying = true;
}

// where the mascot wants to be this frame: orbiting the live (still-moving)
// target, or bobbing at its home spot above the Sun
function mascotDestination(t) {
  if (mascotTarget) {
    mascotTarget.getWorldPosition(_planetWorld);
    const a = t * 0.8; // angular speed of the mascot's orbit around the planet
    // X/Z trace the circle; Y wobbles at a *different* frequency (a * 0.5) to tilt
    // the orbit into a 3D figure-8 ellipse, plus an energetic 1.2-amplitude bob
    _mascotDest.set(
      _planetWorld.x + Math.cos(a) * mascotOrbitRadius,
      _planetWorld.y + Math.sin(a * 0.5) * mascotOrbitRadius * 0.4 + Math.sin(t * 1.6) * 1.2,
      _planetWorld.z + Math.sin(a) * mascotOrbitRadius,
    );
  } else {
    _mascotDest.set(MASCOT_HOME.x, MASCOT_HOME.y + Math.sin(t * 1.1) * 0.6, MASCOT_HOME.z);
  }
  return _mascotDest;
}

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
  flyMascotHome();
  resetting = true; // animated in the render loop
}

// Cinematic click flow: clicking a planet sends Terra flying there, and the info
// only appears once she arrives. A small top pill shows a "flying…" hint during
// transit; on phones it doubles as a compact arrival badge (the bottom-sheet panel
// would overlap Terra, so phones get the pill instead of the panel).
const isMobileLayout = () => window.matchMedia('(max-width: 600px)').matches;
const badge = document.getElementById('planet-badge');
let badgeTimer = 0;

function showBadge(text, autoHideMs = 0) {
  clearTimeout(badgeTimer);
  badge.textContent = text;
  badge.classList.add('visible');
  if (autoHideMs) badgeTimer = setTimeout(() => badge.classList.remove('visible'), autoHideMs);
}

function hideBadge() {
  clearTimeout(badgeTimer);
  badge.classList.remove('visible');
}

// fired when Terra reaches the planet: reveal the info — the side panel on desktop,
// a compact auto-hiding badge on phones
function showArrival(name) {
  if (isMobileLayout()) {
    const d = PLANET_DATA[name];
    showBadge(d ? `${name} · ${d.type}` : name, 4000); // compact pill, auto-hide after 4s
  } else {
    hideBadge();
    showInfo(name); // side panel, fades in via CSS
  }
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
    panel.classList.remove('open');  // info appears on arrival, not on click
    // Terra flies to the planet; the info is revealed only when she arrives there
    showBadge(`Flying to ${obj.name}…`);
    flyMascotTo(obj, () => showArrival(obj.name));
  } else {
    panel.classList.remove('open');
    hideBadge();
    followTarget = null;
    flyMascotHome();
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
  // the panel just closes; Terra keeps orbiting the planet she flew to
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
    // swipe-down only dismisses the panel; Terra keeps orbiting
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

  // stars twinkle: each cycles its size + alpha at its own random phase/speed
  {
    const t = clock.elapsedTime;
    const sizeArr = starGeo.attributes.size.array;
    const alphaArr = starGeo.attributes.alpha.array;
    for (let i = 0; i < starPhases.length; i++) {
      sizeArr[i] = STAR_BASE_SIZE * (0.5 + 0.5 * Math.sin(t * starSpeeds[i] + starPhases[i]));
      alphaArr[i] = 0.5 + 0.35 * Math.sin(t * starSpeeds[i] + starPhases[i] + 1.047);
    }
    starGeo.attributes.size.needsUpdate = true;
    starGeo.attributes.alpha.needsUpdate = true;
  }

  if (mascot) {
    const t = clock.elapsedTime;
    const dest = mascotDestination(t); // live target: orbit point or home, with bob
    const fe = t - flightStart;        // seconds elapsed into the current flight
    const p = THREE.MathUtils.clamp(fe / FLIGHT_TIME, 0, 1); // flight progress 0..1
    if (mascotFlying) {
      const ease = p * p * (3 - 2 * p);        // smoothstep ease in/out
      mascot.position.lerpVectors(flightFrom, dest, ease);
      if (p >= 1) {                            // arrived: hand off to steady orbit
        mascotFlying = false;
        if (mascotArrivalCb) { const cb = mascotArrivalCb; mascotArrivalCb = null; cb(); }
      }
    } else {
      mascot.position.copy(dest);
    }
    // the point light follows the mascot exactly, nudged toward the camera so the
    // side we're looking at is always the lit side
    mascotLight.position.copy(mascot.position);
    _lightDir.subVectors(camera.position, mascot.position).normalize().multiplyScalar(6);
    mascotLight.position.add(_lightDir);

    if (mascotFlying) {
      // Superman style: aim where we're going, then pitch flat (head leading).
      _flyDir.subVectors(dest, mascot.position);
      if (_flyDir.x * _flyDir.x + _flyDir.z * _flyDir.z > 1e-4) {
        mascot.rotation.y = Math.atan2(_flyDir.x, _flyDir.z); // face the destination
      }
      mascot.rotation.z = 0;
      // pitch toward horizontal over the first 0.3s, hold, then straighten in the
      // last 0.3s (p > 0.85) for an upright landing
      if (p > 0.85) {
        mascot.rotation.x = THREE.MathUtils.lerp(-1.4, 0, (p - 0.85) / 0.15);
      } else if (fe < 0.3) {
        mascot.rotation.x = THREE.MathUtils.lerp(0, -1.4, fe / 0.3);
      } else {
        mascot.rotation.x = -1.4; // cruising flat
      }
    } else {
      // not flying: face the camera on the Y axis only, fully upright
      mascot.rotation.y = Math.atan2(camera.position.x - mascot.position.x,
                                     camera.position.z - mascot.position.z);
      mascot.rotation.z = 0;
      mascot.rotation.x = 0;
    }

    // flames: while boosting to a planet, double the length and flicker far faster
    const flameSpeed = mascotFlying ? 120 : 25;
    const flameBoost = mascotFlying ? 2 : 1;
    for (const { mesh, baseScaleY } of flames) {
      mesh.scale.y = baseScaleY * flameBoost * (1 + Math.sin(t * flameSpeed) * 0.25);
    }

    // eyes blink independently: each closes to 0.05 over 0.08s then reopens, then
    // reschedules itself 2-6s out so the two eyes drift out of sync naturally
    for (const eye of eyes) {
      if (t >= eye.nextBlink) {
        eye.blinkStart = t;
        eye.nextBlink = t + 2 + Math.random() * 4; // 2-6s
      }
      const bt = t - eye.blinkStart;
      let k = 1;
      if (bt >= 0 && bt < 0.08) k = THREE.MathUtils.lerp(1, 0.05, bt / 0.08);     // closing
      else if (bt < 0.16) k = THREE.MathUtils.lerp(0.05, 1, (bt - 0.08) / 0.08);  // opening
      eye.mesh.scale.y = eye.baseY * k;
    }

    // arms: a gentle idle sin wave, with an occasional big wave (3x amplitude,
    // smoothly enveloped over 0.5s) every 3-7s
    for (const arm of arms) {
      if (t >= arm.nextBig) {
        arm.bigStart = t;
        arm.nextBig = t + 3 + Math.random() * 4; // 3-7s
      }
      let amp = 0.3;
      const bw = t - arm.bigStart;
      if (bw >= 0 && bw < 0.5) amp += Math.sin((bw / 0.5) * Math.PI) * 0.6; // peak 0.9 (3x)
      arm.mesh.rotation.z = arm.baseZ + Math.sin(t * 1.5 + arm.phase) * amp;
    }

    // ring / halo: fast Y spin; pulse intensity 2.0->4.0 and cycle the emissive
    // colour gold<->white so the starfield map shimmers
    _ringColor.set(0xFFD700).lerp(_white, (Math.sin(t * 2) + 1) / 2);
    for (const { mesh } of ringSpins) {
      mesh.rotation.y += 1.6 * dt;
      if (mesh.material) {
        mesh.material.emissiveIntensity = 3.0 + Math.sin(t * 2) * 1.0;
        mesh.material.emissive.copy(_ringColor);
      }
    }

    // golden particles: each sweeps its own circular orbit with a gentle Y bob
    for (const p of ringParticles) {
      const a = t * p.speed + p.phase;
      p.mesh.position.set(Math.cos(a) * p.radius,
                          Math.sin(t * 1.5 + p.phase) * 0.15,
                          Math.sin(a) * p.radius);
    }

    // mouth: every 4-8s pick a new expression and smoothly rotate toward it.
    // Position is pinned to its rest pose every frame so it stays on the face.
    if (mouth) {
      if (t >= mouth.nextExpr) {
        mouth.target = MOUTH_SHAPES[Math.floor(Math.random() * MOUTH_SHAPES.length)];
        mouth.nextExpr = t + 4 + Math.random() * 4; // 4-8s
      }
      mouth.mesh.position.copy(mouth.originalPosition);
      mouth.mesh.rotation.z = THREE.MathUtils.lerp(mouth.mesh.rotation.z, mouth.baseZ + mouth.target, 0.1);
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
