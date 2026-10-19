// First Breath: stage 1, The Race (`swim`), its numbers. The v1 race (the v1 design 6.1) keeps every number it had:
// the pack, the steering, the waves, the fork and cool loop, the tube's current and lane, the glow walls, the bumps,
// the catch-up. The kart parts of the action redesign (openspec change first-breath-action-genres, design.md 5.1) add
// the bends, drifts, items, the slipstream, white cells, knockout gates and the cool tide below the v1 block.
// Units are u (the short screen axis is 100 u at span 100) and seconds. qa/first-breath/race-sim.mjs plays the real
// stage with these numbers and checks the race gates.
//
// Tuned against the gates (race-sim.mjs, 20 seeds; recorded in design.md 3.1): see the TUNED note at the end.
export const TUNE = Object.freeze({
  // the clock (6.1, 4.1)
  CAP_S: 117, START_S: 0.5, MEET_S: 2.5, CARRIED_S: 3,
  PROMPT_S: 0.3, GOAL_S: 1.0,
  // swim: own speed target 55 u/s × stick, accel, drag above the target, turn rate; ready ×1.6 on the stick term only
  SWIM: 55, ACCEL: 120, DRAG: 1.8, TURN: 3.0, READY_X: 1.6,
  // the course: progress runs along the centre line (world +y), x across it (world x)
  WOMB_END: 1100, WOMB_HALF: 80, GATE_END: 1250, GATE_HALF: 20, FORK: 1300, SPLIT: 1330, MOUTH: 60,
  TUBE_START: 1400, TUBE_END: 4600, TUBE_HALF: 30,
  // waves: wave k starts at WAVE_T0 + WAVE_GAP k at WAVE_FROM, WAVE_THICK thick, WAVE_SPEED forward, window ±WAVE_HALF
  // about a centre within ±WAVE_SPREAD; lifts a sperm with stick ≥ WAVE_STICK heading within WAVE_DEG of forward
  WAVE_T0: 1.2, WAVE_GAP: 3.2, WAVE_FROM: -20, WAVE_THICK: 60, WAVE_SPEED: 140, WAVE_HALF: 40, WAVE_SPREAD: 40,
  WAVE_BLEND_S: 0.3, WAVE_STICK: 0.3, WAVE_DEG: 45,
  // the cool loop: its own 160 u track with a 40 u/s flow round it; 40 u wide (LOOP_HALF 20)
  LOOP_LEN: 160, LOOP_FLOW: 40, LOOP_HALF: 20,
  // the tube: current 22 u/s × (0.3 + 0.7 (1 − r²)); upstream within 25° +18 u/s; lane 30 u wide drifting ±12 u at
  // 0.1 Hz, +12 u/s and the current halved inside it; a new wall contact keeps 0.9 of the speed
  CURRENT: 22, UP_BONUS: 18, UP_DEG: 25, LANE_W: 30, LANE_DRIFT: 12, LANE_HZ: 0.1, LANE_BONUS: 12, WALL_KEEP: 0.9,
  // glow walls (alternating from the tube's left wall), the attach rule, ready on her 4th beat; her beats
  GLOWS: Object.freeze([1700, 2600, 3500]), GLOW_R: 20, ATTACH_STICK: 0.25, READY_BEAT: 4, BPM: 72, JITTER: 0.03,
  CHECKS: Object.freeze([1400, 2200, 3000, 3800]),
  // bumps: heads are circles of radius 3; swimming = stick ≥ 0.25 or speed ≥ 15; keep 0.7 of the speed at most once
  // per 0.4 s, top speed back from ×0.8 to ×1 over 0.6 s
  HEAD_R: 3, SWIM_STICK: 0.25, SWIM_SPEED: 15, BUMP_KEEP: 0.7, BUMP_TOP: 0.8, BUMP_EASE_S: 0.6, BUMP_GAP_S: 0.4,
  // rivals: the skill ladder (rung 0 and 1 are the front-runners), the cool-tube chance 0.5 (1 − skill), the mild
  // catch-up over 400 u. (v1's rest 500 u behind you is gone: the gates and the tide do that job.) A sperm that is out
  // slows over REST_SLOW_S, then rests by the wall.
  SKILLS: Object.freeze([0.80, 0.76, 0.55, 0.52, 0.49, 0.46, 0.43, 0.40, 0.37, 0.34, 0.30, 0.26, 0.22, 0.19, 0.16, 0.13,
    0.10, 0.07, 0.04]),
  FRONT: 2, COOL: 0.5, REST_SLOW_S: 1, CATCH_AHEAD: 0.10, CATCH_BEHIND: 0.06, CATCH_SPAN: 400,
  // bot steering (botSteer, also the rivals' policy): stick m = M0 + M1 skill; ride wave k when its threshold <
  // RIDE0 + RIDE1 skill; aim error, heading noise every 0.5 s, lag; separation within 12 u; let go within 10 u of a
  // glow, steering to it from 80 u before; rest at wall 1 from skill 0.75, wall 2 from 0.4; let a missed wave pass
  // from 30 u behind; ride 20 u inside the window's edges
  M0: 0.4, M1: 0.6, RIDE0: 0.3, RIDE1: 0.7, AIM_SD: 15, NOISE_DEG: 30, NOISE_EVERY_S: 0.5, LAG_S: 0.15, SEP: 12,
  LET_GO: 10, GLOW_LOOK: 80, REST_1: 0.75, REST_2: 0.4, MISS_AHEAD: 30, RIDE_IN: 20,

  // ---- the stage's own numbers (not in the race sim) ----
  RACERS: 20,
  // the start grid: 5 rows of 4, 12 u apart, 10 u between slots, the front row at 48 u; you in row 3, slot 2
  GRID_ROWS: 5, GRID_COLS: 4, GRID_ROW_GAP: 12, GRID_COL_GAP: 10, GRID_FRONT: 48, YOU_SLOT: 9,
  // the shown place changes after a new place holds this long
  PLACE_HOLD_S: 0.25,
  // assist (6.1): your current ×0.7, your lane ×1.5 wide, your bumps keep 0.85 and top ×0.9, rivals ahead ease by up
  // to 20%, rivals behind get no push
  ASSIST_CURRENT: 0.7, ASSIST_LANE: 1.5, ASSIST_BUMP_KEEP: 0.85, ASSIST_BUMP_TOP: 0.9, ASSIST_CATCH_AHEAD: 0.2,
  ASSIST_CATCH_BEHIND: 0,
  // the camera: 170 u in the womb, easing to 150 u between 1,100 and 1,250 u; it follows you sideways with a 0.4 s ease
  SPAN_WOMB: 170, SPAN_TUBE: 150, CAM_EASE_S: 0.4,
  // the cool loop as drawn: three quarters of a circle of radius 30 on its own side, then back along 1,300 u to the gate
  LOOP_R: 30, LOOP_BACK_X: 17,
  // the meeting place band and your glide to the wall in `meet`
  MEET_W: 12, MEET_GLIDE: 20, MEET_READY_S: 1.2,
  // captions: at least this long between two, so each 2.5 s portrait line clears first; facts at their moments
  SAY_GAP_S: 2.6, WAVES_LATE_S: 9, FLOW_AFTER_S: 4, REST_SHOW: 80,
  // the view: what the stage sends of the course around the camera, and its sample step
  VIEW_BACK: 220, VIEW_AHEAD: 380, VIEW_STEP: 25, DRAW_RANGE: 320,
  // a sperm is drawn 22 u long; the tail beats faster with its speed
  LEN: 22, TAIL_HZ: 1.2, TAIL_PER_U: 1 / 12,
  // contact rings: how long one shows and how many at most; the swish when your heading turns about 0.4 rad in 0.2 s
  RING_S: 0.45, RINGS_MAX: 12, SWISH_ACC: 0.4, SWISH_TAU_S: 0.2, SWISH_GAP_S: 0.4,
  // colours (hue 0..1 for the palette ramps): the rivals' mauve #967088
  RIVAL_HUE: 0.894,

  // ---- the kart parts (design.md 5.1) ----
  // the warm tube's bends: [from progress, turn in degrees (+ left), radius]; the turns add to 0
  BENDS: Object.freeze([[1450, -90, 120], [1780, 120, 90], [2250, -180, 55], [2880, 90, 100], [3060, -90, 100],
    [3620, 150, 70]].map((b) => Object.freeze(b))),
  // the racing line: the warm lane eases to the inside of each bend, LANE_IN u from the centre, over LANE_RAMP u
  LANE_IN: 15, LANE_RAMP: 70,
  // the camera turns with the track (0.5 s ease), taking the track's heading CAM_LOOK/2 u ahead of you so it turns
  // into a bend early. It does not move you down the screen in a bend (CAM_AHEAD 0, not design.md's 20%): in portrait
  // stage 1's captions sit in a band just under you (layout.e2e.mjs), and a bend's look-ahead pushed you onto them.
  CAM_TURN_S: 0.5, CAM_AHEAD: 0, CAM_LOOK: 40,
  // drift: a press while turning (the stick 25° off your heading, or your heading turning at 0.45 rad/s) at 30 u/s or
  // more starts it; it charges while you keep turning to its side (20°, or 0.3 rad/s); blue, orange and pink at 0.6,
  // 1.2 and 2.0 s; straightening (stick within 10° and the turn under 0.25 rad/s for 0.15 s), lifting (stick under
  // 0.15) or a press lets it go. While it lasts your path follows your heading at 5 /s (the slide).
  DRIFT_SPEED: 30, DRIFT_START_DEG: 25, DRIFT_RATE: 0.45, DRIFT_KEEP_DEG: 20, DRIFT_KEEP_RATE: 0.3,
  DRIFT_STRAIGHT_DEG: 10, DRIFT_STRAIGHT_RATE: 0.25, DRIFT_STRAIGHT_S: 0.15, DRIFT_LIFT: 0.15, DRIFT_SLIDE: 5,
  RATE_TAU_S: 0.08,
  DRIFT_LEVELS: Object.freeze([0.6, 1.2, 2.0]),
  DRIFT_BOOST: Object.freeze([Object.freeze([25, 0.5]), Object.freeze([30, 0.9]), Object.freeze([35, 1.3])]),
  // boosts for the score: a womb wave ridden counts 0.5, a blue drift 0.5, orange 1, pink 1.5; 6 is full marks
  WAVE_COUNT: 0.5, DRIFT_COUNT: Object.freeze([0.5, 1, 1.5]), BOOSTS_FULL: 6,
  // slipstream: within 30 u behind another swimming sperm (its wake 6 u wide), headings within 15°, both at 40 u/s;
  // after 0.5 s +10 u/s; pulling out after 1.0 s in it gives the slingshot, +20 u/s for 0.6 s
  SLIP_LEN: 30, SLIP_W: 6, SLIP_DEG: 15, SLIP_SPEED: 40, SLIP_AFTER_S: 0.5, SLIP_BONUS: 10, SLING_AFTER_S: 1.0,
  SLING: Object.freeze([20, 0.6]),
  // item boxes: rows of 4 across the track; a taken box comes back after 2 s; a box rolls an item for 0.8 s
  BOX_ROWS: Object.freeze([500, 2050, 3330]), BOX_X_WOMB: Object.freeze([-36, -12, 12, 36]),
  BOX_U_TUBE: Object.freeze([-21, -7, 7, 21]), BOX_R: 3.5, BOX_BACK_S: 2, ROLL_S: 0.8,
  // the items by place at the roll: [last place of the band, { item: weight }]
  ITEMS: Object.freeze([
    Object.freeze([3, Object.freeze({ shield: 40, goo: 35, spark: 25 })]),
    Object.freeze([10, Object.freeze({ spark: 35, rush: 30, shield: 25, goo: 10 })]),
    Object.freeze([20, Object.freeze({ rush: 40, glow: 30, spark: 30 })]),
  ]),
  // Spark: flies ahead at 160 u/s, homes (7 rad/s) on the nearest sperm ahead within 150 u along the track, fades
  // after 2 s; a hit spins it out for 0.8 s at ×0.3. Shield: 8 s, takes one hit. Rush: +40 u/s for 1.2 s. Goo: a blob
  // of radius 5 dropped 7 u behind you for 10 s; swimming into it slips you (×0.4 for 0.6 s).
  SPARK_SPEED: 160, SPARK_RANGE: 150, SPARK_LIFE_S: 2, SPARK_TURN: 7, SPARK_R: 1.6, SPIN_S: 0.8, SPIN_K: 0.3,
  SHIELD_S: 8, RUSH: Object.freeze([40, 1.2]), GOO_R: 5, GOO_S: 10, GOO_BACK: 7, GOO_SLIP_S: 0.6, GOO_K: 0.4,
  GOO_SAFE_S: 0.6, SPARKS_MAX: 8, GOO_MAX: 6,
  // white cells: 4 in the womb from 300 u, drifting across at 12 u/s; touching one spins you out (a shield takes it)
  CELL_N: 4, CELL_FROM: 330, CELL_GAP: 190, CELL_R: 7, CELL_SPEED: 12, CELL_SAFE_S: 1.2,
  // knockout gates: [progress, how many go through, the latest it closes (s)]; the tag shows 3 s before it can close.
  // The design's 14, 8 and 5 go through became 8, 5 and 4 (Assist 10, 7 and 5), so the gates close nearer its pace
  GATES: Object.freeze([Object.freeze([1300, 8, 30]), Object.freeze([2800, 5, 60]), Object.freeze([4000, 4, 85])]),
  GATE_WARN_S: 3, GATE_WARN_N: 3, ASSIST_QUOTAS: Object.freeze([10, 7, 5]),
  // the cool tide: from 12 s it creeps up the course from the start at 25 u/s, rising to 50 u/s at 40 s; a gate that
  // closes floods it up to TIDE_BACK behind the gate at 120 u/s; Assist ×0.8
  TIDE_T0: 12, TIDE_V0: 25, TIDE_V1: 50, TIDE_T1: 40, TIDE_FROM: -20, TIDE_FLOOD: 120, TIDE_BACK: 6, ASSIST_TIDE: 0.8,
  // the meeting place takes the first 3; once you are out the stage ends after OUT_S (and after the captions are read)
  TOP: 3, OUT_S: 1.8,
  // Assist: spin-outs of 0.5 s, your item rolls count you 3 places lower
  ASSIST_SPIN_S: 0.5, ASSIST_ROLL: 3,
  // the bots: drift from skill 0.5 (release at orange; pink at B3 and B6 from 0.9), draft from 0.4, items, boxes
  BOT_DRIFT: 0.5, BOT_PINK: 0.9, BOT_PINK_BENDS: Object.freeze([2, 5]), BOT_DRAFT: 0.4, BOT_SPARK_AHEAD: 100,
  BOT_GOO_BEHIND: 40, BOT_BOX_LOOK: 70, BOT_CELL_LOOK: 50, BOT_CELL: 0.3,
  // the view: drift confetti puffs, speed lines while boosted
  PUFF_S: 0.12, FX_MAX: 24,
});
// TUNED (race-sim.mjs over seeds 1 to 40, Assist off): the one change to a v1 number is the ladder's middle (rungs 2 to
// 9: 0.42, 0.39, 0.36, 0.33, 0.30, 0.27, 0.24, 0.22 became 0.55, 0.52, 0.49, 0.46, 0.43, 0.40, 0.37, 0.34; the rest
// eased down to meet 0.04), so the pack stays near a mid player and the gates close on it. Results: the ref arrives
// 1st in 40 of 40 at about 49 s (mean score about 9,200); the mid bot is in the top 3 in 39 of 40 at about 63 s;
// one-button held is in the top 3 in 40 of 40; idle is out by the cool tide at 13.7 s. The gate quotas went from 14, 8
// and 5 to 8, 5 and 4: the mid bot's races now close Gate 1 at about 22 s, Gate 2 at about 48 s and Gate 3 at about
// 62 s (were 28, 53 and 65 s). The design's 18, 38 and 50 s need a faster pack than the mid bot's top 3 allows: the
// mid bot itself passes the gates at about 17, 43 and 56 s, near the front, so a gate that closed at 38 or 50 s would
// shut it out in about half the seeds (quotas 8, 4 and 4 already drop it to 35 of 40). The other kart numbers are
// design.md 5.1's as written.
