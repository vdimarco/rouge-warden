// A design tool from the combat run's design rounds, not a check; the later stages port it into gloam-downs-run.test.mjs.
// The tools rect is the run's, measured with "Pause" (spec "The HUD in the boss fight").
// The smallest boss camera distance (>= floor, pitch 0.34) and an aim on the line that keep, for the yaw difference 0 and +-15 deg:
// the ground within 1.3 m of the lamplighter's feet inside the screen and under no touch button, the HUD or the tools;
// the boss's head, chest and feet inside the screen, under none of them and not in the Lab bar row (52 px).
// Run: node games/gloam-downs/tools/boss-frame.mjs [stop°]
const fovY = 38 * Math.PI / 180, p = 0.34, stop = +process.argv[2] || 15;
const camDist = (w, h) => (w < h ? 8.5 * Math.min(1.5, 1 + 0.6 * (h / w - 1)) : 8.5);
const hud = w => [10, 60, Math.min(180, w - 140), 88], tools = w => (w <= 520 ? [w - 122, 60, 112, 44] : [w - 144, 60, 134, 44]);
const L = {
  '320x640': [320, 640, [[228, 480, 76, 76], [160, 562, 60, 60], [240, 564, 64, 64], [168, 498, 48, 48]]],
  '360x640': [360, 640, [[268, 480, 76, 76], [200, 562, 60, 60], [280, 564, 64, 64], [208, 498, 48, 48]]],
  '390x844': [390, 844, [[290, 664, 84, 84], [214, 750, 64, 64], [302, 756, 72, 72], [226, 682, 52, 52]]],
  '800x600': [800, 600, [[708, 440, 76, 76], [640, 522, 60, 60], [720, 524, 64, 64], [648, 458, 48, 48]]],
  '1280x720': [1280, 720, []],
};
function proj(eye, A, P, w, h) {
  let f = [A[0] - eye[0], A[1] - eye[1], A[2] - eye[2]]; const fl = Math.hypot(...f); f = f.map(v => v / fl);
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const d = [P[0] - eye[0], P[1] - eye[1], P[2] - eye[2]];
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2], x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2], y = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
  const t = Math.tan(fovY / 2), asp = w / h; return [w / 2 + (x / z / (t * asp)) * w / 2, h / 2 - (y / z / t) * h / 2];
}
const inR = (x, y, [rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
for (const [name, [w, h, rects]] of Object.entries(L)) {
  const floor = Math.max(12, 1.25 * camDist(w, h)); let worst = 0; const row = [];
  for (let d = 2; d <= 13; d += 0.5) { let need = 0;
    for (const phiDeg of [0, stop, -stop]) { let best = null;
      for (let D = floor; D <= 30 && !best; D += 0.25) for (let k = 0; k <= 0.8 && !best; k += 0.025) {
        const phi = phiDeg * Math.PI / 180, A = [0, 1.15, k * d], fwd = [Math.sin(phi), 0, Math.cos(phi)];
        const eye = [A[0] - fwd[0] * D * Math.cos(p), A[1] + D * Math.sin(p), A[2] - fwd[2] * D * Math.cos(p)];
        let ok = true;
        for (let q = 0; q <= 16 && ok; q++) { const P = q < 16 ? [1.3 * Math.cos(q * Math.PI / 8), 0, 1.3 * Math.sin(q * Math.PI / 8)] : [0, 0.9, 0]; const [x, y] = proj(eye, A, P, w, h);
          if (x < 0 || x > w || y < 52 || y > h) ok = false; for (const R of [...rects, hud(w), tools(w)]) if (inR(x, y, R)) ok = false; }
        for (const P of [[0, 3.4, d], [0, 1.7, d], [0, 0, d]]) { const [x, y] = proj(eye, A, P, w, h); if (x < 0.1 * w || x > 0.9 * w || y < 52 || y > h) ok = false; for (const R of [...rects, hud(w), tools(w)]) if (inR(x, y, R)) ok = false; }
        if (ok) best = D;
      }
      need = Math.max(need, best ?? 99); }
    worst = Math.max(worst, need); if (d % 2 === 0 || d === 13) row.push(`d${d}:${need === 99 ? 'none' : need.toFixed(1)}`); }
  console.log(`${name} floor ${floor.toFixed(2)} largest ${worst === 99 ? 'none' : worst.toFixed(2)}  ${row.join(' ')}`);
}
