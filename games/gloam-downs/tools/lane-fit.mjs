// A design tool from the combat run's design rounds, not a check; the later stages port it into gloam-downs-run.test.mjs.
// Run: node games/gloam-downs/tools/lane-fit.mjs
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
const sh = a => (100 * a.filter(v => v <= 0.15).length / a.length).toFixed(0) + '%';
const walks = {};
for (const [id, name, c, L, len] of [['bells', 'B1 lane 7', [-0.5, -0.04, 12], 4.5, 7], ['barrows', 'W2 lane 7', [1, 0.18, 3.5], 5.5, 7], ['barrows', 'arena lane 9', [18, 0.68, -22], 6.5, 9]]) {
  const walk = walks[id] ||= load(id); const g = (x, z) => walk.support(x, z, c[1] + 2.5) ?? walk.top(x, z);
  const out = {};
  for (const pieces of [3, 4, 5, 6]) { const res = [];
    for (let a = 0; a < 360; a += 30) for (const r of [0, L * 0.5, L]) { const x = c[0] + r * Math.cos(a * Math.PI / 180), z = c[2] + r * Math.sin(a * Math.PI / 180);
      for (let b = 0; b < 360; b += 45) { const ux = Math.cos(b * Math.PI / 180), uz = Math.sin(b * Math.PI / 180);
        for (let p = 0; p < pieces; p++) { const P = []; for (let k = 0; k <= 6; k++) for (const s of [-0.8, 0.8]) { const t = (p + k / 6) * len / pieces; P.push([x + ux * t - uz * s, z + uz * t + ux * s]); } res.push(...plane(P, P.map(q => g(...q)))); } } }
    out[pieces] = sh(res); }
  console.log(id, name, JSON.stringify(out));
}
