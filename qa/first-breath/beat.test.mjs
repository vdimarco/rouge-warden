// First Breath: the two hearts (design.md 5.1). clock.bpmYou follows the curve (110 at gaDay 36 and 42, 170 at 63
// and 70, 150 at 98, 140 from 140 to 196, 130 at 280, NaN before 36); makeBeats puts her first beat at `first`
// (opts.motherPhase), lays beats in [from, to) at the segment's rate, carries on across segments without a jump, has
// seeded jitter within ±3% and none at jitter 0 (the tracks), and answers bpm, phase, next and between.
// node qa/first-breath/beat.test.mjs
import assert from "node:assert/strict";
import { bpmYou } from "../../public/first-breath/core/clock.js";
import { makeBeats } from "../../public/first-breath/core/beat.js";

const FILE = "qa/first-breath/beat.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const gaps = (a) => Array.from(a).slice(1).map((t, i) => t - a[i]);

await check("bpmYou: the 5.1 curve", () => {
  assert.ok(Number.isNaN(bpmYou(35.9)), "NaN before gaDay 36");
  assert.ok(Number.isNaN(bpmYou(NaN)));
  assert.equal(bpmYou(36), 110);
  assert.equal(bpmYou(42), 110);
  assert.equal(bpmYou(63), 170);
  assert.equal(bpmYou(70), 170);
  assert.equal(bpmYou(98), 150);
  for (const g of [140, 150, 170, 196]) assert.equal(bpmYou(g), 140, `gaDay ${g}`);
  assert.equal(bpmYou(280), 130);
  assert.equal(bpmYou(300), 130, "holds after birth");
  near(bpmYou(52.5), 140, 1e-9, "half way up the rise");
  near(bpmYou(84), 160, 1e-9, "half way down from 170 to 150");
  near(bpmYou(238), 135, 1e-9, "half way to 130");
});

await check("makeBeats: `first` places her first beat; a track has no jitter", () => {
  const b = makeBeats(7, [{ heart: "mother", from: 0, to: 10, bpm: 72, jitter: 0, first: 0.37 }]);
  assert.ok(b.mother instanceof Float64Array);
  assert.equal(b.you, null, "no you segment: you is null");
  assert.equal(b.mother[0], 0.37);
  assert.equal(b.mother.length, Math.floor((10 - 0.37) / (60 / 72)) + 1);
  for (const g of gaps(b.mother)) near(g, 60 / 72, 1e-12, "every gap is one period");
  assert.ok(b.mother[b.mother.length - 1] < 10, "beats fall before `to`");
  const z = makeBeats(7, [{ heart: "mother", from: 0, to: 5, bpm: 78 }]);
  assert.equal(z.mother[0], 0, "no first: the beat starts at `from`");
  for (const g of gaps(z.mother)) near(g, 60 / 78, 1e-12, "78 bpm");
});

await check("makeBeats: jitter is seeded, within ±3%, and capped at 0.03", () => {
  const seg = [{ heart: "mother", from: 0, to: 60, bpm: 72, jitter: 0.03, first: 0.2 }];
  const a = makeBeats(11, seg), b = makeBeats(11, seg), c = makeBeats(12, seg);
  assert.deepEqual(Array.from(a.mother), Array.from(b.mother), "the same seed gives the same beats");
  assert.notDeepEqual(Array.from(a.mother), Array.from(c.mother), "another seed gives other beats");
  const g = gaps(a.mother);
  for (const x of g) assert.ok(x >= (60 / 72) * 0.97 - 1e-12 && x <= (60 / 72) * 1.03 + 1e-12, `gap ${x}`);
  assert.ok(Math.max(...g) - Math.min(...g) > 0.01, "the jitter shows");
  const wild = makeBeats(11, [{ ...seg[0], jitter: 0.5 }]);
  for (const x of gaps(wild.mother)) assert.ok(x >= (60 / 72) * 0.97 - 1e-12 && x <= (60 / 72) * 1.03 + 1e-12, "capped");
});

