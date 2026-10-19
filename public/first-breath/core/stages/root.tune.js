// First Breath: stage 4, The Placenta (`root`), its numbers: the action-adventure of first-breath-action-genres
// (openspec/changes/first-breath-action-genres/design.md 5.4; the shared layer is contract.md). World units are u (the
// short screen axis is `span` u); times are stage seconds unless a name says otherwise. Pure data.
//
// Builder changes from design.md 5.4 (this file wins on what is built; the design keeps the plan):
// - Nestle: touching a spot sinks you in over 1.4 s (v1: 2 s), so a quick player starts the roots sooner; a player who
//   drifts but never touches is drawn in from 5 s, the same as idle, so nestle ends by 8 s.
// - The grapple's 30° cone is ±15° round the aim, widened by the target's own radius and 3 u of slack, so a tap aimed
//   at a knot on a phone still finds it. A tendril that snaps flies out at 600 u/s, then pulls at 140 u/s.
// - The tendril flies only through fluid and your tunnels: it sticks in any tissue, soft or firm, and pulls you to it
//   (5.4 says so for firm tissue and leaves soft open). So digging opens grapple lanes, and a hidden pool is dug to.
//   Knots lie in fluid or within 4 u of it, where a tendril can reach them.
// - The tunnel: cells within 5.5 u of you are cleared, which shows about 8 u wide between the cut edges (5.4: 8 u).
// - The bot follows a Dijkstra path field (5 u cells, soft 2.5×, firm shut until strong roots, 3.4× after) to the
//   nearest pool it can reach, not A*: the field also says how much a grapple saves.
// - Hidden pools behind soft tissue lie under it (the front sheet covers them until you tunnel in); the compass ping
//   shows through.
// - Firm tissue stops sparks, yours and the guard germs' (a guard behind its wall cannot reach you, and you hold
//   fire at a germ you cannot see).
// - The heart: 6 germs gather near the roots in the hush, and 2 more after the 2nd and 4th pulses; pulse k reaches
//   k / 8 of the roots near you (the 8th the whole tree), so a pop or two lands on every beat and the combo builds;
//   each pulse gets there in at most 0.6 s. The camera eases from 160 u to 230 u over the
//   heart, drifting up to 26 u toward the middle of your roots, so more of the tree shows; each pulse lights the
//   46 u of root behind its front.
// - More germs than 5.4 (3 at the start, 2 more every 7 s up to 6, then every 5 s up to 8 from 24 s), whose wander bends
//   toward you, so a slow dig has company; the bots took no hits at all with 5.4's numbers.
// - Germ pops carry no points (the graded parts are 5.4's); a germ may drop a heal (15%), a guard always does.
// - Germs have 3 hp (5.4: 2) and your sparks reach 42 u (5.4: 50 u), so a pair can reach you.
// - The longer reach and strong roots are word pops by you ("Longer reach", "Strong roots"), not captions, and "This
//   beat is yours." waits until root.heart has been read: the caption band is kept for the facts (pacing.test.mjs).
// - Knock-out: the stage ends with gaDay at the roots' end (35), not the stage end, so Go on plays the heart at Day 22
//   (the clock never goes back).
// - Measured (20 seeds): the ref bot 41 s (the roots 25 s), 9,770 on average; skill 0.7 43 s (the roots 27 s); skill
//   0.5 9,400 with no knock-out; idle 79 s, 4,400, no knock-out (5.4's targets: 52, 62 and 79 s).
export const TUNE = Object.freeze({
  motherBpm: 72,
  capS: 90,
  koS: 1.6,              // a knock-out rests at least this long (and until the captions sent are read)
  nestle: Object.freeze({
    lenS: 8,             // (5.4) up to 8 s
    driftUS: 30,         // drift at 30 u/s at full stick (v1)
    slideUS: 8,          // the lining slides by at 8 u/s (v1)
    ease: 8,             // 1/s: how fast your drift follows the stick
    spots: 3,            // (5.4) 3 soft spots
    spotR: 12,
    youR: 6,             // your hatched ball of cells
    sinkS: 1.4,          // touch a spot: you sink in over 1.4 s by itself
    idleS: 5,            // (5.4) idle for 5 s: the nearest spot draws you in
    drawS: 3,            // (5.4) ... over 3 s
    forceS: 5,           // still drifting at 5 s: drawn in too, so nestle ends by 8 s
    spotSide: Object.freeze([24, 44]),
    spotAhead: Object.freeze([30, 60]),
    halfW: 46,
    span: 100,           // (5.4) camera span
    glands: 6,
  }),
  map: Object.freeze({
    tiles: 12,           // (5.4) 12 × 12 tiles
    tileU: 25,           // (5.4) of 25 u: 300 × 300 u round your nestle point
    cellU: 2.5,          // the ground is cut in cells of 2.5 u (10 a tile): a tunnel clears the cells it crosses
    open: 0.25,          // (5.4) share of open fluid tiles
    firm: 0.15,          // (5.4) share of firm tissue (with the walls round 2 pools)
    warpU: 9,            // tile edges wander up to this far, so the tissue edges are not square
    startR: 18,          // an open pocket round your nestle point
    corridorW: 14,       // open fluid runs from the start to each open pool
    openR: 16,           // an open pool's pocket
    sealR: 26,           // a hidden pool lies under soft tissue this far round it
    wallIn: 22,          // a walled pool: an open chamber this wide ...
    wallOut: 32,         // ... in a ring of firm tissue out to here
    border: 2,           // cells of edge tissue round the map (never dug)
  }),
  pools: Object.freeze({
    n: 8,                // (5.4) 8 gland pools
    r: 12,               // (5.4) radius 12 u
    assistR: 16,         // (5.4) Assist
    gapU: 40,            // (5.4) at least 40 u apart
    open: Object.freeze([50, 80]),     // 3 in open fluid near the start
    soft: Object.freeze([75, 115]),    // 3 behind soft tissue
    firm: Object.freeze([100, 135]),   // 2 behind firm walls
    swell: 0.12,         // they swell 1 + 0.12 × pulse on her beat (v1)
    pulseS: 0.35,
  }),
  knots: Object.freeze({ n: 14, gapU: 30, r: 2.2 }),   // (5.4) 14 anchors, at least 30 u apart, on tile edges
  you: Object.freeze({
    body: 4, r: 1.7,     // (5.4) body and hitbox
    swimUS: 40,          // (5.4) in open fluid and your tunnels
    digUS: 16,           // (5.4) in soft tissue (you cut a tunnel 8 u wide)
    firmUS: 12,          // (5.4) through firm tissue with strong roots
    carveR: 5.5,         // cells within this are cleared: the tunnel shows about 8 u wide (5.4) between the cut edges
    solidR: 2.6,         // firm tissue keeps your centre this far (plus half a cell) away
    accel: 14,
    hp: 5,               // (5.4) 5 pips
    figU: 11,            // you are drawn this long in the roots (curled, about as wide as a tunnel)
  }),
  grapple: Object.freeze({
    reach: 60,           // (5.4) 60 u
    reach3: 90,          // (5.4) 90 u after 3 pools
    coneDeg: 15,         // half of the 30° cone
    slack: 3,
    shootUS: 600,
    pullUS: 140,         // (5.4)
    retractS: 0.3,       // (5.4) nothing to snap to: it comes back in 0.3 s
    cdS: 0.8,            // (5.4) cooldown
    stopU: 4.6,          // you stop this far short of a knot
  }),
  roots: Object.freeze({
    lenS: 58,            // (5.4) up to 58 s
    autoFromS: 30,       // (5.4) from 30 s the nearest unlinked pool links by itself ...
    assistAutoFromS: 22, // (5.4) Assist
    autoEveryS: 4,       // (5.4) ... every 4 s: all 8 by 58 s
    reachAt: 3,          // (5.4) pools for the longer reach
    strongAt: 5,         // (5.4) pools for strong roots
    glowS: 0.8,          // (5.4) a link's glow runs back along the roots
    pingBeats: 4,        // (5.4) every 4 of her beats a ripple from the nearest unlinked pool
    pingS: 1.3,
    span: 160,           // (5.4) camera span
    camS: 0.3,           // (5.4) the camera follows you with a 0.3 s ease ...
    camLagU: 26,         // ... and never lags more than this (you stay above 60% of the height in portrait)
    hcgS: 0.8,           // root.hcg this long after the roots start
    upStop: 6,           // hit-stop frames as your roots grow stronger
  }),
  germs: Object.freeze({
    start: 3,            // 3 wanderers at the start (5.4: 2) ...
    everyS: 7,           // ... then 2 more every 7 s (5.4: 1 every 8 s) ...
    pack: 2,             // a pack comes together
    latePack: 3,
    softK: 0.7,          // soft tissue slows a germ to 70% (firm turns it back)
    max: 6,              // ... up to 6 on the map (5.4: 5) ...
    lateS: 24,           // ... and from 24 s into the roots, every 5 s up to 8: the longer you take, the more come
    lateEveryS: 5,
    lateMax: 8,
    wanderUS: 12,        // (5.4)
    chaseUS: 20,         // (5.4) faster than you dig (16), slower than you swim (40)
    chaseR: 36,          // (5.4: 30)
    driftW: 0.9,         // rad/s: a wanderer's path bends toward you, so germs drift in
    hp: 3, r: 2.6, touch: 1, value: 10,   // (5.4: 2) so a pair can reach you through your sparks
    heal: 0.15,
    spawnU: Object.freeze([48, 95]),   // from you
    behindU: 40,         // never more than this far behind you (-y): no spawn in the bottom 40% in portrait
  }),
  guard: Object.freeze({
    hp: 6, r: 3.4, value: 30,          // (5.4) a guard germ by each walled pool
    orbitR: 16, orbitW: 0.55,          // it circles its pool
    fan: Object.freeze({ kind: "fan", n: 3, arc: 0.26, speed: 20, tone: "foe", life: 3, r: 1.3 }),   // (5.4) 20 u/s
    every: 2.2,          // (5.4)
    tellS: 0.6,
    wakeU: 80,           // it fires only while you are this close
  }),
  fire: Object.freeze({ rate: 3, range: 42, speed: 90, dmg: 1, life: 0.55, spread: 1, r: 1.1 }),   // (5.4) root sparks (range 42: 5.4 says 50)
  bulletCap: 24,         // (5.4) at most 24 foe sparks
  heart: Object.freeze({
    bpm: 110,            // (5.4) your heart beats by itself at 110 bpm
    hushS: 1.5,          // (5.4) the hush
    hushDb: -8,          // (5.4) her heart 8 dB down
    hushLight: 0.9,      // (5.4) light 10% down
    lenS: 6,             // (5.4) 6 s
    pulses: 8,           // (5.4) your first 8 beats each send a pulse
    pulseUS: 260,        // a pulse runs down the tree at least this fast ...
    pulseMaxS: 0.6,      // ... and covers the whole tree in at most 0.6 s
    popR: 40,            // (5.4) it pops every germ within 40 u of the tree
    // germs that gather near the roots in the hush, one by each node at these shares of the near roots' path
    // lengths from your heart; then 2 more after the 2nd pulse and 2 after the 4th, further out
    gatherAt: Object.freeze([0.05, 0.2, 0.33, 0.45, 0.58, 0.7]),
    gatherMore: Object.freeze([[2, Object.freeze([0.62, 0.8])], [4, Object.freeze([0.88, 1])]]),
    gatherU: Object.freeze([24, 110]),             // the near roots: this far from you
    yoursS: 3.2,         // "This beat is yours." this long into the heart
    heartCapS: 0.3,      // root.heart this long into the hush
    span: 160,
    spanTo: 230,         // the camera eases back over the heart so more of the tree shows
    litU: 46,            // the length of root a pulse lights behind its front
  }),
  grow: Object.freeze({
    lenS: 7,             // (5.4, v1) 7 s
    mm: Object.freeze([[36, 2], [42, 6], [49, 10]]),
    spanTo: 320,         // (5.4) 320 u (from the heart's 230)
    placentaGa: 45,      // "This will become your placenta." from this gaDay
  }),
  score: Object.freeze({
    goal: 3000,
    pools: 3000,         // (5.4) 3,000 × pools you linked yourself / 8
    hidden: 1500,        // (5.4) 1,500 × hidden pools you linked yourself / 5
    hiddenN: 5,
    pips: 1500,          // (5.4) 1,500 × pips left at the heart / 5
    pipsN: 5,
    flourish: 1000,      // (5.4) all 8 yourself ...
    flourishS: 40,       // (5.4) ... before 40 s into the roots
    youDone: 4,          // the pools sub-goal is "done" (not "auto") when you linked at least this many
  }),
  assist: Object.freeze({ hpPlus: 3, bulletK: 0.75, foesK: 0.75, dashCdK: 0.7 }),   // (4.2, 5.4)
  tree: Object.freeze({ D: 6, maxNodes: 260 }),                         // (5.4, v1 caps)
  bot: Object.freeze({
    cellU: 5,            // the bot's path grid (60 × 60)
    softCost: 2.5,       // (5.4) soft tissue costs 2.5×
    firmCost: 3.4,       // firm with strong roots (40 / 12)
    look: 3,             // it aims 3 path cells ahead
    gain: 24,            // a grapple must save at least this much path (u of open fluid)
    goalW: 1.6,          // the pool's pull over actionSteer's dodging (design 4.11 × 1.6: the map is the goal)
  }),
});
