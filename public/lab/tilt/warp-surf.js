// Optional warp piloting. Coordinates are dimensionless, with x right and y down.
// Render projection and scoring share these coordinates; viewport size never changes a hit.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const WARP_RING_POINTS = 150;
export const WARP_RING_RADIUS = 0.32;
export const WARP_NEAR_CLIP = 0.1;
export const WARP_DEPTH_RATE = 12;
export const WARP_STEERING_RATE = 8;
const CROSSINGS = [0.5, 0.65, 0.8];

export function createWarpSurf(seed, fromSector = 0, toSector = fromSector + 1, { reducedMotion = false } = {}) {
  let n = ((Number(seed) || 1) ^ Math.imul(fromSector + 1, 0x9e3779b1) ^ Math.imul(toSector + 1, 0x85ebca6b)) >>> 0;
  const random = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  const rings = CROSSINGS.map((crossing, id) => ({ id, crossing,
    // Keep the first challenge readable and make collecting a ring a deliberate choice.
    x: (random() < 0.5 ? -1 : 1) * (0.38 + random() * 0.22),
    y: (random() - 0.5) * 0.6, radius: WARP_RING_RADIUS, status: 'pending' }));
  return { enabled: !reducedMotion, reducedMotion: !!reducedMotion, pilot: { x: 0, y: 0 },
    target: { x: 0, y: 0 }, rings, hits: 0, points: 0, settled: false };
}

export function setWarpSurfAim(surf, x, y) {
  if (!surf?.enabled || surf.settled || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  surf.target.x = clamp(x, -1, 1); surf.target.y = clamp(y, -1, 1);
  return true;
}

export function clearWarpSurfAim(surf) {
  if (!surf) return false;
  surf.target.x = surf.pilot.x; surf.target.y = surf.pilot.y;
  return true;
}

// Advance only from the simulation tick. Exact exponential smoothing lets a crossing
// use the ship position at that instant, even when a fixed step straddles its plane.
export function stepWarpSurf(surf, previousProgress, progress, dt) {
  const events = [];
  if (!surf?.enabled || surf.settled || !(dt > 0) || !(progress > previousProgress)) return events;
  const start = { ...surf.pilot };
  const positionAt = elapsed => ({
    x: surf.target.x + (start.x - surf.target.x) * Math.exp(-WARP_STEERING_RATE * elapsed),
    y: surf.target.y + (start.y - surf.target.y) * Math.exp(-WARP_STEERING_RATE * elapsed),
  });
  Object.assign(surf.pilot, positionAt(dt));
  for (const ring of surf.rings) {
    if (ring.status !== 'pending' || progress + 1e-10 < ring.crossing) continue;
    const fraction = clamp((ring.crossing - previousProgress) / (progress - previousProgress), 0, 1);
    const pilot = positionAt(dt * fraction), distance = Math.hypot(ring.x - pilot.x, ring.y - pilot.y);
    const hit = distance <= ring.radius;
    ring.status = hit ? 'hit' : 'miss'; ring.distance = distance;
    if (hit) { surf.hits++; surf.points += WARP_RING_POINTS; }
    events.push({ type: 'warp-ring', id: ring.id, hit, hits: surf.hits,
      points: hit ? WARP_RING_POINTS : 0, distance, crossing: ring.crossing });
  }
  return events;
}

// Settle once on either natural or skipped arrival. Skipping never evaluates future rings.
export function settleWarpSurf(surf) {
  if (!surf || surf.settled) return false;
  surf.settled = true;
  clearWarpSurfAim(surf);
  return surf.reducedMotion || surf.hits >= 2;
}

// Perspective divide with a hard near plane. A ring crosses the ship when depth reaches
// nearClip. The apparent center/radius ratio is the exact physical miss distance/radius.
export function projectWarpRing(ring, surf, progress, width, height) {
  const depth = WARP_NEAR_CLIP + (ring.crossing - progress) * WARP_DEPTH_RATE;
  const valid = Number.isFinite(depth + width + height + ring.x + ring.y + ring.radius) && width > 0 && height > 0;
  if (!valid || !surf?.enabled || ring.status !== 'pending' || depth < WARP_NEAR_CLIP - 1e-9) {
    return { x: width / 2 || 0, y: height / 2 || 0, radius: 0, depth, scale: 0, visible: false };
  }
  const scale = Math.min(width, height) * 0.55 / Math.max(WARP_NEAR_CLIP, depth);
  return { x: width / 2 + (ring.x - surf.pilot.x) * scale,
    y: height / 2 + (ring.y - surf.pilot.y) * scale,
    radius: ring.radius * scale, depth, scale, visible: true };
}
