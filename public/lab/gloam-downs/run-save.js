// The run's save, under its own key beside the explorer's (save.js): the bank, the lasting wares and unlocks, the Ember levels, the
// growth (patterns found and kindled, keys, panes), the counts and bests, the sound settings, the run in progress and the summary of a
// run whose card has not closed. Every arcade page shares one origin, and a cached old page keeps writing its own key, so this key is
// apart and each field is checked on the way in: a bad save cannot stop the page. Version 3 adds the growth; a page that finds no v3
// save reads the v2 save once (or, with no v2, the v1 save once), stores v3 at once, and from then on writes v3 only, so a cached old
// page that drops the new fields cannot reach them. Pure functions, so Node tests can feed it rubbish.
import { ORDER } from './save.js';
import { WICKS, UPGRADES, UNLOCK_IDS, EMBER_TOP, maxHp, flasksMax, routeFor, startAbilities, kindledOf, paneSlots } from './run.js';
import { RELIC_IDS, RELIC_MAX } from './relics.js';
import { COLOUR_IDS, ABILITY_IDS, PANE_IDS, PATTERN_IDS, STARTERS, LAMP_KEY_IDS, DROPS } from './growth.js';

export const KEY = 'gloam-downs.run.v3';
export const V2_KEY = 'gloam-downs.run.v2';
export const OLD_KEY = 'gloam-downs.run.v1';
export const fresh = () => ({
  v: 3, bank: 0, up: Object.fromEntries(UPGRADES.map(u => [u.id, 0])), unlocks: [], ember: 0, emberTop: 0, bestByEmber: [0, 0, 0, 0, 0, 0], bestCombo: 0,
  patterns: [], kindled: STARTERS.slice(), keys: [], panes: [],
  runs: 0, wins: 0, deaths: 0, furthest: 0, reached: [], bestWin: 0, sound: true, music: true, shake: null, seen: false, wander: false, run: null, ended: null
});
const WICK_IDS = WICKS.map(w => w.id);
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const count = (v, max = 1e7) => (Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : 0);
const secs = v => (Number.isFinite(v) && v >= 0 && v <= 360000 ? v : 0);
const intIn = (v, lo, hi, dflt) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : dflt);
const coord = v => (Number.isFinite(v) && Math.abs(v) < 1e4 ? v : null);
// a list of known ids, each once, at most n
const ids = (v, known, n) => (Array.isArray(v) ? [...new Set(v.filter(x => known.includes(x)))].slice(0, n) : []);
// a spot id of a cache (keys.js SPOTS names them): a short word
const spotIds = v => (Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && /^[a-z0-9_-]{1,40}$/.test(x)))].slice(0, 60) : []);
// a route is the five places, each once, with the Gaol first and Barrow Crown last
const goodRoute = r => Array.isArray(r) && r.length === ORDER.length && new Set(r).size === ORDER.length && r.every(p => ORDER.includes(p)) && r[0] === ORDER[0] && r[4] === ORDER[4];
// the three colours, each 0 to 40
const cleanSparks = v => Object.fromEntries(COLOUR_IDS.map(c => [c, obj(v) ? intIn(v[c], 0, 40, 0) : 0]));
// the two ability slots: each a kindled ability { id, bright }, or null
const cleanSlots = (v, kindled) => [0, 1].map(i => { const a = Array.isArray(v) ? v[i] : null; return obj(a) && ABILITY_IDS.includes(a.id) && kindled.includes(a.id) ? { id: a.id, bright: a.bright === true } : null; });
// lamps on the ground: a known id where it lies
const cleanLamps = (v, known, n, withPlace = false) => (Array.isArray(v) ? v.filter(g => obj(g) && known.includes(g.id) && coord(g.x) !== null && coord(g.y) !== null && coord(g.z) !== null && (!withPlace || ORDER.includes(g.place)))
  .slice(0, n).map(g => ({ id: g.id, ...(withPlace ? { place: g.place, bright: g.bright === true, cool: count(g.cool, 3600), full: Math.max(1, count(g.full, 3600)) } : {}), x: g.x, y: g.y, z: g.z })) : []);
