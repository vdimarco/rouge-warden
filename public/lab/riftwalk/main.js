// Riftwalk: the page. The hall is one Gaussian splat world, a dark neon arcade made with World Labs Atlas and drawn by
// Spark. Arcade cabinets stand in clusters against its walls, one zone of clusters for each collection of the arcade.
// Each cabinet's screen is a portal to one game: the game's art inside a live edge of light. A rift ring hangs above
// each zone. A ring opens into that zone's own room: a smaller world, made earlier with Marble, with machines for the
// zone's games and a ring that leads back to the hall.
// hall.js holds the rules, and worlds/hall/screens.json says where the screens, the stations and the rings are.
import * as THREE from 'three';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import { GROUPS, ZONES, GROW, gamesOf, zoneGames, seats, pages, assign, ringPlace, roomSeats, exitRing, walkRoom, zoneAt, headingTo, pick, facing, neighbour, walk } from './hall.js';

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
const moteScale = { value: 1 };   // pixels for a mote one metre wide at one metre: set with the view's size
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 78 : 62; camera.updateProjectionMatrix(); moteScale.value = h * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360)); }
addEventListener('resize', resize); resize();

/* ---------------- the hall ---------------- */
// worlds/hall/screens.json carries the hall's numbers: the eye height, the box of open floor the visitor walks in,
// where the visitor starts, and the world's file. ?world=none draws the portals with no world, for the browser check.
let HALL = { scale: 1, eye: 1.45, bounds: { x: [-2, 2], z: [-2, 2] }, start: { x: 0, z: 0, facing: 0 } }, SCREENS = [], PLACES = [], STATIONS = [], hall = null;
const noWorld = query.get('world') === 'none';
async function loadHall(onProgress) {
  const response = await fetch('./worlds/hall/' + HALL.file); if (!response.ok) throw new Error('World file missing: ' + HALL.file);
  const total = +response.headers.get('content-length') || 0, reader = response.body.getReader(), parts = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; if (onProgress && total) onProgress(got / total); }
  const bytes = new Uint8Array(got); let at = 0; for (const p of parts) { bytes.set(p, at); at += p.length; }
  const mesh = new SplatMesh({ fileBytes: bytes }); await mesh.initialized;
  if (HALL.flip) mesh.quaternion.set(1, 0, 0, 0); mesh.scale.setScalar(HALL.scale); if (HALL.offset) mesh.position.set(...HALL.offset);
  hallMesh = hall = mesh; scene.add(mesh); return mesh;
}
// The rooms: one small Marble world for each zone, loaded when the visitor first goes in. A Marble .spz has y down,
// so the mesh turns half a turn about x; the room's screens.json gives its scale and the eye height.
const ROOMS = {}; let hallMesh = null, HALLDATA = null, room = null;   // room: the index of the zone whose room the visitor is in, or null in the hall
const roomData = id => ROOMS[id] ? Promise.resolve(ROOMS[id]) : fetch(`./worlds/rooms/${id}/screens.json`).then(r => { if (!r.ok) throw new Error('Room missing: ' + id); return r.json(); }).then(d => (ROOMS[id] = d));
async function loadRoom(id, quality) {
  const response = await fetch(`./worlds/rooms/${id}/${quality}.spz`); if (!response.ok) throw new Error('Room file missing: ' + id);
  const mesh = new SplatMesh({ fileBytes: new Uint8Array(await response.arrayBuffer()) }); await mesh.initialized;
  const h = ROOMS[id].hall; mesh.quaternion.set(1, 0, 0, 0); mesh.scale.setScalar(h.scale); mesh.position.set(0, h.ground, 0); return mesh;
}
function showWorld(mesh) { if (hall === mesh) return; if (hall) { scene.remove(hall); if (hall !== hallMesh) hall.dispose?.(); } hall = mesh; if (mesh) scene.add(mesh); }

