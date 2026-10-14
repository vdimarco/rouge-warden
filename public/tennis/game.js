// Lawn Tennis at the Cottage. Clean-room canvas prototype.
// Numbers follow the cottage spec. No code or art from the unlicensed inspiration.

export const RULES = Object.freeze({
  gravity: 8,
  bounce: 0.75,
  serveCasual: 9,
  servePro: 13,
  rallyMin: 8,
  rallyMax: 14,
  windowIntro: 0.25,
  windowCasual: 0.16,
  windowPro: 0.11,
  errorCasual: 0.3,
  errorPro: 0.12,
  reactCasual: 0.35,
  reactPro: 0.18,
  assistCasual: 0.7,
  assistPro: 0.9,
  pointsToWin: 7,
  winBy: 2,
});

const DT = 1 / 60;
const G = RULES.gravity;
const BOUNCE = RULES.bounce;
const BALL_R = 0.12;
const NET_H = 0.92;
const HALF_W = 3.5;
const BASE = 7.7;
const RUN = 4.6;
const GROUND_KEEP = 0.8;
const AWARD = 3;
const FLOWER_POP = 0.2;
const FLOWER_WILT = 0.3;
const KINDS = ['daisy', 'poppy', 'lupin'];

export function readOptions(search) {
  const q = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const seedRaw = Number(q.get('seed'));
  const ai = q.get('ai') === 'pro' ? 'pro' : 'casual';
  return {
    seed: Number.isFinite(seedRaw) ? seedRaw | 0 : 1,
    ai,
    fast: q.get('fast') === '1',
  };
}

