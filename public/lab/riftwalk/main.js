// Riftwalk: the page. One Gaussian splat world, a dark neon arcade hall made with Marble by World Labs, is drawn by
// Spark. Each cabinet's screen in that world is a portal to one game: the game's art inside a live edge of light.
// The visitor picks a collection, the machines show its games, and a machine's portal launches its game.
// hall.js holds the rules, and worlds/screens.json says where the screens are.
import * as THREE from 'three';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import { GROUPS, GROW, gamesOf, middle, pages, assign, pick, facing, neighbour, walk } from './hall.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), loadLine = $('load'), startCard = $('start'), go = $('go'), target = $('target'), keysBar = $('keys'), groupsBar = $('groups'), flash = $('flash'), list = $('list');
const query = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// The arcade's own list of games (switch.js). The page still works as a list of links if that script is missing.
const GAMES = (window.GameSwitch && window.GameSwitch.GAMES) || [];

/* ---------------- every game as a link ---------------- */
// Screen readers get this list always. Everyone gets it when 3D graphics cannot start.
for (const g of GROUPS) {
  const games = gamesOf(g.id, GAMES); if (!games.length) continue;
  const h = document.createElement('h2'); h.textContent = g.label; const ul = document.createElement('ul');
  for (const p of games) { const li = document.createElement('li'), a = document.createElement('a'); a.href = p.url; a.textContent = p.sub ? `${p.title}: ${p.sub}` : p.title; li.append(a); ul.append(li); }
  list.append(h, ul);
}
function noGraphics(why) { startCard.hidden = true; loadLine.hidden = true; groupsBar.hidden = keysBar.hidden = target.hidden = true; list.classList.add('shown'); const p = document.createElement('p'); p.textContent = why + ' Here is every game as a link.'; list.prepend(p); }

