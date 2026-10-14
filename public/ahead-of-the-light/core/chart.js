// Ahead of the Light: the star chart (final.md 11.3): lanes per leg, families, conditions, and the chart screen's
// model.
// SPINE STUB (WP0): safe do-nothing bodies with the 18.4 signatures. WP5 owns this file. Pure.
import { TUNE } from './tune.js';
import { ROUTE } from './course/legs.js';

// The run's chart: one list of lanes per leg, [[{ id, name, kind, fam, piece, cond }]]. Stub: no lanes yet.
export function makeChart(seed, tune = TUNE) { return ROUTE.map(() => []); }

// The chart screen's model. Stub.
export function chartView(run) { return { leg: run ? run.leg : 0, legs: ROUTE.map((type) => ({ type, lanes: [] })) }; }
