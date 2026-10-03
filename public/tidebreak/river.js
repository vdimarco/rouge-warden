import { SIZE, MAP_SCALE } from './arena.js';
const LENGTH = SIZE, STEP = 12, cache = new Map();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const random = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
function spline(knots, x, key) {
  let i = 0; while (i < knots.length - 2 && x > knots[i + 1].x) i++;
  const a = knots[i], b = knots[i + 1], before = knots[Math.max(0, i - 1)], after = knots[Math.min(knots.length - 1, i + 2)];
  const span = b.x - a.x, t = clamp((x - a.x) / span, 0, 1), t2 = t * t, t3 = t2 * t;
  const ma = (b[key] - before[key]) / (b.x - before.x), mb = (after[key] - a[key]) / (after.x - a.x);
  return (2 * t3 - 3 * t2 + 1) * a[key] + (t3 - 2 * t2 + t) * ma * span + (-2 * t3 + 3 * t2) * b[key] + (t3 - t2) * mb * span;
}
export function riverGeometry(seed = 49) {
  seed >>>= 0; if (cache.has(seed)) return cache.get(seed);
  const rand = random(seed ^ 0x42a67d), phase = rand() * Math.PI * 2;
  const knots = [[0, 2330], [570, 2400], [1160, 2180], [1660, 2070], [1990, 1985], [2420, 2150], [2960, 2110], [3540, 2340], [4110, 2110], [4620, 1810], [4800, 1840]]
    .map(([x, y]) => ({ x: x * MAP_SCALE, y: (y + (rand() - .5) * (x > 1700 && x < 2600 ? 90 : 210)) * MAP_SCALE, width: (65 + rand() * 47) * MAP_SCALE }));
  const pools = [
    { x: 1000 + rand() * 340, radius: 210 + rand() * 110, extra: 45 + rand() * 34 },
    { x: 3070 + rand() * 430, radius: 250 + rand() * 100, extra: 44 + rand() * 35 },
  ].map(p => ({ x: p.x * MAP_SCALE, radius: p.radius * MAP_SCALE, extra: p.extra * MAP_SCALE }));
  // Local erosion pockets have independent sizes and positions on each bank.
  const pockets = Array.from({ length: 18 }, (_, i) => ({
    x: 140 + rand() * (LENGTH - 280), radius: 65 + rand() * 160,
    depth: (i % 4 === 0 ? -1 : 1) * (14 + rand() * 42), side: i % 2,
  }));
  const erosion = (x, side) => {
    const depth = pockets.filter(p => p.side === side)
      .reduce((n, p) => n + Math.exp(-(((x - p.x) / p.radius) ** 2)) * p.depth, 0);
    const limit = depth < 0 ? 30 : 78;
    return limit * Math.tanh(depth / limit);
  };
  const samples = [];
  for (let sample = 0; sample <= Math.ceil(LENGTH / STEP); sample++) {
    const x = Math.min(LENGTH, sample * STEP);
    const y = spline(knots, x, 'y'), width = spline(knots, x, 'width') + pools.reduce((n, p) => n + Math.exp(-(((x - p.x) / p.radius) ** 2)) * p.extra, 0);
    // Independent banks make bends, coves and sand shelves asymmetric.
    const north = y - erosion(x, 0) - width * (.86 + Math.sin(x * .0043 + phase) * .13) - Math.sin(x * .021 + phase) * 7;
    const south = y + erosion(x, 1) + width * (1.04 + Math.cos(x * .0051 + phase) * .18) + Math.sin(x * .017 - phase) * 9;
    const bend = (spline(knots, Math.min(LENGTH, x + 36), 'y') - 2 * y + spline(knots, Math.max(0, x - 36), 'y')) / 8;
    // Deposited sand broadens inside bends; the cut bank stays narrow.
    const northShelf = clamp(19 + Math.max(0, bend) * 34 + erosion(x, 0) * .65 + Math.sin(x * .008 + phase) * 14, 8, 92);
    const southShelf = clamp(24 + Math.max(0, -bend) * 34 + erosion(x, 1) * .65 + Math.cos(x * .006 - phase) * 19, 8, 100);
    samples.push({ x, y, north, south, northShelf, southShelf });
  }
  const river = { seed, samples, pools, pockets }; cache.set(seed, river);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return river;
}
export function riverSample(x, seed = 49) {
  const { samples } = riverGeometry(seed), i = clamp(Math.floor(x / STEP), 0, samples.length - 2);
  const a = samples[i], b = samples[i + 1], span = b.x - a.x, t = clamp((x - a.x) / span, 0, 1);
  return { x, y: a.y + (b.y - a.y) * t, north: a.north + (b.north - a.north) * t, south: a.south + (b.south - a.south) * t, slope: (b.y - a.y) / span };
}
export const creekCenter = (x, seed = 49) => riverSample(x, seed).y;
export function outsideRiver(p, seed = 49) { const bank = riverSample(p.x, seed); return Math.max(bank.north - p.y, p.y - bank.south); }
export function insideRiver(p, seed = 49) { const bank = riverSample(p.x, seed); return p.y > bank.north && p.y < bank.south; }

// Find the actual intersection on each lane instead of placing bridges at fixed x.
export function riverCrossings(lanes, seed = 49) {
  return lanes.flatMap((lane, laneIndex) => {
    for (let i = 1; i < lane.length; i++) {
      const a = lane[i - 1], b = lane[i], at = t => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      const signed = t => { const p = at(t); return p.y - creekCenter(p.x, seed); };
      if (signed(0) * signed(1) > 0) continue;
      let low = 0, high = 1;
      for (let j = 0; j < 24; j++) { const mid = (low + high) / 2; if (signed(low) * signed(mid) <= 0) high = mid; else low = mid; }
      const p = at((low + high) / 2), length = Math.hypot(a.x - b.x, a.y - b.y), dx = (a.x - b.x) / length, dy = (a.y - b.y) / length;
      // Size the bridge along the track, including each bend's actual bank.
      const landing = sign => {
        let lo = 0, hi = 24;
        const distanceToBank = d => outsideRiver({ x: p.x + sign * dx * d, y: p.y + sign * dy * d }, seed);
        while (distanceToBank(hi) < 45 && hi < LENGTH) { lo = hi; hi += 24; }
        for (let j = 0; j < 20; j++) { const mid = (lo + hi) / 2; if (distanceToBank(mid) < 45) lo = mid; else hi = mid; }
        return hi;
      };
      return [{ ...p, lane: laneIndex, dx, dy, span: 2 * Math.max(landing(-1), landing(1)) }];
    }
    return [];
  });
}

export function riverOutline(c, river, padding = 0, inner = 0) {
  c.beginPath();
  river.samples.forEach((p, i) => { const y = p.north - padding + (p.y - p.north) * inner; i ? c.lineTo(p.x, y) : c.moveTo(p.x, y); });
  [...river.samples].reverse().forEach(p => c.lineTo(p.x, p.south + padding - (p.south - p.y) * inner)); c.closePath();
}

// Offset ribbons follow the exact bank used by movement and the tactical map.
export function shoreRibbon(c, river, side, from, to) {
  const sign = side === 'north' ? -1 : 1, shelf = side + 'Shelf';
  const point = (p, offset) => [p.x, p[side] + sign * offset(p[shelf], p)];
  c.beginPath();
  river.samples.forEach((p, i) => { const [x, y] = point(p, from); i ? c.lineTo(x, y) : c.moveTo(x, y); });
  for (let i = river.samples.length - 1; i >= 0; i--) c.lineTo(...point(river.samples[i], to));
  c.closePath();
}
