// js/story/cast/crowd.js : townsfolk and followers (CAST spec 9).
// Crowd: pedestrians on sidewalk lines in Uptown, West Sedona, the diner and the trailheads. They walk, stand,
// look at their phones and photograph the buttes. Counts follow the tier (12 / 6 / 3, times setDensity);
// only ambient people scale with the tier (C2). They scatter from fights, and each tick they put a soft
// circle into S.vehicles.people with a dive() that sidesteps for 0.4 s (false when both sides are blocked,
// so the vehicle treats the person as a soft wall). Nobody is ever hit.
// Followers: friends that keep a slot behind the hero, and board or leave a van with a short fade.
import * as THREE from 'three';
import { PLACES } from '../world/places.js';
import { ROADS } from '../world/roads.js';

const TAU = Math.PI * 2;
export const CROWD_COUNT = Object.freeze([3, 6, 12]);
// the lines people walk: [zone id, points [x, z], kind]. 'walk' lines are sidewalks; 'view' spots are
// trailhead lookouts where people stand, wander a little and take photos.
function lines() {
  const L = [];
  // Uptown: both sidewalks of 89A, the middle of the concrete strip (half the road plus 1.2 m)
  const u = ROADS.find((r) => r.id === 'a89u');
  if (u) { const off = u.width / 2 + 1.25, pts = u.pts.slice(1); L.push(['uptown', offsetLine(pts, off), 'walk'], ['uptown', offsetLine(pts, -off), 'walk']); }
  // West Sedona: the shop strip north of 89A, set back from the road
  const strip = (ax, az, bx, bz, off) => { const Ln = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / Ln, dz = (bz - az) / Ln, rx = -dz, rz = dx; return Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [Math.round(ax + dx * Ln * t + rx * off), Math.round(az + dz * Ln * t + rz * off)]; }); };
  L.push(['west', strip(-420, 116, -660, 146, 13.5), 'walk'], ['west', strip(-240, 90, -420, 116, 13.5), 'walk']);
  L.push(['west', [[-590, 92], [-560, 94], [-530, 92], [-526, 80], [-560, 82], [-594, 80]], 'walk']); // Red Rock Plaza's front walk
  L.push(['diner', [[166, 916], [168, 930], [166, 944], [176, 948], [178, 924]], 'walk']);
  for (const id of ['midgley_lot', 'airport_overlook', 'boynton', 'bell_cairn', 'cathedral_saddle', 'airport_mesa', 'slide_rock']) {
    const p = PLACES[id]; if (!p) continue;
    L.push([id, [[p.x - 4, p.z - 2], [p.x + 3, p.z - 4], [p.x + 5, p.z + 3], [p.x - 2, p.z + 5]], 'view']);
  }
  return L.map(([zone, pts, kind]) => {
    const P = pts.map(([x, z]) => new THREE.Vector2(x, z)); let len = 0; const acc = [0];
    for (let i = 1; i < P.length; i++) { len += P[i].distanceTo(P[i - 1]); acc.push(len); }
    const c = P.reduce((s, p) => s.add(p), new THREE.Vector2()).multiplyScalar(1 / P.length);
    return { zone, P, acc, len, kind, c };
  });
}
// a polyline moved sideways by off metres (+ to the right of travel), with mitred corners
function offsetLine(pts, off) {
  const n = pts.length, out = [];
  const nrm = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [-dz / l, dx / l]; };
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? nrm(pts[i - 1], pts[i]) : null, b = i < n - 1 ? nrm(pts[i], pts[i + 1]) : null;
    let nx, nz;
    if (a && b) { nx = a[0] + b[0]; nz = a[1] + b[1]; const l = Math.hypot(nx, nz), k = 1 / Math.max(0.5, (nx * a[0] + nz * a[1]) / l); nx = nx / l * k; nz = nz / l * k; } else [nx, nz] = a || b;
    out.push([pts[i][0] + nx * off, pts[i][1] + nz * off]);
  }
  return out;
}
const at = (ln, s, out) => {
  s = Math.max(0, Math.min(ln.len, s));
  let i = 1; while (i < ln.acc.length - 1 && ln.acc[i] < s) i++;
  const t = (s - ln.acc[i - 1]) / Math.max(1e-6, ln.acc[i] - ln.acc[i - 1]);
  return out.set(ln.P[i - 1].x + (ln.P[i].x - ln.P[i - 1].x) * t, ln.P[i - 1].y + (ln.P[i].y - ln.P[i - 1].y) * t);
};

