// Riftwalk: the page. One Gaussian splat world, a neon arcade hall made with Marble by World Labs, is drawn by Spark.
// A ring of portals stands around the visitor. The first ring has one portal for each collection of the arcade; a
// collection's portal opens a ring of its games; a game's portal launches the game. hall.js holds the rules.
import * as THREE from 'three';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import { EYE, GROUPS, SELF, hallPortals, groupPortals, groupArt, ring, pick, facing, neighbour, walk } from './hall.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), loadLine = $('load'), startCard = $('start'), go = $('go'), target = $('target'), keysBar = $('keys'), where = $('where'), flash = $('flash'), list = $('list');
const query = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// The arcade's own list of games (switch.js). The page still works as a list of links if that script is missing.
const GAMES = (window.GameSwitch && window.GameSwitch.GAMES) || [];

/* ---------------- every game as a link ---------------- */
// Screen readers get this list always. Everyone gets it when 3D graphics cannot start.
for (const g of GROUPS) {
  const games = groupPortals(g.id, GAMES).filter(p => p.kind === 'game'); if (!games.length) continue;
  const h = document.createElement('h2'); h.textContent = g.label; const ul = document.createElement('ul');
  for (const p of games) { const li = document.createElement('li'), a = document.createElement('a'); a.href = p.url; a.textContent = p.sub ? `${p.title}: ${p.sub}` : p.title; li.append(a); ul.append(li); }
  list.append(h, ul);
}
function noGraphics(why) { startCard.hidden = true; loadLine.hidden = true; list.classList.add('shown'); const p = document.createElement('p'); p.textContent = why + ' Here is every game as a link.'; list.prepend(p); }

/* ---------------- the scene ---------------- */
// For the browser check: ?capture keeps the drawn frame readable, ?px=1 sets the pixel ratio, ?world=none draws the
// portals with no hall (software WebGL draws a splat world at a frame in seconds), and ?q=150k, 500k or full picks a
// hall file.
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: query.has('capture') }); if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2'); }
catch (e) { noGraphics('Riftwalk needs WebGL2 graphics, and this browser has none to give.'); throw e; }
renderer.setPixelRatio(+query.get('px') || Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor('#0a0612');
const scene = new THREE.Scene(), frame = new THREE.Group(), camera = new THREE.PerspectiveCamera(72, 1, 0.05, 300);
camera.rotation.order = 'YXZ'; camera.position.set(0, EYE, 0); frame.add(camera); scene.add(frame);
scene.add(new SparkRenderer({ renderer }));
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 88 : 72; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ---------------- the hall ---------------- */
// Marble's own numbers for this world (assets.splats.semantics_metadata): the metres in one file unit, and the height
// of the capture point over the floor. A Marble .spz has y down, so the mesh turns half a turn about x.
const HALL = { scale: 2.2473989, ground: 1.349822 };
let hall = null;
async function loadHall(file, onProgress) {
  const response = await fetch('./worlds/' + file); if (!response.ok) throw new Error('Hall file missing: ' + file);
  const total = +response.headers.get('content-length') || 0, reader = response.body.getReader(), parts = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; if (onProgress && total) onProgress(got / total); }
  const bytes = new Uint8Array(got); let at = 0; for (const p of parts) { bytes.set(p, at); at += p.length; }
  const mesh = new SplatMesh({ fileBytes: bytes }); await mesh.initialized;
  mesh.quaternion.set(1, 0, 0, 0); mesh.scale.setScalar(HALL.scale); mesh.position.set(0, HALL.ground, 0);
  if (hall) { scene.remove(hall); hall.dispose?.(); }
  hall = mesh; scene.add(mesh); return mesh;
}

