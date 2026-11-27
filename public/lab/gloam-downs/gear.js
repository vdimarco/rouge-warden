// Gloam Downs: the gear tables and their rules. The blades, the off-hands, the quality tiers, the drop tables by place depth, the
// traits, and the odds of a gear drop's kind and a pattern drop's kind; then the rolls (tier and traits from the seed), the blades'
// strings, the start gear and its picks, and the save's checks of a gear item (gloam-downs-hub design.md "Part C"). No DOM, and no
// import of growth.js, run.js or moves.js (growth.js reads the tables here at load), so the page, the Node tests and the bot read the
// same numbers with no import loop.
import { ORDER } from './save.js';
import { mulberry, hash2 } from '../kit/rng.js';

// the slots of the gear, in the HUD's order
export const GEAR_SLOTS = ['blade', 'offhand', 'ability', 'ability'];
// the blades: one held. start: there from the first run, else a pattern with its cost. bone: the blade bone's length (and width)
export const BLADES = [
  { id: 'lamp', name: 'Lamp blade', colour: 'flame', start: true, text: '2 cuts and a finisher', cuts: 3, speed: 1, reach: 0, dmg: 1, bone: 1 },
  { id: 'hook', name: 'Hook blade', colour: 'flame', cost: 160, text: 'a long reach; the finisher sweeps and pulls', cuts: 3, speed: 0.85, reach: 0.6, dmg: 1.1, bone: 1.4, sweep: 180, pull: 1 },
  { id: 'twin', name: 'Twin knives', colour: 'gloam', cost: 160, text: '4 quick cuts; the 4th adds 1 Char', cuts: 4, speed: 1.25, reach: 0, dmg: 0.9, bone: 0.7, char: 1 },
  { id: 'bell', name: 'Bell maul', colour: 'ward', cost: 200, text: 'slow, heavy cuts; hold Attack to slam', cuts: 2, speed: 0.7, reach: 0, dmg: 1.5, bone: 1.2, width: 1.5, poise: 2, slam: { dmg: 30, r: 2.5, hold: 0.5 } }
];
export const BLADE_IDS = BLADES.map(b => b.id);
// the off-hands: one held, with its own button. cool in s
export const OFFHANDS = [
  { id: 'buckler', name: 'Buckler', colour: 'ward', start: true, cool: 1.2, cue: 'buckler', text: 'raise it; a blow in the first 0.2 s is parried', raise: 0.6, parry: 0.2, late: 0.4, stagger: 0.6, poise: 30 },
  { id: 'cuff', name: 'Iron cuff', colour: 'ward', cost: 120, cool: 3, cue: 'cuff', text: 'a bash that pushes light foes', dmg: 6, range: 1.5, poise: 30, push: 1.5 },
  { id: 'sling', name: 'Sling', colour: 'flame', cost: 100, cool: 1.5, cue: 'sling', text: 'a stone at the nearest foe ahead', dmg: 8, range: 9, char: 1 },
  { id: 'pot', name: 'Fire pot', colour: 'flame', cost: 130, cool: 5, cue: 'pot', text: 'a thrown pot bursts in fire', dmg: 10, range: 5, r: 1.5, burn: 3 },
  { id: 'chain', name: 'Lamp chain', colour: 'gloam', cost: 150, cool: 6, cue: 'chain', text: 'a chain pulls you to a foe and Marks it', dmg: 6, range: 7, time: 0.2 },
  { id: 'shade', name: 'Shade lamp', colour: 'gloam', cost: 140, cool: 8, cue: 'shade', text: 'a hooded lamp blinds foes in a cone', r: 4, arc: 60, raise: 0.4 }
];
export const OFFHAND_IDS = OFFHANDS.map(o => o.id);
// the quality tiers: power multiplies damage, heals and shell points after the colour; never a cooldown, a time or a reach
export const TIERS = [
  { id: 'plain', name: 'plain', pips: 0, power: 1, traits: 0 },
  { id: 'bright', name: 'bright', pips: 1, power: 1.25, traits: 1 },
  { id: 'blazing', name: 'blazing', pips: 2, power: 1.4, traits: 2 }
];
export const TIER_IDS = TIERS.map(t => t.id);
// the tier odds by place depth, in the order plain, bright, blazing. Row 5 is an elite's drop or a cache at depth 4; an elite's drop
// and a cache use the next row down. Each Keen eye level moves `perKeen` from plain to bright, each Ember level `perEmber` from plain
// to blazing, and plain never goes under `plainMin`
export const DEPTH_TIERS = [
  [90, 10, 0],
  [75, 22, 3],
  [60, 32, 8],
  [45, 40, 15],
  [35, 42, 23],
  [25, 45, 30]
];
export const TIER_SHIFT = { perKeen: 4, perEmber: 2, plainMin: 10 };
// the traits: a bright item rolls 1, a blazing item 2 different ones, from those that fit its kind
const ALL = ['blade', 'offhand', 'ability'], HELD = ['blade', 'offhand'];
export const TRAITS = [
  { id: 'smoulder', name: 'Smouldering', fits: ALL, text: 'its hits burn 2 s', burn: 2 },
  { id: 'steady', name: 'Steady', fits: ALL, text: '6% of its hits are sure cuts', sure: 0.06 },
  { id: 'glean', name: 'Gleaning', fits: ALL, text: 'a foe it puts out heals 2% of max health', heal: 0.02 },
  { id: 'char', name: 'Charring', fits: ALL, text: 'each 4th hit adds 1 Char', every: 4, char: 1 },
  { id: 'quick', name: 'Quick', fits: ALL, text: 'a faster string, or a shorter cooldown', speed: 0.06, cool: 0.1 },
  { id: 'wide', name: 'Wide', fits: ALL, text: 'a longer reach, or a wider reach', reach: 0.3, wide: 0.15 },
  { id: 'weight', name: 'Weighted', fits: HELD, text: 'poise worn 30% faster', poise: 0.3 },
  { id: 'hoard', name: 'Hoarding', fits: ALL, text: 'a foe it puts out gives 1 more glim', glim: 1 },
  { id: 'shelling', name: 'Shelling', fits: ALL, text: 'a foe it puts out gives a 6 shell for 4 s', shell: 6, time: 4 },
  { id: 'dim', name: 'Dimming', fits: HELD, text: 'each 4th hit blinds the foe 1.5 s', every: 4, blind: 1.5 }
];
export const TRAIT_IDS = TRAITS.map(t => t.id);
// gear drops in a run: the chance a foe put out rolls one, the most a place, the kind's odds, and the most lying in a place
export const GEAR_DROPS = { chance: 0.03, perKeen: 0.01, elite: 0.6, max: 3, lamps: 6 };
export const GEAR_KIND_ODDS = { rack: { ability: 50, blade: 25, offhand: 25 }, base: { ability: 65, blade: 0, offhand: 35 } };
// a pattern drop picks a kind first, in this order; a kind with none left passes to the next
export const PATTERN_KIND_ORDER = ['ability', 'pane', 'blade', 'offhand'];
export const PATTERN_KIND_ODDS = { rack: { ability: 40, pane: 30, blade: 15, offhand: 15 }, base: { ability: 45, pane: 35, blade: 0, offhand: 20 } };
// the HUD's marks: the category glyphs and the colours' corner shapes, so a tile reads on a grey screen too
export const GEAR_GLYPHS = { blade: 'blade', offhand: 'shield', ability: 'flame', pane: 'square', wick: 'wick' };
export const COLOUR_SHAPES = { flame: 'triangle', ward: 'square', gloam: 'diamond' };

