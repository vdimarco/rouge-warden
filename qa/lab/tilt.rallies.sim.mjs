// Active rallies, moving hazards and comparative play. Run: node qa/lab/tilt.rallies.sim.mjs
import assert from 'node:assert/strict';
import { createAdventure, currentSector, launchAdventure, updateAdventure, pulseAdventure, chooseUpgrade,
  skipAdventureFlight, forecastAdventureFlip, CHAIN_STEP, RALLY_FLIGHT, RALLY_POWER, PULSE_IMPULSE, SHOT_SPEEDS } from '../../public/lab/tilt/adventure.js';
import { asteroidPose, breakAsteroid, ASTEROID_WARNING } from '../../public/lab/tilt/asteroids.js';
import { setFlip, canReverseScoop, H } from '../../public/lab/tilt/physics.js';
import { BALL_R } from '../../public/lab/tilt/table.js';
const advance = (run, seconds) => { const events = []; for (let i = 0; i < Math.round(seconds / H); i++) events.push(...updateAdventure(run)); return events; };
function place(run, x, y, vx = 0, vy = 0) {
  Object.assign(run.world.ball, { x, y, vx, vy, live: true, lane: false });
  for (const f of run.world.flippers) f.sd = 0;
  run.phase = 'play';
}
const clean = grade => grade === 'perfect' || grade === 'good';
{
  const run = createAdventure(8), s = currentSector(run), f = run.world.flippers[0];
  launchAdventure(run); setFlip(run.world, -1, true); advance(run, .2);
  assert.equal(run.rally.shots, 0, 'empty presses earn no power');
  place(run, f.px + 55, f.py + 90, 0, -400);
  advance(run, .5);
  assert.equal(run.rally.shots, 0, 'a held blade cannot award a motor strike');
  let chain = run.rally.chain, multiplier = run.rally.multiplier;
  for (let hit = 1; hit <= 4; hit++) {
    setFlip(run.world, -1, false); advance(run, .1);
    place(run, f.px + 55, f.py + 50, 0, -300);
    run.rally.age = 6; run.rally.returning = true;
    setFlip(run.world, -1, true);
    // Step to the strike, then check the state that the strike makes.
    const events = [];
    while (!events.some(e => e.type === 'strike') && events.length < 400) {
      const step = updateAdventure(run);
      events.push(...step);
      if (!step.length) events.push({ type: 'tick' });
    }
    const strike = events.find(e => e.type === 'strike');
    assert(strike && ['perfect', 'good', 'late'].includes(strike.grade), 'every powered flip has a grade');
    assert(run.rally.age < H * 2 && !run.rally.returning, 'real shot opens another orbital window');
    chain = clean(strike.grade) ? chain + 1 : 0;
    if (clean(strike.grade) && chain % CHAIN_STEP === 0) multiplier++;
    assert.equal(run.rally.chain, chain, 'Good and Perfect flips build the row; a Late flip ends it');
    assert.equal(run.rally.multiplier, multiplier, 'each two clean flips in one row add one; a Late flip keeps the multiplier');
    assert.equal(strike.multiplier, run.rally.multiplier);
    const later = advance(run, .3);
    assert.equal(later.filter(e => e.type === 'strike').length, 0, 'one physical shot awards once');
    assert.equal(run.rally.shots, hit);
    assert(run.rally.powerRemaining > RALLY_POWER - .4);
  }
  const rally = JSON.stringify(run.rally), path = run.table.bumpers.find(b => b.asteroid).pathTime;
  advance(run, 0); for (let i = 0; i < 100; i++) updateAdventure(run, 0);
  assert.equal(JSON.stringify(run.rally), rally); assert.equal(run.table.bumpers.find(b => b.asteroid).pathTime, path);
  setFlip(run.world, -1, false); advance(run, .1);
  place(run, s.x - 75, s.y + 65, 0, -280);
  const shots = run.rally.shots; run.rally.age = 9; run.rally.returning = true;
  setFlip(run.world, -1, true); updateAdventure(run);
  assert.equal(run.rally.shots, shots, 'reverse recovery cannot farm the motor reward');
  assert(run.rally.age < H * 2 && !run.rally.returning);
  advance(run, .6); run.saveUntil = 0; place(run, s.x, s.y + 3, 0, -100); updateAdventure(run);
  assert.equal(run.rally.shots, 0); assert.equal(run.rally.powerRemaining, 0);
  assert.equal(run.rally.multiplier, 1); assert.equal(run.rally.chain, 0, 'a lost heart resets the multiplier');
  console.log('ok: genuine motor shots, graded rally row, held/empty input, pause, reverse and drain lifecycle');
}
{
  // The multiplier has no top, it lasts through checkpoints and worlds, and only a lost heart resets it.
  const run = createAdventure(8), s = currentSector(run);
  launchAdventure(run); Object.assign(run.rally, { chain: 12, multiplier: 7 });
  const relay = s.relays.find(r => !r.hit), score = run.score;
  place(run, relay.x + relay.r + 60, relay.y, -1100, 0);
  const events = advance(run, .16);
  const lit = events.find(e => e.type === 'relay');
  assert(lit && lit.multiplier === 7 && run.score - score >= 7000, 'the rally multiplier applies to relays');
  assert(run.rally.returning || run.rally.age >= RALLY_FLIGHT, 'a lit relay ends the orbit and starts the return');
  run.saveUntil = run.clock + 5; place(run, s.x, s.y + 3, 0, -100); updateAdventure(run);
  assert.equal(run.phase, 'ready'); assert.equal(run.rally.multiplier, 7, 'the launch shield keeps the multiplier');
  run.phase = 'upgrade'; chooseUpgrade(run, 'pulse'); skipAdventureFlight(run);
  assert.equal(run.rally.multiplier, 7, 'the multiplier travels to the next world');
  launchAdventure(run); run.saveUntil = 0; place(run, currentSector(run).x, currentSector(run).y + 3, 0, -100);
  const lost = updateAdventure(run).find(e => e.type === 'drain');
  assert(lost && lost.multiplier === 7 && run.rally.multiplier === 1, 'a lost heart resets the multiplier');
  console.log('ok: no top on the multiplier; relays pay it; only a lost heart resets it');
}
{
  // Grades follow the press time. The cue's ideal moment gives Perfect, a press after the ball
  // lands gives Late, and a very early press meets the end of the swing.
  const results = {};
  for (const [name, offset] of [['ideal', 0], ['ideal+10', .01], ['ideal-10', -.01], ['late', .06], ['early', -.11]]) {
    const run = createAdventure(8), s = currentSector(run);
    const f = run.world.flippers.find(b => b.sector === 0 && b.side === -1);
    launchAdventure(run); run.saveUntil = 0;
    place(run, s.x - 75, f.py + 110, 0, -400);
    Object.assign(run.rally, { age: 10, returning: true, side: -1, chain: 3, multiplier: 5 });
    const cue = forecastAdventureFlip(run, 1.2);
    assert(cue && cue.side === -1 && cue.impact && cue.ideal > .1, 'the forecast finds the blade and the ideal press time');
    const press = Math.round((cue.ideal + offset) / H);
    let strike = null, struckAt = 0, speed = 0;
    for (let i = 0; i < 90 && !speed; i++) {
      if (i === Math.max(0, press)) setFlip(run.world, -1, true);
      const events = updateAdventure(run);
      if (!strike) { strike = events.find(e => e.type === 'strike') || null; struckAt = run.clock; }
      else if (run.clock - struckAt >= .1) speed = Math.hypot(run.world.ball.vx, run.world.ball.vy);
    }
    results[name] = { grade: strike?.grade, timing: strike?.timing, speed, chain: run.rally.chain, multiplier: run.rally.multiplier };
  }
  for (const name of ['ideal', 'ideal+10', 'ideal-10']) assert.equal(results[name].grade, 'perfect', `a press at ${name} ms is Perfect`);
  assert.equal(results.late.grade, 'late'); assert.equal(results.late.timing, 'late', 'a press after the ball lands is Late');
  assert.notEqual(results.early.grade, 'perfect', 'a very early press is not Perfect');
  assert(results.ideal.chain === 4 && results.ideal.multiplier === 6, 'a clean flip that completes a pair in the row raises the multiplier');
  assert(results.late.chain === 0 && results.late.multiplier === 5, 'a Late flip ends the row and keeps the multiplier');
  assert(results.ideal.speed > results.late.speed + 350 && results.late.speed <= SHOT_SPEEDS.late + 1,
    'a Late flip makes a weaker shot than a Perfect flip');
  console.log(`ok: grades follow the press time (${Object.entries(results).map(([k, v]) => `${k} ${v.grade}${v.timing ? '/' + v.timing : ''}`).join(', ')})`);
}
{
  // The approach cue: on unattended returns the forecast names the blade and the touch time
  // well ahead, and the real ball touches the blade at that time.
  const leads = [], errors = [];
  for (let seed = 1; seed <= 12; seed++) {
    const run = createAdventure(seed * 97); launchAdventure(run, .6);
    let first = null;
    for (let i = 0; i < 9 / H && run.phase === 'play'; i++) {
      if (run.rally.returning && !first) {
        const cue = forecastAdventureFlip(run, 1.2);
        if (cue?.impact) first = { at: run.clock, touch: run.clock + cue.touch, side: cue.side };
      }
      const touched = updateAdventure(run).find(e => e.type === 'flipper');
      const blade = run.world.flippers.find(f => f.sector === run.sectorIndex && f.touchLast === run.world.t);
      if (first && (touched || blade)) {
        leads.push(first.touch - first.at); errors.push(Math.abs(run.clock - first.touch));
        assert.equal((blade || touched).side, first.side, 'the cue names the blade the ball reaches');
        break;
      }
    }
  }
  assert(leads.length >= 9, 'most unattended returns end in a clean drop onto a blade');
  assert(errors.every(e => e <= 2 * H + 1e-9), 'the forecast touch time matches the real touch within two frames');
  assert(leads.every(lead => lead >= .6), 'the cue starts at least 0.6 s before the ball reaches the blade');
  console.log(`ok: the approach cue forecasts ${leads.length} returns; lead ${Math.min(...leads).toFixed(2)} s or more; error ${(Math.max(...errors) * 1000).toFixed(1)} ms or less`);
}
{
  const run = createAdventure(8), s = currentSector(run);
  launchAdventure(run); place(run, s.x - 250, s.y + 800, 900, -600);
  run.rally.age = 4.8; run.rally.returning = true;
  const before = { ...run.world.ball }, age = run.rally.age;
  assert(pulseAdventure(run));
  const b = run.world.ball, dv = Math.hypot(b.vx - before.vx, b.vy - before.vy);
  assert(dv <= PULSE_IMPULSE + 1e-8 && dv > PULSE_IMPULSE - 1e-8);
  assert.equal(run.rally.age, age); assert(run.rally.returning);
  assert.equal(b.x, before.x); assert.equal(b.y, before.y);
  assert(b.vx > 400, 'the correction retains substantial incoming momentum');
  console.log('ok: pulse adds a bounded correction without resetting return or moving position');
}
{
  // A real launch, no steering, no score flags or positions changed.
  let worst = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const run = createAdventure(seed), s = currentSector(run); launchAdventure(run);
    let left = false, returned = false, gap = 0;
    for (let i = 0; i < 12 / H; i++) {
      const previous = { ...run.world.ball }; updateAdventure(run);
      const b = run.world.ball;
      assert(Number.isFinite(b.x + b.y + b.vx + b.vy));
      if (run.phase === 'play') assert(Math.hypot(b.x - previous.x, b.y - previous.y) < 20, 'return has no position jump');
      if (b.y > s.y + 420 || Math.abs(b.x - s.x) > 260) left = true;
      if (left) gap += H;
      if (left && Math.abs(b.x - s.x) < 260 && b.y < s.y + 420 && b.vy < 0) { returned = true; break; }
      if (run.phase !== 'play') { returned = true; break; }
    }
    assert(returned && gap < 10, `seed ${seed}: unattended flight returns within ten seconds`);
    worst = Math.max(worst, gap);
  }
  console.log(`ok: 20 unattended seeds offer another dock approach; longest ${worst.toFixed(2)} s`);
}
{
  for (const seed of [1, 8, 21, 73]) {
    const run = createAdventure(seed), clone = createAdventure(seed);
    assert.equal(JSON.stringify(run.table.bumpers), JSON.stringify(clone.table.bumpers));
    for (const s of run.sectors) for (let time = 0; time < 30; time += .25) {
      const rocks = run.table.bumpers.filter(b => b.sector === s.id && b.asteroid);
      for (const rock of rocks) {
        const pose = asteroidPose(rock, time);
        assert(Math.abs(pose.x - rock.anchorX) <= rock.rangeX + 1e-8);
        assert(Math.abs(pose.y - rock.anchorY) <= rock.rangeY + 1e-8);
        for (const body of [s.planet, s.gate, ...s.relays, ...rocks.filter(b => b !== rock)]) {
          const other = body.dynamic ? asteroidPose(body, time) : body;
          assert(Math.hypot(pose.x - other.x, pose.y - other.y) > rock.r + body.r + BALL_R * 2,
            'seeded paths retain a ball-wide gap from rocks and objective bodies');
        }
        assert(pose.y - rock.r > s.y + 340, 'asteroids stay outside the flipper approach');
      }
    }
  }
  console.log('ok: repeatable, bounded asteroid paths preserve playable gaps in all sectors');
}
{
  for (const powered of [false, true]) {
    const run = createAdventure(8), rock = run.table.bumpers.find(b => b.asteroid && b.sector === 0);
    launchAdventure(run); run.table.gravity = () => ({ x: 0, y: 0 }); run.table.isDrain = () => false;
    place(run, rock.x + rock.r + BALL_R + 8, rock.y, -700, 0);
    if (powered) { run.rally.powerRemaining = 2; run.rally.multiplier = 3; }
    const score = run.score, events = advance(run, .12);
    if (!powered) {
      assert(rock.active); assert(run.world.ball.vx > 0 && run.world.ball.vx < 600, 'ordinary relative collision dissipates, without kicker');
      assert(!events.some(e => e.type === 'asteroid-break')); assert.equal(run.score, score);
    } else {
      assert(!rock.active); assert.equal(events.filter(e => e.type === 'asteroid-break').length, 1);
      assert.equal(run.score - score, 750); assert.equal(breakAsteroid(rock), false);
      assert(run.world.ball.vx < -650, 'powered shot passes through the shattered rock');
      const future = run.table.bumpers.find(b => b.asteroid && b.sector === 1), futureTime = future.pathTime;
      let warnings = 0;
      for (let i = 0; i < 9 / H; i++) {
        // Remain at the returning rock's location: respawn must keep waiting.
        Object.assign(run.world.ball, { x: rock.x, y: rock.y, vx: 0, vy: 0 });
        for (const e of updateAdventure(run)) if (e.type === 'asteroid-warning' && e.id === rock.id) warnings++;
      }
      assert.equal(warnings, 1); assert(!rock.active && rock.warningRemaining > 0);
      assert.equal(future.pathTime, futureTime, 'inactive sectors do not move');
      place(run, rock.x + 200, rock.y); updateAdventure(run);
      assert(rock.active && rock.warningRemaining === 0, 'safe departure permits reentry');
    }
  }
  assert(ASTEROID_WARNING >= 1);
  console.log('ok: relative deflection, one destruction reward, warning, safe delayed reentry and sector isolation');
}
{
  const results = [];
  for (const policy of ['pulse', 'active']) for (const seed of [1, 8, 21, 42, 73, 101]) {
    const run = createAdventure(seed); let ticks = 0, strikes = 0, away = 0, longestAway = 0;
    for (let i = 0; i < 360 / H; i++) {
      if (run.phase === 'ready') launchAdventure(run, .75);
      if (run.phase === 'upgrade') chooseUpgrade(run, run.lives < 3 ? 'shield' : 'pulse');
      if (run.phase === 'play') {
        const b = run.world.ball, sector = currentSector(run);
        const near = Math.abs(b.x - sector.x) < 260 && b.y < sector.y + 420;
        away = near ? 0 : away + H; longestAway = Math.max(longestAway, away);
        if (policy === 'active') for (const side of [-1, 1]) {
          setFlip(run.world, side, b.y < sector.y + 360 && b.vy < 100 && ticks % 28 < 16);
        }
        if (run.pulseCooldown <= 0) pulseAdventure(run);
        ticks++;
      } else away = 0;
      updateAdventure(run);
      strikes += run.events.filter(event => event.type === 'strike').length;
      assert(Number.isFinite(run.world.ball.x + run.world.ball.y + run.world.ball.vx + run.world.ball.vy));
      if (run.phase === 'won' || run.phase === 'over') break;
    }
    results.push({ policy, seed, won: run.phase === 'won', play: ticks * H, strikes, longestAway });
  }
  const active = results.filter(result => result.policy === 'active'), passive = results.filter(result => result.policy === 'pulse');
  assert(active.every(result => result.won), 'six seeded routes remain beatable using physical controls within six minutes');
  assert(passive.every(result => !result.won && result.strikes === 0), 'auto-aim Pulse alone no longer plays the whole game');
  assert(active.every(result => result.longestAway < 12), 'active runs have no prolonged spectator orbit');
  const cadence = active.reduce((sum, result) => sum + result.strikes, 0) / active.reduce((sum, result) => sum + result.play, 0) * 60;
  assert(cadence > 6, 'ordinary timed controls make at least six real powered shots per active minute');
  console.log(`ok: active play wins 6/6, Pulse-only wins 0/6; ${cadence.toFixed(1)} real shots/min; longest orbit ${Math.max(...active.map(result => result.longestAway)).toFixed(1)} s`);
}
// The review's policy bot: it flips when the ball should reach the blade within 50 ms, with a
// random timing error of up to ±jitter seconds. Precise timing must pay much more than sloppy timing.
function timedBot(seed, jitter) {
  const run = createAdventure(seed);
  let n = seed >>> 0;
  const random = () => (n = (Math.imul(1664525, n) + 1013904223) >>> 0) / 4294967296;
  const held = { '-1': 0, '1': 0 };
  let wait = .6, play = 0, strikes = 0;
  while (run.clock < 600 && run.phase !== 'over' && run.phase !== 'won') {
    if (run.phase === 'upgrade') { chooseUpgrade(run, ['shield', 'pulse', 'comet'][run.sectorIndex % 3]); skipAdventureFlight(run); continue; }
    if (run.phase === 'ready') { if ((wait -= H) <= 0) { launchAdventure(run, .9); wait = .6; } updateAdventure(run); continue; }
    play += H;
    const b = run.world.ball;
    for (const f of run.world.flippers.filter(f => f.sector === run.sectorIndex)) {
      const along = (b.x - f.px) * -f.side;
      if (held[f.side] <= 0 && along > -5 && along < f.len + 18 && b.vy < -40) {
        const contact = (b.y - (f.py + 18)) / -b.vy;
        if (contact < .05 + (random() - .5) * 2 * jitter && contact > -.04) held[f.side] = .16;
      }
      if (held[f.side] <= 0 && canReverseScoop(run.world, f.side)) held[f.side] = .12;
    }
    for (const side of [-1, 1]) { setFlip(run.world, side, held[side] > 0); held[side] -= H; }
    strikes += updateAdventure(run).filter(e => e.type === 'strike').length;
  }
  return { score: run.score, won: run.phase === 'won', strikes, play };
}
{
  const runs = jitter => Array.from({ length: 24 }, (_, i) => timedBot((i + 1) * 7919, jitter));
  const precise = runs(.03), sloppy = runs(.08);
  const total = (list, key) => list.reduce((sum, run) => sum + run[key], 0);
  const ratio = total(precise, 'score') / total(sloppy, 'score');
  const cadence = total(precise, 'strikes') / total(precise, 'play') * 60;
  assert(ratio >= 1.3, `the ±30 ms bot outscores the ±80 ms bot by at least 30% (ratio ${ratio.toFixed(2)})`);
  assert(cadence >= 15, `timed play makes at least 15 powered flips a minute (${cadence.toFixed(1)})`);
  assert(precise.filter(run => run.won).length >= 22, 'precise timing finishes the voyage');
  console.log(`ok: over 24 seeds the ±30 ms bot scores ${Math.round(total(precise, 'score') / 24).toLocaleString('en-US')} and the ±80 ms bot ${Math.round(total(sloppy, 'score') / 24).toLocaleString('en-US')} (×${ratio.toFixed(2)}); ${cadence.toFixed(1)} powered flips/min; wins ${precise.filter(run => run.won).length} and ${sloppy.filter(run => run.won).length}`);
}
{
  // A player who presses when the cue closes gets Perfect flips.
  const grades = { perfect: 0, good: 0, late: 0 };
  for (const seed of [11, 23, 37, 51]) {
    const run = createAdventure(seed), held = { '-1': 0, '1': 0 };
    let plan = null, wait = .6;
    while (run.clock < 90 && run.phase !== 'over' && run.phase !== 'won') {
      if (run.phase === 'upgrade') { chooseUpgrade(run, 'pulse'); skipAdventureFlight(run); continue; }
      if (run.phase === 'ready') { if ((wait -= H) <= 0) { launchAdventure(run, .9); wait = .6; } plan = null; updateAdventure(run); continue; }
      const s = currentSector(run), b = run.world.ball;
      if (!plan && (run.rally.returning || (b.vy < 0 && b.y - s.y < 650))) {
        const cue = forecastAdventureFlip(run, .7);
        if (cue && !cue.held && cue.ideal < .35) plan = { side: cue.side, at: run.clock + cue.ideal };
      }
      if (plan && run.clock >= plan.at - 1e-9 && held[plan.side] <= 0) { held[plan.side] = .2; plan = null; }
      for (const side of [-1, 1]) { setFlip(run.world, side, held[side] > 0); held[side] -= H; }
      for (const e of updateAdventure(run)) if (e.type === 'strike') { grades[e.grade]++; plan = null; }
    }
  }
  const count = grades.perfect + grades.good + grades.late;
  assert(count >= 60 && grades.perfect / count >= .8, 'a press when the cue closes is Perfect at least 80% of the time');
  console.log(`ok: presses on the cue give ${grades.perfect} Perfect, ${grades.good} Good and ${grades.late} Late flips`);
}
console.log('tilt.rallies.sim: all passed');
