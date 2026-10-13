// Light Years Home: checks of the saves: junk and a throwing storage read as nothing saved, the best record keeps the
// best of each, progress round-trips, settings fall back to defaults. node qa/light-years-home/save.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  KEYS, RANKS, CHAPTER_STARTS, DEFAULT_SETTINGS, readBest, saveBest, bestLine, readProgress, saveProgress, clearProgress,
  readSettings, saveSettings, readSeen, saveSeen,
} from '../../public/light-years-home/core/save.js';

// The arcade's own junk list (qa/arcade/machines.mjs), read from the file so the two stay the same.
const machines = readFileSync(new URL('../arcade/machines.mjs', import.meta.url), 'utf8');
const JUNK = JSON.parse(/const JUNK = (\[.*?\]);/.exec(machines)[1]);

function memory(init = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}
const throwing = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError'); },
};

const PROGRESS = {
  v: 1, seed: 7, chapter: 2, stop: 6, score: 14200, panes: 2,
  stats: { firstTry: 5, wrong: 1, cracks: 1, retries: 0, topEta: 20.4, legGrades: [512, 480, 600, 455, 700, 390] },
  branch: 'sheet', shown: ['single-cells', 'seaweed', 'asteroid'],
};

test('the junk list is the arcade one', () => {
  assert.ok(JUNK.length >= 10 && JUNK.includes('not json') && JUNK.includes('1e999'));
});

test('every junk value reads as nothing saved, and never throws', () => {
  for (const junk of JUNK) {
    const s = memory(Object.fromEntries(Object.values(KEYS).map((k) => [k, junk])));
    assert.equal(readBest(s), null, `best ${junk}`);
    assert.equal(readProgress(s), null, `progress ${junk}`);
    assert.deepEqual(readSettings(s), DEFAULT_SETTINGS, `settings ${junk}`);
    assert.equal(readSeen(s), junk === 'true', `seen ${junk}`);
    assert.equal(bestLine(readBest(s)), 'No journey home yet');
  }
});

test('a throwing or missing storage reads as nothing and writes do not throw', () => {
  for (const s of [throwing, null, undefined, {}]) {
    assert.equal(readBest(s), null);
    assert.equal(readProgress(s), null);
    assert.deepEqual(readSettings(s), DEFAULT_SETTINGS);
    assert.equal(readSeen(s), false);
    assert.equal(saveProgress(s, PROGRESS), false);
    assert.equal(saveSeen(s), false);
    assert.doesNotThrow(() => clearProgress(s));
    assert.deepEqual(saveSettings(s, { thrust: 'toggle' }), { ...DEFAULT_SETTINGS, thrust: 'toggle' });
    const { best } = saveBest(s, { score: 5000, reached: 3, home: false });
    assert.equal(best.score, 5000);
  }
});

test('best: validated as in the save table', () => {
  const ok = { score: 31250, reached: 15, home: true, shipYears: 4.97, firstTry: 15, rank: 'Navigator', date: '2026-10-13' };
  const s = memory({ [KEYS.best]: JSON.stringify(ok) });
  assert.deepEqual(readBest(s), ok);
  assert.deepEqual(readBest(memory({ [KEYS.best]: '{"score":6800,"reached":3,"home":false}' })),
    { score: 6800, reached: 3, home: false });
  const bad = [
    { score: 100001 }, { score: -1 }, { score: 1.5 }, { score: '5' }, { reached: 16 }, { reached: -1 }, { home: 'yes' },
    { shipYears: 1001 }, { shipYears: -0.1 }, { rank: 'Captain' }, { date: '2026-13-01' }, { date: '13/10/2026' },
    { firstTry: 18 },
  ];
  for (const b of bad) {
    assert.equal(readBest(memory({ [KEYS.best]: JSON.stringify({ ...ok, ...b }) })), null, JSON.stringify(b));
  }
  assert.equal(readBest(memory({ [KEYS.best]: JSON.stringify({ score: 1, reached: 1 }) })), null, 'home is needed');
  assert.deepEqual(RANKS, ['Drifter', 'Wayfinder', 'Navigator', 'Lightkeeper']);
});

