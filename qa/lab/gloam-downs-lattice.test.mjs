// Gloam Downs: the Gilt Lattice, three explorer places beside the five of the downs. Node only, no browser.
//   The save (save.js): the Lattice's wisps, lit beacons and `at` are kept or dropped by the chain, and old saves still load.
//   The lists (places.js): the names, the next place in a set, the Map's two groups, its count line, the arrival line, the HUD hint and
//   the choice of ?place=.
//   The bake's lists (bake.mjs): LATTICE, and ORDER stays the five of the run.
//   The two colour rules of lib/check.mjs for a place with set: 'lattice'.
//   With the three places baked: their budgets, their palettes (the first 32 colours differ from the five and from each other), the
//   colour rules on their JSON, and no zones. GLOAM_WORLDS=0 skips the baked places.
// Run: node qa/lab/gloam-downs-lattice.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clean, fresh, ORDER, LATTICE, latticeOpen, latticeWisps, wispCount } from '../../public/lab/gloam-downs/save.js';
import { LATTICE_NAMES, placeName, nextOf, mapGroups, mapLine, arriveLine, hintOf, startPlace, isOpen } from '../../public/lab/gloam-downs/places.js';
import { NAMES, routeOf } from '../../public/lab/gloam-downs/screens.js';

const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/', import.meta.url));
let n = 0;
const pass = name => { n++; console.log('PASS ' + name); };

/* ---------------- the save ---------------- */
{ // a fresh save: the Lattice's first place is open, the others are not, and the fields are the same as before
  const s = fresh();
  assert.deepEqual(LATTICE, ['piazza', 'cupola', 'orrery']);
  assert.deepEqual(ORDER, ['gaol', 'ramparts', 'fen', 'bells', 'barrows']);
  assert.deepEqual(LATTICE.map(id => latticeOpen(s, id)), [true, false, false]);
  assert.equal(latticeOpen(s, 'gaol'), false, 'a downs id is not a Lattice place');
  assert.equal(latticeWisps(s), 0);
  assert.deepEqual(Object.keys(clean({ wisps: { piazza: [1] }, lit: { piazza: true } })).sort(), Object.keys(fresh()).sort());
  assert.deepEqual(s.reached, ['gaol'], 'the Lattice needs no reached entries');
  pass('a fresh save opens the first Lattice place only');
}
{ // an old save (from before the Lattice) loads as it did
  const old = { v: 1, reached: ['gaol', 'ramparts', 'fen'], at: 'fen', wisps: { gaol: [0, 1], fen: [3] }, lit: { gaol: true, ramparts: true }, time: 90, best: 0, done: 0, seen: true };
  const s = clean(old);
  assert.deepEqual(s, { ...old, wisps: { gaol: [0, 1], fen: [3] } });
  assert.deepEqual(mapGroups(s, 'fen')[1].rows.map(r => r.open), [true, false, false]);
  pass('an old save loads unchanged, and the Piazza is open in it');
}
{ // the Lattice's wisps: integers 0..4, no repeats, sorted
  const s = clean({ wisps: { piazza: [4, 0, 4, 9, -1, 'a', 2.5, 2], cupola: [1], orrery: 'x', nowhere: [1] } });
  assert.deepEqual(s.wisps, { piazza: [0, 2, 4], cupola: [1] });
  assert.equal(latticeWisps(s), 4);
  assert.equal(wispCount(s), 0, 'the downs count stays the downs');
  pass("the Lattice's wisps are cleaned like the downs' wisps");
}
{ // the Lattice's beacons: kept only on the chain from the Piazza
  assert.deepEqual(clean({ lit: { piazza: true } }).lit, { piazza: true });
  assert.deepEqual(clean({ lit: { piazza: true, cupola: true, orrery: true } }).lit, { piazza: true, cupola: true, orrery: true });
  assert.deepEqual(clean({ lit: { cupola: true } }).lit, {}, 'the Cupola is shut while the Piazza is dark');
  assert.deepEqual(clean({ lit: { piazza: true, orrery: true } }).lit, { piazza: true }, 'the Isles are shut while the Cupola is dark');
  assert.deepEqual(clean({ lit: { piazza: 'yes', cupola: true } }).lit, {}, 'only true lights a beacon');
  // the downs' rule does not change with the Lattice in the save
  assert.deepEqual(clean({ reached: ['gaol'], lit: { gaol: true, piazza: true } }).lit, { piazza: true });
  pass('a Lattice beacon stays lit only when its place is open by the chain');
}
{ // `at`: an open Lattice place, else the first place of the downs
  assert.equal(clean({ at: 'piazza' }).at, 'piazza');
  assert.equal(clean({ at: 'cupola' }).at, 'gaol', 'a shut Lattice place cannot be where you are');
  assert.equal(clean({ at: 'cupola', lit: { piazza: true } }).at, 'cupola');
  assert.equal(clean({ at: 'orrery', lit: { piazza: true, cupola: true } }).at, 'orrery');
  assert.equal(clean({ at: 'nowhere' }).at, 'gaol');
  pass('the save keeps where you are when it is an open Lattice place');
}
{ // the downs' test of the old save still holds with Lattice ids in the save
  const s = clean({ reached: ['gaol', 'ramparts', 'bells', 'piazza'], at: 'bells', wisps: { gaol: [0, 4, 4, 9], fen: [1] }, lit: { gaol: true, barrows: true }, time: 61, best: 1e12, seen: true });
  assert.deepEqual(s.reached, ['gaol', 'ramparts']);
  assert.equal(wispCount(s), 3);
  pass('reached keeps the downs only');
}

