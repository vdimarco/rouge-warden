// First Breath: stage 6, Second Trimester (`answer`), its numbers: the rhythm stage (openspec change
// first-breath-action-genres, design.md 5.6; the v1 judge and beats, archive design.md 4.1, 5.1, 5.2). Every length
// that rides her heart is counted in her beats at 78 bpm (one beat 0.769 s), laid with no jitter (v1 5.1: 0% while a
// target track runs). Positions and sizes are world units (u); the short screen axis is 100 u (v1 5.6). Pure data.
//
// Changes from design.md 5.6, recorded here as its header asks:
// - Touch kicks in the lane you tap (the orchestrator's brief: "tap the lane"), and a drag still slides one lane per
//   24 px from the touch-down point; one-lane parts (her heartbeat, the jump note) take a tap anywhere.
// - The lane check at the press and again up to 0.12 s after it applies to keys too, so two quick arrow presses
//   across two lanes count in the second lane.
// - The up and down arrows (and W, S) kick where you are, like Space, so one hand on the arrows plays everything.
// - Every note shows at the wall 4 of her beats before its time and rides its lane down to your ring, so a hummed
//   call note is the very note you answer 4 beats later (the call and the answer are one note, Rhythm Heaven's echo).
// - Measured lengths (stage-answer.test.mjs): 73.8 s for every input (plus under one beat of her phase); cap 90 s.
export const TUNE = Object.freeze({
  bpm: 78,                       // her rate in stage 6 (v1 5.1)
  layAheadS: 240,                // her beats are laid this far, so a late jump still lands on laid beats

  // the moments (design.md 5.6)
  hearS: 3.0,                    // `hear`: then `beat` starts on her first beat at or after 3.0 s
  beat: Object.freeze({ beats: 12, first: 1, every: 2, notes: 6 }),   // 6 kicks on beats 1, 3, ... 11 (P 1.54 s)
  phraseBeats: 9,                // each phrase: 4 beats of call, 4 of answer, 1 of gap
  callBeats: 4,
  // the lanes of each phrase, one slot a beat (L, M, R a lane, "." a rest): 16 notes
  patterns: Object.freeze(["M...", "L.R.", "LM.R", "R.LM", "LMR.", "RMLM"]),
  songBeats: 17,                 // the sing-along: the 16 call notes back to back, then the jump note
  eyesS: 4,                      // `eyes`: no input; the eyes open by themselves at its end (gaDay 182, week 26)
  outroS: 3,                     // `outro`: week 27
  liftS: 2,                      // the vignette lifts over 2 s once the eyes open
  travelBeats: 4,                // a note shows at the wall this many beats before its time (preview 3.08 s)

  // lanes (design.md 5.6, 4.2): the lane check at the press and again up to this long after it
  flickS: 0.12,
  slide: Object.freeze({ one: 0.33, two: 0.83 }),   // the stick's x for one and two lanes (about 24 and 48 px)

  // the match rule and the hand glow (v1 6.6)
  matchK: 0.75,                  // an answer with at least 75% of its notes Close or better is a match
  handFrom: 1,                   // phrase index (0-based) from which a match brings the hand glow: phrase 2, week 20
  handRiseS: 0.3, handHoldS: 0.6, handFadeS: 1.6,

  // the fever (design.md 5.6): this many In time notes in a row light it in the sing-along; a miss puts it out
  fever: Object.freeze({ need: 8, k: 1.5 }),

  // the score (design.md 5.6): Goal 3,000; Skill 1,000 x beat accuracy + 3,000 x answer accuracy + 2,000 x song
  // accuracy (the fever counts each note x1.5, capped at the part's max); Flourish 1,000 x min(1, best In time
  // streak / 24)
  score: Object.freeze({ goal: 3000, beat: 1000, answer: 3000, song: 2000, flourishMax: 1000, streak: 24 }),
  doneBeatK: 0.5,                // the heartbeat sub-goal is yours from this beat accuracy (else it settles by itself)
  doneMatches: 3,                // the answer sub-goal is yours from this many matched phrases

  // the voice: a seeded walk on a 5-note pentatonic set around F0 200 to 230 Hz (MIDI; G major pentatonic, E3 to D4)
  song: Object.freeze({ set: Object.freeze([52, 55, 57, 59, 62]), start: 2, steps: Object.freeze([-1, 0, 1, 1, -1]) }),
  humLeadS: 0.2,                 // each hummed note's sfx event goes out this long before its time, for scheduling

  // the bot (design.md 4.11): below skill 1 it picks a wrong lane for a note with chance wrongK x (1 - skill), and
  // turns to the next note's lane lagK x (1 - skill) s after that note becomes the next one
  bot: Object.freeze({ wrongK: 0.25, lagK: 0.6 }),

  // the picture (design.md 5.6, 4.8): world units, span 100 across the short axis, world up is screen up (fit)
  view: Object.freeze({
    span: 100, camY: 6,
    // the lanes: a fan from the warm patch on the wall (y0) down to your ring (y1, the hit line), lane centres
    // gap0 and gap1 apart, lane widths w0 and w1; notes ride on past the line to u = tail, fading
    lanes: Object.freeze({ y0: 36, y1: -10, gap0: 8, gap1: 20, w0: 5.5, w1: 12, tail: 1.25, r0: 2.2, r1: 4.6 }),
    // you ride the line in your ring: the figure sits in your lane's ring and hops lane to lane (NecroDancer)
    baby: Object.freeze({ dy: -0.5, size0: 18, size1: 22 }),
    ringR: 9.5,                  // your ring (her heartbeat's ring) round you, on your lane at the hit line
    voice: Object.freeze({ x: 0, y: 40, r: 9 }),         // the warm patch the voice comes through
    hand: Object.freeze({ x: 25, y: 30, r: 8 }),         // the hand glow on the wall
    disc: Object.freeze({ y: 50, r: 14, spread: 12 }),   // the placenta disc on the wall, at nestleX x spread
    cordBend: Object.freeze({ x: 58, y: -6 }),           // the cord bows round the lanes (behind them) to your belly
    slideS: 0.08,                // your ring slides to a new lane this fast
    kickS: 0.24,                 // a kick's pose
    startleS: 0.7,               // the jump note's startle
    rippleS: 1.0,                // a hummed note's gold ripple at the wall lasts this long
    hitS: 0.45,                  // a kicked note's ripple at your ring
    fbS: 0.35,                   // the judge feedback ring shows this long
    popS: 0.8, popRise: 3,       // a word pop shows under your ring and rises 3 u over 0.8 s
    burstS: 0.5,
    feverRiseS: 0.4,             // the fever look eases in and out (one swell, never a flash)
    level0: 0.62, level1: 0.74, levelFever: 0.05, warm: 0.8, tint: 0.04, tintFever: 0.04,
    vignette0: 0.5, vignette1: 0.2,
    caustics: 0.25, causticsFever: 0.2,   // the dapple sheet at 25% (v1 14.1), brighter in the fever
    warp: 0.15,
  }),
});
