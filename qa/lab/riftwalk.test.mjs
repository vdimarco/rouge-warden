// Riftwalk rules (public/lab/riftwalk/hall.js) and the alley's data (worlds/hall/screens.json): the collections match
// the homepage, each collection is one zone with a storefront door on the alley, a ray picks a door, the arrows turn
// from door to door, the nearest station names the zone, every game gets a floating frame in its zone's world, and the
// visitor stays on the two streets. The machine rules (seats, roomSeats) are checked with made-up machines.
// Run: node qa/lab/riftwalk.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROW, GROUPS, ZONES, SELF, direction, headingTo, gamesOf, zoneGames, seats, pages, assign, ringPlace, roomSeats, exitRing, frameRing, FRAMES, walkRoom, zoneAt, pick, facing, neighbour, walk } from '../../public/lab/riftwalk/hall.js';
const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
let n = 0; const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(...a);

{ // The collections are the homepage's rows, game for game and in order.
  const home = read('public/index.html'), block = home.slice(home.indexOf('const GROUPS = ['), home.indexOf('];', home.indexOf('const GROUPS = [')));
  const rows = [...block.matchAll(/\{ id: "([^"]+)", label: "([^"]+)", games: \[([^\]]*)\]/g)].map(m => ({ id: m[1], label: m[2], games: [...m[3].matchAll(/"([^"]+)"/g)].map(x => x[1]) }));
  assert.equal(rows.length, 6, 'the homepage has six rows');
  assert.deepEqual(GROUPS.map(g => ({ id: g.id, label: g.label, games: g.games })), rows, 'hall.js GROUPS is the homepage GROUPS');
  for (const g of GROUPS) assert.match(g.color, /^#[0-9a-f]{6}$/);
}
pass('the six collections match the homepage rows, game for game');

const data = JSON.parse(read('public/lab/riftwalk/worlds/hall/screens.json')), SCREENS = data.screens, HALL = data.hall, STATIONS = ZONES.map(z => data.zones[z.id]);
const sw = read('public/arcade/switch.js'), GAMES = [...sw.matchAll(/\{ id: "([^"]+)", name: "([^"]+)", sub: "([^"]*)", url: "([^"]+)", art: "([^"]+)", color: "([^"]+)"/g)].map(m => ({ id: m[1], name: m[2], sub: m[3], url: m[4], art: m[5], color: m[6] }));
assert(GAMES.length >= 40, 'switch.js lists the games: ' + GAMES.length);

{ // One zone for each collection, in the homepage order. The alley has no machines: each zone is a storefront with a
  // station on the street and a door on the shop front, upright, door-sized, on the ground, facing its station.
  assert.deepEqual(ZONES.map(z => [z.id, z.label, z.groups]), GROUPS.map(g => [g.id, g.label, [g.id]]));
  assert(readFileSync(new URL('public/lab/riftwalk/worlds/hall/' + HALL.file, root)).length > 5e6, 'the world file');
  // A touch device gets a smaller file of the same alley.
  { const big = readFileSync(new URL('public/lab/riftwalk/worlds/hall/' + HALL.file, root)).length, small = readFileSync(new URL('public/lab/riftwalk/worlds/hall/' + HALL.fileTouch, root)).length; assert(small > 5e6 && small < big * 0.6, 'the touch file is about half the size'); }
  assert(HALL.eye > 1.2 && HALL.eye < 1.8); assert.equal(HALL.flip, false); assert(near(HALL.offset[1], HALL.eye), 'the floor of the alley is at 0'); assert.deepEqual(SCREENS, [], 'the alley has no machines');
  const boxes = HALL.bounds.boxes; assert(boxes.length >= 2); const inside = (x, z) => boxes.some(b => x >= b.x[0] && x <= b.x[1] && z >= b.z[0] && z <= b.z[1]);
  assert(inside(HALL.start.x, HALL.start.z), 'the visitor starts on the street');
  const doors = ZONES.map((z, i) => {
    assert.match(z.color, /^#[0-9a-f]{6}$/); const s = STATIONS[i]; assert(s, z.id + ' has a station'); assert(inside(...s.station), z.id + ': the station is on the street'); assert.equal(s.room, true, z.id + ' has a world behind its door');
    const door = ringPlace(s.ring); assert.equal(door.box, true); assert(near(len(door.normal), 1, 1e-6) && near(len(door.right), 1, 1e-6) && Math.abs(dot(door.right, door.normal)) < 1e-9);
    assert(door.width >= 1.2 && door.width <= 2 && door.height >= 1.8 && door.height <= 2.4, z.id + ': door size'); assert(door.centre[1] - door.height / 2 >= 0 && door.centre[1] - door.height / 2 < 0.2, z.id + ': the door stands on the ground');
    assert(!inside(door.centre[0], door.centre[2]), z.id + ': the door is on a wall, off the street');
    const to = [s.station[0] - door.centre[0], 0, s.station[1] - door.centre[2]], far = len(to); assert(dot(to, door.normal) / far > 0.95, z.id + ': the door faces its station'); assert(far > 2.4 && far < 5, z.id + ': the station is ' + far.toFixed(1) + ' m from the door');
    assert(Math.abs(Math.atan2(Math.sin(headingTo({ x: s.station[0], z: s.station[1] }, { x: door.centre[0], z: door.centre[2] }) - s.facing), Math.cos(headingTo({ x: s.station[0], z: s.station[1] }, { x: door.centre[0], z: door.centre[2] }) - s.facing))) < 0.1, z.id + ': the station looks at the door');
    assert.equal(zoneAt({ x: s.station[0], z: s.station[1] }, STATIONS), i, 'the nearest station names the zone'); return door;
  });
  doors.forEach((a, i) => doors.forEach((b, k) => { if (k > i) assert(Math.hypot(a.centre[0] - b.centre[0], a.centre[2] - b.centre[2]) > 2, `doors ${i} and ${k} are apart`); }));
  // A round ring is still a place: the way out of a world is one.
  const round = ringPlace({ centre: [0, 2, -3], normal: [0, 0, 1], radius: 0.5 }); assert(!round.box && round.width === 1 && round.height === 1);
  pass('each collection is a zone with a storefront door on the alley', { shops: Object.fromEntries(ZONES.map((z, i) => [z.id, STATIONS[i].shop])) });
}

{ // Every game belongs to one zone, once, in the homepage order. With no machines a zone has one page in the alley.
  const all = new Set();
  ZONES.forEach(zone => {
    const games = zoneGames(zone.id, GAMES); assert.deepEqual(games.map(p => p.id), GROUPS.find(g => g.id === zone.id).games.filter(id => id !== SELF), zone.id + ': its games in order');
    assert.deepEqual(seats(zone.id, SCREENS, [0, 0], 0), []); assert.equal(pages(games.length, 0), 1); assert.equal(assign([], games, 0).size, 0);
    for (const p of games) { assert(p.url.startsWith('/') && p.url.endsWith('/')); assert(p.title && p.art && /^#/.test(p.color)); assert(!all.has(p.id)); all.add(p.id); }
  });
  const want = GROUPS.flatMap(g => g.games).filter(id => id !== SELF); assert.deepEqual([...all].sort(), [...want].sort()); assert(!all.has(SELF)); assert.deepEqual(gamesOf('nowhere', GAMES), []); assert.deepEqual(zoneGames('nowhere', GAMES), []);
  // The machine rules still hold for a world that has machines: a row of four reads from left to right, and pages cover every game.
  const row = [-0.9, -0.3, 0.3, 0.9].map(x => ({ zone: 'action', centre: [x, 1.5, -3], right: [1, 0, 0], up: [0, 1, 0], normal: [0, 0, 1], width: 0.5, height: 0.7 }));
  const order = seats('action', row, [0, 0], 0); assert.deepEqual(order, [0, 1, 2, 3]); assert.equal(pages(9, 4), 3); assert.equal(pages(4, 4), 1);
  const nine = Array.from({ length: 9 }, (v, k) => ({ id: 'g' + k })), shown = []; for (let page = 0; page < 3; page++) for (const [, g] of assign(order, nine, page)) shown.push(g.id); assert.deepEqual(shown, nine.map(g => g.id));
  const round = [0, 1, 2, -1].map(h => ({ heading: h, distance: 3 })); assert.deepEqual(roomSeats(round), [0, 1, 2, 3]);
  pass(`every game belongs to one zone (${want.length} games)`, Object.fromEntries(ZONES.map(z => [z.id, zoneGames(z.id, GAMES).length])));
}

{ // Picking, facing and turning, from each station: the doors are the only places of the alley.
  const places = ZONES.map((z, i) => ringPlace(STATIONS[i].ring)), all = places.map(() => true);
  ZONES.forEach((zone, zi) => {
    const s = STATIONS[zi], eye = { x: s.station[0], y: HALL.eye, z: s.station[1] };
    const seenFrom = places.map(p => { const dx = p.centre[0] - eye.x, dz = p.centre[2] - eye.z; return { ...p, heading: Math.atan2(dx, -dz), distance: Math.hypot(dx, dz) }; });
    const toward = (p, dx = 0, dy = 0) => { const c = [p.centre[0] + p.right[0] * dx + p.up[0] * dy, p.centre[1] + p.right[1] * dx + p.up[1] * dy, p.centre[2] + p.right[2] * dx + p.up[2] * dy], v = [c[0] - eye.x, c[1] - eye.y, c[2] - eye.z], l = Math.hypot(...v); return { x: v[0] / l, y: v[1] / l, z: v[2] / l }; };
    const p = places[zi]; assert.equal(pick(eye, toward(p), places, all), zi, zone.id + ': a ray at the door picks it'); assert.equal(pick(eye, toward(p, 0, p.height * 0.9), places, all), -1, 'a ray over a door picks none');
    assert.equal(pick(eye, toward(p), places, all.map((v, k) => k !== zi)), -1, 'a dark door is not picked');
    assert.equal(facing(s.facing, seenFrom, all, 0.3, 9), zi, zone.id + ': its door is in front of the station');
    // A lap of the arrows stops at every door within reach and comes back.
    const reach = 9, within = seenFrom.filter(q => q.distance <= reach).length; let h = s.facing; const lap = []; for (let k = 0; k < within; k++) { const i = neighbour(h, seenFrom, all, 1, reach); assert(i >= 0); lap.push(i); h = seenFrom[i].heading; }
    assert(within >= 2 && new Set(lap).size >= within - 1, `${zone.id}: a lap visits ${new Set(lap).size} of ${within} doors in reach`);
    assert.equal(facing(s.facing, seenFrom, all, 0.5, 0.1), -1, 'nothing is in reach of a tiny reach');
  });
  assert.equal(neighbour(0, [], [], 1), -1); assert(near(direction(0).z, -1) && near(direction(Math.PI / 2).x, 1)); assert(near(headingTo({ x: 0, z: 0 }, { x: 1, z: 0 }), Math.PI / 2));
  pass('a ray picks a door, and the arrows go round the doors in reach');
}

{ // The worlds behind the doors: each zone has a scenery world with its files, a door picture, and one floating frame
  // for each game: the first one ahead, each facing the visitor, none overlapping, and the way back behind the visitor.
  const rooms = {};
  ZONES.forEach(zone => {
    const dir = `public/lab/riftwalk/worlds/rooms/${zone.id}/`, room = JSON.parse(read(dir + 'screens.json')), h = room.hall, eye = h.eye ?? h.ground;
    for (const f of ['150k.spz', '500k.spz']) assert(readFileSync(new URL(dir + f, root)).length > 1e6, dir + f); assert(readFileSync(new URL(dir + 'door.webp', root)).length > 2000, zone.id + ': the picture its door shows');
    assert(h.scale > 0.2 && eye > 1.2 && eye < 1.8 && h.ground >= 0 && h.ground < 2.2, zone.id + ' world numbers'); assert.equal(h.frames, true); assert.deepEqual(room.screens, []);
    if (h.flip === false) assert(Number.isFinite(h.turn) && h.ground === 0, zone.id + ': an app export stands on y = 0');
    const games = zoneGames(zone.id, GAMES), F = frameRing(games.length, eye); rooms[zone.id] = `${F.length} of ${games.length}`; assert.equal(F.length, Math.min(FRAMES.most, games.length), zone.id + ': a frame for each game');
    F.forEach((f, k) => { assert(near(len(f.normal), 1, 1e-9) && near(f.normal[0] * f.centre[0] + f.normal[2] * f.centre[2], -f.distance, 1e-9), 'a frame faces the visitor'); assert(f.distance > 1.5 && Math.abs(f.centre[1] - eye) < 0.2); if (k) assert(((f.heading - F[k - 1].heading + 2 * Math.PI) % (2 * Math.PI)) * f.distance > (f.width + F[k - 1].width) / 2, zone.id + ': frames do not overlap'); });
    assert(near(F[0].heading, 0, 1e-9)); assert.deepEqual(roomSeats(F), F.map((f, k) => k), 'the frames take the games in order');
    const count = pages(games.length, F.length), shown = []; for (let page = 0; page < count; page++) for (const [, g] of assign(roomSeats(F), games, page)) shown.push(g.id); assert.deepEqual(shown, games.map(g => g.id), zone.id + ': every game is in its world, in order');
    const exit = exitRing(F), places = F.concat([exit]), all = places.map(() => true); for (const f of F) assert(Math.abs(Math.atan2(Math.sin(f.heading - exit.heading), Math.cos(f.heading - exit.heading))) > 0.4, zone.id + ': the way out is clear of the frames');
    assert(Math.abs(Math.atan2(Math.sin(exit.heading), Math.cos(exit.heading))) > 1.7, zone.id + ': the way back is behind the visitor');
    const v = [exit.centre[0], exit.centre[1] - eye, exit.centre[2]], l = Math.hypot(...v); assert.equal(pick({ x: 0, y: eye, z: 0 }, { x: v[0] / l, y: v[1] / l, z: v[2] / l }, places, all), F.length, 'a ray at the way out picks it');
  });
  assert.equal(frameRing(99).length, FRAMES.most); assert.equal(frameRing(0).length, 0);
  assert.deepEqual(walkRoom({ x: 0.3, z: 0.4 }), { x: 0.3, z: 0.4 }); const out = walkRoom({ x: 3, z: 4 }); assert(near(Math.hypot(out.x, out.z), 1, 1e-9));
  pass('each zone has a world of its own with a frame for each game and a way back', rooms);
}

{ // The walking floor: one box, or two streets that cross. A step off the streets ends on the nearest street.
  const b = { x: [-2, 2], z: [-9, -1] }; assert.deepEqual(walk({ x: 0, z: -8 }, b), { x: 0, z: -8 }); assert.deepEqual(walk({ x: 99, z: -8 }, b), { x: 2, z: -8 }); assert.deepEqual(walk({ x: -99, z: -99 }, b), { x: -2, z: -9 });
  const cross = HALL.bounds, [street, alley] = cross.boxes; assert.deepEqual(walk({ x: 0, z: -1 }, cross), { x: 0, z: -1 }); assert.deepEqual(walk({ x: 5, z: -1 }, cross), { x: 5, z: -1 }); assert.deepEqual(walk({ x: 0, z: -9 }, cross), { x: 0, z: -9 });
  // A corner building: the step goes back to the nearer street.
  const corner = walk({ x: 4, z: street.z[0] - 0.4 }, cross); assert.deepEqual(corner, { x: 4, z: street.z[0] }); const deep = walk({ x: alley.x[1] + 0.3, z: -9 }, cross); assert.deepEqual(deep, { x: alley.x[1], z: -9 });
  pass('the visitor stays on the streets');
}

console.log(`${n} checks passed`);
