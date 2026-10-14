// Light Years Home v3: the toy test on the Wall (final.md 18.1, handling §10). The game opens on the misfire's drop-out
// at 38 u/s; each run waits a random time on the title (traffic flows behind it), then PLAY. Three small bots:
//   idle     no input at all
//   random   a new steer every 0.5 to 1.5 s (touch, auto-drift on)
//   drifter  heads for the Bend Giant, passes it on the left, holds a drift round it, lets go at tier 2 or more
// Checks: the idle ship gets three NEARs by 3.6 s and touches nothing in the opening; the random bot's first near miss
// comes by 6 s in 80% of seeds or more; the drifter's first drift round the giant reaches tier 2 and drift-boosts out
// within 10 s of PLAY; no bot is ever under 6 u/s for more than 0.4 s unless it brakes; a replay hashes the same.
// node qa/light-years-home/v3/toy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, wire, unwire, setMode, advance } from '../../../public/light-years-home/core/game.js';
import { FLIGHT } from '../../../public/light-years-home/core/ship.js';
import { createEventBuffer } from '../../../public/light-years-home/core/events.js';
import { hashState } from '../../../public/light-years-home/core/hash.js';
import { mulberry32 } from '../../../public/light-years-home/core/rng.js';
import { WALL as WALL_FIXTURE } from './fixtures.mjs';

let WALL = WALL_FIXTURE;
try { WALL = (await import('../../../public/light-years-home/core/world/zones/wall.js')).default; } catch { /* WP6 not in yet */ }

const SEEDS = 50;
const GIANT = WALL.bodies.find((b) => b.id === 'bend-giant').pos;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------------------------------------------------------------- bots: (game) → InputRecord

const idle = () => () => ({ source: 'touch', autoDrift: true });

function random(seed) {
  const rng = mulberry32(seed * 7919 + 1);
  let next = 0, steer = 0;
  return (game) => {
    if (game.t >= next) { steer = rng() * 2 - 1; next = game.t + 0.5 + rng(); }
    return { steer, source: 'touch', autoDrift: true };
  };
}

// Pass the giant on the left at about R + 6 u, then hold a left drift round it, steering in to keep about R from its
// centre, and let go once the drift has tier 2 and has turned the travel line 126° (or has tier 3).
function drifter({ R = 13, source = 'keys' } = {}) {
  let phase = 'approach', turned = 0, last = 0;
  return (game) => {
    const s = game.ship, p = s.pos;
    const dx = GIANT[0] - p[0], dy = GIANT[1] - p[1], r = Math.hypot(dx, dy);
    const toG = Math.atan2(dx, dy), vang = Math.atan2(s.vel[0], s.vel[1]);
    if (phase === 'approach') {
      const off = Math.asin(clamp((R + 6) / Math.max(r, R + 6), -1, 1));
      if (r < R + 14 && wrap(toG - s.yaw) < -0.6) { phase = 'drift'; last = vang; }
      return { steer: clamp(3 * wrap(toG + off - s.yaw), -1, 1), gas: 1, source };
    }
    if (phase === 'drift') {
      turned += Math.abs(wrap(vang - last));
      last = vang;
      if ((s.drift.tier >= 2 && turned > 2.2) || s.drift.tier >= 3) { phase = 'out'; return { source }; }
      return { steer: -clamp(0.55 + (2.5 * (r - R)) / R, 0.1, 1), drift: true, gas: 1, source };
    }
    return { gas: 1, source };
  };
}

// ---------------------------------------------------------------- one run from the title

function run(seed, bot, seconds, onEvent = null) {
  unwire();
  wire(FLIGHT);
  const game = createGame({ seed, zoneData: WALL });              // mode 'title': the zone clock runs behind it
  advance(game, {}, 0.5 + mulberry32(seed)() * 2.5);
  assert.ok(setMode(game, 'drive'), 'PLAY');
  const t0 = game.t;
  const ev = createEventBuffer();
  let slow = 0, worstSlow = 0, minSpeed = Infinity;
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    ev.clear();
    const input = bot(game);
    step(game, input, ev);
    for (let k = 0; k < ev.n; k++) if (onEvent) onEvent(ev.list[k], ev.list[k].t - t0, game);
    if (game.ship.speed < 6 && !(input.brake > 0.05)) slow += 1 / 120;
    else slow = 0;
    worstSlow = Math.max(worstSlow, slow);
    minSpeed = Math.min(minSpeed, game.ship.speed);
  }
  return { game, worstSlow, minSpeed };
}

// ---------------------------------------------------------------- the checks

