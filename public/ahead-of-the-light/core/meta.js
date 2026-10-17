// Ahead of the Light: what lasts between runs (final.md 14): the ship's log and its pages, the unlock track, the ships
// and their feats, records, medals, REDSHIFT, EASY LIGHT and the daily route. Everything here takes plain objects and
// returns new ones; the page stores them (ui/store.js, in try/catch). A run's log comes from log.js's runSummary.
// Pure: the day is always passed in, never read from a clock.
import { TUNE } from './tune.js';
import { ROUTE, LEG_TYPES } from './course/legs.js';
import { CARDS } from './cards.js';
import { daySeed } from '../../lab/kit/rng.js';

export const META_VERSION = 1;

// ---------------------------------------------------------------- ships (14.3)

// Each ship changes how it drives, not how strong it is. half and turn go on your ship at launch; patch goes into
// the leg's tuning (yours); starts: the card it begins with; feat: how it unlocks.
export const SHIPS = Object.freeze({
  lantern: Object.freeze({ id: 'lantern', name: 'LANTERN', half: 3.5, turn: 600, hull: 3, shield: 1, shieldT: 8,
    fuel: 2, fuelCap: 4, burn: 0.4, quirk: 'The reference ship.', starts: null, feat: null }),
  needle: Object.freeze({ id: 'needle', name: 'NEEDLE', half: 2.5, turn: 700, hull: 2, shield: 1, shieldT: 6,
    fuel: 1, fuelCap: 3, burn: 0.4, hitEta: 0.8, quirk: 'A hit costs more speed.', starts: 'hair-trigger',
    feat: 'A CLEAN LEG ON LEG 3 OR LATER' }),
  tug: Object.freeze({ id: 'tug', name: 'TUG', half: 4.5, turn: 480, hull: 5, shield: 1, shieldT: 10, fuel: 3,
    fuelCap: 5, burn: 0.35, slamV: 140, quirk: 'Rams on you shove half as far and spill nothing.', starts: null,
    feat: 'TAKE DOWN 3 RIVALS IN ONE RUN' }),
  ghost: Object.freeze({ id: 'ghost', name: 'GHOST', half: 3, turn: 650, hull: 1, shield: 2, shieldT: 5, fuel: 2,
    fuelCap: 4, burn: 0.4, noDock: true, rowUp: 1, quirk: 'Cannot dock. Every offer rolls one row up.', starts: null,
    feat: 'GET HOME' }),
});
export const SHIP_ORDER = Object.freeze(['lantern', 'needle', 'tug', 'ghost']);
export const shipOf = (type) => SHIPS[type] || SHIPS.lantern;

// The leg's tuning with your ship's numbers, REDSHIFT's patches (steps 1, 4 and 6; step 2 is the rivals', step 3
// survival's launchState, step 5 the run's dock) and EASY LIGHT. LANTERN at REDSHIFT 0 without EASY LIGHT returns
// the same object.
export function shipTune(type, tune = TUNE, redshift = 0, easy = false) {
  const S = shipOf(type);
  const T = { ...tune };
  let changed = false;
  const set = (k, v) => { if (T[k] !== v) { T[k] = v; changed = true; } };
  // the ship's number, unless the URL overrode that key (then the override wins)
  const ship = (k, v) => { if (v !== undefined && tune[k] === TUNE[k]) set(k, v); };
  ship('HULL0', S.hull);
  ship('HULL_MAX', S.hull);
  ship('SHIELD_MAX', S.shield);
  ship('SHIELD_T', S.shieldT);
  ship('FUEL0', S.fuel);
  ship('FUEL_CAP', S.fuelCap);
  ship('BURN_ETA', S.burn);
  ship('HIT_ETA', S.hitEta);
  ship('SLAM_V', S.slamV);
  if (redshift >= 1) set('SHIELD_T', Math.max(T.SHIELD_T, 12));
  if (redshift >= 4) set('GAP_CAP', tune.GAP_CAP.map((c) => Math.max(1, c - 1)));
  if (redshift >= 6) set('LAND_S', tune.LAND_S + 2);
  if (easy) set('BLEED', tune.BLEED * tune.EASY_X);
  return changed ? Object.freeze(T) : tune;
}

// ---------------------------------------------------------------- REDSHIFT (14.5)

