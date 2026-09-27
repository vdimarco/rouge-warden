// js/story/combat/stealth.js : S.stealth, who sees the hero (COMBAT spec 9, design 4.2).
// - Each watcher has a view cone of 110 degrees, 28 m by day and 18 m by night on foot; a flashlight adds
//   45 degrees to 24 m; a driver's mirrors see 60 degrees to the rear to 40 m. Deep ink (the ranch with the
//   generator cut) halves every range.
// - Suspicion 0..1 per watcher: it rises while the hero is in view (line of sight through the colliders
//   and the ground), faster when near, scaled by the hero's exposure: crouch 0.5, juniper or shadow 0.35,
//   sprint 1.4, and 0.3 inside a gang lookalike van near gang vehicles (unless within 15 m). It falls
//   0.15 a second. At 1 the watcher is alert and 'spotted' fires.
// - Silent takedown: behind a watcher within 1.6 m while its suspicion is under 0.5 (an S.interact option).
// - HUD data per watcher: {f, level, alert, screen:{x, y, on}} for the UI's suspicion eyes.
// - Flashlight cones are neon meshes (neon means danger).
import * as THREE from 'three';
import { NEON } from '../look/palette.js';
import { angDiff, angleTo, flatDist, turn } from './fighter.js';

export const SIGHT = Object.freeze({ cone: 110 * Math.PI / 180, day: 28, night: 18, flashCone: 45 * Math.PI / 180, flash: 24, mirrorCone: 60 * Math.PI / 180, mirror: 40, rise: 1.2, decay: 0.15, takedown: 1.6 });
const NIGHT_LOOKS = new Set(['NIGHT', 'MEMORY_NIGHT', 'DEEP_INK', 'VORTEX', 'ARENA']);

