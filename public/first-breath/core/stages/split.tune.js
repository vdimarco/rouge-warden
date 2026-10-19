// First Breath: stage 3, The Embryo: first cells (`split`), its numbers: a roguelike on the action layer
// (core/lib/action.js; openspec/changes/first-breath-action-genres/design.md 5.3, contract.md). Days 1 to 4 are one
// room of germs each (the tube carries you on at the room timer), a split after each room (2, 4, 8, then 16 cells:
// each split adds a shot; after Day 4 the cells pack tight instead), and a pick of 1 of 3 gifts by swimming into a
// bubble. Day 5 is the Knot, a big clump at the tube's end, in three phases; Day 6 you hatch. Positions and sizes are
// world units (u): the short screen axis is `span` u (0.45 mm across, so 1 u is about 0.004 mm). Pure data.
//
// Tuned from design.md 5.3 (first-breath-action-genres), recorded here and in design.md 3.1:
// - Your cells fire 3.3 volleys a second (design: 3) at germs within 50 u (design: 70), so you move up the room to
//   reach the far germs, and Day 1 with its one shot clears in about 7.5 s.
// - Chasers have 3 hp (design: 2) and lunge only within 36 u; drifters lean toward you as they wander. Puffers puff
//   every 1.5 s (design: 2.0) at 24 u/s. The Knot's ring comes every 2.0 s (design: 2.5), its phase 3 fan every
//   1.0 s (design: 1.2).
// - The Knot has 200 hp (design: 50; Assist 152): with 16 cells and its gifts the ref bot pops 50 hp in under 3 s.
//   Its phases change at the same shares as the design's 30 and 12 of 50: at 60% and at 24% of its hp. The Flourish
//   comes when it pops within 13 s of its room's start (design: 12 s; the spawn tell is 1.2 s).
// - Germs pop into sparkles (the "up" pickup). Every 8 sparkles mend a pip (not in the design: the Magnet gift needs
//   something to draw in). They fade after 4 s.
// - A clear beat of 0.6 s (the exit opens, the sparkles are drawn in) comes before each split.
// Bots over 20 seeds (qa/first-breath/stage-split.test.mjs plays 10): skill 1 mean 9,810 (no knock-out, the Knot popped
// in 8 to 14 s), 0.7 mean 9,570 and 0.5 mean 9,480 (no knock-out), idle 4,130 (knocked out in 14 of 20, at 19 to
// 72 s). A stage takes about 56 s for the ref and mid bots; cap 100 s.
const DEG = Math.PI / 180;

