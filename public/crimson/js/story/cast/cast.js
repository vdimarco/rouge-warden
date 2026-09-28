// js/story/cast/cast.js : S.cast, the people of the story (CAST). It loads the bodies (the wild crew GLBs,
// Christian and Ryu, the arena actors, and the code-built bodies of bodygen.js), gives each body the whole
// clip library, and animates every actor on story time:
// - clips: 'ronin:*', 'gabe:*' and 'bear:*' are the arena actors' clips retargeted (retarget.js), with the
//   move-table cuts; 'lib:*' are the procedural clips (poses.js); 'idle', 'walk', 'run', 'dead', 'hit' are
//   aliases. Libraries are built lazily per skeleton and shared by every clone.
// - spawn() returns an actor at once: a capsule placeholder with the same clip names and durations (D2)
//   until the body is loaded, then the body swaps into the same actor (its root, props and clip keep).
// - locomotion is procedural (locomotion.js): actor.move(speed, {turn, crouch, upper}) lays a stride over
//   whatever clip plays; 'lib:walk' and friends are the same stride baked at one speed.
// - the arena actors (ronin, gabe, bear) are registered by the director. In the story they get the same
//   library and move(); on 'exit' everything is put back, so FIGHT GABE plays exactly as before (B9).
import * as THREE from 'three';
import { spawnActor, loadTemplate } from '../../actors.js';
import { clone as cloneSkinned } from '../../../lib/addons/utils/SkeletonUtils.js';
import { CAST_IDS, CREW_IDS, BODY_URL, DONOR_RIG, CORE_CAST } from '../types.js';
import { RONIN_CUTS, GABE_CUTS, BEAR_CUTS } from '../../moves.js';
import { rigOf, findSkinned, BONES, missingBones } from './rig.js';
import { retargetClip, clipFinite, hipsDrift } from './retarget.js';
import { libClip, LIB_NAMES, LIB_DURATIONS, POSE_CLIPS, definePose } from './poses.js';
import { drive, locoState } from './locomotion.js';
import { buildBody, BUILT_IDS, variantsOf, BODIES } from './bodygen.js';
import { createProps, KASA_BACK } from './props.js';
import { createTalk } from './talk.js';
import { vortexParts } from './vortex.js';
import { createLod, padBounds } from './lod.js';
import { createCrowd, createFollowers } from './crowd.js';
import { glowTex } from '../../fx.js';
import { LITE } from '../../render.js';
import { NEON } from '../look/palette.js';

const FPS = 30;
const GABE_STORY_SCALE = 1.95 / 2.28; // the arena Gabe stands 2.28 m; in the story he is about 1.95 m (B9)
const CREW_HEIGHT = 1.8;
const SETS = Object.freeze({ ronin: RONIN_CUTS, gabe: GABE_CUTS, bear: BEAR_CUTS });
const ALIASES = Object.freeze({ idle: 'lib:idle', walk: 'lib:walk', run: 'lib:run', dead: 'lib:knocked', hit: 'gabe:hit' });
// D3: the crew wear the costume from Ronin Night Out (F3, Friday night: "Costumes stay on till Sunday.
// House rules.") to the fight on Sunday at 3 AM: F3, F4, F5, the cold open and the interludes under the
// bridge (all the same Sunday night). F1 and F2 (Thursday, Friday morning) and the present are day clothes.
// Each body wears one hat: the kasa is worn on the nights out (F3, F5) and folds the body's own cap away
// under it; the morning after (F4) and after the fight (C0 once the ronin lifts it, I0 to I5) it hangs on
// the back and the cap shows (props.js KASA_BACK).
export const COSTUME_CHAPTERS = Object.freeze(['c0', 'i0', 'i1', 'i2', 'f3', 'i3', 'f4', 'i4', 'f5', 'i5']);
// H1: rigged GLBs for Vance, Voss, Rattler and the gang (BODY_URL). Boone is the gang GLB scaled about 1.12
// with a darker tint; the gang variants are the gang GLB with tints. A GLB that fails to load falls back to
// the code-built body of bodygen.js.
const GLB_OF = (id) => BODY_URL[id] || (id === 'boone' ? BODY_URL.gang : null);
const GLB_HEIGHT = { vance: 1.70, voss: 1.83, rattler: 1.78, gang: 1.85, boone: 1.85 * 1.12 };
const GLB_TINT = { boone: [0x8c8680], gang: [0xffffff, 0xd8d2cc, 0xc4ccd4, 0xb0a89e] };
const TINT = { tanktop: 0xb8b2aa, fifty: 0xc8c2b8, shades: 0x6e6a66, newbalance: 0xa09a92, redjersey: 0x8a3a38, gabe: 0x5a4a3a, vance: 0x2c3a52, voss: 0xd8d0c0, rattler: 0x4a5a70, boone: 0x3a3a3a, gang: 0x2a2a2c, civA: 0x9a8a7a, civB: 0x7a8a9a, christian: 0xa8a098, ryu: 0x989088, ronin: 0x888888, bear: 0x3a3028 };

