// Frostwing: rendering, input, sound and screens. The match itself lives in sim.js.
import * as THREE from "./lib/three.module.min.js";
import * as S from "./sim.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TOUCH = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
if (TOUCH) document.body.classList.add("touch");

/* ---------------- save ---------------- */
const SAVE_KEY = "frostwing.save.v1";
const save = (() => { try { return Object.assign({ best: 0, wins: 0, played: 0, pilot: "juno", diff: "ace", invert: 0, sound: 1 }, JSON.parse(localStorage.getItem(SAVE_KEY) || "{}")); } catch (e) { return { best: 0, wins: 0, played: 0, pilot: "juno", diff: "ace", invert: 0, sound: 1 }; } })();
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } };

/* ---------------- renderer ---------------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $("#gl"), antialias: !TOUCH, powerPreference: "high-performance" });
} catch (e) {
  $("#title").classList.add("hidden"); $("#fail").classList.remove("hidden");
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const FOG = new THREE.Color(0xa9bfd6);
scene.fog = new THREE.FogExp2(FOG, 0.00115);
scene.background = FOG;
const camera = new THREE.PerspectiveCamera(70, 1, 1, 6000);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 84 : 70; baseFov = camera.fov;
  camera.updateProjectionMatrix();
}
let baseFov = 70;
addEventListener("resize", resize);
resize();

/* ---------------- sky, light, land ---------------- */
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x7f9dc2) }, mid: { value: FOG.clone() }, sun: { value: new THREE.Vector3(0.4, 0.35, -0.85).normalize() } },
    vertexShader: "varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }",
    fragmentShader: "uniform vec3 top, mid, sun; varying vec3 vd; void main(){ float h = clamp(vd.y, 0.0, 1.0); vec3 c = mix(mid, top, pow(h, 0.6)); float s = max(dot(vd, sun), 0.0); c += vec3(1.0, 0.95, 0.85) * (pow(s, 64.0) * 0.8 + pow(s, 6.0) * 0.18); gl_FragColor = vec4(c, 1.0); }",
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  scene.userData.sky = sky;
}
scene.add(new THREE.HemisphereLight(0xdbe8ff, 0x5a6a80, 1.6));
const sunLight = new THREE.DirectionalLight(0xfff2e0, 2.1);
sunLight.position.set(400, 700, -800);
scene.add(sunLight);

function buildTerrain() {
  const SIZE = S.ARENA * 3.4, N = TOUCH ? 150 : 210;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, S.groundY(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nor = geo.attributes.normal, col = new Float32Array(pos.count * 3);
  const snow = new THREE.Color(0xf2f7ff), shade = new THREE.Color(0xc6d6ea), rock = new THREE.Color(0x3b4452), ice = new THREE.Color(0x9fc2dc), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const ny = nor.getY(i), y = pos.getY(i), x = pos.getX(i), z = pos.getZ(i);
    // slope decides snow or rock; a little noise breaks the edge; low flats read as blue ice
    const n = (Math.sin(x * 0.05) * Math.cos(z * 0.043) + Math.sin(x * 0.011 + z * 0.017)) * 0.08;
    const steep = clamp((0.86 - ny + n) * 6, 0, 1);
    c.copy(snow).lerp(shade, clamp((0.97 - ny) * 4, 0, 1));
    if (y < 6 && ny > 0.97) c.lerp(ice, clamp((6 - y) / 14, 0, 0.55));
    c.lerp(rock, steep);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const land = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(land);
}
buildTerrain();

const MAT = {
  stone: new THREE.MeshStandardMaterial({ color: 0x5a6576, roughness: 0.9, flatShading: true }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.85, flatShading: true }),
  snowCap: new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.95, flatShading: true }),
  glowRed: new THREE.MeshBasicMaterial({ color: 0xff4d5e }),
  glowCyan: new THREE.MeshBasicMaterial({ color: 0x7fe6ff }),
  glowViolet: new THREE.MeshBasicMaterial({ color: 0xc58cff }),
  glowBlue: new THREE.MeshBasicMaterial({ color: 0x5fc6ff }),
};
function buildRuins(ruins) {
  for (const r of ruins) {
    const g = new THREE.Group();
    if (r.kind === "slab") {
      const w = r.r * 1.6, d = r.r * 0.7;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, r.h, d, 1, 3, 1), MAT.stone);
      slab.position.y = r.h / 2; g.add(slab);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 3, d * 1.1), MAT.snowCap); cap.position.y = r.h + 1; g.add(cap);
      for (let i = 0; i < 3; i++) { // window panels and lit seams, like old machinery inside the stone
        const p = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, r.h * 0.18, 0.6), MAT.stoneDark);
        p.position.set((i - 1) * w * 0.28, r.h * 0.55, d / 2 + 0.2); g.add(p);
        const seam = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, 0.6, 0.7), i === 1 ? MAT.glowCyan : MAT.glowRed);
        seam.position.set((i - 1) * w * 0.28, r.h * 0.44, d / 2 + 0.3); g.add(seam);
      }
    } else {
      const span = r.r * 1.6, pw = 9;
      for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(pw, r.h, pw * 1.3), MAT.stone); p.position.set(sx * span / 2, r.h / 2, 0); g.add(p);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(1.2, r.h * 0.8, pw * 1.32), MAT.glowRed); strip.position.set(sx * (span / 2 - pw / 2 - 0.1), r.h * 0.5, 0); g.add(strip);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(span + pw, 10, pw * 1.3), MAT.stone); beam.position.y = r.h - 5; g.add(beam);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(span + pw + 2, 2.5, pw * 1.4), MAT.snowCap); cap.position.y = r.h + 0.8; g.add(cap);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(span - pw, r.h * 0.75, 1), new THREE.MeshBasicMaterial({ color: 0x0b1626, transparent: true, opacity: 0.55 }));
      inner.position.y = r.h * 0.45; g.add(inner);
    }
    g.position.set(r.x, r.y, r.z);
    g.rotation.set(r.tilt * 0.4, r.turn, r.tilt);
    scene.add(g);
  }
  // a beacon at each team's launch line
  for (const team of [0, 1]) {
    const z = (team === 0 ? 1 : -1) * S.ARENA * 0.9, x = 0, y = S.groundY(x, z);
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 9, 90, 6), MAT.stoneDark); tower.position.y = 45; g.add(tower);
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(7), team === 0 ? MAT.glowBlue : MAT.glowViolet); lamp.position.y = 98; g.add(lamp);
    const halo = glowSprite(team === 0 ? 0x5fc6ff : 0xc58cff, 60, 0.8); halo.position.y = 98; g.add(halo);
    g.position.set(x, y, z); scene.add(g);
    beacons.push(lamp);
  }
}
const beacons = [];

/* ---------------- glow sprites and particles ---------------- */
const glowTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,0.7)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size); return s;
}

// one draw call for every spark, flame and puff: soft additive points that shrink and fade
const FX = (() => {
  const MAX = 2400;
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), size = new Float32Array(MAX), alpha = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), max = new Float32Array(MAX), size0 = new Float32Array(MAX), drag = new Float32Array(MAX), grav = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { scale: { value: 600 } },
    vertexShader: "attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vc; varying float va; uniform float scale; void main(){ vc = color; va = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(-mv.z, 1.0); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying vec3 vc; varying float va; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d) * 4.0; if (r > 1.0) discard; gl_FragColor = vec4(vc * va * (1.0 - r) * (1.0 - r), 1.0); }",
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  let next = 0;
  const C = new THREE.Color();
  function add(x, y, z, vx, vy, vz, l, sz, color, o = {}) {
    const i = next; next = (next + 1) % MAX;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    life[i] = max[i] = l; size0[i] = sz; drag[i] = o.drag ?? 1.5; grav[i] = o.grav ?? 0;
    C.set(color); col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b;
  }
  function update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      const k = Math.max(0, 1 - drag[i] * dt);
      vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k - grav[i] * dt; vel[i * 3 + 2] *= k;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const t = Math.max(0, life[i] / max[i]);
      alpha[i] = t; size[i] = size0[i] * (0.4 + t * 0.6);
    }
    for (const a of ["position", "color", "size", "alpha"]) geo.attributes[a].needsUpdate = true;
    mat.uniforms.scale.value = innerHeight * 0.6 * (TOUCH ? 1 : renderer.getPixelRatio()) / Math.tan(camera.fov * Math.PI / 360) * 0.5;
  }
  function burst(x, y, z, n, speed, l, sz, colors, o) {
    for (let j = 0; j < n; j++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = speed * (0.3 + Math.random() * 0.7);
      add(x, y, z, Math.cos(a) * r * sp, u * sp, Math.sin(a) * r * sp, l * (0.6 + Math.random() * 0.6), sz * (0.6 + Math.random() * 0.8), colors[j % colors.length], o);
    }
  }
  return { add, update, burst };
})();

