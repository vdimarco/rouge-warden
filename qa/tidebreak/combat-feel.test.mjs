// Combat feel: tells, punish windows, impact weights, the cast buffer, basic attack dodges,
// the death recap, camp roles and objective timers. See openspec/changes/shore-grand-arena/notes/combat-feel.md.
import assert from 'node:assert/strict';
import { createMatch, player, cast, requestCast, step, damage, HEROES } from '../../public/tidebreak/sim.js';
import { castTiming } from '../../public/tidebreak/combat-state.js';
import { insideWarning } from '../../public/tidebreak/combat-rules.js';
import { TOWER_LOCK, CAST_BUFFER, MISS_EXPOSE, ULT_MISS_EXPOSE, INTERRUPT_EXPOSE, EXPOSED_BONUS, DODGE_SLACK, RECAP_LIMIT, windupState, lockRemaining, manaRegen, isEngage } from '../../public/tidebreak/combat-tells.js';
import { ImpactFeel, IMPACT_FEEL, HITSTOP_GAP } from '../../public/tidebreak/impact-feel.js';
import { buildRecap, recapTip } from '../../public/tidebreak/death-recap.js';
import { encounterPattern } from '../../public/tidebreak/encounters.js';
import { objectiveClock, clockText } from '../../public/tidebreak/objective-clock.js';
import { Announcer } from '../../public/tidebreak/announcer.js';

