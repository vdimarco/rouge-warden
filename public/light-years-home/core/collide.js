// Light Years Home v3: collision broadphase and the near-miss tracker (handling §3.7, §3.9; tech §3.4). A uniform grid
// of 32 u cells on the zone's plane holds the static bodies (built once) and the traffic (rebuilt at 30 Hz from the
// zone clock). The ship asks for candidates near it, then checks each one exactly at this step's time. Grids and
// candidate lists are scratch, not game state; the tracker is game state (game.near). Nothing here allocates per step.
import { TUNE } from './tune.js';
import { posAt, KIND } from './traffic.js';

// Candidate ids: traffic body i is i; static body k is STATIC_BASE + k; actor j is ACTOR_BASE + j. −1 is empty.
export const STATIC_BASE = 1 << 24;
export const ACTOR_BASE = 1 << 25;
export const isStatic = (id) => id >= STATIC_BASE && id < ACTOR_BASE;
export const isActor = (id) => id >= ACTOR_BASE;

/** createGrid(cell = 32, half = 1000) → a grid covering [−half, half] in x and y. */
export function createGrid(cell = 32, half = 1000) {
  const dim = Math.ceil((2 * half) / cell);
  return {
    cell, half, dim,
    // traffic
    head: new Int32Array(dim * dim).fill(-1), next: new Int32Array(0), tpos: new Float64Array(0),
    tpos1: new Float64Array(0), tfade: new Float32Array(0), tfade1: new Float32Array(0), builtAt: NaN, builtK: NaN,
    traffic: null, movers: new Int32Array(0), nMovers: 0,
    // swarm and parked bodies hardly move: bucketed once by their home, found with a margin of their drift
    whead: new Int32Array(dim * dim).fill(-1), wnext: new Int32Array(0), wmargin: 0,
    // statics: per-cell lists of entries (an entry is one static in one cell)
    shead: new Int32Array(dim * dim).fill(-1), snext: new Int32Array(64), sref: new Int32Array(64), sn: 0,
    sx: [], sy: [], sz: [], sr: [], sid: [], count: 0,
    stamp: new Uint32Array(0), mark: 1,
  };
}

const cellOf = (g, v) => Math.floor((v + g.half) / g.cell);

/** addStatic(grid, id, pos, r) → k: a static sphere; queries return it as STATIC_BASE + k. id is any number. */
export function addStatic(g, id, pos, r) {
  const k = g.count++;
  g.sx.push(pos[0]); g.sy.push(pos[1]); g.sz.push(pos[2] || 0); g.sr.push(r); g.sid.push(id);
  const stamp = new Uint32Array(g.count);
  stamp.set(g.stamp.subarray(0, Math.min(g.stamp.length, g.count)));
  g.stamp = stamp;
  const x0 = Math.max(0, cellOf(g, pos[0] - r)), x1 = Math.min(g.dim - 1, cellOf(g, pos[0] + r));
  const y0 = Math.max(0, cellOf(g, pos[1] - r)), y1 = Math.min(g.dim - 1, cellOf(g, pos[1] + r));
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (g.sn >= g.snext.length) {
        const nn = new Int32Array(g.snext.length * 2); nn.set(g.snext); g.snext = nn;
        const nr = new Int32Array(g.sref.length * 2); nr.set(g.sref); g.sref = nr;
      }
      const c = cy * g.dim + cx;
      g.sref[g.sn] = k;
      g.snext[g.sn] = g.shead[c];
      g.shead[c] = g.sn++;
    }
  }
  return k;
}

export const TICK = 1 / 30;           // s between traffic grid rebuilds

