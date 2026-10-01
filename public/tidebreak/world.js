// Geometry is shared by movement, targeting, fog, the minimap and the renderer.
import { creekCenter, insideRiver } from './river.js';
export const SIZE = 4800;
export const LIMIT = 360;
export const SHIFT = 40;
export const BASES = [{ x: 2400, y: 4000 }, { x: 2400, y: 800 }];
// Strategic anchors remain stable; the shared sampled tracks wind between them.
export const LANES = [
  [BASES[0], { x: 1060, y: 3530 }, { x: 690, y: 2410 }, { x: 1110, y: 1280 }, BASES[1]],
  [BASES[0], { x: 2400, y: 3260 }, { x: 2400, y: 2400 }, { x: 2400, y: 1540 }, BASES[1]],
  [BASES[0], { x: 3630, y: 3500 }, { x: 4060, y: 2580 }, { x: 3750, y: 1250 }, BASES[1]],
];
// Catmull-Rom centerlines are consumed by movement, terrain and the minimap.
function track(knots) {
  const result = [];
  for (let i = 0; i < knots.length - 1; i++) {
    const a = knots[Math.max(0, i - 1)], b = knots[i], c = knots[i + 1], d = knots[Math.min(knots.length - 1, i + 2)];
    const steps = Math.ceil(Math.hypot(c.x - b.x, c.y - b.y) / 55);
    for (let j = 0; j < steps; j++) {
      const t = j / steps, sample = k => .5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t);
      result.push({ x: sample('x'), y: sample('y') });
    }
  }
  result.push(knots.at(-1)); return result;
}
export const PATHS = LANES.map((lane, i) => track(i === 1 ? [lane[0], { x: 2250, y: 3850 }, lane[1], { x: 2550, y: 2820 }, lane[2], { x: 2260, y: 1960 }, lane[3], { x: 2530, y: 1030 }, lane[4]] : lane));
export function closestTrack(p, path) {
  let best = Infinity, index = 0;
  for (let i = 0; i < path.length; i++) { const d = Math.hypot(p.x - path[i].x, p.y - path[i].y); if (d < best) { best = d; index = i; } }
  return index;
}
export const PORTALS = [{ x: 1300, y: 3270, to: 3 }, { x: 3500, y: 3270, to: 2 }, { x: 1300, y: 1530, to: 1 }, { x: 3500, y: 1530, to: 0 }];
export const CAMPS = [{ x: 1480, y: 2440 }, { x: 3320, y: 2360 }];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// Broad town blocks become smaller groves. Lanes stay open in both realms.
// Unequal islands of cover follow places rather than a rectangular street grid.
// Each anchor has an illustrated structure or natural landform at its footprint.
export const COVER = [
  { x: 1430, y: 1850, w: 470, h: 330, town: 'ruin-yard', woods: 'ruin-yard', height: 620, biome: 'ruins' },
  { x: 3160, y: 3060, w: 390, h: 270, town: 'root-arch', woods: 'root-arch', height: 640, biome: 'grove' },
  { x: 1580, y: 1420, w: 560, h: 260, town: 'cliff-ridge', woods: 'cliff-ridge', height: 520, biome: 'ruins' },
  { x: 3390, y: 1880, w: 540, h: 240, town: 'rock-shelf', woods: 'rock-shelf', height: 510, biome: 'heath' },
  { x: 1750, y: 2630, w: 390, h: 240, town: 'mill-yard', woods: 'mill-yard', height: 550, biome: 'village' },
  { x: 3220, y: 3400, w: 340, h: 260, town: 'forest-island', woods: 'forest-island', height: 650, biome: 'grove' },
  { x: 1950, y: 3430, w: 250, h: 190, town: 'house-a', woods: 'willow', height: 410, biome: 'village' },
  { x: 2940, y: 1330, w: 270, h: 200, town: 'observatory', woods: 'oak', height: 430, biome: 'ruins' },
  { x: 2950, y: 2570, w: 260, h: 250, town: 'greenhouse', woods: 'forest-island', height: 480, biome: 'grove' },
  { x: 1790, y: 3090, w: 290, h: 200, town: 'market', woods: 'hollow-log', height: 280, biome: 'village' },
  { x: 4540, y: 3070, w: 260, h: 350, town: 'forest-island', woods: 'forest-island', height: 590, biome: 'grove' },
  { x: 390, y: 3100, w: 220, h: 310, town: 'cliff-ridge', woods: 'cliff-ridge', height: 450, biome: 'heath' },
  { x: 2890, y: 3510, w: 260, h: 190, town: 'house-b', woods: 'juniper', height: 390, biome: 'village' },
];
export const OBSTACLES = [0, 1].map(phase => COVER.map((b, id) => ({ ...b, w: b.w * (phase ? .58 : 1), h: b.h * (phase ? .58 : 1), id })));
export const BRUSH = [
  [1110, 2190], [1120, 2700], [3690, 2610], [3680, 2100],
  [2160, 1900], [2640, 2900], [2140, 2820], [2660, 1980],
  [1550, 3270], [3250, 1530], [1550, 1530], [3250, 3270],
].map(([x, y]) => ({ x, y, radius: 150 }));
export const RIVER = y => 2400 + Math.sin((y - 500) / 480) * 430;
export const CREEK = creekCenter;
export function inWater(e, s) { return insideRiver(e, s?.seed ?? 49); }
export function inBrush(s, e) { return s.phase === 1 && BRUSH.some(b => distance(b, e) < b.radius); }
export function concealed(s, e) { return e.kind === 'hero' && (e.cloak > s.time || inBrush(s, e)) && e.revealedUntil < s.time; }
function segmentRect(a, b, r) {
  let low = 0, high = 1;
  for (const [start, delta, min, max] of [[a.x, b.x - a.x, r.x - r.w / 2, r.x + r.w / 2], [a.y, b.y - a.y, r.y - r.h / 2, r.y + r.h / 2]]) {
    if (Math.abs(delta) < .00001) { if (start < min || start > max) return false; }
    else { const u = (min - start) / delta, v = (max - start) / delta; low = Math.max(low, Math.min(u, v)); high = Math.min(high, Math.max(u, v)); if (high < low) return false; }
  }
  return true;
}
export function lineOfSight(s, a, b) { return !OBSTACLES[s.phase].some(r => segmentRect(a, b, r)); }
export function canSee(s, a, b) {
  if (a.team === b.team) return true;
  const d = distance(a, b), sight = a.kind === 'hero' ? (s.phase ? 620 : 950) : 500;
  if (d > sight + b.radius) return false;
  if (a.sightUntil > s.time) return true;
  if (concealed(s, b) && d > 125) return false;
  return lineOfSight(s, a, b);
}
export function visibleTo(s, team, e) {
  if (e.team === team || e.kind === 'tower' || e.kind === 'core') return true;
  return s.units.some(a => a.team === team && a.hp > 0 && canSee(s, a, e));
}
export function resolveBody(s, e) {
  const radius = e.radius || 20;
  e.x = clamp(e.x, 200, SIZE - 200); e.y = clamp(e.y, 180, SIZE - 180);
  for (const r of OBSTACLES[s.phase]) {
    const x0 = r.x - r.w / 2 - radius, x1 = r.x + r.w / 2 + radius, y0 = r.y - r.h / 2 - radius, y1 = r.y + r.h / 2 + radius;
    if (e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1) {
      const d = [e.x - x0, x1 - e.x, e.y - y0, y1 - e.y], side = d.indexOf(Math.min(...d));
      if (side === 0) e.x = x0; if (side === 1) e.x = x1; if (side === 2) e.y = y0; if (side === 3) e.y = y1;
    }
  }
}
export function move(s, e, x, y, dt, speed = e.speed) {
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
  if (d < 2) return;
  const n = Math.min(d, speed * dt), old = { x: e.x, y: e.y };
  e.x += dx / d * n; resolveBody(s, e); e.y += dy / d * n; resolveBody(s, e);
  e.facing = Math.atan2(dy, dx); e.moving = distance(e, old) > .1;
}
export function shiftWorld(s) {
  const phase = Math.floor(s.time / SHIFT) % 2;
  if (phase === s.phase) return false;
  s.phase = phase;
  for (const e of s.units) if (e.speed && e.hp > 0) resolveBody(s, e);
  return true;
}