export const REDSHIFT = Object.freeze([
  Object.freeze({ step: 1, name: 'SLOW SHIELD', rule: 'The shield recharges in 12 s.' }),
  Object.freeze({ step: 2, name: 'SHARP RIVALS', rule: 'Rivals react 40 ms faster.' }),
  Object.freeze({ step: 3, name: 'LATE LAUNCH', rule: 'A thread launches at 1.0 and a dock at 0.6.' }),
  Object.freeze({ step: 4, name: 'THIN LENS', rule: 'Every gap cap is 1 s lower.' }),
  Object.freeze({ step: 5, name: 'NO FREE REPAIR', rule: 'Docks give no free repair.' }),
  Object.freeze({ step: 6, name: 'HARD LANDING', rule: 'The landing needs 2 s more.' }),
]);
export const REDSHIFT_MAX = REDSHIFT.length;

// ---------------------------------------------------------------- the log's pages (14.2)

// 84 pages in four tabs. PLACES: each of 8 gates reached (the landing counts) and each of 16 lanes flown. CARDS: each
// card taken. RIVALS: each named ship seen taken by the light, and each beaten by you (a regular taken down; a boss
// beaten, since the WHALE cannot be taken down). ENDINGS: caught on each leg, home, FIRST HOME.
export const RIVAL_IDS = Object.freeze(['hound', 'pike', 'remora', 'moth', 'whale', 'mako', 'manta']);
const LANE_IDS = [];
for (const type of ROUTE) for (const l of Object.values(LEG_TYPES[type].lanes)) LANE_IDS.push(l.id);
export const PAGES = Object.freeze({
  PLACES: Object.freeze([...ROUTE.map((t) => `gate:${t}`), ...LANE_IDS.map((id) => `lane:${id}`)]),
  CARDS: Object.freeze(CARDS.map((c) => `card:${c.id}`)),
  RIVALS: Object.freeze([...RIVAL_IDS.map((id) => `eaten:${id}`), ...RIVAL_IDS.map((id) => `beat:${id}`)]),
  ENDINGS: Object.freeze([...ROUTE.map((t) => `caught:${t}`), 'home', 'first-home']),
});
export const ALL_PAGES = Object.freeze(Object.values(PAGES).flat());
const PAGE_SET = new Set(ALL_PAGES);

// The unlock track (14.2).
export const UNLOCKS = Object.freeze([
  Object.freeze({ at: 6, id: 'reroll-2', name: 'REROLL +1', short: 'REROLL +1' }),
  Object.freeze({ at: 15, id: 'banish-1', name: 'BANISH', short: 'BANISH' }),
  Object.freeze({ at: 25, id: 'lucky-star', name: 'LUCKY STAR', short: 'LUCKY STAR' }),
  Object.freeze({ at: 40, id: 'reroll-3', name: 'REROLL +1', short: 'REROLL +1' }),
  Object.freeze({ at: 55, id: 'banish-2', name: 'BANISH +1', short: 'BANISH +1' }),
  Object.freeze({ at: 84, id: 'gold-frame', name: 'A GOLD FRAME', short: 'GOLD FRAME' }),
]);

// ---------------------------------------------------------------- medals (13), start values for the bots to replace

// Years for a leg at gold, silver and bronze: the expert, mid and novice run totals of 13 (13, 36 and 62 years home)
// shared out by the leg's beats. WP9 replaces these with the bots' medians per leg type.
const RUN_YEARS = [13, 36, 62];
const BEATS_ALL = TUNE.LEG_BEATS.reduce((a, b) => a + b, 0);
export const MEDAL_YEARS = Object.freeze(Object.fromEntries(ROUTE.map((t, i) => [t,
  Object.freeze(RUN_YEARS.map((y) => Math.round((y * TUNE.LEG_BEATS[i] / BEATS_ALL) * 100) / 100))])));
export const MEDALS = Object.freeze(['gold', 'silver', 'bronze']);
export function medalFor(type, years) {
  const m = MEDAL_YEARS[type];
  if (!m || !(years >= 0)) return null;
  for (let i = 0; i < 3; i++) if (years <= m[i]) return MEDALS[i];
  return null;
}
const medalRank = (m) => (m ? 3 - MEDALS.indexOf(m) : 0);

// ---------------------------------------------------------------- the meta object

// A fresh meta (14.1). seen: the teaching flags and what the player has met (runs, goodWhip, offered, vistas).
export function createMeta() {
  return {
    v: META_VERSION, pages: [], unlocks: [], ships: ['lantern'], records: { best: null, byShip: {} }, medals: {},
    redshift: { open: 0, level: 0 }, daily: {}, settings: {}, seen: { runs: 0, goodWhip: false, offered: false,
      vistas: {} },
    trophies: [], runs: 0, easy: { offered: false, on: false, early: 0 },
  };
}

