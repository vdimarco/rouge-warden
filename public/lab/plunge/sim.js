// Take the Plunge: the rules. A loon flies south ahead of winter, over land and lakes. Holding tucks the wings (dive),
// letting go spreads them (glide). A lake hit steep and tucked keeps its speed and slings you back up out of the water;
// a flat or open-winged landing is a belly-flop.
//
// The sim is exact: the same seed and the same inputs give the same run in every browser, so a ghost recorded on an
// iPhone replays on Android. So the step uses only + − × ÷ and sqrt (the spec rounds these exactly), compares angles as
// slopes, and builds the land from integer hashes. Math.sin, exp, pow, hypot and atan2 may differ between engines in
// the last bit, so they stay out of this file. No DOM here: qa/lab/plunge.sim.mjs imports it in Node.
import { hash01 } from "../kit/rng.js";

export const H = 1 / 120;
export const T = {
  G: 9.8,
  TUCK_G: 14.7,        // tucked: an extra 1.5 g down, so a dive bites
  LIFT_K: 0.0157,      // open wings: lift = k·v², so level flight at about 25 m/s
  LIFT_MAX: 21.56,     // at most 2.2 g of lift
  DRAG_OPEN: 0.0022, DRAG_TUCK: 0.004,
  CEIL0: 90, CEIL1: 140,   // thin air: lift fades out between these heights
  FLOCK_LIFT: 0.02, FLOCK_MAX: 12,   // each loon in your V gives 2% more lift (drafting)
  // an entry is judged by its slope, down/forward: tan 62°, 45°, 25° and 12°
  S_PERFECT: 1.8807, S_RIP: 1.0, S_SPLASH: 0.4663, S_SKIP: 0.2126,
  K_PERFECT: 0.98, K_RIP: 0.95, K_SPLASH: 0.75, K_FLOP: 0.4,
  SKIP_VY: 0.3, SKIP_VX: 0.7,
  S_CLIMB: 0.8391,     // tan 40°: past this climb, open wings stop bending the path up (no loops)
  FLAP_A: 5, V_FLAP: 16,   // open wings flap a slow loon forward: up to 5 m/s², fading out at 16 m/s
  HOP_LAND: 7,             // a thud bounces you at least this fast back into the air
  // Under water the loon swoops: its wings bend the dive forward and up (a J), tighter with open wings, until it
  // climbs at 50°. The bend changes the direction only, so the dive's speed carries through. Buoyancy helps a little.
  K_SWOOP_OPEN: 0.12, K_SWOOP_TUCK: 0.055, SWOOP_MAX: 150, S_SWOOP: 1.1918,
  B_TUCK: 2, B_OPEN: 5, WD_TUCK: 0.0015, WD_OPEN: 0.004,
  K_BED: 0.92,         // a touch on the lake bed keeps 92% of the speed, once for each touch
  FISH: 3, FISH_R: 2.2, BREATH_WARN: 4, BREATH: 6,
  // out of the water: steep and fast is a burst (tan 35°), flat is a skim (tan 15°)
  S_BURST: 0.7002, V_BURST: 12, K_BURST: 1.15, S_SKIM: 0.2679, K_SKIM: 0.8,
  // too slow to fly out: a loon runs along the water until it can take off, like the real bird
  V_FLY: 9, RUN_A: 5, V_TAKEOFF: 14, HOP: 3,
  // a thud keeps 85% of the speed and bounces you up, so one bad landing does not start a chain of them
  K_LAND: 0.85, E_LAND: 0.35, THUD_COOL: 0.3, TUMBLE_HITS: 3, TUMBLE_WIN: 5, TUMBLE: 1,
  // winter: a wall that starts behind you and keeps speeding up
  WALL_GAP: 60, WALL_V0: 6, WALL_A: 0.12,
  START_V: 18, START_Y: 24,
};

export const AIR = 0, WATER = 1, SURFACE = 2;
export const LAND = 0, LAKE = 1;
const smooth = (t) => t * t * (3 - 2 * t);
// a hump that is 0 at both ends with a flat slope there, and 1 in the middle
const bump = (u) => { const a = u * (1 - u); return 16 * a * a; };
// a lake bed: it drops off steeply from the shore, like the rock lakes of the Canadian Shield, then flattens
const bowl = (u) => { const b = 1 - 4 * u * (1 - u); return 1 - b * b * b; };

