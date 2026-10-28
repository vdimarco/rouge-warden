// First Breath: stage 8, Birth (`birth`), its numbers: the endless-runner escape of the action change
// (openspec/changes/first-breath-action-genres/design.md 5.8, 3.1, 4.2). Stage seconds throughout; the waves run from
// `base` (0, or the time of a jump("waves")). World units: the channel runs down (world −y, toward the light); the
// camera rides with you, so you keep your place on screen and the channel slides up past you. Pure data.
//
// The clock: 8 waves, one every 7.5 s from 2.0 s. Wave k (k = 0..7) warns at base + 2.0 + 7.5 k (a ring closes on
// you for 1.0 s), surges for 5.0 s, then rests for 1.5 s. The last rest ends at base + 62.0; then the light: exposure
// 1 → 6 over 2.0 s, white 0 → 1 over 1.0 s, a 0.5 s hold (base + 65.5). The cap is 80 s.
//
// Changes from design.md 5.8, recorded here (this file wins on the stage's numbers):
// - The camera: one world offset for every layout (a stage never knows the layout): you sit 32 u above the camera's
//   subject point, so about 30% down the screen in portrait (390 × 844) and 23% in landscape and on desktop (the
//   design's 25% and 30%). Landscape is short along the channel, so the higher seat gives it more of the way ahead.
// - Calm bubbles: 2 in each surge (between folds) and 1 in the rest after it (none after wave 8, so nothing frames
//   the light): 3 a wave, 23 in all. Each is 100 points and the bubble part stops at 1,500 (15 bubbles), so the
//   "+100" a bubble pops is the score it adds (the design's 1,500 × bubbles / offered would pop 65).
// - The tuck also comes from a quick drag down (a swipe down, as Subway Surfers rolls), from a single quick tap (the
//   "move" gesture's quick second tap and second finger still tuck), and on desktop from S, W and the up and down
//   arrows as well as Space, Enter and Z. The left and right arrows (A, D) move one lane a keydown (keys "lanes").
// - A drag past the stick's engage point takes the next lane that way at once (a flick is one lane), and a drag
//   held on slides on, taking each next lane 4 u past the last; let go and you settle on the lane you took.
// - The Tuck gate is a cream row of posts across the channel with a tight opening in each lane; the Lift gate is a
//   tight opening in the middle lane between two flaps; the Turn and Turn back gates are a dashed hoop in an outer
//   lane under the gold arrow, with a flap on the far outer lane, so the gate's lane is a choice. A tuck or lift gate
//   met untucked is a bump; a turn gate missed in the middle lane is only a miss.
// - The flow streak counts every clean pass (folds and gates hit); a bump or a gate missed ends it. Its Flourish is
//   1,000 × min(1, best streak / 20).
// - After the 8th surge you keep its speed through the last rest and into the light: the last wave carries you out.
// - The camera pulls back a little with the waves' planned speed (span 120 at rest, up to 134.4 in wave 8's surge,
//   your seat with it), so a fast surge shows more of the way ahead, most of all in landscape; a bump never pumps it.
// - Tight gaps telegraph as the game's closing ring: a dotted cream ring that closes in and brightens over the last
//   1.2 s of travel, with two cut chevrons pointing in at the slot, and a soft glow as you slip through tucked.
// - Tags (+100, +500, Flow, Nice tuck) and the feedback rings ride with you, beside you toward the channel's middle,
//   so they never fly up into the HUD. The HUD score counts live in this stage (main.js; there is still no overlay).
// - The 8th surge shakes and rings harder, and the light opens with a burst of paper flecks and a wide ring.
// - Each item ahead is laid in a chain at its planned distance from the one before it, and placed 240 u ahead of you
//   (past the screen's edge in every layout) when its planned time comes near. A bump makes you late for the items
//   already laid, and the chain keeps their spacing, so nothing ever comes closer together after a bump; the next
//   wave's first fold starts the chain again from you when you are less than about two bumps late.
//
// Bots (sim, 20 seeds; qa/first-breath/stage-birth.test.mjs and sim.test.mjs): every input takes 65.5 s. Measured
// (40 seeds, the stage alone): skill 1 about 9,800 (Glowing, 0 to 2 bumps), 0.7 about 7,700 (mostly Great, about 5
// bumps), 0.5 about 6,300 (mostly Good, about 8 bumps), idle about 4,100 (Good: the goal and the bubbles it rides
// into).
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
  laneMin: 0.6,          // an engaged stick moves you at least this share of laneV
  engage: 0.35,          // a stick past this (sideways, and more sideways than down) moves you; under it you settle
  passOn: 4,             // u past a lane before a held stick takes the next one as your lane
  settleK: 18,           // the settle eases in over its last 70 u/s ÷ 18 = 3.9 u
  settleMin: 12,         // ... and never slower than this, so it lands
  swipeDown: 0.6,        // a drag this far down (and more down than sideways) is a tuck
  swipeRearm: 0.3,       // ... and the next one needs the stick back above this first

  // you (drawn smaller than to scale: a newborn is about 50 cm long, the channel here about 35 cm across)
  bodyR: 5,              // bubbles and the drawing
  hitR: 3,               // folds and gates
  tuckR: 1.5,            // curled small
  figureU: 16,           // head to bottom, drawn
  tuckSize: 0.74,        // the figure curls to this share of its size while you tuck
  tuckS: 0.5,
  tuckLate: Object.freeze([0.44, 0.34]),   // the tuck is shorter in the late waves (5 to 8): a narrower window
  tuckCdS: 0.9,          // from the start of one tuck to the next
  tuckBufS: 0.15,        // a press this soon before the tuck is back is kept
  blinkS: 0.45,          // a bump blinks you this long (by brightness)
  graceS: 1.2,           // after Resume nothing bumps you for this long

  // speed
  restV: 22,
  surgeV: Object.freeze([50, 4]),   // wave 1 surges at 50 u/s, each wave 4 u/s more: 78 u/s in wave 8
  rampS: 0.6,            // rest ↔ surge
  bumpV: 22,
  bumpS: 0.6,
  recoverA: 90,          // u/s² back up to speed after a bump
  catchK: 0.5,           // in a rest, 0.5 u/s faster for each u the course is late (a bump makes it late) ...
  catchV: 30,            // ... up to 30 u/s more, so the folds stay with their surges

  // the folds: met during the surges, from 0.6 s in until 0.3 s before the end, one every 1.1 s (wave 1) down to
  // 0.7 s (wave 8), a little seeded jitter, never closer than 0.7 s; the late waves (5 to 8, from lateFrom) come
  // denser: one every 0.7 s (wave 5) down to 0.58 s (wave 8), never closer than 0.55 s
  foldEvery: Object.freeze([1.1, 0.7]),
  lateFrom: 4,
  foldEveryLate: Object.freeze([0.7, 0.58]),
  minGapLateS: 0.55,
  foldJitS: 0.08,
  foldLead: 0.6,
  foldTail: 0.3,
  minGapS: 0.7,
  aheadU: 240,           // an item is placed this far ahead of you (past the screen in every layout)
  behindU: 90,           // and dropped this far behind
  flapW: 7,              // a flap's thickness along the channel
  tip1: 9,               // a 1-lane flap ends 9 u from the middle of the channel (lane 0 or 2 blocked)
  tightFrom: 2,          // tight gaps from wave 3 (k = 2)
  tightOdds: 0.2,        // one fold in five
  tightOddsLate: 0.3,    // ... and one in three or so in the late waves
  tightW: 5,             // a tight gap's width: tucked (1.5 u) you pass within 1 u of its middle; untucked you bump
                         // (Assist widens it, but never to the untucked hitbox: 2.75 u a side at most)
  tightGapS: 1.4,
  gapNearS: 1.2,         // a tight gap's ring closes in and brightens over the last 1.2 s of travel to it        // tight gaps (and the tuck and lift gates) at least this far apart, so the tuck is back
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
  gateGapS: 0.8,         // no fold closer than this to a gate (the design's 1.0 s left wave 8 too bare)
  gatePts: 400,

  // calm bubbles
  bubbleR: 3,
  bubblesSurge: 2,
  bubbleRestS: 0.7,      // the rest's bubble meets you this long after the surge ends
  bubblePts: 100,

  // juice
  shakeBump: 0.35,
  shakeSurge: 0.3,
  shakeGate: 0.2,
  flowEvery: 5,          // a "Flow" tag at 5, 10, 15 ... clean passes in a row
  popS: 0.8,             // a tag rises 7 u over this long
  popRise: 5,
  popSide: 19,           // tags ride beside you, this far toward the channel's middle (clear of your body)
  burstS: 0.5,

  // Assist (design.md 5.8): surges 0.8× as fast, folds 1.4× further apart, gates and tight gaps 30% wider, a bump
  // slows you for 0.3 s, and the tuck lasts 0.12 s longer
  assist: Object.freeze({ surgeK: 0.8, foldK: 1.4, wideK: 1.3, bumpS: 0.3, tuckSlackS: 0.12 }),

  // the score (design.md 5.8, retuned so the grade follows the bumps): Goal 3,000; Skill: folds 3,500 less 400 a bump
  // (none left from 9 bumps), 400 a gate (1,600), bubbles 100 each up to 900; Flourish 1,000 × min(1, best flow /
  // 30). No bump is Glowing; about 4 to 7 bumps Great; 8 or more Good
  score: Object.freeze({ goal: 3000, folds: 3500, perBump: 400, gates: 1600, bubbles: 900, flourish: 1000, flowFull: 30 }),

  // the squeeze: the vignette and the channel's walls press in on each surge (none with reduced motion)
  vignetteRest: 0.15,
  vignettePeak: 0.35,
  wallPress: 2.5,        // u at a surge's peak
  warpRest: 0.1,
  warpPeak: 0.3,
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
  retractS: 0.3,         // folds still ahead when the light comes fold back into the walls this fast

  // the view (fit: world up is screen up)
  span: 120,
  camOff: 32,
  zoomK: 0.12,           // the camera pulls back up to 12% at the fastest surge (span 120 → 134.4; camOff with it)
  ringR: Object.freeze({ mother: 15, wave: Object.freeze([40, 22]) }),
  lean: 0.3,             // you lean into a lane move (radians at full sideways speed)
  turnRad: 0.35,         // the Turn gate tips you toward its side; Turn back brings you round
  moveS: 0.7,            // a gate's move plays over this long
  arrowAhead: 10,        // the gold arrow floats this far before its gate

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
  bot: Object.freeze({ lookS: 1.2, tuckLeadS: 0.15, lagS: 0.4, wrong: 0.3, tuckJitS: 0.12, near: 2, k: 9 }),
});
