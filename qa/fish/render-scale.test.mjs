// Checks public/fish/js/render-scale.js, the automatic render scale of the lake, in plain node: it feeds frame times
// at known cadences and watches the scale. Run: node qa/fish/render-scale.test.mjs   (exit code 1 on failure)
import assert from "node:assert/strict";
import { createRenderScale, RES } from "../../public/fish/js/render-scale.js";

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok    " + name); } catch (e) { failed++; console.log("FAIL  " + name + "\n      " + (e && e.message)); }
}
const HZ60 = 1000 / 60;
// feeds frames from gen(i) for ms of frame time; returns every scale it took, with the time (log.end: the time fed)
function feed(rs, ms, gen, log = []) {
  const t0 = log.end || 0;
  let t = 0, i = 0;
  while (t < ms) { const f = gen(i++); t += f; if (rs.frame(f)) log.push({ t: t0 + t, s: rs.scale }); }
  log.end = t0 + t;
  return log;
}
// a little jitter, the same in every run
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const near = (ms, j = 1) => ms + (rnd() - 0.5) * 2 * j;

check("a steady 60 Hz keeps the full scale", () => {
  const rs = createRenderScale();
  feed(rs, 20000, () => near(HZ60));
  assert.equal(rs.scale, 1);
});

check("one 140 ms hitch in a fight at 60 Hz changes nothing", () => {
  const rs = createRenderScale();
  const log = feed(rs, 10000, (i) => (i === 300 ? 140 : near(HZ60)));
  assert.equal(log.length, 0, JSON.stringify(log));
  assert.equal(rs.scale, 1);
});

check("a hitch every 2 s (a GC pause, a texture upload) changes nothing", () => {
  const rs = createRenderScale();
  const log = feed(rs, 30000, (i) => (i % 120 === 60 ? 140 : near(HZ60)));
  assert.equal(log.length, 0, JSON.stringify(log));
});

check("slow for 2 s, then fast for 4 s: the scale goes down, then back to 1 in steps", () => {
  const rs = createRenderScale();
  const log = feed(rs, 2000, () => near(40, 3));
  const down = log.length;
  feed(rs, 4000, () => near(HZ60), log);
  console.log("      " + log.map((e) => (e.t / 1000).toFixed(2) + " s: " + e.s.toFixed(3)).join(", "));
  assert.ok(down >= 1 && log[0].s < 1, "no step down in the slow stretch");
  assert.equal(rs.scale, 1, "not back to 1 after 4 s of fast frames");
  const ups = log.slice(down);
  assert.ok(ups.length >= 2, "back up in one jump: " + JSON.stringify(ups));
  let prev = log[down - 1].s;
  for (const e of ups) { assert.ok(e.s > prev && e.s <= prev * RES.UP + 1e-9, "a step up of more than " + RES.UP); prev = e.s; }
});

check("a long slow stretch walks down to the floor, and no lower", () => {
  const rs = createRenderScale();
  const log = feed(rs, 20000, () => near(40, 4));
  assert.equal(rs.scale, RES.MIN);
  for (let i = 1; i < log.length; i++) assert.ok(log[i].s >= log[i - 1].s * RES.DOWN - 1e-9, "a step down larger than " + RES.DOWN);
  // and it climbs all the way back once the frames are fast
  feed(rs, 20000, () => near(HZ60));
  assert.equal(rs.scale, 1);
});

check("a screen held at 30 Hz (Low Power Mode): one test of a step and the floor, then back to 1 for good", () => {
  const rs = createRenderScale();
  const log = feed(rs, 30000, () => near(1000 / 30, 0.8));
  console.log("      " + log.map((e) => (e.t / 1000).toFixed(2) + " s: " + e.s.toFixed(3)).join(", "));
  assert.equal(rs.scale, 1);
  assert.ok(rs.capped, "the cap was not found");
  assert.ok(log.length <= 3, "more than a step, the floor and the way back: " + JSON.stringify(log));
  assert.ok(log[log.length - 1].t < 6000, "the test took until " + log[log.length - 1].t + " ms");
});

