const LENGTH = 4800, STEP = 24, cache = new Map();
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
    .map(([x, y]) => ({ x, y: y + (rand() - .5) * (x > 1700 && x < 2600 ? 90 : 210), width: 65 + rand() * 47 }));
  const pools = [
    { x: 1000 + rand() * 340, radius: 210 + rand() * 110, extra: 45 + rand() * 34 },
    { x: 3070 + rand() * 430, radius: 250 + rand() * 100, extra: 44 + rand() * 35 },
  ];
  const samples = [];
  for (let x = 0; x <= LENGTH; x += STEP) {
    const y = spline(knots, x, 'y'), width = spline(knots, x, 'width') + pools.reduce((n, p) => n + Math.exp(-(((x - p.x) / p.radius) ** 2)) * p.extra, 0);
    // Independent banks make bends, coves and sand shelves asymmetric.
    const north = y - width * (.86 + Math.sin(x * .0043 + phase) * .13) - Math.sin(x * .021 + phase) * 7;
    const south = y + width * (1.04 + Math.cos(x * .0051 + phase) * .18) + Math.sin(x * .017 - phase) * 9;
    samples.push({ x, y, north, south });
  }
  const river = { seed, samples, pools }; cache.set(seed, river);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return river;
}
export function riverSample(x, seed = 49) {
  const { samples } = riverGeometry(seed), at = clamp(x / STEP, 0, samples.length - 1), i = Math.floor(at), t = at - i;
  const a = samples[i], b = samples[Math.min(i + 1, samples.length - 1)];
  return { x, y: a.y + (b.y - a.y) * t, north: a.north + (b.north - a.north) * t, south: a.south + (b.south - a.south) * t, slope: (b.y - a.y) / STEP };
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
      const p = at((low + high) / 2), bank = riverSample(p.x, seed), length = Math.hypot(a.x - b.x, a.y - b.y), dx = (a.x - b.x) / length, dy = (a.y - b.y) / length;
      return [{ ...p, lane: laneIndex, dx, dy, span: (bank.south - bank.north) / Math.max(.6, Math.abs(dy)) + 95 }];
    }
    return [];
  });
}

export function riverOutline(c, river, padding = 0, inner = 0) {
  c.beginPath();
  river.samples.forEach((p, i) => { const y = p.north - padding + (p.y - p.north) * inner; i ? c.lineTo(p.x, y) : c.moveTo(p.x, y); });
  [...river.samples].reverse().forEach(p => c.lineTo(p.x, p.south + padding - (p.south - p.y) * inner)); c.closePath();
}
