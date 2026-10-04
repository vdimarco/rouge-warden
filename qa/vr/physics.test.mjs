// Checks the body and rope physics in physics.js with no browser: node qa/vr/physics.test.mjs
// Every scenario runs through one stepper that also checks, on every step, that the body moves only by its
// velocity (no teleports), never stretches a rope by more than 1 m, and never turns into NaN.
// Exit code 1 on failure.
import { generate } from "../../public/vr/js/city.js";
import { createPlayer, fire, release, step, teleport } from "../../public/vr/js/physics.js";
import { SWING, GAME, WORLD, CLIMB } from "../../public/vr/js/config.js";

const fails = [];
let passes = 0;
const check = (ok, msg) => { if (ok) passes++; else fails.push(msg); console.log((ok ? "  ok   " : "  FAIL ") + msg); };
const section = (name) => console.log("\n" + name);
const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);

const city = generate(WORLD.seed);
const h = SWING.fixedDt;
const chestOf = (P) => ({ x: P.pos.x, y: P.pos.y + P.chest, z: P.pos.z });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const speed = (v) => Math.hypot(v.x, v.y, v.z);
const hand = (o = {}) => ({ pos: { x: 0, y: 0, z: 0 }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: true, reeling: false, ...o });
const inp = (o = {}) => ({ move: { x: 0, z: 0 }, jump: false, hands: [hand(), hand({ holding: false })], ...o });
// A high, empty patch of sky over the Financial core, for pendulums with no walls near.
const SKY = { x: 0, y: 500, z: -300 };

// The stepper: n steps of h, with inputs from fn(P, i), and the invariants on every step.
const worst = { move: 0, stretch: 0, nan: 0, cap: 0 };
function run(P, n, fn = () => inp(), { watch = true } = {}) {
  for (let i = 0; i < n; i++) {
    const before = { ...P.pos }, input = fn(P, i);
    // keep the hands at the chest unless the script says otherwise
    for (const hd of input.hands) if (hd.pos.x === 0 && hd.pos.y === 0 && hd.pos.z === 0) Object.assign(hd.pos, chestOf(P));
    step(P, h, input);
    const vals = [P.pos.x, P.pos.y, P.pos.z, P.vel.x, P.vel.y, P.vel.z];
    if (!vals.every(Number.isFinite)) worst.nan++;
    if (!watch || P.dead) continue;
    worst.move = Math.max(worst.move, dist(before, P.pos) - P.stepSpeed * h);
    worst.cap = Math.max(worst.cap, P.stepSpeed - P.speedCap);
    for (const r of P.ropes) if (r.state === "attached") worst.stretch = Math.max(worst.stretch, dist(chestOf(P), r.anchor) - r.len - 1);
  }
}
// Fire at a point and wait, frozen, until the cup lands: the body does not move meanwhile.
function attachAt(P, side, x, y, z, tag = "building", fn = () => inp()) {
  const was = P.frozen;
  P.frozen = true;
  fire(P, side, chestOf(P), { x, y, z, nx: 0, ny: -1, nz: 0, tag, id: tag === "building" ? 1 : tag + ":0" });
  for (let i = 0; i < 200 && P.ropes[side].state !== "attached"; i++) run(P, 1, fn);
  P.frozen = was;
  return P.ropes[side];
}
// A body hanging in the sky, dist m from the anchor at angle deg from straight down.
function hang(cfg, L, deg, anchor = SKY) {
  const P = createPlayer(city, cfg);
  const a = (deg * Math.PI) / 180;
  teleport(P, anchor.x + L * Math.sin(a), anchor.y - L * Math.cos(a) - P.chest, anchor.z);
  P.speedCap = P.fallCap = 1e9;
  attachAt(P, 0, anchor.x, anchor.y, anchor.z);
  P.events.length = 0;
  return P;
}
const energy = (P, g) => 0.5 * speed(P.vel) ** 2 + g * (P.pos.y + P.chest);

/* ---------------- pendulum ---------------- */
section("Pendulum");
{
  const cfg = { ...SWING, quadDragC: 0, attachLengthFactor: 1, dangleDamp: { ...SWING.dangleDamp, perSec: 0 } };
  const L = 30, P = hang(cfg, L, 90);
  const r = P.ropes[0];
  check(r.state === "attached" && Math.abs(r.len - L) < 1e-9 && r.lenTarget === r.len, `a 30 m rope attaches at full length (len ${f2(r.len)})`);
  const E0 = energy(P, cfg.gravity);
  const T = 4 * Math.sqrt(L / cfg.gravity) * 1.8541; // the period of a 90 degree pendulum
  let dE = 0, minY = Infinity, crossings = 0, prevX = P.pos.x;
  run(P, Math.round((5 * T) / h), (Q) => {
    dE = Math.max(dE, Math.abs(energy(Q, cfg.gravity) - E0) / (cfg.gravity * L));
    minY = Math.min(minY, Q.pos.y + Q.chest);
    if (Math.sign(Q.pos.x - SKY.x) !== Math.sign(prevX - SKY.x)) crossings++;
    prevX = Q.pos.x;
    return inp();
  });
  check(dE <= 0.03, `energy stays within ${(dE * 100).toFixed(2)} % of m·g·L over 5 swings (≤ 3 %)`);
  check(crossings >= 9 && crossings <= 11 && Math.abs(minY - (SKY.y - L)) < 0.3, `it swings through the bottom ${crossings} times and bottoms out ${f2(SKY.y - minY)} m below the anchor`);
  check(r.state === "attached" && P.events.length === 0, "the rope stays attached with no events");
}

