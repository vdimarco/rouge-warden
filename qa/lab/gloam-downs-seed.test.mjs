// Gloam Downs: what the seed of a run changes, checked in node with no browser (public/lab/gloam-downs/mix.js, with foes.js and
// run.js, on the zones of lib/zones.mjs, which the bake writes into each place):
//   the streams stand apart (the mix, the elite, the route and the offers each from their own);
//   the foe mix fits for seeds 1 to 200 in all five places, at Ember 0 and at Ember 3 (one foe more): every zone fits its pool, the cap
//     of 6 holds, every two zones that are not guards or the arena within 20 m fit together, each place keeps its newest type, the
//     guards, the arena and the Gaol's G1 stay as baked, and the zone walk (qa/lab/gloam-downs-zones.mjs) never has more than 6 awake on each route;
//   the elite's zone: never a first zone or a guard, for the Gaol both G2 and G3, and every place has one;
//   the route: as now below Ember 1; from Ember 1 the Gaol first, Barrow Crown last and more than one order;
//   the same seed gives the same mix, elites, route and offers; the seed's code of six letters and ?seed= for a code or a number.
// Run: node qa/lab/gloam-downs-seed.test.mjs
import assert from 'node:assert/strict';
import { mixZones, eliteZone, routeOf, mixWave, seedCode, parseSeed, smallSeed, NEWEST, ELITE, MIX } from '../../public/lab/gloam-downs/mix.js';
import { fits, foesOf, poolCounts, RULES } from '../../public/lab/gloam-downs/foes.js';
import { drawOffer, stream } from '../../public/lab/gloam-downs/run.js';
import { ORDER } from '../../public/lab/gloam-downs/save.js';
import { ZONES, POOLS } from '../../games/gloam-downs/lib/zones.mjs';
import { walkRoute } from './gloam-downs-zones.mjs';

let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const dist = (a, b) => Math.hypot(a.c[0] - b.c[0], a.c[2] - b.c[2]);
const PLACES = ORDER;
const mixOf = (id, seed, ember = 0) => mixZones(id, ZONES[id], POOLS[id], seed, { ember });

{ // the streams stand apart: each name gives its own numbers, and mixing a place moves no other choice
  const first = name => stream(42, name)();
  const names = ['mix/gaol', 'mix/fen', 'elite/gaol', 'route', 'relic', 'start', 'foes/gaol'];
  assert.equal(new Set(names.map(first)).size, names.length, 'every stream starts apart');
  const offers = [0, 1, 2, 3].map(k => drawOffer(42, k));
  for (const id of PLACES) mixOf(id, 42, 3);
  routeOf(42, 1);
  assert.deepEqual([0, 1, 2, 3].map(k => drawOffer(42, k)), offers, 'the offers do not move');
  // the elite draws from its own stream: with the mix fixed (the Gaol has only Snuffers), the elite still moves with the seed
  const gaolMix = s => mixOf('gaol', s).map(z => z.foes).join(',');
  assert.equal(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(gaolMix)).size, 1, 'the Gaol\'s foes stay Snuffers');
  assert(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => eliteZone(mixOf('gaol', s)))).size > 1);
  pass('the streams stand apart: the mix, the elite, the route and the offers each draw from their own');
}

