// Riftwalk rules (public/lab/riftwalk/hall.js) and the data of its zones (worlds/<zone>/screens.json): the collections
// match the homepage, every collection is in one zone, every game gets a machine on some page of its zone, the screens
// are sound, each zone has two rift doors clear of its machines, a ray picks a lit screen or a door, the view names the
// place in its middle, the arrows turn to the next place, and the visitor stays in the walk circle.
// Run: node qa/lab/riftwalk.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WALK, GROW, GROUPS, ZONES, DOOR, SELF, direction, gamesOf, zoneGames, doors, middle, order, pages, assign, pick, facing, neighbour, walk } from '../../public/lab/riftwalk/hall.js';
const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
let n = 0; const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };

{ // The collections are the homepage's rows, game for game and in order.
  const home = read('public/index.html'), block = home.slice(home.indexOf('const GROUPS = ['), home.indexOf('];', home.indexOf('const GROUPS = [')));
  const rows = [...block.matchAll(/\{ id: "([^"]+)", label: "([^"]+)", games: \[([^\]]*)\]/g)].map(m => ({ id: m[1], label: m[2], games: [...m[3].matchAll(/"([^"]+)"/g)].map(x => x[1]) }));
  assert.equal(rows.length, 6, 'the homepage has six rows');
  assert.deepEqual(GROUPS.map(g => ({ id: g.id, label: g.label, games: g.games })), rows, 'hall.js GROUPS is the homepage GROUPS');
  for (const g of GROUPS) assert.match(g.color, /^#[0-9a-f]{6}$/);
}
pass('the six collections match the homepage rows, game for game');

{ // Every collection is in one zone, and each zone has its world files and its door picture.
  assert.deepEqual(ZONES.flatMap(z => z.groups).sort(), GROUPS.map(g => g.id).sort(), 'each collection is in one zone');
  assert.equal(new Set(ZONES.map(z => z.id)).size, ZONES.length); assert(ZONES.length >= 3);
  for (const z of ZONES) { assert.match(z.color, /^#[0-9a-f]{6}$/); assert(z.label); const files = JSON.parse(read(`public/lab/riftwalk/worlds/${z.id}/screens.json`)).hall.files; assert(files.includes('150k'), z.id + ' has a small world');
    for (const f of files) assert(readFileSync(new URL(`public/lab/riftwalk/worlds/${z.id}/${f}.spz`, root)).length > 1e6, `${z.id}/${f}.spz`); assert(readFileSync(new URL(`public/lab/riftwalk/worlds/${z.id}/door.webp`, root)).length > 2000, z.id + ' door picture'); }
  pass('every collection is in one zone, and each zone has its world and its door picture', { zones: ZONES.map(z => z.id) });
}

// The arcade's list of games read from switch.js.
const sw = read('public/arcade/switch.js'), GAMES = [...sw.matchAll(/\{ id: "([^"]+)", name: "([^"]+)", sub: "([^"]*)", url: "([^"]+)", art: "([^"]+)", color: "([^"]+)"/g)].map(m => ({ id: m[1], name: m[2], sub: m[3], url: m[4], art: m[5], color: m[6] }));
assert(GAMES.length >= 40, 'switch.js lists the games: ' + GAMES.length);
const shownAll = new Set(); let machines = 0;

for (const zone of ZONES) {
const data = JSON.parse(read(`public/lab/riftwalk/worlds/${zone.id}/screens.json`)), SCREENS = data.screens; machines += SCREENS.length;

{ // The screens are sound: unit axes at right angles, a normal that looks back at the capture point, a real size.
  assert(SCREENS.length >= 6, 'the hall has machines: ' + SCREENS.length); assert(data.hall.scale > 0.2 && data.hall.ground > 0.5 && data.hall.ground < 2.2);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(...a), eye = [0, data.hall.ground, 0];
  SCREENS.forEach((s, i) => {
    for (const v of [s.right, s.up, s.normal]) assert(near(len(v), 1, 1e-3), `screen ${i}: unit axis`);
    assert(Math.abs(dot(s.right, s.up)) < 1e-3 && Math.abs(dot(s.right, s.normal)) < 1e-3 && Math.abs(dot(s.up, s.normal)) < 1e-3, `screen ${i}: axes at right angles`);
    const toEye = [eye[0] - s.centre[0], eye[1] - s.centre[1], eye[2] - s.centre[2]]; assert(dot(toEye, s.normal) / len(toEye) > 0.5, `screen ${i} faces the capture point`);
    assert(s.up[1] > 0.7, `screen ${i} is upright`); assert(s.width > 0.25 && s.width < 1.2 && s.height > 0.25 && s.height < 1.2, `screen ${i} size`);
    assert(near(len(toEye), s.distance, 0.02) && s.distance > 1 && s.distance < 6, `screen ${i} distance`); assert(s.centre[1] > 0.5 && s.centre[1] < 2, `screen ${i} height over the floor`);
    assert(near(s.heading, Math.atan2(s.centre[0], -s.centre[2]), 1e-3), `screen ${i} heading`); assert(s.square < 0.25, `screen ${i} was measured as a rectangle`);
    if (i) assert(s.heading > SCREENS[i - 1].heading, 'screens are sorted by heading');
    // No two screens overlap as seen from the capture point.
    if (i) assert(s.heading - SCREENS[i - 1].heading > (s.width + SCREENS[i - 1].width) / 2 * GROW / Math.min(s.distance, SCREENS[i - 1].distance), `screens ${i - 1} and ${i} are apart`);
    // The visitor cannot walk through a screen.
    assert(s.distance > WALK + 0.4, `screen ${i} is outside the walk circle`);
  });
  pass(zone.id + ': the screens are sound', { machines: SCREENS.length, width: +(SCREENS.reduce((a, s) => a + s.width, 0) / SCREENS.length).toFixed(2), height: +(SCREENS.reduce((a, s) => a + s.height, 0) / SCREENS.length).toFixed(2) });
}

{ // Every game of the zone gets a machine on some page, once, with the first game on the front machine.
  const games = zoneGames(zone.id, GAMES), count = pages(games.length, SCREENS);
  assert.deepEqual(games.map(p => p.id), zone.groups.flatMap(id => GROUPS.find(g => g.id === id).games).filter(id => id !== SELF), zone.id + ': one portal for each game of its collections');
  assert(games.length >= 1); assert.equal(count, Math.ceil(games.length / SCREENS.length) || 1);
  const shown = [];
  for (let page = 0; page < count; page++) { const seats = assign(SCREENS, games, page); assert.equal(seats.length, SCREENS.length); for (const game of seats) if (game) shown.push(game.id); }
  assert.deepEqual([...shown].sort(), games.map(p => p.id).sort(), zone.id + ': every game is on one machine of one page');
  assert.equal(assign(SCREENS, games, 0)[order(SCREENS)[0]].id, games[0].id); assert(near(SCREENS[order(SCREENS)[0]].heading, middle(SCREENS)));
  for (const p of games) { assert(p.url.startsWith('/') && p.url.endsWith('/'), p.id + ' route'); assert(p.title && p.art && /^#/.test(p.color)); assert(!shownAll.has(p.id)); shownAll.add(p.id); }
  // The order goes out from the front machine, right and left in turn.
  const seats = order(SCREENS); assert.equal(new Set(seats).size, SCREENS.length);
  const off = i => Math.abs(Math.atan2(Math.sin(SCREENS[i].heading - middle(SCREENS)), Math.cos(SCREENS[i].heading - middle(SCREENS))));
  for (let k = 1; k < seats.length; k++) assert(off(seats[k]) >= off(seats[k - 1]) - 1e-9, 'machines fill from the front outward');
  pass(`${zone.id}: every game has a machine on some page`, { games: games.length, pages: count });
}

{ // The two rift doors: one on each side, upright on the floor, facing the visitor, clear of the machines and outside
  // the walk circle. A ray at a door picks it, and the arrows stop at it.
  const ways = doors(SCREENS), places = SCREENS.concat(ways), all = places.map(() => true), eye = { x: 0, y: data.hall.ground, z: 0 };
  assert.deepEqual(ways.map(d => d.step), [-1, 1]); assert(ways[0].heading < 0 && ways[1].heading > 0);
  ways.forEach((d, k) => {
    assert(near(Math.hypot(d.centre[0], d.centre[2]), d.distance, 1e-6) && d.distance > WALK + 0.4 && d.distance < 5, 'the door is in the ring of machines: ' + d.distance); assert(d.width >= DOOR.least && d.width <= DOOR.most && d.height === DOOR.height); assert(d.centre[1] - d.height / 2 >= 0 && d.centre[1] - d.height / 2 < 0.2, 'the door stands on the floor');
    assert(near(d.normal[0] * d.centre[0] + d.normal[2] * d.centre[2], -d.distance, 1e-6), 'the door faces the middle');
    for (const s of SCREENS) { const apart = Math.abs(Math.atan2(Math.sin(s.heading - d.heading), Math.cos(s.heading - d.heading))); assert(apart > 0.2, `${zone.id}: door ${k} is ${apart.toFixed(2)} rad from a machine`); }
    const v = [d.centre[0], d.centre[1] - eye.y, d.centre[2]], l = Math.hypot(...v), i = SCREENS.length + k;
    assert.equal(pick(eye, { x: v[0] / l, y: v[1] / l, z: v[2] / l }, places, all), i, 'a ray at the door picks it'); assert.equal(facing(d.heading, places, all), i);
  });
  let h = places[0].heading; const lap = new Set(); for (let k = 0; k < places.length; k++) { const i = neighbour(h, places, all, 1); lap.add(i); h = places[i].heading; }
  assert.equal(lap.size, places.length, 'a lap of the arrows stops at every machine and both doors');
  pass(`${zone.id}: two rift doors stand clear of the machines`, ways.map(d => ({ at: Math.round(d.heading * 57.3), away: +d.distance.toFixed(2), wide: +d.width.toFixed(2) })));
}

{ // Picking, facing, turning, on the real screens.
  const eye = { x: 0, y: data.hall.ground, z: 0 }, all = SCREENS.map(() => true);
  const toward = (s, dx = 0, dy = 0) => { const c = [s.centre[0] + s.right[0] * dx + s.up[0] * dy, s.centre[1] + s.right[1] * dx + s.up[1] * dy, s.centre[2] + s.right[2] * dx + s.up[2] * dy], v = [c[0] - eye.x, c[1] - eye.y, c[2] - eye.z], l = Math.hypot(...v); return { x: v[0] / l, y: v[1] / l, z: v[2] / l }; };
  SCREENS.forEach((s, i) => {
    assert.equal(pick(eye, toward(s), SCREENS, all), i, 'a ray at screen ' + i + ' picks it');
    assert.equal(pick(eye, toward(s, s.width * 0.45, -s.height * 0.45), SCREENS, all), i, 'a ray near a corner of screen ' + i + ' picks it');
    assert.equal(pick(eye, toward(s, 0, s.height * 1.2), SCREENS, all), -1, 'a ray over screen ' + i + ' picks none');
    assert.equal(pick(eye, toward(s), SCREENS, all.map((v, k) => k !== i)), -1, 'a dark screen is not picked');
    assert.equal(facing(s.heading, SCREENS, all), i); assert.equal(facing(s.heading, SCREENS, all.map((v, k) => k !== i), 0.1), -1);
  });
  assert.equal(pick(eye, { x: 0, y: 1, z: 0 }, SCREENS, all), -1);
  // A full lap to the right visits every machine once and comes back; a lap to the left is the same lap backward.
  let h = SCREENS[0].heading; const lap = []; for (let k = 0; k < SCREENS.length; k++) { const i = neighbour(h, SCREENS, all, 1); lap.push(i); h = SCREENS[i].heading; }
  assert.deepEqual(lap, [...SCREENS.keys()].slice(1).concat(0), 'a lap to the right'); h = SCREENS[0].heading; const back = []; for (let k = 0; k < SCREENS.length; k++) { const i = neighbour(h, SCREENS, all, -1); back.push(i); h = SCREENS[i].heading; }
  assert.deepEqual(back, [...SCREENS.keys()].reverse(), 'a lap to the left');
  // Dark machines are stepped over, and with one lit machine there is nowhere to turn.
  const two = all.map((v, k) => k === 0 || k === 3); assert.equal(neighbour(SCREENS[0].heading, SCREENS, two, 1), 3); assert.equal(neighbour(SCREENS[3].heading, SCREENS, two, 1), 0);
  assert.equal(neighbour(SCREENS[0].heading, SCREENS, all.map((v, k) => k === 0), 1), -1); assert.equal(neighbour(0, [], [], 1), -1);
  assert(near(direction(0).z, -1) && near(direction(Math.PI / 2).x, 1));
  pass(zone.id + ': a ray picks a lit screen, the view names the machine in its middle, and the arrows go round');
}
}

{ // Across the zones: every game of the arcade but the hall itself has one machine.
  const want = GROUPS.flatMap(g => g.games).filter(id => id !== SELF); assert.deepEqual([...shownAll].sort(), [...want].sort()); assert(!shownAll.has(SELF)); assert.deepEqual(gamesOf('nowhere', GAMES), []); assert.deepEqual(zoneGames('nowhere', GAMES), []);
  pass(`every game has a machine in one zone (${want.length} games, ${machines} machines)`);
}

{ // The walk circle.
  assert.deepEqual(walk({ x: 0, z: 0 }, { x: 0.4, z: 0.3 }), { x: 0.4, z: 0.3 });
  const out = walk({ x: WALK, z: 0 }, { x: WALK + 0.3, z: 0.2 }); assert(Math.hypot(out.x, out.z) <= WALK + 1e-9);
  let p = { x: 0, z: 0 }; for (let i = 0; i < 300; i++) p = walk(p, { x: p.x + 0.03, z: p.z - 0.012 }); assert(Math.hypot(p.x, p.z) <= WALK + 1e-9);
  pass('the visitor stays in the walk circle');
}
console.log(n + ' checks passed');