/* ---------------- attach and length ---------------- */
section("Attach, reel, yank");
{
  // a body at rest 40 m below and 10 m beside an anchor
  const P = createPlayer(city);
  teleport(P, SKY.x + 10, SKY.y - 40 - P.chest, SKY.z);
  P.speedCap = P.fallCap = 1e9;
  const d0 = dist(chestOf(P), SKY);
  const r = attachAt(P, 0, SKY.x, SKY.y, SKY.z);
  const ev = P.events.find((e) => e.type === "attach");
  check(ev && ev.side === 0 && ev.target.tag === "building", "the cup lands with an attach event");
  check(Math.abs(r.lenTarget - 0.97 * d0) < 1e-9 && Math.abs(r.len - d0) < 1e-9, `attach: len = dist ${f2(d0)}, lenTarget = 0.97 × dist ${f2(r.lenTarget)}`);
  let ok = true;
  for (let k = 1; k <= 20; k++) {
    run(P, 1);
    const want = Math.max(r.lenTarget, d0 - SWING.lenRate * h * k);
    if (Math.abs(r.len - want) > 1e-9) ok = false;
  }
  check(ok && r.len === r.lenTarget, `len falls at lenRate ${SWING.lenRate} m/s to lenTarget in ${f2((d0 - r.lenTarget) / SWING.lenRate)} s`);
  const tugSpeed = speed(P.vel);
  run(P, 30);
  check(Math.abs(dist(chestOf(P), SKY) - r.len) < 0.05 && tugSpeed < 3, `the tug is small: the chest sits at the rope length and moves ${f2(tugSpeed)} m/s after it`);

  // reel with the grip: nothing below 0.2, half speed at 0.55, full at 0.9 and above
  const reel = (grip) => { const lt = r.lenTarget; run(P, 60, () => inp({ hands: [hand({ grip }), hand({ holding: false })] })); return (lt - r.lenTarget) / (60 * h); };
  const r0 = reel(0.2), reeling0 = r.reeling, r1 = reel(0.55), r2 = reel(1);
  check(r0 === 0 && !reeling0, `a resting finger (grip 0.2) does not reel (${f2(r0)} m/s)`);
  check(Math.abs(r1 - SWING.reelSpeedMax * 0.5) < 1e-6 && Math.abs(r2 - SWING.reelSpeedMax) < 1e-6 && r.reeling, `grip 0.55 reels at ${f2(r1)} m/s, grip 1 at ${f2(r2)} m/s`);
  // the speed toward the anchor: reeling pulls you in, and you stop when the grip opens (no yo-yo)
  const inward = () => { const c = chestOf(P), l = dist(c, SKY); return (P.vel.x * (SKY.x - c.x) + P.vel.y * (SKY.y - c.y) + P.vel.z * (SKY.z - c.z)) / l; };
  const vReel = inward();
  run(P, 12);
  check(Math.abs(vReel - SWING.reelSpeedMax) < 0.3 && Math.abs(inward()) < 0.5, `reeling pulls you in at ${f2(vReel)} m/s and stops when the grip opens (${f2(inward())} m/s)`);

  // a yank on a normal target: at most maxDV toward the anchor, then a cooldown
  run(P, 120);
  const u = () => { const c = chestOf(P), l = dist(c, SKY); return { x: (SKY.x - c.x) / l, y: (SKY.y - c.y) / l, z: (SKY.z - c.z) / l }; };
  const mom = () => ({ x: P.vel.x - P.pullVel.x, y: P.vel.y - P.pullVel.y, z: P.vel.z - P.pullVel.z });
  P.events.length = 0;
  const u0 = u(), m0 = mom(), lt0 = r.lenTarget;
  run(P, 1, () => inp({ hands: [hand({ yank: 10 }), hand({ holding: false })] }));
  const m1 = mom(), dv = (m1.x - m0.x) * u0.x + (m1.y - m0.y) * u0.y + (m1.z - m0.z) * u0.z;
  const y1 = P.events.find((e) => e.type === "yank");
  check(y1 && y1.pump === false && Math.abs(y1.strength - (10 - SWING.yank.threshold)) < 1e-9, `a hard yank gives a yank event (strength ${y1 && f2(y1.strength)}, no pump)`);
  check(dv <= SWING.yank.maxDV + 1e-6 && dv > SWING.yank.maxDV - 0.2, `it adds ${f2(dv)} m/s toward the anchor (max ${SWING.yank.maxDV})`);
  // the shorten, plus one step of hand over hand from the same pull
  const wantLt = SWING.yank.shorten + 10 * h * SWING.handOverHandGain;
  check(Math.abs(lt0 - r.lenTarget - wantLt) < 1e-6, `and shortens lenTarget by ${f2(lt0 - r.lenTarget)} m`);
  const oneYank = (Q, i) => (i === 0 ? inp({ hands: [hand({ yank: 10 }), hand({ holding: false })] }) : inp());
  run(P, 20);
  // (its pull still climbs the rope hand over hand, which moves you by the winch, not by momentum)
  const mIn = mom();
  run(P, 1, oneYank);
  check(P.events.filter((e) => e.type === "yank").length === 1 && dist(mIn, mom()) < 0.2, "a second yank within the cooldown adds no speed and no event");
  run(P, Math.round(0.25 / h));
  const toward = (() => { const v = P.vel, uu = u(); return v.x * uu.x + v.y * uu.y + v.z * uu.z; })();
  check(toward <= SWING.yank.maxDV + 0.3, `once the shorten is done, the speed toward the anchor is ${f2(toward)} m/s`);
  run(P, 1, oneYank);
  check(P.events.filter((e) => e.type === "yank").length === 2, "after the cooldown the next yank counts");
  // a real hand pulled back at 3 m/s
  run(P, 120);
  P.events.length = 0;
  const uu = u(), before = mom();
  run(P, 1, () => inp({ hands: [hand({ velRel: { x: -uu.x * 3, y: -uu.y * 3, z: -uu.z * 3 } }), hand({ holding: false })] }));
  const after = mom(), dv3 = (after.x - before.x) * uu.x + (after.y - before.y) * uu.y + (after.z - before.z) * uu.z;
  const want3 = SWING.yank.gain * (3 - SWING.yank.threshold);
  check(P.events.some((e) => e.type === "yank") && Math.abs(dv3 - want3) < 0.15, `pulling the hand back at 3 m/s adds ${f2(dv3)} m/s (gain × strength ${f2(want3)})`);
}

