// Ahead of the Light: one run, headless. The light catches a pilot who does nothing; a good bot gets home on most
// seeds and a weak one is caught on some; a hit costs shield before hull and slows you; a gate gives charge and
// speed; boost burns charge for speed; sonar marks the gates ahead; flying above the canyon hurts; the same seed and
// inputs give the same run; every event names its type.
import { newRun, step, gapOf, TUNE } from '../../public/ahead-of-the-light/core/flight.js';
import { createBot } from '../../public/ahead-of-the-light/core/bot.js';
import { COURSE_LEN, CEILING } from '../../public/ahead-of-the-light/core/world.js';

let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) pass++; else { fail++; console.log('  FAIL', msg); } };
const DT = 1 / 120;
function fly(seed, drive, limit = 400) {
  const r = newRun({ seed }); const types = new Set();
  while (r.mode === 'fly' && r.t < limit) { step(r, drive(r), DT); for (const e of r.events) types.add(e.type); }
  r.types = types;
  return r;
}

// doing nothing ends the run soon
const idle = fly(1, () => ({ x: 0, y: 0 }));
check(idle.mode !== 'fly' && idle.t < 60, `a pilot who does nothing is done in ${idle.t.toFixed(1)} s (${idle.mode})`);
// hold the middle at a safe height, no gates, no boost: the light catches you
const drift = fly(2, (r) => { const s = r.ship, W = r.world; const tx = W.centre(s.d + 40); let top = -99; for (let a = 4; a < 60; a += 4) top = Math.max(top, W.height(s.x + (tx - s.x) * a / 60, s.d + a)); return { x: Math.max(-1, Math.min(1, (tx - s.x) / 10 - s.vx * 0.04)), y: Math.max(-1, Math.min(1, (top + 8 - s.y) / 6 - s.vy * 0.04)) }; });
check(drift.mode === 'caught', `cruising without gates or boost, the light catches you (${drift.mode} at ${(drift.ship.d / 1000).toFixed(1)} km)`);

// bots
const home = { 0.3: 0, 0.9: 0 }, caught = { 0.3: 0, 0.9: 0 };
let times = [];
for (const sk of [0.3, 0.9]) for (let seed = 1; seed <= 8; seed++) {
  const r = fly(seed, createBot(sk, seed));
  if (r.mode === 'home') { home[sk]++; if (sk === 0.9) times.push(r.t); }
  if (r.mode === 'caught') caught[sk]++;
  if (seed === 1 && sk === 0.9) {
    for (const t of ['grab', 'ping', 'burn', 'sector', 'gearUp']) check(r.types.has(t), `a good run has '${t}' events`);
  }
}
check(home[0.9] >= 5, `the good bot gets home on ${home[0.9]} of 8 seeds`);
check(caught[0.3] >= 1, `the weak bot is caught on ${caught[0.3]} of 8 seeds`);
const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
check(avg > 150 && avg < 260, `a run home takes about ${avg.toFixed(0)} s`);

// a hit: shield first, then hull, and it slows you
{
  const r = newRun({ seed: 3 });
  for (let i = 0; i < 240; i++) step(r, { x: 0, y: 0 }, DT);
  const sp = r.ship.speed;
  r.ship.y = r.world.height(r.ship.x, r.ship.d) + 0.5; r.ship.vy = -10;
  step(r, { x: 0, y: 0 }, DT);
  check(r.events.some((e) => e.type === 'hit') && r.ship.shield < 100 && r.ship.hull === 100, 'a hit takes shield first, the hull is whole');
  for (let i = 0; i < 90; i++) step(r, { x: 0, y: 0 }, DT);
  check(r.ship.speed < sp * 0.8, `a hit slows you (${sp.toFixed(0)} → ${r.ship.speed.toFixed(0)} m/s)`);
  r.ship.shield = 0; r.ship.hitCool = 0;
  r.ship.y = r.world.height(r.ship.x, r.ship.d) + 0.5;
  step(r, { x: 0, y: 0 }, DT);
  check(r.ship.hull < 100, 'with the shield down a hit takes hull');
}
// a gate
{
  const r = newRun({ seed: 4 });
  const g = r.world.gate(r.gates.i);
  r.ship.d = g.d - 1; r.ship.x = g.x; r.ship.y = g.y; r.ship.charge = 0.2; r.light.d = r.ship.d - 300;
  step(r, { x: 0, y: 0 }, DT * 4);
  check(r.events.some((e) => e.type === 'grab') && r.ship.charge > 0.45 && r.ship.kick > 0, 'a gate gives charge and a kick of speed');
}
// boost
{
  const r = newRun({ seed: 5 });
  r.ship.charge = 1;
  for (let i = 0; i < 120; i++) step(r, { x: 0, y: 0, boost: true }, DT);
  check(r.ship.speed > TUNE.CRUISE + 20 && r.ship.charge < 0.8, `boost burns charge for speed (${r.ship.speed.toFixed(0)} m/s, charge ${r.ship.charge.toFixed(2)})`);
  r.ship.charge = 0;
  step(r, { x: 0, y: 0, boost: true }, DT);
  check(!r.ship.boosting, 'no charge, no boost');
}
// sonar
{
  const r = newRun({ seed: 6 });
  step(r, { x: 0, y: 0, ping: true }, DT);
  const e = r.events.find((x) => x.type === 'ping');
  check(e && e.marked >= 2 && r.marks.size === e.marked, `sonar marks the gates ahead (${e && e.marked})`);
  step(r, { x: 0, y: 0, ping: true }, DT);
  check(!r.events.some((x) => x.type === 'ping'), 'sonar waits for its cooldown');
}
// above the canyon
{
  const r = newRun({ seed: 7 });
  r.ship.y = CEILING + 10;
  const sh = r.ship.shield;
  for (let i = 0; i < 60; i++) step(r, { x: 0, y: 1 }, DT);
  check(r.ship.shield < sh && r.ship.exposed, 'above the canyon the burst burns your shield');
}
// determinism
{
  const a = fly(9, createBot(0.7, 3), 60), b = fly(9, createBot(0.7, 3), 60);
  check(a.ship.d === b.ship.d && a.ship.x === b.ship.x && gapOf(a) === gapOf(b), 'the same seed and inputs give the same run');
}
// the end
{
  const r = newRun({ seed: 8 });
  r.ship.d = COURSE_LEN - 2; r.light.d = r.ship.d - 300;
  step(r, { x: 0, y: 0 }, DT * 10);
  check(r.mode === 'home' && r.events.some((e) => e.type === 'land' && e.ok), 'past Earth the run ends home');
  const c = newRun({ seed: 8 });
  c.light.d = c.ship.d - 0.1;
  step(c, { x: 0, y: 0 }, DT);
  check(c.mode === 'caught', 'the light reaching you ends the run');
}
console.log(`${fail ? 'FAIL' : 'ok'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
