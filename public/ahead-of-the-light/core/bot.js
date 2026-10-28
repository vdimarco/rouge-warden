// Ahead of the Light: a bot pilot, for the title and the tests. skill 0..1: how far it looks ahead, how well it
// holds a line and how readily it boosts. Each call returns one step's input.
import { TUBE, SHIP_R, RING_R } from './world.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createBot(skill = 0.8, seed = 1) {
  let r = seed >>> 0 || 1;
  const rnd = () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
  let wx = 0, wy = 0;
  return function drive(run) {
    const s = run.ship, W = run.world;
    const look = (0.9 + 1.4 * skill) * s.speed;      // metres ahead it reads
    // the target: the next ring when it is near enough, else hold where you are, drifting to the middle
    let tx = s.x * 0.9, ty = s.y * 0.9;
    for (let i = run.rings.i; i < run.rings.i + 2; i++) {
      const g = W.ring(i);
      if (g && g.d > s.d && g.d - s.d < look * (0.5 + 1.1 * skill)) { tx = g.x; ty = g.y; break; }
    }
    // the stars ahead that the line to the target would hit: step aside from the nearest one
    const time = (d) => (d - s.d) / Math.max(1, s.speed);
    let threat = null;
    for (const st of W.starsBetween(s.d + 1, s.d + look)) {
      const f = clamp(time(st.d) / Math.max(0.2, time(s.d + look)), 0, 1);
      const px = s.x + (tx - s.x) * f, py = s.y + (ty - s.y) * f;
      const off = Math.hypot(px - st.x, py - st.y) - st.r - SHIP_R;
      if (off < 1.2 + 1.5 * skill && (!threat || st.d < threat.st.d)) threat = { st, px, py };
    }
    if (threat) {
      const { st, px, py } = threat;
      let dx = px - st.x, dy = py - st.y, n = Math.hypot(dx, dy);
      if (n < 0.01) { dx = -st.x || 1; dy = -st.y; n = Math.hypot(dx, dy); }
      const away = st.r + SHIP_R + 2.6 - 1.7 * skill;   // a good pilot skims it
      tx = st.x + (dx / n) * away; ty = st.y + (dy / n) * away;
      const m = Math.hypot(tx, ty);
      if (m > TUBE - 1) { tx = st.x - (dx / n) * away; ty = st.y - (dy / n) * away; }
    }
    wx = (wx + (rnd() - 0.5) * (1 - skill) * 1.6) * 0.93;
    wy = (wy + (rnd() - 0.5) * (1 - skill) * 1.6) * 0.93;
    const gain = 0.25 + 0.2 * skill;
    const x = clamp((tx - s.x) * gain + wx - s.vx * 0.06, -1, 1);
    const y = clamp((ty - s.y) * gain + wy - s.vy * 0.06, -1, 1);
    const gap = s.d - run.light.d;
    const close = threat && time(threat.st.d) < 0.6 - 0.3 * skill;
    const boost = !close && (s.charge > 0.75 - 0.4 * skill || (gap < 160 && s.charge > 0.05));
    return { x, y, boost };
  };
}
export { RING_R };
