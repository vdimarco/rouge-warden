import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { createShoreTelemetry } from '../../public/tidebreak/telemetry.js';

const events = [];
let now = 0, nextId = 0;
const savedWidth = globalThis.innerWidth, savedHeight = globalThis.innerHeight;
globalThis.innerWidth = 390; globalThis.innerHeight = 844;
const telemetry = createShoreTelemetry({ capture: (event, properties) => events.push({ event, properties }),
  makeId: () => `match-${++nextId}`, now: () => now, context: () => ({ build_sha: 'test-build' }) });
const p = { id: 1, hero: 2, selectedTarget: 0, recall: 0, deaths: 0, kills: 0, lastHits: 0, hp: 100, level: 1 };
const tower = { id: 3, kind: 'tower', team: 1, lane: 0, tier: 0, hp: 100 };
const s = { playerId: 1, time: 0, phase: 0, winner: null, objective: null,
  units: [p, { id: 2, kind: 'hero', team: 1, hero: 5, hp: 100 }, tower],
  difficulty: ['ally', 'mythic'], stats: { damage: 0, towers: 0, leviathans: 0 } };
const count = event => events.filter(e => e.event === event).length;
telemetry.load('started'); telemetry.load('ready', { elapsed_ms: 204 }); telemetry.load('ready');
assert.equal(count('shore_load_ready'), 1);
assert.equal(events[0].properties.match_id, undefined, 'load events do not claim a match has begun');
const firstId = telemetry.start(s, { hero: 'baba', difficulty: 'apprentice', input_type: 'touch' });
for (let i = 0; i < 600; i++) { s.time += 1 / 60; telemetry.observe(s); }
assert.equal(events.length, 3, 'idle and held movement frames produce no gameplay events');
assert.equal(events.at(-1).properties.difficulty, 'mythic', 'the match difficulty wins over a stale menu value');
assert.equal(events.at(-1).properties.hero, 'baba');
assert.equal(events.at(-1).properties.hero_id, 2);
assert.equal(events.at(-1).properties.input_type, 'touch');
assert.equal(events.at(-1).properties.viewport_width, 390);
assert.equal(events.at(-1).properties.viewport_height, 844);
assert.equal(events.at(-1).properties.orientation, 'portrait');

p.selectedTarget = 2; telemetry.observe(s); telemetry.observe(s);
p.target = 3; telemetry.observe(s);
assert.equal(count('shore_target_changed'), 1, 'automatic attack target changes do not count as manual selections');
assert.equal(events.at(-1).properties.target_hero, 5);
p.selectedTarget = 0; telemetry.observe(s);
assert.equal(events.at(-1).properties.outcome, 'cleared');
assert.equal(events.at(-1).properties.target_id, null);

p.recall = 2.5; telemetry.observe(s);
p.recall = 1.8; telemetry.observe(s);
p.recall = 0; telemetry.observe(s);
p.recall = 2.5; telemetry.observe(s);
s.time += 2.5; p.recallCompletedAt = s.time; p.recall = 0; telemetry.observe(s);
p.recall = 2.5; telemetry.observe(s); p.recall = 0; telemetry.observe(s);
assert.deepEqual(events.filter(e => e.event === 'shore_recall').map(e => e.properties.outcome),
  ['started', 'interrupted', 'started', 'completed', 'started', 'interrupted'], 'old completion markers cannot label a later interruption as completion');

telemetry.action('cast', { slot: 1, outcome: 'accepted', attempt_id: 'a' });
telemetry.action('cast', { slot: 1, outcome: 'rejected', reason: 'cooldown', attempt_id: 'a' });
telemetry.action('cast', { slot: 1, outcome: 'accepted', attempt_id: 'a' });
assert.equal(count('shore_cast_attempt'), 1, 'one attempt cannot become two conflicting outcomes');
telemetry.action('cast', { slot: 2, outcome: 'queued', attempt_id: 'b' });
assert.equal(events.at(-1).properties.outcome, 'queued', 'buffered requests are distinct from executed casts');
telemetry.action('cast', { slot: 0, outcome: 'rejected', reason: 'mana' });
for (let i = 0; i < 100; i++) telemetry.action('cast', { slot: 0, outcome: 'rejected', reason: 'mana' });
assert.equal(count('shore_cast_attempt'), 3, 'held rejected controls are limited by slot and reason');
telemetry.action('cast', { slot: 0, outcome: 'rejected', reason: 'silenced' });
now = 1000; telemetry.action('cast', { slot: 0, outcome: 'rejected', reason: 'mana' });
telemetry.action('cast', { slot: 3, outcome: 'cancelled', attempt_id: 'c' });
telemetry.action('cast', { slot: 4, outcome: 'accepted' });
assert.equal(count('shore_cast_attempt'), 6);
telemetry.action('tutorial', { step: 'move' }); telemetry.action('tutorial', { step: 'move' });
assert.equal(count('shore_tutorial_step'), 1);