/* ---------------- a machine's portal ---------------- */
// One quad lies on the machine's screen and reaches a little past it. Inside the screen's rounded shape it shows the
// game's art, pulled slightly toward the rim like a view through an opening. On the rim runs the live edge: a band of
// light that wavers with noise, with a brighter pulse that travels round it. A machine with no game shows dark glass
// with a faint edge. The quad draws after the splats and writes no depth.
const MARGIN = 0.045;   // metres of glow outside the screen
// Each zone has its own look, so a visitor knows a zone by its screens as well as by its room: the corner of a screen
// (radius, metres), how much its edge wavers (wave, metres), how strong its scan lines are (scan), and the letters of
// its names (font).
const LOOKS = {
  cottage: { radius: 0.035, wave: 0.006, scan: 0.45, font: '700 74px Georgia, "Times New Roman", serif' },
  action: { radius: 0.02, wave: 0.014, scan: 0.6, font: 'italic 800 74px "Arial Narrow", "Helvetica Neue", Arial, sans-serif' },
  ascii: { radius: 0.003, wave: 0.0, scan: 1.0, font: '700 66px "Courier New", ui-monospace, monospace' },
  strategy: { radius: 0.012, wave: 0.003, scan: 0.5, font: '600 70px "Palatino Linotype", Palatino, Georgia, serif' },
  gta: { radius: 0.02, wave: 0.02, scan: 0.75, font: '900 76px Impact, "Arial Black", sans-serif' },
  lab: { radius: 0.05, wave: 0.02, scan: 0.55, font: '600 68px "Trebuchet MS", "Segoe UI", sans-serif' },
};
const VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAGMENT = `
  varying vec2 vUv; uniform sampler2D uMap; uniform float uHasMap; uniform float uAspect; uniform vec3 uColor; uniform vec3 uZone; uniform vec2 uHalf; uniform vec2 uQuad;
  uniform float uLit; uniform float uTime; uniform float uHot; uniform float uFlow; uniform float uSeed; uniform float uRadius; uniform float uWave; uniform float uScan; uniform float uDoor;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  // Under 0 inside the shape. A screen is a box with round corners. A rift ring is a disc.
  float shape(vec2 p) {
    if (uDoor > 0.5) return length(p) - uHalf.x;
    vec2 q = abs(p) - uHalf + uRadius; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  }
  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * uQuad;                       // metres from the centre
    float d = shape(p);
    float turn = atan(p.y / uHalf.y, p.x / uHalf.x); vec2 c = vec2(cos(turn), sin(turn));   // the way round the rim, with no seam
    float n = noise(c * 2.3 + vec2(uTime * 0.55 + uSeed, uSeed)) * 0.6 + noise(c * 6.0 - vec2(uSeed, uTime * 0.9)) * 0.4;
    float edge = d - (n - 0.5) * uWave;                       // the rim wavers
    float inside = smoothstep(0.003, -0.003, edge), rim = smoothstep(-0.07, 0.0, d);
    // The picture covers the shape: the longer side of the picture is cropped.
    vec2 uv = p / uHalf * 0.5; float form = uHalf.x / uHalf.y; if (uAspect > form) uv.x *= form / uAspect; else uv.y *= uAspect / form; uv += 0.5;
    // Under the pointer the picture flows: it swells a little, drifts, and its surface moves like slow water.
    vec2 fl = vec2(noise(uv * 3.0 + vec2(uTime * 0.35, uSeed * 7.0)), noise(uv * 3.0 + vec2(uSeed * 3.0, -uTime * 0.3))) - 0.5;
    fl += 0.5 * (vec2(noise(uv * 7.0 - vec2(uTime * 0.5, 2.0)), noise(uv * 7.0 + vec2(5.0, uTime * 0.45))) - 0.5);
    uv = (uv - 0.5) * (1.0 - 0.07 * uFlow) + 0.5 + fl * 0.06 * uFlow + vec2(sin(uTime * 0.4 + uSeed * 6.0), cos(uTime * 0.33)) * 0.012 * uFlow;
    vec3 pic = mix(uColor * 0.35, texture2D(uMap, uv).rgb, uHasMap) * (1.0 + 0.12 * uFlow);
    // A game shows as a picture on the machine's own tube: scan lines, darker corners, and a faint shine on the glass.
    float lines = 1.0 - uScan * 0.15 * (0.5 + 0.5 * sin(p.y * 820.0));
    float shine = 0.045 * smoothstep(0.22, 0.0, abs(p.x / uHalf.x * 0.6 + p.y / uHalf.y - 0.55));
    vec3 art = pic * lines * (1.0 - 0.38 * rim) * (0.9 + 0.1 * uHot) + shine;
    // A door shows its zone through a slow swirl of that zone's light, thicker toward the rim.
    if (uDoor > 0.5) { float r = length(p / uHalf); float swirl = noise(c * 1.6 + vec2(r * 3.0 - uTime * 0.45, uSeed)) * 0.6 + noise(c * 4.0 + vec2(uSeed, r * 5.0 + uTime * 0.3)) * 0.4; art = mix(uColor * (0.10 + 0.5 * swirl * swirl) * (0.35 + 0.65 * smoothstep(0.0, 1.0, r)) + vec3(0.02, 0.01, 0.04), pic * (0.6 + 0.3 * swirl) * (1.0 - 0.5 * rim) + uColor * 0.45 * rim * swirl, uHasMap);
      // Stars in the door: a few points of light that come and go.
      vec2 cell = floor(p * 26.0), in2 = fract(p * 26.0) - 0.5; float star = step(0.9, hash(cell + uSeed)) * smoothstep(0.22, 0.0, length(in2)) * pow(0.5 + 0.5 * sin(uTime * (1.5 + 3.0 * hash(cell)) + hash(cell + 3.0) * 6.283), 3.0); art += mix(uColor, vec3(1.0), 0.6) * star * 1.4; }
    else { float glint = exp(-pow((p.x / uHalf.x * 0.7 + p.y / uHalf.y * 0.5 + 1.6 - mod(uTime * 0.55 + uSeed * 5.0, 3.2) * 1.0) / 0.12, 2.0)); art += mix(uColor, vec3(1.0), 0.5) * glint * 0.2 * uHot; }   // a glint crosses the screen in view
    // A machine with no game idles in its zone's colour: a dim tube with a slow bright bar that rolls down it.
    float bar = exp(-pow((fract(p.y / (uHalf.y * 2.0) + uTime * 0.06 + uSeed) - 0.5) / 0.07, 2.0));
    vec3 idle = (uZone * (0.07 + 0.05 * n + 0.14 * bar) + 0.012) * lines * (1.0 - 0.5 * rim);
    vec3 face = mix(idle, art, uLit);
    float pulse = pow(0.5 + 0.5 * cos(turn - uTime * 1.7 - uSeed * 6.283), 10.0);
    float band = exp(-pow(edge / 0.006, 2.0)) * (0.75 + 0.5 * uHot + 0.8 * pulse) + 0.24 * exp(-pow(max(edge, 0.0) / 0.02, 2.0)) * (0.5 + n) * (1.0 - inside);
    band *= mix(0.2, 1.0, uLit);
    vec3 glow = mix(mix(uZone, uColor, uLit), vec3(1.0), 0.5 * exp(-pow(edge / 0.003, 2.0)) + 0.3 * pulse);
    float a = clamp(max(inside, band), 0.0, 1.0);
    gl_FragColor = vec4(face * inside + glow * band, a);     // premultiplied
  }`;
