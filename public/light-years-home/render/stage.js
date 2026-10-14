// Light Years Home v3: the stage. One WebGL2 renderer and two passes a frame (final.md 16.1): the backdrop (far web
// and landmarks, its own scene, camera at the origin) and the zone (the zone's scene in u, with depth). Holds the
// quality tiers and their budgets (16.3), the step-down for slow frames, the shared light-speed uniforms, the bake
// slicer, the worker generator for core/gen, shader warm-up, byte counts and the lost-context hooks.
// TIERS, the generator and the byte count come from v1's render/view.js.
import * as THREE from 'three';
import { createLut, createRelativity, LUT_SIZE, LUT_TMIN, LUT_TMAX } from './points.js';
import { blackbodyRGB } from '../core/physics.js';
import { cosmicWeb } from '../core/gen/web.js';
import { starField, openCluster } from '../core/gen/stars.js';
import { galaxyParticles } from '../core/gen/galaxy.js';

// GLSL for the zone's own shaders: lyhBB(T) is a blackbody's linear colour from the shared table (uniform uLUT,
// stage.lut), brightest channel 1, as render/points.js reads it.
export const BLACKBODY_GLSL = /* glsl */ `
  uniform sampler2D uLUT;
  vec3 lyhBB(float T) {
    float f = clamp(log(T / ${LUT_TMIN.toFixed(1)}) / ${Math.log(LUT_TMAX / LUT_TMIN).toFixed(6)}, 0.0, 1.0);
    return texture2D(uLUT, vec2((f * ${(LUT_SIZE - 1).toFixed(1)} + 0.5) / ${LUT_SIZE.toFixed(1)}, 0.5)).rgb;
  }
`;

// The same colour on the CPU, cached per 50 K (linear sRGB, brightest channel 1).
const BB = new Map();
export function blackbody(T) {
  const k = Math.round(Math.max(500, Math.min(200000, T)) / 50);
  let c = BB.get(k);
  if (!c) { c = blackbodyRGB(k * 50); BB.set(k, c); }
  return c;
}

// The caption orange (#f08a2c) in linear light, for shaders.
export const ORANGE = new THREE.Color('#f08a2c');

// Budgets per tier (final.md 16.3). ratio and floor: the pixel ratio cap and the lowest the step-down goes. points:
// points a frame; web: the far web; impostors: near traffic galaxies; tile: atlas tile px; giantStars: stars per
// giant; dust and trail: speed dust motes and wingtip trail samples; sparks: the spark pool; calls and callCap: draw
// call target and cap; tris; texMB: GPU texture memory; spritePx: the biggest point sprite.
export const TIERS = Object.freeze({
  high: Object.freeze({ ratio: 2, floor: 1.25, points: 120000, web: 40000, impostors: 400, tile: 512,
    giantStars: 8000, dust: 360, trail: 72, sparks: 384, calls: 60, callCap: 80, tris: 200000, texMB: 96,
    spritePx: 32 }),
  mid: Object.freeze({ ratio: 1.5, floor: 1, points: 50000, web: 16000, impostors: 300, tile: 256,
    giantStars: 4000, dust: 240, trail: 48, sparks: 256, calls: 45, callCap: 60, tris: 60000, texMB: 48,
    spritePx: 24 }),
  low: Object.freeze({ ratio: 1, floor: 0.75, points: 25000, web: 8000, impostors: 150, tile: 256,
    giantStars: 2000, dust: 140, trail: 24, sparks: 128, calls: 30, callCap: 40, tris: 30000, texMB: 24,
    spritePx: 16 }),
});
export const TIER_NAMES = Object.freeze(['high', 'mid', 'low']);

const ADAPT_WINDOW = 3000;     // ms of frames per step-down decision
const ADAPT_P95 = 20;          // ms: a 95th-percentile frame over this steps down
const RATIO_STEP = 0.25;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ---------- the generators (core/gen), in a worker when one starts, else on the main thread ----------

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

