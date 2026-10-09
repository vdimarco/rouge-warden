import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(
  new URL("../browser/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const routes = [
  "lighthouse-keeper",
  "echoes-under-ice",
  "last-train-home",
  "firefly-courier",
  "mirage-runner",
  "orbital-gardener",
];
const base = process.env.SCENE_GAMES_URL || "http://127.0.0.1:8765";
const directory = "/tmp/ascii-scene-qa";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.SCENE_GAMES_CHROMIUM || "/usr/bin/chromium",
});
const errors = [];
const snapshot = (page) =>
  page.evaluate(() =>
    JSON.parse(JSON.stringify((window.__sceneGame || window.__coastal).state)),
  );
const phase = (page) =>
  page.evaluate(() => (window.__sceneGame || window.__coastal).state.phase);
async function ready(page, route) {
  page.on("pageerror", (e) => errors.push(route + ": " + e.message));
  page.on("response", (r) => {
    if (r.status() >= 400)
      errors.push(route + ": " + r.status() + " " + r.url());
  });
  await page.goto(base + "/" + route + "/");
  await page.waitForFunction(
    () =>
      document.querySelector("#scene")?.width > 0 &&
      (window.__sceneGame || window.__coastal),
  );
}
async function start(page) {
  await page.locator("#start,#primary").click();
  assert.equal(await phase(page), "playing");
}
async function pause(page) {
  await page.keyboard.press("p");
  assert.equal(await phase(page), "paused");
  const before = await snapshot(page);
  await page.waitForTimeout(180);
  assert.deepEqual(
    await snapshot(page),
    before,
    "paused model must remain unchanged",
  );
  await page.keyboard.press("p");
  assert.equal(await phase(page), "playing");
}
try {
  for (const route of routes.filter(
    (route) =>
      !process.env.SCENE_GAMES_ONLY ||
      process.env.SCENE_GAMES_ONLY.split(",").includes(route),
  )) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await ready(page, route);
    await page.screenshot({ path: directory + "/" + route + "-title.png" });
    await start(page);
    const before = await snapshot(page);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(250);
    await page.keyboard.up("ArrowRight");
    const after = await snapshot(page);
    assert.notDeepEqual(after, before, route + " keyboard play changes model");
    if (route === "lighthouse-keeper")
      assert.ok(after.beam > before.beam, "keyboard sweeps beam");
    if (route === "last-train-home")
      assert.ok(after.lane > before.lane, "keyboard changes route lane");
    if (route === "firefly-courier")
      assert.ok(after.x > before.x, "keyboard moves courier");
    if (
      route === "mirage-runner" ||
      route === "orbital-gardener" ||
      route === "echoes-under-ice"
    )
      assert.ok(after.x > before.x, "keyboard moves player right");
    await pause(page);
    await page.evaluate(() => dispatchEvent(new Event("pagehide")));
    assert.equal(await phase(page), "paused", route + " pagehide pauses");
    await page.keyboard.press("p");
    assert.equal(await phase(page), "playing");
    const switcher = page.locator("[data-switch]");
    assert.equal(await switcher.count(), 1, route + " switcher installed");
    await switcher.click();
    for (const target of [...routes, "last-light"])
      assert.equal(
        await page
          .locator(
            target === route
              ? ".gsw-list a.here"
              : '.gsw-list a[href="/' + target + '/"]',
          )
          .count(),
        1,
        route + " switcher contains " + target,
      );
    assert.equal(await phase(page), "paused", route + " switcher pauses");
    await page.keyboard.press("Escape");
    // Reset via actual exposed start action: a retry must clear elapsed/progress.
    if (await page.locator("#retry").count())
      await page.locator("#retry").click();
    else if (route.includes("keeper") || route === "echoes-under-ice")
      await page.locator("#start").click();
    else {
      await page.keyboard.press("p");
      await page.evaluate(() => window.__sceneGame.step(1000));
      assert.equal(
        await phase(page),
        "lost",
        route + " deadline produces terminal outcome",
      );
      await page.locator("#start").click();
    }
    assert.equal(await phase(page), "playing");
    const retry = await snapshot(page);
    assert.ok(
      (retry.time ?? retry.elapsed ?? 0) < 1,
      route + " retry resets elapsed time",
    );
    await page.screenshot({ path: directory + "/" + route + "-desktop.png" });
    await page.close();
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      const context = await browser.newContext({
        viewport,
        hasTouch: true,
        isMobile: true,
      });
      const mobile = await context.newPage();
      await ready(mobile, route);
      assert.ok(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + " horizontal overflow " + viewport.width,
      );
      await start(mobile);
      if (viewport.width > viewport.height) {
        const sceneBox = await mobile.locator("#scene").boundingBox();
        assert.ok(
          sceneBox &&
            sceneBox.y >= 0 &&
            sceneBox.y + sceneBox.height <= viewport.height + 1,
          route + " landscape scene fits viewport",
        );
        const primary = mobile.locator("#pause,#primary").first();
        const primaryBox = await primary.boundingBox();
        assert.ok(
          primaryBox &&
            primaryBox.y >= 0 &&
            primaryBox.y + primaryBox.height <= viewport.height + 1,
          route + " landscape primary control fits viewport",
        );
      }
      const action = mobile.locator('#action,[data-key="action"]');
      if ((await action.count()) && (await action.first().isVisible())) {
        await action.first().scrollIntoViewIfNeeded();
        const box = await action.first().boundingBox();
        assert.ok(
          box && box.width >= 24 && box.height >= 24,
          route + " action touch target",
        );
        await action.first().tap();
      }
      const direction = mobile.locator(
        '[data-key="ArrowRight"],[data-key="right"]',
      );
      if (await direction.count()) {
        await direction.first().scrollIntoViewIfNeeded();
        const b = await direction.first().boundingBox();
        await mobile.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await mobile.mouse.down();
        await mobile.waitForTimeout(100);
        await direction
          .first()
          .dispatchEvent("pointercancel", {
            pointerId: 1,
            pointerType: "mouse",
            bubbles: true,
          });
        await mobile.mouse.up();
        assert.equal(
          await mobile.locator(".held").count(),
          0,
          route + " pointercancel releases held input",
        );
      }
      const scene = mobile.locator("#water,#arena,#play").first();
      await scene.dispatchEvent("pointercancel", {
        pointerId: 9,
        pointerType: "touch",
        bubbles: true,
      });
      await mobile.screenshot({
        path:
          directory +
          "/" +
          route +
          "-" +
          viewport.width +
          "x" +
          viewport.height +
          ".png",
      });
      await context.close();
    }
    const reduced = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    reduced.on("pageerror", (e) =>
      errors.push(route + " blocked storage: " + e.message),
    );
    await reduced.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new DOMException("Storage disabled", "SecurityError");
      };
      Storage.prototype.setItem = () => {
        throw new DOMException("Storage disabled", "SecurityError");
      };
    });
    await ready(reduced, route);
    await start(reduced);
    const image = await reduced
      .locator("#scene")
      .evaluate((c) => c.toDataURL());
    await reduced.waitForTimeout(250);
    assert.equal(
      await reduced.locator("#scene").evaluate((c) => c.toDataURL()),
      image,
      route + " reduced motion freezes background",
    );
    await reduced.close();
    console.log(
      "PASS " +
        route +
        " lifecycle, inputs, switcher, viewport and reduced-motion checks",
    );
  }
  const arcade = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  for (const route of routes) {
    await arcade.goto(base + "/?machines");
    await arcade.locator("#machinePicker").waitFor();
    const cab = arcade.locator('.cab[data-game="' + route + '"]');
    assert.equal(await cab.count(), 1, "cabinet " + route);
    assert.equal(await cab.getAttribute("data-url"), "/" + route + "/");
    const option = await arcade
      .locator('#machinePicker optgroup[label="ASCII Scenes"] option')
      .evaluateAll(
        (els, slug) =>
          els.find(
            (el) =>
              el.textContent
                .toLowerCase()
                .replace(/[^a-z]+/g, "-")
                .replace(/^-|-$/g, "") === slug,
          )?.value,
        route,
      );
    assert.ok(option !== undefined, "machine picker option " + route);
    await arcade.locator("#machinePicker").selectOption(option);
    await arcade.locator("#machinePicker").evaluate((el) => el.blur());
    await arcade.keyboard.press("5");
    await arcade.waitForTimeout(50);
    await arcade.keyboard.press("1");
    await arcade.waitForURL(base + "/" + route + "/");
    assert.equal(
      new URL(arcade.url()).pathname,
      "/" + route + "/",
      "token launch " + route,
    );
  }
  await arcade.close();
  assert.deepEqual(errors, []);
  console.log(
    "Scene collection browser checks passed. Screenshots: " + directory,
  );
} finally {
  await browser.close();
}
