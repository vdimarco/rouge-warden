// Rigged characters: load a packed GLB, ink it, and play its clips with cross-fades.
// Attacks are cut out of longer clips as sub-clips, so they chain and blend cleanly.
// The story adds a clone path (loadTemplate, spawnActor) so one GLB gives many actors that share their
// clips, plus addClip, addCuts, dispose and an optional driver that runs after the mixer. None of it
// changes the arena: its three actors are built exactly as before and never get a driver.
import * as THREE from 'three';
import { GLTFLoader } from '../lib/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../lib/addons/utils/SkeletonUtils.js';
import { scene, inkify } from './render.js';

const loader = new GLTFLoader();
const FPS = 30;
// sub-clips are cut once per source clip and shared by every actor that asks for the same cut
const cutCache = new WeakMap();
function cutOf(src, name, from, to) {
  let m = cutCache.get(src);
  if (!m) cutCache.set(src, (m = new Map()));
  const key = `${name}|${from}|${to}`;
  let sub = m.get(key);
  if (!sub) { sub = THREE.AnimationUtils.subclip(src, name, Math.round(from * FPS), Math.round(Math.min(to, src.duration) * FPS), FPS); m.set(key, sub); }
  return sub;
}
// geometry shared by clones is freed when the last actor using it is disposed
const geoUsers = new WeakMap();

export class Actor {
  constructor(gltf, { outline = 0.02, glow = 0, scale = 1, cuts = {}, smooth = [], parent = null, addToScene = true, ink = true } = {}) {
    this.root = new THREE.Group();
    this.model = gltf.scene;
    this.model.scale.multiplyScalar(scale);
    this.root.add(this.model);
    this.glowMats = ink ? inkify(this.model, { outline: outline / scale, glow }) : [];
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {};
    for (const c of gltf.animations) this.clips[c.name] = c;
    this.sources = gltf.animations; // the whole clips as loaded (a cut may take a whole clip's name)
    for (const name of smooth) if (this.clips[name]) smoothLoop(this.clips[name]);
    // sub-clips: name → [source clip, from, to] in seconds
    this.addCuts(cuts);
    this.bones = {};
    this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.action = null; this.cur = ''; this.weights = new Map(); this.fade = 0.12;
    // story only: a function (actor, dt) run after the mixer each update (procedural layers). null in the arena.
    this.driver = null;
    if (parent) parent.add(this.root);
    else if (addToScene) scene.add(this.root);
  }
  addClip(name, clip) { this.clips[name] = clip; }
  addCuts(cuts) {
    for (const [name, [src, from, to]] of Object.entries(cuts)) {
      const c = this.clips[src]; if (!c) { console.warn('missing clip', src); continue; }
      this.clips[name] = cutOf(c, name, from, to);
    }
  }
  // play a clip; loop, speed, and fade time are optional.
  // Blending is done here, not with three.js cross-fades: those restart the weights at 0 and 1 when a
  // blend is cut short, which dips the body toward the rest pose. Here every clip moves from the
  // weight it has now, and the weights always add up to one.
  play(name, { fade = 0.12, loop = true, speed = 1, at = 0, restart = false } = {}) {
    const clip = this.clips[name];
    if (!clip) { console.warn('no clip', name); return null; }
    const a = this.mixer.clipAction(clip);
    if (this.action === a && !restart) { a.timeScale = speed; a.paused = false; return a; }
    const w = this.weights.get(a) || 0;
    // a looping clip that is still blending out keeps its place in the cycle, so the legs do not snap
    if (loop && !restart && w > 0.001) { a.enabled = true; a.paused = false; }
    else { a.reset(); a.time = at; }
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = speed;
    a.play();
    this.weights.set(a, fade > 0 && this.action ? w : 1);
    if (!(fade > 0 && this.action)) for (const o of this.weights.keys()) if (o !== a) this.weights.set(o, 0);
    this.fade = Math.max(0.001, fade);
    this.action = a; this.cur = name;
    return a;
  }
  get t() { return this.action ? this.action.time : 0; }
  get done() { return this.action ? this.action.time >= this.action.getClip().duration - 1e-3 : true; }
  update(dt) {
    // move every clip's weight toward 1 for the current clip and 0 for the rest, then normalize
    const step = dt / this.fade;
    let total = 0;
    for (const [a, w] of this.weights) {
      const nw = a === this.action ? Math.min(1, w + step) : Math.max(0, w - step);
      if (nw <= 0 && a !== this.action) { a.stop(); this.weights.delete(a); continue; }
      this.weights.set(a, nw); total += nw;
    }
    if (!total && this.action) { this.weights.set(this.action, 1); total = 1; }
    for (const [a, w] of this.weights) a.setEffectiveWeight(w / total);
    this.mixer.update(dt);
    if (this.driver) this.driver(this, dt);
  }
  bone(name) { return this.bones[name]; }
  setGlow(k) { for (const m of this.glowMats) m.emissiveIntensity = k; }
  set visible(v) { this.root.visible = v; }
  get visible() { return this.root.visible; }
  // Free what this actor owns: its inked materials, its outline hulls, its bone texture, and the geometry
  // once no other clone of the same template uses it. Shared clips stay (the template owns them).
  dispose() {
    this.root.removeFromParent();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.weights.clear(); this.action = null; this.driver = null;
    const geos = new Set();
    this.root.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        for (const m of [].concat(o.material)) if (m) m.dispose();
        if (o.geometry) geos.add(o.geometry);
      }
      if (o.isSkinnedMesh && o.skeleton && !o.userData.hull) o.skeleton.dispose();
    });
    for (const g of geos) {
      const n = (geoUsers.get(g) || 1) - 1;
      if (n <= 0) { g.dispose(); geoUsers.delete(g); } else geoUsers.set(g, n);
    }
    this.disposed = true;
  }
}

