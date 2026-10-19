// First Breath: stage 7, Third Trimester (`turn`), its numbers (openspec/changes/first-breath-action-genres design.md
// 5.7, 4.2, 4.6; contract.md). A survivor-style auto-shooter on the shared action layer (core/lib/action.js). Plain
// data, deep-frozen. World units (u), seconds, radians unless named in degrees. Wave times are seconds into `waves` on
// the world clock (A.t, which holds still under a hit-stop and runs at 0.25× while the gift bubbles show).
//
// Measured (qa/first-breath/stage-turn.test.mjs, 10 seeds; sim.test.mjs, 20 seeds): skill 1 about 8,900, 0.7 about
// 8,900, 0.5 about 8,800 with no knock-out in 20; idle knocked out at about 30 s. Changes from design.md 5.7 found in
// play: the Big Germ has 72 hp (Assist 54) and a second phase at half hp (its ring comes every 2.2 s, as two rings
// 0.3 s apart), so the climax lasts about 7 s and pops in about 2 of 3 good runs; the levels come sooner (5, 14, 27,
// 44, 66 and 92 sparkles: the first gift at about 8 s, all six by about 55 s); the horde is thicker (drifters every
// 1.0, 0.75, 0.7, 0.5 and 0.7 s; swarmer rings at 26, 31, 35, 40 and 45 s); a puffer leaves a heal 30% of the time,
// so a weaker player can recover before the Big Germ; sparkles stay 14 s.

const deep = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === "object") deep(v);
  return Object.freeze(o);
};

