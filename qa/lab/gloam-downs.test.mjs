// Gloam Downs, checked in node with no browser (public/lab/gloam-downs/):
//   the five baked places (budget, palette, bones, wisps, beacon, the start on the ground, the walk map's three layers, everything in
//   reach by the controller's rules),
//   the controller on made-up ground (walk, run, jump height, walls, steps, ledges, a step on a ledge's lip, falls, walking under an
//   arch, landing on a sloped roof or crown over a gap and on a sloped floor under one, walking off a ledge into an arch, the corners of
//   a cell agreeing on the layer, thin roofs, a vault's edge over a grate, a jump under a high roof with the gap's underside, running jumps
//   up a slope and blocks on one), the reach search's walks and jumps against the controller,
//   the pose (the bones put the figure where the body is), and the saved game (rubbish in, a clean save out).
// Run: node qa/lab/gloam-downs.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, makeCamera, pose, reachable, touches, atBeacon, JUMP, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { clean, fresh, ORDER, wispCount } from '../../public/lab/gloam-downs/save.js';

const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/', import.meta.url));
// load the codec in this realm: in a vm context it rejects this realm's Uint8Array
const SplatCodec = new Function(fs.readFileSync(DIR + 'ink/splat-codec.js', 'utf8') + '\nreturn SplatCodec;')();
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;

/* ---------------- the five places ---------------- */
// GLOAM_WORLDS=0 skips the baked places (to test the rules alone while the places are being baked)
const skipWorlds = process.env.GLOAM_WORLDS === '0';
const missing = skipWorlds ? [] : ORDER.filter(id => !fs.existsSync(`${DIR}worlds/${id}.json`));
for (const id of skipWorlds ? [] : ORDER) {
  if (missing.includes(id)) continue;
  const meta = JSON.parse(fs.readFileSync(`${DIR}worlds/${id}.json`, 'utf8'));
  const gz = fs.readFileSync(`${DIR}worlds/${id}.bin.gz`), wgz = fs.readFileSync(`${DIR}worlds/${id}.walk.bin.gz`);
  assert.equal(meta.format, 'gloam-downs/1');
  assert.equal(meta.id, id);
  assert(meta.count <= 250000, `${id}: ${meta.count} splats is over the budget of 250,000`);
  assert(gz.length + wgz.length <= 1.5e6, `${id}: ${gz.length + wgz.length} bytes is over 1.5 MB`);
  assert(meta.pal.length <= 48 && meta.pal.every(c => Number.isInteger(c) && c >= 0 && c <= 0xffffff), `${id}: palette`);
  const { data, count } = SplatCodec.decode(new Uint8Array(zlib.gunzipSync(gz)), { maxRows: 1_000_000 });
  assert.equal(count, meta.count);
  for (let i = 0; i < count; i++) assert(Number.isFinite(data[i * 16]) && Number.isFinite(data[i * 16 + 1]) && Number.isFinite(data[i * 16 + 2]), `${id}: splat ${i} has a finite place`);
  // the lamplighter: a run of splats, each on a GPU bone (kind 12) with a bone id the page writes
  const B = meta.bones;
  assert.equal(B.names.length, 7);
  assert(B.end - B.first === B.count && B.count > 1000, `${id}: lamplighter splats ${B.count}`);
  for (let i = B.first; i < B.end; i++) {
    const kind = Math.round(data[i * 16 + 11]) % 16, bone = data[i * 16 + 12];
    assert.equal(kind, 12, `${id}: splat ${i} rides a bone`);
    assert(Number.isInteger(bone) && bone >= 0 && bone < B.names.length);
  }
  // wisps and the beacon's fire: glowing splats in their own id ranges, inside the world
  assert.equal(meta.wisps.length, 5);
  const glows = (a, b) => { for (let i = a; i < b; i++) assert(Math.round(data[i * 16 + 11]) & 32 || (Math.round(data[i * 16 + 11]) >> 4) & 2, `${id}: splat ${i} glows`); };
  for (const w of meta.wisps) { assert(w.ids[0] < w.ids[1] && w.ids[1] <= count); glows(...w.ids); }
  for (const r of meta.beacon.fire) { assert(r[0] < r[1] && r[1] <= count); glows(...r); }
  /* the walk map: three layers, as the settings name them. The top, the floor under a gap (the top where there is none) and the gap's
     underside: 0 where there is no gap, over the floor and under the top where there is one */
  const raw = new Uint8Array(zlib.gunzipSync(wgz)), N = meta.walk.nx * meta.walk.nz;
  assert.deepEqual(meta.walk.layers, ['T', 'G', 'U'], `${id}: the walk map's layers`);
  assert.equal(raw.byteLength, 3 * N * 2, `${id}: the walk file holds three layers`);
  const L = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1);
  for (let k = 0; k < N; k++) {
    const t = L[k], g = L[N + k], u = L[2 * N + k];
    assert(g < t - 5 ? u > g && u < t : u === 0, `${id}: walk cell ${k} has top ${t}, floor ${g}, underside ${u}`);
  }
  const walk = makeWalk(meta.walk, L);
  assert(walk.U, `${id}: the controller reads the underside`);
  const floor = walk.support(meta.spawn.p[0], meta.spawn.p[2], meta.spawn.p[1] + 1);
  assert(floor !== null && near(floor, meta.spawn.p[1], 0.6), `${id}: the start stands on the ground`);
  const R = reachable(walk, meta.spawn, meta.bounds);
  assert(R.near(meta.beacon.p, meta.beacon.r * 0.9, -2.6, 2.6), `${id}: the beacon can be reached`);
  meta.wisps.forEach((w, i) => assert(R.near(w.p), `${id}: wisp ${i + 1} can be reached`));
  assert(meta.beacon.p[1] > meta.spawn.p[1] + 2, `${id}: the beacon stands on a rise above the start`);
  pass(`${id}: ${meta.name}`, { splats: count, mb: +((gz.length + wgz.length) / 1e6).toFixed(2), reach: R.cells });
}
if (!skipWorlds && !missing.length) { // five different places: names, palettes and landmarks differ
  const metas = ORDER.map(id => JSON.parse(fs.readFileSync(`${DIR}worlds/${id}.json`, 'utf8')));
  assert.equal(new Set(metas.map(m => m.name)).size, 5);
  assert.equal(new Set(metas.map(m => m.pal.slice(0, 32).join())).size, 5);
  pass('five places, each with its own name and palette', metas.map(m => m.name));
}