/* ---------------- the lists ---------------- */
{ // names and the next place
  assert.deepEqual(LATTICE_NAMES, { piazza: 'The Vanishing Piazza', cupola: 'The Broken Cupola', orrery: 'The Orrery Isles' });
  assert.equal(placeName('piazza'), 'The Vanishing Piazza');
  assert.equal(placeName('gaol'), NAMES.gaol);
  assert.deepEqual(LATTICE.map(nextOf), ['cupola', 'orrery', null]);
  assert.deepEqual(ORDER.map(nextOf), ['ramparts', 'fen', 'bells', 'barrows', null]);
  assert.equal(nextOf('nowhere'), null);
  assert.equal(arriveLine('piazza'), 'I · The Gilt Lattice');
  assert.equal(arriveLine('orrery'), 'III · The Gilt Lattice');
  assert.equal(arriveLine('gaol'), 'I · The first place');
  assert.equal(arriveLine('barrows'), 'V · The last place');
  pass('the names, the next place in each set and the arrival lines');
}
{ // the Map for a fresh save
  const g = mapGroups(fresh(), 'gaol');
  assert.deepEqual(g.map(x => x.title), ['The downs', 'The Gilt Lattice']);
  assert.deepEqual(g[0].rows.map(r => r.id), ORDER);
  assert.deepEqual(g[1].rows.map(r => r.id), LATTICE);
  assert.deepEqual(g[1].rows.map(r => r.n), ['I', 'II', 'III']);
  assert.deepEqual(g[1].rows[0], { id: 'piazza', n: 'I', name: 'The Vanishing Piazza', open: true, lit: false, wisps: '◆ 0/5', note: 'Beacon dark', current: false });
  assert.deepEqual(g[1].rows[1], { id: 'cupola', n: 'II', name: 'Locked', open: false, lit: false, wisps: '', note: 'Light the beacon before it', current: false });
  assert.deepEqual(g[0].rows.map(r => r.open), [true, false, false, false, false]);
  assert(g[0].rows[0].current);
  assert.equal(mapLine(fresh()), 'Wisps: 0 of 25 on the downs, 0 of 15 in the Lattice.');
  pass('the Map of a fresh save: five downs rows, the Piazza open, two Lattice rows locked');
}
{ // the Map with the Piazza's beacon lit, in the Piazza
  const s = clean({ at: 'piazza', wisps: { gaol: [0, 1], piazza: [0, 1, 2] }, lit: { piazza: true } });
  const g = mapGroups(s, 'piazza');
  assert.deepEqual(g[1].rows.map(r => [r.open, r.lit, r.current]), [[true, true, true], [true, false, false], [false, false, false]]);
  assert.equal(g[1].rows[0].note, 'Beacon lit');
  assert.equal(g[1].rows[0].wisps, '◆ 3/5');
  assert.equal(g[1].rows[1].name, 'The Broken Cupola');
  assert.equal(mapLine(s), 'Wisps: 2 of 25 on the downs, 3 of 15 in the Lattice.');
  pass('a lit Piazza beacon opens the Cupola in the Map');
}
{ // the Map of a bad save is the Map of a fresh save
  for (const bad of [null, 7, [], { lit: 'all', wisps: [], at: 5 }, { lit: { orrery: true, cupola: true } }])
    assert.deepEqual(mapGroups(clean(bad), 'gaol'), mapGroups(fresh(), 'gaol'));
  pass('a bad save gives the Map of a fresh save');
}
{ // the HUD hint
  const s = clean({ lit: { piazza: true } });
  assert.equal(hintOf(s, 'piazza', 'Walk to the round temple. Light the beacon.', false), 'Walk to the round temple. Light the beacon.');
  assert.equal(hintOf(s, 'piazza', '', true), 'The way is open. Use the map, or walk on.');
  const all = clean({ lit: { piazza: true, cupola: true, orrery: true } });
  assert.equal(hintOf(all, 'orrery', '', true), 'Every beacon of the Lattice burns. Use the map.');
  // the downs keep their hints
  assert.equal(hintOf(fresh(), 'gaol', '', false), 'Light the beacon on the summit.');
  assert.equal(hintOf(clean({ reached: ORDER, lit: { barrows: true } }), 'barrows', '', true), 'Other beacons are still dark. Use the map.');
  pass('the HUD hint of a Lattice place, and the downs as before');
}
{ // ?place=
  const q = v => new URLSearchParams(v === undefined ? '' : `place=${v}`);
  const s = fresh();
  assert.equal(startPlace(q('piazza'), s), 'piazza', '?place=piazza always works');
  assert.equal(startPlace(q('cupola'), s), 'gaol', 'a shut Lattice place loads save.at');
  assert.equal(startPlace(q('orrery'), clean({ lit: { piazza: true, cupola: true } })), 'orrery');
  assert.equal(startPlace(q('fen'), s), 'gaol', 'a downs place not reached loads save.at');
  assert.equal(startPlace(q('fen'), clean({ reached: ['gaol', 'ramparts', 'fen'] })), 'fen');
  assert.equal(startPlace(q('nowhere'), clean({ at: 'piazza' })), 'piazza');
  assert.equal(startPlace(q(), clean({ at: 'piazza' })), 'piazza');
  assert.equal(startPlace('piazza', s), 'piazza');
  assert.equal(isOpen(s, 'orrery'), false);
  pass('?place= loads an open place, else where you were');
}
{ // the run does not list the Lattice
  assert.deepEqual(routeOf('gaol').map(r => r.id), ORDER);
  assert(!LATTICE.some(id => NAMES[id]), "screens.js NAMES (the run's names) has no Lattice place");
  const run = fs.readFileSync(`${DIR}run.js`, 'utf8');
  for (const id of LATTICE) assert(!run.includes(`'${id}'`), `run.js does not name ${id}`);
  pass('the run keeps its five places');
}

