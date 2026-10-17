// Ahead of the Light: the bot CLI (final.md 21.1) and the parallel runner the sims share.
//   node qa/ahead-of-the-light/bot.mjs mid 200 [policy] [--from=1] [--redshift=3] [--meta=first] [--KEY=value ...]
// policy: comma pairs, e.g. dock=hull2,lane=risk,pick=focus,burnPolicy=never,red=ttc12,land=all. --KEY=value sets a
// TUNE key for the run (--BLEED=0.9, --GAP_CAP=7). Prints the home rate, the median leg caught, the median run time,
// the causes of the end, years (median and spread), top gear per leg, glare share, rivals eaten and hits by piece id
// per pass (pieces over 3 times their share first). Runs spread over worker threads, one a CPU.
import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { TUNE } from '../../public/ahead-of-the-light/core/tune.js';
import { playRun, PRESETS, RETURNING } from '../../public/ahead-of-the-light/core/bots.js';
import { ROUTE } from '../../public/ahead-of-the-light/core/course/legs.js';
import { STARTERS, CARD } from '../../public/ahead-of-the-light/core/cards.js';

const SELF = fileURLToPath(import.meta.url);
// The mid seconds a leg takes (11.1), for the timing target.
export const MID_LEG_S = Object.freeze([45, 56, 60, 64, 67, 71, 75, 60]);

// ---------------------------------------------------------------- jobs

// A job is plain data (it crosses to a worker): { seed, driver, policy, opts, tune (overrides), redshift, meta
// ('returning' | 'first' | object), setup ({ leg, fuel, hull, gap, eta, lane, build }), legs, force, maxS }.
function applySetup(run, sp) {
  if (!sp) return;
  if (Number.isFinite(sp.leg)) {
    run.leg = sp.leg;
    const lanes = run.chart[run.leg] || [];
    run.lanes[run.leg] = (sp.lane !== undefined ? lanes.find((l) => l.id === sp.lane || l.kind === sp.lane) : null)
      || lanes[0] || null;
  }
  for (const k of ['fuel', 'hull', 'gap']) if (Number.isFinite(sp[k])) run.you[k] = sp[k];
  if (Number.isFinite(sp.eta)) run.you.launchEta = sp.eta;
  if (Array.isArray(sp.build)) run.build = sp.build.map((b) => (typeof b === 'string' ? { id: b, r: 0 } : b));
}

const tunes = new Map();
function tuneOf(over) {
  if (!over || !Object.keys(over).length) return TUNE;
  const key = JSON.stringify(over);
  if (!tunes.has(key)) tunes.set(key, Object.freeze({ ...TUNE, ...over }));
  return tunes.get(key);
}

export function runJob(job) {
  const meta = job.meta === 'first' ? null : job.meta && typeof job.meta === 'object' ? job.meta : RETURNING;
  const s = playRun({ seed: job.seed, driver: job.driver, policy: job.policy || null, opts: job.opts || {},
    tune: tuneOf(job.tune), redshift: job.redshift || 0, meta, maxS: job.maxS || 1200,
    setup: job.setup ? (run) => applySetup(run, job.setup) : null, legs: job.legs ?? Infinity,
    force: job.force || null });
  s.tag = job.tag || null;
  return s;
}

// Run jobs on worker threads (one a CPU, at most `workers`). → summaries in job order.
export function runMany(jobs, { workers = os.cpus().length } = {}) {
  const n = Math.max(1, Math.min(workers, jobs.length));
  if (n === 1 || jobs.length < 4) return Promise.resolve(jobs.map(runJob));
  return new Promise((resolve, reject) => {
    const out = new Array(jobs.length);
    let next = 0, done = 0, failed = false;
    const pool = [];
    const feed = (w) => {
      if (next >= jobs.length) { w.postMessage(null); return; }
      const i = next++;
      w.postMessage({ i, job: jobs[i] });
    };
    for (let k = 0; k < n; k++) {
      const w = new Worker(SELF, { workerData: { worker: true } });
      pool.push(w);
      w.on('message', ({ i, s, err }) => {
        if (err) { failed = true; pool.forEach((p) => p.terminate()); reject(new Error(err)); return; }
        out[i] = s;
        done++;
        if (done === jobs.length) { pool.forEach((p) => p.postMessage(null)); resolve(out); } else feed(w);
      });
      w.on('error', (e) => { if (!failed) { failed = true; pool.forEach((p) => p.terminate()); reject(e); } });
      feed(w);
    }
  });
}

