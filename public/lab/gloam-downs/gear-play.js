// Gloam Downs: the gear in play (gloam-downs-hub design.md "Part C"). The held blade and off-hand of a run, the six off-hands with
// their tells, effects and cooldown, the Buckler's parry, the gear that drops on the ground and the hold to swap it, the traits on the
// hits of the item that dealt them, and the view the HUD and ?test read. No DOM, so the page, the Node tests and the bot use it as it
// is. makeRunner (run.js) calls makeGear(R) for every runner.
// Every time here is in play steps of 1/60 s. An off-hand's hit counts as a relic hit for the combo (as an ability's does), takes 2 steps
// of hit stop inside the cap, is not blade damage (Edge and Keen edge do not raise it), grows with its colour and its tier, and rounds
// once. It interrupts by the fair-fight rules (how.interrupt), and the Buckler's parry follows them too.
import { OFFHANDS, GEAR_DROPS, bladeOf, offhandOf, tierOf, traitsOf, traitOf, hasTrait, gearCopy, tierPower, traitCool, traitWide, rollGear, gearRoll, gearKind, kindledGear, slamOf, traitNames } from './gear.js';
import { colourPower, kindledOf, paneOf } from './run.js';
import { statusHit, isFoe, heavyOf } from './status.js';
import { sees, dealt } from './moves.js';
import { dropAbility, abilityOf, pullSpeed } from './abilities.js';
import { emit } from './bus.js';
import { mulberry, hash2 } from '../kit/rng.js';

const S = sec => Math.round(sec * 60);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;
/* the rules that are not in gear.js's tables: the hold that swaps (0.4 s), the touch of a ground item, the input buffer, the tell before
   each off-hand's effect, the sling stone's speed, the pot's flight, the hit stop of an off-hand's hit, a burn tick, and what the
   lamplighter cannot do an off-hand in (as for the abilities: a drink, a roll, a hurt, a plunge) */
export const GEAR = {
  swap: S(0.4), touch: 1.0, buffer: S(0.15), tell: S(0.1), stone: 30, potFlight: S(0.5), stop: 2, aim: 70 * DEG,
  burn: { every: S(1), dmg: 1 }, char: S(4), mark: S(4), blind: S(3), chainShort: 1.0, chainSafe: S(0.1),
  busy: ['drink', 'roll', 'hurt', 'hang', 'plunge', 'land'], ground: ['cuff', 'chain', 'pot']
};
// the blade's own hits (its string, the Rising cut, the Bell maul's slam): the traits of the held blade ride on these
const BLADE_KINDS = ['cut1', 'cut2', 'fin', 'rise', 'slam'];
/* the gear's cues (gloam-downs-hub design.md "Sound"), each played by run-sound.js with a recipe of sound.js there now: the Buckler's raise
   and its parry, the five other off-hands, a swap, and the ring of a bright or blazing drop. The Bell maul's slam logs `slam`, which has
   its own recipe already */
export const GEAR_CUES = { buckler: 'whiff', parry: 'clang', cuff: 'snap', sling: 'whiff', pot: 'coal', chain: 'charge', shade: 'light', swap: 'choice', bright: 'glim', blazing: 'light' };

/* until the buffs builder's build.js lands: a sure cut readied for the next blade hit, and a ward shell. Its markSure(R) and
   addShell(R, n, steps, from) take these places (gloam-downs-hub design.md "Who builds what") */
const markSure = R => { if (typeof R.markSure === 'function') return R.markSure(); R.sureNext = true; return true; };
const addShell = (R, n, steps, from) => (typeof R.addShell === 'function' ? R.addShell(n, steps, from) : false);

/* a foe state the buffs builder's status.js gives (char, blind, mark). Until it lands, statusHit says null for these, and the state is
   kept on the foe's status by hand so the effects here can be seen: Char stacks to 5, Blind and Mark last n steps (Blind half on a heavy
   foe). The Barrow Reeve takes none */
