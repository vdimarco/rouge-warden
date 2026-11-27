// Gloam Downs: the pacing bot. Each bot plays whole runs, one after another, until 5 runs after its first win or 40 runs, with the page's own rules:
// the run (run.js), the lamplighter's moves (moves.js), the seed's mix of the zones with the elite's zone, Ember 3's extra foe and the
// guard's second wave (mix.js, as makeFight uses it), the foes and their elites (foes.js, elites.js), the combo and its glim
// (combo.js), the relics (relics.js), and the Lamp-room's upgrades and unlocks bought between runs, on the real walk maps of the five
// places. No browser.
//   The way: the bot walks each place's route (games/gloam-downs/lib/zones.mjs ROUTES) from the start to the beacon, and wakes the zones
//   it passes as a player does. A bot of skill 0.8 or more also takes every wisp and fights every zone: it turns off the way for the
//   nearest one left within 24 m. It walks to a relic an elite drops. When the beacon stays dark it goes to the keepers.
//   The fight: it walks to a foe that sees it (or one within 3 m), turns to face it, and presses Attack on every other step in reach.
//   It reads a wind-up (a foe's move or an elite's special move) 0.70 - 0.45k s after it starts (±0.1 s), misses one 0.45 (1 - k)^1.3
//   of the time, fights on until about 0.15 s before the hit lands, and then rolls away; a coal's ring it walks out of. It drinks under
//   30 + 20k% health when no wind-up is near.
//   Stuck: no progress for 2 s and it jumps for 1 s; no progress for 4 s and a skilled bot gives up the wisp or zone it went for, or
//   the bot is put at its next point (a nudge). A foe it cannot reach for 8 s: it is put beside it (a nudge). A nudge counts the time
//   a walk there takes at 3 m/s, and 2 or 3 s more, so a nudge never makes the run shorter. Most nudges come from the same climbs,
//   where the straight walk to the next point meets a step it cannot take (Gaol points 8, 9 and 14, Fen 5 and 8, Bell Knoll 6, Crow
//   Wall 17); the fix pass measured about 12 a run (the "nudges a run" line), not the 7 an earlier note said. A foe it cannot reach
//   for 8 s that is not a guard's or the elite is left behind instead (it walks on, as a player does). NUDGE=1 prints each nudge.
//   The boss: Barrow Crown's zones are fought on the real map, and the Barrow Reeve is stepped with boss.js on the same runner, by the
//   boss bot's own mind (qa/lab/gloam-downs-bossbot.mjs: the reads, rolls and mistakes of qa/lab/gloam-downs-boss.sim.mjs).
//   Growth (gloam-downs-growth): one save across a bot's runs. In each Lamp-room (before a run and at each lit beacon, the glim carried
//   spent first) it kindles the found patterns it can pay for, cheapest first, then buys the cheapest next level of its list; a 0.3 bot
//   shops at a beacon half the time. It takes its spark picks by a rule (Ward under 50% health, Gloam once both slots hold an
//   ability, else Flame), sets its panes by a fixed order and picks Belt's start ability by a fixed order. It walks to the pattern and
//   ability lamps it sees within 12 m, and to the caches its keys open within 16 m of the way: a ledge by the second jump and a sealed
//   stone by a plunge, with the inputs the ledge scan played (qa/lab/gloam-downs-ledges.mjs), two tries each.
//   Abilities: an attack ability when 2 or more foes are near or an elite or the Reeve is awake; Smoke step or Bell guard in place of
//   4 rolls in 10; Flare or Rime lamp on a wind-up it reads near it.
//   The fair fight (gloam-downs-fair-fight): the foes' interrupts, braces, armor, tokens and blow spacing are foes.js's own. On a
//   wind-up it reads, of a light or medium foe in reach (1.8 m and the foe's radius) that is not braced or armored, with 0.23 s or more
//   before the hit, the bot cuts in with a chance of 0.3 + 0.6k (CUT_IN sets it, for a what-if run only) and does not roll from it; it
//   rolls from an armored wind-up (braced, steeled, or any heavy foe's) unless the foe is heavy and its next cut breaks its poise (then
//   it cuts in, at the same chance). It prints who hurt it in each place (S, P, M, I, E and the type for an elite, coal, B the Reeve).
//   It prints the interrupts a run, the hooks from braced foes, and for each place of the route its death rate and its damage taken
//   per foe put out.
// Run: node qa/lab/gloam-downs-bot.mjs [bots = 20] [skill = 0.5] [first seed = 1]   (MAXRUNS=40, AFTER=5 runs after the first win, VERBOSE=1,
//   WORKERS=4 plays the bots on 4 threads with the same results)
import fs from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, makeRunner, buy, buyUnlock, chooseWick, maxOf, flasksOf, emberOf, ember, UPGRADES, UNLOCKS, purse, takeSpark, setPane, paneSlots, kindle, kindledOf, chooseStartAbility, groundPatterns, BASE, PACE, PANE_RULES, foeScale, bossScale, tokensOf, depthOf, routeOfRun } from '../../public/lab/gloam-downs/run.js';
import { makeAbilities, groundAbilities } from '../../public/lab/gloam-downs/abilities.js';
import { makeKeys, groundSpots } from '../../public/lab/gloam-downs/keys.js';
import { makeBoss, REEVE } from '../../public/lab/gloam-downs/boss.js';
import { bossBrain } from './gloam-downs-bossbot.mjs';
import { PATTERNS } from '../../public/lab/gloam-downs/growth.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { groundGear } from '../../public/lab/gloam-downs/gear-play.js';
import { tierOf, traitsOf, bladeOf, offhandOf } from '../../public/lab/gloam-downs/gear.js';
import { makeFoes, phaseOf, FOE_HARD, FAIR, TYPES, armored } from '../../public/lab/gloam-downs/foes.js';
import { STAGGER, poiseOf } from '../../public/lab/gloam-downs/feel.js';
import { ELITES } from '../../public/lab/gloam-downs/elites.js';
import { specialPhase } from '../../public/lab/gloam-downs/elites.js';
import { sees } from '../../public/lab/gloam-downs/moves.js';
import { mixZones } from '../../public/lab/gloam-downs/mix.js';
import { makeCombo } from '../../public/lab/gloam-downs/combo.js';
import { mulberry, hash2 } from '../../public/lab/kit/rng.js';
import { ROUTES, POOLS } from '../../games/gloam-downs/lib/zones.mjs';