/* ---------------- motes of light ---------------- */
// Magic in the air: small points of light in the zone's colour drift up through the room and twinkle, and sparks
// circle each rift door and fall into it. They are points drawn after the splats, with light that adds up.
const MOTE_VERTEX = `
  attribute vec4 aSeed; uniform float uTime; uniform float uScale; uniform float uRing; uniform vec2 uHalf; varying float vAlpha;
  void main() {
    vec3 at = position; float seed = aSeed.x, speed = aSeed.y; float twinkle = 0.5 + 0.5 * sin(uTime * (1.0 + speed * 2.0) + seed * 40.0);
    if (uRing > 0.5) {
      // A spark turns round the door and falls toward its middle, then starts again at the rim.
      float fall = fract(uTime * 0.07 * (0.6 + speed) + seed), turn = seed * 6.283 + uTime * (0.25 + 0.5 * speed), reach = 1.12 - 0.75 * fall;
      at = vec3(cos(turn) * uHalf.x * reach, sin(turn) * uHalf.y * reach, 0.02); vAlpha = twinkle * smoothstep(0.0, 0.12, fall) * (1.0 - fall);
    } else {
      float height = 2.7; at.y = mod(position.y + uTime * speed * 0.07, height) + 0.05;
      at.x += sin(uTime * 0.31 + seed * 20.0) * 0.14; at.z += cos(uTime * 0.27 + seed * 31.0) * 0.14;
      vAlpha = (0.25 + 0.75 * twinkle) * smoothstep(0.05, 0.5, at.y) * smoothstep(height, height - 0.6, at.y);
    }
    vec4 mv = modelViewMatrix * vec4(at, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSeed.z * uScale / max(0.2, -mv.z);
  }`;
const MOTE_FRAGMENT = `
  uniform vec3 uColor; varying float vAlpha;
  void main() { float d = length(gl_PointCoord - 0.5); float soft = smoothstep(0.5, 0.0, d), core = smoothstep(0.16, 0.0, d); gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.7) * (soft * 0.55 + core) * vAlpha, 0.0); }`;
function motes(count, color, ring, half, place) {
  const position = new Float32Array(count * 3), seed = new Float32Array(count * 4), reach = place && !ring ? 2.6 : 3.4; let r = 12345 + count * 7 + (ring ? 99 : 0); const rand = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < count; i++) {
    const turn = rand() * Math.PI * 2, far = 0.4 + rand() * reach; position.set(ring ? [0, 0, 0] : [Math.sin(turn) * far, rand() * 2.7, -Math.cos(turn) * far], i * 3);
    seed.set([rand(), 0.3 + rand() * 0.7, (ring ? 0.034 : 0.03) + rand() * 0.045, 0], i * 4);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(position, 3)); geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: moteScale, uRing: { value: ring ? 1 : 0 }, uHalf: { value: half || new THREE.Vector2(1, 1) }, uColor: { value: new THREE.Color(color) } }, vertexShader: MOTE_VERTEX, fragmentShader: MOTE_FRAGMENT, transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }));
  points.frustumCulled = false; points.renderOrder = 18; (place || scene).add(points); return points;
}
let air = [];   // the motes of the zone the visitor is in