/* ---------------- portals ---------------- */
// A portal is three flat parts that front the centre: a disc with a picture, a band of light on its rim with motes
// that circle it, and a name over it. All draw after the splats and write no depth.
const DISC_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISC_FRAGMENT = `
  varying vec2 vUv; uniform sampler2D uMap; uniform float uHasMap; uniform float uAspect; uniform vec3 uColor; uniform float uOpen; uniform float uTime; uniform float uHot;
  void main() {
    vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
    // The picture covers the disc: the longer side of the picture is cropped.
    vec2 uv = p * 0.5; if (uAspect > 1.0) uv.x /= uAspect; else uv.y *= uAspect; uv += 0.5;
    // A slow swirl near the rim, so the picture reads as something behind an opening.
    float a = atan(p.y, p.x), pull = smoothstep(0.55, 1.0, r); uv += vec2(cos(a + uTime * 0.6), sin(a + uTime * 0.6)) * pull * 0.018;
    vec3 art = mix(uColor * (0.25 + 0.35 * (1.0 - r)), texture2D(uMap, uv).rgb, uHasMap);
    art *= 0.82 + 0.18 * uHot; art = mix(art, uColor, pull * 0.35);
    gl_FragColor = vec4(art, uOpen * smoothstep(1.0, 0.97, r));
  }`;
const BAND_FRAGMENT = `
  varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uOpen; uniform float uHot;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x); vec2 c = vec2(cos(a), sin(a));   // the angle as a point on a circle: no seam
    float n = noise(c * 2.6 + vec2(uTime * 0.5, r * 5.0 - uTime * 0.6)) * 0.5 + noise(c * 6.0 - vec2(r * 9.0, uTime * 0.8)) * 0.5;
    float edge = 0.70 + (n - 0.5) * 0.05;
    float band = (0.75 + 0.5 * uHot) * exp(-pow((r - edge) / 0.028, 2.0)) + 0.35 * exp(-pow((r - edge - 0.05) / 0.12, 2.0)) * n;
    vec3 col = mix(uColor, vec3(1.0), 0.45 * exp(-pow((r - edge) / 0.012, 2.0)));
    gl_FragColor = vec4(col * band * uOpen, band * uOpen);
  }`;
const MOTE_VERTEX = `
  attribute vec4 aSeed; uniform float uTime; uniform float uOpen; uniform float uSize; varying float vFade;
  void main() {
    float turn = aSeed.x + uTime * aSeed.y, drift = fract(aSeed.z + uTime * 0.11 * aSeed.w);
    float r = (1.0 + drift * 0.45) * uOpen; vec3 p = vec3(cos(turn) * r, sin(turn) * r, (aSeed.w - 0.5) * 0.4 * drift);
    vFade = (1.0 - drift) * smoothstep(0.0, 0.12, drift);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * (0.5 + aSeed.w) / max(0.2, -mv.z);
  }`;
const MOTE_FRAGMENT = `varying float vFade; uniform vec3 uColor; uniform float uOpen;
  void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vFade * uOpen; gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.4) * a, a); }`;
const discGeometry = new THREE.PlaneGeometry(2, 2), bandGeometry = new THREE.PlaneGeometry(2 / 0.70, 2 / 0.70), labelGeometry = new THREE.PlaneGeometry(1, 1);
const moteGeometry = (() => {
  const count = 90, seeds = new Float32Array(count * 4), g = new THREE.BufferGeometry(); let s = 7; const random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < count; i++) seeds.set([random() * 6.283, (random() < 0.5 ? -1 : 1) * (0.25 + random() * 0.7), random(), random()], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4)); return g;
})();
const textures = new Map(), loader = new THREE.TextureLoader();
function artTexture(url, uniforms) {
  if (!url) return;
  let entry = textures.get(url);
  if (!entry) { entry = { texture: null, waiting: [] }; textures.set(url, entry); loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; entry.texture = t; for (const u of entry.waiting) apply(u, t); entry.waiting.length = 0; }, undefined, () => { /* a missing picture leaves the portal's own colour */ }); }
  if (entry.texture) apply(uniforms, entry.texture); else entry.waiting.push(uniforms);
  function apply(u, t) { u.uMap.value = t; u.uHasMap.value = 1; u.uAspect.value = (t.image.width || 1) / (t.image.height || 1); }
}
// The back portal's picture, and every name, are drawn on a canvas.
function backTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#0a0612'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#e8f6ff'; g.lineWidth = 16; g.lineCap = g.lineJoin = 'round';
  g.beginPath(); g.moveTo(150, 70); g.lineTo(92, 128); g.lineTo(150, 186); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const backArt = backTexture();
