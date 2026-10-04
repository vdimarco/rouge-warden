// Bites and fights: which fish takes the lure, how it follows and strikes, and the fight on the line.
// Pure logic (no DOM, no three.js), deterministic for a given rng, so node can test it: node qa/fish/fight.sim.mjs
// Everything that depends on the place (the map, the gear, the fish, the cover, the legend) comes from the place
// object and fishing.js, so the same code fights a bass at Loon Lake and a tuna at Gull Rock.
import { rng as makeRng, ROD } from "./lake.js";
import { JUNK, byId, lengthFor } from "./species.js";
import { ecology, fishingOf } from "./fishing.js";
import { PLACES, getPlace } from "./places.js";

// the reel, the line and the fight at Loon Lake (gear factor 1). gearScale() gives another place its stronger copy.
// Tuned with qa/fish/fight.sim.mjs and qa/fish/places.sim.mjs
export const REEL = {
  LINE_PER_TURN: 0.75,   // m of line per crank turn (a 5.2:1 spinning reel)
  FIGHT_LINE_PER_TURN: 1.15, // m per turn once a fish is on: game time, so fights last 3 to 70 s, not the minutes of real fishing
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
  GRIND_N: 7.5,          // N per rev/s: cranking while the drag slips adds this much tension...
  GRIND_RAMP: 0.6,       // ...but the drag gives first: the moment the spool slips the grind lets go, and it builds back over
                         // this many s of slipping. A player who stops reeling within that time never snaps the line by it
  GRIND_CAP: 0.85,       // × break: cranking never locks the spool harder than this, so the drag always slips before a break
  SLACK_N: 1,            // N: below this the line is slack
  ADDED_MASS: 1.5,       // a fish moves water with it: its mass feels this much heavier
  TOW: 0.5,              // a fish led toward you head-first drags this much less than one that swims
  SHAKE_N: 6,            // N per kg^0.7: the size of a head-shake spike on a stiff rod
  SHAKE_SOFT: 0.25,      // a high rod passes on only this much of each spike
  JOLT_N: 12,            // N: the kick at the start of a run or surge, on a stiff rod (capped for big fish)
  TURN_RATE: 2.2,        // rad/s: how fast a fresh fish turns to where it wants to go
  LINE_TURN: 3.0,        // rad/s at full pull: how fast the line turns a fish's head
  SIDE_BEND: 0.6,        // steering bends the line pull sideways (tan of the angle: 0.6 is about 30°)
  DRAIN_T: 0.55,         // stamina drain from pulling against the line: × tension / REF_N / stamina seconds
  DRAIN_E: 0.2,          // stamina drain from its own effort
  SIDE_DRAIN: 1.2,       // side pressure against the run drains this much faster
  RECOVER: 0.03,         // /s stamina back while the line is slack
  THROW_LONG: 0.45,      // chance to throw the hook after 2.5 s of slack (and again every 1.5 s)
  THROW_SHAKE: 0.4,      // chance when the line is slack for 0.9 s in a shake or a jump
  JUMP_K: 2,             // throw chance per unit of (tension fraction × rod high) while the fish is in the air
  JUMP_MAX: 0.8,         // ...up to this per jump
  JUMP_LOW: 32,          // deg: a rod below this counts as low for a jump...
  JUMP_HIGH: 58,         // ...and above this as high
  EASY_RISE: 0.2,        // s: in easy mode a jump takes this much longer to rise, so a rod lowered on the cue is down in time
  SELF_HOOK_HOLD: 1.4,   // a fish that hooked itself throws the hook this much more easily
  LAND_R: 3.5,           // m from the dock end to land a fish
  LAND_STAMINA: 0.3,     // tired enough to land below this
  LIFT_THETA: 70,        // deg: hold the rod this high...
  LIFT_TIME: 0.7,        // ...for this long to lift the fish out
  SWING: 0.35,           // a fish lighter than this × the drag (0.6 kg on medium) can be wound up to the tip and swung in
  JUNK_SINK: 0.6,        // m/s²: a waterlogged boot settles back toward the bottom
  // ---- big fish ----
  PULL_KNEE: 1.0,        // × break: a fish's pull grows in full up to the line's break...
  PULL_CAP: 1.7,         // ...then bends over toward this × break, so any size of fish can be fought on any line
  REF_N: 18,             // N: stamina drains by tension / this (the medium drag), not by the fish's own pull
  SIZE_EXP: 0.3,         // a fish twice the middle weight of its kind has 2^0.3 = 1.23 × the stamina
  FAR_DRAIN: 0.45,       // far out it has room to swim and tires slowly (× this at FAR_D m and more)...
  NEAR_D: 8, FAR_D: 40,  // ...close in (NEAR_D m) it tires in full, so it still fights as you bring it in
  BEATEN: 0.12,          // below this stamina a fish rolls up and comes in on its side...
  BEATEN_TOW: 0.15,      // ...and drags this much less...
  BEATEN_THRUST: 0.5,    // ...and swims this much less hard. It starts no tricks (a jump, a tail walk, a charge, a shake or
  BEATEN_THROW: 0.3,     // a thrash), and a long slack throws the hook this much less often
  GRACE_T: 0.8,          // s after the hook set with no grind: the drag just slips ("Fish on! Let it run.")
  OPEN_T: 1,             // s after the hook set: the rod is still high from the pull, so the first leap...
  OPEN_JUMP: 0.4,        // ...throws the hook only this often
  CHARGE_SLACK: 0.7,     // s of slack in a charge before it can throw the hook...
  THROW_CHARGE: 0.35,    // ...with this chance (once per charge)
  CHARGE_V: 3.4,         // m/s: the fastest charge (a crank of 3 rev/s winds 3.45 m/s)
  CHARGE_MIN_D: 12,      // m: a fish charges only from farther out than this...
  CHARGE_END_D: 6,       // m: ...and stops when it is this close
  CHARGE_COOL: 8,        // s between charges
  SULK_MIN_D: 1.5,       // m: a fish sulks only in water deeper than this
  SULK_RECOVER: 0.02,    // /s stamina back while it sulks on the bottom and you do not pump
  PUMP_DEG: 25,          // deg of rod lift with a loaded line = one pump
  PUMP_MIN_T: 0.45,      // × drag: the line must be this tight for a lift to count
  PUMP_DRAIN: 0.05,      // stamina taken by one pump, × 8 / stamina seconds
  PUMP_LIFT: 0.03,       // m/s per deg/s: a lifting rod drags a sulking fish toward you
  WALK_GAP: [0.2, 0.35], // s between the jumps of a tail walk
  THRASH_MUL: 1.8,       // a thrash is a head shake this much bigger...
  THRASH_HZ: [9, 11],    // ...and this fast
  SPIKE_CAP: 0.6,        // × break: the biggest head-shake spike on a stiff rod
  THRASH_LOW: 40, THRASH_HIGH: 65, // deg: a rod below 40 does not soak up a thrash, above 65 it does
  THRASH_BASE: 0.1, THRASH_K: 1.5, THRASH_MAX: 0.45, // hook thrown at the end of a thrash: clamp((risk − BASE) × K, 0, MAX) × hold
  LAST_R: 9,             // m: a fish with fight.last makes its last run when it first comes this close
  LAST_REFILL: 0.3,      // stamina it finds for that run
  COVER_R: 40,           // m: a fish runs for cover this near
  COVER_TURN: 1.2,       // rad/s: a cover run turns away this fast while you steer the right way...
  COVER_DONE: 0.9,       // rad: ...and once it has turned this far, you have turned it
  RUB_T: 1.0,            // s of full rubbing on a snag or rocks to cut the line
  RUB_EMPTY: 1.2,        // s for a full meter to empty once the line is clear
  RUB_COVER: 0.6,        // how hard a fish in its cover zone rubs (a snag or rocks count 1)
  RUB_ROD_CUT: 0.75,     // a rod held high lifts the line off the rocks: rubbing is cut by this much
  RUB_STEER: 0.6,        // steering the way the prompt says takes this share off a snag's rub at once (the fish is pulled over, too)
  RUB_HZ: 30,            // the rub meter is checked this often (per s)
  SPOOL_WARN: 0.75,      // "the spool is almost empty" at this share of the spool...
  SPOOL_REARM: 0.6,      // ...and again after it fell below this
  FLOW_LURE: 0.85,       // the current carries the lure at this share of its speed
  DOWN_RUN: 0.4,         // share of the runs of a river fish that go with the current
};
// every line force scales with the gear factor g (a stronger line, rod and reel), so a fish g^1.25 times heavier fights
// like today's fish on 10 lb line
const GEAR_KEYS = ["BREAK_N", "ROD_SOFT", "ROD_STIFF", "ROD_RATING", "SPOOL_M", "SPOOL_B", "GRIND_N", "SLACK_N", "LINE_EA", "SHAKE_N", "JOLT_N", "REF_N"];
// the reel of a place: gear = { g, spool } from fishing.js. Returns a copy of REEL (G = g, SPOOL_MAX = m of line on the reel).
// A place can also set how fast its line rubs through (rubT, rubCover): the stumps and the rocks are not the same
export function gearScale(gear) {
  const g = gear && Number.isFinite(gear.g) && gear.g > 0 ? gear.g : 1, R = { ...REEL };
  for (const k of GEAR_KEYS) R[k] = REEL[k] * g;
  R.DRAG_N = REEL.DRAG_N.map((d) => d * g);
  R.SPOOL_MAX = gear && Number.isFinite(gear.spool) && gear.spool > 0 ? gear.spool : 150;
  R.G = g;
  if (gear && gear.rubT > 0) R.RUB_T = gear.rubT;
  if (gear && gear.rubCover >= 0) R.RUB_COVER = gear.rubCover;
  return R;
}

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
  TROPHY: 1 / 25,        // share of fish above the usual range (at no boost)
  FAR0: 15, FAR1: 45,    // m: casts past FAR0 find bigger fish, fully at FAR1...
  FAR_BOOST: 0.8,        // ...by this much (see rollWeight)
  RING_BOOST: 0.5,       // a rising fish is a feeding fish: bigger
};