/* ---------------- taut catch ---------------- */
section("Taut catch");
{
  // throw the body up past the anchor so the rope goes slack, and let it fall back onto the rope
  const P = hang(SWING, 6, 0);
  run(P, 30);
  P.vel.y = 13;
  const r = P.ropes[0];
  let caught = -1, maxStretch = 0, first = 0;
  const radial = () => { const c = chestOf(P), l = dist(c, SKY); return (P.vel.x * (c.x - SKY.x) + P.vel.y * (c.y - SKY.y) + P.vel.z * (c.z - SKY.z)) / l; };
  const trace = [];
  run(P, 360, (Q, i) => {
    if (caught < 0 && Q.ropes[0].catchT > 0) { caught = i; first = trace.at(-1); }
    if (caught >= 0 && i - caught < 30) trace.push(radial());
    maxStretch = Math.max(maxStretch, Q.ropes[0].stretch);
    if (caught < 0) trace.push(radial());
    return inp();
  });
  const after = trace.slice(-30);
  const steps = after.findIndex((v) => v < 0.5);
  check(caught > 0 && first > 10, `the rope goes taut at ${f2(first)} m/s outward`);
  check(steps * h >= SWING.catchTime * 0.7 && steps * h <= SWING.catchTime + 0.02, `the catch takes ${f2(steps * h)} s to stop the fall (catchTime ${SWING.catchTime})`);
  check(maxStretch > 0.2 && maxStretch <= 1 + 1e-9 && r.stretch === 0 && r.state === "attached", `the rope gives ${f2(maxStretch)} m (at most 1) and takes it back`);
}

/* ---------------- special targets ---------------- */
section("Special targets");
{
  const mk = () => { const P = hang(SWING, 12, 20); release(P, 0); P.events.length = 0; attachAt(P, 0, SKY.x, SKY.y, SKY.z, "clog"); P.events.length = 0; return P; };
  const A = mk(), B = mk();
  const pull = SWING.yank.threshold + GAME.pumpMin + 0.1;
  run(A, 1, () => inp({ hands: [hand({ yank: pull }), hand({ holding: false })] }));
  run(B, 1);
  const ev = A.events.find((e) => e.type === "yank");
  check(ev && ev.pump === true && ev.target.tag === "clog", `a yank of ${f2(pull)} m/s on a clog is a pump`);
  check(JSON.stringify([A.pos, A.vel, A.ropes[0].lenTarget]) === JSON.stringify([B.pos, B.vel, B.ropes[0].lenTarget]), "and changes no speed and no rope length");
  const C2 = mk();
  run(C2, 1, () => inp({ hands: [hand({ yank: SWING.yank.threshold + GAME.pumpMin - 0.1 }), hand({ holding: false })] }));
  const e2 = C2.events.find((e) => e.type === "yank");
  check(e2 && e2.pump === false, "a weaker yank on a clog is not a pump");
  // pulling a clog rope back slowly does not climb it (no hand over hand on special targets)
  const D = mk(), lt = D.ropes[0].lenTarget;
  run(D, 60, () => inp({ hands: [hand({ velRel: { x: 0, y: -0.8, z: 0 } }), hand({ holding: false })] }));
  check(D.ropes[0].lenTarget === lt, "hand over hand does not work on a clog");
  const N = hang(SWING, 12, 20), ltN = N.ropes[0].lenTarget;
  run(N, 60, () => inp({ hands: [hand({ velRel: { x: 0, y: -0.8, z: 0 } }), hand({ holding: false })] }));
  check(ltN - N.ropes[0].lenTarget > 0.4, `hand over hand climbs a normal rope (${f2(ltN - N.ropes[0].lenTarget)} m in 0.5 s)`);
}