/* ---------------- the controller, on made-up ground ---------------- */
// a 40 x 40 map at 0.25: flat ground at 0, a 3-high wall at x 4..5, a 10-high wall at x 12..13, a 1.0 ledge at z 4..6 (x -4..0), a
// 2.0 ledge at z 8..10 (`ledge2` sets its height, for the reach search's control), steps of 0.35 at z -4..-2, a gap at z -10 (a 6 deep
// pit), and an arch at x -8..-7 with its top at 3 and the floor at 0 under it
function made({ ledge2 = 2.0 } = {}) {
  const info = { x0: -20, z0: -20, step: 0.25, nx: 161, nz: 161 };
  const N = info.nx * info.nz, cells = new Int16Array(2 * N);
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) {
    const x = info.x0 + i * info.step, z = info.z0 + j * info.step;
    let t = 0, g = null;
    if (x >= 4 && x <= 5 && z > -6 && z < 6) t = 3;
    if (x >= 12 && x <= 13 && z > -6 && z < 6) t = 10;
    if (x >= -4 && x <= 0 && z >= 4 && z <= 6) t = 1.0;
    if (x >= -4 && x <= 0 && z >= 8 && z <= 10) t = ledge2;
    if (x >= -4 && x <= 0 && z >= -4 && z <= -2) t = 0.35 * (1 + Math.floor((-2 - z) / 0.7));
    if (z <= -9 && z >= -11 && x > 6) t = -6;
    if (x >= -8 && x <= -7 && z >= -2 && z <= 2) { t = 3; g = 0; }
    cells[j * info.nx + i] = Math.round(t * 100);
    cells[N + j * info.nx + i] = Math.round((g ?? t) * 100);
  }
  return makeWalk(info, cells);
}
const W = made();
const run = (body, sec, inp, yaw = Math.PI) => { for (let i = 0; i < sec * 60; i++) body.step(1 / 60, inp, yaw); return body.s; };
// the frame steps the page meets (main.js steps by the frame time, at most 1/30)
const DTS = [1 / 30, 1 / 60, 1 / 120, 1 / 144];
const hz = dt => Math.round(1 / dt);
// hold an input (or a function of time) for sec seconds at a frame step -> the highest the feet stood on the ground
const hold = (body, sec, inp, dt = 1 / 60, yaw = 0) => {
  let high = -Infinity;
  for (let i = 0, k = Math.round(sec / dt); i < k; i++) {
    body.step(dt, typeof inp === 'function' ? inp(i * dt) : inp, yaw);
    if (body.s.ground) high = Math.max(high, body.s.y);
  }
  return high;
};
// the stick for a heading in the world with the camera at yaw 0: right is +x, forward is -z
const toward = (dx, dz) => { const l = Math.hypot(dx, dz); return { mx: dx / l, mz: -dz / l }; };
{ // walk and run: the camera faces -z (yaw 0 puts the eye at +z), so forward is -z
  const b = makeBody(W, { p: [0, 0, 18], yaw: Math.PI }, 20);
  run(b, 1, { mz: 1, slow: true }, 0);
  const walked = 18 - b.s.z;
  assert(near(walked, PARAMS.walk, 0.4), `walked ${walked}`);
  // it starts facing the camera (yaw 0, +z), so it must turn round to face -z (yaw π)
  const b2 = makeBody(W, { p: [0, 0, 18], yaw: 0 }, 20);
  run(b2, 1, { mz: 1 }, 0);
  assert(18 - b2.s.z > walked * 1.6, 'running is faster than walking');
  const off = Math.atan2(Math.sin(b2.s.yaw - Math.PI), Math.cos(b2.s.yaw - Math.PI));
  assert(Math.abs(off) < 0.05, `it turns to face where it goes: yaw ${b2.s.yaw}`);
  pass('walk and run move the lamplighter away from the camera', { walked: +walked.toFixed(2), ran: +(18 - b2.s.z).toFixed(2) });
}
{ // jump height
  const b = makeBody(W, { p: [10, 0, 10], yaw: 0 }, 20);
  let top = 0;
  for (let i = 0; i < 120; i++) { b.step(1 / 60, { jump: true }, 0); top = Math.max(top, b.s.y); }
  assert(near(top, JUMP, 0.12), `jump top ${top}, expected ${JUMP}`);
  assert(b.s.ground && near(b.s.y, 0, 1e-6), 'it lands');
  const tap = makeBody(W, { p: [10, 0, 10], yaw: 0 }, 20);
  let low = 0;
  for (let i = 0; i < 120; i++) { tap.step(1 / 60, { jump: i < 4 }, 0); low = Math.max(low, tap.s.y); }
  assert(low < top * 0.8, 'a tap jumps lower than a held jump');
  // the same heights at every frame step
  const tops = DTS.map(dt => {
    const j = makeBody(W, { p: [10, 0, 10], yaw: 0 }, 20), k = makeBody(W, { p: [10, 0, 10], yaw: 0 }, 20);
    let t = 0, l = 0;
    for (let i = 0; i < 2 / dt; i++) {
      j.step(dt, { jump: true }, 0); t = Math.max(t, j.s.y);
      k.step(dt, { jump: i * dt < 0.066 }, 0); l = Math.max(l, k.s.y);
    }
    assert(near(t, JUMP, 0.03), `${hz(dt)} Hz: jump top ${t}, expected ${JUMP}`);
    assert(l < t * 0.8, `${hz(dt)} Hz: a tap jumps lower (${l})`);
    return +t.toFixed(3);
  });
  pass('a held jump lifts the feet JUMP at every frame step, and a tap less', { held: +top.toFixed(2), tap: +low.toFixed(2), tops });
}
{ // a wall stops it; it slides along the wall
  const b = makeBody(W, { p: [2, 0, 0], yaw: 0 }, 20);
  run(b, 2, { mx: 1 }, 0);
  assert(b.s.x < 4 && b.s.x > 3, `stopped at the wall: x ${b.s.x}`);
  assert(near(b.s.y, 0, 1e-6));
  // from any heading and at any frame step, the 3 and 10 high walls stop it; it slides along them instead of walking up them
  for (const dt of DTS) for (const [x0, h] of [[3, 3], [11, 10]]) for (let deg = 5; deg <= 85; deg += 5) {
    const a = deg * Math.PI / 180, w = makeBody(W, { p: [x0, 0, -5], yaw: 0 }, 20);
    const high = hold(w, 2, toward(Math.sin(a), Math.cos(a)), dt);
    assert(high < 0.05, `${hz(dt)} Hz, ${deg}° to the ${h} wall: stood at ${high}`);
    if (deg <= 45) assert(w.s.z > 0, `${hz(dt)} Hz, ${deg}° to the ${h} wall: it slid along (z ${w.s.z})`);
  }
  // D+W and D+S from the wall test's start, and both diagonals into the wall's corners
  for (const dt of DTS) for (const [p, d] of [[[2, 0, 0], [1, -1]], [[2, 0, 0], [1, 1]], [[2, 0, -8], [1, 1]], [[2, 0, 8], [1, -1]]]) {
    const w = makeBody(W, { p, yaw: 0 }, 20);
    const high = hold(w, 2, toward(...d), dt);
    assert(high < 0.05, `${hz(dt)} Hz, from ${p} heading ${d}: stood at ${high}`);
  }
  // a jump on a diagonal into the 10 high wall: it slides along the face and lands on the ground, not on the face
  for (const dt of DTS) for (const d of [[1, 1], [1, -1]]) {
    const w = makeBody(W, { p: [11, 0, 0], yaw: 0 }, 20);
    const high = hold(w, 1.5, t => ({ ...toward(...d), jump: t > 0.15 && t < 0.6 }), dt);
    assert(high < 0.05 && w.s.ground && Math.abs(w.s.z) > 1, `${hz(dt)} Hz: a jump heading ${d} into the 10 wall stood at ${high}, z ${w.s.z}`);
  }
  // put down so close that its disc is over the 3 wall's edge: it walks away and along, but not into it or up it
  for (const dt of DTS) {
    const at = () => makeBody(W, { p: [3.62, 0, 0], yaw: 0 }, 20);
    const away = at(), along = at(), into = at();
    hold(away, 1, toward(-1, 0), dt);
    const high = Math.max(hold(along, 1, toward(0, 1), dt), hold(into, 1, toward(1, 0.2), dt));
    assert(away.s.x < 2 && along.s.z > 1.5, `${hz(dt)} Hz: from against the wall it walked away to x ${away.s.x} and along to z ${along.s.z}`);
    assert(high < 0.05 && into.s.x < 3.7, `${hz(dt)} Hz: against the wall it went in to x ${into.s.x}, up to ${high}`);
  }
  pass('a wall higher than a jump stops the lamplighter from every heading', { x: +b.s.x.toFixed(2) });
}
{ // faces not lined up with the grid: a square 6 across turned 10°, 26.57°, 37° and 45°, and the inside corner of an L. The grid's
  // corners leave gentle spots on such faces; the feet still never step up more than climb (0.83), from any heading or frame step
  const ground = fn => {
    const info = { x0: -20, z0: -20, step: 0.25, nx: 161, nz: 161 }, N = info.nx * info.nz, cells = new Int16Array(2 * N);
    for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) cells[j * info.nx + i] = cells[N + j * info.nx + i] = Math.round(fn(info.x0 + i * info.step, info.z0 + j * info.step) * 100);
    return makeWalk(info, cells);
  };
  const square = (h, deg) => {
    const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
    return ground((x, z) => (Math.abs(c * x + s * z) <= 3 && Math.abs(-s * x + c * z) <= 3 ? h : 0));
  };
  // headings at a face k of the square: aimed at a point `along` it, `off` degrees from straight in, starting `back` out
  const at = (deg, k, along, off, back) => {
    const a = (deg + 90 * k) * Math.PI / 180, o = off * Math.PI / 180, n = [Math.cos(a), Math.sin(a)], t = [-n[1], n[0]];
    const h = [-(n[0] * Math.cos(o) - t[0] * Math.sin(o)), -(n[1] * Math.cos(o) - t[1] * Math.sin(o))];
    return { p: [n[0] * 3 + t[0] * along - h[0] * back, 0, n[1] * 3 + t[1] * along - h[1] * back], h };
  };
  let tries = 0;
  for (const deg of [10, 26.57, 37, 45]) {
    const high = square(1.0, deg), low = square(0.8, deg);
    for (const k of [0, 1]) for (const dt of DTS) for (const slow of [false, true]) {
      for (const along of [-3, -1, 2.6, 3]) for (const off of [-45, -15, 15, 45]) {
        const { p, h } = at(deg, k, along, off, 4), w = makeBody(high, { p, yaw: 0 }, 20);
        const top = hold(w, 2.5, { ...toward(...h), slow }, dt);
        assert(top < 0.05, `the 1.0 square turned ${deg}°, face ${k}, along ${along}, ${off}° off, ${hz(dt)} Hz${slow ? ' walking' : ''}: stood at ${top}`);
        tries++;
      }
      // a step of 0.8 is walked up
      for (const along of [-2, 0, 1.7]) for (const off of [-50, 0, 50]) {
        const { p, h } = at(deg, k, along, off, 3), w = makeBody(low, { p, yaw: 0 }, 20);
        const top = hold(w, 2.5, { ...toward(...h), slow }, dt);
        assert(near(top, 0.8, 0.01), `the 0.8 square turned ${deg}°, face ${k}, along ${along}, ${off}° off, ${hz(dt)} Hz${slow ? ' walking' : ''}: got up to ${top}`);
        tries++;
      }
    }
  }
  // an L of 1.0 with its inside corner at the origin, walked into from the open quarter
  const ell = ground((x, z) => (Math.abs(x) <= 3 && Math.abs(z) <= 3 && !(x > 0 && z > 0) ? 1.0 : 0));
  for (let deg = 185; deg <= 265; deg += 10) for (const dt of DTS) for (const slow of [false, true]) {
    const d = [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)], w = makeBody(ell, { p: [-d[0] * 3.5, 0, -d[1] * 3.5], yaw: 0 }, 20);
    const top = hold(w, 2.5, { ...toward(...d), slow }, dt);
    assert(top < 0.05, `the L's inside corner at ${deg}°, ${hz(dt)} Hz${slow ? ' walking' : ''}: stood at ${top}`);
    tries++;
  }
  // and the reach search agrees: the turned 1.0 square's top is out of a walk's reach, the 0.8 square's top is in it
  const R1 = reachable(square(1.0, 26.57), { p: [0, 0, 12] }, 20), R08 = reachable(square(0.8, 26.57), { p: [0, 0, 12] }, 20);
  assert(R1.near([0, 1.5, 0], 0.4) && R08.near([0, 1.3, 0], 0.4), 'the reach search: the 1.0 square is reached (with a jump), the 0.8 square too');
  const walkOnly = reachable(square(1.0, 26.57), { p: [0, 0, 12] }, 20, { ...PARAMS, jumpV: 0 });
  assert(!walkOnly.near([0, 1.5, 0], 0.4), 'the reach search: without a jump the turned 1.0 square is not reached');
  pass('faces turned to the grid stop a walk at 1.0 and let it up 0.8, from every heading', { tries });
}
{ // steps of 0.35 are walked up; a 1.0 ledge needs a jump; a 2.0 ledge cannot be climbed
  const b = makeBody(W, { p: [-2, 0, -0.5], yaw: Math.PI }, 20);
  let high = 0;
  for (let i = 0; i < 90; i++) { b.step(1 / 60, { mz: 1, slow: true }, 0); high = Math.max(high, b.s.ground ? b.s.y : 0); }
  assert(high > 0.9, `walked up the steps to ${high}`);
  const c = makeBody(W, { p: [-2, 0, 2.5], yaw: 0 }, 20);
  run(c, 1, { mz: -1 }, 0);
  assert(near(c.s.y, 0, 1e-6) && c.s.z < 4, 'a 1.0 ledge stops a walk');
  let landed = null;
  for (let i = 0; i < 60 && landed === null; i++) { c.step(1 / 60, { mz: -1, jump: i < 30 }, 0); if (c.s.events.includes('land')) landed = c.s.y; }
  assert(landed !== null && near(landed, 1.0, 0.05), `jumped onto the 1.0 ledge: landed at ${landed}`);
  const d = makeBody(W, { p: [-2, 0, 7], yaw: 0 }, 20);
  for (let i = 0; i < 120; i++) d.step(1 / 60, { mz: -1, jump: true }, 0);
  assert(d.s.y < 1.9 && d.s.z < 8, `a 2.0 ledge is too high: y ${d.s.y}, z ${d.s.z}`);
  for (const dt of DTS) {
    // the steps at every frame step, walking and running
    for (const slow of [true, false]) {
      const st = makeBody(W, { p: [-2, 0, -0.5], yaw: Math.PI }, 20);
      const up = hold(st, 1.5, { mz: 1, slow }, dt);
      assert(up > 0.9, `${hz(dt)} Hz${slow ? ' walking' : ''}: walked up the steps to ${up}`);
    }
    // the 1.0 ledge: straight at it and on both diagonals, walking or running, it needs a jump
    for (const [p, d] of [[[-2, 0, 2.5], [0, 1]], [[-2, 0, 2.5], [1, 1]], [[-1, 0, 2.5], [-1, 1]], [[1, 0, 5], [-1, 0]], [[1, 0, 5], [-1, 1]], [[1, 0, 5], [-1, -1]]]) for (const slow of [true, false]) {
      const w = makeBody(W, { p, yaw: 0 }, 20);
      const high = hold(w, 1.5, { ...toward(...d), slow }, dt);
      assert(high < 0.05, `${hz(dt)} Hz: from ${p} heading ${d}${slow ? ' walking' : ''}, it stood at ${high} without a jump`);
    }
    // and a jump gets onto it
    const c2 = makeBody(W, { p: [-2, 0, 2.5], yaw: 0 }, 20);
    hold(c2, 1, { mz: -1 }, dt);
    const onTop = hold(c2, 1.2, t => ({ mz: -1, jump: t < 0.5 }), dt);
    assert(near(onTop, 1.0, 0.05), `${hz(dt)} Hz: jumped onto the 1.0 ledge: stood at ${onTop}`);
    // the 2.0 ledge: a jump at either face, straight or on a diagonal, does not stand it on the ledge or its face
    for (const [p, d] of [[[-2, 0, 7], [0, 1]], [[-2, 0, 7], [1, 1]], [[1.2, 0, 9.5], [-1, -1]], [[1.2, 0, 8.5], [-1, 1]], [[1.2, 0, 9], [-1, 0]]]) {
      const w = makeBody(W, { p, yaw: 0 }, 20);
      let high = 0;
      for (let i = 0; i < 1.5 / dt; i++) {
        w.step(dt, { ...toward(...d), jump: i * dt > 0.3 && i * dt < 1 }, 0);
        // near the 2.0 ledge (it may land on the 1.0 ledge further on)
        if (w.s.ground && w.s.x > -5 && w.s.x < 1 && w.s.z > 7 && w.s.z < 11) high = Math.max(high, w.s.y);
      }
      assert(high < 0.05, `${hz(dt)} Hz: jumped from ${p} heading ${d} at the 2.0 ledge, stood at ${high}`);
    }
  }
  pass('steps are walked, a 1.0 ledge is jumped, a 2.0 ledge is too high, at every frame step and heading');
}
/* made-up ground from a function of (x, z): a height, [top, floor under its gap], or [top, floor, the gap's underside]. A map with an
   underside anywhere has the third layer (0 where none is given), as the bake writes it; else it has two, and the controller takes the
   underside as the floor + 1.8 */
