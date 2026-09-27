// js/story/combat/hero.js : S.hero, the player on foot (COMBAT spec 1). It is a Fighter (S.combat.player)
// with the crew's perks and the player's moves: game.js updatePlayer(), tryAct() and startPlayerAttack()
// ported to the story. Camera-relative moves, a roll on dodge and a sprint while dodge is held, crouch in
// stealth, the canteen, lock-on and soft aim, and E for the nearest interact option (held when it asks).
// It walks on S.world.surface, is pushed out of S.world.colliders, and puts a soft circle in
// S.vehicles.people so traffic can ask it to dive clear.
import * as THREE from 'three';
import { CREW_IDS, HERO_MODES, PHASE_ORDER } from '../types.js';
import { TUNE } from '../../moves.js';
import { makeFighter, clamp, damp, angDiff, angleTo, flatDist } from './fighter.js';
import { WEAPONS, moveOf, crewStats, SIP, ROLL } from './playermoves.js';

// the procedural stride, when the body has one (A2)
const mv = (a, speed, o) => { if (a && a.move) a.move(speed, o); };
const DODGE_END = 0.5; // after this the roll can be cancelled into a move or an action
const BUSY = new Set(['downed', 'grabbed', 'down', 'hit', 'broken', 'heal', 'call', 'takedown', 'stunned']);

