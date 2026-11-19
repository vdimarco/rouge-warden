// Gloam Downs: the walk map, the lamplighter's controller, the follow camera and the pose. No DOM and no imports, so Node tests use
// it as it is (qa/lab/gloam-downs.test.mjs) and the bake checks reachability with the same rules the page plays by.

export const PARAMS = {
  walk: 3.0, run: 6.4, accel: 36, airAccel: 14, jumpV: 8.2, gravity: 24, fallMul: 1.6, coyote: 0.12, buffer: 0.15,
  stepUp: 0.5, stepDown: 0.6, slope: 1.1, radius: 0.3, turnRate: 12, touch: 1.0
};
// highest a jump lifts the feet: v² / 2g
export const JUMP = (PARAMS.jumpV * PARAMS.jumpV) / (2 * PARAMS.gravity);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------------- the walk map ----------------
   Two layers of heights in centimetres on a grid: T, the top surface, and G, the floor under a gap (G = T where there is no gap).
   support(x, z, y) is the highest floor at or below y; null means y is inside something solid (a wall). */
export function makeWalk(info, cells) {
  const { x0, z0, step, nx, nz } = info, N = nx * nz;
  if (!(cells instanceof Int16Array) || cells.length < 2 * N) throw new Error('walk map is the wrong size');
  const T = cells.subarray(0, N), G = cells.subarray(N, 2 * N);
  const at = (L, i, j) => L[clamp(j, 0, nz - 1) * nx + clamp(i, 0, nx - 1)] * 0.01;
  const sample = (L, x, z) => {
    const fx = (x - x0) / step, fz = (z - z0) / step, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = at(L, i, j), b = at(L, i + 1, j), c = at(L, i, j + 1), d = at(L, i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const top = (x, z) => sample(T, x, z);
  const floor = (x, z) => sample(G, x, z);
  const support = (x, z, y) => {
    const t = top(x, z);
    if (t <= y + 1e-4) return t;
    const g = floor(x, z);
    if (g < t - 0.05 && g <= y + 1e-4) return g;
    return null;
  };
  return { info, top, floor, support, x0, z0, step, nx, nz, T, G, x1: x0 + (nx - 1) * step, z1: z0 + (nz - 1) * step };
}

/* ---------------- the lamplighter ----------------
   Input: { mx, mz } in -1..1 relative to the camera (mz forward), slow (walk instead of run), jump (held). Yaw 0 faces +z. */
export function makeBody(walk, start, bounds, P = PARAMS) {
  const s = {
    x: start.p[0], z: start.p[2], y: walk.support(start.p[0], start.p[2], start.p[1] + 1) ?? start.p[1],
    vx: 0, vy: 0, vz: 0, yaw: start.yaw || 0, ground: true, coy: 0, buf: 0, held: false,
    phase: 0, moveK: 0, runK: 0, landK: 0, landAge: 9, airTime: 0, floor: 0, events: []
  };
  s.floor = s.y;
  const lim = bounds - 0.6;
  // can the body stand at (x, z) coming from height y, moving d? -> floor height, or null for a wall
  const reach = (x, z, y, d) => walk.support(x, z, y + P.stepUp + P.slope * d);
  function move(dx, dz) {
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return true;
    const ux = dx / d, uz = dz / d;
    const nx = clamp(s.x + dx, -lim, lim), nz = clamp(s.z + dz, -lim, lim);
    const f = reach(nx, nz, s.y, d), fp = reach(nx + ux * P.radius, nz + uz * P.radius, s.y, d + P.radius);
    if (f === null || fp === null) return false;
    if (f < s.y - P.stepDown) { s.x = nx; s.z = nz; s.ground = false; s.coy = P.coyote; s.events.push('fall'); return true; }
    s.x = nx; s.z = nz; s.y = f;
    return true;
  }
  function step(dt, inp, camYaw) {
    s.events.length = 0;
    let mx = clamp(inp.mx || 0, -1, 1), mz = clamp(inp.mz || 0, -1, 1);
    const m = Math.hypot(mx, mz);
    if (m > 1) { mx /= m; mz /= m; }
    const mag = Math.min(1, m);
    // the renderer's eye sits at target + dist·(sin yaw, ·, cos yaw): into the screen is -(sin, cos), right is (cos, -sin)
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const wx = rx * mx + fx * mz, wz = rz * mx + fz * mz;
    const top = inp.slow ? P.walk : mag > 0.7 ? P.run : P.walk + (P.run - P.walk) * Math.max(0, (mag - 0.4) / 0.3);
    const speed = top * Math.min(1, mag * 1.4);
    const wl = Math.hypot(wx, wz) || 1, tx = (wx / wl) * speed * (mag > 0.05 ? 1 : 0), tz = (wz / wl) * speed * (mag > 0.05 ? 1 : 0);
    const acc = (s.ground ? P.accel : P.airAccel) * dt, dvx = tx - s.vx, dvz = tz - s.vz, dl = Math.hypot(dvx, dvz);
    if (dl > 0) { const k = Math.min(1, acc / dl); s.vx += dvx * k; s.vz += dvz * k; }
    if (mag > 0.05) {
      let dd = Math.atan2(wx, wz) - s.yaw;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      s.yaw += dd * Math.min(1, P.turnRate * dt);
    }
    // jump: a buffered press, coyote time, and a lower jump when let go early
    if (inp.jump && !s.held) s.buf = P.buffer; else s.buf = Math.max(0, s.buf - dt);
    s.held = !!inp.jump;
    s.coy = s.ground ? P.coyote : Math.max(0, s.coy - dt);
    if (s.buf > 0 && s.coy > 0) { s.vy = P.jumpV; s.ground = false; s.buf = s.coy = 0; s.events.push('jump'); }
    const dx = s.vx * dt, dz = s.vz * dt, x0 = s.x, z0 = s.z;
    if (s.ground) {
      if (!move(dx, dz)) {
        // slide along the wall, one axis at a time
        const okx = Math.abs(dx) > 1e-6 && move(dx, 0);
        const okz = Math.abs(dz) > 1e-6 && move(0, dz);
        if (!okx) s.vx *= 0.2;
        if (!okz) s.vz *= 0.2;
      }
      if (s.ground) { s.vy = 0; s.airTime = 0; }
    } else {
      const g = s.vy < 0 || !s.held ? P.gravity * P.fallMul : P.gravity;
      s.vy -= g * dt;
      s.airTime += dt;
      const y1 = s.y + s.vy * dt;
      // a wall in the air: the floor ahead is above the body
      const blocked = (x, z) => {
        const f = walk.support(x, z, Math.max(s.y, y1) + 0.05);
        return f === null;
      };
      let x1 = clamp(s.x + dx, -lim, lim), z1 = clamp(s.z + dz, -lim, lim);
      if (blocked(x1, z1) || blocked(x1 + Math.sign(dx) * P.radius * 0.7, z1 + Math.sign(dz) * P.radius * 0.7)) {
        if (!blocked(x1, s.z)) { z1 = s.z; s.vz = 0; }
        else if (!blocked(s.x, z1)) { x1 = s.x; s.vx = 0; }
        else { x1 = s.x; z1 = s.z; s.vx = s.vz = 0; }
      }
      const f = walk.support(x1, z1, Math.max(s.y, y1) + 0.05);
      s.x = x1; s.z = z1;
      if (f !== null && s.vy <= 0 && y1 <= f) {
        s.landK = Math.min(1, -s.vy / 14); s.landAge = 0; s.y = f; s.vy = 0; s.ground = true; s.events.push('land');
      } else s.y = y1;
    }
    const moved = Math.hypot(s.x - x0, s.z - z0);
    if (s.ground) s.phase += (moved / 0.62) * Math.PI;
    const sp = Math.hypot(s.vx, s.vz);
    s.moveK += ((s.ground ? Math.min(1, sp / P.walk) : 0) - s.moveK) * Math.min(1, dt * 12);
    s.runK += ((s.ground ? clamp((sp - P.walk) / (P.run - P.walk), 0, 1) : 0) - s.runK) * Math.min(1, dt * 8);
    s.landAge += dt;
    s.floor = walk.support(s.x, s.z, s.y + 0.05) ?? s.y;
    return s;
  }
  function place(p, yaw) {
    s.x = p[0]; s.z = p[2]; s.y = walk.support(p[0], p[2], p[1] + 1) ?? p[1];
    s.vx = s.vy = s.vz = 0; s.yaw = yaw ?? s.yaw; s.ground = true; s.floor = s.y;
  }
  return { s, step, place, P };
}

/* ---------------- the follow camera ----------------
   Behind and above, eased. It swings behind the lamplighter when it runs and nobody is turning the view, and it comes in close when
   the hills or a wall stand between the eye and the lamplighter. */
export function makeCamera(walk, o = {}) {
  const c = { yaw: o.yaw ?? 0, pitch: o.pitch ?? 0.34, dist: o.dist ?? 8.5, want: o.dist ?? 8.5, target: null, idle: 9, auto: o.auto !== false };
  function follow(s, dt, inp = {}) {
    const ox = inp.ox || 0, oy = inp.oy || 0;
    if (Math.abs(ox) > 0.01 || Math.abs(oy) > 0.01) c.idle = 0; else c.idle += dt;
    c.yaw += ox * (inp.rate ?? 2.6) * dt;
    c.pitch = clamp(c.pitch + oy * 1.6 * dt, 0.08, 1.05);
    if (inp.dyaw) { c.yaw += inp.dyaw; c.idle = 0; }
    if (inp.dpitch) { c.pitch = clamp(c.pitch + inp.dpitch, 0.08, 1.05); c.idle = 0; }
    // swing in behind a running lamplighter
    const sp = Math.hypot(s.vx, s.vz);
    if (c.auto && c.idle > 0.8 && sp > 1) {
      let d = s.yaw + Math.PI - c.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.6) c.yaw += d * Math.min(1, dt * 0.9 * Math.min(1, sp / 5));
    }
    const want = [s.x, s.y + 1.15, s.z];
    if (!c.target) c.target = want.slice();
    const k = 1 - Math.exp(-9 * dt), ky = 1 - Math.exp(-5 * dt);
    c.target[0] += (want[0] - c.target[0]) * k;
    c.target[2] += (want[2] - c.target[2]) * k;
    c.target[1] += (want[1] - c.target[1]) * ky;
    // come in front of whatever blocks the view
    const cp = Math.cos(c.pitch), dir = [Math.sin(c.yaw) * cp, Math.sin(c.pitch), Math.cos(c.yaw) * cp];
    let free = c.want;
    for (let t = 0.6; t <= c.want; t += 0.25) {
      const px = c.target[0] + dir[0] * t, py = c.target[1] + dir[1] * t, pz = c.target[2] + dir[2] * t;
      if (py < walk.top(px, pz) + 0.35) { free = Math.max(1.6, t - 0.4); break; }
    }
    c.dist += (free - c.dist) * Math.min(1, (free < c.dist ? 14 : 2.5) * dt);
    return { target: c.target.slice(), dist: c.dist, yaw: c.yaw, pitch: c.pitch };
  }
  function snap(s, yaw) {
    c.yaw = yaw; c.target = [s.x, s.y + 1.15, s.z]; c.dist = c.want; c.idle = 9;
  }
  return { c, follow, snap };
}

/* ---------------- the pose ----------------
   Each bone moves its splats by x' = A x + t (A by rows, then t), as Ink Studio's renderer reads them. The figure was sculpted standing
   at feet = pivot of the body minus 0.1, facing +z. */
const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
];
const app = (a, v) => [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2]];
const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const scl = (x, y, z) => [x, 0, 0, 0, y, 0, 0, 0, z];
function put(out, b, A, t) {
  const o = 12 * b;
  for (let i = 0; i < 9; i++) out[o + i] = A[i];
  out[o + 9] = t[0]; out[o + 10] = t[1]; out[o + 11] = t[2];
}
export function pose(out, rig, s, time = 0, still = false) {
  const { names, pivots } = rig;
  const P0 = pivots[0], F = [P0[0], P0[1] - 0.1, P0[2]];
  const sw = Math.sin(s.phase), m = s.moveK, air = !s.ground;
  const land = s.landK * Math.exp(-s.landAge * 9);
  const rising = air && s.vy > 0 ? Math.min(1, s.vy / 8) : 0;
  const sy = 1 - 0.28 * land + 0.1 * rising, sxz = 1 + 0.14 * land - 0.04 * rising;
  const breath = still ? 0 : Math.sin(time * 2.1) * 0.02;
  const lean = 0.2 * s.runK + 0.06 * m + (air ? -0.08 : 0);
  const Ab = mul(rotY(s.yaw), mul(scl(sxz, sy * (1 + breath), sxz), mul(rotX(lean), rotZ(0.05 * sw * m))));
  const bob = Math.abs(sw) * 0.07 * m;
  const P = [s.x, s.y + bob, s.z];
  const parts = {
    body: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    head: mul(rotX(0.07 * Math.sin(s.phase * 2) * m - 0.06 * s.runK + breath * 2), rotY(0.05 * sw * m)),
    legL: rotX(air ? 0.45 : -0.75 * sw * m),
    legR: rotX(air ? -0.25 : 0.75 * sw * m),
    armL: rotX(air ? -0.5 : 0.22 * sw * m + 0.05 * Math.sin(time * 1.7)),
    armR: mul(rotX(air ? -0.9 : -0.65 * sw * m), rotZ(air ? 0.5 : 0.08))
  };
  names.forEach((name, b) => {
    const pv = pivots[b];
    if (name === 'shadow') {
      const hgt = Math.max(0, s.y - s.floor), k = 1 / (1 + 0.45 * hgt);
      const A = scl(k, 1, k);
      const to = [s.x, s.floor + 0.04, s.z], ap = app(A, pv);
      put(out, b, A, [to[0] - ap[0], to[1] - ap[1], to[2] - ap[2]]);
      return;
    }
    const A = name === 'body' ? Ab : mul(Ab, parts[name] || parts.body);
    // where the bone's pivot lands: P + Ab (pivot - feet); then t = that - A pivot
    const rel = [pv[0] - F[0], pv[1] - F[1], pv[2] - F[2]], w = app(Ab, rel), ap = app(A, pv);
    put(out, b, A, [P[0] + w[0] - ap[0], P[1] + w[1] - ap[1], P[2] + w[2] - ap[2]]);
  });
  return out;
}

