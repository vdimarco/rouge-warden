// Light Years Home v3: the HUD's rules, from ui/hud.js's pure model (final.md 13.4 to 13.6): the speed bars, hints
// (one at a time for 3 s, at most four in the first minute, the steer hint 0.5 s after PLAY), toasts within 26
// characters, the action chip's priority, the karaoke caption, the split's sign; and the overlay's callout rules.
// node qa/light-years-home/v3/hud.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  speedBars, fmtTime, fmtDelta, fmtLy, betaText, fitToast, TOAST_MAX, HINTS, CHIP, createHudState, hudStep, chipFor,
  queueHint, HINT_S, HINTS_FIRST_MIN,
} from '../../../public/light-years-home/ui/hud.js';
import { createCallouts, calloutOf, CALLOUT_HOLD, chevronAt, radarXY, projectPoint } from
  '../../../public/light-years-home/ui/overlay.js';
import { realNines, playText } from '../../../public/light-years-home/ui/menu.js';
import { createGame, setMode } from '../../../public/light-years-home/core/game.js';
import { layoutFor } from '../../../public/light-years-home/core/layout.js';
import { TUNE } from '../../../public/light-years-home/core/tune.js';
import WALL from '../../../public/light-years-home/core/world/zones/wall.js';

const S = TUNE.SHIP;
const portrait = layoutFor({ w: 390, h: 844, safe: { t: 47, b: 34 } });
const landscape = layoutFor({ w: 844, h: 390, safe: { l: 47, r: 47, b: 21 } });

function rig(layout = portrait, source = 'touch') {
  const game = createGame({ zoneData: WALL, mode: 'title' });
  const st = createHudState();
  const view = (over = {}) => ({ game, zone: WALL, layout, events: [], source, dt: 1 / 60, ...over });
  const run = (seconds, over = {}) => {
    let m = null;
    for (let t = 0; t < seconds - 1e-9; t += 1 / 60) m = hudStep(st, view(over));
    return m;
  };
  return { game, st, view, run };
}

test('speed bars: three at cruise, four at top, five on boost', () => {
  assert.equal(speedBars(S.S_CRUISE), 3);
  assert.equal(speedBars(S.S_TOP), 4);
  assert.equal(speedBars(S.S_BOOST), 5);
  assert.equal(speedBars(S.S_TOP, true), 5, 'boosting lights all five');
  assert.equal(speedBars(0), 0);
});

test('formats: race clock, signed splits, distances, β', () => {
  assert.equal(fmtTime(9.876), '9.88');
  assert.equal(fmtTime(62.34), '1:02.3');
  assert.equal(fmtDelta(-0.42), '−0.42', 'ahead carries a minus');
  assert.equal(fmtDelta(0.5), '+0.50', 'behind carries a plus');
  assert.equal(fmtLy(1.067e9), '1.07 GLY');
  assert.equal(fmtLy(7.37e8), '737 MLY');
  assert.equal(fmtLy(2.5e6), '2.5 MLY');
  assert.equal(betaText(2.65).nines, 2);
  assert.match(betaText(2.65).text, /^0\.99\d+c$/);
});

test('toasts never pass 26 characters', () => {
  assert.equal(fitToast('A VERY LONG EVENT TITLE · GOLD · 12.34', 'GOLD · 12.34'), 'GOLD · 12.34');
  assert.ok(fitToast('X'.repeat(40)).length <= TOAST_MAX);
  const { game, st, view } = rig();
  setMode(game, 'drive');
  const events = [
    { type: 'finish', id: 'first-light', medal: 'gold', time: 10.62 },
    { type: 'stuntResult', id: 'sloan-pads', stars: 2 }, { type: 'split', delta: -0.42 },
    { type: 'fail', reason: 'time' }, { type: 'missionDone', title: 'WHICH WAY HOME', medal: 'silver' },
    { type: 'jumpMedal', medal: 'silver', eta: 2.8 }, { type: 'exitOpen', to: 'coma' }, { type: 'rumour' },
    { type: 'setItem', set: 'ghosts', n: 3, of: 8 }, { type: 'lookHome' },
  ];
  const seen = [];
  for (const e of events) {
    let m = hudStep(st, view({ events: [e] }));
    for (let i = 0; i < 400 && m.toast; i++) {
      if (!seen.includes(m.toast.text)) seen.push(m.toast.text);
      m = hudStep(st, view({ dt: 0.05 }));
    }
  }
  assert.ok(seen.length >= 9, `toasts: ${seen.join(' | ')}`);
  for (const t of seen) assert.ok(t.length <= TOAST_MAX, t);
  assert.ok(seen.includes('FIRST LIGHT · GOLD · 10.62'));
  assert.ok(seen.includes('SPLIT −0.42'));
});

