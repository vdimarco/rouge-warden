// Deterministic Monster Mash rules. Rendering and input are separate.
import { BUILDS, hasItem, purchase, sellItem, recalculate, nextPurchase } from './items.js';
import { SIZE, LIMIT, SHIFT, BASES, LANES, PATHS, closestTrack, PORTALS, CAMPS, distance, clamp, move, resolveBody, shiftWorld, canSee, lineOfSight, inWater, concealed } from './world.js';
export { SIZE, LIMIT, SHIFT, BASES, LANES, PORTALS, distance } from './world.js';
import { ATTACK_TIMINGS } from './basic-attacks.js';
import { chooseCreature, creatureHash, provokeNeutral, neutralIntent } from '../arcade/creatures/catalog.js';
import { KITS, MAX_LEVEL, xpForLevel, trainSkill, trainBot, cooldownFor } from './abilities.js';
export { trainSkill } from './abilities.js';
import { BASE_HEAL_RADIUS, BASE_STYLES } from './bases.js';
import { NEW_HEROES } from './legends.js';
import { castLegend, tickLegendZone } from './legend-rules.js';
export const HEROES = [
  { name: 'Mothman', slug: 'mothman', role: 'Ambush hunter', note: 'Vanish into the fog. Strike from the unseen.', hp: 1550, speed: 340, range: 150, damage: 126, rate: .62, color: '#e9dca6', sprite: 0 },
  { name: 'Nessie', slug: 'nessie', role: 'River bruiser', note: 'Dive through the river. Pull the fight to you.', hp: 2200, speed: 300, range: 155, damage: 118, rate: .8, color: '#74e6b7', sprite: 1 },
  { name: 'Baba Yaga', slug: 'baba', role: 'Walking fortress', note: 'Your hut has legs. Your traps have teeth.', hp: 1820, speed: 285, range: 360, damage: 94, rate: .8, color: '#edc47c', sprite: 2 },
  { name: 'Jersey Devil', slug: 'devil', role: 'Relentless chaser', note: 'Leap into a brawl. Feed on the fear.', hp: 1690, speed: 365, range: 140, damage: 143, rate: .68, color: '#f6a086', sprite: 3 },
 ...NEW_HEROES,
].map((h,i) => ({ category:['Assassin','Tank','Mage','Fighter'][i]||h.category, height:[365,475,360,390][i]||h.height, build:i<4?i:h.build, ...h, skills: KITS[i].map(a=>a.name), labels: KITS[i].map(a=>a.label), descriptions: KITS[i].map(a=>a.description) }));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function add(s, data) {
  const e = { id: s.nextId++, hp: 100, maxHp: 100, radius: 22, speed: 0, range: 100, damage: 10, rate: 1, attackCd: 0, hit: 0, shield: 0, stun: 0, slow: 0, fear: 0, lastHit: -100, revealedUntil: -1, facing: -Math.PI / 2, ...data };
  s.units.push(e); return e;
}
function hero(s, team, kind, lane, human = false) {
  const h = HEROES[kind], front = LANES[lane][2], toward = team ? -1 : 1;
  return add(s, { kind: 'hero', team, hero: kind, name: h.name, sprite: kind, x: front.x + (human ? 0 : 36), y: front.y + toward * 470, hp: h.hp, maxHp: h.hp, speed: h.speed, range: h.range, damage: h.damage, rate: h.rate, lane, waypoint: 2, player: human, level: 1, xp: 0, gold: 360, kills: 0, deaths: 0, respawn: 0, cd: [0, 0, 0, 0], skillRanks: [0,0,0,0], skillPoints: 1, haste: 1, inventory: [], build: BUILDS[h.build].id, power: 0, armor: 0, regen: 0, lifesteal: 0, itemState: {}, recall: 0, target: 0, attackAnim: 0, portalCd: 0, cloak: 0, sightUntil: 0, frenzy: 0, ambushReady: false });
}
export function createMatch(kind = 0, seed = 49) {
  const s = { time: 0, phase: 0, nextId: 1, units: [], effects: [], zones: [], traps: [], floaters: [], messages: [], random: rng(seed), seed, score: [0, 0], towers: [3, 3], wave: 0, nextWave: 1, objectiveAt: 26, objective: null, campTimers: CAMPS.map(() => 0), campRolls: CAMPS.map(() => 0), winner: null, reason: '', stats: { damage: 0, towers: 0, leviathans: 0, ambushes: 0, camps: 0, portals: 0 } };
  for (let team = 0; team < 2; team++) {
    add(s, { kind: 'core', name: BASE_STYLES[team].name, team, ...BASES[team], hp: 6200, maxHp: 6200, radius: 130, sprite: 7, range: 350, damage: 145, rate: 1.1 });
    for (let lane = 0; lane < 3; lane++) add(s, { kind: 'tower', name: 'Wardstone', team, lane, ...LANES[lane][team ? 3 : 1], hp: 3100, maxHp: 3100, radius: 42, range: 360, damage: 180, rate: 1.05, sprite: 6 });
  }
  const p = hero(s, 0, kind, 1, true); s.playerId = p.id;
  hero(s, 0, (kind + 1) % HEROES.length, 0); hero(s, 0, (kind + 2) % HEROES.length, 2);
  for (let lane = 0; lane < 3; lane++) hero(s, 1, (Math.floor(s.random() * HEROES.length) + lane) % HEROES.length, lane);
  for (const e of s.units) if (e.kind === 'hero' && !e.player) trainBot(e);
  announce(s, 'Choose your first spell', 'You have one skill point. Basic attacks are always ready.');
  return s;
}
export const player = s => s.units.find(e => e.id === s.playerId);
export function announce(s, title, detail = '') { s.messages.push({ title, detail, time: s.time }); if (s.messages.length > 5) s.messages.shift(); }
function burst(s, x, y, color, radius = 65, type = 'ring') { s.effects.push({ x, y, color, radius, type, life: .7, maxLife: .7 }); }
function reward(s, team, xp, gold) {
  for (const h of s.units.filter(e => e.kind === 'hero' && e.team === team)) {
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
  if (target.kind === 'core' && s.towers[target.team] === 3) { if (source.player && s.time - (s.lockTip || -10) > 4) { announce(s, 'Rift protected', 'Destroy any enemy wardstone first.'); s.lockTip = s.time; } return; }
  if (target.kind === 'hero' && target.respawn > 0) return;
  if (target.kind === 'camp') {
    if (target.leash) return;
    if (source.team >= 0) provokeNeutral(target, source, s.time);
  }
  if (kind === 'spell') amount += (source.power || 0) * .55;
  const armor = target.armor || 0;
  amount *= armor >= 0 ? 100 / (100 + armor) : 2 - 100 / (100 - armor);
  const shieldMultiplier = kind === 'attack' && hasItem(source, 'reaper') ? 1.5 : 1;
  if (shieldMultiplier > 1) target.woundedUntil = s.time + 4;
  if (target.kind === 'hero' && hasItem(target, 'mirror') && source.kind === 'hero' && s.time >= (target.itemState.mirror || 0)) {
    target.shield += 220; target.itemState.mirror = s.time + 20; burst(s, target.x, target.y, '#b9c9ff', 105);
  }
  const absorbed = Math.min(target.shield, amount * shieldMultiplier); target.shield -= absorbed; amount -= absorbed / shieldMultiplier;
  const actual = Math.min(target.hp, amount); target.hp = Math.max(0, target.hp - amount); target.hit = .16; target.hitAngle = Math.atan2(target.y - source.y, target.x - source.x); target.lastHit = s.time; target.revealedUntil = s.time + 2.6;
  if (source.player) s.stats.damage += actual;
  if(source.hp>0&&target.soulThread?.source===source.id&&target.soulThread.until>s.time)heal(s,source,actual*.25);
  if(target.hp>0&&target.guardUntil>s.time&&kind==='attack'&&source.hp>0&&source.id!==target.id)damage(s,target,source,(actual+absorbed/shieldMultiplier)*.2,'reflect');
  if (source.hp > 0 && source.frenzy > s.time) heal(s, source, actual * .3);
  if (source.player || target.player || target.kind === 'tower') s.floaters.push({ x: target.x, y: target.y - 55, text: Math.round(amount), color: target.player ? '#ff9b82' : '#fff4c9', life: .8 });
  if (target.kind === 'hero' && source.kind === 'hero') for (const t of s.units) if (t.kind === 'tower' && t.team === target.team && t.hp > 0 && distance(t, source) < t.range) { t.aggro = source.id; t.aggroUntil = s.time + 3; }
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
        if (mark.count >= 3) { target.stun = Math.max(target.stun, 1); mark.count = 0; mark.ready = s.time + 10; burst(s, target.x, target.y, '#b9e8ff', 130); }
      }
    }
  }
  if (target.hp > 0) return actual;
  if(target.rebirthUntil>s.time){target.rebirthUntil=0;target.hp=target.maxHp*.35;target.shield=140;target.stun=target.fear=target.slow=0;target.bleed=target.burn=null;area(s,target,target,330,260*(target.rebirthStrength||1));burst(s,target.x,target.y,'#ffc16d',330,'ultimate');return actual;}
  burst(s, target.x, target.y, target.team === 0 ? '#abf8b2' : '#ff917c', target.kind === 'hero' ? 110 : 70);
  if (target.kind === 'hero') {
    if (source.kind === 'hero' && hasItem(source, 'hunter')) { source.cd[0] = 0; source.cd[3] = Math.max(0, source.cd[3] - 3); }
    target.burn = null; target.bleed = null; target.omen = null; target.soulThread=null;target.brineUntil=target.chillUntil=target.spiritUntil=target.guardUntil=target.silencedUntil=target.rebirthUntil=0; target.wetUntil = 0; target.snaredUntil = 0; target.pursuitUntil = 0; target.frenzy = 0; target.cloak = 0; target.motion = null; target.pendingAttack = null; target.comboNext = 0; target.comboUntil = 0; target.attackStarted = undefined; target.castStarted = undefined; target.woundedUntil = 0; target.frostMarks = {}; target.deaths++; target.respawn = 5 + target.level; target.recall = 0; target.ambushReady = false;
    if (source.team >= 0) { s.score[source.team]++; reward(s, source.team, 95, 100); if (source.kind === 'hero') source.kills++; }
    if (target.player) announce(s, 'The veil takes you', `Respawn in ${target.respawn} seconds.`);
    else if (source.player) announce(s, `${target.name} banished`, '+100 embers · Team experience');
  } else if (target.kind === 'tower') {
    s.towers[target.team]--; reward(s, source.team, 150, 180); if (source.team === 0) s.stats.towers++;
    announce(s, target.team === 1 ? 'Enemy ward broken' : 'Our ward has fallen', 'The elder rift is now vulnerable.');
  } else if (target.kind === 'core') finish(s, 1 - target.team, 'The enemy elder rift was destroyed.');
  else if (target.kind === 'boss') {
    reward(s, source.team, 190, 160); s.objectiveAt = s.time + 65; s.objective = null;
    const lane = source.lane ?? 1, path = source.team ? [...LANES[lane]].reverse() : LANES[lane];
    add(s, { kind: 'leviathan', name: 'Wild Hunt', team: source.team, ...path[2], lane, waypoint: 3, hp: 4400, maxHp: 4400, radius: 52, range: 190, damage: 350, rate: 1.2, speed: 180, sprite: 8, creatureId: target.creatureId });
    if (source.team === 0) s.stats.leviathans++;
    announce(s, source.team === 0 ? 'The Wild Hunt rides with us' : 'Enemy claimed the Wild Hunt', 'Escort the great beast to their wardstone.');
  } else if (target.kind === 'camp') {
    reward(s, source.team, 90, 110); s.campTimers[target.camp] = s.time + 32;
    if (source.kind === 'hero' && source.hp > 0) { heal(s, source, 430); source.huntUntil = s.time + 18; }
    if (source.player) { s.stats.camps++; announce(s, 'Spirit feast', '+110 embers · Healing · 18 seconds of haste'); }
  } else if (source.team >= 0) reward(s, source.team, target.kind === 'leviathan' ? 120 : 18, target.kind === 'leviathan' ? 100 : 12);
}
function hostile(s, a, b) { return b.hp > 0 && a.id !== b.id && a.team !== b.team && !(b.kind === 'core' && s.towers[b.team] === 3) && (b.team !== -1 || a.kind === 'hero' || a.team === -1); }
function nearest(s, a, range, preferHero = false) {
  let best = null, score = Infinity;
  for (const b of s.units) {
    if (!hostile(s, a, b) || !canSee(s, a, b) || (b.kind === 'camp' && (b.leash || !(b.aggroUntil > s.time)))) continue;
    const d = distance(a, b); if (d > range + b.radius) continue;
    const n = d + (preferHero && b.kind !== 'hero' ? 100 : 0);
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
  if (!t || e.attackCd > 0 || distance(e, t) > e.range + t.radius || !canSee(s, e, t) || !lineOfSight(s, e, t)) return;
  if (e.kind === 'hero') {
    if (e.comboTarget !== t.id || s.time > (e.comboUntil || 0)) e.comboNext = 0;
    e.attackVariant = e.comboNext || 0; e.comboTarget = t.id;
  }
  const timing = ATTACK_TIMINGS[e.attackVariant || 0];
  e.attackWindup = e.kind === 'hero' ? timing.windup : .12;
  e.attackDuration = e.kind === 'hero' ? timing.duration : .46;
  e.attackCd = e.rate * (e.frenzy > s.time ? .48 : 1); e.attackAnim = e.attackDuration; e.attackStarted = s.time; e.facing = Math.atan2(t.y - e.y, t.x - e.x); e.attackFacing = e.facing;
  const ambush = e.ambushReady && t.kind === 'hero';
  if (ambush) { if (e.player) s.stats.ambushes++; s.floaters.push({ x: t.x, y: t.y - 90, text: 'AMBUSH!', color: '#e2fa78', life: 1.2 }); }
  e.ambushReady = false; e.revealedUntil = s.time + 2.6;
  const multiplier = s.time > 240 ? 1 + (s.time - 240) / 110 : 1;
  e.pendingAttack = { target: t.id, at: s.time + e.attackWindup, variant: e.attackVariant || 0, amount: e.damage * multiplier * (ambush ? 1.75 : 1) * (e.kind === 'hero' ? timing.damage : 1) };
}
function resolveAttack(s, e) {
  const pending = e.pendingAttack; if (!pending || s.time < pending.at) return;
  e.pendingAttack = null;
  const t = s.units.find(u => u.id === pending.target);
  if (!t || t.hp <= 0 || e.hp <= 0 || e.stun > 0 || distance(e, t) > e.range + t.radius + 90 || !lineOfSight(s, e, t)) { e.comboNext = 0; e.comboUntil = 0; return; }
  if (e.kind === 'hero') { e.comboNext = (pending.variant + 1) % 3; e.comboUntil = s.time + 2; e.lastBasicHit = s.time; e.lastBasicVariant = pending.variant; }
  damage(s, e, t, pending.amount, 'attack');
  if (e.hero === 0 && t.omen?.source === e.id && t.omen.until > s.time) {
    const omen = t.omen; t.omen = null; if (t.hp > 0) damage(s,e,t,omen.amount);
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
export function cast(s, e, slot, aim) {
  if (e.kind !== 'hero' || ![0,1,2,3].includes(slot) || !e.skillRanks[slot] || e.hp <= 0 || e.stun > 0 || e.fear > 0 || e.silencedUntil > s.time || e.cd[slot] > 0 || s.winner !== null) return false;
  const target = s.units.find(t => t.id === e.target && hostile(s,e,t) && canSee(s,e,t) && distance(e,t) < 540 && lineOfSight(s,e,t)) || nearest(s,e,540,true);
  if (slot === 2 && e.hero === 0 && (!target || ['core','tower'].includes(target.kind))) return false;
  if (slot === 2 && e.hero === 8 && (!target || ['core','tower'].includes(target.kind))) return false;
  const angle = aim && Math.hypot(aim.x,aim.y) > .1 ? Math.atan2(aim.y,aim.x) : target ? Math.atan2(target.y-e.y,target.x-e.x) : e.facing;
  const rank = e.skillRanks[slot], strength = 1 + (rank-1)*.28;
  e.recall = 0; e.cd[slot] = cooldownFor(e,slot); e.facing = angle; e.attackAnim = .42; e.attackStarted = s.time; e.castStarted = s.time; e.castSlot = slot; e.castFacing = angle; e.itemState.empowered = s.time+5;
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
  if(e.hero>=4) return castLegend({s,e,slot,aim,target,angle,rank,strength,origin,color,fx,cone,damage,heal,area,hostile});
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
    if(e.hero===2) {const point={x:e.x+Math.cos(angle)*290,y:e.y+Math.sin(angle)*290,radius:20};resolveBody(s,point);s.traps.push({...point,rank,team:e.team,source:e.id,life:16,armed:s.time+.5});}
    if(e.hero===3) for(const t of s.units) if(hostile(s,e,t)&&distance(e,t)<300&&lineOfSight(s,e,t)) {damage(s,e,t,145*strength);if(!['core','tower'].includes(t.kind)) {t.fear=t.bleed?.until>s.time?2.2:1.1;t.fearX=e.x;t.fearY=e.y;}}
  } else if(slot===2) {
    if(e.hero===0) {target.omen={source:e.id,until:s.time+5+rank,amount:170*strength};target.revealedUntil=s.time+5+rank;fx(target,160);}
    if(e.hero===1) {fx(origin,350);cone(350,1.25,(t,a)=>{const wet=t.wetUntil>s.time||inWater(t,s);damage(s,e,t,220*strength);if(!['core','tower'].includes(t.kind)){t.x+=Math.cos(a)*220;t.y+=Math.sin(a)*220;if(wet)t.stun=.8+rank*.15;resolveBody(s,t);}});}
    if(e.hero===2) {const point=aim?{x:e.x+Math.cos(angle)*380,y:e.y+Math.sin(angle)*380}:target?{x:target.x,y:target.y}:{x:e.x+Math.cos(angle)*380,y:e.y+Math.sin(angle)*380};point.x=clamp(point.x,180,SIZE-180);point.y=clamp(point.y,180,SIZE-180);s.zones.push({...point,source:e.id,team:e.team,rank,radius:190,life:4.7,tick:.7,armed:s.time+.7,type:'witchfire',amount:80*strength});fx(point,190);s.effects.push({...origin,tx:point.x,ty:point.y,type:'mortar',hero:2,life:.7,maxLife:.7,color});}
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
  if (e.hp <= 0 || e.stun > 0 || e.fear > 0 || e.portalCd > 0 || s.winner !== null) return false;
  const gate = PORTALS.find(g => distance(e, g) < 150); if (!gate) return false;
  const to = PORTALS[gate.to]; burst(s, e.x, e.y, '#c1f4ed', 180, 'ultimate'); e.x = to.x; e.y = to.y; e.portalCd = 10; e.recall = 0; resolveBody(s, e); burst(s, e.x, e.y, '#c1f4ed', 180);
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
function spawnWave(s) {
  s.wave++;
  for (let team = 0; team < 2; team++) for (let lane = 0; lane < 3; lane++) for (let i = 0; i < 3; i++) {
    const front = LANES[lane][2], base = s.wave === 1 ? { x: front.x, y: front.y + (team ? -1 : 1) * 370 } : BASES[team], siege = i === 2 && s.wave % 3 === 0;
    add(s, { kind: 'minion', team, lane, x: base.x + (i - 1) * 32, y: base.y + (team ? 1 : -1) * i * 28, waypoint: s.wave === 1 ? 2 : 1, hp: siege ? 780 : 390, maxHp: siege ? 780 : 390, damage: siege ? 88 : 45, rate: 1, range: siege ? 270 : 95, speed: 205, radius: 16, sprite: team ? 5 : 4, siege, creatureId: chooseCreature(s.seed, `wave:${s.wave}:lane:${lane}:slot:${i}`, siege ? 'siege' : 'lane').id });
  }
}
function followLane(s, e, dt) {
  const path = e.team ? [...PATHS[e.lane]].reverse() : PATHS[e.lane];
  // Rejoin the closest piece of the curved lane after a chase or teleport.
  const index = closestTrack(e, path), ahead = path[Math.min(path.length - 1, index + 2)];
  e.waypoint = index; move(s, e, ahead.x, ahead.y, dt, e.speed * (e.slow > 0 ? .52 : 1));

}
function bot(s, e, dt) {
  if (e.hp < e.maxHp * .23 || e.retreat && e.hp < e.maxHp * .85) {
    e.retreat = true; move(s, e, BASES[e.team].x, BASES[e.team].y, dt);
    if (s.time - e.lastHit > 3) { e.botRecall = (e.botRecall || 0) + dt; if (e.botRecall > 2.5) { Object.assign(e, BASES[e.team]); e.botRecall = 0; e.waypoint = 1; } }
    return;
  }
  e.retreat = false; e.botRecall = 0;
  let t = nearest(s, e, 580, true);
  const boss = s.units.find(x => x.kind === 'boss' && x.hp > 0);
  if (boss && e.lane === 1 && e.hp > e.maxHp * .5 && !t && distance(e, boss) < 800) t = boss;
  if (t) {
    if (t.kind === 'tower' && !s.units.some(a => a.team === e.team && a.kind === 'minion' && a.hp > 0 && distance(a, t) < 320) && e.hp < e.maxHp * .6) { move(s, e, BASES[e.team].x, BASES[e.team].y, dt); return; }
    const d = distance(e, t);
    if (d > e.range * .9 + t.radius) move(s, e, t.x, t.y, dt, e.speed * (e.slow > 0 ? .5 : .9) * (e.pursuitUntil > s.time ? 1.3 : 1));
    else if (e.range > 250 && d < 145 && t.kind === 'hero') move(s, e, e.x + e.x - t.x, e.y + e.y - t.y, dt);
    attack(s, e, t);
    if (d < (e.hero === 2 ? 420 : 250) && e.cd[1] <= 0) cast(s, e, 1);
    if (d < 450 && e.cd[2] <= 0) cast(s,e,2);
    if(t.kind==='hero'&&d<320&&e.cd[3]<=0)cast(s,e,3);
    if (t.kind === 'hero' && d > 340 && d < 560 && e.cd[0] <= 0) cast(s, e, 0);
  } else followLane(s, e, dt);
}
function terrainEffects(s, dt) {
  for (const z of s.zones) {
    z.life-=dt;z.tick-=dt;const source=s.units.find(e=>e.id===z.source);
    if(!source||z.life<=0||s.time<(z.armed||0)||z.tick>0)continue;
    z.tick=z.type==='stomp'?.8:.6;
    if(z.legend){tickLegendZone({s,z,source,damage,heal,hostile});continue;}
    if(z.type==='stomp') {if(z.pulses>=3)continue;z.radius=210+z.pulses*80;z.pulses++;area(s,source,z,z.radius,z.amount,{stun:.45});s.effects.push({...z,type:'spell',hero:2,slot:3,life:.65,maxLife:.65});}
    else for(const t of s.units) if(t.hp>0&&distance(t,z)<z.radius+t.radius&&lineOfSight(s,z,t)) {
      if(hostile(s,source,t)) {
        const rooted=t.snaredUntil>s.time;
        damage(s,source,t,(z.amount||38)*(z.type==='witchfire'&&rooted?1.6:1));
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
    if (source && enemy) { area(s,source,t,145,260*(1+((t.rank||1)-1)*.28),{stun:1.4,snaredUntil:s.time+2.5}); burst(s, t.x, t.y, '#dceb80', 145); t.life = 0; }
  }
  s.traps = s.traps.filter(t => t.life > 0);
}
export function step(s, input = {}, dt = 1 / 60) {
  if (s.winner !== null) return;
  dt = clamp(dt, 0, .05); s.time += dt;
  s.effects.forEach(e => e.life -= dt); s.effects = s.effects.filter(e => e.life > 0);
  s.floaters.forEach(e => { e.life -= dt; e.y -= dt * 26; }); s.floaters = s.floaters.filter(e => e.life > 0);
  if (shiftWorld(s)) announce(s, s.phase ? 'The woods swallow the town' : 'The town returns', s.phase ? 'Vision shrinks. Hide in brush for a 75% ambush strike.' : 'Streets reopen. Buildings block sight and movement.');
  if (s.time >= s.nextWave) { spawnWave(s); s.nextWave += 14; }
  if (!s.objective && s.time >= s.objectiveAt) {
    const boss = add(s, { kind: 'boss', name: 'Wild Hunt', team: -1, x: 2400, y: 2400, homeX: 2400, homeY: 2400, hp: 3300, maxHp: 3300, damage: 95, range: 200, speed: 125, rate: 1.2, sprite: 8, radius: 55, creatureId: chooseCreature(s.seed, `boss:${Math.floor(s.time)}`, 'boss').id });
    s.objective = boss.id; announce(s, 'The Wild Hunt awakens', 'Slay the great beast. It will fight for your team.');
  }
  for (let i = 0; i < CAMPS.length; i++) if (s.time >= s.campTimers[i] && !s.units.some(e => e.kind === 'camp' && e.camp === i && e.hp > 0)) {
    const roll = s.campRolls[i]++, key = `camp:${i}:${roll}`, creature = chooseCreature(s.seed, key, 'neutral');
    const spot = { x: CAMPS[i].x + creatureHash(s.seed, key + ':x') % 121 - 60, y: CAMPS[i].y + creatureHash(s.seed, key + ':y') % 121 - 60, radius: 30 };
    resolveBody(s, spot);
    add(s, { kind: 'camp', name: `${creature.family[0].toUpperCase() + creature.family.slice(1)} guardian`, team: -1, camp: i, ...spot, homeX: spot.x, homeY: spot.y, hp: 960, maxHp: 960, damage: 55, range: 170, speed: 120, rate: 1.1, sprite: i ? 9 : 10, creatureId: creature.id, aggro: 0, aggroUntil: 0 });
  }
  terrainEffects(s, dt);
  for (const e of [...s.units]) {
    for (const key of ['attackCd', 'attackAnim', 'hit', 'stun', 'slow', 'fear']) e[key] = Math.max(0, (e[key] || 0) - dt);
    if(e.hp>0 && e.bleed?.until>s.time && s.time>=e.bleed.tick) {const source=s.units.find(t=>t.id===e.bleed.source);e.bleed.tick+=.8;if(source)damage(s,source,e,e.bleed.amount);}
    e.moving = false; itemTick(s, e, dt); resolveAttack(s, e);
    if (e.kind === 'hero') {
      e.cd = e.cd.map(c => Math.max(0, c - dt)); e.portalCd = Math.max(0, e.portalCd - dt); e.gold += dt * 3.2;
      if(!e.player||input.autopilot)trainBot(e);
      if ((!e.player || input.autopilot) && s.time >= (e.nextShop || 0)) { const id = nextPurchase(e); if (id) buy(s, id, e); e.nextShop = s.time + 2; }
      if (e.hp <= 0) {
        e.respawn -= dt;
        if (e.respawn <= 0) { Object.assign(e, BASES[e.team]); e.hp = e.maxHp; e.shield = 140; e.waypoint = 1; e.cd = [0,0,0,Math.min(6,e.cd[3])]; e.cloak = 0; e.revealedUntil = -1; if (e.player) announce(s, 'A legend returns', 'Leave the rift or take a portal to rejoin the hunt.'); }
        continue;
      }
      if (distance(e, BASES[e.team]) < BASE_HEAL_RADIUS) heal(s, e, e.maxHp * .24 * dt);
      else if (s.time - e.lastHit > 5) heal(s, e, 12 * dt);
      e.shield = Math.max(0, e.shield - dt * 13);
      if (concealed(s, e)) e.ambushReady = true;
      else if (e.cloak <= s.time && !concealed(s, e)) e.ambushReady = false;
      if (e.stun > 0) continue;
      if (e.fear > 0) { move(s, e, e.x + (e.x - e.fearX), e.y + (e.y - e.fearY), dt, e.speed * .8); continue; }
      if (!e.player || input.autopilot) { bot(s, e, dt); continue; }
      const dx = input.x || 0, dy = input.y || 0, moving = Math.hypot(dx, dy) > .12;
      if (moving) {
        const mag = Math.max(1, Math.hypot(dx, dy)), sprint = s.time - e.lastHit > 3 && s.time > e.revealedUntil ? 1.35 : 1;
        const speed = e.speed * sprint * (e.slow > 0 ? .52 : 1) * (e.frenzy > s.time ? 1.25 : 1) * (e.huntUntil > s.time ? 1.2 : 1) * (e.pursuitUntil > s.time ? 1.3 : 1) * (e.hero === 1 && inWater(e, s) ? 1.4 : 1);
        move(s, e, e.x + dx / mag * 250, e.y + dy / mag * 250, dt, speed); e.recall = 0;
      }
      if (input.portal) portal(s, e);
      if (input.recall && !e.recall) e.recall = 2.5;
      if (e.recall > 0) {
        if (moving || s.time - e.lastHit < .2) e.recall = 0;
        else { e.recall -= dt; if (e.recall <= 0) { Object.assign(e, BASES[0]); burst(s, e.x, e.y, '#e4f5ac', 180); } }
      }
      if (input.cast !== undefined) cast(s, e, input.cast, input.aim);
      if (!e.recall) {
        const t = autoTarget(s, e, input.target); e.target = t?.id || 0;
        if (input.attack !== false) attack(s, e, t);
      }
    } else {
      if (e.hp <= 0 || e.stun > 0) continue;
      if (e.fear > 0 && e.speed > 0) { move(s, e, e.x + e.x - e.fearX, e.y + e.y - e.fearY, dt); continue; }
      if (e.kind === 'tower' || e.kind === 'core') {
        let t = s.units.find(x => x.id === e.aggro && s.time < e.aggroUntil && x.hp > 0 && distance(e, x) < e.range && canSee(s, e, x));
        if (!t) t = s.units.filter(x => x.team !== e.team && x.team !== -1 && x.hp > 0 && distance(e, x) < e.range && canSee(s, e, x) && !['tower', 'core'].includes(x.kind)).sort((a, b) => (a.kind === 'hero') - (b.kind === 'hero') || distance(e, a) - distance(e, b))[0];
        attack(s, e, t);
      } else if (e.kind === 'camp') {
        // Neutral guardians retaliate against the attacker. Auto attacks leave resting camps alone.
        const t = s.units.find(u => u.id === e.aggro), intent = neutralIntent(e, t, s.time);
        if (intent.mode === 'return' || intent.mode === 'reset') {
          e.leash = true; e.pendingAttack = null; e.attackAnim = 0;
          move(s, e, intent.x, intent.y, dt, e.speed * 1.5);
          e.hp = Math.min(e.maxHp, e.hp + dt * 240);
          if (intent.mode === 'reset') { e.leash = false; e.aggro = 0; e.aggroUntil = 0; e.hp = e.maxHp; }
        } else if (intent.mode === 'fight') {
          attack(s, e, t); if (distance(e, t) > e.range) move(s, e, intent.x, intent.y, dt, e.speed * (e.slow > 0 ? .52 : 1));
        }
      } else if (e.team === -1) {
        const home = { x: e.homeX, y: e.homeY }, t = nearest(s, e, 330);
        if (distance(e, home) > 390) e.leash = true;
        if (e.leash) { move(s, e, home.x, home.y, dt, e.speed * 1.5); e.hp = Math.min(e.maxHp, e.hp + dt * 150); if (distance(e, home) < 20) e.leash = false; }
        else if (t) { attack(s, e, t); if (distance(e, t) > e.range) move(s, e, t.x, t.y, dt); }
        else move(s, e, home.x, home.y, dt);
      } else {
        const t = nearest(s, e, e.range + 140);
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
    const value = team => s.units.filter(e => e.team === team && ['core', 'tower'].includes(e.kind)).reduce((v, e) => v + e.hp, 0);
    const a = value(0), b = value(1); finish(s, a === b ? -1 : a > b ? 0 : 1, 'Six minutes. The team with more ward and rift health wins.');
  }
}
