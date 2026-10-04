// In Full Swing: the auto target for flat play. In third person the screen centre is the hero's chest, so the game picks one
// building point for each swing. Tier 1 is a fan of rays in front of the view. Tier 2 is the old phone assist (28 directions with
// the 24-ray cone of rope.js). Tier 3 is the exact ray through the screen centre. Clogs, pipes and the gold ring come first.
// Pure: it takes the city and plain { x, y, z } objects, and it never imports three or touches the DOM, so Node tests import it.
// update() fills one result object and returns it again on every call, so nothing is allocated for each frame.
import { TARGET, SWING } from "./config.js";

const DEG = Math.PI / 180;
const RANGE = SWING.ropeRange * SWING.rangeGrace; // the real reach of a rope (88 m), as in rope.js
const PIPE_COS = Math.cos(TARGET.special.pipeFacing * DEG);
const RINGS = [1 / 3, 2 / 3, 1], PER_RING = 8; // the cone of rope.js: three rings of eight rays, the middle one turned half a step
const CONE = [];
for (let k = 0; k < RINGS.length; k++) for (let j = 0; j < PER_RING; j++) { const a = ((j + (k === 1 ? 0.5 : 0)) / PER_RING) * Math.PI * 2; CONE.push([RINGS[k], Math.cos(a), Math.sin(a)]); }
const SPECIAL_TAG = { clog: true, pipe: true, crack: true };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The building a collider belongs to. A collider with no bid, or a bid below 0 (the expressway, the Needle), counts by its own id.
export const bidOf = (c) => (c && c.bid >= 0 ? c.bid : c ? 1e6 + c.id : -1);

/* ---------------- the screen ---------------- */
// Where a world point lands on the screen of cam = { cam: { x, y, z }, yaw, pitch, fov, aspect }: out.x and out.y are NDC (-1 to
// 1, y up), out.behind is true behind the camera plane (x is then the side, -1 to 1, and y is -1.5), out.depth is the distance
// along the view. The camera has no roll, so this needs no matrix and no three.
export function project(cam, x, y, z, out) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const dx = x - cam.cam.x, dy = y - cam.cam.y, dz = z - cam.cam.z;
  const zc = -dx * sy * cp + dy * sp - dz * cy * cp, xc = dx * cy - dz * sy, yc = dx * sy * sp + dy * cp + dz * cy * sp;
  out.depth = zc;
  if (zc < 0.05) {
    out.behind = true; out.x = clamp(xc / (Math.hypot(xc, zc) || 1), -1, 1); out.y = -1.5; out.inView = false;
    return out;
  }
  const th = Math.tan((cam.fov * DEG) / 2);
  out.behind = false; out.x = xc / (zc * th * cam.aspect); out.y = yc / (zc * th);
  out.inView = Math.abs(out.x) <= 1 && Math.abs(out.y) <= 1;
  return out;
}

/* ---------------- the release cue and the kick (pure, shared with the bots) ---------------- */
// True while a rope on a building is in its release window: the body is in the air, rising and moving away from the point under
// the anchor, 25 to 60 degrees past straight down (the swing), or it has been dragged along a roof or a street for dragT s.
// body is the physics player. A clog, a pipe and the crack never give a cue.
export function releaseWindow(body, rope, dragT = 0) {
  if (!rope || rope.state !== "attached" || rope.sticky || !rope.target || SPECIAL_TAG[rope.target.tag]) return false;
  const C = TARGET.cue;
  if (dragT >= C.drag) return true;
  if (body.onGround) return false;
  const v = body.vel, A = rope.anchor, cx = body.pos.x - A.x, cy = body.pos.y + body.chest - A.y, cz = body.pos.z - A.z;
  const d = Math.sqrt(cx * cx + cy * cy + cz * cz);
  if (d < 1e-3 || v.y <= 0 || cx * v.x + cz * v.z <= 0) return false;
  const past = Math.acos(clamp(-cy / d, -1, 1)) / DEG; // degrees from straight down
  return past >= C.from && past <= C.to;
}

