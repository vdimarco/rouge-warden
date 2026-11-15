// Riftwalk: the page. Four Gaussian splat worlds stand far apart in one scene. Spark draws them, and its SparkPortals
// class draws the world behind an open rift and moves the walker across. This file adds the game: wisps to catch, the
// rift that opens when all three are caught, the ring around it, the walk rules and the controls.
import * as THREE from 'three';
import { SplatMesh, SparkPortals } from '@sparkjsdev/spark';
import { WORLDS, EYE, SPACING, RIFT_RADIUS, WISPS, nextIndex, centre, outRift, inRift, wispPlace, walk, rayNear, rayThroughRift, clock } from './rules.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), hud = $('hud'), hint = $('hint'), pad = $('pad'), nub = $('nub'), loadLine = $('load'), startCard = $('start'), go = $('go'), endCard = $('end');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BEST = 'lab.riftwalk.best';

/* ---------------- the scene ---------------- */
let renderer;
// For the browser check: ?capture keeps the drawn frame readable, and ?px=0.5 sets the pixel ratio (software WebGL
// draws a splat world slowly).
const query = new URLSearchParams(location.search);
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: query.has('capture') }); if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2'); }
catch (e) { loadLine.textContent = 'Riftwalk needs WebGL2 graphics, and this browser has none to give.'; go.textContent = 'No 3D graphics'; throw e; }
renderer.setPixelRatio(+query.get('px') || Math.min(devicePixelRatio || 1, touch ? 1.25 : 1.5));
const scene = new THREE.Scene(), frame = new THREE.Group(), camera = new THREE.PerspectiveCamera(72, 1, 0.05, 700);
camera.rotation.order = 'YXZ'; camera.position.set(0, EYE, 0); frame.add(camera); scene.add(frame);
const portals = new SparkPortals({ renderer, scene, camera, localFrame: frame, defaultPortalRadius: RIFT_RADIUS });
const noRift = () => { portals.portalRenderer.uniforms.diskRadius.value = 0; };
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < h ? 86 : 72; camera.updateProjectionMatrix();
  portals.camera2.fov = camera.fov; portals.updateAspect(camera.aspect);
}
addEventListener('resize', resize); resize();

/* ---------------- the worlds ---------------- */
const meshes = WORLDS.map(() => null), loading = WORLDS.map(() => null);
function loadWorld(i, onProgress) {
  return loading[i] ||= (async () => {
    // ?worlds=lite loads 6,000-splat copies, which software WebGL can draw at a useful speed in the browser check.
    const response = await fetch('./worlds/' + (query.get('worlds') === 'lite' ? 'lite/' : '') + WORLDS[i].file); if (!response.ok) throw new Error('World file missing: ' + WORLDS[i].file);
    const total = +response.headers.get('content-length') || 0, reader = response.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; if (onProgress && total) onProgress(got / total); }
    const bytes = new Uint8Array(got); let at = 0; for (const p of parts) { bytes.set(p, at); at += p.length; }
    const mesh = new SplatMesh({ fileBytes: bytes }); await mesh.initialized;
    mesh.position.set(i * SPACING, 0, 0); mesh.visible = false; scene.add(mesh); meshes[i] = mesh; return mesh;
  })();
}

/* ---------------- wisps ---------------- */
// A wisp is one quad that always faces the eye: a white heart in a coloured halo. It draws after the splats and writes
// no depth.
const WISP_VERTEX = `uniform float uScale; varying vec2 vUv;
  void main() { vUv = uv * 2.0 - 1.0; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * uScale; gl_Position = projectionMatrix * mv; }`;
const WISP_FRAGMENT = `uniform vec3 uColor; uniform float uPulse; varying vec2 vUv;
  void main() { float r = length(vUv); float heart = exp(-r * r * 38.0), halo = exp(-r * r * 4.0) * (0.8 + 0.2 * uPulse) * smoothstep(1.0, 0.6, r);
    vec3 col = uColor * halo + vec3(1.0) * heart; gl_FragColor = vec4(col, max(halo, heart)); }`;
