// Winding lane roads. A lane's smooth spline through its knots is pushed sideways by a seeded meander, so the
// road reads as a forest path: unequally spaced, varied-strength bends make broad sweeps and the odd gentle S.
// The meander is fixed for the map (LANE_MEANDER in layout.js), not drawn per match: towers, bots and the minimap
// read one layout, and every match on the same map plays the same roads.
// Only team 0's half is wound. Team 1's half is its exact mirror, so both teams walk the same road.
// The meander fades out at the base court and before the river crossing, and it is damped wherever the road
// would come too close to cover, a camp or a river gate, bend too tightly, squeeze two wards together or grow too long.
const random = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hypot = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const arcs = path => path.reduce((list, p, i) => (list.push(i ? list[i - 1] + hypot(p, path[i - 1]) : 0), list), []);
// Radius of the circle through three points; a straight run is Infinity.
export function bendRadius(a, b, c) {
  const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
  return area < 1e-6 ? Infinity : hypot(a, b) * hypot(b, c) * hypot(c, a) / (4 * area);
}
function pointAt(path, at, d) {
  let i = 1; while (i < path.length - 1 && at[i] < d) i++;
  const a = path[i - 1], b = path[i], t = at[i] > at[i - 1] ? Math.max(0, Math.min(1, (d - at[i - 1]) / (at[i] - at[i - 1]))) : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
// Seeded extrema have different spacing and strength, rather than repeating a fixed wavelength. Joining them
// with a quintic curve keeps both slope and curvature continuous, including where a broad bend turns back.
// wavelength describes a full left/right cycle; adjacent extrema are half that distance apart.
export function meanderWave(seed, length, [shortest, longest]) {
  const rand = random(seed), knots = [];
  let s = -longest * .5 * rand(), sign = rand() < .5 ? -1 : 1;
  while (s < length + longest) {
    knots.push({ s, offset: sign * (.6 + .4 * rand()) });
    s += (shortest + (longest - shortest) * rand()) * .5; sign *= -1;
  }
  return s => {
    let i = 1; while (i < knots.length - 1 && knots[i].s < s) i++;
    const a = knots[i - 1], b = knots[i], t = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s)));
    const u = t * t * t * (t * (t * 6 - 15) + 10);
    return Math.max(-1, Math.min(1, a.offset + (b.offset - a.offset) * u));
  };
}
// half: team 0's half of a lane, from the base to the knot on the river axis (inclusive), sampled densely.
// rules: { seed, amplitude, wavelength: [min, max], calmBase, calmRiver, maxStretch, minBend, clear(p) -> number,
//          stations: [arc from base...], minGap: [gap between station k and k + 1] }
// clear(p) returns how far p is from breaking a placement rule (negative means too close).
export function windHalf(half, rules) {
  const at = arcs(half), length = at.at(-1), wave = meanderWave(rules.seed, length, rules.wavelength);
  // Normals of the unwound spline; the spline is smooth, so they turn smoothly.
  const normal = half.map((p, i) => {
    const a = half[Math.max(0, i - 1)], b = half[Math.min(half.length - 1, i + 1)], n = hypot(a, b) || 1;
    return { x: -(b.y - a.y) / n, y: (b.x - a.x) / n };
  });
  const calm = at.map(s => smooth(rules.calmBase[0], rules.calmBase[1], s) * smooth(rules.calmRiver[0], rules.calmRiver[1], length - s));
  const gain = at.map(() => 1), rawBend = half.map((p, i) => i < 3 || i > half.length - 4 ? Infinity : bendRadius(half[i - 3], p, half[i + 3]));
  const build = scale => half.map((p, i) => { const o = rules.amplitude * scale * calm[i] * gain[i] * wave(at[i]); return { x: p.x + normal[i].x * o, y: p.y + normal[i].y * o }; });
  // Damp the meander around a trouble spot: a smooth dip, so the road straightens gently instead of kinking.
  const damp = (s, width = 360, depth = .3) => { for (let i = 0; i < gain.length; i++) gain[i] *= 1 - depth * Math.exp(-(((at[i] - s) / width) ** 2)); };
  // Every returned candidate must pass the same checks, including the final round and any fallback.
  const inspect = wound => {
    const trouble = [];
    for (let i = 0; i < wound.length; i++) {
      const p = wound[i], clearance = rules.clear(p);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Number.isNaN(clearance) || clearance < 0) trouble.push(at[i]);
      if (i >= 3 && i < wound.length - 3 && bendRadius(wound[i - 3], wound[i], wound[i + 3]) < Math.min(rules.minBend, rawBend[i] * .95)) trouble.push(at[i]);
    }
    const walk = arcs(wound), stations = rules.stations.map(d => pointAt(wound, walk, d));
    for (let k = 0; k + 1 < stations.length; k++) if (hypot(stations[k], stations[k + 1]) < rules.minGap[k]) {
      const a = Math.min(rules.stations[k], rules.stations[k + 1]), b = Math.max(rules.stations[k], rules.stations[k + 1]);
      for (let s = a; s <= b; s += 150) trouble.push(s);
    }
    return { trouble, length: walk.at(-1), valid: !trouble.length && walk.at(-1) <= length * rules.maxStretch };
  };
  let scale = 1, wound, check, rounds = 0, fallback = false;
  for (; rounds < 80; rounds++) {
    wound = build(scale); check = inspect(wound);
    if (check.valid) break;
    if (check.length > length * rules.maxStretch) { scale *= .94; continue; }
    // One dip per stretch of trouble per round, so a long close pass is not flattened all at once.
    let last = -Infinity; for (const s of check.trouble.sort((a, b) => a - b)) if (s - last > 240) { damp(s); last = s; }
  }
  if (!check.valid) {
    fallback = true;
    // An unusually crowded layout can defeat local damping. Reduce the whole offset, then fall back to the
    // original route if needed; never publish the unchecked shape from an exhausted solver.
    for (let attempt = 0; attempt < 32 && !check.valid; attempt++) {
      scale *= .75; wound = build(scale); check = inspect(wound);
    }
    if (!check.valid) { scale = 0; wound = build(scale); check = inspect(wound); }
    if (!check.valid) throw new Error('The original lane cannot satisfy the road placement rules');
  }
  return { path: wound, rounds, scale, gain: Math.min(...gain), length: check.length, unwound: length, valid: true, fallback };
}

