// Surface queries shared by 3D input, actors and effects. Simulation coordinates remain planar.
export const BRIDGE_DECK = 12;
// Bilinear alpha sampling matches the un-mipmapped river mask used by ground effects on the GPU. A lowered dry
// hollow must keep its own height; only the live river surface lifts a warning to the water level.
export function waterMaskAt(mask, x, z) {
  if (!mask || x < 0 || z < 0 || x > mask.world || z > mask.world) return false;
  const gx = x / mask.world * mask.size - .5, gz = z / mask.world * mask.size - .5;
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
  const alpha = (col, row) => mask.data[(Math.max(0, Math.min(mask.size - 1, row)) * mask.size + Math.max(0, Math.min(mask.size - 1, col))) * 4 + 3];
  const a = alpha(ix, iz), b = alpha(ix + 1, iz), c = alpha(ix, iz + 1), d = alpha(ix + 1, iz + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v > 127.5;
}

export function bridgeSurface(bridges, x, z, height) {
  for (const b of bridges || []) {
    const px = x - b.x, pz = z - b.y;
    if (Math.abs(px * b.dx + pz * b.dy) <= (b.span * 1.08 + 60) / 2 && Math.abs(-px * b.dy + pz * b.dx) <= 135) height = Math.max(height, BRIDGE_DECK);
  }
  return height;
}

// Walk only the grid cells crossed by the ray, testing their two actual mesh triangles in order. Fixed-distance
// samples can skip a grazing enter/exit pair at a ridge; cell traversal retains the first contact without scanning
// the whole landscape. Float32 vertex positions also keep picking identical to the rendered geometry.
export function intersectRelief(ray, relief) {
  if (!relief || ray.direction.y >= -1e-6) return null;
  const o = ray.origin, d = ray.direction, { vertices, indices, segments, resolution } = relief;
  let low = Math.max(0, (relief.maxHeight - o.y) / d.y), high = (relief.minHeight - o.y) / d.y;
  const bounds = [['x', vertices[0], vertices[segments * 3]], ['z', vertices[2], vertices[(segments * resolution) * 3 + 2]]];
  for (const [axis, from, to] of bounds) {
    if (d[axis] === 0) { if (o[axis] < from || o[axis] > to) return null; }
    else { const a = (from - o[axis]) / d[axis], b = (to - o[axis]) / d[axis]; low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b)); }
  }
  if (high < low) return null;

  const xAt = col => vertices[col * 3], zAt = row => vertices[row * resolution * 3 + 2];
  // Binary search the real grid boundaries: their Float32 rounding can differ slightly from origin + cell * index.
  const cellAt = (coordinate, direction, at) => {
    let a = 0, b = segments;
    while (a < b) { const middle = (a + b + 1) >> 1; if (at(middle) <= coordinate) a = middle; else b = middle - 1; }
    if (direction < 0 && coordinate === at(a)) a--;
    return Math.max(0, Math.min(segments - 1, a));
  };
  let col = cellAt(o.x + d.x * low, d.x, xAt), row = cellAt(o.z + d.z * low, d.z, zAt);
  const stepX = Math.sign(d.x), stepZ = Math.sign(d.z), epsilon = 1e-8;
  const triangleHit = (offset, from, to) => {
    const a = indices[offset] * 3, b = indices[offset + 1] * 3, c = indices[offset + 2] * 3;
    const ax = vertices[a], ay = vertices[a + 1], az = vertices[a + 2];
    const e1x = vertices[b] - ax, e1y = vertices[b + 1] - ay, e1z = vertices[b + 2] - az;
    const e2x = vertices[c] - ax, e2y = vertices[c + 1] - ay, e2z = vertices[c + 2] - az;
    const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
    const determinant = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(determinant) < 1e-12) return Infinity;
    const inv = 1 / determinant, tx = o.x - ax, ty = o.y - ay, tz = o.z - az;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < -epsilon || u > 1 + epsilon) return Infinity;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (d.x * qx + d.y * qy + d.z * qz) * inv;
    if (v < -epsilon || u + v > 1 + epsilon) return Infinity;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return t >= Math.max(0, from - epsilon) && t <= to + epsilon ? t : Infinity;
  };
  // A rectangular grid crosses at most segments boundaries on each axis. Corner crossings advance both axes.
  for (let visited = 0; visited <= segments * 2 && col >= 0 && col < segments && row >= 0 && row < segments; visited++) {
    const nextX = stepX ? (xAt(col + (stepX > 0 ? 1 : 0)) - o.x) / d.x : Infinity;
    const nextZ = stepZ ? (zAt(row + (stepZ > 0 ? 1 : 0)) - o.z) / d.z : Infinity;
    const exit = Math.min(high, nextX, nextZ), offset = (row * segments + col) * 6;
    const t = Math.min(triangleHit(offset, low, exit), triangleHit(offset + 3, low, exit));
    if (Number.isFinite(t)) return { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t };
    if (exit >= high) break;
    if (nextX <= nextZ) col += stepX;
    if (nextZ <= nextX) row += stepZ;
    low = exit;
  }
  return null;
}
