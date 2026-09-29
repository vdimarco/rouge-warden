// Deterministic Monster Mash rules. Rendering and input are separate.
import { BUILDS, hasItem, purchase, sellItem, recalculate, nextPurchase } from './items.js';
import { SIZE, LIMIT, SHIFT, BASES, LANES, PORTALS, CAMPS, distance, clamp, move, resolveBody, shiftWorld, canSee, lineOfSight, inWater, concealed } from './world.js';
export { SIZE, LIMIT, SHIFT, BASES, LANES, PORTALS, distance } from './world.js';
export const HEROES = [
  { name: 'Mothman', slug: 'mothman', role: 'Ambush hunter', note: 'Vanish into the fog. Strike from the unseen.', hp: 1550, speed: 340, range: 150, damage: 126, rate: .62, color: '#e9dca6', sprite: 0, skills: ['Night flight', 'Dread wings', 'Blackout'], labels: ['FLY', 'DREAD', 'BLACKOUT'], descriptions: ['Fly over walls and cloak for 2 seconds.', 'Wing blast damages and slows nearby enemies.', 'Cloak and see through cover for 6 seconds. Fear nearby foes.'] },
  { name: 'Nessie', slug: 'nessie', role: 'River bruiser', note: 'Dive through the river. Pull the fight to you.', hp: 2200, speed: 300, range: 155, damage: 118, rate: .8, color: '#74e6b7', sprite: 1, skills: ['Loch dive', 'Undertow', 'Flood'], labels: ['DIVE', 'PULL', 'FLOOD'], descriptions: ['Dive forward, heal, and leave a slowing wake.', 'Pull enemies in front of you into biting range.', 'Flood a wide area, damaging foes and healing allies.'] },
  { name: 'Baba Yaga', slug: 'baba', role: 'Walking fortress', note: 'Your hut has legs. Your traps have teeth.', hp: 1820, speed: 285, range: 360, damage: 94, rate: .8, color: '#edc47c', sprite: 2, skills: ['Hut hop', 'Hex trap', 'Stomp ritual'], labels: ['HOP', 'HEX', 'STOMP'], descriptions: ['Hop forward and shield the walking hut.', 'Plant a hidden trap. It roots the next nearby enemy.', 'Three stomps damage and stun foes around the hut.'] },
  { name: 'Jersey Devil', slug: 'devil', role: 'Relentless chaser', note: 'Leap into a brawl. Feed on the fear.', hp: 1690, speed: 365, range: 140, damage: 143, rate: .68, color: '#f6a086', sprite: 3, skills: ['Pine leap', 'Hell shriek', 'Blood moon'], labels: ['LEAP', 'SHRIEK', 'FRENZY'], descriptions: ['Leap over obstacles. Your landing damages and stuns.', 'Send nearby enemies fleeing in fear.', 'Eight seconds of faster attacks, movement and life steal.'] },
];
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function add(s, data) {
  const e = { id: s.nextId++, hp: 100, maxHp: 100, radius: 22, speed: 0, range: 100, damage: 10, rate: 1, attackCd: 0, hit: 0, shield: 0, stun: 0, slow: 0, fear: 0, lastHit: -100, revealedUntil: -1, facing: -Math.PI / 2, ...data };
  s.units.push(e); return e;
}
function hero(s, team, kind, lane, human = false) {
  const h = HEROES[kind], front = LANES[lane][2], toward = team ? -1 : 1;
  return add(s, { kind: 'hero', team, hero: kind, name: h.name, sprite: kind, x: front.x + (human ? 0 : 36), y: front.y + toward * 470, hp: h.hp, maxHp: h.hp, speed: h.speed, range: h.range, damage: h.damage, rate: h.rate, lane, waypoint: 2, player: human, level: 1, xp: 0, gold: 360, kills: 0, deaths: 0, respawn: 0, cd: [0, 0, 0], haste: 1, inventory: [], build: BUILDS[kind].id, power: 0, armor: 0, regen: 0, lifesteal: 0, itemState: {}, recall: 0, target: 0, attackAnim: 0, portalCd: 0, cloak: 0, sightUntil: 0, frenzy: 0, ambushReady: false });
}
export function createMatch(kind = 0, seed = 49) {
  const s = { time: 0, phase: 0, nextId: 1, units: [], effects: [], zones: [], traps: [], floaters: [], messages: [], random: rng(seed), seed, score: [0, 0], towers: [3, 3], wave: 0, nextWave: 1, objectiveAt: 26, objective: null, campTimers: [0, 0], winner: null, reason: '', stats: { damage: 0, towers: 0, leviathans: 0, ambushes: 0, camps: 0, portals: 0 } };
  for (let team = 0; team < 2; team++) {
    add(s, { kind: 'core', name: 'Elder rift', team, ...BASES[team], hp: 6200, maxHp: 6200, radius: 76, sprite: 7, range: 350, damage: 145, rate: 1.1 });
    for (let lane = 0; lane < 3; lane++) add(s, { kind: 'tower', name: 'Wardstone', team, lane, ...LANES[lane][team ? 3 : 1], hp: 3100, maxHp: 3100, radius: 42, range: 360, damage: 180, rate: 1.05, sprite: 6 });
  }
  const p = hero(s, 0, kind, 1, true); s.playerId = p.id;
  hero(s, 0, (kind + 1) % 4, 0); hero(s, 0, (kind + 2) % 4, 2);
  for (let lane = 0; lane < 3; lane++) hero(s, 1, (Math.floor(s.random() * 4) + lane) % 4, lane);
  announce(s, 'The hunt begins', 'Follow the wisps. Break a wardstone, then their rift.');
  return s;
}
export const player = s => s.units.find(e => e.id === s.playerId);
export function announce(s, title, detail = '') { s.messages.push({ title, detail, time: s.time }); if (s.messages.length > 5) s.messages.shift(); }
function burst(s, x, y, color, radius = 65, type = 'ring') { s.effects.push({ x, y, color, radius, type, life: .7, maxLife: .7 }); }
function reward(s, team, xp, gold) {
  for (const h of s.units.filter(e => e.kind === 'hero' && e.team === team)) {
    h.gold += gold; h.xp += xp;
    while (h.level < 10 && h.xp >= h.level * 100) {
      h.xp -= h.level * 100; h.level++; recalculate(h, HEROES[h.hero]); h.hp = h.hp > 0 ? Math.min(h.maxHp, h.hp + 230) : 0;
      if (h.player) { burst(s, h.x, h.y, '#e3f57b', 140); announce(s, `Level ${h.level}`, h.level === 3 ? 'Your ultimate is unlocked.' : 'Health and attack increased.'); }
    }
  }
}
function finish(s, winner, reason) { s.winner = winner; s.reason = reason; announce(s, winner === 0 ? 'Legends never die' : 'Lost to the veil', reason); }
export function damage(s, source, target, amount, kind = 'spell') {
  if (!target || target.hp <= 0 || s.winner !== null) return;
  if (target.kind === 'core' && s.towers[target.team] === 3) { if (source.player && s.time - (s.lockTip || -10) > 4) { announce(s, 'Rift protected', 'Destroy any enemy wardstone first.'); s.lockTip = s.time; } return; }
  if (target.kind === 'hero' && target.respawn > 0) return;
  if (kind === 'spell') amount += (source.power || 0) * .55;
  amount *= 100 / (100 + (target.armor || 0));
  if (target.kind === 'hero' && hasItem(target, 'mirror') && source.kind === 'hero' && s.time >= (target.itemState.mirror || 0)) {
    target.shield += 220; target.itemState.mirror = s.time + 20; burst(s, target.x, target.y, '#b9c9ff', 105);
  }
  const absorbed = Math.min(target.shield, amount); target.shield -= absorbed; amount -= absorbed;
  const actual = Math.min(target.hp, amount); target.hp = Math.max(0, target.hp - amount); target.hit = .16; target.lastHit = s.time; target.revealedUntil = s.time + 2.6;
  if (source.player) s.stats.damage += actual;
  if (source.hp > 0 && source.frenzy > s.time) source.hp = Math.min(source.maxHp, source.hp + actual * .3);
  if (source.player || target.player || target.kind === 'tower') s.floaters.push({ x: target.x, y: target.y - 55, text: Math.round(amount), color: target.player ? '#ff9b82' : '#fff4c9', life: .8 });
  if (target.kind === 'hero' && source.kind === 'hero') for (const t of s.units) if (t.kind === 'tower' && t.team === target.team && t.hp > 0 && distance(t, source) < t.range) { t.aggro = source.id; t.aggroUntil = s.time + 3; }
  if (source.hp > 0 && kind === 'attack' && source.lifesteal) source.hp = Math.min(source.maxHp, source.hp + actual * source.lifesteal);
  if (target.hp > 0 && target.kind === 'hero' && hasItem(target, 'root') && target.hp < target.maxHp * .35 && s.time >= (target.itemState.root || 0)) {
    target.shield += 300; target.itemState.root = s.time + 35; burst(s, target.x, target.y, '#b8eb91', 120);
  }
  if (target.hp > 0 && kind === 'spell' && source.kind === 'hero' && !['tower', 'core'].includes(target.kind)) {
    if (hasItem(source, 'lantern')) target.burn = { source: source.id, until: s.time + 3, tick: target.burn?.source === source.id ? target.burn.tick : s.time + 1, amount: 28 + source.power * .05 };
    if (hasItem(source, 'frost')) target.slow = Math.max(target.slow, 1.2);
  }
  if (target.hp > 0) return actual;
  burst(s, target.x, target.y, target.team === 0 ? '#abf8b2' : '#ff917c', target.kind === 'hero' ? 110 : 70);
  if (target.kind === 'hero') {
    if (source.kind === 'hero' && hasItem(source, 'hunter')) { source.cd[0] = 0; source.cd[2] = Math.max(0, source.cd[2] - 3); }
    target.burn = null; target.motion = null; target.pendingAttack = null; target.deaths++; target.respawn = 5 + target.level; target.recall = 0; target.ambushReady = false;
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
    add(s, { kind: 'leviathan', name: 'Wild Hunt', team: source.team, ...path[2], lane, waypoint: 3, hp: 4400, maxHp: 4400, radius: 52, range: 190, damage: 350, rate: 1.2, speed: 180, sprite: 8 });
    if (source.team === 0) s.stats.leviathans++;
    announce(s, source.team === 0 ? 'The Wild Hunt rides with us' : 'Enemy claimed the Wild Hunt', 'Escort the great beast to their wardstone.');
  } else if (target.kind === 'camp') {
    reward(s, source.team, 90, 110); s.campTimers[target.camp] = s.time + 32;
    if (source.kind === 'hero' && source.hp > 0) { source.hp = Math.min(source.maxHp, source.hp + 430); source.huntUntil = s.time + 18; }
    if (source.player) { s.stats.camps++; announce(s, 'Spirit feast', '+110 embers · Healing · 18 seconds of haste'); }
  } else if (source.team >= 0) reward(s, source.team, target.kind === 'leviathan' ? 120 : 18, target.kind === 'leviathan' ? 100 : 12);
}
function hostile(s, a, b) { return b.hp > 0 && a.id !== b.id && a.team !== b.team && !(b.kind === 'core' && s.towers[b.team] === 3) && (b.team !== -1 || a.kind === 'hero' || a.team === -1); }
function nearest(s, a, range, preferHero = false) {
  let best = null, score = Infinity;
  for (const b of s.units) {
    if (!hostile(s, a, b) || !canSee(s, a, b)) continue;
    const d = distance(a, b); if (d > range + b.radius) continue;
    const n = d + (preferHero && b.kind !== 'hero' ? 100 : 0);
    if (n < score) { score = n; best = b; }
  }
  return best;
}
function attack(s, e, t) {
  if (!t || e.attackCd > 0 || distance(e, t) > e.range + t.radius || !canSee(s, e, t) || !lineOfSight(s, e, t)) return;
  e.attackCd = e.rate * (e.frenzy > s.time ? .48 : 1); e.attackAnim = .42; e.attackStarted = s.time; e.facing = Math.atan2(t.y - e.y, t.x - e.x);
  const ambush = e.ambushReady && t.kind === 'hero';
  if (ambush) { if (e.player) s.stats.ambushes++; s.floaters.push({ x: t.x, y: t.y - 90, text: 'AMBUSH!', color: '#e2fa78', life: 1.2 }); }
  e.ambushReady = false; e.revealedUntil = s.time + 2.6;
  const multiplier = s.time > 240 ? 1 + (s.time - 240) / 110 : 1;
  e.pendingAttack = { target: t.id, at: s.time + .12, amount: e.damage * multiplier * (ambush ? 1.75 : 1) };
}
function resolveAttack(s, e) {
  const pending = e.pendingAttack; if (!pending || s.time < pending.at) return;
  e.pendingAttack = null;
  const t = s.units.find(u => u.id === pending.target);
  if (!t || t.hp <= 0 || e.hp <= 0 || e.stun > 0 || distance(e, t) > e.range + t.radius + 90 || !lineOfSight(s, e, t)) return;
  damage(s, e, t, pending.amount, 'attack');
  if (e.kind === 'hero') {
    const v = e.itemState; v.hits = (v.hits || 0) + 1;
    if (hasItem(e, 'nightfang') && v.empowered > s.time && s.time >= (v.nightfang || 0)) {
      damage(s, e, t, 65 + e.power * .5, 'item'); v.empowered = 0; v.nightfang = s.time + 3; burst(s, t.x, t.y, '#fff2ae', 90);
    }
    if (v.hits % 3 === 0) {
      if (hasItem(e, 'thorn')) damage(s, e, t, Math.min(160, t.maxHp * .03), 'item');
      if (hasItem(e, 'storm')) for (const other of s.units.filter(u => u.id !== t.id && hostile(s, e, u) && distance(t, u) < 300 && canSee(s, e, u)).slice(0, 2)) {
        damage(s, e, other, 60 + e.power * .2, 'item');
        s.effects.push({ type: 'beam', x: t.x, y: t.y, tx: other.x, ty: other.y, color: '#86eaff', life: .35, maxLife: .35 });
      }
    }
  }
  s.effects.push({ type: e.range > 200 ? 'beam' : 'slash', x: e.x, y: e.y - 20, tx: t.x, ty: t.y - 20, radius: e.range, color: e.team === 0 ? '#e3f88a' : e.team === 1 ? '#ff8875' : '#ecbc74', life: .2, maxLife: .2 });
}
function area(s, e, center, radius, amount, status = {}) {
  for (const t of s.units) if (hostile(s, e, t) && distance(t, center) < radius + t.radius && lineOfSight(s, center, t)) {
    damage(s, e, t, amount);
    if (!['tower', 'core'].includes(t.kind)) Object.assign(t, status, status.fear ? { fearX: e.x, fearY: e.y } : {});
  }
}
export function cast(s, e, slot, aim) {
  if (e.kind !== 'hero' || ![0, 1, 2].includes(slot) || e.hp <= 0 || e.stun > 0 || e.fear > 0 || e.cd[slot] > 0 || s.winner !== null || (slot === 2 && e.level < 3)) return false;
  const target = nearest(s, e, 540, true);
  const angle = aim && Math.hypot(aim.x, aim.y) > .1 ? Math.atan2(aim.y, aim.x) : target ? Math.atan2(target.y - e.y, target.x - e.x) : e.facing;
  e.recall = 0; e.cd[slot] = [4.5, 7, 23][slot] * e.haste; e.facing = angle; e.attackAnim = .42; e.attackStarted = s.time; e.castStarted = s.time; e.castSlot = slot; e.itemState.empowered = s.time + 5;
  const color = HEROES[e.hero].color, origin = { x: e.x, y: e.y };
  if (slot === 0) {
    const length = [490, 410, 330, 460][e.hero];
    e.x += Math.cos(angle) * length; e.y += Math.sin(angle) * length; resolveBody(s, e);
    e.motion = { ...origin, start: s.time, duration: .38, arc: [95, 30, 160, 130][e.hero] };
    s.effects.push({ ...origin, tx: e.x, ty: e.y, color, type: 'beam', life: .45, maxLife: .45 });
    if (e.hero === 0) { e.cloak = s.time + 2; e.revealedUntil = -1; e.ambushReady = true; }
    if (e.hero === 1) { e.hp = Math.min(e.maxHp, e.hp + 190); s.zones.push({ ...origin, team: e.team, source: e.id, radius: 180, life: 7, tick: 0, type: 'water' }); }
    if (e.hero === 2) e.shield = Math.max(e.shield, 380);
    if (e.hero === 3) { area(s, e, e, 160, 165 + e.level * 12, { stun: .65 }); burst(s, e.x, e.y, color, 160); }
  } else if (slot === 1) {
    if (e.hero === 0) { area(s, e, e, 270, 190 + e.level * 16, { slow: 3 }); burst(s, e.x, e.y, color, 270); }
    if (e.hero === 1) {
      for (const t of s.units) if (hostile(s, e, t) && distance(e, t) < 440 && lineOfSight(s, e, t)) {
        const a = Math.atan2(t.y - e.y, t.x - e.x), delta = Math.atan2(Math.sin(a - angle), Math.cos(a - angle));
        if (Math.abs(delta) > 1) continue;
        damage(s, e, t, 200 + e.level * 12);
        if (!['tower', 'core'].includes(t.kind)) { t.x = e.x + Math.cos(a) * 95; t.y = e.y + Math.sin(a) * 95; t.slow = 2; resolveBody(s, t); }
        s.effects.push({ ...origin, tx: t.x, ty: t.y, color, type: 'beam', life: .5, maxLife: .5 });
      }
      burst(s, e.x, e.y, color, 390);
    }
    if (e.hero === 2) {
      const point = { x: e.x + Math.cos(angle) * 290, y: e.y + Math.sin(angle) * 290, radius: 20 }; resolveBody(s, point);
      s.traps.push({ ...point, team: e.team, source: e.id, life: 16, armed: s.time + .5 }); burst(s, point.x, point.y, color, 80);
    }
    if (e.hero === 3) { area(s, e, e, 260, 175 + e.level * 12, { fear: 1.25 }); burst(s, e.x, e.y, color, 260); }
  } else {
    if (e.hero === 0) { area(s, e, e, 340, 340 + e.level * 20, { fear: 1.2 }); e.cloak = s.time + 6; e.sightUntil = s.time + 6; e.revealedUntil = -1; e.ambushReady = true; }
    if (e.hero === 1) { area(s, e, e, 460, 370 + e.level * 20, { slow: 4 }); s.zones.push({ ...origin, source: e.id, team: e.team, radius: 460, life: 7, tick: 0, type: 'water' }); for (const t of s.units) if (t.kind === 'hero' && t.team === e.team && distance(e, t) < 460 && t.hp > 0) t.hp = Math.min(t.maxHp, t.hp + 340); }
    if (e.hero === 2) s.zones.push({ ...origin, source: e.id, team: e.team, radius: 360, life: 2.5, tick: 0, type: 'stomp' });
    if (e.hero === 3) { e.frenzy = s.time + 8; e.shield = Math.max(e.shield, 250); }
    burst(s, e.x, e.y, color, e.hero === 1 ? 460 : 340, 'ultimate');
  }
  if (!(e.hero === 0 && slot !== 1)) e.revealedUntil = s.time + 2.6;
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
    if (source && s.time <= e.burn.until + dt) damage(s, source, e, e.burn.amount, 'item');
    if (e.burn) e.burn.tick += 1;
  }
  if (e.burn && e.burn.until < s.time) e.burn = null;
  if (e.kind !== 'hero' || e.hp <= 0) return;
  e.hp = Math.min(e.maxHp, e.hp + e.regen * dt);
  const v = e.itemState;
  if (s.time >= (v.aura || 0)) {
    v.aura = s.time + 1;
    if (hasItem(e, 'grave')) for (const t of s.units) if (hostile(s, e, t) && distance(e, t) < 220 && lineOfSight(s, e, t)) damage(s, e, t, 24, 'item');
    if (hasItem(e, 'beacon')) for (const t of s.units) if (t.kind === 'hero' && t.team === e.team && t.hp > 0 && distance(e, t) < 300) t.hp = Math.min(t.maxHp, t.hp + 24);
  }
}
function spawnWave(s) {
  s.wave++;
  for (let team = 0; team < 2; team++) for (let lane = 0; lane < 3; lane++) for (let i = 0; i < 3; i++) {
    const front = LANES[lane][2], base = s.wave === 1 ? { x: front.x, y: front.y + (team ? -1 : 1) * 370 } : BASES[team], siege = i === 2 && s.wave % 3 === 0;
    add(s, { kind: 'minion', team, lane, x: base.x + (i - 1) * 32, y: base.y + (team ? 1 : -1) * i * 28, waypoint: s.wave === 1 ? 2 : 1, hp: siege ? 780 : 390, maxHp: siege ? 780 : 390, damage: siege ? 88 : 45, rate: 1, range: siege ? 270 : 95, speed: 205, radius: 16, sprite: team ? 5 : 4, siege });
  }
}
function followLane(s, e, dt) {
  const path = e.team ? [...LANES[e.lane]].reverse() : LANES[e.lane];
  // On returning from a chase, skip waypoints already behind the unit.
  if (e.waypoint < 2 && (e.team ? e.y > path[1].y + 100 : e.y < path[1].y - 100)) e.waypoint = 2;
  const p = path[Math.min(e.waypoint, path.length - 1)];
  if (distance(e, p) < 80 && e.waypoint < path.length - 1) e.waypoint++;
  move(s, e, p.x, p.y, dt, e.speed * (e.slow > 0 ? .52 : 1));
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
    if (d > e.range * .9 + t.radius) move(s, e, t.x, t.y, dt, e.speed * (e.slow > 0 ? .5 : .9));
    else if (e.range > 250 && d < 145 && t.kind === 'hero') move(s, e, e.x + e.x - t.x, e.y + e.y - t.y, dt);
    attack(s, e, t);
    if (d < (e.hero === 2 ? 420 : 250) && e.cd[1] <= 0) cast(s, e, 1);
    if (t.kind === 'hero' && e.level >= 3 && d < 280 && e.cd[2] <= 0) cast(s, e, 2);
    if (t.kind === 'hero' && d > 340 && d < 560 && e.cd[0] <= 0) cast(s, e, 0);
  } else followLane(s, e, dt);
}
function terrainEffects(s, dt) {
  for (const z of s.zones) {
    z.life -= dt; z.tick -= dt;
    const source = s.units.find(e => e.id === z.source);
    if (source && z.tick <= 0) {
      z.tick = z.type === 'stomp' ? .9 : .6;
      area(s, source, z, z.radius, z.type === 'stomp' ? 200 + source.level * 12 : 38, z.type === 'stomp' ? { stun: .45 } : { slow: 1 });
      if (z.type === 'stomp') burst(s, z.x, z.y, '#edc47c', z.radius, 'ultimate');
    }
  }
  s.zones = s.zones.filter(z => z.life > 0);
  for (const t of s.traps) {
    t.life -= dt; if (s.time < t.armed) continue;
    const source = s.units.find(e => e.id === t.source), enemy = s.units.find(e => e.hp > 0 && e.team !== t.team && e.team >= 0 && !['core', 'tower'].includes(e.kind) && distance(e, t) < 95);
    if (source && enemy) { area(s, source, t, 145, 260 + source.level * 20, { stun: 1.4 }); burst(s, t.x, t.y, '#dceb80', 145); t.life = 0; }
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
    const boss = add(s, { kind: 'boss', name: 'Wild Hunt', team: -1, x: 2400, y: 2400, homeX: 2400, homeY: 2400, hp: 3300, maxHp: 3300, damage: 95, range: 200, speed: 125, rate: 1.2, sprite: 8, radius: 55 });
    s.objective = boss.id; announce(s, 'The Wild Hunt awakens', 'Slay the great beast. It will fight for your team.');
  }
  for (let i = 0; i < CAMPS.length; i++) if (s.time >= s.campTimers[i] && !s.units.some(e => e.kind === 'camp' && e.camp === i && e.hp > 0)) {
    const p = CAMPS[i]; add(s, { kind: 'camp', name: i ? 'Lantern spirit' : 'Will-o-wisp', team: -1, camp: i, ...p, homeX: p.x, homeY: p.y, hp: 960, maxHp: 960, damage: 55, range: 170, speed: 120, rate: 1.1, sprite: i ? 9 : 10, radius: 30 });
  }
  terrainEffects(s, dt);
  for (const e of [...s.units]) {
    for (const key of ['attackCd', 'attackAnim', 'hit', 'stun', 'slow', 'fear']) e[key] = Math.max(0, (e[key] || 0) - dt);
    e.moving = false; itemTick(s, e, dt); resolveAttack(s, e);
    if (e.kind === 'hero') {
      e.cd = e.cd.map(c => Math.max(0, c - dt)); e.portalCd = Math.max(0, e.portalCd - dt); e.gold += dt * 3.2;
      if ((!e.player || input.autopilot) && s.time >= (e.nextShop || 0)) { const id = nextPurchase(e); if (id) buy(s, id, e); e.nextShop = s.time + 2; }
      if (e.hp <= 0) {
        e.respawn -= dt;
        if (e.respawn <= 0) { Object.assign(e, BASES[e.team]); e.hp = e.maxHp; e.shield = 140; e.waypoint = 1; e.cd = [0, 0, Math.min(6, e.cd[2])]; e.cloak = 0; e.revealedUntil = -1; if (e.player) announce(s, 'A legend returns', 'Leave the rift or take a portal to rejoin the hunt.'); }
        continue;
      }
      if (distance(e, BASES[e.team]) < 215) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * .24 * dt);
      else if (s.time - e.lastHit > 5) e.hp = Math.min(e.maxHp, e.hp + 12 * dt);
      e.shield = Math.max(0, e.shield - dt * 13);
      if (concealed(s, e)) e.ambushReady = true;
      else if (e.cloak <= s.time && !concealed(s, e)) e.ambushReady = false;
      if (e.stun > 0) continue;
      if (e.fear > 0) { move(s, e, e.x + (e.x - e.fearX), e.y + (e.y - e.fearY), dt, e.speed * .8); continue; }
      if (!e.player || input.autopilot) { bot(s, e, dt); continue; }
      const dx = input.x || 0, dy = input.y || 0, moving = Math.hypot(dx, dy) > .12;
      if (moving) {
        const mag = Math.max(1, Math.hypot(dx, dy)), sprint = s.time - e.lastHit > 3 && s.time > e.revealedUntil ? 1.35 : 1;
        const speed = e.speed * sprint * (e.slow > 0 ? .52 : 1) * (e.frenzy > s.time ? 1.25 : 1) * (e.huntUntil > s.time ? 1.2 : 1) * (e.hero === 1 && inWater(e) ? 1.4 : 1);
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
        const selected = s.units.find(x => x.id === input.target && hostile(s, e, x) && canSee(s, e, x) && distance(e, x) <= e.range + x.radius);
        const t = selected || nearest(s, e, e.range, true); e.target = t?.id || 0;
        if (input.attack !== false) attack(s, e, t);
      }
    } else {
      if (e.hp <= 0 || e.stun > 0) continue;
      if (e.fear > 0 && e.speed > 0) { move(s, e, e.x + e.x - e.fearX, e.y + e.y - e.fearY, dt); continue; }
      if (e.kind === 'tower' || e.kind === 'core') {
        let t = s.units.find(x => x.id === e.aggro && s.time < e.aggroUntil && x.hp > 0 && distance(e, x) < e.range && canSee(s, e, x));
        if (!t) t = s.units.filter(x => x.team !== e.team && x.team !== -1 && x.hp > 0 && distance(e, x) < e.range && canSee(s, e, x) && !['tower', 'core'].includes(x.kind)).sort((a, b) => (a.kind === 'hero') - (b.kind === 'hero') || distance(e, a) - distance(e, b))[0];
        attack(s, e, t);
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
