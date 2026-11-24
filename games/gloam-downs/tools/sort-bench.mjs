// A design tool from the combat run's design rounds, not a check. The CPU cost of Ink Studio's depth sort (view.mjs) on a baked place,
// with more and more splats on bones (copies of the lamplighter stand in for the foes), against a sort that turns each bone's depth
// row once. The run's sort bench (gloam-downs-run.test.mjs) is to use the real pool (pool.js) in place of the copies.
// Run: node games/gloam-downs/tools/sort-bench.mjs [place]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';
const REPO = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '');
import vm from 'node:vm';
const SplatCodec = vm.runInThisContext(fs.readFileSync(`${REPO}/public/lab/gloam-downs/ink/splat-codec.js`, 'utf8') + '\n;SplatCodec');
const { createDepthSorter, makeCamera } = await import(`${REPO}/public/lab/gloam-downs/ink/webgl/view.mjs`);
const { pose, makeWalk } = await import(`${REPO}/public/lab/gloam-downs/play.js`);

const id = process.argv[2] || 'gaol';
const meta = JSON.parse(fs.readFileSync(`${REPO}/public/lab/gloam-downs/worlds/${id}.json`, 'utf8'));
const raw = zlib.gunzipSync(fs.readFileSync(`${REPO}/public/lab/gloam-downs/worlds/${id}.bin.gz`));
const dec = SplatCodec.decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength), { maxRows: 1_000_000 });
console.log(`${id}: ${dec.count} splats, ${meta.bones.count} on bones (${meta.bones.names.length} bones)`);

const NB = meta.bones.names.length;
const lampIds = [];
for (let i = meta.bones.first; i < meta.bones.end; i++) lampIds.push(i);

// a world with `extra` more boned splats: copies of the lamplighter's, each copy on its own 7 bones
function makeWorld(extra) {
  const copies = Math.ceil(extra / lampIds.length);
  const count = dec.count + extra;
  const data = new Float32Array(count * 16);
  data.set(dec.data.subarray(0, dec.count * 16));
  const boned = lampIds.slice();
  let at = dec.count;
  for (let c = 0; c < copies && at < count; c++) {
    for (const i of lampIds) {
      if (at >= count) break;
      const o = at * 16;
      data.set(dec.data.subarray(i * 16, i * 16 + 16), o);
      data[o + 12] += NB * (c + 1); // primary bone
      if (data[o + 14] > 0) data[o + 13] += NB * (c + 1);
      boned.push(at++);
    }
  }
  const bones = new Float32Array(12 * NB * (copies + 1));
  return { data, count, moving: Int32Array.from(meta.moving), back: Int32Array.from(meta.back), radius: meta.radius, cam: meta.cam,
    anim: { bones, boned: Int32Array.from(boned) }, rigs: copies + 1 };
}
const s = { x: meta.spawn.p[0], y: meta.spawn.p[1], z: meta.spawn.p[2], yaw: meta.spawn.yaw, phase: 1, moveK: 1, runK: 0.5, landK: 0, landAge: 9, ground: true, vy: 0, floor: meta.spawn.p[1] };


function fastSorter() {
  const counts = new Uint32Array(65536); let depth, keys, order, rowsB;
  return function sort(world, view) {
    const { count, data } = world, m2 = view[2], m6 = view[6], m10 = view[10], m14 = view[14];
    if (!order || order.length !== count) { depth = new Float32Array(count); keys = new Uint16Array(count); order = new Int32Array(count); }
    for (let i = 0, o = 0; i < count; i++, o += 16) depth[i] = m2 * data[o] + m6 * data[o + 1] + m10 * data[o + 2] + m14;
    const B = world.anim.bones, nb = B.length / 12;
    if (!rowsB || rowsB.length !== nb * 4) rowsB = new Float32Array(nb * 4);
    for (let b = 0, k = 0; b < nb; b++, k += 12) {   // the depth row of bone b: (m2, m6, m10) times its matrix, and its move
      rowsB[b * 4] = m2 * B[k] + m6 * B[k + 3] + m10 * B[k + 6];
      rowsB[b * 4 + 1] = m2 * B[k + 1] + m6 * B[k + 4] + m10 * B[k + 7];
      rowsB[b * 4 + 2] = m2 * B[k + 2] + m6 * B[k + 5] + m10 * B[k + 8];
      rowsB[b * 4 + 3] = m2 * B[k + 9] + m6 * B[k + 10] + m10 * B[k + 11] + m14;
    }
    const boned = world.anim.boned;
    for (let n = 0; n < boned.length; n++) {
      const i = boned[n], o = i * 16, x = data[o], y = data[o + 1], z = data[o + 2], p = data[o + 12] * 4;
      let d = rowsB[p] * x + rowsB[p + 1] * y + rowsB[p + 2] * z + rowsB[p + 3];
      const w = data[o + 14];
      if (w > 0) { const q = data[o + 13] * 4; d += (rowsB[q] * x + rowsB[q + 1] * y + rowsB[q + 2] * z + rowsB[q + 3] - d) * w; }
      depth[i] = d;
    }
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < count; i++) { const z = depth[i]; if (z < min) min = z; if (z > max) max = z; }
    const scale = 65535 / (max - min || 1);
    counts.fill(0);
    for (let i = 0; i < count; i++) counts[keys[i] = (depth[i] - min) * scale | 0]++;
    for (let b = 0, next = 0; b < 65536; b++) { const s = counts[b]; counts[b] = next; next += s; }
    for (let i = 0; i < count; i++) order[counts[keys[i]]++] = i;
    return order;
  };
}
// (moving splats are left out here: a real host order would add them as view.mjs does)
for (const extra of [0, 20000, 40000]) {
  const w = makeWorld(extra); w.moving = new Int32Array(0);
  const a = createDepthSorter(), b = fastSorter();
  const ta = [], tb = [];
  for (let f = 0; f < 50; f++) {
    for (let r = 0; r < w.rigs; r++) pose(w.anim.bones.subarray(r * 12 * NB, (r + 1) * 12 * NB), meta.bones, { ...s, x: s.x + r, phase: f * 0.2 }, f / 60);
    const cam = makeCamera(w, { camera: { ...meta.cam, yaw: meta.cam.yaw + f * 0.01 } }, 320, 180);
    let t0 = performance.now(); const oa = a(w, cam.view, 0).slice(); let t1 = performance.now(); const ob = b(w, cam.view); let t2 = performance.now();
    if (f >= 10) { ta.push(t1 - t0); tb.push(t2 - t1); }
    if (f === 49) { let same = 0; for (let i = 0; i < oa.length; i++) if (oa[i] === ob[i]) same++; console.log(`  orders agree on ${(100 * same / oa.length).toFixed(2)}% of places`); }
  }
  ta.sort((x, y) => x - y); tb.sort((x, y) => x - y);
  console.log(`+${extra} boned: stock sorter ${ta[ta.length >> 1].toFixed(2)} ms, per-bone rows ${tb[tb.length >> 1].toFixed(2)} ms`);
}
