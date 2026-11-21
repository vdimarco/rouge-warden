// A design tool from the combat run's design rounds, not a check; the later stages port it into gloam-downs-run.test.mjs.
// Ring and lane markers fitted to the ground: share of rim points within 0.15 m of the fitted plane, with 1 bone per ring or
// 6 slices of 60° per ring, and lanes in 3 pieces of 3 m. Ground = the floor at or below the zone's centre + 2 m, or the water surface (0) in the Fen.
// Run: node games/gloam-downs/tools/marker-fit.mjs
import fs from 'node:fs'; import zlib from 'node:zlib';
import { makeWalk } from '../../../public/lab/gloam-downs/play.js';
const W = new URL('../../../public/lab/gloam-downs/worlds/', import.meta.url).pathname;
const load = id => { const m = JSON.parse(fs.readFileSync(W + id + '.json')); const r = zlib.gunzipSync(fs.readFileSync(W + id + '.walk.bin.gz')); return makeWalk(m.walk, new Int16Array(r.buffer, r.byteOffset, r.byteLength >> 1)); };
function plane(pts, ys) { let n = pts.length, sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0;
  pts.forEach(([x, z], i) => { const y = ys[i]; sx += x; sz += z; sy += y; sxx += x * x; szz += z * z; sxz += x * z; sxy += x * y; szy += z * y; });
  const M = [[n, sx, sz], [sx, sxx, sxz], [sz, sxz, szz]], v = [sy, sxy, szy];
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M), s = [0, 1, 2].map(k => det(M.map((r, i) => r.map((c, j) => (j === k ? v[i] : c)))) / D);
  return pts.map(([x, z], i) => Math.abs(ys[i] - (s[0] + s[1] * x + s[2] * z))); }
const cases = [['bells', 'B1 ring 3.0', [-0.5, -0.04, 12], 4.5, 3.0, 'ring'], ['bells', 'B1 lane 9x1.6', [-0.5, -0.04, 12], 4.5, 9, 'lane'],
  ['barrows', 'W2 ring 3.0', [1, 0.18, 3.5], 5.5, 3.0, 'ring'], ['barrows', 'W2 lane 9x1.6', [1, 0.18, 3.5], 5.5, 9, 'lane'], ['barrows', 'arena ring 3.4', [18, 0.68, -22], 6.5, 3.4, 'ring'],
  ['barrows', 'arena lane 9x1.6', [18, 0.68, -22], 6.5, 9, 'lane'], ['barrows', 'arena shard 1.3', [18, 0.68, -22], 6.5, 1.3, 'ring'], ['fen', 'F2 ring 2.2', [7, -0.49, -3.8], 3, 2.2, 'ring'], ['fen', 'F1 ring 2.2', [4.5, -0.49, 7.6], 3, 2.2, 'ring'],
  ['ramparts', 'R3 coal 1.4', [-14.3, 0.18, -4.8], 4.4 + 4, 1.4, 'ring'], ['gaol', 'G5 hook arc', [2.3, 4.21, -23.8], 3, 2.2, 'ring']];
const walks = {};
for (const [id, name, c, L, R, kind] of cases) {
  const walk = walks[id] ||= load(id);
  const g = (x, z) => { let f = walk.support(x, z, c[1] + 2.5); if (f === null) f = walk.top(x, z); return id === 'fen' ? Math.max(f, 0) : f; };
  const res = { one: [], four: [] };
  for (let a = 0; a < 360; a += 30) for (const r of [0, L * 0.5, L]) {
    const x = c[0] + r * Math.cos(a * Math.PI / 180), z = c[2] + r * Math.sin(a * Math.PI / 180);
    if (kind === 'ring') { const pts = Array.from({ length: 24 }, (_, k) => [x + R * Math.cos(k * Math.PI / 12), z + R * Math.sin(k * Math.PI / 12)]); const ys = pts.map(p => g(...p));
      res.one.push(...plane(pts, ys)); for (let q = 0; q < 6; q++) { const P = [0,1,2,3,4].map(k => pts[(q * 4 + k) % 24]); res.four.push(...plane(P, P.map(p => g(...p)))); } }
    else for (let b = 0; b < 360; b += 45) { const ux = Math.cos(b * Math.PI / 180), uz = Math.sin(b * Math.PI / 180);
      for (let p = 0; p < 3; p++) { const P = Array.from({ length: 14 }, (_, k) => { const t = (p + (k >> 1) / 6) * R / 3, s = (k & 1 ? 0.8 : -0.8); return [x + ux * t - uz * s, z + uz * t + ux * s]; }); res.one.push(...plane(P, P.map(q => g(...q)))); } }
  }
  const sh = a => a.length ? (100 * a.filter(v => v <= 0.15).length / a.length).toFixed(0) + '%' : '-';
  const p = (a, f) => { const s = a.slice().sort((u, v) => u - v); return s.length ? s[Math.floor(s.length * f)].toFixed(2) : '-'; };
  console.log(`${id} ${name}: one plane ${sh(res.one)} within 0.15 (median ${p(res.one, .5)}, p90 ${p(res.one, .9)})` + (kind === 'ring' ? `; six slices ${sh(res.four)} within 0.15 (p90 ${p(res.four, .9)})` : ''));
}