// Soften a looping clip's keys (two passes of a 1-2-1 filter that wraps around the loop), so a coarse
// 30 fps cycle turns smoothly at 60 fps in place of jerking at each key. Used on locomotion only.
// A clip is smoothed once, however many actors share it.
const smoothed = new WeakSet();
function smoothLoop(clip) {
  if (smoothed.has(clip)) return;
  smoothed.add(clip);
  for (const t of clip.tracks) {
    const size = t.getValueSize(), v = t.values, n = t.times.length - 1; // the last key repeats the first
    if (n < 4) continue;
    if (size === 4) for (let i = 1; i <= n; i++) { // keep neighbouring quaternions on the same side
      const a = (i - 1) * 4, b = i * 4;
      if (v[a] * v[b] + v[a + 1] * v[b + 1] + v[a + 2] * v[b + 2] + v[a + 3] * v[b + 3] < 0) for (let k = 0; k < 4; k++) v[b + k] = -v[b + k];
    }
    for (let pass = 0; pass < 2; pass++) {
      const src = v.slice();
      for (let i = 0; i < n; i++) {
        const p = ((i - 1 + n) % n) * size, c = i * size, q = ((i + 1) % n) * size;
        let sign = 1, sign2 = 1;
        if (size === 4) {
          sign = src[p] * src[c] + src[p + 1] * src[c + 1] + src[p + 2] * src[c + 2] + src[p + 3] * src[c + 3] < 0 ? -1 : 1;
          sign2 = src[q] * src[c] + src[q + 1] * src[c + 1] + src[q + 2] * src[c + 2] + src[q + 3] * src[c + 3] < 0 ? -1 : 1;
        }
        for (let k = 0; k < size; k++) v[c + k] = 0.25 * sign * src[p + k] + 0.5 * src[c + k] + 0.25 * sign2 * src[q + k];
        if (size === 4) { const l = Math.hypot(v[c], v[c + 1], v[c + 2], v[c + 3]) || 1; for (let k = 0; k < 4; k++) v[c + k] /= l; }
      }
      for (let k = 0; k < size; k++) v[n * size + k] = v[k];
    }
  }
}
export const smoothPasses = (clip) => smoothed.has(clip);

export async function loadActor(url, opts) {
  const gltf = await loader.loadAsync(url);
  return new Actor(gltf, opts);
}

// The clone path. A template is a loaded GLB (or a code-built body with the same shape: {scene, animations})
// that is never shown; spawnActor clones its skeleton and meshes (geometry and clips are shared) and inks
// the clone. Asset loading is the only promise here; callers watch a flag, never chain game flow on it.
export async function loadTemplate(url) {
  const gltf = await loader.loadAsync(url);
  return makeTemplate(gltf.scene, gltf.animations, url);
}
export function makeTemplate(sceneRoot, animations = [], url = '') {
  sceneRoot.updateMatrixWorld(true);
  return { scene: sceneRoot, animations, url };
}
export function spawnActor(template, opts = {}) {
  const copy = cloneSkinned(template.scene);
  copy.traverse((o) => { if (o.isMesh && o.geometry) geoUsers.set(o.geometry, (geoUsers.get(o.geometry) || 0) + 1); });
  const a = new Actor({ scene: copy, animations: template.animations }, opts);
  // mark the outline hulls inkify added, so the LOD can switch them off at a distance
  a.hulls = [];
  a.root.traverse((o) => { if (o.isMesh && o.material && o.material.side === THREE.BackSide && o.material.isMeshBasicMaterial) { o.userData.hull = true; a.hulls.push(o); } });
  a.template = template;
  return a;
}

// a katana made in code, sized in meters, for the ronin's right hand
export function makeKatana() {
  const k = new THREE.Group();
  const black = new THREE.MeshToonMaterial({ color: 0x0c0c0c });
  const steel = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.55, roughness: 0.2, emissive: 0x303030 });
  const add = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; k.add(o); return o; };
  add(new THREE.BoxGeometry(0.032, 0.25, 0.032), black, 0, 0.02, 0);
  add(new THREE.CylinderGeometry(0.046, 0.046, 0.012, 16), black, 0, 0.155, 0);
  const blade = new THREE.Shape();
  blade.moveTo(-0.012, 0); blade.lineTo(0.016, 0); blade.quadraticCurveTo(0.03, 0.4, 0.012, 0.78); blade.lineTo(-0.012, 0.72); blade.quadraticCurveTo(0.004, 0.4, -0.012, 0);
  const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: false });
  bg.translate(0, 0, -0.003);
  add(bg, steel, 0, 0.16, 0);
  k.userData.base = new THREE.Object3D(); k.userData.base.position.set(0, 0.55, 0); k.add(k.userData.base);
  k.userData.tip = new THREE.Object3D(); k.userData.tip.position.set(0, 0.92, 0); k.add(k.userData.tip);
  return k;
}