const wispQuad = new THREE.PlaneGeometry(1, 1);
const wisps = WORLDS.map((w, i) => w.wisps.map((_, k) => {
  const p = wispPlace(i, k), uniforms = { uColor: { value: new THREE.Color(w.wisp) }, uScale: { value: 0.95 }, uPulse: { value: 0 } };
  const g = new THREE.Mesh(wispQuad, new THREE.ShaderMaterial({ uniforms, vertexShader: WISP_VERTEX, fragmentShader: WISP_FRAGMENT, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  g.frustumCulled = false; g.renderOrder = 20; g.position.set(p.x, p.y, p.z); g.visible = false; scene.add(g);
  return { group: g, uniforms, home: new THREE.Vector3(p.x, p.y, p.z), caught: false, fly: 0, phase: k * 2.1 + i };
}));

/* ---------------- the rift ring ---------------- */
// A soft band of light on the disc's edge and motes that circle it. The band hides the hard cut of the disc.
const RING_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FRAGMENT = `
  varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uOpen;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
    vec2 c = vec2(cos(a), sin(a));                              // the angle as a point on a circle: no seam where it wraps
    float n = noise(c * 2.6 + vec2(uTime * 0.5, r * 5.0 - uTime * 0.6)) * 0.5 + noise(c * 6.0 - vec2(r * 9.0, uTime * 0.8)) * 0.5;
    float edge = 0.70 + (n - 0.5) * 0.10;                       // the disc edge, in this quad's units
    float band = 0.8 * exp(-pow((r - edge) / 0.032, 2.0)) + 0.4 * exp(-pow((r - edge - 0.05) / 0.12, 2.0)) * n;
    vec3 col = mix(uColor, vec3(1.0), 0.45 * exp(-pow((r - edge) / 0.014, 2.0)));
    gl_FragColor = vec4(col * band * uOpen, band * uOpen);
  }`;
const MOTE_VERTEX = `
  attribute vec4 aSeed; uniform float uTime; uniform float uOpen; uniform float uSize; varying float vFade;
  void main() {
    float turn = aSeed.x + uTime * aSeed.y, drift = fract(aSeed.z + uTime * 0.11 * aSeed.w);
    float r = (1.0 + drift * 0.55) * uOpen; vec3 p = vec3(cos(turn) * r, sin(turn) * r, (aSeed.w - 0.5) * 0.5 * drift);
    vFade = (1.0 - drift) * smoothstep(0.0, 0.12, drift);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * (0.5 + aSeed.w) / max(0.2, -mv.z);
  }`;
const MOTE_FRAGMENT = `varying float vFade; uniform vec3 uColor; uniform float uOpen;
  void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vFade * uOpen; gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.4) * a, a); }`;
function makeRing() {
  const group = new THREE.Group(), uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#fff') }, uOpen: { value: 0 }, uSize: { value: 60 } };
  const band = new THREE.Mesh(new THREE.PlaneGeometry(2 / 0.70 * RIFT_RADIUS, 2 / 0.70 * RIFT_RADIUS), new THREE.ShaderMaterial({ uniforms, vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const count = reduced ? 0 : 260, seeds = new Float32Array(count * 4), geometry = new THREE.BufferGeometry();
  let s = 7; const random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < count; i++) seeds.set([random() * 6.283, (random() < 0.5 ? -1 : 1) * (0.25 + random() * 0.7), random(), random()], i * 4);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const motes = new THREE.Points(geometry, new THREE.ShaderMaterial({ uniforms, vertexShader: MOTE_VERTEX, fragmentShader: MOTE_FRAGMENT, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false; band.renderOrder = 18; motes.renderOrder = 19; group.add(band, motes); group.visible = false; scene.add(group);
  return { group, uniforms };
}
const ringOut = makeRing(), ringIn = makeRing();
const placeAt = (object, rift) => { object.position.set(rift.x, rift.y, rift.z); object.rotation.set(0, rift.yaw, 0); object.updateMatrixWorld(true); };

/* ---------------- the game ---------------- */
// phase: title, play, end. rift: shut, opening, open, closing (the walker is across and the rift shrinks behind).
const game = { phase: 'title', index: 0, caught: 0, jumps: 0, time: 0, rift: 'shut', open: 0, pair: null, from: 0, glide: null, yaw: 0, pitch: 0, waiting: false };
const here = () => WORLDS[game.index];
function showWorlds() {
  const next = nextIndex(game.index);
  meshes.forEach((m, i) => { if (m) m.visible = i === game.index || (game.pair && (i === next || i === game.from)); });
  wisps.forEach((list, i) => list.forEach(w => { w.group.visible = game.phase !== 'title' && !w.caught && (i === game.index || (game.pair && i === next && game.rift !== 'closing')); }));
}
function enterWorld(i, fresh) {
  game.index = i; game.caught = 0;
  wisps[i].forEach(w => { w.caught = false; w.fly = 0; w.group.position.copy(w.home); });
  if (fresh) { const c = centre(i); frame.position.set(c.x, 0, c.z); frame.quaternion.identity(); game.yaw = Math.PI * 0.5; game.pitch = 0; }
  loadWorld(nextIndex(i)).catch(() => {});
  paint(); showWorlds();
}
function openRift() {
  const next = nextIndex(game.index);
  if (!meshes[next]) { game.waiting = true; loadWorld(next).then(() => { if (game.waiting && game.rift === 'shut' && game.caught >= WISPS) { game.waiting = false; openRift(); } }); say('The next world is still loading.'); return; }
  game.waiting = false; game.rift = 'opening'; game.open = reduced ? 1 : 0.02; game.from = game.index;
  const pair = portals.addPortalPair({ radius: RIFT_RADIUS * game.open, onCross: crossed });
  placeAt(pair.entryPortal, outRift(game.index)); placeAt(pair.exitPortal, inRift(next)); game.pair = pair;
  placeAt(ringOut.group, outRift(game.index)); placeAt(ringIn.group, inRift(next));
  ringOut.uniforms.uColor.value.set(WORLDS[next].tint); ringIn.uniforms.uColor.value.set(WORLDS[next].tint);
  ringOut.group.visible = ringIn.group.visible = true; showWorlds();
}
function crossed(pair, fromEntry) {
  if (!fromEntry) { game.index = game.from; game.rift = 'open'; paint(); showWorlds(); return; }     // the walker stepped back
  game.jumps++; game.index = nextIndex(game.from); game.rift = 'closing'; game.caught = 0;
  wisps[game.index].forEach(w => { w.caught = false; w.fly = 0; w.group.position.copy(w.home); });
  paint(); showWorlds();
}
function closeRift() {
  portals.removePortalPair(game.pair); game.pair = null; game.rift = 'shut'; game.open = 0; noRift();
  ringOut.group.visible = ringIn.group.visible = false; showWorlds();
  if (game.jumps >= WORLDS.length) finish(); else loadWorld(nextIndex(game.index)).catch(() => {});
}
function finish() {
  game.phase = 'end'; game.glide = null; hud.hidden = hint.hidden = pad.hidden = true;
  let best = null; try { best = +localStorage.getItem(BEST) || null; } catch (e) { /* storage off */ }
  const record = best === null || game.time < best; if (record) { best = game.time; try { localStorage.setItem(BEST, String(Math.round(game.time * 10) / 10)); } catch (e) { /* storage off */ } }
  $('endLine').textContent = record ? 'Four worlds and back to the fire. That is your best walk.' : 'Four worlds and back to the fire.';
  $('endTime').textContent = clock(game.time); $('endBest').textContent = clock(best); endCard.hidden = false; $('again').focus({ preventScroll: true });
}
function start() {
  if (game.pair) { portals.removePortalPair(game.pair); game.pair = null; noRift(); ringOut.group.visible = ringIn.group.visible = false; }
  Object.assign(game, { phase: 'play', jumps: 0, time: 0, rift: 'shut', open: 0, glide: null, waiting: false });
  startCard.hidden = endCard.hidden = true; hud.hidden = false; pad.hidden = !touch; enterWorld(0, true);
}
function say(text) { hint.textContent = text; hint.hidden = !text; }
function paint() {
  $('hWorld').textContent = here().name; $('hWisps').innerHTML = `Wisps <b>${Math.min(WISPS, game.caught)}</b> of ${WISPS}`; $('hTime').textContent = clock(game.time);
  if (game.phase !== 'play') return;
  if (game.rift === 'open' || game.rift === 'opening') say(touch ? 'The rift is open. Tap it, or walk in.' : 'The rift is open. Click it, press Space, or walk in.');
  else if (game.rift === 'closing') say('');
  else if (game.waiting) say('The next world is still loading.');
  else say(game.jumps === 0 && game.caught === 0 ? (touch ? 'Drag to look around. Tap a wisp to catch it.' : 'Drag to look around. Click a wisp to catch it.') : `Find the wisps: ${WISPS - game.caught} left.`);
}
function catchWisp(w) {
  if (w.caught) return; w.caught = true; w.fly = 0.001; game.caught++;
  if (game.caught >= WISPS && game.rift === 'shut') openRift();
  paint();
}

/* ---------------- looking and walking ---------------- */
const forward = new THREE.Vector3(), eye = new THREE.Vector3(), scratch = new THREE.Vector3(), ndc = new THREE.Vector3();
const local = () => { camera.getWorldPosition(eye); const c = centre(game.index); return { x: eye.x - c.x, z: eye.z - c.z }; };
function lookRay(clientX, clientY) {
  camera.getWorldPosition(eye);
  if (clientX === undefined) camera.getWorldDirection(forward);
  else { ndc.set(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1, 0.5).unproject(camera); forward.copy(ndc).sub(eye).normalize(); }
  return { origin: { x: eye.x, y: eye.y, z: eye.z }, dir: { x: forward.x, y: forward.y, z: forward.z } };
}
// A tap, a click or Space: catch the wisp on the ray, or go through the open rift on it.
function act(clientX, clientY) {
  if (game.phase !== 'play' || game.glide) return false;
  const ray = lookRay(clientX, clientY), reach = clientX === undefined ? 0.6 : 0.34; let best = null;
  for (const w of wisps[game.index]) { if (w.caught) continue; const hit = rayNear(ray.origin, ray.dir, w.group.position, reach); if (hit && (!best || hit.miss < best.hit.miss)) best = { w, hit }; }
  if (best) { catchWisp(best.w); return true; }
  if (game.rift === 'open' && (clientX === undefined || rayThroughRift(ray.origin, ray.dir, outRift(game.index)))) { game.glide = { stage: 'approach' }; say(''); return true; }
  return false;
}
// game.yaw is a compass heading inside the frame: 0 looks along -z and a quarter turn looks along +x. A rift crossing
// turns the frame about y by frameYaw(), so the heading in the scene is game.yaw - frameYaw().
const frameYaw = () => { scratch.set(0, 0, -1).applyQuaternion(frame.quaternion); return Math.atan2(-scratch.x, -scratch.z); };
function moveBy(dx, dz) {
  const from = local(), to = walk(here(), from, { x: from.x + dx, z: from.z + dz }, game.rift === 'open' || game.rift === 'opening');
  frame.position.x += to.x - from.x; frame.position.z += to.z - from.z;
}
const keys = new Set(), stick = { x: 0, y: 0, id: null };
function step(dt) {
  if (game.phase !== 'play') return;
  game.time += dt;
  // The rift grows open, or shrinks shut behind the walker.
  if (game.rift === 'opening') { game.open = Math.min(1, game.open + dt / 1.1); if (game.open >= 1) { game.rift = 'open'; } }
  if (game.rift === 'closing' && !game.glide) { game.open = reduced ? 0 : Math.max(0, game.open - dt / 0.7); if (game.open <= 0.02) closeRift(); }
  if (game.pair) { game.pair.radius = RIFT_RADIUS * Math.max(0.02, game.open); ringOut.uniforms.uOpen.value = game.open; }
  // Wisps bob in place. A caught wisp flies to where the rift opens.
  const target = outRift(game.index);
  for (const w of wisps[game.index]) {
    if (!w.caught) { w.uniforms.uScale.value = 0.95; if (!reduced) { w.group.position.y = w.home.y + Math.sin(game.time * 1.6 + w.phase) * 0.07; w.uniforms.uPulse.value = Math.sin(game.time * 3.1 + w.phase); } continue; }
    if (w.fly <= 0) continue;
    w.fly = Math.min(1, w.fly + dt / (reduced ? 0.01 : 0.7)); const k = w.fly * w.fly * (3 - 2 * w.fly);
    w.group.position.lerpVectors(w.home, scratch.set(target.x, target.y, target.z), k); w.uniforms.uScale.value = 0.95 * (1 - k * 0.7); w.group.visible = w.fly < 1; if (w.fly >= 1) w.fly = 0;
  }
  if (game.glide) return glide(dt);
  // Keys and the pad walk the frame along the look direction.
  const turn = (keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0); game.yaw += turn * dt * 1.9;
  let ahead = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - stick.y, side = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0) + stick.x;
  const length = Math.hypot(ahead, side); if (length > 1) { ahead /= length; side /= length; }
  if (length > 0.01) { const a = game.yaw - frameYaw(), speed = 1.5 * dt; moveBy((Math.sin(a) * ahead + Math.cos(a) * side) * speed, (-Math.cos(a) * ahead + Math.sin(a) * side) * speed); }
}
// Going through the rift without the keys: walk to a point in front of it, cross it, then walk on to the new centre.
function glide(dt) {
  const g = game.glide, speed = reduced ? 1e3 : 2.3, limit = speed * dt; camera.getWorldPosition(eye);
  const toward = (x, z) => { const dx = x - eye.x, dz = z - eye.z, d = Math.hypot(dx, dz), k = d > limit ? limit / d : 1; frame.position.x += dx * k; frame.position.z += dz * k; face(dx, dz, dt); return d <= limit + 1e-6; };
  if (g.stage === 'approach') { const r = outRift(game.from = game.index); if (toward(r.x - r.away.x * 0.7, r.z - r.away.z * 0.7)) g.stage = 'through'; }
  else if (g.stage === 'through') {
    if (game.rift === 'closing') { g.stage = 'settle'; return; }
    const r = outRift(game.index), d = Math.min(limit, 0.9); frame.position.x += r.away.x * d; frame.position.z += r.away.z * d; face(r.away.x, r.away.z, dt);
  } else { const c = centre(game.index), r = inRift(game.index), rest = Math.min(here().walk * 0.6, 0.9); if (toward(c.x + r.away.x * rest, c.z + r.away.z * rest)) { game.glide = null; paint(); } }
}
// Turn the view toward a walking direction given in scene space.
function face(dx, dz, dt) {
  if (Math.hypot(dx, dz) < 1e-4) return;
  let want = Math.atan2(dx, -dz) + frameYaw() - game.yaw; want = Math.atan2(Math.sin(want), Math.cos(want));
  const k = reduced ? 1 : Math.min(1, dt * 5); game.yaw += want * k; game.pitch += (0 - game.pitch) * k;
}

/* ---------------- input ---------------- */
let drag = null;
canvas.addEventListener('pointerdown', e => { if (game.phase !== 'play') return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, at: performance.now(), moved: 0 }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('look'); });
canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (game.glide) return;
  // The view follows the finger: a drag to the right turns the walker to the left, and a drag down looks up.
  const k = (camera.fov * Math.PI / 180) / innerHeight * 1.15; game.yaw -= dx * k; game.pitch = clamp(game.pitch + dy * k, -1.2, 1.2);
});
const lift = e => { if (!drag || e.pointerId !== drag.id) return; const tap = drag.moved < 10 && performance.now() - drag.at < 500; canvas.classList.remove('look'); const d = drag; drag = null; if (tap && e.type === 'pointerup') act(d.sx, d.sy); };
canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift);
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (game.phase === 'play' && (k === ' ' || k === 'enter')) { e.preventDefault(); if (!e.repeat) act(); return; }
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { if (game.phase === 'play') e.preventDefault(); keys.add(k); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); stick.x = stick.y = 0; });
function padMove(e) { const r = pad.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1, l = Math.max(1, Math.hypot(x, y)); stick.x = x / l; stick.y = y / l; nub.style.transform = `translate(${stick.x * 34}px, ${stick.y * 34}px)`; }
pad.addEventListener('pointerdown', e => { stick.id = e.pointerId; pad.setPointerCapture(e.pointerId); padMove(e); });
pad.addEventListener('pointermove', e => { if (e.pointerId === stick.id) padMove(e); });
const padUp = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; nub.style.transform = ''; };
pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp);
go.addEventListener('click', start); $('again').addEventListener('click', start);

