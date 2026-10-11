import { chromium } from "../browser/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
fs.mkdirSync("/tmp/scene-games-qa", { recursive: true });
for (const slug of ["mirage-runner", "orbital-gardener"])
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [844, 390],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: width < 1000,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:8765/${slug}/`);
    await page.waitForFunction(() => window.__sceneGame);
    await page.locator("#primary").click();
    await page.waitForTimeout(500);
    const initial = await page.evaluate(() => window.__sceneGame.state.x);
    if (width === 1440) {
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(300);
      await page.keyboard.up("ArrowRight");
    } else {
      const b = page.locator('[data-key="right"]');
      await b.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "touch",
      });
      await page.waitForTimeout(300);
      await b.dispatchEvent("pointercancel", {
        pointerId: 1,
        pointerType: "touch",
      });
    }
    assert.ok(
      (await page.evaluate(() => window.__sceneGame.state.x)) > initial,
    );
    await page.locator("#primary").click();
    const t = await page.evaluate(() => window.__sceneGame.state.time);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__sceneGame.state.time), t);
    await page.locator("#primary").click();
    await page.locator("#retry").click();
    assert.equal(await page.evaluate(() => window.__sceneGame.state.health), 3);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const bounds = await page.locator("#primary").boundingBox();
    assert.ok(bounds.y + bounds.height <= height);
    await page.screenshot({
      path: `/tmp/scene-games-qa/${slug}-${width}x${height}.png`,
    });
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${slug} ${width}x${height} passed`);
  }
await browser.close();
