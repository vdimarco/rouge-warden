import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(
  new URL("../browser/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const base = process.env.AFTERLIGHT_URL || "http://127.0.0.1:8765";
const directory = "/tmp/afterlight-action";
await mkdir(directory, { recursive: true });
const errors = [],
  report = { layouts: [], campaign: [], motion: [] };
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AFTERLIGHT_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const state = (p) =>
  p.evaluate(() => JSON.parse(JSON.stringify(__afterlightAction.state)));
async function ready(p) {
  p.setDefaultTimeout(12000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 400 && new URL(r.url()).origin === new URL(base).origin)
      errors.push(`${r.status()} ${r.url()}`);
  });
  await p.goto(base + "/afterlight/");
  await p.waitForFunction(() =>
    window.__afterlightAction?.game?.scene?.isActive("action"),
  );
  await p.waitForFunction(
    () =>
      Number(
        document.querySelector("#action-scene canvas")?.dataset.sourceFrames,
      ) > 0,
  );
  assert.equal(await p.evaluate(() => Phaser.VERSION), "3.90.0");
  const picture = await p.evaluate(() => {
    const r = __afterlightAction.game.scene
      .getScene("action")
      .picture.getBounds();
    return {
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
      vw: innerWidth,
      vh: innerHeight,
    };
  });
  assert.ok(
    Math.abs(picture.x) < 1 &&
      Math.abs(picture.y) < 1 &&
      Math.abs(picture.w - picture.vw) < 1 &&
      Math.abs(picture.h - picture.vh) < 1,
    "actual Phaser picture fills viewport",
  );
}
async function hold(p, selector, ms = 350) {
  const b = await p.locator(selector).boundingBox();
  assert.ok(b);
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(ms);
  await p.mouse.up();
}
async function solveRegion(p, stopAtGuardian = false) {
  return p.evaluate((stopAtGuardian) => {
    const a = __afterlightAction,
      e = a.engine,
      s = a.state;
    let dodges = 0;
    for (let n = 0; n < 15000 && s.phase === "playing"; n++) {
      const stranded = s.survivors
        .filter((v) => v.status === "stranded")
        .sort(
          (u, v) =>
            Math.hypot(u.x - s.x, u.y - s.y) - Math.hypot(v.x - s.x, v.y - s.y),
        );
      const following = s.survivors.some((v) => v.status === "following");
      let target = following ? s.beacon : stranded[0] || s.beacon;
      if (s.stage === "defend")
        target = {
          x: 100 + 8 * Math.cos(s.time * 0.9),
          y: 62 + 8 * Math.sin(s.time * 0.9),
        };
      const dx = target.x - s.x,
        dy = target.y - s.y,
        d = Math.hypot(dx, dy);
      if (
        s.dodge.cooldown <= 0 &&
        s.enemies.some((v) => Math.hypot(v.x - s.x, v.y - s.y) < 12) &&
        d > 3
      ) {
        e.dodgeAction(s, dx, dy);
        dodges++;
      }
      e.updateAction(
        s,
        { dx: d > 1 ? dx / d : 0, dy: d > 1 ? dy / d : 0, fire: true },
        0.05,
      );
      if (stopAtGuardian && s.enemies.some((v) => v.elite)) break;
    }
    a.render();
    return {
      phase: s.phase,
      region: s.region,
      hp: s.hp,
      rescued: s.rescued,
      completed: [...s.completed],
      kills: s.kills,
      dodges,
      time: s.time,
      guardianSpawned: s.guardianSpawned,
      guardianDefeated: s.guardianDefeated,
      guardianAlive: s.enemies.some((v) => v.elite),
    };
  }, stopAtGuardian);
}
async function frame(p) {
  return p.evaluate(() => {
    const c = document.querySelector("#action-scene canvas"),
      ctx = c.getContext("2d"),
      d = ctx.getImageData(0, 0, c.width, c.height).data,
      out = [];
    for (let y = 0; y < c.height; y += 8)
      for (let x = 0; x < c.width; x += 8) {
        let i = (y * c.width + x) * 4;
        out.push(d[i], d[i + 1], d[i + 2]);
      }
    return { data: out, width: c.width, height: c.height };
  });
}
async function motion(p, region) {
  const a = await frame(p);
  await p.screenshot({ path: `${directory}/${region}-frame-a.png` });
  await p.waitForTimeout(550);
  const b = await frame(p);
  await p.screenshot({ path: `${directory}/${region}-frame-b.png` });
  let changed = 0,
    saturated = 0;
  const tiles = new Set(),
    cols = Math.ceil(a.width / 8),
    rows = Math.ceil(a.height / 8);
  for (let i = 0; i < a.data.length; i += 3) {
    const rgb = b.data.slice(i, i + 3);
    if (Math.max(...rgb) - Math.min(...rgb) > 40 && Math.max(...rgb) > 100)
      saturated++;
    if (Math.max(...rgb.map((v, j) => Math.abs(v - a.data[i + j]))) > 8) {
      changed++;
      const q = i / 3;
      tiles.add(
        `${Math.floor(((q % cols) / cols) * 8)},${Math.floor((Math.floor(q / cols) / rows) * 6)}`,
      );
    }
  }
  const result = {
    region,
    changedFraction: changed / (a.data.length / 3),
    saturatedFraction: saturated / (a.data.length / 3),
    changedTiles: tiles.size,
    totalTiles: 48,
  };
  report.motion.push(result);
  assert.ok(result.changedFraction > 0.03, "broad living scene pixel changes");
  assert.ok(result.changedTiles >= 40, "motion spans scene");
  assert.ok(
    result.saturatedFraction > 0.08,
    "regional saturated light occupies substantial scene",
  );
}
try {
  if (
    !process.env.AFTERLIGHT_ACTION_FOCUS &&
    !process.env.AFTERLIGHT_ACTION_PERFORMANCE_ONLY
  ) {
    if (!process.env.AFTERLIGHT_ACTION_CAMPAIGN_ONLY) {
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]) {
        const p = await browser.newPage({
          viewport,
          hasTouch: viewport.width < 1000,
          reducedMotion: "reduce",
        });
        await ready(p);
        await p.screenshot({
          path: `${directory}/opening-${viewport.width}x${viewport.height}.png`,
        });
        await p.locator("#action-begin").click();
        assert.equal((await state(p)).phase, "playing");
        await p.keyboard.down(" ");
        await p.waitForTimeout(230);
        await p.keyboard.up(" ");
        assert.ok(
          (await state(p)).projectiles.some((v) => v.owner === "player"),
          "Space fires",
        );
        const canvas = await p.locator("#action-scene canvas").boundingBox();
        await p.mouse.move(
          canvas.x + canvas.width * 0.75,
          canvas.y + canvas.height * 0.4,
        );
        await p.mouse.down();
        await p.waitForTimeout(200);
        await p.mouse.up();
        assert.ok(
          Math.abs((await state(p)).aim.x - 150) < 2,
          "pointer aims in playfield coordinates",
        );
        await hold(p, "#action-fire");
        assert.ok(
          (await state(p)).projectiles.some((v) => v.owner === "player"),
          "native fire emits projectile",
        );
        await p.keyboard.press("Shift");
        assert.ok((await state(p)).dodge.cooldown > 0, "Shift dodge cooldown");
        await p.waitForTimeout(1250);
        await p.locator("#action-dodge").click();
        assert.ok((await state(p)).dodge.cooldown > 0, "touch dodge cooldown");
        if (viewport.width < 1000) await hold(p, "[data-move=left]", 120);
        const before = await state(p);
        await p.keyboard.down("ArrowRight");
        await p.waitForTimeout(250);
        await p.keyboard.up("ArrowRight");
        assert.ok(
          (await state(p)).x > before.x,
          "actual keyboard moves courier",
        );
        await p.locator("#action-pause").click();
        const time = (await state(p)).time;
        assert.equal((await state(p)).phase, "paused");
        await p.waitForTimeout(200);
        assert.equal((await state(p)).time, time, "pause freezes simulation");
        await p.locator("#action-begin").click();
        await p.evaluate(() => dispatchEvent(new Event("pagehide")));
        assert.equal((await state(p)).phase, "paused");
        await p.locator("#action-begin").click();
        await p.locator("[data-switch]").click();
        assert.equal((await state(p)).phase, "paused");
        const bounds = await p.evaluate(() => ({
          w: innerWidth,
          h: innerHeight,
          sw: document.documentElement.scrollWidth,
          sh: document.documentElement.scrollHeight,
          canvas: (() => {
            const r = document
              .querySelector("#action-scene canvas")
              .getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          })(),
        }));
        assert.ok(
          bounds.sw <= bounds.w && bounds.sh <= bounds.h,
          "fullscreen document has no overflow",
        );
        assert.equal(bounds.canvas.w, bounds.w);
        assert.equal(bounds.canvas.h, bounds.h);
        await p.locator(".gsw-close").click();
        await p.locator("#action-begin").click();
        await p.screenshot({
          path: `${directory}/active-${viewport.width}x${viewport.height}.png`,
        });
        if (viewport.width === 1440) {
          await p.locator("#action-pause").click();
          await p.evaluate(() => __afterlightAction.save());
          const saved = await state(p);
          await p.reload();
          await p.waitForFunction(() =>
            window.__afterlightAction?.game?.scene?.isActive("action"),
          );
          assert.equal((await state(p)).phase, "ready");
          assert.equal((await state(p)).x, saved.x);
          await p.locator("#action-begin").click();
        }
        report.layouts.push({ viewport, bounds });
        await p.close();
      }
    }
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await ready(p);
    await p.locator("#action-begin").click();
    report.performance = await p.evaluate(
      () =>
        new Promise((resolve) => {
          const times = [];
          let prior = performance.now(),
            begin = prior;
          const initial = Number(
            document.querySelector("#action-scene canvas").dataset.motion,
          );
          function tick(t) {
            times.push(t - prior);
            prior = t;
            if (t - begin < 1200) requestAnimationFrame(tick);
            else {
              times.sort((a, b) => a - b);
              resolve({
                frames: times.length,
                medianMs: times[Math.floor(times.length / 2)],
                p95Ms: times[Math.floor(times.length * 0.95)],
                renderedFrames:
                  Number(
                    document.querySelector("#action-scene canvas").dataset
                      .motion,
                  ) - initial,
                durationMs: t - begin,
              });
            }
          }
          requestAnimationFrame(tick);
        }),
    );
    const classic = "classic-save-preserved";
    await p.evaluate(
      (v) => localStorage.setItem("afterlight:journey:v1", v),
      classic,
    );
    for (let n = 0; n < 6; n++) {
      const region = (await state(p)).region;
      await p.waitForFunction(
        () =>
          document.querySelector("#action-scene canvas").dataset.sourceReady ===
          "true",
      );
      await motion(p, region);
      const guardian = await solveRegion(p, true);
      assert.equal(guardian.phase, "playing");
      assert.equal(guardian.guardianAlive, true);
      assert.equal(guardian.guardianDefeated, false);
      await p.screenshot({ path: `${directory}/${region}-guardian.png` });
      const outcome = await solveRegion(p);
      report.campaign.push(outcome);
      assert.equal(outcome.rescued, 3);
      assert.equal(outcome.guardianSpawned, true);
      assert.equal(outcome.guardianDefeated, true);
      assert.equal(outcome.guardianAlive, false);
      assert.equal(outcome.phase, n === 5 ? "won" : "region-complete");
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${directory}/${region}-restored.png` });
      await p.evaluate(() => __afterlightAction.save());
      assert.equal(
        await p.evaluate(() => localStorage.getItem("afterlight:journey:v1")),
        classic,
      );
      if (n < 5) {
        await p.locator("#action-begin").click();
        assert.equal((await state(p)).phase, "playing");
      }
    }
    await p.reload();
    await p.waitForFunction(() =>
      window.__afterlightAction?.game?.scene?.isActive("action"),
    );
    await p.waitForFunction(
      () =>
        Number(
          document.querySelector("#action-scene canvas")?.dataset.sourceFrames,
        ) > 0,
    );
    assert.equal((await state(p)).phase, "won");
    assert.equal((await state(p)).completed.length, 6);
    await p.locator("#action-begin").click();
    assert.equal((await state(p)).region, "forest");
    assert.equal((await state(p)).completed.length, 0);
    await p.close();
    if (!process.env.AFTERLIGHT_ACTION_CAMPAIGN_ONLY) {
      for (const blocked of [false, true]) {
        const q = await browser.newPage();
        await q.addInitScript((blocked) => {
          if (blocked) {
            Object.defineProperty(window, "localStorage", {
              get() {
                throw new DOMException("Blocked", "SecurityError");
              },
            });
          } else localStorage.setItem("afterlight.action.v1", "{broken");
        }, blocked);
        await ready(q);
        assert.equal((await state(q)).phase, "ready");
        await q.locator("#action-begin").click();
        assert.equal((await state(q)).phase, "playing");
        await q.close();
      }
      const c = await browser.newPage();
      await c.goto(base + "/afterlight/classic.html");
      await c.waitForFunction(() =>
        window.__afterlight?.game?.scene?.isActive("journey"),
      );
      await c.locator("#begin").click();
      assert.equal(await c.evaluate(() => __afterlight.state.phase), "playing");
      await c.close();
    }
  }
  if (process.env.AFTERLIGHT_ACTION_FOCUS) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await ready(p);
    await p.locator("#action-begin").click();
    await p.locator("#action-sound").click();
    assert.equal(await p.locator("#action-sound").textContent(), "Sound on");
    await p.locator("#action-sound").click();
    assert.equal(await p.locator("#action-sound").textContent(), "Sound off");
    await p.locator("#action-motion").click();
    assert.equal(
      await p.evaluate(() => __afterlightAction.reducedMotion),
      true,
    );
    const t = (await state(p)).time;
    await p.waitForTimeout(250);
    assert.ok((await state(p)).time > t);
    await p.locator("#action-motion").click();
    assert.equal(
      await p.evaluate(() => __afterlightAction.reducedMotion),
      false,
    );
    await p.locator("#action-pause").click();
    await p.waitForTimeout(500);
    const a = await frame(p);
    await p.waitForTimeout(350);
    const b = await frame(p);
    assert.deepEqual(
      b.data,
      a.data,
      "paused picture freezes after pending source completes",
    );
    await p.locator("#action-begin").click();
    await p.screenshot({ path: `${directory}/latest-normal-desktop.png` });
    await p.evaluate(() => {
      const a = __afterlightAction;
      for (let i = 0; i < 16000 && a.state.phase === "playing"; i++)
        a.engine.updateAction(a.state, {}, 0.05);
      a.render();
    });
    assert.equal((await state(p)).phase, "lost");
    await p.locator("#action-begin").click();
    assert.equal((await state(p)).phase, "playing");
    assert.equal((await state(p)).hp, 100);
    report.focus = [
      "sound control toggles without browser errors (audibility untested)",
      "manual reduced motion keeps simulation running",
      "paused picture freezes",
      "legal combat loss and one-click checkpoint retry",
    ];
    await p.close();
  }
  if (process.env.AFTERLIGHT_ACTION_PERFORMANCE_ONLY) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await ready(p);
    await p.locator("#action-begin").click();
    report.performance = [];
    for (const region of ["forest", "city"]) {
      await p.waitForFunction(
        () =>
          document.querySelector("#action-scene canvas").dataset.sourceReady ===
          "true",
      );
      await p.waitForTimeout(600);
      const metric = await p.evaluate(
        () =>
          new Promise((resolve) => {
            const times = [];
            let prior = performance.now(),
              begin = prior;
            const initial = Number(
              document.querySelector("#action-scene canvas").dataset.motion,
            );
            function tick(t) {
              times.push(t - prior);
              prior = t;
              if (t - begin < 3000) requestAnimationFrame(tick);
              else {
                times.sort((a, b) => a - b);
                resolve({
                  frames: times.length,
                  medianMs: times[Math.floor(times.length / 2)],
                  p95Ms: times[Math.floor(times.length * 0.95)],
                  renderedFrames:
                    Number(
                      document.querySelector("#action-scene canvas").dataset
                        .motion,
                    ) - initial,
                  durationMs: t - begin,
                });
              }
            }
            requestAnimationFrame(tick);
          }),
      );
      report.performance.push({ region, ...metric });
      await motion(p, region);
      await p.screenshot({ path: `${directory}/latest-normal-${region}.png` });
      if (region === "forest") {
        const outcome = await solveRegion(p);
        assert.equal(outcome.phase, "region-complete");
        await p.locator("#action-begin").click();
        assert.equal((await state(p)).region, "city");
      }
    }
    await p.close();
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      const q = await browser.newPage({ viewport, hasTouch: true });
      await ready(q);
      await q.locator("#action-begin").click();
      await q.waitForTimeout(500);
      await q.screenshot({
        path: `${directory}/latest-normal-${viewport.width}x${viewport.height}.png`,
      });
      await q.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/${process.env.AFTERLIGHT_ACTION_PERFORMANCE_ONLY ? "performance-report" : process.env.AFTERLIGHT_ACTION_FOCUS ? "focus-report" : process.env.AFTERLIGHT_ACTION_CAMPAIGN_ONLY ? "campaign-report" : "report"}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (process.env.AFTERLIGHT_ACTION_PERFORMANCE_ONLY)
    for (const metric of report.performance)
      assert.ok(
        metric.medianMs <= 33.4,
        `${metric.region} normal median must reach 30fps`,
      );
} finally {
  await browser.close();
}
