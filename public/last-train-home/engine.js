export const routes = [1, 0, 2, 1, 2, 0, 1];
export function create() {
  return {
    phase: "ready",
    lane: 1,
    leg: 0,
    elapsed: 0,
    travel: 0,
    light: 0,
    score: 0,
    lives: 3,
    message: "Follow the amber reflection.",
  };
}
export function act(s, key) {
  if (s.phase !== "playing") return;
  if (key === "ArrowLeft" || key === "a") s.lane = Math.max(0, s.lane - 1);
  if (key === "ArrowRight" || key === "d") s.lane = Math.min(2, s.lane + 1);
  if (key === " ") {
    s.light = 2.7;
    s.elapsed += 0.4;
    s.message = "Headlights reveal the amber route.";
  }
  if (key === "ArrowUp" || key === "w")
    s.travel = Math.min(3.5, s.travel + 0.3);
  if (key === "ArrowDown" || key === "s")
    s.travel = Math.max(0, s.travel - 0.3);
}
export function step(s, dt) {
  if (s.phase !== "playing") return;
  s.elapsed += dt;
  s.travel += dt;
  s.light = Math.max(0, s.light - dt);
  if (s.travel >= 4) {
    s.travel = 0;
    if (s.lane === routes[s.leg]) {
      s.score += 100;
      s.leg++;
      s.message = "Route marker found. Keep moving.";
    } else {
      s.lives--;
      s.elapsed += 6;
      s.message = "Wrong crossing. Traffic cost you six seconds.";
    }
    if (s.leg === routes.length) {
      s.phase = "won";
      s.score += Math.max(0, Math.floor(90 - s.elapsed)) * 10;
      s.message = "You caught the last train.";
    } else if (s.lives <= 0) {
      s.phase = "lost";
      s.message = "Traffic blocked the route.";
    }
  }
  if (s.elapsed >= 90 && s.phase === "playing") {
    s.phase = "lost";
    s.message = "The last train has left.";
  }
}
