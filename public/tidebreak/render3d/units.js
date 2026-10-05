// Units on the 3D battlefield. Heroes and lane soldiers are rigged models with one AnimationMixer each; their attack
// clips are cut and time-scaled so the clip's strike lands on the simulation's hit moment. Towers, the rift core,
// camp beasts and the Wild Hunt are static models with procedural motion. A view outlives its unit for a death.
import * as THREE from 'three';
import { clone as cloneSkinned } from '/vr/lib/addons/utils/SkeletonUtils.js';
import { assets, heroModel, clipsFor, HERO_CLIPS, CLIP_TIMING } from './assets.js';
import { unitMaterial, unitUniforms, worldMapped } from './materials.js';
import { skinnedMeshOf } from '../hero-rig.js';
import { HERO_IDENTITIES } from '../hero-identities.js';
import { attackPose } from '../combat-motion.js';
import { structureProtected } from '../objectives.js';

// Team colours: teal for allies, crimson for enemies; warm and a little muted, not neon.
export const TEAM3D = ['#58c4ad', '#d65a6c'], NEUTRAL = '#d9b26a', PLAYER = '#f2d68a';
const RIM = [new THREE.Color('#2fa58f'), new THREE.Color('#c23c50'), new THREE.Color('#b08a40')];
export const HERO_HEIGHT = 230;
export const TOWER_HEIGHT = [520, 600, 680, 760];
const SOLDIER = { melee: { height: 170, clip: 'thrust' }, caster: { height: 158, clip: 'cast' }, siege: { height: 215, clip: 'slam' }, elder: { height: 245, clip: 'slam' } };
const CAMP_HEIGHT = { 'possessed-ogre': 215, 'undead-knight': 165, 'undead-mage': 175, 'undead-archer': 160 };
const TAU = Math.PI * 2, angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// Sim facing (x right, y down the map) to a model yaw: models face +Z.
const yawOf = facing => Math.PI / 2 - facing;
const ease = t => t * t * (3 - 2 * t);
// The clip time for an attack: the lead-in plays during the sim windup and the strike lands on the hit; the follow-through
// fills the rest of the attack. The lead-in is never played more than about three times faster than authored.
function strikeTime(timing, variant, age, windup, duration) {
  const strike = timing.strikes[variant % timing.strikes.length], lead = Math.min(strike - timing.from, Math.max(.24, windup * 3.2)), follow = Math.min(timing.to - strike, Math.max(.3, (duration - windup) * 2.6));
  if (age < windup) return strike - lead + age / Math.max(.01, windup) * lead;
  return strike + Math.min(1, (age - windup) / Math.max(.05, duration - windup)) * follow;
}
// Weighted actions with linear cross-fades; times are set by hand for the one-shot clips.
class Rig {
  constructor(root, clips, names) {
    this.mixer = new THREE.AnimationMixer(root); this.actions = {}; this.weights = {}; this.targets = {};
    for (const n of names) if (clips[n]) { const a = this.mixer.clipAction(clips[n]); a.play(); a.setEffectiveWeight(0); a.enabled = false; this.actions[n] = a; this.weights[n] = 0; this.targets[n] = 0; }
  }
  target(name, w) { if (name in this.targets) this.targets[name] = w; }
  clearTargets() { for (const k in this.targets) this.targets[k] = 0; }
  time(name, t) { const a = this.actions[name]; if (a) { a.time = Math.max(0, Math.min(a.getClip().duration - .001, t)); a.paused = true; } }
  run(name, scale) { const a = this.actions[name]; if (a) { a.paused = false; a.timeScale = scale; } }
  update(dt, fade = .15) {
    const step = dt / fade;
    for (const k in this.actions) {
      const goal = this.targets[k], w = this.weights[k], next = goal > w ? Math.min(goal, w + step) : Math.max(goal, w - step), a = this.actions[k];
      this.weights[k] = next; a.enabled = next > .001; a.setEffectiveWeight(next);
    }
    this.mixer.update(dt);
  }
}
function placeholder(height, color) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#2c2a26', roughness: .8, emissive: color, emissiveIntensity: .12 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .55, 4, 10), m); body.position.y = .5; body.scale.setScalar(1); g.add(body);
  g.scale.setScalar(height); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
