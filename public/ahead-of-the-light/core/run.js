// Ahead of the Light: the run (final.md 9, 11.3, 12, 13, 14, 16; 18.2's shape): the state machine and its API.
//   launch → leg → gate → vista → break → chart → launch ... until caught or home.
// startLeg builds the leg on the chosen lane with your ship and build and puts the run in 'launch'; follow(run, race)
// tracks the race through 'leg' and 'gate' to 'vista'; endLeg is the arrival (the leg's record, your meters, the
// rivals' states, the dock, the clean-leg bonus, bosses, trophies, fusions and legendaries due, and the offer) and
// leaves the run in 'break', 'caught' or 'home'; pick, skip, reroll and banish answer the offer and move it to
// 'chart'; chooseLane picks the next lane and puts the run in 'launch'. Docks go through survival.js (18.4). The run
// is plain JSON-safe data: save.js stores it at each break. Pure.
import { TUNE } from './tune.js';
import { createRace } from './race.js';
import { buildLeg, piecesOf } from './course/gen.js';
import { ROUTE } from './course/legs.js';
import { makeChart, chartView, launchTtc, GATE_NAMES } from './chart.js';
import { pickRegulars, legResult } from './rivals.js';
import * as SV from './survival.js';
import { CARD, LEGENDS, TROPHY_OF, applyBuild, amountOf, cardState, shipHooks, mergeHooks, faceOf, fusionsReady,
  legendsReady, replacesOf, completes } from './cards.js';
import { makeOffer, refill } from './offer.js';
import { shipOf, shipTune, runOptions, dailyFor, applyRun, logLine } from './meta.js';
import { trackHooks, legLog, causeOf, percentHome, rankOf, legName, ordinal, rivalName, runSummary } from './log.js';
import { hashSeed } from '../../light-years-home/core/rng.js';

export const RUN_VERSION = 1;
export const RUN_PHASES = Object.freeze(['launch', 'leg', 'gate', 'vista', 'break', 'chart', 'caught', 'home']);
const NAMED = new Set(['hound', 'pike', 'remora', 'moth', 'whale', 'mako', 'manta']);

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isOut = (s) => s.caught || s.wrecked;
const lastOf = (run) => (run.legs.length ? run.legs[run.legs.length - 1] : null);

// Per race: the tuning the run gave it (before ship and cards) and whether its arrival was taken. A WeakMap, so the
// race keeps 18.2's shape.
const RACES = new WeakMap();