function mulberry32(seed) {
  let a = seed | 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function createBall(partial) {
  return {
    x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0,
    ...partial,
  };
}

function integrate(ball, dt) {
  const prev = { x: ball.x, y: ball.y, z: ball.z, vz: ball.vz };
  ball.vz -= G * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;
  let bounced = false;
  if (ball.z <= BALL_R && ball.vz <= 0) {
    const falling = prev.z > BALL_R + 1e-4;
    ball.z = BALL_R;
    if (falling) {
      bounced = true;
      ball.vz = -prev.vz * BOUNCE;
      if (ball.vz < 0.55) ball.vz = 0;
      ball.vx *= GROUND_KEEP;
      ball.vy *= GROUND_KEEP;
    } else {
      ball.vz = 0;
    }
  }
  let net = false;
  if ((prev.y > 0 && ball.y <= 0) || (prev.y < 0 && ball.y >= 0)) {
    const denom = ball.y - prev.y || 1e-6;
    const t = clamp((0 - prev.y) / denom, 0, 1);
    const zCross = prev.z + (ball.z - prev.z) * t;
    if (zCross < NET_H + BALL_R) net = true;
  }
  return { prev, bounced, net };
}

function pace(ball) {
  return Math.hypot(ball.vx, ball.vy);
}

export function createMatch(options = {}) {
  const seed = options.seed == null ? 1 : options.seed | 0;
  const ai = options.ai === 'pro' ? 'pro' : 'casual';
  const fast = !!options.fast;
  const rng = mulberry32(seed);

  const ball = createBall({});
  const flowers = { you: [], neighbour: [] };
  const you = { x: 0, y: 6.45, pose: 'ready', poseT: 0 };
  const neighbour = { x: 0, y: -6.45, pose: 'ready', poseT: 0 };
  const score = { you: 0, neighbour: 0 };

  let frame = 0;
  let time = 0;
  let point = 1;
  let phase = 'rally';
  let rally = 0;
  let yourHits = 0;
  let yourHitsPoint = 0;
  let neighbourReturns = 0;
  let aiChances = 0;
  let lastHitter = 'neighbour';
  let bounceRun = 0;
  let lastBounceSide = null;
  let awardT = 0;
  let restT = 0;
  let events = [];
  let lastBloom = null;
  let lastHit = null;
  let lastMiss = null;
  let lastServePace = 0;
  let steer = null;
  let nbVisit = false;
  let aiLetPass = false;

  const youSlot = blankSlot();
  const nbSlot = blankSlot();

  function blankSlot() {
    return { open: false, hit: false, frozen: false, locked: false, contactAt: 0, timing: null, landX: 0, landY: 0 };
  }
  function resetSlot(slot) {
    slot.open = false;
    slot.hit = false;
    slot.frozen = false;
    slot.locked = false;
    slot.timing = null;
  }

  // Opening lob, already in the air. Tuned so the strike bounce is near 4 seconds.
  ball.x = 0;
  ball.y = -4;
  ball.z = 3;
  ball.vx = 0.02;
  ball.vy = 3;
  ball.vz = 6.56;

  function errorRate() {
    const base = ai === 'pro' ? RULES.errorPro : RULES.errorCasual;
    return Math.max(0.08, base * (1 - 0.05 * score.you));
  }
  function reaction() {
    const base = ai === 'pro' ? RULES.reactPro : RULES.reactCasual;
    return Math.max(RULES.reactPro, base - 0.02 * score.you);
  }
  function playerWindow() {
    if (yourHits < 3) return RULES.windowIntro;
    return ai === 'pro' ? RULES.windowPro : RULES.windowCasual;
  }
  function assistSpeed() {
    return RUN * (ai === 'pro' ? RULES.assistPro : RULES.assistCasual);
  }

  function other(side) { return side === 'you' ? 'neighbour' : 'you'; }

  function addFlower(side) {
    const list = flowers[side];
    const flower = {
      kind: KINDS[list.length % 3],
      x: -2.8 + (list.length % 8) * 0.8,
      row: Math.floor(list.length / 8),
      age: 0,
      wilting: false,
      wilt: 0,
      born: frame,
    };
    list.push(flower);
    lastBloom = { side, frame, index: list.length - 1, kind: flower.kind };
    events.push({ type: 'bloom', side, frame, count: list.length, kind: flower.kind });
  }

  function sendBall(fromSide, tx, ty, flight) {
    const z = clamp(Math.max(ball.z, 0.55), 0.55, 1.5);
    ball.z = z;
    const tz = BALL_R;
    let T = flight;
    for (let k = 0; k < 5; k++) {
      ball.vx = (tx - ball.x) / T;
      ball.vy = (ty - ball.y) / T;
      ball.vz = (tz - z) / T + 0.5 * G * T;
      if (clearsNet(T)) break;
      T += 0.08;
    }
    bounceRun = 0;
    lastBounceSide = null;
    return pace(ball);
  }

  function clearsNet() {
    const ghost = { ...ball };
    const heading = Math.sign(ghost.vy) || (ghost.y > 0 ? -1 : 1);
    if (Math.sign(ghost.y) === heading) return true;
    for (let i = 0; i < 180; i++) {
      const prevY = ghost.y;
      const prevZ = ghost.z;
      ghost.vz -= G * DT;
      ghost.x += ghost.vx * DT;
      ghost.y += ghost.vy * DT;
      ghost.z += ghost.vz * DT;
      if ((prevY > 0 && ghost.y <= 0) || (prevY < 0 && ghost.y >= 0)) {
        const t = clamp((0 - prevY) / ((ghost.y - prevY) || 1e-6), 0, 1);
        const zCross = prevZ + (ghost.z - prevZ) * t;
        return zCross >= NET_H + BALL_R + 0.05;
      }
      if (ghost.z <= BALL_R) return Math.sign(ghost.y) !== Math.sign(heading) ? false : true;
    }
    return true;
  }

  function aimTarget(side, kind, dir, timing) {
    const sign = side === 'you' ? -1 : 1;
    const depth = kind === 'lob' ? 7.05 : kind === 'smash' ? 5.7 : 6.35;
    const hitter = side === 'you' ? you : neighbour;
    let x = 0;
    if (dir === -1 || dir === 1) {
      const wide = timing < 0.38 ? 2.7 : timing > 0.62 ? 1.45 : 2.15;
      x = dir * wide;
    } else if (timing < 0.38) {
      x = -Math.sign(hitter.x || 1) * 2.45;
    } else if (timing > 0.62) {
      x = Math.sign(hitter.x || 1) * 2.2;
    }
    return { x: clamp(x, -3.1, 3.1), y: sign * depth };
  }

  function flightFor(kind, target) {
    const dist = Math.hypot(target.x - ball.x, target.y - ball.y);
    // Point 1 is the slow teaching lob so the opening beats have room. Later shots use the rally band.
    let speed = point === 1 ? 5.05 : 11;
    if (point > 1 && kind === 'lob') speed = 8.3;
    if (point > 1 && kind === 'smash') speed = 13.6;
    if (point === 1 && kind === 'smash') speed = 8.2;
    return Math.max(0.55, dist / speed);
  }

  function resolveHit(side, kind, dir, timing, override) {
    const target = override || aimTarget(side, kind, dir, timing);
    const shotPace = sendBall(side, target.x, target.y, override && override.flight ? override.flight : flightFor(kind, target));
    lastHitter = side;
    rally += 1;
    if (side === 'you') {
      yourHits += 1;
      yourHitsPoint += 1;
      you.pose = 'swing';
      you.poseT = 0.22;
      youSlot.hit = true;
      resetSlot(nbSlot);
    } else {
      neighbourReturns += 1;
      neighbour.pose = 'swing';
      neighbour.poseT = 0.22;
      nbSlot.hit = true;
      resetSlot(youSlot);
    }
    addFlower(side);
    lastHit = { side, frame, kind, rally, pace: shotPace };
    events.push({ type: 'hit', side, frame, kind, rally, pace: shotPace });
    refreshSlots();
  }

  function endPoint(winner) {
    if (phase !== 'rally') return;
    phase = 'award';
    awardT = 0;
    score[winner] += 1;
    const loser = other(winner);
    for (const f of flowers[loser]) {
      f.wilting = true;
      f.wilt = FLOWER_WILT;
    }
    lastMiss = {
      point,
      scripted: point === 1 && !!aiLetPass,
      aiChances,
      neighbourReturns,
      winner,
    };
    events.push({ type: 'point', winner, frame, point, scripted: lastMiss.scripted, rally });
    if (winner === 'you') {
      neighbour.pose = 'huff';
      neighbour.poseT = 0.8;
    } else {
      you.pose = 'ready';
    }
    youSlot.open = false;
    nbSlot.open = false;
  }

  function startNextPoint() {
    point += 1;
    rally = 0;
    yourHitsPoint = 0;
    neighbourReturns = 0;
    aiChances = 0;
    aiLetPass = false;
    nbVisit = false;
    phase = 'rally';
    resetSlot(youSlot);
    resetSlot(nbSlot);
    const speed = ai === 'pro' ? RULES.servePro : RULES.serveCasual;
    const tx = (rng() * 2 - 1) * 1.5;
    const ty = 6.35;
    const x = (rng() * 2 - 1) * 0.35;
    const y = -6.5;
    const z = 1.25;
    const dist = Math.hypot(tx - x, ty - y);
    const T = dist / speed;
    ball.x = x;
    ball.y = y;
    ball.z = z;
    ball.vx = (tx - x) / T;
    ball.vy = (ty - y) / T;
    ball.vz = (BALL_R - z) / T + 0.5 * G * T;
    lastServePace = pace(ball);
    lastHitter = 'neighbour';
    bounceRun = 0;
    lastBounceSide = null;
    you.x = 0;
    neighbour.x = x;
    refreshSlots();
  }

  function inStrike(side) {
    const yOk = side === 'you' ? ball.y > 5.15 && ball.y < 7.55 : ball.y < -5.15 && ball.y > -7.55;
    return yOk && ball.z > 0.25 && ball.z < 1.7;
  }

  function predictContact(side) {
    const ghost = { ...ball };
    for (let i = 1; i <= 320; i++) {
      integrate(ghost, DT);
      const yOk = side === 'you' ? ghost.y > 5.15 && ghost.y < 7.55 : ghost.y < -5.15 && ghost.y > -7.55;
      const zOk = ghost.z > 0.25 && ghost.z < 1.7;
      if (yOk && zOk) return { t: i * DT, x: ghost.x, y: ghost.y, z: ghost.z };
    }
    return null;
  }

  function predictLanding(side) {
    const ghost = { ...ball };
    let last = null;
    for (let i = 1; i <= 320; i++) {
      const prevZ = ghost.z;
      integrate(ghost, DT);
      const landed = prevZ > BALL_R + 0.01 && ghost.z <= BALL_R + 0.001;
      const onSide = side === 'you' ? ghost.y > 1 : ghost.y < -1;
      if (!landed || !onSide) continue;
      last = { x: ghost.x, y: ghost.y, t: i * DT };
      const deep = side === 'you' ? ghost.y > 5 : ghost.y < -5;
      if (deep) return last;
    }
    return last || { x: side === 'you' ? you.x : neighbour.x, y: side === 'you' ? 6.4 : -6.4, t: 1 };
  }

  function refreshSlots() {
    if (phase !== 'rally') {
      youSlot.open = false;
      nbSlot.open = false;
      return;
    }
    fillSlot(youSlot, 'you', playerWindow());
    fillSlot(nbSlot, 'neighbour', 0.3);
  }

  function fillSlot(slot, side, windowSec) {
    if (slot.hit) {
      slot.open = false;
      return;
    }
    const inbound = side === 'you' ? ball.vy > 0.05 && ball.y > -2 : ball.vy < -0.05 && ball.y < 2;
    if (!inbound) {
      resetSlot(slot);
      return;
    }
    if (!slot.frozen) {
      const p = predictContact(side);
      if (p) {
        slot.locked = true;
        slot.contactAt = time + p.t;
        if (p.t <= 0.02) slot.frozen = true;
      } else if (inStrike(side)) {
        slot.locked = true;
        slot.contactAt = time;
        slot.frozen = true;
      } else {
        slot.locked = false;
      }
    }
    const elapsed = time - slot.contactAt;
    slot.open = slot.locked && elapsed >= -0.001 && elapsed <= windowSec;
    slot.timing = slot.open ? clamp(elapsed / windowSec, 0, 1) : null;
  }

  function movePlayers() {
    const landYou = predictLanding('you');
    const landNb = predictLanding('neighbour');
    youSlot.landX = landYou.x;
    youSlot.landY = landYou.y;
    const youTarget = steer == null ? landYou.x : steer;
    const youSpeed = steer == null ? assistSpeed() : RUN;
    stepToward(you, youTarget, youSpeed);
    const nbSpeed = time + 0.0001 >= (nbSlot.readyAt || 0) ? RUN * 0.95 : RUN * 0.35;
    stepToward(neighbour, landNb.x, nbSpeed);
    if (youSlot.open) you.pose = you.poseT > 0 ? you.pose : 'reach';
    if (nbSlot.open && neighbour.poseT <= 0) neighbour.pose = 'reach';
  }

  function stepToward(body, target, speed) {
    const dx = clamp(target, -3.2, 3.2) - body.x;
    const max = speed * DT;
    body.x += clamp(dx, -max, max);
  }

  function noteVisits() {
    if (ball.vy < -0.15 && ball.y < 0.4 && !nbVisit) {
      nbVisit = true;
      aiChances += 1;
      nbSlot.readyAt = time + (point === 1 ? 0 : reaction());
      aiLetPass = false;
    }
    if (ball.vy > 0.15 && ball.y > 0) nbVisit = false;
  }

  function aiAct() {
    if (phase !== 'rally' || !nbSlot.open || nbSlot.hit) return;
    if (point === 1 && aiChances >= 4) {
      nbSlot.hit = true;
      aiLetPass = true;
      neighbour.pose = 'reach';
      neighbour.poseT = 0.35;
      events.push({ type: 'miss', side: 'neighbour', frame, scripted: true, aiChances });
      lastMiss = { point, scripted: true, aiChances, neighbourReturns, winner: null };
      return;
    }
    if (time < (nbSlot.readyAt || 0)) return;
    if (point === 1) {
      resolveHit('neighbour', 'flat', 0, 0.5, { x: 0.05, y: 6.4 });
      return;
    }
    const miss = rng() < errorRate();
    if (miss) {
      const wide = rng() < 0.5;
      resolveHit('neighbour', 'flat', 0, 0.5, wide ? { x: 5.1, y: 5.2, flight: 1.2 } : { x: 0.2, y: 10.2, flight: 1.15 });
      events.push({ type: 'miss', side: 'neighbour', frame, scripted: false, aiChances });
      return;
    }
    const spread = 0.35 + Math.min(1.3, score.you * 0.15);
    const x = (rng() * 2 - 1) * spread;
    resolveHit('neighbour', 'flat', 0, 0.5, { x, y: 6.35, flight: 1.2 });
  }

  function handleContact(info) {
    if (phase !== 'rally') return;
    if (info.net) {
      ball.vy *= -0.15;
      ball.vz = Math.min(ball.vz, 0);
      endPoint(other(lastHitter));
      return;
    }
    if (!info.bounced) {
      const past = Math.abs(ball.y) > BASE + 0.35 || Math.abs(ball.x) > HALF_W + 0.45;
      if (past && bounceRun >= 1) endPoint(lastHitter);
      else if (past) endPoint(other(lastHitter));
      return;
    }
    const inside = Math.abs(ball.x) <= HALF_W && Math.abs(ball.y) <= BASE;
    if (!inside) {
      endPoint(bounceRun >= 1 ? lastHitter : other(lastHitter));
      return;
    }
    const side = ball.y >= 0 ? 'you' : 'neighbour';
    if (side === lastBounceSide) bounceRun += 1;
    else {
      lastBounceSide = side;
      bounceRun = 1;
    }
    if (bounceRun >= 2) endPoint(other(side));
  }

  function updateFlowers(dt) {
    const moved = [];
    for (const side of ['you', 'neighbour']) {
      const keep = [];
      for (const f of flowers[side]) {
        f.age += dt;
        if (f.wilting) {
          f.wilt -= dt;
          if (f.wilt <= 0) {
            moved.push({ kind: f.kind, from: side });
            continue;
          }
        }
        keep.push(f);
      }
      flowers[side] = keep;
    }
    for (const item of moved) {
      const dest = other(item.from);
      const list = flowers[dest];
      list.push({
        kind: item.kind,
        x: -2.8 + (list.length % 8) * 0.8,
        row: Math.floor(list.length / 8),
        age: 0,
        wilting: false,
        wilt: 0,
        born: frame,
      });
      events.push({ type: 'sweep', to: dest, frame });
    }
  }

  function updatePoses(dt) {
    for (const body of [you, neighbour]) {
      if (body.poseT > 0) {
        body.poseT -= dt;
        if (body.poseT <= 0 && phase === 'rally') body.pose = 'ready';
      }
    }
  }

  function matchOver() {
    const hi = Math.max(score.you, score.neighbour);
    const lo = Math.min(score.you, score.neighbour);
    return hi >= RULES.pointsToWin && hi - lo >= RULES.winBy;
  }

  function step() {
    frame += 1;
    time += DT;
    events = [];
    if (phase === 'match') return state();
    if (phase === 'award') {
      updateFlowers(DT);
      updatePoses(DT);
      awardT += DT;
      if (awardT >= AWARD) {
        if (matchOver()) phase = 'match';
        else startNextPoint();
      }
      return state();
    }
    movePlayers();
    const info = integrate(ball, DT);
    handleContact(info);
    if (phase === 'rally' && ball.z <= BALL_R + 0.001 && ball.vz === 0 && pace(ball) < 1.5) restT += DT;
    else restT = 0;
    if (phase === 'rally' && restT > 0.5) endPoint(other(ball.y >= 0 ? 'you' : 'neighbour'));
    if (phase === 'rally') {
      noteVisits();
      refreshSlots();
      aiAct();
    }
    if (phase === 'rally') refreshSlots();
    updateFlowers(DT);
    updatePoses(DT);
    return state();
  }

  function swing(kind, dir) {
    events = [];
    const shot = kind === 'lob' || kind === 'smash' ? kind : 'flat';
    const sideDir = dir === -1 || dir === 1 ? dir : 0;
    if (phase !== 'rally' || !youSlot.open) {
      events.push({ type: 'whiff', frame });
      return state();
    }
    resolveHit('you', shot, sideDir, youSlot.timing == null ? 0.5 : youSlot.timing);
    return state();
  }

  function forcePoint(side) {
    events = [];
    if (phase !== 'rally') return state();
    const who = side === 'neighbour' || side === 'neighbor' ? 'neighbour' : 'you';
    endPoint(who);
    return state();
  }

  function copyFlowers(list) {
    return list.map((f) => ({
      kind: f.kind, x: f.x, row: f.row, age: f.age, wilting: f.wilting, wilt: f.wilt, born: f.born,
    }));
  }

  function state() {
    const youFlowers = copyFlowers(flowers.you);
    const nbFlowers = copyFlowers(flowers.neighbour);
    return {
      seed,
      ai,
      fast,
      frame,
      time,
      point,
      phase,
      score: { you: score.you, neighbour: score.neighbour },
      ball: { x: ball.x, y: ball.y, z: ball.z, vx: ball.vx, vy: ball.vy, vz: ball.vz },
      rally,
      yourHits,
      yourHitsPoint,
      neighbourReturns,
      aiChances,
      flowers: { you: youFlowers, neighbour: nbFlowers },
      flowerCount: { you: youFlowers.length, neighbour: nbFlowers.length },
      scriptedMiss: point === 1,
      aimHint: point >= 2,
      window: phase === 'rally' && youSlot.open,
      hitWindow: playerWindow(),
      timing: youSlot.timing,
      contactIn: youSlot.locked ? youSlot.contactAt - time : null,
      landing: { x: youSlot.landX, y: youSlot.landY },
      lastBloom: lastBloom ? { ...lastBloom } : null,
      lastHit: lastHit ? { ...lastHit } : null,
      lastMiss: lastMiss ? { ...lastMiss } : null,
      lastServePace,
      events: events.map((e) => ({ ...e })),
      winner: phase === 'match' ? (score.you > score.neighbour ? 'you' : 'neighbour') : null,
      glow: point === 1 && time < 2 && !fast,
      players: {
        you: { x: you.x, y: you.y, pose: you.pose },
        neighbour: { x: neighbour.x, y: neighbour.y, pose: neighbour.pose },
      },
      errorRate: errorRate(),
      reaction: reaction(),
    };
  }

  refreshSlots();

  return {
    step, swing, state, forcePoint,
    setSteer(x) { steer = x == null ? null : clamp(x, -3.2, 3.2); },
  };
}

export function createTest(match) {
  return {
    state: () => match.state(),
    step(n = 1) {
      const frames = Math.max(1, n | 0);
      let snapshot = null;
      for (let i = 0; i < frames; i++) snapshot = match.step();
      return snapshot;
    },
    advance(seconds) {
      const frames = Math.max(0, Math.round(seconds * 60));
      let snapshot = match.state();
      for (let i = 0; i < frames; i++) snapshot = match.step();
      return snapshot;
    },
    swing(kind, dir) { return match.swing(kind, dir); },
    score() { return match.state().score; },
    ballPos() {
      const b = match.state().ball;
      return { x: b.x, y: b.y, z: b.z };
    },
    forcePoint(side) { return match.forcePoint(side); },
    flowers() { return match.state().flowerCount; },
    rally() { return match.state().rally; },
    scriptedMiss() { return match.state().scriptedMiss; },
  };
}

const PALETTE = {
  paper: '#F3E9D6',
  ink: '#2B2A33',
  lawn: '#5E8C61',
  hedge: '#3F6B47',
  ochre: '#C98B3C',
  ember: '#B5472E',
  sea: '#3E7C8F',
  gold: '#E8B94A',
  soil: '#A07A52',
  wood: '#8C5A32',
};

function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.min(255, Math.round(((n >> shift) & 255) * (1 + amount)));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

if (typeof document !== 'undefined') boot();

function boot() {
  const opts = readOptions(location.search);
  const match = createMatch(opts);
  const test = createTest(match);
  window.__test = test;

  const canvas = document.getElementById('court');
  const again = document.getElementById('again');
  const banner = document.getElementById('banner');
  const ctx = canvas.getContext('2d');
  const stripe = lighten(PALETTE.lawn, 0.06);
  const trail = [];
  let ribbon = 0;
  const petals = [];
  let seenPoint = 1;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  }
  resize();
  window.addEventListener('resize', resize);

  function layout() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const landscape = w > h * 1.05;
    if (!landscape) {
      const project = (x, y) => [
        w * 0.5 + (x / 4.6) * (w * 0.46),
        h * 0.5 + (y / 9.4) * (h * 0.46),
      ];
      const unproject = (sx) => (sx - w * 0.5) / (w * 0.46) * 4.6;
      return { landscape, w, h, pad: { x: 0, y: h * 0.45, w, h: h * 0.55 }, project, unproject };
    }
    const padW = Math.max(160, w * 0.34);
    const fieldW = w - padW;
    const project = (x, y) => [
      fieldW * 0.5 - (y / 9.4) * (fieldW * 0.44),
      h * 0.5 + (x / 4.6) * (h * 0.42),
    ];
    const unproject = (sx, sy) => (sy - h * 0.5) / (h * 0.42) * 4.6;
    return { landscape, w, h, pad: { x: fieldW, y: 0, w: padW, h }, project, unproject, fieldW };
  }

  function drawFlower(x, y, flower, scale) {
    const kind = flower.kind;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (kind === 'poppy') {
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'lupin') {
      ctx.fillStyle = PALETTE.sea;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 6 - i * 4, 3.1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = PALETTE.paper;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, who, pose, glow) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(43, 42, 51, 0.18)';
    ctx.beginPath();
    ctx.ellipse(3, 6, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = who === 'you' ? PALETTE.sea : PALETTE.ember;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    if (who === 'you') {
      ctx.fillStyle = PALETTE.paper;
      ctx.beginPath();
      ctx.ellipse(0, -12, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.ochre;
      ctx.fillRect(-2, -16, 4, 6);
    } else {
      ctx.fillStyle = '#8E341F';
      ctx.beginPath();
      ctx.ellipse(0, -11, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = PALETTE.wood;
    ctx.lineWidth = 3;
    const reach = pose === 'swing' ? -16 : pose === 'reach' ? -10 : -6;
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(18, reach);
    ctx.stroke();
    ctx.fillStyle = pose === 'huff' ? PALETTE.ink : PALETTE.wood;
    ctx.beginPath();
    ctx.ellipse(20, reach, 8, 10, 0.4, 0, Math.PI * 2);
    ctx.fill();
    if (glow) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.globalAlpha = 0.45 + 0.4 * Math.sin(performance.now() / 140);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(20, reach, 14, 16, 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    const s = match.state();
    const box = layout();
    const dpr = canvas.width / box.w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, box.w, box.h);

    const corners = [[-4.2, -8.8], [4.2, -8.8], [4.2, 8.8], [-4.2, 8.8]].map(([x, y]) => box.project(x, y));
    ctx.fillStyle = PALETTE.lawn;
    ctx.beginPath();
    corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = stripe;
    for (let i = 0; i < 24; i += 2) {
      const [, y0] = box.project(0, -8.8 + i * 0.8);
      const [, y1] = box.project(0, -8.8 + (i + 1) * 0.8);
      const top = Math.min(y0, y1);
      ctx.fillRect(0, top, box.landscape ? box.fieldW : box.w, Math.abs(y1 - y0));
    }
    ctx.restore();

    function poly(points, color, width) {
      ctx.beginPath();
      points.forEach(([x, y], i) => {
        const p = box.project(x, y);
        if (i) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      });
      if (width) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    // Bare beds along each baseline.
    poly([[-3.3, 7.15], [3.3, 7.15], [3.3, 8.15], [-3.3, 8.15]], PALETTE.soil);
    poly([[-3.3, -8.15], [3.3, -8.15], [3.3, -7.15], [-3.3, -7.15]], PALETTE.soil);

    ctx.lineCap = 'round';
    poly([[-3.5, -7.7], [3.5, -7.7], [3.5, 7.7], [-3.5, 7.7], [-3.5, -7.7]], PALETTE.ochre, 3);
    poly([[0, -7.7], [0, 7.7]], PALETTE.ochre, 1.5);
    poly([[-3.5, 0], [3.5, 0]], PALETTE.ochre, 1.5);

    // Hedge with two gaps.
    poly([[-3.7, -0.28], [3.7, -0.28], [3.7, 0.28], [-3.7, 0.28]], PALETTE.hedge);
    poly([[-1.15, -0.28], [-0.7, -0.28], [-0.7, 0.28], [-1.15, 0.28]], stripe);
    poly([[1.4, -0.28], [1.9, -0.28], [1.9, 0.28], [1.4, 0.28]], stripe);

    drawProps(box);

    for (const side of ['you', 'neighbour']) {
      const list = s.flowers[side];
      list.forEach((flower, index) => {
        const along = -2.8 + (index % 8) * 0.75;
        const depth = (side === 'you' ? 7.55 : -7.55) + flower.row * (side === 'you' ? 0.35 : -0.35);
        const [fx, fy] = box.project(along, depth);
        let scale = Math.min(1, 0.45 + flower.age / FLOWER_POP);
        if (flower.wilting) scale *= Math.max(0, flower.wilt / FLOWER_WILT);
        drawFlower(fx, fy, flower, scale);
      });
    }

    // Rally counter: one small flower per hit, no digits.
    for (let i = 0; i < s.rally; i++) {
      const [rx, ry] = box.project(-3.9 + (i % 10) * 0.28, -8.55);
      drawFlower(rx, ry, { kind: KINDS[i % 3] }, 0.45);
    }

    const ball = s.ball;
    trail.push({ x: ball.x, y: ball.y, z: ball.z });
    if (trail.length > 6) trail.shift();
    if (s.lastHit && s.frame - s.lastHit.frame < 18) ribbon = 1;
    ribbon *= 0.9;

    trail.forEach((p, i) => {
      const [tx, ty] = box.project(p.x, p.y);
      const lift = p.z * 7;
      ctx.globalAlpha = ((i + 1) / trail.length) * (0.35 + ribbon * 0.5);
      ctx.fillStyle = ribbon > 0.2 ? PALETTE.gold : PALETTE.paper;
      ctx.beginPath();
      ctx.arc(tx, ty - lift, 2.2 + ribbon * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    if (s.phase === 'rally' && s.contactIn != null && s.contactIn < 1.55 && s.contactIn > -0.15) {
      const [lx, ly] = box.project(s.landing.x, s.landing.y);
      const pulse = 16 + Math.sin(s.time * 9) * 4;
      ctx.lineWidth = 3;
      if (s.aimHint) {
        ctx.strokeStyle = PALETTE.sea;
        ctx.beginPath();
        ctx.arc(lx, ly, pulse, Math.PI * 0.5, Math.PI * 1.5);
        ctx.stroke();
        ctx.strokeStyle = PALETTE.ember;
        ctx.beginPath();
        ctx.arc(lx, ly, pulse, Math.PI * -0.5, Math.PI * 0.5);
        ctx.stroke();
      } else {
        ctx.strokeStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(lx, ly, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const py = s.players.you;
    const ny = s.players.neighbour;
    const [px, pyx] = box.project(py.x, py.y);
    const [nx, nyx] = box.project(ny.x, ny.y);
    drawPerson(nx, nyx, 'neighbour', s.players.neighbour.pose, false);
    drawPerson(px, pyx, 'you', s.players.you.pose, s.glow);

    if (s.phase === 'rally') {
      const [bx, by] = box.project(ball.x, ball.y);
      const lift = ball.z * 8;
      const shadowR = 11 / (1 + ball.z * 0.28);
      ctx.fillStyle = `rgba(43, 42, 51, ${0.28 / (1 + ball.z * 0.35)})`;
      ctx.beginPath();
      ctx.ellipse(bx + 4, by + 3, shadowR, shadowR * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      const br = 9 * (1 + Math.min(ball.z, 6) * 0.04);
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(bx, by - lift, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.paper;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(bx - 2, by - lift - 2, br * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Point dots, still with no digits.
    for (let i = 0; i < s.score.you; i++) dot(box, -3.2 + i * 0.28, 8.5, PALETTE.gold);
    for (let i = 0; i < s.score.neighbour; i++) dot(box, -3.2 + i * 0.28, -8.5, PALETTE.ember);

    if (s.phase === 'award' && petals.length < 18) {
      for (let i = 0; i < 10; i++) {
        petals.push({
          x: box.w * (0.3 + (i / 10) * 0.4),
          y: box.h * 0.55,
          vx: (i - 5) * 18,
          vy: -40 - (i % 3) * 12,
          life: 0.8,
          color: i % 2 ? PALETTE.gold : PALETTE.ember,
        });
      }
    }
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.life -= 1 / 60;
      p.x += p.vx / 60;
      p.y += p.vy / 60;
      p.vy += 80 / 60;
      if (p.life <= 0) petals.splice(i, 1);
      else {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 4, 7, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    if (box.landscape) {
      ctx.fillStyle = PALETTE.paper;
      ctx.fillRect(box.pad.x, 0, box.pad.w, box.pad.h);
      ctx.strokeStyle = PALETTE.ochre;
      ctx.lineWidth = 4;
      ctx.strokeRect(box.pad.x + 18, box.h * 0.5 - 28, Math.max(48, box.pad.w - 36), 56);
    }

    if (s.phase === 'match') {
      banner.hidden = false;
      banner.textContent = s.winner === 'you' ? 'Your garden wins' : "The neighbour's garden wins";
      again.hidden = false;
    } else {
      banner.hidden = true;
      again.hidden = true;
    }
    if (s.point !== seenPoint) {
      seenPoint = s.point;
      petals.length = 0;
    }
  }

  function dot(box, x, y, color) {
    const [sx, sy] = box.project(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawProps(box) {
    const chair = box.project(-4.05, -6.2);
    ctx.fillStyle = PALETTE.ochre;
    ctx.fillRect(chair[0] - 10, chair[1] - 6, 20, 12);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(chair[0] - 12, chair[1] - 16, 4, 22);
    ctx.fillRect(chair[0] + 8, chair[1] - 16, 4, 22);
    const can = box.project(-4.0, 5.4);
    ctx.fillStyle = PALETTE.sea;
    ctx.beginPath();
    ctx.ellipse(can[0], can[1], 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(can[0] + 6, can[1] - 2, 10, 3);
    const pot = box.project(4.0, -5.6);
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.ellipse(pot[0], pot[1], 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pot[0] + 12, pot[1] - 2, 6, 0, Math.PI);
    ctx.stroke();
  }

  let acc = 0;
  let last = performance.now();
  function frame(now) {
    const scale = opts.fast ? 4 : 1;
    acc += Math.min(0.1, (now - last) / 1000) * scale;
    last = now;
    let guard = 0;
    while (acc >= DT && guard < 8) {
      match.step();
      acc -= DT;
      guard += 1;
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const pointers = new Map();
  function aimFromEvent(e, box) {
    if (box.landscape) {
      const localY = e.clientY - canvas.getBoundingClientRect().top;
      return localY < box.h / 2 ? -1 : 1;
    }
    const localX = e.clientX - canvas.getBoundingClientRect().left;
    return localX < box.w / 2 ? -1 : 1;
  }

  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer has nothing to capture */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), steered: false });
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.hypot(dx, dy) > 28 && Math.abs(dx) >= Math.abs(dy)) {
      p.steered = true;
      const box = layout();
      const localX = e.clientX - canvas.getBoundingClientRect().left;
      const localY = e.clientY - canvas.getBoundingClientRect().top;
      match.setSteer(box.unproject(localX, localY));
    }
  });
  function release(e) {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const held = performance.now() - p.t;
    const box = layout();
    match.setSteer(null);
    if (p.steered && Math.abs(dx) > 36 && Math.abs(dy) < 48) return;
    let kind = 'flat';
    if (dy < -48 && Math.abs(dy) > Math.abs(dx) && held < 450) kind = 'smash';
    else if (held >= 180) kind = 'lob';
    match.swing(kind, aimFromEvent(e, box));
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    match.setSteer(null);
  });

  const keys = { left: false, right: false };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      match.swing('smash', keys.left ? -1 : keys.right ? 1 : 0);
    }
    if (e.key === ' ' || e.key === 'Enter') {
      keys.space = performance.now();
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if ((e.key === ' ' || e.key === 'Enter') && keys.space) {
      const held = performance.now() - keys.space;
      keys.space = 0;
      match.swing(held >= 180 ? 'lob' : 'flat', keys.left ? -1 : keys.right ? 1 : 0);
    }
    if (!keys.left && !keys.right) match.setSteer(null);
    else match.setSteer(keys.left ? -2.4 : 2.4);
  });

  again.addEventListener('click', () => {
    location.reload();
  });
}
