import test from 'node:test';
import assert from 'node:assert/strict';
import { adventureCue, adventureRouteCue, islandGesture } from '../src/game/adventure-cues.js';

const adventure = { id: 'fork-4', in: 2.4, phase: 'approach' };

test('a river choice yields to an earlier action and to imminent danger inside either stream', () => {
  assert.equal(adventureCue({ adventure }), adventure);
  assert.equal(adventureCue({ adventure, hint: { in: 2.2 } }), null, 'finish the prior obstacle before choosing a stream');
  assert.equal(adventureCue({ adventure, hint: { in: 2.4 } }), adventure, 'the fork preview can describe its own later action');
  for (const selectedSide of [-1, 1]) {
    const active = { ...adventure, phase: 'split', in: 0, selectedSide };
    assert.equal(adventureCue({ adventure: active, hint: { in: 1.2 } }), null, 'a treasure prize cannot cover the necessary jump or duck cue');
    assert.equal(adventureCue({ adventure: active, hint: { in: 1.8 } }), active, 'the remembered objective returns after the immediate action');
  }
  assert.equal(adventureCue({ adventure }, true), null);
  assert.equal(adventureCue({}), null);
});

test('the island warning preserves the approaching route choice and directs lateral steering', () => {
  const run = { adventure, hint: { type: 'island', in: .6, lane: 2 } };
  assert.equal(adventureCue(run), adventure, 'the immediate land warning must not hide the available streams');
  assert.deepEqual(islandGesture(run.hint.type), { gesture: 'lanes', label: 'Choose a stream', hint: 'Swipe left or right' });
  assert.equal(islandGesture('log'), null, 'ordinary hazards keep their jump or duck instructions');
  assert.equal(adventureCue(run, true), null, 'paused or ended play does not show new guidance');
  assert.equal(adventureCue({ ...run, adventure: { ...adventure, phase: 'split' } }), null, 'inside the fork, a land contact warning takes precedence over treasure progress');
});

test('treasure guidance separates guaranteed reward from an earned clean bonus', () => {
  const safe = adventureRouteCue({ role: 'safe', basePoints: 200, maxPoints: 200, totalClears: 0 });
  assert.equal(safe.base, 200); assert.equal(safe.bonus, 0); assert.equal(safe.risk, false);
  const risky = { role: 'risk', basePoints: 200, maxPoints: 600, totalClears: 3, cleanClears: 2 };
  const pending = adventureRouteCue(risky);
  assert.equal(pending.base, 200); assert.equal(pending.bonus, 400);
  assert.equal(pending.clears, 2); assert.equal(pending.total, 3); assert.equal(pending.earned, null);
  const failed = adventureRouteCue({ ...risky, cleanEligible: false });
  assert.equal(failed.eligible, false); assert.equal(failed.base, 200);
  for (const earned of [200, 600]) {
    const collected = adventureRouteCue({ ...risky, collected: true, earned });
    assert.equal(collected.collected, true); assert.equal(collected.earned, earned, 'the HUD reports actual contact points rather than the advertised maximum');
  }
});
