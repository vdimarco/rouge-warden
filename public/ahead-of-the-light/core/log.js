// Ahead of the Light: the run log (final.md 13, 14): a small tracker that rides each leg as hooks and remembers what
// the result card needs (the last hit and who caused it, the red zone, the last time you were fast, your takedowns,
// GOOD whips); the run's summary for meta.js; the result card's one cause and one goal; and the Copy log text. Pure.
import { TUNE } from './tune.js';
import { ROUTE, LEG_TYPES, CONDITIONS } from './course/legs.js';
import { CARD } from './cards.js';

// ---------------------------------------------------------------- the leg tracker

// What the tracker saw in one leg, by race (a WeakMap, so the race keeps 18.2's shape).
const LEGS = new WeakMap();
const SLOW_ETA = 1.4;                // "caught slowly": under this for the last 10 s (13)
export function legLog(race) {
  let L = LEGS.get(race);
  if (!L) {
    L = { lastHit: null, lastTakedownBy: null, lastRed: null, lastFast: 0, downed: [], good: 0, whips: 0, hits: 0 };
    LEGS.set(race, L);
  }
  return L;
}

// The tracker's hooks (race.js part 6 runs them on your events): run.js adds them to each leg's race.
export function trackHooks() {
  return {
    hit: [(c) => {
      const L = legLog(c.race), e = c.event, ship = c.ship;
      L.hits++;
      L.lastHit = { t: c.race.t, cause: e.cause, piece: e.piece ?? null, by: e.by ?? null, light: ship.light,
        fuel: ship.fuel, eta: ship.eta, hull: ship.hull, shield: ship.shield };
      if (e.by && e.cause === 'takedown') L.lastTakedownBy = { by: e.by, t: c.race.t };
    }],
    takedown: [(c) => {
      const L = legLog(c.race), e = c.event, you = c.ship.id;
      if (e.victim === you && e.by) L.lastTakedownBy = { by: e.by, t: c.race.t };
      if (e.by === you && e.victim && !L.downed.includes(e.victim)) L.downed.push(e.victim);
    }],
    redIn: [(c) => { legLog(c.race).lastRed = { t: c.race.t }; }],
    release: [(c) => {
      const L = legLog(c.race), g = c.event.grade;
      L.whips++;
      if (g === 'GOOD' || g === 'PERFECT') L.good++;
    }],
    step: [(c) => { if (c.ship.eta >= SLOW_ETA) legLog(c.race).lastFast = c.race.t; }],
  };
}

// ---------------------------------------------------------------- names

export const legName = (type) => (LEG_TYPES[type] ? LEG_TYPES[type].name : String(type || '').toUpperCase());
const NAMES = { hound: 'HOUND', pike: 'PIKE', remora: 'REMORA', moth: 'MOTH', whale: 'WHALE', mako: 'MAKO',
  manta: 'MANTA' };
export const rivalName = (id) => NAMES[id] || (id ? String(id).toUpperCase() : '');
export const ordinal = (n) => {
  if (!(n > 0)) return '';
  const k = n % 100;
  const s = k >= 11 && k <= 13 ? 'TH' : n % 10 === 1 ? 'ST' : n % 10 === 2 ? 'ND' : n % 10 === 3 ? 'RD' : 'TH';
  return `${n}${s}`;
};
const yr = (y) => `${(Math.round((y || 0) * 10) / 10).toFixed(1)}`;

// Where a hit happened, as the result card says it ("IN THE DUST"), from its piece or the lane's condition.
export const PLACE_OF = Object.freeze({
  'dust-road': 'IN THE DUST', 'mako-field': 'IN MAKO\'S FIELD', swarm: 'IN THE SWARM', 'great-wall': 'ON THE GREAT WALL',
  'coma-jellyfish': 'IN COMA\'S HEART', 'm87-jet': 'IN M87\'S JET', highway: 'ON A HIGHWAY', 'web-node': 'AT THE NODE',
  'web-rail-plan': 'ON THE FILAMENT', 'web-junction': 'AT A JUNCTION', 'first-well': 'IN THE FIRST WELL',
  asteroids: 'IN THE ASTEROIDS', 'belt-dense': 'IN THE BELT', kuiper: 'IN THE KUIPER BELT', saturn: 'AT SATURN',
  moon: 'AT THE MOON', 'oort-comets': 'IN THE COMETS', 'arm-funnel': 'IN THE ARM', 'crowded-centre': 'AT THE CENTRE',
  nursery: 'IN THE NURSERY', trapezium: 'IN THE TRAPEZIUM', 'local-void': 'IN THE VOID', rumble: 'ON THE OPEN ROAD',
  'open-road': 'ON THE OPEN ROAD', 'hub-hop': 'AMONG THE WELLS', markarian: 'ON THE CHAIN', hyades: 'IN THE HYADES',
  'alpha-cen': 'AT ALPHA CENTAURI', jupiter: 'AT JUPITER',
});

