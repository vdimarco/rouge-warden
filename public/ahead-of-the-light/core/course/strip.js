// Ahead of the Light: a leg as an SVG strip (final.md 18.1, design-tech 6.9), for dev/strip.html and the course
// test. The ring unrolled: x is bearing from −180° to +180°, y is beat, down the page. Hazards are drawn at their true
// half-widths (rails as bands, walls as bars with their gaps, gates with their giants and the DOCK ring), pickups as
// diamonds and pluses, wells with their reach and exit bands, the validator's corridor shaded behind, and bot traces
// on top. Pure: it returns a string.
import { TUNE } from '../tune.js';
import { psiAt, railOn, halfAt, wellCore, wellReach, wrap } from './kinds.js';

const SX = 2;                     // px a degree
const SY = 10;                    // px a beat
const ML = 120, MR = 230, MT = 70, MB = 20;
const ORANGE = '#f08a2c', WHITE = '#ffffff', GREY = '#8a8a96', DIM = '#2a2a36', TEAL = '#5ad1c8';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (v) => Math.round(v * 10) / 10;

// x for a bearing, and the [x0, x1] spans of an arc centred at c with half-width h (split where it wraps).
const X = (b) => ML + (wrap(b) + 180) * SX;
function spans(c, h) {
  if (h >= 180) return [[ML, ML + 360 * SX]];
  const a = wrap(c - h) + 180, w = 2 * h;
  if (a + w <= 360) return [[ML + a * SX, ML + (a + w) * SX]];
  return [[ML + a * SX, ML + 360 * SX], [ML, ML + (a + w - 360) * SX]];
}
const Y = (beat) => MT + beat * SY;