test('best: keeps the higher score, the higher stop reached and the lower ship time among home runs', () => {
  const s = memory();
  let r = saveBest(s, { score: 6800, reached: 3, home: false, shipYears: 3.1, firstTry: 2, rank: 'Drifter', date: '2026-10-01' });
  assert.equal(r.newBest, true);
  assert.deepEqual(readBest(s), { score: 6800, reached: 3, home: false, firstTry: 2, rank: 'Drifter', date: '2026-10-01' },
    'a run that did not reach home keeps no ship time');
  r = saveBest(s, { score: 24000, reached: 15, home: true, shipYears: 5.2, firstTry: 9, rank: 'Wayfinder', date: '2026-10-05' });
  assert.equal(r.newBest, true);
  r = saveBest(s, { score: 20000, reached: 15, home: true, shipYears: 4.97, firstTry: 12, rank: 'Wayfinder', date: '2026-10-09' });
  assert.equal(r.newBest, false);
  r = saveBest(s, { score: 9000, reached: 8, home: false, firstTry: 4, rank: 'Drifter', date: '2026-10-10' });
  assert.equal(r.newBest, false);
  assert.deepEqual(readBest(s),
    { score: 24000, reached: 15, home: true, shipYears: 4.97, firstTry: 12, rank: 'Wayfinder', date: '2026-10-05' });
  assert.deepEqual(r.best, readBest(s));
  // a negative or broken score is not saved over a real one
  saveBest(s, { score: NaN, reached: 2, home: false });
  assert.equal(readBest(s).score, 24000);
  // junk in storage is replaced by the new run
  const j = memory({ [KEYS.best]: 'not json' });
  assert.equal(saveBest(j, { score: 100, reached: 1, home: false }).newBest, true);
  assert.equal(readBest(j).score, 100);
});

test('best line for the title', () => {
  const names = ['Coma', 'Virgo', 'Fornax'];
  assert.equal(bestLine({ score: 31250, reached: 15, home: true, shipYears: 4.97 }), 'BEST 31,250 · HOME IN 4.97 YEARS');
  assert.equal(bestLine({ score: 6800, reached: 2, home: false }, names), 'BEST 6,800 · REACHED VIRGO');
  assert.equal(bestLine({ score: 600, reached: 0, home: false }, names), 'BEST 600');
  assert.equal(bestLine(null), 'No journey home yet');
});

test('progress: round-trips; bad chapters, stops and panes read as none; clear removes it', () => {
  const s = memory();
  assert.equal(saveProgress(s, PROGRESS), true);
  assert.deepEqual(readProgress(s), PROGRESS);
  assert.deepEqual(JSON.parse(s.getItem(KEYS.progress)), PROGRESS);
  for (const [chapter, stop] of CHAPTER_STARTS.entries()) {
    const p = { ...PROGRESS, chapter, stop, branch: chapter === 1 ? null : 'void' };
    assert.equal(saveProgress(memory(), p), chapter >= 1, `chapter ${chapter}`);
  }
  const bad = [
    { v: 2 }, { chapter: 0, stop: 0 }, { chapter: 4, stop: 15 }, { chapter: 2, stop: 7 }, { panes: 0 }, { panes: 4 },
    { seed: -1 }, { seed: 1.5 }, { score: Infinity }, { branch: 'left' }, { shown: 'seaweed' }, { shown: [1] },
    { stats: [] }, { stats: { cracks: -1 } }, { stats: { legGrades: [NaN] } },
  ];
  for (const b of bad) {
    const p = { ...PROGRESS, ...b };
    assert.equal(saveProgress(memory(), p), false, JSON.stringify(b));
    assert.equal(readProgress(memory({ [KEYS.progress]: JSON.stringify(p) })), null, JSON.stringify(b));
  }
  // fields the engine adds pass through
  const extra = { ...PROGRESS, draw: { coma: { A: 'leo', B: 'coma', C: 'shapley' } } };
  assert.equal(saveProgress(s, extra), true);
  assert.deepEqual(readProgress(s), extra);
  clearProgress(s);
  assert.equal(readProgress(s), null);
  assert.equal(s.getItem(KEYS.progress), null);
});

test('settings: unknown values fall back, known ones round-trip', () => {
  const s = memory();
  assert.deepEqual(DEFAULT_SETTINGS, { thrust: 'hold', captions: 'normal', hints: true });
  assert.deepEqual(saveSettings(s, { thrust: 'toggle', captions: 'slow', hints: false }), { thrust: 'toggle', captions: 'slow', hints: false });
  assert.deepEqual(readSettings(s), { thrust: 'toggle', captions: 'slow', hints: false });
  s.setItem(KEYS.settings, JSON.stringify({ thrust: 'fly', captions: 'slow', hints: 'no', extra: 1 }));
  assert.deepEqual(readSettings(s), { thrust: 'hold', captions: 'slow', hints: true });
  assert.deepEqual(saveSettings(s, null), DEFAULT_SETTINGS);
});

test('seen: only true counts', () => {
  const s = memory();
  assert.equal(readSeen(s), false);
  assert.equal(saveSeen(s), true);
  assert.equal(s.getItem(KEYS.seen), 'true');
  assert.equal(readSeen(s), true);
  saveSeen(s, false);
  assert.equal(readSeen(s), false);
  assert.deepEqual(KEYS, {
    best: 'light-years-home.best.v1', progress: 'light-years-home.progress.v1',
    settings: 'light-years-home.settings.v1', seen: 'light-years-home.seen.v1',
  });
});
