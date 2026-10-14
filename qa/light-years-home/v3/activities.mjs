// Light Years Home v3: shared setup for WP4's tests (race, ghost, mission, talk, save, discovery, stunt). A game in a
// zone with every activity slot wired (core/zone.js playSlots), a runner that steps it with a bot or a function and
// collects the events, and small helpers. Not a test file itself.
import { createGame, step, wire, unwire, setMode, registerZone, H } from '../../../public/light-years-home/core/game.js';
import { playSlots } from '../../../public/light-years-home/core/zone.js';
import { createEventBuffer } from '../../../public/light-years-home/core/events.js';

export const WALL = (await import('../../../public/light-years-home/core/world/zones/wall.js')).default;
export const COMA = (await import('../../../public/light-years-home/core/world/zones/coma.js')).default;
export { H };
// An empty place: no traffic, scans, events or missions, so a check sees only what it does itself.
export const QUIET = Object.freeze({ id: 'quiet', name: 'Quiet', chapter: 1, kind: 'pit', object: 'start', R: 2000,
  band: 100, slab: 120, scaleLy: 1000, entry: { pos: [0, 0, 0], heading: 0, speed: 24 }, bodies: [], roads: [], swarms: [],
  rings: [], sparks: [], far: [], sets: {}, rumours: [], secrets: [], events: [], scans: [], missions: [] });

/** wireAll(): every slot (flight, activities, Earth's clock). */
export function wireAll() {
  unwire();
  wire(playSlots());
  registerZone(WALL);
  registerZone(COMA);
  registerZone(QUIET);
}

/**
 * newGame({ zone, seed, at, heading, speed, settings, fresh, mode, done }) → a game in drive. fresh (default false)
 * keeps the opening and WHICH WAY HOME as a new player has them; otherwise the opening is over and the missions in
 * done (default WHICH WAY HOME) are marked done, so nothing interrupts.
 */
export function newGame({ zone = WALL, seed = 1, at = null, heading = 0, speed = 24, settings = null, fresh = false,
  mode = 'drive', save = null, done = ['which-way-home'] } = {}) {
  const game = createGame({ seed, zoneData: zone, at, heading: at ? heading : undefined, speed: at ? speed : undefined,
    settings, mode: fresh ? 'title' : mode, save });
  if (fresh) setMode(game, 'drive');
  else {
    game.story.playAt = 0;
    game.story.openingI = 99;
    for (const id of done) game.progress.missions[id] = game.progress.missions[id] || { done: true };
  }
  return game;
}

/**
 * run(game, drive, seconds, { until, onEvent }) → { events, t }. drive(game) gives the InputRecord each step (a bot's
 * next, or a function). until(game, events) stops early. Every event is kept (a copy).
 */
export function run(game, drive, seconds, { until = null, onEvent = null } = {}) {
  const ev = createEventBuffer();
  const events = [];
  const n = Math.round(seconds / H);
  for (let i = 0; i < n; i++) {
    ev.clear();
    step(game, drive ? drive(game) : {}, ev);
    for (let k = 0; k < ev.n; k++) {
      const e = { ...ev.list[k] };
      events.push(e);
      if (onEvent) onEvent(e, game);
    }
    if (until && until(game, events)) break;
  }
  return { events, t: game.t };
}

/** stepOnce(game, input) → the events of one step. */
export function stepOnce(game, input = {}) {
  const ev = createEventBuffer();
  step(game, input, ev);
  return ev.last();
}

export const of = (events, type) => events.filter((e) => e.type === type);
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };

/** Put the ship somewhere, facing heading (degrees), at a speed, with no streak. */
export function place(game, pos, headingDeg, speed) {
  const yaw = (headingDeg * Math.PI) / 180, s = game.ship;
  s.pos[0] = pos[0]; s.pos[1] = pos[1]; s.pos[2] = pos[2] || 0;
  s.prev.pos[0] = s.pos[0]; s.prev.pos[1] = s.pos[1]; s.prev.pos[2] = s.pos[2];
  s.yaw = yaw; s.prev.yaw = yaw; s.pitch = 0;
  s.vel[0] = Math.sin(yaw) * speed; s.vel[1] = Math.cos(yaw) * speed; s.vel[2] = 0;
  s.speed = speed;
}

/** A memory storage (localStorage's shape). */
export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, map: m,
  };
}