// the moves a beaten fish no longer starts
const TRICKS = ["shake", "jump", "walk", "charge", "thrash"];
const MOVE_FORCE = { run: 1, surge: 1.35, shake: 0.35, dive: 0.8, swim: 0.45, rest: 0.15, jump: 1, charge: 1.1, sulk: 0.5, thrash: 0.4, hold: 0.1, turn: 0.4 };
const ZERO = Object.freeze({ x: 0, z: 0 });

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const D2R = Math.PI / 180;
// heading: 0 = toward −z, + = toward +x
const headingOf = (dx, dz) => Math.atan2(dx, -dz);
// a place object (or its id, or nothing) to a place
const placeOf = (p) => (typeof p === "string" ? getPlace(p) : p && p.stand && p.zone && p.depth ? p : PLACES.loon);

// the unbent rod tip for a rod angle, a heading and a steer (spec §2). rod: the rod of the place (its stand.rod)
export function rodTip(theta, yaw = 0, steer = 0, rod = ROD) {
  const t = fin(theta, 45) * D2R, y = (fin(yaw, 0) + 35 * clamp(fin(steer, 0), -1, 1)) * D2R;
  return { x: rod.base.x + rod.length * Math.sin(y) * Math.cos(t), y: rod.base.y + rod.length * Math.sin(t), z: rod.base.z - rod.length * Math.cos(y) * Math.cos(t) };
}

