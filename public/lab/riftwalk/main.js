// Riftwalk: the page. The hall is one Gaussian splat world, a dark neon arcade made with World Labs Atlas and drawn by
// Spark. Arcade cabinets stand in clusters against its walls, one zone of clusters for each collection of the arcade.
// Each cabinet's screen is a portal to one game: the game's art inside a live edge of light. A rift ring hangs above
// each zone. A ring opens into that zone's own room: a smaller world, made earlier with Marble, with machines for the
// zone's games and a ring that leads back to the hall.
// hall.js holds the rules, and worlds/hall/screens.json says where the screens, the stations and the rings are.
import * as THREE from 'three';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import * as sound from './sound.js';
import { direction, GROUPS, ZONES, GROW, gamesOf, zoneGames, seats, pages, assign, ringPlace, roomSeats, exitRing, frameRing, walkRoom, zoneAt, headingTo, pick, facing, neighbour, walk } from './hall.js';

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
function noGraphics(why) { document.getElementById('loading')?.classList.add('done'); startCard.hidden = true; loadLine.hidden = true; groupsBar.hidden = keysBar.hidden = target.hidden = true; list.classList.add('shown'); const p = document.createElement('p'); p.textContent = why + ' Here is every game as a link.'; list.prepend(p); }

/* ---------------- the scene ---------------- */
// Resolution: the view draws at two device pixels for each CSS pixel where the graphics card keeps up. On a display
// with one device pixel that is a 2 by 2 supersample, which is the largest gain in detail for a splat world. The
// frame loop lowers the ratio a step at a time when frames are slow. Spark's guide says multisampling does nothing
// for splats and costs speed, so it is off; the portals smooth their own edges.
// For the browser check: ?capture keeps the drawn frame readable, ?px=1 sets the pixel ratio (and holds it), ?world=none draws the
// portals with no hall (software WebGL draws a splat world at a frame in seconds), and ?q=150k, 500k or full picks a
// hall file.
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: query.has('capture') }); if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2'); }
catch (e) { noGraphics('Riftwalk needs WebGL2 graphics, and this browser has none to give.'); throw e; }
const PX = { fixed: +query.get('px') || 0, least: Math.min(devicePixelRatio || 1, 1), slow: 0, frames: 0 }; PX.now = PX.fixed || (touch ? Math.min(devicePixelRatio || 1, 2) : 2);
renderer.setPixelRatio(PX.now);
renderer.setClearColor('#06040c');
const scene = new THREE.Scene(), frame = new THREE.Group(), camera = new THREE.PerspectiveCamera(62, 1, 0.05, 30000);   // far: the open worlds have sky and hills kilometres away
camera.rotation.order = 'YXZ'; frame.add(camera); scene.add(frame);
// focalAdjustment 2 sharpens the splats (Spark's guide: the value that matches PlayCanvas). ?focal=1 is Spark's default.
const spark = new SparkRenderer({ renderer, focalAdjustment: +query.get('focal') || 2 }); scene.add(spark);
const moteScale = { value: 1 };   // pixels for a mote one metre wide at one metre: set with the view's size
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 78 : 62; camera.updateProjectionMatrix(); moteScale.value = h * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360)); }
addEventListener('resize', resize); resize();

