// First Breath: stage 5, First Trimester (`grow`), its numbers: a twin-stick-style shooter on the action layer
// (core/lib/action.js; openspec/changes/first-breath-action-genres/contract.md). Weeks 7 to 13 (gaDay 49 to 97): one
// wave of germs and toxin blobs a week (weeks 7 to 12), each with a short rest after it, then the big germ (week 13)
// in three phases. Food from cleared germs grows your sparks; the cord brings a heal in each rest. Positions and sizes
// are world units (u); the camera's short axis is `view.span` u. Pure data.
// Tuned (first-breath-action-genres): the fastest foe shots of the run (design.md 3.2): the blob's aimed stack of 3 at
// 32, 36.5 and 41 u/s every 1.1 s (week 7's gentler blob0: 2 at 28 and 32 u/s), fans at 30 to 32, rings at 24, the
// toxin waves at 27; the big germ's fan 33, its rings 21 to 22 and its wave 27; a 1.4 s victory beat (outroS). Your
// sparks start slower (rate 4, growing to 7) and grow later (growAt), so the shooters live long enough to press you.
// Retuned so the grade follows your hits (the peak of the run): over 100 seeds the shared bot takes about 0.8 hits at
// skill 1 and 0.7 and about 3 at 0.5, none knocked out; skill 1 Great or better in about 93 of 100 (Glowing in 47),
// 0.7 mostly Great, 0.5 Good in about 65 of 100; idle knocked out at about 13 s; about 92 s a stage.
export const TUNE = Object.freeze({
  motherBpm: 72,                 // her rate (5.1); her beats swell the placenta

  // the sac: a round arena the camera holds still (world up is screen up)
  arena: Object.freeze({ x: 0, y: 0, r: 46 }),

  // your body (contract.md: the player); with Assist: more hp, longer i-frames, slower foe bullets
  player: Object.freeze({ r: 1.7, speed: 36, accel: 18, hp: 5, invS: 1.4, mercyR: 12 }),
  assist: Object.freeze({ hpPlus: 3, bulletK: 0.75, dashCdK: 0.7, foesK: 0.75 }),   // the shared Assist rule (design.md 4.2)
  bulletCap: 150,                // foe bullets at once (a pattern that would pass it waits)
  dash: Object.freeze({ speed: 110, s: 0.15, invS: 0.26, cdS: 0.85, bufferS: 0.12 }),
  fire: Object.freeze({ rate: 4, dmg: 1, speed: 95, spread: 1, arc: 0.16, pierce: 0, range: 42, r: 1.15, life: 0.6, kb: 6 }),

  heartBpm: 150,                 // the fire rate is rate × your heart's bpm / 150 (clock.bpmYou: 0.87× to 1.13×)
  // growth: food gathered passes these totals; each one is a step of your sparks (in this order)
  growAt: Object.freeze([7, 17, 30, 46, 66, 90, 118, 150]),
  grows: Object.freeze([
    Object.freeze({ rate: 5 }), Object.freeze({ spread: 2 }), Object.freeze({ pierce: 1 }), Object.freeze({ rate: 6 }),
    Object.freeze({ spread: 3 }), Object.freeze({ dmg: 1.5 }), Object.freeze({ rate: 7 }), Object.freeze({ pierce: 2 }),
  ]),

  // the moments: one wave a week (its spawns, then a rest), then the big germ
  waveS: 7.5,                    // a wave's nominal length (gaDay runs 7N to 7N + 6 over it)
  waveMaxS: 11,                  // a wave ends here even with germs left (they stay)
  restS: 2.2,                    // the rest after a wave: food is drawn in, the cord brings a heal
  bossInS: 1.6,                  // the big germ's spawn tell
  bossS: 16,                     // its nominal length (gaDay runs 91 to 96 over it)
  koS: 1.5,                      // a knock-out rests at least this long before the stage ends
  outroS: 1.4,                   // the victory beat after the big germ is cleared, before the stage ends
  capS: 120,
  // the foes (spawnFoe specs; contract.md) and each wave's rows: [at s, foe, n, angle (turns from the wave's base
  // angle), spread (rad between a group's members)]
  foes: Object.freeze({
    germ: Object.freeze({ kind: "germ", ai: "chase", r: 2.4, hp: 3, speed: 16, value: 10, touch: 1, drops: Object.freeze({ food: 1 }) }),
    spore: Object.freeze({ kind: "spore", ai: "wander", r: 1.9, hp: 1, speed: 18, value: 5, touch: 1,
      drops: Object.freeze({ food: 1 }) }),
    blob0: Object.freeze({ kind: "blob", ai: "shooter", r: 3.6, hp: 8, speed: 10, keep: 40, value: 25, touch: 1, mass: 2.5,
      drops: Object.freeze({ food: 3, heal: 0.06 }),
      gun: Object.freeze({ pattern: Object.freeze({ kind: "aimed", n: 2, speed: 28, r: 1.5, tone: "foe" }), every: 1.8, tellS: 0.6, first: 1.4 }) }),
    blob: Object.freeze({ kind: "blob", ai: "shooter", r: 3.6, hp: 10, speed: 10, keep: 40, value: 25, touch: 1, mass: 2.5,
      drops: Object.freeze({ food: 3, heal: 0.06 }),
      gun: Object.freeze({ pattern: Object.freeze({ kind: "aimed", n: 3, speed: 32, r: 1.5, tone: "foe" }), every: 1.1, tellS: 0.6, first: 1.0 }) }),
    blob3: Object.freeze({ kind: "blob", ai: "shooter", r: 3.6, hp: 10, speed: 10, keep: 40, value: 25, touch: 1, mass: 2.5,
      drops: Object.freeze({ food: 3, heal: 0.06 }),
      gun: Object.freeze({ pattern: Object.freeze({ kind: "fan", n: 4, arc: 0.26, speed: 32, r: 1.5, tone: "foe" }), every: 1.4, tellS: 0.7, first: 1.2 }) }),
    blob5: Object.freeze({ kind: "blob", ai: "shooter", r: 4, hp: 14, speed: 9, keep: 42, value: 35, touch: 1, mass: 3,
      drops: Object.freeze({ food: 4, heal: 0.1 }),
      gun: Object.freeze({ pattern: Object.freeze({ kind: "fan", n: 6, arc: 0.22, speed: 30, r: 1.5, tone: "hot" }), every: 1.6, tellS: 0.75, first: 1.3 }) }),
    ring: Object.freeze({ kind: "ring", ai: "orbit", r: 3.2, hp: 9, speed: 18, orbit: Object.freeze({ r: 30, w: 0.45 }), value: 30, touch: 1,
      mass: 2, drops: Object.freeze({ food: 3, heal: 0.1 }),
      gun: Object.freeze({ pattern: Object.freeze({ kind: "ring", n: 12, speed: 24, r: 1.4, tone: "soft" }), every: 1.9, tellS: 0.75, first: 1.6 }) }),
    waver: Object.freeze({ kind: "drop", ai: "shooter", r: 3.2, hp: 10, speed: 10, keep: 38, value: 30, touch: 1, mass: 2,
      drops: Object.freeze({ food: 3, heal: 0.08 }),
      gun: Object.freeze({ pattern: Object.freeze({ kind: "wave", n: 4, arc: 0.4, speed: 27, r: 1.4, w: 4, wf: 6, tone: "soft" }), every: 1.6,
        tellS: 0.7, first: 1.3 }) }),
    add: Object.freeze({ kind: "germ", ai: "chase", r: 2.2, hp: 2, speed: 14, value: 0, touch: 1, drops: Object.freeze({ food: 1 }) }),
  }),
  waves: Object.freeze([
    // week 7: move and let your sparks fly
    Object.freeze([[0.4, "germ", 4, 0.25, 0.22], [1.4, "germ", 4, 0.75, 0.22], [2.3, "blob0", 1, 0.0, 0], [3.3, "spore", 6, 0.5, 0.2],
      [4.1, "blob0", 1, 0.5, 0], [4.8, "germ", 4, 0.25, 0.22]]),
    // week 8: dash
    Object.freeze([[0.3, "spore", 8, 0.6, 0.16], [1.0, "blob", 1, 0.1, 0], [1.0, "blob", 1, 0.9, 0], [2.1, "germ", 5, 0.35, 0.18],
      [3.0, "germ", 5, 0.85, 0.18], [4.0, "blob3", 1, 0.55, 0], [4.8, "spore", 8, 0.2, 0.16]]),
    // week 9: fans and the first ring
    Object.freeze([[0.3, "blob3", 1, 0.0, 0], [0.3, "blob3", 1, 0.5, 0], [1.1, "germ", 6, 0.25, 0.16], [2.1, "ring", 1, 0.75, 0],
      [3.0, "spore", 10, 0.5, 0.11], [3.8, "germ", 6, 0.0, 0.16], [4.6, "blob", 1, 0.3, 0], [4.6, "blob", 1, 0.7, 0]]),
    // week 10: two rings
    Object.freeze([[0.3, "ring", 1, 0.25, 0], [0.3, "ring", 1, 0.75, 0], [1.1, "spore", 10, 0.0, 0.11], [2.1, "blob3", 1, 0.4, 0],
      [2.1, "blob3", 1, 0.6, 0], [3.1, "germ", 7, 0.15, 0.14], [4.1, "germ", 7, 0.65, 0.14], [5.0, "blob", 1, 0.0, 0]]),
    // week 11: wide fans
    Object.freeze([[0.3, "blob5", 1, 0.5, 0], [0.3, "blob3", 1, 0.0, 0], [1.0, "germ", 7, 0.25, 0.14], [1.9, "spore", 12, 0.75, 0.09],
      [2.2, "waver", 1, 0.35, 0], [2.9, "ring", 1, 0.1, 0], [2.9, "ring", 1, 0.6, 0], [4.0, "germ", 7, 0.9, 0.14], [4.8, "blob3", 1, 0.4, 0]]),
    // week 12: waves of toxin, everything at once
    Object.freeze([[0.3, "waver", 1, 0.2, 0], [0.3, "waver", 1, 0.8, 0], [1.0, "spore", 12, 0.5, 0.09], [1.9, "ring", 1, 0.0, 0],
      [1.9, "blob5", 1, 0.35, 0], [3.0, "germ", 8, 0.65, 0.12], [4.0, "blob3", 1, 0.1, 0], [4.0, "blob3", 1, 0.9, 0], [4.4, "spore", 10, 0.4, 0.1],
      [5.0, "germ", 8, 0.15, 0.12]]),
  ]),
  keepOut: 0.13,                 // spawns keep this many turns clear of the placenta on the wall

  // the big germ (week 13): three phases by its hp share
  boss: Object.freeze({
    spec: Object.freeze({ kind: "boss", ai: "still", r: 11, hp: 440, value: 300, touch: 1, mass: 40, boss: true }),
    phaseAt: Object.freeze([0.66, 0.33]),
    // phase 1: it circles the middle and spins a spiral; small germs bud from it
    p1: Object.freeze({ orbitR: 12, orbitW: 0.35, glide: 2.5,
      spiral: Object.freeze({ kind: "spiral", arms: 3, speed: 18, r: 1.5, tone: "soft" }), burst: 20, gap: 0.09, spin: 0.21, tellS: 0.7, restS: 1.1,
      addEvery: 5.0, adds: 2 }),
    // phase 2: it glides from place to place; a wide fan aimed at you, then a ring
    p2: Object.freeze({ hopS: 3.0, hopR: 22, glide: 3,
      fan: Object.freeze({ kind: "fan", n: 7, arc: 0.19, speed: 33, r: 1.5, tone: "hot" }), ring: Object.freeze({ kind: "ring", n: 18, speed: 22, r: 1.4, tone: "soft" }),
      tellS: 0.7, gapS: 1.1 }),
    // phase 3: it rushes at you (a charge line first), rings as it stops, then a wave fan
    p3: Object.freeze({ tellS: 0.85, rushSpeed: 70, rushS: 0.6, ring: Object.freeze({ kind: "ring", n: 22, speed: 21, r: 1.4, tone: "soft" }),
      wave: Object.freeze({ kind: "wave", n: 5, arc: 0.3, speed: 27, r: 1.4, w: 4, wf: 7, tone: "soft" }), restS: 0.8 }),
  }),

  // the score (7): Goal 3,000 for clearing the big germ (or lasting to the cap); Skill 6,000: 1,200 for the germs
  // cleared (your score with its combo over the whole value times refMult: an even chain of about 7), 4,800 for
  // shots dodged, less perHit a hit (none left from 3 hits); Flourish 1,000 × min(1, best combo / comboFull). The
  // hits decide the grade: none Glowing, 1 or 2 Great, 3 or more Good
  score: Object.freeze({ goal: 3000, clear: 1200, dodge: 4800, perHit: 1600, flourish: 1000, refMult: 1.6, comboFull: 25 }),

  // the picture (6.5, 5.6, 13.2): world up is screen up (fit); the sac's wall inside the scalloped frames
  view: Object.freeze({
    span: 112,
    // your length in mm by gaDay (research-biology.md 6, the NHS lengths); you are drawn size0 × (length / 10 mm) ^
    // sizeK u long (9.5 u at week 7, about 15 u at week 13): smaller than to scale, so the sac has room to play in
    lengthMm: Object.freeze([[49, 10], [56, 16], [63, 22], [70, 30], [77, 41], [84, 54], [91, 74], [97, 82]]),
    size0: 9.5, sizeK: 0.22,
    placenta: Object.freeze({ ang: 0.62, angK: 0.3, r: 11, out: 3 }),      // on the wall, up and to your nestled side
    pools: Object.freeze([[-0.38, 0.3, 0.24], [0.12, 0.42, 0.2], [-0.5, -0.12, 0.2], [0.34, -0.02, 0.22], [-0.06, -0.38, 0.19]]),
    tree: Object.freeze({ N: 160, D: 1.5, di: 8, dk: 2.0, maxNodes: 110, leafW: 0.28, grow: 90 }),
    motherPad: 2.5,
    cordS: 1.0,                  // a heal bead rides the cord this long
    light: Object.freeze({ level0: 0.55, level1: 0.66, warm: 0.62, vignette: 0.2 }),
    warp: 0.15,
  }),

  // the bot's reaction to a move (botSteer): the action bot does the rest (core/lib/actionbot.js)
  bot: Object.freeze({}),
});