export const TUNE = deep({
  motherBpm: 72,
  capS: 100,

  // the moments (stage seconds; waves on the world clock)
  waveS: 60,                 // the survivor waves
  clearS: 1.4,               // the clear at 60 s: every germ left pops, every sparkle is pulled to you
  turn: { maxS: 6, holdS: 1.0, deflect: 0.5, autoS: 1.6, settleS: 0.8, growS: 1.2 },
  rest: { s: 10, warmUpS: 1.5, warmDownS: 3.0, noteLeadS: 0.5, noteGapS: 0.56 },
  outroS: 3,
  koS: 1.5,                  // a knock-out rests at least this long (and until the captions sent are read)

  // the camera holds the womb still (fit), its centre on the subject point
  view: {
    span: 140,
    camY: -6,                // the womb's centre a little above the subject point (42% of the height in portrait), so
                             // you stay above 60% of the height in portrait down to 360 × 640
    sizeU: [16, 18],         // your figure, head to bottom, over the waves (smaller than true: room to play)
    snugU: 40,               // ... and after the clear, filling the snug womb (closer to true)
    disc: { r: 12, out: 0 }, // the placenta on the wall, where you nestled (carry nestleX), its lobes from treeSeed
    cordS: 1.2,              // an antibody bead rides the cord this long
    light: { level: 0.8, warm: 0.7, vignette: 0.04, snugK: 0.3 },   // the frames close in as the womb gets snug
    warp: 0.2,
  },

  // the arena: round, easing from 54 to 38 u between 20 and 55 s ("It gets snug in here.")
  arena: { r0: 54, r1: 38, t0: 20, t1: 55 },
  keepOut: 0.11,             // turns of the wall kept clear of germs either side of the placenta

  // you (contract.md player overrides): the fetus figure, body 6 u, hitbox 2.4 u, 30 u/s, 6 pips
  player: { r: 2.4, body: 6, speed: 30, accel: 16, hp: 6, invS: 1.0, mercyR: 10, push: 6, safeR: 14, clearR: 24 },
  // the kick (the layer's dash): 80 u/s for 0.2 s, back in 1.4 s; germs within 14 u are knocked 20 u and take 1
  kick: { speed: 80, s: 0.2, invS: 0.3, cdS: 1.4, bufferS: 0.12, r: 14, push: 20, dmg: 1 },
  // the starting weapon, Y darts level 1: a dart every 0.6 s at the nearest germ within 60 u, 90 u/s, damage 2,
  // passes through 1
  fire: { rate: 1 / 0.6, dmg: 2, speed: 90, spread: 1, arc: 0.2, pierce: 1, range: 60, r: 1.4, life: 0.75, kb: 4 },
  pickup: { magnet: 18, pull: 70, lifeS: 14, r: 1.6, drag: 3 },
  bulletCap: 50,             // foe sparks at once
  foeCap: 40,                // germs at once (a spawn waits for room)

  // Assist (the shared rule, design.md 4.2): hp +3, foes ×0.75, foe sparks ×0.75 speed, the kick back 0.7× as soon;
  // the Big Germ 45 hp; levels at 0.8× the sparkles
  assist: { hpPlus: 3, bulletK: 0.75, dashCdK: 0.7, foesK: 0.75, bigHp: 54, levelK: 0.8 },

  // the germs (a spawnFoe spec each; the sparkles are dropped by the stage: 1 a germ, the Big Germ 12; a puffer leaves
  // a heal 30% of the time, the layer's own drop)
  foes: {
    drifter: { kind: "germ", ai: "wander", r: 2.8, hp: 3, speed: 14, touch: 1, value: 10, mass: 1, chaseR: 40 },
    swarmer: { kind: "spore", ai: "chase", r: 2.0, hp: 1, speed: 22, touch: 1, value: 5, mass: 0.6, steer: 3 },
    puffer: { kind: "blob", ai: "shooter", r: 3.6, hp: 6, speed: 9, touch: 1, value: 20, mass: 1.6, keep: 32, drops: { heal: 0.3 },
      gun: { pattern: { kind: "fan", n: 3, arc: 0.32, speed: 22, tone: "foe", life: 4 }, every: 2.5, tellS: 0.6, first: 1.6, jitter: 0.12 } },
    big: { kind: "boss", ai: "chase", boss: true, r: 10, hp: 72, speed: 8, touch: 1, value: 100, mass: 6, steer: 2,
      spawnS: 1.2, sparkles: 12,
      gun: { pattern: { kind: "ring", n: 12, speed: 24, tone: "hot", r: 1.7, life: 4 }, every: 3, tellS: 0.7, first: 1.4, jitter: 0 } },
  },
  big: { addEvery: 4, adds: 2, phase2: 0.5, every2: 2.2, gap2: 0.3 },
  ringR: 50,                 // a swarmer ring closes in on you from this far (members past the wall are left out)
  ringN: 12,

  // the waves, seconds into `waves`: each row spawns its kind every `every` s from `from` (after the 1 s calm at each
  // wave start) to `to`; rings and the Big Germ at their times
  waves: [
    { from: 0.5, to: 12, drifter: 1.0 },
    { from: 13, to: 24, drifter: 0.75, puffer: 6 },
    { from: 25, to: 36, drifter: 0.7, puffer: 6, rings: [26, 31, 35] },
    { from: 37, to: 48, drifter: 0.5, puffer: 4, rings: [40, 45] },
    { from: 49, to: 60, drifter: 0.7 },
  ],
  bigAt: 48,
  calms: [12, 24, 36, 48],   // 1 s calms (a soft swell; a fact may show)

  // the grow meter: levels at these sparkle totals; each level offers 3 gifts
  levels: [5, 14, 27, 44, 66, 92],

  // gift bubbles (design.md 4.6): 22 u round you, up-left, up, up-right; the world at 0.25× while they show; after 3 s
  // of stage time the middle one picks itself
  gift: { bubbleD: 22, bubbleR: 5, angs: [2.6, Math.PI / 2, 0.54], pickS: 3.0, slowK: 0.25, gapS: 0.4, wallPad: 4 },
  gifts: [
    { id: "darts", icon: "spread", max: 3 },
    { id: "ring", icon: "orbit", max: 3 },
    { id: "clump", icon: "chain", max: 3 },
    { id: "beat", icon: "bounce", max: 3 },
    { id: "snug", icon: "shell", max: 3 },
    { id: "kick", icon: "dash", max: 3 },
    { id: "grow", icon: "magnet", max: 3 },
  ],
  prefer: ["darts", "ring", "clump", "beat", "snug", "kick", "grow"],
  darts: { addN: 1, rateK: 1.15 },                                   // each level after 1: +1 dart, volleys 15% faster
  ring: { n0: 2, r0: 16, nK: 1, rK: 2, w: 3.0, hitR: 1.8, perS: 0.4, dmg: 1, push: 8 },
  clump: { every: [3, 2.5, 2], range: 50, r: 12, dmg: 3, pullS: 0.35, pull: 34 },
  beat: { every: 4, r: [30, 40, 50], push: 15, dmg: 1, showS: 0.45 },
  kickGift: { kbK: 2, cdLess: 0.3 },
  growGift: { magnetK: 0.5 },

  // the score (design.md 5.7): Goal 3,000; Skill 2,500 × germs popped / germs that came (a tick at each pop, under
  // the final share), 1,500 × levels / 6, 1,000 × pips left at 60 s / your max, 1,000 if you turn yourself;
  // Flourish 1,000 if the Big Germ pops before 60 s
  score: { goal: 3000, popped: 2500, popTick: 2000, levels: 1500, pips: 1000, turn: 1000, flourish: 1000 },

  // the bot (design.md 5.7): kite round at 60% of the arena's radius, kick with 3 or more germs within 14 u
  bot: { kiteK: 0.6, lead: 0.7, weight: 0.8, kickN: 3, giftWeight: 2.5 },
});
