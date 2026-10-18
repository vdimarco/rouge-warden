// First Breath: stage 8, Birth (`birth`), its numbers (design.md 6.8, 3.1, 4.1). Stage seconds throughout; the
// waves run from `base` (0, or the time of a jump("waves")). Pure data.
//
// The timeline: 8 waves, one every 8.0 s. Wave k (k = 0..7) warns at base + 2.0 + 8 k (a ring 1.0 s before its
// swell), swells for 5.0 s from base + 3.0 + 8 k, and rests for 3.0 s after; the next warning falls in the last
// second of that rest. After the 8th rest (base + 67.0) comes the light: exposure 1 → 6 over 2.0 s, white 0 → 1 over
// 1.0 s, a 0.5 s hold (base + 70.5). Every wave moves you 1/8 of the way by itself.
export const TUNE = Object.freeze({
  // the clock
  leadS: 2.0,            // the first warning
  waves: 8,
  periodS: 8.0,          // one wave every 8.0 s
  warnS: 1.0,            // the warning ring comes this long before the swell
  swellS: 5.0,
  restS: 3.0,
  capS: 80,
  parS: 70,              // 2 + 64 + 3.5 ≈ 70 s for everyone (6.8); 70.5 s as laid here
  motherBpm: [76, 92],   // her rate rises over the waves, then holds at 92 through the light (5.1)
  youGa: 280,            // your heart from clock.bpmYou(280): 130 bpm

  // the waves: 1, 3, 5, 7 plain (live hold); 2, 4, 6, 8 prompt waves (live dragHold, screen axes)
  // want: the direction that counts as the move; "side" is left or right; "back" is the other way from wave 4
  plan: Object.freeze([
    Object.freeze({ n: 1, move: null, gesture: "hold", want: null, text: "birth.hold" }),
    Object.freeze({ n: 2, move: "tuck", gesture: "dragHold", want: "down", text: "birth.tuck.do" }),
    Object.freeze({ n: 3, move: null, gesture: "hold", want: null, text: "birth.hold" }),
    Object.freeze({ n: 4, move: "turn", gesture: "dragHold", want: "side", text: "birth.turn.do" }),
    Object.freeze({ n: 5, move: null, gesture: "hold", want: null, text: "birth.hold" }),
    Object.freeze({ n: 6, move: "lift", gesture: "dragHold", want: "up", text: "birth.lift.do" }),
    Object.freeze({ n: 7, move: null, gesture: "hold", want: null, text: "birth.hold" }),
    Object.freeze({ n: 8, move: "back", gesture: "dragHold", want: "back", text: "birth.back.do" }),
  ]),

  // judging a wave (6.8): overlap = the share of the 5.0 s swell held (in the right direction for a move)
  doneAt: 0.4,           // a wave's sub-goal is done by you at this overlap (the move's 300-point level), else auto
  moveFull: 0.7,         // a move's right-direction overlap for 600 points
  moveHalf: 0.4,         // ... for 300 points
  movePts: [600, 300],
  smoothAt: 0.9,         // Flourish: 1,000 × waves held at least this much / 8
  overlapPts: 3000,      // Skill: 3,000 × mean overlap over 8 waves (any hold counts)
  restPts: 600,          // Skill: 600 × rested gaps / 8
  flourishPts: 1000,
  // A rested gap: released for ≥ 80% of the rest, judged over the rest's first 2.0 s (before the next warning, so a
  // hold from the warning still rests), and only after a wave you held (an idle stage earns no rests).
  restJudgeS: 2.0,
  restOk: 0.8,
  // a hold already down when a swell starts, pressed at or after its warning, is on time for its press target
  earlySlackS: 0.05,

  // the squeeze (6.8): vignette to 35% at a swell's peak; the renderer presses its side flats by it (6% per swell,
  // none in reduced motion); the sound's womb filter at 300 Hz with a 40 to 80 Hz rumble
  vignetteRest: 0.15,
  vignettePeak: 0.35,
  wallPress: 0.06,
  warpRest: 0.15,
  warpPeak: 0.65,
  filterHz: 300,
  rumbleHz: Object.freeze([40, 80]),

  // the light (6.8)
  exposureS: 2.0,        // exposure 1 → 6
  whiteS: 1.0,           // then white 0 → 1
  holdS: 0.5,
  openS: 1.5,            // the sound opens 300 Hz → 16 kHz
  openHz: 16000,

  // the view (fit: world up is screen up; 100 u across the short axis = 700 mm)
  span: 100,
  figureU: 44,           // head to bottom, about 31 cm at 7 mm per u
  figureY0: 4,           // you sink from here...
  figureY1: -12,         // ... to here over the 8 waves (the anchor stays above 60% of the height in portrait)
  squeezeFig: 0.05,      // the figure gives 5% at a swell's peak
  turnRad: 0.35,         // the Turn wave tips you this far toward your side; Turn back returns you
  lightY: -50,           // the opening's glow, along the whole bottom edge
  lightR: Object.freeze([36, 96, 220]),   // its size at the start, after wave 8, and filling the screen in the light
  lightOn0: 0.35,
  level: Object.freeze([0.35, 0.6]),       // the back sheet lit, start → after wave 8 (1 in the light)
  ringR: Object.freeze({ mother: 30, you: 6, wave: [50, 34], hold: 38, rest: 34, prompt: 7 }),
  arrowU: 26,            // the direction sticker sits this far from your centre

  // captions (seconds after base, or after a wave's swell start)
  captions: Object.freeze([
    Object.freeze({ id: "birth.fast", at: 0.6 }),
    Object.freeze({ id: "birth.waves", wave: 0, after: 1.0 }),
    Object.freeze({ id: "birth.tuck", wave: 1, after: 0.5 }),
    Object.freeze({ id: "birth.turn", wave: 3, after: 0.5 }),
    Object.freeze({ id: "birth.skull", wave: 4, after: 0.5 }),
    Object.freeze({ id: "birth.overlap", wave: 6, after: 0.5 }),
  ]),

  // botSteer: hold from the warning, drag the prompted way, let go in the rest; a lower skill lags and sometimes
  // drags the wrong way (each draw kept in r.mem)
  bot: Object.freeze({ lagInS: 2.0, lagOutS: 1.0, wrong: 0.5 }),
});
