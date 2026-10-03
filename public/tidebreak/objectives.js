export const LANE_NAMES = ['West', 'Middle', 'East'];
const wards = (s, team, lane) => s.units.filter(e => e.kind === 'tower' && e.team === team && (lane === undefined || e.lane === lane));
export function laneOpen(s, team, lane) {
  const towers = wards(s, team, lane);
  return towers.length === 2 && towers.every(e => e.hp <= 0);
}
export function structureProtected(s, e) {
  if (e.kind === 'core') return ![0, 1, 2].some(lane => laneOpen(s, e.team, lane));
  return e.kind === 'tower' && e.tier === 1 && wards(s, e.team, e.lane).some(t => t.tier === 0 && t.hp > 0);
}
export function nextObjective(s, team = 1, lane = 1) {
  if (laneOpen(s, team, lane)) return s.units.find(e => e.kind === 'core' && e.team === team && e.hp > 0);
  return wards(s, team, lane).find(e => e.hp > 0 && !structureProtected(s, e));
}
export function objectiveText(s, lane = 1) {
  const target = nextObjective(s, 1, lane);
  if (!target) return 'Push with your wisps.';
  return target.kind === 'core' ? 'Rift exposed. Push with your wisps.' : `${LANE_NAMES[lane]} lane: break the ${target.tier === 0 ? 'outer' : 'inner'} ward. ${s.towers[1]}/6 enemy wards stand.`;
}
