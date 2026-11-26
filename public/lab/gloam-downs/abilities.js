// Gloam Downs: the lamplighter's abilities (gloam-downs-growth design.md "2. Abilities"). Two slots, each with one ability or nothing and
// its own cooldown on the play clock; the nine abilities and what each does; the ability lamps that lie on the ground and the swap; the
// cooldown panes (Hot, Smoked, Storm and Tallow glass) and the Gloam colour; bright abilities. No DOM, so the page, the Node tests and
// the bot use it as it is. makeRunner (run.js) calls makeAbilities(R) when the page or the bot passes `abilities: makeAbilities`.
// Every time here is in play steps of 1/60 s. An ability's hit counts as a relic hit for the combo, takes 2 steps of hit stop (inside
// the cap), is not blade damage (Edge and Keen edge do not raise it), grows with its colour and, when bright, by 25%, and rounds once.
import { ABILITIES, ABILITY_IDS, BRIGHT, DROPS } from './growth.js';
import { colourPower, coolShare, paneOf, kindledOf } from './run.js';
import { emit } from './bus.js';
import { sees } from './moves.js';
import { mulberry, hash2 } from '../kit/rng.js';
import { statusHit, isFoe, tickHit, heavyOf, STATES } from './status.js';

const S = sec => Math.round(sec * 60);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export const abilityOf = id => ABILITIES.find(a => a.id === id) || null;
// the push speed that carries a foe `far` metres in n steps when it gains AB.pullGain m/s a step: the sum of min(k·gain, v)/60 is far
export function pullSpeed(far, n) {
  let lo = 0, hi = 200;
  for (let i = 0; i < 40; i++) { const v = (lo + hi) / 2; let d = 0; for (let k = 1; k <= n; k++) d += Math.min(k * AB.pullGain, v) / 60; if (d < far) lo = v; else hi = v; }
  return hi;
}
/* the rules that are not in growth.js's table: the input buffer, the hit stop of an ability's hit, the soft aim's reach and arc, a
   snare's life, a bomb's burn ticks, Hot glass's window and what it cools, Smoked glass, Storm glass and Tallow glass, the touch of a
   lamp, and the steps a press waits for a cooldown (none: a press while cooling only says no) */
export const AB = {
  buffer: S(0.15), stop: 2, aim: 70 * Math.PI / 180, snareLife: S(8), burnEvery: S(1), burnTicks: 2,
  hot: { within: S(3), cool: S(2) }, smoked: 0.85, storm: S(1), tallow: S(3), touch: 1.0, swapTouch: 1.0,
  // a pitch pool's burn doubled once by a burn from the bomb or the blade
  pitchTwice: 2,
  // the Crook line's pull: its play steps, and the walker's gain of speed a step (400 m/s², foes.js physics)
  pullN: 12, pullGain: 400 / 60,
  // what can start: not while the lamplighter drinks, rolls, is hurt or plunges; Smoke step and Bell guard only on the ground
  busy: ['drink', 'roll', 'hurt', 'hang', 'plunge', 'land', 'dash'], ground: ['step', 'guard', 'post', 'slick', 'tacks'],
  /* the ten of gloam-downs-hub design.md "New abilities": each tell's length before its effect (Wick lash's line, Shard fan's shards,
     Bell toll's ring, the moths gathering), a shard's half width, a tack's touch, how often a pool or the moths read the foes, a
     blink's play steps, and the blink back to the post lamp */
  tell: { lash: S(0.15), fan: S(0.12), toll: S(0.3), swarm: S(0.3) }, shard: 0.3, tack: 0.35, every: S(0.5), blinkN: S(0.1), postN: S(0.15)
};
// the cooldown of an ability in play steps: its seconds, Gloam's share (never under 60%), and Smoked glass's 15% off
export const coolOf = (rs, id) => {
  const A = abilityOf(id);
  if (!A) return 0;
  return Math.max(1, Math.round(S(A.cool) * coolShare(rs.run) * (paneOf(rs, 'smoked') ? AB.smoked : 1)));
};
// the power of an ability: its colour's level and 25% more when bright
export const powerOf = (rs, slot) => (slot ? colourPower(rs.run, abilityOf(slot.id)?.colour) * (slot.bright ? BRIGHT.power : 1) : 1);
export const brightChance = rs => BRIGHT.base + BRIGHT.perKeen * (rs?.up?.keen | 0);
export const abilityChance = rs => DROPS.ability + DROPS.abilityPerKeen * (rs?.up?.keen | 0);

/* ---------------- the ability lamps ----------------
   An ability lamp lies on the ground (run.abilityLamps: { id, bright, x, y, z }) until it is touched or the place is left. A draw takes
   the run's next roll of the seed's `ability` stream: the id from the kindled abilities, and bright with 10% and 4% more a Keen eye
   level */
const abilityRoll = run => { run.abilityRolls = (run.abilityRolls | 0) + 1; return mulberry(hash2(run.seed | 0, run.abilityRolls, 0xab17)); };
export function drawAbility(rs, chance = 1) {
  const run = rs.run;
  if (!run) return null;
  const r = abilityRoll(run), roll = r(), left = kindledOf(rs, 'ability');
  if (roll >= chance || !left.length) return null;
  return { id: left[Math.floor(r() * left.length)], bright: r() < brightChance(rs) };
}
// an ability lamp on the ground: at `at`, the given one or a draw -> the lamp, or null
export function dropAbility(R, at = null, pick = null) {
  const run = R.rs.run;
  if (!run) return null;
  const a = pick ? { id: pick.id, bright: !!pick.bright } : drawAbility(R.rs, 1);
  if (!a || !ABILITY_IDS.includes(a.id)) return null;
  const s = R.fighter?.body.s, p = at || [s.x, s.y, s.z];
  // a lamp keeps the cooldown its ability had when it was swapped out (cool, full: play steps), and goes on cooling where it lies
  const lamp = { id: a.id, bright: a.bright, place: run.place, x: p[0], y: p[1], z: p[2], cool: Math.max(0, pick?.cool | 0), full: Math.max(1, pick?.full | 0) };
  (run.abilityLamps ||= []).push(lamp);
  return lamp;
}
// what the fight draws: each ability lamp, with its colour and name
export const groundAbilities = R => (R?.rs?.run?.abilityLamps || []).map(l => ({ ...l, colour: abilityOf(l.id)?.colour || 'gloam', name: abilityOf(l.id)?.name || l.id }));