// Bodies that move along roads and orbits are the grid's movers; swarm and parked bodies stay near home and are
// bucketed once (the 30 Hz work is then a few hundred bodies, not thousands).
function setTraffic(g, tr) {
  g.traffic = tr;
  g.next = new Int32Array(tr.n);
  g.tpos = new Float64Array(tr.n * 3);
  g.tpos1 = new Float64Array(tr.n * 3);
  g.tfade = new Float32Array(tr.n);
  g.tfade1 = new Float32Array(tr.n);
  g.wnext = new Int32Array(tr.n).fill(-2);
  g.whead.fill(-1);
  const movers = [];
  let margin = 0;
  for (let i = 0; i < tr.n; i++) {
    if (tr.kind[i] === KIND.road || tr.kind[i] === KIND.orbit) { movers.push(i); continue; }
    if (tr.rc[i] <= 0) continue;
    const cx = cellOf(g, tr.bx[i]), cy = cellOf(g, tr.by[i]);
    if (cx < 0 || cy < 0 || cx >= g.dim || cy >= g.dim) continue;
    const c = cy * g.dim + cx;
    g.wnext[i] = g.whead[c];
    g.whead[c] = i;
    if (tr.kind[i] === KIND.swarm) margin = Math.max(margin, tr.offset[i] * 1.01 + 0.01);
  }
  g.movers = Int32Array.from(movers);
  g.nMovers = movers.length;
  g.wmargin = margin;
  g.builtK = NaN;
}

function fillMovers(g, tr, t, pos, fade) {
  const m = g.movers;
  for (let k = 0; k < g.nMovers; k++) {
    const i = m[k];
    fade[i] = posAt(tr, i, t, P3);
    pos[i * 3] = P3[0]; pos[i * 3 + 1] = P3[1]; pos[i * 3 + 2] = P3[2];
  }
}
const P3 = [0, 0, 0];

/**
 * rebuildTraffic(grid, traffic, t): the road and orbit traffic at the 30 Hz tick t and at the next tick, bucketed by
 * where it is at t. Between the two ticks a body's place is the straight blend (trafficAt): exact at both ends and
 * within a few thousandths of a u in between, so a step needs no spline lookups. Each tick's positions are kept for
 * the next rebuild, so one rebuild evaluates each mover once. Faded bodies (road ends) and bodies with no collider are
 * left out. Swarm and parked bodies are bucketed once; query finds them with a margin for their drift.
 */
export function rebuildTraffic(g, tr, t) {
  if (!tr) return;
  if (g.traffic !== tr || g.next.length < tr.n) setTraffic(g, tr);
  const k = Math.round(t / TICK);
  if (g.builtK === k - 1) {
    const a = g.tpos; g.tpos = g.tpos1; g.tpos1 = a;              // the old next tick is this tick, bit for bit
    const f = g.tfade; g.tfade = g.tfade1; g.tfade1 = f;
  } else if (g.builtK !== k) {
    fillMovers(g, tr, k * TICK, g.tpos, g.tfade);
  }
  if (g.builtK !== k) fillMovers(g, tr, (k + 1) * TICK, g.tpos1, g.tfade1);
  g.head.fill(-1);
  const m = g.movers;
  for (let j = 0; j < g.nMovers; j++) {
    const i = m[j];
    if (g.tfade[i] < 0.999 || g.tfade1[i] < 0.999 || tr.rc[i] <= 0) { g.next[i] = -2; continue; }
    const cx = cellOf(g, g.tpos[i * 3]), cy = cellOf(g, g.tpos[i * 3 + 1]);
    if (cx < 0 || cy < 0 || cx >= g.dim || cy >= g.dim) { g.next[i] = -2; continue; }
    const c = cy * g.dim + cx;
    g.next[i] = g.head[c];
    g.head[c] = i;
  }
  g.builtK = k;
  g.builtAt = k * TICK;
}

/**
 * trafficAt(grid, i, t, out, outVel?) → out: a mover (road or orbit body) at time t, between builtAt and the next tick,
 * from the grid. Swarm and parked bodies are not kept here: use traffic.js posAt and velAt for them.
 */
