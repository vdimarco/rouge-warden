// First Breath: the race sim (design.md 6.1, tasks.md 1.13). A stand-alone numeric model of stage 1, The Race: the
// womb with its waves, the gate squeeze, the fork with the cool loop, the tube with its current, upstream bonus, warm
// lane, wall slide, checkpoints and glow walls, the meeting place, 19 rivals on the skill ladder with the rival
// policy, soft bumps between every pair and the mild catch-up. It imports nothing from public/: it is a design tool
// that checks the 6.1 numbers before the swim stage is built, and swim.js may copy its rules.
//   node qa/first-breath/race-sim.mjs [--seeds=20] [--first=1] [--quiet] [--KEY=value ...]
// --KEY=value sets a TUNE number for the run (--TUBE_END=4900, --WAVE_GAP=3.4; a list as --SKILLS=0.8,0.76,...).
// Prints each seed of the ref (skill 1.0), mid (0.7) and idle players, the place distribution and arrival times,
// every rival's places and arrivals, then the 6.1 gates. Exits 1 when a gate fails.
//
// Readings where 6.1 leaves a choice (each the simplest one):
//  1. The course is straight: progress p runs along the centre line and x across it, so a bend adds no length. The
//     warm tube keeps the warm mouth's centre line (x = ±30) from the split at 1,330 u to the finish.
//  2. The grid: row 1 is the front (p = 48), row 5 the back (p = 0); the slots are x = −15, −5, 5 and 15. You sit in
//     row 3 (p = 24) at x = −5. stream(seed, "grid") shuffles the 19 skills onto the other 19 slots (Fisher–Yates).
//     Rival i is ladder rung i (0 is the 0.80 front-runner) and steers with stream(seed, "rival:" + i).
//  3. A wave's p is its front edge: wave k's front is at −20 + 140 (t − tk), and the band runs 60 u behind it. Its
//     window is |x − centre| ≤ 40. The first value of stream(seed, "wave:" + k) is the threshold, the second sets the
//     centre: (2v − 1) × 40. "Blends to 140 u/s over 0.3 s" is a ramp of 140 / 0.3 u/s² (0 to 140 in 0.3 s).
//  4. "Nearest wave" is the wave whose band is over the head, else the next one coming from behind. A bot that rides
//     it keeps its head in the middle half of its window (20 u in from each edge), so its heading noise does not
//     carry it out. A bot that does not ride it lets go (stick 0, under the 0.3 lift line) from when the wave's front
//     is 30 u behind its head until the band has passed, then swims on: the miss is real and costs about one gap.
//  5. Bonuses add to the speed along the heading; the current pushes along −p. A wall keeps 0.9 of the speed on each
//     new contact (not every step, or a sperm could not hug a wall at 63 u/s).
//  6. The cool loop is its own 160 u track: a sperm in it moves at 40 u/s + its own speed and counts as at 1,300 u.
//     It comes back in at 1,300 u on the cool side of the gate (17 u off centre), heading across toward the warm side.
//     A rival makes its cool-tube draw once, from its own stream, as it reaches the gate (1,100 u), and takes the warm
//     way after one loop, as the player is told to.
//  7. The bot's aim error (σ = 15 u × (1 − skill)) is drawn with its heading noise, every 0.5 s. Its lag is a queue in
//     r.mem: it acts on the stick it chose 150 ms × (1 − skill) earlier. In the tube it holds its heading within 20° of
//     forward, so it keeps the 25° upstream bonus apart from its noise.
//  8. Glow walls alternate from the tube's left wall (1,700 u left, 2,600 u right, 3,500 u left). A bot steers to its
//     glow from 80 u before it and lets go within 10 u. A bot that passes its glow by more than the glow's radius
//     unrested does not rest (no fallback to the next wall). Her beats run from t = 0 at 72 bpm with ±3% seeded
//     jitter (stream(seed, "beats")); a sperm counts beats after the step it attaches on.
//  9. A checkpoint hold is not a glow rest: it never makes a sperm ready. A rival that rests 500 u behind takes 2 s to
//     ease its stick to 0 toward the nearest wall, then holds still; it never counts beats.
// 10. Catch-up scales the stick term (55 × m), capped at m = 1, and never the wave lift. A bump scales the top speed,
//     the wave lift's 140 u/s included, from ×0.8 back to ×1 over 0.6 s. Bumps act in the loop too, between sperm in
//     it; never between a sperm in the loop and one outside it.
// 11. The race runs on after you arrive (you count at 4,600 u), so every rival's arrival is shown; the stage itself
//     ends 2.5 s after your arrival, so rivals start resting only while you still race. A rival's place is its rank
//     when the sim ends: arrivals by time, then progress.

const DT = 1 / 60;
const DEG = Math.PI / 180;
const ZERO = Object.freeze({ x: 0, y: 0 });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, f) => a + (b - a) * f;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------- the numbers (design.md 6.1)

