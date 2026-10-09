import test from 'node:test';
import assert from 'node:assert/strict';
import { adventureCue, adventureRouteCue, islandGesture, rewardChoiceCue, streamPreview } from '../src/game/adventure-cues.js';

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

const opportunity = {
  id: 'choice-8', family: 'wildlife-bank', routeSide: -1,
  entryLane: 1, alternativeLane: 0, exitLane: 1,
  action: 'jump', baseValue: 120, actionBasePoints: 160,
  cleanBonusAtRisk: 400, guardId: 'guard-8', in: .7, exitIn: 2.4
};
const chosenStream = { ...adventure, phase: 'split', selectedSide: -1 };

test('nearby reward guidance keeps fixed stash income separate from optional guard and clean rewards', () => {
  const run = { adventure: chosenStream, visualLane: 1, rewardChoice: opportunity };
  const cue = rewardChoiceCue(run);
  assert.equal(cue.stashPoints, 120); assert.equal(cue.actionPoints, 160); assert.equal(cue.cleanAtRisk, 400);
  assert.equal(cue.actionLabel, 'Jump'); assert.equal(cue.stashDirection, 'left');
  assert.equal(cue.guardExitDirection, 'hold', 'the action path stays in the repeated guard lane');
  assert.equal(cue.returnDirection, 'right', 'the grounded stash path has its own different exit');
  const banked = rewardChoiceCue({ ...run, rewardChoice: { ...opportunity, cleanBonusAtRisk: 0, returnFromValue: 200 } });
  assert.equal(banked.stashPoints, 120, 'a previous detour does not inflate this stash');
  assert.equal(banked.cleanAtRisk, 0, 'an already lost clean bonus cannot remain advertised');
});

test('same-guard choices retain action and escape guidance while other hazards take priority', () => {
  const run = { adventure: chosenStream, visualLane: 1, rewardChoice: opportunity };
  assert.ok(rewardChoiceCue({ ...run, hint: { guardId: opportunity.guardId, type: 'log', in: .4 } }));
  assert.equal(rewardChoiceCue({ ...run, hint: { guardId: 'previous-guard', type: 'branch', in: .4 } }), null);
  assert.equal(rewardChoiceCue({ ...run, hint: { type: 'island', in: .4 } }), null);
  assert.equal(rewardChoiceCue({ ...run, hint: { guardId: opportunity.guardId, fullStreamGate: true, in: .4 } }), null, 'a two-lane gate cannot advertise an action-free bank bypass');
  assert.equal(rewardChoiceCue({ ...run, adventure: { ...chosenStream, selectedSide: 1 } }), null, 'only the chosen water stream can offer its pocket');
  assert.equal(rewardChoiceCue({ ...run, rewardChoice: { ...opportunity, expired: true } }), null);
  assert.equal(rewardChoiceCue({ ...run, rewardChoice: { ...opportunity, exitIn: 0 } }), null);
  assert.equal(rewardChoiceCue(run, true), null);
});

test('a grounded detour directs its next guard action after the lateral return', () => {
  const detour = { ...opportunity, family: 'landing-detour', action: 'duck', baseValue: 200, actionBasePoints: 0 };
  const run = { adventure: chosenStream, visualLane: 1, rewardChoice: detour };
  const cue = rewardChoiceCue(run);
  assert.equal(cue.stashPoints, 200); assert.equal(cue.actionPoints, 0); assert.equal(cue.actionLabel, 'Duck');
  assert.equal(cue.stashDirection, 'left'); assert.equal(cue.returnDirection, 'right');
  const returned = rewardChoiceCue({ ...run, rewardChoice: { ...detour, collected: true } });
  assert.equal(returned.returnDirection, 'hold', 'once physically returned, the arrow stops telling the rider to switch');
});

test('the stream comparison remains until physical commitment, including early local rewards', () => {
  for (const selectedSide of [-1, 1]) {
    assert.equal(streamPreview({ ...adventure, phase: 'approach', selectedSide }), true);
    assert.equal(streamPreview({ ...adventure, phase: 'split', selectedSide }), false);
  }
  assert.equal(streamPreview({ ...adventure, phase: 'split', selectedSide: null }), true);
  assert.equal(streamPreview(chosenStream, true), true, 'an island steering warning still shows the available stream choices');
});
