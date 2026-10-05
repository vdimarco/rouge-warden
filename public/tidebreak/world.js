// Geometry is shared by movement, targeting, fog, the minimap and the renderer.
import { creekCenter, insideRiver } from './river.js';
import { SIZE, CENTER, FEATURE_SCALE, at, mirror } from './arena.js';
import { BASE, LANE_KNOTS, TOWER_ARC, GUARDIANS, RIVER_GATES, BASE_GATE, CAMP_SPOTS, BRUSH_SPOTS, COVER_SPOTS } from './layout.js';
export { SIZE, MAP_SCALE, CENTER, FEATURE_SCALE } from './arena.js';
export { TOWER_ARC } from './layout.js';
// The soft limit starts sudden death. The hard limit ends the match with a tiebreak.
export const SUDDEN_DEATH = 840, LIMIT = 1020;
export const SHIFT = 40;
export const BASES = [at(...BASE), mirror(at(...BASE))];
// Each lane is team 0's half, the knot on the axis, then the same half mirrored to team 1's base.
export const LANES = LANE_KNOTS.map(knots => {
  const south = knots.map(k => at(...k)), axis = south.pop();
  return [BASES[0], ...south, axis, ...[...south].reverse().map(mirror), BASES[1]];
});
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
export const PATHS = LANES.map(track);
export function closestTrack(p, path) {
  let best = Infinity, index = 0;
  for (let i = 0; i < path.length; i++) { const d = Math.hypot(p.x - path[i].x, p.y - path[i].y); if (d < best) { best = d; index = i; } }
  return index;
}
// Distance walked along a path; stations are placed by it, so both teams get the same spacing.
export const arcLength = path => path.reduce((n, p, i) => i ? n + Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y) : 0, 0);
export function pointAtArc(path, d) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], step = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= step) { const t = step ? Math.max(0, d) / step : 0; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    d -= step;
  }
  return { ...path.at(-1) };
}
export const laneFrom = (team, lane) => team ? [...PATHS[lane]].reverse() : PATHS[lane];
// The lane's halfway point lies on the river axis.
export const laneMid = lane => pointAtArc(PATHS[lane], arcLength(PATHS[lane]) / 2);
// [team][lane] = [outer, middle, inner]; tier 0 is outer.
export const TOWER_POSITIONS = [0, 1].map(team => TOWER_ARC.map((arcs, lane) => arcs.map(d => pointAtArc(laneFrom(team, lane), d))));
export const GUARDIAN_POSITIONS = [GUARDIANS.map(g => at(...g)), GUARDIANS.map(g => mirror(at(...g)))];
// River gates pair across the map. Base gates send a hero to the team's own river gate on the side it faces.
const gate = (p, to, more = {}) => ({ ...p, to, ...more });
const [sw, se] = RIVER_GATES.map(g => at(...g)), home = at(...BASE_GATE);
export const PORTALS = [gate(sw, 3), gate(se, 2), gate(mirror(sw), 1), gate(mirror(se), 0), gate(home, 0, { base: 0, choices: [0, 1] }), gate(mirror(home), 2, { base: 1, choices: [2, 3] })];
export const CAMPS = [...CAMP_SPOTS.map(c => at(...c)), ...CAMP_SPOTS.map(c => mirror(at(...c)))];
// The Wild Hunt rises in the shallow ford at the centre.
export const HUNT = CENTER;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// Broad town blocks become smaller groves. Lanes stay open in both realms.
// Each block has an illustrated structure or natural landform at its footprint; the north half mirrors the south.
const block = b => ({ ...b, ...at(b.x, b.y), w: b.w * FEATURE_SCALE, h: b.h * FEATURE_SCALE });
export const COVER = [...COVER_SPOTS.map(block), ...COVER_SPOTS.map(b => mirror(block(b)))];
export const OBSTACLES = [0, 1].map(phase => COVER.map((b, id) => ({ ...b, w: b.w * (phase ? .58 : 1), h: b.h * (phase ? .58 : 1), id })));
export const BRUSH = [...BRUSH_SPOTS.map(b => at(...b)), ...BRUSH_SPOTS.map(b => mirror(at(...b)))].map(p => ({ ...p, radius: 150 * FEATURE_SCALE }));
// The old sine river feeds only the retired WebGL files.
export const RIVER = y => CENTER.x + Math.sin((y - SIZE * .104) / (SIZE * .1)) * SIZE * .09;
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
  if(e.snaredUntil>s.time || e.castIntent)return;
  if(e.recoveryUntil>s.time)speed*=.55;
  if(e.chaseUntil>s.time)speed*=1.4;
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
