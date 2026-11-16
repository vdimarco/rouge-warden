// Riftwalk rules (public/lab/riftwalk/hall.js) and the hall's data (worlds/hall/screens.json): the collections match the
// homepage, each collection is one zone, every machine belongs to a zone and is sound, every game gets a machine on
// some page of its zone, a ray picks a lit screen or a rift ring, the view names the place in its middle, the arrows
// turn to the next place, the nearest station names the zone, and the visitor stays on the open floor.
// Run: node qa/lab/riftwalk.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROW, GROUPS, ZONES, SELF, direction, headingTo, gamesOf, zoneGames, seats, pages, assign, ringPlace, zoneAt, pick, facing, neighbour, walk } from '../../public/lab/riftwalk/hall.js';
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

{ // One zone for each collection, in the homepage order, each with a station on the open floor and a rift ring.
  assert.deepEqual(ZONES.map(z => [z.id, z.label, z.groups]), GROUPS.map(g => [g.id, g.label, [g.id]]));
  assert(readFileSync(new URL('public/lab/riftwalk/worlds/hall/' + HALL.file, root)).length > 5e6, 'the world file');
  assert(HALL.eye > 1.2 && HALL.eye < 1.8); const inside = (x, z) => x >= HALL.bounds.x[0] && x <= HALL.bounds.x[1] && z >= HALL.bounds.z[0] && z <= HALL.bounds.z[1];
  assert(inside(HALL.start.x, HALL.start.z), 'the visitor starts on the open floor');
  ZONES.forEach((z, i) => {
    assert.match(z.color, /^#[0-9a-f]{6}$/); const s = STATIONS[i]; assert(s, z.id + ' has a station'); assert(inside(...s.station), z.id + ': the station is on the open floor');
    const ring = ringPlace(s.ring); assert(near(len(ring.normal), 1, 1e-6) && near(len(ring.right), 1, 1e-6) && Math.abs(dot(ring.right, ring.normal)) < 1e-9); assert(ring.centre[1] - s.ring.radius > 2.4, z.id + ': the ring hangs over the machines'); assert(s.ring.radius >= 0.5 && s.ring.radius <= 1.2);
    // The ring faces the hall: its normal points from the wall toward the station's side.
    assert(dot([s.station[0] - ring.centre[0], 0, s.station[1] - ring.centre[2]], ring.normal) > 0, z.id + ': the ring faces the floor');
    assert.equal(zoneAt({ x: s.station[0], z: s.station[1] }, STATIONS), i, 'the nearest station names the zone');
  });
  pass('each collection is a zone with a station and a rift ring', { zones: ZONES.map(z => z.id) });
}

{ // The machines: unit axes at right angles, upright, a real size, against a wall outside the walking floor, in a zone.
  assert(SCREENS.length >= 30, 'the hall has machines: ' + SCREENS.length);
  SCREENS.forEach((s, i) => {
    assert(ZONES.some(z => z.id === s.zone), `screen ${i} is in a zone`);
    for (const v of [s.right, s.up, s.normal]) assert(near(len(v), 1, 1e-3), `screen ${i}: unit axis`);
    assert(Math.abs(dot(s.right, s.up)) < 1e-3 && Math.abs(dot(s.right, s.normal)) < 1e-3 && Math.abs(dot(s.up, s.normal)) < 1e-3, `screen ${i}: axes at right angles`);
    assert(s.up[1] > 0.9 && s.width > 0.3 && s.width < 0.8 && s.height > 0.6 && s.height < 1.4, `screen ${i} size`); assert(s.centre[1] > 1.1 && s.centre[1] < 2, `screen ${i} height over the floor`);
    const x = s.centre[0], z = s.centre[2]; assert(x < HALL.bounds.x[0] - 0.5 || x > HALL.bounds.x[1] + 0.5 || z < HALL.bounds.z[0] - 0.5 || z > HALL.bounds.z[1] + 0.5, `screen ${i} is outside the walking floor`);
    // The screen faces the middle of the floor.
    assert(dot([0 - x, 0, -8 - z], s.normal) > 0, `screen ${i} faces the hall`);
  });
  // No two screens overlap: neighbours on a wall are at least a screen's width apart.
  SCREENS.forEach((a, i) => SCREENS.forEach((b, k) => { if (k > i && dot(a.normal, b.normal) > 0.9) assert(Math.hypot(a.centre[0] - b.centre[0], a.centre[2] - b.centre[2]) > (a.width + b.width) / 2 * GROW, `screens ${i} and ${k} are apart`); }));
  pass('the machines of the hall are sound', { machines: SCREENS.length });
}

{ // Every game gets a machine on some page of its zone, once. The seats read from left to right for a visitor at the station.
  const all = new Set(); let machines = 0;
  ZONES.forEach((zone, zi) => {
    const s = STATIONS[zi], seatList = seats(zone.id, SCREENS, s.station, s.facing), games = zoneGames(zone.id, GAMES), count = pages(games.length, seatList.length);
    assert(seatList.length >= 1, zone.id + ' has machines'); assert.equal(new Set(seatList).size, seatList.length); assert(seatList.every(i => SCREENS[i].zone === zone.id)); assert.equal(seatList.length, SCREENS.filter(x => x.zone === zone.id).length); machines += seatList.length;
    assert.deepEqual(games.map(p => p.id), GROUPS.find(g => g.id === zone.id).games.filter(id => id !== SELF), zone.id + ': one portal for each game');
    assert.equal(count, Math.ceil(games.length / seatList.length) || 1);
    const shown = []; for (let page = 0; page < count; page++) { const m = assign(seatList, games, page); for (const [seat, game] of m) { assert(seatList.includes(seat)); shown.push(game.id); } }
    assert.deepEqual([...shown].sort(), games.map(p => p.id).sort(), zone.id + ': every game is on one machine of one page'); assert.equal(assign(seatList, games, 0).get(seatList[0]).id, games[0].id, 'the first game is on the first seat');
    // Most of the zone's machines are in front of a visitor who stands at the station and faces the cluster.
    const from = { x: s.station[0], z: s.station[1] }, ahead = seatList.filter(i => Math.abs(Math.atan2(Math.sin(headingTo(from, { x: SCREENS[i].centre[0], z: SCREENS[i].centre[2] }) - s.facing), Math.cos(headingTo(from, { x: SCREENS[i].centre[0], z: SCREENS[i].centre[2] }) - s.facing))) < 1.2).length;
    assert(ahead >= Math.min(3, seatList.length), `${zone.id}: ${ahead} machines in front of the station`);
    for (const p of games) { assert(p.url.startsWith('/') && p.url.endsWith('/')); assert(p.title && p.art && /^#/.test(p.color)); assert(!all.has(p.id)); all.add(p.id); }
  });
  const want = GROUPS.flatMap(g => g.games).filter(id => id !== SELF); assert.deepEqual([...all].sort(), [...want].sort()); assert(!all.has(SELF)); assert.equal(machines, SCREENS.length); assert.deepEqual(gamesOf('nowhere', GAMES), []); assert.deepEqual(zoneGames('nowhere', GAMES), []);
  pass(`every game has a machine in its zone (${want.length} games, ${machines} machines)`, Object.fromEntries(ZONES.map((z, i) => [z.id, `${zoneGames(z.id, GAMES).length}/${seats(z.id, SCREENS, STATIONS[i].station, STATIONS[i].facing).length}`])));
}

{ // Picking, facing and turning, from each station.
  const rings = STATIONS.map(z => ringPlace(z.ring)), places = SCREENS.concat(rings), all = places.map(() => true);
  ZONES.forEach((zone, zi) => {
    const s = STATIONS[zi], eye = { x: s.station[0], y: HALL.eye, z: s.station[1] };
    const seenFrom = places.map(p => { const dx = p.centre[0] - eye.x, dz = p.centre[2] - eye.z; return { ...p, heading: Math.atan2(dx, -dz), distance: Math.hypot(dx, dz) }; });
    const toward = (p, dx = 0, dy = 0) => { const c = [p.centre[0] + p.right[0] * dx + p.up[0] * dy, p.centre[1] + p.right[1] * dx + p.up[1] * dy, p.centre[2] + p.right[2] * dx + p.up[2] * dy], v = [c[0] - eye.x, c[1] - eye.y, c[2] - eye.z], l = Math.hypot(...v); return { x: v[0] / l, y: v[1] / l, z: v[2] / l }; };
    for (const i of seats(zone.id, SCREENS, s.station, s.facing)) {
      const p = places[i]; if (dot([eye.x - p.centre[0], 0, eye.z - p.centre[2]], p.normal) <= 0.3) continue;      // a machine seen from behind or edge on
      assert.equal(pick(eye, toward(p), places, all), i, `${zone.id}: a ray at screen ${i} picks it`); assert.equal(pick(eye, toward(p, 0, p.height * 0.9), places, all), -1, 'a ray over a screen picks none');
      assert.equal(pick(eye, toward(p), places, all.map((v, k) => k !== i)), -1, 'a dark screen is not picked');
    }
    const ring = SCREENS.length + zi; assert.equal(pick(eye, toward(places[ring]), places, all), ring, zone.id + ': a ray at the ring picks it');
    // A lap of the arrows stops at every place within reach, once, and comes back.
    const reach = 9, within = seenFrom.filter(p => p.distance <= reach).length; let h = s.facing; const lap = []; for (let k = 0; k < within; k++) { const i = neighbour(h, seenFrom, all, 1, reach); assert(i >= 0); lap.push(i); h = seenFrom[i].heading; }
    // A ring right over a machine has that machine's heading, so the lap can pass a few places over.
    assert(new Set(lap).size >= within * 0.8 && new Set(lap).size >= 3, `${zone.id}: a lap visits ${new Set(lap).size} of ${within} places in reach`);
    const front = facing(s.facing, seenFrom, all, 0.5, reach); assert(front >= 0, zone.id + ': a place is in front of the station');
    assert.equal(facing(s.facing, seenFrom, all, 0.5, 0.1), -1, 'nothing is in reach of a tiny reach');
  });
  assert.equal(neighbour(0, [], [], 1), -1); assert(near(direction(0).z, -1) && near(direction(Math.PI / 2).x, 1)); assert(near(headingTo({ x: 0, z: 0 }, { x: 1, z: 0 }), Math.PI / 2));
  pass('a ray picks a lit screen or a ring, and the arrows go round the places in reach');
}

{ // The walking floor is a box.
  const b = HALL.bounds; assert.deepEqual(walk({ x: 0, z: -8 }, b), { x: 0, z: -8 }); assert.deepEqual(walk({ x: 99, z: -8 }, b), { x: b.x[1], z: -8 }); assert.deepEqual(walk({ x: 0, z: 99 }, b), { x: 0, z: b.z[1] }); assert.deepEqual(walk({ x: -99, z: -99 }, b), { x: b.x[0], z: b.z[0] });
  pass('the visitor stays on the open floor');
}
console.log(n + ' checks passed');