const W = fileURLToPath(new URL('../../public/lab/gloam-downs/worlds/', import.meta.url));
const BOTS = +(process.argv[2] || 20), SKILL = +(process.argv[3] || 0.5), SEED0 = +(process.argv[4] || 1);
const MAXRUNS = +(process.env.MAXRUNS || 40), AFTER = +(process.env.AFTER ?? 5), VERBOSE = !!process.env.VERBOSE;
const PLACE_LIMIT = 12 * 60 * 60; // 12 minutes of game time in one place is a loss (a bot that cannot get on)
const SIDE = 24, WALK = 3.0; // a skilled bot's reach off the way for a wisp or a zone (m); the walk speed a nudge is counted at (m/s)
// the pacing levers, to try a value without editing the game: HARD_DMG, HARD_HP (foes.js FOE_HARD) and REEVE_HARD (boss.js REEVE.hard)
if (process.env.HARD_DMG) FOE_HARD.dmg = +process.env.HARD_DMG;
if (process.env.HARD_HP) FOE_HARD.hp = +process.env.HARD_HP;
if (process.env.REEVE_HARD) REEVE.hard = +process.env.REEVE_HARD;
// and the growth levers (run.js BASE and PACE): START_HP, START_FL, HEAL, BLADE, DMG_AT (the damage table by depth, as 1,1.3,1.75,2.05,2.05), DEPTH_HP, DEPTH_POW, BOSS_SPARK, REEVE_HP, THICK
if (process.env.START_HP) BASE.hp = +process.env.START_HP;
if (process.env.START_FL) BASE.flasks = +process.env.START_FL;
if (process.env.HEAL) BASE.heal = +process.env.HEAL;
if (process.env.BLADE) PACE.blade = +process.env.BLADE;
if (process.env.DEPTH_HP) PACE.depthHp = +process.env.DEPTH_HP;
if (process.env.DEPTH_POW) PACE.depthPow = +process.env.DEPTH_POW;
if (process.env.DMG_AT) PACE.dmgAt = process.env.DMG_AT.split(',').map(Number);
if (process.env.BOSS_SPARK) PACE.bossSpark = +process.env.BOSS_SPARK;
if (process.env.REEVE_HP) REEVE.hp = +process.env.REEVE_HP;
if (process.env.THICK) PANE_RULES.thick = +process.env.THICK;
// the fair fight's levers: TOKENS (the melee tokens by depth, as 1,1,2,2,2), GAP (the blow spacing, s), HURT_WAIT (s), SPARK_DMG,
// SPARK_HP, SPARK_CAP and MIX_DEPTH=0 (no foe more from depth 2); CUT_IN (the bot's cut-in chance, for a what-if run only: it models a player, so it is not a lever)
if (process.env.TOKENS) PACE.tokens = process.env.TOKENS.split(',').map(Number);
if (process.env.GAP) FAIR.gap = Math.round(+process.env.GAP * 60);
if (process.env.HURT_WAIT) FAIR.hurtWait = Math.round(+process.env.HURT_WAIT * 60);
if (process.env.SPARK_DMG) PACE.sparkDmg = +process.env.SPARK_DMG;
if (process.env.SPARK_HP) PACE.sparkHp = +process.env.SPARK_HP;
if (process.env.SPARK_CAP) PACE.sparkCap = +process.env.SPARK_CAP;
// STEEL (s, the steeled time after a cancel; 0 turns it off) and BRACE_N (the flinches in 3 s that brace a foe)
if (process.env.STEEL) FAIR.steel = Math.round(+process.env.STEEL * 60);
if (process.env.BRACE_N) FAIR.braceN = +process.env.BRACE_N;
if (process.env.BRACE_HOLDS) FAIR.braceHolds = true;
if (process.env.BRACE) FAIR.brace = Math.round(+process.env.BRACE * 60);
const CUT_IN = process.env.CUT_IN != null ? +process.env.CUT_IN : null;
const why = { route: 0, foe: 0, wisp: 0, zone: 0 }; // the nudges by kind, and the wisps and zones a skilled bot gave up

