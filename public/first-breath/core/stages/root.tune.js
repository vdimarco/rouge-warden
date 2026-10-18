// First Breath: stage 4, The Placenta (`root`), its numbers (design.md 6.4). World units are u (the short screen axis is
// 100 u at camera span 100); times are stage seconds unless a name says otherwise. Pure data.
//
// Numbers 6.4 gives are marked (6.4). The rest are this builder's choices for the v1 prototype (for tasks.md 2d):
// the tip's accel and drag (6.4 gives only its speed and turn rate), the spot and pool layout ranges, the firm edge,
// the auto reach's growth speed (fast enough that a reach started at 36.5 s links by 40 s), the heart moment's lead-in
// and tail, the camera spans and the bot's easing.
export const TUNE = Object.freeze({
  nestle: Object.freeze({
    lenS: 12,            // (6.4) up to 12 s
    driftUS: 30,         // (6.4) drift at 30 u/s at full stick
    slideUS: 8,          // (6.4) the lining slides by at 8 u/s (you are carried forward, +y)
    ease: 8,             // 1/s: how fast your drift follows the stick
    spots: 3,            // (6.4) 3 glowing soft spots
    spotR: 12,           // (6.4) 24 u wide
    youR: 6,             // your hatched ball of cells
    sinkS: 2,            // (6.4) touch a spot: you sink in over 2 s by itself
    idleS: 8,            // (6.4) idle for 8 s: the nearest spot draws you in
    drawS: 3,            // (6.4) ... over 3 s
    forceS: 9,           // a player who drifts but never touches is drawn in from 9 s, so nestle ends by 12 s
    spotSide: Object.freeze([24, 44]),  // |x| of a spot from your start line, so an idle drift never touches one
    spotAhead: Object.freeze([38, 78]), // y of a spot ahead of your start
    halfW: 46,           // your drift stays within ±46 u of the lining's centre line
    span: 100,           // camera span (u)
    lookU: 15,           // the camera looks this far ahead of you
    glands: 6,           // gland mouths on the lining, texture that shows the slide
  }),
  roots: Object.freeze({
    lenS: 40,            // (6.4) up to 40 s
    tipUS: 40,           // (6.4) tip 40 u/s
    turnRadS: 2.6,       // (6.4) turn 2.6 rad/s
    accel: 160,          // u/s²: the tip speeds up to the stick's speed
    drag: 6,             // 1/s: the tip eases down to the stick's speed (lift the finger and it rests)
    pools: 8,            // (6.4) 8 gland pools
    poolR: 16,           // (6.4) radius 16 u
    poolMinU: 60,        // (6.4) seeded 60 to 150 u from the root
    poolMaxU: 150,
    poolGapU: 40,        // (6.4) at least 40 u apart
    fanDeg: 56,          // pools lie within ±56° of forward, so all 8 fit the free screen in every layout
    swell: 0.12,         // (6.4) swell 1 + 0.12 × pulse on her beat
    pulseS: 0.35,        // the swell's decay after each of her beats
    autoFromS: 12,       // (6.4) from 12 s, one more pool by itself every 3.5 s
    autoEveryS: 3.5,
    assistAutoFromS: 8,  // (6.4) Assist: auto-link from 8 s
    assistPoolK: 1.3,    // (6.4) Assist: pools radius ×1.3
    reachUS: 52,         // an auto reach grows this fast (≤ 150 u in under 3 s)
    firmR: 172,          // the firm edge: the tip slides along it, never past it
    backU: 14,           // ... and never more than this far behind the root (into the wall)
    span: 320,           // camera span while the roots grow
    aheadU: 50,          // the camera looks this far ahead of the root
    glowS: 0.8,          // a link's glow runs back to you over this long
  }),
  tree: Object.freeze({
    N: 400,              // (6.4) attraction points
    D: 6,                // (6.4) node step
    di: 48,              // (6.4) influence radius
    dk: 12,              // (6.4) kill radius
    activeR: 60,         // (6.4) points pull only within 60 u of the tip or of a pool being linked by itself
    iters: 2,            // (6.4) at most 2 iterations per step
    maxNodes: 260,       // (6.4) at most 260 nodes
    colonizeMax: 216,    // colonization stops here, so the steered tip and the reaches keep nodes for their paths
    fanPts: 160,         // points spread over the fan ahead of the root; the rest sit around the pools
    poolPtsR: 30,
  }),
  heart: Object.freeze({
    bpm: 110,            // (6.4) your heart beats by itself at 110 bpm (5.1: bpmYou(36))
    hushS: 1.5,          // (6.4) 1.5 s hush
    hushDb: -8,          // (6.4) her heart −8 dB in the hush
    hushLight: 0.9,      // (6.4) light −10%
    yoursS: 3.5,         // "This beat is yours. Tap with it." once your heart has beaten by itself for 2 s
    leadBeats: 6,        // the first target is your 7th beat, 1.27 s after that line (its preview, 5.2)
    targets: 8,          // (6.4) 8 targets on your beats (P = 0.545 s)
    tailS: 3,            // then both hearts play together (root.tube shows 0.6 s in, with time to read it)
    heartCapS: 0.3,      // root.heart shows this long into the hush
    span: 160,           // the camera comes close to you
  }),
  grow: Object.freeze({
    lenS: 7,             // (6.4) 7 s
    mm: Object.freeze([[36, 2], [42, 6], [49, 10]]),   // (6.4, NHS weeks 5 to 7) your length in mm by gaDay
    spanTo: 320,         // the camera pulls back while you grow (the real span goes 5.2 → 30 mm, 4)
    placentaGa: 45,      // "This will become your placenta." from this gaDay
  }),
  score: Object.freeze({
    pools: 3000,         // (6.4) Skill: 3,000 × pools you linked / 8
    onBeat: 1000,        // (6.4) 1,000 × on-beat links / 8
    heart: 2000,         // (6.4) 2,000 × heart accuracy (8)
    inTime: 1000,        // (6.4) Flourish: 1,000 × heart taps In time / 8
    youDone: 4,          // the pools sub-goal is "done" (not "auto") when you linked at least this many
    heartDone: 0.5,      // the heart sub-goal is "done" at this accuracy
  }),
  bot: Object.freeze({
    easeU: 20,           // (6.4) time the arrival to her next beat by easing speed in the last 20 u
    minMag: 0.05,        // the slowest stick while easing
  }),
});
