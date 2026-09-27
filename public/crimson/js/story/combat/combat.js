// js/story/combat/combat.js : the COMBAT package. init(S) fills S.hero, S.combat and S.stealth.
// The arena fight in game.js is untouched: its tables live in js/moves.js and its logic is ported here with
// the fighters as parameters, so one hero can fight many enemies (fighter.js, resolve.js), with attack
// tokens and lock-on (tokens.js), the gang and the bosses as data (foes.js, bosses.js), the Bear Call
// (bearcall.js), perception (stealth.js) and the camera on foot (footcam.js).
// Phases: control (the hero), ai (tokens, perception, soft circles for traffic), combat (every enemy on
// the combat dt: hitstop and slow motion reach only this), anim (the weapon trail), hud (suspicion eyes,
// the prompt's hold ring). Flow runs on S.timers and S.co only.
import * as THREE from 'three';
import { Trail } from '../../fx.js';
import { WEAPON_IDS, CREW_IDS } from '../types.js';
import { TUNE } from '../../moves.js';
import { flatDist } from './fighter.js';
import { createHero } from './hero.js';
import { createFootcam } from './footcam.js';
import { createResolve } from './resolve.js';
import { createTokens, MAX_TOKENS } from './tokens.js';
import { createFoes, FOES, LEGENDS } from './foes.js';
import { createBosses } from './bosses.js';
import { createBearCall, CALL } from './bearcall.js';
import { createStealth, SIGHT } from './stealth.js';
import { WEAPONS } from './playermoves.js';

const DAY_LOOKS = new Set(['DAY', 'MEMORY', 'HANGOVER', 'DAWN']);