function labelTexture(title, sub, color) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 192; const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 76; g.font = `700 ${size}px Georgia, "Times New Roman", serif`; while (size > 34 && g.measureText(title).width > 730) { size -= 4; g.font = `700 ${size}px Georgia, "Times New Roman", serif`; }
  g.shadowColor = color; g.shadowBlur = 22; g.fillStyle = '#ffffff'; g.fillText(title, 384, sub ? 74 : 96); g.shadowBlur = 0;
  if (sub) { g.font = '600 40px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; g.fillStyle = color; g.fillText(sub, 384, 146, 740); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const flat = { transparent: true, depthWrite: false, depthTest: false };
function makePortal(item, place) {
  const group = new THREE.Group(), color = new THREE.Color(item.color || '#5ff2ff');
  const uniforms = { uMap: { value: null }, uHasMap: { value: 0 }, uAspect: { value: 1 }, uColor: { value: color }, uOpen: { value: 0 }, uTime: { value: 0 }, uHot: { value: 0 }, uSize: { value: 40 } };
  const disc = new THREE.Mesh(discGeometry, new THREE.ShaderMaterial({ uniforms, vertexShader: DISC_VERTEX, fragmentShader: DISC_FRAGMENT, ...flat }));
  const band = new THREE.Mesh(bandGeometry, new THREE.ShaderMaterial({ uniforms, vertexShader: DISC_VERTEX, fragmentShader: BAND_FRAGMENT, ...flat, blending: THREE.AdditiveBlending }));
  disc.renderOrder = 16; band.renderOrder = 18; group.add(disc, band);
  if (!reduced) { const motes = new THREE.Points(moteGeometry, new THREE.ShaderMaterial({ uniforms, vertexShader: MOTE_VERTEX, fragmentShader: MOTE_FRAGMENT, ...flat, blending: THREE.AdditiveBlending })); motes.frustumCulled = false; motes.renderOrder = 19; group.add(motes); }
  const count = item.kind === 'group' ? `${item.count} ${item.count === 1 ? 'game' : 'games'}` : '';
  const map = labelTexture(item.title, count, '#' + color.getHexString());
  const label = new THREE.Mesh(labelGeometry, new THREE.MeshBasicMaterial({ map, ...flat })); label.renderOrder = 20;
  // A name is no wider than the room between two portals, so names in a full ring do not run into each other.
  const width = place.radius * 2.3; label.scale.set(width, width / 4, 1); label.position.set(0, 1 + (width / 8 + 0.05) / place.radius, 0); label.scale.divideScalar(place.radius); group.add(label);
  group.position.set(place.x, place.y, place.z); group.rotation.set(0, place.yaw, 0); group.scale.setScalar(place.radius); group.frustumCulled = false; scene.add(group);
  if (item.kind === 'back') { uniforms.uMap.value = backArt; uniforms.uHasMap.value = 1; }
  else artTexture(item.kind === 'group' ? groupArt(item.id, GAMES) : item.art, uniforms);
  return { item, place, group, uniforms, label, map };
}
function dropPortal(p) { scene.remove(p.group); p.map.dispose(); p.group.traverse(o => { if (o.material) o.material.dispose(); }); }

/* ---------------- the visit ---------------- */
// phase: title, hall, launch. ring: null for the collections, or the id of the open collection.
const visit = { phase: 'title', ringId: null, portals: [], leaving: [], open: 0, yaw: 0, pitch: 0, turnTo: null, aim: -1, glide: null, time: 0 };
const places = () => visit.portals.map(p => p.place);
function showRing(groupId, lookAt) {
  for (const p of visit.portals) visit.leaving.push(p);
  const items = groupId ? groupPortals(groupId, GAMES) : hallPortals();
  // The new ring starts where the visitor looks, so the first portal is in front of them.
  const first = lookAt ?? visit.yaw, spots = ring(items.length, first);
  visit.portals = items.map((item, i) => makePortal(item, spots[i])); visit.ringId = groupId; visit.open = reduced ? 1 : 0; visit.aim = -1;
  const group = GROUPS.find(g => g.id === groupId); where.textContent = group ? `Neon hall · ${group.label}` : 'Neon hall · Collections'; $('kBack').hidden = !groupId;
  paint();
}
function enter(index) {
  const p = visit.portals[index]; if (!p || visit.phase !== 'hall' || visit.glide) return;
  if (p.item.kind === 'group') showRing(p.item.id, p.place.heading);
  else if (p.item.kind === 'back') showRing(null, p.place.heading);
  else launch(p);
}
function back() { if (visit.phase === 'hall' && visit.ringId && !visit.glide) showRing(null, visit.yaw); }
// Going into a game: the visitor glides to the portal while the view fills with its light, then the game's page opens.
function launch(p) {
  visit.phase = 'launch'; visit.glide = { portal: p, t: 0 }; target.hidden = keysBar.hidden = true; flash.style.setProperty('--tint', '#' + p.uniforms.uColor.value.getHexString());
  const leave = () => { location.assign(p.item.url); };
  if (reduced) { flash.classList.add('on'); leave(); return; }
  setTimeout(() => flash.classList.add('on'), 260); setTimeout(leave, 760);
}
// A page kept in the back-forward cache comes back mid-launch: put the visitor back in the hall.
addEventListener('pageshow', e => { if (!e.persisted || visit.phase !== 'launch') return; flash.classList.remove('on'); frame.position.set(0, 0, 0); visit.glide = null; visit.phase = 'hall'; keysBar.hidden = false; paint(); });
function start() { visit.phase = 'hall'; startCard.hidden = true; keysBar.hidden = false; where.hidden = false; visit.yaw = 0; visit.pitch = 0; showRing(null, 0); }
function paint() {
  const p = visit.portals[visit.aim];
  if (visit.phase !== 'hall' || !p) { target.hidden = true; $('kGo').disabled = true; canvas.classList.remove('aim'); return; }
  target.hidden = false; $('kGo').disabled = false; target.style.setProperty('--tint', '#' + p.uniforms.uColor.value.getHexString());
  $('tTitle').textContent = p.item.title;
  $('tSub').textContent = p.item.kind === 'group' ? `${p.item.count} ${p.item.count === 1 ? 'game' : 'games'}` : p.item.kind === 'back' ? 'Back to the six collections' : p.item.sub;
  $('tSub').hidden = !$('tSub').textContent;
  const verb = p.item.kind === 'game' ? 'play' : p.item.kind === 'back' ? 'go back' : 'open';
  $('tDo').textContent = touch ? `Tap the portal to ${verb}` : `Click the portal or press Enter to ${verb}`;
  $('kGo').textContent = p.item.kind === 'game' ? 'Play' : p.item.kind === 'back' ? 'Back' : 'Open';
}

/* ---------------- looking and walking ---------------- */
// visit.yaw is a compass heading: 0 looks along -z and a quarter turn looks along +x.
const eye = new THREE.Vector3(), dir = new THREE.Vector3(), ndc = new THREE.Vector3();
function lookRay(clientX, clientY) {
  camera.updateMatrixWorld(true); camera.getWorldPosition(eye);
  ndc.set(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1, 0.5).unproject(camera); dir.copy(ndc).sub(eye).normalize();
  return [{ x: eye.x, y: eye.y, z: eye.z }, { x: dir.x, y: dir.y, z: dir.z }];
}
const portalAt = (x, y) => visit.phase === 'hall' && visit.open > 0.6 ? pick(...lookRay(x, y), places(), touch ? 1.25 : 1.1) : -1;
function turn(step) { if (visit.phase !== 'hall' || visit.glide) return; const i = neighbour(visit.turnTo ?? visit.yaw, places(), step); if (i >= 0) visit.turnTo = visit.portals[i].place.heading; }
const keys = new Set();
function step(dt) {
  visit.time += dt;
  if (visit.phase === 'title') { if (!reduced) visit.yaw = wrap(visit.yaw + dt * 0.05); return; }
  // The new ring grows open and the old one shrinks away.
  visit.open = Math.min(1, visit.open + dt / 0.45);
  for (const p of visit.portals) p.uniforms.uOpen.value = visit.open;
  for (let i = visit.leaving.length - 1; i >= 0; i--) { const p = visit.leaving[i]; p.uniforms.uOpen.value = reduced ? 0 : Math.max(0, p.uniforms.uOpen.value - dt / 0.3); p.label.material.opacity = p.uniforms.uOpen.value; if (p.uniforms.uOpen.value <= 0) { dropPortal(p); visit.leaving.splice(i, 1); } }
  if (visit.glide) {
    const g = visit.glide, place = g.portal.place; g.t = Math.min(1, g.t + dt / 0.75); const k = g.t * g.t;
    frame.position.set(place.x * k * 0.92, 0, place.z * k * 0.92); visit.yaw += wrap(place.heading - visit.yaw) * Math.min(1, dt * 8); visit.pitch += (0 - visit.pitch) * Math.min(1, dt * 8);
    return;
  }
  // ◀ and ▶ turn the view to the next portal.
  if (visit.turnTo !== null) { const off = wrap(visit.turnTo - visit.yaw); if (reduced || Math.abs(off) < 0.004) { visit.yaw = visit.turnTo; visit.turnTo = null; } else visit.yaw = wrap(visit.yaw + off * Math.min(1, dt * 9)); visit.pitch += (0 - visit.pitch) * Math.min(1, dt * 6); }
  // W A S D walk a few steps around the middle.
  let ahead = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0), side = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0); const length = Math.hypot(ahead, side);
  if (length > 0) { ahead /= length; side /= length; const a = visit.yaw, speed = 1.4 * dt, from = { x: frame.position.x, z: frame.position.z }, to = walk(from, { x: from.x + (Math.sin(a) * ahead + Math.cos(a) * side) * speed, z: from.z + (-Math.cos(a) * ahead + Math.sin(a) * side) * speed }); frame.position.x = to.x; frame.position.z = to.z; }
  // The portal in the middle of the view is named on screen.
  const aim = facing(visit.yaw, places()); if (aim !== visit.aim) { visit.aim = aim; paint(); }
}

