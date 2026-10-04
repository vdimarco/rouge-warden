export const COURSE_LENGTH = 14800;
export const RUN_SECONDS = 120;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const emptyInput = () => ({ left: false, right: false, reach: false, unlock: false });

export function createGame(seed = Date.now()) {
  let n = seed >>> 0;
  const random = () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
  const rocks = [{ x: 445, d: 580, radius: 52, hit: false }];
  for (let d = 1350; d < COURSE_LENGTH - 650; d += 390 + random() * 300) {
    rocks.push({ x: 300 + random() * 420, d, radius: 40 + random() * 16, hit: false });
    if (random() > 0.65) rocks.push({ x: 650 + random() * 80, d: d + 200, radius: 44, hit: false });
  }
  return {
    phase: 'playing', time: 0, distance: 0, x: 500, vx: 0, balance: 100,
    reach: 0, wasReaching: false, hasKey: false, unlocked: false, unlockProgress: 0,
    falls: 0, falling: 0, cooldown: 0, collisions: 0, missed: 0,
    rivalDistance: 210, rivalX: 650, rivalBump: 0, rocks,
    keys: Array.from({ length: 7 }, (_, i) => ({ x: [390, 630, 470, 680, 340, 570, 400][i], d: 980 + i * 1750, consumed: false })),
    hint: 'Find the golden key. A / D to steer.', hintUntil: 5,
    event: null, eventId: 0, score: 0, reason: '',
  };
}

function announce(g, hint, event = null, seconds = 3) {
  g.hint = hint; g.hintUntil = g.time + seconds;
  if (event) { g.event = event; g.eventId++; }
}

export function nearestKey(g) {
  return g.keys.find(k => !k.consumed && k.d >= g.distance - 150) || null;
}

export function releaseReach(g) {
  if (!g.wasReaching || g.hasKey || g.falling) { g.reach = 0; g.wasReaching = false; return; }
  const key = nearestKey(g);
  if (key && Math.abs(key.d - g.distance) < 125 && Math.abs(key.x - g.x) < 120 && g.reach >= 0.18 && g.reach <= 2.3) {
    key.consumed = true; g.hasKey = true; g.score += 300;
    announce(g, 'Key caught! Hold E for 2 seconds to unlock.', 'key', 5);
  } else {
    g.balance = clamp(g.balance - 8, 0, 100);
    announce(g, key && Math.abs(key.d - g.distance) < 180 ? 'Get closer to the key before releasing.' : 'Too early! Reach as the key meets your raft.', 'miss');
  }
  g.reach = 0; g.wasReaching = false;
}

