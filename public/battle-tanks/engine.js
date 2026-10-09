const clamp = (n, a, b) => Math.max(a, Math.min(b, n)),
  dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const SAVE_KEY = "battle-tanks:campaign:v1";
export const MISSIONS = [
  {
    name: "Woodland Relay",
    region: "forest",
    cover: [
      [62, 67, 10, 24],
      [99, 38, 22, 9],
      [140, 64, 13, 20],
      [33, 44, 15, 8],
    ],
    relays: [
      [55, 26],
      [122, 49],
      [171, 24],
    ],
    enemies: [
      [83, 25],
      [133, 83],
      [151, 37],
    ],
  },
  {
    name: "Rainlit Junction",
    region: "city",
    cover: [
      [49, 48, 12, 28],
      [88, 74, 23, 10],
      [113, 30, 12, 25],
      [147, 59, 25, 10],
    ],
    relays: [
      [62, 21],
      [129, 70],
      [174, 29],
    ],
    enemies: [
      [80, 35],
      [117, 82],
      [167, 49],
      [147, 20],
    ],
  },
  {
    name: "Dune Command",
    region: "desert",
    cover: [
      [55, 69, 24, 9],
      [88, 33, 12, 25],
      [126, 68, 12, 27],
      [163, 47, 20, 9],
    ],
    relays: [
      [52, 22],
      [111, 46],
      [177, 21],
    ],
    enemies: [
      [73, 46],
      [145, 80],
      [152, 24],
      [181, 61],
    ],
  },
];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function create(missionIndex = 0) {
  missionIndex = Number.isInteger(missionIndex) ? clamp(missionIndex, 0, 2) : 0;
  const m = MISSIONS[missionIndex];
  return {
    version: 1,
    mode: "tanks",
    phase: "ready",
    missionIndex,
    region: m.region,
    name: m.name,
    x: 17,
    y: 83,
    hp: 100,
    time: 0,
    hullAngle: 0,
    turretAngle: 0,
    speed: 0,
    recoil: 0,
    shellCooldown: 0,
    smokeCooldown: 0,
    artilleryCooldown: 0,
    score: 0,
    completed: [false, false, false],
    cover: m.cover.map(([x, y, w, h], i) => ({
      id: "cover-" + i,
      x,
      y,
      w,
      h,
      hp: 12,
      solid: true,
    })),
    relays: m.relays.map(([x, y], i) => ({
      id: "relay-" + i,
      x,
      y,
      hp: 3,
      cooldown: 2 + i,
      warning: 0,
      aimX: 17,
      aimY: 83,
    })),
    enemies: m.enemies.map(([x, y], i) => ({
      id: "tank-" + i,
      x,
      y,
      hp: 3,
      angle: Math.PI,
      turretAngle: Math.PI,
      cooldown: 1 + i * 0.7,
      warning: 0,
      aimX: 17,
      aimY: 83,
    })),
    projectiles: [],
    smoke: [],
    effects: [],
    pickups: [
      { id: "repair-a", x: 29, y: 81, kind: "repair", used: false },
      { id: "repair-b", x: 111, y: 85, kind: "repair", used: false },
    ],
    beacon: { x: 178, y: 83, r: 9 },
    message: "Disable all three relay guns, then drive into extraction.",
    shots: 0,
    nextId: 0,
  };
}
export function start(s) {
  if (s.phase === "ready") s.phase = "playing";
  return s;
}
export function pause(s) {
  if (s.phase === "playing") {
    s.phase = "paused";
    s.speed = 0;
  }
  return s;
}
export function resume(s) {
  if (s.phase === "paused") s.phase = "playing";
  return s;
}
export function retry(s) {
  const fresh = create(s.missionIndex);
  fresh.score = s.score;
  fresh.completed = s.completed.map((done, i) => i < s.missionIndex && done);
  Object.assign(s, fresh, { phase: "playing" });
  return s;
}
export function advance(s) {
  if (s.phase !== "region-complete") return false;
  const fresh = create(s.missionIndex + 1);
  fresh.score = s.score;
  fresh.completed = [...s.completed];
  Object.assign(s, fresh, { phase: "playing" });
  return true;
}
function boxContains(p, b, r = 0) {
  return Math.abs(p.x - b.x) < b.w / 2 + r && Math.abs(p.y - b.y) < b.h / 2 + r;
}
export function blocked(s, p, r = 0) {
  return (
    p.x < 4 + r ||
    p.x > 196 - r ||
    p.y < 8 + r ||
    p.y > 96 - r ||
    s.cover.some((b) => b.hp > 0 && boxContains(p, b, r))
  );
}
export function lineBlocked(s, a, b, includeSmoke = true) {
  const distance = dist(a, b),
    steps = Math.max(1, Math.ceil(distance));
  for (let i = 1; i < steps; i++) {
    const p = {
      x: a.x + ((b.x - a.x) * i) / steps,
      y: a.y + ((b.y - a.y) * i) / steps,
    };
    if (s.cover.some((c) => c.hp > 0 && boxContains(p, c))) return true;
    if (includeSmoke && s.smoke.some((c) => c.life > 0 && dist(p, c) < c.r))
      return true;
  }
  return false;
}
export function aim(s, x, y) {
  if (Number.isFinite(x) && Number.isFinite(y) && dist(s, { x, y }) > 0.1)
    s.turretAngle = Math.atan2(y - s.y, x - s.x);
}
function nearestTarget(s) {
  return [...s.enemies, ...s.relays]
    .filter((t) => t.hp > 0 && dist(s, t) <= 70 && !lineBlocked(s, s, t))
    .sort((a, b) => dist(s, a) - dist(s, b))[0];
}
export function fire(s, autoAim = false) {
  if (s.phase !== "playing" || s.shellCooldown > 0) return false;
  if (autoAim) {
    const t = nearestTarget(s);
    if (t) aim(s, t.x, t.y);
  }
  s.projectiles.push({
    id: "shell-" + s.nextId++,
    x: s.x + Math.cos(s.turretAngle) * 3.6,
    y: s.y + Math.sin(s.turretAngle) * 3.6,
    vx: Math.cos(s.turretAngle) * 59,
    vy: Math.sin(s.turretAngle) * 59,
    owner: "player",
    life: 70 / 59,
  });
  s.shellCooldown = 0.6;
  s.recoil = 0.2;
  s.shots++;
  s.effects.push({
    kind: "muzzle",
    x: s.x + Math.cos(s.turretAngle) * 4,
    y: s.y + Math.sin(s.turretAngle) * 4,
    life: 0.22,
    r: 3,
  });
  return true;
}
export function smoke(s) {
  if (s.phase !== "playing" || s.smokeCooldown > 0) return false;
  s.smoke.push({ id: "smoke-" + s.nextId++, x: s.x, y: s.y, r: 12, life: 5 });
  s.smokeCooldown = 9;
  s.message = "Smoke breaks enemy sight. Move before it clears.";
  return true;
}
export function artillery(s, target) {
  if (s.phase !== "playing" || s.artilleryCooldown > 0) return false;
  const t = target ??
    nearestTarget(s) ?? {
      x: s.x + Math.cos(s.turretAngle) * 30,
      y: s.y + Math.sin(s.turretAngle) * 30,
    };
  if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || dist(s, t) > 55) {
    s.message = "Target outside artillery range. Drive within 55 meters.";
    return false;
  }
  const x = clamp(t.x, 5, 195),
    y = clamp(t.y, 10, 95);
  s.effects.push({ kind: "artillery", x, y, r: 12, life: 0.75 });
  for (const e of [...s.enemies, ...s.relays])
    if (e.hp > 0 && dist(e, { x, y }) < 12) {
      e.hp = Math.max(0, e.hp - 2);
      if (e.hp === 0) s.score += e.id.startsWith("relay") ? 350 : 150;
    }
  for (const c of s.cover)
    if (c.hp > 0 && dist(c, { x, y }) < 14) c.hp = Math.max(0, c.hp - 6);
  s.artilleryCooldown = 14;
  s.message = "Artillery arcs over cover. Relocate while it reloads.";
  return true;
}
function move(s, p, dx, dy, r = 2.4) {
  const nx = { x: clamp(p.x + dx, 4 + r, 196 - r), y: p.y };
  if (!blocked(s, nx, r)) p.x = nx.x;
  const ny = { x: p.x, y: clamp(p.y + dy, 8 + r, 96 - r) };
  if (!blocked(s, ny, r)) p.y = ny.y;
}
function enemyShot(s, e) {
  const angle = Math.atan2(e.aimY - e.y, e.aimX - e.x);
  s.projectiles.push({
    id: "hostile-" + s.nextId++,
    x: e.x + Math.cos(angle) * 3,
    y: e.y + Math.sin(angle) * 3,
    vx: Math.cos(angle) * 34,
    vy: Math.sin(angle) * 34,
    owner: e.id,
    life: 4,
  });
  e.cooldown = e.id.startsWith("relay") ? 2.6 : 2.2;
  e.warning = 0;
  s.effects.push({ kind: "muzzle", x: e.x, y: e.y, r: 2, life: 0.15 });
}
function tickEnemies(s, dt) {
  for (const e of [...s.enemies, ...s.relays]) {
    if (e.hp <= 0) continue;
    e.cooldown -= dt;
    const visible = dist(e, s) < 90 && !lineBlocked(s, e, s);
    e.turretAngle = Math.atan2(s.y - e.y, s.x - e.x);
    if (e.warning > 0) {
      e.warning -= dt;
      if (e.warning <= 0 && visible) enemyShot(s, e);
      else if (!visible) {
        e.warning = 0;
        e.cooldown = 1;
      }
      continue;
    }
    if (e.cooldown <= 0 && visible) {
      e.warning = 0.9;
      e.aimX = s.x;
      e.aimY = s.y;
      e.cooldown = 99;
    }
    if (e.id.startsWith("tank") && (dist(e, s) > 37 || !visible)) {
      const angle = Math.atan2(s.y - e.y, s.x - e.x) + (!visible ? 0.45 : 0);
      e.angle = angle;
      move(s, e, Math.cos(angle) * 5 * dt, Math.sin(angle) * 5 * dt, 2.4);
    }
  }
}
function tickShells(s, dt) {
  for (const p of s.projectiles) {
    p.life -= dt;
    const steps = Math.max(1, Math.ceil((Math.hypot(p.vx, p.vy) * dt) / 1.3));
    for (let i = 0; i < steps && p.life > 0; i++) {
      p.x += (p.vx * dt) / steps;
      p.y += (p.vy * dt) / steps;
      const c = s.cover.find((c) => c.hp > 0 && boxContains(p, c));
      if (c) {
        c.hp = Math.max(0, c.hp - (p.owner === "player" ? 1 : 0.5));
        p.life = 0;
        s.effects.push({ kind: "impact", x: p.x, y: p.y, r: 3, life: 0.35 });
        break;
      }
      if (p.x < 2 || p.x > 198 || p.y < 5 || p.y > 99) {
        p.life = 0;
        break;
      }
      if (p.owner === "player") {
        const t = [...s.enemies, ...s.relays].find(
          (t) => t.hp > 0 && dist(t, p) < 3.2,
        );
        if (t) {
          t.hp--;
          p.life = 0;
          s.score += 25;
          if (t.hp <= 0) s.score += t.id.startsWith("relay") ? 350 : 150;
          s.effects.push({ kind: "impact", x: t.x, y: t.y, r: 5, life: 0.45 });
        }
      } else if (dist(s, p) < 2.7) {
        s.hp = Math.max(0, s.hp - 9);
        p.life = 0;
        s.message = "Hit. Break line of sight or deploy smoke.";
        s.effects.push({ kind: "impact", x: s.x, y: s.y, r: 5, life: 0.4 });
      }
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.life > 0);
}
export function update(s, input = {}, dt = 0) {
  if (s.phase !== "playing") return s;
  dt = clamp(Number(dt) || 0, 0, 0.05);
  s.time += dt;
  s.shellCooldown = Math.max(0, s.shellCooldown - dt);
  s.smokeCooldown = Math.max(0, s.smokeCooldown - dt);
  s.artilleryCooldown = Math.max(0, s.artilleryCooldown - dt);
  s.recoil = Math.max(0, s.recoil - dt);
  const throttle = clamp(Number(input.throttle) || 0, -1, 1),
    turn = clamp(Number(input.turn) || 0, -1, 1);
  s.hullAngle = wrap(s.hullAngle + turn * 1.65 * dt);
  s.speed = clamp(s.speed + throttle * 13 * dt, -7, 16);
  s.speed *= Math.exp(-(Math.abs(throttle) > 0.1 ? 0.18 : 2.7) * dt);
  move(
    s,
    s,
    Math.cos(s.hullAngle) * s.speed * dt,
    Math.sin(s.hullAngle) * s.speed * dt,
  );
  if (input.aim) aim(s, input.aim.x, input.aim.y);
  if (input.fire) fire(s, Boolean(input.autoAim));
  tickEnemies(s, dt);
  tickShells(s, dt);
  for (const c of s.smoke) c.life -= dt;
  s.smoke = s.smoke.filter((c) => c.life > 0);
  for (const e of s.effects) e.life -= dt;
  s.effects = s.effects.filter((e) => e.life > 0);
  for (const p of s.pickups)
    if (!p.used && dist(p, s) < 5) {
      p.used = true;
      s.hp = Math.min(100, s.hp + 35);
      s.message = "Field repair collected. +35 health.";
    }
  if (s.hp <= 0) {
    s.phase = "lost";
    s.speed = 0;
    s.message = "Tank disabled. Retry this mission with a fresh vehicle.";
  } else if (
    s.relays.every((r) => r.hp <= 0) &&
    dist(s, s.beacon) < s.beacon.r
  ) {
    s.completed[s.missionIndex] = true;
    s.phase = s.missionIndex === 2 ? "won" : "region-complete";
    s.score += 500;
    s.speed = 0;
    s.message =
      s.phase === "won"
        ? "Three command sectors secured. Extraction complete."
        : "Relays down. Sector secured — advance to the next mission.";
  } else if (s.relays.every((r) => r.hp <= 0))
    s.message = "All relay guns disabled. Drive into the cyan extraction zone.";
  return s;
}
export function serialize(s) {
  return JSON.stringify(s);
}
export function restore(raw) {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      !v ||
      v.version !== 1 ||
      v.mode !== "tanks" ||
      !Number.isInteger(v.missionIndex) ||
      v.missionIndex < 0 ||
      v.missionIndex > 2 ||
      ![
        "ready",
        "playing",
        "paused",
        "lost",
        "region-complete",
        "won",
      ].includes(v.phase)
    )
      return null;
    const s = create(v.missionIndex);
    for (const k of [
      "x",
      "y",
      "hp",
      "time",
      "hullAngle",
      "turretAngle",
      "score",
    ])
      if (!Number.isFinite(v[k])) return null;
    if (
      v.x < 4 ||
      v.x > 196 ||
      v.y < 8 ||
      v.y > 96 ||
      v.hp < 0 ||
      v.hp > 100 ||
      v.score < 0 ||
      v.score > 1e7 ||
      v.time < 0 ||
      v.time > 1e7
    )
      return null;
    if (
      !Array.isArray(v.completed) ||
      v.completed.length !== 3 ||
      v.completed.some((x) => typeof x !== "boolean")
    )
      return null;
    for (let i = 0; i < s.missionIndex; i++) if (!v.completed[i]) return null;
    for (let i = s.missionIndex + 1; i < 3; i++)
      if (v.completed[i]) return null;
    if (
      v.completed[s.missionIndex] !==
      ["won", "region-complete"].includes(v.phase)
    )
      return null;
    for (const key of ["cover", "relays", "enemies"]) {
      if (!Array.isArray(v[key]) || v[key].length !== s[key].length)
        return null;
      for (const item of s[key]) {
        const old = v[key].find((e) => e.id === item.id);
        if (
          !old ||
          !Number.isFinite(old.hp) ||
          old.hp < 0 ||
          old.hp > (key === "cover" ? 12 : 3)
        )
          return null;
        item.hp = old.hp;
        if (key === "enemies") {
          if (
            !Number.isFinite(old.x) ||
            !Number.isFinite(old.y) ||
            old.x < 4 ||
            old.x > 196 ||
            old.y < 8 ||
            old.y > 96
          )
            return null;
          item.x = old.x;
          item.y = old.y;
        }
      }
    }
    Object.assign(s, {
      x: v.x,
      y: v.y,
      hp: v.hp,
      time: v.time,
      hullAngle: wrap(v.hullAngle),
      turretAngle: wrap(v.turretAngle),
      score: v.score,
      completed: v.completed,
    });
    if (
      ["won", "region-complete"].includes(v.phase) &&
      (!s.relays.every((r) => r.hp <= 0) || !s.completed[s.missionIndex])
    )
      return null;
    if (
      v.phase === "won" &&
      (v.missionIndex !== 2 || !s.completed.every(Boolean))
    )
      return null;
    s.phase =
      v.phase === "won" || v.phase === "region-complete"
        ? v.phase
        : s.hp <= 0
          ? "lost"
          : "ready";
    if (blocked(s, s, 2.4)) return null;
    if (!Array.isArray(v.pickups) || v.pickups.length !== s.pickups.length)
      return null;
    for (const p of s.pickups) {
      const old = v.pickups.find((e) => e.id === p.id);
      if (!old || typeof old.used !== "boolean") return null;
      p.used = old.used;
    }
    return s;
  } catch {
    return null;
  }
}
