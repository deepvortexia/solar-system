import * as THREE from 'three';

// Temple of Stars — a self-contained home-screen scene that SHARES the app's
// renderer. This module imports nothing from main.js (one-way dependency, no
// circular import): main.js calls createTemple({ renderer }) and drives it from
// the render loop. It owns its own scene + camera + props and exposes update().
export function createTemple({ renderer }) {
  const templeScene = new THREE.Scene();

  // ---- nebula background: radial gradient (center deep purple -> edge near-black)
  {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, '#1a0533'); // magenta-purple core
    g.addColorStop(1.0, '#000010'); // midnight-blue edge
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    templeScene.background = tex;
  }

  // ---- camera: fixed framing, no OrbitControls in the temple
  const aspect = window.innerWidth / window.innerHeight;
  const templeCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  templeCamera.position.set(0, 8, 22);
  templeCamera.lookAt(0, 4, 0);

  // ---- lighting: soft purple ambient + three coloured pools for crystal glow.
  // decay 0 matches the rest of the app's lights for predictable, even brightness.
  templeScene.add(new THREE.AmbientLight(0x4422aa, 0.6));
  const lightSpecs = [
    { color: 0xaa66ff, pos: [-11, 9, 6] },  // purple
    { color: 0x44ddff, pos: [11, 9, 6] },   // cyan
    { color: 0xffcc66, pos: [0, 12, -6] },  // gold
  ];
  for (const s of lightSpecs) {
    const pl = new THREE.PointLight(s.color, 2.0, 0, 0);
    pl.position.set(s.pos[0], s.pos[1], s.pos[2]);
    templeScene.add(pl);
  }

  // ---- mirror floor: dark glossy plane (stylized, no Reflector pass)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({
      color: 0x110022, roughness: 0.05, metalness: 0.8, envMapIntensity: 1.0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  templeScene.add(floor);

  // ---- crystal columns: 8 hexagonal tapered pillars in a circle of radius 14.
  // Each gets its OWN material so the per-column emissive breathe is independent.
  const columns = [];
  const COLUMN_COUNT = 8;
  const COLUMN_RADIUS = 14;
  const COLUMN_HEIGHT = 18;
  const colGeo = new THREE.CylinderGeometry(0.6, 0.9, COLUMN_HEIGHT, 6);
  const coreGeo = new THREE.CylinderGeometry(0.15, 0.15, COLUMN_HEIGHT, 6);
  for (let i = 0; i < COLUMN_COUNT; i++) {
    const a = (i / COLUMN_COUNT) * Math.PI * 2;
    const x = Math.cos(a) * COLUMN_RADIUS;
    const z = Math.sin(a) * COLUMN_RADIUS;
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x8844cc, roughness: 0.1, metalness: 0.3,
      emissive: 0x4411aa, emissiveIntensity: 0.4,
      transparent: true, opacity: 0.75,
    });
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(x, COLUMN_HEIGHT / 2, z); // base sits on the floor (y=0)
    templeScene.add(col);
    const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xaa66ff, emissiveIntensity: 1.5,
    }));
    core.position.set(x, COLUMN_HEIGHT / 2, z);
    templeScene.add(core);
    columns.push(col);
  }

  // ---- central energy portal: emissive ring + a soft inner glow disc
  const portal = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.18, 16, 60),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffcc44, emissiveIntensity: 2 }),
  );
  portal.position.set(0, 5, -4);
  templeScene.add(portal);
  const portalDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 60),
    new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0xffaa00, emissiveIntensity: 1,
      transparent: true, opacity: 0.15, depthWrite: false,
    }),
  );
  portalDisc.position.set(0, 5, -4);
  templeScene.add(portalDisc);

  // ---- avatar slots: left = index 0 (Terra), right = index 1 (Rosalys).
  // Returned so main.js can place the already-loaded GLTF clones onto them.
  const avatarSlots = [{ x: -5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }];

  // per-frame animation: portal pulse + gentle staggered column breathe. Camera
  // is fixed, so nothing here moves it.
  function update(dt, t) {
    portal.material.emissiveIntensity = 2 + Math.sin(t * 2) * 0.8;
    for (let i = 0; i < columns.length; i++) {
      columns[i].material.emissiveIntensity = 0.4 + Math.sin(t * 1.2 + i * 0.5) * 0.15;
    }
  }

  return { scene: templeScene, camera: templeCamera, update, avatarSlots };
}