/* ---------------- the loop ---------------- */
let last = performance.now(), painted = -1, titleTurn = 0;
function tick(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  // The Games menu of the arcade holds the walk, and so does a hidden tab.
  if (!window.GameSwitch?.isOpen && !document.hidden) step(dt);
  if (game.phase === 'title' && !reduced) { titleTurn += dt * 0.06; game.yaw = Math.PI * 0.5 + titleTurn; }
  camera.rotation.set(game.pitch, -game.yaw, 0);
  ringOut.uniforms.uTime.value = ringIn.uniforms.uTime.value = reduced ? 0 : now / 1000; ringIn.uniforms.uOpen.value = game.open;
  ringOut.uniforms.uSize.value = ringIn.uniforms.uSize.value = innerHeight * 0.022 * renderer.getPixelRatio();
  if (!game.pair) noRift();
  portals.animateLoopHook();
  const second = Math.floor(game.time); if (second !== painted && game.phase === 'play') { painted = second; $('hTime').textContent = clock(game.time); }
  requestAnimationFrame(tick);
}

/* ---------------- start up ---------------- */
// The first world and the one behind its rift load before Start. The other two load while the walker plays.
loadWorld(0, p => { loadLine.textContent = `Loading the first world… ${Math.round(p * 100)}%`; }).then(() => {
  const c = centre(0); frame.position.set(c.x, 0, c.z); game.yaw = Math.PI * 0.5; showWorlds();
  loadLine.hidden = true; go.disabled = false; go.textContent = 'Start walking'; go.focus({ preventScroll: true });
  loadWorld(1).then(() => loadWorld(2)).then(() => loadWorld(3)).catch(() => {});
}).catch(error => { loadLine.textContent = 'A world did not load. Check the connection and load the page again.'; console.error(error); });
requestAnimationFrame(tick);

