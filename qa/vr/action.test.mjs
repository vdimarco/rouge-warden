// The city action, with no browser: the Sludge Gang (js/combat.js), the cars (js/cars.js) and the jobs (js/jobs.js).
// Run from the repo root: node qa/vr/action.test.mjs
import assert from "node:assert/strict";
import { generate } from "../../public/vr/js/city.js";
import { createCombat, FIGHT } from "../../public/vr/js/combat.js";
import { createCars, CAR, trafficAt, nearTraffic } from "../../public/vr/js/cars.js";
import { createStreet } from "../../public/vr/js/street.js";
import { createJobs, JOB } from "../../public/vr/js/jobs.js";

const city = generate();
let fails = 0;
const test = (name, fn) => { try { fn(); console.log("PASS: " + name); } catch (e) { fails++; console.log("FAIL " + name + "\n  " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n  ") : e)); } };
const DT = 1 / 30;
const hero = (x, y, z, o = {}) => ({ x, y, z, yaw: 0, onGround: true, safe: false, hidden: false, vx: 0, vy: 0, vz: 0, busy: false, ...o });
const street = { x: -150, y: 0, z: 2 }; // the sidewalk of the z = 14 avenue in the Market

/* ---------------- fights ---------------- */
test("a goon who sees the hero walks up, winds up and punches; the hero loses a heart", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z);
  const g = C.spawn(street.x - 10, 0, street.z, "t");
  const seen = [];
  for (let i = 0; i < 6 / DT; i++) { C.update(DT, h); for (const e of C.events) seen.push(e.type); C.events.length = 0; }
  assert.ok(Math.hypot(g.x - h.x, g.z - h.z) < FIGHT.reach, "walked up: " + Math.hypot(g.x - h.x, g.z - h.z).toFixed(2));
  assert.ok(seen.includes("windup") && seen.includes("hurt"), "wound up and hit: " + seen);
  assert.ok(C.hp < FIGHT.hp, "hearts " + C.hp);
});
test("no blow lands while the hero rolls or drives (safe)", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z, { safe: true });
  C.spawn(street.x - 1.2, 0, street.z, "t").aggro = true;
  for (let i = 0; i < 6 / DT; i++) C.update(DT, h);
  assert.equal(C.hp, FIGHT.hp);
});
test("punch, punch, kick: the combo knocks a goon down, and he sinks away", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z, { safe: true });
  const g = C.spawn(street.x - 1.4, 0, street.z, "t");
  const kinds = [];
  for (let i = 0; i < 3; i++) { const a = C.attack(h); kinds.push(a && a.kind); h.x = g.x + 1.2; h.z = g.z; for (let k = 0; k < 3; k++) C.update(0.1, h); }
  assert.deepEqual(kinds, ["punch", "punch", "kick"]);
  assert.equal(g.state, "down");
  for (let i = 0; i < 6 / DT; i++) C.update(DT, h);
  assert.ok(!g.on && C.goons.length === 0, "gone after he went down");
  assert.equal(C.stats.kos, 1);
});
test("a punch out of reach does nothing", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z);
  C.spawn(street.x - 6, 0, street.z, "t");
  assert.equal(C.attack(h), null);
});
test("a rope yanks a goon to the hero's feet and he goes down", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z, { safe: true });
  const g = C.spawn(street.x - 15, 0, street.z, "t");
  assert.ok(C.pull(g.id, h));
  for (let i = 0; i < 1 / DT; i++) C.update(DT, h);
  assert.equal(g.state, "down");
  assert.ok(Math.hypot(g.x - h.x, g.z - h.z) < 2.5, "at the feet: " + Math.hypot(g.x - h.x, g.z - h.z).toFixed(2));
});
test("a dive landing flattens the goons round it; a car knocks them over", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z, { safe: true });
  const a = C.spawn(street.x - 2, 0, street.z, "t"), b = C.spawn(street.x + 2, 0, street.z + 1, "t"), far = C.spawn(street.x - 12, 0, street.z, "t");
  assert.equal(C.slam(h.x, h.y, h.z), 2);
  assert.ok(C.alive(far));
  assert.equal(C.carHit(far.x + 1, far.z, -10, 0), 1);
  assert.ok(!C.alive(far));
  assert.ok(a.hp < FIGHT.goon.hp && b.hp < FIGHT.goon.hp);
});
test("goons keep to their surface: a roof guard never walks off the edge", () => {
  const C = createCombat(city);
  const b = city.buildings.find((q) => q.roofY > 20 && q.roofY < 60 && q.tiers.length === 1 && q.w > 16 && q.d > 16);
  const g = C.spawn(b.x, b.roofY, b.z, "t");
  const h = hero(b.x + b.w, 0, b.z); // down on the street beside the building, inside his sight but not on his roof
  g.aggro = true;
  for (let i = 0; i < 8 / DT; i++) C.update(DT, { ...h, y: b.roofY - 3 });
  assert.ok(Math.abs(g.y - b.roofY) < 0.01, "still on the roof: " + g.y);
});
test("the hero's hearts come back after a quiet while", () => {
  const C = createCombat(city);
  C.hp = 2; C.quiet = 0;
  for (let i = 0; i < 10 / DT; i++) C.update(DT, hero(street.x, 0, street.z));
  assert.ok(C.hp > 3.5, "hearts " + C.hp);
});