/* ------------------------------------------------------------------ the drain and ink-shadow shader patch */
// After map_fragment: texels that pass the neon test (render.js neonOf) go to a warm grey by uDrain; uInk
// takes the whole body to black ink (the vortex forms). Both at 0 give the material's own colour exactly.
const PATCH = `#include <map_fragment>
  {
    vec3 dc = pow(max(diffuseColor.rgb, 0.), vec3(1. / 2.2));
    float mx = max(dc.r, max(dc.g, dc.b)), mn = min(dc.r, min(dc.g, dc.b)), sat = (mx - mn) / (mx + 0.02);
    float hue = smoothstep(0.7, 1.02, dc.g / (dc.r + 0.03)) * smoothstep(0.08, 0.4, dc.g - dc.b);
    float nn = clamp(hue * smoothstep(0.25, 0.6, sat) * smoothstep(0.12, 0.4, dc.g), 0., 1.);
    float L = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(L) * vec3(0.95, 0.9, 0.84), uCastDrain * nn);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.011, 0.012), uCastInk);
  }`;
function patchOf(m) {
  if (m.userData.castFx) return m.userData.castFx;
  const u = { uCastDrain: { value: 0 }, uCastInk: { value: 0 } };
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey, hadOwn = Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile'), hadOwnKey = Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey');
  const fx = { u, prev, prevKey, hadOwn, hadOwnKey };
  m.onBeforeCompile = function (s, r) {
    if (prev) prev.call(this, s, r);
    s.uniforms.uCastDrain = u.uCastDrain; s.uniforms.uCastInk = u.uCastInk;
    s.fragmentShader = 'uniform float uCastDrain;\nuniform float uCastInk;\n' + s.fragmentShader.replace('#include <map_fragment>', PATCH);
  };
  m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|castfx'; };
  m.needsUpdate = true;
  m.userData.castFx = fx;
  return fx;
}
function unpatch(m) {
  const fx = m.userData.castFx; if (!fx) return;
  if (fx.hadOwn) m.onBeforeCompile = fx.prev; else delete m.onBeforeCompile;
  if (fx.hadOwnKey) m.customProgramCacheKey = fx.prevKey; else delete m.customProgramCacheKey;
  delete m.userData.castFx; m.needsUpdate = true;
}
// the body's own toon materials (not props, shells or hulls)
function bodyMats(a) {
  const out = [];
  const root = a.model || a.root;
  root.traverse((o) => { if (o.isMesh && !o.userData.hull && !o.userData.shell && o.material && o.material.isMeshToonMaterial && !o.material.userData.shared && !(o.name || '').startsWith('prop:')) out.push(o.material); });
  return out;
}

/* ------------------------------------------------------------------ the placeholder */
class Capsule {
  constructor(color) {
    const mat = new THREE.MeshToonMaterial({ color });
    this.mesh = new THREE.Group(); this.mesh.name = 'capsule';
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 1.2, 4, 10), mat); body.position.y = 0.88;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), mat); nose.position.set(0, 1.55, 0.26);
    body.castShadow = nose.castShadow = true;
    this.mesh.add(body, nose);
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
}

