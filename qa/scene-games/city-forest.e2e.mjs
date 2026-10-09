import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("../browser/node_modules/playwright");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
for (const game of ["last-train-home", "firefly-courier"])
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:8765/${game}/`);
    await page.click("#start");
    await page.waitForTimeout(500);
    assert.equal(
      await page.evaluate(() => window.__sceneGame.state.phase),
      "playing",
    );
    await page.locator('[data-key="ArrowLeft"]').dispatchEvent("pointerdown");
    await page.click("#action");
    await page.click("#pause");
    assert.equal(
      await page.evaluate(() => window.__sceneGame.state.phase),
      "paused",
    );
    await page.click("#start");
    assert.equal(
      await page.evaluate(() => window.__sceneGame.state.phase),
      "playing",
    );
    await page.screenshot({
      path: `/tmp/${game}-${viewport.width}x${viewport.height}.png`,
    });
    await page.evaluate(() => dispatchEvent(new Event("pagehide")));
    assert.equal(
      await page.evaluate(() => window.__sceneGame.state.phase),
      "paused",
    );
    assert.deepEqual(errors, []);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.close();
  }
await browser.close();
console.log(
  "City and forest: desktop/portrait/landscape interactions, no errors, lifecycle pause pass.",
);