// the patterns that can be carried: known, not found and not kindled
const carriable = (v, found, kindled) => ids(v, PATTERN_IDS.filter(p => !found.includes(p) && !kindled.includes(p)), DROPS.patternMax + 8);
// the growth fields of a run (and of its entry): each checked as the run's are
function cleanGrown(r, s, place) {
  const kindled = kindledOf(s), abilities = kindledOf(s, 'ability');
  const g = {
    sparks: cleanSparks(r.sparks), sparkPicks: intIn(r.sparkPicks, 0, 9, 0), carriedPatterns: carriable(r.carriedPatterns, s.patterns, kindled),
    caches: spotIds(r.caches), patternRolls: count(r.patternRolls, 1e6), abilityRolls: count(r.abilityRolls, 1e6), foePatterns: intIn(r.foePatterns, 0, DROPS.patternMax, 0), abilityDrops: intIn(r.abilityDrops, 0, DROPS.abilityMax, 0),
    abilityLamps: cleanLamps(r.abilityLamps, abilities, 6, true).filter(l => !place || l.place === place),
    groundPatterns: cleanLamps(r.groundPatterns, PATTERN_IDS, 6)
  };
  g.abilities = cleanSlots(r.abilities, abilities);
  return g;
}

function cleanRun(r, s) {
  if (!obj(r) || !ORDER.includes(r.place)) return null;
  const up = s.up, top = s.emberTop;
  const wicks = ids(r.wicks, WICK_IDS, 5), ember = intIn(r.ember, 0, top, 0), grown = cleanGrown(r, s, r.place);
  const seed = Number.isInteger(r.seed) && r.seed > 0 && r.seed < 2 ** 32 ? r.seed : 1;
  // a run from v2 has no slots: slot 1 comes from the seed's start stream, as a run with no Belt starts. It is set before the entry's
  // growth is copied from the run's, so a reload keeps it
  if (!Array.isArray(r.abilities)) grown.abilities = startAbilities(seed, { ...s, up: { ...up, belt: 0 } }).slots;
  const max = maxHp(up, wicks, grown.sparks), fmax = flasksMax(up, wicks, ember);
  const run = {
    seed, place: r.place, time: secs(r.time),
    hp: intIn(r.hp, 1, max, max), flasks: intIn(r.flasks, 0, fmax, fmax), carried: count(r.carried), banked: count(r.banked), foes: count(r.foes, 1e5),
    wicks, offer: null, bossDown: r.bossDown === true, entry: null,
    route: goodRoute(r.route) ? r.route.slice() : routeFor(seed, ember), ember, relics: ids(r.relics, RELIC_IDS, RELIC_MAX),
    elitesDown: ids(r.elitesDown, ORDER, ORDER.length), combo: count(r.combo, 1e5), lastUsed: r.lastUsed === true && wicks.includes('last'), shelf: r.shelf === true,
    ...grown, sparkNow: r.sparkNow === true && grown.sparkPicks > 0, abilityOffer: null, patternsKept: count(r.patternsKept, 100), kept: ids(r.kept, PATTERN_IDS, PATTERN_IDS.length),
    splits: cleanSplits(r.splits), lastHurt: byCode(r.lastHurt),
    cracked: intIn(r.cracked, 0, 3, 0),
  };
  // an offer is two different known wicks not yet chosen, or nothing; Belt's offer is two different kindled abilities, or nothing
  if (Array.isArray(r.offer) && r.offer.length === 2 && r.offer[0] !== r.offer[1] && r.offer.every(w => WICK_IDS.includes(w) && !wicks.includes(w))) run.offer = r.offer.slice();
  const abl = kindledOf(s, 'ability');
  if (Array.isArray(r.abilityOffer) && r.abilityOffer.length === 2 && r.abilityOffer[0] !== r.abilityOffer[1] && r.abilityOffer.every(a => abl.includes(a)) && !run.abilities[0]) run.abilityOffer = r.abilityOffer.slice();
  if (!run.offer && !run.abilityOffer && !run.sparkPicks) run.shelf = false;
  const e = obj(r.entry) ? r.entry : {}, has = obj(r.entry);
  run.entry = {
    hp: intIn(e.hp, 1, max, run.hp), flasks: intIn(e.flasks, 0, fmax, run.flasks), carried: has ? count(e.carried) : run.carried, foes: has ? count(e.foes, 1e5) : run.foes,
    relics: has && Array.isArray(e.relics) ? ids(e.relics, RELIC_IDS, RELIC_MAX) : run.relics.slice(),
    elitesDown: has && Array.isArray(e.elitesDown) ? ids(e.elitesDown, ORDER, ORDER.length) : run.elitesDown.slice(),
    lastUsed: has && 'lastUsed' in e ? e.lastUsed === true : run.lastUsed
  };
  // the entry's growth: as saved when the run was saved with it, else the run's own
  const eg = has && obj(e.sparks) ? cleanGrown(e, s, r.place) : JSON.parse(JSON.stringify(grown));
  if (has && obj(e.sparks) && !Array.isArray(e.abilities)) eg.abilities = run.abilities.map(a => (a ? { ...a } : null));
  Object.assign(run.entry, eg);
  return run;
}
/* the recap's fields (gloam-downs-screens-life): the places left in a run, each once, in the run's order, with the time and foes then;
   a place of an ended run's path with its own time and foes; who dealt the last hit, a short code */
