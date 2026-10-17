// Ahead of the Light: the star chart (final.md 11.3): the lanes of each leg, the families rolled onto FAMILY lanes,
// the lane conditions from leg 3, and the chart screen's model (a ladder of 9 rings from START to EARTH with the next
// leg's lanes as chips). makeChart draws from the run's 'chart' stream only, so a seed always gives the same chart.
// Pure.
import { TUNE } from './tune.js';
import { ttcText } from './ringmath.js';
import { ROUTE, LEG_TYPES, CONDITIONS } from './course/legs.js';
import { mulberry32, hashSeed } from '../../light-years-home/core/rng.js';
import { FAMS, FAMILIES } from './cards.js';
import { riskRule } from './offer.js';

// The ladder's 9 rings: START, then the gate at the end of each leg (the landing for Earth).
export const NODES = Object.freeze(['START', 'COMA', 'VIRGO', 'THE LOCAL GROUP', 'THE MILKY WAY', 'THE ORION ARM',
  'THE SUN\'S NEIGHBOURS', 'THE SUN', 'EARTH']);
// The gate names at each leg's end, as the vista and the arrival line say them.
export const GATE_NAMES = Object.freeze(NODES.slice(1));

// The boss cards beside their legs (10.3): name, what it does, how to beat it.
export const BOSS_CARDS = Object.freeze({
  whale: Object.freeze({ id: 'whale', name: 'WHALE', leg: 2, text: 'BEHIND IT IS SAFE. BESIDE IT IS ROUGH.',
    beat: 'CROSS THE GATE AHEAD OF IT' }),
  mako: Object.freeze({ id: 'mako', name: 'MAKO', leg: 5, text: 'IT HUNTS THE SHIP WITH THE FEWEST CELLS.',
    beat: 'FINISH AHEAD, OR TAKE IT DOWN TWICE' }),
  manta: Object.freeze({ id: 'manta', name: 'MANTA', leg: 7, text: 'IT RIDES THE LIGHT. GET BETWEEN THEM.',
    beat: 'REACH THE DOOR AHEAD OF IT' }),
});

const KIND_ORDER = { fixed: 0, family: 0, long: 0, risk: 1, short: 2, void: 3 };
const LANE_ICON = { fixed: 'line', family: 'family', risk: 'cracked-ring', void: 'dashed-ring', long: 'well-ring',
  short: 'belt-dots' };

// The chip's first tag for a lane.
export function laneTag(lane, tune = TUNE) {
  if (!lane) return '';
  if (lane.kind === 'family') return lane.fam ? `${lane.fam} × 2` : 'FAMILY';
  if (lane.kind === 'risk') {
    const r = riskRule(tune);
    return r.four ? 'PICK 1 OF 4 · RARE+' : `PICK ${r.picks} · RARE+`;
  }
  if (lane.kind === 'void') return 'SHORT · NO CARD';
  if (lane.kind === 'long') return 'THE LONG WAY';
  if (lane.kind === 'short') return 'THE SHORT WAY';
  return '';
}

// Six FAMILY lanes on legs 2 to 7: every family appears, and none on two legs in a row. Re-draws until both hold
// (each try is a fresh walk; nearly every walk passes within a few tries), with a fixed fallback.
function familySeq(rng, n) {
  for (let tries = 0; tries < 64; tries++) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const pool = FAMS.filter((f) => f !== out[i - 1]);
      out.push(pool[Math.floor(rng() * pool.length)]);
    }
    if (FAMS.every((f) => out.includes(f))) return out;
  }
  return ['SKIM', 'WELL', 'SHIP', 'RIVAL', 'SKIM', 'WELL'].slice(0, n);
}

// The run's chart: for each leg of ROUTE, its lanes as [{ id, name, kind, fam, piece, seq, cond, tag, icon }].
// Leg 1 one lane; legs 2, 3, 5, 6 and 7 a FAMILY and a RISK; leg 4 all three (VOID, RISK, FAMILY); leg 8 JUPITER and
// THE ASTEROID BELT. From leg 3 one lane of each leg carries a condition (never the VOID, never the same on two legs
// in a row).
export function makeChart(seed, tune = TUNE) {
  const rng = mulberry32(hashSeed(seed, 'chart'));
  const famLegs = [];
  ROUTE.forEach((type, i) => {
    if (Object.values(LEG_TYPES[type].lanes).some((l) => l.kind === 'family')) famLegs.push(i);
  });
  const fams = familySeq(rng, famLegs.length);
  const condIds = Object.keys(CONDITIONS);
  let prevCond = null;
  return ROUTE.map((type, i) => {
    const def = LEG_TYPES[type];
    const lanes = Object.entries(def.lanes).map(([name, l]) => ({
      id: l.id, name, kind: l.kind, fam: null, piece: Array.isArray(l.piece) ? [...l.piece] : l.piece ?? null,
      seq: l.seq ? [...l.seq] : null, cond: null, tag: '', icon: LANE_ICON[l.kind] || 'line',
    }));
    // the plain lane first (FIXED, FAMILY or the long way: the leg as 11.1 measures it), then RISK, then the rest
    lanes.sort((a, z) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[z.kind] ?? 9));
    const fi = famLegs.indexOf(i);
    for (const l of lanes) if (l.kind === 'family') l.fam = fams[fi];
    if (i >= 2) {
      const open = lanes.filter((l) => l.kind !== 'void');
      const pool = condIds.filter((c) => c !== prevCond);
      const cond = pool[Math.floor(rng() * pool.length)];
      const on = open[Math.floor(rng() * open.length)];
      on.cond = cond;
      prevCond = cond;
    }
    for (const l of lanes) l.tag = laneTag(l, tune);
    return lanes;
  });
}

