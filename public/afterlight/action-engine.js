// Deterministic, DOM-free rescue action model. Classic journey saves remain separate.
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const ACTION_ORDER = [
  "forest",
  "city",
  "coast",
  "fjord",
  "desert",
  "moon",
];
const bounds = { minX: 10, maxX: 190, minY: 30, maxY: 92 };
const descriptor = (name, palette, enemyKinds, positions) => ({
  name,
  palette,
  enemyKinds,
  bounds: { ...bounds },
  beacon: { x: 100, y: 62, radius: 10 },
  survivors: positions.map(([x, y], i) => ({
    id: `survivor-${i + 1}`,
    name: ["scout", "gardener", "navigator"][i],
    x,
    y,
  })),
});
export const ACTION_REGIONS = {
  forest: descriptor(
    "Firefly Woods",
    ["#f6d674", "#78e8ba", "#59639d"],
    ["stalker", "thicket"],
    [
      [42, 44],
      [158, 46],
      [82, 83],
    ],
  ),
  city: descriptor(
    "Rainlit City",
    ["#ff75bc", "#91e9ff", "#756ecc"],
    ["sentry", "tram-shadow"],
    [
      [46, 39],
      [164, 80],
      [82, 84],
    ],
  ),
  coast: descriptor(
    "Night Harbor",
    ["#ffd682", "#8ac8f8", "#515f9d"],
    ["skimmer", "tide-caster"],
    [
      [38, 46],
      [161, 45],
      [82, 84],
    ],
  ),
  fjord: descriptor(
    "Sleeping Fjord",
    ["#79ffc5", "#b1c8ff", "#6b68d4"],
    ["ice-shard", "frost-stalker"],
    [
      [82, 79],
      [165, 42],
      [49, 41],
    ],
  ),
  desert: descriptor(
    "Mirage Expanse",
    ["#ffd478", "#ff9c88", "#8b74bd"],
    ["burrower", "sand-caster"],
    [
      [40, 40],
      [165, 83],
      [82, 83],
    ],
  ),
  moon: descriptor(
    "Orbital Garden",
    ["#aff1ff", "#d4a9ff", "#679ee5"],
    ["orbiter", "meteor-shadow"],
    [
      [82, 82],
      [156, 40],
      [165, 82],
    ],
  ),
};
const CHARGERS = new Set([
  "stalker",
  "tram-shadow",
  "skimmer",
  "frost-stalker",
  "burrower",
  "meteor-shadow",
]);
function random(s) {
  s.rngState = (Math.imul(s.rngState, 1664525) + 1013904223) >>> 0;
  return s.rngState / 4294967296;
}
function id(s, prefix) {
  return `${prefix}-${++s.nextId}`;
}
function effect(s, kind, x, y, radius = 8, duration = 0.45) {
  s.effects.push({
    id: id(s, "effect"),
    kind,
    x,
    y,
    radius,
    duration,
    ttl: duration,
  });
  if (s.effects.length > 100) s.effects.splice(0, s.effects.length - 100);
}
function makeRegion(s, region) {
  const config = ACTION_REGIONS[region];
  s.region = region;
  s.index = ACTION_ORDER.indexOf(region);
  s.regionTime = 0;
  s.x = 100;
  s.y = 82;
  s.hp = 100;
  s.beacon = { ...config.beacon, hp: 100 };
  s.stage = "rescue";
  s.rescued = 0;
  s.guardianSpawned = false;
  s.guardianDefeated = false;
  s.defenseDuration = 18;
  s.defenseRemaining = 18;
  s.survivors = config.survivors.map((v) => ({
    ...v,
    status: "stranded",
    followOrder: 0,
  }));
  s.enemies = [];
  s.projectiles = [];
  s.effects = [];
  s.pickups = [
    { id: id(s, "pickup"), kind: "power", x: 100, y: 73, radius: 3.5 },
  ];
  s.aim = { x: 100, y: 30 };
  s.lastMove = { dx: 0, dy: -1 };
  s.dodge = { remaining: 0, cooldown: 0, dx: 0, dy: -1 };
  s.fireCooldown = 0;
  s.powerRemaining = 0;
  s.hitCooldown = 0;
  s.spawnClock = 2.8;
  s.message = `Find the three survivors in ${config.name}. Get close so they follow, then bring them to the bright beacon.`;
}
export function createActionGame(seed = 1) {
  const parsed = Number(seed);
  const s = {
    version: 1,
    mode: "action",
    seed: Number.isFinite(parsed) ? parsed >>> 0 : 1,
    rngState: Number.isFinite(parsed) ? parsed >>> 0 : 1,
    nextId: 0,
    phase: "ready",
    time: 0,
    completed: [],
    kills: 0,
    totalRescued: 0,
  };
  makeRegion(s, "forest");
  return s;
}
export function startAction(s) {
  if (s.phase !== "ready") return false;
  s.phase = "playing";
  if (!s.enemies.length) {
    spawnEnemy(s);
    spawnEnemy(s);
  }
  return true;
}
export function pauseAction(s) {
  if (s.phase !== "playing") return false;
  s.phase = "paused";
  return true;
}
export function resumeAction(s) {
  if (!["paused", "ready"].includes(s.phase)) return false;
  return s.phase === "ready" ? startAction(s) : ((s.phase = "playing"), true);
}
export function retryAction(s) {
  if (s.phase !== "lost") return false;
  const region = s.region;
  s.totalRescued = s.completed.length * 3;
  makeRegion(s, region);
  s.phase = "ready";
  s.message =
    "Your restored regions remain safe. Try this rescue again with full health.";
  return true;
}
export function advanceAction(s) {
  if (s.phase !== "region-complete") return false;
  const next = ACTION_ORDER[s.index + 1];
  if (!next) {
    s.phase = "won";
    return true;
  }
  makeRegion(s, next);
  s.phase = "ready";
  return true;
}

