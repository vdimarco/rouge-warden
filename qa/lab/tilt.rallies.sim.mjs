// Active rallies, moving hazards and comparative play. Run: node qa/lab/tilt.rallies.sim.mjs
import assert from 'node:assert/strict';
import { createAdventure, currentSector, launchAdventure, updateAdventure, pulseAdventure, chooseUpgrade,
  RALLY_FLIGHT, RALLY_POWER, PULSE_IMPULSE } from '../../public/lab/tilt/adventure.js';
import { asteroidPose, breakAsteroid, ASTEROID_WARNING } from '../../public/lab/tilt/asteroids.js';
import { setFlip, H } from '../../public/lab/tilt/physics.js';
import { BALL_R } from '../../public/lab/tilt/table.js';
const advance = (run, seconds) => { const events = []; for (let i = 0; i < Math.round(seconds / H); i++) events.push(...updateAdventure(run)); return events; };
function place(run, x, y, vx = 0, vy = 0) {
  Object.assign(run.world.ball, { x, y, vx, vy, live: true, lane: false });
  for (const f of run.world.flippers) f.sd = 0;
  run.phase = 'play';
}
{
  const run = createAdventure(8), s = currentSector(run), f = run.world.flippers[0];
  launchAdventure(run); setFlip(run.world, -1, true); advance(run, .2);
  assert.equal(run.rally.shots, 0, 'empty presses earn no power');
  place(run, f.px + 55, f.py + 90, 0, -400);
  advance(run, .5);
  assert.equal(run.rally.shots, 0, 'a held blade cannot award a motor strike');
  for (let hit = 1; hit <= 4; hit++) {
    setFlip(run.world, -1, false); advance(run, .1);
    place(run, f.px + 55, f.py + 50, 0, -300);
    run.rally.age = 6; run.rally.returning = true;
    setFlip(run.world, -1, true);
    const events = advance(run, .3);
    assert.equal(events.filter(e => e.type === 'strike').length, 1, 'one physical shot awards once');
    assert.equal(run.rally.shots, hit);
    assert.equal(run.rally.multiplier, Math.min(3, hit));
    assert(run.rally.powerRemaining > RALLY_POWER - .4);
    assert(run.rally.age < .4 && !run.rally.returning, 'real shot opens another orbital window');
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
  assert.equal(run.rally.shots, 0); assert.equal(run.rally.powerRemaining, 0); assert.equal(run.rally.multiplier, 1);
  console.log('ok: genuine motor shots, capped multiplier, held/empty input, pause, reverse and drain lifecycle');
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
console.log('tilt.rallies.sim: all passed');
