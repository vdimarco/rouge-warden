// Gloam Downs: the ledge and stone scan (gloam-downs-growth design.md "Keys and hidden ground"). For each place it runs the reach search
// (play.js reachable) twice: with the controller's PARAMS, and with the jump speed whose top is the two jumps together (10.94 m/s,
// 2.49 m). Floor tops the second search reaches and the first does not are ledge cells; it groups them into patches of 1.5 m² or more.
// For each patch it then plays the real controller (play.js makeBody, and keys.js leap for Crow step) from floor below it, with a few
// timings, and keeps a ledge only when the second jump lands on it and the same inputs with no second jump do not. A sealed stone is
// flat open floor that a plunge from higher ground lands on after a fall of 2 m or more (the fighter's own plunge, moves.js).
// It prints what it found for each place; with --write it puts the chosen spots into keys.js SPOTS.
// Run: node qa/lab/gloam-downs-ledges.mjs [--write]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, reachable, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { makeFighter } from '../../public/lab/gloam-downs/moves.js';
import { leap } from '../../public/lab/gloam-downs/keys.js';
import { ROUTES, ZONES } from '../../games/gloam-downs/lib/zones.mjs';

const W = fileURLToPath(new URL('../../public/lab/gloam-downs/worlds/', import.meta.url));
const KEYS = fileURLToPath(new URL('../../public/lab/gloam-downs/keys.js', import.meta.url));
const PLACES = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
const DT = 1 / 60, CELL = 0.5, LEAP_V = 10.94;
// what each place's caches hold, in the order the spots are chosen (ledges first, then stones)
const PRIZE = { gaol: ['glim', 'spark', 'glim'], ramparts: ['pattern', 'glim', 'flask'], fen: ['ability', 'glim', 'spark'], bells: ['glim', 'pattern', 'spark'], barrows: ['flask', 'glim', 'ability'] };

