// Bites and fights: which fish takes the lure, how it follows and strikes, and the fight on the line.
// Pure logic (no DOM, no three.js), deterministic for a given rng, so node can test it: node qa/fish/fight.sim.mjs
import { rng as makeRng, depth, zone, ROD } from "./lake.js";
import { SPECIES, JUNK, byId, lengthFor } from "./species.js";

// the reel, the line and the fight. Tuned with qa/fish/fight.sim.mjs
export const REEL = {
  LINE_PER_TURN: 0.75,   // m of line per crank turn (a 5.2:1 spinning reel)
  FIGHT_LINE_PER_TURN: 1.15, // m per turn once a fish is on: game time, so fights last 3 to 45 s, not the minutes of real fishing
  BREAK_N: 45,           // 10 lb line
  DRAG_N: [12, 18, 26],  // light, medium, heavy drag
  STEP: 1 / 240,         // s: internal step, so a big frame time never blows up the springs
  MAX_DT: 0.1,           // s: a longer frame (a tab switch) is cut to this
  MAX_CRANK: 6,          // rev/s: nobody cranks faster
  MIN_LINE: 0.5,         // m: the lure is at the rod tip
  LINE_EA: 350,          // N: line stiffness × length. 10 lb mono stretches about 12% near its break
  ROD_SOFT: 22,          // N/m: a rod held high bends and soaks up shocks...
  ROD_STIFF: 420,        // ...a rod pointed down the line cannot bend
  ROD_EXP: 6,            // how fast the rod stiffens as it lines up with the line
  ROD_RATING: 30,        // N: the load that bends the rod fully (for drawing)
  SPOOL_M: 0.06,         // kg: spool inertia at the line, so a sudden spike overshoots the drag for a moment
  SPOOL_B: 2,            // N per m/s: the drag washers pull a little harder the faster they slip
  GRIND_N: 7.5,          // N per rev/s: cranking while the drag slips adds this much tension
  SLACK_N: 1,            // N: below this the line is slack
  ADDED_MASS: 1.5,       // a fish moves water with it: its mass feels this much heavier
  TOW: 0.5,              // a fish led toward you head-first drags this much less than one that swims
  SHAKE_N: 6,            // N per kg^0.7: the size of a head-shake spike on a stiff rod
  SHAKE_SOFT: 0.25,      // a high rod passes on only this much of each spike
  JOLT_N: 12,            // N: the kick at the start of a run or surge, on a stiff rod (capped for big fish)
  TURN_RATE: 2.2,        // rad/s: how fast a fresh fish turns to where it wants to go
  LINE_TURN: 3.0,        // rad/s at full pull: how fast the line turns a fish's head
  SIDE_BEND: 0.6,        // steering bends the line pull sideways (tan of the angle: 0.6 is about 30°)
  DRAIN_T: 0.55,         // stamina drain from pulling against the line: × tension / the fish's pull^DRAIN_P / stamina seconds
  DRAIN_P: 0.4,          // big fish feel the same tension less, but not in full proportion, so a muskie still tires
  DRAIN_F0: 40,          // N: the pull where DRAIN_P makes no difference
  DRAIN_E: 0.2,          // stamina drain from its own effort
  SIDE_DRAIN: 1.2,       // side pressure against the run drains this much faster
  RECOVER: 0.03,         // /s stamina back while the line is slack
  THROW_LONG: 0.45,      // chance to throw the hook after 2.5 s of slack (and again every 1.5 s)
  THROW_SHAKE: 0.4,      // chance when the line is slack for 0.9 s in a shake or a jump
  JUMP_K: 2,             // throw chance per unit of (tension fraction × rod high) while the fish is in the air
  JUMP_MAX: 0.8,         // ...up to this per jump
  JUMP_LOW: 32,          // deg: a rod below this counts as low for a jump...
  JUMP_HIGH: 58,         // ...and above this as high
  SELF_HOOK_HOLD: 1.4,   // a fish that hooked itself throws the hook this much more easily
  COVER_RATE: 0.12,      // /s chance of cutting the line for a fresh fish running out through weeds or rocks
  LAND_R: 3.5,           // m from the dock end to land a fish
  LAND_STAMINA: 0.3,     // tired enough to land below this
  LIFT_THETA: 70,        // deg: hold the rod this high...
  LIFT_TIME: 0.7,        // ...for this long to lift the fish out
  SWING: 0.35,           // a fish lighter than this × the drag (0.6 kg on medium) can be wound up to the tip and swung in
  MUSKIE_SURGE_R: 9,     // m: a muskie makes its last run when it first sees the dock this close
  JUNK_SINK: 0.6,        // m/s²: a waterlogged boot settles back toward the bottom
};

// bites and the retrieve
export const BITE = {
  GOOD: 0.7,             // chance of a bite in good water...
  OPEN: 0.62,            // ...in open sand or deep water...
  RING: 0.9,             // ...and inside a ring of rising fish
  RING_MUL: 4,           // a ring makes its species this much more likely
  JUNK: 0.05,            // share of bites that are junk...
  JUNK_DOCK: 3,          // ...times this near the dock
  WINDOW: 0.85,          // s: the hook-set window after a strike
  WINDOW_EASY: 1.1,
  SELF_HOOK: 0.35,       // easy mode: a fish hooks itself this often if you keep cranking through the strike
  SPOOK: 0.5,            // a hook set during the nibbles spooks the fish this often
  PAUSE_STRIKE: 0.6,     // a pause in the retrieve makes a following fish strike this often
  SINK: 0.35,            // m/s the lure sinks when slow
  RISE: 0.5,             // m/s it rises when fast
  NEUTRAL: 0.55,         // m/s: the retrieve speed that holds the lure's depth
  EMPTY_T: 5,            // s: with no fish coming, the lure skips home after this...
  EMPTY_MUL: 4,          // ...this many times faster, so a dead cast costs seconds, not half a minute
  HOME_R: 3,             // m: the lure is home this close to the dock
};

