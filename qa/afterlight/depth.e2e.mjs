import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(
  new URL("../browser/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const base = process.env.AFTERLIGHT_URL || "http://127.0.0.1:8765",
  directory = "/tmp/afterlight-depth";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
const errors = [],
  report = { layouts: [], campaign: [] };
const state = (p) =>
  p.evaluate(() => JSON.parse(JSON.stringify(__afterlightAction.state)));
async function ready(p) {
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 400 && new URL(r.url()).origin === new URL(base).origin)
      errors.push(`${r.status()} ${r.url()}`);
  });
  await p.goto(base + "/afterlight/");
  await p.waitForFunction(
    () => window.__afterlightAction?.renderer?.canvas?.dataset.renderer,
  );
}
async function hold(p, selector, ms) {
  const r = await p.locator(selector).boundingBox();
  assert.ok(r);
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(ms);
  await p.mouse.up();
}
try {
  if (!process.env.AFTERLIGHT_DEPTH_FOCUS) {
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
      const before = await state(p);
      await p.keyboard.down("ArrowRight");
      await p.waitForTimeout(300);
      await p.keyboard.up("ArrowRight");
      assert.ok((await state(p)).x > before.x);
      await p.keyboard.press("E");
      assert.ok(
        (await state(p)).pulseCooldown > 0,
        "native E triggers tactical pulse",
      );
      await p.keyboard.press("Shift");
      assert.ok((await state(p)).dodge.cooldown > 0);
      await hold(p, "#action-fire", 250);
      assert.ok((await state(p)).heat > 0);
      await p.locator("#action-pause").click();
      const time = (await state(p)).time;
      await p.waitForTimeout(200);
      assert.equal((await state(p)).time, time);
      await p.locator("#action-begin").click();
      await p.evaluate(() => dispatchEvent(new Event("pagehide")));
      assert.equal((await state(p)).phase, "paused");
      await p.locator("#action-begin").click();
      const bounds = await p.evaluate(() => {
        const c = __afterlightAction.renderer.canvas.getBoundingClientRect();
        return {
          width: innerWidth,
          height: innerHeight,
          sw: document.documentElement.scrollWidth,
          sh: document.documentElement.scrollHeight,
          canvas: { x: c.x, y: c.y, w: c.width, h: c.height },
          engine: __afterlightAction.renderer.canvas.dataset.renderer,
        };
      });
      assert.equal(bounds.sw, bounds.width);
      assert.equal(bounds.sh, bounds.height);
      assert.equal(bounds.canvas.w, bounds.width);
      assert.equal(bounds.canvas.h, bounds.height);
      report.layouts.push(bounds);
      await p.screenshot({
        path: `${directory}/active-${viewport.width}x${viewport.height}.png`,
      });
      await p.close();
    }
    const p = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await ready(p);
    await p.locator("#action-begin").click();
    report.depth = await p.evaluate(() => {
      const r = __afterlightAction.renderer;
      return {
        diagnostics: r.diagnostics,
        near: r.project(100, 90),
        far: r.project(100, 30),
      };
    });
    assert.equal(report.depth.diagnostics.type, "PerspectiveCamera");
    assert.ok(report.depth.diagnostics.triangles > 1000);
    assert.ok(
      report.depth.near.size > report.depth.far.size * 1.2,
      "objects nearer camera project larger",
    );
    report.depth.raycast = await p.evaluate(() => {
      const r = __afterlightAction.renderer,
        a = r.project(100, 62, 0),
        b = r.aim(a.x, a.y);
      return { screen: a, ground: b };
    });
    assert.ok(
      Math.abs(report.depth.raycast.ground.x - 100) < 0.5 &&
        Math.abs(report.depth.raycast.ground.y - 62) < 0.5,
      "groundraycast roundtrip",
    );
    report.depth.occlusion = await p.evaluate(() => {
      const r = __afterlightAction.renderer;
      let count = 0,
        visible = 0,
        examples = [];
      for (let y = 25; y <= 90; y += 5)
        for (let x = 15; x < 190; x += 5) {
          const q = r.project(x, y);
          if (q.visible) {
            visible++;
            if (r.isOccluded(x, y)) {
              count++;
              if (examples.length < 3) examples.push({ x, y });
            }
          }
        }
      return { count, visible, examples };
    });
    assert.ok(
      report.depth.occlusion.count > 0 &&
        report.depth.occlusion.count < report.depth.occlusion.visible,
      "real scenery occludes some groundpoints",
    );
    report.heat = await p.evaluate(() => {
      const a = __afterlightAction,
        e = a.engine,
        s = a.state;
      for (let i = 0; i < 200 && !s.overheated && s.phase === "playing"; i++)
        e.updateAction(s, { fire: true }, 0.05);
      const overheated = s.overheated,
        blocked = e.fireAction(s);
      for (let i = 0; i < 100 && s.overheated; i++)
        e.updateAction(s, { fire: false }, 0.05);
      a.render();
      return {
        overheated,
        blocked,
        recovered: !s.overheated,
        heat: s.heat,
        phase: s.phase,
      };
    });
    assert.equal(report.heat.overheated, true);
    assert.equal(report.heat.blocked, false);
    assert.equal(report.heat.recovered, true);
    assert.equal(report.heat.phase, "playing");
    for (let n = 0; n < 6; n++) {
      const outcome = await p.evaluate(() => {
        const a = __afterlightAction,
          e = a.engine,
          s = a.state;
        let pulses = 0,
          dodges = 0,
          cooling = false;
        for (let i = 0; i < 24000 && s.phase === "playing"; i++) {
          const near = s.enemies.find(
            (v) =>
              Math.hypot(v.x - s.x, v.y - s.y) < 22 &&
              ["windup", "charge"].includes(v.mode),
          );
          if (near && s.pulseCooldown <= 0) {
            e.pulseAction(s);
            pulses++;
          }
          let target = s.survivors.some((v) => v.status === "following")
            ? s.beacon
            : s.survivors
                .filter((v) => v.status === "stranded")
                .sort(
                  (a, b) =>
                    Math.hypot(a.x - s.x, a.y - s.y) -
                    Math.hypot(b.x - s.x, b.y - s.y),
                )[0] || s.beacon;
          if (s.stage === "defend")
            target = {
              x: 100 + 10 * Math.cos(s.time * 0.8),
              y: 62 + 10 * Math.sin(s.time * 0.8),
            };
          const dx = target.x - s.x,
            dy = target.y - s.y,
            d = Math.hypot(dx, dy);
          if (s.heat > 0.8) cooling = true;
          if (s.heat < 0.3) cooling = false;
          const tether = s.tethers.find((t) => t.survivorId === target.id);
          const danger = s.enemies.some(
            (v) => Math.hypot(v.x - s.x, v.y - s.y) < 14,
          );
          if (s.dodge.cooldown <= 0 && danger && d > 3) {
            e.dodgeAction(s, dx, dy);
            dodges++;
          }
          e.updateAction(
            s,
            {
              dx: d > 2 ? dx / d : 0,
              dy: d > 2 ? dy / d : 0,
              fire: !cooling,
              ...(tether && !danger ? { aimX: tether.x, aimY: tether.y } : {}),
            },
            0.05,
          );
        }
        a.render();
        return {
          phase: s.phase,
          region: s.region,
          rescued: s.rescued,
          hp: s.hp,
          guardianDefeated: s.guardianDefeated,
          tethers: s.tethers.length,
          pulses,
          dodges,
          kills: s.kills,
        };
      });
      report.campaign.push(outcome);
      assert.equal(outcome.phase, n === 5 ? "won" : "region-complete");
      assert.equal(outcome.rescued, 3);
      assert.equal(outcome.tethers, 0);
      assert.equal(outcome.guardianDefeated, true);
      await p.screenshot({
        path: `${directory}/${outcome.region}-restored.png`,
      });
      if (n < 5) {
        await p.locator("#action-begin").click();
        assert.equal((await state(p)).phase, "playing");
      }
    }
    await p.close();
  }
  if (process.env.AFTERLIGHT_DEPTH_FOCUS) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await ready(p);
    await p.locator("#action-begin").click();
    await p.waitForTimeout(1000);
    report.performance = await p.evaluate(
      () =>
        new Promise((resolve) => {
          const times = [];
          let last = performance.now(),
            begin = last;
          function frame(t) {
            times.push(t - last);
            last = t;
            if (t - begin < 3000) requestAnimationFrame(frame);
            else {
              times.sort((a, b) => a - b);
              resolve({
                frames: times.length,
                durationMs: t - begin,
                medianMs: times[Math.floor(times.length / 2)],
                p95Ms: times[Math.floor(times.length * 0.95)],
              });
            }
          }
          requestAnimationFrame(frame);
        }),
    );
    report.backend = await p.evaluate(() => ({ dataset: {...__afterlightAction.renderer.canvas.dataset}, diagnostics: __afterlightAction.renderer.diagnostics }));
    await p.screenshot({ path: `${directory}/latest-desktop.png` });
    const before = await p.evaluate(() =>
      __afterlightAction.renderer.diagnostics.camera.slice(),
    );
    await p.keyboard.down("w");
    await p.waitForTimeout(900);
    await p.keyboard.up("w");
    await p.waitForTimeout(250);
    const after = await p.evaluate(() =>
      __afterlightAction.renderer.diagnostics.camera.slice(),
    );
    assert.notDeepEqual(after, before, "camera tracks real traversal");
    report.camera = { before, after };
    await p.screenshot({ path: `${directory}/latest-traversal.png` });
    await p.close();
    const q = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    await ready(q);
    await q.locator("#action-begin").click();
    await q.screenshot({ path: `${directory}/latest-phone.png` });
    await q.close();
  }
  if (process.env.AFTERLIGHT_DEPTH_FOCUS) {
    report.startup = [];
    for (const route of ["/afterlight/", "/battle-tanks/"]) {
      const q = await browser.newPage();
      await q.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          if (String(type).startsWith("webgl")) return null;
          return original.call(this, type, ...args);
        };
      });
      await q.goto(base + route);
      await q.waitForFunction(() =>
        document
          .querySelector("#action-title")
          ?.textContent.match(/could not start/i),
      );
      const info = await q.evaluate(() => ({
        title: document.querySelector("#action-title").textContent,
        description: document.querySelector("#action-description").textContent,
        button: document.querySelector("#action-begin").textContent,
        disabled: document.querySelector("#action-begin").disabled,
        classic: Boolean(
          document.querySelector('a[href="/afterlight/classic.html"]'),
        ),
      }));
      assert.ok(info.classic);
      assert.ok(info.disabled || /retry/i.test(info.button));
      report.startup.push({ route, ...info });
      await q.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/${process.env.AFTERLIGHT_DEPTH_FOCUS ? "focus-report" : "report"}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
