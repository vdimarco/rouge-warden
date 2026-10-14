// Lawn Tennis: a seeded rally through the same hook the page puts on window.__test.
// node qa/tennis/rally.test.mjs
import { createMatch, createTest, readOptions, RULES } from '../../public/tennis/game.js';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log('  ok   ' + name);
  } catch (e) {
    results.push({ name, ok: false });
    console.log('  FAIL ' + name + '\n       ' + (e && e.message));
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg}: ${a} vs ${b}`);
}

function playPoint(api, point, onSwing) {
  let guard = 0;
  let peak = 0;
  const blooms = [];
  while (guard < 60 * 40) {
    const s = api.state();
    if (s.point !== point || s.phase === 'match') break;
    if (s.phase === 'award') break;
    if (s.phase === 'rally' && s.window) {
      const before = s.flowerCount.you;
      const frame = s.frame;
      const hit = api.swing('flat', 0);
      if (onSwing) onSwing(before, hit);
      assert(hit.flowerCount.you === before + 1, 'a player return did not add a flower');
      assert(hit.lastBloom && hit.lastBloom.frame === frame && hit.lastBloom.side === 'you', 'bloom frame lagged the hit');
      assert(hit.lastHit && hit.lastHit.frame === frame, 'hit was not on this frame');
      assert(hit.frame === frame, 'swing advanced the frame');
      blooms.push(hit.lastBloom);
    }
    const next = api.step();
    if (next.rally > peak) peak = next.rally;
    const nbBloom = next.events.find((e) => e.type === 'bloom' && e.side === 'neighbour');
    const nbHit = next.events.find((e) => e.type === 'hit' && e.side === 'neighbour');
    if (nbHit) {
      assert(nbBloom && nbBloom.frame === next.frame && nbBloom.frame === nbHit.frame, 'neighbour flower lagged the hit');
    }
    guard += 1;
  }
  return { peak, blooms, state: api.state() };
}

test('rules match the cottage numbers', () => {
  assert(RULES.gravity === 8 && RULES.bounce === 0.75, 'gravity or bounce');
  assert(RULES.serveCasual === 9 && RULES.servePro === 13, 'serve pace');
  assert(RULES.rallyMin === 8 && RULES.rallyMax === 14, 'rally pace');
  assert(RULES.windowIntro === 0.25 && RULES.windowCasual === 0.16 && RULES.windowPro === 0.11, 'windows');
  assert(RULES.errorCasual === 0.3 && RULES.errorPro === 0.12, 'error');
  assert(RULES.pointsToWin === 7 && RULES.winBy === 2, 'match');
  const opts = readOptions('?seed=42&ai=pro&fast=1');
  assert(opts.seed === 42 && opts.ai === 'pro' && opts.fast === true, 'query');
});

test('the opening is a slow lob and the first window is 250 ms', () => {
  const api = createTest(createMatch({ seed: 1 }));
  const start = api.state();
  assert(start.point === 1 && start.scriptedMiss === true, 'point 1 should be scripted');
  assert(start.ball.z > 1 && start.ball.vy > 0, 'the ball should already be coming toward you');
  assert(start.glow === true, 'the racket should glow at the start');
  let opened = null;
  for (let i = 0; i < 60 * 8 && !opened; i++) {
    const s = api.state();
    if (s.window) opened = s;
    else api.step();
  }
  assert(opened, 'the hit window never opened');
  near(opened.hitWindow, 0.25, 1e-9, 'first window');
  assert(opened.time > 2 && opened.time < 5, `first window at ${opened.time.toFixed(2)}s`);
  assert(opened.glow === false, 'the glow should be over before the hit');
});

test('point 1 misses only on the fourth arrival, and each return blooms immediately', () => {
  for (const seed of [1, 2, 99]) {
    const api = createTest(createMatch({ seed, ai: 'casual' }));
    const windows = [];
    const played = playPoint(api, 1, (before, hit) => {
      windows.push(hit.yourHits);
    });
    const done = played.state;
    assert(done.phase === 'award' || done.score.you === 1, `seed ${seed} did not award the point`);
    assert(done.score.you === 1 && done.score.neighbour === 0, `seed ${seed} score ${done.score.you}-${done.score.neighbour}`);
    assert(done.neighbourReturns === 3, `seed ${seed} neighbour returns ${done.neighbourReturns}`);
    assert(done.aiChances === 4, `seed ${seed} chances ${done.aiChances}`);
    assert(done.lastMiss && done.lastMiss.scripted === true && done.lastMiss.point === 1, 'miss was not the scripted one');
    assert(played.blooms.length === 4, `player blooms ${played.blooms.length}`);
    assert(windows.length === 4, 'expected 4 player windows');
    api.advance(0.35);
    const swept = api.state();
    assert(swept.flowerCount.neighbour === 0, 'lost flowers should leave the neighbour bed');
    assert(swept.flowerCount.you === 7, `your bed should hold both patches, has ${swept.flowerCount.you}`);
  }
});

test('after three returns the casual window shrinks to 160 ms', () => {
  const api = createTest(createMatch({ seed: 4 }));
  let fourth = null;
  let guard = 0;
  while (guard < 60 * 30 && !fourth) {
    const s = api.state();
    if (s.phase === 'award') break;
    if (s.window) {
      if (s.yourHits >= 3) fourth = s;
      else api.swing('flat', 0);
    }
    api.step();
    guard += 1;
  }
  assert(fourth, 'never reached the fourth player window');
  near(fourth.hitWindow, 0.16, 1e-9, 'casual window');
});

test('point 2 is not scripted and a casual rally can pass 6 hits', () => {
  let found = null;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const api = createTest(createMatch({ seed, ai: 'casual' }));
    playPoint(api, 1);
    api.advance(3.1);
    const live = api.state();
    assert(live.point === 2 && live.scriptedMiss === false, 'point 2 should play normally');
    assert(live.aimHint === true, 'the second serve should show the early and late ring');
    near(live.lastServePace, RULES.serveCasual, 0.05, 'casual serve pace');
    const second = playPoint(api, 2);
    if (second.peak >= 6) found = { seed, rally: second.peak };
  }
  assert(found, 'no casual seed reached 6 hits on point 2');
  console.log(`       rally ${found.rally} on seed ${found.seed}`);
});

test('the same seed repeats, and a pro serve is faster', () => {
  function sample(seed, ai) {
    const api = createTest(createMatch({ seed, ai }));
    const balls = [];
    playPoint(api, 1);
    api.advance(3.1);
    for (let i = 0; i < 90; i++) {
      if (i % 15 === 0) balls.push(api.ballPos());
      const s = api.state();
      if (s.point === 2 && s.window) api.swing('flat', 0);
      api.step();
    }
    return balls;
  }
  const a = sample(7, 'casual');
  const b = sample(7, 'casual');
  assert(JSON.stringify(a) === JSON.stringify(b), 'same seed diverged');
  const c = sample(8, 'casual');
  assert(JSON.stringify(a) !== JSON.stringify(c), 'different seeds matched');
  const pro = createTest(createMatch({ seed: 3, ai: 'pro' }));
  playPoint(pro, 1);
  pro.advance(3.1);
  near(pro.state().lastServePace, RULES.servePro, 0.05, 'pro serve pace');
});

test('first to 7, win by 2', () => {
  const api = createTest(createMatch({ seed: 5 }));
  for (let i = 0; i < 6; i++) {
    api.forcePoint('you');
    api.advance(3.1);
    api.forcePoint('neighbour');
    api.advance(3.1);
  }
  api.forcePoint('you');
  api.advance(3.1);
  let s = api.state();
  assert(s.score.you === 7 && s.score.neighbour === 6, `score ${s.score.you}-${s.score.neighbour}`);
  assert(s.phase !== 'match', '7 to 6 should keep playing');
  api.forcePoint('you');
  api.advance(3.1);
  s = api.state();
  assert(s.phase === 'match' && s.winner === 'you', '8 to 6 should end');
});

test('a swing outside the window does not grow a flower', () => {
  const api = createTest(createMatch({ seed: 1 }));
  const hit = api.swing('flat', 0);
  assert(hit.events.some((e) => e.type === 'whiff'), 'expected a whiff');
  assert(hit.flowerCount.you === 0 && hit.rally === 0, 'a whiff changed the rally');
});

test('point 2 flat returns stay inside the rally pace', () => {
  const api = createTest(createMatch({ seed: 6 }));
  playPoint(api, 1);
  api.advance(3.1);
  let pace = null;
  for (let i = 0; i < 60 * 8 && pace == null; i++) {
    const s = api.state();
    if (s.point === 2 && s.window) {
      const hit = api.swing('flat', 1);
      pace = hit.lastHit.pace;
    } else api.step();
  }
  assert(pace != null, 'no hit');
  assert(pace >= RULES.rallyMin - 0.05 && pace <= RULES.rallyMax + 0.05, `pace ${pace}`);
});

const bad = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - bad} passed, ${bad} failed`);
process.exitCode = bad ? 1 : 0;