/* ---------------- the bake's lists and the two colour rules ---------------- */
let bake = null, check = null;
try {
  bake = await import('../../games/gloam-downs/bake.mjs');
  check = await import('../../games/gloam-downs/lib/check.mjs');
} catch (err) { console.log(`SKIP the bake's lists and the colour rules: ${err.message.split('\n')[0]} (npm ci --prefix games/gloam-downs)`); }
if (bake) {
  assert.deepEqual(bake.ORDER, ORDER, "the bake's ORDER is the run's five");
  assert.deepEqual(bake.LATTICE, LATTICE);
  const zones = await import('../../games/gloam-downs/lib/zones.mjs');
  for (const id of LATTICE) assert.throws(() => zones.zonesOf(id), undefined, `lib/zones.mjs has no zones for ${id}`);
  pass('the bake lists the Lattice beside ORDER, and lib/zones.mjs keeps the five');
}
if (check) {
  const pal = Array.from({ length: 48 }, () => 0x101018);
  pal[39] = 0x8cf0cc; pal[40] = 0xeefff6;
  pal[5] = 0x2a4a8a; pal[6] = 0x3a6ab0; // a dark blue grid ramp
  const good = check.latticeChecks({ pal, digital: [5, 6] });
  assert(good.every(r => r.ok), JSON.stringify(good));
  const mint = pal.slice(); mint[9] = 0x90e8c8;
  assert(!check.latticeChecks({ pal: mint, digital: [5, 6] })[0].ok, 'a mint own colour is too near the wisps');
  const hot = pal.slice(); hot[6] = 0x80ffff;
  assert(!check.latticeChecks({ pal: hot, digital: [5, 6] })[1].ok, 'a bright grid colour passes the bright rule as fire');
  assert(!check.latticeChecks({ pal, digital: [] })[1].ok, 'a Lattice place names its digital ramp');
  // the wisp slots themselves (39, 40) and the shared slots 32..47 are not own colours
  const shared = pal.slice(); shared[33] = 0x8cf0cc;
  assert(check.latticeChecks({ pal: shared, digital: [5, 6] })[0].ok);
  pass('the two colour rules of a Lattice place');
}

