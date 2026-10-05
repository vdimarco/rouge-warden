// Distance-based three-lane runner. Presentation never decides collisions.
export const JUMP_SECONDS = .86;
export const DUCK_SECONDS = .82;
export const VIEW_DISTANCE = 115;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const emptyInput = () => ({ actions: [] });
export function queueAction(input, action) { if (input.actions.length < 8) input.actions.push(action); }
export const speedAt = time => Math.min(42, 22 + time * .18);

export function createGame(seed = Date.now()) {
  const g = { seed: seed >>> 0, rng: seed >>> 0, phase: 'playing', time: 0, distance: 0,
    lane: 1, visualLane: 1, speed: 22, action: '', actionTime: 0, buffered: '', bufferTime: 0,
    coins: 0, score: 0, bonus: 0, streak: 0, multiplier: 1, lastCoin: -10,
    charge: 0, rush: 0, magnet: 0, shield: true, grace: 0,
    jumps: 0, ducks: 0, dodges: 0, shieldsUsed: 0, rowsPassed: 0,
    goalsCleared: 0, goal: { kind: 'tricks', start: 0, target: 3 },
    entities: [], nextRow: 46, row: 0, nextId: 1,
    event: '', eventId: 0, effects: [], notice: 'Jump logs · Duck branches · Dodge rocks', noticeUntil: 4, reason: '' };
  for (let d = 7; d <= 32; d += 5) add(g, 'coin', 1, d);
  generateAhead(g); return g;
}
function random(g) { g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0; return g.rng / 4294967296; }
function add(g, type, lane, d, extra = {}) { g.entities.push({ id: g.nextId++, type, lane, d, done: false, ...extra }); }
function emit(g, type, text = '', lane = g.lane) {
  g.event = type; g.eventId++;
  g.effects.push({ type, time: g.time, lane, id: g.eventId });
  if (g.effects.length > 24) g.effects.shift();
  if (text) { g.notice = text; g.noticeUntil = g.time + 1.35; }
}
export function generateAhead(g) {
  while (g.nextRow < g.distance + VIEW_DISTANCE + 45) {
    const d = g.nextRow, row = g.row++;
    const predictedTime = g.time + Math.max(0, d - g.distance) / speedAt(g.time);
    const level = Math.min(1, predictedTime / 95);
    const safe = row < 2 ? 0 : row === 2 ? 2 : Math.floor(random(g) * 3);
    const occupied = [0, 1, 2].filter(l => l !== safe);
    const types = ['rock', 'log', 'branch'];
    let hazards;
    if (row < 3) hazards = [{ lane: 1, type: ['log', 'branch', 'rock'][row] }];
    else {
      // Ordinary rows have a clear lane; action barriers below remain traversable.
      const pair = row % 5 === 3 || random(g) < .3 + level * .45;
      const first = occupied[Math.floor(random(g) * 2)];
      hazards = [{ lane: first, type: types[Math.floor(random(g) * 3)] }];
      if (pair) hazards.push({ lane: occupied.find(l => l !== first), type: types[Math.floor(random(g) * 3)] });
    }
    if (row >= 5 && row % 12 === 5) hazards = [0,1,2].map(lane => ({ lane, type: 'log' }));
    if (row >= 6 && row % 12 === 6) hazards = [0,1,2].map(lane => ({ lane, type: 'branch' }));
    hazards.forEach(h => add(g, h.type, h.lane, d, { row }));
    const coinLane = row < 2 ? 1 : safe;
    for (let offset = -17; offset <= -2; offset += 5) add(g, 'coin', coinLane, d + offset);
    const actionHazard = hazards.find(h => h.type !== 'rock');
    if (actionHazard) {
      // Gold over logs is collected only while airborne. Duck routes pay on clearing.
      add(g, 'coin', actionHazard.lane, d, { high: actionHazard.type === 'log' });
      add(g, 'coin', actionHazard.lane, d + 5);
    }
    if (row % 13 === 6) add(g, 'magnet', safe, d - 8);
    if (row % 17 === 11) add(g, 'shield', safe, d - 8);
    const interval = 1.17 - level * .2;
    g.nextRow += speedAt(predictedTime) * interval;
  }
  g.entities.sort((a, b) => a.d - b.d || a.id - b.id);
}
export function jumpHeight(g) {
  return g.action === 'jump' ? Math.sin(Math.PI * clamp(g.actionTime / JUMP_SECONDS, 0, 1)) : 0;
}
function beginAction(g, action) {
  g.action = action; g.actionTime = 0; g.buffered = ''; g.bufferTime = 0;
  emit(g, action);
}
export function applyAction(g, action) {
  if (g.phase !== 'playing') return;
  if (action === 'left' || action === 'right') {
    const lane = clamp(g.lane + (action === 'left' ? -1 : 1), 0, 2);
    if (lane !== g.lane) { g.lane = lane; emit(g, 'swap'); }
  } else if (action === 'jump' || action === 'duck') {
    if (g.action === action) { g.buffered = action; g.bufferTime = .2; }
    else beginAction(g, action); // Down cancels jump; up cancels duck, immediately.
  } else if (action === 'rush' && g.charge >= 100 && !g.rush) {
    g.charge = 0; g.rush = 4; emit(g, 'rush', 'RUSH! Smash through everything');
  }
}
function collide(g, obstacle) {
  if (g.rush > 0 || g.grace > 0) { emit(g, 'smash'); return; }
  if (g.shield) {
    g.shield = false; g.shieldsUsed++; g.grace = 1.1;
    g.streak = 0; g.multiplier = 1;
    emit(g, 'hit', 'Shield saved you! Next hit ends the run'); return;
  }
  g.phase = 'lost';
  g.reason = obstacle.type === 'rock' ? 'Rock hit. Switch lanes to dodge boulders.' : obstacle.type === 'log' ? 'Log hit. Jump as it reaches your raft.' : 'Branch hit. Duck as it reaches your raft.';
  emit(g, 'lose', 'WIPEOUT');
}
export function updateGame(g, input, dt) {
  if (g.phase !== 'playing') return;
  dt = clamp(dt, 0, .05);
  const taps = input.actions.splice(0);
  taps.forEach(action => applyAction(g, action));
  g.time += dt;
  if (g.action) {
    g.actionTime += dt;
    if (g.actionTime >= (g.action === 'jump' ? JUMP_SECONDS : DUCK_SECONDS)) {
      g.action = ''; g.actionTime = 0;
      if (g.bufferTime > 0) beginAction(g, g.buffered);
    }
  }
  g.bufferTime = Math.max(0, g.bufferTime - dt);
  g.magnet = Math.max(0, g.magnet - dt); g.grace = Math.max(0, g.grace - dt);
  g.speed = speedAt(g.time) * (g.rush > 0 ? 1.32 : 1);
  g.rush = Math.max(0, g.rush - dt);
  g.visualLane += (g.lane - g.visualLane) * (1 - Math.exp(-dt * 24));
  const previous = g.distance;
  g.distance += g.speed * dt;
  if (g.time - g.lastCoin > 2.8) { g.streak = 0; g.multiplier = 1; }
  for (const e of g.entities) {
    if (e.done || e.d > g.distance || e.d <= previous) continue;
    e.done = true;
    if (e.type === 'coin') {
      if ((e.lane === g.lane && (!e.high || jumpHeight(g) > .28)) || g.magnet > 0 || g.rush > 0) {
        g.coins++; g.streak++; g.lastCoin = g.time;
        g.multiplier = Math.min(5, 1 + Math.floor(g.streak / 8));
        g.bonus += 10 * g.multiplier; if (!g.rush) g.charge = Math.min(100, g.charge + 2);
        emit(g, 'coin', g.streak % 8 === 0 ? `COIN STREAK ×${g.multiplier}` : '', e.lane);
      }
    } else if (e.type === 'magnet' || e.type === 'shield') {
      if (e.lane === g.lane) {
        if (e.type === 'magnet') g.magnet = 8; else g.shield = true;
        emit(g, 'power', e.type === 'magnet' ? 'MAGNET! All lanes pay' : 'SHIELD! One free hit');
      }
    } else {
      g.rowsPassed++;
      if (e.lane === g.lane) {
        const cleared = (e.type === 'log' && jumpHeight(g) > .28) || (e.type === 'branch' && g.action === 'duck');
        if (cleared && !g.rush) {
          const type = e.type === 'log' ? 'jump' : 'duck';
          g[type === 'jump' ? 'jumps' : 'ducks']++;
          g.bonus += 100 * g.multiplier; g.charge = Math.min(100, g.charge + 12);
          emit(g, 'perfect', `PERFECT ${type.toUpperCase()} +${100 * g.multiplier}`);
        } else collide(g, e);
      } else { g.dodges++; if (!g.rush) g.charge = Math.min(100, g.charge + 2); }
    }
    if (g.phase !== 'playing') break;
  }
  if (g.phase === 'playing') {
    const totals = { tricks: g.jumps + g.ducks, coins: g.coins, distance: g.distance };
    if (totals[g.goal.kind] - g.goal.start >= g.goal.target) {
      g.goalsCleared++; g.bonus += 500;
      if (!g.rush) g.charge = Math.min(100, g.charge + 20);
      emit(g, 'goal', 'CHALLENGE CLEARED +500');
      const kind = ['tricks', 'coins', 'distance'][g.goalsCleared % 3];
      g.goal = { kind, start: totals[kind], target: kind === 'tricks' ? 3 + Math.min(5, g.goalsCleared) : kind === 'coins' ? 40 : 500 };
    }
  }
  g.score = Math.floor(g.distance * 2) + g.bonus;
  g.effects = g.effects.filter(e => g.time - e.time < .75);
  g.entities = g.entities.filter(e => e.d > g.distance - 16);
  if (g.phase === 'playing') generateAhead(g);
}
export function snapshot(g) {
  const next = g.entities.find(e => !e.done && e.lane === g.lane && ['rock', 'log', 'branch'].includes(e.type));
  return { phase: g.phase, time: g.time, distance: Math.floor(g.distance), lane: g.lane,
    action: g.action, coins: g.coins, score: g.score, streak: g.streak, multiplier: g.multiplier,
    charge: g.charge, rush: g.rush, magnet: g.magnet, shield: g.shield, speed: g.speed, streakTime: g.streak ? Math.max(0, 2.8 - (g.time - g.lastCoin)) : 0,
    jumps: g.jumps, ducks: g.ducks, dodges: g.dodges, reason: g.reason,
    goalsCleared: g.goalsCleared, goal: { ...g.goal, progress: Math.min(g.goal.target, Math.floor((g.goal.kind === 'tricks' ? g.jumps + g.ducks : g.goal.kind === 'coins' ? g.coins : g.distance) - g.goal.start)) },
    notice: g.time < g.noticeUntil ? g.notice : '',
    hint: next && next.d - g.distance < 35 ? { id: next.id, type: next.type, in: (next.d - g.distance) / g.speed, safeLane: [0,1,2].find(lane => !g.entities.some(e => e.row === next.row && e.lane === lane && ['rock','log','branch'].includes(e.type))) } : null };
}
export function validBest(value) { return value?.version === 2 && Number.isFinite(value.score) && value.score > 0 ? value : null; }