// A rope that a real input fired gives speed across the rope, toward the view yaw, until the speed that way is `speed` (m/s). It
// does nothing when the anchor is straight ahead, when the other rope holds, or on a clog, a pipe, the crack or a sticky target.
// Returns true when it added speed.
export function kick(body, rope, yaw, speed) {
  if (!(speed > 0) || !rope || rope.state !== "attached" || rope.sticky || !rope.target || SPECIAL_TAG[rope.target.tag]) return false;
  const other = body.ropes && body.ropes[1 - rope.side];
  if (other && other.state === "attached") return false;
  const A = rope.anchor, nx0 = body.pos.x - A.x, ny0 = body.pos.y + body.chest - A.y, nz0 = body.pos.z - A.z, d = Math.sqrt(nx0 * nx0 + ny0 * ny0 + nz0 * nz0);
  if (d < 1e-3) return false;
  const nx = nx0 / d, ny = ny0 / d, nz = nz0 / d;
  let tx = -Math.sin(yaw), ty = 0, tz = -Math.cos(yaw);
  const k = tx * nx + ty * ny + tz * nz;
  tx -= k * nx; ty -= k * ny; tz -= k * nz;
  const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (tl < 0.3) return false; // the anchor is straight ahead: the reel pulls you in instead
  tx /= tl; ty /= tl; tz /= tl;
  const v = body.vel, vt = v.x * tx + v.y * ty + v.z * tz;
  if (vt >= speed) return false;
  const add = speed - vt;
  v.x += tx * add; v.y += ty * add; v.z += tz * add;
  if (body.onGround) { body.onGround = false; body.ground = null; }
  return true;
}