/* ---------------- holding ---------------- */
section("Holding");
{
  const P = hang(SWING, 20, 30);
  run(P, 1, () => inp({ hands: [hand({ holding: false }), hand({ holding: false })] }));
  check(P.ropes[0].state === "idle" && P.events.some((e) => e.type === "detach" && e.side === 0), "opening the hand releases the rope with a detach event");
  const Q = hang(SWING, 20, 30);
  release(Q, 0);
  attachAt(Q, 0, SKY.x, SKY.y, SKY.z, "crack");
  check(Q.ropes[0].sticky, "a rope on the crack is sticky");
  run(Q, 30, () => inp({ hands: [hand({ holding: false }), hand({ holding: false })] }));
  check(Q.ropes[0].state === "attached", "a sticky rope stays when the hand opens");
  release(Q, 0);
  check(Q.ropes[0].state === "idle", "release() lets go of a sticky rope");
  const F = createPlayer(city);
  F.frozen = true;
  fire(F, "right", chestOf(F), { x: F.pos.x, y: F.pos.y + 30, z: F.pos.z - 40, tag: "building", id: 3 });
  const dur = F.ropes[1].flyDur, fd = dist(chestOf(F), { x: F.pos.x, y: F.pos.y + 30, z: F.pos.z - 40 });
  run(F, 3, () => inp({ hands: [hand({ holding: false }), hand({ holding: false })] }));
  check(Math.abs(dur - Math.min(fd / SWING.cupSpeed, SWING.flyMax)) < 1e-9 && F.ropes[1].state === "idle", `flyDur = min(dist / cupSpeed, flyMax) = ${f2(dur)} s, and a flying cup is dropped when the hand opens`);
}

/* ---------------- caps ---------------- */
section("Speed and fall caps");
{
  const P = createPlayer(city);
  teleport(P, -162, 340, -20); // over a street, 340 m up
  P.speedCap = 20; P.fallCap = 14;
  let maxS = 0, minVy = 0;
  run(P, Math.round(4 / h), (Q) => { maxS = Math.max(maxS, speed(Q.vel)); minVy = Math.min(minVy, Q.vel.y); return inp(); });
  check(minVy >= -14 - 1e-9 && Math.abs(minVy + 14) < 1e-6, `falling tops out at the fall cap (${f2(-minVy)} m/s)`);
  const Q = hang(SWING, 40, 60);
  Q.speedCap = 20; Q.fallCap = 26;
  let maxQ = 0;
  run(Q, Math.round(6 / h), (R, i) => { maxQ = Math.max(maxQ, speed(R.vel)); return inp({ hands: [hand({ yank: i % 50 === 0 ? 8 : 0, grip: 1 }), hand({ holding: false })] }); });
  check(maxQ <= 20 + 1e-9 && maxQ > 19, `yanking and reeling hard never beats the speed cap (${f2(maxQ)} of 20 m/s)`);
}

/* ---------------- dangle damping ---------------- */
section("Dangle damping");
{
  const tail = (cfg) => { const P = hang(cfg, 6, 35); let m = 0; run(P, Math.round(5 / h), (Q, i) => { if (i * h > 4.5) m = Math.max(m, speed(Q.vel)); return inp(); }); return m; };
  const damped = tail(SWING), free = tail({ ...SWING, dangleDamp: { ...SWING.dangleDamp, perSec: 0 } });
  check(damped < 0.3 && free > 2, `a 6 m pendulum with no input is still after 5 s (${f2(damped)} m/s; ${f2(free)} m/s without damping)`);
  const P = hang(SWING, 6, 35);
  let m = 0;
  run(P, Math.round(5 / h), (Q, i) => { if (i * h > 4.5) m = Math.max(m, speed(Q.vel)); return inp({ move: { x: 0, z: i % 240 < 120 ? 0.5 : -0.5 } }); });
  check(m > 0.5, `stick input keeps it swinging (${f2(m)} m/s)`);
}

