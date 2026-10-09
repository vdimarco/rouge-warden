import assert from 'node:assert/strict';
import { FIRST_MATCH_KEY, browserStorage, createFirstMatchGuide, hasMatchExperience } from '../../public/tidebreak/first-match.js';
import { createMatch } from '../../public/tidebreak/sim.js';
import { DEFAULT_DIFFICULTY } from '../../public/tidebreak/bot-difficulty.js';

function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
}
const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } };
const hero = () => ({ x: 100, y: 100, hp: 500, team: 0, skillRanks: [0, 0, 0, 0], recall: 0 });
function reachAim(guide, p) {
  guide.begin(p); p.skillRanks[1] = 1; assert.equal(guide.update(p).step, 'move');
  p.x += 90; assert.equal(guide.update(p).step, 'aim');
}

// A live match shows one step. Time and unsuccessful actions cannot advance it.
{
  const storage = memory(), transitions = [], guide = createFirstMatchGuide({ storage, onStep: e => transitions.push(e) }), p = hero();
  assert.equal(guide.begin(p).step, 'learn');
  for (let i = 0; i < 200; i++) assert.equal(guide.update(p).step, 'learn');
  guide.notify('aim'); guide.notify('cancel'); assert.equal(guide.view().step, 'learn');
  p.skillRanks[0] = 1; assert.equal(guide.update(p).step, 'move');
  p.x += 50; assert.equal(guide.update(p).step, 'move');
  p.x += 35; assert.equal(guide.update(p).step, 'aim');
  guide.notify('cast', { accepted: false }); guide.notify('cast', { accepted: true }); guide.notify('cancel');
  assert.equal(guide.view().step, 'aim', 'touch cancellation is taught by an actual aim and cancel');
  guide.notify('aim'); assert.equal(guide.view().step, 'aim'); guide.notify('cancel'); assert.equal(guide.view().step, 'push');
  const tower = { x: p.x + 800, y: p.y, kind: 'tower', team: 1, hp: 900, range: 500 };
  assert.equal(guide.update(p, { units: [tower] }).active, true, 'standing near a tower alone cannot complete the guide');
  tower.x = p.x + 300;
  assert.match(guide.update(p, { units: [tower] }).text, /Step out of tower range/);
  const wisp = { x: tower.x - 80, y: tower.y, kind: 'minion', team: 0, hp: 200 };
  assert.equal(guide.update(p, { units: [tower, wisp], towerThreat: true }).active, true, 'tower fire keeps the warning visible');
  assert.equal(guide.update(p, { units: [tower, wisp] }).active, false, 'joining a wave at a tower completes the guide');
  assert.equal(storage.getItem(FIRST_MATCH_KEY), 'complete');
  assert.equal(guide.begin(hero()).active, false);
  assert.deepEqual(transitions.filter(e => e.outcome === 'completed').map(e => e.step), ['learn', 'move', 'aim', 'push', 'complete']);
  assert.equal(createFirstMatchGuide({ storage }).begin(hero()).active, false, 'completion survives a later visit');
}

// Desktop instructions use the learned key. Only an accepted cast advances aim.
for (const inputType of ['desktop', 'mouse', 'keyboard', () => 'mouse']) {
  const guide = createFirstMatchGuide({ storage: memory(), inputType }), p = hero();
  assert.match(guide.begin(p).text, /Click \+ above a spell/);
  reachAim(guide, p); assert.match(guide.view().text, /press E/);
  guide.notify('cast', { accepted: false }); assert.equal(guide.view().step, 'aim');
  guide.notify('cast', { accepted: true }); assert.equal(guide.view().step, 'push');
}

