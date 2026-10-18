// First Breath: stage 2, The Egg (`egg`), its numbers (design.md 6.2, 5.6). egg.js reads every number from here.
// Times are seconds, lengths world units (u), angles degrees here (egg.js turns them into radians, counterclockwise
// from world +x, as in a y-up plane). Her heart is 72 bpm with no jitter (P = 0.833 s).
export const TUNE = Object.freeze({
  // The opening: beat 1 is her first beat at or after leadS; the surge is beats 1 and 2; the follicle taps are on
  // beats 3 to 8; the 3rd tap graded Close or better bursts it, else it bursts by itself on beat 8; then the sweep.
  opening: Object.freeze({ leadS: 0.2, surgeBeats: 2, firstTapBeat: 3, lastTapBeat: 8, burstGood: 3, sweepS: 2.0 }),

  // The camera and the sizes (5.6): the egg is about two sperm lengths across.
  span: 140,
  you: "0.1 mm",
  sizes: Object.freeze({
    cell: 9, shell: 11, inner: 6, follicle: 24, followSwell: 1.6,
    corona: Object.freeze([11, 20]), coronaN: 220, spermLen: 10, head: 1.5,
  }),

  // The arc (6.2): it turns toward the stick angle or the mouse aim at up to aimRateDeg, and by the turn keys at
  // turnRateDeg (Assist: assist values). A stick under stickMin leaves it still. It is over a sperm when the angle to
  // the sperm's head is within the half-width and the head is within reach of the egg's centre. Contract gap: the
  // arc wakes on the first guard input (turn, aim or a stick past stickMin), so a parked arc nobody moved earns no
  // guard credit; asleep it is drawn at sleepGlow and leaves every sperm alone.
  arc: Object.freeze({
    r: 16, w: 3, halfDeg: 35, halfAssistDeg: 50, aimRateDeg: 720, turnRateDeg: 540, turnRateAssistDeg: 720,
    stickMin: 0.25, reach: 22, sleepGlow: 0.4, fadeS: 1.2,
  }),

  // The 8 waves, by seconds into `guard`, only while your sperm has not entered (6.2).
  waves: Object.freeze({
    at: Object.freeze([2, 8, 14, 20, 26, 32, 38, 44]),
    count: Object.freeze([3, 4, 5, 6, 6, 7, 8, 8]),
    speed: Object.freeze([9, 10, 11, 12, 13, 14, 15, 15]),
    gapS: 0.3, ring: 75, fadeS: 0.5,
    sector1Deg: 90, sector2Deg: 60, minSepDeg: 25, jitterDeg: 10,
    // the first two waves keep 25° apart inside their sectors with a smaller jitter
    sectorJitterDeg: 2.5,
  }),
  // One fact per wave before your sperm comes (6.2).
  waveFacts: Object.freeze(["egg.zona", "egg.corona", "egg.choice", "egg.signal", "egg.size"]),

  bounce: Object.freeze({ speed: 14, spreadDeg: 20, removeR: 80, ringS: 0.4 }),
  stick: Object.freeze({ r: 11.5, burrowS: 4.0, burrowAssistS: 5.0, looseSpeed: 10, looseSpreadDeg: 12 }),
  held: Object.freeze({ r: 18, moveS: 0.6 }),

  // Your gold sperm (6.2). Its angle: 72 candidates, one every stepDeg, in the order of stream(seed, "gold"); it
  // drops those within thumbDeg of world −y, within captionDeg of world +y, and closer than (half-width +
  // arcMarginDeg) to the arc's centre; of the rest the one farthest from every stuck rival, the first on a tie.
  gold: Object.freeze({
    atS: 27, perPlaceS: 0.3, candidates: 72, stepDeg: 5, thumbDeg: 45, captionDeg: 40, arcMarginDeg: 30,
    speed: 14, burrowS: 3.0, nudgeOut: 6, nudgeS: 0.3, returnSpeed: 8, maxNudges: 3, latestS: 52, pathDeg: 14,
  }),

  enterS: 1.2,
  // The seal: her beats counted from the first at least afterS after the prompt; the release target on the
  // targetBeat-th, the seal by itself on the autoBeat-th. The wave runs round the shell in waveS, then the others
  // drift off at driftSpeed.
  seal: Object.freeze({ afterS: 0.6, targetBeat: 3, autoBeat: 6, waveS: 1.2, driftSpeed: 12, ringR: 13 }),
  // Fusion: contents in (0 to inS), the bead (inS to beadS), the nuclei draw close and touch (beadS to fusionS).
  // Captions: egg.wave at the start, egg.seal when the wave meets, egg.block once the others drift off.
  fusion: Object.freeze({ s: 5, inS: 1.5, beadS: 2.5, sealFactS: 1.2, blockFactS: 2.5 }),
  outroS: 2,
  sweepFacts: Object.freeze([["egg.fimbriae", 0], ["egg.cilia", 1.0]]),

  // Score (6.2, 7): Skill = open × accuracy (over at least openMin targets) + guard × credit + clean × (1 − nudges/3)
  // (only when the guard credit is above 0); Flourish = the seal release.
  score: Object.freeze({ open: 1500, openMin: 3, guard: 3500, clean: 1000, sealIn: 1000, sealClose: 500 }),
  credit: Object.freeze({ bounce: 1, loose: 0.5, held: 0 }),

  // The bot's arc policy (6.2): σ = sigmaDeg × (1 − skill), lag = lagS × (1 − skill); the gold zone is the half-width
  // + zoneMarginDeg round your sperm; swimmers count when they reach the reach ring within soonS; a waypoint at most
  // wayDeg ahead, so the arc turns the way the bot chose.
  bot: Object.freeze({ sigmaDeg: 25, lagS: 0.15, zoneMarginDeg: 10, soonS: 1.5, wayDeg: 90 }),

  // The draw list. Hues are keys into the stage 2 body ramp (render/palette.js): your sperm uses carry.sperm.hue.
  hue: Object.freeze({ follicle: 0.02, shell: 0.05, cell: 0.07, inner: 0.08, nucleus: 0.03, rival: 0.88, corona: 0.06 }),
  light: Object.freeze({ level: 0.5, warm: 0.6, vignette: 0.45, tintMax: 0.05, warp: 0.25 }),
  rings: Object.freeze({ mother: 27, approachFrom: 46, approachTo: 28, burrow: 3 }),
  capS: 80,
});
