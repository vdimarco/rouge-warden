import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(
  new URL("../browser/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const base = process.env.AFTERLIGHT_URL || "http://127.0.0.1:8765",
  directory = "/tmp/battle-tanks-depth";
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
  p.evaluate(() => JSON.parse(JSON.stringify(__battleTanks.state)));
async function ready(p) {
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 400 && new URL(r.url()).origin === new URL(base).origin)
      errors.push(`${r.status()} ${r.url()}`);
  });
  await p.goto(base + "/battle-tanks/");
  await p.waitForFunction(
    () => window.__battleTanks?.renderer?.canvas?.dataset.renderer,
  );
}
try {
  if (!process.env.BATTLE_TANKS_DEPTH_FOCUS && !process.env.BATTLE_TANKS_DISCOVERY_ONLY) {
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
    await p.keyboard.down("w");
    await p.waitForTimeout(350);
    await p.keyboard.up("w");
    assert.ok((await state(p)).speed > 0);
    assert.ok((await state(p)).x > before.x);
    const hull = (await state(p)).hullAngle;
    const aim = await p.evaluate(() =>
      __battleTanks.renderer.project(40, 50, 0),
    );
    await p.mouse.move(aim.x, aim.y);
    await p.waitForTimeout(80);
    assert.equal(
      (await state(p)).hullAngle,
      hull,
      "turret aim does not rotate hull",
    );
    assert.ok(Math.abs((await state(p)).turretAngle - hull) > 0.1);
    await p.keyboard.press("Shift");
    assert.ok((await state(p)).smokeCooldown > 0);
    await p.keyboard.press("E");
    assert.ok((await state(p)).artilleryCooldown > 0);
    await p.keyboard.down(" ");
    await p.waitForTimeout(220);
    await p.keyboard.up(" ");
    assert.ok((await state(p)).shots > 0);
    await p.locator("#action-pause").click();
    const time = (await state(p)).time;
    await p.waitForTimeout(200);
    assert.equal((await state(p)).time, time);
    await p.locator("#action-begin").click();
    await p.evaluate(() => dispatchEvent(new Event("pagehide")));
    assert.equal((await state(p)).phase, "paused");
    await p.locator("#action-begin").click();
    await p.locator("[data-switch]").click();
    assert.equal((await state(p)).phase, "paused");
    await p.locator(".gsw-close").click();
    await p.locator("#action-begin").click();
    const bounds = await p.evaluate(() => {
      const r = __battleTanks.renderer.canvas.getBoundingClientRect();
      return {
        w: innerWidth,
        h: innerHeight,
        sw: document.documentElement.scrollWidth,
        sh: document.documentElement.scrollHeight,
        cw: r.width,
        ch: r.height,
      };
    });
    assert.equal(bounds.sw, bounds.w);
    assert.equal(bounds.sh, bounds.h);
    assert.equal(bounds.cw, bounds.w);
    assert.equal(bounds.ch, bounds.h);
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
  for (let mission = 0; mission < 3; mission++) {
    const outcome = await p.evaluate(async () => {
      const e = await import("/battle-tanks/engine.js"),
        a = __battleTanks,
        s = a.state;
      const tactics = () => {
        const r = s.relays.find(
          (r) => r.hp > 0 && Math.hypot(r.x - s.x, r.y - s.y) <= 55,
        );
        if (r && s.artilleryCooldown === 0) e.artillery(s, r);
        if (s.hp < 80 && s.smokeCooldown === 0) e.smoke(s);
      };
      const drive = (target) => {
        for (let i = 0; i < 2200 && s.phase === "playing"; i++) {
          const dx = target.x - s.x,
            dy = target.y - s.y,
            d = Math.hypot(dx, dy);
          if (d < 3) break;
          const desired = Math.atan2(dy, dx),
            delta = Math.atan2(
              Math.sin(desired - s.hullAngle),
              Math.cos(desired - s.hullAngle),
            );
          e.update(
            s,
            {
              turn: Math.max(-1, Math.min(1, delta * 3)),
              throttle: Math.abs(delta) > 0.8 ? 0 : d < 12 ? 0.4 : 1,
              fire: true,
              autoAim: true,
            },
            0.05,
          );
          tactics();
        }
      };
      for (const target of [
        { x: 20, y: 15 },
        { x: 80, y: 15 },
        { x: 145, y: 15 },
        { x: 183, y: 15 },
      ]) {
        drive(target);
        for (
          let i = 0;
          i < 650 && s.phase === "playing" && s.relays.some((r) => r.hp > 0);
          i++
        ) {
          e.update(s, { fire: true, autoAim: true }, 0.05);
          tactics();
        }
      }
      const beforeExtraction = s.phase,
        dead = s.relays.every((r) => r.hp === 0);
      for (const target of [
        { x: 190, y: 15 },
        { x: 190, y: 92 },
        { x: 178, y: 83 },
      ])
        drive(target);
      a.step({}, 0);
      a.save();
      return {
        missionIndex: s.missionIndex,
        phase: s.phase,
        hp: s.hp,
        dead,
        beforeExtraction,
        completed: s.completed,
        score: s.score,
        shots: s.shots,
      };
    });
    report.campaign.push(outcome);
    assert.equal(outcome.beforeExtraction, "playing");
    assert.equal(outcome.dead, true);
    assert.equal(outcome.phase, mission === 2 ? "won" : "region-complete");
    await p.screenshot({
      path: `${directory}/mission-${mission + 1}-complete.png`,
    });
    if (mission < 2) {
      await p.locator("#action-begin").click();
      assert.equal((await state(p)).phase, "playing");
    }
  }
  await p.reload();
  await p.waitForFunction(() => window.__battleTanks?.renderer);
  assert.equal((await state(p)).phase, "won");
  await p.close();
  }
  if (process.env.BATTLE_TANKS_DEPTH_FOCUS) {
    for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      const q = await browser.newPage({viewport,hasTouch:viewport.width<1000});
      await ready(q);
      await q.locator('#action-begin').click();
      await q.keyboard.down('w');
      await q.waitForTimeout(350);
      await q.keyboard.up('w');
      await q.keyboard.press('Shift');
      await q.waitForTimeout(350);
      await q.screenshot({path:`${directory}/latest-smoke-${viewport.width}x${viewport.height}.png`});
      report.layouts.push({viewport,smokeCooldown:(await state(q)).smokeCooldown,diagnostics:await q.evaluate(()=>__battleTanks.renderer.diagnostics)});
      await q.close();
    }
  }
  if (process.env.BATTLE_TANKS_DISCOVERY_ONLY) {
    const p = await browser.newPage();
    await p.goto(base + '/');
    const cabinet = p.locator('article[data-game="battle-tanks"]');
    assert.equal(await cabinet.getAttribute('data-url'), '/battle-tanks/');
    assert.equal(await cabinet.locator('img').getAttribute('src'), 'battle-tanks/key.svg');
    assert.equal((await p.request.get(base + '/battle-tanks/key.svg')).status(),200);
    if (!await p.locator('.gsw').isVisible()) await p.locator('[data-switch]').click();
    const entry = p.locator('.gsw a[href="/battle-tanks/"]').first();
    await entry.scrollIntoViewIfNeeded();
    assert.equal(await entry.isVisible(), true);
    report.discovery = ['cabinet route/key asset', 'reachable switcher entry'];
    await p.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${directory}/${process.env.BATTLE_TANKS_DISCOVERY_ONLY?'discovery-report':process.env.BATTLE_TANKS_DEPTH_FOCUS?'focus-report':'report'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
