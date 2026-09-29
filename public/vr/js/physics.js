// In Full Swing: the body and the two plunger ropes (spec §4.3).
// Pure: plain {x, y, z}, no three, no DOM. main.js calls step(P, h, inp) a few times a frame with a small h.
// Deterministic, and step allocates nothing except the event objects it pushes.
import { SWING, GAME, COMFORT } from "./config.js";

// Targets you pump instead of swing on: a yank there counts as a pump and moves nothing.
const SPECIAL = { clog: true, pipe: true, crack: true };
const FOOT_R = 0.25; // the feet stand on anything under a disc this wide
const CATCH_MIN = 1.5; // outward m/s at the moment a slack rope goes taut that counts as a jolt to soften
const STRETCH = 1; // a taut catch lets the rope give this much, then pulls it back at lenRate
const TENSION_G = 2.5; // rope tension reads 1 at this many g of pull

const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// Math.hypot boxes its arguments in V8; these do not allocate
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const len2 = (x, z) => Math.sqrt(x * x + z * z);
const sideIndex = (side) => (side === 1 || side === "right" ? 1 : 0);

// scratch, shared by every player (step never runs twice at once)
const V = v3(), W = v3(), C = v3(), SPH = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 }, HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null };

function makeRope(i) {
  return {
    side: i, state: "idle", from: v3(), anchor: v3(), normal: v3(0, 1, 0), target: null,
    len: 0, lenTarget: 0, flyT: 0, flyDur: 0, taut: false, tension: 0, sticky: false, blockedT: 0, reeling: false,
    // internal: the catch, the stretch it leaves, how fast the rope pulls in, last step's state
    stretch: 0, catchT: 0, catchV: 0, catchLen: 0, pull: 0, L0: 0, wasTaut: false, acc: 0, _t: { tag: "", id: null },
  };
}
function idle(r) {
  r.state = "idle"; r.target = null; r.len = r.lenTarget = 0; r.flyT = r.flyDur = 0;
  r.taut = r.wasTaut = false; r.tension = 0; r.sticky = false; r.blockedT = 0; r.reeling = false;
  r.stretch = r.catchT = r.catchV = r.pull = r.acc = 0;
}

/* ---------------- API ---------------- */
export function createPlayer(city, cfg = SWING) {
  const s = city.start, pre = COMFORT.presets[COMFORT.defaultPreset];
  const P = {
    city, cfg,
    pos: v3(s.x, s.y, s.z), vel: v3(), onGround: false, ground: null, lastSafe: v3(s.x, s.y, s.z),
    chest: cfg.chestH, // a constant scaled by the calibrated height (main sets it), never tracked
    speedCap: pre.speedCap, fallCap: pre.fallCap,
    frozen: false, dead: null,
    ropes: [makeRope(0), makeRope(1)], events: [], yankCool: [0, 0],
    // internal: the part of vel the rope winch adds this step, time since the last reel/yank/stick input,
    // time in the air, bump cooldown, and the speed of the last step's move (for the tests)
    pullVel: v3(), quietT: 0, airT: 0, bumpCool: 0, stepSpeed: 0,
  };
  settle(P);
  return P;
}

// Put the body somewhere new: no speed, no ropes, alive again.
export function teleport(P, x, y, z) {
  P.pos.x = x; P.pos.y = y; P.pos.z = z;
  P.vel.x = P.vel.y = P.vel.z = 0;
  P.pullVel.x = P.pullVel.y = P.pullVel.z = 0;
  for (const r of P.ropes) idle(r);
  P.dead = null; P.quietT = 0; P.airT = 0; P.stepSpeed = 0;
  settle(P);
  P.events.push({ type: "respawn" });
}

// Stand on whatever is right under the feet (within 5 cm), or be in the air.
function settle(P) {
  const { city, pos } = P;
  const tb = city.topBelow(pos.x, pos.y + 0.05, pos.z, FOOT_R);
  let top = tb ? tb.y : -Infinity, col = tb ? tb.collider : null;
  if (!city.isWater(pos.x, pos.z)) { const g = city.groundY(pos.x, pos.z); if (g > top) { top = g; col = null; } }
  P.onGround = top >= pos.y - 0.05;
  P.ground = P.onGround ? col : null;
  if (P.onGround) { pos.y = top; if (col) { P.lastSafe.x = pos.x; P.lastSafe.y = pos.y; P.lastSafe.z = pos.z; } }
}

