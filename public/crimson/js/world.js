// Sedona at night: an ink-painted sky all the way round, desert hills, sandstone mesas and
// spires, junipers, boulders, and grass that leans away from the fighters.
import * as THREE from 'three';
import { scene, toonRamp, LITE } from './render.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
export const ARENA = 22;
export const FOG_COLOR = new THREE.Color(0.075, 0.075, 0.078);
export const FOG_DENSITY = 0.017;
scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
scene.background = FOG_COLOR.clone();

// the moon in the sky painting sits at this bearing; the fight is laid out to face it
const MOON_THETA = 0.18 * TAU;
export const MOON_DIR = new THREE.Vector3(Math.sin(MOON_THETA), 0.62, Math.cos(MOON_THETA)).normalize();
export const FACE_DIR = new THREE.Vector3(Math.sin(MOON_THETA), 0, Math.cos(MOON_THETA));

// value noise, for the ground and the rocks
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
}
function fbm(x, y, o = 5) { let v = 0, a = 0.5; for (let i = 0; i < o; i++) { v += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return v; }
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const rim = THREE.MathUtils.smoothstep(r, ARENA + 3, ARENA + 45);
  const ridge = Math.pow(1 - Math.abs(fbm(x * 0.02 + 3, z * 0.02 - 7, 4) * 2 - 1), 2);
  return fbm(x * 0.08, z * 0.08, 3) * 0.3 + rim * (ridge * 5 + fbm(x * 0.04, z * 0.04, 5) * 4);
}

function canvasTex(w, h, fn, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: toonRamp, ...opts });

/* ---------------- sky ---------------- */
export function buildSky() {
  const tex = new THREE.TextureLoader().load('art/sky.webp');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1;
  const R = 1400, aspect = 3876 / 878, H = TAU * R / aspect;
  const top = 10 + 0.64 * H;
  const geo = new THREE.CylinderGeometry(R, R, H, 96, 1, true);
  const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false, color: new THREE.Color(0.9, 0.9, 0.9) }));
  sky.position.y = top - H / 2;
  sky.renderOrder = -10;
  scene.add(sky);
  // a dark cap overhead, above the painting
  const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshBasicMaterial({ color: 0x030303, fog: false, depthWrite: false, side: THREE.DoubleSide }));
  cap.rotation.x = Math.PI / 2; cap.position.y = top - 1; cap.renderOrder = -10;
  scene.add(cap);
  return sky;
}

