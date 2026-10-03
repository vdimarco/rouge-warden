// The skill shot: each world marks one beacon that a launch can light first, for a ×2 bonus.
// The charge sets the arc. Run: node qa/lab/tilt.skill.sim.mjs
import assert from 'node:assert/strict';
import { createAdventure, updateAdventure, launchAdventure, currentSector, forecastLaunch, chooseUpgrade,
  skipAdventureFlight, LAUNCH_MIN, SKILL_BONUS, RALLY_FLIGHT, WORLD_LAYOUTS } from '../../public/lab/tilt/adventure.js';
import { H } from '../../public/lab/tilt/physics.js';

const powers = Array.from({ length: 66 }, (_, i) => LAUNCH_MIN + i * (1 - LAUNCH_MIN) / 65);
const next = run => { run.phase = 'upgrade'; chooseUpgrade(run, 'pulse'); skipAdventureFlight(run); };
const wait = (run, seconds) => { for (let i = 0; i < Math.round(seconds / H); i++) updateAdventure(run); };
const TIDE_PERIOD = 2 * Math.PI / .85;

{
  // The charge sets the arc: a tap and a full charge send very different shots.
  const run = createAdventure(8), tap = run.table.launchVelocity(LAUNCH_MIN), full = run.table.launchVelocity(1);
  assert(Math.hypot(full.x, full.y) > Math.hypot(tap.x, tap.y) * 1.5, 'a full charge launches much faster than a tap');
  assert(Math.abs(Math.atan2(tap.x, tap.y) - Math.atan2(full.x, full.y)) > 5 * Math.PI / 180, 'the charge also turns the launch angle');
  console.log('ok: the launch power runs from a tap to a full charge and sets the arc');
}
{
  // Every tested layout of every world has a launch power whose arc meets the skill beacon first.
  // The tide world turns the arc with time; there the player waits at the dock for the tide.
  let layouts = 0;
  for (let world = 0; world < 6; world++) WORLD_LAYOUTS[world].forEach((layout, index) => {
    const run = createAdventure(8, { layouts: WORLD_LAYOUTS.map((list, w) => w === world ? [layout] : list) });
    while (currentSector(run).world !== world) next(run);
    const s = currentSector(run);
    assert.equal(s.relays.filter(r => r.skill).length, 1, 'each world marks one skill beacon');
    const phases = s.planet.kind === 'tide' ? 8 : 2;
    let found = 0, width = Infinity;
    for (let k = 0; k < phases; k++) {
      const band = powers.filter(p => forecastLaunch(run, p).skill).length;
      if (band) found++;
      width = Math.min(width, band);
      wait(run, TIDE_PERIOD / 8);
    }
    const where = `world ${world + 1}, layout ${index + 1}`;
    assert(phases === 2 ? found === 2 && width >= 5 : found >= 4, `${where}: a launch power hits the skill beacon (${found}/${phases} times)`);
    layouts++;
  });
  console.log(`ok: all ${layouts} tested layouts have a launch power that lights the skill beacon first`);
}
{
  // The forecast is the launch: a real launch at a skill power lights the beacon with the bonus.
  for (let world = 0; world < 6; world++) {
    const run = createAdventure(21);
    for (let i = 0; i < world; i++) next(run);
    let power = null;
    for (let k = 0; k < 16 && power === null; k++) {
      const band = powers.filter(p => forecastLaunch(run, p).skill);
      if (band.length) power = band[Math.floor(band.length / 2)]; else wait(run, TIDE_PERIOD / 16);
    }
    assert(power !== null, `world ${world + 1}: a skill power exists`);
    const skill = currentSector(run).relays.find(r => r.skill), score = run.score;
    assert(launchAdventure(run, power));
    let relay = null;
    for (let i = 0; i < RALLY_FLIGHT / H && !relay; i++) relay = updateAdventure(run).find(e => e.type === 'relay');
    assert(relay && relay.id === skill.id && relay.skill, `world ${world + 1}: the launch lights the skill beacon`);
    const base = relay.complete ? 1000 : 450;
    assert.equal(relay.points, base * relay.multiplier * SKILL_BONUS, 'the skill shot pays double');
    assert(run.score - score >= relay.points && run.skillShots === 1);
  }
  console.log('ok: a real launch at the forecast power lights the skill beacon in all six worlds and pays ×2');
}
{
  // No skill bonus after the shot ends: another beacon, a flip or the return disarms it.
  // In the first world a launch meets the skill beacon, an asteroid or open space, so the ball
  // goes straight to another beacon after the launch.
  const run = createAdventure(8), s = currentSector(run), skill = s.relays.find(r => r.skill), target = s.relays.find(r => !r.skill);
  launchAdventure(run, LAUNCH_MIN);
  assert(run.skill.armed, 'a launch arms the skill shot');
  Object.assign(run.world.ball, { x: target.x - target.r - 60, y: target.y, vx: 1100, vy: 0 });
  let first = null;
  for (let i = 0; i < RALLY_FLIGHT / H && !first; i++) first = updateAdventure(run).find(e => e.type === 'relay');
  assert(first && !first.skill && !run.skill.armed, 'another beacon first gets no bonus and ends the skill shot');
  Object.assign(run.world.ball, { x: skill.x + skill.r + 60, y: skill.y, vx: -1100, vy: 0 });
  let late = null;
  for (let i = 0; i < 20 && !late; i++) late = updateAdventure(run).find(e => e.type === 'relay');
  assert(late && late.id === skill.id && !late.skill, 'the skill beacon pays no bonus after the shot ends');
  const touched = createAdventure(8), blade = touched.world.flippers.find(f => f.sector === currentSector(touched).id && f.side < 0);
  launchAdventure(touched, 1);
  Object.assign(touched.world.ball, { x: blade.px + 45, y: blade.py + 20, vx: 0, vy: -600 });
  let contact = null;
  for (let i = 0; i < 30 && !contact; i++) contact = updateAdventure(touched).find(e => e.type === 'flipper');
  assert(contact && !touched.skill.armed, 'a hit on a flipper ends the skill shot');
  const waiting = createAdventure(8);
  launchAdventure(waiting, 1);
  for (let i = 0; i < (RALLY_FLIGHT + .1) / H && waiting.phase === 'play'; i++) updateAdventure(waiting);
  assert(!waiting.skill.armed, 'the return ends the skill shot');
  console.log('ok: another beacon first, a flip or the return ends the skill shot');
}
console.log('tilt.skill.sim: all passed');