export function createStealth(K) {
  const { S } = K;
  const list = [];
  const listeners = new Map();
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), proj = new THREE.Vector3();
  let spottedOnce = false;
  const beamGeo = (() => { const L = 1, r = Math.tan(SIGHT.flashCone / 2) * L; const g = new THREE.ConeGeometry(r, L, 20, 1, true); g.translate(0, -L / 2, 0); g.rotateX(-Math.PI / 2); return g; })();

  // the beam: brightest at the lamp, gone at the far end, soft where the cone turns away from the eye
  const beamMat = () => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(NEON.flashlight) }, uOpacity: { value: 0.1 } },
    vertexShader: 'varying float vT; varying float vF; void main(){ vT = position.z; vec4 mv = modelViewMatrix * vec4(position, 1.); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vT; varying float vF; void main(){ float a = uOpacity * pow(clamp(1. - vT, 0., 1.), 1.6) * smoothstep(0.05, 0.6, vF); gl_FragColor = vec4(uColor, a); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const night = () => {
    const L = S.look || {};
    if (L.clockDriven) return S.day.night;
    return NIGHT_LOOKS.has(L.name) || (L.name === 'DUSK' && S.day.hour > 19);
  };
  const deepInk = () => St.deepInk || (S.look && S.look.name === 'DEEP_INK');
  // the hero's exposure multiplier right now
  function exposure() {
    const H = S.hero;
    if (H.mode === 'drive' || H.mode === 'passenger') {
      const v = S.drive && S.drive.riding;
      const gangVan = v && (v.kind === 'whitevan' || v.gang || S.flags.gangVan);
      if (gangVan && St.gangVehicles().some((g) => flatDist(g, H.pos) < 60)) return St.list.some((w) => flatDist(w.f.pos, H.pos) < 15) ? 1 : 0.3;
      return 1;
    }
    let e = 1;
    if (H.crouch) e *= 0.5;
    if (cover(H.pos)) e *= 0.35;
    if (H.sprint) e *= 1.4;
    return e;
  }
  // in a juniper (or any tree) or in deep shadow: a tree trunk within 1.4 m
  function cover(p) {
    let hit = false;
    S.world.colliders.query(p.x, p.z, 1.4, (it) => { if (it.tag === 'tree') { hit = true; return false; } });
    return hit;
  }
  // can the watcher's eye see the hero's chest (colliders and the ground in between)?
  function sees(w, H) {
    const f = w.f;
    tA.set(f.pos.x, f.pos.y + 1.6, f.pos.z);
    tB.set(H.pos.x, H.pos.y + (H.crouch ? 0.8 : 1.3), H.pos.z);
    const t = S.world.colliders.raycast(tA, tB);
    return t == null || t > 0.97;
  }
  function gain(w, H, dt) {
    const f = w.f, cfg = w.cfg;
    const d = flatDist(f.pos, H.pos), bearing = Math.abs(angDiff(f.face, angleTo(f.pos, H.pos)));
    const ink = deepInk() ? 0.5 : 1;
    let range = 0;
    if (bearing <= SIGHT.cone / 2) range = (night() ? SIGHT.night : SIGHT.day) * ink;
    if (w.flashlight && bearing <= SIGHT.flashCone / 2) range = Math.max(range, SIGHT.flash * ink);
    if (cfg.mirrors && Math.abs(angDiff(f.face + Math.PI, angleTo(f.pos, H.pos))) <= SIGHT.mirrorCone / 2) range = Math.max(range, SIGHT.mirror * ink);
    if (cfg.range) range = Math.min(range, cfg.range * ink);
    if (!range || d > range) return 0;
    if (!sees(w, H)) return 0;
    return SIGHT.rise * St.exposure * Math.max(0, Math.min(1, 1.15 - d / range)) * (cfg.sharp || 1);
  }
  function update(dt) {
    const H = S.hero;
    St.exposure = exposure();
    let any = false, top = 0;
    for (const w of list) {
      const f = w.f;
      // a driver at the wheel: the watcher rides with the vehicle (its mirrors look back)
      const v = w.cfg.vehicle;
      if (v && v.pos) { f.pos.x = v.pos.x; f.pos.y = v.pos.y; f.pos.z = v.pos.z; f.face = v.yaw || 0; }
      if (f.downed || f.gone || f.tied) { w.level = 0; continue; }
      if (f.alert) { w.level = 1; w.alert = true; any = true; continue; }
      const heroHidden = H.mode === 'photo' ? false : (H.mode === 'drive' || H.mode === 'passenger') && !w.cfg.vehicles && St.exposure < 1;
      const g = heroHidden ? 0 : gain(w, H, dt);
      w.seen = g > 0;
      if (g > 0) { w.level = Math.min(1, w.level + (g - SIGHT.decay) * dt); if (w.level > 0.25) { w.lastX = H.pos.x; w.lastZ = H.pos.z; } }
      else w.level = Math.max(0, w.level - SIGHT.decay * dt);
      if (w.level >= 1 && !w.alert) {
        w.alert = true; f.alert = true; f.state = 'idle'; f.t = 0; f.cooldown = 0.8;
        if (f.a) f.a.play(f.idleClip, { fade: 0.2 });
        K.sfx('tell', f.pos); K.toast('SPOTTED', true);
        emit('spotted', { f, watcher: w });
        K.emit('spotted', f);
        // the shout: watchers within 15 m turn to look where the hero was
        for (const o of list) if (o !== w && !o.alert && flatDist(o.f.pos, f.pos) < 15) { o.level = Math.max(o.level, 0.7); o.lastX = H.pos.x; o.lastZ = H.pos.z; }
      }
      if (w.level > top) top = w.level;
      if (w.alert) any = true;
    }
    St.spotted = any;
    if (any && !spottedOnce) spottedOnce = true;
    St.top = top;
    takedowns();
  }
  // unalert watchers walk their patrol, stop to look around, and go to look when half suspicious
  function patrol(f, dt) {
    const w = list.find((x) => x.f === f), H = S.hero;
    f.walk = 0;
    if (w && w.level > 0.5 && w.lastX != null) {
      f.state = 'search';
      const to = Math.atan2(w.lastX - f.pos.x, w.lastZ - f.pos.z), d = Math.hypot(w.lastX - f.pos.x, w.lastZ - f.pos.z);
      turn(f, to, 2.5, dt);
      if (d > 2 && Math.abs(angDiff(f.face, to)) < 0.6) { f.walk = 1.6; f.walkDir = f.face; }
      f.a.play('idle', { fade: 0.3 });
      return;
    }
    f.state = 'calm';
    const path = f.patrol;
    if (!path || !path.length) {
      // posted: look left and right slowly
      const sweep = Math.sin(K.ct * 0.35 + f.pos.x) * 0.7;
      turn(f, f.homeYaw + sweep, 0.8, dt);
      f.a.play('idle', { fade: 0.3 });
      return;
    }
    const p = path[f.patrolI % path.length], d = Math.hypot(p.x - f.pos.x, p.z - f.pos.z);
    if (f.pauseT > 0) { f.pauseT -= dt; turn(f, f.face + Math.sin(K.ct) * 0.5, 0.6, dt); f.a.play('idle', { fade: 0.3 }); return; }
    if (d < 1.0) { f.patrolI++; f.pauseT = K.arand(0.8, 2.2); return; }
    const to = Math.atan2(p.x - f.pos.x, p.z - f.pos.z);
    turn(f, to, 2.2, dt);
    if (Math.abs(angDiff(f.face, to)) < 0.7) { f.walk = 1.3; f.walkDir = f.face; }
    f.a.play('idle', { fade: 0.3 });
  }
  // the silent takedown option: behind an unalert watcher, close, while its suspicion is under 0.5
  function takedowns() {
    const H = S.hero;
    for (const w of list) {
      const f = w.f, id = `takedown:${f.id}`;
      const ok = !w.cfg.vehicle && !!f.a && !f.alert && !f.downed && !f.gone && w.level < 0.5 && H.mode === 'foot';
      if (ok && !w.opt) {
        w.opt = true;
        S.interact.add({ id, tag: 'combat', label: 'TAKEDOWN', r: SIGHT.takedown, mode: 'foot', prio: 5, pos: () => ({ x: f.pos.x, y: f.pos.y, z: f.pos.z }),
          when: () => !f.alert && !f.downed && w.level < 0.5 && Math.abs(angDiff(f.face, angleTo(f.pos, S.hero.pos))) > Math.PI * 0.55,
          act: () => silent(f, w) });
      } else if (!ok && w.opt) { w.opt = false; S.interact.remove(id); }
    }
  }
  function silent(f, w) {
    const H = S.hero;
    H.face = angleTo(H.pos, f.pos); H.state = 'takedown'; H.t = 0;
    if (H.actor) H.actor.play('gabe:grab', { loop: false, speed: 1.6, fade: 0.1, restart: true, at: 0.9 });
    K.sfx('punch', f.pos);
    f.hp = 0; K.resolve.knockOut(f, 'silent');
    K.stats.takedowns++;
    K.emit('takedown', f);
    K.tie(f);
    w.level = 0;
  }
  function emit(evt, d) { for (const fn of (listeners.get(evt) || []).slice()) fn(d); }
  // the HUD's suspicion eyes: screen positions above each watcher's head
  function hud() {
    const cam = S.camera, W = innerWidth, Hh = innerHeight;
    for (const w of list) {
      const f = w.f, s = w.screen;
      proj.set(f.pos.x, f.pos.y + 2.2, f.pos.z).project(cam);
      s.on = proj.z < 1 && proj.z > -1 && !f.downed && !f.gone && (w.level > 0.02 || f.alert);
      s.x = (proj.x * 0.5 + 0.5) * W; s.y = (-proj.y * 0.5 + 0.5) * Hh;
    }
  }
  // a guard's flashlight: the prop in the left hand, and a neon cone along where the guard looks
  function flashlight(f, on) {
    if (on && !f.beam) {
      if (f.a) S.cast.props.attach(f.a, 'flashlight', 'LeftHand', { on: false });
      const m = new THREE.Mesh(beamGeo, beamMat());
      m.scale.setScalar(SIGHT.flash * 0.7); m.renderOrder = 4; m.name = 'flashlightCone';
      S.world.group.add(m); f.beam = m;
      const w = list.find((x) => x.f === f); if (w) w.flashlight = true;
    } else if (!on && f.beam) {
      f.beam.removeFromParent(); f.beam.material.dispose(); f.beam = null;
      if (f.a && f.a.props && f.a.props.flashlight) S.cast.props.detach(f.a, 'flashlight');
    }
  }
  function beams() {
    for (const f of K.enemies) {
      if (!f.beam) continue;
      f.beam.visible = !f.downed && !f.gone && S.world.visible;
      f.beam.position.set(f.pos.x + Math.sin(f.yaw) * 0.3, f.pos.y + 1.25, f.pos.z + Math.cos(f.yaw) * 0.3);
      f.beam.rotation.set(0.12, f.yaw, 0, 'YXZ');
      f.beam.material.uniforms.uOpacity.value = deepInk() ? 0.2 : night() ? 0.14 : 0.04;
    }
  }

  const St = S.stealth = {
    list, spotted: false, exposure: 1, deepInk: false, top: 0,
    watch(f, cfg = {}) {
      if (!f) return null;
      let w = list.find((x) => x.f === f);
      if (!w) { w = { f, cfg, level: 0, alert: !!f.alert, seen: false, flashlight: !!f.beam || !!cfg.flashlight, screen: { x: 0, y: 0, on: false }, lastX: null, lastZ: null }; list.push(w); }
      else Object.assign(w.cfg, cfg);
      if (cfg.flashlight && !f.beam) flashlight(f, true);
      if (!f.alert && f.state === 'idle') { f.state = 'calm'; f.t = 0; }
      return w;
    },
    unwatch(f) { const i = list.findIndex((w) => w.f === f); if (i >= 0) { if (list[i].opt) S.interact.remove(`takedown:${f.id}`); list.splice(i, 1); } },
    level: () => list.reduce((m, w) => Math.max(m, w.level), 0),
    on(evt, fn) { if (!listeners.has(evt)) listeners.set(evt, []); listeners.get(evt).push(fn); return () => { const a = listeners.get(evt), i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; },
    get night() { return night(); },
    // vehicles the gang drives (for the lookalike van rule): mission vehicles marked gang, or white vans
    gangVehicles: () => (S.vehicles ? S.vehicles.list.filter((v) => v !== (S.drive && S.drive.riding) && (v.gang || v.kind === 'whitevan' || v.kind === 'suv' || v.kind === 'pickup') && !v.traffic).map((v) => v.pos) : []),
    canCrouch: () => list.length > 0 || !!S.flags.stealth,
    clear() { for (const w of list) if (w.opt) S.interact.remove(`takedown:${w.f.id}`); list.length = 0; St.spotted = false; St.deepInk = false; spottedOnce = false; },
  };
  return { update, patrol, hud, flashlight, beams, exposure, cover, St, canCrouch: St.canCrouch, unwatch: (f) => St.unwatch(f) };
}
