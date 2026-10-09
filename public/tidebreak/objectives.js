import { BASES, PATHS, distance } from './world.js';
import { BASE_HEAL_RADIUS } from './bases.js';

export const LANE_NAMES = ['West', 'Middle', 'East'];
export const TIER_NAMES = ['outer', 'middle', 'inner'];
export const INNER = TIER_NAMES.length - 1;
export const wards = (s, team, lane) => s.units.filter(e => e.kind === 'tower' && !e.guardian && e.team === team && (lane === undefined || e.lane === lane));
export const guardians = (s, team) => s.units.filter(e => e.kind === 'tower' && e.guardian && e.team === team);
// Project onto whole road segments, rather than choosing the nearest sampled knot.
export function distanceToPath(point, path) {
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[i + 1] || a, dx = b.x - a.x, dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2)) : 0;
    best = Math.min(best, Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t));
  }
  return best;
}
// Guidance follows the current position without changing the hero's simulation lane.
// Keep its last lane in the shared court and until another road is 120 units nearer.
export function guidanceLane(point, previous = 1) {
  const current = Number.isInteger(previous) && previous >= 0 && previous < PATHS.length ? previous : 1;
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return current;
  if (BASES.some(base => distance(point, base) < BASE_HEAL_RADIUS)) return current;
  const distances = PATHS.map(path => distanceToPath(point, path));
  const nearest = distances.reduce((best, d, i) => d < distances[best] ? i : best, current);
  return distances[current] - distances[nearest] > 120 ? nearest : current;
}
// A lane is open when every ward on it is down.
export function laneOpen(s, team, lane) {
  const towers = wards(s, team, lane);
  return towers.length > 0 && towers.every(e => e.hp <= 0);
}
// The protection chain: a ward waits for the previous tier in its lane, the guardians wait for any
// inner ward of their team, and the core waits for both guardians. Sudden death lifts every gate.
export function structureProtected(s, e) {
  if (s.suddenDeath) return false;
  if (e.kind === 'core') return guardians(s, e.team).some(g => g.hp > 0);
  if (e.kind !== 'tower') return false;
  if (e.guardian) return !wards(s, e.team).some(t => t.tier === INNER && t.hp <= 0);
  return e.tier > 0 && wards(s, e.team, e.lane).some(t => t.tier === e.tier - 1 && t.hp > 0);
}
// The first standing structure on a lane's chain that can be damaged now.
export function nextObjective(s, team = 1, lane = 1) {
  const towers = wards(s, team, lane).sort((a, b) => a.tier - b.tier), inner = towers.at(-1);
  const near = inner ? guardians(s, team).sort((a, b) => Math.hypot(a.x - inner.x, a.y - inner.y) - Math.hypot(b.x - inner.x, b.y - inner.y)) : guardians(s, team);
  return [...towers, ...near, ...s.units.filter(e => e.kind === 'core' && e.team === team)].find(e => e.hp > 0 && !structureProtected(s, e));
}
export function objectiveText(s, lane = 1) {
  const target = nextObjective(s, 1, lane), standing = wards(s, 1).filter(e => e.hp > 0).length, total = wards(s, 1).length;
  if (!target) return 'Push with your wisps.';
  if (target.kind === 'core') return s.suddenDeath ? 'Sudden death. Every ward and the rift are open.' : 'Rift exposed. Push with your wisps.';
  if (target.guardian) return `Break the rift guardians. ${guardians(s, 1).filter(e => e.hp > 0).length}/2 stand. Step out of their slam.`;
  return `${LANE_NAMES[lane]} lane: break the ${TIER_NAMES[target.tier]} ward. ${standing}/${total} enemy wards stand.`;
}