export function init(S) {
  const listeners = new Map();
  const aiRand = S.rng('ai');
  // fx positions: a small ring of reusable points, so a call can build a few in one expression
  const ats = Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0, groundY: 0 }));
  let atI = 0;
  const K = {
    S, enemies: [], seq: 0, ct: 0, lock: null, stats: { deflects: 0, takedowns: 0 }, arenaRing: null, vortexOn: false,
    aiRand, arand: (a, b) => a + aiRand() * (b - a), rand: (a, b) => a + Math.random() * (b - a),
    emit(evt, d) { for (const f of (listeners.get(evt) || []).slice()) { try { f(d); } catch (e) { console.error(`[combat] '${evt}' listener`, e); } } },
    at(x, y, z, g) { const p = ats[atI = (atI + 1) % ats.length]; p.x = x; p.y = y; p.z = z; p.groundY = g ?? y; return p; },
    groundAt: (p) => (Number.isFinite(p.y) ? p.y : S.world.surface(p.x, p.z)),
    get fx() { return S.ctx.fx; },
    dust(pos, n, s) { const g = K.groundAt(pos); S.ctx.fx.dust(K.at(pos.x, g, pos.z, g), n, s); },
    sfx(name, pos, o = {}) { if (S.audio) S.audio.sfx(name, pos ? { at: pos, ...o } : o); },
    toast(text, hot) { if (S.ui && S.ui.toast) S.ui.toast(text, hot); },
    danger(f) { K.sfx('tell', f.pos); K.toast('危', true); K.emit('danger', f); },
    flash(k) { if (S.look && S.look.base) S.look.base.flash = Math.max(S.look.base.flash || 0, k); },
    hurt(k) { if (S.look && S.look.base) S.look.base.hurt = Math.max(S.look.base.hurt || 0, k); },
    smear(sec) { smearT = sec; smearDur = sec; },
    look: () => S.look,
    heroDown: () => S.hero.hp <= 0,
    // pushed out of anything solid; true when something was in the way
    solid(f) { const y = Number.isFinite(f.pos.y) ? f.pos.y : 0; const hit = S.world.colliders.resolveCircle(f.pos, f.radius, y); const h = S.world.HALF - 2; f.pos.x = Math.max(-h, Math.min(h, f.pos.x)); f.pos.z = Math.max(-h, Math.min(h, f.pos.z)); return hit; },
    // a heavy blow meets the ground (the arena's impact): a blast, a ring, dust, ink, a splat
    impact(f, s) {
      const sh = s.hits[0] && s.hits[0][2];
      if (s.sand) { spray(f); return; }
      const fwd = sh && sh.aoe ? sh.aoe[0] : 1.6;
      const x = f.pos.x + Math.sin(f.face) * fwd, z = f.pos.z + Math.cos(f.face) * fwd, g = S.world.surface(x, z, f.pos.y + 1);
      K.sfx('slam', f.pos); K.cam.shake = Math.max(K.cam.shake, 0.8);
      const fx = S.ctx.fx;
      fx.blast(K.at(x, g, z, g), 1.2); fx.ring(K.at(x, g, z, g), sh && sh.aoe ? sh.aoe[1] * 1.4 : 3, 0.6); fx.dust(K.at(x, g, z, g), 16, 1.4); fx.ink(K.at(x, g + 0.3, z, g), 12, 1.4, 0.8); fx.splat(K.at(x, g, z, g), 2.2, g);
    },
    fighting: () => K.enemies.some((f) => !f.downed && !f.gone && f.alert && flatDist(f.pos, S.hero.pos) < 30),
    tie: (f) => tie(f),
    weaponUsed: () => weaponUsed(),
    drawWeapon: (on) => drawWeapon(on),
    dropWeaponProp: () => dropWeaponProp(),
  };
  let smearT = 0, smearDur = 1, scatterT = 0;
  // Voss's sand: a spray of dust along a 5 m cone in front of him
  function spray(f) {
    const fx = S.ctx.fx;
    for (let i = 0; i < 6; i++) { const d = 1 + i * 0.8, x = f.pos.x + Math.sin(f.face) * d, z = f.pos.z + Math.cos(f.face) * d, g = S.world.surface(x, z, f.pos.y + 1); fx.dust(K.at(x, g + 0.6, z, g), 5, 0.7); }
    K.sfx('dodge', f.pos);
  }

  /* ---------------- the parts ---------------- */
  const footcam = createFootcam(K);
  const stealth = K.stealth = createStealth(K);
  const resolve = K.resolve = createResolve(K);
  const tokens = K.tokens = createTokens(K);
  const bosses = K.bosses = createBosses(K);
  const foes = K.foes = createFoes(K);
  const bearcall = K.bearcall = createBearCall(K);
  const hero = createHero(K);
  const H = S.hero;

  /* ---------------- weapons ---------------- */
  let drawnAt = -99, drawn = false, trail = null;
  function heldProp() { const w = WEAPONS[H.weapon]; return w && w.prop && H.actor && H.actor.props ? H.actor.props[w.prop] : null; }
  function drawWeapon(on) {
    const w = WEAPONS[H.weapon] || WEAPONS.fists;
    if (on) drawnAt = S.time;
    if (!H.actor) return;
    if (on && !drawn) { drawn = true; if (w.prop) S.cast.props.attach(H.actor, w.prop); }
    else if (!on && drawn) { drawn = false; dropWeaponProp(); }
  }
  function dropWeaponProp() {
    for (const w of Object.values(WEAPONS)) if (w.prop && H.actor && H.actor.props && H.actor.props[w.prop]) S.cast.props.detach(H.actor, w.prop);
    drawn = false;
  }
  function setWeapon(id, uses) {
    if (!WEAPON_IDS.includes(id)) throw new Error(`S.combat.setWeapon: unknown weapon '${id}'`);
    const was = drawn;
    dropWeaponProp();
    H.weapon = id;
    if (!H.weapons.includes(id)) H.weapons.push(id);
    const w = WEAPONS[id];
    if (uses != null) H.uses[id] = uses; else if (H.uses[id] == null) H.uses[id] = w.uses;
    if (was || C.active) drawWeapon(true);
    K.emit('weapon', id);
  }
  // a breakable weapon wears out once per swing that lands
  function weaponUsed() {
    const w = WEAPONS[H.weapon];
    if (!w || !Number.isFinite(w.uses) || !H.atk || H.atk.worn) return;
    H.atk.worn = true;
    H.uses[w.id] = (H.uses[w.id] ?? w.uses) - 1;
    if (H.uses[w.id] <= 0) {
      K.toast(w.breaks || 'IT BREAKS', true); K.sfx('block', H.pos);
      H.weapons = H.weapons.filter((x) => x !== w.id); delete H.uses[w.id];
      const next = ['staff', 'foamKatana', 'cue', 'stool'].find((x) => H.weapons.includes(x)) || 'fists';
      dropWeaponProp(); H.weapon = next; if (next !== 'fists') drawWeapon(true);
      K.emit('weapon', next);
    }
  }
  // the blade's trail while it cuts (the arena's white trail)
  function pushTrail() {
    const p = drawn && H.mode === 'foot' ? heldProp() : null;
    if (!p) { if (trail) trail.mesh.visible = false; return; }
    if (!trail) trail = new Trail(20, new THREE.Color(2.0, 2.0, 2.0), true);
    trail.mesh.visible = true;
    const s = H.state === 'attack' && H.atk ? H.atk.spec : null, ct = s ? (s.from || 0) + H.actor.t : 0;
    const swinging = s && ct > s.hit[0] - 0.12 && ct < s.hit[1] + 0.08;
    const tip = p.userData.tip, base = p.userData.base;
    if (!tip) return;
    const hand = H.actor.bone && H.actor.bone('RightHand');
    trail.push((base || hand || p).getWorldPosition(tA), tip.getWorldPosition(tB), swinging ? 0.45 : 0);
  }
  const tA = new THREE.Vector3(), tB = new THREE.Vector3();

  /* ---------------- down and tied ---------------- */
  function tie(f) {
    if (f.tied || f.gone) return;
    f.tied = true; f.downed = true; f.state = 'down';
    S.interact.remove(`tie:${f.id}`);
    if (f.a) S.cast.props.attach(f.a, 'zipTies');
    K.sfx('zip', f.pos); K.toast('ZIP-TIED');
    if (f.boss) {
      if (K.combat.boss === f) { K.combat.boss = null; if (S.ui && S.ui.boss) S.ui.boss(null); }
      if (K.vortexOn) { S.look.vortex(false); K.vortexOn = false; }
    }
    K.emit('tied', f);
  }
  const fightDone = () => K.enemies.length > 0 && K.enemies.every((f) => f.downed || f.gone || !f.alert && !f.fought);
  let endT = 0, legendOn = false, cued = false, lastDownT = -9;
  const onDown = () => { lastDownT = S.time; };
  function finish() {
    for (const f of K.enemies) if (f.downed && !f.tied && !f.boss && !f.gone) tie(f);
    // the ink bleeds back 1.2 s after the last enemy went down (LOOK then takes 1.2 s to fade it)
    if (legendOn) {
      legendOn = false;
      const wait = 1.2 - (S.time - lastDownT);
      if (wait > 0.02) S.timers.after(wait, () => { if (!legendOn) S.look.legend(false); }, 'combat:legend'); else S.look.legend(false);
    }
    if (cued && S.audio) { S.audio.cue('auto'); cued = false; }
    C.active = false; endT = 0;
    K.arenaRing = null;
    K.emit('end', C);
  }
  const daylight = () => { const L = S.look || {}; if (L.clockDriven) return !S.day.night; return DAY_LOOKS.has(L.name); };

  /* ---------------- S.combat ---------------- */
  const C = S.combat = K.combat = {
    get player() { return H; }, enemies: K.enemies, active: false, boss: null,
    begin(o = {}) {
      C.active = true; endT = 0;
      const ar = o.arena;
      K.arenaRing = !ar ? null : typeof ar === 'string' ? (() => { const p = S.world.place(ar); return p ? { x: p.x, z: p.z, r: p.r || 12 } : null; })() : { x: ar.x, z: ar.z, r: ar.r || 12 };
      const legend = o.legend ?? daylight();
      if (legend && !legendOn) { S.look.legend(true); legendOn = true; }
      if (o.music && S.audio) { S.audio.cue('boss'); cued = true; }
      S.cast.preload(['gang']);
      scatterT = 0;
      K.emit('begin', o);
    },
    spawn(foeId, o = {}) {
      const f = foes.spawn(foeId, o);
      if (f.alert) f.fought = true;
      if (f.boss && C.active && S.audio && !cued) { S.audio.cue('boss'); cued = true; }
      return f;
    },
    clear(group) {
      for (const f of K.enemies.slice()) if (!group || f.group === group) { foes.despawn(f); K.enemies.splice(K.enemies.indexOf(f), 1); }
      if (K.lock && K.lock.gone) K.lock = null;
      if (!K.enemies.length && K.vortexOn) { S.look.vortex(false); K.vortexOn = false; }
    },
    end() { if (C.active || legendOn) finish(); },
    setWeapon(id) { setWeapon(id); },
    give(id, o = {}) { if (!WEAPON_IDS.includes(id)) throw new Error(`S.combat.give: unknown weapon '${id}'`); setWeapon(id, o.uses ?? WEAPONS[id].uses); K.toast(WEAPONS[id].name); },
    lockCycle(d = 1) { return tokens.lockCycle(d); },
    on(evt, fn) { if (!listeners.has(evt)) listeners.set(evt, []); listeners.get(evt).push(fn); return () => { const a = listeners.get(evt), i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; },
    // beyond the contract, for the UI: the lock target, the parry hint, the Bear Call's charge
    get lock() { return K.lock; },
    get parryHint() { return tokens.hint; },
    get bearCall() { return { unlocked: bearcall.unlocked, ready: bearcall.ready, cooldown: bearcall.cooldown, max: CALL.cooldown }; },
    get stats() { return K.stats; },
    tie: (f) => tie(f),
  };
  let bossRef = null;
  Object.defineProperty(C, 'boss', { get: () => bossRef, set: (v) => { bossRef = v; }, enumerable: true });
  C.on('down', onDown);

  /* ---------------- phases ---------------- */
  S.register('ai', (cdt) => { if (!S.world.visible) return; tokens.update(cdt); stealth.update(cdt); }, 5);
  S.register('ai', () => foes.people(), 20);
  S.register('combat', (cdt) => {
    K.ct += cdt;
    for (const f of K.enemies.slice()) { foes.update(f, cdt); bosses.update(f, cdt); if (f.alert && !f.fought) f.fought = C.active; }
    bearcall.update(cdt);
    stealth.beams();
    if (C.active && fightDone()) { endT += cdt; if (endT >= 1.2) finish(); }
    else endT = 0;
    // people in the street keep clear of a fight
    if (K.fighting() && (scatterT -= cdt) <= 0) { scatterT = 2; if (S.cast.crowd) S.cast.crowd.scatter(H.pos.x, H.pos.z, 25); }
  });
  // fighters animate on the combat clock (hitstop), except while a cine drives them; the hero only in a fight
  S.register('anim', () => {
    const cine = !!(S.cine && S.cine.active);
    if (H.actor) H.actor.useCdt = !cine && (C.active || K.fighting());
    for (const f of K.enemies) if (f.a) f.a.useCdt = !cine;
  }, -10);
  S.register('anim', () => { pushTrail(); for (const f of K.enemies) if (f.propObj && f.a && f.a.bone && f.a.bone('RightHand') && f.propObj.parent !== f.a.bone('RightHand')) foes.sync(f, 0); if (drawn && !C.active && !K.fighting() && H.state !== 'attack' && S.time - drawnAt > 4) drawWeapon(false); }, 100);
  S.register('hud', (cdt, rdt) => {
    stealth.hud();
    if (smearT > 0) { smearT = Math.max(0, smearT - rdt); if (S.look && S.look.base) S.look.base.smear = smearT / smearDur; }
    const cur = S.interact.current;
    if (H.mode === 'foot' && cur && cur.hold > 0 && S.mode === 'play' && !S.freeze && S.ui && S.ui.prompt) S.ui.prompt(cur.label, 'E', H.hold01);
  }, 10);

  /* ---------------- the session ---------------- */
  S.bus.on('start', () => {
    C.clear(); stealth.St.clear(); tokens.reset(); bearcall.reset(); hero.reset();
    C.active = false; endT = 0; legendOn = false; cued = false; K.arenaRing = null; K.vortexOn = false; smearT = 0; K.ct = 0;
    // a new session starts with fists and a full canteen; MISSIONS then applies the save or the chapter
    dropWeaponProp(); H.weapon = 'fists'; H.weapons = ['fists']; H.uses = {}; H.canteen = H.canteenMax = TUNE.gourds;
    if (!H.actor) H.setBody(CREW_IDS[S.ctx.crewPick] || 'shades');
    H.setMode('foot'); H.hp = H.maxHp;
    footcam.cam.init = false;
    if (trail) trail.mesh.visible = false;
  });
  S.bus.on('exit', () => {
    C.clear(); stealth.St.clear(); tokens.reset(); bearcall.reset();
    C.active = false; legendOn = false; cued = false; K.vortexOn = false;
    dropWeaponProp();
    H.actor = null; H.body = null; H.mode = 'foot'; H.state = 'move';
    if (trail) trail.mesh.visible = false;
  });

  /* ---------------- QA ---------------- */
  const attacking = () => K.enemies.filter((f) => !f.boss && f.state === 'attack').length;
  S.test.combat = {
    get enemies() { return K.enemies; },
    spawn: (id, x, z, o = {}) => C.spawn(id, { pos: { x, z }, ...o }),
    ko: (i) => { const f = K.enemies[i]; if (f && !f.downed) { f.hp = 0; resolve.knockOut(f, 'qa'); } return f; },
    tokens: () => tokens.holders(),
    lock: () => (K.lock ? K.lock.id : null),
    attacking, K, hero, footcam, tokenMgr: tokens, resolve, foes, bosses, bearcall, stealth: stealth.St, SIGHT, CALL, MAX_TOKENS, FOES, LEGENDS, WEAPONS,
    get cam() { return K.cam; }, get stats() { return K.stats; },
    // press an action for one tick through the story input (QA)
    press: (a) => S.input.set({ [a]: true }),
  };
}