test('hints: the steer hint 0.5 s after PLAY, per scheme, 3 s each, one at a time', () => {
  for (const [source, text] of [['touch', HINTS.steer.touch], ['keys', HINTS.steer.keys], ['pad', HINTS.steer.pad]]) {
    const { game, run } = rig(portrait, source);
    run(1);
    setMode(game, 'drive');
    let m = run(0.4);
    assert.equal(m.hint, null, 'not before 0.5 s');
    m = run(0.2);
    assert.equal(m.hint?.text, text);
    m = run(HINT_S - 0.3);
    assert.equal(m.hint?.text, text, 'still up');
    m = run(0.4);
    assert.equal(m.hint, null, 'gone after 3 s');
  }
});

test('hints: at most four in the first minute, each once a session', () => {
  const { game, st, run } = rig();
  setMode(game, 'drive');
  run(0.6);
  for (const k of ['drift', 'release', 'boost', 'scan', 'start', 'tunnel']) queueHint(st, k, 60);
  let shown = 0, last = null;
  for (let t = 0; t < 50; t += 0.5) {
    const m = run(0.5);
    if (m.hint && m.hint.key !== last) { shown++; last = m.hint.key; }
  }
  assert.equal(shown, HINTS_FIRST_MIN, 'steer plus three more in the first minute');
  for (let t = 0; t < 30; t += 0.5) {
    const m = run(0.5);
    if (m.hint && m.hint.key !== last) { shown++; last = m.hint.key; }
  }
  assert.ok(shown > HINTS_FIRST_MIN, 'the rest wait for the second minute');
  queueHint(st, 'steer', 60);
  assert.ok(!st.hintWait.some((h) => h.key === 'steer'), 'once a session');
});

test('hints: the drift hint near the Bend Giant; landscape hints wait while the info box shows', () => {
  const { game, st, run } = rig(landscape);
  setMode(game, 'drive');
  run(4);                                                  // the steer hint has come and gone
  game.ship.pos = [-48, -270, 0];                          // 48 u from the Bend Giant
  game.zone.scaleCardUntil = game.t + 100;
  let m = run(1);
  assert.equal(m.hint, null, 'the info box holds the shared slot');
  assert.ok(m.info, 'the scale card shows');
  game.zone.scaleCardUntil = 0;
  m = run(0.2);
  assert.equal(m.hint?.key, 'drift');
  assert.ok(st.hintShown.drift);
});

test('chip: SKIP, then the event, then TAKE JOB, LET GO, JUMP, ZOOM OUT', () => {
  const { game, st, view } = rig();
  setMode(game, 'drive');
  game.zone.exitOpen = true;
  game.pocketId = 'virgo-jet';
  assert.equal(chipFor(st, view())?.id, 'jump');
  game.ship.tow = { actor: 'pelican', len: 6 };
  assert.equal(chipFor(st, view())?.id, 'letgo');
  assert.equal(chipFor(st, view())?.hold, 1);
  game.zone.offer = { mission: 'first-shout', until: game.t + 5 };
  assert.equal(chipFor(st, view())?.id, 'take');
  game.race = { id: 'first-light', state: 'running', t: 3, gate: 1 };
  const r = chipFor(st, view());
  assert.equal(r.id, 'restart');
  assert.equal(r.hold, TUNE.RACE.RESTART_HOLD);
  game.mission = { id: 'which-way-home', beat: 0, skipOffered: true };
  assert.equal(chipFor(st, view())?.label, CHIP.skip);
  assert.equal(chipFor(st, view({ chip: null })), null, "the core's action slot wins");
  game.zone.exitOpen = false; game.pocketId = null; game.ship.tow = null; game.zone.offer = null; game.race = null;
  game.mission = null;
  assert.equal(chipFor(st, view()), null, 'nothing applies: no chip');
  for (const label of Object.values(CHIP)) assert.ok(label.length <= 18, label);
});