/* ---------------- the baked places ---------------- */
const skipWorlds = process.env.GLOAM_WORLDS === '0';
const baked = skipWorlds ? [] : LATTICE.filter(id => ['.json', '.bin.gz', '.walk.bin.gz'].every(e => fs.existsSync(`${DIR}worlds/${id}${e}`)));
if (skipWorlds) console.log('SKIP the baked Lattice places (GLOAM_WORLDS=0)');
else if (baked.length < LATTICE.length) console.log(`SKIP the baked Lattice places not yet baked: ${LATTICE.filter(id => !baked.includes(id)).join(' ')}`);
if (baked.length) {
  const size = f => fs.statSync(`${DIR}worlds/${f}`).size;
  const own = pal => pal.slice(0, 32).join(',');
  const downs = ORDER.map(id => own(JSON.parse(fs.readFileSync(`${DIR}worlds/${id}.json`, 'utf8')).pal));
  const seen = [];
  for (const id of baked) {
    const meta = JSON.parse(fs.readFileSync(`${DIR}worlds/${id}.json`, 'utf8'));
    const bytes = size(`${id}.bin.gz`) + size(`${id}.walk.bin.gz`) + size(`${id}.json`);
    assert.equal(meta.id, id);
    assert.equal(meta.name, LATTICE_NAMES[id]);
    assert.equal(meta.set, 'lattice');
    assert.equal(meta.zones, undefined, `${id}.json has no zones`);
    assert(meta.count <= 250000, `${id}: ${meta.count} splats`);
    assert(bytes <= 1.5e6, `${id}: ${bytes} bytes`);
    assert.equal(meta.pal.length, 48);
    assert.equal(meta.wisps.length, 5);
    assert(!downs.includes(own(meta.pal)) && !seen.includes(own(meta.pal)), `${id} has a palette of its own`);
    seen.push(own(meta.pal));
    if (check) for (const r of check.latticeChecks(meta)) assert(r.ok, `${id}: ${r.what}`);
    console.log(`  ${id}: ${meta.count} splats, ${(bytes / 1e6).toFixed(3)} MB`);
  }
  pass(`the baked Lattice places (${baked.join(', ')}): budgets, palettes, colour rules, no zones`);
}
console.log(`${n} passed`);
