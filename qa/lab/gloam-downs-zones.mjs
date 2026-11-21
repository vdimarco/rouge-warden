// Gloam Downs: the combat run's zones on the baked walk maps. Ported from the design survey (check-zones.mjs, walls2.mjs and plan2.mjs
// in the session's scratch folder), with the rules of the spec:
//   - the table: lib/zones.mjs and each baked <id>.json hold the same zones; each centre is on the walk map's floor and can be reached;
//   - the wake rule: a zone wakes within 10 m of its centre when its foes and the awake foes come to 6 or fewer and the pool has a free
//     slot of the right type for each of its foes; it sleeps beyond 16 m (in this model its foes are always home when it sleeps);
//   - the guard rule: a guard zone always wakes; other zones give up their slots, the farthest from the lamplighter first, and only
//     those whose slots help (a type the guard is short of, or the cap of 6);
//   - every route walked twice (lib/zones.mjs ROUTES): by a runner, who clears only the guard zone, and by a fighter, who clears each
//     zone it wakes; never more than 6 awake, never more of a type than the pool holds; each waypoint on the floor and in reach;
//   - every point that can be reached: never more than 6 awake;
//   - the Ironback walls: a floor (the one under any gap, so not the top of an overhang) 2 m or more higher 0.5 m on, within 3 m past
//     the leash of each zone with an Ironback;
//   - the distances: each guard zone to its beacon, and no other zone within 25 m of the arena.
// Run alone: node qa/lab/gloam-downs-zones.mjs   (prints a report; exits with 1 on a failure)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, reachable } from '../../public/lab/gloam-downs/play.js';
import { ZONES, POOLS, ROUTES, zoneJson, poolTypes } from '../../games/gloam-downs/lib/zones.mjs';
import { freeSlots, fits, makeRoom } from '../../public/lab/gloam-downs/foes.js';

export const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/worlds/', import.meta.url));
export const PLACES = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
export const RULE = { wake: 10, sleep: 16, cap: 6, guardReach: 26, wallRise: 2, wallWithin: 0.5, wallPast: 3, arenaClear: 25 };

export function loadWalk(id, dir = DIR) {
  const meta = JSON.parse(fs.readFileSync(`${dir}${id}.json`, 'utf8'));
  const raw = zlib.gunzipSync(fs.readFileSync(`${dir}${id}.walk.bin.gz`));
  return { meta, walk: makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1)) };
}
const floorAt = (walk, x, z) => walk.support(x, z, walk.top(x, z) + 0.01);
const foesOf = z => [...z.foes].filter(t => 'SPMI'.includes(t));
const dist = (a, x, z) => Math.hypot(a.c[0] - x, a.c[2] - z);

/* ---------------- the wake rule ----------------
   The page's own rule, from public/lab/gloam-downs/foes.js, so the page and this check share it. free(pool, awake): the slots of each
   type the awake zones leave free. fits(zone, awake, pool): the zone's foes and the awake foes come to 6 or fewer, and there is a free
   slot of the right type for each of its foes. makeRoom(guard, awake, pool, x, z): the zones that give up their slots (farthest from
   (x, z) first, only those that help), or null when even all of them do not make room */
export { freeSlots, fits, makeRoom };

/* ---------------- a walk along a route ----------------
   Points every 0.5 m along the waypoints. At each point a zone not cleared and asleep wakes within 10 m if it fits (a guard zone takes
   the room it needs), and an awake zone sleeps beyond 16 m. A runner clears only the guard zone (it fights the keepers), a fighter
   each zone it wakes. Returns the most foes awake at once, the most of each type, the order zones woke in and the zones that waited. */
export const walkRoute = (id, mode) => walkPath(id, ROUTES[id], mode);
// the same walk along any waypoints [x, y, z] (a test walks out of a zone's reach and back)
export function walkPath(id, wp, mode) {
  const zones = ZONES[id].filter(z => !z.boss), pool = poolTypes(id), pts = [];
  for (let k = 0; k < wp.length - 1; k++) {
    const a = wp[k], b = wp[k + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.5));
    for (let i = 0; i < n; i++) pts.push([a[0] + ((b[0] - a[0]) * i) / n, a[2] + ((b[2] - a[2]) * i) / n]);
  }
  pts.push([wp.at(-1)[0], wp.at(-1)[2]]);
  let awake = [];
  const cleared = new Set(), order = [], waited = new Set(), gaveUp = [];
  let most = 0, mostType = {};
  for (const [x, z] of pts) {
    awake = awake.filter(q => dist(q, x, z) <= RULE.sleep);
    for (const q of zones) {
      if (cleared.has(q.id) || awake.includes(q) || dist(q, x, z) >= RULE.wake) continue;
      if (fits(q, awake, pool)) { awake.push(q); order.push(q.id); continue; }
      if (q.guard) {
        const room = makeRoom(q, awake, pool, x, z);
        if (room) { awake = [...room.keep, q]; order.push(q.id); gaveUp.push(...room.gone.map(g => g.id)); continue; }
      }
      waited.add(q.id);
    }
    const types = {};
    for (const q of awake) for (const t of foesOf(q)) types[t] = (types[t] || 0) + 1;
    most = Math.max(most, Object.values(types).reduce((s, v) => s + v, 0));
    for (const t in types) mostType[t] = Math.max(mostType[t] || 0, types[t]);
    for (const q of awake) if (mode === 'fighter' || q.guard) { cleared.add(q.id); }
    awake = awake.filter(q => !cleared.has(q.id));
  }
  return { most, mostType, order, waited: [...waited], gaveUp };
}

