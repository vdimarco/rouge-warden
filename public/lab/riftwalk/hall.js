// Riftwalk: the plain rules of the hall, with no drawing. The page (main.js) and the node test
// (qa/lab/riftwalk.test.mjs) share them.
// The hall has zones. Each zone is one Gaussian splat world in metres: the floor is y = 0 and the visitor's eye starts
// at the point the world was made from. A zone has arcade cabinets, and worlds/<zone>/screens.json says where each
// cabinet's screen is: { centre, right, up, normal, width, height, heading }. Each screen is a portal to one game of
// the zone. Two rift doors stand between the machines: one leads to the zone before, one to the zone after.

export const WALK = 1.0;       // the visitor stays inside this circle: a splat world is sharp near the point it was made from
export const GROW = 1.12;      // a portal covers a little more than the measured screen, so no bare glass shows at its rim

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

// The zones of the hall, in the order the doors link them (the last zone's door leads on to the first). Each zone
// shows the games of its collections. `world` is the zone's folder in worlds/.
export const ZONES = [
  { id: 'action', label: 'Action Den', color: '#ff4fd8', groups: ['action'] },
  { id: 'cottage', label: 'Cottage Row', color: '#ffb84a', groups: ['cottage'] },
  { id: 'back', label: 'Back Room', color: '#7dff6a', groups: ['ascii', 'strategy', 'gta'] },
  { id: 'lab', label: 'The Lab', color: '#b98cff', groups: ['lab'] },
];

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// A heading is a compass turn in radians: 0 looks along -z and a quarter turn looks along +x.
export const direction = heading => ({ x: Math.sin(heading), z: -Math.cos(heading) });

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
// The two rift doors of a zone. Each stands in the widest gap between machines on its side of the visitor: the left
// door leads to the zone before (step -1) and the right door to the zone after (step 1). A door has the same fields as
// a screen, so pick, facing and neighbour treat it as one more place. Its foot is on the floor.
export const DOOR = { width: 0.95, height: 1.9, distance: 2.7 };
export function doors(screens) {
  const turns = screens.map(p => wrap(p.heading)).sort((a, b) => a - b);
  return [-1, 1].map(step => {
    let heading = step * Math.PI / 2, widest = 0;
    turns.forEach((a, i) => {
      const next = i + 1 < turns.length ? turns[i + 1] : turns[0] + 2 * Math.PI, gap = next - a, mid = wrap(a + gap / 2);
      if (Math.sign(mid) === step && Math.abs(mid) > 0.6 && Math.abs(mid) < 2.6 && gap > widest) { widest = gap; heading = mid; }
    });
    const d = direction(heading);
    return { step, heading, distance: DOOR.distance, width: DOOR.width, height: DOOR.height, centre: [d.x * DOOR.distance, DOOR.height / 2 + 0.05, d.z * DOOR.distance], right: [-d.z, 0, d.x], up: [0, 1, 0], normal: [-d.x, 0, -d.z] };
  });
}

// The front machine: the one nearest to heading 0, the middle of the world's own picture. The visitor faces it at the
// start and after a change of collection.
export function middle(screens) {
  if (!screens.length) return 0;
  return screens.reduce((best, p) => Math.abs(wrap(p.heading)) < Math.abs(wrap(best.heading)) ? p : best).heading;
}
// The order in which machines take games: the front machine first, then its neighbours, right and left in turn, round
// to the machine behind the visitor. The first game of a collection is so always straight ahead.
export function order(screens) {
  const m = middle(screens);
  return screens.map((p, i) => ({ i, off: wrap(p.heading - m) })).sort((a, b) => Math.abs(a.off) - Math.abs(b.off) || b.off - a.off).map(e => e.i);
}
// How many pages a collection needs on these machines, and which game each machine shows on one page.
// The answer has one entry for each screen: a game, or null for a machine that stays dark.
export const pages = (count, screens) => Math.max(1, Math.ceil(count / Math.max(1, screens.length)));
export function assign(screens, games, page = 0) {
  const out = screens.map(() => null), seats = order(screens), start = page * screens.length;
  seats.forEach((seat, k) => { out[seat] = games[start + k] || null; });
  return out;
}

// Which lit machine does a look ray pick? origin and dir are in the hall's space; dir is a unit vector. The ray must
// cut the screen's plane from its front, inside the screen. pad widens the screen for a finger. The nearest hit wins.
export function pick(origin, dir, screens, lit, pad = 1) {
  let best = -1, bestT = Infinity;
  screens.forEach((p, i) => {
    if (!lit[i]) return;
    const n = p.normal, denom = dir.x * n[0] + dir.y * n[1] + dir.z * n[2]; if (denom > -1e-5) return;
    const t = ((p.centre[0] - origin.x) * n[0] + (p.centre[1] - origin.y) * n[1] + (p.centre[2] - origin.z) * n[2]) / denom; if (t <= 0 || t >= bestT) return;
    const hx = origin.x + dir.x * t - p.centre[0], hy = origin.y + dir.y * t - p.centre[1], hz = origin.z + dir.z * t - p.centre[2];
    const along = hx * p.right[0] + hy * p.right[1] + hz * p.right[2], upward = hx * p.up[0] + hy * p.up[1] + hz * p.up[2];
    if (Math.abs(along) <= p.width / 2 * GROW * pad && Math.abs(upward) <= p.height / 2 * GROW * pad) { best = i; bestT = t; }
  });
  return best;
}
// The lit machine nearest to the middle of the view, if it is within `within` radians of it. The page names that
// machine's game on screen, and Enter or Space launches it.
export function facing(heading, screens, lit, within = 0.3) {
  let best = -1, least = within;
  screens.forEach((p, i) => { if (!lit[i]) return; const off = Math.abs(wrap(p.heading - heading)); if (off < least) { least = off; best = i; } });
  return best;
}
// The next lit machine to the right (step 1) or to the left (step -1) of a heading: the arrows turn the view to it.
// The machines stand in a circle, so the turn goes on round it.
export function neighbour(heading, screens, lit, step) {
  let best = -1, least = Infinity;
  screens.forEach((p, i) => { if (!lit[i]) return; const off = wrap(p.heading - heading) * step, turn = off > 0.02 ? off : off + 2 * Math.PI; if (turn < 2 * Math.PI - 0.02 && turn < least) { least = turn; best = i; } });
  return best;
}

// One walk step inside the walk circle. A step that would leave the circle slides along it.
export function walk(from, to) {
  const r = Math.hypot(to.x, to.z); if (r <= WALK) return to;
  if (r < Math.hypot(from.x, from.z)) return to;
  return { x: to.x / r * WALK, z: to.z / r * WALK };
}
