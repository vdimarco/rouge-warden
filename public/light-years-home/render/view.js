// Light Years Home: the renderer. Five scales, each its own THREE.Scene with the camera at the origin: the cosmic web
// (Mly), the Local Group (kly), the Milky Way (ly), the stars (ly) and the Solar System (AU). Every frame the layers'
// roots move to −(camera position / unit) in float64 (a floating origin), and the layers draw back to front with the
// depth cleared between them, crossfaded by the camera's layer weights. Points use the light-speed material; big
// objects (galaxy impostors, nebulae, planets) sit at their aberrated centres and shrink by 1/D. Bakes run in slices
// so no frame stalls, the generators in a worker when one starts. Quality tiers and a step-down for slow frames.
import * as THREE from 'three';
import { OBJECTS, AU_LY, KM_PER_LY, KM_PER_AU, LY_PER_PC } from '../core/objects.js';
import { aberrate, heatRatio, viewRapidity, T_CMB, lnY } from '../core/physics.js';
import { project } from '../core/project.js';
import { LAYER_NAMES, LAYER_UNITS, layerWeights, viewScale, basisToQuat, legPath, revealPose } from '../core/geo.js';
import { STOPS, zonesFor } from '../core/route.js';
import { zoneAt, scanOf } from '../core/engine.js';
import { hashSeed, mulberry32 } from '../core/rng.js';
import { cosmicWeb, WEB_COUNTS } from '../core/gen/web.js';
import { starField, openCluster, STAR_COUNTS, SPECTRAL_MIX } from '../core/gen/stars.js';
import { galaxyParticles, GALAXY_COUNTS } from '../core/gen/galaxy.js';
import { createLut, createRelativity, createPointMaterial, createPoints, createHeadlight, createGlowMaterial, LUT_TMAX }
  from './points.js';
import { bakeBandFaces, createSky } from './sky.js';

// ---------- budgets (final.md 2.18) ----------

export const TIERS = {
  high: { ratio: 2, points: 120000, web: WEB_COUNTS.high, galaxy: GALAXY_COUNTS.high, stars: STAR_COUNTS.high,
    nebulaLayers: 6, nebulaSize: 512, sky: 512, impostor: 512, calls: 45, spritePx: 32, texMB: 96 },
  mid: { ratio: 1.5, points: 50000, web: WEB_COUNTS.mid, galaxy: GALAXY_COUNTS.mid, stars: STAR_COUNTS.mid,
    nebulaLayers: 4, nebulaSize: 256, sky: 256, impostor: 256, calls: 35, spritePx: 24, texMB: 48 },
  low: { ratio: 1, points: 25000, web: WEB_COUNTS.low, galaxy: 0, stars: STAR_COUNTS.low,
    nebulaLayers: 2, nebulaSize: 256, sky: 128, impostor: 256, calls: 25, spritePx: 16, texMB: 24 },
};
export const TIER_NAMES = ['high', 'mid', 'low'];
export const SLICE_MS = 120;          // longest bake slice per frame
const ADAPT_WINDOW = 3000;            // ms of frames per step-down decision
const ADAPT_SLOW = 25;                // mean frame ms above which a window steps down

const D2R = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a, f = [0, 0, 1]) => { const l = len(a); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [...f]; };
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
const M = 1e6;
const LUM_10PC = (10 * LY_PER_PC) ** 2;          // a star's aLum is 10^(−0.4 M_V) times this (flux = aLum / r², ly)
const lumOf = (mv) => 10 ** (-0.4 * mv) * LUM_10PC;
// Clip planes per layer, in its unit (as core/geo), for cameras made here (lens, debug faces).
const CLIP = { cosmic: [1e-3, 1e5], group: [1e-3, 1e6], galaxy: [1e-2, 1e7], stars: [1e-6, 1e6], solar: [1e-6, 1e4] };
const NCP = [-0.4847, 0.7466, 0.4560];            // the north celestial pole in galactic axes (Earth's spin axis)

// Exposure of each point layer: what a magnitude-0 star (or a typical galaxy) gives as sprite energy.
const STAR_EXPOSURE = 8;
const GLOW_CANDIDATE = 4;                         // a candidate star's glow grows past its least size above this energy
// Galaxies: E = flux · k · (REF · scale / r)^FALLOFF, the scale (Mly from the Sun) capped at SCALE_MAX.
const WEB_EXPOSURE = 0.35, WEB_FALLOFF = 0.6, WEB_REF = 0.3, WEB_SCALE_MAX = 1000;
const SKY_EXPOSURE = 1.6;
const HEADLIGHT = 60;                            // headlight energy per unit of heat ratio r
const MW_REF_LY = 169000;                       // the Milky Way particles' light is set at the reveal distance
const SUN_PX = 64;                               // the Sun's glare sprite, CSS px (a star's cap is the tier's)
// Candidate stars in a scan: a glow at least GLOW_MIN_PX across (red supergiants GLOW_GIANT_PX), larger when brighter.
const GLOW_MIN_PX = 13, GLOW_GIANT_PX = 20, GLOW_SLOTS = 8;
const CLUSTER_LIT = 60;                          // brightest members of a candidate open cluster lit in a scan
const PLANET_FLOOR = 3;                          // least point energy of a planet seen as a dot in the Solar System
// Galaxy clusters as crowds: galaxies drawn for a rich cluster (Coma, about 1,000 members) at each tier; a poorer one
// gets fewer, by the square root of its members. On screen a crowd is at least CROWD_SHARE of the short side in radius
// (between CROWD_MIN and CROWD_MAX CSS px), so a cluster reads as a crowd of small galaxies, not one white dot.
const CROWD = { high: 520, mid: 400, low: 300 };
const CROWD_SHARE = 0.045, CROWD_MIN = 24, CROWD_MAX = 44;
// A nebula's light (about half its cards' reach) is drawn at least this big, CSS px of radius.
const NEBULA_SHARE = 0.03, NEBULA_MIN = 12, NEBULA_MAX = 15;
// Core radius (share of the cluster's radius) and sub-clumps of each cluster: Fornax tight, Eridanus loose, Hercules
// lumpy, Virgo with a second clump around M49.
const CROWD_SHAPE = { coma: { rc: 0.28 }, virgo: { rc: 0.32, clumps: [[0.45, -0.3, 0.1, 0.3]] }, fornax: { rc: 0.2 },
  eridanus: { rc: 0.5 }, leo: { rc: 0.32 }, hercules: { rc: 0.34, clumps: [[0.5, 0.2, 0, 0.35], [-0.35, 0.45, 0.1, 0.25]] },
  centaurus: { rc: 0.3 }, hydra: { rc: 0.32 }, norma: { rc: 0.3 } };

// ---------- what each galaxy impostor looks like (core/gen/galaxy options) ----------
// tilt: inclination seen from the Sun (0 face-on, 90 edge-on); spin: turns the tilt axis, degrees.
const GALAXIES = {
  andromeda: { type: 'spiral', arms: 2, pitch: 11, bulge: 0.22, bar: 0.04, barLength: 6000, tilt: 77, spin: 38 },
  triangulum: { type: 'spiral', arms: 2, pitch: 24, bulge: 0.04, patchy: 0.55, tilt: 55, spin: 23 },
  m32: { type: 'elliptical', axes: [1, 0.85, 0.75], tilt: 30, spin: 0 },
  m110: { type: 'elliptical', axes: [1, 0.5, 0.45], tilt: 80, spin: 70 },
  m81: { type: 'spiral', arms: 2, pitch: 14, bulge: 0.16, tilt: 62, spin: 157 },
  'cen-a': { type: 'lane', axes: [1, 0.85, 0.75], tilt: 70, spin: 115 },
  ngc6822: { type: 'irregular', clumps: 4, tilt: 50, spin: 10 },
  lmc: { type: 'irregular', clumps: 6, tilt: 35, spin: 170 },
  smc: { type: 'irregular', clumps: 4, tilt: 60, spin: 45 },
  'sgr-dwarf': { type: 'elliptical', axes: [1, 0.35, 0.3], tilt: 80, spin: 100 },
  'milky-way': { type: 'spiral', arms: [1, 0.45, 1, 0.45], pitch: 12, barLength: 16300, barAngle: -30, winding: 1,
    bulge: 0.1, bar: 0.15, thickness: 900, normal: [0, 0, 1] },
};
// Nebulae: palette for render/nebula.js (linear RGB), and the size used (ly).
const NEBULAE = {
  'orion-nebula': { kind: 'emission', gas: [1.0, 0.22, 0.55], glow: [1.0, 0.85, 0.9], dust: [0.05, 0.02, 0.03], seed: 3 },
  horsehead: { kind: 'dark', gas: [0.9, 0.2, 0.25], glow: [0.6, 0.15, 0.2], dust: [0, 0, 0], seed: 11 },
  'witch-head': { kind: 'reflection', gas: [0.25, 0.42, 1.0], glow: [0.5, 0.65, 1.0], dust: [0, 0, 0], seed: 7 },
  carina: { kind: 'emission', gas: [1.0, 0.45, 0.35], glow: [1.0, 0.8, 0.6], dust: [0.1, 0.04, 0.02], seed: 5 },
  pleiades: { kind: 'reflection', gas: [0.25, 0.45, 1.0], glow: [0.7, 0.8, 1.0], dust: [0, 0, 0], seed: 9,
    radiusLy: 7 },
};
// Solar System bodies: the art module's maker, an equivalent temperature for their far-away point, and H, the
// absolute magnitude (at 1 AU from Sun and viewer) that sets the point's brightness.
const BODIES = {
  mercury: { make: 'planet', T: 5200, H: -0.6, bands: false },
  venus: { make: 'planet', T: 5600, H: -4.4, bands: false },
  earth: { make: 'earth', T: 9000, H: -3.99 },
  moon: { make: 'moon', T: 5800, H: 0.28 },
  mars: { make: 'planet', T: 2600, H: -1.52, bands: false },
  jupiter: { make: 'jupiter', T: 4300, H: -9.4 },
  saturn: { make: 'planet', T: 4800, H: -8.9, bands: true },
  uranus: { make: 'planet', T: 9500, H: -7.2, bands: false },
  neptune: { make: 'planet', T: 12000, H: -6.9, bands: false },
};

// A bright-star mix for far fields: at hundreds of light-years only luminous stars show.
const BRIGHT_MIX = SPECTRAL_MIX.map((m) => ({ ...m, share: { B: 0.08, A: 0.3, F: 0.2, G: 0.1, K: 0.07, giant: 0.25 }[m.cls]
  ?? 0 }));

// ---------- the generators, in a worker when one starts ----------

const GEN = { cosmicWeb, starField, openCluster, galaxyParticles };
const WORKER_SRC = (base) => `
import { cosmicWeb } from '${base}web.js';
import { starField, openCluster } from '${base}stars.js';
import { galaxyParticles } from '${base}galaxy.js';
const GEN = { cosmicWeb, starField, openCluster, galaxyParticles };
function buffers(o, set) {
  for (const v of Object.values(o)) {
    if (ArrayBuffer.isView(v)) set.add(v.buffer);
    else if (v && typeof v === 'object' && !Array.isArray(v)) buffers(v, set);
  }
  return set;
}
self.onmessage = (e) => {
  const { id, fn, opts } = e.data;
  try { const out = GEN[fn](opts); self.postMessage({ id, out }, [...buffers(out, new Set())]); }
  catch (err) { self.postMessage({ id, error: String((err && err.message) || err) }); }
};`;

function createGenerator() {
  let worker = null, failed = false, next = 1;
  const pending = new Map();
  const fallAll = () => { failed = true; worker = null; for (const p of pending.values()) p.local(); pending.clear(); };
  function start() {
    if (worker || failed) return worker;
    try {
      if (typeof Worker !== 'function' || typeof Blob !== 'function') throw new Error('no worker');
      const base = new URL('../core/gen/', import.meta.url).href;
      const url = URL.createObjectURL(new Blob([WORKER_SRC(base)], { type: 'text/javascript' }));
      worker = new Worker(url, { type: 'module' });
      worker.onmessage = (e) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        clearTimeout(p.timer);
        if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.out);
      };
      worker.onerror = (e) => { e.preventDefault?.(); fallAll(); };
    } catch { failed = true; worker = null; }
    return worker;
  }
  function run(fn, opts) {
    const local = () => GEN[fn](opts);
    const w = start();
    if (!w) return new Promise((resolve) => setTimeout(resolve, 0)).then(local);
    return new Promise((resolve, reject) => {
      const id = next++;
      const p = { resolve, reject, local: () => { try { resolve(local()); } catch (err) { reject(err); } } };
      p.timer = setTimeout(() => { if (pending.delete(id)) p.local(); }, 15000);
      pending.set(id, p);
      w.postMessage({ id, fn, opts });
    });
  }
  const dispose = () => { worker?.terminate(); worker = null; failed = true; };
  return { run, dispose, get usesWorker() { return !!worker; } };
}