// Shoot a cup from `from` at a target { x, y, z, nx, ny, nz, tag, id } (from ropes.aim). It lands after flyDur.
export function fire(P, side, from, target) {
  const i = sideIndex(side), r = P.ropes[i], c = P.cfg;
  if (r.state !== "idle") release(P, i);
  r.state = "flying";
  r.from.x = from.x; r.from.y = from.y; r.from.z = from.z;
  r.anchor.x = target.x; r.anchor.y = target.y; r.anchor.z = target.z;
  r.normal.x = target.nx ?? 0; r.normal.y = target.ny ?? 1; r.normal.z = target.nz ?? 0;
  r._t.tag = target.tag || "building"; r._t.id = target.id ?? null;
  r.target = r._t;
  const d = len3(target.x - from.x, target.y - from.y, target.z - from.z);
  r.flyT = 0;
  r.flyDur = Math.min(d / c.cupSpeed, c.flyMax);
  return r;
}

// Let go of a rope. Always works, even on a sticky one (the portal calls it at the burst).
export function release(P, side) {
  const r = P.ropes[sideIndex(side)], was = r.state;
  idle(r);
  if (was === "attached") P.events.push({ type: "detach", side: r.side, speed: len3(P.vel.x, P.vel.y, P.vel.z) });
}

/* ---------------- ropes ---------------- */
function attach(P, r) {
  const c = P.cfg, d = len3(r.anchor.x - C.x, r.anchor.y - C.y, r.anchor.z - C.z);
  r.state = "attached";
  // the rope starts at the distance and settles 3 % shorter: a small tug, never a pop
  r.len = Math.max(c.minRopeLen, d);
  r.lenTarget = Math.max(c.minRopeLen, d * c.attachLengthFactor);
  r.stretch = r.catchT = r.pull = r.acc = 0; r.taut = r.wasTaut = false; r.tension = 0; r.blockedT = 0;
  if (r.target.tag === "crack") r.sticky = true;
  P.events.push({ type: "attach", side: r.side, target: { tag: r.target.tag, id: r.target.id } });
}

// Lower lenTarget. A slack rope first takes in its slack, so a reel acts at once.
function shorten(P, r, amount) {
  if (!(amount > 0)) return;
  const min = P.cfg.minRopeLen, d = len3(C.x - r.anchor.x, C.y - r.anchor.y, C.z - r.anchor.z);
  if (d < r.len + r.stretch - 0.01) { r.len = Math.max(min, d); r.stretch = 0; r.lenTarget = Math.min(r.lenTarget, r.len); }
  r.lenTarget = Math.max(min, r.lenTarget - amount);
}

// The rope state machine for one hand: fly, attach, release, yank, hand over hand, reel. Frozen runs only
// the first four and changes no speed or length.
function ropeInput(P, i, hand, h) {
  const r = P.ropes[i], c = P.cfg;
  r.reeling = false;
  if (r.state === "idle") return;
  if (!(hand && hand.holding) && !r.sticky) { release(P, i); return; }
  if (r.state === "flying") {
    r.flyT += h;
    if (r.flyT < r.flyDur) return;
    attach(P, r);
  }
  if (!hand) return;
  // u: unit vector from the hand to the anchor. Pulling the hand back (away from the anchor) is a positive pull.
  const hp = hand.pos || C;
  let ux = r.anchor.x - hp.x, uy = r.anchor.y - hp.y, uz = r.anchor.z - hp.z;
  const ul = len3(ux, uy, uz);
  if (ul < 1e-6) return;
  ux /= ul; uy /= ul; uz /= ul;
  const vr = hand.velRel;
  const pull = hand.yank > 0 ? hand.yank : vr ? -(vr.x * ux + vr.y * uy + vr.z * uz) : 0;
  const special = SPECIAL[r.target.tag] === true;
  if (pull > c.yank.threshold && P.yankCool[i] <= 0) {
    const strength = pull - c.yank.threshold;
    P.yankCool[i] = c.yank.cooldown;
    P.quietT = 0;
    P.events.push({ type: "yank", side: i, strength, target: { tag: r.target.tag, id: r.target.id }, pump: special && strength >= GAME.pumpMin });
    if (!special && !P.frozen) {
      const dv = Math.min(c.yank.maxDV, c.yank.gain * strength);
      V.x += ux * dv; V.y += uy * dv; V.z += uz * dv;
      shorten(P, r, c.yank.shorten);
    }
  }
  if (P.frozen) return;
  if (!special && pull > 0) shorten(P, r, pull * h * c.handOverHandGain);
  // the grip reels; a resting finger (grip up to 0.2) does nothing
  const k = clamp(((hand.grip || 0) - 0.2) / 0.7, 0, 1);
  if (k > 0) { shorten(P, r, c.reelSpeedMax * k * h); r.reeling = true; P.quietT = 0; }
}