/* ---------------- the scene ---------------- */
// For the browser check: ?capture keeps the drawn frame readable, ?px=1 sets the pixel ratio, ?world=none draws the
// portals with no hall (software WebGL draws a splat world at a frame in seconds), and ?q=150k, 500k or full picks a
// hall file.
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: query.has('capture') }); if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2'); }
catch (e) { noGraphics('Riftwalk needs WebGL2 graphics, and this browser has none to give.'); throw e; }
renderer.setPixelRatio(+query.get('px') || Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor('#06040c');
const scene = new THREE.Scene(), frame = new THREE.Group(), camera = new THREE.PerspectiveCamera(62, 1, 0.05, 300);
camera.rotation.order = 'YXZ'; frame.add(camera); scene.add(frame);
scene.add(new SparkRenderer({ renderer }));
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 78 : 62; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ---------------- the hall ---------------- */
// worlds/screens.json carries Marble's own numbers for this world: the metres in one file unit (scale) and the height
// of the capture point over the floor (ground). A Marble .spz has y down, so the mesh turns half a turn about x.
let HALL = { scale: 1, ground: 1.35 }, SCREENS = [], hall = null;
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

/* ---------------- a machine's portal ---------------- */
// One quad lies on the machine's screen and reaches a little past it. Inside the screen's rounded shape it shows the
// game's art, pulled slightly toward the rim like a view through an opening. On the rim runs the live edge: a band of
// light that wavers with noise, with a brighter pulse that travels round it. A machine with no game shows dark glass
// with a faint edge. The quad draws after the splats and writes no depth.
const MARGIN = 0.07;   // metres of glow outside the screen
const VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAGMENT = `
  varying vec2 vUv; uniform sampler2D uMap; uniform float uHasMap; uniform float uAspect; uniform vec3 uColor; uniform vec2 uHalf; uniform vec2 uQuad;
  uniform float uLit; uniform float uTime; uniform float uHot; uniform float uSeed;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * uQuad;                       // metres from the screen's centre
    float d = box(p, uHalf, 0.022);                           // under 0 inside the screen
    float turn = atan(p.y / uHalf.y, p.x / uHalf.x); vec2 c = vec2(cos(turn), sin(turn));   // the way round the rim, with no seam
    float n = noise(c * 2.3 + vec2(uTime * 0.55 + uSeed, uSeed)) * 0.6 + noise(c * 6.0 - vec2(uSeed, uTime * 0.9)) * 0.4;
    float edge = d - (n - 0.5) * 0.014;                       // the rim wavers
    float inside = smoothstep(0.004, -0.004, edge);
    // The art covers the screen: the longer side of the picture is cropped.
    vec2 uv = p / uHalf * 0.5; float shape = uHalf.x / uHalf.y; if (uAspect > shape) uv.x *= shape / uAspect; else uv.y *= uAspect / shape;
    float rim = smoothstep(-0.09, 0.0, d); uv += c * rim * 0.02 * sin(uTime * 0.8 + uSeed); uv += 0.5;
    vec3 art = mix(uColor * 0.35, texture2D(uMap, uv).rgb, uHasMap) * (0.86 + 0.14 * uHot) * (1.0 - 0.45 * rim);
    // Dark glass for a machine with no game: near black, with slow grey static.
    vec3 glass = vec3(0.016, 0.012, 0.03) + 0.02 * noise(p * 60.0 + uTime * 3.0);
    vec3 face = mix(glass, art, uLit);
    float pulse = pow(0.5 + 0.5 * cos(turn - uTime * 1.7 - uSeed * 6.283), 10.0);
    float band = exp(-pow(edge / 0.009, 2.0)) * (0.7 + 0.5 * uHot + 0.9 * pulse) + 0.42 * exp(-pow(max(edge, 0.0) / 0.035, 2.0)) * (0.5 + n);
    band *= mix(0.16, 1.0, uLit);
    vec3 glow = mix(uColor, vec3(1.0), 0.5 * exp(-pow(edge / 0.004, 2.0)) + 0.35 * pulse);
    float a = clamp(max(inside, band), 0.0, 1.0);
    gl_FragColor = vec4(face * inside + glow * band, a);     // premultiplied
  }`;
const quad = new THREE.PlaneGeometry(2, 2), labelGeometry = new THREE.PlaneGeometry(1, 1);
const textures = new Map(), loader = new THREE.TextureLoader();
function artTexture(url, done) {
  let entry = textures.get(url);
  if (!entry) { entry = { texture: null, waiting: [] }; textures.set(url, entry); loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; entry.texture = t; for (const f of entry.waiting) f(t); entry.waiting.length = 0; }, undefined, () => { /* a missing picture leaves the portal's own colour */ }); }
  if (entry.texture) done(entry.texture); else entry.waiting.push(done);
}
function labelTexture(title, color) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 128; const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 78; g.font = `700 ${size}px Georgia, "Times New Roman", serif`; while (size > 30 && g.measureText(title).width > 730) { size -= 4; g.font = `700 ${size}px Georgia, "Times New Roman", serif`; }
  g.shadowColor = color; g.shadowBlur = 20; g.fillStyle = '#ffffff'; g.fillText(title, 384, 66); g.fillText(title, 384, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const flat = { transparent: true, depthWrite: false, depthTest: false };
function makePortal(place, index) {
  const group = new THREE.Group(), half = new THREE.Vector2(place.width / 2 * GROW, place.height / 2 * GROW), size = new THREE.Vector2(half.x + MARGIN, half.y + MARGIN);
  const uniforms = { uMap: { value: null }, uHasMap: { value: 0 }, uAspect: { value: 1 }, uColor: { value: new THREE.Color('#5ff2ff') }, uHalf: { value: half }, uQuad: { value: size }, uLit: { value: 0 }, uTime: { value: 0 }, uHot: { value: 0 }, uSeed: { value: (index * 0.618) % 1 } };
  const face = new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, ...flat, premultipliedAlpha: true }));
  face.scale.set(size.x, size.y, 1); face.renderOrder = 16; face.frustumCulled = false; group.add(face);
  const label = new THREE.Mesh(labelGeometry, new THREE.MeshBasicMaterial({ ...flat, opacity: 0 })); label.renderOrder = 20; label.frustumCulled = false; label.visible = false;
  const width = Math.max(place.width * 1.5, 0.5); label.scale.set(width, width / 6, 1); label.position.set(0, half.y + MARGIN * 0.4 + width / 12, 0.01); group.add(label);
  // The quad's own axes are the screen's: x along its width, y up it, z out of the glass.
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...place.right), new THREE.Vector3(...place.up), new THREE.Vector3(...place.normal));
  group.quaternion.setFromRotationMatrix(m); group.position.set(...place.centre); scene.add(group);
  return { place, group, uniforms, label, game: null, lit: 0, wantLit: 0 };
}
let portals = [];
function show(portal, game) {
  portal.game = game; portal.wantLit = game ? 1 : 0;
  if (portal.label.material.map) { portal.label.material.map.dispose(); portal.label.material.map = null; }
  portal.label.visible = !!game; portal.uniforms.uHasMap.value = 0;
  if (!game) return;
  portal.uniforms.uColor.value.set(game.color); portal.label.material.map = labelTexture(game.title, game.color); portal.label.material.needsUpdate = true;
  if (game.art) artTexture(game.art, t => { if (portal.game !== game) return; portal.uniforms.uMap.value = t; portal.uniforms.uHasMap.value = 1; portal.uniforms.uAspect.value = (t.image.width || 1) / (t.image.height || 1); });
}