/* ---------------- input ---------------- */
let drag = null;
canvas.addEventListener('pointerdown', e => { if (visit.phase !== 'hall') return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, at: performance.now(), moved: 0 }; try { canvas.setPointerCapture(e.pointerId); } catch (error) { /* the drag still works inside the canvas */ } canvas.classList.add('look'); });
canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) { if (e.pointerType === 'mouse') canvas.classList.toggle('aim', portalAt(e.clientX, e.clientY) >= 0); return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (visit.glide || drag.moved < 6) return;
  // The view follows the finger: a drag to the right turns the visitor to the left, and a drag down looks up.
  const k = (camera.fov * Math.PI / 180) / innerHeight * 1.15; visit.turnTo = null; visit.yaw = wrap(visit.yaw - dx * k); visit.pitch = clamp(visit.pitch + dy * k, -1.1, 1.1);
});
const lift = e => { if (!drag || e.pointerId !== drag.id) return; const tap = drag.moved < 10 && performance.now() - drag.at < 500, d = drag; drag = null; canvas.classList.remove('look'); if (tap && e.type === 'pointerup') { const i = portalAt(d.sx, d.sy); if (i >= 0) enter(i); } };
canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift);
addEventListener('keydown', e => {
  if (visit.phase !== 'hall' || window.GameSwitch?.isOpen) return; const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); turn(k === 'arrowright' ? 1 : -1); }
  else if (k === 'enter' || k === ' ') { if (e.target instanceof HTMLButtonElement) return; e.preventDefault(); if (!e.repeat && visit.aim >= 0) enter(visit.aim); }
  else if (k === 'escape' || k === 'backspace') { if (visit.ringId) { e.preventDefault(); back(); } }
  else if (['w', 'a', 's', 'd'].includes(k)) keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); addEventListener('blur', () => keys.clear());