{ // every seed fits: seeds 1 to 200, five places, Ember 0 and 3
  const stats = {};
  for (const ember of [0, 3]) for (const id of PLACES) {
    const pool = poolCounts(POOLS[id]), base = ZONES[id];
    let changed = 0, kept = 0, elites = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const zs = mixOf(id, seed, ember);
      assert.equal(zs.length, base.length);
      zs.forEach((z, i) => {
        const b = base[i];
        assert.equal(z.id, b.id);
        assert.equal(z.baked, b.foes);
        if (z.boss) assert.equal(z.foes, b.foes, 'the arena stays');
        else assert(fits(z, [], pool), `${id} seed ${seed}: ${z.id} ${z.foes} does not fit ${POOLS[id]}`);
        assert(foesOf(z).length <= RULES.cap);
        const fixed = z.guard || z.boss || (id === 'gaol' && i === 0);
        if (fixed) assert(z.foes === b.foes, `${id} seed ${seed}: ${z.id} must stay ${b.foes}, is ${z.foes}`);
        // its baked count, one more from Ember 3, and one more again where the elite was added to it
        else { const k = foesOf(z).length, b0 = foesOf(b).length; assert(k >= b0 && k <= b0 + (ember >= 3 ? 1 : 0) + (Number.isInteger(z.elite) ? 1 : 0), `${id} seed ${seed}: ${z.id} ${z.foes} keeps its count`); }
        if (!fixed && z.foes !== b.foes) changed++;
      });
      const free = zs.filter(z => !z.guard && !z.boss);
      for (let a = 0; a < free.length; a++) for (let c = a + 1; c < free.length; c++)
        if (dist(free[a], free[c]) <= MIX.near) assert(fits(free[a], [free[c]], pool), `${id} seed ${seed}: ${free[a].id} and ${free[c].id} do not fit together`);
      assert(zs.some(z => !z.boss && foesOf(z).includes(NEWEST[id])), `${id} seed ${seed} has no ${NEWEST[id]}`);
      if (eliteZone(zs)) elites++;
      if (zs.every((z, i) => z.foes === base[i].foes)) kept++;
    }
    stats[`${id}@${ember}`] = { changed, kept, elites };
    assert.equal(elites, 200, `${id} at Ember ${ember}: an elite in ${elites} of 200 seeds`);
  }
  pass('the foe mix fits for seeds 1 to 200 in all five places at Ember 0 and 3, and every place has its newest type and an elite', stats);
}

{ // the zone walk of each route with the mixed zones: never more than 6 awake, never more of a type than the pool holds
  const saved = Object.fromEntries(PLACES.map(id => [id, ZONES[id].slice()]));
  const most = {};
  try {
    for (const id of PLACES) {
      const pool = poolCounts(POOLS[id]);
      for (let seed = 1; seed <= 60; seed++) for (const ember of [0, 3]) {
        ZONES[id].splice(0, ZONES[id].length, ...mixOf(id, seed, ember));
        for (const mode of ['runner', 'fighter']) {
          const r = walkRoute(id, mode);
          assert(r.most <= RULES.cap, `${id} seed ${seed}: ${r.most} awake`);
          for (const t in r.mostType) assert(r.mostType[t] <= pool[t], `${id} seed ${seed}: ${r.mostType[t]} ${t} awake`);
          most[id] = Math.max(most[id] || 0, r.most);
        }
      }
      ZONES[id].splice(0, ZONES[id].length, ...saved[id]);
    }
  } finally { for (const id of PLACES) ZONES[id].splice(0, ZONES[id].length, ...saved[id]); }
  pass('the zone walk on every route with mixed zones: never more than 6 awake, never more of a type than the pool', most);
}

{ // elites move: the Gaol's for seeds 1 to 50 is never G1 or G5, and both G2 and G3 are picked; no place puts one in a first zone or a guard
  const gaol = new Set();
  for (let seed = 1; seed <= 50; seed++) gaol.add(eliteZone(mixOf('gaol', seed)));
  assert(!gaol.has('G1') && !gaol.has('G5'));
  assert(gaol.has('G2') && gaol.has('G3'), [...gaol].join());
  const where = {};
  for (const id of PLACES) {
    where[id] = new Set();
    for (let seed = 1; seed <= 200; seed++) {
      const zs = mixOf(id, seed), e = zs.find(z => Number.isInteger(z.elite));
      assert(e && !e.guard && !e.boss && e.id !== ZONES[id][0].id);
      assert.equal(foesOf(e)[e.elite], ELITE[id], `${id}: the elite is a ${ELITE[id]}`);
      where[id].add(e.id);
    }
    where[id] = [...where[id]].sort();
  }
  pass('the elite\'s zone: never G1 or G5 in the Gaol (both G2 and G3 picked), never a first zone or a guard anywhere', where);
}

