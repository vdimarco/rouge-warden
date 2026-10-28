// The Gauntlet, with no browser: round after round on one roof (js/jobs.js), the brute (js/combat.js), and the bot that plays it
// (qa/vr/gauntlet-bot.mjs). Run from the repo root: node qa/vr/gauntlet.test.mjs
import assert from "node:assert/strict";
import { generate, ARENA } from "../../public/vr/js/city.js";
import { createCombat, FIGHT } from "../../public/vr/js/combat.js";
import { createJobs, JOB, gauntletRound, gauntletPay } from "../../public/vr/js/jobs.js";
import { playGauntlet } from "./gauntlet-bot.mjs";

const city = generate();
let fails = 0;
const test = (name, fn) => { try { fn(); console.log("PASS: " + name); } catch (e) { fails++; console.log("FAIL " + name + "\n  " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n  ") : e)); } };
const DT = 1 / 30;
const hero = (x, y, z, o = {}) => ({ x, y, z, yaw: 0, onGround: true, safe: false, hidden: false, vx: 0, vy: 0, vz: 0, busy: false, ...o });

test("the rounds grow: more goons, a brute from round 3, a faster gang, shorter wind-ups", () => {
  const R = [1, 2, 3, 4, 6, 9, 30].map(gauntletRound);
  assert.deepEqual(R.map((r) => r.goons), [3, 4, 5, 6, 8, 8, 8]);
  assert.deepEqual(R.map((r) => r.brutes), [0, 0, 1, 1, 2, 2, 2]);
  for (let i = 1; i < R.length; i++) { assert.ok(R[i].pace >= R[i - 1].pace); assert.ok(R[i].windup <= R[i - 1].windup); }
  assert.ok(R[6].pace <= JOB.gauntlet.paceMost && R[6].windup >= JOB.gauntlet.windupMin);
  assert.equal(gauntletPay(0), 0); assert.equal(gauntletPay(3), JOB.gauntlet.reward * 6);
});
test("the arena is one flat roof near the start, the same every time, and its marker is always offered", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C });
  const a = J.arena(), b = createJobs({ city, combat: createCombat(city) }).arena();
  assert.ok(a && a.y >= ARENA.lo && a.y <= ARENA.hi, JSON.stringify(a));
  assert.equal(a.bid, b.bid);
  J.update(DT, 0, hero(city.start.x, city.start.y, city.start.z));
  const o = J.offers.find((q) => q.type === "gauntlet");
  assert.ok(o && o.x === a.x && o.z === a.z);
});
test("a brute: six points, punches do not stop him, a kick staggers him, a rope cannot yank him, his blow takes two hearts", () => {
  const C = createCombat(city), h = hero(-150, 0, 2, { safe: true });
  const g = C.spawn(-151.4, 0, 2, "t", { brute: true });
  assert.equal(g.hp, FIGHT.brute.hp); assert.ok(g.height > 1.3);
  const near = () => { h.x = g.x + 1.3; h.z = g.z; };
  const a = C.attack(h);
  assert.equal(a.kind, "punch"); assert.notEqual(g.state, "stagger"); assert.ok(g.flash > 0);
  const wait = (sec) => { for (let i = 0; i < sec / 0.05; i++) C.update(0.05, h); };
  wait(0.3); near(); C.attack(h); wait(0.3); near(); const k = C.attack(h);
  assert.equal(k.kind, "kick"); assert.equal(g.state, "stagger");
  wait(1);
  assert.equal(C.pull(g.id, h), "pull"); assert.notEqual(g.state, "pulled");
  const C2 = createCombat(city), h2 = hero(-150, 0, 2);
  C2.spawn(-152, 0, 2, "t", { brute: true }).aggro = true;
  const seen = [];
  for (let i = 0; i < 5 / DT && C2.hp === FIGHT.hp; i++) { C2.update(DT, h2); for (const e of C2.events) seen.push(e); C2.events.length = 0; }
  assert.equal(C2.hp, FIGHT.hp - FIGHT.brute.dmg, JSON.stringify(seen.map((e) => e.type)));
  assert.ok(seen.find((e) => e.type === "hurt").heavy);
});
test("the brute's charge: a dodge as he lunges is perfect and he misses; a dodge early in his wind-up is over when he arrives", () => {
  const run = (when) => {
    const C = createCombat(city), h = hero(-150, 0, 2);
    const g = C.spawn(-156, 0, 2, "t", { brute: true }); g.aggro = true; g.cool = 0;
    let d = null;
    for (let i = 0; i < 3 / DT && C.hp === FIGHT.hp; i++) {
      C.update(DT, h);
      if (!d && ((when === "late" && g.state === "swing") || (when === "early" && g.state === "windup"))) d = C.dodge(h);
    }
    return { d, hp: C.hp };
  };
  const late = run("late"), early = run("early");
  assert.ok(late.d && late.d.perfect && late.hp === FIGHT.hp, JSON.stringify(late));
  assert.ok(early.d && !early.d.perfect && early.hp === FIGHT.hp - FIGHT.brute.dmg, JSON.stringify(early));
});
test("the Gauntlet loops: a round cleared brings a rest, a heart or two, and the next round", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C });
  const a = J.arena(), h = hero(a.x, a.y, a.z, { safe: true });
  J.start("gauntlet", null, h);
  const ev = [];
  const tick = (n) => { for (let i = 0; i < n; i++) { C.update(DT, h); J.update(DT, i * DT, h); ev.push(...J.events); J.events.length = 0; C.events.length = 0; } };
  tick(Math.ceil(JOB.gauntlet.first / DT) + 2);
  assert.equal(J.info().active.data.round, 1, "round");
  const crew = C.group("job").filter(C.alive);
  assert.equal(crew.length, gauntletRound(1).goons, "crew");
  for (const g of crew) assert.ok(Math.abs(g.y - a.y) < 0.6, "on the roof: " + g.y + " vs " + a.y);
  C.hp = 2; C.quiet = 0;
  for (const g of crew) { g.hp = 0; g.state = "down"; g.t = 0.1; }
  tick(2);
  assert.ok(ev.some((e) => e.type === "roundClear" && e.n === 1));
  assert.equal(C.hp, 2 + JOB.gauntlet.heal, "hp");
  tick(Math.ceil(JOB.gauntlet.rest / DT) + 2);
  assert.equal(J.info().active.data.round, 2, "round 2");
  assert.ok(ev.some((e) => e.type === "round" && e.n === 2));
});
test("a knock-out ends the Gauntlet: it pays for the rounds cleared, and none cleared is a loss", () => {
  const C = createCombat(city), J = createJobs({ city, combat: C }), a = J.arena(), h = hero(a.x, a.y, a.z, { safe: true });
  J.start("gauntlet", null, h);
  J.active.data.cleared = 3; J.active.data.round = 4;
  J.knockedOut();
  const e = J.events.find((q) => q.type === "done");
  assert.ok(e && e.rounds === 3 && e.reward === gauntletPay(3), JSON.stringify(J.events));
  J.events.length = 0;
  J.start("gauntlet", null, h);
  J.knockedOut();
  assert.ok(J.events.some((q) => q.type === "failed" && q.why === "knockout"));
});
test("the bot clears rounds with the whole move set, and the brute makes it dodge", () => {
  const r = playGauntlet({ city, seconds: 150, seed: 3 });
  assert.ok(r.cleared >= 4, JSON.stringify(r));
  assert.ok(r.stats.kicks > 0 && r.stats.dodges > 0 && r.stats.zips > 0, JSON.stringify(r.stats));
  assert.ok(r.brutes > 0, "met a brute");
  console.log("  bot: " + JSON.stringify({ cleared: r.cleared, hurt: r.stats.hurt, dodges: r.stats.dodges, perfect: r.stats.perfect, zips: r.stats.zips, finishers: r.stats.finishers, bestCombo: r.bestCombo, roundTimes: r.roundTimes.map((t) => +t.toFixed(1)) }));
});

if (fails) { console.log("FAIL: gauntlet (" + fails + " failed)"); process.exitCode = 1; }
else console.log("PASS: gauntlet");