/* ---------------- the hall ---------------- */
// worlds/hall/screens.json carries the hall's numbers: the eye height, the box of open floor the visitor walks in,
// where the visitor starts, and the world's file. ?world=none draws the portals with no world, for the browser check.
let HALL = { scale: 1, eye: 1.45, bounds: { x: [-2, 2], z: [-2, 2] }, start: { x: 0, z: 0, facing: 0 } }, SCREENS = [], PLACES = [], STATIONS = [], hall = null;
const noWorld = query.get('world') === 'none';
// The alley loads in two steps. The first file is small (220,000 splats, 3 MB): the visitor can enter as soon as it
// is drawn. Then the whole alley loads behind them and takes the small one's place: the full file on a desktop, the
// 1,000,000-splat file on a touch device (?q=full asks for the whole file there too, ?q=first keeps the small one).
async function fetchWorld(file, onProgress) {
  const response = await fetch('./worlds/hall/' + file); if (!response.ok) throw new Error('World file missing: ' + file);
  const total = +response.headers.get('content-length') || 0, reader = response.body.getReader(), parts = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; if (onProgress && total) onProgress(got / total); }
  const bytes = new Uint8Array(got); let at = 0; for (const p of parts) { bytes.set(p, at); at += p.length; }
  const mesh = new SplatMesh({ fileBytes: bytes }); await mesh.initialized;
  if (HALL_WORLD.flip) mesh.quaternion.set(1, 0, 0, 0); mesh.scale.setScalar(HALL_WORLD.scale); if (HALL_WORLD.offset) mesh.position.set(...HALL_WORLD.offset);
  return mesh;
}
let HALL_WORLD = null;   // the alley's own numbers, kept while the visitor is in a room
async function loadHall(onProgress) {
  HALL_WORLD = HALL; const first = HALL.fileFirst && query.get('q') !== 'full' ? HALL.fileFirst : HALL.file;
  const mesh = await fetchWorld(first, onProgress); hallMesh = hall = mesh; scene.add(mesh);
  const whole = query.get('q') === 'first' ? first : touch && HALL.fileTouch && query.get('q') !== 'full' ? HALL.fileTouch : HALL.file;
  if (whole !== first) sharpenHall(whole);
  return mesh;
}
// The whole alley takes the place of the small one, where the visitor stands or behind the door of a world.
function sharpenHall(file) {
  const line = $('sharp'); line.hidden = false; line.textContent = 'Sharpening the alley…';
  fetchWorld(file, p => { line.textContent = `Sharpening the alley… ${Math.round(p * 100)}%`; }).then(mesh => {
    const old = hallMesh; hallMesh = mesh; if (hall === old) { scene.remove(old); scene.add(mesh); hall = mesh; } old.dispose?.(); line.hidden = true;
  }).catch(error => { console.error(error); line.hidden = true; /* the small alley stays */ });
}
// The rooms: one small Marble world for each zone, loaded when the visitor first goes in. A Marble .spz has y down,
// so the mesh turns half a turn about x; the room's screens.json gives its scale and the eye height.
const backLink = document.querySelector('.labbar .back');   // the top-left link: Lab in the alley, Alley inside a world
const ROOMS = {}; let hallMesh = null, HALLDATA = null, room = null, RINGS = [];   // RINGS: the zones that have a room, in the order of their rings   // room: the index of the zone whose room the visitor is in, or null in the hall
const roomData = id => ROOMS[id] ? Promise.resolve(ROOMS[id]) : fetch(`./worlds/rooms/${id}/screens.json`).then(r => { if (!r.ok) throw new Error('Room missing: ' + id); return r.json(); }).then(d => (ROOMS[id] = d));
async function loadRoom(id, quality) {
  const response = await fetch(`./worlds/rooms/${id}/${quality}.spz`); if (!response.ok) throw new Error('Room file missing: ' + id);
  const mesh = new SplatMesh({ fileBytes: new Uint8Array(await response.arrayBuffer()) }); await mesh.initialized;
  // An API world has y down and turns half a turn about x. An app export has y up, and turns about y so the visitor faces its best view.
  const h = ROOMS[id].hall; if (h.flip === false) mesh.rotation.y = h.turn || 0; else mesh.quaternion.set(1, 0, 0, 0); mesh.scale.setScalar(h.scale); mesh.position.set(0, h.ground, 0); return mesh;
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
  uniform float uLit; uniform float uTime; uniform float uHot; uniform float uFlow; uniform float uSeed; uniform float uRadius; uniform float uWave; uniform float uScan; uniform float uDoor; uniform float uBox; uniform vec2 uPoint; uniform float uTouch;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  // Under 0 inside the shape. A screen is a box with round corners. A rift ring is a disc. A storefront door is an
  // upright oval: the distance is the scaled-circle estimate, which is close enough near the rim.
  float shape(vec2 p) {
    if (uDoor > 0.5 && uBox < 0.5) return length(p) - uHalf.x;
    if (uBox > 0.5) return (length(p / uHalf) - 1.0) * min(uHalf.x, uHalf.y);
    vec2 q = abs(p) - uHalf + uRadius; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  }
  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * uQuad;                       // metres from the centre
    float d = shape(p);
    float turn = atan(p.y / uHalf.y, p.x / uHalf.x); vec2 c = vec2(cos(turn), sin(turn));   // the way round the rim, with no seam
    float n = noise(c * 2.3 + vec2(uTime * 0.55 + uSeed, uSeed)) * 0.6 + noise(c * 6.0 - vec2(uSeed, uTime * 0.9)) * 0.4;
    float edge = d - (n - 0.5) * uWave;                       // the rim wavers
    // A storefront door has a riptide rim: two trains of waves run round it in opposite ways, over the slow noise.
    if (uBox > 0.5) edge -= 0.034 * sin(turn * 6.0 - uTime * 2.1 + uSeed * 6.283) + 0.02 * sin(turn * 11.0 + uTime * 3.0 + n * 3.0) + (n - 0.5) * 0.07;
    // Where the mouse pointer touches the rim of a door, the rift gives way: the opening reaches out about 30 cm round
    // the pointer and shows more of the scene beyond. uPoint is the pointer on the door's plane, in metres.
    float reach = uTouch * 0.32 * exp(-dot(p - uPoint, p - uPoint) / 0.2); edge -= reach;
    // A door or a ring has no hard rim. Its picture fades out over about 30 cm, and noise at two sizes makes the fade
    // ragged, like mist, so the world behind it seems to seep into the street. A screen or a frame keeps a crisp rim.
    float mist = (noise(p * 6.0 + vec2(uTime * 0.22, uSeed * 9.0)) - 0.5) * 0.2 + (noise(p * 15.0 - vec2(uSeed * 4.0, uTime * 0.31)) - 0.5) * 0.09;
    float soft = edge + mist * uDoor, feather = mix(0.003, 0.15, uDoor);
    float inside = smoothstep(feather, -feather * 1.3, soft), rim = smoothstep(-0.07, 0.0, d - reach);
    // The picture covers the shape: the longer side of the picture is cropped.
    // A door shows the middle four fifths of its picture, so the rest is there to see when the rift gives way. The
    // picture also slides a little against the pointer, like a look round the rim.
    vec2 uv = p / uHalf * 0.5 * mix(1.0, 0.8, uDoor) - uPoint / uHalf * 0.035 * uTouch * uDoor; float form = uHalf.x / uHalf.y; if (uAspect > form) uv.x *= form / uAspect; else uv.y *= uAspect / form; uv += 0.5;
    // Under the pointer the picture flows: it swells a little, drifts, and its surface moves like slow water.
    vec2 fl = vec2(noise(uv * 3.0 + vec2(uTime * 0.35, uSeed * 7.0)), noise(uv * 3.0 + vec2(uSeed * 3.0, -uTime * 0.3))) - 0.5;
    fl += 0.5 * (vec2(noise(uv * 7.0 - vec2(uTime * 0.5, 2.0)), noise(uv * 7.0 + vec2(5.0, uTime * 0.45))) - 0.5);
    uv = (uv - 0.5) * (1.0 - 0.07 * uFlow) + 0.5 + fl * 0.06 * uFlow + vec2(sin(uTime * 0.4 + uSeed * 6.0), cos(uTime * 0.33)) * 0.012 * uFlow;
    // In a storefront door, rings of water run from the rim toward the middle and bend the picture near the rim.
    float rr = length(p / uHalf), tide = sin(rr * 30.0 + uTime * 2.6 + n * 4.0) * smoothstep(0.45, 1.0, rr) * uBox;
    uv += normalize(p + 1e-4) * 0.014 * tide;
    vec3 pic = mix(uColor * 0.35, texture2D(uMap, uv).rgb, uHasMap) * (1.0 + 0.12 * uFlow);
    // A game shows as a picture on the machine's own tube: scan lines, darker corners, and a faint shine on the glass.
    float lines = 1.0 - uScan * 0.15 * (0.5 + 0.5 * sin(p.y * 820.0));
    float shine = 0.045 * smoothstep(0.22, 0.0, abs(p.x / uHalf.x * 0.6 + p.y / uHalf.y - 0.55));
    vec3 art = pic * lines * (1.0 - 0.38 * rim) * (0.9 + 0.1 * uHot) + shine;
    // A door shows its zone through a slow swirl of that zone's light, thicker toward the rim.
    if (uDoor > 0.5) { float r = length(p / uHalf); float swirl = noise(c * 1.6 + vec2(r * 3.0 - uTime * 0.45, uSeed)) * 0.6 + noise(c * 4.0 + vec2(uSeed, r * 5.0 + uTime * 0.3)) * 0.4; art = mix(uColor * (0.10 + 0.5 * swirl * swirl) * (0.35 + 0.65 * smoothstep(0.0, 1.0, r)) + vec3(0.02, 0.01, 0.04), pic * (0.6 + 0.3 * swirl) * (1.0 - 0.5 * rim) + uColor * 0.45 * rim * swirl, uHasMap);
      // Stars in the door: a few points of light that come and go.
      vec2 cell = floor(p * 26.0), in2 = fract(p * 26.0) - 0.5; float star = step(0.9, hash(cell + uSeed)) * smoothstep(0.22, 0.0, length(in2)) * pow(0.5 + 0.5 * sin(uTime * (1.5 + 3.0 * hash(cell)) + hash(cell + 3.0) * 6.283), 3.0); art += mix(uColor, vec3(1.0), 0.6) * star * 1.4;
      art += mix(uColor, vec3(1.0), 0.35) * 0.3 * pow(max(tide, 0.0), 3.0); }   // the crests of the rings catch the light
    else { float glint = exp(-pow((p.x / uHalf.x * 0.7 + p.y / uHalf.y * 0.5 + 1.6 - mod(uTime * 0.55 + uSeed * 5.0, 3.2) * 1.0) / 0.12, 2.0)); art += mix(uColor, vec3(1.0), 0.5) * glint * 0.2 * uHot; }   // a glint crosses the screen in view
    // A machine with no game idles in its zone's colour: a dim tube with a slow bright bar that rolls down it.
    float bar = exp(-pow((fract(p.y / (uHalf.y * 2.0) + uTime * 0.06 + uSeed) - 0.5) / 0.07, 2.0));
    vec3 idle = (uZone * (0.07 + 0.05 * n + 0.14 * bar) + 0.012) * lines * (1.0 - 0.5 * rim);
    vec3 face = mix(idle, art, uLit);
    float pulse = pow(0.5 + 0.5 * cos(turn - uTime * 1.7 - uSeed * 6.283), 10.0);
    // The live edge: a thin bright line on a screen or a frame. On a door it is a wide, faint glow in the mist.
    float line = mix(0.006, 0.075, uDoor), halo = mix(0.02, 0.2, uDoor);
    float band = exp(-pow(soft / line, 2.0)) * (0.75 + 0.5 * uHot + 0.8 * pulse) * mix(1.0, 0.3, uDoor) + mix(0.24, 0.2, uDoor) * exp(-pow(max(soft, 0.0) / halo, 2.0)) * (0.5 + n) * (1.0 - inside);
    // Foam outside a storefront door: a second, fainter line that the waves push out and pull back.
    band += uBox * 0.13 * exp(-pow((soft - 0.07 - 0.03 * sin(turn * 9.0 - uTime * 2.4)) / 0.045, 2.0)) * (0.4 + n);
    band *= mix(0.2, 1.0, uLit);
    vec3 glow = mix(mix(uZone, uColor, uLit), vec3(1.0), (0.5 * exp(-pow(edge / 0.003, 2.0)) + 0.3 * pulse) * (1.0 - 0.8 * uDoor));
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
// A storefront's name is its shop sign: a dark board over the door with a neon tube round it and the name in lit
// letters of the zone's colour, in the zone's own lettering.
function signTexture(title, color, font = LOOKS.action.font) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
  const box = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  box(26, 26, 972, 204, 26); g.fillStyle = 'rgba(8, 6, 16, 0.86)'; g.fill();
  g.shadowColor = color; g.shadowBlur = 26; g.lineWidth = 7; g.strokeStyle = color; box(26, 26, 972, 204, 26); g.stroke(); g.stroke();
  g.shadowBlur = 0; g.lineWidth = 2.5; g.strokeStyle = 'rgba(255, 255, 255, 0.85)'; box(26, 26, 972, 204, 26); g.stroke();
  const name = title.toUpperCase(); let size = 132; const sized = () => font.replace(/\d+px/, size + 'px'); g.font = sized(); try { g.letterSpacing = '6px'; } catch (e) { /* an older browser sets the letters closer */ }
  while (size > 44 && g.measureText(name).width > 880) { size -= 4; g.font = sized(); }
  g.shadowColor = color; g.shadowBlur = 34; g.fillStyle = color; g.fillText(name, 512, 134); g.fillText(name, 512, 134);
  g.shadowBlur = 8; g.fillStyle = 'rgba(255, 255, 255, 0.92)'; g.fillText(name, 512, 134);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
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
  const group = new THREE.Group(), half = new THREE.Vector2(place.width / 2 * GROW, place.height / 2 * GROW), size = new THREE.Vector2(half.x + MARGIN * (place.ring ? 12 : 1), half.y + MARGIN * (place.ring ? 12 : 1));   // room for a door's mist outside its rim
  const uniforms = { uMap: { value: null }, uHasMap: { value: 0 }, uAspect: { value: 1 }, uColor: { value: new THREE.Color('#5ff2ff') }, uHalf: { value: half }, uQuad: { value: size }, uLit: { value: 0 }, uTime: { value: 0 }, uHot: { value: 0 }, uSeed: { value: (index * 0.618) % 1 }, uFlow: { value: 0 }, uZone: { value: new THREE.Color(zone.color) }, uRadius: { value: look.radius }, uWave: { value: place.ring ? 0.03 : look.wave }, uScan: { value: look.scan }, uDoor: { value: place.ring ? 1 : 0 }, uPoint: { value: new THREE.Vector2() }, uTouch: { value: 0 }, uBox: { value: place.box ? 1 : 0 } };
  const face = new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, ...flat, premultipliedAlpha: true }));
  face.scale.set(size.x, size.y, 1); face.renderOrder = 16; face.frustumCulled = false; group.add(face);
  const label = new THREE.Mesh(labelGeometry, new THREE.MeshBasicMaterial({ ...flat, opacity: 0 })); label.renderOrder = 20; label.frustumCulled = false; label.visible = false;
  // A storefront door carries a shop sign: a board 4 to 1, wider than the door, over the mist at the door's top.
  if (place.box) { const width = place.width * 1.3; label.scale.set(width, width / 4, 1); label.position.set(0, half.y + 0.2 + width / 8, 0.03); }
  else { const width = Math.max(place.width * 1.5, 0.5); label.scale.set(width, width / 6, 1); label.position.set(0, half.y + MARGIN * 0.4 + width / 12, 0.01); }
  group.add(label);
  // The quad's own axes are the screen's: x along its width, y up it, z out of the glass.
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...place.right), new THREE.Vector3(...place.up), new THREE.Vector3(...place.normal));
  group.quaternion.setFromRotationMatrix(m); group.position.set(...place.centre); scene.add(group);
  return { place, group, uniforms, face, label, look, zone, door: !!place.ring, frame: !!place.frame, base: place.centre[1], game: null, lit: 0, wantLit: 0, touch: 0 };
}
let portals = [];
// Live windows (desktop): the door in the middle of the view, from 7 m or nearer, shows its world as it is, in three
// dimensions, in place of the still picture. The world's small file (150,000 splats) is drawn by a second Spark
// renderer into a texture, from a camera that moves as the visitor moves, so the view through the door shifts like a
// view through a real opening. Spark's SparkRenderer takes a `target` for this and renderTarget() returns it
// (sparkjs.dev/docs/spark-renderer). A phone keeps the still picture, and so does ?live=0 and a page whose frames are slow.
const LIVE = { on: !touch && !noWorld && query.get('live') !== '0', zone: -1, loading: -1, mesh: null, scene: null, spark: null, cam: null, portal: null, still: null, aspect: 1, meshes: new Map(), sorting: false };
function endLive() { const v = LIVE; if (!v.portal) return; if (v.portal.uniforms.uMap.value !== v.still && v.still) { v.portal.uniforms.uMap.value = v.still; v.portal.uniforms.uAspect.value = v.aspect; } v.portal = v.still = null; }
function stepLive() {
  const v = LIVE; if (!v.on) return; const p = portals[visit.aim], near = room === null && visit.phase === 'hall' && p?.door && p.game && !p.game.exit && p.uniforms.uHasMap.value === 1;
  if (!near) return endLive(); const c = p.place.centre, n = p.place.normal, r = p.place.right, dx = frame.position.x - c[0], dz = frame.position.z - c[2], out = dx * n[0] + dz * n[2], side = dx * r[0] + dz * r[2];
  if (out < 0.2 || Math.hypot(dx, dz) > 7) return endLive(); const index = p.game.zone, id = ZONES[index].id;
  if (!v.scene) { v.scene = new THREE.Scene(); v.spark = new SparkRenderer({ renderer, target: { width: 512, height: 664 }, focalAdjustment: 2 }); v.scene.add(v.spark); v.cam = new THREE.PerspectiveCamera(74, 512 / 664, 0.05, 30000); v.cam.rotation.order = 'YXZ'; v.scene.add(v.cam); }
  if (v.zone !== index) {
    if (v.portal) endLive(); const have = v.meshes.get(index);
    if (have) { if (v.mesh) v.scene.remove(v.mesh); v.mesh = have; v.scene.add(have); v.zone = index; }
    else { if (v.loading !== index) { v.loading = index; roomData(id).then(() => loadRoom(id, '150k')).then(mesh => { v.meshes.set(index, mesh); if (v.loading === index) v.loading = -1; }).catch(() => { v.on = false; }); } return; }
  }
  // The camera stands in the world where the visitor stands in front of the door, at a third of the distance, and
  // turns a little toward the middle of the world, so a step to the side shows the other side of the scene.
  const eye = ROOMS[id].hall.eye ?? ROOMS[id].hall.ground; v.cam.position.set(side * 0.35, eye, Math.max(0, out - 1) * 0.3); v.cam.rotation.set(0, Math.atan2(side * 0.35, 6), 0); v.cam.updateMatrixWorld(true);
  if (!v.sorting) { v.sorting = true; v.spark.update({ scene: v.scene, camera: v.cam }).catch(() => {}).then(() => { v.sorting = false; }); }
  const target = v.spark.renderTarget({ scene: v.scene, camera: v.cam });
  if (v.portal !== p) { v.portal = p; v.still = p.uniforms.uMap.value; v.aspect = p.uniforms.uAspect.value; }
  p.uniforms.uMap.value = target.texture; p.uniforms.uAspect.value = 512 / 664;
}
// Game previews: a few games have a short silent clip. The frame in the middle of the view plays its game's clip
// in place of the still picture, after a short look, and goes back to the picture when the view moves on. A browser
// that cannot play the clip keeps the picture. Reduced motion keeps the picture too.
const PREVIEWS = { '/river-rush/': '/river-rush/art/river-portrait-flow.mp4', '/crimson/': '/crimson/clips/yield.mp4', '/fish/': '/fish/clips/pull-back-demo.mp4', '/fall/': '/fall/clips/roll.webm', '/plungerd/': '/plungerd/clips/sprint.webm' };
const preview = { portal: null, video: null, texture: null, since: 0, still: null, aspect: 1 };
function endPreview() {
  const v = preview; if (!v.portal) return;
  if (v.texture) { if (v.portal.uniforms.uMap.value === v.texture) { v.portal.uniforms.uMap.value = v.still; v.portal.uniforms.uAspect.value = v.aspect; v.portal.uniforms.uHasMap.value = v.still ? 1 : 0; } v.texture.dispose(); }
  if (v.video) { v.video.pause(); v.video.removeAttribute('src'); v.video.load(); }
  v.portal = v.video = v.texture = v.still = null;
}
function stepPreview(now) {
  const p = portals[visit.aim], clip = !reduced && visit.phase === 'hall' && p?.frame && p.game ? PREVIEWS[p.game.url] : null;
  if (preview.portal && (preview.portal !== p || !clip)) endPreview();
  if (!clip || preview.portal === p) { if (!clip) preview.since = 0; return; }
  if (!preview.since) { preview.since = now; return; } if (now - preview.since < 700) return;
  const video = document.createElement('video'); video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto'; video.src = clip;
  preview.portal = p; preview.video = video; preview.since = 0; preview.still = p.uniforms.uMap.value; preview.aspect = p.uniforms.uAspect.value;
  video.addEventListener('playing', () => {
    if (preview.video !== video) return; const t = new THREE.VideoTexture(video); t.colorSpace = THREE.SRGBColorSpace; preview.texture = t;
    p.uniforms.uMap.value = t; p.uniforms.uAspect.value = (video.videoWidth || 1) / (video.videoHeight || 1); p.uniforms.uHasMap.value = 1;
  }, { once: true });
  video.addEventListener('error', () => { if (preview.video === video) endPreview(); });
  video.play().catch(() => { if (preview.video === video) endPreview(); });
}
function show(portal, game) {
  portal.game = game; portal.wantLit = game ? 1 : 0;
  if (portal.label.material.map) { portal.label.material.map.dispose(); portal.label.material.map = null; }
  portal.label.visible = !!game; portal.uniforms.uHasMap.value = 0;
  if (!game) return;
  portal.uniforms.uColor.value.set(game.color); portal.label.material.map = (portal.place.box ? signTexture : labelTexture)(game.title, game.color, portal.look.font); portal.label.material.needsUpdate = true;
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
  $('kBack').hidden = room === null; $('kRoom').hidden = room !== null || !STATIONS[visit.zone]?.room; $('kRoom').textContent = 'Go in'; $('kRoom').setAttribute('aria-label', 'Go into ' + ZONES[visit.zone].label); $('kMore').hidden = count < 2; $('kMore').textContent = `More ${visit.page[visit.zone] + 1}/${count}`;
}
function enter(index) { if (room !== null || index === visit.zone) return; visit.zone = index; mark(); banner(ZONES[index]); }
// Going to another zone: the visitor glides across the hall to that zone's station and turns to its machines.
function travel(index) {
  if (visit.phase !== 'hall' || visit.glide || !ZONES[index]) return;
  if (room !== null) { if (index === room) return; if (HALLDATA.zones[ZONES[index].id].room) goRoom(index); else goHall(index); return; }
  const to = STATIONS[index], from = { x: frame.position.x, z: frame.position.z }, far = Math.hypot(to.station[0] - from.x, to.station[1] - from.z);
  target.hidden = true; canvas.classList.remove('aim'); visit.turnTo = null;
  if (reduced || far < 0.05) { frame.position.set(to.station[0], 0, to.station[1]); visit.yaw = to.facing; visit.pitch = 0; enter(index); visit.aim = -1; paint(); return; }
  visit.phase = 'travel'; visit.glide = { to: { x: to.station[0], z: to.station[1] }, from, yaw: to.facing, fromYaw: visit.yaw, fromPitch: visit.pitch, t: 0, time: clamp(far / 6, 0.7, 1.8), zone: index };
}
// The places of the hall: every machine and ring, each machine with its game, and motes in the air of each zone.
function clearPlaces() {
  endPreview(); endLive();
  for (const p of portals) { scene.remove(p.group); p.label.material.map?.dispose(); p.label.material.dispose(); p.face.material.dispose(); } portals = [];
  for (const m of air) { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); } air = []; hover = -1; visit.aim = -1;
}
function buildHall() {
  clearPlaces(); room = null; paintBack(); HALL = HALLDATA.hall; SCREENS = HALLDATA.screens; STATIONS = ZONES.map(z => HALLDATA.zones[z.id]);
  RINGS = ZONES.map((z, i) => i).filter(i => STATIONS[i].room); PLACES = SCREENS.concat(RINGS.map(i => ringPlace(STATIONS[i].ring))); camera.position.set(0, HALL.eye, 0);
  const zoneOf = id => ZONES.find(z => z.id === id);
  portals = PLACES.map((place, i) => makePortal(place, i, place.ring ? ZONES[RINGS[i - SCREENS.length]] : zoneOf(place.zone)));
  ZONES.forEach((z, i) => { visit.page[i] = 0; fill(i); });
  RINGS.forEach((i, k) => { const z = ZONES[i]; show(portals[SCREENS.length + k], { zone: i, id: 'ring-' + z.id, title: z.label, sub: `${gamesIn(i).length} ${gamesIn(i).length === 1 ? 'game' : 'games'} · a world of its own`, url: null, art: `./worlds/rooms/${z.id}/door.webp`, color: z.color }); });
  if (!reduced) ZONES.forEach((z, i) => { const at = new THREE.Group(); at.position.set(STATIONS[i].station[0], 0, STATIONS[i].station[1]); scene.add(at); air.push(motes(touch ? 26 : 44, z.color, false, null, at)); const k = RINGS.indexOf(i); if (k >= 0) { const p = portals[SCREENS.length + k]; air.push(motes(30, z.color, true, p.uniforms.uHalf.value, p.group)); } });
}
// The places of a room: its machines, with the zone's games from the front machine outward, and the ring back to the hall.
function buildRoom(index) {
  clearPlaces(); room = index; paintBack(); const zone = ZONES[index], data = ROOMS[zone.id];
  // A scenery room has no machines: its games hang as floating frames, one for each game.
  HALL = { eye: data.hall.eye ?? data.hall.ground, reach: 1, frames: !!data.hall.frames }; SCREENS = (HALL.frames ? frameRing(gamesIn(index).length, HALL.eye) : data.screens).map(s => ({ ...s, zone: zone.id })); PLACES = SCREENS.concat([exitRing(SCREENS)]); camera.position.set(0, HALL.eye, 0);
  portals = PLACES.map((place, i) => makePortal(place, i, zone)); visit.page[index] = 0; fill(index);
  show(portals[SCREENS.length], { exit: true, zone: index, id: 'ring-hall', title: 'The alley', sub: 'Back to the alley of all the games', url: null, art: null, color: '#ffffff' });
  if (!reduced) { air.push(motes(touch ? 50 : 90, zone.color, false)); const p = portals[SCREENS.length]; air.push(motes(30, '#ffffff', true, p.uniforms.uHalf.value, p.group)); }
}
// Through a ring into a zone's room: the view fills with the zone's light, the room's world loads, and the visitor
// stands in its middle and faces the first game. The room shows small first and sharpens.
const pause = ms => new Promise(done => setTimeout(done, ms));
function goRoom(index) {
  if (visit.phase !== 'hall' || visit.glide || !ZONES[index] || !HALLDATA.zones[ZONES[index].id].room) return; const zone = ZONES[index];
  visit.phase = 'travel'; target.hidden = keysBar.hidden = groupsBar.hidden = true; canvas.classList.remove('aim'); flash.style.setProperty('--tint', zone.color); flash.classList.add('on'); sound.whoosh(true); sound.hum(0);
  roomData(zone.id).then(() => Promise.all([noWorld ? null : loadRoom(zone.id, '150k'), pause(reduced ? 0 : 600)])).then(([mesh]) => {
    showWorld(mesh); buildRoom(index); visit.zone = index; frame.position.set(0, 0, 0); visit.yaw = SCREENS[roomSeats(SCREENS)[0]].heading; visit.pitch = 0; visit.turnTo = null;
    visit.phase = 'hall'; flash.classList.remove('on'); keysBar.hidden = groupsBar.hidden = false; mark(); banner(zone); paint(); sound.place(zone.id);
    // The room sharpens: a desktop takes the room's full-resolution file, and a phone the 500,000-splat file.
    if (!noWorld) loadRoom(zone.id, query.get('q') || (touch ? '500k' : 'full')).then(sharp => { if (room === index && visit.phase !== 'travel') showWorld(sharp); else sharp.dispose?.(); }).catch(() => { /* the small room stays */ });
  }).catch(error => { console.error(error); visit.phase = 'hall'; flash.classList.remove('on'); keysBar.hidden = groupsBar.hidden = false; loadLine.hidden = false; loadLine.textContent = `${zone.label} did not load.`; setTimeout(() => { loadLine.hidden = true; }, 4000); paint(); });
}
// The top-left link: in the alley it leads to the Lab page; inside a world it says Alley and walks back through the ring.
function paintBack() {
  if (!backLink) return; const inWorld = room !== null;
  backLink.textContent = inWorld ? '◀ Alley' : '◀ Lab'; backLink.setAttribute('aria-label', inWorld ? 'Back to the alley' : 'Back to the Lab');
}
backLink?.addEventListener('click', e => { if (room === null) return; e.preventDefault(); goHall(); });
// Back through the ring: the hall again, at the cluster of the zone the visitor came from.
function goHall(to) {
  if (visit.phase !== 'hall' || visit.glide || room === null) return; const index = Number.isInteger(to) ? to : room, zone = ZONES[index];
  visit.phase = 'travel'; target.hidden = keysBar.hidden = groupsBar.hidden = true; canvas.classList.remove('aim'); flash.style.setProperty('--tint', zone.color); flash.classList.add('on'); sound.whoosh(false);
  pause(reduced ? 0 : 450).then(() => {
    showWorld(hallMesh); buildHall(); visit.zone = index; const at = STATIONS[index]; frame.position.set(at.station[0], 0, at.station[1]); visit.yaw = at.facing; visit.pitch = 0; visit.turnTo = null;
    visit.phase = 'hall'; flash.classList.remove('on'); keysBar.hidden = groupsBar.hidden = false; mark(); paint(); sound.place('alley');
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
function start() { sound.start(); visit.phase = 'hall'; startCard.hidden = true; keysBar.hidden = groupsBar.hidden = false; mark(); banner(ZONES[visit.zone]); paint(); }
function paint() {
  const p = portals[visit.aim];
  if (visit.phase !== 'hall' || !p?.game) { target.hidden = true; $('kGo').disabled = true; canvas.classList.remove('aim'); return; }
  target.hidden = false; $('kGo').disabled = false; target.style.setProperty('--tint', p.game.color);
  $('tTitle').textContent = p.game.title; $('tSub').textContent = p.game.sub; $('tSub').hidden = !p.game.sub;
  $('kGo').textContent = p.door ? 'Go' : 'Play';
  $('tDo').textContent = p.door ? (p.game.exit ? (touch ? 'Tap the portal to go back' : 'Click the portal or press Enter to go back') : touch ? 'Tap the door to go in' : 'Click the door or press Enter to go in') : touch ? 'Tap the frame to play' : 'Click the frame or press Enter to play';
}

/* ---------------- looking and walking ---------------- */
// visit.yaw is a compass heading: 0 looks along -z and a quarter turn looks along +x.
const eye = new THREE.Vector3(), dir = new THREE.Vector3(), ndc = new THREE.Vector3();
function lookRay(clientX, clientY) {
  camera.updateMatrixWorld(true); camera.getWorldPosition(eye);
  ndc.set(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1, 0.5).unproject(camera); dir.copy(ndc).sub(eye).normalize();
  return [{ x: eye.x, y: eye.y, z: eye.z }, { x: dir.x, y: dir.y, z: dir.z }];
}
// The pointer on a door's plane: where the look ray meets the plane, in metres along the door's right and up, and
// how far that point is from the rim (under 0 inside). null when the ray runs along the plane or the door is behind.
function onDoor(p, origin, d) {
  const n = p.place.normal, c = p.place.centre, r = p.place.right, u = p.place.up, down = d.x * n[0] + d.y * n[1] + d.z * n[2]; if (Math.abs(down) < 1e-4) return null;
  const t = ((c[0] - origin.x) * n[0] + (c[1] - origin.y) * n[1] + (c[2] - origin.z) * n[2]) / down; if (t <= 0) return null;
  const h = [origin.x + d.x * t - c[0], origin.y + d.y * t - c[1], origin.z + d.z * t - c[2]], x = h[0] * r[0] + h[1] * r[1] + h[2] * r[2], y = h[0] * u[0] + h[1] * u[1] + h[2] * u[2];
  const half = p.uniforms.uHalf.value, rim = p.place.box ? (Math.hypot(x / half.x, y / half.y) - 1) * Math.min(half.x, half.y) : Math.hypot(x, y) - half.x;
  return { x, y, rim };
}
// A touch on the rim: full within 12 cm of it, and none from 40 cm. A door seen from behind does not answer.
function touchRims(clientX, clientY) {
  const [origin, d] = lookRay(clientX, clientY);
  for (const p of portals) {
    if (!p.door) continue; const at = visit.phase === 'hall' && p.lit > 0.5 && d.x * p.place.normal[0] + d.z * p.place.normal[2] < -0.2 ? onDoor(p, origin, d) : null;
    p.touch = at ? clamp(1 - (Math.abs(at.rim) - 0.12) / 0.28, 0, 1) : 0; if (at && p.touch > 0) p.uniforms.uPoint.value.set(at.x, at.y);
  }
}
// Point and click: a tap or a click on the ground walks the visitor to that spot. The spot is where the look ray
// meets the floor, moved onto the open floor when it is under a building. A ring of light marks it.
const spot = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
spot.rotation.x = -Math.PI / 2; spot.renderOrder = 15; spot.frustumCulled = false; spot.visible = false; scene.add(spot);
function walkTo(clientX, clientY) {
  const [origin, d] = lookRay(clientX, clientY); if (d.y > -0.03) return false;            // the sky, a wall far off, or the horizon
  const t = -origin.y / d.y, far = Math.hypot(d.x * t, d.z * t); if (far > 30 || far < 0.3) return false;
  const at = { x: origin.x + d.x * t, z: origin.z + d.z * t }, to = room !== null ? walkRoom(at, HALL.reach) : walk(at, HALL.bounds);
  if (Math.hypot(to.x - frame.position.x, to.z - frame.position.z) < 0.15) return false;
  visit.walk = { to, stuck: 0 }; visit.turnTo = Math.atan2(to.x - frame.position.x, -(to.z - frame.position.z)); visit.pitchTo = 0; visit.aimTo = -1;
  spot.position.set(to.x, 0.02, to.z); spot.material.color.set(ZONES[visit.zone].color); spot.material.opacity = 0.9; spot.visible = true;
  if (reduced) { frame.position.x = to.x; frame.position.z = to.z; visit.walk = null; if (room === null) enter(zoneAt(frame.position, STATIONS)); }
  return true;
}
const noTouch = () => { for (const p of portals) p.touch = 0; };
const portalAt = (x, y) => visit.phase === 'hall' ? pick(...lookRay(x, y), PLACES, lit(), touch ? 1.35 : 1.08) : -1;
// The machines and rings as the visitor sees them from where they stand: each with its heading, its distance over the
// floor and the look angle up to it.
const seen = () => PLACES.map(p => { const dx = p.centre[0] - frame.position.x, dz = p.centre[2] - frame.position.z, distance = Math.hypot(dx, dz); // front: the visitor is on the side the place faces. A door seen from behind is not a stop and has no name card.
  return { ...p, heading: Math.atan2(dx, -dz), distance, pitch: Math.atan2(p.centre[1] - HALL.eye, distance), front: -(dx * p.normal[0] + dz * p.normal[2]) > 0.25 * distance }; });
// The arrows start from the place in view, so one press moves on to the next place. In the hall they stop at machines
// only: a ring hangs right over its machines, and the Room button and the R key open the room of the zone.
function turn(step) { if (visit.phase !== 'hall' || visit.glide) return; const now = seen(), stops = lit().map((on, k) => on && now[k].front && !(room === null && SCREENS.length && portals[k].door)), i = neighbour(visit.turnTo ?? (visit.aim >= 0 ? now[visit.aim].heading : visit.yaw), now, stops, step, REACH); if (i >= 0) { visit.turnTo = now[i].heading; visit.pitchTo = now[i].pitch; visit.aimTo = i; } }
// Walking through a portal. In the alley, a visitor who walks at a door, inside its width and within about two
// metres of it (the wall of the shop stops them there), goes into its world. In a world, a visitor who walks to the
// edge of the floor toward the portal behind them goes back to the alley. (x, z) is the way they walk, one metre long.
function through(x, z) {
  if (visit.phase !== 'hall' || visit.glide) return;
  if (room === null) {
    for (let i = 0; i < portals.length; i++) {
      const p = portals[i]; if (!p.door || !p.game || p.game.exit || p.lit < 0.5) continue; const n = p.place.normal, r = p.place.right, c = p.place.centre;
      const out = (frame.position.x - c[0]) * n[0] + (frame.position.z - c[2]) * n[2], along = (frame.position.x - c[0]) * r[0] + (frame.position.z - c[2]) * r[2];
      if (out > 0 && out < 2.1 && Math.abs(along) < p.place.width / 2 + 0.2 && -(x * n[0] + z * n[2]) > 0.6) { visit.walk = null; keys.clear(); goRoom(p.game.zone); return; }
    }
  } else {
    const exit = PLACES[PLACES.length - 1], far = Math.hypot(frame.position.x, frame.position.z); if (!exit?.ring || far < HALL.reach - 0.04) return;
    const d = direction(exit.heading); if (x * d.x + z * d.z > 0.75 && (frame.position.x * d.x + frame.position.z * d.z) / far > 0.75) { visit.walk = null; keys.clear(); goHall(); }
  }
}
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
  // A walk to a clicked spot: straight toward it at a walking pace, held on the open floor. It ends at the spot, when
  // a wall stops it, when a key takes over, or when the visitor travels another way.
  if (visit.walk && (visit.phase !== 'hall' || length > 0)) visit.walk = null;
  if (visit.walk) {
    const w = visit.walk, dx = w.to.x - frame.position.x, dz = w.to.z - frame.position.z, left = Math.hypot(dx, dz), go = Math.min(left, (room !== null ? 1.6 : 3.2) * dt);
    const want = { x: frame.position.x + dx / (left || 1) * go, z: frame.position.z + dz / (left || 1) * go }, to = room !== null ? walkRoom(want, HALL.reach) : walk(want, HALL.bounds), moved = Math.hypot(to.x - frame.position.x, to.z - frame.position.z);
    frame.position.x = to.x; frame.position.z = to.z; w.stuck = moved < go * 0.3 ? w.stuck + dt : 0; if (left < 0.06 || w.stuck > 0.4) visit.walk = null; if (room === null) enter(zoneAt(frame.position, STATIONS)); if (left > 0.06) through(dx / left, dz / left);
  }
  if (!visit.walk && spot.visible) { spot.material.opacity -= dt * 2.5; if (spot.material.opacity <= 0) spot.visible = false; }
  if (length > 0) { ahead /= length; side /= length; const a = visit.yaw, speed = (room !== null ? 1.3 : 2.2) * dt, step2 = { x: frame.position.x + (Math.sin(a) * ahead + Math.cos(a) * side) * speed, z: frame.position.z + (-Math.cos(a) * ahead + Math.sin(a) * side) * speed }, to = room !== null ? walkRoom(step2, HALL.reach) : walk(step2, HALL.bounds); frame.position.x = to.x; frame.position.z = to.z; if (room === null) enter(zoneAt(frame.position, STATIONS)); through(Math.sin(a) * ahead + Math.cos(a) * side, -Math.cos(a) * ahead + Math.sin(a) * side); }
  // The lit place in the middle of the view is named on screen. A ring is high on the wall, so it counts only when
  // the visitor looks up at it.
  const now = seen(), mask = lit().map((on, i) => on && now[i].front && Math.abs(now[i].pitch - visit.pitch) < 0.32);
  const aim = facing(visit.yaw, now, mask, 0.3, REACH); if (aim !== visit.aim) { visit.aim = aim; paint(); if (aim >= 0) sound.tick(); }
  // The door in view hums in its zone's pitch, louder the nearer the visitor stands.
  { const p = portals[visit.aim]; sound.hum(room === null && p?.door && !p.game?.exit ? clamp(1.4 - now[visit.aim].distance / 6, 0.25, 1) : 0, p?.game?.zone ?? 0); }
}

/* ---------------- input ---------------- */
let drag = null, hover = -1;   // hover: the place under the mouse pointer
canvas.addEventListener('pointerdown', e => { if (visit.phase !== 'hall') return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, at: performance.now(), moved: 0 }; try { canvas.setPointerCapture(e.pointerId); } catch (error) { /* the drag still works inside the canvas */ } canvas.classList.add('look'); });
canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) { if (e.pointerType === 'mouse') { hover = portalAt(e.clientX, e.clientY); canvas.classList.toggle('aim', hover >= 0); touchRims(e.clientX, e.clientY); } return; }
  noTouch();
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (visit.glide || drag.moved < 6) return;
  // The view follows the finger: a drag to the right turns the visitor to the left, and a drag down looks up.
  const k = (camera.fov * Math.PI / 180) / innerHeight * 1.15; visit.turnTo = null; visit.yaw = wrap(visit.yaw - dx * k); visit.pitch = clamp(visit.pitch + dy * k, -1.1, 1.1);
});
const lift = e => { if (!drag || e.pointerId !== drag.id) return; const tap = drag.moved < 10 && performance.now() - drag.at < 500, d = drag; drag = null; canvas.classList.remove('look'); if (tap && e.type === 'pointerup' && visit.phase === 'hall' && !visit.glide) { const i = portalAt(d.sx, d.sy); if (i >= 0) launch(i); else walkTo(d.sx, d.sy); } };
canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift); canvas.addEventListener('pointerleave', () => { hover = -1; noTouch(); });
const nextZone = step => travel((visit.zone + step + ZONES.length) % ZONES.length);
// The door tool (?edit): for the person who places the doors. With a door in the middle of the view, keys move it on
// its wall and change its size, and a panel shows the numbers to paste into worlds/hall/screens.json.
//   J L  along the wall     I K  up and down     N M  out of and into the wall
//   U O  narrower, wider    Y H  taller, shorter     Shift: four times the step     C: copy every zone's numbers
const EDIT = query.has('edit');
if (EDIT) {
  const panel = document.createElement('pre'); panel.id = 'edit'; panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:70;margin:0;padding:8px 10px;max-width:min(430px,calc(100vw - 16px));white-space:pre-wrap;font:12px/1.35 ui-monospace,monospace;color:#d9ffe9;background:#06120cdd;border:1px solid #2c6;border-radius:8px;pointer-events:none';
  document.body.append(panel);
  const round = v => Math.round(v * 100) / 100, zoneOf = () => { const p = portals[visit.aim]; return room === null && p?.door && !p.game?.exit ? ZONES[p.game.zone] : null; };
  const show = note => { const z = zoneOf(); panel.textContent = 'Door tool   J L along · I K up, down · N M out, in · U O width · Y H height · Shift x4 · C copy all\n' + (z ? `"${z.id}": ` + JSON.stringify({ station: HALLDATA.zones[z.id].station, ring: HALLDATA.zones[z.id].ring }) : 'Turn to a door.') + (note ? '\n' + note : ''); };
  setInterval(() => show(), 400);
  addEventListener('keydown', e => {
    if (visit.phase !== 'hall' || room !== null) return; const k = e.key.toLowerCase(), z = zoneOf();
    if (k === 'c') { e.stopImmediatePropagation(); const text = JSON.stringify(HALLDATA.zones, null, 1); (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => show('Copied every zone.'), () => { console.log(text); show('Copy failed: the numbers are in the console.'); }); return; }
    if (!z || !'jlikunmoyh'.includes(k) || k.length !== 1) return; e.stopImmediatePropagation(); e.preventDefault();
    const zone = HALLDATA.zones[z.id], ring = zone.ring, n = ring.normal, along = [n[2], 0, -n[0]], d = (e.shiftKey ? 4 : 1) * 0.05, heading = visit.yaw, pitch = visit.pitch;
    const move = (v, by) => { ring.centre = ring.centre.map((c, i) => round(c + v[i] * by)); };
    if (k === 'j') move(along, -d); else if (k === 'l') move(along, d); else if (k === 'i') move([0, 1, 0], d); else if (k === 'k') move([0, 1, 0], -d); else if (k === 'n') move(n, d / 2.5); else if (k === 'm') move(n, -d / 2.5);
    else if (k === 'u') ring.width = round(Math.max(0.6, ring.width - d)); else if (k === 'o') ring.width = round(ring.width + d); else if (k === 'y') ring.height = round(ring.height + d); else if (k === 'h') ring.height = round(Math.max(0.8, ring.height - d));
    buildHall(); visit.yaw = heading; visit.pitch = pitch; visit.turnTo = null; paint(); show();
  }, true);
}
// The Sound button turns the page's sound off and on. The choice is kept for the next visit.
const soundBtn = $('sound'), showSound = () => { soundBtn.setAttribute('aria-pressed', String(sound.isOn())); soundBtn.setAttribute('aria-label', sound.isOn() ? 'Sound: on' : 'Sound: off'); };
soundBtn.addEventListener('click', () => { sound.start(); sound.setOn(!sound.isOn()); showSound(); }); showSound();
// The Views menu: the three views of the arcade's home. A press outside it, or Esc, closes it.
const viewsBtn = $('views'), viewsMenu = $('viewsMenu');
const showViews = on => { viewsMenu.hidden = !on; viewsBtn.setAttribute('aria-expanded', String(on)); if (on) viewsMenu.querySelector('a').focus({ preventScroll: true }); };
viewsBtn.addEventListener('click', () => showViews(viewsMenu.hidden));
addEventListener('pointerdown', e => { if (!viewsMenu.hidden && !viewsMenu.contains(e.target) && e.target !== viewsBtn) showViews(false); }, true);
addEventListener('keydown', e => {
  if (!viewsMenu.hidden) { if (e.key === 'Escape') { e.preventDefault(); showViews(false); viewsBtn.focus({ preventScroll: true }); } return; }
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
$('kBack').addEventListener('click', () => goHall()); $('kRoom').addEventListener('click', () => goRoom(visit.zone)); $('kPrev').addEventListener('click', () => turn(-1)); $('kNext').addEventListener('click', () => turn(1));
$('kGo').addEventListener('click', () => { if (visit.aim >= 0) launch(visit.aim); }); $('kMore').addEventListener('click', () => setPage(visit.page[visit.zone] + 1));
ZONES.forEach((z, i) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.zone = z.id; b.textContent = z.label; b.style.setProperty('--tint', z.color); b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => travel(i)); groupsBar.append(b); });
go.addEventListener('click', start);

