import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame as desert,
  start as sail,
  step as dunes,
  project,
} from "../../public/mirage-runner/engine.js";
import {
  createGame as space,
  start as orbit,
  step as gravity,
} from "../../public/orbital-gardener/engine.js";
test("desert bot follows true horizon beacons through wind to a complete win", () => {
  const s = desert();
  sail(s);
  for (let i = 0; i < 6000 && s.phase === "playing"; i++) {
    const target = s.objects.find((o) => o.kind === "beacon" && !o.done);
    let x = target?.real ? target.x : 0;
    if (target && !target.real) {
      const rock = s.objects.find(
        (o) => o.kind === "rock" && o.id === target.id,
      );
      if (rock && Math.abs(x - rock.x) < 0.2) x = 0.8;
    }
    dunes(s, 0.02, { left: s.x > x + 0.02, right: s.x < x - 0.02 });
  }
  assert.equal(s.phase, "won");
  assert.equal(s.passed, 12);
  assert.ok(s.score >= 6);
});
test("desert false beacons dissolve at depth, perspective expands objects", () => {
  assert.ok(
    project({ x: 0.5, depth: 0.9, real: true }).x >
      project({ x: 0.5, depth: 0.1, real: true }).x,
  );
  assert.equal(
    project({ x: 0, depth: 0.9, kind: "beacon", real: false }).fade,
    0,
  );
});
test("desert three rock collisions lose the crossing and pause stops time", () => {
  const s = desert();
  sail(s);
  for (let i = 0; i < 3; i++) {
    s.objects = [{ kind: "rock", x: 0, depth: 0.999 }];
    s.x = 0;
    dunes(s, 0.02);
  }
  assert.equal(s.phase, "lost");
  sail(s);
  s.phase = "paused";
  dunes(s, 0.05);
  assert.equal(s.time, 0);
});
test("space bot collects seeds and plants six spaced gardens", () => {
  const s = space();
  orbit(s);
  for (let i = 0; i < 15000 && s.phase === "playing"; i++) {
    const planting = s.cargo > 0,
      target = planting
        ? { x: 22 + s.plants.length * 29, y: 75 }
        : s.seeds.reduce((a, b) =>
            Math.hypot(a.x - s.x, a.y - s.y) < Math.hypot(b.x - s.x, b.y - s.y)
              ? a
              : b,
          );
    gravity(s, 0.01, {
      left: s.x > target.x + 0.8,
      right: s.x < target.x - 0.8,
      up: s.y > target.y + 0.8,
      down: s.y < target.y - 0.8,
      action: planting && Math.abs(s.x - target.x) < 2,
    });
  }
  assert.equal(s.phase, "won");
  assert.equal(s.plants.length, 6);
});
test("gardens alter seed gravity; planting requires cargo and soil", () => {
  const a = space(),
    b = space();
  orbit(a);
  orbit(b);
  b.plants = [{ x: 100, y: 75, born: 0 }];
  gravity(a, 0.05);
  gravity(b, 0.05);
  assert.notEqual(a.seeds[0].vy, b.seeds[0].vy);
  a.cargo = 1;
  a.y = 20;
  gravity(a, 0.05, { action: true });
  assert.equal(a.plants.length, 0);
  a.y = 75;
  gravity(a, 0.05, { action: true });
  assert.equal(a.plants.length, 1);
  assert.equal(a.cargo, 0);
});
test("space deadline loses and retry restores seeds, time and hull", () => {
  const s = space();
  orbit(s);
  s.time = 99.99;
  gravity(s, 0.02);
  assert.equal(s.phase, "lost");
  orbit(s);
  assert.equal(s.phase, "playing");
  assert.equal(s.seeds.length, 10);
  assert.equal(s.time, 0);
  assert.equal(s.health, 3);
  s.phase = "paused";
  gravity(s, 0.05);
  assert.equal(s.time, 0);
});
