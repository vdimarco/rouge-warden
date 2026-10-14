// Light Years Home v3: saves (final.md 18.1, 15). Storage may be missing or throw, junk reads as nothing, unknown ids
// are dropped on read, at most 48 ghosts are kept (least recently raced go first), the boot breadcrumb, Continue
// positions (the entry, before an open exit gate, out of a pocket), and a played save round-trips into a new game.
// node qa/light-years-home/v3/save.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, readSave, writeSave, cleanSave, saveOf, progressOf, continueOf, makeRegistry, readSettings,
  writeSettings, DEFAULT_SETTINGS, readGhost, writeGhost, pruneGhosts, touchGhost, breadcrumb, clearSave, addRun,
  readRuns, GHOST_KEEP } from '../../../public/light-years-home/core/save.js';
import { createGame } from '../../../public/light-years-home/core/game.js';
import { MISSIONS } from '../../../public/light-years-home/core/world/missions/ch1.js';
import { JUMPS } from '../../../public/light-years-home/core/world/jumps.js';
import { BOTS } from '../../../public/light-years-home/core/bots.js';
import { scanState } from '../../../public/light-years-home/core/zone.js';
import { wireAll, newGame, run, memoryStorage, WALL, COMA } from './activities.mjs';

wireAll();
const REG = makeRegistry({ zones: [WALL, COMA], missions: MISSIONS, jumps: JUMPS });
const throwing = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() { throw new Error('no'); } };

test('junk, missing storage and throwing storage read as nothing; writes never throw', () => {
  assert.equal(readSave(null), null);
  assert.equal(readSave(undefined), null);
  assert.equal(readSave(throwing), null);
  assert.equal(writeSave(throwing, { v: 1 }), false);
  assert.equal(writeSave(null, { v: 1 }), false);
  const s = memoryStorage();
  for (const junk of ['{', '[]', '"x"', '42', 'null', JSON.stringify({ v: 2 }), JSON.stringify({ v: '1' })]) {
    s.setItem(KEYS.save, junk);
    assert.equal(readSave(s), null, junk);
  }
  assert.deepEqual(readSettings(throwing), DEFAULT_SETTINGS);
  s.setItem(KEYS.settings, JSON.stringify({ scheme: 'jetpack', hand: 'left', autoDrift: 'yes', quality: 'low' }));
  assert.deepEqual(readSettings(s), { ...DEFAULT_SETTINGS, hand: 'left', quality: 'low' });
  assert.equal(writeSettings(s, { assists: 'pilot', bogus: 1 }), true);
  assert.equal(readSettings(s).assists, 'pilot');
  assert.equal(JSON.parse(s.getItem(KEYS.settings)).bogus, undefined);
  assert.equal(readGhost(throwing, 'first-light'), null);
  assert.equal(writeGhost(throwing, 'first-light', new Uint8Array(4)), false);
  assert.equal(breadcrumb.check(throwing), null);
  clearSave(throwing);
});

test('unknown ids are dropped on read, and bad values are cleaned', () => {
  const s = memoryStorage();
  s.setItem(KEYS.save, JSON.stringify({
    v: 1, chapter: 9, zoneId: 'atlantis',
    zones: { wall: { visited: true, exitOpen: true, sparks: 'AQ==', scans: ['node0', 'nope'], sets: {} }, mars: {} },
    missions: { 'which-way-home': { done: true, medal: 'platinum', best: -3 }, 'shiny-things': { done: true } },
    events: { 'first-light': { best: 12.3, medal: 'silver', splits: [4, 'x', 8] }, 'nope-race': { best: 1 } },
    stunts: { 'void-run': { stars: 7 } },
    jumps: { J1: { medal: 'gold', peakEta: 3.9 }, J9: {} },
    scans: ['node0', 'far-coma', '<script>'], postcards: ['oxygen', 5], flags: { velaMet: true, x: 'y' },
    stats: { playT: 61, near: -2 }, chapterDone: 'no',
  }));
  const save = readSave(s, REG);
  assert.equal(save.zoneId, null);
  assert.equal(save.chapter, 1);
  assert.deepEqual(Object.keys(save.zones), ['wall']);
  assert.deepEqual(save.zones.wall.scans, ['node0']);
  assert.deepEqual(Object.keys(save.missions), ['which-way-home']);
  assert.equal(save.missions['which-way-home'].medal, null);
  assert.equal(save.missions['which-way-home'].best, null);
  assert.deepEqual(Object.keys(save.events), ['first-light']);
  assert.deepEqual(save.events['first-light'].splits, [4, 8]);
  assert.deepEqual(Object.keys(save.stunts), ['void-run']);
  assert.equal(save.stunts['void-run'].stars, 0);
  assert.deepEqual(Object.keys(save.jumps), ['J1']);
  assert.deepEqual(save.scans, ['node0', 'far-coma']);
  assert.deepEqual(save.postcards, ['oxygen']);
  assert.deepEqual(save.flags, { velaMet: true });
  assert.equal(save.stats.near, 0);
  assert.equal(save.chapterDone, false);
  assert.ok(cleanSave(save, REG), 'a clean save cleans to itself');
  assert.deepEqual(cleanSave(save, REG), save);
});

