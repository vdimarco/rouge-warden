// First Breath: stage 2, The Egg (`egg`), its numbers (openspec/changes/first-breath-action-genres/design.md 5.2; the
// v1 numbers it keeps are from the archived v1 design 6.2 and 5.6). egg.js reads every number from here. Times are
// seconds, lengths world units (u), angles degrees here (egg.js turns them into radians, counterclockwise from world
// +x, as in a y-up plane). Her heart is 72 bpm with no jitter (P = 0.833 s).
//
// Changes from design.md 5.2, recorded here as the design asks:
// - The field is scaled to a rim at 48 u (design: 54 u), so the rim and the swarm's outer ring stay inside the
//   landscape safe area (844 × 390 with ?inset=47,0,34,0 puts the egg 63 u above the screen's bottom edge, 51 u above
//   the inset). The formations' radii are scaled with it (about 0.9 of the design's), so the gaps between rings stay.
//   The rim still turns the glow within 14° of the centre: its closest pass is 48 × sin 14° = 11.6 u, inside the arc.
// - The curtain closes in from 45 u (design: 50 u), inside the rim.
// - The rush's 4 rivals reach the shell from 1.2 s before your sperm to 1.05 s after it (design: within 1.5 s of it),
//   so each is settled before your sperm enters and counts toward the rush credit.
// - Measured stage lengths (sim, 20 seeds): see the header of qa/first-breath/stage-egg.test.mjs and design.md 3.1.
export const TUNE = Object.freeze({
  // The opening: beat 1 is her first beat at or after leadS; the surge is beats 1 and 2; the follicle opens by itself
  // on beat 3 ("It opens."), then the fimbriae sweep the egg into the tube for sweepS.
  opening: Object.freeze({ leadS: 0.2, surgeBeats: 2, burstBeat: 3, sweepS: 2.0 }),

  // The camera and the sizes (v1 5.6): the egg is about two sperm lengths across.
  span: 140,
  you: "0.1 mm",
  sizes: Object.freeze({
    cell: 9, shell: 11, inner: 6, follicle: 24, followSwell: 1.6,
    corona: Object.freeze([11, 20]), coronaN: 220, spermLen: 10, head: 1.5,
  }),

  // The arc (v1): it turns toward the stick angle or the mouse aim at up to aimRateDeg, and by the turn keys at
  // turnRateDeg (Assist: assist values). A stick under stickMin leaves it still. It wakes on the first guard input;
  // asleep it is drawn at sleepGlow and leaves everything alone (a glow crossing it is lost). It is over a sperm when
  // the angle to the sperm's head is within the half-width and the head is within reach of the egg's centre.
  arc: Object.freeze({
    r: 16, w: 3, halfDeg: 35, halfAssistDeg: 50, aimRateDeg: 720, turnRateDeg: 540, turnRateAssistDeg: 720,
    stickMin: 0.25, reach: 22, sleepGlow: 0.4, fadeS: 1.2,
  }),

  // The field: the shell a spark must reach to cost a pip, the rim the glow bounces off (a dotted pale ring), and
  // how far out a spark or a sperm is gone.
  field: Object.freeze({ shell: 11.5, rim: 48, sparkOut: 72, removeR: 80 }),

  // The glow (the ball). It serves at speed (Assist speedAssist) and gains `gain` each time it leaves the arc, up to
  // max (Assist maxAssist). Off the arc it leaves along the radius turned by k × retDeg (k the hit's offset over the
  // half-width); off the rim it heads within rimDeg (Assist rimAssistDeg) of the egg's centre. A lost last glow
  // serves again serveS later from the arc's centre, after a serveTellS glow on the arc. The first serve comes
  // wakeS after the arc wakes, or firstS into the guard. A glow that has not met the arc for staleS fades and serves
  // again with no pip lost. At most n glows; each keeps `trail` points of its trail.
  ball: Object.freeze({
    r: 1.2, drawR: 1.9, speed: 34, speedAssist: 28, gain: 1, max: 50, maxAssist: 40, retDeg: 55, rimDeg: 14,
    rimAssistDeg: 10, serveS: 1.0, serveTellS: 0.6, wakeS: 0.6, firstS: 3, staleS: 10, n: 6, trail: 7, fadeS: 0.35,
  }),

  // The bricks: rival sperm in formations. headR is the head's circle (the glow bounces off it). Hits by kind. At most
  // `cap` in formation (members past it join as room frees). A member comes in over inS (its spawn tell: it cannot
  // be hit) from inFrom u further out. A re-forming ring closes its gaps over reformS. A wave comes early once
  // `early` or fewer bricks are left, never within gapS of the last. ease is how fast a member follows its slot (1/s).
  // A spent brick drifts off at offSpeed (v1's bounce), within offSpreadDeg of straight out.
  brick: Object.freeze({
    headR: 2.5, hits: Object.freeze({ plain: 1, tough: 2, capped: 3, rush: 1 }), cap: 36, inS: 0.6, inFrom: 14,
    reformS: 2, early: 3, gapS: 4, ease: 9, offSpeed: 14, offSpreadDeg: 20, stagger: 0.035, recoil: 1.8,
  }),

  // Divers (from W2): a member leaves its formation after a tellS wiggle and swims in at speed, curving round the
  // egg at swirl rad/s; the v1 rules apply (the arc bounces it, the glow takes a hit off it, or it sticks).
  dive: Object.freeze({ tellS: 0.6, speed: 12, swirl: 0.5 }),

  // The waves (seconds into the guard, on the world clock). Each formation: kind ring | arcs (two opposite arcs of
  // n/2, spreadDeg apart) | orbit (one member circling at R); R (u), w (rad/s), reform, the members' kinds (P plain,
  // T tough, C capped) and guns { member index: pattern }. dive: a diver every so many seconds (0: none).
  waves: Object.freeze([
    Object.freeze({ at: 0, fact: "egg.zona", dive: 0, forms: Object.freeze([
      Object.freeze({ kind: "ring", R: 26, w: 0.2, kinds: "PPPPPPPPPP", guns: Object.freeze({}) }),
    ]) }),
    Object.freeze({ at: 7, fact: "egg.caps", dive: 6, forms: Object.freeze([
      Object.freeze({ kind: "arcs", R: 38, w: -0.15, spreadDeg: 15, kinds: "PTPTPPTPTP", guns: Object.freeze({ 2: "aimed" }) }),
    ]) }),
    Object.freeze({ at: 14, fact: "egg.corona", dive: 5, forms: Object.freeze([
      Object.freeze({ kind: "ring", R: 31, w: 0.25, kinds: "PTPTPTPT", guns: Object.freeze({}) }),
      Object.freeze({ kind: "ring", R: 43, w: -0.2, kinds: "CPPCPPCPPP", guns: Object.freeze({ 1: "fan", 6: "fan" }) }),
    ]) }),
    Object.freeze({ at: 21, fact: "egg.choice", dive: 5, forms: Object.freeze([
      Object.freeze({ kind: "ring", R: 34, w: 0.22, reform: true, kinds: "PTPPTPTPPT", guns: Object.freeze({ 0: "curtain" }) }),
      Object.freeze({ kind: "orbit", R: 44, w: 0.5, kinds: "T", guns: Object.freeze({ 0: "ring" }) }),
    ]) }),
  ]),

  // The swarm (the boss formation): n members at R turning w, by kinds; it changes phase at a third and two thirds
  // of its hits, each change after pauseS with a ring tell and no new sparks; it drifts off at leaveAt members or
  // maxS after it came. Phase 1: shooters fire aimed streams in turn, one every `every`. Phase 2: two rings (R) turning
  // opposite ways, curtains from alternating sides, 2 spinners in the outer ring sending rings, a diver. Phase 3: one
  // ring drawn in, the turning stream, an aimed stream every aimedEvery, a diver.
  swarm: Object.freeze({
    at: 28, R: 38, w: 0.3, kinds: "TCTCTTCTCTTCTCTTCTCT", leaveAt: 4, maxS: 14, pauseS: 0.8, shiftS: 0.8,
    p1: Object.freeze({ shooters: Object.freeze([0, 5, 10, 15]), every: 1.2 }),
    p2: Object.freeze({ R: Object.freeze([32, 43]), w: 0.35, curtainEvery: 2.5, spinners: 2, ringEvery: 3.5, dive: 5 }),
    p3: Object.freeze({ R: 29, w: 0.45, aimedEvery: 2.0, dive: 5 }),
  }),

  // Enzyme sparks (the bullet hell). Keylined paper diamonds of radius r, never over maxSpeed. Each pattern shows its
  // tell for tellS before its first spark (an aimed shot's foe glows for its wind-up through it). first: seconds from
  // a shooter settling to its first shot. A blocked spark turns back at blockK times its speed as yours. At most cap
  // sparks (Assist capAssist); a pattern that would pass it waits. Assist: speed × bulletAssistK, every / rateAssistK.
  fire: Object.freeze({
    r: 1.4, maxSpeed: 24, cap: 50, capAssist: 38, tellS: 0.35, blockK: 1.3, bulletAssistK: 0.75, rateAssistK: 0.75,
    jitter: 0.12,
    aimed: Object.freeze({ n: 3, gapS: 0.15, speed: 20, every: 3.0, first: 1.4 }),
    fan: Object.freeze({ n: 3, arcDeg: 12, speed: 18, every: 2.6, first: 1.6 }),
    curtain: Object.freeze({ n: 5, arcDeg: 12, from: 45, speed: 16, every: 4.0, first: 1.8 }),
    ring: Object.freeze({ n: 10, speed: 16, every: 3.5, first: 2.0 }),
    stream: Object.freeze({ degS: 50, onS: 3, offS: 1.5, gapS: 0.15, speed: 20 }),
  }),

  // Power-ups: a brick that drifts off drops one by kind (chance), sure after `pity` drift-offs with none; at most
  // maxFall at once. They fall inward at speed; only the arc catches one, at 16 u within its span or catchDeg past
  // either end. The kind by weight. Multi splits every glow into 3, multiDeg apart; Wide makes the half-width wideDeg
  // (Assist wideAssistDeg) for wideS; Pierce lets glows pass through for pierceS; Slow moves all but the arc at slowK
  // for slowS; Mend adds a pip (mendPts points at full pips).
  ups: Object.freeze({
    chance: Object.freeze({ plain: 0.08, tough: 0.15, capped: 0.3, swarm: 0.12, rush: 0 }), pity: 10, maxFall: 2,
    speed: 12, catchDeg: 3, r: 2.4,
    kinds: Object.freeze(["multi", "wide", "pierce", "slow", "mend"]),
    weights: Object.freeze([0.3, 0.25, 0.15, 0.15, 0.15]),
    multiDeg: 20, wideDeg: 55, wideAssistDeg: 65, wideS: 10, pierceS: 6, slowS: 5, slowK: 0.6, mendPts: 200,
  }),

  // The seal charge (the bomb): +perOff for each brick that drifts off, +perBlock for each spark blocked; full at
  // `full`, keeps up to `keep`. A press releases one: a wave from `from` to `to` u in waveS turns every spark into a
  // gold sparkle and takes one hit off every brick it passes; the shell has invS of i-frames.
  charge: Object.freeze({ full: 12, perOff: 1, perBlock: 0.5, keep: 2, waveS: 0.5, from: 11, to: 70, invS: 1.0, stop: 6 }),

  // The rush: your sperm comes in afterS + perPlaceS × (place − 1) after the swarm drifts off, from `from` u at speed;
  // n rivals come with it, sepDeg apart from it and from each other, each reaching the shell offsets[i] (± jitterS)
  // from when yours does.
  rush: Object.freeze({
    afterS: 1.0, perPlaceS: 0.3, from: 75, speed: 14, n: 4, sepDeg: 60,
    offsets: Object.freeze([-1.2, -0.45, 0.3, 1.05]), jitterS: 0.15,
  }),

  // Your gold sperm (v1). Its angle: 72 candidates, one every stepDeg, in the order of stream(seed, "gold"); it drops
  // those within thumbDeg of world −y, within captionDeg of world +y, and closer than (half-width + arcMarginDeg) to
  // the arc's centre; of the rest the one farthest from every stuck rival, the first on a tie. It enters by latestS
  // into the guard whatever happens. After Go on it comes in from goOnFrom u (within 2 s).
  gold: Object.freeze({
    candidates: 72, stepDeg: 5, thumbDeg: 45, captionDeg: 40, arcMarginDeg: 30,
    speed: 14, burrowS: 3.0, nudgeOut: 6, nudgeS: 0.3, returnSpeed: 8, maxNudges: 3, latestS: 60, pathDeg: 14, goOnFrom: 38,
  }),

  bounce: Object.freeze({ speed: 14, spreadDeg: 20, ringS: 0.4 }),
  stick: Object.freeze({ r: 11.5, burrowS: 4.0, burrowAssistS: 5.0, looseSpeed: 10, looseSpreadDeg: 12 }),
  held: Object.freeze({ r: 18, moveS: 0.6 }),

  // Shell pips (the action layer's hp): pips (Assist pipsAssist), plus up to shieldMax shield sparks; a hit gives invS
  // of i-frames and clears the sparks within mercyR of the centre.
  shell: Object.freeze({ pips: 6, pipsAssist: 9, shieldMax: 2, invS: 1.0, mercyR: 20 }),
  // A knock-out: the egg rests, the sparks and sperm drift off over restS, then (once what was said is read) the
  // Almost card.
  ko: Object.freeze({ restS: 1.2 }),
  // The combo: each hit on a brick within s of the last adds 1 (×1 to ×max, step a hit).
  combo: Object.freeze({ s: 1.5, step: 0.1, max: 2.5 }),

  enterS: 1.2,
  // The seal: the prompt shows; a fresh press seals, or it seals by itself autoS later. The wave runs round the shell
  // in waveS, then out to the screen edge, and the others drift off at driftSpeed.
  seal: Object.freeze({ autoS: 2.0, waveS: 1.2, driftSpeed: 12 }),
  // Fusion: contents in (0 to inS), the bead (inS to beadS), the nuclei draw close and touch (beadS to s).
  fusion: Object.freeze({ s: 5, inS: 1.5, beadS: 2.5 }),
  outroS: 2,

  // Score (design.md 5.2): Skill = bricks × min(1, hits taken / (bricksShare × all the hits that came)) + pips × the
  // share of pips left at enter + combo × min(1, best combo / comboFull) + rush × the rush credit; Flourish = clean
  // for a clean pick + charge for each charge kept to the seal (chargeMax at most).
  score: Object.freeze({ bricks: 2500, bricksShare: 0.75, pips: 1500, combo: 1000, comboFull: 15, rush: 1000,
    clean: 500, charge: 250, chargeMax: 500 }),
  credit: Object.freeze({ bounce: 1, loose: 0.5, held: 0 }),

  // The bot's arc (design.md 5.2): the glow due within glowS, a spark due within sparkS, a power-up within upDeg, the
  // v1 target; at aimSkill or more it aims the glow at the most hits within aimDeg; σ = sigmaDeg × (1 − skill), lag =
  // lagS × (1 − skill); the gold zone is the half-width + zoneMarginDeg round your sperm; a waypoint at most wayDeg
  // ahead. The seal charge (skill ≥ chargeSkill): chargeN sparks within chargeNear u of the centre, or one due within
  // chargeSoonS the arc cannot reach; at skill 1 one is kept from the swarm's phase 3. At the seal: at once at
  // chargeSkill or more, else sealS ± sealJitter × (1 − skill).
  bot: Object.freeze({
    sigmaDeg: 25, lagS: 0.15, zoneMarginDeg: 10, glowS: 1.2, sparkS: 0.8, diveS: 1.0, upDeg: 40, aimDeg: 20,
    aimSkill: 0.7, wayDeg: 90, chargeSkill: 0.5, chargeNear: 30, chargeN: 6, chargeSoonS: 0.5, sealS: 1.0, sealJitter: 0.5,
  }),

  // The draw list. Hues are keys into the stage 2 body ramp (render/palette.js): your sperm uses carry.sperm.hue.
  hue: Object.freeze({ follicle: 0.02, shell: 0.05, cell: 0.07, inner: 0.08, nucleus: 0.03, rival: 0.88, corona: 0.06 }),
  light: Object.freeze({ level: 0.5, warm: 0.6, vignette: 0.45, tintMax: 0.05, warp: 0.25 }),
  // DOM rings: her beat round the arc's field, the seal charge inside the egg, burrow rings.
  rings: Object.freeze({ mother: 23, charge: 7.4, burrow: 3 }),
  capS: 80,
});
