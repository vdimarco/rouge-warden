// Ahead of the Light: rivals and bosses (final.md 10, 21.3).
// SKELETON (WP0). WP4 fills this file. It passes now and lists, as todo tests, what it will check:
// node qa/ahead-of-the-light/rivals.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/rivals.js';

test('core/rivals.js exports its 18.4 API and imports in plain node', () => {
  const api = [
    'pickRegulars', 'createField', 'rivalIntents', 'barkFor', 'legResult'
  ];
  for (const name of api) assert.equal(typeof mod[name], 'function', name);
  const regs = mod.pickRegulars('KOMAZI');
  assert.equal(regs.racing.length, 3);
  assert.ok(!regs.racing.includes(regs.reserve));
  for (const id of ['hound', 'pike', 'remora', 'moth', 'whale', 'mako', 'manta', 'drifter']) {
    assert.ok(mod.ROSTER[id], id);
  }
});

test.todo('honesty: every change in a rival\'s η matches its events; every gap change matches course speeds, tows, '
  + 'surges and logged stumbles');
test.todo('no rival reaches η 3.80 + 1e-9; a stumble moves exactly 1.0 s over 0.4 s');
test.todo('PIKE: in Act II a 25° pull-out passes and 20° is blocked; in Act III a 35° pull-out is blocked and a '
  + 'feint crossing 0.15 s after passes (seeds 1 to 20)');
test.todo('the tow: mid passes a cruising rival from 0.8 s within 6.0 s');
test.todo('trap: REMORA drafting at 0.3 s hits a knot the leader dodges late in 80 % of seeds; HOUND in CRUISE '
  + 'dodges it in 80 %');
test.todo('every rival SLAM has a lean at least 0.3 s before it, on the side it comes from');
test.todo('in legs 2 and 3 no rival SLAM on you starts with a hazard within 30° past you, and none in leg 1');
test.todo('DIRTY AIR\'s speed loss shows as a dirtyAir event');
test.todo('personalities from leg 4: HOUND rams 1 to 3 a leg; REMORA in a wake 50 % of a leg; MOTH at least twice '
  + 'HOUND\'s hits');
test.todo('bosses: the WHALE cannot be taken down; its bow wave moves a ship 40°/s; a breach gives × 1.3 in its '
  + 'wake');
test.todo('MAKO\'s fin moves to a ship with fewer fuel cells within 1.0 s; it backs off after 2 takedowns');
test.todo('MANTA\'s push is zero while shadowed; its lane shows 1.0 s before it passes; a takedown near the light '
  + 'ends in eaten');
test.todo('barks: one per 8 s at most, none in quiet windows, none over 24 characters');
test.todo('AI time under 1 ms per 120 Hz step for six ships');