p.deaths++; p.respawn = 12; telemetry.observe(s); telemetry.observe(s);
assert.equal(count('shore_death'), 1);
tower.hp = 0; s.stats.towers++; telemetry.observe(s); telemetry.observe(s);
assert.equal(count('shore_objective_action'), 1);
s.objective = 40; telemetry.observe(s); s.objective = null; s.stats.leviathans++; telemetry.observe(s);
assert.equal(events.at(-1).properties.team, 0, 'Hunt claims use the team statistic rather than the missing dead boss');
s.phase = 1; telemetry.observe(s); telemetry.observe(s);
assert.equal(count('shore_realm_shift'), 1);
globalThis.innerWidth = 844; globalThis.innerHeight = 390;
telemetry.input('keyboard'); telemetry.action('rally');
assert.equal(events.at(-1).properties.input_type, 'keyboard');
assert.equal(events.at(-1).properties.orientation, 'landscape', 'rotation updates context during a match');
for (const e of events.filter(e => !e.event.startsWith('shore_load_'))) {
  assert.equal(e.properties.match_id, firstId); assert.equal(e.properties.build_sha, 'test-build');
  assert.equal(e.properties.hero_id, 2); assert.equal(e.properties.difficulty, 'mythic');
  assert.equal(e.properties.x, undefined); assert.equal(e.properties.text, undefined);
}
s.winner = 0; telemetry.observe(s); telemetry.end(s); telemetry.abandon(s); telemetry.action('cast', { slot: 0, outcome: 'accepted' });
assert.equal(count('shore_match_ended'), 1); assert.equal(count('shore_match_abandoned'), 0);
const second = { ...s, winner: null, time: 0 };
const secondId = telemetry.start(second); assert.notEqual(secondId, firstId);
telemetry.abandon(second); telemetry.abandon(second); assert.equal(count('shore_match_abandoned'), 1);
const third = { ...second }; telemetry.start(third); third.winner = 1;
telemetry.start({ ...third, winner: null });
assert.equal(count('shore_match_ended'), 2, 'starting again records a concluded match even if its final frame was not observed');
assert.equal(count('shore_match_abandoned'), 1);
if (savedWidth === undefined) delete globalThis.innerWidth; else globalThis.innerWidth = savedWidth;
if (savedHeight === undefined) delete globalThis.innerHeight; else globalThis.innerHeight = savedHeight;

for (const capture of [() => { throw Error('blocked'); }, () => Promise.reject(Error('offline'))]) {
  const safe = createShoreTelemetry({ capture, context: () => { throw Error('missing context'); }, makeId: () => { throw Error('missing crypto'); } });
  assert.doesNotThrow(() => { safe.load('started'); safe.start(second); safe.action('cast', { slot: 0, outcome: 'accepted' });
    safe.observe(second); safe.abandon(second); });
}
// Rejected capture promises must be handled, including after the caller continues playing.
await new Promise(resolve => setImmediate(resolve));

function tracker(host, game = 'tidebreak', automated = false) {
  const requests = [], storage = new Map();
  const document = { currentScript: { dataset: { game } }, addEventListener() {}, visibilityState: 'visible', hasFocus: () => true };
  const window = { addEventListener() {} };
  const context = { window, document, navigator: { webdriver: automated }, location: { hostname: host }, crypto: { randomUUID },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    performance: { now: () => 0 }, Date, setInterval() {}, fetch: async (url, options) => requests.push(JSON.parse(options.body)) };
  vm.runInNewContext(readFileSync(new URL('../../public/arcade/analytics.js', import.meta.url), 'utf8'), context);
  window.ArcadeAnalytics.captureShore('shore_match_started', { match_id: 'anonymous-match', game_id: 'wrong', environment: 'qa', distinct_id: 'wrong' });
  return { requests, api: window.ArcadeAnalytics };
}
const production = tracker('warden-alpha-wheat.vercel.app');
assert.equal(production.requests.length, 2, 'the known Shore production host captures a view and explicit match start');
assert.equal(production.requests[1].properties.game_id, 'tidebreak');
assert.equal(production.requests[1].properties.environment, 'production', 'game properties cannot override protected routing context');
assert.notEqual(production.requests[1].distinct_id, 'wrong');
assert.equal(production.requests[0].distinct_id, production.requests[1].distinct_id, 'gameplay keeps the existing anonymous visitor ID');
assert.equal(production.requests[0].properties.session_id, production.requests[1].properties.session_id);
assert.equal(production.requests[1].properties.$process_person_profile, false);
for (const host of ['localhost', '127.0.0.1', 'warden-preview.vercel.app', 'warden-git-feat-shore-playability-vdimarcos-projects.vercel.app']) {
  assert.equal(tracker(host).requests.length, 0, host);
}
assert.equal(tracker('warden-alpha-wheat.vercel.app', 'fish').requests.length, 0, 'the new host exception applies only to Shore');
assert.equal(tracker('warden-alpha-wheat.vercel.app', 'tidebreak', true).requests.length, 0, 'browser automation does not send production events');
assert.equal(tracker('arcade.uptick.systems', 'tidebreak', true).requests.length, 0);
assert.equal(tracker('arcade.uptick.systems', 'fish').requests.length, 1, 'other arcade tracking retains its original host');
console.log('PASS: anonymous match context, transition-only events, Recall outcomes, cast dedupe and rejection limits, match boundaries, capture failure, and production/QA host isolation.');