// A lane's name on its chip, 14 characters at most (11.3): the name if it fits; else a set short name; else without
// its leading THE; else its first whole words that fit. Never a cut word.
const CHIP_NAMES = Object.freeze({ 'THE GALACTIC CENTRE': 'THE CENTRE', 'ALDEBARAN AND THE HYADES': 'THE HYADES' });
export function chipName(name, max = 14) {
  const s = String(name || '');
  if (s.length <= max) return s;
  if (CHIP_NAMES[s]) return CHIP_NAMES[s];
  const bare = s.replace(/^THE /, '');
  if (bare.length <= max) return bare;
  let out = '';
  for (const w of bare.split(' ')) {
    if ((out ? out.length + 1 : 0) + w.length > max) break;
    out = out ? `${out} ${w}` : w;
  }
  return out || bare.slice(0, max);
}

// A lane's chip: icon, name (up to 14 characters on the chip), tags (its kind's tag, then its condition), colour.
export function chipOf(lane, tune = TUNE) {
  if (!lane) return null;
  const tags = [laneTag(lane, tune)].filter(Boolean);
  if (lane.cond && CONDITIONS[lane.cond]) tags.push(CONDITIONS[lane.cond].name);
  return {
    id: lane.id, name: lane.name, short: chipName(lane.name),
    kind: lane.kind, fam: lane.fam, cond: lane.cond, icon: lane.icon || LANE_ICON[lane.kind] || 'line', tags,
    colour: lane.fam ? FAMILIES[lane.fam].colour : '#ffffff', bulge: lane.kind === 'risk' ? 1 : lane.kind === 'void'
      ? 0.1 : 0.5,
    line: lane.cond && CONDITIONS[lane.cond] ? `${lane.name} · ${CONDITIONS[lane.cond].name}` : lane.name,
  };
}

// Seconds to catch at launch for a gap and a launch speed.
export const launchTtc = (gap, eta) => gap / Math.max(1e-9, 1 - Math.tanh(eta));

// The chart screen's model: { leg, next, nodes: [{ name, state, boss }], lanes: [chip] for the next leg, launch: the
// light's line, joins: 'MOTH JOINS' or null }. state: 'passed' | 'current' | 'next' | 'ahead'. leg is the run's leg
// (the one just flown while in a break or on the chart).
export function chartView(run, tune = TUNE) {
  const leg = run ? run.leg : 0;
  const atBreak = run && (run.phase === 'break' || run.phase === 'chart' || run.phase === 'vista');
  const here = atBreak ? leg + 1 : leg;              // the ring you stand at
  const next = atBreak ? leg + 1 : leg;              // the leg you choose lanes for
  const bossAt = {};
  for (const b of Object.values(BOSS_CARDS)) bossAt[b.leg] = b;
  const nodes = NODES.map((name, i) => ({
    name, state: i < here ? 'passed' : i === here ? 'current' : i === here + 1 ? 'next' : 'ahead',
    boss: bossAt[i - 1] ? bossAt[i - 1].id : null,
  }));
  const lanes = run && run.chart && run.chart[next] ? run.chart[next].map((l) => chipOf(l, tune)) : [];
  const you = run ? run.you : null;
  const ttc = you ? launchTtc(you.gap, you.launchEta) : null;
  const joins = run && run.legs.length ? run.legs[run.legs.length - 1].joins || null : null;
  const boss = bossAt[next] || null;
  return {
    leg, next, type: ROUTE[next] || null, nodes, lanes, boss,
    launch: ttc === null ? null : { ttc, line: `THE LIGHT AT LAUNCH: ${ttcText(Math.max(0, ttc))}` },
    joins: joins ? `${joins} JOINS` : null,
  };
}
