// First Breath: stage 5, First Trimester (`grow`), its numbers (design.md 6.5, 4.1, 5.1, 5.2, 7). One phrase of your
// heart per week (weeks 7 to 13, gaDay 49 to 97), a reflex move between phrases (weeks 8 to 13). Your heart follows
// clock.bpmYou (130 bpm at week 7, 170 at weeks 9 and 10, about 155 at week 13), laid with no jitter (5.1: 0% while a
// target track runs). Positions and sizes are world units (u); the short screen axis is 100 u (5.6). Pure data.
export const TUNE = Object.freeze({
  motherBpm: 72,                 // her rate (5.1); her beats swell the placenta and, from week 12, its pools

  // the moments (4.1, 6.5)
  phraseBeats: 16,               // beatN lasts 16 of your beats at the week's mean rate (clock.bpmYou)
  leadS: 2.0,                    // beat7 opens with 2 s before its 16 beats; no target comes in it (6.5: 2 + ...)
  moveS: 3.0,                    // moveN lasts up to 3 s: at 3 s the move plays by itself
  playS: 0.8,                    // a move you make plays for 0.8 s, then the moment ends (never past moveS)
  tailS: 0.35,                   // a phrase's last target comes this long before a move (its miss is judged inside)

  // the targets (6.5, 5.2): on your beats, gaps of 2 (weeks 7, 8), 2 or 3 (weeks 9, 10), 2 to 4 (weeks 11 to 13)
  gaps: Object.freeze({ 7: [2, 2], 8: [2, 2], 9: [2, 3], 10: [2, 3], 11: [2, 4], 12: [2, 4], 13: [2, 4] }),
  lightS: 1.6,                   // a light enters the cord at least 1.6 s (and 2 targets) before its target
  tickTargets: 56,               // the most targets a stage can lay (7 phrases x 8): the HUD's per-tap tick divisor

  // the moves (6.5): a glow 40 u away; the stick within 35 degrees at >= 50% deflection for 0.5 s
  move: Object.freeze({
    dist: 40, glowR: 9, arrowAt: 22, arrowR: 5,
    coneDeg: 35, coneAssistDeg: 50, minStick: 0.5, holdS: 0.5,
    // weeks 8 to 13: 8 uncurl (up), 9 stretch an arm (left or right, seeded), 10 startle (the other side),
    // 11 kick (down) while the fists open and close, 12 kick (down), 13 thumb to mouth (up)
    rise: 0.45, hold: 0.7, fall: 0.8,      // the pose blends in, holds and eases back to the curl (s)
  }),
  fistS: 1.4,                    // week 11: the fists open and close once per 1.4 s

  // the bot (6.5: point the stick at the move glow): it reacts after 0.3 + 2.0 x (1 - skill) s, at stick
  // 0.4 + 0.6 x skill, with an aim error of 0.35 x (1 - skill) rad (one draw per move, kept in r.mem)
  bot: Object.freeze({ reactS: 0.3, reactSlowS: 2.0, stick0: 0.4, stickK: 0.6, aimErr: 0.35 }),

  // the score (7, 6.5): Goal 3,000; Skill 4,500 x heart accuracy + 1,500 x moves you did / 6;
  // Flourish 1,000 x min(1, best In-time streak / 16)
  score: Object.freeze({ goal: 3000, heart: 4500, moves: 1500, flourish: 1000, streakFull: 16 }),
  doneHeartK: 0.5,               // the heart sub-goal is yours from this accuracy (else it settles by itself)

  // the picture (6.5, 5.6, 13.2): world up is screen up (fit); the baby sits at the camera point (the subject)
  view: Object.freeze({
    span: 100,
    // your length in mm by gaDay (research-biology.md 6, the NHS lengths), drawn to the scale of mmPerShortAxis
    lengthMm: Object.freeze([[49, 10], [56, 16], [63, 22], [70, 30], [77, 41], [84, 54], [91, 74], [97, 82]]),
    bob: 0.6, bobHz: 0.13,
    // the placenta disc: upper right when you nestled at nestleX >= 0, upper left otherwise
    placenta: Object.freeze({ x: 28, xK: 6, y: 30, r: 13 }),
    pools: Object.freeze([[-0.38, 0.3, 0.24], [0.12, 0.42, 0.2], [-0.5, -0.12, 0.2], [0.34, -0.02, 0.22], [-0.06, -0.38, 0.19]]),
    layer: 1.1,                  // from week 12 a thin glowing layer rings each pool (it parts the two bloods)
    tree: Object.freeze({ N: 220, D: 1.6, di: 9, dk: 2.2, maxNodes: 150, leafW: 0.3, grow: 120 }),
    youR: 3.6, motherPad: 2.5,   // your heart ring; her ring sits round the placenta
    approachR: 16,               // a target's ring shrinks from this onto your heart ring as its light rides the cord
    flashS: 0.45,                // the light entering your heart glows this long (dim on a miss)
    gradeS: 0.35,                // your ring shows the last grade this long
    light: Object.freeze({ level0: 0.55, level1: 0.66, warm: 0.62, vignette: 0.35 }),
    warp: 0.25,
  }),

  // sound (6.5): each In-time tap rings a soft bell from a pentatonic set (semitones)
  bell: Object.freeze([0, 2, 4, 7, 9, 12]),
});
