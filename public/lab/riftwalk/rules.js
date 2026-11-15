// Riftwalk: the plain rules, with no drawing. The page (main.js) and the node test (qa/lab/riftwalk.test.mjs) share them.
// Each world is a packed Gaussian splat in metres: the floor is y = 0 and the point the world was captured from is
// (0, 1.5, 0). A splat world is sharp near that point and falls apart far from it, so the walker stays close to it.

export const EYE = 1.5;          // eye height, metres
export const SPACING = 400;      // metres between world centres along x; the largest world reaches about 85 m
export const RIFT_RADIUS = 1.0;  // the rift disc
export const RIFT_Y = 1.35;      // its centre height: the eye passes inside the disc
export const WISPS = 3;
export const LANE = 0.55;        // half width of the way to an open rift, outside the walk circle

// An angle is a compass turn in degrees: 0 looks along -z, 90 along +x, 180 along +z, 270 along -x.
// out: where this world's rift opens. in: where the walker arrives from the world before. walk: the walk circle.
export const WORLDS = [
  { id: 'cottage', name: 'Cottage', file: 'cottage.spz', tint: '#ffb45e', wisp: '#7fe9ff', out: 270, outDist: 1.5, in: 90, inDist: 1.2, walk: 1.1,
    wisps: [{ a: 20, r: 2.0, y: 1.9 }, { a: 150, r: 1.9, y: 0.8 }, { a: 215, r: 1.8, y: 2.1 }] },
  { id: 'shore', name: 'Shore ruin', file: 'shore.spz', tint: '#ffc98a', wisp: '#9ff3ff', out: 0, outDist: 2.3, in: 180, inDist: 2.0, walk: 1.9,
    wisps: [{ a: 60, r: 2.8, y: 2.3 }, { a: 140, r: 3.0, y: 0.7 }, { a: 250, r: 2.6, y: 1.8 }] },
  { id: 'ice', name: 'Ice cavern', file: 'ice.spz', tint: '#63d8ff', wisp: '#ffd76a', out: 0, outDist: 2.4, in: 180, inDist: 2.0, walk: 2.0,
    wisps: [{ a: 80, r: 3.0, y: 1.0 }, { a: 200, r: 3.2, y: 2.6 }, { a: 300, r: 2.6, y: 1.7 }] },
  { id: 'moonwell', name: 'Moonwell', file: 'moonwell.spz', tint: '#5fe0c8', wisp: '#ffd76a', out: 135, outDist: 2.2, in: 225, inDist: 2.0, walk: 1.8,
    wisps: [{ a: 30, r: 2.6, y: 2.2 }, { a: 180, r: 2.4, y: 0.6 }, { a: 300, r: 2.4, y: 1.3 }] },
];

export const nextIndex = i => (i + 1) % WORLDS.length;
export const direction = degrees => { const a = degrees * Math.PI / 180; return { x: Math.sin(a), z: -Math.cos(a) }; };
export const centre = i => ({ x: i * SPACING, z: 0 });

// Where a rift stands, in scene space. A rift's own +z axis is its front. The walker leaves a world through the back of
// its out rift and arrives through the back of the next world's in rift, so the out rift fronts the world's centre and
// the in rift fronts away from it. yaw is the turn about y that puts +z on that front.
export function outRift(i) {
  const w = WORLDS[i], d = direction(w.out), c = centre(i);
  return { x: c.x + d.x * w.outDist, y: RIFT_Y, z: c.z + d.z * w.outDist, yaw: Math.atan2(-d.x, -d.z), away: d };
}
export function inRift(i) {
  const w = WORLDS[i], d = direction(w.in), c = centre(i);
  return { x: c.x + d.x * w.inDist, y: RIFT_Y, z: c.z + d.z * w.inDist, yaw: Math.atan2(d.x, d.z), away: d };
}
export function wispPlace(i, k) {
  const w = WORLDS[i], s = w.wisps[k], d = direction(s.a), c = centre(i);
  return { x: c.x + d.x * s.r, y: s.y, z: c.z + d.z * s.r };
}

// One walk step. from and to are places relative to the world's centre. The walker may stand anywhere in the walk
// circle, and in the lane to an open rift. Outside both (just after an arrival), a step may only bring the walker
// nearer to the centre.
export function walk(world, from, to, riftOpen) {
  const inCircle = p => Math.hypot(p.x, p.z) <= world.walk;
  const inLane = p => {
    if (!riftOpen) return false;
    const d = direction(world.out), along = p.x * d.x + p.z * d.z, across = Math.abs(p.x * d.z - p.z * d.x);
    return across <= LANE && along > 0 && along <= world.outDist + 0.6;
  };
  if (inCircle(to) || inLane(to)) return to;
  if (Math.hypot(to.x, to.z) < Math.hypot(from.x, from.z)) return to;
  // Slide along the circle: keep the turn about the centre, give up the step outward.
  const r = Math.hypot(to.x, to.z) || 1, keep = Math.max(world.walk, Math.min(Math.hypot(from.x, from.z), r)), slid = { x: to.x / r * keep, z: to.z / r * keep };
  return Math.hypot(slid.x, slid.z) <= Math.hypot(from.x, from.z) + 1e-9 || inCircle(slid) ? slid : from;
}

// Does a look ray pass close enough to a wisp to catch it? The reach grows a little with distance, so a far wisp is
// not a smaller target for a finger than a near one.
export function rayNear(origin, dir, point, reach = 0.34) {
  const ox = point.x - origin.x, oy = point.y - origin.y, oz = point.z - origin.z, t = ox * dir.x + oy * dir.y + oz * dir.z;
  if (t <= 0) return null;
  const miss = Math.hypot(ox - dir.x * t, oy - dir.y * t, oz - dir.z * t);
  return miss <= reach + t * 0.035 ? { t, miss } : null;
}
// Does a look ray pass through a rift's disc, from either side?
export function rayThroughRift(origin, dir, rift, radius = RIFT_RADIUS * 1.15) {
  const n = { x: Math.sin(rift.yaw), z: Math.cos(rift.yaw) }, denom = dir.x * n.x + dir.z * n.z;
  if (Math.abs(denom) < 1e-5) return null;
  const t = ((rift.x - origin.x) * n.x + (rift.z - origin.z) * n.z) / denom;
  if (t <= 0) return null;
  const hx = origin.x + dir.x * t - rift.x, hy = origin.y + dir.y * t - rift.y, hz = origin.z + dir.z * t - rift.z;
  return Math.hypot(hx, hy, hz) <= radius ? { t } : null;
}

export const clock = seconds => { const s = Math.max(0, Math.floor(seconds)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
