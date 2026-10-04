// Moonwell: checks of the physics and the rules of a run. node qa/moonwell/play.test.mjs
import { createRun, tick, choose, award, pace, TICK, MOONRISE, MAX_PEARLS, POINTS, READY_WAIT } from '../../public/moonwell/run.js';
import { station, ensure, groundY, KEEP, BALL_R as R } from '../../public/moonwell/world.js';
import { createBot, botInput } from '../../public/moonwell/bot.js';
import { test, assert, report } from './check.mjs';

const idle = () => ({ left: false, right: false, drop: false, pulse: false });

// a run with the pearl waiting over island k + 1, as if it had just got there
function at(k, seed = 11) {
  const run = createRun({ seed });
  ensure(run.world, k + 4);
  run.at = k;
  run.far = k;
  tick(run, idle());
  return run;
}
function drop(run) { tick(run, { ...idle(), drop: true }); run.saver = 0; run.events = []; }
function play(run, seconds, input = idle, each) {
  const all = [];
  for (let t = 0; t < seconds; t += TICK) {
    tick(run, typeof input === 'function' ? input(run, t) : input);
    all.push(...run.events);
    run.events = [];
    if (each && each(run, t) === false) break;
    if (run.phase === 'over' || run.phase === 'charm') break;
  }
  return all;
}
// where the pearl is along the resting left flipper (0 at the pivot, 1 at the tip) and how far above it
function onFlipper(run, side = -1) {
  const s = station(run.world, run.at), f = s.flippers[side < 0 ? 0 : 1], b = run.ball;
  const c = Math.cos(f.rest), sn = Math.sin(f.rest), rx = b.x - f.px, ry = b.y - f.py;
  return { t: (rx * c + ry * sn) / f.len, up: side < 0 ? rx * sn - ry * c : -rx * sn + ry * c };
}
// flip the left flipper once, when the pearl reaches a point on it
function flipAt(aim) {
  let hold = -1, done = false;
  return (run, t) => {
    const p = onFlipper(run);
    if (!done && p.t >= aim && p.t < 1.1 && p.up > -10 && p.up < 70) { done = true; hold = t + 0.15; }
    return { ...idle(), left: t < hold };
  };
}

test('a pearl nobody flips rolls off the flipper and drains', () => {
  for (const k of [3, 10, 25]) {
    const run = at(k);
    drop(run);
    const ev = play(run, 4);
    assert(ev.some((e) => e.type === 'drain'), `island ${k + 1}: no drain`);
    assert(run.lives === 2, 'a drain did not cost a pearl');
  }
});

test('the moon post on the first islands stops a drain', () => {
  const run = at(1);
  drop(run);
  const ev = play(run, 5);
  assert(!ev.some((e) => e.type === 'drain'), 'the pearl drained past the moon post');
});

test('a raised flipper cradles the pearl', () => {
  const run = at(6);
  drop(run);
  let still = 0;
  const ev = play(run, 4, () => ({ ...idle(), left: true }), (r) => { if (Math.hypot(r.ball.vx, r.ball.vy) < 20) still += TICK; });
  assert(!ev.some((e) => e.type === 'drain'), 'the pearl drained while the flipper was up');
  assert(still > 1.5, `the pearl never came to rest (${still.toFixed(2)} s)`);
  const s = station(run.world, run.at);
  assert(run.ball.y < s.fy && run.ball.x < s.cx, 'the pearl is not resting in the crook of the left flipper');
});

test('a late flip clears the ridge, and an early one falls back', () => {
  let late = 0, early = 0, tries = 0;
  for (let seed = 1; seed <= 6; seed++) for (const k of [3, 9, 20, 33]) {
    tries++;
    let run = at(k, seed);
    drop(run);
    play(run, 4, flipAt(0.72), (r) => r.at === k);
    if (run.at > k) late++;
    run = at(k, seed);
    drop(run);
    play(run, 1.6, flipAt(0.1), (r) => r.at === k);
    if (run.at > k) early++;
  }
  assert(late / tries >= 0.75, `late flips cleared ${late} of ${tries}`);
  assert(early / tries <= 0.2, `early flips cleared ${early} of ${tries}`);
});

test('the right flipper passes the pearl back to the left', () => {
  let passes = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const run = at(12, seed);
    const s = station(run.world, run.at), f = s.flippers[1];
    // a pearl rolling down the right inlane onto the right flipper
    Object.assign(run.ball, { x: f.px - 40, y: f.py - 40, vx: -150, vy: 60, mode: 'free' });
    run.phase = 'play';
    let hold = -1, shot = false, vx = 0, vy = 0;
    const ev = play(run, 2.5, (r, t) => {
      const p = onFlipper(r, 1);
      if (hold < 0 && p.t > 0.5 && p.up < 60) hold = t + 0.15;
      return { ...idle(), right: t < hold };
    }, (r, t) => { if (hold > 0 && t > hold && !vx) { vx = r.ball.vx; vy = r.ball.vy; } });
    shot = ev.some((e) => e.type === 'shot' && e.side > 0);
    // the flip itself sends the pearl up and to the left, not only its roll down the inlane
    if (shot && vx < -100 && vy < -300) passes++;
  }
  assert(passes >= 6, `only ${passes} of 8 right flips sent the pearl up and left`);
});