test('caption: bold uppercase chunks, the current word marked, a speaker tag', () => {
  const { game, run } = rig();
  setMode(game, 'drive');
  const line = { id: 'dot.awake', speaker: 'DOT', text: "You're awake. Keep driving. It helps.", t: 0.05 };
  let m = run(0.1, { line });
  assert.equal(m.caption.speaker, 'DOT');
  assert.equal(m.caption.words[0].text, "YOU'RE");
  assert.equal(m.caption.words.filter((w) => w.now).length, 1);
  assert.ok(m.caption.words[0].now);
  m = run(0.1, { line: { ...line, t: 1.5 } });
  assert.notEqual(m.caption.chunk, 0, 'later chunks follow');
  m = run(0.1, { line: null });
  assert.equal(m.caption, null);
});

test('the race clock, gate count and next medal in the top row; β at light speed', () => {
  const { game, run } = rig();
  setMode(game, 'drive');
  game.race = { id: 'first-light', state: 'running', t: 7.42, gate: 2 };
  game.progress.events['first-light'] = { medal: 'silver' };
  let m = run(0.1);
  assert.equal(m.top.text, '7.42');
  const gold = WALL.events.find((e) => e.id === 'first-light').gold;
  assert.equal(m.top.sub, `GATE 2/5 · GOLD ${gold.toFixed(1)}`);
  game.race = null;
  setMode(game, 'runup'); setMode(game, 'punch'); setMode(game, 'tunnel');
  game.jump = { to: 'coma', eta: 2.7 };
  m = run(0.1);
  assert.match(m.speed.beta, /c$/);
  assert.equal(m.radar, false, 'no radar in the tunnel');
  assert.equal(m.top.text, '→ COMA');
});

test('callouts: a lower one never replaces a higher one in its first 0.6 s; repeats count up', () => {
  const c = createCallouts();
  c.push({ type: 'thread' }, 0);
  assert.equal(c.push({ type: 'near' }, 0.3), false);
  assert.equal(c.current(0.3).text, 'THREAD');
  assert.equal(c.push({ type: 'near' }, CALLOUT_HOLD + 0.05), true);
  c.push({ type: 'near' }, 0.8);
  assert.equal(c.current(0.8).n, 2);
  assert.equal(c.push({ type: 'nine', n: 3 }, 0.85), true);
  assert.equal(c.current(0.9).text, 'THREE NINES');
  assert.equal(calloutOf({ type: 'driftTier', tier: 3 }).text, 'BLUE DRIFT');
  assert.equal(calloutOf({ type: 'gate', kind: 'pass' }), null, 'a plain pass is quiet');
  assert.equal(calloutOf({ type: 'spark' }), null);
});

test('overlay maths: projection, edge chevrons and the radar', () => {
  // A camera at the origin looking down −z with a 90° vertical field on a 400 × 400 screen.
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const n = 0.1, f = 1000;
  const P = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0];
  const cam = { view: I, proj: P, w: 400, h: 400 };
  const p = projectPoint(cam, [0, 0, -10]);
  assert.ok(p.front && Math.abs(p.x - 200) < 1e-6 && Math.abs(p.y - 200) < 1e-6);
  const q = projectPoint(cam, [10, 0, -10]);
  assert.ok(Math.abs(q.x - 400) < 1e-6, 'right edge at 45°');
  const behind = projectPoint(cam, [1, 0, 10]);
  assert.equal(behind.front, false);
  const box = { x: 0, y: 0, w: 400, h: 400 };
  const c = chevronAt({ front: false, behind: true, vx: 1, vy: 0 }, box);
  assert.equal(c.edge, 'right');
  assert.equal(chevronAt(p, box), null, 'on screen: no chevron');
  // Radar: heading up. Travelling east (90°), a point to the east sits straight up.
  const xy = radarXY(100, 0, Math.PI / 2, 0.5);
  assert.ok(Math.abs(xy[0]) < 1e-9 && Math.abs(xy[1] + 50) < 1e-9);
});

test('end card: your speed, for real', () => {
  assert.equal(realNines(1.0645e9, 41 * 60), 26);
  assert.equal(playText(41 * 60 + 30), '0 H 41 MIN');
});