// ---------- small helpers ----------

// Interleave several point sets so that any prefix holds each set in proportion (a lower tier draws a prefix).
function interleave(parts) {
  const total = parts.reduce((s, p) => s + p.count, 0);
  const positions = new Float32Array(total * 3), temperature = new Float32Array(total), lum = new Float32Array(total);
  const taken = parts.map(() => 0);
  const part = new Uint8Array(total);                   // which part each point came from
  for (let k = 0; k < total; k++) {
    let best = -1, bestF = Infinity;
    for (let j = 0; j < parts.length; j++) {
      if (taken[j] >= parts[j].count) continue;
      const f = (taken[j] + 0.5) / parts[j].count;
      if (f < bestF) { bestF = f; best = j; }
    }
    const p = parts[best], i = taken[best]++;
    positions[k * 3] = p.positions[i * 3]; positions[k * 3 + 1] = p.positions[i * 3 + 1];
    positions[k * 3 + 2] = p.positions[i * 3 + 2];
    temperature[k] = p.temperature[i]; lum[k] = p.lum[i];
    part[k] = best;
  }
  return { count: total, positions, temperature, lum, part };
}

// Absolute visual magnitude of a star from its radius (Sun = 1) and temperature: L = R² (T / T_sun)⁴, with the share of
// its light near 555 nm relative to the Sun's.
function magFromRadius(radiusSun, T) {
  const share = (t) => Math.exp(lnY(t)) / t ** 4;
  return 4.83 - 2.5 * Math.log10(radiusSun ** 2 * (T / 5772) ** 4 * share(T) / share(5772));
}

// Unit vector a little off the galactic north, at right angles to d.
function across(d, spinDeg = 0) {
  let p = sub([0, 0, 1], d.map((v) => v * d[2]));
  if (len(p) < 1e-3) p = sub([1, 0, 0], d.map((v) => v * d[0]));
  p = unit(p);
  const q = cross(d, p), a = spinDeg * D2R;
  return unit([p[0] * Math.cos(a) + q[0] * Math.sin(a), p[1] * Math.cos(a) + q[1] * Math.sin(a),
    p[2] * Math.cos(a) + q[2] * Math.sin(a)]);
}

// Bytes a texture holds on the GPU (own accounting): width × height × faces × bytes per texel, + 1/3 with mipmaps.
function textureBytes(tex) {
  const img = tex.image || {};
  const faces = tex.isCubeTexture || Array.isArray(img) ? 6 : 1;
  const w = (Array.isArray(img) ? img[0]?.width : img.width) || tex.width || 0;
  const h = (Array.isArray(img) ? img[0]?.height : img.height) || tex.height || 0;
  const per = tex.type === THREE.FloatType ? 16 : tex.type === THREE.HalfFloatType ? 8 : 4;
  const mips = tex.generateMipmaps && tex.minFilter !== THREE.LinearFilter && tex.minFilter !== THREE.NearestFilter;
  return Math.round(w * h * faces * per * (mips ? 4 / 3 : 1));
}

function softwareName(name) {
  return /swiftshader|llvmpipe|softpipe|basic render|software/i.test(String(name));
}

// ---------- the view ----------