test('the pearl never goes through the ground', () => {
  let checked = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const run = createRun({ seed });
    const bot = createBot({ skill: 0.7, seed });
    play(run, 40, () => botInput(run, bot), (r) => {
      if (r.phase === 'charm') choose(r, 0);
      const b = r.ball;
      if (b.mode !== 'free') return;
      const s = station(r.world, r.at);
      if (b.x < s.cx - s.P - 20 || b.x > s.cx + s.P + 20) {
        checked++;
        assert(b.y <= groundY(s, b.x) + 2, `seed ${seed}: the pearl is inside island ${r.at + 1} at ${b.x | 0},${b.y | 0}`);
      }
    });
  }
  assert(checked > 5000, 'too few samples');
});

test('a bumper kicks the pearl away harder than it came', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const run = at(20, seed);
    const s = station(run.world, run.at), o = s.bumpers[0];
    if (!o) continue;
    Object.assign(run.ball, { x: o.x - 60, y: o.y, vx: 400, vy: 0, mode: 'free' });
    run.phase = 'play';
    const ev = play(run, 0.3);
    assert(ev.some((e) => e.type === 'bumper'), 'no bumper hit');
    assert(Math.hypot(run.ball.vx, run.ball.vy) > 500, 'the bumper did not kick');
    return;
  }
  throw new Error('no bumper found');
});

test('ridges in a row raise the multiplier, up to 8, and a drain ends the streak', () => {
  const run = at(4);
  drop(run);
  const moves = [];
  for (let i = 0; i < 18; i++) {
    const s = station(run.world, run.at);
    Object.assign(run.ball, { x: s.x1 + R + 5, y: s.y1 - 60, vx: 0, vy: 0 });
    tick(run, idle());
    moves.push(run.mult);
    run.events = [];
  }
  assert(moves[0] === 1 && moves[1] === 2 && moves[3] === 3, `multipliers ${moves.slice(0, 4)}`);
  assert(Math.max(...moves) === 8, 'the multiplier is not capped at 8');
  const s = station(run.world, run.at);
  run.moonrise = 0; run.meter = 0;
  Object.assign(run.ball, { x: s.cx, y: s.drainY + 5, vx: 0, vy: 100 });
  tick(run, idle());
  assert(run.streak === 0 && run.mult === 1, 'a drain kept the streak');
});

test('one flight over two ridges is a long shot', () => {
  const run = at(8);
  drop(run);
  const ev = [];
  for (let i = 0; i < 2; i++) {
    const s = station(run.world, run.at);
    Object.assign(run.ball, { x: s.x1 + R + 5, y: s.y1 - 200, vx: 900, vy: -100 });
    tick(run, idle());
    ev.push(...run.events);
    run.events = [];
  }
  assert(ev.some((e) => e.type === 'score' && e.kind === 'long'), 'no long shot');
});

test('a full moon meter starts Moonrise, which doubles points and saves a drain', () => {
  const run = at(5);
  drop(run);
  run.meter = 0.999;
  award(run, POINTS.star, 'star', 0, 0, 0.1);
  assert(run.moonrise === MOONRISE, 'Moonrise did not start');
  const before = run.score;
  award(run, 100, 'star', 0, 0);
  assert(run.score - before === 200 * run.mult, 'points did not double');
  const s = station(run.world, run.at), lives = run.lives;
  Object.assign(run.ball, { x: s.cx, y: s.drainY + 5, vx: 0, vy: 200 });
  tick(run, idle());
  assert(run.lives === lives && run.ball.vy < -1000 && run.events.some((e) => e.type === 'saved'), 'Moonrise did not save the drain');
  run.events = [];
  play(run, MOONRISE + 0.5);
  assert(run.moonrise === 0 && run.meter === 0, 'Moonrise did not end');
});