// Fill a stored meta's missing parts from a fresh one (an older or damaged meta keeps what it can).
export function normalizeMeta(m) {
  const base = createMeta();
  if (!m || typeof m !== 'object') return base;
  const out = { ...base, ...m };
  for (const k of ['records', 'redshift', 'seen', 'easy']) {
    out[k] = { ...base[k], ...(m[k] && typeof m[k] === 'object' ? m[k] : {}) };
  }
  out.seen.vistas = { ...(out.seen.vistas || {}) };
  for (const k of ['pages', 'unlocks', 'ships', 'trophies']) out[k] = Array.isArray(m[k]) ? [...m[k]] : base[k];
  if (!out.ships.includes('lantern')) out.ships.unshift('lantern');
  for (const k of ['medals', 'daily', 'settings']) out[k] = m[k] && typeof m[k] === 'object' ? { ...m[k] } : {};
  out.records.byShip = { ...(out.records.byShip || {}) };
  out.v = META_VERSION;
  return out;
}

// The run options the meta gives a new run: rerolls, banishes, LUCKY STAR, and what it has seen.
export function runOptions(meta, tune = TUNE) {
  const m = normalizeMeta(meta);
  const n = m.pages.length;
  return {
    rerolls: tune.REROLLS0 + (n >= 6 ? 1 : 0) + (n >= 40 ? 1 : 0),
    banishes: (n >= 15 ? 1 : 0) + (n >= 55 ? 1 : 0),
    lucky: n >= 25,
    seen: { runs: m.seen.runs || 0, goodWhip: !!m.seen.goodWhip, offered: !!m.seen.offered,
      vistas: { ...m.seen.vistas }, trophies: [...m.trophies], lucky: n >= 25 },
  };
}

// ---------------------------------------------------------------- pages, unlocks, ships

// The pages a run's log earns that the meta does not have yet, in log order. A practice run earns none.
export function pagesFor(meta, runLog) {
  if (!runLog || runLog.practice) return [];
  const have = new Set((meta && meta.pages) || []);
  const out = [];
  const add = (id) => { if (PAGE_SET.has(id) && !have.has(id) && !out.includes(id)) out.push(id); };
  for (const l of runLog.legs || []) {
    if (l.lane) add(`lane:${l.lane}`);
    if (l.why === 'gate' || l.why === 'home') add(`gate:${l.type}`);
    if (l.why === 'caught' || l.why === 'wrecked' || l.why === 'doorstep') add(`caught:${l.type}`);
    for (const id of l.eaten || []) add(`eaten:${id}`);
    for (const id of l.beat || []) add(`beat:${id}`);
  }
  for (const id of runLog.cards || []) add(`card:${id}`);
  if (runLog.home) add('home');
  if (runLog.firstHome) add('first-home');
  return out;
}

// The unlocks open at a page count, in track order.
export function unlocksAt(pages) {
  const n = Array.isArray(pages) ? pages.length : Number(pages) || 0;
  return UNLOCKS.filter((u) => n >= u.at).map((u) => u.id);
}

// The next unlock after a page count: { id, name, at, left } or null when the log is full.
export function nextUnlock(pages) {
  const n = Array.isArray(pages) ? pages.length : Number(pages) || 0;
  const u = UNLOCKS.find((x) => n < x.at);
  return u ? { id: u.id, name: u.name, at: u.at, left: u.at - n } : null;
}

// The result card's log line (13, 14.2) from applyRun's answer: "LOG +9 PAGES · REROLL +1 UNLOCKED", or the next
// unlock when none opened: "LOG +7 PAGES · 2 TO BANISH". A full log reads "LOG +n PAGES · LOG FULL". null for a
// practice run (it earns no pages).
export function logLine(applied, practice = false) {
  if (!applied || practice) return null;
  const n = (applied.pages || []).length;
  const head = `LOG +${n} ${n === 1 ? 'PAGE' : 'PAGES'}`;
  const opened = (applied.unlocks || []).map((id) => UNLOCKS.find((u) => u.id === id)).filter(Boolean);
  if (opened.length) return `${head} · ${opened.map((u) => u.short).join(' · ')} UNLOCKED`;
  const next = applied.next;
  if (!next) return `${head} · LOG FULL`;
  const u = UNLOCKS.find((x) => x.id === next.id);
  return `${head} · ${next.left} ${next.left === 1 ? 'PAGE' : 'PAGES'} TO ${u ? u.short : next.name}`;
}

