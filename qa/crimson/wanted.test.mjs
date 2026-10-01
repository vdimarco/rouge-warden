import test from 'node:test';
import assert from 'node:assert/strict';
import { createWantedState } from '../../public/crimson/js/story/vehicles/wanted-state.js';
import { pedestrianContact, impactDamage, stepTumble } from '../../public/crimson/js/story/vehicles/pedestrian-impact.js';

test('fatal crimes escalate to five stars and dispatch only starts once', () => {
  const law = createWantedState();
  law.report(true); assert.equal(law.state.stars, 1);
  law.tick(2); law.report(true);
  assert.equal(law.state.dispatch, 1); assert.equal(law.state.stars, 2);
  for (let count = 0; count < 20; count++) law.report(true);
  assert.equal(law.state.stars, 5); assert.equal(law.state.heat, 10);
});

test('sight reacquisition resets search and arrest requires continuous proximity', () => {
  const law = createWantedState(); law.report(true); law.tick(3);
  law.tick(20); assert.equal(law.state.status, 'search');
  law.tick(0.1, { seen: true }); assert.equal(law.state.search, 0);
  law.tick(4, { seen: true, held: true }); law.tick(2, { seen: true });
  assert.equal(law.state.arrest, 0);
  assert.equal(law.tick(6, { seen: true, held: true }), 'busted');
  assert.equal(law.state.stars, 0);
});

test('escape takes the full uninterrupted countdown and reset clears all heat', () => {
  const law = createWantedState(); law.report(true); law.tick(3);
  assert.equal(law.tick(21), null); assert.equal(law.tick(1), 'escaped');
  law.report(); law.reset(); assert.equal(law.state.crimes, 0); assert.equal(law.state.dispatch, 0);
});

test('vehicle footprint detects forward and reverse contact, ignores height and near misses', () => {
  const vehicle = { vel: { x: 0, z: 20 }, pos: { y: 0 }, hw: 1, hd: 2.5, toLocal: (x, z) => [x, z] };
  const person = { x: 0, z: 2.7, y: 0, r: 0.35, hit() {} };
  assert.equal(pedestrianContact(vehicle, person), true);
  vehicle.vel.z = -20; person.z = -2.7; assert.equal(pedestrianContact(vehicle, person), true);
  person.x = 2; assert.equal(pedestrianContact(vehicle, person), false);
  person.x = 0; person.y = 6; assert.equal(pedestrianContact(vehicle, person), false);
  person.y = 0; vehicle.vel.z = 0; assert.equal(pedestrianContact(vehicle, person), false);
  assert.equal(impactDamage(7), 100); assert.ok(impactDamage(3) < 100);
  vehicle.vel.z = 20; person.dead = true; assert.equal(pedestrianContact(vehicle, person), false);
  person.dead = false; delete person.hit; assert.equal(pedestrianContact(vehicle, person), false);
});

test('a launched body bounces at most twice and settles with finite motion', () => {
  const body = { age: 0, pos: { x: 0, y: 0, z: 0 }, vx: 15, vz: -4, vy: 11, bounces: 0 };
  let peak = 0;
  for (let frame = 0; frame < 840; frame++) {
    stepTumble(body, 1 / 60, () => 0); peak = Math.max(peak, body.pos.y);
    assert.ok(body.pos.y >= 0); assert.ok(Number.isFinite(body.pos.x));
  }
  assert.ok(peak > 2); assert.ok(body.bounces > 0 && body.bounces <= 2);
  assert.equal(body.vy, 0); assert.ok(Math.abs(body.vx) < 0.01);
});
