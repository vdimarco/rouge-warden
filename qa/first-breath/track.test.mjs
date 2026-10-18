// First Breath: target tracks (design.md 5.2, 16.2, 16.3). Targets are at least 0.5 s apart and each carries P;
// a target is in view at least max(2 beats of its heart, 1.2 s) before its time; a press halfway between two
// targets is free; errMs and rawMs differ by exactly the timing offset (with +90 ms, taps 90 ms late are In time,
// raw near 90, error near 0); tap and press targets read presses and release targets releases; accuracy and the
// In-time streak. Once core/stages/index.js exists, every stage's targets over 20 seeds (no input) are checked the
// same way (FB_SEEDS sets the seed count).
// node qa/first-breath/track.test.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTrack, feed, upcoming, accuracy, streak, check as checkTargets, previewS, SPACING_MIN_S, PREVIEW_MIN_S }
  from "../../public/first-breath/core/lib/track.js";
import { holdOverlap } from "../../public/first-breath/core/lib/goals.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { DT } from "../../public/first-breath/core/clock.js";

const FILE = "qa/first-breath/track.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const beat = 60 / 72;
// her beats as targets, every 2nd beat from 1.0 s (stage 3's shape)
const targetsEvery = (n, gapBeats, t0 = 1, kind = "tap", heart = "mother") =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, t: t0 + i * gapBeats * beat, P: i ? gapBeats * beat : beat, kind, heart, group: "split" }));

await check("check(): spacing ≥ 0.5 s, every target carries P, sorted, unique ids, known kinds", () => {
  assert.deepEqual(checkTargets(targetsEvery(12, 2)), []);
  assert.equal(SPACING_MIN_S, 0.5);
  const close = [{ id: "a", t: 1, P: 0.8, kind: "tap" }, { id: "b", t: 1.4, P: 0.5, kind: "tap" }];
  assert.match(checkTargets(close).join("\n"), /0\.400 s after the one before/);
  assert.match(checkTargets([{ id: "a", t: 1, kind: "tap" }]).join("\n"), /no P/);
  assert.match(checkTargets([{ id: "a", t: 1, P: 0.3, kind: "tap" }]).join("\n"), /under 0\.5 s/);
  assert.match(checkTargets([{ id: "a", t: 2, P: 1, kind: "tap" }, { id: "b", t: 1, P: 1, kind: "tap" }]).join("\n"), /comes before/);
  assert.match(checkTargets([{ id: "a", t: 1, P: 1, kind: "tap" }, { id: "a", t: 2, P: 1, kind: "tap" }]).join("\n"), /repeats an id/);
  assert.match(checkTargets([{ id: "a", t: 1, P: 1, kind: "swipe" }]).join("\n"), /kind swipe/);
});

await check("createTrack copies and sorts, and every target keeps its P", () => {
  const src = targetsEvery(4, 2).reverse();
  const tr = createTrack(src);
  assert.deepEqual(tr.targets.map((x) => x.id), ["t0", "t1", "t2", "t3"]);
  assert.ok(tr.targets.every((x) => Number.isFinite(x.P)));
  tr.targets[0].t = 99;
  assert.notEqual(src[3].t, 99, "the stage's list is not touched");
});

await check("preview: in view at least max(2 beats of its heart, 1.2 s) ahead", () => {
  assert.equal(PREVIEW_MIN_S, 1.2);
  near(previewS(beat), 2 * beat, 1e-12, "2 beats at 72 bpm");
  assert.equal(previewS(60 / 170), 1.2, "1.2 s at 170 bpm");
  assert.equal(previewS(NaN), 1.2);
  const tr = createTrack(targetsEvery(6, 2));
  for (const x of tr.targets) {
    const p = previewS(beat);
    assert.ok(upcoming(tr, x.t - p, p).includes(x), `${x.id} at ${p} s ahead`);
    assert.ok(!upcoming(tr, x.t - p - 0.01, p).includes(x), `${x.id} not before its horizon`);
  }
  const tr2 = createTrack(targetsEvery(2, 2));
  feed(tr2, makeIntents({ presses: [{ t: 1, raw: 1 }] }), 1.01);
  assert.ok(!upcoming(tr2, 0.9, 5).some((x) => x.id === "t0"), "a judged target leaves the list");
  feed(tr2, makeIntents(), 10);
  assert.deepEqual(upcoming(tr2, 1, 5), [], "a missed one too");
});

await check("a press halfway between two targets is free: nothing graded, nothing changes", () => {
  const two = () => createTrack([{ id: "a", t: 2, P: 0.5, kind: "tap", group: "g" }, { id: "b", t: 2.5, P: 0.5, kind: "tap", group: "g" }]);
  const tr = two(), idle = two();
  const withPress = feed(tr, makeIntents({ presses: [{ t: 2.25, raw: 2.25 }] }), 2.251);
  assert.deepEqual(withPress, feed(idle, makeIntents(), 2.251), "the press adds nothing (a has passed by then anyway)");
  assert.equal(tr.results[1], null, "b is still open");
  assert.deepEqual(feed(tr, makeIntents(), 3.2), feed(idle, makeIntents(), 3.2), "and the track goes on as with no press");
  assert.deepEqual(tr.results, idle.results);
  const tr2 = createTrack(targetsEvery(3, 2)), idle2 = createTrack(targetsEvery(3, 2));
  const mid = 1 + beat;
  assert.ok(feed(tr2, makeIntents({ presses: [{ t: mid, raw: mid }] }), mid + DT).every((r) => r.grade === "miss"),
    "halfway between two targets 2 beats apart is past Off: only the passed target's miss");
  feed(idle2, makeIntents(), mid + DT);
  assert.deepEqual(tr2.results, idle2.results);
});