/* ---------------- an item ----------------
   A gear item is { id, tier, traits }: a held blade, a held off-hand, an ability in a slot, or one lying on the ground. An old item
   with bright: true reads as the bright tier with no trait (a v3 save, a test) */
export const bladeOf = id => BLADES.find(b => b.id === id) || null;
export const offhandOf = id => OFFHANDS.find(o => o.id === id) || null;
export const tierRow = id => TIERS.find(t => t.id === id) || TIERS[0];
export const traitOf = id => TRAITS.find(t => t.id === id) || null;
export const tierOf = x => (x && TIER_IDS.includes(x.tier) ? x.tier : x?.bright === true ? 'bright' : 'plain');
export const traitsOf = x => (Array.isArray(x?.traits) ? x.traits.filter(t => TRAIT_IDS.includes(t)) : []);
export const hasTrait = (x, trait) => traitsOf(x).includes(trait);
// a plain item, and a copy of one in the save's shape
export const plain = id => ({ id, tier: 'plain', traits: [] });
export const gearCopy = x => (x ? { id: x.id, tier: tierOf(x), traits: traitsOf(x).slice() } : null);
// the power of an item's tier: it multiplies damage, heals and shell points after the colour, never a cooldown, a time or a reach
export const tierPower = slot => (slot ? tierRow(tierOf(slot)).power : 1);
// Quick: an off-hand's or an ability's cooldown 10% shorter; Wide: its radius or range 15% more
export const traitCool = slot => (hasTrait(slot, 'quick') ? 1 - traitOf('quick').cool : 1);
export const traitWide = slot => (hasTrait(slot, 'wide') ? 1 + traitOf('wide').wide : 1);
// the trait names an item reads by, after its name: "Hook blade, Smouldering, Wide"
export const traitNames = x => traitsOf(x).map(t => traitOf(t).name);

