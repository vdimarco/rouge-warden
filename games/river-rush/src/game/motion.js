import { nearestKey } from './engine.js';

// Presentation state belongs to one run, never to the race model or wall clock.
export function createMotion(g) {
  return { time: g.time, eventId: g.eventId, reach: g.wasReaching ? 1 : 0, effects: [], key: nearestKey(g) };
}

export function advanceMotion(m, g, reducedMotion = false) {
  const dt = Math.max(0, Math.min(0.1, g.time - m.time));
  const target = g.wasReaching ? 1 : 0;
  m.reach = reducedMotion ? target : m.reach + (target - m.reach) * (1 - Math.exp(-dt * 18));
  if (Math.abs(target - m.reach) < 0.002) m.reach = target;
  m.effects = m.effects.filter(effect => g.time - effect.time < 1.3);
  if (g.eventId !== m.eventId) {
    if (['key', 'chest', 'hit', 'fall', 'recover', 'win', 'near', 'surge'].includes(g.event)) {
      m.effects.push({ type: g.event, time: g.time, x: g.x, distance: g.distance,
        keyX: m.key?.x ?? g.x, keyDistance: m.key?.d ?? g.distance });
      m.effects = m.effects.slice(-6);
    }
    m.eventId = g.eventId;
  }
  m.key = nearestKey(g);
  m.time = g.time;
  return m;
}
