// Gloam Downs: the run. The fixed step and its count, the two clocks, the seed's streams, the run's numbers (health, flasks, the
// wicks and the upgrades) and its rules (the entry snapshot, a reload, hits, drinks, falls, glim, the beacon, death and the win), and
// the runner that steps one place of a run. No DOM, so Node tests and the bot use it as it is.
import { ORDER } from './save.js';
import { touches, atBeacon } from './play.js';
import { makeFighter, MOVES, BUILD, dealt } from './moves.js';
import { makeRelics, drawRelic } from './relics.js';
import { emit } from './bus.js';
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
// the wicks a beacon may offer: the six of every run, and the three that an unlock adds once bought
export const offerable = (unlocks = []) => WICKS.filter(w => !w.unlock || unlocks.includes(w.unlock)).map(w => w.id);
export function drawOffer(seed, k, chosen = [], unlocks = []) {
  const left = offerable(unlocks).filter(id => !chosen.includes(id));
  if (left.length <= 2) return left;
  const r = mulberry(hash2(seed | 0, k + 1, 0x77c1));
  const i = Math.floor(r() * left.length);
  let j = Math.floor(r() * (left.length - 1));
  if (j >= i) j++;
  return [left[i], left[j]];
}
// Wick shelf: the two wicks a run may start with, from the seed's own `start` stream
export function startOffer(seed, unlocks = []) {
  const left = offerable(unlocks), r = stream(seed, 'start');
  const i = Math.floor(r() * left.length);
  let j = Math.floor(r() * (left.length - 1));
  if (j >= i) j++;
  return [left[i], left[j]];
}

/* ---------------- the numbers ---------------- */
export const BASE = { hp: 100, flasks: 2, heal: 0.35, wisp: 4, boss: 30, elite: 15 };
export const WICKS = [
  { id: 'long', name: 'Long wick', text: '+20 health' },
  { id: 'keen', name: 'Keen edge', text: '+15% blade damage' },
  { id: 'heels', name: 'Quick heels', text: 'roll again after 0.12 s' },
  { id: 'heavy', name: 'Heavy fall', text: 'plunge ×1.5 and wider' },
  { id: 'oil', name: 'Spare oil', text: '+1 flask' },
  { id: 'shave', name: 'Close shave', text: '+50% after a near miss' },
  { id: 'tongue', name: 'Ember tongue', text: 'blade hits burn for 6 more', unlock: 'tongue' },
  { id: 'heart', name: 'Glim heart', text: 'each glim heals 1', unlock: 'heart' },
  { id: 'last', name: 'Last ember', text: 'stand again once, at 25%', unlock: 'last' }
];
export const UPGRADES = [
  { id: 'mantle', name: 'Mantle', costs: [40, 80, 140] },
  { id: 'flask', name: 'Flask', costs: [60, 150, 260] },
  { id: 'edge', name: 'Edge', costs: [50, 100, 170] },
  { id: 'draught', name: 'Draught', costs: [45, 110] },
  { id: 'ash', name: 'Ash pocket', costs: [120] }
];
// the unlocks: each is bought once in the Lamp-room, and lasts for every run
export const UNLOCKS = [
  { id: 'tongue', name: 'Ember tongue', text: 'a new wick: blade hits burn', cost: 90 },
  { id: 'heart', name: 'Glim heart', text: 'a new wick: glim heals', cost: 100 },
  { id: 'last', name: 'Last ember', text: 'a new wick: stand again once', cost: 220 },
  { id: 'shelf', name: 'Wick shelf', text: 'start each run with a wick', cost: 160 },
  { id: 'kflask', name: 'Kindled flask', text: 'an elite fills a flask', cost: 80 },
  { id: 'rising', name: 'Rising cut', text: 'attack as a roll ends', cost: 140 },
  { id: 'parry', name: 'Ember parry', text: 'a first cut turns a blow', cost: 200 }
];
export const UNLOCK_IDS = UNLOCKS.map(u => u.id);
export const UP_MAX = Object.fromEntries(UPGRADES.map(u => [u.id, u.costs.length]));
/* the Ember levels: a win at Ember n opens n + 1, up to 5. Each keeps the rules under it and adds 15% to the glim of foes and wisps.
   design.md "Ember levels" */