const TUNE = {
  CAP_S: 117, START_S: 0.5, MEET_S: 2.5, CARRIED_S: 3,
  // swim
  SWIM: 55, ACCEL: 120, DRAG: 1.8, TURN: 3.0, READY_X: 1.6,
  // the course
  WOMB_END: 1100, WOMB_HALF: 80, GATE_END: 1250, GATE_HALF: 20, FORK: 1300, SPLIT: 1330, MOUTH: 60,
  TUBE_START: 1400, TUBE_END: 4600, TUBE_HALF: 30,
  // waves
  WAVE_T0: 1.2, WAVE_GAP: 3.2, WAVE_FROM: -20, WAVE_THICK: 60, WAVE_SPEED: 140, WAVE_HALF: 40, WAVE_SPREAD: 40,
  WAVE_BLEND_S: 0.3, WAVE_STICK: 0.3, WAVE_DEG: 45,
  // the cool loop
  LOOP_LEN: 160, LOOP_FLOW: 40, LOOP_HALF: 20,
  // the tube
  CURRENT: 22, UP_BONUS: 18, UP_DEG: 25, LANE_W: 30, LANE_DRIFT: 12, LANE_HZ: 0.1, LANE_BONUS: 12, WALL_KEEP: 0.9,
  GLOWS: [1700, 2600, 3500], GLOW_R: 20, ATTACH_STICK: 0.25, READY_BEAT: 4, BPM: 72, JITTER: 0.03,
  CHECKS: [1400, 2200, 3000, 3800],
  // bumps
  HEAD_R: 3, SWIM_STICK: 0.25, SWIM_SPEED: 15, BUMP_KEEP: 0.7, BUMP_TOP: 0.8, BUMP_EASE_S: 0.6, BUMP_GAP_S: 0.4,
  // rivals
  SKILLS: [0.80, 0.76, 0.42, 0.39, 0.36, 0.33, 0.30, 0.27, 0.24, 0.22, 0.20, 0.18, 0.16, 0.14, 0.12, 0.10, 0.08, 0.06,
    0.04],
  FRONT: 2, COOL: 0.5, REST_BEHIND: 500, REST_SLOW_S: 2, CATCH_AHEAD: 0.10, CATCH_BEHIND: 0.06, CATCH_SPAN: 400,
  // bot steering
  M0: 0.4, M1: 0.6, RIDE0: 0.3, RIDE1: 0.7, AIM_SD: 15, NOISE_DEG: 30, NOISE_EVERY_S: 0.5, LAG_S: 0.15, SEP: 12,
  LET_GO: 10, GLOW_LOOK: 80, REST_1: 0.75, REST_2: 0.4, MISS_AHEAD: 30, RIDE_IN: 20,
};

// ---------------------------------------------------------------- seeded random (the core/rng.js contract, 16.2)

