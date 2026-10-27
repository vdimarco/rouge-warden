// The city action, with no browser: the Sludge Gang (js/combat.js), the cars (js/cars.js) and the jobs (js/jobs.js).
// Run from the repo root: node qa/vr/action.test.mjs
import assert from "node:assert/strict";
import { generate } from "../../public/vr/js/city.js";
import { createCombat, FIGHT } from "../../public/vr/js/combat.js";
import { createCars, CAR, trafficAt, nearTraffic } from "../../public/vr/js/cars.js";
import { createStreet } from "../../public/vr/js/street.js";
import { createJobs, JOB, CRIME_LINES, MISS, STORY_ROUTE, STORY_NEAR } from "../../public/vr/js/jobs.js";

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
test("a goon on the street goes round a block corner to the hero, not into the wall", () => {
  // the goon and the hero on the sidewalks of two streets that meet, with the block's corner building between them
  const open = (x, z) => !city.isWater(x, z) && !city.collideSphere(x, 0.9, z, 0.32) && !city.topBelow(x, 0.6, z, 0.25);
  const clear = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0)); for (let i = 1; i <= n; i++) if (!open(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n)) return false; return true; };
  const cases = [];
  for (const x of city.streets.xs) for (const z of city.streets.zs) {
    const g = { x: x - 8, z: z - 22 }, h = { x: x - 22, z: z - 8 };
    if (open(g.x, g.z) && open(h.x, h.z) && !clear(g.x, g.z, h.x, h.z)) cases.push({ g, h });
  }
  assert.ok(cases.length >= 20, "corners " + cases.length);
  for (const k of [0, Math.floor(cases.length / 2), cases.length - 1]) {
    const { g: s, h: at } = cases[k];
    const C = createCombat(city), h = hero(at.x, 0, at.z);
    const g = C.spawn(s.x, 0, s.z, "t"); g.aggro = true;
    let hit = false;
    for (let i = 0; i < 12 / DT && !hit; i++) {
      C.update(DT, h);
      if (C.events.some((e) => e.type === "hurt")) hit = true;
      C.events.length = 0;
      assert.ok(open(g.x, g.z), "inside a wall at " + g.x.toFixed(1) + ", " + g.z.toFixed(1));
    }
    assert.ok(hit, "reached and punched from " + s.x + ", " + s.z + "; stopped at " + g.x.toFixed(1) + ", " + g.z.toFixed(1));
  }
});
test("a goon whose straight way a post blocks slides past it", () => {
  // a post 3 m in front of the goon, a little to one side of his line to the hero
  const C = createCombat(city), h = hero(street.x, 0, street.z);
  const g = C.spawn(street.x - 12, 0, street.z, "t"); g.aggro = true;
  const real = city.collideSphere;
  city.collideSphere = (x, y, z, r, o) => Math.hypot(x - (street.x - 9), z - (street.z + 0.2)) < r + 0.3 || real(x, y, z, r, o);
  try {
    for (let i = 0; i < 6 / DT; i++) { C.update(DT, h); C.events.length = 0; }
  } finally { city.collideSphere = real; }
  assert.ok(Math.hypot(g.x - h.x, g.z - h.z) < FIGHT.reach, "got past: " + g.x.toFixed(2) + ", " + g.z.toFixed(2));
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

test("a goon who winds up near the hero is a threat; a dodge in the wind-up makes his blow miss (a perfect dodge)", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z);
  const g = C.spawn(street.x - 1.4, 0, street.z, "t"); g.aggro = true;
  assert.equal(C.dodge(h), null, "no threat yet: no dodge");
  let t = 0;
  while (g.state !== "windup" && t < 4) { C.update(DT, h); t += DT; }
  assert.equal(g.state, "windup", "wound up");
  assert.equal(C.threat(h), g);
  const d = C.dodge(h, 0, 1);
  assert.ok(d && d.perfect, "a perfect dodge");
  assert.ok(Math.abs(Math.hypot(d.dx, d.dz) - 1) < 1e-6, "a unit direction");
  for (let i = 0; i < 1 / DT; i++) C.update(DT, h); // the blow comes while the dodge holds
  assert.equal(C.hp, FIGHT.hp, "no heart lost");
  assert.equal(C.stats.perfect, 1);
  assert.ok(C.focus >= FIGHT.focus.perfect - 1e-9, "the meter filled: " + C.focus);
});
test("with no dodge, the same blow lands", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z);
  C.spawn(street.x - 1.4, 0, street.z, "t").aggro = true;
  for (let i = 0; i < 3 / DT; i++) C.update(DT, h); // (his first blow lands 1.3 to 2.3 s in)
  assert.ok(C.hp < FIGHT.hp);
});
test("perch takedown: from above, an unaware guard is lifted and hangs; the guard beside him does not notice", () => {
  const C = createCombat(city);
  const g = C.spawn(street.x - 6, 0, street.z, "t"), o = C.spawn(street.x - 9, 0, street.z, "t");
  const h = hero(street.x, 9, street.z, { onGround: true, perch: true });
  for (let i = 0; i < 0.5 / DT; i++) C.update(DT, h);
  assert.ok(!g.aggro && !o.aggro, "they have not seen the hero above them");
  assert.ok(C.targets(h).includes(g), "a perched hero can rope the guard");
  assert.ok(!C.targets({ ...h, perch: false }).includes(g), "in a swing, a quiet guard is no target");
  assert.equal(C.pull(g.id, h), "takedown");
  for (let i = 0; i < 1 / DT; i++) C.update(DT, h);
  assert.equal(g.state, "hung");
  assert.ok(g.y > 3 && g.y <= h.y - FIGHT.perch.under + 1e-6, "lifted under the hero: " + g.y.toFixed(2));
  assert.ok(Math.abs(g.bp - Math.PI) < 0.01, "upside down");
  assert.ok(!o.aggro && o.state === "idle", "the other guard stays quiet");
  assert.equal(C.stats.takedowns, 1);
  for (let i = 0; i < (FIGHT.perch.hang + 1) / DT; i++) C.update(DT, h);
  assert.ok(!C.goons.includes(g), "he is gone after a while");
});
test("no takedown on a guard who has seen the hero, or from the same level: a plain pull", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z, { perch: true });
  const g = C.spawn(street.x - 8, 0, street.z, "t");
  assert.equal(C.perched(g, h), false);
  g.aggro = true;
  assert.equal(C.perched(g, { ...h, y: 9 }), false);
  assert.equal(C.pull(g.id, h), "pull");
});
test("the combo count and the focus meter; a full meter finishes every goon in reach", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z, { safe: true });
  const a = C.spawn(street.x - 1.4, 0, street.z, "t", { hp: 9 }), b = C.spawn(street.x + 1.6, 0, street.z, "t", { hp: 9 });
  assert.equal(C.finish(h), null, "an empty meter does nothing");
  for (let i = 0; i < 3; i++) { C.attack(h); for (let k = 0; k < 5; k++) C.update(0.1, h); }
  assert.equal(C.hits, 3, "three blows in a row");
  assert.ok(C.focus > 0 && C.focus < 1);
  C.focus = 1;
  a.x = street.x - 1.4; a.z = street.z; b.x = street.x + 1.6; b.z = street.z; // (the kick pushed one away)
  const out = C.finish(h);
  assert.ok(out && out.length === 2, "both goons in reach: " + (out && out.length));
  assert.ok(a.state === "down" && b.state === "down");
  assert.equal(C.focus, 0, "the meter empties");
  for (let i = 0; i < 3 / DT; i++) C.update(DT, h);
  assert.equal(C.hits, 0, "the count ends after a gap");
});