$('kPrev').addEventListener('click', () => turn(-1)); $('kNext').addEventListener('click', () => turn(1));
$('kGo').addEventListener('click', () => { if (visit.aim >= 0) enter(visit.aim); }); $('kBack').addEventListener('click', back);
go.addEventListener('click', start);

/* ---------------- the loop ---------------- */
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (!window.GameSwitch?.isOpen && !document.hidden) step(dt);
  camera.rotation.set(visit.pitch, -visit.yaw, 0);
  const time = reduced ? 0 : now / 1000, size = innerHeight * 0.02 * renderer.getPixelRatio();
  for (const list of [visit.portals, visit.leaving]) for (const p of list) { p.uniforms.uTime.value = time; p.uniforms.uSize.value = size * p.place.radius; }
  visit.portals.forEach((p, i) => { p.uniforms.uHot.value += ((i === visit.aim ? 1 : 0) - p.uniforms.uHot.value) * Math.min(1, dt * 10); p.label.material.opacity = visit.open * (0.55 + 0.45 * p.uniforms.uHot.value); });
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* ---------------- start up ---------------- */
// A small hall file shows first. A phone then takes the 500,000-splat file and a desktop the full file, and each
// replaces the one before it when it is ready.
const want = query.get('q') || (touch ? '500k' : 'full'), files = { '150k': 'hall-150k.spz', '500k': 'hall-500k.spz', full: 'hall-full.spz' };
const ready = () => { loadLine.hidden = true; go.disabled = false; go.textContent = 'Enter the hall'; go.focus({ preventScroll: true }); };
if (query.get('world') === 'none') ready();
else loadHall(files['150k'], p => { loadLine.textContent = `Loading the hall… ${Math.round(p * 100)}%`; }).then(() => {
  ready();
  if (want !== '150k' && files[want]) { loadLine.hidden = false; loadLine.textContent = 'Sharpening the hall…'; loadHall(files[want], p => { loadLine.textContent = `Sharpening the hall… ${Math.round(p * 100)}%`; }).then(() => { loadLine.hidden = true; }).catch(() => { loadLine.hidden = true; }); }
}).catch(error => { console.error(error); noGraphics('The hall did not load.'); });
requestAnimationFrame(tick);

// A handle for the browser check (qa/lab/riftwalk.e2e.mjs). The page never reads it.
window.__riftwalk = {
  state: () => ({ phase: visit.phase, ring: visit.ringId, open: visit.open, aim: visit.aim, yaw: visit.yaw, place: { x: frame.position.x, z: frame.position.z }, hall: !!hall, splats: hall?.packedSplats?.numSplats ?? 0, leaving: visit.leaving.length, portals: visit.portals.map(p => ({ kind: p.item.kind, id: p.item.id, title: p.item.title, url: p.item.url || null, heading: p.place.heading, radius: p.place.radius, art: p.uniforms.uHasMap.value === 1 })) }),
  // Where a portal's centre is on screen, or null when it is behind the view.
  screen: i => { const p = visit.portals[i]; if (!p) return null; camera.updateMatrixWorld(true); ndc.set(p.place.x, p.place.y, p.place.z).project(camera); return ndc.z > 1 ? null : { x: (ndc.x + 1) / 2 * innerWidth, y: (1 - ndc.y) / 2 * innerHeight }; },
  look: heading => { visit.turnTo = null; visit.yaw = wrap(heading); visit.pitch = 0; camera.rotation.set(0, -visit.yaw, 0); camera.updateMatrixWorld(true); },
};