export function createView(canvas, { tier, reduced = false, seed = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  renderer.info.autoReset = false;
  const gl = renderer.getContext();
  if (typeof WebGL2RenderingContext !== 'undefined' && !(gl instanceof WebGL2RenderingContext)) {
    renderer.dispose();
    throw new Error('Light Years Home needs WebGL2');
  }
  let gpu = 'unknown';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch { /* some browsers hide it */ }
  const backend = softwareName(gpu) ? 'software' : 'hardware';
  canvas.dataset.backend = backend;
  const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;

  // Quality: the tier sets the budget; adapt() steps down inside it (ratio, then point counts, then nebula layers).
  const q = {
    tier: backend === 'software' ? 'low' : TIERS[tier] ? tier : 'mid',
    ratio: 1, pointTier: 'mid', nebulaTier: 'mid', steps: [],
    adapt: { t: 0, sum: 0, n: 0 },
  };
  const tierOf = () => TIERS[q.tier];
  const ratioFor = (t) => (t === 'low' ? 1 : Math.min(dpr, TIERS[t].ratio));
  q.ratio = ratioFor(q.tier);
  q.pointTier = q.tier;
  q.nebulaTier = q.tier;
  const built = { tier: q.tier };          // the tier the point data was made for (lower tiers draw a prefix)

  let width = Math.max(1, canvas.clientWidth || canvas.width || 1);
  let height = Math.max(1, canvas.clientHeight || canvas.height || 1);
  renderer.setPixelRatio(q.ratio);
  renderer.setSize(width, height, false);

  const lut = createLut();
  const rel = createRelativity(lut);
  rel.uRatio.value = q.ratio;
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  const textures = new Map();             // uuid → texture (own accounting)
  const track = (tex) => { if (tex && tex.isTexture) textures.set(tex.uuid, tex); return tex; };
  track(lut);

  // Layers: a scene each, with a root that holds the points and moves to −origin each frame, and holders for the big
  // objects, placed camera-relative.
  const layers = {};
  for (const name of LAYER_NAMES) {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.name = `${name}-root`;
    scene.add(root);
    layers[name] = { name, unit: LAYER_UNITS[name], scene, root, weight: 0, points: [] };
  }
  const fx = new THREE.Scene();
  const headlight = createHeadlight({ shared: rel });
  fx.add(headlight);
  const heatFx = createHeatFx();
  fx.add(heatFx);

  const props = [];            // big objects: { id, layer, pos (ly), radiusLy, anchor, obj, scale, self, fade, ... }
  const pointSets = [];        // { layer, pts, material, total (made), drawn, keep, kind, fade }
  const art = { galaxy: undefined, nebula: undefined, planets: undefined, lens: undefined };
  const gen = createGenerator();
  const st = {
    cam: null, state: null, lost: false, disposed: false, last: { calls: 0, points: 0 }, time: 0, t0: now(),
    lostCbs: [], restoredCbs: [], sky: null, skyTex: null, mwImpostor: null, mwParticles: null, planetPoints: null,
    sunPoint: null, inside: 0, heat: 0, flash: 0,
  };

  // ---------- art modules (another agent's files; guarded) ----------

  async function loadArt(name) {
    if (art[name] !== undefined) return art[name];
    try { art[name] = await import(`./${name}.js`); } catch (err) {
      art[name] = null;
      console.warn(`light-years-home: render/${name}.js not available, using a stand-in`, err?.message || err);
    }
    return art[name];
  }
  const artFn = (mod, fn) => (art[mod] && typeof art[mod][fn] === 'function' ? art[mod][fn] : null);

  // ---------- bake queue: one slice per frame, at most SLICE_MS ----------

  const queue = [];
  const doneKeys = new Set(), activeKeys = new Set();
  const waiters = [];
  let pumping = false;
  const tick = (fn) => (typeof document !== 'undefined' && document.hidden) || typeof requestAnimationFrame !== 'function'
    ? setTimeout(fn, 16) : requestAnimationFrame(fn);
  function enqueue(job) {
    if (doneKeys.has(job.key) || activeKeys.has(job.key) || queue.some((j) => j.key === job.key)) return;
    queue.push(job);
    if (!pumping) { pumping = true; tick(pump); }
  }
  function finish(job, err) {
    activeKeys.delete(job.key);
    doneKeys.add(job.key);
    if (err) console.warn(`light-years-home: bake ${job.key} failed`, err?.message || err);
    settle();
  }
  function pump() {
    if (st.disposed) return;
    const t0 = now();
    while (queue.length && !st.lost) {
      const job = queue.shift();
      activeKeys.add(job.key);
      try {
        const t1 = now();
        const r = job.run();
        slice(job.key, t1);
        if (r && typeof r.then === 'function') r.then(() => finish(job), (e) => finish(job, e));
        else finish(job);
      } catch (e) { finish(job, e); }
      if (job.heavy || now() - t0 > SLICE_MS / 3) break;
    }
    if (queue.length) tick(pump); else pumping = false;
    settle();
  }
  function settle() {
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      const open = queue.some((j) => j.chapter <= w.chapter)
        || [...activeKeys].some((k) => (chapterOfKey.get(k) ?? 0) <= w.chapter);
      if (!open) { waiters.splice(i, 1); w.resolve(); }
    }
  }
  const chapterOfKey = new Map();
  // The longest piece of bake work done in one go on the main thread (ms), for the 120 ms budget.
  function slice(key, t0) {
    const ms = now() - t0;
    if (ms > (st.maxSlice?.ms || 0)) st.maxSlice = { ms, key };
  }
  function job(key, chapter, run, heavy = false) {
    chapterOfKey.set(key, chapter);
    enqueue({ key, chapter, run, heavy });
  }

  // ---------- building the layers ----------

  function addPoints(layerName, data, opts, kind) {
    const material = createPointMaterial({ shared: rel, maxPx: tierOf().spritePx, ...opts });
    const pts = createPoints({ ...data, material });
    pts.name = kind;
    layers[layerName].root.add(pts);
    const set = { layer: layerName, pts, material, total: data.count, kind, fade: 1, keep: data.keep || 0 };
    pointSets.push(set);
    applyPointTier(set);
    return set;
  }

  // A big object, of one of two kinds. Self-placed: its shader moves each vertex where the light-speed view sees it
  // (any points.js material, as in the stand-ins), so it hangs under the layer root at its true position. Held: a
  // mesh (impostor, nebula cards, planet), which a holder puts at its aberrated centre (camera-relative, float64) and
  // shrinks by 1/D. placed: a self-placed object already sits at its position in layer units, so the anchor stays at
  // the root's origin. scale: the anchor's size for an object of radius 1 (layer units). dotPx: the smallest it draws.
  function addProp(layerName, { id, pos, radiusLy, obj, scale = 1, quaternion = null, minPx = 0, dotPx = 0,
    kind = 'prop', art: mod = null, placed = false }) {
    const anchor = new THREE.Group();
    anchor.name = `${id}-anchor`;
    anchor.add(obj);
    if (quaternion) obj.quaternion.copy(quaternion);
    let self = false;
    const own = new Set();
    const keep = (t) => { if (t && t.isTexture && t !== lut && t !== glowTex) { own.add(t); track(t); } };
    obj.traverse((o) => {
      o.frustumCulled = false;
      for (const m of materialsOf(o)) {
        if (m.uniforms && m.uniforms.uExpPhi) self = true;
        if (!m.uniforms && m.opacity !== undefined) m.userData.lyhOpacity = m.opacity;
        if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) keep(u.value);
        for (const k of ['map', 'alphaMap', 'emissiveMap']) if (m[k]) keep(m[k]);
      }
    });
    keep(obj.userData && obj.userData.texture);
    const L = layers[layerName];
    if (self) {
      if (!placed) {
        anchor.position.set(pos[0] / L.unit, pos[1] / L.unit, pos[2] / L.unit);
        anchor.scale.setScalar(scale);
      }
      L.root.add(anchor);
    } else L.scene.add(anchor);
    const p = { id, layer: layerName, pos, radiusLy, anchor, obj, scale, self, art: mod, fade: 1, minPx, dotPx, kind,
      visible: false, D: 1, rPx: 0, textures: own };
    props.push(p);
    return p;
  }

  const materialsOf = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);
  // Uniforms an art module shares between all its materials (set once a frame through its setRelativity).
  const sharedArt = new Set();
  function noteShared(mod) {
    const m = art[mod];
    if (m && m.REL) for (const u of Object.values(m.REL)) sharedArt.add(u);
  }

  // Set the per-object uniforms a material declares (never one an art module shares between its materials).
  function feed(obj, values) {
    obj.traverse((o) => {
      for (const m of materialsOf(o)) {
        const u = m.uniforms;
        if (!u) {
          if (m.userData.lyhOpacity !== undefined && finite(values.uFade)) m.opacity = m.userData.lyhOpacity * values.uFade;
          continue;
        }
        for (const [k, v] of Object.entries(values)) {
          const slot = u[k];
          if (!slot || slot === rel[k] || sharedArt.has(slot)) continue;
          if (slot.value && slot.value.isVector3 && Array.isArray(v)) slot.value.set(v[0], v[1], v[2]);
          else if (slot.value && slot.value.isVector3 && v && v.isVector3) slot.value.copy(v);
          else if (typeof v === 'number') slot.value = v;
        }
      }
    });
  }

  // An object's crossfade weight: through its module's setOpacity when it has one, else our own uFade.
  function setFade(p, f) {
    const setOpacity = p.art ? artFn(p.art, 'setOpacity') : null;
    if (setOpacity) {
      try { setOpacity(p.obj, f); } catch { /* keep drawing */ }
      p.obj.visible = true;
    }
    feed(p.obj, { uFade: f });
  }

  function webClusters(far) {
    return Object.entries(OBJECTS)
      .filter(([, o]) => o.kind === 'cluster' || (o.kind === 'supercluster' && o.radiusLy < 1e8))
      .filter(([, o]) => (len(o.pos) / M > 150) === far)
      .map(([id, o]) => ({ id, pos: o.pos.map((v) => v / M), radius: o.radiusLy / M, members: o.members || 400,
        giants: o.giants || 0, clumps: id === 'shapley' ? 5 : id === 'hercules' ? 3 : undefined }));
  }

  function buildWeb(chapter) {
    const n = TIERS[built.tier].web;
    const nFar = Math.round(n * 0.7), nNear = n - nFar;
    // Galaxy points read white with a slight warm or cool cast, as in the video: the stage temperatures are pulled
    // halfway toward 6,400 K.
    const toPoints = (w) => {
      const lum = new Float32Array(w.count), temperature = new Float32Array(w.count);
      for (let i = 0; i < w.count; i++) { lum[i] = w.flux[i]; temperature[i] = 6400 + (w.temperature[i] - 5800) * 0.5; }
      return { count: w.count, positions: w.positions, temperature, lum };
    };
    // The far web fills a ball of radius 1,500 Mly around a point 800 Mly out toward the start, so every camera of
    // chapters I and II (scan cameras pull back up to about 1.9 billion ly) sits inside it; its rim fades softly.
    const far = OBJECTS.start.pos.map((v) => (v / len(OBJECTS.start.pos)) * 800);
    // The galaxies of a cluster drawn as a crowd (buildCrowds) leave the web, so its knot is not drawn twice.
    const crowded = (list, w, i) => w.knot && w.knot[i] >= 0 && Boolean(CROWD_SHAPE[list[w.knot[i]]?.id]);
    const farClusters = webClusters(true), nearClusters = webClusters(false);
    job('web-far', chapter, () => gen.run('cosmicWeb', {
      seed: hashSeed(seed, 'web-far'), count: Math.round(nFar * 1.95), centre: far, box: 3000, cells: 300,
      clusters: farClusters,
    }).then((w) => {
      const pts = toPoints(w), keep = [];
      for (let i = 0; i < pts.count && keep.length < nFar; i++) {
        if (crowded(farClusters, w, i)) continue;
        const r = Math.hypot(pts.positions[i * 3] - far[0], pts.positions[i * 3 + 1] - far[1],
          pts.positions[i * 3 + 2] - far[2]) / 1500;
        if (r > 1) continue;
        pts.lum[i] *= 1 - smoothstep(0.7, 1, r);
        keep.push(i);
      }
      const out = { count: keep.length, positions: new Float32Array(keep.length * 3),
        temperature: new Float32Array(keep.length), lum: new Float32Array(keep.length) };
      keep.forEach((i, k) => {
        out.positions.set(pts.positions.subarray(i * 3, i * 3 + 3), k * 3);
        out.temperature[k] = pts.temperature[i];
        out.lum[k] = pts.lum[i];
      });
      addPoints('cosmic', out, { falloff: WEB_FALLOFF, emax: 2, cull: 0.02 }, 'web-far');
    }));
    job('web-near', chapter, () => gen.run('cosmicWeb', {
      seed: hashSeed(seed, 'web-near'), count: nNear, centre: [0, 0, 0], box: 320, cells: 80,
      clusters: nearClusters, voids: [{ pos: OBJECTS['local-void'].pos.map((v) => v / M), radius: 35 }],
    }).then((w) => {
      const pts = toPoints(w);
      const keep = [];
      for (let i = 0; i < pts.count; i++) if (!crowded(nearClusters, w, i)) keep.push(i);
      const out = { count: keep.length, positions: new Float32Array(keep.length * 3),
        temperature: new Float32Array(keep.length), lum: new Float32Array(keep.length) };
      keep.forEach((i, k) => {
        out.positions.set(pts.positions.subarray(i * 3, i * 3 + 3), k * 3);
        out.temperature[k] = pts.temperature[i];
        out.lum[k] = pts.lum[i];
      });
      addPoints('cosmic', out, { falloff: WEB_FALLOFF, emax: 2, cull: 0.02 }, 'web-near');
    }));
  }

  // Galaxy clusters as crowds of small galaxy points: a Plummer profile (dense to the middle, cut at the cluster's
  // radius) with the giant ellipticals first, as slightly larger warm points (Coma's two, NGC 4874 and NGC 4889).
  // One Points per cluster in its own frame (radius 1), each with its own point material (one shader program);
  // place() grows a far cluster to a readable size on screen (CROWD_SHARE) and lets it shrink back to its true size as
  // you close in. A lower point tier draws a prefix (the giants come first).
  function buildCrowds(chapter) {
    job('crowds', chapter, () => {
      const t0 = now();
      const rich = CROWD[built.tier] || CROWD.mid;
      for (const [id, shape] of Object.entries(CROWD_SHAPE)) {
        const o = OBJECTS[id];
        if (!o) continue;
        const rnd = mulberry32(hashSeed(seed, 'crowd', id));
        const n = Math.round(rich * clamp(Math.sqrt((o.members || 300) / 1000), 0.3, 1));
        const giants = Math.min(o.giants || 0, 3);
        const positions = new Float32Array(n * 3), temperature = new Float32Array(n), lum = new Float32Array(n);
        const size = new Float32Array(n);
        const clumps = [[0, 0, 0, 1], ...(shape.clumps || [])];
        const wsum = clumps.reduce((s, c) => s + c[3], 0);
        for (let i = 0; i < n; i++) {
          let x, y, z;
          if (i < giants) {
            // The giants sit near the middle, a little apart (Coma's pair, 7 arcminutes apart on the sky).
            const a = (i / Math.max(1, giants)) * Math.PI * 2 + rnd();
            x = 0.07 * Math.cos(a); y = 0.07 * Math.sin(a); z = 0.02 * (rnd() - 0.5);
            temperature[i] = 4100 + 200 * rnd();
            lum[i] = 2.6 + 0.6 * rnd();
            size[i] = 0.09;
          } else {
            let u = rnd() * wsum, c = clumps[0];
            for (const cl of clumps) { if (u < cl[3]) { c = cl; break; } u -= cl[3]; }
            const sub = c === clumps[0] ? 1 : 0.4;
            let r;
            do { r = shape.rc / Math.sqrt(Math.max(1e-6, rnd()) ** (-2 / 3) - 1); } while (r > 1);
            const cz = 2 * rnd() - 1, ph = 2 * Math.PI * rnd(), s = Math.sqrt(1 - cz * cz);
            x = c[0] + sub * r * s * Math.cos(ph); y = c[1] + sub * r * s * Math.sin(ph); z = c[2] + sub * r * cz;
            // Mostly red ellipticals in the middle, a few bluer spirals outside; a log-normal spread of brightness.
            temperature[i] = 5000 + 900 * rnd() + 1200 * r * rnd();
            // (fainter in the crowded middle, so the core is a glow with galaxies in it, not a white disc)
            // A rich cluster has more galaxies, each a little fainter, so its crowd reads denser, not whiter.
            lum[i] = 0.3 * Math.max(rnd(), 0.002) ** -0.35 * (0.3 + 0.7 * smoothstep(0, 0.6, r)) * (120 / n) ** 0.45;
            size[i] = 0;
          }
          positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
        }
        // More galaxies at a higher tier means more, fainter ones, not a brighter cluster.
        const material = createPointMaterial({ shared: rel, maxPx: tierOf().spritePx,
          exposure: 1.5 * (CROWD.low / rich) ** 0.6, falloff: 0, near: 1, emax: 14, cull: 0.02, sized: true });
        const pts = createPoints({ positions, temperature, lum, size, material });
        pts.name = `crowd:${id}`;
        const radius = o.radiusLy;
        const p = addProp('cosmic', { id: `crowd:${id}`, pos: o.pos, radiusLy: radius, obj: pts,
          scale: radius / LAYER_UNITS.cosmic, kind: 'crowd', minPx: 0.5 });
        Object.assign(p, { count: n, rich, material, near: len(o.pos) / M < 150, cluster: id });
        applyCrowdTier(p);
      }
      slice('crowds', t0);
    });
  }

  // Disc normal of a galaxy for the stand-in: tilted from the line of sight from the Sun by its inclination.
  function galaxyNormal(id) {
    const g = GALAXIES[id];
    if (g.normal) return g.normal;
    const s = unit(OBJECTS[id].pos), p = across(s, g.spin || 0), i = (g.tilt || 0) * D2R;
    return unit([-s[0] * Math.cos(i) + p[0] * Math.sin(i), -s[1] * Math.cos(i) + p[1] * Math.sin(i),
      -s[2] * Math.cos(i) + p[2] * Math.sin(i)]);
  }
  const quatTo = (n) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(n[0], n[1], n[2]));

  function galaxyParams(id) {
    const o = OBJECTS[id], g = GALAXIES[id];
    const { tilt, spin, normal, ...rest } = g;
    return { id, seed: hashSeed(seed, 'impostor', id), radius: o.radiusLy, ...rest };
  }

  // A stand-in impostor when render/galaxy.js is missing: a few thousand particles with the point material, in
  // units of the galaxy's radius.
  function standInGalaxy(id) {
    const d = galaxyParticles({ ...galaxyParams(id), count: 2500 });
    const r = OBJECTS[id].radiusLy;
    const positions = new Float32Array(d.count * 3), lum = new Float32Array(d.count), size = new Float32Array(d.count);
    for (let i = 0; i < d.count * 3; i++) positions[i] = d.positions[i] / r;
    for (let i = 0; i < d.count; i++) { lum[i] = d.flux[i] * 0.06; size[i] = d.size[i] / r; }
    const material = createPointMaterial({ shared: rel, maxPx: tierOf().spritePx, falloff: 0, emax: 2, cull: 0.003,
      sized: true });
    return createPoints({ positions, temperature: d.temperature, lum, size, material });
  }

  const impostorCache = new Map();
  // One galaxy impostor from render/galaxy.js: its particles are made in the worker, then baked (one particle pass,
  // one dust pass, one full-screen pass); the mesh comes in its own frame (disc in x-y, normal +z, radius 1) and is
  // held here at its aberrated centre, turned to its disc normal (galaxy.js presetNormal: the real orientation from
  // RA, Dec, position angle and inclination; a seeded tilt for waypoints). Falls back to the stand-in.
  // layer: 'group' for the catalogue, 'cosmic' for waypoints (preset: a galaxy.js GALAXIES id). Resolves to the prop.
  async function makeImpostor(layerName, id, opts = {}) {
    const { preset = id, pos = OBJECTS[id]?.pos, radiusLy = OBJECTS[id]?.radiusLy } = opts;
    const unitLy = LAYER_UNITS[layerName];
    const g = art.galaxy;
    const P = g && g.GALAXIES && g.GALAXIES[preset];
    let obj = null, normal = null;
    if (P && typeof g.bakeImpostor === 'function' && typeof g.createImpostor === 'function') {
      try {
        const size = typeof g.impostorSize === 'function' ? g.impostorSize(preset, q.tier) : TIERS[q.tier].impostor;
        const key = `${preset}@${size}`;
        let tex = impostorCache.get(key);
        if (!tex) {
          const S = clamp(Math.round(size * (P.big ? 2 : 1)), 32, 1024);
          const count = P.big ? GALAXY_COUNTS[q.tier] : clamp(Math.round(30000 * (S / 512) ** 2), 6000, 60000);
          const data = await gen.run('galaxyParticles', { ...P.params, count });
          const t0 = now();
          tex = impostorCache.get(key) || g.bakeImpostor(renderer, { id: preset, data }, size);
          slice(`bake:${key}`, t0);
          impostorCache.set(key, tex);
        }
        obj = g.createImpostor(tex, 0);
        obj.userData.texture = tex;
        const facing = P.orient && P.orient.facing;
        normal = facing ? null : (typeof g.presetNormal === 'function' && g.presetNormal(preset))
          || randomNormal(pos, hashSeed(seed, 'tilt', id));
      } catch (err) { console.warn(`light-years-home: impostor ${id}`, err?.message || err); obj = null; }
    }
    if (obj) {
      return addProp(layerName, { id, pos, radiusLy, obj, scale: radiusLy / unitLy, kind: 'galaxy', art: 'galaxy',
        quaternion: normal ? quatTo(normal) : null, dotPx: 3, minPx: 1 });
    }
    const standIn = standInGalaxy(GALAXIES[preset] ? preset : 'andromeda');
    return addProp(layerName, { id, pos, radiusLy, obj: standIn, scale: radiusLy / unitLy,
      quaternion: quatTo(GALAXIES[preset] ? galaxyNormal(preset) : [0, 0, 1]), kind: 'galaxy', minPx: 1 });
  }

  // A disc normal tilted 35° to 75° from the line of sight from the Sun, about a seeded axis (waypoint galaxies).
  function randomNormal(pos, s) {
    const rnd = mulberry32(s);
    const los = unit(pos), side = across(los, 360 * rnd()), i = (35 + 40 * rnd()) * D2R;
    return unit([0, 1, 2].map((k) => -los[k] * Math.cos(i) + side[k] * Math.sin(i)));
  }

  function buildGroup(chapter) {
    for (const id of Object.keys(GALAXIES)) {
      job(`impostor:${id}`, chapter, async () => {
        await loadArt('galaxy');
        noteShared('galaxy');
        const p = await makeImpostor('group', id);
        if (id === 'milky-way') st.mwImpostor = p;
      }, true);
    }
  }

  // Spiral galaxies beside the camera's path through the waypoint zones of the intergalactic legs ("Galaxy ahead").
  // The camera trails the ship by the reveal offset, so they sit on the camera's path, a little to one side.
  function buildWaypoints(chapter) {
    const presets = ['wp-grand', 'wp-barred', 'wp-flocculent'];
    let k = 0;
    for (let i = 0; i < STOPS.length && i <= 3; i++) {
      const offset = revealPose(i, 16 / 9).offset;
      for (const z of zonesFor(i, 'sheet')) {
        if (z.kind !== 'waypoint') continue;
        const at = legPath(i, 'sheet', z.startLy + z.ly / 2);
        const rnd = mulberry32(hashSeed(seed, 'waypoint', i, k));
        const radiusLy = 30000 + 25000 * rnd();
        const side = across(at.fwd, 360 * rnd());
        const lateral = (1.6 + 0.8 * rnd()) * radiusLy;
        const pos = [0, 1, 2].map((a) => at.pos[a] + offset[a] + side[a] * lateral);
        const preset = presets[k % presets.length], id = `waypoint-${i}-${k}`;
        job(`waypoint:${id}`, chapter, async () => {
          await loadArt('galaxy');
          noteShared('galaxy');
          const known = art.galaxy && art.galaxy.GALAXIES && art.galaxy.GALAXIES[preset];
          (await makeImpostor('cosmic', id, { preset: known ? preset : 'andromeda', pos, radiusLy })).waypoint = true;
        }, true);
        k++;
      }
    }
  }

  function buildMilkyWay(chapter) {
    if (!(TIERS[built.tier].galaxy > 0)) return;
    job('mw-particles', chapter, async () => {
      await loadArt('galaxy');
      noteShared('galaxy');
      const params = art.galaxy?.MILKY_WAY ? { ...art.galaxy.MILKY_WAY } : galaxyParams('milky-way');
      const data = await gen.run('galaxyParticles', { ...params, seed: params.seed ?? hashSeed(seed, 'milky-way'),
        count: TIERS[built.tier].galaxy });
      let obj = null;
      const t0 = now();
      const gc = OBJECTS['milky-way'].pos;
      const make = artFn('galaxy', 'createMilkyWayParticles');
      if (make) {
        try {
          obj = make(data, { shared: rel, lut, ratio: q.ratio, maxPx: TIERS[built.tier].spritePx * 2, unit: 1, pos: gc });
        } catch (err) { console.warn('light-years-home: Milky Way particles', err?.message || err); obj = null; }
      }
      let material = null;
      if (obj) {
        obj.position.set(gc[0], gc[1], gc[2]);
        obj.traverse((o) => { if (!material && o.isPoints && o.material.uniforms?.uExposure) material = o.material; });
      }
      if (!obj || !material) {
        // Each particle stands for a cloud of stars, spread to its size.
        material = createPointMaterial({ shared: rel, maxPx: 48, falloff: 2, exposure: 1, emax: 3, cull: 0.002,
          sized: true });
        const lumv = new Float32Array(data.count);
        for (let i = 0; i < data.count; i++) lumv[i] = data.flux[i] * 0.12;
        obj = createPoints({ positions: data.positions, temperature: data.temperature, lum: lumv, size: data.size,
          material });
        obj.position.set(gc[0], gc[1], gc[2]);
      }
      // Light falls off as 1 / r² (normalised at the reveal distance) while each particle grows with its size, so a
      // star cloud keeps its surface brightness as you close in, as a real one does.
      material.uniforms.uFalloff.value = 2;
      material.uniforms.uNear.value = 200;
      material.userData.lyhExposure = material.uniforms.uExposure.value * MW_REF_LY * MW_REF_LY;
      obj.traverse((o) => { o.frustumCulled = false; });
      layers.galaxy.root.add(obj);
      st.mwParticles = { obj, total: data.count, material, art: obj.name === 'milky-way' ? 'galaxy' : null };
      applyGalaxyTier();
      slice('mw-particles', t0);
    }, true);
  }

  function buildSky(chapter) {
    let bake = null;
    for (let f = 0; f < 6; f++) {
      job(`band:${f}`, chapter, () => {
        if (!bake) { bake = bakeBandFaces(renderer, TIERS[q.tier].sky); st.skyTarget = bake.target; }
        bake.faces[f]();
        if (f === 5) {
          bake.done();
          track(bake.texture);
          st.skyTex = bake.texture;
          st.sky = createSky(bake.texture, { shared: rel });
          layers.galaxy.scene.add(st.sky);
        }
      }, true);
    }
  }

  function buildStars(chapter) {
    job('stars', chapter, async () => {
      const n = TIERS[built.tier].stars;
      const k = n / STAR_COUNTS.high;
      const fields = await Promise.all([
        gen.run('starField', { seed: hashSeed(seed, 'stars', 'local'), count: Math.round(n * 0.5), centre: [0, 0, 0],
          radius: 120 }),
        gen.run('starField', { seed: hashSeed(seed, 'stars', 'wide'), count: Math.round(n * 0.22), centre: [0, 0, 0],
          radius: 800, mix: BRIGHT_MIX }),
        gen.run('starField', { seed: hashSeed(seed, 'stars', 'orion'), count: Math.round(n * 0.18),
          centre: [-1000, -500, -380], radius: 450, mix: BRIGHT_MIX }),
        gen.run('starField', { seed: hashSeed(seed, 'stars', 'carina'), count: Math.round(n * 0.1),
          centre: OBJECTS.carina.pos, radius: 600, mix: BRIGHT_MIX }),
        gen.run('openCluster', { seed: hashSeed(seed, 'pleiades'), centre: OBJECTS.pleiades.pos,
          count: Math.round(1000 * k), core: 8, tidal: OBJECTS.pleiades.radiusLy, age: 125e6, whiteDwarfs: 2 }),
        gen.run('openCluster', { seed: hashSeed(seed, 'hyades'), centre: OBJECTS.hyades.pos,
          count: Math.round(300 * k), core: OBJECTS.hyades.coreLy, tidal: OBJECTS.hyades.radiusLy, age: 625e6,
          giants: 4, giantT: 4900, giantMag: 0.3, whiteDwarfs: 4 }),
        gen.run('openCluster', { seed: hashSeed(seed, 'beehive'), centre: OBJECTS.beehive.pos,
          count: Math.round(600 * k), core: 4, tidal: OBJECTS.beehive.radiusLy, age: 650e6, giants: 4 }),
      ]);
      const t0 = now();
      const parts = fields.map((f) => {
        const lum = new Float32Array(f.count);
        for (let i = 0; i < f.count; i++) lum[i] = lumOf(f.absMag[i]);
        return { count: f.count, positions: f.positions, temperature: f.temperature, lum };
      });
      const named = namedStars();
      const field = interleave(parts);
      // The brightest members of each open cluster (parts 4 to 6), so a candidate cluster can be lit in a scan.
      st.clusterMembers = new Map();
      ['pleiades', 'hyades', 'beehive'].forEach((id, j) => {
        const members = [];
        for (let k = 0; k < field.count; k++) if (field.part[k] === 4 + j) members.push(k);
        members.sort((a, b) => field.lum[b] - field.lum[a]);
        st.clusterMembers.set(id, members.slice(0, CLUSTER_LIT).map((k) => k + named.count));
      });
      const total = named.count + field.count;
      const positions = new Float32Array(total * 3), temperature = new Float32Array(total), lum = new Float32Array(total);
      positions.set(named.positions); temperature.set(named.temperature); lum.set(named.lum);
      positions.set(field.positions, named.count * 3); temperature.set(field.temperature, named.count);
      lum.set(field.lum, named.count);
      st.starSet = addPoints('stars', { count: total, positions, temperature, lum, keep: named.count },
        { exposure: STAR_EXPOSURE, falloff: 2, near: 1e-7, emax: 40, cull: 0.01 }, 'stars');
      st.namedIndex = new Map(named.ids.map((id, i) => [id, i]));
      // The Sun as a star, apart so it can fade when the Solar System layer draws its disc.
      const sun = OBJECTS.sun;
      // Its glare is bigger than any star's: a higher energy cap and a 64 px sprite.
      st.sunPoint = addPoints('stars', { count: 1, positions: new Float32Array(sun.pos), temperature:
        new Float32Array([sun.T]), lum: new Float32Array([lumOf(sun.absMag)]) },
      { exposure: STAR_EXPOSURE, falloff: 2, near: 1e-9, emax: 5000, cull: 0.01, maxPx: SUN_PX }, 'sun-point');
      // Glows for the candidate stars of a scan (lightCandidates fills the slots).
      const material = createGlowMaterial({ shared: rel, exposure: STAR_EXPOSURE, eref: GLOW_CANDIDATE,
        maxPx: TIERS[q.tier].spritePx });
      const glowPts = createPoints({ positions: new Float32Array(GLOW_SLOTS * 3), temperature: new Float32Array(GLOW_SLOTS),
        lum: new Float32Array(GLOW_SLOTS), material });
      glowPts.geometry.setAttribute('aMin', new THREE.BufferAttribute(new Float32Array(GLOW_SLOTS), 1));
      glowPts.geometry.setDrawRange(0, 0);
      glowPts.name = 'glows';
      glowPts.renderOrder = 5;
      layers.stars.root.add(glowPts);
      st.glows = { pts: glowPts, material, count: 0 };
      slice('stars', t0);
    });
  }

  function namedStars() {
    const list = [];
    for (const [id, o] of Object.entries(OBJECTS)) {
      if (id === 'sun' || !(o.kind === 'star' || o.kind === 'pair') || !finite(o.T) || !finite(o.absMag)) continue;
      list.push([o.pos, o.T, o.absMag, id]);
      if (o.companion) {
        const c = o.companion, off = across(unit(o.pos), 40).map((v) => v * c.sepAu * AU_LY);
        list.push([[o.pos[0] + off[0], o.pos[1] + off[1], o.pos[2] + off[2]], c.T, magFromRadius(c.radiusSun, c.T),
          `${id}:b`]);
      }
    }
    const count = list.length;
    const positions = new Float32Array(count * 3), temperature = new Float32Array(count), lum = new Float32Array(count);
    list.forEach(([p, T, mv], i) => { positions.set(p, i * 3); temperature[i] = T; lum[i] = lumOf(mv); });
    return { count, positions, temperature, lum, ids: list.map((x) => x[3]) };
  }

  function buildNebulae(chapter) {
    for (const [id, pal] of Object.entries(NEBULAE)) {
      job(`nebula:${id}`, chapter, async () => {
        await loadArt('nebula');
        noteShared('nebula');
        const o = OBJECTS[id];
        const radius = pal.radiusLy || o.radiusLy;
        const bake = artFn('nebula', 'bakeNebula'), make = artFn('nebula', 'createNebula');
        let obj = null;
        const t0 = now();
        if (bake && make) {
          try {
            const bakes = bake(renderer, { ...pal, id }, TIERS[q.tier].nebulaLayers, TIERS[q.tier].nebulaSize);
            for (const b of [].concat(bakes || [])) track(b && b.isTexture ? b : b?.texture);
            obj = make(bakes, [0, 0, 0], 1);
          } catch (err) { console.warn(`light-years-home: nebula ${id}`, err?.message || err); obj = null; }
        }
        // The cards reach past the nebula's radius (its soft cloud spills out of its ring): cull by their reach.
        const reach = (obj && obj.userData && finite(obj.userData.reach) ? obj.userData.reach : 1) || 1;
        const p = addProp('stars', { id: `nebula:${id}`, pos: o.pos, radiusLy: radius * reach,
          obj: obj || standInNebula(pal), scale: radius, kind: 'nebula', minPx: 1.5, art: obj ? 'nebula' : null });
        p.layersAll = p.obj.children.length;
        p.light = obj ? radius * reach * 0.45 : 0;
        p.nebula = id;
        applyNebulaTier(p);
        slice(`nebula:${id}`, t0);
      }, true);
    }
  }

  // A stand-in nebula: a soft additive glow in the palette colour (dark nebulae draw nothing).
  function standInNebula(pal) {
    const g = new THREE.Group();
    if (pal.kind === 'dark') return g;
    const c = new THREE.Color(...pal.gas);
    for (let i = 0; i < 2; i++) {
      const m = new THREE.SpriteMaterial({ color: c, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        transparent: true, opacity: 0.35 / (i + 1), map: glowTexture() });
      const s = new THREE.Sprite(m);
      s.scale.setScalar(2.2 * (1 + i));
      g.add(s);
    }
    return g;
  }
  let glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    const n = 64, data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const v = Math.round(255 * Math.max(0, Math.exp(-4 * r * r) - Math.exp(-4)));
      data.set([v, v, v, 255], (y * n + x) * 4);
    }
    glowTex = new THREE.DataTexture(data, n, n);
    glowTex.needsUpdate = true;
    return track(glowTex);
  }

  function buildSolar(chapter) {
    job('planets', chapter, async () => {
      await loadArt('planets');
      noteShared('planets');
      const t0 = now();
      const make = (id, b) => {
        const fn = id === 'sun' ? 'createSun' : b.make === 'earth' ? 'createEarth' : b.make === 'moon' ? 'createMoon'
          : b.make === 'jupiter' ? 'createJupiter' : 'createPlanet';
        const f = artFn('planets', fn);
        if (!f) return null;
        try { return fn === 'createPlanet' ? f({ color: OBJECTS[id].color, bands: b.bands, id }) : f(); }
        catch (err) { console.warn(`light-years-home: ${id}`, err?.message || err); return null; }
      };
      const sun = OBJECTS.sun;
      const sunObj = make('sun', {});
      addProp('solar', { id: 'sun', pos: sun.pos, radiusLy: sun.radiusKm / KM_PER_LY,
        obj: sunObj || standInBody('#fff6e8', true),
        scale: sun.radiusKm / KM_PER_AU, kind: 'body', minPx: 0, dotPx: 36, art: sunObj ? 'planets' : null });
      const pos = [], temp = [], lumv = [];
      for (const [id, b] of Object.entries(BODIES)) {
        const o = OBJECTS[id];
        const obj = make(id, b);
        const spin = id === 'earth' || id === 'moon' ? NCP : null;
        const quaternion = spin ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(...spin)) : null;
        const p = addProp('solar', { id, pos: o.pos, radiusLy: o.radiusKm / KM_PER_LY,
          obj: obj || standInBody(o.color, false),
          scale: o.radiusKm / KM_PER_AU, quaternion, kind: 'body', minPx: 1.2, art: obj ? 'planets' : null });
        p.sunLit = true;
        const dSun = len(o.pos) / AU_LY;
        pos.push(...o.pos.map((v) => v / AU_LY));
        temp.push(b.T);
        lumv.push(10 ** (-0.4 * b.H) / (dSun * dSun));
      }
      const lum = new Float32Array(lumv);
      st.planetPoints = addPoints('solar', { count: lumv.length, positions: new Float32Array(pos),
        temperature: new Float32Array(temp), lum }, { exposure: STAR_EXPOSURE, falloff: 2, near: 1e-9, emax: 12,
        cull: 0.01 }, 'planet-points');
      st.planetPoints.base = Float32Array.from(lum);
      st.planetPoints.ids = Object.keys(BODIES);
      slice('planets', t0);
    });
  }

  // A stand-in body: a lit sphere (or a bright one for the Sun).
  function standInBody(color, emissive) {
    const material = emissive
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(color) })
      : new THREE.ShaderMaterial({
        uniforms: { uSun: { value: new THREE.Vector3(1, 0, 0) }, uColor: { value: new THREE.Color(color) } },
        vertexShader: /* glsl */ `
          varying vec3 vN;
          void main() {
            vN = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun, uColor;
          varying vec3 vN;
          void main() { gl_FragColor = vec4(uColor * (0.03 + max(dot(normalize(vN), uSun), 0.0)), 1.0);
            #include <colorspace_fragment>
          }`,
      });
    return new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
  }

  // ---------- dropping what was made (a new tier, a lost context) ----------

  // free: false after a lost context, when the GPU objects are gone already.
  function freeTexture(t, free = true) {
    textures.delete(t.uuid);
    if (!free) return;
    if (t.userData && t.userData.rt && typeof t.userData.rt.dispose === 'function') t.userData.rt.dispose();
    else t.dispose();
  }
  function dropProp(p, free = true) {
    p.anchor.removeFromParent();
    if (free) {
      p.obj.traverse((o) => {
        o.geometry?.dispose?.();
        for (const m of materialsOf(o)) m.dispose();
      });
    }
    for (const t of p.textures) freeTexture(t, free);
    props.splice(props.indexOf(p), 1);
  }
  // Everything baked into textures: the band, the impostors and waypoints, the nebulae. prepare() makes them again.
  function dropBakes(free = true) {
    for (const k of [...doneKeys]) if (/^(band:|impostor:|nebula:|waypoint:)/.test(k)) doneKeys.delete(k);
    if (st.sky) {
      st.sky.removeFromParent();
      if (free) { st.sky.material.dispose(); st.sky.geometry.dispose(); }
      st.sky = null;
    }
    if (st.skyTex) {
      textures.delete(st.skyTex.uuid);
      if (free) st.skyTarget?.dispose();
      st.skyTex = null; st.skyTarget = null;
    }
    for (const p of props.filter((x) => x.kind === 'galaxy' || x.kind === 'nebula')) dropProp(p, free);
    for (const t of impostorCache.values()) if (textures.has(t.uuid) || t.userData?.rt) freeTexture(t, free);
    impostorCache.clear();
    st.mwImpostor = null;
  }
  // The point data and what is built from it: the web, the stars, the Milky Way particles, the planets.
  function dropPoints() {
    for (const s of pointSets.splice(0)) { s.pts.removeFromParent(); s.pts.geometry.dispose(); s.material.dispose(); }
    st.sunPoint = null;
    st.starSet = null;
    st.planetPoints = null;
    for (const k of ['web-far', 'web-near', 'stars', 'planets', 'mw-particles', 'crowds']) doneKeys.delete(k);
    for (const p of props.filter((x) => x.kind === 'crowd')) dropProp(p);
    if (st.glows) {
      st.glows.pts.removeFromParent(); st.glows.pts.geometry.dispose(); st.glows.material.dispose();
      st.glows = null;
    }
    st.sunGlow = false;
    if (st.mwParticles) {
      st.mwParticles.obj.removeFromParent();
      st.mwParticles.obj.traverse((o) => { if (o.isPoints) { o.geometry.dispose(); o.material.dispose(); } });
      st.mwParticles = null;
    }
    for (const p of props.filter((x) => x.layer === 'solar')) dropProp(p);
  }

  // ---------- tiers and steps ----------

  function applyPointTier(set) {
    const want = { web: TIERS[q.pointTier].web, stars: TIERS[q.pointTier].stars };
    const made = { web: TIERS[built.tier].web, stars: TIERS[built.tier].stars };
    let k = 1;
    if (set.kind === 'web-far' || set.kind === 'web-near') k = want.web / made.web;
    else if (set.kind === 'stars') k = want.stars / made.stars;
    const n = set.kind === 'stars' ? set.keep + Math.round((set.total - set.keep) * Math.min(1, k))
      : Math.round(set.total * Math.min(1, k));
    set.pts.geometry.setDrawRange(0, n);
    set.drawn = n;
  }
  // squeeze: a further share (0..1) of the tier's particles, to stay inside the frame's point budget.
  function applyGalaxyTier(squeeze = st.mwParticles?.squeeze ?? 1) {
    const mw = st.mwParticles;
    if (!mw) return;
    const want = TIERS[q.pointTier].galaxy;
    mw.enabled = want > 0;
    mw.squeeze = squeeze;
    const k = Math.min(1, want / Math.max(1, mw.total));
    mw.drawn = 0;
    mw.full = 0;
    mw.obj.traverse((o) => {
      if (!o.isPoints) return;
      const count = o.geometry.getAttribute('position')?.count || 0;
      const n = Math.max(1, Math.round(count * k * squeeze));
      o.geometry.setDrawRange(0, n);
      mw.drawn += n;
      mw.full += Math.round(count * k);
      if (o.material === mw.material) mw.starsDrawn = n;
    });
  }
  function applyCrowdTier(p) {
    const n = Math.max(1, Math.round(p.count * Math.min(1, (CROWD[q.pointTier] || p.rich) / p.rich)));
    p.obj.geometry.setDrawRange(0, n);
    p.material.uniforms.uMaxPx.value = TIERS[q.tier].spritePx;
  }
  function applyNebulaTier(p) {
    const n = TIERS[q.nebulaTier].nebulaLayers;
    p.obj.children.forEach((c, i) => { c.visible = i < Math.max(1, n); });
  }
  function applyAllTiers() {
    for (const s of pointSets) applyPointTier(s);
    applyGalaxyTier();
    for (const p of props) if (p.kind === 'nebula') applyNebulaTier(p);
    for (const p of props) if (p.kind === 'crowd') applyCrowdTier(p);
    if (st.glows) st.glows.material.uniforms.uMaxPx.value = TIERS[q.tier].spritePx;
    for (const s of pointSets) s.material.uniforms.uMaxPx.value = s === st.sunPoint ? SUN_PX : TIERS[q.tier].spritePx;
  }

  function stepDown() {
    const i = TIER_NAMES.indexOf(q.pointTier), j = TIER_NAMES.indexOf(q.nebulaTier);
    if (q.ratio > 1) {
      q.ratio = Math.max(1, q.ratio - 0.5);
      q.steps.push('ratio');
      resize(width, height);
    } else if (i < TIER_NAMES.length - 1) {
      q.pointTier = TIER_NAMES[i + 1];
      q.steps.push('points');
      applyAllTiers();
    } else if (j < TIER_NAMES.length - 1) {
      q.nebulaTier = TIER_NAMES[j + 1];
      q.steps.push('nebula');
      applyAllTiers();
    } else return false;
    return true;
  }

  // ---------- per frame: placing everything for a camera description ----------

  const tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3();

  function weightsOf(desc) {
    const w = {};
    const fade = finite(desc.fade) ? desc.fade : 1;
    for (const name of LAYER_NAMES) {
      const lw = desc.layers?.[name]?.weight ?? desc.layerWeights?.[name] ?? 0;
      w[name] = lw * fade;
    }
    return w;
  }

  const webDrawn = () => pointSets.reduce((n, s) => n + (s.kind.startsWith('web-') ? s.drawn || 0 : 0), 0);

  // How far inside the Milky Way's disc the camera is: 1 inside (band sky), 0 outside (the galaxy seen whole).
  function insideness(pos) {
    const gc = OBJECTS['milky-way'].pos;
    const R = Math.hypot(pos[0] - gc[0], pos[1] - gc[1]), z = Math.abs(pos[2] - gc[2]);
    return (1 - smoothstep(1500, 6000, z)) * (1 - smoothstep(45000, 65000, R));
  }

  // desc: a camera description like core/geo.cameraFor's (pos, quat, fovY, aspect, velocity, phiView, layers or
  // layerWeights, fade). view: { width, height } in CSS px for sprite sizes and culling.
  function place(desc, view) {
    const pos = desc.pos;
    const phi = Math.max(0, finite(desc.phiView) ? desc.phiView : 0);
    const quat = desc.quat || basisToQuat(desc.basis);
    camera.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
    camera.position.set(0, 0, 0);
    camera.fov = desc.fovY;
    camera.aspect = view.width / view.height;
    camera.updateMatrixWorld(true);
    const fwd = [-camera.matrixWorld.elements[8], -camera.matrixWorld.elements[9], -camera.matrixWorld.elements[10]];
    const right = [camera.matrixWorld.elements[0], camera.matrixWorld.elements[1], camera.matrixWorld.elements[2]];
    const up = [camera.matrixWorld.elements[4], camera.matrixWorld.elements[5], camera.matrixWorld.elements[6]];
    const v = unit(desc.velocity || fwd);
    const vView = [dot(v, right), dot(v, up), -dot(v, fwd)];
    rel.uExpPhi.value = Math.exp(phi);
    rel.uExpMinusPhi.value = Math.exp(-phi);
    rel.uVel.value.set(vView[0], vView[1], vView[2]);
    const tanY = Math.tan((desc.fovY * D2R) / 2);
    const pxPerRad = view.height / 2 / tanY;
    rel.uPxPerRad.value = pxPerRad;
    rel.uRatio.value = view.ratio || q.ratio;
    const w = weightsOf(desc);
    const fade = finite(desc.fade) ? desc.fade : 1;
    const scale = viewScale(pos);
    st.inside = insideness(pos);
    const mwP = st.mwParticles && st.mwParticles.enabled;
    for (const name of LAYER_NAMES) {
      const L = layers[name];
      L.weight = w[name];
      const o = desc.layers?.[name]?.origin || pos.map((x) => x / L.unit);
      L.root.position.set(-o[0], -o[1], -o[2]);
      L.root.updateMatrixWorld(true);
      L.clip = desc.layers?.[name] ? [desc.layers[name].near, desc.layers[name].far] : CLIP[name];
    }
    const adaptPts = Math.pow(Math.max(1, Math.exp(lnY(Math.exp(phi) * 6000) - lnY(6000))), -0.35);
    st.adapt = adaptPts;
    // Uniforms an art module keeps for its own use when it is not handed ours (galaxy.js REL).
    for (const mod of ['galaxy', 'nebula', 'planets']) {
      const setRel = artFn(mod, 'setRelativity');
      if (setRel) {
        try {
          setRel({ expPhi: Math.exp(phi), expMinusPhi: Math.exp(-phi), velocityView: vView, fade: 1, fovY: desc.fovY },
            { height: view.height, ratio: view.ratio || q.ratio });
        } catch { /* keep drawing */ }
      }
    }
    // Galaxy layer: particles outside the disc, the band inside; the group impostor stands in for the particles.
    const galaxyOut = w.galaxy * (1 - smoothstep(0.05, 0.4, st.inside));
    if (st.mwParticles) {
      const mw = st.mwParticles;
      mw.obj.visible = mwP && galaxyOut > 0.002;
      const setOpacity = mw.art ? artFn(mw.art, 'setOpacity') : null;
      if (setOpacity && mw.obj.visible) { try { setOpacity(mw.obj, galaxyOut); } catch { /* keep drawing */ } }
      mw.obj.visible = mwP && galaxyOut > 0.002;
      // The same total light at any particle count (lit for the mid tier's count).
      mw.material.uniforms.uExposure.value = mw.material.userData.lyhExposure * GALAXY_COUNTS.mid
        / Math.max(1, mw.starsDrawn || mw.total);
      mw.material.uniforms.uFade.value = galaxyOut * adaptPts;
    }
    if (st.sky) {
      st.sky.visible = w.galaxy * st.inside > 0.002;
      const u = st.sky.material.uniforms;
      u.uFade.value = w.galaxy * st.inside;
      u.uViewToWorld.value.setFromMatrix4(camera.matrixWorld);
      u.uTan.value.set(tanY * camera.aspect, tanY);
      u.uFine.value = smoothstep(30, 12, desc.fovY);
      // Turn the band so the bulge stays toward the Galactic Centre from wherever the camera is.
      const gc = OBJECTS['milky-way'].pos;
      const dl = Math.atan2(gc[1] - pos[1], gc[0] - pos[0]) - Math.atan2(gc[1], gc[0]);
      u.uBandRot.value.set(Math.cos(dl), Math.sin(dl), 0, -Math.sin(dl), Math.cos(dl), 0, 0, 0, 1);
      // Above or below the disc the band shifts the other way: its light comes from about 2,500 ly away.
      u.uTilt.value = Math.sin(Math.atan((pos[2] - gc[2]) / 2500));
      // Eye adaptation: the glow ahead brightens by Y(D T) / Y(T); the exposure follows most of that down.
      const boost = Math.exp(lnY(Math.exp(phi) * 3800) - lnY(3800));
      // In a narrow view (the Betelgeuse scan is 7.6° tall) the band's clouds would fill the screen as a brown fog
      // over the stars; a telescope view shows the band's stars, not its glow, so the glow fades as the view narrows.
      const fovX = (2 * Math.atan(tanY * camera.aspect)) / D2R;
      const zoom = 0.07 + 0.93 * smoothstep(5, 35, Math.min(desc.fovY, fovX));
      u.uExposure.value = SKY_EXPOSURE * Math.pow(Math.max(1, boost), -0.75) * zoom;
      // ...and resolves into its stars, a few px apart, over the darker glow (the dust lanes stay empty).
      u.uCell.value = 6 / pxPerRad;
      u.uStars.value = 0.9 * smoothstep(30, 14, Math.min(desc.fovY, fovX));
    }
    // Points: layer fades and per-layer exposure. Eye adaptation: ahead, a field of stars brightens like a glow, by
    // Y(D T) / Y(T) (D² more stars per patch of sky, each Y(D T) / Y(T) / D² as bright); the exposure follows a
    // third of that power down, so the crowd ahead stays bright and blue without burning out.
    for (const s of pointSets) {
      const L = layers[s.layer];
      let f = L.weight * s.fade * adaptPts;
      if (s.kind === 'web-far' || s.kind === 'web-near') {
        const sMly = Math.min(scale / M, WEB_SCALE_MAX);   // a camera pulled back past the start sees what the start sees
        // More points at a higher tier means more, fainter galaxies, not a brighter sky.
        const thin = Math.pow(WEB_COUNTS.low / Math.max(WEB_COUNTS.low, webDrawn()), 0.5);
        s.material.uniforms.uExposure.value = WEB_EXPOSURE * thin * Math.pow(WEB_REF * sMly, WEB_FALLOFF);
        s.material.uniforms.uNear.value = Math.max(1e-3, 0.02 * sMly);
      }
      // The dense web around home comes in as the camera closes in (Powers of Ten): from 400 to 125 Mly out.
      if (s.kind === 'web-near') f *= 1 - smoothstep(8.1, 8.6, Math.log10(scale));
      // The Sun as a star gives way to its disc and glare (planets.js) inside the Solar System, and to its glow when
      // it is a scan candidate (lightCandidates).
      if (s === st.sunPoint) f *= (1 - smoothstep(0.2, 0.9, w.solar)) * (st.sunGlow ? 0 : 1);
      s.material.uniforms.uFade.value = f;
      s.pts.visible = f > 0.002;
    }
    if (st.glows) {
      const f = layers.stars.weight * adaptPts;
      st.glows.material.uniforms.uFade.value = f;
      st.glows.pts.visible = st.glows.count > 0 && f > 0.002;
    }
    // Keep all layers together inside the tier's point budget: while the stars layer comes in, draw fewer Milky Way
    // particles (each brighter, so the light holds).
    if (st.mwParticles) {
      let others = 0;
      for (const s of pointSets) if (s.pts.visible) others += s.drawn ?? s.total;
      const full = st.mwParticles.full || 1;
      const k = st.mwParticles.obj.visible ? clamp((TIERS[q.pointTier].points - others) / full, 0, 1) : 1;
      if (Math.abs(k - (st.mwParticles.squeeze ?? 1)) > 0.01) applyGalaxyTier(k);
    }
    // Big objects: cull what is off screen, fade by layer, and place the held ones at their aberrated centres.
    const halfDiag = Math.atan(Math.hypot(tanY * camera.aspect, tanY));
    const visibleBodies = new Set();
    const toView = tmpQ.copy(camera.quaternion).invert();
    // A crowd is drawn at least this big (CSS px of radius), so a far cluster reads as a crowd of galaxies.
    const crowdPx = clamp(CROWD_SHARE * Math.min(view.width, view.height), CROWD_MIN, CROWD_MAX);
    const nebulaPx = clamp(NEBULA_SHARE * Math.min(view.width, view.height), NEBULA_MIN, NEBULA_MAX);
    // Inside the Solar System the eye is set for the Sun and the sunlit planets: the faint glow of nebulae is gone
    // (the Pleiades' haze must not sit beside the Earth as a blue blob).
    const nebulaEye = 1 - smoothstep(0.05, 0.6, w.solar);
    for (const p of props) {
      let f = w[p.layer] * p.fade;
      if (p.kind === 'nebula') f *= nebulaEye;
      if (p.kind === 'crowd') {
        f *= adaptPts;
        // The clusters of the dense web around home come in with it (web-near), and a candidate always shows.
        if (p.near && !st.crowdLit?.has(p.id)) f *= 1 - smoothstep(8.1, 8.6, Math.log10(scale));
      }
      // The Milky Way impostor: in the group layer while the particles are not drawn; with no particles (the low
      // tier) it also stands for them in the galaxy layer, until the camera is inside the disc.
      if (p === st.mwImpostor) {
        f = (mwP ? w.group * (1 - w.galaxy / Math.max(fade, 1e-6)) : Math.max(w.group, w.galaxy)) * (1 - st.inside);
      }
      p.visible = false;
      p.anchor.visible = false;
      if (!(f > 0.002)) continue;
      const d = sub(p.pos, pos), dist = len(d);
      if (!(dist > 0)) continue;
      const n = [d[0] / dist, d[1] / dist, d[2] / dist];
      const seen = phi > 0 ? aberrate(n, v, phi) : { n, D: 1 };
      let ang = (p.radiusLy >= dist ? Math.PI / 2 : Math.asin(p.radiusLy / dist)) / seen.D;
      // A far cluster grows to a readable crowd; a far nebula that is a scan candidate grows to a readable cloud (on
      // a phone the Horsehead would be a few px).
      let grow = 1;
      if (p.kind === 'crowd') grow = Math.max(1, crowdPx / Math.max(ang * pxPerRad, 1e-9));
      else if (p.kind === 'nebula' && p.light > 0 && st.litIds?.has(p.nebula)) {
        const lightPx = (p.light >= dist ? Math.PI / 2 : Math.asin(p.light / dist)) / seen.D * pxPerRad;
        grow = Math.max(1, nebulaPx / Math.max(lightPx, 1e-9));
      }
      if (p.kind === 'crowd') p.anchor.scale.setScalar(p.scale * grow);
      ang = Math.min(Math.PI / 2, ang * grow);
      const rPx = Math.min(ang, 1.5) * pxPerRad;
      const off = Math.acos(clamp(dot(seen.n, fwd), -1, 1));
      const reach = Math.max(ang, p.dotPx / pxPerRad);
      if (rPx < p.minPx || off > halfDiag + reach + 0.02) continue;
      p.visible = true;
      p.anchor.visible = true;
      p.D = seen.D;
      p.rPx = rPx;
      if (!p.self) {
        const k = dist / LAYER_UNITS[p.layer];
        p.anchor.position.set(seen.n[0] * k, seen.n[1] * k, seen.n[2] * k);
        p.anchor.scale.setScalar(p.scale / seen.D * grow);
      }
      setFade(p, f);
      const values = { uDoppler: seen.D, uTime: st.time, uPxPerRad: pxPerRad, uRatio: rel.uRatio.value };
      if (p.sunLit || p.layer === 'solar') {
        const s = unit(sub(OBJECTS.sun.pos, p.pos));
        values.uSun = s;
        values.uSunView = new THREE.Vector3(s[0], s[1], s[2]).applyQuaternion(toView);
      }
      feed(p.obj, values);
      if (p.layer === 'solar' && rPx > 2) visibleBodies.add(p.id);
    }
    // A layer draws while its weight is up, or while it holds the Milky Way impostor standing in for the particles.
    layers.group.extra = Boolean(st.mwImpostor && st.mwImpostor.visible);
    // Planet points stand in for discs too small to draw; they hide when the disc shows.
    // Each stays a clear dot (at least PLANET_FLOOR of energy), so a planet beside the Sun is not lost in its glare.
    if (st.planetPoints) {
      const a = st.planetPoints.pts.geometry.getAttribute('aLum');
      const posAu = pos.map((x) => x / AU_LY);
      st.planetPoints.ids.forEach((id, i) => {
        const o = OBJECTS[id];
        const r = len(sub(o.pos.map((x) => x / AU_LY), posAu));
        const floor = PLANET_FLOOR * r * r / STAR_EXPOSURE;
        a.array[i] = visibleBodies.has(id) ? 0 : Math.max(st.planetPoints.base[i], floor);
      });
      a.needsUpdate = true;
    }
    // Solar layer: the far plane follows the farthest body, so the depth buffer keeps its precision.
    if (layers.solar.clip) {
      let far = 1;
      for (const p of props) if (p.layer === 'solar' && p.visible) far = Math.max(far, 2 * len(sub(p.pos, pos)) / AU_LY);
      layers.solar.clip = [layers.solar.clip[0], Math.min(CLIP.solar[1], far)];
    }
    return { fwd, right, up, vView, pxPerRad, w };
  }

  // The headlight and the heat glow, from the engine state (true η, the zone's gas, heat and the crack lock).
  function syncFx(state, desc, placed) {
    const f = state && state.flight;
    const flying = f && (state.phase === 'flight' || state.phase === 'lost');
    let energy = 0, T = LUT_TMAX;
    if (flying) {
      const z = zoneAt(state);
      const r = heatRatio(z ? z.zone.n : 1e-7, f.eta);
      T = Math.min(LUT_TMAX, T_CMB * Math.exp(Math.min(f.eta, 30)));
      energy = HEADLIGHT * r * smoothstep(0, 0.6, desc.phiView || 0) * (finite(desc.fade) ? desc.fade : 1);
      st.heatRatio = r;
    }
    const u = headlight.material.uniforms;
    const halo = 2 + 2.5 * Math.log2(1 + Math.min(st.heatRatio || 0, 8));
    u.uDir.value.set(placed.vView[0], placed.vView[1], placed.vView[2]);
    u.uTemp.value = T;
    u.uEnergy.value = Math.min(energy, 600);
    u.uHaloPx.value = halo;
    u.uSizePx.value = 3.5 * halo;
    headlight.visible = energy > 0.01;
    st.heat = flying ? clamp(f.heat || 0, 0, 1) : 0;
    st.flash = flying && !reduced ? clamp((f.lock || 0) / 0.8, 0, 1) : 0;
    const h = heatFx.material.uniforms;
    h.uHeat.value = smoothstep(0.55, 1, st.heat);
    h.uFlash.value = st.flash;
    heatFx.visible = h.uHeat.value > 0.001 || h.uFlash.value > 0.001;
  }

  // ---------- drawing ----------

  // Draw every layer with weight for the camera already placed; then the effects. Returns { calls, points }.
  function drawLayers(target = null, { withFx = true, clear = true } = {}) {
    renderer.info.reset();
    renderer.setRenderTarget(target);
    if (clear) renderer.clear(true, true, true);
    let points = 0;
    for (const name of LAYER_NAMES) {
      const L = layers[name];
      if (!(L.weight > 0.002) && !L.extra) continue;
      const [near, far] = L.clip || CLIP[name];
      camera.near = near;
      camera.far = Math.max(far, near * 10);
      camera.updateProjectionMatrix();
      renderer.clearDepth();
      renderer.render(L.scene, camera);
    }
    for (const s of pointSets) if (s.pts.visible && layers[s.layer].weight > 0.002) points += s.drawn ?? s.total;
    if (st.glows && st.glows.pts.visible && layers.stars.weight > 0.002) points += st.glows.count;
    if (st.mwParticles && st.mwParticles.obj.visible && layers.galaxy.weight > 0.002) points += st.mwParticles.drawn || 0;
    for (const p of props) {
      if (!p.visible || !p.anchor.visible) continue;
      p.obj.traverse((o) => { if (o.isPoints) points += o.geometry.drawRange.count === Infinity
        ? o.geometry.getAttribute('position').count : o.geometry.drawRange.count; });
    }
    if (withFx) {
      camera.near = 0.1; camera.far = 10; camera.updateProjectionMatrix();
      renderer.render(fx, camera);
    }
    const calls = renderer.info.render.calls;
    renderer.setRenderTarget(null);
    return { calls, points };
  }

  // ---------- public API ----------

  function resize(w, h) {
    width = Math.max(1, Math.round(w || canvas.clientWidth || 1));
    height = Math.max(1, Math.round(h || canvas.clientHeight || 1));
    renderer.setPixelRatio(q.ratio);
    renderer.setSize(width, height, false);
    rel.uRatio.value = q.ratio;
    heatFx.material.uniforms.uAspect.value = width / height;
    headlight.material.uniforms.uViewport.value.set(width, height);
  }

  function sync(state, cam) {
    if (!cam) return;
    st.state = state;
    st.cam = cam;
    st.time = reduced ? 0 : (now() - st.t0) / 1000;
    if (state && Number.isInteger(state.chapter) && state.chapter > (st.prepared ?? -1)) prepare(state.chapter);
    lightCandidates(state, cam);
    const placed = place(cam, { width, height, ratio: q.ratio });
    syncFx(state, cam, placed);
    st.placed = placed;
  }

  // In a scan (and the reveal after it) every candidate star is drawn as a glow (points.js createGlowMaterial) in its
  // true colour, at least GLOW_MIN_PX across (a red supergiant GLOW_GIANT_PX) and larger when brighter, so a star
  // chosen by its colour or size can be seen and compared even when it is faint from the scan's vantage point
  // (Aldebaran from the Orion Nebula is magnitude 7). The glow stands in for the star's own point, which goes dark.
  // Only the named stars at the front of the stars buffer change, and only when the candidates or the camera move.
  // Candidate clusters are noted too (st.crowdLit), so a near one shows even before the near web comes in.
  function lightCandidates(state, cam) {
    const ph = state && state.phase;
    let ids = [];
    if (ph === 'clue' || ph === 'scan' || ph === 'fork' || ph === 'reveal') {
      const sc = scanOf(state);
      if (sc) ids = ph === 'reveal' ? [sc.entry.target.id] : sc.candidates.map((c) => c.id);
    }
    st.crowdLit = new Set(ids.map((id) => `crowd:${id}`));
    st.litIds = new Set(ids);
    const set = st.starSet, glows = st.glows;
    if (!set || !st.namedIndex || !glows) return;
    const key = ids.length ? `${ids.join(',')}|${cam.pos.map((v) => v.toFixed(1)).join(',')}` : '';
    if (key === set.lightKey) return;
    set.lightKey = key;
    const attr = set.pts.geometry.attributes.aLum;
    let wide = (set.lit || []).some(([i]) => i >= st.namedIndex.size);   // cluster members to put back
    for (const [i, v] of set.lit || []) attr.array[i] = v;
    set.lit = [];
    const g = glows.pts.geometry;
    const gp = g.attributes.position.array, gt = g.attributes.aTemp.array, gl = g.attributes.aLum.array;
    const gm = g.attributes.aMin.array;
    let k = 0;
    st.sunGlow = false;
    for (const id of ids) {
      const o = OBJECTS[id];
      if (!o || k >= GLOW_SLOTS || !finite(o.T) || !finite(o.absMag)) continue;
      const i = st.namedIndex.get(id);
      if (id === 'sun') st.sunGlow = true;
      else if (i === undefined) continue;
      gp[k * 3] = o.pos[0]; gp[k * 3 + 1] = o.pos[1]; gp[k * 3 + 2] = o.pos[2];
      gt[k] = o.T;
      gl[k] = lumOf(o.absMag);
      gm[k] = o.radiusSun >= 300 ? GLOW_GIANT_PX : GLOW_MIN_PX;
      k++;
      if (i !== undefined) { set.lit.push([i, attr.array[i]]); attr.array[i] = 0; }
    }
    glows.count = k;
    g.setDrawRange(0, k);
    for (const name of ['position', 'aTemp', 'aLum', 'aMin']) g.attributes[name].needsUpdate = true;
    // A candidate open cluster: its brightest members shine at least as clear dots (brightest first), so the cluster
    // reads as a group of stars from far away (the Beehive is 400 ly from the Pleiades scan).
    const sp = set.pts.geometry.attributes.position.array;
    for (const id of ids) {
      const members = st.clusterMembers?.get(id);
      if (!members) continue;
      members.forEach((i, rank) => {
        const r = len(sub([sp[i * 3], sp[i * 3 + 1], sp[i * 3 + 2]], cam.pos)) / LAYER_UNITS.stars;
        const floor = (0.5 + 1.5 * (1 - rank / members.length)) * r * r / STAR_EXPOSURE;
        if (attr.array[i] < floor) { set.lit.push([i, attr.array[i]]); attr.array[i] = floor; wide = true; }
      });
    }
    attr.clearUpdateRanges?.();
    if (!wide) attr.addUpdateRange?.(0, st.namedIndex.size);
    attr.needsUpdate = true;
  }

  function render() {
    if (st.lost || st.disposed || !st.cam) {
      if (!st.lost && !st.disposed) { renderer.setRenderTarget(null); renderer.clear(true, true, true); }
      st.last = { calls: 0, points: 0 };
      return st.last;
    }
    st.last = drawLayers(null);
    return st.last;
  }

  function prepare(chapter = 0) {
    const c = clamp(Math.round(Number(chapter) || 0), 0, 3);
    st.prepared = Math.max(st.prepared ?? -1, c);
    const plan = [buildWeb, buildCrowds, buildWaypoints, buildGroup, buildStars, buildSky, buildMilkyWay, buildNebulae,
      buildSolar];
    // Carina (the last stop of chapter II) is a nebula, so the nebulae come with chapter II.
    const chapterOf = { buildWeb: 0, buildCrowds: 0, buildWaypoints: 0, buildGroup: 1, buildStars: 1, buildSky: 1, buildMilkyWay: 1,
      buildNebulae: 1, buildSolar: 3 };
    for (const fn of plan) {
      const at = chapterOf[fn.name];
      if (at <= c) fn(at);
    }
    return new Promise((resolve) => { waiters.push({ chapter: c, resolve }); settle(); });
  }

  // A new tier: its pixel ratio, sprite cap and budgets. Textures are baked again at its sizes, and the point data
  // too when it needs more points than were made (a lower tier draws a prefix of what is there).
  function setQuality(t) {
    if (!TIERS[t]) return;
    const changed = t !== q.tier;
    q.tier = t;
    q.ratio = ratioFor(t);
    q.pointTier = t;
    q.nebulaTier = t;
    q.steps = [];
    q.adapt = { t: 0, sum: 0, n: 0 };
    resize(width, height);
    if (changed) dropBakes();
    if (TIER_NAMES.indexOf(t) < TIER_NAMES.indexOf(built.tier)) {
      built.tier = t;
      dropPoints();
    }
    if (st.prepared !== undefined) prepare(st.prepared);
    applyAllTiers();
  }

  function adapt(frameMs) {
    if (!(frameMs > 0) || frameMs > 250) return false;
    const a = q.adapt;
    a.t += frameMs; a.sum += frameMs; a.n++;
    if (a.t < ADAPT_WINDOW) return false;
    const mean = a.sum / a.n;
    a.t = 0; a.sum = 0; a.n = 0;
    return mean > ADAPT_SLOW ? stepDown() : false;
  }

  function info() {
    let texBytes = 0;
    for (const t of textures.values()) texBytes += textureBytes(t);
    return {
      tier: q.tier, ratio: q.ratio, calls: st.last.calls, points: st.last.points, maxSpritePx: TIERS[q.tier].spritePx,
      texBytes, backend, gpu, pointTier: q.pointTier, nebulaTier: q.nebulaTier, steps: [...q.steps],
      worker: gen.usesWorker, pending: queue.length + activeKeys.size, maxSlice: st.maxSlice || null,
      headlight: { visible: headlight.visible, energy: headlight.material.uniforms.uEnergy.value,
        temp: headlight.material.uniforms.uTemp.value }, inside: st.inside, adapt: st.adapt,
    };
  }

  // Read the canvas just drawn: CSS-px rectangle → RGBA bytes (rows bottom-up, as GL gives them).
  function readCanvas(x, y, w, h) {
    const r = q.ratio, px = Math.round(x * r), py = Math.round((height - y - h) * r);
    const pw = Math.max(1, Math.round(w * r)), ph = Math.max(1, Math.round(h * r));
    const buf = new Uint8Array(pw * ph * 4);
    gl.readPixels(px, py, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return { buf, pw, ph };
  }

  // QA: the colour around a projected object. Returns the mean { r, g, b, lum } (sRGB, 0..1) over a disc of
  // radiusPx CSS px, peak (the brightest pixel in it), background (the mean over the ring from radiusPx to
  // 2 radiusPx) and star (peak − background: a faint star's own colour, whatever lies behind it).
  function probe(objectId, radiusPx = 6) {
    const none = { r: 0, g: 0, b: 0, lum: 0, peak: null, background: null, star: null };
    if (!st.cam || st.lost) return none;
    const p = project(objectId, st.cam);
    render();
    const R = Math.max(1, radiusPx), R2 = 2 * R;
    const x0 = clamp(p.x - R2, 0, width - 1), y0 = clamp(p.y - R2, 0, height - 1);
    const x1 = clamp(p.x + R2, 1, width), y1 = clamp(p.y + R2, 1, height);
    const { buf, pw, ph } = readCanvas(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    const sum = [0, 0, 0, 0], ring = [0, 0, 0, 0];
    let best = -1, peak = null;
    const cx = (p.x - x0) * q.ratio, cy = (y1 - p.y) * q.ratio, rr = R * q.ratio;
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
      const d2 = (i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2;
      if (d2 > 4 * rr * rr) continue;
      const k = (j * pw + i) * 4, acc = d2 > rr * rr ? ring : sum;
      acc[0] += buf[k]; acc[1] += buf[k + 1]; acc[2] += buf[k + 2]; acc[3]++;
      if (acc === ring) continue;
      const l = 0.2126 * buf[k] + 0.7152 * buf[k + 1] + 0.0722 * buf[k + 2];
      if (l > best) { best = l; peak = [buf[k] / 255, buf[k + 1] / 255, buf[k + 2] / 255]; }
    }
    if (!sum[3]) return { ...none, x: p.x, y: p.y, visible: p.visible };
    const lumOfRGB = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const mean = sum.slice(0, 3).map((v) => v / (255 * sum[3]));
    const bg = ring[3] ? ring.slice(0, 3).map((v) => v / (255 * ring[3])) : [0, 0, 0];
    const star = peak.map((v, i) => Math.max(0, v - bg[i]));
    const rgb = (c) => ({ r: c[0], g: c[1], b: c[2], lum: lumOfRGB(c) });
    return { ...rgb(mean), x: p.x, y: p.y, visible: p.visible, peak: rgb(peak), background: rgb(bg), star: rgb(star) };
  }

  // QA: statistics of a frame. x: throttle for the view rapidity (defaults to the synced one). width × height: the
  // frame size in CSS px. coneShare30: share of all light on the sphere around the camera that is seen within 30° of
  // the direction of motion (a cube render); blueRed10: blue over red in the central 10°; litFraction: share of
  // pixels with lum > 0.25; meanRGB: mean colour (0..1).
  function debugRender({ x, width: w = 320, height: h = 180, cube = 64 } = {}) {
    if (!st.cam || st.lost) return null;
    const desc = { ...st.cam };
    if (finite(x)) {
      desc.phiView = viewRapidity(x);
      desc.expPhi = Math.exp(desc.phiView);
      desc.expMinusPhi = Math.exp(-desc.phiView);
    }
    const keep = { width, height, ratio: q.ratio };
    // 1. The frame at w × h, ratio 1, on the canvas.
    q.ratio = 1;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    width = w; height = h;
    headlight.material.uniforms.uViewport.value.set(w, h);
    const placed = place(desc, { width: w, height: h, ratio: 1 });
    syncFx(st.state, desc, placed);
    drawLayers(null);
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let lit = 0, mr = 0, mg = 0, mb = 0, br = 0, bb = 0;
    const tanY = Math.tan((desc.fovY * D2R) / 2), tanX = tanY * (w / h);
    const vv = placed.vView, cos10 = Math.cos(10 * D2R);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4, r = buf[k] / 255, g = buf[k + 1] / 255, b = buf[k + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum > 0.25) lit++;
      mr += r; mg += g; mb += b;
      const dx = ((i + 0.5) / w * 2 - 1) * tanX, dy = ((j + 0.5) / h * 2 - 1) * tanY;
      const c = (dx * vv[0] + dy * vv[1] - vv[2]) / Math.hypot(dx, dy, 1);
      if (c >= cos10) { br += r; bb += b; }
    }
    const N = w * h;
    // 2. The whole sphere, six 90° faces, for the share of light near the direction of motion.
    // An sRGB target: the GPU stores light with the precision where it is dim and blends in linear.
    const rt = new THREE.WebGLRenderTarget(cube, cube, { colorSpace: THREE.SRGBColorSpace, depthBuffer: true });
    const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const vel = unit(desc.velocity || desc.basis.fwd);
    const fbuf = new Uint8Array(cube * cube * 4);
    let inCone = 0, all = 0;
    const cos30 = Math.cos(30 * D2R);
    for (const f of faces) {
      const upHint = Math.abs(f[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
      const right = unit(cross(f, upHint)), up = cross(right, f);
      const fd = { ...desc, quat: basisToQuat({ right, up, fwd: f }), basis: { right, up, fwd: f }, fovY: 90, fade: 1,
        layers: undefined, layerWeights: Object.fromEntries(LAYER_NAMES.map((n) => [n, weightsOf(desc)[n]])) };
      place(fd, { width: cube, height: cube, ratio: 1 });
      drawLayers(rt, { withFx: false });
      renderer.readRenderTargetPixels(rt, 0, 0, cube, cube, fbuf);
      for (let j = 0; j < cube; j++) for (let i = 0; i < cube; i++) {
        const k = (j * cube + i) * 4;
        const lum = 0.2126 * LIN[fbuf[k]] + 0.7152 * LIN[fbuf[k + 1]] + 0.0722 * LIN[fbuf[k + 2]];
        if (!(lum > 0)) continue;
        const a = (i + 0.5) / cube * 2 - 1, b = (j + 0.5) / cube * 2 - 1;
        const dir = unit([0, 1, 2].map((k) => f[k] + a * right[k] + b * up[k]));
        const dOmega = (1 + a * a + b * b) ** -1.5;
        all += lum * dOmega;
        if (dot(dir, vel) >= cos30) inCone += lum * dOmega;
      }
    }
    rt.dispose();
    // Back to the live frame (a resize clears the canvas, so draw it again).
    q.ratio = keep.ratio;
    resize(keep.width, keep.height);
    sync(st.state, st.cam);
    render();
    return {
      coneShare30: all > 0 ? inCone / all : 0, blueRed10: bb / Math.max(br, 1e-6), litFraction: lit / N,
      meanRGB: [mr / N, mg / N, mb / N],
    };
  }

  // A camera description for an arbitrary viewpoint (the lens, and lens.js through renderCamera).
  function describeAt(pos, fwd, fovY, aspect = 1) {
    const f = unit(fwd), right = unit(cross(f, across(f, 0)));
    const basis = { right, up: cross(right, f), fwd: f };
    const weights = layerWeights(viewScale(pos));
    return { pos, basis, quat: basisToQuat(basis), fovY, aspect, velocity: f, phiView: 0, fade: 1, layerWeights: weights };
  }

  // Render any camera description into a render target (or the canvas with null) at size × size CSS px, ratio 1.
  // force: layer names drawn at full weight whatever the scale. Used by lens.js.
  function renderCamera(desc, target, { width: w, height: h, force = [] } = {}) {
    const vw = w || target?.width || width, vh = h || target?.height || height;
    const d = { ...desc, layers: undefined, layerWeights: { ...(desc.layerWeights || layerWeights(viewScale(desc.pos))) } };
    for (const n of force) d.layerWeights[n] = 1;
    place(d, { width: vw, height: vh, ratio: 1 });
    const out = drawLayers(target, { withFx: false });
    if (st.cam) sync(st.state, st.cam);
    return out;
  }

  // The telescope view for a card: from the ship toward the object, framed about 2.4 times its size.
  let lens = null;
  function lensShot(objectId, size = 192) {
    const o = OBJECTS[objectId];
    if (!o || st.lost) return null;
    const make = artFn('lens', 'createLens');
    if (make) {
      try { lens = lens || make(renderer); return lens.shot(api, objectId, size); }
      catch (err) { console.warn('light-years-home: lens', err?.message || err); }
    }
    const from = st.cam?.ship || st.cam?.pos || OBJECTS.start.pos;
    const d = len(sub(o.pos, from));
    const r = o.radiusLy || (o.radiusKm ? o.radiusKm / KM_PER_LY : 0);
    const fov = clamp((2 * Math.atan(Math.max(r, d * 0.004) / Math.max(d, 1e-12)) * 2.4) / D2R, 0.02, 40);
    const desc = describeAt(from, sub(o.pos, from), fov);
    const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
    renderCamera(desc, rt, { width: size, height: size, force: [o.layer] });
    const buf = new Uint8Array(size * size * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    rt.dispose();
    const out = document.createElement('canvas');
    out.width = out.height = size;
    const ctx = out.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size * 4; i++) {
        const v = buf[(size - 1 - j) * size * 4 + i];
        img.data[j * size * 4 + i] = (i & 3) === 3 ? 255 : Math.round(255 * srgb(v / 255));
      }
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  function onLost(e) {
    e.preventDefault();
    st.lost = true;
    for (const cb of st.lostCbs) { try { cb(); } catch { /* keep going */ } }
  }
  function onRestored() {
    st.lost = false;
    // Render targets lost their pixels: bake them again (points and meshes upload again by themselves).
    dropBakes(false);
    prepare(st.prepared ?? 0);
    for (const cb of st.restoredCbs) { try { cb(); } catch { /* keep going */ } }
  }
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  function dispose() {
    st.disposed = true;
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    gen.dispose();
    for (const L of Object.values(layers)) L.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => m.dispose());
    });
    for (const t of textures.values()) t.dispose();
    renderer.dispose();
  }

  const api = {
    renderer, camera, layers, TIERS,
    setQuality, resize, prepare, sync, render, lensShot, debugRender, probe, info, dispose, adapt,
    renderCamera, describeAt,
    simulateSlow(ms, seconds) {
      q.adapt = { t: 0, sum: 0, n: 0 };
      let changed = false;
      for (let t = 0; t < seconds * 1000; t += ms) changed = adapt(ms) || changed;
      return changed;
    },
    onContextLost(cb) { st.lostCbs.push(cb); return () => st.lostCbs.splice(st.lostCbs.indexOf(cb), 1); },
    onContextRestored(cb) { st.restoredCbs.push(cb); return () => st.restoredCbs.splice(st.restoredCbs.indexOf(cb), 1); },
    get lost() { return st.lost; },
    get ready() { return queue.length === 0 && activeKeys.size === 0; },
    get backend() { return backend; },
    get tier() { return q.tier; },
  };
  resize(width, height);
  return api;
}

// The heat glow at the screen's edges (H above 0.55) and a short white flash when a pane cracks.
function createHeatFx() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { uHeat: { value: 0 }, uFlash: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vNdc;
      void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uHeat, uFlash, uAspect;
      varying vec2 vNdc;
      void main() {
        vec2 p = vNdc * vec2(max(uAspect, 1.0), max(1.0 / uAspect, 1.0));
        float edge = smoothstep(0.55, 1.35, length(p));
        vec3 c = vec3(1.0, 0.32, 0.06) * edge * uHeat * 0.45 + vec3(0.9, 0.95, 1.0) * uFlash * uFlash * 0.35;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  return mesh;
}

// sRGB byte → linear light.
const LIN = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

const srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
