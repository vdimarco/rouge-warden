// First Breath: stage 6, Second Trimester (`answer`), its numbers (design.md 6.6, 4.1, 5.2, 7). Every length that
// rides her heart is counted in her beats at 78 bpm (one beat 0.769 s), laid with no jitter (5.1: 0% while a target
// track runs). Positions and sizes are world units (u); the short screen axis is 100 u (5.6). Pure data.
export const TUNE = Object.freeze({
  bpm: 78,                       // her rate in stage 6 (5.1)
  layAheadS: 240,                // her beats are laid this far, so a late jump still lands on laid beats

  // the moments (4.1, 6.6)
  hearS: 3.0,                    // `hear`: then `beat` starts on her first beat at or after 3.0 s
  beatBeats: 10,                 // `beat` lasts 10 of her beats (7.7 s) ...
  beatFirst: 2,                  // ... with its 8 targets on beats 2 to 9: a two-beat count-in after the prompt
  beatTargets: 8,
  phraseBeats: 10,               // each phrase: 4 beats of call, 4 of answer, 2 of gap
  callBeats: 4,
  answerBeats: 4,
  patterns: Object.freeze(["x...", "x.x.", "xx.x", "x.xx", "xxx.", "xxxx"]),   // 16 notes, one slot per beat
  eyesS: 4,                      // `eyes`: no input; the eyes open by themselves at its end (gaDay 182, week 26)
  outroS: 3,                     // `outro`: week 27
  liftS: 2,                      // the vignette lifts over 2 s once the eyes open

  // the match rule and the hand glow (6.6)
  matchK: 0.75,                  // an answer with at least 75% of its notes Close or better is a match
  handFrom: 1,                   // phrase index (0-based) from which a match brings the hand glow: phrase 2, week 20
  handRiseS: 0.3, handHoldS: 0.6, handFadeS: 1.6,

  // the score (7, 6.6): Goal 3,000; Skill 1,500 x beat accuracy + 4,500 x answer accuracy; Flourish 250 per phrase
  // with every note In time, at most 1,000
  score: Object.freeze({ goal: 3000, beat: 1500, answer: 4500, flourishPer: 250, flourishMax: 1000 }),
  doneBeatK: 0.5,                // the heartbeat sub-goal is yours from this beat accuracy (else it settles by itself)
  doneMatches: 3,                // the answer sub-goal is yours from this many matched phrases

  // the voice: a seeded walk on a 5-note pentatonic set around F0 200 to 230 Hz (MIDI; G major pentatonic, E3 to D4)
  song: Object.freeze({ set: Object.freeze([52, 55, 57, 59, 62]), start: 2, steps: Object.freeze([-1, 0, 1, 1, -1]) }),
  humLeadS: 0.2,                 // each hummed note's sfx event goes out this long before its time, for scheduling

  // the picture (6.6, 5.6, 13): world units, span 100 across the short axis, world up is screen up (fit)
  view: Object.freeze({
    span: 100, camY: 6,
    baby: Object.freeze({ x: 0, y: -14, size0: 32, size1: 38 }),
    motherR: 22, youR: 7,
    slotY: 20, slotX: Object.freeze([-27, -9, 9, 27]),
    voice: Object.freeze({ x: -36, y: 34, r: 10 }),     // the warm patch the voice comes through
    hand: Object.freeze({ x: 36, y: 34, r: 11 }),       // the hand glow on the wall
    disc: Object.freeze({ y: 50, r: 16, spread: 30 }),  // the placenta disc on the wall, at nestleX x spread
    approachS: 2.5,              // target rings show this long before their time (>= max(2 beats, 1.2 s), 5.2)
    ringBeat: Object.freeze({ r0: 40, r1: 22 }),        // a heartbeat target's ring shrinks onto her ring
    ringSlot: Object.freeze({ r0: 14, r1: 6 }),         // an answer target's ring shrinks onto its ghost ripple
    rippleS: 1.3,                // a hummed note's gold ripple lasts this long
    litS: 0.6,                   // an answered note's ripple grows for this long
    fbS: 0.35,                   // the judge feedback ring shows this long
    level0: 0.62, level1: 0.74, warm: 0.8, tint: 0.04,
    vignette0: 0.55, vignette1: 0.2,
    caustics: 0.25,              // the dapple sheet at 25% (14.1)
    warp: 0.15,
  }),
});
