// First Breath: stage 3, The Embryo: first cells (`split`), its numbers (design.md 6.3). Times are in her beats (72 bpm,
// P = 0.833 s, no jitter: the whole stage is one target track) unless they say seconds. Sizes are in u (the short
// screen axis is 100 u; 0.45 mm across, so 1 u = 0.0045 mm and the shell is about 0.14 mm across).
export const TUNE = Object.freeze({
  bpm: 72,                 // her rate; the stage lays her beats from opts.motherPhase with no jitter
  leadS: 1.0,              // beat 1 is her first beat at or after this stage time
  days: 4,                 // Days 1 to 4: one split each
  beatsPerDay: 6,          // taps on beats 2, 4 and 6 of each day; the split plays on beat 6 by itself
  tapBeats: Object.freeze([2, 4, 6]),
  holdBeats: 6,            // bloom and hatch: 6 beats each, one release target on beat 6
  autoFromBeat: 2,         // the hollow fills (and the shell gives) by itself from this beat of the moment
  holdFillBeats: 3,        // holding fills the hollow (or pushes the shell) over this many beats
  minHoldBeats: 1,         // a release counts only after a hold of at least 1 beat (no mash)
  pinchBeats: 1,           // the split's pinch runs over the beat before beat 6
  furrowPerHit: 0.1,       // each landed tap deepens the furrow before the pinch
  outroS: 3,               // the drift toward the soft lining
  capS: 50,

  credit: Object.freeze({ in: 1, close: 0.5, heldOff: 0.25, none: 0 }),
  score: Object.freeze({ splits: 4000, release: 2000, perDay: 250 }),

  // the view
  span: 100,
  ballR: 13.2,             // the ball of cells keeps its size while the cells get smaller
  cellR: Object.freeze([12.4, 8.6, 6.3, 4.7, 3.5]),   // cell radius for 1, 2, 4, 8 and 16 cells
  shellR: 16,              // the clear shell (zona) ring
  shellW: 2.4,
  ringFrom: 32,            // the approach ring closes from here onto the membrane
  ringTo: 14,
  motherR: 38,             // her beat ring
  tubeW: 84,               // the tube, with cilia along both walls
  driftUS: 1.2,            // carried down the tube
  slipU: 22,               // you slip forward out of the shell on hatch beat 6
  slipS: 1.2,
  outroUS: 4,              // the drift speeds up in the outro
  motes: 40,               // fluid motes flowing past
});
