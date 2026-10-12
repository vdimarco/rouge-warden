export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function createGame() {
  return {
    phase: "ready",
    time: 0,
    x: 0,
    wind: 0,
    health: 3,
    score: 0,
    passed: 0,
    next: 0,
    objects: [],
    message: "Follow steady beacons. Shimmering lights are mirages.",
  };
}
export function start(s) {
  Object.assign(s, createGame(), { phase: "playing" });
}
export function step(s, dt, input = {}) {
  if (s.phase !== "playing") return;
  dt = Math.min(dt, 0.05);
  s.time += dt;
  s.wind = Math.sin(s.time * 0.22) * 0.21 + Math.sin(s.time * 0.63) * 0.065;
  s.x = clamp(
    s.x +
      ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 0.8 * dt +
      s.wind * dt,
    -1,
    1,
  );
  if (s.next < 12 && s.time >= s.next * 4.8) {
    const n = s.next++,
      x = Math.sin(n * 2.31) * 0.69;
    s.objects.push({ kind: "beacon", real: n % 3 !== 2, x, depth: 0, id: n });
    s.objects.push({
      kind: "rock",
      x: clamp(x + (n % 2 ? 0.65 : -0.65), -0.92, 0.92),
      depth: 0,
      id: n,
    });
  }
  for (const o of s.objects) {
    o.depth += dt / 6;
    if (o.depth >= 1 && !o.done) {
      o.done = true;
      const near = Math.abs(s.x - o.x) < (o.kind === "rock" ? 0.16 : 0.28);
      if (o.kind === "rock" && near) {
        s.health--;
        s.message = "Sandstone scraped the hull. Steer clear of dark ridges.";
      }
      if (o.kind === "beacon") {
        s.passed++;
        if (o.real && near) {
          s.score++;
          s.message = "A true beacon. The caravan is closer.";
        } else if (!o.real && near)
          s.message = "A mirage dissolves. Trust the steady, warm lights.";
        else if (o.real)
          s.message = "A beacon slipped past. Catch the next steady light.";
      }
    }
  }
  s.objects = s.objects.filter((o) => o.depth < 1.12);
  if (s.health <= 0) {
    s.phase = "lost";
    s.message = "The dunes claimed your skiff. Try another crossing.";
  } else if (s.passed === 12) {
    s.phase = s.score >= 6 ? "won" : "lost";
    s.message =
      s.phase === "won"
        ? "Caravan reached. Six true lights carried you home."
        : "The caravan vanished. Reach six steady beacons next time.";
  }
}
export function project(o) {
  const p = Math.max(0, o.depth),
    spread = 0.08 + 0.92 * p * p;
  return {
    x: 100 + o.x * 91 * spread,
    y: 64 + 31 * p * p,
    size: Math.max(0.55, p * 3.5),
    fade:
      !o.real && o.kind === "beacon" && p > 0.55
        ? Math.max(0, 1 - (p - 0.55) / 0.29)
        : 1,
  };
}