/* ---------------- the world: land and lakes, made from the seed on demand ---------------- */
// Segment i is land when i is even and a lake when i is odd. Each one is built from hashes of (i, k, seed) only,
// so it does not matter in what order the segments are built.
export function makeWorld(seed) {
  seed >>>= 0;
  const segs = [];
  function build() {
    const i = segs.length, r = (k) => hash01(i, k, seed);
    const x0 = i ? segs[i - 1].x1 : -110;
    if (i % 2 === 0) {
      // land: a ridge, pushed toward one end, with some rough ground on top
      const len = i === 0 ? 140 : 60 + 140 * r(1);
      const far = Math.min(1, x0 / 4000);
      const h = i === 0 ? 10 : 4 + (12 + 6 * far) * r(2);
      segs.push({ i, kind: LAND, x0, x1: x0 + len, h, skew: 0.6 + r(3), rough: 1 + 2 * r(4), trees: [] });
    } else {
      const len = i === 1 ? 130 : 40 + 100 * r(1);
      const depth = 10 + 12 * r(2);
      const fish = [];
      const n = 1 + Math.floor(r(3) * 3);
      for (let k = 0; k < n; k++) {
        const fx = x0 + len * (0.2 + 0.6 * r(10 + k)), fy = -(2 + Math.min(depth * 0.55, 8) * r(20 + k));
        fish.push({ id: i * 8 + k, x: fx, y: fy, r: T.FISH_R, n: 5 + Math.floor(r(30 + k) * 5) });
      }
      segs.push({ i, kind: LAKE, x0, x1: x0 + len, depth, fish });
    }
  }
  function find(x) {
    if (!segs.length) build();
    while (segs[segs.length - 1].x1 <= x) build();
    if (x < segs[0].x0) return segs[0];
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].x0 <= x) lo = m; else hi = m - 1; }
    return segs[lo];
  }
  // value noise on a 9 m lattice, from the seed
  function rough(x) {
    const q = x / 9, k = Math.floor(q), f = q - k;
    const a = hash01(k, 77, seed), b = hash01(k + 1, 77, seed);
    return a + (b - a) * smooth(f) - 0.5;
  }
  function ground(x) {
    const s = find(x);
    const u = (x - s.x0) / (s.x1 - s.x0);
    if (s.kind === LAKE) return -s.depth * bowl(u);
    const w = u / (u + s.skew * (1 - u));   // skew the ridge toward one end
    const b = bump(w);
    return (s.h + s.rough * 2 * rough(x)) * b;
  }
  return { seed, segs, find, ground, isLake: (x) => find(x).kind === LAKE };
}

/* ---------------- the loon ---------------- */
export function newState(opts = {}) {
  return {
    x: 0, y: T.START_Y, vx: T.START_V, vy: 0, mode: AIR, tuck: false,
    tick: 0, alive: true, wx: -T.WALL_GAP, wv: T.WALL_V0,
    flock: 0, under: 0, tumble: 0, thudCool: 0, hits: [], taken: new Set(), warned: false, onBed: false,
    maxX: 0,
    stats: { perfect: 0, rip: 0, splash: 0, flop: 0, skip: 0, fish: 0, burst: 0, thud: 0, takeoff: 0, bestFlock: 0 },
    ...opts,
  };
}
export const speed = (s) => Math.sqrt(s.vx * s.vx + s.vy * s.vy);
export const wallSpeed = (t) => T.WALL_V0 + T.WALL_A * t;
export const distance = (s) => Math.max(0, s.maxX);

// The class of a water entry from the velocity and the wings. Slopes are compared by multiplying, never dividing.
export function entryClass(vx, vy, tuck) {
  const down = -vy, fwd = vx > 0.01 ? vx : vx < -0.01 ? -vx : 0.01;
  if (!tuck) return down < T.S_SKIP * fwd ? "skip" : "flop";
  if (down >= T.S_PERFECT * fwd) return "perfect";
  if (down >= T.S_RIP * fwd) return "rip";
  if (down >= T.S_SPLASH * fwd) return "splash";
  return "flop";
}

