export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function createWatch() {
  return {
    phase: "playing",
    time: 0,
    boats: [],
    spawned: 0,
    saved: 0,
    wrecks: 0,
    selected: null,
    beam: 100,
  };
}
export function step(s, dt) {
  if (s.phase !== "playing") return;
  s.time += dt;
  if (s.spawned < 8 && s.time >= s.spawned * 7) {
    let id = s.spawned++;
    s.boats.push({
      id,
      x: 85 + ((id * 29) % 75),
      y: 61,
      tx: 85 + ((id * 29) % 75),
      ty: 99,
    });
  }
  for (const b of s.boats) {
    if (b.done) continue;
    let dx = b.tx - b.x,
      dy = b.ty - b.y,
      d = Math.hypot(dx, dy),
      speed = 2.5 + (b.y - 60) * 0.04;
    if (d > 1) {
      b.x += (dx / d) * speed * dt;
      b.y += (dy / d) * speed * dt;
    }
    if (b.x < 45 && b.y > 83) {
      b.done = true;
      s.saved++;
    } else if (b.y > 97 || Math.hypot(b.x - 98, b.y - 82) < 6) {
      b.done = true;
      s.wrecks++;
    }
  }
  if (s.wrecks >= 3) s.phase = "lost";
  else if (s.saved + s.wrecks === 8) s.phase = "won";
}
export function visible(s, b) {
  return Math.abs(b.x - s.beam) < 18 || b.id === s.selected;
}
export function select(s, x, y) {
  const boat = s.boats.find(
    (b) => !b.done && visible(s, b) && Math.hypot(b.x - x, b.y - y) < 7,
  );
  if (boat) s.selected = boat.id;
  else {
    const b = s.boats.find((b) => b.id === s.selected && !b.done);
    if (b) {
      b.tx = clamp(x, 35, 190);
      b.ty = clamp(y, 62, 97);
    }
  }
}
