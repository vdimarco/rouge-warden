// Gloam Downs: the Lamp-room as a place you walk through (gloam-downs-hub design.md "Part H"). The plan of the hall and its stations,
// the station in reach and its prompt, what each station's card holds, the growth objects the save shows, and the ability post. No
// DOM, so the bake (games/gloam-downs/biomes/lamproom.mjs), the Node tests and the page read the same plan and the same rules.
import { ABILITIES, PANES, LAMP_KEYS, PATTERNS, STARTERS, COLOURS } from './growth.js';
import { BLADES, OFFHANDS, TIERS, GEAR_GLYPHS, COLOUR_SHAPES, chooseBlade, chooseOffhand, kindledGear, startGear } from './gear.js';
import { UPGRADES, UNLOCKS, EMBER_TOP, paneSlots, kindledOf } from './run.js';
import { ELITE_LIST } from './elites.js';

export const HUB = 'lamproom';
export const HUB_NAME = 'The Lamp-room';
/* the rules of a station: a prompt within USE m of its point while the lamplighter faces its object within FACE degrees; its card
   shuts when the lamplighter walks SHUT m off or holds a move AWAY s; a click on a station within CLICK m opens it */
export const USE = { r: 1.6, face: 70, shut: 2.5, away: 0.3, click: 3, quarter: 4 };
/* The plan (design.md "Decision 4"). at: the point the lamplighter stands on; obj: where the object stands (the prompt faces it).
   The hall is 14 m wide (x -7 to 7); its back wall's inner face is at z = -7.6, so the trophy wall, the bell and the door stand at the
   back with room to stand in front of them. The front (z = 7) is open */
export const HALL = { x0: -7, x1: 7, back: -7.6, front: 7, spawn: [0, 5], yaw: Math.PI, door: [0, -7] };
const W = -Math.PI / 2, E = Math.PI / 2, N = Math.PI;
export const STATIONS = [
  { id: 'well', name: 'The well', cat: 'bank', at: [-2.5, 2.5], face: W, obj: [-3.7, 2.5] },
  { id: 'wick', name: 'The wick rack', cat: 'unlock', at: [-5.5, 4.5], face: W, obj: [-6.6, 4.5] },
  { id: 'blades', name: 'The blade rack', cat: 'blade', at: [5.5, 4.5], face: E, obj: [6.6, 4.5] },
  { id: 'offhand', name: 'The off-hand stand', cat: 'offhand', at: [-5.5, 1], face: W, obj: [-6.6, 1] },
  { id: 'post', name: 'The ability post', cat: 'ability', at: [2.5, 1.5], face: E, obj: [3.9, 1.5] },
  { id: 'shelf', name: 'The lamp shelf', cat: 'ware', at: [-5.5, -2.5], face: W, obj: [-7, -2.5] },
  { id: 'window', name: 'The pane window', cat: 'pane', at: [5.5, -0.5], face: E, obj: [7, -0.5] },
  { id: 'kiln', name: 'The kiln', cat: 'pattern', at: [5.5, -4], face: E, obj: [6.6, -4] },
  { id: 'trophy', name: 'The trophy wall', cat: 'key', at: [-3.5, -6.7], face: N, obj: [-3.5, -7.6] },
  { id: 'bell', name: 'The Ember bell', cat: 'ember', at: [3.2, -6.6], face: N, obj: [3.2, -7.3] },
  { id: 'map', name: 'The map table', cat: 'map', at: [0, -3.6], face: E, obj: [1.3, -3.6] },
  { id: 'door', name: 'The run door', cat: 'door', at: [0, -7], face: N, obj: [0, -7.6] }
];
export const STATION_IDS = STATIONS.map(s => s.id);
export const stationOf = id => STATIONS.find(s => s.id === id) || null;
// the beacon shrine: the same cards, as three tabs, beside a lit beacon
export const SHRINE_TABS = [{ id: 'shelf', label: 'Wares' }, { id: 'kiln', label: 'Patterns' }, { id: 'window', label: 'Panes' }];
// the quick list's headings, in order, and the station whose rows sit under each (design.md "The cards by category")
export const QUICK = [
  { id: 'blades', label: 'Blades' }, { id: 'offhand', label: 'Off-hands' }, { id: 'post', label: 'Abilities' }, { id: 'window', label: 'Panes' },
  { id: 'kiln', label: 'Patterns' }, { id: 'shelf', label: 'Wares' }, { id: 'wick', label: 'Unlocks' }, { id: 'trophy', label: 'Keys' }, { id: 'bell', label: 'Ember' }
];
// the category words every row starts with (design.md "The cards by category")
export const CATEGORY = { blade: 'Blade', offhand: 'Off-hand', ability: 'Ability', pane: 'Pane', wick: 'Wick', relic: 'Relic', spark: 'Spark', ware: 'Ware', unlock: 'Unlock', key: 'Key', pattern: 'Pattern' };