export function createCrowd(S, cast) {
  const LINES = lines();
  const rand = S.rng('crowd');
  const peds = [];
  let density = 1, spawnCD = 0;
  const v2 = new THREE.Vector2(), v2b = new THREE.Vector2();
  const blocked = (x, z, r = 0.35) => { let hit = false; const C = S.world && S.world.colliders; if (C && C.query) C.query(x, z, r, () => { hit = true; return false; }); return hit; };
  function spawnOne(focus) {
    const near = LINES.filter((l) => l.c.distanceTo(v2.set(focus.x, focus.z)) < 240);
    if (!near.length) return false;
    const ln = near[Math.floor(rand() * near.length)];
    const s = rand() * ln.len; at(ln, s, v2);
    // never pop in right under the camera
    const cam = S.camera.position;
    if (Math.hypot(v2.x - cam.x, v2.y - cam.z) < 22) return false;
    if (blocked(v2.x, v2.y)) return false;
    const id = rand() < 0.5 ? 'civA' : 'civB';
    const a = cast.spawn(id, { pos: { x: v2.x, z: v2.y }, variant: Math.floor(rand() * 6), crowd: true });
    const p = { a, ln, s, dir: rand() < 0.5 ? 1 : -1, speed: 1.05 + rand() * 0.45, state: 'walk', t: 2 + rand() * 8, flee: 0, fleeDir: new THREE.Vector2(), dive: null, pos: new THREE.Vector3(v2.x, 0, v2.y), face: 0 };
    p.pos.y = S.world.surface(p.pos.x, p.pos.z);
    if (ln.kind === 'view') { p.state = rand() < 0.5 ? 'photo' : 'stand'; p.t = 4 + rand() * 6; }
    peds.push(p);
    return true;
  }
  function remove(p) { const i = peds.indexOf(p); if (i >= 0) peds.splice(i, 1); cast.despawn(p.a); }
  function setState(p, st) {
    p.state = st;
    const a = p.a;
    if (st === 'walk' || st === 'flee') a.play('lib:idle', { fade: 0.3 });
    else if (st === 'phone') a.play('lib:phone', { fade: 0.4 });
    else if (st === 'photo') a.play('lib:photo', { fade: 0.4 });
    else a.play('lib:idle', { fade: 0.4 });
  }
  function update(rdt, focus) {
    const W = S.world;
    if (!W || !W.ready || !W.visible || !focus) { if (peds.length) clear(); return; }
    const want = Math.round(CROWD_COUNT[Math.max(0, Math.min(2, S.q ?? 2))] * density);
    // keep the count: drop people far from the focus, add new ones near it (at most one a second)
    for (const p of peds.slice()) if (Math.hypot(p.pos.x - focus.x, p.pos.z - focus.z) > 300 || peds.length > want) remove(p);
    spawnCD -= rdt;
    if (peds.length < want && spawnCD <= 0) { spawnCD = 1; spawnOne(focus); }
    const people = S.vehicles && S.vehicles.people;
    for (const p of peds) {
      const a = p.a;
      let sp = 0;
      if (p.dive) { // the sidestep: 0.4 s, then back to what they were doing
        p.dive.t += rdt; const k = Math.min(1, p.dive.t / 0.4), e = k * k * (3 - 2 * k);
        p.pos.x = p.dive.x0 + (p.dive.x1 - p.dive.x0) * e; p.pos.z = p.dive.z0 + (p.dive.z1 - p.dive.z0) * e;
        sp = 3.5 * (1 - k);
        if (k >= 1) p.dive = null;
      } else if (p.flee > 0) {
        p.flee -= rdt; sp = 4.2;
        p.pos.x += p.fleeDir.x * sp * rdt; p.pos.z += p.fleeDir.y * sp * rdt;
        p.face = Math.atan2(p.fleeDir.x, p.fleeDir.y);
        if (p.flee <= 0) { // walk on from the nearest point of the line
          let best = 0, bd = Infinity; for (let s = 0; s <= p.ln.len; s += 2) { at(p.ln, s, v2b); const d = Math.hypot(v2b.x - p.pos.x, v2b.y - p.pos.z); if (d < bd) { bd = d; best = s; } }
          p.s = best; setState(p, 'walk');
        }
      } else if (p.state === 'walk') {
        p.s += p.dir * p.speed * rdt;
        if (p.s <= 0 || p.s >= p.ln.len) { p.dir *= -1; p.s = Math.max(0, Math.min(p.ln.len, p.s)); }
        at(p.ln, p.s, v2); at(p.ln, p.s + p.dir * 0.8, v2b);
        const dx = v2.x - p.pos.x, dz = v2.y - p.pos.z, d = Math.hypot(dx, dz);
        // walk toward the line point (so a person pushed off it walks back)
        if (d > 0.01) { const m = Math.min(d, p.speed * rdt * 1.4) / d; p.pos.x += dx * m; p.pos.z += dz * m; }
        sp = p.speed;
        p.face = Math.atan2(v2b.x - v2.x, v2b.y - v2.y);
        p.t -= rdt;
        if (p.t <= 0) { const r = rand(); setState(p, r < 0.35 ? 'stand' : r < 0.6 ? 'phone' : 'walk'); p.t = p.state === 'walk' ? 6 + rand() * 10 : 3 + rand() * 5; }
      } else {
        p.t -= rdt;
        if (p.state === 'photo') { // face out from the lookout, toward the view
          p.face = Math.atan2(p.pos.x - p.ln.c.x, p.pos.z - p.ln.c.y);
        }
        if (p.t <= 0) { const view = p.ln.kind === 'view'; setState(p, view && rand() < 0.4 ? 'photo' : 'walk'); p.t = 5 + rand() * 8; }
      }
      if (W.colliders && W.colliders.resolveCircle) W.colliders.resolveCircle(p.pos, 0.3, p.pos.y);
      p.pos.y = W.surface(p.pos.x, p.pos.z, p.pos.y + 1);
      a.root.position.copy(p.pos);
      let dy = p.face - a.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.root.rotation.y += dy * Math.min(1, rdt * 8);
      a.move(sp);
      if (people) people.push(p.circle || (p.circle = { x: 0, z: 0, r: 0.35, crowd: true, cast: true, dive: (dir) => dive(p, dir) }));
      if (p.circle) { p.circle.x = p.pos.x; p.circle.z = p.pos.z; }
    }
  }
  // dir: {x, z} the way to step (a vehicle's side); the other side is tried when that one is blocked
  function dive(p, dir) {
    if (p.dive) return true;
    let dx = dir && Number.isFinite(dir.x) ? dir.x : 1, dz = dir && Number.isFinite(dir.z) ? dir.z : 0;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    for (const s of [1, -1]) {
      const x1 = p.pos.x + dx * s * 1.7, z1 = p.pos.z + dz * s * 1.7;
      if (blocked(x1, z1) || blocked((p.pos.x + x1) / 2, (p.pos.z + z1) / 2)) continue;
      p.dive = { t: 0, x0: p.pos.x, z0: p.pos.z, x1, z1 };
      p.face = Math.atan2(dx * s, dz * s);
      return true;
    }
    return false;
  }
  function scatter(x, z, r) {
    for (const p of peds) {
      const dx = p.pos.x - x, dz = p.pos.z - z, d = Math.hypot(dx, dz);
      if (d > r) continue;
      p.flee = 3 + rand() * 2; p.fleeDir.set(d > 0.01 ? dx / d : 1, d > 0.01 ? dz / d : 0);
      p.state = 'flee';
    }
  }
  function clear() { for (const p of peds.slice()) remove(p); }
  return {
    update, scatter, clear,
    setDensity(k) { density = Math.max(0, Math.min(2, +k || 0)); },
    get density() { return density; }, get list() { return peds; }, lines: LINES,
  };
}