const TE = new TextEncoder();
function fnv1a(str) {
  const b = TE.encode(str);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const stream = (seed, name) => mulberry(fnv1a(String(seed) + ':' + name));
// standard normal, Box–Muller with no caching
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

// ---------------------------------------------------------------- the course

// half the passage width at progress p, before the split
function halfAt(T, p) {
  if (p < T.WOMB_END) return T.WOMB_HALF;
  if (p < T.GATE_END) return lerp(T.WOMB_HALF, T.GATE_HALF, (p - T.WOMB_END) / (T.GATE_END - T.WOMB_END));
  if (p < T.FORK) return T.GATE_HALF;
  return lerp(T.GATE_HALF, T.MOUTH, clamp((p - T.FORK) / (T.SPLIT - T.FORK), 0, 1));
}
const laneAt = (T, t) => T.LANE_DRIFT * Math.sin(2 * Math.PI * T.LANE_HZ * t);   // lane centre, from the tube centre
const glowSide = (i) => (i % 2 === 0 ? -1 : 1);                                  // left, right, left
const waveStart = (T, k) => T.WAVE_T0 + T.WAVE_GAP * k;
const waveFront = (T, k, t) => T.WAVE_FROM + T.WAVE_SPEED * (t - waveStart(T, k));

// the wave whose front passed p most recently (−1 for none yet)
function waveBehind(T, t, p) {
  return Math.floor((t - (p - T.WAVE_FROM) / T.WAVE_SPEED - T.WAVE_T0) / T.WAVE_GAP);
}
// the wave whose band holds p, or −1
function waveOver(T, t, p) {
  const k = waveBehind(T, t, p);
  return k >= 0 && waveFront(T, k, t) - T.WAVE_THICK <= p ? k : -1;
}
// the wave over p, else the next one to come from behind
function waveNear(T, t, p) {
  const k = waveOver(T, t, p);
  return k >= 0 ? k : Math.max(0, waveBehind(T, t, p) + 1);
}

// ---------------------------------------------------------------- the field

function makeSperm(T, id, kind, skill, slot, r) {
  return {
    id, kind, skill, r, m: kind === 'idle' ? 0 : T.M0 + T.M1 * skill,
    x: slot.x, p: slot.p, th: 0, s: 0, stick: ZERO, mag: 0, catchF: 1,
    zone: 'path', loopS: 0, loopW: 0, lastCheck: -Infinity, touch: false,
    attached: null, glow: -1, beatIx: 0, beats: 0, ready: false, readyAt: null,
    bumpAt: -Infinity, bumps: 0, rest: null, plan: null, loops: 0,
    arrived: false, arriveT: null, maxP: slot.p,
    waves: new Set(), rideS: 0, laneS: 0, tubeS: 0, at1100: null, at1400: null,
  };
}

export function createRace(seed, player, T = TUNE) {
  const slots = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) slots.push({ x: -15 + 10 * col, p: 48 - 12 * row });
  const youSlot = 2 * 4 + 1;
  const free = slots.filter((_, i) => i !== youSlot);
  const order = T.SKILLS.map((_, i) => i);
  const g = stream(seed, 'grid');
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(g() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const rivals = order.map((rung, k) => {
    const r = stream(seed, 'rival:' + rung);
    r.mem = {};
    return makeSperm(T, rung, 'rival', T.SKILLS[rung], free[k], r);
  }).sort((a, b) => a.id - b.id);
  const ry = stream(seed, 'you');
  ry.mem = {};
  const you = makeSperm(T, -1, player.kind, player.skill, slots[youSlot], ry);
  const nWaves = Math.ceil((T.CAP_S + 5) / T.WAVE_GAP) + 4;
  const thr = new Float64Array(nWaves), cen = new Float64Array(nWaves);
  for (let k = 0; k < nWaves; k++) {
    const r = stream(seed, 'wave:' + k);
    thr[k] = r();
    cen[k] = (2 * r() - 1) * T.WAVE_SPREAD;
  }
  const rb = stream(seed, 'beats'), beats = [];
  for (let b = 0; b < T.CAP_S + 10; b += (60 / T.BPM) * (1 + T.JITTER * (2 * rb() - 1))) beats.push(b);
  const warm = stream(seed, 'fork')() < 0.5 ? -1 : 1;
  return { T, seed, player, t: 0, you, rivals, all: [you, ...rivals], thr, cen, beats, warm, place: null };
}

const progOf = (w, sp) => (sp.arrived ? w.T.TUBE_END : sp.zone === 'loop' ? w.T.FORK : sp.p);
const swimming = (T, sp) => !sp.arrived && !sp.attached && (sp.mag >= T.SWIM_STICK || sp.s >= T.SWIM_SPEED);

// ---------------------------------------------------------------- steering (botSteer, also the rivals' policy)

// Reynolds separation: a lateral shift away from the nearest swimming sperm within 12 u ahead
function separation(w, sp) {
  const T = w.T;
  let best = null, bd = T.SEP;
  for (const o of w.all) {
    if (o === sp || o.zone === 'loop' || !swimming(T, o)) continue;
    const dp = o.p - sp.p;
    if (dp <= 0) continue;
    const d = Math.hypot(o.x - sp.x, dp);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return 0;
  const sgn = best.x === sp.x ? (sp.id & 1 ? 1 : -1) : Math.sign(sp.x - best.x);
  return sgn * (T.SEP - bd);
}

// The stick this step, before the lag: pick = { side: the mouth it takes (±1), wall: the glow it rests on, or −1 }.
function aimNow(w, sp, skill, pick, mem) {
  const T = w.T, m = T.M0 + T.M1 * skill;
  if (sp.attached === 'glow' && !sp.ready) return ZERO;
  if (sp.zone === 'loop') return { x: 0, y: m };
  let tx, look, lim;
  if (sp.zone === 'path' && sp.p < T.WOMB_END) {
    const k = waveNear(T, w.t, sp.p), c = w.cen[k], h = T.WAVE_HALF;
    if (w.thr[k] < T.RIDE0 + T.RIDE1 * skill) tx = clamp(sp.x, c - h + T.RIDE_IN, c + h - T.RIDE_IN);
    else if (waveFront(T, k, w.t) >= sp.p - T.MISS_AHEAD) return ZERO;   // a wave it misses: let go as it passes
    else tx = sp.x;
    look = 40; lim = 40 * DEG;
  } else if (sp.zone === 'path') {
    tx = pick.side * clamp(halfAt(T, sp.p + 30) - 8, 0, T.TUBE_HALF);
    look = 30; lim = 60 * DEG;
  } else {
    const xc = w.warm * T.TUBE_HALF;
    if (pick.wall >= 0 && !sp.ready && !mem.passed) {
      const gp = T.GLOWS[pick.wall];
      if (sp.p > gp + T.GLOW_R) mem.passed = true;
      else if (sp.p >= gp - T.GLOW_LOOK) {
        const dx = xc + glowSide(pick.wall) * T.TUBE_HALF - sp.x, dp = gp - sp.p;
        if (Math.hypot(dx, dp) <= T.LET_GO) return ZERO;
        const a = Math.atan2(dx, dp) + mem.noise;
        return { x: Math.sin(a) * m, y: Math.cos(a) * m };
      }
    }
    tx = xc + laneAt(T, w.t) + mem.aim;
    look = 40; lim = 20 * DEG;
  }
  tx += separation(w, sp);
  const a = clamp(Math.atan2(tx - sp.x, look), -lim, lim) + mem.noise;
  return { x: Math.sin(a) * m, y: Math.cos(a) * m };
}

function botSteer(w, sp, skill, r, pick) {
  const T = w.T, t = w.t, mem = r.mem;
  if (mem.next === undefined) Object.assign(mem, { next: 0, noise: 0, aim: 0, q: [], passed: false });
  if (t >= mem.next - 1e-9) {
    mem.next = t + T.NOISE_EVERY_S;
    mem.noise = gauss(r) * T.NOISE_DEG * DEG * (1 - skill);
    mem.aim = gauss(r) * T.AIM_SD * (1 - skill);
  }
  const out = t < T.START_S - 1e-9 ? ZERO : aimNow(w, sp, skill, pick, mem);
  const lag = T.LAG_S * (1 - skill);
  if (lag <= 1e-9) return out;
  mem.q.push({ t, out });
  while (mem.q.length > 1 && mem.q[1].t <= t - lag + 1e-9) mem.q.shift();
  return mem.q[0].t <= t - lag + 1e-9 ? mem.q[0].out : ZERO;
}

function steer(w, sp) {
  const T = w.T;
  if (sp.kind === 'idle') return ZERO;
  if (sp.kind === 'fixed') return w.player.steer(w, sp);
  if (sp.kind !== 'rival') {
    const wall = w.player.wall ?? (sp.skill >= T.REST_1 ? 0 : sp.skill >= T.REST_2 ? 1 : -1);
    return botSteer(w, sp, sp.skill, sp.r, { side: w.warm, wall });
  }
  // the three rival choices: the cool tube, glow rests for the front-runners only, resting far behind
  if (sp.plan === null && sp.p >= T.WOMB_END) sp.plan = sp.r() < T.COOL * (1 - sp.skill) ? 'cool' : 'warm';
  if (sp.rest !== null) {
    const f = Math.max(0, 1 - (w.t - sp.rest) / T.REST_SLOW_S);
    const dir = sp.x >= w.warm * T.TUBE_HALF ? 1 : -1;
    return { x: dir * 0.9 * sp.m * f, y: 0.44 * sp.m * f };
  }
  const side = sp.plan === 'cool' && sp.loops === 0 ? -w.warm : w.warm;
  return botSteer(w, sp, sp.skill, sp.r, { side, wall: sp.id < T.FRONT ? 0 : -1 });
}

// ---------------------------------------------------------------- moving

function speedTo(T, s, target) {
  if (s < target) return Math.min(target, s + T.ACCEL * DT);
  return target + (s - target) * Math.exp(-T.DRAG * DT);
}

function walls(w, sp) {
  const T = w.T, R = T.HEAD_R;
  let lo, hi;
  if (sp.zone === 'tube') { lo = w.warm > 0 ? R : -2 * T.TUBE_HALF + R; hi = lo + 2 * T.TUBE_HALF - 2 * R; }
  else { hi = halfAt(T, sp.p) - R; lo = -hi; }
  let touch = false;
  if (sp.x < lo) { sp.x = lo; touch = true; } else if (sp.x > hi) { sp.x = hi; touch = true; }
  if (touch && !sp.touch) sp.s *= T.WALL_KEEP;
  sp.touch = touch;
  if (sp.p < T.WAVE_FROM + R) sp.p = T.WAVE_FROM + R;
  if (sp.zone === 'tube' && sp.p < sp.lastCheck) sp.p = sp.lastCheck;
}

function attach(w, sp, kind, glow = -1) {
  if (sp.rest !== null) kind = 'rest';
  sp.attached = kind;
  sp.s = 0;
  sp.glow = kind === 'glow' ? glow : -1;
  if (kind === 'glow') {
    sp.beats = 0;
    sp.beatIx = 0;
    while (sp.beatIx < w.beats.length && w.beats[sp.beatIx] <= w.t + DT) sp.beatIx++;
  }
}

function move(w, sp) {
  const T = w.T, t = w.t, st = sp.stick, mag = Math.min(1, Math.hypot(st.x, st.y));
  sp.mag = mag;
  if (sp.attached) {
    if (sp.attached !== 'rest' && mag >= T.ATTACH_STICK) { sp.attached = null; sp.glow = -1; }
    else {
      // her beats while on a glow: ready on the 4th
      if (sp.attached === 'glow') {
        while (sp.beatIx < w.beats.length && w.beats[sp.beatIx] <= t + DT) {
          sp.beats++;
          if (sp.beats === T.READY_BEAT && !sp.ready) { sp.ready = true; sp.readyAt = w.beats[sp.beatIx]; sp.readyWall = sp.glow; }
          sp.beatIx++;
        }
      }
      return;
    }
  }
  if (mag > 1e-9) {
    const d = wrapA(Math.atan2(st.x, st.y) - sp.th), turn = T.TURN * DT;
    sp.th = wrapA(sp.th + clamp(d, -turn, turn));
  }
  const top = T.BUMP_TOP + (1 - T.BUMP_TOP) * clamp((t - sp.bumpAt) / T.BUMP_EASE_S, 0, 1);
  const term = sp.catchF > 1 ? Math.min(1, mag * sp.catchF) : mag * sp.catchF;
  const target = T.SWIM * term * (sp.ready ? T.READY_X : 1) * top;
  if (sp.zone === 'loop') {
    sp.s = speedTo(T, sp.s, target);
    sp.loopS += (T.LOOP_FLOW + sp.s) * DT;
    if (sp.loopS >= T.LOOP_LEN) {
      // back at the fork, coming in from the cool side
      sp.zone = 'path';
      sp.p = T.FORK;
      sp.x = -w.warm * (T.GATE_HALF - T.HEAD_R);
      sp.th = w.warm * Math.PI / 2;
      sp.touch = true;
      sp.loops++;
    }
    return;
  }
  // a wave lifts a sperm that swims with it
  let lifted = false;
  if (sp.zone === 'path' && sp.p < T.WOMB_END && mag >= T.WAVE_STICK && Math.abs(sp.th) <= T.WAVE_DEG * DEG) {
    const k = waveOver(T, t, sp.p);
    if (k >= 0 && Math.abs(sp.x - w.cen[k]) <= T.WAVE_HALF) { lifted = true; sp.waves.add(k); }
  }
  if (lifted) {
    const L = T.WAVE_SPEED * top;
    sp.s = sp.s < L ? Math.min(L, sp.s + (T.WAVE_SPEED / T.WAVE_BLEND_S) * DT) : L;
    sp.rideS += DT;
  } else sp.s = speedTo(T, sp.s, target);
  let along = sp.s, cur = 0;
  if (sp.zone === 'tube' && sp.p >= T.TUBE_START) {
    const u = sp.x - w.warm * T.TUBE_HALF, rr = Math.min(1, Math.abs(u) / T.TUBE_HALF);
    const lane = Math.abs(u - laneAt(T, t)) <= T.LANE_W / 2;
    cur = T.CURRENT * (0.3 + 0.7 * (1 - rr * rr)) * (lane ? 0.5 : 1);
    if (Math.abs(sp.th) <= T.UP_DEG * DEG) along += T.UP_BONUS;
    if (lane) { along += T.LANE_BONUS; sp.laneS += DT; }
    sp.tubeS += DT;
  }
  const p0 = sp.p;
  sp.x += along * Math.sin(sp.th) * DT;
  sp.p += (along * Math.cos(sp.th) - cur) * DT;
  // the split: the side of the head picks the tube
  if (sp.zone === 'path' && sp.p >= T.SPLIT) {
    if (sp.x * w.warm > 0) { sp.zone = 'tube'; sp.lastCheck = T.SPLIT; }
    else {
      sp.zone = 'loop';
      sp.loopS = sp.p - T.SPLIT;
      sp.loopW = clamp(sp.x + w.warm * T.TUBE_HALF, -(T.LOOP_HALF - T.HEAD_R), T.LOOP_HALF - T.HEAD_R);
      sp.p = T.FORK;
      return;
    }
  }
  if (sp.zone === 'tube') {
    for (const c of T.CHECKS) if (sp.p >= c && c > sp.lastCheck) sp.lastCheck = c;
    if (sp.p < sp.lastCheck) { sp.p = sp.lastCheck; if (mag < T.ATTACH_STICK) attach(w, sp, 'check'); }
  }
  walls(w, sp);
  if (sp.zone === 'tube' && !sp.attached && mag < T.ATTACH_STICK) {
    const xc = w.warm * T.TUBE_HALF;
    T.GLOWS.forEach((gp, i) => {
      if (!sp.attached && Math.hypot(sp.x - (xc + glowSide(i) * T.TUBE_HALF), sp.p - gp) < T.GLOW_R) attach(w, sp, 'glow', i);
    });
  }
  if (sp.at1100 === null && sp.p >= T.WOMB_END) sp.at1100 = t + DT;
  if (sp.at1400 === null && sp.p >= T.TUBE_START) sp.at1400 = t + DT;
  if (sp.zone === 'tube' && sp.p >= T.TUBE_END) {
    sp.arrived = true;
    sp.arriveT = t + DT * clamp((T.TUBE_END - p0) / Math.max(1e-9, sp.p - p0), 0, 1);
  }
  sp.maxP = Math.max(sp.maxP, sp.p);
}

// soft bumps: circle against circle, pushed apart every step, the speed loss at most once per 0.4 s
function bumps(w) {
  const T = w.T, D = 2 * T.HEAD_R, list = w.all.filter((sp) => swimming(T, sp));
  const hit = new Set();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], L = a.zone === 'loop';
      if (L !== (b.zone === 'loop')) continue;
      let dx = L ? b.loopW - a.loopW : b.x - a.x, dp = L ? b.loopS - a.loopS : b.p - a.p;
      const d = Math.hypot(dx, dp);
      if (d >= D) continue;
      if (d < 1e-9) { dx = a.id < b.id ? 1 : -1; dp = 0; } else { dx /= d; dp /= d; }
      const push = (D - d) / 2;
      if (L) { a.loopW -= dx * push; a.loopS -= dp * push; b.loopW += dx * push; b.loopS += dp * push; }
      else { a.x -= dx * push; a.p -= dp * push; b.x += dx * push; b.p += dp * push; }
      for (const s of [a, b]) {
        hit.add(s);
        if (w.t - s.bumpAt >= T.BUMP_GAP_S - 1e-9) { s.s *= T.BUMP_KEEP; s.bumpAt = w.t; s.bumps++; }
      }
    }
  }
  for (const s of hit) {
    if (s.zone === 'loop') s.loopW = clamp(s.loopW, -(T.LOOP_HALF - T.HEAD_R), T.LOOP_HALF - T.HEAD_R);
    else walls(w, s);
  }
}