const quad = new THREE.PlaneGeometry(2, 2), labelGeometry = new THREE.PlaneGeometry(1, 1);
const textures = new Map(), loader = new THREE.TextureLoader();
function artTexture(url, done) {
  let entry = textures.get(url);
  if (!entry) { entry = { texture: null, waiting: [] }; textures.set(url, entry); loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); entry.texture = t; for (const f of entry.waiting) f(t); entry.waiting.length = 0; }, undefined, () => { /* a missing picture leaves the portal's own colour */ }); }
  if (entry.texture) done(entry.texture); else entry.waiting.push(done);
}
function labelTexture(title, color, font = LOOKS.action.font) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 128; const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = +font.match(/(\d+)px/)[1]; const sized = () => font.replace(/\d+px/, size + 'px'); g.font = sized(); while (size > 30 && g.measureText(title).width > 730) { size -= 4; g.font = sized(); }
  g.shadowColor = color; g.shadowBlur = 20; g.fillStyle = '#ffffff'; g.fillText(title, 384, 66); g.fillText(title, 384, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const flat = { transparent: true, depthWrite: false, depthTest: false };
function makePortal(place, index, zone) {
  const look = LOOKS[zone.id] || LOOKS.action;
  const group = new THREE.Group(), half = new THREE.Vector2(place.width / 2 * GROW, place.height / 2 * GROW), size = new THREE.Vector2(half.x + MARGIN * (place.ring ? 3 : 1), half.y + MARGIN * (place.ring ? 3 : 1));
  const uniforms = { uMap: { value: null }, uHasMap: { value: 0 }, uAspect: { value: 1 }, uColor: { value: new THREE.Color('#5ff2ff') }, uHalf: { value: half }, uQuad: { value: size }, uLit: { value: 0 }, uTime: { value: 0 }, uHot: { value: 0 }, uSeed: { value: (index * 0.618) % 1 }, uFlow: { value: 0 }, uZone: { value: new THREE.Color(zone.color) }, uRadius: { value: look.radius }, uWave: { value: place.ring ? 0.03 : look.wave }, uScan: { value: look.scan }, uDoor: { value: place.ring ? 1 : 0 } };
  const face = new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, ...flat, premultipliedAlpha: true }));
  face.scale.set(size.x, size.y, 1); face.renderOrder = 16; face.frustumCulled = false; group.add(face);
  const label = new THREE.Mesh(labelGeometry, new THREE.MeshBasicMaterial({ ...flat, opacity: 0 })); label.renderOrder = 20; label.frustumCulled = false; label.visible = false;
  const width = Math.max(place.width * 1.5, 0.5); label.scale.set(width, width / 6, 1); label.position.set(0, half.y + MARGIN * 0.4 + width / 12, 0.01); group.add(label);
  // The quad's own axes are the screen's: x along its width, y up it, z out of the glass.
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...place.right), new THREE.Vector3(...place.up), new THREE.Vector3(...place.normal));
  group.quaternion.setFromRotationMatrix(m); group.position.set(...place.centre); scene.add(group);
  return { place, group, uniforms, face, label, look, zone, door: !!place.ring, game: null, lit: 0, wantLit: 0 };
}
let portals = [];
function show(portal, game) {
  portal.game = game; portal.wantLit = game ? 1 : 0;
  if (portal.label.material.map) { portal.label.material.map.dispose(); portal.label.material.map = null; }
  portal.label.visible = !!game; portal.uniforms.uHasMap.value = 0;
  if (!game) return;
  portal.uniforms.uColor.value.set(game.color); portal.label.material.map = labelTexture(game.title, game.color, portal.look.font); portal.label.material.needsUpdate = true;
  if (game.art) artTexture(game.art, t => { if (portal.game !== game) return; portal.uniforms.uMap.value = t; portal.uniforms.uHasMap.value = 1; portal.uniforms.uAspect.value = (t.image.width || 1) / (t.image.height || 1); });
}

