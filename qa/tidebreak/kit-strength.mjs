// Kit strength by lane: seeded six-bot matches with random distinct kits and equal bot profiles.
// Usage: node qa/tidebreak/kit-strength.mjs [matches=240] [profile=veteran] [jobs=4]
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
const [N = '240', profile = 'veteran', jobs = String(Math.min(4, availableParallelism()))] = process.argv.slice(2);
const shuffle = (seed, n) => { let x = seed * 2654435761 >>> 0; const r = () => ((x = (x ^ x << 13) >>> 0, x = (x ^ x >>> 17) >>> 0, x = (x ^ x << 5) >>> 0) / 4294967296); const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
if (process.env.KS_CHILD) {
  const sim = await import('../../public/tidebreak/sim.js'), { setDifficulty } = await import('../../public/tidebreak/bot-difficulty.js');
  const [first, count] = [+process.env.KS_FIRST, +process.env.KS_COUNT], rows = [];
  for (let seed = first; seed < first + count; seed++) {
    const k = shuffle(seed, sim.HEROES.length), s = setDifficulty(sim.createMatch(k[0], seed, { allies: [k[1], k[2]], enemies: [k[3], k[4], k[5]] }), profile, profile);
    for (let t = 0; t < (sim.LIMIT + 1) * 20 && s.winner === null; t++) sim.step(s, { autopilot: true }, .05);
    // Slot order: team 0 lanes 1, 0, 2; team 1 lanes 0, 1, 2.
    rows.push({ seed, winner: s.winner, kits: k.slice(0, 6) });
  }
  console.log(JSON.stringify(rows)); process.exit(0);
}
const per = Math.ceil(+N / +jobs), parts = [];
for (let i = 0; i < +jobs; i++) parts.push(new Promise((done, fail) => {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, KS_CHILD: '1', KS_FIRST: String(1 + i * per), KS_COUNT: String(Math.min(per, +N - i * per)) } });
  let text = ''; child.stdout.on('data', d => text += d); child.stderr.pipe(process.stderr); child.on('close', c => c ? fail(new Error('child')) : done(JSON.parse(text)));
}));
const rows = (await Promise.all(parts)).flat();
const SLOT = [[0, 1], [0, 0], [0, 2], [1, 0], [1, 1], [1, 2]], kit = {}, lane = {};
for (const r of rows) r.kits.forEach((k, i) => {
  const [team, l] = SLOT[i], win = r.winner === team ? 1 : r.winner === -1 ? .5 : 0;
  (kit[k] ||= [0, 0]); kit[k][0] += win; kit[k][1]++;
  (lane[`${k}:${l}`] ||= [0, 0]); lane[`${k}:${l}`][0] += win; lane[`${k}:${l}`][1]++;
});
const team0 = rows.filter(r => r.winner === 0).length / rows.length;
console.log(JSON.stringify({ matches: rows.length, profile, team0WinRate: team0, kit: Object.fromEntries(Object.entries(kit).map(([k, [w, n]]) => [k, [+(w / n).toFixed(3), n]])), lane: Object.fromEntries(Object.entries(lane).sort().map(([k, [w, n]]) => [k, [+(w / n).toFixed(3), n]])) }));
