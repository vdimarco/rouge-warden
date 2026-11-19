// The saved walk, kept in localStorage. Every arcade page shares one origin, so each field is checked on the way in and anything wrong is
// dropped: a bad save cannot stop the page. Pure functions, so Node tests can feed it rubbish.
export const ORDER = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
export const KEY = 'gloam-downs.save.v1';
export const fresh = () => ({ v: 1, reached: ['gaol'], at: 'gaol', wisps: {}, lit: {}, time: 0, best: 0, done: 0, seen: false });

export function clean(raw) {
  const s = fresh();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
  // places reached: known ids only, always from the first, in order and with no gap
  if (Array.isArray(raw.reached)) {
    const n = ORDER.findIndex((id, i) => !raw.reached.includes(id) && i > 0);
    const upto = n < 0 ? ORDER.length : n;
    s.reached = ORDER.slice(0, Math.max(1, upto));
  }
  if (typeof raw.at === 'string' && s.reached.includes(raw.at)) s.at = raw.at;
  if (raw.wisps && typeof raw.wisps === 'object' && !Array.isArray(raw.wisps))
    for (const id of ORDER) {
      const w = raw.wisps[id];
      if (Array.isArray(w)) s.wisps[id] = [...new Set(w.filter(i => Number.isInteger(i) && i >= 0 && i < 5))].sort();
    }
  if (raw.lit && typeof raw.lit === 'object' && !Array.isArray(raw.lit))
    for (const id of ORDER) if (raw.lit[id] === true && s.reached.includes(id)) s.lit[id] = true;
  const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : 0);
  s.time = num(raw.time, 360000);
  s.best = num(raw.best, 360000);
  s.done = Math.floor(num(raw.done, 1e6));
  s.seen = raw.seen === true;
  return s;
}
export function load(storage) {
  try { return clean(JSON.parse(storage.getItem(KEY) || 'null')); } catch { return fresh(); }
}
export function store(storage, s) {
  try { storage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}
export const wispCount = s => ORDER.reduce((n, id) => n + (s.wisps[id]?.length || 0), 0);
