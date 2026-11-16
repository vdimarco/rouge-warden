// Riftwalk rules (public/lab/riftwalk/hall.js): the collections match the homepage, the rings of portals, the ray
// that picks a portal, the portal in the middle of the view, the turn to the next portal, and the walk circle.
// Run: node qa/lab/riftwalk.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EYE, WALK, RING, PORTAL_Y, MAX_RADIUS, GROUPS, SELF, direction, ring, hallPortals, groupPortals, groupArt, pick, facing, neighbour, walk } from '../../public/lab/riftwalk/hall.js';
const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
let n = 0; const pass = name => { n++; console.log('PASS ' + name); };

{ // The collections are the homepage's rows, game for game and in order.
  const home = read('public/index.html'), block = home.slice(home.indexOf('const GROUPS = ['), home.indexOf('];', home.indexOf('const GROUPS = [')));
  const rows = [...block.matchAll(/\{ id: "([^"]+)", label: "([^"]+)", games: \[([^\]]*)\]/g)].map(m => ({ id: m[1], label: m[2], games: [...m[3].matchAll(/"([^"]+)"/g)].map(x => x[1]) }));
  assert.equal(rows.length, 6, 'the homepage has six rows');
  assert.deepEqual(GROUPS.map(g => ({ id: g.id, label: g.label, games: g.games })), rows, 'hall.js GROUPS is the homepage GROUPS');
  for (const g of GROUPS) assert.match(g.color, /^#[0-9a-f]{6}$/);
}
pass('the six collections match the homepage rows, game for game');

// The arcade's list of games, read from switch.js.
const sw = read('public/arcade/switch.js'), GAMES = [...sw.matchAll(/\{ id: "([^"]+)", name: "([^"]+)", sub: "([^"]*)", url: "([^"]+)", art: "([^"]+)", color: "([^"]+)"/g)].map(m => ({ id: m[1], name: m[2], sub: m[3], url: m[4], art: m[5], color: m[6] }));
assert(GAMES.length >= 40, 'switch.js lists the games: ' + GAMES.length);
{
  const hall = hallPortals(); assert.equal(hall.length, 6); assert(hall.every(p => p.kind === 'group' && p.count >= 1));
  let total = 0; const seen = new Set();
  for (const g of GROUPS) {
    const list = groupPortals(g.id, GAMES), games = list.filter(p => p.kind === 'game');
    assert.equal(list.at(-1).kind, 'back', g.id + ': the back portal is the last one'); assert.equal(list.filter(p => p.kind === 'back').length, 1);
    // Every game of the row has a switcher entry, so every game gets a portal. The hall has no portal to itself.
    assert.deepEqual(games.map(p => p.id), g.games.filter(id => id !== SELF), g.id + ': one portal for each game of the row');
    assert.equal(games.length, hall.find(p => p.id === g.id).count, g.id + ': the collection portal counts its games');
    for (const p of games) { assert(p.url.startsWith('/') && p.url.endsWith('/'), p.id + ' route'); assert(p.title && p.art && /^#/.test(p.color)); assert(!seen.has(p.id), p.id + ' is in one collection'); seen.add(p.id); }
    assert(groupArt(g.id, GAMES), g.id + ': the collection has a picture'); total += games.length;
  }
  assert(!seen.has(SELF)); assert.equal(total, GROUPS.reduce((s, g) => s + g.games.length, 0) - 1);
  assert.deepEqual(groupPortals('nowhere', GAMES), []);
  pass(`every game of every row has a portal (${total} games), and the hall has none to itself`);
}

{ // A ring of portals.
  assert(near(direction(0).z, -1) && near(direction(Math.PI / 2).x, 1));
  for (const count of [1, 2, 3, 6, 9, 12, 21]) {
    const r = ring(count, 0.4); assert.equal(r.length, count);
    r.forEach((p, i) => {
      assert(near(Math.hypot(p.x, p.z), RING), 'on the ring'); assert.equal(p.y, PORTAL_Y); assert(p.radius > 0.2 && p.radius <= MAX_RADIUS);
      // The portal fronts the centre: its +z axis points from the portal to the centre.
      assert(near(Math.sin(p.yaw), -p.x / RING, 1e-9) && near(Math.cos(p.yaw), -p.z / RING, 1e-9), 'fronts the centre');
      // Neighbours keep a gap.
      const q = r[(i + 1) % count]; if (count > 1) assert(Math.hypot(p.x - q.x, p.z - q.z) >= (p.radius + q.radius) * 1.15, count + ' portals: a gap between neighbours');
    });
    assert(near(r[0].heading, 0.4, 1e-9), 'the first portal is where the visitor looks');
  }
  // The eye can pass through no portal while it stays in the walk circle, and a portal clears the floor.
  assert(WALK + MAX_RADIUS < RING, 'the walk circle stays inside the ring'); assert(PORTAL_Y - MAX_RADIUS > 0.3 && Math.abs(EYE - PORTAL_Y) < 0.4);
  pass('rings of 1 to 21 portals: on the ring, fronting the centre, with gaps');
}

{ // Picking, facing, turning.
  const r = ring(6, 0), eye = { x: 0, y: EYE, z: 0 }, at = h => ({ ...direction(h), y: (PORTAL_Y - EYE) / RING });
  const unit = v => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  r.forEach((p, i) => assert.equal(pick(eye, unit(at(p.heading)), r), i, 'a ray at portal ' + i + ' picks it'));
  assert.equal(pick(eye, unit(at(Math.PI / 6)), r), -1, 'a ray between two portals picks none');
  assert.equal(pick(eye, { x: 0, y: 1, z: 0 }, r), -1, 'a ray at the ceiling picks none');
  assert.equal(pick({ x: 0.9, y: EYE, z: 0.3 }, unit({ x: r[2].x - 0.9, y: PORTAL_Y - EYE, z: r[2].z - 0.3 }), r), 2, 'a pick from off the centre');
  assert.equal(facing(0.1, r), 0); assert.equal(facing(Math.PI / 6 + 0.2, r), 1);
  assert.equal(facing(Math.PI / 6, ring(6, 0), 0.2), -1, 'between two portals, none is in the middle of the view');
  // From a portal, right is the next one and left is the one before, and both wrap.
  assert.equal(neighbour(r[0].heading, r, 1), 1); assert.equal(neighbour(r[0].heading, r, -1), 5); assert.equal(neighbour(r[5].heading, r, 1), 0);
  // From between two portals, right goes to the one on the right and left to the one on the left.
  assert.equal(neighbour(0.3, r, 1), 1); assert.equal(neighbour(0.3, r, -1), 0);
  // A full lap by ▶ visits every portal once.
  let h = r[0].heading; const lap = []; for (let i = 0; i < 6; i++) { const k = neighbour(h, r, 1); lap.push(k); h = r[k].heading; } assert.deepEqual(lap, [1, 2, 3, 4, 5, 0]);
  assert.equal(neighbour(0, [], 1), -1);
  pass('a ray picks a portal, the view names the one in its middle, and the arrows turn to the next');
}

{ // The walk circle.
  assert.deepEqual(walk({ x: 0, z: 0 }, { x: 0.4, z: 0.3 }), { x: 0.4, z: 0.3 });
  const out = walk({ x: WALK, z: 0 }, { x: WALK + 0.3, z: 0.2 }); assert(Math.hypot(out.x, out.z) <= WALK + 1e-9);
  let p = { x: 0, z: 0 }; for (let i = 0; i < 300; i++) p = walk(p, { x: p.x + 0.03, z: p.z - 0.012 }); assert(Math.hypot(p.x, p.z) <= WALK + 1e-9);
  pass('the visitor stays in the walk circle');
}
console.log(n + ' checks passed');
