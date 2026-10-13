// Light Years Home: pointer picking. Tells a tap from a drag or a hold, and finds the ring a tap lands on.
// Pure: input.js feeds it pointer positions (CSS px) and times (ms); the overlay's ring list comes from core/project.js.

export const TAP_MS = 250;     // a tap is a press and release within this time...
export const TAP_PX = 10;      // ...and this distance
export const HIT_MIN = 22;     // a ring is hit within max(its radius, this), in CSS px

// down, up: { x, y, t } with t in ms. Returns 'tap', 'drag' (moved more than 10 px) or 'hold' (pressed longer).
export function classifyPointer(down, up) {
  if (!down || !up) return 'hold';
  const dx = up.x - down.x, dy = up.y - down.y, dt = up.t - down.t;
  const moved = Math.hypot(dx, dy);
  if (!Number.isFinite(moved) || !Number.isFinite(dt)) return 'hold';
  if (moved > TAP_PX) return 'drag';
  if (dt > TAP_MS || dt < 0) return 'hold';
  return 'tap';
}

export const hitRadius = (ring) => Math.max(Number(ring.r) || 0, HIT_MIN);

// The ring under (x, y), or null. Rings are { x, y, r, ... } in CSS px; rings marked onScreen: false or
// visible: false are skipped. When rings overlap, a live ring beats a greyed one, then the nearest centre wins.
export function hitTest(rings, x, y) {
  if (!Array.isArray(rings) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  let best = null, bestKey = Infinity;
  for (const ring of rings) {
    if (!ring || ring.onScreen === false || ring.visible === false) continue;
    const d = Math.hypot(x - ring.x, y - ring.y);
    if (!(d <= hitRadius(ring))) continue;
    const key = (ring.grey ? 1e6 : 0) + d;
    if (key < bestKey) { best = ring; bestKey = key; }
  }
  return best;
}
