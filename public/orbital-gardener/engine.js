export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function seed(i) {
  return {
    x: 28 + ((i * 37) % 146),
    y: 14 + ((i * 11) % 40),
    vx: Math.sin(i * 2.4) * 4,
    vy: Math.cos(i * 1.3) * 2,
    id: i,
  };
}
export function createGame() {
  return {
    phase: "ready",
    time: 0,
    x: 100,
    y: 72,
    cargo: 0,
    plants: [],
    seeds: Array.from({ length: 10 }, (_, i) => seed(i)),
    health: 3,
    cooldown: 0,
    score: 0,
    message: "Catch starlight seeds above. Plant on the moon below.",
    debris: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
  };
}
export function start(s) {
  Object.assign(s, createGame(), { phase: "playing" });
}
export function step(s, dt, input = {}) {
  if (s.phase !== "playing") return;
  dt = Math.min(dt, 0.05);
  s.time += dt;
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.x = clamp(
    s.x + ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 40 * dt,
    5,
    195,
  );
  s.y = clamp(
    s.y + ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * 32 * dt,
    8,
    88,
  );
  for (const z of s.seeds) {
    let ax = Math.sin(s.time * 0.3 + z.id) * 0.8,
      ay = Math.cos(s.time * 0.2 + z.id) * 0.4;
    for (const p of s.plants) {
      const dx = p.x - z.x,
        dy = p.y - z.y,
        r = Math.hypot(dx, dy),
        pull = 65 / (20 + r);
      ax += (dx / Math.max(r, 1)) * pull;
      ay += (dy / Math.max(r, 1)) * pull;
    }
    z.vx = clamp(z.vx + ax * dt, -11, 11);
    z.vy = clamp(z.vy + ay * dt, -8, 8);
    z.x += z.vx * dt;
    z.y += z.vy * dt;
    if (z.x < 8 || z.x > 192) {
      z.x = clamp(z.x, 8, 192);
      z.vx *= -1;
    }
    if (z.y < 10 || z.y > 64) {
      z.y = clamp(z.y, 10, 64);
      z.vy *= -1;
    }
  }
  s.seeds = s.seeds.filter((z) => {
    if (s.cargo < 3 && Math.hypot((z.x - s.x) * 0.7, z.y - s.y) < 4) {
      s.cargo++;
      s.score += 20;
      s.message = "Seed caught. Descend to the lower third and plant.";
      return false;
    }
    return true;
  });
  if (
    input.action &&
    s.cargo &&
    s.y >= 66 &&
    s.plants.every((p) => Math.abs(p.x - s.x) > 10)
  ) {
    s.cargo--;
    s.plants.push({ x: s.x, y: s.y, born: s.time });
    s.score += 100;
    s.message = "A new gravity garden. Watch the remaining seeds bend.";
  }
  if (input.action && s.y < 66)
    s.message = "Plant on the near lunar soil: descend to the lower third.";
  for (let i = 0; i < 2; i++) {
    const d = s.debris[i],
      angle = s.time * (0.18 + i * 0.045) + i * 3;
    d.x = 100 + Math.cos(angle) * 70;
    d.y = 36 + Math.sin(angle) * 18;
    if (!s.cooldown && Math.hypot((d.x - s.x) * 0.7, d.y - s.y) < 3) {
      s.health--;
      s.cooldown = 2;
      s.message = "An orbiting stone struck the catcher. Watch its arc.";
    }
  }
  if (s.plants.length >= 6) {
    s.phase = "won";
    s.message = "Six gardens bloom. A constellation takes root.";
  } else if (s.health <= 0 || s.time >= 100) {
    s.phase = "lost";
    s.message =
      s.health <= 0
        ? "The catcher is damaged. Begin a new constellation."
        : "Dawn arrived. Six gardens will take another orbit.";
  }
}