// The ships a run's feats unlock that the meta does not have yet.
export function shipUnlocks(meta, runLog) {
  if (!runLog || runLog.practice) return [];
  const have = new Set((meta && meta.ships) || ['lantern']);
  const out = [];
  const legs = runLog.legs || [];
  if (!have.has('needle') && legs.some((l, i) => (l.legNo ?? i) >= 2 && l.clean && (l.why === 'gate' || l.why === 'home'))) {
    out.push('needle');
  }
  if (!have.has('tug') && (runLog.takedowns || 0) >= 3) out.push('tug');
  if (!have.has('ghost') && runLog.home) out.push('ghost');
  return out;
}

// How far a run got, for records: home beats any leg; then the furthest leg; then fewer years.
const better = (a, b) => {
  if (!b) return true;
  if (!!a.home !== !!b.home) return !!a.home;
  if (a.legNo !== b.legNo) return a.legNo > b.legNo;
  return a.years < b.years;
};

// The days since 1970-01-01 for a YYYY-MM-DD date (civil calendar, integer maths).
export function dayNumber(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return 0;
  let y = Number(m[1]);
  const mo = Number(m[2]), d = Number(m[3]);
  y -= mo <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era * 400;
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

// The daily route for a date (14.4): one seed for everyone, and one ship a day cycling through all four (a locked
// ship is lent).
export function dailyFor(date, meta = null) {
  const ship = SHIP_ORDER[((dayNumber(date) % 4) + 4) % 4];
  const have = new Set((meta && meta.ships) || ['lantern']);
  return { date, seed: daySeed('race', date), ship, borrowed: !have.has(ship) };
}

// EASY LIGHT is offered after 3 runs caught on leg 1 or 2 (a visible toggle on the result card, never automatic).
export const EASY_AFTER = 3;

// Fold a finished run into the meta. → { meta (new), pages, unlocks, ships, medals: [{ type, medal }], redshift (the
// newly opened step or 0), record (a new best), easy (EASY LIGHT newly offered), next (the next unlock) }.
export function applyRun(meta, runLog, tune = TUNE) {
  const m = normalizeMeta(meta);
  if (!runLog) return { meta: m, pages: [], unlocks: [], ships: [], medals: [], redshift: 0, record: false,
    easy: false, next: nextUnlock(m.pages) };
  const pages = pagesFor(m, runLog);
  const before = unlocksAt(m.pages);
  m.pages = [...m.pages, ...pages];
  const unlocks = unlocksAt(m.pages).filter((u) => !before.includes(u));
  m.unlocks = unlocksAt(m.pages);
  const ships = shipUnlocks(m, runLog);
  m.ships = [...m.ships, ...ships];
  // medals: your years for each leg finished, best kept
  const medals = [];
  for (const l of runLog.legs || []) {
    if (!(l.why === 'gate' || l.why === 'home')) continue;
    const md = medalFor(l.type, l.years);
    if (md && medalRank(md) > medalRank(m.medals[l.type])) { m.medals[l.type] = md; medals.push({ type: l.type, medal: md }); }
  }
  // the rest only for a full run (practice earns medals only)
  let redshift = 0, record = false, easy = false;
  if (!runLog.practice) {
    m.runs = (m.runs || 0) + 1;
    m.seen.runs = (m.seen.runs || 0) + 1;
    if (runLog.goodWhip) m.seen.goodWhip = true;
    if (runLog.offered) m.seen.offered = true;
    for (const g of runLog.vistas || []) m.seen.vistas[g] = true;
    for (const t of runLog.trophies || []) if (!m.trophies.includes(t)) m.trophies.push(t);
    if (runLog.home && runLog.ranked !== false && !runLog.easy) {
      const open = Math.min(REDSHIFT_MAX, Math.max(m.redshift.open, (runLog.redshift || 0) + 1));
      if (open > m.redshift.open) { redshift = open; m.redshift.open = open; }
    }
    const rec = { home: !!runLog.home, legNo: runLog.legNo || 0, years: runLog.years || 0, ship: runLog.ship,
      type: runLog.type || null, seed: runLog.seed };
    if (runLog.ranked !== false && !runLog.easy) {
      if (better(rec, m.records.best)) { m.records.best = rec; record = true; }
      if (better(rec, m.records.byShip[runLog.ship])) m.records.byShip[runLog.ship] = rec;
    }
    if (runLog.daily) {
      const d = m.daily[runLog.daily];
      if (better(rec, d)) m.daily[runLog.daily] = rec;
    }
    if (!runLog.home && (runLog.legNo || 0) <= 1) m.easy.early = (m.easy.early || 0) + 1;
    if (!m.easy.offered && m.easy.early >= EASY_AFTER) { m.easy.offered = true; easy = true; }
  }
  return { meta: m, pages, unlocks, ships, medals, redshift, record, easy, next: nextUnlock(m.pages) };
}
