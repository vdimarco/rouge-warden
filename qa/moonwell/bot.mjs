// Moonwell: bot runs. A fair bot plays whole runs on many seeds, and this reports how far it gets and what it meets.
// It checks that the islands can be cleared, that shrines let the pearl in, and that nothing gets stuck.
//   node qa/moonwell/bot.mjs [runs=24] [skill=0.85] [minutes=6]
import { createRun, tick, choose, TICK } from '../../public/moonwell/run.js';
import { createBot, botInput } from '../../public/moonwell/bot.js';
import { station } from '../../public/moonwell/world.js';

const RUNS = +(process.argv[2] || 24), SKILL = +(process.argv[3] || 0.85), MINUTES = +(process.argv[4] || 6);
const rows = [], drainsAt = [];
for (let i = 0; i < RUNS; i++) {
  const run = createRun({ seed: 1000 + i * 7919 });
  const bot = createBot({ skill: SKILL, seed: 50 + i });
  const count = {};
  let t = 0, nudges = 0, stuckIsland = { k: 0, since: 0, worst: 0 }, shrineTime = 0;
  while (run.phase !== 'over' && t < MINUTES * 60) {
    tick(run, botInput(run, bot));
    t += TICK;
    for (const e of run.events) {
      count[e.type] = (count[e.type] || 0) + 1;
      if (e.type === 'nudge') nudges++;
      if (e.type === 'drain') drainsAt.push(run.far + 1);
      if (e.type === 'shrine') choose(run, Math.floor(bot.rand() * run.offer.length));
    }
    run.events = [];
    if (run.far !== stuckIsland.k) { stuckIsland.worst = Math.max(stuckIsland.worst, t - stuckIsland.since); stuckIsland = { k: run.far, since: t, worst: stuckIsland.worst }; }
    if (station(run.world, run.at).shrine) shrineTime += TICK;
  }
  rows.push({ seed: run.seed, islands: run.far + 1, backs: count.back || 0, score: run.score, time: t, drains: count.drain || 0, long: run.stats.long, rails: run.stats.rails, portals: run.stats.portals, shrines: run.stats.shrines, moonrise: count.moonrise || 0, stars: run.stats.stars, lanterns: run.stats.lanterns, clutch: run.stats.clutch, nudges, slowest: stuckIsland.worst, shrineTime, over: run.phase === 'over' });
}
const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
const med = (k) => { const v = rows.map((r) => r[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
for (const r of rows) console.log(Object.entries(r).map(([k, v]) => `${k} ${typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : v}`).join(' · '));
console.log(`\n${RUNS} runs, skill ${SKILL}: islands median ${med('islands')} (mean ${avg('islands').toFixed(1)}), score median ${med('score').toLocaleString()}, run ${avg('time').toFixed(0)} s on average, ${(avg('time') / avg('islands')).toFixed(1)} s per island`);
console.log(`per run: drains ${avg('drains').toFixed(1)}, trips back ${avg('backs').toFixed(1)}, long shots ${avg('long').toFixed(1)}, rails ${avg('rails').toFixed(1)}, portals ${avg('portals').toFixed(1)}, shrines ${avg('shrines').toFixed(1)}, moonrises ${avg('moonrise').toFixed(1)}, stars ${avg('stars').toFixed(0)}, lanterns ${avg('lanterns').toFixed(1)}, clutch saves ${avg('clutch').toFixed(1)}, nudges ${avg('nudges').toFixed(1)}, slowest island ${avg('slowest').toFixed(0)} s, time in shrines ${avg('shrineTime').toFixed(0)} s`);
const buckets = {};
for (const k of drainsAt) { const b = k <= 10 ? '1-10' : k <= 30 ? '11-30' : k <= 60 ? '31-60' : k <= 100 ? '61-100' : '100+'; buckets[b] = (buckets[b] || 0) + 1; }
const reached = (lo) => rows.filter((r) => r.islands >= lo).length;
console.log('drains by island:', Object.entries(buckets).map(([b, n]) => `${b}: ${n}`).join(', '), `| runs reaching 10/30/60/100: ${reached(10)}/${reached(30)}/${reached(60)}/${reached(100)}`);
