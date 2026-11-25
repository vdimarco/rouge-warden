// Gloam Downs: the run's small event bus. The page and the fight emit; the run's sound listens. No DOM, so Node tests use it.
const subs = new Map();
export const EVENTS = ['place-enter', 'foes-alert', 'fight-calm', 'elite-alert', 'elite-fall', 'relic-take', 'boss-intro', 'boss-health', 'boss-phase', 'boss-fall', 'beacon-lit', 'run-death', 'run-win', 'lamp-room', 'combo-tier', 'pattern-found', 'pattern-kept', 'pattern-kindled', 'key-found', 'ability-use', 'ability-ready', 'spark-take', 'cache-open'];
export function on(name, fn) { if (!subs.has(name)) subs.set(name, new Set()); subs.get(name).add(fn); return () => subs.get(name).delete(fn); }
export function emit(name, detail = {}) { for (const fn of [...(subs.get(name) || [])]) { try { fn(detail); } catch (e) { console.error(e); } } }
