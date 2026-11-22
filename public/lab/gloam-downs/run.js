// Gloam Downs: the run. The fixed step and its count, the two clocks, the seed's streams, the run's numbers (health, flasks, the
// wicks and the upgrades) and its rules (the entry snapshot, a reload, hits, drinks, falls, glim, the beacon, death and the win), and
// the runner that steps one place of a run. No DOM, so Node tests and the bot use it as it is.
import { ORDER } from './save.js';
import { touches, atBeacon } from './play.js';
import { makeFighter, MOVES, dealt } from './moves.js';
import { mulberry, hash2 } from '../kit/rng.js';

/* ---------------- the step ----------------
   The game steps at a fixed 1/60 s, as many steps as the frame took, up to 15 a frame. The small term keeps a frame of 24/144 s from
   flooring to 9 steps in floating point. A frame reads the input before its steps; a press counts on the first step that runs after
   it is read, in that frame or a later one */
export const STEP = 1 / 60, MAX_STEPS = 15;
export const steps = sec => Math.round(sec * 60);
export function stepCount(acc, dt) {
  const a = acc + Math.max(0, dt || 0), n = Math.floor(a * 60 + 1e-6);
  return n > MAX_STEPS ? { n: MAX_STEPS, acc: 0 } : { n, acc: a - n / 60 };
}

/* ---------------- the two clocks ----------------
   The game clock counts every step. The play clock counts the steps outside hit stop: moves, wind-ups, recoveries, safe time and
   cooldowns run on it. Effects (flash, tint, blink, kick, zoom, bars, grade) count the game clock. Hit stop takes no more than 9 steps
   in any 30 */
export const STOP_CAP = 9, STOP_SPAN = 30;
export const makeClock = () => ({ step: 0, play: 0, stop: 0, spent: [] });
export function hitStop(c, n) {
  while (c.spent.length && c.spent[0] <= c.step - STOP_SPAN) c.spent.shift();
  const room = Math.max(0, STOP_CAP - c.spent.length);
  c.stop = Math.max(c.stop, Math.min(n, room));
  return c.stop;
}
// one game step: true when the play clock runs in it
export function advance(c) {
  c.step++;
  while (c.spent.length && c.spent[0] <= c.step - STOP_SPAN) c.spent.shift();
  if (c.stop > 0) { c.stop--; c.spent.push(c.step); return false; }
  c.play++;
  return true;
}

/* ---------------- the seed ----------------
   Each run has a seed. Its streams are apart: the wick offers draw from their own, so the foes' choices never move them. The offer at
   beacon k draws two of the wicks not yet chosen, so it depends on the seed and the wicks chosen before it alone */
export const newSeed = (runs, now = Date.now()) => hash2(runs | 0, now % 2147483647, 0x5eed) || 1;
export const stream = (seed, name) => mulberry(hash2(seed | 0, typeof name === 'number' ? name : [...name].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261), 0x51ed));
export function drawOffer(seed, k, chosen = []) {
  const left = WICKS.map(w => w.id).filter(id => !chosen.includes(id));
  if (left.length <= 2) return left;
  const r = mulberry(hash2(seed | 0, k + 1, 0x77c1));
  const i = Math.floor(r() * left.length);
  let j = Math.floor(r() * (left.length - 1));
  if (j >= i) j++;
  return [left[i], left[j]];
}

