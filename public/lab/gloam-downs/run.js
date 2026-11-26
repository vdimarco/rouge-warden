// Gloam Downs: the run. The fixed step and its count, the two clocks, the seed's streams, the run's numbers (health, flasks, the
// wicks and the upgrades) and its rules (the entry snapshot, a reload, hits, drinks, falls, glim, the beacon, death and the win), and
// the runner that steps one place of a run. No DOM, so Node tests and the bot use it as it is.
import { ORDER } from './save.js';
import { touches, atBeacon } from './play.js';
import { makeFighter, MOVES, BUILD, dealt, clearLine } from './moves.js';
import { makeRelics, drawRelic } from './relics.js';
import { emit } from './bus.js';
import { mulberry, hash2 } from '../kit/rng.js';
import { SPARK, levelGain, COLOUR_IDS, ABILITIES, ABILITY_IDS, PANES, PANE_IDS, PANE_SLOTS, PATTERNS, PATTERN_IDS, STARTERS, DROPS } from './growth.js';

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
export const BASE = { hp: 100, flasks: 1, heal: 0.35, wisp: 4, boss: 30, elite: 15 };
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
/* the lasting wares: each level costs more. The first levels of Mantle, Flask, Edge and Draught keep the costs and gifts they had, so an
   old save keeps its power (gloam-downs-growth design.md "Lasting wares") */
