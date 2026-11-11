// Frostwing bot matches: node qa/frostwing/bot.mjs [matches=6] [difficulty=ace] [seed=1]
// Every ship is a bot (the Lantern bots stand in for the player). Prints scores, downs and energy, and checks that a
// match has real fights and real showers: enough downs, every shower breaks rocks, and neither side wins every match.
import * as S from "../../public/frostwing/sim.js";

const [n = 6, diff = "ace", seed0 = 1] = process.argv.slice(2).map((v, i) => (i === 1 ? v : Number(v)));
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const wins = [0, 0, 0];
let downs = 0, breaks = 0, waves = 0, crashes = 0;
for (let i = 0; i < n; i++) {
  const m = S.createMatch({ seed: seed0 + i, difficulty: diff, pilot: null });
  const ev = {};
  while (!m.over) { S.step(m, 1 / 60); for (const e of S.takeEvents(m)) { ev[e.type] = (ev[e.type] || 0) + 1; if (e.type === "down" && !e.by) crashes++; } }
  wins[m.winner < 0 ? 2 : m.winner]++;
  downs += ev.down || 0; breaks += ev.rockbreak || 0; waves += ev.wave || 0;
  console.log(`  match ${i + 1}: ${m.score[0]}-${m.score[1]} downs ${ev.down || 0} showers ${ev.wave || 0} rocks broken ${ev.rockbreak || 0} orbs ${ev.orb || 0} · ` + m.ships.map((s) => `${s.pilot} ${s.kills}/${s.deaths}/${s.energy}`).join(" "));
}
check(downs / n >= 12, `a match averages at least 12 downs (${(downs / n).toFixed(1)})`);
check(waves / n >= 4, `a match has at least four meteor showers (${(waves / n).toFixed(1)})`);
check(breaks / waves >= 3, `each shower averages at least three broken rocks (${(breaks / waves).toFixed(1)})`);
check(crashes / Math.max(downs, 1) < 0.25, `fewer than a quarter of downs are crashes (${crashes} of ${downs})`);
check(n < 4 || (wins[0] > 0 && wins[1] > 0), `each side wins some matches (Lantern ${wins[0]}, Corvid ${wins[1]}, draws ${wins[2]})`);
process.exit(fails.length ? 1 : 0);
