// Gloam Downs' stairs, walked in node with no browser: every flight of steps in the five places (each place's JSON lists them as
// `stairs`, written by the bake from each ctx.stair() call: the walked line from foot to head and the width), walked by the real
// controller (public/lab/gloam-downs/play.js makeBody) on the baked walk maps, in the explorer and in the run (moves.js makeFighter,
// which rolls).
//   Up and down each flight on lines across its whole width and half a metre past each side (between a stair and a wall), straight and
//   at 30° and 60° to it, at a walk and a run, and across it at five points, at 60 and 30 steps a second; in the run, the same lines
//   with a roll half way. Wherever the lamplighter comes to a stop, the stop is tried on 16 headings, with a walk and with a running
//   jump: it is stuck when no heading gets it 0.4 m away (wedged in a gap between steps, or between a stair and a wall).
// The player's report: "I got stuck between the stairs". The walk maps of 45ffb438 had 21 such stops beside the Gaol's west stair (the
// slot one cell wide between the stair's side and the first tier); the crack pass of round 7 closes it. GLOAM_WALKS=<dir> walks the
// flights on the walk maps in another folder (the old maps fail here).
// Run: node qa/lab/gloam-downs-stairs.test.mjs [place ...]   (GLOAM_WORLDS=0 skips it)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { makeFighter } from '../../public/lab/gloam-downs/moves.js';

const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/worlds/', import.meta.url));
const WALKS = process.env.GLOAM_WALKS ? process.env.GLOAM_WALKS.replace(/\/?$/, '/') : DIR;
const PLACES = process.argv.slice(2).length ? process.argv.slice(2) : ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
// how many flights each place has (the ctx.stair() calls in games/gloam-downs/biomes/), so a flight left out of the JSON is noticed
// The three of the Gilt Lattice are counted from the design (openspec/changes/add-gloam-downs-renaissance/design.md): the Piazza's grand
// stair, its arcade roof stair and its three terrace stairs; the Cupola's drum ramp and rib stair; the Isles' spiral and straight stairs
// up from the grid sea. Match each to its biome's ctx.stair() calls after the bake.
// Run the Lattice alone: node qa/lab/gloam-downs-stairs.test.mjs piazza cupola orrery
const FLIGHTS = { gaol: 3, ramparts: 4, fen: 8, bells: 2, barrows: 1, piazza: 5, cupola: 2, orrery: 2 };
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
if (process.env.GLOAM_WORLDS === '0') { console.log('skipped (GLOAM_WORLDS=0)'); process.exit(0); }

function load(id) {
  const meta = JSON.parse(fs.readFileSync(`${DIR}${id}.json`, 'utf8'));
  const raw = zlib.gunzipSync(fs.readFileSync(`${WALKS}${id}.walk.bin.gz`));
  return { meta, walk: makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1)) };
}
// the camera yaw that makes "forward" (mz = 1) point along (ux, uz)
const yawFor = (ux, uz) => Math.atan2(-ux, -uz);

/* can the lamplighter get out of where it stopped? 16 headings, each with a walk and a running jump for 1 s; -> how many get it 0.4 m
   away */
function escapes(walk, st, hz, bounds) {
  let out = 0;
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    for (const jump of [false, true]) {
      const b = makeBody(walk, { p: [st.x, st.y, st.z], yaw: a }, bounds);
      Object.assign(b.s, { x: st.x, y: st.y, z: st.z, base: st.base, ground: true, vx: 0, vy: 0, vz: 0, floor: st.y });
      for (let i = 0; i < hz; i++) b.step(1 / hz, { mz: 1, jump: jump && i < hz * 0.3 }, yawFor(Math.sin(a), Math.cos(a)));
      if (Math.hypot(b.s.x - st.x, b.s.z - st.z) > 0.4) { out++; break; }
    }
  }
  return out;
}

/* the lines of one flight: [start x, z, direction x, z, length]. Along each segment of its line, on offsets across its width and 0.5
   past each side, both ways, straight and at ±30° and ±60° (a winding stair: every 0.5, and ±30°); and across it at five points */