await check("errMs and rawMs differ by the offset; +90 ms makes 90 ms late taps In time", () => {
  const offset = 0.09;
  const tr = createTrack(targetsEvery(8, 2));
  const out = [];
  for (const x of tr.targets) {
    const raw = x.t + 0.09 + (x.id === "t3" ? 0.004 : 0);
    out.push(...feed(tr, makeIntents({ presses: [{ t: raw - offset, raw }] }), raw + DT));
  }
  assert.equal(out.length, 8);
  for (const r of out) {
    assert.equal(r.grade, "in");
    near(r.rawMs - r.errMs, 90, 1e-9, "raw − err = the offset");
    near(r.rawMs, 90, 5, "raw near 90 ms");
    near(r.errMs, 0, 5, "error near 0");
  }
  assert.equal(accuracy(tr), 1);
});

await check("tap and press targets read presses; release targets read releases", () => {
  const tr = createTrack([
    { id: "p", t: 1, P: 0.833, kind: "press", heart: "mother", group: "breath" },
    { id: "r", t: 4.33, P: 3.33, kind: "release", heart: "mother", group: "breath" },
  ]);
  assert.deepEqual(feed(tr, makeIntents({ releases: [{ t: 1, raw: 1 }] }), 1.01), [], "a release never judges a press target");
  assert.equal(feed(tr, makeIntents({ presses: [{ t: 1.02, raw: 1.02 }] }), 1.03)[0].target.id, "p");
  assert.deepEqual(feed(tr, makeIntents({ presses: [{ t: 4.33, raw: 4.33 }] }), 4.34), [], "a press never judges a release target");
  const r = feed(tr, makeIntents({ releases: [{ t: 4.45, raw: 4.45 }] }), 4.46);
  assert.equal(r[0].target.id, "r");
  assert.equal(r[0].grade, "close");
});

await check("accuracy = Σ credit / targets, by group; free targets left out; streak counts In time only", () => {
  const list = [
    ...targetsEvery(4, 2).map((x) => ({ ...x, group: "a" })),
    { id: "b0", t: 8, P: 1, kind: "tap", group: "b" },
    { id: "b1", t: 9, P: 1, kind: "tap", group: "b", free: true },
  ];
  const tr = createTrack(list);
  const hit = (t) => feed(tr, makeIntents({ presses: [{ t, raw: t }] }), t + DT);
  hit(tr.targets[0].t + 0.01);   // in
  hit(tr.targets[1].t + 0.1);    // close
  hit(tr.targets[2].t);          // in
  hit(tr.targets[3].t + 0.02);   // in
  feed(tr, makeIntents(), 20);   // b0 and b1 missed
  near(accuracy(tr, "a"), (1 + 0.5 + 1 + 1) / 4, 1e-12, "group a");
  assert.equal(accuracy(tr, "b"), 0, "b0 missed; b1 is free and not counted");
  near(accuracy(tr), 3.5 / 5, 1e-12, "all counted targets");
  assert.deepEqual(streak(tr, "a"), { current: 2, best: 2 });
  assert.deepEqual(streak(tr), { current: 0, best: 2 });
  assert.equal(accuracy(createTrack([]), "x"), 0, "no targets: 0");
});

await check("goals.holdOverlap: the share of a span held, overlaps once, a hold still down", () => {
  assert.equal(holdOverlap([[0, 5]], 0, 5), 1);
  assert.equal(holdOverlap([[1, 3]], 0, 4), 0.5);
  assert.equal(holdOverlap([[0, 2], [1, 3]], 0, 4), 0.75, "overlaps count once");
  assert.equal(holdOverlap([{ t0: 2, t1: null }], 0, 4), 0.5, "a hold still down runs to t1");
  assert.equal(holdOverlap([[5, 6]], 0, 4), 0);
  assert.equal(holdOverlap([], 0, 4), 0);
  assert.equal(holdOverlap([[0, 1]], 3, 3), 0, "an empty span");
});

// Every stage's targets, once the stages exist.
const INDEX = fileURLToPath(new URL("../../public/first-breath/core/stages/index.js", import.meta.url));
if (existsSync(INDEX)) {
  const { STAGES } = await import(new URL("../../public/first-breath/core/stages/index.js", import.meta.url).href);
  const { DEFAULT_CARRY } = await import("../../public/first-breath/core/carry.js");
  const SEEDS = Math.max(1, Number(process.env.FB_SEEDS) || 20);
  for (const mod of STAGES || []) {
    await check(`${mod.meta.id}: targets over ${SEEDS} seeds are spaced, carry P and are in view in time`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const st = mod.create(seed, DEFAULT_CARRY, { assist: false, oneButton: false, motherPhase: 0 });
        const seen = new Map();
        const maxSteps = Math.ceil(((mod.meta.capS || 120) + 5) / DT);
        for (let i = 0; i <= maxSteps && !mod.result(st).done; i++) {
          if (i % 3 === 0) for (const x of mod.targets(st, 10) || []) if (!seen.has(x.id)) seen.set(x.id, { x: { ...x }, at: st.t });
          mod.step(st, makeIntents());
          st.events.length = 0;
        }
        const all = [...seen.values()].sort((a, b) => a.x.t - b.x.t);
        assert.deepEqual(checkTargets(all.map((e) => e.x)), [], `seed ${seed}`);
        for (const { x, at } of all) {
          const per = 60 / st.beats.bpm(x.heart, x.t);
          const lead = x.t - at;
          assert.ok(lead >= previewS(per) - 3 * DT - 1e-9, `seed ${seed}: ${x.id} first listed ${lead.toFixed(3)} s ahead, under ${previewS(per).toFixed(3)} s`);
        }
      }
    });
  }
}

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks${existsSync(INDEX) ? "" : " (no core/stages/index.js yet: the per-stage check waits for it)"}`);
}