export const EMBER_TOP = 5;
export const EMBER = [
  'the first run',
  'the seed orders places II to IV; elites have 30% more health',
  'foe cooldowns 15% shorter; one flask fewer',
  'one more foe in each zone; flasks heal 10% less',
  'elites use their special move twice as often; foes deal 20% more',
  'the Barrow Reeve has 25% more health; a beacon fills one flask'
];
export const emberOf = run => Math.max(0, Math.min(EMBER_TOP, run?.ember | 0));
export const glimFactor = ember => 1 + 0.15 * (ember | 0);
export const ember = n => ({
  route: n >= 1, eliteHp: n >= 1 ? 1.3 : 1, cool: n >= 2 ? 0.85 : 1, flaskCut: n >= 2 ? 1 : 0, extraFoe: n >= 3, healCut: n >= 3 ? 0.1 : 0,
  special: n >= 4 ? 2 : 1, dmg: n >= 4 ? 1.2 : 1, bossHp: n >= 5 ? 1.25 : 1, phase3: n >= 5 ? 0.4 : null, beaconFlasks: n >= 5 ? 1 : Infinity
});
const has = (wicks, id) => (wicks || []).includes(id);
export const maxHp = (up, wicks) => BASE.hp + 15 * (up.mantle || 0) + (has(wicks, 'long') ? 20 : 0);
export const flasksMax = (up, wicks, em = 0) => Math.max(1, BASE.flasks + (up.flask || 0) + (has(wicks, 'oil') ? 1 : 0) - ember(em).flaskCut);
export const healShare = (up, em = 0) => BASE.heal + 0.1 * (up.draught || 0) - ember(em).healCut;
// the blade's bonuses add (Edge and Keen edge raise the plunge too); damage and heals round once, at the end
export const bladeBonus = (up, wicks) => 0.12 * (up.edge || 0) + (has(wicks, 'keen') ? 0.15 : 0);
export const healOf = (up, max, em = 0) => dealt(healShare(up, em), max);
// a death keeps a share of the glim carried: 25%, or 55% with Ash pocket (Cinders), rounded down
export const keepShare = up => (up.ash ? 0.55 : 0.25);
/* the order of a run's places. Below Ember 1 it is the order of the downs; from Ember 1 the seed's `route` stream orders places II
   to IV, with the Gaol always first and Barrow Crown always last */
export function routeFor(seed, em = 0) {
  if (!ember(em).route) return ORDER.slice();
  const mid = ORDER.slice(1, 4), r = stream(seed, 'route');
  for (let i = mid.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [mid[i], mid[j]] = [mid[j], mid[i]]; }
  return [ORDER[0], ...mid, ORDER[4]];
}
export const routeOfRun = run => (run?.route?.length === ORDER.length ? run.route : ORDER);

/* ---------------- the run's rules ----------------
   rs is the run save (run-save.js); rs.run the run in progress or null. entry holds the values the place was entered with: a reload
   restarts the place with health and flasks no higher than they were, and the glim carried, the foes, the relics and the elites put
   out count as they were. The run's Ember level is rs.ember when it begins (run-save.js keeps it at or under rs.emberTop) */