/* ---------------- the save's checks ----------------
   cleanGear(v, kind, known): an item of that kind with an id in `known` (the kindled ones), its tier known (else plain), and its
   traits known, each once, fitting the kind, and no more than the tier's count. -> the item, or null */
export function cleanGear(v, kind, known) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || !known.includes(v.id)) return null;
  const tier = tierOf(v), most = tierRow(tier).traits;
  const traits = [...new Set(traitsOf(v))].filter(t => traitOf(t).fits.includes(kind)).slice(0, most);
  return { id: v.id, tier, traits };
}

/* ---------------- the kindled gear and the start ----------------
   A blade or off-hand is kindled when it is there from the first run (start) or its pattern is in rs.kindled */
export const kindledGear = (rs, kind) => (kind === 'blade' ? BLADES : OFFHANDS).filter(x => x.start || (rs?.kindled || []).includes(x.id)).map(x => x.id);
// the blade rack and the off-hand stand in the hall: Pick sets the start blade or off-hand (null, none, is an off-hand pick too)
export function chooseBlade(rs, id) {
  if (!rs || !kindledGear(rs, 'blade').includes(id)) return false;
  rs.blade = id;
  return true;
}
export function chooseOffhand(rs, id) {
  if (!rs || (id !== null && !kindledGear(rs, 'offhand').includes(id))) return false;
  rs.offhand = id;
  return true;
}
// the gear a run starts with: the picked blade and off-hand, plain, with no traits; nothing on the ground; the draw counters at 0
export function startGear(rs) {
  const blade = kindledGear(rs, 'blade').includes(rs?.blade) ? rs.blade : 'lamp';
  const off = rs?.offhand === undefined ? 'buckler' : rs.offhand;
  return {
    blade: plain(blade), offhand: off && kindledGear(rs, 'offhand').includes(off) ? plain(off) : null,
    gearLamps: [], offCool: 0, gearRolls: 0, tierRolls: 0, traitRolls: 0, gearDrops: 0
  };
}
// the run's gear fields that a reload restores as they were at the place's entry (run.js GROWN)
export const GEAR_GROWN = ['blade', 'offhand', 'gearLamps', 'gearRolls', 'tierRolls', 'traitRolls', 'gearDrops'];

/* ---------------- the rolls ----------------
   Three streams of the seed, each with its own counter in the run, so no other draw moves them: `gear` (a drop's chance, kind and
   item; gear-play.js), `tier` and `trait`. A depth is the place's index in the run's route: 0 for the first place, 4 for Barrow Crown */
