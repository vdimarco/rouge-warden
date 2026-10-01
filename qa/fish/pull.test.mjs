import assert from 'node:assert/strict';
import { PullStrength } from '../../public/fish/js/pull.js';
const session = {};
const p = new PullStrength();
let input = { theta: 50, enabled: true, active: true, crank: 2, tension: 0.3, session };
const step = (changes = {}, dt = 1 / 60) => p.step(dt, { ...input, ...changes });
assert.equal(step(), 0, 'Initial grip is neutral');
assert.equal(step({ theta: 53 }), 0, 'Small movements stay neutral');
const first = step({ theta: 82 });
assert.ok(first > 0 && first < 0.2, 'Power eases in');
for (let i = 0; i < 60; i++) step({ theta: 82 });
assert.ok(step({ theta: 82 }) > 0.99, 'A held pull keeps its strength');
assert.equal(step({ theta: 82, crank: 0 }), 0, 'Pull cannot reel without a crank');
assert.equal(step({ theta: 82, tension: 0.86 }), 0, 'High tension removes extra load');
assert.equal(step({ theta: 82, active: false }), 0, 'Jump and other inactive phases get no power');
assert.equal(step({ theta: 82, enabled: false }), 0, 'Sensor loss clears power');
assert.equal(step({ theta: 82 }), 0, 'Sensors recover with a new neutral grip');
assert.equal(step({ theta: 100, session: {} }), 0, 'A new cast clears power');
p.reset();
assert.equal(step({ theta: NaN }), 0, 'Invalid samples clear power');
function run(hz) {
  const q = new PullStrength();
  q.step(1 / hz, input);
  let value;
  for (let i = 0; i < hz; i++) value = q.step(1 / hz, { ...input, theta: 82 });
  return value;
}
assert.ok(Math.abs(run(30) - run(120)) < 1e-9, 'Response is independent of frame rate');
console.log('Pull strength: 13 checks passed');
// The actual fight must wind more line for the same crank input.
const { LakeSim, rodTip } = await import('../../public/fish/js/fish.js');
const { rng } = await import('../../public/fish/js/lake.js');
function wind(pull, crank = 1) {
  const sim = new LakeSim({ lure: { x: 2, z: -25 }, tip: rodTip(45, 5), lineOut: 30, rng: rng(5), species: 'perch' });
  sim.hook(1);
  const before = sim.state.lineOut;
  sim.step(1 / 60, { crank, pull, theta: 45, tip: rodTip(45, 5) });
  return before - sim.state.lineOut;
}
assert.ok(Math.abs(wind(1) / wind(0) - 1.35) < 1e-6, 'Full pull adds 35% line recovery');
assert.equal(wind(1, 0), wind(0, 0), 'Pull alone does not wind line');
assert.equal(wind(10), wind(1), 'Simulation caps extra power');
console.log('Fight integration checks passed');