function cleanSplits(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  return v.filter(x => obj(x) && ORDER.includes(x.id) && !seen.has(x.id) && seen.add(x.id)).slice(0, ORDER.length)
    .map(x => ({ id: x.id, time: secs(x.time), foes: count(x.foes, 1e5), kept: ids(x.kept, PATTERN_IDS, PATTERN_IDS.length) }));
}
const byCode = v => (typeof v === 'string' && /^[A-Za-z][a-z0-9-]{0,23}$/.test(v) ? v : null);
function cleanPath(v) {
  if (!Array.isArray(v)) return null;
  const seen = new Set(), out = v.filter(x => obj(x) && ORDER.includes(x.id) && !seen.has(x.id) && seen.add(x.id)).slice(0, ORDER.length)
    .map(x => ({ id: x.id, time: secs(x.time), foes: count(x.foes, 1e5) }));
  return out.length ? out : null;
}
function cleanEnded(e, top) {
  if (!obj(e) || !ORDER.includes(e.place)) return null;
  const path = cleanPath(e.path);
  return {
    // a save from before the recap has no path: the summary shows the old rows (screens.js recapOf)
    ...(path ? { path, colours: cleanSparks(e.colours), patternNames: ids(e.patternNames, PATTERN_IDS, PATTERN_IDS.length), by: byCode(e.by) } : {}),
    won: e.won === true, place: e.place, time: secs(e.time), foes: count(e.foes, 1e5), kept: Number.isFinite(e.kept) ? count(e.kept) : null, lost: count(e.lost), banked: count(e.banked),
    ember: intIn(e.ember, 0, EMBER_TOP, 0), relics: ids(e.relics, RELIC_IDS, RELIC_MAX), combo: count(e.combo, 1e5),
    seed: Number.isInteger(e.seed) && e.seed > 0 && e.seed < 2 ** 32 ? e.seed : null,
    opened: Number.isInteger(e.opened) && e.opened >= 1 && e.opened <= Math.min(top, EMBER_TOP) ? e.opened : null,
    patternsKept: count(e.patternsKept, 100), patternsLost: count(e.patternsLost, 100)
  };
}
export function clean(raw) {
  const s = fresh();
  if (!obj(raw)) return s;
  s.bank = count(raw.bank);
  // unknown wares and unlocks are dropped, and levels are clamped to what can be bought
  if (obj(raw.up)) for (const u of UPGRADES) s.up[u.id] = intIn(raw.up[u.id], 0, u.costs.length, 0);
  s.unlocks = ids(raw.unlocks, UNLOCK_IDS, UNLOCK_IDS.length);
  s.emberTop = intIn(raw.emberTop, 0, EMBER_TOP, 0);
  // a level over the highest open one is dropped
  s.ember = Number.isInteger(raw.ember) && raw.ember >= 0 && raw.ember <= s.emberTop ? raw.ember : 0;
  if (Array.isArray(raw.bestByEmber)) s.bestByEmber = s.bestByEmber.map((_, i) => secs(raw.bestByEmber[i]));
  s.bestCombo = count(raw.bestCombo, 1e5);
  // growth: the starters are always kindled (a blade or off-hand pattern kindled is kept too); a pattern found is not yet kindled; panes are kindled ones, each once, in the open slots
  s.kindled = [...new Set([...STARTERS, ...ids(raw.kindled, [...STARTERS, ...PATTERN_IDS], STARTERS.length + PATTERN_IDS.length)])];
  s.patterns = ids(raw.patterns, PATTERN_IDS.filter(p => !s.kindled.includes(p)), PATTERN_IDS.length);
  s.keys = ids(raw.keys, LAMP_KEY_IDS, LAMP_KEY_IDS.length);
  const slots = paneSlots(s), seen = new Set();
  s.panes = Array.isArray(raw.panes) ? raw.panes.slice(0, slots).map(p => (PANE_IDS.includes(p) && s.kindled.includes(p) && !seen.has(p) && seen.add(p) ? p : null)) : [];
  while (s.panes.length && s.panes.at(-1) === null) s.panes.pop();
  s.runs = count(raw.runs, 1e6);
  s.wins = count(raw.wins, 1e6);
  s.deaths = count(raw.deaths, 1e6);
  s.furthest = intIn(raw.furthest, 0, ORDER.length - 1, 0);
  // the places reached in any run (the title's lit lamps); a save from before it had only the furthest, in the downs' order
  s.reached = Array.isArray(raw.reached) ? ids(raw.reached, ORDER, ORDER.length) : ORDER.slice(0, s.furthest + 1);
  s.bestWin = secs(raw.bestWin);
  if (!s.bestByEmber[0] && s.bestWin) s.bestByEmber[0] = s.bestWin;
  s.sound = raw.sound !== false;
  s.music = raw.music !== false;
  s.shake = raw.shake === true || raw.shake === false ? raw.shake : null;
  s.seen = raw.seen === true;
  s.wander = raw.wander === true;
  s.run = cleanRun(raw.run, s);
  s.ended = cleanEnded(raw.ended, s.emberTop);
  return s;
}
/* an old save (v1 or v2) as v3: every level of Mantle, Flask, Edge and Draught is kept, and Ash pocket 1 becomes level 2 (40 + 80 is
   the 120 it cost). Its run in progress keeps its place, with sparks 0 and slot 1 from the seed */
export function fromOld(raw) {
  if (!obj(raw)) return fresh();
  const up = obj(raw.up) ? { ...raw.up } : {};
  if (up.ash === 1 || up.ash === true) up.ash = 2;
  return clean({ ...raw, up, v: 3 });
}
// storage is null when the browser blocks site data; the try blocks cover a throw on any call as well. With no v3 save the v2 save (or
// with none the v1 save) is read once and stored as v3 at once, so a later old write by a cached page changes nothing here
export function load(storage) {
  try {
    const v3 = storage.getItem(KEY);
    if (v3 !== null) return clean(JSON.parse(v3));
    const old = storage.getItem(V2_KEY) ?? storage.getItem(OLD_KEY);
    if (old === null) return fresh();
    const s = fromOld(JSON.parse(old));
    store(storage, s);
    return s;
  } catch { return fresh(); }
}
export function store(storage, s) {
  try { storage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}
