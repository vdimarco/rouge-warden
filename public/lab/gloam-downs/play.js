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
   Layers of heights in centimetres on a grid, one after the other: T, the top surface; G, the floor under a gap (G = T where there is
   no gap); and, in a map baked with it, U, the gap's underside (0 where there is no gap). info.layers names them (['T', 'G', 'U']); a
   map without U takes the gap's underside as G + info.clear (the bake's clear, 1.8, the lowest a gap can be). floorAt(x, z, y, feet) is
   the floor met there by feet at `feet` that reach up to y (feet = y in the air); above y means a wall. support(x, z, y) is that floor
   for feet at y, or null for a wall. */
export function makeWalk(info, cells) {
  const { x0, z0, step, nx, nz } = info, N = nx * nz, clear = info.clear ?? 1.8;
  const layers = info.layers ? info.layers.length : cells?.length >= 3 * N ? 3 : 2;
  if (!(cells instanceof Int16Array) || layers < 2 || cells.length < layers * N) throw new Error('walk map is the wrong size');
  const T = cells.subarray(0, N), G = cells.subarray(N, 2 * N), U = layers > 2 ? cells.subarray(2 * N, 3 * N) : null;
  const at = (L, i, j) => L[clamp(j, 0, nz - 1) * nx + clamp(i, 0, nx - 1)] * 0.01;
  const sample = (L, x, z) => {
    const fx = (x - x0) / step, fz = (z - z0) / step, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = at(L, i, j), b = at(L, i + 1, j), c = at(L, i, j + 1), d = at(L, i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const top = (x, z) => sample(T, x, z);
  const floor = (x, z) => sample(G, x, z);
  const gap = k => G[k] < T[k] - 5;
  const under = k => (U ? U[k] * 0.01 : G[k] * 0.01 + clear);
  /* are feet at `feet` in the gap of a cell, below its roof? oa..od mark the corners that ask: a gap under a top out of reach. The gap's
     underside under the point is blended (with the corners' own weights) from those, and from the gap corners whose top is in reach and
     whose underside is above the floor of every corner that asks: the same roof, sloping down under the feet. A corner whose underside is
     below that floor belongs to the floor, as a grate or a boardwalk over a pit does, so it does not count. The feet are in the gap when
     they are lower than the blend. So all the gap corners of a cell agree: a landing never blends a roof corner with a floor corner, and a
     thin roof over a sloped floor is roof all across */
  const inGap = (ka, kb, kc, kd, oa, ob, oc, od, u, v, feet) => {
    const uu = clamp(u, 0, 1), vv = clamp(v, 0, 1), NO = -40000;
    const ground = Math.max(oa ? G[ka] : NO, ob ? G[kb] : NO, oc ? G[kc] : NO, od ? G[kd] : NO) * 0.01; // the highest floor that asks
    let s = 0, w = 0, m = 0, n = 0;
    const add = (k, asks, wk) => {
      if (!gap(k)) return;
      const h = under(k);
      if (asks || h > ground) { s += wk * h; w += wk; m += h; n++; }
    };
    add(ka, oa, (1 - uu) * (1 - vv)); add(kb, ob, uu * (1 - vv)); add(kc, oc, (1 - uu) * vv); add(kd, od, uu * vv);
    return n > 0 && feet < (w > 1e-9 ? s / w : m / n);
  };
  /* each corner gives its top if that is at or below y. Else, at a corner with a gap, it gives the floor under the gap when the feet are
     in the gap, even if that floor is above them (then it is a step or a wall at the floor's own height); else its top, above them.
     The feet decide, not the reach: so from a ledge in an archway the floor under the arch is a drop, on a floor that slopes up under a
     roof the higher side is floor, a jump under a high roof does not meet the roof, and from a roof, a crown or an arch's top a higher
     part of it is a slope or a wall, never a hole down to the floor under it. The layer is chosen at the corners and then blended, so an
     arch's edge is flat floor from below and a clean edge from above */
  const grad = [0, 0]; // the slope of the floor at the last floorAt, per unit across
  const floorAt = (x, z, y, feet = y) => {
    const fx = (x - x0) / step, fz = (z - z0) / step, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const i0 = clamp(i, 0, nx - 1), i1 = clamp(i + 1, 0, nx - 1), j0 = clamp(j, 0, nz - 1) * nx, j1 = clamp(j + 1, 0, nz - 1) * nx;
    const ka = j0 + i0, kb = j0 + i1, kc = j1 + i0, kd = j1 + i1, reach = y + 1e-4;
    let a = T[ka] * 0.01, b = T[kb] * 0.01, c = T[kc] * 0.01, d = T[kd] * 0.01;
    const oa = a > reach && gap(ka), ob = b > reach && gap(kb), oc = c > reach && gap(kc), od = d > reach && gap(kd);
    if ((oa || ob || oc || od) && inGap(ka, kb, kc, kd, oa, ob, oc, od, u, v, feet)) {
      if (oa) a = G[ka] * 0.01;
      if (ob) b = G[kb] * 0.01;
      if (oc) c = G[kc] * 0.01;
      if (od) d = G[kd] * 0.01;
    }
    const e = a - b - c + d;
    grad[0] = (b - a + e * v) / step;
    grad[1] = (c - a + e * u) / step;
    return a + (b - a) * u + (c - a) * v + e * u * v;
  };
  const support = (x, z, y) => {
    const f = floorAt(x, z, y);
    return f <= y + 1e-4 ? f : null;
  };
  return { info, top, floor, floorAt, grad, support, clear, x0, z0, step, nx, nz, T, G, U, x1: x0 + (nx - 1) * step, z1: z0 + (nz - 1) * step };
}

/* ---------------- the rules for the feet ----------------
   The controller and the reach search share these. The body is a disc of P.radius standing on the floor under its centre.
   climb: a step of stepUp and the slope across the radius. Nothing inside the disc may be more than climb above the base, the floor
   where the feet last stood on a slope (a floor no steeper than climb per radius). A steeper floor is the face of a wall or a step:
   on it the base stays where the face began, so the feet rise no more than climb up a face, from any heading and in steps of any size,
   and a wall more than climb high stops the disc before its centre reaches the face. In the air nothing inside the disc may rise above
   the feet, except the slope under the centre (no steeper than climb per radius), up to its own plane. */
const climbOf = P => P.stepUp + P.slope * P.radius;
const steepOf = P => climbOf(P) / P.radius;
const RAYS = Array.from({ length: 16 }, (_, k) => [Math.cos((k * Math.PI) / 8), Math.sin((k * Math.PI) / 8)]);
/* the height a floor at (px, pz) may reach inside the disc: `top`; or, in the air over a slope, also the plane along that slope a
   little over its floor (lean = [height at the anchor, slope on x, slope on z, anchor x, anchor z]) */
const limit = (top, lean, px, pz) => (lean ? Math.max(top, lean[0] + lean[1] * (px - lean[3]) + lean[2] * (pz - lean[4])) : top);
// how near the centre of a disc of radius R at (x, z) a floor above the limit comes, for feet at `feet`: 0 at the centre; the distance
// of a grid point inside the disc (the map's highest points are at grid points or on the disc's edge); or where one of 16 rays, sampled
// at a third, two thirds and all of R, first crosses it. Infinity where nothing does. With `any`, the first one found.
function nearest(walk, x, z, top, feet, R, any = false, lean = null) {
  const e0 = walk.floorAt(x, z, top, feet) - limit(top, lean, x, z);
  if (e0 > 1e-4) return 0;
  let near = Infinity;
  const { x0, z0, step } = walk, i0 = Math.ceil((x - R - x0) / step), i1 = Math.floor((x + R - x0) / step);
  const j0 = Math.ceil((z - R - z0) / step), j1 = Math.floor((z + R - z0) / step);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = x0 + i * step, pz = z0 + j * step, d = Math.hypot(px - x, pz - z);
    if (d <= R && d < near && walk.floorAt(px, pz, top, feet) > limit(top, lean, px, pz) + 1e-4) { if (any) return d; near = d; }
  }
  for (const [cx, cz] of RAYS) {
    let ep = e0, rp = 0;
    for (let k = 1; k <= 3; k++) {
      const r = (R * k) / 3, e = walk.floorAt(x + cx * r, z + cz * r, top, feet) - limit(top, lean, x + cx * r, z + cz * r);
      if (e > 1e-4) {
        const d = rp + ((r - rp) * Math.max(0, -ep)) / (e - ep);
        if (any) return d;
        near = Math.min(near, d);
        break;
      }
      ep = e; rp = r;
    }
  }
  return near;
}

/* ---------------- the lamplighter ----------------
   Input: { mx, mz } in -1..1 relative to the camera (mz forward), slow (walk instead of run), jump (held). Yaw 0 faces +z. */
export function makeBody(walk, start, bounds, P = PARAMS) {
  const s = {
    x: start.p[0], z: start.p[2], y: walk.support(start.p[0], start.p[2], start.p[1] + 1) ?? start.p[1],
    vx: 0, vy: 0, vz: 0, yaw: start.yaw || 0, ground: true, coy: 0, buf: 0, held: false,
    phase: 0, moveK: 0, runK: 0, landK: 0, landAge: 9, airTime: 0, floor: 0, base: 0, events: []
  };
  s.floor = s.base = s.y;
  const lim = bounds - 0.6, climb = climbOf(P), steep = steepOf(P);
  // can the disc stand at (x, z) with nothing in it above `top` (or the slope's plane, lean), for feet at `feet`? Where the disc already
  // reaches over something higher (it landed by a wall, or walked down a slope beside a ledge), it may move along that or away from it,
  // but not nearer: so it never sticks to a wall and never works its way into one
  function fits(x, z, top, feet, lean = null) {
    const d = nearest(walk, x, z, top, feet, P.radius, false, lean);
    return d === Infinity || (d > 0 && d >= nearest(walk, s.x, s.z, top, feet, P.radius, false, lean) - 1e-6);
  }
  // on the ground the disc reaches a climb above the base, and the feet are where they stand
  const walkTop = () => s.base + climb, walkFeet = () => s.y;
  const walkFit = (x, z) => fits(x, z, walkTop(), s.y);
  function walkTo(x, z) {
    const f = walk.floorAt(x, z, walkTop(), s.y), k = Math.hypot(walk.grad[0], walk.grad[1]);
    s.x = x; s.z = z;
    // off an edge: a drop of more than stepDown, or that far down a steep face from its top
    if (f < s.y - P.stepDown || (k > steep && f < s.base - P.stepDown)) { s.ground = false; s.coy = P.coyote; s.events.push('fall'); return; }
    s.y = f;
    if (k <= steep) s.base = f;
  }
  // in the air, anything above the feet (top) is a wall, but for the slope under the centre (lean), and the feet are read at that height
  const flyTo = (x, z) => { s.x = x; s.z = z; };
  // the face of the wall in front: the mean direction to the floors above `wall` (or the slope's plane, lean) on two rings (at 1.2 and 2
  // radii), so a wall that is a staircase on the grid reads as one face. Taken over the half ahead of the move, then twice more over the
  // half ahead of that mean, so the face of a wall the move runs along is not tilted towards the move. -> its normal (into the wall), or
  // null
  const hit = new Uint8Array(16);
  function face(mx, mz, wall, feet, lean) {
    RAYS.forEach(([cx, cz], k) => {
      hit[k] = 0;
      for (const r of [1.2, 2]) {
        const px = s.x + cx * r * P.radius, pz = s.z + cz * r * P.radius;
        if (walk.floorAt(px, pz, wall, feet) > limit(wall, lean, px, pz) + 1e-4) hit[k]++;
      }
    });
    let ux = mx, uz = mz;
    for (let pass = 0; pass < 3; pass++) {
      let nx = 0, nz = 0;
      RAYS.forEach(([cx, cz], k) => { if (hit[k] && cx * ux + cz * uz > 1e-9) { nx += cx * hit[k]; nz += cz * hit[k]; } });
      const l = Math.hypot(nx, nz);
      if (l < 1e-9) return pass ? [ux, uz] : null;
      ux = nx / l; uz = nz / l;
    }
    return [ux, uz];
  }
  // the frame's move in steps of at most 0.1. Where a wall stops it, it slides along the wall's face: the share of the move along the
  // face, tilted away from the wall as far as it takes to be free. Head on (within about 5° of the face's normal) it stops. Where no
  // face reads (a thin post, a steep face), the move turned towards the side that is free. -> [blocked, face normal, slide]
  const TILTS = [0, 10, 20, 30, 45, 60].map(a => a * Math.PI / 180);
  const TURNS = [10, 20, 30, 40, 50, 60, 70, 80].map(a => a * Math.PI / 180);
  function move(dx, dz, fit, go, wall, feet, lean = null) {
    const d = Math.hypot(dx, dz), n = Math.ceil(d / 0.1), ground = s.ground;
    let blocked = false, along = null, nrm = null;
    for (let i = 0; i < n; i++) {
      if (ground && !s.ground) break; // walked off an edge: the air takes the rest
      const sx = dx / n, sz = dz / n, x = clamp(s.x + sx, -lim, lim), z = clamp(s.z + sz, -lim, lim);
      if (fit(x, z)) { go(x, z); continue; }
      blocked = true;
      along = null;
      const free = t => fit(clamp(s.x + t[0], -lim, lim), clamp(s.z + t[1], -lim, lim));
      nrm = face(sx, sz, wall(), feet(), lean);
      if (nrm) {
        const into = sx * nrm[0] + sz * nrm[1], tx = sx - into * nrm[0], tz = sz - into * nrm[1], tl = Math.hypot(tx, tz);
        if (tl < 0.09 * Math.hypot(sx, sz)) break; // head on
        for (const a of TILTS) {
          const c = Math.cos(a), sn = Math.sin(a), t = [(tx * c - nrm[0] * tl * sn) * c, (tz * c - nrm[1] * tl * sn) * c];
          if (free(t)) { along = t; break; }
        }
      } else {
        for (const a of TURNS) {
          const c = Math.cos(a), sn = Math.sin(a), l = [(sx * c - sz * sn) * c, (sx * sn + sz * c) * c], r = [(sx * c + sz * sn) * c, (sz * c - sx * sn) * c];
          const fl = free(l), fr = free(r);
          if (fl !== fr) { along = fl ? l : r; break; }
          if (fl) break; // free both ways: nothing to choose, so it stops
        }
      }
      if (!along) break;
      go(clamp(s.x + along[0], -lim, lim), clamp(s.z + along[1], -lim, lim));
    }
    return [blocked, nrm, along];
  }
  // after a slide the speed into the wall's face is lost (only that, so the slide is as fast at any frame rate); stopped dead, most of
  // the speed is
  function slid([blocked, nrm, along]) {
    if (!blocked) return;
    if (along && nrm) {
      const v = s.vx * nrm[0] + s.vz * nrm[1];
      if (v > 0) { s.vx -= v * nrm[0]; s.vz -= v * nrm[1]; }
    } else if (along) {
      const l = Math.hypot(along[0], along[1]) || 1, ux = along[0] / l, uz = along[1] / l, v = Math.max(0, s.vx * ux + s.vz * uz);
      s.vx = ux * v; s.vz = uz * v;
    } else { s.vx *= 0.2; s.vz *= 0.2; }
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
      slid(move(dx, dz, walkFit, walkTo, walkTop, walkFeet));
      if (s.ground) { s.vy = 0; s.airTime = 0; }
    } else {
      const g = s.vy < 0 || !s.held ? P.gravity * P.fallMul : P.gravity;
      // the exact fall over the step, so a jump lifts the feet JUMP at any frame rate
      const y1 = s.y + s.vy * dt - 0.5 * g * dt * dt;
      s.vy -= g * dt;
      s.airTime += dt;
      const top = Math.max(s.y, y1) + 0.05, at = () => top;
      /* over a slope (the floor under the centre in reach and no steeper than a climb per radius), the disc may also overlap that slope:
         nothing in it may rise over the plane along the slope, 0.05 over its floor. So the uphill side of the disc does not stop a jump
         up a slope at the take-off or just before the landing, and the centre goes on up the slope over the frame. Anything that rises
         off the slope's plane, as a wall or a ledge does, is still a wall above the feet */
      const f0 = walk.floorAt(s.x, s.z, top), gx = walk.grad[0], gz = walk.grad[1];
      const lean = f0 <= top + 1e-4 && Math.hypot(gx, gz) <= steep ? [f0 + 0.05, gx, gz, s.x, s.z] : null;
      slid(move(dx, dz, (x, z) => fits(x, z, top, top, lean), flyTo, at, at, lean));
      /* it lands on the floor under its centre when the feet are at or below it and it is in reach (on the slope's plane it may be a
         little over the feet). That holds on the way up too: on a run up a slope that rises nearly as fast as the jump, the slope meets
         the feet before the top of the jump, and it lands there and runs on. On a sloped roof or crown the higher side reads as roof, and
         on a floor that slopes up under a roof the higher side reads as floor, so neither landing is missed. The squash of the landing
         follows the speed down, none on the way up */
      const f = walk.floorAt(s.x, s.z, top);
      if (y1 <= f && f <= limit(top, lean, s.x, s.z) + 1e-4) {
        s.landK = clamp(-s.vy / 14, 0, 1); s.landAge = 0; s.y = s.base = f; s.vy = 0; s.ground = true; s.events.push('land');
      } else s.y = y1;
    }
    const moved = Math.hypot(s.x - x0, s.z - z0);
    if (s.ground) s.phase += (moved / 0.62) * Math.PI;
    const sp = Math.hypot(s.vx, s.vz);
    s.moveK += ((s.ground ? Math.min(1, sp / P.walk) : 0) - s.moveK) * Math.min(1, dt * 12);
    s.runK += ((s.ground ? clamp((sp - P.walk) / (P.run - P.walk), 0, 1) : 0) - s.runK) * Math.min(1, dt * 8);
    s.landAge += dt;
    // the floor for the shadow: under the feet on the ground, else the floor they would land on
    s.floor = s.ground ? s.y : walk.support(s.x, s.z, s.y + 0.05) ?? s.y;
    return s;
  }
  function place(p, yaw) {
    s.x = p[0]; s.z = p[2]; s.y = walk.support(p[0], p[2], p[1] + 1) ?? p[1];
    s.vx = s.vy = s.vz = 0; s.yaw = yaw ?? s.yaw; s.ground = true; s.floor = s.base = s.y;
  }
  return { s, step, place, P };
}

