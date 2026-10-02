// Earned temporary gravity fields. Run: node qa/lab/tilt.field.sim.mjs
import assert from 'node:assert/strict';
import { createAdventure, updateAdventure, launchAdventure, chooseUpgrade, currentSector,
  canDeployGravityWell, deployGravityWell, gravityWellForce, FIELD_CAPACITY, FIELD_DURATION,
  FIELD_RADIUS, FIELD_ACCELERATION, setAdventureTilt } from '../../public/lab/tilt/adventure.js';
import { H } from '../../public/lab/tilt/physics.js';
import { BALL_R } from '../../public/lab/tilt/table.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function advance(run, seconds) {
  const events = [];
  for (let i = 0; i < Math.round(seconds / H); i++) events.push(...updateAdventure(run));
  return events;
}
function place(run, x, y, vx = 0, vy = 0) {
  Object.assign(run.world.ball, { x, y, vx, vy, live: true, lane: false });
  for (const f of run.world.flippers) f.sd = 0;
  run.phase = 'play';
}
function strike(run, relay) {
  place(run, relay.x + relay.r + 60, relay.y, -1100, 0);
  return advance(run, .16);
}
function validTarget(run) {
  const p = currentSector(run).planet;
  const targets = [[-270, 120], [270, 120], [-270, -120], [270, -120]].map(([x, y]) => ({ x: p.x + x, y: p.y + y }));
  return targets.find(t => canDeployGravityWell(run, t.x, t.y)) || targets[0];
}
const deploy = (run, kind = 'pull') => {
  const p = validTarget(run);
  return deployGravityWell(run, p.x, p.y, kind);
};

{
  const run = createAdventure(8), p = currentSector(run).planet, target = validTarget(run);
  assert.equal(run.fieldCharges, 1); assert.equal(run.gravityWell, null);
  assert.equal(deploy(run), false, 'a docked ball cannot spend a field');
  launchAdventure(run);
  const asteroid = run.table.bumpers.find(b => b.sector === 0 && b.asteroid);
  const invalid = [[NaN, target.y], [Infinity, target.y], [target.x, -Infinity],
    [p.x, p.y], [p.x + p.r + 27, p.y], [p.x + 701, p.y], [asteroid.x, asteroid.y]];
  const before = { ...run.world.ball };
  for (const [x, y] of invalid) {
    assert.equal(canDeployGravityWell(run, x, y), false);
    assert.equal(deployGravityWell(run, x, y), false);
    assert.equal(run.fieldCharges, 1, 'invalid placement costs no charge');
    assert.equal(run.gravityWell, null);
  }
  assert.equal(deployGravityWell(run, target.x, target.y, 'unknown'), false);
  run.world.ball.live = false;
  assert.equal(deploy(run), false, 'a non-live ball cannot deploy');
  run.world.ball.live = true;
  assert(deploy(run));
  assert.equal(run.fieldCharges, 0); assert.equal(run.gravityWell.remaining, FIELD_DURATION);
  assert.deepEqual(run.world.ball, before, 'deployment applies no impulse or teleport');
  assert.equal(deploy(run, 'push'), false, 'one active field cannot be replaced');
  assert.equal(run.gravityWell.kind, 'pull');
  updateAdventure(run, 0);
  assert.equal(run.events.filter(e => e.type === 'field-deploy').length, 1);
  console.log('ok: valid placement spends one charge; invalid input and repeated deployment are harmless');
}

