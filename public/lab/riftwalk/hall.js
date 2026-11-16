// Riftwalk: the plain rules of the hall, with no drawing. The page (main.js) and the node test
// (qa/lab/riftwalk.test.mjs) share them.
// The hall is one Gaussian splat world in metres, with the floor at y = 0. Arcade cabinets stand in clusters against
// its walls, and each cluster belongs to one collection of the arcade: that is a zone. worlds/hall/screens.json says
// where each cabinet's screen is ({ zone, centre, right, up, normal, width, height }), where a visitor stands to see
// a zone's cluster, and where the rift ring above the cluster is. Each screen is a portal to one game. A rift ring
// takes the visitor to its zone.
export const GROW = 1.08;      // a portal covers a little more than the measured screen, so no bare glass shows at its rim

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

// The zones of the hall: one for each collection, in the order of the homepage rows, with the neon colour of its
// cluster of machines.
export const ZONES = [
  { id: 'cottage', label: 'Cottage', color: '#ffae3d', groups: ['cottage'] },
  { id: 'action', label: 'Action', color: '#ff3dd0', groups: ['action'] },
  { id: 'ascii', label: 'ASCII Scenes', color: '#7dff5a', groups: ['ascii'] },
  { id: 'strategy', label: 'Strategy', color: '#35c8ff', groups: ['strategy'] },
  { id: 'gta', label: 'GTA', color: '#c06bff', groups: ['gta'] },
  { id: 'lab', label: 'Lab', color: '#4f8dff', groups: ['lab'] },
];

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// A heading is a compass turn in radians: 0 looks along -z and a quarter turn looks along +x.
export const direction = heading => ({ x: Math.sin(heading), z: -Math.cos(heading) });
export const headingTo = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));

// The games of one collection, as the arcade's list has them ({ id, name, sub, url, art, color }, from switch.js).
// A game id with no entry in that list is left out, and so is the hall itself.
export function gamesOf(groupId, games) {
  const group = GROUPS.find(g => g.id === groupId); if (!group) return [];
  const byId = new Map(games.map(g => [g.id, g]));
  return group.games.filter(id => id !== SELF && byId.has(id)).map(id => { const g = byId.get(id); return { id, title: g.name, sub: g.sub || '', url: g.url, art: g.art, color: g.color || group.color }; });
}
// The games of one zone: the games of its collections, one collection after the other.
export function zoneGames(zoneId, games) {
  const zone = ZONES.find(z => z.id === zoneId); if (!zone) return [];
  return zone.groups.flatMap(id => gamesOf(id, games));
}

// The machines of one zone, as indexes into the screens, in reading order for a visitor at the zone's station: clockwise
// round the visitor, which is from left to right along a row. The order starts after the widest gap between the
// zone's machines, so it starts at one end of the cluster and never in its middle. `facing` breaks a tie.
export function seats(zoneId, screens, station, facing = 0) {
  const from = { x: station[0], z: station[1] }, turn = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const mine = screens.map((s, i) => ({ i, zone: s.zone, at: turn(headingTo(from, { x: s.centre[0], z: s.centre[2] }) - facing) })).filter(e => e.zone === zoneId).sort((a, b) => a.at - b.at);
  if (mine.length < 2) return mine.map(e => e.i);
  let first = 0, widest = -1; mine.forEach((e, k) => { const before = mine[(k + mine.length - 1) % mine.length], gap = turn(e.at - before.at) || 2 * Math.PI; if (gap > widest + 1e-9) { widest = gap; first = k; } });
  return mine.slice(first).concat(mine.slice(0, first)).map(e => e.i);
}
// How many pages a zone needs on its machines, and which game each machine shows on one page: seat k of the zone
// takes game k of the page. The answer maps a screen index to a game; a machine with no game is left out.
export const pages = (count, machines) => Math.max(1, Math.ceil(count / Math.max(1, machines)));
export function assign(seatList, games, page = 0) {
  const out = new Map(), start = page * seatList.length;
  seatList.forEach((seat, k) => { const game = games[start + k]; if (game) out.set(seat, game); });
  return out;
}