// run(fn, opts) → Promise of the generator's result. fn is a name in GEN.
export function createGenerator({ worker: useWorker = true } = {}) {
  let worker = null, failed = !useWorker, next = 1;
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
    if (!GEN[fn]) return Promise.reject(new Error(`no generator ${fn}`));
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

// ---------- byte counts (own accounting, as v1's view.js) ----------

// Bytes a texture holds on the GPU: width × height × faces × bytes per texel, + 1/3 with mipmaps.
export function textureBytes(tex) {
  if (!tex) return 0;
  if (tex.userData && Number.isFinite(tex.userData.bytes)) return tex.userData.bytes;
  const img = tex.image || {};
  const faces = tex.isCubeTexture || Array.isArray(img) ? 6 : 1;
  const w = (Array.isArray(img) ? img[0]?.width : img.width) || tex.width || 0;
  const h = (Array.isArray(img) ? img[0]?.height : img.height) || tex.height || 0;
  const per = tex.type === THREE.FloatType ? 16 : tex.type === THREE.HalfFloatType ? 8 : 4;
  const mips = tex.generateMipmaps && tex.minFilter !== THREE.LinearFilter && tex.minFilter !== THREE.NearestFilter;
  return Math.round(w * h * faces * per * (mips ? 4 / 3 : 1));
}

function geometryBytes(geo, seen) {
  let n = 0;
  if (!geo || seen.has(geo.uuid)) return 0;
  seen.add(geo.uuid);
  for (const a of Object.values(geo.attributes || {})) {
    const arr = a.array || a.data?.array;
    if (arr && !seen.has(arr)) { seen.add(arr); n += arr.byteLength; }
  }
  if (geo.index?.array) n += geo.index.array.byteLength;
  return n;
}

function softwareName(name) {
  return /swiftshader|llvmpipe|softpipe|basic render|software/i.test(String(name));
}

// ---------- the stage ----------

/**
 * createStage({ canvas, tier, onLost, onRestored, antialias, worker }) → stage.
 * stage.scenes.backdrop and stage.scenes.zone with stage.cameras.backdrop and stage.cameras.zone are the two passes;
 * draw() renders them in that order (or the passes given). Modules add their objects to stage.scenes.zone.
 */
export function createStage({ canvas, tier = 'mid', onLost = null, onRestored = null, antialias = false,
  worker = true } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  renderer.info.autoReset = false;
  const gl = renderer.getContext();
  let gpu = 'unknown';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch { /* some browsers hide it */ }
  const backend = softwareName(gpu) ? 'software' : 'hardware';
  if (canvas?.dataset) canvas.dataset.backend = backend;

  const q = {
    tier: TIERS[tier] ? tier : 'mid', dpr: 1, ratio: 1, pointTier: 'mid', impostorTier: 'mid', steps: [],
    frames: [], winT: 0, last: 0, auto: true,
  };
  q.pointTier = q.impostorTier = q.tier;

  const lut = createLut();
  const rel = createRelativity(lut);          // far things: the backdrop (boost hint, the jump)
  const relNear = createRelativity(lut);      // zone things: always at rest (φ = 0)
  const textures = new Map();                  // uuid → texture we count
  const scenes = { backdrop: new THREE.Scene(), zone: new THREE.Scene() };
  scenes.backdrop.name = 'backdrop';
  scenes.zone.name = 'zone';
  const cameras = {
    backdrop: new THREE.PerspectiveCamera(60, 1, 1e-3, 1e5),
    zone: new THREE.PerspectiveCamera(60, 1, 0.05, 4000),
  };
  const pass = { backdrop: { scene: scenes.backdrop, camera: cameras.backdrop },
    zone: { scene: scenes.zone, camera: cameras.zone } };
  const gen = createGenerator({ worker });
  const st = { w: 1, h: 1, lost: false, disposed: false, last: { calls: 0, points: 0, triangles: 0, lines: 0 },
    lostCbs: [], restoredCbs: [], budgetCbs: [], maxSlice: 0, fps: 0, p95: 0 };
  const cache = new Map();                      // shared baked things (the traffic atlas), keyed by name

  // ---------- budgets ----------

  let budget = null;
  function makeBudget() {
    const t = TIERS[q.tier], p = TIERS[q.pointTier], m = TIERS[q.impostorTier];
    budget = Object.freeze({ ...t, tier: q.tier, ratio: q.ratio, points: p.points, web: p.web,
      giantStars: p.giantStars, impostors: m.impostors, version: (budget?.version || 0) + 1 });
    for (const cb of st.budgetCbs) { try { cb(budget); } catch (err) { console.warn('stage: budget hook', err); } }
    return budget;
  }

  // The device's ratio up to the tier's cap (the floor only limits the step-down).
  function ratioFor(t) { return Math.min(q.dpr, TIERS[t].ratio); }

  function resize(w, h, dpr = q.dpr) {
    st.w = Math.max(1, Math.round(w));
    st.h = Math.max(1, Math.round(h));
    const d = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    if (d !== q.dpr) { q.dpr = d; q.ratio = ratioFor(q.tier); }
    renderer.setPixelRatio(q.ratio);
    renderer.setSize(st.w, st.h, false);
    for (const c of Object.values(cameras)) { c.aspect = st.w / st.h; c.updateProjectionMatrix(); }
    rel.uRatio.value = relNear.uRatio.value = q.ratio;
    makeBudget();
  }

  function setTier(t) {
    if (!TIERS[t]) return false;
    q.tier = q.pointTier = q.impostorTier = t;
    q.ratio = ratioFor(t);
    q.steps = [];
    q.frames = [];
    q.winT = 0;
    resize(st.w, st.h, q.dpr);
    return true;
  }

  // Lower the pixel ratio by 0.25 to the floor, then the point budget, then the impostors (16.3). Never up.
  function stepDown() {
    const i = TIER_NAMES.indexOf(q.pointTier), j = TIER_NAMES.indexOf(q.impostorTier);
    const floor = TIERS[q.tier].floor;
    if (q.ratio - RATIO_STEP >= floor - 1e-6) {
      q.ratio = Math.max(floor, q.ratio - RATIO_STEP);
      q.steps.push('ratio');
      resize(st.w, st.h, q.dpr);
    } else if (i < TIER_NAMES.length - 1) {
      q.pointTier = TIER_NAMES[i + 1];
      q.steps.push('points');
      makeBudget();
    } else if (j < TIER_NAMES.length - 1) {
      q.impostorTier = TIER_NAMES[j + 1];
      q.steps.push('impostors');
      makeBudget();
    } else return false;
    return true;
  }

  // Frame times: the 95th percentile over 3 s; a slow window steps down once.
  function frameTime(ms) {
    if (!(ms > 0) || ms > 250) return false;
    q.frames.push(ms);
    q.winT += ms;
    if (q.winT < ADAPT_WINDOW) return false;
    const sorted = q.frames.slice().sort((a, b) => a - b);
    st.p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    st.fps = 1000 * sorted.length / q.winT;
    q.frames.length = 0;
    q.winT = 0;
    return q.auto && st.p95 > ADAPT_P95 ? stepDown() : false;
  }

  // ---------- the bake slicer ----------

  // slice(budgetMs, job) runs job a piece at a time in frames, at most budgetMs a frame, and resolves with its
  // result. job: a function that returns true (or a non-false value) when done; an iterator (done when it ends); or
  // { step() } returning true when done.
  const jobs = [];
  let pumpTimer = null, lastDraw = 0;
  function slice(budgetMs, job) {
    return new Promise((resolve, reject) => {
      jobs.push({ budget: Math.max(1, budgetMs || 6), job, resolve, reject });
      kick();
    });
  }
  function stepJob(j) {
    const job = j.job;
    if (typeof job === 'function') { const r = job(); return r === false || r === undefined ? null : { v: r }; }
    if (job && typeof job.next === 'function') { const r = job.next(); return r.done ? { v: r.value } : null; }
    if (job && typeof job.step === 'function') { const r = job.step(); return r ? { v: r } : null; }
    return { v: undefined };
  }
  function pump(budgetMs = null) {
    if (st.lost || st.disposed) return;
    const t0 = now();
    while (jobs.length) {
      const j = jobs[0];
      const limit = budgetMs ?? j.budget;
      const t1 = now();
      let out;
      try { out = stepJob(j); } catch (err) { jobs.shift(); j.reject(err); continue; }
      st.maxSlice = Math.max(st.maxSlice, now() - t1);
      if (out) { jobs.shift(); j.resolve(out.v); }
      if (now() - t0 >= limit) break;
    }
  }
  // Without a draw loop (the title before PLAY, a hidden tab), pump on a timer.
  function kick() {
    if (pumpTimer || !jobs.length) return;
    pumpTimer = setTimeout(() => {
      pumpTimer = null;
      if (now() - lastDraw > 100) pump();
      kick();
    }, 16);
  }

  // ---------- drawing ----------

  function pxPerRad(camera) {
    return (st.h / 2) / Math.tan((camera.fov * Math.PI / 180) / 2) / (camera.zoom || 1);
  }

  /**
   * draw(view): view.passes (default [backdrop, zone]) drawn in order, the depth cleared between them. Each pass is
   * { scene, camera }. Counts draw calls, points and triangles for info().
   */
  function draw(view = null) {
    if (st.lost || st.disposed) return;
    const t = now();
    if (lastDraw) frameTime(t - lastDraw);
    lastDraw = t;
    pump();
    const passes = view?.passes || [pass.backdrop, pass.zone];
    renderer.info.reset();
    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    let first = true;
    for (const p of passes) {
      if (!p || !p.scene || !p.camera) continue;
      if (!first) renderer.clearDepth();
      first = false;
      const f = pxPerRad(p.camera);
      if (p.camera === cameras.backdrop || p.far) rel.uPxPerRad.value = f;
      else relNear.uPxPerRad.value = f;
      renderer.render(p.scene, p.camera);
    }
    const r = renderer.info.render;
    st.last = { calls: r.calls, points: r.points, triangles: r.triangles, lines: r.lines };
  }

  // Compile every material of a scene before it shows (final.md 16.4). Resolves when done or failed.
  function compile(scene, camera = cameras.zone) {
    try {
      if (typeof renderer.compileAsync === 'function') {
        return renderer.compileAsync(scene, camera).catch((err) => console.warn('stage: compile', err));
      }
      renderer.compile(scene, camera);
    } catch (err) { console.warn('stage: compile', err); }
    return Promise.resolve();
  }

  // ---------- accounting ----------

  const track = (tex) => { if (tex && tex.isTexture) textures.set(tex.uuid, tex); return tex; };
  const untrack = (tex) => { if (tex) textures.delete(tex.uuid); };
  track(lut);

  function bytes() {
    let tex = 0, buf = 0;
    for (const t of textures.values()) tex += textureBytes(t);
    const seen = new Set();
    for (const s of Object.values(scenes)) s.traverse((o) => { buf += geometryBytes(o.geometry, seen); });
    return { textures: tex, buffers: buf, total: tex + buf };
  }

  function info() {
    const b = bytes();
    const m = renderer.info.memory;
    return {
      tier: q.tier, ratio: q.ratio, pixelRatio: q.ratio, pointTier: q.pointTier, impostorTier: q.impostorTier,
      steps: [...q.steps], calls: st.last.calls, drawCalls: st.last.calls, points: st.last.points,
      triangles: st.last.triangles, lines: st.last.lines, textureBytes: b.textures, bufferBytes: b.buffers,
      bytes: b.total, memory: { geometries: m.geometries, textures: m.textures }, backend, gpu,
      worker: gen.usesWorker, pending: jobs.length, maxSliceMs: st.maxSlice, fps: st.fps, p95: st.p95,
      budget,
    };
  }

  // ---------- lost context ----------

  function lost(e) {
    e.preventDefault();
    st.lost = true;
    onLost?.();
    for (const cb of st.lostCbs) { try { cb(); } catch { /* keep going */ } }
  }
  function restored() {
    st.lost = false;
    const drop = (tex) => { untrack(tex); tex?.userData?.rt?.dispose?.(); };
    for (const v of cache.values()) Promise.resolve(v).then(drop).catch(() => {});
    cache.clear();                       // render targets lost their pixels: bakes are made again on demand
    onRestored?.();
    for (const cb of st.restoredCbs) { try { cb(); } catch { /* keep going */ } }
  }
  canvas?.addEventListener?.('webglcontextlost', lost, false);
  canvas?.addEventListener?.('webglcontextrestored', restored, false);

  function dispose() {
    st.disposed = true;
    canvas?.removeEventListener?.('webglcontextlost', lost);
    canvas?.removeEventListener?.('webglcontextrestored', restored);
    clearTimeout(pumpTimer);
    gen.dispose();
    for (const s of Object.values(scenes)) s.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => m.dispose());
    });
    for (const t of textures.values()) t.dispose();
    renderer.dispose();
  }

  const stage = {
    renderer, scenes, cameras, pass, rel, relNear, lut, gen, cache, TIERS,
    resize, draw, slice, pump, compile, bytes, info, stepDown, setTier, frameTime, track, untrack, dispose,
    get tier() { return q.tier; },
    get ratio() { return q.ratio; },
    get budget() { return budget || makeBudget(); },
    get size() { return { w: st.w, h: st.h }; },
    get lost() { return st.lost; },
    get backend() { return backend; },
    get autoStep() { return q.auto; },
    set autoStep(v) { q.auto = !!v; },
    // Called with the new budget whenever it changes (a resize, a tier, a step down).
    onBudget(cb) { st.budgetCbs.push(cb); return () => st.budgetCbs.splice(st.budgetCbs.indexOf(cb), 1); },
    onLost(cb) { st.lostCbs.push(cb); return () => st.lostCbs.splice(st.lostCbs.indexOf(cb), 1); },
    onRestored(cb) { st.restoredCbs.push(cb); return () => st.restoredCbs.splice(st.restoredCbs.indexOf(cb), 1); },
    // CSS px per radian at the centre of a camera's view (points.js's uPxPerRad).
    pxPerRad,
  };
  q.dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
  q.ratio = ratioFor(q.tier);
  resize(canvas?.clientWidth || canvas?.width || 1, canvas?.clientHeight || canvas?.height || 1, q.dpr);
  return stage;
}