await check("makeBeats: your heart from gaDay follows bpmYou", () => {
  const b = makeBeats(3, [
    { heart: "mother", from: 0, to: 20, bpm: 72, first: 0.5 },
    { heart: "you", from: 5, to: 12, gaFrom: 36, gaTo: 36, jitter: 0, first: 5.25 },
  ]);
  assert.ok(b.you instanceof Float64Array);
  assert.equal(b.you[0], 5.25);
  for (const g of gaps(b.you)) near(g, 60 / 110, 1e-12, "110 bpm on Day 22");
  assert.equal(b.bpm("you", 6), 110);
  const rise = makeBeats(3, [{ heart: "you", from: 0, to: 30, gaFrom: 42, gaTo: 63 }]);
  assert.equal(rise.bpm("you", 0), 110);
  near(rise.bpm("you", 15), 140, 1e-9, "half way along the segment is half way up the curve");
  const g = gaps(rise.you);
  assert.ok(g[0] > g[g.length - 1], "the beat quickens");
});

await check("makeBeats: segments carry on without a jump, and a glide [from, to] bpm", () => {
  const b = makeBeats(1, [
    { heart: "mother", from: 0, to: 5, bpm: 72, first: 0.1 },
    { heart: "mother", from: 5, to: 10, bpm: 90 },
  ]);
  const a = Array.from(b.mother);
  const last = a.filter((t) => t < 5).pop(), next = a.find((t) => t >= 5);
  near(next - last, 60 / 72, 1e-12, "the beat across the join is the one the old segment would have laid");
  near(a[a.indexOf(next) + 1] - next, 60 / 90, 1e-12, "then the new rate");
  for (const g of gaps(b.mother)) assert.ok(g >= 60 / 90 - 1e-12 && g <= 60 / 72 + 1e-12, "no extra or missing beat");
  const l = makeBeats(1, [{ heart: "mother", from: 0, to: 64, bpm: [76, 92] }]);
  assert.equal(l.bpm("mother", 0), 76);
  near(l.bpm("mother", 32), 84, 1e-9, "half way");
  const lg = gaps(l.mother);
  assert.ok(lg[0] > lg[lg.length - 1], "labour quickens");
});

await check("bpm, phase, next and between", () => {
  const P = 60 / 72;
  const b = makeBeats(5, [{ heart: "mother", from: 0, to: 10, bpm: 72, jitter: 0, first: 0.3 }]);
  assert.equal(b.next("mother", 0), 0.3, "her next beat from the stage start is opts.motherPhase");
  assert.equal(b.next("mother", 0.3), 0.3, "a beat at t is the next beat at t");
  near(b.next("mother", 0.31), 0.3 + P, 1e-12, "just after a beat");
  const lastBeat = b.mother[b.mother.length - 1];
  near(b.next("mother", 10.5), lastBeat + Math.ceil((10.5 - lastBeat) / P) * P, 1e-9, "past the last beat it goes on at the last rate");
  assert.equal(b.phase("mother", 0.3), 0, "0 on a beat");
  near(b.phase("mother", 0.3 + P / 2), 0.5, 1e-9, "half way");
  near(b.phase("mother", 0.3 - P / 4), 0.75, 1e-9, "before the first beat, by its rate");
  const between = b.between("mother", 1, 3);
  assert.ok(between.every((t) => t >= 1 && t < 3));
  assert.equal(between.length, Array.from(b.mother).filter((t) => t >= 1 && t < 3).length);
  assert.deepEqual(b.between("mother", 0, 0.3), [], "[t0, t1) leaves t1 out");
  assert.equal(b.bpm("mother", 5), 72);
  assert.equal(b.bpm("mother", 50), 72, "after the last segment: its rate");
  assert.ok(Number.isNaN(b.bpm("you", 5)), "no you segments: NaN");
  assert.ok(Number.isNaN(b.next("you", 5)));
  assert.deepEqual(b.between("you", 0, 10), []);
  assert.equal(b.phase("you", 2), 0);
});

await check("makeBeats never throws on junk and stays finite", () => {
  const b = makeBeats(1, [null, { heart: "mother", from: 5, to: 2 }, { heart: "mother", from: 0, to: 1, bpm: 0 },
    { heart: "you", from: 0, to: 5 }, { heart: "mother", from: 0, to: 3, bpm: NaN }]);
  assert.ok(Array.from(b.mother).every(Number.isFinite));
  assert.equal(makeBeats(1, undefined).mother.length, 0);
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks`);
}
