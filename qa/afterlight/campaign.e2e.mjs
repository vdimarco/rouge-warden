import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(
  new URL("../browser/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const base = process.env.AFTERLIGHT_URL || "http://127.0.0.1:8765";
const directory = process.env.AFTERLIGHT_SCREENSHOTS || "/tmp/afterlight-qa";
const key = "afterlight:journey:v1";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.AFTERLIGHT_CHROMIUM || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  evidence = { worlds: [], layouts: [], checks: [] };
function monitor(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && new URL(r.url()).origin === new URL(base).origin)
      errors.push(`${r.status()} ${r.url()}`);
  });
  page.setDefaultTimeout(15000);
}
async function ready(page) {
  monitor(page);
  await page.goto(`${base}/afterlight/`);
  await page.waitForFunction(() => window.__afterlight);
}
const state = (page) =>
  page.evaluate(() => JSON.parse(JSON.stringify(window.__afterlight.state)));
async function walk(page, id) {
  const result = await page.evaluate(async (id) => {
    const e = await import("/afterlight/engine.js"),
      a = window.__afterlight,
      s = a.state,
      l = e.WORLDS[s.region].landmarks.find((l) => l.id === id);
    if (!l) throw Error("Unknown landmark " + id);
    let steps = 0;
    while (
      Math.hypot(s.x - l.x, s.y - l.y) > 1.5 &&
      s.phase === "playing" &&
      steps++ < 250
    ) {
      const dx = l.x - s.x,
        dy = l.y - s.y,
        n = Math.hypot(dx, dy);
      e.update(s, { dx: dx / n, dy: dy / n }, Math.min(0.2, n / 17));
    }
    a.render();
    return {
      phase: s.phase,
      near: e.getContext(s).landmarkId,
      steps,
      message: s.message,
    };
  }, id);
  assert.equal(result.phase, "playing", JSON.stringify(result));
  assert.equal(result.near, id, JSON.stringify(result));
}
async function choose(page, id) {
  const before = await state(page);
  const button = page.locator(`#choices [data-choice="${id}"]`);
  await button.waitFor();
  assert.equal(
    await button.isEnabled(),
    true,
    `${before.region}: ${id} disabled`,
  );
  await button.click();
}
async function rest(page) {
  await walk(page, "camp");
  await choose(page, "rest");
}
async function travel(page, region) {
  await page.click("#map");
  assert.equal((await state(page)).phase, "paused");
  await page.locator(`[data-travel="${region}"]`).click();
  assert.equal((await state(page)).region, region);
  assert.equal((await state(page)).phase, "playing");
}
async function sceneRecord(page, region) {
  await page.evaluate((region) => {
    window.__afterlight.render();
    const c = document.querySelector("#scene");
    window.__qaScenes ??= {};
    window.__qaScenes[region] = c
      .getContext("2d")
      .getImageData(0, 0, c.width, c.height)
      .data.slice();
  }, region);
  await page.screenshot({ path: `${directory}/${region}-before.png` });
}
async function sceneDifference(page, region) {
  return page.evaluate((region) => {
    window.__afterlight.render();
    const c = document.querySelector("#scene"),
      now = c.getContext("2d").getImageData(0, 0, c.width, c.height).data,
      before = window.__qaScenes[region];
    let changed = 0;
    for (let i = 0; i < now.length; i += 4)
      if (
        now[i] !== before[i] ||
        now[i + 1] !== before[i + 1] ||
        now[i + 2] !== before[i + 2]
      )
        changed++;
    return {
      changed,
      pixels: now.length / 4,
      width: c.width,
      height: c.height,
    };
  }, region);
}
try {
  if (!process.env.AFTERLIGHT_LAYOUTS_ONLY) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await ready(page);
    assert.equal((await state(page)).phase, "ready");
    await page.click("#journal");
    await page.click("#close-menu");
    assert.equal((await state(page)).phase, "ready");
    await page.click("#begin");
    assert.equal((await state(page)).phase, "playing");
    // Actual keyboard movement and paused-time checks happen before the accelerated legal walk.
    const x = (await state(page)).x;
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(180);
    await page.keyboard.up("ArrowRight");
    assert.ok((await state(page)).x > x);
    await page.click("#pause");
    const frozen = (await state(page)).time;
    await page.waitForTimeout(180);
    assert.equal((await state(page)).time, frozen);
    await page.click("#pause");
    for (const menu of ["map", "journal"]) {
      await page.click("#" + menu);
      const t = (await state(page)).time;
      await page.waitForTimeout(180);
      assert.equal((await state(page)).time, t);
      assert.equal((await state(page)).phase, "paused");
      await page.click("#close-menu");
      assert.equal((await state(page)).phase, "playing");
    }
    evidence.checks.push("keyboard, pause and travel/journal freeze");
    const itinerary = [
      {
        region: "forest",
        cache: ["cache"],
        nodes: ["grove-a", "grove-b", "grove-c"],
        tool: true,
        choice: "gather",
        final: "beacon",
      },
      {
        region: "city",
        cache: ["cache-a", "cache-b"],
        nodes: ["junction-a", "junction-b"],
        choice: "repair",
        final: "station",
      },
      {
        region: "coast",
        nodes: ["boat-a", "boat-b", "boat-c"],
        tool: true,
        choice: "rescue",
        final: "beacon",
      },
      {
        region: "fjord",
        nodes: ["bell-a", "bell-b", "bell-c"],
        tool: true,
        choice: "retrieve",
        final: "spire",
      },
      {
        region: "desert",
        cache: ["cache"],
        nodes: ["stone-a", "stone-b", "stone-c"],
        tool: true,
        choice: "align",
        final: "oasis",
      },
      {
        region: "moon",
        nodes: ["garden-a", "garden-b", "garden-c"],
        choice: "plant",
        final: "relay",
      },
    ];
    for (const item of itinerary) {
      if (item.region !== "forest") await travel(page, item.region);
      await rest(page);
      if (item.region === "city") {
        await page.evaluate(async () => {
          const e = await import("/afterlight/engine.js"),
            a = window.__afterlight;
          for (let i = 0; i < 12000 && a.state.phase === "playing"; i++)
            e.update(a.state, {}, 0.25);
          a.render();
          a.save();
        });
        assert.equal((await state(page)).phase, "lost");
        await page.reload();
        await page.waitForFunction(() => window.__afterlight);
        assert.equal((await state(page)).phase, "lost");
        assert.equal((await state(page)).worlds.forest.restored, 1);
        await page.click("#begin");
        assert.equal((await state(page)).phase, "playing");
        assert.equal((await state(page)).hull, 100);
        assert.equal((await state(page)).worlds.forest.restored, 1);
        evidence.checks.push(
          "legal exhaustion, lost save/reload and camp recovery retain restored worlds",
        );
      }
      await sceneRecord(page, item.region);
      for (const id of item.cache ?? []) {
        await walk(page, id);
        await choose(page, "gather");
      }
      if (item.region === "forest") {
        await rest(page);
        await choose(page, "upgrade");
        assert.equal((await state(page)).tools.shield, true);
        assert.equal((await state(page)).inventory.scrap, 0);
        await choose(page, "salvage");
        assert.equal((await state(page)).inventory.scrap, 1);
        await choose(page, "rest");
        evidence.checks.push(
          "optional shield resource tradeoff and emergency scrap recovery",
        );
      }
      for (const id of item.nodes) {
        await walk(page, id);
        if (item.tool) await page.click("#tool");
        await choose(page, item.choice);
      }
      await walk(page, item.final);
      await choose(page, "restore");
      assert.equal((await state(page)).worlds[item.region].restored, 1);
      const difference = await sceneDifference(page, item.region);
      assert.ok(
        difference.changed > 1000,
        `${item.region}: too few changed pixels ${JSON.stringify(difference)}`,
      );
      evidence.worlds.push({ region: item.region, ...difference });
      await page.screenshot({ path: `${directory}/${item.region}-after.png` });
      if (item.region === "city") {
        const saved = await state(page);
        await travel(page, "forest");
        assert.equal((await state(page)).worlds.forest.restored, 1);
        assert.deepEqual((await state(page)).inventory, saved.inventory);
        assert.equal((await state(page)).tools.sonar, true);
        await travel(page, "city");
        await page.evaluate(() => window.__afterlight.save());
        await page.reload();
        await page.waitForFunction(() => window.__afterlight);
        assert.equal((await state(page)).phase, "ready");
        assert.equal((await state(page)).region, "city");
        assert.equal((await state(page)).worlds.forest.restored, 1);
        assert.equal((await state(page)).tools.sonar, true);
        await page.click("#begin");
        evidence.checks.push(
          "restored revisit, inventory/tools carry and deliberate save/resume",
        );
      }
    }
    assert.equal((await state(page)).phase, "won");
    assert.equal(
      Object.values((await state(page)).worlds).filter((w) => w.restored)
        .length,
      6,
    );
    assert.ok((await state(page)).inventory.seeds >= 0);
    assert.ok((await state(page)).inventory.crystals >= 0);
    await page.evaluate(() => window.__afterlight.save());
    await page.reload();
    await page.waitForFunction(() => window.__afterlight);
    assert.equal((await state(page)).phase, "won");
    await page.click("#explore");
    await page.locator("[data-travel=forest]").click();
    assert.equal((await state(page)).region, "forest");
    assert.equal((await state(page)).worlds.forest.restored, 1);
    assert.equal((await state(page)).ending, true);
    await page.evaluate(() => window.__afterlight.render());
    await page.screenshot({ path: `${directory}/forest-restored-revisit.png` });
    await page.click("#journal");
    await page.locator("[data-new-journey]").click();
    assert.equal((await state(page)).phase, "ready");
    await page.click("#begin");
    assert.equal((await state(page)).region, "forest");
    assert.equal((await state(page)).worlds.forest.restored, 0);
    evidence.checks.push(
      "completed save stays complete and post-win exploration preserves restoration",
    );
    evidence.checks.push(
      "complete six-world campaign through legal movement/tool/choice/travel and new journey",
    );
    await page.close();
  }
  // Layout and pointercancel checks use real touch input so pointer-held motion cannot leak.
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ].filter(
    (v) =>
      !process.env.AFTERLIGHT_VIEWPORT ||
      v.width === Number(process.env.AFTERLIGHT_VIEWPORT),
  )) {
    const p = await browser.newPage({
      viewport,
      hasTouch: viewport.width !== 1440,
      isMobile: viewport.width !== 1440,
      reducedMotion: "reduce",
    });
    await ready(p);
    await p.click("#begin");
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (viewport.width !== 1440) {
      const b = p.locator('[data-direction="right"]');
      const box = await b.boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
      await p.waitForTimeout(100);
      await b.dispatchEvent("pointercancel", { pointerId: 1 });
      await p.mouse.up();
      await p.waitForTimeout(80);
      const stopped = (await state(p)).x;
      await p.waitForTimeout(100);
      assert.equal((await state(p)).x, stopped);
    }
    for (const id of ["map", "journal"]) {
      await p.click("#" + id);
      assert.equal(await p.locator("#menu").evaluate((e) => e.open), true);
      await p.click("#close-menu");
    }
    await p.locator("#arena").focus();
    await p.screenshot({
      path: `${directory}/layout-${viewport.width}x${viewport.height}.png`,
    });
    const dimensions = await p.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    if (viewport.height === 390)
      assert.ok(
        dimensions.scrollHeight <= viewport.height,
        JSON.stringify(dimensions),
      );
    evidence.layouts.push(dimensions);
    await p.evaluate(() => dispatchEvent(new Event("pagehide")));
    assert.equal((await state(p)).phase, "paused");
    await p.evaluate(() => window.__afterlight.resume());
    await p.locator("[data-switch]").click();
    assert.equal((await state(p)).phase, "paused");
    await p.close();
  }
  await writeFile(
    `${directory}/report.json`,
    JSON.stringify(evidence, null, 2),
  );
  const arcade = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  monitor(arcade);
  await arcade.goto(base + "/?machines");
  await arcade.locator("#machinePicker").waitFor();
  assert.equal(
    await arcade.locator(".cab[data-game=afterlight]").getAttribute("data-url"),
    "/afterlight/",
  );
  const option = await arcade
    .locator('#machinePicker optgroup[label="ASCII Scenes"] option')
    .evaluateAll(
      (es) =>
        es.find((e) => e.textContent.trim().toLowerCase() === "afterlight")
          ?.value,
    );
  assert.ok(option !== undefined);
  await arcade.locator("#machinePicker").selectOption(option);
  await arcade.locator("#machinePicker").evaluate((e) => e.blur());
  await arcade.keyboard.press("5");
  await arcade.keyboard.press("1");
  await arcade.waitForURL(base + "/afterlight/");
  assert.equal(new URL(arcade.url()).pathname, "/afterlight/");
  await arcade.close();
  evidence.checks.push("Afterlight machine picker and token5/start1 launch");
  // Fresh malformed or blocked storage must never prevent starting a campaign.
  for (const storage of ["malformed", "blocked"]) {
    const p = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    if (storage === "blocked")
      await p.addInitScript(() =>
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Storage blocked", "SecurityError");
          },
        }),
      );
    else await p.addInitScript((k) => localStorage.setItem(k, "{broken"), key);
    await ready(p);
    assert.equal((await state(p)).phase, "ready");
    await p.click("#begin");
    assert.equal((await state(p)).phase, "playing");
    await p.close();
  }
  evidence.checks.push(
    "pagehide and game-switch pause, touch cancel, selected layouts, malformed/blocked storage",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/report.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