export function trafficAt(g, i, t, out, outVel = null) {
  const f = Math.min(1, Math.max(0, (t - g.builtAt) / TICK));
  const a = g.tpos, b = g.tpos1, k = i * 3;
  out[0] = a[k] + (b[k] - a[k]) * f;
  out[1] = a[k + 1] + (b[k + 1] - a[k + 1]) * f;
  out[2] = a[k + 2] + (b[k + 2] - a[k + 2]) * f;
  if (outVel) {
    outVel[0] = (b[k] - a[k]) / TICK; outVel[1] = (b[k + 1] - a[k + 1]) / TICK; outVel[2] = (b[k + 2] - a[k + 2]) / TICK;
  }
  return out;
}

/**
 * query(grid, pos, r, outIds) → n: every traffic body and static whose cell lies within r of pos (x and y only).
 * Statics come back once each as STATIC_BASE + k. The caller checks exact distances. Stops at outIds.length.
 */
export function query(g, pos, r, outIds) {
  const cap = outIds.length;
  let n = 0;
  // Swarm and parked bodies sit in their home cell; look wider by their drift.
  const rw = r + g.wmargin;
  const wx0 = Math.max(0, cellOf(g, pos[0] - rw)), wx1 = Math.min(g.dim - 1, cellOf(g, pos[0] + rw));
  const wy0 = Math.max(0, cellOf(g, pos[1] - rw)), wy1 = Math.min(g.dim - 1, cellOf(g, pos[1] + rw));
  for (let cy = wy0; cy <= wy1; cy++) {
    for (let cx = wx0; cx <= wx1; cx++) {
      for (let i = g.whead[cy * g.dim + cx]; i >= 0; i = g.wnext[i]) {
        if (n >= cap) return n;
        outIds[n++] = i;
      }
    }
  }
  const x0 = Math.max(0, cellOf(g, pos[0] - r)), x1 = Math.min(g.dim - 1, cellOf(g, pos[0] + r));
  const y0 = Math.max(0, cellOf(g, pos[1] - r)), y1 = Math.min(g.dim - 1, cellOf(g, pos[1] + r));
  g.mark = (g.mark + 1) >>> 0 || 1;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const c = cy * g.dim + cx;
      for (let i = g.head[c]; i >= 0; i = g.next[i]) {
        if (n >= cap) return n;
        outIds[n++] = i;
      }
      for (let e = g.shead[c]; e >= 0; e = g.snext[e]) {
        const k = g.sref[e];
        if (g.stamp[k] === g.mark) continue;
        g.stamp[k] = g.mark;
        if (n >= cap) return n;
        outIds[n++] = STATIC_BASE + k;
      }
    }
  }
  return n;
}

const HIT = { t: 0, n: [0, 0, 0] };

/**
 * sweepCapsule(p0, p1, rc, centre, r) → { t, n } | null. A sphere of radius rc moving from p0 to p1 against a still
 * sphere (centre, r): the first touch at t in [0, 1] and the unit normal there (from the body to the ship). Already
 * touching gives t = 0. The ship sweeps its capsule as three such spheres (nose, middle, tail). The result object is
 * reused by the next call.
 */
export function sweepCapsule(p0, p1, rc, centre, r) {
  const R = r + rc;
  const mx = p0[0] - centre[0], my = p0[1] - centre[1], mz = p0[2] - centre[2];
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const c = mx * mx + my * my + mz * mz - R * R;
  let t;
  if (c <= 0) {
    t = 0;
  } else {
    const a = dx * dx + dy * dy + dz * dz;
    if (a < 1e-12) return null;
    const b = mx * dx + my * dy + mz * dz;
    if (b >= 0) return null;                          // moving away
    const disc = b * b - a * c;
    if (disc < 0) return null;
    t = (-b - Math.sqrt(disc)) / a;
    if (t > 1) return null;
  }
  const hx = mx + dx * t, hy = my + dy * t, hz = mz + dz * t;
  const l = Math.sqrt(hx * hx + hy * hy + hz * hz);
  if (l > 1e-9) { HIT.n[0] = hx / l; HIT.n[1] = hy / l; HIT.n[2] = hz / l; }
  else { HIT.n[0] = 0; HIT.n[1] = 0; HIT.n[2] = 1; }
  HIT.t = t;
  return HIT;
}

