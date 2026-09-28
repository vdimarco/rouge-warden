// js/story/combat/resolve.js : what happens when a blow lands. Ported from game.js receive(),
// playerHitCheck(), deathblow() and hurtPlayer(), with the fighters as parameters:
// - receive(att, idx): an enemy's hit window reaches the hero: roll i-frames, unblockables (charge, pipe,
//   grab), deflect inside the parry window (posture to the attacker), block (ki cost, chip), guard break.
// - heroHitCheck(): the hero's swing, against every enemy in its arc (cleave: each once per swing).
// - non-lethal: hp 0 is down (knocked out, then a dazed sit), never dead; the hero at 0 is 'heroDown'.
import * as THREE from 'three';
import { TUNE } from '../../moves.js';
import { angDiff, angleTo, flatDist, breakPosture } from './fighter.js';
import { WEAPONS } from './playermoves.js';

const GOD = new URLSearchParams(location.search).has('god');

export function createResolve(K) {
  const { S } = K;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const pushBack = (p, face, d) => { p.x += Math.sin(face) * d; p.z += Math.cos(face) * d; };

  /* ---------------- enemy -> hero ---------------- */
  function receive(att, idx) {
    const H = S.hero, s = att.atk.spec;
    const g = K.groundAt(H.pos);
    const at = K.at(H.pos.x + (att.pos.x - H.pos.x) * 0.3, g + 1.4, H.pos.z + (att.pos.z - H.pos.z) * 0.3, g);
    if (H.iframe) { K.toast('EVADED'); K.fx.ink(K.at(H.pos.x, g + 0.8, H.pos.z, g), 5, 0.4, 0.3); K.emit('evaded', { att }); return; }
    const facing = Math.abs(angDiff(H.face, angleTo(H.pos, att.pos))) < 1.9;
    if (s.unblock) {
      if (s.charge) { hurtHero(s.dmg, true, false, att); pushBack(H.pos, att.face, 2.4); return; }
      if (s.pipe) { hurtHero(s.dmg, true, false, att); pushBack(H.pos, att.face, 3); K.toast('BLOWN BACK', true); K.cam.shake = 0.9; return; }
      if (s.grab) {
        H.state = 'grabbed'; H.t = 0; att.state = 'grabHold'; att.t = 0; att.thrown = false; att.queue = [];
        if (H.actor) H.actor.play('ronin:hit', { speed: 0.5, fade: 0.1, restart: true });
        K.sfx('hurt', H.pos); K.cam.shake = 0.6;
        return;
      }
      if (s.sand) { K.smear(1.5); hurtHero(s.dmg, false, false, att); K.toast('SAND IN YOUR EYES', true); return; }
      hurtHero(s.dmg, !!s.knock, false, att);
      return;
    }
    if (H.state === 'guard' && facing) {
      const since = K.ct - H.parryT, mash = H.parryPresses.length > 2 ? 0.55 : 1;
      if (since <= H.stats.parryWin * mash) {
        K.stats.deflects++;
        H.state = 'deflect'; H.t = 0; H.st = Math.min(100, H.st + 6); H.counterT = K.ct;
        if (H.actor) H.actor.play('ronin:defl', { loop: false, speed: 2.2, fade: 0.05, restart: true });
        att.posture = Math.min(att.maxPosture, att.posture + (s.pp || 12) * TUNE.postureGain); att.postureT = 0;
        K.sfx('clang', H.pos);
        S.hitstop = Math.max(S.hitstop, 0.12); K.flash(0.25); K.cam.punch = 1; K.cam.shake = Math.max(K.cam.shake, 0.5);
        const dir = tmpB.set(Math.sin(att.face), 0.3, Math.cos(att.face));
        K.fx.sparks(at, dir, 60, 9, 8); K.fx.flash(at, 1.5, 0.16); K.fx.dust(K.at(H.pos.x, g, H.pos.z, g), 6, 1.1);
        K.toast('DEFLECT');
        K.emit('deflect', { att });
        if (att.posture >= att.maxPosture) { breakPosture(K, att); return; }
        if (idx === s.hits.length - 1 && !att.queue.length) { att.state = 'recoil'; att.t = 0; att.atk = null; if (att.a) att.a.play('gabe:hit', { loop: false, speed: 1.2, fade: 0.08, restart: true }); }
        return;
      }
      K.sfx('block', H.pos);
      H.st -= (s.bc || 12) * TUNE.blockCost; H.stDelay = 0.6;
      K.fx.sparks(at, null, 12, 4, 3);
      pushBack(H.pos, att.face, 0.45);
      att.posture = Math.min(att.maxPosture, att.posture + (s.pp || 12) * 0.25 * TUNE.postureGain);
      if (H.st <= 0) {
        H.st = 0; H.state = 'broken'; H.t = 0;
        if (H.actor) H.actor.play('ronin:hit', { loop: false, fade: 0.08, restart: true });
        K.toast('GUARD BROKEN', true); hurtHero(s.dmg * 0.3, false, true, att); return;
      }
      hurtHero(s.dmg * 0.15, false, true, att);
      return;
    }
    hurtHero(s.dmg, !!s.knock, false, att);
  }
  // damage to the hero (hurtPlayer). hp never goes below 0; at 0 the hero is down and 'heroDown' fires.
  function hurtHero(dmg, knock, chip, att) {
    const H = S.hero;
    if (H.state === 'downed') return;
    if (GOD) dmg = 0;
    dmg *= TUNE.bossDmg;
    H.hp = Math.max(0, H.hp - dmg);
    if (!chip) {
      K.sfx('hurt', H.pos);
      K.hurt(0.85); S.hitstop = Math.max(S.hitstop, 0.07); K.cam.shake = Math.max(K.cam.shake, 0.7);
      const g = K.groundAt(H.pos), p = K.at(H.pos.x, g + 1.2, H.pos.z, g);
      K.fx.ink(p, 12, 1, 0.6); K.fx.dust(K.at(H.pos.x, g, H.pos.z, g), 3, 1.2);
      if (H.state !== 'grabbed') {
        H.state = knock ? 'down' : 'hit'; H.t = 0; H.iframe = false;
        if (H.actor) H.actor.play(knock ? 'ronin:down' : 'ronin:hit', { loop: false, speed: knock ? 1.1 : 1.5, fade: 0.06, restart: true });
      }
    }
    if (H.hp <= 0) heroDown();
  }
  function heroDown() {
    const H = S.hero;
    if (H.state === 'downed') return;
    H.hp = 0; H.state = 'downed'; H.t = 0; H.iframe = false;
    if (H.actor) H.actor.play('lib:knock', { loop: false, fade: 0.15, restart: true });
    K.sfx('death', H.pos);
    S.slow = 0.35; S.slowT = 1.2;
    for (const f of K.enemies) f.queue = [];
    K.emit('heroDown', H);
  }

  /* ---------------- hero -> enemies ---------------- */
  // every enemy in the swing's arc takes the hit once per swing (a Set per swing)
  function heroHitCheck() {
    const H = S.hero, s = H.atk.spec, set = H.atk.cleave, w = WEAPONS[H.weapon] || WEAPONS.fists;
    let landed = 0;
    for (const f of K.enemies) {
      if (set.has(f) || f.downed || f.tied || f.gone || f.state === 'vanish') continue;
      const d = flatDist(H.pos, f.pos) - f.radius;
      if (d > s.reach || Math.abs(angDiff(H.face, angleTo(H.pos, f.pos))) > s.arc) continue;
      set.add(f); landed++;
      hitFoe(f, s, w, landed === 1);
    }
    if (landed) H.atk.landed = (H.atk.landed || 0) + landed;
    return landed;
  }
  function hitFoe(f, s, w, first) {
    const H = S.hero, g = K.groundAt(f.pos);
    const at = K.at(H.pos.x + (f.pos.x - H.pos.x) * 0.6, g + 1.2 + f.air + Math.random() * 0.5 - 0.2, H.pos.z + (f.pos.z - H.pos.z) * 0.6, g);
    if (f.state === 'phase' || f.state === 'vanish' || f.dodging || f.invuln) {
      K.sfx('block', f.pos); K.fx.sparks(at, null, 10, 4, 3); if (f.dodging) K.toast('SLIPPED'); K.emit('slipped', f); return;
    }
    if (H.atk.name === 'deathblow') { deathblow(f, at); return; }
    // a clone of ink bursts at one touch
    if (f.clone) { K.foes.vanish(f, true); return; }
    const open = f.state === 'recover' || f.state === 'recoil' || f.state === 'stagger';
    const dmg = s.dmg * w.dmg * H.stats.dmg * (open ? 1.25 : 1);
    f.hp -= dmg;
    f.posture = Math.min(f.maxPosture, f.posture + s.post * w.post * TUNE.postureGain * (f.state === 'recoil' ? 1.6 : 1) * (f.postureK || 1));
    f.postureT = 0; f.flinch = 1;
    K.sfx(H.weapon === 'fists' ? 'hit' : 'cut', f.pos);
    if (first) {
      S.hitstop = Math.max(S.hitstop, H.atk.name === 'heavy' ? 0.09 : 0.05);
      K.cam.shake = Math.max(K.cam.shake, H.atk.name === 'heavy' ? 0.5 : 0.25);
    }
    if (f.ink) K.fx.neon(at, 8, 0.7);
    K.fx.ink(at, 6, 0.7, 0.6);
    K.weaponUsed();
    if (f.hp <= 0) { f.hp = 0; if (f.boss && f.phase2Pending) { f.hp = 1; } else { knockOut(f, 'hit'); return; } }
    if (f.posture >= f.maxPosture && f.state !== 'broken') { breakPosture(K, f); return; }
    // grunts flinch when struck outside their swing; bosses shrug it off (the arena Gabe never flinches)
    if (!f.boss && !f.armor && f.state !== 'broken' && f.state !== 'down') {
      const inSwing = f.state === 'attack' && f.atk && f.nextHit != null && f.clipT > f.nextHit - 0.25;
      if (!inSwing) { f.state = 'hit'; f.t = 0; f.atk = null; f.queue = []; if (f.a) f.a.play('gabe:hit', { loop: false, speed: 2.2, fade: 0.06, restart: true }); }
      f.pos.x += Math.sin(H.face) * 0.35; f.pos.z += Math.cos(H.face) * 0.35;
    }
    K.emit('hit', { f, dmg });
  }
  // TAKEDOWN: a posture-broken grunt goes down at once; a boss loses 18% of its life (deathblow)
  function deathblow(f, at) {
    const g = K.groundAt(f.pos);
    K.sfx('deathblow', f.pos);
    S.hitstop = Math.max(S.hitstop, 0.16); S.slow = 0.3; S.slowT = 0.7; K.flash(0.55); K.cam.punch = 1.4; K.cam.shake = 1;
    K.fx.flash(at, 2.4, 0.28); K.fx.sparks(at, null, 40, 7, 6);
    if (f.ink) K.fx.neon(at, 40, 1.4);
    K.fx.ink(at, 20, 1.2, 1); K.fx.splat(f.pos, 3.4, g); K.fx.blast(f.pos, 1.2); K.fx.dust(K.at(f.pos.x, g, f.pos.z, g), 12, 1.4);
    f.posture = 0; f.flinch = 1;
    if (!f.boss) {
      K.toast('TAKEDOWN', true);
      K.stats.takedowns++;
      f.hp = 0; knockOut(f, 'takedown');
      K.emit('takedown', f);
      return;
    }
    K.toast('DEATHBLOW', true);
    f.hp -= Math.round(f.maxHp * 0.18);
    if (f.hp <= 0) { if (f.phase2Pending) f.hp = 1; else { f.hp = 0; knockOut(f, 'deathblow'); return; } }
    f.state = 'recover'; f.t = 0; if (f.a) f.a.play('idle', { fade: 0.6 });
  }
  // hp 0: knocked out. Grunts fall and sit up dazed; a boss's fall is the finisher.
  function knockOut(f, how) {
    if (f.downed) return;
    f.downed = true; f.state = 'down'; f.t = 0; f.atk = null; f.queue = []; f.air = 0; f.nextHit = null; f.token = false;
    f.hp = 0;
    if (f.a) f.a.play('lib:knock', { loop: false, fade: 0.12, restart: true });
    K.sfx('thud', f.pos);
    const g = K.groundAt(f.pos);
    K.fx.dust(K.at(f.pos.x, g, f.pos.z, g), 10, 1.2);
    if (K.lock === f) K.tokens.retarget();
    K.emit('down', f);
    if (f.boss) {
      S.slow = 0.3; S.slowT = 1.4; K.flash(0.5);
      K.emit('finisher', f);
      K.bosses.downed(f);
    }
  }
  return { receive, hurtHero, heroDown, heroHitCheck, knockOut, deathblow };
}