export const UPGRADES = [
  { id: 'mantle', name: 'Mantle', costs: [40, 80, 140, 210, 290, 380, 480, 600] },
  { id: 'flask', name: 'Flask', costs: [60, 150, 260, 420] },
  { id: 'edge', name: 'Edge', costs: [50, 100, 170, 260, 380] },
  { id: 'draught', name: 'Draught', costs: [45, 110, 200] },
  { id: 'ash', name: 'Ash pocket', costs: [40, 80, 150, 240, 360] },
  { id: 'belt', name: 'Belt', costs: [90, 220, 420] },
  { id: 'keen', name: 'Keen eye', costs: [70, 140, 230, 340, 480] },
  { id: 'panes', name: 'Lantern panes', costs: [300, 700] },
  { id: 'first', name: 'First spark', costs: [120, 260, 450] }
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
/* the pacing levers (gloam-downs-growth design.md "Pacing results"). The run starts with 1 flask (BASE), and Flask levels give the rest
   back. Foes in the later places of the run hit harder and have more health: at place depth d (the Gaol, or the run's first place, is
   0, Barrow Crown 4) damage ×(1 + 0.35 d^1.5) and health ×(1 + 0.4 d^1.5), so ×1.35 and ×1.4 in the second place and ×3.8 and ×4.2 in
   Barrow Crown; the sparks, wicks and relics of the run and the lasting wares carry the lamplighter through them. The Barrow Reeve has
   5% more health for each spark the run holds. blade is the blade's share at the start: a lower one was measured and broke the
   skill 0.3 target, so it stays 1 */
export const PACE = { blade: 1, depthDmg: 0.35, depthHp: 0.4, depthPow: 1.5, bossSpark: 0.05 };
export const depthOf = run => Math.max(0, routeOfRun(run).indexOf(run?.place));
export const foeScale = run => { const d = depthOf(run) ** PACE.depthPow; return { dmg: 1 + PACE.depthDmg * d, hp: 1 + PACE.depthHp * d }; };
export const sparkCount = run => Object.values(run?.sparks || {}).reduce((a, n) => a + (n | 0), 0);
export const bossScale = run => ember(emberOf(run)).bossHp * (1 + PACE.bossSpark * sparkCount(run));
// Ward: 10 more health a level (full up to level 5, half a level after that)
export const wardHp = sparks => SPARK.ward.hp * levelGain(sparks?.ward | 0);
export const maxHp = (up, wicks, sparks = null) => BASE.hp + 15 * (up.mantle || 0) + (has(wicks, 'long') ? 20 : 0) + wardHp(sparks);
export const flasksMax = (up, wicks, em = 0) => Math.max(1, BASE.flasks + (up.flask || 0) + (has(wicks, 'oil') ? 1 : 0) - ember(em).flaskCut);
export const healShare = (up, em = 0) => BASE.heal + 0.1 * (up.draught || 0) - ember(em).healCut;
/* the blade's bonuses add (Edge, Keen edge and Flame raise the plunge and the relic hits too: they are Flame moves); damage and heals
   round once, at the end */
export const flameBonus = sparks => SPARK.flame.power * levelGain(sparks?.flame | 0);
export const bladeBonus = (up, wicks, sparks = null) => PACE.blade - 1 + 0.12 * (up.edge || 0) + (has(wicks, 'keen') ? 0.15 : 0) + flameBonus(sparks);
export const healOf = (up, max, em = 0, more = 1) => dealt(healShare(up, em) * more, max);
// a death, or End the run, keeps 10% of the glim carried and 8% more for each Ash pocket level (up to 50%), rounded down
export const keepShare = up => 0.1 + 0.08 * Math.max(0, Math.min(5, up?.ash | 0));

/* ---------------- the colours ----------------
   A spark raises Flame (damage), Ward (health) or Gloam (abilities) by 1 for the rest of the run. colourPower is what the levels give
   the power of that colour's abilities; coolShare is the share of every cooldown that Gloam leaves, never under 60% */
export const sparksOf = run => ({ flame: run?.sparks?.flame | 0, ward: run?.sparks?.ward | 0, gloam: run?.sparks?.gloam | 0 });
export const colourPower = (run, colour) => (SPARK[colour] ? 1 + SPARK[colour].power * levelGain(sparksOf(run)[colour] | 0) : 1);
export const coolShare = run => Math.max(SPARK.gloam.coolMin, 1 - SPARK.gloam.cool * levelGain(sparksOf(run).gloam));
// a spark pick taken: one colour up by 1. Ward raises the health now and at the entry, as a wick does, so a reload keeps it
export function takeSpark(rs, colour) {
  const run = rs.run;
  if (!run || !COLOUR_IDS.includes(colour) || (run.sparkPicks | 0) <= 0) return false;
  run.sparks = sparksOf(run);
  const before = wardHp(run.sparks);
  run.sparks[colour] += 1;
  run.sparkPicks -= 1;
  const more = wardHp(run.sparks) - before;
  if (more) { run.hp += more; if (run.entry) run.entry.hp += more; }
  if (run.entry) { run.entry.sparks = { ...run.sparks }; run.entry.sparkPicks = run.sparkPicks; }
  if (run.sparkPicks <= 0) run.sparkNow = false;
  emit('spark-take', { colour });
  return true;
}
// a cache's spark: one more pick, offered at once on the small card (main.js shows it while sparkNow is set)
export function takeSparkPick(rs) {
  const run = rs.run;
  if (!run) return false;
  run.sparkPicks = Math.min(9, (run.sparkPicks | 0) + 1);
  run.sparkNow = true;
  if (run.entry) run.entry.sparkPicks = run.sparkPicks;
  return true;
}

/* ---------------- the panes ----------------
   A pane is a passive pick, set in a slot in any Lamp-room for free. One slot at first; Lantern panes opens two more. A pane is set in
   one slot at most, and only a kindled pane can be set */
export const paneSlots = rs => Math.min(PANE_SLOTS.max, PANE_SLOTS.base + (rs?.up?.panes | 0));
export const paneOf = (rs, id) => (rs?.panes || []).slice(0, paneSlots(rs)).includes(id);
const kindIds = kind => (kind === 'ability' ? ABILITY_IDS : kind === 'pane' ? PANE_IDS : [...ABILITY_IDS, ...PANE_IDS]);
// the kindled abilities and panes: the starters always, and every pattern kindled
export const kindledOf = (rs, kind = null) => [...new Set([...STARTERS, ...(rs?.kindled || [])])].filter(id => kindIds(kind).includes(id));
export function setPane(rs, slot, id) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= paneSlots(rs)) return false;
  rs.panes ||= [];
  while (rs.panes.length <= slot) rs.panes.push(null);
  if (id === null) { rs.panes[slot] = null; return true; }
  if (!kindledOf(rs, 'pane').includes(id) || rs.panes.some((p, i) => p === id && i !== slot)) return false;
  rs.panes[slot] = id;
  return true;
}
// Ember glass: 20% more damage to a burning foe (a hit on a target adds this to its bonus)
export const paneHit = (rs, t) => (paneOf(rs, 'ember') && (t?.status?.burn > 0 || t?.burning) ? 0.2 : 0);

/* ---------------- the patterns ----------------
   A pattern is the plan of an ability or a pane not yet kindled. It drops as a small lamp and is carried; a lit beacon or a win keeps
   it (rs.patterns), and a death loses it. In the Lamp-room glim kindles it, and from then on it is in the drops of every later run.
   Each draw takes the run's next roll of the seed's `pattern` stream, so the same seed, wares and kindled list give the same drops */