/* ---------------- the visit ---------------- */
// phase: title, hall, travel (a glide to another zone), launch. zone is the zone the visitor stands in: the one whose
// station is nearest. Each zone keeps its own page of games.
const visit = { phase: 'title', zone: 0, page: ZONES.map(() => 0), yaw: 0, pitch: 0, turnTo: null, pitchTo: 0, aim: -1, glide: null };
const REACH = 9;       // metres: a place farther than this is not named and the arrows pass it over
const lit = () => portals.map(p => !!p.game);
const gamesIn = i => zoneGames(ZONES[i].id, GAMES), seatsIn = i => room !== null ? roomSeats(SCREENS) : seats(ZONES[i].id, SCREENS, STATIONS[i].station, STATIONS[i].facing);
const pagesIn = i => pages(gamesIn(i).length, seatsIn(i).length);
// The zone's name shows large for a moment on the way in, and the page's accent takes the zone's colour.
const zoneName = $('zone');
function banner(zone) {
  document.documentElement.style.setProperty('--zone', zone.color); if (visit.phase === 'title') return;
  zoneName.textContent = zone.label; zoneName.classList.remove('show'); void zoneName.offsetWidth; zoneName.classList.add('show');
}
// Every machine shows a game of its zone, on that zone's page.
function fill(index) {
  const seatList = seatsIn(index), games = assign(seatList, gamesIn(index), visit.page[index]);
  for (const seat of seatList) show(portals[seat], games.get(seat) || null);
}
function setPage(page) { const i = visit.zone, count = pagesIn(i); visit.page[i] = ((page % count) + count) % count; visit.aim = -1; fill(i); mark(); paint(); }
// The buttons follow the zone the visitor stands in.
function mark() {
  const zone = ZONES[visit.zone], count = pagesIn(visit.zone);
  for (const b of groupsBar.children) { const on = b.dataset.zone === zone.id; b.setAttribute('aria-pressed', String(on)); if (on && visit.phase !== 'title') b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' }); }
  $('kBack').hidden = room === null; $('kRoom').hidden = room !== null; $('kRoom').textContent = ZONES[visit.zone].label + ' room'; $('kMore').hidden = count < 2; $('kMore').textContent = `More ${visit.page[visit.zone] + 1}/${count}`;
}
function enter(index) { if (room !== null || index === visit.zone) return; visit.zone = index; mark(); banner(ZONES[index]); }
// Going to another zone: the visitor glides across the hall to that zone's station and turns to its machines.
function travel(index) {
  if (visit.phase !== 'hall' || visit.glide || !ZONES[index]) return;
  if (room !== null) { if (index !== room) goRoom(index); return; }
  const to = STATIONS[index], from = { x: frame.position.x, z: frame.position.z }, far = Math.hypot(to.station[0] - from.x, to.station[1] - from.z);
  target.hidden = true; canvas.classList.remove('aim'); visit.turnTo = null;
  if (reduced || far < 0.05) { frame.position.set(to.station[0], 0, to.station[1]); visit.yaw = to.facing; visit.pitch = 0; enter(index); visit.aim = -1; paint(); return; }
  visit.phase = 'travel'; visit.glide = { to: { x: to.station[0], z: to.station[1] }, from, yaw: to.facing, fromYaw: visit.yaw, fromPitch: visit.pitch, t: 0, time: clamp(far / 6, 0.7, 1.8), zone: index };
}
// The places of the hall: every machine and ring, each machine with its game, and motes in the air of each zone.
function clearPlaces() {
  for (const p of portals) { scene.remove(p.group); p.label.material.map?.dispose(); p.label.material.dispose(); p.face.material.dispose(); } portals = [];
  for (const m of air) { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); } air = []; hover = -1; visit.aim = -1;
}
function buildHall() {
  clearPlaces(); room = null; HALL = HALLDATA.hall; SCREENS = HALLDATA.screens; STATIONS = ZONES.map(z => HALLDATA.zones[z.id]);
  PLACES = SCREENS.concat(STATIONS.map(z => ringPlace(z.ring))); camera.position.set(0, HALL.eye, 0);
  const zoneOf = id => ZONES.find(z => z.id === id);
  portals = PLACES.map((place, i) => makePortal(place, i, place.ring ? ZONES[i - SCREENS.length] : zoneOf(place.zone)));
  ZONES.forEach((z, i) => { visit.page[i] = 0; fill(i); show(portals[SCREENS.length + i], { zone: i, id: 'ring-' + z.id, title: z.label, sub: `${gamesIn(i).length} ${gamesIn(i).length === 1 ? 'game' : 'games'} · a room of its own`, url: null, art: `./worlds/rooms/${z.id}/door.webp`, color: z.color }); });
  if (!reduced) ZONES.forEach((z, i) => { const at = new THREE.Group(); at.position.set(STATIONS[i].station[0], 0, STATIONS[i].station[1]); scene.add(at); air.push(motes(touch ? 26 : 44, z.color, false, null, at)); const p = portals[SCREENS.length + i]; air.push(motes(30, z.color, true, p.uniforms.uHalf.value, p.group)); });
}
// The places of a room: its machines, with the zone's games from the front machine outward, and the ring back to the hall.
function buildRoom(index) {
  clearPlaces(); room = index; const zone = ZONES[index], data = ROOMS[zone.id];
  HALL = { eye: data.hall.ground, reach: 1 }; SCREENS = data.screens.map(s => ({ ...s, zone: zone.id })); PLACES = SCREENS.concat([exitRing(SCREENS)]); camera.position.set(0, HALL.eye, 0);
  portals = PLACES.map((place, i) => makePortal(place, i, zone)); visit.page[index] = 0; fill(index);
  show(portals[SCREENS.length], { exit: true, zone: index, id: 'ring-hall', title: 'The hall', sub: 'Back to the hall of all the games', url: null, art: null, color: '#ffffff' });
  if (!reduced) { air.push(motes(touch ? 50 : 90, zone.color, false)); const p = portals[SCREENS.length]; air.push(motes(30, '#ffffff', true, p.uniforms.uHalf.value, p.group)); }
}
// Through a ring into a zone's room: the view fills with the zone's light, the room's world loads, and the visitor
// stands in its middle and faces the first game. The room shows small first and sharpens.
const pause = ms => new Promise(done => setTimeout(done, ms));
function goRoom(index) {
  if (visit.phase !== 'hall' || visit.glide || !ZONES[index]) return; const zone = ZONES[index];
  visit.phase = 'travel'; target.hidden = keysBar.hidden = groupsBar.hidden = true; canvas.classList.remove('aim'); flash.style.setProperty('--tint', zone.color); flash.classList.add('on');
  roomData(zone.id).then(() => Promise.all([noWorld ? null : loadRoom(zone.id, '150k'), pause(reduced ? 0 : 600)])).then(([mesh]) => {
    showWorld(mesh); buildRoom(index); visit.zone = index; frame.position.set(0, 0, 0); visit.yaw = SCREENS[roomSeats(SCREENS)[0]].heading; visit.pitch = 0; visit.turnTo = null;
    visit.phase = 'hall'; flash.classList.remove('on'); keysBar.hidden = groupsBar.hidden = false; mark(); banner(zone); paint();
    if (!noWorld) loadRoom(zone.id, '500k').then(sharp => { if (room === index && visit.phase !== 'travel') showWorld(sharp); else sharp.dispose?.(); }).catch(() => { /* the small room stays */ });
  }).catch(error => { console.error(error); visit.phase = 'hall'; flash.classList.remove('on'); keysBar.hidden = groupsBar.hidden = false; loadLine.hidden = false; loadLine.textContent = `${zone.label} did not load.`; setTimeout(() => { loadLine.hidden = true; }, 4000); paint(); });
}
// Back through the ring: the hall again, at the cluster of the zone the visitor came from.
function goHall() {
  if (visit.phase !== 'hall' || visit.glide || room === null) return; const index = room, zone = ZONES[index];
  visit.phase = 'travel'; target.hidden = keysBar.hidden = groupsBar.hidden = true; canvas.classList.remove('aim'); flash.style.setProperty('--tint', zone.color); flash.classList.add('on');
  pause(reduced ? 0 : 450).then(() => {
    showWorld(hallMesh); buildHall(); visit.zone = index; const at = STATIONS[index]; frame.position.set(at.station[0], 0, at.station[1]); visit.yaw = at.facing; visit.pitch = 0; visit.turnTo = null;
    visit.phase = 'hall'; flash.classList.remove('on'); keysBar.hidden = groupsBar.hidden = false; mark(); paint();
  });
}
// Going into a game: the visitor glides to the machine while the view fills with its light, then the game's page opens.
// A rift ring takes the visitor to its zone. The ring over the zone the visitor stands in shows that zone's next games.
function launch(index) {
  const p = portals[index]; if (!p?.game || visit.phase !== 'hall' || visit.glide) return;
  if (p.door) return p.game.exit ? goHall() : goRoom(p.game.zone);
  visit.phase = 'launch'; visit.glide = { portal: p, t: 0, from: frame.position.clone() }; target.hidden = keysBar.hidden = groupsBar.hidden = true; flash.style.setProperty('--tint', p.game.color);
  const leave = () => { location.assign(p.game.url); };
  if (reduced) { flash.classList.add('on'); leave(); return; }
  setTimeout(() => flash.classList.add('on'), 300); setTimeout(leave, 800);
}
// A page kept in the back-forward cache comes back mid-launch: put the visitor back in the hall.
addEventListener('pageshow', e => { if (!e.persisted || visit.phase !== 'launch') return; flash.classList.remove('on'); if (room === null) { const at = STATIONS[visit.zone].station; frame.position.set(at[0], 0, at[1]); } else frame.position.set(0, 0, 0); visit.glide = null; visit.phase = 'hall'; keysBar.hidden = groupsBar.hidden = false; paint(); });
function start() { visit.phase = 'hall'; startCard.hidden = true; keysBar.hidden = groupsBar.hidden = false; mark(); banner(ZONES[visit.zone]); paint(); }
function paint() {
  const p = portals[visit.aim];
  if (visit.phase !== 'hall' || !p?.game) { target.hidden = true; $('kGo').disabled = true; canvas.classList.remove('aim'); return; }
  target.hidden = false; $('kGo').disabled = false; target.style.setProperty('--tint', p.game.color);
  $('tTitle').textContent = p.game.title; $('tSub').textContent = p.game.sub; $('tSub').hidden = !p.game.sub;
  $('kGo').textContent = p.door ? 'Go' : 'Play';
  $('tDo').textContent = p.door ? (p.game.exit ? (touch ? 'Tap the ring to go back' : 'Click the ring or press Enter to go back') : touch ? 'Tap the ring to go in' : 'Click the ring or press Enter to go in') : touch ? 'Tap the screen to play' : 'Click the screen or press Enter to play';
}