/* ------------------------------------------------------------------ an actor of the story */
// Wraps a body (an actors.js Actor) so the body can arrive later. Same API as the arena Actor.
class Figure {
  constructor(cast, id, o) {
    this.cast = cast; this.id = id; this.key = o.key; this.kind = o.crowd ? 'crowd' : 'story';
    this.root = new THREE.Group(); this.root.name = `cast:${id}`;
    this.body = null; this.ph = null;
    if (!o.ready) { this.ph = new Capsule(o.tint ?? TINT[id] ?? 0x888888); this.root.add(this.ph.mesh); }
    this.st = { cur: 'idle', loop: true, speed: 1, time: 0 };
    this.extraClips = {}; this.extraCuts = []; this.useCdt = false; this.props = {}; this.attached = [];
    this.tint = o.tint; this.glowK = null; this.drainK = 0; this.inkK = 0;
    locoState(this);
    this.clips = cast.durations(); // names and durations only, until the body arrives (D2)
  }
  get model() { return this.body ? this.body.model : this.ph ? this.ph.mesh : this.root; }
  get cur() { return this.body ? this.body.cur : this.st.cur; }
  get t() { return this.body ? this.body.t : this.st.time; }
  get done() {
    if (this.body) return this.body.done;
    const c = this.clips[this.st.cur], d = c ? c.duration : 0;
    return !this.st.loop && this.st.time >= d - 1e-3;
  }
  get bones() { return this.body ? this.body.bones : {}; }
  play(name, o = {}) {
    const { loop = true, speed = 1, at = 0, restart = false } = o;
    if (!(name in this.clips)) { console.warn('no clip', name); return null; }
    const same = this.st.cur === name && !restart;
    this.st.cur = name; this.st.loop = loop; this.st.speed = speed; if (!same) this.st.time = at;
    return this.body ? this.body.play(name, o) : this;
  }
  update(dt) {
    if (this.body) { this.body.update(dt); return; }
    const c = this.clips[this.st.cur], d = c ? c.duration : 1;
    this.st.time += dt * this.st.speed;
    this.st.time = this.st.loop ? this.st.time % d : Math.min(this.st.time, d);
  }
  bone(n) { return this.body ? this.body.bone(n) : undefined; }
  setGlow(k) { this.glowK = k; if (this.body) this.body.setGlow(k); }
  get glowMats() { return this.body ? this.body.glowMats : []; }
  set visible(v) { this.root.visible = v; }
  get visible() { return this.root.visible; }
  addClip(name, clip) { this.extraClips[name] = clip; if (this.body) this.body.addClip(name, clip); else this.clips[name] = { name, duration: clip.duration }; }
  addCuts(cuts) {
    this.extraCuts.push(cuts);
    if (this.body) this.body.addCuts(cuts);
    else for (const [name, [src, a, b]] of Object.entries(cuts)) { const s = this.clips[src]; if (s) this.clips[name] = { name, duration: cutDuration(s.duration, a, b) }; }
  }
  move(speed, o = {}) { const L = this.loco; L.speed = Math.max(0, speed || 0); L.turn = o.turn || 0; L.crouch = o.crouch || 0; L.upper = o.upper !== false; }
  // the real body arrives: same root, same clip and time, props moved over
  swap(tpl, lib, info) {
    const body = spawnActor(tpl, { parent: this.root, outline: 0.02, glow: info.glow, scale: info.scale });
    body.clips = Object.assign(Object.create(lib), this.extraClips);
    body.rig = info.rig; body.loco = this.loco; body.driver = driver;
    for (const c of this.extraCuts) body.addCuts(c);
    padBounds(body);
    const tint = this.tint ?? info.tint;
    if (tint != null) for (const m of bodyMats(body)) m.color.setHex(tint);
    if (this.ph) { this.ph.dispose(); this.ph = null; }
    this.body = body; this.clips = body.clips;
    body.play(this.st.cur in body.clips ? this.st.cur : 'idle', { fade: 0, loop: this.st.loop, speed: this.st.speed, at: this.st.time });
    body.update(0);
    if (this.glowK != null) body.setGlow(this.glowK);
    const re = this.attached.slice(); this.attached.length = 0;
    for (const [name, bone, o] of re) { this.cast.props.detach(this, name); this.cast.props.attach(this, name, bone, o); }
    if (this.drainK) this.cast.drain(this, this.drainK);
    if (this.inkK) this.cast.inkShadow(this, this.inkK);
    this.lodHidden = false; this.hullOn = undefined; this.hulls = body.hulls; this.heavy = (info.tris || 0) >= 8000;
  }
  dispose() {
    for (const n of Object.keys(this.props)) this.cast.props.detach(this, n);
    if (this.vortex) for (const v of Object.values(this.vortex)) v.remove();
    // the full meshes back before the body frees its geometry: the coarse copy (lod.js) shares the vertex
    // buffers of every clone of this GLB, and freeing it made them all upload again
    if (this.coarseOn && this.body) { this.body.root.traverse((o) => { if (o.userData.fullGeo) o.geometry = o.userData.fullGeo; }); this.coarseOn = false; }
    if (this.body) this.body.dispose(); else if (this.ph) this.ph.dispose();
    this.root.removeFromParent();
    this.disposed = true;
  }
}
const BODY_BONES = BONES.filter((n) => !/(Arm|ForeArm|Hand)$/.test(n));
const cutDuration = (dur, a, b) => (Math.round(Math.min(b, dur) * FPS) - Math.round(a * FPS)) / FPS;
function driver(a, dt) { drive(a, a.rig, dt); }

