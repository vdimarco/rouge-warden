// Ahead of the Light: saves (final.md 9.2, 14.1, 21.3): a save at every break restores the same run, a version
// mismatch drops the run and keeps the meta, a run left mid-leg resumes at the leg's start (−2 s for a quit, nothing
// for a page that went away), and blocked storage plays without throwing.
// node qa/ahead-of-the-light/save.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../public/ahead-of-the-light/core/save.js';
import { serialize, restoreSave, migrate, migrateMeta, makeStore, pushLog, KEYS, VERSION, LOG_KEEP }
  from '../../public/ahead-of-the-light/core/save.js';
import { createRun, startLeg, endLeg, pick, skip, chooseLane, suspend, resume, snapshot, restore, breakOf }
  from '../../public/ahead-of-the-light/core/run.js';
import { createMeta, applyRun, runOptions } from '../../public/ahead-of-the-light/core/meta.js';
import { runSummary, runLogText } from '../../public/ahead-of-the-light/core/log.js';
import { stepRace, STEP, NO_INTENT } from '../../public/ahead-of-the-light/core/race.js';
import { driverFor } from '../../public/ahead-of-the-light/core/bots.js';
import { TUNE, SLUG } from '../../public/ahead-of-the-light/core/tune.js';

// see run.test.mjs: every leg ends, and the run reaches Earth
const RUN_TUNE = Object.freeze({ ...TUNE, STUMBLE: 0, BLEED: 0, HULL0: 99, HULL_MAX: 99, HULL_CAP: 99 });
const fly = (run) => {
  const race = startLeg(run, RUN_TUNE);
  const d = driverFor('dodge', { seed: run.leg + 1 });
  while (race.phase !== 'done' && race.real < 240) stepRace(race, { you: d(race, race.ships[0]) || NO_INTENT }, STEP);
  endLeg(run, race);
  return race;
};
const through = (text) => resume(migrate(restoreSave(text)), RUN_TUNE);

test('core/save.js exports its 18.4 API and imports in plain node', () => {
  for (const name of ['serialize', 'restoreSave', 'migrate']) assert.equal(typeof mod[name], 'function', name);
  assert.deepEqual(restoreSave(serialize({ v: 1, a: [1, 2] })), { v: 1, a: [1, 2] });
  assert.equal(restoreSave('not json'), null);
  assert.equal(restoreSave(null), null);
  assert.equal(restoreSave('3'), null, 'a number is not a save');
  assert.deepEqual(KEYS, { meta: `${SLUG}.meta.v1`, run: `${SLUG}.run.v1`, log: `${SLUG}.log.v1`, sound: 'arcade.sound' });
});

test('a save at every break restores a run whose next leg has the same hash', () => {
  const run = createRun({ seed: 'SAVED', tune: RUN_TUNE, meta: { pages: new Array(20).fill('x'), seen: { runs: 4 } } });
  let breaks = 0;
  for (let leg = 0; leg < 8; leg++) {
    fly(run);
    if (run.phase !== 'break') break;
    breaks++;
    const text = serialize(suspend(run, 'break'));
    const back = through(text);
    assert.equal(JSON.stringify(back), JSON.stringify(run), `break ${breaks}: the same run`);
    assert.deepEqual(breakOf(back), breakOf(run), `break ${breaks}: the same break screen`);
    // the same choices from here give the same next leg
    for (const r of [run, back]) { pick(r, r.offer ? r.offer.cards.length - 1 : 0); skip(r); chooseLane(r, 1); }
    assert.equal(JSON.stringify(back), JSON.stringify(run));
    const a = startLeg(run, RUN_TUNE), b = startLeg(back, RUN_TUNE);
    assert.equal(a.leg.hash, b.leg.hash, `leg ${leg + 2}`);
    assert.equal(a.leg.lane.id, b.leg.lane.id);
    run.phase = 'launch';
  }
  assert.equal(breaks, 7);
  assert.equal(run.phase, 'home');
});