function aimAt(s, aimX, aimY) {
  if (Number.isFinite(aimX) && Number.isFinite(aimY))
    s.aim = { x: clamp(aimX, 0, 200), y: clamp(aimY, 0, 100) };
  else {
    const nearest = [...s.enemies].sort(
      (a, b) => distance(s, a) - distance(s, b),
    )[0];
    const guardian = s.enemies.find((e) => e.elite && distance(s, e) < 65);
    const target =
      guardian && (!nearest || nearest.elite || distance(s, nearest) > 12)
        ? guardian
        : nearest;
    if (target) s.aim = { x: target.x, y: target.y };
  }
  let dx = s.aim.x - s.x,
    dy = s.aim.y - s.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) {
    dx = s.lastMove.dx;
    dy = s.lastMove.dy;
  }
  const norm = Math.hypot(dx, dy) || 1;
  return { dx: dx / norm, dy: dy / norm };
}
export function fireAction(s, aimX, aimY) {
  if (s.phase !== "playing" || s.fireCooldown > 0) return false;
  const direction = aimAt(s, aimX, aimY);
  const powered = s.powerRemaining > 0;
  const bearing = Math.atan2(direction.dy, direction.dx);
  for (const spread of powered ? [-0.13, 0, 0.13] : [0]) {
    const dx = Math.cos(bearing + spread),
      dy = Math.sin(bearing + spread);
    s.projectiles.push({
      id: id(s, "shot"),
      owner: "player",
      x: s.x + dx * 2,
      y: s.y + dy * 2,
      vx: dx * 76,
      vy: dy * 76,
      radius: powered ? 1.5 : 1.05,
      damage: powered ? 2 : 1,
      ttl: 2.4,
      powered,
    });
  }
  s.fireCooldown = powered ? 0.13 : 0.19;
  effect(s, "shot", s.x, s.y, powered ? 5 : 3, 0.13);
  return true;
}
export function dodgeAction(s, dx = 0, dy = 0) {
  if (s.phase !== "playing" || s.dodge.cooldown > 0) return false;
  dx = Number(dx) || 0;
  dy = Number(dy) || 0;
  let norm = Math.hypot(dx, dy);
  if (norm < 0.01) {
    dx = s.lastMove.dx;
    dy = s.lastMove.dy;
    norm = Math.hypot(dx, dy) || 1;
  }
  s.dodge = { remaining: 0.25, cooldown: 1.15, dx: dx / norm, dy: dy / norm };
  effect(s, "dodge", s.x, s.y, 10, 0.3);
  return true;
}

