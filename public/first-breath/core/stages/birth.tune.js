// First Breath: stage 8, Birth (`birth`), its numbers: the endless-runner escape of the action change
// (openspec/changes/first-breath-action-genres/design.md 5.8, 3.1, 4.2). Stage seconds throughout; the waves run from
// `base` (0, or the time of a jump("waves")). World units: the channel runs down (world −y, toward the light); you
// sit still on screen and the world slides up past you. Pure data.
//
// The clock: 8 waves, one every 7.5 s from 2.0 s. Wave k (k = 0..7) warns at base + 2.0 + 7.5 k (a ring closes on
// you for 1.0 s), surges for 5.0 s, then rests for 1.5 s. The last rest ends at base + 62.0; then the light: exposure
// 1 → 6 over 2.0 s, white 0 → 1 over 1.0 s, a 0.5 s hold (base + 65.5). The cap is 80 s.
//
// Changes from design.md 5.8, recorded here (this file wins on the stage's numbers):
// - The camera: one world offset for every layout (a stage never knows the layout): you sit 32 u above the camera's
//   subject point, so about 29% down the screen in portrait (390 × 844) and 23% in landscape and on desktop (the
//   design's 25% and 30%). Landscape is short along the channel, so the higher seat gives it more of the way ahead.
// - Calm bubbles: 2 in each surge (between folds) and 1 in the rest after it (none after wave 8, so nothing frames
//   the light): 3 a wave, 23 in all. Each is 100 points and the bubble part stops at 1,500 (15 bubbles), so the
//   "+100" a bubble pops is the score it adds (the design's 1,500 × bubbles / offered would pop 65).
// - The tuck also comes from a quick drag down (a swipe down, as Subway Surfers rolls), and on desktop from S or the
//   down arrow; the left and right arrows (A, D) move one lane a keydown (keys "lanes" in ui/input.js).
// - The Lift gate sits in the middle lane between two flaps (lanes 0 and 2 blocked), so the tuck through it is the
//   wave 6 test; the Turn and Turn back gates have a flap on the far outer lane, so the gate's lane is a choice.
// - After the 8th surge you keep its speed through the last rest and into the light: the last wave carries you out.
//
// Bots (sim, 20 seeds): see qa/first-breath/stage-birth.test.mjs and sim.test.mjs; the measured numbers are in the
// builder's report and design.md 3.1. Every input takes 65.5 s.
export const TUNE = Object.freeze({
  // the clock
  leadS: 2.0,            // the first warning
  waves: 8,
  periodS: 7.5,          // one wave every 7.5 s
  warnS: 1.0,            // the warning ring before each surge
  surgeS: 5.0,
  restS: 1.5,
  capS: 80,
  parS: 65.5,            // 2.0 + 8 × 7.5 + 3.5 for everyone
  motherBpm: [76, 92],   // her rate rises over the waves, then holds at 92 through the light
  youGa: 280,            // your heart from clock.bpmYou(280): 130 bpm

  // the channel: 60 u between the straight side flats, three lanes
  wallX: 30,
  lanes: Object.freeze([-18, 0, 18]),
  laneV: 70,             // sideways speed, u/s at full stick (and when you settle on a lane)
  engage: 0.35,          // a stick past this (screen x) moves you; under it you settle on your lane
  passOn: 4,             // u past a lane before a held stick takes the next one as your lane
  settleK: 14,           // the settle eases in over its last 70 u/s ÷ 14 = 5 u
  swipeDown: 0.6,        // a drag this far down (and more down than sideways) is a tuck

  // you
  bodyR: 5,              // pickups and the drawing
  hitR: 3,               // folds and gates
  tuckR: 1.5,            // curled small
  figureU: 14,           // head to bottom, drawn
  tuckS: 0.5,
  tuckCdS: 0.9,          // from the start of one tuck to the next
  tuckBufS: 0.15,        // a press this soon before the tuck is back is kept
  blinkS: 0.45,          // a bump blinks you this long (by brightness)

  // speed
  restV: 22,
  surgeV: Object.freeze([50, 4]),   // wave 1 surges at 50 u/s, each wave 4 u/s more: 78 u/s in wave 8
  rampS: 0.6,            // rest ↔ surge
  bumpV: 22,
  bumpS: 0.6,

  // the folds: met during the surges, from 0.6 s in until 0.3 s before the end, one every 1.1 s (wave 1) down to
  // 0.7 s (wave 8); each is placed ahead so it meets you then (core/stages/birth.js plan)
  foldEvery: Object.freeze([1.1, 0.7]),
  foldLead: 0.6,
  foldTail: 0.3,
  aheadU: 240,           // a fold, gate or bubble is placed this far ahead of you (past the screen in every layout)
  behindU: 110,          // and dropped this far behind
  flapW: 7,              // a flap's thickness along the channel
  tip1: 9,               // a 1-lane flap ends 9 u from the middle of the channel (lane 0 or 2 blocked)
  tightFrom: 2,          // tight gaps from wave 3 (k = 2)
  tightOdds: 0.2,        // one fold in five
  tightW: 5,             // a tight gap's width: tucked (1.5 u) you pass within 1 u of its middle; untucked you bump
  quickS: 0.95,          // folds closer than this in time leave a lane within one of the last fold's open lanes
  // the patterns' weights by wave: [1-lane flaps, 2-lane flaps, both sides (middle open)]
  weights: Object.freeze([
    Object.freeze([0.8, 0.1, 0.1]), Object.freeze([0.7, 0.15, 0.15]), Object.freeze([0.55, 0.25, 0.2]),
    Object.freeze([0.5, 0.3, 0.2]), Object.freeze([0.45, 0.3, 0.25]), Object.freeze([0.4, 0.35, 0.25]),
    Object.freeze([0.35, 0.35, 0.3]), Object.freeze([0.3, 0.4, 0.3]),
  ]),

  // the gates of the birth moves, one in each even wave, met 2.5 s into its surge
  gates: Object.freeze([
    Object.freeze({ wave: 1, kind: "tuck", text: "birth.gate.tuck", done: "birth.tucked" }),
    Object.freeze({ wave: 3, kind: "turn", text: "birth.gate.turn", done: "birth.turned" }),
    Object.freeze({ wave: 5, kind: "lift", text: "birth.gate.lift", done: "birth.lifted" }),
    Object.freeze({ wave: 7, kind: "back", text: "birth.gate.back", done: "birth.turnedBack" }),
  ]),
  gateAt: 2.5,
  gateHalf: 6,           // a turn gate takes you within 6 u of its lane's middle
  gateGapS: 1.0,         // no fold closer than this to a gate
  gatePts: 500,

  // calm bubbles
  bubbleR: 2.5,
  bubblesSurge: 2,
  bubbleRestS: 0.7,      // the rest's bubble meets you this long after the surge ends
  bubblePts: 100,

  // juice
  shakeBump: 0.35,
  flowEvery: 5,          // a "Flow" tag at 5, 10, 15 ... clean folds in a row

  // Assist (design.md 5.8): surges 0.8× as fast, folds 1.4× further apart, gates and tight gaps 30% wider, a bump
  // slows you for 0.3 s
  assist: Object.freeze({ surgeK: 0.8, foldK: 1.4, wideK: 1.3, bumpS: 0.3, tuckSlackS: 0.12 }),

  // the score (design.md 5.8, bubbles as above): Goal 3,000; Skill 2,500 × clean folds / folds, 2,000 × gates / 4,
  // bubbles 100 each up to 1,500; Flourish 1,000 × min(1, best flow / 20)
  score: Object.freeze({ goal: 3000, folds: 2500, gates: 2000, bubbles: 1500, flourish: 1000, flowFull: 20 }),

  // the squeeze: the vignette and the channel's walls press in on each surge (none with reduced motion)
  vignetteRest: 0.15,
  vignettePeak: 0.35,
  wallPress: 2.5,        // u at a surge's peak
  warpRest: 0.1,
  warpPeak: 0.35,
  filterHz: 300,
  rumbleHz: Object.freeze([40, 80]),

  // the light (v1)
  exposureS: 2.0,        // exposure 1 → 6
  whiteS: 1.0,           // then white 0 → 1
  holdS: 0.5,
  openS: 1.5,            // the sound opens 300 Hz → 16 kHz
  openHz: 16000,
  lightR: Object.freeze([30, 70, 220]),   // the bottom glow at the start, at the end of the waves, filling the screen
  lightOn0: 0.35,
  level: Object.freeze([0.35, 0.6]),

  // the view (fit: world up is screen up)
  span: 120,
  camOff: 32,
  ringR: Object.freeze({ mother: 15, you: 6, wave: Object.freeze([40, 22]) }),
  lean: 0.3,             // you lean into a lane move (radians at full sideways speed)
  turnRad: 0.35,         // the Turn gate tips you toward its side; Turn back brings you round
  moveS: 0.7,            // a gate's move plays over this long

  // captions: wave k's surge start + after, or its rest (the surge's end) + after, or a gate's crossing + after
  captions: Object.freeze([
    Object.freeze({ id: "birth.waves", wave: 0, after: 0.6 }),
    Object.freeze({ id: "birth.fast", rest: 0, after: 0 }),
    Object.freeze({ id: "birth.tuck", gate: 0, after: 0.2 }),
    Object.freeze({ id: "birth.turn", gate: 1, after: 0.2 }),
    Object.freeze({ id: "birth.skull", rest: 4, after: 0 }),
    Object.freeze({ id: "birth.overlap", rest: 6, after: 0 }),
  ]),

  // botSteer (design.md 5.8): the open lane of the next fold within 1.2 s, the gate's lane, a bubble when calm; a tuck
  // 0.15 s before a tight gap or a tuck gate. Below skill 1 it reacts 0.4 s × (1 − skill) late, takes a wrong lane
  // with chance 0.3 × (1 − skill) a fold, and its tuck wanders by 0.12 s × (1 − skill)
  bot: Object.freeze({ lookS: 1.2, tuckLeadS: 0.15, lagS: 0.4, wrong: 0.3, tuckJitS: 0.12, slowR: 6 }),
});
