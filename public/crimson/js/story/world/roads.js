// js/story/world/roads.js : Sedona's roads (design 3.3). The table of polylines, Catmull-Rom smoothing, the
// road graph with A* for GPS and AI routes, lanes, sampling and nearest-point queries. Pure JS, no three.js:
// the terrain worker imports it to grade the ground and draw the road mask, and sedona.js wraps it as
// S.world.roads. x,z in meters, +x east, -z north. Traffic drives on the right: lane +1 is the right of the
// road's forward direction, lane -1 the left (driven the other way).
import { PLACES, point, up } from './places.js';

// width: full asphalt or dirt width; flat: extra flat ground each side (towns, lots); lanes: 2 two-way, 1 one-way;
// surface: asphalt | dirt; speed: the limit in m/s; rails: guardrails; bridges: [{a, b, y, id}] flat decks.
// Roads that start or end within 30 m of another road join it there.
export const ROADS = Object.freeze([
  { id: 'y_ring', name: 'THE Y', ring: { x: 60, z: 40, r: 17 }, width: 9, lanes: 1, surface: 'asphalt', speed: 9, flat: 6 },
  { id: 'a89w', name: '89A WEST', pts: [[-1010, 172], [-880, 160], [-650, 140], [-380, 110], [-150, 72], [-40, 55], [43, 43]], width: 10, lanes: 2, surface: 'asphalt', speed: 16, flat: 8 },
  { id: 'a89u', name: '89A UPTOWN', pts: [[73, 27], [120, -8], [225, -88], [318, -160]], width: 11, lanes: 2, surface: 'asphalt', speed: 12, flat: 10, sidewalk: true },
  { id: 'a89c', name: '89A CANYON', pts: [[318, -160], [340, -206], [372, -262], [400, -330], [416, -400], [425, -455], [428.3, -491.7], [431.7, -528.3], [435, -565], [445, -606], [470, -650], [500, -690], [502, -740], [497, -800], [510, -880], [548, -950], [566, -1010]], width: 8, lanes: 2, surface: 'asphalt', speed: 14, flat: 2, rails: true, bridges: [{ id: 'midgley', a: [425, -455], b: [435, -565], y: 62 }] },
  { id: 'r179', name: 'SR 179', pts: [[72, 57], [150, 130], [182, 300], [236, 500], [240, 620], [232, 760], [208, 880], [180, 1010]], width: 9, lanes: 2, surface: 'asphalt', speed: 15, flat: 3, bridges: [{ id: 'r179_bridge', a: [150, 130], b: [160, 176], y: null }] },
  { id: 'airport', name: 'AIRPORT RD', pts: [[-130, 67], [-136, 140], [-146, 208], [-196, 262], [-244, 300]], width: 7, lanes: 2, surface: 'asphalt', speed: 11, flat: 3 },
  { id: 'coffeepot', name: 'COFFEE POT DR', pts: [[-520, 124], [-526, 20], [-532, -80], [-540, -150]], width: 6, lanes: 2, surface: 'dirt', speed: 9, flat: 2 },
  { id: 'drycreek', name: 'DRY CREEK RD', pts: [[-700, 144], [-722, 0], [-742, -200], [-764, -420], [-820, -560], [-880, -622]], width: 7, lanes: 2, surface: 'asphalt', speed: 13, flat: 2 },
  { id: 'backo', name: "BACK O' BEYOND", pts: [[194, 400], [120, 440], [40, 500], [-40, 540]], width: 7, lanes: 2, surface: 'asphalt', speed: 11, flat: 2 },
  { id: 'crossing', name: 'CROSSING TRAIL', pts: [[-40, 540], [-110, 550], [-180, 544], [-232, 540]], width: 5, lanes: 2, surface: 'dirt', speed: 7, flat: 3 },
  { id: 'schnebly', name: 'SCHNEBLY HILL RD', pts: [[155, 172], [250, 150], [340, 108], [440, 80], [520, 62], [620, 70], [720, 64], [800, 70], [888, 60]], width: 7, lanes: 2, surface: 'dirt', speed: 9, flat: 2 },
  { id: 'fr9', name: 'FOREST ROAD 9', pts: [[500, -690], [540, -700], [600, -706], [670, -708], [730, -720], [790, -742], [815, -756]], width: 6, lanes: 2, surface: 'dirt', speed: 8, flat: 2, gate: [730, -720], bridges: [{ id: 'fr9_bridge', a: [522, -697], b: [556, -703], y: null }] },
  { id: 'aframe_dr', name: 'CREEKSIDE DR', pts: [[340, -206], [390, -236], [430, -268], [458, -292], [482, -312], [520, -324], [544, -326]], width: 5, lanes: 2, surface: 'dirt', speed: 7, flat: 2, bridges: [{ id: 'creek_bridge', a: [458, -292], b: [482, -312], y: null }] },
  { id: 'lot_midgley', name: 'MIDGLEY LOT', pts: [[444, -600], [420, -592], [396, -586]], width: 7, lanes: 2, surface: 'asphalt', speed: 5, flat: 6 },
  { id: 'lot_fleet', name: 'CANYON FLEET', pts: [[-620, 137], [-620, 170]], width: 8, lanes: 2, surface: 'asphalt', speed: 5, flat: 6 },
  { id: 'lot_gas', name: 'RED DIRT GAS', pts: [[-470, 121], [-470, 148]], width: 8, lanes: 2, surface: 'asphalt', speed: 5, flat: 6 },
  { id: 'lot_sunline', name: 'RED ROCK PLAZA', pts: [[-560, 130], [-560, 82]], width: 8, lanes: 2, surface: 'asphalt', speed: 5, flat: 6 },
  { id: 'lot_motel', name: 'MOTOR LODGE', pts: [[-300, 97], [-300, 146]], width: 8, lanes: 2, surface: 'asphalt', speed: 5, flat: 6 },
  { id: 'lot_diner', name: 'MOONRISE DINER', pts: [[204, 930], [160, 930]], width: 8, lanes: 2, surface: 'asphalt', speed: 5, flat: 6 },
  { id: 'lot_bar', name: 'BAR LOT', pts: [up(0.6, 4), up(0.6, 13)], width: 7, lanes: 2, surface: 'asphalt', speed: 5, flat: 5 },
  { id: 'lot_airstream', name: 'AIRSTREAM', pts: [[-540, -150], [-541, -168]], width: 6, lanes: 2, surface: 'dirt', speed: 4, flat: 4 },
]);
// Parking lots and yards: painted as ground (asphalt or dirt) in the terrain shader. Rectangles.
export const LOTS = Object.freeze([
  { x: -620, z: 172, w: 44, d: 30, yaw: 0, surface: 'asphalt' }, { x: -470, z: 150, w: 36, d: 24, yaw: 0, surface: 'asphalt' },
  { x: -560, z: 82, w: 50, d: 22, yaw: 0, surface: 'asphalt' }, { x: -300, z: 145, w: 40, d: 20, yaw: 0, surface: 'asphalt' },
  { x: 158, z: 930, w: 30, d: 28, yaw: 0, surface: 'asphalt' }, { x: up(0.63, 19)[0], z: up(0.63, 19)[1], w: 34, d: 14, yaw: 0.647, surface: 'asphalt' },
  { x: 396, z: -585, w: 30, d: 20, yaw: 0.2, surface: 'asphalt' }, { x: 815, z: -760, w: 70, d: 50, yaw: 0, surface: 'dirt' },
  { x: 547, z: -327, w: 18, d: 14, yaw: 0.3, surface: 'dirt' }, { x: -540, z: -164, w: 18, d: 14, yaw: 0, surface: 'dirt' },
  { x: -880, z: -630, w: 20, d: 16, yaw: 0.8, surface: 'dirt' },
  { x: -40, z: 540, w: 18, d: 14, yaw: 0, surface: 'dirt' }, { x: 890, z: 60, w: 22, d: 16, yaw: 0, surface: 'dirt' },
  { x: -140, z: 210, w: 16, d: 12, yaw: 0.6, surface: 'asphalt' }, { x: -250, z: 316, w: 50, d: 24, yaw: 0.7, surface: 'asphalt' },
  { x: 230, z: 690, w: 10, d: 8, yaw: 0, surface: 'dirt' }, { x: -248, z: 546, w: 24, d: 16, yaw: 0.1, surface: 'dirt' },
]);
export const LANE_OFFSET = 2.6;

