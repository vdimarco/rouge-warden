// Splat Isle: five small islands written as shapes, painted with splats, lit once, and shown through a pixel-art pass.
// You keep Home Isle. The lighthouse on Lantern Isle has gone dark, and the people of the other islands each need a
// thing before the next one can help. Break things, carry what you find, tend your flower and your goat, and sail.
// scene.js and sdf.js paint the splats; this page hands them to Spark, runs the game, and draws the pixel pass.
// Query flags: ?q=low (fewer splats, for the browser check), ?pixel=0, ?fresh (ignore the saved game), ?capture.
import * as THREE from 'three';
import { SplatMesh, SparkRenderer, PackedSplats } from '@sparkjsdev/spark';
import { build, figure, goat as paintGoat, world, ISLANDS, ORDER, SEA, sproutSpots } from './scene.js';
import { SAVE_KEY, fresh as freshSave, clean as cleanSave } from './save.js';
import * as sound from './sound.js';

const $ = id => document.getElementById(id), query = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const canvas = $('view');
const QUALITY = query.get('q') === 'low' ? 0.33 : touch ? 0.6 : 1, DENSITY = 560 * QUALITY, CELL = QUALITY < 0.5 ? 0.26 : QUALITY < 0.8 ? 0.2 : 0.15;
const DAY = 240;   // seconds in one day

/* ---------------- renderer ---------------- */
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: query.has('capture') }); if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2'); }
catch (e) { $('loadLine').textContent = 'Splat Isle needs WebGL2 graphics, and this browser has none to give.'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor('#f2b58a');
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, 0.05, 260);
scene.add(new SparkRenderer({ renderer, focalAdjustment: 1.4 }));

/* ---------------- the sky ---------------- */
// A large sphere with a gradient from the horizon up, and stars that come out at night. Its colours follow the day.
const skyMat = new THREE.ShaderMaterial({
  uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uLow: { value: new THREE.Color() } }, side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec3 vP; uniform vec3 uTop, uMid, uLow; void main() { float h = vP.y; vec3 c = h > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.55, h)) : mix(uMid, uLow, smoothstep(0.0, 0.2, -h)); gl_FragColor = vec4(c, 1.0); }',
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 12), skyMat); sky.renderOrder = -10; scene.add(sky);
const starGeo = new THREE.BufferGeometry(), starPos = []; for (let i = 0; i < 260; i++) { const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3; starPos.push(Math.cos(a) * Math.cos(e) * 190, Math.sin(e) * 190, Math.sin(a) * Math.cos(e) * 190); }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: '#fff8ea', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }), stars = new THREE.Points(starGeo, starMat); stars.renderOrder = -9; scene.add(stars);
// The lighthouse's beam: a long, faint cone that turns at night once the lamp is lit.
const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 26, 16, 1, true).translate(0, -13, 0).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
beam.visible = false; scene.add(beam);