test('the idle bot gets three NEARs by 3.6 s from the seeded galaxies, coasting from the 38 u/s drop-out', (t) => {
  const late = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const nears = [], hits = [];
    const res = run(seed, idle(), 6, (e, t) => {
      if (e.type === 'near' || e.type === 'hairline') nears.push(t);
      if ((e.type === 'scrape' || e.type === 'crash') && t <= 3.6) hits.push(t);
    });
    const byT = nears.filter((t) => t <= 3.6).length;
    if (byT < 3) late.push(`seed ${seed}: ${nears.map((t) => t.toFixed(2)).join(', ')}`);
    assert.deepEqual(hits, [], `seed ${seed}: the opening (the seeded stretch) touches nothing`);
    assert.equal(res.worstSlow, 0, `seed ${seed}: never under 6 u/s`);
  }
  assert.deepEqual(late, []);
  // The seeded three come at the designed beats (final.md 7.2: 1.4, 2.4, 3.6 s at the old 20 u/s cruise).
  const beats = [];
  run(1, idle(), 4, (e, t) => { if (e.type === 'near' || e.type === 'hairline') beats.push(t); });
  t.diagnostic(`seed 1 near misses at ${beats.map((x) => x.toFixed(2)).join(', ')} s`);
  assert.ok(beats[0] > 1.0 && beats[0] < 1.8 && beats[2] < 3.6, `beats ${beats.map((x) => x.toFixed(2))}`);
});

test("the random bot's first near miss by 6 s in 80% or more of 50 seeds", (t) => {
  let hit = 0;
  const firsts = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    let first = null;
    const res = run(seed, random(seed), 8, (e, t) => {
      if ((e.type === 'near' || e.type === 'hairline') && first === null) first = t;
    });
    if (first !== null && first <= 6) hit++;
    firsts.push(first === null ? '-' : first.toFixed(1));
    assert.ok(res.worstSlow <= 0.4, `seed ${seed}: under 6 u/s for ${res.worstSlow.toFixed(2)} s`);
  }
  t.diagnostic(`${hit} of ${SEEDS} seeds; first near misses at ${firsts.join(' ')} s`);
  assert.ok(hit >= 0.8 * SEEDS, `${hit} of ${SEEDS}: ${firsts.join(' ')}`);
});

test('the drifter reaches tier 2 on its first drift round the Bend Giant and drift-boosts out within 10 s', (t) => {
  for (const source of ['keys', 'touch']) {
    const bad = [];
    const times = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      // The first drift only: where it starts, the tier it reaches, and how it ends (a drift-boost, not lost).
      let firstTier = 0, boost = null, lost = false, near = Infinity, over = false;
      const res = run(seed, drifter({ source }), 11, (e, t, game) => {
        if (over) return;
        if (e.type === 'driftStart') near = Math.hypot(game.ship.pos[0] - GIANT[0], game.ship.pos[1] - GIANT[1]);
        if (e.type === 'driftTier') firstTier = Math.max(firstTier, e.tier);
        if (e.type === 'driftBoost') { boost = { t, tier: e.tier }; over = true; }
        if (e.type === 'driftLost') { lost = true; over = true; }
      });
      if (lost || !boost || boost.tier < 2 || firstTier < 2 || boost.t > 10 || near > 42) {   // starts in the well (3 × rs)
        bad.push(`seed ${seed}: ${JSON.stringify({ boost, lost, firstTier, near: +near.toFixed(1) })}`);
      } else {
        times.push(boost.t);
      }
      assert.ok(res.worstSlow <= 0.4, `seed ${seed}: under 6 u/s for ${res.worstSlow.toFixed(2)} s`);
    }
    assert.deepEqual(bad, [], `${source}`);
    times.sort((a, b) => a - b);
    const f = (x) => x.toFixed(2);
    t.diagnostic(`${source}: drift-boost at ${f(times[0])} to ${f(times[times.length - 1])} s, median ${f(times[times.length >> 1])} s`);
    assert.ok(times[times.length - 1] <= 10, `${source}: slowest ${times[times.length - 1].toFixed(2)} s`);
  }
});

test('no bot under 6 u/s for more than 0.4 s unless braking', () => {
  // Bots above checked it on every run. A braking run: under 6 u/s only while the brake is held, and it is away
  // again within 0.4 s of letting go.
  const brakes = (game) => ({ brake: game.t % 6 < 2 ? 1 : 0, steer: Math.sin(game.t), source: 'keys' });
  for (let seed = 1; seed <= 5; seed++) {
    const res = run(seed, brakes, 20);
    assert.ok(res.minSpeed < 1, 'the brake stops the ship');
    assert.ok(res.worstSlow <= 0.4, `seed ${seed}: ${res.worstSlow.toFixed(2)} s under 6 u/s after letting go`);
  }
});

test('a replay of the same seed and inputs hashes the same', () => {
  for (const make of [idle, () => random(4), () => drifter()]) {
    const a = run(4, make(), 12).game;
    const b = run(4, make(), 12).game;
    assert.equal(hashState(a), hashState(b));
  }
});