const layered = fn => {
  const info = { x0: -20, z0: -20, step: 0.25, nx: 161, nz: 161 }, N = info.nx * info.nz, vals = [];
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) {
    const v = fn(info.x0 + i * info.step, info.z0 + j * info.step);
    vals.push(Array.isArray(v) ? v : [v, v]);
  }
  const three = vals.some(v => v.length > 2), cells = new Int16Array((three ? 3 : 2) * N);
  vals.forEach(([t, g, u], k) => {
    cells[k] = Math.round(t * 100);
    cells[N + k] = Math.round((g ?? t) * 100);
    if (three) cells[2 * N + k] = u === undefined ? 0 : Math.round(u * 100);
  });
  return makeWalk(info, cells);
};
{ /* the base: a ledge of 1.2 with a step of 0.7 on its lip, one cell out. The step's face is steeper than climb per radius, so the base
     stays at its foot, and the step and the ledge behind it together are more than a climb: no walk gets up, at any frame step or
     heading. If the base came up the face with the feet, the climb would be spent again on each frame and the walk would creep up */
  const lip = layered(x => (x < -0.01 ? 0 : x < 0.01 ? 0.7 : 1.2));
  for (const dt of DTS) for (const slow of [false, true]) for (const deg of [0, 30, 60]) {
    const a = deg * Math.PI / 180, w = makeBody(lip, { p: [-2, 0, 0], yaw: 0 }, 20);
    const high = hold(w, 2, { ...toward(Math.cos(a), Math.sin(a)), slow }, dt);
    assert(high < 0.05, `${hz(dt)} Hz${slow ? ' walking' : ''}, ${deg}° to the stepped lip: stood at ${high}`);
  }
  // and a jump gets onto it
  for (const dt of DTS) {
    const w = makeBody(lip, { p: [-1, 0, 0], yaw: 0 }, 20);
    const high = hold(w, 1.5, t => ({ ...toward(1, 0), jump: t < 0.5 }), dt);
    assert(near(high, 1.2, 0.02), `${hz(dt)} Hz: jumped onto the stepped lip: stood at ${high}`);
  }
  pass('a step on the lip of a 1.2 ledge does not let a walk up it: the climb is spent once');
}
{ /* roofs and crowns with a gap under them: a jump in place lands back on the top, a fall from above lands on it, and the shadow lies
     under the feet; from a low roof, a higher roof is a wall and a 0.6 step up, not a hole down to the floor under them */
  const roof = layered((x, z) => (Math.abs(x) <= 4 && Math.abs(z) <= 4 ? [3 + 0.5 * x, 0] : 0));
  const dome = layered((x, z) => (Math.hypot(x, z) <= 4 ? [3 + 2 * Math.cos(Math.hypot(x, z) / 4 * Math.PI / 2), 0] : 0));
  let tries = 0;
  // spots off the grid points, where the corners round the feet differ
  for (const [name, W2] of [['roof', roof], ['dome', dome]]) for (const dt of DTS) for (let x = -2; x <= 2; x += 0.37) for (let z = -2; z <= 2; z += 0.53) {
    const b = makeBody(W2, { p: [x, 9, z], yaw: 0 }, 20), y0 = b.s.y;
    assert(near(y0, W2.top(x, z), 1e-3), `${name}: put down on the top at ${x}, ${z}`);
    let apex = 0;
    for (let i = 0; i < 1.2 / dt; i++) {
      b.step(dt, { jump: i * dt < 0.4 }, 0);
      if (b.s.ground) assert(b.s.floor === b.s.y, `${name}, ${hz(dt)} Hz at ${x}, ${z}: the shadow is at ${b.s.floor}, the feet at ${b.s.y}`);
      else if (b.s.y > apex) { apex = b.s.y; assert(near(b.s.floor, y0, 0.05), `${name}, ${hz(dt)} Hz at ${x}, ${z}: in the air the shadow is at ${b.s.floor}, not on the top under it`); }
    }
    assert(b.s.ground && near(b.s.y, y0, 0.02), `${name}, ${hz(dt)} Hz: a jump in place at ${x}, ${z} came down to ${b.s.y}, not the top at ${y0}`);
    const c = makeBody(W2, { p: [x, 9, z], yaw: 0 }, 20);
    c.s.ground = false; c.s.y = y0 + 3;
    for (let i = 0; i < 1.5 / dt; i++) c.step(dt, {}, 0);
    assert(c.s.ground && near(c.s.y, y0, 0.02), `${name}, ${hz(dt)} Hz: a fall onto ${x}, ${z} came down to ${c.s.y}, not the top at ${y0}`);
    tries++;
  }
  for (const [rise, up] of [[1.5, false], [0.6, true]]) {
    const W2 = layered((x, z) => (Math.abs(z) <= 4 && Math.abs(x) <= 6 ? [x < 0 ? 3 : 3 + rise, 0] : 0));
    for (const dt of DTS) for (const z of [-1, 0, 1.1]) for (const slow of [false, true]) {
      const b = makeBody(W2, { p: [-3, 9, z], yaw: 0 }, 20);
      let low = Infinity, high = -Infinity;
      for (let i = 0; i < 1.5 / dt; i++) { b.step(dt, { mx: 1, slow }, 0); if (b.s.x < 5) low = Math.min(low, b.s.y); if (b.s.ground) high = Math.max(high, b.s.y); }
      assert(low > 2.95, `${hz(dt)} Hz${slow ? ' walking' : ''}: walking into a roof ${rise} higher, the feet fell to ${low}`);
      assert(up ? near(high, 3 + rise, 0.01) : high < 3.05, `${hz(dt)} Hz${slow ? ' walking' : ''}: into a roof ${rise} higher, stood at ${high}`);
    }
  }
  pass('jumps and falls land on a sloped roof or crown over a gap, and a higher roof is a wall or a step', { tries });
}
{ /* the floor under a gap: the feet decide whether they are in the gap or on its roof, not the reach above them. Under a roof at 5
     over a floor that slopes 0.6 or 1.0 per unit, jumps in place and running jumps up and down the slope land on the floor (the
     uphill corners are floor, not roof). A fall past the lip of an overhang, whose floor is 1.0 above the open ground, lands
     between the two. A walk off a 1.2 ledge into a cave 4.5 high drops to the floor in it, and the reach search goes there too.
     And from that ledge a low roof 0.6 higher (1.8 over its floor) is a step up, with the shadow at the feet all the way */
  let tries = 0;
  for (const k of [0.6, 1.0]) {
    const W2 = layered((x, z) => (Math.abs(x) <= 4 && Math.abs(z) <= 4 ? [5 + k * x, k * x] : k * x));
    for (const dt of DTS) {
      for (let x = -2; x <= 2; x += 0.37) for (const z of [-0.47, 0.13]) {
        const b = makeBody(W2, { p: [x, k * x + 0.3, z], yaw: 0 }, 20);
        let low = Infinity;
        for (let i = 0; i < 1.3 / dt; i++) { b.step(dt, { jump: i * dt < 0.4 }, 0); low = Math.min(low, b.s.y - k * b.s.x); }
        assert(low > -0.02 && b.s.ground && near(b.s.y, k * b.s.x, 0.02), `slope ${k}, ${hz(dt)} Hz: a jump in place at ${x.toFixed(2)}, ${z} under the roof came down to ${b.s.y}, ${low} under the floor`);
        tries++;
      }
      for (const dir of [1, -1]) for (const mag of [0.6, 1]) {
        const b = makeBody(W2, { p: [-2.5 * dir, -2.5 * dir * k + 0.3, 0.13], yaw: 0 }, 20);
        let low = Infinity;
        for (let i = 0; i < 1.4 / dt; i++) { b.step(dt, { mx: dir * mag, jump: i * dt > 0.2 && i * dt < 0.5 }, 0); low = Math.min(low, b.s.y - k * b.s.x); }
        assert(low > -0.02 && b.s.ground && near(b.s.y, k * b.s.x, 0.02), `slope ${k}, ${hz(dt)} Hz: a running jump ${dir > 0 ? 'up' : 'down'} the slope under the roof ended at ${b.s.x}, ${b.s.y}, ${low} under the floor`);
        tries++;
      }
    }
  }
  const lip = layered((x, z) => (z < -0.01 ? 0 : z < 1.01 ? [8, 1] : 8));
  for (const dt of DTS) for (const x of [-1, 0.13, 0.6]) for (const z of [-0.2, -0.14, -0.06, 0.1, 0.4]) for (const up of [1.5, 3]) {
    const b = makeBody(lip, { p: [x, 0, z], yaw: 0 }, 20), f = lip.floor(x, z);
    b.s.ground = false; b.s.y = f + up;
    for (let i = 0; i < 1.5 / dt; i++) b.step(dt, {}, 0);
    assert(b.s.ground && near(b.s.y, f, 0.02), `${hz(dt)} Hz: a fall from ${up} up past the lip at ${x}, ${z} came down to ${b.s.y}, not the floor at ${f}`);
    tries++;
  }
  const cave = layered(x => (x < 0 ? 1.2 : [4.5, 0])), low = layered(x => (x < 0 ? 1.2 : [1.8, 0]));
  for (const dt of DTS) for (const slow of [false, true]) for (const z of [0, 0.4]) {
    const b = makeBody(cave, { p: [-1.5, 1.2, z], yaw: 0 }, 20);
    hold(b, 2, { ...toward(1, 0), slow }, dt);
    assert(b.s.ground && b.s.x > 1 && near(b.s.y, 0, 0.01), `${hz(dt)} Hz${slow ? ' walking' : ''}: off the 1.2 ledge into the cave it got to ${b.s.x}, ${b.s.y}`);
    const c = makeBody(low, { p: [-1.5, 1.2, z], yaw: 0 }, 20);
    hold(c, 1.5, () => {
      if (c.s.ground) assert(c.s.floor === c.s.y, `${hz(dt)} Hz: stepping onto the low roof at ${c.s.x}, the shadow is at ${c.s.floor}, the feet at ${c.s.y}`);
      return { ...toward(1, 0), slow };
    }, dt);
    assert(c.s.ground && c.s.x > 1 && near(c.s.y, 1.8, 0.01), `${hz(dt)} Hz${slow ? ' walking' : ''}: from the 1.2 ledge onto the low roof it got to ${c.s.x}, ${c.s.y}`);
    tries++;
  }
  assert(reachable(cave, { p: [-1.5, 1.2, 0] }, 20).near([2, 0.5, 0], 0.4), 'the reach search drops off the ledge into the cave');
  pass('the floor under a gap: landings on a slope under a roof and past an overhang, and a walk off a ledge into a cave', { tries });
}
{ /* the gap corners of a cell agree: the feet are in the gap, or on its roof, for all of them at once. Under a roof at 5 over a floor
     that slopes 0.6 or 1.0 (a map without the underside, so feet 1.8 over a corner's floor are on its roof), a running jump down the
     slope, with the stick held or let go in the air, lands on the floor, and after a walk across the slope it is still on the floor:
     never on a shelf in mid-air, made of roof corners and floor corners blended. And a thin roof, 1.85 or 2.0 over a floor that slopes
     0.6 to 2.0 with it (with its underside at 1.8, or without), holds a jump in place and a fall from 1.5 */
  let tries = 0;
  for (const k of [0.6, 1.0]) {
    const W2 = layered((x, z) => (Math.abs(x) <= 4 && Math.abs(z) <= 4 ? [5 + k * x, k * x] : k * x));
    for (const dt of DTS) for (let x = -2; x <= 2.01; x += 0.231) for (const z of [-0.41, 0.3]) for (const mx of [-0.6, -1]) for (const dur of [0.3, 0.5, 9]) {
      const b = makeBody(W2, { p: [x, k * x + 0.1, z], yaw: 0 }, 20), from = `slope ${k}, ${hz(dt)} Hz: a running jump down the slope from ${x.toFixed(3)}, ${z} (stick ${mx} for ${dur} s)`;
      const under = () => Math.abs(b.s.x) <= 3.9 && Math.abs(b.s.z) <= 3.9;
      hold(b, 1.4, t => {
        if (b.s.events.includes('land') && under()) assert(near(b.s.y, k * b.s.x, 0.02), `${from} landed at ${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)}, ${(b.s.y - k * b.s.x).toFixed(2)} over the floor`);
        return { mx: t < dur ? mx : 0, jump: t > 0.05 && t < 0.45 };
      }, dt);
      if (Math.abs(b.s.x) > 3.7) continue;
      assert(b.s.ground && near(b.s.y, k * b.s.x, 0.02), `${from} stands at ${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)}, ${(b.s.y - k * b.s.x).toFixed(2)} over the floor`);
      hold(b, 1, { ...toward(0, b.s.z < 0 ? 1 : -1), slow: true }, dt);
      assert(b.s.ground && near(b.s.y, k * b.s.x, 0.02), `${from}, then across the slope, stands at ${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)}, ${b.s.z.toFixed(2)}, ${(b.s.y - k * b.s.x).toFixed(2)} over the floor`);
      tries++;
    }
  }
  for (const H of [1.85, 2.0]) for (const k of [0.6, 1.0, 1.5, 2.0]) for (const withUnder of [false, true]) {
    const W2 = layered((x, z) => (Math.abs(x) <= 6 && Math.abs(z) <= 6 ? (withUnder ? [k * x + H, k * x, k * x + 1.8] : [k * x + H, k * x]) : k * x - 1));
    const on = `the roof ${H} over a floor sloped ${k}${withUnder ? ' (with its underside)' : ''}`;
    for (const dt of DTS) for (let x = -2; x <= 2; x += 0.53) for (const z of [-0.41, 0.07]) {
      const top = k * x + H, b = makeBody(W2, { p: [x, top + 0.3, z], yaw: 0 }, 20);
      assert(near(b.s.y, top, 0.03), `${on}: put down on the top at ${x.toFixed(2)}, ${z}`);
      hold(b, 1.3, t => ({ jump: t < 0.4 }), dt);
      assert(b.s.ground && near(b.s.y, k * b.s.x + H, 0.03), `${on}, ${hz(dt)} Hz: a jump in place at ${x.toFixed(2)}, ${z} came down to ${b.s.y.toFixed(2)}, not the top at ${top.toFixed(2)}`);
      const c = makeBody(W2, { p: [x, top + 0.3, z], yaw: 0 }, 20);
      c.s.ground = false; c.s.y = top + 1.5;
      hold(c, 1.3, {}, dt);
      assert(c.s.ground && near(c.s.y, k * c.s.x + H, 0.03), `${on}, ${hz(dt)} Hz: a fall from 1.5 onto ${x.toFixed(2)}, ${z} came down to ${c.s.y.toFixed(2)}, not the top at ${top.toFixed(2)}`);
      tries += 2;
    }
  }
  /* a corner whose top is in reach and whose underside is below the floor of the gap in question belongs to that floor, not to its roof:
     a grate at 0.5 over a pit (underside -0.3) beside a vault (floor 0.5, underside 4.4), with the underside in the map or without it.
     Running jumps across the edge, both ways, fly and land as they do on plain ground at 0.5: the vault's edge is not a wall */
  const plain = layered(() => 0.5);
  for (const withUnder of [false, true]) {
    const vault = layered(x => (x < 0 ? (withUnder ? [0.5, -2.2, -0.3] : [0.5, -2.2]) : withUnder ? [4.7, 0.5, 4.4] : [4.7, 0.5]));
    for (const dt of DTS) for (const dir of [1, -1]) for (const z of [0.07, 0.19]) for (const tj of [0.25, 0.35, 0.45]) {
      const fly = W2 => {
        const b = makeBody(W2, { p: [-2.2 * dir, 0.8, z], yaw: 0 }, 20);
        hold(b, 1.3, t => ({ mx: dir, jump: t > tj && t < tj + 0.4 }), dt);
        return b.s;
      };
      const a = fly(plain), r = fly(vault);
      assert(r.ground && near(r.x, a.x, 0.01) && near(r.y, 0.5, 0.01), `${withUnder ? 'with' : 'without'} the underside, ${hz(dt)} Hz: a running jump ${dir > 0 ? 'into' : 'out of'} the vault over the grate ended at ${r.x.toFixed(2)}, ${r.y.toFixed(2)} (on plain ground ${a.x.toFixed(2)})`);
      tries++;
    }
  }
  pass('the gap corners of a cell agree: no shelf in mid-air under a roof, and a thin roof over a sloped floor holds', { tries });
}
{ /* the gap's underside. The walk map's layers: two (the underside is then the floor + 1.8) or three, named by the settings or counted
     from the size; too few cells for the named layers is an error. In a map with the underside, feet are in a gap while they are under
     it, however far over its floor: a running jump down a slope under a roof 6 high flies as it does on the open slope, and lands where
     that one lands. Without the underside, that roof is a wall at the top of the jump */
  const info = { x0: 0, z0: 0, step: 1, nx: 2, nz: 2 };
  assert.throws(() => makeWalk({ ...info, layers: ['T', 'G', 'U'] }, new Int16Array(8)), /wrong size/, 'three layers named, two given');
  assert(makeWalk({ ...info, layers: ['T', 'G'] }, new Int16Array(12)).U === null && makeWalk(info, new Int16Array(12)).U !== null, 'the layers by name, else by size');
  let tries = 0;
  for (const k of [0.4, 0.6, 1.0]) {
    const open = layered(x => k * x), box = (x, z) => Math.abs(x) <= 6 && Math.abs(z) <= 6;
    const high = layered((x, z) => (box(x, z) ? [6 + k * x, k * x, 5.8 + k * x] : k * x)), old = layered((x, z) => (box(x, z) ? [6 + k * x, k * x] : k * x));
    for (const dt of DTS) for (const z of [-0.37, 0.13]) {
      const fly = W2 => {
        const b = makeBody(W2, { p: [3, 3 * k + 0.3, z], yaw: 0 }, 20);
        let land = null, slow = Infinity;
        hold(b, 1.6, t => {
          if (b.s.events.includes('land') && land === null) land = b.s.x;
          if (!b.s.ground && land === null) slow = Math.min(slow, Math.hypot(b.s.vx, b.s.vz));
          return { mx: -1, jump: t > 0.45 && t < 0.85 };
        }, dt);
        return { land, slow };
      };
      const a = fly(open), r = fly(high), o = fly(old);
      assert(a.land !== null && r.land !== null && near(r.land, a.land, 0.01) && r.slow > 0.85 * PARAMS.run, `slope ${k}, ${hz(dt)} Hz: under the high roof a running jump down the slope landed at ${r.land?.toFixed(2)} (open slope ${a.land?.toFixed(2)}), its speed fell to ${r.slow.toFixed(2)}`);
      assert(o.slow < 3, `slope ${k}, ${hz(dt)} Hz: without the underside the roof should stop the jump at its top (speed ${o.slow.toFixed(2)})`);
      tries++;
    }
  }
  pass('in a map with the gap\'s underside, a jump under a high roof does not meet it', { tries });
}
{ /* a running jump up a slope keeps its speed through the landing, at every frame step, and goes as far from the take-off at each: in
     the air the disc may overlap the slope under it, so the slope stops it neither at the take-off nor just before the landing. A
     slope steeper than the jump rises (1.0 at a run) meets the feet on the way up, and it lands there and runs on. Blocks on a slope
     still stop it: one 1.6 or 2.0 over the slope at its foot is never stood on, one 1.0 over it is jumped onto */
  for (const k of [0.3, 0.6, 1.0]) {
    const W2 = layered(x => k * x), dist = [];
    for (const dt of DTS) {
      const b = makeBody(W2, { p: [-2.5, -2.5 * k, 0.13], yaw: 0 }, 20);
      let off = null, land = null, slow = Infinity, after = 0;
      for (let i = 0; i < 1.4 / dt; i++) {
        const x0 = b.s.x;
        b.step(dt, { mx: 1, jump: i * dt > 0.2 && i * dt < 0.5 }, 0);
        if (b.s.events.includes('jump')) off = x0;
        if (off !== null && after < 0.3) slow = Math.min(slow, Math.hypot(b.s.vx, b.s.vz));
        if (b.s.events.includes('land') && land === null) {
          land = b.s.x;
          assert(b.s.landK >= 0 && b.s.landK <= 1, `slope ${k}, ${hz(dt)} Hz: the landing squash is ${b.s.landK}`);
        }
        if (land !== null) after += dt;
      }
      assert(off !== null && land !== null && slow >= 0.85 * PARAMS.run, `slope ${k}, ${hz(dt)} Hz: a running jump up the slope from ${off?.toFixed(2)} to ${land?.toFixed(2)}: its speed fell to ${slow.toFixed(2)}`);
      assert(b.s.ground && near(b.s.y, k * b.s.x, 0.01), `slope ${k}, ${hz(dt)} Hz: after the jump it runs on the slope (${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)})`);
      dist.push(+(land - off).toFixed(3));
    }
    assert(Math.max(...dist) - Math.min(...dist) < 0.22, `slope ${k}: the jump goes ${dist.join(', ')} from the take-off at 30, 60, 120 and 144 Hz`);
  }
  let tries = 0;
  for (const k of [0.3, 0.6, 1.0]) for (const h of [1.0, 1.6, 2.0]) {
    const W2 = layered((x, z) => (x >= 2 && x <= 4 && Math.abs(z) <= 3 ? k * 2 + h : k * x));
    let ups = 0;
    for (const dt of DTS) for (const x0 of [-1.5, 0, 1.2]) for (const deg of [0, 30]) for (const tj of [0.1, 0.3]) {
      const a = deg * Math.PI / 180, b = makeBody(W2, { p: [x0, k * x0, 0.13], yaw: 0 }, 20);
      let high = -Infinity;
      hold(b, 2, t => {
        if (b.s.ground && b.s.x > 1.9 && b.s.x < 4.1 && Math.abs(b.s.z) < 3.1) high = Math.max(high, b.s.y - k * 2);
        return { ...toward(Math.cos(a), Math.sin(a)), jump: t >= tj && t < tj + 0.5 };
      }, dt);
      if (h > 1.4) assert(high < 0.5, `slope ${k}, ${hz(dt)} Hz: a jump from ${x0} at ${deg}° stood on the block ${h} over the slope (${high.toFixed(2)})`);
      if (high > h - 0.01) ups++;
      tries++;
    }
    if (h < 1.4) assert(ups > 0, `slope ${k}: no jump got onto the block 1.0 over the slope`);
  }
  // only a slope leans: a hillside of 4 per unit (a face, steeper than a climb per radius) is not climbed by jumping at it again and again
  const face = layered(x => Math.max(0, Math.min(6, 4 * x)));
  for (const dt of DTS) for (const deg of [0, 25, 50]) for (const per of [0.35, 0.6, 0.9]) {
    const a = deg * Math.PI / 180, b = makeBody(face, { p: [-1.5, 0, 0.13], yaw: 0 }, 20);
    const high = hold(b, 5, t => ({ ...toward(Math.cos(a), Math.sin(a)), jump: t % per < per / 2 }), dt);
    assert(high < 2, `${hz(dt)} Hz, ${deg}°, a jump every ${per} s: it climbed the face of 4 per unit to ${high.toFixed(2)}`);
    tries++;
  }
  pass('a running jump up a slope keeps its speed and its length at every frame step, and blocks on a slope still stop it', { tries });
}
{ // walking off an edge falls, and lands below
  const b = makeBody(W, { p: [8, 0, -7], yaw: Math.PI }, 20);
  run(b, 1.5, { mz: 1 }, 0);
  assert(b.s.y < -5, `fell into the pit: y ${b.s.y}`);
  assert(b.s.ground && near(b.s.y, -6, 1e-6));
  pass('walking off an edge falls and lands');
}
{ // under the arch: the floor under the gap is walked; the arch top is not where the feet go
  const b = makeBody(W, { p: [-10, 0, 0], yaw: 0 }, 20);
  run(b, 2, { mx: 1 }, 0);
  assert(b.s.x > -6 && near(b.s.y, 0, 1e-6), `walked under the arch: x ${b.s.x}, y ${b.s.y}`);
  // at every frame step, running, walking (Shift) and with the stick part way: the feet never leave the floor under it
  for (const dt of DTS) for (const inp of [{ mx: 1 }, { mx: 1, slow: true }, { mx: 0.3 }, { ...toward(1, 0.2), slow: true }]) {
    const a = makeBody(W, { p: [-10, 0, 0], yaw: 0 }, 20);
    let top = 0;
    for (let i = 0; i < 4 / dt; i++) { a.step(dt, inp, 0); top = Math.max(top, a.s.y); }
    assert(a.s.x > -6 && top < 0.01, `${hz(dt)} Hz ${JSON.stringify(inp)}: under the arch, x ${a.s.x}, feet up to ${top}`);
  }
  pass('the lamplighter walks under an arch at every frame step and speed');
}
{ // the camera comes in front of a wall between it and the lamplighter, and its eye stays out of the wall
  const eyeOf = v => {
    const cp = Math.cos(v.pitch);
    return [v.target[0] + v.dist * Math.sin(v.yaw) * cp, v.target[1] + v.dist * Math.sin(v.pitch), v.target[2] + v.dist * Math.cos(v.yaw) * cp];
  };
  const clear = v => { const e = eyeOf(v); return e[1] - W.top(e[0], e[2]); };
  let v;
  for (const x of [3.6, 3.4, 3.0, 2.6, 2.2, 1.8]) {
    const b = makeBody(W, { p: [x, 0, 0], yaw: -Math.PI / 2 }, 20);
    const cam = makeCamera(W, { yaw: Math.PI / 2, dist: 8.5, auto: false });
    cam.snap(b.s, Math.PI / 2);
    for (let i = 0; i < 120; i++) { v = cam.follow(b.s, 1 / 60, {}); assert(clear(v) > 0.1, `body at x ${x}, frame ${i}: the eye ${eyeOf(v).map(n => n.toFixed(2))} is in the wall`); }
    assert(v.dist < 2.5, `the camera came in: dist ${v.dist}`);
  }
  // backing into the wall with the camera behind
  const b = makeBody(W, { p: [0, 0, 0], yaw: Math.PI / 2 }, 20);
  const cam = makeCamera(W, { yaw: Math.PI / 2, dist: 8.5 });
  cam.snap(b.s, Math.PI / 2);
  for (let i = 0; i < 300; i++) {
    b.step(1 / 60, i < 240 ? { mz: -1 } : {}, cam.c.yaw);
    v = cam.follow(b.s, 1 / 60, {});
    assert(clear(v) > 0.1, `backing up, frame ${i}: the eye ${eyeOf(v).map(n => n.toFixed(2))} is in the wall`);
  }
  assert(b.s.x > 3 && b.s.x < 4, `it backed up to the wall: x ${b.s.x}`);
  const open = makeCamera(W, { yaw: -Math.PI / 2, dist: 8.5, auto: false });
  const ob = makeBody(W, { p: [3.4, 0, 0], yaw: -Math.PI / 2 }, 20);
  open.snap(ob.s, -Math.PI / 2);
  for (let i = 0; i < 60; i++) v = open.follow(ob.s, 1 / 60, {});
  assert(near(v.dist, 8.5, 0.01) && near(v.pitch, 0.34, 1e-6), 'with nothing in the way it stays back');
  pass('the camera comes in front of a wall and keeps out of it');
}
{ // touch rules
  const s = { x: 0, y: 0, z: 0 };
  assert(touches(s, [0.5, 1, 0]) && !touches(s, [0.5, 2.5, 0]) && !touches(s, [1.5, 1, 0]));
  assert(atBeacon(s, { p: [1, 1, 0], r: 1.6 }) && !atBeacon(s, { p: [2, 1, 0], r: 1.6 }));
  pass('wisps and the beacon are touched only near them');
}
{ // reach search agrees with the controller
  const R = reachable(W, { p: [0, 0, 18], yaw: 0 }, 20);
  assert(R.near([-2, 1.5, 5]), 'the 1.0 ledge is in reach');
  // 1.0 above the ledge's top: in touch only from the top itself
  assert(!R.near([-2, 3.0, 9], 0.6), 'the top of the 2.0 ledge is not');
  // the control: the same ledge at 1.0 is in reach, so the check above can fail
  assert(reachable(made({ ledge2: 1.0 }), { p: [0, 0, 18], yaw: 0 }, 20).near([-2, 3.0, 9], 0.6), 'a 1.0 ledge there is');
  // the walls and the arch's top are not; the floor under the arch is
  assert(!R.near([4.5, 3.5, 0], 0.6) && !R.near([12.5, 10.5, 0], 0.6), 'the tops of the walls are not');
  assert(!R.near([-7.5, 3.5, 0], 0.4) && R.near([-7.5, 0.5, 0], 0.4), 'under the arch is, its top is not');
  pass('the reach search matches the controller');
}
{ /* the reach search jumps as the controller does: up to JUMP - 0.1, and across a gap to land up to 1.0 away. Flat ground at 0 with a
     block 1.25 high and one 1.6 high, and two trenches 6 deep across the whole map: to the north two rows of the grid (from its edge
     the first place to stand is 1.0 away), to the south five rows. The search reaches the 1.25 top and the north side, and the
     controller gets there at every frame step; the 1.6 top and the south side are out of the search's reach */
  const J = layered((x, z) => {
    if (z > 2.1 && z < 2.6) return -6;
    if (z < -2.1 && z > -3.4) return -6;
    if (x >= -6 && x <= -4.5 && Math.abs(z) <= 1.5) return 1.25;
    if (x >= 4.5 && x <= 6 && Math.abs(z) <= 1.5) return 1.6;
    return 0;
  });
  const R = reachable(J, { p: [0, 0, 0] }, 20);
  assert(R.near([-5.25, 2.3, 0], 0.4), 'the search jumps onto the 1.25 block');
  assert(!R.near([5.25, 2.6, 0], 0.4), 'the search does not get onto the 1.6 block');
  assert(R.near([0, 0.5, 4], 0.4), 'the search jumps the north trench');
  assert(!R.near([0, 0.5, -5], 0.4), 'the search does not jump the south trench');
  for (const dt of DTS) {
    // onto the 1.25 block, from a run-up and from standing against it
    for (const x of [-3, -4.15]) {
      const b = makeBody(J, { p: [x, 0, 0], yaw: 0 }, 20);
      const high = hold(b, 1.5, t => ({ ...toward(-1, 0), jump: t > (x < -4 ? 0 : 0.2) && t < 0.7 }), dt);
      assert(near(high, 1.25, 0.01), `${hz(dt)} Hz: a jump from x ${x} onto the 1.25 block stood at ${high}`);
    }
    // not onto the 1.6 block
    const c = makeBody(J, { p: [3, 0, 0], yaw: 0 }, 20);
    const high = hold(c, 1.5, t => ({ ...toward(1, 0), jump: t > 0.2 && t < 0.7 }), dt);
    assert(high < 0.05, `${hz(dt)} Hz: a jump at the 1.6 block stood at ${high}`);
    // over the north trench, walking or running, jumping at its edge
    for (const slow of [false, true]) {
      const d = makeBody(J, { p: [0, 0, 0], yaw: 0 }, 20);
      hold(d, 2, () => ({ ...toward(0, 1), slow, jump: d.s.z > 1.7 && d.s.z < 2.2 }), dt);
      assert(d.s.ground && d.s.z > 3 && near(d.s.y, 0, 0.01), `${hz(dt)} Hz${slow ? ' walking' : ''}: over the north trench to z ${d.s.z}, y ${d.s.y}`);
    }
  }
  /* where it lands, every cell round the point must be a slope: so not on the tip of a lone stake 1.2 high (one grid point), which
     the controller stands on only by luck. And no floor on the way may be higher than both ends: so a hop over a wall one row thick
     and 1.2 high is not counted, though the controller often makes it */
  const stake = layered((x, z) => (Math.abs(x - 2) < 0.01 && Math.abs(z) < 0.01 ? 1.2 : 0));
  assert(!reachable(stake, { p: [0, 0, 0] }, 20).near([2, 1.2, 0], 0.05, -0.05, 0.05), 'the search does not land on the tip of a stake');
  const row = layered((x, z) => (Math.abs(z - 2) < 0.01 ? 1.2 : 0));
  assert(!reachable(row, { p: [0, 0, 0] }, 20).near([0, 0, 3], 0.3), 'the search does not count a hop over a wall one row thick');
  assert(reachable(layered((x, z) => (Math.abs(z - 2) < 0.01 ? 0.8 : 0)), { p: [0, 0, 0] }, 20).near([0, 0, 3], 0.3), 'a row of 0.8 is walked over');
  /* on the way the feet are read at the top of the jump, 1.45 over the take-off, as high as the controller reads them. From open ground
     at 1.0 across one or two rows of a gap (floor 0.6, roof 5) to open ground at 2.2: in a map without the underside, feet at 2.45 are
     on the gap's roof (1.8 over its floor), so the roof is in the way and the jump does not count; feet read at the take-off (1.0) or
     0.1 short of the top (2.3) would be in the gap. With the underside in the map at 4.8, the feet are in the gap and the jump counts */
  for (const w of [1, 2]) {
    const ground = u => layered((x, z) => (z < -0.01 ? 1.0 : z < w * 0.25 - 0.01 ? (u ? [5, 0.6, u] : [5, 0.6]) : 2.2));
    const across = W2 => reachable(W2, { p: [0, 1.0, -1] }, 20).near([0, 2.2, w * 0.25 + 0.6], 0.3, -0.05, 0.05);
    assert(!across(ground()), `the search jumps ${w} row(s) of a gap under a roof 1.8 over its floor`);
    assert(across(ground(4.8)), `the search does not jump ${w} row(s) of a gap whose underside is at 4.8`);
  }
  pass('the reach search jumps up to JUMP - 0.1 and 1.0 across, and the controller makes those jumps');
}