// blowing snow that wraps around the camera
const SNOW = (() => {
  const N = TOUCH ? 1400 : 2600, R = 160;
  const p = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) p[i] = (Math.random() * 2 - 1) * R;
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, transparent: true, opacity: 0.8, depthWrite: false, map: glowTex, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  const wind = new THREE.Vector3(38, -14, 22);
  function update(dt, cam) {
    for (let i = 0; i < N; i++) {
      let x = p[i * 3] + wind.x * dt, y = p[i * 3 + 1] + wind.y * dt, z = p[i * 3 + 2] + wind.z * dt;
      const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
      if (dx > R) x -= 2 * R; else if (dx < -R) x += 2 * R;
      if (dy > R) y -= 2 * R; else if (dy < -R) y += 2 * R;
      if (dz > R) z -= 2 * R; else if (dz < -R) z += 2 * R;
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { update };
})();

/* ---------------- ships ---------------- */
function tri(points) { // a flat polygon fan in the XZ plane, both faces
  const g = new THREE.BufferGeometry(), v = [];
  for (let i = 1; i < points.length - 1; i++) v.push(...points[0], ...points[i], ...points[i + 1]);
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
const SHIPMAT = {
  hull: new THREE.MeshStandardMaterial({ color: 0xeef3f8, roughness: 0.4, metalness: 0.35, flatShading: true, side: THREE.DoubleSide }),
  stripe: new THREE.MeshStandardMaterial({ color: 0xff7a1f, emissive: 0x3a1000, roughness: 0.5, flatShading: true, side: THREE.DoubleSide }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1d2a3a, roughness: 0.5, metalness: 0.5, flatShading: true }),
  glass: new THREE.MeshStandardMaterial({ color: 0x163a66, emissive: 0x0a2a55, roughness: 0.1, metalness: 0.8 }),
  jetBlue: new THREE.MeshBasicMaterial({ color: 0x8ff0ff }),
  black: new THREE.MeshStandardMaterial({ color: 0x1b1626, roughness: 0.35, metalness: 0.7, flatShading: true }),
  violet: new THREE.MeshStandardMaterial({ color: 0x6d35c8, emissive: 0x8a4dff, emissiveIntensity: 0.9, flatShading: true }),
  jetViolet: new THREE.MeshBasicMaterial({ color: 0xe0b8ff }),
};
// Lantern interceptor: a white delta with orange bands and twin cyan engines
function lanternShip() {
  const g = new THREE.Group();
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0, 1.9, 13, 6), SHIPMAT.hull); nose.rotation.x = -Math.PI / 2; nose.position.z = -2.5; g.add(nose);
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.8, 5), SHIPMAT.hull); back.position.z = 5.5; g.add(back);
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(tri([[sx * 1, 0, -1.5], [sx * 11, -0.4, 6], [sx * 1, 0, 6]]), SHIPMAT.hull); g.add(w);
    const st = new THREE.Mesh(tri([[sx * 4.4, 0.08, 0.9], [sx * 6.2, 0.02, 2.3], [sx * 6.2, 0.02, 6.05], [sx * 4.4, 0.08, 6.05]]), SHIPMAT.stripe); g.add(st);
    const tip = new THREE.Mesh(tri([[sx * 9, -0.2, 4.4], [sx * 11, -0.4, 6], [sx * 9, -0.2, 6.05]]), SHIPMAT.stripe); g.add(tip);
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 5, 8), SHIPMAT.dark); eng.rotation.x = Math.PI / 2; eng.position.set(sx * 2.4, -0.2, 5.4); g.add(eng);
    const jet = new THREE.Mesh(new THREE.CircleGeometry(0.85, 10), SHIPMAT.jetBlue); jet.position.set(sx * 2.4, -0.2, 7.95); g.add(jet);
    const fin = new THREE.Mesh(tri([[sx * 2.4, 0.9, 3.5], [sx * 2.9, 3.6, 7], [sx * 2.4, 0.9, 7]]), SHIPMAT.hull); g.add(fin);
    const can = new THREE.Mesh(tri([[sx * 1.2, 0, -5], [sx * 3.4, 0, -2.6], [sx * 1.2, 0, -2.4]]), SHIPMAT.stripe); g.add(can);
  }
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), SHIPMAT.glass); canopy.scale.set(0.95, 0.65, 2.4); canopy.position.set(0, 1, -0.5); g.add(canopy);
  const jets = [];
  for (const sx of [-1, 1]) { const j = glowSprite(0x6fe8ff, 3.5, 0.8); j.position.set(sx * 2.4, -0.2, 8.6); g.add(j); jets.push(j); }
  return { g, jets };
}
// Corvid raider: a dark core inside two forward-curving violet-edged blades
function corvidShip() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(2.3), SHIPMAT.black); core.scale.set(1, 0.7, 2.8); g.add(core);
  const blade = new THREE.Mesh(new THREE.TorusGeometry(7, 0.75, 4, 22, Math.PI * 0.86), SHIPMAT.black);
  blade.rotation.set(-Math.PI / 2, 0, Math.PI * 0.07); blade.position.z = 3; blade.scale.set(1, 1.15, 0.6); g.add(blade);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(6.1, 0.22, 4, 22, Math.PI * 0.86), SHIPMAT.violet);
  edge.rotation.copy(blade.rotation); edge.position.z = 3; edge.scale.set(1, 1.15, 1); g.add(edge);
  const spine = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 4), SHIPMAT.violet); spine.rotation.x = Math.PI / 2; spine.position.set(0, 1.2, 3.5); g.add(spine);
  for (const sx of [-1, 1]) { const strut = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 1.2), SHIPMAT.black); strut.position.set(sx * 3.5, 0, 2.5); g.add(strut); }
  const jet = new THREE.Mesh(new THREE.CircleGeometry(1, 8), SHIPMAT.jetViolet); jet.position.set(0, 0, 6.5); g.add(jet);
  const j = glowSprite(0xc58cff, 5, 0.85); j.position.set(0, 0, 7.2); g.add(j);
  return { g, jets: [j] };
}
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1a2a40, transparent: true, opacity: 0.28, depthWrite: false });
const shadowGeo = new THREE.CircleGeometry(7, 16).rotateX(-Math.PI / 2);

/* ---------------- bolts, meteors, orbs ---------------- */
const MAXB = 500;
function boltMesh(color) {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.55, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), MAXB);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scene.add(m); return m;
}
const BOLTS = [boltMesh(0x6dff9e), boltMesh(0xff6be6)];
const dummy = new THREE.Object3D();
const rockGeo = (() => {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.75 + Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.45; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  g.computeVertexNormals(); return g;
})();
const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a4636, emissive: 0xff8a1f, emissiveIntensity: 0.45, roughness: 0.8, flatShading: true });
const ORBCOL = { energy: 0xffb52e, bomb: 0xff4a4a, repair: 0x49ff9a };