/* ---------------- the follow camera ----------------
   Behind and above, eased. It swings behind the lamplighter when it runs and nobody is turning the view, and it comes in close when
   the hills or a wall stand between the eye and the lamplighter. The eye never goes past the first thing in the way; when that is
   too close to frame the figure, the view tilts up (lift) until the eye clears it. */
export function makeCamera(walk, o = {}) {
  const c = { yaw: o.yaw ?? 0, pitch: o.pitch ?? 0.34, dist: o.dist ?? 8.5, want: o.dist ?? 8.5, target: null, idle: 9, auto: o.auto !== false, lift: 0 };
  const NEAR = 0.5, FRAME = 2.0, TOP = 1.45;
  // is a point clear of the scenery by 0.35: above the top, or inside the gap under an arch (at least 1.8 high)?
  const open = (x, y, z) => {
    const t = walk.top(x, z);
    if (y >= t + 0.35) return true;
    const g = walk.floor(x, z);
    return g < t - 0.05 && y >= g + 0.35 && y <= g + 1.45;
  };
  // the farthest the eye can go back at a pitch: two samples short of the first that is in the way
  const free = pitch => {
    const cp = Math.cos(pitch), ux = Math.sin(c.yaw) * cp, uy = Math.sin(pitch), uz = Math.cos(c.yaw) * cp, [x, y, z] = c.target;
    for (let t = 0.3; t <= c.want; t += 0.1) if (!open(x + ux * t, y + uy * t, z + uz * t)) return Math.max(0, t - 0.25);
    return c.want;
  };
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
    // tilt up only as far as it takes to frame the figure from in front of whatever blocks the view
    const need = Math.min(c.want, FRAME);
    let lift = 0, best = -1;
    for (let l = 0; c.pitch + l <= TOP + 1e-6; l += 0.12) {
      const f = free(c.pitch + l);
      if (f > best + 0.05) { best = f; lift = l; }
      if (f >= need) { lift = l; break; }
    }
    c.lift += (lift - c.lift) * Math.min(1, (lift > c.lift ? 10 : 2) * dt);
    // so close the eye would be in the figure: tilt at once
    if (lift > c.lift && free(Math.min(TOP, c.pitch + c.lift)) < 1) c.lift = lift;
    // tilted, it stays as close as the untilted view would let it (but far enough to frame the figure)
    const pitch = Math.min(TOP, c.pitch + c.lift), room = Math.max(NEAR, Math.min(free(pitch), c.lift > 1e-3 ? Math.max(need, free(c.pitch)) : c.want));
    // come in at once (the eye is never in a wall), go back eased
    c.dist = room < c.dist ? room : c.dist + (room - c.dist) * Math.min(1, 2.5 * dt);
    return { target: c.target.slice(), dist: c.dist, yaw: c.yaw, pitch };
  }
  function snap(s, yaw) {
    c.yaw = yaw; c.target = [s.x, s.y + 1.15, s.z]; c.dist = c.want; c.idle = 9; c.lift = 0;
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
   A search over the walk grid with the controller's own rules: the disc, the base and climb, any drop, and a jump that rises up to
   JUMP - 0.1 and lands up to 1.0 away along a row or a column. It is never more open than the controller: it tests the controller's
   own disc at each grid point and half way to it; it moves the base only where every cell round a point is a slope; a disc that
   reaches over something too high goes no further; and a jump lands only where the disc can stand on a slope, with nothing on the way
   higher than both ends. Returns near(p, ...) -> boolean, and the number of cells reached. */
export function reachable(walk, start, bounds, P = PARAMS) {
  const { nx, nz, x0, z0, step } = walk, lim = bounds - 0.6, climb = climbOf(P), steep = steepOf(P);
  const open = (x, z, top, feet) => nearest(walk, x, z, top, feet, P.radius, true) === Infinity;
  // a slope (not a face) in all four cells round a grid point
  const e = step * 1e-3;
  const slope = (x, z, top, feet) => [[e, e], [-e, e], [e, -e], [-e, -e]].every(([a, b]) => {
    walk.floorAt(x + a, z + b, top, feet);
    return Math.hypot(walk.grad[0], walk.grad[1]) <= steep;
  });
  // reached heights by cell and height, each with the highest base it was reached with (a higher base reaches more)
  const seen = new Map(), queue = [];
  const visit = (i, j, y, base) => {
    const k = `${i},${j},${Math.round(y * 10)}`, had = seen.get(k);
    if (had && had.base >= base - 1e-6) return;
    seen.set(k, { y: had ? had.y : y, base });
    queue.push([i, j, y, base, k]);
  };
  const ci = x => Math.round((x - x0) / step), cj = z => Math.round((z - z0) / step);
  const y0 = walk.support(start.p[0], start.p[2], start.p[1] + 1) ?? start.p[1];
  visit(ci(start.p[0]), cj(start.p[2]), y0, y0);
  /* a jump rises up to 0.1 short of its top (lift, JUMP for PARAMS) and lands up to 1.0 away along a row or a column of the grid. On
     the way the feet are read at the top of the jump, the highest the controller reads them: a gap whose floor is that far below
     them is a roof there */
  const lift = (P.jumpV * P.jumpV) / (2 * P.gravity), jumpUp = lift - 0.1, far = P.jumpV > 0 ? Math.max(1, Math.floor(1.0 / step + 1e-6)) : 0;
  for (let q = 0; q < queue.length; q++) {
    const [i, j, y, base, k] = queue[q];
    if (seen.get(k).base > base + 1e-6) continue; // reached again since with a higher base
    const ox = x0 + i * step, oz = z0 + j * step;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const inside = d => {
        const i2 = i + di * d, j2 = j + dj * d;
        return i2 >= 0 && j2 >= 0 && i2 < nx && j2 < nz && Math.abs(x0 + i2 * step) <= lim && Math.abs(z0 + j2 * step) <= lim;
      };
      if (!inside(1)) continue;
      const x = ox + di * step, z = oz + dj * step, mx = ox + di * step / 2, mz = oz + dj * step / 2;
      // a walk: the disc clear within climb of the base, half way and there, for the feet where they stand; on a slope the base comes
      // to the feet
      let top = base + climb;
      if (open(mx, mz, top, y) && open(x, z, top, y)) {
        const f = walk.floorAt(x, z, top, y);
        visit(i + di, j + dj, f, slope(x, z, top, y) ? f : Math.min(base, f));
        if (f > y - 0.1) continue; // level or up: a jump this way starts from there instead
      }
      /* a jump: the disc clear at the top of the jump at every grid point and half way along the line. It lands at a grid point where
         the disc can stand and every cell round it is a slope (so a landing near it is a landing on it, not on the tip of a stake or
         the edge of a ledge). No floor on the way stands higher than both ends, so nothing between stops it or is landed on first */
      top = y + jumpUp;
      const fly = y + lift + 0.05;
      let high = -Infinity;
      for (let d = 1; d <= far && inside(d); d++) {
        const hx = ox + di * (d - 0.5) * step, hz = oz + dj * (d - 0.5) * step, px = ox + di * d * step, pz = oz + dj * d * step;
        if (!open(hx, hz, top, fly) || !open(px, pz, top, fly)) break;
        high = Math.max(high, walk.floorAt(hx, hz, top, fly));
        // and where it lands, the walk from there: the same floor, the disc clear within a climb, every cell round it a slope
        const f = walk.floorAt(px, pz, top, fly), ft = f + climb;
        if (high <= Math.max(y, f) + 1e-4 && Math.abs(walk.floorAt(px, pz, ft, f) - f) < 1e-3 && open(px, pz, ft, f) && slope(px, pz, ft, f)) visit(i + di * d, j + dj * d, f, f);
        high = Math.max(high, f);
      }
    }
  }
  const byCell = new Map();
  for (const [k, { y }] of seen) {
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