/* ---------------- every guard can wake ----------------
   From each reachable grid point within 10 m of a guard's centre (1 m apart): the other zones whose centre is within 16 m of that point
   are awake there, as many as fit (nearest first). The guard must then fit, or make room by the guard rule. A zone farther off can be
   awake there too while its foes chase or walk home (foes.js: they give up 4 s after the lamplighter leaves their leash plus 8 m, and
   walk home), so the check is made again with every other zone of the place awake that fits, nearest first */
export function guardCheck(id, walk, R) {
  const zones = ZONES[id], pool = poolTypes(id), out = [];
  for (const g of zones.filter(q => q.guard && !q.boss)) {
    let points = 0, room = 0, failed = 0, chased = 0, most = 0;
    for (let x = g.c[0] - RULE.wake; x <= g.c[0] + RULE.wake; x += 1)
      for (let z = g.c[2] - RULE.wake; z <= g.c[2] + RULE.wake; z += 1) {
        if (Math.hypot(x - g.c[0], z - g.c[2]) >= RULE.wake) continue;
        const y = floorAt(walk, x, z);
        if (y === null || !R.near([x, y + 0.5, z], 0.6)) continue;
        points++;
        for (const chase of [false, true]) {
          const awake = [];
          for (const q of zones.filter(q => q !== g && !q.boss && (chase || dist(q, x, z) <= RULE.sleep)).sort((a, b) => dist(a, x, z) - dist(b, x, z)))
            if (fits(q, awake, pool)) awake.push(q);
          if (fits(g, awake, pool)) continue;
          const r = makeRoom(g, awake, pool, x, z);
          if (!r) { failed++; if (chase) chased++; }
          else if (!chase) { room++; most = Math.max(most, r.gone.length); }
        }
      }
    out.push({ guard: g.id, points, room, failed, chased, most, reach: zones.filter(q => q !== g && !q.boss && dist(q, g.c[0], g.c[2]) <= RULE.guardReach).map(q => q.id) });
  }
  return out;
}

/* ---------------- every point that can be reached ----------------
   At each reachable grid point (1 m apart), the zones within 10 m wake in order of distance while they fit (a guard takes the room
   it needs). Returns the most foes awake at any point, and the most foes whose zones are within 16 m (in range, awake or not). */
export function everyPoint(id, walk, R, meta) {
  const zones = ZONES[id].filter(z => !z.boss), pool = poolTypes(id), lim = meta.bounds - 0.6;
  let most = 0, inRange = 0, at = null;
  for (let x = -lim; x <= lim; x += 1) for (let z = -lim; z <= lim; z += 1) {
    const y = floorAt(walk, x, z);
    if (y === null || !R.near([x, y + 0.5, z], 0.6)) continue;
    let awake = [];
    for (const q of zones.filter(q => dist(q, x, z) < RULE.wake).sort((a, b) => dist(a, x, z) - dist(b, x, z))) {
      if (fits(q, awake, pool)) awake.push(q);
      else if (q.guard) { const r = makeRoom(q, awake, pool, x, z); if (r) awake = [...r.keep, q]; }
    }
    const n = awake.reduce((s, q) => s + foesOf(q).length, 0), r16 = zones.filter(q => dist(q, x, z) <= RULE.sleep).reduce((s, q) => s + foesOf(q).length, 0);
    if (n > most) most = n;
    if (r16 > inRange) { inRange = r16; at = [x, z]; }
  }
  return { most, inRange, at };
}

/* ---------------- the walls round an Ironback ----------------
   On bearings 3° apart from the zone's centre: the first point out to 3 m past the leash where the floor 0.5 m further on is 2 m or
   more over the floor here. The floor is the one under any gap, so the top of an overhang (a tree's crown, a roof over open floor),
   which a charging body runs under, is no wall. Returns the bearings (degrees) and their distances. */
export function ironWalls(walk, zone) {
  const [cx, , cz] = zone.c, L = zone.leash, found = [];
  for (let a = 0; a < 360; a += 3) {
    const s = Math.sin((a * Math.PI) / 180), c = Math.cos((a * Math.PI) / 180);
    for (let r = 0; r + RULE.wallWithin <= L + RULE.wallPast; r += 0.1) {
      const rise = walk.floor(cx + (r + RULE.wallWithin) * s, cz + (r + RULE.wallWithin) * c) - walk.floor(cx + r * s, cz + r * c);
      if (rise >= RULE.wallRise) { found.push([a, +(r + RULE.wallWithin).toFixed(1)]); break; }
    }
  }
  return found;
}