export function load(id) {
  const meta = JSON.parse(fs.readFileSync(`${W}${id}.json`, 'utf8'));
  const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${W}${id}.walk.bin.gz`)));
  return { meta, walk: makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1)) };
}
// the camera yaw for which the stick's forward (mz 1) walks along (ux, uz)
const camFor = (ux, uz) => Math.atan2(-ux, -uz);

/* play the controller from `from` toward `to`: run up for `run` s, jump, and (with leapAt) press Jump again `leapAt` s after the
   take-off. -> where it stood still at the end, and whether it touched the ledge (feet on the ground within 0.8 m of `to` and 0.3 m of
   its height) */
export function tryLedge(walk, bounds, from, to, way, withLeap) {
  const ux0 = to[0] - from[0], uz0 = to[2] - from[2], l = Math.hypot(ux0, uz0) || 1, ux = ux0 / l, uz = uz0 / l;
  const body = makeBody(walk, { p: [from[0], from[1] + 0.3, from[2]], yaw: Math.atan2(ux, uz) }, bounds, { ...PARAMS });
  const s = body.s, st = { used: false, was: false }, cam = camFor(ux, uz);
  let t = 0, jumpedAt = -1;
  for (let i = 0; i < 240; i++, t += DT) {
    // once over the ledge, the stick lets go, so the feet stop on it
    const over = Math.hypot(s.x - to[0], s.z - to[2]) < 0.5;
    let jump = false;
    if (t >= way.run && jumpedAt < 0) { jump = true; jumpedAt = t; }
    else if (jumpedAt >= 0 && t - jumpedAt < way.hold) jump = true;
    if (withLeap && jumpedAt >= 0 && t - jumpedAt >= way.leapAt && t - jumpedAt < way.leapAt + 0.3) jump = (t - jumpedAt) >= way.leapAt + DT;
    body.step(DT, over ? {} : { mz: 1, jump }, cam);
    if (withLeap) leap(s, st, jump);
    if (s.ground && Math.hypot(s.x - to[0], s.z - to[2]) < 0.8 && Math.abs(s.y - to[1]) < 0.3) return { ok: true, at: [s.x, s.y, s.z], t };
  }
  return { ok: false, at: [s.x, s.y, s.z] };
}
/* a plunge from `from` toward `to`: run, jump (with leap: a second jump too), and Attack at the top. -> where it landed and how far it
   fell (moves.js f.top), or null */
export function tryStone(walk, bounds, from, to, way, withLeap) {
  const ux0 = to[0] - from[0], uz0 = to[2] - from[2], l = Math.hypot(ux0, uz0) || 1, ux = ux0 / l, uz = uz0 / l;
  const body = makeBody(walk, { p: [from[0], from[1] + 0.3, from[2]], yaw: Math.atan2(ux, uz) }, bounds, { ...PARAMS });
  const F = makeFighter(body, walk, { stats: () => ({ drink: 'full' }) }), s = body.s, st = { used: false, was: false }, cam = camFor(ux, uz);
  let jumpedAt = -1, t = 0;
  for (let i = 0; i < 300; i++, t += DT) {
    const over = Math.hypot(s.x - to[0], s.z - to[2]) < 0.4;
    let jump = false, attack = false;
    if (t >= way.run && jumpedAt < 0) { jump = true; jumpedAt = t; }
    else if (jumpedAt >= 0 && t - jumpedAt < way.hold) jump = true;
    if (withLeap && jumpedAt >= 0 && t - jumpedAt >= way.leapAt && t - jumpedAt < way.leapAt + 0.3) jump = (t - jumpedAt) >= way.leapAt + DT;
    if (jumpedAt >= 0 && t - jumpedAt >= way.plungeAt && !s.ground) attack = true;
    const ev = [];
    F.step({ mz: over ? 0 : 1, jump, attack }, cam, [], ev);
    if (withLeap && !F.f.move) leap(s, st, jump);
    const land = ev.find(e => e.type === 'cue' && e.cue === 'land');
    if (land) return { at: [s.x, s.y, s.z], fallen: land.fallen };
    if (jumpedAt >= 0 && s.ground && t - jumpedAt > 0.2 && !F.f.move) return null;
  }
  return null;
}
// a patch's cells grouped by touch (4 ways) and height (0.3 m)
function patches(cells) {
  const key = c => `${c.i},${c.j}`, by = new Map(cells.map(c => [key(c), c])), seen = new Set(), out = [];
  for (const c of cells) {
    if (seen.has(key(c))) continue;
    const q = [c], g = [];
    seen.add(key(c));
    while (q.length) {
      const a = q.pop(); g.push(a);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const b = by.get(`${a.i + di},${a.j + dj}`);
        if (b && !seen.has(key(b)) && Math.abs(b.y - a.y) < 0.3) { seen.add(key(b)); q.push(b); }
      }
    }
    out.push(g);
  }
  return out;
}
const routeD = (id, p) => Math.min(...ROUTES[id].map(r => Math.hypot(r[0] - p[0], r[2] - p[2])));

function scan(id) {
  const { meta, walk } = load(id), b = meta.bounds - 1;
  const R1 = reachable(walk, meta.spawn, meta.bounds), R2 = reachable(walk, meta.spawn, meta.bounds, { ...PARAMS, jumpV: LEAP_V });
  const on = (R, p) => R.near(p, 0.3, -0.15, 0.15);
  const ledgeCells = [], floor = [];
  for (let x = -b; x <= b; x += CELL) for (let z = -b; z <= b; z += CELL) {
    const top = walk.top(x, z);
    const cell = { i: Math.round(x / CELL), j: Math.round(z / CELL), x, z, y: top };
    if (on(R2, [x, top, z]) && !on(R1, [x, top, z])) ledgeCells.push(cell);
    else if (on(R1, [x, top, z])) floor.push(cell);
  }
  const big = patches(ledgeCells).filter(g => g.length * CELL * CELL >= 1.5);
  const found = [];
  // ledges: from floor 0.9 to 2.45 m under the patch, 1 to 3.5 m away, with a run-up of 0 or 0.3 s and the second press 0.2 to 0.45 s in
  for (const g of big) {
    const cx = g.reduce((a, c) => a + c.x, 0) / g.length, cz = g.reduce((a, c) => a + c.z, 0) / g.length;
    const c = g.slice().sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0];
    const to = [c.x, c.y, c.z];
    let best = null;
    for (const r of [1.2, 1.8, 2.5, 3.2]) for (let k = 0; k < 16 && !best; k++) {
      const a = (k / 16) * Math.PI * 2, x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r, y = walk.support(x, z, c.y - 0.5);
      if (y === null || c.y - y < 0.9 || c.y - y > 2.45 || !on(R1, [x, y, z])) continue;
      for (const run of [0, 0.3]) for (const leapAt of [0.2, 0.3, 0.4]) {
        const way = { run, hold: 0.5, leapAt };
        const yes = tryLedge(walk, meta.bounds, [x, y, z], to, way, true);
        if (!yes.ok) continue;
        if (tryLedge(walk, meta.bounds, [x, y, z], to, way, false).ok) continue;
        best = { from: [x, y, z], to, landed: yes.at, way };
        break;
      }
    }
    found.push({ kind: 'ledge', patch: g.length * CELL * CELL, centre: to, route: +routeD(id, to).toFixed(1), ok: !!best, ...(best || {}) });
  }
  // stones: flat floor in the first reach, open 1.8 m over, that a plunge from floor 0.7 m or more higher lands on with a fall of 2 m
  const byKey = new Map(floor.map(c => [`${c.i},${c.j}`, c]));
  const flat = c => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([di, dj]) => { const n = byKey.get(`${c.i + di},${c.j + dj}`); return n && Math.abs(n.y - c.y) < 0.05; });
  const stones = [];
  for (const hi of floor) {
    if (stones.length >= 6) break;
    if (routeD(id, [hi.x, hi.y, hi.z]) > 8) continue;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, x = hi.x + Math.sin(a) * 2.2, z = hi.z + Math.cos(a) * 2.2, lo = byKey.get(`${Math.round(x / CELL)},${Math.round(z / CELL)}`);
      if (!lo || hi.y - lo.y < 0.7 || !flat(lo) || stones.some(s => Math.hypot(s.at[0] - lo.x, s.at[2] - lo.z) < 6)) continue;
      const way = { run: 0, hold: 0.4, leapAt: 9, plungeAt: 0.28 };
      const r = tryStone(walk, meta.bounds, [hi.x, hi.y, hi.z], [lo.x, lo.y, lo.z], way, false);
      if (!r || r.fallen < 2 || Math.abs(r.at[1] - lo.y) > 0.1) continue;
      stones.push({ kind: 'stone', from: [hi.x, hi.y, hi.z], at: r.at, fallen: r.fallen, way, route: +routeD(id, r.at).toFixed(1), ok: true });
      break;
    }
  }
  return { id, cells: { first: R1.cells, second: R2.cells, ledge: ledgeCells.length }, ledges: found, stones, zones: ZONES[id] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
function main() {
  const round = v => +v.toFixed(2);
  const out = {};
  for (const id of PLACES) {
    const r = scan(id);
    // the spots: up to 2 ledges that the second jump opens (nearest the way first), and 1 stone, at least 6 m apart
    // each spot is kept only when the way, played again from the rounded numbers written into keys.js, still works
    const { meta, walk } = load(id), R2 = p => p.map(round);
    const pick = [];
    for (const l of r.ledges.filter(l => l.ok).sort((a, b) => a.route - b.route)) {
      if (pick.length >= 2 || pick.some(p => Math.hypot(p.to[0] - l.to[0], p.to[2] - l.to[2]) < 6)) continue;
      if (!tryLedge(walk, meta.bounds, R2(l.from), R2(l.to), l.way, true).ok || tryLedge(walk, meta.bounds, R2(l.from), R2(l.to), l.way, false).ok) continue;
      pick.push(l);
    }
    const stone = r.stones.sort((a, b) => a.route - b.route).find(s => {
      if (pick.some(p => Math.hypot(p.to[0] - s.at[0], p.to[2] - s.at[2]) < 6)) return false;
      const t = tryStone(walk, meta.bounds, R2(s.from), R2(s.at), s.way, false);
      return t && t.fallen >= 2 && Math.hypot(t.at[0] - s.at[0], t.at[2] - s.at[2]) < 0.3;
    });
    const spots = [...pick.map(l => ({ kind: 'ledge', at: l.to, from: l.from, way: l.way })), ...(stone ? [{ kind: 'stone', at: stone.at, from: stone.from, way: stone.way }] : [])]
      .map((sp, i) => ({ id: `${id}-${sp.kind}${i + 1}`, kind: sp.kind, at: sp.at.map(round), from: sp.from.map(round), way: sp.way, prize: PRIZE[id][i] || 'glim', n: 25 + 5 * i }));
    out[id] = spots;
    console.log(`${id}: reach ${r.cells.first} cells, with two jumps ${r.cells.second}; ledge cells ${r.cells.ledge}; patches of 1.5 m² ${r.ledges.length} (opened by Crow step ${r.ledges.filter(l => l.ok).length}); stones ${r.stones.length}`);
    for (const sp of spots) console.log(`  ${sp.id} at ${sp.at.join(', ')} from ${sp.from.join(', ')} prize ${sp.prize}`);
    if (!spots.some(s => s.kind === 'ledge')) console.log('  no ledge that the second jump opens');
  }
  if (process.argv.includes('--write')) {
    const src = fs.readFileSync(KEYS, 'utf8');
    const text = `export const SPOTS = ${JSON.stringify(out)};`;
    const next = src.replace(/export const SPOTS = .*;\n/, `${text}\n`);
    fs.writeFileSync(KEYS, next);
    console.log('wrote keys.js SPOTS');
  }
}
