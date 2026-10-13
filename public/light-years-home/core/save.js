// Light Years Home: saves. Best result, chapter progress, settings and the seen flag, as JSON in a storage object
// (the browser's storage in the game, a plain object in tests). Every read and write runs in try/catch: a throwing
// or missing storage, or junk in a key, reads as nothing saved, and the game goes on.

export const KEYS = {
  best: 'light-years-home.best.v1',
  progress: 'light-years-home.progress.v1',
  settings: 'light-years-home.settings.v1',
  seen: 'light-years-home.seen.v1',
};
export const RANKS = ['Drifter', 'Wayfinder', 'Navigator', 'Lightkeeper'];
export const STOPS = 15;
export const FIRST_TRIES = 17;                 // 15 landmarks and 2 spots
export const SCORE_MAX = 100000;
// First stop of each chapter (indexes into route STOPS): I coma, II andromeda, III orion's belt, IV aldebaran.
export const CHAPTER_STARTS = [0, 3, 6, 10];
export const DEFAULT_SETTINGS = Object.freeze({ thrust: 'hold', captions: 'normal', hints: true });
const THRUST = ['hold', 'toggle'];
const CAPTIONS = ['normal', 'slow'];
const BRANCHES = [null, 'sheet', 'void'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
const isNum = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isDate = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);

