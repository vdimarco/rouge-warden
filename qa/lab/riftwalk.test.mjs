// Riftwalk rules (public/lab/riftwalk/hall.js) and the hall's data (worlds/hall/screens.json): the collections match the
// homepage, each collection is one zone, every machine belongs to a zone and is sound, every game gets a machine on
// some page of its zone, a ray picks a lit screen or a rift ring, the view names the place in its middle, the arrows
// turn to the next place, the nearest station names the zone, and the visitor stays on the open floor.
// Run: node qa/lab/riftwalk.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROW, GROUPS, ZONES, SELF, direction, headingTo, gamesOf, zoneGames, seats, pages, assign, ringPlace, roomSeats, exitRing, walkRoom, zoneAt, pick, facing, neighbour, walk } from '../../public/lab/riftwalk/hall.js';
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
    assert.equal(typeof s.room, 'boolean'); if (!s.room) { assert.equal(zoneAt({ x: s.station[0], z: s.station[1] }, STATIONS), i, 'the nearest station names the zone'); return; }
    const ring = ringPlace(s.ring); assert(near(len(ring.normal), 1, 1e-6) && near(len(ring.right), 1, 1e-6) && Math.abs(dot(ring.right, ring.normal)) < 1e-9); assert(ring.centre[1] - s.ring.radius > 2.4, z.id + ': the ring hangs over the machines'); assert(s.ring.radius >= 0.5 && s.ring.radius <= 1.2);
    // The ring faces the hall: its normal points from the wall toward the station's side.
    assert(dot([s.station[0] - ring.centre[0], 0, s.station[1] - ring.centre[2]], ring.normal) > 0, z.id + ': the ring faces the floor');
    assert.equal(zoneAt({ x: s.station[0], z: s.station[1] }, STATIONS), i, 'the nearest station names the zone');
  });
  // A zone with many games has a room of its own behind its ring. A zone with a few games does not need one.
  ZONES.forEach((z, i) => assert.equal(STATIONS[i].room, zoneGames(z.id, GAMES).length > 3, z.id + ': a room for a large zone only'));
  pass('each collection is a zone with a station, and each large zone has a rift ring', { rooms: ZONES.filter((z, i) => STATIONS[i].room).map(z => z.id) });
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
    // No machine of the hall is idle on the first page, and a zone has no more machines than games.
    assert(seatList.length <= games.length, `${zone.id}: ${seatList.length} machines for ${games.length} games`); assert.equal(assign(seatList, games, 0).size, seatList.length);
    // The order runs along the cluster: neighbours in the order are neighbours on the wall, but for one step across the hall.
    let jumps = 0; for (let k = 1; k < seatList.length; k++) { const a = SCREENS[seatList[k - 1]], b = SCREENS[seatList[k]]; if (Math.hypot(a.centre[0] - b.centre[0], a.centre[2] - b.centre[2]) > 1.2) jumps++; } assert(jumps <= 3, `${zone.id}: the order jumps ${jumps} times`);
    for (const p of games) { assert(p.url.startsWith('/') && p.url.endsWith('/')); assert(p.title && p.art && /^#/.test(p.color)); assert(!all.has(p.id)); all.add(p.id); }
  });
  const want = GROUPS.flatMap(g => g.games).filter(id => id !== SELF); assert.deepEqual([...all].sort(), [...want].sort()); assert(!all.has(SELF)); assert.equal(machines, SCREENS.length); assert.deepEqual(gamesOf('nowhere', GAMES), []); assert.deepEqual(zoneGames('nowhere', GAMES), []);
  pass(`every game has a machine in its zone (${want.length} games, ${machines} machines)`, Object.fromEntries(ZONES.map((z, i) => [z.id, `${zoneGames(z.id, GAMES).length}/${seats(z.id, SCREENS, STATIONS[i].station, STATIONS[i].facing).length}`])));
}

{ // Picking, facing and turning, from each station.
  const ringed = ZONES.map((z, i) => i).filter(i => STATIONS[i].room), rings = ringed.map(i => ringPlace(STATIONS[i].ring)), places = SCREENS.concat(rings), all = places.map(() => true);
  ZONES.forEach((zone, zi) => {
    const s = STATIONS[zi], eye = { x: s.station[0], y: HALL.eye, z: s.station[1] };
    const seenFrom = places.map(p => { const dx = p.centre[0] - eye.x, dz = p.centre[2] - eye.z; return { ...p, heading: Math.atan2(dx, -dz), distance: Math.hypot(dx, dz) }; });
    const toward = (p, dx = 0, dy = 0) => { const c = [p.centre[0] + p.right[0] * dx + p.up[0] * dy, p.centre[1] + p.right[1] * dx + p.up[1] * dy, p.centre[2] + p.right[2] * dx + p.up[2] * dy], v = [c[0] - eye.x, c[1] - eye.y, c[2] - eye.z], l = Math.hypot(...v); return { x: v[0] / l, y: v[1] / l, z: v[2] / l }; };
    for (const i of seats(zone.id, SCREENS, s.station, s.facing)) {
      const p = places[i]; if (dot([eye.x - p.centre[0], 0, eye.z - p.centre[2]], p.normal) <= 0.3) continue;      // a machine seen from behind or edge on
      assert.equal(pick(eye, toward(p), places, all), i, `${zone.id}: a ray at screen ${i} picks it`); assert.equal(pick(eye, toward(p, 0, p.height * 0.9), places, all), -1, 'a ray over a screen picks none');
      assert.equal(pick(eye, toward(p), places, all.map((v, k) => k !== i)), -1, 'a dark screen is not picked');
    }
    const ring = SCREENS.length + ringed.indexOf(zi); if (ring >= SCREENS.length) assert.equal(pick(eye, toward(places[ring]), places, all), ring, zone.id + ': a ray at the ring picks it');
    // A lap of the arrows stops at every place within reach, once, and comes back.
    const reach = 9, within = seenFrom.filter(p => p.distance <= reach).length; let h = s.facing; const lap = []; for (let k = 0; k < within; k++) { const i = neighbour(h, seenFrom, all, 1, reach); assert(i >= 0); lap.push(i); h = seenFrom[i].heading; }
    // A ring right over a machine has that machine's heading, so the lap can pass a few places over.
    assert(new Set(lap).size >= within * 0.8 && new Set(lap).size >= 3, `${zone.id}: a lap visits ${new Set(lap).size} of ${within} places in reach`);
    const front = facing(s.facing, seenFrom, all, 0.9, reach); assert(front >= 0, zone.id + ': a place is near the front of the station');
    assert.equal(facing(s.facing, seenFrom, all, 0.5, 0.1), -1, 'nothing is in reach of a tiny reach');
  });
  assert.equal(neighbour(0, [], [], 1), -1); assert(near(direction(0).z, -1) && near(direction(Math.PI / 2).x, 1)); assert(near(headingTo({ x: 0, z: 0 }, { x: 1, z: 0 }), Math.PI / 2));
  pass('a ray picks a lit screen or a ring, and the arrows go round the places in reach');
}

