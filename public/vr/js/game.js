// In Full Swing: the game on top of the city (spec §10). Twelve rooftop clogs to plunge, 80 Loonies to collect, three timed
// trials, the Porcelain King on the Needle and the tutorial that teaches the ropes. main.js feeds it the physics events and
// calls update once a frame. Everything it draws is built in code and animated in shaders, in the comic look of the key art:
// three cel bands, ink outline twins, world-anchored dots, the city's four-step haze. About a dozen draws, plus their ink twins.
import * as THREE from "three";
import { GAME, COLORS, PERF, SUN_DIR } from "./config.js";
import { PROP_GLSL, INK_GLSL, HULL_HEAD, hullMaterial, inkTwin, rgb, partsBuilder, place } from "./rope.js";
import { GLSL, PAL, smoothNormals, syncInk, loadArt } from "./comic.js";
import { release, teleport } from "./physics.js";

const KING = GAME.king;
const SPECIAL = { clog: true, pipe: true, crack: true };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapPi = (a) => { a %= TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };
const glv = (hex) => { const c = rgb(hex); return `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`; };
const fmtTime = (s) => (s < 60 ? s.toFixed(1) + " s" : Math.floor(s / 60) + ":" + (s % 60).toFixed(1).padStart(4, "0"));

/* ---------------- tuning (constants that only this module reads) ---------------- */
const TOILET_S = 1.35; // a clog toilet is 1.35 times a plain one: it has to read from a rooftop 80 m away
const BOWL_Y = 1.3, BOWL_Z = 0.15; // the bowl's middle in the toilet's own frame; +z is the front
const PIPE_S = 1.3; // a pipe on the pod is a third bigger than it needs to be, so it reads from 60 m
const CUP_Y = 1.9; // a pump target sits in the bowl, this high over the roof (before the scale)
const FOUNT = 24; // sludge blobs in each fountain
const BEAM = { clog: [1.4, 140], king: [6, 260], pad: [2.2, 30] }; // beacon radius and height
const KING_BEAM = 12, PAD_BEAM = 13; // beacon slots (the clogs take 0-11)
const RING_SLOT = 0, GOLD_SLOT = 3, FLASH_SLOT = 4, PAD_SLOT = 6; // ring slots: rings 0-2, the tutorial marker, 2 flashes, 3 pads
const PAD_R = 1.5; // a trial pad: stand inside this radius
const COINS = 80, BURST = 40; // world coins, and slots for the bonus coins of a flush
const COIN_R = 0.55;
const FX_N = 768; // particle pool
const TRIAL_MAX = 300; // a trial that runs this long (s) ends by itself
const KING_RANGE = 240; // the King throws only at a player this close (a lob this far takes 17 s)
const MOUTH = [0, 0.64, 0.2]; // where a ball leaves the King, as fractions of his height (up, forward)
const HEAD_DROP = 0.4; // the chest hangs this far under the head (standing)
const LOOK_DOT = 0.85; // "look at your wrist": the wrist is this close to where you look (cosine)
const TUT_CONTROL = ["trigger", "trigger", "trigger", "grip", "trigger", "stick", "wrist", null];
const M_PORC = 0, M_GOLD = 1, M_WATER = 2, M_DARK = 3, M_CREAM = 4, M_SLUDGE = 5, M_GLOW = 6;
const SKY_SUN_U = 0.2515; // where the painted sun sits along the sky strip (art/sky.webp), as cityview.js has it
const SLUDGE_LIT = 0x8de02a; // flat sludge green: the lit colour of drips, blobs and the ball

/* ---------------- shader kit ---------------- */
// The city's golden hour in short form: the comic prop light from rope.js plus the city's own haze, toward the painted sky in
// that direction (a lookup in the sky strip, pulled toward violet), in four print-like steps.
const FOG_K = (Math.LN10 / (PERF.fogFar - PERF.fogNear)).toFixed(6), FOG_N = PERF.fogNear.toFixed(1);
const KIT = `
uniform float uTime;
uniform sampler2D uSky; uniform float uHaveSky, uSkyU;
${PROP_GLSL}
${GLSL.posterize}${GLSL.ink}
float fogAmt(vec3 wp) {
  vec3 v = wp - cameraPosition;
  float d = length(v), H = 110.0, yc = max(cameraPosition.y, 0.0), yp = max(wp.y, 0.0), dy = yc - yp;
  float hf = abs(dy) < 1.0 ? exp(-0.5 * (yc + yp) / H) : H * (exp(-yp / H) - exp(-yc / H)) / dy;
  float f = 1.0 - exp(-${FOG_K} * max(d - ${FOG_N}, 0.0) * hf);
  return max(f, 0.06 * smoothstep(12.0, ${FOG_N}, d));
}
vec3 fogCol(vec3 wp) {
  vec3 v = normalize(wp - cameraPosition);
  vec3 h = normalize(vec3(v.x, clamp(v.y, 0.0, 0.1) * length(v.xz) * 10.0, v.z));
  vec3 c = uHaveSky > 0.5 ? textureLod(uSky, vec2(atan(-h.x, h.z) * 0.15915494 + uSkyU, clamp(asin(h.y) * 0.7958, 0.0, 1.0)), 3.0).rgb : skyEnv(vec3(v.x, clamp(v.y, 0.0, 0.1), v.z));
  return mix(c, vec3(0.3, 0.16, 0.5), 0.42);
}
vec3 fogMix(vec3 col, vec3 wp, float k) { return mix(col, fogCol(wp), comicPoster(fogAmt(wp) * k, 4.0)); }
`;
// the fragment of every ink twin: flat ink that hazes away with distance like the city's own lines
const HULL_FS = `${KIT}
varying vec3 vW;
void main() { gl_FragColor = vec4(mix(INKV, fogCol(vW), comicPoster(fogAmt(vW) * 0.9, 4.0) * 0.9), 1.0); }`;
const OFF = "gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return;"; // an instance that is not there folds away outside the view

/* ---------------- geometry: the toilet ---------------- */
// One toilet for the clogs and (bigger, with a crown and angry eyes) for the King's fallback. +z is the front. hull: only the big
// shapes and few segments, for the ink twin (it needs no drips, feet or handle).
function toiletGeo(king, hull = false) {
  const B = partsBuilder();
  const add = (geo, m, hex, mat) => B.add(geo, m, hex, [0, 0, 0, mat]);
  const PORC = COLORS.porcelain, GOLD = COLORS.gold, SEG = hull ? 14 : 24;
  add(new THREE.BoxGeometry(3.2, 0.16, 4.4), place(0, 0.08, -0.15), 0x8f8a82, M_DARK);
  // the bowl: one profile up the outside, over the rim and down the inside, stretched into an oval
  const prof = [[0.55, 0.16], [0.52, 0.45], [0.66, 0.8], [0.86, 1.1], [0.98, 1.32], [0.99, 1.48], [0.93, 1.56], [0.84, 1.55], [0.78, 1.42], [0.7, 1.25], [0.55, 1.1], [0.3, 1.02], [0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(prof, SEG), place(0, 0, BOWL_Z, 0, 0, 0, 1, 1, 1.28), PORC, M_PORC);
  if (!hull) add(new THREE.CircleGeometry(0.79, SEG), place(0, 1.23, BOWL_Z, -Math.PI / 2, 0, 0, 1, 1.28, 1), 0x7a8a2a, M_WATER);
  add(new THREE.TorusGeometry(0.9, 0.1, hull ? 5 : 8, hull ? 16 : 26), place(0, 1.6, BOWL_Z, Math.PI / 2, 0, 0, 1, 1.28, 1), 0xefe6d0, M_CREAM);
  if (!hull) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 10), place(s * 0.52, 1.7, -0.95, 0, 0, Math.PI / 2), GOLD, M_GOLD);
  // the tank with its lid, and the gold flush handle
  add(new THREE.BoxGeometry(2.0, 1.5, 0.85), place(0, 1.85, -1.28), PORC, M_PORC);
  add(new THREE.BoxGeometry(2.14, 0.13, 1.0), place(0, 2.665, -1.28), PORC, M_PORC);
  if (!hull) {
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 12), place(-0.62, 2.35, -0.79, Math.PI / 2), GOLD, M_GOLD);
    add(new THREE.BoxGeometry(0.66, 0.1, 0.1), place(-0.34, 2.35, -0.68, 0, 0, -0.1), GOLD, M_GOLD);
    add(new THREE.SphereGeometry(0.15, 10, 8), place(0.0, 2.38, -0.68), GOLD, M_GOLD);
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.11, 8, 6), place(s * 0.45, 0.2, 1.2, 0, 0, 0, 1, 0.7, 1), GOLD, M_GOLD);
    // sludge over the rim: goo on the lip and two drips down the front (a clean toilet hides them)
    add(new THREE.SphereGeometry(0.3, 10, 8), place(0.25, 1.56, 1.36, 0, 0, 0, 1, 0.55, 1.1), 0x6a8a1a, M_SLUDGE);
    add(new THREE.SphereGeometry(0.22, 10, 8), place(-0.5, 1.55, 1.3, 0, 0, 0, 1, 0.6, 1), 0x6a8a1a, M_SLUDGE);
    add(new THREE.SphereGeometry(0.12, 8, 6), place(0.25, 1.15, 1.44, 0, 0, 0, 1, 2.6, 0.6), 0x6a8a1a, M_SLUDGE);
    add(new THREE.SphereGeometry(0.1, 8, 6), place(-0.5, 1.22, 1.36, 0, 0, 0, 1, 2.2, 0.6), 0x6a8a1a, M_SLUDGE);
  }
  if (king) {
    // a gold crown on the tank, glowing green eyes and heavy brows on its face, like the cover
    const crown = 2.73;
    add(new THREE.CylinderGeometry(0.62, 0.7, 0.34, hull ? 8 : 14, 1, true), place(0, crown + 0.17, -1.28), GOLD, M_GOLD);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      add(new THREE.ConeGeometry(0.13, 0.45, 5), place(Math.cos(a) * 0.62, crown + 0.5, -1.28 + Math.sin(a) * 0.62), GOLD, M_GOLD);
      if (!hull) add(new THREE.SphereGeometry(0.07, 6, 5), place(Math.cos(a) * 0.62, crown + 0.78, -1.28 + Math.sin(a) * 0.62), 0xd8203a, M_GLOW);
    }
    if (!hull) for (const s of [-1, 1]) {
      add(new THREE.SphereGeometry(0.2, 10, 8), place(s * 0.5, 2.15, -0.84), PAL.sludge, M_GLOW);
      add(new THREE.BoxGeometry(0.6, 0.1, 0.08), place(s * 0.5, 2.5, -0.85, 0, 0, -s * 0.32), 0x2a1a1a, M_DARK);
    }
  }
  return B.build();
}

/* ---------------- geometry: a pipe on the pod, the coin ---------------- */
// Local frame: +y runs out of the pod wall. The first 2 m (before the scale) sit inside the wall.
function pipeGeo() {
  const B = partsBuilder();
  const add = (geo, m, hex, mat) => B.add(geo, m, hex, [0, 0, 0, mat]);
  const BRASS = 0xc9a44a, IRON = 0x4a4a52, RED = 0xd2202a;
  add(new THREE.CylinderGeometry(0.85, 0.85, 5.6, 14), place(0, 2.8, 0), BRASS, 1);
  add(new THREE.CylinderGeometry(1.45, 1.45, 0.36, 16), place(0, 2.4, 0), IRON, 0);
  add(new THREE.CylinderGeometry(1.32, 1.32, 0.3, 16), place(0, 4.7, 0), IRON, 0);
  add(new THREE.TorusGeometry(0.9, 0.16, 8, 16), place(0, 3.55, 0, Math.PI / 2), BRASS, 1);
  add(new THREE.CylinderGeometry(0.98, 0.98, 0.4, 14), place(0, 5.55, 0), IRON, 0);
  add(new THREE.CircleGeometry(0.62, 14), place(0, 5.76, 0, -Math.PI / 2), 0x120e14, 0);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; add(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 6), place(Math.cos(a) * 1.15, 2.62, Math.sin(a) * 1.15), BRASS, 1); }
  add(new THREE.CylinderGeometry(0.11, 0.11, 1.5, 8), place(0.95 + 0.35, 3.05, 0, 0, 0, Math.PI / 2), IRON, 0);
  add(new THREE.TorusGeometry(0.55, 0.09, 8, 18), place(2.05, 3.05, 0, 0, Math.PI / 2), RED, 2);
  add(new THREE.SphereGeometry(0.22, 8, 6), place(0.3, 5.7, 0.55, 0, 0, 0, 1, 1.8, 1), 0x6a8a1a, 3);
  const g = B.build();
  g.scale(PIPE_S, PIPE_S, PIPE_S);
  return g;
}
// An 11-sided Loonie, a raised centre on both faces. The axis is z; the vertex shader spins it about y.
function coinGeo(hull = false) {
  const B = partsBuilder();
  const R = Math.PI / 2, add = (geo, m, hex, part) => B.add(geo, m, hex, [part, 0, 0, 0]);
  add(new THREE.CylinderGeometry(COIN_R, COIN_R, 0.14, 11), place(0, 0, 0, R), COLORS.gold, 0);
  if (!hull) add(new THREE.CylinderGeometry(COIN_R * 0.68, COIN_R * 0.68, 0.19, 11), place(0, 0, 0, R), 0xffdc7a, 1);
  return B.build();
}