export function stepRace(w) {
  const T = w.T, you = w.you, yp = progOf(w, you);
  // catch-up and resting, from the gap to you by progress
  for (const sp of w.rivals) {
    if (sp.arrived) continue;
    const g = progOf(w, sp) - yp;
    sp.catchF = g > 0 ? 1 - T.CATCH_AHEAD * clamp(g / T.CATCH_SPAN, 0, 1)
      : swimming(T, sp) ? 1 + T.CATCH_BEHIND * clamp(-g / T.CATCH_SPAN, 0, 1) : 1;
    if (sp.rest === null && !you.arrived && sp.zone === 'tube' && -g >= T.REST_BEHIND) sp.rest = w.t;
  }
  for (const sp of w.all) if (!sp.arrived) sp.stick = steer(w, sp);
  for (const sp of w.all) if (!sp.arrived) move(w, sp);
  bumps(w);
  w.t += DT;
  for (const sp of w.rivals) {
    if (sp.rest !== null && !sp.arrived && sp.attached !== 'rest' && w.t - sp.rest >= T.REST_SLOW_S - 1e-9) attach(w, sp, 'rest');
  }
  if (you.arrived && w.place === null) w.place = 1 + w.rivals.filter((o) => o.arrived && o.arriveT < you.arriveT).length;
}