export function putState(t, kind, n) {
  const got = statusHit(t, kind, n);
  if (got || !isFoe(t) || t.out || !(n > 0)) return got;
  const st = (t.status ||= { stun: 0, hold: 0, slow: 0, slowK: 1, burn: 0 });
  if (kind === 'char') { st.char = Math.min(5, (st.char | 0) + n); st.charT = GEAR.char; return 'char'; }
  if (kind === 'blind' || kind === 'mark') { st[kind] = Math.max(st[kind] | 0, kind === 'blind' && heavyOf(t) ? Math.round(n / 2) : n); return kind; }
  return null;
}
// a heavy foe's poise worn by n more (the Bell maul, Weighted, the Iron cuff, a parry): a break at 0 staggers it, by the fair-fight rules
export function wearPoise(t, n, from) {
  if (!isFoe(t) || !t.alive || !(n > 0) || !Number.isFinite(t.poise) || t.poise <= 0) return false;
  t.poise = Math.max(0, t.poise - n);
  if (t.poise === 0) t.hit(0, { from, push: 0, knock: 0, kind: 'poise', interrupt: false });
  return true;
}
// the recap's gear (run.js recapFields): the run's last blade, off-hand and abilities, with tiers and traits
export const gearRecap = run => ({ blade: gearCopy(run?.blade), offhand: gearCopy(run?.offhand), abilities: (run?.abilities || [null, null]).map(gearCopy) });
// an item's name with its tier and traits: "Hook blade, bright, Smouldering"
export const itemName = (kind, x) => {
  if (!x) return 'none';
  const row = kind === 'blade' ? bladeOf(x.id) : kind === 'offhand' ? offhandOf(x.id) : abilityOf(x.id);
  return [row?.name || x.id, tierOf(x), ...traitNames(x)].join(', ');
};
export const rowOf = (kind, id) => (kind === 'blade' ? bladeOf(id) : kind === 'offhand' ? offhandOf(id) : abilityOf(id));

