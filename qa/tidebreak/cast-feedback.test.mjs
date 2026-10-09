import assert from 'node:assert/strict';
import { castFeedback } from '../../public/tidebreak/cast-feedback.js';
import { createMatch, player, requestCast, HEROES } from '../../public/tidebreak/sim.js';
import { manaCost } from '../../public/tidebreak/combat-rules.js';
import { CAST_BUFFER } from '../../public/tidebreak/combat-tells.js';
import { near as open } from './open-ground.mjs';

const setup = (hero = 4) => {
  const s = createMatch(hero, 49), p = player(s), foe = s.units.find(e => e.kind === 'hero' && e.team === 1);
  const point = open(2400, 2800);
  Object.assign(p, point, { level: 6, skillRanks: [1, 1, 1, 1], mana: 2000, maxMana: 2000, cd: [0, 0, 0, 0] });
  Object.assign(foe, { x: p.x, y: p.y - 100, hp: 10000, maxHp: 10000 });
  p.target = foe.id; s.units = [p, foe];
  return { s, p, foe };
};
const aim = { x: 0, y: -1 };

// Each legal spell is accepted by the real request path. The helper itself never casts or changes state.
for (let hero = 0; hero < HEROES.length; hero++) for (let slot = 0; slot < 4; slot++) {
  const { s, p } = setup(hero), before = JSON.stringify(s);
  assert.equal(castFeedback(s, p, slot, aim).outcome, 'accepted', `hero ${hero}, slot ${slot} is ready`);
  assert.equal(JSON.stringify(s), before, 'reading feedback does not alter simulation state');
  assert.equal(requestCast(s, p, slot, aim), true, 'the predicted ready spell starts through requestCast');
}

const checks = [
  ['unlearned', p => p.skillRanks[1] = 0],
  ['cooldown', p => p.cd[1] = 2.4],
  ['mana', p => p.mana = manaCost(p, 1) - 1],
  ['stun', p => p.stun = 1],
  ['fear', p => p.fear = 1],
  ['silence', p => p.silencedUntil = 2],
  ['taunt', p => p.tauntUntil = 2],
  ['dead', p => p.hp = 0],
  ['castIntent', p => p.castIntent = { at: 1, recovery: .2 }],
  ['recovery', p => p.recoveryUntil = 1],
];
for (const [reason, change] of checks) {
  const { s, p } = setup(); change(p);
  const feedback = castFeedback(s, p, 1, aim);
  assert.equal(feedback.outcome, 'rejected'); assert.equal(feedback.reason, reason);
  assert.ok(feedback.message.length > 0, 'a failed attempt has a useful message');
  assert.equal(requestCast(s, p, 1, aim), false); assert.equal(p.queuedCast, undefined);
}
{
  const { s, p } = setup(); p.cd[1] = 2.4;
  assert.equal(castFeedback(s, p, 1).message, 'Ready in 3s.');
  p.cd[1] = 0; p.mana = manaCost(p, 1) - 7.2;
  assert.equal(castFeedback(s, p, 1).message, 'Need 8 more mana.');
}
{
  const { s, p } = setup(0); p.snaredUntil = 2;
  assert.equal(castFeedback(s, p, 0).reason, 'root'); assert.equal(requestCast(s, p, 0, aim), false);
  assert.equal(castFeedback(s, p, 1).outcome, 'accepted'); assert.equal(requestCast(s, p, 1, aim), true, 'root does not block a stationary spell');
}
for (const lock of ['castIntent', 'recovery']) {
  const { s, p } = setup();
  if (lock === 'castIntent') p.castIntent = { at: CAST_BUFFER / 2, recovery: 0 }; else p.recoveryUntil = CAST_BUFFER / 2;
  assert.equal(castFeedback(s, p, 1, aim).outcome, 'queued', 'a press near the end of a commitment queues');
  assert.equal(requestCast(s, p, 1, aim), false, 'requestCast returns false for queued spells');
  assert.equal(p.queuedCast?.slot, 1, 'the actual spell is stored in the buffer');
}
{
  const { s, p } = setup(); p.recoveryUntil = CAST_BUFFER / 2;
  assert.equal(castFeedback(s, p, 1, aim, { bot: true }).reason, 'recovery');
  assert.equal(requestCast(s, p, 1, aim, { bot: true }), false); assert.equal(p.queuedCast, undefined, 'bots cannot buffer');
  p.cd[1] = 1;
  assert.equal(castFeedback(s, p, 1, aim).reason, 'cooldown'); requestCast(s, p, 1, aim); assert.equal(p.queuedCast, undefined, 'a cooling-down spell cannot buffer');
  p.cd[1] = 0; p.mana = 0;
  assert.equal(castFeedback(s, p, 1, aim).reason, 'mana'); requestCast(s, p, 1, aim); assert.equal(p.queuedCast, undefined, 'an unaffordable spell cannot buffer');
}
for (const hero of [0, 8]) {
  const { s, p, foe } = setup(hero);
  foe.x += 1000;
  assert.equal(castFeedback(s, p, 2, aim).reason, 'no_target'); assert.equal(requestCast(s, p, 2, aim), false, 'a targeted spell needs a visible enemy in range');
  foe.x = p.x; foe.y = p.y - 300; foe.cloak = 3;
  assert.equal(castFeedback(s, p, 2, aim).reason, 'no_target'); assert.equal(requestCast(s, p, 2, aim), false, 'feedback does not reveal a concealed target');
}
{
  const { s, p } = setup(6); p.returnAnchor = { x: p.x + 40, y: p.y, until: 3 }; p.cd[0] = 9; p.mana = 0;
  assert.deepEqual(castFeedback(s, p, 0, aim), { outcome: 'accepted', reason: null, message: 'Return to your decoy.', returning: true });
  p.recoveryUntil = CAST_BUFFER / 2;
  assert.equal(castFeedback(s, p, 0, aim).outcome, 'queued', 'decoy return can buffer despite cooldown and zero mana');
  assert.equal(requestCast(s, p, 0, aim), false); assert.equal(p.queuedCast?.slot, 0);
  p.recoveryUntil = 0; p.queuedCast = null;
  assert.equal(requestCast(s, p, 0, aim), true, 'decoy return bypasses normal resource gates');
  assert.equal(p.returnAnchor, null);
}
{
  const { s, p } = setup(6); p.returnAnchor = { x: p.x + 40, y: p.y, until: 3 }; p.snaredUntil = 2;
  assert.equal(castFeedback(s, p, 0, aim).reason, 'root'); assert.equal(requestCast(s, p, 0, aim), false, 'return still respects root');
}
{
  const { s, p } = setup(); s.winner = 0;
  assert.equal(castFeedback(s, p, 1).reason, 'match_ended'); assert.equal(requestCast(s, p, 1, aim), false);
  assert.equal(castFeedback(s, p, 4).reason, 'invalid');
}
console.log('PASS: spell feedback matches all hero casts, controls, resources, targeted range, queued requests and decoy return without side effects.');