// One step of 1/120 s. ev (optional) collects what happened, for sound and pictures: {k: "entry", cls} and friends.
// dry = true is a look-ahead: nothing is eaten or counted, and the winter wall stands still.
export function step(s, W, tuck, ev = null, dry = false) {
  s.tick++;
  if (!dry) {
    s.wv = wallSpeed(s.tick * H);
    s.wx += s.wv * H;
  }
  if (s.tumble > 0) { s.tumble -= H; tuck = false; }
  if (s.thudCool > 0) s.thudCool -= H;
  s.tuck = tuck;
  if (s.mode === AIR) air(s, W, tuck, ev, dry);
  else if (s.mode === WATER) water(s, W, tuck, ev, dry);
  else run(s, W, ev, dry);
  if (s.x > s.maxX) s.maxX = s.x;
  if (!dry && s.alive && s.wx >= s.x) { s.alive = false; if (ev) ev.push({ k: "caught", x: s.x }); }
}

function air(s, W, tuck, ev, dry) {
  let vx = s.vx, vy = s.vy;
  const v = Math.sqrt(vx * vx + vy * vy) || 1e-6;
  let ax = 0, ay = -T.G;
  if (tuck) {
    ay -= T.TUCK_G;
    ax -= T.DRAG_TUCK * v * vx; ay -= T.DRAG_TUCK * v * vy;
  } else {
    let L = T.LIFT_K * v * v * (1 + T.FLOCK_LIFT * s.flock);
    if (L > T.LIFT_MAX) L = T.LIFT_MAX;
    if (s.y > T.CEIL0) L *= Math.max(0, (T.CEIL1 - s.y) / (T.CEIL1 - T.CEIL0));
    if (s.tumble > 0) L *= 0.3;
    // a steep climb: only enough lift to hold the line, so the path never bends back into a loop
    const fwd = vx > 0 ? vx : 0;
    if (vy > T.S_CLIMB * fwd) { const hold = (T.G * fwd) / v; if (L > hold) L = hold; }
    // lift is square to the flight path, on the upper side
    ax += (L * -vy) / v; ay += (L * vx) / v;
    ax -= T.DRAG_OPEN * v * vx; ay -= T.DRAG_OPEN * v * vy;
    if (v < T.V_FLAP && s.tumble <= 0) ax += T.FLAP_A * (1 - v / T.V_FLAP);
  }
  vx += ax * H; vy += ay * H;
  const py = s.y;
  s.x += vx * H; s.y += vy * H;
  s.vx = vx; s.vy = vy;
  const seg = W.find(s.x);
  if (seg.kind === LAKE && s.y <= 0 && py > 0) { enter(s, W, tuck, ev, dry); return; }
  const g = W.ground(s.x);
  if (s.y < g) hitGround(s, W, g, ev, dry);
}

function enter(s, W, tuck, ev, dry) {
  const cls = entryClass(s.vx, s.vy, tuck);
  const vin = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  if (cls === "skip") {
    s.vy = -T.SKIP_VY * s.vy; s.vx *= T.SKIP_VX; s.y = 0.01;
    if (!dry) s.stats.skip++;
    if (ev) ev.push({ k: "skip", x: s.x, v: vin });
    return;
  }
  const k = cls === "perfect" ? T.K_PERFECT : cls === "rip" ? T.K_RIP : cls === "splash" ? T.K_SPLASH : T.K_FLOP;
  s.vx *= k; s.vy *= k;
  s.mode = WATER; s.under = 0; s.warned = false; s.onBed = false;
  // right at the shore the bed is only a hand deep: stay above it
  const bed = W.ground(s.x) + 0.4;
  if (s.y < bed) s.y = bed < 0 ? bed : 0;
  if (!dry) {
    s.stats[cls]++;
    if (cls === "perfect" || cls === "rip") s.flock = Math.min(T.FLOCK_MAX, s.flock + 1);
    if (cls === "flop") s.flock = Math.max(0, s.flock - 1);
    if (s.flock > s.stats.bestFlock) s.stats.bestFlock = s.flock;
  }
  if (ev) ev.push({ k: "entry", cls, x: s.x, v: vin });
}

