// Riftwalk: the plain rules of the hall, with no drawing. The page (main.js) and the node test
// (qa/lab/riftwalk.test.mjs) share them.
// The hall is one Gaussian splat world in metres: the floor is y = 0 and the visitor's eye starts at (0, 1.35, 0),
// the point the world was made from.
// Portals stand in a ring around that point. The first ring holds one portal for each collection of the arcade. A
// collection's portal opens a second ring with one portal for each of its games, and a game's portal launches the game.

export const EYE = 1.35;       // eye height, metres: the height of the world's capture point over its floor
export const WALK = 1.2;       // the visitor stays inside this circle: a splat world is sharp near the point it was made from
export const RING = 2.5;       // distance from the centre to a portal: the hall is 7 m wide
export const PORTAL_Y = 1.45;  // a portal's centre height: a little over the eye, clear of the name card at the bottom of the view
export const MAX_RADIUS = 0.55;

// The collections of the arcade, in the order of the homepage rows. The node test checks this list against the GROUPS
// array in public/index.html, so a game added to a row there cannot be missed here.
export const GROUPS = [
  { id: 'cottage', label: 'Cottage', color: '#ffcf4a', games: ['plungerd', 'drain', 'brawl', 'wild', 'fish', 'vr', 'pingpong', 'lake-brawl'] },
  { id: 'action', label: 'Action', color: '#ff2a2a', games: ['olympus', 'crimson', 'tidebreak', 'moonwell', 'primordia', 'river-rush', 'ahead-of-the-light', 'light-years-home', 'first-breath', 'frostwing', 'ember-drift'] },
  { id: 'ascii', label: 'ASCII Scenes', color: '#d2f584', games: ['ascii-front', 'battle-tanks'] },
  { id: 'strategy', label: 'Strategy', color: '#f0c56a', games: ['breakthrough', 'follow-suit', 'silent-depth'] },
  { id: 'gta', label: 'GTA', color: '#f2c14e', games: ['gta'] },
  { id: 'lab', label: 'Lab', color: '#f0b848', games: ['lab', 'worlds', 'neon', 'echo', 'tellme', 'plunge', 'creek', 'tilt', 'rules', 'afterlight', 'last-light', 'lighthouse-keeper', 'echoes-under-ice', 'last-train-home', 'firefly-courier', 'mirage-runner', 'orbital-gardener', 'eleven-wells', 'ledger', 'riftwalk'] },
];
// The hall does not offer a portal to itself.
export const SELF = 'riftwalk';

// A heading is a compass turn in radians: 0 looks along -z and a quarter turn looks along +x.
export const direction = heading => ({ x: Math.sin(heading), z: -Math.cos(heading) });
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// The portals of one ring: count portals spread over a full turn, the first one at the heading `first`. A portal
// fronts the centre: yaw is the turn about y that puts its own +z axis on the way to the centre. The radius shrinks
// when many portals share the ring, so that neighbours keep a gap of a fifth of their width.
export function ring(count, first = 0, distance = RING) {
  const step = 2 * Math.PI / Math.max(1, count), chord = count > 1 ? 2 * distance * Math.sin(step / 2) : Infinity;
  const radius = Math.min(MAX_RADIUS, chord / 2.4);
  return Array.from({ length: count }, (_, i) => {
    const heading = wrap(first + i * step), d = direction(heading);
    return { heading, x: d.x * distance, y: PORTAL_Y, z: d.z * distance, yaw: Math.atan2(-d.x, -d.z), radius };
  });
}

// What the two rings hold. games is the arcade's list ({ id, name, sub, url, art, color }), as switch.js gives it.
// A game id with no entry in that list is left out, and so is the hall itself.
export function hallPortals() {
  return GROUPS.map(g => ({ kind: 'group', id: g.id, title: g.label, color: g.color, count: g.games.filter(id => id !== SELF).length }));
}
export function groupPortals(groupId, games) {
  const group = GROUPS.find(g => g.id === groupId); if (!group) return [];
  const byId = new Map(games.map(g => [g.id, g]));
  const list = group.games.filter(id => id !== SELF && byId.has(id)).map(id => { const g = byId.get(id); return { kind: 'game', id, title: g.name, sub: g.sub || '', url: g.url, art: g.art, color: g.color || group.color }; });
  // The back portal is the last one: the ring starts in front of the visitor, so the first game is what they face and
  // the way back is on their left.
  return [...list, { kind: 'back', id: 'back', title: 'All collections', sub: '', color: '#e8f6ff' }];
}
// The picture of a collection's portal: the art of its first game that has any.
export function groupArt(groupId, games) {
  const group = GROUPS.find(g => g.id === groupId), byId = new Map(games.map(g => [g.id, g]));
  for (const id of group ? group.games : []) if (byId.get(id)?.art) return byId.get(id).art;
  return null;
}

// Which portal does a look ray pick? origin and dir are in the hall's space; dir is a unit vector. The ray must pass
// through a portal's disc from its front. The nearest hit wins. pad widens the disc for a finger.
export function pick(origin, dir, portals, pad = 1.12) {
  let best = -1, bestT = Infinity;
  portals.forEach((p, i) => {
    const n = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }, denom = dir.x * n.x + dir.z * n.z;
    if (denom > -1e-5) return;
    const t = ((p.x - origin.x) * n.x + (p.z - origin.z) * n.z) / denom; if (t <= 0 || t >= bestT) return;
    if (Math.hypot(origin.x + dir.x * t - p.x, origin.y + dir.y * t - p.y, origin.z + dir.z * t - p.z) <= p.radius * pad) { best = i; bestT = t; }
  });
  return best;
}
// The portal nearest to the middle of the view, if it is within `within` radians of it. The page names that portal
// on screen, and Enter or Space goes through it.
export function facing(heading, portals, within = 0.45) {
  let best = -1, least = within;
  portals.forEach((p, i) => { const off = Math.abs(wrap(p.heading - heading)); if (off < least) { least = off; best = i; } });
  return best;
}
// The next portal to the right (step 1) or to the left (step -1) of a heading: the arrow keys turn the view to it.
export function neighbour(heading, portals, step) {
  if (!portals.length) return -1;
  const at = facing(heading, portals, Math.PI / Math.max(1, portals.length) + 1e-6);
  if (at >= 0 && Math.abs(wrap(portals[at].heading - heading)) < 0.02) return (at + step + portals.length) % portals.length;
  let best = -1, least = Infinity;
  portals.forEach((p, i) => { const off = wrap(p.heading - heading) * step; const turn = off > 1e-6 ? off : off + 2 * Math.PI; if (turn < least) { least = turn; best = i; } });
  return best;
}

// One walk step inside the walk circle. A step that would leave the circle slides along it.
export function walk(from, to) {
  const r = Math.hypot(to.x, to.z); if (r <= WALK) return to;
  if (r < Math.hypot(from.x, from.z)) return to;
  return { x: to.x / r * WALK, z: to.z / r * WALK };
}