if (!isMainThread && workerData && workerData.worker) {
  parentPort.on('message', (m) => {
    if (!m) { process.exit(0); }
    try { parentPort.postMessage({ i: m.i, s: runJob(m.job) }); } catch (e) {
      parentPort.postMessage({ i: m.i, err: `${e && e.stack ? e.stack : e}` });
    }
  });
}

// ---------------------------------------------------------------- numbers

export const median = (a) => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
export const quant = (a, q) => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  return v.length ? v[Math.min(v.length - 1, Math.max(0, Math.floor(q * v.length)))] : NaN;
};
export const share = (a, f) => (a.length ? a.filter(f).length / a.length : NaN);
const sum = (a, f) => a.reduce((m, x) => m + f(x), 0);

// Every number 21.2 reads, from a set of run summaries.
export function report(runs) {
  const legs = runs.flatMap((r) => r.legStats);
  const caught = runs.filter((r) => !r.home);
  const causes = {};
  for (const r of caught) { const k = r.why || '?'; causes[k] = (causes[k] || 0) + 1; }
  const byType = {};
  for (const l of legs) (byType[l.type] = byType[l.type] || []).push(l);
  const hits = {}, passes = {};
  for (const l of legs) {
    for (const [p, n] of Object.entries(l.hitsBy)) hits[p] = (hits[p] || 0) + n;
    for (const [p, n] of Object.entries(l.passesBy)) passes[p] = (passes[p] || 0) + n;
  }
  const allHits = sum(Object.values(hits), (x) => x), allPasses = sum(Object.values(passes), (x) => x);
  const rate = allPasses ? allHits / allPasses : 0;
  const pieces = Object.keys(passes).map((p) => ({ p, hits: hits[p] || 0, passes: passes[p],
    x: rate ? ((hits[p] || 0) / passes[p]) / rate : 0 })).sort((a, b) => b.x - a.x);
  // hits not tied to a course piece (takedowns, scorches) sit outside the per-pass table
  const offCourse = Object.keys(hits).filter((p) => !passes[p]).reduce((m, p) => m + hits[p], 0);
  const runS = (r) => sum(r.legStats, (l) => l.t) + 12.5 * Math.max(0, r.legStats.length - 1);
  const minutes = sum(legs, (l) => l.t) / 60;
  const finished = legs.filter((l) => l.why === 'gate' || l.why === 'home');
  return {
    n: runs.length,
    home: share(runs, (r) => r.home),
    firstHome: share(runs, (r) => r.firstHome),
    caughtLeg: median(caught.map((r) => r.caughtLeg)),
    furthest: median(runs.map((r) => r.furthest)),
    leg1Caught: share(runs, (r) => !r.home && r.caughtLeg === 1),
    byLeg3: share(runs, (r) => !r.home && r.caughtLeg <= 3),
    runMin: median(runs.map(runS)) / 60,
    causes,
    years: median(runs.filter((r) => r.home).map((r) => r.years)),
    yearsQ: [quant(runs.filter((r) => r.home).map((r) => r.years), 0.1),
      quant(runs.filter((r) => r.home).map((r) => r.years), 0.9)],
    yearsPerLeg: median(legs.map((l) => l.years)),
    topGear: ROUTE.map((t) => median((byType[t] || []).map((l) => l.topGear))),
    legS: ROUTE.map((t) => median((byType[t] || []).filter((l) => l.why === 'gate' || l.why === 'home')
      .map((l) => l.t))),
    legN: ROUTE.map((t) => (byType[t] || []).length),
    ttc10: share(legs, (l) => l.ttcMin < 10),
    glareRuns: share(runs, (r) => r.legStats.some((l) => l.glareIns > 0)),
    glareLegs: share(legs, (l) => l.glareIns > 0),
    glareShare: sum(legs, (l) => l.glareS) / Math.max(1e-9, sum(legs, (l) => l.t)),
    glareOut: sum(legs, (l) => l.glareOuts) / Math.max(1, sum(legs, (l) => l.glareIns)),
    catchNoGlare: legs.filter((l) => l.glareBeforeCatch === false).length,
    eatenNamed: median(runs.map((r) => sum(r.legStats, (l) => l.eaten.filter((x) => x !== 'whale'
      && x !== 'mako' && x !== 'manta').length))),
    eatenMean: sum(runs, (r) => sum(r.legStats, (l) => l.eaten.filter((x) => !['whale', 'mako', 'manta']
      .includes(x)).length)) / Math.max(1, runs.length),
    drifter30: share(runs.filter((r) => r.legStats[0] && r.legStats[0].legNo === 0),
      (r) => r.legStats[0].drifterEaten !== null && r.legStats[0].drifterEaten < 30),
    place: median(finished.map((l) => l.place)),
    first: share(finished, (l) => l.place === 1),
    boss: Object.fromEntries(['whale', 'mako', 'manta'].map((b) => {
      const met = legs.filter((l) => l.boss === b);
      return [b, met.length ? share(met, (l) => l.bossBeaten) : NaN];
    })),
    bossN: Object.fromEntries(['whale', 'mako', 'manta'].map((b) => [b, legs.filter((l) => l.boss === b).length])),
    g1By30: share(legs, (l) => l.g1At !== null && l.g1At <= 0.3),
    g2By60: share(legs, (l) => l.g2At !== null && l.g2At <= 0.6),
    lightspeedFrom3: share(legs.filter((l) => l.legNo >= 2), (l) => l.lightspeed),
    grabbed: sum(legs, (l) => l.grabs) / Math.max(1, sum(legs, (l) => l.windows)),
    goodShare: sum(legs, (l) => l.good) / Math.max(1, sum(legs, (l) => l.releases)),
    perfectShare: sum(legs, (l) => l.perfect) / Math.max(1, sum(legs, (l) => l.releases)),
    scorchesLeg: sum(legs, (l) => l.scorches) / Math.max(1, legs.length),
    hitsLeg: sum(legs, (l) => l.hits) / Math.max(1, legs.length),
    hitRate: rate,
    offCourse,
    pieces,
    perMin: {
      grazes: sum(legs, (l) => l.grazes) / minutes, hairs: sum(legs, (l) => l.hairs) / minutes,
      burns: sum(legs, (l) => l.burns) / Math.max(1, legs.length), whips: sum(legs, (l) => l.releases) / Math.max(1, legs.length),
      drafts: sum(legs, (l) => l.drafts) / Math.max(1, legs.length),
      slams: sum(legs, (l) => l.slamsBy) / Math.max(1, legs.length),
      takedowns: sum(runs, (r) => sum(r.legStats, (l) => l.takedownsBy)) / Math.max(1, runs.length),
    },
    doorstep: share(runs.filter((r) => r.legStats.some((l) => l.type === 'earth')), (r) => r.why === 'doorstep'),
    starters: variety(runs),
  };
}

