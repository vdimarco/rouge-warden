// First Breath: stage 4, The Placenta (`root`), its strings (design.md 1.3, 6.4, 15.4). Plain, short and tender; no
// banned words, no pronouns (the carer is always {carer} or {Carer}). core/text.js registers them through
// core/stages/index.js. Prompts name the live gesture; sub-goal lines are shown, then confirmed (5.4).
export const TEXT = Object.freeze({
  // prompts (one live gesture per moment)
  "root.drift": "Drag to drift.",
  "root.grow": "Drag to grow roots.",
  "root.listen": "Listen.",
  "root.tapHeart": "Tap with your heartbeat.",
  "root.shape": "Your body takes shape.",

  // sub-goals: shown, then done by you or by itself
  "root.goalSpot": "Find a soft spot to settle in.",
  "root.nestled": "You bury yourself in the lining.",
  "root.nestledAuto": "A soft spot draws you in. You bury yourself in the lining.",
  "root.goalPools": "Reach the pools. Arrive as they swell.",
  "root.poolsDone": "Every pool is linked.",
  "root.poolsAuto": "The roots reach the rest anyway.",
  "root.yours": "This beat is yours. Tap with it.",
  "root.heartDone": "Both hearts beat together now.",
  "root.heartAuto": "Your heart keeps its own beat.",

  // captions
  "root.anyway": "The roots reach it anyway.",
  "root.placenta": "This will become your placenta.",

  // result parts
  "root.part.pools": "Pools you reached",
  "root.part.onBeat": "Pools on the beat",
  "root.part.heart": "Taps with your heart",
  "root.part.inTime": "Taps in time",
});
