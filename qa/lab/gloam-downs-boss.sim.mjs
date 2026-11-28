// Gloam Downs: a boss bot that fights the Barrow Reeve with the game's own rules: the lamplighter's moves (moves.js) through the run's
// runner (run.js), the boss's mind (boss.js), and Barrow Crown's real walk map and arena zone. No browser.
// The bot reads each wind-up after a reaction time and may miss one, by its skill. When it has read one, it rolls out of where the
// marker will be: away from the sweeps and the slam, out of its shard ring once the rings stand still, and across the lunge's lane once
// the lane stands still. A less skilled bot sometimes rolls as soon as it reads the tell, while the marker still follows it. Otherwise
// it walks in and swings, and it drinks a flask when its health is low and the boss is not winding up.
// Each try is a fresh boss, and a lamplighter as the way to the arena left it (ARRIVE=fresh: 100 health and 2 flasks); a bot tries
// until its first win, or MAX tries.
// Run: node qa/lab/gloam-downs-boss.sim.mjs [bots per skill = 40] [max tries = 8] [first seed = 1]
//   BHP=1300, GAP=60,45,33 (play steps) and DSWEEP=0.6 (the double sweep's second wind-up, in s) try a lever without editing boss.js.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, goTo, makeRunner, stream } from '../../public/lab/gloam-downs/run.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { makeBoss, REEVE, ATTACKS, segAt, inSlices, inLane } from '../../public/lab/gloam-downs/boss.js';
import { inRing } from '../../public/lab/gloam-downs/foes.js';
import { bossBrain, REACT as REACT_AT } from './gloam-downs-bossbot.mjs';

const W = fileURLToPath(new URL('../../public/lab/gloam-downs/worlds/', import.meta.url));
const BOTS = +(process.argv[2] || 40), MAX = +(process.argv[3] || 8), SEED0 = +(process.argv[4] || 1);
const SKILLS = (process.env.SKILLS || '0.3,0.5,0.7,0.9').split(',').map(Number);
if (process.env.BHP) {
  const k = +process.env.BHP / REEVE.hp;
  REEVE.hp = +process.env.BHP;
  REEVE.phases = REEVE.phases.map(p => Math.round(p * k));
}
if (process.env.DSWEEP) ATTACKS.dsweep.segs[2].n = Math.round(+process.env.DSWEEP * 60);
if (process.env.GAP) REEVE.gap = process.env.GAP.split(',').map(Number);
// REACT=0.5 fixes the reaction time in seconds (with SKILLS=1, a bot that makes no other mistake: the latest read that still dodges)
const REACT = process.env.REACT ? +process.env.REACT : null;
REACT_AT.at = REACT;
const ARRIVE = process.env.ARRIVE || 'run';
const LIMIT = 300 * 60; // a fight that lasts 5 minutes of game time is a loss