{ // the route
  assert.deepEqual(routeOf(5, 0), ORDER);
  const orders = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const r = routeOf(seed, 1);
    assert.equal(r[0], 'gaol'); assert.equal(r.at(-1), 'barrows');
    assert.deepEqual([...r].sort(), [...ORDER].sort());
    orders.add(r.join('>'));
  }
  assert(orders.size > 1, 'more than one order of the middle three');
  pass('the route: as now below Ember 1; from Ember 1 the Gaol first, Barrow Crown last, and more than one order', { orders: orders.size });
}

{ // the same seed gives the same run
  for (const seed of [1, 77, 123456, 2 ** 29 + 5]) for (const ember of [0, 1, 3]) {
    const a = PLACES.map(id => JSON.stringify(mixOf(id, seed, ember))), b = PLACES.map(id => JSON.stringify(mixOf(id, seed, ember)));
    assert.deepEqual(a, b);
    assert.deepEqual(routeOf(seed, ember), routeOf(seed, ember));
    assert.deepEqual([0, 1, 2, 3].map(k => drawOffer(seed, k)), [0, 1, 2, 3].map(k => drawOffer(seed, k)));
  }
  pass('the same seed, Ember level and unlocks give the same mix, elite zones, route and offers');
}

{ // Ember 3: a zone that may change has one foe more where the pool and the cap allow
  let more = 0, total = 0;
  for (const id of PLACES) for (let seed = 1; seed <= 50; seed++) {
    const a = mixOf(id, seed, 0), b = mixOf(id, seed, 3);
    b.forEach((z, i) => {
      if ((id === 'gaol' && i === 0) || z.guard || z.boss) return;
      total++;
      if (foesOf(z).length >= ZONES[id][i].foes.length + 1) more++;
    });
  }
  assert(more / total > 0.4, `one foe more in ${more} of ${total} zones`);
  pass('Ember 3 adds one foe to the zones that may change where the pool and the cap allow', { more, total });
}

{ // the guard's second wave: the baked foes less the first one, at least one; none for the arena or after the first wave
  assert.equal(mixWave({ guard: true, foes: 'SSS', baked: 'SSS' }), 'SS');
  assert.equal(mixWave({ guard: true, foes: 'SP', baked: 'SP' }), 'P');
  assert.equal(mixWave({ guard: true, foes: 'S', baked: 'S' }), 'S');
  assert.equal(mixWave({ guard: true, boss: true, foes: 'B' }), '');
  assert.equal(mixWave({ guard: true, foes: 'SSS', waved: true }), '');
  assert.equal(mixWave({ guard: false, foes: 'SS' }), '');
  pass('the second wave: G5 SSS rises again as SS, B4 SP as P; none for the arena or a zone already waved');
}

{ // the seed's code: six letters of Crockford's base 32 for a seed under 2^30, and ?seed= takes the code or the number
  const r = stream(9, 'codes');
  for (let i = 0; i < 2000; i++) {
    const s = smallSeed(Math.floor(r() * 2 ** 32));
    const c = seedCode(s);
    assert.equal(c.length, 6, c);
    assert(/^[0-9A-HJKMNP-TV-Z]{6}$/.test(c), c);
    assert.equal(parseSeed(c), s);
    assert.equal(parseSeed(c.toLowerCase()), s);
  }
  assert.equal(parseSeed('7'), 7);
  assert.equal(parseSeed('4294967295'), 4294967295);
  assert.equal(parseSeed('00000L'), 1, 'L reads as 1');
  assert.equal(parseSeed('0000O1'), 1, 'O reads as 0');
  assert.equal(parseSeed('#$%'), null);
  assert.equal(parseSeed(''), null);
  assert.equal(seedCode(7), '000007');
  assert.equal(seedCode(4294967295).length, 7, 'a larger seed takes more letters');
  pass('the seed code: six letters with no I, L, O or U, read back in either case; ?seed= takes a code or a number');
}

console.log(`${n} checks passed`);
