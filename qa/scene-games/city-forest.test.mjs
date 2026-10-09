import test from "node:test";
import assert from "node:assert/strict";
import * as city from "../../public/last-train-home/engine.js";
import * as forest from "../../public/firefly-courier/engine.js";
test("correct reflections complete the seven crossing route", () => {
  const s = city.create();
  s.phase = "playing";
  for (const lane of city.routes) {
    s.lane = lane;
    city.step(s, 4);
  }
  assert.equal(s.phase, "won");
  assert.equal(s.leg, 7);
  assert.ok(s.score >= 700);
});
test("wrong crossings and final train timer lose", () => {
  let s = city.create();
  s.phase = "playing";
  for (let i = 0; i < 3; i++) {
    s.lane = (city.routes[s.leg] + 1) % 3;
    city.step(s, 4);
  }
  assert.equal(s.phase, "lost");
  s = city.create();
  s.phase = "playing";
  city.step(s, 90);
  assert.equal(s.phase, "lost");
});
test("forest remembers revealed path and delivers all lanterns", () => {
  const s = forest.create();
  s.phase = "playing";
  forest.act(s, " ");
  forest.act(s, "ArrowUp");
  assert.equal(s.y, 4);
  forest.act(s, " ");
  for (let i = 1; i < forest.trail.length; i++) {
    const prev = forest.trail[i - 1],
      next = forest.trail[i];
    forest.act(
      s,
      next[0] < prev[0]
        ? "ArrowLeft"
        : next[0] > prev[0]
          ? "ArrowRight"
          : next[1] < prev[1]
            ? "ArrowUp"
            : "ArrowDown",
    );
  }
  assert.equal(s.phase, "won");
  assert.equal(s.delivered.length, 5);
});
test("thorns exhaust light and paused engines freeze", () => {
  const s = forest.create();
  s.phase = "playing";
  for (let i = 0; i < 15; i++)
    forest.act(s, i % 2 ? "ArrowRight" : "ArrowLeft");
  assert.equal(s.phase, "lost");
  for (const engine of [city, forest]) {
    const p = engine.create();
    p.phase = "paused";
    const before = structuredClone(p);
    engine.step(p, 10);
    assert.deepEqual(p, before);
  }
});
