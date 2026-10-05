// Seeded A/B matches between bot profiles. Six bots per match, sides swap on every seed.
// The sim is copied to a temp folder with one damage hook, so the game files stay clean.
// Usage: node qa/tidebreak/bot-ab.mjs <profileA> <profileB> [seeds=20] [firstSeed=1] [jobs=4]
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir, availableParallelism } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../public');
const work = mkdtempSync(join(tmpdir(), 'bot-ab-'));
mkdirSync(join(work, 'tidebreak')); mkdirSync(join(work, 'arcade/creatures'), { recursive: true });
for (const f of readdirSync(join(root, 'tidebreak'))) if (f.endsWith('.js')) copyFileSync(join(root, 'tidebreak', f), join(work, 'tidebreak', f));
copyFileSync(join(root, 'arcade/creatures/catalog.js'), join(work, 'arcade/creatures/catalog.js'));
const simFile = join(work, 'tidebreak/sim.js'), anchor = /(\n\s*const actual = Math\.min\(target\.hp, amount\);[^\n]*)/;
const source = readFileSync(simFile, 'utf8');
if (!anchor.test(source)) throw new Error('damage hook anchor not found in sim.js');
writeFileSync(simFile, source.replace(anchor, '$1\n  s.hook?.(s, source, target, actual, kind);'));
const sim = await import(pathToFileURL(simFile).href);
const { setDifficulty, PROFILES } = await import(pathToFileURL(join(work, 'tidebreak/bot-difficulty.js')).href);
// AB_PATCH='{"veteran":{"camps":false}}' tries a profile change without editing the game.
for (const [id, patch] of Object.entries(JSON.parse(process.env.AB_PATCH || '{}'))) Object.assign(PROFILES[id], patch);

const [A = 'mythic', B = 'legacy', seeds = '20', first = '1', jobs = String(Math.min(4, availableParallelism()))] = process.argv.slice(2);
let rows = [];
if (!process.env.AB_CHILD && +jobs > 1) {
  // Split the seeds over child processes, then merge their rows.
  const per = Math.ceil(+seeds / +jobs), parts = [];
  for (let i = 0; i < +jobs && i * per < +seeds; i++) parts.push(new Promise((done, fail) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), A, B, String(Math.min(per, +seeds - i * per)), String(+first + i * per), '1'], { env: { ...process.env, AB_CHILD: '1' } });
    let text = ''; child.stdout.on('data', d => text += d); child.stderr.pipe(process.stderr);
    child.on('close', code => code ? fail(new Error('child failed')) : done(JSON.parse(text)));
  }));
  rows = (await Promise.all(parts)).flat();
} else for (let seed = +first; seed < +first + +seeds; seed++) for (const side of [0, 1]) {
  const s = sim.createMatch(seed % sim.HEROES.length, seed);
  setDifficulty(s, side ? A : B, side ? B : A);
  const teamOf = t => (t === side ? 'A' : 'B');
  const stat = { A: { kills: 0, towers: 0, dives: 0, spell: 0, attack: 0, item: 0, heroWard: 0, waveWard: 0 }, B: { kills: 0, towers: 0, dives: 0, spell: 0, attack: 0, item: 0, heroWard: 0, waveWard: 0 } };
  s.hook = (s, src, tgt, actual, kind) => {
    const credit = src.kind === 'summon' ? s.units.find(u => u.id === src.owner) : src;
    if (tgt.kind === 'hero' && src.kind === 'tower') tgt.towerHitAt = s.time;
    if (tgt.kind === 'hero' && credit?.kind === 'hero' && credit.team !== tgt.team) {
      const bucket = kind === 'attack' ? 'attack' : kind === 'spell' ? 'spell' : 'item';
      stat[teamOf(credit.team)][bucket] += actual;
    }
    if (tgt.kind === 'boss' && tgt.hp <= 0 && actual > 0 && src.team >= 0) stat[teamOf(src.team)].bosses = (stat[teamOf(src.team)].bosses || 0) + 1;
    if (['tower', 'core'].includes(tgt.kind) && src.team >= 0) stat[teamOf(src.team)][credit?.kind === 'hero' ? 'heroWard' : 'waveWard'] += actual;
    if (tgt.kind === 'hero' && tgt.hp <= 0 && actual > 0 && s.time - (tgt.towerHitAt ?? -9) < 2.5) stat[teamOf(tgt.team)].dives++;
  };
  for (let tick = 0; tick < (sim.LIMIT + 1) * 20 && s.winner === null; tick++) sim.step(s, { autopilot: true }, .05);
  for (const t of [0, 1]) { stat[teamOf(t)].kills = s.score[t]; stat[teamOf(t)].towers = 6 - s.towers[1 - t]; }
  for (const h of s.units.filter(u => u.kind === 'hero')) { const st = stat[teamOf(h.team)]; st.level = (st.level || 0) + h.level / 3; st.lastHits = (st.lastHits || 0) + h.lastHits; st.items = (st.items || 0) + h.inventory.length; }
  rows.push({ seed, side, winner: s.winner === -1 ? 'draw' : teamOf(s.winner), time: s.time, stat });
}
if (process.env.AB_CHILD) { console.log(JSON.stringify(rows)); process.exit(0); }
const sum = (team, key) => rows.reduce((v, r) => v + (r.stat[team][key] || 0), 0);
const n = rows.length, wins = rows.filter(r => r.winner === 'A').length, draws = rows.filter(r => r.winner === 'draw').length;
const share = team => { const total = sum(team, 'spell') + sum(team, 'attack') + sum(team, 'item'); return { spell: sum(team, 'spell') / total, attack: sum(team, 'attack') / total, item: sum(team, 'item') / total }; };
const out = { A, B, matches: n, winRateA: wins / n, draws, killsA: sum('A', 'kills') / n, killsB: sum('B', 'kills') / n, towersA: sum('A', 'towers') / n, towersB: sum('B', 'towers') / n, minutes: rows.reduce((v, r) => v + r.time, 0) / n / 60, timeouts: rows.filter(r => r.time >= sim.LIMIT).length, bossesA: sum('A', 'bosses') / n, bossesB: sum('B', 'bosses') / n, levelA: sum('A', 'level') / n, levelB: sum('B', 'level') / n, lastHitsA: sum('A', 'lastHits') / n, lastHitsB: sum('B', 'lastHits') / n, itemsA: sum('A', 'items') / n, itemsB: sum('B', 'items') / n, heroWardA: sum('A', 'heroWard') / n, waveWardA: sum('A', 'waveWard') / n, heroWardB: sum('B', 'heroWard') / n, waveWardB: sum('B', 'waveWard') / n, divesA: sum('A', 'dives') / n, divesB: sum('B', 'dives') / n, spellShareA: share('A').spell, attackShareA: share('A').attack, spellShareB: share('B').spell, attackShareB: share('B').attack };
console.log(JSON.stringify(out));
