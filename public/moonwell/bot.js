// Moonwell: a bot that plays like a fair human. It runs the attract mode behind the title, and the QA runs in
// qa/moonwell/ use it to check that the islands can be cleared. It flips when the pearl reaches a point on a flipper
// that it picks for each approach, so its shots vary, and it misses now and then.
import { BALL_R as R, station, rng } from './world.js';

export function createBot({ skill = 0.85, seed = 7 } = {}) {
  return { skill, rand: rng(seed), hold: { left: 0, right: 0 }, at: { left: 0, right: 0 }, aim: { left: 0.6, right: 0.6 }, armed: { left: true, right: true } };
}

export function botInput(run, bot) {
  const input = { left: false, right: false, drop: false, pulse: false };
  if (run.phase === 'ready') { input.drop = run.readyT > 0.7; return input; }
  if (run.phase !== 'play' || run.ball.mode !== 'free') return input;
  const s = station(run.world, run.at), b = run.ball;
  for (const f of s.flippers) {
    const key = f.side < 0 ? 'left' : 'right';
    if (bot.hold[key] > run.clock) { input[key] = run.clock >= bot.at[key]; continue; }
    const c = Math.cos(f.rest), sn = Math.sin(f.rest);
    const rx = b.x - f.px, ry = b.y - f.py;
    const t = (rx * c + ry * sn) / f.len;
    const up = f.side < 0 ? rx * sn - ry * c : -rx * sn + ry * c;
    const close = t > -0.1 && t < 1.15 && up > -10 && up < R + f.r0 + 40;
    if (!close) { bot.armed[key] = true; continue; }
    if (!bot.armed[key]) continue;
    if (t >= bot.aim[key]) {
      bot.armed[key] = false;
      // a human reacts a little early or late, and now and then not at all
      const miss = bot.rand() > 0.5 + 0.5 * bot.skill;
      const late = (bot.rand() * 0.14 - 0.05) * (1.1 - bot.skill);
      if (!miss) { bot.at[key] = run.clock + Math.max(0, late); bot.hold[key] = bot.at[key] + 0.14 + bot.rand() * 0.08; }
      // the next approach aims at another point: the left flipper shoots near its tip, and the right one makes a soft
      // pass from near its pivot, so the pearl stays in the bowl instead of flying back over the ridge behind
      bot.aim[key] = key === 'left' ? 0.3 + bot.rand() * 0.55 : 0.05 + bot.rand() * 0.45;
    }
  }
  // a pulse when the pearl drops into the gap: a human catches it in time only now and then
  const falling = b.y > s.fy + 20 && Math.abs(b.x - s.cx) < 40 && b.vy > 0;
  if (falling && !bot.falling && run.pulse.charges > 0 && bot.rand() < bot.skill * 0.4) input.pulse = true;
  bot.falling = falling;
  return input;
}