/* ---------------- the world view of a match ---------------- */
let match = null, view = null;
function buildView(m) {
  if (view) { for (const o of view.objects) scene.remove(o); }
  view = { objects: [], ships: new Map(), rocks: new Map(), orbs: new Map(), charges: [], bombs: [] };
  const add = (o) => { scene.add(o); view.objects.push(o); return o; };
  if (!view.ruinsBuilt && !scene.userData.ruins) { buildRuins(m.ruins); scene.userData.ruins = true; }
  for (const s of m.ships) {
    const built = s.team === 0 ? lanternShip() : corvidShip();
    add(built.g);
    const sh = add(new THREE.Mesh(shadowGeo, shadowMat));
    view.ships.set(s.id, { g: built.g, jets: built.jets, shadow: sh, trail: 0, tag: null, wasAlive: true });
  }
  view.add = add;
}

/* ---------------- sound ---------------- */
const SND = (() => {
  let ctx = null, master, sfx, mus, engine, engineGain, engineFilter, noiseBuf, musicTimer = 0, nextNote = 0, step16 = 0, on = save.sound !== 0;
  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? 0.8 : 0; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = 0.7; sfx.connect(comp);
    mus = ctx.createGain(); mus.gain.value = 0.28; mus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    engine = ctx.createOscillator(); engine.type = "sawtooth"; engine.frequency.value = 60;
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = "lowpass"; engineFilter.frequency.value = 400;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engine.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(sfx); engine.start();
    nextNote = ctx.currentTime + 0.1;
  }
  const t = () => ctx.currentTime;
  function tone(type, f0, f1, dur, vol, dest = sfx, delay = 0) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), s = t() + delay;
    o.type = type; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), s + dur);
    g.gain.setValueAtTime(vol, s); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.connect(g); g.connect(dest); o.start(s); o.stop(s + dur + 0.02);
  }
  function noise(dur, vol, f0, f1, type = "lowpass", dest = sfx, delay = 0) {
    if (!ctx) return;
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), s = t() + delay;
    n.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(f0, s); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), s + dur);
    g.gain.setValueAtTime(vol, s); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    n.connect(f); f.connect(g); g.connect(dest); n.start(s, Math.random() * 0.5); n.stop(s + dur + 0.02);
  }
  // music: a driving minor-key loop. Bass on eighths, an arpeggio on sixteenths, kick and snare from noise.
  const ROOTS = [45, 41, 48, 43, 45, 41, 43, 40]; // A F C G A F G E, one bar each
  const ARP = [0, 7, 12, 15, 12, 7, 3, 7];
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let intensity = 0;
  function schedule() {
    if (!ctx || !playingMusic) return;
    const spb = 60 / 138 / 4;
    while (nextNote < t() + 0.15) {
      const bar = Math.floor(step16 / 16) % ROOTS.length, i = step16 % 16, root = ROOTS[bar], s = nextNote - t();
      if (i % 2 === 0) tone("triangle", hz(root - 12 + (i % 8 === 6 ? 12 : 0)), hz(root - 12), spb * 1.8, 0.5, mus, s);
      tone("square", hz(root + 12 + ARP[i % 8] + (bar % 2 && i > 11 ? 2 : 0)), hz(root + 12 + ARP[i % 8]), spb * 0.9, 0.07 + intensity * 0.05, mus, s);
      if (i % 4 === 0) tone("sine", 140, 40, 0.18, 0.7, mus, s);
      if (i % 8 === 4) noise(0.14, 0.35, 3000, 900, "bandpass", mus, s);
      if (intensity > 0.5 && i % 2 === 1) noise(0.04, 0.12, 9000, 7000, "highpass", mus, s);
      nextNote += spb; step16++;
    }
  }
  let playingMusic = false;
  return {
    init, get ctx() { return ctx; },
    music(onoff) { playingMusic = onoff; if (ctx && onoff) { nextNote = Math.max(nextNote, t() + 0.05); } },
    intensity(v) { intensity = v; },
    tick() { schedule(); },
    toggle() { on = !on; save.sound = on ? 1 : 0; store(); if (master) master.gain.setTargetAtTime(on ? 0.8 : 0, t(), 0.05); return on; },
    get on() { return on; },
    engine(speed, alive) { if (!ctx) return; engine.frequency.setTargetAtTime(45 + speed * 0.32, t(), 0.1); engineFilter.frequency.setTargetAtTime(250 + speed * 4, t(), 0.1); engineGain.gain.setTargetAtTime(alive ? 0.09 : 0, t(), 0.1); },
    laser(mine) { tone("square", mine ? 1700 : 1300, 380, 0.09, mine ? 0.09 : 0.03); },
    charge() { tone("sawtooth", 300, 1400, 0.3, 0.12); tone("sine", 900, 200, 0.4, 0.15); },
    lock() { tone("square", 1800, 1800, 0.05, 0.08); tone("square", 2400, 2400, 0.05, 0.08, sfx, 0.07); },
    boom(big, near) { const v = near ? 1 : 0.35; noise(big ? 1.1 : 0.5, (big ? 0.9 : 0.5) * v, 1800, 60); tone("sine", 110, 30, big ? 0.8 : 0.35, 0.6 * v); },
    hit() { noise(0.12, 0.5, 4000, 400, "bandpass"); tone("square", 220, 90, 0.12, 0.12); },
    deflect() { tone("triangle", 2600, 3800, 0.08, 0.1); },
    mark() { tone("sine", 2100, 1700, 0.05, 0.08); },
    orb(kind) { const b = kind === "energy" ? 880 : kind === "repair" ? 660 : 520; tone("sine", b, b * 1.5, 0.12, 0.18); tone("sine", b * 1.5, b * 2, 0.15, 0.12, sfx, 0.06); },
    whoosh() { noise(0.6, 0.35, 400, 2400, "bandpass"); },
    alarm() { for (let i = 0; i < 3; i++) { tone("square", 880, 880, 0.12, 0.08, sfx, i * 0.28); tone("square", 660, 660, 0.12, 0.08, sfx, i * 0.28 + 0.14); } },
    ui() { tone("triangle", 660, 990, 0.08, 0.12); },
    rock() { noise(0.18, 0.3, 1200, 200); },
    land() { noise(0.5, 0.25, 600, 60); },
    suspend() { if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {}); },
  };
})();

/* ---------------- input ---------------- */
const keys = new Set();
const mouse = { fire: false, charge: false };
const touch = { x: 0, y: 0, active: false, fire: false, charge: false, boost: false, brake: false, bomb: false, rollL: false, rollR: false, uturn: false };
addEventListener("keydown", (e) => {
  if (e.repeat && keys.has(e.code)) return;
  keys.add(e.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code) && state === "play") e.preventDefault();
  if (state === "play" && (e.code === "Escape" || e.code === "KeyP")) pause(true);
  else if (state === "pause" && (e.code === "Escape" || e.code === "KeyP")) pause(false);
  if (e.code === "KeyM") { SND.toggle(); soundLabel(); }
  menuKey(e);
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => { keys.clear(); mouse.fire = mouse.charge = false; });
$("#gl").addEventListener("mousedown", (e) => { if (state !== "play") return; if (e.button === 0) mouse.fire = true; if (e.button === 2) mouse.charge = true; });
addEventListener("mouseup", (e) => { if (e.button === 0) mouse.fire = false; if (e.button === 2) mouse.charge = false; });
$("#gl").addEventListener("contextmenu", (e) => e.preventDefault());