test('a gold rail carries the pearl over islands and counts them', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const run = createRun({ seed });
    ensure(run.world, 70);
    let k = -1;
    for (let i = 3; i < 60; i++) if (station(run.world, i).rail) { k = i; break; }
    if (k < 0) continue;
    run.at = k; station(run.world, k).gate = 1;
    tick(run, idle()); drop(run);
    const rail = station(run.world, k).rail;
    Object.assign(run.ball, { x: rail.mouth.x, y: rail.mouth.y, vx: 300, vy: -300 });
    const ev = play(run, 6, idle, (r) => r.ball.mode !== 'free' || r.at === k);
    assert(ev.some((e) => e.type === 'rail'), 'the rail did not start');
    assert(run.at === rail.to, `the rail ended in island ${run.at + 1}, not ${rail.to + 1}`);
    assert(ev.filter((e) => e.type === 'ridge').length === rail.to - k, 'the rail did not count each island');
    assert(run.far === rail.to, 'the rail did not move the furthest island');
    assert(ev.some((e) => e.type === 'score' && e.kind === 'rail'), 'no rail bonus');
    // back to the mouth and round again: the ride works, but the bonus paid once
    run.at = k;
    Object.assign(run.ball, { x: rail.mouth.x, y: rail.mouth.y, vx: 300, vy: -300, mode: 'free' });
    const again = play(run, 6, idle, (r) => r.ball.mode !== 'free' || r.at === k);
    assert(again.some((e) => e.type === 'rail') && !again.some((e) => e.type === 'score' && (e.kind === 'rail' || e.kind === 'ridge')), 'a second ride paid again');
    return;
  }
  throw new Error('no rail found');
});

test('a moon portal sends the pearl two islands ahead', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const run = createRun({ seed });
    ensure(run.world, 70);
    let k = -1;
    for (let i = 3; i < 60; i++) if (station(run.world, i).portal) { k = i; break; }
    if (k < 0) continue;
    run.at = k; station(run.world, k).gate = 1;
    tick(run, idle()); drop(run);
    const p = station(run.world, k).portal;
    Object.assign(run.ball, { x: p.x, y: p.y, vx: 0, vy: 0 });
    const ev = play(run, 1.5, idle, (r) => r.ball.mode !== 'free' || r.at === k);
    assert(ev.some((e) => e.type === 'portal') && ev.some((e) => e.type === 'warpEnd'), 'the portal did not work');
    assert(run.at === p.to, `the portal ended in island ${run.at + 1}`);
    return;
  }
  throw new Error('no portal found');
});

test('a shrine offers three charms, and a charm works at once', () => {
  const run = at(7);
  drop(run);
  const s = station(run.world, 7);
  assert(s.sealed && s.well, 'island 8 is not a shrine');
  Object.assign(run.ball, { x: s.well.x - 30, y: s.well.y, vx: 0, vy: 0 });
  play(run, 1);
  assert(run.phase === 'charm' && run.offer.length === 3 && new Set(run.offer.map((c) => c.id)).size === 3, 'no offer of three charms');
  const lives = run.lives;
  const i = run.offer.findIndex((c) => c.id === 'heart');
  const pick = i >= 0 ? i : 0, id = run.offer[pick].id;
  assert(choose(run, pick), 'the choice failed');
  assert(run.phase === 'play' && run.at === 8 && run.ball.mode === 'free', 'the pearl did not go on into the next region');
  if (id === 'heart') assert(run.lives === lives + 1, 'Second Breath did not add a pearl');
  assert(run.charms[id] === 1, 'the charm was not kept');
  assert(!s.sealed && s.well.spent, 'the seal did not open, or the well can open twice');
  // back into the shrine's bowl: the well stays shut
  Object.assign(run.ball, { x: s.well.x - 20, y: s.well.y, vx: 0, vy: 0 });
  run.at = 7;
  play(run, 0.5);
  assert(run.phase === 'play' && !run.offer, 'the spent well opened again');
});

test('the pearl can go back over a ridge, and a ridge pays only the first time', () => {
  const run = at(6);
  drop(run);
  const s6 = station(run.world, 6), s5 = station(run.world, 5);
  // a strong pass back over the left ridge
  Object.assign(run.ball, { x: s6.x0 + 40, y: s6.y0 - 120, vx: -700, vy: -200 });
  const before = run.score, streak = run.streak;
  const ev = play(run, 1.2, idle, (r) => r.at === 6);
  assert(run.at === 5 && run.far === 6, `the pearl is in island ${run.at + 1}, furthest ${run.far + 1}`);
  assert(ev.some((e) => e.type === 'back'), 'no back event');
  assert(run.score === before && run.streak === streak, 'going back changed the score or the streak');
  // forward again over the same ridge: no ridge points
  Object.assign(run.ball, { x: s5.x1 - 40, y: s5.y1 - 160, vx: 700, vy: -200 });
  const ev2 = play(run, 1.2, idle, (r) => r.at === 5);
  assert(run.at === 6 && run.far === 6, 'the pearl did not come back to island 7');
  assert(ev2.some((e) => e.type === 'return') && !ev2.some((e) => e.type === 'score' && e.kind === 'ridge'), 'a ridge paid twice');
  // a drain in an island behind the furthest one brings the next pearl back in that island
  run.at = 5; run.saver = 0; run.moonrise = 0; run.bridges = 0;
  Object.assign(run.ball, { x: s5.cx, y: s5.drainY + 5, vx: 0, vy: 100 });
  tick(run, idle());
  assert(run.phase === 'ready' && run.at === 5 && Math.abs(run.ball.x - s5.cx) < s5.Wl, 'the next pearl did not wait in the same island');
});

