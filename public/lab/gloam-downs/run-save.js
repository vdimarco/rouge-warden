// The run's save, under its own key beside the explorer's (save.js): the bank, the lasting upgrades and unlocks, the Ember levels, the
// counts and bests, the sound settings, the run in progress and the summary of a run whose card has not closed. Every arcade page
// shares one origin, and a cached old page keeps writing its own key, so this key is apart and each field is checked on the way in: a
// bad save cannot stop the page. Version 2 adds the unlocks, the Ember levels, the relics and the route; a page that finds no v2 save
// reads the v1 save once, and from then on writes v2 only, so a cached v1 page that drops the new fields cannot reach them.
// Pure functions, so Node tests can feed it rubbish.
import { ORDER } from './save.js';
import { WICKS, UPGRADES, UNLOCK_IDS, EMBER_TOP, maxHp, flasksMax, routeFor } from './run.js';
import { RELIC_IDS, RELIC_MAX } from './relics.js';

export const KEY = 'gloam-downs.run.v2';
export const OLD_KEY = 'gloam-downs.run.v1';
export const fresh = () => ({
  v: 2, bank: 0, up: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), unlocks: [], ember: 0, emberTop: 0, bestByEmber: [0, 0, 0, 0, 0, 0], bestCombo: 0,
  runs: 0, wins: 0, deaths: 0, furthest: 0, bestWin: 0, sound: true, music: true, shake: null, seen: false, wander: false, run: null, ended: null
});
const WICK_IDS = WICKS.map(w => w.id);
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const count = (v, max = 1e7) => (Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : 0);
const secs = v => (Number.isFinite(v) && v >= 0 && v <= 360000 ? v : 0);
const intIn = (v, lo, hi, dflt) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : dflt);
// a list of known ids, each once, at most n
const ids = (v, known, n) => (Array.isArray(v) ? [...new Set(v.filter(x => known.includes(x)))].slice(0, n) : []);
// a route is the five places, each once, with the Gaol first and Barrow Crown last
const goodRoute = r => Array.isArray(r) && r.length === ORDER.length && new Set(r).size === ORDER.length && r.every(p => ORDER.includes(p)) && r[0] === ORDER[0] && r[4] === ORDER[4];

function cleanRun(r, up, top) {
  if (!obj(r) || !ORDER.includes(r.place)) return null;
  const wicks = ids(r.wicks, WICK_IDS, 5), ember = intIn(r.ember, 0, top, 0);
  const max = maxHp(up, wicks), fmax = flasksMax(up, wicks, ember);
  const seed = Number.isInteger(r.seed) && r.seed > 0 && r.seed < 2 ** 32 ? r.seed : 1;
  const run = {
    seed, place: r.place, time: secs(r.time),
    hp: intIn(r.hp, 1, max, max), flasks: intIn(r.flasks, 0, fmax, fmax), carried: count(r.carried), banked: count(r.banked), foes: count(r.foes, 1e5),
    wicks, offer: null, bossDown: r.bossDown === true, entry: null,
    route: goodRoute(r.route) ? r.route.slice() : routeFor(seed, ember), ember, relics: ids(r.relics, RELIC_IDS, RELIC_MAX),
    elitesDown: ids(r.elitesDown, ORDER, ORDER.length), combo: count(r.combo, 1e5), lastUsed: r.lastUsed === true && wicks.includes('last'), shelf: r.shelf === true
  };
  // an offer is two different known wicks not yet chosen, or nothing
  if (Array.isArray(r.offer) && r.offer.length === 2 && r.offer[0] !== r.offer[1] && r.offer.every(w => WICK_IDS.includes(w) && !wicks.includes(w))) run.offer = r.offer.slice();
  if (!run.offer) run.shelf = false;
  const e = obj(r.entry) ? r.entry : {}, has = obj(r.entry);
  run.entry = {
    hp: intIn(e.hp, 1, max, run.hp), flasks: intIn(e.flasks, 0, fmax, run.flasks), carried: has ? count(e.carried) : run.carried, foes: has ? count(e.foes, 1e5) : run.foes,
    relics: has && Array.isArray(e.relics) ? ids(e.relics, RELIC_IDS, RELIC_MAX) : run.relics.slice(),
    elitesDown: has && Array.isArray(e.elitesDown) ? ids(e.elitesDown, ORDER, ORDER.length) : run.elitesDown.slice(),
    lastUsed: has && 'lastUsed' in e ? e.lastUsed === true : run.lastUsed
  };
  return run;
}
function cleanEnded(e, top) {
  if (!obj(e) || !ORDER.includes(e.place)) return null;
  return {
    won: e.won === true, place: e.place, time: secs(e.time), foes: count(e.foes, 1e5), lost: count(e.lost), banked: count(e.banked),
    ember: intIn(e.ember, 0, EMBER_TOP, 0), relics: ids(e.relics, RELIC_IDS, RELIC_MAX), combo: count(e.combo, 1e5),
    seed: Number.isInteger(e.seed) && e.seed > 0 && e.seed < 2 ** 32 ? e.seed : null,
    opened: Number.isInteger(e.opened) && e.opened >= 1 && e.opened <= Math.min(top, EMBER_TOP) ? e.opened : null
  };
}
export function clean(raw) {
  const s = fresh();
  if (!obj(raw)) return s;
  s.bank = count(raw.bank);
  // unknown upgrades and unlocks are dropped, and levels are clamped to what can be bought
  if (obj(raw.up)) for (const u of UPGRADES) s.up[u.id] = intIn(raw.up[u.id], 0, u.costs.length, 0);
  s.unlocks = ids(raw.unlocks, UNLOCK_IDS, UNLOCK_IDS.length);
  s.emberTop = intIn(raw.emberTop, 0, EMBER_TOP, 0);
  // a level over the highest open one is dropped
  s.ember = Number.isInteger(raw.ember) && raw.ember >= 0 && raw.ember <= s.emberTop ? raw.ember : 0;
  if (Array.isArray(raw.bestByEmber)) s.bestByEmber = s.bestByEmber.map((_, i) => secs(raw.bestByEmber[i]));
  s.bestCombo = count(raw.bestCombo, 1e5);
  s.runs = count(raw.runs, 1e6);
  s.wins = count(raw.wins, 1e6);
  s.deaths = count(raw.deaths, 1e6);
  s.furthest = intIn(raw.furthest, 0, ORDER.length - 1, 0);
  s.bestWin = secs(raw.bestWin);
  if (!s.bestByEmber[0] && s.bestWin) s.bestByEmber[0] = s.bestWin;
  s.sound = raw.sound !== false;
  s.music = raw.music !== false;
  s.shake = raw.shake === true || raw.shake === false ? raw.shake : null;
  s.seen = raw.seen === true;
  s.wander = raw.wander === true;
  s.run = cleanRun(raw.run, s.up, s.emberTop);
  s.ended = cleanEnded(raw.ended, s.emberTop);
  return s;
}
// storage is null when the browser blocks site data; the try blocks cover a throw on any call as well. With no v2 save the v1 save is
// read once and stored as v2 at once, so a later v1 write by a cached page changes nothing here
export function load(storage) {
  try {
    const v2 = storage.getItem(KEY);
    if (v2 !== null) return clean(JSON.parse(v2));
    const v1 = storage.getItem(OLD_KEY);
    if (v1 === null) return fresh();
    const s = clean(JSON.parse(v1));
    store(storage, s);
    return s;
  } catch { return fresh(); }
}
export function store(storage, s) {
  try { storage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}
