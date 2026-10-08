// Last Light's deterministic, DOM-free simulation.
export const CROSSING_SECONDS = 35;
export const CROSSINGS = ['sunset crossing', 'night coast', 'aurora fjord'];
export const HORIZONS = [.56, .60, .62];
export function projectWater(lane, depth, crossing = 0) {
  const horizon = HORIZONS[crossing];
  return { x: .62 + (lane - .5) * (.36 + depth * .92),
    y: horizon + depth * (1.04 - horizon), scale: .18 + depth * 1.55 };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function createVoyage(seed = 17) {
  return { status: 'ready', time: 0, crossing: 0, score: 0, lights: 0, hull: 3,
    x: .5, y: .86, dash: 0, cooldown: 0, safe: 0, spawn: .4,
    entities: [], effects: [], seed: seed >>> 0, nextId: 1, combo: 0 };
}
function random(s) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
export function start(s) { if (s.status === 'ready') s.status = 'playing'; }
export function pause(s) { if (s.status === 'playing') s.status = 'paused'; }
export function resume(s) { if (s.status === 'paused') s.status = 'playing'; }
export function dash(s) {
  if (s.status !== 'playing' || s.cooldown > 0) return false;
  s.dash = .6; s.cooldown = 3; return true;
}
export function update(s, input, elapsed) {
  if (s.status !== 'playing') return;
  const dt = clamp(elapsed, 0, .05);
  s.time += dt;
  s.crossing = Math.min(2, Math.floor(s.time / CROSSING_SECONDS));
  s.dash = Math.max(0, s.dash - dt);
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.safe = Math.max(0, s.safe - dt);
  const speed = s.dash > 0 ? .75 : .34;
  const dx = clamp(input.x || 0, -1, 1), dy = clamp(input.y || 0, -1, 1);
  const diagonal = dx && dy ? Math.SQRT1_2 : 1;
  s.x = clamp(s.x + dx * speed * diagonal * dt, .045, .955);
  s.y = clamp(s.y + dy * speed * diagonal * dt, .64, .91);
  s.spawn -= dt;
  if (s.spawn <= 0) {
    const lane = .06 + random(s) * .88;
    const projected = projectWater(lane, .015, s.crossing);
    const light = random(s) > .38 + s.crossing * .04;
    s.entities.push({ id: s.nextId++, type: light ? 'light' : 'rock',
      ...projected, lane, depth: .015, age: 0, speed: .22 + s.crossing * .035 + random(s) * .025 });
    s.spawn = .62 - s.crossing * .1 + random(s) * .36;
  }
  const remaining = [];
  for (const e of s.entities) {
    e.age += dt;
    if (e.depth !== undefined) {
      e.depth += e.speed * (.28 + e.depth) * dt;
      Object.assign(e, projectWater(e.lane, e.depth, s.crossing));
    } else e.y += e.speed * dt;
    const radius = e.scale === undefined ? 1 : Math.max(.35, Math.min(1, e.scale / 1.3));
    // The logical scene is 2:1, hence horizontal collision radii are halved.
    const hit = Math.abs(e.x - s.x) < (e.type === 'light' ? .03 : .038) * radius
      && Math.abs(e.y - s.y) < (e.type === 'light' ? .048 : .055) * radius;
    if (hit) {
      if (e.type === 'light') {
        s.lights++; s.combo++;
        const points = 10 + Math.min(5, s.combo - 1) * 2;
        s.score += points;
        s.effects.push({ x:e.x, y:e.y, text:'+' + points, age:0, kind:'light' });
        continue;
      }
      if (s.dash > 0) {
        s.score += 5;
        s.effects.push({ x:e.x, y:e.y, text:'clear', age:0, kind:'light' });
        continue;
      }
      if (s.safe <= 0) {
        s.hull--; s.safe = 1.8; s.combo = 0;
        s.effects.push({ x:s.x, y:s.y, text:'hull -1', age:0, kind:'rock' });
        if (s.hull === 0) { s.status = 'lost'; }
        continue;
      }
    }
    if (e.y < 1.04) remaining.push(e);
    else if (e.type === 'light') s.combo = 0;
  }
  s.entities = remaining;
  s.effects = s.effects.filter(e => { e.age += dt; return e.age < .9; });
  if (s.status === 'playing' && s.time >= CROSSING_SECONDS * 3) {
    s.status = 'won'; s.score += s.hull * 100;
  }
}
export function readBest(storage) {
  try {
    const value = JSON.parse(storage.getItem('last-light:best') || '0');
    return Number.isSafeInteger(value) && value >= 0 && value <= 100000 ? value : 0;
  } catch { return 0; }
}
export function saveBest(storage, score, best) {
  const next = Number.isSafeInteger(score) && score >= 0 && score <= 100000 ? Math.max(best, score) : best;
  try { storage.setItem('last-light:best', JSON.stringify(next)); } catch {}
  return next;
}