export function startRun(rs, seed, em = rs.ember | 0) {
  const e = Math.max(0, Math.min(EMBER_TOP, em | 0)), max = maxHp(rs.up, []), fl = flasksMax(rs.up, [], e), s = seed >>> 0 || 1;
  rs.run = {
    seed: s, place: ORDER[0], time: 0, hp: max, flasks: fl, carried: 0, banked: 0, foes: 0, wicks: [], offer: null, bossDown: false, entry: null,
    route: routeFor(s, e), ember: e, relics: [], elitesDown: [], combo: 0, lastUsed: false, shelf: false
  };
  // Wick shelf: the run starts with a choice of two wicks, on the beacon card's own buttons
  if ((rs.unlocks || []).includes('shelf')) { rs.run.offer = startOffer(s, rs.unlocks); rs.run.shelf = true; }
  enter(rs.run);
  rs.wander = false;
  rs.ended = null;
  return rs.run;
}
export function enter(run) {
  run.entry = { hp: run.hp, flasks: run.flasks, carried: run.carried, foes: run.foes, relics: (run.relics || []).slice(), elitesDown: (run.elitesDown || []).slice(), lastUsed: !!run.lastUsed };
  return run;
}
// after the boss's fall the boss stays down, so a reload keeps its 30 glim and its one foe on top of the entry values
export function reload(run) {
  const e = run.entry || enter(run).entry, down = run.bossDown ? 1 : 0;
  run.hp = Math.min(run.hp, e.hp);
  run.flasks = Math.min(run.flasks, e.flasks);
  run.carried = e.carried + down * Math.floor(BASE.boss * glimFactor(emberOf(run)));
  run.foes = e.foes + down;
  if (e.relics) run.relics = e.relics.slice();
  if (e.elitesDown) run.elitesDown = e.elitesDown.slice();
  if ('lastUsed' in e) run.lastUsed = e.lastUsed;
  return run;
}
// move the run to the start of a place, as Walk on does: the entry snapshot is taken from the values now
export function goTo(rs, id) {
  rs.run.place = id;
  rs.furthest = Math.max(rs.furthest || 0, routeOfRun(rs.run).indexOf(id));
  enter(rs.run);
}
export const maxOf = rs => maxHp(rs.up, rs.run?.wicks);
export const flasksOf = rs => flasksMax(rs.up, rs.run?.wicks, emberOf(rs.run));
export const healNow = rs => healOf(rs.up, maxOf(rs), emberOf(rs.run));
// a wick chosen raises the run and the entry by what it gives, so a reload keeps it. A starting wick (Wick shelf) closes the shelf
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
// an unlock is bought once, with the same rules as an upgrade's Buy
export function buyUnlock(rs, id) {
  const u = UNLOCKS.find(x => x.id === id);
  rs.unlocks ||= [];
  if (!u || rs.unlocks.includes(id) || rs.bank < u.cost) return false;
  rs.bank -= u.cost;
  rs.unlocks.push(id);
  return true;
}
export const hasUnlock = (rs, id) => (rs.unlocks || []).includes(id);
// the level Begin the run starts at: any level that is open
export function setEmber(rs, n) {
  if (!Number.isInteger(n) || n < 0 || n > (rs.emberTop | 0)) return false;
  rs.ember = n;
  return true;
}
/* a lit beacon banks the glim carried and fills every flask (one flask at Ember 5); before the last place it moves the run to the next
   place of its route with two wicks offered; at the last it is the win */
