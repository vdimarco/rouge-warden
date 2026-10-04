// Bots play Loon Echo on crossing.js in Node, 200 seeded runs each. No browser and no real time.
// node qa/echo/echo.sim.mjs   (exit 1 if a check fails)
// The four bots come from the review of the game:
//   straight: swims straight at the nearest chick, banks groups of four, never dives or honks.
//   naive:    steers round rocks and banks groups of three. It never dives or honks.
//   safe:     steers round rocks, banks groups of four, dives when an eel strikes or a boat comes, and honks at a near eel.
//   greedy:   like safe, but it takes all eight chicks before it goes to the nest.
import { createRun, step, callFlock, toggleDive, birdPosition, HOME, distance } from '../../public/echo/crossing.js';

const DT = 1 / 60, LIMIT = 20 * 60, SEEDS = Array.from({ length: 200 }, (_, i) => 1000 + i * 7919);

export function play(seed, mode) {
  const r = createRun(seed), causes = {};
  let firstClutch = null;
  for (let i = 0; i < LIMIT / DT && !r.ended; i++) {
    const waiting = r.chicks.filter(c => c.state === 'waiting' && !c.lock), cap = mode === 'naive' ? 3 : mode === 'greedy' ? 8 : 4;
    const goal = (r.flock.length && (r.flock.length >= cap || !waiting.length)) || !waiting.length ? HOME : waiting.sort((a, b) => distance(r, a) - distance(r, b))[0];
    let aim = { x: goal.x, y: goal.y };
    if (mode !== 'straight' && !r.diving) for (const k of r.rocks) {
      const vx = goal.x - r.x, vy = (goal.y - r.y) * 1.65, L = Math.hypot(vx, vy) || 1, t = ((k.x - r.x) * vx + (k.y - r.y) * 1.65 * vy) / (L * L);
      if (t > 0 && t < 1) { const px = r.x + vx * t, py = r.y + vy * t / 1.65; if (distance({ x: px, y: py }, k) < .1) { const s = Math.sign((px - k.x) * -vy + (py - k.y) * 1.65 * vx) || 1; aim = { x: k.x - vy / L * .13 * s, y: k.y + vx / L * .13 / 1.65 * s }; break; } }
    }
    r.target = aim;
    if (mode === 'greedy' || mode === 'safe') {
      const birds = Array.from({ length: r.flock.length + 1 }, (_, j) => birdPosition(r, j)), awake = r.eels.filter(e => e.active && !e.stun);
      if (!r.diving && r.breath > 1 && awake.some(e => e.phase === 'windup' && birds.some(b => distance(e.aim, b) < .25))) toggleDive(r);
      else if (!r.diving && r.cooldown <= 0 && awake.some(e => distance(r, e) < .3)) callFlock(r);
      for (const b of r.boats) if (b.age > 1.1 && !r.diving && r.breath > 1 && Math.abs(b.y - r.y) < .07 && Math.abs(b.x - r.x) < .3) toggleDive(r);
      if (r.diving && !r.eels.some(e => e.phase === 'lunge') && !r.boats.some(b => Math.abs(b.y - r.y) < .08 && Math.abs(b.x - r.x) < .3) && r.breath < 2.2) toggleDive(r);
    }
    step(r, DT);
    for (const e of r.events) if (e.kind === 'hit') causes[e.source] = (causes[e.source] || 0) + 1;
    if (firstClutch === null && r.clutch > 1) firstClutch = r.elapsed;
    r.events.length = 0;
  }
  return { secs: r.elapsed, score: r.score, saved: r.saved, clutch: r.clutch, trips: r.trips, biggest: r.biggest, firstClutch, ended: r.ended, causes };
}

export const quantile = (list, p) => { const a = [...list].sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; };

export function study(mode) {
  const runs = SEEDS.map(seed => play(seed, mode)), causes = {};
  runs.forEach(r => Object.entries(r.causes).forEach(([k, v]) => causes[k] = (causes[k] || 0) + v));
  const q = (key, p) => quantile(runs.map(r => r[key]), p);
  return { mode, runs, causes, cleared: runs.filter(r => r.clutch > 1).length / runs.length, unfinished: runs.filter(r => !r.ended).length,
    secs: [.1, .5, .9].map(p => q('secs', p)), score: [.1, .5, .9].map(p => q('score', p)), clutch: [.1, .5, .9].map(p => q('clutch', p)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fails = [], check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails.push(msg); };
  const results = {};
  for (const mode of ['straight', 'naive', 'safe', 'greedy']) {
    const s = results[mode] = study(mode);
    console.log(`${mode.padEnd(8)} clutch 1 home ${(s.cleared * 100).toFixed(0)}% | secs p10/50/90 ${s.secs.map(v => v.toFixed(0)).join('/')} | clutches p10/50/90 ${s.clutch.join('/')} | score p10/50/90 ${s.score.join('/')} | hits ${JSON.stringify(s.causes)}`);
  }
  console.log('');
  const safe = results.safe, greedy = results.greedy;
  check(safe.secs[1] >= 60 && safe.secs[1] <= 360, `the careful (safe) bot's median run is 60 to 360 s (${safe.secs[1].toFixed(0)} s)`);
  check(greedy.score[0] < greedy.score[2], `the all-eight (greedy) bot's scores spread out: p10 ${greedy.score[0]} < p90 ${greedy.score[2]}`);
  check(Object.values(results).every(s => s.unfinished === 0), 'every run ends before the 20-minute limit, so no bot gets stuck');
  check(results.straight.secs[1] < safe.secs[1] && results.naive.secs[1] < safe.secs[1], 'the careful bot lasts longer than the bots that never dive or honk');
  console.log(`\necho.sim: ${fails.length ? fails.length + ' failed' : 'all checks passed'}`);
  process.exit(fails.length ? 1 : 0);
}