/* ---------------- the numbers ---------------- */
export const BASE = { hp: 100, flasks: 2, heal: 0.35, wisp: 4, boss: 30 };
export const WICKS = [
  { id: 'long', name: 'Long wick', text: '+20 health' },
  { id: 'keen', name: 'Keen edge', text: '+15% blade damage' },
  { id: 'heels', name: 'Quick heels', text: 'roll again after 0.12 s' },
  { id: 'heavy', name: 'Heavy fall', text: 'plunge ×1.5 and wider' },
  { id: 'oil', name: 'Spare oil', text: '+1 flask' },
  { id: 'shave', name: 'Close shave', text: '+50% after a near miss' }
];
export const UPGRADES = [
  { id: 'mantle', name: 'Mantle', costs: [40, 80, 140] },
  { id: 'flask', name: 'Flask', costs: [60, 150] },
  { id: 'edge', name: 'Edge', costs: [50, 100, 170] },
  { id: 'draught', name: 'Draught', costs: [45, 110] },
  { id: 'ash', name: 'Ash pocket', costs: [120] }
];
export const UP_MAX = Object.fromEntries(UPGRADES.map(u => [u.id, u.costs.length]));
const has = (wicks, id) => (wicks || []).includes(id);
export const maxHp = (up, wicks) => BASE.hp + 15 * (up.mantle || 0) + (has(wicks, 'long') ? 20 : 0);
export const flasksMax = (up, wicks) => BASE.flasks + (up.flask || 0) + (has(wicks, 'oil') ? 1 : 0);
export const healShare = up => BASE.heal + 0.1 * (up.draught || 0);
// the blade's bonuses add (Edge and Keen edge raise the plunge too); damage and heals round once, at the end
export const bladeBonus = (up, wicks) => 0.12 * (up.edge || 0) + (has(wicks, 'keen') ? 0.15 : 0);
export const healOf = (up, max) => dealt(healShare(up), max);

/* ---------------- the run's rules ----------------
   rs is the run save (run-save.js); rs.run the run in progress or null. entry holds the values the place was entered with: a reload
   restarts the place with health and flasks no higher than they were, and the glim carried and the foes count as they were */
export function startRun(rs, seed) {
  const max = maxHp(rs.up, []), fl = flasksMax(rs.up, []);
  rs.run = { seed: seed >>> 0 || 1, place: ORDER[0], time: 0, hp: max, flasks: fl, carried: 0, banked: 0, foes: 0, wicks: [], offer: null, bossDown: false, entry: null };
  enter(rs.run);
  rs.wander = false;
  rs.ended = null;
  return rs.run;
}
export function enter(run) { run.entry = { hp: run.hp, flasks: run.flasks, carried: run.carried, foes: run.foes }; return run; }
// after the boss's fall the boss stays down, so a reload keeps its 30 glim and its one foe on top of the entry values
export function reload(run) {
  const e = run.entry || enter(run).entry, down = run.bossDown ? 1 : 0;
  run.hp = Math.min(run.hp, e.hp);
  run.flasks = Math.min(run.flasks, e.flasks);
  run.carried = e.carried + down * BASE.boss;
  run.foes = e.foes + down;
  return run;
}
// move the run to the start of a place, as Walk on does: the entry snapshot is taken from the values now
export function goTo(rs, id) {
  rs.run.place = id;
  rs.furthest = Math.max(rs.furthest || 0, ORDER.indexOf(id));
  enter(rs.run);
}
export const maxOf = rs => maxHp(rs.up, rs.run?.wicks);
export const flasksOf = rs => flasksMax(rs.up, rs.run?.wicks);
// a wick chosen raises the run and the entry by what it gives, so a reload keeps it
export function chooseWick(rs, id) {
  const run = rs.run;
  if (!run || !run.offer || !run.offer.includes(id) || run.wicks.includes(id)) return false;
  run.wicks.push(id);
  run.offer = null;
  if (id === 'long') { run.hp += 20; run.entry.hp += 20; }
  if (id === 'oil') { run.flasks += 1; run.entry.flasks += 1; }
  return true;
}
// a buy in the Lamp-room or at a beacon: a Mantle level bought in a run raises the health too, and a Flask level adds a full flask
export function buy(rs, id) {
  const u = UPGRADES.find(x => x.id === id), lvl = rs.up[id] || 0;
  if (!u || lvl >= u.costs.length || rs.bank < u.costs[lvl]) return false;
  rs.bank -= u.costs[lvl];
  rs.up[id] = lvl + 1;
  const run = rs.run;
  if (run && id === 'mantle') { run.hp += 15; run.entry.hp += 15; }
  if (run && id === 'flask') { run.flasks += 1; run.entry.flasks += 1; }
  return true;
}
// a lit beacon banks the glim carried and fills every flask; before the last place it moves the run to the next place with two wicks
// offered; at the last it is the win
export function lightBeacon(rs) {
  const run = rs.run, i = ORDER.indexOf(run.place);
  rs.bank += run.carried;
  run.banked += run.carried;
  run.carried = 0;
  run.flasks = flasksOf(rs);
  if (i === ORDER.length - 1) return win(rs);
  run.offer = drawOffer(run.seed, i, run.wicks);
  goTo(rs, ORDER[i + 1]);
  return { next: run.place, offer: run.offer.slice() };
}
export function win(rs) {
  const run = rs.run;
  rs.wins += 1;
  rs.runs += 1;
  if (!rs.bestWin || run.time < rs.bestWin) rs.bestWin = run.time;
  rs.ended = { won: true, place: run.place, time: run.time, foes: run.foes, lost: 0, banked: run.banked };
  rs.run = null;
  return { won: true };
}
// at 0 health: the glim carried is lost, but Ash pocket banks 30% of it, rounded down
export function die(rs) {
  const run = rs.run, kept = rs.up.ash ? Math.floor(run.carried * 0.3) : 0;
  rs.bank += kept;
  rs.runs += 1;
  rs.deaths += 1;
  rs.ended = { won: false, place: run.place, time: run.time, foes: run.foes, lost: run.carried - kept, banked: run.banked + kept };
  rs.run = null;
  return rs.ended;
}

