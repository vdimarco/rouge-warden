import { AREA_SCALE, LENGTH_SCALE, at, mirror } from './arena.js';
import { SIZE, PATHS, BASES, PORTALS, CAMPS, OBSTACLES, CENTER, TOWER_POSITIONS, GUARDIAN_POSITIONS, distance } from './world.js';
import { outsideRiver, riverSample, riverGeometry } from './river.js';
import { DISTRICT_SPOTS, NORTH_DISTRICTS, LANDMARK_SPOTS, GROVE_SPOTS } from './layout.js';
export const LANDFORMS = ['cliff-ridge', 'root-arch', 'ruin-yard', 'mill-yard', 'rock-shelf', 'forest-island'];
export const LANDMARKS = ['observatory', 'mill', 'market', 'abbey', 'hollow-log', 'greenhouse', 'shrine', 'ivy-wall', 'pier'];
export const PLANTS = ['willow', 'oak', 'birches', 'mushrooms', 'ferns', 'juniper', 'reeds', 'boulders', 'branch'];
export const sceneryRandom = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
// Lane segments are grouped in chunks with bounding boxes, so far chunks are skipped.
const LANE_CHUNKS = PATHS.flatMap(lane => Array.from({ length: Math.ceil((lane.length - 1) / 12) }, (_, c) => {
  const points = lane.slice(c * 12, c * 12 + 13), xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { points, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}));
export function laneDistance(p) {
  let best = Infinity;
  for (const chunk of LANE_CHUNKS) {
    if (Math.hypot(Math.max(0, chunk.x0 - p.x, p.x - chunk.x1), Math.max(0, chunk.y0 - p.y, p.y - chunk.y1)) >= best) continue;
    const lane = chunk.points;
    for (let i = 1; i < lane.length; i++) {
      const a = lane[i - 1], b = lane[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
    }
  }
  return best;
}
// The north half mirrors the southern shapes with its own ground and plants.
const district = (d, p) => ({ ...d, ...p, rx: d.rx * SIZE, ry: d.ry * SIZE });
export const DISTRICTS = [
  ...DISTRICT_SPOTS.map(d => district(d, at(d.x, d.y))),
  ...DISTRICT_SPOTS.map((d, i) => ({ ...district(d, mirror(at(d.x, d.y))), ...NORTH_DISTRICTS[i], angle: -d.angle })),
];
export function districtAt(p) { return DISTRICTS.reduce((best, d) => {
  const n = ((p.x - d.x) / d.rx) ** 2 + ((p.y - d.y) / d.ry) ** 2;
  return n < best.n ? { d, n } : best;
}, { d: DISTRICTS[0], n: Infinity }).d; }
// A coarse grid answers spacing questions without testing every placed prop.
function spacing() {
  const cells = new Map(), size = 100, key = (x, y) => `${Math.floor(x / size)},${Math.floor(y / size)}`;
  return {
    add(p) { const k = key(p.x, p.y); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(p); },
    near(p, r) {
      for (let x = Math.floor((p.x - r) / size); x <= Math.floor((p.x + r) / size); x++) for (let y = Math.floor((p.y - r) / size); y <= Math.floor((p.y + r) / size); y++)
        for (const q of cells.get(`${x},${y}`) || []) if (distance(p, q) < r) return true;
      return false;
    },
  };
}
export function makeScenery(seed, phase) {
  const rand = sceneryRandom(seed ^ 0x718ac), props = [], patches = [], grid = spacing();
  const add = prop => { props.push(prop); grid.add(prop); };
  const pick = a => a[Math.floor(rand() * a.length)];
  const anchors = [...BASES, ...PORTALS, ...CAMPS, CENTER, ...TOWER_POSITIONS.flat(2), ...GUARDIAN_POSITIONS.flat()];
  const blocked = p => OBSTACLES[phase].some(b => Math.abs(p.x - b.x) < b.w / 2 + 28 && Math.abs(p.y - b.y) < b.h / 2 + 28);
  for (const b of OBSTACLES[phase]) {
    const name = phase ? b.woods : b.town, foot = b.y + b.h * .35;
    add({ name, x: b.x, y: foot, height: b.height * (.95 + rand() * .1), flip: false, sway: ['willow','oak','juniper'].includes(name), solid: true, biome: b.biome, id: b.id });
    // Place supporting details in uneven crescents around the main landmark.
    for (let i = 0; i < 7; i++) {
      const angle = rand() * Math.PI * 2, radius = 180 + rand() * 180, p = { x: b.x + Math.cos(angle) * radius, y: b.y + Math.sin(angle) * radius * .65 };
      if (laneDistance(p) < 165 || outsideRiver(p, seed) < 30 || blocked(p) || anchors.some(a => distance(p, a) < 160)) continue;
      add({ ...p, name: pick(['ferns','mushrooms','boulders','branch']), height: 80 + rand() * 100, flip: rand() < .5, sway: i % 3 === 0, biome: b.biome });
    }
  }
  // A village yard is framed by varied buildings; the north half has its own mirrored landmarks.
  for (const [name, x, y, h] of LANDMARK_SPOTS) for (const north of [false, true]) {
    const p = north ? mirror(at(x, y)) : at(x, y); if (laneDistance(p) < 190 || blocked(p)) continue;
    add({ name: phase && name.startsWith('house') ? 'hollow-log' : name, ...p, height: h, flip: north, biome: districtAt(p).name });
  }
  // Coherent groves use clusters with clearings. Distant canopy closes the world edge.
  for (const [x, y, r] of GROVE_SPOTS) for (const north of [false, true]) {
    const { x: gx, y: gy } = north ? mirror(at(x, y)) : at(x, y), radius = r * SIZE;
    const grove = districtAt({x:gx,y:gy});
    for (let j = 0; j < 30; j++) {
      const angle = rand() * Math.PI * 2, radiusAt = Math.sqrt(rand()) * radius, p = { x: gx + Math.cos(angle) * radiusAt, y: gy + Math.sin(angle) * radiusAt };
      if (laneDistance(p) < 200 || outsideRiver(p, seed) < 70 || blocked(p) || anchors.some(a => distance(p,a) < 220)) continue;
      const name = pick(grove.plants.filter(n=>!['branch','boulders','ferns','reeds','mushrooms','hollow-log'].includes(n)));
      add({ ...p, name, height: 380 + rand() * 300, flip: rand() < .5, sway: true, biome: grove.name, canopy: true });
    }
  }
  // Infill has a deliberately varied scale; large blank lawns never form a grid. Its count follows the map area.
  for (let i = 0, tries = Math.round(2600 * AREA_SCALE); i < tries; i++) {
    const p = { x: 180 + rand() * (SIZE - 360), y: 180 + rand() * (SIZE - 360) }, d = laneDistance(p), water = outsideRiver(p, seed);
    if (d < 175 || water < 35 || blocked(p) || anchors.some(a => distance(p,a) < 170) || grid.near(p, 85)) continue;
    const district = districtAt(p), name = water < 150 ? pick(['reeds','reeds','boulders','ferns']) : pick(district.plants);
    const tall = ['willow','oak','birches','juniper','pines','forest-island'].includes(name);
    if (tall && (d < 300 || rand() < .22)) continue;
    add({ ...p, name, height: tall ? 340 + rand() * 280 : 65 + rand() * 115, flip: rand() < .5, sway: ['reeds','ferns','willow','birches'].includes(name), biome: district.name, canopy: tall });
  }
  // Unequal reed beds leave exposed sand between them and avoid crossings.
  for (let i = 0, beds = Math.round(24 * LENGTH_SCALE); i < beds; i++) {
    const center = 80 + rand() * (SIZE - 160), side = rand() < .5 ? 'north' : 'south';
    const spread = 36 + rand() * 115, count = 2 + Math.floor(rand() * 5);
    for (let j = 0; j < count; j++) {
      const x = Math.max(0, Math.min(SIZE, center + (rand() - .5) * spread * 2)), bank = riverSample(x, seed);
      const p = { x, y: side === 'north' ? bank.north - 8 - rand() * 65 : bank.south + 8 + rand() * 65 };
      if (laneDistance(p) < 180 || blocked(p) || grid.near(p, 32)) continue;
      const name = pick(['reeds', 'reeds', 'ferns', 'boulders']);
      add({ ...p, name, height: 48 + rand() * 92, flip: rand() < .5, sway: name !== 'boulders', biome: 'wetland', shoreline: true });
    }
  }
  for (let i = 0, count = Math.round(220 * AREA_SCALE); i < count; i++) patches.push({ x: rand() * SIZE, y: rand() * SIZE, r: 90 + rand() * 270, hue: rand(), angle: rand() * Math.PI });
  return { props: props.filter(p => p.solid || !BASES.some(b => distance(p, b) < 590)), patches, districts: DISTRICTS, seed, phase, river: riverGeometry(seed) };
}
