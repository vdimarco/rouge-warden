// One sampled landscape drives the ground mesh, CPU grounding and GPU ground decals. Gameplay remains planar.
// The geometry is mirrored about the arena axis, including the triangle diagonals: mirroring only the vertices
// leaves different interpolated heights on either side of a sloping quad.
import { riverSample, riverCrossings } from './river.js';

export const RELIEF_SEGMENTS = 192, RELIEF_MARGIN = 5200;
const MAP_SEED = 0x43b719, BUCKET = 720;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash(x, y, salt = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ MAP_SEED ^ salt;
  h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295;
}
function noise(x, y, scale, salt) {
  x /= scale; y /= scale;
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(0, 1, x - ix), fy = smooth(0, 1, y - iy);
  const a = hash(ix, iy, salt), b = hash(ix + 1, iy, salt), c = hash(ix, iy + 1, salt), d = hash(ix + 1, iy + 1, salt);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
function landform(x, z, size) {
  z = Math.abs(z - size / 2);
  const broad = noise(x + 1370, z + 780, 1900, 0) * 330;
  const hills = noise(x - 520, z + 1910, 790, 731) * 165;
  const ridge = 1 - Math.abs(noise(x + 3010, z - 910, 1050, 1511) * 2 - 1);
  const rock = ridge ** 5 * 165;
  const folds = (noise(x, z, 340, 3761) - .5) * 42;
  return clamp(22 + broad + hills + rock + folds - 120, -22, 590);
}
const segmentDistance = (x, z, a, b) => {
  const dx = b.x - a.x, dz = b.y - a.y, t = clamp(((x - a.x) * dx + (z - a.y) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(x - a.x - dx * t, z - a.y - dz * t);
};
// Only construction consults road geometry. No actor/frame walks a lane to find its elevation.
function roadIndex(paths, reach) {
  const buckets = new Map(), key = (x, z) => `${x},${z}`;
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    for (let z = Math.floor((Math.min(a.y, b.y) - reach) / BUCKET); z <= Math.floor((Math.max(a.y, b.y) + reach) / BUCKET); z++) {
      for (let x = Math.floor((Math.min(a.x, b.x) - reach) / BUCKET); x <= Math.floor((Math.max(a.x, b.x) + reach) / BUCKET); x++) {
        const k = key(x, z); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push([a, b]);
      }
    }
  }
  return (x, z) => {
    let distance = Infinity;
    for (const [a, b] of buckets.get(key(Math.floor(x / BUCKET), Math.floor(z / BUCKET))) || []) distance = Math.min(distance, segmentDistance(x, z, a, b));
    return distance;
  };
}
function padsFor(world, state, cell) {
  const pads = [], zero = (p, inner, outer) => pads.push({ x: p.x, z: p.y, rx: inner, rz: inner, reach: outer, height: 0 });
  for (const p of world.BASES) pads.push({ x: p.x, z: p.y, rx: 810, rz: 710, reach: 1550, height: 0 });
  for (const unit of state.units || []) if (unit.kind === 'tower') zero(unit, (unit.guardian || unit.tier >= 3 ? 255 : 210) + cell * 1.5, 1120);
  // Towers may not yet exist when a standalone renderer/map builds the field.
  if (!(state.units || []).some(e => e.kind === 'tower')) {
    for (const team of world.TOWER_POSITIONS || []) for (const lane of team) for (const p of lane) zero(p, 210 + cell * 1.5, 1120);
    for (const team of world.GUARDIAN_POSITIONS || []) for (const p of team) zero(p, 255 + cell * 1.5, 1120);
  }
  for (const p of world.PORTALS) zero(p, 190 + cell * 1.5, 1090);
  for (const p of world.CAMPS) zero(p, 290 + cell * 1.5, 1190);
  return pads;
}
function padWeight(p, x, z) {
  // Circular distance outside an elliptical level pad gives a smooth, bounded transition.
  const normalized = Math.hypot((x - p.x) / p.rx, (z - p.z) / p.rz);
  const d = Math.max(0, normalized - 1) * Math.min(p.rx, p.rz);
  return 1 - smooth(0, p.reach - Math.min(p.rx, p.rz), d);
}

export function buildRelief(world, state = {}, { segments = RELIEF_SEGMENTS, margin = RELIEF_MARGIN } = {}) {
  if (segments < 4 || segments % 2) throw new RangeError('Relief requires an even number of segments.');
  const size = world.SIZE, origin = -margin, span = size + margin * 2, resolution = segments + 1, cell = span / segments;
  const heights = new Float32Array(resolution * resolution), vertices = new Float32Array(heights.length * 3);
  const IndexArray = heights.length <= 65535 ? Uint16Array : Uint32Array, indices = new IndexArray(segments * segments * 6);
  const laneCore = 160 + cell * Math.SQRT2, laneOuter = laneCore + 700;
  const distanceToRoad = roadIndex(world.PATHS, laneOuter), pads = padsFor(world, state, cell);
  const rockPads = (world.OBSTACLES?.[0] || []).map(p => ({ x: p.x, z: p.y, rx: p.w * .56 + cell, rz: p.h * .56 + cell, reach: Math.max(p.w, p.h) * .7 + cell * 2 + 500, height: landform(p.x, p.y, size) }));
  const seed = state.seed ?? 49, banks = [];
  const approaches = riverCrossings(world.PATHS, seed).flatMap(b => {
    const p = { x: b.x, z: b.y, dx: b.dx, dz: b.dy, half: (b.span * 1.08 + 60) / 2 };
    return [p, { ...p, z: size - p.z, dz: -p.dz }];
  });
  for (let x = 0; x <= segments; x++) banks.push(riverSample(clamp(origin + x * cell, 0, size), seed));
  let minimum = Infinity, maximum = -Infinity, landMin = Infinity, landMax = -Infinity;
  for (let row = 0; row <= segments / 2; row++) {
    const z = origin + row * cell;
    for (let col = 0; col <= segments; col++) {
      const x = origin + col * cell;
      let h = landform(x, z, size);
      // Structures sit on small terraces; the surrounding land retains the broader hill shape.
      for (const p of rockPads) { const w = padWeight(p, x, z); h += (p.height - h) * w; }
      // Accessible routes and important combat pads taper down into low, readable valleys.
      const road = Math.min(distanceToRoad(x, z), distanceToRoad(x, size - z));
      h *= smooth(laneCore, laneOuter, road);
      let level = 0; for (const p of pads) level = Math.max(level, padWeight(p, x, z), padWeight(p, x, size - z));
      h *= 1 - level;
      // The live banks are intentionally asymmetric. Carving their mirrored union preserves fair relief and keeps
      // every triangle beneath the real water. A little extra bed width covers interpolation at the bank edges.
      const b = banks[col], bank = Math.min(Math.max(b.north - z, z - b.south), Math.max(b.north - (size - z), (size - z) - b.south));
      const end = 1 - smooth(size, size + 800, Math.max(x, size - x));
      const bedCore = cell * .8, bankBlend = smooth(bedCore, bedCore + 620, bank);
      const bed = -42 - (1 - smooth(-150, 0, bank)) * 20;
      const riverWeight = end * (1 - bankBlend);
      h += (bed - h) * riverWeight;
      // Dry defensive pads remain level even where their broad taper meets the bank's taper.
      if (bank > bedCore) h *= 1 - level;
      // A lane lands on dry, low ground at each bridge; keep the river bed below the deck itself.
      if (bank > 0) h *= smooth(laneCore, laneOuter, road);
      // The two asymmetrical live bank landings also share their mirrored pads. A mesh-sized collar avoids a
      // depression underneath a deck end when the opposite bank happens to lie farther from the river axis.
      let landing = 0;
      for (const p of approaches) {
        const dx = x - p.x, dz = z - p.z, along = Math.abs(dx * p.dx + dz * p.dz), across = Math.abs(dx * p.dz - dz * p.dx);
        const width = 160 + cell, longitudinal = Math.abs(along - p.half - 100);
        landing = Math.max(landing, (1 - smooth(width, width + 220, across)) * (1 - smooth(250, 500, longitudinal)));
      }
      h *= 1 - landing;
      heights[row * resolution + col] = heights[(segments - row) * resolution + col] = h;
      const sample = heights[row * resolution + col];
      minimum = Math.min(minimum, sample); maximum = Math.max(maximum, sample);
      if (x >= 0 && x <= size && z >= 0 && z <= size && bank > bedCore + 620 && road > laneOuter) { landMin = Math.min(landMin, sample); landMax = Math.max(landMax, sample); }
    }
  }
  for (let row = 0; row <= segments; row++) for (let col = 0; col <= segments; col++) {
    const i = row * resolution + col; vertices.set([origin + col * cell, heights[i], origin + row * cell], i * 3);
  }
  let maxSlope = 0;
  for (let row = 0, offset = 0; row < segments; row++) for (let col = 0; col < segments; col++) {
    const a = row * resolution + col, b = a + 1, c = a + resolution, d = c + 1;
    // Both patterns are counter-clockwise from above; south uses the reflection of north's diagonal.
    indices.set(row < segments / 2 ? [a, c, b, b, c, d] : [a, c, d, a, d, b], offset); offset += 6;
    const ab = (heights[b] - heights[a]) / cell, ac = (heights[c] - heights[a]) / cell;
    const cd = (heights[d] - heights[c]) / cell, bd = (heights[d] - heights[b]) / cell;
    maxSlope = Math.max(maxSlope, ...(row < segments / 2 ? [Math.hypot(ab, ac), Math.hypot(cd, bd)] : [Math.hypot(cd, ac), Math.hypot(ab, bd)]));
  }
  const relief = { size, origin, span, segments, resolution, cell, heights, vertices, indices, laneCore, laneOuter, min: minimum, max: maximum, minHeight: minimum, maxHeight: maximum, landMin, landMax, maxSlope };
  relief.heightAt = (x, z) => heightAt(relief, x, z);
  return relief;
}

// Match barycentric interpolation of the actual mesh, rather than bilinear interpolation of the four heights.
export function heightAt(field, x, z) {
  const { origin, span, segments, resolution, heights } = field;
  const gx = clamp((x - origin) / span * segments, 0, segments), gz = clamp((z - origin) / span * segments, 0, segments);
  const col = Math.min(segments - 1, Math.floor(gx)), row = Math.min(segments - 1, Math.floor(gz));
  const u = gx - col, v = gz - row, i = row * resolution + col;
  const a = heights[i], b = heights[i + 1], c = heights[i + resolution], d = heights[i + resolution + 1];
  if (row < segments / 2) return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d);
  return v >= u ? a + v * (c - a) + u * (d - c) : a + u * (b - a) + v * (d - b);
}

// Nearest texel sampling works in a vertex shader on WebGL2 and makes decals agree with CPU/mesh triangulation.
// Supply Terrain.heightUniforms to every material that uses this snippet. Signed world height lives in red.
export const TERRAIN_HEIGHT_GLSL = `
uniform sampler2D uTerrainHeight;
uniform vec2 uTerrainOrigin;
uniform float uTerrainSpan, uTerrainSegments;
float terrainHeightAt( vec2 worldXZ ) {
  vec2 p = clamp( ( worldXZ - uTerrainOrigin ) / uTerrainSpan * uTerrainSegments, 0., uTerrainSegments );
  vec2 cell = min( floor( p ), vec2( uTerrainSegments - 1. ) ), f = p - cell;
  float texels = uTerrainSegments + 1.;
  float a = texture2D( uTerrainHeight, ( cell + .5 ) / texels ).r;
  float b = texture2D( uTerrainHeight, ( cell + vec2( 1.5, .5 ) ) / texels ).r;
  float c = texture2D( uTerrainHeight, ( cell + vec2( .5, 1.5 ) ) / texels ).r;
  float d = texture2D( uTerrainHeight, ( cell + 1.5 ) / texels ).r;
  if ( cell.y < uTerrainSegments * .5 ) return f.x + f.y <= 1. ? a + f.x * ( b - a ) + f.y * ( c - a ) : d + ( 1. - f.x ) * ( c - d ) + ( 1. - f.y ) * ( b - d );
  return f.y >= f.x ? a + f.y * ( c - a ) + f.x * ( d - c ) : a + f.x * ( b - a ) + f.y * ( d - b );
}`;
