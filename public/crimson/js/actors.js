// Rigged characters: load a packed GLB, ink it, and play its clips with cross-fades.
// Attacks are cut out of longer clips as sub-clips, so they chain and blend cleanly.
import * as THREE from 'three';
import { GLTFLoader } from '../lib/addons/loaders/GLTFLoader.js';
import { scene, inkify } from './render.js';

const loader = new GLTFLoader();
const FPS = 30;

export class Actor {
  constructor(gltf, { outline = 0.02, glow = 0, scale = 1, cuts = {} } = {}) {
    this.root = new THREE.Group();
    this.model = gltf.scene;
    this.model.scale.multiplyScalar(scale);
    this.root.add(this.model);
    this.glowMats = inkify(this.model, { outline: outline / scale, glow });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {};
    for (const c of gltf.animations) this.clips[c.name] = c;
    // sub-clips: name → [source clip, from, to] in seconds
    for (const [name, [src, from, to]] of Object.entries(cuts)) {
      const c = this.clips[src]; if (!c) { console.warn('missing clip', src); continue; }
      const sub = THREE.AnimationUtils.subclip(c, name, Math.round(from * FPS), Math.round(Math.min(to, c.duration) * FPS), FPS);
      this.clips[name] = sub;
    }
    this.bones = {};
    this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.action = null; this.cur = '';
    scene.add(this.root);
  }
  // play a clip; loop, speed, and fade time are optional
  play(name, { fade = 0.12, loop = true, speed = 1, at = 0, restart = false } = {}) {
    const clip = this.clips[name];
    if (!clip) { console.warn('no clip', name); return null; }
    const a = this.mixer.clipAction(clip);
    if (this.action === a && !restart) { a.timeScale = speed; a.paused = false; return a; }
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = speed; a.time = at;
    a.setEffectiveWeight(1);
    if (this.action && this.action !== a) a.crossFadeFrom(this.action, fade, false);
    a.play();
    this.action = a; this.cur = name;
    return a;
  }
  get t() { return this.action ? this.action.time : 0; }
  get done() { return this.action ? this.action.time >= this.action.getClip().duration - 1e-3 : true; }
  update(dt) { this.mixer.update(dt); }
  bone(name) { return this.bones[name]; }
  setGlow(k) { for (const m of this.glowMats) m.emissiveIntensity = k; }
  set visible(v) { this.root.visible = v; }
}

export async function loadActor(url, opts) {
  const gltf = await loader.loadAsync(url);
  return new Actor(gltf, opts);
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