// touch: a floating stick on the left, held buttons on the right
{
  const zone = $("#stickZone"), stick = $("#stick"), knob = $("#stick i");
  let id = null, ox = 0, oy = 0;
  const R = () => stick.offsetWidth / 2 || 60;
  zone.addEventListener("pointerdown", (e) => { id = e.pointerId; zone.setPointerCapture(id); ox = e.clientX; oy = e.clientY; stick.style.left = ox + "px"; stick.style.top = (oy - zone.getBoundingClientRect().top) + "px"; stick.style.display = "block"; touch.active = true; move(e); });
  const move = (e) => { if (e.pointerId !== id) return; const r = R(); let dx = (e.clientX - ox) / r, dy = (e.clientY - oy) / r; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } touch.x = dx; touch.y = dy; knob.style.transform = `translate(calc(-50% + ${dx * r * 0.6}px), calc(-50% + ${dy * r * 0.6}px))`; };
  zone.addEventListener("pointermove", move);
  const end = (e) => { if (e.pointerId !== id) return; id = null; touch.x = touch.y = 0; touch.active = false; stick.style.display = "none"; };
  zone.addEventListener("pointerup", end); zone.addEventListener("pointercancel", end);
  const map = { tFire: "fire", tCharge: "charge", tBoost: "boost", tBrake: "brake", tBomb: "bomb", tRollL: "rollL", tRollR: "rollR", tUturn: "uturn" };
  for (const [elId, k] of Object.entries(map)) {
    const b = document.getElementById(elId);
    const down = (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); touch[k] = true; b.classList.add("on"); SND.init(); };
    const up = () => { touch[k] = false; b.classList.remove("on"); };
    b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
  }
}
let padPrev = {};
function readInput(s) {
  const inp = s.input, k = (c) => keys.has(c);
  let yaw = 0, pitch = 0;
  if (k("KeyA") || k("ArrowLeft")) yaw += 1;
  if (k("KeyD") || k("ArrowRight")) yaw -= 1;
  if (k("KeyW") || k("ArrowUp")) pitch += 1;
  if (k("KeyS") || k("ArrowDown")) pitch -= 1;
  let fire = k("Space") || k("KeyJ") || mouse.fire || touch.fire, charge = k("KeyK") || k("KeyX") || mouse.charge || touch.charge;
  let boost = k("ShiftLeft") || k("ShiftRight") || touch.boost, brake = k("KeyC") || touch.brake, bomb = k("KeyB") || k("KeyL") || touch.bomb;
  let rollL = k("KeyQ") || touch.rollL, rollR = k("KeyE") || touch.rollR, uturn = k("KeyR") || touch.uturn;
  if (touch.active) { yaw -= touch.x * 1.15; pitch -= touch.y * 1.1; }
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g && g.connected) : null;
  if (gp) {
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v), b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    yaw -= dz(gp.axes[0] || 0); pitch -= dz(gp.axes[1] || 0);
    fire ||= b(0); charge ||= b(2); bomb ||= b(1); uturn ||= b(3); rollL ||= b(4); rollR ||= b(5); brake ||= b(6); boost ||= b(7);
    if (b(9) && !padPrev.start) pause(true);
    padPrev.start = b(9);
  }
  if (save.invert) pitch = -pitch;
  inp.yaw = clamp(yaw, -1, 1); inp.pitch = clamp(pitch, -1, 1);
  Object.assign(inp, { fire, charge, boost, brake, bomb, rollL, rollR, uturn });
}

/* ---------------- HUD ---------------- */
const hud = {
  shield: $("#shieldBar i"), shieldBar: $("#shieldBar"), boost: $("#boostBar i"), bombN: $("#bombN"), s0: $("#s0"), s1: $("#s1"), clock: $("#clock"),
  feed: $("#feed"), radio: $("#radio"), objective: $("#objective"), tugA: $("#tug .a"), tugB: $("#tug .b"), na: $("#tug .na"), nb: $("#tug .nb"),
  radar: $("#radar"), sil: $("#sil"), tags: $("#tags"), reticle: $("#reticle"), lock: $("#lock"), center: $("#center"), warn: $("#warn"), hurt: $("#hurt"), hitmark: $("#hitmark"), popups: $("#popups"),
};
hud.reticle.innerHTML = '<svg width="56" height="56" viewBox="-28 -28 56 56" id="r1"><path d="M-22 -10v-12h12M10 -22h12v12M22 10v12h-12M-10 22h-12v-12" fill="none" stroke="#6dff9e" stroke-width="2.5"/><circle r="2" fill="#6dff9e"/></svg><svg width="30" height="30" viewBox="-15 -15 30 30" id="r2"><rect x="-11" y="-11" width="22" height="22" fill="none" stroke="#6dff9e" stroke-width="2" opacity=".7"/></svg>';
hud.lock.innerHTML = '<svg width="80" height="80" viewBox="-40 -40 80 80"><path d="M-14 -34h-14v68h14M14 -34h14v68h-14" fill="none" stroke="currentColor" stroke-width="4"/></svg>';
const r1 = $("#r1"), r2 = $("#r2"), lockSvg = hud.lock.firstChild;
const portrait = (pid) => `art/${pid}.webp`;
const shipById = (id) => match && match.ships.find((s) => s.id === id);
let lastHud = {};
const setText = (el, key, v) => { if (lastHud[key] !== v) { lastHud[key] = v; el.textContent = v; } };

function feedCard(killer, victim) {
  const c = document.createElement("div");
  c.className = "kcard t" + (killer ? killer.team : 1 - victim.team);
  c.innerHTML = (killer ? `<figure><img src="${portrait(killer.pilot)}" alt=""><span>${killer.name.split(" ")[0]}</span></figure><span class="arrow"></span>` : `<span class="arrow"></span>`) +
    `<figure class="vic"><img src="${portrait(victim.pilot)}" alt=""><b class="display">DOWN</b><span>${victim.name.split(" ")[0]}</span></figure>`;
  hud.feed.prepend(c);
  while (hud.feed.children.length > 3) hud.feed.lastChild.remove();
  setTimeout(() => c.classList.add("out"), 3800); setTimeout(() => c.remove(), 4300);
}

const LINES = {
  start: [["juno", "Lantern Squadron, weapons free. Bring home the light."], ["silas", "Easy on the stick. This moon bites the careless."], ["vex", "Corvids, pick them clean."]],
  wave: [["juno", "Meteor shower inbound! Shoot the rocks and grab that energy!"], ["brann", "Rocks falling! I'll take the big ones."], ["silas", "Here they come. Energy wins this, not ego."], ["nyra", "Shiny rocks. Mine."]],
  waveWin: [["juno", "Energy secured. Nice flying!"], ["pip", "We out-gathered them! Ha!"]],
  waveLose: [["brann", "They beat us to it. Next shower is ours."], ["vex", "Thank you for the energy, Lanterns."]],
  myKill: [["silas", "Clean shot. I taught you that one."], ["pip", "Ha! Did you see that?"], ["brann", "Down they go."], ["juno", "Good kill. Stay on them."]],
  myDeath: [["silas", "Shake it off. Back in the air."], ["juno", "Regroup at the beacon and come back hot."]],
  taunt: [["vex", "Lights out, Lantern."], ["nyra", "Too slow."], ["grell", "Crushed. Next."], ["sable", "..."]],
  low: [["pip", "Your shield is flashing! Find a green orb!"], ["silas", "You are leaking. Roll, and get clear."]],
  minute: [["silas", "One minute left. Make it count."], ["juno", "Sixty seconds, Lanterns. Push!"]],
  silasKill: [["silas", "Still got it."], ["silas", "Twenty years, and the old girl still flies true."]],
  win: [["silas", "That is how Lantern flies."], ["juno", "Light's still on. Good work, everyone."]],
  lose: [["silas", "We fly again tomorrow. Chin up."], ["vex", "Run home, little lights."]],
};
let radioQ = [], radioT = 0, radioCool = {};
function say(kind, force) {
  const opts = LINES[kind].filter(([p]) => !match || !match.player || p !== match.player.pilot);
  if (!opts.length) return;
  const now = performance.now();
  if (!force && radioCool[kind] && now - radioCool[kind] < 9000) return;
  radioCool[kind] = now;
  const [p, text] = opts[Math.floor(Math.random() * opts.length)];
  if (radioQ.length < 2) radioQ.push({ p, text });
}
function radioTick(dt) {
  radioT -= dt;
  if (radioT <= 0) {
    if (radioQ.length) {
      const { p, text } = radioQ.shift(), P = S.PILOTS[p];
      hud.radio.className = "frame on t" + P.team;
      hud.radio.querySelector("img").src = portrait(p);
      hud.radio.querySelector("b").textContent = P.call;
      hud.radio.querySelector("p").textContent = text;
      radioT = 3.4;
    } else hud.radio.classList.remove("on");
  }
}
function centerMsg(big, small, ms = 1400) {
  hud.center.innerHTML = `<div class="big display">${big}</div>${small ? `<div class="small display">${small}</div>` : ""}`;
  clearTimeout(centerMsg.t); centerMsg.t = setTimeout(() => { hud.center.innerHTML = ""; }, ms);
}
const v3 = new THREE.Vector3();
function toScreen(x, y, z) {
  v3.set(x, y, z).project(camera);
  return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight, front: v3.z < 1 };
}
function popup(x, y, z, text, color) {
  const p = toScreen(x, y, z); if (!p.front) return;
  const el = document.createElement("div"); el.className = "pop display"; el.textContent = text; if (color) el.style.color = color;
  el.style.left = p.x + "px"; el.style.top = p.y + "px"; hud.popups.appendChild(el); setTimeout(() => el.remove(), 1000);
}