// one race to the cap → { you: {...}, rivals: [...] }
export function race(seed, player, T = TUNE) {
  const w = createRace(seed, player, T);
  const steps = Math.round(T.CAP_S / DT);
  for (let n = 0; n < steps; n++) {
    stepRace(w);
    if (w.all.every((sp) => sp.arrived || sp.attached === 'rest' || (sp === w.you && sp.kind === 'idle'))) break;
  }
  const you = w.you, yp = progOf(w, you);
  const place = w.place ?? 1 + w.rivals.filter((o) => o.arrived || progOf(w, o) > yp).length;
  const ranked = [...w.all].sort((a, b) => (a.arrived !== b.arrived ? (a.arrived ? -1 : 1)
    : a.arrived ? a.arriveT - b.arriveT : progOf(w, b) - progOf(w, a)));
  const sum = (sp) => ({
    id: sp.id, skill: sp.skill, place: ranked.indexOf(sp) + 1, arriveT: sp.arriveT, maxP: sp.maxP,
    rested: sp.rest !== null, loops: sp.loops, ready: sp.ready, readyAt: sp.readyAt, readyWall: sp.readyWall ?? -1,
    waves: sp.waves.size, wave0: sp.waves.has(0), rideS: sp.rideS, bumps: sp.bumps, at1100: sp.at1100,
    at1400: sp.at1400, lane: sp.tubeS > 0 ? sp.laneS / sp.tubeS : 0,
  });
  const out = sum(you);
  out.place = place;
  out.capped = !you.arrived;
  out.endS = you.arrived ? you.arriveT + T.MEET_S : T.CAP_S + T.CARRIED_S;
  return { seed, warm: w.warm, you: out, rivals: w.rivals.map(sum) };
}

