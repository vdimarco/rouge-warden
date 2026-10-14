// Light Years Home v3: HUD rectangles for any viewport (final.md 13.1). Pure, so node tests and the browser use the
// same numbers: ui/hud.js places its elements here and ui/input.js hit-tests touches against them. Rectangles are
// CSS px [x, y, w, h]. At 390 × 844, 844 × 390 and 1440 × 900 they are the design's numbers; other sizes keep each
// element on the same edge, stretch the reading rows with the width, and move the hint above the ship when a short
// screen leaves no room under it.
import { TUNE } from './tune.js';

export const KINDS = Object.freeze(['portrait', 'landscape', 'desktop']);
export const TARGET_MIN = 44;                  // px, smallest touch target

// Touch screens taller than wide are portrait; wide screens of at least 1000 × 600 are desktop; the rest landscape.
// ui/input.js passes kind 'desktop' for a keyboard and mouse at any size, and portrait or landscape for touch.
export function kindFor(w, h) {
  if (h > w) return 'portrait';
  return w >= 1000 && h >= 600 ? 'desktop' : 'landscape';
}

const R = (x, y, w, h) => [Math.round(x), Math.round(y), Math.round(w), Math.round(h)];
const hit = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

// Phone, portrait (safe area about 47 top, 34 bottom on a 390 × 844 phone).
function portrait(W, Hh, s, scheme, shipY) {
  const X0 = s.l, X1 = W - s.r, top = s.t, bot = Hh - s.b, cx = (X0 + X1) / 2, sx = W / 2;
  const r = {};
  r.speed = R(X0 + 16, top + 5, 80, 40);
  r.mission = R(X0 + 104, top + 5, X1 - 72 - (X0 + 104), 40);
  r.pause = R(X1 - 60, top + 3, 44, 44);
  r.captions = R(X0 + 16, top + 57, X1 - X0 - 32, 46);
  r.toast = R(X0 + 31, top + 111, X1 - X0 - 62, 32);
  r.radar = R(X1 - 88, top + 151, 72, 72);
  r.info = R(X0 + 16, top + 151, X1 - 98 - (X0 + 16), 40);
  const y0 = Math.round(shipY * Hh);           // the camera's ship height
  r.ship = R(sx - 27, y0 - 20, 54, 40);
  r.pips = R(sx - 30, y0 - 44, 60, 18);
  if (scheme === 'one-thumb') {
    r.boost = R(X1 - 106, bot - 104, 76, 76);
  } else {
    r.gas = R(X1 - 100, bot - 120, 84, 116);
    r.brake = R(X1 - 184, bot - 96, 76, 92);
    r.boost = R(X1 - 92, bot - 204, 72, 72);
  }
  const chip = R(cx - 84, bot - 198, 168, 56);
  if (hit(chip, r.boost)) chip[0] = r.boost[0] - 8 - 168;          // narrow screens: keep clear of BOOST
  r.chip = chip;
  let hintY = chip[1] - 52;
  if (hintY < r.ship[1] + r.ship[3] + 8) hintY = r.pips[1] - 8 - 36;  // short screens: above the ship
  r.hint = R(cx - 100, hintY, 200, 36);
  const steerTop = scheme === 'one-thumb' ? Math.round(0.38 * Hh) : top + 253;
  const targets = scheme === 'one-thumb' ? ['pause', 'radar', 'chip', 'boost']
    : ['pause', 'radar', 'chip', 'boost', 'gas', 'brake'];
  return { rects: r, targets, steerArea: R(X0, steerTop, X1 - X0, bot - steerTop), shares: [] };
}

// Phone, landscape (safe area about 47 left and right, 21 bottom on an 844 × 390 phone). Stick on the left, pedals
// and BOOST under the right thumb.
function landscape(W, Hh, s, scheme, shipY) {
  const X0 = Math.max(s.l, 8), X1 = W - Math.max(s.r, 8), top = s.t, bot = Hh - Math.max(s.b, 8);
  const cx = (X0 + X1) / 2, sx = W / 2;
  const r = {};
  r.speed = R(X0 + 10, top + 10, 100, 34);
  const mw = Math.min(320, X1 - 56 - (X0 + 122));
  r.mission = R(cx - mw / 2, top + 10, mw, 34);
  r.pause = R(X1 - 44, top + 6, 44, 44);
  r.radar = R(X0 + 10, top + 52, 80, 80);
  const half = cx - (X0 + 102);                // the reading rows stay clear of the radar
  const cw = Math.min(500, 2 * half), tw = Math.min(400, 2 * half);
  r.captions = R(cx - cw / 2, top + 52, cw, 38);
  r.toast = R(cx - tw / 2, top + 96, tw, 28);
  r.hint = R(cx - tw / 2, top + 130, tw, 28);
  r.info = r.hint.slice();                     // one slot: hints wait while the info box shows
  const y0 = Math.round(shipY * Hh);
  r.ship = R(sx - 40, y0 - 19, 80, 40);
  r.pips = R(sx - 40, y0 - 41, 80, 18);
  if (scheme === 'one-thumb') {
    r.boost = R(X1 - 80, bot - 98, 76, 76);
  } else {
    r.gas = R(X1 - 84, bot - 118, 84, 116);
    r.brake = R(X1 - 172, bot - 94, 76, 92);
    r.boost = R(X1 - 78, bot - 202, 72, 72);
  }
  r.chip = R(X1 - 201, bot - 155, 112, 48);
  const steerTop = r.radar[1] + r.radar[3] + 8;
  const targets = scheme === 'one-thumb' ? ['pause', 'radar', 'chip', 'boost']
    : ['pause', 'radar', 'chip', 'boost', 'gas', 'brake'];
  return {
    rects: r, targets, steerArea: R(X0, steerTop, sx - 42 - X0, bot - steerTop), shares: [['hint', 'info']],
  };
}