function drawRadar(m, me) {
  const c = hud.radar, g = c.getContext("2d"), W = c.width, R = W / 2 - 6, RANGE = 900;
  g.clearRect(0, 0, W, W);
  g.save(); g.translate(W / 2, W / 2);
  g.strokeStyle = "rgba(90,255,150,0.35)"; g.lineWidth = 1.5;
  for (const k of [1, 0.66, 0.33]) { g.beginPath(); g.arc(0, 0, R * k, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = "rgba(255,200,60,0.45)"; g.beginPath(); g.arc(0, 0, R * 0.5, 0, Math.PI * 2); g.stroke();
  const cy = Math.cos(me.yaw), sy = Math.sin(me.yaw);
  const map = (x, z) => { const dx = x - me.x, dz = z - me.z; const rx = dx * cy - dz * sy, rz = dx * sy + dz * cy; return [rx / RANGE * R, rz / RANGE * R]; };
  // the storm wall
  g.strokeStyle = "rgba(255,90,80,0.5)"; g.beginPath();
  for (let a = 0; a <= 64; a++) { const [x, y] = map(Math.cos(a / 64 * Math.PI * 2) * S.ARENA, Math.sin(a / 64 * Math.PI * 2) * S.ARENA); a ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.fillStyle = "#ffd23f";
  for (const r of m.meteors) { const [x, y] = map(r.x, r.z); if (Math.hypot(x, y) < R) g.fillRect(x - 3.5, y - 3.5, 7, 7); }
  for (const o of m.orbs) { const [x, y] = map(o.x, o.z); if (Math.hypot(x, y) < R) { g.fillStyle = o.kind === "energy" ? "#ffb52e" : o.kind === "bomb" ? "#ff4a4a" : "#49ff9a"; g.fillRect(x - 2, y - 2, 4, 4); } }
  for (const s of m.ships) {
    if (!s.alive || s === me) continue;
    let [x, y] = map(s.x, s.z); const d = Math.hypot(x, y);
    if (d > R) { x *= R / d; y *= R / d; }
    g.save(); g.translate(x, y); g.rotate(-(s.yaw - me.yaw));
    g.fillStyle = s.team === 0 ? "#46b8ff" : "#c58cff";
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill(); g.restore();
  }
  g.fillStyle = "#fff"; g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.closePath(); g.fill();
  g.restore();
}

function updateTags(m, me) {
  const want = new Set();
  for (const s of m.ships) {
    if (s === me || !s.alive) continue;
    const V = view.ships.get(s.id);
    const d = Math.hypot(s.x - camera.position.x, s.y - camera.position.y, s.z - camera.position.z);
    const p = toScreen(s.x, s.y + 7, s.z);
    const enemy = s.team !== me.team;
    const on = p.front && p.x > -40 && p.x < innerWidth + 40 && p.y > 0 && p.y < innerHeight;
    if (!on && !(enemy && d < 700)) { if (V.tag) V.tag.style.display = "none"; continue; }
    if (!on && !p.front) continue;
    if (!V.tag) { V.tag = document.createElement("div"); V.tag.className = "tag t" + s.team; V.tag.innerHTML = `<div class="hp"><i></i></div><span>${enemy ? s.name.split(" ")[0] : s.call}</span><div class="tri"></div>`; hud.tags.appendChild(V.tag); }
    want.add(V.tag);
    V.tag.style.display = d < 1400 ? "" : "none";
    V.tag.style.left = clamp(p.x, 30, innerWidth - 30) + "px"; V.tag.style.top = clamp(p.y, 112, innerHeight - 20) + "px";
    V.tag.classList.toggle("edge", !on);
    V.tag.style.opacity = clamp(1.3 - d / 1200, 0.35, 1);
    V.tag.firstChild.firstChild.style.transform = `scaleX(${clamp(s.shield / s.maxShield, 0, 1)})`;
  }
  for (const [, V] of view.ships) if (V.tag && !want.has(V.tag)) V.tag.style.display = "none";
}

/* ---------------- camera ---------------- */
const cam = { pos: new THREE.Vector3(0, 200, 300), look: new THREE.Vector3(), shake: 0, fov: 70 };
function followCamera(s, dt, cinematic) {
  const f = S.forward(s.yaw, s.pitch);
  const back = cinematic ? 40 : 30, up = cinematic ? 12 : 9;
  const want = new THREE.Vector3(s.x - f.x * back, s.y - f.y * back + up, s.z - f.z * back);
  const gy = S.groundY(want.x, want.z) + 6; if (want.y < gy) want.y = gy;
  const k = 1 - Math.exp(-dt * (s.uturn > 0 ? 3 : 7));
  cam.pos.lerp(want, k);
  cam.look.lerp(new THREE.Vector3(s.x + f.x * 50, s.y + f.y * 50 + 3, s.z + f.z * 50), 1 - Math.exp(-dt * 10));
  camera.position.copy(cam.pos);
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 2.5); const a = cam.shake * cam.shake * 2.2; camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a; }
  camera.up.set(Math.sin(-s.bank) * 0.08, 1, 0).normalize();
  camera.lookAt(cam.look);
  const fov = baseFov + (s.input.boost && s.boost > 0.02 ? 12 : s.input.brake ? -6 : 0);
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
  if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}

/* ---------------- drawing a match ---------------- */
const rollVis = new Map();
function drawMatch(m, dt) {
  const t = performance.now() / 1000;
  for (const s of m.ships) {
    const V = view.ships.get(s.id);
    V.g.visible = s.alive && !(s.invuln > 0 && s.alive && Math.floor(t * 12) % 2 === 0 && s.invuln < 2.4 && s.invuln > 0.05);
    V.shadow.visible = s.alive;
    if (!s.alive) continue;
    let roll = s.bank;
    if (s.roll > 0) roll += -s.rollDir * (1 - s.roll / 0.55) * Math.PI * 2;
    V.g.position.set(s.x, s.y, s.z);
    V.g.rotation.set(s.pitch, s.yaw, roll, "YXZ");
    const boosting = s.input.boost && s.boost > 0.02;
    for (const j of V.jets) j.scale.setScalar((s.team === 0 ? 1 : 1.3) * (boosting ? 6.5 : 3.6) * (0.85 + Math.random() * 0.3));
    const gy = S.groundY(s.x, s.z), h = s.y - gy;
    V.shadow.position.set(s.x, gy + 0.6, s.z); V.shadow.scale.setScalar(clamp(1 + h / 120, 1, 3)); V.shadow.material.opacity = clamp(0.35 - h / 900, 0.05, 0.35);
    // exhaust and contrails
    V.trail -= dt;
    if (V.trail <= 0) {
      V.trail = boosting ? 0.012 : 0.03;
      const f = S.forward(s.yaw, s.pitch), cy = Math.cos(s.yaw), sy = -Math.sin(s.yaw);
      const col = s.team === 0 ? (boosting ? 0x9ff8ff : 0x4fd4ff) : (boosting ? 0xf0c8ff : 0xb06bff);
      if (s.team === 0) for (const sx of [-2.4, 2.4]) FX.add(s.x - f.x * 9 + cy * sx, s.y - f.y * 9, s.z - f.z * 9 + sy * sx, -f.x * 20, -f.y * 20, -f.z * 20, 0.35, boosting ? 3.4 : 2.4, col, { drag: 3 });
      else FX.add(s.x - f.x * 8, s.y - f.y * 8, s.z - f.z * 8, -f.x * 20, -f.y * 20, -f.z * 20, 0.35, boosting ? 4 : 3, col, { drag: 3 });
      if (Math.abs(s.bank) > 0.6 || s.uturn > 0) for (const sx of [-10.5, 10.5]) FX.add(s.x + cy * sx, s.y, s.z + sy * sx, 0, 0, 0, 0.5, 1.2, 0xffffff, { drag: 1 });
      if (h < 25) FX.add(s.x + (Math.random() - 0.5) * 8, gy + 1, s.z + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 30, 12, (Math.random() - 0.5) * 30, 0.8, 9, 0xb8c8dc, { drag: 2 }); // snow kicked up
    }
  }
  // bolts
  const counts = [0, 0];
  for (const b of m.bolts) {
    if (b.kind === "charge") continue;
    const M = BOLTS[b.team], i = counts[b.team]++;
    if (i >= MAXB) continue;
    dummy.position.set(b.x, b.y, b.z);
    dummy.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz);
    dummy.updateMatrix(); M.setMatrixAt(i, dummy.matrix);
  }
  BOLTS.forEach((M, k) => { M.count = Math.min(counts[k], MAXB); M.instanceMatrix.needsUpdate = true; });
  const charges = m.bolts.filter((b) => b.kind === "charge");
  while (view.charges.length < charges.length) view.charges.push(view.add(glowSprite(0xffffff, 16)));
  view.charges.forEach((sp, i) => {
    const b = charges[i]; sp.visible = !!b; if (!b) return;
    sp.position.set(b.x, b.y, b.z); sp.material.color.set(b.team === 0 ? 0x9dffc8 : 0xff9df0); sp.scale.setScalar(14 + Math.sin(t * 30) * 3);
    FX.add(b.x, b.y, b.z, 0, 0, 0, 0.3, 5, b.team === 0 ? 0x6dff9e : 0xff6be6, { drag: 2 });
  });
  while (view.bombs.length < m.bombs.length) view.bombs.push(view.add(glowSprite(0xff6a3a, 10)));
  view.bombs.forEach((sp, i) => { const b = m.bombs[i]; sp.visible = !!b; if (b) { sp.position.set(b.x, b.y, b.z); FX.add(b.x, b.y, b.z, 0, 0, 0, 0.4, 4, 0xff8a3a, { drag: 1 }); } });
  // meteors
  const seen = new Set();
  for (const r of m.meteors) {
    seen.add(r.id);
    let V = view.rocks.get(r.id);
    if (!V) {
      const g = new THREE.Group(); const mesh = new THREE.Mesh(rockGeo, rockMat); mesh.scale.setScalar(r.r); g.add(mesh);
      const halo = glowSprite(0xffa33a, r.r * 3.2, 0.55); g.add(halo);
      view.add(g); V = { g, mesh }; view.rocks.set(r.id, V);
    }
    V.g.position.set(r.x, r.y, r.z); V.mesh.rotation.x += dt * r.spin * 0.6; V.mesh.rotation.y += dt * r.spin;
    if (r.falling) { for (let k = 0; k < 2; k++) FX.add(r.x + (Math.random() - 0.5) * r.r, r.y + r.r * 0.6, r.z + (Math.random() - 0.5) * r.r, (Math.random() - 0.5) * 10, 60, (Math.random() - 0.5) * 10, 0.8, r.r * 0.9, k ? 0xff7a1f : 0xffd23f, { drag: 1 }); }
  }
  for (const [id, V] of view.rocks) if (!seen.has(id)) { scene.remove(V.g); view.rocks.delete(id); }
  // orbs: a glow per orb, kept in a pool
  view.orbPool = view.orbPool || [];
  while (view.orbPool.length < m.orbs.length) view.orbPool.push(view.add(glowSprite(0xffffff, 14)));
  view.orbPool.forEach((sp, i) => {
    const o = m.orbs[i]; sp.visible = !!o; if (!o) return;
    sp.position.set(o.x, o.y, o.z); sp.material.color.set(ORBCOL[o.kind]);
    const blink = o.life < 3 ? (Math.floor(t * 8) % 2 ? 0.3 : 1) : 1;
    sp.material.opacity = blink; sp.scale.setScalar(13 + Math.sin(t * 6 + i) * 3);
  });
  for (const b of beacons) b.rotation.y += dt;
}