// ---------------------------------------------------------------- the result card (13)

// Goal lines when a rival caused the last hit (the rival's own line; 10.6's example for MAKO).
export const RIVAL_GOALS = Object.freeze({
  mako: 'KEEP 2 CELLS: MAKO HUNTS THE WEAKEST', hound: 'HAIRLINE A KNOT WITH HOUND ON YOUR TAIL',
  pike: 'FEINT: PIKE CANNOT SWITCH SIDES', remora: 'DODGE LATE AND REMORA EATS THE KNOT',
  moth: 'MOTH IS GREEDY: LET IT HIT FIRST', whale: 'STAY BEHIND THE WHALE, NOT BESIDE IT',
  manta: 'GET BETWEEN MANTA AND THE LIGHT',
});
export const GOALS = Object.freeze({
  takedown: 'KEEP 2 CELLS: MAKO HUNTS THE WEAKEST',
  threadLow: 'DOCK WHEN YOUR HULL IS LOW',
  red: 'THE RED ZONE COSTS HULL: LET GO SOONER',
  wrecked: 'GRAB THE PATCH: IT SHOWS ONLY WHEN YOU NEED IT',
  glareFuel: 'BURN RIGHT AFTER A HIT',
  glareDry: 'FUEL SITS AT THE GAP EDGES',
  dock: 'YOU BOUGHT TOO MUCH TIME AT THE DOCK',
  slow: 'SKIM CLOSER: EVERY GRAZE HOLDS THE LIGHT BACK',
  doorstep: 'SAVE A CELL OR TWO FOR THE LANDING',
});

// The cause of a run's end, the first that matches (13's table, read in order): → { id, line, goal, by, place }.
// rec: the last leg's record (run.js endLeg), prev: the one before it.
export function causeOf(rec, prev = null) {
  if (!rec) return null;
  const E = rec.end || {};
  const place = E.piece && PLACE_OF[E.piece] ? PLACE_OF[E.piece]
    : rec.cond && CONDITIONS[rec.cond] && rec.cond === 'dust' ? 'IN THE DUST' : null;
  const out = (id, line, goal, by = null) => ({ id, line, goal, by, place });
  if (rec.why === 'doorstep') return out('doorstep', 'Caught on the doorstep, short of the landing', GOALS.doorstep);
  if (E.takedownBy && E.t - E.takedownT <= 12) {
    const by = E.takedownBy;
    return out('takedown', `Taken down by ${rivalName(by)}`, RIVAL_GOALS[by] || GOALS.takedown, by);
  }
  if (rec.why === 'wrecked') {
    if (prev && prev.gate === 'thread' && prev.hullOut === 1) {
      return out('thread-low', 'Wrecked after threading the last gate with 1 hull', GOALS.threadLow);
    }
    if (E.red) return out('red', 'Wrecked in a red zone', GOALS.red);
    return out('wrecked', 'Wrecked with no hull left', GOALS.wrecked);
  }
  if (E.hitCatch) {
    return E.fuel >= 1 ? out('glare-fuel', 'Hit in the glare with fuel to burn', GOALS.glareFuel)
      : out('glare-dry', 'Hit in the glare with no fuel left', GOALS.glareDry);
  }
  if (prev && prev.gate === 'dock' && (prev.bought || 0) >= 2 && E.t <= 12) {
    return out('dock', `Caught ${Math.round(E.t)} s after a dock launch`, GOALS.dock);
  }
  if (E.slowFor >= 10) return out('slow', 'Caught while slower than 0.9c', GOALS.slow);
  return E.fuel >= 1 ? out('glare-fuel', 'Caught in the glare with fuel left', GOALS.glareFuel)
    : out('glare-dry', 'Caught in the glare with no fuel left', GOALS.glareDry);
}

// The share of the way home: beats flown of all the route's beats.
export function percentHome(run, tune = TUNE) {
  const total = tune.LEG_BEATS.reduce((a, b) => a + b, 0);
  let flown = 0;
  for (const l of run.legs || []) {
    const share = l.why === 'gate' || l.why === 'home' ? 1 : Math.min(1, (l.dist || 0) / Math.max(1, l.beats || 1));
    flown += share * (tune.LEG_BEATS[l.legNo] || 0);
  }
  return Math.max(0, Math.min(100, Math.round((100 * flown) / total)));
}

