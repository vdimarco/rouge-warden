// Stub CAST (frozen; the cast package replaces cast/cast.js, not this file).
// Capsule actors with the Actor API and the same clip names and durations as the real bodies (D2); the
// arena actors (ronin, gabe, bear) are registered, shown and hidden, never disposed (B9).
import { CAST_IDS, CREW_IDS } from '../types.js';
import { RONIN_CUTS, GABE_CUTS, BEAR_CUTS } from '../../moves.js';

const GABE_STORY_SCALE = 1.95 / 2.28; // the arena Gabe stands 2.28 m; in the story he is about 1.95 m (B9)
// clip name -> seconds: the whole clips as round figures, the cuts from the move tables
const CLIPS = (() => {
  const t = { idle: 2, run: 0.8, walk: 1, dead: 2, hit: 0.8, 'lib:walk': 1, 'lib:crouch': 1.1, 'lib:talk': 3, 'lib:phone': 3, 'lib:kneel': 2.4, 'lib:knock': 1.6, 'lib:sit': 3, 'lib:cheer': 2 };
  for (const [pre, cuts] of [['ronin', RONIN_CUTS], ['gabe', GABE_CUTS], ['bear', BEAR_CUTS]]) for (const [name, [, a, b]] of Object.entries(cuts)) t[`${pre}:${name}`] = +(b - a).toFixed(3);
  return Object.freeze(t);
})();
const TINT = { tanktop: 0xb8b2aa, fifty: 0xc8c2b8, shades: 0x6e6a66, newbalance: 0xa09a92, redjersey: 0x8a3a38, gabe: 0x5a4a3a, vance: 0x2c3a52, voss: 0xd8d0c0, rattler: 0x4a5a70, boone: 0x3a3a3a, gang: 0x222222, civA: 0x9a8a7a, civB: 0x7a8a9a, christian: 0xa8a098, ryu: 0x989088 };

class Capsule {
  constructor(THREE, id, color) {
    this.id = id; this.root = new THREE.Group(); this.root.name = `capsule:${id}`;
    const mat = new THREE.MeshLambertMaterial({ color });
    this.model = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.2, 4, 10), mat); this.model.position.y = 0.88;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), mat); nose.position.set(0, 1.55, 0.26);
    this.root.add(this.model, nose);
    this.clips = {}; for (const [k, d] of Object.entries(CLIPS)) this.clips[k] = { name: k, duration: d };
    this.cur = 'idle'; this.time = 0; this.loop = true; this.speed = 1; this.useCdt = false;
  }
  play(name, { loop = true, speed = 1, at = 0, restart = false } = {}) {
    if (!this.clips[name]) { console.warn('no clip', name); return null; }
    if (this.cur === name && !restart) { this.speed = speed; return this; }
    this.cur = name; this.time = at; this.loop = loop; this.speed = speed;
    return this;
  }
  get t() { return this.time; }
  get done() { const d = this.clips[this.cur] ? this.clips[this.cur].duration : 0; return !this.loop && this.time >= d - 1e-3; }
  update(dt) { const d = this.clips[this.cur] ? this.clips[this.cur].duration : 1; this.time += dt * this.speed; this.time = this.loop ? this.time % d : Math.min(this.time, d); }
  bone() { return undefined; }
  setGlow() {}
  set visible(v) { this.root.visible = v; }
  get visible() { return this.root.visible; }
  addClip(name, clip) { this.clips[name] = { name, duration: clip.duration }; }
  addCuts(cuts) { for (const [name, [, a, b]] of Object.entries(cuts)) this.clips[name] = { name, duration: b - a }; }
  dispose() { this.root.removeFromParent(); this.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
}

export function init(S) {
  const { THREE } = S;
  const reg = new Map(), live = new Set();
  const place = (a, o) => {
    if (o.pos) a.root.position.set(o.pos.x, o.pos.y ?? S.world.surface(o.pos.x, o.pos.z), o.pos.z);
    if (o.yaw != null) a.root.rotation.y = o.yaw;
  };
  const drainOf = new WeakMap();
  const cast = S.cast = {
    preload(ids = []) { for (const id of ids) if (!CAST_IDS.includes(id)) console.warn(`S.cast.preload: unknown cast id '${id}'`); return { done: true, progress: 1 }; },
    ready: (id) => CAST_IDS.includes(id),
    spawn(id, o = {}) {
      if (!CAST_IDS.includes(id)) throw new Error(`S.cast.spawn: unknown cast id '${id}'`);
      let a = reg.get(id);
      if (a) { if (id === 'gabe') a.root.scale.setScalar(GABE_STORY_SCALE); if (o.parent) o.parent.add(a.root); }
      else { a = new Capsule(THREE, id, o.tint ?? TINT[id] ?? 0x888888); (o.parent || S.world.group).add(a.root); }
      a.visible = true; place(a, o); live.add(a);
      return a;
    },
    despawn(a) {
      if (!a) return;
      live.delete(a);
      if ([...reg.values()].includes(a)) { a.visible = false; return; } // arena actors are only hidden (B9)
      if (a.dispose) a.dispose();
    },
    register(id, actor) { reg.set(id, actor); },
    props: {
      make(name) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.6), new THREE.MeshLambertMaterial({ color: 0x666666 })); m.name = `prop:${name}`; return m; },
      attach(a, name, bone, o = {}) { const p = cast.props.make(name, o); ((bone && a.bone && a.bone(bone)) || a.root).add(p); (a.props || (a.props = {}))[name] = p; return p; },
      detach(a, name) { const p = a.props && a.props[name]; if (p) { p.removeFromParent(); delete a.props[name]; } },
    },
    pose(a, name) { a.pose = name; },
    // neon drain: the glow materials and the limb glow sprites scale by 1-k (B10)
    drain(a, k) {
      if (!a) return;
      drainOf.set(a, k);
      if (a.setGlow && a.glowMats) a.setGlow(0.35 * (1 - k));
      for (const s of Object.values(a.limbGlow || {})) { if (s.userData.base == null) s.userData.base = s.material.opacity; s.material.opacity = s.userData.base * (1 - k); }
    },
    inkShadow() {},
    vortexParts() { return { tail: new THREE.Object3D(), set() {} }; },
    lodUpdate() {},
    followers: { list: [], add(a) { cast.followers.list.push(a); }, remove(a) { const l = cast.followers.list, i = l.indexOf(a); if (i >= 0) l.splice(i, 1); }, board() {} },
    crowd: { update() {}, scatter() {}, setDensity() {} },
  };
  // every actor the story shows animates here: fighters on the combat clock, the rest on story time
  S.register('anim', (cdt, rdt) => { for (const a of live) a.update(a.useCdt ? cdt : rdt); });
  S.bus.on('exit', () => { for (const a of [...live]) cast.despawn(a); for (const a of reg.values()) if (a.limbGlow) for (const s of Object.values(a.limbGlow)) s.userData.base = null; });
  S.test.cast = { heightRatio: () => 0.9, bones: () => [], get live() { return live.size; }, crew: CREW_IDS };
}