/* ------------------------------------------------------------------ smoothing */
// centripetal Catmull-Rom through the points, sampled about every `step` meters; bridge spans stay straight
function catmull(pts, step, straight) {
  const out = [];
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / step));
    const lin = straight(p1, p2);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      if (lin) { out.push({ x: p1[0] + (p2[0] - p1[0]) * t, z: p1[1] + (p2[1] - p1[1]) * t }); continue; }
      // centripetal parametrisation (alpha 0.5) avoids loops and cusps on uneven spacing
      const d = (a, b) => Math.max(1e-3, Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5));
      const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), u = t1 + (t2 - t1) * t;
      const lerp2 = (a, b, ta, tb) => { const k = (u - ta) / (tb - ta || 1); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
      const A1 = lerp2(p0, p1, t0, t1), A2 = lerp2(p1, p2, t1, t2), A3 = lerp2(p2, p3, t2, t3);
      const B1 = lerp2(A1, A2, t0, t2), B2 = lerp2(A2, A3, t1, t3), C = lerp2(B1, B2, t1, t2);
      out.push({ x: C[0], z: C[1] });
    }
  }
  const e = pts[pts.length - 1]; out.push({ x: e[0], z: e[1] });
  return out;
}
const onSeg = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2; return t > -0.01 && t < 1.01 && Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / Math.sqrt(L2) < 0.5; };