export const patternOf = id => [...ABILITIES, ...PANES].find(x => x.id === id) || null;
export const patternChance = rs => DROPS.pattern + DROPS.patternPerKeen * (rs?.up?.keen | 0);
const patternRoll = run => { run.patternRolls = (run.patternRolls | 0) + 1; return mulberry(hash2(run.seed | 0, run.patternRolls, 0x9a77)); };
// the patterns that may drop: not found, not kindled, not carried and not lying on the ground
export const patternsLeft = rs => PATTERN_IDS.filter(id => !(rs.patterns || []).includes(id) && !kindledOf(rs).includes(id) &&
  !(rs.run?.carriedPatterns || []).includes(id) && !(rs.run?.groundPatterns || []).some(g => g.id === id));
// one roll: with chance 1 it drops one whenever one is left -> the id, or null
export function drawPattern(rs, chance = 1) {
  const run = rs.run;
  if (!run) return null;
  const r = patternRoll(run), roll = r(), left = patternsLeft(rs);
  if (roll >= chance || !left.length) return null;
  return left[Math.floor(r() * left.length)];
}
// a pattern lamp on the ground (a cache's prize calls this, keys.js) -> the id dropped, or null when none is left
export function dropPattern(R, at = null, id = null) {
  const run = R.rs.run;
  if (!run) return null;
  const pick = id ? (patternsLeft(R.rs).includes(id) ? id : null) : drawPattern(R.rs, 1);
  if (!pick) return null;
  const s = R.fighter?.body.s, p = at || [s.x, s.y, s.z];
  (run.groundPatterns ||= []).push({ id: pick, x: p[0], y: p[1], z: p[2] });
  return pick;
}
// what the fight draws: each pattern lamp, with its kind, colour and name
export const groundPatterns = R => (R?.rs?.run?.groundPatterns || []).map(g => {
  const x = patternOf(g.id);
  return { ...g, kind: ABILITY_IDS.includes(g.id) ? 'ability' : 'pane', colour: x?.colour || 'gloam', name: x?.name || g.id };
});
// the glim a Lamp-room can spend: in a run the glim carried, and the bank
export const purse = rs => (rs.bank | 0) + (rs.run?.carried | 0);
// spend the glim carried first, then the bank. The entry's glim goes down by the part carried, so a reload cannot give it back
export function pay(rs, cost) {
  if (purse(rs) < cost) return false;
  const run = rs.run, fromCarried = run ? Math.min(run.carried | 0, cost) : 0;
  if (run) {
    run.carried -= fromCarried;
    if (run.entry) run.entry.carried = Math.max(0, (run.entry.carried | 0) - fromCarried);
  }
  rs.bank -= cost - fromCarried;
  return true;
}
// the Lamp-room's Kindle: a found pattern, for its cost; it is final
export function kindle(rs, id) {
  const p = PATTERNS.find(x => x.id === id);
  if (!p || !(rs.patterns || []).includes(id) || kindledOf(rs).includes(id) || !pay(rs, p.cost)) return false;
  rs.patterns = rs.patterns.filter(x => x !== id);
  rs.kindled = [...new Set([...(rs.kindled || []), id])];
  emit('pattern-kindled', { id });
  return true;
}
// the pattern lamps on the ground of the place become carried (a lit beacon, the win)
function takeGround(run) {
  for (const g of run.groundPatterns || []) if (!(run.carriedPatterns ||= []).includes(g.id)) run.carriedPatterns.push(g.id);
  run.groundPatterns = [];
}
// patterns carried become found: at a lit beacon or the win -> the ids kept
function keepPatterns(rs) {
  const run = rs.run, ids = (run.carriedPatterns || []).filter(id => !(rs.patterns || []).includes(id) && !kindledOf(rs).includes(id));
  rs.patterns = [...new Set([...(rs.patterns || []), ...ids])];
  run.carriedPatterns = [];
  run.patternsKept = (run.patternsKept | 0) + ids.length;
  if (ids.length) emit('pattern-kept', { ids });
  return ids;
}

/* ---------------- the start of a run ----------------
   Without Belt, slot 1 holds one ability drawn by the seed's `start` stream from the kindled abilities. Belt 1 offers two for slot 1;
   Belt 2 also fills slot 2; Belt 3 makes the start abilities bright. The Wick shelf's two draws come first in the same stream */
