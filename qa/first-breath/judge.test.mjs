// First Breath: the timing judge (design.md 5.2). The windows at P = 0.5, 0.706 and 0.833 s; Assist and its 0.4 P
// cap on Close; free presses far from any target; an Off press changes nothing; a press 160 ms late that reaches
// the game a step late is Close, not a miss (the 50 ms grace); two targets 0.5 s apart judged on their own sub-step
// times; and the Tap test's median.
// node qa/first-breath/judge.test.mjs
import assert from "node:assert/strict";
import { WIN, GRACE_S, CREDIT, windows, grade, median } from "../../public/first-breath/core/judge.js";
import { createTrack, feed } from "../../public/first-breath/core/lib/track.js";
import { DT } from "../../public/first-breath/core/clock.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";

const FILE = "qa/first-breath/judge.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const press = (t, raw = t) => makeIntents({ presses: [{ t, raw }] });

await check("the constants are the contract's (16.2)", () => {
  assert.deepEqual(WIN, { inMs: 70, closeMs: 170, inK: 0.12, closeK: 0.28, offK: 0.45, assist: 1.6, closeCapK: 0.4, minP: 0.5 });
  assert.equal(GRACE_S, 0.05);
  assert.deepEqual(CREDIT, { in: 1, close: 0.5, off: 0, miss: 0 });
});

await check("windows at P = 0.5, 0.706 and 0.833 s", () => {
  const w5 = windows(0.5), w7 = windows(0.706), w8 = windows(0.833);
  near(w5.in, 0.06, 1e-12, "P 0.5 in"); near(w5.close, 0.14, 1e-12, "P 0.5 close"); near(w5.off, 0.225, 1e-12, "P 0.5 off");
  near(w7.in, 0.07, 1e-12, "P 0.706 in"); near(w7.close, 0.17, 1e-12, "P 0.706 close"); near(w7.off, 0.3177, 1e-12, "P 0.706 off");
  near(w8.in, 0.07, 1e-12, "P 0.833 in"); near(w8.close, 0.17, 1e-12, "P 0.833 close"); near(w8.off, 0.37485, 1e-12, "P 0.833 off");
  assert.deepEqual(windows(0.3), windows(0.5), "P is floored at 0.5 s");
  assert.deepEqual(windows(NaN), windows(0.5), "a missing P counts as the floor");
  for (const P of [0.5, 0.6, 0.706, 0.833, 1.67, 3]) {
    const w = windows(P);
    assert.ok(w.in >= 0.06 - 1e-12 && w.close >= 0.14 - 1e-12, `never tighter than ±60 / ±140 ms at P ${P}`);
  }
});

await check("grades at P = 0.706 s: 60 ms In time, 150 ms Close, 260 ms Off, 400 ms free", () => {
  assert.equal(grade(0.06, 0.706), "in");
  assert.equal(grade(-0.06, 0.706), "in", "early counts the same");
  assert.equal(grade(0.07, 0.706), "in", "the edge is inclusive");
  assert.equal(grade(0.15, 0.706), "close");
  assert.equal(grade(-0.17, 0.706), "close");
  assert.equal(grade(0.26, 0.706), "off");
  assert.equal(grade(0.4, 0.706), null, "a free press");
  assert.equal(grade(NaN, 0.706), null);
});

await check("Assist: windows ×1.6, Close capped at 0.4 P", () => {
  const a8 = windows(0.833, true);
  near(a8.in, 0.112, 1e-12, "in");
  near(a8.close, 0.272, 1e-12, "close (under the cap)");
  assert.equal(grade(0.1, 0.833, true), "in", "100 ms late at P 0.833 s is In time with Assist");
  assert.equal(grade(0.1, 0.833, false), "close", "and Close without");
  const a5 = windows(0.5, true);
  near(a5.in, 0.096, 1e-12, "P 0.5 in");
  near(a5.close, 0.2, 1e-12, "P 0.5 close is capped at 0.4 P (not 0.224)");
  near(a5.off, 0.225, 1e-12, "Off stays 0.45 P");
  assert.ok(a5.off > a5.close, "Off stays wider than the capped Close");
});

