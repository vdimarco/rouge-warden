// Gloam Downs: the walk map, the lamplighter's controller, the follow camera and the pose. No DOM and no imports, so Node tests use
// it as it is (qa/lab/gloam-downs.test.mjs) and the bake checks reachability with the same rules the page plays by.

export const PARAMS = {
  walk: 3.0, run: 6.4, accel: 36, airAccel: 14, jumpV: 8.2, gravity: 24, fallMul: 1.6, coyote: 0.12, buffer: 0.15,
  stepUp: 0.5, stepDown: 0.6, slope: 1.1, radius: 0.3, turnRate: 12, touch: 1.0, slopeLift: 0.4
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
  // a corner with a gap: the bake writes G = T where there is none, and G under T where there is one
  const gap = k => G[k] < T[k];
  const under = k => (U ? U[k] * 0.01 : G[k] * 0.01 + clear);
  const UNDER = k => (gap(k) ? under(k) : NaN);
  /* are feet at `feet` under the roof of corner q? The underside under the point is blended, with the corners' own weights (wq), over the
     gap corners of the cell (undersides hq, NaN where there is no gap) that are the same roof as q. A corner r is the same roof as a
     corner that asks (aq: its top is out of reach) when r's underside is within SAME of that corner's (a walkable slope, 2.77 per unit,
     rises about SAME across a cell's diagonal), and so is r's top when r does not ask, for a roof that slopes down under the feet goes on
     in its top too. The roof grows from q through the asking corners in it, so all the asking corners of a dome or a vault whose
     undersides step more than SAME across the cell are one roof, and they decide together. A gap corner further off belongs to another
     solid: a grate or a boardwalk over a pit beside a vault, the body of a hut over its crawl space beside the porch under its eave, a
     lean-to whose top the feet stand on, against a hall. It has no say */
  const SAME = 1.0, tq = [0, 0, 0, 0], hq = [0, 0, 0, 0], wq = [0, 0, 0, 0], aq = [false, false, false, false], inq = [false, false, false, false];
  const roofed = (q, feet) => {
    inq[0] = inq[1] = inq[2] = inq[3] = false;
    inq[q] = true;
    for (let grew = true; grew;) {
      grew = false;
      for (let a = 0; a < 4; a++) if (inq[a] && aq[a]) for (let r = 0; r < 4; r++) {
        if (inq[r] || !(Math.abs(hq[r] - hq[a]) <= SAME && (aq[r] || Math.abs(tq[r] - tq[a]) <= SAME))) continue;
        inq[r] = grew = true;
      }
    }
    let s = 0, w = 0, m = 0, n = 0;
    for (let r = 0; r < 4; r++) if (inq[r]) { s += wq[r] * hq[r]; w += wq[r]; m += hq[r]; n++; }
    return feet < (w > 1e-9 ? s / w : m / n);
  };
  /* each corner gives its top if that is at or below y. Else, at a corner with a gap, it gives the floor under the gap when the feet are
     under its roof, even if that floor is above them (then it is a step or a wall at the floor's own height); else its top, above them.
     The feet decide, not the reach: so from a ledge in an archway the floor under the arch is a drop, on a floor that slopes up under a
     roof the higher side is floor, a jump under a high roof does not meet the roof, and from a roof, a crown or an arch's top a higher
     part of it is a slope or a wall, never a hole down to the floor under it. The corners of one roof agree, so a landing never blends a
     roof corner with a floor corner of the same roof, and a thin roof over a sloped floor is roof all across. The layer is chosen at the
     corners and then blended, so an arch's edge is flat floor from below and a clean edge from above */
  const grad = [0, 0]; // the slope of the floor at the last floorAt, per unit across
  const floorAt = (x, z, y, feet = y) => {
    const fx = (x - x0) / step, fz = (z - z0) / step, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const i0 = clamp(i, 0, nx - 1), i1 = clamp(i + 1, 0, nx - 1), j0 = clamp(j, 0, nz - 1) * nx, j1 = clamp(j + 1, 0, nz - 1) * nx;
    const ka = j0 + i0, kb = j0 + i1, kc = j1 + i0, kd = j1 + i1, reach = y + 1e-4;
    let a = T[ka] * 0.01, b = T[kb] * 0.01, c = T[kc] * 0.01, d = T[kd] * 0.01;
    const oa = a > reach && gap(ka), ob = b > reach && gap(kb), oc = c > reach && gap(kc), od = d > reach && gap(kd);
    if (oa || ob || oc || od) {
      const uu = clamp(u, 0, 1), vv = clamp(v, 0, 1);
      tq[0] = a; tq[1] = b; tq[2] = c; tq[3] = d;
      hq[0] = UNDER(ka); hq[1] = UNDER(kb); hq[2] = UNDER(kc); hq[3] = UNDER(kd);
      wq[0] = (1 - uu) * (1 - vv); wq[1] = uu * (1 - vv); wq[2] = (1 - uu) * vv; wq[3] = uu * vv;
      aq[0] = oa; aq[1] = ob; aq[2] = oc; aq[3] = od;
      if (oa && roofed(0, feet)) a = G[ka] * 0.01;
      if (ob && roofed(1, feet)) b = G[kb] * 0.01;
      if (oc && roofed(2, feet)) c = G[kc] * 0.01;
      if (od && roofed(3, feet)) d = G[kd] * 0.01;
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
   the feet, except the slope under the centre (no steeper than climb per radius), up to its own plane; the feet do not rise up through
   a roof over the centre; and a jump up a steep slope is held back so that the feet still rise slopeLift over it. */
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
  /* a floor is read from the tops or floors of the four grid points round it, never above the highest top of them: where no top of the
     grid points under the disc is over `top` (or the limit, which is never under it), nothing is */
  const { x0, z0, step, nx, nz, T } = walk;
  const ia = Math.max(0, Math.floor((x - R - x0) / step)), ib = Math.min(nx - 1, Math.floor((x + R - x0) / step) + 1);
  const ja = Math.max(0, Math.floor((z - R - z0) / step)), jb = Math.min(nz - 1, Math.floor((z + R - z0) / step) + 1);
  let hi = -Infinity;
  for (let j = ja; j <= jb; j++) for (let i = ia, k = j * nx + ia; i <= ib; i++, k++) if (T[k] > hi) hi = T[k];
  if (hi * 0.01 <= top) return Infinity;
  const e0 = walk.floorAt(x, z, top, feet) - limit(top, lean, x, z);
  if (e0 > 1e-4) return 0;
  let near = Infinity;
  const i0 = Math.ceil((x - R - x0) / step), i1 = Math.floor((x + R - x0) / step);
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
   Input: { mx, mz } in -1..1 relative to the camera (mz forward), slow (walk instead of run), jump (held). Yaw 0 faces +z. Each step
   leaves in s.events what happened in it: 'jump', 'fall' (off an edge), 'land', 'bump' (the feet met a roof from under it). */
export function makeBody(walk, start, bounds, P = PARAMS) {
  const s = {
    x: start.p[0], z: start.p[2], y: walk.support(start.p[0], start.p[2], start.p[1] + 1) ?? start.p[1],
    vx: 0, vy: 0, vz: 0, yaw: start.yaw || 0, ground: true, coy: 0, buf: 0, held: false,
    phase: 0, moveK: 0, runK: 0, landK: 0, landAge: 9, airTime: 0, floor: 0, base: 0, events: []
  };
  s.floor = s.base = s.y;
  const lim = bounds - 0.6, climb = climbOf(P), steep = steepOf(P);
  // the fastest the slope under a rising jump may climb: then the jump lifts the feet slopeLift over it (v² = 2 g slopeLift at its top)
  const rise = Math.max(0, P.jumpV - Math.sqrt(2 * P.gravity * P.slopeLift));
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
  /* do feet rising from lo to hi pass up through a roof's underside over the centre? With the reach held at lo, the corners under the
     centre give the floor under their gap for feet at lo, and their roof, above lo, for feet at hi. The step tests it before the
     landing, with lo and hi 0.05 over the feet, so the step that brings the feet within 0.05 of the underside stops, however thin the
     roof and however far the feet rise in one step */
  const throughRoof = (lo, hi) => walk.floorAt(s.x, s.z, lo) <= lo + 1e-4 && walk.floorAt(s.x, s.z, lo, hi) > lo + 1e-4;
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
    const x0 = s.x, z0 = s.z;
    if (s.ground) {
      slid(move(s.vx * dt, s.vz * dt, walkFit, walkTo, walkTop, walkFeet));
      if (s.ground) { s.vy = 0; s.airTime = 0; }
    } else {
      const vy0 = s.vy, g = vy0 < 0 || !s.held ? P.gravity * P.fallMul : P.gravity;
      // the exact fall over the step, so a jump lifts the feet JUMP at any frame rate
      const y1 = s.y + vy0 * dt - 0.5 * g * dt * dt;
      s.vy -= g * dt;
      s.airTime += dt;
      const top = Math.max(s.y, y1) + 0.05, at = () => top;
      /* over a slope (the floor under the centre in reach and no steeper than a climb per radius), the disc may also overlap that slope:
         nothing in it may rise over the plane along the slope, 0.05 over its floor. So the uphill side of the disc does not stop a jump
         up a slope at the take-off or just before the landing, and the centre goes on up the slope over the frame. Anything that rises
         off the slope's plane, as a wall or a ledge does, is still a wall above the feet */
      const f0 = walk.floorAt(s.x, s.z, top), gx = walk.grad[0], gz = walk.grad[1];
      const lean = f0 <= top + 1e-4 && Math.hypot(gx, gz) <= steep ? [f0 + 0.05, gx, gz, s.x, s.z] : null;
      /* a jump up a slope that rises nearly as fast as the jump: while the feet rise faster than rise and are less than slopeLift over
         the slope, the move up the slope is held back so that the slope rises under them no faster than rise. Then the feet still get
         slopeLift over the slope (a held jump), on any slope and at any frame rate, and after that the run picks up again in the air.
         A gentler slope, a walk, or a move across or down the slope is not held back */
      if (lean && vy0 > rise && s.y - f0 < P.slopeLift) {
        const k2 = gx * gx + gz * gz, up = s.vx * gx + s.vz * gz;
        if (up > rise) { const e = (up - rise) / k2; s.vx -= e * gx; s.vz -= e * gz; }
      }
      slid(move(s.vx * dt, s.vz * dt, (x, z) => fits(x, z, top, top, lean), flyTo, at, at, lean));
      /* the feet would rise up through the underside of a roof over the centre (a jump from under the edge of a higher roof, just walked
         off a lower one). They stop under it and fall, as they would against a wall, and never stand on the roof's edge between the two
         heights. This is tested before the landing, so a roof whose top the feet would reach in this step is not landed on either */
      const f = walk.floorAt(s.x, s.z, top);
      if (y1 > s.y && throughRoof(s.y + 0.05, top)) { s.vy = 0; s.events.push('bump'); }
      /* else it lands on the floor under its centre when the feet are at or below it and it is in reach (on the slope's plane it may be a
         little over the feet). That holds on the way up too: on a run up a slope that rises nearly as fast as the jump, the slope meets
         the feet before the top of the jump, and it lands there and runs on. On a sloped roof or crown the higher side reads as roof, and
         on a floor that slopes up under a roof the higher side reads as floor, so neither landing is missed. The squash of the landing
         follows the speed down, none on the way up */
      else if (y1 <= f && f <= limit(top, lean, s.x, s.z) + 1e-4) {
        s.landK = clamp(-s.vy / 14, 0, 1); s.landAge = 0; s.y = s.base = f; s.vy = 0; s.ground = true; s.events.push('land');
      } else s.y = y1;
    }
    const moved = Math.hypot(s.x - x0, s.z - z0);
    if (s.ground) s.phase += (moved / 0.62) * Math.PI;
    // a run's moves drive the body with run = walk = the move's speed (moves.js), so neither share may divide by zero
    const sp = Math.hypot(s.vx, s.vz), span = P.run - P.walk;
    s.moveK += ((s.ground && P.walk > 0 ? Math.min(1, sp / P.walk) : 0) - s.moveK) * Math.min(1, dt * 12);
    s.runK += ((s.ground && span > 0 ? clamp((sp - P.walk) / span, 0, 1) : 0) - s.runK) * Math.min(1, dt * 8);
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
   The framing of a window (camLayout): in landscape the vertical field of view stays 48°, so a wider window sees more to the sides; in a
   window narrower than that, the horizontal field of view stays at least 2·atan(0.30) (Godot's KEEP_WIDTH for portrait), so a phone held
   upright still sees 4 m to each side. The camera stands far enough back that the view is at least 9.2 m wide at the lamplighter, and
   never nearer than 8.5 m. The pitch puts the horizon 12.8% from the top in landscape and 24% (below the HUD) in a tall window, and the
   aim point (the screen's middle, over the feet) rises from 0.75 to 1.8, so the lamplighter sits a little low in a tall window and the
   4 m round it stays above the touch buttons. */
export const VIEW = { fov: 48 * Math.PI / 180, dist: 8.5, tanH: 0.30, half: 4.6, horizon: [0.128, 0.24], aim: [0.75, 1.8], tall: 0.25 };
export function camLayout(w, h) {
  const asp = w / h, tanH = Math.max(Math.tan(VIEW.fov / 2) * asp, VIEW.tanH), tanV = tanH / asp;
  const t = clamp((1 - asp) / VIEW.tall, 0, 1), yh = VIEW.horizon[0] + (VIEW.horizon[1] - VIEW.horizon[0]) * t;
  return { fov: 2 * Math.atan(tanV), dist: Math.max(VIEW.dist, VIEW.half / tanH), pitch: Math.atan((1 - 2 * yh) * tanV), aim: VIEW.aim[0] + (VIEW.aim[1] - VIEW.aim[0]) * t, asp };
}
/* The follow zoom: where the scenery brings the eye nearer than CLOSE (a cell, a lane under a roof), the field of view widens so that
   the view is as tall at the aim as it would be from CLOSE, as Cinemachine's Follow Zoom keeps a target's size on screen by its field
   of view; up to `most` vertically and `wide` across. So the lamplighter, its blade and the floor round it stay in the picture, and the
   pull-in no longer reads as a zoom. -> the field of view for an eye `d` from the aim, in a window of aspect `asp` */
export const ZOOM = { close: 3.5, most: 90 * Math.PI / 180, wide: 110 * Math.PI / 180 };
export function zoomFov(fov, d, asp = 16 / 9) {
  const t0 = Math.tan(fov / 2), cap = Math.max(t0, Math.min(Math.tan(ZOOM.most / 2), Math.tan(ZOOM.wide / 2) / asp));
  return 2 * Math.atan(Math.min(cap, t0 * Math.max(1, ZOOM.close / Math.max(d, 1e-3))));
}
/* The view turns by itself (the swing behind a running lamplighter, the turn out of a lane, a run's combat and boss cameras) gently:
   after AUTO.wait s with no look input, never while the mouse is taken (the player steers with it), and never while the move held
   points more than AUTO.across from straight ahead or back (a run across the view stays straight across). The swing eases at
   AUTO.swing per second */
export const AUTO = { wait: 2.0, swing: 0.5, across: 35 * Math.PI / 180 };
export const across = (mx, mz) => Math.hypot(mx, mz) >= 0.2 && Math.abs(mx) > Math.tan(AUTO.across) * Math.abs(mz);
// may the view turn by itself this step? c: a follow camera's state, after follow() has read the step's input
export const autoTurn = (c, wait = AUTO.wait) => c.auto && !c.steer && !c.across && c.idle > wait;
// x eased toward `to` with velocity v over about T s, a critically damped spring (Game Programming Gems 4, 1.10, as in Unity's
// SmoothDamp) -> [x, v]
export function damp(x, to, v, T, dt) {
  if (dt <= 0) return [x, v];
  const w = 2 / T, k = w * dt, e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k), ch = x - to, tmp = (v + w * ch) * dt;
  return [to + (ch + tmp) * e, (v - w * tmp) * e];
}
/* Behind and above, eased. It swings behind the lamplighter when it runs and nobody is turning the view, as autoTurn allows (a run's
   cameras may take that over: follow's `turn`). When the hills or a wall stand between the eye and the figure (its head and chest), it
   rises over them (lift) before it comes any closer, as Cinemachine's Deoccluder does with Preserve Camera Height, and only what no
   rise clears brings it in. The rise is never faster than 4 rad/s; it starts for where the figure will be 0.25 s ahead, so it is under
   way before a wall comes between, and it settles back slowly. Something that comes between while the eye itself is clear may hide the
   figure for 0.15 s before the camera comes in (the Deoccluder's minimum occlusion time), and it comes in and goes back out eased, and
   never fast: at most 15 m/s past something between, 33 m/s to keep the eye out of a wall and 12 m/s back out. A turn of the view into
   a wall brings it in ahead of the wall, and where that is not enough, the wall holds the turn back for a step or two (a camera that
   orbits against a wall) rather than the eye jumping in. A
   thin thing in the way (a post, a lantern, a stake: open 0.55 m to both sides of the line and no longer than 0.6 m along it) is looked
   past, but the eye itself is never inside anything. Foes are not in the walk map, so they never move it. */
/* The cutaway (makeCamera, below; cut.js leaves out the splats between). On where the best rise leaves the eye nearer than `in`, or as
   soon as the follow eye is heading nearer than `in` (its goal this step, which takes in the room at this yaw and the wall a turn will
   bring in the next 0.45 s) while it is within `near`, in a
   nook (a roof over the head, or walls nearer than `in` at `walls` of 8 yaws round) with the lamplighter at `run` m/s or less, or
   anywhere at `still` m/s or less (standing by a wall); off once the room and the eye under it stand `out` back for `hold` s, and once eased
   all the way out not on again for `again` s. The view stands `dist` back, and never comes nearer than it was as the cutaway starts: it goes out to
   `dist` at no more than `grow` m/s. Its pitch is `margin` over the least that clears the roof (from the pitch the cutaway started at),
   plus what the mouse has turned it since, up to `top`, and down only as far as the eye stays clear (the mouse's own pitch stops there
   too, so no pitch is held out of sight); in over `ease` s, out over `back` s */
export const TIGHT = { still: 1, walls: 5, in: 2.5, out: 2.9, near: 4, hold: 0.3, again: 0.4, dist: 3.2, grow: 5, top: 1.15, margin: 0.06, run: 3, ease: 0.15, back: 0.25 };
export function makeCamera(walk, o = {}) {
  const pitch0 = o.pitch ?? 0.34, dist0 = o.dist ?? 8.5;
  const c = {
    yaw: o.yaw ?? 0, pitch: pitch0, base: pitch0, dist: dist0, want: dist0, fov: o.fov ?? null, asp: o.asp ?? 16 / 9, aim: o.aim ?? 1.15, target: null, idle: 9,
    auto: o.auto !== false, lift: 0, goal: { lift: 0, dist: dist0 }, goals: [], turning: false, from: null, hidden: 0, dv: 0, steer: false, across: false, squeeze: false, off: 0, framing: false,
    cut: false, cutK: 0, cutP: pitch0, cutV: 0, cutT: 0, cutD: dist0, cutB: pitch0, cutRef: pitch0, cutOff: 9, vd: dist0, vdv: 0, shown: false
  };
  const NEAR = 0.5, TOP = 1.35, DIP = 0.1, LIFT = 0.08, THIN = 0.55, SHORT = 0.6, AHEAD = 0.25, RISE = 4, GRACE = 0.15, HEAD = 1.3, CHEST = 0.8, IN = 0.15, OUT = 0.25;
  // the most speed coming in, m/s: past something between (PULL) and to keep the eye out of a wall (SQUEEZE);
  // the most going back out (BACK); and how fast each builds
  const PULL = 15, SQUEEZE = 33, BACK = 12, ACC = 360, AHEADS = [0.15, 0.3, 0.45];
  // the least share of a player's turn that a wall may leave on screen (the rest it holds back, a camera orbiting against a wall)
  const HOLD = 0.85;
  /* the cutaway's tail: eased out, the view's distance still coming back to the follow eye's (the splats stay cut while it comes in,
     or while its eye is in the scenery) */
  const TAIL = 0.01, JERK = 0.3;
  /* the underside of the gap over (x, z) in a map baked with undersides (U): the lowest of the four corners round it, or null where
     one of them has no gap (the edge of a roof decides by the old rule); with all false, the lowest of those that have one. A room
     taller than the least gap (1.8) lets the eye stand higher in it */
  const { U, G: GL, T: TL, nx: NX, nz: NZ } = walk;
  const ceil = (x, z, all = true) => {
    if (!U) return null;
    const i = Math.floor((x - walk.x0) / walk.step), j = Math.floor((z - walk.z0) / walk.step);
    let lo = Infinity;
    for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
      const k = clamp(j + b, 0, NZ - 1) * NX + clamp(i + a, 0, NX - 1);
      if (GL[k] < TL[k]) lo = Math.min(lo, U[k] * 0.01);
      else if (all) return null;
    }
    return lo === Infinity ? null : lo;
  };
  // is a point clear of the scenery by `cl`: above the top, or inside the gap under an arch (at least 1.8 high), `cl` under its roof?
  const open = (x, y, z, cl = 0.35) => {
    const t = walk.top(x, z);
    if (y >= t + cl) return true;
    const g = walk.floor(x, z);
    if (!(g < t - 0.05 && y >= g + cl)) return false;
    const u = ceil(x, z);
    return u === null ? y <= g + 1.45 : y <= Math.max(g + 1.45, u - cl);
  };
  /* the aim over feet at (x, y, z): the layout's (c.aim), but under a roof low over the feet (a cell, an archway) it comes down to 1.55
     under the roof, and never under 0.6 over the feet: so the eye can see out under the lintel (a tall window's aim of 1.8 would sit in
     it), and has the room's height over the aim to rise into where the walls are close */
  const aimAt = (x, y, z) => {
    const t = walk.top(x, z);
    if (t <= y + 0.05) return c.aim;
    const u = ceil(x, z, false);
    return u === null || u < y ? c.aim : clamp(u - y - 1.55, Math.min(0.6, c.aim), c.aim);
  };
  /* a thing in the way is thin when it is open THIN to both sides of the line and no longer than SHORT along it: a post or a lantern,
     not a boulder or a ridge. blocked(t, ...) keeps the start of the run of thin samples; -> the distance where the line is blocked, or
     null */
  const run = { from: null };
  const blocked = (t, px, py, pz, cl, sx, sz) => {
    if (open(px, py, pz, cl)) { run.from = null; return null; }
    if (t > 1 && open(px + sx, py, pz + sz, cl) && open(px - sx, py, pz - sz, cl)) {
      run.from ??= t;
      return t - run.from > SHORT ? run.from : null;
    }
    return run.from ?? t;
  };
  /* how far the eye can go back from (x, y, z) at this yaw and pitch, up to `far`: two samples short of the first thing in the way that
     is not thin, and then in until the eye itself is clear by 0.35. The line of sight may pass closer to the ground near the aim (a
     lamplighter in the water below a bank), so its clearance grows from 0.1 at the aim to 0.35 at 1.25 m */
  const reach = (x, y, z, yaw, pitch, far, thin = true) => {
    const cp = Math.cos(pitch), ux = Math.sin(yaw) * cp, uy = Math.sin(pitch), uz = Math.cos(yaw) * cp, sx = Math.cos(yaw) * THIN, sz = -Math.sin(yaw) * THIN;
    let d = far;
    run.from = null;
    for (let t = 0.3; t <= far; t += 0.1) {
      const b = blocked(t, x + ux * t, y + uy * t, z + uz * t, Math.min(0.35, 0.1 + 0.2 * t), thin ? sx : 0, thin ? sz : 0);
      if (b === null) continue;
      d = Math.max(0, b - 0.25);
      break;
    }
    while (d > 0.3 && !open(x + ux * d, y + uy * d, z + uz * d)) d -= 0.1;
    return Math.max(0.3, d);
  };
  const eyeOpen = (x, y, z, yaw, pitch, d) => open(x + Math.sin(yaw) * Math.cos(pitch) * d, y + Math.sin(pitch) * d, z + Math.cos(yaw) * Math.cos(pitch) * d);
  /* is the eye at d clear all the way round as the yaw turns by `by` (and the pitch by `bp`)? A sample every 0.25 m of its path, so no
     wall is stepped over */
  const arcOpen = (x, y, z, yaw, by, pitch, d, bp = 0) => {
    const n = Math.ceil(Math.hypot(by * Math.cos(pitch), bp) * d / 0.25);
    for (let k = 0; k <= n; k++) if (!eyeOpen(x, y, z, yaw + (n ? by * k / n : 0), Math.min(TOP, pitch + (n ? bp * k / n : 0)), d)) return false;
    return true;
  };
  /* can an eye at e see the point h on the figure? Thin things do not count; the line may pass close to the ground near the figure, and
     needs 0.3 of clearance from 2.5 m out, for the ground's splats stand above the walk map */
  const sees = (h, e) => {
    const dx = e[0] - h[0], dy = e[1] - h[1], dz = e[2] - h[2], L = Math.hypot(dx, dz) || 1, n = Math.ceil(Math.hypot(dx, dy, dz) / 0.15);
    const sx = (-dz / L) * THIN, sz = (dx / L) * THIN;
    run.from = null;
    for (let i = 1; i < n; i++) {
      const k = i / n, t = i * 0.15;
      if (blocked(t, h[0] + dx * k, h[1] + dy * k, h[2] + dz * k, Math.min(0.3, 0.05 + 0.1 * t), sx, sz) !== null) return false;
    }
    return true;
  };
  /* the least rise that lets the eye stand at its full distance and see the head and the chest (a high aim can clear the brow of a hill
     that hides the figure); failing that, the rise that lets it stand farthest back and still see the head (a lift that looks down
     through a bell's crown onto the figure hidden under it is never chosen while a lower one sees it), and only where none sees the
     head, the one that stands farthest back. Under a roof over the head (a long passage, an archway) the view may also dip under the
     lintel, down to DIP, but a dip is taken only where it stands at the full distance: in a nook it only looks into the back wall */
  function solve(x, y, z, yaw, head) {
    let best = { lift: 0, dist: -1 }, seen = null;
    const chest = [head[0], head[1] - HEAD + CHEST, head[2]];
    const u = walk.top(head[0], head[2]) > head[1] ? ceil(head[0], head[2], false) : null, under = u !== null && u > head[1] - HEAD;
    const lifts = [];
    for (let l = 0; c.pitch + l <= TOP + 1e-6; l += LIFT) lifts.push(l);
    if (under) { for (let l = -LIFT; c.pitch + l > DIP + 1e-6; l -= LIFT) lifts.push(l); if (c.pitch > DIP) lifts.push(DIP - c.pitch); }
    for (const l of lifts) {
      const p = c.pitch + l, d = reach(x, y, z, yaw, p, c.want), cp = Math.cos(p);
      const e = [x + Math.sin(yaw) * cp * c.want, y + Math.sin(p) * c.want, z + Math.cos(yaw) * cp * c.want];
      if (d >= c.want - 0.05 && sees(head, e) && sees(chest, e)) return { lift: l, dist: c.want };
      if (l < 0) continue;
      if (d > best.dist + 0.3) best = { lift: l, dist: d };
      if (!seen || d > seen.dist + 0.3) {
        const k = d / c.want;
        if (sees(head, [x + (e[0] - x) * k, y + (e[1] - y) * k, z + (e[2] - z) * k])) seen = { lift: l, dist: d };
      }
    }
    return seen ?? best;
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // turn: (c, s, dt, looked) -> true when a run's camera took the place of the swing this step
  function follow(s, dt, inp = {}, turn = null) {
    const ox = inp.ox || 0, oy = inp.oy || 0, yaw0 = c.yaw, pitch0 = c.pitch, lift0 = c.lift;
    let looked = Math.abs(ox) > 0.01 || Math.abs(oy) > 0.01;
    c.yaw += ox * (inp.rate ?? 2.6) * dt;
    c.pitch = clamp(c.pitch + oy * 1.6 * dt, 0.08, 1.05);
    if (inp.dyaw) { c.yaw += inp.dyaw; looked = true; }
    if (inp.dpitch) { c.pitch = clamp(c.pitch + inp.dpitch, 0.08, 1.05); looked = true; }
    // the player's own turn of this step
    const mine = wrap(c.yaw - yaw0);
    if (looked) c.idle = 0; else c.idle += dt;
    // the player steers with the mouse (it is taken), or holds a move across the view: then nothing turns the view by itself
    c.steer = !!inp.mouse;
    c.across = across(inp.mx || 0, inp.mz || 0);
    // a run's camera that turns by itself sets c.turning; c.from is the yaw where that turn started (cameras.js holds a move to it)
    const was = c.turning, before = c.yaw;
    c.turning = false;
    // swing in behind a running lamplighter
    const sp = Math.hypot(s.vx, s.vz), ran = !!(turn && turn(c, s, dt, looked));
    if (c.turning && !was) c.from = before;
    if (!ran && autoTurn(c) && sp > 1) {
      const d = wrap(s.yaw + Math.PI - c.yaw);
      if (Math.abs(d) < 2.6) c.yaw += d * Math.min(1, dt * AUTO.swing * Math.min(1, sp / 5));
    }
    const want = [s.x, s.y + aimAt(s.x, s.y, s.z), s.z];
    if (!c.target) c.target = want.slice();
    // the aim follows the height at 10/s on the ground (down a steep slope it would lag far above the figure), and at 5/s in a jump
    const k = 1 - Math.exp(-9 * dt), ky = 1 - Math.exp(-(s.ground ? 10 : 5) * dt);
    c.target[0] += (want[0] - c.target[0]) * k;
    c.target[2] += (want[2] - c.target[2]) * k;
    c.target[1] += (want[1] - c.target[1]) * ky;
    // in a nook, the view leans toward a clear yaw (the framed shot, below); a run's camera that has the yaw (ran) leads
    let leant = lean(s, dt, wrap(c.yaw - yaw0), looked, sp, ran, was);
    // the rise it needs now, and for where the aim and the yaw will be a moment ahead: the larger
    const [tx, ty, tz] = c.target, spin = dt > 0 ? wrap(c.yaw - yaw0) / dt : 0;
    const head = [s.x, s.y + HEAD, s.z], now = solve(tx, ty, tz, c.yaw, head);
    /* the cutaway (below) goes off once the room and the eye under it have stood TIGHT.out back for TIGHT.hold s, so it never flickers
       on and off; it comes on further down, from the follow eye's goal of this step */
    if (!c.cut) c.cutT = 0;
    else if (c.want <= TIGHT.out) c.cut = false;
    else if (now.dist >= TIGHT.out && c.dist >= TIGHT.out - 0.1) { if ((c.cutT += dt) >= TIGHT.hold) c.cut = false; }
    else c.cutT = 0;
    // the time since the cutaway last eased out (its splats come back from then: below, the tail)
    c.cutOff = c.shown ? 0 : c.cutOff + dt;
    /* in a lane or round a corner: when the view must rise more than 0.35 or come in, and the lamplighter runs away from the eye or
       across the view (never toward it, as when backing into a wall), when the view may turn by itself (autoTurn) and no run camera
       turns it, the view turns at up to 1.2 rad/s toward the nearest yaw within 60° that is open with 0.25 less rise */
    if (autoTurn(c) && !c.turning && sp > 1 && Math.abs(wrap(s.yaw + Math.PI - c.yaw)) < 1.75 && (now.lift > 0.35 || now.dist < c.want - 0.05))
      for (const j of [1, -1, 2, -2, 3, -3]) {
        const g = solve(tx, ty, tz, c.yaw + j * 0.35, head);
        if (g.dist >= c.want - 0.05 && g.lift <= now.lift - 0.25) { c.yaw += clamp(j * 0.35, -1.2 * dt, 1.2 * dt); break; }
      }
    // the point ahead stands on the floor there, as the lamplighter will
    const ax = s.x + s.vx * AHEAD, az = s.z + s.vz * AHEAD, af = walk.support(ax, az, s.y + 1.2) ?? s.y;
    const soon = solve(tx + s.vx * AHEAD, Math.max(ty, af + aimAt(ax, af, az)), tz + s.vz * AHEAD, c.yaw + clamp(spin, -3, 3) * AHEAD, [ax, af + HEAD, az]);
    // the rise follows the least of the last three goals up (a goal for one step alone is a flicker) and the goal down
    c.goals.push(Math.max(now.lift, soon.lift));
    if (c.goals.length > 3) c.goals.shift();
    c.goal = { lift: Math.min(...c.goals), dist: now.dist };
    // up quickly but never faster than RISE, down slowly
    const up = c.goal.lift > c.lift, cap = c.lift + RISE * dt;
    c.lift += clamp((c.goal.lift - c.lift) * Math.min(1, (up ? 12 : 2) * dt), -RISE * dt, RISE * dt);
    /* the rise easing down must not lower the eye into the scenery: it holds this step, and the eye starts in (at no more than PULL,
       below) to where the lower view is clear */
    let sink = 0;
    if (c.lift < lift0 && dt > 0) {
      const p1 = Math.min(TOP, c.pitch + c.lift), p0 = Math.min(TOP, c.pitch + lift0);
      if (p1 < p0 && !eyeOpen(tx, ty, tz, c.yaw, p1, c.dist) && eyeOpen(tx, ty, tz, c.yaw, p0, c.dist)) { sink = p1 - p0; c.lift = lift0; }
    }
    let pitch = Math.min(TOP, c.pitch + c.lift), room = reach(tx, ty, tz, c.yaw, pitch, c.want);
    // where the eased rise would bring the eye in, it rises further first, as far as RISE allows this step
    if (room < c.dist - 0.05)
      for (let l = c.lift + 0.01; l <= Math.min(Math.max(c.goal.lift, now.lift), cap) + 1e-6; l += 0.01) {
        const r = reach(tx, ty, tz, c.yaw, Math.min(TOP, c.pitch + l), c.want);
        if (r > room) { c.lift = l; room = r; pitch = Math.min(TOP, c.pitch + l); }
        if (r >= c.dist - 0.05) break;
      }
    room = Math.max(NEAR, room);
    // the true room, before the grace below may keep the eye back: an eased eye nearer than this is clear
    const room0 = room;
    /* something comes between the eye and the aim while the eye itself is still clear: wait up to GRACE before coming in, as the rise
       may clear it by then. The eye is never in a wall (see below) */
    if (room < c.dist - 0.05 && eyeOpen(tx, ty, tz, c.yaw, pitch, c.dist) && (c.hidden += dt) <= GRACE) room = c.dist;
    else if (room >= c.dist - 0.05) c.hidden = 0;
    /* in and back out, both eased with a critically damped spring (Unity's SmoothDamp), so a wall that comes between is never a jump:
       in over about IN s, and back out over about OUT s */
    let to = Math.min(room, Math.max(c.goal.dist, NEAR));
    /* the eye itself: where it is inside the scenery now at its present distance, or will be anywhere on its way round in the next
       0.3 s as the view turns (into a wall), it starts in now, and only then may it come in faster than PULL (SQUEEZE). The whole path
       is marched from where this step began, so a thin wall that the turn crosses is not stepped over */
    const sp3 = clamp(spin, -3, 3), by = sp3 * 0.3;
    const squeeze = !arcOpen(tx, ty, tz, yaw0, by, pitch, c.dist);
    /* the rise easing down (or up) also moves the eye: where that will bring it into the scenery in 0.3 s while the turn alone does
       not, it starts in too, but at no more than PULL */
    const bp = dt > 0 ? clamp((sink || pitch - Math.min(TOP, pitch0 + lift0)) / dt, -2, 2) * 0.3 : 0;
    const round = d => arcOpen(tx, ty, tz, yaw0, by, pitch, d) && (!bp || arcOpen(tx, ty, tz, yaw0, by, pitch, d, bp));
    let ds = Math.min(c.dist, to);
    if (!round(c.dist)) {
      let de = c.dist;
      while (de > NEAR && !round(de)) de -= 0.1;
      ds = Math.min(ds, de);
    }
    /* a nearer goal whose own path round crosses something only lowers the goal, and the eye comes in to it at no more than PULL: the
       eye is clear, so there is time */
    while (ds > NEAR && !round(ds)) ds -= 0.1;
    /* and where the player turns the view so that a wall will come between in 0.15, 0.3 or 0.45 s (AHEADS), it starts in to that
       wall's near side now, at no more than PULL, before the wall comes between: an eye left behind a wall can only come in through
       it with a jump */
    const d0 = Math.min(c.dist, to);
    if (looked && Math.abs(sp3) > 0.1) for (const t of AHEADS) ds = Math.min(ds, Math.max(NEAR, reach(tx, ty, tz, c.yaw + sp3 * t, pitch, d0)));
    if (ds < d0 - 0.05) to = Math.max(NEAR, ds);
    /* the cutaway comes on where the follow eye is heading nearer than TIGHT.in (the best rise cannot clear the room, or the room at this
       yaw, or a wall the turn will bring), before it gets there: so the view never comes in first and pops back out. Where no rise clears
       the room it comes on with the eye within TIGHT.near, or farther where something already stands between (a camera still coming
       in from far comes in with the splats between cut, so the figure stays in sight); for the room at this yaw or a wall ahead, only
       with the eye within TIGHT.near (so a camera still coming in past a wall does not
       cut a long cone through the place for what may clear). Not within TIGHT.again of its splats
       starting back (while they are still cut it may come back on: the picture goes on from where it is), and with the lamplighter standing, or walking in a nook */
    if (!c.cut && c.want > TIGHT.out && ((now.dist < TIGHT.in && (c.dist < TIGHT.near || c.hidden > 0)) || (to < TIGHT.in && c.dist < TIGHT.near)) && (c.shown || c.cutOff >= TIGHT.again || c.dist < TIGHT.in) && (sp <= TIGHT.still || (sp <= TIGHT.run && nook(tx, ty, tz, head)))) {
      c.cut = true;
      // it starts from the view as drawn, and from the pitch it showed
      if (c.cutK <= 0) { c.cutD = c.vd; c.cutB = Math.min(TIGHT.top, pitch); c.cutRef = c.pitch; c.cutP = Math.min(TIGHT.top, pitch); c.cutV = 0; }
      // a lean the player's turn carried this step is taken back as the cutaway starts: the turn on screen is the player's alone
      if (looked && leant) { c.yaw -= leant; c.off -= leant; leant = 0; }
    }
    c.squeeze = squeeze;
    let [d, v] = damp(c.dist, to, c.dv, to < c.dist ? (squeeze ? IN / 2 : IN) : OUT, dt);
    // the spring never goes past its goal coming in
    if (to < c.dist && d < to) { d = to; v = 0; }
    // nor moves away from it: a spring still coming in fast when its goal moves out would carry on in, past NEAR and through the aim
    else if (to >= c.dist && d < c.dist) { d = c.dist; v = 0; }
    /* coming in is never a dive: at most PULL m/s while the eye is clear and only something between hides the figure (a tree trunk),
       and SQUEEZE m/s where the eye must come in to stay out of a wall, each reached at no more than ACC m/s/s */
    if (dt > 0 && d < c.dist) {
      const vin = Math.max((d - c.dist) / dt, -(squeeze ? SQUEEZE : PULL), Math.min(0, c.dv) - ACC * dt);
      d = c.dist + vin * dt; v = vin;
    } else if (dt > 0 && d > c.dist) {
      // and back out at no more than BACK m/s
      const vout = Math.min((d - c.dist) / dt, BACK, Math.max(0, c.dv) + ACC * dt);
      d = c.dist + vout * dt; v = vout;
    }
    /* the eye is never inside the scenery, and never passes through it as the view turns (a fast turn moves the eye by more than a
       thin wall is thick). Where the eased eye would be in it, or would cross it on its way round, the turn of this step goes only
       as far as keeps the eye clear (a camera that orbits against a wall), and the camera comes in on the next steps as above. Only
       where no part of the turn helps (the lamplighter backs into a wall) does the eye come in at once, to the first clear distance */
    const yawT = c.yaw, pitchT = c.pitch, liftT = c.lift, turnBy = wrap(yawT - yaw0);
    // set the turn of this step to the part f of it; -> is the eye at d clear all the way round from where the step began?
    const at = f => {
      c.yaw = yaw0 + turnBy * f; c.pitch = pitch0 + (pitchT - pitch0) * f; c.lift = lift0 + (liftT - lift0) * f;
      const n = Math.max(1, Math.ceil(Math.abs(turnBy * f) * d / 0.1));
      for (let k = 1; k <= n; k++) {
        const g = f * k / n;
        if (!eyeOpen(tx, ty, tz, yaw0 + turnBy * g, Math.min(TOP, pitch0 + (pitchT - pitch0) * g + lift0 + (liftT - lift0) * g), d)) return false;
      }
      return true;
    };
    if (d > room0 && !at(1)) {
      // the end of the turn is clear, but the way there crosses a wall
      const crossed = eyeOpen(tx, ty, tz, c.yaw, pitch, d);
      // the first clear distance in from d at this step's yaw, if one is out of the wall at all
      let dc = d;
      while (dc > room0 + 1e-6 && !eyeOpen(tx, ty, tz, c.yaw, pitch, dc)) dc = Math.max(room0, dc - 0.05);
      const clear = eyeOpen(tx, ty, tz, c.yaw, pitch, dc);
      if (!crossed && clear && dt > 0 && c.dist - dc <= SQUEEZE * dt) { d = dc; v = (d - c.dist) / dt; }
      else if (!c.cut && !c.cutK && clear && at(0)) {
        let lo = 0, hi = 1;
        for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (at(m)) lo = m; else hi = m; }
        /* but a turn the player makes shows on screen: at least HOLD of it. Where the wall would hold it back more, the eye comes in
           until that much of the turn is clear, by no more than 0.9 m this step and to no nearer than the room at this yaw (a fast
           flick, 6 rad/s, may still be held back, rather than the eye jump in) */
        const most = looked && turnBy * mine > 0 ? Math.min(1, HOLD * Math.abs(mine) / Math.abs(turnBy)) : 0;
        if (lo < most) {
          const d1 = d, lim = Math.max(room0, c.dist - 0.9);
          while (d > lim + 1e-6 && !at(most)) d = Math.max(lim, d - 0.05);
          if (at(most)) { lo = most; if (d < d1) v = 0; } else d = d1;
        }
        at(lo);
        // the lean held back with the rest of the step's turn: c.off keeps only the share of it on screen
        c.off -= leant * (1 - lo);
        pitch = Math.min(TOP, c.pitch + c.lift);
      } else {
        at(1);
        if (dc < d) v = 0;
        d = dc;
      }
    }
    c.dist = Math.max(NEAR, d); c.dv = v;
    // the cutaway: the view stands TIGHT.dist back at the player's yaw, raised over the roof where that clears it
    const k0 = c.cutK;
    c.cutK = c.cut ? Math.min(1, c.cutK + dt / TIGHT.ease) : Math.max(0, c.cutK - dt / TIGHT.back);
    // going out, the view's distance comes back to the follow eye's at no more than BACK m/s out (and PULL in), as the follow eye would
    if (!c.cut && k0 > 0) {
      c.cutD = c.dist > c.cutD ? Math.min(c.dist, c.cutD + BACK * dt) : Math.max(c.dist, c.cutD - PULL * dt);
    }
    let vd = c.dist, vp = pitch;
    if (c.cutK > 0) {
      const D = Math.min(c.want, TIGHT.dist), e = c.cutK * c.cutK * (3 - 2 * c.cutK);
      if (c.cut) {
        /* the distance never comes in from where the view was as the cutaway started, and goes out to D at no more than TIGHT.grow
           m/s; a camera still coming in from farther comes in as it did, down to D, and settles there (at most half the way left a
           step). It goes no farther out than D while the cutaway is on (so the cone cut through the place stays short) */
        c.cutD = c.cutD > D ? Math.max(D + (c.cutD - D) / 2, Math.min(c.cutD, c.dist)) : Math.min(D, Math.max(c.dist, c.cutD + TIGHT.grow * dt));
        // the least pitch that clears the roof at this yaw (from the one the cutaway started at), eased
        const L = over(tx, ty, tz, c.yaw, c.cutB, c.cutD);
        [c.cutP, c.cutV] = damp(c.cutP, L, c.cutV, L > c.cutP ? TIGHT.ease : TIGHT.back, dt);
        /* and the mouse's pitch since it started, at once: up to TIGHT.top, and down only as far as the eye stays clear. The mouse's
           own pitch stops at the same place, so the view shows all of it and none is left to swing in as the cutaway ends */
        const F = Math.min(c.cutP, under(tx, ty, tz, c.yaw, L, c.cutD) + (c.cutP - L));
        const lo = clamp(c.cutRef + F - c.cutP, 0.08, 1.05), hi = clamp(c.cutRef + TIGHT.top - c.cutP, 0.08, 1.05);
        c.pitch = clamp(c.pitch, Math.min(lo, hi), Math.max(lo, hi));
        pitch = Math.min(TOP, c.pitch + c.lift);
      }
      const cp = Math.min(TIGHT.top, c.cutP + c.pitch - c.cutRef);
      vd = c.cutD; vp = pitch + (cp - pitch) * e;
    } else if (k0 > 0) vd = c.cutD;
    else { c.cutP = c.cutB = Math.min(TIGHT.top, pitch); c.cutRef = c.pitch; c.cutV = 0; c.cutD = c.dist; }
    /* the view's distance in and round the cutaway moves no faster than the follow eye may with the eye clear, its speed builds as the
       follow eye's does, and it slows by no more than JERK a step (a camera coming in fast settles at D over a few steps, a view
       easing out that comes back in turns round gently) */
    if (c.cutK > 0 || k0 > 0) {
      // its speed builds by no more than ACC m/s/s, and a view already faster than PULL or BACK slows by JERK a step
      const a = ACC * dt * dt, l0 = c.vdv - a, h0 = Math.min(c.vdv + JERK, Math.max(0, c.vdv) + a);
      const lo = Math.min(h0, Math.max(-PULL * dt, l0)), hi = Math.max(lo, Math.min(BACK * dt, h0));
      const vv = clamp(vd - c.vd, lo, hi);
      vd = c.vd + vv; c.cutD = vd;
      // going out, the cutaway is not over until the view's distance is the follow eye's
      if (!c.cut && Math.abs(vd - c.dist) > 1e-3) c.cutK = Math.max(c.cutK, TAIL);
    }
    c.vdv = vd - c.vd; c.vd = vd;
    /* and through the tail while the view's eye comes in to the follow eye's, or whenever it stands in the scenery (going out along
       the follow eye's own clear line it is in the open, and the splats come back from there) */
    c.shown = c.cut || c.cutK > TAIL || (c.cutK > 0 && ((c.shown && vd > c.dist + 1e-3) || !eyeOpen(tx, ty, tz, c.yaw, vp, vd)));
    return { target: c.target.slice(), dist: vd, yaw: c.yaw, pitch: vp, cut: c.shown, ...(c.fov ? { fov: zoomFov(c.fov, vd, c.asp) } : {}) };
  }
  /* ---- the cutaway ----
     A nook under a roof (the Gaol's torn cell: 1.4 m by 2 m, its roof 2.15 over the floor and 0.55 thick, the moor 2.7 m over the
     floor all round) has no rise that clears it: every eye over the roof or behind a wall is inside the walk map, so reach() brings the
     eye in to about 1 m, and the near fade hides the figure. There the view keeps the player's yaw and stands TIGHT.dist back: at the
     least pitch from the one it started at up to TIGHT.top that puts that eye in the open (over the roof, in the next cell), or at
     that pitch where none does, plus the mouse's pitch since, and the place's splats between that eye and the figure are left out
     (cut.js), as a dollhouse view cuts away its walls. It comes on from the follow eye's goal, before the eye comes in, and never
     comes nearer than the view was (the review of 8afff94f: it came on from the best rise only, after the follow eye had come in to
     0.8 m, and then popped out at 25 m/s). The least pitch eases up over TIGHT.ease s and back over TIGHT.back, the mouse's pitch at
     once, and the whole cutaway eases in over TIGHT.ease and out over TIGHT.back, so nothing flickers. The yaw is never touched: the
     player's turn is the whole turn. */
  /* a nook: a roof over the head (a cell, an archway, a fallen bell), or walls nearer than TIGHT.in at TIGHT.walls of 8 yaws round.
     A post or a pillar beside an open yard is neither, and the camera comes in past it as before */
  function nook(x, y, z, head) {
    if (walk.top(head[0], head[2]) > head[1]) return true;
    let n = 0;
    for (let k = 0; k < 8; k++) if (reach(x, y, z, k * Math.PI / 4, Math.min(TOP, c.pitch + c.lift), TIGHT.in) < TIGHT.in - 0.05) n++;
    return n >= TIGHT.walls;
  }
  // the least pitch from p0 (no higher than TIGHT.top) that puts the eye D back in the open, TIGHT.margin over it; p0 where none does
  function over(x, y, z, yaw, p0, D) {
    p0 = Math.min(TIGHT.top, p0);
    for (let p = p0; p <= TIGHT.top + 1e-6; p += 0.03) if (eyeOpen(x, y, z, yaw, p, D)) return Math.min(TIGHT.top, p + TIGHT.margin);
    return p0;
  }
  // how far down from p the eye D back stays in the open (no lower than the mouse's least pitch); p itself where it is not open there
  function under(x, y, z, yaw, p, D) {
    if (!eyeOpen(x, y, z, yaw, p, D)) return p;
    let q = p;
    while (q - 0.03 >= 0.08 && eyeOpen(x, y, z, yaw, q - 0.03, D)) q -= 0.03;
    return q;
  }
  /* ---- the framed shot ----
     In a nook (a cell, a fallen bell, a cleft in the fen) the walls bring the eye in at most yaws. Where the room at the view's yaw falls
     under SHOT.in, and the lamplighter is not running (SHOT.run m/s or less: a lane run through is past in a moment), the view itself
     leans toward the nearest yaw (every 15°) where the eye can stand SHOT.clear back (or at the full distance where that is less) on a
     line from the aim open all the way and see the head and the chest, until the eye stands SHOT.out back: the best clear angle, as
     Cinemachine's Deoccluder does with its Preserve Camera Distance strategy (it turns the camera round the target rather than bring it
     in) and as its ClearShot picks the camera with the best shot. The lean is a turn of c.yaw, so the picture, the way a move goes and
     the fight's bearings stay one yaw. It never takes the view more than SHOT.most from where the player's own turns put it (c.off is
     the lean so far, forgotten once the eye stands at its full distance again). While the player turns the view (the mouse, a stick, a
     drag), the lean of a step is at most SHOT.share of that step's turn, so every turn shows on screen (85 to 115% of it). With the view
     still the lean would be a turn by itself, so it goes only where the calm camera allows one (autoTurn: the mouse free, motion not
     reduced, no move held across the view, AUTO.wait s with no look input) and no run camera has the yaw, at up to SHOT.turn rad/s,
     eased, and it sets c.turning so a held move keeps its world direction. Where the lean may not turn the view, or no clear yaw is
     that near, the view stays where the player put it, and the eye comes in with the near fade, which leaves the whole figure out
     from NEAR_FADE.hold in. A wall that holds back part of a step's turn holds back the same part of its lean (c.off keeps the rest). */
  const SHOT = { in: 2, out: 3, clear: 3, step: 15 * Math.PI / 180, most: 60 * Math.PI / 180, share: 0.15, turn: 0.5, run: 3 };
  // the nearest clear yaw to c.yaw, no more than SHOT.most from the player's own yaw (c.yaw less the lean so far) -> yaw or null
  function clearYaw(x, y, z, head) {
    const chest = [head[0], head[1] - HEAD + CHEST, head[2]], need = Math.min(SHOT.clear, c.want - 0.05);
    for (let k = 0; k * SHOT.step <= 2 * SHOT.most; k++) for (const sg of k ? [1, -1] : [1]) {
      const by = sg * k * SHOT.step;
      if (Math.abs(c.off + by) > SHOT.most + 1e-6) continue;
      const yaw = c.yaw + by;
      for (const l of [0, LIFT * 2, LIFT * 4]) {
        const p = clamp(c.pitch + l, 0.08, TOP), d = reach(x, y, z, yaw, p, c.want, false);
        if (d < need) continue;
        const cp = Math.cos(p), e = [x + Math.sin(yaw) * cp * d, y + Math.sin(p) * d, z + Math.cos(yaw) * cp * d];
        if (sees(head, e) && sees(chest, e)) return yaw;
      }
    }
    return null;
  }
  /* the lean of this step; turned: the turn of the view so far this step, looked: the player turned it, took: a run's camera (combat,
     boss) has the yaw this step, was: the view turned by itself on the step before -> the lean, rad */
  function lean(s, dt, turned, looked, sp, took, was) {
    if (dt <= 0) return 0;
    const [x, y, z] = c.target, room = reach(x, y, z, c.yaw, Math.min(TOP, c.pitch + c.lift), c.want);
    c.framing = sp <= SHOT.run && (c.framing ? c.dist < SHOT.out : room < SHOT.in);
    if (!c.framing) { if (c.dist >= c.want - 0.05) c.off = 0; return 0; }
    // in the cutaway the player's own turn is the whole turn: no lean while the player turns the view
    if (looked && (c.cut || c.cutK > 0)) return 0;
    /* with the view still, the lean is a turn by itself: only as the calm camera allows one (autoTurn: not while the mouse is taken,
       never with reduced motion, nor while a move across the view is held, and only after AUTO.wait with no look input), and never
       while a run's camera has the yaw or turns it */
    if (!looked && (took || c.turning || !autoTurn(c))) return 0;
    const goal = clearYaw(x, y, z, [s.x, s.y + HEAD, s.z]);
    if (goal === null) return 0;
    const lim = looked ? SHOT.share * Math.abs(turned) : SHOT.turn * dt;
    const by = clamp(wrap(goal - c.yaw) * Math.min(1, 8 * dt), -lim, lim);
    // a lean by itself is a camera that turns by itself: a held move keeps its world direction (cameras.js makeMoveLock)
    if (!looked && by) { if (!was && !c.turning) c.from = c.yaw; c.turning = true; }
    c.yaw += by; c.off += by;
    return by;
  }
  function snap(s, yaw) {
    c.off = 0; c.framing = false;
    c.yaw = yaw; c.target = [s.x, s.y + aimAt(s.x, s.y, s.z), s.z]; c.idle = 9;
    c.goal = solve(c.target[0], c.target[1], c.target[2], yaw, [s.x, s.y + HEAD, s.z]);
    c.lift = c.goal.lift; c.goals = [c.lift]; c.hidden = 0; c.dv = 0;
    c.dist = Math.max(NEAR, reach(c.target[0], c.target[1], c.target[2], yaw, Math.min(TOP, c.pitch + c.lift), c.want));
    // the cutaway starts whole where the place puts the lamplighter
    c.cut = c.want > TIGHT.out && c.goal.dist < TIGHT.in; c.cutK = c.cut ? 1 : 0; c.cutV = 0; c.cutT = 0; c.cutOff = 9;
    c.cutB = Math.min(TIGHT.top, c.pitch + c.lift); c.cutRef = c.pitch; c.cutD = c.cut ? Math.min(c.want, TIGHT.dist) : c.dist; c.vd = c.cutD; c.vdv = 0; c.shown = c.cut;
    c.cutP = c.cut ? over(c.target[0], c.target[1], c.target[2], yaw, c.cutB, c.cutD) : c.cutB;
  }
  // a new window: its framing, keeping the pitch the player set relative to the layout's
  function layout(L) {
    c.want = L.dist; c.fov = L.fov ?? c.fov; c.aim = L.aim ?? c.aim; c.asp = L.asp ?? c.asp;
    if (Number.isFinite(L.pitch)) { c.pitch = clamp(c.pitch + L.pitch - c.base, 0.08, 1.05); c.base = L.pitch; }
  }
  return { c, follow, snap, layout, reach };
}

/* ---------------- the near fade ----------------
   Where the walls still bring the eye within NEAR_FADE.far of the lamplighter's body (the line from 0.3 to 1.3 over its feet), a share of
   its splats is left out, more the nearer the eye, in four steps, and all of them from NEAR_FADE.near in: a screen-door (dithered) fade
   by splat, as Super Mario Odyssey dots Mario out when the camera comes close, and as the gameplay-camera plugins' dithering ("Dither
   Owner") fades the character. A splat near the eye is drawn large, so a figure thinned by a share still covers the view; only one
   left out whole lets the eye see the floor and the way out. What the player holds (the blade and the lantern: the splats on either
   arm's bone more than 0.3 m from its pivot) stays until the eye is within NEAR_FADE.hold of the body, and from there it goes too
   (share NEAR_FADE.all): seen from closer, the lantern and the blade alone fill the view (in the Gaol's torn cell, an eye 1 m back
   looking out of the cell showed a lantern and a blade over much of the screen). eye: the eye's point. -> the share, 0 to 1, or
   NEAR_FADE.all */
export const NEAR_FADE = { near: 0.9, far: 2.2, most: 1, steps: 4, hold: 1.6, all: 2 };
export function fadeOf(eye, s) {
  const dy = clamp(eye[1] - s.y, 0.3, 1.3), d = Math.hypot(eye[0] - s.x, eye[1] - s.y - dy, eye[2] - s.z);
  if (d <= NEAR_FADE.hold) return NEAR_FADE.all;
  const k = clamp((NEAR_FADE.far - d) / (NEAR_FADE.far - NEAR_FADE.near), 0, 1);
  return Math.ceil(k * NEAR_FADE.steps - 1e-9) / NEAR_FADE.steps * NEAR_FADE.most;
}
// the eye's point of a view { target, dist, yaw, pitch }, as the renderer places it
export const eyeOf = v => { const cp = Math.cos(v.pitch); return [v.target[0] + v.dist * Math.sin(v.yaw) * cp, v.target[1] + v.dist * Math.sin(v.pitch), v.target[2] + v.dist * Math.cos(v.yaw) * cp]; };
/* the lamplighter's splats that a fade of share k leaves out, in a place's data: a fixed share of each part by a hash of the splat's
   number, so the figure thins evenly; what it holds (the splats on either arm's bone more than 0.3 m from its pivot: the blade and the
   lantern) stays, but for k = NEAR_FADE.all, which leaves out every splat of the figure. Returns set(k): writes the densities (0, or each splat's own) and returns the 512-splat rows it changed (about 14),
   or none when k is as before */
export const held = (data, bones, i) => {
  const b = data[i * 16 + 12], name = bones.names[b], pv = bones.pivots[b];
  return (name === 'armR' || name === 'armL') && Math.hypot(data[i * 16] - pv[0], data[i * 16 + 1] - pv[1], data[i * 16 + 2] - pv[2]) > 0.3;
};
export function makeFade(data, bones) {
  const { first, end } = bones, own = new Float32Array(end - first);
  const keep = new Uint8Array(end - first), rank = new Float32Array(end - first);
  for (let i = first; i < end; i++) {
    const o = i * 16;
    own[i - first] = data[o + 3];
    keep[i - first] = held(data, bones, i) ? 1 : 0;
    rank[i - first] = ((i * 0.6180339887) % 1 + 1) % 1;
  }
  let at = 0;
  return {
    get k() { return at; },
    set(k) {
      if (k === at) return [];
      at = k;
      const all = k >= NEAR_FADE.all;
      for (let i = first; i < end; i++) data[i * 16 + 3] = all || (!keep[i - first] && rank[i - first] < k) ? 0 : own[i - first];
      const rows = [];
      for (let r = first >> 9; r <= (end - 1) >> 9; r++) rows.push(r);
      return rows;
    }
  };
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
/* ---------------- the blade ----------------
   The cleaver on armR as common.mjs sculpts it (it takes these numbers from here), in the figure's rest frame (feet at 0, facing +z):
   the hand, the blade's direction u, its wide axis w toward the back edge (the cutting edge is on -w) and n = w × u. */
const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const BLADE = (() => {
  const hand = [-0.42, 0.47, 0.08], len = 0.92, wide = 0.17, thick = 0.035, turn = -20 * Math.PI / 180;
  const u = nrm([-0.78, 0.03, 0.6]), w0 = nrm(crs(u, [0, 1, 0])), n0 = crs(w0, u);
  const w = [0, 1, 2].map(i => w0[i] * Math.cos(turn) + n0[i] * Math.sin(turn)), n = crs(w, u);
  // the tip is 0.09 + len along u from the hand: the guard, then the blade
  return { hand, len, wide, thick, u, w, n, tip: 0.09 + len };
})();

/* ---------------- the swings ----------------
   Each hit of the string is a set of keys in play steps from the hit's start, on the shown step (moves.js counts it after the step:
   the first shown pose is step 1, and the hit lands on the first active step, shown as step wind + 1). A key holds:
   az, el: the blade's direction (degrees, round from the facing, + to the left; up from level), in the facing frame of the move;
   ha, hr, hy: the hand, at azimuth ha and hr metres out from the figure's middle, hy over the feet;
   tw, ln, sd: the body's twist (+ to the left), lean forward and lean to the left, in degrees; sq: its height share (the squash);
   sh: a step of the body forward in metres (the weight going over the front foot); lL, lR: the legs' swing (- forward);
   aL, aLz: the lantern arm's swing (+ back) and roll; hd: the head's nod (+ down).
   A missing number keeps the key before. Between keys each number follows a monotone cubic (Fritsch and Carlson 1980), so no curve
   overshoots its keys or stops between them: the swing slows only where a key turns it (the wind-up's top, the follow-through's end).
   The keys are in the facing frame: the pose takes the body's twist, lean and squash back out of the blade and the hand, so a key's
   blade points where it says whatever the body does.
   The plan of each hit, from the sources in design.md ("The swings"): a wind-up that draws the blade back fast and holds it a step
   (anticipation), a strike that starts two steps before the hit (three for the finisher) and is fastest at the hit (the contact pose
   is on the hit step, so hit stop holds it), a wide follow-through past the target that slows to a stop, and a settle into a guard that
   leads into the next hit: the first cut ends on the left, where the second (a rising backhand) starts, and the second ends high on
   the right, where the finisher's overhead chop starts. strike: the step the strike starts (the 'strike' cue). plane: the swing's
   turn, from the wind-up's top to the hit; the blade's cutting edge leads along it. */
const DEG = Math.PI / 180;
export const SWINGS = {
  cut1: {
    wind: 6, act: 5, rec: 14, strike: 4, top: 4, hit: 7, out: 10,
    keys: [
      [0, { az: -60, el: 4, ha: -80, hr: 0.45, hy: 0.62, tw: 0, ln: 0, sd: 0, sq: 1, sh: 0, lL: 0, lR: 0, aL: 0, aLz: 0, hd: 0 }],
      [1.8, { az: -108, el: 10, ha: -100, hr: 0.45, hy: 0.84, tw: -16, ln: -3, sd: -2, sq: 0.96, sh: -0.02, lL: -8, lR: 10, aL: -14, aLz: -4, hd: 2 }],
      [3.6, { az: -146, el: 14, ha: -118, hr: 0.44, hy: 0.95, tw: -28, ln: -5, sd: -3, sq: 0.93, sh: -0.04, lL: -14, lR: 16, aL: -26, aLz: -8, hd: 4 }],
      [4, { az: -150, el: 15, ha: -120, hy: 0.97, tw: -30, ln: -6, sd: -4, sq: 0.92, sh: -0.05, lL: -15, lR: 17, aL: -28, aLz: -9 }],
      [5.5, { az: -110, el: 8, ha: -92, hr: 0.47, hy: 0.95, tw: -18, ln: 0, sd: -2, sq: 0.97, sh: -0.01, lL: -20, lR: 20, aL: -20, hd: 6 }],
      [7, { az: 0, el: -3, ha: -18, hr: 0.52, hy: 0.92, tw: 8, ln: 8, sd: 2, sq: 1.04, sh: 0.06, lL: -26, lR: 24, aL: 10, aLz: 6, hd: 8 }],
      [9, { az: 80, el: -9, ha: 40, hr: 0.5, hy: 0.88, tw: 24, ln: 9, sd: 4, sq: 1.0, sh: 0.07, lL: -28, aL: 22, hd: 7 }],
      [11, { az: 112, el: -13, ha: 70, hr: 0.48, hy: 0.85, tw: 30, ln: 8, sq: 0.96, aL: 26, aLz: 8, hd: 6 }],
      [14, { az: 120, el: -15, ha: 78, hr: 0.47, hy: 0.84, tw: 32, ln: 7, sd: 3, sq: 0.95, sh: 0.06, aL: 24, hd: 5 }],
      [19, { az: 85, el: -10, ha: 50, hr: 0.46, hy: 0.8, tw: 20, ln: 5, sd: 1, sq: 0.98, sh: 0.04, lL: -18, lR: 16, aL: 12, aLz: 4, hd: 3 }],
      [25, { az: 20, el: -2, ha: 0, hr: 0.45, hy: 0.72, tw: 6, ln: 2, sd: 0, sq: 1, sh: 0.02, lL: -8, lR: 8, aL: 4, aLz: 0, hd: 1 }]
    ]
  },
  cut2: {
    wind: 6, act: 5, rec: 16, strike: 4, top: 4, hit: 7, out: 10,
    keys: [
      [0, { az: 90, el: -10, ha: 55, hr: 0.46, hy: 0.8, tw: 22, ln: 4, sd: 2, sq: 0.98, sh: 0.02, lL: -16, lR: 14, aL: 14, aLz: 4, hd: 3 }],
      [3.6, { az: 146, el: -22, ha: 100, hr: 0.44, hy: 0.66, tw: 36, ln: 2, sd: 4, sq: 0.91, sh: -0.04, lL: -10, lR: 20, aL: 30, aLz: 10 }],
      [4, { az: 150, el: -24, ha: 102, hy: 0.64, tw: 38, sd: 5, sq: 0.9, sh: -0.05, aL: 32, aLz: 11 }],
      [5.5, { az: 110, el: -14, ha: 70, hr: 0.47, hy: 0.74, tw: 24, ln: 5, sd: 2, sq: 0.96, sh: -0.01, lL: -16, aL: 20, hd: 4 }],
      [7, { az: 0, el: 10, ha: 10, hr: 0.52, hy: 0.92, tw: -6, ln: 8, sd: -2, sq: 1.05, sh: 0.06, lL: -24, lR: 26, aL: -6, aLz: -4, hd: 6 }],
      [9, { az: -75, el: 26, ha: -50, hr: 0.5, hy: 1.02, tw: -22, ln: 7, sd: -4, sq: 1.03, sh: 0.07, aL: -18 }],
      [11, { az: -108, el: 34, ha: -78, hr: 0.48, hy: 1.08, tw: -28, ln: 5, sd: -5, sq: 1.0, lL: -26, lR: 24, aL: -22, aLz: -8 }],
      [14, { az: -116, el: 36, ha: -84, hr: 0.47, hy: 1.1, tw: -30, ln: 4, sq: 0.99, aL: -20 }],
      [20, { az: -92, el: 24, ha: -72, hr: 0.46, hy: 0.96, tw: -20, ln: 3, sd: -3, sq: 0.98, sh: 0.04, lL: -16, lR: 14, aL: -12, aLz: -4, hd: 2 }],
      [27, { az: -60, el: 6, ha: -70, hr: 0.45, hy: 0.7, tw: -6, ln: 1, sd: 0, sq: 1, sh: 0.01, lL: -6, lR: 6, aL: -4, aLz: 0, hd: 0 }]
    ]
  },
  fin: {
    wind: 12, act: 6, rec: 24, strike: 9, top: 9, hit: 13, out: 12,
    keys: [
      [0, { az: -95, el: 25, ha: -80, hr: 0.46, hy: 0.9, tw: -15, ln: 2, sd: 0, sq: 1, sh: 0, lL: -12, lR: 12, aL: -8, aLz: -2, hd: 0 }],
      [4, { az: -130, el: 50, ha: -105, hr: 0.42, hy: 1.2, tw: -32, ln: -6, sd: -3, sq: 0.9, sh: -0.03, lL: -12, lR: 18, aL: -24, aLz: -10, hd: -4 }],
      [8, { az: -165, el: 74, ha: -122, hr: 0.4, hy: 1.46, tw: -40, ln: -11, sd: -5, sq: 1.06, sh: -0.06, lL: -16, lR: 22, aL: -36, aLz: -14, hd: -8 }],
      [9, { az: -168, el: 76, ha: -124, hy: 1.48, tw: -41, ln: -12, sq: 1.07, aL: -37 }],
      [11, { az: -110, el: 52, ha: -80, hr: 0.44, hy: 1.32, tw: -18, ln: -2, sd: -2, sq: 1.02, sh: 0, lL: -24, lR: 26, aL: -10, hd: 0 }],
      [13, { az: -8, el: -6, ha: -14, hr: 0.52, hy: 0.92, tw: 10, ln: 8, sd: 3, sq: 0.9, sh: 0.09, lL: -34, lR: 30, aL: 30, aLz: 10, hd: 12 }],
      [15, { az: 22, el: -20, ha: 12, hr: 0.52, hy: 0.72, tw: 18, ln: 9, sd: 4, sq: 0.84, sh: 0.1, aL: 38, hd: 14 }],
      [18, { az: 32, el: -24, ha: 20, hr: 0.5, hy: 0.64, tw: 21, ln: 9, sq: 0.82, lL: -36, aL: 40, aLz: 12 }],
      [24, { az: 34, el: -22, ha: 22, hy: 0.66, ln: 8, sd: 3, sq: 0.85, sh: 0.09, aL: 30, hd: 12 }],
      [33, { az: 10, el: -12, ha: 0, hr: 0.47, hy: 0.7, tw: 10, ln: 5, sd: 1, sq: 0.95, sh: 0.05, lL: -20, lR: 16, aL: 12, aLz: 4, hd: 5 }],
      [42, { az: -40, el: 0, ha: -60, hr: 0.45, hy: 0.62, tw: 0, ln: 1, sd: 0, sq: 1, sh: 0.01, lL: -4, lR: 4, aL: 2, aLz: 0, hd: 0 }]
    ]
  }
};
const CH = ['az', 'el', 'ha', 'hr', 'hy', 'tw', 'ln', 'sd', 'sq', 'sh', 'lL', 'lR', 'aL', 'aLz', 'hd'];
// monotone cubic tangents (Fritsch and Carlson), flat at the two ends
function tangents(ts, vs) {
  const n = ts.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return m;
}
const dirOf = (az, el) => [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
for (const S of Object.values(SWINGS)) {
  let last = {};
  S.ts = S.keys.map(k => k[0]);
  S.vs = {};
  const rows = S.keys.map(([, k]) => (last = { ...last, ...k }));
  for (const c of CH) S.vs[c] = rows.map(r => r[c]);
  S.ms = Object.fromEntries(CH.map(c => [c, tangents(S.ts, S.vs[c])]));
  // the swing's plane: the turn from the wind-up's top to the hit
  const at = t => { const i = S.ts.indexOf(t); return dirOf(rows[i].az * DEG, rows[i].el * DEG); };
  S.plane = nrm(crs(at(S.top), at(S.hit)));
  S.len = S.wind + S.act + S.rec;
}
// every number of a swing at step t (fractional), the angles in radians
export function swingAt(S, t) {
  const ts = S.ts, n = ts.length, o = {};
  const tt = clamp(t, ts[0], ts[n - 1]);
  let i = 0;
  while (i < n - 2 && tt > ts[i + 1]) i++;
  const h = ts[i + 1] - ts[i], u = (tt - ts[i]) / h, u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (const c of CH) {
    const v = h00 * S.vs[c][i] + h10 * h * S.ms[c][i] + h01 * S.vs[c][i + 1] + h11 * h * S.ms[c][i + 1];
    o[c] = c === 'hr' || c === 'hy' || c === 'sq' || c === 'sh' ? v : v * DEG;
  }
  return o;
}

/* ---------------- the pose ----------------
   A pose is { tw, ln, sd, sq, sp, sh: the body's twist, lean, side lean, squash, roll-over spin and step forward; bones: the head's,
   legs' and lantern arm's 3×3 matrices in the body's frame; arm: the blade arm as { d, e, H }: the blade's direction, its back-edge
   axis and the hand, from the feet, in the body's frame }. The walk's own pose, a move's pose and a blend of two poses are all one.
   moves.js sets s.act = { move, ph, k, t, from } (k from 0 to 1 through the phase, t the steps since the move began, from what was
   shown when it began), and s.after = { from, t } for the steps after a move ends; a new move eases in from what was shown over
   IN steps, and the walk eases back over OUT steps, so no bone ever jumps from one pose to the next. */
const ease = k => k * k * (3 - 2 * k);
export const BLEND = {
  in: { cut1: 3, cut2: 3, fin: 3, roll: 4, hang: 3, plunge: 3, land: 3, drink: 4, hurt: 4 },
  // the first cut after a finisher starts from the blade low on the left, half a turn from its wind-up: it eases in over more steps
  afterFin: 5,
  out: { cut1: 10, cut2: 10, fin: 12, roll: 7, hang: 4, plunge: 4, land: 8, drink: 8, hurt: 8 },
  // how far the lantern lags the body in a swing, and its sway after the hit: the overlap of what hangs
  lag: 2, sway: 14, swayDecay: 7, swayRate: 0.75
};
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const tr = a => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
// the arm's { d, e, H } from a matrix about the shoulder pv (from the feet) and an offset of the hand
function armOf(A, pv, off = [0, 0, 0]) {
  const B = BLADE, h = [B.hand[0] - pv[0], B.hand[1] - pv[1], B.hand[2] - pv[2]], q = app(A, h);
  return { d: app(A, B.u), e: app(A, B.w), H: [pv[0] + q[0] + off[0], pv[1] + q[1] + off[1], pv[2] + q[2] + off[2]] };
}
// the matrix and the offset of the hand that put the blade along d, its back edge on e, and the hand at H
function armMatrix(arm, pv) {
  const B = BLADE, d = arm.d, e = arm.e, m = crs(e, d);
  const A = [0, 1, 2].flatMap(r => [0, 1, 2].map(c => d[r] * B.u[c] + e[r] * B.w[c] + m[r] * B.n[c]));
  const h = [B.hand[0] - pv[0], B.hand[1] - pv[1], B.hand[2] - pv[2]], q = app(A, h);
  return { A, off: [arm.H[0] - pv[0] - q[0], arm.H[1] - pv[1] - q[1], arm.H[2] - pv[2] - q[2]] };
}
// the walk's own pose: the bones as the explorer has always posed them
function walkParts(s, time, still) {
  const sw = Math.sin(s.phase), m = s.moveK, air = !s.ground, breath = still ? 0 : Math.sin(time * 2.1) * 0.02;
  return {
    head: mul(rotX(0.07 * Math.sin(s.phase * 2) * m - 0.06 * s.runK + breath * 2), rotY(0.05 * sw * m)),
    legL: rotX(air ? 0.45 : -0.75 * sw * m),
    legR: rotX(air ? -0.25 : 0.75 * sw * m),
    armL: rotX(air ? -0.5 : 0.22 * sw * m + 0.05 * Math.sin(time * 1.7)),
    armR: mul(rotX(air ? -0.9 : -0.65 * sw * m), rotZ(air ? 0.5 : 0.08))
  };
}
const poseFrom = (parts, pv, o = {}) => ({
  tw: o.twist || 0, ln: o.lean || 0, sd: 0, sq: o.squash ?? 1, sp: o.spin || 0, sh: 0,
  bones: { head: parts.head, legL: parts.legL, legR: parts.legR, armL: parts.armL }, arm: armOf(parts.armR, pv)
});
// the shown step of a hit, from t or else from its phase and share (as a test may give it)
function hitStep(a, S) {
  if (Number.isFinite(a.t)) return a.t;
  return a.ph === 'wind' ? a.k * S.wind : a.ph === 'act' ? S.wind + a.k * S.act : S.wind + S.act + a.k * S.rec;
}
// a hit of the string from its keys
function swingPose(a, pv) {
  const S = SWINGS[a.move], t = hitStep(a, S), k = swingAt(S, t), kl = swingAt(S, t - BLEND.lag);
  // the facing frame into the body's: the body turns by tw, then leans by ln (about x) and sd (about z), and squashes by sq in height
  const back = mul(rotZ(-k.sd), mul(rotX(-k.ln), rotY(-k.tw)));
  const d = app(back, dirOf(k.az, k.el)), N = app(back, S.plane);
  let v = crs(N, d);
  if (Math.hypot(v[0], v[1], v[2]) < 1e-4) v = crs([0, 1, 0], d);
  const e = nrm(v).map(x => -x);
  const H = app(back, [k.hr * Math.sin(k.ha), k.hy / k.sq, k.hr * Math.cos(k.ha)]);
  // the lantern swings against the blade, a little behind the body, and sways after the hit
  const since = t - S.hit, sway = since > 0 ? BLEND.sway * DEG * Math.exp(-since / BLEND.swayDecay) * Math.sin(since * BLEND.swayRate) : 0;
  return {
    tw: k.tw, ln: k.ln, sd: k.sd, sq: k.sq, sp: 0, sh: k.sh,
    bones: { head: mul(rotX(k.hd), rotY(-0.4 * k.tw)), legL: rotX(k.lL), legR: rotX(k.lR), armL: mul(rotX(kl.aL), rotZ(kl.aLz + sway)) },
    arm: { d, e, H }
  };
}
/* the other moves of a run. The roll turns the whole figure over round its middle. The plunge holds the blade arm down in front and
   swings the lantern arm up behind, not a seated drop */
function movePose(a, walk, pv) {
  const k = a.k, e = ease(k), back = 1 - e, parts = { ...walk };
  let lean = 0, spin = 0, twist = 0, squash = 1;
  switch (a.move) {
    case 'roll':
      spin = (a.back ? -1 : 1) * 2 * Math.PI * e;
      squash = 1 - 0.22 * Math.sin(Math.PI * k);
      // the blade turned to lie along the roll's axis (out to the side), so it turns round over the floor, never into it
      parts.armL = rotX(-0.9); parts.armR = rotY(-0.66);
      parts.legL = parts.legR = rotX(-1.0);
      parts.head = rotX(0.35);
      break;
    case 'hang':
      parts.armR = rotX(-2.5 * e); parts.armL = rotX(1.4 * e);
      parts.legL = parts.legR = rotX(-0.8 * e);
      break;
    case 'plunge':
      parts.armR = mul(rotX(-0.3), rotZ(0.35)); parts.armL = mul(rotX(2.6), rotZ(-0.3));
      parts.legL = parts.legR = rotX(-0.45);
      lean = 0.32;
      break;
    case 'land':
      parts.armR = mul(rotX(-0.3 * back), rotZ(0.35 * back)); parts.armL = rotX(2.6 * back);
      lean = 0.32 * back; squash = 1 - 0.2 * back;
      break;
    case 'drink':
      parts.armR = mul(rotX(-2.1 * Math.min(1, k * 4)), rotZ(0.7 * Math.min(1, k * 4)));
      parts.head = rotX(-0.28 * Math.sin(Math.PI * k));
      break;
    case 'hurt':
      parts.armR = rotZ(-0.7 * back); parts.armL = rotZ(0.7 * back);
      lean = -0.4 * back;
      break;
  }
  return poseFrom(parts, pv, { lean, spin, twist, squash });
}
const lerp = (a, b, w) => a + (b - a) * w;
const lerpV = (a, b, w) => a.map((x, i) => x + (b[i] - x) * w);
// a rotation between two, by its rows mixed and made square again (Gram and Schmidt)
function mixRot(A, B, w) {
  const M = lerpV(A, B, w), r0 = nrm(M.slice(0, 3)), r1p = M.slice(3, 6), r1 = nrm(r1p.map((x, i) => x - dot(r1p, r0) * r0[i])), r2 = crs(r0, r1);
  return [...r0, ...r1, ...r2];
}
function mix(A, B, w) {
  if (w >= 1) return B;
  if (w <= 0) return A;
  // the spin is a turn: mix it the short way round (a whole roll is no turn at all)
  const sp = A.sp + Math.atan2(Math.sin(B.sp - A.sp), Math.cos(B.sp - A.sp)) * w;
  /* the blade's direction the short way round; two that point nearly apart (the first cut after a finisher) go over the top, as a
     blade lifted over the head, never through the figure */
  const bow = Math.max(0, -dot(A.arm.d, B.arm.d)) * 1.5 * Math.sin(Math.PI * w), dl = lerpV(A.arm.d, B.arm.d, w);
  const d = nrm([dl[0], dl[1] + bow, dl[2]]), ep = lerpV(A.arm.e, B.arm.e, w);
  let eo = ep.map((x, i) => x - dot(ep, d) * d[i]);
  if (Math.hypot(eo[0], eo[1], eo[2]) < 1e-3) eo = crs(d, [0, 0, 1]);
  const e = nrm(eo);
  const bones = {};
  for (const n of ['head', 'legL', 'legR', 'armL']) bones[n] = mixRot(A.bones[n], B.bones[n], w);
  return { tw: lerp(A.tw, B.tw, w), ln: lerp(A.ln, B.ln, w), sd: lerp(A.sd, B.sd, w), sq: lerp(A.sq, B.sq, w), sp, sh: lerp(A.sh, B.sh, w), bones, arm: { d, e, H: lerpV(A.arm.H, B.arm.H, w) } };
}
// the pose a move's state shows: the move itself, eased in from what it began from (up to `depth` moves back)
function actPoseOf(a, walk, pv, depth = 2) {
  const own = SWINGS[a.move] ? swingPose(a, pv) : movePose(a, walk, pv);
  const n = a.move === 'cut1' && a.from?.move === 'fin' ? BLEND.afterFin : BLEND.in[a.move] || 3;
  if (depth <= 0 || !Number.isFinite(a.t) || a.t >= n) return own;
  // from the walk when the move began from no move
  return mix(a.from ? shownOf(a.from, walk, pv, depth - 1) : poseFrom(walk, pv), own, ease(Math.max(0, a.t) / n));
}
// what a state shows: a move, or the walk, eased back from the move that ended
function shownOf(st, walk, pv, depth = 2) {
  if (st.move) return actPoseOf(st, walk, pv, depth);
  const base = poseFrom(walk, pv);
  const af = st.after;
  if (!af || !af.from || depth <= 0) return base;
  const n = BLEND.out[af.from.move] || 8;
  if (af.t >= n) return base;
  return mix(shownOf(af.from, walk, pv, depth - 1), base, ease(af.t / n));
}
// the state the pose shows now: { move, ... } in a move, { after } after one, or null for the walk alone
export const shownState = s => (s.act ? s.act : s.after ? { move: null, after: s.after } : null);
export function pose(out, rig, s, time = 0, still = false) {
  const { names, pivots } = rig;
  const P0 = pivots[0], F = [P0[0], P0[1] - 0.1, P0[2]];
  // the hurt blink: the figure's bones park far under the map, scaled to nothing (a bone at scale 0 alone still draws a dot)
  const HIDE = scl(0, 0, 0);
  const sw = Math.sin(s.phase), m = s.moveK, air = !s.ground;
  const land = s.landK * Math.exp(-s.landAge * 9);
  const rising = air && s.vy > 0 ? Math.min(1, s.vy / 8) : 0;
  const breath = still ? 0 : Math.sin(time * 2.1) * 0.02;
  const parts = walkParts(s, time, still);
  const st = shownState(s);
  let act = null, armOff = [0, 0, 0];
  if (st) {
    const iR = names.indexOf('armR'), pv = iR >= 0 ? [pivots[iR][0] - F[0], pivots[iR][1] - F[1], pivots[iR][2] - F[2]] : [-0.33, 0.72, 0];
    const p = shownOf(st, parts, pv);
    Object.assign(parts, p.bones);
    const arm = armMatrix(p.arm, pv);
    parts.armR = arm.A; armOff = arm.off;
    act = { lean: p.ln, spin: p.sp, twist: p.tw, squash: p.sq, side: p.sd, shift: p.sh };
  }
  const sy = (1 - 0.28 * land + 0.1 * rising) * (act ? act.squash : 1), sxz = 1 + 0.14 * land - 0.04 * rising;
  const lean = 0.2 * s.runK + 0.06 * m + (air ? -0.08 : 0) + (act ? act.lean : 0);
  let Ab = mul(rotY(s.yaw + (act ? act.twist : 0)), mul(scl(sxz, sy * (1 + breath), sxz), mul(rotX(lean), rotZ(0.05 * sw * m + (act ? act.side : 0)))));
  const bob = Math.abs(sw) * 0.07 * m;
  const P = [s.x, s.y + bob, s.z];
  if (act && act.shift) { P[0] += Math.sin(s.yaw) * act.shift; P[2] += Math.cos(s.yaw) * act.shift; }
  if (act && act.spin) {
    // turn over round the middle of the figure, 0.45 over the feet: that point stays where it was
    const Ab2 = mul(Ab, rotX(act.spin)), a1 = app(Ab, [0, 0.45, 0]), a2 = app(Ab2, [0, 0.45, 0]);
    P[0] += a1[0] - a2[0]; P[1] += a1[1] - a2[1]; P[2] += a1[2] - a2[2];
    Ab = Ab2;
  }
  const offW = app(Ab, armOff);
  names.forEach((name, b) => {
    const pv = pivots[b];
    if (s.hide && name !== 'shadow') { put(out, b, HIDE, [0, -500, 0]); return; }
    if (name === 'shadow') {
      const hgt = Math.max(0, s.y - s.floor), k = 1 / (1 + 0.45 * hgt);
      const A = scl(k, 1, k);
      const to = [s.x, s.floor + 0.04, s.z], ap = app(A, pv);
      put(out, b, A, [to[0] - ap[0], to[1] - ap[1], to[2] - ap[2]]);
      return;
    }
    const A = name === 'body' ? Ab : mul(Ab, parts[name] || parts.body || I3);
    // where the bone's pivot lands: P + Ab (pivot - feet); then t = that - A pivot (and the blade arm's hand offset)
    const rel = [pv[0] - F[0], pv[1] - F[1], pv[2] - F[2]], w = app(Ab, rel), ap = app(A, pv), o = name === 'armR' ? offW : [0, 0, 0];
    put(out, b, A, [P[0] + w[0] - ap[0] + o[0], P[1] + w[1] - ap[1] + o[1], P[2] + w[2] - ap[2] + o[2]]);
  });
  return out;
}
/* the blade in the world as the pose shows it: the hand, a point on the blade share k of the way to the tip (each k given), and the
   tip. For the swing's trail (fight.js) and the checks */
let bladeBuf = null;
export function bladeAt(rig, s, ks = [0.5, 1], time = 0) {
  const n = rig.names.length;
  if (!bladeBuf || bladeBuf.length < 12 * n) bladeBuf = new Float32Array(12 * n);
  const hide = s.hide;
  s.hide = false;
  pose(bladeBuf, rig, s, time, true);
  s.hide = hide;
  const F = [rig.pivots[0][0], rig.pivots[0][1] - 0.1, rig.pivots[0][2]], o = 12 * rig.names.indexOf('armR'), B = BLADE;
  const at = d => {
    const p = [F[0] + B.hand[0] + B.u[0] * d, F[1] + B.hand[1] + B.u[1] * d, F[2] + B.hand[2] + B.u[2] * d];
    return [0, 1, 2].map(r => bladeBuf[o + r * 3] * p[0] + bladeBuf[o + r * 3 + 1] * p[1] + bladeBuf[o + r * 3 + 2] * p[2] + bladeBuf[o + 9 + r]);
  };
  return { hand: at(0), points: ks.map(k => at(0.09 + B.len * k)), tip: at(B.tip) };
}

/* ---------------- touch ---------------- */
export const touches = (s, p, r = PARAMS.touch) => Math.hypot(p[0] - s.x, p[2] - s.z) < r && p[1] - s.y > -0.7 && p[1] - s.y < 2.1;
export const atBeacon = (s, b) => Math.hypot(b.p[0] - s.x, b.p[2] - s.z) < b.r && Math.abs(b.p[1] - s.y) < 2.6;

/* ---------------- what can be reached ----------------
   A search over the walk grid with the controller's own rules: the disc, the base and climb, any drop, and a jump that rises up to
   JUMP - 0.1 and lands up to 1.0 away along a row or a column. It is never more open than the controller: it tests the controller's
   own disc at each grid point and half way to it; it moves the base only where every cell round a point is a slope; a disc that
   already reaches over something too high walks only where each point is no nearer to it, as the controller's does; and a jump lands
   only where the disc can stand on a slope, with nothing on the way higher than both ends. Returns near(p, ...) -> boolean, the number
   of cells reached, and trapped(exit, out): the reached places that do not lead back (see there).
   With wide, it then goes on with wide jumps, which are more open than the controller, for the trap rule (it must try every place the
   controller can get to): from each state with a step of more than 0.6 within two cells, a jump on each of 16 headings that lands on
   any floor that the run speed carries it to before it falls there, wherever the disc has nothing over the feet. On the way the feet
   can be at any height up to the jump's top (JUMP over the feet) where there is room: over a cell's top, or under its roof (from the
   floor under its gap to its underside); a step across a corner goes through one of the two cells beside it. The search goes on from
   what they reach, by its own walks and jumps and by more wide jumps. What only a wide jump reaches does not count in cells or near()
   (but for near(..., all)), and no way back goes by a wide jump. */
export function reachable(walk, start, bounds, P = PARAMS, { wide = false } = {}) {
  const { nx, nz, x0, z0, step } = walk, lim = bounds - 0.6, climb = climbOf(P), steep = steepOf(P);
  const open = (x, z, top, feet) => nearest(walk, x, z, top, feet, P.radius, true) === Infinity;
  /* a walk by a disc that already reaches over something too high (d0, how near its centre that comes; fits() in the controller): along
     it or away from it, so the half way point and then the end are no nearer to it than the point before */
  const wallIn = (x, z, top, feet) => nearest(walk, x, z, top, feet, P.radius);
  const away = (d0, mx, mz, x, z, top, feet) => {
    if (!(d0 > 0 && d0 < Infinity)) return false;
    const d1 = wallIn(mx, mz, top, feet);
    return d1 >= d0 - 1e-6 && wallIn(x, z, top, feet) >= d1 - 1e-6;
  };
  // a slope (not a face) in all four cells round a grid point
  const e = step * 1e-3;
  const slope = (x, z, top, feet) => [[e, e], [-e, e], [e, -e], [-e, -e]].every(([a, b]) => {
    walk.floorAt(x + a, z + b, top, feet);
    return Math.hypot(walk.grad[0], walk.grad[1]) <= steep;
  });
  /* reached heights by cell and height (a state, keyed by key()), each with the highest base it was reached with (a higher base reaches
     more), every walk and jump from one state to another (from[e] to to[e]), and every wide jump to a state it found (wfrom, wto) */
  const seen = new Map(), queue = [], states = [], from = [], to = [], wfrom = [], wto = [];
  const key = (i, j, y) => (j * nx + i) * 16384 + Math.round(y * 10) + 8192;
  let cur = -1, byWide = false; // the state the search goes on from, and whether by a wide jump
  const visit = (i, j, y, base) => {
    const k = key(i, j, y);
    let had = seen.get(k);
    if (!had) {
      had = { y, base: -Infinity, id: states.length };
      seen.set(k, had);
      states.push([i, j, had.y]);
      if (byWide) { wfrom.push(cur); wto.push(had.id); }
    }
    if (!byWide && cur >= 0 && cur !== had.id) { from.push(cur); to.push(had.id); }
    if (had.base >= base - 1e-6) return;
    had.base = base;
    queue.push([i, j, y, base, k]);
  };
  const ci = x => Math.round((x - x0) / step), cj = z => Math.round((z - z0) / step);
  const y0 = walk.support(start.p[0], start.p[2], start.p[1] + 1) ?? start.p[1];
  visit(ci(start.p[0]), cj(start.p[2]), y0, y0);
  /* a jump rises up to 0.1 short of its top (lift, JUMP for PARAMS) and lands up to 1.0 away along a row or a column of the grid. On
     the way the feet are read at the top of the jump, the highest the controller reads them: a gap whose floor is that far below
     them is a roof there */
  const lift = (P.jumpV * P.jumpV) / (2 * P.gravity), jumpUp = lift - 0.1, far = P.jumpV > 0 ? Math.max(1, Math.floor(1.0 / step + 1e-6)) : 0;
  let qi = 0;
  const grow = () => {
    for (; qi < queue.length; qi++) {
      const [i, j, y, base, k] = queue[qi], st = seen.get(k);
      if (st.base > base + 1e-6) continue; // reached again since with a higher base
      cur = st.id;
      const ox = x0 + i * step, oz = z0 + j * step;
      let d0; // how near the disc here comes to something above a climb over the base (found when a walk needs it)
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const inside = d => {
          const i2 = i + di * d, j2 = j + dj * d;
          return i2 >= 0 && j2 >= 0 && i2 < nx && j2 < nz && Math.abs(x0 + i2 * step) <= lim && Math.abs(z0 + j2 * step) <= lim;
        };
        if (!inside(1)) continue;
        const x = ox + di * step, z = oz + dj * step, mx = ox + di * step / 2, mz = oz + dj * step / 2;
        /* a walk: the disc clear within climb of the base, half way and there, for the feet where they stand, or no nearer there to what
           it already reaches over here; on a slope the base comes to the feet */
        let top = base + climb;
        if ((open(mx, mz, top, y) && open(x, z, top, y)) || away(d0 ??= wallIn(ox, oz, top, y), mx, mz, x, z, top, y)) {
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
  };
  grow();
  const sure = states.length; // the states that the search's own walks and jumps reach
  if (wide && P.jumpV > 0) {
    const { T, G, U } = walk, N = nx * nz, under = k => (U ? U[k] : G[k] + walk.clear * 100) * 0.01;
    // the cells with a step of more than 0.6 (in the top or in the floor under a gap) within two cells
    const edge = new Uint8Array(N);
    let lowest = Infinity;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      lowest = Math.min(lowest, G[k] * 0.01);
      for (let dj = -2; dj <= 2 && !edge[k]; dj++) for (let di = -2; di <= 2; di++) {
        const i2 = i + di, j2 = j + dj, k2 = j2 * nx + i2;
        if (i2 >= 0 && j2 >= 0 && i2 < nx && j2 < nz && (Math.abs(T[k2] - T[k]) > 60 || Math.abs(G[k2] - G[k]) > 60)) { edge[k] = 1; break; }
      }
    }
    // how far the run carries a jump from its top down a drop of dy: up at gravity, down at gravity·fallMul, a cell more for the disc
    const carry = dy => P.run * (P.jumpV / P.gravity + Math.sqrt((2 * Math.max(0, dy)) / (P.gravity * P.fallMul))) + step;
    // the grid points along 16 headings, out to the farthest a jump from the map's highest top carries down to its lowest floor
    let highest = -Infinity;
    for (let k = 0; k < N; k++) highest = Math.max(highest, T[k] * 0.01);
    const reachOut = Math.ceil(carry(highest + lift - lowest) / step);
    const rays = RAYS.map(([cx, cz]) => {
      const out = [];
      for (let r = 1; r <= reachOut; r++) {
        const di = Math.round(cx * r), dj = Math.round(cz * r), l = out[out.length - 1];
        if (!l || l[0] !== di || l[1] !== dj) out.push([di, dj, Math.hypot(di, dj) * step]);
      }
      return out;
    });
    const land = (i2, j2, px, pz, f) => { if (!seen.has(key(i2, j2, f)) && open(px, pz, f + 0.05, f + 0.05)) visit(i2, j2, f, f); };
    /* the heights the feet can be at along a wide jump, as spans [lo, hi], each in one open space of a cell: over its top, or under its
       roof (from the floor under its gap up to its underside). The feet start at y and rise to fly. pass() takes the n spans in sp into
       cell k: a span goes on into each space of k that it meets, and there the feet can drop to the floor of that space. It writes the
       spans in k to out (at most two) and returns how many */
    const spans = new Float64Array(8), sa = new Float64Array(4), sb = new Float64Array(4);
    const pass = (k, sp, n, out) => {
      const t = T[k] * 0.01, g = G[k] * 0.01, gap = g < t, u = gap ? under(k) - 0.01 : 0;
      let over = -Infinity, low = -Infinity;
      for (let q = 0; q < n; q++) {
        const lo = sp[2 * q], hi = sp[2 * q + 1];
        if (hi >= t && hi > over) over = hi;
        if (gap && hi >= g && lo <= u) low = Math.max(low, Math.min(hi, u));
      }
      let m = 0;
      if (over > -Infinity) { out[0] = t; out[1] = over; m = 1; }
      if (low > -Infinity) { out[2 * m] = g; out[2 * m + 1] = low; m++; }
      return m;
    };
    for (let done = 0; done < states.length;) {
      const end = states.length;
      for (let s = done; s < end; s++) {
        const [i, j, y] = states[s];
        if (!edge[j * nx + i]) continue;
        const top = y + lift, fly = top + 0.05, most = carry(top - lowest);
        cur = s;
        byWide = true;
        for (const ray of rays) {
          let n = 1, pi = i, pj = j;
          spans[0] = y; spans[1] = fly;
          for (const [di, dj, d] of ray) {
            const i2 = i + di, j2 = j + dj;
            if (d > most || i2 < 0 || j2 < 0 || i2 >= nx || j2 >= nz) break;
            const px = x0 + i2 * step, pz = z0 + j2 * step, k2 = j2 * nx + i2;
            if (Math.abs(px) > lim || Math.abs(pz) > lim) break;
            // a step across a corner goes through one of the two cells beside it
            if (i2 !== pi && j2 !== pj) {
              const na = pass(j2 * nx + pi, spans, n, sa), nb = pass(pj * nx + i2, spans, n, sb);
              for (let q = 0; q < 2 * na; q++) spans[q] = sa[q];
              for (let q = 0; q < 2 * nb; q++) spans[2 * na + q] = sb[q];
              n = na + nb;
            }
            n = pass(k2, spans, n, sa);
            if (!n) break; // no space there that the feet can be in: a wall higher than the jump's top
            for (let q = 0; q < 2 * n; q++) spans[q] = sa[q];
            for (let q = 0; q < n; q++) if (d <= carry(top - spans[2 * q])) land(i2, j2, px, pz, spans[2 * q]);
            pi = i2; pj = j2;
          }
        }
        byWide = false;
      }
      done = end;
      grow();
    }
  }
  // the heights reached in each cell: by the search's own walks and jumps (sure), and by all (wide jumps too)
  const byCell = new Map(), byCellAll = new Map();
  for (let s = 0; s < states.length; s++) {
    const c = states[s][1] * nx + states[s][0];
    if (s < sure) (byCell.get(c) || byCell.set(c, []).get(c)).push(states[s][2]);
    (byCellAll.get(c) || byCellAll.set(c, []).get(c)).push(states[s][2]);
  }
  return {
    cells: byCell.size,
    // the states that only wide jumps reach
    wide: states.length - sure,
    /* the reached states that do not lead back (traps): from them no walk or jump of the search leads to the start, or to a state
       where exit(x, y, z) holds (by the beacon). The search runs back from those over every walk and jump it made (not the wide jumps).
       With out(trap, leads), a trap also leads back when out finds a move from it to a place where leads({ x, z, y }) holds (the bake
       tries the controller's own walks and jumps there). A place is the state at the grid point nearest to it, with the floor that the
       feet meet there; a place the search did not reach does not lead back. Each trap comes with the way in: a state that leads back,
       or a trap listed before it, with a walk or a jump of the search to it where there is one (the first found), else with a wide jump
       to it; and wide: true when only wide jumps reach it. -> { traps: [{ i, j, x, z, y, wide, way: { i, j, y } }], leads } */
    trapped(exit = () => false, out = null) {
      const n = states.length, m = from.length, back = new Int32Array(n + 1), on = new Int32Array(n + 1), won = new Int32Array(n + 1);
      for (let e = 0; e < m; e++) { back[to[e] + 1]++; on[from[e] + 1]++; }
      for (let e = 0; e < wfrom.length; e++) won[wfrom[e] + 1]++;
      for (let s = 0; s < n; s++) { back[s + 1] += back[s]; on[s + 1] += on[s]; won[s + 1] += won[s]; }
      const into = new Int32Array(m), outof = new Int32Array(m), wout = new Int32Array(wfrom.length), bi = back.slice(0, n), oi = on.slice(0, n), wi = won.slice(0, n);
      for (let e = 0; e < m; e++) { into[bi[to[e]]++] = from[e]; outof[oi[from[e]]++] = to[e]; }
      for (let e = 0; e < wfrom.length; e++) wout[wi[wfrom[e]]++] = wto[e];
      // back from the start and the exits: the states that lead back
      const good = new Uint8Array(n), q = [];
      const back1 = s => {
        good[s] = 1; q.length = 0; q.push(s);
        for (let h = 0; h < q.length; h++) for (let e = back[q[h]]; e < back[q[h] + 1]; e++) if (!good[into[e]]) { good[into[e]] = 1; q.push(into[e]); }
      };
      back1(0);
      for (let s = 1; s < n; s++) if (!good[s] && exit(x0 + states[s][0] * step, states[s][2], z0 + states[s][1] * step)) back1(s);
      const at = s => ({ i: states[s][0], j: states[s][1], x: x0 + states[s][0] * step, z: z0 + states[s][1] * step, y: states[s][2] });
      const leads = p => {
        const i = ci(p.x), j = cj(p.z);
        if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
        const y = walk.floorAt(x0 + i * step, z0 + j * step, p.y + climb, p.y), t = seen.get(key(i, j, y));
        return !!t && good[t.id] === 1;
      };
      if (out) {
        for (let again = true; again;) {
          again = false;
          for (let s = 0; s < n; s++) if (!good[s] && out(at(s), leads)) { back1(s); again = true; }
        }
      }
      /* the traps, from the ways in from the states that lead back, then on through the traps: by the search's own walks and jumps
         first, then by wide jumps, so a trap's way in is a wide jump only where no walk or jump of the search gets there */
      const way = new Int32Array(n).fill(-1), list = [];
      const enter = (s, O, E) => { for (let e = O[s]; e < O[s + 1]; e++) if (!good[E[e]] && way[E[e]] < 0) { way[E[e]] = s; list.push(E[e]); } };
      for (let s = 0; s < n; s++) if (good[s]) enter(s, on, outof);
      for (let h = 0; h < list.length; h++) enter(list[h], on, outof);
      const first = list.length;
      for (let s = 0; s < n; s++) if (good[s]) enter(s, won, wout);
      for (let h = 0; h < first; h++) enter(list[h], won, wout);
      for (let h = first; h < list.length; h++) { enter(list[h], on, outof); enter(list[h], won, wout); }
      return { traps: list.map(s => ({ ...at(s), wide: s >= sure, way: at(way[s]) })), leads };
    },
    /* can the feet stand near (x, z) at a height from which p (a wisp or the beacon) is in touch? By the search's own walks and jumps,
       or with all, by wide jumps too */
    near(p, r = PARAMS.touch * 0.8, lo = -0.7, hi = 2.1, all = false) {
      const n = Math.ceil(r / step), cellsOf = all ? byCellAll : byCell;
      for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
        const i = ci(p[0]) + di, j = cj(p[2]) + dj, x = x0 + i * step, z = z0 + j * step;
        if (i < 0 || j < 0 || i >= nx || j >= nz || Math.hypot(x - p[0], z - p[2]) > r) continue;
        for (const y of cellsOf.get(j * nx + i) || []) if (p[1] - y > lo && p[1] - y < hi) return true;
      }
      return false;
    }
  };
}
