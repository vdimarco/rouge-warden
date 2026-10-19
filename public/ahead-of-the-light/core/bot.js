// Ahead of the Light: a bot pilot, for the tests and the attract screen. skill 0..1: how far it looks ahead, how
// well it holds a line and how often it pings and boosts. Each call returns one step's input.
import { GATE_EVERY } from './world.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createBot(skill = 0.8, seed = 1) {
  let r = seed >>> 0 || 1;
  const rnd = () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
  let wobble = 0;
  return function drive(run) {
    const s = run.ship, W = run.world;
    const look = 25 + 45 * skill;
    // the target: the next gate if it is close and the bot wants it, else the canyon's middle ahead
    let tx = W.centre(s.d + look), ty = null;
    for (let i = run.gates.i; i < run.gates.i + 3; i++) {
      const g = W.gate(i);
      if (!g) continue;
      const ahead = g.d - s.d;
      if (ahead > 0 && ahead < 60 + 160 * skill) { tx = g.x; ty = g.y; break; }
      if (ahead > GATE_EVERY * 2) break;
    }
    // a spire on the way: pass it on the side away from the canyon's middle line... or the near side
    const c0 = Math.floor(s.d / 60);
    for (let c = c0; c <= c0 + 2 + Math.round(2 * skill); c++) {
      const q = W.spire(c);
      if (!q || q.d < s.d) continue;
      const f = clamp((q.d - s.d) / look, 0, 1.5);
      const px = s.x + (tx - s.x) * Math.min(1, f);
      if (Math.abs(px - q.x) < q.r + 6) {
        const side = px >= q.x ? 1 : -1;
        tx = q.x + side * (q.r + 9);
        break;
      }
    }
    // the highest ground on the way to the target, and a little to each side
    let top = -1e9;
    for (let a = 4; a <= look; a += 4) {
      const f = a / look;
      const x = s.x + (tx - s.x) * f;
      for (const dx of [-3, 0, 3]) top = Math.max(top, W.height(x + dx, s.d + a));
    }
    const floorY = top + 4 + 6 * (1 - skill);
    const wantY = ty === null ? floorY : Math.max(ty, floorY);
    wobble += (rnd() - 0.5) * (1 - skill) * 0.6;
    wobble *= 0.95;
    const x = clamp((tx - s.x) / 10 + wobble - s.vx * 0.04, -1, 1);
    const y = clamp((wantY - s.y) / 6 - s.vy * 0.04, -1, 1);
    const gap = run.ship.d - run.light.d;
    const boost = s.charge > 0.75 - 0.3 * skill || (gap < 160 && s.charge > 0.05);
    const ping = run.ping.cool <= 0 && rnd() < 0.02 + 0.1 * skill;
    return { x, y, boost, ping };
  };
}
