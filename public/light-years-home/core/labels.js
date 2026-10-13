// Light Years Home: where ring labels go. Greedy placement (Christensen, Marks and Shieber 1995): the most important
// label first, each tried on the right and then the left of its ring, above and then below, with a diagonal leader
// and a short flat run. A spot is rejected when the label leaves the free area or overlaps a placed label, a ring or
// a HUD rect. At most 6 labels. Pure: the caller measures text widths (or they are estimated from the font size).

export const MAX_LABELS = 6;

// Candidate spots in order of preference: side (+1 right, −1 left) and up (+1) or down (−1).
const SPOTS = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
const D45 = Math.SQRT1_2;

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const grow = (a, p) => ({ x: a.x - p, y: a.y - p, w: a.w + 2 * p, h: a.h + 2 * p });
export const RING_CORE = 14;   // px around a ring's centre kept clear of other labels (the object itself)

// Does a label rect cover another ring? A ring is a thin outline, so a rect blocks it when it crosses the outline or
// covers the object at its centre. A small ring is blocked anywhere inside it; a big one (a galaxy filling the
// screen) leaves room for labels inside.
function hitsRing(rect, c, r, pad) {
  const nx = Math.max(rect.x, Math.min(c.x, rect.x + rect.w)), ny = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
  const nearest = Math.hypot(c.x - nx, c.y - ny);
  const farthest = Math.hypot(Math.max(Math.abs(c.x - rect.x), Math.abs(c.x - rect.x - rect.w)),
    Math.max(Math.abs(c.y - rect.y), Math.abs(c.y - rect.y - rect.h)));
  return nearest < Math.min(r, RING_CORE) + pad || (nearest < r + pad && farthest > r - pad);
}

// Geometry of one label spot for a ring.
export function labelSpot(item, side, up, { fontPx = 11, leader = 14, run = 10, gap = 4, charPx } = {}) {
  const w = item.width ?? String(item.text).length * (charPx ?? fontPx * 0.6);
  const h = Math.ceil(fontPx * 1.3);
  const anchor = [item.x + side * item.r * D45, item.y - up * item.r * D45];
  const elbow = [anchor[0] + side * leader, anchor[1] - up * leader];
  const end = [elbow[0] + side * run, elbow[1]];
  const textX = end[0] + side * gap;
  const rect = { x: side > 0 ? textX : textX - w, y: elbow[1] - h / 2, w, h };
  return { anchor, elbow, end, textX, textY: elbow[1], align: side > 0 ? 'left' : 'right', rect };
}

// items: [{ id, x, y, r, text, width?, priority?, onScreen? }] in CSS px.
// opts: { width, height, box?: {x,y,w,h} free area, avoid?: [{x,y,w,h}], max?, fontPx?, leader?, run?, gap?, pad? }.
// Returns placed labels: [{ id, text, side: 'right'|'left', up, anchor, elbow, end, textX, textY, align, rect }].
export function placeLabels(items, opts = {}) {
  const { width = Infinity, height = Infinity, avoid = [], max = MAX_LABELS, pad = 2 } = opts;
  const area = opts.box ?? { x: 0, y: 0, w: width, h: height };
  const list = (Array.isArray(items) ? items : [])
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it && it.onScreen !== false && it.text && [it.x, it.y, it.r].every(Number.isFinite))
    .sort((a, b) => (b.it.priority ?? 0) - (a.it.priority ?? 0) || a.i - b.i);
  const placed = [];
  for (const { it } of list) {
    if (placed.length >= Math.min(max, MAX_LABELS)) break;
    for (const [side, up] of SPOTS) {
      const s = labelSpot(it, side, up, opts);
      const lead = {
        x: Math.min(s.anchor[0], s.end[0]), y: Math.min(s.anchor[1], s.end[1]),
        w: Math.abs(s.end[0] - s.anchor[0]), h: Math.abs(s.end[1] - s.anchor[1]),
      };
      const box = grow(s.rect, pad);
      if (!inside(s.rect, area)) continue;
      if (placed.some((p) => overlaps(box, p.rect) || overlaps(lead, p.rect))) continue;
      if (avoid.some((a) => overlaps(box, a) || overlaps(lead, a))) continue;
      if (list.some(({ it: o }) => o !== it && hitsRing(box, o, o.r, pad))) continue;
      placed.push({ id: it.id, text: it.text, side: side > 0 ? 'right' : 'left', up: up > 0, ...s });
      break;
    }
  }
  return placed;
}