function readJSON(storage, key) {
  try {
    const raw = storage && storage.getItem(key);
    if (typeof raw !== 'string') return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeJSON(storage, key, value) {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---------- best ----------

// A valid best record, or null. score, reached and home are needed; the rest is checked when present.
export function cleanBest(b) {
  if (!isObj(b)) return null;
  if (!isInt(b.score, 0, SCORE_MAX) || !isInt(b.reached, 0, STOPS) || typeof b.home !== 'boolean') return null;
  const out = { score: b.score, reached: b.reached, home: b.home };
  if (b.shipYears !== undefined) { if (!isNum(b.shipYears, 0, 1000)) return null; out.shipYears = b.shipYears; }
  if (b.firstTry !== undefined) { if (!isInt(b.firstTry, 0, FIRST_TRIES)) return null; out.firstTry = b.firstTry; }
  if (b.rank !== undefined) { if (!RANKS.includes(b.rank)) return null; out.rank = b.rank; }
  if (b.date !== undefined) { if (!isDate(b.date)) return null; out.date = b.date; }
  return out;
}

export function readBest(storage) {
  return cleanBest(readJSON(storage, KEYS.best));
}

// Merges a finished run into the best record and writes it: the higher score (with its rank and date), the higher
// stop reached, the most first-try finds, and the lowest ship time among runs that reached home.
// Returns { best, newBest } (newBest: the score beat the old one, or there was none).
export function saveBest(storage, result) {
  const prev = readBest(storage);
  const r = isObj(result) ? result : {};
  const run = cleanBest({
    score: Math.max(0, Math.min(SCORE_MAX, Math.round(Number(r.score)))),
    reached: Math.round(Number(r.reached)),
    home: r.home === true,
    ...(r.home === true && isNum(r.shipYears, 0, 1000) ? { shipYears: r.shipYears } : {}),
    ...(isInt(r.firstTry, 0, FIRST_TRIES) ? { firstTry: r.firstTry } : {}),
    ...(RANKS.includes(r.rank) ? { rank: r.rank } : {}),
    ...(isDate(r.date) ? { date: r.date } : {}),
  });
  if (!run) return { best: prev, newBest: false };
  if (!prev) {
    writeJSON(storage, KEYS.best, run);
    return { best: run, newBest: true };
  }
  const newBest = run.score > prev.score;
  const top = newBest ? run : prev;
  const best = { score: top.score, reached: Math.max(prev.reached, run.reached), home: prev.home || run.home };
  const years = [prev, run].filter((b) => b.home && b.shipYears !== undefined).map((b) => b.shipYears);
  if (years.length) best.shipYears = Math.min(...years);
  const tries = [prev.firstTry, run.firstTry].filter((v) => v !== undefined);
  if (tries.length) best.firstTry = Math.max(...tries);
  if (top.rank !== undefined) best.rank = top.rank;
  if (top.date !== undefined) best.date = top.date;
  writeJSON(storage, KEYS.best, best);
  return { best, newBest };
}

// The title's best line: 'BEST 31,250 · HOME IN 13.59 YEARS', 'BEST 6,800 · REACHED VIRGO', or 'No journey home yet'.
// stopNames: the 15 landmark names in route order.
export function bestLine(best, stopNames = []) {
  const b = cleanBest(best);
  if (!b) return 'No journey home yet';
  const score = 'BEST ' + String(b.score).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (b.home) return b.shipYears !== undefined ? `${score} · HOME IN ${b.shipYears.toFixed(2)} YEARS` : `${score} · HOME`;
  const name = b.reached > 0 && stopNames[b.reached - 1];
  return name ? `${score} · REACHED ${String(name).toUpperCase()}` : score;
}

// ---------- progress (saved at the start of chapters II, III and IV) ----------

// A valid progress record, or null. Fields the engine adds beyond these pass through unchanged.
export function cleanProgress(p) {
  if (!isObj(p) || p.v !== 1) return null;
  if (!isInt(p.chapter, 1, 3) || p.stop !== CHAPTER_STARTS[p.chapter]) return null;
  if (!isInt(p.panes, 1, 3) || !isInt(p.seed, 0, 0xffffffff)) return null;
  if (!isInt(p.score, -SCORE_MAX, SCORE_MAX)) return null;
  if (!BRANCHES.includes(p.branch === undefined ? null : p.branch)) return null;
  const shown = p.shown === undefined ? [] : p.shown;
  if (!Array.isArray(shown) || shown.length > 64 || !shown.every((s) => typeof s === 'string' && s.length <= 40)) return null;
  const stats = p.stats === undefined ? {} : p.stats;
  if (!isObj(stats)) return null;
  for (const k of ['firstTry', 'wrong', 'cracks', 'retries', 'topEta']) {
    if (stats[k] !== undefined && !isNum(stats[k], 0, 1e6)) return null;
  }
  const grades = stats.legGrades;
  if (grades !== undefined && !(Array.isArray(grades) && grades.length <= STOPS && grades.every((g) => isNum(g, 0, 1e4)))) {
    return null;
  }
  return { ...p, branch: p.branch === undefined ? null : p.branch, shown: [...shown], stats: { ...stats } };
}

export function readProgress(storage) {
  return cleanProgress(readJSON(storage, KEYS.progress));
}

// Writes a valid progress record; returns true when it was stored.
export function saveProgress(storage, progress) {
  const p = cleanProgress(progress);
  return p ? writeJSON(storage, KEYS.progress, p) : false;
}

export function clearProgress(storage) {
  try {
    if (storage) storage.removeItem(KEYS.progress);
    return true;
  } catch {
    return false;
  }
}

// ---------- settings ----------

// Settings with every unknown or missing value replaced by its default.
export function cleanSettings(s) {
  const o = isObj(s) ? s : {};
  return {
    thrust: THRUST.includes(o.thrust) ? o.thrust : DEFAULT_SETTINGS.thrust,
    captions: CAPTIONS.includes(o.captions) ? o.captions : DEFAULT_SETTINGS.captions,
    hints: typeof o.hints === 'boolean' ? o.hints : DEFAULT_SETTINGS.hints,
  };
}

export function readSettings(storage) {
  return cleanSettings(readJSON(storage, KEYS.settings));
}

// Writes the cleaned settings and returns them.
export function saveSettings(storage, settings) {
  const s = cleanSettings(settings);
  writeJSON(storage, KEYS.settings, s);
  return s;
}

// ---------- seen (the intro has played once) ----------

export function readSeen(storage) {
  return readJSON(storage, KEYS.seen) === true;
}

export function saveSeen(storage, seen = true) {
  return writeJSON(storage, KEYS.seen, seen === true);
}