const places = {};
function place(id) {
  if (places[id]) return places[id];
  const meta = JSON.parse(fs.readFileSync(`${W}${id}.json`, 'utf8'));
  const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${W}${id}.walk.bin.gz`)));
  const walk = makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
  return (places[id] = { meta, walk });
}
/* what the bot buys in each Lamp-room (before a run and at each lit beacon), in this order: the first affordable of the next of each. A
   lit beacon does not bank, so the Lamp-room spends the glim carried first, then the bank (pay in run.js). Found patterns come first */
const WANT = ['up:mantle', 'up:flask', 'un:kflask', 'up:edge', 'up:draught', 'up:belt', 'un:shelf', 'up:ash', 'up:keen', 'un:rising', 'un:tongue', 'un:heart', 'un:last', 'un:parry', 'up:first', 'up:panes'];
const PANE_ORDER = ['smoked', 'thick', 'lead', 'hot', 'tallow', 'storm', 'ember', 'clear'];
// Belt's start ability, and the abilities it uses on a wind-up, in place of a roll, and to attack
const START_ORDER = ['bomb', 'moth', 'pitch', 'flare', 'crook', 'snare', 'rime', 'guard', 'step'];
const DODGE = ['step', 'guard'], READ = ['flare', 'rime'], HIT = ['bomb', 'moth', 'pitch', 'snare', 'crook'];
// the whole catalogue, in glim: every ware level, every unlock and every pattern
const CATALOGUE = UPGRADES.reduce((a, u) => a + u.costs.reduce((x, c) => x + c, 0), 0) + UNLOCKS.reduce((a, u) => a + u.cost, 0) + PATTERNS.reduce((a, p) => a + (p.cost | 0), 0);
const spentOf = rs => UPGRADES.reduce((a, u) => a + u.costs.slice(0, rs.up[u.id] || 0).reduce((x, c) => x + c, 0), 0) +
  UNLOCKS.filter(u => (rs.unlocks || []).includes(u.id)).reduce((a, u) => a + u.cost, 0) + PATTERNS.filter(p => (rs.kindled || []).includes(p.id)).reduce((a, p) => a + (p.cost | 0), 0);
function shop(rs) {
  for (const p of PATTERNS.filter(p => (rs.patterns || []).includes(p.id)).sort((a, b) => a.cost - b.cost)) kindle(rs, p.id);
  for (let guard = 0; guard < 40; guard++) {
    const opts = WANT.map(w => {
      const [k, id] = w.split(':');
      if (k === 'up') { const u = UPGRADES.find(x => x.id === id), l = rs.up[id] || 0; return l < u.costs.length ? { w, cost: u.costs[l] } : null; }
      return (rs.unlocks || []).includes(id) ? null : { w, cost: UNLOCKS.find(x => x.id === id).cost };
    }).filter(Boolean).filter(o => o.cost <= purse(rs));
    if (!opts.length) break;
    const o = opts[0], [k, id] = o.w.split(':');
    if (k === 'up') buy(rs, id); else buyUnlock(rs, id);
  }
  const have = PANE_ORDER.filter(id => kindledOf(rs, 'pane').includes(id));
  for (let i = 0; i < paneSlots(rs); i++) if ((rs.panes || [])[i] !== have[i]) setPane(rs, i, have[i] || null);
}
// the spark picks: Ward while the health share was under 50% at the last beacon, Gloam once both slots hold an ability, else Flame
function sparks(rs, share) {
  while ((rs.run?.sparkPicks | 0) > 0) {
    const both = (rs.run.abilities || []).every(Boolean);
    if (!takeSpark(rs, share < 0.5 ? 'ward' : both ? 'gloam' : 'flame')) break;
  }
}
// the wick the bot takes from an offer
const WICK_RANK = ['keen', 'long', 'oil', 'heels', 'tongue', 'last', 'heavy', 'heart', 'shave'];
const pickWick = offer => offer.slice().sort((a, b) => WICK_RANK.indexOf(a) - WICK_RANK.indexOf(b))[0];

/* ---------------- one place ---------------- */
function playPlace(rs, id, bot) {
  const { meta, walk } = place(id), k = bot.skill, rnd = bot.rnd;
  const body = makeBody(walk, meta.spawn, meta.bounds, { ...PARAMS });
  // as the page's makeFight: the seed's mix of the zones (the elite's zone, Ember 3's extra foe, the guard's second wave) and the combo
  const zones = mixZones(id, meta.zones, POOLS[id], rs.run.seed, { ember: rs.run.ember ?? 0, depth: process.env.MIX_DEPTH === '0' ? 0 : depthOf(rs.run) });
  const combo = makeCombo({ emit: null, best: rs.run.combo ?? 0 });
  const F = makeFoes({ walk, meta: { ...meta, zones }, slots: POOLS[id], seed: rs.run.seed, combo, scale: foeScale(rs.run), tokens: tokensOf(rs.run) });
  // Barrow Crown: the Reeve in its arena, stepped by boss.js on the same runner (as the page's fight does)
  const arena = zones.find(z => z.boss), EMB = ember(emberOf(rs.run));
  const B = arena ? makeBoss({ walk, arena, seed: rs.run.seed, bounds: meta.bounds, down: !!rs.run.bossDown, hpScale: bossScale(rs.run), phase3: EMB.phase3 }) : null;
  if (B) B.ready = true;
  const targets = B ? () => (B.alive ? [...F.targets(), B] : F.targets()) : F.targets;
  const think = B ? (ev, play) => { F.think(ev, play); B.think(ev, play); if (ev.some(e => e.type === 'boss' && (e.what === 'intro' || e.what === 'fall'))) F.hush(); } : F.think;
  const R = makeRunner({ walk, meta, body, rs, targets, lightable: B ? B.lightable : F.lightable, drop: F.drop, think, onLight: F.bank, abilities: makeAbilities, keys: makeKeys });
  F.bind(R);
  B?.bind(R);
  // who hurt the lamplighter: the foe whose blow came from that point (a coal by its ring), its type, E for an elite, B for the Reeve
  {
    const hurt = R.hurt;
    R.hurt = (dmg, from, o = {}, ev) => {
      const r = hurt(dmg, from, o, ev);
      if ((r === 'hit' || r === 'dead') && from) {
        let who = o.coal ? 'coal' : 'B';
        for (const f of F.foes) if (!f.out && Math.hypot(f.x - from[0], f.z - from[1]) < 0.05) who = f.elite ? `E${f.type}` : f.type;
        const key = `${depth}:${who}`;
        bot.src[key] = (bot.src[key] || 0) + dmg;
        if (who === 'B') reeveDmg += dmg;
      }
      return r;
    };
  }
  const brain = B ? bossBrain({ B, R, rs, body, skill: k, rnd, C: arena.c }) : null;
  const s = body.s, route = ROUTES[id].map(p => p.slice());
  // the spots of this place: a cache its keys open, given up after two tries; a spot under way: { sp, t, tries }
  const spotsDone = new Set();
  let spotRun = null;
  let wi = 1, t0 = rs.run.time, best = Infinity, bestAt = 0, nudges = 0, steps = 0, out = null, dark = null, lastHit = 0, placeDmg = 0, placeFoes = 0, reeveDmg = 0;
  const depth = depthOf(rs.run);
  const read = new Map(); // a wind-up read: its foe and start step -> { at, miss }
  const wisps = new Set(), seen = new Set(); // wisps taken or given up; zones woken or given up
  const goalOf = () => {
    // a relic on the ground, the keepers when the beacon is dark, a wisp near the way (skill 0.8 and up), or the route's next point
    const g = R.relics.view().ground[0];
    if (g) return [g.x, g.y, g.z];
    // a pattern lamp or an ability lamp within 12 m (an ability lamp only while a slot is empty)
    const lamps = [...groundPatterns(R), ...(R.rs.run.abilities || []).some(a => !a) ? groundAbilities(R) : [], ...groundGear(R).filter(wantGear)];
    goalLamp = null;
    for (const l of lamps) if (Math.hypot(l.x - s.x, l.z - s.z) < 12 && !giveUp.has(`${l.id}:${l.x}`)) { goalLamp = l; return (goalAt = [l.x, l.y, l.z]); }
    // a cache its keys open, within 16 m: the start of its way
    const sp = spotNear();
    if (sp) return sp.from;
    if (dark && !F.lightable().ok) return dark;
    if (k >= 0.8) {
      // a skilled player takes every wisp and fights every zone: the nearest one left within 24 m of here, else the way on
      let best = null, bd = SIDE;
      for (let i = 0; i < meta.wisps.length; i++) {
        if (R.wisps.has(i) || wisps.has(i)) continue;
        const p = meta.wisps[i].p, d = Math.hypot(p[0] - s.x, p[2] - s.z);
        if (d < bd) { best = p; bd = d; }
      }
      for (const Z of F.zones) {
        if (Z.boss || seen.has(Z.id) || Z.members.every(f => f.out)) continue;
        const d = Math.hypot(Z.c[0] - s.x, Z.c[2] - s.z);
        if (d < bd) { best = Z.c; bd = d; }
      }
      if (best) return best;
    }
    return route[Math.min(wi, route.length - 1)];
  };
  /* the gear (gloam-downs-hub "Part C"): the bot takes a found blade or off-hand that is better than the one it holds, a higher tier,
     or the same tier with more traits, or one of its build family's colour (the colour it spends its sparks on) at the same tier */
  const TIER_RANK = { plain: 0, bright: 1, blazing: 2 };
  const rank = x => (x ? TIER_RANK[tierOf(x)] * 3 + traitsOf(x).length : -1);
  const familyColour = () => { const sp = rs.run?.sparks || {}; return ['flame', 'ward', 'gloam'].sort((a, b) => (sp[b] | 0) - (sp[a] | 0))[0]; };
  const colourOfGear = (kind, id) => (kind === 'blade' ? bladeOf(id) : offhandOf(id))?.colour;
  function wantGear(l) {
    const run = rs.run;
    if (!run || (l.kind !== 'blade' && l.kind !== 'offhand')) return false;
    const held = run[l.kind];
    if (!held) return true;
    if (rank(l) !== rank(held)) return rank(l) > rank(held);
    return colourOfGear(l.kind, l.id) === familyColour() && colourOfGear(l.kind, held.id) !== familyColour();
  }
  const giveUp = new Set(), passed = new Set();
  let goalLamp = null, goalAt = null;
  const spotNear = () => groundSpots(R).find(sp => sp.open && !spotsDone.has(sp.id) && Math.hypot(sp.from[0] - s.x, sp.from[2] - s.z) < 16);
  const toward = (p, slow = false) => { const dx = p[0] - s.x, dz = p[2] - s.z, d = Math.hypot(dx, dz) || 1; return { mx: dx / d, mz: -dz / d, slow }; };
  // the wind-ups that threaten the lamplighter now: { f, left (steps to the hit), from (where to roll away from) }
  function threats() {
    const list = [];
    for (const f of F.foes) {
      if (f.out || !f.alive) continue;
      if (f.special) {
        const P = specialPhase(f.special.def, f.special.t);
        if (P.ph !== 'w') continue;
        const d = Math.hypot(f.x - s.x, f.z - s.z);
        if (f.special.def.kind === 'coals' ? f.markers?.some(m => Math.hypot(m.x - s.x, m.z - s.z) < m.full + 0.6) : d < 4.5 + (f.special.def.kind === 'bent' ? 6 : 0))
          list.push({ f, key: `${f.id}:s:${f.special.t - P.at}`, left: P.n - P.at + (f.special.def.kind === 'coals' ? 43 : 0), from: f.special.def.kind === 'coals' && f.marker ? [f.marker.x, f.marker.z] : [f.x, f.z], at: P.at, hit: P.n - P.at });
        continue;
      }
      if (f.state !== 'move' || !f.move) continue;
      const M = f.T.moves[f.move];
      if (phaseOf(M, f.mt) !== 'wind') continue;
      const d = Math.hypot(f.x - s.x, f.z - s.z);
      const near = f.move === 'lob' ? f.marker && Math.hypot(f.marker.x - s.x, f.marker.z - s.z) < M.ring + 0.6 : d < (M.range || 3) + 1.5;
      if (!near) continue;
      list.push({ f, key: `${f.id}:${f.move}:${steps - f.mt}`, left: M.wind - f.mt + (f.move === 'lob' ? M.flight + M.release : 0), from: f.move === 'lob' ? [f.marker.x, f.marker.z] : [f.x, f.z], at: f.mt + (f.windAdd | 0), hit: M.wind - f.mt });
    }
    return list;
  }
  // the ability slots: which holds an ability of a kind, and is ready
  const slotOf = kinds => { const v = R.abilities.view(); for (let i = 0; i < 2; i++) if (v[i] && kinds.includes(v[i].id) && v[i].left <= 0) return i; return -1; };
  const press = (a, i) => ({ ...a, [i ? 'ab2' : 'ab1']: true });
  let usedAb = 0;
  function act() {
    // on a found blade or off-hand it wants: hold Attack or the Off-hand until it is taken (0.4 s), standing still
    const cmp = rs.run && R.gear.compare();
    if (cmp && (cmp.kind === 'blade' || cmp.kind === 'offhand') && wantGear({ kind: cmp.kind, ...cmp.found }) && !threats().some(t => t.left < 30)) {
      return cmp.kind === 'blade' ? { attack: true } : { off: true };
    }
    const a = act0();
    if (!rs.run) return a;
    // the off-hand: the Buckler raised against a blow about to land in front, in place of a roll, as a skilled player would; any other
    // off-hand in a fight on its cooldown with a foe near
    const off = rs.run.offhand;
    if (off && (rs.run.offCool | 0) === 0) {
      if (off.id === 'buckler' && a.roll && rnd() < 0.3 + 0.5 * k) { bot.offhand++; return { ...a, roll: false, off: true }; }
      if (off.id !== 'buckler' && a.fight && steps % 6 === 0 && F.targets().some(t => t.aware && Math.hypot(t.x - s.x, t.z - s.z) < (off.id === 'sling' ? 9 : 5))) { bot.offhand++; return { ...a, off: true }; }
    }
    // in place of a roll, 4 times in 10: Smoke step or Bell guard
    if (a.roll) { const i = slotOf(DODGE); if (i >= 0 && rnd() < 0.4) { usedAb++; return press({ ...a, roll: false }, i); } }
    // a wind-up read near it: Flare or Rime lamp
    if (a.read) { const i = slotOf(READ); if (i >= 0) { usedAb++; return press(a, i); } }
    // 2 or more foes near, or an elite awake: an attack ability
    if (a.fight) {
      const near = F.targets().filter(t => t.aware && Math.hypot(t.x - s.x, t.z - s.z) < 6).length, elite = R.elite && !R.eliteDown && R.elite.aware;
      const i = slotOf(HIT);
      if (i >= 0 && (near >= 2 || elite) && steps % 6 === 0) { usedAb++; return press(a, i); }
    }
    return a;
  }
  /* a wind-up it may cut into: a light or medium foe in reach, not braced, steeled or otherwise armored, or a heavy one (every heavy
     wind-up is armored) whose poise left its next cut breaks (cut1's 10, twice over in a wind-up), with 0.23 s or more before the hit.
     From any other armored wind-up it rolls */
  const cutCut = 10 * STAGGER.wind;
  function cuttable(t) {
    const f = t.f, reach = 1.8 + f.r, d = Math.hypot(f.x - s.x, f.z - s.z);
    if (d > reach || t.hit < 14 || f.move === 'lob' || f.special?.def.kind === 'coals' || Math.abs(f.y - s.y) > 1.6) return false;
    const heavy = !f.T.light || !!f.elite;
    if (!heavy) return !(f.braced > 0) && !armored(f);
    const left = f.poise === undefined || F.step - (f.poiseAt ?? -1e9) >= STAGGER.refill ? poiseOf(f) : f.poise;
    return left <= cutCut && F.step >= (f.staggerEnd ?? -1e9) + STAGGER.gap;
  }
  function act0() {
    const run = rs.run, hp = run.hp / maxOf(rs), live = F.targets();
    // a wind-up read in time: cut into it (a light or medium foe in reach), or roll away about 9 steps before the hit
    for (const t of threats()) {
      let r = read.get(t.key);
      if (!r) { r = { at: Math.round((0.7 - 0.45 * k + (rnd() - 0.5) * 0.2) * 60), miss: rnd() < 0.45 * Math.pow(1 - k, 1.3), cut: rnd() < (CUT_IN ?? 0.3 + 0.6 * k) }; read.set(t.key, r); }
      if (r.miss || t.at < r.at) continue;
      // the cut-in: face the foe and press Attack; it keeps cutting while the wind-up lasts, and rolls late only if it still stands
      if (r.cut && (r.cutting || cuttable(t))) {
        if (!r.cutting) { r.cutting = true; bot.cutins++; if (armored(t.f)) bot.armorCuts++; }
        if (t.hit > 6) {
          const f = t.f, off = Math.abs(Math.atan2(Math.sin(Math.atan2(f.x - s.x, f.z - s.z) - s.yaw), Math.cos(Math.atan2(f.x - s.x, f.z - s.z) - s.yaw)));
          return { attack: steps % 2 === 0, ...toward([f.x, f.y, f.z], off > 0.4), ...(off > 0.4 ? {} : { mx: 0, mz: 0 }), fight: true };
        }
      }
      if (t.left <= 22 && t.left > 10 && Math.hypot(t.f.x - s.x, t.f.z - s.z) < 4) return { read: true };
      if (t.left <= 10 || (t.f.special?.def.kind === 'coals' || t.f.move === 'lob')) {
        const dx = s.x - t.from[0], dz = s.z - t.from[1], d = Math.hypot(dx, dz) || 1;
        const side = t.f.move === 'charge' || t.f.special?.def.kind === 'bent';
        const ux = side ? -dz / d : dx / d, uz = side ? dx / d : dz / d;
        if (t.f.move === 'lob' || t.f.special?.def.kind === 'coals') return { mx: ux, mz: -uz };
        return { roll: true, mx: ux, mz: -uz };
      }
      /* not yet: a wind-up it read and chose not to cut into, of a foe in reach that its cuts would stop, it stops swinging at and
         waits for the roll (a player who does not cut in backs off the button); any other, it fights on until the roll is due */
      if (!r.cut && cuttable(t)) return { read: true };
      break;
    }
    if (hp < 0.3 + 0.2 * k && run.flasks > 0 && R.fighter.f.move !== 'drink' && steps % 4 === 0) return { heal: true };
    // the nearest foe in the fight
    let foe = null, fd = 9;
    // a foe that sees the lamplighter (a sleeping zone's foe on its ledge is left alone), or one within 3 m
    for (const t of live) { const d = Math.hypot(t.x - s.x, t.z - s.z); if (d < fd && Math.abs(t.y - s.y) < 2.5 && (t.aware || d < 3) && (!passed.has(t) || d < 2)) { foe = t; fd = d; } }
    if (foe) {
      /* a foe the bot cannot reach (over deep water, on a ledge) for 8 s: a guard's foe or the elite, which the bot must put out, is
         reached by a nudge; any other the bot leaves, as a player walks on past a foe it cannot reach (it still fights it within 2 m) */
      if (steps - lastHit > 480 && !foe.zone.guard && !foe.elite) { lastHit = steps; passed.add(foe); why.passed = (why.passed || 0) + 1; return toward(goalOf()); }
      if (steps - lastHit > 480) {
        lastHit = steps;
        const dx = s.x - foe.x, dz = s.z - foe.z, l = Math.hypot(dx, dz) || 1;
        let x = foe.x + (dx / l) * 1.2, z = foe.z + (dz / l) * 1.2, y = walk.support(x, z, foe.y + 1);
        if (y === null || Math.abs(y - foe.y) > 0.8) { x = foe.x + 0.6; z = foe.z; y = walk.support(x, z, foe.y + 1) ?? foe.y; }
        const far = Math.hypot(x - s.x, z - s.z);
        if (process.env.NUDGE) console.log('foe nudge', id, foe.id, foe.type, foe.state, +fd.toFixed(2), +(foe.y - s.y).toFixed(2), foe.fly ? 'fly' : '', R.fighter.f.move);
        body.place([x, y + 0.3, z], Math.atan2(foe.x - x, foe.z - z));
        nudges++; why.foe++; rs.run.time += 2 + far / WALK; bot.nudgeTime += 2 + far / WALK;
      }
      if (fd - foe.r > 1.5) return toward([foe.x, foe.y, foe.z]);
      // in reach: Attack on every other step, and turn to face the foe first (a swing at the air never lands)
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(foe.x - s.x, foe.z - s.z) - s.yaw), Math.cos(Math.atan2(foe.x - s.x, foe.z - s.z) - s.yaw)));
      if (off > 0.5 || fd - foe.r > 1.0) return toward([foe.x, foe.y, foe.z], true);
      return { attack: steps % 2 === 0, ...toward([foe.x, foe.y, foe.z]), mx: 0, mz: 0, fight: true };
    }
    const g = goalOf();
    return toward(g);
  }
  let jumped = false, jumpTo = 0, fought = false;
  const arenaD = () => (arena ? Math.hypot(arena.c[0] - s.x, arena.c[2] - s.z) : Infinity);
  // a cache's way, played as the ledge scan played it: from a stand at `from`, run for way.run s, jump, and (a ledge) jump again
  // way.leapAt s after the take-off, or (a stone) Attack way.plungeAt s after it
  function spotAct() {
    const S = spotRun, sp = S.sp, w = sp.way, t = (S.t++) / 60;
    const dx = sp.at[0] - s.x, dz = sp.at[2] - s.z, d = Math.hypot(dx, dz) || 1, over = d < (sp.kind === 'ledge' ? 0.5 : 0.4);
    if (S.t < 12) return {}; // stand still first, as the scan did
    const tt = t - 0.2, a = over ? {} : { mx: dx / d, mz: -dz / d };
    if (tt >= w.run) {
      const j = tt - w.run;
      a.jump = j < w.hold;
      if (sp.kind === 'ledge' && j >= w.leapAt && j < w.leapAt + 0.3) a.jump = j >= w.leapAt + 1 / 60;
      if (sp.kind === 'stone' && j >= w.plungeAt && !s.ground) a.attack = true;
    }
    if (tt > w.run + 2.5 || (tt > w.run + 0.3 && s.ground && !R.fighter.f.move)) {
      const done = (rs.run.caches || []).includes(sp.id);
      if (done || ++S.tries >= 2) { spotsDone.add(sp.id); spotRun = null; if (done) bot.caches++; }
      else { S.t = 0; S.walk = true; }
    }
    return a;
  }
  while (rs.run && steps < PLACE_LIMIT) {
    let a;
    // the Reeve: from its intro to its fall, the boss bot's mind plays (with the abilities, as act() adds them)
    if (B && B.up && (B.started || arenaD() < 11) && !R.dead) {
      if (!fought) { fought = true; bot.arrive.push({ h: rs.run.hp / maxOf(rs), flasks: rs.run.flasks }); bot.bossAt = rs.run.time; }
      a = brain.act();
      if (a.roll) { const i = slotOf(DODGE); if (i >= 0 && rnd() < 0.4) a = press({ ...a, roll: false }, i); }
      if (a.attack && B.alive) { const i = slotOf(HIT); if (i >= 0 && steps % 6 === 0) { usedAb++; a = press(a, i); } }
    } else if (spotRun && !spotRun.walk) a = spotAct();
    else {
      a = act();
      // at a cache's stand with no foe near: its way starts
      const sp = spotNear();
      if (spotRun?.walk && Math.hypot(spotRun.sp.from[0] - s.x, spotRun.sp.from[2] - s.z) < 0.35) spotRun.walk = false;
      else if (!spotRun && sp && Math.hypot(sp.from[0] - s.x, sp.from[2] - s.z) < 0.35 && !F.targets().some(t => t.aware && Math.hypot(t.x - s.x, t.z - s.z) < 9)) spotRun = { sp, t: 0, tries: 0 };
      if (spotRun?.walk) a = { ...toward(spotRun.sp.from), slow: true };
    }
    steps++;
    if (B && fought && !B.up && bot.bossAt != null) { bot.bossFights.push(rs.run.time - bot.bossAt); bot.bossAt = null; }
    if (jumpTo > 0) { jumpTo--; a.jump = jumpTo % 20 < 10; }
    for (const e of R.step(a, 0)) {
      if (e.type === 'gear' && e.what === 'swap') bot.gearSwaps++;
      if (e.type === 'dark') dark = e.at;
      if (e.type === 'hit') { lastHit = steps; combo.hit(e.kind === 'relic' ? 'relic' : e.kind); }
      if (e.type === 'hurt') {
        combo.end(); bot.hurt += e.dmg; placeDmg += e.dmg;
        // a hook from a braced foe: the foe in its active time nearest the lamplighter is braced
        const near = F.foes.filter(f => f.state === 'move' && f.move && phaseOf(f.T.moves[f.move], f.mt) === 'act').sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
        if (near && near.braced > 0) bot.bracedHits++;
        else if (near && near.armorMove && near.T.light && !near.elite) bot.steelHits++;
      }
      if (e.type === 'snap') { if (e.kind === 'B') bot.bossBreaks++; else bot.snaps++; }
      if (e.type === 'foeOut') placeFoes++;
      if (e.type === 'wisp') wisps.add(e.i);
      if (e.type === 'beacon' || e.type === 'win') out = e;
      if (e.type === 'dead') out = e;
    }
    combo.tick(true);
    if (combo.best > (rs.run?.combo || 0) && rs.run) rs.run.combo = combo.best;
    if (out) break;
    for (const Z of F.zones) if (Z.awake || (!Z.boss && Math.hypot(Z.c[0] - s.x, Z.c[2] - s.z) < 1.5)) seen.add(Z.id);
    // the next point of the way, and a nudge when stuck
    const p = route[Math.min(wi, route.length - 1)];
    if (Math.hypot(p[0] - s.x, p[2] - s.z) < 1.2 && wi < route.length - 1) { wi++; best = Infinity; }
    const g = goalOf(), d = Math.hypot(g[0] - s.x, g[2] - s.z);
    for (let i = 0; i < meta.wisps.length; i++) if (!R.wisps.has(i) && Math.hypot(meta.wisps[i].p[0] - s.x, meta.wisps[i].p[2] - s.z) < 1.2) wisps.add(i);
    const fighting = F.targets().some(t => t.aware && !passed.has(t) && Math.hypot(t.x - s.x, t.z - s.z) < 9 && Math.abs(t.y - s.y) < 2.5);
    if (d < best - 0.3 || fighting || (B && fought && B.up) || (spotRun && !spotRun.walk)) { best = Math.min(best, d); bestAt = steps; }
    else if (steps - bestAt > 120 && !jumped) { jumped = true; jumpTo = 60; }
    else if (steps - bestAt > 240) {
      // stuck for 4 s, a jump tried: a skilled bot gives up a wisp or a zone off the way; else it is put at its point, and the time
      // a walk there takes at the walk speed is counted, with 3 s more
      const zone = F.zones.find(Z => Z.c === g), wisp = meta.wisps.findIndex(w => w.p === g), spot = groundSpots(R).find(sp => sp.from === g);
      if (goalLamp && g === goalAt) { giveUp.add(`${goalLamp.id}:${goalLamp.x}`); why.lamp = (why.lamp || 0) + 1; }
      else if (spot) { spotsDone.add(spot.id); why.spot = (why.spot || 0) + 1; }
      else if (zone) { seen.add(zone.id); why.zone++; }
      else if (wisp >= 0) { wisps.add(wisp); why.wisp++; }
      else {
        const far = Math.hypot(g[0] - s.x, g[2] - s.z);
        if (process.env.NUDGE) console.log('route nudge', id, wi, g.map(v => +v.toFixed(1)), [s.x, s.y, s.z].map(v => +v.toFixed(1)), +far.toFixed(1), s.ground);
        body.place([g[0], g[1] + 0.5, g[2]], s.yaw);
        nudges++; why.route++;
        rs.run.time += 3 + far / WALK; bot.nudgeTime += 3 + far / WALK;
        if (g === route[Math.min(wi, route.length - 1)] && wi < route.length - 1) wi++;
      }
      best = Infinity; bestAt = steps; jumped = false;
    }
  }
  if (!out && rs.run) { if (VERBOSE) console.log('stuck', id, JSON.stringify({ at: [s.x, s.y, s.z].map(v => +v.toFixed(1)), wi, dark, light: F.lightable(), live: F.targets().map(t => [t.id, t.state, +t.x.toFixed(1), +t.y.toFixed(1), +t.z.toFixed(1), t.hp, sees(walk, s, t), walk.support(t.x, t.z, t.y + 1), t.cool, t.aware]), act: act(), hp: rs.run.hp, fl: rs.run.flasks, ground: s.ground, th: threats().map(t => [t.key, t.left, t.at]), melee: [...F.melee].map(g => g.id), tgt: R.fighter.f.target?.id, move: R.fighter.f.move, ground: R.relics.view().ground })); R.kill([]); out = { type: 'dead', stuck: true }; }
  combo.end();
  bot.abilities += usedAb;
  // a bot stuck for 12 minutes (a keeper it cannot reach) is put out, but that is the bot's, not the fight's: it is counted apart
  // the damage per foe counts the zones' foes only: the Reeve's fight is its own (its damage a run is in the source lines)
  bot.places.push({ depth, dmg: placeDmg - reeveDmg, foes: placeFoes, died: out?.type === 'dead' && !out.stuck, stuck: !!out?.stuck });
  return { out, time: (rs.run?.time ?? rs.ended?.time ?? 0) - t0, nudges, elite: R.eliteDown || false, share: rs.run ? rs.run.hp / maxOf(rs) : 0, depth };
}

/* ---------------- one bot ---------------- */
function playBot(b) {
  const rs = RS.fresh();
  const bot = { skill: SKILL, rnd: mulberry(hash2(b, 0xb07, 7)), bossFights: [], arrive: [], hurt: 0, caches: 0, abilities: 0, offhand: 0, gearSwaps: 0, bossAt: null, nudgeTime: 0, snaps: 0, cutins: 0, armorCuts: 0, bracedHits: 0, steelHits: 0, src: {}, bossBreaks: 0, places: [] };
  const runs = [];
  for (let r = 0; r < MAXRUNS; r++) {
    shop(rs);
    startRun(rs, hash2(b, r, 0x5eed) || 1);
    if (rs.run.offer) chooseWick(rs, pickWick(rs.run.offer));
    if (rs.run.abilityOffer) chooseStartAbility(rs, rs.run.abilityOffer.slice().sort((a, b) => START_ORDER.indexOf(a) - START_ORDER.indexOf(b))[0]);
    // NOAB=1: a run with no abilities (to see what they add)
    if (process.env.NOAB) { rs.run.abilities = [null, null]; rs.run.abilityOffer = null; }
    sparks(rs, 1);
    const per = {};
    let nudges = 0, deepest = 0;
    while (rs.run) {
      const id = rs.run.place;
      const res = playPlace(rs, id, bot);
      deepest = Math.max(deepest, res.depth);
      per[id] = +(res.time / 60).toFixed(2);
      nudges += res.nudges;
      if (rs.run?.offer) chooseWick(rs, pickWick(rs.run.offer));
      if (res.out?.type === 'dead' || res.out?.type === 'win' || !rs.run) break;
      // a lit beacon: the spark pick, then the Lamp-room (a 0.3 bot carries its glim on half the time)
      sparks(rs, res.share);
      if (bot.skill >= 0.5 || bot.rnd() < 0.5) shop(rs);
    }
    const e = rs.ended;
    runs.push({ won: e.won, place: e.place, depth: e.won ? 5 : deepest, time: +(e.time / 60).toFixed(2), banked: e.banked, kept: e.kept, lost: e.lost, relics: e.relics.length, per, nudges, spent: spentOf(rs) });
    if (VERBOSE) console.log(`bot ${b} run ${r + 1}: ${e.won ? 'WIN' : 'died in ' + e.place} ${(e.time / 60).toFixed(1)} min, banked ${e.banked}, relics ${e.relics.join(',') || '-'}, nudges ${nudges}`);
    rs.ended = null;
    // up to MAXRUNS runs, or the first win and AFTER (5) runs more, so the catalogue's growth shows
    if (e.won && bot.firstWin == null) bot.firstWin = r + 1;
    if (bot.firstWin != null && r + 1 >= bot.firstWin + AFTER) break;
  }
  return { runs, firstWin: bot.firstWin ?? null, boss: bot.bossFights, arrive: bot.arrive, hurt: bot.hurt, caches: bot.caches, abilities: bot.abilities, nudgeTime: bot.nudgeTime, keys: (rs.keys || []).slice(),
    snaps: bot.snaps, cutins: bot.cutins, armorCuts: bot.armorCuts, src: bot.src, steelHits: bot.steelHits, bracedHits: bot.bracedHits, bossBreaks: bot.bossBreaks, places: bot.places, offhand: bot.offhand, gearSwaps: bot.gearSwaps, gear: rs.ended?.gear || null };
}

/* ---------------- the threads ----------------
   WORKERS=n plays the bots on n threads, each bot by its own seed, so the results are the same as on one */
if (!isMainThread) {
  const out = [];
  for (const b of workerData.ids) out.push(playBot(b));
  parentPort.postMessage({ bots: out, why });
} else main();
async function main() {
const t0 = Date.now();
let bots = [];
const ids = Array.from({ length: BOTS }, (_, i) => SEED0 + i), NW = Math.max(1, Math.min(BOTS, +(process.env.WORKERS || 1)));
if (NW <= 1) for (const b of ids) bots.push(playBot(b));
else {
  const parts = await Promise.all(Array.from({ length: NW }, (_, w) => new Promise((ok, no) => {
    const W = new Worker(new URL(import.meta.url), { workerData: { ids: ids.filter((_, i) => i % NW === w) }, env: process.env, argv: process.argv.slice(2) });
    W.on('message', ok); W.on('error', no);
  })));
  const byId = new Map();
  parts.forEach((p, w) => { ids.filter((_, i) => i % NW === w).forEach((b, k) => byId.set(b, p.bots[k])); for (const [key, n] of Object.entries(p.why)) why[key] = (why[key] || 0) + n; });
  bots = ids.map(b => byId.get(b));
}
// the factor table (design.md "A natural curve"): at each depth, with no spark and with 8, a hook, a coal, a slam and a charge at Ember 0,
// the hooks it takes to bring 100 and 160 health down, and the strings (43 damage) a Snuffer and an Ironback take
{
  const rows = [];
  for (let d = 0; d < 5; d++) for (const sp of [0, 8]) {
    const run = { place: routeOfRun({}).at(d), route: routeOfRun({}), sparks: { flame: sp } }, sc = foeScale(run), D = n => Math.round(n * FOE_HARD.dmg * sc.dmg);
    const hook = D(TYPES.S.moves.hook.dmg), snuf = Math.round(TYPES.S.hp * FOE_HARD.hp * sc.hp), iron = Math.round(TYPES.I.hp * FOE_HARD.hp * sc.hp);
    rows.push(`d${d} s${sp}: hook ${hook}, coal ${D(TYPES.P.moves.lob.dmg)}, slam ${D(TYPES.I.moves.slam.dmg)}, charge ${D(TYPES.I.moves.charge.dmg)}; hooks to 100/160 ${Math.ceil(100 / hook)}/${Math.ceil(160 / hook)}; Snuffer ${snuf} (${(snuf / 43).toFixed(1)} strings), Ironback ${iron} (${(iron / 43).toFixed(1)})`);
  }
  console.log(`factors at Ember 0 (tokens ${PACE.tokens.join(',')}):\n  ${rows.join('\n  ')}`);
}
const med = v => { const s = v.slice().sort((a, c) => a - c); return s.length ? s[Math.floor(s.length / 2)] : null; };
const firstReach = bots.filter(x => x.runs[0].won || x.runs[0].place !== 'gaol').length;
const wins = bots.map(x => x.firstWin).filter(Boolean);
const winTimes = bots.filter(x => x.firstWin).map(x => x.runs[x.firstWin - 1].time);
const reached = {};
for (const x of bots) for (const r of x.runs) reached[r.place] = (reached[r.place] || 0) + 1;
console.log(`${BOTS} bots, skill ${SKILL}, ${((Date.now() - t0) / 1000).toFixed(0)} s; foes deal ×${FOE_HARD.dmg} with ×${FOE_HARD.hp} health, the Reeve ×${REEVE.hard}; start ${BASE.hp} health, ${BASE.flasks} flasks, heal ${BASE.heal}; ${JSON.stringify(PACE)}`);
console.log(`first run reaches The Crow Wall: ${firstReach} of ${BOTS} (${Math.round((100 * firstReach) / BOTS)}%)`);
// the run at which each quarter of the catalogue is bought (the median of the bots that got there)
const quarter = q => { const v = bots.map(x => x.runs.findIndex(r => r.spent >= q * CATALOGUE)).filter(i => i >= 0).map(i => i + 1); return `${med(v) ?? '-'} (${v.length} of ${BOTS})`; };
console.log(`catalogue ${CATALOGUE} glim; bought 25% by run ${quarter(0.25)}, 50% ${quarter(0.5)}, 75% ${quarter(0.75)}, 100% ${quarter(1)}`);
const allRuns = bots.flatMap(x => x.runs), deaths = allRuns.filter(r => !r.won);
// the runs in which the bot bought something (a ware, an unlock or a pattern): the spend went up from the run before
const buys = bots.reduce((a, x) => a + x.runs.filter((r, i) => r.spent > (i ? x.runs[i - 1].spent : 0)).length, 0);
console.log(`runs with a buy: ${buys} of ${allRuns.length}`);
console.log(`glim at a death (mean): kept ${(deaths.reduce((a, r) => a + (r.kept | 0), 0) / (deaths.length || 1)).toFixed(0)}, lost ${(deaths.reduce((a, r) => a + (r.lost | 0), 0) / (deaths.length || 1)).toFixed(0)}`);
const winsAll = allRuns.filter(r => r.won).length;
console.log(`runs played ${allRuns.length}, won ${winsAll}`);
console.log(`won within ${MAXRUNS} runs: ${wins.length} of ${BOTS}; median first-win run ${med(wins) ?? '-'} (of those that won)`);
console.log(`winning run: median ${med(winTimes) ?? '-'} min of game time; the Reeve's fight (stepped) median ${(med(bots.flatMap(x => x.boss)) ?? 0).toFixed(1)} s`);
const nRuns = bots.flatMap(x => x.runs).length;
console.log(`gear: off-hand uses a run (mean) ${(bots.reduce((a, x) => a + (x.offhand || 0), 0) / nRuns).toFixed(1)}; gear swaps a run (mean) ${(bots.reduce((a, x) => a + (x.gearSwaps || 0), 0) / nRuns).toFixed(2)}`);
console.log(`abilities used a run (mean) ${(bots.reduce((a, x) => a + x.abilities, 0) / nRuns).toFixed(1)}; caches opened a run (mean) ${(bots.reduce((a, x) => a + x.caches, 0) / nRuns).toFixed(2)}; bots with Crow step ${bots.filter(x => x.keys.includes('leap')).length}, with Bell drop ${bots.filter(x => x.keys.includes('drop')).length}`);
console.log(`runs ended in: ${Object.entries(reached).map(([p, n]) => `${p} ${n}`).join(', ')}`);
const per = {};
for (const x of bots) for (const r of x.runs) for (const [p, t] of Object.entries(r.per)) (per[p] ||= []).push(t);
console.log(`minutes a place (median): ${Object.entries(per).map(([p, v]) => `${p} ${med(v)}`).join(', ')}`);
const arr = bots.flatMap(x => x.arrive);
console.log(`at the arena: health ${(100 * med(arr.map(a => a.h))).toFixed(0)}% (median), flasks left ${med(arr.map(a => a.flasks))}; damage taken a run (mean) ${(bots.reduce((a, x) => a + x.hurt, 0) / bots.flatMap(x => x.runs).length).toFixed(0)}`);
console.log(`nudges: ${JSON.stringify(why)} (route and foe are nudges; wisp and zone were given up)`);
console.log(`nudge time a run (mean): ${(bots.reduce((a, x) => a + x.nudgeTime, 0) / 60 / bots.flatMap(x => x.runs).length).toFixed(2)} min`);
console.log(`nudges a run (mean): ${(bots.flatMap(x => x.runs).reduce((a, r) => a + r.nudges, 0) / bots.flatMap(x => x.runs).length).toFixed(1)}; relics a run (mean): ${(bots.flatMap(x => x.runs).reduce((a, r) => a + r.relics, 0) / bots.flatMap(x => x.runs).length).toFixed(2)}`);
// the fair fight: the first runs that reach places 2 and 3, the interrupts, and each place's death rate and damage taken per foe put out
{
  const first = bots.map(x => x.runs[0]);
  const p2 = first.filter(r => r.depth >= 1).length, p3 = first.filter(r => r.depth >= 2).length;
  console.log(`first run reaches place 2: ${p2} of ${BOTS} (${Math.round((100 * p2) / BOTS)}%), place 3: ${p3} of ${BOTS} (${Math.round((100 * p3) / BOTS)}%)`);
  console.log(`interrupts a run (mean) ${(bots.reduce((a, x) => a + x.snaps, 0) / nRuns).toFixed(1)} (cut-ins chosen ${(bots.reduce((a, x) => a + x.cutins, 0) / nRuns).toFixed(1)}, of them into an armored wind-up ${(bots.reduce((a, x) => a + x.armorCuts, 0) / nRuns).toFixed(2)}); hooks from braced foes a run ${(bots.reduce((a, x) => a + x.bracedHits, 0) / nRuns).toFixed(2)}, from steeled ones ${(bots.reduce((a, x) => a + x.steelHits, 0) / nRuns).toFixed(2)}; the Reeve's poise breaks a fight ${(bots.reduce((a, x) => a + x.bossBreaks, 0) / Math.max(1, bots.reduce((a, x) => a + x.boss.length, 0))).toFixed(2)}`);
  const visits = bots.flatMap(x => x.places), rates = [], per = [];
  for (let d = 0; d < 5; d++) {
    const at = visits.filter(v => v.depth === d), died = at.filter(v => v.died).length;
    rates.push(at.length ? died / at.length : 0);
    per.push(med(at.filter(v => v.foes > 0).map(v => v.dmg / v.foes)) ?? 0);
    console.log(`place ${d + 1}: reached ${at.length}, deaths ${died}, death rate ${at.length ? ((100 * died) / at.length).toFixed(1) : '-'}%, damage per foe (median) ${per[d].toFixed(1)}; the bot stuck ${at.filter(v => v.stuck).length}`);
  }
  // the damage taken a run by place and source (S, P, M, I; E and the type for an elite; coal; B the Reeve)
  const src = {};
  for (const x of bots) for (const [k, v] of Object.entries(x.src)) src[k] = (src[k] || 0) + v;
  for (let d = 0; d < 5; d++) console.log(`place ${d + 1} damage a run by source: ${Object.entries(src).filter(([k]) => k.startsWith(d + ':')).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.slice(2)} ${(v / nRuns).toFixed(1)}`).join(', ')}`);
  const mean4 = rates.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const spike = rates.slice(0, 4).map(r => r / (mean4 || 1)), crown = rates[4] / (mean4 || 1), steps = per.slice(1).map((v, i) => v / (per[i] || 1));
  console.log(`spike: places 1 to 4 at ${spike.map(v => v.toFixed(2)).join(', ')} times their mean (under 1.5), Barrow Crown ${crown.toFixed(2)} (under 2); damage per foe steps ${steps.map(v => v.toFixed(2)).join(', ')} (0.9 to 1.6)`);
}
}