// Variety (21.2): the share of the starters each run was offered, how often each starter ends in a build, and the
// legendaries per build.
export function variety(runs) {
  const off = runs.map((r) => r.offered.filter((id) => STARTERS.includes(id)).length / STARTERS.length);
  const inBuild = Object.fromEntries(STARTERS.map((id) => [id, share(runs, (r) => r.build.includes(id))]));
  const legends = runs.map((r) => r.build.filter((id) => CARD[id] && CARD[id].kind === 'legend').length);
  const top = Object.entries(inBuild).sort((a, b) => b[1] - a[1])[0];
  return { offered: median(off), top, legend: share(legends, (x) => x > 0), two: legends.filter((x) => x > 1).length };
}

const pct = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)} %` : '-');
const f1 = (v) => (Number.isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : '-');

export function printReport(name, R) {
  const lines = [];
  lines.push(`${name}: ${R.n} runs`);
  lines.push(`  home ${pct(R.home)} (first home ${pct(R.firstHome)}); median leg caught ${f1(R.caughtLeg)}; furthest `
    + `${f1(R.furthest)}; caught by leg 3 ${pct(R.byLeg3)}; on leg 1 ${pct(R.leg1Caught)}`);
  lines.push(`  median run ${f1(R.runMin)} min; causes ${JSON.stringify(R.causes)}`);
  lines.push(`  years home median ${f1(R.years)} (10-90 % ${f1(R.yearsQ[0])} to ${f1(R.yearsQ[1])}); per leg ${f1(R.yearsPerLeg)}`);
  lines.push(`  top gear per leg ${R.topGear.map(f1).join(' ')}; legs played ${R.legN.join(' ')}`);
  lines.push(`  leg s (finished) ${R.legS.map((v) => f1(v)).join(' ')} vs mid ${MID_LEG_S.join(' ')}`);
  lines.push(`  TTC < 10 s in ${pct(R.ttc10)} of legs; glare in ${pct(R.glareRuns)} of runs, ${pct(R.glareLegs)} of `
    + `legs, ${pct(R.glareShare)} of time; glare left ${pct(R.glareOut)}; catches with no glare ${R.catchNoGlare}`);
  lines.push(`  place median ${f1(R.place)}, 1st in ${pct(R.first)}; regulars eaten a run median ${f1(R.eatenNamed)} `
    + `mean ${f1(R.eatenMean)}; drifter by 30 s ${pct(R.drifter30)}`);
  lines.push(`  bosses beaten ${Object.entries(R.boss).map(([k, v]) => `${k} ${pct(v)} of ${R.bossN[k]}`).join(', ')}`);
  lines.push(`  0.9c by 30 % ${pct(R.g1By30)}, HEADLIGHT by 60 % ${pct(R.g2By60)}, LIGHT SPEED from leg 3 `
    + `${pct(R.lightspeedFrom3)}`);
  lines.push(`  wells grabbed ${pct(R.grabbed)}, GOOD+ ${pct(R.goodShare)}, PERFECT ${pct(R.perfectShare)}, scorches a `
    + `leg ${f1(R.scorchesLeg)}; hits a leg ${f1(R.hitsLeg)}; doorstep ${pct(R.doorstep)}`);
  lines.push(`  a minute: grazes ${f1(R.perMin.grazes)}, hairs ${f1(R.perMin.hairs)}; a leg: burns ${f1(R.perMin.burns)}, `
    + `whips ${f1(R.perMin.whips)}, drafts ${f1(R.perMin.drafts)}, slams ${f1(R.perMin.slams)}; takedowns a run `
    + `${f1(R.perMin.takedowns)}`);
  const v = R.starters;
  lines.push(`  variety: offered ${pct(v.offered)} of starters; top starter ${v.top[0]} in ${pct(v.top[1])}; a legendary `
    + `in ${pct(v.legend)}; two in ${v.two}`);
  lines.push(`  hits per pass ${(R.hitRate * 100).toFixed(2)} %; off-course hits ${R.offCourse}; pieces over 2 × their share:`);
  for (const p of R.pieces.filter((x) => x.x > 2 && x.passes >= 30).slice(0, 12)) {
    lines.push(`    ${p.p} ${p.x.toFixed(2)} × (${p.hits} / ${p.passes})`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- the CLI

function parseArgs(argv) {
  const pos = [], tune = {}, flags = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v = '1'] = a.slice(2).split('=');
      if (k in TUNE) {
        const base = TUNE[k];
        tune[k] = Array.isArray(base) ? (v.includes(',') ? v.split(',').map(Number) : base.map(() => Number(v)))
          : Number(v);
      } else flags[k] = v;
    } else pos.push(a);
  }
  return { pos, tune, flags };
}

function parsePolicy(s) {
  const policy = {}, opts = {};
  if (!s) return { policy, opts };
  for (const kv of s.split(',')) {
    const [k, v] = kv.split('=');
    if (['dock', 'lane', 'pick'].includes(k)) policy[k] = v;
    else opts[k] = Number.isFinite(Number(v)) ? Number(v) : v;
  }
  return { policy, opts };
}

if (isMainThread && process.argv[1] === SELF) {
  const { pos, tune, flags } = parseArgs(process.argv.slice(2));
  const driver = pos[0] || 'mid';
  const n = Number(pos[1]) || 50;
  const { policy, opts } = parsePolicy(pos[2]);
  const from = Number(flags.from) || 1;
  if (!PRESETS[driver] && !['idle', 'dodge', 'graze', 'whipper'].includes(driver)) {
    console.error(`unknown driver ${driver}`);
    process.exit(1);
  }
  const jobs = Array.from({ length: n }, (_, i) => ({ seed: from + i, driver, policy, opts, tune,
    redshift: Number(flags.redshift) || 0, meta: flags.meta === 'first' ? 'first' : 'returning' }));
  const t0 = Date.now();
  const runs = await runMany(jobs, { workers: Number(flags.workers) || os.cpus().length });
  console.log(printReport(`${driver}${pos[2] ? ` ${pos[2]}` : ''}${Object.keys(tune).length ? ` ${JSON.stringify(tune)}` : ''}`,
    report(runs)));
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (flags.json) {
    const fs = await import('node:fs');
    fs.writeFileSync(flags.json, JSON.stringify(runs));
  }
}