/* ------------------------------------------------------------------ the network */
// Builds every road's line (samples every ~4 m with cumulative length), junctions, the graph and lanes.
export function buildNetwork() {
  const roads = [], byId = {};
  ROADS.forEach((def, idx) => {
    let line;
    if (def.ring) { const { x, z, r } = def.ring, n = 48; line = Array.from({ length: n + 1 }, (_, i) => { const a = -i / n * Math.PI * 2; return { x: x + Math.sin(a) * r, z: z + Math.cos(a) * r }; }); }
    else {
      const spans = (def.bridges || []).filter((b) => b.a && b.b);
      line = catmull(def.pts, 4, (p1, p2) => spans.some((b) => onSeg(p1, b.a, b.b) && onSeg(p2, b.a, b.b)));
    }
    const cum = new Float64Array(line.length);
    for (let i = 1; i < line.length; i++) cum[i] = cum[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z);
    const r = { ...def, idx: idx + 1, line, cum, len: cum[line.length - 1], closed: !!def.ring, hw: def.width / 2 };
    // bridge spans as s ranges on this road
    r.spans = (def.bridges || []).map((b) => { const s0 = project(r, b.a[0], b.a[1]).s, s1 = project(r, b.b[0], b.b[1]).s; return { id: b.id, s0: Math.min(s0, s1), s1: Math.max(s0, s1), y: b.y }; });
    roads.push(r); byId[r.id] = r;
  });
  // junctions: an open road's end within 30 m of another road joins it there
  const joins = [];
  for (const r of roads) {
    if (r.closed) continue;
    for (const end of [0, 1]) {
      const p = end ? r.line[r.line.length - 1] : r.line[0];
      let best = null;
      for (const o of roads) {
        if (o === r) continue;
        const q = project(o, p.x, p.z);
        if (q.d < 30 && (!best || q.d < best.q.d)) best = { o, q };
      }
      if (best) joins.push({ road: r, end, s: end ? r.len : 0, other: best.o, os: best.q.s, x: best.q.x, z: best.q.z });
    }
  }
  // graph nodes: each road's ends and every point another road joins it
  const nodes = [], edges = [], adj = [];
  const nodeAt = (x, z) => { for (const n of nodes) if (Math.hypot(n.x - x, n.z - z) < 1.5) return n.id; nodes.push({ id: nodes.length, x, z }); adj.push([]); return nodes.length - 1; };
  const cuts = new Map(roads.map((r) => [r, new Set(r.closed ? [0] : [0, r.len])]));
  for (const j of joins) cuts.get(j.other).add(j.os);
  const nodeOf = new Map();
  for (const r of roads) {
    const ss = [...cuts.get(r)].sort((a, b) => a - b);
    const ids = ss.map((s) => { const p = at(r, s); return nodeAt(p.x, p.z); });
    nodeOf.set(r, { ss, ids });
    const link = (i, k, s0, s1) => { if (ids[i] === ids[k]) return; const e = { id: edges.length, a: ids[i], b: ids[k], road: r.id, s0, s1, len: Math.abs(s1 - s0) }; edges.push(e); adj[e.a].push(e); adj[e.b].push(e); };
    for (let i = 0; i < ss.length - 1; i++) link(i, i + 1, ss[i], ss[i + 1]);
    if (r.closed) link(ss.length - 1, 0, ss[ss.length - 1], r.len);
  }
  // connectors from each joining end to the point it joins
  for (const j of joins) {
    const a = nodeOf.get(j.road), b = nodeOf.get(j.other);
    const ia = a.ids[a.ss.indexOf(j.s)], ib = b.ids[b.ss.indexOf(j.os)];
    if (ia === ib || ia == null || ib == null) continue;
    const e = { id: edges.length, a: ia, b: ib, road: null, len: Math.hypot(nodes[ia].x - nodes[ib].x, nodes[ia].z - nodes[ib].z) };
    edges.push(e); adj[ia].push(e); adj[ib].push(e);
  }
  // segment hash for nearest(): 50 m cells
  const cell = 50, hash = new Map();
  for (const r of roads) for (let i = 0; i < r.line.length - 1; i++) {
    const a = r.line[i], b = r.line[i + 1];
    const x0 = Math.floor((Math.min(a.x, b.x) - 10) / cell), x1 = Math.floor((Math.max(a.x, b.x) + 10) / cell);
    const z0 = Math.floor((Math.min(a.z, b.z) - 10) / cell), z1 = Math.floor((Math.max(a.z, b.z) + 10) / cell);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const k = cx * 4096 + cz; let l = hash.get(k); if (!l) hash.set(k, (l = [])); l.push(r.idx, i); }
  }
  const lanes = [];
  for (const r of roads) {
    if (r.lanes === 1) lanes.push({ id: `${r.id}+1`, road: r.id, lane: 0, dir: 1, offset: 0, speed: r.speed, len: r.len, closed: r.closed, surface: r.surface });
    else for (const lane of [1, -1]) lanes.push({ id: `${r.id}${lane > 0 ? '+' : '-'}1`, road: r.id, lane, dir: lane, offset: LANE_OFFSET * lane, speed: r.speed, len: r.len, closed: r.closed, surface: r.surface });
  }
  return { roads, byId, nodes, edges, adj, joins, hash, cell, lanes };
}