function handleEvents(m, list, me) {
  for (const e of list) {
    const s = e.ship ? shipById(e.ship) : null;
    const nearMe = (x, y, z) => me && Math.hypot(x - me.x, y - me.y, z - me.z) < 400;
    switch (e.type) {
      case "fire":
        if (e.kind === "laser") { if (s && (s === me || (me && Math.hypot(s.x - me.x, s.z - me.z) < 250))) SND.laser(s === me); }
        else if (e.kind === "charge" && s && (s === me || nearMe(s.x, s.y, s.z))) SND.charge();
        else if (e.kind === "bomb" && s === me) SND.whoosh();
        break;
      case "hit": {
        if (!s) break;
        FX.burst(s.x, s.y, s.z, e.deflect ? 6 : 10, e.deflect ? 120 : 70, 0.35, e.deflect ? 2.5 : 3.5, e.deflect ? [0xffffff, 0x9ff8ff] : [0xfff2a0, 0xff8a3a]);
        if (s === me) { if (e.deflect) SND.deflect(); else { SND.hit(); cam.shake = Math.min(1, cam.shake + 0.45); hud.hurt.style.opacity = 1; setTimeout(() => (hud.hurt.style.opacity = 0), 140); } if (me.shield < me.maxShield * 0.3) say("low"); }
        break;
      }
      case "hitmark": hud.hitmark.style.opacity = 1; clearTimeout(hud.hmT); hud.hmT = setTimeout(() => (hud.hitmark.style.opacity = 0), 90); SND.mark(); break;
      case "down": {
        const killer = e.by ? shipById(e.by) : null;
        FX.burst(e.x, e.y, e.z, 60, 140, 1.1, 9, [0xffffff, 0xffd23f, 0xff7a1f, 0xff4a2a]);
        FX.burst(e.x, e.y, e.z, 30, 60, 1.8, 14, [0x666a74, 0x40444c], { drag: 1, grav: -6 });
        FX.burst(e.x, e.y, e.z, 20, 220, 0.6, 3, [e.team === 0 ? 0x6fe8ff : 0xc58cff]);
        SND.boom(true, nearMe(e.x, e.y, e.z) || (killer === me));
        feedCard(killer, s);
        if (killer === me) { popup(e.x, e.y, e.z, "+10", "#ffd23f"); say("myKill"); }
        else if (killer && killer.pilot === "silas" && me && me.pilot !== "silas") say("silasKill");
        if (s === me) { cam.shake = 1; centerMsg("SHOT DOWN", killer ? "by " + killer.name : "Watch the ground!", 2600); if (killer) say("taunt"); else say("myDeath"); setTimeout(() => say("myDeath"), 1500); }
        break;
      }
      case "spawn": if (s === me) centerMsg("BACK IN THE FIGHT", "", 1100); break;
      case "blast": FX.burst(e.x, e.y, e.z, 90, 260, 0.9, 16, [0xffffff, 0xffb347, 0xff5a2a]); FX.burst(e.x, e.y, e.z, 40, 320, 0.4, 5, [0xfff6c0]); SND.boom(true, true); cam.shake = Math.min(1, cam.shake + (nearMe(e.x, e.y, e.z) ? 0.6 : 0.2)); break;
      case "rockhit": FX.burst(e.x, e.y, e.z, 5, 60, 0.4, 3, [0xffb347, 0x8a6a50]); if (nearMe(e.x, e.y, e.z)) SND.rock(); break;
      case "rockbreak": FX.burst(e.x, e.y, e.z, 40, 120, 1, e.r * 0.5, [0xffd23f, 0xff8a1f, 0x8a6a50, 0x5a4636]); SND.boom(false, nearMe(e.x, e.y, e.z)); break;
      case "rockland": FX.burst(e.x, e.y, e.z, 16, 50, 0.7, 10, [0xffffff, 0xffb347]); if (nearMe(e.x, e.y, e.z)) SND.land(); break;
      case "orb":
        if (s === me) { SND.orb(e.kind); popup(me.x, me.y + 6, me.z, e.kind === "energy" ? "+5" : e.kind === "bomb" ? "+BOMB" : "REPAIR", e.kind === "energy" ? "#ffb52e" : e.kind === "bomb" ? "#ff6a6a" : "#49ff9a"); }
        break;
      case "spark": if (Math.random() < 0.5) FX.add(e.x, e.y, e.z, 0, 15, 0, 0.3, 4, 0xfff2a0); break;
      case "scrape": FX.burst(e.x, e.y, e.z, 14, 80, 0.5, 4, [0xffffff, 0xffd23f]); if (s === me) cam.shake = Math.min(1, cam.shake + 0.5); break;
      case "lock": if (s === me) SND.lock(); break;
      case "uturn": case "roll": if (s === me) SND.whoosh(); break;
      case "wave": SND.alarm(); centerMsg("METEOR SHOWER", "Shoot the rocks · collect their energy", 2400); say("wave", true); break;
      case "waveEnd":
        if (e.winner < 0) centerMsg("ENERGY TIED", `${e.energy[0]} – ${e.energy[1]}`, 1800);
        else { const mine = me ? e.winner === me.team : e.winner === 0; centerMsg(mine ? "ENERGY SECURED +25" : "CORVIDS TOOK THE ENERGY", `${e.energy[0]} – ${e.energy[1]}`, 2000); say(mine ? "waveWin" : "waveLose", true); }
        break;
      case "end": break;
    }
  }
}