/**
 * How a contact plays out (handling §3.9): the angle between the relative velocity and the surface's tangent plane.
 * Returns 'scrape' under SCRAPE_DEG, else 'headon'. For two ships, a side hit with TAKEDOWN_REL u/s or more of
 * sideways closing speed while the hitter is at least as fast is a 'takedown'. rel is the hitter's velocity minus the
 * target's; n points from the target to the hitter; targetVel is null for bodies.
 */
export function classifyHit(rel, n, hitterSpeed, targetVel, tune = TUNE) {
  const C = tune.COLLIDE;
  const rs = Math.sqrt(rel[0] * rel[0] + rel[1] * rel[1] + rel[2] * rel[2]);
  const into = -(rel[0] * n[0] + rel[1] * n[1] + rel[2] * n[2]);
  if (targetVel) {
    const ts = Math.sqrt(targetVel[0] ** 2 + targetVel[1] ** 2 + targetVel[2] ** 2);
    if (ts > 1e-6 && hitterSpeed >= ts - 1e-6) {
      // Sideways closing speed: the closing part of rel across the target's own direction.
      const fx = targetVel[0] / ts, fy = targetVel[1] / ts, fz = targetVel[2] / ts;
      const along = rel[0] * fx + rel[1] * fy + rel[2] * fz;
      const sx = rel[0] - fx * along, sy = rel[1] - fy * along, sz = rel[2] - fz * along;
      const side = -(sx * n[0] + sy * n[1] + sz * n[2]);
      if (side >= C.TAKEDOWN_REL) return 'takedown';
    }
  }
  if (rs < 1e-9) return 'scrape';
  const alpha = (Math.asin(Math.min(1, Math.max(0, into / rs))) * 180) / Math.PI;
  return alpha < C.SCRAPE_DEG ? 'scrape' : 'headon';
}

// ---------------------------------------------------------------- candidates and the near-miss tracker

/** createCands(cap = 128): the ship's per-step list of tracked colliders, filled by ship.js. */
export function createCands(cap = 128) {
  return {
    n: 0, cap, ids: new Int32Array(cap), gap: new Float32Array(cap), rel: new Float32Array(cap),
    side: new Int8Array(cap),
  };
}

/**
 * createNearTracker(cap = 64) → the near-miss table (game.near): one row per collider within PROX.TRACK, holding the
 * smallest gap of this pass, the relative speed there, the side it passed on, the last gap and a cooldown. The tracker
 * keeps its own clock t (advanced by h). lastL and lastR remember the last close pass on each side, for threads.
 */
export function createNearTracker(cap = 64) {
  return {
    ids: new Int32Array(cap).fill(-1), gap: new Float32Array(cap), rel: new Float32Array(cap),
    coolUntil: new Float32Array(cap), n: 0,
    cur: new Float32Array(cap), side: new Int8Array(cap), seen: new Uint8Array(cap), away: new Uint8Array(cap),
    t: 0, lastL: -99, lastR: -99, lastLId: -1, lastRId: -1,
    fresh: { near: 0, hairline: 0, thread: 0 },
  };
}

const NEAR_EV = { id: 0, gap: 0, side: 0, rel: 0 };

/**
 * trackNear(tracker, ship, cands, h, ev, tune?) → events pushed. A pass is over when the gap starts to grow again. A
 * pass under PROX.NEAR at PROX.NEAR_REL u/s or more is a NEAR (under HAIRLINE a hairline), one per collider per pass
 * with a PROX.COOL cooldown. Two passes within THREAD u on opposite sides inside THREAD_T s make a thread. Counts for
 * this step go in tracker.fresh; ship.js pays the bar and the chain from them.
 */