export function startAbilities(seed, rs) {
  const left = kindledOf(rs, 'ability'), belt = rs?.up?.belt | 0, r = stream(seed, 'start'), bright = belt >= 3;
  r(); r();
  const take = () => (left.length ? left.splice(Math.floor(r() * left.length), 1)[0] : null);
  const slot = id => (id ? { id, bright } : null);
  if (belt < 1) return { offer: null, slots: [slot(take()), null] };
  const offer = [take(), take()].filter(Boolean), two = belt >= 2 ? take() : null;
  return { offer: offer.length > 1 ? offer : null, slots: [offer.length === 1 ? slot(offer[0]) : null, slot(two)] };
}
// Belt's start choice: one of the two offered goes in slot 1; with Belt 2 and no third ability kindled, the other fills slot 2
export function chooseStartAbility(rs, id) {
  const run = rs.run;
  if (!run || !run.abilityOffer || !run.abilityOffer.includes(id)) return false;
  const bright = (rs.up.belt | 0) >= 3;
  run.abilities ||= [null, null];
  run.abilities[0] = { id, bright };
  if ((rs.up.belt | 0) >= 2 && !run.abilities[1]) { const other = run.abilityOffer.find(x => x !== id); run.abilities[1] = other ? { id: other, bright } : null; }
  run.abilityOffer = null;
  if (run.entry) run.entry.abilities = run.abilities.map(a => (a ? { ...a } : null));
  return true;
}
// the start card still asks: a wick from the shelf, a spark of First spark or Belt's ability
export const startPicks = run => !!(run && (run.offer || (run.sparkPicks | 0) > 0 || run.abilityOffer));
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
  const start = startAbilities(s, rs);
  rs.run = {
    seed: s, place: ORDER[0], time: 0, hp: max, flasks: fl, carried: 0, banked: 0, foes: 0, wicks: [], offer: null, bossDown: false, entry: null,
    route: routeFor(s, e), ember: e, relics: [], elitesDown: [], combo: 0, lastUsed: false, shelf: false,
    // growth (gloam-downs-growth): the colours, the spark picks left (First spark gives them at the start), the two ability slots and
    // Belt's offer, the patterns carried and on the ground, the caches opened, the ability lamps, and the rolls and counts of the drops
    sparks: { flame: 0, ward: 0, gloam: 0 }, sparkPicks: Math.min(9, rs.up.first | 0), sparkNow: false, abilities: start.slots, abilityOffer: start.offer,
    carriedPatterns: [], groundPatterns: [], caches: [], abilityLamps: [], patternRolls: 0, abilityRolls: 0, foePatterns: 0, abilityDrops: 0, patternsKept: 0, kept: [],
    // the recap (gloam-downs-screens-life): each place left, with the run's time, foes and patterns kept as it was left, and what hit last
    splits: [], lastHurt: null
  };
  // Wick shelf: the run starts with a choice of two wicks, on the beacon card's own buttons
  if ((rs.unlocks || []).includes('shelf')) rs.run.offer = startOffer(s, rs.unlocks);
  // the start card (the beacon card's buttons) asks for the shelf's wick, First spark's sparks and Belt's ability
  rs.run.shelf = startPicks(rs.run);
  enter(rs.run);
  rs.wander = false;
  rs.ended = null;
  return rs.run;
}
// the growth fields a reload restores as they were at the entry
const GROWN = ['sparks', 'sparkPicks', 'abilities', 'carriedPatterns', 'groundPatterns', 'caches', 'abilityLamps', 'patternRolls', 'foePatterns', 'abilityDrops', 'abilityRolls'];
const copy = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
export function enter(run) {
  run.entry = { hp: run.hp, flasks: run.flasks, carried: run.carried, foes: run.foes, relics: (run.relics || []).slice(), elitesDown: (run.elitesDown || []).slice(), lastUsed: !!run.lastUsed };
  for (const k of GROWN) if (k in run) run.entry[k] = copy(run[k]);
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
  for (const k of GROWN) if (k in e) run[k] = copy(e[k]);
  run.sparkNow = false;
  return run;
}
// move the run to the start of a place, as Walk on does: the entry snapshot is taken from the values now
export function goTo(rs, id) {
  // the recap's split of the place left: the run's time and foes then, and the patterns its beacon kept
  const sp = (rs.run.splits ||= []);
  if (rs.run.place !== id && !sp.some(x => x.id === rs.run.place)) sp.push({ id: rs.run.place, time: rs.run.time, foes: rs.run.foes, kept: (rs.run.kept || []).slice() });
  rs.run.place = id;
  rs.furthest = Math.max(rs.furthest || 0, routeOfRun(rs.run).indexOf(id));
  // the lamps left lying in the last place are gone
  if (rs.run.groundPatterns) rs.run.groundPatterns = [];
  if (rs.run.abilityLamps) rs.run.abilityLamps = [];
  enter(rs.run);
}
export const maxOf = rs => maxHp(rs.up, rs.run?.wicks, rs.run?.sparks);
export const flasksOf = rs => flasksMax(rs.up, rs.run?.wicks, emberOf(rs.run));
// Tallow glass: a flask heals 10% more
export const healNow = rs => healOf(rs.up, maxOf(rs), emberOf(rs.run), paneOf(rs, 'tallow') ? 1.1 : 1);
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
/* a buy in the Lamp-room or at a beacon, with the glim carried first and then the bank: a Mantle level bought in a run raises the
   health too, and a Flask level adds a full flask */
