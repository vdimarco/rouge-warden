import { SIZE, LANES, BASES, PORTALS, CAMPS, OBSTACLES, distance } from './world.js';
import { outsideRiver, riverSample, riverGeometry } from './river.js';

export const LANDMARKS = ['observatory', 'mill', 'market', 'abbey', 'hollow-log', 'greenhouse', 'shrine', 'ivy-wall', 'pier'];
export const PLANTS = ['willow', 'oak', 'birches', 'mushrooms', 'ferns', 'juniper', 'reeds', 'boulders', 'branch'];
export const sceneryRandom = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
export function laneDistance(p) {
  let best = Infinity;
  for (const lane of LANES) for (let i = 1; i < lane.length; i++) {
    const a = lane[i - 1], b = lane[i], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}

// Separate RNG keeps decorative changes out of the deterministic combat stream.
// Large objects stay on the shared collision blocks. Soft ground cover is passable.
export function makeScenery(seed, phase) {
  const rand = sceneryRandom(seed ^ 0x718ac), props = [], patches = [];
  const pick = a => a[Math.floor(rand() * a.length)];
  const district = p => p.y < 1750 ? 'ruins' : p.y < 2350 ? 'wetland' : p.x < 2300 ? 'village' : 'grove';
  for (const b of OBSTACLES[phase]) {
    const biome = district(b), shift = (b.id + (seed >>> 0) % 7) % 7;
    const town = ['observatory', 'market', 'greenhouse', 'house-a', 'shrine', 'mill', 'house-b'];
    const ruins = ['abbey', 'oak', 'ivy-wall', 'shrine', 'birches', 'observatory', 'hollow-log'];
    const woods = ['willow', 'oak', 'birches', 'juniper', 'hollow-log', 'mushrooms', 'stones'];
    const name = (phase ? woods : biome === 'ruins' ? ruins : biome === 'village' ? town : woods)[shift];
    const tall = ['willow', 'oak', 'birches', 'juniper'].includes(name);
    const height = (tall ? 350 : ['ivy-wall', 'hollow-log', 'mushrooms', 'market'].includes(name) ? 220 : 410) * (.87 + rand() * .24);
    const foot = b.y + b.h * .35;
    props.push({ name, x: b.x, y: foot, height, flip: rand() < .5, sway: tall, solid: true, biome, id: b.id });
    // Small uneven clusters sit at the same footprint, without a wall of identical trees.
    for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) props.push({ name: pick(['ferns', 'mushrooms', 'boulders', 'branch']), x: b.x + (rand() - .5) * b.w, y: foot + (rand() - .35) * 95, height: 50 + rand() * 70, flip: rand() < .5, sway: true, biome });
  }
  const anchors = [...BASES, ...PORTALS, ...CAMPS, { x: 2400, y: 2400 }];
  for (const x of [1330, 3470]) props.push({ name: 'pier', x, y: riverSample(x, seed).south + 40, height: 170, flip: x > 2400, biome: 'wetland' });
  // Poisson-like rejection, with clustered density rather than a repeating grid.
  for (let i = 0; i < 760; i++) {
    const p = { x: 230 + rand() * (SIZE - 460), y: 230 + rand() * (SIZE - 460) };
    const d = laneDistance(p), water = outsideRiver(p, seed);
    if (d < 175 || water < 35 || anchors.some(a => distance(p, a) < 160)) continue;
    if (OBSTACLES[phase].some(b => Math.abs(p.x - b.x) < b.w / 2 + 25 && Math.abs(p.y - b.y) < b.h / 2 + 25)) continue;
    if (props.some(q => distance(p, q) < 95)) continue;
    const density = Math.sin(p.x * .003) * Math.cos(p.y * .004);
    if (density < -.15 && rand() < .7) continue;
    const name = water < 130 ? 'reeds' : pick(['ferns', 'ferns', 'mushrooms', 'boulders', 'branch']);
    props.push({ ...p, name, height: 38 + rand() * 64, flip: rand() < .5, sway: ['reeds', 'ferns'].includes(name), biome: district(p) });
  }
  for (let i = 0; i < 55; i++) {
    const x = rand() * SIZE, bank = riverSample(x, seed), p = { x, y: (rand() < .5 ? bank.north - 18 : bank.south + 28) };
    if (laneDistance(p) < 170 || OBSTACLES[phase].some(b => Math.abs(p.x - b.x) < b.w / 2 + 30 && Math.abs(p.y - b.y) < b.h / 2 + 30)) continue;
    props.push({ ...p, name: i % 4 ? 'reeds' : 'boulders', height: 50 + rand() * 35, flip: rand() < .5, sway: true, biome: 'wetland', shoreline: true });
  }
  for (let i = 0; i < 170; i++) patches.push({ x: rand() * SIZE, y: rand() * SIZE, r: 80 + rand() * 240, hue: rand(), angle: rand() * Math.PI });
  return { props, patches, seed, phase, river: riverGeometry(seed) };
}