// Large jumps, death, paused play and Recall never count as walking.
{
  const guide = createFirstMatchGuide({ storage: memory() }), p = hero();
  guide.begin(p); p.skillRanks[0] = 1; guide.update(p);
  p.x += 1000; assert.equal(guide.update(p).step, 'move');
  p.recall = 2; p.x += 100; guide.update(p); p.recall = 0; guide.update(p);
  p.hp = 0; p.x += 1000; guide.update(p); p.hp = 500; guide.update(p);
  p.x += 100; guide.update(p, { paused: true }); guide.update(p);
  assert.equal(guide.view().step, 'move');
  p.x += 90; assert.equal(guide.update(p).step, 'aim');
}

// Skipping is remembered in storage and in the current visit when storage fails.
for (const storage of [memory(), blocked, null]) {
  const guide = createFirstMatchGuide({ storage }), p = hero();
  assert.equal(guide.begin(p).active, true); assert.equal(guide.skip().active, false);
  assert.equal(guide.begin(p).active, false);
  assert.equal(guide.show(p).active, true, 'Help can bring a skipped guide back');
}
for (const saved of ['complete', 'skipped']) assert.equal(createFirstMatchGuide({ storage: memory({ [FIRST_MATCH_KEY]: saved }) }).begin(hero()).active, false);
assert.equal(createFirstMatchGuide({ storage: memory({ 'monster-mash.record': '{"matches":3,"wins":1}' }) }).begin(hero()).active, false, 'old players keep their quick start');
assert.equal(hasMatchExperience(memory({ 'monster-mash.record': '{broken' })), false);

// UI defaults protect first visits without changing the simulator's Veteran default.
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let serial = 0;
const freshDifficulty = storage => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  return import(`../../public/tidebreak/difficulty-ui.js?first-match-${serial++}`);
};
try {
  assert.equal(DEFAULT_DIFFICULTY, 'veteran');
  for (const storage of [memory(), blocked, null]) {
    const ui = await freshDifficulty(storage); assert.equal(ui.savedDifficulty(), 'apprentice');
    assert.equal(ui.applyDifficulty(createMatch()).difficulty[1], 'apprentice');
  }
  for (const chosen of ['apprentice', 'veteran', 'mythic']) {
    const ui = await freshDifficulty(memory({ 'tidebreak.difficulty': chosen }));
    assert.equal(ui.savedDifficulty(), chosen); assert.equal(ui.applyDifficulty(createMatch()).difficulty[1], chosen);
  }
  const record = memory({ 'monster-mash.record': '{"matches":1}' });
  assert.equal((await freshDifficulty(record)).savedDifficulty(), 'veteran', 'an old player without a saved choice retains Veteran');
  const storage = memory(), first = await freshDifficulty(storage); first.applyDifficulty(createMatch());
  storage.setItem('monster-mash.record', '{"matches":1}');
  assert.equal((await freshDifficulty(storage)).savedDifficulty(), 'apprentice', 'finishing the first match does not silently increase difficulty');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked'); } });
  assert.equal(browserStorage(), null);
  const ui = await import(`../../public/tidebreak/difficulty-ui.js?first-match-${serial++}`);
  assert.equal(ui.savedDifficulty(), 'apprentice');
  class Picker extends EventTarget {
    setAttribute() {}
    querySelector() { return { focus() {} }; }
    closest() { return { dataset: { difficulty: 'mythic' } }; }
  }
  const picker = new Picker(); ui.mountDifficulty(picker);
  const right = new Event('keydown', { cancelable: true }); right.key = 'ArrowRight'; picker.dispatchEvent(right);
  assert.equal(ui.savedDifficulty(), 'veteran', 'arrow keys change difficulty when the storage getter is blocked');
  picker.dispatchEvent(new Event('click'));
  assert.equal(ui.applyDifficulty(createMatch()).difficulty[1], 'mythic', 'an explicit picker choice is honored even when it cannot be saved');
} finally {
  if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete globalThis.localStorage;
}
console.log('First match guide: live actions, aim/cancel, tower safety, skip/help, old records and blocked storage pass.');
console.log('Difficulty UI: first-visit Apprentice, saved choice, old-player Veteran and unchanged simulator default pass.');