function updateHud(m, me, dt) {
  const sh = clamp(me.shield / me.maxShield, 0, 1);
  hud.shield.style.transform = `scaleX(${sh})`; hud.shieldBar.classList.toggle("low", sh < 0.3);
  hud.boost.style.transform = `scaleX(${me.boost})`;
  setText(hud.bombN, "b", String(me.bombs));
  setText(hud.s0, "s0", String(m.score[0])); setText(hud.s1, "s1", String(m.score[1]));
  const tt = Math.ceil(m.time), clock = `${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, "0")}`;
  setText(hud.clock, "c", clock); hud.clock.classList.toggle("hurry", m.time < 30);
  hud.sil.style.color = sh > 0.6 ? "#49ff9a" : sh > 0.3 ? "#ffd23f" : "#ff4a4a";
  let a, b;
  if (m.wave.on) { setText(hud.objective, "o", "SHOOT THE METEORITES AND COLLECT THEIR ENERGY"); [a, b] = m.wave.energy; }
  else { setText(hud.objective, "o", `NEXT METEOR SHOWER IN ${Math.max(0, Math.ceil(m.wave.t))}s · TEAM SCORE`); [a, b] = m.score; }
  const tot = a + b || 1;
  hud.tugA.style.width = (a / tot * 100) + "%"; hud.tugB.style.width = (b / tot * 100) + "%";
  if (!a && !b) { hud.tugA.style.width = hud.tugB.style.width = "0%"; }
  setText(hud.na, "na", String(a)); setText(hud.nb, "nb", String(b));
  hud.warn.classList.toggle("hidden", !(me.alive && me.warn));
  // reticles, in front of the nose
  if (me.alive) {
    const f = S.forward(me.yaw, me.pitch);
    const p1 = toScreen(me.x + f.x * 260, me.y + f.y * 260, me.z + f.z * 260), p2 = toScreen(me.x + f.x * 110, me.y + f.y * 110, me.z + f.z * 110);
    r1.style.left = p1.x + "px"; r1.style.top = p1.y + "px"; r2.style.left = p2.x + "px"; r2.style.top = p2.y + "px";
    hud.reticle.style.display = "";
    const charging = me.input.charge && me.charge > 0;
    const cand = me.lock && me.lock.alive ? me.lock : charging ? S.findLock(m, me) : null;
    if (cand) {
      const p = toScreen(cand.x, cand.y, cand.z);
      hud.lock.classList.toggle("hidden", !p.front);
      const locked = me.lock && me.lock === cand && me.charge >= 1;
      hud.lock.style.color = locked ? "#49ff9a" : "#ffd23f";
      const sc = locked ? 1 : 1.6 - me.charge * 0.6;
      lockSvg.style.left = p.x + "px"; lockSvg.style.top = p.y + "px"; lockSvg.style.transform = `translate(-50%,-50%) scale(${sc})`;
    } else hud.lock.classList.add("hidden");
    r1.querySelector("path").setAttribute("stroke", charging ? (me.charge >= 1 ? "#ffd23f" : "#9fffc0") : "#6dff9e");
  } else { hud.reticle.style.display = "none"; hud.lock.classList.add("hidden"); }
  radarT -= dt; if (radarT <= 0) { radarT = 1 / 20; drawRadar(m, me.alive ? me : { ...me }); }
  updateTags(m, me);
  if (m.time < 60 && !m.minuteSaid) { m.minuteSaid = true; say("minute", true); }
  SND.intensity(m.wave.on || m.time < 60 ? 1 : 0);
}
let radarT = 0;

/* ---------------- screens and flow ---------------- */
let state = "title", pilotSel = save.pilot in S.PILOTS && S.PILOTS[save.pilot].team === 0 ? save.pilot : "juno", diffSel = save.diff in S.DIFFICULTY ? save.diff : "ace";
let countdown = 0, attractShip = null, attractT = 0;
const screens = ["title", "select", "how", "pause", "results"];
function show(name) {
  for (const s of screens) $("#" + s).classList.toggle("hidden", s !== name);
  const playing = name === null;
  $("#hud").classList.toggle("hidden", !(playing || name === "pause"));
  document.body.classList.toggle("playing", playing);
  const first = name && $("#" + name + " .btn.go");
  if (first && !TOUCH) first.focus({ preventScroll: true });
}
function startAttract() {
  match = S.createMatch({ pilot: null, difficulty: "veteran", seed: (Math.random() * 1e9) | 0 });
  match.time = 1e9; // the title flight never ends
  buildView(match);
  attractShip = match.ships[0]; attractT = 0;
  for (const [, V] of view.ships) if (V.tag) V.tag.remove();
}
function buildCards() {
  const box = $("#cards"); box.innerHTML = "";
  const bar = (v) => `<i style="width:${clamp(v, 0.1, 1) * 100}%"></i>`;
  for (const pid of S.LANTERN) {
    const P = S.PILOTS[pid];
    const c = document.createElement("button");
    c.type = "button"; c.className = "pcard" + (pid === pilotSel ? " sel" : ""); c.dataset.pilot = pid; c.setAttribute("role", "option"); c.setAttribute("aria-selected", pid === pilotSel);
    c.innerHTML = `${pid === "silas" ? '<span class="vet display">VETERAN</span>' : ""}<img src="${portrait(pid)}" alt="${P.name}"><span class="nm">${P.name}</span><span class="rl display">${P.role.toUpperCase()}</span>
      <span class="stats"><span>Shield</span>${bar(P.shield / 150)}<span>Speed</span>${bar((P.speed - 0.75) / 0.4)}<span>Guns</span>${bar((P.dmg - 0.75) / 0.4)}<span>Lock</span>${bar(1.2 - P.lock)}</span><span class="pk">${P.perk}</span>`;
    c.addEventListener("click", () => { pilotSel = pid; SND.ui(); buildCards(); });
    c.addEventListener("dblclick", launch);
    box.appendChild(c);
  }
}
function segs() {
  $$("#diff button").forEach((b) => b.classList.toggle("on", b.dataset.d === diffSel));
  $$("#inv button").forEach((b) => b.classList.toggle("on", +b.dataset.i === save.invert));
}
$$("#diff button").forEach((b) => b.addEventListener("click", () => { diffSel = b.dataset.d; SND.ui(); segs(); }));
$$("#inv button").forEach((b) => b.addEventListener("click", () => { save.invert = +b.dataset.i; store(); SND.ui(); segs(); }));
function bestLine() {
  $("#best").textContent = save.played ? `Best score ${save.best} · ${save.wins} win${save.wins === 1 ? "" : "s"} in ${save.played} match${save.played === 1 ? "" : "es"}` : "";
}
function soundLabel() { $("#soundBtn").textContent = "SOUND: " + (SND.on ? "ON" : "OFF"); }