test('a run left mid-leg resumes at that leg\'s start: −2 s for a quit, nothing for a page that went away', () => {
  const run = createRun({ seed: 'QUIT', tune: RUN_TUNE });
  fly(run);
  skip(run);
  chooseLane(run, 0);
  const gap = run.you.gap;
  const quit = through(serialize(suspend(run, 'leg')));
  assert.equal(quit.you.gap, gap - TUNE.QUIT_GAP);
  assert.equal(quit.phase, 'launch');
  assert.equal(quit.leg, 1);
  const hidden = through(serialize(suspend(run, 'pagehide')));
  assert.equal(hidden.you.gap, gap, 'pagehide: no penalty (critic lead item 6)');
  assert.equal(startLeg(quit, RUN_TUNE).leg.hash, startLeg(hidden, RUN_TUNE).leg.hash);
  // a leg that launched close: the quit still costs, but never takes the launch TTC under TTC_FLOOR (or under the TTC
  // it had) nor under 3/4 of the gap, so GO ON gives a leg to play, not a catch on the first step
  const ttcOf = (gap, eta) => gap / (1 - Math.tanh(eta));
  for (const [g0, eta] of [[1.5, 1.6], [1.9, 0.8], [1.0, 0.8], [0.4, 1.6], [2.5, 1.0]]) {
    const close = createRun({ seed: 'QUIT', tune: RUN_TUNE });
    fly(close);
    skip(close);
    chooseLane(close, 0);
    Object.assign(close.you, { gap: g0, launchEta: eta });
    const back = resume(suspend(close, 'leg'), TUNE);
    const g = back.you.gap, ttc = ttcOf(g, eta);
    assert.ok(g > 0 && g < g0, `gap ${g0} at η ${eta} resumes at ${g}`);
    assert.ok(g >= g0 * 0.75 - 1e-9 || ttc >= Math.min(ttcOf(g0, eta), TUNE.TTC_FLOOR) - 1e-9, `TTC ${ttc}`);
    assert.ok(g >= g0 - TUNE.QUIT_GAP - 1e-9);
    const race = startLeg(back, TUNE);
    for (let i = 0; i < 120; i++) stepRace(race, { you: NO_INTENT }, STEP);
    assert.ok(!race.ships[0].caught, `gap ${g0} at η ${eta}: caught in the first second after GO ON`);
  }
  // a run at its break saves as a break whatever the caller says
  const at = createRun({ seed: 'QUIT', tune: RUN_TUNE });
  fly(at);
  assert.equal(suspend(at, 'leg').at, 'break');
  assert.equal(through(serialize(suspend(at, 'leg'))).you.gap, at.you.gap);
  // a bare run (main.js stores one at each break) restores too
  assert.equal(JSON.stringify(restore(serialize(snapshot(at)))), JSON.stringify(at));
});

test('a version mismatch drops the run and keeps the meta', () => {
  const run = createRun({ seed: 'OLD' });
  assert.ok(migrate(snapshot(run)));
  assert.equal(migrate({ ...snapshot(run), v: VERSION + 1 }), null);
  assert.equal(migrate({ v: VERSION + 1, at: 'break', run: snapshot(run) }), null);
  assert.equal(migrate({ v: VERSION, at: 'break', run: { ...snapshot(run), v: 0 } }), null);
  assert.equal(migrate({ v: VERSION }), null, 'not a run');
  assert.equal(resume(null), null);
  const old = { v: 0, pages: ['home', 'card:scrape'], ships: ['needle'], runs: 4, seen: { runs: 4 } };
  const m = migrateMeta(old);
  assert.deepEqual(m.pages, ['home', 'card:scrape']);
  assert.deepEqual(m.ships, ['lantern', 'needle']);
  assert.equal(m.v, createMeta().v);
  assert.equal(m.runs, 4);
  assert.deepEqual(migrateMeta('junk'), createMeta());
});

test('blocked storage plays without throwing', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); } };
  for (const backend of [blocked, null, undefined, {}]) {
    const store = makeStore(backend);
    assert.equal(store.get(KEYS.meta), null);
    assert.equal(store.read(KEYS.run), null);
    assert.equal(store.set(KEYS.meta, '{}'), false);
    assert.equal(store.write(KEYS.run, { v: 1 }), false);
    assert.equal(store.del(KEYS.run), false);
    // the game's start-up path with nothing stored: the starter pool and LANTERN
    const meta = migrateMeta(store.read(KEYS.meta));
    const run = createRun({ seed: 'BLOCKED', meta, tune: RUN_TUNE });
    assert.equal(run.ship, 'lantern');
    assert.equal(run.rerolls, TUNE.REROLLS0);
    fly(run);
    store.write(KEYS.run, suspend(run, 'break'));
    const out = applyRun(meta, runSummary(run));
    store.write(KEYS.meta, out.meta);
    store.write(KEYS.log, pushLog(store.read(KEYS.log), runLogText(run)));
    assert.ok(out.meta.pages.length > 0);
  }
  // a working backend round-trips
  const mem = new Map();
  const ok = makeStore({ getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k) });
  const run = createRun({ seed: 'MEM' });
  assert.ok(ok.write(KEYS.run, suspend(run)));
  assert.equal(JSON.stringify(through(ok.get(KEYS.run))), JSON.stringify(run));
  assert.ok(ok.del(KEYS.run));
  assert.equal(ok.read(KEYS.run), null);
  let logs = [];
  for (let i = 0; i < 30; i++) logs = pushLog(logs, `run ${i}`);
  assert.equal(logs.length, LOG_KEEP);
  assert.equal(logs[LOG_KEEP - 1], 'run 29');
  assert.deepEqual(runOptions(null).seen.trophies, []);
});