function spawnEnemy(s) {
  if (s.enemies.length >= 7) return;
  const config = ACTION_REGIONS[s.region];
  let point;
  for (let tries = 0; tries < 16; tries++) {
    const edge = Math.floor(random(s) * 4),
      value = random(s);
    point =
      edge === 0
        ? { x: 13 + value * 174, y: 32 }
        : edge === 1
          ? { x: 188, y: 33 + value * 56 }
          : edge === 2
            ? { x: 13 + value * 174, y: 90 }
            : { x: 12, y: 33 + value * 56 };
    if (distance(s, point) > 30 && distance(s.beacon, point) > 24) break;
  }
  if (s.regionTime < 0.01 && s.enemies.length < 2)
    point = s.enemies.length === 0 ? { x: 137, y: 75 } : { x: 63, y: 58 };
  if (distance(s, point) < 24) return;
  const kind =
    config.enemyKinds[Math.floor(random(s) * config.enemyKinds.length)];
  s.enemies.push({
    id: id(s, "enemy"),
    kind,
    ...point,
    hp: s.index >= 4 ? 3 : 2,
    radius: 2.8,
    mode: "approach",
    timer: 0.7 + random(s),
    cooldown: 0,
    contactCooldown: 0,
    telegraph: null,
    vx: 0,
    vy: 0,
    targetsBeacon: random(s) < 0.55,
    orbit: random(s) * Math.PI * 2,
  });
}
function spawnGuardian(s) {
  if (s.guardianSpawned || s.guardianDefeated) return;
  s.guardianSpawned = true;
  const x = s.x < 100 ? 157 : 43,
    y = 44;
  s.enemies.push({
    id: id(s, "guardian"),
    kind: "guardian",
    elite: true,
    x,
    y,
    hp: 24,
    maxHp: 24,
    radius: 5.5,
    mode: "approach",
    timer: 0.45,
    contactCooldown: 0,
    telegraph: null,
    vx: 0,
    vy: 0,
    targetsBeacon: false,
    orbit: 0,
    attackPhase: "fan",
  });
  effect(s, "guardian-arrival", x, y, 42, 1.5);
  s.message =
    "A shadow guardian approaches. Dodge its marked attacks and break it with light to open the route.";
}
function hostileShot(s, e, dx, dy, speed = 21) {
  s.projectiles.push({
    id: id(s, "hostile"),
    owner: "enemy",
    x: e.x + dx * 3.4,
    y: e.y + dy * 3.4,
    vx: dx * speed,
    vy: dy * speed,
    radius: e.elite ? 1.5 : 1.1,
    damage: e.elite ? 13 : 9,
    ttl: 5,
    powered: false,
  });
}
function cast(s, e) {
  const t = e.telegraph;
  const dx = t.targetX - e.x,
    dy = t.targetY - e.y,
    angle = Math.atan2(dy, dx);
  if (e.elite && e.attackPhase === "fan") {
    for (const offset of [-0.44, -0.22, 0, 0.22, 0.44])
      hostileShot(s, e, Math.cos(angle + offset), Math.sin(angle + offset), 25);
    e.attackPhase = "charge";
    e.mode = "approach";
    e.timer = 1.4;
  } else if (e.elite) {
    e.vx = Math.cos(angle) * 33;
    e.vy = Math.sin(angle) * 33;
    e.mode = "charge";
    e.timer = 0.85;
    e.attackPhase = "fan";
  } else if (CHARGERS.has(e.kind)) {
    const speed =
      {
        stalker: 28,
        "tram-shadow": 37,
        skimmer: 32,
        "frost-stalker": 24,
        burrower: 34,
        "meteor-shadow": 31,
      }[e.kind] || 28;
    e.vx = Math.cos(angle) * speed;
    e.vy = Math.sin(angle) * speed;
    e.mode = "charge";
    e.timer =
      e.kind === "tram-shadow"
        ? 0.65
        : e.kind === "frost-stalker"
          ? 0.75
          : 0.55;
  } else {
    const offsets =
      e.kind === "thicket"
        ? [-0.16, 0, 0.16]
        : e.kind === "ice-shard"
          ? [-0.42, 0, 0.42]
          : e.kind === "sand-caster"
            ? [-0.27, 0.27]
            : e.kind === "orbiter"
              ? [-0.3, 0, 0.3]
              : e.kind === "tide-caster"
                ? [-0.18, 0.18]
                : [0];
    for (const offset of offsets)
      hostileShot(
        s,
        e,
        Math.cos(angle + offset),
        Math.sin(angle + offset),
        e.kind === "ice-shard" ? 18 : 22,
      );
    e.mode = "approach";
    e.timer = 2.1 + random(s) * 0.6;
  }
  e.telegraph = null;
}
function hurtPlayer(s, damage) {
  if (s.dodge.remaining > 0 || s.hitCooldown > 0) return false;
  s.hp = Math.max(0, s.hp - damage);
  s.hitCooldown = 0.48;
  effect(s, "hurt", s.x, s.y, 9, 0.35);
  return true;
}
function updateEnemies(s, dt) {
  for (const e of s.enemies) {
    e.timer -= dt;
    e.contactCooldown = Math.max(0, e.contactCooldown - dt);
    const target = s.stage === "defend" && e.targetsBeacon ? s.beacon : s;
    if (e.mode === "windup") {
      e.telegraph.remaining = Math.max(0, e.timer);
      if (e.timer <= 0) cast(s, e);
    } else if (e.mode === "charge") {
      e.x = clamp(e.x + e.vx * dt, bounds.minX, bounds.maxX);
      e.y = clamp(e.y + e.vy * dt, bounds.minY, bounds.maxY);
      if (e.timer <= 0) {
        e.mode = "approach";
        e.timer = e.elite ? 1.4 : 1.6;
      }
    } else {
      let dx = target.x - e.x,
        dy = target.y - e.y,
        d = Math.hypot(dx, dy) || 1;
      if (e.kind === "orbiter") {
        e.orbit += dt * 0.9;
        dx += Math.cos(e.orbit) * 16;
        dy += Math.sin(e.orbit) * 9;
        d = Math.hypot(dx, dy) || 1;
      }
      const desired = e.elite ? 22 : CHARGERS.has(e.kind) ? 13 : 28;
      if (d > desired) {
        const speed = e.elite ? 9.5 : e.kind === "burrower" ? 9 : 7.5;
        e.x += (dx / d) * speed * dt;
        e.y += (dy / d) * speed * dt;
      }
      if (e.timer <= 0 && d < 60) {
        const total = e.elite ? 0.9 : e.kind === "burrower" ? 0.9 : 0.7;
        e.mode = "windup";
        e.timer = total;
        e.telegraph = {
          kind: e.elite
            ? e.attackPhase === "charge"
              ? "ray"
              : "ring"
            : CHARGERS.has(e.kind)
              ? "ray"
              : e.kind === "ice-shard" || e.kind === "orbiter"
                ? "ring"
                : "circle",
          x: e.x,
          y: e.y,
          targetX: target.x,
          targetY: target.y,
          radius: e.elite ? 10 : CHARGERS.has(e.kind) ? 4 : 7,
          remaining: total,
          total,
        };
      }
    }
    if (distance(s, e) < e.radius + 1.7 && e.contactCooldown <= 0) {
      hurtPlayer(
        s,
        e.elite
          ? e.mode === "charge"
            ? 20
            : 10
          : e.mode === "charge"
            ? 13
            : 6,
      );
      e.contactCooldown = 0.8;
    }
    if (
      s.stage === "defend" &&
      distance(s.beacon, e) < 5 &&
      e.contactCooldown <= 0
    ) {
      s.beacon.hp = Math.max(0, s.beacon.hp - 8);
      e.contactCooldown = 1;
      effect(s, "beacon-hit", s.beacon.x, s.beacon.y, 11);
    }
  }
}
function updateProjectiles(s, dt) {
  for (const p of s.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ttl -= dt;
    if (p.owner === "player") {
      const e = s.enemies.find(
        (e) => e.hp > 0 && distance(e, p) < e.radius + p.radius,
      );
      if (e) {
        e.hp -= p.damage;
        p.ttl = 0;
        effect(s, "hit", e.x, e.y, 7, 0.3);
      }
    } else {
      if (distance(s, p) < p.radius + 1.7) {
        hurtPlayer(s, p.damage);
        p.ttl = 0;
      } else if (s.stage === "defend" && distance(s.beacon, p) < 4) {
        s.beacon.hp = Math.max(0, s.beacon.hp - 5);
        p.ttl = 0;
        effect(s, "beacon-hit", s.beacon.x, s.beacon.y, 10);
      }
    }
  }
  const defeated = s.enemies.filter((e) => e.hp <= 0);
  for (const e of defeated) {
    s.kills++;
    effect(s, "burst", e.x, e.y, e.elite ? 40 : 12, e.elite ? 1.3 : 0.55);
    if (e.elite) {
      s.guardianDefeated = true;
      effect(s, "guardian-defeated", e.x, e.y, 60, 1.5);
      s.pickups.push({
        id: id(s, "pickup"),
        kind: "health",
        x: e.x,
        y: e.y,
        radius: 4,
      });
    }
    if (s.kills % 4 === 0)
      s.pickups.push({
        id: id(s, "pickup"),
        kind: s.kills % 8 === 0 ? "power" : "health",
        x: e.x,
        y: e.y,
        radius: 3,
      });
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  s.projectiles = s.projectiles
    .filter((p) => p.ttl > 0 && p.x > 0 && p.x < 200 && p.y > 25 && p.y < 100)
    .slice(-180);
}
function updateSurvivors(s, dt) {
  let order = 0;
  for (const v of s.survivors) {
    if (v.status === "stranded" && distance(s, v) <= 7) {
      v.status = "following";
      v.followOrder = ++order;
      effect(s, "found", v.x, v.y, 13, 0.6);
    }
    if (v.status === "following") {
      const dx = s.x - v.x,
        dy = s.y - v.y,
        d = Math.hypot(dx, dy);
      const stop = 3 + v.followOrder * 1.1;
      if (d > stop) {
        const move = Math.min(d - stop, 24 * dt);
        v.x += (dx / d) * move;
        v.y += (dy / d) * move;
      }
      if (
        distance(v, s.beacon) <= s.beacon.radius &&
        distance(s, s.beacon) <= s.beacon.radius + 2
      ) {
        v.status = "safe";
        v.x = s.beacon.x + (s.rescued - 1) * 4;
        v.y = s.beacon.y + 4;
        s.rescued++;
        s.totalRescued++;
        s.hp = Math.min(100, s.hp + 12);
        effect(s, "rescue", s.beacon.x, s.beacon.y, 38, 1.1);
        s.pickups.push({
          id: id(s, "pickup"),
          kind: "health",
          x: s.beacon.x + 6,
          y: s.beacon.y + 8,
          radius: 3,
        });
      }
    }
  }
  if (s.rescued === 3 && s.stage === "rescue") {
    s.stage = "defend";
    s.spawnClock = 0.7;
    s.message =
      "All three survivors are safe. Protect the beacon while its rescue signal charges.";
    effect(s, "defend", s.beacon.x, s.beacon.y, 55, 1.2);
  }
}
function updatePickups(s) {
  s.pickups = s.pickups.filter((p) => {
    if (distance(s, p) > p.radius + 1.5) return true;
    if (p.kind === "health") s.hp = Math.min(100, s.hp + 25);
    else s.powerRemaining = 8;
    effect(s, "pickup", p.x, p.y, 14, 0.45);
    return false;
  });
}
function tick(s, input, dt) {
  s.time += dt;
  s.regionTime += dt;
  s.fireCooldown = Math.max(0, s.fireCooldown - dt);
  s.powerRemaining = Math.max(0, s.powerRemaining - dt);
  s.hitCooldown = Math.max(0, s.hitCooldown - dt);
  const burst = Math.min(dt, s.dodge.remaining);
  s.dodge.remaining = Math.max(0, s.dodge.remaining - dt);
  s.dodge.cooldown = Math.max(0, s.dodge.cooldown - dt);
  let dx = clamp(Number(input.dx) || 0, -1, 1),
    dy = clamp(Number(input.dy) || 0, -1, 1),
    norm = Math.max(1, Math.hypot(dx, dy));
  if (Math.hypot(dx, dy) > 0.05) s.lastMove = { dx: dx / norm, dy: dy / norm };
  s.x = clamp(
    s.x + (dx / norm) * 21 * (dt - burst) + s.dodge.dx * 54 * burst,
    bounds.minX,
    bounds.maxX,
  );
  s.y = clamp(
    s.y + (dy / norm) * 21 * (dt - burst) + s.dodge.dy * 54 * burst,
    bounds.minY,
    bounds.maxY,
  );
  if (Number.isFinite(input.aimX) && Number.isFinite(input.aimY))
    aimAt(s, input.aimX, input.aimY);
  if (input.fire) fireAction(s, input.aimX, input.aimY);
  s.spawnClock -= dt;
  if (s.spawnClock <= 0) {
    spawnEnemy(s);
    s.spawnClock =
      s.stage === "defend" ? Math.max(1.25, 1.85 - s.index * 0.1) : 3.8;
  }
  if (
    s.stage === "defend" &&
    s.defenseRemaining < 10 &&
    !s.guardianSpawned &&
    !s.guardianDefeated
  )
    spawnGuardian(s);
  updateEnemies(s, dt);
  updateProjectiles(s, dt);
  updateSurvivors(s, dt);
  updatePickups(s);
  for (const e of s.effects) e.ttl -= dt;
  s.effects = s.effects.filter((e) => e.ttl > 0);
  if (s.hp <= 0 || s.beacon.hp <= 0) {
    s.phase = "lost";
    s.message =
      s.hp <= 0
        ? "The courier is down. Retry this region; your restored beacons remain safe."
        : "The beacon went dark. Retry this defense with a fresh rescue team.";
  } else if (s.stage === "defend") {
    s.defenseRemaining = Math.max(0, s.defenseRemaining - dt);
    if (s.defenseRemaining <= 0 && !s.guardianDefeated)
      s.message =
        "Defeat the guardian to open the route. The beacon is charged; keep firing and dodge its marked attacks.";
    if (s.defenseRemaining <= 0 && s.guardianDefeated) {
      s.stage = "restored";
      s.completed.push(s.region);
      s.enemies = [];
      s.projectiles = [];
      s.phase = s.index === ACTION_ORDER.length - 1 ? "won" : "region-complete";
      s.message =
        s.phase === "won"
          ? "Six beacons connected. All eighteen survivors are home. The rescue signal reaches every world."
          : `${ACTION_REGIONS[s.region].name} is safe. Follow the rescue signal to the next world.`;
      effect(s, "restore", s.beacon.x, s.beacon.y, 120, 2);
    }
  } else
    s.message = `${s.rescued}/3 survivors home. Find the glowing survivors, let them follow, then return to the beacon.`;
}
export function updateAction(s, input = {}, dt = 0) {
  if (s.phase !== "playing") return s;
  const elapsed = clamp(Number(dt) || 0, 0, 0.25);
  const steps = Math.max(1, Math.ceil(elapsed / 0.025));
  for (let i = 0; i < steps && s.phase === "playing"; i++)
    tick(s, input, elapsed / steps);
  return s;
}

export function serializeAction(s) {
  return JSON.stringify(s);
}
export function restoreAction(raw) {
  try {
    const saved = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      !saved ||
      saved.version !== 1 ||
      saved.mode !== "action" ||
      !ACTION_ORDER.includes(saved.region) ||
      !Array.isArray(saved.completed)
    )
      return null;
    const index = ACTION_ORDER.indexOf(saved.region);
    const completed = saved.completed;
    const expected = saved.stage === "restored" ? index + 1 : index;
    if (completed.length !== expected) return null;
    if (
      completed.some((r, i) => r !== ACTION_ORDER[i]) ||
      completed.length > index + 1
    )
      return null;
    if (
      ![
        "ready",
        "playing",
        "paused",
        "lost",
        "region-complete",
        "won",
      ].includes(saved.phase)
    )
      return null;
    if (
      !Number.isFinite(saved.time) ||
      saved.time < 0 ||
      !Number.isFinite(saved.hp) ||
      !Number.isFinite(saved.x) ||
      !Number.isFinite(saved.y)
    )
      return null;
    if (!Array.isArray(saved.survivors) || saved.survivors.length !== 3)
      return null;
    const s = createActionGame(saved.seed);
    makeRegion(s, saved.region);
    if (
      ["region-complete", "won"].includes(saved.phase) !==
      (saved.stage === "restored")
    )
      return null;
    if (
      (saved.phase === "won" && index !== 5) ||
      (saved.phase === "region-complete" && index === 5)
    )
      return null;
    s.rngState =
      Number.isInteger(saved.rngState) &&
      saved.rngState >= 0 &&
      saved.rngState <= 4294967295
        ? saved.rngState
        : s.rngState;
    s.nextId =
      Number.isInteger(saved.nextId) && saved.nextId >= 0 && saved.nextId <= 1e9
        ? Math.max(s.nextId, saved.nextId)
        : s.nextId;
    s.completed = [...completed];
    s.time = saved.time;
    s.regionTime =
      Number.isFinite(saved.regionTime) && saved.regionTime >= 0
        ? saved.regionTime
        : 0;
    s.kills = Number.isFinite(saved.kills)
      ? Math.max(0, Math.floor(saved.kills))
      : 0;
    s.totalRescued = completed.length * 3;
    for (let i = 0; i < 3; i++) {
      const v = saved.survivors[i];
      if (
        v.id !== s.survivors[i].id ||
        !["stranded", "following", "safe"].includes(v.status) ||
        !Number.isFinite(v.x) ||
        !Number.isFinite(v.y)
      )
        return null;
      s.survivors[i] = {
        ...s.survivors[i],
        x: clamp(v.x, 10, 190),
        y: clamp(v.y, 30, 92),
        status: v.status,
        followOrder: i + 1,
      };
    }
    s.rescued = s.survivors.filter((v) => v.status === "safe").length;
    s.totalRescued = Math.min(
      18,
      s.completed.length * 3 + (s.completed.includes(s.region) ? 0 : s.rescued),
    );
    s.x = clamp(saved.x, 10, 190);
    s.y = clamp(saved.y, 30, 92);
    s.hp = saved.phase === "lost" ? 0 : clamp(saved.hp, 0, 100);
    s.beacon.hp = Number.isFinite(saved.beacon?.hp)
      ? clamp(saved.beacon.hp, 0, 100)
      : 100;
    if (
      (saved.stage === "defend" && s.rescued !== 3) ||
      (saved.stage === "rescue" && s.rescued === 3)
    )
      return null;
    if (!["rescue", "defend", "restored"].includes(saved.stage)) return null;
    if (
      saved.stage === "restored" &&
      (!s.completed.includes(s.region) ||
        s.rescued !== 3 ||
        s.hp <= 0 ||
        s.beacon.hp <= 0 ||
        saved.guardianDefeated !== true)
    )
      return null;
    if (saved.guardianDefeated === true && saved.guardianSpawned !== true)
      return null;
    s.guardianDefeated = saved.guardianDefeated === true;
    s.guardianSpawned = s.guardianDefeated; // An undefeated saved guardian is rebuilt on deliberate resume.
    s.stage = saved.stage;
    s.defenseRemaining = Number.isFinite(saved.defenseRemaining)
      ? clamp(saved.defenseRemaining, 0, 18)
      : 18;
    if (s.stage === "restored")
      s.phase = index === 5 ? "won" : "region-complete";
    else
      s.phase =
        saved.phase === "lost" || s.hp <= 0 || s.beacon.hp <= 0
          ? "lost"
          : "ready";
    s.message =
      s.phase === "ready"
        ? "Rescue saved. Begin deliberately to continue from this position."
        : saved.message || "Restored rescue progress loaded.";
    return s;
  } catch {
    return null;
  }
}