await check("free presses do nothing", () => {
  const tr = createTrack([{ id: "a", t: 2, P: 0.833, kind: "tap", heart: "mother", group: "g" }]);
  assert.deepEqual(feed(tr, press(1.2), 1.21), [], "0.8 s early is free");
  assert.equal(tr.results[0], null, "the target is still open");
  assert.equal(feed(tr, press(2.01), 2.02)[0].grade, "in", "and a later press still counts");
});

await check("an Off press changes nothing: the target stays open", () => {
  const tr = createTrack([{ id: "a", t: 2, P: 0.833, kind: "tap", heart: "mother", group: "g" }]);
  const off = feed(tr, press(1.7), 1.71);
  assert.equal(off.length, 1);
  assert.equal(off[0].grade, "off", "reported, for its faint ring");
  near(off[0].errMs, -300, 1e-9, "errMs");
  assert.equal(tr.results[0], null, "still open");
  const later = feed(tr, press(2.03), 2.04);
  assert.equal(later[0].grade, "in");
  near(later[0].errMs, 30, 1e-9, "graded on the second press");
});

await check("a press 160 ms late that arrives a step late is Close, not a miss (P = 0.706 s)", () => {
  const T = 3;
  const tr = createTrack([{ id: "a", t: T, P: 0.706, kind: "tap", heart: "you", group: "g" }]);
  // the step that holds the press time ends without it
  let tEnd = T + 0.16 + DT / 2;
  assert.deepEqual(feed(tr, makeIntents(), tEnd), [], "past Close but inside the grace: no miss yet");
  // the press arrives in the next step, with its own time stamp
  tEnd += DT;
  const r = feed(tr, press(T + 0.16), tEnd);
  assert.equal(r.length, 1);
  assert.equal(r[0].grade, "close");
  near(r[0].errMs, 160, 1e-9, "graded on its time stamp");
});

await check("a target is missed only when the step ends past t + close + 50 ms", () => {
  const T = 1;
  const tr = createTrack([{ id: "a", t: T, P: 0.833, kind: "tap", heart: "mother", group: "g" }]);
  assert.deepEqual(feed(tr, makeIntents(), T + 0.17 + GRACE_S - 0.001), []);
  const m = feed(tr, makeIntents(), T + 0.17 + GRACE_S + 0.001);
  assert.equal(m.length, 1);
  assert.equal(m[0].grade, "miss");
  assert.equal(m[0].errMs, null);
  assert.deepEqual(feed(tr, press(T + 0.2), T + 0.3), [], "a press after the miss judges nothing");
});

await check("two targets 0.5 s apart are judged on their own sub-step times", () => {
  const tr = createTrack([
    { id: "a", t: 4.0, P: 0.5, kind: "tap", heart: "you", group: "g" },
    { id: "b", t: 4.5, P: 0.5, kind: "tap", heart: "you", group: "g" },
  ]);
  // each press lands at a different point inside its 16.7 ms step
  const r1 = feed(tr, press(4.005), 4.0 + 0.6 * DT);
  const r2 = feed(tr, press(4.512), 4.5 + 0.9 * DT);
  assert.equal(r1.length, 1); assert.equal(r2.length, 1);
  assert.equal(r1[0].target.id, "a"); assert.equal(r2[0].target.id, "b");
  near(r1[0].errMs, 5, 1e-9, "5 ms"); near(r2[0].errMs, 12, 1e-9, "12 ms");
  assert.equal(r1[0].grade, "in"); assert.equal(r2[0].grade, "in");
  // both in one long feed: still each on its own time
  const tr2 = createTrack(tr.targets.map(({ id, t, P, kind, heart, group }) => ({ id, t, P, kind, heart, group })));
  const both = feed(tr2, makeIntents({ presses: [{ t: 4.512, raw: 4.512 }, { t: 4.005, raw: 4.005 }] }), 4.6);
  assert.deepEqual(both.map((x) => [x.target.id, Math.round(x.errMs)]), [["a", 5], ["b", 12]]);
});

await check("median: the Tap test's offset", () => {
  assert.equal(median([40, 30, 50]), 40);
  assert.equal(median([10, 20, 30, 40]), 25);
  assert.equal(median([42, 38, 41, 39, 40, 44, 36, 43]), 40.5);
  assert.equal(median([]), 0);
  assert.equal(median([NaN, 5, "x", 7]), 6, "non-numbers are skipped");
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks`);
}