/* ---------------- the loop ---------------- */
let last = performance.now();
function tick(now) {
  const frameMs = now - last, dt = Math.min(0.05, Math.max(0, frameMs / 1000)); last = now;
  if (!window.GameSwitch?.isOpen && !document.hidden) step(dt);
  camera.rotation.set(visit.pitch, -visit.yaw, 0);
  const time = reduced ? 0 : now / 1000;
  for (const m of air) m.material.uniforms.uTime.value = time;
  // A touch screen has no pointer to rest on a rim, so the door in the middle of the view opens by itself: the place
  // where the rift gives way goes slowly round its rim.
  if (touch) portals.forEach((p, i) => { if (!p.door) return; p.touch = !reduced && visit.phase === 'hall' && i === visit.aim ? 0.85 : 0; if (p.touch) { const h = p.uniforms.uHalf.value; p.uniforms.uPoint.value.set(Math.cos(time * 0.55) * h.x, Math.sin(time * 0.55) * h.y); } });
  portals.forEach((p, i) => { p.uniforms.uTime.value = time; p.uniforms.uTouch.value += (p.touch - p.uniforms.uTouch.value) * Math.min(1, dt * 7); p.uniforms.uHot.value += ((i === visit.aim ? 1 : 0) - p.uniforms.uHot.value) * Math.min(1, dt * 10); p.uniforms.uFlow.value += ((!reduced && (i === hover || (touch && i === visit.aim)) ? 1 : 0) - p.uniforms.uFlow.value) * Math.min(1, dt * 5); p.label.material.opacity = p.lit * (p.place.box ? 0.9 + 0.1 * p.uniforms.uHot.value : p.door || p.frame ? 0.75 + 0.25 * p.uniforms.uHot.value : p.uniforms.uHot.value); if (p.frame && !reduced) p.group.position.y = p.base + 0.035 * Math.sin(time * 0.7 + p.uniforms.uSeed.value * 6.283); });
  stepPreview(now); try { stepLive(); } catch (error) { console.error(error); LIVE.on = false; endLive(); }
  renderer.render(scene, camera);
  // Slow frames lower the pixel ratio: after a second and a half of frames over 34 ms, a quarter step down, to no
  // less than the display's own pixels. Frames while a world loads or the tab was hidden do not count.
  if (!PX.fixed && visit.phase === 'hall' && frameMs < 250) {
    PX.frames++; if (frameMs > 34) PX.slow++;
    if (PX.frames >= 45) { if (PX.slow > 30 && LIVE.on && LIVE.portal) { LIVE.on = false; endLive(); } else if (PX.slow > 30 && PX.now > PX.least) { PX.now = Math.max(PX.least, PX.now - 0.25); renderer.setPixelRatio(PX.now); resize(); } PX.frames = PX.slow = 0; }
  }
  requestAnimationFrame(tick);
}

