// Checks a baked place against the spec: budget, palette, the start on the ground, the beacon and every wisp in reach by the
// controller's own rules, and (from a CPU picture at the start) that the place is dark with bright fire in it. The download counts the
// place's JSON with its two files. Below, the rules for the combat run's figure files (lib/figures.mjs) and each place's pool.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { makeWalk, reachable, JUMP, PARAMS } from '../../../public/lab/gloam-downs/play.js';
import { readFigures } from '../../../public/lab/gloam-downs/pool.js';
import { walkCells } from './common.mjs';

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

export function checkPlace({ meta, walk, world }, { gzBytes, frame, worlds } = {}) {
  const out = [];
  const ok = (cond, what) => out.push({ ok: !!cond, what });
  ok(meta.count <= BUDGET.splats, `splats ${meta.count} <= ${BUDGET.splats}`);
  if (gzBytes !== undefined) ok(gzBytes <= BUDGET.gzBytes, `download ${(gzBytes / 1e6).toFixed(3)} MB <= 1.5 MB (splats, walk map and JSON)`);
  ok(meta.pal.length <= BUDGET.colors, `palette ${meta.pal.length} <= 48`);
  const W = makeWalk(meta.walk, walkCells(walk));
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
  // with the foe files baked: this place with its pool, and with the foe files, against the run's budgets
  if (worlds) for (const r of placeChecks(worlds)) if (r.what.startsWith(`${meta.id}:`)) out.push(r);
  return out;
}
/* ---------------- the checks of the figure files ---------------- */
export const FIGURE_BUDGET = { foes: 200 * 1024, boss: 140 * 1024, place: 275000, placeBytes: 1.5e6, beforePlay: 1.7e6, luma: 0.42 };
const PLACES = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
export const luma = c => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;
// the resolve's own nearest colour: weighted squares, (0.30, 0.55, 0.15) on R, G and B
export function snap(c, pal) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const p = pal[i], dr = ((c >> 16) & 255) - ((p >> 16) & 255), dg = ((c >> 8) & 255) - ((p >> 8) & 255), db = (c & 255) - (p & 255);
    const d = 0.3 * dr * dr + 0.55 * dg * dg + 0.15 * db * db;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
// the packed colours a figure file uses (r in the low byte, as the renderer reads them), as 0xRRGGBB
export function coloursOf(data, first, end) {
  const set = new Set();
  for (let i = first; i < end; i++) { const v = data[i * 16 + 7]; set.add(((v & 255) << 16) | (((v >> 8) & 255) << 8) | ((v >> 16) & 255)); }
  return [...set];
}
/* Every figure colour, snapped to each place's palette, lands under 0.42 luminance, or on slots 32..39 or 44..47 (fire, wisp, iron,
   lamp); none lands on slot 40 (the brightest wisp), and no body colour lands on the lamplighter's cloak slots 41..43 */
export function colourChecks(data, types, worlds) {
  const out = [];
  for (const id of PLACES) {
    const pal = JSON.parse(fs.readFileSync(path.join(worlds, `${id}.json`), 'utf8')).pal;
    for (const T of Object.values(types)) {
      const bad = [], cloak = [];
      for (const c of coloursOf(data, T.first, T.end)) {
        const i = snap(c, pal);
        if (i === 40 || (luma(pal[i]) >= FIGURE_BUDGET.luma && !((i >= 32 && i <= 39) || (i >= 44 && i <= 47)))) bad.push(`${c.toString(16).padStart(6, '0')}->${i}`);
        if (i >= 41 && i <= 43) cloak.push(`${c.toString(16).padStart(6, '0')}->${i}`);
      }
      out.push({ ok: !bad.length, what: `${T.title} colours in ${id}: under ${FIGURE_BUDGET.luma}, or fire, wisp, iron or lamp, never slot 40${bad.length ? ` (${bad.join(' ')})` : ''}` });
      out.push({ ok: !cloak.length, what: `${T.title} colours in ${id}: none on the lamplighter's cloak slots${cloak.length ? ` (${cloak.join(' ')})` : ''}` });
    }
  }
  return out;
}
const fsize = f => (fs.existsSync(f) ? fs.statSync(f).size : null);
// the foe files (foes.bin.gz and foes.json.gz) at most 200 KB together, the boss files at most 140 KB; which: 'foes' or 'boss'
export function fileChecks(worlds, which = ['foes', 'boss']) {
  const out = [];
  for (const w of [].concat(which)) {
    const a = fsize(path.join(worlds, `${w}.bin.gz`)), b = fsize(path.join(worlds, `${w}.json.gz`));
    if (a === null || b === null) { out.push({ ok: false, what: `${w}: the files are not baked` }); continue; }
    out.push({ ok: a + b <= FIGURE_BUDGET[w], what: `${w} files ${((a + b) / 1024).toFixed(1)} KB <= ${FIGURE_BUDGET[w] / 1024} KB` });
  }
  return out;
}
// a place's three files, the foe files and its pool, against the budgets
export function placeChecks(worlds) {
  const out = [], foes = path.join(worlds, 'foes.json.gz');
  if (!fs.existsSync(foes)) return out;
  const F = readFigures(JSON.parse(zlib.gunzipSync(fs.readFileSync(foes)).toString()));
  const bf = path.join(worlds, 'boss.json.gz'), boss = fs.existsSync(bf) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(bf)).toString()) : null;
  const foeBytes = fsize(path.join(worlds, 'foes.bin.gz')) + fsize(foes);
  for (const id of PLACES) {
    const files = ['.bin.gz', '.walk.bin.gz', '.json'].map(e => fsize(path.join(worlds, id + e)));
    if (files.includes(null)) continue;
    const bytes = files.reduce((a, b) => a + b, 0), meta = JSON.parse(fs.readFileSync(path.join(worlds, `${id}.json`), 'utf8'));
    let pool = 0;
    for (const code of F.pools[id]) {
      const inBoss = code === 'B' || code === 'C', T = inBoss ? boss?.types[code] : F.types[code];
      if (T) pool += T.end - T.first;
      else out.push({ ok: inBoss && !boss, what: `${id}: pool slot ${code} has a figure${inBoss ? ' (the boss files are not baked yet)' : ''}` });
    }
    out.push({ ok: bytes <= FIGURE_BUDGET.placeBytes, what: `${id}: its three files ${(bytes / 1e6).toFixed(3)} MB <= 1.5 MB` });
    out.push({ ok: bytes + foeBytes <= FIGURE_BUDGET.beforePlay, what: `${id}: with the foe files ${((bytes + foeBytes) / 1e6).toFixed(3)} MB <= 1.7 MB` });
    out.push({ ok: meta.count + pool <= FIGURE_BUDGET.place, what: `${id}: ${meta.count} + pool ${pool} = ${meta.count + pool} splats <= ${FIGURE_BUDGET.place}` });
  }
  return out;
}

export { PARAMS };
