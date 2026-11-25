// Gloam Downs: the boss bot's mind, shared by the boss bot (qa/lab/gloam-downs-boss.sim.mjs) and the pacing bot
// (qa/lab/gloam-downs-bot.mjs), so both step the Barrow Reeve (boss.js) with the same reads, rolls and mistakes.
// bossBrain({ B, R, rs, body, skill, rnd, C }) -> { act(), used, flasks, onStep() }: act() is the input for the next step (call it before
// R.step), onStep() after it. C is the arena's centre.
import { REEVE, ATTACKS, inSlices, inLane } from '../../public/lab/gloam-downs/boss.js';
import { inRing } from '../../public/lab/gloam-downs/foes.js';
import { MOVES, HITS } from '../../public/lab/gloam-downs/moves.js';
// REACT.at fixes the reaction time in seconds (the boss bot's REACT=)
export const REACT = { at: null };
/* ---------------- the bot ----------------
   skill k, 0..1 -> its reaction time to a tell (0.70 − 0.45k s, ±0.1 s: 0.57 s at 0.3, 0.30 s at 0.9), the chance it misses a tell
   (0.45 (1 − k)^1.3: 28% at 0.3, 2% at 0.9), the chance it rolls as soon as it reads the tell (0.5 (1 − k)), before a shard ring or a lane stands still, or at a time that a sweep
   still reaches, the chance
   it finishes its string before it rolls (0.6 (1 − k)), the chance it rolls the wrong way (0.3 (1 − k)), and the health under which it
   drinks (30 + 20k). A bot under 0.5 drinks wherever it is when it reads no wind-up; one of 0.5 or more backs off 6 m first, or drinks
   in a recovery or a stumble */
export function botOf(k, rnd) {
  return {
    react: () => Math.round(60 * (REACT.at ?? 0.7 - 0.45 * k + (rnd() - 0.5) * 0.2)),
    miss: 0.45 * Math.pow(1 - k, 1.3), early: 0.5 * (1 - k), greed: 0.6 * (1 - k), wrong: 0.3 * (1 - k),
    drinkAt: 30 + 20 * k, careful: k >= 0.5, rnd
  };
}
const MARGIN = 0.35;
// after a roll in phase 2 or 3, a bot hangs back 7 m from the boss until the boss's next wind-up (2.5 s at most), one time in three, so the far
// attacks come too
const WARY = 0.35, S_HANG = 150, HANG_D = 7;
// stay 7 m or more from the boss and inside the arena: back off, or go round the arena's edge
function keepOff(B, s, d, away, C) {
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


export function bossBrain({ B, R, rs, body, skill, rnd, C }) {
  const bot = botOf(skill, rnd), s = body.s, f = R.fighter.f, used = {};
  let read = null, hang = 0;
  const M = { used, flasks: 0 };
  M.act = () => {
    let flasks = 0;
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
      const low = run.hp < (bot.drinkAt * (R.max ? R.max() : 100)) / 100 && run.flasks > 0 && (!key || read?.miss || g.at < read.at);
      if (low && (!bot.careful || open || d >= 6)) { if (!f.move) { act = { heal: true }; flasks++; } }
      // low, it backs off and leaves the arena if it must (the boss walks home and keeps its damage); hanging back, it stays inside
      else if (low) act = d >= HANG_D ? {} : stick(away);
      else if (hang) act = keepOff(B, s, d, away, C);
      else if (d > 2.4 && B.state !== 'down') act = stick(toward);
      else if (B.alive) act = { attack: true, ...(d > 2.0 ? stick(toward) : {}) };
    }

    M.flasks += flasks;
    if (hang > 0) hang--;
    return act;
  };
  return M;
}