test("a rope pull drags the goons beside the caught one into a heap at the hero's feet", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z, { safe: true });
  const g = C.spawn(street.x - 12, 0, street.z, "t"), a = C.spawn(street.x - 13.5, 0, street.z + 1, "t"), b = C.spawn(street.x - 12, 0, street.z - 1.8, "t"), far = C.spawn(street.x - 25, 0, street.z, "t");
  for (const q of [g, a, b, far]) q.aggro = true;
  assert.equal(C.pull(g.id, h), "pull");
  assert.equal(C.stats.heaps, 1);
  for (let i = 0; i < 1 / DT; i++) C.update(DT, h);
  for (const q of [g, a, b]) assert.ok(Math.hypot(q.x - h.x, q.z - h.z) < 3.5, "pulled to the feet: " + Math.hypot(q.x - h.x, q.z - h.z).toFixed(2));
  assert.ok(a.hp <= 1 && b.hp <= 1, "the heap hurts: " + a.hp + ", " + b.hp);
  assert.ok(Math.hypot(far.x - h.x, far.z - h.z) > 8, "a goon 13 m away stays");
});
test("a throw hits the goon the hero faces, in range, then waits its cool-down", () => {
  const C = createCombat(city), h = hero(street.x, 0, street.z, { yaw: Math.PI / 2, safe: true }); // facing -x
  const g = C.spawn(street.x - 8, 0, street.z, "t"), behind = C.spawn(street.x + 8, 0, street.z, "t");
  g.hp = 5; behind.hp = 5;
  assert.equal(C.throwTarget(h), g, "the goon in front");
  const t = C.throw(h);
  assert.ok(t && t.goon === g && t.time > 0);
  assert.equal(C.throw(h), null, "a cool-down before the next throw");
  assert.ok(C.landThrow(g.id, h.x, h.z));
  assert.equal(g.hp, 5 - FIGHT.throw.dmg);
  assert.equal(behind.hp, 5);
  const near = createCombat(city); near.spawn(street.x - 1, 0, street.z, "t");
  assert.equal(near.throwTarget(h), null, "too close to throw: punch instead");
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

test("car against car: a driven car meets a parked car, they never overlap, and the parked car is pushed", () => {
  const K = createCars(city);
  K.update(DT, street, null);
  // two cars on the z = 14 avenue, 14 m apart along it, the first facing the second (yaw pi/2 faces -x)
  const [a, b] = K.cars;
  for (const c of K.cars) c.on = false;
  Object.assign(a, { on: true, x: -140, y: 0, z: 14, yaw: Math.PI / 2, speed: 0, side: 0, vx: 0, vz: 0, job: false, traffic: -1 });
  Object.assign(b, { on: true, x: -154, y: 0, z: 14, yaw: Math.PI / 2, speed: 0, side: 0, vx: 0, vz: 0, job: false, traffic: -1 });
  const keep = { x: -147, y: 0, z: 14 };
  assert.ok(K.enter(a));
  let minGap = 99, hit = false;
  for (let i = 0; i < 3 / DT; i++) {
    K.update(DT, keep, { throttle: 1, steer: 0 });
    minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.z - b.z));
    if (K.events.some((e) => e.type === "bump" && e.car)) hit = true;
  }
  assert.ok(hit && K.stats.crashes > 0, "a crash: " + K.stats.crashes);
  assert.ok(minGap > CAR.hit.r * 2 - 0.15, "the cars never sink into each other: closest " + minGap.toFixed(2) + " m between middles");
  assert.ok(b.x < -154.5, "the parked car was pushed along: " + (b.x + 154).toFixed(2) + " m");
});
test("the driven car hits a street car: it becomes a real car and takes the hit", () => {
  const K = createCars(city);
  K.update(DT, street, null);
  for (const c of K.cars) c.on = false;
  const a = K.cars[0];
  // a street car standing still on the lane at x = -158 (speed 0.001); the hero drives at it from 12 m behind
  const T = fakeTraffic([{ x: -400, z: 12.25, h: 0, len: 800, v: 0.001, ph: 242, col: [0.7, 0.12, 0.1] }]); // (mid-lane: the lane ends are skipped)
  Object.assign(a, { on: true, x: -146, y: 0, z: 12.25, yaw: Math.PI / 2, speed: 0, side: 0, vx: 0, vz: 0, job: false, traffic: -1 });
  assert.ok(K.enter(a));
  const ev = [];
  for (let i = 0; i < 3 / DT; i++) { K.update(DT, { x: -150, y: 0, z: 12 }, { throttle: 1, steer: 0 }, { T, t: 25 }); ev.push(...K.events); K.events.length = 0; }
  const struck = ev.find((e) => e.type === "struck");
  assert.ok(struck && struck.traffic === 0, "the street car was struck: " + JSON.stringify(ev.map((e) => e.type)));
  const q = K.cars.find((c) => c.on && c.traffic === 0);
  assert.ok(q && q !== a && Math.hypot(q.x - a.x, q.z - a.z) > CAR.hit.r * 2 - 0.15, "a real car now, not overlapping");
  assert.ok(ev.some((e) => e.type === "bump" && e.car), "and a crash");
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
/* ---------------- crimes ---------------- */
test("a crime starts near the hero with a shout and a marker, is taken from close, and is over after a minute if nobody comes", () => {
  const C = createCombat(city), K = createCars(city), J = createJobs({ city, combat: C, cars: K });
  J.crimesOn = true;
  const h = hero(-150, 0, 14);
  let crime = null, t = 0;
  for (; t < JOB.crime.first + 5 && !crime; t += DT) { J.update(DT, t, h); crime = J.events.find((e) => e.type === "crime"); }
  assert.ok(crime, "a crime within " + (JOB.crime.first + 5) + " s");
  assert.ok(CRIME_LINES[crime.job].includes(crime.line), "the shout: " + crime.line);
  const o = J.offers.find((q) => q.crime);
  const d = Math.hypot(o.x - h.x, o.z - h.z);
  assert.ok(d >= JOB.crime.near[0] - 1 && d <= JOB.crime.near[1] + 30, "near the hero: " + d.toFixed(0) + " m");
  J.events.length = 0;
  for (let k = 0; k < (JOB.crime.last + 2) / DT; k++) { t += DT; J.update(DT, t, h); }
  assert.ok(J.events.some((e) => e.type === "crimeover"), "over after a minute");
  assert.ok(!J.offers.some((q) => q.crime && q.id === o.id));
  // a new one: swing close and it starts
  const o2 = J.crime("mugging", h, t);
  assert.ok(o2);
  J.update(DT, t, hero(o2.x + JOB.crime.take - 3, 20, o2.z));
  assert.equal(J.active && J.active.type, "mugging");
  assert.ok(J.info().active.crime);
});
test("Mugging: beat the three goons and the victim thanks you, with a quip", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C });
  const h = hero(-150, 0, 14);
  J.start("mugging", null, h);
  assert.equal(C.group("job").length, JOB.mugging.crew);
  J.active.o.crime = true;
  for (const g of C.group("job")) g.hp = 0, g.state = "down";
  const ev = [];
  J.update(DT, 1, h); ev.push(...J.events);
  assert.ok(ev.some((e) => e.type === "done" && e.job === "mugging"));
  assert.ok(ev.filter((e) => e.type === "say").length >= 2, "thanks and a quip");
});
test("Getaway Car: it drives itself along the streets; a rope stops it, the crew jumps out, and beating them ends it", () => {
  const C = createCombat(city), K = createCars(city), J = createJobs({ city, combat: C, cars: K });
  const h = hero(-150, 0, 14);
  K.update(DT, h, null);
  J.start("getaway", null, h);
  const car = J.active.data.car;
  assert.ok(car && car.job && car.auto, "a job car on autopilot");
  const p0 = { x: car.x, z: car.z };
  for (let i = 0; i < 3 / DT; i++) { K.update(DT, h, null); J.update(DT, i * DT, h); }
  assert.ok(Math.hypot(car.x - p0.x, car.z - p0.z) > 15, "it drove " + Math.hypot(car.x - p0.x, car.z - p0.z).toFixed(1) + " m");
  assert.ok(!city.collideSphere(car.x, 0.8, car.z, 0.9), "on the street");
  assert.ok(J.ropeTargets(h).some((q) => q.tag === "getaway"), "the car is a rope target");
  assert.ok(J.ropeCaught("getaway"));
  for (let i = 0; i < 4 / DT; i++) { K.update(DT, h, null); J.update(DT, 3 + i * DT, h); }
  assert.ok(Math.abs(car.speed) < 0.5, "it stopped: " + car.speed.toFixed(2));
  assert.equal(C.group("job").length, JOB.getaway.crew, "the crew jumped out");
  for (const g of C.group("job")) g.hp = 0, g.state = "down";
  const ev = [];
  J.update(DT, 8, h); ev.push(...J.events);
  assert.ok(ev.some((e) => e.type === "done" && e.job === "getaway"));
  assert.ok(!car.job, "the car is let go");
});
test("Getaway Car: left alone it gets away", () => {
  const C = createCombat(city), K = createCars(city), J = createJobs({ city, combat: C, cars: K });
  const h = hero(-150, 0, 14);
  J.start("getaway", null, h);
  const ev = [];
  for (let i = 0; i < 200 / DT && J.active; i++) { K.update(DT, h, null); J.update(DT, i * DT, h); ev.push(...J.events); J.events.length = 0; }
  assert.ok(ev.some((e) => e.type === "failed" && e.why === "away"));
});
test("Sludge Tanker: three plunges seal the leak; with the crew down it is done; the clock runs out and it floods", () => {
  const C = createCombat(city), K = createCars(city), J = createJobs({ city, combat: C, cars: K });
  const h = hero(-150, 0, 14);
  J.start("tanker", null, h);
  assert.ok(J.active.data.car && J.active.data.car.tanker, "a tanker car");
  for (let k = 0; k < JOB.tanker.seals; k++) { assert.ok(J.ropeTargets(h).some((q) => q.tag === "leak")); assert.ok(J.ropeCaught("leak")); }
  assert.ok(!J.ropeTargets(h).some((q) => q.tag === "leak"), "sealed: no more leak target");
  J.update(DT, 1, h);
  assert.ok(J.active, "not done while the crew stands");
  for (const g of C.group("job")) g.hp = 0, g.state = "down";
  const ev = [];
  J.update(DT, 2, h); ev.push(...J.events);
  assert.ok(ev.some((e) => e.type === "done" && e.job === "tanker"));
  const C2 = createCombat(city), J2 = createJobs({ city, combat: C2, cars: createCars(city) });
  J2.start("tanker", null, h);
  const ev2 = [];
  for (let i = 0; i < (JOB.tanker.time + 2) / DT && J2.active; i++) { J2.update(DT, i * DT, { ...h, safe: true }); ev2.push(...J2.events); J2.events.length = 0; }
  assert.ok(ev2.some((e) => e.type === "failed" && e.why === "flood"));
});
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
test("Sludge Run waits out the first swing: the runner and the clock stay until the chase is released", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C });
  const S = city.start, h = hero(S.x, S.y, S.z, { safe: true });
  J.start("sludge", null, h);
  J.holdChase(true);
  const g = C.goons.find((q) => q.runner);
  const x0 = g.x, z0 = g.z, t0 = J.active.timer;
  for (let i = 0; i < 90; i++) { C.update(DT, h); J.update(DT, i * DT, h); J.events.length = 0; C.events.length = 0; }
  assert.ok(J.active && J.active.data.hold, "still waiting");
  assert.ok(Math.hypot(g.x - x0, g.z - z0) < 0.2, "he waits: moved " + Math.hypot(g.x - x0, g.z - z0).toFixed(2));
  assert.ok(Math.abs(J.active.timer - t0) < 1e-6, "the clock waits: " + J.active.timer);
  assert.match(J.card.detail, /swing first/i);
  assert.equal(J.card.short, "SWING");
  J.holdChase(false);
  for (let i = 0; i < 60; i++) { C.update(DT, h); J.update(DT, i * DT, h); J.events.length = 0; C.events.length = 0; }
  assert.ok(J.active && !J.active.data.hold);
  assert.ok(Math.hypot(g.x - x0, g.z - z0) > 2, "then he runs: " + Math.hypot(g.x - x0, g.z - z0).toFixed(1));
  assert.ok(J.active.timer < t0 - 1, "and the clock runs: " + J.active.timer.toFixed(2));
  assert.match(J.card.detail, /catch the runner/i);
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
test("the eighth-flush washer hangs for 36 s inside a swing, and an odd job keeps 60", () => {
  const spots = [hero(city.start.x, city.start.y, city.start.z), hero(-200, 0, 40), hero(180, 0, -120), hero(40, 0, -200)];
  for (let seed = 1; seed <= 24; seed++) {
    const C = createCombat(city), J = createJobs({ city, combat: C, seed });
    const h = spots[seed % spots.length];
    const o = J.prepare("washer", h, [24, 140]);
    assert.ok(o && o.hang, "a tower in the beat band, seed " + seed);
    const d = Math.hypot(o.hang.x - h.x, o.hang.z - h.z);
    assert.ok(d <= 160, "within a swing: " + d.toFixed(0) + " m");
    J.start("washer", o, h, { mission: "GET HIM DOWN" });
    assert.equal(J.active.timer, JOB.washer.beat, "seed " + seed + " d " + d.toFixed(0));
    J.update(0, 0, h);
    assert.ok(/36 s/.test(J.card.title), J.card.title);
  }
  const C = createCombat(city), J = createJobs({ city, combat: C, seed: 2 });
  const h = hero(city.start.x, city.start.y, city.start.z);
  const odd = J.prepare("washer", h, [90, 420]) || J.prepare("washer", h);
  assert.ok(odd);
  J.start("washer", odd, h);
  assert.equal(J.active.timer, JOB.washer.grip);
  J.update(0, 0, h);
  assert.ok(/60 s/.test(J.card.title), J.card.title);
  const origin = hero(h.x, 0, h.z);
  const far = { id: 9, type: "washer", name: "Window Washer", x: origin.x + 800, y: 0, z: origin.z, hang: { x: origin.x + 800, y: 50, z: origin.z, nx: 1, nz: 0 } };
  J.start("washer", far, origin, { mission: "GET HIM DOWN" });
  assert.equal(J.active.timer, JOB.washer.grip, "a far tower is not cut to 36 s");
  const away = hero(origin.x + 200, 0, origin.z);
  let end = null;
  for (let t = 0; t < 40 && J.active; t += DT) {
    J.update(DT, t, away);
    for (const e of J.events) if (e.type === "failed") end = e;
    J.events.length = 0;
  }
  assert.ok(!end, "the far clock is still running at 40 s");
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
test("Taxi!: on foot the fare only shouts; driving into the marker takes the job", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C });
  const h0 = hero(city.start.x, city.start.y, city.start.z);
  let o = null;
  for (let k = 0; k < 40 && !o; k++) { J.update(DT, 0, hero(h0.x + k * 700, 0, h0.z)); o = J.offers.find((q) => q.type === "taxi"); }
  assert.ok(o, "a taxi offer");
  J.events.length = 0;
  J.update(DT, 0, hero(o.x, o.y, o.z));
  assert.ok(!J.active, "on foot: no job");
  assert.ok(J.events.some((e) => e.type === "say" && /car/.test(e.line)), "the fare says to come back with a car");
  J.update(DT, 0, hero(o.x, o.y, o.z, { busy: true, driving: true }));
  assert.ok(J.active && J.active.type === "taxi", "driving in: the taxi job");
});
test("driving through any other marker starts nothing, and the marker stays", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C });
  J.update(DT, 0, hero(city.start.x, city.start.y, city.start.z));
  const o = J.offers.find((q) => q.type !== "taxi");
  J.update(DT, 0, hero(o.x, o.y, o.z, { busy: true, driving: true }));
  assert.ok(!J.active && J.offers.includes(o), "no job from a car at a " + o.type + " marker");
});
test("Taxi!: drive the fare to the pin for the fare and a tip; out of the car too long, or too slow, and they leave", () => {
  const drive = (o) => hero(o.x, 0, o.z, { busy: true, driving: true });
  const ok = runJob("taxi", (J, C, h, t) => (J.active ? (t > 5 ? drive(J.active.data.drop) : drive(J.active.o)) : h));
  assert.ok(ok.end && ok.end.type === "done" && ok.end.reward > JOB.taxi.reward, JSON.stringify(ok.end));
  const walked = runJob("taxi", (J, C, h) => (J.active ? hero(J.active.o.x, 0, J.active.o.z) : h));
  assert.ok(walked.end && walked.end.type === "failed" && walked.end.why === "walked", JSON.stringify(walked.end));
  const late = runJob("taxi", (J, C, h) => (J.active ? drive(J.active.o) : h));
  assert.ok(late.end && late.end.type === "failed" && late.end.why === "late", JSON.stringify(late.end));
});
test("Taxi!: the drop is on a street across town, and the clock allows the drive", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const C = createCombat(city), J = createJobs({ city, combat: C, seed });
    const S = city.safe[seed % city.safe.length];
    J.start("taxi", null, hero(S.x, S.y, S.z));
    const A = J.active, D = A.data.drop, d = Math.hypot(D.x - A.o.x, D.z - A.o.z);
    assert.ok(!city.collideSphere(D.x, 1, D.z, 0.8) && !city.isWater(D.x, D.z), "drop in a building or the water at " + D.x + ", " + D.z);
    assert.ok(A.timer >= d / JOB.taxi.speed + JOB.taxi.spare - 1e-6, "time " + A.timer.toFixed(1) + " for " + d.toFixed(0) + " m");
  }
});
test("Stop, Thief!: run him down and the purse goes back; let him run and he gets away", () => {
  const ok = runJob("thief", (J, C, h, t) => {
    const g = J.active && J.active.data.runner;
    if (!g || t < 3) return h;
    const nh = hero(g.x + 1.2, g.y, g.z, { safe: true });
    C.attack(nh);
    return nh;
  });
  assert.ok(ok.end && ok.end.type === "done" && ok.end.why === "caught", JSON.stringify(ok.end));
  const away = runJob("thief", (J, C, h) => h);
  assert.ok(away.end && away.end.type === "failed" && away.end.why === "away", JSON.stringify(away.end));
});
test("Stop, Thief!: his run keeps to the streets, clear of buildings and water, and turns corners", () => {
  let turns = 0, runs = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const C = createCombat(city), J = createJobs({ city, combat: C, seed });
    const S = city.safe[seed % city.safe.length];
    J.update(DT, 0, hero(S.x, S.y, S.z));
    const o = J.offers.find((q) => q.type === "thief");
    if (!o) continue;
    J.start("thief", o, hero(S.x, S.y, S.z));
    const P = J.active.data.path;
    assert.ok(P.length >= 3, "a run of " + P.length + " points");
    runs++;
    for (let i = 1; i < P.length; i++) {
      for (let f = 0; f <= 1; f += 0.125) {
        const x = P[i - 1].x + (P[i].x - P[i - 1].x) * f, z = P[i - 1].z + (P[i].z - P[i - 1].z) * f;
        assert.ok(!city.collideSphere(x, 1, z, 0.6) && !city.isWater(x, z), "through a building or the water at " + x.toFixed(0) + ", " + z.toFixed(0));
      }
      if (i > 1 && (P[i].x - P[i - 1].x) * (P[i - 1].x - P[i - 2].x) === 0 && (P[i].z - P[i - 1].z) * (P[i - 1].z - P[i - 2].z) === 0) turns++;
    }
  }
  assert.ok(runs >= 15, "thief offers " + runs);
  assert.ok(turns >= runs, "corners " + turns + " in " + runs + " runs");
});
test("Stop, Thief!: falling behind speeds him up, and staying close keeps the jog", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C, seed: 2 });
  const S = city.safe[2];
  J.start("thief", null, hero(S.x, S.y, S.z));
  const g = J.active.data.runner;
  const far = () => hero(g.x + 40, g.y, g.z);
  for (let i = 0; i < 2 / DT; i++) { C.update(DT, far()); J.update(DT, i * DT, far()); C.events.length = 0; }
  assert.ok(J.active, "still chasing");
  assert.ok(g.speed > 8, "pulling at " + g.speed.toFixed(2));
  assert.match(J.card.detail, /pulling away/i);
  assert.equal(J.card.hot, true, "hot while pulling, timer " + J.active.timer.toFixed(1));
  const near = () => hero(g.x + 2, g.y, g.z);
  for (let i = 0; i < 1.2 / DT; i++) { C.update(DT, near()); J.update(DT, i * DT, near()); C.events.length = 0; }
  assert.ok(g.speed < JOB.thief.speed + 0.45, "back to a jog at " + g.speed.toFixed(2));
  assert.match(J.card.detail, /run him down/i);
  assert.doesNotMatch(J.card.detail, /pulling away/i);
  assert.equal(J.card.hot, false, "ink when close, timer " + J.active.timer.toFixed(1));
});
test("Sludge Run: falling behind speeds the runner, and the first-swing wait still holds him", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C });
  const S = city.start, h0 = hero(S.x, S.y, S.z);
  J.start("sludge", null, h0);
  const g = C.goons.find((q) => q.runner);
  const far = () => hero(g.x + 80, g.y, g.z);
  for (let i = 0; i < 3 / DT; i++) { C.update(DT, far()); J.update(DT, i * DT, far()); C.events.length = 0; }
  assert.ok(J.active && !J.active.data.crew, "still the runner");
  assert.ok(g.speed > JOB.sludge.speed + 1.5, "pulling at " + g.speed.toFixed(2));
  assert.match(J.card.detail, /pulling away/i);
  const x0 = g.x, z0 = g.z;
  J.holdChase(true);
  for (let i = 0; i < 1 / DT; i++) { C.update(DT, far()); J.update(DT, i * DT, far()); C.events.length = 0; }
  assert.equal(g.speed, 0);
  assert.ok(Math.hypot(g.x - x0, g.z - z0) < 0.2, "the lesson holds him");
  assert.match(J.card.detail, /swing first/i);
});
test("A miss names itself: got away, and the drain", () => {
  assert.equal(MISS.away.title, "GOT AWAY");
  assert.match(MISS.away.detail, /swing/i);
  assert.equal(MISS.drain.title, "IT BLEW");
  assert.match(MISS.drain.detail, /drain/i);
  assert.equal(MISS.dumpster.title, "MISSED");
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

test("After the bomb the story is a thief, a catch, a brawl, then a pizza, and none of them is a clog", () => {
  assert.deepEqual(STORY_ROUTE.map((s) => s.type), ["thief", "catch", "brawl", "pizza"]);
  const C = createCombat(city), J = createJobs({ city, combat: C, seed: 3 });
  const h = hero(city.start.x, city.start.y, city.start.z);
  assert.equal(J.storyNext(), null);
  J.story.sludge = true;
  const titles = [];
  for (const step of STORY_ROUTE) {
    assert.equal(J.storyNext().type, step.type);
    assert.equal(J.storyAdvance("taxi").ok, false);
    assert.equal(J.story.route, STORY_ROUTE.indexOf(step));
    const o = J.prepare(step.type, h, STORY_NEAR[step.type]) || J.prepare(step.type, h, [20, 900]);
    assert.ok(o && o.type === step.type, step.type);
    J.start(step.type, o, h, { mission: step.mission, arrive: true });
    J.update(DT, 0, h);
    const text = J.card.title + " " + J.card.detail;
    assert.ok(J.card.title.startsWith(step.mission), text);
    assert.ok(!/clog/i.test(text), text);
    if (step.type === "catch") assert.ok(J.active.timer > JOB.catch.delay, "time to arrive " + J.active.timer);
    if (step.type === "pizza") {
      const d = Math.hypot(J.active.data.drop.x - J.active.o.x, J.active.data.drop.z - J.active.o.z);
      assert.ok(d > 40 && d < 200, "story pizza is a swing, not a hike " + d.toFixed(0));
    }
    titles.push(text);
    J.cancel();
    const adv = J.storyAdvance(step.type);
    assert.equal(adv.ok, true);
    assert.equal(adv.next, STORY_ROUTE[J.story.route] || null);
  }
  assert.equal(J.storyNext(), null);
  assert.equal(J.storyAdvance("brawl").ok, false);
  assert.match(titles[0], /STOP, THIEF/);
  assert.match(titles[1], /CATCH/);
  assert.match(titles[2], /ROOFTOP BRAWL/);
  assert.match(titles[3], /PIZZA/);
  assert.match(titles[3], /[Dd]eliver/);
  assert.ok(titles.every((t) => !/FLUSH THE CLOGS/.test(t)));
});
function startJob(type) {
  const C = createCombat(city), J = createJobs({ city, combat: C, seed: 3 });
  const h0 = hero(city.start.x, city.start.y, city.start.z);
  J.update(DT, 0, h0);
  const o = J.offers.find((q) => q.type === type) || null;
  J.start(type, o, h0);
  const h = hero(J.active.o.x, J.active.o.y, J.active.o.z);
  return { C, J, h };
}
test("a long clock turns the card hot in the last stretch, and time put back brings the ink", () => {
  const { J, h } = startJob("brawl");
  assert.ok(J.active.budget >= 120, "opened at " + J.active.budget);
  J.update(DT, 0, h);
  assert.equal(J.card.hot, false);
  assert.match(J.card.title, /BRAWL/);
  J.active.budget = 16;
  J.active.timer = 6;
  J.update(DT, DT, h);
  assert.equal(J.card.hot, false, "a quarter of 16 s is 4 s, timer " + J.active.timer.toFixed(2));
  J.active.timer = 4;
  J.update(DT, DT, h);
  assert.equal(J.card.hot, true, "timer " + J.active.timer.toFixed(2));
  J.active.budget = 120;
  J.active.timer = 7;
  J.update(DT, DT, h);
  assert.equal(J.card.hot, true);
  J.active.timer = 30;
  J.update(DT, DT, h);
  assert.equal(J.card.hot, false, "30 s on a two-minute clock, timer " + J.active.timer.toFixed(2));
});
test("the crew clock is a new opening, so a fresh 40 s is not already hot", () => {
  const { J, h } = startJob("sludge");
  J.active.timer = 5;
  J.active.budget = 16;
  J.active.data.runner.on = false;
  J.update(DT, 0, h);
  assert.ok(J.active && J.active.data.crew, "the crew is in");
  assert.ok(J.active.budget >= 40, "budget " + J.active.budget);
  assert.ok(J.active.timer > 39, "timer " + J.active.timer);
  assert.equal(J.card.hot, false);
  assert.match(J.card.detail, /crew/i);
  J.active.timer = 7;
  J.update(DT, DT, h);
  assert.equal(J.card.hot, true);
});
test("a short edge stays ink, and a falling person turns the card hot", () => {
  const { J, h } = startJob("catch");
  J.update(DT, 0, h);
  assert.ok(J.active.budget < 12, "edge budget " + J.active.budget);
  assert.equal(J.card.hot, false);
  J.active.timer = 1;
  J.update(DT, DT, h);
  assert.equal(J.active.data.falling, false);
  assert.equal(J.card.hot, false);
  J.active.timer = 0.01;
  const far = hero(h.x + 80, h.y, h.z, { onGround: false });
  J.update(DT, DT, far);
  assert.equal(!!(J.active && J.active.data.falling), true);
  assert.equal(J.card.hot, true);
  assert.match(J.card.detail, /hit the street/i);
});
test("a low balloon stays ink, and one at 140 m turns the card hot", () => {
  const { J, h } = startJob("balloon");
  assert.ok(J.active.budget < 12, "slip budget " + J.active.budget);
  for (let i = 0; i < 2 / DT && J.active; i++) J.update(DT, i * DT, h);
  assert.ok(J.active && J.active.data.b.free, "it slipped");
  assert.ok(J.active.data.b.y < JOB.balloon.high, "still low at " + J.active.data.b.y.toFixed(1));
  assert.equal(J.card.hot, false);
  J.active.data.b.y = JOB.balloon.high;
  J.update(DT, 0, h);
  assert.equal(J.card.hot, true);
  assert.match(J.card.detail, /floats away/i);
  J.active.data.b.y = 40;
  J.update(DT, 0, h);
  assert.equal(J.card.hot, false);
});
test("the ninth-flush car drives faster than an odd-job getaway", () => {
  const C = createCombat(city), K = createCars(city), J = createJobs({ city, combat: C, cars: K, seed: 4 });
  const h = hero(-150, 0, 14);
  const path = [{ x: -150, y: 0, z: 14 }, { x: -150, y: 0, z: 184 }, { x: 20, y: 0, z: 184 }];
  const offer = () => ({ id: 90, type: "getaway", name: "Getaway Car", x: path[0].x, y: 0, z: path[0].z, path: path.map((p) => ({ ...p })) });
  J.start("getaway", offer(), h);
  const slow = J.active.data.car.auto.speed, tSlow = J.active.timer;
  J.start("getaway", offer(), h, { mission: "STOP THAT CAR" });
  J.update(DT, 0, h);
  assert.equal(slow, JOB.getaway.speed);
  assert.equal(J.active.data.car.auto.speed, JOB.getaway.beat);
  assert.ok(JOB.getaway.beat > JOB.getaway.speed + 5);
  assert.ok(J.active.timer < tSlow, "clock " + J.active.timer.toFixed(1) + " vs " + tSlow.toFixed(1));
  assert.match(J.card.title, /STOP THAT CAR/);
});
test("Seat the Lid: standing on it for 6 s seats it, leaving slips the hold, and the clock pops it", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C, seed: 11 });
  const h0 = hero(city.start.x, city.start.y, city.start.z);
  J.start("lid", null, h0, { mission: "HOLD IT DOWN" });
  const o = J.active.o;
  assert.ok(Math.hypot(o.x - h0.x, o.z - h0.z) > 8, "the lid is off the hero");
  J.update(DT, 0, h0);
  assert.match(J.card.title, /HOLD IT DOWN/);
  assert.match(J.card.title, /SEAT THE LID/);
  assert.match(J.card.detail, /Stand on the lid/);
  assert.doesNotMatch(J.card.title + " " + J.card.detail, /FLUSH THE CLOGS/);
  const on = hero(o.x, o.y, o.z);
  for (let i = 0; i < 3 / DT; i++) J.update(DT, i * DT, on);
  assert.ok(J.active && J.active.data.held > 2.5 && J.active.data.held < 3.2, "held " + J.active.data.held.toFixed(2));
  assert.match(J.card.detail, /Stay on the lid/);
  const air = hero(o.x, o.y + 4, o.z, { onGround: false });
  const held = J.active.data.held;
  for (let i = 0; i < 1 / DT; i++) J.update(DT, i * DT, air);
  assert.ok(J.active && J.active.data.held < held - 1.5, "the air slips it to " + J.active.data.held.toFixed(2));
  assert.match(J.card.detail, /slipped/i);
  const away = hero(o.x + 12, o.y, o.z);
  J.update(DT, 0, away);
  assert.ok(J.active.data.held < held - 1.5);
  for (let i = 0; i < 6 / DT && J.active; i++) J.update(DT, i * DT, on);
  assert.ok(J.events.some((e) => e.type === "done" && e.why === "seated" && e.reward === JOB.lid.reward), JSON.stringify(J.events.filter((e) => e.type === "done" || e.type === "failed")));
  const J2 = createJobs({ city, combat: createCombat(city), seed: 11 });
  J2.start("lid", null, h0);
  const far = hero(J2.active.o.x + 12, J2.active.o.y, J2.active.o.z);
  const ev = [];
  for (let i = 0; i < (JOB.lid.time + 1) / DT && J2.active; i++) { J2.update(DT, i * DT, far); ev.push(...J2.events); J2.events.length = 0; }
  assert.ok(ev.some((e) => e.type === "failed" && e.why === "popped"), JSON.stringify(ev.filter((e) => e.type === "failed")));
  assert.equal(MISS.popped.title, "POPPED");
});
test("Through the Gust: three airborne swings count, a jog or a stand does not, and the clock blows it off", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C, seed: 3 });
  const h0 = hero(city.start.x, city.start.y, city.start.z);
  J.start("gust", null, h0, { mission: "THROUGH THE GUST" });
  const o = J.active.o;
  assert.ok(Math.hypot(o.x - h0.x, o.z - h0.z) > 8, "the gust is off the hero");
  J.update(DT, 0, h0);
  assert.match(J.card.title, /THROUGH THE GUST/);
  assert.match(J.card.title, /SWING THROUGH/);
  assert.match(J.card.detail, /Swing through the gust/);
  assert.doesNotMatch(J.card.title + " " + J.card.detail, /FLUSH THE CLOGS/);
  const slow = hero(o.x, o.y + 8, o.z, { onGround: false, vx: 6 });
  J.update(DT, 0, slow);
  assert.equal(J.active.data.n, 0, "a slow pass");
  const ground = hero(o.x, o.y, o.z, { onGround: true, vx: 16 });
  J.update(DT, 0, ground);
  assert.equal(J.active.data.n, 0, "standing in it");
  const fly = hero(o.x, o.y + 8, o.z, { onGround: false, vx: 16 });
  const out = hero(o.x + 20, o.y + 8, o.z, { onGround: false, vx: 16 });
  J.update(DT, 0, fly);
  assert.equal(J.active.data.n, 1);
  assert.ok(J.events.some((e) => e.type === "gust" && e.n === 1 && e.of === 3));
  J.update(DT, 0, out);
  J.update(DT, 0, fly);
  assert.equal(J.active.data.n, 1, "back inside before the arm");
  for (let i = 0; i < 0.5 / DT; i++) J.update(DT, i * DT, out);
  J.update(DT, 0, fly);
  assert.equal(J.active.data.n, 2);
  assert.match(J.card.detail, /Through it, 2\/3/);
  for (let i = 0; i < 0.5 / DT; i++) J.update(DT, i * DT, out);
  J.update(DT, 0, fly);
  assert.ok(J.events.some((e) => e.type === "done" && e.why === "through" && e.reward === JOB.gust.reward), JSON.stringify(J.events.filter((e) => e.type === "done" || e.type === "failed")));
  const J2 = createJobs({ city, combat: createCombat(city), seed: 3 });
  J2.start("gust", null, h0);
  const far = hero(J2.active.o.x + 30, J2.active.o.y + 8, J2.active.o.z, { onGround: false });
  const ev = [];
  for (let i = 0; i < (JOB.gust.time + 1) / DT && J2.active; i++) { J2.update(DT, i * DT, far); ev.push(...J2.events); J2.events.length = 0; }
  assert.ok(ev.some((e) => e.type === "failed" && e.why === "blown"), JSON.stringify(ev.filter((e) => e.type === "failed")));
  assert.equal(MISS.blown.title, "BLOWN OFF");
});
console.log(fails ? "FAIL: action (" + fails + " failed)" : "PASS: action");
process.exitCode = fails ? 1 : 0;