/* ---------------- cars ---------------- */
test("parked cars wait at kerbs round the player, clear of buildings and junctions", () => {
  const K = createCars(city);
  K.update(DT, street, null);
  const on = K.cars.filter((c) => c.on);
  assert.ok(on.length >= 8, "cars " + on.length);
  for (const c of on) {
    assert.ok(!city.collideSphere(c.x, 0.8, c.z, 0.9) && !city.isWater(c.x, c.z), "a car in a building at " + c.x + ", " + c.z);
    assert.ok(Math.hypot(c.x - street.x, c.z - street.z) <= CAR.spawnMax + 1);
  }
});
test("in, drive, steer, brake, out", () => {
  const K = createCars(city);
  K.update(DT, street, null);
  const c = K.cars.find((q) => q.on);
  assert.equal(K.near(c.x + 1.5, 0, c.z), c);
  assert.ok(K.enter(c));
  const x0 = c.x, z0 = c.z, y0 = c.yaw;
  for (let i = 0; i < 2 / DT; i++) K.update(DT, street, { throttle: 1, steer: 0 });
  assert.ok(c.speed > 10, "speed " + c.speed);
  assert.ok(Math.hypot(c.x - x0, c.z - z0) > 8 || K.stats.bumps > 0, "moved or met a wall");
  for (let i = 0; i < 1 / DT; i++) K.update(DT, street, { throttle: 0.6, steer: 1 });
  assert.ok(Math.abs(c.yaw - y0) > 0.3 || K.stats.bumps > 0, "steered: " + (c.yaw - y0).toFixed(2));
  const v0 = Math.abs(c.speed);
  let t = 0;
  for (; t < 3 && c.speed > 0.3; t += DT) K.update(DT, street, { throttle: -1, steer: 0 });
  assert.ok(c.speed <= 0.3 && t < 1.5, "braked from " + v0.toFixed(1) + " m/s in " + t.toFixed(2) + " s");
  for (let i = 0; i < 1 / DT; i++) K.update(DT, street, { throttle: -1, steer: 0 });
  assert.ok(c.speed < -1, "then reverses: " + c.speed.toFixed(2));
  const out = K.exit();
  assert.ok(out && !K.driving && Math.hypot(out.x - c.x, out.z - c.z) < 2.5 && !city.collideSphere(out.x, 0.9, out.z, 0.3));
});
test("a car never drives into a building: it stops and bounces", () => {
  const K = createCars(city);
  K.update(DT, street, null);
  const c = K.cars.find((q) => q.on);
  K.enter(c);
  for (let i = 0; i < 20 / DT; i++) {
    K.update(DT, street, { throttle: 1, steer: Math.sin(i * 0.05) });
    assert.ok(!city.collideSphere(c.x, 0.8, c.z, 0.9), "inside a building at " + c.x.toFixed(1) + ", " + c.z.toFixed(1));
  }
  assert.ok(K.stats.bumps >= 1, "met a wall at least once in 20 s of wild steering");
});