/* ---------------- looking and walking ---------------- */
// visit.yaw is a compass heading: 0 looks along -z and a quarter turn looks along +x.
const eye = new THREE.Vector3(), dir = new THREE.Vector3(), ndc = new THREE.Vector3();
function lookRay(clientX, clientY) {
  camera.updateMatrixWorld(true); camera.getWorldPosition(eye);
  ndc.set(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1, 0.5).unproject(camera); dir.copy(ndc).sub(eye).normalize();
  return [{ x: eye.x, y: eye.y, z: eye.z }, { x: dir.x, y: dir.y, z: dir.z }];
}
const portalAt = (x, y) => visit.phase === 'hall' ? pick(...lookRay(x, y), PLACES, lit(), touch ? 1.35 : 1.08) : -1;
// The machines and rings as the visitor sees them from where they stand: each with its heading, its distance over the
// floor and the look angle up to it.
const seen = () => PLACES.map(p => { const dx = p.centre[0] - frame.position.x, dz = p.centre[2] - frame.position.z, distance = Math.hypot(dx, dz); return { ...p, heading: Math.atan2(dx, -dz), distance, pitch: Math.atan2(p.centre[1] - HALL.eye, distance) }; });
// The arrows start from the place in view, so one press moves on to the next place. In the hall they stop at machines
// only: a ring hangs right over its machines, and the Room button and the R key open the room of the zone.
function turn(step) { if (visit.phase !== 'hall' || visit.glide) return; const now = seen(), stops = lit().map((on, k) => on && !(room === null && portals[k].door)), i = neighbour(visit.turnTo ?? (visit.aim >= 0 ? now[visit.aim].heading : visit.yaw), now, stops, step, REACH); if (i >= 0) { visit.turnTo = now[i].heading; visit.pitchTo = now[i].pitch; visit.aimTo = i; } }
const keys = new Set();
const ease = t => t * t * (3 - 2 * t);
function step(dt) {
  // A screen comes on with a quick flicker, and goes dark the same way.
  for (const p of portals) { if (p.lit !== p.wantLit) p.lit = reduced ? p.wantLit : clamp(p.lit + Math.sign(p.wantLit - p.lit) * dt / 0.35, 0, 1); const flicker = reduced || p.lit >= 1 || p.lit <= 0 ? 1 : 0.6 + 0.4 * Math.sin(p.lit * 40 + p.uniforms.uSeed.value * 9); p.uniforms.uLit.value = p.lit * flicker; }
  if (visit.phase === 'title') return;
  const g = visit.glide;
  if (g && g.portal) {
    const c = g.portal.place.centre, far = Math.hypot(c[0] - g.from.x, c[2] - g.from.z); g.t = Math.min(1, g.t + dt / 0.8); const k = g.t * g.t * 0.82;
    frame.position.set(g.from.x + (c[0] - g.from.x) * k, 0, g.from.z + (c[2] - g.from.z) * k);
    visit.yaw += wrap(Math.atan2(c[0] - g.from.x, -(c[2] - g.from.z)) - visit.yaw) * Math.min(1, dt * 8); visit.pitch += (Math.atan2(c[1] - HALL.eye, far) - visit.pitch) * Math.min(1, dt * 8);
    return;
  }
  if (g) {
    g.t = Math.min(1, g.t + dt / g.time); const k = ease(g.t);
    frame.position.set(g.from.x + (g.to.x - g.from.x) * k, 0, g.from.z + (g.to.z - g.from.z) * k);
    visit.yaw = wrap(g.fromYaw + wrap(g.yaw - g.fromYaw) * k); visit.pitch = g.fromPitch * (1 - k);
    if (room === null) enter(zoneAt(frame.position, STATIONS));
    if (g.t >= 1) { visit.glide = null; visit.phase = 'hall'; enter(g.zone); visit.aim = -1; }
    return;
  }
  // ◀ and ▶ turn the view to the next lit place.
  if (visit.turnTo !== null) { const off = wrap(visit.turnTo - visit.yaw); if (reduced || Math.abs(off) < 0.004) { visit.yaw = visit.turnTo; visit.pitch = reduced ? visit.pitchTo : visit.pitch; visit.turnTo = null; } else visit.yaw = wrap(visit.yaw + off * Math.min(1, dt * 9)); visit.pitch += (visit.pitchTo - visit.pitch) * Math.min(1, dt * 7); }
  // W A S D walk the open floor of the hall.
  let ahead = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0), side = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0); const length = Math.hypot(ahead, side);
  if (length > 0) { ahead /= length; side /= length; const a = visit.yaw, speed = (room !== null ? 1.3 : 2.2) * dt, step2 = { x: frame.position.x + (Math.sin(a) * ahead + Math.cos(a) * side) * speed, z: frame.position.z + (-Math.cos(a) * ahead + Math.sin(a) * side) * speed }, to = room !== null ? walkRoom(step2, HALL.reach) : walk(step2, HALL.bounds); frame.position.x = to.x; frame.position.z = to.z; if (room === null) enter(zoneAt(frame.position, STATIONS)); }
  // The lit place in the middle of the view is named on screen. A ring is high on the wall, so it counts only when
  // the visitor looks up at it.
  const now = seen(), mask = lit().map((on, i) => on && Math.abs(now[i].pitch - visit.pitch) < 0.32);
  const aim = facing(visit.yaw, now, mask, 0.3, REACH); if (aim !== visit.aim) { visit.aim = aim; paint(); }
}