// closest point on a road to (x,z): {s, x, z, d, i, side} (side: +1 right of forward, -1 left)
export function project(r, x, z, i0 = 0, i1 = r.line.length - 1) {
  let best = { s: 0, x: r.line[0].x, z: r.line[0].z, d: Infinity, i: 0, side: 1 };
  for (let i = Math.max(0, i0); i < Math.min(i1, r.line.length - 1); i++) {
    const a = r.line[i], b = r.line[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    let t = ((x - a.x) * dx + (z - a.z) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a.x + dx * t, pz = a.z + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { s: r.cum[i] + Math.sqrt(L2) * t, x: px, z: pz, d, i, side: (x - a.x) * dz - (z - a.z) * dx > 0 ? -1 : 1 };
  }
  return best;
}
// the point at arc length s along a road's centreline, with its forward yaw (0 looks toward +z)
export function at(r, s) {
  const L = r.len;
  s = r.closed ? ((s % L) + L) % L : Math.max(0, Math.min(L, s));
  let lo = 0, hi = r.line.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.cum[m] <= s) lo = m; else hi = m; }
  const a = r.line[lo], b = r.line[hi], seg = r.cum[hi] - r.cum[lo] || 1, t = (s - r.cum[lo]) / seg;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
}

/* ------------------------------------------------------------------ queries (net from buildNetwork) */
export function nearest(net, x, z, maxR = 2000) {
  const { cell, hash, roads } = net;
  let best = null;
  const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
  for (let ring = 0; ring * cell < maxR + cell; ring++) {
    for (let i = -ring; i <= ring; i++) for (let k = -ring; k <= ring; k++) {
      if (Math.max(Math.abs(i), Math.abs(k)) !== ring) continue;
      const l = hash.get((cx + i) * 4096 + (cz + k)); if (!l) continue;
      for (let n = 0; n < l.length; n += 2) {
        const r = roads[l[n] - 1], q = project(r, x, z, l[n + 1], l[n + 1] + 1);
        if (!best || q.d < best.d) best = { ...q, road: r.id, r };
      }
    }
    // a hit closer than the ring's inner edge cannot be beaten by a farther ring
    if (best && best.d < ring * cell) break;
  }
  if (!best) return { x, z, road: null, dist: Infinity, s: 0, yaw: 0 };
  const p = at(best.r, best.s);
  return { x: best.x, z: best.z, road: best.road, dist: best.d, s: best.s, yaw: p.yaw, side: best.side };
}
// A position on a lane: lane +1 right of the forward direction, -1 left (facing back), 0 the centre
export function sample(net, roadId, s, lane = 1) {
  const r = net.byId[roadId]; if (!r) return null;
  const p = at(r, s), off = r.lanes === 1 ? 0 : LANE_OFFSET * Math.sign(lane || 0);
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); // forward
  return { x: p.x - fz * off, z: p.z + fx * off, yaw: lane < 0 ? p.yaw + Math.PI : p.yaw, s, road: roadId };
}
// A* over the graph from any point to any point: [{x,z}], starting and ending at the given points
export function route(net, from, to) {
  const A = typeof from === 'string' ? point(from) : from, Bp = typeof to === 'string' ? point(to) : to;
  if (!A || !Bp) return [];
  const na = nearest(net, A.x, A.z), nb = nearest(net, Bp.x, Bp.z);
  if (!na.road || !nb.road) return [{ x: A.x, z: A.z }, { x: Bp.x, z: Bp.z }];
  const { nodes, edges, adj, byId } = net;
  // the edge a road point lies on
  const edgeOf = (q) => edges.find((e) => e.road === q.road && ((q.s >= Math.min(e.s0, e.s1) - 1e-6 && q.s <= Math.max(e.s0, e.s1) + 1e-6)));
  const ea = edgeOf(na), eb = edgeOf(nb);
  const pts = [{ x: A.x, z: A.z }];
  const along = (road, s0, s1) => { const r = byId[road], out = [], n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / 8)); for (let i = 0; i <= n; i++) { const p = at(r, s0 + (s1 - s0) * i / n); out.push({ x: p.x, z: p.z }); } return out; };
  const finish = (list) => { for (const p of list) { const l = pts[pts.length - 1]; if (Math.hypot(p.x - l.x, p.z - l.z) > 0.5) pts.push(p); } const l = pts[pts.length - 1]; if (Math.hypot(Bp.x - l.x, Bp.z - l.z) > 0.5) pts.push({ x: Bp.x, z: Bp.z }); return pts; };
  if (!ea || !eb) return finish([]);
  if (ea === eb) return finish(along(na.road, na.s, nb.s));
  // costs from the start point to the two ends of its edge
  const sAt = (e, n) => (n === e.a ? e.s0 : e.s1);
  const g = new Float64Array(nodes.length).fill(Infinity), prev = new Array(nodes.length).fill(null), open = new Set();
  const h = (n) => Math.hypot(nodes[n].x - nb.x, nodes[n].z - nb.z);
  for (const n of [ea.a, ea.b]) { const c = ea.road ? Math.abs(sAt(ea, n) - na.s) : 0; if (c < g[n]) { g[n] = c; prev[n] = { start: true }; open.add(n); } }
  const goal = new Map([[eb.a, Math.abs(sAt(eb, eb.a) - nb.s)], [eb.b, Math.abs(sAt(eb, eb.b) - nb.s)]]);
  let bestEnd = null, bestCost = Infinity;
  while (open.size) {
    let cur = -1, f = Infinity;
    for (const n of open) { const v = g[n] + h(n); if (v < f) { f = v; cur = n; } }
    open.delete(cur);
    if (f >= bestCost) break;
    if (goal.has(cur)) { const c = g[cur] + goal.get(cur); if (c < bestCost) { bestCost = c; bestEnd = cur; } }
    for (const e of adj[cur]) {
      const nx = e.a === cur ? e.b : e.a, c = g[cur] + e.len;
      if (c < g[nx]) { g[nx] = c; prev[nx] = { from: cur, e }; open.add(nx); }
    }
  }
  if (bestEnd == null) return finish([]);
  const chain = [];
  for (let n = bestEnd; prev[n] && !prev[n].start; n = prev[n].from) chain.unshift(prev[n]);
  const first = chain.length ? chain[0].from : bestEnd;
  const list = [...along(na.road, na.s, sAt(ea, first))];
  for (const step of chain) {
    const e = step.e, to = e.a === step.from ? e.b : e.a;
    if (e.road) list.push(...along(e.road, sAt(e, step.from), sAt(e, to)));
    else list.push({ x: nodes[to].x, z: nodes[to].z });
  }
  list.push(...along(nb.road, sAt(eb, bestEnd), nb.s));
  return finish(list);
}
export const placeXZ = (id) => PLACES[id] || point(id);