/* ---------------- ground, walls, water ---------------- */
section("Ground, walls, water");
{
  const S = city.start, P = createPlayer(city);
  check(P.onGround && P.ground && P.ground.bid === 0, "you start standing on the start roof");
  teleport(P, S.x + 2, S.y + 6, S.z);
  P.events.length = 0;
  run(P, 240);
  const land = P.events.find((e) => e.type === "land");
  check(P.onGround && P.pos.y === S.y && land && Math.abs(land.speed - Math.sqrt(2 * 9.8 * 6)) < 0.5, `a 6 m drop lands on the roof (land speed ${land && f2(land.speed)} m/s)`);
  check(dist(P.lastSafe, P.pos) < 1e-9, "lastSafe follows you on a roof");
  let peak = 0;
  run(P, 180, (Q, i) => { peak = Math.max(peak, Q.pos.y - S.y); return inp({ jump: i === 0 }); });
  const jumped = P.events.filter((e) => e.type === "land").length;
  check(jumped >= 2 && P.onGround && Math.abs(peak - SWING.ground.jump ** 2 / (2 * 9.8)) < 0.1, `a jump rises ${f2(peak)} m and lands again`);
  // walk off the south edge: you fall
  run(P, Math.round(6 / h), () => inp({ move: { x: 0, z: 1 } }));
  check(!P.onGround || P.pos.y < S.y - 1, "walking off the roof edge drops you");
  // walk into a wall from the street
  const b = city.buildings.find((q) => q.tiers[0].minX === -152 && q.tiers[0].minZ > 29 && q.tiers[0].maxZ < 100 && q.h > 3);
  const W = createPlayer(city), zc = (b.tiers[0].minZ + b.tiers[0].maxZ) / 2;
  teleport(W, -160, 0, zc);
  W.events.length = 0;
  let maxX = -Infinity;
  run(W, Math.round(3 / h), (Q) => { maxX = Math.max(maxX, Q.pos.x); return inp({ move: { x: 1, z: 0 } }); });
  check(maxX <= -152 - SWING.kneeRadius + 1e-6 && Math.abs(W.vel.x) < 0.2 && W.onGround, `walking into a wall stops you ${f2(-152 - maxX)} m from it`);
  // a fast body into a wall bumps
  const Bm = createPlayer(city);
  teleport(Bm, -158, 20, zc);
  Bm.vel.x = 12;
  Bm.events.length = 0;
  run(Bm, 60);
  const bump = Bm.events.find((e) => e.type === "bump");
  check(bump && bump.speed > 4 && bump.nx < -0.9 && Math.abs(Bm.vel.x) < 2, `hitting a wall at 12 m/s gives a bump (${bump && f2(bump.speed)} m/s, normal ${bump && f2(bump.nx)})`);
  // the lake
  const L = createPlayer(city);
  teleport(L, 0, 5, city.shoreZ + 40);
  L.events.length = 0;
  run(L, 240);
  const at = { ...L.pos };
  run(L, 60);
  check(L.dead === "splash" && L.events.filter((e) => e.type === "splash").length === 1 && dist(at, L.pos) === 0, "falling in the lake: dead = splash, one splash event, and the body stops");
  teleport(L, S.x, S.y, S.z);
  check(L.dead === null && L.onGround && L.events.at(-1).type === "respawn", "teleport clears dead, stands you on the roof and says respawn");
  // the edge of the world
  const O = createPlayer(city);
  teleport(O, city.bounds.maxX + 250, 80, 0);
  O.events.length = 0;
  run(O, 2);
  check(O.dead === "oob" && O.events.some((e) => e.type === "oob"), "far past the bounds: dead = oob");
}

/* ---------------- frozen ---------------- */
section("Frozen");
{
  const P = createPlayer(city);
  teleport(P, -120, 60, 60);
  P.frozen = true;
  const at = { ...P.pos };
  fire(P, 0, chestOf(P), { x: -120, y: 90, z: 20, tag: "crack", id: "crack" });
  run(P, 60);
  check(P.ropes[0].state === "attached" && P.events.some((e) => e.type === "attach"), "frozen: the cup still flies and attaches");
  run(P, 1, () => inp({ hands: [hand({ yank: 4 }), hand({ holding: false })] }));
  const y = P.events.find((e) => e.type === "yank");
  check(y && y.pump === true && y.target.id === "crack", "frozen: a yank still gives a (pump) yank event");
  const lt = P.ropes[0].lenTarget;
  run(P, 120, () => inp({ move: { x: 1, z: 0 }, hands: [hand({ grip: 1, holding: false }), hand()] }));
  check(dist(at, P.pos) === 0 && speed(P.vel) === 0 && P.ropes[0].lenTarget === lt && P.ropes[0].state === "attached", "frozen: the body does not move, the grip does not reel, and the sticky crack rope stays");
}