/* ---------------- the pose ---------------- */
{
  const rig = { names: ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'shadow'], pivots: [[0, 80.1, 0], [0, 80.82, 0], [0.15, 80.24, 0], [-0.15, 80.24, 0], [0.33, 80.72, 0.04], [-0.33, 80.72, 0], [0, 120, 0]] };
  const bones = new Float32Array(84);
  const s = { x: 3, y: 2, z: -5, yaw: Math.PI / 2, phase: 0, moveK: 0, runK: 0, landK: 0, landAge: 9, ground: true, vy: 0, floor: 2 };
  pose(bones, rig, s, 0, true);
  assert(bones.every(Number.isFinite));
  const apply = (b, p) => [0, 1, 2].map(a => bones[12 * b + a * 3] * p[0] + bones[12 * b + a * 3 + 1] * p[1] + bones[12 * b + a * 3 + 2] * p[2] + bones[12 * b + 9 + a]);
  const feet = apply(0, [0, 80, 0]);
  assert(near(feet[0], 3, 1e-5) && near(feet[1], 2, 1e-5) && near(feet[2], -5, 1e-5), 'the body bone puts the feet at the body');
  const nose = apply(1, [0, 81, 0.25]);
  assert(near(nose[0], 3.25, 0.02) && near(nose[2], -5, 0.02), 'facing +x at yaw π/2, the face is at +x');
  const sh = apply(6, [0, 120, 0]);
  assert(near(sh[1], 2.04, 1e-5) && near(sh[0], 3, 1e-5), 'the shadow lies on the floor under the body');
  s.y = 4; pose(bones, rig, s, 0, true);
  assert(bones[72] < 1, 'the shadow shrinks when the body is in the air');
  pass('the bones put the lamplighter where its body is');
}

