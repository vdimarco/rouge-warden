// js/core/bus.js : a tiny event bus. on() returns a function that removes the listener.
export function createBus() { const m = new Map(); return { on(e, f) { if (!m.has(e)) m.set(e, []); m.get(e).push(f); return () => { const a = m.get(e); const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }; }, emit(e, d) { for (const f of (m.get(e) || []).slice()) f(d); }, clear() { m.clear(); } }; }
