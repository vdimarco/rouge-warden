export const LANE_NAMES = ['West', 'Middle', 'East'];
export const TIER_NAMES = ['outer', 'middle', 'inner'];
export const INNER = TIER_NAMES.length - 1;
export const wards = (s, team, lane) => s.units.filter(e => e.kind === 'tower' && !e.guardian && e.team === team && (lane === undefined || e.lane === lane));
export const guardians = (s, team) => s.units.filter(e => e.kind === 'tower' && e.guardian && e.team === team);
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