/* ---------------- input ---------------- */
let drag = null, hover = -1;   // hover: the place under the mouse pointer
canvas.addEventListener('pointerdown', e => { if (visit.phase !== 'hall') return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, at: performance.now(), moved: 0 }; try { canvas.setPointerCapture(e.pointerId); } catch (error) { /* the drag still works inside the canvas */ } canvas.classList.add('look'); });
canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) { if (e.pointerType === 'mouse') { hover = portalAt(e.clientX, e.clientY); canvas.classList.toggle('aim', hover >= 0); } return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (visit.glide || drag.moved < 6) return;
  // The view follows the finger: a drag to the right turns the visitor to the left, and a drag down looks up.
  const k = (camera.fov * Math.PI / 180) / innerHeight * 1.15; visit.turnTo = null; visit.yaw = wrap(visit.yaw - dx * k); visit.pitch = clamp(visit.pitch + dy * k, -1.1, 1.1);
});
const lift = e => { if (!drag || e.pointerId !== drag.id) return; const tap = drag.moved < 10 && performance.now() - drag.at < 500, d = drag; drag = null; canvas.classList.remove('look'); if (tap && e.type === 'pointerup') { const i = portalAt(d.sx, d.sy); if (i >= 0) launch(i); } };
canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift); canvas.addEventListener('pointerleave', () => { hover = -1; });
const nextZone = step => travel((visit.zone + step + ZONES.length) % ZONES.length);
addEventListener('keydown', e => {
  if (visit.phase !== 'hall' || window.GameSwitch?.isOpen) return; const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); turn(k === 'arrowright' ? 1 : -1); }
  else if (k === 'arrowup' || k === 'arrowdown') { e.preventDefault(); nextZone(k === 'arrowdown' ? 1 : -1); }
  else if (k >= '1' && k <= String(ZONES.length)) travel(+k - 1);
  else if (k === 'pagedown' || k === 'm') { if (!$('kMore').hidden) { e.preventDefault(); setPage(visit.page[visit.zone] + 1); } }
  else if (k === 'r') { if (room === null) goRoom(visit.zone); }
  else if (k === 'escape' || k === 'backspace') { if (room !== null) { e.preventDefault(); goHall(); } }
  else if (k === 'enter' || k === ' ') { if (e.target instanceof HTMLButtonElement) return; e.preventDefault(); if (!e.repeat && visit.aim >= 0) launch(visit.aim); }
  else if (['w', 'a', 's', 'd'].includes(k)) keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); addEventListener('blur', () => keys.clear());
