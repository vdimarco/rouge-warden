export const trail = [
    [3, 4],
    [3, 3],
    [2, 3],
    [2, 2],
    [3, 2],
    [4, 2],
    [4, 1],
    [3, 1],
    [3, 0],
  ],
  shrines = [
    [2, 3],
    [2, 2],
    [4, 2],
    [4, 1],
    [3, 0],
  ];
export function create() {
  return {
    phase: "ready",
    x: 3,
    y: 4,
    light: 100,
    released: false,
    reveal: 0,
    delivered: [],
    elapsed: 0,
    score: 0,
    message: "Release the swarm to see the moss path.",
  };
}
export function act(s, key) {
  if (s.phase !== "playing") return;
  if (key === " ") {
    s.released = !s.released;
    s.reveal = 2;
    s.message = s.released
      ? "The swarm reveals moss. Recall before walking."
      : "Swarm recalled. Follow the path you remember.";
    return;
  }
  const dirs = {
    ArrowLeft: [-1, 0],
    a: [-1, 0],
    ArrowRight: [1, 0],
    d: [1, 0],
    ArrowUp: [0, -1],
    w: [0, -1],
    ArrowDown: [0, 1],
    s: [0, 1],
  };
  const d = dirs[key];
  if (!d) return;
  if (s.released) {
    s.message = "Recall your swarm before moving.";
    return;
  }
  const x = s.x + d[0],
    y = s.y + d[1];
  if (x < 0 || x > 6 || y < 0 || y > 4) return;
  s.x = x;
  s.y = y;
  if (!trail.some((p) => p[0] === x && p[1] === y)) {
    s.light -= 16;
    s.message = "Thorns scattered your light. Find the moss.";
  } else {
    s.light -= 1;
    s.message = "Soft moss beneath your feet.";
  }
  const i = shrines.findIndex((p) => p[0] === x && p[1] === y);
  if (i >= 0 && !s.delivered.includes(i)) {
    s.delivered.push(i);
    s.light = Math.min(100, s.light + 12);
    s.score += 150;
    s.message = "A forest lantern wakes. Its glow restores the swarm.";
  }
  if (s.delivered.length === 5) {
    s.phase = "won";
    s.score += Math.floor(s.light) * 5;
    s.message = "Five lanterns glow. The forest carries your light.";
  } else if (s.light <= 0) {
    s.phase = "lost";
    s.message = "The swarm faded among the thorns.";
  }
}
export function step(s, dt) {
  if (s.phase !== "playing") return;
  s.elapsed += dt;
  s.reveal = Math.max(0, s.reveal - dt);
  s.light -= dt * (s.released ? 1.7 : 0.12);
  if (s.light <= 0) {
    s.light = 0;
    s.phase = "lost";
    s.message = "The swarm faded. Try a gentler route.";
  }
}