/* ---------------- snap ---------------- */
section("Rope snap");
{
  // a rope straight through a Financial tower snaps after 0.25 s
  const t = city.buildings.find((b) => b.district === 1 && b.h > 150 && b.w > 20);
  const T0 = t.tiers[0], zc = (T0.minZ + T0.maxZ) / 2;
  const P = createPlayer(city);
  teleport(P, T0.minX - 8, 60, zc);
  P.speedCap = P.fallCap = 1e9;
  P.events.length = 0;
  attachAt(P, 0, T0.maxX + 8, 70, zc);
  let snapAt = -1;
  run(P, 120, (Q, i) => { if (snapAt < 0 && Q.events.some((e) => e.type === "snap")) snapAt = i * h; return inp(); });
  check(snapAt > SWING.snapBlocked - 0.02 && snapAt < SWING.snapBlocked + 0.05 && P.ropes[0].state === "idle", `a rope through a tower snaps after ${f2(snapAt)} s`);
  const Q = hang(SWING, 30, 40);
  run(Q, 240);
  check(!Q.events.some((e) => e.type === "snap") && Q.ropes[0].state === "attached", "a clear rope does not snap");
}

/* ---------------- determinism ---------------- */
section("Determinism");
{
  const script = (P, i) => inp({ move: { x: Math.sin(i * 0.01), z: Math.cos(i * 0.013) }, jump: i % 300 === 0, hands: [hand({ grip: (i % 200) / 200, yank: i % 97 === 0 ? 3 : 0, velRel: { x: 0.1, y: -0.3 * Math.sin(i * 0.1), z: 0 } }), hand({ holding: i % 400 < 300 })] });
  const once = () => {
    const P = createPlayer(city);
    fire(P, 0, chestOf(P), { ...city.goldRing, tag: "building", id: 5 });
    fire(P, 1, chestOf(P), { x: -40, y: 120, z: 125, tag: "building", id: 6 });
    run(P, 900, script);
    return JSON.stringify({ pos: P.pos, vel: P.vel, ropes: P.ropes.map((r) => [r.state, r.len, r.lenTarget, r.tension]), events: P.events });
  };
  const a = once(), b = once();
  check(a === b, `two runs with the same inputs match exactly (${a.length} bytes of state)`);
}

/* ---------------- the first swing ---------------- */
section("The first swing");
{
  const S = city.start, G = city.goldRing, P = createPlayer(city);
  P.events.length = 0;
  // aim from the right hand at the gold ring, the way ropes.aim would, then walk off the roof toward it
  const hp = { x: S.x + 0.25, y: S.y + 1.3, z: S.z - 0.2 };
  const hit = city.raycast(hp.x, hp.y, hp.z, G.x - hp.x, G.y - hp.y, G.z - hp.z, SWING.ropeRange * SWING.rangeGrace, {});
  fire(P, 1, hp, { ...hit, tag: hit.collider.tag, id: hit.collider.id });
  const toRing = { x: G.x - S.x, z: G.z - S.z }, l = Math.hypot(toRing.x, toRing.z);
  let phase = "walk", attachedT = 0, minY = Infinity, relSpeed = 0, relT = -1, t = 0, after = null, where = "";
  run(P, Math.round(16 / h), (Q) => {
    t += h;
    if (Q.ropes[1].state === "attached") attachedT += h;
    if (phase === "walk" && !Q.onGround && Q.pos.y < S.y - 2) phase = "swing";
    if (phase === "swing") minY = Math.min(minY, Q.pos.y);
    // let go once the swing has come up 1 m from its lowest point ("Let go at the bottom", a little late)
    if (phase === "swing" && Q.pos.y > minY + 1 && Q.vel.y > 0) { phase = "fly"; relSpeed = speed(Q.vel); relT = t; }
    if (phase === "fly" && !after && t > relT + 1.5) after = { ground: Q.onGround, collider: Q.ground, dead: Q.dead, y: Q.pos.y };
    if (phase === "fly" && !where && Q.onGround) where = Q.ground ? `a ${Q.ground.tag} top at ${f2(Q.pos.y)} m` : "the street";
    return inp({ move: phase === "walk" ? { x: toRing.x / l, z: toRing.z / l } : { x: 0, z: 0 }, hands: [hand({ holding: false }), hand({ holding: phase !== "fly" })] });
  });
  const att = P.events.find((e) => e.type === "attach"), det = P.events.find((e) => e.type === "detach");
  check(att && att.side === 1 && attachedT > 2, `the cup sticks to the gold ring tower and you swing on it for ${f2(attachedT)} s`);
  check(det && det.speed >= 8 && minY > 3, `you let go at ${f2(relSpeed)} m/s after ${f2(relT)} s; the lowest feet were ${f2(minY)} m over the street`);
  const ok = after && !after.dead && (!after.ground || (after.collider && after.collider.tag === "building"));
  check(ok, `1.5 s after letting go you are ${after ? (after.ground ? "on a roof" : "still flying, " + f2(after.y) + " m up") : "?"} (you come down on ${where || "nothing yet"})`);
}