function lines(f) {
  const out = [];
  for (let i = 0; i + 1 < f.line.length; i++) {
    const [ax, az] = f.line[i], [bx, bz] = f.line[i + 1], len = Math.hypot(bx - ax, bz - az);
    if (len < 0.3) continue;
    const dx = (bx - ax) / len, dz = (bz - az) / len, px = -dz, pz = dx, cx = (ax + bx) / 2, cz = (az + bz) / 2, half = f.width / 2 + 0.5;
    // a winding stair (many short segments) is walked on fewer lines a segment: its segments overlap
    const many = f.line.length > 3, step = many ? 0.5 : 0.25, tilts = many ? [0, 0.52, -0.52] : [0, 0.52, -0.52, 1.05, -1.05];
    for (let o = -half; o <= half + 1e-6; o += step) for (const sg of [1, -1]) for (const tilt of tilts) {
      const c = Math.cos(tilt), s = Math.sin(tilt), ux = (dx * c - px * s) * sg, uz = (dz * c - pz * s) * sg, L = len / 2 + 1.2;
      out.push([cx + px * o - ux * L, cz + pz * o - uz * L, ux, uz, 2 * L]);
    }
    for (const q of [-0.4, -0.2, 0, 0.2, 0.4]) for (const sg of [1, -1]) {
      const L = f.width / 2 + 1.5;
      out.push([cx + dx * len * q - px * sg * L, cz + dz * len * q - pz * sg * L, px * sg, pz * sg, 2 * L]);
    }
  }
  return out;
}

/* walk one line: -> the stop, if the lamplighter came to one before the end (0.5 s with no move on the ground), else null */
function walkLine(walk, bounds, [sx, sz, ux, uz, L], { hz, speed, run }) {
  const y0 = walk.support(sx, sz, walk.top(sx, sz) + 0.01);
  if (y0 === null) return null;
  const P = run ? { ...PARAMS } : PARAMS, b = makeBody(walk, { p: [sx, y0 + 0.3, sz], yaw: Math.atan2(ux, uz) }, bounds, P);
  const fighter = run ? makeFighter(b, walk) : null, yaw = yawFor(ux, uz), T = L / (speed * PARAMS.run * 0.5) + 1, dt = 1 / hz;
  let last = [b.s.x, b.s.z], still = 0;
  for (let i = 0; i < T * hz; i++) {
    if (fighter) {
      // the run's play step is 60 Hz (moves.js steps the body itself); a roll half way along
      fighter.step({ mz: speed, roll: Math.abs(i - Math.round(T * hz / 2)) < 2 }, yaw, [], []);
    } else b.step(dt, { mz: speed }, yaw);
    const mv = Math.hypot(b.s.x - last[0], b.s.z - last[1]);
    last = [b.s.x, b.s.z];
    still = mv < 0.002 && b.s.ground && !fighter?.f?.move ? still + (fighter ? 1 / 60 : dt) : 0;
    if (still > 0.5) return { x: b.s.x, y: b.s.y, z: b.s.z, base: b.s.base };
    // past the far end and on: done
    if (Math.hypot(b.s.x - sx, b.s.z - sz) > L) return null;
  }
  return null;
}

const rows = [];
for (const id of PLACES) {
  const { meta, walk } = load(id), bounds = meta.bounds;
  assert(Array.isArray(meta.stairs), `${id}.json lists its stairs (bake it again)`);
  assert.equal(meta.stairs.length, FLIGHTS[id], `${id} has ${FLIGHTS[id]} flights`);
  let walks = 0, stops = 0, tight = 0;
  const stuck = [];
  for (const [fi, f] of meta.stairs.entries()) {
    const ls = lines(f);
    for (const mode of [{ hz: 60 }, { hz: 30 }, { hz: 60, run: true }]) for (const speed of mode.run ? [1] : [0.5, 1]) for (const l of ls) {
      walks++;
      const st = walkLine(walk, bounds, l, { ...mode, speed });
      if (!st) continue;
      stops++;
      const out = escapes(walk, st, mode.hz, bounds);
      if (out < 4) tight++;
      if (out === 0) stuck.push({ flight: fi, at: [st.x, st.y, st.z].map(v => +v.toFixed(2)), hz: mode.hz, run: !!mode.run });
    }
  }
  rows.push({ id, flights: meta.stairs.length, walks, stops, tight, stuck: stuck.length });
  assert.equal(stuck.length, 0, `${id}: the lamplighter was stuck at ${stuck.length} stops, first ${JSON.stringify(stuck.slice(0, 3))}`);
}
pass('every flight of steps in the five places, walked up, down, beside and across, in the explorer and the run: no stop is stuck', rows);
console.log(`\n${n} passed`);
