// First Breath: stage 4, The Placenta (`root`), its strings (first-breath-action-genres design.md 5.4; v1 15.4). Plain,
// short and tender; no banned words, no pronouns (the carer is always {carer} or {Carer}). core/text.js registers them
// through core/stages/index.js. Prompts name the live gesture (".keys" the desktop form, ".one" the one-button form).
export const TEXT = Object.freeze({
  // prompts
  "root.drift": "Drag to drift.",
  "root.drift.keys": "Drift with the arrow keys, or drag with the mouse.",
  "root.drift.one": "Hold to drift.",
  "root.move": "Drag to move. Tap to grapple.",
  "root.move.keys": "WASD to move. Space to grapple.",
  "root.move.one": "Hold to move. You grapple by yourself.",
  "root.listen": "Listen.",
  "root.shape": "Your body takes shape.",

  // sub-goals: shown, then done by you or by itself
  "root.goalSpot": "Find a soft spot to settle in.",
  "root.nestled": "You bury yourself in the lining.",
  "root.nestledAuto": "A soft spot draws you in. You bury yourself in the lining.",
  "root.goalPools": "Find 8 pools. Follow the ping.",
  "root.poolsDone": "Every pool is linked.",
  "root.poolsAuto": "The roots reach the rest anyway.",
  "root.rest": "You need a rest.",

  // captions
  "root.anyway": "The roots reach it anyway.",
  "root.anywayAll": "The roots reach them anyway.",
  "root.reach": "Your roots reach further.",
  "root.strong": "Your roots grow strong.",
  "root.yours": "This beat is yours.",
  "root.placenta": "This will become your placenta.",

  // number pops
  "root.plusRoot": "+1 root",

  // result parts
  "root.part.pools": "Pools you found",
  "root.part.hidden": "Hidden pools",
  "root.part.pips": "Pips at the heartbeat",
  "root.part.quick": "All 8 by 40 s",
});