export function makeGear(R) {
  const rs = R.rs, clock = R.clock;
  const G = {
    raise: -1e9, shade: null, effects: [], move: null, buf: 0, was: false, heldA: 0, heldO: 0, under: null, note: null,
    hits: new Map(), burns: [], slamWait: false
  };
  const run = () => rs.run;
  const sOf = () => R.fighter.body.s;
  // a cue in the log; the gear's own cues (GEAR_CUES) also go on the bus, where run-sound.js plays each with a recipe there now
  const cue = (ev, name, more = {}) => {
    const c = { cue: name, step: clock.step, play: clock.play, ...more };
    R.log.push(c);
    ev.push({ type: 'cue', ...c, logged: true });
    if (GEAR_CUES[name]) emit('gear-cue', { cue: name, id: more.offhand || more.id || more.blade || null, tier: more.tier || null });
  };
  const live = () => R.targets().filter(t => t.alive);
  const ground = (x, z, y) => { const g = R.fighter.walk.support(x, z, y + 1.2); return g === null ? y : g; };
  const offRow = () => (run()?.offhand ? offhandOf(run().offhand.id) : null);
  const powerOf = (kind, x) => (x ? colourPower(run(), rowOf(kind, x.id)?.colour) * tierPower(x) : 1);
  // the lamps of this place only: a place left leaves its gear behind (run.js goTo empties the list)
  const lamps = () => { const r = run(); if (!r) return []; r.gearLamps = (r.gearLamps || []).filter(l => l.place === r.place); return r.gearLamps; };

  /* an off-hand's hit on a target: its power, Ember glass on a burning foe, rounded once by the target, 2 steps of hit stop. how.interrupt:
     the hit flinches a light foe and cancels its wind-up (the cuff, the sling, the pot's burst, the chain); a burn tick does not */
  function hurtFoe(t, raw, id, ev, how = {}) {
    if (!t || !t.alive) return false;
    const s = sOf(), ember = paneOf(rs, 'ember') && t.status?.burn > 0 ? 0.2 : 0;
    const dmg = t.hit(raw * (1 + ember), { from: [s.x, s.z], push: 0, knock: 0, kind: 'offhand', offhand: id, ...how });
    if (dmg === false) return false;
    ev.push({ type: 'hit', kind: 'relic', offhand: id, target: t, dmg, ...(how.tick ? { tick: true } : {}) });
    if (!how.tick) { ev.push({ type: 'stop', n: GEAR.stop }); cue(ev, 'hit', { hit: 'offhand', offhand: id, on: [t.type || 'post'], stop: GEAR.stop }); }
    return dmg;
  }
  /* a burn of n steps on a foe: its state, and ticks of 1 every 1 s that never flinch and never wear poise (one burn a target). renew:
     a new burn lengthens one under way (the Fire pot); Smouldering's does not, so a quick string or a moth's many hits keep one burn */
  function burn(t, n, from, renew = true) {
    if (!t?.alive) return;
    const b = G.burns.find(x => x.t === t);
    if (b && !renew) return;
    statusHit(t, 'burn', n);
    if (b) b.left = Math.max(b.left, n); else G.burns.push({ t, left: n, k: 0, from });
  }
  // the soft aim: the nearest target in front (70 degrees) within range that the lamplighter sees
  function aim(range, arc = GEAR.aim) {
    const s = sOf();
    let best = null, bd = Infinity;
    for (const t of live()) {
      const d = Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0);
      if (d > range || Math.abs(t.y - s.y) > 2.5) continue;
      if (Math.abs(wrap(Math.atan2(t.x - s.x, t.z - s.z) - s.yaw)) > arc && d > 1.5) continue;
      if (!sees(R.fighter.walk, s, t)) continue;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  function nearestIn(range) {
    const s = sOf();
    let best = null, bd = range;
    for (const t of live()) {
      const d = Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0);
      if (d <= bd && Math.abs(t.y - s.y) <= 2.5 && sees(R.fighter.walk, s, t)) { bd = d; best = t; }
    }
    return best;
  }
  // a target moved `far` metres along (ux, uz): a light foe by its own push (walls hold it), a post at once
  function shove(t, ux, uz, far) {
    if (!(far > 0.05)) return;
    if (isFoe(t)) { if (t.T.light && !t.elite) t.push = { ux, uz, v: pullSpeed(far, 12), n: 12 }; }
    else if (!t.body && t.type === 'post') { t.x += ux * far; t.z += uz * far; }
  }

  /* ---------------- the off-hands ----------------
   Each starts with its tell; the effect comes GEAR.tell later (the Buckler is raised at once, the Shade lamp after its 0.4 s raise).
   -> true when it started (the cooldown begins), false when it cannot (no foe for the chain) */
  const START = {
    buckler(o, p, ev) {
      const s = sOf();
      G.raise = clock.play;
      ev.push({ type: 'abilityFx', kind: 'ring', id: 'buckler', at: [s.x, s.y, s.z], r: 0.7 });
      return true;
    },
    cuff(o, p, ev, w) {
      const s = sOf();
      G.effects.push({ kind: 'cuff', t: 0, at: GEAR.tell, dmg: o.dmg * p, range: o.range * w, poise: o.poise, push: o.push });
      ev.push({ type: 'abilityFx', kind: 'puff', id: 'cuff', at: [s.x + Math.sin(s.yaw) * 0.8, s.y, s.z + Math.cos(s.yaw) * 0.8] });
      return true;
    },
    sling(o, p, ev, w) {
      const s = sOf(), t = aim(o.range * w);
      const d = t ? Math.hypot(t.x - s.x, t.z - s.z) : o.range * w;
      const to = t ? [t.x, t.y + (t.T?.chest ?? 0.9), t.z] : [s.x + Math.sin(s.yaw) * d, s.y + 1, s.z + Math.cos(s.yaw) * d];
      G.effects.push({ kind: 'sling', t: 0, at: GEAR.tell + Math.max(1, Math.round((d / GEAR.stone) * 60)), target: t, dmg: o.dmg * p, char: o.char });
      ev.push({ type: 'abilityFx', kind: 'line', id: 'sling', a: [s.x, s.y + 1.2, s.z], b: to, life: 0.15 });
      return true;
    },
    pot(o, p, ev, w) {
      const s = sOf(), t = aim(o.range * w);
      const at = t ? [t.x, t.y, t.z] : (() => { const x = s.x + Math.sin(s.yaw) * o.range * w, z = s.z + Math.cos(s.yaw) * o.range * w; return [x, ground(x, z, s.y), z]; })();
      G.effects.push({ kind: 'pot', t: 0, at: GEAR.tell + GEAR.potFlight, where: at, dmg: o.dmg * p, r: o.r * w, burn: S(o.burn) });
      ev.push({ type: 'abilityFx', kind: 'throw', id: 'pot', from: [s.x, s.y + 1, s.z], to: at }, { type: 'abilityFx', kind: 'tell', id: 'pot', at, r: o.r * w, life: (GEAR.tell + GEAR.potFlight) / 60 });
      return true;
    },
    chain(o, p, ev, w) {
      const t = nearestIn(o.range * w);
      if (!t) return false;
      const s = sOf();
      G.effects.push({ kind: 'chain', t: 0, at: GEAR.tell, target: t, dmg: o.dmg * p, n: S(o.time) });
      ev.push({ type: 'abilityFx', kind: 'line', id: 'chain', a: [s.x, s.y + 1, s.z], b: [t.x, t.y + (t.T?.chest ?? 0.9), t.z], life: 0.3 });
      return true;
    },
    shade(o, p, ev, w) {
      const s = sOf();
      G.effects.push({ kind: 'shade', t: 0, at: S(o.raise), r: o.r * w, arc: o.arc });
      ev.push({ type: 'abilityFx', kind: 'core', id: 'shade', at: [s.x + Math.sin(s.yaw) * 0.4, s.y + 1.3, s.z + Math.cos(s.yaw) * 0.4], life: o.raise });
      return true;
    }
  };
  // a press of the Off-hand: its off-hand starts, or only says no while it cools or the lamplighter cannot
  function press(ev) {
    const r = run(), x = r.offhand, o = offRow();
    if (!x || !o) return false;
    const f = R.fighter.f, s = sOf();
    if ((r.offCool | 0) > 0) { cue(ev, 'refuse', { offhand: x.id }); return true; }
    if (GEAR.busy.includes(f.move) || G.move || (GEAR.ground.includes(o.id) && !s.ground)) { cue(ev, 'refuse', { offhand: x.id, busy: true }); return true; }
    if (!START[o.id](o, powerOf('offhand', x), ev, traitWide(x))) { cue(ev, 'refuse', { offhand: x.id }); return true; }
    r.offCool = G.full = Math.max(1, Math.round(S(o.cool) * traitCool(x)));
    ev.push({ type: 'gear', what: 'use', kind: 'offhand', id: o.id });
    cue(ev, o.cue, { offhand: o.id, tier: tierOf(x) });
    emit('offhand-use', { id: o.id });
    return true;
  }
  // one play step of each off-hand effect under way, of the chain's pull, and of the burns
  function effects(ev) {
    for (const e of G.effects.slice()) {
      e.t++;
      if (e.t < e.at) continue;
      const s = sOf();
      let done = true;
      switch (e.kind) {
        case 'cuff':
          for (const t of live()) {
            const d = Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0);
            if (d > e.range || Math.abs(t.y - s.y) > 1.6 || Math.abs(wrap(Math.atan2(t.x - s.x, t.z - s.z) - s.yaw)) > 60 * DEG) continue;
            if (hurtFoe(t, e.dmg, 'cuff', ev, { interrupt: true }) === false) continue;
            wearPoise(t, e.poise, [s.x, s.z]);
            const l = Math.hypot(t.x - s.x, t.z - s.z) || 1;
            shove(t, (t.x - s.x) / l, (t.z - s.z) / l, e.push);
          }
          break;
        case 'sling':
          if (e.target?.alive) {
            const burning = e.target.status?.burn > 0;
            if (hurtFoe(e.target, e.dmg, 'sling', ev, { interrupt: true }) !== false && burning) putState(e.target, 'char', e.char);
          }
          break;
        case 'pot':
          for (const t of live()) {
            if (Math.hypot(t.x - e.where[0], t.z - e.where[2]) - (t.r || 0) > e.r || Math.abs(t.y - e.where[1]) > 2) continue;
            if (hurtFoe(t, e.dmg, 'pot', ev, { interrupt: true }) !== false) burn(t, e.burn, e.where);
          }
          ev.push({ type: 'abilityFx', kind: 'burst', id: 'pot', at: e.where, r: e.r });
          break;
        case 'chain': {
          const t = e.target;
          if (!t.alive) break;
          if (!e.go) {
            // the pull: to 1.0 m short of the foe's edge, over 0.2 s, safe on the way
            const dx = t.x - s.x, dz = t.z - s.z, d = Math.hypot(dx, dz) || 1, far = Math.max(0, d - (t.r || 0) - GEAR.chainShort);
            e.go = true;
            G.move = { from: [s.x, s.y, s.z], to: [s.x + (dx / d) * far, ground(s.x + (dx / d) * far, s.z + (dz / d) * far, s.y), s.z + (dz / d) * far], t: 0, n: e.n, yaw: Math.atan2(dx, dz) };
            R.fighter.f.safe = Math.max(R.fighter.f.safe, e.n + GEAR.chainSafe);
            done = false;
            break;
          }
          if (G.move) { done = false; break; }
          if (hurtFoe(t, e.dmg, 'chain', ev, { interrupt: true }) !== false) putState(t, 'mark', GEAR.mark);
          break;
        }
        case 'shade': {
          const half = (e.arc / 2) * DEG, hit = [];
          for (const t of live()) {
            const d = Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0);
            if (d > e.r || Math.abs(t.y - s.y) > 2 || Math.abs(wrap(Math.atan2(t.x - s.x, t.z - s.z) - s.yaw)) > half) continue;
            if (putState(t, 'blind', GEAR.blind)) hit.push(t);
          }
          ev.push({ type: 'abilityFx', kind: 'cone', id: 'shade', at: [s.x, s.y, s.z], yaw: s.yaw, r: e.r, arc: e.arc, hit: hit.length }, { type: 'gear', what: 'blind', targets: hit });
          break;
        }
      }
      if (done) G.effects.splice(G.effects.indexOf(e), 1);
    }
    if (G.move) {
      const m = G.move, k = ++m.t / m.n, p = [0, 1, 2].map(j => m.from[j] + (m.to[j] - m.from[j]) * k);
      R.fighter.body.place([p[0], p[1] + 0.05, p[2]], m.yaw);
      if (m.t >= m.n) G.move = null;
    }
    for (const b of G.burns.slice()) {
      if (!b.t.alive || b.left <= 0) { G.burns.splice(G.burns.indexOf(b), 1); continue; }
      b.left--;
      if (++b.k % GEAR.burn.every === 0) hurtFoe(b.t, GEAR.burn.dmg, 'burn', ev, { tick: true, interrupt: false, kind: 'burn' });
    }
  }

  /* ---------------- the traits on the hits ----------------
   Each hit is the held blade's (its string and slam), the off-hand's, or an ability slot's. Its item's traits ride on it */
  function itemOf(e) {
    const r = run();
    if (e.tick) return null;
    if (e.offhand) return e.offhand === 'burn' ? null : { kind: 'offhand', x: r.offhand };
    if (e.ability) { const x = (r.abilities || []).find(a => a && a.id === e.ability); return x ? { kind: 'ability', x } : null; }
    if (BLADE_KINDS.includes(e.kind)) return { kind: 'blade', x: r.blade };
    return null;
  }
  // a roll of a Steady hit: 6% from the seed, keyed to the play step and the hit's place in it, so the same seed and moves give the same
  const steadyRoll = k => mulberry(hash2(run().seed | 0, clock.play * 16 + k, 0x57ead))();
  // a sure cut's extra half: one more blow of half the damage, which never flinches (build.js makes the hit itself sure once it lands)
  function sure(t, dmg, ev, why) {
    if (!t.alive || !(dmg > 0)) return;
    const s = sOf(), more = t.hit(dmg * 0.5, { from: [s.x, s.z], push: 0, knock: 0, kind: 'sure', interrupt: false });
    if (more === false) return;
    ev.push({ type: 'hit', kind: 'relic', sure: why, target: t, dmg: more, tick: true });
    cue(ev, 'sure', { why });
  }
  function traits(ev) {
    const r = run(), list = ev.filter(e => e.type === 'hit' && e.target && !e.tick);
    let k = 0;
    for (const e of list) {
      const t = e.target, it = itemOf(e), s = sOf();
      // the sure cut readied (a parry) goes on the next blade hit
      if (R.sureNext && it?.kind === 'blade') { R.sureNext = false; sure(t, e.dmg, ev, 'parry'); }
      // the Hook blade's finisher pulls a light foe 1 m in; the Twin knives' fourth cut adds 1 Char; the Bell maul wears poise twice
      const h = it?.kind === 'blade' ? R.fighter.f : null, B = bladeOf(r.blade?.id);
      if (h && B?.pull && e.kind === 'fin' && t.alive) { const l = Math.hypot(t.x - s.x, t.z - s.z) || 1; shove(t, (s.x - t.x) / l, (s.z - t.z) / l, Math.min(B.pull, Math.max(0, l - (t.r || 0) - 0.6))); }
      if (h && B?.id === 'twin' && h.hit === 4 && e.kind === 'cut1') putState(t, 'char', B.char);
      if (h && B?.poise > 1) wearPoise(t, (B.poise - 1) * e.dmg, [s.x, s.z]);
      if (!it?.x) continue;
      const x = it.x, key = `${it.kind}:${x.id}`, n = (G.hits.get(key) || 0) + 1;
      G.hits.set(key, n);
      for (const id of traitsOf(x)) {
        const T = traitOf(id);
        if (id === 'smoulder') burn(t, S(it.kind === 'blade' ? T.burn : T.burnOther), [s.x, s.z], false);
        else if (id === 'steady' && steadyRoll(k++) < T.sure) sure(t, e.dmg, ev, 'steady');
        else if (id === 'char' && n % T.every === 0) putState(t, 'char', T.char);
        else if (id === 'dim' && n % T.every === 0) putState(t, 'blind', S(T.blind));
        else if (id === 'weight') wearPoise(t, T.poise * e.dmg, [s.x, s.z]);
      }
      // a foe this item put out
      if (!t.alive) {
        if (hasTrait(x, 'glean') && !R.dead) r.hp = Math.min(R.max(), r.hp + dealt(traitOf('glean').heal, R.max()));
        if (hasTrait(x, 'hoard')) R.drop(traitOf('hoard').glim, [t.x, t.y, t.z]);
        if (hasTrait(x, 'shelling')) addShell(R, traitOf('shelling').shell, S(traitOf('shelling').time), 'shelling');
      }
    }
  }

  /* ---------------- gear on the ground ----------------
   A found blade or off-hand lies on the ground with a glow in its colour. Standing on it shows the compare toast. Holding Attack 0.4 s
   takes a blade and Off-hand 0.4 s an off-hand, and the old one lies there with its tier and traits; a tap still cuts or uses. With no
   off-hand held, a touch takes one at once */
  function underfoot(ev) {
    const r = run(), s = sOf();
    G.under = null;
    for (const l of lamps().slice()) {
      if (Math.hypot(s.x - l.x, s.z - l.z) > GEAR.touch || Math.abs(s.y - l.y) > 1.6) continue;
      if (l.kind === 'offhand' && !r.offhand) {
        r.offhand = gearCopy(l);
        r.gearLamps.splice(r.gearLamps.indexOf(l), 1);
        R.notes.push(`<b>${itemName('offhand', r.offhand)}</b> in the off-hand`);
        ev.push({ type: 'gear', what: 'take', kind: 'offhand', id: l.id }, { type: 'store' });
        cue(ev, 'swap', { kind: 'offhand', id: l.id, tier: tierOf(l) });
        continue;
      }
      G.under = l;
      break;
    }
    if (G.under && G.note !== G.under) {
      G.note = G.under;
      const how = G.under.kind === 'blade' ? 'hold Attack to swap' : 'hold Off-hand to swap';
      R.notes.push(`<b>${itemName(G.under.kind, G.under)}</b> · ${how}`);
      ev.push({ type: 'gear', what: 'lamp', kind: G.under.kind, id: G.under.id });
    }
    if (!G.under) G.note = null;
  }
  function swap(l, ev) {
    const r = run(), old = r[l.kind];
    r[l.kind] = gearCopy(l);
    const i = r.gearLamps.indexOf(l);
    if (old) r.gearLamps.splice(i, 1, { kind: l.kind, ...gearCopy(old), place: r.place, x: l.x, y: l.y, z: l.z });
    else r.gearLamps.splice(i, 1);
    G.note = null; G.under = null;
    R.notes.push(`<b>${itemName(l.kind, r[l.kind])}</b> taken`);
    ev.push({ type: 'gear', what: 'swap', kind: l.kind, id: l.id, old: old?.id ?? null }, { type: 'store' });
    cue(ev, 'swap', { kind: l.kind, id: l.id, tier: tierOf(l) });
    emit('gear-swap', { kind: l.kind, id: l.id });
  }
  // a gear item laid on the ground at `at` -> the lamp (an ability goes to the abilities' own lamps), or null
  function lay(kind, item, at, ev) {
    const r = run();
    if (kind === 'ability') { const l = R.abilities ? dropAbility(R, at, item) : null; if (!l) return null; ring(item, kind, ev); return { kind, ...l }; }
    if (lamps().length >= GEAR_DROPS.lamps) return null;
    const l = { kind, ...gearCopy(item), place: r.place, x: at[0], y: at[1], z: at[2] };
    r.gearLamps.push(l);
    ring(item, kind, ev);
    return l;
  }
  // a bright or blazing drop rings as it lands
  function ring(item, kind, ev) {
    const t = tierOf(item);
    if (t !== 'plain' && ev) cue(ev, t, { kind, id: item.id, tier: t });
  }
  /* a foe put out rolls once for gear (run.js foeOut): 3% and 1% more a Keen eye level, 60% for an elite, at most 3 a place. The kind,
   then one kindled item of that kind, from the seed's `gear` stream; the tier and traits from `tier` and `trait` (gear.js rollGear) */
  G.foeOut = (at, elite = false) => {
    const r = run();
    if (!r || (r.gearDrops | 0) >= GEAR_DROPS.max) return null;
    const roll = gearRoll(r, 'gear'), chance = elite ? GEAR_DROPS.elite : GEAR_DROPS.chance + GEAR_DROPS.perKeen * (rs.up?.keen | 0);
    if (roll() >= chance) return null;
    const kind = gearKind(rs, roll), list = kind === 'ability' ? kindledOf(rs, 'ability') : kindledGear(rs, kind);
    if (!list.length) return null;
    const item = { id: list[Math.floor(roll() * list.length)], ...rollGear(rs, kind, { elite }) };
    const ev = R.out || [], s = sOf(), l = lay(kind, item, at || [s.x, s.y, s.z], ev);
    if (!l) return null;
    r.gearDrops = (r.gearDrops | 0) + 1;
    ev.push({ type: 'gear', what: 'drop', kind, id: item.id, tier: item.tier, traits: item.traits.slice() }, { type: 'store' });
    return { kind, ...item };
  };
  // a test hook and a cache: lay a given item on the ground
  G.lay = (kind, item, at) => lay(kind, item, at, R.out || []);

  /* ---------------- the Buckler ----------------
   A blow in the first 0.2 s of the raise is parried: 0 damage, a light foe staggers 0.6 s, a heavy foe loses 30 poise, and the next cut
   is sure. A blow later in the 0.6 s raise deals 40%. -> 'parry', the damage left, or null (the Buckler is not up) */
  G.block = (dmg, from, ev = R.out, o = {}) => {
    const r = run();
    if (!r || r.offhand?.id !== 'buckler' || R.dead) return null;
    const B = offhandOf('buckler'), t = clock.play - G.raise;
    if (t < 0 || t >= S(B.raise)) return null;
    if (t < S(B.parry)) {
      // the foe that swung: the nearest target to where the blow came from, within 1.2 m (a coal has none)
      let foe = null, best = 1.2;
      if (from && !o.coal) for (const x of live()) { const d = Math.hypot(x.x - from[0], x.z - from[1]); if (d < best) { foe = x; best = d; } }
      const s = sOf();
      if (foe) {
        if (isFoe(foe) && heavyOf(foe)) wearPoise(foe, B.poise, [s.x, s.z]);
        else foe.hit(0, { from: [s.x, s.z], push: 0, knock: S(B.stagger), stagger: true, kind: 'parry', parry: true });
      }
      markSure(R);
      G.raise = -1e9;
      ev.push({ type: 'gear', what: 'parry', target: foe }, { type: 'stop', n: 3 });
      cue(ev, 'parry', { offhand: 'buckler' });
      return 'parry';
    }
    cue(ev, 'clang', { offhand: 'buckler', block: true });
    return Math.round(dmg * B.late);
  };

  /* ---------------- one play step ---------------- */
  G.step = (a, ev) => {
    const r = run();
    if (!r || R.dead) return ev;
    if ((r.offCool | 0) > 0) { r.offCool--; if (r.offCool === 0 && r.offhand) ev.push({ type: 'gear', what: 'ready', kind: 'offhand' }); }
    underfoot(ev);
    // Attack held: on a blade underfoot 0.4 s takes it; with the Bell maul 0.5 s slams (it waits while a blade lies underfoot)
    G.heldA = a.attack ? G.heldA + 1 : 0;
    if (G.under?.kind === 'blade' && G.heldA === GEAR.swap) swap(G.under, ev);
    const slam = slamOf(r.blade), f = R.fighter.f;
    if (slam && !G.under && G.heldA >= slam.steps && G.heldA !== Infinity && R.fighter.body.s.ground && (!f.move || f.move === 'hit')) {
      G.heldA = Infinity;
      slamNow(slam, ev);
    }
    // the Off-hand: a press (kept 0.15 s) uses it; held 0.4 s on an off-hand underfoot takes that one
    const h = !!a.off;
    G.buf = h && !G.was ? GEAR.buffer : Math.max(0, G.buf - 1);
    G.was = h;
    G.heldO = h ? G.heldO + 1 : 0;
    if (G.buf > 0 && press(ev)) G.buf = 0;
    if (G.under?.kind === 'offhand' && G.heldO === GEAR.swap) swap(G.under, ev);
    effects(ev);
    traits(ev);
    return ev;
  };
  // the Bell maul's slam: 30 (with the blade's bonus and tier) to each target within 2.5 m, the plunge's landing pose and its ring
  function slamNow(sl, ev) {
    const s = sOf(), raw = sl.dmg * (1 + (R.bonus?.() || 0)), on = [];
    R.fighter.land();
    for (const t of live()) {
      if (Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0) > sl.r || Math.abs(t.y - s.y) > 1.6) continue;
      const dmg = t.hit(raw, { from: [s.x, s.z], push: 1.0, knock: S(0.6), stagger: true, kind: 'slam' });
      if (dmg === false) continue;
      on.push(t.type || 'post');
      ev.push({ type: 'hit', kind: 'slam', target: t, dmg });
    }
    ev.push({ type: 'ring', x: s.x, y: s.y, z: s.z, r: sl.r });
    if (on.length) ev.push({ type: 'stop', n: 5 });
    cue(ev, 'slam', { blade: 'bell', on, ...(on.length ? { stop: 5 } : {}) });
  }

  /* ---------------- what the runner and the page read ---------------- */
  G.blade = () => run()?.blade || null;
  G.colour = () => bladeOf(run()?.blade?.id)?.colour || 'flame';
  G.underfoot = () => G.under?.kind === 'blade';
  G.raised = () => clock.play - G.raise < S(offhandOf('buckler').raise);
  // the compare toast: the held item over the found one, and how to swap (an ability lamp underfoot counts too)
  G.compare = () => {
    const r = run();
    if (!r) return null;
    if (G.under) return { kind: G.under.kind, held: gearCopy(r[G.under.kind]), found: gearCopy(G.under), how: G.under.kind === 'blade' ? 'Hold Attack to swap' : 'Hold Off-hand to swap' };
    const al = R.abilities?.onLamp;
    if (al) return { kind: 'ability', held: gearCopy((r.abilities || [])[0]), held2: gearCopy((r.abilities || [])[1]), found: gearCopy(al), how: 'Press an ability to swap' };
    return null;
  };
  // the HUD and __gloam.run(): the blade, the off-hand with its cooldown, the gear on the ground here and the compare toast's data
  G.view = () => {
    const r = run();
    if (!r) return null;
    const off = r.offhand, o = offRow();
    return {
      blade: r.blade ? { ...gearCopy(r.blade), name: bladeOf(r.blade.id)?.name, colour: bladeOf(r.blade.id)?.colour } : null,
      offhand: off ? { ...gearCopy(off), name: o?.name, colour: o?.colour, left: +((r.offCool | 0) / 60).toFixed(2), share: (r.offCool | 0) / Math.max(1, G.full || S(o?.cool || 1)), raised: G.raised() } : null,
      lamps: lamps().map(l => ({ ...l, traits: l.traits.slice(), name: rowOf(l.kind, l.id)?.name, colour: rowOf(l.kind, l.id)?.colour })),
      compare: G.compare(), sure: !!R.sureNext
    };
  };
  // the test hook: the off-hand's cooldown left, in seconds
  G.setCool = v => { if (Number.isFinite(v) && run()) { run().offCool = Math.max(0, Math.round(v * 60)); G.full = Math.max(G.full || 1, run().offCool); } };
  return G;
}
// what the fight draws: each blade or off-hand on the ground as a glow in its colour (fight.js draws it with the ability lamps)
export const groundGear = R => (R?.rs?.run?.gearLamps || []).filter(l => l.place === R.rs.run.place)
  .map(l => ({ ...l, colour: rowOf(l.kind, l.id)?.colour || 'gloam', name: rowOf(l.kind, l.id)?.name || l.id, bright: tierOf(l) !== 'plain' }));
/* ?test (__gloam.gear): set the held blade and off-hand ({ id, tier, traits } or an id; null for no off-hand), lay an item on the ground
   ({ kind, id, tier, traits, at }; at defaults to the lamplighter's feet), press the Off-hand on the next play step (off), and set the
   off-hand's cooldown in seconds (cool). -> the gear's view */
export function gearTest(R, o = {}) {
  const run = R?.rs?.run;
  if (!run || !R.gear) return null;
  const take = (kind, v) => { const x = typeof v === 'string' ? { id: v } : v; return x && rowOf(kind, x.id) ? gearCopy({ id: x.id, tier: x.tier, traits: x.traits }) : null; };
  if (o.blade) run.blade = take('blade', o.blade) || run.blade;
  if ('offhand' in o) run.offhand = take('offhand', o.offhand);
  if (o.clear) run.gearLamps = [];
  if (o.lay) { const s = R.fighter.body.s; R.gear.lay(o.lay.kind, { id: o.lay.id, tier: o.lay.tier || 'plain', traits: o.lay.traits || [] }, o.lay.at || [s.x, s.y, s.z]); }
  if (o.off) R.pend.off = true;
  if (Number.isFinite(o.cool)) R.gear.setCool(o.cool);
  return R.gear.view();
}
