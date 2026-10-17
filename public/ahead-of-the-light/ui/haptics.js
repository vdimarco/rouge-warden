// Ahead of the Light: haptics (final.md 17). navigator.vibrate where it exists (Android); iPhones get the sound only.
// Each pattern starts on the frame its event arrives, and counts per event type for __race.feedback().
const PATTERN = {
  graze: 8, hair: 15, burn: 30, oberth: 30, hit: 60, shieldPop: 20, slam: 30, takedown: 40, eaten: 20, heart: 10,
  caught: [180, 60, 320], wreck: [180, 60, 320], home: [40, 60, 40, 60, 120],
};

export function createHaptics({ enabled = true } = {}) {
  const can = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  let on = enabled;
  const fired = {};
  function buzz(type, pattern = PATTERN[type]) {
    if (!on || !can || pattern === undefined) return false;
    try { navigator.vibrate(pattern); } catch (e) { return false; }
    fired[type] = (fired[type] || 0) + 1;
    return true;
  }
  // One frame's events. you: your ship's id. near(ship id): true when that rival is within a second of you.
  function onEvents(events, { you = 'you', near = () => false } = {}) {
    for (const e of events) {
      const mine = e.ship === you;
      switch (e.type) {
        case 'graze': case 'hair': case 'burn': case 'oberth': case 'hit': case 'shieldPop':
        case 'caught': case 'wreck':
          if (mine) buzz(e.type);
          break;
        case 'contact':
          if (e.victim === you && e.kind === 'slam') buzz('slam');
          break;
        case 'takedown':
          if (e.by === you) buzz('takedown');
          break;
        case 'eaten':
          if (near(e.id || e.ship)) buzz('eaten');
          break;
        case 'land':
          if (mine && e.ok) buzz('home');
          break;
        default:
      }
    }
  }
  return {
    buzz, onEvents,
    heart() { return buzz('heart'); },
    set(v) { on = Boolean(v); },
    fired: () => ({ ...fired }),
    get can() { return can; },
  };
}