const GOOD_ZONES = new Set(["pads", "weeds", "rocks", "dropoff", "dock", "island"]);
// the cover each fish runs for, and what it cuts the line on
const COVER = { largemouth: ["weeds", "pads"], pike: ["weeds", "pads"], smallmouth: ["rocks"] };
// small touches of character on top of species.js
const STYLE = {
  pike: { first: "shake", shake: 1.3 },
  smallmouth: { first: "jump" },
  walleye: { first: "dive", shake: 0.6, deep: true },
  laketrout: { first: "run", runLen: 1.6, deep: true },
  muskie: { first: "shake", shake: 1.2 },
  golden: { first: "jump" },
};
const MOVE_FORCE = { run: 1, surge: 1.35, shake: 0.35, dive: 0.8, swim: 0.45, rest: 0.15, jump: 1 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const D2R = Math.PI / 180;
// heading: 0 = toward −z, + = toward +x
const headingOf = (dx, dz) => Math.atan2(dx, -dz);

// the unbent rod tip for a rod angle, a heading and a steer (spec §2)
export function rodTip(theta, yaw = 0, steer = 0) {
  const t = fin(theta, 45) * D2R, y = (fin(yaw, 0) + 35 * clamp(fin(steer, 0), -1, 1)) * D2R;
  return { x: ROD.base.x + ROD.length * Math.sin(y) * Math.cos(t), y: ROD.base.y + ROD.length * Math.sin(t), z: ROD.base.z - ROD.length * Math.cos(y) * Math.cos(t) };
}

// the time-of-day multiplier for a species
function hourMul(sp, hour) {
  let m = 1;
  for (const [a, b, x] of sp.hours || []) if (hour >= a && hour <= b) m = Math.max(m, x);
  return m;
}
// how well the water depth suits a species
function depthFit(sp, d) {
  const [a, b] = sp.depth;
  if (d < a) return Math.max(0.15, d / a);
  if (d > b) return Math.max(0.15, b / d);
  return 1;
}
// every species that could bite at a spot, with its weight
export function speciesWeights(zn, d, hour, ring = null) {
  const out = [];
  for (const sp of SPECIES) {
    if (sp.legend) continue;
    let w = (sp.zones[zn] || 0);
    if (ring && ring.species === sp.id) w = Math.max(w, 1) * BITE.RING_MUL;
    w *= sp.rarity * hourMul(sp, hour) * depthFit(sp, d);
    if (w > 0) out.push([sp, w]);
  }
  return out;
}
function pickW(list, r) {
  let sum = 0;
  for (const [, w] of list) sum += w;
  let u = r() * sum;
  for (const [x, w] of list) { if ((u -= w) <= 0) return x; }
  return list.length ? list[list.length - 1][0] : null;
}
// a weight within the usual range, with a long rare tail up to the trophy (about 1 in 30 above the range)
export function rollWeight(sp, r) {
  const [a, b] = sp.kg;
  let kg;
  if (sp.trophy && r() < 1 / 30) kg = b + (sp.trophy - b) * Math.pow(r(), 1.8);
  else kg = a + (b - a) * Math.pow(r(), 1.35);
  return Math.round(kg * 100) / 100;
}
// how much a fish likes the lure at this speed (0..1)
function likeSpeed(sp, s) {
  const [lo, hi] = sp.lure;
  if (s < lo) return 0.45 + 0.55 * s / lo;
  if (s <= hi) return 1;
  return Math.max(0.12, 1 - (s - hi) / (1.5 * hi));
}

/* ---------------- rising fish: the rings you cast at ---------------- */

export class Rises {
  constructor(rng) {
    this.r = typeof rng === "function" ? rng : makeRng(1);
    this.list = [];
    this.spawnT = 0;
    this.hour = 12;
  }
  static golden(hour) { return (hour >= 5 && hour <= 8) || (hour >= 18 && hour <= 21); }

  step(dt, hour = 12) {
    dt = clamp(fin(dt, 0), 0, 1);
    this.hour = fin(hour, 12);
    const ev = [];
    for (const g of this.list) {
      g.ttl -= dt;
      g.pulse -= dt;
      if (g.ttl > 0 && g.pulse <= 0) { g.pulse = 2.5 + this.r() * 4; ev.push({ type: "rise", x: g.x, z: g.z, gold: g.gold }); }
    }
    this.list = this.list.filter((g) => g.ttl > 0);
    this.spawnT -= dt;
    // keep 2..4 rings on the water
    while (this.list.length < 2 || (this.list.length < 4 && this.spawnT <= 0)) {
      const g = this.spawn();
      this.spawnT = 5 + this.r() * 8;
      if (!g) break;
      this.list.push(g);
      ev.push({ type: "rise", x: g.x, z: g.z, gold: g.gold });
    }
    return ev;
  }

  spawn() {
    const r = this.r, hour = this.hour;
    const gold = Rises.golden(hour) && !this.list.some((g) => g.gold) && r() < 0.12;
    for (let i = 0; i < 60; i++) {
      const d = gold ? 40 + r() * 15 : 8 + r() * 37, a = (r() * 2 - 1) * 70 * D2R;
      const x = Math.sin(a) * d, z = -Math.cos(a) * d;
      if (this.list.some((g) => Math.hypot(g.x - x, g.z - z) < 8)) continue;
      const zn = zone(x, z);
      if (zn === "land" || depth(x, z) < 0.6) continue;
      if (gold) return { x, z, ttl: 18 + r() * 12, species: "golden", gold: true, pulse: 1 + r() * 2 };
      const sp = pickW(speciesWeights(zn, depth(x, z), hour), r);
      if (!sp) continue;
      return { x, z, ttl: 25 + r() * 25, species: sp.id, gold: false, pulse: 1 + r() * 2 };
    }
    return null;
  }

  near(x, z) {
    let best = null, bd = 5;
    for (const g of this.list) { const d = Math.hypot(g.x - x, g.z - z); if (d <= bd) { bd = d; best = g; } }
    return best;
  }
  // the fish in that ring took your lure: the ring goes away
  take(g) { this.list = this.list.filter((q) => q !== g); }
}

/* ---------------- the lake around the lure ---------------- */

// How main.js drives it, once per frame after the lure lands:
//   const sim = new LakeSim({ lure: {x, z}, tip, lineOut: flight.lineOut, hour, ring: rises.near(x, z), rng: rng(seed) });
//   sim.step(dt, { crank, tip: rodTip(theta, yaw, steer), theta, omega, steer, drag, hookset, lift });
//   for (const e of sim.events.splice(0)) ...;  then draw from sim.state.
// Pass the unbent tip from rodTip(): the rod's bend is already inside the line physics, and world.setRod can bend it
// for the picture from state.bend. If a ring's fish is hooked, call rises.take(ring).
export class LakeSim {
  // opts: { lure, tip, lineOut, hour, ring, rng, easy = true }
  // test hooks: species (force a fish or junk by id), kg (force its weight), bite (true/false forces a bite or none)
  constructor(opts = {}) {
    const o = opts || {};
    this.r = typeof o.rng === "function" ? o.rng : makeRng((Math.random() * 4294967296) >>> 0);
    this.easy = o.easy !== false;
    this.hour = fin(o.hour, 12);
    this.ring = o.ring || null;
    const lx = fin(o.lure && o.lure.x, 0), lz = fin(o.lure && o.lure.z, -15);
    this.tip = this.cleanTip(o.tip, null) || rodTip(45, headingOf(lx, lz) / D2R);
    const d0 = Math.hypot(lx - this.tip.x, this.tip.y, lz - this.tip.z);
    this.zone = zone(lx, lz);
    this.water = depth(lx, lz);
    this.state = {
      phase: "sink",
      lure: { x: lx, y: 0, z: lz, speed: 0 },
      lineOut: Math.max(REEL.MIN_LINE, fin(o.lineOut, d0)),
      tension: 0, tfrac: 0, slip: 0, slack: true,
      dragN: REEL.DRAG_N[1], breakN: REEL.BREAK_N, dragFrac: REEL.DRAG_N[1] / REEL.BREAK_N,
      follower: null, fish: null, catch: null, reason: null,
      tooFast: false,  // a fish follows but the lure runs away from it
      empty: false,    // nothing is coming: the lure skips home
      // extras for the HUD
      t: 0,            // s since the lure landed
      zone: this.zone, // the kind of water the lure landed in
      depth: 0,        // m: how deep the lure (or the hooked fish) is
      bend: 0,         // 0..1 rod load, for drawing
      strikeLeft: 0,   // s left to set the hook
      lift: 0,         // 0..1 progress of lifting a fish out
      fightT: 0,       // s since the hook set
      junk: false,     // the thing on the line is junk
    };
    this.events = [];
    this.theta = 45; this.crank = 0;
    this.slackT = 0; this.slackCool = 0; this.slipOffT = 9; this.spool = 0;
    this.bottom = { x: NaN, z: NaN, d: this.water };
    this.plan = this.choose(o);
    this.ap = this.plan ? { stage: "wait", t: this.plan.notice, interest: 0, nib: 0, nibbled: false, pauseT: 0, movedT: 9, pauseRolled: false, bored: 0 } : null;
  }

  emit(type, extra) {
    const e = { type };
    if (extra) Object.assign(e, extra);
    // the caller drains this every frame; if it forgets, keep only the latest
    if (this.events.length > 200) this.events.splice(0, 100);
    this.events.push(e);
  }

  // pick what bites at this spot, if anything
  choose(o) {
    const r = this.r, zn = this.zone, ring = this.ring;
    const forced = o.species ? byId(o.species) : null;
    if (zn === "land" && !forced) return null;
    let p = ring ? BITE.RING : GOOD_ZONES.has(zn) ? BITE.GOOD : BITE.OPEN;
    if (o.bite === true || forced) p = 1;
    if (o.bite === false) p = 0;
    if (r() >= p) return null;
    let sp = forced;
    if (!sp) {
      const dockNear = zn === "dock" || Math.hypot(this.state.lure.x, this.state.lure.z) < 12;
      if (!ring && r() < BITE.JUNK * (dockNear ? BITE.JUNK_DOCK : 1)) {
        // plungers and frisbees sit by the dock; boots are everywhere
        sp = dockNear ? JUNK[(r() * JUNK.length) | 0] : r() < 0.7 ? JUNK[0] : JUNK[(r() * JUNK.length) | 0];
      } else if (ring && ring.gold) sp = byId("golden");
      else sp = pickW(speciesWeights(zn, this.water, this.hour, ring), r);
    }
    if (!sp) return null;
    const junk = JUNK.includes(sp);
    const kg = Number.isFinite(o.kg) ? o.kg : junk ? Math.round((sp.kg[0] + (sp.kg[1] - sp.kg[0]) * r()) * 100) / 100 : rollWeight(sp, r);
    const inRing = !!(ring && (ring.species === sp.id || ring.gold));
    const style = junk ? "junk" : sp.bite;
    // a short cast leaves little time before the lure is home, so fish near the dock make up their minds faster
    const avail = (Math.hypot(this.state.lure.x, this.state.lure.z) - BITE.HOME_R) / 0.8;
    const quick = clamp(avail / 16, 0.3, 1);
    return {
      sp, junk, kg, id: sp.id,
      cm: junk ? 0 : lengthFor(sp, kg),
      len: junk ? 0.3 : Math.max(0.1, lengthFor(sp, kg) / 100),
      style,
      notice: ((inRing ? 0.5 + r() * 1.5 : 1 + r() * 4) + (junk ? 1 + r() * 4 : 0)) * quick,
      commit: Math.max(0.8, (style === "slammer" ? 1.4 + r() * 2 : style === "soft" ? 2 + r() * 2.5 : 2.5 + r() * 2.5) * (inRing ? 0.7 : 1) * quick),
      nibbles: style === "nibbler" ? (r() < 0.1 ? 0 : 1 + ((r() * 3) | 0)) : style === "soft" ? (r() < 0.5 ? 1 : 0) : 0,
      pauseNeed: 0.5 + r(),
      quick,
    };
  }

  cleanTip(t, fallback) {
    if (t && Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z)) return { x: t.x, y: t.y, z: t.z };
    return fallback;
  }

  // the water depth and zone under a point, cached because lake.height is not cheap
  depthAt(x, z) {
    const b = this.bottom;
    if (!(Math.abs(b.x - x) < 0.4 && Math.abs(b.z - z) < 0.4)) { b.x = x; b.z = z; b.d = depth(x, z); }
    return b.d;
  }
  // a fish can swim here: water, and not behind the angler (the game looks out at the lake)
  swim(x, z) { return z < 1.5 && this.depthAt(x, z) >= 0.1; }
  zoneAt(x, z) {
    const b = this.zc || (this.zc = { x: NaN, z: NaN, zn: "" });
    if (!(Math.abs(b.x - x) < 0.5 && Math.abs(b.z - z) < 0.5)) { b.x = x; b.z = z; b.zn = zone(x, z); }
    return b.zn;
  }

  step(dt, inp = {}) {
    const S = this.state;
    if (S.phase === "caught" || S.phase === "lost" || S.phase === "home") return S;
    dt = clamp(fin(dt, 0), 0, REEL.MAX_DT);
    if (dt <= 0) return S;
    const i = inp || {};
    const crank = clamp(fin(i.crank, 0), 0, REEL.MAX_CRANK);
    const theta = clamp(fin(i.theta, this.theta), -90, 270);
    const steer = clamp(fin(i.steer, 0), -1, 1);
    const di = clamp(Math.round(fin(i.drag, 1)), 0, 2);
    S.dragN = REEL.DRAG_N[di];
    S.dragFrac = S.dragN / S.breakN;
    const from = this.tip;
    const to = this.cleanTip(i.tip, null) || rodTip(theta, this.aimYaw(), steer);
    const n = Math.max(1, Math.ceil(dt / REEL.STEP - 1e-9)), h = dt / n;
    const I = { crank, theta, omega: fin(i.omega, 0), steer, hookset: !!i.hookset, lift: !!i.lift, tip: { ...from } };
    for (let k = 1; k <= n; k++) {
      // slide the tip across the frame, so a fast rod snap stretches the line smoothly
      const u = k / n;
      I.tip.x = from.x + (to.x - from.x) * u; I.tip.y = from.y + (to.y - from.y) * u; I.tip.z = from.z + (to.z - from.z) * u;
      this.sub(h, I);
      I.hookset = false;
      if (S.phase === "caught" || S.phase === "lost" || S.phase === "home") break;
    }
    this.tip = to; this.theta = theta; this.crank = crank;
    this.publish(dt);
    return S;
  }

  // the heading from the dock to whatever is on the line, in degrees
  aimYaw() {
    const S = this.state, p = S.fish || S.lure;
    return headingOf(p.x, p.z) / D2R;
  }

  sub(h, I) {
    const S = this.state;
    S.t += h;
    if (S.phase === "sink" || S.phase === "retrieve" || S.phase === "strike") this.retrieve(h, I);
    else if (S.phase === "fight" || S.phase === "land") this.fight(h, I);
  }

  /* ---------------- the lure before a fish is on ---------------- */

  retrieve(h, I) {
    const S = this.state, L = S.lure, B = BITE;
    if (S.phase === "sink" && I.crank > 0.05) S.phase = "retrieve";
    // no fish on its way: after a few seconds the retrieve speeds up
    const empty = !this.ap || this.ap.stage === "gone";
    this.emptyT = empty && S.phase === "retrieve" ? (this.emptyT || 0) + h : 0;
    const fast = 1 + (B.EMPTY_MUL - 1) * clamp(this.emptyT - B.EMPTY_T, 0, 1);
    S.empty = fast > 1;
    const c = I.crank * REEL.LINE_PER_TURN * fast;
    S.lineOut = Math.max(REEL.MIN_LINE, S.lineOut - c * h);
    const px = L.x, pz = L.z;
    const f = S.phase === "strike" ? S.follower : null;
    if (f) {
      // the fish has the lure in its mouth and turns away with it
      const a = f.heading;
      f.x += Math.sin(a) * 0.45 * h; f.z -= Math.cos(a) * 0.45 * h;
      L.x = f.x; L.y = f.y; L.z = f.z;
    } else {
      // the lure dives when slow and planes up when fast
      const vy = -B.SINK * clamp(1 - L.speed / B.NEUTRAL, 0, 1) + B.RISE * clamp((L.speed - B.NEUTRAL) / 1.2, 0, 1);
      const bot = this.depthAt(L.x, L.z);
      L.y = clamp(L.y + vy * h, -Math.max(0.05, bot - 0.05), -0.03);
    }
    // the line is tight when it is shorter than the way to the lure: the lure comes toward the rod tip
    const T = I.tip, dx = T.x - L.x, dz = T.z - L.z, dy = T.y - L.y;
    const hd = Math.hypot(dx, dz), need = Math.sqrt(Math.max(0, S.lineOut * S.lineOut - dy * dy));
    if (hd > need && hd > 1e-6) {
      const m = (hd - need) / hd;
      L.x += dx * m; L.z += dz * m;
      if (f) { f.x = L.x; f.z = L.z; }
    }
    const inst = Math.hypot(L.x - px, L.z - pz) / h;
    L.speed += (inst - L.speed) * Math.min(1, h / 0.2);
    const tight = hd >= need - 0.05;
    S.slack = !tight;
    // what the line feels: the pull of the lure through the water, or a fish holding it
    S.tension = f ? 3 + 3 * Math.sqrt(this.plan.kg) * (tight ? 1 : 0.3) : tight ? 0.4 + 2.2 * L.speed * L.speed : 0;
    S.slip = 0;
    if (this.ap) this.approach(h, I);
    if ((S.phase === "sink" || S.phase === "retrieve") && S.t > 0.5 && Math.hypot(L.x, L.z) < B.HOME_R) {
      S.phase = "home"; S.follower = null;
      this.emit("home");
    }
  }

  // a fish notices the lure, follows it, nibbles and strikes
  approach(h, I) {
    const S = this.state, L = S.lure, ap = this.ap, P = this.plan, r = this.r, B = BITE;
    if (ap.stage === "gone") return;
    if (S.phase === "strike") {
      S.strikeLeft -= h;
      if (I.crank >= 0.4) ap.crankT += h;
      if (I.hookset) return this.hook(1);
      if (S.strikeLeft <= 0) {
        const win = this.easy ? B.WINDOW_EASY : B.WINDOW;
        if (this.easy && ap.crankT >= 0.7 * win && r() < B.SELF_HOOK) return this.hook(REEL.SELF_HOOK_HOLD);
        S.strikeLeft = 0;
        this.lose("spat", "missed");
      }
      return;
    }
    // pauses: a lure that was moving and stops
    if (L.speed > 0.3) { ap.movedT = 0; ap.pauseT = 0; ap.pauseRolled = false; }
    else { ap.movedT += h; if (L.speed < 0.12) ap.pauseT += h; }
    if (ap.stage === "wait") {
      // junk just sits on the bottom until the lure drags over it
      if (P.junk) { if (S.phase === "retrieve" && I.crank > 0.1) ap.t -= h; if (ap.t <= 0) this.hook(1); return; }
      ap.t -= h * (S.phase === "sink" ? 0.8 : 1);
      if (ap.t > 0) return;
      ap.stage = "follow";
      const away = headingOf(L.x - I.tip.x, L.z - I.tip.z) + (r() * 2 - 1) * 0.7, d = (2 + r() * 2.5) * (0.5 + 0.5 * P.quick);
      const fx = L.x + Math.sin(away) * d, fz = L.z - Math.cos(away) * d;
      const bot = this.depthAt(fx, fz);
      S.follower = { id: P.id, x: fx, y: -clamp(Math.max(-L.y, 0.3) + 0.3, 0.2, Math.max(0.2, bot - 0.1)), z: fz, heading: away + Math.PI, len: P.len };
      this.emit("follow", { id: P.id });
      return;
    }
    // follow: swim up behind the lure
    const f = S.follower;
    const bx = L.x - I.tip.x, bz = L.z - I.tip.z, bl = Math.hypot(bx, bz) || 1;
    const tx = L.x + bx / bl * 0.6, tz = L.z + bz / bl * 0.6, ty = L.y - 0.1;
    const dx = tx - f.x, dy = ty - f.y, dz = tz - f.z, dl = Math.hypot(dx, dy, dz);
    const like = likeSpeed(P.sp, L.speed);
    // it swims up at a little more than the lure's speed, up to its burst speed, and always a little faster
    // than the lure so a small fish can still catch a brisk retrieve; the prompt tells the player to slow down
    const spd = Math.max(Math.min(P.sp.fight.speed * 1.1, Math.max(0.6, L.speed + 0.8)), L.speed + 0.3);
    // too fast only when the lure moves faster than the fish likes (a lure at rest is not too fast)
    S.tooFast = like < 0.5 && L.speed > P.sp.lure[1];
    if (dl > 1e-6) {
      const m = Math.min(dl, spd * h) / dl;
      f.x += dx * m; f.y += dy * m; f.z += dz * m;
      if (dl > 0.2) f.heading += wrap(headingOf(dx, dz) - f.heading) * Math.min(1, h * 4);
    }
    const close = Math.hypot(f.x - L.x, f.z - L.z) < 1.6 && Math.abs(f.y - L.y) < 1.2;
    ap.bored = like < 0.25 ? ap.bored + h : Math.max(0, ap.bored - h);
    if (ap.bored > 3.5) {
      // too fast for it: it turns away
      ap.stage = "gone"; S.follower = null; S.tooFast = false;
      this.emit("refuse", { id: P.id });
      return;
    }
    if (I.hookset && ap.nibbled) {
      // yanking at a nibble: half the time the fish bolts
      if (r() < B.SPOOK) return this.lose("spooked", "spooked");
      ap.interest *= 0.6;
    }
    if (!close) return;
    ap.interest += like / P.commit * h * (this.ring ? 1.3 : 1);
    // nibbles come at even steps of interest before the take
    if (ap.nib < P.nibbles && ap.interest >= 0.3 + 0.6 * ap.nib / Math.max(1, P.nibbles)) {
      ap.nib++; ap.nibbled = true;
      this.emit("nibble", { s: P.style === "soft" ? 0.15 + r() * 0.1 : 0.3 + r() * 0.35 });
    }
    let strike = ap.interest >= 1 && ap.nib >= P.nibbles;
    // a pause after a retrieve often triggers the take
    if (!strike && !ap.pauseRolled && ap.pauseT >= P.pauseNeed && ap.movedT < 3 && ap.interest >= 0.25) {
      ap.pauseRolled = true;
      strike = r() < B.PAUSE_STRIKE;
    }
    // last chance: the lure is about to leave the water
    if (!strike && ap.interest >= 0.45 && Math.hypot(L.x, L.z) < B.HOME_R + 2) strike = r() < 1.5 * h;
    if (strike) {
      S.phase = "strike"; S.tooFast = false;
      S.strikeLeft = this.easy ? B.WINDOW_EASY : B.WINDOW;
      ap.crankT = 0;
      f.x = L.x; f.y = L.y; f.z = L.z;
      f.heading = headingOf(L.x - I.tip.x, L.z - I.tip.z) + (r() * 2 - 1) * 0.8;
      this.emit("strike", { s: P.style === "slammer" ? 1 : P.style === "soft" ? 0.3 : 0.6, id: P.id });
    }
  }

  lose(reason, ev, extra) {
    const S = this.state;
    S.phase = "lost"; S.reason = reason; S.follower = null;
    if (ev) this.emit(ev, extra);
  }

  /* ---------------- hooked ---------------- */

  hook(hold) {
    const S = this.state, P = this.plan, L = S.lure, r = this.r, sp = P.sp;
    const st = STYLE[P.id] || {};
    const fx = S.follower ? S.follower.x : L.x, fz = S.follower ? S.follower.z : L.z, fy = Math.min(-0.1, S.follower ? S.follower.y : L.y);
    const away = headingOf(fx - this.tip.x, fz - this.tip.z);
    S.follower = null;
    S.phase = "fight";
    S.strikeLeft = 0;
    S.junk = P.junk;
    S.fish = { id: P.id, kg: P.kg, cm: P.cm, len: P.len, x: fx, y: fy, z: fz, heading: away, speed: 0, stamina: P.junk ? 0 : 1, move: P.junk ? "rest" : "swim", jump: 0, near: 0, known: false, thrash: 0 };
    const kg = P.kg;
    const Fmax = P.junk ? 0 : sp.fight.power * Math.pow(kg, 0.8);
    this.F = {
      hold, Fmax, S: P.junk ? 1 : sp.fight.stamina,
      mass: kg * (P.junk ? 3 : REEL.ADDED_MASS),
      // water drag, so the fish's top speed on a run is its burst speed
      c: P.junk ? 9 : Fmax / (sp.fight.speed * sp.fight.speed),
      top: P.junk ? 1 : sp.fight.speed,
      vx: 0, vy: 0, vz: 0,
      goal: away, moveT: 0, moveLen: 0, shakeF: 7, shakePh: 0,
      jumpPh: null, risk: 0, riskW: 0, moveSlackT: 0, moveThrowRolled: false,
      surged: false, surgeCool: 0, style: st, lastMove: "", jumpCool: 0, liftT: 0,
      jolt: 0,
    };
    if (P.junk) {
      this.emit("snag", { id: P.id });
      this.emit("hooked", { id: P.id, junk: true });
      return;
    }
    this.emit("hooked", { id: P.id, junk: false, self: hold > 1 });
    this.startMove(st.first && r() < 0.75 ? st.first : "run");
  }

  // pick the fish's next move from what the species likes to do and how tired it is
  nextMove() {
    const f = this.state.fish, F = this.F, fi = this.plan.sp.fight, s = f.stamina, r = this.r;
    const w = [
      ["run", fi.run * (0.3 + s) * 1.4],
      ["shake", fi.shake * (0.4 + 0.6 * s)],
      ["jump", F.jumpCool > 0 || s < 0.12 ? 0 : fi.jump * (0.3 + 0.9 * s)],
      ["dive", fi.dive * (0.5 + 0.5 * s)],
      ["swim", 0.45],
      ["rest", 0.15 + (1 - s) * 0.9],
    ].filter(([m]) => m !== F.lastMove || m === "swim" || m === "rest");
    this.startMove(pickW(w, r));
  }

  // the way out: away from the rod tip, but always out into the lake, never back under the angler
  awayFrom(f) {
    const T = this.tip, dx = f.x - T.x, dz = f.z - T.z;
    return headingOf(dx, Math.min(dz, -0.5 * Math.abs(dx) - 0.5));
  }

  startMove(m) {
    const S = this.state, f = S.fish, F = this.F, r = this.r, st = F.style;
    const away = this.awayFrom(f);
    f.move = m; F.lastMove = m;
    F.moveT = 0; F.moveSlackT = 0; F.moveThrowRolled = false;
    F.jolt = 0;
    if (m === "run" || m === "surge") {
      F.moveLen = (1 + r() * 3) * (st.runLen || 1) * (m === "surge" ? 1.4 : 0.6 + 0.4 * f.stamina);
      F.goal = away + (r() * 2 - 1) * 0.9;
      // pike and bass head for their cover when it is near
      const cov = COVER[f.id];
      if (cov && m === "run" && r() < 0.6) {
        const tgt = cov[0] === "rocks" ? { x: 50, z: -22 } : { x: -26, z: -16 };
        if (Math.hypot(tgt.x - f.x, tgt.z - f.z) < 40) F.goal = headingOf(tgt.x - f.x, tgt.z - f.z);
      }
      F.jolt = Math.min(REEL.JOLT_N, 0.5 * F.Fmax);
      this.emit(m, { x: f.x, z: f.z });
    } else if (m === "shake") {
      F.moveLen = 0.6 + r() * 0.6;
      F.shakeF = 6 + r() * 2;
      F.shakePh = 0;
      this.emit("shake", { x: f.x, z: f.z, hz: F.shakeF });
    } else if (m === "dive") {
      F.moveLen = 1.5 + r() * 1.5;
      F.goal = away + (r() * 2 - 1) * 0.5;
      this.emit("dive", { x: f.x, z: f.z });
    } else if (m === "jump") {
      // it swims up hard, then leaps
      const dpt = Math.max(0, -f.y);
      F.jumpPh = { rise: 0.3 + Math.min(0.35, dpt * 0.1), air: 0.55 + r() * 0.3 + 0.1 * f.len, t: 0, y0: f.y, top: 0.35 + 0.35 * Math.min(1.5, f.len) };
      F.moveLen = F.jumpPh.rise + F.jumpPh.air + 0.35;
      F.risk = 0; F.riskW = 0;
      F.jumpCool = 3.5;
      this.emit("jump", { x: f.x, z: f.z, size: clamp(f.len, 0.2, 1.5) });
    } else if (m === "swim") {
      F.moveLen = 1 + r() * 1.5;
      F.goal = r() < 0.55 ? away + (r() * 2 - 1) * 1.2 : r() * Math.PI * 2;
    } else {
      F.moveLen = 0.8 + r() * 1.4;
    }
  }

  fight(h, I) {
    const S = this.state, f = S.fish, F = this.F, P = this.plan, R = REEL, r = this.r, T = I.tip;
    S.fightT += h;
    F.moveT += h;
    F.jumpCool -= h;
    F.surgeCool -= h;
    const junk = P.junk;
    const land = S.phase === "land";

    /* the line: a spring from the rod tip, through a rod that bends */
    let lx = T.x - f.x, ly = T.y - f.y, lz = T.z - f.z;
    const dist = Math.hypot(lx, ly, lz) || 1e-6;
    lx /= dist; ly /= dist; lz /= dist;
    // the rod bends when the line pulls across it, and cannot bend when it points down the line
    let rx = T.x - ROD.base.x, ry = T.y - ROD.base.y, rz = T.z - ROD.base.z;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    const along = Math.max(0, -(rx * lx + ry * ly + rz * lz));
    const stiff = Math.pow(along, R.ROD_EXP);
    const kRod = R.ROD_SOFT + (R.ROD_STIFF - R.ROD_SOFT) * stiff;
    const kLine = R.LINE_EA / Math.max(1, S.lineOut);
    const k = 1 / (1 / kRod + 1 / kLine);
    const stretch = dist - S.lineOut;
    let ten = stretch > 0 ? k * stretch : 0;
    // head shakes and the kick of a run travel up a tight line as spikes; a high rod soaks most of them up
    if (f.move === "shake") F.shakePh += h * F.shakeF;
    if (!junk && ten > 1.5 && !land) {
      const cush = R.SHAKE_SOFT + (1 - R.SHAKE_SOFT) * stiff;
      if (f.move === "shake") {
        const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * F.shakePh)), 3);
        ten += R.SHAKE_N * (F.style.shake || 1) * Math.pow(P.kg, 0.7) * (0.3 + 0.7 * f.stamina) * pulse * cush;
      }
      if (F.jolt > 0 && F.moveT < 0.25) ten += F.jolt * (0.3 + 0.7 * f.stamina) * Math.sin(Math.PI * F.moveT / 0.25) * cush;
    }
    // junk drags on the bottom like a dead weight
    if (junk && stretch > -0.2) ten += P.kg * 3;

    /* the reel: the spool slips when the line pulls harder than the drag; cranking into a slipping drag grinds */
    const c = I.crank * (junk ? R.LINE_PER_TURN : R.FIGHT_LINE_PER_TURN);
    const thr = S.dragN + R.GRIND_N * I.crank;
    if (this.spool > 0 || ten > thr) {
      this.spool += (ten - thr - R.SPOOL_B * this.spool) / R.SPOOL_M * h;
      if (this.spool < 0) this.spool = 0;
    }
    // the reel cannot wind a fish up out of the water: once it hangs below the rod tip, cranking stalls
    const stall = Math.max(R.MIN_LINE, T.y - f.y - 0.1);
    S.lineOut = Math.max(Math.min(S.lineOut, stall), S.lineOut - c * h) + this.spool * h;
    S.lineOut = Math.max(R.MIN_LINE, S.lineOut);
    if (this.spool > 0 && ten > thr) ten = Math.max(ten, thr);
    S.tension = ten;
    S.slip = this.spool;
    if (ten > S.breakN) return this.lose("snap", "snap", { reason: "snap" });
    // slack
    if (ten < R.SLACK_N) this.slackT += h; else this.slackT = 0;

    if (junk) return this.moveJunk(h, I, ten, lx, ly, lz);

    /* the fish: where it wants to go, and what the line does to it */
    if (F.moveT >= F.moveLen && !land) this.nextMove();
    const m = f.move;
    const s = f.stamina;
    const dpt = this.depthAt(f.x, f.z);
    // the pull on the fish, bent sideways by the rod swung out to the side (+ steer pulls toward the angler's right)
    const hx = T.x - f.x, hz = T.z - f.z, hl = Math.hypot(hx, hz) || 1;
    const sx = hz / hl, sz = -hx / hl; // the angler's right, looking out at the fish
    const px = lx + sx * I.steer * R.SIDE_BEND, pz = lz + sz * I.steer * R.SIDE_BEND;
    const pl = Math.hypot(px, pz) || 1;
    const pullH = Math.hypot(lx, lz);
    const pxn = px / pl * pullH, pzn = pz / pl * pullH;
    // steering against the fish's sideways run
    const lat = F.vx * sx + F.vz * sz; // + = moving to the angler's right
    let against = 0;
    if (I.steer !== 0) against = Math.abs(lat) > 0.25 ? clamp(-I.steer * Math.sign(lat), 0, 1) * Math.min(1, Math.abs(lat) / 0.8) : Math.abs(I.steer) * 0.5;

    // turning: the fish turns to its goal, the line turns its head toward the pull
    const pullHead = headingOf(pxn, pzn);
    if (!land && (m === "run" || m === "surge" || m === "dive" || m === "swim")) f.heading += clamp(wrap(F.goal - f.heading), -1, 1) * R.TURN_RATE * (0.3 + 0.7 * s) * h;
    const pullFrac = clamp(ten / Math.max(1, F.Fmax), 0, 2);
    f.heading = wrap(f.heading + Math.sin(wrap(pullHead - f.heading)) * R.LINE_TURN * pullFrac * (1 + against) * h);
    if (land) f.heading += wrap(pullHead - f.heading) * Math.min(1, h * 2);
    // a fish turned toward you by the line is being led, not swimming
    const faced = Math.cos(wrap(f.heading - pullHead));
    let thrust = F.Fmax * (0.25 + 0.75 * s) * (land ? 0.1 : MOVE_FORCE[m] || 0.3);
    if (m === "shake") thrust *= 0.6 + 1.2 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * F.shakePh)), 2);
    if (faced > 0.5) thrust *= 0.35;
    let hd = f.heading;
    if (m === "shake") hd += 0.6 * Math.sin(2 * Math.PI * F.shakePh);
    const tx = Math.sin(hd) * thrust, tz = -Math.cos(hd) * thrust;
    // depth: dives go to the bottom, deep fish stay deep, tired fish get lifted by the rod
    const [d0, d1] = P.sp.depth;
    let yT = -clamp(dpt * (F.style.deep ? 0.8 : 0.5), Math.min(d0, dpt - 0.2), Math.min(d1, dpt - 0.2));
    if (m === "dive") yT = -(dpt - 0.3);
    if (land) yT = -0.15;
    const ty = F.Fmax * 0.5 * (0.35 + 0.65 * s) * clamp((yT - f.y) / 1.2, -1, 1);

    const J = F.jumpPh;
    if (m === "jump" && J) {
      J.t += h;
      if (J.t < J.rise) {
        // swimming up for the leap
        const u = J.t / J.rise;
        f.y = J.y0 * (1 - u * u);
        f.jump = 0;
      } else if (J.t < J.rise + J.air) {
        const u = (J.t - J.rise) / J.air;
        f.jump = u;
        f.y = J.top * 4 * u * (1 - u);
        const jx = f.x + Math.sin(f.heading) * 1.2 * h, jz = f.z - Math.cos(f.heading) * 1.2 * h;
        if (this.swim(jx, jz)) { f.x = jx; f.z = jz; }
        if (!f.known) this.reveal();
        // a tight line with the rod high lifts its head in the air: it can throw the hook
        const hi = smooth(R.JUMP_LOW, R.JUMP_HIGH, I.theta), w = Math.sin(Math.PI * u);
        F.risk += (ten / S.breakN) * hi * w * h; F.riskW += w * h;
        if (ten < R.SLACK_N) F.moveSlackT += h;
      } else if (f.jump > 0) {
        f.jump = 0; f.y = -0.1;
        F.vx *= 0.3; F.vz *= 0.3; F.vy = 0;
        this.emit("splash", { x: f.x, z: f.z, size: clamp(f.len * 1.2, 0.3, 1.6) });
        const avg = F.riskW > 0 ? F.risk / F.riskW : 0;
        const p = clamp((avg - 0.03) * R.JUMP_K, 0, R.JUMP_MAX) * F.hold;
        if (r() < p) return this.lose("thrown", "thrown", { jump: true });
        F.jumpPh = null;
        // back in the water it swims off before it does anything else: time to get the rod back up
        this.startMove("swim");
        F.moveLen = 1 + r() * 0.6;
      }
      if (f.jump > 0 || J.t < J.rise) { this.after(h, I, ten, against); return; }
    }

    // move the fish: thrust + line − water drag (drag is implicit, so it never overshoots)
    const M = F.mass;
    F.vx += (tx + pxn * ten) / M * h;
    F.vz += (tz + pzn * ten) / M * h;
    F.vy += (ty + ly * ten * 0.6) / M * h;
    const sp = Math.hypot(F.vx, F.vz);
    // above its burst speed the fish planes at the surface and the drag grows more slowly;
    // a fish led toward you head-first skims along and drags less still
    const toward = sp > 0.05 ? (F.vx * pxn + F.vz * pzn) / (sp * (Math.hypot(pxn, pzn) || 1)) : 0;
    const dragH = F.c * Math.min(sp, F.top) * (toward > 0.5 ? R.TOW : 1) / M * h;
    F.vx /= 1 + dragH; F.vz /= 1 + dragH;
    F.vy /= 1 + F.c * 2 * Math.abs(F.vy) / M * h + 3 * h;
    const nx = f.x + F.vx * h, nz = f.z + F.vz * h;
    if (this.swim(nx, nz) || !this.swim(f.x, f.z)) { f.x = nx; f.z = nz; }
    else {
      // the shore: slide along it if we can, and turn back to open water
      if (this.swim(nx, f.z)) { f.x = nx; F.vz = 0; }
      else if (this.swim(f.x, nz)) { f.z = nz; F.vx = 0; }
      else { F.vx = 0; F.vz = 0; }
      if (m !== "rest" && Math.cos(wrap(F.goal - headingOf(nx - f.x, nz - f.z))) > 0) F.goal = f.heading + Math.PI * (0.6 + 0.8 * r());
    }
    f.y = clamp(f.y + F.vy * h, -Math.max(0.15, dpt - 0.1), -0.05);
    if (f.y <= -Math.max(0.15, dpt - 0.1) && F.vy < 0) F.vy = 0;
    f.speed = Math.hypot(F.vx, F.vz);
    f.jump = 0;
    if (m === "shake" && ten < R.SLACK_N) F.moveSlackT += h;
    this.after(h, I, ten, against);
  }

  // stamina, hooks coming loose, cover, and landing
  after(h, I, ten, against) {
    const S = this.state, f = S.fish, F = this.F, R = REEL, r = this.r, P = this.plan;
    const eff = (f.move === "rest" ? 0.15 : MOVE_FORCE[f.move] || 0.4) * (S.phase === "land" ? 0.2 : 1);
    const fref = Math.pow(Math.max(1, F.Fmax), R.DRAIN_P) * Math.pow(R.DRAIN_F0, 1 - R.DRAIN_P);
    let drain = (R.DRAIN_E * eff + R.DRAIN_T * (ten / fref) * (1 + R.SIDE_DRAIN * against)) / F.S;
    if (ten < R.SLACK_N) drain -= R.RECOVER;
    f.stamina = clamp(f.stamina - drain * h, 0, 1);
    f.near = f.jump > 0 ? 1 : clamp(1 + f.y / 2.2, 0, 1);
    f.thrash = f.move === "shake" || f.jump > 0 ? 1 : f.move === "run" || f.move === "surge" ? 0.6 : 0.2 * f.stamina;
    const dd = Math.hypot(f.x, f.z);
    if (!f.known && dd < 7 && f.near > 0.5) this.reveal();

    // a slack line lets the fish shake the hook out
    if (this.slackT > 2.5 && this.slackT - h <= 2.5 || this.slackT > 4 && ((this.slackT - 2.5) % 1.5) < h) {
      if (r() < R.THROW_LONG * F.hold) return this.lose("thrown", "thrown", { slack: true });
    }
    if ((f.move === "shake" || f.move === "jump") && !F.moveThrowRolled && F.moveSlackT > 0.9) {
      F.moveThrowRolled = true;
      if (r() < R.THROW_SHAKE * F.hold) return this.lose("thrown", "thrown", { slack: true });
    }
    // a fresh fish on a run into its cover can wrap the line and cut it
    const cov = COVER[f.id];
    const T = this.tip, out = (F.vx * (f.x - T.x) + F.vz * (f.z - T.z)) / (Math.hypot(f.x - T.x, f.z - T.z) || 1);
    if (cov && (f.move === "run" || f.move === "surge" || f.move === "dive") && S.phase === "fight" && out > 0.3) {
      const zn = this.zoneAt(f.x, f.z);
      if (cov.includes(zn) && r() < R.COVER_RATE * f.stamina * Math.min(1, out / F.top) * (1 - 0.9 * against) * h) return this.lose(zn === "rocks" ? "rocks" : "weeds", "snap", { reason: zn === "rocks" ? "rocks" : "weeds" });
    }
    // nothing below changes what the fish does while it is in the middle of a leap
    if (f.move === "jump" && F.jumpPh) return;
    // the muskie makes one big run when it sees the dock
    if (f.id === "muskie" && !F.surged && dd < R.MUSKIE_SURGE_R && S.phase === "fight") {
      F.surged = true;
      f.stamina = Math.min(1, f.stamina + 0.3);
      this.startMove("surge");
      F.goal = this.awayFrom(f) + (r() < 0.5 ? -1 : 1) * 0.6;
      return;
    }
    // a small fish wound up to the rod tip is simply swung in
    const wt = P.kg * 9.81, tipH = Math.hypot(f.x - T.x, f.z - T.z);
    if (dd < R.LAND_R + 1 && wt < R.SWING * S.dragN && tipH < 2.5 && f.near > 0.6 && ten > wt * 1.5) { this.caught(true); return; }
    if (S.phase === "fight" && dd < R.LAND_R) {
      if (f.stamina < R.LAND_STAMINA) {
        S.phase = "land"; f.move = "rest"; F.liftT = 0;
        this.reveal();
        this.emit("near", { x: f.x, z: f.z });
      } else if (f.move !== "surge" && F.surgeCool <= 0) {
        // too fresh to land: it bolts from the dock
        this.startMove("surge");
        F.surgeCool = 4;
        F.goal = this.awayFrom(f) + (r() * 2 - 1) * 0.6;
      }
    } else if (S.phase === "land") {
      if (f.stamina >= R.LAND_STAMINA || dd > R.LAND_R + 2) {
        S.phase = "fight"; F.liftT = 0;
        this.startMove("surge");
        return;
      }
      if (I.lift && I.theta > R.LIFT_THETA && ten < S.dragN) F.liftT += h; else F.liftT = 0;
      if (F.liftT >= R.LIFT_TIME) this.caught();
    }
  }

  // junk: no moves, it just drags like a weight until it is at the dock
  moveJunk(h, I, ten, lx, ly, lz) {
    const S = this.state, f = S.fish, F = this.F, R = REEL;
    const M = F.mass;
    F.vx += lx * ten / M * h; F.vz += lz * ten / M * h; F.vy += (ly * ten * 0.5 / M - R.JUNK_SINK) * h;
    const sp = Math.hypot(F.vx, F.vy, F.vz);
    const dr = F.c * sp / M * h + 1.5 * h;
    F.vx /= 1 + dr; F.vy /= 1 + dr; F.vz /= 1 + dr;
    const dpt = this.depthAt(f.x, f.z);
    f.x += F.vx * h; f.z += F.vz * h;
    f.y = clamp(f.y + F.vy * h, -Math.max(0.15, dpt - 0.05), -0.05);
    f.speed = Math.hypot(F.vx, F.vz);
    f.near = clamp(1 + f.y / 2.2, 0, 1);
    const dd = Math.hypot(f.x, f.z), wt = this.plan.kg * 9.81;
    if (dd < R.LAND_R + 1 && wt < R.SWING * S.dragN && Math.hypot(f.x - I.tip.x, f.z - I.tip.z) < 2.5 && ten > wt * 1.5) { this.caught(true); return; }
    if (S.phase === "fight" && dd < R.LAND_R) { S.phase = "land"; F.liftT = 0; this.emit("near", { x: f.x, z: f.z }); }
    if (S.phase === "land") {
      if (I.lift && I.theta > R.LIFT_THETA && ten < S.dragN) F.liftT += h; else F.liftT = 0;
      if (F.liftT >= R.LIFT_TIME) this.caught();
    }
  }

  reveal() {
    const f = this.state.fish;
    if (!f || f.known) return;
    f.known = true;
    this.emit("reveal", { id: f.id, name: this.plan.sp.name });
  }

  caught(swung = false) {
    const S = this.state, P = this.plan;
    S.phase = "caught";
    S.catch = { id: P.id, name: P.sp.name, kg: P.kg, cm: P.cm, junk: P.junk };
    if (S.fish) S.fish.known = true;
    this.emit("caught", { ...S.catch, swung });
  }

  // derived fields for the HUD, and the one-shot "drag" and "slack" events
  publish(dt) {
    const S = this.state, f = S.fish;
    S.tfrac = clamp(S.tension / S.breakN, 0, 2);
    S.bend = clamp(S.tension / REEL.ROD_RATING, 0, 1);
    if (f && (S.phase === "fight" || S.phase === "land" || S.phase === "caught")) {
      S.lure.x = f.x; S.lure.y = f.y; S.lure.z = f.z; S.lure.speed = f.speed;
      S.depth = Math.max(0, -f.y);
      S.lift = this.F ? clamp(this.F.liftT / REEL.LIFT_TIME, 0, 1) : 0;
    } else S.depth = Math.max(0, -S.lure.y);
    if (S.phase === "fight" || S.phase === "land") {
      S.slack = this.slackT > 0.12;
      // one alert per real slack line (it has been slack a while: the fish can throw the hook), not per flicker
      this.slackCool -= dt;
      if (this.slackT > 0.6 && this.slackCool <= 0) { this.emit("slack"); this.slackCool = 3; }
      if (this.slackT === 0) this.slackCool = Math.min(this.slackCool, 0.5);
      if (S.slip > 0.25) { if (this.slipOffT > 1.2) this.emit("drag", { mps: S.slip }); this.slipOffT = 0; }
      else this.slipOffT += dt;
    }
  }
}