/* ---------------- the slots ----------------
   makeAbilities(R) -> { step(act, camYaw, ev), view(), turn(from, ev) (Bell guard), nearMiss(), drink(), foeOut(), effects }. The slots
   are rs.run.abilities ([{ id, bright } | null, same]). The cooldowns live here and are copied to rs.run.abilityLive on every step, so
   the next place's runner (Walk on, Back to the start) takes them on as they were, with a Moth wisp still flying; a page reload starts
   them ready (abilityLive is not saved). A snare, a pool of pitch or a bomb in flight stays in the place it was laid in */
export function makeAbilities(R) {
  const rs = R.rs, clock = R.clock;
  const A = { cool: [0, 0], full: [1, 1], buf: [0, 0], was: [false, false], effects: [], lastUse: -1e9, lastSlot: -1, guard: null, onLamp: null, swapNote: null, shown: [null, null], move: null };
  const live0 = rs.run?.abilityLive;
  if (live0) {
    for (let i = 0; i < 2; i++) { A.cool[i] = Math.max(0, live0.cool?.[i] | 0); A.full[i] = Math.max(1, live0.full?.[i] | 0, A.cool[i]); }
    if (live0.moth && live0.moth.life > live0.moth.t) A.effects.push({ ...live0.moth, target: null });
  }
  const body = () => R.fighter.body, sOf = () => R.fighter.body.s;
  const slots = () => rs.run?.abilities || [null, null];
  const cue = (ev, name, more = {}) => { const c = { cue: name, step: clock.step, play: clock.play, ...more }; R.log.push(c); ev.push({ type: 'cue', ...c, logged: true }); };
  const ground = (x, z, y) => { const g = R.fighter.walk.support(x, z, y + 1.2); return g === null ? y : g; };
  /* a hit by an ability: its power, Ember glass on a burning foe, rounded once by the target. how.interrupt: the hit flinches a light
     or medium foe and cancels its wind-up (Lantern bomb, Moth wisp, Crook line, Ember snare); a burn or pitch tick does not. -> the
     damage, or false */
  function hurtFoe(t, raw, id, ev, how = {}) {
    if (!t || !t.alive) return false;
    const ember = paneOf(rs, 'ember') && t.status?.burn > 0 ? 0.2 : 0;
    const dmg = t.hit(raw * (1 + ember), { from: [sOf().x, sOf().z], push: 0, knock: 0, kind: 'ability', ability: id, ...how });
    if (dmg === false) return false;
    ev.push({ type: 'hit', kind: 'relic', ability: id, target: t, dmg }, { type: 'stop', n: AB.stop });
    cue(ev, 'hit', { hit: 'ability', ability: id, on: [t.type || 'post'], stop: AB.stop });
    return dmg;
  }
  const live = () => R.targets().filter(t => t.alive);
  const dist = (t, p) => Math.hypot(t.x - p[0], t.z - p[2]);
  // the soft aim: the nearest target in front (70°) within range that the lamplighter sees
  function aim(range) {
    const s = sOf();
    let best = null, bd = Infinity;
    for (const t of live()) {
      const d = Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0);
      if (d > range || Math.abs(t.y - s.y) > 2.5) continue;
      if (Math.abs(wrap(Math.atan2(t.x - s.x, t.z - s.z) - s.yaw)) > AB.aim && d > 1.5) continue;
      if (!sees(R.fighter.walk, s, t)) continue;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  // where a quick move along (ux, uz) of up to len metres can end: on floor no more than a step up or 3 m down, with no wall in between
  function reach(ux, uz, len) {
    const s = sOf(), walk = R.fighter.walk;
    let at = null;
    for (let d = 0.25; d <= len + 1e-6; d += 0.25) {
      const x = s.x + ux * d, z = s.z + uz * d, y = walk.support(x, z, s.y + 0.6);
      if (y === null || y < s.y - 3 || y > s.y + 0.6) break;
      if (!sees(walk, s, { x, y, z })) break;
      at = [x, y, z];
    }
    return at;
  }
  function dirOf(act, camYaw) {
    const mx = act.mx || 0, mz = act.mz || 0, m = Math.hypot(mx, mz), s = sOf();
    if (m < 0.2) return [Math.sin(s.yaw), Math.cos(s.yaw)];
    const wx = Math.cos(camYaw) * (mx / m) - Math.sin(camYaw) * (mz / m), wz = -Math.sin(camYaw) * (mx / m) - Math.cos(camYaw) * (mz / m);
    return [wx, wz];
  }
  // each ability's start: -> true when it started (a cooldown begins), false when it cannot (no target for the Crook line)
  const START = {
    bomb(a, p, ev) {
      const s = sOf(), t = aim(8);
      const at = t ? [t.x, t.y, t.z] : (() => { const x = s.x + Math.sin(s.yaw) * a.range, z = s.z + Math.cos(s.yaw) * a.range; return [x, ground(x, z, s.y), z]; })();
      A.effects.push({ kind: 'bomb', at, t: 0, fuse: S(a.fuse), dmg: a.dmg * p, r: a.r, burn: (a.burn / AB.burnTicks) * p });
      ev.push({ type: 'abilityFx', kind: 'throw', id: 'bomb', from: [s.x, s.y + 1, s.z], to: at }, { type: 'abilityFx', kind: 'tell', id: 'bomb', at, r: a.r, life: a.fuse });
      return true;
    },
    step(a, p, ev, act, camYaw) {
      const s = sOf(), [ux, uz] = dirOf(act, camYaw), to = reach(ux, uz, a.dist);
      const from = [s.x, s.y, s.z];
      // the move takes 0.12 s: the body goes along the way reach() found, a share each play step, so a blow in it is judged where the
      // lamplighter is on the way
      if (to) A.move = { from, to, t: 0, n: Math.max(1, S(a.time)), yaw: s.yaw };
      R.fighter.f.smoke = S(a.safe);
      ev.push({ type: 'abilityFx', kind: 'puff', id: 'step', at: from }, { type: 'abilityFx', kind: 'puff', id: 'step', at: to || from });
      return true;
    },
    snare(a, p, ev) {
      const s = sOf(), at = [s.x, ground(s.x, s.z, s.y), s.z];
      A.effects.push({ kind: 'snare', at, t: 0, life: AB.snareLife, dmg: a.dmg * p, r: a.r, hold: S(a.hold), slow: a.slow, slowed: new Set() });
      return true;
    },
    moth(a, p) {
      A.effects.push({ kind: 'moth', t: 0, life: S(a.life), every: S(a.every), dmg: a.dmg * p, range: a.range, next: S(a.every), target: null });
      return true;
    },
    crook(a, p, ev) {
      const t = aim(a.range);
      if (!t) return false;
      const s = sOf();
      A.effects.push({ kind: 'crook', t: 0, tell: S(0.15), target: t, dmg: a.dmg * p, to: a.to });
      ev.push({ type: 'abilityFx', kind: 'line', id: 'crook', a: [s.x, s.y + 1, s.z], b: [t.x, t.y + (t.T?.chest ?? 1), t.z], life: 0.15 });
      return true;
    },
    rime(a, p, ev) {
      const s = sOf(), arc = (a.arc * Math.PI) / 360;
      let n = 0;
      for (const t of live()) {
        const d = Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0);
        if (d > a.r || Math.abs(t.y - s.y) > 2 || Math.abs(wrap(Math.atan2(t.x - s.x, t.z - s.z) - s.yaw)) > arc) continue;
        if (statusHit(t, 'slow', Math.round(S(a.hold) * p), { k: a.slow })) n++;
      }
      ev.push({ type: 'abilityFx', kind: 'cone', id: 'rime', at: [s.x, s.y, s.z], yaw: s.yaw, r: a.r, arc: a.arc, hit: n });
      return true;
    },
    flare(a, p, ev) {
      const s = sOf();
      A.effects.push({ kind: 'flare', t: 0, grow: S(a.grow), r: a.r, stun: Math.round(S(a.stun) * p) });
      ev.push({ type: 'abilityFx', kind: 'core', id: 'flare', at: [s.x, s.y + 1, s.z], life: a.grow });
      return true;
    },
    pitch(a, p) {
      const s = sOf();
      A.effects.push({ kind: 'pitch', at: [s.x, ground(s.x, s.z, s.y), s.z], t: 0, life: S(a.life), start: S(0.3), every: S(a.every), r: a.r, dmg: a.dmg * p, twice: new Set() });
      return true;
    },
    guard(a, p) {
      A.guard = { t: 0, n: S(a.time), back: a.back * p };
      return true;
    },
    // Wick lash: a 5 m line, 0.5 m wide, ahead (at the soft aim's foe when there is one): 14 to each foe on it and 3 s of burn
    lash(a, p, ev) {
      const s = sOf(), t = aim(a.range + 1), yaw = t ? Math.atan2(t.x - s.x, t.z - s.z) : s.yaw;
      const ux = Math.sin(yaw), uz = Math.cos(yaw), len = a.range * wideOf();
      A.effects.push({ kind: 'lash', t: 0, tell: AB.tell.lash, at: [s.x, s.y, s.z], ux, uz, len, w: a.wide * wideOf(), dmg: a.dmg * p, burn: S(a.burn) });
      ev.push({ type: 'abilityFx', kind: 'line', id: 'lash', a: [s.x, s.y + 0.9, s.z], b: [s.x + ux * len, s.y + 0.9, s.z + uz * len], life: 0.15 });
      return true;
    },
    // Shard fan: 5 shards in a 50 degree fan, 6 m: each meets the first foe on its way for 6 and 1 Char
    fan(a, p, ev) {
      const s = sOf(), t = aim(a.range), yaw = t ? Math.atan2(t.x - s.x, t.z - s.z) : s.yaw, arc = (a.arc * Math.PI) / 180, range = a.range * wideOf();
      const rays = Array.from({ length: a.n }, (_, i) => yaw + (a.n > 1 ? (i / (a.n - 1) - 0.5) * arc : 0));
      A.effects.push({ kind: 'fan', t: 0, tell: AB.tell.fan, at: [s.x, s.y, s.z], rays, range, dmg: a.dmg * p, char: a.char });
      for (const r of rays) ev.push({ type: 'abilityFx', kind: 'line', id: 'fan', a: [s.x, s.y + 1, s.z], b: [s.x + Math.sin(r) * range, s.y + 1, s.z + Math.cos(r) * range], life: 0.12 });
      return true;
    },
    // Oil slick: a 3 m pool at the feet for 6 s that slows 40%; a burn that touches it lights it for 4 s, 5 every 0.5 s
    slick(a, p, ev) {
      const s = sOf(), at = [s.x, ground(s.x, s.z, s.y), s.z];
      A.effects.push({ kind: 'slick', at, t: 0, life: S(a.life), r: a.r * wideOf(), slow: 1 - a.slow, lit: 0, litFor: S(a.lit), every: S(a.every), dmg: a.dmg * p });
      ev.push({ type: 'abilityFx', kind: 'tell', id: 'slick', at, r: a.r, life: 0.4 });
      return true;
    },
    // Tack scatter: 8 tacks in a 2.5 m ring for 8 s; a foe on one takes 4, 1 Char and a 30% slow for 1 s, and the tack is spent
    tacks(a, p, ev) {
      const s = sOf(), r = a.r * wideOf(), pts = [];
      for (let i = 0; i < a.n; i++) { const g = (i / a.n) * Math.PI * 2 + s.yaw, x = s.x + Math.sin(g) * r, z = s.z + Math.cos(g) * r; pts.push([x, ground(x, z, s.y), z]); }
      A.effects.push({ kind: 'tacks', t: 0, life: S(a.life), pts, dmg: a.dmg * p, char: a.char, slow: 1 - a.slow, hold: S(a.hold) });
      ev.push({ type: 'abilityFx', kind: 'puff', id: 'tacks', at: [s.x, s.y, s.z] });
      return true;
    },
    // Bell toll: a ring rises for 0.3 s, then within 3.5 m light foes are stunned 0.8 s and heavy foes lose 40 poise
    toll(a, p, ev) {
      const s = sOf();
      A.effects.push({ kind: 'toll', t: 0, tell: AB.tell.toll, r: a.r * wideOf(), stun: Math.round(S(a.stun) * p), poise: a.poise * p });
      ev.push({ type: 'abilityFx', kind: 'tell', id: 'toll', at: [s.x, s.y, s.z], r: a.r, life: 0.3 });
      return true;
    },
    // Ember shell: a 20 shell for 6 s; when it breaks or its time ends, 15 within 2.5 m and 2 s of burn
    shell(a, p, ev) {
      const s = sOf(), r = a.r * wideOf(), dmg = a.dmg * p;
      const got = R.build?.addShell(a.shell * p, S(a.life), 'ember', { onEnd: e2 => shellBurst(r, dmg, S(a.burn), e2 || ev) }) ?? 0;
      ev.push({ type: 'abilityFx', kind: 'ring', id: 'shell', at: [s.x, s.y, s.z], r: 0.9 });
      return got > 0 || !R.build;
    },
    // Post lamp: a lamp planted for 10 s that heals 1.5% of the max health a second within 3 m; Use again blinks back to it
    post(a, p, ev) {
      const s = sOf(), at = [s.x, ground(s.x, s.z, s.y), s.z];
      A.effects = A.effects.filter(e => e.kind !== 'post');
      A.effects.push({ kind: 'post', at, t: 0, life: S(a.life), r: a.r * wideOf(), heal: a.heal * p, acc: 0 });
      ev.push({ type: 'abilityFx', kind: 'core', id: 'post', at: [at[0], at[1] + 1.2, at[2]], life: 0.4 });
      return true;
    },
    // Shutter: 2 s unseen (no foe starts at the lamplighter); the next blade hit within 3 s is a sure cut
    shutter(a, p, ev) {
      const s = sOf();
      R.unseenUntil = clock.play + S(a.time);
      R.build?.markSure(S(a.sure));
      ev.push({ type: 'abilityFx', kind: 'puff', id: 'shutter', at: [s.x, s.y, s.z] });
      return true;
    },
    // Moth swarm: 6 moths for 10 s; each seeks the nearest burning foe within 8 m, else the nearest, and deals 3 a second (ticks)
    swarm(a, p, ev) {
      const s = sOf();
      A.effects = A.effects.filter(e => e.kind !== 'swarm');
      A.effects.push({ kind: 'swarm', t: 0, tell: AB.tell.swarm, life: S(a.life), n: a.n, range: a.range * wideOf(), dmg: a.dmg * p, every: S(1), targets: [] });
      ev.push({ type: 'abilityFx', kind: 'puff', id: 'swarm', at: [s.x, s.y + 0.6, s.z] });
      return true;
    },
    // Gloam blink: a 5 m blink through foes, safe for 0.2 s; each foe passed gets a Mark
    blink(a, p, ev, act, camYaw) {
      const s = sOf(), [ux, uz] = dirOf(act, camYaw), to = reach(ux, uz, a.dist);
      const from = [s.x, s.y, s.z];
      if (to) {
        A.move = { from, to, t: 0, n: AB.blinkN, yaw: s.yaw };
        const len = Math.hypot(to[0] - from[0], to[2] - from[2]);
        for (const t of live()) {
          if (!isFoe(t)) continue;
          const dx = t.x - from[0], dz = t.z - from[2], along = dx * ux + dz * uz, across = Math.abs(-dx * uz + dz * ux);
          if (along >= -0.3 && along <= len + 0.3 && across <= 0.6 + (t.r || 0) && Math.abs(t.y - s.y) < 2) statusHit(t, 'mark', STATES.mark.life);
        }
      }
      R.fighter.f.smoke = Math.max(R.fighter.f.smoke | 0, S(a.safe));
      ev.push({ type: 'abilityFx', kind: 'puff', id: 'blink', at: from }, { type: 'abilityFx', kind: 'puff', id: 'blink', at: to || from });
      return true;
    }
  };
  // Wide (a trait, gear.js traitWide): the radius or range of the ability now starting, by its slot (1 until the gear lands)
  let wideSlot = null;
  const wideOf = () => (wideSlot && typeof A.wide === 'function' ? A.wide(wideSlot) : 1);
  // Ember shell's burst: 15 within 2.5 m, and 2 s of burn
  function shellBurst(r, dmg, burn, ev) {
    const s = sOf();
    for (const t of live()) if (Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0) <= r && Math.abs(t.y - s.y) < 2.2) {
      hurtFoe(t, dmg, 'shell', ev, { interrupt: true });
      statusHit(t, 'burn', burn, { dps: STATES.burnDps });
    }
    ev.push({ type: 'abilityFx', kind: 'burst', id: 'shell', at: [s.x, s.y, s.z], r });
    cue(ev, 'slam', { ability: 'shell' });
  }
  // a slot's input: a press (or one kept 0.15 s) starts its ability, or swaps it with the lamp underfoot
  function press(i, act, camYaw, ev) {
    const run = rs.run, slot = slots()[i];
    // a lamp underfoot: the press takes it into this slot, and the old ability lies there in its place
    if (A.onLamp && slots().every(Boolean)) {
      const lamp = A.onLamp;
      run.abilityLamps.splice(run.abilityLamps.indexOf(lamp), 1);
      const old = run.abilities[i];
      run.abilities[i] = { id: lamp.id, bright: lamp.bright };
      // the swap keeps each ability's cooldown: the one put down lies there still cooling, and the one taken up has what its lamp had
      if (old) run.abilityLamps.push({ id: old.id, bright: old.bright, place: run.place, x: lamp.x, y: lamp.y, z: lamp.z, cool: A.cool[i], full: A.full[i] });
      A.cool[i] = Math.max(0, lamp.cool | 0); A.full[i] = Math.max(1, lamp.full | 0, A.cool[i]); A.onLamp = null;
      ev.push({ type: 'ability', what: 'swap', slot: i, id: lamp.id }, { type: 'store' });
      cue(ev, 'choice', { ability: lamp.id });
      R.notes.push(`<b>${abilityOf(lamp.id).name}</b> in slot ${i + 1}`);
      return true;
    }
    if (!slot) return false;
    const a = abilityOf(slot.id), f = R.fighter.f, s = sOf();
    // Post lamp standing: Use again blinks back to it, safe for 0.15 s, and ends it (in its cooldown too)
    const post = a.id === 'post' && A.effects.find(e => e.kind === 'post');
    if (post && !AB.busy.includes(f.move) && !A.move) {
      A.move = { from: [s.x, s.y, s.z], to: post.at.slice(), t: 0, n: AB.postN, yaw: s.yaw };
      f.smoke = Math.max(f.smoke | 0, AB.postN);
      A.effects.splice(A.effects.indexOf(post), 1);
      ev.push({ type: 'abilityFx', kind: 'puff', id: 'post', at: [s.x, s.y, s.z] }, { type: 'abilityFx', kind: 'puff', id: 'post', at: post.at.slice() });
      cue(ev, 'blink', { ability: 'post', back: true });
      return true;
    }
    if (A.cool[i] > 0) { cue(ev, 'refuse', { ability: slot.id, slot: i }); return true; }
    // in a drink, a roll, a hurt or a plunge, and Smoke step or Bell guard in the air: nothing but the refuse cue, and the press is spent
    if (AB.busy.includes(f.move) || (AB.ground.includes(a.id) && !s.ground) || A.move) { cue(ev, 'refuse', { ability: slot.id, slot: i, busy: true }); return true; }
    // an ability with no START yet (a row of the hub change before its builder lands) only refuses
    wideSlot = slot;
    const ok = START[a.id]?.(a, powerOf(rs, slot), ev, act, camYaw);
    wideSlot = null;
    if (!ok) { cue(ev, 'refuse', { ability: slot.id, slot: i }); return true; }
    A.full[i] = A.cool[i] = coolOf(rs, a.id);
    A.lastUse = clock.play; A.lastSlot = i;
    ev.push({ type: 'ability', what: 'use', id: a.id, slot: i });
    cue(ev, a.cue, { ability: a.id, slot: i });
    emit('ability-use', { id: a.id, slot: i });
    return true;
  }
  // one play step of each effect under way
  function effects(ev) {
    for (const e of A.effects.slice()) {
      e.t++;
      let done = false;
      switch (e.kind) {
        case 'bomb':
          if (e.t >= e.fuse) {
            for (const t of live()) if (dist(t, e.at) - (t.r || 0) <= e.r && Math.abs(t.y - e.at[1]) < 2.2) {
              hurtFoe(t, e.dmg, 'bomb', ev, { interrupt: true });
              if (statusHit(t, 'burn', AB.burnEvery * AB.burnTicks)) A.effects.push({ kind: 'burn', target: t, t: 0, n: AB.burnTicks, every: AB.burnEvery, dmg: e.burn, id: 'bomb' });
            }
            ev.push({ type: 'abilityFx', kind: 'burst', id: 'bomb', at: e.at, r: e.r }, { type: 'stop', n: AB.stop });
            cue(ev, 'slam', { ability: 'bomb' });
            done = true;
          }
          break;
        case 'burn':
          // a burn's tick (status.js tickHit): no flinch, no poise, no combo; Ember glass's 20% on it as on any hit of an ability
          if (e.t % e.every === 0) { if (e.target.alive) tickHit(e.target, e.dmg * (paneOf(rs, 'ember') ? 1.2 : 1), ev, { id: e.id }); if (--e.n <= 0 || !e.target.alive) done = true; }
          break;
        case 'snare': {
          if (e.t >= e.life) { done = true; break; }
          // the first foe in it springs it (a light foe before a heavy one in the same step): a light foe is held, a heavy foe slowed,
          // and either takes the damage; a target that takes no state (the Barrow Reeve) still takes the damage. The snare is spent
          const inside = live().filter(t => dist(t, e.at) - (t.r || 0) <= e.r && Math.abs(t.y - e.at[1]) <= 1.6).sort((a, b) => (b.T?.light ? 1 : 0) - (a.T?.light ? 1 : 0));
          const t = inside[0];
          if (t) {
            if (isFoe(t)) statusHit(t, 'hold', e.hold, { slowK: e.slow });
            hurtFoe(t, e.dmg, 'snare', ev, { interrupt: true });
            ev.push({ type: 'abilityFx', kind: 'snap', id: 'snare', at: e.at });
            done = true;
          }
          break;
        }
        case 'moth': {
          if (e.t >= e.life) { done = true; break; }
          const s = sOf();
          const left = e.next - e.t;
          if (left === S(0.2) || (!e.target && left < S(0.2))) {
            e.target = null;
            let bd = e.range;
            for (const t of live()) { const d = Math.hypot(t.x - s.x, t.z - s.z); if (d < bd && (t.aware !== false)) { bd = d; e.target = t; } }
            if (e.target) ev.push({ type: 'abilityFx', kind: 'line', id: 'moth', a: [s.x + 0.4, s.y + 1.5, s.z], b: [e.target.x, e.target.y + (e.target.T?.chest ?? 1), e.target.z], life: 0.2 });
          }
          if (e.t >= e.next) { if (e.target?.alive) hurtFoe(e.target, e.dmg, 'moth', ev, { interrupt: true }); e.target = null; e.next += e.every; }
          break;
        }
        case 'crook': {
          if (e.t < e.tell) break;
          const t = e.target, s = sOf();
          done = true;
          if (!t.alive) break;
          const dx = t.x - s.x, dz = t.z - s.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
          if (isFoe(t) && t.T.light && !t.elite) {
            // a light foe comes to 1.2 m in front of the lamplighter (centre to centre), pulled over 0.2 s by its own push (walls hold
            // it). The walker gains 400 m/s² at most (foes.js physics), so the push's speed is set for the way it really covers
            const far = Math.max(0, d - e.to);
            if (far > 0.05) t.push = { ux: -ux, uz: -uz, v: pullSpeed(far, AB.pullN), n: AB.pullN };
          } else {
            // the lamplighter goes to a heavy foe (or the Reeve), up to its edge
            const to = reach(ux, uz, Math.max(0, d - (t.r || 0) - 1.0));
            if (to) body().place([to[0], to[1] + 0.05, to[2]], Math.atan2(ux, uz));
          }
          hurtFoe(t, e.dmg, 'crook', ev, { interrupt: true });
          break;
        }
        case 'flare':
          if (e.t >= e.grow) {
            const s = sOf();
            for (const t of live()) if (Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0) <= e.r && Math.abs(t.y - s.y) < 2.5 && sees(R.fighter.walk, s, t)) statusHit(t, 'stun', e.stun);
            ev.push({ type: 'abilityFx', kind: 'flash', id: 'flare', at: [s.x, s.y + 1, s.z], r: e.r });
            done = true;
          }
          break;
        case 'pitch':
          if (e.t >= e.life) { done = true; break; }
          if (e.t >= e.start && (e.t - e.start) % e.every === 0) for (const t of live()) {
            if (dist(t, e.at) - (t.r || 0) > e.r || Math.abs(t.y - e.at[1]) > 1.6) continue;
            statusHit(t, 'burn', e.every + 1);
            // a burn from the bomb or the blade doubles the pool's burn on that foe, once
            const twice = !e.twice.has(t) && A.effects.some(b => b.kind === 'burn' && b.target === t);
            if (twice) e.twice.add(t);
            hurtFoe(t, e.dmg * (twice ? AB.pitchTwice : 1), 'pitch', ev);
          }
          break;
        case 'lash':
          if (e.t >= e.tell) {
            for (const t of live()) {
              const dx = t.x - e.at[0], dz = t.z - e.at[2], along = dx * e.ux + dz * e.uz, across = Math.abs(-dx * e.uz + dz * e.ux);
              if (along < -0.2 || along > e.len + (t.r || 0) || across > e.w / 2 + (t.r || 0) || Math.abs(t.y - e.at[1]) > 2.2) continue;
              if (hurtFoe(t, e.dmg, 'lash', ev, { interrupt: true }) !== false) statusHit(t, 'burn', e.burn, { dps: STATES.burnDps });
            }
            done = true;
          }
          break;
        case 'fan':
          if (e.t >= e.tell) {
            // each shard meets the nearest foe along its way, within its half width
            for (const r of e.rays) {
              const ux = Math.sin(r), uz = Math.cos(r);
              let best = null, bd = Infinity;
              for (const t of live()) {
                const dx = t.x - e.at[0], dz = t.z - e.at[2], along = dx * ux + dz * uz, across = Math.abs(-dx * uz + dz * ux);
                if (along < 0 || along > e.range + (t.r || 0) || across > AB.shard + (t.r || 0) || Math.abs(t.y - e.at[1]) > 2.2) continue;
                if (along < bd) { bd = along; best = t; }
              }
              if (best && hurtFoe(best, e.dmg, 'fan', ev, { interrupt: true }) !== false) statusHit(best, 'char', e.char, { ev, from: [e.at[0], e.at[2]] });
            }
            done = true;
          }
          break;
        case 'slick': {
          if (e.t >= e.life && !(e.lit > 0)) { done = true; break; }
          const inside = live().filter(t => dist(t, e.at) - (t.r || 0) <= e.r && Math.abs(t.y - e.at[1]) <= 1.6);
          // a burn touches it: a burning foe in it, or a pool of pitch on it
          if (!e.lit && (inside.some(t => t.status?.burn > 0) || A.effects.some(b => b.kind === 'pitch' && Math.hypot(b.at[0] - e.at[0], b.at[2] - e.at[2]) <= e.r + b.r))) {
            e.lit = e.litFor; e.litAt = e.t;
            cue(ev, 'slick', { ability: 'slick', lit: true });
            ev.push({ type: 'abilityFx', kind: 'burst', id: 'slick', at: e.at, r: e.r });
          }
          if (e.t % e.every === 0) for (const t of inside) statusHit(t, 'slow', e.every + 1, { k: e.slow });
          if (e.lit > 0) {
            // lit: 5 every 0.5 s to each foe in it (a ground fire, as the pitch: no flinch, outside the ticks' cap)
            if (e.t > e.litAt && (e.t - e.litAt) % e.every === 0) for (const t of inside) { tickHit(t, e.dmg * (paneOf(rs, 'ember') && t.status?.burn > 0 ? 1.2 : 1), ev, { id: 'slick', capped: false }); statusHit(t, 'burn', e.every + 1); }
            if (--e.lit <= 0) done = true;
          }
          break;
        }
        case 'tacks': {
          if (e.t >= e.life || !e.pts.length) { done = true; break; }
          for (const pt of e.pts.slice()) {
            const t = live().find(t => Math.hypot(t.x - pt[0], t.z - pt[2]) <= AB.tack + (t.r || 0) && Math.abs(t.y - pt[1]) <= 1.6);
            if (!t) continue;
            e.pts.splice(e.pts.indexOf(pt), 1);
            hurtFoe(t, e.dmg, 'tacks', ev);
            statusHit(t, 'char', e.char, { ev, from: [pt[0], pt[2]] });
            statusHit(t, 'slow', e.hold, { k: e.slow });
            ev.push({ type: 'abilityFx', kind: 'snap', id: 'tacks', at: pt });
          }
          break;
        }
        case 'toll':
          if (e.t >= e.tell) {
            const s = sOf();
            for (const t of live()) {
              if (!isFoe(t) || Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0) > e.r || Math.abs(t.y - s.y) > 2.5) continue;
              if (heavyOf(t)) t.wear?.(e.poise);
              else statusHit(t, 'stun', e.stun);
            }
            ev.push({ type: 'abilityFx', kind: 'flash', id: 'toll', at: [s.x, s.y + 1, s.z], r: e.r });
            done = true;
          }
          break;
        case 'post': {
          if (e.t >= e.life) { done = true; break; }
          const s = sOf(), run = rs.run;
          if (run && Math.hypot(s.x - e.at[0], s.z - e.at[2]) <= e.r && Math.abs(s.y - e.at[1]) < 2) {
            const max = R.max();
            e.acc += (e.heal * max) / 60;
            if (e.acc >= 1) { const n = Math.floor(e.acc); e.acc -= n; run.hp = Math.min(max, run.hp + n); }
          }
          break;
        }
        case 'swarm': {
          if (e.t >= e.life) { done = true; break; }
          if (e.t < e.tell) break;
          const s = sOf(), here = [s.x, s.y, s.z], L = live().filter(t => dist(t, here) <= e.range && Math.abs(t.y - s.y) < 3);
          // every 0.5 s the moths pick again: the nearest burning foe within 8 m, else the nearest foe
          if ((e.t - e.tell) % AB.every === 0) {
            const near = L.slice().sort((a, b) => dist(a, here) - dist(b, here));
            const pick = near.find(t => t.status?.burn > 0) || near[0] || null;
            e.targets = Array.from({ length: e.n }, () => pick);
            if (pick) ev.push({ type: 'abilityFx', kind: 'line', id: 'moth', a: [s.x + 0.4, s.y + 1.5, s.z], b: [pick.x, pick.y + (pick.T?.chest ?? 1), pick.z], life: 0.2 });
          }
          // each moth deals 3 a second as a tick (no flinch, inside the cap); Ember glass adds 20% on a burning foe
          if (e.t > e.tell && (e.t - e.tell) % e.every === 0) {
            const by = new Map();
            for (const t of e.targets) if (t?.alive) by.set(t, (by.get(t) || 0) + e.dmg);
            for (const [t, n] of by) tickHit(t, n * (paneOf(rs, 'ember') && t.status?.burn > 0 ? 1.2 : 1), ev, { id: 'swarm' });
          }
          break;
        }
      }
      if (done) A.effects.splice(A.effects.indexOf(e), 1);
    }
    if (A.guard && ++A.guard.t >= A.guard.n) A.guard = null;
  }
  // the lamps underfoot: one touched with an empty slot fills it; with both slots full the toast says how to swap
  function lamps(ev) {
    const run = rs.run, s = sOf();
    A.onLamp = null;
    for (const l of (run.abilityLamps || []).slice()) {
      if (Math.hypot(s.x - l.x, s.z - l.z) > AB.touch || Math.abs(s.y - l.y) > 1.6) continue;
      const i = slots().findIndex(x => !x);
      if (i >= 0) {
        run.abilities ||= [null, null];
        run.abilities[i] = { id: l.id, bright: l.bright };
        run.abilityLamps.splice(run.abilityLamps.indexOf(l), 1);
        A.cool[i] = Math.max(0, l.cool | 0); A.full[i] = Math.max(1, l.full | 0, A.cool[i]);
        R.notes.push(`<b>${abilityOf(l.id).name}</b>${l.bright ? ' (bright)' : ''} in slot ${i + 1}`);
        ev.push({ type: 'ability', what: 'take', slot: i, id: l.id }, { type: 'store' });
        cue(ev, 'wisp', { ability: l.id });
        continue;
      }
      A.onLamp = l;
      // the hint shows as the feet touch the lamp: the event makes the page show its toasts now (main.js runEvent)
      if (A.swapNote !== l) { A.swapNote = l; R.notes.push(`<b>${abilityOf(l.id).name}</b> · press an ability to swap`); ev.push({ type: 'ability', what: 'lamp', id: l.id }); }
    }
    if (!A.onLamp) A.swapNote = null;
  }
  A.step = (act, camYaw, ev) => {
    const run = rs.run;
    if (!run || R.dead) return ev;
    if (R.fighter.f.smoke > 0) R.fighter.f.smoke--;
    // Smoke step on its way: a share of the move each play step, on the floor under it
    if (A.move) {
      const m = A.move, k = ++m.t / m.n, p = [0, 1, 2].map(j => m.from[j] + (m.to[j] - m.from[j]) * k);
      body().place([p[0], p[1] + 0.05, p[2]], m.yaw);
      if (m.t >= m.n) A.move = null;
    }
    for (const l of run.abilityLamps || []) if (l.cool > 0) l.cool--;
    for (let i = 0; i < 2; i++) {
      if (A.cool[i] > 0 && --A.cool[i] === 0 && slots()[i]) { ev.push({ type: 'ability', what: 'ready', slot: i }); emit('ability-ready', { slot: i }); }
      const k = i ? 'ab2' : 'ab1', h = !!act[k];
      A.buf[i] = h && !A.was[i] ? AB.buffer : Math.max(0, A.buf[i] - 1);
      A.was[i] = h;
    }
    lamps(ev);
    for (let i = 0; i < 2; i++) if (A.buf[i] > 0 && press(i, act, camYaw, ev)) A.buf[i] = 0;
    effects(ev);
    const moth = A.effects.find(e => e.kind === 'moth');
    run.abilityLive = { cool: A.cool.slice(), full: A.full.slice(), moth: moth ? { kind: 'moth', t: moth.t, life: moth.life, every: moth.every, dmg: moth.dmg, range: moth.range, next: moth.next } : null };
    return ev;
  };
  // Bell guard: a blow from in front in its 0.8 s is turned aside, and a coal's Pitchrook takes one back. -> true when turned aside
  A.turn = (from, ev, o = {}) => {
    if (!A.guard || !from) return false;
    const s = sOf();
    // a coal lands round the lamplighter, so it is turned aside from any side; a melee blow only from in front
    if (!o.coal && Math.abs(wrap(Math.atan2(from[0] - s.x, from[1] - s.z) - s.yaw)) > Math.PI / 2 && Math.hypot(from[0] - s.x, from[1] - s.z) > 0.3) return false;
    const back = A.guard.back;
    A.guard = null;
    ev.push({ type: 'abilityFx', kind: 'ring', id: 'guard', at: [s.x, s.y, s.z], r: 1 });
    cue(ev, 'clang', { ability: 'guard' });
    // a coal: thrown back at the nearest Pitchrook within 12 m
    let rook = null, bd = 12;
    if (o.coal) for (const t of live()) { const d = Math.hypot(t.x - s.x, t.z - s.z); if (t.type === 'P' && d < bd) { bd = d; rook = t; } }
    if (rook) { hurtFoe(rook, back, 'guard', ev); ev.push({ type: 'abilityFx', kind: 'throw', id: 'guard', from: [s.x, s.y + 1, s.z], to: [rook.x, rook.y + 1, rook.z] }); }
    return true;
  };
  // a cooldown cut short on both slots (Storm, Tallow) or the other slot (Hot glass)
  const cut = (n, only = null) => { for (let i = 0; i < 2; i++) if (only === null || only === i) A.cool[i] = Math.max(0, A.cool[i] - n); };
  A.nearMiss = () => { if (paneOf(rs, 'storm')) cut(AB.storm); };
  // the Gloam set (build.js): a cooldown cut short on one slot
  A.coolBy = (n, only = null) => cut(n, only);
  /* the Count wick (build.js): a free Lantern bomb at `power` of a slotted one's at a foe; it counts as an ability use (Hot glass, Clear
     glass), and starts no cooldown */
  A.freeBomb = (t, power = 1, ev = R.out) => {
    const a = abilityOf('bomb'), at = [t.x, t.y, t.z], p = power * colourPower(rs.run, a.colour), s = sOf();
    A.effects.push({ kind: 'bomb', at, t: 0, fuse: S(a.fuse), dmg: a.dmg * p, r: a.r, burn: (a.burn / AB.burnTicks) * p });
    ev.push({ type: 'abilityFx', kind: 'throw', id: 'bomb', from: [s.x, s.y + 1, s.z], to: at }, { type: 'abilityFx', kind: 'tell', id: 'bomb', at, r: a.r, life: a.fuse });
    A.lastUse = clock.play; A.lastSlot = 2;
    if (paneOf(rs, 'clear')) R.clearUntil = clock.play + S(2);
    ev.push({ type: 'ability', what: 'use', id: 'bomb', slot: -1, free: true });
    cue(ev, a.cue, { ability: 'bomb', free: true });
    emit('ability-use', { id: 'bomb', slot: -1, free: true });
    return true;
  };
  A.drink = () => { if (paneOf(rs, 'tallow')) cut(AB.tallow); };
  // (a free bomb of the Count wick is slot 2: it cools both)
  A.foeOut = () => { if (paneOf(rs, 'hot') && A.lastSlot >= 0 && clock.play - A.lastUse <= AB.hot.within) cut(AB.hot.cool, A.lastSlot === 2 ? null : 1 - A.lastSlot); };
  // a cache's ability lamp: a draw from the kindled abilities, at the cache -> { id, name } or null
  A.dropAt = at => { const l = dropAbility(R, at); return l ? { id: l.id, name: abilityOf(l.id)?.name || l.id } : null; };
  // a foe put out: an ability lamp drops where it fell with 3%, 1% more a Keen eye level (run.js keeps the count of 3 a run)
  A.dropRoll = at => { const a = drawAbility(rs, abilityChance(rs)); return !!(a && dropAbility(R, at, a)); };
  // the test hook: set the cooldown left on each slot, in seconds
  A.setCool = (list = []) => { list.forEach((v, i) => { if (Number.isFinite(v)) { A.cool[i] = Math.max(0, Math.round(v * 60)); A.full[i] = Math.max(A.full[i], A.cool[i], 1); } }); };
  // the HUD and __gloam.run(): each slot's ability, bright, the seconds left and the share of the cooldown left
  A.view = () => slots().map((x, i) => (x ? { id: x.id, name: abilityOf(x.id)?.name || x.id, colour: abilityOf(x.id)?.colour, bright: !!x.bright, left: +(A.cool[i] / 60).toFixed(2), share: A.cool[i] / Math.max(1, A.full[i]) } : null));
  return A;
}