// A rift ring as a place: a flat disc on the wall, with the same fields as a screen so pick, facing and neighbour
// treat it as one more place. Its width and height are the ring's diameter.
export function ringPlace(ring) {
  const n = ring.normal, up = [0, 1, 0], right = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]];
  return { ring: true, centre: ring.centre, right, up, normal: n, width: ring.radius * 2, height: ring.radius * 2 };
}
// A room is a small world of its own for one zone, with machines around the point the visitor stands on. Its machines
// take games in order, clockwise: the first game is on the front machine, the next one is to its right, and so on round.
export function roomSeats(screens) {
  const turn = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const front = screens.reduce((best, p) => Math.abs(wrap(p.heading)) < Math.abs(wrap(best.heading)) ? p : best, screens[0]).heading;
  return screens.map((p, i) => ({ i, at: turn(p.heading - front) })).sort((a, b) => a.at - b.at).map(e => e.i);
}
// The way out of a room: a rift ring in the widest gap between its machines, a little behind them, at eye level.
export function exitRing(screens, radius = 0.55) {
  const turns = screens.map(p => wrap(p.heading)).sort((a, b) => a - b); let heading = Math.PI, widest = 0, distance = 3;
  turns.forEach((a, i) => { const next = i + 1 < turns.length ? turns[i + 1] : turns[0] + 2 * Math.PI, gap = next - a; if (gap > widest) { widest = gap; heading = wrap(a + gap / 2); } });
  if (screens.length) distance = Math.min(4.5, Math.max(...screens.map(p => p.distance)) * (widest > 1.6 ? 0.8 : 1) + (widest > 1.6 ? 0 : 0.7));
  const d = direction(heading);
  return { ring: true, heading, distance, centre: [d.x * distance, 1.45, d.z * distance], right: [-d.z, 0, d.x], up: [0, 1, 0], normal: [-d.x, 0, -d.z], width: radius * 2, height: radius * 2 };
}
// One walk step inside a room: the visitor stays within `reach` metres of the room's middle.
export function walkRoom(to, reach = 1) { const r = Math.hypot(to.x, to.z); return r <= reach ? to : { x: to.x / r * reach, z: to.z / r * reach }; }

// The zone a visitor is in: the one whose station is nearest.
export function zoneAt(place, zones) {
  let best = 0, least = Infinity;
  zones.forEach((z, i) => { const d = Math.hypot(place.x - z.station[0], place.z - z.station[1]); if (d < least) { least = d; best = i; } });
  return best;
}

// Which lit place does a look ray pick? origin and dir are in the hall's space; dir is a unit vector. The ray must
// cut the place's plane from its front, inside the place. pad widens it for a finger. The nearest hit wins.
export function pick(origin, dir, places, lit, pad = 1) {
  let best = -1, bestT = Infinity;
  places.forEach((p, i) => {
    if (!lit[i]) return;
    const n = p.normal, denom = dir.x * n[0] + dir.y * n[1] + dir.z * n[2]; if (denom > -1e-5) return;
    const t = ((p.centre[0] - origin.x) * n[0] + (p.centre[1] - origin.y) * n[1] + (p.centre[2] - origin.z) * n[2]) / denom; if (t <= 0 || t >= bestT) return;
    const hx = origin.x + dir.x * t - p.centre[0], hy = origin.y + dir.y * t - p.centre[1], hz = origin.z + dir.z * t - p.centre[2];
    const along = hx * p.right[0] + hy * p.right[1] + hz * p.right[2], upward = hx * p.up[0] + hy * p.up[1] + hz * p.up[2];
    if (Math.abs(along) <= p.width / 2 * GROW * pad && Math.abs(upward) <= p.height / 2 * GROW * pad) { best = i; bestT = t; }
  });
  return best;
}
// The lit place nearest to the middle of the view, if it is within `within` radians of it and no farther than `reach`
// metres. Each place carries its heading and distance as the visitor sees it. The page names that place on screen.
export function facing(heading, places, lit, within = 0.3, reach = Infinity) {
  let best = -1, least = within;
  places.forEach((p, i) => { if (!lit[i] || p.distance > reach) return; const off = Math.abs(wrap(p.heading - heading)); if (off < least) { least = off; best = i; } });
  return best;
}
// The next lit place to the right (step 1) or to the left (step -1) of a heading, no farther than `reach` metres:
// the arrows turn the view to it, and go on round the visitor.
export function neighbour(heading, places, lit, step, reach = Infinity) {
  let best = -1, least = Infinity;
  places.forEach((p, i) => { if (!lit[i] || p.distance > reach) return; const off = wrap(p.heading - heading) * step, turn = off > 0.02 ? off : off + 2 * Math.PI; if (turn < 2 * Math.PI - 0.02 && turn < least) { least = turn; best = i; } });
  return best;
}

// One walk step inside the hall's open floor: a box. A step that would leave the box slides along its side.
export const walk = (to, bounds) => ({ x: Math.max(bounds.x[0], Math.min(bounds.x[1], to.x)), z: Math.max(bounds.z[0], Math.min(bounds.z[1], to.z)) });
