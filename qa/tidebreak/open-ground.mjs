// Duel tests need open ground: no cover in either realm, no water, no brush and no structure close by.
// The spot is searched on the real layout, so tests keep working when the map changes.
import { OBSTACLES, BRUSH, BASES, TOWER_POSITIONS, GUARDIAN_POSITIONS, CAMPS, PORTALS, CENTER, SIZE, distance } from '../../public/tidebreak/world.js';
import { outsideRiver } from '../../public/tidebreak/river.js';

const rect = (p, r) => Math.hypot(Math.max(0, Math.abs(p.x - r.x) - r.w / 2), Math.max(0, Math.abs(p.y - r.y) - r.h / 2));
const anchors = [...TOWER_POSITIONS.flat(2), ...GUARDIAN_POSITIONS.flat(), ...CAMPS, ...PORTALS, CENTER];
// Clearance of a point: the nearest cover (both realms), water (common test seeds), brush edge (+250) or anchor.
export function clearance(p) {
  const cover = Math.min(...OBSTACLES.flat().map(r => rect(p, r)));
  const water = Math.min(...[1, 7, 42, 49].map(seed => outsideRiver(p, seed)));
  const brush = Math.min(...BRUSH.map(b => distance(p, b) - b.radius)) + 250;
  return Math.min(cover, water, brush, ...anchors.map(a => distance(p, a)));
}
export function openGround() {
  let best = null;
  for (let x = SIZE * .15; x <= SIZE * .85; x += 50) for (let y = SIZE * .15; y <= SIZE * .85; y += 50) {
    const p = { x, y }; if (BASES.some(b => distance(p, b) < 1500)) continue;
    const c = clearance(p); if (!best || c > best.clearance) best = { x, y, clearance: c };
  }
  return best;
}
export const OPEN = openGround();
// Tests written for the 6400 map placed duels around (2400, 2800). near() keeps their offsets.
export const near = (x, y) => ({ x: OPEN.x + x - 2400, y: OPEN.y + y - 2800 });
