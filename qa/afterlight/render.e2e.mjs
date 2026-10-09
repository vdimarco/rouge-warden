import assert from "node:assert/strict";
import { chromium } from "../browser/node_modules/playwright/index.mjs";
const browser = await chromium.launch({
  executablePath: process.env.AFTERLIGHT_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 700 },
    deviceScaleFactor: 2,
  });
  await page.goto(
    `${process.env.AFTERLIGHT_BASE_URL || "http://127.0.0.1:8765"}/afterlight/scenes.js`,
  );
  const results = await page.evaluate(async () => {
    const { createRenderer } = await import("/afterlight/render.js"),
      { createJourney } = await import("/afterlight/engine.js");
    const report = [];
    const compare = (a, b) => {
      const aa = a.getContext("2d").getImageData(0, 0, a.width, a.height).data,
        bb = b.getContext("2d").getImageData(0, 0, b.width, b.height).data;
      let changed = 0;
      for (let k = 0; k < aa.length; k++) if (aa[k] !== bb[k]) changed++;
      return changed;
    };
    for (const reducedMotion of [false, true]) {
      const a = document.createElement("canvas"),
        b = document.createElement("canvas"),
        dirty = createRenderer(a, {
          width: 1200,
          reducedMotion,
          pixelRatio: 1,
        }),
        reference = createRenderer(b, {
          width: 1200,
          reducedMotion,
          fullRedraw: true,
          pixelRatio: 1,
        }),
        state = createJourney(37);
      state.phase = "playing";
      for (const region of [
        "forest",
        "city",
        "coast",
        "fjord",
        "desert",
        "moon",
      ]) {
        state.region = region;
        const times = [];
        for (let frame = 0; frame < 30; frame++) {
          state.time = frame / 30;
          state.x = 35 + frame * 0.24;
          state.y = 82 + Math.sin(frame * 0.2) * 2;
          // Both renderers receive the same ordered source frames. Original scenes cache
          // nearest-palette searches, so fresh factories are not a valid history reference.
          const start = performance.now();
          dirty.render(state, state.time);
          if (frame) times.push(performance.now() - start);
          reference.render(state, state.time);
        }
        const finalDifference = compare(a, b);
        a.width = 1199;
        b.width = 1199;
        dirty.resize();
        reference.resize();
        dirty.render(state, state.time);
        reference.render(state, state.time);
        const resizeDifference = compare(a, b);
        times.sort((a, b) => a - b);
        report.push({
          region,
          reducedMotion,
          width: a.width,
          height: a.height,
          finalDifference,
          resizeDifference,
          median: Math.round(times[Math.floor(times.length * 0.5)] * 10) / 10,
          p95: Math.round(times[Math.floor(times.length * 0.95)] * 10) / 10,
        });
      }
      dirty.dispose();
      reference.dispose();
    }
    return report;
  });
  for (const result of results) {
    assert.equal(result.width, 1200);
    assert.equal(result.height, 600);
    assert.equal(
      result.finalDifference,
      0,
      `${result.region} ${result.reducedMotion ? "reduced" : "normal"} dirty pixels`,
    );
    assert.equal(result.resizeDifference, 0, `${result.region} resize pixels`);
    console.log(JSON.stringify(result));
  }
  console.log(
    "Dirty-cell compositor matches full redraw across all regions, motion preferences, travel and resize.",
  );
} finally {
  await browser.close();
}
