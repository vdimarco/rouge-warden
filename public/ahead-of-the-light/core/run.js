// Ahead of the Light: the run (final.md 18.2, 9, 14): its state machine and API. leg → arrival and offer → chart →
// the next leg, until caught or home. The run is plain JSON-safe data; save.js stores it at each break.
// SPINE STUB (WP0): createRun builds the 18.2 shape, startLeg builds a race, endLeg and chooseLane move the run
// along; the offer, dock and result functions are safe do-nothing bodies. WP5 owns this file. Pure.
import { TUNE } from './tune.js';
import { createRace } from './race.js';
import { buildLeg } from './course/gen.js';
import { ROUTE } from './course/legs.js';
import { makeChart, chartView } from './chart.js';
import { pickRegulars } from './rivals.js';

export const RUN_VERSION = 1;

export function createRun({ seed, ship = 'lantern', daily = null, redshift = 0, easy = false, meta = null,
  tune = TUNE } = {}) {
  const T = tune;
  const regs = pickRegulars(seed);
  const rivals = {};
  for (const id of [...regs.racing, regs.reserve]) {
    rivals[id] = { hull: T.HULL0, fuel: T.RIVAL_FUEL_MIN, gap: T.GAP0, alive: true, nemesis: false, settled: false };
  }
  return {
    v: RUN_VERSION, seed, daily, ship, redshift, easy, ranked: !easy,
    leg: 0, phase: 'leg',
    chart: makeChart(seed, T), lanes: [],
    you: { hull: T.HULL0, hullMax: T.HULL_MAX, shield: T.SHIELD_MAX, shieldMax: T.SHIELD_MAX, fuel: T.FUEL0,
      fuelCap: T.FUEL_CAP, gap: T.GAP0, years: 0, earth: 0, launchEta: T.ETA0 },
    build: [],
    pending: [],
    pity: 0, rerolls: T.REROLLS0, banishes: 0, banned: [],
    offer: null,
    dock: null,
    field: { racing: [...regs.racing], reserve: regs.reserve, order: [], rivals,
      bosses: { whale: null, mako: null, manta: null } },
    used: [], seen: meta && meta.seen ? { ...meta.seen } : {}, legs: [],
    streams: {},
  };
}

// The race for the run's current leg, on the lane chosen for it (run.lanes[leg], or the chart's first).
export function startLeg(run, tune = TUNE) {
  const type = ROUTE[run.leg] || ROUTE[0];
  const lane = run.lanes[run.leg] || (run.chart[run.leg] && run.chart[run.leg][0]) || null;
  const leg = buildLeg({ runSeed: run.seed, type, lane, mods: {}, seen: run.seen, used: new Set(run.used), tune });
  run.phase = 'leg';
  return createRace({ run, leg, tune });
}

// The arrival: the leg's record, your meters back into the run, and the next phase. Stub: no pages, trophies or
// rival results yet.
export function endLeg(run, race) {
  const you = race.ships[0];
  const end = race.events.find((e) => e.type === 'legEnd') || null;
  const why = end ? end.why : you.caught ? 'caught' : you.wrecked ? 'wrecked' : 'gate';
  run.legs.push({ type: race.leg.type, lane: race.leg.lane ? race.leg.lane.id || race.leg.lane.name || null : null,
    hash: race.leg.hash, place: end ? end.place : null, years: you.years, hits: you.stats.hits, lastHit: null });
  Object.assign(run.you, { hull: you.hull, hullMax: you.hullMax, shield: you.shield, shieldMax: you.shieldMax,
    fuel: you.fuel, fuelCap: you.fuelCap, gap: you.gap });
  run.you.years += you.years;
  run.you.earth += you.earth;
  run.phase = why === 'caught' || why === 'wrecked' || why === 'doorstep' ? 'caught'
    : why === 'home' || run.leg >= ROUTE.length - 1 ? 'home' : 'break';
  return run;
}

// The break model for screens.js. Stub.
export function breakOf(run) {
  return { leg: run.leg, phase: run.phase, offer: run.offer, dock: run.dock, build: run.build, rerolls: run.rerolls,
    banishes: run.banishes };
}

// Offer actions. Stubs: nothing changes; each returns false.
export function pick(run, i) { return false; }
export function skip(run) { return false; }
export function reroll(run) { return false; }
export function banish(run, i) { return false; }

// Choose lane i of the next leg and launch it: the run moves to that leg.
export function chooseLane(run, i) {
  if (run.leg >= ROUTE.length - 1) return false;
  const next = run.leg + 1;
  const lanes = run.chart[next] || [];
  run.lanes[next] = lanes[i] || lanes[0] || null;
  run.leg = next;
  run.phase = 'leg';
  return true;
}

// The result card's model: one cause, one goal. Stub.
export function resultOf(run) {
  return { home: run.phase === 'home', leg: run.leg, type: ROUTE[run.leg], years: run.you.years, earth: run.you.earth,
    cause: null, goal: null, chart: chartView(run) };
}

// A JSON-safe copy, and back.
export function snapshot(run) { return JSON.parse(JSON.stringify(run)); }
export function restore(json) { return typeof json === 'string' ? JSON.parse(json) : JSON.parse(JSON.stringify(json)); }