export function createHero(K) {
  const { S } = K;
  const I = () => S.input;
  const base = makeFighter({ id: 'hero', team: 'crew', radius: 0.4, hp: 100, alert: true });
  const H = S.hero = Object.assign(base, {
    mode: 'foot', actor: null, body: null, crouch: false, hp: 100, maxHp: 100, st: 100, stDelay: 0,
    canteen: TUNE.gourds, canteenMax: TUNE.gourds, weapon: 'fists', weapons: ['fists'], uses: {},
    stats: crewStats(2), state: 'move', parryT: -9, parryPresses: [], iframe: false, dodgeDir: new THREE.Vector3(),
    combo: null, comboT: -9, counterT: -9, healed: false, speedNow: 0, sprint: false, hold: 0, hold01: 0, holdLock: false,
    group: 'crew', def: { id: 'hero' },
    setBody,
    place(x, z, yaw, y) {
      const hint = y ?? (Number.isFinite(H.pos.y) ? H.pos.y + 1 : Infinity);
      H.pos.set(x, S.world.surface(x, z, hint), z);
      if (yaw != null) { H.face = yaw; H.yaw = yaw; K.cam.snapTo(yaw); }
      H.vel.set(0, 0, 0); H.speedNow = 0;
      if (H.resetGround) H.resetGround();
      sync(0);
    },
    setMode(m) {
      if (!HERO_MODES.includes(m)) throw new Error(`S.hero.setMode: unknown mode '${m}'`);
      const was = H.mode; H.mode = m;
      if (m === 'foot' && was !== 'foot') { H.state = H.hp > 0 ? 'move' : 'downed'; H.t = 0; H.atk = null; H.vel.set(0, 0, 0); if (H.actor) { H.actor.visible = true; if (H.hp > 0) H.actor.play('idle', { fade: 0.2 }); } K.cam.snapTo(H.face); }
      if (m !== 'foot') { H.crouch = false; H.sprint = false; if (H.state === 'attack' || H.state === 'guard' || H.state === 'dodge') { H.state = 'move'; H.atk = null; } }
    },
  });
  // the Fighter's body is the hero's actor; down is hp at 0 (the fight's knocked-out flag, never dead)
  delete H.a; delete H.downed;
  Object.defineProperties(H, {
    a: { get: () => H.actor, enumerable: true, configurable: true },
    down: { get: () => H.hp <= 0, enumerable: true, configurable: true },
    downed: { get: () => H.hp <= 0, enumerable: true, configurable: true },
  });

  /* ---------------- the body ---------------- */
  function setBody(crewId) {
    if (!CREW_IDS.includes(crewId)) throw new Error(`S.hero.setBody: unknown crew id '${crewId}'`);
    if (H.body === crewId && H.actor && !H.actor.disposed) return;
    const vis = H.actor ? H.actor.visible : true;
    if (H.actor) { K.dropWeaponProp(); S.cast.despawn(H.actor); }
    H.body = crewId; H.def = { id: crewId };
    const a = H.actor = S.cast.spawn(crewId, { pos: { x: H.pos.x, y: H.pos.y, z: H.pos.z }, yaw: H.face });
    a.useCdt = true;
    a.visible = vis;
    // the crew's perk (CREW in moves.js); life keeps its share of the bar
    const k = H.maxHp > 0 ? H.hp / H.maxHp : 1;
    H.stats = crewStats(CREW_IDS.indexOf(crewId));
    H.maxHp = H.stats.maxHp; H.hp = Math.round(H.maxHp * clamp(k, 0, 1));
    K.drawWeapon(false);
  }
  function sync(dt) {
    const a = H.actor;
    if (a && H.mode === 'foot') {
      H.yaw = dt ? H.yaw + angDiff(H.yaw, H.face) * Math.min(1, dt * (H.state === 'dodge' ? 34 : 24)) : H.face;
      a.root.position.set(H.pos.x, H.state === 'grabbed' ? a.root.position.y : H.pos.y, H.pos.z);
      a.root.rotation.set(0, H.yaw, 0);
    }
    if (H.mode === 'foot') S.focus.copy(H.pos);
  }
  K.syncHero = sync;

  /* ---------------- actions ---------------- */
  const buf = { light: -9, heavy: -9, dodge: -9, canteen: -9, parry: -9 };
  let dodgeHeldT = 0;
  const fresh = (k) => K.ct - buf[k] < 0.32;
  const camBasis = () => { const y = K.cam.yaw; return [Math.sin(y), Math.cos(y), -Math.cos(y), Math.sin(y)]; };
  const spend = (n) => { H.st -= n; H.stDelay = 0.65; };
  const want = new THREE.Vector3();

  function startAttack(name) {
    const w = WEAPONS[H.weapon] || WEAPONS.fists;
    if (w.heavyOnly && name !== 'deathblow') name = 'heavy';
    const spec = moveOf(H.weapon, name);
    H.state = 'attack'; H.t = 0; H.iframe = false; H.atk = { name, spec, cleave: new Set(), landed: 0 }; H.hitDone = false; H.sndDone = false;
    spend(spec.cost);
    K.drawWeapon(true);
    if (H.actor) H.actor.play(spec.clip, { loop: false, speed: spec.speed, fade: 0.1, restart: true, at: spec.at || 0 });
    const lock = K.lock && !K.lock.downed ? K.lock : null;
    const broken = K.tokens.brokenNear(H.pos, 5);
    if (name === 'deathblow' && broken) H.face = angleTo(H.pos, broken.pos);
    else if (lock) H.face = angleTo(H.pos, lock.pos);
    else {
      const m = I().axis('move');
      if (m.x * m.x + m.y * m.y > 0.01) { const [fx, fz, rx, rz] = camBasis(); H.face = Math.atan2(fx * m.y + rx * m.x, fz * m.y + rz * m.x); }
      // soft aim: the nearest enemy within 3 m and 60 degrees of where the swing goes
      const t = K.tokens.softAim(H.pos, H.face, 3, Math.PI / 3);
      if (t) H.face = angleTo(H.pos, t.pos);
    }
    K.emit('swing', { name });
  }
  function tryAct() {
    const p = H, now = K.ct;
    const ct = p.state === 'attack' ? (p.atk.spec.from || 0) + (H.actor ? H.actor.t : 0) : 0;
    const canCancel = p.state === 'move' || p.state === 'guard' || p.state === 'dodge' || (p.state === 'attack' && ct >= p.atk.spec.cancel);
    if (fresh('dodge') && (canCancel || (p.state === 'attack' && ct > p.atk.spec.hit[1] + 0.05)) && p.st > 4) {
      buf.dodge = -9;
      const [fx, fz, rx, rz] = camBasis(), m = I().axis('move');
      let dx = fx * m.y + rx * m.x, dz = fz * m.y + rz * m.x;
      if (dx * dx + dz * dz < 0.01) { dx = -Math.sin(p.face); dz = -Math.cos(p.face); }
      roll(dx, dz);
      return;
    }
    if (fresh('parry') && (p.state === 'move' || p.state === 'guard' || p.state === 'dodge' || (p.state === 'attack' && (ct < p.atk.spec.hit[0] || ct > p.atk.spec.hit[1])))) {
      buf.parry = -9;
      p.parryPresses = p.parryPresses.filter((t) => now - t < 1.0); p.parryPresses.push(now);
      p.parryT = now; p.state = 'guard'; p.t = 0; p.atk = null;
      if (H.actor) H.actor.play('ronin:guard', { speed: 0.35, fade: 0.06 });
    }
    if (!canCancel) return;
    if (fresh('canteen') && p.state !== 'attack') {
      buf.canteen = -9;
      if (p.canteen > 0 && p.hp < p.maxHp) {
        p.canteen--; p.state = 'heal'; p.t = 0; p.healed = false; K.sfx('drink', p.pos);
        if (H.actor) H.actor.play(SIP.clip, { loop: false, speed: SIP.speed, fade: 0.15, restart: true });
        return;
      }
      K.toast(p.canteen > 0 ? 'LIFE IS FULL' : 'THE CANTEEN IS EMPTY');
    }
    const broken = K.tokens.brokenNear(p.pos, 5);
    if (fresh('light') && p.st > 0) {
      buf.light = -9;
      if (broken) { startAttack('deathblow'); return; }
      let name = 'l1';
      const set = (WEAPONS[H.weapon] || WEAPONS.fists).set;
      if (H.weapon === 'fists' && now - p.counterT < 0.7) name = 'counter';
      else if (p.state === 'attack' && p.atk.spec.next && p.atk.name !== 'heavy') name = p.atk.spec.next;
      else if (now - p.comboT < 0.45 && p.combo && set[p.combo]) name = set[p.combo].next || 'l1';
      p.combo = name === 'counter' ? null : name; p.comboT = now; p.counterT = -9;
      startAttack(name); return;
    }
    if (fresh('heavy') && p.st > 0) {
      buf.heavy = -9;
      if (broken) { startAttack('deathblow'); return; }
      p.combo = null; startAttack('heavy');
    }
  }
  function roll(dx, dz) {
    const p = H, l = Math.hypot(dx, dz) || 1;
    p.dodgeDir.set(dx / l, 0, dz / l); p.face = Math.atan2(dx, dz);
    p.state = 'dodge'; p.t = 0; spend(p.stats.dodgeCost); p.atk = null;
    if (H.actor) H.actor.play(ROLL.clip, { loop: false, speed: ROLL.speed, fade: 0.05, restart: true });
    K.sfx('dodge', p.pos); const g = K.groundAt(p.pos); K.fx.dust(K.at(p.pos.x, g, p.pos.z, g), 2, 0.6);
  }
  // traffic asks the hero to dive clear: a roll away from the path (i-frames), if the hero can move
  H.dive = (dir) => {
    if (H.mode !== 'foot' || BUSY.has(H.state) || H.state === 'attack' || S.lockControl || (S.cine && S.cine.active)) return false;
    if (H.state !== 'dodge') roll(dir.x, dir.z);
    return true;
  };

  /* ---------------- the controller (updatePlayer) ---------------- */
  function update(dt, rdt) {
    const p = H, In = I();
    if (H.mode !== 'foot' || !S.world.visible || !H.actor) return;
    if ((S.cine && S.cine.active) || H.scripted) { // a cine or a script moves the body: follow it
      H.pos.copy(H.actor.root.position); H.face = H.yaw = H.actor.root.rotation.y; S.focus.copy(H.pos); return;
    }
    for (const k of Object.keys(buf)) if (In.pressed(k)) buf[k] = K.ct;
    const parryHeld = In.held('parry');
    const lockC = !S.lockControl;
    let m = lockC ? In.axis('move') : { x: 0, y: 0 };
    const mm = Math.hypot(m.x, m.y); if (mm > 1) m = { x: m.x / mm, y: m.y / mm };
    const [fx, fz, rx, rz] = camBasis();
    want.set(fx * m.y + rx * m.x, 0, fz * m.y + rz * m.x);
    const moving = m.x * m.x + m.y * m.y > 0.04;
    // interact (E): the nearest option; a held option fills its ring first
    interact(In, rdt);
    // crouch (stealth only)
    if (In.pressed('crouch')) { In.consume('crouch'); if (K.stealth.canCrouch()) H.crouch = !H.crouch; }
    if (H.crouch && !K.stealth.canCrouch()) H.crouch = false;
    dodgeHeldT = In.held('dodge') ? dodgeHeldT + rdt : 0;
    const busy = BUSY.has(p.state) || (p.state === 'deflect' && p.t < 0.12) || (p.state === 'dodge' && p.t < DODGE_END);
    if (!busy && lockC) { tryAct(); K.bearcall.tryCall(); }
    if (In.pressed('lock')) { In.consume('lock'); K.tokens.toggleLock(); }
    p.t += dt;
    let speed = 0;
    const lock = K.lock && !K.lock.downed ? K.lock : null;
    const toLock = lock ? angleTo(p.pos, lock.pos) : p.face;
    const fight = K.fighting();
    const a = H.actor;
    switch (p.state) {
      case 'move': {
        H.sprint = !H.crouch && moving && dodgeHeldT > 0.3 && p.st > 0;
        speed = want.length() * p.stats.speed * (H.crouch ? 0.4 : H.sprint ? 1.55 : 1);
        if (speed > 0.1) p.face += angDiff(p.face, Math.atan2(want.x, want.z)) * Math.min(1, dt * 16);
        else if (lock) p.face += angDiff(p.face, toLock) * Math.min(1, dt * 10);
        const out = p.t < 0.2 ? 0.24 : 0.18;
        a.play(H.crouch ? 'lib:crouch' : fight ? (H.weapon === 'fists' ? 'gabe:idle' : 'ronin:idle') : 'idle', { fade: out + 0.06 });
        mv(a, p.speedNow, { crouch: H.crouch ? 1 : 0, upper: !fight });
        if (H.sprint) { p.st = Math.max(0, p.st - 6 * dt); p.stDelay = 0.3; }
        break;
      }
      case 'guard':
        speed = want.length() * p.stats.speed * 0.4;
        p.face += angDiff(p.face, lock ? toLock : K.tokens.nearestFacing(p) ?? p.face) * Math.min(1, dt * 10);
        mv(a, p.speedNow, { upper: false });
        if (!parryHeld && p.t > 0.12) { p.state = 'move'; p.t = 0; }
        break;
      case 'deflect':
        mv(a, 0);
        if (p.t > 0.34) { p.state = parryHeld ? 'guard' : 'move'; p.t = 0.2; if (p.state === 'guard') a.play('ronin:guard', { speed: 0.35, fade: 0.1 }); }
        break;
      case 'attack': {
        mv(a, 0);
        const s = p.atk.spec, ct = (s.from || 0) + a.t;
        if (s.lunge && ct >= s.lunge[0] && ct <= s.lunge[1]) {
          const tgt = lock || K.tokens.softAim(p.pos, p.face, 4, 0.8);
          const d = tgt ? flatDist(p.pos, tgt.pos) - tgt.radius : 9, k = (ct - s.lunge[0]) / (s.lunge[1] - s.lunge[0]), ease = Math.sin(Math.PI * k) * 1.57;
          if (d > 1.2) { p.pos.x += Math.sin(p.face) * s.lunge[2] * ease * dt; p.pos.z += Math.cos(p.face) * s.lunge[2] * ease * dt; }
        }
        if (ct < s.hit[0] && (lock || p.atk.name === 'deathblow')) { const t = p.atk.name === 'deathblow' ? K.tokens.brokenNear(p.pos, 5) || lock : lock; if (t) p.face += angDiff(p.face, angleTo(p.pos, t.pos)) * Math.min(1, dt * 10); }
        if (!p.sndDone && ct >= s.hit[0] - 0.06) { p.sndDone = true; K.sfx(s.snd, p.pos); }
        if (ct >= s.hit[0] && ct <= s.hit[1]) K.resolve.heroHitCheck();
        const end = s.end != null ? ct >= s.end : a.done;
        if (end || (moving && ct > s.hit[1] + 0.12)) { p.state = 'move'; p.t = 0; p.comboT = K.ct; p.atk = null; }
        break;
      }
      case 'dodge':
        mv(a, 0);
        p.iframe = p.t > 0.02 && p.t < TUNE.iframe + p.stats.iframeBonus;
        p.pos.addScaledVector(p.dodgeDir, (p.t < 0.4 ? 7.6 : 2.5) * dt);
        if (p.t >= ROLL.end || (p.t >= DODGE_END && moving)) { p.state = 'move'; p.t = 0; p.iframe = false; p.vel.copy(p.dodgeDir).multiplyScalar(p.stats.speed * 0.8); }
        break;
      case 'hit': mv(a, 0); if (p.t > 0.5) { p.state = 'move'; p.t = 0; } break;
      case 'broken': mv(a, 0); if (p.t > 1.1) { p.state = 'move'; p.t = 0; } break;
      case 'stunned': mv(a, 0); if (p.t > 0.9) { p.state = 'move'; p.t = 0; } break;
      case 'down': mv(a, 0); if (p.t > 1.1 && a.cur === 'ronin:down') a.play('idle', { fade: 0.5 }); if (p.t > 1.7) { p.state = 'move'; p.t = 0; } break;
      case 'heal':
        mv(a, 0);
        speed = want.length() * 1.2;
        if (!p.healed && p.t > SIP.at) { p.healed = true; p.hp = Math.min(p.maxHp, p.hp + SIP.heal); K.toast('+ LIFE'); }
        if (p.t > SIP.dur) { p.state = 'move'; p.t = 0; }
        break;
      case 'call': mv(a, 0); K.bearcall.stepHero(dt); break;
      case 'takedown': mv(a, 0); if (p.t > 1.1) { p.state = 'move'; p.t = 0; } break;
      case 'downed':
        mv(a, 0);
        if (p.t > 1.5 && a.cur === 'lib:knock') a.play('lib:dazed', { fade: 0.4 });
        // a checkpoint or a script gave life back: stand up
        if (H.hp > 0) { p.state = 'move'; p.t = 0; a.play('idle', { fade: 0.4 }); K.look().base.grey = 0; }
        else K.look().base.grey = Math.min(0.8, p.t * 0.5);
        break;
      case 'grabbed': mv(a, 0); if (p.t > 4.5) { p.state = 'move'; p.t = 0; } break; // never held for good
    }
    if (p.state === 'move' || p.state === 'guard' || p.state === 'heal') {
      const k = speed * speed > p.vel.x * p.vel.x + p.vel.z * p.vel.z ? 20 : 26;
      const vx = want.x * speed / Math.max(1e-6, want.length() || 1), vz = want.z * speed / Math.max(1e-6, want.length() || 1);
      p.vel.x = damp(p.vel.x, speed > 0 ? vx : 0, k, dt); p.vel.z = damp(p.vel.z, speed > 0 ? vz : 0, k, dt);
      p.pos.addScaledVector(p.vel, dt);
      p.speedNow = Math.hypot(p.vel.x, p.vel.z);
    } else { p.vel.set(0, 0, 0); p.speedNow = 0; }
    p.stDelay -= dt;
    if (p.stDelay <= 0) p.st = Math.min(100, p.st + (p.state === 'guard' ? 18 : 34) * dt);
    if (p.state !== 'grabbed') ground(dt);
    sync(dt);
    // footsteps
    if (p.speedNow > 0.8 && p.state === 'move') { stepT -= dt * (p.speedNow / 2.2); if (stepT <= 0) { stepT = 0.5; S.audio.sfx('step', { at: p.pos, run: p.speedNow > 5, gain: H.crouch ? 0.4 : 1 }); } }
  }
  let stepT = 0, lastX = 0, lastZ = 0, lastY = 0;
  // on the ground, out of walls, off cliffs too steep to walk, inside the world
  function ground(dt) {
    const p = H.pos, W = S.world;
    const half = W.HALF - 2;
    p.x = clamp(p.x, -half, half); p.z = clamp(p.z, -half, half);
    const y0 = Number.isFinite(p.y) ? p.y : W.surface(p.x, p.z);
    W.colliders.resolveCircle(p, 0.4, y0);
    let y = W.surface(p.x, p.z, y0 + 0.6);
    // too steep: more than 1.25 m up per metre across, step back along what is walkable
    const dx = p.x - lastX, dz = p.z - lastZ, run = Math.hypot(dx, dz);
    if (run > 1e-4 && y - lastY > Math.max(0.45, run * 1.25) && run < 3) {
      const yx = W.surface(p.x, lastZ, y0 + 0.6), yz = W.surface(lastX, p.z, y0 + 0.6);
      if (yx - lastY <= Math.max(0.45, Math.abs(dx) * 1.25)) { p.z = lastZ; y = yx; }
      else if (yz - lastY <= Math.max(0.45, Math.abs(dz) * 1.25)) { p.x = lastX; y = yz; }
      else { p.x = lastX; p.z = lastZ; y = lastY; }
    }
    // deep water: no swimming in the story
    const wt = W.water(p.x, p.z);
    if (wt && wt.depth > 1.1) { p.x = lastX; p.z = lastZ; y = lastY; }
    p.y = y; lastX = p.x; lastZ = p.z; lastY = y;
  }
  H.resetGround = () => { lastX = H.pos.x; lastZ = H.pos.z; lastY = H.pos.y; };

  // E: act now, or hold for a held option (the prompt ring shows hold01)
  function interact(In, rdt) {
    const cur = S.interact.current;
    if (!cur || BUSY.has(H.state) || H.state === 'attack') { H.hold = 0; H.hold01 = 0; if (!In.held('use')) H.holdLock = false; return; }
    if (!(cur.hold > 0)) {
      H.hold = 0; H.hold01 = 0;
      if (In.pressed('use')) { In.consume('use', 'exit'); if (cur.act) cur.act(); }
      return;
    }
    if (In.pressed('use')) { In.consume('use', 'exit'); H.holdLock = false; }
    if (In.held('use') && !H.holdLock) {
      if (H.holdId !== cur.id) { H.holdId = cur.id; H.hold = 0; }
      H.hold += rdt; H.hold01 = Math.min(1, H.hold / cur.hold);
      if (H.hold >= cur.hold) { H.hold = 0; H.hold01 = 0; H.holdLock = true; if (cur.act) cur.act(); }
    } else { H.hold = Math.max(0, H.hold - rdt * 2); H.hold01 = cur.hold ? H.hold / cur.hold : 0; if (!In.held('use')) H.holdLock = false; }
  }

  // soft circle for traffic (VEHICLES reads S.vehicles.people in 'physics')
  const circle = { x: 0, z: 0, r: 0.45, id: 'hero', hero: true, dive: (d) => H.dive(d) };
  function people() {
    if (H.mode !== 'foot' || !S.world.visible || !S.vehicles || !S.vehicles.people) return;
    circle.x = H.pos.x; circle.z = H.pos.z; S.vehicles.people.push(circle);
  }
  function reset() {
    H.state = 'move'; H.t = 0; H.atk = null; H.iframe = false; H.crouch = false; H.sprint = false; H.hold = 0; H.hold01 = 0; H.scripted = false;
    H.hp = H.maxHp; H.st = 100; H.stDelay = 0; H.vel.set(0, 0, 0); H.speedNow = 0; H.parryPresses = [];
    for (const k of Object.keys(buf)) buf[k] = -9;
    if (S.look && S.look.base) S.look.base.grey = 0;
  }
  S.register('control', (cdt, rdt) => update(cdt, rdt), PHASE_ORDER.control.hero);
  S.register('ai', () => people(), 10);
  return { H, update, reset, startAttack, roll, sync };
}
