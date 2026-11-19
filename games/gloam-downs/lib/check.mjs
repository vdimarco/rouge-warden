// Checks a baked place against the spec: budget, palette, the start on the ground, the beacon and every wisp in reach by the
// controller's own rules, and (from a CPU picture at the start) that the place is dark with bright fire in it.
import { makeWalk, reachable, JUMP, PARAMS } from '../../../public/lab/gloam-downs/play.js';

export const BUDGET = { splats: 250000, gzBytes: 1.5e6, colors: 48, meanLuma: 0.32, meanMin: 0.05, brightLuma: 0.55, brightMin: 0.0005, brightMax: 0.12 };

export function lumaStats(frame) {
  const { rgb } = frame, n = rgb.length / 3;
  let sum = 0, bright = 0;
  const lin = c => { c /= 255; return c; };
  for (let i = 0; i < n; i++) {
    const y = 0.2126 * lin(rgb[i * 3]) + 0.7152 * lin(rgb[i * 3 + 1]) + 0.0722 * lin(rgb[i * 3 + 2]);
    sum += y;
    if (y > BUDGET.brightLuma) bright++;
  }
  return { mean: sum / n, bright: bright / n };
}

export function checkPlace({ meta, walk, world }, { gzBytes, frame } = {}) {
  const out = [];
  const ok = (cond, what) => out.push({ ok: !!cond, what });
  ok(meta.count <= BUDGET.splats, `splats ${meta.count} <= ${BUDGET.splats}`);
  if (gzBytes !== undefined) ok(gzBytes <= BUDGET.gzBytes, `download ${(gzBytes / 1e6).toFixed(2)} MB <= 1.5 MB`);
  ok(meta.pal.length <= BUDGET.colors, `palette ${meta.pal.length} <= 48`);
  const cells = new Int16Array(walk.T.length * 2);
  cells.set(walk.T, 0);
  cells.set(walk.G, walk.T.length);
  const W = makeWalk(meta.walk, cells);
  const sy = W.support(meta.spawn.p[0], meta.spawn.p[2], meta.spawn.p[1] + 1);
  ok(sy !== null && Math.abs(sy - meta.spawn.p[1]) < 0.6, `start stands on the ground (floor ${sy?.toFixed(2)}, start ${meta.spawn.p[1].toFixed(2)})`);
  const R = reachable(W, meta.spawn, meta.bounds);
  ok(R.cells > 2000, `walkable area ${R.cells} cells`);
  ok(R.near(meta.beacon.p, meta.beacon.r * 0.9, -2.6, 2.6), `beacon at ${meta.beacon.p.map(v => v.toFixed(1))} can be reached`);
  meta.wisps.forEach((w, i) => ok(R.near(w.p), `wisp ${i + 1} at ${w.p.map(v => v.toFixed(1))} can be reached (jump lifts the feet ${JUMP.toFixed(2)})`));
  // the summit: the beacon should stand higher than the start, so it can be seen across the place
  ok(meta.beacon.p[1] > meta.spawn.p[1] + 2, `beacon (${meta.beacon.p[1].toFixed(1)}) stands above the start (${meta.spawn.p[1].toFixed(1)})`);
  if (frame) {
    const L = lumaStats(frame);
    ok(L.mean < BUDGET.meanLuma && L.mean > BUDGET.meanMin, `dark but not black: mean luminance ${L.mean.toFixed(3)} in ${BUDGET.meanMin}..${BUDGET.meanLuma}`);
    ok(L.bright >= BUDGET.brightMin && L.bright <= BUDGET.brightMax, `bright accents: ${(L.bright * 100).toFixed(2)}% of pixels over ${BUDGET.brightLuma}`);
  }
  return out;
}
export { PARAMS };
