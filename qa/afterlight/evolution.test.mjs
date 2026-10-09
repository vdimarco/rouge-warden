import test from "node:test";
import assert from "node:assert/strict";
import { SCENES, createScene } from "../../public/afterlight/scenes.js";
import { evolveFrame } from "../../public/afterlight/evolution.js";
const differences = (a, b) =>
  a.grid.reduce(
    (n, v, k) => n + (v !== b.grid[k] || a.color[k] !== b.color[k] ? 1 : 0),
    0,
  );
for (const region of Object.keys(SCENES)) {
  test(`${region}: restoration changes scene structure and original grid stays intact`, () => {
    const source = createScene(region),
      frame = source.frame(0, { color: source.color }),
      colors = source.color.slice();
    const before = evolveFrame(
        region,
        frame,
        colors,
        { restored: 0, stage: 0 },
        { reducedMotion: true },
      ),
      middle = evolveFrame(
        region,
        frame,
        colors,
        { restored: 0.5, stage: 1 },
        { reducedMotion: true },
      ),
      after = evolveFrame(
        region,
        frame,
        colors,
        { restored: 1, stage: 3 },
        { reducedMotion: true },
      );
    assert.equal(before.grid.length, 20000);
    assert.equal(after.color.length, 20000);
    assert.ok(
      differences(before, after) > 400,
      `${region} should visibly rebuild more than a few objective glyphs`,
    );
    assert.ok(differences(before, middle) > 100);
    assert.ok(after.grid.every((c) => " ·•●".includes(c)));
    assert.ok(after.color.every((c) => c < SCENES[region].palette.length));
    assert.deepEqual(source.color, colors);
    const later = evolveFrame(
      region,
      frame,
      colors,
      { restored: 1, stage: 3 },
      { time: 40, reducedMotion: true },
    );
    assert.equal(differences(after, later), 0);
    console.log(
      `${region}: ${differences(before, after)} restored cells, ${differences(before, middle)} midpoint cells`,
    );
  });
}
test("active weather and gravity streams move across all six regions", () => {
  for (const region of ["forest", "city", "coast", "fjord", "desert", "moon"]) {
    const source = createScene(region),
      frame = source.frame(0, { color: source.color });
    const a = evolveFrame(
        region,
        frame,
        source.color,
        { restored: 0.5 },
        { time: 0 },
      ),
      b = evolveFrame(
        region,
        frame,
        source.color,
        { restored: 0.5 },
        { time: 30 },
      );
    assert.ok(differences(a, b) > 5, region);
  }
});

test("nurtured groves visibly bloom independently from harvested restoration", () => {
  const source = createScene("forest"),
    frame = source.frame(0, { color: source.color }),
    world = { restored: 1, stage: 3 };
  const harvested = evolveFrame("forest", frame, source.color, world, {
      reducedMotion: true,
    }),
    nurtured = evolveFrame(
      "forest",
      frame,
      source.color,
      { ...world, flags: { "grove-a-bloom": true, "grove-b-bloom": true } },
      { reducedMotion: true },
    );
  assert.ok(differences(harvested, nurtured) > 70);
});