test('the ghost limit: at most 48, the least recently raced dropped first', () => {
  const s = memoryStorage();
  for (let i = 0; i < GHOST_KEEP + 2; i++) assert.equal(writeGhost(s, `ev-${i}`, Uint8Array.of(i, 1, 2)), true);
  assert.equal(readGhost(s, 'ev-0'), null);
  assert.equal(readGhost(s, 'ev-1'), null);
  assert.deepEqual(readGhost(s, 'ev-2'), Uint8Array.of(2, 1, 2));
  assert.deepEqual(readGhost(s, `ev-${GHOST_KEEP + 1}`), Uint8Array.of(GHOST_KEEP + 1, 1, 2));
  // Racing an old one again keeps it; the next write drops the oldest other.
  touchGhost(s, 'ev-2');
  writeGhost(s, 'ev-new', Uint8Array.of(9));
  assert.ok(readGhost(s, 'ev-2'), 'just raced, kept');
  assert.equal(readGhost(s, 'ev-3'), null, 'the least recently raced went');
  assert.deepEqual(pruneGhosts(s, GHOST_KEEP), []);
  let n = 0;
  for (const k of s.map.keys()) if (k.startsWith(KEYS.ghost)) n++;
  assert.equal(n, GHOST_KEEP);
  clearSave(s);
  assert.equal(s.map.size, 0);
});

test('the boot breadcrumb', () => {
  const session = memoryStorage();
  assert.equal(breadcrumb.check(session), null);
  breadcrumb.set(session, 'mid', 12);
  assert.equal(breadcrumb.check(session), 'mid');
  breadcrumb.clear(session);
  assert.equal(breadcrumb.check(session), null);
  session.setItem(KEYS.boot, '{"tier":"ultra"}');
  assert.equal(breadcrumb.check(session), null);
  // The run log keeps the last 20.
  const s = memoryStorage();
  for (let i = 0; i < 25; i++) addRun(s, { i });
  const runs = readRuns(s);
  assert.equal(runs.length, 20);
  assert.equal(runs[0].i, 5);
});

test('Continue: the entry, before an open exit gate, and out of a pocket', () => {
  const fresh = continueOf({ zones: {} }, WALL);
  assert.deepEqual(fresh.at, WALL.entry.pos);
  assert.equal(fresh.heading, WALL.entry.heading);
  const open = continueOf({ zones: { wall: { exitOpen: true } } }, WALL);
  const ex = WALL.exit.pos;
  const d = Math.hypot(open.at[0] - ex[0], open.at[1] - ex[1]);
  assert.ok(d > 30 && d < 90, `${d} u before the gate`);
  const yaw = (open.heading * Math.PI) / 180;
  const toward = ((ex[0] - open.at[0]) * Math.sin(yaw) + (ex[1] - open.at[1]) * Math.cos(yaw)) / d;
  assert.ok(toward > 0.99, 'facing it');
  // A save made inside a pocket continues at the pocket's way out, in its zone (Virgo's data is Round 2: a stand-in).
  const virgo = { id: 'virgo', entry: { pos: [-640, 60, 50], heading: 110, speed: 42 },
    pocket: { id: 'virgo-jet', ring: { pos: [13, 5, 0] }, back: { pos: [33, 12, 40], dir: [0.94, 0.34, 0] } } };
  const out = continueOf({ zoneId: 'virgo', pocket: 'virgo-jet', zones: { virgo: {} } }, virgo);
  assert.deepEqual(out.at, [33, 12, 40]);
  assert.ok(Math.abs(out.heading - 70.1) < 0.2, `${out.heading}`);
});

test('a played save round-trips: written, read, and into a new game with its scans, sparks and exit', () => {
  const game = newGame({ seed: 2, fresh: true, done: [] });
  const bot = BOTS.story.make({ seed: 2 });
  run(game, (g) => bot.next(g), 180, { until: (g) => g.mode === 'runup' });
  const s = memoryStorage();
  const save = saveOf(game);
  assert.equal(writeSave(s, save), true);
  const back = readSave(s, REG);
  assert.deepEqual(back, cleanSave(save, REG));
  assert.equal(back.missions['which-way-home'].done, true);
  assert.ok(back.zones.wall.exitOpen);
  assert.ok(back.scans.includes('far-coma'));
  assert.ok(back.zones.wall.sparks.length > 0);
  // A new game from it: the zone runtime restores what was found.
  wireAll();
  const at = continueOf(back, WALL);
  const g2 = createGame({ seed: 2, zoneData: WALL, save: progressOf(back), at: at.at, heading: at.heading, speed: at.speed,
    mode: 'drive' });
  assert.equal(g2.zone.exitOpen, true);
  assert.equal(scanState(g2, 'far-coma'), 'scanned');
  const sparks = g2.zone.sparks.reduce((a, b) => a + b, 0);
  assert.equal(sparks, game.zone.sparks.reduce((a, b) => a + b, 0));
  assert.equal(g2.progress.missions['which-way-home'].done, true);
});

test('a mission left half done starts again from beat 1, unless only the open exit gate was left', () => {
  const half = progressOf({ missions: { 'which-way-home': { done: false, beat: 1 } }, zones: { wall: {} } });
  assert.equal(half.missions['which-way-home'].beat, 0);
  const gate = progressOf({ missions: { 'which-way-home': { done: false, beat: 3 } }, zones: { wall: { exitOpen: true } } });
  assert.equal(gate.missions['which-way-home'].done, true);
});