// --- heroes -------------------------------------------------------------------------------------------------------
class HeroView {
  constructor(units, e) {
    this.units = units; this.root = new THREE.Group(); this.root.name = 'hero'; units.group.add(this.root);
    this.identity = HERO_IDENTITIES[e.identity] || HERO_IDENTITIES.find(h => h.kit === e.hero) || HERO_IDENTITIES[0];
    this.slug = this.identity.slug; this.clips = HERO_CLIPS[this.slug] || ['slash', 'cast'];
    this.scale = (e.player ? 1.1 : 1); this.height = HERO_HEIGHT * this.scale; this.yaw = yawOf(e.facing); this.speed = 0; this.lx = e.x; this.ly = e.y;
    this.uniforms = unitUniforms(); this.uniforms.uRim.value.copy(RIM[e.team] || RIM[2]);
    this.stand = placeholder(this.height, TEAM3D[e.team] || NEUTRAL); this.root.add(this.stand);
    this.tryModel();
  }
  tryModel() {
    if (this.model) return true;
    const m = heroModel(this.slug); if (!m) return false;
    const model = cloneSkinned(m.scene), mats = new Map();
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; let mat = mats.get(o.material); if (!mat) mats.set(o.material, mat = unitMaterial(o.material, this.uniforms, 'hero')); o.material = mat; } });
    model.scale.setScalar(this.height / m.height);
    const clips = clipsFor(this.slug, skinnedMeshOf(model), []);
    this.rig = new Rig(model, clips, ['idle', 'run', 'hit', 'death', ...this.clips]);
    this.root.remove(this.stand); this.stand.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); this.stand = null;
    this.root.add(model); this.model = model; return true;
  }
  update(e, s, time, dt, vis) {
    if (!this.model && this.units.frame % 10 === 0) this.tryModel();
    const r = this.root, u = this.uniforms, dead = e.hp <= 0;
    // Smoothed ground speed from the drawn positions (they are interpolated between sim steps).
    const moved = Math.hypot(e.x - this.lx, e.y - this.ly); this.lx = e.x; this.ly = e.y;
    const inst = moved > 120 ? 0 : moved / Math.max(dt, 1e-3); this.speed += (inst - this.speed) * (1 - Math.exp(-dt * 10));
    let x = e.x, y = e.y, lift = 0;
    if (e.motion) { const t = Math.max(0, Math.min(1, (s.time - e.motion.start) / e.motion.duration)), k = ease(t); x = e.motion.x + (e.x - e.motion.x) * k; y = e.motion.y + (e.y - e.motion.y) * k; lift = Math.sin(t * Math.PI) * e.motion.arc * 1.3; }
    const pose = dead ? null : attackPose(e, s.time), facing = pose?.angle ?? e.facing;
    this.yaw += angleTo(this.yaw, yawOf(facing)) * (1 - Math.exp(-dt * (pose ? 22 : 12)));
    r.rotation.y = this.yaw;
    // Death: the clip plays once and holds; the body then sinks and fades. A respawn resets it.
    if (dead) { this.deadAt ??= time; } else this.deadAt = null;
    const since = dead ? time - this.deadAt : 0, sink = dead ? Math.max(0, since - 2.6) : 0;
    r.position.set(x, lift - sink * 90, y); r.visible = vis && sink < 1.2;
    u.uFade.value = dead ? Math.max(0, 1 - sink) : this.concealed ? .5 : 1;
    u.uFlash.value = e.hit > 0 ? e.hit / .16 * .22 : 0;
    u.uRimPower.value = this.units.rimPower * (e.player ? 1.2 : 1);
    if (!this.rig || !r.visible) return;
    const g = this.rig; g.clearTargets();
    const [attackClip, castClip] = this.clips, cast = !dead && e.castIntent, casting = pose?.casting;
    if (dead) { g.target('death', 1); g.time('death', Math.min(2.3, since * 1.1)); }
    else if (pose && !casting) {
      const timing = CLIP_TIMING[attackClip];
      if (timing) { g.target(attackClip, 1); g.time(attackClip, strikeTime(timing, pose.variant, pose.age, e.attackWindup || .12, pose.duration)); this.units.poses.push({ id: e.id, hero: e.hero, identity: this.identity.id, stage: pose.stage, clip: attackClip, model: this.slug }); }
    } else if (casting || cast) {
      const timing = CLIP_TIMING[castClip];
      if (timing) {
        g.target(castClip, 1);
        if (cast) { const k = Math.max(0, Math.min(1, (s.time - cast.start) / Math.max(.05, cast.at - cast.start))); g.time(castClip, timing.from + (timing.strikes[0] - .04 - timing.from) * k); this.fromIntent = true; }
        else { const t = this.fromIntent ? timing.strikes[0] + pose.age / pose.duration * (timing.to - timing.strikes[0]) : strikeTime(timing, 0, pose.age, .12, pose.duration); g.time(castClip, t); }
        if (casting) this.units.poses.push({ id: e.id, hero: e.hero, identity: this.identity.id, stage: pose.stage, clip: castClip, model: this.slug });
      }
    } else {
      this.fromIntent = false;
      const running = this.speed > 40 || lift > 0;
      g.target(running ? 'run' : 'idle', 1); g.run('run', Math.max(.55, Math.min(1.7, this.speed / (470 * this.scale)))); g.run('idle', 1);
      if (e.hit > 0) { g.target('hit', .5 * e.hit / .16); g.time('hit', .1 + (.16 - e.hit) / .16 * .45); }
    }
    g.update(dt, dead ? .12 : .14);
  }
  dispose() { this.units.group.remove(this.root); this.root.traverse(o => { if (o.isMesh && o.material?.userData?.uniforms) o.material.dispose(); }); this.rig?.mixer.stopAllAction(); }
}
// --- lane soldiers ------------------------------------------------------------------------------------------------
class MinionView {
  constructor(units, team, role, ghost = false) {
    this.units = units; this.root = new THREE.Group(); this.root.name = ghost ? 'ghost' : 'minion'; units.group.add(this.root); this.ghost = ghost;
    const src = assets.world.minion, model = cloneSkinned(src.scene), shared = units.minionMaterials(team, ghost);
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.material = shared.get(o.name) || shared.get('*'); } });
    // Wave roles read by size and motion: casters are slighter and cast, siege and elder wisps stand taller and slam.
    this.height = SOLDIER[role]?.height || 170; model.scale.setScalar(this.height / units.minionHeight); this.root.add(model); this.model = model;
    this.rig = new Rig(model, units.minionClips, ['idle', 'run', 'thrust', 'slam', 'cast', 'death', 'hit']); this.team = team; this.role = role; this.clip = SOLDIER[role]?.clip || 'thrust';
  }
  reset(e) { this.yaw = yawOf(e.facing); this.lx = e.x; this.ly = e.y; this.speed = 0; this.deadAt = null; this.root.visible = true; for (const k in this.rig.weights) this.rig.weights[k] = 0; this.root.position.set(e.x, 0, e.y); }
  update(e, s, time, dt, vis, gone) {
    const r = this.root, dead = gone || e.hp <= 0;
    const moved = Math.hypot(e.x - this.lx, e.y - this.ly); this.lx = e.x; this.ly = e.y;
    const inst = moved > 120 ? 0 : moved / Math.max(dt, 1e-3); this.speed += (inst - this.speed) * (1 - Math.exp(-dt * 8));
    const attacking = !dead && e.attackStarted !== undefined && s.time - e.attackStarted < (e.attackDuration || .46) && s.time >= e.attackStarted;
    this.yaw += angleTo(this.yaw, yawOf(e.facing)) * (1 - Math.exp(-dt * 10)); r.rotation.y = this.yaw;
    if (dead) this.deadAt ??= time;
    const since = dead ? time - this.deadAt : 0, sink = Math.max(0, since - 1.3);
    r.position.set(e.x, -sink * 70, e.y); r.visible = vis && sink < 1.4;
    if (!r.visible) return dead && since > 2.7;
    // Far soldiers animate at a lower rate; the view is drawn every frame.
    this.acc = (this.acc || 0) + dt; if (!this.units.near(e) && this.acc < 1 / 20) return false;
    const step = this.acc; this.acc = 0;
    const g = this.rig; g.clearTargets();
    if (dead) { g.target('death', 1); g.time('death', Math.min(2.3, since * 1.25)); }
    else if (attacking) { const clip = this.clip, age = s.time - e.attackStarted; g.target(clip, 1); g.time(clip, strikeTime(CLIP_TIMING[clip], 0, age, .12, e.attackDuration || .46)); }
    else { g.target(this.speed > 30 ? 'run' : 'idle', 1); g.run('run', Math.max(.6, Math.min(1.5, this.speed / 360))); g.run('idle', 1); if (e.hit > 0) { g.target('hit', .45); g.time('hit', .1 + (.16 - e.hit) * 2.5); } }
    g.update(step, .12);
    return false;
  }
  dispose() { this.units.group.remove(this.root); this.rig.mixer.stopAllAction(); }
}
// --- towers, guardians and cores ----------------------------------------------------------------------------------
class StructureView {
  constructor(units, e) {
    this.units = units; this.root = new THREE.Group(); this.root.name = e.kind; units.group.add(this.root);
    const core = e.kind === 'core', tier = e.guardian ? 3 : Math.max(0, Math.min(3, e.tier ?? 0)), gltf = assets.world[core ? 'core' : 'tower'];
    this.height = core ? 760 : TOWER_HEIGHT[tier]; this.core = core; this.guardian = !core && tier === 3;
    const mat = unitMaterial(units.meshMaterial(gltf), this.uniforms = unitUniforms(), 'structure');
    const mesh = new THREE.Mesh(units.meshGeometry(gltf), mat); mesh.castShadow = mesh.receiveShadow = true; mesh.scale.setScalar(this.height); this.mesh = mesh; this.root.add(mesh);
    this.uniforms.uRim.value.copy(RIM[e.team] || RIM[2]); this.uniforms.uRimPower.value = .18;
    // The pale crystal takes the team colour and glows.
    this.uniforms.uTint.value.set(e.team === 0 ? '#79cfbf' : e.team === 1 ? '#e27c8c' : '#e8c27e'); this.uniforms.uTintOn.value = 1; this.uniforms.uTintRange.value.set(.62, .8); this.uniforms.uTintGlow.value = core ? .1 : .25; this.uniforms.uTintLevel.value = core ? .38 : .55; // big lit crystals would read white
    if (this.guardian || core) { const ring = new THREE.Mesh(units.plinth, units.stone); ring.scale.set(core ? 520 : 190, core ? 46 : 56, core ? 520 : 190); ring.castShadow = ring.receiveShadow = true; this.root.add(ring); if (!core) mesh.position.y = 50; }
    // The crystal's glow: a sprite in the team colour that breathes.
    const glow = new THREE.Sprite(units.glowMaterial(e.team)); glow.position.y = (core ? .86 : .9) * this.height + (this.guardian ? 50 : 0); glow.scale.setScalar(core ? 300 : 240); this.glow = glow; this.root.add(glow);
    this.ward = new THREE.Mesh(units.wardGeometry, units.wardMaterial(e.team)); this.ward.scale.set(core ? 520 : 170, this.height * 1.05, core ? 520 : 170); this.ward.visible = false; this.root.add(this.ward);
    this.root.position.set(e.x, 0, e.y); this.root.rotation.y = core ? (e.team ? Math.PI : 0) : (e.id * 1.7) % TAU;
  }
  get top() { return this.glow.position.y; }
  update(e, s, time, dt, vis) {
    const ratio = Math.max(0, e.hp / e.maxHp), dead = e.hp <= 0, u = this.uniforms;
    if (dead) this.deadAt ??= time; else this.deadAt = null;
    const since = dead ? time - this.deadAt : 0, fall = dead ? ease(Math.min(1, since / 1.6)) : 0;
    this.root.visible = vis;
    // Damage darkens the stone; a low structure smokes; a fallen one sinks to a stump and leaves rubble.
    this.mesh.material.color.setScalar(.55 + .45 * ratio);
    this.mesh.position.y = (this.guardian ? 50 : 0) - fall * this.height * .78; this.mesh.rotation.z = fall * .09; this.mesh.rotation.x = fall * .05;
    this.glow.visible = !dead; const pulse = this.units.reduced ? 1 : 1 + Math.sin(time * 2.2 + e.id) * .08; this.glow.scale.setScalar((this.core ? 300 : 240) * pulse * (.75 + ratio * .25));
    u.uFlash.value = e.hit > 0 ? e.hit / .16 * .12 : 0;
    const prot = !dead && structureProtected(s, e); this.ward.visible = prot && vis; if (prot) this.ward.material.uniforms.uTime.value = time;
    if (dead && !this.rubble) { this.rubble = true; this.units.effects.dust(e.x, e.y, this.core ? 300 : 140, this.core ? 24 : 14, '#9a8c74'); const r = this.units.rubble(e, this.core ? 2.2 : 1); this.root.add(r); }
    if (!dead && ratio < .4 && vis && Math.random() < dt * (ratio < .2 ? 7 : 3.5)) this.units.effects.smoke.emit({ x: e.x + (Math.random() - .5) * 50, y: this.height * (.55 + Math.random() * .3), z: e.y + (Math.random() - .5) * 50, vx: 25, vy: 70 + Math.random() * 30, vz: -15, life: 2.4, size: 110, grow: 2.2, color: '#4a4440', alpha: .45, drag: .4 });
    if (dead && since < 2 && Math.random() < dt * 10) this.units.effects.dust(e.x, e.y, this.core ? 260 : 120, 1, '#8f8370', this.height * .3 * (1 - fall));
    return false;
  }
  dispose() { this.units.group.remove(this.root); this.mesh.material.dispose(); }
}
// --- camp beasts, the Wild Hunt, summons --------------------------------------------------------------------------
class CreatureView {
  constructor(units, e) {
    this.units = units; this.root = new THREE.Group(); this.root.name = e.kind; units.group.add(this.root);
    const boss = e.kind === 'boss' || e.kind === 'leviathan', gltf = assets.world[boss ? 'wildhunt' : 'beast'];
    this.height = boss ? 430 : CAMP_HEIGHT[e.marketplaceSprite] || 180;
    this.uniforms = unitUniforms(); this.uniforms.uRim.value.copy(e.kind === 'leviathan' ? RIM[e.team] : RIM[2]); this.uniforms.uRimPower.value = e.kind === 'leviathan' ? 1.4 : .35;
    const mesh = new THREE.Mesh(units.meshGeometry(gltf), unitMaterial(units.meshMaterial(gltf), this.uniforms, 'creature'));
    mesh.castShadow = true; mesh.receiveShadow = false; mesh.scale.setScalar(this.height); mesh.rotation.y = Math.PI; this.mesh = mesh; this.body = new THREE.Group(); this.body.add(mesh); this.root.add(this.body);
    if (e.kind === 'leviathan') mesh.material.color.set(e.team ? '#e8c6c6' : '#c6e4dc');
    this.yaw = yawOf(e.facing); this.lx = e.x; this.ly = e.y; this.speed = 0; this.phase = Math.random() * 6;
  }
  update(e, s, time, dt, vis, gone) {
    const r = this.root, dead = gone || e.hp <= 0, u = this.uniforms;
    const moved = Math.hypot(e.x - this.lx, e.y - this.ly); this.lx = e.x; this.ly = e.y; this.speed += ((moved > 120 ? 0 : moved / Math.max(dt, 1e-3)) - this.speed) * (1 - Math.exp(-dt * 8));
    if (dead) this.deadAt ??= time;
    const since = dead ? time - this.deadAt : 0;
    this.yaw += angleTo(this.yaw, yawOf(e.facing)) * (1 - Math.exp(-dt * 6)); r.rotation.y = this.yaw;
    const t = time + this.phase, walk = Math.min(1, this.speed / 120), breathe = this.units.reduced ? 0 : Math.sin(t * 2.1) * .018;
    // A lunge toward the target on attack, a bob in the stride, breathing at rest; a fall on death.
    const atk = e.attackStarted !== undefined && s.time >= e.attackStarted ? (s.time - e.attackStarted) / (e.attackDuration || .5) : 2, lunge = atk < 1 ? Math.sin(Math.min(1, atk) * Math.PI) : 0;
    this.body.position.set(0, Math.abs(Math.sin(t * 7)) * 10 * walk, lunge * this.height * .22);
    this.body.rotation.x = -lunge * .12 + Math.sin(t * 7) * .02 * walk; this.body.scale.set(1, 1 + breathe, 1);
    if (dead) { const f = ease(Math.min(1, since / .9)); this.body.rotation.z = f * 1.35; this.body.position.y = -Math.max(0, since - 1.4) * 60; }
    r.position.set(e.x, 0, e.y); r.visible = vis && since < 2.6;
    u.uFlash.value = e.hit > 0 ? e.hit / .16 * .2 : 0;
    const special = e.specialIntent; u.uRimPower.value = (e.kind === 'leviathan' ? 1.4 : .35) + (special ? .8 + Math.sin(time * 14) * .3 : 0);
    return dead && since > 2.6;
  }
  dispose() { this.units.group.remove(this.root); this.mesh.material.dispose(); }
}
class TotemView {
  constructor(units, e) {
    this.units = units; this.root = new THREE.Group(); this.root.name = 'summon'; units.group.add(this.root); this.height = 190;
    const stone = new THREE.Mesh(units.totemGeometry, units.stone); stone.scale.set(46, 150, 46); stone.castShadow = true; this.root.add(stone);
    this.glow = new THREE.Sprite(units.glowMaterial(e.team)); this.glow.position.y = 175; this.glow.scale.setScalar(120); this.root.add(this.glow);
    this.root.position.set(e.x, 0, e.y);
  }
  update(e, s, time, dt, vis, gone) { const since = gone || e.hp <= 0 ? (this.deadAt ??= time, time - this.deadAt) : 0; this.root.position.set(e.x, -since * 160, e.y); this.root.visible = vis && since < 1; this.glow.scale.setScalar(120 + Math.sin(time * 3) * 12); return since >= 1; }
  dispose() { this.units.group.remove(this.root); }
}
export class Units {
  constructor(scene, effects) {
    this.scene = scene; this.effects = effects; this.group = new THREE.Group(); this.group.name = 'units'; scene.add(this.group);
    this.views = new Map(); this.pool = {}; this.frame = 0; this.poses = []; this.rimPower = 1; this.reduced = false; this.focus = { x: 0, y: 0 };
    this.plinth = new THREE.CylinderGeometry(1, 1.12, 1, 24).translate(0, .5, 0); this.totemGeometry = new THREE.CylinderGeometry(.55, .8, 1, 6).translate(0, .5, 0);
    this.wardGeometry = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true).translate(0, .5, 0);
    this.glows = []; this.wards = []; this.cache = new Map();
  }
  init(textures) {
    this.textures = textures; this.stone = worldMapped(textures.stone, { color: '#c4bcac', scale: 220, key: 'stone-unit' });
    this.meshMaterial(assets.world.boulders).color.setScalar(1.5); // rubble: the mossy rock texture is dark
    const m = assets.world.minion; this.minionHeight = new THREE.Box3().setFromObject(m.scene).getSize(new THREE.Vector3()).y;
    this.minionClips = clipsFor('minion', skinnedMeshOf(m.scene), ['idle', 'run', 'thrust', 'slam', 'cast', 'death', 'hit']);
  }
  meshGeometry(gltf) { let g = null; gltf.scene.traverse(o => { if (!g && o.isMesh) g = o.geometry; }); return g; }
  meshMaterial(gltf) { let g = null; gltf.scene.traverse(o => { if (!g && o.isMesh) g = o.material; }); return g; }
  // Two shared material sets for the lane soldiers: tabards take the team colour.
  // A ghost set (pale, see-through, strong rim) serves summons that walk and kinds without a model.
  minionMaterials(team, ghost = false) {
    const key = (ghost ? 'ghost' : 'minion') + team; if (this.cache.has(key)) return this.cache.get(key);
    const map = new Map(), uniforms = unitUniforms(ghost ? '#9fc4d8' : team ? '#8e3443' : '#2f7f78'); uniforms.uRim.value.copy(RIM[team] || RIM[2]); uniforms.uRimPower.value = ghost ? 1.6 : .45;
    if (ghost) { uniforms.uFade.value = .6; uniforms.uTintRange.value.set(0, .05); }
    assets.world.minion.scene.traverse(o => { if (o.isMesh && !map.has(o.name)) map.set(o.name, unitMaterial(o.material, uniforms, 'minion')); });
    map.set('*', [...map.values()][0]); map.uniforms = uniforms; this.cache.set(key, map); return map;
  }
  glowMaterial(team) {
    this.glows[team + 1] ||= new THREE.SpriteMaterial({ map: this.textures.glow, color: team === 0 ? '#79e6d2' : team === 1 ? '#ff7088' : '#f3c67a', blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, toneMapped: false, opacity: .55 });
    return this.glows[team + 1];
  }
  // The ward shimmer on a protected structure: a faint fresnel wall in the team colour, rising bands.
  wardMaterial(team) {
    return this.wards[team + 1] ||= new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(team ? '#ff7a8c' : '#86e8d6') } }, side: THREE.FrontSide,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vY = position.y; vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(1. - abs(dot(vN, vV)), 2.5); float band = .5 + .5 * sin(vY * 30. - uTime * 3.); float a = (f * .32 + band * .035) * (1. - vY) * smoothstep(0., .05, vY); gl_FragColor = vec4(uColor * a, 1.); }' });
  }
  rubble(e, k) {
    const g = new THREE.Group(), geo = this.meshGeometry(assets.world.boulders), mat = this.meshMaterial(assets.world.boulders);
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(geo, mat), a = i / 5 * TAU + e.id, s = (40 + (i * 37 % 30)) * k; m.scale.set(s * 1.3, s, s * 1.3); m.position.set(Math.cos(a) * 70 * k, 0, Math.sin(a) * 70 * k); m.rotation.y = a * 2; m.castShadow = m.receiveShadow = true; g.add(m); }
    return g;
  }
  near(e) { return Math.abs(e.x - this.focus.x) < 1700 && Math.abs(e.y - this.focus.y) < 1300; }
  make(e) {
    if (e.kind === 'hero') return new HeroView(this, e);
    if (e.kind === 'tower' || e.kind === 'core') return new StructureView(this, e);
    if (e.kind === 'camp' || e.kind === 'boss' || e.kind === 'leviathan') return new CreatureView(this, e);
    if (e.kind === 'summon' && !e.speed) return new TotemView(this, e);
    // Lane soldiers come from a pool per team; a summon that walks or an unknown kind is a pale ghost soldier.
    const role = e.role || (e.elder ? 'elder' : e.siege ? 'siege' : e.caster ? 'caster' : 'melee'), team = e.team === 1 ? 1 : 0, list = (this.pool[role] ||= [[], []])[team];
    const v = e.kind === 'minion' ? list.pop() || new MinionView(this, team, role) : new MinionView(this, team, 'melee', true); v.reset(e);
    return v;
  }
  release(v) {
    if (v instanceof MinionView && !v.ghost) { v.root.visible = false; (this.pool[v.role] ||= [[], []])[v.team].push(v); }
    else v.dispose();
  }
  // Brings every view up to date. visible(e) says whether team 0 sees the unit.
  sync(s, time, dt, visible, focus) {
    this.frame++; this.poses = []; this.focus = focus;
    const alive = new Set();
    for (const e of s.units) {
      let v = this.views.get(e.id);
      if (v && v.kindKey !== e.kind) { this.release(v); v = null; }
      if (!v) { v = this.make(e); v.kindKey = e.kind; this.views.set(e.id, v); }
      v.unit = e; alive.add(e.id);
      v.update(e, s, time, dt, visible(e), false);
    }
    // Units the simulation removed keep their view for the death; then it returns to the pool.
    for (const [id, v] of this.views) if (!alive.has(id)) { if (v.update(v.unit, s, time, dt, v.root.visible, true)) { this.release(v); this.views.delete(id); } }
  }
  clear() { for (const v of this.views.values()) this.release(v); this.views.clear(); }
  stats() { let heroes = 0, placeholders = 0; for (const v of this.views.values()) if (v instanceof HeroView) { heroes++; if (!v.model) placeholders++; } return { views: this.views.size, heroes, placeholders }; }
}
