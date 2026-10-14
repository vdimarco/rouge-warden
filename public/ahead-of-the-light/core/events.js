// Ahead of the Light: the event list (final.md 18.5), the card hook names (12.9) and the step's event buffer.
// Every event is { t, type, ship, ... }. The renderer, sound, captions, survival, card hooks, bots and the run log
// all read the same list. core/race.js re-exports all of this; it lives here so handle.js, survival.js and the
// rest can emit without importing race.js (which imports them). Pure.

export const EVENTS = Object.freeze({
  handling: Object.freeze(['graze', 'hair', 'skimOn', 'skimOff', 'rivalGraze', 'chainEnd', 'bump', 'pickFuel',
    'pickPatch', 'burn', 'oberth', 'dry', 'window', 'hook', 'grab', 'latchCancel', 'letgo', 'redIn', 'release',
    'scorchWarn', 'scorch', 'wake', 'draftFull', 'slingshot', 'drafted', 'shaken', 'contact', 'spill', 'takedown',
    'trapped', 'hit', 'gearUp', 'gearDown', 'headlight', 'lightspeed', 'dropout']),
  survival: Object.freeze(['push', 'pressed', 'warn', 'glareIn', 'glareOut', 'breather', 'shieldPop', 'shieldBack',
    'hullLost', 'lastHull', 'wreck', 'caught', 'eaten', 'thread', 'dock', 'past', 'door', 'land']),
  rivals: Object.freeze(['nemesis', 'settled', 'block', 'lean', 'dirtyAir', 'bark', 'breach', 'bowWave', 'fin',
    'roll', 'backOff', 'shadow', 'sailTorn', 'lane']),
  leg: Object.freeze(['gateLine', 'runout', 'vista', 'legEnd']),
});

// Every event type, and E.name === 'name' so a typo fails at load time in a test rather than silently.
export const EVENT_TYPES = Object.freeze(Object.values(EVENTS).flat());
const KNOWN = new Set(EVENT_TYPES);
export const E = Object.freeze(Object.fromEntries(EVENT_TYPES.map((n) => [n, n])));
export const isEvent = (type) => KNOWN.has(type);

// Card hook points (12.9). Most are events; pass, damage, rivalPass and step are hook points only: the module that
// reaches that moment calls runHooks itself (step: race.js, once a step, for your ship).
export const HOOKS = Object.freeze(['pass', 'graze', 'hair', 'burn', 'release', 'redIn', 'hit', 'damage', 'shieldPop',
  'rivalPass', 'takedown', 'step']);

// Push one event onto this step's buffer and return it. `fields` may set t (an event inside the step, such as a pass
// at its exact beat). An unknown type throws: a new event goes into this list and contract.md first.
export function emit(race, type, ship, fields) {
  if (!KNOWN.has(type)) throw new Error(`unknown event type: ${type}`);
  const e = { t: race.t, type, ship: ship && typeof ship === 'object' ? ship.id : ship ?? null, ...fields };
  race.events.push(e);
  return e;
}

// A line in the run log: { t, type, piece, ... }. The run log keeps what the result card and Copy log need.
export function logEntry(race, type, fields) {
  const e = { t: race.t, type, piece: null, ...fields };
  race.log.push(e);
  return e;
}

// Run the build's hooks for one hook point. ctx: { race, ship, event, tune }. Hooks run in build order; a hook
// returns nothing and changes the race through ctx.
export function runHooks(race, name, ctx) {
  const list = race.hooks && race.hooks[name];
  if (!list || !list.length) return;
  for (let i = 0; i < list.length; i++) list[i](ctx);
}
