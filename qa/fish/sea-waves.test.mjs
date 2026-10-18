// The Gull Rock wave tile (public/fish/js/sea-waves.js): node qa/fish/sea-waves.test.mjs
// 1. The bake is the same every time, and quick enough for a worker on a phone (under 250 ms here, after a warm-up).
// 2. The loop is seamless: the step from the last frame to the first is no bigger than any other step.
// 3. The tile wraps: the jump across its edge is like the step between neighbours inside it.
// 4. Crests are sharp: the surface squeezes (Jacobian below 1) where it is high, and few slopes clip their encoding.
// 5. Foam: a small share of the sea breaks at once, it fades (old foam without fresh foam exists) and it drifts downwind.
// Exit code 1 if a target is missed.
import { bakeSeaWaves } from "../../public/fish/js/sea-waves.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };

bakeSeaWaves();
const t0 = performance.now();
const b = bakeSeaWaves({ debug: true });
const ms = performance.now() - t0;
const { n, frames, data } = b, nn = n * n;
check(ms < 250, `bake ${ms.toFixed(0)} ms (< 250)`);
const again = bakeSeaWaves();
check(again.data.every((v, i) => v === data[i]), "the bake is deterministic");

const px = (f, x, y, c) => data[(f * nn + ((y + n) % n) * n + ((x + n) % n)) * 4 + c];
// mean absolute change of the slopes between two frames
const frameStep = (f0, f1) => { let s = 0; for (let p = 0; p < nn; p++) for (let c = 0; c < 2; c++) s += Math.abs(data[(f0 * nn + p) * 4 + c] - data[(f1 * nn + p) * 4 + c]); return s / (nn * 2); };
const steps = []; for (let f = 0; f + 1 < frames; f++) steps.push(frameStep(f, f + 1));
const seam = frameStep(frames - 1, 0), maxStep = Math.max(...steps), meanStep = steps.reduce((a, v) => a + v, 0) / steps.length;
check(seam <= maxStep * 1.05 && seam > 0, `loop seam ${seam.toFixed(2)} (steps ${meanStep.toFixed(2)} mean, ${maxStep.toFixed(2)} max)`);
const foamSeam = (() => { let s = 0; for (let p = 0; p < nn; p++) s += Math.abs(data[((frames - 1) * nn + p) * 4 + 2] - data[p * 4 + 2]); return s / nn; })();
const foamStep = (() => { let s = 0; for (let p = 0; p < nn; p++) s += Math.abs(data[(10 * nn + p) * 4 + 2] - data[(11 * nn + p) * 4 + 2]); return s / nn; })();
check(foamSeam < foamStep * 1.5 + 0.5, `foam loop seam ${foamSeam.toFixed(2)} (a usual step ${foamStep.toFixed(2)})`);

// the edge: column n-1 next to column 0, against neighbouring columns inside
let edge = 0, inner = 0;
for (let f = 0; f < frames; f += 8) for (let y = 0; y < n; y++) for (let c = 0; c < 2; c++) {
  edge += Math.abs(px(f, n - 1, y, c) - px(f, 0, y, c)) + Math.abs(px(f, y, n - 1, c) - px(f, y, 0, c));
  inner += Math.abs(px(f, n / 2 - 1, y, c) - px(f, n / 2, y, c)) + Math.abs(px(f, y, n / 2 - 1, c) - px(f, y, n / 2, c));
}
check(edge < inner * 1.3, `tile wraps: edge ${(edge / inner).toFixed(2)} of an inner step`);

let corr = 0, clip = 0;
for (let f = 0; f < frames; f++) for (let p = 0; p < nn; p++) {
  corr += b.height[f][p] * (b.jacobian[f][p] - 1);
  const r = data[(f * nn + p) * 4], g = data[(f * nn + p) * 4 + 1];
  if (r === 0 || r === 255 || g === 0 || g === 255) clip++;
}
check(corr < 0, "crests squeeze (height and Jacobian - 1 go opposite ways)");
check(clip / (frames * nn) < 0.03, `clipped slopes ${(100 * clip / (frames * nn)).toFixed(1)}% (< 3%)`);

let foamy = 0, fresh = 0, old = 0;
for (let i = 0; i < frames * nn; i++) {
  const fo = data[i * 4 + 2], fr = data[i * 4 + 3];
  if (fo > 77) foamy++;
  if (fr > 128) fresh++;
  if (fo > 50 && fr < fo * 0.3) old++;
}
const share = (v) => v / (frames * nn);
check(share(fresh) > 0.005 && share(fresh) < 0.04, `fresh foam on ${(100 * share(fresh)).toFixed(1)}% of the sea (0.5..4%)`);
check(share(foamy) > share(fresh) && share(foamy) < 0.15, `foam on ${(100 * share(foamy)).toFixed(1)}% (more than fresh, < 15%)`);
check(share(old) > 0.005, `fading foam (old, not fresh) on ${(100 * share(old)).toFixed(1)}%`);

// drift: the crests themselves run downwind, so compare a bake without drift and one with a strong drift. Over one second
// (with slow fading, so old foam leads the match) the best match moves further downwind (+x, +z) with the drift
const bestShift = (bb) => {
  const lag = Math.round(bb.frames / bb.period), d = bb.data;
  const at = (f, x, y) => d[(f * nn + ((y + n) % n) * n + ((x + n) % n)) * 4 + 2];
  let best = -1, out = [0, 0];
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    let s = 0;
    for (let f = 0; f < bb.frames; f += 4) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) s += at(f, x, y) * at((f + lag) % bb.frames, x + dx, y + dy);
    if (s > best) { best = s; out = [dx, dy]; }
  }
  return out;
};
const still = bestShift(bakeSeaWaves({ drift: 0, foamDecay: 0.1 })), moved = bestShift(bakeSeaWaves({ drift: 2, foamDecay: 0.1 }));
const along = (moved[0] - still[0]) * 0.35 + (moved[1] - still[1]) * 0.94;
check(along > 1.5, `foam drifts downwind: ${along.toFixed(1)} texels more in 1 s at 2 m/s (still ${still}, drifting ${moved})`);

if (fails.length) { console.log(`\nsea-waves: ${fails.length} FAILED`); process.exit(1); }
console.log("\nsea-waves: OK");