// A handle for the browser check (qa/lab/riftwalk.e2e.mjs). The game never reads it.
window.__riftwalk = {
  state: () => ({ phase: game.phase, world: here().id, caught: game.caught, jumps: game.jumps, rift: game.rift, open: game.open, gliding: !!game.glide, time: game.time, loaded: meshes.map(m => !!m), place: local(), visible: meshes.map(m => !!m?.visible) }),
  wispScreen: k => { const w = wisps[game.index][k]; if (!w || w.caught) return null; ndc.copy(w.group.position).project(camera); return ndc.z > 1 ? null : { x: (ndc.x + 1) / 2 * innerWidth, y: (1 - ndc.y) / 2 * innerHeight }; },
  lookAt: (x, y, z) => { camera.getWorldPosition(eye); const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z; game.yaw = Math.atan2(dx, -dz) + frameYaw(); game.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
  wisp: k => { const p = wisps[game.index][k].group.position; return { x: p.x, y: p.y, z: p.z, caught: wisps[game.index][k].caught }; },
  rift: () => outRift(game.index),
  // Catch every wisp and open the rift at once, with no wait.
  openNow: () => { for (const w of wisps[game.index]) if (!w.caught) catchWisp(w); if (game.rift === 'opening') { game.open = 1; game.rift = 'open'; } for (const w of wisps[game.index]) { w.fly = 0; w.group.visible = false; } paint(); },
  stand: (x, z) => { const c = centre(game.index); frame.position.x = c.x + x; frame.position.z = c.z + z; },
};
