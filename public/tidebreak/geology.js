// Small, deterministic rock meshes in normalized cover coordinates. No renderer or asset loading is needed.
// x/z stay inside [-.5,.5]; y is a height multiplier above the cover's sampled terrace.
const ROCK = new Set(['cliff-ridge', 'rock-shelf', 'ruin-yard']);
export function geologySites(world, phase) {
  return world.OBSTACLES[phase].filter(b => ROCK.has(b.town)).map(b => ({
    id: b.id, x: b.x, z: b.y, w: b.w * .98, d: b.h * .98,
    height: Math.max(760, b.height * 1.75), cave: b.town !== 'cliff-ridge' || b.w > 350,
  }));
}
// The tallest intersected triangle supports trees on the rock roof, including its worn, sloped shelf.
export function rockHeightAt(data, x, z, groundAt = () => 0) {
  let height = -Infinity;
  for (let i = 0; i < data.indices.length; i += 3) {
    const [a, b, c] = Array.from(data.indices.subarray(i, i + 3), index => Array.from(data.positions.subarray(index * 3, index * 3 + 3)));
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(det) < 1e-10) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det, w = 1 - u - v;
    if (Math.min(u, v, w) >= -1e-7) height = Math.max(height, u * (a[1] + groundAt(a[0], a[2])) + v * (b[1] + groundAt(b[0], b[2])) + w * (c[1] + groundAt(c[0], c[2])));
  }
  return Number.isFinite(height) ? height : 0;
}
function builder() {
  const positions = [], colors = [], index = [];
  const triangle = (a, b, c, color = [.62, .66, .63]) => {
    const base = positions.length / 3;
    for (const p of [a, b, c]) { positions.push(...p); colors.push(...color); }
    index.push(base, base + 1, base + 2);
  };
  const quad = (a, b, c, d, color) => { triangle(a, b, c, color); triangle(a, c, d, color); };
  return { triangle, quad, done: () => ({ positions: new Float32Array(positions), colors: new Float32Array(colors), indices: new Uint16Array(index) }) };
}
const STRATA = [[.65, .68, .65], [.48, .54, .53], [.72, .72, .65], [.55, .61, .59], [.69, .7, .62], [.48, .57, .43]];
export function cliffGeometry() {
  const b = builder(), outline = [[-.5, -.32], [-.32, -.5], [.3, -.5], [.5, -.27], [.48, .34], [.25, .5], [-.34, .48], [-.5, .19]];
  const rings = [0, .12, .29, .47, .65, .83, 1].map((y, level) => outline.map(([x, z], i) => {
    const taper = 1 - level * .027, ledge = level % 2 ? .035 : -.012;
    const width = Math.min(1, taper + ledge);
    return [x * width, y * (1 + Math.sin(i * 2.13 + level * .6) * .035), z * width];
  }));
  for (let level = 0; level < rings.length - 1; level++) for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    b.quad(rings[level][i], rings[level + 1][i], rings[level + 1][j], rings[level][j], STRATA[level]);
  }
  const top = rings.at(-1);
  for (let i = 0; i < outline.length; i++) b.triangle([0, .98, 0], top[(i + 1) % outline.length], top[i], [.42, .53, .34]);
  return b.done();
}
// A horseshoe profile has vertical sides and a curved roof. The entrance remains open down to its floor.
function profile(width, spring, rise) {
  const p = [[-width, 0]];
  for (let i = 0; i <= 12; i++) { const angle = Math.PI - i / 12 * Math.PI; p.push([Math.cos(angle) * width, spring + Math.sin(angle) * rise]); }
  p.push([width, 0]); return p;
}
export function caveGeometry() {
  const shell = builder(), inside = builder(), floor = builder(), rear = builder();
  const outer = profile(.5, .26, .74), inner = profile(.29, .2, .43);
  const front = inner.map(([x, y]) => [x, y, .5]);
  const back = inner.map(([x, y]) => [x * .73, y * .81, -.44]);
  const rings = [0, 1, 2, 3, 4].map(level => outer.map(([x, y], i) => {
    const taper = 1 - level * .023, worn = y > .3 ? Math.sin(i * 2.1 + level) * .018 : 0;
    return [x * taper, y * (taper + worn), .5 - level * .25];
  }));
  for (let i = 0; i < outer.length - 1; i++) {
    shell.quad(rings[0][i], front[i], front[i + 1], rings[0][i + 1], STRATA[Math.min(4, Math.floor(outer[i][1] * 5))]);
    inside.quad(front[i], back[i], back[i + 1], front[i + 1], [.57, .61, .57]);
    rear.triangle([0, .22, -.445], back[i + 1], back[i], [.1, .12, .12]);
    for (let level = 0; level < rings.length - 1; level++) shell.quad(rings[level][i], rings[level][i + 1], rings[level + 1][i + 1], rings[level + 1][i], STRATA[level]);
    // The outside back seals the bluff without moving the entrance's dark rear forward.
    shell.triangle([0, .42, -.5], rings[4][i + 1], rings[4][i], STRATA[1]);
  }
  rear.triangle([0, .22, -.445], back[0], back.at(-1), [.1, .12, .12]);
  shell.triangle([0, .42, -.5], rings[4].at(-1), rings[4][0], STRATA[1]);
  // Small floor triangles follow the terrain grid through the shared height shader without bridging a whole hollow.
  const rows = 24, cols = 16;
  const floorPoint = (col, row) => { const t = row / rows; return [(col / cols * 2 - 1) * .29 * (1 - t * .27), .004, .5 - t * .94]; };
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) floor.quad(floorPoint(col, row), floorPoint(col + 1, row), floorPoint(col + 1, row + 1), floorPoint(col, row + 1), [.55, .55, .47]);
  // Short stalactites frame the arch while the middle stays clear.
  for (const [x, y, z, length] of [[-.19, .56, .35, .16], [.17, .59, .26, .19], [-.08, .52, -.23, .1]]) {
    const r = .035, tip = [x, y - length, z];
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, c = (i + 1) / 5 * Math.PI * 2; shell.triangle([x + Math.cos(a) * r, y, z + Math.sin(a) * r], tip, [x + Math.cos(c) * r, y, z + Math.sin(c) * r], STRATA[2]); }
  }
  return { shell: shell.done(), inside: inside.done(), floor: floor.done(), rear: rear.done(), opening: { width: .58, height: .63, depth: .94 } };
}
