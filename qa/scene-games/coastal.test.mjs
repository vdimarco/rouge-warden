import test from "node:test";
import assert from "node:assert/strict";
import {
  createWatch,
  step as watch,
  select,
} from "../../public/lighthouse-keeper/engine.js";
import {
  createDive,
  step as dive,
  sonar,
} from "../../public/echoes-under-ice/engine.js";
test("Eight lighthouse boats can be steered safely around the reef into harbor", () => {
  const s = createWatch();
  for (let t = 0; t < 200 && s.phase === "playing"; t += 0.05) {
    for (const b of s.boats) {
      if (!b.done) {
        b.tx = b.x > 70 ? 65 : 42;
        b.ty = b.x > 70 ? 68 : 91;
      }
    }
    watch(s, 0.05);
  }
  assert.equal(s.phase, "won");
  assert.equal(s.saved, 8);
  assert.equal(s.wrecks, 0);
});
test("Unattended lighthouse watch ends after three wrecks", () => {
  const s = createWatch();
  for (let t = 0; t < 100 && s.phase === "playing"; t += 0.05) watch(s, 0.05);
  assert.equal(s.phase, "lost");
  assert.equal(s.wrecks, 3);
});
test("Selected boat receives waypoint and pause freezes time", () => {
  const s = createWatch();
  watch(s, 0.1);
  s.beam = s.boats[0].x;
  select(s, s.boats[0].x, s.boats[0].y);
  select(s, 42, 91);
  assert.equal(s.boats[0].tx, 42);
  s.phase = "paused";
  watch(s, 1);
  assert.equal(s.time, 0.1);
});
test("Sonar recovery wins a complete dive with navigation and surface recharge", () => {
  const s = createDive();
  function travel(x, y) {
    for (
      let i = 0;
      i < 500 && Math.hypot(s.x - x, s.y - y) > 1 && s.phase === "playing";
      i++
    )
      dive(s, 0.1, x - s.x, ((y - s.y) * 17) / 11);
    assert.ok(["playing", "won"].includes(s.phase));
  }
  for (const b of s.bells) {
    if (b.got) continue;
    travel(s.x, 67);
    while (s.oxygen < 95 && s.phase === "playing") dive(s, 0.1);
    while (s.pulse > 0) dive(s, 0.1);
    assert(sonar(s));
    travel(b.x, b.y);
    if (!b.got) {
      while (s.pulse > 0) dive(s, 0.1);
      sonar(s);
      dive(s, 0.1);
    }
  }
  assert.equal(s.phase, "won");
  assert.equal(s.collected, 6);
  assert.ok(s.time < 150);
});
test("Dive can expire, oxygen can run out, and pause preserves resources", () => {
  const s = createDive();
  s.y = 96;
  dive(s, 80);
  assert.equal(s.phase, "lost");
  const timed = createDive();
  dive(timed, 151);
  assert.equal(timed.phase, "lost");
  const paused = createDive();
  paused.phase = "paused";
  dive(paused, 50, 1, 1);
  assert.equal(paused.time, 0);
  assert.equal(paused.oxygen, 100);
});
