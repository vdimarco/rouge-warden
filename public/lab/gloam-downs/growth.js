// Gloam Downs: the growth tables. The colours, the abilities, the panes, the patterns and the keys. Data only, no DOM, so the page,
// the Node tests and the bot read the same numbers. A change goes through the merge pass (gloam-downs-growth design.md).
export const COLOURS = [
  { id: 'flame', name: 'Flame', text: 'damage', hue: '#ff9a4a' },
  { id: 'ward', name: 'Ward', text: 'health', hue: '#8fd6a0' },
  { id: 'gloam', name: 'Gloam', text: 'abilities', hue: '#a99cff' }
];
export const COLOUR_IDS = COLOURS.map(c => c.id);
// what one level of a colour gives: full up to level 5, half a level after that
export const SPARK = { full: 5, flame: { power: 0.1 }, ward: { hp: 10, power: 0.1 }, gloam: { power: 0.1, cool: 0.04, coolMin: 0.6 } };
export const levelGain = n => Math.min(n, SPARK.full) + Math.max(0, n - SPARK.full) * 0.5;
export const MOVE_COLOUR = { blade: 'flame', plunge: 'flame', relic: 'flame', roll: 'gloam', miss: 'gloam', flask: 'ward' };
export const BRIGHT = { base: 0.1, perKeen: 0.04, power: 1.25 };
// the abilities: cooldown s, cue, the numbers of what it does; start: kindled from the first run, else a pattern with its cost
export const ABILITIES = [
  { id: 'bomb', name: 'Lantern bomb', colour: 'flame', cool: 8, cue: 'coal', start: true, text: 'a thrown lantern bursts', dmg: 28, r: 2.5, range: 6, fuse: 0.6, burn: 6 },
  { id: 'step', name: 'Smoke step', colour: 'gloam', cool: 6, cue: 'roll', start: true, text: 'a quick safe step', dist: 4, time: 0.12, safe: 0.3 },
  { id: 'snare', name: 'Ember snare', colour: 'gloam', cool: 10, cue: 'cracks', cost: 80, text: 'a snare holds a foe', dmg: 10, r: 1.2, hold: 2, slow: 0.5 },
  { id: 'moth', name: 'Moth wisp', colour: 'gloam', cool: 18, cue: 'wisp', cost: 160, text: 'a wisp fights beside you', dmg: 5, every: 0.8, life: 12, range: 6 },
  { id: 'crook', name: 'Crook line', colour: 'flame', cool: 7, cue: 'charge', cost: 100, text: 'a line pulls a foe', dmg: 8, range: 7, to: 1.2 },
  { id: 'rime', name: 'Rime lamp', colour: 'ward', cool: 12, cue: 'shards', cost: 120, text: 'a cone slows foes', r: 4, arc: 70, slow: 0.5, hold: 3 },
  { id: 'flare', name: 'Flare', colour: 'ward', cool: 14, cue: 'light', cost: 140, text: 'a flash stuns foes', r: 4, stun: 1.2, grow: 0.25 },
  { id: 'pitch', name: 'Pitch pour', colour: 'flame', cool: 12, cue: 'pulse', cost: 110, text: 'a pool of burning pitch', r: 2, life: 4, dmg: 4, every: 0.5 },
  { id: 'guard', name: 'Bell guard', colour: 'ward', cool: 9, cue: 'clang', cost: 130, text: 'turn the next blow aside', time: 0.8, back: 12 }
];
export const ABILITY_IDS = ABILITIES.map(a => a.id);
// the panes: passive picks set in the Lamp-room
export const PANES = [
  { id: 'thick', name: 'Thick glass', colour: 'ward', start: true, text: 'a foe put out heals 3% of your health' },
  { id: 'hot', name: 'Hot glass', colour: 'flame', start: true, text: 'a foe put out within 3 s of an ability cools the other by 2 s' },
  { id: 'smoked', name: 'Smoked glass', colour: 'gloam', cost: 120, text: 'ability cooldowns 15% shorter' },
  { id: 'ember', name: 'Ember glass', colour: 'flame', cost: 90, text: '+20% damage to a burning foe' },
  { id: 'lead', name: 'Lead glass', colour: 'ward', cost: 110, text: 'the first hit in each fight deals half' },
  { id: 'storm', name: 'Storm glass', colour: 'gloam', cost: 150, text: 'a near miss cools both abilities by 1 s' },
  { id: 'tallow', name: 'Tallow glass', colour: 'ward', cost: 130, text: 'a flask heals 10% more and cools both abilities by 3 s' },
  { id: 'clear', name: 'Clear glass', colour: 'gloam', cost: 180, text: 'an ability use makes the next blade hit within 2 s deal 40% more' }
];
export const PANE_IDS = PANES.map(p => p.id);
export const PANE_SLOTS = { base: 1, max: 3 };
// the patterns: every ability and pane that is not kindled from the first run, with its cost
export const PATTERNS = [...ABILITIES, ...PANES].filter(x => !x.start).map(x => ({ id: x.id, kind: ABILITY_IDS.includes(x.id) ? 'ability' : 'pane', cost: x.cost }));
export const PATTERN_IDS = PATTERNS.map(p => p.id);
export const STARTERS = [...ABILITIES, ...PANES].filter(x => x.start).map(x => x.id);
export const DROPS = { pattern: 0.02, patternElite: 0.35, patternPerKeen: 0.01, patternMax: 2, ability: 0.03, abilityPerKeen: 0.01, abilityMax: 3 };
// the keys: lasting, from a fixed elite's first fall
export const LAMP_KEYS = [
  { id: 'leap', name: 'Crow step', from: 'ramparts', text: 'jump again in the air', v: 7.4, after: 0.1 },
  { id: 'drop', name: 'Bell drop', from: 'bells', text: 'a plunge cracks a sealed stone', fall: 2 }
];
export const LAMP_KEY_IDS = LAMP_KEYS.map(k => k.id);
export const PRIZES = ['glim', 'spark', 'pattern', 'ability', 'flask'];