// A named stream from the run's seed, its state kept in run.streams[name] (mulberry32, as race.js's rand), so the
// run stays plain data and the same choices give the same draws.
export function streamRng(run, name) {
  return () => {
    const a = (((run.streams[name] ?? hashSeed(run.seed, name)) + 0x6d2b79f5) >>> 0);
    run.streams[name] = a;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- a new run

// A run (18.2). meta: the stored meta (pages give rerolls, banishes and LUCKY STAR; seen gives the teaching flags and
// the trophies earned before). daily: a YYYY-MM-DD date for the daily route (its seed and ship unless given). tune:
// the live TUNE (URL overrides).
export function createRun({ seed, ship = null, daily = null, redshift = 0, easy = false, meta = null,
  tune = TUNE } = {}) {
  if (daily) {
    const d = dailyFor(daily, meta);
    if (seed === undefined || seed === null) seed = d.seed;
    if (!ship) ship = d.ship;
  }
  if (seed === undefined || seed === null) seed = 1;
  ship = shipOf(ship || 'lantern').id;
  const T = shipTune(ship, tune, redshift, easy);
  const opts = runOptions(meta, tune);
  const regs = pickRegulars(seed);
  const rivals = {};
  for (const id of [...regs.racing, regs.reserve]) {
    if (!id) continue;
    rivals[id] = { hull: tune.HULL0, fuel: tune.RIVAL_FUEL_MIN, gap: tune.GAP0, alive: true, nemesis: false,
      settled: false };
  }
  const starts = shipOf(ship).starts;
  return {
    v: RUN_VERSION, seed, daily, ship, redshift, easy, ranked: !easy,
    leg: 0, phase: 'launch',
    chart: makeChart(seed, tune), lanes: [],
    you: { hull: T.HULL0, hullMax: T.HULL_MAX, shield: T.SHIELD_MAX, shieldMax: T.SHIELD_MAX, fuel: T.FUEL0,
      fuelCap: T.FUEL_CAP, gap: T.GAP0, years: 0, earth: 0, launchEta: T.ETA0 },
    build: starts ? [{ id: starts, r: 0 }] : [],
    pending: [],
    pity: 0, rerolls: opts.rerolls, banishes: opts.banishes, banned: [],
    offer: null,
    dock: null,
    field: { racing: [...regs.racing], reserve: regs.reserve || null, order: [], rivals,
      bosses: { whale: null, mako: null, manta: null } },
    used: [], seen: opts.seen, legs: [],
    streams: {},
  };
}

// A practice run (14.4): one leg, LANTERN, no cards; medals, no pages. Unranked.
export function practiceRun({ seed = 1, leg = 0, lane = 0, tune = TUNE } = {}) {
  const run = createRun({ seed, ship: 'lantern', tune });
  run.ranked = false;
  run.build = [];
  run.leg = clamp(leg | 0, 0, ROUTE.length - 1);
  const lanes = run.chart[run.leg] || [];
  run.lanes[run.leg] = (typeof lane === 'number' ? lanes[lane] : lanes.find((l) => l.id === lane || l.name === lane))
    || lanes[0] || null;
  run.seen.practice = true;
  return run;
}

// Is your ship a lifeboat now (LIFEBOAT fired and no dock has rebuilt it)?
const boatOf = (run) => run.build.find((b) => b.id === 'lifeboat' && b.boat) || null;
// Your best gear so far this run, for gearUp { best } (6.2 after C15).
export const bestGearOf = (run) => run.legs.reduce((m, l) => Math.max(m, l.topGear || 0, l.bestGear || 0), 0);

// ---------------------------------------------------------------- a leg

// The race for the run's current leg on its chosen lane (run.lanes[leg], or the chart's first), with your ship's
// numbers, REDSHIFT and EASY LIGHT in its tuning, your cards' patches and hooks, your ship's quirks, the run-log
// tracker, and the course mods your cards ask for (SLINGSHOT HOME). Your maxima come from your ship and cards; the
// shield is full at each launch.
export function startLeg(run, tune = TUNE) {
  const type = ROUTE[run.leg] || ROUTE[0];
  const lane = run.lanes[run.leg] || (run.chart[run.leg] && run.chart[run.leg][0]) || null;
  const ST = shipTune(run.ship, tune, run.redshift, run.easy);
  const B = applyBuild(run.build, ST);
  const T = B.tune;
  const boat = boatOf(run), S = shipOf(run.ship), you = run.you;
  you.hullMax = T.HULL_MAX;
  you.fuelCap = T.FUEL_CAP;
  you.shieldMax = boat ? 0 : T.SHIELD_MAX;
  you.hull = clamp(you.hull, boat ? 1 : 0, you.hullMax);
  you.fuel = clamp(you.fuel, 0, you.fuelCap);
  you.shield = you.shieldMax;
  const leg = buildLeg({ runSeed: run.seed, type, lane, mods: B.mods, seen: run.seen, used: new Set(run.used), tune });
  const race = createRace({ run, leg, tune: ST });
  const me = race.ships[0];
  me.half = boat ? S.half / 2 : S.half;
  me.turnMax = S.turn;
  me.bestGear = bestGearOf(run);
  if (boat) cardState(race).lifeboat = true;
  race.hooks = mergeHooks(race.hooks, shipHooks(run.ship), trackHooks());
  RACES.set(race, { tune, ended: false });
  run.phase = 'launch';
  return race;
}

// Keep the run's phase with the race: 'launch' in the launch section, 'leg' while racing, 'gate' from THREAD OR DOCK
// to the gate line, the run-out or the landing, 'vista' once the leg has ended at a gate (until endLeg). Returns the
// phase. Optional: main.js may call endLeg on legEnd and skip the vista phase.
export function follow(run, race) {
  if (!race || !['launch', 'leg', 'gate', 'vista'].includes(run.phase)) return run.phase;
  const p = race.phase;
  if (p === 'launch') run.phase = 'launch';
  else if (p === 'race') run.phase = 'leg';
  else if (p === 'gate' || p === 'runout' || p === 'land') run.phase = 'gate';
  else if (p === 'done') {
    const you = race.ships[0];
    if (!isOut(you) && race.leg.type !== 'earth') run.phase = 'vista';
  }
  return run.phase;
}

// The named id of a ship in the race (its rival id), or null for you and drifters.
function namedOf(race, id) {
  const s = race.ships.find((x) => x.id === id);
  if (!s) return NAMED.has(id) ? id : null;
  if (s.kind !== 'regular' && s.kind !== 'boss') return null;
  return NAMED.has(s.type) ? s.type : NAMED.has(s.id) ? s.id : null;
}
const ids = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// The leg's standings from rivals.js, made safe while it is a stub.
function standings(race) {
  let r = null;
  try { r = legResult(race); } catch (e) { r = null; }
  return r && typeof r === 'object' ? r : {};
}

// The arrival (9.2 step 1): the leg's record, your meters back into the run, the rivals' states, then the dock, the
// clean-leg bonus, a beaten boss, trophies, the fusions and legendaries due, and the offer. Leaves the run in
// 'break', 'caught' or 'home'. tune: the run's tuning (defaults to what startLeg was given).
export function endLeg(run, race, tune = null) {
  const info = RACES.get(race) || { tune: tune || TUNE, ended: false };
  if (info.ended) return run;
  const T = tune || info.tune || TUNE;
  const you = race.ships[0];
  const end = race.events.find((e) => e.type === 'legEnd') || null;
  const why = end ? end.why : you.wrecked ? 'wrecked' : you.caught ? 'caught' : race.phase === 'done' ? 'gate' : null;
  if (!why) return run;                                  // the leg is still in flight
  info.ended = true;
  RACES.set(race, info);
  const L = legLog(race), cs = cardState(race), res = standings(race), lane = race.leg.lane || {};
  const f = run.field;

  // your place among you and the named ships through the gate line (or the door)
  const order = race.order.filter((id) => id === you.id || namedOf(race, id));
  const at = order.indexOf(you.id);
  const place = at < 0 ? null : at + 1;
  const lastHit = L.lastHit;
  const hitCatch = (why === 'caught') && lastHit && race.t - lastHit.t <= 0.1;
  const red = Boolean((L.lastRed && race.t - L.lastRed.t <= 0.1) || (lastHit && lastHit.cause === 'scorch'
    && race.t - lastHit.t <= 0.1));
  const takedown = lastHit && lastHit.by && (lastHit.cause === 'takedown' || lastHit.cause === 'trapped')
    ? namedOf(race, lastHit.by) || lastHit.by : null;
  const land = race.events.find((e) => e.type === 'land') || null;
  const rec = {
    legNo: run.leg, type: race.leg.type, lane: lane.id || null, laneName: lane.name || null, kind: lane.kind || null,
    fam: lane.fam || null, cond: lane.cond || null, hash: race.leg.hash, beats: race.leg.beats, dist: you.dist, why,
    place, gate: null, years: you.years, earth: you.earth, hits: you.stats.hits, clean: false,
    topGear: you.stats.topGear, bestGear: you.bestGear, takedowns: you.stats.takedowns, beat: [], eaten: [], fed: [],
    nemesis: null, settled: null, boss: null, bossBeaten: false, bounty: null, trophies: [], offered: [], took: [],
    bought: 0, joins: null, hullOut: you.hull, lines: [], vista: null, firstHome: false, noCard: false,
    end: { t: race.t, fuel: you.fuel, eta: you.eta, light: you.light, piece: lastHit ? lastHit.piece : null,
      takedownBy: takedown, takedownT: lastHit ? lastHit.t : 0, red, hitCatch: Boolean(hitCatch),
      slowFor: race.t - L.lastFast, land: land ? { ok: land.ok, margin: land.margin, cells: land.cellsSpent ?? null,
        hull: land.hullSpent ?? null } : null },
    lastHit: lastHit ? { cause: lastHit.cause, piece: lastHit.piece, by: lastHit.by } : null,
  };
  for (const v of L.downed) { const n = namedOf(race, v); if (n && !rec.beat.includes(n)) rec.beat.push(n); }

  // your meters back into the run
  Object.assign(run.you, { hull: you.hull, shield: you.shield, fuel: you.fuel, gap: you.gap });
  run.you.years += you.years;
  run.you.earth += you.earth;
  if (cs.lifeboat) {
    const b = run.build.find((x) => x.id === 'lifeboat');
    if (b) b.boat = true;
  }
  if (L.good > 0) run.seen.goodWhip = true;

  // the field: each named rival's meters, the light's catches, the Nemesis, the bosses, the reserve
  const eaten = new Set(ids(res.eaten).map((x) => namedOf(race, x) || x).filter((x) => NAMED.has(x)));
  for (const s of race.ships) {
    if (s === you) continue;
    const n = namedOf(race, s.id);
    if (!n) continue;
    if (s.caught && !s.wrecked) eaten.add(n);
    if (s.kind === 'regular') {
      const r = f.rivals[n] || (f.rivals[n] = { hull: s.hullMax, fuel: s.fuel, gap: s.gap, alive: true,
        nemesis: false, settled: false });
      r.hull = s.hull;
      r.fuel = s.fuel;
      r.gap = s.gap;
      if (isOut(s)) r.alive = false;
    }
  }
  rec.eaten = [...eaten];
  for (const n of rec.eaten) {
    if (f.rivals[n]) f.rivals[n].alive = false;
    rec.lines.push(`THE LIGHT TOOK ${rivalName(n)}`);
  }
  rec.fed = ids(res.fed).map((x) => namedOf(race, x) || x).filter((x) => NAMED.has(x));
  const nem = ids(res.nemesis).map((x) => namedOf(race, x) || x).find((x) => f.rivals[x]) || null;
  if (nem && !f.rivals[nem].settled) {
    for (const [k, r] of Object.entries(f.rivals)) r.nemesis = k === nem;
    rec.nemesis = nem;
    rec.lines.push(`${rivalName(nem)} IS YOUR NEMESIS`);
  }
  const settled = ids(res.settled).map((x) => namedOf(race, x) || x).find((x) => f.rivals[x]) || null;
  if (settled) {
    f.rivals[settled].settled = true;
    f.rivals[settled].nemesis = false;
    rec.settled = settled;
    rec.lines.push(`${rivalName(settled)}: SETTLED`);
  }
  // a regular out of the run: the reserve joins once
  const racing = f.racing.filter((id) => !f.rivals[id] || f.rivals[id].alive);
  if (racing.length < f.racing.length && f.reserve) {
    racing.push(f.reserve);
    rec.joins = rivalName(f.reserve);
    f.reserve = null;
  }
  f.racing = racing;
  // the boss: beaten by finishing ahead of it (or the light taking it), or as rivals.js reports
  const bossShip = race.ships.find((s) => s.kind === 'boss');
  if (bossShip) {
    const id = NAMED.has(bossShip.type) ? bossShip.type : bossShip.id;
    const rb = res.boss && typeof res.boss === 'object' ? res.boss : res.boss ? { id: res.boss, beaten: true } : null;
    const bi = race.order.indexOf(bossShip.id);
    const ahead = place !== null && (bi < 0 || race.order.indexOf(you.id) < bi);
    const beaten = rb && rb.id === id ? Boolean(rb.beaten) : (isOut(bossShip) || ahead);
    rec.boss = id;
    rec.bossBeaten = beaten && !isOut(you);
    if (id in f.bosses) f.bosses[id] = rec.bossBeaten ? 'beaten' : 'lost';
    if (rec.bossBeaten && !rec.beat.includes(id)) rec.beat.push(id);
  }
  // the grid for the next leg: named ships in the order they crossed (the VOID keeps the old order, you first)
  if (race.ships.some((s) => s !== you && namedOf(race, s.id))) f.order = order.map((id) => (id === you.id ? 'you'
    : namedOf(race, id)));
  else f.order = ['you', ...f.order.filter((id) => id !== 'you')];
  // trophies: a regular you fed to the light, or your Nemesis settled
  for (const n of [...rec.fed, ...(settled ? [settled] : [])]) {
    const t = TROPHY_OF[n];
    if (!t || rec.trophies.includes(t) || run.build.some((b) => b.id === t) || run.pending.some((p) => p.id === t)
      || (run.seen.trophies || []).includes(t)) continue;
    rec.trophies.push(t);
    run.pending.push({ id: t, kind: 'trophy' });
  }
  run.used.push(...piecesOf(race.leg).filter((id) => !run.used.includes(id)));
  run.legs.push(rec);

  // the end of the run
  if (why === 'caught' || why === 'wrecked' || why === 'doorstep') { run.phase = 'caught'; run.offer = null; return run; }
  if (why === 'home' || run.leg >= ROUTE.length - 1 || (run.seen && run.seen.practice)) {
    const manta = race.ships.find((s) => s.kind === 'boss' && (s.type === 'manta' || s.id === 'manta'));
    rec.firstHome = why === 'home' && (manta ? rec.bossBeaten : place === 1);
    run.phase = 'home';
    run.offer = null;
    return run;
  }

  // the gate: the launch speed, the dock, the clean-leg bonus, a beaten boss
  let gate = you.gate || 'past';
  if (gate === 'dock' && shipOf(run.ship).noDock) gate = 'past';
  rec.gate = gate;
  const gateId = race.leg.gate ? race.leg.gate.id : `gate-${race.leg.type}`;
  rec.vista = { gate: gateId, name: GATE_NAMES[run.leg], skippable: Boolean(run.seen.vistas && run.seen.vistas[gateId]) };
  run.seen.vistas = { ...(run.seen.vistas || {}), [gateId]: true };
  const ls = typeof SV.launchState === 'function' ? SV.launchState(run, gate, T) : null;
  run.you.launchEta = ls && finite(ls.eta) ? ls.eta
    : gate === 'thread' ? T.LAUNCH_THREAD : gate === 'dock' ? T.LAUNCH_DOCK : T.LAUNCH_PAST;
  const Y = run.you;
  if (gate === 'dock') {
    const free = run.redshift >= 5 ? 0 : T.FREE_REPAIR;
    run.dock = { free, bought: [] };
    const boat = boatOf(run);
    if (boat) {
      boat.boat = false;
      Y.hull = Math.max(Y.hull, 1);
      rec.lines.push('THE SHIP IS REBUILT');
    } else if (free > 0 && Y.hull < Y.hullMax) {
      Y.hull = Math.min(Y.hullMax, Y.hull + free);
      rec.lines.push(`FREE REPAIR +${free}`);
    }
  } else run.dock = null;
  if (you.stats.hits === 0) {
    rec.clean = true;
    if (Y.hull < Y.hullMax && !boatOf(run)) Y.hull = Math.min(Y.hullMax, Y.hull + T.CLEAN_BONUS);
    else Y.fuel = Math.min(Y.fuelCap, Y.fuel + T.CLEAN_BONUS);
    rec.lines.push(`CLEAN LEG +${T.CLEAN_BONUS}`);
  }
  if (rec.bossBeaten) {
    if (!boatOf(run)) Y.hull = Y.hullMax;
    Y.fuel = Y.fuelCap;
    rec.lines.push(`${rivalName(rec.boss)} BEATEN · HULL AND FUEL FULL`);
  }
  if (cs.bountyPaid) {
    const b = run.build.find((x) => x.id === 'bounty');
    rec.bounty = b ? amountOf('bounty', b.r) : 0;
    rec.lines.push('BOUNTY PAID · ONE MORE PICK');
  }
  return openBreak(run, T);
}

// Open the break after the run's last leg record: the fusions and legendaries due join the queue, then the offer (the
// VOID gives the SKIP reward instead of a card). endLeg calls it; the offer sims call it with a record of their own.
export function openBreak(run, tune = TUNE) {
  const rec = lastOf(run);
  queueSpecials(run, run.leg + 1, tune);
  run.phase = 'break';
  if (rec && rec.kind === 'void') {
    rec.noCard = true;
    run.offer = null;
    skipReward(run, tune);
  } else run.offer = newOffer(run, tune);
  return run;
}

// Fusions (from break FUSION_FROM) and legendaries (from break LEGEND_FROM, while you own none) unlocked since the last
// offer join the queue for slot 3, one an offer.
function queueSpecials(run, b, T) {
  const owned = new Set(run.build.map((x) => x.id));
  const met = new Set();
  for (const l of run.legs) for (const id of l.offered || []) met.add(id);
  const due = (id) => !owned.has(id) && !met.has(id) && !run.pending.some((p) => p.id === id);
  if (b >= T.FUSION_FROM) for (const id of fusionsReady(run.build)) if (due(id)) run.pending.push({ id, kind: 'fusion' });
  const hasLegend = run.build.some((x) => CARD[x.id] && CARD[x.id].kind === 'legend');
  if (b >= T.LEGEND_FROM && !hasLegend) {
    for (const id of legendsReady(run.build, T)) if (due(id)) run.pending.push({ id, kind: 'legend' });
  }
}

function newOffer(run, T) {
  const o = makeOffer(run, streamRng(run, `offer:${run.leg + 1}`), T);
  run.pity = o.pity;
  return o;
}

// SKIP's reward: +1 fuel, or +1 reroll when your tanks are full.
function skipReward(run, T) {
  const Y = run.you;
  if (Y.fuel >= Y.fuelCap - 1e-9) { run.rerolls += 1; return 'reroll'; }
  Y.fuel = Math.min(Y.fuelCap, Y.fuel + T.SKIP_FUEL);
  return 'fuel';
}

// Close the open offer: what it showed goes into the leg's record, its special leaves the queue.
function closeOffer(run) {
  const o = run.offer, rec = lastOf(run);
  if (!o) return;
  if (rec) for (const c of o.cards) if (!rec.offered.includes(c.id)) rec.offered.push(c.id);
  if (o.special) {
    const k = run.pending.findIndex((p) => p.id === o.special);
    if (k >= 0) run.pending.splice(k, 1);
  }
  if (o.first) run.seen.offered = true;
  run.offer = null;
  run.phase = 'chart';
}

// Take a card into the build: a form replaces the form of its family; a legendary closes the others for the run.
function take(run, c) {
  const card = CARD[c.id];
  if (!card || run.build.some((b) => b.id === c.id)) return false;
  if (card.kind === 'form') run.build = run.build.filter((b) => !(CARD[b.id] && CARD[b.id].kind === 'form'
    && CARD[b.id].fam === card.fam));
  if (card.kind === 'legend') run.pending = run.pending.filter((p) => !LEGENDS.includes(p.id));
  run.build.push({ id: c.id, r: c.r });
  return true;
}

// ---------------------------------------------------------------- the break

// The break screen's model (9.2, 16): the arrival line, the field's news, your ship and the light at launch, the
// build, the offer's faces, the dock strip, SKIP and REROLL. tune: the run's tuning.
export function breakOf(run, tune = TUNE) {
  const rec = lastOf(run);
  const T = tune, Y = run.you;
  const o = run.offer;
  const ttc = launchTtc(Y.gap, Y.launchEta);
  const place = rec ? rec.place : null;
  const header = rec ? [GATE_NAMES[rec.legNo], `LEG ${rec.legNo + 1} OF ${ROUTE.length}`,
    `YOU AGED +${(Math.round(rec.years * 10) / 10).toFixed(1)} YR`, place ? ordinal(place) : null]
    .filter(Boolean).join(' · ') : '';
  const forms = (b) => (CARD[b.id] && CARD[b.id].kind === 'form' ? 0 : 1);
  const bonusTag = o && o.bonus === 'first' ? `FIRST TO ${GATE_NAMES[run.leg]}` : o && o.bonus === 'boss'
    ? `${rivalName(rec && rec.boss)} BEATEN` : o && o.bonus === 'lucky' ? 'LUCKY STAR' : null;
  let chips = [];
  if (run.dock && typeof SV.dockPrices === 'function') {
    try { chips = SV.dockPrices(run, T) || []; } catch (e) { chips = []; }
  }
  return {
    leg: run.leg, phase: run.phase, header, lines: rec ? [...rec.lines] : [], vista: rec ? rec.vista : null,
    ship: { type: run.ship, hull: Y.hull, hullMax: Y.hullMax, shield: Y.shieldMax, shieldMax: Y.shieldMax,
      fuel: Y.fuel, fuelCap: Y.fuelCap, boat: Boolean(boatOf(run)) },
    light: { gap: Y.gap, eta: Y.launchEta, ttc, line: `LEAD AT LAUNCH ${Math.max(0, Math.round(ttc))} S` },
    build: [...run.build].sort((a, b) => forms(a) - forms(b)).map((b) => faceOf(b.id, b.r, run.build)),
    offer: o ? {
      cards: o.cards.map((c, i) => ({ ...faceOf(c.id, c.r, run.build), slot: c.slot, why: c.why, taken: o.taken.includes(i),
        replaces: c.replaces, completes: c.completes })),
      picks: o.picks, left: o.picks - o.taken.length, caption: o.caption, risk: o.risk, family: o.family,
      bonus: bonusTag, tag: o.risk ? (o.cards.length > 3 && o.picks === 1 ? 'PICK 1 OF 4 · RARE+'
        : `PICK ${o.picks} · RARE+`) : o.family ? `${o.family} × 2` : null, first: o.first,
    } : null,
    noCard: Boolean(rec && rec.noCard),
    skip: o ? (o.skip === 'reroll' || Y.fuel >= Y.fuelCap - 1e-9 ? 'SKIP · +1 REROLL' : `SKIP · +${T.SKIP_FUEL} FUEL`)
      : rec && rec.noCard ? `NO CARD · +${T.SKIP_FUEL} FUEL` : null,
    rerolls: run.rerolls, banishes: run.banishes,
    canReroll: Boolean(o && run.rerolls > 0 && !o.taken.length && !o.first),
    dock: run.dock ? { free: run.dock.free, bought: [...run.dock.bought], chips } : null,
    unlock: T.SCREEN_UNLOCK,
  };
}

// Take card i of the offer. → true if taken. The offer closes (and the run moves to 'chart') once its picks are used.
export function pick(run, i) {
  const o = run.offer;
  if (run.phase !== 'break' || !o) return false;
  const c = o.cards[i];
  if (!c || o.taken.includes(i) || o.taken.length >= o.picks) return false;
  if (CARD[c.id] && CARD[c.id].kind === 'legend' && run.build.some((b) => CARD[b.id] && CARD[b.id].kind === 'legend')) {
    return false;                                   // one legendary a run
  }
  if (!take(run, c)) return false;
  o.taken.push(i);
  const rec = lastOf(run);
  if (rec) rec.took.push(c.id);
  for (const d of o.cards) {                        // the faces' REPLACES and COMPLETES follow the new build
    d.replaces = replacesOf(d.id, run.build);
    d.completes = completes(d.id, run.build);
  }
  if (o.taken.length >= o.picks) closeOffer(run);
  return true;
}

// SKIP: +1 fuel (+1 reroll with full tanks) and the offer closes. With no offer (the VOID), on to the chart.
export function skip(run, tune = TUNE) {
  if (run.phase !== 'break') return false;
  if (run.offer) skipReward(run, tune);
  closeOffer(run);
  run.phase = 'chart';
  return true;
}

// REROLL: a new offer for the same break (the same special keeps its slot), before any pick. Not on the first offer.
export function reroll(run, tune = TUNE) {
  const o = run.offer;
  if (run.phase !== 'break' || !o || o.first || o.taken.length || !(run.rerolls > 0)) return false;
  const rec = lastOf(run);
  if (rec) for (const c of o.cards) if (!rec.offered.includes(c.id)) rec.offered.push(c.id);
  run.rerolls -= 1;
  run.offer = newOffer(run, tune);
  return true;
}

// BANISH card i: it leaves the run's pool, and its slot is drawn again. Only starters can be banished.
export function banish(run, i, tune = TUNE) {
  const o = run.offer;
  if (run.phase !== 'break' || !o || !(run.banishes > 0)) return false;
  const c = o.cards[i];
  if (!c || o.taken.includes(i) || !CARD[c.id] || CARD[c.id].pack !== 'starter') return false;
  run.banned.push(c.id);
  run.banishes -= 1;
  const out = refill(run, o, i, streamRng(run, `offer:${run.leg + 1}`), tune);
  if (out) {
    o.cards[i] = out.card;
    run.pity = out.pity;
  } else {
    o.cards.splice(i, 1);
    o.taken = o.taken.map((k) => (k > i ? k - 1 : k));
    o.picks = Math.min(o.picks, Math.max(1, o.cards.length));
  }
  return true;
}

// Choose lane i of the next leg: the run moves to that leg in 'launch' (startLeg builds it). From the break, an offer
// still open closes untaken (the screens go through pick or skip first). The dock's purchases go into the leg's
// record.
export function chooseLane(run, i = 0) {
  if (run.leg >= ROUTE.length - 1 || (run.phase !== 'break' && run.phase !== 'chart')) return false;
  if (run.offer) closeOffer(run);
  const next = run.leg + 1;
  const lanes = run.chart[next] || [];
  run.lanes[next] = lanes[i] || lanes[0] || null;
  const rec = lastOf(run);
  if (rec) rec.bought = run.dock ? run.dock.bought.length : 0;
  run.dock = null;
  run.leg = next;
  run.phase = 'launch';
  return true;
}

// The chart screen's model (chart.js).
export const chartOf = (run, tune = TUNE) => chartView(run, tune);

// ---------------------------------------------------------------- the result (13)

// Seconds before the result card takes input (16).
export const RESULT_UNLOCK = 0.9;

// The result card's model: one cause, one goal. meta (optional): the stored meta from before this run, for BEST and
// the log line. applied (optional): applyRun's answer if the page has already folded the run in; without it the
// card previews applyRun(meta, runSummary(run)) and changes nothing. → { home, firstHome, title, where, percent,
// cause, goal, line, years, earth, yearsLine, rank, place, build, best, log, easy, unlock, legs, practice }
export function resultOf(run, meta = null, tune = TUNE, applied = null) {
  const rec = lastOf(run), prev = run.legs.length > 1 ? run.legs[run.legs.length - 2] : null;
  const home = run.phase === 'home';
  const type = rec ? rec.type : ROUTE[run.leg];
  const n = (rec ? rec.legNo : run.leg) + 1;
  const pct = home && rec && (rec.why === 'home' || run.seen.practice) ? 100 : percentHome(run, tune);
  const practice = Boolean(run.seen && run.seen.practice);
  const cause = home || !rec ? null : causeOf(rec, prev);
  const land = rec && rec.end ? rec.end.land : null;
  const scorched = Boolean(land && land.hull > 0);
  const title = practice ? (home ? 'LEG CLEARED' : 'THE LIGHT CAUGHT YOU') : home ? (scorched ? 'SCORCHED BUT HOME'
    : 'HOME') : rec && rec.why === 'wrecked' ? 'WRECKED' : rec && rec.why === 'doorstep' ? 'CAUGHT ON THE DOORSTEP'
    : 'THE LIGHT CAUGHT YOU';
  const where = home && !practice ? 'EARTH · LEG 8 OF 8' : `${legName(type)} · LEG ${n} OF ${ROUTE.length} · ${pct} % HOME`;
  let line = null;
  if (home && !practice) {
    line = scorched ? `SCORCHED BUT HOME · ${land.hull} HULL SPENT ON THE AIR`
      : land && finite(land.margin) ? `HOME · ${(Math.round(land.margin * 10) / 10).toFixed(1)} S AHEAD OF THE LIGHT`
        : 'HOME AHEAD OF THE LIGHT';
  } else if (cause && cause.by) {
    line = `CAUGHT AT ${legName(type)} AFTER ${rivalName(cause.by)}'S TAKEDOWN`;
  } else if (cause && cause.place) line = `CAUGHT ${cause.place} AT ${legName(type)}`;
  const y = run.you.years, e = run.you.earth;
  const r1 = (v) => Math.round(v);
  let best = null;
  if (meta && meta.records && meta.records.best) {
    const b = meta.records.best;
    best = b.home ? `BEST: HOME IN ${(Math.round(b.years * 10) / 10).toFixed(1)} YR`
      : `BEST: ${legName(ROUTE[b.legNo || 0])}`;
  }
  const summary = runSummary(run);
  const done = applied || (meta ? applyRun(meta, summary, tune) : null);
  return {
    home, practice, firstHome: Boolean(rec && rec.firstHome), title, where, percent: pct, leg: n, type,
    cause: cause ? cause.line : null, causeId: cause ? cause.id : null, goal: cause ? `NEXT TIME: ${cause.goal}` : null,
    line, years: y, earth: e,
    yearsLine: home && !practice ? `HOME IN ${r1(y)} YEARS · EARTH WAITED ${r1(e)}` : `YOU AGED ${r1(y)} YEARS`,
    rank: home && !practice ? rankOf(y, tune) : null, place: rec ? rec.place : null,
    build: run.build.map((b) => faceOf(b.id, b.r, run.build)), best, legs: summary.legs, summary,
    log: logLine(done, practice), easy: Boolean(done && done.easy), unlock: RESULT_UNLOCK,
    chart: chartView(run, tune),
  };
}

// ---------------------------------------------------------------- saving

// A JSON-safe copy, and back. restore also takes a suspend envelope ({ v, at, run }) and returns its run.
export function snapshot(run) { return JSON.parse(JSON.stringify(run)); }
export function restore(json) {
  const o = typeof json === 'string' ? JSON.parse(json) : JSON.parse(JSON.stringify(json));
  return o && o.run && o.at ? o.run : o;
}

// The save for a run left now: at 'break' (the run saves at every break), 'leg' (a deliberate quit or a save at the
// launch: it resumes at the leg's start with QUIT_GAP less gap) or 'pagehide' (the page went away mid-leg: it resumes
// at the leg's start with no penalty, critic lead item 6).
export function suspend(run, at = 'break') {
  const where = run.phase === 'break' || run.phase === 'chart' || run.phase === 'caught' || run.phase === 'home'
    ? 'break' : at;
  return { v: RUN_VERSION, at: where, run: snapshot(run) };
}

// A run from a save (a bare run or a suspend envelope), ready to go on: at a break it stays in its break; left
// mid-leg it starts that leg again ('leg' takes QUIT_GAP off the gap: the light kept coming). → the run, or null.
export function resume(obj, tune = TUNE) {
  if (!obj || typeof obj !== 'object') return null;
  const env = obj.run && obj.at ? obj : { at: 'break', run: obj };
  const run = restore(env.run);
  if (!run || run.v !== RUN_VERSION) return null;
  if (env.at === 'leg' || env.at === 'pagehide') {
    if (env.at === 'leg') run.you.gap = Math.max(0, run.you.gap - tune.QUIT_GAP);
    run.phase = 'launch';
  }
  return run;
}