// ---------------------------------------------------------------- the report

const PLAYERS = [
  { name: 'ref', kind: 'bot', skill: 1.0 },
  { name: 'mid', kind: 'bot', skill: 0.7 },
  { name: 'idle', kind: 'idle', skill: 0 },
];

const f1 = (v) => (v === null || v === undefined ? '  –  ' : v.toFixed(1).padStart(5));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : NaN; };
const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function dist(places) {
  const c = new Map();
  for (const p of places) c.set(p, (c.get(p) || 0) + 1);
  return [...c.keys()].sort((a, b) => a - b).map((p) => `${ord(p)} ×${c.get(p)}`).join(', ');
}
const span = (a) => (a.length ? `${Math.min(...a).toFixed(1)} / ${mean(a).toFixed(1)} / ${Math.max(...a).toFixed(1)} s` : 'none');

function report(name, player, runs, quiet) {
  const T = runs.T;
  console.log(`\n${name} (skill ${player.skill.toFixed(1)}, m ${(player.kind === 'idle' ? 0 : T.M0 + T.M1 * player.skill).toFixed(2)})`);
  if (!quiet) {
    console.log('  seed warm place arrive waves w0 ride  1100  1400  ready wall lane bumps cool');
    for (const r of runs) {
      const y = r.you;
      console.log(`  ${String(r.seed).padStart(4)} ${r.warm > 0 ? '  R ' : '  L '} ${String(y.place).padStart(5)} ${y.capped ? ' cap ' : f1(y.arriveT)}`
        + `  ${String(y.waves).padStart(4)}  ${y.wave0 ? 'y' : 'n'} ${f1(y.rideS)} ${f1(y.at1100)} ${f1(y.at1400)} ${f1(y.readyAt)}`
        + `  ${y.readyWall >= 0 ? y.readyWall + 1 : '–'}  ${y.lane.toFixed(2)} ${String(y.bumps).padStart(5)} ${String(y.loops).padStart(4)}`);
    }
  }
  const arr = runs.filter((r) => !r.you.capped).map((r) => r.you.arriveT);
  console.log(`  places: ${dist(runs.map((r) => r.you.place))}`);
  console.log(`  arrival min / mean / max: ${span(arr)} (${arr.length} of ${runs.length} arrived; mean wave ride ${mean(runs.map((r) => r.you.rideS)).toFixed(1)} s)`);
  console.log('  rivals: skill  places (min / median / max)  arrived  arrival min / mean / max   rested  cool  ready  past gate');
  for (let i = 0; i < T.SKILLS.length; i++) {
    const rs = runs.map((r) => r.rivals[i]);
    const pl = rs.map((x) => x.place), at = rs.filter((x) => x.arriveT !== null).map((x) => x.arriveT);
    console.log(`        ${T.SKILLS[i].toFixed(2)}  ${String(Math.min(...pl)).padStart(2)} / ${String(median(pl)).padStart(2)} / ${String(Math.max(...pl)).padStart(2)}`
      + `              ${String(at.length).padStart(2)}       ${span(at).padEnd(22)}    ${String(rs.filter((x) => x.rested).length).padStart(2)}`
      + `    ${String(rs.filter((x) => x.loops > 0).length).padStart(2)}     ${String(rs.filter((x) => x.ready).length).padStart(2)}`
      + `     ${String(rs.filter((x) => x.maxP >= T.FORK).length).padStart(2)}`);
  }
}

