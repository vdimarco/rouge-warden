// qa/crimson/playbot.js : a player for the story, for qa/crimson/playthrough.mjs. It runs in the page
// (playthrough.mjs evaluates this file once, then calls __bot.tick() before every stepped tick) and plays
// with the real inputs only: keys through S.input.key (the same path as the keyboard), the sticks through
// S.input.set (move, look, steer: what a pad writes). It reads what a player sees: the objective, the
// markers, the meters, the photo score, who is swinging at it. It never teleports and never touches the
// autopilot. What it notices goes into __bot.notes; __bot.state says what it is doing.
/* global __crimson */
(() => {
  const S = () => __crimson.story.S;
  const MS = () => S().test.missions.K;
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const B = window.__bot = {
    cfg: { choice: 0, skipCines: false, top: 24, careful: false },
    notes: [], fails: [], state: '', t: 0, held: new Set(), taps: [], lib: null,
    nav: null, drv: null, cam: null, fight: null, last: {}, stepKey: '', stepT: 0, modalT: 0,
  };
  const note = (k, msg) => { if (!B.notes.some((n) => n.k === k)) B.notes.push({ k, msg, t: +B.t.toFixed(1), step: B.stepKey }); };

  /* ---------------- inputs ---------------- */
  const KEY = (code, down) => S().input.key({ code, preventDefault() {} }, down);
  function tap(code) { KEY(code, true); B.taps.push(code); }
  let want = new Set();
  function hold(code) { want.add(code); }
  let axes = null;
  function flush() {
    for (const c of B.held) if (!want.has(c)) { KEY(c, false); B.held.delete(c); }
    for (const c of want) if (!B.held.has(c)) { KEY(c, true); B.held.add(c); }
    S().input.set(axes);
  }
  function releaseTaps() { for (const c of B.taps) if (!B.held.has(c)) KEY(c, false); B.taps.length = 0; }
  B.releaseAll = () => { for (const c of B.held) KEY(c, false); B.held.clear(); releaseTaps(); S().input.set({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, steer: { x: 0, y: 0 } }); };
  // a tap no more than every `gap` seconds, per name
  const every = (name, gap) => { const t = B.last[name] ?? -99; if (B.t - t >= gap) { B.last[name] = B.t; return true; } return false; };

  /* ---------------- what the player sees ---------------- */
  const mk = (id) => { const m = MS().markers3d.get(id); return m && !m.hidden ? m : null; };
  const markers = () => MS().markers3d.list.filter((m) => !m.hidden);
  const riding = () => S().drive.riding;
  const heroAt = () => (riding() ? riding().pos : S().hero.pos);
  const meterDot = (label) => {
    for (const e of document.querySelectorAll('#sMeters .meter')) {
      if ((e.querySelector('p span') || {}).textContent !== label) continue;
      const d = e.querySelector('.dot'); return d ? parseFloat(d.style.left) / 100 : null;
    }
    return null;
  };
  const stepNow = () => { const m = MS().current; return m ? { m, s: m.def.steps[m.index], id: m.def.id, i: m.index } : null; };

  /* ---------------- on foot ---------------- */
  // stick toward a world direction, through the foot camera's yaw (what the hero's own controls use)
  function stickTo(dx, dz, k = 1) {
    const cam = S().test.combat.cam, y = cam ? cam.yaw : 0;
    const fx = Math.sin(y), fz = Math.cos(y), rx = -Math.cos(y), rz = Math.sin(y);
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    axes.move = { x: (dx * rx + dz * rz) * k, y: (dx * fx + dz * fz) * k };
  }
  // A path on foot, the way a player picks one by eye: A* over a grid around the start and the goal, with
  // the hero's own walking rules (a step up of at most max(0.45, 1.25 x run), no deep water, no colliders
  // at the cell or halfway to it). Returns [{x, z}] or null.
  function findPath(a, b, ya, costFn = null) {
    const W = S().world, C = W.colliders;
    const span = Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) + 40;
    const cs = span > 180 ? 2 : span > 100 ? 1.4 : 0.8, n = Math.min(260, Math.ceil(span / cs) + 1);
    const x0 = (a.x + b.x) / 2 - (n * cs) / 2, z0 = (a.z + b.z) / 2 - (n * cs) / 2;
    const ix = (x) => Math.round((x - x0) / cs), iz = (z) => Math.round((z - z0) / cs);
    const sI = ix(a.x), sJ = iz(a.z), gI = ix(b.x), gJ = iz(b.z);
    if (sI < 0 || sJ < 0 || sI >= n || sJ >= n || gI < 0 || gJ < 0 || gI >= n || gJ >= n) return null;
    const N2 = n * n, g = new Float32Array(N2).fill(Infinity), ys = new Float32Array(N2), prev = new Int32Array(N2).fill(-1), closed = new Uint8Array(N2);
    const heap = []; // [f, idx]
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const s0 = sJ * n + sI, goal = gJ * n + gI;
    g[s0] = 0; ys[s0] = ya; push(0, s0);
    const hq = (i) => Math.hypot((i % n) - gI, ((i / n) | 0) - gJ) * cs;
    // (parked vehicles block the way too)
    const vs = S().vehicles.list.filter((v) => v !== S().drive.riding && !v.gone && Math.hypot(v.pos.x - (a.x + b.x) / 2, v.pos.z - (a.z + b.z) / 2) < span);
    const inVehicle = (x, z) => vs.some((v) => { const [lx, lz] = v.toLocal(x, z); return Math.abs(lx) < v.hw + 0.45 && Math.abs(lz) < v.hd + 0.45; });
    const blocked = (x, z, y) => C.resolveCircle({ x, z }, 0.38, y) || inVehicle(x, z);
    let best = s0, bestH = hq(s0), it = 0;
    while (heap.length && it++ < 60000) {
      const [, i] = pop(); if (closed[i]) continue; closed[i] = 1;
      const h = hq(i); if (h < bestH) { bestH = h; best = i; }
      if (i === goal || h < 1.2) { best = i; break; }
      const ci = i % n, cj = (i / n) | 0, cx = x0 + ci * cs, cz = z0 + cj * cs, cy = ys[i];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const k = nj * n + ni; if (closed[k]) continue;
        const x = x0 + ni * cs, z = z0 + nj * cs, run = Math.hypot(di, dj) * cs;
        const y = W.surface(x, z, cy + 0.6);
        if (!Number.isFinite(y) || y - cy > Math.max(0.45, run * 1.25) || cy - y > 6) continue;
        const w = W.water(x, z); if (w && w.depth > 1.0) continue;
        if (blocked(x, z, y) || blocked((x + cx) / 2, (z + cz) / 2, Math.max(y, cy))) continue;
        const c = g[i] + run + (cy - y > 1.5 ? 2 : 0) + (costFn ? costFn(x, z) * run : 0);
        if (c < g[k]) { g[k] = c; ys[k] = y; prev[k] = i; push(c + hq(k), k); }
      }
    }
    const out = [];
    for (let i = best; i >= 0; i = prev[i]) out.unshift({ x: x0 + (i % n) * cs, z: z0 + ((i / n) | 0) * cs });
    if (out.length) out.push({ x: b.x, z: b.z });
    return out.length > 1 ? { pts: out, reached: bestH < 1.6 } : null;
  }
  B.findPath = findPath;
  // walk to p; returns the flat distance. Plans a path around what is in the way; replans when it stops
  // getting closer.
  function walkTo(p, o = {}) {
    const H = S().hero, d = flat(H.pos, p);
    // far: along the roads (the GPS line), a stretch at a time
    if (d > 140 && !o.cost) {
      const key = `${Math.round(p.x / 4)},${Math.round(p.z / 4)}`;
      let RN = B.road;
      if (!RN || RN.key !== key || B.t - RN.t > 30) RN = B.road = { key, pts: S().world.roads.route({ x: H.pos.x, z: H.pos.z }, { x: p.x, z: p.z }) || [], t: B.t, i: 0 };
      while (RN.i < RN.pts.length - 1 && flat(H.pos, RN.pts[RN.i]) < 30) RN.i++;
      if (RN.pts.length > 1) { walkLocal(RN.pts[RN.i], { ...o, r: 2 }); return d; }
    }
    return walkLocal(p, o);
  }
  function walkLocal(p, o = {}) {
    const H = S().hero, d = flat(H.pos, p);
    const N = B.nav || (B.nav = { best: Infinity, bestT: B.t, path: null, k: 0, fails: 0 });
    const key = `${Math.round(p.x / 2)},${Math.round(p.z / 2)}`;
    if (N.key !== key) { N.key = key; N.best = d; N.bestT = B.t; N.path = null; N.fails = 0; }
    if (d <= (o.r ?? 0.8)) return d;
    if (d < N.best - 0.3) { N.best = d; N.bestT = B.t; }
    if (B.t - N.bestT > 2.5 && d > 1.2) { N.path = null; N.bestT = B.t; N.fails++; if (N.fails > 6) note(`stuckFoot:${key}`, `on foot, stuck near ${H.pos.x.toFixed(0)},${H.pos.z.toFixed(0)} going to ${p.x.toFixed(0)},${p.z.toFixed(0)}`); }
    if (o.replan && N.path && B.t - (N.planT || 0) > o.replan) N.path = null;
    if (!N.path && d > 2.5 && every('plan', 0.5)) {
      const r = findPath(H.pos, p, H.pos.y, o.cost || null); N.planT = B.t;
      N.path = r ? r.pts : [{ x: p.x, z: p.z }]; N.k = 0;
      if (r && !r.reached) note(`noPath:${key}`, `on foot, no walkable way from ${H.pos.x.toFixed(0)},${H.pos.z.toFixed(0)} to ${p.x.toFixed(0)},${p.z.toFixed(0)}`);
    }
    let tx = p.x, tz = p.z;
    if (N.path && d > 2.5) {
      while (N.k < N.path.length - 1 && flat(H.pos, N.path[N.k]) < 1.2) N.k++;
      // look ahead along the path as far as the next points stay close to the line
      tx = N.path[N.k].x; tz = N.path[N.k].z;
    }
    const slow = o.crouch ? 1 : d < 2.5 ? 0.55 : 1;
    stickTo(tx - H.pos.x, tz - H.pos.z, slow);
    if (o.sprint && d > 12 && !o.crouch) hold('Space'); // held dodge is the sprint
    return d;
  }
  function wantCrouch(on) { const H = S().hero; if (!!H.crouch !== on && every('crouch', 0.4)) tap('KeyC'); }

  /* ---------------- driving (the GPS line, pure pursuit, the pedals as keys) ---------------- */
  function plan(v, goal, o) {
    const L = B.lib, W = S().world;
    const from = o.pre || v.pos;
    let pts = o.direct ? [{ x: v.pos.x, z: v.pos.z }, { x: goal.x, z: goal.z }] : W.roads.route({ x: from.x, z: from.z }, { x: goal.x, z: goal.z });
    if (o.pre && pts) pts.unshift({ x: v.pos.x, z: v.pos.z });
    if (!pts || pts.length < 2) pts = [{ x: v.pos.x, z: v.pos.z }, { x: goal.x, z: goal.z }];
    if (o.via) pts = pts.concat(o.via.map((p) => ({ x: p.x, z: p.z })));
    return { path: new L.Path(pts), goal: { x: goal.x, z: goal.z }, t: B.t, s: 0 };
  }
  // drive the hero's vehicle to goal; o: {r, park, top, direct, via}. Returns the distance left.
  function driveTo(goal, o = {}) {
    const v = riding(); if (!v) return Infinity;
    const L = B.lib, D = B.drv || (B.drv = { p: null, stuckT: 0, backT: 0, gasAcc: 0, brakeAcc: 0, unstuck: 0 });
    const d = flat(v.pos, goal), r = o.r ?? 8;
    if (!D.p || (!D.p.fwdLeg && (flat(D.p.goal, goal) > 8 || B.t - D.p.t > 12 || (D.p.off > 22 && B.t - D.p.t > 2)))) D.p = plan(v, goal, o);
    const P = D.p.path, pr = P.project(v.pos.x, v.pos.z, D.p.s, 20, 60 + Math.abs(v.speed) * 2);
    D.p.s = pr.s; D.p.off = pr.d;
    const top = o.top ?? B.cfg.top;
    let tgt = Math.min(top, P.speedAt(D.p.s, Math.max(0, v.speed), { latA: o.latA ?? 3.5, top, decel: 3, minBend: 2.5, stopShort: o.park ? r * 0.3 : 1 }));
    if (d < r * 0.7 && (o.park || o.stop)) tgt = 0;
    if (o.speed != null) tgt = o.speed;
    if (D.p.off > 5 && !o.direct) tgt = Math.min(tgt, 7); // off the line: slow, back to the road
    else if (D.p.off > 1.5 && !o.direct) tgt = Math.min(tgt, 5);
    // wedged: back up with the wheel the other way
    if (D.backT > B.t) { hold('KeyS'); axes.steer = { x: -D.backSteer, y: 0 }; return d; }
    if (tgt > 2 && Math.abs(v.speed) < 0.6) { D.stuckT += 1 / 60; if (D.stuckT > 1.8) { D.stuckT = 0; D.unstuck++; D.backT = B.t + 1.4 + (D.unstuck % 3) * 0.8; D.backSteer = (D.unstuck % 2 ? 1 : -1) * Math.sign(v.controls.steer || 1); if (D.unstuck % 2 === 0) D.p = null; if (D.unstuck > 8) note(`stuckDrive:${goal.x | 0},${goal.z | 0}`, `the vehicle is stuck near ${v.pos.x.toFixed(0)},${v.pos.z.toFixed(0)} (driving to ${goal.x.toFixed(0)},${goal.z.toFixed(0)})`); } }
    else D.stuckT = 0;
    const fake = { speed: v.speed, spec: v.spec, toLocal: (x, z) => v.toLocal(x, z), controls: {} };
    if (!D.p) return d;
    // the way on is behind: first drive on ahead (a bridge or a narrow road has no room), then a three-point
    // turn (forward on full lock, back on the other lock) until the way is ahead
    {
      const ahead = P.at(Math.min(P.len, D.p.s + 8)), [lx, lz] = v.toLocal(ahead.x, ahead.z), ang = Math.atan2(lx, lz);
      // a hairpin just ahead (the road turns back more than 100 degrees within 14 m): crawl into it, then turn
      // on the spot (a three-point turn) once the way on is off to the side
      const h0 = P.at(D.p.s).yaw, h1 = P.at(Math.min(P.len, D.p.s + 14)).yaw, hair = Math.abs(wrap(h1 - h0)) > 1.75;
      if (hair) tgt = Math.min(tgt, 2.2);
      const behind = (Math.abs(ang) > 1.9 || (hair && Math.abs(ang) > 1.15)) && Math.abs(v.speed) < 3 && d > 12;
      // rails (or walls) close on both sides: no room to turn here
      const W = S().world, wall = (k) => { const t = W.colliders.raycast({ x: v.pos.x, y: v.pos.y + 0.8, z: v.pos.z }, { x: v.pos.x - Math.cos(v.yaw) * 6 * k, y: v.pos.y + 0.8, z: v.pos.z + Math.sin(v.yaw) * 6 * k }, { terrain: false }); return t != null && t < 1; };
      if (behind && !D.kt && !D.fwd && wall(1) && wall(-1)) {
        const f = { x: v.pos.x + Math.sin(v.yaw) * 40, z: v.pos.z + Math.cos(v.yaw) * 40 };
        D.fwd = { ...f, t: B.t };
        // (along the road ahead where there is one)
        let pts = W.roads.route({ x: v.pos.x, z: v.pos.z }, f) || [];
        if (pts.length > 2 && W.roadDist(f.x, f.z) > 5) pts.pop();
        if (pts.length < 2) pts = [{ x: v.pos.x, z: v.pos.z }, f];
        D.fwd = { ...pts[pts.length - 1], t: B.t };
        D.p = { path: new L.Path(pts), goal: { x: goal.x, z: goal.z }, t: B.t, s: 0, fwdLeg: true };
      }
      if (D.p.fwdLeg) {
        // on to the point ahead; then turn there
        if (flat(v.pos, D.fwd) < 8 || B.t - D.fwd.t > 14) { D.p = plan(v, goal, o); D.kt = { t: B.t, fwd: true, n: 0, side: 1 }; }
      } else if (D.kt || behind) {
        if (!D.kt) D.kt = { t: B.t, fwd: true, n: 0, side: Math.sign(ang) || 1 };
        const K = D.kt; K.side = Math.sign(ang) || K.side;
        if (Math.abs(ang) < 0.9 || K.n > 16) { D.kt = null; if (K.n > 16) D.fwd = null; }
        else {
          // slowly, and back the other way before the edge of the road, a drop or a wall
          const dir = K.fwd ? 1 : -1, W2 = S().world;
          const nose = { x: v.pos.x + Math.sin(v.yaw) * 3.6 * dir, z: v.pos.z + Math.cos(v.yaw) * 3.6 * dir };
          const edge = W2.roadDist(nose.x, nose.z) > 3.5 && W2.roadDist(v.pos.x, v.pos.z) < 4.5;
          const drop = v.pos.y - W2.surface(nose.x, nose.z, v.pos.y + 1) > 0.9;
          if (!K.from) K.from = { x: v.pos.x, z: v.pos.z };
          const moved = flat(v.pos, K.from);
          const blocked = B.t - K.t > 0.6 && Math.abs(v.speed) < 0.2;
          if ((moved > 0.8 && (edge || drop)) || blocked || moved > 5 || B.t - K.t > 3.5) { K.fwd = !K.fwd; K.t = B.t; K.n++; K.from = null; }
          // (+ steer is a right turn: lx > 0 is a point to the left)
          axes.steer = { x: K.fwd ? -K.side : K.side, y: 0 };
          if (Math.abs(v.speed) < 1.6) hold(K.fwd ? 'KeyW' : 'KeyS');
          else if (Math.sign(v.speed) !== dir) hold(K.fwd ? 'KeyW' : 'KeyS');
          return d;
        }
      }
      if (D.fwd && !D.kt && !D.p.fwdLeg && Math.abs(ang) < 0.9 && B.t - D.fwd.t > 3) D.fwd = null;
    }
    // (vehicles ahead in the lane: slow to their pace; a rammed target is not one of them)
    const fwd = [Math.sin(v.yaw), Math.cos(v.yaw)];
    for (const o2 of S().vehicles.list.concat((S().traffic && S().traffic.cars) || [])) {
      if (o2 === v || o2 === o.ignore || o2.gone) continue;
      const dx = o2.pos.x - v.pos.x, dz = o2.pos.z - v.pos.z, al = dx * fwd[0] + dz * fwd[1], la = Math.abs(dx * fwd[1] - dz * fwd[0]);
      if (al <= 0 || al > 10 + Math.max(0, v.speed) * 1.6 || la > v.hw + (o2.hw || 1) + 0.6) continue;
      const gap = al - v.hd - (o2.hd || 2.5), os = Math.max(0, (o2.vel ? o2.vel.x * fwd[0] + o2.vel.z * fwd[1] : 0));
      tgt = Math.min(tgt, Math.max(os > 1 ? 0 : 3, os + (gap - 3) * 0.6)); // (a parked one: slow, and nose round it)
    }
    const c = L.drive(fake, P, D.p.s, tgt, { lookBase: v.speed > 12 && v.spec.wheelbase > 3.3 ? 7 : 5 });
    D.steer = v.speed < 9 ? c.steer : (D.steer ?? c.steer) + (c.steer - (D.steer ?? c.steer)) * 0.35; // (steady at speed, sharp when slow)
    axes.steer = { x: D.steer, y: 0 };
    // the pedals are keys: pulse them to the pedal the pursuit asks for
    D.gasAcc += c.throttle; D.brakeAcc += c.brake;
    if (v.speed > tgt + 0.8) { hold('KeyS'); D.gasAcc = 0; }
    else if (D.gasAcc >= 0.5) { hold('KeyW'); D.gasAcc -= 1; }
    else if (D.brakeAcc >= 0.5 && v.speed > 0.3) { hold('KeyS'); D.brakeAcc -= 1; }
    D.gasAcc = Math.max(-1, D.gasAcc); D.brakeAcc = Math.max(-1, D.brakeAcc);
    if (tgt === 0 && Math.abs(v.speed) > 0.3) hold('KeyS');
    if (tgt === 0 && v.speed < -0.2) hold('KeyW');
    return d;
  }
  function stopVehicle() { const v = riding(); if (!v) return true; axes.steer = { x: 0, y: 0 }; if (v.speed > 0.3) hold('KeyS'); else if (v.speed < -0.3) hold('KeyW'); return Math.abs(v.speed) < 0.5; }
  function getOut() { if (!riding()) return true; if (stopVehicle() && !S().drive.anim && every('exit', 0.8)) tap('KeyE'); return false; }
  // walk to a vehicle's door and press E there
  function getIn(v, seat = 0) {
    if (riding() === v) return true;
    if (riding()) { getOut(); return false; }
    if (S().drive.anim) return false;
    const dp = v.doorPoint(seat > 0 ? 'passenger' : 'driver');
    const d = walkTo(dp, { r: 1.2, sprint: true });
    const cur = S().interact.current;
    if (d < 3 && cur && /GET IN|DRIVE|RIDE/i.test(cur.label || '') && every('enter', 0.6)) tap('KeyE');
    else if (d < 1.4 && every('enterAny', 1.5)) tap('KeyE');
    return false;
  }

  /* ---------------- the phone camera ---------------- */
  // subject points: the same three the scorer uses (feet, middle, head or top)
  function subjectPoint(sub) {
    if (!sub) return null;
    const a = sub.fighter ? sub.fighter.a : sub.actor;
    if (a && a.root) { const r = a.root.position; return { x: r.x, y: r.y + 1.1, z: r.z, h: 1.8, face: a.root.rotation.y, kind: sub.kind }; }
    if (sub.vehicle) return { x: sub.vehicle.pos.x, y: sub.vehicle.pos.y + 1.2, z: sub.vehicle.pos.z, h: 2.2, kind: sub.kind };
    if (sub.point) return { x: sub.point.x, y: sub.point.y + (sub.h || 3) * 0.5, z: sub.point.z, h: sub.h || 3, kind: sub.kind };
    if (sub.group && sub.group[0]) { const r = sub.group[0].root.position; return { x: r.x, y: r.y + 1.1, z: r.z, h: 1.8, kind: 'face' }; }
    return null;
  }
  const photoSt = () => MS().photo.st;
  // aim the open camera at a point; returns true once the view is on it and still
  function aim(p, yawTo, pitchTo) {
    const st = photoSt(), dt = 1 / 60, rate = 1.25 / Math.sqrt(st.zoom);
    let ey, ep;
    if (p) { const cp = S().camera.position; ey = wrap(Math.atan2(p.x - cp.x, p.z - cp.z) - st.yaw); ep = Math.atan2(p.y - cp.y, Math.hypot(p.x - cp.x, p.z - cp.z)) - st.pitch; }
    else { ey = wrap(yawTo - st.yaw); ep = pitchTo - st.pitch; }
    const lx = clamp(-ey / (rate * dt) * 0.25, -1, 1), ly = clamp(-ep / (rate * 0.8 * dt) * 0.25, -1, 1);
    axes.look = { x: Math.abs(ey) < 0.004 ? 0 : lx, y: Math.abs(ep) < 0.004 ? 0 : ly };
    return Math.abs(ey) < 0.02 && Math.abs(ep) < 0.03;
  }
  // take the photo the step asks for: open the camera, aim, zoom, wait for the score, shutter.
  // Walks closer (or around to the face) when the score will not come. Returns 'shot' after a shutter.
  function photograph(sub, min, o = {}) {
    const H = S().hero, st = photoSt(), P = subjectPoint(sub);
    const C = B.cam || (B.cam = { t0: B.t, openT: 0, moves: 0, still: 0, shots: 0, walkT: 0 });
    if (!P) return 'none';
    if (C.walkT > B.t) {
      if (st.active) { if (every('camClose', 0.5)) tap('KeyV'); return 'walk'; }
      if (o.stay) { C.walkT = 0; return 'walk'; }
      if (riding()) { getOut(); return 'walk'; }
      // somewhere to shoot from: the way a player looks around for a clear view. Closer for a small subject,
      // in front for a face, and with a clear line to the subject
      if (!C.spot) {
        const W = S().world, want = o.dist ?? (P.kind === 'place' ? 25 : 7);
        const clear = (x, z) => { const y = W.surface(x, z, H.pos.y + 2) + 1.6, t = W.colliders.raycast({ x, y, z }, { x: P.x, y: P.y, z: P.z }), len = Math.hypot(P.x - x, P.y - y, P.z - z); return t == null || t * len > len - 0.8; };
        let best = null;
        for (const rr of [want, want * 2, want * 3.5, 60]) for (let k = 0; k < 16; k++) {
          const a = (P.kind === 'face' && P.face != null ? P.face : Math.atan2(H.pos.x - P.x, H.pos.z - P.z)) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
          const x = P.x + Math.sin(a) * rr, z = P.z + Math.cos(a) * rr;
          if (P.kind === 'face' && Math.abs(wrap(a - (P.face ?? a))) > 1) continue;
          if (!clear(x, z)) continue;
          const cost = flat(H.pos, { x, z }) + rr * 0.3;
          if (!best || cost < best.cost) { const r = findPath(H.pos, { x, z }, H.pos.y); if (r && r.reached) best = { x, z, cost }; }
        }
        C.spot = best || { x: P.x + Math.sin(Math.atan2(H.pos.x - P.x, H.pos.z - P.z)) * want, z: P.z + Math.cos(Math.atan2(H.pos.x - P.x, H.pos.z - P.z)) * want };
      }
      if (walkTo(C.spot, { r: 1.5, crouch: o.crouch }) < 2) { C.walkT = 0; C.spot = null; }
      return 'walk';
    }
    if (!st.active) { if (!riding() || Math.abs(riding().speed) < 1) { if (riding() && riding().speed > 0.3) stopVehicle(); if (every('camOpen', 0.6)) tap('KeyV'); } else stopVehicle(); C.openT = B.t; return 'open'; }
    const on = aim({ x: P.x, y: P.y, z: P.z });
    const sc = st.score ?? 0;
    const small = /Too far/.test(st.note || '');
    if (on && small && st.zoom < 7.5) hold('KeyE'); // zoom in
    C.still = on && axes.look.x === 0 && axes.look.y === 0 ? C.still + 1 : 0;
    if (on && sc >= min && C.still > 12 && every('shutter', 0.7)) { tap('Space'); C.shots++; return 'shot'; }
    if (B.t - C.openT > (o.patience ?? 5) && !o.stay) {
      C.moves++; C.walkT = B.t + 20; C.openT = B.t;
      if (C.moves > 3) note(`photo:${B.stepKey}`, `photo: the score stays at ${Math.round(sc)} (needs ${min}); note "${st.note}"`);
    }
    return 'aim';
  }

  /* ---------------- fighting ---------------- */
  const live = (f) => f && !f.downed && !f.gone && !f.tied;
  // seconds (real) until a foe's next hit window opens, or null
  function hitIn(f) {
    if (f.state !== 'attack' || !f.atk || f.nextHit == null) return null;
    const sp = f.atk.spec, spd = (sp.speed || 1) * 0.9 * (f.speedK || 1);
    return (f.nextHit - (f.clipT || 0)) / spd;
  }
  // The hero's fighting: read each swing and deflect it (hold parry from just before it lands until it has),
  // roll away from grabs and unblockables, hit back after a deflect and while they recover, finish a broken
  // posture, drink when low and clear, fight one at a time with the lock.
  function fight(o = {}) {
    const s = S(), H = s.hero, C = s.combat, list = (C.enemies || []).filter(live);
    const F = B.fight || (B.fight = { hits: 0, guardT: -9, lastDefl: -9, parryFor: null });
    if (riding()) { getOut(); return; }
    wantCrouch(false);
    // a downed boss: hold E on him (TIE)
    const boss = (C.enemies || []).find((f) => f.boss && f.downed && !f.tied && !f.gone);
    if (boss && o.tie !== false) {
      const d = walkTo(boss.pos, { r: 1.3 });
      if (d < 2.2) hold('KeyE');
      return;
    }
    if (o.guard) { const g = o.guard; if (flat(H.pos, g) > (o.guardR || 7)) { walkTo(g, { r: 2 }); return; } }
    if (!list.length) { if (o.home) walkTo(o.home, { r: 3 }); return; }
    const near = (f) => flat(H.pos, f.pos) - (f.radius || 0.4);
    // incoming: the soonest swing that can reach
    let threat = null;
    for (const f of list) {
      const t = hitIn(f); if (t == null) continue;
      const sp = f.atk.spec, sh = sp.hits && sp.hits[0] && sp.hits[0][2], reach = sh ? (sh.reach ?? (sh.aoe ? sh.aoe[0] + sh.aoe[1] : 2.5)) : 2.5;
      const lunge = sp.lunges ? 2.5 : 0, leap = sp.leap ? (sp.leapMax || 8) : 0;
      if (near(f) > reach + lunge + leap + 1) continue;
      if (!threat || t < threat.t) threat = { f, t, sp };
    }
    if (threat) {
      const { f, t, sp } = threat;
      if (sp.grab || sp.unblock) {
        if (t < 0.42 && t > -0.05 && every('dodge', 0.6)) { stickTo(H.pos.x - f.pos.x, H.pos.z - f.pos.z); tap('Space'); }
        stickTo(H.pos.x - f.pos.x, H.pos.z - f.pos.z, 0.6);
        return;
      }
      // hold the guard from 0.2 s before the blow until it has passed (a deflect inside the window, else a block)
      if (t < 0.2 && t > -0.15) { stickTo(f.pos.x - H.pos.x, f.pos.z - H.pos.z, 0.05); if (F.parryFor !== f.atk) { F.parryFor = f.atk; F.guardT = B.t; } if (B.t - F.guardT < 0.45) hold('KeyF'); return; }
      if (t < 0.55) { stickTo(f.pos.x - H.pos.x, f.pos.z - H.pos.z, 0.05); return; } // wait for it; never swing into it
    }
    // a sip when life is low and nobody is close
    const closest = list.reduce((a, b) => (near(b) < near(a) ? b : a));
    if (H.hp < H.maxHp * 0.45 && H.canteen > 0 && near(closest) > 3.2 && every('canteen', 2.5)) { tap('KeyR'); return; }
    if (H.hp < H.maxHp * 0.45 && H.canteen > 0 && near(closest) < 3.2) { stickTo(H.pos.x - closest.pos.x, H.pos.z - closest.pos.z); return; } // back off to drink
    // the target: a broken posture first, then whoever is in the middle of a recovery, then the nearest
    const open = (f) => ['broken', 'recoil', 'hit', 'stagger', 'recover'].includes(f.state);
    const tgt = list.find((f) => f.state === 'broken' && near(f) < 6) || list.filter(open).sort((a, b) => near(a) - near(b))[0] || closest;
    const d = near(tgt);
    if (S().test.combat.lock() !== tgt.id && every('lock', 0.8)) tap('Tab');
    if (d > 1.7) { walkTo(tgt.pos, { r: 1.3 }); return; }
    stickTo(tgt.pos.x - H.pos.x, tgt.pos.z - H.pos.z, 0.15);
    if (tgt.state === 'broken') { if (every('light', 0.25)) tap('KeyJ'); return; }
    // swing when it is open, or when it is idle and nothing is coming; a heavy now and then
    const busyFoe = tgt.state === 'attack' && hitIn(tgt) != null && hitIn(tgt) < 0.9;
    if (!busyFoe && every('light', 0.3)) { F.hits++; tap(F.hits % 6 === 5 && open(tgt) ? 'KeyK' : 'KeyJ'); }
  }
  B.fightNow = fight;

  /* ---------------- one step, by type ---------------- */
  function goalOf(ids) { for (const id of ids) { const m = mk(id); if (m) return m; } return null; }
  const place = (id) => S().world.place(id);
  function footOrDrive(g, r, mode) {
    const H = S().hero, far = flat(heroAt(), g);
    const v = S().vehicles.player;
    if (mode === 'foot' || far < 120 || !v || v.wrecked) { if (riding()) { getOut(); return; } walkTo(g, { r: Math.max(0.6, r * 0.6), sprint: true }); return; }
    if (riding() !== v) { getIn(v, 0); return; }
    driveTo(g, { r: Math.max(6, r) });
    void H;
  }
  // how much a guard's view covers p (0 none, 1 inside a cone within its range), with a margin in meters
  function danger(p, margin = 0.5) {
    const s = S(), SI = s.test.combat.SIGHT, night = s.stealth.night, ink = s.stealth.deepInk || (s.look && s.look.name === 'DEEP_INK') ? 0.5 : 1;
    let out = 0;
    for (const w of s.stealth.list || []) {
      const f = w.f; if (!f || f.downed || f.gone || f.tied) continue;
      const d = flat(f.pos, p), bearing = Math.abs(wrap(Math.atan2(p.x - f.pos.x, p.z - f.pos.z) - f.face));
      let range = 0;
      if (bearing <= SI.cone / 2 + 0.2) range = (night ? SI.night : SI.day) * ink;
      if ((w.flashlight) && bearing <= SI.flashCone / 2 + 0.15) range = Math.max(range, SI.flash * ink);
      if (range && d < range * 0.75 + margin) out = Math.max(out, 1 - d / (range + margin + 1));
    }
    return out;
  }
  // the nearest spot 2 to 5 m away that no guard watches
  function safeStep(p) {
    let best = null;
    for (const r of [2, 3.5, 5]) for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, q = { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r };
      if (danger(q, 1) > 0) continue;
      const W = S().world, y = W.surface(q.x, q.z, S().hero.pos.y + 0.6);
      if (!Number.isFinite(y) || Math.abs(y - S().hero.pos.y) > 1.2 || W.colliders.resolveCircle({ x: q.x, z: q.z }, 0.4, y)) continue;
      return q;
    }
    return best;
  }
  const HANDLERS = {
    cine() {}, talk() {}, card() {}, wait() {}, set() {}, choice() {},
    goto(st) { const g = mk('m:goal'); if (!g) return; footOrDrive(g, g.r || 4, st.mode); },
    enter(st, m) {
      const v = st.vehicle && st.vehicle !== 'player' ? m.get(st.vehicle) : S().vehicles.player;
      if (!v) { note(`enter:${B.stepKey}`, 'enter: no vehicle'); return; }
      getIn(v, st.seat || 0);
    },
    exit() { getOut(); },
    drive(st, m) {
      const v = st.vehicle && st.vehicle !== 'player' ? m.get(st.vehicle) : S().vehicles.player;
      if (v && riding() !== v) { getIn(v, 0); return; }
      const g = mk('m:goal'); if (!g) return;
      const last = g.kind !== 'waypoint';
      driveTo(g, { r: last ? (g.r || 8) : 12, park: last && !!st.park, stop: last, top: B.cfg.top });
    },
    photo(st, m) {
      if (st.match) {
        const r = MS().photo.P.reference(st.match); if (!r) return;
        const ps = photoSt();
        if (riding()) { getOut(); return; }
        if (!ps.active) { if (walkTo(r, { r: 0.9 }) > 1.2) return; if (every('camOpen', 0.6)) tap('KeyV'); return; }
        if (aim(null, r.yaw, r.pitch || 0) && every('shutter', 0.8)) tap('Space');
        return;
      }
      if (st.kind === 'timer') {
        // prop the phone facing the crew, start the timer, run into the picture
        const ps = photoSt(), grp = MS().photo.subjects.get('ms:crew'), H = S().hero;
        const pts = grp && grp.group ? grp.group.filter((a) => a !== H.actor).map((a) => a.root.position) : [];
        const c = pts.length ? { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts[0].y + 1.2, z: pts.reduce((a, p) => a + p.z, 0) / pts.length } : null;
        if (riding()) { getOut(); return; }
        if (!ps.active) {
          if (c && flat(H.pos, c) < 5) { walkTo({ x: c.x + (H.pos.x - c.x) * 3, z: c.z + (H.pos.z - c.z) * 3 }, { r: 1 }); return; } // step back first
          if (every('camOpen', 0.8)) tap('KeyV'); return;
        }
        if (ps.countdown != null) { if (c) walkTo(c, { r: 1.2 }); return; }
        if (!c || aim(c)) { if (every('shutter', 1)) tap('Space'); }
        return;
      }
      const subs = [...MS().photo.subjects.entries()].filter(([id]) => id.startsWith('ms:'));
      if (!subs.length) { note(`photoNoSubject:${B.stepKey}`, `photo step with subject ${JSON.stringify(st.subject)} (${st.kind}) has no photo subject: nothing to aim at`); if (!photoSt().active && every('camOpen', 1)) tap('KeyV'); else if (every('shutter', 1.2)) tap('Space'); return; }
      const sub = subs[0][1];
      photograph(sub, st.min ?? 50, { stay: riding() && S().drive.heroSeat > 0 });
    },
    tail(st, m) {
      const tv = m.get(st.target); if (!tv) return;
      if (riding() !== S().vehicles.player) { getIn(S().vehicles.player, 0); return; }
      const d = flat(heroAt(), tv.pos);
      const want = 60, sp = clamp(Math.abs(tv.speed) + (d - want) * 0.25, 0, 22);
      driveTo(tv.pos, { r: 4, speed: d < 35 ? 0 : sp });
    },
    lose(st, m) {
      const list = [].concat(st.pursuers).map((r) => m.get(r)).filter(Boolean);
      if (riding() !== S().vehicles.player) { getIn(S().vehicles.player, 0); return; }
      // the far end of the map from them, along the roads
      if (!B.loseGoal) { const h = heroAt(); const c = list.reduce((a, v) => ({ x: a.x + v.pos.x / list.length, z: a.z + v.pos.z / list.length }), { x: 0, z: 0 }); const ends = ['diner', 'airport_overlook', 'uptown', 'schnebly_vista', 'red_rock_crossing', 'aframe', 'midgley_lot', 'motel', 'gas'].map(place).filter(Boolean).filter((q) => flat(q, h) > 150); B.loseGoal = ends.reduce((a, b) => (flat(b, c) - flat(b, h) * 0.3 > flat(a, c) - flat(a, h) * 0.3 ? b : a)); }
      if (driveTo(B.loseGoal, { r: 20, top: 30 }) < 40) B.loseGoal = null; // there: on to the next far place
    },
    chase(st, m) {
      const tv = m.get(st.target); if (!tv) return;
      if (st.goal === 'takedown') { fight({}); return; }
      if (riding() !== S().vehicles.player) { getIn(S().vehicles.player, 0); return; }
      const v = riding(), d = flat(v.pos, tv.pos);
      if (st.goal === 'disable') {
        // catch up on the roads; alongside its rear quarter, match its speed, then turn into it (a PIT)
        if (d > 45) { driveTo(tv.pos, { r: 0, top: 30, ignore: tv }); return; }
        // it has stopped: back off and ram it (a ram counts above 3 m/s)
        if (Math.abs(tv.speed) < 1.5) {
          const R = B.ram || (B.ram = { backT: 0 });
          if (R.backT > B.t) { hold('KeyS'); axes.steer = { x: 0, y: 0 }; return; }
          if (d < 7.5 && Math.abs(v.speed) < 1.5 && every('ramBack', 2.5)) { R.backT = B.t + 1.6; return; }
          driveTo(tv.pos, { direct: true, r: 0, speed: 9, ignore: tv });
          return;
        }
        const f = [Math.sin(tv.yaw), Math.cos(tv.yaw)], rt = [-Math.cos(tv.yaw), Math.sin(tv.yaw)];
        const rx = v.pos.x - tv.pos.x, rz = v.pos.z - tv.pos.z, along = rx * f[0] + rz * f[1], lat = rx * rt[0] + rz * rt[1];
        const side = B.pitSide || (B.pitSide = Math.sign(lat) || 1);
        const want = { along: -tv.hd * 0.9 - v.hd * 0.1, lat: side * (tv.hw + v.hw + 0.9) };
        const inPlace = Math.abs(along - want.along) < 1.6 && Math.abs(lat - want.lat) < 1.4;
        const push = B.pitT && B.t - B.pitT < 1.2;
        if (inPlace && !push) B.pitT = B.t;
        // the protected van: never with it close in front of the pickup
        const pv = (st.protect && m.get(st.protect)) || null;
        const clearAhead = !pv || flat(pv.pos, tv.pos) > 16;
        let gx = tv.pos.x + f[0] * (want.along + 8) + rt[0] * want.lat, gz = tv.pos.z + f[1] * (want.along + 8) + rt[1] * want.lat;
        if (push && clearAhead) { gx = tv.pos.x + f[0] * (want.along + 6) - rt[0] * side * 1.5; gz = tv.pos.z + f[1] * (want.along + 6) - rt[1] * side * 1.5; }
        const sp = Math.max(0, tv.speed + clamp((want.along - along) * 0.8, -4, 7) + (push && clearAhead ? 2.5 : 0));
        driveTo({ x: gx, z: gz }, { direct: true, r: 0, speed: sp, top: 30, ignore: tv });
        return;
      }
      if (st.goal === 'stop' || st.goal === 'boxIn') {
        const sp = d < 14 ? 0 : clamp(Math.abs(tv.speed) + (d - 20) * 0.3, 0, 14);
        driveTo(tv.pos, { r: 4, speed: sp });
        return;
      }
      driveTo(tv.pos, { r: 2, top: 30 });
    },
    race(st, m) {
      const v = m.get(st.vehicle) || S().vehicles.player;
      if (riding() !== v) { getIn(v, 0); return; }
      const g = mk('m:gate'), g2 = mk('m:gate2'); if (!g) return;
      driveTo(g, { r: 0, via: g2 ? [g2] : null, top: 26 });
    },
    fight(st) { fight({ tie: st.until !== 'half' }); },
    defend(st) { const p = mk('m:protect'); fight({ guard: p, guardR: 8, home: p }); },
    stealth(st) {
      if (riding()) { getOut(); return; }
      const s = S();
      if (s.combat.active && (s.combat.enemies || []).some((f) => live(f) && f.alert)) { fight({}); return; }
      const g = mk('m:goal');
      wantCrouch(true);
      const H = s.hero;
      if (g) {
        // keep out of every view: plan around the cones, wait while the next stretch is watched, and step out
        // of a cone the moment suspicion starts to rise
        const here = danger(H.pos), lvl = s.stealth.level ? s.stealth.level() : 0;
        if (here > 0 && lvl > 0.15) { const out = safeStep(H.pos); if (out) { walkTo(out, { r: 0.3, crouch: true }); return; } }
        const N = B.nav, path = N && N.path, k = N ? N.k : 0;
        const next = path && path[Math.min(path.length - 1, k + 1)];
        if (next && danger(next) > 0 && here === 0 && B.t - (B.waitT0 || B.t) < 8) { if (!B.waitT0) B.waitT0 = B.t; if (every('stealthReplan', 1.5)) B.nav.path = null; return; }
        B.waitT0 = 0;
        walkTo(g, { r: Math.max(0.8, (g.r || 3) * 0.5), crouch: true, cost: (x, z) => danger({ x, z }, 1.5) * 25, replan: 2 });
        return;
      }
      // no goal: take each guard down from behind, coming in out of its view
      const gs = (s.stealth.list || []).map((w) => w.f || w).filter(live);
      if (!gs.length) return;
      const f = gs.reduce((a, b) => (flat(b.pos, H.pos) < flat(a.pos, H.pos) ? b : a));
      const back = { x: f.pos.x - Math.sin(f.face) * 1.1, z: f.pos.z - Math.cos(f.face) * 1.1 };
      const d = walkTo(back, { r: 0.5, crouch: true, cost: (x, z) => danger({ x, z }, 1) * 25, replan: 1 });
      const cur = s.interact.current;
      if (cur && /takedown/.test(cur.id || '') && every('takedown', 0.5)) tap('KeyE');
      else if (d < 1.2 && every('light', 0.5)) tap('KeyJ');
    },
    interact(st) {
      const u = mk('m:use'); if (!u) return;
      if (riding()) { getOut(); return; }
      if (st.watchers) wantCrouch(true);
      const d = walkTo(u, { r: 0.9, crouch: !!st.watchers });
      if (d < 2.2) hold('KeyE');
    },
    escort(st) {
      if (st.drive) {
        const g = mk('m:goal');
        const v = riding(); if (!v) { const w = S().vehicles.player; const o = MS().current.get(st.vehicle); getIn(o || w, 0); return; }
        if (g) driveTo(g, { r: (g.r || 12) * 0.6, stop: true, park: true, top: 13, latA: 2.5 });
        return;
      }
      const c = mk('m:cover');
      if (c) { const d = walkTo(c, { r: 1.5 }); const cur = S().interact.current; if (d < 3.5 && cur && /SIGNAL/.test(cur.label || '') && every('signal', 1)) tap('KeyE'); return; }
      const g = mk('m:goal'); if (g) walkTo(g, { r: 2 });
    },
    collect(st) {
      if (riding()) { getOut(); return; }
      const clues = markers().filter((m) => m.id.startsWith('m:clue:'));
      if (!clues.length) return;
      const H = S().hero, c = clues.reduce((a, b) => (flat(b, H.pos) < flat(a, H.pos) ? b : a));
      if (st.photo) {
        const sub = MS().photo.subjects.get(`clue:${c.id.slice(7)}`);
        const r = photograph(sub, (st.items || []).find((it) => `m:clue:${it.id}` === c.id)?.min ?? st.min ?? 45, { dist: 14 });
        if (r === 'shot') B.cam = null;
        return;
      }
      const d = walkTo(c, { r: 0.8 });
      const cur = S().interact.current;
      if (cur && /^clue:/.test(cur.id || '') && every('clue', 0.8)) tap('KeyE');
      else if (d < 1.2 && every('clueNo', 5)) note(`clueNoPrompt:${c.id}`, `collect: at ${c.id} but the prompt is ${cur ? cur.label : 'none'}`);
    },
    stakeout() { const z = mk('m:zone'); if (z && flat(heroAt(), z) > (z.r || 10) * 0.6) footOrDrive(z, z.r || 10); else if (riding()) stopVehicle(); },
    script(st, m) {
      const fn = st.fn;
      if (fn === 'hangover') { if (every('canteen', 1.5)) tap('KeyR'); return; }
      if (fn === 'rockVan') { const ph = meterDot('ROCK'); if (ph != null && ph >= 0.8 && every('rock', 0.5)) tap('KeyW'); return; }
      if (fn === 'bridgeDrift') { const a = place(st.args.from), b = place(st.args.to); if (a && b) { const L = flat(a, b) || 1; driveTo({ x: b.x + (b.x - a.x) / L * 30, z: b.z + (b.z - a.z) / L * 30 }, { r: 8, top: 16 }); } return; } // (right across: off the deck before turning round)
      if (fn === 'credits') { if (S().test.credits && S().test.credits.atEnd && every('credits', 1)) tap('Enter'); return; }
      if (riding() && S().drive.heroSeat === 0) stopVehicle();
      void m;
    },
  };

  /* ---------------- the tick ---------------- */
  B.tick = function tick() {
    const s = S();
    releaseTaps();
    want = new Set(); axes = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, steer: { x: 0, y: 0 } };
    B.t += 1 / 60;
    try { run(s); } catch (e) { note(`botError:${e.message}`, `bot error: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`); }
    flush();
  };
  function run(s) {
    if (B.custom) { B.custom(); return; }
    if (MS().failReq) B.lastFail = MS().failReq;
    if (!s || !s.hero || s.mode === 'boot') { B.state = 'boot'; return; }
    if (s.mode === 'credits') { B.state = 'credits'; if (s.test.credits && s.test.credits.atEnd && every('credits', 1)) tap('Enter'); return; }
    if (s.ui.menu && s.ui.menu.isOpen) { B.state = 'menu'; if (every('menuEsc', 0.5)) tap('Escape'); return; }
    // cards, dialogue and choices: read, then press on
    if (s.modal) {
      B.modalT += 1 / 60;
      const card = s.test.ui.card;
      if (card !== 'MISSION FAILED') B.failSeen = false;
      B.state = `modal:${s.modal}:${card || ''}`;
      if (card === 'MISSION FAILED') {
        if (!B.failSeen) { B.failSeen = true; B.fails.push({ step: B.stepKey, t: +B.t.toFixed(1), reason: B.lastFail || '?' }); }
        if (B.modalT > 1.2 && every('retry', 1)) tap('Enter');
        return;
      }
      if (s.modal === 'choice' || (s.test.ui.focus && s.modal === 'card' && /CHOICE/.test(card || ''))) {
        const want = B.cfg.choice | 0;
        if (B.modalT > 0.6) { if ((B.choiceMoved | 0) < want && every('choiceMove', 0.3)) { tap('ArrowDown'); B.choiceMoved = (B.choiceMoved | 0) + 1; } else if ((B.choiceMoved | 0) >= want && every('choose', 0.8)) { tap('Enter'); B.choiceMoved = 0; } }
        return;
      }
      if (B.modalT > 0.7 && every('advance', 0.7)) tap('Enter');
      return;
    }
    B.modalT = 0; B.failSeen = false;
    if (s.cine && s.cine.active) { B.state = `cine:${(s.cine.id || '')}`; if (B.cfg.skipCines) hold('Space'); return; }
    if (s.film && s.film.active) { B.state = 'film'; hold('Space'); return; }
    const cur = stepNow();
    if (!cur) {
      // free roam: walk (or drive) to the next chapter's giver
      if (photoSt().active) { if (every('camClose', 0.5)) tap('KeyV'); return; }
      const g = mk('roam:giver') || (B.cfg.roamTo ? B.cfg.roamTo : null);
      B.state = g ? (g === B.cfg.roamTo ? `roam:to:${g.id || ''}` : 'roam:giver') : 'roam';
      if (g) {
        footOrDrive(g, 2, flat(heroAt(), g) < 100 ? 'foot' : 'any');
        const cur = s.interact.current;
        if (flat(heroAt(), g) < 4 && cur && /^START$/.test(cur.label || '') && every('start', 1)) tap('KeyE');
      }
      return;
    }
    const key = `${cur.id}#${cur.i}:${cur.s.type}${cur.s.fn ? ':' + cur.s.fn : ''}`;
    if (key !== B.stepKey) { B.stepKey = key; B.stepT = B.t; B.nav = null; B.drv = null; B.cam = null; B.fight = null; B.loseGoal = null; B.pitSide = null; B.pitT = null; B.ram = null; if (!['photo', 'collect'].includes(cur.s.type) && photoSt().active) tap('KeyV'); }
    B.state = key;
    // a photo left open from a step before
    if (photoSt().active && !['photo', 'collect'].includes(cur.s.type)) { if (every('camClose', 0.5)) tap('KeyV'); return; }
    const h = HANDLERS[cur.s.type];
    if (h) h(cur.s, cur.m);
  }
})();