{ // The rooms: each zone has a small world of its own, with machines around the visitor, the zone's games from the front
  // machine outward, and a ring back to the hall that stands clear of the machines.
  const rooms = {};
  ZONES.filter((z, i) => STATIONS[i].room).forEach(zone => {
    const dir = `public/lab/riftwalk/worlds/rooms/${zone.id}/`, room = JSON.parse(read(dir + 'screens.json')), S = room.screens; rooms[zone.id] = S.length;
    for (const f of ['150k.spz', '500k.spz']) assert(readFileSync(new URL(dir + f, root)).length > 1e6, dir + f); assert(readFileSync(new URL(dir + 'door.webp', root)).length > 2000, zone.id + ': the picture its ring shows');
    assert(S.length >= 1 && room.hall.scale > 0.2 && room.hall.ground > 0.5 && room.hall.ground < 2.2, zone.id + ' room numbers');
    for (const p of S) { for (const v of [p.right, p.up, p.normal]) assert(near(len(v), 1, 1e-3)); assert(p.width > 0.25 && p.height > 0.25 && p.distance > 1.3, zone.id + ': a machine is outside the walk circle'); assert(near(p.heading, Math.atan2(p.centre[0], -p.centre[2]), 1e-3)); }
    const order = roomSeats(S), games = zoneGames(zone.id, GAMES), count = pages(games.length, S.length); assert.deepEqual([...order].sort((a, b) => a - b), S.map((p, i) => i), 'every machine has a seat');
    assert.equal(assign(order, games, 0).get(order[0]).id, games[0].id, 'the first game is on the front machine'); assert(S.every(p => Math.abs(S[order[0]].heading) <= Math.abs(p.heading) + 1e-9));
    // The order goes clockwise round the visitor, and the room is about the size of its zone.
    const turn = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); for (let k = 1; k < order.length; k++) assert(turn(S[order[k]].heading - S[order[0]].heading) > turn(S[order[k - 1]].heading - S[order[0]].heading), zone.id + ': clockwise');
    assert(S.length <= games.length + 1, `${zone.id}: ${S.length} machines in the room for ${games.length} games`);
    const shown = []; for (let page = 0; page < count; page++) for (const [, game] of assign(order, games, page)) shown.push(game.id); assert.deepEqual(shown.sort(), games.map(g => g.id).sort(), zone.id + ': every game is in its room');
    const exit = exitRing(S), places = S.concat([exit]), all = places.map(() => true), eye = { x: 0, y: room.hall.ground, z: 0 };
    for (const p of S) { const apart = Math.abs(Math.atan2(Math.sin(p.heading - exit.heading), Math.cos(p.heading - exit.heading))); assert(apart > 0.22, `${zone.id}: the way out is ${apart.toFixed(2)} rad from a machine`); }
    assert(exit.distance > 1.6 && exit.distance <= 4.5 && near(len(exit.normal), 1, 1e-9) && exit.normal[0] * exit.centre[0] + exit.normal[2] * exit.centre[2] < 0, 'the way out faces the visitor');
    const v = [exit.centre[0], exit.centre[1] - eye.y, exit.centre[2]], l = Math.hypot(...v); assert.equal(pick(eye, { x: v[0] / l, y: v[1] / l, z: v[2] / l }, places, all), S.length, 'a ray at the way out picks it');
  });
  assert.deepEqual(walkRoom({ x: 0.3, z: 0.4 }), { x: 0.3, z: 0.4 }); const out = walkRoom({ x: 3, z: 4 }); assert(near(Math.hypot(out.x, out.z), 1, 1e-9));
  pass('each large zone has a room of its own with machines, its games in order and a way back', rooms);
}

{ // The walking floor is a box.
  const b = HALL.bounds; assert.deepEqual(walk({ x: 0, z: -8 }, b), { x: 0, z: -8 }); assert.deepEqual(walk({ x: 99, z: -8 }, b), { x: b.x[1], z: -8 }); assert.deepEqual(walk({ x: 0, z: 99 }, b), { x: 0, z: b.z[1] }); assert.deepEqual(walk({ x: -99, z: -99 }, b), { x: b.x[0], z: b.z[0] });
  pass('the visitor stays on the open floor');
}
console.log(n + ' checks passed');
