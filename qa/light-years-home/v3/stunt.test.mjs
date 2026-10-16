// Light Years Home v3: stunt stars on scripted runs (final.md 18.1, 9.3). VOID RUN's trap at 39, 41, 45 and 48 u/s;
// SLOAN BEND's drift tiers 1 to 3 with the drift bot; HALO SKIM held 2.9 and 8.1 s; GIANT WHIP's sling and its exit
// speed; THE EYES threaded clean, fast and scraped; SLOAN PADS with every pad and with one missed. The skim and the
// thread run on stand-in places (a wide skim surface; the Eyes are Virgo's, Round 2) with the real stunt data, and
// GIANT WHIP on Coma without its swarms.
// node qa/light-years-home/v3/stunt.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { starsOf } from '../../../public/light-years-home/core/race.js';
import { registerZone } from '../../../public/light-years-home/core/game.js';
import { setSpeed } from '../../../public/light-years-home/core/ship.js';
import { BOTS, steerTo } from '../../../public/light-years-home/core/bots.js';
import { wireAll, newGame, run, of, place, H, WALL, COMA, QUIET } from './activities.mjs';

wireAll();
const PILOT = { assists: 'pilot' };
const result = (events, id) => of(events, 'stuntResult').find((e) => e.id === id);
const until = (id) => (game, evs) => evs.some((e) => e.type === 'stuntResult' && e.id === id);
const stunt = (zone, id) => zone.events.find((e) => e.id === id);

test('a trap at 39, 41, 45 and 48 u/s: 0, 1, 2 and 3 stars', () => {
  for (const [speed, stars] of [[39, 0], [41, 1], [45, 2], [48, 3]]) {
    const g = newGame({ settings: PILOT });
    place(g, [250, -204, 0], 0, speed);
    const r = run(g, () => ({ gas: 1 }), 0.5);
    const res = result(r.events, 'void-run');
    assert.ok(res, `${speed} u/s`);
    assert.equal(res.stars, stars, `${speed} u/s: ${res.value.toFixed(2)}`);
    assert.ok(Math.abs(res.value - speed) < 0.2);
    assert.equal(of(r.events, 'stuntResult').length, 1, 'one result per pass');
  }
  // The best and the stars keep the best run; the RETRY chip shows for 6 s.
  const g = newGame({ settings: PILOT });
  place(g, [250, -204, 0], 0, 45);
  run(g, () => ({ gas: 1 }), 1.2);
  place(g, [250, -204, 0], 0, 41);
  const r = run(g, () => ({ gas: 1 }), 0.5);
  assert.equal(result(r.events, 'void-run').prevStars, 2);
  assert.equal(g.progress.stunts['void-run'].stars, 2);
  assert.ok(g.progress.stunts['void-run'].best > 44.5);
  assert.equal(g.zone.retry.id, 'void-run');
  assert.ok(Math.abs(g.zone.retry.until - g.t - g.tune.RACE.RETRY_SHOW) < 0.6);
});

test('drift tiers 1 to 3 round the Bend Giant score SLOAN BEND 1 to 3 stars', () => {
  for (const tier of [1, 2, 3]) {
    const g = newGame({ settings: PILOT });
    place(g, [-10, -330, 0], 330, 34);
    const bot = BOTS.drifter.make({ body: 'bend-giant', tier });
    const r = run(g, (game) => bot.next(game), 8, { until: until('sloan-bend') });
    const res = result(r.events, 'sloan-bend');
    assert.ok(res, `tier ${tier}`);
    assert.equal(res.stars, tier);
    assert.deepEqual(of(r.events, 'driftBoost').map((e) => e.tier), [tier]);
  }
});

test('a skim of 2.9 and 8.1 s: 0 and 3 stars on HALO SKIM', () => {
  const SKIM = Object.freeze({ ...QUIET, id: 'skim-test', bodies: [{ id: 'ngc4889', pos: [0, 0, 0], r: 200, rc: 200, skim: true }],
    events: [stunt(COMA, 'halo-skim')] });
  registerZone(SKIM);
  for (const [leave, lo, hi, stars] of [[2.5, 2.7, 2.99, 0], [7.7, 8.0, 8.3, 3]]) {
    const g = newGame({ zone: SKIM, at: [-202.5, 0, 0], heading: 0, speed: 30, settings: PILOT });
    // Hold the surface about 2 u off, then turn away.
    const r = run(g, (game) => {
      const s = game.ship, gap = Math.hypot(s.pos[0], s.pos[1]) - 200;
      const tangent = Math.atan2(s.pos[0], s.pos[1]) + Math.PI / 2;
      const want = game.t < leave ? tangent + Math.max(-0.15, Math.min(0.15, 0.1 * (gap - 2.2))) : tangent - 0.7;
      return { steer: steerTo(game, want), gas: 0.4 };
    }, leave + 3, { until: until('halo-skim') });
    const res = result(r.events, 'halo-skim');
    assert.ok(res);
    assert.ok(res.value >= lo && res.value <= hi, `${res.value.toFixed(2)} s`);
    assert.equal(res.stars, stars);
    assert.equal(of(r.events, 'scrape').length, 0);
  }
});