/* ---------------- car theft ---------------- */
// a fake traffic buffer in cityview.js's layout: lane (x, y, z, heading), move (length, speed, phase), colour
function fakeTraffic(lanes) {
  const n = lanes.length, T = { n, lane: new Float32Array(n * 4), move: new Float32Array(n * 4), color: new Float32Array(n * 3) };
  lanes.forEach((l, i) => { T.lane.set([l.x, l.y || 0, l.z, l.h], i * 4); T.move.set([l.len, l.v, l.ph || 0, 0], i * 4); T.color.set(l.col || [0.7, 0.12, 0.1], i * 3); });
  return T;
}
// CAR_VS by hand: s = mod(phase + speed t, length) (GLSL mod floors), f from the heading
const shader = (l, t) => { const s = (l.ph || 0) + l.v * t, m = s - l.len * Math.floor(s / l.len), f = [[1, 0], [-1, 0], [0, 1], [0, -1]][l.h]; return { x: l.x + f[0] * m, z: l.z + f[1] * m, s: m }; };
test("trafficAt follows the traffic shader for every heading, and wraps like GLSL mod", () => {
  const lanes = [0, 1, 2, 3].map((h) => ({ x: -300, z: 12.25, h, len: 640, v: 11.25, ph: 37 }));
  const T = fakeTraffic(lanes);
  for (const t of [0, 3.7, 55.5, 1234.25, -2]) for (let i = 0; i < 4; i++) {
    const a = trafficAt(T, i, t), b = shader(lanes[i], t);
    assert.ok(Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.z - b.z) < 1e-3 && a.s >= 0 && a.s < 640, "heading " + i + " at " + t + ": " + JSON.stringify([a.x, a.z, b.x, b.z]));
    // cars.js yaw: the front is (-sin yaw, -cos yaw), the shader's f
    assert.ok(Math.abs(-Math.sin(a.yaw) - a.fx) < 1e-9 && Math.abs(-Math.cos(a.yaw) - a.fz) < 1e-9, "yaw of heading " + i);
  }
  assert.deepEqual(trafficAt(T, 0, 0).paint.map((v) => +v.toFixed(2)), [0.7, 0.12, 0.1]);
});
test("nearTraffic: a street car beside the hero is in reach; expressway, hidden and lane-end cars are not", () => {
  const lane = { x: -400, z: 12.25, h: 0, len: 800, v: 10 }; // eastbound; at t = 25 its middle is at x = -150
  const T = fakeTraffic([lane, { ...lane, y: 12 }, { ...lane, y: -500 }, { ...lane, z: 30 }]);
  const n = nearTraffic(T, -150, 9.25, 25);
  assert.ok(n && n.i === 0 && Math.abs(n.dist - 3) < 1e-3 && n.speed === 10, JSON.stringify(n));
  assert.ok(nearTraffic(T, -152, 9.25, 25), "beside the car's tail, still in reach");
  assert.ok(Math.abs(nearTraffic(T, -148, 12.25 - 3.4, 25).dist - 3.4) < 1e-3, "beside the bonnet: the distance is to the body, not the middle");
  assert.equal(nearTraffic(T, -150, 12.25 - CAR.steal - 0.2, 25), null, "out of reach");
  assert.equal(nearTraffic(T, -150, 9.25, 25 + 30), null, "the car has driven on");
  assert.equal(nearTraffic(T, -399, 12.25, 0.05), null, "fading in at the lane's start");
  assert.equal(nearTraffic(fakeTraffic([{ ...lane, y: 12 }]), -150, 12.25, 25), null, "an expressway car overhead");
});
test("steal: the street car becomes a stopped car to drive, in its colour; it outlives the parked range, then gives the traffic car back", () => {
  const K = createCars(city);
  K.update(DT, street, null);
  const T = fakeTraffic([{ x: -400, z: 12.25, h: 0, len: 800, v: 10, col: [0.14, 0.24, 0.5] }]);
  const t = nearTraffic(T, -150, 9.25, 25);
  const c = K.steal(t, { x: -150, z: 9.25 });
  assert.ok(c && c.on && c.traffic === 0 && c.speed === 0 && Math.abs(c.x + 150) < 1e-3 && Math.abs(c.z - 12.25) < 1e-3 && Math.abs(c.yaw + Math.PI / 2) < 1e-9, JSON.stringify(c));
  assert.deepEqual(c.paint.map((v) => +v.toFixed(2)), [0.14, 0.24, 0.5]);
  assert.ok(K.enter(c) && K.driving === c && K.events.some((e) => e.type === "steal" && e.traffic === 0));
  for (let i = 0; i < 2 / DT; i++) K.update(DT, street, { throttle: 1, steer: 0 });
  assert.ok(c.speed > 6, "drives: " + c.speed.toFixed(1));
  K.exit();
  for (let i = 0; i < 4 / DT; i++) K.update(DT, street, null);
  const left = { x: c.x, z: c.z };
  K.events.length = 0;
  // 250 m away: a parked car would go, the stolen car stays where it was left
  K.update(DT, { x: left.x, y: 0, z: left.z - 250 }, null);
  assert.ok(c.on && c.traffic === 0 && Math.hypot(c.x - left.x, c.z - left.z) < 0.5, "still parked where it was left");
  assert.ok(!K.events.some((e) => e.type === "release"));
  K.update(DT, { x: left.x, y: 0, z: left.z - 450 }, null);
  assert.ok(K.events.some((e) => e.type === "release" && e.traffic === 0), "past 400 m it goes and the traffic car comes back");
  assert.equal(c.traffic, -1);
});
test("steal with every car slot taken reuses the farthest car; no theft while driving", () => {
  const K = createCars(city, { max: 2 });
  K.update(DT, street, null);
  const T = fakeTraffic([{ x: -400, z: 12.25, h: 0, len: 800, v: 10 }, { x: -400, z: 15.75, h: 0, len: 800, v: 10 }]);
  const a = K.steal(trafficAt(T, 0, 25), street);
  const b = K.steal(trafficAt(T, 1, 25), street);
  assert.ok(a && b && a !== b && K.cars.filter((c) => c.on).length === 2, "two stolen cars in two slots");
  assert.ok(K.enter(b));
  assert.equal(K.steal(trafficAt(T, 0, 26), street), null, "no theft while driving");
  K.exit();
  K.events.length = 0;
  const c = K.steal(trafficAt(T, 0, 30), { x: b.x, z: b.z });
  assert.ok(c === a && K.events.some((e) => e.type === "release" && e.traffic === 0), "the farthest slot is reused and its traffic car released");
});
test("the robbed driver jumps out, runs to the sidewalk and flees away from the hero", () => {
  const S = createStreet(city);
  S.update(DT, 0, street, null, null);
  const p = S.bail(-125, 12.25 + 1.4, -130, 9.25, "x"); // mid-block on the z = 14 avenue, the hero to the west
  assert.ok(p && p.on && p.state === "bail", "bailing");
  const x0 = p.x;
  let onWalk = -1;
  for (let i = 0; i < 6 / DT; i++) { S.update(DT, i * DT, street, null, null); if (onWalk < 0 && S.onWalk(p)) onWalk = i * DT; }
  assert.ok(onWalk >= 0 && onWalk < 4, "on a sidewalk after " + onWalk.toFixed(2) + " s");
  assert.ok(S.onWalk(p), "and stays on the sidewalk");
  assert.ok(p.x - x0 > 5, "ran away from the hero (east): " + (p.x - x0).toFixed(1) + " m");
});

