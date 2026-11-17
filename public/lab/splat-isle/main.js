// Splat Isle: an island written as shapes, painted with splats, lit once, and shown through a pixel-art pass.
// scene.js and sdf.js paint the splats; this page hands them to Spark, moves the parts, and draws the pixel pass.
// Query flags: ?q=low (fewer splats, for the browser check), ?seed=N, ?pixel=0, ?capture (keeps the frame readable).
import * as THREE from 'three';
import { SplatMesh, SparkRenderer, PackedSplats } from '@sparkjsdev/spark';
import { build, ISLAND } from './scene.js';

const $ = id => document.getElementById(id), query = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const canvas = $('view');

/* ---------------- renderer ---------------- */
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: query.has('capture') }); if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2'); }
catch (e) { $('loadLine').textContent = 'Splat Isle needs WebGL2 graphics, and this browser has none to give.'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor('#f2b58a');
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(48, 1, 0.05, 200);
scene.add(new SparkRenderer({ renderer, focalAdjustment: 1.4 }));

/* ---------------- the pixel pass ---------------- */
// The scene draws into a small target; a full-screen pass reads it with no smoothing, adds a 4x4 Bayer dither, and
// snaps each pixel to the nearest colour of a small palette. Off, the scene draws straight to the screen.
// After the GameDev.net "Pixel Art Palette Filter" and Maxime Heckel's dithering post-process (see design.md).
const PALETTES = {
  dusk: ['#1b1626', '#2f2340', '#4b3157', '#73405f', '#a3535e', '#d26e5a', '#f09a68', '#f6c58c', '#fbe9c4', '#fff8ea', '#2a4a5c', '#2f6f86', '#4aa2b3', '#8ed3d0', '#2e5232', '#3f7a3a', '#6aa548', '#a8cc62', '#e0e08a', '#6e4a36', '#9a6b47', '#c9965f', '#8c8a96', '#c5c1c9'],
  meadow: ['#14212b', '#24384a', '#3b5f6f', '#5c9a9a', '#9fd3c7', '#f4f1de', '#e8c07d', '#c9844a', '#8a4b2e', '#4d2c22', '#2d4d2a', '#4f7f3a', '#8fb35a', '#c84f4f', '#f08a8a', '#ffffff'],
  pocket: ['#0f2a1d', '#306230', '#8bac0f', '#d8f0a0'],
};
const PALETTE_NAMES = Object.keys(PALETTES), MAXP = 32;
const target = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
const pixelPass = new THREE.ShaderMaterial({
  uniforms: { uScene: { value: target.texture }, uSize: { value: new THREE.Vector2(4, 4) }, uPal: { value: Array.from({ length: MAXP }, () => new THREE.Color()) }, uCount: { value: 4 }, uDither: { value: 0.09 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `varying vec2 vUv; uniform sampler2D uScene; uniform vec2 uSize; uniform vec3 uPal[${MAXP}]; uniform int uCount; uniform float uDither;
    float bayer(vec2 p) { ivec2 i = ivec2(mod(p, 4.0)); int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return float(m[i.y * 4 + i.x]) / 16.0 - 0.47; }
    void main() {
      vec2 px = floor(vUv * uSize); vec3 c = texture2D(uScene, (px + 0.5) / uSize).rgb;
      c = pow(c, vec3(1.0 / 2.2)) + bayer(px) * uDither;               // dither in gamma space, where the palette lives
      vec3 best = uPal[0]; float bd = 1e9;
      for (int i = 0; i < ${MAXP}; i++) { if (i >= uCount) break; vec3 d = (c - uPal[i]) * vec3(0.8, 1.0, 0.6); float e = dot(d, d); if (e < bd) { bd = e; best = uPal[i]; } }
      gl_FragColor = vec4(pow(best, vec3(2.2)), 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const post = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pixelPass));
const look = { pixel: query.get('pixel') !== '0', palette: 'dusk', goop: 1, xray: false, ride: false };
function setPalette(name) {
  look.palette = name; const list = PALETTES[name]; pixelPass.uniforms.uCount.value = list.length; list.forEach((h, i) => pixelPass.uniforms.uPal.value[i].set(h).convertLinearToSRGB());
  pixelPass.uniforms.uDither.value = list.length <= 4 ? 0.22 : list.length <= 16 ? 0.12 : 0.08; paintButtons();
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 62 : 46; camera.updateProjectionMatrix();
  // about 270 lines of pixels on any screen: big chunky pixels that still read
  const lines = clamp(Math.round(h / 3.1), 170, 300), cols = Math.round(lines * w / h); target.setSize(cols, lines); pixelPass.uniforms.uSize.value.set(cols, lines);
}
addEventListener('resize', resize); resize();

/* ---------------- the island ---------------- */
// Each part becomes one Spark mesh in a group at its joint. The splats' own arrays stay with the part, so the page can
// write them again: a different stroke size (goop), or the pieces of a part that breaks apart and comes back.
const objects = new Map(); let island = null, splatCount = 0;
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
function clearIsland() { for (const o of objects.values()) { scene.remove(o.root); for (const p of o.parts) { p.mesh.dispose?.(); p.packed.dispose?.(); } } objects.clear(); }
async function makeIsland(seed) {
  $('loading').classList.remove('done'); setProgress(0);
  const quality = query.get('q') === 'low' ? 0.33 : touch ? 0.6 : 1;
  const made = await build(seed, { density: 420 * quality, cell: quality < 0.5 ? 0.24 : 0.16, onProgress: setProgress });
  clearIsland(); island = made; splatCount = made.count;
  for (const o of made.objects) {
    const root = new THREE.Group(); root.name = o.id; scene.add(root);
    const entry = { ...o, root, parts: [], state: 'whole', t: 0, wait: 0, home: new THREE.Vector3(...o.center) };
    for (const p of made.parts.filter(q => q.object === o.id)) {
      const group = new THREE.Group(); group.position.set(...p.pivot); root.add(group);
      const packed = new PackedSplats({ maxSplats: p.splats.count }), mesh = new SplatMesh({ packedSplats: packed });
      // mid: the object's middle in the part's own frame, where the strokes gather when the part comes back
      const mid = o.rig || o.cloud ? [0, 0, 0] : o.center.map((v, k) => v - p.pivot[k]);
      const part = { ...p, group, packed, mesh, mid }; writePart(part); group.add(mesh); entry.parts.push(part);
      if (p.shapes) group.add(skeleton(p.shapes));
      // the way each splat flies when the part breaks: out from the object's middle, along its own surface normal
      const sp = p.splats, fly = new Float32Array(sp.count * 4);
      for (let i = 0; i < sp.count; i++) { const r = Math.random; fly[i * 4] = sp.nrm[i * 3] + (r() - 0.5) * 1.2; fly[i * 4 + 1] = sp.nrm[i * 3 + 1] * 0.6 + 0.9 + r() * 0.8; fly[i * 4 + 2] = sp.nrm[i * 3 + 2] + (r() - 0.5) * 1.2; fly[i * 4 + 3] = r() * 0.35; }
      part.fly = fly;
    }
    objects.set(o.id, entry);
  }
  view.yaw = 0.7;   // the first view stands on the sun's side, so the island is lit (scene.js keeps the lighthouse to the back)
  objects.get('goat')?.root.scale.setScalar(GOAT_SIZE); goat.angle = 0; placeGoat(0); setProgress(1); $('loading').classList.add('done'); paintButtons();
}

/* ---------------- the shapes underneath ---------------- */
// The X-ray view: each distance shape as a wire, in the part's own frame. Cut shapes are red.
const wire = new THREE.LineBasicMaterial({ color: '#7ff6ff', transparent: true, opacity: 0.85, depthTest: false }), wireCut = new THREE.LineBasicMaterial({ color: '#ff5d6c', transparent: true, opacity: 0.9, depthTest: false });
// Each shape as a few clean lines: rings for round shapes, edges for a box. Dense wireframes turn to blobs in the pixel pass.
function ring(r, axis, y = 0, n = 32) { const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, c = Math.cos(a) * r, d = Math.sin(a) * r; pts.push(axis === 'y' ? new THREE.Vector3(c, y, d) : axis === 'x' ? new THREE.Vector3(y, c, d) : new THREE.Vector3(c, d, y)); } return pts; }
function geometryOf(s) {
  const [a, b, c] = s.size, segs = [];
  const loop = pts => { for (let i = 1; i < pts.length; i++) segs.push(pts[i - 1], pts[i]); }, line = (p, q) => segs.push(p, q);
  if (s.type === 'box') return new THREE.EdgesGeometry(new THREE.BoxGeometry(a * 2, b * 2, c * 2));
  if (s.type === 'sphere' || s.type === 'ellipsoid') { const [rx, ry, rz] = s.type === 'sphere' ? [a, a, a] : [a, b, c]; for (const ax of ['x', 'y', 'z']) loop(ring(1, ax).map(v => v.multiply(new THREE.Vector3(rx, ry, rz)))); }
  else if (s.type === 'capsule') { const h = a / 2, r = b; loop(ring(r, 'y', h)); loop(ring(r, 'y', -h)); for (const [x, z] of [[r, 0], [-r, 0], [0, r], [0, -r]]) line(new THREE.Vector3(x, -h, z), new THREE.Vector3(x, h, z)); for (const ax of ['x', 'z']) { const top = ring(r, ax).filter(v => v.y >= 0).map(v => v.clone().add(new THREE.Vector3(0, h, 0))), bot = ring(r, ax).filter(v => v.y <= 0).map(v => v.clone().add(new THREE.Vector3(0, -h, 0))); loop(top); loop(bot); } }
  else if (s.type === 'cylinder' || s.type === 'cone') { const h = a / 2, r1 = s.type === 'cone' ? b : b, r2 = s.type === 'cone' ? c : b; loop(ring(r1, 'y', -h)); loop(ring(r2, 'y', h)); for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; line(new THREE.Vector3(Math.cos(t) * r1, -h, Math.sin(t) * r1), new THREE.Vector3(Math.cos(t) * r2, h, Math.sin(t) * r2)); } }
  else if (s.type === 'torus') { loop(ring(a + b, 'y')); loop(ring(a - b, 'y')); }
  return new THREE.BufferGeometry().setFromPoints(segs);
}
function skeleton(shapes) {
  const g = new THREE.Group(); g.visible = look.xray; g.userData.xray = true;
  for (const s of shapes) { const line = new THREE.LineSegments(geometryOf(s), s.cut ? wireCut : wire); line.position.set(...(s.at || [0, 0, 0])); line.rotation.set(...(s.rot || [0, 0, 0]), 'ZYX'); line.renderOrder = 30; g.add(line); }
  return g;
}
function showShapes(on) { look.xray = on; scene.traverse(o => { if (o.userData.xray) o.visible = on; }); paintButtons(); }

/* ---------------- breaking and coming back ---------------- */
// A tap on a thing breaks it: its strokes fly apart and fade, the shapes underneath stay where they were, and after a
// moment the strokes pop back onto them. The island itself does not break.
const easeBack = t => { const k = 1.9; return 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2; };
function breakApart(id) { const o = objects.get(id); if (!o || o.fixed || o.state !== 'whole') return false; o.state = 'breaking'; o.t = 0; return true; }
function stepBreaking(dt) {
  for (const o of objects.values()) {
    if (o.state === 'whole') continue;
    if (o.state === 'breaking') {
      o.t = Math.min(1, o.t + dt / (reduced ? 0.01 : 0.9));
      for (const p of o.parts) writePart(p, (i, x, y, z) => { const f = p.fly, t = clamp((o.t - f[i * 4 + 3]) / (1 - f[i * 4 + 3]), 0, 1), d = t * 2.2; return [x + f[i * 4] * d, y + f[i * 4 + 1] * d - 2.4 * t * t, z + f[i * 4 + 2] * d, 1 - 0.5 * t, 1 - t]; });
      if (o.t >= 1) { o.state = 'gone'; o.wait = 1.1; for (const p of o.parts) p.mesh.visible = false; }
    } else if (o.state === 'gone') {
      o.wait -= dt; if (o.wait <= 0) { o.state = 'forming'; o.t = 0; for (const p of o.parts) p.mesh.visible = true; }
    } else if (o.state === 'forming') {
      o.t = Math.min(1, o.t + dt / (reduced ? 0.01 : 0.7));
      for (const p of o.parts) writePart(p, (i, x, y, z) => { const t = clamp((o.t - p.fly[i * 4 + 3] * 0.6) / (1 - p.fly[i * 4 + 3] * 0.6), 0, 1), k = easeBack(t), m = p.mid; return [m[0] + (x - m[0]) * k, m[1] + (y - m[1]) * k, m[2] + (z - m[2]) * k, Math.max(0, k), clamp(t * 1.6, 0, 1)]; });
      if (o.t >= 1) { o.state = 'whole'; for (const p of o.parts) writePart(p); }
    }
  }
}

/* ---------------- the goat ---------------- */
// The goat walks the dirt path round the island. Its legs swing in diagonal pairs, its head nods, its tail flicks,
// and now and then it stops to graze. Nothing in its strokes changes: each part turns about its joint.
const GOAT_SIZE = 1.6;   // the goat is painted life size; it is drawn larger so it reads from across the island
const goat = { angle: 0, speed: 0.32, graze: 0, next: 9, phase: 0 };
function placeGoat(dt) {
  const o = objects.get('goat'); if (!o || !island) return;
  const still = reduced || o.state !== 'whole'; goat.next -= still ? 0 : dt;
  if (goat.next <= 0 && goat.graze <= 0) { goat.graze = 3.2; goat.next = 9 + Math.random() * 6; }
  const walking = !still && goat.graze <= 0; if (goat.graze > 0) goat.graze -= dt;
  if (walking) { goat.angle += goat.speed * dt / ISLAND.path * 2.4; goat.phase += dt * 7.5; }
  const r = ISLAND.path, x = Math.cos(goat.angle) * r, z = Math.sin(goat.angle) * r, y = island.heightAt(x, z) + 0.47 * GOAT_SIZE;
  o.root.position.set(x, y + (walking ? Math.abs(Math.sin(goat.phase)) * 0.025 : 0), z); o.root.rotation.y = -(goat.angle + Math.PI / 2);
  for (const p of o.parts) {
    if (p.name.startsWith('goat-leg')) { const i = +p.name.slice(-1), pair = i === 0 || i === 3 ? 0 : Math.PI; p.group.rotation.z = walking ? Math.sin(goat.phase + pair) * 0.45 : 0; }
    else if (p.name === 'goat-head') p.group.rotation.z = goat.graze > 0 ? -0.95 + Math.sin(performance.now() / 260) * 0.08 : Math.sin(goat.phase * 0.5) * 0.08;
    else if (p.name === 'goat-tail') p.group.rotation.y = Math.sin(performance.now() / 120) * 0.5;
  }
  o.center = [x, y + 0.1 * GOAT_SIZE, z];
}

/* ---------------- camera ---------------- */
// Orbit round the island by dragging; the wheel or a pinch moves in and out. Left alone, the view turns slowly.
// Riding, the camera sits on the goat's back and looks the way it walks.
const view = { yaw: 0.6, pitch: 0.42, dist: 15, idle: 0, ride: 0 };
function placeCamera(dt) {
  if (!reduced && view.idle > 4 && !look.ride) view.yaw += dt * 0.06; view.idle += dt;
  view.ride += ((look.ride ? 1 : 0) - view.ride) * Math.min(1, dt * 3);
  const target = new THREE.Vector3(0, 0.5, 0), orbit = new THREE.Vector3(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch)).multiplyScalar(view.dist).add(target);
  const g = objects.get('goat');
  if (g && view.ride > 0.001) {
    const head = new THREE.Vector3(-0.25, 0.62, 0).applyMatrix4(g.root.matrixWorld), ahead = new THREE.Vector3(3, 0.45, 0).applyMatrix4(g.root.matrixWorld);
    camera.position.copy(orbit.lerp(head, view.ride)); camera.lookAt(target.lerp(ahead, view.ride));
  } else { camera.position.copy(orbit); camera.lookAt(target); }
}
let drag = null; const pinch = new Map();
canvas.addEventListener('pointerdown', e => { pinch.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, at: performance.now(), moved: 0 }; canvas.setPointerCapture?.(e.pointerId); view.idle = 0; });
canvas.addEventListener('pointermove', e => {
  if (pinch.has(e.pointerId)) { const before = [...pinch.values()]; const d0 = before.length === 2 ? Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y) : 0; pinch.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pinch.size === 2) { const now = [...pinch.values()], d1 = Math.hypot(now[0].x - now[1].x, now[0].y - now[1].y); if (d0 > 0) view.dist = clamp(view.dist * d0 / d1, 5, 30); if (drag) drag.moved = 99; return; } }
  if (!drag) { canvas.style.cursor = pickAt(e.clientX, e.clientY) ? 'pointer' : 'grab'; return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (!look.ride) { view.yaw -= dx * 0.006; view.pitch = clamp(view.pitch + dy * 0.004, 0.08, 1.35); } view.idle = 0;
});
const lift = e => { pinch.delete(e.pointerId); if (!drag) return; const tap = drag.moved < 8 && performance.now() - drag.at < 450, d = drag; drag = pinch.size ? drag : null; if (tap && e.type === 'pointerup') { const id = pickAt(d.sx, d.sy); if (id) breakApart(id); } };
canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift);
canvas.addEventListener('wheel', e => { e.preventDefault(); view.dist = clamp(view.dist * Math.exp(e.deltaY * 0.001), 5, 30); view.idle = 0; }, { passive: false });
// The thing under a point of the screen: the nearest object whose sphere the ray passes through.
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(x, y) {
  if (!island) return null; ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); let best = null, near = Infinity;
  for (const o of objects.values()) { if (o.fixed || o.state !== 'whole') continue; const c = new THREE.Vector3(...o.center), hit = ray.ray.distanceSqToPoint(c) < (o.radius * 0.8) ** 2; const d = c.distanceTo(ray.ray.origin); if (hit && d < near) { near = d; best = o.id; } }
  return best;
}

/* ---------------- controls ---------------- */
function paintButtons() {
  $('bPixel').setAttribute('aria-pressed', String(look.pixel)); $('bPalette').textContent = 'Palette: ' + look.palette[0].toUpperCase() + look.palette.slice(1); $('bPalette').disabled = !look.pixel;
  $('bShapes').setAttribute('aria-pressed', String(look.xray)); $('bRide').setAttribute('aria-pressed', String(look.ride)); $('goopValue').textContent = look.goop.toFixed(1) + '×';
}
$('bPixel').addEventListener('click', () => { look.pixel = !look.pixel; paintButtons(); });
$('bPalette').addEventListener('click', () => setPalette(PALETTE_NAMES[(PALETTE_NAMES.indexOf(look.palette) + 1) % PALETTE_NAMES.length]));
$('bShapes').addEventListener('click', () => showShapes(!look.xray));
$('bRide').addEventListener('click', () => { look.ride = !look.ride; view.idle = 0; paintButtons(); });
$('bNew').addEventListener('click', () => { seed += 1; makeIsland(seed); });
// Goop: the size of every stroke. Small strokes show the dots; large ones melt into each other.
let goopQueued = false;
$('goop').addEventListener('input', e => { look.goop = +e.target.value; paintButtons(); if (goopQueued) return; goopQueued = true; requestAnimationFrame(() => { goopQueued = false; for (const o of objects.values()) if (o.state === 'whole') for (const p of o.parts) writePart(p); }); });
addEventListener('keydown', e => {
  if (window.GameSwitch?.isOpen || e.target.closest?.('input')) return; const k = e.key.toLowerCase();
  if (k === 'p') $('bPixel').click(); else if (k === 'c') $('bPalette').click(); else if (k === 'x') $('bShapes').click(); else if (k === 'g') $('bRide').click(); else if (k === 'n') $('bNew').click();
  else if (k === 'arrowleft') view.yaw += 0.15; else if (k === 'arrowright') view.yaw -= 0.15; else if (k === 'arrowup') view.dist = clamp(view.dist * 0.9, 5, 30); else if (k === 'arrowdown') view.dist = clamp(view.dist * 1.1, 5, 30);
  else return; view.idle = 0;
});
const loadingBar = $('loadingBar');
function setProgress(p) { const pct = Math.round(p * 100); loadingBar.firstElementChild.style.width = pct + '%'; loadingBar.setAttribute('aria-valuenow', pct); $('loadLine').textContent = pct < 100 ? `Painting the island… ${pct}%` : 'Ready'; }

/* ---------------- the frame ---------------- */
let last = performance.now(), seed = +query.get('seed') || 1;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (island && !window.GameSwitch?.isOpen && !document.hidden) {
    stepBreaking(dt); placeGoat(dt);
    for (const o of objects.values()) { if (o.cloud && !reduced) o.root.rotation.y += dt * 0.02; if (o.id === 'island') { const sea = o.parts.find(p => p.name === 'sea'); if (sea && !reduced) sea.group.position.y = ISLAND.water + Math.sin(now / 900) * 0.025; } }
    scene.updateMatrixWorld(); placeCamera(dt);
  }
  if (look.pixel) { renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(post, postCam); }
  else renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
setPalette('dusk'); paintButtons(); requestAnimationFrame(tick);
makeIsland(seed).catch(error => { console.error(error); $('loadLine').textContent = 'The island did not paint.'; });

// A handle for the browser check (qa/lab/splat-isle.e2e.mjs). The page never reads it.
window.__splatIsle = {
  state: () => ({ ready: !!island && $('loading').classList.contains('done'), splats: splatCount, parts: [...objects.values()].reduce((n, o) => n + o.parts.length, 0), objects: [...objects.keys()], pixel: look.pixel, palette: look.palette, goop: look.goop, xray: look.xray, ride: look.ride, riding: +view.ride.toFixed(2),
    broken: [...objects.values()].filter(o => o.state !== 'whole').map(o => o.id + ':' + o.state), goat: (() => { const g = objects.get('goat'); return g ? { x: +g.root.position.x.toFixed(2), z: +g.root.position.z.toFixed(2), angle: +goat.angle.toFixed(3) } : null; })(), seed }),
  screen: id => { const o = objects.get(id); if (!o) return null; const v = new THREE.Vector3(...o.center).project(camera); return v.z > 1 ? null : { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  pick: (x, y) => pickAt(x, y),
};