export function trackNear(tr, ship, cands, h, ev, tune = TUNE) {
  const P = tune.PROX;
  tr.t += h;
  const fresh = tr.fresh;
  fresh.near = 0; fresh.hairline = 0; fresh.thread = 0;
  const cap = tr.ids.length;
  tr.seen.fill(0);
  let pushed = 0;
  for (let c = 0; c < cands.n; c++) {
    const id = cands.ids[c], gap = cands.gap[c];
    let k = -1;
    for (let j = 0; j < cap; j++) if (tr.ids[j] === id) { k = j; break; }
    if (k < 0) {
      if (gap > P.TRACK) continue;
      for (let j = 0; j < cap; j++) if (tr.ids[j] === -1) { k = j; break; }
      if (k < 0) continue;                              // full: ignore this one
      tr.ids[k] = id; tr.gap[k] = gap; tr.cur[k] = gap; tr.rel[k] = cands.rel[c]; tr.side[k] = cands.side[c];
      tr.coolUntil[k] = 0; tr.away[k] = 0;
      tr.n++;
      tr.seen[k] = 1;
      continue;
    }
    tr.seen[k] = 1;
    if (gap < tr.cur[k] - 1e-4) {                       // closing in
      if (tr.away[k]) { tr.away[k] = 0; tr.gap[k] = gap; tr.rel[k] = cands.rel[c]; tr.side[k] = cands.side[c]; }
      else if (gap < tr.gap[k]) { tr.gap[k] = gap; tr.rel[k] = cands.rel[c]; tr.side[k] = cands.side[c]; }
    } else if (gap > tr.cur[k] + 1e-4 && !tr.away[k]) { // the gap grows again: the pass is over
      if (tr.gap[k] < P.THREAD) pushed += passOver(tr, k, ev, P);
      tr.away[k] = 1;
    }
    tr.cur[k] = gap;
  }
  // Rows that left the tracked range: settle a pass we did not see end, free the row once it has cooled.
  for (let k = 0; k < cap; k++) {
    if (tr.ids[k] === -1 || tr.seen[k]) continue;
    if (!tr.away[k] && tr.gap[k] < P.THREAD) { pushed += passOver(tr, k, ev, P); tr.away[k] = 1; }
    if (tr.t >= tr.coolUntil[k]) { tr.ids[k] = -1; tr.n--; }
  }
  return pushed;
}

function passOver(tr, k, ev, P) {
  let pushed = 0;
  const gap = tr.gap[k], side = tr.side[k], id = tr.ids[k];
  if (gap < P.NEAR && tr.rel[k] >= P.NEAR_REL && tr.t >= tr.coolUntil[k]) {
    tr.coolUntil[k] = tr.t + P.COOL;
    const hair = gap < P.HAIRLINE;
    NEAR_EV.id = id; NEAR_EV.gap = gap; NEAR_EV.side = side; NEAR_EV.rel = tr.rel[k];
    if (ev) ev.push(hair ? 'hairline' : 'near', NEAR_EV);
    if (hair) tr.fresh.hairline++; else tr.fresh.near++;
    pushed++;
  }
  // Threads: a close pass on each side, from two colliders, inside THREAD_T.
  if (gap < P.THREAD && side !== 0) {
    if (side > 0) { tr.lastR = tr.t; tr.lastRId = id; } else { tr.lastL = tr.t; tr.lastLId = id; }
    const other = side > 0 ? tr.lastL : tr.lastR, otherId = side > 0 ? tr.lastLId : tr.lastRId;
    if (otherId !== id && otherId !== -1 && tr.t - other <= P.THREAD_T) {
      if (ev) ev.push('thread', { a: id, b: otherId });
      tr.fresh.thread++;
      tr.lastL = -99; tr.lastR = -99; tr.lastLId = -1; tr.lastRId = -1;
      pushed++;
    }
  }
  return pushed;
}