/* ---------------- start up ---------------- */
// The places load first: every machine and ring is set up, each machine gets its game, and motes go into the air of
// each zone. Then the world loads, with a line that shows the progress.
// The loading screen shows the progress of the first file, with a hint that changes. When the alley is drawn the
// screen fades and the start card shows over the live alley.
const loading = $('loading'), loadingBar = $('loadingBar'), HINTS = ['Each storefront is a portal to a world of games.', 'Drag to look around. Tap or click the street to walk.', 'Touch the edge of a portal to see more of the world behind it.', 'In a world, each game floats in a frame. Tap a frame to play.', 'The Views button at the top opens the Corridor and the list of all games.'];
let hintAt = 0; const hintTimer = setInterval(() => { hintAt = (hintAt + 1) % HINTS.length; $('loadingHint').textContent = HINTS[hintAt]; }, 3200);
const progress = p => { const pct = Math.round(p * 100); loadingBar.setAttribute('aria-valuenow', pct); loadingBar.firstElementChild.style.width = pct + '%'; $('loadingLine').textContent = pct < 100 ? `Opening the alley… ${pct}%` : 'Drawing the alley…'; loadLine.textContent = `Loading the alley… ${pct}%`; };
const ready = () => { clearInterval(hintTimer); loading.classList.add('done'); loadLine.hidden = true; startCard.hidden = false; go.disabled = false; go.textContent = 'Enter the alley'; go.focus({ preventScroll: true }); };
fetch('./worlds/hall/screens.json').then(r => { if (!r.ok) throw new Error('screens.json missing'); return r.json(); }).then(data => {
  HALLDATA = data; buildHall();
  const at = query.get('zone') ? STATIONS[Math.max(0, ZONES.findIndex(z => z.id === query.get('zone')))] : null;
  frame.position.set(at ? at.station[0] : HALL.start.x, 0, at ? at.station[1] : HALL.start.z); visit.yaw = at ? at.facing : HALL.start.facing; visit.zone = zoneAt(frame.position, STATIONS); mark();
  document.documentElement.style.setProperty('--zone', ZONES[visit.zone].color);
  if (noWorld) return ready();
  return loadHall(progress).then(() => { progress(1); return new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); }).then(ready);
}).catch(error => { console.error(error); noGraphics('The alley did not load.'); });
requestAnimationFrame(tick);

