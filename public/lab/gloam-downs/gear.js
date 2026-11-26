// Gloam Downs: the gear tables. The blades, the off-hands, the quality tiers, the drop tables by place depth, the traits, and the
// odds of a gear drop's kind and a pattern drop's kind. Data only, with no imports, so growth.js, the page, the Node tests and the bot
// read the same numbers. The rolls and the rules come later in this file (gloam-downs-hub design.md "Part C").

// the slots of the gear, in the HUD's order
export const GEAR_SLOTS = ['blade', 'offhand', 'ability', 'ability'];
// the blades: one held. start: there from the first run, else a pattern with its cost. bone: the blade bone's length (and width)
export const BLADES = [
  { id: 'lamp', name: 'Lamp blade', colour: 'flame', start: true, text: '2 cuts and a finisher', cuts: 3, speed: 1, reach: 0, dmg: 1, bone: 1 },
  { id: 'hook', name: 'Hook blade', colour: 'flame', cost: 160, text: 'a long reach; the finisher sweeps and pulls', cuts: 3, speed: 0.85, reach: 0.6, dmg: 1.1, bone: 1.4, sweep: 180, pull: 1 },
  { id: 'twin', name: 'Twin knives', colour: 'gloam', cost: 160, text: '4 quick cuts; the 4th adds 1 Char', cuts: 4, speed: 1.25, reach: 0, dmg: 0.65, bone: 0.7, char: 1 },
  { id: 'bell', name: 'Bell maul', colour: 'ward', cost: 200, text: 'slow, heavy cuts; hold Attack to slam', cuts: 2, speed: 0.7, reach: 0, dmg: 1.6, bone: 1.2, width: 1.5, poise: 2, slam: { dmg: 30, r: 2.5, hold: 0.5 } }
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
  { id: 'char', name: 'Charring', fits: ALL, text: 'each 3rd hit adds 1 Char', every: 3, char: 1 },
  { id: 'quick', name: 'Quick', fits: ALL, text: 'a faster string, or a shorter cooldown', speed: 0.08, cool: 0.1 },
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
