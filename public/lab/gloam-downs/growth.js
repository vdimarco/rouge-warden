// Gloam Downs: the growth tables. The colours, the abilities, the panes, the patterns and the keys. Data only, no DOM, so the page,
// the Node tests and the bot read the same numbers. A change goes through the merge pass (gloam-downs-growth design.md).
import { BLADES, OFFHANDS } from './gear.js';
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
  { id: 'guard', name: 'Bell guard', colour: 'ward', cool: 9, cue: 'clang', cost: 130, text: 'turn the next blow aside', time: 0.8, back: 12 },
  // the ten of gloam-downs-hub design.md "New abilities"
  { id: 'lash', name: 'Wick lash', colour: 'flame', cool: 9, cue: 'lash', cost: 110, text: 'a burning line through foes', dmg: 14, range: 5, wide: 0.5, burn: 3 },
  { id: 'fan', name: 'Shard fan', colour: 'flame', cool: 8, cue: 'shards', cost: 120, text: 'a fan of shards that Char', n: 5, arc: 50, range: 6, dmg: 6, char: 1 },
  { id: 'slick', name: 'Oil slick', colour: 'flame', cool: 11, cue: 'slick', cost: 100, text: 'a pool that slows, and burns when lit', r: 3, life: 6, slow: 0.4, lit: 4, dmg: 5, every: 0.5 },
  { id: 'tacks', name: 'Tack scatter', colour: 'gloam', cool: 10, cue: 'tacks', cost: 90, text: 'a ring of tacks that Char', n: 8, r: 2.5, life: 8, dmg: 4, char: 1, slow: 0.3, hold: 1 },
  { id: 'toll', name: 'Bell toll', colour: 'ward', cool: 13, cue: 'toll', cost: 140, text: 'a ring that stuns light foes', r: 3.5, stun: 0.8, poise: 40 },
  { id: 'shell', name: 'Ember shell', colour: 'ward', cool: 15, cue: 'shell', cost: 130, text: 'a shell that bursts in fire', shell: 20, life: 6, dmg: 15, r: 2.5, burn: 2 },
  { id: 'post', name: 'Post lamp', colour: 'ward', cool: 20, cue: 'post', cost: 170, text: 'a lamp that heals; Use again to blink to it', life: 10, r: 3, heal: 0.015, safe: 0.15 },
  { id: 'shutter', name: 'Shutter', colour: 'gloam', cool: 14, cue: 'shutter', cost: 150, text: 'unseen for 2 s; the next hit is sure', time: 2, sure: 3 },
  { id: 'swarm', name: 'Moth swarm', colour: 'gloam', cool: 20, cue: 'wisp', cost: 180, text: 'moths that seek burning foes', n: 6, life: 10, range: 8, dmg: 3 },
  { id: 'blink', name: 'Gloam blink', colour: 'gloam', cool: 8, cue: 'blink', cost: 150, text: 'a blink through foes that Marks them', dist: 5, safe: 0.2 }
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
  { id: 'clear', name: 'Clear glass', colour: 'gloam', cost: 180, text: 'an ability use makes the next blade hit within 2 s deal 40% more' },
  // the six of gloam-downs-hub design.md "New buffs"
  { id: 'cinder', name: 'Cinder glass', colour: 'flame', cost: 140, text: 'below 30% health, +30% damage', below: 0.3, dmg: 0.3 },
  { id: 'spill', name: 'Spill glass', colour: 'flame', cost: 120, text: 'a foe put out bursts in fire', dmg: 8, r: 2, burn: 2, chain: 3 },
  { id: 'rush', name: 'Rush glass', colour: 'gloam', cost: 110, text: 'a foe put out gives 1.5 s of haste', time: 1.5, haste: 0.25 },
  { id: 'thirst', name: 'Thirst glass', colour: 'ward', cost: 150, text: 'below 50% health, blade hits heal', below: 0.5, heal: 0.15 },
  { id: 'shard', name: 'Shard glass', colour: 'gloam', cost: 130, text: 'a sure cut adds 2 Char', char: 2 },
  { id: 'cracked', name: 'Cracked glass', colour: 'flame', cost: 60, text: '+35% damage, until 3 hits taken in a place', dmg: 0.35, hits: 3 }
];
export const PANE_IDS = PANES.map(p => p.id);
export const PANE_SLOTS = { base: 1, max: 3 };
// every item a pattern can be the plan of, with its kind: the abilities, the panes, the blades and the off-hands (gear.js)
const PLANNED = [...ABILITIES.map(x => [x, 'ability']), ...PANES.map(x => [x, 'pane']), ...BLADES.map(x => [x, 'blade']), ...OFFHANDS.map(x => [x, 'offhand'])];
// the patterns: every one of those not kindled from the first run, with its kind and cost
export const PATTERNS = PLANNED.filter(([x]) => !x.start).map(([x, kind]) => ({ id: x.id, kind, cost: x.cost }));
export const PATTERN_IDS = PATTERNS.map(p => p.id);
export const PATTERN_KINDS = ['ability', 'pane', 'blade', 'offhand'];
// kindled from the first run: Lantern bomb, Smoke step, Thick glass, Hot glass, the Lamp blade and the Buckler
export const STARTERS = PLANNED.filter(([x]) => x.start).map(([x]) => x.id);
export const DROPS = { pattern: 0.02, patternElite: 0.35, patternPerKeen: 0.01, patternMax: 2, ability: 0.03, abilityPerKeen: 0.01, abilityMax: 3 };
// the keys: lasting, from a fixed elite's first fall
export const LAMP_KEYS = [
  { id: 'leap', name: 'Crow step', from: 'ramparts', text: 'jump again in the air', v: 7.4, after: 0.1 },
  { id: 'drop', name: 'Bell drop', from: 'bells', text: 'a plunge cracks a sealed stone', fall: 2 },
  { id: 'dash', name: 'Gloam dash', from: 'fen', colour: 'gloam', text: 'roll in the air to dash', dist: 3.5, safe: 0.15 }
];
export const LAMP_KEY_IDS = LAMP_KEYS.map(k => k.id);
export const PRIZES = ['glim', 'spark', 'pattern', 'ability', 'flask'];