/* ---------------- jobs ---------------- */
function runJob(type, act, secs = 200) {
  const C = createCombat(city), J = createJobs({ city, combat: C });
  const h0 = hero(city.start.x, city.start.y, city.start.z);
  J.update(DT, 0, h0);
  const o = J.offers.find((q) => q.type === type) || null;
  J.start(type, o, h0);
  const A0 = J.active;
  let h = hero(A0.o.x, A0.o.y, A0.o.z);
  const ev = [];
  for (let i = 0; i < secs / DT && J.active; i++) {
    h = act(J, C, h, i * DT) || h;
    C.update(DT, h); J.update(DT, i * DT, h);
    for (const e of J.events) ev.push(e); J.events.length = 0;
  }
  return { J, C, ev, end: ev.find((e) => e.type === "done" || e.type === "failed") };
}
test("Sludge Run: catch the runner, beat his crew, the bomb is defused", () => {
  const r = runJob("sludge", (J, C, h) => {
    const t = C.goons.find((g) => C.alive(g));
    if (!t) return h;
    const nh = hero(t.x + 1.2, t.y, t.z, { safe: true });
    C.attack(nh);
    return nh;
  });
  assert.ok(r.end && r.end.type === "done" && r.end.why === "defused", JSON.stringify(r.end));
  assert.equal(r.end.reward, JOB.sludge.reward);
  assert.ok(r.C.stats.kos >= 1 + JOB.sludge.crew, "the runner and his crew: " + r.C.stats.kos);
  assert.ok(r.J.story.sludge);
});
test("Sludge Run left alone: the runner reaches the drain and it fails", () => {
  const r = runJob("sludge", (J, C, h) => hero(h.x, h.y, h.z));
  assert.ok(r.end && r.end.type === "failed" && (r.end.why === "drain" || r.end.why === "time"), JSON.stringify(r.end));
});
test("Catch!: be there when they fall, then land to set them down", () => {
  const r = runJob("catch", (J, C, h) => {
    const A = J.active;
    if (!A) return h;
    const p = A.data.p;
    if (A.data.falling && !A.data.caught) return hero(p.x, p.y - 1.2, p.z, { onGround: false });
    if (A.data.caught) return hero(h.x, Math.max(0, city.groundY(h.x, h.z)), h.z, { onGround: true });
    return h;
  });
  assert.ok(r.end && r.end.type === "done", JSON.stringify(r.end));
});
test("Catch! missed: the dumpster breaks the fall and the job fails", () => {
  const r = runJob("catch", (J, C, h) => (J.active ? hero(J.active.o.x + 200, J.active.o.y, J.active.o.z) : h));
  assert.ok(r.end && r.end.type === "failed" && r.end.why === "dumpster", JSON.stringify(r.end));
});
test("Catch!: every fall drops clear to the street, with time to get there (no ledge in the way)", () => {
  let n = 0, worst = Infinity;
  const bad = [];
  for (let seed = 1; seed <= 200; seed++) {
    const C = createCombat(city), J = createJobs({ city, combat: C, seed });
    const S = city.safe[seed % city.safe.length], h0 = hero(S.x, S.y, S.z);
    J.update(DT, 0, h0);
    const o = J.offers.find((q) => q.type === "catch");
    if (!o) continue;
    J.start("catch", o, h0);
    const far = hero(o.x + 300, 0, o.z + 300);
    let fallT = 0, end = null, landY = null;
    const P = J.active.data.p;
    for (let i = 0; i < 60 / DT && J.active; i++) {
      if (J.active.data.falling) fallT += DT;
      J.update(DT, i * DT, far);
      landY = P.y;
      for (const e of J.events) if (e.type === "failed" || e.type === "done") end = e;
      J.events.length = 0;
    }
    n++;
    worst = Math.min(worst, fallT);
    if (!end || end.why !== "dumpster" || landY > JOB.catch.clear || fallT < 2.5) bad.push({ seed, roof: o.y, why: end && end.why, landY, fallT: +fallT.toFixed(2) });
  }
  assert.ok(n >= 60, "enough catch offers to judge: " + n);
  assert.deepEqual(bad, [], "a fall that ends on a ledge or too soon");
  console.log("  INFO: " + n + " catch jobs, the shortest fall " + worst.toFixed(1) + " s");
});
test("Window Washer: reach him, carry him down to the street", () => {
  const r = runJob("washer", (J, C, h) => {
    const A = J.active;
    if (!A) return h;
    if (!A.data.caught) { const p = A.data.p; return hero(p.x, p.y - 1, p.z, { onGround: false }); }
    return hero(A.o.x, 0, A.o.z, { onGround: true });
  });
  assert.ok(r.end && r.end.type === "done", JSON.stringify(r.end));
});
test("Pizza Rush: on the roof in time pays, late is a cold pizza", () => {
  const ok = runJob("pizza", (J, C, h, t) => (t > 3 && J.active ? hero(J.active.data.drop.x, J.active.data.drop.y, J.active.data.drop.z) : h));
  assert.ok(ok.end && ok.end.type === "done" && ok.end.reward > JOB.pizza.reward, JSON.stringify(ok.end));
  const late = runJob("pizza", (J, C, h) => h);
  assert.ok(late.end && late.end.type === "failed" && late.end.why === "cold", JSON.stringify(late.end));
});
test("Balloon Chase: grab it, give it back; or it floats away", () => {
  const ok = runJob("balloon", (J, C, h, t) => {
    const A = J.active;
    if (!A) return h;
    if (!A.data.b.held && t > 4) return hero(A.data.b.x, A.data.b.y - 1.6, A.data.b.z, { onGround: false });
    if (A.data.b.held) return hero(A.data.kid.x + 1, A.data.kid.y, A.data.kid.z);
    return h;
  });
  assert.ok(ok.end && ok.end.type === "done", JSON.stringify(ok.end));
  const gone = runJob("balloon", (J, C, h) => (J.active ? hero(J.active.o.x + 100, J.active.o.y, J.active.o.z) : h));
  assert.ok(gone.end && gone.end.type === "failed" && gone.end.why === "gone", JSON.stringify(gone.end));
});
test("Rooftop Brawl: two waves, then it is cleared", () => {
  const r = runJob("brawl", (J, C, h) => {
    const t = C.goons.find((g) => C.alive(g));
    if (!t) return h;
    const nh = hero(t.x + 1.2, t.y, t.z, { safe: true });
    C.attack(nh);
    return nh;
  });
  assert.ok(r.end && r.end.type === "done" && r.end.why === "cleared", JSON.stringify(r.end));
  assert.ok(r.C.stats.kos >= JOB.brawl.wave1 + JOB.brawl.wave2);
});
test("markers: four offers of different jobs round the player, and walking into one starts it", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C });
  const h = hero(city.start.x, city.start.y, city.start.z);
  J.update(DT, 0, h);
  assert.ok(J.offers.length >= 3, "offers " + J.offers.length);
  assert.equal(new Set(J.offers.map((o) => o.type)).size, J.offers.length);
  for (const o of J.offers) { const d = Math.hypot(o.x - h.x, o.z - h.z); assert.ok(d >= JOB.near[0] - 1 && d <= JOB.near[1] + 30, o.type + " at " + d.toFixed(0)); }
  const o = J.offers[0];
  J.update(DT, 0, hero(o.x + 1, o.y, o.z));
  assert.equal(J.active && J.active.type, o.type);
  J.offersOn = true;
});

console.log(fails ? "FAIL: action (" + fails + " failed)" : "PASS: action");
process.exitCode = fails ? 1 : 0;