// The rank for a run home (13).
export function rankOf(years, tune = TUNE) {
  const [a, b, c] = tune.RANKS;
  return years <= a ? 'LIGHTKEEPER' : years <= b ? 'NAVIGATOR' : years <= c ? 'WAYFINDER' : 'DRIFTER';
}

// ---------------------------------------------------------------- the run's summary (for meta.js and the log key)

// → { v, seed, ship, daily, redshift, easy, ranked, practice, home, firstHome, why, legNo, type, years, earth, legs:
//   [{ legNo, type, lane, gate, why, place, years, clean, hits, takedowns, beat, eaten, hash }], cards, trophies,
//   takedowns, goodWhip, offered, vistas }
export function runSummary(run) {
  const legs = (run.legs || []).map((l) => ({
    legNo: l.legNo, type: l.type, lane: l.lane, gate: l.gate, why: l.why, place: l.place, years: l.years,
    clean: !!l.clean, hits: l.hits || 0, takedowns: l.takedowns || 0, beat: [...(l.beat || [])],
    eaten: [...(l.eaten || [])], hash: l.hash,
  }));
  const last = legs[legs.length - 1] || null;
  const cards = [];
  for (const l of run.legs || []) for (const id of l.took || []) if (!cards.includes(id)) cards.push(id);
  const trophies = [];
  for (const l of run.legs || []) for (const id of l.trophies || []) if (!trophies.includes(id)) trophies.push(id);
  return {
    v: 1, seed: run.seed, ship: run.ship, daily: run.daily, redshift: run.redshift, easy: run.easy,
    ranked: run.ranked, practice: !!(run.seen && run.seen.practice),
    home: run.phase === 'home', firstHome: !!(last && last.why === 'home' && last.firstHome),
    why: last ? last.why : null, legNo: last ? last.legNo : 0, type: last ? last.type : ROUTE[0],
    years: run.you.years, earth: run.you.earth, legs, cards, trophies,
    takedowns: legs.reduce((a, l) => a + l.takedowns, 0),
    goodWhip: !!(run.seen && run.seen.goodWhip), offered: !!(run.seen && run.seen.offered),
    vistas: Object.keys((run.seen && run.seen.vistas) || {}),
  };
}

// ---------------------------------------------------------------- Copy log

// Plain text for a run (and its races, if given: their leg hashes), for the Copy log button.
export function runLogText(run, races = []) {
  if (!run) return 'AHEAD OF THE LIGHT';
  const lines = [`AHEAD OF THE LIGHT · SEED ${run.seed} · ${String(run.ship || 'lantern').toUpperCase()}`
    + (run.daily ? ` · DAILY ${run.daily}` : '') + (run.redshift ? ` · REDSHIFT ${run.redshift}` : '')
    + (run.easy ? ' · EASY LIGHT' : '') + (run.ranked ? '' : ' · UNRANKED')];
  for (const l of run.legs || []) {
    const lane = l.laneName ? ` (${l.laneName}${l.cond ? ` · ${String(l.cond).toUpperCase()}` : ''})` : '';
    const end = l.why === 'gate' ? `${String(l.gate || 'past').toUpperCase()}` : String(l.why || '').toUpperCase();
    lines.push(`LEG ${l.legNo + 1} ${legName(l.type)}${lane}: ${end} · ${ordinal(l.place) || '-'} · +${yr(l.years)} YR`
      + ` · ${l.hits || 0} HITS · ${l.hash}`);
    if (l.took && l.took.length) lines.push(`  TOOK ${l.took.map((id) => (CARD[id] ? CARD[id].name : id)).join(', ')}`);
  }
  for (const r of races || []) if (r && r.leg) lines.push(`  LEG ${r.leg.legNo + 1} HASH ${r.leg.hash}`);
  const res = run.phase === 'home' ? `HOME IN ${yr(run.you.years)} YEARS · EARTH WAITED ${yr(run.you.earth)}`
    : run.phase === 'caught' ? `CAUGHT AT ${legName(ROUTE[run.leg])} · ${percentHome(run)} % HOME` : 'IN FLIGHT';
  lines.push(res);
  lines.push(`BUILD: ${(run.build || []).map((b) => (CARD[b.id] ? CARD[b.id].name : b.id)).join(', ') || 'NONE'}`);
  return lines.join('\n');
}