const meta = JSON.parse(fs.readFileSync(`${W}barrows.json`, 'utf8'));
const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${W}barrows.walk.bin.gz`)));
const walk = makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
const arena = meta.zones.find(z => z.boss), C = arena.c;
const runMeta = { ...meta, wisps: [], beacon: { p: [900, 0, 900], r: 1 } };
const ground = (x, z) => walk.support(x, z, C[1] + 3) ?? walk.top(x, z);

// the bot's mind is shared with the pacing bot: qa/lab/gloam-downs-bossbot.mjs (botOf, its reads and rolls)
const dirTo = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
function fight(skill, seed) {
  const rnd = stream(seed, 'bot');
  const rs = RS.fresh();
  startRun(rs, seed);
  goTo(rs, 'barrows');
  // what the way to the arena left: a fresh lamplighter, or (ARRIVE=run, the default) one that lost up to 45 × (1.2 − k) health on
  // the way and, one time in 2 × (1 − k), a flask
  if (ARRIVE === 'run') {
    rs.run.hp = Math.round(100 - rnd() * 45 * (1.2 - skill));
    if (rnd() < 0.5 * (1 - skill)) rs.run.flasks -= 1;
  }
  // the lamplighter comes in 9 m from the arena's centre, from the place's start
  const [ux, uz] = dirTo(C[0], C[2], meta.spawn.p[0], meta.spawn.p[2]);
  const x0 = C[0] + ux * 9, z0 = C[2] + uz * 9;
  const body = makeBody(walk, { p: [x0, ground(x0, z0) + 0.3, z0], yaw: 0 }, meta.bounds, { ...PARAMS });
  const B = makeBoss({ walk, arena, seed, bounds: meta.bounds });
  B.ready = true;
  const R = makeRunner({ walk, meta: runMeta, body, rs, targets: () => (B.alive ? [B] : []), lightable: B.lightable, think: B.think });
  B.bind(R);
  const hits = {}, hurt = R.hurt;
  let biggest = 0;
  R.hurt = (dmg, ...a) => {
    const r = hurt(dmg, ...a);
    if (r === 'hit' || r === 'dead') { const k = B.move || 'shards'; hits[k] = (hits[k] || 0) + 1; biggest = Math.max(biggest, dmg); }
    return r;
  };
  const brain = bossBrain({ B, R, rs, body, skill, rnd, C }), used = brain.used;
  let startStep = -1;
  for (let i = 0; i < LIMIT; i++) {
    const act = brain.act();
    R.step(act, 0);
    if (B.started && startStep < 0) startStep = R.clock.step;
    const len = (R.clock.step - startStep) / 60;
    if (R.dead) return { won: false, len, hits, biggest, bossHp: B.hp, flasks: brain.flasks, used };
    if (!B.up) return { won: true, len, hits, biggest, bossHp: 0, flasks: brain.flasks, used };
  }
  return { won: false, len: LIMIT / 60, hits, biggest, timeout: true, bossHp: B.hp, flasks: brain.flasks, used };
}

const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : null; };
const med = a => q(a, 0.5);
const t0 = Date.now();
const out = {};
for (const skill of SKILLS) {
  const tries = [], lens = [], hits = {}, used = {}, all = [];
  let wins = 0, fights = 0, timeouts = 0, biggest = 0;
  for (let b = 0; b < BOTS; b++) {
    let k = 0, won = false;
    while (k < MAX && !won) {
      const r = fight(skill, SEED0 + b * 97 + k * 7919 + Math.round(skill * 1000) * 131);
      k++; fights++;
      all.push(r);
      for (const [a, n] of Object.entries(r.hits)) hits[a] = (hits[a] || 0) + n;
      for (const [a, n] of Object.entries(r.used)) used[a] = (used[a] || 0) + n;
      biggest = Math.max(biggest, r.biggest);
      if (r.timeout) timeouts++;
      if (r.won) { won = true; wins++; lens.push(r.len); }
    }
    tries.push(won ? k : MAX + 1);
  }
  // hits taken by each attack, per fight and per use of the attack
  const perFight = Object.fromEntries(Object.keys(ATTACKS).map(a => [a, `${((hits[a] || 0) / fights).toFixed(2)} (${(100 * (hits[a] || 0) / Math.max(1, used[a] || 0)).toFixed(0)}% of ${((used[a] || 0) / fights).toFixed(1)})`]));
  out[skill] = {
    fights, wins, firstWin: tries.filter(t => t <= MAX).length + '/' + BOTS, triesMedian: med(tries), triesP90: q(tries, 0.9),
    fightMedian: +(med(lens) ?? 0).toFixed(1), fightP90: +(q(lens, 0.9) ?? 0).toFixed(1), lossBossHp: med(all.filter(r => !r.won).map(r => r.bossHp)),
    hitsPerFight: perFight, biggest, timeouts
  };
  console.log(`skill ${skill}: ${JSON.stringify(out[skill])}`);
}
console.log(`boss ${REEVE.hp} health, gaps ${REEVE.gap.join('/')} steps; ${BOTS} bots a skill, ${MAX} tries at most; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