/* ------------------------------------------------------------------ init */
export function init(S) {
  const reg = new Map(), live = new Set();
  const tpls = new Map(); // template key -> {state: 'loading'|'ready'|'failed', t, rig, glow, scale}
  let donor = null; // {state, t}
  const glbs = new Map(); // H1 GLB url -> {state, t, wait}
  let variantSeq = {};
  const libs = new Map(); // rig key -> clip library (prototype object)
  let dur = null;
  const prepared = new Map(); // arena actor -> what to put back on exit
  const lod = createLod(S);
  const props = createProps();

  /* ---------- sources: the arena actors' clips ---------- */
  const srcCache = {};
  function source(set) {
    if (srcCache[set]) return srcCache[set];
    const a = reg.get(set); if (!a) return null;
    const whole = {}; for (const c of a.sources || []) whole[c.name] = c;
    if (!Object.keys(whole).length) for (const [n, c] of Object.entries(a.clips)) if (!SETS[set][n]) whole[n] = c;
    return (srcCache[set] = { a, rig: rigOf(a.model), whole, cuts: SETS[set] });
  }
  // every clip name with its duration (the placeholder's table, D2)
  function durations() {
    if (dur) return Object.create(dur);
    const d = {};
    for (const set of Object.keys(SETS)) {
      const s = source(set); if (!s) continue;
      for (const [n, c] of Object.entries(s.whole)) d[`${set}:${n}`] = { name: `${set}:${n}`, duration: c.duration };
      for (const [n, [src, a, b]] of Object.entries(s.cuts)) if (s.whole[src]) d[`${set}:${n}`] = { name: `${set}:${n}`, duration: sub(s.whole[src], `${set}:${n}`, a, b).duration };
    }
    for (const [n, t] of Object.entries(LIB_DURATIONS)) d[n] = { name: n, duration: t };
    for (const [n, to] of Object.entries(ALIASES)) if (d[to]) d[n] = { name: n, duration: d[to].duration };
    if (reg.size) dur = d; // final once the arena actors are in
    return Object.create(d);
  }
  const subCache = new WeakMap();
  const sub = (clip, name, a, b) => {
    let m = subCache.get(clip); if (!m) subCache.set(clip, (m = new Map()));
    let c = m.get(name); if (!c) { c = THREE.AnimationUtils.subclip(clip, name, Math.round(a * FPS), Math.round(Math.min(b, clip.duration) * FPS), FPS); m.set(name, c); }
    return c;
  };
  // the clip library of one skeleton: lazy getters, so a clip is retargeted the first time it plays
  function library(rig) {
    let L = libs.get(rig.key);
    if (L) return L;
    L = {};
    const def = (name, fn) => Object.defineProperty(L, name, {
      enumerable: true, configurable: true,
      get() { const c = fn(); Object.defineProperty(L, name, { value: c, enumerable: true, configurable: true, writable: true }); return c; },
    });
    for (const set of Object.keys(SETS)) {
      const s = source(set); if (!s) continue;
      for (const [n, c] of Object.entries(s.whole)) def(`${set}:${n}`, () => retargetClip(c, s.rig, rig, `${set}:${n}`));
      for (const [n, [src, a, b]] of Object.entries(s.cuts)) if (s.whole[src]) def(`${set}:${n}`, () => sub(retargetClip(s.whole[src], s.rig, rig, `${set}:${src}`), `${set}:${n}`, a, b));
    }
    for (const n of LIB_NAMES) def(`lib:${n}`, () => libClip(rig, n));
    L.def = def; Object.defineProperty(L, 'def', { enumerable: false });
    L.rig = rig; Object.defineProperty(L, 'rig', { enumerable: false });
    for (const [n, to] of Object.entries(ALIASES)) def(n, () => L[to]);
    libs.set(rig.key, L);
    return L;
  }

  /* ---------- templates ---------- */
  const isBuilt = (id) => BUILT_IDS.includes(id);
  const keyOf = (id, variant = 0) => (isBuilt(id) ? `${id}:${((variant % variantsOf(id)) + variantsOf(id)) % variantsOf(id)}` : id);
  function loadDonor() {
    if (donor) return donor;
    donor = { state: 'loading', t: null };
    loadTemplate(DONOR_RIG).then((t) => { donor.t = t; donor.state = 'ready'; }, (e) => { console.warn('[cast] donor rig failed', e); donor.state = 'failed'; });
    return donor;
  }
  function request(id, variant = 0) {
    const key = keyOf(id, variant);
    let e = tpls.get(key);
    if (e) return e;
    e = { key, id, state: 'loading', t: null };
    tpls.set(key, e);
    const glb = GLB_OF(id);
    if (glb && isBuilt(id)) { // H1: the GLB first, the code-built body if it fails
      e.variant = variant;
      const g = glbs.get(glb) || { state: 'loading', t: null, wait: [] };
      if (!glbs.has(glb)) {
        glbs.set(glb, g);
        loadTemplate(glb).then((t) => { g.t = t; g.state = 'ready'; for (const f of g.wait) f(); }, (err) => { console.warn(`[cast] ${glb} failed to load; building the bodies in code`, err); g.state = 'failed'; for (const f of g.wait) f(); });
      }
      // one load per GLB, shared by every variant and by Boone
      const take = () => { if (g.state === 'ready') { e.t = g.t; e.glb = true; e.state = 'ready'; } else { loadDonor(); e.state = 'build'; } };
      if (g.state === 'loading') g.wait.push(take); else take();
    } else if (isBuilt(id)) { loadDonor(); e.state = 'build'; e.variant = variant; }
    else if (glb) loadTemplate(glb).then((t) => { e.t = t; e.state = 'ready'; }, (err) => { console.warn(`[cast] ${id} failed to load; keeping the placeholder`, err); e.state = 'failed'; });
    else e.state = 'failed';
    return e;
  }
  // finish a template: build a code body once the donor is in; measure it; set its scale and glow
  function settle(e) {
    if (e.state === 'build') {
      if (!donor || donor.state === 'loading') return false;
      if (donor.state === 'failed') { e.state = 'failed'; return false; }
      e.t = buildBody(donor.t, e.id, e.variant); e.state = 'ready';
    }
    if (e.state !== 'ready') return false;
    if (!e.rig) {
      const mesh = findSkinned(e.t.scene);
      e.rig = rigOf(mesh);
      const ud = e.t.scene.userData || {};
      const h = ud.bodyHeight ? ud.bodyHeight : e.rig.height * 0.01;
      e.scale = (ud.height || (e.glb && GLB_HEIGHT[e.id]) || CREW_HEIGHT) / h;
      if (e.glb && GLB_TINT[e.id]) { const l = GLB_TINT[e.id]; e.tint = l[(e.variant || 0) % l.length]; }
      e.glow = ud.glow || (e.glb && BODIES[e.id] ? BODIES[e.id][0].glow : 0);
      e.tris = mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3;
      e.lib = library(e.rig);
    }
    return true;
  }
  const readyKey = (key) => { const e = tpls.get(key); return !!e && settle(e); };

  /* ---------- the arena actors in the story ---------- */
  function prepare(a) {
    if (prepared.has(a)) return;
    const rest = {}; for (const [n, b] of Object.entries(a.bones || {})) rest[n] = [b.position.clone(), b.quaternion.clone(), b.scale.clone()];
    prepared.set(a, { rest, proto: Object.getPrototypeOf(a.clips), scale: a.root.scale.clone(), parent: a.root.parent });
    a.rig = rigOf(a.model);
    Object.setPrototypeOf(a.clips, library(a.rig));
    locoState(a);
    a.driver = driver;
    a.move = Figure.prototype.move;
  }
  function unprepare(a) {
    const p = prepared.get(a); if (!p) return;
    for (const n of Object.keys(a.props || {})) props.detach(a, n);
    if (a.vortex) for (const v of Object.values(a.vortex)) v.remove();
    for (const m of bodyMats(a)) unpatch(m);
    if (a.inkEyes) { a.inkEyes.forEach((s) => { s.removeFromParent(); s.material.dispose(); }); a.inkEyes = null; }
    a.driver = null; delete a.move; delete a.loco; delete a.rig; delete a.useCdt; delete a.drainK; delete a.inkK;
    Object.setPrototypeOf(a.clips, p.proto);
    // stop every story action; the arena starts its own clips again (makePlayer / makeBoss)
    for (const act of a.weights.keys()) act.stop();
    a.weights.clear(); a.action = null; a.cur = '';
    for (const [n, [pos, q, s]] of Object.entries(p.rest)) { const b = a.bones[n]; b.position.copy(pos); b.quaternion.copy(q); b.scale.copy(s); }
    lod.restore(a);
    prepared.delete(a);
  }

  /* ---------- the API ---------- */
  const place = (a, o) => {
    if (o.pos) a.root.position.set(o.pos.x, o.pos.y ?? (S.world && S.world.surface ? S.world.surface(o.pos.x, o.pos.z) : 0), o.pos.z);
    if (o.yaw != null) a.root.rotation.y = o.yaw;
  };
  const cast = S.cast = {
    // start loading bodies; the handle is done when every one is in or has failed (a failed body keeps
    // its placeholder, so nothing ever waits on art)
    preload(ids = []) {
      const keys = [];
      for (const id of ids) {
        if (!CAST_IDS.includes(id)) { console.warn(`S.cast.preload: unknown cast id '${id}'`); continue; }
        if (reg.has(id) && !BODY_URL[id] && !isBuilt(id)) continue;
        keys.push(request(id).key);
      }
      return {
        get done() { return keys.every((k) => { const e = tpls.get(k); return settle(e) || e.state === 'failed'; }); },
        get progress() { return keys.length ? keys.filter((k) => { const e = tpls.get(k); return e.state === 'ready' || e.state === 'failed'; }).length / keys.length : 1; },
        keys,
      };
    },
    ready: (id) => reg.has(id) || readyKey(keyOf(id)),
    spawn(id, o = {}) {
      if (!CAST_IDS.includes(id)) throw new Error(`S.cast.spawn: unknown cast id '${id}'`);
      const a0 = reg.get(id);
      if (a0) { // the arena actor, at story scale unless asked (B9)
        prepare(a0);
        if (id === 'gabe') a0.root.scale.setScalar(o.arenaScale ? 1 : GABE_STORY_SCALE);
        if (o.parent) o.parent.add(a0.root);
        a0.visible = true; place(a0, o); live.add(a0); a0.kind = 'arena';
        for (const p of o.props || []) props.attach(a0, p);
        return a0;
      }
      let variant = o.variant;
      if (isBuilt(id) && variant == null) { variantSeq[id] = (variantSeq[id] || 0) + 1; variant = variantSeq[id] - 1; }
      const e = request(id, variant || 0);
      const f = new Figure(inner, id, { ...o, key: e.key, ready: settle(e) });
      f.variant = variant || 0;
      (o.parent || (S.world && S.world.group) || S.scene).add(f.root);
      place(f, o);
      f.noLod = o.lod === false;
      live.add(f);
      if (settle(e)) f.swap(e.t, e.lib, e);
      for (const p of o.props || []) cast.props.attach(f, p);
      if (CREW_IDS.includes(id) && (o.costume ?? inCostume())) { cast.costume(f, true); f.autoCostume = o.costume == null; }
      f.play('idle', { fade: 0 });
      return f;
    },
    get: (id) => reg.get(id) || [...live].find((a) => a.id === id) || null,
    despawn(a) {
      if (!a) return;
      live.delete(a);
      followers.remove(a);
      if (prepared.has(a) || [...reg.values()].includes(a)) { a.visible = false; return; } // arena actors are only hidden (B9)
      talk.drop(a);
      if (a.dispose && !a.disposed) a.dispose();
    },
    register(id, actor) { reg.set(id, actor); actor.id = actor.id || id; dur = null; for (const k of Object.keys(srcCache)) delete srcCache[k]; },
    props: {
      make: (name, o) => props.make(name, o),
      attach(a, name, bone, o) { if (a instanceof Figure) { a.attached = a.attached.filter((x) => x[0] !== name); a.attached.push([name, bone, o]); } return props.attach(a, name, bone, o); },
      detach(a, name) { if (a instanceof Figure) a.attached = a.attached.filter((x) => x[0] !== name); props.detach(a, name); },
      names: props.names,
    },
    // the crew costume (D3): kasa, haori tabard, crimson sash, foam katana at the hip. kasa: 'head', 'back'
    // or false; by default where the chapter puts it (KASA_BACK). Only one kasa, never over another hat.
    costume(a, on = true, kasa = kasaMode()) {
      if (!a) return;
      const has = (n) => !!(a.props && a.props[n]);
      for (const n of props.COSTUME) if (n !== 'kasa') { if (on) { if (!has(n)) cast.props.attach(a, n); } else cast.props.detach(a, n); }
      const want = on ? kasa : false;
      if (want !== 'head') cast.props.detach(a, 'kasa');
      if (want !== 'back') cast.props.detach(a, 'kasaBack');
      if (want === 'head' && !has('kasa')) cast.props.attach(a, 'kasa');
      if (want === 'back' && !has('kasaBack')) cast.props.attach(a, 'kasaBack');
    },
    // what an actor wears of the costume now: {on, kasa: 'head' | 'back' | false} (QA)
    costumeOf(a) { const p = (a && a.props) || {}; return { on: !!p.haori || !!p.sash, kasa: p.kasa ? 'head' : p.kasaBack ? 'back' : false }; },
    // a procedural pose (poses.js). k: 1 plays it, 0 goes back to the idle. 'talk' is also a light
    // additive sway: pose(a, 'talk', k) with k < 1 lays it over the current clip at that weight.
    pose(a, name, k = 1) {
      if (!a) return;
      if (name === 'talk' && k < 1) { if (a.loco) a.loco.talk = Math.max(0, k); return; }
      const clip = POSE_CLIPS[name] || (`lib:${name}` in (a.clips || {}) ? `lib:${name}` : null);
      if (!clip) { console.warn(`S.cast.pose: no pose '${name}'`); return; }
      if (a.loco) a.loco.talk = 0;
      a.pose = k > 0 ? name : null;
      a.play(k > 0 ? clip : 'lib:idle', { fade: 0.35, loop: name !== 'knock' });
    },
    move(a, speed, o) { if (a && a.move) a.move(speed, o); },
    // Stand a body in for another at the same spot, on the same clip and time, and hide or despawn the old
    // one: the C0 cut from the arena ronin to the pick's crew body in costume (D3). o: {costume (default
    // true), parent (default the old actor's parent: the arena scene in C0)}
    replace(from, id, o = {}) {
      if (!from || !from.root) return cast.spawn(id, o);
      const to = cast.spawn(id, { parent: o.parent || from.root.parent || undefined, pos: { x: from.root.position.x, y: from.root.position.y, z: from.root.position.z }, yaw: from.root.rotation.y, ...o });
      if (o.costume !== false) cast.costume(to, true);
      const src = from.cur || '', name = src.includes(':') || !from.id ? src : `${from.id}:${src}`;
      if (name && name in to.clips) to.play(name, { fade: 0, at: from.t || 0 });
      to.useCdt = !!from.useCdt;
      cast.despawn(from);
      return to;
    },
    // neon drain (B10): texels that read as neon go grey by k, the glow and the limb glow sprites by 1-k
    drain(a, k) {
      if (!a) return;
      k = Math.max(0, Math.min(1, k)); a.drainK = k;
      for (const m of bodyMats(a)) patchOf(m).u.uCastDrain.value = k;
      const base = a === reg.get('bear') ? 0.5 : a === reg.get('gabe') ? 0.35 : (a.body && a.body.template && a.body.template.scene.userData.glow) || 0.35;
      if (a.setGlow && a.glowMats && a.glowMats.length) a.setGlow(base * (1 - k));
      for (const s of Object.values(a.limbGlow || {})) { if (s.userData.base == null) s.userData.base = s.material.opacity; s.material.opacity = s.userData.base * (1 - k); }
    },
    // the vortex form: the body goes to black ink and two neon eyes open
    inkShadow(a, k) {
      if (!a) return;
      k = Math.max(0, Math.min(1, k)); a.inkK = k;
      for (const m of bodyMats(a)) patchOf(m).u.uCastInk.value = k;
      const hf = a.bone && a.bone('headfront');
      if (hf && !a.inkEyes && k > 0) {
        a.root.updateMatrixWorld(true);
        const ws = new THREE.Vector3(); hf.getWorldScale(ws); const rs = new THREE.Vector3(); a.root.getWorldScale(rs);
        const u = rs.x / ws.x, rig = a.rig || rigOf(a.model), q = rig.worldQ.headfront.clone().invert();
        a.inkEyes = [-1, 1].map((sd) => {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: NEON.tell, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
          s.scale.setScalar(0.09 * u);
          s.position.copy(new THREE.Vector3(sd * 3.3, 5.5, 1.5).applyQuaternion(q)); // rig cm from the front of the head: at the eyes
          hf.add(s); return s;
        });
      }
      if (a.inkEyes) for (const s of a.inkEyes) s.material.opacity = k;
    },
    vortexParts: (a, kind) => vortexParts(a, kind),
    lodUpdate(camPos) {
      const list = [];
      for (const a of live) if (!a.noLod) list.push({ a, kind: a.kind || 'story' });
      return lod.update(list, camPos);
    },
    variants: (id) => variantsOf(id),
    autoCostume: true, // false: the costume only goes on when asked (costume(), spawn {costume: true})
  };
  // what a Figure needs from here
  const inner = { durations, props: cast.props, drain: (a, k) => cast.drain(a, k), inkShadow: (a, k) => cast.inkShadow(a, k) };
  const crowd = createCrowd(S, cast), followers = createFollowers(S);
  // talking mouths (talk.js): every actor that can speak, spawned or arena
  cast.all = () => { const out = [...live]; for (const a of reg.values()) if (!live.has(a)) out.push(a); return out; };
  const talk = cast.talk = createTalk(S, cast);
  cast.crowd = { update: (rdt, focus) => crowd.update(rdt, focus), scatter: (x, z, r) => crowd.scatter(x, z, r), setDensity: (k) => crowd.setDensity(k), get list() { return crowd.list; }, get density() { return crowd.density; } };
  cast.followers = { add: (a, o) => followers.add(a, o), remove: (a) => followers.remove(a), board: (v) => followers.board(v), get list() { return followers.list; } };

  /* ---------- phases ---------- */
  // bodies arrive, then every actor steps: fighters on the combat clock, the rest on story time. The arena
  // actors move while they show, spawned or not (game.js does not tick them in the story).
  S.register('anim', (cdt, rdt) => {
    for (const a of live) if (a instanceof Figure && !a.body) { const e = tpls.get(a.key); if (e && settle(e)) a.swap(e.t, e.lib, e); }
    for (const a of live) if (!a.disposed) lod.step(a, a.useCdt ? cdt : rdt);
    for (const a of reg.values()) if (!live.has(a) && a.root.visible && a.root.parent) a.update(rdt);
    cast.lodUpdate(S.camera.position);
    talk.update(rdt); // after every clip has set the bones: the mouths and the nod lie over them
  });
  S.register('ai', (cdt, rdt) => {
    // VEHICLES empties S.vehicles.people after reading it; a stub might not, so take back last tick's circles
    const people = S.vehicles && S.vehicles.people;
    if (people && people.length) for (let i = people.length - 1; i >= 0; i--) if (people[i] && people[i].cast) people.splice(i, 1);
    crowd.update(rdt, S.focus); followers.update(rdt);
  });
  // The core cast (the crew and the donor skeleton) loads at the bear's transform on desktop, and at the
  // latest when a session begins (design 3.7: never during the fight on a phone). Nothing waits on it here.
  S.bus.on('preload', (stage) => { if (stage === 'begin' || (stage === 'transform' && !LITE)) { cast.preload(CORE_CAST); loadDonor(); } });
  S.bus.on('start', () => { variantSeq = {}; for (const a of reg.values()) prepare(a); });
  // the costume follows the chapter for crew bodies that did not ask for it either way
  const inCostume = () => cast.autoCostume && COSTUME_CHAPTERS.includes(S.missions && S.missions.chapter);
  function kasaMode() { return KASA_BACK.includes(S.missions && S.missions.chapter) ? 'back' : 'head'; }
  // (a crew body's costume and its kasa follow the chapter: nothing is left on from the chapter before)
  S.bus.on('chapter', () => {
    const on = inCostume(), mode = kasaMode();
    for (const a of live) {
      if (!(a instanceof Figure) || !CREW_IDS.includes(a.id) || !(a.autoCostume ?? true)) continue;
      const now = cast.costumeOf(a);
      if (now.on !== on || (on && now.kasa !== mode) || (!on && now.kasa)) { cast.costume(a, on, mode); a.autoCostume = true; }
    }
  });
  S.bus.on('exit', () => {
    talk.clear();
    crowd.clear(); followers.clear();
    for (const a of [...live]) cast.despawn(a);
    live.clear();
    for (const a of reg.values()) { unprepare(a); if (a.limbGlow) for (const s of Object.values(a.limbGlow)) s.userData.base = null; }
    if (S.ctx.actors && S.ctx.actors.katana) S.ctx.actors.katana.visible = true;
  });

  /* ---------- QA ---------- */
  const tmpBox = new THREE.Box3(), tv = new THREE.Vector3();
  // the height of a body's skinned mesh now (rig space, metres ignored: a ratio is taken)
  function skinnedHeight(a) {
    const mesh = findSkinned(a.model); mesh.skeleton.update();
    const P = mesh.geometry.attributes.position, n = P.count, step = Math.max(1, Math.floor(n / 1500));
    tmpBox.makeEmpty();
    for (let i = 0; i < n; i += step) { tv.fromBufferAttribute(P, i); mesh.applyBoneTransform(i, tv); tmpBox.expandByPoint(tv); }
    return tmpBox.max.y - tmpBox.min.y;
  }
  // the height of the body now: its top bone over its lowest (head_end over the toes when standing). The
  // arms are left out: a raised arm makes no taller pose, and arm lengths differ from body to body.
  function boneHeight(a) {
    let lo = Infinity, hi = -Infinity;
    for (const n of BODY_BONES) { const b = a.bones[n]; if (!b) continue; b.getWorldPosition(tv); lo = Math.min(lo, tv.y); hi = Math.max(hi, tv.y); }
    return hi - lo;
  }
  const scratch = new Map(); // key -> an unseen, uninked actor for measuring
  function probe(id) {
    const arena = reg.has(id) && !BODY_URL[id] && !isBuilt(id), key = arena ? `arena:${id}` : keyOf(id);
    let a = scratch.get(key);
    if (a) return a;
    let tpl, rig, lib;
    if (arena) { // a copy of the arena body at scale 1 (the arena actor itself is never touched)
      const copy = cloneSkinned(reg.get(id).model); copy.position.set(0, 0, 0); copy.quaternion.identity(); copy.scale.set(1, 1, 1);
      tpl = { scene: copy, animations: [] }; rig = rigOf(findSkinned(copy)); lib = library(rig);
    } else { if (!readyKey(key)) return null; const e = tpls.get(key); tpl = e.t; rig = e.rig; lib = e.lib; }
    a = spawnActor(tpl, { addToScene: false, ink: false }); a.clips = Object.create(lib); a.rig = rig;
    scratch.set(key, a);
    return a;
  }
  // posed height / bind height of a body's skinned mesh at n frames of a clip
  // mesh:true measures the skinned mesh instead of the skeleton
  function heights(id, clip, n = 10, { mesh = false } = {}) {
    const measure = mesh ? skinnedHeight : boneHeight;
    const a = probe(id); if (!a) return null;
    const c = a.clips[clip]; if (!c) return null;
    a.mixer.stopAllAction();
    // the rest pose from the rig (the bones' own values may be mid-clip), measured the same way as the frames
    const rig = a.rig;
    for (const n of BONES) { const b = a.bones[n]; if (!b) continue; b.quaternion.copy(rig.restQ[n]); if (n !== 'Hips') b.position.copy(rig.restP[n]); else b.position.set(0, rig.hipsY, 0); }
    a.model.updateMatrixWorld(true);
    const bind = measure(a), out = [];
    const act = a.mixer.clipAction(c); act.reset(); act.setLoop(THREE.LoopRepeat, Infinity); act.play(); act.setEffectiveWeight(1);
    for (let i = 0; i < n; i++) { act.time = c.duration * (i + 0.5) / n; a.mixer.update(0); a.model.updateMatrixWorld(true); out.push(measure(a) / bind); }
    act.stop(); a.mixer.uncacheAction(c);
    return out;
  }
  S.test.cast = {
    get live() { return live.size; },
    crew: CREW_IDS, built: BUILT_IDS, bodies: BODIES,
    heightRatio(id, clip) { const h = heights(id, clip); return h ? h.reduce((s, x) => s + x, 0) / h.length : NaN; },
    heights,
    bones(id) { const a = probe(id) || reg.get(id); if (!a) return []; const m = findSkinned(a.model); return m.skeleton.bones.map((b) => b.name); },
    missingBones: (id) => missingBones(S.test.cast.bones(id)),
    glb: Object.freeze(BUILT_IDS.filter((id) => GLB_OF(id))),
    // the code-built fallback of a GLB body (H1), built on demand once the donor rig is in; its triangles
    builtTris(id, variant = 0) { const d = loadDonor(); if (d.state !== 'ready') return 0; const t = buildBody(d.t, id, variant), m = findSkinned(t.scene), n = m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3; t.scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); return n; },
    tris(id, variant = 0) { const key = keyOf(id, variant); request(id, variant); return readyKey(key) ? tpls.get(key).tris : 0; },
    template(id, variant = 0) { const key = keyOf(id, variant); request(id, variant); return readyKey(key) ? tpls.get(key) : null; },
    clipNames(id) { const a = probe(id); const out = []; if (a) for (const k in a.clips) out.push(k); return out; },
    clip(id, name) { const a = probe(id); return a ? a.clips[name] : null; },
    finite: clipFinite, drift: hipsDrift,
    durations: () => { const d = durations(), o = {}; for (const k in d) o[k] = d[k].duration; return o; },
    figure: Figure, lod, info() { let ph = 0; for (const a of live) if (a instanceof Figure && !a.body) ph++; return { live: live.size, placeholders: ph, templates: [...tpls.keys()], crowd: crowd.list.length, followers: followers.list.length, donor: donor && donor.state }; },
    crowd, followers, props, BONES,
    // tuning: bake a pose again on every body (live actors pick it up on their next play)
    definePose(name, def) { definePose(name, def); for (const L of libs.values()) { delete L[`lib:${name}`]; L.def(`lib:${name}`, () => libClip(L.rig, name)); } },
  };
}