// The rope constraint on the chest, on velocities, so the body only ever moves by vel × h.
// - Static part (on the momentum V): keep the chest inside the sphere of last step's length. The correction
//   points along the current rope direction, which keeps a pendulum's energy (research: 0.2 % over 5 swings).
// - Winch part (in W): when the rope shortens (the attach tug, a reel, a yank's shorten, hand over hand, a
//   stretch coming back) it pulls the chest in at that speed. W is not momentum: it is gone next step, so
//   the body stops moving in when the rope stops shortening (no yo-yo).
// - Catch: a slack rope that goes taut with a jolt removes the outward speed over catchTime and gives up to 1 m.
function constrain(P, h) {
  const c = P.cfg;
  for (const r of P.ropes) {
    if (r.state !== "attached") continue;
    const L0 = r.len + r.stretch;
    // the length holds still while a catch lasts, so the stretch it measures stays within 1 m
    if (r.catchT <= 0 && r.len > r.lenTarget) r.len = Math.max(r.lenTarget, r.len - c.lenRate * h);
    if (r.catchT <= 0 && r.stretch > 0) r.stretch = Math.max(0, r.stretch - c.lenRate * h);
    r.pull = Math.max(0, L0 - r.len - r.stretch) / h;
    r.L0 = L0;
    r.wasTaut = r.taut;
    r.taut = false;
    r.acc = 0;
  }
  for (let it = 0; it < 2; it++) {
    for (const r of P.ropes) {
      if (r.state !== "attached") continue;
      const A = r.anchor;
      const ex = C.x - A.x, ey = C.y - A.y, ez = C.z - A.z, d = len3(ex, ey, ez);
      if (d < 1e-6) continue;
      const nx = ex / d, ny = ey / d, nz = ez / d;
      const Le = r.len + r.stretch;
      // where the momentum and the winch would take the chest
      const qx = ex + (V.x + W.x) * h, qy = ey + (V.y + W.y) * h, qz = ez + (V.z + W.z) * h;
      if (len3(qx, qy, qz) <= Le) continue;
      r.taut = true;
      const vr = V.x * nx + V.y * ny + V.z * nz;
      if (it === 0 && !r.wasTaut && r.catchT <= 0 && vr > CATCH_MIN) { r.catchT = c.catchTime; r.catchV = vr; r.catchLen = r.len; }
      if (r.catchT > 0) {
        // the outward speed fades to zero over catchTime; the rope never gives more than STRETCH
        const vmax = Math.min(r.catchV * (r.catchT / c.catchTime), (r.catchLen + STRETCH - d) / h);
        if (vr > vmax) { const k = vr - vmax; V.x -= nx * k; V.y -= ny * k; V.z -= nz * k; r.acc += k / h; }
        const dn = d + Math.min(vr, vmax) * h;
        r.stretch = clamp(dn - r.len, 0, STRETCH);
        continue;
      }
      // static: the momentum keeps the chest on last step's sphere
      const px = ex + V.x * h, py = ey + V.y * h, pz = ez + V.z * h, dp = len3(px, py, pz);
      if (dp > r.L0) { const k = (dp - r.L0) / h; V.x -= nx * k; V.y -= ny * k; V.z -= nz * k; r.acc += k / h; }
      // winch: pull the rest of the way to the new length (it carries the body; the static part holds its weight)
      const wx = ex + (V.x + W.x) * h, wy = ey + (V.y + W.y) * h, wz = ez + (V.z + W.z) * h, dw = len3(wx, wy, wz);
      if (dw > Le) { const k = (dw - Le) / h; W.x -= nx * k; W.y -= ny * k; W.z -= nz * k; }
    }
  }
  for (const r of P.ropes) if (r.catchT > 0) r.catchT = Math.max(0, r.catchT - h);
}

