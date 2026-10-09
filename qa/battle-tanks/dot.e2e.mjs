import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const require = createRequire(
  new URL("../browser/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const base = process.env.AFTERLIGHT_URL || "http://127.0.0.1:8765",
  directory = "/tmp/battle-tanks-dot";
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
async function picture(p, name) {
  await p.screenshot({ path: `${directory}/${name}.png` });
}
async function pixels(p) {
  return p.evaluate(() => {
    const a = __battleTanks;
    a.step({}, 0);
    const source = a.renderer.canvas,
      c = document.createElement("canvas");
    c.width = source.width;
    c.height = source.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(source, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0,
      edges = 0,
      warm = 0,
      cool = 0;
    const tiles = new Set();
    for (let y = 1; y < c.height - 1; y++)
      for (let x = 1; x < c.width - 1; x++) {
        const i = (y * c.width + x) * 4,
          r = data[i],
          g = data[i + 1],
          b = data[i + 2],
          brightness = Math.max(r, g, b);
        if (brightness > 85 && brightness - Math.min(r, g, b) > 30) {
          lit++;
          tiles.add(
            `${Math.floor((x / c.width) * 8)},${Math.floor((y / c.height) * 6)}`,
          );
          if (r > g * 1.2 && r > b * 1.2) warm++;
          if (g > r * 1.2 || b > r * 1.2) cool++;
          const left = i - 4,
            right = i + 4,
            up = i - c.width * 4,
            down = i + c.width * 4;
          if (
            [left, right, up, down].some(
              (j) =>
                Math.max(data[j], data[j + 1], data[j + 2]) < brightness * 0.5,
            )
          )
            edges++;
        }
      }
    return {
      width: c.width,
      height: c.height,
      litFraction: lit / (c.width * c.height),
      edgeFraction: edges / Math.max(lit, 1),
      warm,
      cool,
      litTiles: tiles.size,
    };
  });
}
async function mission(p, stopAtRelay = false) {
  return p.evaluate(async (stopAtRelay) => {
    const e = await import("/battle-tanks/engine.js"),
      a = __battleTanks,
      s = a.state;
    let reward = null;
    const tactics = () => {
      const r = s.relays.find(
        (r) => r.hp > 0 && Math.hypot(r.x - s.x, r.y - s.y) <= 55,
      );
      if (r && s.artilleryCooldown === 0) e.artillery(s, r);
      if (s.hp < 80 && s.smokeCooldown === 0) e.smoke(s);
    };
    const tick = (input) => {
      const before = s.wrecks.length;
      e.update(s, input, 0.05);
      tactics();
      if (
        s.wrecks.length > before &&
        s.wrecks.some((v) => v.kind === "relay")
      ) {
        const r = s.wrecks.find((v) => v.kind === "relay");
        reward = {
          id: r.id,
          weaponBoost: s.weaponBoost,
          repair: s.pickups.some((v) => v.id === "repair-" + r.id),
          restorations: s.restorations.length,
        };
      }
      return stopAtRelay && reward;
    };
    const drive = (target) => {
      for (let i = 0; i < 2200 && s.phase === "playing"; i++) {
        const dx = target.x - s.x,
          dy = target.y - s.y,
          d = Math.hypot(dx, dy);
        if (d < 3) return false;
        const delta = Math.atan2(
          Math.sin(Math.atan2(dy, dx) - s.hullAngle),
          Math.cos(Math.atan2(dy, dx) - s.hullAngle),
        );
        if (
          tick({
            turn: Math.max(-1, Math.min(1, delta * 3)),
            throttle: Math.abs(delta) > 0.8 ? 0 : d < 12 ? 0.4 : 1,
            fire: true,
            autoAim: true,
          })
        )
          return true;
      }
      return false;
    };
    for (const target of [
      { x: 20, y: 15 },
      { x: 80, y: 15 },
      { x: 145, y: 15 },
      { x: 183, y: 15 },
    ]) {
      if (drive(target)) break;
      let stopped = false;
      for (
        let i = 0;
        i < 650 && s.phase === "playing" && s.relays.some((r) => r.hp > 0);
        i++
      )
        if (tick({ fire: true, autoAim: true })) {
          stopped = true;
          break;
        }
      if (stopped) break;
    }
    const beforeExtraction = s.phase,
      dead = s.relays.every((r) => r.hp === 0);
    if (!stopAtRelay)
      for (const target of [
        { x: 190, y: 15 },
        { x: 190, y: 92 },
        { x: 178, y: 83 },
      ])
        drive(target);
    a.step({}, 0);
    a.save();
    return {
      phase: s.phase,
      mission: s.missionIndex,
      dead,
      beforeExtraction,
      hp: s.hp,
      reward,
      wrecks: s.wrecks,
      score: s.score,
    };
  }, stopAtRelay);
}
try {
  if (!process.env.BATTLE_TANKS_DOT_FOCUS) {
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
      await picture(p, `opening-${viewport.width}x${viewport.height}`);
      await p.locator("#action-begin").click();
      const before = await state(p);
      const camera = await p.evaluate(() =>
        __battleTanks.renderer.diagnostics.camera.slice(),
      );
      await p.keyboard.down("w");
      await p.waitForTimeout(500);
      await p.keyboard.up("w");
      assert.ok(
        (await state(p)).x > before.x,
        "actual native driving moves hull",
      );
      assert.notDeepEqual(
        await p.evaluate(() => __battleTanks.renderer.diagnostics.camera),
        camera,
        "camera follows traversal",
      );
      const projected = await p.evaluate(() =>
        __battleTanks.renderer.project(40, 50, 0),
      );
      const hull = (await state(p)).hullAngle;
      await p.mouse.move(projected.x, projected.y);
      await p.waitForTimeout(100);
      assert.equal((await state(p)).hullAngle, hull);
      assert.ok(
        Math.abs((await state(p)).turretAngle - hull) > 0.1,
        "turret aim independent",
      );
      await p.keyboard.down(" ");
      await p.waitForTimeout(250);
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
      const info = await p.evaluate(() => {
        const a = __battleTanks,
          r = a.renderer,
          c = r.canvas.getBoundingClientRect();
        return {
          diagnostics: r.diagnostics,
          near: r.project(a.state.x, 90),
          far: r.project(a.state.x, 30),
          canvas: { x: c.x, y: c.y, w: c.width, h: c.height },
          w: innerWidth,
          h: innerHeight,
          sw: document.documentElement.scrollWidth,
          sh: document.documentElement.scrollHeight,
        };
      });
      assert.equal(info.sw, info.w);
      assert.equal(info.sh, info.h);
      assert.equal(info.canvas.w, info.w);
      assert.equal(info.canvas.h, info.h);
      assert.equal(info.diagnostics.type, "PerspectiveCamera");
      assert.ok(info.near.size > info.far.size, "near geometry appears larger");
      assert.equal(info.diagnostics.solidGeometry, 0);
      assert.ok(info.diagnostics.points > 10000);
      info.pixels = await pixels(p);
      assert.ok(info.pixels.litFraction > 0.005, "populated luminous picture");
      assert.ok(
        info.pixels.edgeFraction > 0.08,
        "bright points have crisp contrast",
      );
      assert.ok(
        info.pixels.warm > 10 && info.pixels.cool > 100,
        "warm player and cool scenery",
      );
      assert.ok(info.pixels.litTiles >= 16, "luminous scenery spans picture");
      report.layouts.push(info);
      await picture(p, `active-${viewport.width}x${viewport.height}`);
      await p.close();
    }
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await ready(p);
    await p.locator("#action-begin").click();
    await p.waitForTimeout(500);
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
                diagnostics: __battleTanks.renderer.diagnostics,
              });
            }
          }
          requestAnimationFrame(frame);
        }),
    );
    await picture(p, "normal-desktop");
    report.charge = await p.evaluate(async () => {
      const e = await import("/battle-tanks/engine.js"),
        a = __battleTanks,
        s = a.state;
      for (let i = 0; i < 20; i++) e.update(s, {}, 0.05);
      const stationary = s.charge;
      for (let i = 0; i < 300 && s.charge < 100 && s.phase === "playing"; i++)
        e.update(s, { throttle: 1 }, 0.05);
      const moved = s.charge;
      e.fire(s);
      const shot = s.projectiles.find((v) => v.owner === "player" && v.charged);
      a.step({}, 0);
      return {
        stationary,
        moved,
        charged: Boolean(shot),
        damage: shot?.damage,
        piercing: shot?.piercing,
        remaining: s.charge,
      };
    });
    assert.equal(report.charge.stationary, 0);
    assert.equal(report.charge.moved, 100);
    assert.equal(report.charge.charged, true);
    assert.equal(report.charge.damage, 2);
    assert.equal(report.charge.piercing, 1);
    assert.equal(report.charge.remaining, 0);
    for (let n = 0; n < 3; n++) {
      const reward = await mission(p, true);
      assert.ok(reward.reward?.repair);
      assert.ok(reward.reward.weaponBoost > 0);
      assert.ok(reward.reward.restorations > 0);
      await picture(p, `mission-${n + 1}-relay-reward`);
      const result = await mission(p);
      assert.equal(result.dead, true);
      assert.equal(result.beforeExtraction, "playing");
      assert.equal(result.phase, n === 2 ? "won" : "region-complete");
      assert.equal(
        new Set(result.wrecks.map((v) => v.id)).size,
        result.wrecks.length,
        "destroyed entities reward once",
      );
      report.campaign.push(result);
      await picture(p, `mission-${n + 1}-complete`);
      if (n < 2) {
        await p.locator("#action-begin").click();
        assert.equal((await state(p)).phase, "playing");
      }
    }
    await p.reload();
    await p.waitForFunction(() => window.__battleTanks?.renderer);
    assert.equal((await state(p)).phase, "won");
    await p.close();
  }
  if (process.env.BATTLE_TANKS_DOT_FOCUS) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await ready(p);
    await p.locator("#action-begin").click();
    report.raycast = await p.evaluate(() => {
      const a = __battleTanks,
        r = a.renderer,
        t = { x: a.state.x, y: a.state.y },
        screen = r.project(t.x, t.y, 0),
        ground = r.aim(screen.x, screen.y);
      return { t, screen, ground };
    });
    assert.ok(
      Math.hypot(
        report.raycast.ground.x - report.raycast.t.x,
        report.raycast.ground.y - report.raycast.t.y,
      ) < 0.01,
    );
    await p.waitForTimeout(500);
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
                diagnostics: __battleTanks.renderer.diagnostics,
              });
            }
          }
          requestAnimationFrame(frame);
        }),
    );
    await p
      .locator("#action-scene canvas")
      .screenshot({ path: `${directory}/canvas-motion-before.png` });
    await picture(p, "motion-before");
    await p.keyboard.down("w");
    await p.keyboard.down("d");
    await p.waitForTimeout(800);
    await p.keyboard.up("w");
    await p.keyboard.up("d");
    await p
      .locator("#action-scene canvas")
      .screenshot({ path: `${directory}/canvas-motion-after.png` });
    await picture(p, "motion-after");
    await p.locator("#action-pause").click();
    await p.waitForTimeout(100);
    await p
      .locator("#action-scene canvas")
      .screenshot({ path: `${directory}/canvas-paused-a.png` });
    await p.waitForTimeout(250);
    await p
      .locator("#action-scene canvas")
      .screenshot({ path: `${directory}/canvas-paused-b.png` });
    await p.locator("#action-begin").click();
    await p.locator("#action-sound").click();
    assert.equal(await p.locator("#action-sound").textContent(), "Sound on");
    await p.locator("#action-sound").click();
    const reward = await mission(p, true);
    assert.ok(reward.reward?.repair);
    await p.waitForTimeout(150);
    await picture(p, "focus-relay-reward");
    report.reward = reward.reward;
    report.pixels = await pixels(p);
    report.stress = await p.evaluate(async () => {
      const e = await import("/battle-tanks/engine.js"),
        module = await import("/battle-tanks/dot-render.js");
      const fixture = e.create(2);
      for (const target of [...fixture.enemies, ...fixture.relays]) {
        target.warning = 0.7;
        target.aimX = fixture.x;
        target.aimY = fixture.y;
      }
      fixture.projectiles = Array.from({ length: 40 }, (_, i) => ({
        id: "render-probe-" + i,
        x: 20 + i * 3,
        y: 20 + (i % 5) * 12,
        vx: 25,
        vy: 7,
        owner: i % 2 ? "player" : "enemy",
        life: 2,
        charged: i % 3 === 0,
      }));
      fixture.effects = Array.from({ length: 12 }, (_, i) => ({
        kind: "impact",
        x: 25 + i * 12,
        y: 45,
        life: 0.3,
        r: 4,
      }));
      const parent = document.createElement("div");
      parent.style.cssText = "position:fixed;width:1440px;height:900px";
      document.body.appendChild(parent);
      const r = module.createDepthRenderer(parent, { reducedMotion: true });
      r.resize(1440, 900);
      r.render(fixture, 5);
      const result = { ...r.diagnostics };
      r.dispose();
      parent.remove();
      return result;
    });
    assert.equal(
      report.stress.essentialDroppedPoints,
      0,
      "all critical geometry fits stress fixture",
    );
    await p.close();
    const q = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    await ready(q);
    await q.locator("#action-begin").click();
    const before = await state(q),
      session = await q.context().newCDPSession(q),
      button = await q.locator("[data-move=up]").boundingBox();
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: button.x + button.width / 2, y: button.y + button.height / 2 },
      ],
    });
    await q.waitForTimeout(350);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    assert.ok((await state(q)).x > before.x, "trusted touch drives");
    const shots = (await state(q)).shots,
      b = await q.locator("#action-fire").boundingBox();
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
    });
    await q.waitForTimeout(350);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.ok((await state(q)).shots > shots, "trusted touch fires");
    report.touch = "trusted movement/cancel/fire passed";
    await picture(q, "touch-phone");
    await q.close();
    const comparison = JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          `from PIL import Image
import sys,json
out=[]
for first,second in [(sys.argv[1],sys.argv[2]),(sys.argv[3],sys.argv[4])]:
 a=Image.open(first).convert('RGB');b=Image.open(second).convert('RGB');changed=0;total=0;tiles=set()
 for y in range(0,a.height,4):
  for x in range(0,a.width,4):
   total+=1
   if max(abs(u-v) for u,v in zip(a.getpixel((x,y)),b.getpixel((x,y))))>8:
    changed+=1;tiles.add((x*8//a.width,y*6//a.height))
 out.append({'changedFraction':changed/total,'changedTiles':len(tiles)})
print(json.dumps(out))`,
          `${directory}/canvas-motion-before.png`,
          `${directory}/canvas-motion-after.png`,
          `${directory}/canvas-paused-a.png`,
          `${directory}/canvas-paused-b.png`,
        ],
        { encoding: "utf8" },
      ),
    );
    report.motion = comparison[0];
    report.paused = comparison[1];
    assert.ok(
      report.motion.changedFraction > 0.001 && report.motion.changedTiles >= 12,
      "native traversal changes real picture across tiles",
    );
    assert.equal(
      report.paused.changedFraction,
      0,
      "paused canvas picture freezes",
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/${process.env.BATTLE_TANKS_DOT_FOCUS ? "focus-report" : "report"}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
