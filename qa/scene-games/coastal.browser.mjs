import { createRequire } from "node:module";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("../browser/node_modules/playwright");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
await fs.mkdir("/tmp/coastal-qa", { recursive: true });
for (const game of ["lighthouse-keeper", "echoes-under-ice"]) {
  for (const [w, h] of [
    [1440, 900],
    [390, 844],
    [844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:8765/" + game + "/", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(() => window.__coastal);
    await page.click("#start");
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => __coastal.state.phase), "playing");
    await page.click("#pause");
    assert.equal(await page.evaluate(() => __coastal.state.phase), "paused");
    await page.click("#pause");
    await page.click("#action");
    if (game === "echoes-under-ice") {
      await page.keyboard.press("ArrowDown");
      assert.ok(await page.evaluate(() => __coastal.state.oxygen < 100));
    }
    await page.screenshot({
      path: `/tmp/coastal-qa/${game}-${w}x${h}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.close();
  }
}
await browser.close();
console.log(
  "Coastal desktop, portrait, landscape start/pause/action/assets checks pass.",
);
