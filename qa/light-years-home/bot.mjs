// Light Years Home: bot runs for balance work. A policy plays whole journeys on seeds 1 to N and this prints, per
// seed, the score, rank, cracks, ship time and first-try finds, then the flight grades per leg and the score parts.
//   node qa/light-years-home/bot.mjs [careful|skilled|reckless|all] [seeds=5]
import { playJourney, POLICIES } from '../../public/light-years-home/core/bot.js';
import { STOPS } from '../../public/light-years-home/core/route.js';
import { fmt, groupDigits } from '../../public/light-years-home/core/physics.js';

const which = process.argv[2] || 'careful';
const seeds = Math.max(1, Math.round(Number(process.argv[3]) || 5));
const kinds = which === 'all' ? POLICIES : [which];
if (!kinds.every((k) => POLICIES.includes(k))) {
  console.error(`usage: node qa/light-years-home/bot.mjs [${POLICIES.join('|')}|all] [seeds]`);
  process.exit(2);
}

for (const kind of kinds) {
  const rows = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const r = playJourney(kind, { seed });
    const s = r.state;
    const where = r.lostAt === null ? 'home' : `lost on the way to ${STOPS[r.lostAt].id} (stop ${r.lostAt + 1})`;
    rows.push({ seed, score: s.score.total, rank: r.result.rank, cracks: s.stats.cracks, ship: s.clocks.ship,
      first: s.stats.firstTry, where, grades: s.stats.legGrades, parts: s.score, minutes: r.seconds / 60 });
  }
  console.log(`\n${kind}, seeds 1 to ${seeds}`);
  for (const r of rows) {
    console.log([`seed ${r.seed}`, `score ${groupDigits(r.score)}`, `rank ${r.rank}`, `cracks ${r.cracks}`,
      `ship ${fmt.shipClock(r.ship)} (${r.ship.toFixed(2)} yr)`, `first tries ${r.first}/17`, r.where,
      `${r.minutes.toFixed(1)} min`].join(' · '));
  }
  const last = rows[rows.length - 1];
  console.log(`  flight grades (seed ${last.seed}): ${last.grades.join(' ') || 'none'}`);
  const { total, ...parts } = last.parts;
  console.log(`  score parts (seed ${last.seed}): ${Object.entries(parts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const mean = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  const home = rows.filter((r) => r.where === 'home').length;
  console.log(`  mean: score ${groupDigits(mean('score'))}, cracks ${mean('cracks').toFixed(1)}, `
    + `ship ${mean('ship').toFixed(2)} yr, home ${home}/${rows.length}`);
}