// the distance from a point to the spawn-to-door path (x = 0, z from the door to the spawn)
export function toPath([x, z]) {
  const [sx, sz] = HALL.spawn, [dx, dz] = HALL.door, vx = dx - sx, vz = dz - sz, l2 = vx * vx + vz * vz;
  const u = Math.max(0, Math.min(1, ((x - sx) * vx + (z - sz) * vz) / l2));
  return Math.hypot(x - sx - vx * u, z - sz - vz * u);
}
const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
/* the station in reach from s ({ x, z, yaw }): within USE.r of its point and facing its object within USE.face degrees; the nearest
   when two are (they never are: design.md keeps any two points 3.2 m apart). list: the stations with the baked points (meta.stations) */
export function stationNear(s, list = STATIONS, o = USE) {
  let best = null, bd = Infinity;
  for (const st of list) {
    const d = Math.hypot(s.x - st.at[0], s.z - st.at[1]);
    if (d > o.r) continue;
    const want = Math.atan2(st.obj[0] - s.x, st.obj[1] - s.z);
    if (Math.abs(angle(want - s.yaw)) > (o.face * Math.PI) / 180) continue;
    if (d < bd) { bd = d; best = st; }
  }
  return best;
}
// the prompt's text by the input in use: "E Use" on keys, "A Use" on a pad, "Use" on touch (the Use button)
export const USE_KEYS = { keys: 'E', pad: 'A', touch: '', drag: 'E' };
export const promptOf = (st, kind = 'keys') => (st ? { name: st.name, key: USE_KEYS[kind] ?? 'E', text: `${USE_KEYS[kind] ? `${USE_KEYS[kind]} ` : ''}Use` } : null);

/* ---------------- the start picks (gear.js) ----------------
   The blade rack and the off-hand stand pick with gear.js chooseBlade and chooseOffhand; the start blade and off-hand are what
   gear.js startGear gives a run. They live in the lasting save as rs.blade and rs.offhand (run-save.js v4 keeps them) */
export { chooseBlade, chooseOffhand };
export const kindledBlades = rs => kindledGear(rs, 'blade');
export const kindledOffhands = rs => kindledGear(rs, 'offhand');
export const startBlade = rs => startGear(rs).blade.id;
// a new save has the Buckler; null is none
export const startOffhand = rs => startGear(rs).offhand?.id ?? null;
const itemOf = (kind, id) => (kind === 'blade' ? BLADES : kind === 'offhand' ? OFFHANDS : kind === 'ability' ? ABILITIES : kind === 'pane' ? PANES : []).find(x => x.id === id) || null;
/* the glyph, the colour edge and the tier mark of an item, as data: { kind, id, word, glyph, colour, hue, shape, pips, tier }. The page
   draws it with hud-gear.js gearMark (cards.js markHtml), the same mark as the HUD's gear row */
export function gearMark(item = {}) {
  const kind = item.kind || 'ability', x = itemOf(kind, item.id), colour = item.colour || x?.colour || null;
  const tier = TIERS.find(t => t.id === item.tier) || (item.bright ? TIERS[1] : null);
  return {
    kind, id: item.id ?? null, word: CATEGORY[kind] || kind, glyph: GEAR_GLYPHS[kind] || (kind === 'ware' ? 'lamp' : kind === 'unlock' ? 'wick' : kind === 'key' ? 'key' : 'square'),
    colour, hue: COLOURS.find(c => c.id === colour)?.hue || null, shape: colour ? COLOUR_SHAPES[colour] : null, pips: tier ? tier.pips : 0, tier: tier?.id || null
  };
}

/* ---------------- the growth objects (design.md "Decision 5") ----------------
   Each is one contiguous range of baked splats, meta.grow: [{ id, first, n }]. The ids name what shows it:
     ware:<id>:<k>     the k-th glass ring of a ware on the lamp shelf, lit at level k or more
     pattern:<id>:found  an unlit lamp on the kiln's ledge: a pattern found, not kindled
     pattern:<id>:lit    a lit lamp on the kiln's hood: kindled
     pane:<id>:<slot>  a pane's coloured glass in a slot of the window: set there (and the slot open)
     shutter:<slot>    a slot's shutter: the slot not bought
     unlock:<id>       a lit wick on the wick rack
     blade:<id>, offhand:<id>   the item on its hook or peg: kindled;  blade:<id>:start, offhand:<id>:start  its glow: the start pick
     key:<id>          a key's trophy;  elite:<id>  an elite's plaque: put out once (rs.eliteFalls, from the gear builder's save)
     ember:<n>         a ring of light round the bell: level n open */
