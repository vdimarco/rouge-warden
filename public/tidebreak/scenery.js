import { AREA_SCALE, LENGTH_SCALE, at, mirror } from './arena.js';
import { SIZE, PATHS, BASES, PORTALS, CAMPS, OBSTACLES, CENTER, TOWER_POSITIONS, GUARDIAN_POSITIONS, distance } from './world.js';
import { outsideRiver, riverSample, riverGeometry, riverCrossings } from './river.js';
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
// Land use on the open ground, the same in both realms and mirrored for the two teams: vineyard fields in tilled soil,
// lush meadows, lines of cypress, grey rock outcrops with heath around them and boulders along the stream. It is only
// scenery: no part of it blocks movement or sight.
const inRect = (p, f, margin = 0) => { const dx = p.x - f.x, dy = p.y - f.y, c = Math.cos(f.angle), s = Math.sin(f.angle); return Math.abs(dx * c + dy * s) <= f.w / 2 + margin && Math.abs(-dx * s + dy * c) <= f.h / 2 + margin; };
const fromRect = (f, u, v) => { const c = Math.cos(f.angle), s = Math.sin(f.angle), x = u * f.w / 2, y = v * f.h / 2; return { x: f.x + x * c - y * s, y: f.y + x * s + y * c }; };
const mirrorShape = f => ({ ...f, y: SIZE - f.y, angle: f.angle === undefined ? undefined : -f.angle });
const landUseCache = new Map();
export function makeLandUse(seed) {
  if (landUseCache.has(seed)) return landUseCache.get(seed);
  const rand = sceneryRandom(seed ^ 0x2f6d1), anchors = [...BASES, ...PORTALS, ...CAMPS, CENTER, ...TOWER_POSITIONS.flat(2), ...GUARDIAN_POSITIONS.flat()];
  const crossings = riverCrossings(PATHS, seed), blocked = (p, m) => OBSTACLES.some(set => set.some(b => Math.abs(p.x - b.x) < b.w / 2 + m && Math.abs(p.y - b.y) < b.h / 2 + m));
  // A point is open when it is clear of lanes, water, cover, objectives and the map edge, for this team and the other.
  const open = (p, lane, water, cover, anchor) => [p, mirror(p)].every(q => q.x > 260 && q.x < SIZE - 260 && q.y > 260 && q.y < SIZE - 260
    && laneDistance(q) > lane && outsideRiver(q, seed) > water && !blocked(q, cover) && !anchors.some(a => distance(q, a) < anchor) && !BASES.some(b => distance(q, b) < 1000));
  const fields = [], meadows = [], outcrops = [], cypress = [], stones = [];
  // Vineyards: rotated rectangles cut into rows about 80 units apart. The rows follow the long side.
  for (let tries = 0; tries < 500 && fields.length < 5; tries++) {
    const f = { x: 300 + rand() * (SIZE - 600), y: SIZE / 2 + 500 + rand() * (SIZE / 2 - 800), w: 620 + rand() * 520, h: 380 + rand() * 300, angle: (rand() - .5) * 1.4 };
    if (fields.some(g => distance(f, g) < (Math.max(f.w, f.h) + Math.max(g.w, g.h)) / 2 + 160)) continue;
    let ok = true;
    for (let u = -1; u <= 1 && ok; u += .25) for (let v = -1; v <= 1 && ok; v += .5) ok = open(fromRect(f, u, v), 150, 170, 50, 260);
    if (ok) fields.push(f);
  }
  for (const f of fields) f.rows = Math.max(3, Math.floor(f.h / 80));
  // Meadows: soft open lawns with only a few lone trees.
  for (let tries = 0; tries < 300 && meadows.length < 5; tries++) {
    const m = { x: 300 + rand() * (SIZE - 600), y: SIZE / 2 + 400 + rand() * (SIZE / 2 - 700), rx: 420 + rand() * 420, ry: 320 + rand() * 300, angle: rand() * Math.PI };
    if (!open(m, 260, 220, 120, 300) || fields.some(f => inRect(m, f, 300)) || meadows.some(g => distance(m, g) < g.rx + m.rx)) continue;
    meadows.push(m);
  }
  // Cypress: a line along one long side of each vineyard, and small groups at the lane verges.
  const tree = (p, h) => { if (open(p, 120, 90, 20, 180) && !fields.some(f => inRect(p, f, 40)) && !cypress.some(c => distance(c, p) < 70)) cypress.push({ ...p, height: h }); };
  for (const f of fields) {
    const side = rand() < .5 ? -1 : 1, n = Math.floor(f.w / 120);
    for (let i = 0; i <= n; i++) if (rand() < .85) tree(fromRect({ ...f, h: f.h + 150 }, -1 + 2 * i / n, side), 420 + rand() * 180);
  }
  for (const lane of PATHS) for (let i = 6; i < lane.length - 6; i += 5) {
    if (rand() > .3) continue;
    const a = lane[i], b = lane[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y) || 1, side = rand() < .5 ? -1 : 1, off = 230 + rand() * 120;
    for (let k = 0, n = 1 + Math.floor(rand() * 3); k < n; k++) tree({ x: a.x - (b.y - a.y) / len * off * side + (b.x - a.x) / len * k * 85, y: a.y + (b.x - a.x) / len * off * side + (b.y - a.y) / len * k * 85 }, 380 + rand() * 200);
  }
  // Outcrops: a crown of grey rocks with heath around it.
  for (let tries = 0; tries < 300 && outcrops.length < 6; tries++) {
    const o = { x: 300 + rand() * (SIZE - 600), y: SIZE / 2 + 400 + rand() * (SIZE / 2 - 700), r: 150 + rand() * 170 };
    if (!open(o, 200 + o.r, 160, 60 + o.r, 260) || fields.some(f => inRect(o, f, o.r + 60)) || meadows.some(m => distance(m, o) < m.rx * .8) || outcrops.some(g => distance(g, o) < 900)) continue;
    outcrops.push(o);
  }
  // The stream bed: boulders at the water's edge and a few in the shallows, clear of the crossings and lanes.
  for (let x = 120; x < SIZE - 120; x += 70 + rand() * 120) {
    if (crossings.some(c => Math.abs(c.x - x) < c.span / 2 + 320)) continue;
    const bank = riverSample(x, seed);
    for (const side of [-1, 1]) {
      if (rand() < .45) continue;
      const edge = side < 0 ? bank.north : bank.south, p = { x: x + (rand() - .5) * 60, y: edge - side * (rand() * 70 - 20) };
      if (laneDistance(p) > 230) stones.push({ ...p, size: 30 + rand() * 55 });
    }
  }
  const both = list => [...list, ...list.map(mirrorShape)];
  const use = { fields: both(fields), meadows: both(meadows), cypress: both(cypress), outcrops: both(outcrops), stones };
  landUseCache.set(seed, use); return use;
}
export const inField = (p, use, margin = 30) => use.fields.some(f => inRect(p, f, margin));
export const inMeadow = (p, use) => use.meadows.some(m => { const dx = p.x - m.x, dy = p.y - m.y, c = Math.cos(m.angle), s = Math.sin(m.angle); return ((dx * c + dy * s) / m.rx) ** 2 + ((-dx * s + dy * c) / m.ry) ** 2 < 1; });
export function makeScenery(seed, phase) {
  const rand = sceneryRandom(seed ^ 0x718ac), props = [], patches = [], grid = spacing(), use = makeLandUse(seed);
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
      if (laneDistance(p) < 200 || outsideRiver(p, seed) < 70 || blocked(p) || anchors.some(a => distance(p,a) < 220) || inField(p, use, 230) || use.outcrops.some(o => distance(p, o) < o.r * 2.4) || (inMeadow(p, use) && rand() < .8)) continue;
      const name = pick(grove.plants.filter(n=>!['branch','boulders','ferns','reeds','mushrooms','hollow-log'].includes(n)));
      add({ ...p, name, height: 380 + rand() * 300, flip: rand() < .5, sway: true, biome: grove.name, canopy: true });
    }
  }
  // Infill has a deliberately varied scale; large blank lawns never form a grid. Its count follows the map area.
  for (let i = 0, tries = Math.round(2600 * AREA_SCALE); i < tries; i++) {
    const p = { x: 180 + rand() * (SIZE - 360), y: 180 + rand() * (SIZE - 360) }, d = laneDistance(p), water = outsideRiver(p, seed);
    if (d < 175 || water < 35 || blocked(p) || anchors.some(a => distance(p,a) < 170) || grid.near(p, 85) || inField(p, use) || (inMeadow(p, use) && rand() < .85)) continue;
    const district = districtAt(p), name = water < 150 ? pick(['reeds','reeds','boulders','ferns']) : pick(district.plants);
    const tall = ['willow','oak','birches','juniper','pines','forest-island'].includes(name);
    if (tall && (d < 300 || rand() < .22 || inField(p, use, 230) || use.outcrops.some(o => distance(p, o) < o.r * 2.4))) continue;
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
  return { props: props.filter(p => p.solid || !BASES.some(b => distance(p, b) < 590)), patches, districts: DISTRICTS, seed, phase, river: riverGeometry(seed), landUse: use };
}
