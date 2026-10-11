export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function createDive() {
  return {
    phase: "playing",
    time: 0,
    x: 102,
    y: 67,
    oxygen: 100,
    pulse: 0,
    revealed: 0,
    collected: 0,
    bells: [
      { x: 73, y: 79 },
      { x: 128, y: 89 },
      { x: 104, y: 94 },
      { x: 153, y: 77 },
      { x: 48, y: 91 },
      { x: 94, y: 81 },
    ],
  };
}
export function sonar(s) {
  if (s.phase === "playing" && s.oxygen >= 8 && s.pulse <= 0) {
    s.oxygen -= 8;
    s.pulse = 2.4;
    s.revealed = 5;
    return true;
  }
  return false;
}
export function step(s, dt, dx = 0, dy = 0) {
  if (s.phase !== "playing") return;
  s.time += dt;
  s.pulse = Math.max(0, s.pulse - dt);
  s.revealed = Math.max(0, s.revealed - dt);
  let d = Math.hypot(dx, dy) || 1;
  s.x = clamp(s.x + (dx / d) * 17 * dt, 38, 166);
  s.y = clamp(s.y + (dy / d) * 11 * dt, 65, 96);
  s.oxygen = clamp(s.oxygen + (s.y < 70 ? 16 : -1.3) * dt, 0, 100);
  for (const b of s.bells)
    if (!b.got && s.revealed > 0 && Math.hypot(b.x - s.x, b.y - s.y) < 4) {
      b.got = true;
      s.collected++;
    }
  if (s.collected === 6) s.phase = "won";
  else if (s.oxygen <= 0 || s.time >= 150) s.phase = "lost";
}