/* ---------------- ground ---------------- */
export function buildGround() {
  const size = 900, seg = 240;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = groundHeight(x, z);
    pos.setY(i, h);
    // sandstone strata as bands of grey, dust lighter in the flats
    const band = 0.5 + 0.5 * Math.sin(h * 1.6 + fbm(x * 0.05, z * 0.05, 2) * 3);
    const v = h < 1 ? 0.36 + fbm(x * 0.3, z * 0.3, 2) * 0.14 : 0.26 + band * 0.2;
    col[i * 3] = v * 1.02; col[i * 3 + 1] = v * 0.98; col[i * 3 + 2] = v * 0.95;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const tex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#9a948c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600 * g; i++) {
      const v = 90 + Math.random() * 90 | 0;
      g.fillStyle = `rgba(${v},${v - 4},${v - 8},${Math.random() * 0.35})`;
      const r = Math.random() * 10 + 0.5;
      g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, r, r * rand(0.3, 1), Math.random() * 3, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(40,38,36,0.35)';
    for (let i = 0; i < 70; i++) { g.lineWidth = Math.random() * 1.6; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.bezierCurveTo(x + rand(-30, 30), y + rand(-10, 10), x + rand(-40, 40), y + rand(-10, 10), x + rand(-60, 60), y + rand(-12, 12)); g.stroke(); }
  }, [140, 140]);
  const ground = new THREE.Mesh(geo, toon({ map: tex, vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

/* ---------------- sandstone mesas and spires ---------------- */
const strataTex = canvasTex(64, 512, (g, w, h) => {
  let y = 0;
  while (y < h) { const t = rand(4, 26), v = 118 + Math.random() * 46 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 10})`; g.fillRect(0, y, w, t); y += t; }
  g.fillStyle = 'rgba(20,20,20,0.5)';
  for (let i = 0; i < 40; i++) g.fillRect(0, Math.random() * h, w, 1.5);
});
strataTex.wrapS = strataTex.wrapT = THREE.RepeatWrapping;
function rockColumn(r0, r1, h, sides, rough) {
  const geo = new THREE.CylinderGeometry(r1, r0, h, sides, Math.max(3, Math.round(h / 3)), false);
  const p = geo.attributes.position, seed = Math.random() * 100;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z);
    const k = 1 + (fbm(a * 2 + seed, y * 0.08, 3) - 0.5) * rough + Math.sin(y * 0.9 + seed) * 0.04;
    if (Math.abs(y) < h / 2 - 0.01) { p.setX(i, x * k); p.setZ(i, z * k); }
  }
  geo.translate(0, h / 2, 0);
  geo.computeVertexNormals();
  return geo;
}
const rockMat = toon({ map: strataTex, color: 0xb8b2aa });
function formation(x, z, kind, s) {
  const g = new THREE.Group(); g.position.set(x, groundHeight(x, z) - 2, z); g.rotation.y = rand(0, TAU);
  const add = (geo, px, py, pz) => { const m = new THREE.Mesh(geo, rockMat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  if (kind === 'mesa') {
    add(rockColumn(34 * s, 28 * s, 10 * s, 11, 0.35), 0, 0, 0);
    add(rockColumn(24 * s, 20 * s, 22 * s, 10, 0.3), rand(-3, 3) * s, 10 * s, 0);
    add(rockColumn(19 * s, 18 * s, 4 * s, 9, 0.2), 0, 32 * s, 0);
  } else if (kind === 'cathedral') {
    add(rockColumn(38 * s, 30 * s, 14 * s, 12, 0.4), 0, 0, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + rand(-0.3, 0.3), r = rand(5, 16) * s; add(rockColumn(rand(4, 7) * s, rand(1.5, 3) * s, rand(24, 44) * s, 7, 0.5), Math.sin(a) * r, 12 * s, Math.cos(a) * r); }
  } else if (kind === 'bell') {
    add(rockColumn(30 * s, 22 * s, 12 * s, 12, 0.3), 0, 0, 0);
    add(rockColumn(22 * s, 10 * s, 18 * s, 11, 0.3), 0, 12 * s, 0);
    add(rockColumn(10 * s, 3 * s, 14 * s, 9, 0.3), 0, 30 * s, 0);
  } else {
    add(rockColumn(7 * s, 3 * s, 40 * s, 8, 0.45), 0, 0, 0);
    add(rockColumn(14 * s, 8 * s, 8 * s, 9, 0.3), 0, 0, 0);
  }
  scene.add(g);
}
export function buildRocks() {
  // a few formations close enough to show their strata; the painted sky carries the far ones
  const kinds = ['spire', 'bell', 'mesa', 'spire', 'cathedral', 'bell'];
  const moonA = Math.atan2(FACE_DIR.x, FACE_DIR.z);
  kinds.forEach((k, i) => {
    let a = moonA + 0.7 + i / kinds.length * (TAU - 1.4) + rand(-0.15, 0.15);
    const r = rand(62, 95);
    formation(Math.sin(a) * r, Math.cos(a) * r, k, rand(0.45, 0.7));
  });
}

/* ---------------- boulders ---------------- */
export const colliders = [];
function boulderGeo(r) {
  const geo = new THREE.IcosahedronGeometry(r, 2), p = geo.attributes.position, seed = Math.random() * 50;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)); const n = v.clone().normalize();
    const k = 1 + (fbm(n.x * 2 + seed, n.y * 2 + n.z * 2, 3) - 0.5) * 0.7;
    v.multiplyScalar(k); v.y *= 0.7; p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
export function buildBoulders() {
  const mat = toon({ map: strataTex, color: 0xa8a39c });
  const place = (x, z, r, solid) => {
    const m = new THREE.Mesh(boulderGeo(r), mat);
    m.position.set(x, groundHeight(x, z) + r * 0.25, z); m.rotation.y = rand(0, TAU);
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
    if (solid) colliders.push({ x, z, r: r * 0.9 });
  };
  for (let i = 0; i < 34; i++) { const a = rand(0, TAU), r = rand(ARENA + 1, ARENA + 7); place(Math.sin(a) * r, Math.cos(a) * r, rand(1.2, 3.2), true); }
  for (let i = 0; i < 9; i++) { const a = rand(0, TAU), r = rand(11, ARENA - 3); place(Math.sin(a) * r, Math.cos(a) * r, rand(0.6, 1.3), true); }
  for (let i = 0; i < 60; i++) { const a = rand(0, TAU), r = rand(ARENA + 8, 90); place(Math.sin(a) * r, Math.cos(a) * r, rand(1, 5), false); }
}

/* ---------------- junipers ---------------- */
function juniperGeo() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.12, 0.28, 2.2, 6, 4);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 2.3) * 0.15); }
  trunk.translate(0, 1.1, 0); parts.push(trunk);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.IcosahedronGeometry(rand(0.7, 1.3), 1), q = b.attributes.position;
    for (let k = 0; k < q.count; k++) q.setXYZ(k, q.getX(k) * rand(0.85, 1.15), q.getY(k) * rand(0.6, 0.9), q.getZ(k) * rand(0.85, 1.15));
    b.translate(rand(-1, 1), rand(1.8, 3.2), rand(-1, 1)); parts.push(b);
  }
  const merged = mergeGeos(parts);
  merged.computeVertexNormals();
  return merged;
}
function mergeGeos(list) {
  list = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3); let o = 0;
  for (const g of list) { const a = g.attributes.position.array; pos.set(a, o); o += a.length; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return geo;
}
export function buildJunipers() {
  const mat = toon({ color: 0x2a2c28 });
  for (let v = 0; v < 3; v++) {
    const geo = juniperGeo(), count = 60;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), r = ARENA + 4 + Math.pow(Math.random(), 1.3) * 110;
      const x = Math.sin(a) * r, z = Math.cos(a) * r, k = rand(0.8, 1.8);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU)); s.set(k, k * rand(0.8, 1.2), k);
      m.compose(new THREE.Vector3(x, groundHeight(x, z) - 0.2, z), q, s); inst.setMatrixAt(i, m);
    }
    inst.castShadow = true; inst.receiveShadow = true;
    scene.add(inst);
  }
}

/* ---------------- desert grass ---------------- */
export const grassUniforms = {
  uTime: { value: 0 }, uWind: { value: 1 },
  uPush: { value: [new THREE.Vector4(0, 0, 1, 0), new THREE.Vector4(0, 0, 1, 0)] },
  uBlast: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
  uFogColor: { value: FOG_COLOR }, uFogDensity: { value: FOG_DENSITY },
};
const grassVert = /* glsl */`
  attribute vec3 offset; attribute vec4 prm; attribute vec2 lean; attribute float tone;
  uniform float uTime, uWind, uFogDensity; uniform vec4 uPush[2]; uniform vec4 uBlast[4];
  varying float vY; varying float vFog; varying float vTone;
  void main(){
    float h = prm.x; float c = cos(prm.z), s = sin(prm.z);
    vec3 p = position; p.x *= prm.w;
    vec3 wp = offset + vec3(p.x * c, p.y * h, p.x * s);
    vec2 bend = lean;
    float w = sin(uTime * 1.3 + prm.y + offset.x * 0.09 + offset.z * 0.05) + 0.4 * sin(uTime * 3.1 + prm.y * 3.);
    bend += vec2(w * 0.2 + 0.15, w * 0.1) * uWind;
    for (int i = 0; i < 2; i++){ vec2 d = offset.xz - uPush[i].xy; float dist = length(d); float f = 1. - smoothstep(uPush[i].z * 0.3, uPush[i].z, dist); bend += d / (dist + 0.001) * f * uPush[i].w; }
    for (int i = 0; i < 4; i++){ vec2 d = offset.xz - uBlast[i].xy; float dist = length(d); float f = exp(-pow((dist - uBlast[i].z) * 0.9, 2.)) * uBlast[i].w; bend += d / (dist + 0.001) * f * 1.8; }
    float k = p.y * p.y;
    wp.xz += bend * k * h * 0.55;
    wp.y -= dot(bend, bend) * k * h * 0.14;
    vec4 mv = viewMatrix * vec4(wp, 1.);
    gl_Position = projectionMatrix * mv;
    float d = length(mv.xyz);
    vFog = 1. - exp(-uFogDensity * uFogDensity * d * d);
    vY = p.y; vTone = tone;
  }`;
const grassFrag = /* glsl */`
  uniform vec3 uFogColor; varying float vY; varying float vFog; varying float vTone;
  void main(){
    vec3 col = vec3(mix(0.05, 0.62, vY)) * vTone;
    col = mix(col, uFogColor, vFog);
    gl_FragColor = vec4(col, 1.);
  }`;
function bladeGeo() {
  const g = new THREE.BufferGeometry(), pos = [], idx = [];
  for (let i = 0; i < 4; i++) { const y = i / 3, w = (1 - y * 0.92) * 0.5; pos.push(-w, y, 0, w, y, 0); if (i < 3) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}
export function buildGrass() {
  const list = [];
  const tuft = (x, z, h, n) => {
    const lx = rand(-0.2, 0.2), lz = rand(-0.2, 0.2), ph = rand(0, TAU), y = groundHeight(x, z);
    for (let k = 0; k < n; k++) list.push({ x: x + rand(-0.15, 0.15), y, z: z + rand(-0.15, 0.15), h: h * rand(0.6, 1), ph, rot: rand(0, Math.PI), w: 0.05, lx: lx + rand(-0.35, 0.35), lz: lz + rand(-0.35, 0.35), tone: rand(0.8, 1.3) });
  };
  const g = LITE ? 0.55 : 1;
  for (let i = 0; i < 1400 * g; i++) { const r = Math.sqrt(Math.random()) * ARENA, a = rand(0, TAU); tuft(Math.sin(a) * r, Math.cos(a) * r, rand(0.2, 0.55), 4); }
  for (let i = 0; i < 2600 * g; i++) { const r = ARENA + Math.pow(Math.random(), 1.5) * 70, a = rand(0, TAU); tuft(Math.sin(a) * r, Math.cos(a) * r, rand(0.4, 1.1), 5); }
  const base = bladeGeo(), geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.attributes.position = base.attributes.position;
  const n = list.length, off = new Float32Array(n * 3), prm = new Float32Array(n * 4), lean = new Float32Array(n * 2), tone = new Float32Array(n);
  list.forEach((b, i) => { off.set([b.x, b.y, b.z], i * 3); prm.set([b.h, b.ph, b.rot, b.w], i * 4); lean.set([b.lx, b.lz], i * 2); tone[i] = b.tone; });
  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute('prm', new THREE.InstancedBufferAttribute(prm, 4));
  geo.setAttribute('lean', new THREE.InstancedBufferAttribute(lean, 2));
  geo.setAttribute('tone', new THREE.InstancedBufferAttribute(tone, 1));
  geo.instanceCount = n;
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: grassUniforms, vertexShader: grassVert, fragmentShader: grassFrag, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  scene.add(mesh);
}

/* ---------------- light ---------------- */
export const lights = {};
export function buildLights() {
  scene.add(new THREE.HemisphereLight(0x9aa2b0, 0x1a1816, 0.55));
  const moon = new THREE.DirectionalLight(0xe6ecf5, 2.0);
  moon.castShadow = true;
  moon.shadow.mapSize.setScalar(LITE ? 1024 : 2048);
  Object.assign(moon.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 140 });
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04;
  scene.add(moon, moon.target);
  const fill = new THREE.DirectionalLight(0xffffff, 1.0);
  scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  scene.add(rim, rim.target);
  Object.assign(lights, { moon, fill, rim });
}
export function followLights(center, camPos) {
  const { moon, fill, rim } = lights;
  moon.position.copy(center).addScaledVector(MOON_DIR, 60);
  moon.target.position.copy(center);
  fill.position.copy(camPos).add(new THREE.Vector3(0, 5, 0)); fill.target.position.copy(center);
  rim.position.copy(center).addScaledVector(MOON_DIR, 20).setY(center.y + 12); rim.target.position.copy(center);
}

export function buildWorld() {
  buildSky(); buildGround(); buildRocks(); buildBoulders(); buildJunipers(); buildGrass(); buildLights();
}