/* ---------------- the visit ---------------- */
// phase: title, hall, launch. group and page say which games the machines show.
// REST is the look angle that puts the screens in the middle of the view: it is set when the screens' places load.
let REST = 0;
const visit = { phase: 'title', group: 0, page: 0, yaw: 0, pitch: 0, turnTo: null, aim: -1, glide: null };
const lit = () => portals.map(p => !!p.game);
function setGroup(index, page = 0, turnToMiddle = true) {
  const group = GROUPS[index]; if (!group) return; const games = gamesOf(group.id, GAMES), count = pages(games.length, SCREENS);
  visit.group = index; visit.page = ((page % count) + count) % count; visit.aim = -1;
  assign(SCREENS, games, visit.page).forEach((game, i) => show(portals[i], game));
  for (const b of groupsBar.children) { const on = b.dataset.group === group.id; b.setAttribute('aria-pressed', String(on)); if (on && visit.phase === 'hall') b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' }); }
  $('kMore').hidden = count < 2; $('kMore').textContent = `More ${visit.page + 1}/${count}`;
  if (turnToMiddle) { if (reduced || visit.phase === 'title') { visit.yaw = middle(SCREENS); visit.turnTo = null; } else visit.turnTo = middle(SCREENS); }
  paint();
}
// Going into a game: the visitor glides to the machine while the view fills with its light, then the game's page opens.
function launch(index) {
  const p = portals[index]; if (!p?.game || visit.phase !== 'hall' || visit.glide) return;
  visit.phase = 'launch'; visit.glide = { portal: p, t: 0, from: frame.position.clone() }; target.hidden = keysBar.hidden = groupsBar.hidden = true; flash.style.setProperty('--tint', p.game.color);
  const leave = () => { location.assign(p.game.url); };
  if (reduced) { flash.classList.add('on'); leave(); return; }
  setTimeout(() => flash.classList.add('on'), 300); setTimeout(leave, 800);
}
// A page kept in the back-forward cache comes back mid-launch: put the visitor back in the hall.
addEventListener('pageshow', e => { if (!e.persisted || visit.phase !== 'launch') return; flash.classList.remove('on'); frame.position.set(0, 0, 0); visit.glide = null; visit.phase = 'hall'; keysBar.hidden = groupsBar.hidden = false; paint(); });
function start() { visit.phase = 'hall'; startCard.hidden = true; keysBar.hidden = groupsBar.hidden = false; setGroup(visit.group, visit.page, true); }
function paint() {
  const p = portals[visit.aim];
  if (visit.phase !== 'hall' || !p?.game) { target.hidden = true; $('kGo').disabled = true; canvas.classList.remove('aim'); return; }
  target.hidden = false; $('kGo').disabled = false; target.style.setProperty('--tint', p.game.color);
  $('tTitle').textContent = p.game.title; $('tSub').textContent = p.game.sub; $('tSub').hidden = !p.game.sub;
  $('tDo').textContent = touch ? 'Tap the screen to play' : 'Click the screen or press Enter to play';
}

/* ---------------- looking and walking ---------------- */
// visit.yaw is a compass heading: 0 looks along -z and a quarter turn looks along +x.
const eye = new THREE.Vector3(), dir = new THREE.Vector3(), ndc = new THREE.Vector3();
function lookRay(clientX, clientY) {
  camera.updateMatrixWorld(true); camera.getWorldPosition(eye);
  ndc.set(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1, 0.5).unproject(camera); dir.copy(ndc).sub(eye).normalize();
  return [{ x: eye.x, y: eye.y, z: eye.z }, { x: dir.x, y: dir.y, z: dir.z }];
}
const portalAt = (x, y) => visit.phase === 'hall' ? pick(...lookRay(x, y), SCREENS, lit(), touch ? 1.45 : 1.1) : -1;
// The machines as the visitor sees them from where they stand: after a few steps, a machine's heading is not the one
// it has from the middle of the hall.
const seen = () => SCREENS.map(p => ({ ...p, heading: Math.atan2(p.centre[0] - frame.position.x, -(p.centre[2] - frame.position.z)) }));
function turn(step) { if (visit.phase !== 'hall' || visit.glide) return; const now = seen(), i = neighbour(visit.turnTo ?? visit.yaw, now, lit(), step); if (i >= 0) visit.turnTo = now[i].heading; }
const keys = new Set();
function step(dt) {
  // A screen comes on with a quick flicker, and goes dark the same way.
  for (const p of portals) { if (p.lit !== p.wantLit) p.lit = reduced ? p.wantLit : clamp(p.lit + Math.sign(p.wantLit - p.lit) * dt / 0.35, 0, 1); const flicker = reduced || p.lit >= 1 || p.lit <= 0 ? 1 : 0.6 + 0.4 * Math.sin(p.lit * 40 + p.uniforms.uSeed.value * 9); p.uniforms.uLit.value = p.lit * flicker; }
  if (visit.phase === 'title') return;
  if (visit.glide) {
    const g = visit.glide, c = g.portal.place.centre; g.t = Math.min(1, g.t + dt / 0.8); const k = g.t * g.t * 0.82;
    frame.position.set(g.from.x + (c[0] - g.from.x) * k, 0, g.from.z + (c[2] - g.from.z) * k);
    visit.yaw += wrap(g.portal.place.heading - visit.yaw) * Math.min(1, dt * 8); visit.pitch += (Math.atan2(c[1] - HALL.ground, g.portal.place.distance) - visit.pitch) * Math.min(1, dt * 8);
    return;
  }
  // ◀ and ▶ turn the view to the next lit machine.
  if (visit.turnTo !== null) { const off = wrap(visit.turnTo - visit.yaw); if (reduced || Math.abs(off) < 0.004) { visit.yaw = visit.turnTo; visit.turnTo = null; } else visit.yaw = wrap(visit.yaw + off * Math.min(1, dt * 9)); visit.pitch += (REST - visit.pitch) * Math.min(1, dt * 6); }
  // W A S D walk a few steps around the middle.
  let ahead = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0), side = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0); const length = Math.hypot(ahead, side);
  if (length > 0) { ahead /= length; side /= length; const a = visit.yaw, speed = 1.3 * dt, from = { x: frame.position.x, z: frame.position.z }, to = walk(from, { x: from.x + (Math.sin(a) * ahead + Math.cos(a) * side) * speed, z: from.z + (-Math.cos(a) * ahead + Math.sin(a) * side) * speed }); frame.position.x = to.x; frame.position.z = to.z; }
  // The lit machine in the middle of the view is named on screen.
  const aim = facing(visit.yaw, seen(), lit()); if (aim !== visit.aim) { visit.aim = aim; paint(); }
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
const lift = e => { if (!drag || e.pointerId !== drag.id) return; const tap = drag.moved < 10 && performance.now() - drag.at < 500, d = drag; drag = null; canvas.classList.remove('look'); if (tap && e.type === 'pointerup') { const i = portalAt(d.sx, d.sy); if (i >= 0) launch(i); } };
canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift);
const nextGroup = step => setGroup((visit.group + step + GROUPS.length) % GROUPS.length);
addEventListener('keydown', e => {
  if (visit.phase !== 'hall' || window.GameSwitch?.isOpen) return; const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); turn(k === 'arrowright' ? 1 : -1); }
  else if (k === 'arrowup' || k === 'arrowdown') { e.preventDefault(); nextGroup(k === 'arrowdown' ? 1 : -1); }
  else if (k >= '1' && k <= String(GROUPS.length)) setGroup(+k - 1);
  else if (k === 'pagedown' || k === 'm') { if (!$('kMore').hidden) { e.preventDefault(); setGroup(visit.group, visit.page + 1); } }
  else if (k === 'enter' || k === ' ') { if (e.target instanceof HTMLButtonElement) return; e.preventDefault(); if (!e.repeat && visit.aim >= 0) launch(visit.aim); }
  else if (['w', 'a', 's', 'd'].includes(k)) keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); addEventListener('blur', () => keys.clear());