// Desktop: keys, mouse or a pad. No pedals and no stick; the mouse steers from the screen centre when chosen.
function desktop(W, Hh, s, shipY) {
  const X0 = s.l, X1 = W - s.r, top = s.t, bot = Hh - s.b, cx = (X0 + X1) / 2, sx = W / 2;
  const r = {};
  r.speed = R(X0 + 24, top + 20, 120, 40);
  const mw = Math.min(400, X1 - 84 - (X0 + 160));
  r.mission = R(cx - mw / 2, top + 20, mw, 40);
  r.pause = R(X1 - 68, top + 16, 44, 44);
  const cw = Math.min(800, X1 - X0 - 48), tw = Math.min(500, X1 - X0 - 48);
  r.captions = R(cx - cw / 2, top + 72, cw, 56);
  r.toast = R(cx - tw / 2, top + 136, tw, 36);
  r.info = R(cx - tw / 2, top + 180, tw, 32);
  r.radar = R(X0 + 24, bot - 184, 160, 160);
  const y0 = Math.round(shipY * Hh);
  r.ship = R(sx - 75, y0 - 24, 150, 60);
  r.pips = R(sx - 60, y0 - 54, 120, 20);
  r.hint = R(cx - 150, Math.max(bot - 200, r.ship[1] + r.ship[3] + 12), 300, 36);
  r.chip = R(cx - 80, Math.max(bot - 140, r.hint[1] + r.hint[3] + 12), 160, 52);
  return { rects: r, targets: ['pause', 'radar', 'chip'], steerArea: null, shares: [] };
}

function cleanSafe(safe) {
  const s = safe || {};
  const v = (a, b) => Math.max(0, Number.isFinite(a) ? a : Number.isFinite(b) ? b : 0);
  return { t: v(s.t, s.top), b: v(s.b, s.bottom), l: v(s.l, s.left), r: v(s.r, s.right) };
}

const mirror = (rect, W) => [W - rect[0] - rect[2], rect[1], rect[2], rect[3]];

/**
 * layoutFor({ w, h, safe, scheme, hand, kind, tune }) → { kind, w, h, scheme, hand, safe, rects, targets, steerArea,
 * shares }. safe is { t, b, l, r } (or top, bottom, left, right). rects maps names to [x, y, w, h]: speed, mission,
 * pause, captions, toast, radar, info, ship, pips, hint, chip, boost (touch), gas and brake (pedals). targets lists
 * the touch targets in hit order. steerArea is where a thumb starts the floating stick (buttons inside it win);
 * null on desktop. shares lists rect pairs that are one slot by design. The left hand mirrors x.
 */
export function layoutFor({ w = 390, h = 844, safe = null, scheme = 'pedals', hand = 'right', kind = null,
  tune = TUNE } = {}) {
  const W = Math.max(1, Math.round(w)), Hh = Math.max(1, Math.round(h));
  const k = KINDS.includes(kind) ? kind : kindFor(W, Hh);
  const sch = scheme === 'one-thumb' ? 'one-thumb' : 'pedals';
  const left = hand === 'left';
  const s = cleanSafe(safe);
  const sm = left ? { ...s, l: s.r, r: s.l } : s;         // lay out for the right hand, then mirror
  const shipY = tune?.CAM?.[k]?.SHIP_Y ?? TUNE.CAM[k].SHIP_Y;
  const out = k === 'portrait' ? portrait(W, Hh, sm, sch, shipY)
    : k === 'landscape' ? landscape(W, Hh, sm, sch, shipY) : desktop(W, Hh, sm, shipY);
  if (left) {
    for (const name of Object.keys(out.rects)) out.rects[name] = mirror(out.rects[name], W);
    if (out.steerArea) out.steerArea = mirror(out.steerArea, W);
  }
  return { kind: k, w: W, h: Hh, scheme: k === 'desktop' ? null : sch, hand: left ? 'left' : 'right', safe: s, ...out };
}

// Every pair of rectangles that overlap (touching edges do not), as [nameA, nameB], skipping pairs in allow.
export function overlaps(rects, allow = []) {
  const ok = new Set(allow.map(([a, b]) => [a, b].sort().join('|')));
  const names = Object.keys(rects);
  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (ok.has([names[i], names[j]].sort().join('|'))) continue;
      if (hit(rects[names[i]], rects[names[j]])) pairs.push([names[i], names[j]]);
    }
  }
  return pairs;
}

// Names of rectangles that leave the screen or cross into the safe area.
export function unsafe(layout) {
  const { w, h, safe, rects } = layout;
  return Object.keys(rects).filter((name) => {
    const [x, y, rw, rh] = rects[name];
    return x < safe.l || y < safe.t || x + rw > w - safe.r || y + rh > h - safe.b;
  });
}

// The first touch target under a point, or null; then whether the point can start the stick.
export function targetAt(layout, x, y) {
  for (const name of layout.targets) {
    const [rx, ry, rw, rh] = layout.rects[name];
    if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return name;
  }
  return null;
}

export function inSteerArea(layout, x, y) {
  const a = layout.steerArea;
  return !!a && x >= a[0] && x < a[0] + a[2] && y >= a[1] && y < a[1] + a[3] && targetAt(layout, x, y) === null;
}
