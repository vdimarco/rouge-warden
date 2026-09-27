// js/story/vehicles/traffic.js : ambient traffic (design 4.1, C2, C7). Only this scales with the tier:
// 5 / 8 / 14 cars at Q0 / Q1 / Q2 times setDensity(k). Missions spawn their own vehicles.
// - Cars spawn on lanes 120-300 m from the hero and out of view, and go beyond 360 m (out of view).
// - Each car follows its lane over the road graph, turning at random at junctions (no lots, no dirt).
// - Kinematic beyond 60 m (moved along the lane, no collisions); within 60 m of the hero, or after a
//   contact, a car is a full physics vehicle driven by pure pursuit (C7).
// - IDM-style following with a 2 s gap; yield at the Y ring (2.5 s gap); honk after 2 s blocked; stop
//   for 2 s after a collision.
// - Drawn by the instanced batch in meshes.js (a few draws for every car together).
import * as THREE from 'three';
import { TRAFFIC, specOf } from './specs.js';
import { Path, drive } from './drivers.js';
import { sample } from '../world/roads.js';
import { PALETTE } from '../look/palette.js';
import { createTrafficBatch } from './meshes.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function createTraffic(S, V) {
  const cars = [];
  let batch = null, density = 1, spawnT = 0, startT = -1;
  const R = S.rng('traffic');
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere();
  const net = () => S.world.roads.net;
  const roadOk = (r) => r && !r.id.startsWith('lot_') && r.surface !== 'dirt' && r.id !== 'crossing';
  // A one-way ring is driven counter-clockwise seen from above (north up), as traffic on the right does:
  // +1 when that is the way its arc length grows, else -1.
  const ringDirs = new Map();
  function ringDir(r) {
    if (ringDirs.has(r.id)) return ringDirs.get(r.id);
    let a = 0; const L = r.line;
    for (let i = 0; i < L.length - 1; i++) a += L[i].x * -L[i + 1].z - L[i + 1].x * -L[i].z;
    const d = a > 0 ? 1 : -1; ringDirs.set(r.id, d); return d;
  }
  let edgeList = null, edgeW = 0;
  function edges() {
    if (edgeList) return edgeList;
    const N = net();
    edgeList = N.edges.filter((e) => e.road && roadOk(N.byId[e.road]) && e.len > 20);
    edgeW = edgeList.reduce((a, e) => a + e.len, 0);
    return edgeList;
  }
  const inView = (x, y, z, r = 5) => { sph.center.set(x, y + 1, z); sph.radius = r; return frustum.intersectsSphere(sph); };
  const hero = () => (S.hero && S.hero.pos) || S.focus;

  /* ---------------- lanes over the graph */
  // append one edge, driven from node `from`, to a car's path (its lane: +1 right of increasing s)
  // t.marks: where along the car's path it reaches each node and which road it drives on from there
  function pushEdge(t, e, from) {
    const N = net(), to = e.a === from ? e.b : e.a, dir = e.a === from ? 1 : -1;
    t.marks.push({ s: t.path.len, node: from, road: e.road });
    t.edge = e; t.node = to;
    if (!e.road) return; // a junction link: the lane runs straight on to the next road's first point
    const r = N.byId[e.road], lane = r.lanes === 1 ? 0 : dir;
    const s0 = dir > 0 ? e.s0 : e.s1, s1 = dir > 0 ? e.s1 : e.s0, n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / 6)), pts = [];
    for (let i = 1; i <= n; i++) { const p = sample(N, r.id, s0 + (s1 - s0) * i / n, lane); pts.push({ x: p.x, z: p.z }); }
    t.path.extend(pts);
  }
  // the road under the car now (and its limit), and the next junction ahead {node, s}
  function whereOn(t, v) {
    const N = net();
    let road = t.road;
    for (const m of t.marks) { if (m.s > t.s + 1) break; if (m.road) road = m.road; }
    if (road !== t.road) { t.road = road; t.limit = N.byId[road] ? N.byId[road].speed : t.limit; }
    t.next = null; t.turn = false;
    let before = null;
    for (const m of t.marks) {
      if (m.node != null && m.s > t.s - v.hd && (N.adj[m.node] || []).length >= 3) { t.next = m; t.turn = !!m.road && !!before && m.road !== before; break; }
      if (m.road) before = m.road;
    }
  }
  // the next edge at a node: not back the way we came, not a lot or dirt road, the ring only one way
  function nextEdge(t) {
    const N = net(), n = t.node, came = t.edge;
    const ok = (e) => {
      if (e === came) return false;
      if (!e.road) return true;
      const r = N.byId[e.road];
      if (!roadOk(r)) return false;
      if (r.lanes === 1 && (ringDir(r) > 0 ? e.a !== n : e.b !== n)) return false;
      return true;
    };
    let c = (N.adj[n] || []).filter(ok);
    // on the ring: take an exit (not the way in), and never go round more than once
    if (came && came.road && N.byId[came.road].lanes === 1) {
      t.ringS = (t.ringS || 0) + came.len;
      const out = c.filter((e) => !e.road || N.byId[e.road].lanes !== 1);
      const back = out.filter((e) => t.ringFrom != null && (e.a === t.ringFrom || e.b === t.ringFrom));
      const exits = out.filter((e) => !back.includes(e));
      if (exits.length && (t.ringS > 40 || R() < 0.6)) c = exits;
      else if (out.length && t.ringS > 90) c = out;
    } else { t.ringS = 0; t.ringFrom = n; }
    if (!c.length) {
      // a dead end: turn round on the same road (two-way roads only), else give up
      const r = came && came.road ? N.byId[came.road] : null;
      if (r && r.lanes === 2) return came;
      return null;
    }
    return c[Math.floor(R() * c.length) % c.length];
  }
  function extend(t) {
    let guard = 0;
    while (t.path.len - t.s < 140 && guard++ < 8) {
      const e = nextEdge(t);
      if (!e) { t.deadEnd = true; return; }
      pushEdge(t, e, t.node);
    }
  }

  /* ---------------- spawning */
  function pickKind() {
    const mix = TRAFFIC.mix, total = mix.reduce((a, m) => a + m[1], 0);
    let k = R() * total;
    for (const m of mix) { k -= m[1]; if (k <= 0) return m; }
    return mix[0];
  }
  function trySpawn(ignoreView) {
    const N = net(), E = edges(); if (!E.length) return false;
    const H = hero();
    for (let tries = 0; tries < 10; tries++) {
      let k = R() * edgeW, e = E[0];
      for (const x of E) { k -= x.len; if (k <= 0) { e = x; break; } }
      const r = N.byId[e.road], dir = r.lanes === 1 ? ringDir(r) : R() < 0.5 ? 1 : -1, lane = r.lanes === 1 ? 0 : dir;
      const s = e.s0 + (e.s1 - e.s0) * (0.1 + R() * 0.8);
      const p = sample(N, r.id, s, lane);
      const d = Math.hypot(p.x - H.x, p.z - H.z);
      if (d < (ignoreView ? 45 : TRAFFIC.spawnMin) || d > TRAFFIC.spawnMax) continue;
      const y = S.world.surface(p.x, p.z);
      if (!ignoreView && inView(p.x, y, p.z, 6)) continue;
      if (V.all().some((o) => Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 28)) continue;
      const [kind, , tints] = pickKind();
      const tint = PALETTE[tints[Math.floor(R() * tints.length) % tints.length]];
      const v = V.make(kind, { pos: { x: p.x, z: p.z, y }, yaw: p.yaw, tint, traffic: true });
      const t = v.tr = { path: new Path([{ x: p.x, z: p.z }]), s: 0, node: dir > 0 ? nodeAt(e, 'b') : nodeAt(e, 'a'), edge: e, speedK: 0.85 + R() * 0.2, stopT: 0, blockedT: 0, honkT: 0, limit: r.speed, road: r.id, want: 0, marks: [{ s: 0, node: null, road: r.id }], next: null };
      // the rest of this edge, then onward
      const s1 = dir > 0 ? e.s1 : e.s0, n = Math.max(1, Math.ceil(Math.abs(s1 - s) / 6)), pts = [];
      for (let i = 1; i <= n; i++) { const q = sample(N, r.id, s + (s1 - s) * i / n, lane); pts.push({ x: q.x, z: q.z }); }
      t.path.extend(pts);
      extend(t);
      v.kinematic = true; v.speed = r.speed * t.speedK * 0.8; t.v = v.speed;
      v.handle = batch.add(kind, tint);
      v.on('hit', (ev) => { if (ev.speed > 1.5) t.stopT = 2; });
      cars.push(v);
      return true;
    }
    return false;
  }
  const nodeAt = (e, which) => e[which];
  function remove(v) {
    const i = cars.indexOf(v); if (i >= 0) cars.splice(i, 1);
    v.gone = true;
    if (v.tr && v.tr.holding != null && holds.get(v.tr.holding) === v) holds.delete(v.tr.holding);
    if (v.handle && batch) batch.remove(v.handle);
    V.drop(v);
  }

  /* ---------------- driving */
  // the gap to whatever is ahead in this car's lane (vehicles, people, the ring's entry) and its speed
  // Another vehicle is in the way when any corner of its footprint lies ahead inside this car's lane band,
  // or its footprint spans the band (a car crossing in front). The gap is to its nearest corner.
  const band = (v) => v.hw + 0.7;
  function inWay(v, o, f, narrow) {
    const c = Math.cos(o.yaw), s = Math.sin(o.yaw), B = narrow ? 0.4 : band(v);
    let near = Infinity, lo = Infinity, hi = -Infinity, ahead = false;
    for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = o.pos.x + u * o.hw * c + w * o.hd * s - v.pos.x, cz = o.pos.z - u * o.hw * s + w * o.hd * c - v.pos.z;
      const along = cx * f[0] + cz * f[1], lat = cx * f[1] - cz * f[0];
      if (along <= v.hd * 0.5) continue;
      ahead = true; lo = Math.min(lo, lat); hi = Math.max(hi, lat);
      if (Math.abs(lat) < B || (lo < -B && hi > B)) near = Math.min(near, along);
    }
    if (ahead && lo < -B && hi > B && near === Infinity) near = v.hd + 0.5;
    return near;
  }
  // the same along this car's own path (so a turn is seen before it is made): the nearest corner of o
  // within the lane corridor of the next 30 m, as a gap in meters (Infinity when clear)
  function inPath(v, t, o, narrow) {
    const c = Math.cos(o.yaw), s = Math.sin(o.yaw), B = narrow ? 0.4 : band(v);
    let near = Infinity;
    for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
      const cx = o.pos.x + u * o.hw * c + w * o.hd * s, cz = o.pos.z - u * o.hw * s + w * o.hd * c;
      const q = t.path.project(cx, cz, t.s, 0, 30);
      if (q.d < B && q.s > t.s + v.hd * 0.5) near = Math.min(near, q.s - t.s);
    }
    return near;
  }
  function leader(v, t) {
    const f = [Math.sin(v.yaw), Math.cos(v.yaw)], hd = v.hd;
    let gap = Infinity, lv = 0, who = null;
    // held up for 8 s by other traffic (a lock nobody resolves): for 3 s it minds only people
    // (kinematic cars only: they are far off and pass through each other; near the hero cars go round)
    if (v.kinematic && (t.blockT || 0) > 8 && !(t.impatient > S.time)) t.impatient = S.time + 3;
    const impatient = t.impatient > S.time;
    for (const o of impatient ? [] : V.all()) {
      if (o === v) continue;
      const passing = t.pass && t.pass.v === o && S.time < t.pass.until;
      if (passing && v.kinematic) continue; // far off, a stuck car is simply driven past
      const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
      if (dx * dx + dz * dz > 70 * 70) continue;
      if (dx * f[0] + dz * f[1] < -o.hd) continue;
      // in the way now (straight ahead), or on the path ahead (a turn); going round it: only straight ahead,
      // so it turns out and creeps by without touching
      const near = passing ? inWay(v, o, f, false) : Math.min(inWay(v, o, f, false), dx * dx + dz * dz < 35 * 35 ? inPath(v, t, o, false) : Infinity);
      if (near === Infinity) continue;
      // two cars waiting on each other at a junction: the older one goes
      if (o.tr && o.tr.who === v && Math.abs(o.speed) < 1 && Math.abs(v.speed) < 1 && (t.blockT > 2 || (o.tr.blockT || 0) > 2) && v.id < o.id) continue;
      const g = near - hd;
      if (g < gap) { gap = g; lv = Math.max(0, o.vel.x * f[0] + o.vel.z * f[1]); who = o; }
    }
    for (const p of S.vehicles.people) {
      const dx = p.x - v.pos.x, dz = p.z - v.pos.z, along = dx * f[0] + dz * f[1], lat = Math.abs(dx * f[1] - dz * f[0]);
      if (along <= 0 || along > 40 || lat > v.hw + (p.r || 0.4) + 0.4) continue;
      const g = along - hd - 1.5;
      if (g < gap) { gap = g; lv = 0; who = p; }
    }
    // the Y: coming onto the ring, wait for a 2.5 s gap in the ring traffic heading for this entry (at
    // most 6 s: then go)
    t.yieldT = t.yieldT || 0;
    const J = t.next, N = net();
    if (J && !impatient) {
      const n = N.nodes[J.node], dn = J.s - t.s, ring = isRing(J.node);
      if (ring && !isRingRoad(t.road)) {
        if (dn < 18 && t.yieldT < 6) {
          const busy = V.all().some((o) => {
            if (o === v || !o.tr || !isRingRoad(o.tr.road)) return false;
            const dx = n.x - o.pos.x, dz = n.z - o.pos.z, d = Math.hypot(dx, dz);
            return d > 3 && (o.vel.x * dx + o.vel.z * dz) > 0 && d / Math.max(1, Math.abs(o.speed)) < 2.5;
          });
          if (busy && dn - 5 < gap) { gap = Math.max(0, dn - 5); lv = 0; who = 'ring'; }
        }
      } else if (!ring && dn < 16) {
        // an ordinary junction. A car turning onto another road waits for a 2.5 s gap in whatever is
        // heading for the junction, then holds it until it is through; a car going straight on waits only
        // for a turning car that holds it.
        const h = holds.get(J.node);
        // (a holder stuck for 5 s holds nothing; nobody waits more than 10 s)
        const held = h && h !== v && !h.gone && h.tr && h.tr.next && h.tr.next.node === J.node && (h.tr.blockT || 0) < 5;
        let wait = held && (t.turn || h.tr.turn) && t.yieldT < 10;
        if (!wait && t.turn && t.yieldT < 6) {
          wait = V.all().some((o) => {
            if (o === v) return false;
            const dx = n.x - o.pos.x, dz = n.z - o.pos.z, d = Math.hypot(dx, dz);
            return d > 2 && d < 40 && (o.vel.x * dx + o.vel.z * dz) > 0 && d / Math.max(1, Math.abs(o.speed)) < 2.5;
          });
        }
        if (wait) { if (dn - hd - 3 < gap) { gap = Math.max(0, dn - hd - 3); lv = 0; who = 'junction'; } }
        else if (t.turn && !held) { holds.set(J.node, v); t.holding = J.node; }
      }
    }
    if (t.holding != null && (!J || J.node !== t.holding)) { if (holds.get(t.holding) === v) holds.delete(t.holding); t.holding = null; }
    return { gap, lv, who };
  }
  // is there room to pass o on the left (the other lane): nothing solid and no vehicle there
  function roomToPass(v, o) {
    if (v.kinematic) return true;
    const C = S.world.colliders, off = v.hw + o.hw + 1.2, c = Math.cos(v.yaw), s = Math.sin(v.yaw), f = [Math.sin(v.yaw), Math.cos(v.yaw)];
    for (const along of [-o.hd, 0, o.hd, o.hd + v.hd * 2]) {
      const [ox, oz] = [o.pos.x + c * off + f[0] * along, o.pos.z - s * off + f[1] * along];
      if (C.resolveCircle({ x: ox, z: oz }, v.hw, v.pos.y)) return false;
      if (Math.abs(S.world.surface(ox, oz, v.pos.y + 1) - v.pos.y) > 1.2) return false;
      for (const w of V.all()) if (w !== v && w !== o && Math.hypot(w.pos.x - ox, w.pos.z - oz) < w.hd + v.hw) return false;
    }
    return true;
  }
  const holds = new Map(); // junction node -> the car crossing it
  const isRingRoad = (id) => { const r = id && net().byId[id]; return !!r && r.lanes === 1; };
  const isRing = (node) => (net().adj[node] || []).some((e) => isRingRoad(e.road));
  // IDM: the acceleration toward v0 that keeps a 2 s gap
  function idm(vv, v0, L) {
    const a = 1.6, b = 3, s0 = 3, T = 2;
    if (!Number.isFinite(L.gap)) return a * (1 - Math.pow(vv / Math.max(v0, 0.1), 4));
    const ss = s0 + vv * T + vv * (vv - L.lv) / (2 * Math.sqrt(a * b));
    return a * (1 - Math.pow(vv / Math.max(v0, 0.1), 4) - Math.pow(Math.max(ss, 0) / Math.max(L.gap, 0.3), 2));
  }
  function update(dt) {
    if (!batch) batch = createTrafficBatch(V.root);
    // (a world without a road graph, like the stub world, has no traffic)
    const on = S.world.ready && S.world.visible && S.mode === 'play' && hero().y > -150 && !!net() && !!net().edges;
    const want = on ? Math.round(TRAFFIC.count[clamp(S.q | 0, 0, 2)] * density) : 0;
    if (!on) { if (cars.length && !S.world.visible) clear(); startT = -1; return; }
    if (startT < 0) startT = S.time;
    // camera frustum (for spawning out of view)
    const cam = S.camera; pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    spawnT -= dt;
    if (cars.length < want && spawnT <= 0) { const fill = S.time - startT < 0.6; trySpawn(fill); spawnT = fill ? 0 : 0.4; }
    const H = hero();
    for (const v of [...cars]) {
      const t = v.tr, d = Math.hypot(v.pos.x - H.x, v.pos.z - H.z);
      // too many (density went down), or far and out of view: gone
      if (d > 700 || (d > TRAFFIC.despawn && !inView(v.pos.x, v.pos.y, v.pos.z, 6)) || (cars.length > want && d > 150 && !inView(v.pos.x, v.pos.y, v.pos.z, 6)) || (t.deadEnd && t.path.len - t.s < 5)) { remove(v); continue; }
      if (v.wrecked) continue;
      // physics near the hero or after a contact (C7); kinematic again once far and back on its lane
      if (v.kinematic && (d < TRAFFIC.physics || S.time - v.contactT < 3)) { v.kinematic = false; v.speed = t.v; v.vy = 0; v.driven = true; }
      else if (!v.kinematic && d > TRAFFIC.physicsOff && S.time - v.contactT > 3 && !v.airborne) {
        const pr = t.path.project(v.pos.x, v.pos.z, t.s, 30, 60);
        if (pr.d < 3) { v.kinematic = true; t.s = pr.s; t.v = Math.max(0, v.speed); }
      }
      // how fast: the road, the bends, the car ahead, a crash
      whereOn(t, v);
      const v0 = (t.limit || 12) * t.speedK;
      t.stopT -= dt;
      const L = leader(v, t);
      const vv = v.kinematic ? t.v : Math.max(0, v.speed);
      t.who = L.who;
      t.blockT = vv < 0.5 && L.gap < 8 ? (t.blockT || 0) + dt : 0;
      t.yieldT = L.who === 'ring' || L.who === 'junction' ? t.yieldT + dt : L.who === null && vv > 2 ? 0 : t.yieldT;
      // go round a vehicle that stays put in the way: after 3 s a parked or wrecked one (nobody driving),
      // after 4 s a traffic car that waits on this one or on nothing (a lock at a junction)
      const W0 = L.who;
      if (W0 && W0.pos && Math.abs(W0.speed) < 0.3 && !(t.pass && S.time < t.pass.until)) {
        const parked = !W0.tr && (!W0.driven || W0.wrecked) && t.blockT > 3;
        const locked = W0.tr && t.blockT > 4 && (W0.tr.who === v || W0.tr.who == null);
        if ((parked || locked) && roomToPass(v, W0)) t.pass = { v: W0, until: S.time + 8 };
      }
      let acc = idm(vv, Math.min(v0, t.path.speedAt(t.s, vv, { latA: 3.2, top: v0, stopEnd: t.deadEnd })), L);
      if (t.stopT > 0) acc = -6;
      // honk when held up for 2 s by the hero's vehicle or someone in the road
      const heldByHero = L.who && (L.who === S.drive.riding || L.who.hero || (L.who.x != null && L.who.dive));
      if (vv < 0.5 && L.gap < 12 && heldByHero && t.stopT <= 0) { t.blockedT += dt; if (t.blockedT > 2 && S.time - t.honkT > 4) { t.honkT = S.time; if (S.audio) S.audio.sfx('horn', { at: v.pos, gain: 0.5 }); } }
      else t.blockedT = 0;
      if (v.kinematic) {
        t.v = clamp(t.v + acc * dt, 0, v0 * 1.15);
        if (L.gap < 0.5) t.v = 0;
        t.s += t.v * dt;
        const p = t.path.at(t.s);
        v.yaw = p.yaw; v.pos.x = p.x; v.pos.z = p.z;
        v.probe(v.pos.y); v.pos.y = v.restY(); v.slope();
        v.speed = t.v; v.spin += t.v * dt / v.spec.wheelR; v.steerAngle = 0;
      } else {
        const pr = t.path.project(v.pos.x, v.pos.z, t.s, 20, 60);
        t.s = pr.s;
        t.v = clamp(Math.max(0, v.speed) + acc * 1.2, 0, v0 * 1.1);
        if (L.gap < 1) t.v = 0;
        let aim;
        if (t.pass && S.time < t.pass.until) {
          // pass on the left of the one in the way, slowly
          const o = t.pass.v, off = v.hw + o.hw + 1.2, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
          aim = { aimX: c * off, aimZ: -s * off }; t.v = L.gap > 1.2 ? Math.min(Math.max(t.v, 1.5), 6) : 0;
          const [, lz] = v.toLocal(o.pos.x, o.pos.z); if (lz < -v.hd - o.hd) t.pass = null; // clear of it
        }
        drive(v, t.path, t.s, t.v, aim);
        if (pr.d > 25) { t.lost = (t.lost || 0) + dt; if (t.lost > 6 && d > 90) { remove(v); continue; } } else t.lost = 0;
      }
      if (t.path.len - t.s < 140) extend(t);
      const cut = t.path.trim(t.s, 40);
      if (cut) {
        t.s -= cut;
        for (const m of t.marks) m.s -= cut;
        while (t.marks.length > 1 && t.marks[1].s < t.s - 30) t.marks.shift();
      }
    }
  }
  function draw(night) {
    if (!batch) return;
    for (const v of cars) {
      const h = v.handle; if (!h) continue;
      h.pose = h.pose || {};
      Object.assign(h.pose, { x: v.pos.x, y: v.pos.y, z: v.pos.z, yaw: v.yaw, pitch: -v.susp.slopeP + v.susp.pitch, roll: v.susp.slopeR + v.susp.roll, steer: v.steerAngle, spin: v.spin, lift: v.susp.lift });
    }
    batch.update(night);
  }
  function clear() { for (const v of [...cars]) remove(v); holds.clear(); }
  const api = {
    cars,
    setDensity(k) { density = clamp(+k || 0, 0, 3); },
    clear,
    get density() { return density; },
  };
  return { api, update, draw, clear, remove, get batch() { return batch; } };
}