/* ---------------- step ---------------- */
// inp = { move: { x, z }, jump, hands: [{ pos, velRel, yank, grip, holding }, …] } (spec §4.3)
export function step(P, h, inp) {
  if (P.dead || !(h > 0)) return;
  const c = P.cfg, city = P.city, pos = P.pos;
  // the momentum is last step's velocity without the winch
  V.x = P.vel.x - P.pullVel.x; V.y = P.vel.y - P.pullVel.y; V.z = P.vel.z - P.pullVel.z;
  W.x = W.y = W.z = 0;
  C.x = pos.x; C.y = pos.y + P.chest; C.z = pos.z;
  P.yankCool[0] = Math.max(0, P.yankCool[0] - h);
  P.yankCool[1] = Math.max(0, P.yankCool[1] - h);
  P.bumpCool = Math.max(0, P.bumpCool - h);
  P.quietT += h;
  const mv = inp && inp.move, mx = mv ? mv.x || 0 : 0, mz = mv ? mv.z || 0 : 0, ml = len2(mx, mz);
  if (ml > 0.15) P.quietT = 0;
  const hands = inp && inp.hands;
  ropeInput(P, 0, hands ? hands[0] : null, h);
  ropeInput(P, 1, hands ? hands[1] : null, h);
  if (P.frozen) { P.pullVel.x = P.pullVel.y = P.pullVel.z = 0; P.stepSpeed = 0; return; }
  const attached = P.ropes[0].state === "attached" || P.ropes[1].state === "attached";

  /* ---- forces ---- */
  if (P.onGround) {
    // walk toward the wish at run speed; friction takes the rest away
    const k = 1 - Math.exp(-c.ground.friction * h);
    V.x += (mx * c.ground.run - V.x) * k;
    V.z += (mz * c.ground.run - V.z) * k;
    V.y = 0;
    if (inp && inp.jump) { V.y = c.ground.jump; P.onGround = false; P.ground = null; }
  } else {
    V.y -= c.gravity * h;
    const s = len3(V.x, V.y, V.z), f = Math.max(0, 1 - c.quadDragC * s * h);
    V.x *= f; V.y *= f; V.z *= f;
    if (ml > 0.01) {
      const a = attached ? c.airAccelAttached : c.airAccel;
      if ((V.x * mx + V.z * mz) / ml < c.airControlMaxSpeed) { V.x += mx * a * h; V.z += mz * a * h; }
    }
  }

  /* ---- ropes ---- */
  if (attached) constrain(P, h);
  if (P.onGround) {
    // a rope that pulls up hard enough lifts you off; otherwise it only drags you along the roof
    if (V.y + W.y > 0.5) { P.onGround = false; P.ground = null; } else { V.y = 0; W.y = 0; }
  }

  // Dangle damping: a slow or short pendulum with no input sways in the sickness band, so calm it down.
  const dd = c.dangleDamp;
  if (attached && !P.onGround && P.quietT >= dd.after) {
    let r = null;
    for (const q of P.ropes) if (q.state === "attached" && (!r || q.len < r.len)) r = q;
    if (len3(V.x, V.y, V.z) < dd.speedBelow || r.len < dd.lenBelow) {
      const ex = C.x - r.anchor.x, ey = C.y - r.anchor.y, ez = C.z - r.anchor.z, d = len3(ex, ey, ez);
      if (d > 1e-6) {
        const nx = ex / d, ny = ey / d, nz = ez / d, vr = V.x * nx + V.y * ny + V.z * nz, f = Math.exp(-dd.perSec * h);
        V.x = nx * vr + (V.x - nx * vr) * f; V.y = ny * vr + (V.y - ny * vr) * f; V.z = nz * vr + (V.z - nz * vr) * f;
      }
    }
  }

  /* ---- caps ---- */
  const sp = len3(V.x + W.x, V.y + W.y, V.z + W.z);
  if (sp > P.speedCap) { const k = P.speedCap / sp; V.x *= k; V.y *= k; V.z *= k; W.x *= k; W.y *= k; W.z *= k; }
  if (V.y + W.y < -P.fallCap) V.y = -P.fallCap - W.y;

  /* ---- move ---- */
  const vx = V.x + W.x, vy = V.y + W.y, vz = V.z + W.z, y0 = pos.y;
  P.stepSpeed = len3(vx, vy, vz);
  pos.x += vx * h; pos.y += vy * h; pos.z += vz * h;

  /* ---- ground ---- */
  const water = city.isWater(pos.x, pos.z);
  if (!P.onGround) {
    if (vy <= 0) {
      // feet crossing down through a top (a roof, the deck, the expressway) or the street: land
      const tb = city.topBelow(pos.x, y0 + 0.02, pos.z, FOOT_R);
      let top = tb ? tb.y : -Infinity, col = tb ? tb.collider : null;
      if (!water) { const g = city.groundY(pos.x, pos.z); if (g > top) { top = g; col = null; } }
      if (pos.y <= top) land(P, top, col, -vy);
    }
  } else {
    const tb = city.topBelow(pos.x, pos.y + 0.05, pos.z, FOOT_R);
    let top = tb ? tb.y : -Infinity, col = tb ? tb.collider : null;
    if (!water) { const g = city.groundY(pos.x, pos.z); if (g > top) { top = g; col = null; } }
    if (top >= pos.y - 0.05) { pos.y = top; P.ground = col; } else { P.onGround = false; P.ground = null; } // walked off an edge
  }

  /* ---- walls: a chest sphere and a knee sphere ---- */
  wall(P, P.chest, c.chestRadius, vy);
  wall(P, 0.5, c.kneeRadius, vy);

  /* ---- a rope that runs through a wall for too long snaps ---- */
  C.x = pos.x; C.y = pos.y + P.chest; C.z = pos.z;
  for (const r of P.ropes) {
    if (r.state !== "attached") continue;
    const ex = r.anchor.x - C.x, ey = r.anchor.y - C.y, ez = r.anchor.z - C.z, d = len3(ex, ey, ez);
    if (d > 1.2 && city.raycast(C.x, C.y, C.z, ex, ey, ez, d - 0.6, HIT)) r.blockedT += h;
    else r.blockedT = 0;
    if (r.blockedT > c.snapBlocked) { idle(r); P.events.push({ type: "snap", side: r.side }); }
  }

  /* ---- rope tension (0..1) for the haptics and the look ---- */
  const kt = 1 - Math.exp(-h / 0.05);
  for (const r of P.ropes) {
    if (r.state !== "attached") continue;
    const want = r.taut ? clamp(r.acc / (TENSION_G * c.gravity), 0, 1) : 0;
    r.tension += (want - r.tension) * kt;
  }

  P.vel.x = V.x + W.x; P.vel.y = V.y + W.y; P.vel.z = V.z + W.z;
  P.pullVel.x = W.x; P.pullVel.y = W.y; P.pullVel.z = W.z;
  P.airT = P.onGround ? 0 : P.airT + h;
  if (P.onGround && P.ground) { P.lastSafe.x = pos.x; P.lastSafe.y = pos.y; P.lastSafe.z = pos.z; }

  /* ---- the lake and the edge of the world ---- */
  const b = city.bounds;
  if (pos.y < 0 && water) { P.dead = "splash"; P.events.push({ type: "splash" }); }
  else if (pos.x < b.minX - 200 || pos.x > b.maxX + 200 || pos.z < b.minZ - 200 || pos.z > b.maxZ + 200) { P.dead = "oob"; P.events.push({ type: "oob" }); }
}