/* ---------------- the saved game ---------------- */
{
  for (const bad of [null, 7, 'x', [], { reached: 'all' }, { reached: [1, 2], wisps: [], lit: 'yes', time: -4, best: NaN }, { wisps: { gaol: [0, 9, 'a', 2.5, 2] } }])
    assert.deepEqual(Object.keys(clean(bad)).sort(), Object.keys(fresh()).sort());
  const s = clean({ reached: ['gaol', 'ramparts', 'bells'], at: 'bells', wisps: { gaol: [0, 4, 4, 9], fen: [1] }, lit: { gaol: true, barrows: true }, time: 61, best: 1e12, seen: true });
  assert.deepEqual(s.reached, ['gaol', 'ramparts'], 'a gap in the places reached cuts the list there');
  assert.equal(s.at, 'gaol', 'a place not reached cannot be where you are');
  assert.deepEqual(s.wisps.gaol, [0, 4]);
  assert.deepEqual(s.lit, { gaol: true });
  assert(s.time === 61 && s.best === 0 && s.seen === true);
  assert.equal(wispCount(s), 3);
  pass('a bad save is cleaned field by field');
}
{ // a beacon lit while the place after it is shut would lock the player in, so it goes dark; no storage at all is an empty save
  assert.deepEqual(clean({ reached: ['gaol'], lit: { gaol: true } }).lit, {});
  assert.deepEqual(clean({ reached: ['gaol', 'fen'], lit: { gaol: true, fen: true } }).lit, {}, 'the gap cuts the places, then the beacon');
  assert.deepEqual(clean({ reached: ORDER, lit: { gaol: true, bells: true, barrows: true } }).lit, { gaol: true, bells: true, barrows: true });
  const { load, store } = await import('../../public/lab/gloam-downs/save.js');
  assert.deepEqual(load(null), fresh());
  assert.equal(store(null, fresh()), false);
  pass('a lit beacon always has its next place open, and blocked storage gives a fresh save');
}
if (missing.length) { console.log(`FAIL not baked: ${missing.join(', ')} (node games/gloam-downs/bake.mjs)`); process.exitCode = 1; }
console.log(`${n} checks passed`);