/* ---------------- the whole check ---------------- */
export function survey(dir = DIR) {
  const out = [], ok = (cond, what) => out.push({ ok: !!cond, what });
  for (const id of PLACES) {
    const { meta, walk } = loadWalk(id, dir), zones = ZONES[id], pool = poolTypes(id);
    ok(JSON.stringify(meta.zones) === JSON.stringify(zones.map(zoneJson)), `${id}: the baked JSON holds the zones of lib/zones.mjs`);
    const R = reachable(walk, meta.spawn, meta.bounds);
    for (const z of zones) {
      const y = floorAt(walk, z.c[0], z.c[2]);
      ok(y !== null && Math.abs(y - z.c[1]) <= 0.3, `${id} ${z.id}: its centre's height ${z.c[1]} is the floor there (${y?.toFixed(2)})`);
      ok(R.near([z.c[0], y + 0.5, z.c[2]], 0.8), `${id} ${z.id}: its centre can be reached from the start`);
      ok(foesOf(z).length <= 6, `${id} ${z.id}: ${foesOf(z).length} foes, no more than 6`);
    }
    // the pool holds a slot of every type the zones use, and enough of each for every zone alone
    for (const z of zones) for (const [t, k] of Object.entries(foesOf(z).reduce((n, t) => ((n[t] = (n[t] || 0) + 1), n), {})))
      ok((pool[t] || 0) >= k, `${id} ${z.id}: the pool (${POOLS[id]}) has ${k} ${t} slot(s) for it`);
    // each route's waypoints stand on the floor and can be reached, so a bake that moves the ground shows here
    // (the floor met by feet at the waypoint's height: under an arch that is the floor under the gap, not the arch's top)
    const off = ROUTES[id].filter(([x, y, z]) => { const f = walk.support(x, z, y + 0.5); return f === null || Math.abs(f - y) > 0.6 || !R.near([x, f + 0.5, z], 0.8); });
    ok(!off.length, `${id}: the ${ROUTES[id].length} waypoints of its route are on the floor and can be reached${off.length ? ` (not: ${off.map(p => p.join(',')).join(' ')})` : ''}`);
    const every = everyPoint(id, walk, R, meta);
    ok(every.most <= 6, `${id}: at every point that can be reached, at most 6 foes awake (${every.most}; the most in range is ${every.inRange}, at ${every.at})`);
    for (const mode of ['runner', 'fighter']) {
      const r = walkRoute(id, mode);
      ok(r.most <= 6, `${id}: a ${mode} on the route has at most 6 foes awake (${r.most}; woke ${r.order.join(' ')}${r.waited.length ? `; waited ${r.waited.join(' ')}` : ''}${r.gaveUp.length ? `; gave up slots ${r.gaveUp.join(' ')}` : ''})`);
      ok(Object.entries(r.mostType).every(([t, k]) => k <= (pool[t] || 0)), `${id}: a ${mode} never has more of a type awake than the pool holds (${JSON.stringify(r.mostType)})`);
      const guard = zones.find(z => z.guard && !z.boss);
      if (guard) ok(r.order.includes(guard.id), `${id}: a ${mode} wakes the guard zone ${guard.id}`);
    }
    for (const g of guardCheck(id, walk, R))
      ok(g.points > 0 && g.failed === 0, `${id} ${g.guard}: wakes from each of ${g.points} points within ${RULE.wake} m, also with every other zone awake that fits while its foes chase (${g.room} by taking slots, at most ${g.most} zone(s) giving up theirs; zones within ${RULE.guardReach} m: ${g.reach.join(' ') || 'none'}${g.chased ? `; ${g.chased} fail only with chasing zones` : ''})`);
    for (const z of zones.filter(q => q.foes.includes('I'))) {
      const w = ironWalls(walk, z);
      ok(w.length > 0, `${id} ${z.id}: a wall face of ${RULE.wallRise} m or more within ${RULE.wallPast} m past the leash of ${z.leash} m (bearings ${w.map(([a, r]) => `${a}°:${r}`).join(' ') || 'none'})`);
    }
    for (const g of zones.filter(q => q.guard)) {
      const d = Math.hypot(meta.beacon.p[0] - g.c[0], meta.beacon.p[2] - g.c[2]);
      out.push({ ok: true, what: `${id} ${g.id}: ${d.toFixed(1)} m from the beacon`, d, zone: g.id, place: id });
    }
    const arena = zones.find(z => z.boss);
    if (arena) {
      const near = zones.filter(z => z !== arena && dist(z, arena.c[0], arena.c[2]) < RULE.arenaClear);
      ok(!near.length, `${id}: no other zone within ${RULE.arenaClear} m of the arena${near.length ? ` (${near.map(z => z.id).join(' ')})` : ''}`);
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const res = survey();
  for (const r of res) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.what}`);
  if (res.some(r => !r.ok)) process.exitCode = 1;
}
