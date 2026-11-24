// The saved walk, kept in localStorage. Every arcade page shares one origin, so each field is checked on the way in and anything wrong is
// dropped: a bad save cannot stop the page. Pure functions, so Node tests can feed it rubbish.
// Two sets of places share the save: the downs (ORDER, the five places of the walk and of the run) and the Gilt Lattice (LATTICE, three
// explorer places only). The Lattice needs no `reached` entries: its first place is always open, and a lit beacon opens the next.
export const ORDER = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
export const LATTICE = ['piazza', 'cupola', 'orrery'];
export const KEY = 'gloam-downs.save.v1';
export const fresh = () => ({ v: 1, reached: ['gaol'], at: 'gaol', wisps: {}, lit: {}, time: 0, best: 0, done: 0, seen: false });

// a Lattice place is open when it is the first, or when the beacon of the place before it is lit
export function latticeOpen(s, id) {
  const i = LATTICE.indexOf(id);
  if (i < 0) return false;
  return i === 0 || s?.lit?.[LATTICE[i - 1]] === true;
}

export function clean(raw) {
  const s = fresh();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
  // places reached: known ids only, always from the first, in order and with no gap
  if (Array.isArray(raw.reached)) {
    const n = ORDER.findIndex((id, i) => !raw.reached.includes(id) && i > 0);
    const upto = n < 0 ? ORDER.length : n;
    s.reached = ORDER.slice(0, Math.max(1, upto));
  }
  if (raw.wisps && typeof raw.wisps === 'object' && !Array.isArray(raw.wisps))
    for (const id of [...ORDER, ...LATTICE]) {
      const w = raw.wisps[id];
      if (Array.isArray(w)) s.wisps[id] = [...new Set(w.filter(i => Number.isInteger(i) && i >= 0 && i < 5))].sort();
    }
  // a lit beacon has opened the place after it; one that has not would shut the player in, so it is dark again
  // (the places reached have no gap, so the next one reached means this one was too)
  if (raw.lit && typeof raw.lit === 'object' && !Array.isArray(raw.lit)) {
    ORDER.forEach((id, i) => { if (raw.lit[id] === true && s.reached.includes(ORDER[i + 1] ?? id)) s.lit[id] = true; });
    // in the Lattice, in order: a beacon stays lit only when its place is open by the chain
    for (const id of LATTICE) if (raw.lit[id] === true && latticeOpen(s, id)) s.lit[id] = true;
  }
  if (typeof raw.at === 'string' && (s.reached.includes(raw.at) || latticeOpen(s, raw.at))) s.at = raw.at;
  const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : 0);
  s.time = num(raw.time, 360000);
  s.best = num(raw.best, 360000);
  s.done = Math.floor(num(raw.done, 1e6));
  s.seen = raw.seen === true;
  return s;
}
// storage is null when the browser blocks site data; the try blocks cover that as well
export function load(storage) {
  try { return clean(JSON.parse(storage.getItem(KEY) || 'null')); } catch { return fresh(); }
}
export function store(storage, s) {
  try { storage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}
// the wisps found on the downs (of 25), and in the Lattice (of 15)
export const wispCount = s => ORDER.reduce((n, id) => n + (s.wisps[id]?.length || 0), 0);
export const latticeWisps = s => LATTICE.reduce((n, id) => n + (s.wisps[id]?.length || 0), 0);