/* ------------------------------------------------------------------ followers */
// Slots behind the hero: two columns, 1.9 m back and 1.1 m out, a row every 1.6 m.
export function createFollowers(S) {
  const list = [];
  const blockedAt = (x, z, r = 0.35) => { let hit = false; const C = S.world && S.world.colliders; if (C && C.query) C.query(x, z, r, () => { hit = true; return false; }); return hit; };
  const tv = new THREE.Vector3();
  function slot(i, out) {
    const H = S.hero, f = H.face || 0, row = Math.floor(i / 2), side = i % 2 ? -1 : 1;
    const back = 1.9 + row * 1.6, lat = side * 1.1;
    return out.set(H.pos.x - Math.sin(f) * back + Math.cos(f) * lat, 0, H.pos.z - Math.cos(f) * back - Math.sin(f) * lat);
  }
  function fade(e, k) {
    e.a.root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of [].concat(o.material)) {
        if (m.userData.shared) continue; // shared prop materials keep their look
        if (m.userData.fadeBase == null) m.userData.fadeBase = m.opacity;
        const t = k < 0.999; if (m.transparent !== t && !m.userData.shared) { m.transparent = t; m.needsUpdate = true; }
        m.opacity = m.userData.fadeBase * k;
      }
    });
  }
  function update(rdt) {
    const H = S.hero; if (!H || !H.pos) return;
    const W = S.world;
    list.forEach((e, i) => {
      const a = e.a;
      if (e.board) { // walk to the door, fade out, take a seat
        const v = e.board, door = v.doorPoint ? v.doorPoint('slide') : v.pos;
        const dx = door.x - e.pos.x, dz = door.z - e.pos.z, d = Math.hypot(dx, dz);
        if (!e.fading && d > 0.6) { const sp = d > 4 ? 4.5 : 1.6; e.pos.x += dx / d * Math.min(d, sp * rdt); e.pos.z += dz / d * Math.min(d, sp * rdt); e.face = Math.atan2(dx, dz); a.move(sp); }
        else { e.fading = Math.min(1, (e.fading || 0) + rdt / 0.35); a.move(0); fade(e, 1 - e.fading); if (e.fading >= 1) { e.seated = true; a.visible = false; fade(e, 1); if (S.drive && S.drive.seat) { const seats = v.seats || []; const k = seats.findIndex((s, j) => j >= 2 && !s); if (k >= 0) S.drive.seat(a, v, k); } e.board = null; e.fading = 0; } }
      } else if (e.dv) { // a sidestep out of a vehicle's way
        e.dv.t += rdt; const k = Math.min(1, e.dv.t / 0.4), q = k * k * (3 - 2 * k);
        e.pos.x = e.dv.x0 + (e.dv.x1 - e.dv.x0) * q; e.pos.z = e.dv.z0 + (e.dv.z1 - e.dv.z0) * q; a.move(3.5 * (1 - k));
        if (k >= 1) e.dv = null;
      } else if (e.seated) {
        // waits in the van until the hero is on foot again (unboard)
        return;
      } else if (e.appear != null) {
        e.appear = Math.min(1, e.appear + rdt / 0.35); fade(e, e.appear); if (e.appear >= 1) e.appear = null;
      } else {
        slot(e.slot ?? i, tv);
        const dx = tv.x - e.pos.x, dz = tv.z - e.pos.z, d = Math.hypot(dx, dz);
        // arrive: run when far, walk when close, stop inside 0.35 m
        const sp = d > 6 ? 5.2 : d > 1.2 ? 1.5 + (d - 1.2) * 0.6 : d > 0.35 ? 1.2 : 0;
        if (sp > 0) { e.pos.x += dx / d * Math.min(d, sp * rdt); e.pos.z += dz / d * Math.min(d, sp * rdt); e.face = Math.atan2(dx, dz); }
        else e.face = H.face || 0;
        // keep apart from each other
        for (const o of list) if (o !== e && !o.seated) { const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, od = Math.hypot(ox, oz); if (od > 1e-3 && od < 0.8) { e.pos.x += ox / od * (0.8 - od) * 0.5; e.pos.z += oz / od * (0.8 - od) * 0.5; } }
        if (d > 40) { e.pos.copy(tv); } // left far behind (a cut, a teleport): catch up at once
        a.move(sp);
      }
      if (W && W.colliders && W.colliders.resolveCircle) W.colliders.resolveCircle(e.pos, 0.3, e.pos.y);
      if (W && W.surface) e.pos.y = W.surface(e.pos.x, e.pos.z, e.pos.y + 1);
      a.root.position.copy(e.pos);
      let dy = e.face - a.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.root.rotation.y += dy * Math.min(1, rdt * 9);
      const people = S.vehicles && S.vehicles.people;
      if (people && !e.seated) { e.circle.x = e.pos.x; e.circle.z = e.pos.z; people.push(e.circle); }
    });
  }
  const api = {
    list,
    add(a, o = {}) {
      if (!a || list.some((e) => e.a === a)) return;
      const e = { a, slot: o.slot, pos: a.root.position.clone(), face: a.root.rotation.y, board: null, seated: false, appear: null, fading: 0 };
      e.circle = { x: e.pos.x, z: e.pos.z, r: 0.35, follower: true, cast: true, dive: (dir) => {
        if (e.dv) return true;
        let dx = dir && Number.isFinite(dir.x) ? dir.x : 1, dz = dir && Number.isFinite(dir.z) ? dir.z : 0; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        for (const sd of [1, -1]) { const x1 = e.pos.x + dx * sd * 1.7, z1 = e.pos.z + dz * sd * 1.7; if (blockedAt(x1, z1)) continue; e.dv = { t: 0, x0: e.pos.x, z0: e.pos.z, x1, z1 }; return true; }
        return false;
      } };
      list.push(e);
    },
    remove(a) { const i = list.findIndex((e) => e.a === a); if (i >= 0) { fade(list[i], 1); list.splice(i, 1); } },
    // board(v): every follower walks to v's sliding door and gets in. board(null): the seated ones get out
    // at their van's door and follow again.
    board(v) {
      for (const e of list) {
        if (v) { if (!e.seated) e.board = v; }
        else if (e.seated) {
          const van = e.van || (S.vehicles && S.vehicles.player);
          const door = van && van.doorPoint ? van.doorPoint('slide') : S.hero.pos;
          if (S.drive && S.drive.unseat) S.drive.unseat(e.a);
          e.pos.set(door.x, door.y || 0, door.z); e.seated = false; e.a.visible = true; e.appear = 0; fade(e, 0);
        }
        if (v) e.van = v;
      }
    },
    update,
    clear() { list.length = 0; },
  };
  return api;
}