{
  const pull = { x: 0, y: 0, kind: 'pull', remaining: 3, duration: FIELD_DURATION, radius: FIELD_RADIUS };
  const push = { ...pull, kind: 'push' };
  for (const radius of [0, .000001, 20, 80, 170, 270, FIELD_RADIUS - .001, FIELD_RADIUS, FIELD_RADIUS + 1, 1000]) {
    for (const angle of [0, .4, 1.8, 3.7]) {
      const ball = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      const a = gravityWellForce(pull, ball), b = gravityWellForce(push, ball);
      assert(Number.isFinite(a.x) && Number.isFinite(a.y));
      assert(Math.hypot(a.x, a.y) <= FIELD_ACCELERATION + 1e-9, 'force has a finite acceleration cap');
      assert(Math.abs(a.x + b.x) < 1e-9 && Math.abs(a.y + b.y) < 1e-9, 'pull and push point in opposite directions');
      assert(a.x * ball.x + a.y * ball.y <= 1e-8, 'pull always points toward the chosen center');
      if (radius >= FIELD_RADIUS || radius === 0) assert(Math.hypot(a.x, a.y) < 1e-9);
    }
  }
  assert(Math.hypot(...Object.values(gravityWellForce(pull, { x: FIELD_RADIUS - .001, y: 0 }))) < .001,
    'force approaches zero smoothly at the field edge');
  const ball = { x: FIELD_RADIUS / 2, y: 0 };
  const strength = remaining => Math.hypot(...Object.values(gravityWellForce({ ...pull, remaining }, ball)));
  assert.equal(strength(FIELD_DURATION), 0, 'a new field starts without an acceleration jump');
  assert(strength(4.91) > 0 && strength(4.91) < strength(4.7));
  assert(strength(.01) < strength(.2) && strength(.2) < strength(1), 'expiry eases the force out');
  assert.equal(strength(0), 0);
  assert.deepEqual(gravityWellForce(null, ball), { x: 0, y: 0 });
  console.log('ok: bounded radial pull and push, finite center, local range and smooth arrival/expiry');
}

{
  const runs = ['none', 'pull', 'push'].map(kind => {
    const run = createAdventure(8), p = currentSector(run).planet;
    launchAdventure(run); place(run, p.x - 260, p.y - 100, 0, 550);
    if (kind !== 'none') assert(deploy(run, kind));
    return run;
  });
  for (let i = 0; i < 36; i++) for (const run of runs) {
    updateAdventure(run);
    const b = run.world.ball, s = currentSector(run);
    for (const body of [s.planet, ...run.table.bumpers.filter(body => body.sector === 0)]) {
      assert(distance(b, body) > body.r + BALL_R, 'the comparison stays clear of solid bodies');
    }
    assert.equal(run.phase, 'play');
  }
  const [normal, pull, push] = runs.map(run => run.world.ball);
  assert(pull.y > normal.y + 20 && push.y < normal.y - 20, 'the same incoming shot bends toward pull and away from push');
  assert(distance(pull, push) > 50, 'the choices make materially different physical routes');
  console.log('ok: pull and push bend the same collision-free flight in opposite directions');
}

{
  const run = createAdventure(8), s = currentSector(run), sample = { x: s.planet.x - 200, y: s.planet.y };
  launchAdventure(run);
  setAdventureTilt(run, .4, -.2);
  const baseline = run.table.gravity(sample);
  assert(deploy(run));
  // Remove collision/drain outcomes so this checks field lifetime independently of checkpoint cleanup.
  run.table.isActive = () => false; run.table.isDrain = () => false;
  advance(run, .5);
  assert(distance(run.table.gravity(sample), baseline) > 100, 'the field participates in the solver gravity hook');
  const remaining = run.gravityWell.remaining;
  for (let i = 0; i < 600; i++) updateAdventure(run, 0);
  assert.equal(run.gravityWell.remaining, remaining, 'paused frames do not spend field time');
  advance(run, FIELD_DURATION - .5 - H);
  assert(run.gravityWell?.remaining > 0, 'the field lasts through the penultimate gameplay step');
  // Rally gravity now evolves during these five seconds. Compare expiry with
  // the same next-step gravity minus the well, rather than the launch-time field.
  const expectedAfterExpiry = run.table.gravityAt(sample, H, null);
  const events = updateAdventure(run);
  assert.equal(run.gravityWell, null);
  assert(events.some(e => e.type === 'field-expire' && e.reason === 'expired'));
  assert(distance(run.table.gravity(sample), expectedAfterExpiry) < 1e-8, 'expiry restores the current planet, rally and tilt force');
  assert.equal(deploy(run), false, 'expiry does not refund the spent charge');
  console.log('ok: five gameplay seconds, pause-safe lifetime and exact baseline gravity after expiry');
}

