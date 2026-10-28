// First Breath: rim sparks (design.md 5.5, 10). Each Glowing grade so far (carry.sparks) is a small cream spark on
// your membrane rim for the rest of the run; at most 8 show. A stage view calls rimSparks() round your body. Pure.
//
// Contract choices:
// - rimSparks(d, sparks, x, y, r, { t, span }) puts the sparks evenly round the circle (x, y, r) in world units,
//   turning slowly with t (0.3 rad/s), as split.js does round its ball. Each is a small solid ripple, 0.8 u at a
//   100 u span (so the same size on screen in every stage), at alpha 0.8.
// - They join the draw list's first ripples strip, or a new one when it has none and a strip is free (16.5 allows
//   6 strips; ripples have no count limit), so they never cost a mark or a splat. → the number drawn.
import { LIMITS } from "../draw.js";

export const SPARKS_MAX = 8;
const fin = (v) => typeof v === "number" && Number.isFinite(v);

export function rimSparks(d, sparks, x, y, r, { t = 0, span = 100 } = {}) {
  const n = Math.max(0, Math.min(SPARKS_MAX, Math.floor(fin(sparks) ? sparks : 0)));
  if (!n || !d || !Array.isArray(d.strips) || !fin(x) || !fin(y) || !fin(r)) return 0;
  let strip = d.strips.find((s) => s && s.kind === "ripples" && Array.isArray(s.items));
  if (!strip) {
    if (d.strips.length >= LIMITS.strips) return 0;
    strip = { kind: "ripples", items: [] };
    d.strips.push(strip);
  }
  const size = 0.008 * (fin(span) && span > 0 ? span : 100), turn = 0.3 * (fin(t) ? t : 0);
  for (let s = 0; s < n; s++) {
    const a = (2 * Math.PI * s) / n + turn;
    strip.items.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a), r: size, a: 0.8, dashed: false });
  }
  return n;
}