/* ---------------- the game ---------------- */
export function createGame({ scene, city, view, ropes, hands, ui, audio, P, save, settings, saveNow, haptic }) {
  const root = new THREE.Group();
  root.name = "game";
  root.visible = false; // hidden until start(), so the portal's stencil never touches it
  scene.add(root);
  const gFlags = () => (typeof window !== "undefined" && window.G && window.G.flags) || {};
  const gRenderer = () => (typeof window !== "undefined" && window.G && window.G.renderer) || null;
  const look = () => (typeof window !== "undefined" && window.G && window.G.mode === "ar" ? "room" : "black");
  let cam = null;
  scene.traverse((o) => { if (!cam && o.isPerspectiveCamera) cam = o; });

  /* ---------------- state ---------------- */
  // shared by every material below: the clock, the chest target (the bonus coins fly home to it) and the painted sky the haze uses
  const U = { uTime: { value: 0 }, uTarget: { value: new THREE.Vector3() }, uSky: { value: null }, uHaveSky: { value: 0 }, uSkyU: { value: SKY_SUN_U - Math.atan2(-SUN_DIR.x, SUN_DIR.z) / TAU } };
  let T = 0; // game seconds, from dt only, and frozen while the pause menu is open
  let started = false, kind = "controller";
  const ids = (a, max) => new Set((Array.isArray(a) ? a : []).filter((x) => Number.isInteger(x) && x >= 0 && x < max));
  const done = ids(save.clogs, city.clogs.length), got = ids(save.loonies, city.loonies.length);
  save.clogs = [...done]; save.loonies = [...got];
  if (!Number.isFinite(save.bonus) || save.bonus < 0) save.bonus = 0;
  if (!save.best || typeof save.best !== "object") save.best = {};
  save.pipes = [...ids(save.pipes, 3)];
  if (!["sleeping", "awake", "beaten"].includes(save.king)) save.king = "sleeping";
  const bankNow = () => Math.min(GAME.bankMax, got.size + save.bonus);
  const progress = { clogs: done.size, clogsTotal: 12, loonies: got.size, looniesTotal: 80, bank: bankNow(), king: save.king, hearts: KING.hearts, trial: null, tutorial: -1 };
  let seed = 0x5eed1e5;
  const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion();
  const CHEST = new THREE.Vector3(), HEADP = new THREE.Vector3(), BODY = new THREE.Vector3(), MOUTHP = new THREE.Vector3();
  const HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null };
  const queue = []; // lines and toasts that wait a few seconds: { t, fn }
  const later = (s, fn) => queue.push({ t: s, fn });
  const safe = (fn, a, b) => { try { fn(a, b); } catch (e) { if (!safe.seen.has(e.message)) { safe.seen.add(e.message); console.error(e); } } };
  safe.seen = new Set();
  const say = (group, i) => { if (ui && ui.sayLine) ui.sayLine(group, i, kind); };
  const sfx = (name, pos, vol, pitch) => { if (audio && audio.sfx) audio.sfx(name, { pos, vol, pitch }); };
  // a comic sound word in the world (fx.js, reached as G.fx); it is skipped when the art is missing or it would sit on your head
  const word = (name, x, y, z, o) => { const f = typeof window !== "undefined" && window.G && window.G.fx; if (f) f.word(name, { x, y, z }, o); };
  const saySoon = (text, s) => { if (ui && ui.say) ui.say(text, s); };
  const toast = (text) => { if (ui && ui.toast) ui.toast(text); };

  /* ---------------- meshes ---------------- */
  // Every prop is a plain Mesh over an InstancedBufferGeometry: the instance data lives in attributes, so the shaders animate
  // it from uTime and nothing is rewritten per frame. attrs: [name, size, dynamic].
  function instanced(base, count, attrs, material, name) {
    const g = new THREE.InstancedBufferGeometry().copy(base);
    g.instanceCount = count;
    const a = {};
    for (const [n, size, dyn] of attrs) {
      a[n] = new THREE.InstancedBufferAttribute(new Float32Array(count * size), size);
      if (dyn) a[n].setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(n, a[n]);
    }
    const mesh = new THREE.Mesh(g, material);
    mesh.name = name;
    mesh.frustumCulled = false; // shader-animated: the bounds mean nothing
    return { mesh, a };
  }
  // The ink twin of an instanced mesh: another geometry (the big shapes only, so it stays cheap) that reads the very same
  // instance attributes, drawn as back faces pushed out along the welded normals.
  function twinOf(fill, hullBase, material, name) {
    smoothNormals(hullBase);
    const g = new THREE.InstancedBufferGeometry().copy(hullBase);
    g.instanceCount = fill.mesh.geometry.instanceCount;
    for (const n in fill.a) g.setAttribute(n, fill.a[n]);
    const mesh = new THREE.Mesh(g, material);
    mesh.name = name + ":outline"; mesh.frustumCulled = false; mesh.renderOrder = fill.mesh.renderOrder;
    mesh.onBeforeRender = (r, sc, cam) => syncInk(r, cam);
    outlines.push(mesh);
    return mesh;
  }
  const outlines = []; // every ink twin, for the tests
  const initTex = (t) => { const r = gRenderer(); if (r && r.initTexture) r.initTexture(t); };
  // the haze reads the painted sky strip: it comes with the art, and until then the old sky ramp does
  { const r = gRenderer(); if (r) loadArt(r).then((art) => { if (art && art.sky) { U.uSky.value = art.sky; U.uHaveSky.value = 1; } }).catch(() => {}); }
  const blendPre = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };
  // Every material gets the shared clock and the chest target (the bonus coins fly home to it)
  const mat = (o) => new THREE.ShaderMaterial({ ...o, uniforms: { uTime: U.uTime, uTarget: U.uTarget, uSky: U.uSky, uHaveSky: U.uHaveSky, uSkyU: U.uSkyU, ...(o.uniforms || {}) } });
  // an ink twin material: the fill's vertex shader compiled with HULL, flat ink with the city's haze in the fragment
  const hull = (vs, width, px, uniforms) => hullMaterial({ vertexShader: vs, fragmentShader: HULL_FS, width, px, uniforms: { uTime: U.uTime, uTarget: U.uTarget, uSky: U.uSky, uHaveSky: U.uHaveSky, uSkyU: U.uSkyU, ...(uniforms || {}) } });

  /* -- the toilets: 12 instances, one draw and its ink twin. aI0: x, y, z, yaw. aI1: -, flush time (-1 while clogged), scale -- */
  const TOILET_VS = `
      uniform float uTime;
      attribute vec3 aCol; attribute vec4 aInfo; attribute vec4 aI0; attribute vec4 aI1;
      #ifdef HULL
      attribute vec3 aOutline;
      ${HULL_HEAD}
      #endif
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec4 vI; varying float vClean;
      void main() {
        float c = cos(aI0.w), s = sin(aI0.w);
        vec3 p = position * aI1.z;
        vec3 wp = aI0.xyz + vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
        vN = vec3(normal.x * c + normal.z * s, normal.y, -normal.x * s + normal.z * c);
        #ifdef HULL
        wp += normalize(vec3(aOutline.x * c + aOutline.z * s, aOutline.y, -aOutline.x * s + aOutline.z * c)) * max(uInkW, uInkPx * uInkK * distance(wp, cameraPosition));
        #endif
        vW = wp; vC = aCol; vI = aInfo;
        vClean = aI1.y < 0.0 ? 0.0 : smoothstep(0.0, 1.2, uTime - aI1.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`;
  const toiletMat = mat({
    vertexShader: TOILET_VS,
    fragmentShader: `
      ${KIT}
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec4 vI; varying float vClean;
      void main() {
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        int m = int(vI.w + 0.5);
        // everything that takes a derivative is worked out here, in the open
        float ndv = max(dot(N, V), 0.0), fres = pow(1.0 - ndv, 3.0);
        float dots = propDots(vW, N, 0.09);
        float crease = smoothstep(0.5, 0.9, length(fwidth(N))); // an ink line where two faces meet at an edge
        float rimInk = comicInk(ndv, 3.0);
        vec2 g = vW.xz * 1.1; // the bathroom floor: white and grey tiles, blurring to their average from far away
        float ck = mod(floor(g.x) + floor(g.y), 2.0), fw = fwidth(g.x) + fwidth(g.y);
        vec2 gf = abs(fract(g) - 0.5);
        float grout = smoothstep(0.44, 0.5, max(gf.x, gf.y)) * (1.0 - smoothstep(0.2, 0.6, fw));
        float w = 0.5 + 0.5 * sin(vW.x * 4.3 + vW.z * 3.1 + uTime * 3.0);
        if (m == 5 && vClean > 0.5) discard;
        // porcelain is lifted a quarter, so its shade is a light violet and only its lit side clips to cream
        vec3 base = m == 0 ? vC * 1.25 : (m == 4 ? vC * 1.12 : vC); float metal = 0.0, gloss = 0.85;
        if (m == 1) { metal = 0.9; gloss = 0.9; }
        else if (m == 3) {
          gloss = 0.05;
          base = N.y > 0.9 ? mix(mix(vec3(0.9, 0.87, 0.82), vec3(0.5, 0.5, 0.58), ck), vec3(0.7, 0.68, 0.7), smoothstep(0.2, 0.6, fw)) : vec3(0.55, 0.53, 0.6);
        }
        else if (m == 5) { base = ${glv(SLUDGE_LIT)} * 1.22; gloss = 0.95; }
        vec3 col = shadePropX(base, N, V, metal, gloss, dots);
        if (m == 3 && N.y > 0.9) col = mix(col, INKV, grout * 0.85);
        if (m == 5) col = mix(col, INKV, rimInk * 0.9);
        if (m == 2) {
          // the water: sludge that sloshes in two flat greens, or clear blue once it is flushed
          vec3 sl = mix(vec3(0.3, 0.55, 0.1), vec3(0.62, 0.95, 0.2), comicStep(0.55, w));
          vec3 cl = mix(vec3(0.2, 0.5, 0.85), vec3(0.8, 0.96, 1.0), comicStep(0.72, fres + w * 0.25));
          col = mix(sl, cl, vClean);
        } else if (m == 6) col = vC;
        else col = mix(col, INKV, crease * 0.9);
        gl_FragColor = vec4(fogMix(col, vW, 0.9), 1.0);
      }`,
  });
  const clogs = city.clogs.map((c, i) => ({
    i, id: c.id, x: c.x, y: c.y, z: c.z, d: c.district, tid: "clog:" + c.id,
    yaw: Math.atan2(city.start.x - c.x, city.start.z - c.z), // the toilet faces the start roof
    pumps: 0, done: done.has(c.id), level: 1, gurgle: null, told: false,
  }));
  const toilets = instanced(toiletGeo(false), clogs.length, [["aI0", 4], ["aI1", 4, true]], toiletMat, "toilets");
  for (const c of clogs) {
    toilets.a.aI0.array.set([c.x, c.y, c.z, c.yaw], c.i * 4);
    toilets.a.aI1.array.set([0, c.done ? 0 : -1, TOILET_S, 0], c.i * 4);
    c.level = c.done ? 0 : 1;
    c.bx = c.x + Math.sin(c.yaw) * BOWL_Z * TOILET_S; c.bz = c.z + Math.cos(c.yaw) * BOWL_Z * TOILET_S; c.by = c.y + BOWL_Y * TOILET_S;
    c.tx = c.x; c.ty = c.y + CUP_Y * TOILET_S; c.tz = c.z; // the pump target
  }
  root.add(toilets.mesh);
  root.add(twinOf(toilets, toiletGeo(false, true), hull(TOILET_VS, 0.035, 2.4), "toilets"));

  /* -- the fountains: sludge blobs on parabolas, 12 clogs x 24 blobs, one draw. aSt: level, time of the last pump -- */
  const fountMat = mat({
    vertexShader: `
      uniform float uTime;
      attribute vec3 aBase; attribute vec4 aRnd; attribute vec2 aSt;
      varying vec3 vW; varying vec3 vN;
      void main() {
        float lvl = aSt.x;
        float sp = exp(-max(uTime - aSt.y, 0.0) * 2.4);
        float t = fract(uTime * (0.5 + 0.35 * aRnd.z) + aRnd.x);
        float H = (2.6 + 3.8 * aRnd.z + 4.0 * sp) * lvl;
        float y = 4.0 * H * t * (1.0 - t);
        float rk = (0.25 + 1.7 * aRnd.w) * (0.55 + 0.9 * sp) * lvl;
        float r = rk * t;
        float s = (0.16 + 0.2 * aRnd.w) * (0.5 + 0.7 * sp) * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.8, 1.0, t)) * step(0.01, lvl);
        if (s < 0.005) { ${OFF} }
        // each blob stretches along the way it is moving, so the jet reads as a jet
        vec3 vel = vec3(cos(aRnd.y) * rk, 4.0 * H * (1.0 - 2.0 * t), sin(aRnd.y) * rk);
        vec3 dir = normalize(vel + vec3(1e-4));
        vec3 pp = position * s;
        pp += dir * dot(pp, dir) * clamp(length(vel) * 0.1, 0.0, 1.3);
        vW = aBase + vec3(cos(aRnd.y) * r, y, sin(aRnd.y) * r) + pp;
        vN = normalize(normal + dir * dot(normal, dir) * -0.5);
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`,
    fragmentShader: `
      ${KIT}
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        // flat sludge green in three bands with an ink edge and a hard glint: a blob of goo in a comic
        float ink = comicInk(max(dot(N, V), 0.0), 2.0);
        vec3 col = mix(shadeProp(${glv(SLUDGE_LIT)} * 1.22, N, V, 0.0, 0.95), INKV, ink * 0.9);
        gl_FragColor = vec4(fogMix(col, vW, 0.85), 1.0);
      }`,
  });
  const fount = instanced(new THREE.IcosahedronGeometry(1, 1), clogs.length * FOUNT, [["aBase", 3], ["aRnd", 4], ["aSt", 2, true]], fountMat, "sludge");
  for (const c of clogs) for (let k = 0; k < FOUNT; k++) {
    const n = c.i * FOUNT + k;
    fount.a.aBase.array.set([c.bx, c.by, c.bz], n * 3);
    fount.a.aRnd.array.set([rand(), rand() * TAU, rand(), rand()], n * 4);
    fount.a.aSt.array.set([c.done ? 0 : 1, -99], n * 2);
  }
  root.add(fount.mesh);

  /* -- beacons: flat lime beams with ink edges that break into dots high up, one draw for the clogs, the King and the trial pads -- */
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0);
  const beamMat = mat({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 aBase; attribute vec2 aDim; attribute vec3 aCol; attribute float aLvl;
      varying vec3 vW; varying float vY; varying vec3 vC; varying float vL; varying vec3 vR; varying vec2 vAx; varying float vRad;
      void main() {
        if (aLvl < 0.004) { ${OFF} }
        vec3 axis = aBase + vec3(0.0, position.y * aDim.y, 0.0);
        // wider with height, and never thinner than a pixel or two from far away
        float rr = max(aDim.x * (1.0 + 0.5 * position.y), distance(axis, cameraPosition) * 0.006);
        vec3 dir = vec3(position.x, 0.0, position.z);
        vW = axis + dir * rr; vY = position.y; vC = aCol; vL = aLvl; vR = dir; vAx = aBase.xz; vRad = rr;
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`,
    fragmentShader: `
      ${KIT}
      varying vec3 vW; varying float vY; varying vec3 vC; varying float vL; varying vec3 vR; varying vec2 vAx; varying float vRad;
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        // 1 where the tube faces you, 0 at its edge
        float rim = abs(dot(normalize(vR), normalize(vec3(V.x, 0.0, V.z) + vec3(1e-4))));
        float dots = comicDots(vec2(atan(vR.z, vR.x) * vRad, vW.y), 0.8, 0.5); // fixed to the beam, not to the screen
        float ink = comicInk(rim, 3.4);
        // the beam fades in print steps and, high up, breaks into dots
        float fade = comicPoster(pow(1.0 - vY, 1.4) * smoothstep(0.0, 0.03, vY), 4.0);
        float body = mix(1.0, dots, smoothstep(0.3, 0.8, vY));
        // pale core, lime body, darker rim, cut hard
        vec3 core = mix(vC, vec3(1.0, 1.0, 0.72), 0.65), edge = vC * vec3(0.5, 0.78, 0.42);
        vec3 col = mix(edge, mix(vC, core, comicStep(0.72, rim)), comicStep(0.26, rim));
        float k = mix(0.22, 1.0, smoothstep(4.0, 45.0, distance(cameraPosition.xz, vAx))) * (1.0 - 0.75 * fogAmt(vW)) * vL; // thin near, hazy far
        float a = fade * body * 0.7 * k;
        float aInk = ink * min(1.0, fade * 1.3) * (1.0 - smoothstep(0.5, 0.85, vY)) * k;
        gl_FragColor = vec4(mix(col, INKV, ink), max(a, aInk * 0.9));
      }`,
  });
  const beams = instanced(beamGeo, 16, [["aBase", 3], ["aDim", 2], ["aCol", 3], ["aLvl", 1, true]], beamMat, "beacons");
  const beamLvl = new Float32Array(16), beamWant = new Float32Array(16);
  const setBeam = (i, x, y, z, r, h, hex) => { beams.a.aBase.array.set([x, y, z], i * 3); beams.a.aDim.array.set([r, h], i * 2); beams.a.aCol.array.set(rgb(hex), i * 3); };
  beams.mesh.renderOrder = 20; // the see-through things draw after the city, in this order
  root.add(beams.mesh);
  let beamDirty = false;

  /* -- coins: 80 in the world and a ring of slots for the bonus coins that burst out of a flush, one draw and its ink twin -- */
  const COIN_VS = `
      uniform float uTime; uniform vec3 uTarget;
      attribute vec3 aCol; attribute vec4 aInfo; attribute vec3 aPos; attribute vec3 aVel; attribute vec4 aSt;
      #ifdef HULL
      attribute vec3 aOutline;
      ${HULL_HEAD}
      #endif
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vP;
      void main() {
        vec3 c = aPos; float sc = 1.0;
        if (aSt.z >= 0.0) {
          // a bonus coin: out of the toilet in an arc, then home to your chest, where the bank is
          float age = uTime - aSt.z;
          if (age < 0.0 || age > 2.3) { ${OFF} }
          float a = min(age, 0.9);
          c = aPos + aVel * a; c.y -= 3.9 * a * a;
          float h = smoothstep(0.9, 2.1, age);
          c = mix(c, uTarget, h * h);
          sc = 0.8 * (1.0 - smoothstep(2.0, 2.3, age));
        } else {
          c.y += 0.22 * sin(uTime * 1.7 + aSt.x);
          if (aSt.y < 1e8) {
            // picked up: a quick pop
            float age = uTime - aSt.y;
            if (age > 0.3) { ${OFF} }
            sc = (1.0 + 2.5 * age) * (1.0 - age / 0.3);
          }
        }
        // a far coin keeps a size you can spot, about 0.6 degrees across
        sc *= clamp(distance(c, cameraPosition) * 0.0055 / ${COIN_R.toFixed(2)}, 1.0, 5.0);
        float an = uTime * 2.6 + aSt.x, ca = cos(an), sa = sin(an);
        vec3 p = position * sc;
        vec3 wp = c + vec3(p.x * ca + p.z * sa, p.y, -p.x * sa + p.z * ca);
        vN = vec3(normal.x * ca + normal.z * sa, normal.y, -normal.x * sa + normal.z * ca);
        #ifdef HULL
        // (a coin that shrinks to nothing takes its line with it)
        wp += normalize(vec3(aOutline.x * ca + aOutline.z * sa, aOutline.y, -aOutline.x * sa + aOutline.z * ca)) * max(uInkW, uInkPx * uInkK * distance(wp, cameraPosition)) * clamp(sc, 0.0, 1.0);
        #endif
        vW = wp; vC = aCol; vP = aInfo.x;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`;
  const coinMat = mat({
    vertexShader: COIN_VS,
    fragmentShader: `
      ${KIT}
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vP;
      void main() {
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        float crease = smoothstep(0.5, 0.9, length(fwidth(N))); // the inked edge of the raised middle
        vec3 col = shadeProp(vC, N, V, 0.45, 0.3);
        // a glint each time a face swings toward the sun: a hard white flash, small, so the coin stays gold
        col = mix(col, vec3(1.0, 0.96, 0.8), comicStep(0.985, dot(N, normalize(SUN + V))) * 0.85);
        col = mix(col, INKV, crease * 0.85);
        gl_FragColor = vec4(fogMix(col, vW, 0.5), 1.0);
      }`,
  });
  const coins = instanced(coinGeo(), COINS + BURST, [["aPos", 3], ["aVel", 3], ["aSt", 4, true]], coinMat, "loonies");
  for (const L of city.loonies) {
    coins.a.aPos.array.set([L.x, L.y, L.z], L.id * 3);
    // aSt: spin phase, the time it was picked up (1e9 while it waits; -100 for one from an earlier session), -1 (not a bonus coin)
    coins.a.aSt.array.set([rand() * TAU, got.has(L.id) ? -100 : 1e9, -1, 0], L.id * 4);
  }
  for (let k = 0; k < BURST; k++) coins.a.aSt.array.set([0, 1e9, 1e9, 0], (COINS + k) * 4);
  root.add(coins.mesh);
  root.add(twinOf(coins, coinGeo(true), hull(COIN_VS, 0.045, 2.6), "loonies"));
  let burstHead = 0;

  /* -- rings: the trial's next three, the tutorial's gold ring, two pass flashes and the three start pads, one draw -- */
  const ringGeoB = partsBuilder();
  ringGeoB.add(new THREE.TorusGeometry(1, 0.06, 8, 44), new THREE.Matrix4(), 0xffffff, [0, 0, 0, 0]);
  ringGeoB.add(new THREE.CircleGeometry(0.94, 40), new THREE.Matrix4(), 0xffffff, [1, 0, 0, 0]);
  const ringMat = mat({
    ...blendPre, side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      attribute vec3 aCol; attribute vec4 aInfo; attribute vec4 aC; attribute vec4 aN; attribute vec4 aF;
      varying vec3 vW; varying vec3 vN; varying float vPart; varying vec4 vS; varying vec2 vLoc;
      void main() {
        float st = aN.w;
        if (st < 0.5) { ${OFF} }
        vec3 n = normalize(aN.xyz);
        vec3 ax = abs(n.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), n));
        vec3 ay = cross(n, ax);
        float sc = aC.w, age = uTime - aF.x;
        if (st > 5.5 && st < 6.5) { if (age > 0.5) { ${OFF} } sc *= 1.0 + 1.1 * age / 0.5; }
        vec3 p = position;
        float dist = distance(aC.xyz, cameraPosition);
        if (aInfo.x < 0.5) {
          // the tube stays at least a few pixels thick from far away
          vec2 dir = normalize(position.xy + vec2(1e-6));
          float k = max(1.0, dist * 0.0055 / (0.06 * sc));
          p = vec3(dir, 0.0) + (position - vec3(dir, 0.0)) * k;
        }
        p *= sc;
        vLoc = p.xy;
        vW = aC.xyz + ax * p.x + ay * p.y + n * p.z;
        vN = ax * normal.x + ay * normal.y + n * normal.z;
        vPart = aInfo.x; vS = vec4(st, age, aF.y, aF.z);
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`,
    fragmentShader: `
      ${KIT}
      varying vec3 vW; varying vec3 vN; varying float vPart; varying vec4 vS; varying vec2 vLoc;
      void main() {
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        float st = vS.x, pulse = 0.8 + 0.2 * sin(uTime * 6.0);
        float ndv = abs(dot(N, V));
        float dots = comicDots(vLoc, 0.32, 0.55); // the disc's dots stay on the ring
        float rim = comicInk(ndv, 3.6);
        vec3 c; float a = 1.0;
        if (st < 1.5) c = vec3(0.7, 1.0, 0.95);            // the next ring
        else if (st < 2.5) c = vec3(0.16, 0.7, 0.78);      // the rings after it
        else if (st < 3.5) c = vec3(1.0, 0.76, 0.26);      // the tutorial's gold ring
        else if (st < 4.5) c = vec3(0.55, 0.92, 1.0);      // a start pad
        else if (st < 5.5) c = vec3(1.0, 0.5, 0.2);        // the intense pad
        else c = vec3(1.0, 0.97, 0.85);                    // a ring that was just passed
        if (st < 1.5 || (st > 2.5 && st < 3.5)) c *= pulse;
        // a flat tube in the cel light, half its own colour kept so it glows, and an ink line round it
        vec3 col = mix(shadePropX(c, dot(N, V) < 0.0 ? -N : N, V, 0.0, 0.6, 0.0), c, 0.55);
        col = mix(col, INKV, rim * (vPart < 0.5 ? 0.92 : 0.0));
        float add = 0.0;
        if (vPart > 0.5) {
          // the disc: a light of dots that fills the ring, and fills up while you stand on a pad
          add = 1.0;
          col = c;
          a = (st > 3.5 && st < 5.5) ? 0.16 + 0.5 * vS.z : (st < 2.5 ? 0.16 : 0.1);
          if (st > 5.5) a = 0.3 * (1.0 - vS.y / 0.5);
          a *= 0.15 + 2.2 * dots;
        } else if (st > 5.5) a = 1.0 - vS.y / 0.5;
        a *= 1.0 - 0.4 * fogAmt(vW);
        gl_FragColor = vec4(col * a, a * (1.0 - add));
      }`,
  });
  const rings = instanced(ringGeoB.build(), 9, [["aC", 4, true], ["aN", 4, true], ["aF", 4, true]], ringMat, "rings");
  rings.mesh.renderOrder = 21;
  root.add(rings.mesh);
  let ringDirty = false, flashHead = 0;
  const ringSet = (slot, x, y, z, nx, ny, nz, sc, st, t0 = -9, prog = 0) => {
    rings.a.aC.array.set([x, y, z, sc], slot * 4); rings.a.aN.array.set([nx, ny, nz, st], slot * 4); rings.a.aF.array.set([t0, prog, 0, 0], slot * 4);
    ringDirty = true;
  };

  /* -- labels over the three trial pads: one texture, one draw -- */
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 640; labelCanvas.height = 576;
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.NoColorSpace; // display colours: no decoding
  const labelMat = mat({
    ...blendPre, uniforms: { uMap: { value: labelTex } },
    vertexShader: `
      attribute vec4 aL;
      varying vec2 vUv; varying float vA;
      void main() {
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float dist = distance(aL.xyz, cameraPosition);
        float k = max(1.0, dist * 0.03 / 3.0); // never smaller than about 1.7 degrees tall
        vec3 wp = aL.xyz + (right * position.x * 10.0 + up * position.y * 3.0) * k;
        vUv = vec2(uv.x, (2.0 - aL.w + uv.y) / 3.0);
        vA = 1.0 - smoothstep(350.0, 700.0, dist);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv; varying float vA;
      void main() { vec4 t = texture2D(uMap, vUv); float a = t.a * vA; gl_FragColor = vec4(t.rgb * a, a); }`,
  });
  const labels = instanced(new THREE.PlaneGeometry(1, 1), city.trials.length, [["aL", 4]], labelMat, "trial labels");
  labels.mesh.renderOrder = 22;
  root.add(labels.mesh);

  /* -- particles: sparkles, water, sludge, Zzz and fireworks, one draw. aA: start position and time; aB: velocity and life;
        aC: colour and size; aD: type, gravity, drag, additive -- */
  const T_DROP = 0, T_STAR = 1, T_Z = 2, T_SPARK = 3, T_PUFF = 4, T_RING = 5;
  const fxMat = mat({
    ...blendPre,
    vertexShader: `
      uniform float uTime;
      attribute vec4 aA; attribute vec4 aB; attribute vec4 aC; attribute vec4 aD;
      varying vec2 vUv; varying vec4 vCol; varying vec3 vP;
      void main() {
        float age = uTime - aA.w, f = age / aB.w;
        if (age < 0.0 || f > 1.0) { ${OFF} }
        float k = aD.z;
        float dt = k > 0.001 ? (1.0 - exp(-k * age)) / k : age;
        vec3 wp = aA.xyz + aB.xyz * dt;
        wp.y -= 4.9 * aD.y * age * age;
        float size = aC.w;
        if (aD.x > 4.5) size *= 0.25 + 1.7 * f;
        else if (aD.x > 1.5 && aD.x < 2.5) size *= 0.6 + 0.8 * f;
        else if (aD.x > 3.5) size *= 0.6 + 0.9 * f;
        size = max(size, distance(wp, cameraPosition) * 0.0035);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vUv = uv; vCol = vec4(aC.rgb, fract(aA.x * 7.31 + aA.z * 3.17)); vP = vec3(aD.x, f, aD.w);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp + (right * position.x + up * position.y) * size, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv; varying vec4 vCol; varying vec3 vP;
      ${GLSL.toon}${GLSL.halftone}
      const vec3 INKV = ${INK_GLSL};
      float segd(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
      void main() {
        // every particle is a flat comic shape: a signed distance sd (negative inside) gives the fill and, a little wider, the
        // ink edge. Glows that add light (vP.z = 1) keep the fill and drop the ink.
        vec2 p = vUv * 2.0 - 1.0;
        float px = max(fwidth(p.x), fwidth(p.y)), aa = px * 0.8;
        float r = length(p), ang = atan(p.y, p.x);
        float seed = vCol.a, f = vP.y;
        float life = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.55, 1.0, f));
        vec3 col = vCol.rgb;
        float sd = 1.0, iw = clamp(px * 1.7, 0.09, 0.4);
        float flick = 1.0 + 0.22 * sin(uTime * 30.0 + seed * 40.0);
        int ty = int(vP.x + 0.5);
        if (ty == 0) {
          // a drop of water or sludge: one hard highlight, one hard shade
          sd = r - 0.8;
          col = mix(col, vec3(1.0), (1.0 - smoothstep(0.24 - aa, 0.24 + aa, length(p - vec2(-0.3, 0.3)))) * 0.85);
          col *= mix(1.0, 0.7, comicStep(0.35, dot(p, vec2(0.7, -0.7))));
        } else if (ty == 1) {
          // a sparkle: a four-pointed star that pulses
          vec2 q = p / flick;
          float f4 = sqrt(abs(q.x)) + sqrt(abs(q.y)) - 1.0;
          sd = f4 * px / max(fwidth(f4), 1e-5);
          col = mix(col, vec3(1.0, 0.98, 0.8), 0.55);
        } else if (ty == 2) {
          // a Z: cream with a thick ink edge, so it reads against the sunset
          float d = min(min(segd(p, vec2(-0.55, 0.62), vec2(0.55, 0.62)), segd(p, vec2(0.55, 0.62), vec2(-0.55, -0.62))), segd(p, vec2(-0.55, -0.62), vec2(0.55, -0.62)));
          sd = d - 0.13; iw = 0.14;
        } else if (ty == 3) {
          // a spark of a firework: an eight-pointed burst with a pale middle
          float rs = (0.42 + 0.5 * pow(abs(cos(ang * 4.0)), 3.0)) * flick;
          sd = (r - rs) * 0.8;
          col = mix(col, vec3(1.0, 0.98, 0.85), 1.0 - smoothstep(0.08, 0.34, r));
        } else if (ty == 4) {
          // a puff: a lumpy cloud, cel shaded on its lower right with dots in the shade
          float rs = 0.68 + 0.09 * sin(ang * 5.0 + seed * 6.28) + 0.05 * sin(ang * 9.0 + seed * 37.0);
          sd = r - rs;
          float side = dot(p, vec2(0.55, -0.75));
          vec3 dark = col * vec3(0.55, 0.6, 0.85);
          col = mix(col, dark, max(comicStep(0.15, side), comicDots(p * 2.2, 0.2, 0.5) * 0.4 * smoothstep(-0.2, 0.3, side)));
        } else {
          // a shock ring: a flat band with ink on both edges
          sd = abs(r - 0.78) - 0.1; iw = 0.1;
        }
        float fill = 1.0 - smoothstep(-aa, aa, sd);
        float ink = 1.0 - smoothstep(iw - aa, iw + aa, sd);
        if (vP.z > 0.5) gl_FragColor = vec4(col * fill * life, 0.0);
        else { float A = ink * life; gl_FragColor = vec4(mix(INKV, col, fill) * A, A); }
      }`,
  });
  const fx = instanced(new THREE.PlaneGeometry(1, 1), FX_N, [["aA", 4, true], ["aB", 4, true], ["aC", 4, true], ["aD", 4, true]], fxMat, "particles");
  for (let i = 0; i < FX_N; i++) fx.a.aA.array[i * 4 + 3] = 1e9;
  fx.mesh.renderOrder = 23;
  root.add(fx.mesh);
  let fxHead = 0, fxDirty = false, fxLive = 0;
  // delay: seconds from now until it shows (a rocket's trail)
  const spawn = (type, x, y, z, vx, vy, vz, life, size, col, gravity = 1, drag = 0, add = 1, delay = 0) => {
    const i = fxHead; fxHead = (fxHead + 1) % FX_N;
    fx.a.aA.array.set([x, y, z, T + delay], i * 4); fx.a.aB.array.set([vx, vy, vz, life], i * 4);
    fx.a.aC.array.set([col[0], col[1], col[2], size], i * 4); fx.a.aD.array.set([type, gravity, drag, add], i * 4);
    fxDirty = true; fxLive = Math.max(fxLive, T + delay + life);
  };
  const C_WATER = [0.7, 0.92, 1.0], C_GOLD = [1.0, 0.82, 0.35], C_SLUDGE = [0.55, 0.95, 0.2], C_WHITE = [1, 1, 0.92], C_CREAM = [1.0, 0.93, 0.78];
  const FW = [[1.0, 0.75, 0.3], [1.0, 0.4, 0.55], [0.4, 0.9, 1.0], [0.75, 1.0, 0.45], [1.0, 1.0, 0.9]];
  // a ring of drops thrown up and out: the geyser of a flush, or the spurt of a pump
  const geyser = (x, y, z, n, up, out, size) => {
    for (let k = 0; k < n; k++) { const a = rand() * TAU, s = rand() * out; spawn(T_DROP, x, y, z, Math.cos(a) * s, up * (0.6 + 0.6 * rand()), Math.sin(a) * s, 1.4 + rand() * 1.2, size * (0.6 + 0.8 * rand()), C_WATER, 1.0, 0, 0); }
  };
  const sparkle = (x, y, z, n, spread, col) => {
    for (let k = 0; k < n; k++) spawn(T_STAR, x + (rand() - 0.5) * 2, y + rand() * 2, z + (rand() - 0.5) * 2, (rand() - 0.5) * spread, rand() * spread * 0.8, (rand() - 0.5) * spread, 0.7 + rand() * 0.8, 0.5 + rand() * 0.6, col || (rand() < 0.5 ? C_GOLD : C_WHITE), 0.3, 0.6, 0);
  };
  const sludgeSplat = (x, y, z, n, up) => {
    for (let k = 0; k < n; k++) { const a = rand() * TAU, s = 2 + rand() * 6; spawn(T_DROP, x, y, z, Math.cos(a) * s, up * (0.4 + rand()), Math.sin(a) * s, 0.9 + rand() * 0.8, 0.3 + rand() * 0.5, C_SLUDGE, 1.2, 0, 0); }
    spawn(T_PUFF, x, y + 0.5, z, 0, 1, 0, 1.4, 5, C_SLUDGE, 0, 1, 0);
  };
  // A rocket climbs for a second with a trail of sparks, then bursts into a sphere of sparks. The sparks are mostly plain
  // alpha (not glow), so their colour stands out against the bright sunset sky.
  const firework = (x, y, z, ci) => {
    const col = FW[ci % FW.length], rise = 55;
    spawn(T_SPARK, x, y - rise, z, 0, rise, 0, 1, 3, C_WHITE, 0, 0, 0);
    for (let k = 1; k < 9; k++) spawn(T_SPARK, x, y - rise + (rise * k) / 9, z, 0, -2, 0, 0.7, 1.6, C_GOLD, 0.2, 0.5, 0, k / 9);
    later(1, () => {
      for (let k = 0; k < 80; k++) {
        const u = rand() * 2 - 1, a = rand() * TAU, s = Math.sqrt(1 - u * u), sp = 22 + rand() * 20;
        spawn(T_SPARK, x, y, z, Math.cos(a) * s * sp, u * sp, Math.sin(a) * s * sp, 2 + rand() * 1.2, 5 + rand() * 2.5, col, 0.6, 1.3, 0);
      }
      spawn(T_PUFF, x, y, z, 0, 0, 0, 0.6, 36, [1, 0.96, 0.85], 0, 0, 0);
      sfx("fireworks", { x, y, z }, 0.9);
    });
  };
  const ringWave = (p, col, size, life) => spawn(T_RING, p.x, p.y, p.z, 0, 0, 0, life, size, col, 0, 0, 0);

  /* -- the splat: sludge on the edge of your view for 0.6 s after a hit. An inward sphere on the camera, so both eyes agree -- */
  const splatMat = mat({
    transparent: true, depthTest: false, depthWrite: false, side: THREE.BackSide, uniforms: { uAmt: { value: 0 }, uSeed: { value: 0 } },
    vertexShader: `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    // flat comic goo: blobs grow in from the edge of your view, in three lime tones with an ink outline and a hard glint
    fragmentShader: `
      uniform float uAmt, uSeed;
      varying vec3 vP;
      ${GLSL.toon}
      const vec3 INKV = ${INK_GLSL};
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        vec3 d = normalize(vP);
        float ang = acos(clamp(-d.z, -1.0, 1.0));
        vec2 q = d.xy / max(0.25, -d.z);
        float edge = smoothstep(0.5, 1.1, ang);
        float n = n2(q * 2.3 + uSeed) * 0.6 + n2(q * 5.5 + uSeed * 2.0) * 0.4;
        // it runs down a little as it fades
        n += 0.25 * n2(vec2(q.x * 7.0 + uSeed, q.y * 1.2 + (1.0 - uAmt) * 1.5));
        float m = n * 0.8 + edge * 1.1 - 0.15;
        float w = max(fwidth(m), 1e-3);
        float fill = smoothstep(0.63 - w, 0.63 + w, m);
        float ink = smoothstep(0.63 - 6.0 * w - w, 0.63 - 6.0 * w + w, m);
        vec3 col = mix(vec3(0.24, 0.5, 0.1), mix(vec3(0.55, 0.9, 0.17), vec3(0.78, 1.0, 0.42), comicStep(0.8, n2(q * 9.0 + uSeed * 3.0))), comicStep(0.5, n));
        float a = ink * comicStep(0.02, edge) * smoothstep(0.0, 0.25, uAmt);
        gl_FragColor = vec4(mix(INKV, col, fill), a);
      }`,
  });
  const splat = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), splatMat);
  splat.name = "splat"; splat.renderOrder = 1002; splat.frustumCulled = false; splat.visible = false;
  if (cam) cam.add(splat); else root.add(splat);
  let splatT = 0;

  /* ---------------- the Porcelain King ---------------- */
  const perch = view && view.perch ? view.perch : { x: city.needle.x, y: city.needle.podY1 + 1.1, z: city.needle.z, yaw: 0 };
  const H = KING.height;
  const kingRig = new THREE.Group(); // animated: rise, lean, breathe, turn
  kingRig.name = "the King";
  kingRig.rotation.order = "YXZ";
  kingRig.position.set(perch.x, perch.y, perch.z);
  kingRig.visible = false;
  scene.add(kingRig); // until start() he sits outside the hidden root, so the portal can show him through its hole
  const kingMats = [];
  let kingModel = "loading", stencilRef = null, mouthLocal = new THREE.Vector3(MOUTH[0] * H, MOUTH[1] * H, MOUTH[2] * H);
  const kingUniforms = { uGlow: { value: 0 }, uFlash: { value: 0 }, uMap: { value: null } };
  const KING_VS = `
        #ifndef HAS_MAP
        attribute vec3 aCol; attribute vec4 aInfo;
        #endif
        varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec2 vUv; varying float vM;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; vC = vec3(1.0); vM = 0.0;
          #ifndef HAS_MAP
          vC = aCol; vM = aInfo.w;
          #endif
          gl_Position = projectionMatrix * viewMatrix * w;
        }`;
  // The ink line round him: back faces pushed out along the welded normals, thick, because he is 16 m tall.
  const KING_HULL_VS = `
        attribute vec3 aOutline;
        ${HULL_HEAD}
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          w.xyz += normalize(mat3(modelMatrix) * aOutline) * max(uInkW, uInkPx * uInkK * distance(w.xyz, cameraPosition));
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`;
  function kingHull(mesh) {
    smoothNormals(mesh.geometry);
    const m = hull(KING_HULL_VS, 0.09, 2.6);
    kingMats.push(m);
    const h = new THREE.Mesh(mesh.geometry, m);
    h.name = "the King:outline"; h.frustumCulled = false;
    h.onBeforeRender = (r, sc, cam) => syncInk(r, cam);
    outlines.push(h);
    mesh.add(h);
    applyStencil();
    return h;
  }
  function kingMaterial(map) {
    const m = mat({
      uniforms: kingUniforms, defines: map ? { HAS_MAP: 1 } : {},
      vertexShader: KING_VS,
      fragmentShader: `
        ${KIT}
        uniform float uGlow, uFlash; uniform sampler2D uMap;
        varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec2 vUv; varying float vM;
        void main() {
          vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
          if (!gl_FrontFacing) N = -N;
          float ndv = max(dot(N, V), 0.0);
          float dots = propDots(vW, N, 0.3);
          vec3 g = ${glv(COLORS.sludgeGlow)};
          vec3 base; float metal = 0.0, gloss = 0.8, eye = 0.0, crack = 0.0;
          #ifdef HAS_MAP
          // The painted map is a noisy mosaic: snap it to the comic palette. Pale patches are porcelain (two tones), yellow ones
          // gold, the blue-violet ones the sludge that drips off him (lime, like the cover), the thin dark cracks ink, and the red ones glow green:
          // his eyes and jewels.
          vec3 t = texture2D(uMap, vUv).rgb;
          float lum = dot(t, vec3(0.3, 0.59, 0.11));
          float redK = smoothstep(0.22, 0.4, t.r - max(t.g, t.b));
          float goldK = smoothstep(0.08, 0.2, t.r - t.b) * (1.0 - redK);
          float violK = smoothstep(0.1, 0.25, t.b - t.g) * (1.0 - smoothstep(0.45, 0.6, lum)) * (1.0 - redK);
          crack = smoothstep(0.34, 0.2, lum) * (1.0 - redK) * (1.0 - violK) * (1.0 - goldK);
          base = mix(vec3(1.0, 0.98, 0.92), vec3(0.9, 0.9, 1.0), 1.0 - comicStep(0.78, lum));
          base = mix(base, vec3(0.95, 0.72, 0.2), goldK);
          base = mix(base, ${glv(SLUDGE_LIT)} * 1.22, violK); // the purple of the map is the goo on the cover: lime
          metal = goldK * 0.75;
          eye = redK;
          #else
          base = vC; metal = vM > 0.5 && vM < 1.5 ? 0.9 : 0.0; gloss = vM > 2.5 && vM < 3.5 ? 0.05 : 0.8;
          if (vM > 1.5 && vM < 2.5) base = vec3(0.3, 0.55, 0.1);
          eye = vM > 5.5 ? 1.0 : 0.0;
          #endif
          vec3 col = shadePropX(base, N, V, metal, gloss, dots);
          col = mix(col, INKV, crack * 0.9);
          // awake he glows sludge green: a green rim cut hard, and a tint on his lit side
          float glow = clamp(uGlow, 0.0, 1.0);
          col = mix(col, g, comicStep(0.35, glow) * 0.16);
          col = mix(col, g, comicStep(0.72, 1.0 - ndv) * glow * 0.8);
          // the eyes and jewels: bright green with a pale core, brighter when he is awake
          vec3 glowc = mix(g, vec3(0.92, 1.0, 0.7), comicStep(0.55, ndv));
          col = mix(col, glowc * (0.8 + 0.2 * glow), eye);
          col = mix(col, vec3(1.0, 0.98, 0.9), uFlash);
          gl_FragColor = vec4(fogMix(col, vW, 0.4), 1.0);
        }`,
    });
    kingMats.push(m);
    applyStencil();
    return m;
  }
  function useKingModel(obj, name, mouth) {
    while (kingRig.children.length) kingRig.remove(kingRig.children[0]);
    kingRig.add(obj);
    mouthLocal.copy(mouth);
    kingModel = name;
    findDeck();
    updateKingVisible();
  }
  // The code-built King: a giant toilet with a crown, used when king.glb cannot load.
  function fallbackKing() {
    const g = toiletGeo(true), s = H / 3.5;
    g.scale(s, s, s);
    const m = new THREE.Mesh(g, kingMaterial(null));
    m.frustumCulled = false;
    kingHull(m);
    useKingModel(m, "built", new THREE.Vector3(0, 1.6 * s, 1.1 * s));
  }
  // king.glb: rotate -pi/2 about y, stand it on y = 0 and scale it to GAME.king.height (spec §2).
  async function loadKing() {
    try {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync("/wild/models/king.glb");
      const inner = gltf.scene, holder = new THREE.Group();
      inner.rotation.y = -Math.PI / 2;
      holder.add(inner);
      holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(inner, true), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const k = H / size.y;
      inner.scale.multiplyScalar(k);
      inner.position.set(-c.x * k, -box.min.y * k, -c.z * k);
      holder.updateMatrixWorld(true);
      let count = 0;
      const meshes = [];
      inner.traverse((o) => { if (o.isMesh) meshes.push(o); });
      for (const o of meshes) {
        const map = o.material && o.material.map;
        if (map) {
          map.colorSpace = THREE.NoColorSpace; // the texture is a display colour: no sRGB decoding
          map.anisotropy = 4;
          initTex(map);
        }
        if (!map) throw new Error("king.glb has no colour map");
        kingUniforms.uMap.value = map;
        o.material = kingMaterial(map);
        o.frustumCulled = false;
        kingHull(o);
        count++;
      }
      if (!count) throw new Error("no mesh in king.glb");
      // the mouth: over the middle of him, a little in front (he faces +z after the turn)
      const dims = new THREE.Box3().setFromObject(holder, true), sz = dims.getSize(new THREE.Vector3());
      useKingModel(holder, "glb", new THREE.Vector3(0, MOUTH[1] * H, Math.min(sz.z * 0.5, MOUTH[2] * H)));
    } catch (e) {
      console.info("king.glb did not load, using the built-in King:", e && e.message);
      fallbackKing();
    }
  }
  loadKing();
  // The portal shows the city through a hole with view.stencil(ref). Until the hand-off the King is outside the game root, so
  // he follows the same stencil: he shows through the hole and nowhere else.
  function applyStencil() {
    for (const m of kingMats) {
      m.stencilWrite = stencilRef != null;
      if (stencilRef != null) { m.stencilRef = stencilRef; m.stencilFunc = THREE.EqualStencilFunc; m.stencilFail = m.stencilZFail = m.stencilZPass = THREE.KeepStencilOp; }
    }
  }
  function updateKingVisible() { kingRig.visible = kingModel !== "loading" && K.state !== "gone" && (started ? root.visible : stencilRef != null); }
  if (view && typeof view.stencil === "function") {
    const orig = view.stencil;
    view.stencil = (ref) => { orig.call(view, ref); stencilRef = ref == null ? null : ref; applyStencil(); updateKingVisible(); };
  }

  /* -- the pipes on the pod: three, one instanced mesh -- */
  const PIPE_VS = `
      attribute vec3 aCol; attribute vec4 aInfo;
      #ifdef HULL
      attribute vec3 aOutline;
      ${HULL_HEAD}
      #endif
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vM;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(m) * normal); vC = aCol; vM = aInfo.w;
        #ifdef HULL
        vec3 on = mat3(m) * aOutline;
        if (dot(on, on) > 1e-12) w.xyz += normalize(on) * max(uInkW, uInkPx * uInkK * distance(w.xyz, cameraPosition)); // a ripped pipe has no size
        vW = w.xyz;
        #endif
        gl_Position = projectionMatrix * viewMatrix * w;
      }`;
  const pipeMat = mat({
    vertexShader: PIPE_VS,
    fragmentShader: `
      ${KIT}
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vM;
      void main() {
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        if (!gl_FrontFacing) N = -N;
        float dots = propDots(vW, N, 0.2);
        float crease = smoothstep(0.5, 0.9, length(fwidth(N)));
        float rimInk = comicInk(max(dot(N, V), 0.0), 3.0);
        bool goo = vM > 2.5;
        vec3 col = shadePropX(goo ? ${glv(SLUDGE_LIT)} : vC, N, V, vM > 0.5 && vM < 1.5 ? 0.9 : 0.0, goo ? 0.95 : (vM < 0.5 ? 0.3 : 0.75), dots);
        col = mix(col, INKV, max(crease, goo ? rimInk : 0.0) * 0.9);
        gl_FragColor = vec4(fogMix(col, vW, 0.6), 1.0);
      }`,
  });
  const nd = city.needle;
  const pipes = nd.pipes.map((p, i) => {
    const n = new THREE.Vector3(p.nx, p.ny, p.nz).normalize();
    const base = new THREE.Vector3(p.x, p.y, p.z).addScaledVector(n, -2 * PIPE_S);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    // the cup lands on the end of the pipe, facing out along it
    return { i, id: p.id, tid: "pipe:" + p.id, n, base, q, tip: new THREE.Vector3(p.x, p.y, p.z).addScaledVector(n, 5.7 * PIPE_S - 2 * PIPE_S), pumps: 0, ripped: false, fall: null, gush: 0 };
  });
  const pipeG = pipeGeo();
  smoothNormals(pipeG);
  const pipeMesh = new THREE.InstancedMesh(pipeG, pipeMat, pipes.length);
  pipeMesh.name = "pipes"; pipeMesh.frustumCulled = false;
  pipeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (const p of pipes) pipeMesh.setMatrixAt(p.i, new THREE.Matrix4().compose(p.base, p.q, new THREE.Vector3(1, 1, 1)));
  root.add(pipeMesh);
  { const t = inkTwin(pipeMesh, hull(PIPE_VS, 0.05, 2.4)); outlines.push(t); root.add(t); }

  /* -- the ball -- */
  const BALL_VS = `
      ${HULL_HEAD}
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        #ifdef HULL
        w.xyz += vN * max(uInkW, uInkPx * uInkK * distance(w.xyz, cameraPosition));
        #endif
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`;
  const ballMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(KING.ballRadius, 2), mat({
    vertexShader: BALL_VS.replace(HULL_HEAD, ""),
    fragmentShader: `
      ${KIT}
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        // a ball of goo: flat lime with a shade band, one hard glint and an ink rim just inside the outline
        vec3 col = mix(shadeProp(${glv(SLUDGE_LIT)}, N, V, 0.0, 0.95), INKV, comicInk(max(dot(N, V), 0.0), 2.8) * 0.9);
        gl_FragColor = vec4(fogMix(col, vW, 0.4), 1.0);
      }`,
  }));
  ballMesh.name = "the ball"; ballMesh.frustumCulled = false; ballMesh.visible = false;
  { const t = inkTwin(ballMesh, hull(BALL_VS, 0.04, 2.4)); outlines.push(t); ballMesh.add(t); }
  root.add(ballMesh);

  /* ---------------- clogs ---------------- */
  const clogById = new Map(clogs.map((c) => [c.tid, c]));
  const districts = city.districts.map((d) => ({ id: d.id, name: d.name, all: clogs.filter((c) => c.d === d.id) }));
  const tintDistrict = (d) => { const D = districts[d]; if (D && D.all.length) view.setDistrictClog(d, D.all.filter((c) => !c.done).length / D.all.length); };
  for (const c of clogs) setBeam(c.i, c.x, c.y + 2, c.z, BEAM.clog[0], BEAM.clog[1], 0x8dff4a);
  const gurgleFrom = { x: 0, y: 0, z: 0 };
  let gurgleT = 0;
  // the two nearest clogs gurgle, so you can find them by ear
  function gurgles(dt) {
    gurgleT -= dt;
    if (gurgleT > 0) return;
    gurgleT = 0.3;
    let a = null, b = null, da = 1e9, db = 1e9;
    for (const c of clogs) {
      if (c.done) continue;
      const d = Math.hypot(c.x - HEADP.x, c.y - HEADP.y, c.z - HEADP.z);
      if (d > 300) continue;
      if (d < da) { b = a; db = da; a = c; da = d; } else if (d < db) { b = c; db = d; }
    }
    for (const c of clogs) {
      const want = c === a || c === b;
      if (want && !c.gurgle && audio && audio.loop) c.gurgle = audio.loop("gurgle", { x: c.bx, y: c.by, z: c.bz });
      else if (!want && c.gurgle) { c.gurgle.stop(); c.gurgle = null; }
    }
  }
  function setFountain(c, level, spurt) {
    for (let k = 0; k < FOUNT; k++) {
      const n = (c.i * FOUNT + k) * 2;
      if (level != null) fount.a.aSt.array[n] = level;
      if (spurt != null) fount.a.aSt.array[n + 1] = spurt;
    }
    fount.a.aSt.needsUpdate = true;
  }
  function addBonus(n) {
    const room = GAME.bankMax - got.size - save.bonus;
    save.bonus += clamp(n, 0, Math.max(0, room));
  }
  function setBank() {
    const before = progress.bank, now = bankNow();
    progress.bank = now;
    ropes.setStyle(now); hands.setStyle(now);
    for (const th of [GAME.unlocks.stripe, GAME.unlocks.cup, GAME.unlocks.launcher, GAME.unlocks.fireworks]) {
      if (before < th && now >= th) unlocked(th);
    }
  }
  function unlocked(th) {
    sfx("unlock");
    const U_ = GAME.unlocks;
    toast(th === U_.stripe ? "Loonie bank " + th + ". Your ropes have a gold stripe." : th === U_.cup ? "Loonie bank " + th + ". Your plunger cups are gold." : th === U_.launcher ? "Loonie bank " + th + ". You have the Golden Plunger." : "Loonie bank " + th + ". Every flush has fireworks.");
  }

  // A pump: the toilet spurts and the fountain sinks a little. The third one flushes.
  function pumpClog(c, side) {
    c.pumps++;
    c.level = Math.max(0.35, 1 - 0.22 * c.pumps);
    setFountain(c, c.level, T);
    sludgeSplat(c.bx, c.by, c.bz, 10, 6);
    if (c.pumps >= GAME.pumpsToFlush) flush(c, side, false);
  }
  function flush(c, side, silent) {
    if (c.done) return;
    c.done = true; done.add(c.id);
    progress.clogs = done.size;
    if (!save.clogs.includes(c.id)) save.clogs.push(c.id);
    addBonus(GAME.looniesPerFlush);
    ropes.removeTarget(c.tid);
    for (const r of P.ropes) if (r.state !== "idle" && r.target && r.target.id === c.tid) release(P, r.side);
    if (c.gurgle) { c.gurgle.stop(); c.gurgle = null; }
    toilets.a.aI1.array[c.i * 4 + 1] = T; toilets.a.aI1.needsUpdate = true;
    setFountain(c, 0, null);
    c.level = 0; beamWant[c.i] = 0;
    tintDistrict(c.d);
    if (!silent) {
      const at = { x: c.bx, y: c.by, z: c.bz };
      geyser(at.x, at.y, at.z, 70, 17, 2.2, 0.6);
      sparkle(at.x, at.y + 1, at.z, 36, 9, null);
      spawn(T_PUFF, at.x, at.y + 1, at.z, 0, 2, 0, 1.2, 7, C_WATER, 0, 1, 0);
      ringWave({ x: c.x, y: c.y + 0.2, z: c.z }, C_WATER, 9, 0.9);
      // the bonus coins burst out, then fly home to the bank
      for (let k = 0; k < GAME.looniesPerFlush; k++) {
        const s = COINS + burstHead; burstHead = (burstHead + 1) % BURST;
        const a = (k / GAME.looniesPerFlush) * TAU + rand();
        coins.a.aPos.array.set([at.x, at.y + 1, at.z], s * 3);
        coins.a.aVel.array.set([Math.cos(a) * 4, 12 + rand() * 4, Math.sin(a) * 4], s * 3);
        coins.a.aSt.array.set([rand() * TAU, -1, T + k * 0.06, 0], s * 4);
      }
      coins.a.aPos.needsUpdate = coins.a.aVel.needsUpdate = coins.a.aSt.needsUpdate = true;
      if (bankNow() >= GAME.unlocks.fireworks) firework(c.x, c.y + 32, c.z, c.i);
      sfx("flush", at);
      // FLUSH, big, above the geyser: higher when you are far, so it clears the SPLORT at the bowl
      word("FLUSH", at.x, at.y + Math.min(16, Math.max(3, 0.3 * Math.hypot(at.x - HEADP.x, at.y - HEADP.y, at.z - HEADP.z))), at.z, { scale: 1.7 });
      later(0.5, () => sfx("bank"));
      haptic(0, 1, 160); haptic(1, 1, 160);
      say("clog", 2);
      if (done.size === 1) later(3, () => say("clog", 3));
    }
    setBank();
    // the first flush ends the tutorial
    if (!save.tutorial || tut.step >= 0) tutFinish(false);
    kingOnFlush();
    saveNow();
  }

  /* ---------------- Loonies ---------------- */
  const prevChest = new THREE.Vector3();
  let prevValid = false, chain = 0, chainT = 0;
  function looniesUpdate(dt) {
    chainT -= dt;
    if (chainT <= 0) chain = 0;
    const r2 = GAME.loonieRadius * GAME.loonieRadius;
    const jump = prevValid && prevChest.distanceToSquared(CHEST) > 64; // a teleport: no coins between
    if (jump) prevValid = false;
    const a = prevValid ? prevChest : CHEST;
    const abx = CHEST.x - a.x, aby = CHEST.y - a.y, abz = CHEST.z - a.z, ab2 = abx * abx + aby * aby + abz * abz;
    const LO = city.loonies;
    for (let i = 0; i < LO.length; i++) {
      const L = LO[i];
      if (got.has(L.id)) continue;
      // the closest point of last frame's move to the coin: a fast body cannot skip one
      let t = ab2 > 1e-9 ? ((L.x - a.x) * abx + (L.y - a.y) * aby + (L.z - a.z) * abz) / ab2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = a.x + abx * t - L.x, dy = a.y + aby * t - L.y, dz = a.z + abz * t - L.z;
      if (dx * dx + dy * dy + dz * dz <= r2) collect(L);
    }
    prevChest.copy(CHEST); prevValid = true;
  }
  function collect(L) {
    got.add(L.id); save.loonies.push(L.id);
    progress.loonies = got.size;
    coins.a.aSt.array[L.id * 4 + 1] = T; coins.a.aSt.needsUpdate = true;
    chain = Math.min(chain + 1, 7); chainT = 1.6;
    sfx("loonie", { x: L.x, y: L.y, z: L.z }, 1, 1 + 0.03 * (chain - 1)); // (audio.js has a shimmer near 18 kHz: a pitch over 1.2 would pass the Nyquist limit)
    sparkle(L.x, L.y, L.z, 6, 5, C_GOLD);
    haptic(0, 0.25, 25); haptic(1, 0.25, 25);
    setBank();
    saveNow();
  }

  /* ---------------- trials ---------------- */
  const trials = city.trials.map((t, i) => ({ i, id: t.id, name: t.name, intense: !!t.intense, start: t.start, rings: t.rings, hold: 0 }));
  let trial = null; // the running trial: { t, ring, time, prev }
  const padPlace = (t) => {
    setBeam(PAD_BEAM + t.i, t.start.x, t.start.y, t.start.z, BEAM.pad[0], BEAM.pad[1], t.intense ? 0xff7a3a : 0xa8f0ff);
    beamWant[PAD_BEAM + t.i] = 0.8;
    // the label floats over the pad, and clear of the pod when the pad is on the deck (it would cut the label off)
    const ox = t.start.x - nd.x, oz = t.start.z - nd.z, ol = Math.hypot(ox, oz), out = ol < 30 ? 8 : 0;
    labels.a.aL.array.set([t.start.x + (ox / (ol || 1)) * out, t.start.y + 8.5, t.start.z + (oz / (ol || 1)) * out, t.i], t.i * 4);
    ringSet(PAD_SLOT + t.i, t.start.x, t.start.y + 0.12, t.start.z, 0, 1, 0, PAD_R, t.intense ? 5 : 4, -9, 0);
  };
  // The labels are comic caption boxes: paper, a thick ink border, a hard drop shadow, a little tilt, Bangers lettering.
  const F_COMIC = '"Bangers", Impact, "Arial Black", system-ui, sans-serif', F_UI = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
  const INK_CSS = "#" + PAL.ink.toString(16).padStart(6, "0");
  function drawLabels() {
    const c = labelCanvas.getContext("2d");
    c.clearRect(0, 0, 640, 576);
    trials.forEach((t, i) => {
      const y = i * 192, x0 = 16, y0 = y + 14, w = 596, h = 150;
      c.save();
      c.translate(320, y + 96); c.rotate((i % 2 ? 1 : -1) * 0.022); c.translate(-320, -(y + 96));
      c.fillStyle = INK_CSS; c.fillRect(x0 + 12, y0 + 12, w, h);
      c.fillStyle = t.intense ? "#ff9a4a" : "#ffd84a"; c.fillRect(x0, y0, w, h);
      // dots in the corner, like the caption boxes of the title page
      c.fillStyle = "rgba(216,69,122,0.45)";
      for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 12; gx++) { c.beginPath(); c.arc(x0 + w - 22 - gx * 15 - (gy % 2) * 7, y0 + 18 + gy * 14, 4.2 - gx * 0.25, 0, 7); c.fill(); }
      c.lineWidth = 9; c.strokeStyle = INK_CSS; c.strokeRect(x0, y0, w, h);
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = INK_CSS;
      c.font = "400 78px " + F_COMIC;
      c.fillText(t.name.toUpperCase(), 320, y0 + 50, w - 40);
      c.font = "800 38px " + F_UI;
      c.fillText((t.intense ? "Intense. " : "") + t.rings.length + " rings", 320, y0 + 100);
      const best = save.best[String(t.id)];
      c.fillStyle = t.intense ? "#7a1a0a" : "#8a1a34";
      c.fillText(best ? "Best " + fmtTime(best) : "Stand here to start", 320, y0 + 130);
      c.restore();
    });
    labelTex.needsUpdate = true;
  }
  // the lettering comes with the page's fonts: draw again when they arrive
  if (typeof document !== "undefined" && document.fonts && document.fonts.load) Promise.all([document.fonts.load("40px Bangers"), document.fonts.load("800 40px 'Barlow Condensed'")]).then(() => { if (started) drawLabels(); }).catch(() => {});
  function showRings() {
    for (let k = 0; k < 3; k++) {
      const r = trial && trial.t.rings[trial.ring + k];
      if (r) ringSet(RING_SLOT + k, r.x, r.y, r.z, r.nx, r.ny, r.nz, r.r || GAME.ringRadius, k === 0 ? 1 : 2);
      else ringSet(RING_SLOT + k, 0, 0, 0, 0, 1, 0, 1, 0);
    }
  }
  function startTrial(t) {
    trial = { t, ring: 0, time: 0, prev: new THREE.Vector3().copy(CHEST) };
    progress.trial = { id: t.id, ring: 0, time: 0 };
    for (const o of trials) o.hold = 0;
    showRings();
    sfx("trialStart", { x: t.start.x, y: t.start.y, z: t.start.z });
    saySoon("Fly through the rings.", 3);
    haptic(0, 0.6, 80); haptic(1, 0.6, 80);
  }
  function endTrial(msg) {
    trial = null; progress.trial = null;
    showRings();
    if (msg) toast(msg);
  }
  function cancelTrial() { if (trial) endTrial("Trial ended."); }
  function trialsUpdate(dt) {
    if (!trial) {
      for (const t of trials) {
        const dx = P.pos.x - t.start.x, dz = P.pos.z - t.start.z;
        const on = P.onGround && dx * dx + dz * dz < PAD_R * PAD_R && Math.abs(P.pos.y - t.start.y) < 1.5;
        const was = t.hold;
        t.hold = on ? t.hold + dt : Math.max(0, t.hold - dt * 2);
        if (t.hold !== was) { rings.a.aF.array[(PAD_SLOT + t.i) * 4 + 1] = clamp(t.hold / GAME.trialStartHold, 0, 1); ringDirty = true; }
        if (t.hold >= GAME.trialStartHold) { startTrial(t); break; }
      }
      return;
    }
    trial.time += dt;
    progress.trial.time = trial.time;
    if (trial.time > TRIAL_MAX) { endTrial("Time is up. Trial ended."); return; }
    const r = trial.t.rings[trial.ring];
    if (r) {
      // the chest's move since last frame crosses the ring's plane inside its radius
      const p = trial.prev, d0 = (p.x - r.x) * r.nx + (p.y - r.y) * r.ny + (p.z - r.z) * r.nz, d1 = (CHEST.x - r.x) * r.nx + (CHEST.y - r.y) * r.ny + (CHEST.z - r.z) * r.nz;
      if ((d0 <= 0 && d1 > 0) || (d0 >= 0 && d1 < 0)) {
        const k = d0 / (d0 - d1), px = p.x + (CHEST.x - p.x) * k, py = p.y + (CHEST.y - p.y) * k, pz = p.z + (CHEST.z - p.z) * k;
        const rad = r.r || GAME.ringRadius;
        if ((px - r.x) ** 2 + (py - r.y) ** 2 + (pz - r.z) ** 2 <= rad * rad) ringPassed(r);
      }
    }
    if (trial) trial.prev.copy(CHEST);
  }
  function ringPassed(r) {
    ringSet(FLASH_SLOT + flashHead, r.x, r.y, r.z, r.nx, r.ny, r.nz, r.r || GAME.ringRadius, 6, T);
    flashHead = (flashHead + 1) % 2;
    sfx("ring", { x: r.x, y: r.y, z: r.z }, 1, 1 + 0.015 * trial.ring);
    haptic(0, 0.5, 40); haptic(1, 0.5, 40);
    trial.ring++;
    progress.trial.ring = trial.ring;
    if (trial.ring >= trial.t.rings.length) { finishTrial(); return; }
    showRings();
  }
  function finishTrial() {
    const t = trial.t, time = trial.time, key = String(t.id), old = save.best[key];
    const best = !old || time < old;
    if (best) save.best[key] = +time.toFixed(2);
    sfx("trialEnd");
    endTrial(t.name + ": " + fmtTime(time) + (best ? ". New best." : ". Best " + fmtTime(old) + "."));
    drawLabels();
    saveNow();
  }

  /* ---------------- the King ---------------- */
  const K = {
    state: save.king === "beaten" ? "gone" : save.king, // sleeping | awake | gone (flushed)
    t: 0, yaw: perch.yaw + Math.PI, wake: 9, windT: 0, cd: KING.firstDelay, grace: 0, recoil: 0, react: 0,
    snore: null, ball: null, zzz: 0, respawn: 0, whistle: null, lean: 0.16, rise: 0, stretch: 0.955, flash: 0, glow: 0,
  };
  const deck = { x: nd.x, y: nd.deck.y, z: nd.z }; // where you go when the hearts run out: the deck, out of his sight
  const kingLog = { balls: [], throws: 0, hits: 0, misses: 0 };
  const mouthWorld = (out) => { kingRig.updateMatrixWorld(true); return out.copy(mouthLocal).applyMatrix4(kingRig.matrixWorld); };
  const losClear = (o, x, y, z) => {
    const dx = x - o.x, dy = y - o.y, dz = z - o.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return d < 1 || !city.raycast(o.x, o.y, o.z, dx, dy, dz, d - 0.4, HIT);
  };
  // The deck spot: the point round the pod rim that the King cannot see (the pod and the antenna are in the way).
  function findDeck() {
    kingRig.rotation.set(0, K.yaw, 0);
    const o = mouthWorld(V1), pref = Math.atan2(perch.z - nd.z, perch.x - nd.x) + Math.PI;
    let best = null;
    for (let k = 0; k < 72; k++) {
      const a = pref + wrapPi(((k % 2 ? 1 : -1) * Math.ceil(k / 2) * TAU) / 72), r = (nd.podR + nd.deck.r) / 2;
      const x = nd.x + Math.cos(a) * r, z = nd.z + Math.sin(a) * r;
      if (!losClear(o, x, deck.y + 1.25, z)) { best = { x, z }; break; }
    }
    if (best) { deck.x = best.x; deck.z = best.z; } else { deck.x = nd.x + (nd.podR + nd.deck.r) / 2; }
  }
  findDeck();
  const kingBeamPlace = () => setBeam(KING_BEAM, perch.x, perch.y, perch.z, BEAM.king[0], BEAM.king[1], COLORS.sludgeGlow);

  // one place for all King transforms
  function poseKing(dt) {
    if (K.state === "gone") return;
    K.t = (K.t || 0) + dt;
    let lean, rise, stretch, glow = 0, roll = 0;
    if (K.state === "sleeping" && K.react <= 0) {
      lean = 0.16 + 0.01 * Math.sin(K.t * 1.7); rise = 0; stretch = 0.955 + 0.014 * Math.sin((K.t * TAU) / 3.6);
    } else {
      const e = ss(0, 2.2, K.wake), w = K.windT > 0 ? ss(0, 1, 1 - K.windT / KING.windUp) : 0;
      const reactK = K.react > 0 ? Math.sin(Math.min(1, K.react / 2.5) * Math.PI) : 0;
      const up = K.state === "awake" ? e : reactK;
      lean = lerp(0.16, -0.04 + 0.02 * Math.sin(K.t * 1.1), up) - 0.3 * w + K.recoil * 0.35 - 0.12 * reactK;
      rise = 0.5 * up + 1.6 * w; stretch = lerp(0.955, 1.0, up) + 0.08 * w + 0.02 * reactK;
      glow = K.state === "awake" ? Math.max(0.35 * e, w) : reactK * 0.8;
      roll = 0.04 * Math.sin(K.t * 1.3) * up + (K.wake < 1.8 && K.state === "awake" ? 0.05 * Math.sin(K.t * 34) * (1 - K.wake / 1.8) : 0);
    }
    K.recoil = Math.max(0, K.recoil - dt * 4);
    K.lean = lean; K.rise = rise; K.stretch = stretch;
    kingRig.position.set(perch.x, perch.y + rise, perch.z);
    kingRig.rotation.set(lean, K.yaw, roll);
    kingRig.scale.set(1, stretch, 1);
    kingUniforms.uGlow.value = glow + K.glow; kingUniforms.uFlash.value = K.flash;
    kingRig.updateMatrixWorld(true);
  }

  function wakeKing(loud) {
    if (K.state !== "sleeping") return;
    K.state = "awake"; K.wake = 0; K.windT = 0; K.cd = KING.firstDelay; K.grace = 0;
    progress.king = save.king = "awake";
    if (K.snore) { K.snore.stop(); K.snore = null; }
    mouthWorld(MOUTHP);
    sfx("kingRoar", MOUTHP, 1.2);
    ringWave(MOUTHP, C_SLUDGE, 12, 1.2);
    view.setKing(1);
    beamWant[KING_BEAM] = 1;
    for (const p of pipes) if (!p.ripped) addPipeTarget(p);
    if (loud !== false) { say("king", 1); later(4, () => say("king", 2)); }
    saveNow();
  }
  function addPipeTarget(p) { ropes.addTarget({ id: p.tid, tag: "pipe", pos: { x: p.tip.x, y: p.tip.y, z: p.tip.z }, radius: 2.2, normal: { x: p.n.x, y: p.n.y, z: p.n.z } }); }

  // 4 and 8 flushes wake him for a moment: a roar, the beam flares, and one lob at the roof that was just flushed
  function kingOnFlush() {
    if (K.state === "sleeping") {
      if (done.size >= KING.unlock) { say("king", 0); later(3.5, () => wakeKing(true)); return; }
      const i = KING.reactAt.indexOf(done.size);
      if (i >= 0) {
        K.react = 2.5; beamWant[KING_BEAM] = 1; kingBeamPlace();
        mouthWorld(MOUTHP);
        sfx("kingRoar", MOUTHP, 1);
        ringWave(MOUTHP, C_SLUDGE, 12, 1.2);
        say("king", 4 + i);
        const c = lastFlushed;
        if (c && !K.ball) lob(c);
      }
    }
  }
  let lastFlushed = null;

  // One ball at a time. The lob at a flushed roof is only for show: it hurts nobody.
  function makeBall(o, to, flight, cosmetic) {
    const g = KING.ballGravity;
    const v = new THREE.Vector3((to.x - o.x) / flight, (to.y - o.y) / flight + 0.5 * g * flight, (to.z - o.z) / flight);
    const b = { o: new THREE.Vector3().copy(o), v, T: flight, t: 0, pos: new THREE.Vector3().copy(o), prev: new THREE.Vector3().copy(o), cosmetic, minDist: 1e9, hit: false, trail: 0, id: kingLog.balls.length };
    K.ball = b;
    ballMesh.visible = true;
    ballMesh.position.copy(o);
    if (audio && audio.loop) K.whistle = audio.loop("whistle", { x: o.x, y: o.y, z: o.z });
    return b;
  }
  function lob(c) {
    mouthWorld(MOUTHP);
    const to = { x: c.x, y: c.y + 0.5, z: c.z }, d = Math.hypot(to.x - MOUTHP.x, to.y - MOUTHP.y, to.z - MOUTHP.z);
    makeBall(MOUTHP, to, clamp(d / 70, 2.5, 9), true);
  }
  function endBall(hitPoint, splatIt) {
    const b = K.ball;
    if (!b) return;
    ballMesh.visible = false;
    if (K.whistle) { K.whistle.stop(); K.whistle = null; }
    if (splatIt && hitPoint) { sludgeSplat(hitPoint.x, hitPoint.y, hitPoint.z, 16, 5); sfx("splat", { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z }); }
    if (!b.cosmetic) {
      const rec = kingLog.balls[kingLog.balls.length - 1];
      if (rec) { rec.minDist = +b.minDist.toFixed(3); rec.ended = true; rec.hit = b.hit; }
      if (!b.hit) kingLog.misses++;
    }
    K.ball = null;
  }
  // the player's head and chest (the chest hangs under the head, so ducking and leaning dodge)
  const segDist = (p, q, x, y, z) => {
    const abx = q.x - p.x, aby = q.y - p.y, abz = q.z - p.z, ab2 = abx * abx + aby * aby + abz * abz;
    let t = ab2 > 1e-9 ? ((x - p.x) * abx + (y - p.y) * aby + (z - p.z) * abz) / ab2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(p.x + abx * t - x, p.y + aby * t - y, p.z + abz * t - z);
  };
  function ballUpdate(dt) {
    const b = K.ball, g = KING.ballGravity;
    b.t += dt;
    b.prev.copy(b.pos);
    b.pos.set(b.o.x + b.v.x * b.t, b.o.y + b.v.y * b.t - 0.5 * g * b.t * b.t, b.o.z + b.v.z * b.t);
    ballMesh.position.copy(b.pos);
    // far away it stays a spot you can see
    const dist = b.pos.distanceTo(HEADP);
    ballMesh.scale.setScalar(Math.max(1, (dist * 0.005) / KING.ballRadius));
    ballMesh.rotation.y += dt * 4; ballMesh.updateMatrixWorld(true);
    if (K.whistle) K.whistle.setPos(b.pos);
    b.trail -= dt;
    if (b.trail <= 0) { b.trail = 0.05; spawn(T_PUFF, b.pos.x, b.pos.y, b.pos.z, 0, 0.3, 0, 0.9, 1.6, C_SLUDGE, 0, 0.5, 0); }
    // the city first: a ball does not pass through a wall to reach you
    const dx = b.pos.x - b.prev.x, dy = b.pos.y - b.prev.y, dz = b.pos.z - b.prev.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 1e-4) {
      const h = city.raycast(b.prev.x, b.prev.y, b.prev.z, dx, dy, dz, len, HIT);
      if (h) { endBall({ x: h.x, y: h.y, z: h.z }, true); return; }
    }
    // then the player: the ball's path this frame against the head and the chest. A hit shows as the splat on your view, not as
    // a cloud in front of your face.
    if (!b.cosmetic && !b.hit) {
      const dh = segDist(b.prev, b.pos, HEADP.x, HEADP.y, HEADP.z), dc = segDist(b.prev, b.pos, BODY.x, BODY.y, BODY.z), d = Math.min(dh, dc);
      b.minDist = Math.min(b.minDist, d);
      if (d <= KING.ballRadius + KING.hitRadius) { b.hit = true; hurt(); endBall(null, false); return; }
    }
    const gy = city.isWater(b.pos.x, b.pos.z) ? PERF.waterY : city.groundY(b.pos.x, b.pos.z);
    if (b.pos.y <= gy || b.t > b.T + 6) endBall({ x: b.pos.x, y: Math.max(gy, b.pos.y), z: b.pos.z }, b.pos.y <= gy);
  }

  function hurt() {
    kingLog.hits++;
    splatT = 0.6; splatMat.uniforms.uSeed.value = rand() * 50;
    sfx("splat");
    // GLUG in the air 2.2 m back along the ball's path, so it is where you saw the ball, not on your face
    const bl = K.ball, bv = bl ? Math.hypot(bl.v.x, bl.v.y, bl.v.z) || 1 : 1;
    if (bl) word("GLUG", bl.pos.x - (bl.v.x / bv) * 2.2, bl.pos.y - (bl.v.y / bv) * 2.2 + 0.3, bl.pos.z - (bl.v.z / bv) * 2.2, { scale: 1.3 });
    haptic(0, 1, 120); haptic(1, 1, 120);
    K.grace = KING.grace;
    if (gFlags().god) return; // ?god: no hearts lost
    progress.hearts = Math.max(0, progress.hearts - 1);
    hands.setHearts(progress.hearts);
    if (progress.hearts <= 0) { K.respawn = 0.5; if (ui && ui.fade) ui.fade(1, 0.4, look()); }
  }
  function refill() { progress.hearts = KING.hearts; hands.setHearts(progress.hearts); }

  // the King: sleeping (snore and Zzz), waking, winding up, throwing
  function kingUpdate(dt, input) {
    if (K.state === "gone") return;
    // the beam follows the state: on while he is awake or reacting
    if (K.react > 0) { K.react -= dt; if (K.react <= 0 && K.state === "sleeping") beamWant[KING_BEAM] = 0; }
    if (K.state === "sleeping") {
      kingSleep(dt);
    } else if (K.state === "awake") {
      K.wake += dt;
      // he turns to face you
      if (!fin.on) {
        const want = Math.atan2(HEADP.x - perch.x, HEADP.z - perch.z);
        K.yaw += wrapPi(want - K.yaw) * (1 - Math.exp(-dt * 3));
        kingFight(dt);
      }
    }
    poseKing(dt);
  }
  function kingSleep(dt) {
    if (!K.snore && audio && audio.loop && kingModel !== "loading") { mouthWorld(MOUTHP); K.snore = audio.loop("kingSnore", { x: MOUTHP.x, y: MOUTHP.y, z: MOUTHP.z }); }
    K.zzz -= dt;
    if (K.zzz <= 0 && K.react <= 0) {
      K.zzz = 1.5;
      // a Z rises from his mouth, drifting to his right
      mouthWorld(MOUTHP);
      kingRig.getWorldQuaternion(Q1);
      V2.set(1, 0, 0).applyQuaternion(Q1);
      spawn(T_Z, MOUTHP.x, MOUTHP.y + 1.5, MOUTHP.z, V2.x * 1.4, 3.2, V2.z * 1.4, 5, 7, C_CREAM, 0, 0, 0);
    }
  }
  function kingFight(dt) {
    K.grace = Math.max(0, K.grace - dt);
    if (K.respawn > 0) {
      K.respawn -= dt;
      if (K.respawn <= 0) {
        moveTo(deck.x, deck.y, deck.z);
        refill();
        K.cd = KING.grace; K.grace = 0;
        if (ui && ui.fade) ui.fade(0, 0.5, look());
        saySoon("Out of hearts. Rest on the deck.", 4);
      }
      return;
    }
    if (K.ball) { ballUpdate(dt); return; }
    if (K.wake < 2.5) return;
    if (K.windT > 0) {
      K.windT -= dt;
      if (K.windT <= 0) { K.windT = 0; releaseBall(); }
      return;
    }
    K.cd -= dt;
    if (K.cd <= 0 && K.grace <= 0) {
      // wind up only with a clear line to you, close enough to matter
      mouthWorld(MOUTHP);
      if (BODY.distanceTo(MOUTHP) <= KING_RANGE && losClear(MOUTHP, BODY.x, BODY.y, BODY.z)) {
        K.windT = KING.windUp;
        sfx("kingRoar", MOUTHP, 0.9);
        ringWave(MOUTHP, C_SLUDGE, 9, 0.9);
      } else K.cd = 0.5;
    }
  }
  // the ball leaves at the end of the wind-up, and only if the line is still clear
  function releaseBall() {
    mouthWorld(MOUTHP);
    const ok = losClear(MOUTHP, BODY.x, BODY.y, BODY.z) && BODY.distanceTo(MOUTHP) <= KING_RANGE;
    if (!ok) { K.cd = 1; return; }
    const d = BODY.distanceTo(MOUTHP);
    kingLog.throws++;
    kingLog.balls.push({ n: kingLog.throws, t: +T.toFixed(3), from: [MOUTHP.x, MOUTHP.y, MOUTHP.z], to: [BODY.x, BODY.y, BODY.z], los: true, dist: +d.toFixed(2), minDist: null, hit: false, ended: false });
    if (kingLog.balls.length > 40) kingLog.balls.shift();
    makeBall(MOUTHP, BODY, Math.max(0.8, d / KING.ballSpeed), false);
    K.recoil = 1; K.cd = KING.throwEvery;
    sfx("kingRoar", MOUTHP, 0.5, 1.4);
  }
  function moveTo(x, y, z) {
    teleport(P, x, y, z);
    const g = typeof window !== "undefined" ? window.G : null;
    if (g && g.placeRig) g.placeRig(g.rigYaw, x, y, z);
  }

  /* ---------------- the pipes and the finale ---------------- */
  function pumpPipe(p) {
    p.pumps++;
    sludgeSplat(p.tip.x, p.tip.y, p.tip.z, 8, 5);
    if (p.pumps >= GAME.pumpsToFlush) ripPipe(p);
  }
  function ripPipe(p) {
    p.ripped = true;
    if (!save.pipes.includes(p.id)) save.pipes.push(p.id);
    ropes.removeTarget(p.tid);
    for (const r of P.ropes) if (r.state !== "idle" && r.target && r.target.id === p.tid) release(P, r.side);
    sfx("pipeRip", p.tip, 1.2);
    word("FLUSH", p.tip.x, p.tip.y + 2, p.tip.z, { scale: 1.5 });
    haptic(0, 1, 200); haptic(1, 1, 200);
    // it tumbles to the street
    p.fall = { pos: p.base.clone(), vel: p.n.clone().multiplyScalar(9).add(new THREE.Vector3(0, 4, 0)), q: p.q.clone(), spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(6), t: 0 };
    p.gush = 5;
    refill();
    K.grace = KING.grace;
    if (K.ball) endBall(null, false);
    const left = pipes.filter((q) => !q.ripped).length;
    if (left === 0) beginFinale(); else say("king", 4);
    saveNow();
  }
  const M4 = new THREE.Matrix4(), EU = new THREE.Euler(), ONE = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Vector3(0, 0, 0);
  function pipesUpdate(dt) {
    for (const p of pipes) {
      if (p.gush > 0) {
        p.gush -= dt;
        spawn(T_DROP, p.tip.x - p.n.x, p.tip.y - p.n.y, p.tip.z - p.n.z, p.n.x * 6 + (rand() - 0.5) * 3, p.n.y * 6 + 2, p.n.z * 6 + (rand() - 0.5) * 3, 1.4, 0.8, C_SLUDGE, 1, 0, 0);
      }
      const f = p.fall;
      if (!f) continue;
      f.t += dt;
      f.vel.y -= 9.8 * dt;
      f.pos.addScaledVector(f.vel, dt);
      Q2.setFromEuler(EU.set(f.spin.x * dt, f.spin.y * dt, f.spin.z * dt));
      f.q.premultiply(Q2);
      const gy = city.groundY(f.pos.x, f.pos.z);
      if (f.pos.y <= gy + 1) {
        sludgeSplat(f.pos.x, gy + 0.5, f.pos.z, 24, 8);
        sfx("bump", f.pos, 1.4);
        pipeMesh.setMatrixAt(p.i, M4.compose(ZERO, f.q, ZERO));
        p.fall = null;
      } else pipeMesh.setMatrixAt(p.i, M4.compose(f.pos, f.q, ONE));
      pipeMesh.instanceMatrix.needsUpdate = true;
    }
  }
  const fin = { on: false, t: 0, fw: 0, credits: false, next: 0, ci: 0 };
  function beginFinale() {
    fin.on = true; fin.t = 0; fin.fw = 0; fin.credits = false;
    progress.king = save.king = "beaten";
    for (const p of pipes) ropes.removeTarget(p.tid);
    K.windT = 0; K.respawn = 0;
    if (K.ball) endBall(null, false);
    saveNow();
  }
  // 0-2.6 s he shakes and cracks, then he is flushed down; fireworks from 3 s to 9.6 s, the credits at 10.4 s, then free roam
  function finaleUpdate(dt) {
    fin.t += dt;
    const t = fin.t;
    if (t < 2.6) {
      K.glow = ss(0, 2.6, t) * 1.2; K.flash = 0;
      K.yaw += Math.sin(t * 40) * 0.01 * t;
      if (rand() < 0.6) sparkle(perch.x, perch.y + 4 + rand() * 10, perch.z, 2, 6, null);
    } else if (t < 5.4) {
      const e = ss(2.6, 5.4, t);
      K.flash = t < 3.0 ? ss(2.6, 3.0, t) : Math.max(0, 1 - (t - 3.0) * 1.5);
      K.glow = 1.2 * (1 - e);
      kingRig.scale.set(1, 1, 1);
      // he spirals down into the pod like water in a bowl
      K.yaw += dt * (2 + 14 * e);
      const s = 1 - e;
      poseKing(0);
      kingRig.scale.setScalar(Math.max(0.001, s * s));
      kingRig.position.y = perch.y - 3 * e;
      kingRig.rotation.y = K.yaw;
      if (fin.fw === 0) {
        fin.fw = 1;
        mouthWorld(MOUTHP);
        sfx("flush", MOUTHP, 1.6);
        geyser(perch.x, perch.y + 6, perch.z, 110, 26, 5, 1.1);
        sparkle(perch.x, perch.y + 8, perch.z, 50, 14, null);
        ringWave({ x: perch.x, y: perch.y + 2, z: perch.z }, C_WATER, 40, 1.4);
        say("king", 3);
        view.setKing(0); view.setFinale(1); beamWant[KING_BEAM] = 0;
      }
    } else if (K.state !== "gone") {
      K.state = "gone";
      kingRig.visible = false;
      fin.fw = 2;
    }
    // fireworks over the lake
    if (t > 3.2 && t < 9.6) {
      fin.next -= dt;
      if (fin.next <= 0) {
        fin.next = 0.32 + rand() * 0.25;
        const a = rand() * TAU, r = 60 + rand() * 140;
        firework(nd.x + Math.cos(a) * r * 0.9, 120 + rand() * 120, city.shoreZ + 60 + Math.abs(Math.sin(a)) * r * 1.4, fin.ci++);
      }
    }
    if (t > 10.4 && !fin.credits) { fin.credits = true; if (ui && ui.showCredits) ui.showCredits(); }
    if (t > 11) fin.on = false;
  }

  /* ---------------- the tutorial ---------------- */
  const tut = { step: -1, t: 0, rep: 0, pulse: 0, reel: 0, lt: [-1, -1], yaw0: 0, head0: 0, hud: 0, ready: false };
  const yawOf = (q) => Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
  function tutBegin(step) {
    tut.step = step; progress.tutorial = step;
    tut.t = tut.rep = tut.pulse = tut.reel = tut.hud = 0; tut.lt[0] = tut.lt[1] = -1; tut.ready = false;
    say("tutorial", step);
    hands.glow(TUT_CONTROL[step]);
    // the gold ring marks a good first anchor
    const g = city.goldRing;
    if (step === 0) ringSet(GOLD_SLOT, g.x + g.nx * 0.4, g.y, g.z + g.nz * 0.4, g.nx, g.ny, g.nz, 4.2, 3); else ringSet(GOLD_SLOT, 0, 0, 0, 0, 1, 0, 1, 0);
  }
  function tutNext() {
    if (tut.step < 0) return;
    sfx("ui");
    if (tut.step >= 7) { tutFinish(false); return; }
    tutBegin(tut.step + 1);
  }
  const musicOn = () => { if (settings.music !== false && audio && audio.music) audio.music(true); };
  function tutFinish(skipped) {
    const was = tut.step >= 0 || !save.tutorial;
    tut.step = -1; progress.tutorial = -1;
    hands.glow(null);
    ringSet(GOLD_SLOT, 0, 0, 0, 0, 1, 0, 1, 0);
    save.tutorial = true;
    if (was) { musicOn(); saveNow(); }
    if (skipped) sfx("uiBack");
  }
  function tutEvent(ev) {
    switch (tut.step) {
      case 0: if (ev.type === "attach" && P.ropes[ev.side].anchor.y - (P.pos.y + P.chest) >= 10) tutNext(); break;
      case 1: if (ev.type === "detach" && ev.speed >= 8) tutNext(); break;
      case 2: if (ev.type === "attach" && !P.onGround) tutNext(); break;
      case 4: if (ev.type === "yank" && ev.target && !SPECIAL[ev.target.tag]) tutNext(); break;
    }
  }
  function tutUpdate(dt, input) {
    if (tut.step < 0) return;
    tut.t += dt; tut.rep += dt; tut.pulse += dt;
    if (tut.t >= GAME.tutorialTimeout) { tutNext(); return; }
    if (tut.rep >= GAME.tutorialRepeat) { tut.rep = 0; say("tutorial", tut.step); }
    if (tut.pulse >= 4) {
      tut.pulse = 0;
      const c = TUT_CONTROL[tut.step], hud = settings.hand === "left" ? 1 : 0;
      if (c === "stick") haptic(1 - hud, 0.2, 40); else if (c === "wrist") haptic(hud, 0.2, 40); else if (c) { haptic(0, 0.2, 40); haptic(1, 0.2, 40); }
    }
    if (tut.step === 3) {
      // reeling shortens the rope: 8 m in all
      for (let i = 0; i < 2; i++) {
        const r = P.ropes[i];
        if (r.state !== "attached") { tut.lt[i] = -1; continue; }
        if (tut.lt[i] >= 0 && r.reeling && r.lenTarget < tut.lt[i]) tut.reel += tut.lt[i] - r.lenTarget;
        tut.lt[i] = r.lenTarget;
      }
      if (tut.reel >= 8) tutNext();
    } else if (tut.step === 5) {
      // the rig's yaw is the world yaw of the head minus its yaw in tracking space; a stick turn changes it, a real turn changes the second
      const hy = yawOf(input.head.local.quat), ry = wrapPi(yawOf(input.head.quat) - hy);
      if (!tut.ready) { tut.yaw0 = ry; tut.head0 = hy; tut.ready = true; }
      if (Math.abs(wrapPi(ry - tut.yaw0)) > 0.1 || Math.abs(wrapPi(hy - tut.head0)) >= Math.PI / 2) tutNext();
    } else if (tut.step === 6) {
      // the wrist HUD is on for a second: the ui says so, or the wrist is where you are looking
      let shown;
      if (input.mode !== "xr") shown = tut.t > 2;
      else if (ui && typeof ui.hudShown === "number") shown = ui.hudShown > 0.05; // it counts how long the HUD has been up
      else {
        const h = input.hands[settings.hand === "left" ? 1 : 0];
        V1.copy(h.gripPos).sub(input.head.pos);
        const d = V1.length();
        V2.set(0, 0, -1).applyQuaternion(input.head.quat);
        shown = h.connected && d > 0.05 && d < 0.9 && V1.dot(V2) / d > LOOK_DOT;
      }
      tut.hud = shown ? tut.hud + dt : 0;
      if (tut.hud >= 1) { saySoon("The arrow points to a clog.", 4); tutNext(); }
    }
  }

  /* ---------------- events from physics ---------------- */
  let weakT = -99, clogSaid = false, pipeSaid = false;
  function onEvent(ev) {
    if (!started) return;
    safe(tutEvent, ev);
    switch (ev.type) {
      case "yank": {
        const tg = ev.target;
        if (!tg) break;
        if (tg.tag === "clog") {
          const c = clogById.get(tg.id);
          if (!c || c.done) break;
          if (ev.pump) safe(() => { lastFlushed = c; pumpClog(c, ev.side); });
          else if (T - weakT > 8) { weakT = T; say("clog", 1); } // a weak pull: say what to do
        } else if (tg.tag === "pipe" && K.state === "awake" && !fin.on) {
          const p = pipes.find((q) => q.tid === tg.id);
          if (p && !p.ripped && ev.pump) safe(() => pumpPipe(p));
        }
        break;
      }
      case "attach":
        if (ev.target && ev.target.tag === "clog" && !clogSaid) { clogSaid = true; say("clog", 1); }
        if (ev.target && ev.target.tag === "pipe" && !pipeSaid) { pipeSaid = true; say("king", 2); }
        break;
      case "splash":
        say("splash", 0); later(2, () => say("splash", 1));
        break;
      case "respawn":
        prevValid = false;
        if (trial) endTrial("Trial ended.");
        break;
    }
  }

  /* ---------------- the frame ---------------- */
  function idleUpdate(dt) {
    // before the hand-off he sleeps in view of the portal (through its hole), and his snore and Zzz start with him; the portal
    // calls stir() when the wall bursts
    T += dt; U.uTime.value = T;
    if (K.state === "sleeping" && stencilRef != null) {
      if (K.react > 0) K.react -= dt;
      poseKing(dt); kingSleep(dt); fxUpdate();
    }
  }
  function fxUpdate() {
    if (fxDirty) { fx.a.aA.needsUpdate = fx.a.aB.needsUpdate = fx.a.aC.needsUpdate = fx.a.aD.needsUpdate = true; fxDirty = false; }
    fx.mesh.visible = T < fxLive;
  }
  function update(dt, time, _P, input) {
    if (!started) { if (dt > 0) safe(idleUpdate, dt); return; }
    if (ui && ui.paused) return; // the pause menu freezes everything
    T += dt; U.uTime.value = T;
    kind = input.kind || kind;
    HEADP.copy(input.head.pos);
    CHEST.set(P.pos.x, P.pos.y + P.chest, P.pos.z);
    BODY.set(HEADP.x, HEADP.y - HEAD_DROP * (P.chest / 1.25), HEADP.z);
    U.uTarget.value.copy(CHEST);
    // words and sounds that were set for later
    for (let i = queue.length - 1; i >= 0; i--) { const q = queue[i]; if ((q.t -= dt) <= 0) { queue.splice(i, 1); safe(q.fn); } }
    safe(tutUpdate, dt, input);
    safe(looniesUpdate, dt);
    safe(trialsUpdate, dt);
    safe(gurgles, dt);
    safe(clogsHint);
    safe(kingUpdate, dt, input);
    if (fin.on) safe(finaleUpdate, dt);
    safe(pipesUpdate, dt);
    // beams ease to their targets; the King's beam flares while he reacts
    for (let i = 0; i < 16; i++) {
      const w = beamWant[i], l = beamLvl[i];
      if (l !== w) { beamLvl[i] = l + clamp(w - l, -dt * 1.2, dt * 1.2); beams.a.aLvl.array[i] = beamLvl[i]; beamDirty = true; }
    }
    if (beamDirty) { beams.a.aLvl.needsUpdate = true; beamDirty = false; }
    if (ringDirty) { rings.a.aC.needsUpdate = rings.a.aN.needsUpdate = rings.a.aF.needsUpdate = true; ringDirty = false; }
    if (splatT > 0) { splatT = Math.max(0, splatT - dt); splatMat.uniforms.uAmt.value = splatT / 0.6; splat.visible = splatT > 0; }
    fxUpdate();
  }
  // "That's a clog. Plunge it.", once, when the first one is close
  function clogsHint() {
    if (clogsHint.said || done.size > 0 || tut.step >= 0) return; // (the tutorial says it itself at its last step)
    for (const c of clogs) if (!c.done && Math.hypot(c.x - HEADP.x, c.y - HEADP.y, c.z - HEADP.z) < 60) { clogsHint.said = true; say("clog", 0); return; }
  }

  /* ---------------- start, progress, travel ---------------- */
  function start(firstRun) {
    root.visible = true;
    if (started) return;
    started = true;
    // the first tutorial line needs to know if you play with controllers, hands or a mouse
    const gi = typeof window !== "undefined" && window.G && window.G.input;
    if (gi && gi.kind) kind = gi.kind;
    root.add(kingRig); // he moves into the game root: it hides with the world (the AR pause) and shows at the hand-off
    updateKingVisible();
    for (const c of clogs) { if (!c.done) ropes.addTarget({ id: c.tid, tag: "clog", pos: { x: c.tx, y: c.ty, z: c.tz }, radius: GAME.clogRadius }); beamWant[c.i] = c.done ? 0 : 1; beamLvl[c.i] = beamWant[c.i]; beams.a.aLvl.array[c.i] = beamLvl[c.i]; }
    for (const d of districts) tintDistrict(d.id);
    for (const t of trials) padPlace(t);
    beams.a.aLvl.needsUpdate = true;
    for (let i = PAD_BEAM; i < PAD_BEAM + trials.length; i++) { beamLvl[i] = beamWant[i]; beams.a.aLvl.array[i] = beamLvl[i]; }
    kingBeamPlace();
    drawLabels(); initTex(labelTex);
    progress.bank = bankNow();
    ropes.setStyle(progress.bank); hands.setStyle(progress.bank);
    progress.hearts = KING.hearts; hands.setHearts(progress.hearts);
    if (ui && ui.onSkipTutorial) ui.onSkipTutorial(() => tutFinish(true));
    if (save.king === "beaten") { K.state = "gone"; progress.king = "beaten"; kingRig.visible = false; view.setFinale(1); view.setKing(0); for (const p of pipes) { p.ripped = true; pipeMesh.setMatrixAt(p.i, M4.compose(ZERO, p.q, ZERO)); } pipeMesh.instanceMatrix.needsUpdate = true; }
    else {
      for (const p of pipes) if (save.pipes.includes(p.id)) { p.ripped = true; pipeMesh.setMatrixAt(p.i, M4.compose(ZERO, p.q, ZERO)); }
      pipeMesh.instanceMatrix.needsUpdate = true;
      progress.king = K.state = save.king;
      if (K.state === "awake") { K.wake = 9; view.setKing(1); beamWant[KING_BEAM] = beamLvl[KING_BEAM] = 1; beams.a.aLvl.array[KING_BEAM] = 1; beams.a.aLvl.needsUpdate = true; for (const p of pipes) if (!p.ripped) addPipeTarget(p); }
      else if (done.size >= KING.unlock) later(3, () => wakeKing(true));
    }
    // the tutorial runs until the first flush (or Skip), on a first run or when an earlier session left it unfinished
    if (!save.tutorial && (firstRun || done.size === 0)) tutBegin(0);
    else { progress.tutorial = -1; musicOn(); }
    updateKingVisible();
  }
  function targets() {
    const out = clogs.map((c) => ({ kind: "clog", id: c.id, x: c.x, y: c.y, z: c.z, done: c.done, district: c.d }));
    out.push({ kind: "king", id: 0, x: perch.x, y: perch.y, z: perch.z, done: K.state === "gone" || progress.king === "beaten" });
    for (const t of trials) out.push({ kind: "trial", id: t.id, x: t.start.x, y: t.start.y, z: t.start.z, done: !!save.best[String(t.id)] });
    out.push({ kind: "start", id: 0, x: city.start.x, y: city.start.y, z: city.start.z, done: false });
    return out;
  }
  function travelSpots() {
    const out = [{ id: "start", name: "The start roof", x: city.start.x, y: city.start.y, z: city.start.z }];
    for (const d of districts) {
      if (!d.all.some((c) => c.done)) continue;
      city.safe.filter((s) => s.district === d.id).forEach((s, i) => out.push({ id: "safe:" + d.id + ":" + i, name: d.name + " roof " + (i + 1), x: s.x, y: s.y, z: s.z }));
    }
    for (const t of trials) out.push({ id: "trial:" + t.id, name: t.name + (t.intense ? " (intense)" : ""), x: t.start.x, y: t.start.y, z: t.start.z });
    if (progress.king === "awake") out.push({ id: "needle.deck", name: "The Needle deck", x: deck.x, y: deck.y, z: deck.z });
    return out;
  }

  // meshes that draw right now
  function countDraws() {
    let n = 0;
    const walk = (o) => { if (!o.visible) return; if (o.isMesh) n++; for (const c of o.children) walk(c); };
    walk(root);
    if (splat.parent !== root) walk(splat);
    if (kingRig.parent !== root) walk(kingRig);
    return n;
  }

  const Gm = {
    root, progress,
    start, update, onEvent,
    targets, travelSpots,
    cancelTrial,
    skipTutorial() { tutFinish(true); },
    // test and portal hooks
    wakeKing() { if (K.state === "sleeping") { wakeKing(false); } },
    clearClog(id) { const c = clogs.find((q) => q.id === id); if (c) { lastFlushed = c; flush(c, -1, true); } },
    // He wakes for a moment: the portal calls it at the burst
    stir(secs = 3) { if (K.state === "sleeping") { K.react = secs; beamWant[KING_BEAM] = 1; kingBeamPlace(); mouthWorld(MOUTHP); sfx("kingRoar", MOUTHP, 1); } },
    info() {
      return {
        started, T, kind, model: kingModel, deck: { ...deck },
        clogs: clogs.map((c) => ({ id: c.id, pumps: c.pumps, done: c.done, level: c.level })),
        bonus: save.bonus, bank: progress.bank,
        king: { state: K.state, wake: K.wake, windT: K.windT, cd: K.cd, grace: K.grace, hearts: progress.hearts, respawn: K.respawn, ball: K.ball ? { x: K.ball.pos.x, y: K.ball.pos.y, z: K.ball.pos.z, t: K.ball.t, cosmetic: K.ball.cosmetic } : null, throws: kingLog.throws, hits: kingLog.hits, misses: kingLog.misses, balls: kingLog.balls.map((b) => ({ ...b })), mouth: mouthWorld(new THREE.Vector3()).toArray(), visible: kingRig.visible, glow: kingUniforms.uGlow.value, react: K.react },
        pipes: pipes.map((p) => ({ id: p.id, pumps: p.pumps, ripped: p.ripped, tip: p.tip.toArray() })),
        finale: { on: fin.on, t: fin.t, credits: fin.credits },
        trial: trial ? { id: trial.t.id, ring: trial.ring, time: trial.time } : null,
        pads: trials.map((t) => ({ id: t.id, hold: t.hold, x: t.start.x, y: t.start.y, z: t.start.z })),
        tutorial: { step: tut.step, t: tut.t, reel: tut.reel },
        fx: { live: T < fxLive, head: fxHead },
        draws: countDraws(),
      };
    },
    meshes: { toilets: toilets.mesh, fountains: fount.mesh, beacons: beams.mesh, coins: coins.mesh, rings: rings.mesh, labels: labels.mesh, particles: fx.mesh, pipes: pipeMesh, ball: ballMesh, king: kingRig, splat, outlines },
  };
  return Gm;
}