export function buy(rs, id) {
  const u = UPGRADES.find(x => x.id === id), lvl = rs.up[id] || 0;
  if (!u || lvl >= u.costs.length || !pay(rs, u.costs[lvl])) return false;
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
  if (!u || rs.unlocks.includes(id) || !pay(rs, u.cost)) return false;
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
/* a lit beacon keeps the glim carried as carried (it is spent in the Lamp-room, or carried on, and a death keeps only a share), keeps
   the patterns carried and fills every flask (one flask at Ember 5); before the last place it moves the run to the next place of its
   route with two wicks and one spark pick offered; at the last it is the win */
export function lightBeacon(rs) {
  const run = rs.run, route = routeOfRun(run), i = route.indexOf(run.place);
  // the pattern lamps still lying in this place are taken with the beacon, as the glim motes not yet taken are (onLight)
  takeGround(run);
  run.flasks = Math.min(flasksOf(rs), run.flasks + Math.min(flasksOf(rs), ember(emberOf(run)).beaconFlasks));
  if (i === route.length - 1) return win(rs);
  run.kept = keepPatterns(rs);
  run.offer = drawOffer(run.seed, i, run.wicks, rs.unlocks);
  run.sparkPicks = Math.min(9, (run.sparkPicks | 0) + 1);
  run.sparkNow = false;
  run.abilityOffer = null;
  run.shelf = false;
  goTo(rs, route[i + 1]);
  return { next: run.place, offer: run.offer.slice(), kept: run.kept.slice() };
}
/* the recap's fields of an ended run (gloam-downs-screens-life "The summary and the win card"): path, one { id, time, foes } a place
   reached, each its own share of the run's time and foes; colours, the sparks; patternNames, the ids kept in the whole run; by, the
   type code of the last hit taken ('S', 'P', 'M', 'I', 'B', an elite's id, or 'fall'), or null */
function recapFields(run, keptNow = []) {
  const path = [], sp = (run.splits || []).filter(x => x && ORDER.includes(x.id));
  let t = 0, f = 0;
  for (const x of sp) { path.push({ id: x.id, time: Math.max(0, x.time - t), foes: Math.max(0, x.foes - f) }); t = x.time; f = x.foes; }
  if (!path.some(x => x.id === run.place)) path.push({ id: run.place, time: Math.max(0, run.time - t), foes: Math.max(0, run.foes - f) });
  const names = [...new Set([...sp.flatMap(x => x.kept || []), ...keptNow])];
  return { path, colours: { ...sparksOf(run) }, patternNames: names, by: run.lastHurt ?? null };
}
// a win at the top open level opens the next one, up to Ember 5; the best time is kept for each level
export function win(rs) {
  const run = rs.run, em = emberOf(run);
  takeGround(run);
  // the win banks all the glim carried, and keeps the patterns carried
  const kept = keepPatterns(rs), glim = run.carried | 0;
  rs.bank += glim;
  run.banked += glim;
  run.carried = 0;
  rs.wins += 1;
  rs.runs += 1;
  if (!rs.bestWin || run.time < rs.bestWin) rs.bestWin = run.time;
  rs.bestByEmber ||= [0, 0, 0, 0, 0, 0];
  if (!rs.bestByEmber[em] || run.time < rs.bestByEmber[em]) rs.bestByEmber[em] = run.time;
  const opened = em >= (rs.emberTop | 0) && em < EMBER_TOP;
  if (opened) rs.emberTop = em + 1;
  rs.bestCombo = Math.max(rs.bestCombo | 0, run.combo | 0);
  rs.ended = {
    won: true, place: run.place, time: run.time, foes: run.foes, kept: glim, lost: 0, banked: run.banked, ember: em, opened: opened ? em + 1 : null, relics: (run.relics || []).slice(), combo: run.combo | 0, seed: run.seed,
    patternsKept: run.patternsKept | 0, patternsLost: 0, ...recapFields(run, kept)
  };
  rs.run = null;
  return { won: true, kept };
}
// at 0 health, or End the run: 10% of the glim carried is kept, and 8% more each Ash pocket level, rounded down; the rest is lost, and
// so are the patterns carried
export function die(rs) {
  const run = rs.run, kept = Math.floor(run.carried * keepShare(rs.up) + 1e-9);
  rs.bank += kept;
  rs.runs += 1;
  rs.deaths += 1;
  rs.bestCombo = Math.max(rs.bestCombo | 0, run.combo | 0);
  rs.ended = {
    won: false, place: run.place, time: run.time, foes: run.foes, kept, lost: run.carried - kept, banked: run.banked + kept, ember: emberOf(run), opened: null, relics: (run.relics || []).slice(), combo: run.combo | 0, seed: run.seed,
    patternsKept: run.patternsKept | 0, patternsLost: (run.carriedPatterns || []).length, ...recapFields(run)
  };
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
export function makeRunner({ walk, meta, body, rs, targets = () => [], lightable = () => ({ ok: true }), drop = null, think = null, onLight = null, still = false, log = [], fx = {}, clock = makeClock(), abilities = null, keys = null }) {
  // fx.stop false turns hit stop off (__gloam.fx), so the game must still play with it off
  const stop = n => (fx.stop === false ? 0 : hitStop(clock, n));
  // Clear glass: an ability use makes the next blade hit within 2 s deal 40% more
  const clearOn = () => paneOf(rs, 'clear') && R.clearUntil > clock.play;
  const stats = () => {
    const run = rs.run;
    if (!run) return {};
    return {
      bonus: bladeBonus(rs.up, run.wicks, run.sparks) + (clearOn() ? PANE_RULES.clear : 0), heavy: run.wicks.includes('heavy'), quick: run.wicks.includes('heels'), shave: run.wicks.includes('shave'),
      drink: run.flasks <= 0 ? 'empty' : run.hp >= maxOf(rs) ? 'full' : 'ok', relics: run.relics || [], unlocks: rs.unlocks || [],
      extra: t => paneHit(rs, t)
    };
  };
  const fighter = makeFighter(body, walk, { stats });
  const R = {
    clock, fighter, rs, meta, log, fx, wisps: new Set(), lit: false, dead: false, onBeacon: false, hurtAt: -1, blink: still ? 8 : 4,
    pend: { attack: false, roll: false, heal: false, ab1: false, ab2: false }, targets, lightable, think,
    drop: drop || ((n) => { if (rs.run) rs.run.carried += n; }),
    // the place's elite (elites.js sets it when it wakes), and the relics lying here and the fires they light (relics.js)
    elite: null, max: () => maxOf(rs), bonus: () => (rs.run ? bladeBonus(rs.up, rs.run.wicks, rs.run.sparks) : 0),
    // growth: the toasts the page shows next (main.js updateGrowth), Lead glass ready for the next fight, Clear glass's window
    notes: [], lead: true, clearUntil: -1
  };
  // the floor under (x, z) near y: where a drop lies (the relic and the pattern lamp of an elite, a flier's drops)
  R.floorAt = (x, z, y) => walk.support(x, z, y + 1.2);
  R.relics = makeRelics(R);
  R.abilities = abilities ? abilities(R) : null;
  R.keys = keys ? keys(R) : null;
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
    // Bell guard (abilities.js): the blow is turned aside. A blow that would not hurt anyway (in the roll's safe time or the 0.9 s
    // after a hit) does not spend it, and a roll's near miss stays a near miss
    if (!safe && R.abilities?.turn(from, ev, o)) return 'none';
    if (safe) {
      if (safe === 'roll') {
        const shave = run.wicks.includes('shave');
        if (shave) fighter.nearMiss();
        // Tinder guard: the next attack within 1 s starts at the finisher
        if ((run.relics || []).includes('tinder')) fighter.tinder();
        ev.push({ type: 'miss' });
        cue(ev, 'miss', shave ? { shave } : {});
        // Storm glass: a near miss cools both abilities by 1 s
        R.abilities?.nearMiss();
      }
      return 'safe';
    }
    // Ember 4: foes deal 20% more. Lead glass: the first hit of each fight deals half
    const lead = paneOf(rs, 'lead') && R.lead;
    if (paneOf(rs, 'lead')) R.lead = false;
    const d = Math.round(dmg * ember(emberOf(run)).dmg * (lead ? PANE_RULES.lead : 1));
    run.hp = Math.max(0, run.hp - d);
    run.lastHurt = byOf(from, o);
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
  /* who dealt a hit: o.by when the caller says; a coal is the nearest Pitchrook's; else the target nearest to where the blow came from
     (within 3 m). An elite is named by its id, the boss by 'B', a foe by its type */
  function byOf(from, o = {}) {
    if (typeof o.by === 'string') return o.by;
    const s = body.s, list = R.targets().filter(t => t && (t.type || t.code));
    const at = o.coal ? [s.x, s.z] : from;
    let best = null, d0 = o.coal ? 40 : 3;
    for (const t of list) {
      if (o.coal && (t.type || t.code) !== 'P') continue;
      const d = at ? Math.hypot(t.x - at[0], t.z - at[1]) : 0;
      if (d < d0) { d0 = d; best = t; }
    }
    return best ? (best.elite?.id || best.type || best.code) : o.coal ? 'P' : null;
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
    const y0 = R.floorAt(e.x, e.z, e.y) ?? e.y;
    R.relics.drop(relic, [e.x, y0, e.z]);
    let flask = false;
    if ((rs.unlocks || []).includes('kflask') && run.flasks < flasksOf(rs)) { run.flasks += 1; flask = true; }
    ev.push({ type: 'elite', what: 'fall', name: el.elite?.name || 'The elite', place: run.place, relic, flask }, { type: 'store' });
    emit('elite-fall', { place: run.place, relic });
    R.keys?.eliteOut(run.place, ev);
    // an elite drops a pattern with a chance of 35%, 1.8 m from its relic on the same ground, so the two are taken (and named) apart
    const pat = drawPattern(rs, DROPS.patternElite);
    if (pat) {
      // the first of four spots 1.8 m away on floor within 0.6 m of the relic's, with no wall between; else beside the relic
      let at = [e.x + 0.6, R.floorAt(e.x + 0.6, e.z, y0) ?? y0, e.z];
      for (const [dx, dz] of [[1.8, 0], [-1.8, 0], [0, 1.8], [0, -1.8]]) {
        const y = R.floorAt(e.x + dx, e.z + dz, y0);
        if (Number.isFinite(y) && Math.abs(y - y0) < 0.6 && clearLine(walk, e.x, y0 + 0.9, e.z, e.x + dx, y + 0.9, e.z + dz)) { at = [e.x + dx, y, e.z + dz]; break; }
      }
      dropPattern(R, at, pat);
    }
  }
  // a pattern lamp touched: carried until the next beacon, with a toast
  function takePatterns(ev) {
    const run = rs.run, p = body.s;
    for (const g of (run.groundPatterns || []).slice()) {
      if (Math.hypot(p.x - g.x, p.z - g.z) > PANE_RULES.touch || Math.abs(p.y - g.y) > 1.6) continue;
      run.groundPatterns.splice(run.groundPatterns.indexOf(g), 1);
      if ((run.carriedPatterns ||= []).includes(g.id)) continue;
      run.carriedPatterns.push(g.id);
      const name = patternOf(g.id)?.name || g.id;
      R.notes.push(`A pattern: <b>${name}</b>. Light a beacon to keep it.`);
      ev.push({ type: 'pattern', what: 'take', id: g.id }, { type: 'store' });
      cue(ev, 'wisp', { pattern: g.id });
      emit('pattern-found', { id: g.id, place: run.place });
    }
  }
  function step(act, camYaw) {
    const ev = (R.out = []);
    // a press during hit stop waits for the next play step
    for (const k of ['attack', 'roll', 'heal', 'ab1', 'ab2']) if (act[k]) R.pend[k] = true;
    const play = advance(clock);
    if (play && rs.run && !R.dead) {
      const a = { ...act };
      for (const k of Object.keys(R.pend)) { a[k] = act[k] || R.pend[k]; R.pend[k] = false; }
      // Lead glass: a new fight begins once no foe sees the lamplighter (a foe asleep at home, or homing, is not in the fight)
      if (!R.targets().some(t => t.aware)) R.lead = true;
      fighter.step(a, camYaw, R.targets(), ev);
      R.abilities?.step(a, camYaw, ev);
      R.keys?.step(a, ev);
      rs.run.time += STEP;
      const s = body.s;
      meta.wisps.forEach((w, i) => { if (!R.wisps.has(i) && touches(s, w.p)) take(i, ev); });
      R.relics.take(ev);
      takePatterns(ev);
      const on = atBeacon(s, meta.beacon);
      if (on && !R.onBeacon) light(ev);
      R.onBeacon = on;
      // a fall below y -25 does not end the run: back on the last firm ground, 10 health lost (never below 1), and safe a while
      if (rs.run && s.y < MOVES.fall.below) {
        fighter.toFirm();
        rs.run.hp = Math.max(1, rs.run.hp - MOVES.fall.dmg);
        rs.run.lastHurt = 'fall';
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
      // Clear glass: an ability's use opens 2 s for the next blade hit (the cut or the plunge), which takes it
      if (e.type === 'ability-use' || (e.type === 'ability' && e.what === 'use')) R.clearUntil = clock.play + steps(PANE_RULES.clearFor);
      else if (e.type === 'hit' && e.kind !== 'relic' && !e.ability && R.clearUntil > clock.play) R.clearUntil = -1;
      if (e.type === 'stop') stop(e.n);
      // a drink that ends after the flasks went to 0 (a test hook, a later stage's cost) heals nothing and takes nothing
      else if (e.type === 'drink' && rs.run && rs.run.flasks > 0) {
        rs.run.flasks -= 1;
        rs.run.hp = Math.min(maxOf(rs), rs.run.hp + healNow(rs));
        // Tallow glass: a flask cools both abilities by 3 s
        R.abilities?.drink();
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
  /* a cache's prize (keys.js opens it): glim (its n, with the Ember factor), a spark pick offered at once, a pattern lamp or an ability
     lamp at the cache, or a flask filled. A prize that has nothing left to give (no pattern left, flasks full, no abilities) gives
     its glim instead. -> what it gave */
  R.prize = (kind, at, ev, sp = {}) => {
    const run = rs.run;
    if (!run) return null;
    const glim = () => { const n = glimAt(sp.n || 25); run.carried += n; ev.push({ type: 'glim', n }); R.notes.push(`A cache · +${n} glim`); return 'glim'; };
    if (kind === 'spark') { takeSparkPick(rs); R.notes.push('A cache · a spark: choose a colour'); return 'spark'; }
    if (kind === 'pattern') { const id = dropPattern(R, at); if (id) { R.notes.push(`A cache · a pattern lamp: <b>${patternOf(id)?.name || id}</b>`); return 'pattern'; } return glim(); }
    if (kind === 'ability') { const l = R.abilities?.dropAt?.(at); if (l) { R.notes.push(`A cache · an ability lamp: <b>${l.name}</b>`); return 'ability'; } return glim(); }
    if (kind === 'flask' && run.flasks < flasksOf(rs)) { run.flasks += 1; R.notes.push('A cache · a flask fills'); return 'flask'; }
    return glim();
  };
  R.step = step; R.hurt = hurt; R.light = light; R.take = take; R.kill = (ev = R.out) => { if (rs.run && !R.dead) kill(ev); return ev; };
  // a foe put out: one more for the run's count, and its glim drops, with the Ember level's 15% a level
  R.out = [];
  R.foeOut = (glim = 0, at = null, foe = null) => {
    const run = rs.run;
    if (!run) return;
    run.foes += 1;
    if (glim) R.drop(glimAt(glim), at);
    // Thick glass: a foe put out heals 3% of the maximum health
    if (paneOf(rs, 'thick') && !R.dead) run.hp = Math.min(maxOf(rs), run.hp + dealt(PANE_RULES.thick, maxOf(rs)));
    // Hot glass: a foe put out within 3 s of an ability cools the other one by 2 s
    R.abilities?.foeOut();
    // the elite's own drop is eliteOut's (35%); any other foe drops a pattern with 2%, 1% more a Keen eye level, at most 2 a run
    const elite = !!(foe && R.elite && foe.id === R.elite.id);
    if (elite) return;
    const s = body.s, where = at || [s.x, s.y, s.z];
    if ((run.foePatterns | 0) < DROPS.patternMax) {
      const pat = drawPattern(rs, patternChance(rs));
      if (pat) { run.foePatterns = (run.foePatterns | 0) + 1; dropPattern(R, where, pat); }
    }
    // an ability lamp: 3%, 1% more a Keen eye level, at most 3 a run (abilities.js draws it from the kindled abilities)
    if (R.abilities && (run.abilityDrops | 0) < DROPS.abilityMax && R.abilities.dropRoll?.(where)) run.abilityDrops = (run.abilityDrops | 0) + 1;
  };
  return R;
}
// the panes' numbers that the runner uses (the panes about cooldowns are abilities.js's)
export const PANE_RULES = { thick: 0.03, lead: 0.5, clear: 0.4, clearFor: 2, touch: 1.0 };