test('the world keeps 40 islands behind the pearl, then a wall', () => {
  const run = at(70);
  drop(run);
  tick(run, idle());
  const first = run.world.first, wall = station(run.world, first);
  assert(first === 30 && wall.gate, `the first island kept is ${first + 1}`);
  // a pearl flying hard to the left, well above the ridge: only the wall can stop it
  run.at = first;
  Object.assign(run.ball, { x: wall.x0 + 60, y: wall.y0 - 220, vx: -1400, vy: -300 });
  let minX = Infinity;
  play(run, 1.5, idle, (r) => { minX = Math.min(minX, r.ball.x); });
  assert(minX > wall.x0 - R && run.at === first, `the pearl went past the wall (x ${minX | 0}, wall ${wall.x0 | 0})`);
});

test('every flipper follows the keys, even far from the pearl', () => {
  const run = at(10);
  drop(run);
  ensure(run.world, 20);
  const far = station(run.world, 14);
  assert(far.x0 - run.ball.x > 2400, 'island 15 is not far enough away for this check');
  play(run, 0.3, () => ({ ...idle(), left: true, right: true }));
  assert(far.flippers.every((f) => Math.abs(f.th - f.up) < 0.01), 'a far flipper did not go up');
  // the pearl travels on while the keys stay down, then they lift: every flipper drops back
  play(run, 0.4, idle);
  for (const s of run.world.list) assert(s.flippers.every((f) => Math.abs(f.th - f.rest) < 0.01), `a flipper on island ${s.k + 1} stayed up`);
});

test('play is brisk from the start and faster further on', () => {
  const run = at(0);
  assert(pace(run) >= 1.2, `pace ${pace(run)} at the start`);
  run.far = 60;
  assert(pace(run) >= 1.5, `pace ${pace(run)} at island 61`);
  assert(READY_WAIT <= 1.6, 'the next pearl waits too long');
});

test('a big pearl gives a pearl, up to five', () => {
  const run = at(9);
  drop(run);
  const s = station(run.world, 9);
  assert(s.pearl, 'island 10 has no big pearl');
  run.lives = MAX_PEARLS;
  Object.assign(run.ball, { x: s.pearl.x, y: s.pearl.y, vx: 0, vy: 0 });
  tick(run, idle());
  assert(run.lives === MAX_PEARLS && !s.pearl, 'the pearl was not taken, or went over five');
});

test('the next pearl waits in the moonbeam, and three drains end the run', () => {
  const run = at(4);
  let readyAfter = 0;
  for (let i = 0; i < 3; i++) {
    drop(run);
    const s = station(run.world, run.at);
    Object.assign(run.ball, { x: s.cx, y: s.drainY + 5, vx: 0, vy: 100 });
    tick(run, idle());
    if (i < 2) {
      assert(run.phase === 'ready' && run.ball.mode === 'held', 'the next pearl does not wait');
      const t0 = run.clock;
      play(run, 4, idle, (r) => r.phase === 'ready');
      readyAfter = run.clock - t0;
      assert(run.phase === 'play', 'the pearl did not drop by itself');
    }
  }
  assert(readyAfter > READY_WAIT - 0.2 && readyAfter < READY_WAIT + 0.3, `the pearl dropped after ${readyAfter.toFixed(2)} s`);
  assert(run.phase === 'over' && run.lives === 0, 'three drains did not end the run');
});

test('the same seed and the same play give the same run', () => {
  const go = () => {
    const run = createRun({ seed: 2024 });
    const bot = createBot({ skill: 0.8, seed: 9 });
    play(run, 60, () => botInput(run, bot), (r) => { if (r.phase === 'charm') choose(r, 0); });
    return [run.score, run.at, run.lives, run.ball.x.toFixed(3)].join();
  };
  assert(go() === go(), 'two runs differ');
});

test('a long run stays sound: hundreds of islands, no bad numbers', () => {
  const run = createRun({ seed: 31337 });
  const bot = createBot({ skill: 0.97, seed: 4 });
  play(run, 900, () => botInput(run, bot), (r) => {
    if (r.phase === 'charm') choose(r, 0);
    r.lives = 3;
    if (!Number.isFinite(r.ball.x + r.ball.y + r.score)) throw new Error('a bad number at island ' + (r.at + 1));
    if (r.world.list.length > KEEP + (r.far - r.at) + 10) throw new Error('the world keeps too many islands');
  });
  assert(run.far > 150, `the run reached only island ${run.far + 1} in 15 minutes`);
});

report();
