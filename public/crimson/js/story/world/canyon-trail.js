export const CANYON_TRAIL = Object.freeze([
  [395, -585], [338, -592], [316, -565], [337, -545], [312, -525], [365, -504], [417, -510],
].map(point => Object.freeze(point)));

export function trailSample(x, z) {
  let best = { distance: Infinity, along: 0, length: 0 };
  let length = 0;
  for (let index = 1; index < CANYON_TRAIL.length; index++) {
    const start = CANYON_TRAIL[index - 1], end = CANYON_TRAIL[index];
    const dx = end[0] - start[0], dz = end[1] - start[1], span = Math.hypot(dx, dz);
    const fraction = Math.max(0, Math.min(1, ((x - start[0]) * dx + (z - start[1]) * dz) / (span * span)));
    const distance = Math.hypot(x - start[0] - dx * fraction, z - start[1] - dz * fraction);
    if (distance < best.distance) best = { distance, along: length + span * fraction };
    length += span;
  }
  best.length = length;
  return best;
}