// the time-of-day multiplier for a fish at a place (eco: its row in fishing.js ecology())
function hourMul(eco, hour) {
  let m = 1;
  for (const [a, b, x] of eco.hours || []) if (hour >= a && hour <= b) m = Math.max(m, x);
  return m;
}
// how well the water depth suits a fish at a place
function depthFit(eco, d) {
  const [a, b] = eco.depth;
  if (d < a) return Math.max(0.15, d / a);
  if (d > b) return Math.max(0.15, b / d);
  return 1;
}
// every species that could bite at a spot of a place (a place or its id), with its weight
export function speciesWeights(zn, d, hour, ring = null, place = PLACES.loon) {
  const out = [];
  for (const [sp, eco] of ecology(place)) {
    let w = (eco.zones[zn] || 0);
    if (ring && ring.species === sp.id) w = Math.max(w, 1) * BITE.RING_MUL;
    w *= eco.rarity * hourMul(eco, hour) * depthFit(eco, d);
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
// a weight: most fish are mid-range (a triangle, with its middle at the middle of the range), and about 1 in 25 is
// above the range, on a long rare tail up to the trophy. A boost (a long cast, a ring) shifts the roll up:
// at boost 1.3, about 1 in 11 is above the range
export function rollWeight(sp, r, boost = 0) {
  const [a, b] = sp.kg;
  let kg;
  if (sp.trophy && r() < BITE.TROPHY * (1 + boost)) kg = b + (sp.trophy - b) * Math.pow(r(), 1.5);
  else { const t = (r() + r()) / 2; kg = a + (b - a) * (1 - Math.pow(1 - t, 1 + boost)); }
  return Math.round(kg * 100) / 100;
}
// how big a fish is for its kind, 0..1: the share of rollWeight's fish (at no boost) that are lighter
export function sizeRank(sp, kg) {
  const [a, b] = sp.kg, T = sp.trophy, pt = T ? BITE.TROPHY : 0;
  if (kg <= a) return 0;
  if (kg <= b) { const u = (kg - a) / (b - a), F = u <= 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u); return (1 - pt) * F; }
  return T ? 1 - pt + pt * Math.pow(Math.min(1, (kg - b) / (T - b)), 1 / 1.5) : 1;
}
// how much a fish likes the lure at this speed (0..1)
function likeSpeed(sp, s) {
  const [lo, hi] = sp.lure;
  if (s < lo) return 0.45 + 0.55 * s / lo;
  if (s <= hi) return 1;
  return Math.max(0.12, 1 - (s - hi) / (1.5 * hi));
}

// A brand-new player's first cast in the water (main.js): a sure bite from a small, easy fish of Loon Lake, a pumpkinseed
// in the pads and the weeds and by the dock, a perch anywhere else, eager to bite (it comes close at once, does not mind a
// fast retrieve, and takes the lure before it is home). Pass it to LakeSim as its test hooks
export function firstBite(zn, r = Math.random) {
  const id = zn === "pads" || zn === "weeds" || zn === "dock" ? "pumpkinseed" : "perch", [a, b] = byId(id).kg;
  return { species: id, kg: Math.round((a + (Math.min(b, 0.45) - a) * (0.3 + 0.5 * r())) * 100) / 100, bite: true, eager: true };
}

/* ---------------- rising fish: the rings you cast at ---------------- */

export class Rises {
  // place: the place whose rings these are (its legend and ring distances are in fishing.js)
  constructor(rng, place = PLACES.loon) {
    this.pl = placeOf(place);
    this.r = typeof rng === "function" ? rng : makeRng(1);
    this.list = [];
    this.spawnT = 0;
    this.hour = 12;
  }
  // is the legend of the place rising at this hour?
  static golden(hour, place = PLACES.loon) { return fishingOf(place).legend.hours.some(([a, b]) => hour >= a && hour <= b); }

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
    const r = this.r, hour = this.hour, P = this.pl, F = fishingOf(P), L = F.legend, R0 = F.rings;
    const gold = Rises.golden(hour, P) && !this.list.some((g) => g.gold) && r() < 0.12;
    for (let i = 0; i < 60; i++) {
      const d = gold ? L.ring[0] + r() * (L.ring[1] - L.ring[0]) : R0[0] + r() * (R0[1] - R0[0]), a = (r() * 2 - 1) * 70 * D2R;
      const x = Math.sin(a) * d, z = -Math.cos(a) * d;
      if (this.list.some((g) => Math.hypot(g.x - x, g.z - z) < 8)) continue;
      const zn = P.zone(x, z);
      if (zn === "land" || P.depth(x, z) < 0.6) continue;
      // the legend rises in one kind of water (Stump Bay: the creek bed)
      if (gold && L.zone && zn !== L.zone) continue;
      if (gold) return { x, z, ttl: 18 + r() * 12, species: L.id, gold: true, pulse: 1 + r() * 2 };
      const sp = pickW(speciesWeights(zn, P.depth(x, z), hour, null, P), r);
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

/* ---------------- the water around the lure ---------------- */

// How main.js drives it, once per frame after the lure lands:
//   const sim = new LakeSim({ place, lure: {x, z}, tip, lineOut: flight.lineOut, hour, ring: rises.near(x, z), rng: rng(seed) });
//   sim.step(dt, { crank, tip: rodTip(theta, yaw, steer, place.stand.rod), theta, omega, steer, drag, hookset, lift });
//   for (const e of sim.events.splice(0)) ...;  then draw from sim.state.
// Pass the unbent tip from rodTip(): the rod's bend is already inside the line physics, and world.setRod can bend it
// for the picture from state.bend. If a ring's fish is hooked, call rises.take(ring).
// sim.R is the reel of the place (gearScale): its break and drag settings are in state.breakN and state.dragN.
export class LakeSim {
  // opts: { place = Loon Lake, lure, tip, lineOut, hour, ring, rng, easy = true }
  // test hooks: species (force a fish or junk by id), kg (force its weight), bite (true/false forces a bite or none),
  // eager (the fish comes and takes the lure sooner, at any retrieve speed: firstBite uses it)
  constructor(opts = {}) {
    const o = opts || {};
    this.pl = placeOf(o.place);
    this.fx = fishingOf(this.pl);           // the fish, gear, cover and legend of this place
    this.R = gearScale(this.fx.gear);
    this.rod = this.pl.stand.rod;
    this.r = typeof o.rng === "function" ? o.rng : makeRng((Math.random() * 4294967296) >>> 0);
    this.easy = o.easy !== false;
    this.hour = fin(o.hour, 12);
    this.ring = o.ring || null;
    const lx = fin(o.lure && o.lure.x, 0), lz = fin(o.lure && o.lure.z, -15);
    this.tip = this.cleanTip(o.tip, null) || rodTip(45, headingOf(lx, lz) / D2R, 0, this.rod);
    const d0 = Math.hypot(lx - this.tip.x, this.tip.y, lz - this.tip.z);
    this.zone = this.pl.zone(lx, lz);
    this.water = this.pl.depth(lx, lz);
    const R = this.R;
    this.state = {
      phase: "sink",
      lure: { x: lx, y: 0, z: lz, speed: 0 },
      lineOut: Math.max(R.MIN_LINE, fin(o.lineOut, d0)),
      tension: 0, tfrac: 0, slip: 0, slack: true,
      dragN: R.DRAG_N[1], breakN: R.BREAK_N, dragFrac: R.DRAG_N[1] / R.BREAK_N,
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
      // the new moves and places
      rub: 0,          // 0..1: the line rubs on a snag, rocks or weeds. At 1 it is cut
      rubSide: 0,      // -1 | 0 | 1: the way to steer to clear it (+ is right)
      rubKind: "",     // "stump" | "logs" | "rocks" | "weeds" ("" when there is no rub)
      spoolFrac: 0,    // line out / spool. At 1 the fish has it all
      beaten: false,   // the fish is worn out: it rolls up and comes in
      cover: null,     // { side, steer, kind } while the fish runs for cover: steer this way to turn it
      boss: null,      // { n, of, name, at: [stamina where the next phases start] } for a legend
      flow: { x: 0, z: 0 }, // the current at the lure (m/s)
      slackT: 0,       // s the line has been slack in the fight (the gauge says SLACK, the prompt says to reel)
      cause: "",       // why the line snapped: "grind" (cranked into the drag) | "rodlow" | "drag" (set too heavy) | "shake" | ""
    };
    this.events = [];
    this.theta = 45; this.crank = 0;
    this.slackT = 0; this.slackCool = 0; this.slipOffT = 9; this.spool = 0; this.slipT = 0;
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
    const r = this.r, zn = this.zone, ring = this.ring, fx = this.fx;
    const forced = o.species ? byId(o.species) : null;
    if (zn === "land" && !forced) return null;
    let p = ring ? BITE.RING : fx.goodZones.includes(zn) ? BITE.GOOD : BITE.OPEN;
    if (o.bite === true || forced) p = 1;
    if (o.bite === false) p = 0;
    if (r() >= p) return null;
    let sp = forced;
    if (!sp) {
      const dockNear = zn === "dock" || Math.hypot(this.state.lure.x, this.state.lure.z) < fx.junkR;
      if (!ring && r() < BITE.JUNK * (dockNear ? BITE.JUNK_DOCK : 1)) {
        // plungers and frisbees sit by the dock at Loon Lake; boots are everywhere
        const J = fx.junk.map(byId);
        sp = dockNear ? J[(r() * J.length) | 0] : r() < 0.7 ? J[0] : J[(r() * J.length) | 0];
      } else if (ring && ring.gold) sp = byId(fx.legend.id);
      else sp = pickW(speciesWeights(zn, this.water, this.hour, ring, this.pl), r);
    }
    if (!sp) return null;
    const junk = JUNK.includes(sp);
    const inRing = !!(ring && (ring.species === sp.id || ring.gold));
    // a long cast, or a fish from a ring, is a bigger fish
    const boost = BITE.FAR_BOOST * smooth(BITE.FAR0, BITE.FAR1, Math.hypot(this.state.lure.x, this.state.lure.z)) + (inRing ? BITE.RING_BOOST : 0);
    const kg = Number.isFinite(o.kg) ? o.kg : junk ? Math.round((sp.kg[0] + (sp.kg[1] - sp.kg[0]) * r()) * 100) / 100 : rollWeight(sp, r, boost);
    const style = junk ? "junk" : sp.bite;
    // a short cast leaves little time before the lure is home, so fish near the dock make up their minds faster
    const avail = (Math.hypot(this.state.lure.x, this.state.lure.z) - BITE.HOME_R) / 0.8;
    const quick = clamp(avail / 16, 0.3, 1);
    return {
      sp, junk, kg, id: sp.id,
      cm: junk ? 0 : lengthFor(sp, kg),
      len: junk ? 0.3 : Math.max(0.1, lengthFor(sp, kg) / 100),
      style,
      // (an eager fish, the first fish of a new player, comes sooner and takes the lure after one nibble at most)
      notice: ((inRing ? 0.5 + r() * 1.5 : 1 + r() * 4) + (junk ? 1 + r() * 4 : 0)) * quick * (o.eager ? 0.4 : 1),
      commit: Math.max(0.8, (style === "slammer" ? 1.4 + r() * 2 : style === "soft" ? 2 + r() * 2.5 : 2.5 + r() * 2.5) * (inRing ? 0.7 : 1) * quick * (o.eager ? 0.5 : 1)),
      nibbles: Math.min(o.eager ? 1 : 3, style === "nibbler" ? (r() < 0.1 ? 0 : 1 + ((r() * 3) | 0)) : style === "soft" ? (r() < 0.5 ? 1 : 0) : 0),
      pauseNeed: 0.5 + r(),
      quick,
      eager: !!o.eager,
    };
  }

  cleanTip(t, fallback) {
    if (t && Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z)) return { x: t.x, y: t.y, z: t.z };
    return fallback;
  }

  // the water depth, zone and current under a point, cached because the map is not cheap
  depthAt(x, z) {
    const b = this.bottom;
    if (!(Math.abs(b.x - x) < 0.02 && Math.abs(b.z - z) < 0.02)) { b.x = x; b.z = z; b.d = this.pl.depth(x, z); }
    return b.d;
  }
  // a fish can swim here: water, and not behind the angler (the game looks out at the water)
  swim(x, z) { return z < 1.5 && this.pl.depth(x, z) >= 0.1; }
  zoneAt(x, z) {
    const b = this.zc || (this.zc = { x: NaN, z: NaN, zn: "" });
    if (!(Math.abs(b.x - x) < 0.5 && Math.abs(b.z - z) < 0.5)) { b.x = x; b.z = z; b.zn = this.pl.zone(x, z); }
    return b.zn;
  }
  flowAt(x, z) {
    if (!this.pl.flow) return ZERO;
    const b = this.fc || (this.fc = { x: NaN, z: NaN, v: ZERO });
    if (!(Math.abs(b.x - x) < 0.5 && Math.abs(b.z - z) < 0.5)) { b.x = x; b.z = z; b.v = this.pl.flow(x, z); }
    return b.v;
  }

  step(dt, inp = {}) {
    const S = this.state;
    if (S.phase === "caught" || S.phase === "lost" || S.phase === "home") return S;
    dt = clamp(fin(dt, 0), 0, this.R.MAX_DT);
    if (dt <= 0) return S;
    const i = inp || {};
    const crank = clamp(fin(i.crank, 0), 0, this.R.MAX_CRANK);
    const theta = clamp(fin(i.theta, this.theta), -90, 270);
    const steer = clamp(fin(i.steer, 0), -1, 1);
    const di = clamp(Math.round(fin(i.drag, 1)), 0, 2);
    S.dragN = this.R.DRAG_N[di];
    S.dragFrac = S.dragN / S.breakN;
    const from = this.tip;
    const to = this.cleanTip(i.tip, null) || rodTip(theta, this.aimYaw(), steer, this.rod);
    const n = Math.max(1, Math.ceil(dt / this.R.STEP - 1e-9)), h = dt / n;
    const I = { crank, pull: clamp(fin(i.pull, 0), 0, 1), theta, omega: fin(i.omega, 0), steer, hookset: !!i.hookset, lift: !!i.lift, tip: { ...from } };
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
    const S = this.state, L = S.lure, B = BITE, R = this.R;
    if (S.phase === "sink" && I.crank > 0.05) S.phase = "retrieve";
    // no fish on its way: after a few seconds the retrieve speeds up
    const empty = !this.ap || this.ap.stage === "gone";
    this.emptyT = empty && S.phase === "retrieve" ? (this.emptyT || 0) + h : 0;
    const fast = 1 + (B.EMPTY_MUL - 1) * clamp(this.emptyT - B.EMPTY_T, 0, 1);
    S.empty = fast > 1;
    const c = I.crank * R.LINE_PER_TURN * fast;
    S.lineOut = Math.max(R.MIN_LINE, S.lineOut - c * h);
    const px = L.x, pz = L.z;
    const f = S.phase === "strike" ? S.follower : null;
    if (f) {
      // the fish has the lure in its mouth and turns away with it
      const a = f.heading;
      f.x += Math.sin(a) * 0.45 * h; f.z -= Math.cos(a) * 0.45 * h;
      L.x = f.x; L.y = f.y; L.z = f.z;
    } else {
      // the current carries the lure; the line swings it across on its arc
      const fl = this.flowAt(L.x, L.z);
      if (fl !== ZERO) { L.x += fl.x * R.FLOW_LURE * h; L.z += fl.z * R.FLOW_LURE * h; }
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
    // the speed of the lure is its speed through the water, not over the bottom
    const flw = f ? ZERO : this.flowAt(L.x, L.z);
    const inst = Math.hypot(L.x - px - flw.x * h, L.z - pz - flw.z * h) / h;
    L.speed += (inst - L.speed) * Math.min(1, h / 0.2);
    const tight = hd >= need - 0.05;
    S.slack = !tight;
    // what the line feels: the pull of the lure through the water, or a fish holding it (a stronger outfit feels it × g)
    S.tension = R.G * (f ? 3 + 3 * Math.sqrt(this.plan.kg) * (tight ? 1 : 0.3) : tight ? 0.4 + 2.2 * L.speed * L.speed : 0);
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
    // the time to set the hook: a hard-mouthed fish gives less (species window)
    const win = (this.easy ? B.WINDOW_EASY : B.WINDOW) * (P.sp.window ? P.sp.window / B.WINDOW : 1);
    if (S.phase === "strike") {
      S.strikeLeft -= h;
      if (I.crank >= 0.4) ap.crankT += h;
      if (I.hookset) return this.hook(1);
      if (S.strikeLeft <= 0) {
        if (this.easy && ap.crankT >= 0.7 * win && r() < B.SELF_HOOK) return this.hook(this.R.SELF_HOOK_HOLD);
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
      // (an eager fish shows up right behind the lure)
      const away = headingOf(L.x - I.tip.x, L.z - I.tip.z) + (r() * 2 - 1) * 0.7, d = (2 + r() * 2.5) * (0.5 + 0.5 * P.quick) * (P.eager ? 0.4 : 1);
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
    // (an eager fish likes the lure at any speed: a new player who cranks fast still gets the bite)
    const like = P.eager ? Math.max(0.6, likeSpeed(P.sp, L.speed)) : likeSpeed(P.sp, L.speed);
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
    // last chance: the lure is about to leave the water (an eager fish always takes it then)
    if (!strike && (ap.interest >= 0.45 || P.eager) && Math.hypot(L.x, L.z) < B.HOME_R + 2) strike = P.eager || r() < 1.5 * h;
    if (strike) {
      S.phase = "strike"; S.tooFast = false;
      S.strikeLeft = win;
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
    const S = this.state, P = this.plan, L = S.lure, r = this.r, sp = P.sp, R = this.R;
    const fi = sp.fight || {};
    // the character of the fish: how it opens, how long it runs, whether it stays deep, how hard it shakes, whether it runs with the current
    const st = { first: fi.first, runLen: fi.runLen, deep: !!fi.deep, shake: fi.shakeMul, down: !!fi.down };
    const fx = S.follower ? S.follower.x : L.x, fz = S.follower ? S.follower.z : L.z;
    // (the bed under the fish, not under the lure)
    const fy = clamp(Math.min(-0.1, S.follower ? S.follower.y : L.y), -Math.max(0.15, this.depthAt(fx, fz) - 0.1), -0.1);
    const away = headingOf(fx - this.tip.x, fz - this.tip.z);
    S.follower = null;
    S.phase = "fight";
    S.strikeLeft = 0;
    S.junk = P.junk;
    S.fish = { id: P.id, kg: P.kg, cm: P.cm, len: P.len, x: fx, y: fy, z: fz, heading: away, speed: 0, stamina: P.junk ? 0 : 1, move: P.junk ? "rest" : "swim", jump: 0, near: 0, known: false, thrash: 0 };
    const kg = P.kg;
    // the pull grows with size up to the line's break, then bends over toward PULL_CAP × break
    const raw = P.junk ? 0 : fi.power * Math.pow(kg, 0.8);
    const knee = R.PULL_KNEE * S.breakN, cap = R.PULL_CAP * S.breakN;
    const Fmax = raw <= knee ? raw : knee + (cap - knee) * (1 - Math.exp(-(raw - knee) / (cap - knee)));
    // a heavy fish of its kind lasts longer, but not in full proportion
    const mid = (sp.kg[0] + sp.kg[1]) / 2;
    const stam = P.junk ? 1 : fi.stamina * Math.pow(Math.max(0.05, kg / mid), R.SIZE_EXP);
    this.F = {
      hold: hold * (fi.hold || 1), Fmax, S: stam,
      mass: kg * (P.junk ? 3 : R.ADDED_MASS),
      // water drag, so the fish's top speed on a run is its burst speed
      c: P.junk ? 9 : Fmax / (fi.speed * fi.speed),
      top: P.junk ? 1 : fi.speed,
      vx: 0, vy: 0, vz: 0,
      goal: away, moveT: 0, moveLen: 0, shakeF: 7, shakePh: 0,
      jumpPh: null, risk: 0, riskW: 0, moveSlackT: 0, moveThrowRolled: false,
      surgeCool: 0, style: st, base: st, lastMove: "", jumpCool: 0, liftT: 0,
      jolt: 0,
      // state of the new moves, the boss phases, the rub meter and the spool
      chargeCool: 0, walkLeft: 0, walking: false, nextJump: false, trisk: 0, triskW: 0, pumpDeg: 0, pumpN: 0, pumpNeed: 2, pumpIdle: 9,
      lastRolled: false, moves: null, bossPhase: -1, pendingPhase: -1, opening: 0,
      coverRun: false, coverSide: 0, coverTurn: 0,
      rubAcc: 0, rubOn: false, rubWarned: false, spoolWarn: false, beatenSaid: false,
    };
    if (P.junk) {
      this.emit("snag", { id: P.id });
      this.emit("hooked", { id: P.id, junk: true });
      return;
    }
    this.emit("hooked", { id: P.id, junk: false, self: hold > 1 });
    if (sp.boss) return this.startPhase(0);
    this.startMove(st.first && r() < 0.75 ? st.first : "run");
  }

  // a legend fights in phases. Between phases it rests (your arm rests too), then comes back fresher
  startPhase(i) {
    const F = this.F, S = this.state, f = S.fish, boss = this.plan.sp.boss, ph = boss.phases[i];
    F.bossPhase = i; F.pendingPhase = -1;
    F.moves = ph.moves || null;
    F.style = ph.runLen ? { ...F.base, runLen: ph.runLen } : F.base;
    if (i > 0) f.stamina = Math.min(1, f.stamina + (ph.refill || 0));
    S.boss = { n: i + 1, of: boss.phases.length, name: ph.name, at: boss.phases.slice(1).map((q) => q.at) };
    this.emit("phase", { n: i + 1, of: boss.phases.length, name: ph.name });
    this.startMove(ph.first || "run");
    // an opening move with a set length (the tuna's long first run) plays out before the next rest
    F.opening = ph.len ? ph.len : 0;
    if (ph.len) F.moveLen = ph.len;
  }

  // pick the fish's next move from what the species likes to do and how tired it is
  nextMove() {
    const f = this.state.fish, F = this.F, R = this.R, fi = F.moves ? Object.assign({}, this.plan.sp.fight, F.moves) : this.plan.sp.fight, s = f.stamina, r = this.r;
    // a beaten fish (TIRED, in its last stage) has no tricks left: it only swims, runs, dives, sulks and rests
    const boss = this.plan.sp.boss, beaten = s < R.BEATEN && (!boss || F.bossPhase === boss.phases.length - 1);
    if (F.nextJump) {
      F.nextJump = false;
      if (!beaten) return this.startMove("jump");
      // (it was in a tail walk: the walk is over)
      F.walkLeft = 0;
      if (F.walking) { F.walking = false; this.emit("walkEnd"); }
    }
    const dd = Math.hypot(f.x, f.z), dpt = this.depthAt(f.x, f.z);
    const w = [
      ["run", fi.run * (0.3 + s) * 1.4],
      ["shake", fi.shake * (0.4 + 0.6 * s)],
      ["jump", F.jumpCool > 0 || s < 0.12 ? 0 : fi.jump * (0.3 + 0.9 * s)],
      ["dive", fi.dive * (0.5 + 0.5 * s)],
      ["swim", 0.45],
      ["rest", 0.15 + (1 - s) * 0.9],
      ["charge", fi.charge && dd > R.CHARGE_MIN_D && F.chargeCool <= 0 && s > 0.15 ? fi.charge * (0.2 + 0.8 * s) : 0],
      ["sulk", fi.sulk && dpt > R.SULK_MIN_D ? fi.sulk * (0.5 + 0.5 * (1 - s)) : 0],
      ["walk", fi.walk && F.jumpCool <= 0 && s >= 0.2 ? fi.walk * (0.3 + 0.9 * s) : 0],
      ["thrash", fi.thrash ? fi.thrash * (0.4 + 0.6 * s) : 0],
    ].filter(([m, x]) => x > 0 && !(beaten && TRICKS.includes(m)) && (m !== F.lastMove || m === "swim" || m === "rest"));
    this.startMove(pickW(w, r));
  }

  // the way out: away from the rod tip, but always out into the lake, never back under the angler
  awayFrom(f) {
    const T = this.tip, dx = f.x - T.x, dz = f.z - T.z;
    return headingOf(dx, Math.min(dz, -0.5 * Math.abs(dx) - 0.5));
  }

  // the nearest snag (a stump or a log post) 1..range m from a fish
  nearSnag(f, range) {
    const list = this.pl.snagNear(f.x, f.z);
    let best = null, bd = range;
    for (const s of list) { const d = Math.hypot(s.x - f.x, s.z - f.z); if (d < bd && d > 1) { bd = d; best = s; } }
    return best;
  }
  // where a fish runs for cover: the nearest spot of the kinds it likes, within COVER_R (a legend that is told to run for
  // cover runs for the nearest spot however far it is). { x, z, kind } or null
  coverTarget(f, forced) {
    const kinds = this.fx.cover[f.id];
    if (!kinds) return null;
    let best = null, bd = forced ? Infinity : this.R.COVER_R;
    for (const k of kinds) {
      const c = this.fx.coverAt[k];
      if (!c) continue;
      if (c.at) {
        for (const p of c.at) { const d = Math.hypot(p.x - f.x, p.z - f.z); if (d < bd) { bd = d; best = { x: p.x, z: p.z, kind: k }; } }
      } else if (c.snag) {
        const s = this.nearSnag(f, c.snag);
        if (s) { const d = Math.hypot(s.x - f.x, s.z - f.z); if (d < bd) { bd = d; best = { x: s.x, z: s.z, kind: k }; } }
      } else if (c.feet && Math.hypot(f.x, f.z) < c.feet) {
        // the rocks at the angler's feet: a spot by the wall, a little to one side or the other
        const t = { x: (this.r() - 0.5) * 6, z: -1.5 }, d = Math.hypot(t.x - f.x, t.z - f.z);
        if (d < bd) { bd = d; best = { x: t.x, z: t.z, kind: k }; }
      }
    }
    return best;
  }
  // + if a spot is to the angler's right of the line to the fish, - if it is to the left
  sideOf(f, x, z) {
    const T = this.tip, hx = T.x - f.x, hz = T.z - f.z, hl = Math.hypot(hx, hz) || 1;
    return Math.sign((x - f.x) * (hz / hl) + (z - f.z) * (-hx / hl)) || 1;
  }

  startMove(m) {
    const S = this.state, f = S.fish, F = this.F, r = this.r, st = F.style, R = this.R;
    const away = this.awayFrom(f);
    let forceCover = false;
    if (m === "cover") { m = "run"; forceCover = true; }
    if (m === "sulk" && this.depthAt(f.x, f.z) <= R.SULK_MIN_D) m = "dive";
    if (m === "walk") {
      // a tail walk: two to four jumps in a row
      F.walkLeft = 1 + ((r() * 3) | 0);
      this.emit("walk", { n: F.walkLeft + 1, x: f.x, z: f.z });
      m = "jump";
    }
    f.move = m; F.lastMove = m;
    F.moveT = 0; F.moveSlackT = 0; F.moveThrowRolled = false;
    F.jolt = 0; F.coverRun = false; S.cover = null; F.opening = 0;
    if (m === "run" || m === "surge") {
      F.moveLen = (1 + r() * 3) * (st.runLen || 1) * (m === "surge" ? 1.4 : 0.6 + 0.4 * f.stamina);
      F.goal = away + (r() * 2 - 1) * 0.9;
      // it heads for its cover when it is near: say which way, so the player can steer the other way
      const tgt = m === "run" && (forceCover || r() < 0.6) ? this.coverTarget(f, forceCover) : null;
      if (tgt) {
        F.goal = headingOf(tgt.x - f.x, tgt.z - f.z);
        F.coverRun = true; F.coverTurn = 0;
        F.coverSide = this.sideOf(f, tgt.x, tgt.z);
        S.cover = { side: F.coverSide, steer: -F.coverSide, kind: tgt.kind };
        this.emit("cover", { side: F.coverSide, steer: -F.coverSide, kind: tgt.kind, x: f.x, z: f.z });
        if (forceCover) F.moveLen = Math.max(F.moveLen, 3);
      } else if (m === "run" && st.down && this.pl.flow && (forceCover || r() < R.DOWN_RUN)) {
        // salmon and steelhead run with the current (and a legend that "runs down the river" always does, if no cover is near)
        const fl = this.flowAt(f.x, f.z);
        if (Math.hypot(fl.x, fl.z) > 0.2) F.goal = headingOf(fl.x, fl.z) + (r() * 2 - 1) * 0.5;
      }
      F.jolt = Math.min(R.JOLT_N, 0.5 * F.Fmax);
      this.emit(m, { x: f.x, z: f.z });
    } else if (m === "shake" || m === "thrash") {
      const th = m === "thrash";
      F.moveLen = th ? 1.5 + r() : 0.6 + r() * 0.6;
      F.shakeF = th ? R.THRASH_HZ[0] + r() * (R.THRASH_HZ[1] - R.THRASH_HZ[0]) : 6 + r() * 2;
      F.shakePh = 0; F.trisk = 0; F.triskW = 0;
      this.emit(m, { x: f.x, z: f.z, hz: F.shakeF });
    } else if (m === "dive") {
      F.moveLen = 1.5 + r() * 1.5;
      F.goal = away + (r() * 2 - 1) * 0.5;
      this.emit("dive", { x: f.x, z: f.z });
    } else if (m === "jump") {
      // it swims up hard, then leaps; in a tail walk the leaps are lower and quicker
      const dpt = Math.max(0, -f.y), walk = F.walkLeft > 0 || F.walking;
      const rise = 0.3 + Math.min(0.35, dpt * 0.1) + (this.easy && !this.plan.sp.legend ? R.EASY_RISE : 0);
      F.jumpPh = { rise, air: walk ? 0.45 + r() * 0.2 : 0.55 + r() * 0.3 + 0.1 * f.len, t: 0, y0: f.y, top: (walk ? 0.25 : 0.35) + (walk ? 0.25 : 0.35) * Math.min(1.5, f.len), open: S.fightT < R.OPEN_T };
      F.moveLen = F.jumpPh.rise + F.jumpPh.air + 0.35;
      F.risk = 0; F.riskW = 0;
      F.jumpCool = 3.5;
      this.emit("jump", { x: f.x, z: f.z, size: clamp(f.len, 0.2, 1.5), walk });
    } else if (m === "charge") {
      // it swims straight at you: the line goes slack unless you reel fast
      F.moveLen = 0.3 + 1.2 + r() * 0.8; // 0.3 s wind-up: it turns to face you, and the line goes light
      F.chargeCool = R.CHARGE_COOL;
      const T = this.tip;
      F.goal = headingOf(T.x - f.x, T.z - f.z);
      this.emit("charge", { x: f.x, z: f.z });
    } else if (m === "sulk") {
      // it holds on the bottom: the reel cannot move it, only a lifting rod can
      F.moveLen = 5 + r() * 3;
      F.pumpDeg = 0; F.pumpN = 0; F.pumpNeed = 2 + ((r() * 2) | 0); F.pumpIdle = 0;
      this.emit("sulk", { x: f.x, z: f.z });
    } else if (m === "hold") {
      // a legend between phases: it hangs in the water and gets its breath. The move length is set by the caller
      F.moveLen = 4;
      this.emit("rest", { x: f.x, z: f.z });
    } else if (m === "turn") {
      F.moveLen = 0.6 + r() * 0.2;
      F.goal = away + (r() * 2 - 1) * 0.6;
      this.emit("turn", { x: f.x, z: f.z });
    } else if (m === "swim") {
      F.moveLen = 1 + r() * 1.5;
      F.goal = r() < 0.55 ? away + (r() * 2 - 1) * 1.2 : r() * Math.PI * 2;
    } else {
      F.moveLen = 0.8 + r() * 1.4;
    }
  }

  // a move is over: the thrash rolls its dice, a charge often turns into a run, a rest ends in the next phase
  endMove() {
    const F = this.F, f = this.state.fish, r = this.r, R = this.R;
    const m = f.move;
    if (m === "thrash") {
      const avg = F.triskW > 0 ? F.trisk / F.triskW : 0;
      const p = clamp((avg - R.THRASH_BASE) * R.THRASH_K, 0, R.THRASH_MAX) * F.hold;
      if (r() < p) { this.lose("thrown", "thrown", { thrash: true }); return true; }
    }
    if (m === "hold" && F.pendingPhase >= 0) { this.slackT = 0; this.startPhase(F.pendingPhase); return true; }
    // a charge often ends in a turn and a run: the turn is the warning (the line comes tight: stop reeling fast)
    if (m === "charge" && r() < 0.6) { this.startMove("turn"); return true; }
    if (m === "turn") { this.startMove("run"); F.jolt = 0; return true; }
    if (m === "sulk" && F.pumpN >= F.pumpNeed) { this.emit("unstuck"); this.startMove("swim"); return true; }
    return false;
  }

  fight(h, I) {
    const S = this.state, f = S.fish, F = this.F, P = this.plan, R = this.R, r = this.r, T = I.tip, base = this.rod.base;
    S.fightT += h;
    F.moveT += h;
    F.jumpCool -= h;
    F.surgeCool -= h;
    F.chargeCool -= h;
    const junk = P.junk;
    const land = S.phase === "land";
    const fi = P.sp.fight || {};

    /* the line: a spring from the rod tip, through a rod that bends */
    let lx = T.x - f.x, ly = T.y - f.y, lz = T.z - f.z;
    const dist = Math.hypot(lx, ly, lz) || 1e-6;
    lx /= dist; ly /= dist; lz /= dist;
    // the rod bends when the line pulls across it, and cannot bend when it points down the line
    let rx = T.x - base.x, ry = T.y - base.y, rz = T.z - base.z;
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
    const shaking = f.move === "shake" || f.move === "thrash";
    if (shaking) F.shakePh += h * F.shakeF;
    if (!junk && ten > 1.5 * R.G && !land) {
      const cush = R.SHAKE_SOFT + (1 - R.SHAKE_SOFT) * stiff;
      if (shaking) {
        const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * F.shakePh)), 3);
        const amp = Math.min(R.SHAKE_N * (F.style.shake || 1) * Math.pow(P.kg, 0.7) * (f.move === "thrash" ? R.THRASH_MUL : 1), R.SPIKE_CAP * S.breakN);
        ten += amp * (0.3 + 0.7 * f.stamina) * pulse * cush;
      }
      if (F.jolt > 0 && F.moveT < 0.25) ten += F.jolt * (0.3 + 0.7 * f.stamina) * Math.sin(Math.PI * F.moveT / 0.25) * cush;
    }
    // junk drags on the bottom like a dead weight
    if (junk && stretch > -0.2) ten += P.kg * 3 * R.G;

    /* the reel: the spool slips when the line pulls harder than the drag; cranking into a slipping drag grinds */
    const c = I.crank * (junk ? R.LINE_PER_TURN : R.FIGHT_LINE_PER_TURN) * (1 + 0.35 * I.pull);
    // A locked spool winches the fish in, grind and all. The moment it slips (a run starts), the grind lets go and builds
    // back over GRIND_RAMP s of slipping; slipT runs down 10 times as fast while the spool holds, so a run that starts after
    // the spool has held for a moment (a tenth of a second wipes out a second of slipping) starts afresh. And the grind
    // never locks the spool past GRIND_CAP of the break. So the drag gives before the line breaks.
    // For the first moments after the hook set the drag just slips ("Fish on! Let it run."): no grind yet.
    // A resting legend has no grind either: winding while it hangs there is safe
    this.slipT = this.spool > 0.15 ? this.slipT + h : Math.max(0, this.slipT - 10 * h);
    const ramp = this.slipT > 0 ? smooth(0, R.GRIND_RAMP, this.slipT) : 1;
    const thr = Math.min(S.dragN + (f.move === "hold" ? 0 : R.GRIND_N * I.crank * smooth(R.GRACE_T, R.GRACE_T + 0.4, S.fightT) * ramp), Math.max(S.dragN, R.GRIND_CAP * S.breakN));
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
    if (ten > S.breakN) {
      // what would have saved the line, for the loss line: stop cranking, hold the rod up (a high rod bends), a lighter drag
      S.cause = I.crank > 0.3 ? "grind" : stiff > 0.5 ? "rodlow" : S.dragN >= R.DRAG_N[2] ? "drag" : shaking ? "shake" : "";
      return this.lose("snap", "snap", { reason: "snap", cause: S.cause });
    }
    // the spool runs out: a long run takes all the line
    S.spoolFrac = S.lineOut / R.SPOOL_MAX;
    if (S.spoolFrac >= 1) return this.lose("spooled", "snap", { reason: "spooled" });
    if (!F.spoolWarn && S.spoolFrac > R.SPOOL_WARN) { F.spoolWarn = true; this.emit("spool"); }
    else if (F.spoolWarn && S.spoolFrac < R.SPOOL_REARM) F.spoolWarn = false;
    // slack
    if (ten < R.SLACK_N) this.slackT += h; else this.slackT = 0;

    if (junk) return this.moveJunk(h, I, ten, lx, ly, lz);

    /* the fish: where it wants to go, and what the line does to it */
    if (F.moveT >= F.moveLen && !land) { if (!this.endMove()) this.nextMove(); if (S.phase === "lost") return; }
    const m = f.move;
    const s = f.stamina;
    // worn out (a legend only in its last phase): it rolls up and comes in on its side
    const boss = P.sp.boss;
    const beaten = s < R.BEATEN && (!boss || F.bossPhase === boss.phases.length - 1);
    S.beaten = beaten;
    if (beaten && !F.beatenSaid) { F.beatenSaid = true; this.emit("beaten"); }
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
    if (m === "charge") F.goal = headingOf(T.x - f.x, T.z - f.z);
    // steering the way the prompt says turns a cover run away from the cover
    if (F.coverRun && m === "run") {
      const ok = clamp((I.steer * -F.coverSide - 0.2) / 0.6, 0, 1);
      if (ok > 0) {
        F.goal -= F.coverSide * R.COVER_TURN * ok * h; F.coverTurn += R.COVER_TURN * ok * h;
        if (F.coverTurn > R.COVER_DONE) { F.coverRun = false; S.cover = null; this.emit("turned"); }
      }
    }
    if (!land && (m === "run" || m === "surge" || m === "dive" || m === "swim" || m === "charge" || m === "turn")) f.heading += clamp(wrap(F.goal - f.heading), -1, 1) * R.TURN_RATE * (0.3 + 0.7 * s) * h;
    const pullFrac = clamp(ten / Math.max(1, F.Fmax), 0, 2);
    f.heading = wrap(f.heading + Math.sin(wrap(pullHead - f.heading)) * R.LINE_TURN * pullFrac * (1 + against) * h);
    if (land) f.heading += wrap(pullHead - f.heading) * Math.min(1, h * 2);
    // a fish turned toward you by the line is being led, not swimming (unless it charges on purpose)
    const faced = Math.cos(wrap(f.heading - pullHead));
    const fl0 = fi.floor ?? 0.25; // how hard a tired fish still swims
    let thrust = F.Fmax * (fl0 + (1 - fl0) * s) * (land ? 0.1 : MOVE_FORCE[m] || 0.3);
    if (shaking) thrust *= 0.6 + 1.2 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * F.shakePh)), 2);
    if (faced > 0.5 && m !== "charge") thrust *= 0.35;
    if (m === "charge" && F.moveT < 0.3) thrust *= 0.3;
    if (beaten) thrust *= R.BEATEN_THRUST;
    let hd = f.heading;
    if (shaking) hd += 0.6 * Math.sin(2 * Math.PI * F.shakePh);
    let tx = Math.sin(hd) * thrust, tz = -Math.cos(hd) * thrust;
    // in a current, a fish that is not running holds its place (and tires a little doing it)
    const fl = this.flowAt(f.x, f.z), flS = Math.hypot(fl.x, fl.z);
    if (flS > 0.05 && m !== "run" && m !== "surge" && !land) {
      const stay = F.c * flS * flS * (0.15 + 0.85 * s);
      tx -= fl.x / flS * stay; tz -= fl.z / flS * stay;
    }
    // depth: dives and sulks go to the bottom, deep fish stay deep, thrashing and beaten fish come up
    const [d0, d1] = P.sp.depth;
    let yT = -clamp(dpt * (F.style.deep ? 0.8 : 0.5), Math.min(d0, dpt - 0.2), Math.min(d1, dpt - 0.2));
    if (m === "dive" || m === "sulk") yT = -(dpt - 0.3);
    if (m === "thrash" || beaten) yT = -0.2;
    if (land) yT = -0.15;
    if (m === "hold") yT = Math.min(-0.6, f.y);
    const ty = F.Fmax * 0.5 * (0.35 + 0.65 * s) * clamp((yT - f.y) / 1.2, -1, 1);

    // the thrash: the risk of tearing the hook out grows with a tight line and a low rod
    if (m === "thrash") {
      const hi = smooth(R.THRASH_LOW, R.THRASH_HIGH, I.theta);
      F.trisk += (ten / S.breakN) * (1 - hi) * h; F.triskW += h;
    }

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
        const p = clamp((avg - 0.03) * R.JUMP_K, 0, R.JUMP_MAX) * F.hold * (J.open ? R.OPEN_JUMP : 1);
        if (r() < p) return this.lose("thrown", "thrown", { jump: true });
        F.jumpPh = null;
        if (F.walkLeft > 0) {
          // the tail walk goes on: a short dash on the surface, then the next leap
          F.walkLeft--; F.walking = true;
          this.startMove("swim");
          F.moveLen = R.WALK_GAP[0] + r() * (R.WALK_GAP[1] - R.WALK_GAP[0]);
          F.nextJump = true;
        } else {
          if (F.walking) { F.walking = false; this.emit("walkEnd"); }
          // back in the water it swims off before it does anything else: time to get the rod back up
          this.startMove("swim");
          F.moveLen = 1 + r() * 0.6;
        }
      }
      if (f.jump > 0 || J.t < J.rise) { this.after(h, I, ten, against); return; }
    }

    // the sulk: it holds its place on the bottom; a rod lifted with a tight line drags it up and tires it
    if (m === "sulk") {
      const lifting = I.omega > 10 && ten > R.PUMP_MIN_T * S.dragN;
      F.pumpIdle = lifting ? 0 : F.pumpIdle + h;
      F.vx *= Math.exp(-6 * h); F.vz *= Math.exp(-6 * h);
      if (lifting) {
        // (the rod drags it along the pull, which steering bends to one side)
        const v = Math.min(2, R.PUMP_LIFT * I.omega), nx = f.x + px / pl * v * h, nz = f.z + pz / pl * v * h;
        if (this.swim(nx, nz)) { f.x = nx; f.z = nz; }
        f.y = Math.min(-0.3, f.y + 0.4 * v * h);
        F.pumpDeg += I.omega * h;
        if (F.pumpDeg >= R.PUMP_DEG) {
          F.pumpDeg -= R.PUMP_DEG; F.pumpN++;
          f.stamina = clamp(f.stamina - R.PUMP_DRAIN * 8 / F.S, 0, 1);
          this.emit("pump", { n: F.pumpN, need: F.pumpNeed });
          if (F.pumpN >= F.pumpNeed) F.moveLen = F.moveT; // it comes off the bottom
        }
      } else {
        f.y += clamp(yT - f.y, -1, 1) * h;
      }
      f.y = clamp(f.y, -Math.max(0.15, dpt - 0.1), -0.05);
      f.speed = Math.hypot(F.vx, F.vz);
      this.after(h, I, ten, against);
      return;
    }

    // a legend between phases hangs still in the water
    if (m === "hold") {
      // it stops swimming away, and lets the line lead it a little: the line goes light
      tx = 0; tz = 0;
      const vin = clamp(ten / (0.5 * S.dragN), 0, 1) * 1.6, kk = 1 - Math.exp(-4 * h);
      F.vx += (hx / hl * vin - F.vx) * kk; F.vz += (hz / hl * vin - F.vz) * kk;
    }

    // move the fish: thrust + line − water drag (drag is implicit, so it never overshoots)
    const M = F.mass;
    F.vx += (tx + pxn * ten) / M * h;
    F.vz += (tz + pzn * ten) / M * h;
    F.vy += (ty + ly * ten * 0.6) / M * h;
    // the water drags on the speed through the water, not over the bottom
    let rvx = F.vx - fl.x, rvz = F.vz - fl.z;
    const sp = Math.hypot(rvx, rvz);
    // above its burst speed the fish planes at the surface and the drag grows more slowly;
    // a fish led toward you head-first skims along and drags less still; a charging fish swims, it is not led
    const toward = sp > 0.05 ? (rvx * pxn + rvz * pzn) / (sp * (Math.hypot(pxn, pzn) || 1)) : 0;
    const tow = beaten ? R.BEATEN_TOW : toward > 0.5 && m !== "charge" ? R.TOW : 1;
    const dragH = F.c * Math.min(sp, F.top) * tow / M * h;
    rvx /= 1 + dragH; rvz /= 1 + dragH;
    F.vx = fl.x + rvx; F.vz = fl.z + rvz;
    // a charge is never faster than a quick crank can follow (3 rev/s × 1.15 m = 3.45 m/s)
    if (m === "charge") { const v = Math.hypot(rvx, rvz); if (v > R.CHARGE_V) { F.vx = fl.x + rvx * R.CHARGE_V / v; F.vz = fl.z + rvz * R.CHARGE_V / v; } }
    // the turn after a charge: it brakes hard (a heavy fish would coast on into a slack line)
    if (m === "turn") { const kk = Math.exp(-3 * h); F.vx = fl.x + (F.vx - fl.x) * kk; F.vz = fl.z + (F.vz - fl.z) * kk; }
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
    if ((shaking || m === "charge") && ten < R.SLACK_N) F.moveSlackT += h;
    // a charge ends when it is close
    if (m === "charge" && Math.hypot(f.x, f.z) < R.CHARGE_END_D) F.moveLen = Math.min(F.moveLen, F.moveT);
    this.after(h, I, ten, against);
  }

  // The line rubs: a meter (state.rub, 0..1) fills while the line touches a snag (a stump or a log), the fish drags it
  // over rough bottom, or the fish runs out through its cover zone (weeds, pads, rocks). At 1 the line is cut.
  // Steer the fish off a snag; hold the rod up to lift the line off the rocks and over short stumps.
  // Returns true if the line was cut.
  rub(h, I, ten, against) {
    const S = this.state, f = S.fish, F = this.F, R = this.R, T = I.tip, pl = this.pl, P = this.plan;
    F.rubAcc += h;
    if (F.rubAcc < 1 / R.RUB_HZ) return false;
    const dt = F.rubAcc; F.rubAcc = 0;
    let c = 0, side = 0, kind = "", sideSum = 0, nearAbs = 1e9, nearPost = null;
    const hi = smooth(R.JUMP_LOW, R.JUMP_HIGH, I.theta);
    // (a) a snag on the line: walk the line from the rod tip to the fish in 5 m steps and look at the snags near each step
    if (pl.snags.length && f.jump <= 0) {
      const ax = T.x, az = T.z, dx = f.x - ax, dz = f.z - az, L2 = dx * dx + dz * dz || 1, len = Math.sqrt(L2);
      const seen = [];
      for (let k = 0; k <= len; k += 5) {
        for (const s of pl.snagNear(ax + dx * k / len, az + dz * k / len)) {
          if (seen.includes(s)) continue;
          seen.push(s);
          const u = ((s.x - ax) * dx + (s.z - az) * dz) / L2;
          if (u < 0.03 || u > 0.97) continue;
          const cross = dx * (s.z - az) - dz * (s.x - ax);
          if (Math.abs(cross) / len > s.r + 0.1) continue;
          // the line slopes from the rod tip down to the fish: it clears a snag whose top is below the line there
          if (T.y + (Math.min(f.y, 0) - T.y) * u > s.top) continue;
          c += 1;
          if (!kind) kind = s.kind;
          sideSum += cross > 0 ? -1 : 1; // the snag is on the right: steer left to pull the line off it
          if (Math.abs(cross) < nearAbs) { nearAbs = Math.abs(cross); nearPost = s; }
        }
      }
      // steer the way that clears most of the snags on the line. A tie (a log across the line): steer toward the nearer end of that log
      side = Math.sign(sideSum);
      if (!side && nearPost && nearPost.ends) {
        const [e0, e1] = nearPost.ends, e = Math.hypot(nearPost.x - e0[0], nearPost.z - e0[1]) < Math.hypot(nearPost.x - e1[0], nearPost.z - e1[1]) ? e0 : e1;
        side = dx * (e[1] - az) - dz * (e[0] - ax) > 0 ? 1 : -1;
      }
      // (steering the right way takes the line off a snag at once, as well as pulling the fish over)
      if (c > 0 && side && R.RUB_STEER) c *= 1 - R.RUB_STEER * clamp((I.steer * side - 0.2) / 0.6, 0, 1);
    }
    // (b) rough bottom: the fish is down among the rocks. A rod held high lifts the line off them
    if (pl.rough && f.jump <= 0 && pl.rough(f.x, f.z) && -f.y > this.depthAt(f.x, f.z) - 1.0) {
      c += 1 - R.RUB_ROD_CUT * smooth(R.JUMP_LOW, R.JUMP_HIGH, I.theta);
      if (!kind) kind = "rocks";
    }
    // (c) cover: a fish running out through the weeds, pads or rocks it runs for
    const kinds = this.fx.cover[f.id];
    if (kinds && (f.move === "run" || f.move === "surge" || f.move === "dive") && S.phase === "fight") {
      const out = (F.vx * (f.x - T.x) + F.vz * (f.z - T.z)) / (Math.hypot(f.x - T.x, f.z - T.z) || 1);
      if (out > 0.3) {
        const zn = this.zoneAt(f.x, f.z);
        for (const kd of kinds) {
          const ca = this.fx.coverAt[kd];
          if (!ca || ca.rub !== "zone" || !ca.zones.includes(zn)) continue;
          // steering the right way turns it off the cover; so does any side pressure against its run
          const cs = ca.at ? this.sideOf(f, ca.at[0].x, ca.at[0].z) : F.coverSide || 1;
          const ok = clamp((I.steer * -cs - 0.2) / 0.6, 0, 1);
          c += R.RUB_COVER * (0.3 + 0.7 * f.stamina) * (1 - 0.85 * Math.max(ok, against));
          if (!kind) { kind = kd === "rocks" ? "rocks" : "weeds"; side = -cs; }
          break;
        }
      }
    }
    if (c > 0 && ten >= R.SLACK_N) {
      S.rub += Math.min(c, 1.5) * (0.3 + 0.7 * clamp(ten / S.dragN, 0, 1.5)) * (0.4 + 0.6 * Math.min(1, f.speed / F.top)) / (P.sp.fight.rubT || R.RUB_T) * dt;
      S.rubKind = kind; S.rubSide = side;
      // the first time the meter shows in a contact: say what it is on, and which way to steer
      if (!F.rubOn) { F.rubOn = true; F.rubWarned = false; }
      if (S.rub > 0.15 && !F.rubWarned) { F.rubWarned = true; this.emit("rub", { kind, side }); }
    } else {
      S.rub = Math.max(0, S.rub - dt / R.RUB_EMPTY);
      if (c <= 0) F.rubOn = false;
      if (S.rub <= 0) { S.rubKind = ""; S.rubSide = 0; }
    }
    if (S.rub >= 1) { S.rub = 1; this.lose(S.rubKind || "rocks", "snap", { reason: S.rubKind || "rocks" }); return true; }
    return false;
  }

  // stamina, hooks coming loose, cover, and landing
  after(h, I, ten, against) {
    const S = this.state, f = S.fish, F = this.F, R = this.R, r = this.r, P = this.plan, fi = P.sp.fight;
    if (this.rub(h, I, ten, against)) return;
    const eff = (f.move === "rest" ? 0.15 : MOVE_FORCE[f.move] || 0.4) * (S.phase === "land" ? 0.2 : 1);
    // tension is measured against the gear, not the fish, so a big fish tires in about the same time as a middling one
    // and its stamina seconds (and its moves) set how long it lasts
    let drain = (R.DRAIN_E * eff + R.DRAIN_T * (ten / R.REF_N) * (1 + R.SIDE_DRAIN * against) * (f.move === "sulk" ? 0.25 : 1)) / F.S;
    // far out it has room to swim and tires slowly; close in it tires fast. So it still fights as you bring it in
    drain *= R.FAR_DRAIN + (1 - R.FAR_DRAIN) * (1 - smooth(R.NEAR_D, R.FAR_D, Math.hypot(f.x, f.z)));
    if (ten < R.SLACK_N) drain -= R.RECOVER;
    if (f.move === "sulk" && F.pumpIdle > 2) drain -= R.SULK_RECOVER;
    if (f.move === "hold") drain = 0;
    f.stamina = clamp(f.stamina - drain * h, 0, 1);
    f.near = f.jump > 0 ? 1 : clamp(1 + f.y / 2.2, 0, 1);
    f.thrash = f.move === "shake" || f.move === "thrash" || f.jump > 0 ? 1 : f.move === "run" || f.move === "surge" || f.move === "charge" ? 0.6 : 0.2 * f.stamina;
    const dd = Math.hypot(f.x, f.z);
    if (!f.known && dd < 7 && f.near > 0.5) this.reveal();

    // a slack line lets the fish shake the hook out (a legend at rest cannot: its line is meant to go light)
    if (f.move !== "hold" && (this.slackT > 2.5 && this.slackT - h <= 2.5 || this.slackT > 4 && ((this.slackT - 2.5) % 1.5) < h)) {
      if (r() < R.THROW_LONG * F.hold * (S.beaten ? R.BEATEN_THROW : 1)) return this.lose("thrown", "thrown", { slack: true });
    }
    if ((f.move === "shake" || f.move === "thrash" || f.move === "jump") && !F.moveThrowRolled && F.moveSlackT > 0.9) {
      F.moveThrowRolled = true;
      if (r() < R.THROW_SHAKE * F.hold) return this.lose("thrown", "thrown", { slack: true });
    }
    // a charge that leaves the line slack
    if (f.move === "charge" && !F.moveThrowRolled && F.moveSlackT > R.CHARGE_SLACK) {
      F.moveThrowRolled = true;
      if (r() < R.THROW_CHARGE * F.hold) return this.lose("thrown", "thrown", { charge: true });
    }
    // nothing below changes what the fish does while it is in the middle of a leap
    if (f.move === "jump" && F.jumpPh) return;
    // a legend rests between phases
    const ph = P.sp.boss && P.sp.boss.phases;
    if (ph && F.bossPhase >= 0 && F.pendingPhase < 0 && f.move !== "hold" && !F.opening && F.bossPhase + 1 < ph.length && f.stamina < ph[F.bossPhase + 1].at && S.phase === "fight") {
      F.pendingPhase = F.bossPhase + 1;
      this.startMove("hold");
      F.moveLen = ph[F.pendingPhase].rest || 3.5;
      return;
    }
    // a resting legend does nothing else, and cannot be landed
    if (f.move === "hold") return;
    // one last run when it first sees the dock (fight.last is the chance, fight.lastR the distance)
    const lastP = fi.last || 0;
    if (lastP > 0 && !F.lastRolled && dd < (fi.lastR || R.LAST_R) && S.phase === "fight") {
      F.lastRolled = true;
      if (r() < lastP) {
        f.stamina = Math.min(1, f.stamina + R.LAST_REFILL);
        this.emit("lastrun", { x: f.x, z: f.z });
        this.startMove("surge");
        F.goal = this.awayFrom(f) + (r() < 0.5 ? -1 : 1) * 0.6;
        // a fish of the wall dives for the rocks at your feet instead
        const wall = (this.fx.cover[f.id] || []).includes("wall") && this.fx.coverAt.wall;
        if (wall && dd < wall.feet) F.goal = headingOf((r() - 0.5) * 6 - f.x, -1.5 - f.z);
        return;
      }
    }
    // a small fish wound up to the rod tip is simply swung in
    const T = this.tip, wt = P.kg * 9.81, tipH = Math.hypot(f.x - T.x, f.z - T.z);
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
    const S = this.state, f = S.fish, F = this.F, R = this.R;
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
    S.bend = clamp(S.tension / this.R.ROD_RATING, 0, 1);
    S.spoolFrac = clamp(S.lineOut / this.R.SPOOL_MAX, 0, 1);
    if (f && (S.phase === "fight" || S.phase === "land" || S.phase === "caught")) {
      S.lure.x = f.x; S.lure.y = f.y; S.lure.z = f.z; S.lure.speed = f.speed;
      S.depth = Math.max(0, -f.y);
      S.lift = this.F ? clamp(this.F.liftT / this.R.LIFT_TIME, 0, 1) : 0;
    } else S.depth = Math.max(0, -S.lure.y);
    const fl = this.flowAt(S.lure.x, S.lure.z);
    S.flow = { x: fl.x, z: fl.z };
    S.slackT = S.phase === "fight" || S.phase === "land" ? this.slackT : 0;
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

