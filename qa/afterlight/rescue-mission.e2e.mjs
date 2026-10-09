import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(
  new URL("../browser/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const base = process.env.AFTERLIGHT_URL || "http://127.0.0.1:8765";
const directory = "/tmp/afterlight-rescue-mission";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AFTERLIGHT_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const errors = [],
  report = { layouts: [], checks: [] };
const state = (p) =>
  p.evaluate(() => JSON.parse(JSON.stringify(window.__afterlight.state)));
async function ready(p) {
  p.setDefaultTimeout(12000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 400 && new URL(r.url()).origin === new URL(base).origin)
      errors.push(r.status() + " " + r.url());
  });
  await p.goto(base + "/afterlight/");
  await p.waitForFunction(() =>
    window.__afterlight?.game?.scene?.isActive("journey"),
  );
}
async function near(p, id) {
  await p.waitForFunction(async (id) => {
    const e = await import("/afterlight/engine.js");
    return e.getContext(window.__afterlight.state).landmarkId === id;
  }, id);
}
async function action(p, id) {
  const b = p.locator('[data-challenge-action="' + id + '"]');
  await p.waitForFunction((id) => {
    const b = document.querySelector('[data-challenge-action="' + id + '"]');
    return b && !b.disabled;
  }, id);
  await b.click();
}
async function approachFly(p, id) {
  await p.evaluate(async (id) => {
    const e = await import("/afterlight/engine.js"),
      a = window.__afterlight;
    for (let i = 0; i < 1200 && a.state.phase === "playing"; i++) {
      const f = a.state.challenge?.fireflies.find((f) => f.id === id);
      if (!f || f.caught) break;
      const dx = f.x - a.state.x,
        dy = f.y - a.state.y,
        d = Math.hypot(dx, dy);
      if (d < 2) break;
      e.update(a.state, { dx: dx / d, dy: dy / d }, Math.min(0.08, d / 22));
    }
    a.render();
  }, id);
}
async function returnToGrove(p) {
  await p.evaluate(async () => {
    const e = await import("/afterlight/engine.js"),
      a = window.__afterlight;
    for (let i = 0; i < 1200 && a.state.phase === "playing"; i++) {
      const l = a.state.challenge?.anchor;
      if (!l) break;
      const dx = l.x - a.state.x,
        dy = l.y - a.state.y,
        d = Math.hypot(dx, dy);
      if (d < 1.5) break;
      e.update(a.state, { dx: dx / d, dy: dy / d }, Math.min(0.08, d / 22));
    }
    a.render();
  });
}
async function collect(p) {
  for (let i = 0; i < 3; i++) {
    const f = (await state(p)).challenge.fireflies.find((f) => !f.caught);
    assert.ok(f);
    await approachFly(p, f.id);
    const before = (await state(p)).challenge.carried;
    await action(p, "sweep-lantern");
    assert.equal(
      (await state(p)).challenge.carried,
      before + 1,
      "one nearby firefly caught per sweep",
    );
  }
}
try {
  if (!process.env.AFTERLIGHT_RESCUE_NORMAL_ONLY) {
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
      const intro = (await p.locator("#intro").textContent()).toLowerCase();
      assert.match(intro, /(?:three|3) (?:boat )?crews/);
      assert.match(intro, /six.beacon|6.beacon/);
      assert.match(intro, /courier/);
      assert.match(intro, /pack/);
      await p.screenshot({
        path: directory + "/opening-" + viewport.width + ".png",
      });
      await p.click("#begin");
      const missionText = (
        await p.locator(".mission").textContent()
      ).toLowerCase();
      assert.match(missionText, /rescue|crew/);
      assert.match(missionText, /pack|courier/);
      assert.ok(
        (await p.locator("#mission-steps").textContent()).trim().length > 0,
      );
      assert.equal(
        (await p.locator('[data-landmark="you"]').textContent()).trim(),
        "YOU",
        "player identified over the actual Phaser scene",
      );
      await p.locator('[data-landmark="you"]').waitFor({ state: "visible" });
      const playerLabel = await p
          .locator('[data-landmark="you"]')
          .boundingBox(),
        sceneBox = await p.locator("#phaser-scene").boundingBox();
      assert.ok(
        playerLabel.x >= sceneBox.x &&
          playerLabel.y >= sceneBox.y &&
          playerLabel.x + playerLabel.width <= sceneBox.x + sceneBox.width &&
          playerLabel.y + playerLabel.height <= sceneBox.y + sceneBox.height,
        "YOU label lies within scene",
      );
      const labeledPlayer = await state(p);
      assert.ok(
        Math.abs(
          playerLabel.x +
            playerLabel.width / 2 -
            (sceneBox.x + (labeledPlayer.x / 200) * sceneBox.width),
        ) < 14,
        "YOU label tracks player horizontal position",
      );
      assert.match(
        (
          await p.locator('[data-landmark="cache"]').textContent()
        ).toLowerCase(),
        /pack|courier/,
        "destination identified over the actual Phaser scene",
      );
      const before = await state(p);
      await p.locator("#guide").click();
      await p.waitForFunction(
        ({ x, y }) =>
          Math.hypot(
            window.__afterlight.state.x - x,
            window.__afterlight.state.y - y,
          ) > 1,
        { x: before.x, y: before.y },
      );
      await near(p, "cache");
      await p.locator('#choices [data-choice="gather"]').click();
      assert.ok(
        (await state(p)).inventory.scrap > 0,
        "courier pack supplies collected",
      );
      await p.locator("#guide").click();
      await near(p, "grove-a");
      await p.locator('#choices [data-choice="gather"]').click();
      assert.equal((await state(p)).challenge.variant, "catch");
      assert.equal(
        await p.locator(".operation-dial").count(),
        0,
        "forest has spatial collection instead of bearing puzzle",
      );
      assert.ok(
        await p.locator("#dodge").isVisible(),
        "dodge remains available during spatial collection",
      );
      if (viewport.width !== 1440)
        assert.ok(
          await p.locator('[data-direction="right"]').isVisible(),
          "touch movement remains available",
        );
      const camera = await p.evaluate(
        () =>
          window.__afterlight.game.scene.getScene("journey").cameras.main.zoom,
      );
      assert.ok(
        Math.abs(camera - 1) < 0.01,
        "spatial camera keeps whole scene visible",
      );
      const supplies = (await state(p)).inventory;
      const first = (await state(p)).challenge.fireflies[0];
      await approachFly(p, first.id);
      await p.locator("#arena").focus();
      await p.keyboard.press("Space");
      assert.equal((await state(p)).challenge.carried, 1, "Space sweeps once");
      assert.deepEqual(
        (await state(p)).inventory,
        supplies,
        "catching alone grants no reward",
      );
      await p.locator("#pause").click();
      const frozen = await state(p);
      await p.waitForTimeout(160);
      assert.deepEqual(await state(p), frozen);
      await p.locator("#pause").click();
      if (viewport.width === 1440) {
        await p.evaluate(() => window.__afterlight.save());
        await p.reload();
        await p.waitForFunction(() =>
          window.__afterlight?.game?.scene?.isActive("journey"),
        );
        assert.equal((await state(p)).challenge, null);
        assert.deepEqual(
          (await state(p)).inventory,
          supplies,
          "interrupted catch reload grants no rewards",
        );
        await p.click("#begin");
        await p.locator("#guide").click();
        await near(p, "grove-a");
        await p.locator('#choices [data-choice="gather"]').click();
      } else {
        await p.locator("[data-challenge-cancel]").click();
        assert.equal((await state(p)).challenge, null);
        assert.deepEqual(
          (await state(p)).inventory,
          supplies,
          "cancelled catch preserves inventory",
        );
        await p.locator("#guide").click();
        await near(p, "grove-a");
        await p.locator('#choices [data-choice="gather"]').click();
      }
      await collect(p);
      await returnToGrove(p);
      await p.screenshot({
        path: directory + "/catch-ready-" + viewport.width + ".png",
      });
      await action(p, "deliver");
      assert.equal((await state(p)).challenge, null);
      assert.equal(
        (await state(p)).inventory.seeds,
        supplies.seeds + 2,
        "delivery grants reward once",
      );
      assert.ok((await state(p)).worlds.forest.flags["grove-a"]);
      assert.ok(
        await p.locator('#choices [data-choice="gather"]').isDisabled(),
        "completed grove cannot duplicate reward",
      );
      await p.locator("#arena").focus();
      await p.keyboard.down("ArrowRight");
      await p.waitForTimeout(70);
      await p.keyboard.press("Shift");
      await p.keyboard.up("ArrowRight");
      assert.ok(
        (await state(p)).dodge.cooldown > 0,
        "Shift starts dodge cooldown",
      );
      assert.ok(
        (await state(p)).dodge.remaining > 0,
        "Shift starts brief protection",
      );
      assert.ok(
        await p.locator("#dodge").isDisabled(),
        "dodge unavailable during cooldown",
      );
      await p.waitForFunction(() => !document.querySelector("#dodge").disabled);
      if (viewport.width !== 1440) await p.locator("#dodge").tap();
      else await p.locator("#dodge").click();
      assert.ok(
        (await state(p)).dodge.cooldown > 0,
        "touch dodge activates cooldown",
      );
      await p.screenshot({
        path:
          directory +
          "/mission-" +
          viewport.width +
          "x" +
          viewport.height +
          ".png",
      });
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
          "landscape fits viewport",
        );
      report.layouts.push(viewport);
      await p.close();
      console.log(
        "PASS rescue mission " + viewport.width + "x" + viewport.height,
      );
    }
  }
  const normal = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await ready(normal);
  await normal.click("#begin");
  await normal.evaluate(async () => {
    const e = await import("/afterlight/engine.js"),
      a = window.__afterlight,
      l = e.getLandmarks(a.state).find((l) => l.id === "grove-a");
    for (let i = 0; i < 1000 && a.state.phase === "playing"; i++) {
      const dx = l.x - a.state.x,
        dy = l.y - a.state.y,
        d = Math.hypot(dx, dy);
      if (d < 1.5) break;
      e.update(a.state, { dx: dx / d, dy: dy / d }, Math.min(0.08, d / 22));
    }
    a.render();
  });
  await normal.locator('#choices [data-choice="gather"]').click();
  await normal.waitForTimeout(750);
  assert.equal((await state(normal)).challenge.variant, "catch");
  assert.ok(
    await normal.evaluate(
      () =>
        Math.abs(
          window.__afterlight.game.scene.getScene("journey").cameras.main.zoom -
            1,
        ) < 0.01,
    ),
    "normal-motion spatial catch remains unzoomed",
  );
  const target = await normal.evaluate(
      () => window.__afterlight.mission.steps[0].target,
    ),
    from = await state(normal);
  await normal
    .locator("#mission-steps button")
    .first()
    .evaluate((button) => button.click());
  await normal.waitForTimeout(250);
  const to = await state(normal);
  assert.ok(
    Math.hypot(to.x - target.x, to.y - target.y) <
      Math.hypot(from.x - target.x, from.y - target.y),
    "guide button moves toward live firefly target",
  );
  await normal.screenshot({ path: directory + "/normal-catch-1440x900.png" });
  await normal.close();
  assert.deepEqual(errors, []);
  report.checks = [
    "rescue purpose and first destination",
    "Phaser YOU and courier-pack labels",
    "actual guide movement to pack and grove",
    "three spatial catches and one delivery",
    "cancel/reload preserves supplies",
    "Shift and touch dodge cooldown/protection",
    "three layouts, no errors or missing assets",
    "normal spatial camera stays unzoomed and guide button guides toward live firefly",
  ];
  await writeFile(
    directory +
      (process.env.AFTERLIGHT_RESCUE_NORMAL_ONLY
        ? "/normal-report.json"
        : "/report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