const SALT = { gear: 0x6ea7, tier: 0x7e17, trait: 0x7a17 };
const COUNTER = { gear: 'gearRolls', tier: 'tierRolls', trait: 'traitRolls' };
export function gearRoll(run, name) {
  const k = COUNTER[name];
  run[k] = (run[k] | 0) + 1;
  return mulberry(hash2(run.seed | 0, run[k], SALT[name]));
}
export const depthIn = run => {
  const route = Array.isArray(run?.route) && run.route.length === ORDER.length ? run.route : ORDER;
  return Math.max(0, route.indexOf(run?.place));
};
/* the tier odds [plain, bright, blazing] at a depth: an elite's drop or a cache uses the next row down; each Keen eye level moves 4
   points from plain to bright and each Ember level 2 points from plain to blazing, and plain never goes under 10 */
export function tierOdds(depth, { elite = false, keen = 0, ember = 0 } = {}) {
  const row = DEPTH_TIERS[Math.max(0, Math.min(DEPTH_TIERS.length - 1, (depth | 0) + (elite ? 1 : 0)))].slice();
  const T = TIER_SHIFT;
  const toBright = Math.max(0, Math.min(keen * T.perKeen, row[0] - T.plainMin));
  row[0] -= toBright; row[1] += toBright;
  const toBlaze = Math.max(0, Math.min(ember * T.perEmber, row[0] - T.plainMin));
  row[0] -= toBlaze; row[2] += toBlaze;
  return row;
}
export function drawTier(r, odds) {
  const x = r() * (odds[0] + odds[1] + odds[2]);
  return x < odds[0] ? 'plain' : x < odds[0] + odds[1] ? 'bright' : 'blazing';
}
// n different traits that fit the kind
export function drawTraits(r, kind, n) {
  const pool = TRAITS.filter(t => t.fits.includes(kind)).map(t => t.id), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}
/* the tier and traits of a found item of a kind, from the run's next draws of `tier` and `trait` (abilities.js drawAbility, gear drops,
   caches). o: { elite, depth } (the depth defaults to the run's place). -> { tier, traits } */
export function rollGear(rs, kind, o = {}) {
  const run = rs?.run;
  if (!run) return { tier: 'plain', traits: [] };
  const odds = tierOdds(o.depth ?? depthIn(run), { elite: !!o.elite, keen: rs.up?.keen | 0, ember: run.ember | 0 });
  const tier = drawTier(gearRoll(run, 'tier'), odds);
  const n = tierRow(tier).traits;
  return { tier, traits: n ? drawTraits(gearRoll(run, 'trait'), kind, n) : [] };
}
/* a pattern drop picks its kind first (ability 40, pane 30, blade 15, off-hand 15; 45:35:0:20 before Blade rack), then one of that kind.
   A kind with none left passes to the next in the order, never to a kind whose odds are 0. left: the patterns that may drop, each
   { id, kind }. -> the kind, or null when none is left */
export function patternKind(rs, r, left = null) {
  const odds = PATTERN_KIND_ODDS[(rs?.unlocks || []).includes('rack') ? 'rack' : 'base'];
  const order = PATTERN_KIND_ORDER.filter(k => odds[k] > 0);
  let x = r() * order.reduce((a, k) => a + odds[k], 0), i = 0;
  while (i < order.length - 1 && x >= odds[order[i]]) { x -= odds[order[i]]; i++; }
  if (!left) return order[i];
  for (let k = 0; k < order.length; k++) { const kind = order[(i + k) % order.length]; if (left.some(p => p?.kind === kind)) return kind; }
  return null;
}
// a gear drop's kind: ability 50, blade 25, off-hand 25 (65:0:35 before Blade rack)
export function gearKind(rs, r) {
  const odds = GEAR_KIND_ODDS[(rs?.unlocks || []).includes('rack') ? 'rack' : 'base'];
  const order = ['ability', 'blade', 'offhand'].filter(k => odds[k] > 0);
  let x = r() * order.reduce((a, k) => a + odds[k], 0);
  for (const k of order) { if (x < odds[k]) return k; x -= odds[k]; }
  return order[order.length - 1];
}

