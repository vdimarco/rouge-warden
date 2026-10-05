// Deterministic Monster Mash rules. Rendering and input are separate.
import { BUILDS, hasItem, purchase, sellItem, recalculate, nextPurchase } from './items.js';
import { SIZE, LIMIT, SUDDEN_DEATH, SHIFT, BASES, TOWER_POSITIONS, TOWER_ARC, GUARDIAN_POSITIONS, HUNT, closestTrack, laneFrom, laneMid, pointAtArc, PORTALS, CAMPS, distance, clamp, move, resolveBody, shiftWorld, canSee, visibleTo, lineOfSight, inWater, concealed } from './world.js';
export { SIZE, LIMIT, SUDDEN_DEATH, SHIFT, BASES, LANES, PORTALS, distance } from './world.js';
import { ATTACK_TIMINGS, attackTiming } from './basic-attacks.js';
import { chooseCreature, creatureHash, provokeNeutral, neutralIntent } from '../arcade/creatures/catalog.js';
import { KITS, MAX_LEVEL, xpForLevel, trainSkill, trainBot, cooldownFor } from './abilities.js';
export { trainSkill } from './abilities.js';
import { BASE_HEAL_RADIUS, BASE_STYLES } from './bases.js';
import { NEW_HEROES } from './legends.js';
import { heroClass } from './hero-classes.js';
import { tickSkillEvents } from './skill-events.js';
import { castLegend, tickLegendZone, tickHeroMechanic } from './legend-rules.js';
import { manaCost, manaCapacity, canAfford, canReturn, spellShape, insideWarning } from './combat-rules.js';
import { combatDecision } from './combat-ai.js';
import { noteSkirmish, noteStructureHit, recordKill, callRally, pushPing } from './team-events.js';
import { followOrder } from './navigation.js';
import { structureProtected, LANE_NAMES, TIER_NAMES, INNER, guardians } from './objectives.js';
import { campSprite } from './marketplace-sprites.js';
import { rooted, spellBlocked, castTiming, emitCombatFeedback } from './combat-state.js';
import { tickEncounter } from './encounters.js';
export const HEROES = [
  { name: 'Mothman', slug: 'mothman', role: 'Ambush hunter', note: 'Vanish into the fog. Strike from the unseen.', hp: 1550, speed: 340, range: 150, damage: 126, rate: .62, color: '#e9dca6', sprite: 0 },
  { name: 'Nessie', slug: 'nessie', role: 'River bruiser', note: 'Dive through the river. Pull the fight to you.', hp: 2200, speed: 300, range: 155, damage: 118, rate: .8, color: '#74e6b7', sprite: 1 },
  { name: 'Baba Yaga', slug: 'baba', role: 'Walking fortress', note: 'Your hut has legs. Your traps have teeth.', hp: 1820, speed: 285, range: 360, damage: 94, rate: .8, color: '#edc47c', sprite: 2 },
  { name: 'Jersey Devil', slug: 'devil', role: 'Relentless chaser', note: 'Leap into a brawl. Feed on the fear.', hp: 1690, speed: 365, range: 140, damage: 143, rate: .68, color: '#f6a086', sprite: 3 },
 ...NEW_HEROES,
].map((h,i) => ({ category:['Assassin','Tank','Mage','Fighter'][i]||h.category, attribute:heroClass(i), attackType:h.range>250?'Ranged':'Melee', height:[365,475,360,390][i]||h.height, build:i<4?i:h.build, ...h, skills: KITS[i].map(a=>a.name), labels: KITS[i].map(a=>a.label), descriptions: KITS[i].map(a=>a.description) }));
// Structures by tier: 0 outer, 1 middle, 2 inner, 3 base guardian. Rewards go to the whole team.
export const TIERS = [
  { name: 'Outer ward', hp: 3000, range: 360, damage: 175, rate: 1.05, xp: 120, gold: 150 },
  { name: 'Middle ward', hp: 3800, range: 385, damage: 195, rate: 1.05, xp: 150, gold: 180 },
  { name: 'Inner ward', hp: 4500, range: 410, damage: 215, rate: 1.05, xp: 180, gold: 220 },
  { name: 'Guardian', hp: 4200, range: 420, damage: 230, rate: 1.2, xp: 200, gold: 250 },
];
export const CORE = { hp: 7000, range: 380, damage: 160, rate: 1.1 };
// The guardian slam: a ground circle shows for `tell` seconds, then the guardian is exposed for `recovery` seconds.
export const SLAM = { radius: 230, tell: .8, recovery: 1.4, cooldown: 6, damage: 380 };
// Match rhythm for the 9600 map. Times are in seconds.
export const PACE = { firstWave: 8, waveEvery: 20, minionSpeed: 280, bossFirst: 120, bossEvery: 150, campRespawn: 50, passiveGold: 2.4, portalCooldown: 15, backdoor: .25, suddenRespawn: 1.5 };
// Lane wisps: two melee, one caster that hits from range, and a siege wisp on every third wave.
export const MINIONS = {
  melee: { hp: 390, damage: 45, range: 95, rate: 1 },
  caster: { hp: 300, damage: 55, range: 320, rate: 1.2 },
  siege: { hp: 780, damage: 88, range: 270, rate: 1 },
};
export const respawnTime = (level, sudden = false) => Math.round(Math.min(28, 6 + 1.2 * level) * (sudden ? PACE.suddenRespawn : 1) * 10) / 10;
// Every hero moves by the same rules: out-of-combat sprint, slows, haste effects and Nessie in water.
export function heroSpeed(s, e) {
  const sprint = s.time - e.lastHit > 3 && s.time > e.revealedUntil ? 1.35 : 1;
  return e.speed * sprint * (e.slow > 0 ? .52 : 1) * (e.frenzy > s.time ? 1.25 : 1) * (e.huntUntil > s.time ? 1.2 : 1) * (e.pursuitUntil > s.time ? 1.3 : 1) * (e.hero === 1 && inWater(e, s) ? 1.4 : 1);
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function add(s, data) {
  const e = { id: s.nextId++, hp: 100, maxHp: 100, radius: 22, speed: 0, range: 100, damage: 10, rate: 1, attackCd: 0, hit: 0, shield: 0, stun: 0, slow: 0, fear: 0, lastHit: -100, revealedUntil: -1, facing: -Math.PI / 2, ...data };
  s.units.push(e); return e;
}
function hero(s, team, kind, lane, human = false) {
  // Each hero starts on its lane a short walk behind its outer ward.
  const h = HEROES[kind], front = pointAtArc(laneFrom(team, lane), TOWER_ARC[lane][0] - 220);
  return add(s, { kind: 'hero', team, hero: kind, name: h.name, attribute:h.attribute, manaRegen:0, sprite: kind, x: front.x + (human ? 0 : 36), y: front.y, hp: h.hp, maxHp: h.hp, mana:manaCapacity(h),maxMana:manaCapacity(h), speed: h.speed, range: h.range, damage: h.damage, rate: h.rate, lane, waypoint: 2, player: human, level: 1, xp: 0, gold: 360, kills: 0, deaths: 0, lastHits:0, respawn: 0, cd: [0, 0, 0, 0], skillRanks: [0,0,0,0], skillPoints: 1, haste: 1, inventory: [], build: BUILDS[h.build].id, power: 0, armor: 0, regen: 0, lifesteal: 0, itemState: {}, recall: 0, target: 0, attackAnim: 0, portalCd: 0, cloak: 0, sightUntil: 0, frenzy: 0, ambushReady: false });
}
// A drafted lineup replaces the default picks: { allies:[kit,kit], enemies:[kit,kit,kit] }.
export function createMatch(kind = 0, seed = 49, lineup = null) {
  const s = { time: 0, phase: 0, nextId: 1, units: [], effects: [], missiles: [], zones: [], traps: [], floaters: [], messages: [], random: rng(seed), seed, score: [0, 0], towers: [9, 9], guardians: [2, 2], suddenDeath: false, wave: 0, nextWave: PACE.firstWave, objectiveAt: PACE.bossFirst, objective: null, campTimers: CAMPS.map(() => 0), campRolls: CAMPS.map(() => 0), winner: null, reason: '', stats: { damage: 0, towers: 0, leviathans: 0, ambushes: 0, camps: 0, portals: 0 } };
  for (let team = 0; team < 2; team++) {
    add(s, { kind: 'core', name: BASE_STYLES[team].name, team, ...BASES[team], hp: CORE.hp, maxHp: CORE.hp, radius: 130, sprite: 7, range: CORE.range, damage: CORE.damage, rate: CORE.rate });
    for (let lane = 0; lane < 3; lane++) TOWER_POSITIONS[team][lane].forEach((spot, tier) => {
      const t = TIERS[tier];
      add(s, { kind: 'tower', name: `${t.name} · ${LANE_NAMES[lane]}`, team, lane, tier, ...spot, hp: t.hp, maxHp: t.hp, radius: 42, range: t.range, damage: t.damage, rate: t.rate, sprite: 6 });
    });
    // Two guardians defend the base. They keep kind 'tower' (tier 3) so every renderer draws them as structures.
    GUARDIAN_POSITIONS[team].forEach((spot, side) => { const t = TIERS[3]; add(s, { kind: 'tower', guardian: true, name: `${t.name} · ${side ? 'East' : 'West'}`, team, lane: side ? 2 : 0, tier: 3, ...spot, hp: t.hp, maxHp: t.hp, radius: 48, range: t.range, damage: t.damage, rate: t.rate, sprite: 6 }); });
  }
  const p = hero(s, 0, kind, 1, true); s.playerId = p.id;
  hero(s, 0, lineup?.allies?.[0] ?? (kind + 1) % HEROES.length, 0); hero(s, 0, lineup?.allies?.[1] ?? (kind + 2) % HEROES.length, 2);
  // The roll is always drawn so seeded matches keep the same random sequence.
  for (let lane = 0; lane < 3; lane++) { const roll = (Math.floor(s.random() * HEROES.length) + lane) % HEROES.length; hero(s, 1, lineup?.enemies?.[lane] ?? roll, lane); }
  for (const e of s.units) if (e.kind === 'hero' && !e.player) trainBot(e);
  announce(s, 'Choose your first spell', 'You have one skill point. Basic attacks are always ready.');
  return s;
}
export const player = s => s.units.find(e => e.id === s.playerId);
export function announce(s, title, detail = '') { s.messages.push({ title, detail, time: s.time }); if (s.messages.length > 5) s.messages.shift(); }
function burst(s, x, y, color, radius = 65, type = 'ring') { s.effects.push({ x, y, color, radius, type, life: .7, maxLife: .7 }); }
function reward(s, team, xp, gold, local=null) {
  for (const h of s.units.filter(e => e.kind === 'hero' && e.team === team && (!local || e.hp>0&&distance(e,local)<1200))) {
    h.gold += gold; h.xp += xp;
    while (h.level < MAX_LEVEL && h.xp >= xpForLevel(h.level)) {
      h.xp -= xpForLevel(h.level); h.level++; h.skillPoints++; recalculate(h, HEROES[h.hero]); h.hp = h.hp > 0 ? Math.min(h.maxHp, h.hp + 230) : 0;
      if (h.player) { burst(s, h.x, h.y, '#e3f57b', 140); announce(s, `Level ${h.level}`, h.level === 6 ? 'Your ultimate can now be learned. Spend a skill point.' : 'One skill point earned. Learn or upgrade a spell.'); }
    }
  }
}
function finish(s, winner, reason) { s.winner = winner; s.reason = reason; announce(s, winner === 0 ? 'Legends never die' : 'Lost to the veil', reason); }
export function heal(s, e, amount) { if (e.hp <= 0) return; e.hp = Math.min(e.maxHp, e.hp + amount * (e.woundedUntil > s.time ? .55 : 1)); }
export function damage(s, source, target, amount, kind = 'spell') {
  if (!target || target.hp <= 0 || s.winner !== null) return;
  const credit=source.kind==='summon'?s.units.find(e=>e.id===source.owner):source;
  if (structureProtected(s, target)) { if (source.player && s.time - (s.lockTip ?? -10) > 4) { announce(s, ...lockTip(target)); s.lockTip = s.time; } return; }
  if (target.kind === 'hero' && target.respawn > 0) return;
  if (target.kind === 'camp') {
    if (target.leash) return;
    if (source.team >= 0) provokeNeutral(target, source, s.time);
  }
  if (kind === 'spell') amount += (source.power || 0) * .55;
  if((['boss','camp'].includes(target.kind)||target.guardian)&&target.exposedUntil>s.time){amount*=1.25;emitCombatFeedback(s,source,target,'exposed','OPENING HIT');}
  // Backdoor protection: structures shrug off most hero damage unless the attacker's wave is at the structure.
  if (['tower', 'core'].includes(target.kind) && credit?.kind === 'hero' && !escorted(s, credit.team, target)) {
    amount *= PACE.backdoor;
    if (credit.player && s.time - (s.backdoorTip ?? -10) > 6) { announce(s, 'Ward resists you', 'Structures take little hero damage without your wisps. Push with your wave.'); s.backdoorTip = s.time; }
  }
  const armor = target.armor || 0;
  amount *= armor >= 0 ? 100 / (100 + armor) : 2 - 100 / (100 - armor);
  if(target.scaleGuardUntil>s.time)amount*=.65;
  const shieldMultiplier = kind === 'attack' && hasItem(source, 'reaper') ? 1.5 : 1;
  if (shieldMultiplier > 1) target.woundedUntil = s.time + 4;
  if (target.kind === 'hero' && hasItem(target, 'mirror') && source.kind === 'hero' && s.time >= (target.itemState.mirror || 0)) {
    target.shield += 220; target.itemState.mirror = s.time + 20; burst(s, target.x, target.y, '#b9c9ff', 105);
  }
  const absorbed = Math.min(target.shield, amount * shieldMultiplier); target.shield -= absorbed; amount -= absorbed / shieldMultiplier;
  if(absorbed>0&&target.shield<=0)emitCombatFeedback(s,source,target,'shield-break','SHIELD BROKEN');
  const actual = Math.min(target.hp, amount); target.hp = Math.max(0, target.hp - amount); target.hit = .16; target.hitAngle = Math.atan2(target.y - source.y, target.x - source.x); target.lastHit = s.time; target.revealedUntil = s.time + 2.6;
  if (credit?.player) s.stats.damage += actual;
  if(source.hp>0&&target.soulThread?.source===source.id&&target.soulThread.until>s.time)heal(s,source,actual*.25);
  if(target.hp>0&&target.guardUntil>s.time&&kind==='attack'&&source.hp>0&&source.id!==target.id)damage(s,target,source,(actual+absorbed/shieldMultiplier)*.2,'reflect');
  if (source.hp > 0 && source.frenzy > s.time) heal(s, source, actual * .3);
  if (source.player || target.player || target.kind === 'tower') s.floaters.push({ x: target.x, y: target.y - 55, text: Math.round(amount), color: target.player ? '#ff9b82' : '#fff4c9', life: .8 });
  if (actual > 0 || absorbed > 0) { noteSkirmish(s, credit, target); noteStructureHit(s, credit || source, target); }
  if (target.kind === 'hero' && source.kind === 'hero') for (const t of s.units) if (['tower', 'core'].includes(t.kind) && t.team === target.team && t.hp > 0 && distance(t, source) < t.range) { t.aggro = source.id; t.aggroUntil = s.time + 3; }
  if (source.hp > 0 && kind === 'attack' && source.lifesteal) heal(s, source, actual * source.lifesteal);
  if (target.hp > 0 && target.kind === 'hero' && hasItem(target, 'root') && target.hp < target.maxHp * .35 && s.time >= (target.itemState.root || 0)) {
    target.shield += 300; target.itemState.root = s.time + 35; burst(s, target.x, target.y, '#b8eb91', 120);
  }
  if (target.hp > 0 && kind === 'spell' && source.kind === 'hero' && !['tower', 'core'].includes(target.kind)) {
    if (hasItem(source, 'lantern')) target.burn = { source: source.id, until: s.time + 3, tick: target.burn?.source === source.id ? target.burn.tick : s.time + 1, amount: 28 + source.power * .05 };
    if (hasItem(source, 'frost')) target.slow = Math.max(target.slow, 1.2);
    if (hasItem(source, 'winter')) {
      target.frostMarks ||= {}; const mark = target.frostMarks[source.id] ||= { count: 0, until: 0, ready: 0 };
      if (s.time >= mark.ready) { mark.count = (s.time <= mark.until ? mark.count : 0) + 1; mark.until = s.time + 5;
        if (mark.count >= 3) { target.snaredUntil = Math.max(target.snaredUntil||0, s.time+1); mark.count = 0; mark.ready = s.time + 10; burst(s, target.x, target.y, '#b9e8ff', 130); }
      }
    }
  }
  if (target.hp > 0) return actual;
  if(target.rebirthUntil>s.time){target.rebirthUntil=0;target.hp=target.maxHp*.35;target.shield=140;target.stun=target.fear=target.slow=0;target.snaredUntil=target.silencedUntil=target.disarmedUntil=0;target.bleed=target.burn=null;area(s,target,target,330,260*(target.rebirthStrength||1));burst(s,target.x,target.y,'#ffc16d',330,'ultimate');return actual;}
  emitCombatFeedback(s,source,target,'kill',target.kind==='hero'?'BANISHED':'DEFEATED');
  burst(s, target.x, target.y, target.team === 0 ? '#abf8b2' : '#ff917c', target.kind === 'hero' ? 110 : 70);
  if (target.kind === 'hero') {
    if (source.kind === 'hero' && hasItem(source, 'hunter')) { source.cd[0] = 0; source.cd[3] = Math.max(0, source.cd[3] - 3); }
    target.bloom=null;target.disarmedUntil=0; target.burn = null; target.bleed = null; target.omen = null; target.soulThread=null;target.brineUntil=target.chillUntil=target.spiritUntil=target.guardUntil=target.silencedUntil=target.rebirthUntil=0; target.travel=target.returnAnchor=target.castIntent=null;target.chaseUntil=target.scaleGuardUntil=0; target.wetUntil = 0; target.snaredUntil = 0; target.pursuitUntil = 0; target.frenzy = 0; target.cloak = 0; target.motion = null; target.pendingAttack = null; target.comboNext = 0; target.comboUntil = 0; target.attackStarted = undefined; target.castStarted = undefined; target.woundedUntil = 0; target.frostMarks = {}; target.deaths++; target.respawn = respawnTime(target.level, s.suddenDeath); target.recall = 0; target.ambushReady = false;
    if (source.team >= 0) { s.score[source.team]++; reward(s, source.team, 95, 100); if (credit?.kind === 'hero') credit.kills++; }
    recordKill(s, credit, target);
    if (target.player) announce(s, 'The veil takes you', `Respawn in ${target.respawn} seconds.`);
    else if (credit?.player) announce(s, `${target.name} banished`, '+100 embers · Team experience');
  } else if (target.kind === 'tower') {
    const tier = TIERS[target.tier], ours = target.team === 0;
    if (target.guardian) s.guardians[target.team]--; else s.towers[target.team]--;
    reward(s, source.team, tier.xp, tier.gold); if (source.team === 0) s.stats.towers++;
    if (target.guardian) announce(s, ours ? 'Our guardian has fallen' : 'Enemy guardian down', s.guardians[target.team] ? 'One guardian still protects the rift.' : ours ? 'Our elder rift is exposed. Defend it!' : 'The enemy elder rift is exposed.');
    else announce(s, ours ? 'Our ward has fallen' : 'Enemy ward broken', target.tier < INNER ? `${LANE_NAMES[target.lane]} ${TIER_NAMES[target.tier + 1]} ward is now vulnerable.` : 'The rift guardians are now vulnerable.');
  } else if (target.kind === 'core') finish(s, 1 - target.team, 'The enemy elder rift was destroyed.');
  else if (target.kind === 'boss') {
    reward(s, source.team, 190, 160); s.objectiveAt = s.time + PACE.bossEvery; s.objective = null;
    const lane = source.lane ?? 1;
    add(s, { kind: 'leviathan', name: 'Wild Hunt', team: source.team, ...laneMid(lane), lane, waypoint: 0, hp: 4400, maxHp: 4400, radius: 52, range: 190, damage: 350, rate: 1.2, speed: 180, sprite: 8, creatureId: target.creatureId });
    if (source.team === 0) s.stats.leviathans++;
    announce(s, source.team === 0 ? 'The Wild Hunt rides with us' : 'Enemy claimed the Wild Hunt', 'Escort the great beast to their wardstone.');
  } else if (target.kind === 'camp') {
    reward(s, source.team, 90, 110); s.campTimers[target.camp] = s.time + PACE.campRespawn;
    if (source.kind === 'hero' && source.hp > 0) { heal(s, source, 430); source.huntUntil = s.time + 18; }
    if (source.player) { s.stats.camps++; announce(s, 'Spirit feast', '+110 embers · Healing · 18 seconds of haste'); }
  } else if (target.kind!=='summon'&&source.team >= 0) {
    reward(s,source.team,target.kind==='leviathan'?120:18,target.kind==='leviathan'?100:0,target.kind==='minion'?target:null);
    if(target.kind==='minion'&&credit?.kind==='hero'){credit.gold+=target.siege?65:40;credit.lastHits++;if(credit.player)s.floaters.push({x:target.x,y:target.y-80,text:`+${target.siege?65:40} EMBERS`,color:'#f3d27a',life:1});}
  }
}
// The tip names the structure that must fall first.
function lockTip(t) {
  if (t.kind === 'core') return ['Rift protected', 'Break both rift guardians first.'];
  if (t.guardian) return ['Guardian protected', 'Break an inner ward first.'];
  return [`${TIERS[t.tier].name} protected`, `Break this lane’s ${TIER_NAMES[t.tier - 1]} ward first.`];
}
// A wisp or the Wild Hunt of this team stands at the structure, so heroes may siege it.
export const escorted = (s, team, t) => s.units.some(a => a.team === team && a.hp > 0 && (a.kind === 'minion' || a.kind === 'leviathan') && distance(a, t) < t.range + 150);
function hostile(s, a, b) { return b.hp > 0 && a.id !== b.id && a.team !== b.team && !structureProtected(s, b) && (b.team !== -1 || a.kind === 'hero' || a.team === -1); }
export function cancelOrder(e) { e.order=null;e.orderRoute=null;e.target=0; }
export function commandOrder(s,e,command) {
  cancelOrder(e);
  if(e.hp<=0)return false;
  if(command?.type==='attack'){
    const t=s.units.find(u=>u.id===command.target);
    if(!t||!hostile(s,e,t)||!visibleTo(s,e.team,t)||(t.kind==='camp'&&t.leash))return false;
    e.order={type:'attack',target:t.id};e.target=t.id;if(e.pendingAttack?.target!==t.id)e.pendingAttack=null;
  }else if(command?.type==='move'&&Number.isFinite(command.x)&&Number.isFinite(command.y)){const point={x:command.x,y:command.y,radius:e.radius};resolveBody(s,point);e.order={type:'move',x:point.x,y:point.y};}
  else return false;
  e.recall=0;return true;
}
function nearest(s, a, range, preferHero = false, heroPenalty = 0) {
  let best = null, score = Infinity;
  for (const b of s.units) {
    if (!hostile(s, a, b) || !canSee(s, a, b) || (b.kind === 'camp' && (b.leash || !(b.aggroUntil > s.time)))) continue;
    const d = distance(a, b); if (d > range + b.radius) continue;
    const n = d + (preferHero && b.kind !== 'hero' ? 100 : 0) + (b.kind === 'hero' ? heroPenalty : 0);
    if (n < score) { score = n; best = b; }
  }
  return best;
}
// Stable, sight-aware focus. Walking away never causes an automatic chase.
export function autoTarget(s, e, manual = 0) {
  const candidates = s.units.filter(t => hostile(s, e, t) && distance(e, t) <= e.range + t.radius && canSee(s, e, t) && lineOfSight(s, e, t));
  const chosen = candidates.find(t => t.id === manual); if (chosen) return chosen;
  const active = candidates.filter(t => t.kind !== 'camp' || (!t.leash && t.aggroUntil > s.time));
  const heroes = active.filter(t => t.kind === 'hero'), pool = heroes.length ? heroes : active;
  const previous = pool.find(t => t.id === e.target); if (previous) return previous;
  return pool.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || distance(e, a) - distance(e, b))[0] || null;
}
function attack(s, e, t) {
  if (!t || e.castIntent || e.recoveryUntil>s.time || e.disarmedUntil>s.time || e.attackCd > 0 || distance(e, t) > e.range + t.radius || !canSee(s, e, t) || !lineOfSight(s, e, t)) return;
  if (e.kind === 'hero') {
    if (e.comboTarget !== t.id || s.time > (e.comboUntil || 0)) e.comboNext = 0;
    e.attackVariant = e.comboNext || 0; e.comboTarget = t.id;
  }
  const timing = e.kind==='hero'?attackTiming(e,e.attackVariant||0,s.time):ATTACK_TIMINGS[e.attackVariant||0];
  e.attackWindup = e.kind === 'hero' ? timing.windup : .12;
  e.attackDuration = e.kind === 'hero' ? timing.duration : .46;
  e.attackCd = e.rate * (e.frenzy > s.time ? .48 : 1); e.attackAnim = e.attackDuration; e.attackStarted = s.time; e.facing = Math.atan2(t.y - e.y, t.x - e.x); e.attackFacing = e.facing;
  const ambush = e.ambushReady && t.kind === 'hero';
  if (ambush) { if (e.player) s.stats.ambushes++; s.floaters.push({ x: t.x, y: t.y - 90, text: 'AMBUSH!', color: '#e2fa78', life: 1.2 }); }
  e.ambushReady = false; e.revealedUntil = s.time + 2.6;
  // Attacks grow stronger only in sudden death, and structures never ramp.
  const multiplier = s.suddenDeath && !['tower', 'core'].includes(e.kind) ? 1 + (s.time - SUDDEN_DEATH) / 150 : 1;
  const towerPressure=e.kind==='tower'&&t.kind==='hero'?(e.towerTarget===t.id&&e.towerUntil>s.time?Math.min(4,e.towerHits||0):0):0;
  e.pendingAttack = { target: t.id, at: s.time + e.attackWindup, variant: e.attackVariant || 0, amount: e.damage * multiplier * (ambush ? 1.75 : 1) * (e.kind === 'hero' ? timing.damage : 1)*(1+towerPressure*.22) };
}
function resolveAttack(s, e) {
  const pending = e.pendingAttack; if (!pending || s.time < pending.at) return;
  e.pendingAttack = null;
  const t = s.units.find(u => u.id === pending.target);
  if (!t || t.hp <= 0 || e.hp <= 0 || e.stun > 0 || e.disarmedUntil>s.time || distance(e, t) > e.range + t.radius + 90 || !lineOfSight(s, e, t)) { e.comboNext = 0; e.comboUntil = 0; return; }
  if (e.kind === 'hero') { e.comboNext = (pending.variant + 1) % 3; e.comboUntil = s.time + 2; e.lastBasicHit = s.time; e.lastBasicVariant = pending.variant; }
  if(e.kind==='tower'&&t.kind==='hero'){e.towerHits=e.towerTarget===t.id&&e.towerUntil>s.time?(e.towerHits||0)+1:1;e.towerTarget=t.id;e.towerUntil=s.time+2;}
  damage(s, e, t, pending.amount, 'attack');
  if (e.hero === 0 && t.omen?.source === e.id && t.omen.until > s.time) {
    const omen = t.omen; t.omen = null; if (t.hp > 0) damage(s,e,t,omen.amount);
    emitCombatFeedback(s,e,t,'combo','OMEN');
    e.cloak = s.time + 1.2; e.revealedUntil = -1; e.ambushReady = true;
    s.effects.push({x:t.x,y:t.y,type:'spell',hero:0,slot:2,angle:e.facing,radius:180,life:.7,maxLife:.7});
  }
  if (e.kind === 'hero') {
    const v = e.itemState; v.hits = (v.hits || 0) + 1;
    if (hasItem(e, 'nightfang') && v.empowered > s.time && s.time >= (v.nightfang || 0)) {
      damage(s, e, t, 65 + e.power * .5 + (hasItem(e, 'eclipse') && t.kind === 'hero' ? Math.min(200, (t.maxHp - t.hp) * .08) : 0), 'item'); v.empowered = 0; v.nightfang = s.time + 3; burst(s, t.x, t.y, '#fff2ae', 90);
    }
    if (v.hits % 3 === 0) {
      if (hasItem(e, 'thorn')) damage(s, e, t, Math.min(160, t.maxHp * .03), 'item');
      if (hasItem(e, 'tempest')) damage(s, e, t, 60 + e.power * .2, 'item');
      if (hasItem(e, 'storm')) for (const other of s.units.filter(u => u.id !== t.id && hostile(s, e, u) && distance(t, u) < 300 && canSee(s, e, u)).slice(0, 2)) {
        damage(s, e, other, 60 + e.power * .2, 'item');
        s.effects.push({ type: 'beam', x: t.x, y: t.y, tx: other.x, ty: other.y, color: '#86eaff', life: .35, maxLife: .35 });
      }
    }
    if (hasItem(e, 'starfall') && v.spells >= 3) { v.spells = 0; for (const other of s.units) if (hostile(s, e, other) && distance(t, other) < 240 && lineOfSight(s, t, other)) damage(s, e, other, 160 + e.power * .4, 'item'); burst(s, t.x, t.y, '#cbb1ff', 240, 'ultimate'); }
  }
  s.effects.push({ type: e.kind === 'hero' ? 'strike' : 'beam', hero: e.hero, variant: pending.variant, source: e.id, x: e.x, y: e.y - 20, tx: t.x, ty: t.y - 20, radius: e.range, color: e.team === 0 ? '#e3f88a' : e.team === 1 ? '#ff8875' : '#ecbc74', life: .38, maxLife: .38 });
}
function area(s, e, center, radius, amount, status = {}) {
  for (const t of s.units) if (hostile(s, e, t) && distance(t, center) < radius + t.radius && lineOfSight(s, center, t)) {
    damage(s, e, t, amount);
    if (!['tower', 'core'].includes(t.kind)) Object.assign(t, status, status.fear ? { fearX: e.x, fearY: e.y } : {});
  }
}
export function castTarget(s,e,slot,aim) {
  if(slot===2&&[0,8].includes(e.hero)&&Number.isFinite(aim?.distance)){
    const length=Math.min(540,Math.max(0,aim.distance)),angle=Math.atan2(aim.y,aim.x),point={x:e.x+Math.cos(angle)*length,y:e.y+Math.sin(angle)*length};
    return s.units.filter(t=>!['tower','core'].includes(t.kind)&&hostile(s,e,t)&&canSee(s,e,t)&&distance(e,t)<540&&lineOfSight(s,e,t)&&distance(t,point)<Math.max(140,(t.radius||0)+55)).sort((a,b)=>distance(a,point)-distance(b,point)||a.id-b.id)[0]||null;
  }
  return s.units.find(t=>t.id===e.target&&hostile(s,e,t)&&canSee(s,e,t)&&distance(e,t)<540&&lineOfSight(s,e,t))||nearest(s,e,540,true);
}
export function requestCast(s,e,slot,aim,{bot=false}={}) {
  if(e.kind!=='hero'||![0,1,2,3].includes(slot)||!e.skillRanks[slot]||spellBlocked(s,e,slot)||s.winner!==null||e.castIntent||e.recoveryUntil>s.time)return false;
  if(slot===0&&canReturn(s,e))return cast(s,e,slot,aim);
  if(e.cd[slot]>0||!canAfford(e,slot))return false;
  const target=castTarget(s,e,slot,aim);
  if(slot===2&&[0,8].includes(e.hero)&&(!target||['tower','core'].includes(target.kind)))return false;
  const timing=castTiming(e,slot,bot);
  if(!timing.windup)return cast(s,e,slot,aim);
  const angle=aim&&Math.hypot(aim.x,aim.y)>.1?Math.atan2(aim.y,aim.x):target?Math.atan2(target.y-e.y,target.x-e.x):e.facing;
  const locked={x:Math.cos(angle),y:Math.sin(angle),distance:aim?.distance??(target?distance(e,target):undefined)};
  const shape=slot===2&&[0,8].includes(e.hero)?{x:target.x,y:target.y,radius:target.radius+20,shape:'circle',targetId:target.id}:spellShape(e,slot,locked);
  e.castIntent={slot,aim:locked,target:target?.id,origin:{x:e.x,y:e.y},start:s.time,at:s.time+timing.windup,recovery:timing.recovery,shape};
  e.pendingAttack=null;e.facing=angle;e.revealedUntil=s.time+timing.windup+1;e.recall=0;
  return true;
}
export function cast(s, e, slot, aim, {lockedTarget}={}) {
  if (e.kind !== 'hero' || ![0,1,2,3].includes(slot) || !e.skillRanks[slot] || spellBlocked(s,e,slot) || s.winner !== null) return false;
  if(slot===0&&canReturn(s,e)){const from={x:e.x,y:e.y},anchor=e.returnAnchor;e.x=anchor.x;e.y=anchor.y;resolveBody(s,e);e.returnAnchor=null;e.recall=0;e.motion={...from,start:s.time,duration:.25,arc:65};burst(s,e.x,e.y,'#ffba83',180);return true;}
  if(e.cd[slot]>0||!canAfford(e,slot))return false;
  const target = lockedTarget || castTarget(s,e,slot,aim);
  if (slot === 2 && e.hero === 0 && (!target || ['core','tower'].includes(target.kind))) return false;
  if (slot === 2 && e.hero === 8 && (!target || ['core','tower'].includes(target.kind))) return false;
  const angle = aim && Math.hypot(aim.x,aim.y) > .1 ? Math.atan2(aim.y,aim.x) : target ? Math.atan2(target.y-e.y,target.x-e.x) : e.facing;
  const rank = e.skillRanks[slot], strength = 1 + (rank-1)*.28;
  e.mana-=manaCost(e,slot);e.recall = 0; e.cd[slot] = cooldownFor(e,slot); e.facing = angle; e.attackAnim = .42; e.attackStarted = s.time; e.castStarted = s.time; e.castSlot = slot; e.castFacing = angle; e.itemState.empowered = s.time+5;
  e.itemState.spells = Math.min(3,(e.itemState.spells||0)+1);
  if (slot === 3 && hasItem(e,'worldroot') && s.time >= (e.itemState.worldroot||0)) {
    e.itemState.worldroot = s.time+18;
    for (const ally of s.units) if (ally.kind === 'hero' && ally.team === e.team && ally.hp > 0 && distance(e,ally)<450) { ally.shield += e.maxHp*.15; burst(s,ally.x,ally.y,'#c8f9bc',110); }
  }
  const color = HEROES[e.hero].color, origin = {x:e.x,y:e.y};
  const fx = (point,radius=280) => s.effects.push({...point,type:'spell',hero:e.hero,source:e.id,slot,angle,rank,radius,color,life:slot===3?1:.65,maxLife:slot===3?1:.65});
  const cone = (range,width,hit) => { for (const t of s.units) if (hostile(s,e,t) && distance(e,t)<range+t.radius && lineOfSight(s,e,t)) {
    const a=Math.atan2(t.y-e.y,t.x-e.x), delta=Math.atan2(Math.sin(a-angle),Math.cos(a-angle)); if(Math.abs(delta)<=width) hit(t,a);
  }};
  if(e.hero>=4) return castLegend({s,e,slot,aim,target,angle,rank,strength,origin,color,fx,cone,damage,heal,area,hostile,spawn:data=>add(s,{...data,creatureId:chooseCreature(s.seed,`sentinel:${e.id}`,'neutral').id})});
  if (slot === 0) {
    const length=[490,410,330,460][e.hero]+(rank-1)*25;
    e.x+=Math.cos(angle)*length; e.y+=Math.sin(angle)*length; resolveBody(s,e);
    e.motion={...origin,start:s.time,duration:.38,arc:[95,30,160,130][e.hero]};
    s.effects.push({...origin,tx:e.x,ty:e.y,color,type:'beam',hero:e.hero,life:.45,maxLife:.45}); fx(e,160);
    if(e.hero===0) {e.cloak=s.time+2+(rank-1)*.35;e.revealedUntil=-1;e.ambushReady=true;}
    if(e.hero===1) {heal(s,e,190*strength);s.zones.push({...origin,team:e.team,source:e.id,rank,radius:180,life:5,tick:0,type:'water',amount:30*strength});}
    if(e.hero===2) e.shield=Math.max(e.shield,380*strength);
    if(e.hero===3) area(s,e,e,160,180*strength,{stun:.65});
  } else if(slot===1) {
    fx(origin,e.hero===1?440:300);
    if(e.hero===0) cone(360,1.05,t=>{damage(s,e,t,205*strength);if(!['core','tower'].includes(t.kind))t.slow=2+rank*.3;});
    if(e.hero===1) cone(440,1,t=>{damage(s,e,t,210*strength); if(!['core','tower'].includes(t.kind)) {const a=Math.atan2(t.y-e.y,t.x-e.x);t.x=e.x+Math.cos(a)*95;t.y=e.y+Math.sin(a)*95;t.slow=2;t.wetUntil=s.time+5;resolveBody(s,t);}});
    if(e.hero===2) {const reach=Math.min(290,aim?.distance??290),point={x:e.x+Math.cos(angle)*reach,y:e.y+Math.sin(angle)*reach,radius:20};resolveBody(s,point);s.traps.push({...point,rank,team:e.team,source:e.id,life:16,armed:s.time+.5});}
    if(e.hero===3) for(const t of s.units) if(hostile(s,e,t)&&distance(e,t)<300&&lineOfSight(s,e,t)) {damage(s,e,t,145*strength);if(!['core','tower'].includes(t.kind)) {t.fear=t.bleed?.until>s.time?2.2:1.1;t.fearX=e.x;t.fearY=e.y;}}
  } else if(slot===2) {
    if(e.hero===0) {target.omen={source:e.id,until:s.time+5+rank,amount:170*strength};target.revealedUntil=s.time+5+rank;fx(target,160);}
    if(e.hero===1) {fx(origin,350);cone(350,1.25,(t,a)=>{const wet=t.wetUntil>s.time||inWater(t,s);damage(s,e,t,220*strength);if(!['core','tower'].includes(t.kind)){t.x+=Math.cos(a)*220;t.y+=Math.sin(a)*220;if(wet){t.stun=.8+rank*.15;emitCombatFeedback(s,e,t,'combo','WET STUN');}resolveBody(s,t);}});}
    if(e.hero===2) {const point=aim?{x:e.x+Math.cos(angle)*Math.min(380,aim.distance??380),y:e.y+Math.sin(angle)*Math.min(380,aim.distance??380)}:target?{x:target.x,y:target.y}:{x:e.x+Math.cos(angle)*380,y:e.y+Math.sin(angle)*380};point.x=clamp(point.x,180,SIZE-180);point.y=clamp(point.y,180,SIZE-180);s.zones.push({...point,source:e.id,team:e.team,rank,radius:190,life:4.7,tick:.7,armed:s.time+.7,type:'witchfire',amount:80*strength});fx(point,190);s.effects.push({...origin,tx:point.x,ty:point.y,type:'mortar',hero:2,life:.7,maxLife:.7,color});}
    if(e.hero===3) {fx(origin,310);cone(310,1,t=>{damage(s,e,t,130*strength);if(!['core','tower'].includes(t.kind))t.bleed={source:e.id,until:s.time+4,tick:s.time+.8,amount:36*strength};});e.pursuitUntil=s.time+3;}
  } else {
    fx(origin,e.hero===1?460:380);
    if(e.hero===0){area(s,e,e,340,340*strength,{fear:1.2});e.cloak=s.time+6;e.sightUntil=s.time+6;e.revealedUntil=-1;e.ambushReady=true;}
    if(e.hero===1){s.zones.push({...origin,source:e.id,team:e.team,rank,radius:460,life:7,tick:0,type:'maelstrom',amount:55*strength});}
    if(e.hero===2)s.zones.push({...origin,source:e.id,team:e.team,rank,radius:210,life:2.5,tick:0,pulses:0,type:'stomp',amount:180*strength});
    if(e.hero===3){e.frenzy=s.time+8+(rank-1);e.shield=Math.max(e.shield,250*strength);}
  }
  return true;
}
export function portal(s, e = player(s)) {
  if (e.hp <= 0 || e.stun > 0 || e.fear > 0 || rooted(s,e) || e.castIntent || e.recoveryUntil>s.time || e.portalCd > 0 || s.winner !== null) return false;
  const gate = PORTALS.find(g => distance(e, g) < 150); if (!gate) return false;
  // A base gate picks the river gate on the side the hero faces.
  const toward = i => Math.cos(Math.atan2(PORTALS[i].y - gate.y, PORTALS[i].x - gate.x) - e.facing);
  const to = PORTALS[gate.choices ? [...gate.choices].sort((a, b) => toward(b) - toward(a))[0] : gate.to]; burst(s, e.x, e.y, '#c1f4ed', 180, 'ultimate'); e.x = to.x; e.y = to.y; e.portalCd = PACE.portalCooldown; e.recall = 0; resolveBody(s, e); burst(s, e.x, e.y, '#c1f4ed', 180);
  if (e.player) { s.stats.portals++; announce(s, 'Through the looking glass', 'You crossed the map. Find your ambush.'); } return true;
}
export function buy(s, id, e = player(s)) { return s.winner === null && purchase(e, id, HEROES[e.hero]); }
export function sell(s, slot, e = player(s)) { return s.winner === null && sellItem(e, slot, HEROES[e.hero]); }
export function setBuild(s, id) { const e = player(s); if (!BUILDS.some(b => b.id === id)) return false; e.build = id; e.goal = null; return true; }
export function setGoal(s, id) { player(s).goal = id; }
function itemTick(s, e, dt) {
  if (e.burn && e.hp > 0 && e.burn.tick <= s.time) {
    const source = s.units.find(v => v.id === e.burn.source);
    if (source && s.time <= e.burn.until + dt) damage(s, source, e, e.burn.amount * (e.slow > 0 ? hasItem(source, 'inferno') ? 1.6 : hasItem(source, 'frost') ? 1.35 : 1 : 1), 'item');
    if (e.burn) e.burn.tick += 1;
  }
  if (e.burn && e.burn.until < s.time) e.burn = null;
  if (e.kind !== 'hero' || e.hp <= 0) return;
  heal(s, e, e.regen * dt);
  const v = e.itemState;
  if (s.time >= (v.aura || 0)) {
    v.aura = s.time + 1;
    if (hasItem(e, 'grave')) for (const t of s.units) if (hostile(s, e, t) && distance(e, t) < 220 && lineOfSight(s, e, t)) damage(s, e, t, 24 + (hasItem(e, 'colossus') ? e.maxHp * .01 : 0), 'item');
    if (hasItem(e, 'beacon')) for (const t of s.units) if (t.kind === 'hero' && t.team === e.team && t.hp > 0 && distance(e, t) < 300) heal(s, t, 24 + (hasItem(e, 'root') ? e.maxHp * .01 : 0));
  }
}
// Every wave leaves the base. Melee wisps lead, the caster follows, and the siege wisp walks last.
function spawnWave(s) {
  s.wave++;
  const roles = s.wave % 3 === 0 ? ['melee', 'melee', 'caster', 'siege'] : ['melee', 'melee', 'caster'];
  for (let team = 0; team < 2; team++) for (let lane = 0; lane < 3; lane++) roles.forEach((role, i) => {
    const path = laneFrom(team, lane), spot = pointAtArc(path, 320 - i * 45), m = MINIONS[role], siege = role === 'siege';
    add(s, { kind: 'minion', role, team, lane, x: spot.x + (i % 2 ? 18 : -18), y: spot.y, waypoint: closestTrack(spot, path), hp: m.hp, maxHp: m.hp, damage: m.damage, rate: m.rate, range: m.range, speed: PACE.minionSpeed, radius: 16, sprite: team ? 5 : 4, siege, caster: role === 'caster', creatureId: chooseCreature(s.seed, `wave:${s.wave}:lane:${lane}:slot:${i}`, siege ? 'siege' : 'lane').id });
  });
}
function followLane(s, e, dt) {
  const path = laneFrom(e.team, e.lane);
  // Rejoin the closest piece of the curved lane after a chase or teleport.
  const index = closestTrack(e, path);
  e.waypoint = index;
  if (e.kind !== 'hero') { const ahead = path[Math.min(path.length - 1, index + 2)]; move(s, e, ahead.x, ahead.y, dt, e.speed * (e.slow > 0 ? .52 : 1)); return; }
  // A hero walks with its wave: never more than a few steps past the leading wisp, and never into an
  // enemy structure's range that no wisp of its own team tanks. Without a wave it waits at its front ward.
  let limit = -1;
  for (const m of s.units) if (m.team === e.team && m.lane === e.lane && m.hp > 0 && (m.kind === 'minion' || m.kind === 'leviathan')) limit = Math.max(limit, m.waypoint + 3);
  if (limit < 0) limit = Math.max(4, ...s.units.filter(t => t.kind === 'tower' && !t.guardian && t.team === e.team && t.lane === e.lane && t.hp > 0).map(t => closestTrack(t, path) + 4));
  let goal = Math.min(path.length - 1, index + 2, limit);
  const threats = s.units.filter(t => (t.kind === 'tower' || t.kind === 'core') && t.team !== e.team && t.hp > 0 && distance(t, e) < 1500 && !escorted(s, e.team, t));
  const unsafe = p => threats.some(t => distance(t, p) < t.range + 70);
  while (goal > 0 && unsafe(path[goal])) goal--;
  const target = path[goal];
  if (unsafe(e)) { const back = path[Math.max(0, index - 3)]; move(s, e, back.x, back.y, dt, heroSpeed(s, e)); }
  else if (distance(e, target) > 30) move(s, e, target.x, target.y, dt, heroSpeed(s, e));
}
function bot(s, e, dt) {
  if(e.castIntent||e.recoveryUntil>s.time)return;
  const intent=combatDecision(s,e),previous=e.botMode;e.botMode=intent.mode;
  // Mode changes become team pings, so teammates can be heard and seen on the map.
  if(intent.mode==='assist'&&previous!=='assist'&&s.time-(e.assistPingAt??-99)>10){e.assistPingAt=s.time;pushPing(s,{team:e.team,type:'onmyway',x:intent.move.x,y:intent.move.y,source:e.id,call:intent.call});}
  if(intent.mode==='retreat'&&previous!=='retreat'&&s.time-(e.retreatPingAt??-99)>12){e.retreatPingAt=s.time;pushPing(s,{team:e.team,type:'retreat',x:e.x,y:e.y,source:e.id});}
  e.retreat=intent.mode==='retreat';
  if(intent.mode==='retreat'){
    if(s.time-e.lastHit>3){e.botRecall=(e.botRecall||0)+dt;if(e.botRecall>2.5){Object.assign(e,BASES[e.team]);e.botRecall=0;e.waypoint=1;}}
  }else e.botRecall=0;
  if(intent.target)e.target=intent.target.id;
  if(intent.slot!==undefined){
    requestCast(s,e,intent.slot,intent.aim,{bot:true});
    e.thinkAt=s.time+1.1;
  }
  if(e.castIntent)return;
  if(intent.move)move(s,e,intent.move.x,intent.move.y,dt,heroSpeed(s,e));
  if(intent.target)attack(s,e,intent.target);
  if(intent.mode==='lane'&&!baseGate(s,e,dt))followLane(s,e,dt);
}
// A side-lane bot leaving its base takes the base gate when its wave has already passed the river gate.
function baseGate(s,e,dt){
  const gate=PORTALS.find(g=>g.base===e.team);
  if(!gate||e.lane===1||e.portalCd>0||distance(e,BASES[e.team])>1300)return false;
  const exit=PORTALS[gate.choices.find(i=>Math.sign(PORTALS[i].x-gate.x)===(e.lane?1:-1))],path=laneFrom(e.team,e.lane),front=Math.max(-1,...s.units.filter(m=>m.kind==='minion'&&m.team===e.team&&m.lane===e.lane&&m.hp>0).map(m=>m.waypoint));
  if(!exit||front<closestTrack(exit,path)-6)return false;
  e.facing=Math.atan2(exit.y-gate.y,exit.x-gate.x);
  if(distance(e,gate)<140)return portal(s,e);
  move(s,e,gate.x,gate.y,dt,heroSpeed(s,e));return true;
}
function resolveIntent(s,e){
 const intent=e.castIntent;if(!intent)return;
 if(spellBlocked(s,e,intent.slot)||intent.origin&&distance(e,intent.origin)>8){e.castIntent=null;if(e.hp>0)emitCombatFeedback(s,e,e,'interrupt','INTERRUPTED');return;}
 const t=s.units.find(t=>t.id===intent.target);
 if(intent.shape.targetId&&t){intent.shape.x=t.x;intent.shape.y=t.y;}
 if(s.time<intent.at)return;
 e.castIntent=null;
 if(intent.slot===2&&[0,8].includes(e.hero)&&(!t||t.hp<=0||!canSee(s,e,t)||!lineOfSight(s,e,t)||distance(e,t)>=540))return;
 e.target=intent.target||0;if(cast(s,e,intent.slot,intent.aim,{lockedTarget:intent.shape.targetId?t:undefined}))e.recoveryUntil=s.time+(intent.recovery||0);
}
function terrainEffects(s, dt) {
  for (const z of s.zones) {
    z.life-=dt;z.tick-=dt;const source=s.units.find(e=>e.id===z.source);
    if(z.follow&&source){z.x=source.x;z.y=source.y;if(source.hp<=0||z.type==='sunray'&&(source.stun>0||source.fear>0||source.silencedUntil>s.time))z.life=0;}
    if(!source||z.life<=0||s.time<(z.armed||0)||z.tick>0)continue;
    z.tick=z.type==='stomp'?.8:.6;
    if(z.legend){tickLegendZone({s,z,source,damage,heal,hostile});continue;}
    if(z.type==='stomp') {if(z.pulses>=3)continue;z.radius=210+z.pulses*80;z.pulses++;area(s,source,z,z.radius,z.amount,{stun:.45});s.effects.push({...z,type:'spell',hero:2,slot:3,life:.65,maxLife:.65});}
    else for(const t of s.units) if(t.hp>0&&distance(t,z)<z.radius+t.radius&&lineOfSight(s,z,t)) {
      if(hostile(s,source,t)) {
        const rooted=t.snaredUntil>s.time;
        damage(s,source,t,(z.amount||38)*(z.type==='witchfire'&&rooted?1.6:1));
        if(z.type==='witchfire'&&rooted){z.comboHitIds||=[];if(!z.comboHitIds.includes(t.id)){z.comboHitIds.push(t.id);emitCombatFeedback(s,source,t,'combo','ROOT BONUS');}}
        if(!['core','tower'].includes(t.kind)) {t.slow=1;if(z.type==='water'||z.type==='maelstrom')t.wetUntil=s.time+2;
          if(z.type==='maelstrom'){const d=distance(t,z);if(d>45){t.x+=(z.x-t.x)/d*24;t.y+=(z.y-t.y)/d*24;resolveBody(s,t);}}
        }
      } else if(z.type==='maelstrom'&&t.kind==='hero'&&t.team===z.team)heal(s,t,45*(1+(z.rank-1)*.28));
    }
  }
  s.zones = s.zones.filter(z => z.life > 0);
  for (const t of s.traps) {
    t.life -= dt; if (s.time < t.armed) continue;
    const source = s.units.find(e => e.id === t.source), enemy = s.units.find(e => e.hp > 0 && e.team !== t.team && e.team >= 0 && !['core', 'tower'].includes(e.kind) && distance(e, t) < 95);
    if (source && enemy) { area(s,source,t,145,260*(1+((t.rank||1)-1)*.28),{snaredUntil:s.time+2.5}); burst(s, t.x, t.y, '#dceb80', 145); t.life = 0; }
  }
  s.traps = s.traps.filter(t => t.life > 0);
}
export function step(s, input = {}, dt = 1 / 60) {
  if (s.winner !== null) return;
  dt = clamp(dt, 0, .05); s.time += dt;
  s.effects.forEach(e => e.life -= dt); s.effects = s.effects.filter(e => e.life > 0);
  s.floaters.forEach(e => { e.life -= dt; e.y -= dt * 26; }); s.floaters = s.floaters.filter(e => e.life > 0);
  if (shiftWorld(s)) announce(s, s.phase ? 'The woods swallow the town' : 'The town returns', s.phase ? 'Vision shrinks. Hide in brush for a 75% ambush strike.' : 'Streets reopen. Buildings block sight and movement.');
  if (s.time >= s.nextWave) { spawnWave(s); s.nextWave += PACE.waveEvery; }
  if (!s.suddenDeath && s.time >= SUDDEN_DEATH) { s.suddenDeath = true; announce(s, 'Sudden death', 'Every ward and both rifts are open. Deaths last longer and attacks grow stronger.'); }
  if (!s.objective && s.time >= s.objectiveAt) {
    const boss = add(s, { kind: 'boss', name: 'Wild Hunt', team: -1, ...HUNT, homeX: HUNT.x, homeY: HUNT.y, hp: 3300, maxHp: 3300, damage: 95, range: 200, speed: 125, rate: 1.2, sprite: 8, radius: 55, creatureId: chooseCreature(s.seed, `boss:${Math.floor(s.time)}`, 'boss').id });
    s.objective = boss.id; announce(s, 'The Wild Hunt awakens', 'Slay the great beast. It will fight for your team.');
  }
  for (let i = 0; i < CAMPS.length; i++) if (s.time >= s.campTimers[i] && !s.units.some(e => e.kind === 'camp' && e.camp === i && e.hp > 0)) {
    const roll = s.campRolls[i]++, key = `camp:${i}:${roll}`, creature = chooseCreature(s.seed, key, 'neutral');
    const spot = { x: CAMPS[i].x + creatureHash(s.seed, key + ':x') % 121 - 60, y: CAMPS[i].y + creatureHash(s.seed, key + ':y') % 121 - 60, radius: 30 };
    resolveBody(s, spot);
    const artwork=campSprite(i,roll);
    add(s, { kind: 'camp', name: artwork.name, marketplaceSprite:artwork.id, team: -1, camp: i, ...spot, homeX: spot.x, homeY: spot.y, hp: 960, maxHp: 960, damage: 55, range: 170, speed: 120, rate: 1.1, sprite: i ? 9 : 10, creatureId: creature.id, aggro: 0, aggroUntil: 0 });
  }
  tickSkillEvents(s,dt,{damage,heal,hostile});
  terrainEffects(s, dt);
  for (const e of [...s.units]) {
    for (const key of ['attackCd', 'attackAnim', 'hit', 'stun', 'slow', 'fear']) e[key] = Math.max(0, (e[key] || 0) - dt);
    if(e.hp>0 && e.bleed?.until>s.time && s.time>=e.bleed.tick) {const source=s.units.find(t=>t.id===e.bleed.source);e.bleed.tick+=.8;if(source)damage(s,source,e,e.bleed.amount);}
    e.moving = false; itemTick(s, e, dt); resolveAttack(s, e);
    if(e.kind==='summon'){
      e.life-=dt;if(e.life<=0){e.hp=0;continue;}
      if(e.hp>0&&s.time>=e.healAt){e.healAt=s.time+1;for(const a of s.units)if(a.kind==='hero'&&a.team===e.team&&a.hp>0&&distance(e,a)<260)heal(s,a,e.healing);}
    }
    if (e.kind === 'hero') {
      e.cd = e.cd.map(c => Math.max(0, c - dt)); e.portalCd = Math.max(0, e.portalCd - dt); e.gold += dt * PACE.passiveGold;
      if(!e.player||input.autopilot)trainBot(e);
      if ((!e.player || input.autopilot) && s.time >= (e.nextShop || 0)) { const id = nextPurchase(e); if (id) buy(s, id, e); e.nextShop = s.time + 2; }
      if (e.hp <= 0) {
        cancelOrder(e);e.respawn -= dt;
        if (e.respawn <= 0) { Object.assign(e, BASES[e.team]); e.hp = e.maxHp;e.mana=e.maxMana; e.shield = 140; e.waypoint = 1; e.cd = [0,0,0,Math.min(6,e.cd[3])]; e.cloak = 0; e.revealedUntil = -1; if (e.player) announce(s, 'A legend returns', 'Leave the rift or take a portal to rejoin the hunt.'); }
        continue;
      }
      if (distance(e, BASES[e.team]) < BASE_HEAL_RADIUS) heal(s, e, e.maxHp * .24 * dt);
      else if (s.time - e.lastHit > 5) heal(s, e, 12 * dt);
      e.mana=Math.min(e.maxMana,e.mana+dt*(distance(e,BASES[e.team])<BASE_HEAL_RADIUS?e.maxMana*.3:6+e.level*.35+(e.manaRegen||0)));
      e.shield = Math.max(0, e.shield - dt * 13);
      if (concealed(s, e)) e.ambushReady = true;
      else if (e.cloak <= s.time && !concealed(s, e)) e.ambushReady = false;
      resolveIntent(s,e);
      if (e.stun > 0) {e.travel=null;continue;}
      if (e.fear > 0) {e.travel=null; move(s, e, e.x + (e.x - e.fearX), e.y + (e.y - e.fearY), dt, e.speed * .8); continue; }
      if(tickHeroMechanic({s,e,dt,damage,heal,hostile})){if(e.player&&input.cast!==undefined)requestCast(s,e,input.cast,input.aim);continue;}
      if (!e.player || input.autopilot) { bot(s, e, dt); continue; }
      if(input.order)commandOrder(s,e,input.order);
      const dx = input.x || 0, dy = input.y || 0, moving = Math.hypot(dx, dy) > .12;
      if(moving||input.stop||input.recall||input.portal)cancelOrder(e);
      if (moving) {
        const mag = Math.max(1, Math.hypot(dx, dy));
        move(s, e, e.x + dx / mag * 250, e.y + dy / mag * 250, dt, heroSpeed(s, e)); e.recall = 0;
      }
      if (input.portal) portal(s, e);
      if (input.rally) callRally(s, e.team, input.rally === true ? e : input.rally, e);
      if (input.recall && !e.recall) e.recall = 2.5;
      if (e.recall > 0) {
        if (moving || s.time - e.lastHit < .2) e.recall = 0;
        else { e.recall -= dt; if (e.recall <= 0) { Object.assign(e, BASES[0]); burst(s, e.x, e.y, '#e4f5ac', 180); } }
      }
      if (input.cast !== undefined) requestCast(s, e, input.cast, input.aim);
      if (!e.recall) {
        let ordered=null;
        if(e.order?.type==='attack'){
          ordered=s.units.find(t=>t.id===e.order.target&&hostile(s,e,t)&&visibleTo(s,e.team,t)&&!(t.kind==='camp'&&t.leash));
          if(!ordered)cancelOrder(e);
        }
        if(e.order){
          const destination=ordered||e.order;
          const inRange=ordered&&distance(e,ordered)<=e.range+ordered.radius-8&&lineOfSight(s,e,ordered);
          if(!inRange){const next=followOrder(s,e,destination,dt);if(next)move(s,e,next.x,next.y,dt,heroSpeed(s,e));}
          if(e.order.type==='move'&&distance(e,e.order)<10)cancelOrder(e);
        }
        const t = ordered||autoTarget(s, e, input.target); e.target = t?.id || 0;
        if (input.attack !== false) attack(s, e, t);
      }
    } else {
      if (e.hp <= 0 || e.stun > 0) {e.specialIntent=null;e.exposedUntil=0;continue;}
      if (e.fear > 0) {e.specialIntent=null;e.exposedUntil=0;e.nextSpecial=Math.max(e.nextSpecial||0,s.time+1.5);if(e.speed>0)move(s, e, e.x + e.x - e.fearX, e.y + e.y - e.fearY, dt);continue;}
      if (e.kind === 'tower' || e.kind === 'core') {
        if (e.guardian && guardianSlam(s, e)) continue;
        const tracked=s.units.find(t=>t.id===e.towerTarget);
        if(!tracked||tracked.hp<=0||distance(e,tracked)>e.range||!canSee(s,e,tracked)){e.towerTarget=0;e.towerHits=0;e.towerUntil=0;}
        let t = s.units.find(x => x.id === e.aggro && s.time < e.aggroUntil && x.hp > 0 && distance(e, x) < e.range && canSee(s, e, x));
        if (!t) t = s.units.filter(x => x.team !== e.team && x.team !== -1 && x.hp > 0 && distance(e, x) < e.range && canSee(s, e, x) && !['tower', 'core'].includes(x.kind)).sort((a, b) => (a.kind === 'hero') - (b.kind === 'hero') || distance(e, a) - distance(e, b))[0];
        attack(s, e, t);
      } else if(e.kind==='summon'){
        attack(s,e,nearest(s,e,e.range));
      } else if (e.kind === 'camp') {
        // Neutral guardians retaliate against the attacker. Auto attacks leave resting camps alone.
        const t = s.units.find(u => u.id === e.aggro), intent = neutralIntent(e, t, s.time);
        if (intent.mode === 'return' || intent.mode === 'reset') {
          e.leash = true; e.pendingAttack = null; e.attackAnim = 0;e.specialIntent=null;e.exposedUntil=0;
          move(s, e, intent.x, intent.y, dt, e.speed * 1.5);
          e.hp = Math.min(e.maxHp, e.hp + dt * 240);
          if (intent.mode === 'reset') { e.leash = false; e.aggro = 0; e.aggroUntil = 0; e.hp = e.maxHp; }
        } else if (intent.mode === 'fight') {
          if(tickEncounter(s,e,dt,{damage}))continue;
          attack(s, e, t); if (distance(e, t) > e.range) move(s, e, intent.x, intent.y, dt, e.speed * (e.slow > 0 ? .52 : 1));
        }
      } else if (e.team === -1) {
        const home = { x: e.homeX, y: e.homeY }, t = nearest(s, e, 330);
        if (distance(e, home) > 390) e.leash = true;
        if (e.leash) { e.specialIntent=null;e.exposedUntil=0;move(s, e, home.x, home.y, dt, e.speed * 1.5); e.hp = Math.min(e.maxHp, e.hp + dt * 150); if (distance(e, home) < 20) e.leash = false; }
        else if(tickEncounter(s,e,dt,{damage}))continue;
        else if (t) { attack(s, e, t); if (distance(e, t) > e.range) move(s, e, t.x, t.y, dt); }
        else move(s, e, home.x, home.y, dt);
      } else {
        // Wisps fight wisps first; a hero is a target only when no wisp or structure is close.
        const t = nearest(s, e, e.range + 140, false, 260);
        if (t) { if (distance(e, t) > e.range + t.radius) move(s, e, t.x, t.y, dt, e.speed * (e.slow > 0 ? .5 : 1)); attack(s, e, t); } else followLane(s, e, dt);
      }
    }
  }
  const bodies = s.units.filter(e => e.hp > 0 && e.speed > 0);
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j], d = distance(a, b), min = (a.radius + b.radius) * .78;
    if (d > .01 && d < min) { const f = (min - d) * .12, x = (a.x - b.x) / d * f, y = (a.y - b.y) / d * f; a.x += x; a.y += y; b.x -= x; b.y -= y; resolveBody(s, a); resolveBody(s, b); }
  }
  s.units = s.units.filter(e => e.hp > 0 || ['hero', 'tower', 'core'].includes(e.kind));
  if (s.time >= LIMIT && s.winner === null) {
    // Tiebreak: structures broken, then structure health left, then hero kills.
    const broken = team => s.units.filter(e => e.team === 1 - team && e.kind === 'tower' && e.hp <= 0).length;
    const health = team => Math.round(s.units.filter(e => e.team === team && ['core', 'tower'].includes(e.kind)).reduce((v, e) => v + e.hp, 0));
    const rules = [[broken, 'The team that broke more structures wins.'], [health, 'The team with more structure health wins.'], [team => s.score[team], 'The team with more kills wins.']];
    const rule = rules.find(([f]) => f(0) !== f(1));
    finish(s, rule ? (rule[0](0) > rule[0](1) ? 0 : 1) : -1, `Time is up. ${rule ? rule[1] : 'The shore is even.'}`);
  }
}
// The guardian slam: a circle on the ground under a hero (or a packed wave) shows before impact.
// After the slam the guardian stays exposed: it does not attack and takes extra damage.
function guardianSlam(s, e) {
  const intent = e.specialIntent;
  if (intent) {
    e.pendingAttack = null;
    if (s.time < intent.at) return true;
    e.specialIntent = null; e.exposedUntil = s.time + SLAM.recovery; e.nextSpecial = s.time + SLAM.cooldown; e.attackCd = Math.max(e.attackCd, SLAM.recovery);
    for (const t of s.units) if (t.hp > 0 && t.team !== e.team && t.team >= 0 && !['tower', 'core'].includes(t.kind) && insideWarning(t, intent.shape)) damage(s, e, t, intent.amount * (t.kind === 'hero' ? 1 : .6), 'spell');
    s.effects.push({ ...intent.shape, type: 'neutral-impact', source: e.id, life: .45, maxLife: .45, color: '#ffbb78' });
    return true;
  }
  if (e.exposedUntil > s.time) { e.pendingAttack = null; return true; }
  if (s.time < (e.nextSpecial ?? 0) || structureProtected(s, e)) return false;
  const foes = s.units.filter(t => t.hp > 0 && t.team !== e.team && t.team >= 0 && !['tower', 'core'].includes(t.kind) && distance(e, t) < e.range + t.radius && canSee(s, e, t));
  const target = foes.filter(t => t.kind === 'hero').sort((a, b) => distance(e, a) - distance(e, b) || a.id - b.id)[0] || foes.find(t => foes.filter(o => distance(o, t) < SLAM.radius).length >= 3);
  if (!target) return false;
  e.specialIntent = { shape: { x: target.x, y: target.y, radius: SLAM.radius, shape: 'circle' }, start: s.time, at: s.time + SLAM.tell, label: 'Guardian · Rift slam', amount: SLAM.damage, recovery: SLAM.recovery };
  e.facing = Math.atan2(target.y - e.y, target.x - e.x); e.pendingAttack = null;
  return true;
}
