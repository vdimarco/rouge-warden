// A design tool from the combat run's design rounds, not a check; the later stages port it into gloam-downs-run.test.mjs.
// Per-frame CPU cost of Ink Studio's depth sort (view.mjs) on a real Gloam Downs place, with more and more splats on bones.
// Run: node games/gloam-downs/tools/sort-mix.mjs [place]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
const REPO = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '');
const require = createRequire(import.meta.url);
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

function bench(world, label, frames = 40) {
  const sort = createDepthSorter();
  const times = [], poseT = [];
  for (let f = 0; f < frames + 6; f++) {
    const t0 = performance.now();
    // pose every rig, as the page would (one call per figure)
    for (let r = 0; r < (world.rigs || 0); r++) pose(world.anim.bones.subarray(r * 12 * NB, (r + 1) * 12 * NB), meta.bones, { ...s, x: s.x + r, phase: f * 0.2 }, f / 60);
    const t1 = performance.now();
    const cam = makeCamera(world, { camera: { ...meta.cam, yaw: meta.cam.yaw + f * 0.01 } }, 320, 180);
    sort(world, cam.view, f / 60);
    const t2 = performance.now();
    if (f >= 6) { times.push(t2 - t1); poseT.push(t1 - t0); }
  }
  times.sort((a, b) => a - b); poseT.sort((a, b) => a - b);
  const med = a => a[a.length >> 1];
  console.log(`${label.padEnd(34)} splats ${String(world.count).padStart(7)}  boned ${String(world.anim?.boned?.length ?? 0).padStart(6)}  sort median ${med(times).toFixed(2)} ms  (p90 ${times[Math.floor(times.length * 0.9)].toFixed(2)})  pose ${med(poseT).toFixed(3)} ms`);
  return med(times);
}

const extra = Number(process.argv[3] || 0), plainN = Number(process.argv[4] || 0);
const mix = () => { const w = makeWorld(extra + plainN); w.anim.boned = w.anim.boned.slice(0, lampIds.length + extra); return w; };
const worlds = [["today: the lamplighter", makeWorld(0)], [`+${extra} boned +${plainN} plain`, mix()]];
const best = new Map();
for (let round = 0; round < 3; round++) for (const [label, w] of worlds) { const t = bench(w, `r${round} ` + label, 60); best.set(label, Math.min(best.get(label) ?? 1e9, t)); }
const [a, b] = [...best.values()];
console.log(`RESULT ${id} base ${a.toFixed(2)} ms, with pool ${b.toFixed(2)} ms, ratio ${(b / a).toFixed(3)}`);