/* ---------------- the blades' strings ----------------
   Each blade plays today's cut poses (moves.js HITS) at its own speed. STRINGS lists the hit index of each cut in turn: 0 the first cut,
   1 the second, 2 the finisher, 4 the Twin knives' fourth cut (the first cut's pose); 3 stays the Rising cut. A row keeps the pose of
   the cut it plays, its times divided by the speed (Quick adds 8%), its reach (+0.6 m for the Hook blade, +0.3 m with Wide), and its
   damage times the blade's and the tier's power. The Lamp blade, plain with neither Quick nor Wide, keeps today's rows (null) */
export const STRINGS = { lamp: [0, 1, 2], hook: [0, 1, 2], twin: [0, 1, 2, 4], bell: [0, 1] };
const DEG = Math.PI / 180;
const rows = new Map();
const rowKey = (b, i) => `${b.id}|${tierOf(b)}|${hasTrait(b, 'quick')}|${hasTrait(b, 'wide')}#${i}`;
const atLeast1 = n => Math.max(1, Math.round(n));
export function bladeHit(blade, i, base) {
  if (!blade || !bladeOf(blade.id) || typeof base !== 'function') return null;
  const quick = hasTrait(blade, 'quick'), wide = hasTrait(blade, 'wide');
  if (blade.id === 'lamp' && tierOf(blade) === 'plain' && !quick && !wide) return null;
  const k = rowKey(blade, i);
  if (rows.has(k)) return rows.get(k);
  const B = bladeOf(blade.id), h = base(i === 4 ? 0 : i);
  if (!h) return null;
  const sp = B.speed * (quick ? 1 + traitOf('quick').speed : 1), pw = B.dmg * tierPower(blade);
  const row = {
    ...h, pose: h.pose || h.id, wind: atLeast1(h.wind / sp), act: atLeast1(h.act / sp), rec: atLeast1(h.rec / sp), dmg: h.dmg * pw,
    reach: h.reach + B.reach + (wide ? traitOf('wide').reach : 0), blade: B.id, at: i
  };
  // the Hook blade's finisher sweeps 180 degrees and pulls light foes 1 m in (gear-play.js pulls them)
  if (B.id === 'hook' && h.id === 'fin') { row.arc = (B.sweep / 2) * DEG; row.pull = B.pull; }
  // the Twin knives' fourth cut adds 1 Char (gear-play.js puts it on)
  if (B.id === 'twin' && i === 4) row.char = B.char;
  // the Bell maul wears poise twice as fast (gear-play.js wears the rest)
  if (B.poise) row.poise = B.poise;
  rows.set(k, row);
  return row;
}
// the hit after hit i of the held blade's string: null for the Lamp blade (moves.js keeps its own); after the Rising cut, the second
export function bladeNext(blade, i) {
  const str = STRINGS[blade?.id];
  if (!str || blade.id === 'lamp') return null;
  if (i === 3) return str[1];
  return str[(str.indexOf(i) + 1) % str.length];
}
/* a held Attack goes on as if pressed again (moves.js), except with the Bell maul (the hold is its slam) and on a blade lying underfoot
   (the hold takes it): -> true when a held Attack is not a press. st is the runner's stats() */
export const bladeHold = (st = {}) => !!(st.underfoot || (st.blade && bladeOf(st.blade.id)?.slam));
// the Bell maul's slam: its numbers with the tier's power and the hold in play steps, or null for any other blade
export const slamOf = blade => {
  const B = blade && bladeOf(blade.id);
  return B?.slam ? { ...B.slam, dmg: B.slam.dmg * tierPower(blade), steps: atLeast1(B.slam.hold * 60) } : null;
};
