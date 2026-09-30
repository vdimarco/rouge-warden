import { SIZE, PATHS, BASES, PORTALS, CAMPS, OBSTACLES, distance } from './world.js';
import { outsideRiver, riverSample, riverGeometry } from './river.js';
export const LANDFORMS = ['cliff-ridge', 'root-arch', 'ruin-yard', 'mill-yard', 'rock-shelf', 'forest-island'];
export const LANDMARKS = ['observatory', 'mill', 'market', 'abbey', 'hollow-log', 'greenhouse', 'shrine', 'ivy-wall', 'pier'];
export const PLANTS = ['willow', 'oak', 'birches', 'mushrooms', 'ferns', 'juniper', 'reeds', 'boulders', 'branch'];
export const sceneryRandom = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
export function laneDistance(p) {
  let best = Infinity;
  for (const lane of PATHS) for (let i = 1; i < lane.length; i++) {
    const a = lane[i - 1], b = lane[i], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}
// Districts have different ground, density, architecture and canopy silhouettes.
export const DISTRICTS = [
  { name: 'Sunken Abbey', x: 1490, y: 1480, rx: 1010, ry: 1070, angle: -.3, material: 3, color: '#a29c75', plants: ['birches','boulders','oak','branch'] },
  { name: 'Millwater', x: 1550, y: 2810, rx: 900, ry: 880, angle: .35, material: 1, color: '#af9873', plants: ['birches','ferns','reeds','hollow-log','willow'] },
  { name: 'Briarwood', x: 3180, y: 2980, rx: 1090, ry: 1160, angle: -.4, material: 0, color: '#385958', plants: ['forest-island','pines','juniper','ferns','mushrooms','hollow-log'] },
  { name: 'Splitstone Rise', x: 3420, y: 1450, rx: 820, ry: 950, angle: .4, material: 0, color: '#979976', plants: ['boulders','birches','juniper','branch'] },
];
export function districtAt(p) { return DISTRICTS.reduce((best, d) => {
  const n = ((p.x - d.x) / d.rx) ** 2 + ((p.y - d.y) / d.ry) ** 2;
  return n < best.n ? { d, n } : best;
}, { d: DISTRICTS[0], n: Infinity }).d; }
export function makeScenery(seed, phase) {
  const rand = sceneryRandom(seed ^ 0x718ac), props = [], patches = [];
  const pick = a => a[Math.floor(rand() * a.length)];
  const anchors = [...BASES, ...PORTALS, ...CAMPS, { x: 2400, y: 2400 }];
  const blocked = p => OBSTACLES[phase].some(b => Math.abs(p.x - b.x) < b.w / 2 + 28 && Math.abs(p.y - b.y) < b.h / 2 + 28);
  for (const b of OBSTACLES[phase]) {
    const name = phase ? b.woods : b.town, foot = b.y + b.h * .35;
    props.push({ name, x: b.x, y: foot, height: b.height * (.95 + rand() * .1), flip: false, sway: ['willow','oak','juniper'].includes(name), solid: true, biome: b.biome, id: b.id });
    // Place supporting details in uneven crescents around the main landmark.
    for (let i = 0; i < 7; i++) {
      const angle = rand() * Math.PI * 2, radius = 180 + rand() * 180, p = { x: b.x + Math.cos(angle) * radius, y: b.y + Math.sin(angle) * radius * .65 };
      if (laneDistance(p) < 165 || outsideRiver(p, seed) < 30 || anchors.some(a => distance(p, a) < 160)) continue;
      props.push({ ...p, name: pick(['ferns','mushrooms','boulders','branch']), height: 80 + rand() * 100, flip: rand() < .5, sway: i % 3 === 0, biome: b.biome });
    }
  }
  // A village yard is framed by varied buildings; the north remains broken ruins.
  for (const [name,x,y,h] of [['shrine',1850,3820,310],['ivy-wall',1970,1390,270],['abbey',1870,1950,330],['house-b',1780,3540,355],['pier',1270,2510,210]]) {
    const p = {x,y}; if (laneDistance(p) < 190 || blocked(p)) continue;
    props.push({ name: phase && name.startsWith('house') ? 'hollow-log' : name, x, y, height: h, flip: false, biome: districtAt(p).name });
  }
  // Coherent groves use clusters with clearings. Distant canopy closes the world edge.
  const groves = [
    [350,740,350], [610,1780,260], [410,3850,410], [1210,4150,340],
    [2860,3900,280], [3540,4400,370], [4540,3970,380], [4520,1790,410],
    [3630,550,280], [3120,1980,180], [1970,2840,200], [2950,3240,240],
  ];
  for (const [gx,gy,radius] of groves) {
    const grove = districtAt({x:gx,y:gy});
    for (let j = 0; j < 13; j++) {
      const angle = rand() * Math.PI * 2, radiusAt = Math.sqrt(rand()) * radius, p = { x: gx + Math.cos(angle) * radiusAt, y: gy + Math.sin(angle) * radiusAt };
      if (laneDistance(p) < 200 || outsideRiver(p, seed) < 70 || blocked(p) || anchors.some(a => distance(p,a) < 220)) continue;
      const name = pick(grove.plants.filter(n=>!['branch','boulders','ferns','reeds','mushrooms','hollow-log'].includes(n)));
      props.push({ ...p, name, height: 240 + rand() * 220, flip: rand() < .5, sway: true, biome: grove.name, canopy: true });
    }
  }
  // Infill has a deliberately varied scale; large blank lawns never form a grid.
  for (let i = 0; i < 1900; i++) {
    const p = { x: 180 + rand() * (SIZE - 360), y: 180 + rand() * (SIZE - 360) }, d = laneDistance(p), water = outsideRiver(p, seed);
    if (d < 175 || water < 35 || blocked(p) || anchors.some(a => distance(p,a) < 170) || props.some(q=>distance(p,q)<85)) continue;
    const district = districtAt(p), name = water < 150 ? pick(['reeds','reeds','boulders','ferns']) : pick(district.plants);
    const tall = ['willow','oak','birches','juniper','pines','forest-island'].includes(name);
    if (tall && (d < 260 || rand() < .48)) continue;
    props.push({ ...p, name, height: tall ? 220 + rand() * 180 : 65 + rand() * 115, flip: rand() < .5, sway: ['reeds','ferns','willow','birches'].includes(name), biome: district.name, canopy: tall });
  }
  for (let i = 0; i < 70; i++) {
    const x = rand() * SIZE, bank = riverSample(x, seed), p = { x, y: rand() < .5 ? bank.north - 26 : bank.south + 32 };
    if (laneDistance(p) < 180 || blocked(p)) continue;
    props.push({ ...p, name: pick(['reeds','reeds','boulders']), height: 70 + rand() * 80, flip: rand() < .5, sway: true, biome: 'wetland', shoreline: true });
  }
  for (let i = 0; i < 220; i++) patches.push({ x: rand() * SIZE, y: rand() * SIZE, r: 90 + rand() * 270, hue: rand(), angle: rand() * Math.PI });
  return { props, patches, districts: DISTRICTS, seed, phase, river: riverGeometry(seed) };
}
