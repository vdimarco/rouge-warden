// Tidebreak's fixed-step battle rules. No browser, network, or rendering dependencies.
export const SIZE = 1600;
export const HEROES = [
  { name: 'Nacre', role: 'Reef duelist', note: 'Close the gap. Cut through a lane.', hp: 1320, speed: 190, range: 126, damage: 110, rate: .65, color: '#63eee2', sprite: 0, skills: ['Slipstream', 'Crescent', 'Tidal break'] },
  { name: 'Brine', role: 'Shell guardian', note: 'Hold the line. Shelter your team.', hp: 1880, speed: 155, range: 110, damage: 105, rate: .85, color: '#ffb36a', sprite: 1, skills: ['Anchor rush', 'Shell guard', 'Reef quake'] },
  { name: 'Vela', role: 'Current weaver', note: 'Strike from range. Restore your allies.', hp: 1050, speed: 180, range: 265, damage: 84, rate: .78, color: '#ccb4ff', sprite: 2, skills: ['Drift', 'Bloom', 'Starfall'] },
];
export const BASES = [{ x: 800, y: 1410 }, { x: 800, y: 190 }];
export const LANES = [
  [{ x: 800, y: 1410 }, { x: 435, y: 1190 }, { x: 300, y: 800 }, { x: 435, y: 410 }, { x: 800, y: 190 }],
  [{ x: 800, y: 1410 }, { x: 800, y: 1080 }, { x: 800, y: 800 }, { x: 800, y: 520 }, { x: 800, y: 190 }],
  [{ x: 800, y: 1410 }, { x: 1165, y: 1190 }, { x: 1300, y: 800 }, { x: 1165, y: 410 }, { x: 800, y: 190 }],
];
export const UPGRADES = [
  { id: 'fang', name: 'Reef fang', text: '+24 attack damage', cost: 200 },
  { id: 'shell', name: 'Living shell', text: '+320 maximum health', cost: 200 },
  { id: 'current', name: 'Quick current', text: '15% shorter skill cooldowns', cost: 200 },
];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function add(s, data) { const e = { id: s.nextId++, hp: 100, maxHp: 100, radius: 18, speed: 0, range: 100, damage: 10, rate: 1, attackCd: 0, hit: 0, shield: 0, stun: 0, facing: -Math.PI / 2, ...data }; s.units.push(e); return e; }
function hero(s, team, kind, lane, player = false) {
  const h = HEROES[kind], b = BASES[team];
  return add(s, { kind: 'hero', team, hero: kind, name: h.name, sprite: kind, x: b.x + (lane - 1) * 72, y: b.y, hp: h.hp, maxHp: h.hp, speed: h.speed, range: h.range, damage: h.damage, rate: h.rate, lane, waypoint: 1, player, level: 1, xp: 0, gold: 0, kills: 0, deaths: 0, assists: 0, respawn: 0, cd: [0, 0, 0], haste: 1, upgrades: {}, lastHit: -100, recall: 0, target: 0, attackAnim: 0 });
}
export function createMatch(kind = 0, seed = 49) {
  const s = { time: 0, nextId: 1, units: [], effects: [], floaters: [], messages: [], random: rng(seed), seed, score: [0, 0], towers: [3, 3], wave: 0, nextWave: 2, objectiveAt: 30, objective: null, winner: null, reason: '', tide: false, tideCount: 0, stats: { damage: 0, towers: 0, leviathans: 0 } };
  for (let team = 0; team < 2; team++) {
    add(s, { kind: 'core', name: team ? 'Coral heart' : 'Reef heart', team, ...BASES[team], hp: 4300, maxHp: 4300, radius: 62, sprite: 8, range: 250, damage: 100, rate: 1.3 });
    for (let lane = 0; lane < 3; lane++) {
      const p = LANES[lane][team ? 3 : 1];
      add(s, { kind: 'tower', name: 'Coral spire', team, lane, ...p, hp: 2200, maxHp: 2200, radius: 35, range: 255, damage: 145, rate: 1.1, sprite: team ? 7 : 6 });
    }
  }
  const p = hero(s, 0, kind, 1, true); p.y -= 75; s.playerId = p.id;
  hero(s, 0, (kind + 1) % 3, 0); hero(s, 0, (kind + 2) % 3, 2);
  const roster = [0, 1, 2];
  for (let i = 2; i > 0; i--) { const j = Math.floor(s.random() * (i + 1)); [roster[i], roster[j]] = [roster[j], roster[i]]; }
  for (let lane = 0; lane < 3; lane++) hero(s, 1, roster[lane], lane);
  announce(s, 'Break their heart', 'Escort your waves. Break a spire to expose the enemy heart.');
  return s;
}
export const player = s => s.units.find(e => e.id === s.playerId);
export function announce(s, title, detail = '') { s.messages.push({ title, detail, time: s.time }); if (s.messages.length > 5) s.messages.shift(); }
function burst(s, x, y, color, radius = 65, type = 'ring') { s.effects.push({ x, y, color, radius, type, life: .65, maxLife: .65 }); }
function reward(s, team, xp, gold) {
  for (const h of s.units.filter(e => e.kind === 'hero' && e.team === team)) {
    h.gold += gold; h.xp += xp;
    if (h.level < 8 && h.xp >= h.level * 100) {
      h.xp -= h.level * 100; h.level++; h.maxHp += 95; h.hp = Math.min(h.maxHp, h.hp + 200); h.damage += 12;
      if (h.player) { burst(s, h.x, h.y, '#f2d292', 110); announce(s, `Level ${h.level}`, h.level === 3 ? 'Your ultimate is ready.' : 'Health and attack increased.'); }
    }
  }
}
function finish(s, winner, reason) { s.winner = winner; s.reason = reason; announce(s, winner === 0 ? 'The reef is yours' : 'The heart has fallen', reason); }
export function damage(s, source, target, amount) {
  if (!target || target.hp <= 0 || s.winner !== null) return;
  if (target.kind === 'core' && s.towers[target.team] === 3) { if (source.player && s.time - (s.lockTip || -10) > 4) { announce(s, 'Heart protected', 'Break any enemy spire first.'); s.lockTip = s.time; } return; }
  if (target.kind === 'hero' && target.respawn > 0) return;
  const absorbed = Math.min(target.shield, amount); target.shield -= absorbed; amount -= absorbed;
  target.hp = Math.max(0, target.hp - amount); target.hit = .16; target.lastHit = s.time;
  if (source.player) s.stats.damage += amount;
  if (source.player || target.player || target.kind === 'tower') s.floaters.push({ x: target.x, y: target.y - 44, text: Math.round(amount), color: target.player ? '#ff927e' : '#fff4c9', life: .8 });
  if (target.kind === 'hero' && source.kind === 'hero') {
    for (const t of s.units.filter(e => e.kind === 'tower' && e.team === target.team && e.hp > 0 && distance(e, source) < e.range)) { t.aggro = source.id; t.aggroUntil = s.time + 3; }
  }
  if (target.hp > 0) return;
  burst(s, target.x, target.y, target.team === 0 ? '#68e8da' : '#ff806a', target.kind === 'hero' ? 90 : 50);
  if (target.kind === 'hero') {
    target.deaths++; target.respawn = 6 + target.level; target.recall = 0;
    if (source.team >= 0) { s.score[source.team]++; reward(s, source.team, 85, 100); if (source.kind === 'hero') source.kills++; }
    if (target.player) announce(s, 'Return with the tide', `Respawn in ${target.respawn} seconds.`);
    else if (source.player) announce(s, `${target.name} defeated`, '+100 pearls · Team experience');
  } else if (target.kind === 'tower') {
    s.towers[target.team]--; reward(s, source.team, 110, 150); if (source.team === 0) s.stats.towers++;
    announce(s, target.team === 1 ? 'Enemy spire broken' : 'Our spire has fallen', 'The heart can now take damage.');
  } else if (target.kind === 'core') finish(s, 1 - target.team, 'Enemy heart destroyed.');
  else if (target.kind === 'boss') {
    reward(s, source.team, 120, 140); s.objectiveAt = s.time + 65; s.objective = null;
    const lane = source.lane ?? 1, path = source.team ? [...LANES[lane]].reverse() : LANES[lane];
    add(s, { kind: 'leviathan', name: 'Leviathan', team: source.team, x: path[2].x, y: path[2].y, lane, waypoint: 3, hp: 2500, maxHp: 2500, radius: 45, range: 170, damage: 220, rate: 1.3, speed: 72, sprite: 5 });
    if (source.team === 0) s.stats.leviathans++;
    announce(s, source.team === 0 ? 'Leviathan joins us' : 'Enemy claimed Leviathan', 'It will break a path through the lane.');
  } else if (source.team >= 0) reward(s, source.team, target.kind === 'leviathan' ? 80 : 13, target.kind === 'leviathan' ? 70 : 9);
}
function canTarget(s, a, b) {
  return b.hp > 0 && a.id !== b.id && a.team !== b.team && !(b.kind === 'core' && s.towers[b.team] === 3) && (b.team !== -1 || a.kind === 'hero' || a.kind === 'boss');
}
function nearest(s, a, range, preferHero = false) {
  let best = null, score = Infinity;
  for (const b of s.units) {
    if (!canTarget(s, a, b)) continue;
    const d = distance(a, b); if (d > range + b.radius) continue;
    const n = d + (preferHero && b.kind !== 'hero' ? 90 : 0);
    if (n < score) { score = n; best = b; }
  }
  return best;
}
function move(e, x, y, dt, speed = e.speed) {
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
  if (d > 2) { const n = Math.min(d, speed * dt); e.x = clamp(e.x + dx / d * n, 170, 1430); e.y = clamp(e.y + dy / d * n, 130, 1470); e.facing = Math.atan2(dy, dx); e.moving = true; }
}
function attack(s, e, t) {
  if (!t || e.attackCd > 0 || distance(e, t) > e.range + t.radius) return;
  e.attackCd = e.rate; e.attackAnim = .24; e.facing = Math.atan2(t.y - e.y, t.x - e.x);
  const multiplier = s.time > 180 ? 1 + (s.time - 180) / 140 : 1;
  damage(s, e, t, e.damage * multiplier);
  s.effects.push({ type: e.range > 180 ? 'beam' : 'slash', x: e.x, y: e.y - 20, tx: t.x, ty: t.y - 20, radius: e.range, color: e.team === 0 ? '#8cfff0' : e.team === 1 ? '#ff806f' : '#e6ce8c', life: .19, maxLife: .19 });
}
export function cast(s, e, slot, aim) {
  if (e.hp <= 0 || e.stun > 0 || e.cd[slot] > 0 || s.winner !== null || (slot === 2 && e.level < 3)) return false;
  const target = nearest(s, e, slot === 2 ? 410 : 330, true);
  const angle = aim && Math.hypot(aim.x, aim.y) > .1 ? Math.atan2(aim.y, aim.x) : target ? Math.atan2(target.y - e.y, target.x - e.x) : e.facing;
  e.recall = 0; e.cd[slot] = [5, 8, 24][slot] * e.haste; e.facing = angle; e.attackAnim = .3;
  const color = HEROES[e.hero].color;
  if (slot === 0) {
    const origin = { x: e.x, y: e.y };
    e.x = clamp(e.x + Math.cos(angle) * (e.hero === 1 ? 175 : 220), 170, 1430); e.y = clamp(e.y + Math.sin(angle) * (e.hero === 1 ? 175 : 220), 130, 1470);
    e.shield = Math.max(e.shield, e.hero === 1 ? 240 : 80);
    s.effects.push({ ...origin, tx: e.x, ty: e.y, color, type: 'beam', life: .4, maxLife: .4 });
    for (const t of s.units) if (canTarget(s, e, t) && distance(t, e) < 125) damage(s, e, t, 120 + e.level * 10);
  } else {
    const center = slot === 2 && e.hero === 2 ? { x: e.x + Math.cos(angle) * 220, y: e.y + Math.sin(angle) * 220 } : e;
    const radius = slot === 2 ? 275 : e.hero === 2 ? 260 : 195;
    burst(s, center.x, center.y, color, radius, slot === 2 ? 'ultimate' : 'ring');
    for (const t of s.units) {
      if (t.hp <= 0 || distance(center, t) > radius + t.radius) continue;
      if (canTarget(s, e, t)) {
        damage(s, e, t, (slot === 2 ? 440 : 195) + e.level * 18);
        if (e.hero === 1 && t.kind !== 'tower' && t.kind !== 'core') t.stun = slot === 2 ? 1.5 : .7;
      } else if (t.team === e.team && t.kind === 'hero') {
        if (e.hero === 1) t.shield = Math.max(t.shield, slot === 2 ? 350 : 260);
        if (e.hero === 2) t.hp = Math.min(t.maxHp, t.hp + (slot === 2 ? 300 : 220));
      }
    }
  }
  return true;
}
export function buy(s, id) {
  const p = player(s), u = UPGRADES.find(x => x.id === id), count = p.upgrades[id] || 0;
  if (!u || count >= 3 || p.gold < u.cost || s.winner !== null) return false;
  p.gold -= u.cost; p.upgrades[id] = count + 1;
  if (id === 'fang') p.damage += 24;
  if (id === 'shell') { p.maxHp += 320; if (p.hp > 0) p.hp += 320; }
  if (id === 'current') p.haste *= .85;
  return true;
}
function spawnWave(s) {
  s.wave++;
  for (let team = 0; team < 2; team++) for (let lane = 0; lane < 3; lane++) for (let i = 0; i < 3; i++) {
    const base = BASES[team], siege = i === 2 && s.wave % 3 === 0;
    add(s, { kind: 'minion', team, lane, x: base.x + (i - 1) * 29, y: base.y + (team ? 1 : -1) * i * 30, waypoint: 1, hp: siege ? 550 : 280, maxHp: siege ? 550 : 280, damage: siege ? 65 : 32, rate: 1.1, range: siege ? 210 : 78, speed: 90, radius: 14, sprite: team ? 4 : 3, siege });
  }
}
function bot(s, e, dt) {
  const base = BASES[e.team], low = e.hp < e.maxHp * .24;
  if (low || e.retreat && e.hp < e.maxHp * .82) { e.retreat = true; move(e, base.x, base.y, dt); return; }
  e.retreat = false;
  let t = nearest(s, e, 370, true);
  const boss = s.units.find(x => x.kind === 'boss' && x.hp > 0);
  if (boss && e.lane === 1 && e.hp > e.maxHp * .6 && !t) t = boss;
  if (t) {
    if (t.kind === 'tower' && !s.units.some(a => a.team === e.team && a.kind === 'minion' && a.hp > 0 && distance(a, t) < 220) && e.hp < e.maxHp * .65) { move(e, base.x, base.y, dt); return; }
    if (distance(e, t) > e.range * .88 + t.radius) move(e, t.x, t.y, dt, e.speed * .84);
    else if (e.range > 200 && distance(e, t) < 130 && t.kind === 'hero') move(e, e.x + (e.x - t.x), e.y + (e.y - t.y), dt);
    attack(s, e, t);
    if (distance(e, t) < 210 && e.cd[1] <= 0) cast(s, e, 1);
    if (t.kind === 'hero' && e.level >= 3 && distance(e, t) < 260 && e.cd[2] <= 0) cast(s, e, 2);
  } else followLane(e, dt);
}
function followLane(e, dt) {
  const path = e.team ? [...LANES[e.lane]].reverse() : LANES[e.lane];
  const p = path[Math.min(e.waypoint, path.length - 1)];
  if (distance(e, p) < 50 && e.waypoint < path.length - 1) e.waypoint++;
  move(e, p.x, p.y, dt);
}
export function step(s, input = {}, dt = 1 / 60) {
  if (s.winner !== null) return;
  dt = clamp(dt, 0, .05); s.time += dt;
  s.effects.forEach(e => e.life -= dt); s.effects = s.effects.filter(e => e.life > 0);
  s.floaters.forEach(e => { e.life -= dt; e.y -= dt * 24; }); s.floaters = s.floaters.filter(e => e.life > 0);
  if (s.time >= s.nextWave) { spawnWave(s); s.nextWave += 15; }
  const tide = s.time >= 50 && s.time % 50 < 12;
  if (tide && !s.tide) { s.tideCount++; announce(s, 'The current rises', 'Move along the center lane for a speed boost.'); }
  s.tide = tide;
  if (!s.objective && s.time >= s.objectiveAt) {
    const boss = add(s, { kind: 'boss', name: 'Leviathan', team: -1, x: 990, y: 800, homeX: 990, homeY: 800, hp: 1900, maxHp: 1900, damage: 65, range: 150, speed: 45, rate: 1.25, sprite: 5, radius: 46 });
    s.objective = boss.id; announce(s, 'Leviathan awakens', 'Defeat it to send a siege beast down your lane.');
  }
  for (const e of [...s.units]) {
    e.attackCd = Math.max(0, e.attackCd - dt); e.attackAnim = Math.max(0, (e.attackAnim || 0) - dt); e.hit = Math.max(0, e.hit - dt); e.stun = Math.max(0, e.stun - dt); e.moving = false;
    if (e.kind === 'hero') {
      e.cd = e.cd.map(c => Math.max(0, c - dt)); e.gold += dt * 1.8;
      if (e.hp <= 0) {
        e.respawn -= dt;
        if (e.respawn <= 0) { Object.assign(e, BASES[e.team]); e.hp = e.maxHp; e.shield = 100; e.waypoint = 1; e.cd = [0, 0, Math.min(6, e.cd[2])]; if (e.player) announce(s, 'Back in the fight', 'Your team needs you.'); }
        continue;
      }
      if (distance(e, BASES[e.team]) < 155) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * .18 * dt);
      else if (s.time - e.lastHit > 5) e.hp = Math.min(e.maxHp, e.hp + 5 * dt);
      e.shield = Math.max(0, e.shield - dt * 10);
      if (e.stun > 0) continue;
      if (!e.player || input.autopilot) { bot(s, e, dt); continue; }
      const dx = input.x || 0, dy = input.y || 0, moving = Math.hypot(dx, dy) > .12;
      if (moving) { const mag = Math.max(1, Math.hypot(dx, dy)); move(e, e.x + dx / mag * 200, e.y + dy / mag * 200, dt, e.speed * (tide && Math.abs(e.x - 800) < 110 ? 1.35 : 1)); e.recall = 0; }
      if (input.recall && !e.recall) e.recall = 3;
      if (e.recall > 0) {
        if (moving || s.time - e.lastHit < .2) e.recall = 0;
        else { e.recall -= dt; if (e.recall <= 0) { Object.assign(e, BASES[0]); burst(s, e.x, e.y, '#b5ffff', 130); } }
      }
      if (input.cast !== undefined) cast(s, e, input.cast, input.aim);
      if (!e.recall) {
        const selected = s.units.find(x => x.id === input.target && canTarget(s, e, x) && distance(e, x) <= e.range + x.radius);
        const t = selected || nearest(s, e, e.range, true); e.target = t?.id || 0;
        if (input.attack !== false) attack(s, e, t);
      }
    } else {
      if (e.hp <= 0 || e.stun > 0) continue;
      if (e.kind === 'tower' || e.kind === 'core') {
        let t = s.units.find(x => x.id === e.aggro && s.time < e.aggroUntil && x.hp > 0 && distance(e, x) < e.range);
        if (!t) t = s.units.filter(x => x.team !== e.team && x.team !== -1 && x.hp > 0 && distance(e, x) < e.range && !['tower', 'core'].includes(x.kind)).sort((a, b) => (a.kind === 'hero') - (b.kind === 'hero') || distance(e, a) - distance(e, b))[0];
        attack(s, e, t);
      } else if (e.kind === 'boss') {
        const t = nearest(s, e, 200);
        if (t) { attack(s, e, t); if (distance(e, t) > e.range) move(e, t.x, t.y, dt); }
        else move(e, e.homeX, e.homeY, dt);
      } else {
        const t = nearest(s, e, e.range + 90);
        if (t) { if (distance(e, t) > e.range + t.radius) move(e, t.x, t.y, dt); attack(s, e, t); } else followLane(e, dt);
      }
    }
  }
  // Gentle unit separation keeps lane waves legible without trapping the player.
  const bodies = s.units.filter(e => e.hp > 0 && e.speed > 0);
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j], d = distance(a, b), min = (a.radius + b.radius) * .8;
    if (d > .01 && d < min) { const f = (min - d) * .15, x = (a.x - b.x) / d * f, y = (a.y - b.y) / d * f; a.x = clamp(a.x + x, 170, 1430); a.y = clamp(a.y + y, 130, 1470); b.x = clamp(b.x - x, 170, 1430); b.y = clamp(b.y - y, 130, 1470); }
  }
  s.units = s.units.filter(e => e.hp > 0 || ['hero', 'tower', 'core'].includes(e.kind));
  if (s.time >= 240 && s.winner === null) {
    const value = team => s.units.filter(e => e.team === team && ['core', 'tower'].includes(e.kind)).reduce((v, e) => v + e.hp, 0);
    const a = value(0), b = value(1); finish(s, a === b ? -1 : a > b ? 0 : 1, 'Four minutes. The team with more structure health wins.');
  }
}