// ---------------------------------------------------------------- Round 1 playtest fixes

test('hints teach the moment: LET GO TO BOOST at the first drift tier, at once; done hints go; a job clears the queue', async () => {
  const { stuntValue } = await import('../../../public/light-years-home/ui/hud.js');
  const { game, st, run } = rig(portrait, 'touch');
  setMode(game, 'drive');
  run(4);                                                  // the steer hint has come and gone
  game.ship.pos = [-48, -270, 0];
  let m = run(0.2);
  assert.equal(m.hint?.key, 'drift');
  // The first tier: the release hint replaces the drift hint on the same frame.
  m = run(1 / 60, { events: [{ type: 'driftStart' }, { type: 'driftTier', tier: 1 }] });
  assert.equal(m.hint?.key, 'release');
  // Letting go is the release hint's action: it goes at once.
  m = run(1 / 60, { events: [{ type: 'driftBoost', tier: 1 }] });
  assert.equal(m.hint, null);
  assert.ok(st.hintShown.release);
  // DRIVE THROUGH TO START queued by a start ring, then a job starts: it never shows.
  m = run(4);
  run(1 / 60, { events: [{ type: 'eventArm', id: 'first-light' }] });
  run(1 / 60, { events: [{ type: 'missionStart', id: 'which-way-home' }] });
  let start = false;
  for (let i = 0; i < 10; i++) { m = run(0.5); if (m.hint?.key === 'start') start = true; }
  assert.ok(!start, 'no DRIVE THROUGH TO START in a chase');
  // Stunt values read by kind.
  const ev = (id) => WALL.events.find((e) => e.id === id);
  assert.deepEqual(stuntValue(ev('sloan-bend'), { value: 1 }), { now: 'TIER 1', goal: '★★ AT TIER 2' });
  assert.deepEqual(stuntValue(ev('void-run'), { value: 41.4 }), { now: '41 U/S', goal: '★★ AT 44 U/S' });
  assert.deepEqual(stuntValue(ev('outbound'), { value: 0 }), { now: 'NEARS 0', goal: '★ AT 5 NEARS' });
  assert.deepEqual(stuntValue(ev('sloan-pads'), { value: 0, next: 2 }), { now: 'PADS 2/4', goal: '' });
});

test('a white wash holds toasts and cards, outlines the words, and GAS leaves the screen at light speed', () => {
  const { game, run } = rig(portrait, 'touch');
  setMode(game, 'drive');
  run(1);
  let m = run(1 / 60, { events: [{ type: 'exitOpen', to: 'coma' }, { type: 'earthCard', id: 'seaweed' }], wash: 0.8 });
  assert.equal(m.toast, null, 'the toast waits under the wash');
  assert.equal(m.info, null, 'the card waits too');
  assert.ok(m.washed, 'the words get a dark outline');
  m = run(0.4, { wash: 0.5 });
  assert.equal(m.toast, null);
  m = run(1 / 60, { wash: 0.1 });
  assert.ok(m.toast?.text.startsWith('EXIT OPEN'), 'it shows when the wash is gone');
  assert.ok(m.info, 'and the card, for its full time');
  m = run(2.5, { wash: 0 });
  assert.ok(m.info, 'still up 2.5 s later');
  assert.equal(m.gasPedal, true);
  game.mode = 'tunnel';
  m = run(1 / 60);
  assert.equal(m.gasPedal, false, 'no GAS pedal in the corridor');
});

test('a chase on auto-cruise: HOLD GAS TO CATCH IT after 4 s within 60 u, even in the first minute', () => {
  const { game, run } = rig(portrait, 'touch');
  setMode(game, 'drive');
  game.mission = { id: 'which-way-home', beat: 0, state: 'running' };
  game.actors = [{ id: 'chart-thief', kind: 'runner', pos: [0, -370, 0], state: 'idle' }];
  game.ship.pos = [0, -400, 0];
  game.ship.bar = 0.5;
  let m = run(3.5, { input: { gas: false } });
  assert.notEqual(m.hint?.key, 'catch');
  m = run(1, { input: { gas: false } });
  assert.equal(m.hint?.key, 'catch');
  assert.equal(m.hint.text, HINTS.catch.touch);
});