// The hand numbers of 6.1, measured on this model with no rivals: the lane against the walls, the cool loop, the
// glow rest and its trade, and a clean wave ride. They show the model matches the design before the race does.
function solo(T, player, seed, setup, seconds) {
  const w = createRace(seed, player, { ...T, SKILLS: [] });
  if (setup) setup(w, w.you);
  const n = Math.round(seconds / DT), trace = [];
  for (let i = 0; i < n && !w.you.arrived; i++) { const p0 = w.you.p; stepRace(w); trace.push((w.you.p - p0) / DT); }
  return { w, you: w.you, trace };
}

function calibrate(T, seeds) {
  const lines = [];
  const inTube = (p, x) => (w, y) => { y.zone = 'tube'; y.p = p; y.lastCheck = p; y.x = w.warm * T.TUBE_HALF + x(w); y.s = T.SWIM; y.th = 0; };
  // full stick in the lane (steering to its centre, as the ref bot does) and straight along each wall
  const lane = solo(T, { kind: 'fixed', steer: (w, y) => {
    const a = clamp(Math.atan2(w.warm * T.TUBE_HALF + laneAt(T, w.t) - y.x, 40), -20 * DEG, 20 * DEG);
    return { x: Math.sin(a), y: Math.cos(a) };
  } }, 1, inTube(2200, (w) => laneAt(T, 0)), 10);
  const wallRun = (side) => solo(T, { kind: 'fixed', steer: () => ({ x: 0, y: 1 }) }, 1,
    inTube(2200, () => side * (T.TUBE_HALF - T.HEAD_R)), 10).trace;
  const walls2 = [...wallRun(-1), ...wallRun(1)];
  const laneMean = mean(lane.trace), wallMean = mean(walls2);
  lines.push(`forward speed at full stick, unready: ${laneMean.toFixed(1)} u/s in the lane (min ${Math.min(...lane.trace).toFixed(1)}),`
    + ` ${wallMean.toFixed(1)} u/s along a wall (max ${Math.max(...walls2).toFixed(1)}, the moment the lane's edge touches it)`);
  // the cool loop, idle and at full stick
  const loopT = (stick, s0) => {
    const w = createRace(1, { kind: 'fixed', steer: () => stick }, { ...T, SKILLS: [] });
    Object.assign(w.you, { zone: 'loop', p: T.FORK, loopS: 0, s: s0 });
    while (!w.you.loops && w.t < 10) stepRace(w);
    return w.t;
  };
  lines.push(`cool loop back at the fork after ${loopT(ZERO, 0).toFixed(2)} s idle, ${loopT({ x: 0, y: 1 }, T.SWIM).toFixed(2)} s at full stick`);
  // the glow rest: her 4th beat after letting go
  const w0 = createRace(1, { kind: 'idle', skill: 0 }, T), waits = [];
  for (let ta = 1; ta < 100; ta += 0.05) {
    let j = 0;
    while (w0.beats[j] <= ta) j++;
    waits.push(w0.beats[j + T.READY_BEAT - 1] - ta);
  }
  lines.push(`ready ${Math.min(...waits).toFixed(2)} to ${Math.max(...waits).toFixed(2)} s after letting go on a glow`);
  // the rest trade, alone on the course: arrival with each glow wall, and with no rest
  for (const skill of [1.0, 0.7]) {
    const row = [-1, 0, 1, 2].map((wall) => {
      const runs = seeds.map((sd) => solo(T, { kind: 'bot', skill, wall }, sd, null, T.CAP_S).you);
      return { wall, arr: mean(runs.map((y) => y.arriveT ?? T.CAP_S)), at1100: mean(runs.map((y) => y.at1100 ?? NaN)) };
    });
    const none = row[0].arr;
    lines.push(`alone, skill ${skill.toFixed(1)}: 1,100 u at ${row[0].at1100.toFixed(1)} s; arrival ${none.toFixed(1)} s with no rest, `
      + row.slice(1).map((r) => `${r.arr.toFixed(1)} s resting at wall ${r.wall + 1} (${(none - r.arr >= 0 ? '−' : '+') + Math.abs(none - r.arr).toFixed(1)} s)`).join(', '));
  }
  console.log('\nthe model alone (6.1 hand numbers)');
  for (const l of lines) console.log('  ' + l);
}