{
  const run = createAdventure(8), s = currentSector(run);
  launchAdventure(run);
  let events = strike(run, s.relays[0]);
  assert.equal(run.fieldCharges, 2);
  assert(events.some(e => e.type === 'field-charge' && e.source === 'relay'));
  events = strike(run, s.relays[0]);
  assert.equal(run.fieldCharges, 2, 'a lit relay cannot be farmed for charges');
  assert(!events.some(e => e.type === 'field-charge'));
  strike(run, s.relays[1]);
  assert.equal(run.fieldCharges, FIELD_CAPACITY);
  events = strike(run, s.relays[2]);
  assert.equal(run.fieldCharges, FIELD_CAPACITY);
  assert(!events.some(e => e.type === 'field-charge'), 'a full inventory emits no false gain');

  const final = createAdventure(8);
  final.sectorIndex = 5; launchAdventure(final);
  const relay = currentSector(final).relays[0];
  strike(final, relay);
  assert.equal(relay.hits, 1); assert.equal(final.fieldCharges, 2);
  strike(final, relay);
  assert.equal(relay.hits, 2); assert.equal(final.fieldCharges, 3, 'each required final-core charge earns one field');

  const orbit = createAdventure(8), p = currentSector(orbit).planet;
  launchAdventure(orbit); orbit.fieldCharges = 0;
  place(orbit, p.x - 260, p.y, 0, 675);
  const orbitEvents = [];
  for (let i = 0; i < 600 && !orbit.orbitCount; i++) orbitEvents.push(...updateAdventure(orbit));
  assert(orbitEvents.some(e => e.type === 'orbit'), 'ordinary physical flight completes a half-orbit');
  assert(orbitEvents.some(e => e.type === 'field-charge' && e.source === 'orbit'), 'a half-orbit replenishes inventory');
  console.log('ok: physical relay charges and half-orbits replenish the three-charge inventory');
}

{
  for (const lastLife of [false, true]) {
    const run = createAdventure(8), s = currentSector(run);
    launchAdventure(run); run.saveUntil = 0;
    if (lastLife) run.lives = 1;
    assert(deploy(run));
    place(run, s.x, s.y + 3, 0, -100);
    const events = updateAdventure(run);
    assert.equal(run.gravityWell, null, 'draining clears the field before the next checkpoint');
    assert.equal(run.fieldCharges, 0, 'draining does not refill the inventory');
    assert.equal(run.phase, lastLife ? 'over' : 'ready');
    assert(events.some(e => e.type === 'field-expire' && e.reason === 'drain'));
  }
  for (const finalSector of [false, true]) {
    const run = createAdventure(8);
    if (finalSector) run.sectorIndex = 5;
    launchAdventure(run);
    const s = currentSector(run);
    // Finish at the lowest relay so opening the gate does not enter it before deployment.
    for (const relay of [...s.relays].reverse()) while (!relay.hit) strike(run, relay);
    assert(deploy(run));
    const carried = run.fieldCharges;
    place(run, s.gate.x + s.gate.r + 25, s.gate.y, -1000, 0);
    const events = advance(run, .12);
    assert.equal(run.gravityWell, null, 'entering a gate clears the departing field');
    assert.equal(run.phase, finalSector ? 'won' : 'upgrade');
    assert(events.some(e => e.type === 'field-expire' && e.reason === (finalSector ? 'won' : 'sector')));
    if (!finalSector) {
      assert(chooseUpgrade(run, 'pulse')); advance(run, run.flight.duration + H * 2);
      assert.equal(run.sectorIndex, 1); assert.equal(run.phase, 'ready');
      assert.equal(run.fieldCharges, carried, 'unused charges carry to the next sector');
      assert.equal(run.gravityWell, null);
    }
  }
  console.log('ok: drain, final life, gate and victory clean up fields; unused charges travel with the player');
}

console.log('PASS temporary gravity field simulation');

