// js/story/vehicles/drivers.js : mission drivers (design 4.1) and the path following they share with
// traffic and the autopilot. Each driver is a controller on one vehicle: every 'ai' tick it writes the
// vehicle's controls (throttle, brake, steer, handbrake); the physics runs them in the next tick.
// - Path: a polyline with arc lengths and curvature. follow() steers by pure pursuit (look-ahead 8 + 0.6 v)
//   and plans speed from the curvature ahead (no faster than the grip allows through a bend, braking
//   early enough to make it) and from the end of the path.
// - S.drivers: route (follow points), tail (10-16 m/s, stops at crossings, notices a vehicle within 18 m
//   for 4 s), convoy (18 m gaps), pursue (side rams, 2 s cooldown), flee, race (rubber band +-10 %), stop.
// Every call returns a handle { v, kind, done, stop(), ... }; a new driver on a vehicle replaces its old one.
import { steerMax } from './specs.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* ------------------------------------------------------------------ paths */
export class Path {
  constructor(points = []) { this.x = []; this.z = []; this.cum = []; this.k = []; this.kDone = 1; this.extend(points); }
  get len() { return this.cum.length ? this.cum[this.cum.length - 1] : 0; }
  get n() { return this.x.length; }
  extend(points) {
    for (const p of points) {
      const n = this.x.length;
      if (n && Math.hypot(p.x - this.x[n - 1], p.z - this.z[n - 1]) < 0.8) continue;
      this.x.push(p.x); this.z.push(p.z);
      this.cum.push(n ? this.cum[n - 1] + Math.hypot(p.x - this.x[n - 1], p.z - this.z[n - 1]) : 0);
      this.k.push(0);
    }
    // curvature once the points 4 m either side exist: a small jog between close points is not a bend
    const B = 4;
    for (let i = this.kDone; i < this.x.length - 1; i++) {
      let j = i - 1; while (j > 0 && this.cum[i] - this.cum[j] < B) j--;
      let k = i + 1; while (k < this.x.length - 1 && this.cum[k] - this.cum[i] < B) k++;
      if (this.cum[k] - this.cum[i] < B) { this.kDone = i; break; } // wait for the points ahead
      const a0 = Math.atan2(this.x[i] - this.x[j], this.z[i] - this.z[j]), a1 = Math.atan2(this.x[k] - this.x[i], this.z[k] - this.z[i]);
      this.k[i] = Math.abs(wrap(a1 - a0)) / ((this.cum[k] - this.cum[j]) / 2 || 1);
      this.kDone = i + 1;
    }
  }
  // the point and heading at arc length s
  at(s, out = {}) {
    const n = this.x.length;
    if (!n) { out.x = 0; out.z = 0; out.yaw = 0; return out; }
    if (n === 1) { out.x = this.x[0]; out.z = this.z[0]; out.yaw = 0; return out; }
    s = clamp(s, 0, this.len);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= s) lo = m; else hi = m; }
    const seg = this.cum[hi] - this.cum[lo] || 1, t = (s - this.cum[lo]) / seg;
    out.x = this.x[lo] + (this.x[hi] - this.x[lo]) * t; out.z = this.z[lo] + (this.z[hi] - this.z[lo]) * t;
    out.yaw = Math.atan2(this.x[hi] - this.x[lo], this.z[hi] - this.z[lo]); out.i = lo;
    return out;
  }
  // the arc length nearest (x, z), searched from s0 - back to s0 + ahead
  project(x, z, s0 = 0, back = 20, ahead = 60) {
    const n = this.x.length; if (n < 2) return { s: 0, d: n ? Math.hypot(x - this.x[0], z - this.z[0]) : 0 };
    let best = { s: s0, d: Infinity };
    let i0 = 0; { let lo = 0, hi = n - 1; const t = Math.max(0, s0 - back); while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= t) lo = m; else hi = m; } i0 = lo; }
    for (let i = i0; i < n - 1 && this.cum[i] <= s0 + ahead; i++) {
      const ax = this.x[i], az = this.z[i], dx = this.x[i + 1] - ax, dz = this.z[i + 1] - az, L2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { s: this.cum[i] + Math.sqrt(L2) * t, d };
    }
    return best;
  }
  // drop points more than `keep` meters behind s (long traffic paths stay small); returns the arc removed
  trim(s, keep = 40) {
    let k = 0; while (k < this.x.length - 2 && this.cum[k + 1] < s - keep) k++;
    if (k < 8) return 0;
    const cut = this.cum[k];
    this.x.splice(0, k); this.z.splice(0, k); this.k.splice(0, k); this.cum.splice(0, k); this.kDone = Math.max(1, this.kDone - k);
    for (let i = 0; i < this.cum.length; i++) this.cum[i] -= cut;
    return cut;
  }
  // the fastest safe speed at arc length s: every bend ahead within reach, and the end if stopEnd
  speedAt(s, v, o) {
    const latA = o.latA ?? 4.5, dec = o.decel ?? 5, top = o.top ?? 30;
    let want = top;
    const horizon = s + v * v / (2 * dec) + 25;
    let lo = 0, hi = this.x.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= s) lo = m; else hi = m; }
    for (let i = Math.max(1, lo); i < this.x.length - 1 && this.cum[i] <= horizon; i++) {
      // (never slower than a walking pace through a bend: a kink at a junction is taken slowly, not crept)
      const k = Math.max(this.k[i], 1e-4), vk = Math.max(o.minBend ?? 3, Math.sqrt(latA / k)), d = Math.max(0, this.cum[i] - s);
      want = Math.min(want, Math.sqrt(vk * vk + 2 * dec * d));
    }
    if (o.stopEnd !== false) { const d = Math.max(0, this.len - s - (o.stopShort ?? 2)); want = Math.min(want, Math.sqrt(2 * dec * 0.8 * d)); }
    return want;
  }
}
/* ------------------------------------------------------------------ steering and speed */
// Pure pursuit toward the path point Ld = 8 + 0.6 v ahead of s: the arc through it has curvature
// 2 lx / d^2 (lx: the point's offset to the left), so the wheel angle is atan(2 L lx / d^2). A point behind
// gets full lock toward its side. Then a speed controller for the target speed.
export function drive(v, path, s, target, o = {}) {
  const vf = v.speed, sp = v.spec, Ld = (o.lookBase ?? 8) + 0.6 * Math.abs(vf);
  const p = path.at(Math.min(path.len, s + Ld));
  const [lx, lz] = v.toLocal(p.x + (o.aimX || 0), p.z + (o.aimZ || 0));
  const d2 = lx * lx + lz * lz;
  const delta = lz > 0.5 ? Math.atan(2 * sp.wheelbase * lx / Math.max(d2, 16)) : Math.sign(lx || 1) * 0.6; // + is a left turn
  const c = v.controls;
  c.steer = clamp(-delta / Math.max(0.05, steerMax(sp, vf)), -1, 1);
  const err = target - vf;
  if (err > 0.15) { c.throttle = clamp(err * 0.55 + 0.15, 0, 1); c.brake = 0; }
  else if (err < -0.4) { c.throttle = 0; c.brake = target < 0.5 ? 1 : clamp(-err * 0.3, 0.05, 1); }
  else { c.throttle = target > 0.5 ? clamp(0.12 + err * 0.4, 0, 1) : 0; c.brake = target <= 0.2 ? 1 : 0; }
  c.handbrake = false; c.reverse = false;
  return c;
}