test('a sling round NGC 4874: GIANT WHIP scores the exit speed (37 none, 47 three stars)', () => {
  const b = COMA.bodies.find((x) => x.id === 'ngc4874');
  const whip = stunt(COMA, 'giant-whip');
  assert.equal(starsOf(whip, 37), 0);
  assert.equal(starsOf(whip, 47), 3);
  // A real sling (a tier 2 drift released inside the well after turning 90° or more): the value is the speed leaving
  // the 3 × rs circle. Then the same sling with the speed set just before the exit.
  // Coma's downtown traffic thins the scoring out with crashes on the way in: a quiet copy (its giants, wells and
  // stunts, no swarms) checks the scoring alone.
  const CALM = { ...COMA, id: 'coma-calm', swarms: [] };
  registerZone(CALM);
  for (const exit of [null, 37, 47]) {
    const g = newGame({ zone: CALM, settings: PILOT });
    place(g, [b.pos[0] - 20, b.pos[1] - 110, 0], 0, 34);
    g.ship.bar = 1;
    const bot = BOTS.drifter.make({ body: 'ngc4874', tier: 2 });
    let slung = false, set = false, atExit = null;
    const r = run(g, (game) => {
      const s = game.ship, d = Math.hypot(s.pos[0] - b.pos[0], s.pos[1] - b.pos[1]);
      if (!slung) return bot.next(game);
      if (exit && !set && d + s.speed * H * 1.5 > 3 * b.well.rs) { setSpeed(s, exit + 0.05); set = true; }
      if (d <= 3 * b.well.rs) atExit = s.speed;
      return { gas: 1 };
    }, 10, { until: until('giant-whip'), onEvent: (e) => { if (e.type === 'sling') slung = true; } });
    const sl = of(r.events, 'sling')[0];
    assert.ok(sl && sl.turn >= Math.PI / 2, 'slung');
    const res = result(r.events, 'giant-whip');
    assert.ok(res, `exit ${exit}`);
    if (exit) assert.ok(Math.abs(res.value - exit) < 0.5, `${res.value.toFixed(2)}`);
    else assert.ok(Math.abs(res.value - atExit) < 1, `${res.value.toFixed(2)} vs ${atExit}`);
    assert.equal(res.stars, starsOf(whip, res.value));
  }
});

test('THE EYES: clean at 30 and 45 u/s, scraped, and just after a crash', () => {
  const EYES = { id: 'the-eyes', type: 'thread', title: 'THE EYES', ring: { pos: [0, 100, 0], r: 2.5, normal: [0, 1, 0] },
    stars: ['clean', 'clean@36', 'clean@44'] };
  const PLACE = Object.freeze({ ...QUIET, id: 'eyes-test', bodies: [{ id: 'eye', pos: [3.4, 100, 0], r: 1.2, rc: 1.2 }],
    events: [EYES] });
  registerZone(PLACE);
  for (const [x, y, speed, stars, why] of [[-1, 80, 30, 1, 'clean, slow'], [-1, 95, 46, 3, 'clean at 44+'],
    [2.0, 95, 46, 0, 'scraped'], [2.2, 95, 46, 0, 'crashed into the other eye'], [2.0, 80, 30, 0, 'scraped, slow']]) {
    const g = newGame({ zone: PLACE, at: [x, y, 0], heading: 0, speed, settings: PILOT });
    const r = run(g, () => ({ gas: 1 }), 1.5);
    const res = result(r.events, 'the-eyes');
    assert.ok(res, why);
    assert.equal(res.stars, stars, `${why}: ${res.value.toFixed(1)} u/s`);
  }
});

test('SLOAN PADS: every pad (with the exit speed) scores; a missed pad ends the line with none', () => {
  const pads = stunt(WALL, 'sloan-pads').pads;
  const d = [pads[1][0] - pads[0][0], pads[1][1] - pads[0][1]], l = Math.hypot(d[0], d[1]);
  for (const miss of [-1, 2]) {
    const g = newGame({ settings: PILOT });
    place(g, [pads[0][0] - (d[0] / l) * 25, pads[0][1] - (d[1] / l) * 25, 0], (Math.atan2(d[0], d[1]) * 180) / Math.PI, 32);
    const r = run(g, (game) => {
      const s = game.ship;
      let k = 0;
      while (k < pads.length && pads[k][1] < s.pos[1] + 2) k++;
      const p = pads[Math.min(k, pads.length - 1)];
      const x = k === miss ? p[0] + 7 : p[0];
      return { steer: steerTo(game, Math.atan2(x - s.pos[0], p[1] - s.pos[1])), gas: 1 };
    }, 6, { until: until('sloan-pads') });
    const hit = r.events.filter((e) => e.type === 'pad' || e.type === 'padPerfect').map((e) => e.i);
    const res = result(r.events, 'sloan-pads');
    assert.ok(res, `miss ${miss}`);
    if (miss < 0) {
      assert.deepEqual(hit, [0, 1, 2, 3]);
      assert.ok(res.stars >= 1, `${res.stars} stars`);
      assert.equal(res.value, 4);
    } else {
      assert.deepEqual(hit, [0, 1]);
      assert.equal(res.stars, 0);
      assert.equal(res.value, 2);
    }
  }
});