function land(P, top, col, speed) {
  P.pos.y = top;
  V.y = 0; W.y = 0;
  P.onGround = true; P.ground = col;
  // a hop of a few centimetres on a taut rope is not a landing worth a sound
  if (P.airT > 0.15 || speed > 2) P.events.push({ type: "land", speed });
}

// Push one body sphere out of the city and take away the speed into the wall (10 % comes back).
function wall(P, off, rad, vyMove) {
  const pos = P.pos;
  if (!P.city.collideSphere(pos.x, pos.y + off, pos.z, rad, SPH)) return;
  pos.x = SPH.x; pos.y = SPH.y - off; pos.z = SPH.z;
  const nx = SPH.nx, ny = SPH.ny, nz = SPH.nz;
  const into = -((V.x + W.x) * nx + (V.y + W.y) * ny + (V.z + W.z) * nz);
  if (into > 0) {
    const vm = V.x * nx + V.y * ny + V.z * nz;
    if (vm < 0) { const k = vm * (1 + P.cfg.bounce); V.x -= nx * k; V.y -= ny * k; V.z -= nz * k; }
    const wm = W.x * nx + W.y * ny + W.z * nz;
    if (wm < 0) { W.x -= nx * wm; W.y -= ny * wm; W.z -= nz * wm; }
    if (into > 4 && P.bumpCool <= 0) { P.events.push({ type: "bump", speed: into, nx, ny, nz }); P.bumpCool = 0.3; }
  }
  // the knee caught the lip of a roof on the way down: stand on it
  if (ny > 0.7 && !P.onGround && vyMove <= 0) {
    const tb = P.city.topBelow(pos.x, pos.y + off, pos.z, FOOT_R);
    if (tb && tb.y <= pos.y + off && tb.y >= pos.y - 0.05) land(P, tb.y, tb.collider, -vyMove);
  }
}