$('kBack').addEventListener('click', goHall); $('kRoom').addEventListener('click', () => goRoom(visit.zone)); $('kPrev').addEventListener('click', () => turn(-1)); $('kNext').addEventListener('click', () => turn(1));
$('kGo').addEventListener('click', () => { if (visit.aim >= 0) launch(visit.aim); }); $('kMore').addEventListener('click', () => setPage(visit.page[visit.zone] + 1));
ZONES.forEach((z, i) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.zone = z.id; b.textContent = z.label; b.style.setProperty('--tint', z.color); b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => travel(i)); groupsBar.append(b); });
go.addEventListener('click', start);

/* ---------------- the loop ---------------- */
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (!window.GameSwitch?.isOpen && !document.hidden) step(dt);
  camera.rotation.set(visit.pitch, -visit.yaw, 0);
  const time = reduced ? 0 : now / 1000;
  for (const m of air) m.material.uniforms.uTime.value = time;
  portals.forEach((p, i) => { p.uniforms.uTime.value = time; p.uniforms.uHot.value += ((i === visit.aim ? 1 : 0) - p.uniforms.uHot.value) * Math.min(1, dt * 10); p.uniforms.uFlow.value += ((!reduced && (i === hover || (touch && i === visit.aim)) ? 1 : 0) - p.uniforms.uFlow.value) * Math.min(1, dt * 5); p.label.material.opacity = p.lit * (p.door ? 0.75 + 0.25 * p.uniforms.uHot.value : p.uniforms.uHot.value); });
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* ---------------- start up ---------------- */
// The places load first: every machine and ring is set up, each machine gets its game, and motes go into the air of
// each zone. Then the world loads, with a line that shows the progress.
const ready = () => { loadLine.hidden = true; go.disabled = false; go.textContent = 'Enter the hall'; go.focus({ preventScroll: true }); };
fetch('./worlds/hall/screens.json').then(r => { if (!r.ok) throw new Error('screens.json missing'); return r.json(); }).then(data => {
  HALLDATA = data; buildHall();
  const at = query.get('zone') ? STATIONS[Math.max(0, ZONES.findIndex(z => z.id === query.get('zone')))] : null;
  frame.position.set(at ? at.station[0] : HALL.start.x, 0, at ? at.station[1] : HALL.start.z); visit.yaw = at ? at.facing : HALL.start.facing; visit.zone = zoneAt(frame.position, STATIONS); mark();
  document.documentElement.style.setProperty('--zone', ZONES[visit.zone].color);
  if (noWorld) return ready();
  return loadHall(p => { loadLine.textContent = `Loading the hall… ${Math.round(p * 100)}%`; }).then(ready);
}).catch(error => { console.error(error); noGraphics('The hall did not load.'); });
requestAnimationFrame(tick);

// A handle for the browser check (qa/lab/riftwalk.e2e.mjs). The page never reads it.
window.__riftwalk = {
  state: () => ({ phase: visit.phase, room: room === null ? null : ZONES[room].id, zone: ZONES[visit.zone].id, page: visit.page[visit.zone], pages: pagesIn(visit.zone), aim: visit.aim, yaw: visit.yaw, pitch: visit.pitch, turning: visit.turnTo !== null, gliding: !!visit.glide, place: { x: frame.position.x, z: frame.position.z }, hall: !!hall, splats: hall?.packedSplats?.numSplats ?? 0,
    hover, flow: portals.map(p => +p.uniforms.uFlow.value.toFixed(2)),
    motes: air.reduce((n, m) => n + m.geometry.attributes.position.count, 0),
    machines: portals.slice(0, SCREENS.length).map(p => ({ zone: p.zone.id, game: p.game?.id ?? null, title: p.game?.title ?? null, url: p.game?.url ?? null, lit: p.lit, art: p.uniforms.uHasMap.value === 1 })),
    rings: portals.slice(SCREENS.length).map(p => ({ to: p.game.exit ? 'hall' : ZONES[p.game.zone].id, title: p.game.title, lit: p.lit, art: p.uniforms.uHasMap.value === 1 })) }),
  // Where a place's centre is on the page (the machines first, then the six rings), or null when it is behind the view.
  screen: i => { const p = portals[i]; if (!p) return null; camera.updateMatrixWorld(true); ndc.set(...p.place.centre).project(camera); return ndc.z > 1 ? null : { x: (ndc.x + 1) / 2 * innerWidth, y: (1 - ndc.y) / 2 * innerHeight }; },
  // Turn at once to a place (a machine, or a ring after the machines), as the visitor sees it from where they stand.
  face: i => { const p = seen()[i]; if (!p) return; visit.turnTo = null; visit.yaw = p.heading; visit.pitch = p.pitch; camera.rotation.set(visit.pitch, -visit.yaw, 0); camera.updateMatrixWorld(true); },
  look: heading => { visit.turnTo = null; visit.yaw = wrap(heading); visit.pitch = 0; camera.rotation.set(visit.pitch, -visit.yaw, 0); camera.updateMatrixWorld(true); },
};
