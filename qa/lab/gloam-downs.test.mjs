// Gloam Downs, checked in node with no browser (public/lab/gloam-downs/):
//   the five baked places (budget, palette, bones, wisps, beacon, the start on the ground, the walk map's three layers and no crack
//   left in it to close, everything in reach by the controller's rules, and no trap in reach),
//   the controller on made-up ground (walk, run, jump height, walls, steps, ledges, a step on a ledge's lip, falls, walking under an
//   arch, landing on a sloped roof or crown over a gap and on a sloped floor under one, walking off a ledge into an arch, the corners of
//   one roof agreeing on the layer, thin roofs, a vault's edge over a grate, a jump under a high roof with the gap's underside, the bake's
//   crack pass and a hut over its crawl space, the crack pass rule by rule, the bake's trap rule on a pit, a slot, a notch and a nook,
//   a lean-to against a hall, a dome, a jump up through a thin roof, running jumps up gentle and steep slopes on any heading, curbs and
//   blocks on a slope), the reach search's walks and jumps against the controller,
//   the pose (the bones put the figure where the body is), the saved game (rubbish in, a clean save out), and the loader's check of
//   the walk file's layers.
// Run: node qa/lab/gloam-downs.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, makeCamera, pose, reachable, touches, atBeacon, JUMP, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { clean, fresh, ORDER, wispCount } from '../../public/lab/gloam-downs/save.js';
import { closeCracks } from '../../games/gloam-downs/lib/cracks.mjs';
import { byBeacon, closeTraps, findTraps } from '../../games/gloam-downs/lib/traps.mjs';

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
    assert(g < t ? u > g && u < t : g === t && u === 0, `${id}: walk cell ${k} has top ${t}, floor ${g}, underside ${u}`);
  }
  // the bake closed the cracks one cell wide: the pass finds none left
  const again = L.slice();
  assert.equal(closeCracks({ T: again.subarray(0, N), G: again.subarray(N, 2 * N), U: again.subarray(2 * N), nx: meta.walk.nx, nz: meta.walk.nz }), 0, `${id}: the walk map has cracks one cell wide (bake it again)`);
  const walk = makeWalk(meta.walk, L);
  assert(walk.U, `${id}: the controller reads the underside`);
  const floor = walk.support(meta.spawn.p[0], meta.spawn.p[2], meta.spawn.p[1] + 1);
  assert(floor !== null && near(floor, meta.spawn.p[1], 0.6), `${id}: the start stands on the ground`);
  // no trap in reach: every state the search reaches leads back to the start or the beacon, by the search or the controller
  const { R, traps } = findTraps(walk, meta);
  assert.equal(traps.length, 0, `${id}: ${traps.length} trap(s) in reach, as at (${traps[0]?.x}, ${traps[0]?.z}) (bake it again)`);
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
{ /* cracks, and a hut over its crawl space, as in the fen: water at -0.5; a porch at 1.7 under a roof (top 4, underside 3.8) for
     |x|, |z| <= 4; the hut's body in the middle (|x|, |z| <= 1.25), a solid from its top (4.5) down to 1.4 over the crawl space, water
     under it; and cracks one cell wide in the porch, as the bake reads the seams between planks: one alone at (2.5, 0), a seam of nine
     along z at x -2.5, and one beside the body at (1.5, 0.5) (the porch on both sides of it along z closes it). And a boardwalk at 0.5
     over the water (|x| <= 3, z 5 to 7)
     with a seam of three cells across it at z 6. The bake's crack pass closes those 14 cells and leaves the body, the edges and the water
     as they are. Then walks at the body from every side, walks along its walls and wanders with jumps on the porch, and walks along and
     across the boardwalk, at every frame step: the feet never go under the porch or the boardwalk. The body is not the porch's roof (their
     undersides are 2.4 apart), so its corners are a wall for feet on the porch, not a way down into the crawl space. Without the crack
     pass the walks drop through */
  const hutMap = (pass = true) => {
    const info = { x0: -20, z0: -20, step: 0.25, nx: 161, nz: 161 }, N = info.nx * info.nz, cells = new Int16Array(3 * N), at = (a, b) => Math.abs(a - b) < 0.01;
    for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) {
      const x = info.x0 + i * info.step, z = info.z0 + j * info.step, k = j * info.nx + i;
      let t = -0.5, g = -0.5, u = 0;
      if (Math.abs(x) <= 4 && Math.abs(z) <= 4) { t = 4; g = 1.7; u = 3.8; }
      if (Math.abs(x) <= 1.25 && Math.abs(z) <= 1.25) { t = 4.5; g = -0.5; u = 1.4; }
      if ((at(x, 2.5) && at(z, 0)) || (at(x, -2.5) && z >= -1 && z <= 1) || (at(x, 1.5) && at(z, 0.5))) g = -0.5;
      if (Math.abs(x) <= 3 && z >= 5 && z <= 7 && !(Math.abs(x) <= 0.3 && at(z, 6))) t = g = 0.5;
      cells[k] = Math.round(t * 100); cells[N + k] = Math.round(g * 100); cells[2 * N + k] = Math.round(u * 100);
    }
    const before = cells.slice(), closed = pass ? closeCracks({ T: cells.subarray(0, N), G: cells.subarray(N, 2 * N), U: cells.subarray(2 * N), nx: info.nx, nz: info.nz }) : 0;
    return { walk: makeWalk({ ...info, layers: ['T', 'G', 'U'] }, cells), closed, before, cells, N };
  };
  const hut = hutMap();
  assert.equal(hut.closed, 14, `the crack pass closed ${hut.closed} cells, not the 14 cracks`);
  for (let k = 0; k < hut.N; k++) {
    const t0 = hut.before[k], g0 = hut.before[hut.N + k], t1 = hut.cells[k], g1 = hut.cells[hut.N + k], u0 = hut.before[2 * hut.N + k];
    const same = t1 === t0 && g1 === g0, porch = t1 === t0 && t0 === 400 && g0 === -50 && g1 === 170, deck = t0 === -50 && t1 === 50 && g1 === 50;
    assert((same || porch || deck) && hut.cells[2 * hut.N + k] === u0, `the crack pass changed cell ${k}: top ${t0} to ${t1}, floor ${g0} to ${g1}`);
  }
  const inside = s => (Math.abs(s.x) < 3.6 && Math.abs(s.z) < 3.6 && s.y < 1.65) || (Math.abs(s.x) < 2.7 && s.z > 5.3 && s.z < 6.7 && s.y < 0.45);
  let tries = 0, drops = 0;
  const go = (W2, sec, inp, dt, what) => {
    const b = makeBody(W2, { p: what.p, yaw: 0 }, 20);
    for (let i = 0, k = Math.round(sec / dt); i < k; i++) {
      b.step(dt, typeof inp === 'function' ? inp(i * dt) : inp, 0);
      if (inside(b.s)) return `${hz(dt)} Hz, ${what.tag}: the feet went under the floor at ${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)}, ${b.s.z.toFixed(2)}`;
    }
    return null;
  };
  const walks = function* () {
    for (let a = 0; a < 360; a += 30) for (const mag of [0.35, 1]) for (const off of [-0.6, 0, 0.6]) {
      const r = a * Math.PI / 180, cx = Math.cos(r), cz = Math.sin(r);
      yield [1.6, { mx: -cx * mag, mz: cz * mag }, { p: [cx * 2.6 - cz * off, 1.9, cz * 2.6 + cx * off], tag: `a walk at the body from ${a}°, stick ${mag}, ${off} off` }];
    }
    for (const side of [0, 1, 2, 3]) for (const d of [0.31, 0.4, 0.55]) for (const into of [0, 10]) for (const mag of [0.5, 1]) {
      const n2 = [[1, 0], [0, 1], [-1, 0], [0, -1]][side], tg = [-n2[1], n2[0]], e = 1.25 + d, ia = into * Math.PI / 180;
      const hx = tg[0] * Math.cos(ia) - n2[0] * Math.sin(ia), hz2 = tg[1] * Math.cos(ia) - n2[1] * Math.sin(ia);
      yield [1.4, { mx: hx * mag, mz: -hz2 * mag }, { p: [n2[0] * e - tg[0] * 2, 1.9, n2[1] * e - tg[1] * 2], tag: `a walk along the body's side ${side}, ${d} out, ${into}° into it` }];
    }
    for (const z of [5.9, 6, 6.1]) for (const dir of [1, -1]) for (const slow of [false, true]) yield [1.6, { mx: dir, slow }, { p: [-2.4 * dir, 0.7, z], tag: `a walk along the boardwalk at z ${z}` }];
    for (const x of [-0.3, -0.1, 0, 0.12, 0.3]) for (const dir of [1, -1]) yield [1.2, { mz: -dir }, { p: [x, 0.7, 6 - 0.9 * dir], tag: `a walk across the boardwalk's seam at x ${x}` }];
  };
  for (const dt of DTS) {
    for (const [sec, inp, what] of walks()) { const bad = go(hut.walk, sec, inp, dt, what); assert(!bad, bad); tries++; }
    let seed = 3 + hz(dt);
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let q = 0; q < 8; q++) {
      const p = [(rnd() - 0.5) * 6, 1.9, (rnd() < 0.5 ? -1 : 1) * (1.8 + rnd() * 1.5)];
      let a = 0, m = 0;
      const bad = go(hut.walk, 8, t => {
        if (Math.abs(t % 0.5) < dt / 2) { a = rnd() * 6.283; m = [0.3, 0.6, 1][Math.floor(rnd() * 3)]; }
        return { mx: Math.cos(a) * m, mz: Math.sin(a) * m, jump: rnd() < 0.03 };
      }, dt, { p, tag: `wander ${q} from ${p[0].toFixed(2)}, ${p[2].toFixed(2)}` });
      assert(!bad, bad);
      tries++;
    }
  }
  const open = hutMap(false).walk;
  for (const [sec, inp, what] of walks()) if (go(open, sec, inp, 1 / 60, what)) drops++;
  assert(drops > 0, 'without the crack pass a walk should drop through a crack');
  pass('the bake closes cracks one cell wide, and from a hut\'s porch the feet never drop into the crawl space under it', { tries, dropsWithoutThePass: drops });
}
// a made-up walk map as the bake writes it: fn(x, z) -> h, or [top, floor under the gap, underside], on a 40 x 40 grid at 0.25
const mapOf = fn => {
  const info = { x0: -20, z0: -20, step: 0.25, nx: 161, nz: 161, layers: ['T', 'G', 'U'] }, N = info.nx * info.nz, cells = new Int16Array(3 * N);
  const ki = (x, z) => Math.round((z - info.z0) / info.step) * info.nx + Math.round((x - info.x0) / info.step);
  for (let j = 0; j < info.nz; j++) for (let i = 0; i < info.nx; i++) {
    const v = fn(info.x0 + i * info.step, info.z0 + j * info.step), [t, g = t, u = 0] = Array.isArray(v) ? v : [v], k = j * info.nx + i;
    cells[k] = Math.round(t * 100); cells[N + k] = Math.round(g * 100); cells[2 * N + k] = Math.round(u * 100);
  }
  const L = { T: cells.subarray(0, N), G: cells.subarray(N, 2 * N), U: cells.subarray(2 * N), nx: info.nx, nz: info.nz };
  return { info, cells, N, L, ki, at: (x, z) => [L.T[ki(x, z)], L.G[ki(x, z)], L.U[ki(x, z)]], walk: () => makeWalk(info, cells) };
};
const on = (a, b) => Math.abs(a - b) < 0.01;
// walks over a spot at every frame step, straight across it on 8 headings at two speeds, and wanders with jumps round it -> the lowest
// the feet stood on the ground within r of it
const lowestNear = (W2, [cx, cy, cz], r, from = 1.6) => {
  let low = Infinity;
  const watch = b => { if (b.s.ground && Math.hypot(b.s.x - cx, b.s.z - cz) < r) low = Math.min(low, b.s.y); };
  for (const dt of DTS) {
    for (let a = 0; a < 360; a += 45) for (const mag of [0.35, 1]) for (const off of [-0.12, 0.05]) {
      const rad = a * Math.PI / 180, ux = Math.cos(rad), uz = Math.sin(rad), b = makeBody(W2, { p: [cx - ux * from - uz * off, cy + 0.3, cz - uz * from + ux * off], yaw: 0 }, 20);
      for (let i = 0, k = Math.round(1.4 / dt); i < k; i++) { b.step(dt, { mx: ux * mag, mz: -uz * mag }, 0); watch(b); }
    }
    let seed = 11 + hz(dt);
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let q = 0; q < 6; q++) {
      const b = makeBody(W2, { p: [cx + (rnd() - 0.5) * 2.4, cy + 0.3, cz + (rnd() - 0.5) * 2.4], yaw: 0 }, 20);
      let a = 0, m = 0;
      for (let i = 0, k = Math.round(6 / dt); i < k; i++) {
        if (i % Math.round(0.5 / dt) === 0) { a = rnd() * 6.283; m = [0.3, 0.6, 1][Math.floor(rnd() * 3)]; }
        b.step(dt, { mx: Math.cos(a) * m, mz: Math.sin(a) * m, jump: rnd() < 0.03 }, 0);
        watch(b);
      }
    }
  }
  return low;
};
{ /* the crack pass, rule by rule. A seam one cell wide between floors at 0 and 0.5, over a drop of 2 (as in the gaol): it comes up
     half way, to 0.25. A notch two cells by two in a platform at 4.9, 1.5 deep (as in the fen): it comes up to 4.9. Seams between
     floors 0.08 apart come up to one of the two floors; 0.15 apart, half way. A seam between a floor and a wall comes up to the floor,
     the only pair that closes it. A crack in an open porch over the water keeps the porch's gap under it. A crack whose only pair is a
     crack that the first pass closes is closed by the second. A post over a culvert between two floors whose feet are over its
     underside is a wall, not a crack, and stays. A slot by a wall under a bracket 0.6 over the floor beside it is closed solid, for
     less than 1.8 would be left under the bracket. A crack that is the low top of a gap (a grate 1 under the floor, over a pit) stays.
     Walks and wanders over the seam and the notch, at every frame step, never stand in them */
  const run1 = fn => { const m = mapOf(fn); m.closed = closeCracks(m.L); return m; };
  const seam = run1((x, z) => (on(x, 0) && Math.abs(z) <= 4 ? -2 : x < 0 ? 0 : 0.5));
  assert.equal(seam.closed, 33, `the seam: ${seam.closed} cells closed, not 33`);
  for (let z = -4; z <= 4; z += 0.25) assert.deepEqual(seam.at(0, z), [25, 25, 0], `the seam at z ${z}: ${seam.at(0, z)}`);
  const sLow = lowestNear(seam.walk(), [0, 0.25, 0], 0.15);
  assert(sLow > -0.05, `walks across the seam between 0 and 0.5 stood in it at ${sLow.toFixed(2)}`);
  const notch = run1((x, z) => (Math.abs(x) > 4 || Math.abs(z) > 4 ? 0 : (on(x, 0) || on(x, 0.25)) && (on(z, 0) || on(z, 0.25)) ? 3.4 : 4.9));
  assert.equal(notch.closed, 4, `the notch: ${notch.closed} cells closed, not 4`);
  for (const [x, z] of [[0, 0], [0.25, 0], [0, 0.25], [0.25, 0.25]]) assert.deepEqual(notch.at(x, z), [490, 490, 0], `the notch at ${x}, ${z}: ${notch.at(x, z)}`);
  const nLow = lowestNear(notch.walk(), [0.125, 4.9, 0.125], 0.3);
  assert(nLow > 4.85, `walks across the notch stood in it at ${nLow.toFixed(2)}`);
  // the tolerance: 0.08 apart is one floor, 0.15 apart two (on z < 0, and on z > 2)
  const tol = run1((x, z) => (on(x, 0) && ((z >= -3 && z <= -1) || (z >= 3 && z <= 5)) ? -2 : x < 0 ? 0 : z < 1 ? 0.08 : 0.15));
  for (let z = -3; z <= -1; z += 0.25) assert([0, 8].includes(tol.at(0, z)[0]), `floors 0.08 apart: the seam at z ${z} came up to ${tol.at(0, z)[0]}, not to a floor`);
  for (let z = 3; z <= 5; z += 0.25) assert(Math.abs(tol.at(0, z)[0] - 7.5) <= 1, `floors 0.15 apart: the seam at z ${z} came up to ${tol.at(0, z)[0]}, not half way`);
  // a floor and a wall: the seam runs along z, so its cells along z are cracks too and only the floor and the wall close it
  const wall = run1((x, z) => (on(x, 0) && Math.abs(z) <= 2 ? -2 : x < 0 ? 0 : 3));
  for (let z = -2; z <= 2; z += 0.25) assert.deepEqual(wall.at(0, z), [0, 0, 0], `a seam between a floor and a wall at z ${z}: ${wall.at(0, z)}`);
  // an open porch over the water: top 1.7, the water at -0.5, the porch's underside 1.4
  const porch = run1((x, z) => (on(x, 0) && on(z, 0) ? -0.5 : Math.abs(x) <= 3 && Math.abs(z) <= 3 ? [1.7, -0.5, 1.4] : -0.5));
  assert.deepEqual(porch.at(0, 0), [170, -50, 140], `a crack in an open porch over the water came up to ${porch.at(0, 0)}, not the porch over the water`);
  // planks at 0.5 over the water: one along x up to x 0, and one along z at x 0.5 with a crack at z 0. The crack at (0.25, 0) is
  // closed only once the one at (0.5, 0) is
  const late = run1((x, z) => ((x >= -1 && x <= 0.01 && on(z, 0)) || (on(x, 0.5) && Math.abs(z) <= 1 && !on(z, 0)) ? 0.5 : -0.5));
  assert(late.closed === 2 && late.at(0.25, 0)[0] === 50 && late.at(0.5, 0)[0] === 50, `planks: ${late.closed} closed, (0.25, 0) at ${late.at(0.25, 0)}, (0.5, 0) at ${late.at(0.5, 0)}`);
  // a post (top 4) over a culvert (floor 0, underside 1.5) in a floor at 2: feet at 2 are over the underside, so the post is a wall
  const post = run1((x, z) => (on(x, 0) && on(z, 0) ? [4, 0, 1.5] : Math.abs(x) <= 3 && Math.abs(z) <= 3 ? 2 : 0));
  assert(post.closed === 0 && post.at(0, 0).join() === '400,0,150', `a post over a culvert: ${post.closed} closed, the post is ${post.at(0, 0)}`);
  // a floor at 2 (x < 0), a slot at x 0 (floor 0) under a bracket (top 2.9, underside 2.6), and a wall (3.5) east of it
  const bracket = run1(x => (on(x, 0) ? [2.9, 0, 2.6] : x < 0 ? 2 : 3.5));
  assert.deepEqual(bracket.at(0, 0), [290, 290, 0], `a slot under a bracket 0.6 over the floor came up to ${bracket.at(0, 0)}, not solid`);
  // a grate (top 0, a pit to -3 under it, underside -0.2) one cell wide in a floor at 1
  const grate = run1((x, z) => (on(x, 0) && on(z, 0) ? [0, -3, -0.2] : 1));
  assert(grate.closed === 0 && grate.at(0, 0).join() === '0,-300,-20', `a grate 1 under the floor: ${grate.closed} closed, it is ${grate.at(0, 0)}`);
  pass('the crack pass: a seam between two floors, a notch two cells wide, floors 0.08 and 0.15 apart, a floor and a wall, an open porch, two passes, and a post that is no crack', { seamLow: +sLow.toFixed(2), notchLow: +nLow.toFixed(2) });
}
{ /* no trap in reach (lib/traps.mjs). Flat ground at 0 with the start at the middle and the beacon at (-8, 0, -8), and four traps that
     no walk or jump leaves: a pit a metre across and 2 deep at x, z 3 to 3.75; a slot one cell wide and 2 deep at x 6, z -1 to 1,
     between the ground and a floor at 0.5 east of it; a notch three cells by three in a platform at 1.0 (x 9 to 12), 1.45 deep, which
     a jump from a few of its cells leaves on one or two headings of 16 (too few to find); and
     a nook under a roof (top 3, underside 2.2) over the ground, x -7 to -4, where one cell reads the crawl space 2 under the floor; and a
     trench 2 deep and a metre wide between walls 3 high (x 0 to 3, z 8 to 9), open only at its west end, so its far end is reached only
     along it. The search and the controller find each of them. closeTraps() fills them, each to the floor of its way in, and changes nothing else;
     then none is left, in one round, and walks and wanders at every frame step never stand in them. Without the rule, walks end in them */
  const at = (x, z, x0, x1, z0, z1) => x >= x0 - 0.01 && x <= x1 + 0.01 && z >= z0 - 0.01 && z <= z1 + 0.01;
  const fn = (x, z) => {
    if (at(x, z, 3, 3.75, 3, 3.75)) return -2;
    if (on(x, 6) && Math.abs(z) <= 1) return -2;
    if (x > 6 && x < 8.5) return 0.5;
    if (at(x, z, 10, 10.5, 0, 0.5)) return -0.45;
    if (at(x, z, 9, 12, -2, 2)) return 1.0;
    if (on(x, -5.5) && on(z, 0)) return [3, -2, 2.2];
    if (at(x, z, -7, -4, -1.5, 1.5)) return [3, 0, 2.2];
    if (at(x, z, 0, 3, 8, 9)) return -2;
    if (at(x, z, 0, 3.25, 7.75, 9.25)) return 3;
    return 0;
  };
  const place = { spawn: { p: [0, 0, 0] }, beacon: { p: [-8, 0, -8], r: 1.6 }, bounds: 20 };
  const where = t => (at(t.x, t.z, 3, 3.75, 3, 3.75) ? 'pit' : on(t.x, 6) ? 'slot' : at(t.x, t.z, 10, 10.5, 0, 0.5) ? 'notch' : on(t.x, -5.5) && on(t.z, 0) ? 'nook' : at(t.x, t.z, 0, 3, 8, 9) ? 'trench' : `(${t.x}, ${t.z})`);
  const raw = mapOf(fn), found = findTraps(raw.walk(), place).traps.map(where);
  assert.deepEqual([...new Set(found)].sort(), ['nook', 'notch', 'pit', 'slot', 'trench'], `the traps found: ${[...new Set(found)].join(', ')}`);
  // the hook: a trap that out() says leads back is none
  assert.equal(reachable(raw.walk(), place.spawn, 20).trapped(() => false, () => true).traps.length, 0, 'a trap that the controller leaves is no trap');
  const m = mapOf(fn), before = m.cells.slice(), w = { ...m.info, T: m.L.T, G: m.L.G, U: m.L.U }, res = closeTraps(w, place);
  assert.equal(findTraps(m.walk(), place).traps.length, 0, 'traps left after closeTraps()');
  const want = { pit: 16, slot: 9, notch: 9, nook: 1 }, got = { pit: 0, slot: 0, notch: 0, nook: 0, trench: 0 };
  for (const c of res.changed) { const k = where(c); assert(k in got, `closeTraps() changed (${c.x}, ${c.z}) too`); got[k]++; }
  assert.deepEqual({ ...got, trench: undefined }, { ...want, trench: undefined }, `the cells filled: ${JSON.stringify(got)}`);
  // the trench: every cell along its middle (the cells by its walls, where the disc does not fit, are not reached, so they stay)
  for (let x = 0; x <= 2.75; x += 0.25) assert.deepEqual(m.at(x, 8.5), [0, 0, 0], `the trench at x ${x} was filled to ${m.at(x, 8.5)}`);
  assert.equal(res.rounds, 1, `closeTraps() took ${res.rounds} rounds: a trap reached from another comes up to that one's new floor in the same round`);
  for (let k = 0; k < m.N; k++) if (m.cells[k] !== before[k] || m.cells[m.N + k] !== before[m.N + k] || m.cells[2 * m.N + k] !== before[2 * m.N + k]) {
    const x = m.info.x0 + (k % m.info.nx) * 0.25, z = m.info.z0 + Math.floor(k / m.info.nx) * 0.25, kind = where({ x, z });
    const t = m.cells[k], g = m.cells[m.N + k], u = m.cells[2 * m.N + k];
    const fill = { pit: [0, 0, 0], notch: [100, 100, 0], nook: [300, 0, 220], trench: [0, 0, 0] }[kind];
    if (fill) assert.deepEqual([t, g, u], fill, `the ${kind} at (${x}, ${z}) was filled to ${[t, g, u]}`);
    else assert(kind === 'slot' && t === g && u === 0 && (t === 0 || t === 50), `the slot at (${x}, ${z}) was filled to ${[t, g, u]}`);
  }
  const W2 = m.walk(), Wraw = raw.walk();
  const spots = [['pit', [3.375, 0, 3.375], 0.4, -0.05], ['slot', [6, 0, 0], 0.15, -0.05], ['notch', [10.25, 1, 0.25], 0.4, 0.95], ['nook', [-5.5, 0, 0], 0.15, -0.05], ['trench', [0.75, 0, 8.5], 0.6, -0.05]];
  const lows = {};
  for (const [kind, p, r, least] of spots) {
    const low = lowestNear(W2, p, r);
    assert(low > least, `after closeTraps() the feet stood in the ${kind} at ${low.toFixed(2)}`);
    lows[kind] = +low.toFixed(2);
    assert(lowestNear(Wraw, p, r) < least - 0.4, `without the rule the walks should stand in the ${kind}`);
  }
  /* the foot of a wall, dropped onto from above: a platform at 2 (|x|, z <= 2) with a wall 2.5 high east of it (x 2.25 to 4, z 0.25 to
     1), the ground at 0 round them and the beacon on it. A drop off the platform's edge at (2.25, 0), or off the wall's top, lands
     with the disc over the wall's foot. The search walks away from the wall there, as the controller does, so with no help from the
     controller nothing in reach is a trap, and the controller walks away from that spot too */
  const foot = mapOf((x, z) => (x >= 2.24 && x <= 4.01 && z >= 0.24 && z <= 1.01 ? 2.5 : Math.abs(x) <= 2.01 && Math.abs(z) <= 2.01 ? 2 : 0));
  const fr = reachable(foot.walk(), { p: [0, 2, 0] }, 20), fb = { p: [8, 0, -6], r: 1.6 };
  assert(fr.near([2.25, 0, 0], 0.05, -0.05, 0.05), 'the search drops to the wall\'s foot');
  assert.equal(fr.trapped(byBeacon(fb)).traps.length, 0, 'the search should walk away from the wall\'s foot');
  for (const dt of DTS) {
    const b = makeBody(foot.walk(), { p: [2.25, 0, 0], yaw: 0 }, 20);
    hold(b, 1, toward(0, -1), dt);
    assert(b.s.z < -1 && near(b.s.y, 0, 1e-6), `${hz(dt)} Hz: from the wall's foot the controller walked to ${b.s.x.toFixed(2)}, ${b.s.z.toFixed(2)}`);
  }
  pass('no trap in reach: a pit, a slot, a notch, a nook under a roof and a dead-end trench are found and filled, walks never stand in them, and the foot of a wall is no trap', { filled: res.changed.length, rounds: res.rounds, lows });
}
{ /* roofs of different solids. A lean-to against a hall, both over a floor at 0. The lean-to's roof (top 2.3, underside 1.9) and the hall's (top 6, underside 5)
     are two roofs, so the lean-to's corners have no say on the hall's. From the lean-to's top, running jumps and walk-offs into the hall
     fly as in the open and land on the hall's floor: the hall's roof is not a wall in the air. A higher lean-to, 1.5 under the hall's
     top (top 4.5, underside 4.2): from it the hall's roof edge is a wall 1.5 high, too high for a jump, and no jump or walk-off gets onto
     it. Its feet do not rise up through the hall's underside from the space under its edge, and never stand on that edge between the two */
  let tries = 0;
  for (const [lt, lu, low] of [[2.3, 1.9, true], [4.5, 4.2, false]]) {
    const W2 = layered((x, z) => (Math.abs(z) > 6 || x < -4 || x > 6 ? 0 : x < 0 ? [lt, 0, lu] : [6, 0, 5]));
    for (const dt of DTS) for (const x of [-2.4, -1.8, -1.2, -0.7, -0.3]) for (const z of [0.07, 0.19]) for (const deg of [0, 20, 40]) for (const tj of [0, 0.1, 0.2, 9]) {
      const b = makeBody(W2, { p: [x, lt + 0.2, z], yaw: 0 }, 20), a = deg * Math.PI / 180, from = `${hz(dt)} Hz, from the lean-to ${lt} at ${x.toFixed(2)}, ${z}, ${deg}°, jump at ${tj} s`;
      assert(near(b.s.y, lt, 0.02), `${from}: put down at ${b.s.y}`);
      let fast = false, stop = null;
      hold(b, 1.5, t => {
        const sp = Math.hypot(b.s.vx, b.s.vz);
        if (!b.s.ground && sp > 4) fast = true;
        if (!b.s.ground && fast && sp < 1.5 && !stop) stop = `${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)}`;
        return { mx: Math.cos(a), mz: -Math.sin(a), jump: t > tj && t < tj + 0.4 };
      }, dt);
      if (low) assert(!stop && !(b.s.x > 0.4 && b.s.y > 0.1), `${from}: stopped in the air at ${stop}, ended at ${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)}`);
      else assert(!(b.s.ground && b.s.y > 5.9), `${from}: got onto the hall's roof, 1.5 over the lean-to (${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)})`);
      tries++;
    }
  }
  /* a ledge beside a thin canopy (floor 0 under it): a walk off the ledge drops under the canopy, and a jump in the coyote time does not
     take the feet up through the canopy's underside, at any speed or frame step. The ledge at 1.0 under a canopy 1.8 to 1.9; a ledge at
     0.95 or 0.9 under one 0.02 or 0.05 thick at 1.8, and at 1.95 under one 0.04 thick at 2.8, whose top the feet would reach in one step
     at 30 or 60 Hz. After a bump the feet no longer rise */
  for (const [L, C, th] of [[1.0, 1.8, 0.1], [0.95, 1.8, 0.02], [0.9, 1.8, 0.05], [1.95, 2.8, 0.04]]) {
    const canopy = layered((x, z) => (Math.abs(z) > 6 || x > 6 ? 0 : x < -0.01 ? L : [C + th, 0, C]));
    for (const dt of th < 0.1 ? DTS.slice(0, 2) : DTS) for (const x0 of [-2, -1.3, -0.7]) for (const z of [0.07, 0.19]) for (const mag of [0.4, 0.7, 1]) for (const lag of [0, 0.03, 0.06, 0.1]) {
      const b = makeBody(canopy, { p: [x0, L + 0.2, z], yaw: 0 }, 20);
      let fell = -1, y0 = b.s.y, x1 = b.s.x;
      hold(b, 1.5, t => {
        assert(!(y0 < C - 1e-6 && b.s.y >= C - 1e-6 && x1 > 0.02 && b.s.x > 0.02), `${hz(dt)} Hz, off the ledge ${L} from ${x0} under the canopy ${C} (${th} thick), stick ${mag}, jump ${lag} s after the edge: the feet rose up through the canopy at ${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)}`);
        assert(!b.s.events.includes('bump') || b.s.vy <= 0, `${hz(dt)} Hz, under the canopy ${C}: after a bump the feet still rise at ${b.s.vy.toFixed(2)}`);
        if (fell < 0 && b.s.events.includes('fall')) fell = t;
        y0 = b.s.y; x1 = b.s.x;
        return { mx: mag, jump: fell >= 0 && t - fell >= lag && t - fell < lag + 0.4 };
      }, dt);
      tries++;
    }
  }
  /* the face of a rampart, as the ramparts bake it: ground at 0.85 before it; on the face, a parapet's lip (top 4.45, underside 3.9) and,
     beside it, a merlon's overhang (top 5.59, underside 4.79), with solid wall behind. The two are one wall: their undersides are 0.89
     apart, and both are over the feet, so their tops (1.14 apart) do not part them. A fall from 6.2 past the face, at any spot and frame
     step, lands on the wall's top or on the ground, never on a shelf between the lip's top and the floor under the merlon */
  const wallFace = layered((x, z) => (x < -0.01 ? 0.85 : x < 0.01 ? (z <= -0.3 ? [4.45, 1.45, 3.9] : [5.59, 1.29, 4.79]) : z <= -0.3 ? 4.85 : 5.59));
  for (const dt of DTS) for (let x = -0.24; x <= -0.01; x += 0.046) for (let z = -0.7; z <= 0; z += 0.047) {
    const b = makeBody(wallFace, { p: [x, 0.85, z], yaw: 0 }, 20);
    b.s.ground = false; b.s.y = 6.2;
    for (let i = 0; i < 1.2 / dt && !b.s.ground; i++) b.step(dt, {}, 0);
    const tp = wallFace.top(b.s.x, b.s.z), fl = wallFace.floor(b.s.x, b.s.z);
    assert(b.s.ground && (near(b.s.y, tp, 0.1) || near(b.s.y, fl, 0.1)), `${hz(dt)} Hz: a fall past the rampart's face at ${x.toFixed(3)}, ${z.toFixed(3)} landed at ${b.s.y.toFixed(2)}, between the top ${tp.toFixed(2)} and the floor ${fl.toFixed(2)}`);
    tries++;
  }
  /* a dome (radius 5, its spring 0.8 over a floor that slopes 0.5, walls 0.5 thick) as the bake reads it: a gap under it where there is
     1.8 or more, else solid. Near its rim the undersides of a cell's corners step more than 1.0 across it (up to 1.22, 1.63, 1.89 and
     2.22), so its corners are one roof only through each other. Feet dropped in those cells from between their lowest and highest
     underside, still or moving out, at 30 and 120 Hz, land on the floor or on the dome's top, never on a shelf in mid-air */
  const R5 = 5, spring = 0.8, kd = 0.5, under5 = (x, z) => kd * x + spring + Math.sqrt(Math.max(0, R5 * R5 - x * x - z * z));
  const dome = layered((x, z) => {
    const r = Math.hypot(x, z), f = kd * x;
    if (r > R5 + 0.5) return f;
    if (r > R5 - 1e-6) return f + spring + R5 + 0.5;
    return under5(x, z) - f >= 1.8 ? [f + spring + R5 + 0.5, f, under5(x, z)] : f + spring + R5 + 0.5;
  });
  let split = 0;
  for (let j = 0; j < dome.nz - 1; j++) for (let i = 0; i < dome.nx - 1; i++) {
    const ks = [j * dome.nx + i, j * dome.nx + i + 1, (j + 1) * dome.nx + i, (j + 1) * dome.nx + i + 1];
    if (!ks.every(q => dome.G[q] < dome.T[q])) continue;
    const us = ks.map(q => dome.U[q] * 0.01), lo = Math.min(...us), hi = Math.max(...us);
    if (hi - lo <= 1.0) continue;
    split++;
    for (const dt of [DTS[0], DTS[2]]) for (const fu of [0.25, 0.5, 0.75]) for (const fv of [0.25, 0.5, 0.75]) for (const fh of [0.1, 0.4, 0.7, 0.95]) for (const vel of [0, 1.5]) {
      const x = dome.x0 + (i + fu) * dome.step, z = dome.z0 + (j + fv) * dome.step, y = lo + (hi - lo) * fh;
      if (y >= under5(x, z) - 0.02) continue;
      const b = makeBody(dome, { p: [x, kd * x, z], yaw: 0 }, 20);
      b.s.ground = false; b.s.y = y; b.s.vx = vel * Math.sign(x);
      for (let q = 0; q < 1.5 / dt && !b.s.ground; q++) b.step(dt, {}, 0);
      const fl = dome.floor(b.s.x, b.s.z), tp = dome.top(b.s.x, b.s.z);
      assert(!b.s.ground || near(b.s.y, fl, 0.05) || near(b.s.y, tp, 0.05) || R5 - Math.hypot(b.s.x, b.s.z) < 0.3, `${hz(dt)} Hz: feet dropped under the dome at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} (undersides ${us.map(u => u.toFixed(2)).join('/')}) landed at ${b.s.y.toFixed(2)}, between the floor ${fl.toFixed(2)} and the top ${tp.toFixed(2)}`);
      tries++;
    }
  }
  assert(split >= 8, `the dome has ${split} cells whose undersides step more than 1.0`);
  pass('roofs of other solids have no say (a lean-to and a hall), one wall\'s corners agree (a rampart\'s face), a dome\'s corners are one roof, the hall\'s edge is not climbed, and a jump does not rise up through a roof', { tries });
}
{ /* a running jump up a slope, the stick at full, at every frame step. In the air the disc may overlap the slope under it, so the slope
     stops it neither at the take-off nor just before the landing. Up a slope of 0.3 or 0.6 it keeps at least 85% of the run speed
     through the landing, and goes as far from the take-off at each frame step. A steeper slope would rise under the feet nearly as fast
     as the jump: while the jump rises, the move up the slope is held back to the rise that still lets the feet get slopeLift (0.4) over
     the slope, and no further. So on every slope the feet rise 0.4 or more over it, the same at each frame step; the run picks up again
     after that, and it lands and runs on up the slope. A jump that starts well over a slope, off a terrace 0.8 above it, is not held back */
  const LIFT = 0.4, rise = PARAMS.jumpV - Math.sqrt(2 * PARAMS.gravity * LIFT), lifts = {};
  for (const k of [0.3, 0.6, 0.8, 1.0, 1.5, 2.0]) {
    const W2 = layered(x => k * x), dist = [], lift = [];
    for (const dt of DTS) {
      const b = makeBody(W2, { p: [-2.5, -2.5 * k, 0.13], yaw: 0 }, 20);
      let off = null, land = null, slow = Infinity, after = 0, high = 0, atLand = 0;
      for (let i = 0; i < 1.4 / dt; i++) {
        const x0 = b.s.x;
        b.step(dt, { mx: 1, jump: i * dt > 0.2 && i * dt < 0.5 }, 0);
        if (b.s.events.includes('jump')) off = x0;
        if (off !== null && land === null) high = Math.max(high, b.s.y - k * b.s.x);
        if (off !== null && after < 0.3) slow = Math.min(slow, Math.hypot(b.s.vx, b.s.vz));
        if (b.s.events.includes('land') && land === null) {
          land = b.s.x; atLand = Math.hypot(b.s.vx, b.s.vz);
          assert(b.s.landK >= 0 && b.s.landK <= 1, `slope ${k}, ${hz(dt)} Hz: the landing squash is ${b.s.landK}`);
        }
        if (land !== null) after += dt;
      }
      // up to 0.6 the run keeps 85% of its speed; up a steeper slope it is held to the rise while the feet get 0.4 over it, then picks up
      const keep = k <= 0.6 ? 0.85 * PARAMS.run : 0.98 * rise / k, back = k <= 0.6 ? keep : Math.min(PARAMS.run, rise / k + 1.2);
      assert(off !== null && land !== null && slow >= keep, `slope ${k}, ${hz(dt)} Hz: a running jump up the slope from ${off?.toFixed(2)} to ${land?.toFixed(2)}: its speed fell to ${slow.toFixed(2)}, under ${keep.toFixed(2)}`);
      assert(atLand >= back - 1e-6, `slope ${k}, ${hz(dt)} Hz: a running jump up the slope landed at ${atLand.toFixed(2)}: the run did not pick up again in the air (${back.toFixed(2)})`);
      assert(high >= LIFT - 0.02, `slope ${k}, ${hz(dt)} Hz: a running jump up the slope lifted the feet only ${high.toFixed(2)} over it`);
      assert(b.s.ground && near(b.s.y, k * b.s.x, 0.01), `slope ${k}, ${hz(dt)} Hz: after the jump it runs on the slope (${b.s.x.toFixed(2)}, ${b.s.y.toFixed(2)})`);
      dist.push(+(land - off).toFixed(3));
      lift.push(+high.toFixed(3));
    }
    assert(Math.max(...dist) - Math.min(...dist) < 0.22, `slope ${k}: the jump goes ${dist.join(', ')} from the take-off at 30, 60, 120 and 144 Hz`);
    assert(Math.max(...lift) - Math.min(...lift) < 0.03, `slope ${k}: the jump lifts the feet ${lift.join(', ')} over the slope at 30, 60, 120 and 144 Hz`);
    lifts[k] = lift[1];
    /* off a terrace 0.8 above the slope, jumping at its edge: the feet start well over the slope, so the run is not held back (a slope
       of 2.0 rises 12.8 a second at a run and catches them up: then it is held back, the same at each frame step) */
    if (k >= 0.8) {
      const T2 = layered(x => (x <= 0 ? 0 : k * x - 0.8)), least = [];
      for (const dt of DTS) {
        const b = makeBody(T2, { p: [-3, 0, 0.13], yaw: 0 }, 20);
        let jumped = false, v = Infinity;
        for (let i = 0; i < 1.6 / dt && !(jumped && b.s.ground); i++) {
          b.step(dt, { mx: 1, jump: b.s.x > -0.35 }, 0);
          if (b.s.events.includes('jump')) jumped = true;
          if (jumped && !b.s.ground && b.s.x > 0.05) v = Math.min(v, Math.hypot(b.s.vx, b.s.vz));
        }
        least.push(+v.toFixed(2));
      }
      assert(k > 1.5 ? Math.max(...least) - Math.min(...least) < 0.1 : least.every(v => v >= 0.95 * PARAMS.run), `slope ${k}: a running jump off a terrace 0.8 over the slope was held back to ${least.join(', ')} at 30, 60, 120 and 144 Hz`);
    }
  }
  // the same up a slope of 1.0 that rises along z, and along a line 45° off the grid: the hold works on any heading
  for (const deg of [90, 45]) {
    const a = deg * Math.PI / 180, cx = Math.cos(a), cz = Math.sin(a), k = 1.0, up = (x, z) => k * (x * cx + z * cz), W2 = layered(up), lift = [];
    for (const dt of DTS) {
      const b = makeBody(W2, { p: [-2.5 * cx - 0.13 * cz, -2.5 * k, -2.5 * cz + 0.13 * cx], yaw: 0 }, 20);
      let off = false, land = false, high = 0;
      for (let i = 0; i < 1.4 / dt; i++) {
        b.step(dt, { ...toward(cx, cz), jump: i * dt > 0.2 && i * dt < 0.5 }, 0);
        if (b.s.events.includes('jump')) off = true;
        if (off && !land) high = Math.max(high, b.s.y - up(b.s.x, b.s.z));
        if (off && b.s.events.includes('land')) land = true;
      }
      assert(off && land && high >= LIFT - 0.02, `slope ${k} rising ${deg}° off the x axis, ${hz(dt)} Hz: a running jump lifted the feet ${high.toFixed(2)} over it`);
      lift.push(+high.toFixed(3));
    }
    assert(Math.max(...lift) - Math.min(...lift) < 0.03, `slope 1.0 rising ${deg}° off the x axis: the jump lifts the feet ${lift.join(', ')} over it at 30, 60, 120 and 144 Hz`);
    lifts[`1 at ${deg}°`] = lift[1];
  }
  /* a curb 0.2 high across a slope (the grid points from x = 0 on stand 0.2 over it): a running jump that takes off with the disc's front
     at the curb's foot. In the air the curb rises off the slope's plane, so it is a wall until the feet are over it: the run into it stops
     there, straight at it or 30° off, and does not pass through it. So does a curb 0.12 high, which rises 0.07 over the slope's plane */
  let tries = 0;
  for (const ch of [0.2, 0.12]) for (const k of [0.6, 1.0]) for (const deg of [0, 30]) {
    const W2 = layered(x => (x < -0.01 ? k * x : k * x + ch));
    for (const dt of DTS) for (const z of [0.13, 0.4]) for (const x0 of [-3, -2.93, -2.87]) {
      const a = deg * Math.PI / 180, b = makeBody(W2, { p: [x0, x0 * k, z], yaw: 0 }, 20);
      let jumped = false, into = Infinity;
      for (let i = 0; i < 1.2 / dt && !(jumped && b.s.ground); i++) {
        b.step(dt, { ...toward(Math.cos(a), Math.sin(a)), jump: b.s.x + PARAMS.radius >= -0.25 }, 0);
        if (b.s.events.includes('jump')) jumped = true;
        if (jumped && !b.s.ground) into = Math.min(into, b.s.vx);
      }
      assert(jumped && into < 1.7, `slope ${k}, ${hz(dt)} Hz, ${deg}°: a running jump at a curb ${ch} high kept ${into.toFixed(2)} of its speed into it`);
      tries++;
    }
  }
  /* blocks on a slope: one 1.6 or 2.0 over the slope at its foot is never stood on, from a run-up or a start near it, straight or 30°
     off. One 1.0 over it is jumped onto from a stop with the disc against its face, on slopes up to 1.0. (At a run up a slope the jump
     lifts the feet less over the slope, so the block's face then stops it) */
  for (const k of [0.3, 0.6, 1.0]) for (const h of [1.0, 1.6, 2.0]) {
    const W2 = layered((x, z) => (x >= 2 && x <= 4 && Math.abs(z) <= 3 ? k * 2 + h : k * x));
    const onIt = b => b.s.ground && b.s.x > 1.9 && b.s.x < 4.1 && Math.abs(b.s.z) < 3.1;
    if (h > 1.4) {
      for (const dt of DTS) for (const x0 of [-1.5, 0, 1.2]) for (const deg of [0, 30]) for (const tj of [0.1, 0.3]) {
        const a = deg * Math.PI / 180, b = makeBody(W2, { p: [x0, k * x0, 0.13], yaw: 0 }, 20);
        let high = -Infinity;
        hold(b, 2, t => {
          if (onIt(b)) high = Math.max(high, b.s.y - k * 2);
          return { ...toward(Math.cos(a), Math.sin(a)), jump: t >= tj && t < tj + 0.5 };
        }, dt);
        assert(high < 0.5, `slope ${k}, ${hz(dt)} Hz: a jump from ${x0} at ${deg}° stood on the block ${h} over the slope (${high.toFixed(2)})`);
        tries++;
      }
    } else {
      for (const dt of DTS) for (const z of [0.13, 0.61]) for (const tj of [0, 0.05]) {
        const x0 = 2 - PARAMS.radius - 0.01, b = makeBody(W2, { p: [x0, k * x0 + 0.1, z], yaw: 0 }, 20);
        let stood = false;
        hold(b, 1.2, t => {
          if (onIt(b) && near(b.s.y - k * 2, h, 0.02)) stood = true;
          return { mx: 1, jump: t >= tj && t < tj + 0.5 };
        }, dt);
        assert(stood, `slope ${k}, ${hz(dt)} Hz, z ${z}: from a stop against the block 1.0 over the slope, a jump did not get onto it`);
        tries++;
      }
    }
  }
  // only a slope leans: a hillside of 4 per unit (a face, steeper than a climb per radius) is not climbed by jumping at it again and again
  const face = layered(x => Math.max(0, Math.min(6, 4 * x)));
  for (const dt of DTS) for (const deg of [0, 25, 50]) for (const per of [0.35, 0.6, 0.9]) {
    const a = deg * Math.PI / 180, b = makeBody(face, { p: [-1.5, 0, 0.13], yaw: 0 }, 20);
    const high = hold(b, 5, t => ({ ...toward(Math.cos(a), Math.sin(a)), jump: t % per < per / 2 }), dt);
    assert(high < 2, `${hz(dt)} Hz, ${deg}°, a jump every ${per} s: it climbed the face of 4 per unit to ${high.toFixed(2)}`);
    tries++;
  }
  pass('a running jump up a slope keeps its speed, or lifts the feet 0.4 over a steep one, at every frame step; curbs and blocks stop it', { lifts, tries });
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
{ /* the page's loader (world.js): a place's JSON names its walk map's layers, and the walk file must hold that many. A file of two
     layers under a JSON that names three is refused, so the page shows Try again; three under three, and two under an older JSON that
     names none, load. The fetches are stubbed with a one-splat place */
  const { loadPlace } = await import('../../public/lab/gloam-downs/world.js');
  const row = new Float32Array(16);
  row.set([0, 1, 0]);
  const splats = SplatCodec.encode(row, 1), saved = { fetch: globalThis.fetch, codec: globalThis.SplatCodec };
  const place = (layers, n) => {
    const meta = { format: 'gloam-downs/1', count: 1, walk: { x0: 0, z0: 0, step: 1, nx: 2, nz: 2, ...(layers ? { layers } : {}) }, moving: [], back: [] };
    const files = { 'p.json': new TextEncoder().encode(JSON.stringify(meta)), 'p.bin.gz': splats, 'p.walk.bin.gz': new Uint8Array(new Int16Array(4 * n).buffer) };
    globalThis.fetch = async url => (files[url] ? new Response(files[url]) : new Response('', { status: 404 }));
    return loadPlace('', 'p');
  };
  globalThis.SplatCodec = SplatCodec;
  try {
    await assert.rejects(place(['T', 'G', 'U'], 2), /does not hold the 3 layers/, 'a two-layer walk file under a JSON that names three');
    assert.equal((await place(['T', 'G', 'U'], 3)).walk.length, 12, 'three layers named, three given');
    assert.equal((await place(null, 2)).walk.length, 8, 'no layers named, two given');
    await assert.rejects(place(null, 3), /does not hold the 2 layers/, 'no layers named, three given');
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.codec === undefined) delete globalThis.SplatCodec; else globalThis.SplatCodec = saved.codec;
  }
  pass('the loader refuses a walk file that does not hold the layers its JSON names');
}
if (missing.length) { console.log(`FAIL not baked: ${missing.join(', ')} (node games/gloam-downs/bake.mjs)`); process.exitCode = 1; }
console.log(`${n} checks passed`);