/* ---------------- the runner ----------------
   One place of a run: the clocks, the fighter on the page's body, wisps, the beacon and falls. step(act, camYaw) runs one game step;
   the fighter moves only on play steps. It returns what happened ({ type, ... }), and keeps a log of sound cues with their game and
   play steps. The page and the bot wire it to their own targets, foes and screens:
   - targets(): the live targets the blade and soft aim test (stage 2's foes, the boss, training posts);
   - lightable(): { ok, why } when a touch on the beacon may light it (stage 2's guard zones, stage 3's boss);
   - drop(n, at): glim that drops (default: straight into the glim carried; stage 2 drops motes that fly in);
   - think(ev, play): runs after the lamplighter on every game step (stage 2's foes; play is false in hit stop). A foe's hit calls
     runner.hurt(dmg, from, { push });
   - onLight(): runs when a beacon lights, before it banks (the foes' glim motes not yet taken count as carried). */
export function makeRunner({ walk, meta, body, rs, targets = () => [], lightable = () => ({ ok: true }), drop = null, think = null, onLight = null, still = false, log = [], fx = {}, clock = makeClock() }) {
  // fx.stop false turns hit stop off (__gloam.fx), so the game must still play with it off
  const stop = n => (fx.stop === false ? 0 : hitStop(clock, n));
  const stats = () => {
    const run = rs.run;
    if (!run) return {};
    return {
      bonus: bladeBonus(rs.up, run.wicks), heavy: run.wicks.includes('heavy'), quick: run.wicks.includes('heels'), shave: run.wicks.includes('shave'),
      drink: run.flasks <= 0 ? 'empty' : run.hp >= maxOf(rs) ? 'full' : 'ok'
    };
  };
  const fighter = makeFighter(body, walk, { stats });
  const R = {
    clock, fighter, rs, meta, log, fx, wisps: new Set(), lit: false, dead: false, onBeacon: false, hurtAt: -1, blink: still ? 8 : 4,
    pend: { attack: false, roll: false, heal: false }, targets, lightable, think,
    drop: drop || ((n) => { if (rs.run) rs.run.carried += n; })
  };
  const cue = (ev, name, more) => { const c = { cue: name, step: clock.step, play: clock.play, ...more }; R.log.push(c); ev.push({ type: 'cue', ...c, logged: true }); };
  function take(i, ev) {
    if (R.wisps.has(i)) return;
    R.wisps.add(i);
    R.drop(BASE.wisp, meta.wisps[i].p);
    // the fifth wisp of a place fills one flask
    if (R.wisps.size === 5 && rs.run) rs.run.flasks = Math.min(flasksOf(rs), rs.run.flasks + 1);
    ev.push({ type: 'wisp', i, n: R.wisps.size });
    cue(ev, 'wisp');
  }
  // a touch on the beacon, by the lamplighter's feet or by __gloam.light()
  function light(ev = []) {
    if (R.lit || !rs.run || R.dead) return ev;
    const may = R.lightable();
    if (!may.ok) { ev.push({ type: 'dark', why: may.why, at: may.at }); return ev; }
    R.lit = true;
    onLight?.();
    const out = lightBeacon(rs);
    ev.push(out.won ? { type: 'win' } : { type: 'beacon', next: out.next, offer: out.offer }, { type: 'store' });
    cue(ev, 'beacon');
    return ev;
  }
  /* a hit on the lamplighter from a foe: in the roll's safe time it passes (a near miss, which Close shave rewards), in the 0.9 s
     after a hit it does nothing, else it takes its damage, pushes the lamplighter (1.2 m, or o.push), stops the game for 5 steps and
     stores the run at once. -> 'hit', 'safe', 'dead' or 'none' */
  function hurt(dmg, from, o = {}, ev = R.out) {
    const run = rs.run;
    if (!run || R.dead) return 'none';
    const safe = fighter.safe();
    if (safe) {
      if (safe === 'roll') { if (run.wicks.includes('shave')) fighter.nearMiss(); ev.push({ type: 'miss' }); }
      return 'safe';
    }
    run.hp = Math.max(0, run.hp - Math.round(dmg));
    fighter.knock(from, o.push ?? MOVES.hurt.push);
    R.hurtAt = clock.step;
    stop(MOVES.hurt.stop);
    ev.push({ type: 'hurt', dmg, hp: run.hp }, { type: 'store' });
    cue(ev, 'hurt');
    if (run.hp <= 0) { kill(ev); return 'dead'; }
    return 'hit';
  }
  function kill(ev) {
    R.dead = true;
    stop(9);
    const ended = die(rs);
    ev.push({ type: 'dead', ended }, { type: 'store' });
    cue(ev, 'death');
  }
  function step(act, camYaw) {
    const ev = (R.out = []);
    // a press during hit stop waits for the next play step
    for (const k of ['attack', 'roll', 'heal']) if (act[k]) R.pend[k] = true;
    const play = advance(clock);
    if (play && rs.run && !R.dead) {
      const a = { ...act, attack: act.attack || R.pend.attack, roll: act.roll || R.pend.roll, heal: act.heal || R.pend.heal };
      R.pend.attack = R.pend.roll = R.pend.heal = false;
      fighter.step(a, camYaw, R.targets(), ev);
      rs.run.time += STEP;
      const s = body.s;
      meta.wisps.forEach((w, i) => { if (!R.wisps.has(i) && touches(s, w.p)) take(i, ev); });
      const on = atBeacon(s, meta.beacon);
      if (on && !R.onBeacon) light(ev);
      R.onBeacon = on;
      // a fall below y -25 does not end the run: back on the last firm ground, 10 health lost (never below 1), and safe a while
      if (rs.run && s.y < MOVES.fall.below) {
        fighter.toFirm();
        rs.run.hp = Math.max(1, rs.run.hp - MOVES.fall.dmg);
        fighter.f.safe = MOVES.hurt.safe;
        R.hurtAt = clock.step;
        ev.push({ type: 'fall', hp: rs.run.hp }, { type: 'store' });
        cue(ev, 'fall');
      }
    }
    if (R.think) R.think(ev, play);
    for (const e of ev.slice()) {
      if (e.type === 'stop') stop(e.n);
      // a drink that ends after the flasks went to 0 (a test hook, a later stage's cost) heals nothing and takes nothing
      else if (e.type === 'drink' && rs.run && rs.run.flasks > 0) {
        rs.run.flasks -= 1;
        rs.run.hp = Math.min(maxOf(rs), rs.run.hp + healOf(rs.up, maxOf(rs)));
        ev.push({ type: 'store' });
      } else if (e.type === 'cue' && !e.logged) R.log.push({ cue: e.cue, step: clock.step, play: clock.play, ...(e.hit ? { hit: e.hit } : {}) });
    }
    // the hurt blink: the figure hides and shows every 4 game steps (8 with reduced motion) while the hit's safe time lasts. The
    // fighter stops stepping at 0 health, so its safe time stops counting: the figure stays shown through the death fade
    body.s.hide = !R.dead && fighter.f.safe > 0 && R.hurtAt >= 0 && Math.floor((clock.step - R.hurtAt) / R.blink) % 2 === 0;
    return ev;
  }
  R.step = step; R.hurt = hurt; R.light = light; R.take = take; R.kill = (ev = R.out) => { if (rs.run && !R.dead) kill(ev); return ev; };
  // a foe put out: one more for the run's count, and its glim drops
  R.out = [];
  R.foeOut = (glim = 0, at = null) => { if (rs.run) { rs.run.foes += 1; if (glim) R.drop(glim, at); } };
  return R;
}
