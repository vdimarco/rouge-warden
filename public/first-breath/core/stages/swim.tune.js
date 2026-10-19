// First Breath: stage 1, The Race (`swim`), its numbers (design.md 6.1). Units are u (the short screen axis is 100 u
// at span 100) and seconds. The race numbers keep the names and values of qa/first-breath/race-sim.mjs, which checked
// them against the 6.1 gates before this stage was built; stage-swim.test.mjs reads that file's TUNE block and fails
// if a shared number drifts. The rest (assist, camera, captions, the cool loop's drawn shape) is the stage's own.
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
  // rivals: the skill ladder (rung 0 and 1 are the front-runners), the cool-tube chance 0.5 (1 − skill), resting
  // 500 u behind you after a 2 s slow-down, the mild catch-up over 400 u
  SKILLS: Object.freeze([0.80, 0.76, 0.42, 0.39, 0.36, 0.33, 0.30, 0.27, 0.24, 0.22, 0.20, 0.18, 0.16, 0.14, 0.12, 0.10,
    0.08, 0.06, 0.04]),
  FRONT: 2, COOL: 0.5, REST_BEHIND: 500, REST_SLOW_S: 2, CATCH_AHEAD: 0.10, CATCH_BEHIND: 0.06, CATCH_SPAN: 400,
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
});
