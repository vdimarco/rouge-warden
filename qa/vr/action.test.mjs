// The city action, with no browser: the Sludge Gang (js/combat.js), the cars (js/cars.js) and the jobs (js/jobs.js).
// Run from the repo root: node qa/vr/action.test.mjs
import assert from "node:assert/strict";
import { generate } from "../../public/vr/js/city.js";
import { createCombat, FIGHT } from "../../public/vr/js/combat.js";
import { createCars, CAR } from "../../public/vr/js/cars.js";
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