// A phone on a real screen: each frame costs base x scale^2 ms (the pixels), +-10%, and takes whole refreshes of the
// screen (vsync ms each). Returns the changes of the scale and the share of on-time frames in the last 20 s
function phone(base, { vsync = HZ60, secs = 120, onTime = HZ60 + 1 } = {}) {
  const rs = createRenderScale(), log = [];
  let t = 0, n = 0, ok = 0;
  while (t < secs * 1000) {
    const ms = Math.ceil((base * rs.scale * rs.scale * (0.9 + 0.2 * rnd())) / vsync) * vsync;
    t += ms;
    if (t > (secs - 20) * 1000) { n++; if (ms <= onTime) ok++; }
    if (rs.frame(ms)) log.push({ t, s: rs.scale });
  }
  return { rs, log, onTime: ok / n, changes: (a, b) => log.filter((e) => e.t > a * 1000 && e.t <= b * 1000).length };
}
check("a 60 Hz phone whose lake costs 19 to 30 ms (a steady 33 ms from the load) steps down to 60 fps", () => {
  for (const base of [19, 22, 26, 30]) {
    const p = phone(base);
    const first = p.log[0];
    console.log("      cost " + base + " ms: scale " + p.rs.scale.toFixed(3) + ", " + Math.round(p.onTime * 100) + "% of frames on time in the last 20 s, first step at " + (first ? (first.t / 1000).toFixed(1) + " s" : "none"));
    assert.ok(first && first.t < 3000 && first.s < 1, "cost " + base + ": no step down in the first 3 s");
    assert.ok(p.onTime >= 0.9, "cost " + base + ": only " + Math.round(p.onTime * 100) + "% of frames on time");
    assert.ok(!p.rs.capped, "cost " + base + ": the load was taken for a cap");
  }
});
check("a phone on the edge (17.5 ms at full scale) does not pump the sharpness: each failed climb waits longer", () => {
  const p = phone(17.5);
  console.log("      " + p.log.map((e) => (e.t / 1000).toFixed(1) + " s: " + e.s.toFixed(3)).join(", "));
  assert.ok(p.changes(0, 60) <= 10, p.changes(0, 60) + " changes in the first minute");
  assert.ok(p.changes(60, 120) <= 3, p.changes(60, 120) + " changes in the second minute");
  assert.ok(p.onTime >= 0.9, "only " + Math.round(p.onTime * 100) + "% of frames on time");
  // the climbs back to the full scale come further and further apart
  const tries = p.log.filter((e) => e.s === 1).map((e) => e.t);
  for (let i = 2; i < tries.length; i++) assert.ok(tries[i] - tries[i - 1] > tries[i - 1] - tries[i - 2], "the wait did not grow: " + JSON.stringify(tries));
});
check("a screen held at 30 Hz with a heavy lake (40 ms at full scale) steps down to a steady 30 fps", () => {
  const p = phone(40, { vsync: 1000 / 30, onTime: 1000 / 30 + 1 });
  console.log("      scale " + p.rs.scale.toFixed(3) + ", " + Math.round(p.onTime * 100) + "% of frames at 30 fps in the last 20 s, " + p.changes(60, 120) + " changes in the second minute");
  assert.ok(p.rs.scale < 1 && p.rs.capped);
  assert.ok(p.onTime >= 0.9, "only " + Math.round(p.onTime * 100) + "% of frames at 30 fps");
  assert.ok(p.changes(60, 120) <= 3, p.changes(60, 120) + " changes in the second minute");
});
check("slow, then a steady 33 ms on a 30 Hz screen: the scale is not stuck below 1", () => {
  const rs = createRenderScale();
  feed(rs, 6000, () => near(45, 4));
  assert.ok(rs.scale < 1);
  feed(rs, 30000, () => near(1000 / 30, 0.5));
  assert.equal(rs.scale, 1);
});

check("a 60 Hz game that misses most frames (uneven 17 and 33 ms) still steps down", () => {
  const rs = createRenderScale();
  feed(rs, 6000, () => (rnd() < 0.65 ? near(1000 / 30) : near(HZ60)));
  assert.ok(rs.scale < 1, "scale " + rs.scale);
});

check("a 120 Hz screen: 120 fps and 60 fps both keep the full scale", () => {
  const a = createRenderScale(), b = createRenderScale();
  feed(a, 10000, () => near(1000 / 120, 0.5));
  feed(b, 10000, () => near(HZ60));
  assert.equal(a.scale, 1); assert.equal(b.scale, 1);
});

check("stalls (the page was away) and junk times do not count", () => {
  const rs = createRenderScale();
  for (const ms of [2000, 900, 300, NaN, -5, 0, undefined]) for (let i = 0; i < 100; i++) assert.equal(rs.frame(ms), false);
  assert.equal(rs.scale, 1);
});

check("reset() goes back to the full scale", () => {
  const rs = createRenderScale();
  feed(rs, 8000, () => 45);
  assert.ok(rs.scale < 1);
  rs.reset();
  assert.equal(rs.scale, 1);
  // and it decides again only on new frames
  assert.equal(rs.frame(45), false);
});

console.log(failed ? `\n${failed} check(s) failed` : "\nall render scale checks passed");
process.exit(failed ? 1 : 0);
