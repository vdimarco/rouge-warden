// Geometry is shared by movement, targeting, fog, the minimap and the renderer.
import { creekCenter, insideRiver } from './river.js';
export const SIZE = 4800;
export const LIMIT = 360;
export const SHIFT = 40;
export const BASES = [{ x: 2400, y: 4330 }, { x: 2400, y: 470 }];
export const LANES = [
  [BASES[0], { x: 920, y: 3460 }, { x: 760, y: 2400 }, { x: 920, y: 1340 }, BASES[1]],
  [BASES[0], { x: 2400, y: 3260 }, { x: 2400, y: 2400 }, { x: 2400, y: 1540 }, BASES[1]],
  [BASES[0], { x: 3880, y: 3460 }, { x: 4040, y: 2400 }, { x: 3880, y: 1340 }, BASES[1]],
];
export const PORTALS = [{ x: 1300, y: 3270, to: 3 }, { x: 3500, y: 3270, to: 2 }, { x: 1300, y: 1530, to: 1 }, { x: 3500, y: 1530, to: 0 }];
export const CAMPS = [{ x: 1480, y: 2440 }, { x: 3320, y: 2360 }];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// Broad town blocks become smaller groves. Lanes stay open in both realms.
const blocks = [
  [1430, 1850, 470, 330], [1430, 2950, 470, 330],
  [3370, 1850, 470, 330], [3370, 2950, 470, 330],
  [1960, 2240, 280, 400], [2840, 2560, 280, 400],
  [490, 1500, 280, 430], [4310, 1500, 280, 430],
  [490, 3300, 280, 430], [4310, 3300, 280, 430],
  [1770, 1200, 320, 230], [3030, 1200, 320, 230],
  [1770, 3600, 320, 230], [3030, 3600, 320, 230],
  // The central street is framed by continuous village / woodland cover.
  ...[1380, 1810, 2580, 3060].flatMap(y => [[2050, y, 220, 220], [2760, y + 60, 180, 220]]),
];
export const OBSTACLES = [0, 1].map(phase => blocks.map(([x, y, w, h], id) => ({ x, y, w: w * (phase ? .58 : 1), h: h * (phase ? .58 : 1), id })));
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