$('kPrev').addEventListener('click', () => turn(-1)); $('kNext').addEventListener('click', () => turn(1));
$('kGo').addEventListener('click', () => { if (visit.aim >= 0) launch(visit.aim); }); $('kMore').addEventListener('click', () => setGroup(visit.group, visit.page + 1));
GROUPS.forEach((g, i) => { if (!gamesOf(g.id, GAMES).length) return; const b = document.createElement('button'); b.type = 'button'; b.dataset.group = g.id; b.textContent = g.label; b.style.setProperty('--tint', g.color); b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => setGroup(i)); groupsBar.append(b); });
go.addEventListener('click', start);

/* ---------------- the loop ---------------- */
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (!window.GameSwitch?.isOpen && !document.hidden) step(dt);
  camera.rotation.set(visit.pitch, -visit.yaw, 0);
  const time = reduced ? 0 : now / 1000;
  portals.forEach((p, i) => { p.uniforms.uTime.value = time; p.uniforms.uHot.value += ((i === visit.aim ? 1 : 0) - p.uniforms.uHot.value) * Math.min(1, dt * 10); p.label.material.opacity = p.lit * (0.5 + 0.5 * p.uniforms.uHot.value); });
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* ---------------- start up ---------------- */
// The screens' places load first. Then a small hall file shows; a phone then takes the 500,000-splat file and a
// desktop the full file, and each replaces the one before it when it is ready.
const want = query.get('q') || (touch ? '500k' : 'full'), files = { '150k': 'hall-150k.spz', '500k': 'hall-500k.spz', full: 'hall-full.spz' };
const ready = () => { loadLine.hidden = true; go.disabled = false; go.textContent = 'Enter the hall'; go.focus({ preventScroll: true }); };
fetch('./worlds/screens.json').then(r => { if (!r.ok) throw new Error('screens.json missing'); return r.json(); }).then(data => {
  HALL = data.hall; SCREENS = data.screens; camera.position.set(0, HALL.ground, 0);
  portals = SCREENS.map(makePortal); visit.yaw = middle(SCREENS);
  REST = SCREENS.reduce((s, p) => s + Math.atan2(p.centre[1] - HALL.ground, p.distance), 0) / Math.max(1, SCREENS.length); visit.pitch = REST;
  // The first collection that fills the most machines greets the visitor.
  const first = GROUPS.findIndex(g => g.id === 'action'); setGroup(first < 0 ? 0 : first, 0, true);
  if (query.get('world') === 'none') return ready();
  return loadHall(files['150k'], p => { loadLine.textContent = `Loading the hall… ${Math.round(p * 100)}%`; }).then(() => {
    ready();
    if (want !== '150k' && files[want]) { loadLine.hidden = false; loadLine.textContent = 'Sharpening the hall…'; loadHall(files[want], p => { loadLine.textContent = `Sharpening the hall… ${Math.round(p * 100)}%`; }).then(() => { loadLine.hidden = true; }).catch(() => { loadLine.hidden = true; }); }
  });
}).catch(error => { console.error(error); noGraphics('The hall did not load.'); });
requestAnimationFrame(tick);

