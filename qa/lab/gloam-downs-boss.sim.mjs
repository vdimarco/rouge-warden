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
import { MOVES, HITS } from '../../public/lab/gloam-downs/moves.js';

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
const ARRIVE = process.env.ARRIVE || 'run';
const LIMIT = 300 * 60; // a fight that lasts 5 minutes of game time is a loss

const meta = JSON.parse(fs.readFileSync(`${W}barrows.json`, 'utf8'));
const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${W}barrows.walk.bin.gz`)));
const walk = makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
const arena = meta.zones.find(z => z.boss), C = arena.c;
const runMeta = { ...meta, wisps: [], beacon: { p: [900, 0, 900], r: 1 } };
const ground = (x, z) => walk.support(x, z, C[1] + 3) ?? walk.top(x, z);

/* ---------------- the bot ----------------
   skill k, 0..1 -> its reaction time to a tell (0.70 − 0.45k s, ±0.1 s: 0.57 s at 0.3, 0.30 s at 0.9), the chance it misses a tell
   (0.45 (1 − k)^1.3: 28% at 0.3, 2% at 0.9), the chance it rolls as soon as it reads the tell (0.5 (1 − k)), before a shard ring or a lane stands still, or at a time that a sweep
   still reaches, the chance
   it finishes its string before it rolls (0.6 (1 − k)), the chance it rolls the wrong way (0.3 (1 − k)), and the health under which it
   drinks (30 + 20k). A bot under 0.5 drinks wherever it is when it reads no wind-up; one of 0.5 or more backs off 6 m first, or drinks
   in a recovery or a stumble */
function botOf(k, rnd) {
  return {
    react: () => Math.round(60 * (REACT ?? 0.7 - 0.45 * k + (rnd() - 0.5) * 0.2)),
    miss: 0.45 * Math.pow(1 - k, 1.3), early: 0.5 * (1 - k), greed: 0.6 * (1 - k), wrong: 0.3 * (1 - k),
    drinkAt: 30 + 20 * k, careful: k >= 0.5, rnd
  };
}
const MARGIN = 0.35;
// after a roll in phase 2 or 3, a bot hangs back 7 m from the boss until the boss's next wind-up (2.5 s at most), one time in three, so the far
// attacks come too
const WARY = 0.35, S_HANG = 150, HANG_D = 7;
// stay 7 m or more from the boss and inside the arena: back off, or go round the arena's edge
function keepOff(B, s, d, away) {
  if (d >= HANG_D) return {};
  const ex = s.x + away[0] * 0.5, ez = s.z + away[1] * 0.5;
  if (Math.hypot(ex - C[0], ez - C[2]) < REEVE.arena.in - 0.4) return stick(away);
  const [cx, cz] = dirTo(C[0], C[2], s.x, s.z), side = [-cz, cx], k = side[0] * away[0] + side[1] * away[1] >= 0 ? 1 : -1;
  return stick([side[0] * k - cx * 0.3, side[1] * k - cz * 0.3]);
}
// is the lamplighter at s inside where this wind-up will hit, as its marker stands now (grown to its full size)?
function threatened(B, s) {
  const m = B.mk;
  if (!m) return false;
  switch (m.kind) {
    case 'slices': return inSlices(s, { ...m, R: m.full + MARGIN }, 3);
    case 'ring': return inRing(s, m.x, m.y, m.z, m.full + MARGIN, 3);
    case 'shards': return m.rings.some(r => Math.hypot(s.x - r[0], s.z - r[2]) <= ATTACKS.shards.ring + MARGIN);
    case 'lane': return inLane({ ...s }, { ...m, len: m.full }, 99, { ...ATTACKS.lunge, width: ATTACKS.lunge.width + 2 * MARGIN });
  }
  return false;
}
// the step of the wind-up after which the bot may roll: the shard rings and the lunge's lane follow the lamplighter until they stand
// still; a roll out of reach of a sweep or the slam is good at any time
const fixedAt = name => (name === 'shards' ? ATTACKS.shards.fix : name === 'lunge' ? ATTACKS.lunge.fix : 0);
/* a sweep or the slam: is a roll straight away from the boss, started now, safe? It is while every active step of the hit falls in the
   roll's safe time (its steps 1 to 18) or finds the lamplighter beyond the reach. A roll from close in, half-way through a wind-up, ends
   its safe time still inside the sweep's 4.0 m; a skilled bot rolls early (out of reach in time) or late (the hit in its safe time).
   The shard rings and the lane are left by a roll at any time once they stand still */
const ROLL = MOVES.roll;
function rollNow(B, g, d) {
  const A = ATTACKS[B.move];
  if (B.move === 'shards' || B.move === 'lunge') return true;
  const reach = (A.reach ?? A.ring) + 0.3, h0 = g.n - g.at, h1 = h0 + A.segs[g.i + 1].n - 1;
  for (let j = h0; j <= h1; j++) {
    const at = d + (ROLL.v / 60) * Math.min(j, ROLL.steps) + (ROLL.end / 60) * 0.5 * Math.max(0, j - ROLL.steps);
    if (!(j >= ROLL.safe[0] && j <= ROLL.safe[1]) && at <= reach) return false;
  }
  return true;
}
const dirTo = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
// camera yaw 0: the stick (mx, mz) moves along the world's (mx, -mz)
const stick = d => ({ mx: d[0], mz: -d[1] });

function fight(skill, seed) {
  const rnd = stream(seed, 'bot'), bot = botOf(skill, rnd);
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
  const s = body.s, f = R.fighter.f, used = {};
  let read = null, startStep = -1, flasks = 0, hang = 0;
  for (let i = 0; i < LIMIT; i++) {
    const g = B.seg(), key = B.state === 'move' && g?.kind === 'wind' ? `${B.move}:${g.i}:${B.step - g.at}` : null;
    // a new wind-up: when the bot reads it, and what it gets wrong this time
    if (key && read?.key !== key) {
      hang = 0;
      read = { key, at: g.at + bot.react(), miss: rnd() < bot.miss, early: rnd() < bot.early, greed: rnd() < bot.greed, wrong: rnd() < bot.wrong, done: false };
      if (g.i === 0) used[B.move] = (used[B.move] || 0) + 1;
    }
    if (B.state !== 'move') read = null;
    const d = Math.hypot(B.x - s.x, B.z - s.z), away = dirTo(B.x, B.z, s.x, s.z), toward = [-away[0], -away[1]];
    const seen = read && !read.miss && (!key || g.at >= read.at);
    let act = {};
    if (seen && key && !read.done && f.move === 'roll' && f.t <= 1) { read.done = true; if (B.phase >= 2 && rnd() < WARY) hang = S_HANG; }
    if (seen && key && !read.done) {
      // a tell it has read: roll out of where the marker will be, once it stands still (or at once, when it gets that wrong)
      // the roll starts on this step only out of no move, a drink, or a hit's wind-up or recovery, and with no cool-down: a skilled bot
      // presses then, so a press kept in the buffer does not start the roll later, at a time it did not choose
      const h = f.move === 'hit' ? HITS[f.hit] : null, free = s.ground && f.cool === 0 && (!f.move || f.move === 'drink' || (h && (f.t < h.wind || f.t >= h.wind + h.act)));
      const ready = read.early || (free && g.at >= fixedAt(B.move) && rollNow(B, g, d)), busy = read.greed && f.move === 'hit' && f.hit < 2;
      if (ready && !busy && threatened(B, s)) {
        let dir = away;
        if (B.move === 'lunge') { const m = B.mk, sd = Math.sign((s.z - m.z) * Math.sin(m.yaw) - (s.x - m.x) * Math.cos(m.yaw)) || 1; dir = [-Math.cos(m.yaw) * sd, Math.sin(m.yaw) * sd]; }
        else if (B.move === 'shards') dir = d > 5 ? toward : away;
        if (read.wrong) { const a = rnd() * 2 * Math.PI; dir = [Math.sin(a), Math.cos(a)]; }
        act = { ...stick(dir), roll: true };
      } else if (busy) act = { attack: true };
    } else if (seen && B.mk) {
      // it does not walk into a marker it has read while the marker is laid
      act = threatened(B, s) ? stick(away) : {};
    } else {
      const run = rs.run, g2 = B.seg(), open = B.state === 'stumble' || (g2?.kind === 'rec' && g2.n - g2.at > 48);
      const low = run.hp < bot.drinkAt && run.flasks > 0 && (!key || read?.miss || g.at < read.at);
      if (low && (!bot.careful || open || d >= 6)) { if (!f.move) { act = { heal: true }; flasks++; } }
      // low, it backs off and leaves the arena if it must (the boss walks home and keeps its damage); hanging back, it stays inside
      else if (low) act = d >= HANG_D ? {} : stick(away);
      else if (hang) act = keepOff(B, s, d, away);
      else if (d > 2.4 && B.state !== 'down') act = stick(toward);
      else if (B.alive) act = { attack: true, ...(d > 2.0 ? stick(toward) : {}) };
    }
    if (hang > 0) hang--;
    R.step(act, 0);
    if (B.started && startStep < 0) startStep = R.clock.step;
    const len = (R.clock.step - startStep) / 60;
    if (R.dead) return { won: false, len, hits, biggest, bossHp: B.hp, flasks, used };
    if (!B.up) return { won: true, len, hits, biggest, bossHp: 0, flasks, used };
  }
  return { won: false, len: LIMIT / 60, hits, biggest, timeout: true, bossHp: B.hp, flasks, used };
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