export function lightBeacon(rs) {
  const run = rs.run, route = routeOfRun(run), i = route.indexOf(run.place);
  rs.bank += run.carried;
  run.banked += run.carried;
  run.carried = 0;
  run.flasks = Math.min(flasksOf(rs), run.flasks + Math.min(flasksOf(rs), ember(emberOf(run)).beaconFlasks));
  if (i === route.length - 1) return win(rs);
  run.offer = drawOffer(run.seed, i, run.wicks, rs.unlocks);
  run.shelf = false;
  goTo(rs, route[i + 1]);
  return { next: run.place, offer: run.offer.slice() };
}
// a win at the top open level opens the next one, up to Ember 5; the best time is kept for each level
export function win(rs) {
  const run = rs.run, em = emberOf(run);
  rs.wins += 1;
  rs.runs += 1;
  if (!rs.bestWin || run.time < rs.bestWin) rs.bestWin = run.time;
  rs.bestByEmber ||= [0, 0, 0, 0, 0, 0];
  if (!rs.bestByEmber[em] || run.time < rs.bestByEmber[em]) rs.bestByEmber[em] = run.time;
  const opened = em >= (rs.emberTop | 0) && em < EMBER_TOP;
  if (opened) rs.emberTop = em + 1;
  rs.bestCombo = Math.max(rs.bestCombo | 0, run.combo | 0);
  rs.ended = { won: true, place: run.place, time: run.time, foes: run.foes, lost: 0, banked: run.banked, ember: em, opened: opened ? em + 1 : null, relics: (run.relics || []).slice(), combo: run.combo | 0, seed: run.seed };
  rs.run = null;
  return { won: true };
}
// at 0 health: Cinders keep 25% of the glim carried, rounded down, or 55% with Ash pocket; the rest is lost
export function die(rs) {
  const run = rs.run, kept = Math.floor(run.carried * keepShare(rs.up) + 1e-9);
  rs.bank += kept;
  rs.runs += 1;
  rs.deaths += 1;
  rs.bestCombo = Math.max(rs.bestCombo | 0, run.combo | 0);
  rs.ended = { won: false, place: run.place, time: run.time, foes: run.foes, lost: run.carried - kept, banked: run.banked + kept, ember: emberOf(run), opened: null, relics: (run.relics || []).slice(), combo: run.combo | 0, seed: run.seed };
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
      drink: run.flasks <= 0 ? 'empty' : run.hp >= maxOf(rs) ? 'full' : 'ok', relics: run.relics || [], unlocks: rs.unlocks || []
    };
  };
  const fighter = makeFighter(body, walk, { stats });
  const R = {
    clock, fighter, rs, meta, log, fx, wisps: new Set(), lit: false, dead: false, onBeacon: false, hurtAt: -1, blink: still ? 8 : 4,
    pend: { attack: false, roll: false, heal: false }, targets, lightable, think,
    drop: drop || ((n) => { if (rs.run) rs.run.carried += n; }),
    // the place's elite (elites.js sets it when it wakes), and the relics lying here and the fires they light (relics.js)
    elite: null, max: () => maxOf(rs), bonus: () => (rs.run ? bladeBonus(rs.up, rs.run.wicks) : 0)
  };
  R.relics = makeRelics(R);
  const cue = (ev, name, more) => { const c = { cue: name, step: clock.step, play: clock.play, ...more }; R.log.push(c); ev.push({ type: 'cue', ...c, logged: true }); };
  // the Ember level's glim: 15% more a level, rounded down
  const glimAt = n => Math.floor(n * glimFactor(emberOf(rs.run)) + 1e-9);
  function take(i, ev) {
    if (R.wisps.has(i)) return;
    R.wisps.add(i);
    R.drop(glimAt(BASE.wisp), meta.wisps[i].p);
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
    // Ember parry: a melee hit from in front in the first 0.1 s of a first cut is turned aside, and the foe staggers for 1 s
    if (parried(from, ev)) return 'none';
    const safe = fighter.safe();
    if (safe) {
      if (safe === 'roll') {
        const shave = run.wicks.includes('shave');
        if (shave) fighter.nearMiss();
        // Tinder guard: the next attack within 1 s starts at the finisher
        if ((run.relics || []).includes('tinder')) fighter.tinder();
        ev.push({ type: 'miss' });
        cue(ev, 'miss', shave ? { shave } : {});
      }
      return 'safe';
    }
    // Ember 4: foes deal 20% more
    const d = Math.round(dmg * ember(emberOf(run)).dmg);
    run.hp = Math.max(0, run.hp - d);
    fighter.knock(from, o.push ?? MOVES.hurt.push);
    R.hurtAt = clock.step;
    stop(MOVES.hurt.stop);
    ev.push({ type: 'hurt', dmg: d, hp: run.hp }, { type: 'store' });
    cue(ev, 'hurt', { dmg: d });
    // Last ember: once a run, at 0 health, the lamplighter stands again with 25%
    if (run.hp <= 0 && run.wicks.includes('last') && !run.lastUsed) {
      run.lastUsed = true;
      run.hp = Math.max(1, Math.round(maxOf(rs) * 0.25));
      ev.push({ type: 'relic', what: 'last', hp: run.hp }, { type: 'store' });
      cue(ev, 'heal', { last: true });
      return 'hit';
    }
    if (run.hp <= 0) { kill(ev); return 'dead'; }
    return 'hit';
  }
  function parried(from, ev) {
    if (!from || !(rs.unlocks || []).includes('parry') || !fighter.parryOpen()) return false;
    const s = body.s, P = BUILD.parry, dx = from[0] - s.x, dz = from[1] - s.z, d = Math.hypot(dx, dz);
    if (d < P.near || d > P.far || Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - s.yaw), Math.cos(Math.atan2(dx, dz) - s.yaw))) > P.arc) return false;
    let foe = null, best = 1.2;
    for (const t of R.targets()) { const e = Math.hypot(t.x - from[0], t.z - from[1]); if (t.alive && e < best) { foe = t; best = e; } }
    if (foe) foe.hit(0, { from: [s.x, s.z], push: 0, knock: P.stagger, stagger: true, kind: 'parry', parry: true });
    stop(P.stop);
    ev.push({ type: 'parry', target: foe }, { type: 'stop', n: P.stop });
    cue(ev, 'clang', { parry: true });
    return true;
  }
  function kill(ev) {
    R.dead = true;
    stop(9);
    const ended = die(rs);
    ev.push({ type: 'dead', ended }, { type: 'store' });
    cue(ev, 'death');
  }
  // the place's elite goes out: its relic drops where it fell (the seed's relic stream), Kindled flask fills a flask, and the bus hears it
  function eliteOut(e, ev) {
    const run = rs.run, el = R.elite;
    if (!run || !el || R.eliteDown) return;
    R.eliteDown = true;
    const relic = drawRelic(run.seed, run.elitesDown.length, run.relics);
    if (!run.elitesDown.includes(run.place)) run.elitesDown.push(run.place);
    R.relics.drop(relic, [e.x, R.floorAt ? R.floorAt(e.x, e.z, e.y) : e.y, e.z]);
    let flask = false;
    if ((rs.unlocks || []).includes('kflask') && run.flasks < flasksOf(rs)) { run.flasks += 1; flask = true; }
    ev.push({ type: 'elite', what: 'fall', name: el.elite?.name || 'The elite', place: run.place, relic, flask }, { type: 'store' });
    emit('elite-fall', { place: run.place, relic });
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
      R.relics.take(ev);
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
    // the relics and the wicks of a build: what this step started, and the fires under way (on play steps)
    if (rs.run && !R.dead) {
      R.relics.scan(ev);
      if (play) R.relics.step(ev);
      for (const e of ev) if (e.type === 'foeOut' && R.elite && e.foe === R.elite.id) eliteOut(e, ev);
    }
    for (const e of ev.slice()) {
      if (e.type === 'stop') stop(e.n);
      // a drink that ends after the flasks went to 0 (a test hook, a later stage's cost) heals nothing and takes nothing
      else if (e.type === 'drink' && rs.run && rs.run.flasks > 0) {
        rs.run.flasks -= 1;
        rs.run.hp = Math.min(maxOf(rs), rs.run.hp + healNow(rs));
        ev.push({ type: 'store' });
      } else if (e.type === 'cue' && !e.logged) {
        // the cue with its game and play steps, and what it carries (hit, on, wind, act, foe, ...) for the sound
        const { type, logged, cue: name, ...more } = e;
        R.log.push({ cue: name, step: clock.step, play: clock.play, ...more });
      }
    }
    // the hurt blink: the figure hides and shows every 4 game steps (8 with reduced motion) while the hit's safe time lasts. The
    // fighter stops stepping at 0 health, so its safe time stops counting: the figure stays shown through the death fade
    body.s.hide = !R.dead && fighter.f.safe > 0 && R.hurtAt >= 0 && Math.floor((clock.step - R.hurtAt) / R.blink) % 2 === 0;
    return ev;
  }
  R.step = step; R.hurt = hurt; R.light = light; R.take = take; R.kill = (ev = R.out) => { if (rs.run && !R.dead) kill(ev); return ev; };
  // a foe put out: one more for the run's count, and its glim drops, with the Ember level's 15% a level
  R.out = [];
  R.foeOut = (glim = 0, at = null) => { if (rs.run) { rs.run.foes += 1; if (glim) R.drop(glimAt(glim), at); } };
  return R;
}