function parseArgs(argv) {
  const T = { ...TUNE }, opt = { seeds: 20, first: 1, quiet: false };
  for (const a of argv) {
    const m = /^--([A-Za-z0-9_]+)(?:=(.*))?$/.exec(a);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'seeds' || k === 'first') opt[k] = Number(v);
    else if (k === 'quiet') opt.quiet = true;
    else if (k in T) {
      T[k] = Array.isArray(TUNE[k]) ? v.split(',').map(Number) : Number(v);
      opt.over = (opt.over ? opt.over + ' ' : '') + `${k}=${v}`;
    } else { console.error(`unknown flag --${k}`); process.exit(2); }
  }
  return { T, opt };
}

function main() {
  const { T, opt } = parseArgs(process.argv.slice(2));
  const seeds = Array.from({ length: opt.seeds }, (_, i) => opt.first + i);
  console.log(`First Breath race sim: ${seeds.length} seeds (${seeds[0]} to ${seeds[seeds.length - 1]}), overrides: ${opt.over || 'none'}`);
  console.log(`course: womb to ${T.WOMB_END} u, gate ${T.GATE_HALF * 2} u to ${T.FORK} u, tube ${T.TUBE_START} to ${T.TUBE_END} u; waves every ${T.WAVE_GAP} s; cap ${T.CAP_S} s`);
  const all = {};
  for (const pl of PLAYERS) {
    const runs = seeds.map((s) => race(s, pl, T));
    runs.T = T;
    all[pl.name] = runs;
    report(pl.name, pl, runs, opt.quiet);
  }
  calibrate(T, seeds);
  // the 6.1 gates
  const n = seeds.length, need = Math.ceil(n * 0.9);
  const ref = all.ref, mid = all.mid, idle = all.idle;
  const refArr = ref.filter((r) => !r.you.capped).map((r) => r.you.arriveT);
  const midArr = mid.filter((r) => !r.you.capped).map((r) => r.you.arriveT);
  const allRuns = [...ref, ...mid, ...idle];
  const readyRivals = allRuns.flatMap((r) => r.rivals.filter((x) => x.ready));
  const gates = [
    [ref.filter((r) => r.you.place === 1).length >= need, `ref 1st in ${ref.filter((r) => r.you.place === 1).length} of ${n} seeds (need ${need})`],
    [refArr.length === n && refArr.every((a) => a >= 44 && a <= 54), `ref arrivals ${span(refArr)} (need every one at 44 to 54 s)`],
    [mid.filter((r) => r.you.place <= 3).length >= need, `mid in the top 3 in ${mid.filter((r) => r.you.place <= 3).length} of ${n} seeds (need ${need})`],
    [midArr.length === n && mean(midArr) >= 55 && mean(midArr) <= 65, `mid mean arrival ${mean(midArr).toFixed(1)} s (need 55 to 65 s)`],
    [idle.every((r) => r.you.maxP < T.WOMB_END && r.you.place === n && r.you.capped),
      `idle never reaches the gate (max ${Math.max(...idle.map((r) => r.you.maxP)).toFixed(0)} u), 20th at the cap in every seed`],
    [idle.every((r) => r.rivals.every((x) => x.maxP >= T.FORK)), 'every rival passes the gate in the idle runs'],
    [allRuns.every((r) => (r.you.arriveT === null || r.you.arriveT <= T.CAP_S) && r.you.endS <= 120 + 1e-9),
      `no arrival past the ${T.CAP_S} s cap; the stage ends by ${Math.max(...allRuns.map((r) => r.you.endS)).toFixed(1)} s (need ≤ 120)`],
    [readyRivals.every((x) => x.id < T.FRONT) && allRuns.every((r) => r.rivals.filter((x) => x.ready).length + (r.you.ready ? 1 : 0) <= 3),
      `only the two front-runners among the rivals become ready (${readyRivals.length} rival readies in ${allRuns.length} races)`],
  ];
  console.log('\ngates');
  for (const [ok, line] of gates) console.log(`  ${ok ? 'PASS' : 'FAIL'} ${line}`);
  const failed = gates.filter(([ok]) => !ok).length;
  if (failed) { console.log(`FAIL race-sim: ${failed} gate(s)`); process.exit(1); }
  console.log('PASS race-sim');
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
