// A design tool from the combat run's design rounds, not a check; the later stages port it into gloam-downs-run.test.mjs.
// The tools rect is the run's, measured with "Pause" (spec "The HUD in the boss fight").
// The framing boss camera in the real arena: for each position, the smallest distance (>= floor) and aim that frame the ring at the
// feet and the boss's head in the band; then the explorer's pull-in in front of the ground; when pulled in, the pitch rises to 0.55.
// Run: node games/gloam-downs/tools/boss-arena.mjs
import fs from 'node:fs'; import zlib from 'node:zlib';
import { makeWalk } from '../../../public/lab/gloam-downs/play.js';
const W = new URL('../../../public/lab/gloam-downs/worlds/', import.meta.url).pathname;
const meta = JSON.parse(fs.readFileSync(W + 'barrows.json')); const raw = zlib.gunzipSync(fs.readFileSync(W + 'barrows.walk.bin.gz'));
const walk = makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
const C = [18, -22], fovY = 38 * Math.PI / 180;
const hud = w => [10, 60, Math.min(180, w - 140), 88], tools = w => (w <= 520 ? [w - 122, 60, 112, 44] : [w - 144, 60, 134, 44]);
const inR = (x, y, [rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
const bands = { '320x640': [320, 640, [[228, 480, 76, 76], [160, 562, 60, 60], [240, 564, 64, 64], [168, 498, 48, 48]], 15.94], '360x640': [360, 640, [[268, 480, 76, 76], [200, 562, 60, 60], [280, 564, 64, 64], [208, 498, 48, 48]], 15.58], '390x844': [390, 844, [[290, 664, 84, 84], [214, 750, 64, 64], [302, 756, 72, 72], [226, 682, 52, 52]], 15.94], '800x600': [800, 600, [[708, 440, 76, 76], [640, 522, 60, 60], [720, 524, 64, 64], [648, 458, 48, 48]], 12], '1280x720': [1280, 720, [], 12] };
function proj(eye, A, P, w, h) {
  let f = [A[0] - eye[0], A[1] - eye[1], A[2] - eye[2]]; const fl = Math.hypot(...f); f = f.map(v => v / fl);
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const d = [P[0] - eye[0], P[1] - eye[1], P[2] - eye[2]];
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2], x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2], y = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
  const t = Math.tan(fovY / 2), asp = w / h; return [w / 2 + (x / z / (t * asp)) * w / 2, h / 2 - (y / z / t) * h / 2, z];
}
const eyeOf = (A, yaw, p, D) => [A[0] + Math.sin(yaw) * Math.cos(p) * D, A[1] + Math.sin(p) * D, A[2] + Math.cos(yaw) * Math.cos(p) * D];
const free = (A, yaw, p, want) => { for (let t = 0.6; t <= want; t += 0.25) { const e = eyeOf(A, yaw, p, t); if (e[1] < walk.top(e[0], e[2]) + 0.35) return Math.max(1.6, t - 0.4); } return want; };
for (const [name, [w, h, rects, floor]] of Object.entries(bands)) {
  let n = 0, bad = 0, pulled = 0, bandMiss = 0, maxD = 0;
  for (let a = 0; a < 360; a += 15) for (const rl of [0, 2.5, 5]) for (const bb of [0, 90, 180, 270]) for (const db of [3, 6, 9]) {
    const lx = C[0] + rl * Math.cos(a * Math.PI / 180), lz = C[1] + rl * Math.sin(a * Math.PI / 180);
    const bx = lx + db * Math.cos((a + bb) * Math.PI / 180), bz = lz + db * Math.sin((a + bb) * Math.PI / 180);
    if (Math.hypot(bx - C[0], bz - C[1]) > 6.5) continue;
    n++;
    const ly = walk.support(lx, lz, 3) ?? walk.top(lx, lz), by = walk.support(bx, bz, 3) ?? walk.top(bx, bz);
    const yaw = Math.atan2(-(bx - lx), -(bz - lz));
    const L = [lx, ly, lz], B = [bx, by, bz];
    let best = null;
    for (let D = floor; D <= 24 && !best; D += 0.25) for (let k = 0; k <= 0.7 && !best; k += 0.05) {
      const A = [lx + k * (bx - lx), ly + 1.15 + k * (by - ly), lz + k * (bz - lz)], eye = eyeOf(A, yaw, 0.34, D);
      let ok = true;
      for (let q = 0; q < 16 && ok; q++) { const P = [lx + 1.3 * Math.cos(q * Math.PI / 8), 0, lz + 1.3 * Math.sin(q * Math.PI / 8)]; P[1] = walk.support(P[0], P[2], ly + 1) ?? ly; const [x, y] = proj(eye, A, P, w, h); if (x < 0 || x > w || y < 52 || y > h) ok = false; for (const R of [...rects, hud(w), tools(w)]) if (inR(x, y, R)) ok = false; }
      for (const P of [[bx, by + 3.4, bz], [bx, by + 1.7, bz], [bx, by, bz]]) { const [x, y] = proj(eye, A, P, w, h); if (x < 0.1 * w || x > 0.9 * w || y < 52 || y > h) ok = false; for (const R of [...rects, hud(w), tools(w)]) if (inR(x, y, R)) ok = false; }
      if (ok) best = { D, k, A };
    }
    if (!best) { bandMiss++; best = { D: 24, k: 0.3, A: [lx + 0.3 * (bx - lx), ly + 1.15 + 0.3 * (by - ly), lz + 0.3 * (bz - lz)] }; }
    maxD = Math.max(maxD, best.D);
    let p = 0.34, D = free(best.A, yaw, p, best.D);
    if (D < best.D - 0.1) { pulled++; p = 0.55; D = free(best.A, yaw, p, best.D); }
    const eye = eyeOf(best.A, yaw, p, D);
    const [xl, yl] = proj(eye, best.A, [lx, ly + 0.9, lz], w, h), [xb, yb] = proj(eye, best.A, [bx, by + 1.7, bz], w, h);
    const inX = x => Math.abs(x - w / 2) <= 0.4 * w, inY = y => y >= 0 && y <= h;
    if (!(inX(xl) && inX(xb) && inY(yl) && inY(yb))) bad++;
  }
  console.log(`${name}: ${n} positions; framed in the band at once in ${n - bandMiss}; largest distance ${maxD}; pulled in at ${pulled}; chests outside 80% or off the screen at ${bad} (${(100 * (n - bad) / n).toFixed(1)}% pass)`);
}
