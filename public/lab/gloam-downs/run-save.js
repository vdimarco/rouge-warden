// The run's save, under its own key beside the explorer's (save.js): the bank, the lasting upgrades, the counts, the sound setting,
// the run in progress and the summary of a run whose card has not closed. Every arcade page shares one origin, and a cached old page
// keeps writing the explorer's key, so this key is apart and each field is checked on the way in: a bad save cannot stop the page.
// Pure functions, so Node tests can feed it rubbish.
import { ORDER } from './save.js';
import { WICKS, UPGRADES, maxHp, flasksMax } from './run.js';

export const KEY = 'gloam-downs.run.v1';
export const fresh = () => ({
  v: 1, bank: 0, up: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), runs: 0, wins: 0, deaths: 0, furthest: 0, bestWin: 0,
  sound: true, seen: false, wander: false, run: null, ended: null
});
const WICK_IDS = WICKS.map(w => w.id);
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const count = (v, max = 1e7) => (Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : 0);
const secs = v => (Number.isFinite(v) && v >= 0 && v <= 360000 ? v : 0);
const intIn = (v, lo, hi, dflt) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : dflt);

function cleanRun(r, up) {
  if (!obj(r) || !ORDER.includes(r.place)) return null;
  const wicks = Array.isArray(r.wicks) ? [...new Set(r.wicks.filter(w => WICK_IDS.includes(w)))].slice(0, 4) : [];
  const max = maxHp(up, wicks), fmax = flasksMax(up, wicks);
  const run = {
    seed: Number.isInteger(r.seed) && r.seed > 0 && r.seed < 2 ** 32 ? r.seed : 1, place: r.place, time: secs(r.time),
    hp: intIn(r.hp, 1, max, max), flasks: intIn(r.flasks, 0, fmax, fmax), carried: count(r.carried), banked: count(r.banked), foes: count(r.foes, 1e5),
    wicks, offer: null, bossDown: r.bossDown === true, entry: null
  };
  // an offer is two different known wicks not yet chosen, or nothing
  if (Array.isArray(r.offer) && r.offer.length === 2 && r.offer[0] !== r.offer[1] && r.offer.every(w => WICK_IDS.includes(w) && !wicks.includes(w))) run.offer = r.offer.slice();
  const e = obj(r.entry) ? r.entry : {};
  run.entry = { hp: intIn(e.hp, 1, max, run.hp), flasks: intIn(e.flasks, 0, fmax, run.flasks), carried: obj(r.entry) ? count(e.carried) : run.carried, foes: obj(r.entry) ? count(e.foes, 1e5) : run.foes };
  return run;
}
function cleanEnded(e) {
  if (!obj(e) || !ORDER.includes(e.place)) return null;
  return { won: e.won === true, place: e.place, time: secs(e.time), foes: count(e.foes, 1e5), lost: count(e.lost), banked: count(e.banked) };
}
export function clean(raw) {
  const s = fresh();
  if (!obj(raw)) return s;
  s.bank = count(raw.bank);
  // unknown upgrades are dropped, and levels are clamped to what can be bought
  if (obj(raw.up)) for (const u of UPGRADES) s.up[u.id] = intIn(raw.up[u.id], 0, u.costs.length, 0);
  s.runs = count(raw.runs, 1e6);
  s.wins = count(raw.wins, 1e6);
  s.deaths = count(raw.deaths, 1e6);
  s.furthest = intIn(raw.furthest, 0, ORDER.length - 1, 0);
  s.bestWin = secs(raw.bestWin);
  s.sound = raw.sound !== false;
  s.seen = raw.seen === true;
  s.wander = raw.wander === true;
  s.run = cleanRun(raw.run, s.up);
  s.ended = cleanEnded(raw.ended);
  return s;
}
// storage is null when the browser blocks site data; the try blocks cover a throw on any call as well
export function load(storage) {
  try { return clean(JSON.parse(storage.getItem(KEY) || 'null')); } catch { return fresh(); }
}
export function store(storage, s) {
  try { storage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}