export const TUNE = Object.freeze({
  motherBpm: 72,                 // her rate; her beats swell the tube's squeezes

  // the view: the tube runs toward +y (the womb); the camera holds each room still and glides to the next
  span: 120,
  roomL: 140,                    // room n sits at y = n × roomL (the camera's subject point)
  room: Object.freeze({ x0: -48, x1: 48, y0: -40, y1: 60 }),     // the room's soft walls round its subject point
  exitY: 60,                     // the exit (a squeeze of the tube) at the room's top, closed until the room is clear
  tubeW: 104,                    // the tube's floor, a little wider than the room

  // you: the ball of cells in its clear shell (contract.md player); it never grows
  player: Object.freeze({ r: 2.5, body: 7, speed: 34, accel: 18, hp: 4, invS: 1.0, mercyR: 9, push: 6, safeR: 14, clearR: 24 }),
  dash: Object.freeze({ speed: 100, s: 0.18, invS: 0.28, cdS: 1.0, bufferS: 0.12 }),
  // your cells' shots: cream dots at the nearest germ within 70 u; a fan 10° apart
  fire: Object.freeze({ rate: 3.3, dmg: 1, speed: 110, spread: 1, arc: 10 * DEG, pierce: 0, range: 50, r: 1.2, life: 0.9, kb: 5 }),
  shots: Object.freeze([1, 2, 3, 4]),          // shots in a volley at 2, 4, 8 and 16 cells
  pickup: Object.freeze({ magnet: 15, lifeS: 4 }),
  mendEvery: 8,                  // sparkles that mend a pip
  bulletCap: 60,                 // foe spores on screen at once (a pattern that would pass it waits)
  assist: Object.freeze({ hpPlus: 3, bulletK: 0.75, dashCdK: 0.7, foesK: 0.75, knotK: 0.76 }),

  // the clock of a day: the room (to its timer), the clear beat, the split (or the pack), the pick
  roomS: 10,                     // the room timer: what is left drifts off and the exit opens
  clearS: 0.6,                   // the exit opens and the sparkles are drawn in
  splitS: 1.2,                   // the cells pinch in two (input none) while the tube carries you to the next room
  pickS: 3.0,                    // stage seconds before the middle gift picks itself
  pickTo: Object.freeze({ x: 0, y: -10 }),     // where the split leaves you in the next room (the bubbles go above)
  koS: 1.5,                      // a knock-out rests at least this long before the stage ends
  capS: 100,

  // the foes (spawnFoe specs, contract.md); "lunge" chasers wobble, then lunge (the stage drives their speed)
  foes: Object.freeze({
    drifter: Object.freeze({ kind: "germ", ai: "wander", r: 3.0, hp: 3, speed: 13, value: 10, touch: 1, home: 1.4, drops: Object.freeze({ up: 1 }) }),
    chaser: Object.freeze({ kind: "spore", ai: "chase", r: 2.4, hp: 3, speed: 14, value: 10, touch: 1, lunge: true,
      drops: Object.freeze({ up: 1 }) }),
    puffer: Object.freeze({ kind: "blob", ai: "shooter", r: 3.8, hp: 5, speed: 8, keep: 36, value: 20, touch: 1, mass: 2.5, wall: true,
      drops: Object.freeze({ up: 2 }),
      // a fan of 3 sticky spores: they slow as they go and linger
      gun: Object.freeze({ pattern: Object.freeze({ kind: "fan", n: 3, arc: 0.32, speed: 24, r: 1.6, tone: "soft", acc: -0.5, life: 4 }),
        every: 1.5, tellS: 0.6, first: 1.2 }) }),
    splitter: Object.freeze({ kind: "cell", ai: "wander", r: 3.4, hp: 4, speed: 9, value: 15, touch: 1, mass: 1.5, kids: 2,
      drops: Object.freeze({ up: 1 }) }),
    kid: Object.freeze({ kind: "spore", ai: "chase", r: 1.8, hp: 1, speed: 16, value: 5, touch: 1, lunge: true, spawnS: 0.6 }),
  }),
  lunge: Object.freeze({ walkS: 0.9, wobS: 0.35, goS: 0.4, walk: 18, go: 55, range: 36 }),
  // each room's rows: [at s into the room, foe, n]
  rooms: Object.freeze([
    Object.freeze([[0, "drifter", 6], [1.2, "chaser", 2]]),
    Object.freeze([[0, "drifter", 4], [0, "puffer", 2], [1.8, "chaser", 4]]),
    Object.freeze([[0, "puffer", 3], [0, "chaser", 2], [2.4, "splitter", 2], [2.4, "chaser", 2]]),
    Object.freeze([[0, "chaser", 3], [0, "puffer", 2], [0, "splitter", 2], [4, "chaser", 3], [4, "puffer", 2], [4, "splitter", 1]]),
  ]),
  spawnMin: 30,                  // no germ spawns closer than this to you (the layer's own floor is 24)

  // the gifts (design.md 4.6, 5.3): id, its level cap; the bot's preference. The bubbles sit up-left, up and up-right
  // of you at 150°, 90° and 30° (design: up-left, up, up-right), so their tags clear each other in every layout
  gifts: Object.freeze([
    Object.freeze({ id: "quick", max: 2 }), Object.freeze({ id: "spread", max: 2 }), Object.freeze({ id: "bounce", max: 2 }),
    Object.freeze({ id: "sticky", max: 1 }), Object.freeze({ id: "shell", max: 3 }), Object.freeze({ id: "dash", max: 2 }),
    Object.freeze({ id: "orbit", max: 2 }), Object.freeze({ id: "chain", max: 2 }), Object.freeze({ id: "magnet", max: 2 }),
  ]),
  prefer: Object.freeze(["spread", "quick", "orbit", "chain", "shell", "bounce", "dash", "sticky", "magnet"]),
  gift: Object.freeze({
    bubbleR: 6, bubbleD: 22, angs: Object.freeze([150 * DEG, 90 * DEG, 30 * DEG]),
    quick: 0.3,                  // volleys +30% a second a level
    spread: 2,                   // +2 shots a level
    stickyK: 0.6, stickyS: 1,    // a hit slows a germ to ×0.6 for 1 s
    dashFar: 0.4, dashCd: 0.25,  // dash +40% far, its cooldown −0.25 s, a level
    orbitR: 12, orbitW: 3.2, orbitCellR: 2.2, orbitEvery: 0.4,     // 2 cells a level orbit you and pop what they touch
    chain: 4, chainSpeed: 70, chainLife: 0.32,                     // a popped germ bursts into 4 sparks a level
    magnet: Object.freeze([15, 30, 60]),                          // sparkles drift to you from this far
  }),

  // the Knot (Day 5): a big clump at the tube's end, in three phases by its hp share
  knot: Object.freeze({
    spec: Object.freeze({ kind: "boss", ai: "still", boss: true, r: 14, hp: 200, value: 0, touch: 1, mass: 50 }),
    at: Object.freeze({ x: 0, y: 40 }), inS: 1.2,
    phaseAt: Object.freeze([0.6, 0.24]),
    pauseS: 0.6,                 // each phase change: a pause with a charge tell
    leaveS: 18,                  // it loosens and drifts off by itself
    flourishS: 13,               // popped within this long of the room's start: the Flourish
    countAs: 10,                 // germs it counts as
    p1: Object.freeze({ sway: 16, swayW: 0.6, ring: Object.freeze({ kind: "ring", n: 12, speed: 24, r: 1.7, tone: "hot" }), every: 2.0, tellS: 0.6,
      addEvery: 5, adds: 2 }),
    p2: Object.freeze({ sway: 10, swayW: 0.9, spiral: Object.freeze({ kind: "spiral", arms: 2, speed: 26, r: 1.5, tone: "foe" }), onS: 3, offS: 2,
      gap: 0.14, spin: 0.32, tellS: 0.5, fan: Object.freeze({ kind: "fan", n: 5, arc: 0.22, speed: 26, r: 1.6, tone: "hot" }), fanEvery: 3, fanTellS: 0.5 }),
    p3: Object.freeze({ roll: 8, fan: Object.freeze({ kind: "fan", n: 3, arc: 0.3, speed: 28, r: 1.6, tone: "hot" }), every: 1.0, tellS: 0.4 }),
    winS: 1.2,                   // the victory beat after it pops
  }),

  hatchS: 3.0,                   // you slip out of your shell (input none); the crack at crackS
  crackS: 1.0,
  slipU: 14,
  outroS: 2.0,                   // you drift toward the soft lining
  outroU: 22,
  goOnSplitS: 0.7,               // after a knock-out and Go on: each split left plays this long, then the hollow fills
  goOnFillS: 0.8,

  // the score (design.md 5.3): Goal 3,000; Skill 3,000 × germs popped / germs that came, 1,500 × rooms cleared
  // before their timer / 5 (300 each, the Knot's room counts), 1,500 × pips left at the hatch / 4; Flourish 1,000
  score: Object.freeze({ goal: 3000, popped: 3000, rooms: 1500, roomsN: 5, pips: 1500, pipsN: 4, flourish: 1000 }),

  // the picture
  ballR: 7.6,                    // the shell ring (the body is 7 u)
  cellsR: 6.0,                   // the cells keep inside this
  cellR: Object.freeze([5.6, 3.9, 2.9, 2.15, 1.6]),   // a cell's radius at 1, 2, 4, 8 and 16 cells
  shellW: 1.3,
  motes: 40,
});