/* ---------------- the pixel pass ---------------- */
// The scene draws into a small target; a full-screen pass reads it with no smoothing, darkens a pixel that sits on a
// strong edge (a soft outline), adds a 4x4 Bayer dither, and snaps each pixel to the nearest colour of a small palette.
// After the GameDev.net "Pixel Art Palette Filter", Maxime Heckel's dithering post-process, and the luminance edge
// outline in t3ssel8r's pixel-art scene breakdowns (see design.md).
const PALETTES = {
  dusk: ['#1b1626', '#2f2340', '#4b3157', '#73405f', '#a3535e', '#d26e5a', '#f09a68', '#f6c58c', '#fbe9c4', '#fff8ea', '#2a4a5c', '#2f6f86', '#4aa2b3', '#8ed3d0', '#2e5232', '#3f7a3a', '#6aa548', '#a8cc62', '#e0e08a', '#6e4a36', '#9a6b47', '#c9965f', '#8c8a96', '#c5c1c9', '#1f2a4a', '#3a4f86', '#e05a4e', '#ffd56a'],
  meadow: ['#14212b', '#24384a', '#3b5f6f', '#5c9a9a', '#9fd3c7', '#f4f1de', '#e8c07d', '#c9844a', '#8a4b2e', '#4d2c22', '#2d4d2a', '#4f7f3a', '#8fb35a', '#c84f4f', '#f08a8a', '#ffffff'],
  pocket: ['#0f2a1d', '#306230', '#8bac0f', '#d8f0a0'],
};
const PALETTE_NAMES = Object.keys(PALETTES), MAXP = 32;
const target = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
const pixelPass = new THREE.ShaderMaterial({
  uniforms: { uScene: { value: target.texture }, uSize: { value: new THREE.Vector2(4, 4) }, uPal: { value: Array.from({ length: MAXP }, () => new THREE.Color()) }, uCount: { value: 4 }, uDither: { value: 0.09 }, uOutline: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `varying vec2 vUv; uniform sampler2D uScene; uniform vec2 uSize; uniform vec3 uPal[${MAXP}]; uniform int uCount; uniform float uDither, uOutline;
    float bayer(vec2 p) { ivec2 i = ivec2(mod(p, 4.0)); int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return float(m[i.y * 4 + i.x]) / 16.0 - 0.47; }
    vec3 at(vec2 px) { return pow(texture2D(uScene, (px + 0.5) / uSize).rgb, vec3(1.0 / 2.2)); }
    float lum(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); }
    void main() {
      vec2 px = floor(vUv * uSize); vec3 c = at(px);
      // a pixel darker side of a strong edge gets a little darker still: a soft line round each thing
      float l = lum(c), n = max(max(lum(at(px + vec2(1, 0))), lum(at(px - vec2(1, 0)))), max(lum(at(px + vec2(0, 1))), lum(at(px - vec2(0, 1)))));
      c *= 1.0 - uOutline * 0.35 * smoothstep(0.12, 0.3, n - l);
      c += bayer(px) * uDither;               // dither in gamma space, where the palette lives
      vec3 best = uPal[0]; float bd = 1e9;
      for (int i = 0; i < ${MAXP}; i++) { if (i >= uCount) break; vec3 d = (c - uPal[i]) * vec3(0.8, 1.0, 0.6); float e = dot(d, d); if (e < bd) { bd = e; best = uPal[i]; } }
      gl_FragColor = vec4(pow(best, vec3(2.2)), 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const post = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pixelPass));
const look = { pixel: query.get('pixel') !== '0', palette: 'dusk', goop: 1, xray: false };
function setPalette(name) {
  look.palette = name; const list = PALETTES[name]; pixelPass.uniforms.uCount.value = list.length; list.forEach((h, i) => pixelPass.uniforms.uPal.value[i].set(h).convertLinearToSRGB());
  pixelPass.uniforms.uDither.value = list.length <= 4 ? 0.22 : list.length <= 16 ? 0.12 : 0.075; paintButtons();
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 64 : 48; camera.updateProjectionMatrix();
  // about 300 lines of pixels on a big screen and 220 on a phone: chunky pixels that still read
  const lines = clamp(Math.round(h / 2.9), 200, 320), cols = Math.round(lines * w / h); target.setSize(cols, lines); pixelPass.uniforms.uSize.value.set(cols, lines);
}
addEventListener('resize', resize); resize();

/* ---------------- splats into Spark ---------------- */
// Each painted part becomes one Spark mesh. The part keeps its own arrays, so the page can write them again: another
// stroke size (goop), or the pieces of a part that breaks apart and comes back.
const tmp = { c: new THREE.Vector3(), s: new THREE.Vector3(), q: new THREE.Quaternion(), col: new THREE.Color() };
function writePart(part, fx = null) {
  const { splats: sp, packed } = part, g = part.name === 'sea' ? 1 : look.goop;
  for (let i = 0; i < sp.count; i++) {
    let x = sp.pos[i * 3], y = sp.pos[i * 3 + 1], z = sp.pos[i * 3 + 2], s = g, a = sp.alpha[i];
    if (fx) { const r = fx(i, x, y, z); x = r[0]; y = r[1]; z = r[2]; s *= r[3]; a *= r[4]; }
    tmp.c.set(x, y, z); tmp.s.set(sp.scale[i * 3] * s, sp.scale[i * 3 + 1] * s, sp.scale[i * 3 + 2] * s); tmp.q.set(sp.quat[i * 4], sp.quat[i * 4 + 1], sp.quat[i * 4 + 2], sp.quat[i * 4 + 3]);
    tmp.col.setRGB(sp.color[i * 3], sp.color[i * 3 + 1], sp.color[i * 3 + 2]); packed.setSplat(i, tmp.c, tmp.s, tmp.q, a, tmp.col);
  }
  packed.needsUpdate = true; part.mesh.updateVersion?.();
}
const allParts = new Set();   // every live part, for the light of the day and for goop
function meshPart(p, parent, { mid = [0, 0, 0], fly = true } = {}) {
  const group = new THREE.Group(); group.position.set(...p.pivot); parent.add(group);
  const packed = new PackedSplats({ maxSplats: Math.max(1, p.splats.count) }), mesh = new SplatMesh({ packedSplats: packed });
  const part = { ...p, group, packed, mesh, mid, tint: 1 }; writePart(part); group.add(mesh);
  if (p.shapes) group.add(skeleton(p.shapes));
  if (fly) { // the way each stroke flies when the part breaks: out from the middle, along its own surface normal
    const sp = p.splats, f = new Float32Array(sp.count * 4), r = Math.random;
    for (let i = 0; i < sp.count; i++) { f[i * 4] = sp.nrm[i * 3] + (r() - 0.5) * 1.2; f[i * 4 + 1] = sp.nrm[i * 3 + 1] * 0.6 + 0.9 + r() * 0.8; f[i * 4 + 2] = sp.nrm[i * 3 + 2] + (r() - 0.5) * 1.2; f[i * 4 + 3] = r() * 0.35; }
    part.fly = f;
  }
  allParts.add(part); part.lit = [-1, -1, -1]; return part;
}
function dropPart(p) { allParts.delete(p); p.group.parent?.remove(p.group); p.mesh.dispose?.(); p.packed.dispose?.(); }
// A soft dark disc of strokes under a person or the goat, so they stand on the ground.
function blobShadow(radius) {
  const n = 70, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), scale = new Float32Array(n * 3), quat = new Float32Array(n * 4), color = new Float32Array(n * 3), alpha = new Float32Array(n);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  for (let i = 0; i < n; i++) { const a = i * 2.39996, d = Math.sqrt(i / n) * radius; pos.set([Math.cos(a) * d, 0.03, Math.sin(a) * d], i * 3); nrm.set([0, 1, 0], i * 3); scale.set([radius * 0.32, radius * 0.32, 0.004], i * 3); quat.set([q.x, q.y, q.z, q.w], i * 4); color.set([0.08, 0.06, 0.1], i * 3); alpha[i] = 0.34 * (1 - (d / radius) ** 2) + 0.05; }
  return { name: 'shadow', pivot: [0, 0, 0], splats: { count: n, pos, nrm, scale, quat, color, albedo: color, alpha, glow: new Uint8Array(n) }, shapes: null, shadow: true };
}

/* ---------------- the shapes underneath ---------------- */
// The X-ray view: each distance shape as a wire, in the part's own frame. Cut shapes are red.
const wire = new THREE.LineBasicMaterial({ color: '#7ff6ff', transparent: true, opacity: 0.85, depthTest: false }), wireCut = new THREE.LineBasicMaterial({ color: '#ff5d6c', transparent: true, opacity: 0.9, depthTest: false });
function ring(r, axis, y = 0, n = 28) { const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, c = Math.cos(a) * r, d = Math.sin(a) * r; pts.push(axis === 'y' ? new THREE.Vector3(c, y, d) : axis === 'x' ? new THREE.Vector3(y, c, d) : new THREE.Vector3(c, d, y)); } return pts; }
function geometryOf(s) {
  const [a, b, c] = s.size, segs = [];
  const loop = pts => { for (let i = 1; i < pts.length; i++) segs.push(pts[i - 1], pts[i]); }, line = (p, q) => segs.push(p, q);
  if (s.type === 'box') return new THREE.EdgesGeometry(new THREE.BoxGeometry(a * 2, b * 2, c * 2));
  if (s.type === 'sphere' || s.type === 'ellipsoid') { const [rx, ry, rz] = s.type === 'sphere' ? [a, a, a] : [a, b, c]; for (const ax of ['x', 'y', 'z']) loop(ring(1, ax).map(v => v.multiply(new THREE.Vector3(rx, ry, rz)))); }
  else if (s.type === 'capsule') { const h = a / 2, r = b; loop(ring(r, 'y', h)); loop(ring(r, 'y', -h)); for (const [x, z] of [[r, 0], [-r, 0], [0, r], [0, -r]]) line(new THREE.Vector3(x, -h, z), new THREE.Vector3(x, h, z)); }
  else if (s.type === 'cylinder' || s.type === 'cone') { const h = a / 2, r1 = b, r2 = s.type === 'cone' ? c : b; loop(ring(r1, 'y', -h)); loop(ring(r2, 'y', h)); for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; line(new THREE.Vector3(Math.cos(t) * r1, -h, Math.sin(t) * r1), new THREE.Vector3(Math.cos(t) * r2, h, Math.sin(t) * r2)); } }
  else if (s.type === 'torus') { loop(ring(a + b, 'y')); loop(ring(a - b, 'y')); }
  return new THREE.BufferGeometry().setFromPoints(segs);
}
function skeleton(shapes) {
  const g = new THREE.Group(); g.visible = look.xray; g.userData.xray = true;
  for (const s of shapes) { const line = new THREE.LineSegments(geometryOf(s), s.cut ? wireCut : wire); line.position.set(...(s.at || [0, 0, 0])); line.rotation.set(...(s.rot || [0, 0, 0]), 'ZYX'); line.renderOrder = 30; g.add(line); }
  return g;
}
function showShapes(on) { look.xray = on; scene.traverse(o => { if (o.userData.xray) o.visible = on; }); paintButtons(); }

/* ---------------- the saved game ---------------- */
// save.js checks a save read back from the browser, field by field, so a bad one cannot stop the page or inject markup.
const firstSprouts = () => sproutSpots(1, 3).map(id => [id, 1]);
let save = freshSave(firstSprouts());
try { const got = !query.has('fresh') && JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); save = cleanSave(got, firstSprouts()) || save; } catch (e) { /* storage off, or a save that is not JSON */ }
let saveQueued = false;
function store() { if (saveQueued) return; saveQueued = true; setTimeout(() => { saveQueued = false; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage off */ } }, 400); }
const brokenOn = id => (save.broken[id] ||= {});
// How many shells there are to find in all: one in each place scene.js marks with a shell.
const SHELLS = 7;

/* ---------------- the islands ---------------- */
// The island you stand on is painted in full at the middle of the world; the others are quick, sparse copies on the
// horizon, where they lie from here. The sea and the clouds stay with you.
const objects = new Map(); let island = null, splatCount = 0, building = false;
const islandRoot = new THREE.Group(); scene.add(islandRoot);
const farRoot = new THREE.Group(); scene.add(farRoot);
const far = new Map();   // island id -> { root, result, parts }
const people = new Map();   // kind -> painted parts (people are painted once and kept)
let worldParts = null, seaPart = null; const clouds = [];
function buildState(id) { return { broken: save.broken[id] || {}, sprouts: id === 'home' ? save.sprouts : [], day: save.day }; }
async function loadIsland(id, { quiet = false } = {}) {
  building = true; if (!quiet) { $('loading').classList.remove('done'); setProgress(0, ISLANDS[id].name); }
  const made = await build(id, { density: DENSITY, cell: CELL, state: buildState(id), onProgress: p => { if (!quiet) setProgress(p * 0.95, ISLANDS[id].name); } });
  // swap: the old island goes, the new one comes
  for (const o of objects.values()) { for (const p of o.parts) dropPart(p); o.root.parent?.remove(o.root); } objects.clear();
  island = made; splatCount = made.count;
  if (id === 'home') save.sprouts = save.sprouts.filter(s => made.sprouts.includes(s[0]));   // a sprout with no room to grow never came up
  for (const o of made.objects) {
    const root = new THREE.Group(); root.name = o.id; islandRoot.add(root);
    const entry = { ...o, root, parts: [], state: 'whole', t: 0, wait: 0, hp: Math.max(1, o.hits || 1), shake: 0 };
    for (const p of made.parts.filter(q => q.object === o.id)) entry.parts.push(meshPart(p, root, { mid: o.center }));
    if (o.person) await placePerson(entry);
    objects.set(o.id, entry);
  }
  placeGoatHome(); placeFar(); building = false;
  if (!quiet) { setProgress(1, ISLANDS[id].name); $('loading').classList.add('done'); }
  updateHud(); return made;
}
async function placePerson(entry) {
  if (!people.has(entry.person)) people.set(entry.person, figure(entry.person, { density: DENSITY }));
  const g = entry.ground, root = entry.root; root.position.set(g[0], g[1], g[2]);
  for (const p of [...people.get(entry.person), blobShadow(0.32)]) entry.parts.push(meshPart(p, root, { fly: false }));
  root.rotation.y = Math.atan2(-g[0], -g[2]);   // they face the middle of the island
  entry.center = [g[0], g[1] + 0.6, g[2]];
}
async function paintFar() {
  for (const id of ORDER) {
    if (far.has(id)) continue;
    const result = await build(id, { density: 70 * Math.max(QUALITY, 0.5), cell: 0.5, far: true, state: {} }), root = new THREE.Group(); farRoot.add(root);
    far.set(id, { root, result, parts: result.parts.map(p => meshPart(p, root, { fly: false })) }); placeFar();
  }
}
function placeFar() {
  const here = ISLANDS[save.island].at;
  for (const [id, f] of far) { f.root.visible = id !== save.island; f.root.position.set(ISLANDS[id].at[0] - here[0], 0, ISLANDS[id].at[1] - here[1]); }
}
function paintWorld() {
  worldParts = world({ density: DENSITY });
  seaPart = meshPart(worldParts.sea, scene, { fly: false });
  for (const c of worldParts.clouds) { const root = new THREE.Group(); scene.add(root); clouds.push({ root, part: meshPart({ ...c, pivot: [0, 0, 0] }, root, { fly: false }), at: c.pivot, drift: Math.random() * 6 }); }
}

/* ---------------- breaking and coming back ---------------- */
// A hit on a thing breaks it when its last hit lands: its strokes fly apart and fade. A thing that comes back ('pop')
// waits a moment and pops back onto its shapes. One that comes back at dawn, or never, stays gone, and the save keeps it.
const easeBack = t => { const k = 1.9; return 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2; };
function breakApart(o) { if (!o || o.fixed || o.state !== 'whole') return false; o.state = 'breaking'; o.t = 0; return true; }
function stepBreaking(dt) {
  for (const o of objects.values()) {
    if (o.shake > 0) { o.shake = Math.max(0, o.shake - dt); const k = o.shake * 0.25; o.root.position.x = (Math.random() - 0.5) * k + (o.ground?.[0] || 0); o.root.position.z = (Math.random() - 0.5) * k + (o.ground?.[2] || 0); if (!o.shake) o.root.position.set(...(o.ground || [0, 0, 0])); }
    if (o.state === 'whole' || o.state === 'away') continue;
    if (o.state === 'breaking') {
      o.t = Math.min(1, o.t + dt / (reduced ? 0.01 : 0.9));
      for (const p of o.parts) writePart(p, (i, x, y, z) => { const f = p.fly, t = clamp((o.t - f[i * 4 + 3]) / (1 - f[i * 4 + 3]), 0, 1), d = t * 2.2; return [x + f[i * 4] * d, y + f[i * 4 + 1] * d - 2.4 * t * t, z + f[i * 4 + 2] * d, 1 - 0.5 * t, 1 - t]; });
      if (o.t >= 1) { for (const p of o.parts) p.mesh.visible = false; if (o.again === 'pop') { o.state = 'gone'; o.wait = 1.1; } else o.state = 'away'; }
    } else if (o.state === 'gone') {
      o.wait -= dt; if (o.wait <= 0) { o.state = 'forming'; o.t = 0; for (const p of o.parts) p.mesh.visible = true; sound.pop(); }
    } else if (o.state === 'forming') {
      o.t = Math.min(1, o.t + dt / (reduced ? 0.01 : 0.7));
      for (const p of o.parts) writePart(p, (i, x, y, z) => { const t = clamp((o.t - p.fly[i * 4 + 3] * 0.6) / (1 - p.fly[i * 4 + 3] * 0.6), 0, 1), k = easeBack(t), m = p.mid; return [m[0] + (x - m[0]) * k, m[1] + (y - m[1]) * k, m[2] + (z - m[2]) * k, Math.max(0, k), clamp(t * 1.6, 0, 1)]; });
      if (o.t >= 1) { o.state = 'whole'; o.hp = Math.max(1, o.hits || 1); for (const p of o.parts) writePart(p); }
    }
  }
}

/* ---------------- you, the keeper ---------------- */
const player = { x: 0, z: 0, y: 0, face: 0, walk: 0, moving: false, goal: null, act: null, speed: 2.3 };
const playerRoot = new THREE.Group(); scene.add(playerRoot); let playerParts = [];
function paintPlayer() { playerParts = [...figure('keeper', { density: DENSITY }), blobShadow(0.3)].map(p => meshPart(p, playerRoot, { fly: false })); }
function solids() { const out = []; for (const o of objects.values()) if (o.solid && o.state !== 'away' && o.kind !== 'dock') out.push([o.ground?.[0] ?? o.center[0], o.ground?.[2] ?? o.center[2], o.solid + 0.22]); if (goatOn()) out.push([goat.x, goat.z, 0.35]); return out; }
function keepOnLand(x, z, r = 0.35) {
  const R = ISLANDS[save.island].radius - 0.55; let d = Math.hypot(x, z); if (d > R) { x *= R / d; z *= R / d; }
  for (const [sx, sz, sr] of solids()) { const dx = x - sx, dz = z - sz, e = Math.hypot(dx, dz), want = sr + r - 0.22; if (e < want && e > 1e-4) { x = sx + dx / e * want; z = sz + dz / e * want; } }
  return [x, z];
}
const keys = new Set();
function movePlayer(dt) {
  if (!island) return;
  let mx = 0, mz = 0; const cam = view.yaw, fx = -Math.sin(cam), fz = -Math.cos(cam);
  if (!talking() && !mapOpen()) {
    if (keys.has('w') || keys.has('arrowup')) { mx += fx; mz += fz; } if (keys.has('s') || keys.has('arrowdown')) { mx -= fx; mz -= fz; }
    if (keys.has('a') || keys.has('arrowleft')) { mx += fz; mz -= fx; } if (keys.has('d') || keys.has('arrowright')) { mx -= fz; mz += fx; }
  }
  const speed = player.speed * (save.riding ? 1.6 : 1); let moving = false;
  if (mx || mz) { const l = Math.hypot(mx, mz); mx /= l; mz /= l; player.goal = null; player.act = null; moving = true; }
  else if (player.goal) {
    const dx = player.goal[0] - player.x, dz = player.goal[1] - player.z, d = Math.hypot(dx, dz);
    if (player.act && reach(objects.get(player.act) || (player.act === 'goat' ? goatThing() : null))) { const id = player.act; player.goal = null; player.act = null; act(id); }
    else if (d < 0.08) { player.goal = null; const id = player.act; player.act = null; if (id) act(id); }
    else { mx = dx / d; mz = dz / d; moving = true; if (d < speed * dt) { mx *= d / (speed * dt); mz *= d / (speed * dt); } }
  }
  if (moving) {
    const [x, z] = keepOnLand(player.x + mx * speed * dt, player.z + mz * speed * dt);
    if (player.goal && Math.hypot(x - player.x, z - player.z) < speed * dt * 0.15) player.stuck = (player.stuck || 0) + dt; else player.stuck = 0;
    if (player.stuck > 0.5) { player.goal = null; const id = player.act; player.act = null; if (id && reach(objects.get(id) || (id === 'goat' ? goatThing() : null), 0.7)) act(id); }
    player.x = x; player.z = z; player.face = lerpAngle(player.face, Math.atan2(mx, mz), Math.min(1, dt * 12)); player.walk += dt * 9;
  }
  player.moving = moving; player.y = island.heightAt(player.x, player.z);
  const ride = save.riding && goatOn();
  playerRoot.position.set(player.x, player.y + (ride ? 0.55 : moving && !reduced ? Math.abs(Math.sin(player.walk)) * 0.04 : 0), player.z); playerRoot.rotation.set(0, player.face, moving && !reduced && !ride ? Math.sin(player.walk) * 0.06 : 0);
  const sh = playerParts.find(p => p.shadow); if (sh) sh.group.visible = !ride;
}
const lerpAngle = (a, b, t) => a + wrap(b - a) * t;
// Near enough to use a thing: within a stride of its edge.
function reach(o, more = 0) { if (!o) return false; const c = o.ground || o.near || o.center; return Math.hypot(c[0] - player.x, c[2] - player.z) - (o.solid || 0.25) < 0.75 + more; }
function nearest() {
  let best = null, bd = Infinity;
  for (const o of [...objects.values(), goatOn() ? goatThing() : null]) {
    if (!o || o.fixed || o.state !== 'whole' || !reach(o)) continue; const c = o.ground || o.near || o.center, dx = c[0] - player.x, dz = c[2] - player.z, d = Math.hypot(dx, dz) - (o.solid || 0.25);
    const front = Math.cos(wrap(Math.atan2(dx, dz) - player.face)), score = d - front * 0.4 - (o.talk || o.use ? 0.3 : 0); if (score < bd) { bd = score; best = o; }
  }
  return best;
}
// Walk to a thing, then use it.
function goTo(o) {
  if (!o) return; if (o.use === 'sail') { openMap(); return; }
  if (reach(o)) { act(o.id); return; }
  const c = o.ground || o.center, dx = player.x - c[0], dz = player.z - c[2], d = Math.hypot(dx, dz) || 1, r = (o.solid || 0.25) + 0.45;
  player.goal = [c[0] + dx / d * r, c[2] + dz / d * r]; player.act = o.id;
}

/* ---------------- the goat ---------------- */
// The goat lives on Home Isle. It wanders and grazes; fed fruit, it trusts you. At three it follows you, and at five
// it lets you ride it. Its legs swing in diagonal pairs, its head nods, its tail flicks: each part turns on its joint.
const GOAT_SIZE = 1.5;
const goat = { x: 2, z: 2, face: 0, goal: null, graze: 0, next: 4, phase: 0, root: new THREE.Group(), parts: [] };
scene.add(goat.root); goat.root.scale.setScalar(GOAT_SIZE);
const goatOn = () => save.island === 'home' && goat.parts.length > 0;
const goatThing = () => ({ id: 'goat', kind: 'goat', label: 'Goat', state: 'whole', solid: 0.3, center: [goat.x, (island?.heightAt(goat.x, goat.z) || 0) + 0.5, goat.z], ground: [goat.x, 0, goat.z], radius: 0.7 });
function paintGoatOnce() { goat.parts = [...paintGoat({ density: DENSITY }), { ...blobShadow(0.36), pivot: [0, -0.47, 0] }].map(p => meshPart(p, goat.root, { fly: false })); }
function placeGoatHome() { goat.root.visible = goatOn(); if (goatOn()) { const [x, z] = keepOnLand(-2.2, 1.6, 0.4); goat.x = x; goat.z = z; } }
function moveGoat(dt) {
  if (!goatOn() || !island) return;
  const follow = save.goat.trust >= 3 && !save.riding, ride = save.riding;
  let walking = false;
  if (ride) { goat.x = player.x; goat.z = player.z; goat.face = player.face - Math.PI / 2; walking = player.moving; }
  else {
    if (follow) { const dx = player.x - goat.x, dz = player.z - goat.z, d = Math.hypot(dx, dz); goat.goal = d > 1.4 ? [player.x - dx / d * 1.0, player.z - dz / d * 1.0] : null; goat.graze = 0; }
    else if (!goat.goal) { goat.next -= reduced ? 0 : dt; if (goat.next <= 0 && goat.graze <= 0) { if (Math.random() < 0.45) goat.graze = 3; else { const a = Math.random() * Math.PI * 2, r = Math.random() * (ISLANDS.home.radius - 1.2); goat.goal = keepOnLand(Math.cos(a) * r, Math.sin(a) * r, 0.4); } goat.next = 3 + Math.random() * 5; } }
    if (goat.graze > 0) goat.graze -= dt;
    if (goat.goal && !reduced) {
      const dx = goat.goal[0] - goat.x, dz = goat.goal[1] - goat.z, d = Math.hypot(dx, dz), sp = follow ? 2.2 : 0.7;
      if (d < 0.1) goat.goal = null; else { const s = Math.min(d, sp * dt), nx = goat.x + dx / d * s, nz = goat.z + dz / d * s; const R = ISLANDS.home.radius - 0.7, e = Math.hypot(nx, nz); goat.x = e > R ? nx * R / e : nx; goat.z = e > R ? nz * R / e : nz; goat.face = lerpAngle(goat.face, Math.atan2(-dz, dx), Math.min(1, dt * 6)); walking = true; }
    }
  }
  if (walking) goat.phase += dt * 7.5;
  const y = island.heightAt(goat.x, goat.z) + 0.47 * GOAT_SIZE;
  goat.root.position.set(goat.x, y + (walking ? Math.abs(Math.sin(goat.phase)) * 0.025 : 0), goat.z); goat.root.rotation.y = goat.face;
  for (const p of goat.parts) {
    if (p.name.startsWith('goat-leg')) { const i = +p.name.slice(-1), pair = i === 0 || i === 3 ? 0 : Math.PI; p.group.rotation.z = walking ? Math.sin(goat.phase + pair) * 0.45 : 0; }
    else if (p.name === 'goat-head') p.group.rotation.z = goat.graze > 0 ? -0.95 + Math.sin(performance.now() / 260) * 0.08 : Math.sin(goat.phase * 0.5) * 0.08;
    else if (p.name === 'goat-tail') p.group.rotation.y = Math.sin(performance.now() / 120) * 0.5;
  }
}

/* ---------------- the story ---------------- */
// Each person needs one thing. The chain: the lamp keeper sleeps and only the bell can wake them; the bell has lost its
// clapper and a stone from the orchard wall will do; the gardener lets you take one when the thornbushes are cleared;
// awake, the lamp keeper needs oil; the fisher trades oil for the rope lost in a crate. Then the lighthouse shines.
function thornsLeft() { const b = save.broken.orchard || {}; return [0, 1, 2, 3].filter(i => !b['thorn' + i]).length; }
const NAMES = { gardener: 'Gardener', bellringer: 'Bellringer', fisher: 'Fisher', lampkeeper: 'Lamp keeper' };
function talkTo(kind) {
  const f = save.flags, inv = save.inv, say = [];
  if (kind === 'lampkeeper') {
    if (!f.bell) { f.sawSleeper = true; say.push('Zzz…', '(The lamp keeper sleeps very deeply. Something loud might wake them. A bell, perhaps.)'); }
    else if (!f.lit && inv.oil) { inv.oil--; f.lit = true; say.push('Oil! Now hold the ladder while I fill the lamp…', 'There. Watch the water tonight.'); setTimeout(theEnd, 1200); }
    else if (!f.lit) { f.oilAsked = true; say.push('That bell! I am awake, I am awake. Thank you, friend.', 'But my lamp is dry, and dry lamps do not shine. The fisher on Wreck Isle keeps lamp oil.'); }
    else say.push('The light turns all night now. Every boat can find its way home.', 'Come back at dusk and look.');
  } else if (kind === 'bellringer') {
    if (!f.clapper && inv.stone) { inv.stone--; f.clapper = true; say.push('A good round stone! Hold still… there. A new clapper.', 'Go on, ring it. Use the tower.'); }
    else if (!f.clapper) { f.bellAsked = true; say.push('My bell lost its clapper in the last storm. Without it, it only hums.', 'A round stone would do. The old wall on Orchard Isle is full of them, but the gardener is fussy about that wall.'); }
    else if (!f.bell) say.push('Ring it! The tower is right there.');
    else say.push('Did you hear it go over the water? I think the whole sea heard.');
  } else if (kind === 'gardener') {
    const left = thornsLeft();
    if (!f.gardenerOk && left > 0) { f.thornsAsked = true; say.push(left === 4 ? 'Thornbushes! They choke my fruit trees. Pull the four of them out and I will owe you.' : `Good work. ${left} thornbush${left > 1 ? 'es' : ''} still to go.`); if (f.bellAsked) say.push('A stone from my wall? Clear the thorns first, then we talk.'); }
    else if (!f.gardenerOk) { f.gardenerOk = true; inv.fruit += 3; say.push('My trees can breathe again! Take these: three fruit.', 'And if you need a stone, take one from the old wall. It has more than it needs.'); }
    else say.push('Goats will do anything for fruit. Shake a fruit tree when you need more: each tree gives once a day.');
  } else if (kind === 'fisher') {
    if (!f.oil && inv.rope) { inv.rope--; f.oil = true; inv.oil++; say.push('My net rope! You found it.', 'Here, a jar of lamp oil. Fair trade, and thank you.'); }
    else if (!f.oil) { f.ropeAsked = true; say.push('Lamp oil? I have a jar. But I lost my net rope when this old boat broke up.', 'It went into one of those crates. Find it and the oil is yours.'); }
    else say.push('Mind the crabs. And mind the light tonight.');
  }
  store(); dialog(NAMES[kind], say);
}
function goal() {
  const f = save.flags, inv = save.inv;
  if (f.lit) return 'The light shines. Keep your island, find shells, ride your goat.';
  if (inv.oil) return 'Bring the oil to the lamp keeper on Lantern Isle.';
  if (f.bell && !f.oilAsked) return 'The bell rang. See the lamp keeper on Lantern Isle.';
  if (f.oilAsked && inv.rope) return 'Bring the rope to the fisher on Wreck Isle.';
  if (f.oilAsked && f.ropeAsked) return 'Break the crates on Wreck Isle to find the rope.';
  if (f.oilAsked) return 'Ask the fisher on Wreck Isle for lamp oil.';
  if (f.clapper) return 'Ring the bell on Bell Isle.';
  if (inv.stone) return 'Bring the stone to the bellringer on Bell Isle.';
  if (f.gardenerOk) return 'Break a stone out of the old wall on Orchard Isle.';
  if (f.thornsAsked) return `Clear the thornbushes on Orchard Isle (${thornsLeft()} left), then see the gardener.`;
  if (f.bellAsked) return 'Find a round stone. Ask the gardener on Orchard Isle.';
  if (f.sawSleeper) return 'Wake the lamp keeper. Bell Isle has a bell.';
  return 'The lighthouse on Lantern Isle is dark. Take the boat (Map) and find out why.';
}
function theEnd() { sound.lit(); $('end').hidden = false; $('endDays').textContent = `${save.day} day${save.day > 1 ? 's' : ''} · ${save.inv.shell} of ${SHELLS} shells`; $('endGo').focus(); }

/* ---------------- using things ---------------- */
// One verb: act. Talk to a person, feed the goat, use a well or a bell or a flower, or hit a thing until it breaks.
function act(id) {
  const o = id === 'goat' ? goatThing() : objects.get(id); if (!o || o.state !== 'whole') return;
  const c = o.ground || o.center; player.face = Math.atan2(c[0] - player.x, c[2] - player.z);
  if (o.talk) return talkTo(o.talk);
  if (o.kind === 'goat') return feedGoat();
  if (o.use === 'sail') return openMap();
  if (o.use === 'well') { if (save.inv.water) return toast('Your can is already full.'); sound.well(); save.inv.water = 1; store(); updateHud(); return toast('You fill the watering can.'); }
  if (o.use === 'bloom') {
    if (save.bloom.watered >= save.day) return toast('The lantern-bloom has had its water today.');
    if (!save.inv.water) return toast('The lantern-bloom is thirsty. Fill your can at the well.');
    sound.water(); save.inv.water = 0; save.bloom.watered = save.day; save.bloom.health = 3; store(); updateHud(); return toast('You water the lantern-bloom. It glows a little brighter.');
  }
  if (o.use === 'bell') {
    if (!save.flags.clapper) { sound.hum(); return toast('The bell has no clapper. It only hums.'); }
    o.shake = 0.6; shakeCam = 0.5; floatText('BONG', o.bell || o.center); sound.bell();
    if (!save.flags.bell) { save.flags.bell = true; store(); setTimeout(() => dialog('', ['The bell rings out across the water.', 'Far away, on Lantern Isle, someone wakes with a start.']), 700); }
    updateHud(); return;
  }
  hit(o);
}
function hit(o) {
  if (o.kind === 'stonewall' && !save.flags.gardenerOk) { o.shake = 0.3; return toast('The gardener\'s old wall. Better ask first.'); }
  o.hp -= 1; if (o.hp > 0) { o.shake = 0.35; sound.hit(o.kind); return toast(`${o.label}: one more hit${o.hp > 1 ? ` (${o.hp} left)` : ''}.`); }
  if (!breakApart(o)) return;
  sound.smash(o.kind);
  if (o.again !== 'pop') { brokenOn(save.island)[o.id] = o.again; if (o.id.startsWith('sprout')) { save.sprouts = save.sprouts.filter(s => s[0] !== o.id); delete brokenOn(save.island)[o.id]; } }
  const key = save.island + ':' + o.id;
  if (o.loot && !save.taken[key]) { save.taken[key] = 1; save.inv[o.loot] = (save.inv[o.loot] || 0) + 1; sound.pickup(o.loot); toast({ shell: 'A shell! ', rope: 'The fisher\'s net rope!', stone: 'A good round stone.' }[o.loot] + (o.loot === 'shell' ? `(${save.inv.shell} of ${SHELLS})` : '')); }
  else if (o.kind === 'tree' && o.label === 'Fruit tree' && save.picked[key] !== save.day) { save.picked[key] = save.day; save.inv.fruit += 1; sound.pickup('fruit'); toast('A fruit falls. You catch it.'); }
  else if (o.kind === 'thornbush' && save.island === 'orchard' && !save.flags.gardenerOk) { const left = thornsLeft(); toast(left ? `Thornbush cleared. ${left} to go.` : 'The last thornbush! Tell the gardener.'); }
  else if (o.id.startsWith('sprout')) toast('You pull the thorn sprout up, roots and all.');
  store(); updateHud();
}
function feedGoat() {
  const g = save.goat;
  sound.goat();
  if (!save.inv.fruit) return toast(g.trust >= 5 ? 'The goat nudges you. It wants fruit, but it lets you ride anyway.' : 'The goat sniffs your hands. Nothing to eat. (Fruit grows on Orchard Isle.)');
  save.inv.fruit--; g.trust = Math.min(5, g.trust + 1); store(); updateHud(); goat.graze = 1.2;
  toast(['', 'The goat eats the fruit and looks at you.', 'The goat lets you scratch its ears.', 'The goat follows you now.', 'The goat follows you everywhere.', 'The goat kneels: you can ride it now.'][g.trust]);
}

/* ---------------- the day ---------------- */
// Light is baked into the strokes, so the time of day is a tint on every mesh: warm by day, rose at dusk, blue at
// night. Lamps and windows keep their glow. Each dawn new thorn sprouts come up on Home Isle, sprouts left two days
// grow into thorn trees, the flower wilts a little if no one watered it, and broken pots and crates are whole again.
const KEYS = [[0, [0.86, 0.72, 0.78], '#e7a796', '#f5c8b0', '#3b3555'], [0.08, [1, 1, 1], '#f2b58a', '#9cc6de', '#2f6f86'], [0.6, [1, 1, 1], '#f2b58a', '#9cc6de', '#2f6f86'], [0.7, [1, 0.74, 0.62], '#d26e5a', '#73405f', '#2f2340'], [0.79, [0.44, 0.5, 0.8], '#2a2850', '#141533', '#13203a'], [0.95, [0.44, 0.5, 0.8], '#2a2850', '#141533', '#13203a'], [1, [0.86, 0.72, 0.78], '#e7a796', '#f5c8b0', '#3b3555']];
const cMid = new THREE.Color(), cTop = new THREE.Color(), cLow = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();
let night = 0;
function daylight() {
  const t = save.time % 1; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++;
  const [t0, l0, m0, s0, w0] = KEYS[i], [t1, l1, m1, s1, w1] = KEYS[i + 1], k = clamp((t - t0) / (t1 - t0), 0, 1), s = k * k * (3 - 2 * k);
  const light = l0.map((v, j) => lerp(v, l1[j], s));
  cMid.copy(cA.set(m0)).lerp(cB.set(m1), s); cTop.copy(cA.set(s0)).lerp(cB.set(s1), s); cLow.copy(cA.set(w0)).lerp(cB.set(w1), s);
  skyMat.uniforms.uMid.value.copy(cMid).convertSRGBToLinear(); skyMat.uniforms.uTop.value.copy(cTop).convertSRGBToLinear(); skyMat.uniforms.uLow.value.copy(cLow).convertSRGBToLinear();
  renderer.setClearColor(cMid); night = clamp((1 - light[1]) / 0.5, 0, 1); starMat.opacity = night * 0.9;
  const bloomGlow = [0.35, 0.55, 0.8, 1][save.bloom.health];
  for (const p of allParts) {
    let want = light;
    if (p.glow) {
      const dark = (p.object === 'lighthouse' || p.lamp) && !save.flags.lit, isBloom = p.object === 'bloom';
      want = dark ? [0.25, 0.26, 0.32] : isBloom ? [bloomGlow, bloomGlow, bloomGlow] : [1, 1, 1];
    }
    const q = want.map(v => Math.round(v * 48) / 48); if (q[0] === p.lit[0] && q[1] === p.lit[1] && q[2] === p.lit[2]) continue;
    p.lit = q; p.mesh.recolor.setRGB(q[0], q[1], q[2]);
  }
}
function stepDay(dt) {
  if (talking() || mapOpen() || !$('end').hidden || building) return;
  save.time += dt / DAY; if (save.time >= 1) { save.time -= 1; dawn(); }
}
async function dawn() {
  save.day += 1; sound.dawn();
  if (save.bloom.watered < save.day - 1) save.bloom.health = Math.max(0, save.bloom.health - 1);
  if (save.sprouts.length < 7) save.sprouts.push(...sproutSpots(save.day, 2).map(id => [id, save.day]));
  let here = save.island === 'home';
  for (const [id, b] of Object.entries(save.broken)) for (const [k, how] of Object.entries(b)) if (how === 'dawn') { delete b[k]; if (id === save.island) here = true; }
  store(); toast(`Day ${save.day}. ` + (save.bloom.health < 3 ? 'The lantern-bloom droops. It needs water.' : 'A new morning on the sea.'));
  if (here) await loadIsland(save.island, { quiet: true });
}

/* ---------------- sailing ---------------- */
function openMap() {
  if (talking()) return; const list = $('isles'); list.textContent = '';
  for (const id of ORDER) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.isle = id; b.disabled = id === save.island;
    const name = document.createElement('b'), note = document.createElement('small'); name.textContent = ISLANDS[id].name; note.textContent = id === save.island ? 'You are here' : NOTE[id](); b.append(name, note); b.addEventListener('click', () => sail(id)); list.append(b);
  }
  $('map').hidden = false; list.querySelector('button:not(:disabled)')?.focus();
}
const NOTE = { home: () => 'Your cottage, your flower, your goat', orchard: () => (save.flags.gardenerOk ? 'The gardener, and the old wall' : 'Fruit trees and a gardener'), bell: () => (save.flags.bell ? 'The bell has rung' : 'A tall bell tower'), wreck: () => (save.flags.oil ? 'The fisher has their rope' : 'A wreck, and a fisher'), light: () => (save.flags.lit ? 'The lighthouse shines' : 'The dark lighthouse') };
function closeMap() { $('map').hidden = true; }
const mapOpen = () => !$('map').hidden;
async function sail(id) {
  if (building || id === save.island) return; closeMap(); save.riding = false; sound.sail();
  $('loading').classList.remove('done'); $('loadTitle').textContent = 'Sailing…'; setProgress(0, ISLANDS[id].name);
  save.island = id; store(); placeFar();
  await loadIsland(id);
  player.x = island.start[0]; player.z = island.start[1]; player.face = Math.atan2(-player.x, -player.z); player.goal = null;
  view.yaw = player.face + Math.PI; $('loadTitle').textContent = 'SPLAT ISLE'; updateHud();
  if (!save.flags.visited?.[id]) { (save.flags.visited ||= {})[id] = 1; store(); toast(ISLANDS[id].name); }
}

/* ---------------- talking and notes ---------------- */
let lines = [], speaker = '';
function dialog(who, said) { lines = [...said]; speaker = who; nextLine(); }
function nextLine() { if (!lines.length) { $('talk').hidden = true; updateHud(); return; } sound.voice(speaker); $('talkName').textContent = speaker; $('talkName').hidden = !speaker; $('talkText').textContent = lines.shift(); $('talk').hidden = false; }
const talking = () => !$('talk').hidden;
let toastTimer = 0; function toast(text) { const t = $('toast'); t.textContent = text; t.hidden = false; toastTimer = 3.2; }
const floats = []; function floatText(text, at) { const el = document.createElement('div'); el.className = 'float'; el.textContent = text; document.body.append(el); floats.push({ el, at: new THREE.Vector3(at[0], at[1] + 0.6, at[2]), t: 0 }); }
function stepNotes(dt) {
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').hidden = true; }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += dt; const v = f.at.clone().add(new THREE.Vector3(0, f.t * 0.8, 0)).project(camera); f.el.style.transform = `translate(${(v.x + 1) / 2 * innerWidth}px, ${(1 - v.y) / 2 * innerHeight}px) translate(-50%, -50%)`; f.el.style.opacity = String(clamp(1.6 - f.t, 0, 1)); if (f.t > 1.6) { f.el.remove(); floats.splice(i, 1); } }
}
function updateHud() {
  const inv = save.inv, chips = [['Shells', `${inv.shell}/${SHELLS}`], inv.fruit && ['Fruit', inv.fruit], inv.water && ['Can', 'full'], inv.stone && ['Stone', inv.stone], inv.rope && ['Rope', inv.rope], inv.oil && ['Oil', inv.oil], save.goat.trust && ['Goat', '♥'.repeat(save.goat.trust)]].filter(Boolean);
  // built from text nodes, never from markup: the numbers come from the saved game
  $('inv').replaceChildren(...chips.map(([k, v]) => { const span = document.createElement('span'), b = document.createElement('b'); b.textContent = k; span.append(b, ' ' + v); return span; }));
  $('goal').textContent = goal(); $('where').textContent = `${ISLANDS[save.island].name} · Day ${save.day}`;
  const home = [];
  if (save.bloom.watered < save.day) home.push('water the lantern-bloom'); if (save.sprouts.length) home.push(`pull ${save.sprouts.length} thorn sprout${save.sprouts.length > 1 ? 's' : ''}`);
  $('chores').textContent = home.length ? 'Home: ' + home.join(', ') : ''; $('chores').hidden = !home.length;
  $('bRide').hidden = !(goatOn() && save.goat.trust >= 5); $('bRide').setAttribute('aria-pressed', String(!!save.riding));
}
let near = null;
function updateAct() {
  near = talking() || mapOpen() ? null : nearest();
  const b = $('bAct'), what = near ? (near.talk ? `Talk to ${near.label}` : near.kind === 'goat' ? (save.inv.fruit ? 'Feed the goat' : 'Pat the goat') : near.use === 'well' ? 'Fill the can' : near.use === 'bloom' ? 'Water the bloom' : near.use === 'bell' ? 'Ring the bell' : near.use === 'sail' ? 'Sail' : `Hit the ${near.label.toLowerCase()}`) : '';
  if (b.dataset.what !== what) { b.dataset.what = what; b.textContent = what || 'Act'; b.disabled = !what; }
}

/* ---------------- camera ---------------- */
// The view follows you from behind and above. Drag to turn round you; the wheel or a pinch moves in and out.
// a tall phone screen stands further back, to see round you
const view = { yaw: 0.6, pitch: 0.5, dist: innerWidth < innerHeight ? 9.5 : 7, at: new THREE.Vector3() }; let shakeCam = 0;
function placeCamera(dt) {
  const want = new THREE.Vector3(player.x, player.y + 0.7, player.z); view.at.lerp(want, Math.min(1, dt * 6));
  const o = new THREE.Vector3(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch)).multiplyScalar(view.dist).add(view.at);
  if (shakeCam > 0) { shakeCam -= dt; o.x += (Math.random() - 0.5) * shakeCam * 0.3; o.y += (Math.random() - 0.5) * shakeCam * 0.3; }
  if (island) { const g = island.heightAt(o.x, o.z); if (Math.hypot(o.x, o.z) < ISLANDS[save.island].radius && o.y < g + 0.4) o.y = g + 0.4; }
  camera.position.copy(o); camera.lookAt(view.at);
}
let drag = null; const pinch = new Map();
canvas.addEventListener('pointerdown', e => { pinch.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, at: performance.now(), moved: 0 }; canvas.setPointerCapture?.(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (pinch.has(e.pointerId)) { const before = [...pinch.values()]; const d0 = before.length === 2 ? Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y) : 0; pinch.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pinch.size === 2) { const now = [...pinch.values()], d1 = Math.hypot(now[0].x - now[1].x, now[0].y - now[1].y); if (d0 > 0) view.dist = clamp(view.dist * d0 / d1, 4, 22); if (drag) drag.moved = 99; return; } }
  if (!drag) { canvas.style.cursor = pickAt(e.clientX, e.clientY) ? 'pointer' : 'grab'; return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  view.yaw -= dx * 0.006; view.pitch = clamp(view.pitch + dy * 0.004, 0.12, 1.3);
});
const lift = e => {
  pinch.delete(e.pointerId); if (!drag) return; const tap = drag.moved < 8 && performance.now() - drag.at < 450, d = drag; drag = pinch.size ? drag : null;
  if (!tap || e.type !== 'pointerup' || !island || building) return;
  if (talking()) { nextLine(); return; }
  const id = pickAt(d.sx, d.sy); if (id) { goTo(id === 'goat' ? goatThing() : objects.get(id)); return; }
  const g = groundAt(d.sx, d.sy); if (g) { player.goal = keepOnLand(g[0], g[1]); player.act = null; }
};
canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift);
canvas.addEventListener('wheel', e => { e.preventDefault(); view.dist = clamp(view.dist * Math.exp(e.deltaY * 0.001), 4, 22); }, { passive: false });
// The thing under a point of the screen: the nearest object whose sphere the ray passes through.
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(x, y) {
  if (!island) return null; ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); let best = null, near2 = Infinity;
  for (const o of [...objects.values(), goatOn() ? goatThing() : null]) { if (!o || o.fixed || o.state !== 'whole') continue; const c = new THREE.Vector3(...o.center), hit2 = ray.ray.distanceSqToPoint(c) < (o.radius * 0.75) ** 2; const d = c.distanceTo(ray.ray.origin); if (hit2 && d < near2) { near2 = d; best = o.id; } }
  return best;
}
// The ground under a point of the screen: march the ray until it passes under the island's surface.
function groundAt(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); const o = ray.ray.origin, d = ray.ray.direction, R = ISLANDS[save.island].radius;
  for (let t = 0.5; t < 40; t += 0.08) { const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t; if (py < SEA) return null; if (Math.hypot(px, pz) < R && py <= island.heightAt(px, pz)) return [px, pz]; if (py < -1.5) return null; }
  return null;
}

/* ---------------- controls ---------------- */
function paintButtons() {
  $('bPixel').setAttribute('aria-pressed', String(look.pixel)); $('bPalette').textContent = 'Palette: ' + look.palette[0].toUpperCase() + look.palette.slice(1); $('bPalette').disabled = !look.pixel;
  $('bShapes').setAttribute('aria-pressed', String(look.xray)); $('goopValue').textContent = look.goop.toFixed(1) + '×';
}
$('bPixel').addEventListener('click', () => { look.pixel = !look.pixel; paintButtons(); });
$('bPalette').addEventListener('click', () => setPalette(PALETTE_NAMES[(PALETTE_NAMES.indexOf(look.palette) + 1) % PALETTE_NAMES.length]));
$('bShapes').addEventListener('click', () => showShapes(!look.xray));
// Sound starts on the first press (browsers ask for that). The Sound button is the arcade's one sound switch.
const startSound = () => { sound.start(); paintSound(); };
for (const k of ['pointerdown', 'keydown']) addEventListener(k, startSound, { capture: true, passive: true });
function paintSound() { $('bSound').setAttribute('aria-pressed', String(sound.on())); }
$('bSound').addEventListener('click', () => { sound.start(); sound.toggle(); paintSound(); });
paintSound();
$('bLook').addEventListener('click', () => { const p = $('lookPanel'); p.hidden = !p.hidden; $('bLook').setAttribute('aria-expanded', String(!p.hidden)); });
$('bAct').addEventListener('click', () => { if (talking()) nextLine(); else if (near) act(near.id); });
$('bMap').addEventListener('click', () => (mapOpen() ? closeMap() : openMap()));
$('mapClose').addEventListener('click', closeMap);
$('bRide').addEventListener('click', () => { save.riding = !save.riding; store(); updateHud(); });
$('talk').addEventListener('click', nextLine);
$('endGo').addEventListener('click', () => { $('end').hidden = true; updateHud(); });
let sure = false;
$('bReset').addEventListener('click', () => { if (!sure) { sure = true; $('bReset').textContent = 'Sure? Tap again'; setTimeout(() => { sure = false; $('bReset').textContent = 'New game'; }, 3000); return; } try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage off */ } location.reload(); });
// Goop: the size of every stroke. Small strokes show the dots; large ones melt into each other.
let goopQueued = false;
$('goop').addEventListener('input', e => { look.goop = +e.target.value; paintButtons(); if (goopQueued) return; goopQueued = true; requestAnimationFrame(() => { goopQueued = false; for (const p of allParts) if (!p.shadow) { const o = objects.get(p.object); if (!o || o.state === 'whole') writePart(p); } }); });
addEventListener('keydown', e => {
  if (window.GameSwitch?.isOpen || e.target.closest?.('input')) return; const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); e.preventDefault(); return; }
  if (k === 'escape') { if (mapOpen()) closeMap(); else if (!$('lookPanel').hidden) $('bLook').click(); return; }
  if ((k === 'e' || k === ' ' || k === 'enter') && !e.target.closest?.('button')) { e.preventDefault(); if (!$('end').hidden) $('endGo').click(); else if (talking()) nextLine(); else if (near) act(near.id); return; }
  if (k === 'm') $('bMap').click(); else if (k === 'p') $('bPixel').click(); else if (k === 'c') $('bPalette').click(); else if (k === 'x') $('bShapes').click(); else if (k === 'g' && !$('bRide').hidden) $('bRide').click();
  else if (k === 'q') view.yaw += 0.2; else if (k === 'r') view.yaw -= 0.2;
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); addEventListener('blur', () => keys.clear());
function setProgress(p, name = '') { const pct = Math.round(p * 100); $('loadingBar').firstElementChild.style.width = pct + '%'; $('loadingBar').setAttribute('aria-valuenow', pct); $('loadLine').textContent = pct < 100 ? `Painting ${name || 'the islands'}… ${pct}%` : 'Ready'; }

/* ---------------- the frame ---------------- */
let last = performance.now(), clock = 0;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  if (island && !window.GameSwitch?.isOpen && !document.hidden) {
    stepBreaking(dt); movePlayer(dt); moveGoat(dt); stepDay(dt); daylight(); stepNotes(dt); updateAct();
    sound.update(dt, { night, moving: player.moving, island: save.island, quiet: building });
    if (seaPart && !reduced) seaPart.group.position.y = SEA + Math.sin(now / 900) * 0.025;
    const here = ISLANDS[save.island].at;
    for (const c of clouds) { if (!reduced) c.drift += dt * 0.12; const x = ((c.at[0] + c.drift + here[0] * 0.2 + 60) % 120) - 60; c.root.position.set(x, c.at[1], c.at[2]); }
    placeBeam(now); scene.updateMatrixWorld(); placeCamera(dt);
  }
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  if (look.pixel) { renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(post, postCam); }
  else renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
function placeBeam(now) {
  const lh = save.island === 'light' ? objects.get('lighthouse') : far.get('light')?.result.objects.find(o => o.id === 'lighthouse');
  beam.visible = !!(save.flags.lit && lh && night > 0.05); if (!beam.visible) return;
  const off = save.island === 'light' ? [0, 0] : [ISLANDS.light.at[0] - ISLANDS[save.island].at[0], ISLANDS.light.at[1] - ISLANDS[save.island].at[1]];
  beam.position.set(lh.lamp[0] + off[0], lh.lamp[1], lh.lamp[2] + off[1]); beam.rotation.set(0, reduced ? 0.6 : now / 2600, -0.06); beam.material.opacity = night * 0.16;
}
async function start() {
  setPalette('dusk'); paintButtons(); requestAnimationFrame(tick);
  setProgress(0.02, 'the sea'); await new Promise(r => setTimeout(r, 0)); paintWorld(); paintPlayer(); paintGoatOnce();
  await loadIsland(save.island);
  [player.x, player.z] = keepOnLand(...island.start);
  player.face = Math.atan2(-player.x, -player.z) + 0.6; view.yaw = player.face + Math.PI - 0.5; view.at.set(player.x, island.heightAt(player.x, player.z) + 0.7, player.z);
  updateHud();
  if (!save.intro) { save.intro = true; store(); dialog('', ['You keep a cottage on Home Isle: a goat, a lantern-bloom, a well, and a little boat.', 'Across the water, the lighthouse on Lantern Isle has gone dark. Ships will lose their way.', 'Walk with a tap or WASD. Tap a thing, or press E, to use it, talk, or break it. Open the Map to sail.']); }
  paintFar().catch(e => console.error(e));
}
start().catch(error => { console.error(error); $('loadLine').textContent = 'The islands did not paint.'; });

// A handle for the browser check (qa/lab/splat-isle.e2e.mjs). The page never reads it.
window.__splatIsle = {
  state: () => ({ ready: !!island && !building && $('loading').classList.contains('done'), island: save.island, splats: splatCount, parts: allParts.size, objects: [...objects.keys()], far: [...far.keys()].filter(k => k !== save.island).length,
    pixel: look.pixel, palette: look.palette, goop: look.goop, xray: look.xray, riding: !!save.riding, talking: talking(), line: talking() ? $('talkText').textContent : '', map: mapOpen(), ended: !$('end').hidden,
    broken: [...objects.values()].filter(o => o.state !== 'whole').map(o => o.id + ':' + o.state), player: { x: +player.x.toFixed(2), z: +player.z.toFixed(2), walking: !!player.goal || player.moving },
    inv: { ...save.inv }, flags: { ...save.flags }, day: save.day, time: +save.time.toFixed(3), night: +night.toFixed(2), goal: goal(), goat: { x: +goat.x.toFixed(2), z: +goat.z.toFixed(2), trust: save.goat.trust }, near: near?.id || null, bloom: { ...save.bloom }, sprouts: save.sprouts.length, sound: sound.state() }),
  screen: id => { const o = id === 'goat' ? goatThing() : objects.get(id); if (!o) return null; const v = new THREE.Vector3(...o.center).project(camera); return v.z > 1 ? null : { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  pick: (x, y) => pickAt(x, y),
  // stand next to a thing, as if you had walked there
  go: id => { const o = id === 'goat' ? goatThing() : objects.get(id); if (!o) return false; const c = o.ground || o.near || o.center, a = Math.atan2(player.x - c[0], player.z - c[2]); [player.x, player.z] = keepOnLand(c[0] + Math.sin(a) * ((o.solid || 0.25) + 0.45), c[2] + Math.cos(a) * ((o.solid || 0.25) + 0.45)); player.goal = null; return reach(o); },
  act: id => act(id), next: () => nextLine(), sail: id => sail(id), time: t => { save.time = t; },
  dawn: () => dawn(),
};