function water(s, W, tuck, ev, dry) {
  s.under += H;
  let vx = s.vx, vy = s.vy;
  const v = Math.sqrt(vx * vx + vy * vy) || 1e-6;
  let ax = 0, ay = tuck ? T.B_TUCK : T.B_OPEN;
  if (s.under > T.BREATH) ay += 20;   // out of breath: up you go
  const fwd = vx > 0.01 ? vx : 0.01;
  if (vy < T.S_SWOOP * fwd) {
    let a = (tuck ? T.K_SWOOP_TUCK : T.K_SWOOP_OPEN) * v * v;
    if (a > T.SWOOP_MAX) a = T.SWOOP_MAX;
    ax += (a * -vy) / v; ay += (a * vx) / v;
  }
  const d = tuck ? T.WD_TUCK : T.WD_OPEN;
  ax -= d * v * vx; ay -= d * v * vy;
  vx += ax * H; vy += ay * H;
  s.x += vx * H; s.y += vy * H;
  if (!s.warned && s.under > T.BREATH_WARN) { s.warned = true; if (ev) ev.push({ k: "breath" }); }
  const seg = W.find(s.x);
  if (seg.kind !== LAKE) {
    // swam out of the lake: the shore
    s.vx = vx; s.vy = vy;
    const g = W.ground(s.x);
    if (s.y < g) { s.mode = AIR; hitGround(s, W, g, ev, dry); return; }
    s.mode = AIR;
    return;
  }
  if (!dry) {
    for (const f of seg.fish) {
      if (s.taken.has(f.id)) continue;
      const dx = s.x - f.x, dy = s.y - f.y;
      if (dx * dx + dy * dy < f.r * f.r) {
        s.taken.add(f.id);
        const vv = Math.sqrt(vx * vx + vy * vy) || 1;
        vx += (T.FISH * vx) / vv; vy += (T.FISH * vy) / vv;
        s.stats.fish++;
        if (ev) ev.push({ k: "fish", x: f.x, y: f.y, n: s.stats.fish });
      }
    }
  }
  const bottom = W.ground(s.x);
  if (s.y < bottom + 0.4) {
    // the bed: glance off it and lose a little. The loss comes once for each touch, not on each step of it.
    s.y = bottom + 0.4;
    if (vy < 0) vy = -vy * 0.6;
    if (!s.onBed) {
      s.onBed = true;
      vx *= T.K_BED; vy *= T.K_BED;
      if (ev) ev.push({ k: "scrape", x: s.x, y: s.y });
    }
  } else s.onBed = false;
  s.vx = vx; s.vy = vy;
  if (s.y >= 0) exit(s, ev, dry);
}

function exit(s, ev, dry) {
  const up = s.vy, fwd = s.vx > 0.01 ? s.vx : 0.01;
  const v = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  if (v < T.V_FLY) {
    // not enough speed to fly: run along the water
    s.mode = SURFACE; s.y = 0; s.vy = 0;
    if (s.vx < 1) s.vx = 1;
    if (ev) ev.push({ k: "surface", x: s.x, v });
    return;
  }
  s.mode = AIR;
  let cls = "out";
  if (up >= T.S_BURST * fwd && v >= T.V_BURST) { s.vx *= T.K_BURST; s.vy *= T.K_BURST; cls = "burst"; if (!dry) s.stats.burst++; }
  else if (up < T.S_SKIM * fwd) { s.vx *= T.K_SKIM; s.vy *= T.K_SKIM; cls = "skim"; }
  s.y = 0.001;
  if (ev) ev.push({ k: "exit", cls, x: s.x, v });
}

// On the water, too slow to fly: the loon runs, wings beating, until it can take off. The input does nothing here.
function run(s, W, ev, dry) {
  s.vx += T.RUN_A * H;
  s.x += s.vx * H;
  s.y = 0; s.vy = 0;
  const lake = W.find(s.x).kind === LAKE;
  if (s.vx >= T.V_TAKEOFF || !lake) {
    // up and away, or the lake ran out: a hop into the air
    s.mode = AIR; s.vy = lake ? T.HOP : T.HOP + 1; s.y = 0.05 + Math.max(0, W.ground(s.x));
    if (!dry) s.stats.takeoff++;
    if (ev) ev.push({ k: "takeoff", x: s.x, v: s.vx });
  }
}