/* ------------------------------------------------------------------ S.drivers */
export function createDrivers(S, V) {
  const handles = new Set();
  const nowT = () => S.time;
  const toPoint = (p) => (typeof p === 'string' ? S.world.place(p) : p);
  // a points list, or a destination (place id or {x,z}) routed over the roads from the vehicle
  // the last hop of a road route runs off the road to the place itself: drop it when a wall or rail is in
  // the way (the vehicle stops at the road instead)
  function trimBlocked(pts) {
    if (pts.length < 3) return pts;
    const a = pts[pts.length - 2], b = pts[pts.length - 1], W = S.world;
    if (W.roadDist(b.x, b.z) < 6) return pts;
    const t = W.colliders.raycast({ x: a.x, y: W.surface(a.x, a.z) + 1, z: a.z }, { x: b.x, y: W.surface(b.x, b.z) + 1, z: b.z }, { terrain: false });
    if (t != null && t < 0.98) pts.pop();
    return pts;
  }
  function pathOf(v, points, o = {}) {
    let pts;
    if (Array.isArray(points)) pts = points.map(toPoint).filter(Boolean).map((p) => ({ x: p.x, z: p.z }));
    else { const to = toPoint(points); pts = to ? trimBlocked(S.world.roads.route({ x: v.pos.x, z: v.pos.z }, { x: to.x, z: to.z })) : []; }
    if (o.trim) trimBlocked(pts);
    // drive on the right; a routed path keeps its first point, where the vehicle already is
    if (o.lane) { const first = pts[0]; pts = laneShift(pts, o.lane === true ? 2.2 : o.lane); if (first && !Array.isArray(points)) pts[0] = first; }
    if (pts.length && Math.hypot(pts[0].x - v.pos.x, pts[0].z - v.pos.z) > 3) pts.unshift({ x: v.pos.x, z: v.pos.z });
    return new Path(pts);
  }
  function attach(v, h) {
    if (v.controller && v.controller !== h && v.controller.stop) v.controller.stop(true);
    v.controller = h; v.driven = true; handles.add(h);
    h.v = v; h.done = false; h.t0 = nowT(); h.s = h.path ? h.path.project(v.pos.x, v.pos.z, 0, 0, 1e9).s : 0;
    h.stop = (replaced) => { if (h.stopped) return; h.stopped = true; handles.delete(h); if (!replaced && v.controller === h) { v.controller = null; v.driven = false; park(v); } };
    return h;
  }
  function follow(h, target, o = {}) {
    const v = h.v, p = h.path, dt = S.time - (h.lastT ?? S.time);
    h.lastT = S.time;
    const pr = p.project(v.pos.x, v.pos.z, h.s, 15, 40 + Math.abs(v.speed) * 2);
    h.s = pr.s; h.off = pr.d;
    const want = Math.min(target, p.speedAt(h.s, Math.max(0, v.speed), { latA: o.latA ?? 4.5, top: target, stopEnd: o.stopEnd, decel: o.decel }));
    // wedged against something (wanting to go, not moving) for 2 s: back up with the wheel the other way
    if (h.backT > 0) { h.backT -= dt; const c = v.controls; c.throttle = 0; c.brake = 1; c.steer = -h.backSteer; c.handbrake = false; c.reverse = true; return want; }
    if (want > 2 && Math.abs(v.speed) < 0.5 && !v.wrecked) { h.stuckT = (h.stuckT || 0) + dt; if (h.stuckT > 2) { h.stuckT = 0; h.backT = 1.3; h.backSteer = v.controls.steer || 1; h.unstuck = (h.unstuck || 0) + 1; } }
    else h.stuckT = 0;
    // a slower or stopped vehicle in the way: pass it on the left (o.avoid false keeps the line: rams, convoys)
    let w = want, aim = o;
    if (o.avoid !== false) {
      const ob = blocker(v, want, o.ignore);
      if (ob) {
        const side = ob.side, c = Math.cos(v.yaw), s = Math.sin(v.yaw), off = (v.hw + ob.v.hw + 1) * side;
        aim = { ...o, aimX: (o.aimX || 0) + c * off, aimZ: (o.aimZ || 0) - s * off };
        w = Math.min(want, Math.max(ob.speed + 5, ob.gap > 6 ? 8 : 3));
      }
    }
    drive(v, p, h.s, w, aim);
    return want;
  }
  // the nearest vehicle ahead in this vehicle's way that it would catch; the side to pass on (+1 left)
  function blocker(v, want, ignore) {
    const f = [Math.sin(v.yaw), Math.cos(v.yaw)], range = 12 + Math.max(0, v.speed) * 1.2;
    let best = null;
    for (const o of V.all()) {
      if (o === v || o === ignore) continue;
      const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z, along = dx * f[0] + dz * f[1];
      if (along <= 0 || along > range) continue;
      const lat = dx * f[1] - dz * f[0]; // + is to the left
      if (Math.abs(lat) > v.hw + o.hw + 0.6) continue;
      const os = Math.max(0, o.vel.x * f[0] + o.vel.z * f[1]);
      if (os > want - 2) continue;
      const gap = along - v.hd - o.hd;
      if (!best || gap < best.gap) best = { v: o, gap, speed: os, side: lat > 0.4 ? -1 : 1 };
    }
    return best;
  }
  const arrived = (h, r = 6) => h.path.len - h.s < r && Math.abs(h.v.speed) < 1.5;

  // follow points at o.speed (default the road's pace); o.lane drives on the right; stops at the end
  function route(v, points, o = {}) {
    const h = attach(v, { kind: 'route', path: pathOf(v, points, o), o });
    h.update = () => {
      if (h.done) { park(v); return; }
      const lim = o.speed ?? Math.max(10, S.world.roads.speedLimit(v.pos.x, v.pos.z) * 1.25);
      follow(h, lim, { latA: o.latA ?? 4.6 });
      if (arrived(h, o.r ?? 5)) { h.done = true; park(v); }
    };
    return h;
  }
  // Tail: drives at 10-16 m/s (changing now and then), stops briefly at crossings, and notices a vehicle
  // (o.watch, default the player's) closer than o.notice (18 m) for 4 s: o.onNotice(other) once.
  function tail(v, points, o = {}) {
    const h = attach(v, { kind: 'tail', path: pathOf(v, points, { lane: o.lane ?? true }), o, pace: 13, paceT: 0, near: 0, noticed: false, stops: [], stopT: 0 });
    const R = S.rng('drivers');
    // crossings: graph nodes with three or more roads that the path passes within 6 m of
    const net = S.world.roads.net;
    if (net) for (const n of net.nodes) if ((net.adj[n.id] || []).length >= 3) { const q = h.path.project(n.x, n.z, 0, 0, 1e9); if (q.d < 6 && q.s > 15 && q.s < h.path.len - 10) h.stops.push(q.s); }
    h.stops.sort((a, b) => a - b);
    h.update = (dt) => {
      if (h.done) { park(v); return; }
      h.paceT -= dt; if (h.paceT <= 0) { h.pace = 10 + R() * 6; h.paceT = 6 + R() * 6; }
      let target = o.speed ?? h.pace;
      if (h.stopT > 0) { h.stopT -= dt; target = 0; if (h.stopT <= 0) h.stops.shift(); }
      else if (h.stops.length && h.stops[0] - h.s < 7 && h.stops[0] - h.s > -2) { target = 0; if (Math.abs(v.speed) < 0.6) h.stopT = o.stopFor ?? 1.5; }
      else if (h.stops.length && h.stops[0] < h.s - 2) h.stops.shift();
      follow(h, target);
      const other = o.watch || (S.drive.riding) || S.vehicles.player;
      if (other && other !== v) {
        const d = Math.hypot(other.pos.x - v.pos.x, other.pos.z - v.pos.z);
        h.near = d < (o.notice ?? 18) ? h.near + dt : Math.max(0, h.near - dt * 0.5);
        if (!h.noticed && h.near >= (o.noticeFor ?? 4)) { h.noticed = true; if (o.onNotice) o.onNotice(other, v); v.emit('noticed', { by: other }); }
      }
      if (arrived(h, 6)) { h.done = true; park(v); }
    };
    return h;
  }
  // Convoy: the first follows the points; each next one keeps `gap` (18 m) behind the one ahead
  function convoy(list, points, o = {}) {
    const gap = o.gap ?? 18, lead = list[0];
    // one path for all: from the last in line, through each one ahead, then the leader's route
    const route = pathOf(lead, points, { lane: o.lane ?? true, trim: true }), path = new Path([]);
    path.extend(list.slice(1).reverse().map((v) => ({ x: v.pos.x, z: v.pos.z })));
    path.extend(route.x.map((x, i) => ({ x, z: route.z[i] })));
    const group = { kind: 'convoy', list, done: false, handles: [] };
    list.forEach((v, i) => {
      const h = attach(v, { kind: 'convoy', path, o, index: i });
      h.update = () => {
        if (group.done) { park(v); return; }
        let target = o.speed ?? 14;
        if (i > 0) {
          const ahead = group.handles[i - 1];
          const want = ahead.s - gap;
          target = clamp(Math.max(0, ahead.v.speed) + clamp((want - h.s) * 0.8, -8, 10), 0, (o.speed ?? 14) * 1.6);
          if (ahead.s - h.s < gap * 0.5) target = 0;
        }
        follow(h, target, { avoid: false });
        if (i === 0 && arrived(h, 8)) { h.done = true; }
        if (group.handles.every((x) => x.done || x.stopped) || (group.handles[0].done && group.handles.every((x) => Math.abs(x.v.speed) < 1))) { group.done = true; }
      };
      group.handles.push(h);
    });
    group.stop = () => { for (const h of group.handles) h.stop(); group.done = true; };
    group.v = lead;
    return group;
  }
  // Pursue a vehicle (or anything with pos): road route when far, straight at it when near; o.ram rams
  // its side, then backs off for 2 s. h.hits counts rams that landed. o.max caps the speed it asks for.
  function pursue(v, target, o = {}) {
    const h = attach(v, { kind: 'pursue', path: new Path([{ x: v.pos.x, z: v.pos.z }, { x: target.pos.x, z: target.pos.z }]), o, target, hits: 0, cool: 0, replanT: 0 });
    const off = v.on('hit', (e) => { if (e.other === target && h.cool <= 0 && o.ram) { h.hits++; h.cool = o.cooldown ?? 2; } });
    const stop0 = h.stop; h.stop = (r) => { off(); stop0(r); };
    h.update = (dt) => {
      h.cool -= dt; h.replanT -= dt;
      const T = target.pos, d = Math.hypot(T.x - v.pos.x, T.z - v.pos.z);
      if (h.replanT <= 0) {
        // by the roads when far or out of sight, straight at it when close and clear
        const lead = Math.min(1.2, d / 20), px = T.x + (target.vel ? target.vel.x * lead : 0), pz = T.z + (target.vel ? target.vel.z * lead : 0);
        const hid = S.world.colliders.raycast({ x: v.pos.x, y: v.pos.y + 1.2, z: v.pos.z }, { x: T.x, y: (T.y ?? v.pos.y) + 1.2, z: T.z }, { terrain: false }) != null;
        const far = d > 40 || hid;
        h.replanT = far ? 1.5 : 0.25;
        h.path = far ? pathOf(v, { x: px, z: pz }) : new Path([{ x: v.pos.x, z: v.pos.z }, { x: px, z: pz }, { x: px + (target.vel ? target.vel.x : 0), z: pz + (target.vel ? target.vel.z : 0) }]);
        h.s = 0;
      }
      let speed = o.speed ?? v.spec.top * 0.92, aimX = 0, aimZ = 0;
      const ts = target.speed != null ? Math.abs(target.speed) : 0;
      if (o.ram && d < 16) {
        if (h.cool > 0) { speed = Math.max(0, ts - 3); } // back off, then line up again
        else {
          // aim at the side of the target facing us
          const [lx] = target.toLocal ? target.toLocal(v.pos.x, v.pos.z) : [0];
          const side = lx >= 0 ? 1 : -1, c = Math.cos(target.yaw || 0), s = Math.sin(target.yaw || 0);
          aimX = side * c * 0.6; aimZ = -side * s * 0.6;
          speed = ts + 4;
        }
      } else if (!o.ram && d < 20) speed = Math.max(0, ts + (d - 12) * 0.5);
      if (o.max != null) speed = Math.min(speed, o.max);
      follow(h, speed, { stopEnd: false, aimX, aimZ, latA: o.latA ?? 6, decel: o.decel, ignore: target });
    };
    return h;
  }
  // Flee along points as fast as the vehicle goes
  function flee(v, points, o = {}) {
    const h = attach(v, { kind: 'flee', path: pathOf(v, points, o), o });
    h.update = () => {
      if (h.done) { park(v); return; }
      follow(h, o.speed ?? v.spec.top * 0.92, { latA: o.latA ?? 6 });
      if (arrived(h, 8)) { h.done = true; park(v); }
    };
    return h;
  }
  // Race through gates (place ids or points), rubber-banded +-rubber (10 %) against o.rival (default the
  // player's vehicle). h.gate is the next gate index; h.time the race time.
  function race(v, gates, o = {}) {
    const G = gates.map(toPoint).filter(Boolean);
    let pts = [{ x: v.pos.x, z: v.pos.z }];
    let from = { x: v.pos.x, z: v.pos.z };
    for (const g of G) { const seg = o.offroad ? [{ x: g.x, z: g.z }] : S.world.roads.route(from, { x: g.x, z: g.z }); pts = pts.concat(seg); from = { x: g.x, z: g.z }; }
    const h = attach(v, { kind: 'race', path: new Path(pts), o, gate: 0, gates: G, time: 0 });
    h.gateS = G.map((g) => h.path.project(g.x, g.z, 0, 0, 1e9).s);
    const rubber = o.rubber ?? 0.1;
    h.update = (dt) => {
      if (h.done) { park(v); return; }
      h.time += dt;
      const rival = o.rival || S.drive.riding || S.vehicles.player;
      let k = 1;
      if (rival && rival !== v) {
        const rs = h.path.project(rival.pos.x, rival.pos.z, h.s, 150, 150).s;
        const lead = h.s - rs;
        k = 1 - clamp(lead / 60, -1, 1) * rubber;
      }
      follow(h, (o.speed ?? v.spec.top) * k, { latA: o.latA ?? 6.5, decel: 6.5 });
      while (h.gate < G.length && (h.s >= h.gateS[h.gate] - 4 || Math.hypot(G[h.gate].x - v.pos.x, G[h.gate].z - v.pos.z) < (o.gateR ?? 10))) h.gate++;
      if (h.gate >= G.length) { h.done = true; v.emit('raceDone', { time: h.time }); }
    };
    return h;
  }
  function stop(v) {
    if (!v) return;
    if (v.controller && v.controller.stop) v.controller.stop();
    const h = attach(v, { kind: 'stop', path: null });
    h.update = () => { const c = v.controls; c.throttle = 0; c.steer = 0; c.brake = 1; c.handbrake = false; c.reverse = false; if (Math.abs(v.speed) < 0.3) { h.done = true; h.stop(); } };
    return h;
  }
  function park(v) { const c = v.controls; c.throttle = 0; c.brake = 1; c.steer = 0; c.handbrake = Math.abs(v.speed) < 0.5; c.reverse = false; }

  function update(dt) {
    for (const h of [...handles]) {
      if (!h.v || h.stopped) continue;
      if (h.v.wrecked) { h.done = true; h.stop(); continue; }
      h.update(dt);
    }
  }
  function clear() { for (const h of [...handles]) h.stop(); handles.clear(); }
  function laneShift(pts, off) {
    // the right of a heading (fx, fz) in this world (+x is left of +z) is (-fz, fx)
    if (pts.length < 2) return pts;
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      const nearRing = S.world.roads.nearest(p.x, p.z);
      const k = nearRing && nearRing.road === 'y_ring' ? 0 : off;
      return { x: p.x - (dz / l) * k, z: p.z + (dx / l) * k };
    });
  }
  return { api: { route, tail, convoy, pursue, flee, race, stop }, update, clear, handles, pathOf, park, laneShift };
}
