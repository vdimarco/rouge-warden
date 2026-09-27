// The fight's tables: the difficulty knobs, the crew, and every move. The arena (game.js) and the story
// (js/story/combat) both read them from here, so a tuning change reaches both.

// Difficulty. Every knob that sets how hard the fight is lives here.
export const TUNE = {
  bossDmg: 0.6,          // share of each hit's damage that lands on you
  bossHp: 800,
  postureGain: 1.35,     // how fast deflects and hits fill Gabe's posture bar
  rest: [1.2, 2.0],      // Gabe's pause between attacks, seconds
  restBear: [0.9, 1.6],
  atkSpeed: 0.9,         // Gabe's attack playback speed
  counterRate: 0.7,      // how often he slips a swing and counters
  parryWin: 0.3,         // seconds before a blow lands that a tap still deflects
  iframe: 0.46,          // the part of a roll that dodges everything
  gourds: 5, heal: 50,
  chargeSpeed: 9,
  blockCost: 0.6,        // share of a blow's ki cost when you block it
};
export const CREW = [
  { name: 'Tank Top', glyph: '力', perk: 'Hits 20% harder', apply: (s) => { s.dmg *= 1.2; } },
  { name: 'Fifty-One', glyph: '命', perk: '20% more life', apply: (s) => { s.maxHp = 120; } },
  { name: 'Shades', glyph: '影', perk: 'Wider parry window', apply: (s) => { s.parryWin = 0.38; } },
  { name: 'New Balance', glyph: '风', perk: 'Dodges cost less ki', apply: (s) => { s.dodgeCost *= 0.6; } },
  { name: 'Red Jersey', glyph: '速', perk: 'Moves 12% faster', apply: (s) => { s.speed *= 1.12; } },
];