// A handle for the browser check (qa/lab/riftwalk.e2e.mjs). The page never reads it.
window.__riftwalk = {
  live: () => ({ on: LIVE.on, zone: LIVE.portal ? ZONES[LIVE.zone].id : null }),
  sound: () => sound.state(), preview: () => ({ url: preview.portal?.game?.url ?? null, playing: !!preview.texture }),
  state: () => ({ phase: visit.phase, room: room === null ? null : ZONES[room].id, zone: ZONES[visit.zone].id, page: visit.page[visit.zone], pages: pagesIn(visit.zone), aim: visit.aim, yaw: visit.yaw, pitch: visit.pitch, turning: visit.turnTo !== null, gliding: !!visit.glide, walking: !!visit.walk, place: { x: frame.position.x, z: frame.position.z }, hall: !!hall, splats: hall?.packedSplats?.numSplats ?? 0,
    hover, flow: portals.map(p => +p.uniforms.uFlow.value.toFixed(2)), touch: portals.map(p => +p.uniforms.uTouch.value.toFixed(2)),
    motes: air.reduce((n, m) => n + m.geometry.attributes.position.count, 0),
    machines: portals.slice(0, SCREENS.length).map(p => ({ zone: p.zone.id, game: p.game?.id ?? null, title: p.game?.title ?? null, url: p.game?.url ?? null, lit: p.lit, art: p.uniforms.uHasMap.value === 1 })),
    rings: portals.slice(SCREENS.length).map(p => ({ to: p.game.exit ? 'hall' : ZONES[p.game.zone].id, title: p.game.title, lit: p.lit, art: p.uniforms.uHasMap.value === 1 })) }),
  // The pixel ratio in use, and a bare view (no portals, no motes) for the door pictures (games/riftwalk/tools/door-shots.mjs).
  px: () => PX.now, bare: on => { for (const p of portals) p.group.visible = !on; for (const m of air) m.visible = !on; },
  // The splat worlds in the scene now: 'hall' or 'room' with the count of splats.
  worlds: () => scene.children.filter(c => c.packedSplats || c.isSplatMesh).map(c => (c === hallMesh ? 'hall' : 'room') + ':' + (c.packedSplats?.numSplats ?? 0)),
  // Where a place's centre is on the page (the machines first, then the six rings), or null when it is behind the view.
  screen: i => { const p = portals[i]; if (!p) return null; camera.updateMatrixWorld(true); ndc.set(...p.place.centre).project(camera); return ndc.z > 1 ? null : { x: (ndc.x + 1) / 2 * innerWidth, y: (1 - ndc.y) / 2 * innerHeight }; },
  // Where a point on a place's plane is on the page: (x, y) in half widths and half heights from its centre, so (1, 0) is the right rim.
  rim: (i, x = 1, y = 0) => { const p = portals[i]; if (!p) return null; const h = p.uniforms.uHalf.value, c = p.place.centre, r = p.place.right, u = p.place.up; camera.updateMatrixWorld(true); ndc.set(c[0] + r[0] * x * h.x + u[0] * y * h.y, c[1] + r[1] * x * h.x + u[1] * y * h.y, c[2] + r[2] * x * h.x + u[2] * y * h.y).project(camera); return ndc.z > 1 ? null : { x: (ndc.x + 1) / 2 * innerWidth, y: (1 - ndc.y) / 2 * innerHeight }; },
  // Turn at once to a place (a machine, or a ring after the machines), as the visitor sees it from where they stand.
  face: i => { const p = seen()[i]; if (!p) return; visit.turnTo = null; visit.yaw = p.heading; visit.pitch = p.pitch; camera.rotation.set(visit.pitch, -visit.yaw, 0); camera.updateMatrixWorld(true); },
  look: heading => { visit.turnTo = null; visit.yaw = wrap(heading); visit.pitch = 0; camera.rotation.set(visit.pitch, -visit.yaw, 0); camera.updateMatrixWorld(true); },
};