/* ---------------- touch ---------------- */
export const touches = (s, p, r = PARAMS.touch) => Math.hypot(p[0] - s.x, p[2] - s.z) < r && p[1] - s.y > -0.7 && p[1] - s.y < 2.1;
export const atBeacon = (s, b) => Math.hypot(b.p[0] - s.x, b.p[2] - s.z) < b.r && Math.abs(b.p[1] - s.y) < 2.6;

/* ---------------- what can be reached ----------------
   A search over the walk grid with the controller's own rules: step up to stepUp (+ slope), jump up to a ledge a little under JUMP,
   drop any height. Returns reached(x, z, y) -> boolean, and the number of cells reached. */
export function reachable(walk, start, bounds, P = PARAMS) {
  const { nx, nz, x0, z0, step } = walk, lim = bounds - 0.6;
  const seen = new Map(), queue = [];
  const key = (i, j, y) => `${i},${j},${Math.round(y * 10)}`;
  const visit = (i, j, y) => {
    const k = key(i, j, y);
    if (seen.has(k)) return;
    seen.set(k, y);
    queue.push([i, j, y]);
  };
  const ci = x => Math.round((x - x0) / step), cj = z => Math.round((z - z0) / step);
  const y0 = walk.support(start.p[0], start.p[2], start.p[1] + 1) ?? start.p[1];
  visit(ci(start.p[0]), cj(start.p[2]), y0);
  const jumpUp = JUMP - 0.2;
  for (let q = 0; q < queue.length; q++) {
    const [i, j, y] = queue[q];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i2 = i + di, j2 = j + dj, x = x0 + i2 * step, z = z0 + j2 * step;
      if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= nz || Math.abs(x) > lim || Math.abs(z) > lim) continue;
      let f = walk.support(x, z, y + P.stepUp + P.slope * step);
      if (f === null) f = walk.support(x, z, y + jumpUp);
      if (f === null) continue;
      visit(i2, j2, f);
    }
  }
  const byCell = new Map();
  for (const [k, y] of seen) {
    const c = k.slice(0, k.lastIndexOf(','));
    (byCell.get(c) || byCell.set(c, []).get(c)).push(y);
  }
  return {
    cells: byCell.size,
    // can the feet stand near (x, z) at a height from which p (a wisp or the beacon) is in touch?
    near(p, r = PARAMS.touch * 0.8, lo = -0.7, hi = 2.1) {
      const n = Math.ceil(r / step);
      for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
        const i = ci(p[0]) + di, j = cj(p[2]) + dj, x = x0 + i * step, z = z0 + j * step;
        if (Math.hypot(x - p[0], z - p[2]) > r) continue;
        for (const y of byCell.get(`${i},${j}`) || []) if (p[1] - y > lo && p[1] - y < hi) return true;
      }
      return false;
    }
  };
}