// Times are in seconds of the source clip. A cut is a slice of a clip; hits, lunges, and
// cancels use the same clock, so they line up with the motion.
export const RONIN_CUTS = {
  l1: ['combo', 0.25, 1.12], l2: ['combo', 1.12, 1.9], l3: ['combo', 1.9, 3.0],
  hvy: ['heavy', 0.2, 2.05], db: ['thrust', 0.0, 1.9], guard: ['block', 1.0, 3.3], defl: ['parry', 0.2, 1.4],
  rollc: ['roll', 0.55, 1.87], down: ['knock', 0.0, 1.4], sip: ['drink', 2.8, 5.6],
};
export const PATK = {
  l1: { cut: 'l1', from: 0.25, speed: 1.65, hit: [0.64, 0.86], dmg: 20, post: 5, reach: 2.4, arc: 1.25, cost: 12, next: 'l2', cancel: 0.93, lunge: [0.5, 0.8, 3.2], snd: 'slash' },
  l2: { cut: 'l2', from: 1.12, speed: 1.65, hit: [1.42, 1.62], dmg: 22, post: 5, reach: 2.4, arc: 1.25, cost: 12, next: 'l3', cancel: 1.68, lunge: [1.3, 1.55, 3.2], snd: 'slash' },
  l3: { cut: 'l3', from: 1.9, speed: 1.55, hit: [2.16, 2.38], dmg: 30, post: 8, reach: 2.5, arc: 1.0, cost: 14, next: 'l1', cancel: 2.5, lunge: [2.0, 2.3, 4.2], snd: 'heavy' },
  heavy: { cut: 'hvy', from: 0.2, speed: 1.35, hit: [1.08, 1.3], dmg: 55, post: 16, reach: 2.7, arc: 1.0, cost: 26, cancel: 1.75, lunge: [0.85, 1.25, 5], snd: 'heavy' },
  deathblow: { cut: 'db', from: 0.0, speed: 1.0, hit: [0.68, 0.86], dmg: 0, post: 0, reach: 4.2, arc: 1.7, cost: 0, cancel: 1.7, lunge: [0.4, 0.78, 7], snd: 'heavy' },
};
// Gabe's clips; the cut ranges and hit times come from measuring each clip's strike peaks
export const GABE_CUTS = {
  jabs: ['punches', 0.2, 2.3], kick: ['kick', 0.9, 3.0], fly: ['flykick', 0.8, 4.2], counter: ['counter', 1.6, 5.9], grab: ['grab', 1.6, 4.7],
  call: ['taunt', 1.6, 3.7],
};
export const BEAR_CUTS = {
  sweep: ['sweep', 1.2, 4.9], chop: ['chop', 2.6, 6.2], smash: ['smash', 0.0, 1.87], slam: ['slam', 0.0, 2.9],
};
// Boss moves. hits: [t0, t1, shape]; shape is { reach, arc } or { aoe: [forward, radius] }.
export const GABE_ATK = {
  jabs: { cut: 'jabs', from: 0.2, speed: 1.22, tell: 0.35, track: 1.0, limb: 'LeftHand', limb2: 'RightHand', hits: [[0.58, 0.76, { reach: 2.3, arc: 0.7 }], [1.18, 1.38, { reach: 2.4, arc: 0.7 }]], dmg: 13, pp: 16, bc: 12, lunges: [[0.4, 0.7, 2.8], [1.0, 1.3, 2.8]], snd: 'punch' },
  kick: { cut: 'kick', from: 0.9, speed: 1.22, tell: 1.5, track: 1.9, limb: 'LeftFoot', hits: [[2.0, 2.3, { reach: 3.0, arc: 1.4 }]], dmg: 22, pp: 24, bc: 26, lunges: [[1.4, 2.1, 4]], snd: 'bossSwing' },
  fly: { cut: 'fly', from: 0.8, speed: 1.28, tell: 1.4, track: 1.6, limb: 'RightFoot', hits: [[2.8, 3.06, { reach: 2.6, arc: 0.9 }]], dmg: 24, pp: 26, bc: 26, leap: [1.5, 2.8], knock: true, snd: 'bossSwing' },
  counter: { cut: 'counter', from: 1.6, speed: 1.6, tell: 4.4, track: 4.9, limb: 'LeftHand', hits: [[5.0, 5.24, { reach: 2.6, arc: 0.8 }]], dmg: 20, pp: 24, bc: 20, dodge: [1.6, 3.4], lunges: [[4.7, 5.1, 4]], snd: 'punch' },
  // the bear call: he pulls a PVC pipe, puts it to his mouth, and roars down it. Unblockable: roll through it.
  call: { cut: 'call', from: 1.6, speed: 1.2, tell: 2.0, track: 2.3, limb: 'RightHand', unblock: true, pipe: [1.85, 3.4], blow: [2.3, 3.05], hits: [[2.38, 2.95, { reach: 8, arc: 0.42 }]], dmg: 16, snd: 'pipe' },
  grab: { cut: 'grab', from: 1.6, speed: 1.15, tell: 1.9, track: 2.6, limb: 'RightHand', unblock: true, hits: [[2.72, 3.05, { reach: 2.4, arc: 0.8 }]], throwAt: 3.55, dmg: 30, lunges: [[2.4, 2.95, 6]], snd: 'bossSwing' },
};
export const BEAR_ATK = {
  sweep: { cut: 'sweep', from: 1.2, speed: 1.0, tell: 1.8, track: 2.35, limb: 'RightHand', hits: [[2.45, 2.75, { reach: 4.6, arc: 1.6 }], [3.2, 3.5, { reach: 4.6, arc: 1.6 }]], dmg: 22, pp: 20, bc: 28, lunges: [[2.3, 2.75, 3.5], [3.05, 3.5, 3]], snd: 'bossSwing' },
  chop: { cut: 'chop', from: 2.6, speed: 1.0, tell: 3.6, track: 4.15, limb: 'RightHand', hits: [[4.3, 4.55, { reach: 4.8, arc: 0.55 }]], dmg: 32, pp: 32, bc: 40, lunges: [[4.1, 4.5, 5]], impact: 4.45, snd: 'bossSwing' },
  smash: { cut: 'smash', from: 0, speed: 1.0, tell: 0.9, track: 1.3, limb: 'LeftHand', hits: [[1.45, 1.66, { aoe: [2.7, 2.5] }]], dmg: 30, pp: 28, bc: 45, knock: true, impact: 1.57, snd: 'bossSwing' },
  slam: { cut: 'slam', from: 0, speed: 1.0, tell: 0.9, track: 1.3, limb: 'RightHand', hits: [[1.58, 1.8, { aoe: [1.4, 4.3] }]], dmg: 34, pp: 30, bc: 55, knock: true, impact: 1.67, snd: 'bossSwing' },
  charge: { charge: true, unblock: true, limb: 'Head', hits: [[0, 0, null]], dmg: 30, knock: true, windup: 0.9, run: 1.5 },
};