function launch() {
  SND.init(); SND.ui();
  save.pilot = pilotSel; save.diff = diffSel; store();
  for (const [, V] of view ? view.ships : []) if (V.tag) V.tag.remove();
  hud.tags.innerHTML = ""; hud.feed.innerHTML = ""; hud.popups.innerHTML = ""; radioQ = []; radioT = 0; lastHud = {};
  match = S.createMatch({ pilot: pilotSel, difficulty: diffSel });
  buildView(match);
  const me = match.player;
  const f = S.forward(me.yaw, me.pitch);
  cam.pos.set(me.x - f.x * 120 + 40, me.y + 50, me.z - f.z * 120); cam.look.set(me.x, me.y, me.z);
  countdown = 3.2; state = "play"; show(null);
  SND.music(true);
  centerMsg("3", "LANTERN SQUADRON · LAUNCH", 900);
}
function pause(on) {
  if (on && state === "play") { state = "pause"; show("pause"); soundLabel(); SND.suspend(); keys.clear(); }
  else if (!on && state === "pause") { state = "play"; show(null); SND.resume(); last = performance.now(); }
}
function endMatch() {
  state = "results";
  const m = match, me = m.player, win = m.winner === me.team, draw = m.winner < 0;
  save.played++; if (win) save.wins++; save.best = Math.max(save.best, m.score[0]); store();
  $("#resultTitle").textContent = draw ? "DRAW" : win ? "VICTORY" : "DEFEAT";
  $("#resultTitle").className = "display " + (draw ? "" : win ? "win" : "lose");
  $("#finalScore").innerHTML = `<span style="color:var(--blue)">LANTERN ${m.score[0]}</span> · <span style="color:var(--violet)">${m.score[1]} CORVID</span>`;
  const best = S.mvp(m);
  $("#mvp").innerHTML = `<img src="${portrait(best.pilot)}" alt=""><div><div class="display" style="color:#ffd23f">MVP</div>${best.name} · ${best.kills} downs · ${best.energy} energy</div>`;
  $("#tally").innerHTML = [...m.ships].sort((a, b) => a.team - b.team || b.kills - a.kills).map((s) =>
    `<tr class="t${s.team}${s === me ? " me" : ""}"><td><img class="face" src="${portrait(s.pilot)}" alt="">${s.name}${s === me ? " (you)" : ""}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.energy}</td></tr>`).join("");
  say(win ? "win" : "lose", true);
  SND.music(false);
  setTimeout(() => { if (state === "results") show("results"); }, 1600);
  centerMsg(draw ? "TIME" : win ? "MISSION COMPLETE" : "MISSION FAILED", "", 1600);
}
function toTitle() { state = "title"; SND.music(false); show("title"); bestLine(); startAttract(); }

$("#playBtn").addEventListener("click", () => { SND.init(); SND.ui(); state = "select"; buildCards(); segs(); show("select"); });
$("#howBtn").addEventListener("click", () => { SND.init(); SND.ui(); state = "how"; show("how"); });
$("#howBack").addEventListener("click", () => { SND.ui(); state = "title"; show("title"); });
$("#backBtn").addEventListener("click", () => { SND.ui(); state = "title"; show("title"); });
$("#launchBtn").addEventListener("click", launch);
$("#resumeBtn").addEventListener("click", () => pause(false));
$("#soundBtn").addEventListener("click", () => { SND.toggle(); soundLabel(); });
$("#quitBtn").addEventListener("click", () => { SND.resume(); toTitle(); });
$("#pauseBtn").addEventListener("click", () => pause(true));
$("#againBtn").addEventListener("click", launch);
$("#pilotBtn").addEventListener("click", () => { SND.ui(); state = "select"; buildCards(); segs(); show("select"); });
document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") pause(true); });

// arrow keys and Enter move through menus; on the pilot screen left and right pick a pilot
function menuKey(e) {
  if (state === "select" && (e.code === "ArrowLeft" || e.code === "ArrowRight")) {
    const i = S.LANTERN.indexOf(pilotSel), n = S.LANTERN.length;
    pilotSel = S.LANTERN[(i + (e.code === "ArrowRight" ? 1 : n - 1)) % n]; SND.ui(); buildCards(); e.preventDefault();
  } else if (state === "select" && e.code === "Enter" && !(document.activeElement && document.activeElement.matches(".btn, .seg button"))) { e.preventDefault(); launch(); }
  else if (state === "select" && e.code === "Escape") { state = "title"; show("title"); }
  else if (state === "how" && e.code === "Escape") { state = "title"; show("title"); }
}

/* ---------------- the loop ---------------- */
let last = performance.now(), acc = 0;
const DT = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state === "pause") { renderer.render(scene, camera); return; }
  SND.tick();
  const m = match;
  if (!m) return;
  const me = m.player;
  if (state === "play" && countdown > 0) {
    const before = Math.ceil(countdown);
    countdown -= dt;
    const n = Math.ceil(countdown);
    if (n !== before && n > 0) { centerMsg(String(n), "", 800); SND.ui(); }
    if (countdown <= 0) { centerMsg("GO!", "Four minutes · most points wins", 1200); say("start", true); setTimeout(() => say("start"), 3600); }
    followCamera(me, dt, false);
  } else if (state === "play" || state === "title" || state === "select" || state === "how" || state === "results") {
    if (state === "play") readInput(me);
    if (!(state === "results" && m.over)) {
      acc += dt;
      let n = 0;
      while (acc >= DT && n < 6) { S.step(m, DT); acc -= DT; n++; }
      if (n === 6) acc = 0;
    }
    const ev = S.takeEvents(m);
    if (state === "play") handleEvents(m, ev, me);
    else for (const e of ev) if (e.type === "down" || e.type === "blast" || e.type === "rockbreak") FX.burst(e.x, e.y, e.z, 40, 120, 1, 8, [0xffffff, 0xffd23f, 0xff7a1f]);
    if (me) {
      followCamera(me, dt, false);
      if (!me.alive && state === "play") { // watch the ship that downed you, then the respawn
        const k = shipById(me.lastHitBy);
        if (k && k.alive && me.respawn > 1.2) followCamera(k, dt, true);
      }
    } else {
      attractT -= dt;
      if (!attractShip || !attractShip.alive || attractT <= 0) { const alive = m.ships.filter((s) => s.alive); attractShip = alive[Math.floor(Math.random() * alive.length)]; attractT = 9; }
      if (attractShip) followCamera(attractShip, dt, true);
    }
    if (state === "play" && m.over && me) endMatch();
  }
  drawMatch(m, dt);
  FX.update(dt);
  SNOW.update(dt, camera.position);
  scene.userData.sky.position.copy(camera.position);
  if (state === "play" && me) { updateHud(m, me, dt); radioTick(dt); SND.engine(me.speed, me.alive); }
  else SND.engine(0, false);
  renderer.render(scene, camera);
}

// tests read the game through this
window.__fw = {
  get state() { return state; }, get match() { return match; }, S,
  launch: (pilot = "juno", difficulty = "ace") => { pilotSel = pilot; diffSel = difficulty; launch(); },
  skipCountdown: () => { countdown = 0.001; },
  fastForward: (sec) => { for (let i = 0; i < sec * 60 && !match.over; i++) S.step(match, DT); },
  get save() { return { ...save }; },
};

bestLine();
startAttract();
show("title");
requestAnimationFrame(frame);