// opts: { corridor (validateLeg's rows, from { keep: true }), title, tune }. traces: [{ name, color, points:
// [{ beat, bearing }] }].
export function stripSvg(leg, traces = [], opts = {}) {
  const T = opts.tune || TUNE;
  const beats = leg && leg.beats ? leg.beats : 0;
  const W = ML + 360 * SX + MR, H = MT + beats * SY + MB;
  const out = [];
  const add = (s) => out.push(s);
  add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" `
    + `data-leg="${esc(leg ? leg.type : '')}" font-family="system-ui, sans-serif">`);
  add(`<rect x="0" y="0" width="${W}" height="${H}" fill="#000"/>`);
  if (!leg) { add('</svg>'); return out.join(''); }
  const lane = leg.lane || {};
  const title = opts.title || `${leg.name || leg.type} · ${lane.name || ''}${lane.fam ? ` · ${lane.fam}` : ''}`
    + `${lane.cond ? ` · ${String(lane.cond).toUpperCase()}` : ''}`;
  const rep = leg.report || {};
  add(`<text x="${ML}" y="22" fill="${WHITE}" font-size="16" font-weight="700">${esc(title.toUpperCase())}</text>`);
  add(`<text x="${ML}" y="42" fill="${GREY}" font-size="11">seed ${esc(leg.seed)} · ${beats} beats · `
    + `${(leg.items || []).length} items · hash ${esc(leg.hash || '')} · ${rep.ok === false ? 'FAILS ' + esc((rep
      .errors || []).map((e) => e.rule).join(' ')) : 'valid'}${rep.passes !== undefined ? ` · ${rep.passes} passes`
      : ''}</text>`);
  add(`<text x="${ML}" y="58" fill="${GREY}" font-size="10">x: bearing −180° to +180° · y: beat · white: hazards · `
    + `orange: fuel, exit bands, thread · grey: corridor at 0.999c</text>`);

  // sections
  (leg.sections || []).forEach((s, i) => {
    add(`<rect x="${ML}" y="${Y(s.b0)}" width="${360 * SX}" height="${(s.b1 - s.b0) * SY}" `
      + `fill="${i % 2 ? '#0b0b14' : '#06060b'}"/>`);
    add(`<text x="${ML - 6}" y="${Y(s.b0) + 12}" fill="${GREY}" font-size="10" text-anchor="end">`
      + `${esc(s.role)}</text>`);
    if (s.ids && s.ids.length) {
      add(`<text x="${ML - 6}" y="${Y(s.b0) + 24}" fill="${WHITE}" font-size="10" text-anchor="end">`
        + `${esc(s.ids.join(' + '))}</text>`);
    }
  });
  // the corridor (one row per sub-step)
  if (opts.corridor) {
    const sub = opts.sub || 8, h = SY / sub;
    let d = '';
    opts.corridor.forEach((runs, k) => {
      for (const [a, b] of runs) d += `M${ML + (a + 180) * SX} ${f1(MT + k * h)}h${(b - a + 1) * SX}v${f1(h)}h${-(b - a + 1) * SX}z`;
    });
    if (d) add(`<path d="${d}" fill="#1c1c26"/>`);
  }
  // the grid
  for (const b of [-180, -90, 0, 90, 180]) {
    add(`<line x1="${ML + (b + 180) * SX}" y1="${MT}" x2="${ML + (b + 180) * SX}" y2="${MT + beats * SY}" `
      + `stroke="${DIM}" stroke-width="${b === 0 ? 1 : 0.5}"/>`);
    add(`<text x="${ML + (b + 180) * SX}" y="${MT - 4}" fill="${GREY}" font-size="9" text-anchor="middle">${b}°</text>`);
  }
  for (let b = 0; b <= beats; b += 4) {
    add(`<text x="${ML + 360 * SX + 6}" y="${Y(b) + 3}" fill="${DIM}" font-size="9">${b}</text>`);
  }

  const items = leg.items || [];
  const S = T.SHIP_HALF;
  // rails, fog and well reaches first, so instants draw over them
  for (const it of items) {
    if (it.kind === 'fog') {
      add(`<rect x="${ML}" y="${Y(it.beat)}" width="${360 * SX}" height="${(it.end - it.beat) * SY}" fill="${ORANGE}" `
        + 'fill-opacity="0.08"/>');
    }
    if (it.kind === 'rail') {
      const step = 0.25;
      for (let b = it.beat; b < it.end - 1e-9; b += step) {
        const bm = Math.min(it.end, b + step);
        if (!railOn(it, b + step / 2)) continue;
        const c = psiAt(it, b + step / 2);
        for (const [x0, x1] of spans(c, it.half)) {
          add(`<rect x="${f1(x0)}" y="${f1(Y(b))}" width="${f1(Math.max(1, x1 - x0))}" height="${f1((bm - b) * SY)}" `
            + `fill="${WHITE}" fill-opacity="${it.half >= 30 ? 0.35 : 0.85}"/>`);
        }
      }
    }
    if (it.kind === 'well') {
      for (const [x0, x1] of spans(it.psi, wellReach(it, T))) {
        add(`<line x1="${f1(x0)}" y1="${Y(it.beat)}" x2="${f1(x1)}" y2="${Y(it.beat)}" stroke="${TEAL}" `
          + 'stroke-width="1" stroke-dasharray="3 3"/>');
      }
      it.exits.forEach((e, k) => {
        const yb = Y(it.beat + 3 + k);
        for (const [x0, x1] of spans(e, T.EXIT_W / 2)) {
          add(`<rect x="${f1(x0)}" y="${yb - 2}" width="${f1(x1 - x0)}" height="4" fill="${ORANGE}" fill-opacity="0.45"/>`);
        }
        add(`<text x="${f1(X(e))}" y="${yb - 4}" fill="${ORANGE}" font-size="9" text-anchor="middle">${k ? 'B' : 'A'}</text>`);
      });
    }
  }
  for (const it of items) {
    const y = Y(it.beat);
    switch (it.kind) {
      case 'knot': case 'pulse': case 'well': {
        const h = it.kind === 'well' ? wellCore(it, T) : it.kind === 'pulse' ? halfAt(it) : it.half;
        const col = it.kind === 'well' ? TEAL : it.dark ? GREY : WHITE;
        for (const [x0, x1] of spans(it.psi, h)) {
          add(`<rect x="${f1(x0)}" y="${y - 3}" width="${f1(x1 - x0)}" height="6" rx="3" fill="${col}"`
            + `${it.opt ? ' fill-opacity="0.7"' : ''}/>`);
        }
        if (it.kind === 'pulse') {
          for (const [x0, x1] of spans(it.psi, Math.max(it.half0, it.half1))) {
            add(`<rect x="${f1(x0)}" y="${y - 4}" width="${f1(x1 - x0)}" height="8" fill="none" stroke="${WHITE}" `
              + 'stroke-dasharray="2 2"/>');
          }
        }
        if (it.name) add(`<text x="${f1(X(it.psi))}" y="${y - 6}" fill="${WHITE}" font-size="9" text-anchor="middle">${esc(it.name)}</text>`);
        break;
      }
      case 'wall': {
        const open = it.gaps.map((g) => [g.psi, g.w / 2]);
        // draw the wall as the ring minus its gaps, one degree at a time (cheap enough for a dev strip)
        let start = null;
        for (let d = -180; d <= 180; d++) {
          const inGap = d < 180 && open.some(([c, h]) => Math.abs(wrap(d - c)) < h);
          if (!inGap && d < 180 && start === null) start = d;
          if ((inGap || d === 180) && start !== null) {
            add(`<rect x="${ML + (start + 180) * SX}" y="${y - 2}" width="${(d - start) * SX}" height="4" fill="${WHITE}"/>`);
            start = null;
          }
        }
        for (const g of it.gaps) {
          if (g.tag) add(`<text x="${f1(X(g.psi))}" y="${y - 5}" fill="${GREY}" font-size="9" text-anchor="middle">${esc(g.tag)}</text>`);
        }
        if (it.preview) add(`<text x="${f1(X(it.gaps[0].psi))}" y="${y + 13}" fill="${ORANGE}" font-size="9" text-anchor="middle">PREVIEW</text>`);
        break;
      }
      case 'gate': {
        const g = it.gap / 2, [hl, hr] = it.halves;
        for (const [c, h] of [[it.psi - g - hl, hl], [it.psi + g + hr, hr]]) {
          for (const [x0, x1] of spans(c, h)) {
            add(`<rect x="${f1(x0)}" y="${y - 4}" width="${f1(x1 - x0)}" height="8" rx="4" fill="${WHITE}"/>`);
          }
        }
        for (const [x0, x1] of spans(it.psi, Math.max(0, g - S))) {
          add(`<rect x="${f1(x0)}" y="${y - 1}" width="${f1(Math.max(1, x1 - x0))}" height="2" fill="${ORANGE}"/>`);
        }
        if (it.dock) {
          for (const [x0, x1] of spans(it.dock.psi, it.dock.w / 2)) {
            add(`<rect x="${f1(x0)}" y="${y - 5}" width="${f1(x1 - x0)}" height="10" fill="none" stroke="${WHITE}" `
              + 'stroke-dasharray="4 3"/>');
          }
          add(`<text x="${f1(X(it.dock.psi))}" y="${y + 16}" fill="${WHITE}" font-size="9" text-anchor="middle">DOCK +</text>`);
          add(`<text x="${f1(X(it.psi))}" y="${y + 16}" fill="${ORANGE}" font-size="9" text-anchor="middle">THREAD</text>`);
        }
        if (it.names && !it.pair) {
          add(`<text x="${f1(X(it.psi))}" y="${y - 8}" fill="${WHITE}" font-size="9" text-anchor="middle">`
            + `${esc(it.names.join(' · '))}</text>`);
        }
        break;
      }
      case 'pickup': {
        const x = X(it.psi);
        if (it.type === 'fuel') {
          add(`<path d="M${f1(x)} ${y - 5}l5 5l-5 5l-5 -5z" fill="none" stroke="${ORANGE}" stroke-width="1.5"/>`);
        } else {
          add(`<path d="M${f1(x - 5)} ${y}h10M${f1(x)} ${y - 5}v10" stroke="${WHITE}" stroke-width="2"/>`);
          add(`<circle cx="${f1(x)}" cy="${y}" r="7" fill="none" stroke="${WHITE}" stroke-width="0.75"/>`);
        }
        break;
      }
      case 'cue':
        add(`<text x="${ML + 360 * SX + 28}" y="${y + 3}" fill="${GREY}" font-size="9">${esc(it.name)}`
          + `${it.data && it.data.label ? ` · ${esc(it.data.label)}` : ''}</text>`);
        add(`<line x1="${ML + 360 * SX}" y1="${y}" x2="${ML + 360 * SX + 24}" y2="${y}" stroke="${DIM}"/>`);
        if (it.data && typeof it.data.psi === 'number') {
          add(`<circle cx="${f1(X(it.data.psi))}" cy="${y}" r="4" fill="none" stroke="${GREY}"/>`);
        }
        break;
      default:
    }
  }
  // bot traces: break the line where it wraps round
  for (const tr of traces || []) {
    let d = '', prev = null;
    for (const p of tr.points || []) {
      const x = X(p.bearing), y = Y(p.beat);
      d += prev !== null && Math.abs(x - prev) < 180 * SX ? `L${f1(x)} ${f1(y)}` : `M${f1(x)} ${f1(y)}`;
      prev = x;
    }
    if (d) add(`<path d="${d}" fill="none" stroke="${tr.color || ORANGE}" stroke-width="1.5" stroke-opacity="0.9"/>`);
    for (const h of tr.hits || []) {
      add(`<circle cx="${f1(X(h.bearing))}" cy="${f1(Y(h.beat))}" r="5" fill="none" stroke="#ff4040" stroke-width="2"/>`);
    }
  }
  add('</svg>');
  return out.join('');
}