// A handle for the browser check (qa/lab/riftwalk.e2e.mjs). The page never reads it.
window.__riftwalk = {
  state: () => ({ phase: visit.phase, group: GROUPS[visit.group].id, page: visit.page, pages: pages(gamesOf(GROUPS[visit.group].id, GAMES).length, SCREENS), aim: visit.aim, yaw: visit.yaw, turning: visit.turnTo !== null, place: { x: frame.position.x, z: frame.position.z }, hall: !!hall, splats: hall?.packedSplats?.numSplats ?? 0,
    machines: portals.map(p => ({ game: p.game?.id ?? null, title: p.game?.title ?? null, url: p.game?.url ?? null, heading: p.place.heading, lit: p.lit, art: p.uniforms.uHasMap.value === 1 })) }),
  // Where a machine's screen centre is on the page, or null when it is behind the view.
  screen: i => { const p = portals[i]; if (!p) return null; camera.updateMatrixWorld(true); ndc.set(...p.place.centre).project(camera); return ndc.z > 1 ? null : { x: (ndc.x + 1) / 2 * innerWidth, y: (1 - ndc.y) / 2 * innerHeight }; },
  look: heading => { visit.turnTo = null; visit.yaw = wrap(heading); visit.pitch = REST; camera.rotation.set(visit.pitch, -visit.yaw, 0); camera.updateMatrixWorld(true); },
};