/* ---------------- wall climbing (flat play) ---------------- */
section("Wall climbing");
{
  // a one-box building whose +x face stands on the street, with nothing else within 4 m of that face
  const FLAT = { ...SWING, climb: CLIMB };
  const one = city.colliders.filter((c) => c.type === "box" && c.tag === "building" && c.minY === 0 && c.maxY > 25 && c.maxY < 90 &&
    city.colliders.filter((d) => d.bid === c.bid).length === 1);
  const B = one.find((c) => {
    const z = (c.minZ + c.maxZ) / 2;
    for (let y = 0.5; y < c.maxY + 3; y += 1) if (city.collideSphere(c.maxX + 2, y, z, 1.6)) return false;
    return !city.isWater(c.maxX + 1, z) && city.groundY(c.maxX + 1, z) < 0.5;
  });
  check(!!B, "a one-box building with a clear street face to climb" + (B ? ` (${B.maxY} m tall)` : ""));
  if (B) {
    const z = (B.minZ + B.maxZ) / 2, P = createPlayer(city, FLAT), gy = city.groundY(B.maxX + 1, z);
    const climbIn = (up, x = 0, zz = 0, o = {}) => inp({ climb: { up, x, z: zz }, hands: [hand({ holding: false }), hand({ holding: false })], ...o });
    // walk into the wall: it holds you
    teleport(P, B.maxX + 1.5, gy, z);
    let t = 0;
    run(P, 120, () => { t++; return P.wall ? climbIn(0) : inp({ move: { x: -1, z: 0 }, hands: [hand({ holding: false }), hand({ holding: false })] }); }, { watch: false });
    check(P.wall && Math.abs(P.wall.nx - 1) < 1e-6 && P.events.some((e) => e.type === "cling"), "walking into a wall grabs it (normal " + (P.wall ? f2(P.wall.nx) + ", " + f2(P.wall.nz) : "none") + ")");
    // up: 6 m/s, the chest just off the wall
    const y0 = P.pos.y;
    run(P, 120, () => climbIn(1), { watch: false });
    const gap = P.pos.x - B.maxX;
    check(P.wall && Math.abs(P.pos.y - y0 - CLIMB.speed) < 0.1, `W climbs ${f2(P.pos.y - y0)} m in 1 s (speed ${CLIMB.speed} m/s)`);
    check(Math.abs(gap - (FLAT.chestRadius + CLIMB.gap)) < 0.02 && P.vel.y > 5.9, `the chest stays ${f2(gap)} m off the wall while climbing`);
    // sideways: along the wall, not off it
    const z0 = P.pos.z, x0 = P.pos.x, yS = P.pos.y;
    run(P, 30, () => climbIn(0, 0, 1), { watch: false });
    check(P.wall && Math.abs(P.pos.z - z0 - CLIMB.speed * 0.25) < 0.05 && Math.abs(P.pos.x - x0) < 0.01 && Math.abs(P.pos.y - yS) < 1e-6, `A/D move along the wall (${f2(P.pos.z - z0)} m in 0.25 s) and nowhere else`);
    // no input: you hang still
    const still = { ...P.pos };
    run(P, 120, () => climbIn(0), { watch: false });
    check(P.wall && dist(still, P.pos) < 1e-6, "with no input you hold still on the wall (no gravity)");
    // the top: step on to the roof
    let topT = 0;
    run(P, 1200, () => { if (P.wall) topT++; return climbIn(P.wall ? 1 : 0); }, { watch: false });
    check(!P.wall && P.onGround && P.ground === B && Math.abs(P.pos.y - B.maxY) < 1e-6 && P.events.some((e) => e.type === "mantle"), `at the top you step on to the roof (${f2(P.pos.y)} m, ${f2(topT * h)} s more climbing)`);
    // back on the wall at mid height, from the air: you fly into it and it holds you
    teleport(P, B.maxX + 3, B.maxY / 2, z);
    P.vel.x = -8;
    run(P, 120, () => (P.wall ? climbIn(0) : inp({ hands: [hand({ holding: false }), hand({ holding: false })] })), { watch: false });
    check(!!P.wall && !P.onGround, "flying into a wall grabs it in the air");
    // down to the street: stand there
    run(P, 1200, () => climbIn(P.wall ? -1 : 0), { watch: false });
    check(!P.wall && P.onGround && Math.abs(P.pos.y - gy) < 1e-6, "S climbs down to the street and you stand there");
    // jump off: out and up, and no grab again at once
    teleport(P, B.maxX + 3, B.maxY / 2, z);
    P.vel.x = -8;
    run(P, 120, () => (P.wall ? climbIn(0) : inp({ hands: [hand({ holding: false }), hand({ holding: false })] })), { watch: false });
    run(P, 1, () => climbIn(0, 0, 0, { jump: true }), { watch: false });
    check(!P.wall && P.vel.x >= CLIMB.jump.out - 0.2 && P.vel.y > CLIMB.jump.up - 0.5, `Space jumps off the wall (vel ${f2(P.vel.x)} out, ${f2(P.vel.y)} up)`);
    run(P, 12, () => inp({ hands: [hand({ holding: false }), hand({ holding: false })] }), { watch: false });
    check(!P.wall, "you do not grab the same wall again right after the jump");
    // the air grab rule: a fall steered into a wall catches it; a fast swing that only brushes a wall goes on
    {
      const F = createPlayer(city, FLAT);
      teleport(F, B.maxX + 1.2, B.maxY - 2, z);
      F.vel.x = -3; F.vel.y = -14;
      run(F, 240, () => (F.wall ? climbIn(0) : inp({ move: { x: -1, z: 0 }, hands: [hand({ holding: false }), hand({ holding: false })] })), { watch: false });
      check(!!F.wall && F.pos.y > B.maxY - 20, `a fall at 14 m/s steered into a wall grabs it in the air (${F.wall ? "held at " + f2(F.pos.y) + " m" : "slid to " + f2(F.pos.y) + " m"})`);
      const G2 = createPlayer(city, FLAT);
      teleport(G2, B.maxX + 0.6, B.maxY / 2, B.minZ + 2);
      G2.vel.x = -2; G2.vel.y = 0; G2.vel.z = 20;
      let grabbedFast = false;
      run(G2, 30, () => { if (G2.wall && Math.hypot(G2.vel.x, G2.vel.z) > 1) grabbedFast = true; return inp({ hands: [hand({ holding: false }), hand({ holding: false })] }); }, { watch: false });
      check(!G2.events.some((e) => e.type === "cling") || !grabbedFast, "a swing at 20 m/s that brushes a wall at 2 m/s does not grab it");
    }
    // a rope from the wall swings you off it
    teleport(P, B.maxX + 3, B.maxY / 2, z);
    P.vel.x = -8;
    run(P, 120, () => (P.wall ? climbIn(0) : inp({ hands: [hand({ holding: false }), hand({ holding: false })] })), { watch: false });
    const was = !!P.wall;
    fire(P, 1, chestOf(P), { x: B.maxX + 30, y: B.maxY + 20, z, nx: -1, ny: 0, nz: 0, tag: "building", id: 1 });
    check(was && !P.wall && P.ropes[1].state === "flying" && P.events.some((e) => e.type === "unclimb" && e.why === "rope"), "a rope fired from the wall lets go of it");
    // the Needle, street to tip: the shaft, round the collars and the deck, up the pod, the mast and the antenna
    {
      const N = city.needle, NW = WORLD.needle, Q = createPlayer(city, FLAT), stops = [];
      teleport(Q, NW.x, city.groundY(NW.x, NW.z + NW.shaftR + 1), NW.z + NW.shaftR + 1);
      let lips = 0;
      for (let leg = 0; leg < 5; leg++) {
        // walk in toward the middle until a wall holds you, then climb until you stand on something
        run(Q, 720, () => (Q.wall ? climbIn(0) : inp({ move: { x: 0, z: -1 }, hands: [hand({ holding: false }), hand({ holding: false })] })), { watch: false });
        if (!Q.wall) break;
        run(Q, 120 * 90, () => climbIn(Q.wall ? 1 : 0), { watch: false });
        lips += Q.events.filter((e) => e.type === "lip").length; Q.events.length = 0;
        if (!Q.onGround) break;
        stops.push(Math.round(Q.pos.y));
      }
      check(stops.includes(NW.deckY) && stops.includes(NW.podY1) && stops[stops.length - 1] === NW.top && lips >= 5,
        `you climb the Needle from the street to its tip: stands at ${stops.join(", ")} m, round ${lips} overhangs`);
    }
    // headset physics (no cfg.climb) never grabs
    const Q = createPlayer(city);
    teleport(Q, B.maxX + 3, B.maxY / 2, z);
    Q.vel.x = -8;
    run(Q, 120, () => inp({ hands: [hand({ holding: false }), hand({ holding: false })] }), { watch: false });
    check(!Q.wall, "headset play does not climb");
  }
}

/* ---------------- invariants ---------------- */
section("Every step");
check(worst.nan === 0, `no NaN in ${worst.nan === 0 ? "any" : worst.nan} step`);
check(worst.move <= 1e-6, `the body never moves more than speed × h (worst excess ${worst.move.toExponential(1)} m)`);
check(worst.stretch <= 1e-6, `a rope never stretches more than 1 m (worst excess ${worst.stretch.toExponential(1)} m)`);
check(worst.cap <= 1e-9, "the move speed never beats speedCap");

console.log(`\n${passes} passed, ${fails.length} failed`);
if (fails.length) { console.log("FAIL physics\n  " + fails.join("\n  ")); process.exit(1); }
console.log("PASS: physics");