const setup = (hero = 4) => {
  const s = createMatch(hero, 42), p = player(s), enemy = s.units.find(e => e.kind === 'hero' && e.team === 1);
  s.units = [p]; s.nextWave = s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  Object.assign(p, { x: 2400, y: 2800, level: 6, skillRanks: [1, 1, 1, 1], nextShop: Infinity, power: 0, mana: 2000, maxMana: 2000 });
  return { s, p, enemy };
};
// An enemy hero that stands still and never attacks.
const foeHero = (s, enemy, extra = {}) => { const t = Object.assign(enemy, { x: 2400, y: 2500, hp: 5000, maxHp: 5000, shield: 0, armor: 0, speed: 0, attackCd: 999, rate: 999, nextShop: Infinity, thinkAt: Infinity, skillRanks: [0, 0, 0, 0], ...extra }); s.units.push(t); return t; };
const advance = (s, seconds, input = { attack: false }) => { for (let i = 0; i < Math.round(seconds * 100); i++) step(s, input, .01); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ---- Rule 2: every big hit has a tell of at least 0.3 s.
for (let hero = 0; hero < HEROES.length; hero++) for (let slot = 0; slot < 4; slot++) {
  const bot = castTiming({ hero }, slot, true), human = castTiming({ hero }, slot);
  if (bot.windup > 0) assert.ok(bot.windup >= .45, `bot windup for hero ${hero} slot ${slot} is at least 0.45 s`);
  if (isEngage({ hero }, slot)) { assert.equal(bot.windup, .45); assert.ok(human.windup >= .3, 'player engages also have a 0.3 s tell'); }
}
assert.deepEqual(Object.keys({ 3: 1, 7: 1 }).map(Number).filter(h => isEngage({ hero: h }, 0)), [3, 7], 'leap and charge are the engages');
{ // Jersey Devil's leap shows a path to its landing circle, and the stun waits for the windup.
  const { s, p, enemy } = setup(0), devil = foeHero(s, enemy, { hero: 3, skillRanks: [1, 0, 0, 0], cd: [0, 0, 0, 0], mana: 999, x: 2400, y: 2300 });
  Object.assign(p, { x: 2400, y: 2700 });
  assert.ok(requestCast(s, devil, 0, { x: 0, y: 1, distance: 400 }, { bot: true }));
  const intent = devil.castIntent; assert.equal(intent.shape.shape, 'path'); assert.ok(intent.shape.engage);
  assert.ok(insideWarning(p, intent.shape), 'the landing point is inside the path tell');
  assert.equal(insideWarning({ x: p.x + 600, y: p.y, radius: 22 }, intent.shape), false, 'a hero to the side is outside the path tell');
  assert.equal(windupState(devil, s.time + .2).kind, 'engage'); assert.ok(near(windupState(devil, intent.start + intent.at - intent.start - .45 / 2).progress, .5), 'windup progress runs from cue to hit');
  advance(s, .4); assert.equal(p.stun, 0, 'no stun before the tell ends');
  advance(s, .1); assert.ok(p.stun > 0, 'the leap stuns after its tell'); assert.ok(s.time - intent.start >= .45);
}
{ // Kraken's ink arms before its first tick, so the first damage is warned.
  const { s, p, enemy } = setup(4), t = foeHero(s, enemy, { x: 2400, y: 2700 }); cast(s, p, 0);
  const ink = s.zones.find(z => z.type === 'ink'); assert.ok(ink.armed - s.time >= .35 - 1e-9); const hp = t.hp; advance(s, .3); assert.equal(t.hp, hp, 'ink does not hurt before it arms'); advance(s, .1); assert.ok(t.hp < hp);
}
{ // Towers lock on for 0.35 s before the first shot at a hero, with a lock window for renderers.
  const { s, p } = setup(0); Object.assign(p, { hp: 100000, maxHp: 100000, shield: 0 });
  const tower = { id: 700, kind: 'tower', name: 'Test ward', team: 1, tier: 0, x: p.x, y: p.y - 200, hp: 3000, maxHp: 3000, radius: 42, range: 360, damage: 100, rate: 1, attackCd: 0, hit: 0, shield: 0, stun: 0, slow: 0, fear: 0, lastHit: -100, revealedUntil: -1, facing: 0 };
  s.units.push(tower); let first = null; const hp = p.hp;
  for (let i = 0; i < 100 && first === null; i++) { step(s, { attack: false }, .01); if (p.hp < hp) first = s.time; }
  assert.ok(first - tower.lockStart >= TOWER_LOCK, `first tower shot lands ${first - tower.lockStart} s after lock-on`);
  const lock = windupState({ ...tower, lockAt: tower.lockStart + TOWER_LOCK }, tower.lockStart + .1); assert.equal(lock.kind, 'lock'); assert.equal(lock.target, p.id);
}
{ // The windup sound starts with the enemy intent, panned and marked when it is aimed at the player. A tower lock beeps.
  const calls = [], sound = { windup: (x, y, o) => calls.push(['windup', o]), lockOn: () => calls.push(['lock']), stinger() {}, say() {}, setIntensity() {}, throttle: () => true, spatial: () => ({ far: false }), towerShot() {}, worldCast() {}, worldHit() {} };
  const el = () => ({ children: [], setAttribute() {}, append() {}, replaceChildren() {}, className: '' });
  globalThis.document = { createElement: el };
  const announcer = new Announcer(sound, el()), { s, p, enemy } = setup(0), foe = foeHero(s, enemy, { hero: 4, skillRanks: [1, 1, 1, 1], cd: [0, 0, 0, 0], mana: 999 });
  announcer.update(s, { playerId: p.id, visible: new Set([foe.id]) });
  assert.ok(requestCast(s, foe, 1, { x: 0, y: 1, distance: 300 }, { bot: true }));
  announcer.update(s, { playerId: p.id, visible: new Set([foe.id]) });
  assert.equal(calls.length, 1); assert.equal(calls[0][1].aimed, true, 'the cue knows it is aimed at you'); assert.ok(calls[0][1].duration >= .45, 'the swell lasts as long as the tell');
  Object.assign(foe, { lockTarget: p.id, lockStart: s.time, lockAt: s.time + TOWER_LOCK }); announcer.update(s, { playerId: p.id, visible: new Set([foe.id]) });
  assert.deepEqual(calls.at(-1), ['lock'], 'a lock-on on the player beeps');
}

// ---- Rule 4: a missed commit leaves the caster exposed, and hitting an exposed hero pays.
{
  const { s, p, enemy } = setup(4), t = foeHero(s, enemy);
  assert.ok(requestCast(s, p, 2, { x: 0, y: -1, distance: 300 })); t.x += 700; advance(s, .45);
  assert.ok(p.exposedUntil - s.time > MISS_EXPOSE - .45 - .01 && p.exposeReason === 'miss', 'a missed lance exposes the caster');
  assert.ok(p.recoveryUntil >= p.exposedUntil - 1e-9, 'the miss extends recovery');
  const base = { ...p }; p.shield = 0; const before = p.hp; damage(s, t, p, 100, 'attack'); const taken = before - p.hp;
  assert.ok(near(taken, 100 * EXPOSED_BONUS * 100 / (100 + (p.armor || 0))), `an exposed hero takes x${EXPOSED_BONUS} from heroes`);
  assert.ok((s.combatFeedback || []).some(f => f.type === 'exposed' && f.label === 'OPENING HIT'), 'the opening is called out');
  void base;
}
{ // A hit keeps the short recovery; an ultimate that hits still exposes for its recovery.
  const { s, p, enemy } = setup(4), t = foeHero(s, enemy, { x: 2400, y: 2500 });
  assert.ok(requestCast(s, p, 2, { x: 0, y: -1, distance: 300 })); advance(s, .45); assert.ok(!(p.exposedUntil > s.time), 'a landed lance does not expose');
  advance(s, 1); p.cd = [0, 0, 0, 0]; t.x = p.x; t.y = p.y - 200;
  assert.ok(requestCast(s, p, 3, { x: 0, y: -1, distance: 200 })); advance(s, .4); assert.equal(p.exposeReason, 'ultimate');
}
{ // Mothman's fear burst hits around the caster. Nobody near means a missed ultimate.
  const { s, p, enemy } = setup(0); foeHero(s, enemy, { x: 2400, y: 1200 });
  assert.ok(requestCast(s, p, 3, { x: 0, y: -1, distance: 200 })); advance(s, .4);
  assert.ok(p.exposedUntil - s.time > ULT_MISS_EXPOSE - .1 && p.exposeReason === 'miss', 'a missed ultimate exposes for 0.7 s');
}
{ // A placed zone is judged by its placement, and a late hero hit ends a miss exposure.
  const { s, p, enemy } = setup(2), t = foeHero(s, enemy, { x: 2400, y: 2420 });
  assert.ok(requestCast(s, p, 2, { x: 0, y: -1, distance: 380 })); advance(s, .4); assert.ok(!(p.exposedUntil > s.time), 'witchfire placement is not a miss');
  Object.assign(p, { exposedUntil: s.time + .5, exposeReason: 'miss' }); damage(s, p, t, 10); assert.ok(p.exposedUntil <= s.time, 'a late hit ends the miss exposure');
}
{ // Interrupting a cast staggers the caster.
  const { s, p, enemy } = setup(4); foeHero(s, enemy); assert.ok(requestCast(s, p, 2, { x: 0, y: -1, distance: 300 })); p.stun = .2; advance(s, .02);
  assert.equal(p.castIntent, null); assert.equal(p.exposeReason, 'interrupt'); assert.ok(p.exposedUntil - s.time > INTERRUPT_EXPOSE - .05);
}

// ---- Rule 5: impact weights, hitstop and shake values, the hurt channel. The sim never pauses.
assert.deepEqual([1, 2, 3].map(w => [IMPACT_FEEL[w].hitstop, IMPACT_FEEL[w].shake]), [[.06, 4], [.08, 6], [.09, 8]], 'hitstop 60/80/90 ms and shake 4/6/8 px');
{
  const { s, p, enemy } = setup(4), t = foeHero(s, enemy, { x: 2400, y: 2500 });
  assert.ok(requestCast(s, p, 3, { x: 0, y: -1, distance: 200 })); advance(s, .4);
  assert.ok(s.impacts.some(i => i.weight === 2 && i.kind === 'ultimate'), 'an ultimate is a weight 2 impact');
  t.hp = 1; damage(s, p, t, 50); assert.ok(s.impacts.some(i => i.weight === 3 && i.kind === 'kill' && i.target === t.id), 'a hero kill is a weight 3 impact');
  const feel = new ImpactFeel(), snapshot = JSON.stringify(s.units);
  s.impacts = []; s.nextImpact = 0; feel.update(s, p.id, .016);
  s.impacts.push({ id: 1, time: s.time, x: 0, y: 0, weight: 3, source: p.id, target: t.id }); s.nextImpact = 1;
  const out = feel.update(s, p.id, 0); assert.equal(out.impacts.length, 1); assert.equal(feel.hitstop, .09); assert.equal(feel.shake, 8); assert.ok(feel.frozen.has(t.id));
  assert.equal(feel.poseTime(t, s.time + .05), s.time, 'the hit pose freezes during hitstop'); assert.equal(feel.poseTime({ id: 999 }, s.time + .05), s.time + .05, 'other units keep moving');
  feel.update(s, p.id, .1); assert.equal(feel.hitstop, 0, 'hitstop lasts its 90 ms only');
  s.impacts.push({ id: 2, time: s.time, x: 0, y: 0, weight: 1, source: p.id, target: t.id }); s.nextImpact = 2; feel.update(s, p.id, .01); assert.equal(feel.hitstop, 0, `at most one hitstop per ${HITSTOP_GAP} s`);
  s.impacts.push({ id: 3, time: s.time, x: 0, y: 0, weight: 3, source: 50, target: 51 }); s.nextImpact = 3; assert.equal(feel.update(s, p.id, .3).impacts.length, 0, 'impacts that do not involve the player are ignored');
  const quiet = new ImpactFeel(); quiet.update(s, p.id, 0); s.impacts.push({ id: 4, time: s.time, x: 0, y: 0, weight: 3, source: p.id, target: t.id }); s.nextImpact = 4;
  quiet.update(s, p.id, 0, { reducedMotion: true }); assert.equal(quiet.hitstop + quiet.shake, 0, 'reduced motion turns off hitstop and shake');
  p.hp -= p.maxHp * .1; assert.ok(near(feel.update(s, p.id, .016).hurt, .1), 'damage taken reports the share of health lost'); assert.ok(feel.edge > .5, 'and flashes the screen edge');
  assert.equal(JSON.stringify(s.units.filter(u => u.id !== p.id)), JSON.stringify(JSON.parse(snapshot).filter(u => u.id !== p.id)), 'presentation never writes sim state');
}
{ // Damage numbers grow with the amount; openings are gold.
  const { s, p, enemy } = setup(4), t = foeHero(s, enemy); damage(s, p, t, 40, 'attack'); damage(s, p, t, 600, 'attack');
  const [small, big] = s.floaters.slice(-2); assert.ok(big.size > small.size, 'a big hit has a bigger number');
}

// ---- Rule 9: input buffer, commit and the dodgeable third strike.
{
  const { s, p, enemy } = setup(4); foeHero(s, enemy);
  assert.ok(requestCast(s, p, 2, { x: 0, y: -1, distance: 300 }));
  assert.equal(requestCast(s, p, 1, { x: 0, y: -1, distance: 300 }), false); assert.equal(p.queuedCast, undefined, 'an early press is not buffered');
  while (lockRemaining(s, p) > CAST_BUFFER) step(s, { attack: false }, .01);
  requestCast(s, p, 1, { x: 0, y: -1, distance: 300 }); assert.equal(p.queuedCast.slot, 1, `a press in the last ${CAST_BUFFER} s is QUEUED`);
  let started = null; for (let i = 0; i < 60 && started === null; i++) { step(s, { attack: false }, .01); if (p.castIntent?.slot === 1) started = s.time; }
  assert.ok(started !== null && started - p.recoveryUntil < .011 + 1e-9, 'the buffered cast starts on the first free step'); assert.equal(p.queuedCast, null);
  p.recoveryUntil = s.time + .1; p.castIntent = null; requestCast(s, p, 2, { x: 0, y: -1 }); p.cd[2] = 99; advance(s, .5); assert.equal(p.queuedCast, null, 'a buffered press that cannot cast expires');
}
{ // The third chain strike on a hero has a warned windup; stepping out of range dodges it.
  const { s, p, enemy } = setup(3), t = foeHero(s, enemy, { x: 2400, y: 2800 - 150 }); p.comboNext = 2; p.comboTarget = t.id; p.comboUntil = 99; p.attackCd = 0;
  step(s, { target: t.id }, .01); const pending = p.pendingAttack; assert.ok(pending.telegraph, 'the third strike is warned'); assert.ok(p.attackWindup >= .17 + .08 - 1e-9);
  t.y = p.y - (p.range + t.radius + DODGE_SLACK + 20); const hp = t.hp; advance(s, .4);
  assert.equal(t.hp, hp, 'stepping out of range dodges the strike'); assert.ok(s.combatFeedback.some(f => f.type === 'dodge' && f.source === t.id), 'the dodge is called out');
}

// ---- Rule 10: the death recap.
{
  const { s, p, enemy } = setup(0), foe = foeHero(s, enemy, { hero: 4, name: 'Riftblade', skillRanks: [1, 1, 1, 1], cd: [0, 0, 0, 0], mana: 999, x: 2400, y: 2500 });
  const tower = { id: 701, kind: 'tower', name: 'Outer ward', team: 1, x: 0, y: 0, hp: 1, maxHp: 1 }; s.units.push(tower);
  Object.assign(p, { hp: 1000, maxHp: 1000, shield: 0, armor: 0 });
  assert.ok(requestCast(s, foe, 1, { x: 0, y: 1, distance: 300 }, { bot: true })); advance(s, .6);
  p.shield = 120; const start = 1000 + p.shield; // a fresh shield right before the tower shot
  damage(s, tower, p, 300, 'attack'); damage(s, foe, p, 150, 'attack'); s.time += 1; damage(s, foe, p, 2000, 'attack');
  const r = p.deathRecap; assert.ok(r, 'a recap is saved at death');
  assert.equal(r.killer.name, 'Riftblade'); assert.deepEqual(r.sources.map(v => v.name).sort(), ['Outer ward', 'Riftblade']);
  assert.equal(r.total, Math.round(start), 'the recap total matches health and shield lost');
  assert.ok(Math.abs(r.sources.reduce((n, v) => n + v.share, 0) - 1) < 1e-9);
  assert.ok(r.types.tower && r.types.basic && r.types.spell, 'damage is split by type');
  const warned = r.warned.find(w => w.name === 'Riftblade'); assert.ok(warned?.dodgeable, 'the warned spell is listed as dodgeable'); assert.match(warned.label, /\w/);
  assert.ok(r.tip.length > 20 && r.cause, 'one tip from the main cause');
  assert.equal(p.damageLog.length, 0, 'history clears for the next life');
}
{ // The hit history is bounded in count and time.
  const { s, p, enemy } = setup(0), foe = foeHero(s, enemy); p.hp = p.maxHp = 1e9;
  for (let i = 0; i < 200; i++) { damage(s, foe, p, 1, 'attack'); s.time += .1; }
  assert.ok(p.damageLog.length <= RECAP_LIMIT); assert.ok(s.time - p.damageLog[0].time <= 8.1);
}
const tip = types => recapTip({ types, warned: [], controlled: 0, heroes: 1, total: 100, sources: [{ name: 'Nessie', amount: 100, share: 1, basic: 0 }], ...types.__ });
assert.equal(tip({ tower: { share: .5 } }).cause, 'tower');
assert.equal(recapTip({ types: {}, warned: [{ dodgeable: true, amount: 60, count: 2 }], controlled: 0, heroes: 1, total: 100, sources: [] }).cause, 'warned');
assert.equal(recapTip({ types: {}, warned: [], controlled: 2, heroes: 1, total: 100, sources: [] }).cause, 'control');
assert.equal(recapTip({ types: {}, warned: [], controlled: 0, heroes: 3, total: 100, sources: [] }).cause, 'outnumbered');
assert.equal(recapTip({ types: { neutral: { share: .8 } }, warned: [], controlled: 0, heroes: 0, total: 100, sources: [] }).cause, 'neutral');
assert.equal(recapTip({ types: { basic: { share: .9 } }, warned: [], controlled: 0, heroes: 1, total: 100, sources: [{ name: 'Nessie', amount: 100, share: 1, basic: 90 }] }).cause, 'basic');

// ---- Rules 6 and 8: camps fight like their art; objective timers with rest.
{
  const target = { x: 100, y: 0 }, camp = sprite => encounterPattern({ kind: 'camp', camp: 0, x: 0, y: 0, marketplaceSprite: sprite, name: sprite }, target, 0);
  assert.ok(camp('undead-archer').shape.width < .3 && camp('undead-mage').shape.width < .3, 'archer and mage shoot a line');
  assert.ok(camp('possessed-ogre').shape.width >= 1 && camp('undead-knight').shape.width >= 1, 'ogre and knight cleave');
  assert.match(camp('undead-archer').label, /Arrow volley/);
}
{
  const { s, p } = setup(0); s.objectiveAt = 40; s.time = 5; p.lastHit = -100;
  let clock = objectiveClock(s, p); assert.equal(clock.hunt.seconds, 35); assert.equal(clock.hunt.state, 'wait'); assert.ok(clock.rest, 'a quiet stretch shows a rest hint');
  assert.equal(clockText(clock.hunt), 'WILD HUNT 0:35');
  s.time = 31; clock = objectiveClock(s, p); assert.equal(clock.hunt.state, 'soon'); assert.equal(clock.rest, null, 'no rest just before a peak');
  s.units.push({ id: 800, kind: 'boss', hp: 10, x: 0, y: 0 }); assert.equal(objectiveClock(s, p).hunt.state, 'peak');
  p.lastHit = s.time; s.units.pop(); s.time = 5; assert.equal(objectiveClock(s, p).rest, null, 'no rest while fighting');
  assert.ok(objectiveClock(s, p).realm.seconds > 0, 'the realm countdown is part of the clock');
}
// ---- Rule 7: lane mana regeneration.
assert.equal(manaRegen(1), 3.75); assert.equal(manaRegen(10), 6);
console.log('PASS: engage and tower tells, windup and lock sounds, miss/ultimate/interrupt exposure and the opening bonus, impact weights, hitstop and shake values, the hurt channel, damage numbers, the cast buffer, the dodgeable third strike, the death recap and its tips, camp roles, objective timers and mana regeneration.');
