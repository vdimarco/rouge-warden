import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const require = createRequire(
  new URL("../browser/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const base = process.env.AFTERLIGHT_URL || "http://127.0.0.1:8765";
const directory =
  process.env.AFTERLIGHT_LIVING_SCREENSHOTS || "/tmp/afterlight-living-worlds";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AFTERLIGHT_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const errors = [],
  evidence = { operations: [], layouts: [], checks: [] };
function monitor(page) {
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && new URL(r.url()).origin === new URL(base).origin)
      errors.push(r.status() + " " + r.url());
  });
}
async function ready(page) {
  monitor(page);
  await page.goto(base + "/afterlight/");
  await page.waitForFunction(() =>
    window.__afterlight?.game?.scene?.isActive("journey"),
  );
  assert.equal(await page.evaluate(() => Phaser.VERSION), "3.90.0");
  assert.equal(
    await page.locator("#phaser-scene").getAttribute("data-engine"),
    "Phaser 3.90.0",
  );
}
const state = (p) =>
  p.evaluate(() => JSON.parse(JSON.stringify(window.__afterlight.state)));
async function walk(page, id) {
  const result = await page.evaluate(async (id) => {
    const e = await import("/afterlight/engine.js"),
      a = window.__afterlight,
      s = a.state;
    let steps = 0;
    while (s.phase === "playing" && steps++ < 1200) {
      const landmarks = e.getLandmarks
        ? e.getLandmarks(s)
        : e.WORLDS[s.region].landmarks;
      const l = landmarks.find((l) => l.id === id);
      if (!l) throw Error("Unknown landmark " + id);
      const dx = l.x - s.x,
        dy = l.y - s.y,
        n = Math.hypot(dx, dy);
      if (n < 1.5) break;
      e.update(s, { dx: dx / n, dy: dy / n }, Math.min(0.1, n / 22));
    }
    a.render();
    return {
      phase: s.phase,
      near: e.getContext(s).landmarkId,
      steps,
      message: s.message,
      challenge: s.challenge,
    };
  }, id);
  assert.equal(result.phase, "playing", JSON.stringify(result));
  assert.equal(result.near, id, JSON.stringify(result));
}
async function choose(page, id) {
  const b = page.locator('#choices [data-choice="' + id + '"]');
  await b.waitFor();
  assert.ok(await b.isEnabled(), id + " enabled");
  await b.click();
}
async function travel(page, region) {
  await page.click("#map");
  assert.equal((await state(page)).phase, "paused");
  await page.locator('[data-travel="' + region + '"]').click();
  assert.equal((await state(page)).region, region);
  assert.equal((await state(page)).phase, "playing");
}
async function rest(page) {
  await walk(page, "camp");
  await choose(page, "rest");
}
async function capture(page, name) {
  await page.evaluate(() => window.__afterlight.render());
  await page.screenshot({ path: directory + "/" + name + ".png" });
}
// Operation solving uses explicit player decisions and engine movement updates only.
// No coordinates, resources, completion flags or operation answers are overwritten.
async function op(page, id) {
  const button = page.locator('[data-challenge-action="' + id + '"]');
  await button.waitFor();
  assert.ok(await button.isEnabled(), "operation " + id + " enabled");
  await button.click();
}
async function moveTo(page, x, y) {
  const r = await page.evaluate(
    async ({ x, y }) => {
      const e = await import("/afterlight/engine.js"),
        a = window.__afterlight,
        s = a.state;
      let n = 0;
      while (
        s.phase === "playing" &&
        Math.hypot(s.x - x, s.y - y) > 1.4 &&
        n++ < 1600
      ) {
        const dx = x - s.x,
          dy = y - s.y,
          d = Math.hypot(dx, dy);
        e.update(s, { dx: dx / d, dy: dy / d }, Math.min(0.08, d / 22));
      }
      a.render();
      return { phase: s.phase, n, x: s.x, y: s.y, challenge: s.challenge };
    },
    { x, y },
  );
  assert.equal(r.phase, "playing", JSON.stringify(r));
  assert.ok(r.n < 1600, JSON.stringify(r));
}
async function solve(page) {
  const initial = (await state(page)).challenge;
  assert.ok(initial, "operation started");
  console.log("Operating " + initial.id);
  let actions = 0;
  while ((await state(page)).challenge && actions++ < 80) {
    const c = (await state(page)).challenge;
    if (c.type === "forest") {
      if (c.angle !== c.targets[c.step]) await op(page, "turn-right");
      else if (c.step === 0) {
        await page.locator("#arena").focus();
        await page.keyboard.press("Space");
        assert.equal(
          (await state(page)).challenge?.step,
          1,
          "Space advances one forest lock",
        );
      } else await op(page, "focus");
    } else if (c.type === "city") {
      const cell = c.cells[c.selected];
      if (cell.rotation !== cell.target) await op(page, "rotate-cell");
      else if (c.cells.every((z) => z.rotation === z.target))
        await op(page, "energize");
      else await op(page, "next-cell");
    } else if (c.type === "coast" && c.variant === "escort") {
      if (c.mode === "waiting") {
        await page.locator("#arena").focus();
        await page.keyboard.press("e");
        assert.equal(
          (await state(page)).challenge?.mode,
          "escorting",
          "E attaches once",
        );
      }
      await op(page, "signal");
      const s = await state(page);
      await moveTo(page, s.x, 94);
      await moveTo(page, 42, 94);
      await moveTo(page, 42, 89);
      await op(page, "release");
    } else if (c.type === "coast")
      await op(page, "signal-" + c.pattern[c.step]);
    else if (c.type === "fjord") {
      await op(page, "channel-" + c.pattern[c.step]);
      await op(page, "ping");
      await op(page, "listen");
      await op(page, "catch");
    } else if (c.type === "desert") {
      if (!c.read) await op(page, "read-wind");
      else if (c.angle !== c.targets[c.step]) await op(page, "bearing-right");
      else await op(page, "anchor");
    } else if (c.type === "moon") {
      if (c.step === 0) {
        await page.locator("#arena").focus();
        await page.keyboard.press(
          String(["water", "root", "light"].indexOf(c.pattern[c.step]) + 1),
        );
        assert.equal(
          (await state(page)).challenge?.step,
          1,
          "numeric shortcut advances one moon stage",
        );
      } else await op(page, "cultivate-" + c.pattern[c.step]);
    } else throw Error("Unknown operation " + JSON.stringify(c));
  }
  assert.equal(
    (await state(page)).challenge,
    null,
    "operation ends without state overwrite",
  );
  assert.ok(actions < 80, "operation finite");
  evidence.operations.push({
    region: initial.type,
    landmark: initial.landmarkId,
    actions,
    escort: initial.variant === "escort",
  });
}
try {
  if (process.env.AFTERLIGHT_LIVING_DIAGNOSTICS_ONLY) {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      const p = await browser.newPage({
        viewport,
        reducedMotion: "reduce",
        hasTouch: viewport.width !== 1440,
      });
      await ready(p);
      await p.click("#begin");
      const before = await state(p);
      await p.waitForTimeout(300);
      const after = await state(p);
      assert.notEqual(
        after.environment.weatherPhase,
        before.environment.weatherPhase,
        "living weather advances",
      );
      const terrain = await p.evaluate(async () => {
        const e = await import("/afterlight/engine.js"),
          s = window.__afterlight.state;
        return {
          start: e.terrainAt(s, 35, 87),
          mud: e.terrainAt(s, 130, 84),
          patches: s.terrain.length,
          weather: document.querySelector("#conditions").textContent,
        };
      });
      assert.ok(
        terrain.mud.friction < terrain.start.friction,
        "mud physically slows traversal",
      );
      assert.ok(terrain.patches >= 3);
      assert.ok(terrain.weather.length > 0, "weather and ground cue visible");
      const frames = await p.evaluate(
        () =>
          new Promise((resolve) => {
            const samples = [];
            let last = performance.now();
            function frame(now) {
              samples.push(now - last);
              last = now;
              if (samples.length >= 31) {
                samples.shift();
                samples.sort((a, b) => a - b);
                resolve({
                  meanMs: samples.reduce((a, b) => a + b) / samples.length,
                  p95Ms: samples[Math.floor(samples.length * 0.95)],
                  frames: window.__afterlight.game.loop.frame,
                  canvases: document.querySelectorAll("#scene canvas").length,
                });
              } else requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
          }),
      );
      assert.equal(frames.canvases, 1);
      assert.ok(frames.frames > 20);
      assert.ok(frames.p95Ms < 250, "no repeated quarter-second frame stalls");
      await p.click("#pause");
      await p.waitForTimeout(100);
      const image = await p
        .locator("#phaser-scene")
        .evaluate((c) => c.toDataURL());
      await p.waitForTimeout(150);
      assert.equal(
        await p.locator("#phaser-scene").evaluate((c) => c.toDataURL()),
        image,
        "paused reduced-motion composition remains stable",
      );
      await p.click("#pause");
      const button = p.locator('[data-direction="right"]');
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await p.mouse.down();
        await p.waitForTimeout(100);
        await button.dispatchEvent("pointercancel", { pointerId: 1 });
        await p.mouse.up();
        await p.waitForTimeout(100);
        const x = (await state(p)).x;
        await p.waitForTimeout(100);
        assert.equal(
          (await state(p)).x,
          x,
          "pointercancel stops held movement",
        );
      }
      evidence.layouts.push({ ...viewport, ...frames, terrain });
      await p.close();
    }
    const normal = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await ready(normal);
    await normal.click("#begin");
    const canvas = await normal.locator("#phaser-scene").boundingBox();
    const startX = (await state(normal)).x;
    await normal.mouse.click(
      canvas.x + canvas.width * 0.28,
      canvas.y + canvas.height * 0.87,
    );
    await normal.waitForTimeout(180);
    assert.ok(
      (await state(normal)).x > startX,
      "Phaser canvas pointer steers traveler",
    );
    await normal.click("#pause");
    await normal.click("#pause");
    await walk(normal, "grove-a");
    await normal.click("#tool");
    await choose(normal, "gather");
    await normal.waitForTimeout(850);
    assert.ok(
      await normal.evaluate(
        () =>
          Math.abs(
            window.__afterlight.game.scene.getScene("journey").cameras.main
              .zoom - 1.13,
          ) < 0.01,
      ),
      "normal-motion camera focuses operation",
    );
    await capture(normal, "operation-normal-desktop");
    await normal.locator("[data-challenge-cancel]").click();
    await normal.waitForTimeout(850);
    assert.ok(
      await normal.evaluate(
        () =>
          Math.abs(
            window.__afterlight.game.scene.getScene("journey").cameras.main
              .zoom - 1,
          ) < 0.01,
      ),
      "camera returns after leaving",
    );
    await normal.emulateMedia({ reducedMotion: "reduce" });
    await normal.waitForFunction(() =>
      window.__afterlight?.game?.scene?.isActive("journey"),
    );
    assert.equal(
      await normal.locator("#scene canvas").count(),
      1,
      "motion change replaces runtime without duplicate canvas",
    );
    await normal.close();
    evidence.checks.push(
      "Phaser pointer movement, normal camera focus/return, runtime motion replacement",
    );
    let terminalSave = null;
    try {
      terminalSave = await readFile(directory + "/won-journey.json", "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (terminalSave) {
      const ending = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
      });
      await ending.addInitScript(
        (raw) => localStorage.setItem("afterlight:journey:v1", raw),
        terminalSave,
      );
      await ready(ending);
      assert.equal((await state(ending)).phase, "won");
      await ending.click("#explore");
      await ending.locator("[data-travel=forest]").click();
      assert.equal((await state(ending)).worlds.forest.restored, 1);
      assert.equal((await state(ending)).ending, true);
      await capture(ending, "forest-restored-revisit");
      await ending.emulateMedia({ reducedMotion: "no-preference" });
      await ending.waitForFunction(() =>
        window.__afterlight?.game?.scene?.isActive("journey"),
      );
      evidence.normalWorlds = [];
      for (const region of [
        "forest",
        "city",
        "coast",
        "fjord",
        "desert",
        "moon",
      ]) {
        if ((await state(ending)).region !== region)
          await travel(ending, region);
        await ending.waitForTimeout(750);
        assert.equal(
          await ending.locator("#phaser-scene").getAttribute("data-region"),
          region,
        );
        const performanceSample = await ending.evaluate(
          () =>
            new Promise((resolve) => {
              const times = [];
              let last = performance.now();
              function frame(t) {
                times.push(t - last);
                last = t;
                if (times.length === 61) {
                  times.shift();
                  times.sort((a, b) => a - b);
                  resolve({
                    meanMs: times.reduce((a, b) => a + b) / times.length,
                    p95Ms: times[Math.floor(times.length * 0.95)],
                    weather:
                      document.querySelector("#phaser-scene").dataset.weather,
                    actors:
                      document.querySelector("#phaser-scene").dataset.actors,
                  });
                } else requestAnimationFrame(frame);
              }
              requestAnimationFrame(frame);
            }),
        );
        assert.ok(
          performanceSample.p95Ms < 250,
          region + " normal motion has no repeated long stalls",
        );
        await capture(ending, region + "-normal-restored");
        evidence.normalWorlds.push({ region, ...performanceSample });
      }
      await travel(ending, "forest");
      await ending.click("#journal");
      await ending.locator("[data-new-journey]").click();
      assert.equal((await state(ending)).phase, "ready");
      await ending.click("#begin");
      assert.equal((await state(ending)).worlds.forest.restored, 0);
      await ending.close();
      evidence.checks.push(
        "earned terminal save explores restored world and new journey resets progress",
      );
    }
    assert.deepEqual(errors, []);
    await writeFile(
      directory + "/diagnostics.json",
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence, null, 2));
  } else {
    if (!process.env.AFTERLIGHT_LAYOUTS_ONLY) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
      });
      await ready(page);
      await page.click("#begin");
      await capture(page, "forest-start");
      const x = (await state(page)).x;
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(180);
      await page.keyboard.up("ArrowRight");
      assert.ok((await state(page)).x > x);
      await page.click("#pause");
      const frozen = await state(page);
      await page.waitForTimeout(220);
      assert.deepEqual(await state(page), frozen);
      await page.click("#pause");
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
        for (const id of item.cache || []) {
          await walk(page, id);
          await choose(page, "gather");
        }
        for (const id of item.nodes) {
          await walk(page, id);
          if (item.tool) await page.click("#tool");
          await choose(page, item.choice);
          assert.equal((await state(page)).challenge?.type, item.region);
          if (id === item.nodes[0]) {
            const supplies = (await state(page)).inventory;
            await page.click("#pause");
            const pending = await state(page);
            await page.waitForTimeout(150);
            assert.deepEqual(await state(page), pending);
            await page.click("#pause");
            await page.locator("[data-challenge-cancel]").click();
            assert.equal((await state(page)).challenge, null);
            assert.deepEqual(
              (await state(page)).inventory,
              supplies,
              "cancel preserves supplies",
            );
            await choose(page, item.choice);
            if (item.region === "forest") {
              await page.evaluate(() => window.__afterlight.save());
              await page.reload();
              await page.waitForFunction(() =>
                window.__afterlight?.game?.scene?.isActive("journey"),
              );
              assert.equal((await state(page)).phase, "ready");
              assert.equal(
                (await state(page)).challenge,
                null,
                "pending operation resets safely on reload",
              );
              assert.deepEqual((await state(page)).inventory, supplies);
              await page.click("#begin");
              await choose(page, item.choice);
            }
          }
          await solve(page);
          assert.ok(
            (await state(page)).worlds[item.region].flags[id],
            id + " completed",
          );
        }
        await walk(page, item.final);
        await choose(page, "restore");
        if ((await state(page)).challenge) await solve(page);
        assert.equal((await state(page)).worlds[item.region].restored, 1);
        await capture(page, item.region + "-restored");
        evidence.checks.push(
          item.region + " restored through movement and operation controls",
        );
        console.log("Restored " + item.region);
      }
      assert.equal((await state(page)).phase, "won");
      await page.evaluate(() => window.__afterlight.save());
      await writeFile(
        directory + "/won-journey.json",
        await page.evaluate(() =>
          localStorage.getItem("afterlight:journey:v1"),
        ),
      );
      await page.reload();
      await page.waitForFunction(() =>
        window.__afterlight?.game?.scene?.isActive("journey"),
      );
      assert.equal((await state(page)).phase, "won");
      await page.click("#explore");
      await page.locator("[data-travel=forest]").click();
      assert.equal((await state(page)).worlds.forest.restored, 1);
      assert.equal((await state(page)).ending, true);
      await capture(page, "forest-restored-revisit");
      await page.click("#journal");
      await page.locator("[data-new-journey]").click();
      assert.equal((await state(page)).phase, "ready");
      await page.click("#begin");
      assert.equal((await state(page)).worlds.forest.restored, 0);
      evidence.checks.push(
        "completed save, post-ending exploration and fresh journey",
      );
      await page.close();
    }
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
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
      if (viewport.height === 390)
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollHeight <= innerHeight,
          ),
          "landscape full layout fits",
        );
      await walk(p, "grove-a");
      await p.click("#tool");
      await choose(p, "gather");
      await capture(p, "operation-" + viewport.width + "x" + viewport.height);
      await solve(p);
      await p.evaluate(() => dispatchEvent(new Event("pagehide")));
      assert.equal((await state(p)).phase, "paused");
      await p.evaluate(() => window.__afterlight.resume());
      await p.locator("[data-switch]").click();
      assert.equal((await state(p)).phase, "paused");
      await p.close();
      evidence.layouts.push(viewport);
    }
    for (const storage of ["malformed", "blocked"]) {
      const p = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      if (storage === "blocked")
        await p.addInitScript(() =>
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new DOMException("Storage disabled", "SecurityError");
            },
          }),
        );
      else
        await p.addInitScript(() =>
          localStorage.setItem("afterlight:journey:v1", "{broken"),
        );
      await ready(p);
      assert.equal((await state(p)).phase, "ready");
      await p.click("#begin");
      assert.equal((await state(p)).phase, "playing");
      await p.close();
    }
    evidence.checks.push("malformed and blocked storage startup");
    assert.deepEqual(errors, []);
    await writeFile(
      directory +
        (process.env.AFTERLIGHT_LAYOUTS_ONLY
          ? "/layout-report.json"
          : "/report.json"),
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence, null, 2));
  }
} finally {
  await browser.close();
}