function hitGround(s, W, g, ev, dry) {
  // the slope of the ground here gives its normal
  const gl = W.ground(s.x - 0.5), gr = W.ground(s.x + 0.5);
  const sl = gr - gl, n = Math.sqrt(sl * sl + 1), nx = -sl / n, ny = 1 / n;
  const vn = s.vx * nx + s.vy * ny;
  s.y = g + 0.05;
  if (s.thudCool > 0) {
    // still touching after a thud: slide along the ground instead of thudding again
    if (vn < 0) { s.vx -= vn * nx; s.vy -= vn * ny; }
    s.vx *= 0.995; s.vy *= 0.995;
    if (s.vx < 3) s.vx = 3;
    return;
  }
  if (vn < 0) { s.vx -= (1 + T.E_LAND) * vn * nx; s.vy -= (1 + T.E_LAND) * vn * ny; }
  s.vx *= T.K_LAND; s.vy *= T.K_LAND;
  if (s.vx < 3) s.vx = 3;
  if (s.vy < T.HOP_LAND) s.vy = T.HOP_LAND;
  s.thudCool = T.THUD_COOL;
  if (dry) { if (ev) ev.push({ k: "thud", x: s.x }); return; }
  const t = s.tick * H;
  s.hits.push(t);
  while (s.hits.length && t - s.hits[0] > T.TUMBLE_WIN) s.hits.shift();
  if (s.hits.length >= T.TUMBLE_HITS) { s.tumble = T.TUMBLE; s.hits.length = 0; }
  s.stats.thud++;
  if (ev) ev.push({ k: "thud", x: s.x, tumble: s.tumble > 0 });
}

// The length of lake left past x, to swoop up and out; 0 over land.
export function lakeLeft(W, x) {
  const seg = W.find(x);
  return seg.kind === LAKE ? seg.x1 - x : 0;
}

// The look ahead: a copy of the loon glides until step `from`, then holds, until it meets the water or the land.
// Returns the points (one in `every` steps), how it ends, and for an entry, the lake left past it (room).
function ahead(s, W, from, maxSteps, every) {
  const p = { x: s.x, y: s.y, vx: s.vx, vy: s.vy, mode: s.mode, tuck: from <= 0, tick: s.tick, alive: true, wx: s.wx, wv: s.wv,
    flock: s.flock, under: s.under, tumble: s.tumble, thudCool: s.thudCool, hits: [], taken: s.taken, warned: true, onBed: s.onBed,
    maxX: s.maxX, stats: s.stats };
  const pts = [], ev = [];
  let end = null, room = 0;
  for (let i = 0; i < maxSteps; i++) {
    step(p, W, i >= from, ev, true);
    if (i % every === 0) pts.push(p.x, p.y);
    if (ev.length) {
      const e = ev.find((q) => q.k === "entry" || q.k === "thud" || q.k === "skip" || q.k === "exit");
      if (e) {
        end = e.k === "entry" ? e.cls : e.k;
        if (e.k === "entry") room = lakeLeft(W, e.x);
        pts.push(p.x, p.y);
        break;
      }
      ev.length = 0;
    }
  }
  return { pts, end, room };
}

// Where the loon goes if the input stays as it is: points for the dotted line, and how it ends.
export function predict(s, W, tuck, maxSteps = 240, every = 5) {
  return ahead(s, W, tuck ? 0 : Infinity, maxSteps, every);
}

// A rip needs this much lake past its entry to swoop up and out. With less, the dotted line shows amber, not green.
export const ROOM = 25;
// A good dive: a rip or a perfect rip, with room to swoop out
export const goodDive = (end, room) => (end === "perfect" || end === "rip") && room >= ROOM;
// The dive-now cue, for a loon that glides down: a hold that starts now gives a good dive, and so does a hold that
// starts a reaction later (REACT steps, 0.25 s). So a player who answers the cue late still rips. It stays off on the
// climb out of a burst: that is the moment to watch, not to act.
export const REACT = 30;
export function diveCue(s, W, maxSteps = 360) {
  if (s.mode !== AIR || s.vy >= 0) return false;
  const now = ahead(s, W, 0, maxSteps, 1000);
  if (!goodDive(now.end, now.room)) return false;
  const late = ahead(s, W, REACT, maxSteps + REACT, 1000);
  return goodDive(late.end, late.room);
}

// a hash of everything that matters, to prove two runs are the same
export function stateHash(s) {
  const f = new Float64Array([s.x, s.y, s.vx, s.vy, s.wx, s.flock, s.tick, s.mode, s.under, s.tumble, s.onBed ? 1 : 0,
    s.stats.perfect, s.stats.rip, s.stats.splash, s.stats.flop, s.stats.skip, s.stats.fish, s.stats.burst, s.stats.thud]);
  const b = new Uint8Array(f.buffer);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