export function growIds() {
  const out = [];
  for (const u of UPGRADES) for (let k = 1; k <= u.costs.length; k++) out.push(`ware:${u.id}:${k}`);
  for (const p of PATTERNS) out.push(`pattern:${p.id}:found`, `pattern:${p.id}:lit`);
  for (const p of PANES) for (let s = 0; s < 3; s++) out.push(`pane:${p.id}:${s}`);
  for (let s = 0; s < 3; s++) out.push(`shutter:${s}`);
  for (const u of UNLOCKS) out.push(`unlock:${u.id}`);
  for (const b of BLADES) out.push(`blade:${b.id}`, `blade:${b.id}:start`);
  for (const o of OFFHANDS) out.push(`offhand:${o.id}`, `offhand:${o.id}:start`);
  for (const k of LAMP_KEYS) out.push(`key:${k.id}`);
  for (const e of ELITE_LIST) out.push(`elite:${e.id}`);
  for (let n = 0; n <= EMBER_TOP; n++) out.push(`ember:${n}`);
  return out;
}
// whether the save shows growth object id
export function shown(rs, id) {
  const [kind, a, b] = id.split(':');
  const kindled = new Set([...STARTERS, ...(rs?.kindled || [])]);
  switch (kind) {
    case 'ware': return ((rs?.up?.[a]) | 0) >= Number(b);
    case 'pattern': return b === 'lit' ? kindled.has(a) : (rs?.patterns || []).includes(a) && !kindled.has(a);
    case 'pane': { const s = Number(b); return s < paneSlots(rs) && (rs?.panes || [])[s] === a; }
    case 'shutter': return Number(a) >= paneSlots(rs);
    case 'unlock': return (rs?.unlocks || []).includes(a);
    case 'blade': return b === 'start' ? startBlade(rs) === a : kindledBlades(rs).includes(a);
    case 'offhand': return b === 'start' ? startOffhand(rs) === a : kindledOffhands(rs).includes(a);
    case 'key': return (rs?.keys || []).includes(a);
    case 'elite': return (rs?.eliteFalls || []).includes(a);
    case 'ember': return ((rs?.emberTop) | 0) >= Number(a);
    default: return false;
  }
}
// the plan for the page: each range with whether it shows now -> [{ id, first, n, on }]
export const growPlan = (rs, grow = []) => grow.map(g => ({ ...g, on: shown(rs, g.id) }));
// the ranges that change between two saves' plans (a buy lights one; nothing else moves)
export function growChanges(rs, grow, was) {
  const out = [];
  for (const g of grow) { const on = shown(rs, g.id); if (was.get(g.id) !== on) out.push({ ...g, on }); }
  return out;
}

/* ---------------- the ability post ----------------
   Any two kindled abilities go in the post's two slots, to try in the hall only. Their cooldowns run at a quarter (USE.quarter steps a
   step), and nothing spent there costs anything. The practice run is never stored */
export const postAbilities = rs => kindledOf(rs, 'ability');
export function practiceRun(rs, tried = []) {
  const ok = postAbilities(rs), pick = tried.filter(id => ok.includes(id)).slice(0, 2);
  while (pick.length < 2) { const next = ok.find(id => !pick.includes(id)); if (!next) break; pick.push(next); }
  return {
    seed: 1, place: HUB, time: 0, hp: 999, flasks: 0, carried: 0, banked: 0, foes: 0, wicks: [], offer: null, bossDown: false, entry: null, route: [], ember: 0,
    relics: [], elitesDown: [], combo: 0, lastUsed: false, shelf: false, sparks: { flame: 0, ward: 0, gloam: 0 }, sparkPicks: 0, sparkNow: false,
    abilities: [0, 1].map(i => (pick[i] ? { id: pick[i], bright: false } : null)), abilityOffer: null, carriedPatterns: [], groundPatterns: [], caches: [],
    abilityLamps: [], patternRolls: 0, abilityRolls: 0, foePatterns: 0, abilityDrops: 0, patternsKept: 0, kept: [], splits: [], lastHurt: null, practice: true
  };
}
/* the cooldowns in the hall, in steps: a slot whose cooldown has just started (more steps left than last step) starts at a quarter of
   it, so the HUD counts the quarter down; one already running goes on as it is. cool: the steps left now; was: the steps left a step ago */
export const quarterCool = (cool = [], was = []) => cool.map((c, i) => (c > (was[i] ?? 0) ? Math.ceil(c / USE.quarter) : c));
// what the post's card shows: a row a kindled ability, by colour, with whether it is in a post slot
export function postRows(rs, tried = []) {
  const order = COLOURS.map(c => c.id);
  return postAbilities(rs).map(id => ABILITIES.find(a => a.id === id)).sort((a, b) => order.indexOf(a.colour) - order.indexOf(b.colour))
    .map(a => ({ id: a.id, name: a.name, text: a.text, colour: a.colour, slot: tried.indexOf(a.id), mark: gearMark({ kind: 'ability', id: a.id }) }));
}
// a press of an ability row: in slot 1 or 2 takes it out, else it fills the first empty slot, else it takes slot 2's place
export function tryAbility(tried, id) {
  const t = tried.slice(0, 2);
  const at = t.indexOf(id);
  if (at >= 0) { t.splice(at, 1); return t; }
  if (t.length < 2) return [...t, id];
  return [t[0], id];
}