export function updateGame(g, input, dt) {
  if (g.phase !== 'playing') return g;
  dt = clamp(dt, 0, 0.05);
  g.time += dt;
  g.cooldown = Math.max(0, g.cooldown - dt);
  g.rivalBump = Math.max(0, g.rivalBump - dt);
  if (!input.reach && g.wasReaching) releaseReach(g);
  const reaching = input.reach && !g.hasKey && !g.falling;
  if (reaching) { g.reach += dt; g.wasReaching = true; }
  const opening = input.unlock && g.hasKey && !g.unlocked && !g.falling;
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const flow = Math.sin(g.distance / 530) * 13;
  const targetVX = direction * (reaching ? 82 : opening ? 120 : 290) + flow;
  g.vx += (targetVX - g.vx) * Math.min(1, dt * 7);
  if (g.falling > 0) {
    g.falling = Math.max(0, g.falling - dt);
    g.vx *= 0.92;
    if (!g.falling) { g.balance = 65; g.cooldown = 2; announce(g, 'Back aboard! Stay in the current.', 'recover'); }
  }
  g.x = clamp(g.x + g.vx * dt, 245, 755);
  let speed = g.x < 365 ? 131 : g.x > 630 ? 169 : 147;
  if (reaching) speed *= 0.82;
  if (opening) speed *= 0.65;
  if (g.falling) speed *= 0.2;
  g.distance += speed * dt;
  g.rivalDistance += (140 + Math.sin(g.time / 7) * 7) * dt;
  g.rivalX = 525 + Math.sin(g.time / 3.7) * 145;
  if (!g.falling) {
    const drain = reaching ? 11 + g.reach * 5 : opening ? 4 : g.x > 630 ? 1 : -5;
    g.balance = clamp(g.balance - drain * dt, 0, 100);
    for (const rock of g.rocks) {
      if (!rock.hit && Math.abs(rock.d - g.distance) < 45 && Math.abs(rock.x - g.x) < rock.radius + 24 && !g.cooldown) {
        rock.hit = true; g.balance = clamp(g.balance - 34, 0, 100); g.cooldown = 1.15; g.collisions++;
        g.vx = g.x < rock.x ? -190 : 190;
        g.distance = Math.max(0, g.distance - 60);
        announce(g, 'Rock hit! Steady the raft.', 'hit');
      }
    }
    if (Math.abs(g.rivalDistance - g.distance) < 60 && Math.abs(g.rivalX - g.x) < 65 && !g.rivalBump) {
      g.balance = clamp(g.balance - 18, 0, 100); g.rivalBump = 4;
      announce(g, 'Your rival bumped the raft!', 'hit');
    }
    if (g.balance <= 0) {
      g.falling = 2.6; g.falls++; g.reach = 0; g.wasReaching = false;
      announce(g, 'Overboard! Climbing back on the rope…', 'fall');
    }
  }
  if (opening) {
    g.unlockProgress = Math.min(1, g.unlockProgress + dt / 2);
    if (g.unlockProgress >= 1) { g.unlocked = true; g.score += 700; announce(g, 'Treasure claimed! Pass your rival and escape left.', 'chest', 5); }
  } else if (!g.unlocked) g.unlockProgress = Math.max(0, g.unlockProgress - dt * 0.18);
  for (const key of g.keys) {
    if (!key.consumed && key.d < g.distance - 150) {
      key.consumed = true;
      if (!g.hasKey) { g.missed++; announce(g, 'Key missed. Another hangs farther downstream.', 'miss', 4); }
    }
  }
  if (g.distance > COURSE_LENGTH - 950 && g.hintUntil < g.time) announce(g, 'Escape channel on the LEFT! Steer toward the flags.', null, 6);
  if (g.time >= RUN_SECONDS) finish(g, false, 'The waterfall caught up with you.');
  else if (g.distance >= COURSE_LENGTH) {
    if (g.x < 275 || g.x > 435) finish(g, false, 'You missed the escape channel. Aim for the left flags.');
    else if (!g.unlocked) finish(g, false, g.hasKey ? 'You escaped, but the treasure stayed locked.' : 'You escaped without the golden key.');
    else if (g.rivalDistance >= COURSE_LENGTH) finish(g, false, 'Your rival reached the escape first. Take the fast current.');
    else finish(g, true, 'The treasure is yours. The river is behind you.');
  }
  return g;
}

function finish(g, win, reason) {
  g.phase = win ? 'won' : 'lost'; g.reason = reason;
  if (win) g.score += Math.round((RUN_SECONDS - g.time) * 25 + Math.max(0, 100 - g.collisions * 10) * 5);
  g.event = win ? 'win' : 'lose'; g.eventId++;
}

export function snapshot(g) {
  const k = nearestKey(g);
  const near = !g.hasKey && k && Math.abs(k.d - g.distance) < 125 && Math.abs(k.x - g.x) < 120;
  return {
    phase: g.phase, remaining: Math.max(0, RUN_SECONDS - g.time), progress: Math.min(1, g.distance / COURSE_LENGTH),
    balance: Math.round(g.balance), hasKey: g.hasKey, unlocked: g.unlocked, unlockProgress: g.unlockProgress,
    reaching: g.wasReaching, reach: g.reach, nearKey: !!near, falling: g.falling > 0, falls: g.falls,
    hint: g.hintUntil > g.time ? g.hint : '', score: g.score, reason: g.reason,
    lead: Math.round(g.distance - g.rivalDistance), fast: g.x > 630, time: g.time,
  };
}