/* ---------------- the picker ---------------- */
// ctx (main fills one object and reuses it): head, cam ({ x, y, z }), yaw, pitch, fov, aspect, vel, chestY, onGround, wall (null or
// { nx, nz }), time, specials (ropes.targets(), or a function that gives it: asked once for each search), ring (null, or the gold
// ring), avoidBid and avoidBid2 (the buildings that hold a rope), exact (the hit of the centre ray, or null), first (first
// person), aimWidth (21, 28 or 35).
export function createTarget(city, cfg = TARGET) {
  const mkRes = () => ({ x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tag: "", id: null, dist: 0, valid: false, near: false, special: false, score: 0, bid: -1, cid: -1, tier: 0, kind: "swing", prio: false, same: false });
  const R = mkRes(), TR = mkRes(), H = mkRes(); // the result of the last search, the result of a tap, the held target
  const SPR = mkRes(), T1 = mkRes(), T2 = mkRes(); // scratch results
  H.t0 = 0;
  const HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null }, HC = { ...HIT }, EX = { ...HIT }, LOS = { ...HIT };
  const NDC = { x: 0, y: 0, depth: 0, behind: false, inView: false };
  const S = {
    has: false, ctx: null, tFan: -1e9, tWide: -1e9, lastHand: 1, pref: 35, specialNear: false, tier: 0, side: 0,
    rays: 0, picks: 0, specials: null, avoid: null, avoid2: null, better: 0, ratioMin: Infinity, ageMin: Infinity, // changes by the 20 percent rule
    recent: [{ bid: -1, t: -1e9 }, { bid: -1, t: -1e9 }],
  };
  let cur = null; // the result the marker shows now (R), or null

  const ray = (ox, oy, oz, dx, dy, dz, max, out) => { S.rays++; return city.raycast(ox, oy, oz, dx, dy, dz, max, out); };

  /* ---- the buildings that held the last two ropes ---- */
  function noteLet(bid, time) {
    const r = S.recent;
    if (bid == null || bid < 0) return;
    if (r[0].bid === bid) { r[0].t = time; return; }
    r[1].bid = r[0].bid; r[1].t = r[0].t; r[0].bid = bid; r[0].t = time;
  }
  // a building that held a rope last frame and holds none now has just let go
  function track(ctx) {
    const a = ctx.avoidBid == null ? null : ctx.avoidBid, b = ctx.avoidBid2 == null ? null : ctx.avoidBid2;
    if (S.avoid !== null && S.avoid !== a && S.avoid !== b) noteLet(S.avoid, ctx.time);
    if (S.avoid2 !== null && S.avoid2 !== a && S.avoid2 !== b) noteLet(S.avoid2, ctx.time);
    S.avoid = a; S.avoid2 = b;
  }
  const isRecent = (bid, time) => { const r = S.recent, P = cfg.recent; return (r[0].bid === bid && time - r[0].t < P.secs) || (P.count > 1 && r[1].bid === bid && time - r[1].t < P.secs); };
  const avoids = (bid, ctx) => bid >= 0 && (bid === ctx.avoidBid || bid === ctx.avoidBid2);

  /* ---- the pieces ---- */
  // the preferred elevation of the fan: the view pitch plus 35 degrees, held to 35 to 60, higher while you fall
  function preferred(ctx) {
    const L = cfg.lift;
    let e = clamp(ctx.pitch / DEG + L.base, L.min, L.max);
    const fall = -ctx.vel.y;
    if (fall > L.fallFrom) e += L.fall * clamp((fall - L.fallFrom) / (L.fallTo - L.fallFrom), 0, 1);
    return Math.min(e, L.top);
  }
  // the swing test: far enough and near enough, high enough over the chest, not a roof or a floor, not a thin pole
  const reach = (y, ny, col, dist, T, ctx) => dist >= T.min && dist <= T.max && y - ctx.chestY > T.above && ny <= 0.7 && col.tag !== "antenna";
  // in front of the camera and inside 0.92 of its half width (tier 1 only; above the top edge is fine)
  function onScreen(ctx, x, y, z) {
    project(ctx, x, y, z, NDC);
    return !NDC.behind && Math.abs(NDC.x) <= cfg.fan.screenX;
  }
  function angleFrom(ctx, x, y, z) {
    const cy = Math.cos(ctx.yaw), sy = Math.sin(ctx.yaw), cp = Math.cos(ctx.pitch), sp = Math.sin(ctx.pitch);
    const dx = x - ctx.cam.x, dy = y - ctx.cam.y, dz = z - ctx.cam.z, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    return Math.acos(clamp((-dx * sy * cp + dy * sp - dz * cy * cp) / l, -1, 1)) / DEG;
  }
  // the score of tier 1 (higher is better): the angle to the preferred direction, distance, height, the way you fly, a wall, and
  // a building that held one of the last two ropes
  function score(ctx, x, y, z, ny, bid, dist, angN) {
    const W = cfg.weight, D = cfg.dist, head = ctx.head, v = ctx.vel;
    const dd = dist < D.near ? (D.near - dist) / D.ramp : dist > D.far ? (dist - D.far) / D.ramp : 0;
    let s = 1 - W.angle * angN - W.distance * Math.min(1, dd);
    const up = y - ctx.chestY;
    if (up > 0) s += W.up * Math.min(1, up / 20);
    const vl = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (vl > 3 && dist > 1e-3) {
      const d = ((x - head.x) * v.x + (y - head.y) * v.y + (z - head.z) * v.z) / (dist * vl);
      if (d > 0) s += W.ahead * d * Math.min(1, vl / 10);
    }
    if (Math.abs(ny) < 0.35) s += W.wall;
    if (isRecent(bid, ctx.time)) s -= cfg.recent.penalty;
    return Math.max(0.01, s);
  }
  // the angle (0 to 1 over the fan) between a direction from the head and the preferred direction (bearing and elevation)
  function angN(ctx, dx, dy, dz, bearing) {
    const F = cfg.fan, w = ctx.aimWidth || F.az.med, pe = S.pref * DEG, maxAng = Math.hypot(w, F.elSpan) * DEG;
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const pdx = -Math.sin(bearing) * Math.cos(pe), pdy = Math.sin(pe), pdz = -Math.cos(bearing) * Math.cos(pe);
    return clamp(Math.acos(clamp((dx * pdx + dy * pdy + dz * pdz) / l, -1, 1)) / maxAng, 0, 1);
  }
  function fill(r, h, dist, tier, sc) {
    r.x = h.x; r.y = h.y; r.z = h.z; r.nx = h.nx; r.ny = h.ny; r.nz = h.nz;
    r.tag = h.collider.tag; r.id = h.collider.id; r.cid = h.collider.id; r.bid = bidOf(h.collider);
    r.dist = dist; r.valid = true; r.near = true; r.special = false; r.score = sc; r.tier = tier; r.kind = "swing"; r.prio = false; r.same = false;
    return r;
  }
  const copy = (d, s) => {
    d.x = s.x; d.y = s.y; d.z = s.z; d.nx = s.nx; d.ny = s.ny; d.nz = s.nz; d.tag = s.tag; d.id = s.id; d.cid = s.cid; d.bid = s.bid;
    d.dist = s.dist; d.valid = s.valid; d.near = s.near; d.special = s.special; d.score = s.score; d.tier = s.tier; d.kind = s.kind; d.prio = s.prio; d.same = s.same;
    return d;
  };

  /* ---- the specials: a clog, a pipe, the gold ring ---- */
  // The one nearest the axis wins. The axis is the camera forward, or the tapped ray (tap: { x, y, z, dx, dy, dz }). It must lie
  // within lim degrees (lim.leave for the one that already is the target, heldId) and in line of sight from the head.
  function findSpecial(ctx, list, lim, heldId, tap, range) {
    const head = ctx.head, T = cfg.special;
    let ox = ctx.cam.x, oy = ctx.cam.y, oz = ctx.cam.z, fx, fy, fz;
    if (tap) { ox = tap.x; oy = tap.y; oz = tap.z; fx = tap.dx; fy = tap.dy; fz = tap.dz; }
    else { const cy = Math.cos(ctx.yaw), sy = Math.sin(ctx.yaw), cp = Math.cos(ctx.pitch); fx = -sy * cp; fy = Math.sin(ctx.pitch); fz = -cy * cp; }
    let best = null, bestA = 1e9, near = false;
    if (list) {
      for (let k = 0; k < list.length; k++) {
        const s = list[k];
        if (!s || !s.pos || s.tag === "crack") continue;
        const px = s.pos.x - head.x, py = s.pos.y - head.y, pz = s.pos.z - head.z, dist = Math.sqrt(px * px + py * py + pz * pz);
        if (dist < 1) continue;
        const qx = s.pos.x - ox, qy = s.pos.y - oy, qz = s.pos.z - oz, ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
        const ang = Math.acos(clamp((qx * fx + qy * fy + qz * fz) / ql, -1, 1)) / DEG;
        if (!tap && dist <= T.range && ang <= T.near) near = true;
        if (dist > range || ang > (s.id === heldId ? lim.leave : lim.enter)) continue;
        const n = s.normal;
        if (s.tag === "pipe" && n && -(px * n.x + py * n.y + pz * n.z) / dist < PIPE_COS) continue;
        if (ray(head.x, head.y, head.z, px, py, pz, dist - 0.6, LOS)) continue;
        if (ang < bestA) { best = s; bestA = ang; }
      }
    }
    if (!tap) S.specialNear = near;
    if (!best) return null;
    const r = SPR, dx = best.pos.x - head.x, dy = best.pos.y - head.y, dz = best.pos.z - head.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    r.x = best.pos.x; r.y = best.pos.y; r.z = best.pos.z;
    if (best.normal) { r.nx = best.normal.x; r.ny = best.normal.y; r.nz = best.normal.z; } else { r.nx = -dx / dist; r.ny = -dy / dist; r.nz = -dz / dist; }
    r.tag = best.tag; r.id = best.id; r.cid = -1; r.bid = -1; r.dist = dist; r.valid = true; r.near = true; r.special = true; r.score = 1 - bestA / 90;
    r.tier = 0; r.kind = best.tag === "pipe" ? "pipe" : "clog"; r.prio = true; r.same = false;
    return r;
  }
  // the gold ring of tutorial step 0: within 80 m and 35 degrees of the view bearing at any elevation, in line of sight from the head.
  // The target is the first point a ray from the head to the ring centre hits, on the face of the tower.
  function ringInReach(ctx) {
    const g = ctx.ring, head = ctx.head;
    if (!g) return false;
    const dx = g.x - head.x, dz = g.z - head.z;
    return Math.abs(wrap(Math.atan2(-dx, -dz) - ctx.yaw)) <= cfg.ring.bearing * DEG && Math.sqrt(dx * dx + (g.y - head.y) ** 2 + dz * dz) <= cfg.ring.range;
  }
  function findRing(ctx) {
    if (!ringInReach(ctx)) return null;
    const g = ctx.ring, head = ctx.head, dx = g.x - head.x, dy = g.y - head.y, dz = g.z - head.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const h = ray(head.x, head.y, head.z, dx, dy, dz, dist + 3, HC);
    if (!h || Math.abs(h.t - dist) > 3 || !reach(h.y, h.ny, h.collider, h.t, cfg.tier3, ctx)) return null;
    const r = fill(SPR, h, h.t, 0, 1);
    r.kind = "ring"; r.prio = true;
    return r;
  }

  /* ---- tier 1: the fan ---- */
  function tier1(ctx, allowSame, bias) {
    const F = cfg.fan, T = cfg.tier1, head = ctx.head, wall = ctx.wall;
    const w = ctx.aimWidth || F.az.med;
    let bearing = ctx.yaw;
    if (bias != null) bearing = bias;
    else if (wall && -Math.sin(ctx.yaw) * wall.nx - Math.cos(ctx.yaw) * wall.nz < 0.2) bearing = Math.atan2(-wall.nx, -wall.nz); // the way out of the wall
    const nAz = Math.floor((2 * w) / F.azStep + 1e-6) + 1, nEl = Math.floor((2 * F.elSpan) / F.elStep + 1e-6) + 1;
    let best = -1;
    for (let a = 0; a < nAz; a++) {
      const yaw = bearing + (-w + a * F.azStep) * DEG, sy = Math.sin(yaw), cy = Math.cos(yaw);
      for (let e = 0; e < nEl; e++) {
        const el = S.pref - F.elSpan + e * F.elStep;
        if (el < F.elMin || el > F.elMax) continue;
        const ce = Math.cos(el * DEG), dx = -sy * ce, dy = Math.sin(el * DEG), dz = -cy * ce;
        const h = ray(head.x, head.y, head.z, dx, dy, dz, 88, HIT);
        if (!h || !reach(h.y, h.ny, h.collider, h.t, T, ctx)) continue;
        const bid = bidOf(h.collider);
        if (!allowSame && avoids(bid, ctx)) continue;
        if (!wall && !onScreen(ctx, h.x, h.y, h.z)) continue; // on a wall the outward side lies behind the chase camera
        const s = score(ctx, h.x, h.y, h.z, h.ny, bid, h.t, angN(ctx, dx, dy, dz, bearing));
        if (s > best) { best = s; fill(T1, h, h.t, 1, s); }
      }
    }
    return best > 0 ? T1 : null;
  }

  /* ---- tier 2: the wide search, the old phone assist ---- */
  const CD = { x: 0, y: 0, z: 0 };
  function tier2(ctx, allowSame) {
    const T = cfg.tier2, head = ctx.head, v = ctx.vel;
    const yaw0 = Math.sqrt(v.x * v.x + v.z * v.z) > T.minSpeed ? Math.atan2(-v.x, -v.z) : ctx.yaw;
    const s0 = -Math.sin(yaw0), c0 = -Math.cos(yaw0), cone = T.cone * DEG;
    for (let yi = 0; yi < T.yaw.length; yi++) for (let pi = 0; pi < T.pitch.length; pi++) {
      const yaw = yaw0 + T.yaw[yi] * DEG, pitch = T.pitch[pi] * DEG, cp = Math.cos(pitch);
      CD.x = -Math.sin(yaw) * cp; CD.y = Math.sin(pitch); CD.z = -Math.cos(yaw) * cp;
      const h = ray(head.x, head.y, head.z, CD.x, CD.y, CD.z, RANGE, HIT);
      if (h) {
        // the exact ray hits within reach: it is the only candidate of this direction
        if (ok2(ctx, h, h.t, T, s0, c0, allowSame)) return fill(T2, h, h.t, 2, 1);
        continue;
      }
      // a miss: the cone of 24 rays about it. The best of those that qualify is the candidate
      let ux, uy, uz;
      if (Math.abs(CD.y) < 0.9) { ux = CD.z; uy = 0; uz = -CD.x; } else { ux = 0; uy = -CD.z; uz = CD.y; } // (0,1,0) x D, or (1,0,0) x D
      const ul = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= ul; uy /= ul; uz /= ul;
      const wx = CD.y * uz - CD.z * uy, wy = CD.z * ux - CD.x * uz, wz = CD.x * uy - CD.y * ux;
      let bs = -1;
      for (let k = 0; k < CONE.length; k++) {
        const f = CONE[k][0], ca = CONE[k][1], sa = CONE[k][2], th = cone * f, ct = Math.cos(th), st = Math.sin(th);
        const rx = CD.x * ct + (ux * ca + wx * sa) * st, ry = CD.y * ct + (uy * ca + wy * sa) * st, rz = CD.z * ct + (uz * ca + wz * sa) * st;
        const c = ray(head.x, head.y, head.z, rx, ry, rz, RANGE, HC);
        if (!c || (c.ny > 0.7 && c.y < head.y - 0.3) || !ok2(ctx, c, c.t, T, s0, c0, allowSame)) continue;
        const s = oldScore(ctx, c, f);
        if (s > bs) { bs = s; fill(T2, c, c.t, 2, s); }
      }
      if (bs > 0) return T2;
    }
    return null;
  }
  // the test of tier 2: reach, and more than 2 m ahead of the body along the heading
  function ok2(ctx, h, dist, T, s0, c0, allowSame) {
    if (!reach(h.y, h.ny, h.collider, dist, T, ctx)) return false;
    if ((h.x - ctx.head.x) * s0 + (h.z - ctx.head.z) * c0 <= T.ahead) return false;
    return allowSame || !avoids(bidOf(h.collider), ctx);
  }
  // the score of rope.js for the cone: the angle off the ray counts most, then distance, height and the way you fly
  function oldScore(ctx, h, f) {
    const head = ctx.head, v = ctx.vel;
    let s = 1 - 0.55 * f - 0.3 * (h.t / RANGE);
    const up = h.y - head.y;
    if (up > 0) s += 0.25 * Math.min(1, up / 15);
    const vl = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (vl > 2 && h.t > 1e-3) {
      const d = ((h.x - head.x) * v.x + (h.y - head.y) * v.y + (h.z - head.z) * v.z) / (h.t * vl);
      if (d > 0) s += 0.15 * d * Math.min(1, vl / 10);
    }
    return Math.max(0.01, s);
  }

  /* ---- tier 3: the exact ray through the screen centre ---- */
  function tier3(ctx, allowSame) {
    const e = ctx.exact;
    if (!e || !e.collider) return null;
    const dx = e.x - ctx.head.x, dy = e.y - ctx.head.y, dz = e.z - ctx.head.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!reach(e.y, e.ny, e.collider, dist, cfg.tier3, ctx)) return null;
    if (!allowSame && avoids(bidOf(e.collider), ctx)) return null;
    return fill(T1, e, dist, 3, 1);
  }

  /* ---- the held target ---- */
  // Is the held target still a good one? One ray, from the head to the held point.
  function recheck(ctx) {
    const head = ctx.head, dx = H.x - head.x, dy = H.y - head.y, dz = H.z - head.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1e-3) return false;
    if (H.prio && H.kind !== "ring") {
      // a clog or a pipe stays the target until it is 28 degrees from the camera forward
      const list = S.specials;
      let s = null;
      if (list) for (let k = 0; k < list.length; k++) if (list[k] && list[k].id === H.id) { s = list[k]; break; }
      if (!s || dist > cfg.special.range || angleFrom(ctx, H.x, H.y, H.z) > cfg.special.leave) return false;
      if (s.tag === "pipe" && s.normal && -(dx * s.normal.x + dy * s.normal.y + dz * s.normal.z) / dist < PIPE_COS) return false;
      H.dist = dist;
      return !ray(head.x, head.y, head.z, dx, dy, dz, Math.max(0.1, dist - 0.6), LOS);
    }
    if (H.kind === "ring" && !ringInReach(ctx)) return false;
    const T = H.tier === 1 ? cfg.tier1 : H.tier === 2 ? cfg.tier2 : cfg.tier3;
    if (dist < T.min || dist > T.max || H.y - ctx.chestY <= T.above || avoids(H.bid, ctx)) return false;
    if (H.tier === 1 && !ctx.wall && !onScreen(ctx, H.x, H.y, H.z)) return false;
    const h = ray(head.x, head.y, head.z, dx, dy, dz, dist + 3, HC);
    if (!h || h.collider.id !== H.cid || Math.abs(h.t - dist) > 2) return false;
    H.dist = dist;
    return true;
  }
  // the score of the held target now, as tier 1 would see it
  function heldScore(ctx) {
    const head = ctx.head, dx = H.x - head.x, dy = H.y - head.y, dz = H.z - head.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    return score(ctx, H.x, H.y, H.z, H.ny, H.bid, dist, angN(ctx, dx, dy, dz, ctx.yaw));
  }
  function hold(r, ctx) { copy(H, r); H.t0 = ctx.time; S.has = true; }
  function publish(ctx) { copy(R, H); R.same = false; cur = R; S.tier = R.tier; return cur; }
  function none() { S.has = false; cur = null; S.tier = 0; return null; }

  /* ---- one search ---- */
  // force: a press or a tap wants an answer now. bias: a bearing (radians) for the fan, or null.
  function run(ctx, force, bias) {
    S.ctx = ctx;
    const time = ctx.time;
    S.pref = preferred(ctx);
    const had = S.has, heldOk = had && recheck(ctx);
    S.has = heldOk;
    if (!force && time - S.tFan < cfg.rate && (heldOk || !had)) {
      // between searches the held target costs its one ray; with none held, the last answer stands. In first person the crosshair
      // point follows the view frame by frame (main casts that ray anyway)
      if (ctx.first && !(heldOk && H.prio) && grabExact(ctx, heldOk)) return publish(ctx);
      if (heldOk) return publish(ctx);
      return cur && cur.same ? cur : none();
    }
    S.tFan = time; S.picks++;
    S.specials = typeof ctx.specials === "function" ? ctx.specials() : ctx.specials || null;
    // 1. a clog, a pipe or the gold ring: it wins at once
    let c = findSpecial(ctx, S.specials, cfg.special, heldOk && H.prio ? H.id : null, null, cfg.special.range) || findRing(ctx);
    if (c) {
      if (heldOk && H.prio && H.id === c.id && H.kind === c.kind) { H.x = c.x; H.y = c.y; H.z = c.z; H.dist = c.dist; } else hold(c, ctx);
      return publish(ctx);
    }
    if (heldOk && H.prio) S.has = false; // a special that is no longer one
    const keep = S.has; // a held building that is still valid
    // 2. first person: the exact ray
    if (ctx.first && grabExact(ctx, keep)) return publish(ctx);
    // 3. the fan. A challenger replaces a valid held target only when it scores more than 20 percent higher and the held one is old enough
    c = tier1(ctx, false, bias);
    if (c) {
      if (keep && H.tier === 1) {
        const hs = heldScore(ctx);
        if (!(c.score > hs * (1 + cfg.hold.margin) && time - H.t0 >= cfg.hold.dwell)) return publish(ctx);
        S.better++; S.ratioMin = Math.min(S.ratioMin, c.score / hs); S.ageMin = Math.min(S.ageMin, time - H.t0);
      }
      hold(c, ctx);
      return publish(ctx);
    }
    if (keep) return publish(ctx);
    // 4. tier 2 (at most 5 times a second, at once on a press), then the exact ray in third person
    if (force || time - S.tWide >= cfg.rateWide) { S.tWide = time; c = tier2(ctx, false); }
    if (!c) c = tier3(ctx, false);
    if (c) { hold(c, ctx); return publish(ctx); }
    // 5. only the building that holds a rope qualifies: the result says so, and nothing is held
    if (ctx.avoidBid != null || ctx.avoidBid2 != null) {
      c = tier1(ctx, true, bias) || tier2(ctx, true) || tier3(ctx, true);
      if (c && avoids(c.bid, ctx)) { copy(R, c); R.same = true; S.has = false; cur = R; S.tier = c.tier; return cur; }
    }
    return none();
  }
  // first person: the point the crosshair rests on, when it can hold a swing
  function grabExact(ctx, heldOk) {
    const c = ctx.exact ? tier3(ctx, false) : null;
    if (!c) return false;
    if (!(heldOk && H.tier === 3 && H.cid === c.cid)) H.t0 = ctx.time;
    copy(H, c); S.has = true;
    return true;
  }

  /* ---- the API ---- */
  const T = {
    // the marker search, every frame: the held target costs one ray, and a fan search runs at most every 50 ms
    update(ctx) {
      S.rays = 0;
      track(ctx);
      return run(ctx, false, null);
    },
    // an immediate search, for a press. opts (each optional): { avoidBid, exact, bias }
    pick(ctx, opts) {
      S.rays = 0;
      track(ctx);
      const a = ctx.avoidBid, e = ctx.exact;
      if (opts && opts.avoidBid !== undefined) ctx.avoidBid = opts.avoidBid;
      if (opts && opts.exact !== undefined) ctx.exact = opts.exact;
      const r = run(ctx, true, opts && opts.bias != null ? opts.bias : null);
      ctx.avoidBid = a; ctx.exact = e;
      return r;
    },
    // A phone tap. ray = { x, y, z, dx, dy, dz } from the camera (the direction a unit vector), or null for the SWING button.
    // The rope goes to the first of these that exists: a clog or a pipe near the ray, the exact point, the marked target, a search
    // with the bearing of the tap. With a rope out, the building that holds it is skipped, and when only that one qualifies the
    // result says same: the rope stays.
    tap(ctx, ray_, opts) {
      S.rays = 0; S.ctx = ctx;
      const a = ctx.avoidBid, b = ctx.avoidBid2;
      if (opts && opts.avoidBid !== undefined) ctx.avoidBid = opts.avoidBid;
      let res = tapSteps(ctx, ray_, false);
      if (!res && (ctx.avoidBid != null || ctx.avoidBid2 != null)) {
        const x = ctx.avoidBid, y = ctx.avoidBid2;
        ctx.avoidBid = ctx.avoidBid2 = null;
        res = tapSteps(ctx, ray_, true);
        ctx.avoidBid = x; ctx.avoidBid2 = y;
        if (res) res.same = avoids(res.bid, ctx);
        if (res && !res.same) res = null; // (a building the first pass skipped for no reason cannot be)
      }
      ctx.avoidBid = a; ctx.avoidBid2 = b;
      return res;
    },
    // 0 (left) or 1 (right): the side of the target, seen from above. Close to the view axis, the hand that did not fire last.
    hand(res, ctx) {
      if (!res) return 1 - S.lastHand;
      const d = wrap(Math.atan2(-(res.x - ctx.head.x), -(res.z - ctx.head.z)) - ctx.yaw) / DEG; // + is to the left
      S.side = d;
      if (d > cfg.side) return 0;
      if (d < -cfg.side) return 1;
      return 1 - S.lastHand;
    },
    fired(i) { S.lastHand = i; },
    // true when the next update searches: main fills the specials only then
    due(time) { return !S.has || time - S.tFan >= cfg.rate; },
    result: () => cur,
    releaseWindow, kick, project,
    reset() {
      S.has = false; cur = null; S.tFan = S.tWide = -1e9; S.lastHand = 1; S.avoid = S.avoid2 = null; S.tier = 0; S.specialNear = false; S.specials = null;
      S.better = 0; S.ratioMin = S.ageMin = Infinity;
      S.recent[0].bid = S.recent[1].bid = -1; S.recent[0].t = S.recent[1].t = -1e9;
    },
    // for G.test.target() and the tests
    info() {
      const o = T._info || (T._info = { tier: 0, target: null, hand: 0, side: 0, ndc: { x: 0, y: 0 }, inView: false, behind: false, pref: 0, avoid: null, cue: false, specialNear: false, picks: 0, rays: 0, recent: [] });
      o.tier = S.tier;
      o.target = cur ? { x: cur.x, y: cur.y, z: cur.z, tag: cur.tag, id: cur.id, bid: cur.bid, dist: cur.dist, kind: cur.kind, special: cur.special, same: cur.same, tier: cur.tier } : null;
      o.hand = S.ctx && cur ? T.hand(cur, S.ctx) : 1 - S.lastHand; o.side = S.side;
      if (cur && S.ctx && S.ctx.cam) { project(S.ctx, cur.x, cur.y, cur.z, NDC); o.ndc.x = NDC.x; o.ndc.y = NDC.y; o.inView = NDC.inView; o.behind = NDC.behind; } else { o.ndc.x = o.ndc.y = 0; o.inView = o.behind = false; }
      o.pref = S.pref; o.avoid = S.avoid; o.specialNear = S.specialNear; o.picks = S.picks; o.rays = S.rays;
      o.switches = { better: S.better, ratioMin: S.ratioMin, ageMin: S.ageMin }; // the changes of target by the 20 percent rule
      o.recent = S.recent.map((r) => ({ bid: r.bid, t: r.t }));
      return o;
    },
    get specialNear() { return S.specialNear; },
    get pref() { return S.pref; },
  };

  // the four steps of a tap, once. relaxed: the building that holds a rope may be the answer
  function tapSteps(ctx, ray_, relaxed) {
    if (ray_ && !relaxed) {
      const list = typeof ctx.specials === "function" ? S.specials || ctx.specials() : ctx.specials;
      const sp = findSpecial(ctx, list, { enter: cfg.special.tap, leave: cfg.special.tap }, null, ray_, cfg.special.tapRange);
      if (sp) return copy(TR, sp);
    }
    if (ray_) {
      const h = ray(ray_.x, ray_.y, ray_.z, ray_.dx, ray_.dy, ray_.dz, 400, EX);
      if (h) {
        const dx = h.x - ctx.head.x, dy = h.y - ctx.head.y, dz = h.z - ctx.head.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (reach(h.y, h.ny, h.collider, dist, cfg.tier3, ctx) && (relaxed || !avoids(bidOf(h.collider), ctx))) return fill(TR, h, dist, 3, 1);
      }
    }
    if (cur && cur.valid && (relaxed || (!cur.same && !avoids(cur.bid, ctx)))) return copy(TR, cur);
    let bias = null;
    if (ray_ && Math.hypot(ray_.dx, ray_.dz) >= cfg.bias.steepHoriz) bias = Math.atan2(-ray_.dx, -ray_.dz); // a steep ray gives no bearing
    const r = run(ctx, true, bias);
    return r ? copy(TR, r) : null;
  }
  return T;
}
