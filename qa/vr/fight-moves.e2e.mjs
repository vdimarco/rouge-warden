// The Spider-Man moves of flat play, in the browser: a let-go on the GO cue boosts and flips the hero; a goon's wind-up shows a
// red mark and a DODGE prompt, and Space dodges the blow; from a roof, a rope on an unaware guard below takes him down quietly;
// blows fill the focus meter, and F with a full meter finishes the goons in reach. Run from the repo root (the server starts
// itself): NODE_PATH=/opt/node22/lib/node_modules node qa/vr/fight-moves.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("fight-moves");
watchdog(900000, "fight-moves");
const out = SHOTS || "/tmp/swing-qa";
await mkdir(out, { recursive: true });
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, "getGamepads", { value: () => [] }); };
const SETUP = () => {
  window.QA = {
    step(n = 1) { G.test.step(1 / 60, n); },
    key(code, on) { window.dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { code })); },
    tap(code) { QA.key(code, true); QA.step(1); QA.key(code, false); QA.step(1); },
    street() { G.test.teleport(-150, 0, 2); G.rigYaw = Math.PI / 2; G.desktop.level(0); G.flatcam.reset(Math.PI / 2); QA.step(5); },
    clear() { for (const g of G.combat.goons) g.on = false; G.combat.update(0, null); G.combat.focus = 0; G.combat.hits = 0; G.combat.heal(); },
  };
};

try {
  const page = await newPage({ width: 960, height: 540 });
  await page.addInitScript(quiet);
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await page.evaluate(SETUP);

  /* ---- the release boost (a real mouse button: a test hook earns no boost, as it earns no kick) ---- */
  await page.mouse.move(480, 270);
  const boost = [];
  for (const dyaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    // 30 m over the start roof, a rope on a tower ahead: swing, and let go when the cue shows
    await page.evaluate((dyaw) => {
      QA.clear();
      const S = G.city.start, yaw = S.yaw + dyaw;
      G.test.teleport(S.x, S.y + 30, S.z); G.rigYaw = yaw; G.desktop.level(0); G.flatcam.reset(yaw);
      G.P.vel.x = -Math.sin(yaw) * 6; G.P.vel.z = -Math.cos(yaw) * 6; G.P.vel.y = -5; G.P.onGround = false;
      QA.step(40);
    }, dyaw);
    await page.mouse.down();
    const at = await page.evaluate(() => {
      let cue = false, n = 0;
      for (; n < 400 && !cue && !G.P.onGround; n++) { QA.step(1); cue = G.test.action().cueAir[0]; }
      return { cue, n, v0: { ...G.P.vel }, before: G.test.events().length };
    });
    await page.mouse.up();
    const t = await page.evaluate((at) => {
      QA.step(2);
      const b = G.test.events().slice(at.before).find((e) => e.type === "boost"), v1 = { ...G.P.vel };
      QA.step(6);
      return { cue: at.cue, n: at.n, b: !!b, vy0: at.v0.y, vy1: v1.y, hs0: Math.hypot(at.v0.x, at.v0.z), hs1: Math.hypot(v1.x, v1.z), pose: G.test.action().hero };
    }, at);
    boost.push(t);
    if (t.b) break;
  }
  const bt = boost[boost.length - 1];
  check(bt.cue && bt.b, "a let-go while the GO cue shows boosts the hero", boost);
  check(bt.b && bt.vy1 >= Math.max(bt.vy0, 0) + 3 && bt.hs1 > bt.hs0 + 3, "the boost adds speed forward and up", bt);
  check(bt.pose === "flip", "the hero flips", bt.pose);
  const noBoost = await page.evaluate(() => {
    // a let-go well before the cue: no boost
    const S = G.city.start;
    G.test.teleport(S.x, S.y + 30, S.z); G.rigYaw = S.yaw; G.desktop.level(0); G.flatcam.reset(S.yaw);
    G.P.vel.x = 0; G.P.vel.y = -5; G.P.vel.z = 0; G.P.onGround = false;
    QA.step(2);
    G.test.press(0, true); QA.step(8);
    const cue = G.test.action().cueAir[0], before = G.test.events().length;
    G.test.press(0, false); QA.step(2);
    return { cue, boost: G.test.events().slice(before).some((e) => e.type === "boost") };
  });
  check(noBoost.cue || !noBoost.boost, "a let-go outside the cue gives no boost", noBoost);

  /* ---- the warning and the dodge ---- */
  const dodge = await page.evaluate(() => {
    QA.clear(); QA.street();
    const id = G.test.spawnGoon(-151.6, 0, 2, true);
    let warned = null;
    for (let i = 0; i < 200; i++) {
      QA.step(1);
      const a = G.test.action(), g = a.combat.list.find((q) => q.id === id);
      if (g && g.state === "windup") { warned = { warn: a.hud.warn, prompt: a.hud.prompt }; break; }
    }
    G.test.render();
    const hp0 = G.test.action().combat.hp, p0 = { ...G.test.state().pos };
    QA.tap("Space");
    QA.step(40);
    const a = G.test.action(), p1 = G.test.state().pos;
    return { warned, hp0, hp1: a.combat.hp, moved: Math.hypot(p1.x - p0.x, p1.z - p0.z), stats: a.combat.stats, focus: a.combat.focus };
  });
  check(dodge.warned && dodge.warned.warn, "a wind-up shows the red warning mark", dodge.warned);
  check(dodge.warned && /DODGE/.test(dodge.warned.prompt), "the prompt line says SPACE DODGE", dodge.warned);
  check(dodge.stats.dodges === 1 && dodge.hp1 === dodge.hp0, "Space dodges: the blow misses", dodge);
  check(dodge.moved > 1.5, "the dodge moves the hero clear: " + dodge.moved.toFixed(2) + " m", dodge);
  check(dodge.focus > 0, "a dodge fills the focus meter", dodge.focus);

  /* ---- the perch takedown ---- */
  const td = await page.evaluate(() => {
    QA.clear();
    // a roof edge 8..40 m up, beside the Market avenue (its centre line is z = 14)
    const C = G.city, S = { x: -150, z: 14 };
    let roof = null;
    for (let d = 0; d < 24 && !roof; d += 0.25) for (const [ux, uz] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
      const x = S.x + ux * d, z = S.z + uz * d, ty = C.topBelow(x, 200, z, 0)?.y ?? -1; // (topBelow reuses its result object)
      const below = C.topBelow(x - ux * 0.5, 200, z - uz * 0.5, 0) ?.y ?? 0;
      if (ty > 8 && ty < 40 && below < ty - 3) { roof = { x: x + ux * 0.4, y: ty, z: z + uz * 0.4, ux, uz }; break; }
    }
    if (!roof) return { roof: null };
    G.test.teleport(roof.x, roof.y + 0.05, roof.z);
    const yaw = Math.atan2(roof.ux, roof.uz); // facing the street (−ux, −uz)
    G.rigYaw = yaw; G.desktop.level(-0.5); G.flatcam.reset(yaw);
    QA.step(20);
    const gx = roof.x - roof.ux * 14, gz = roof.z - roof.uz * 14;
    const id = G.test.spawnGoon(gx, 0, gz, false), id2 = G.test.spawnGoon(gx - roof.uz * 8, 0, gz + roof.ux * 8, false); // (8 m off: seen from far above, two guards close together are one aim)
    QA.step(10);
    const a0 = G.test.action(), g0 = a0.combat.list.find((q) => q.id === id);
    const target = a0.ropeTargets.includes("goon:" + id);
    const e0 = G.test.events().length;
    G.test.aimAt(0, g0.x, g0.y + 1.1, g0.z); G.test.press(0, true); QA.step(30); G.test.press(0, false); G.test.aimAt(0, null); QA.step(40);
    const ev = G.test.events().slice(e0).map((e) => e.type + (e.target ? ":" + e.target.tag : ""));
    const a = G.test.action(), g = a.combat.list.find((q) => q.id === id), o = a.combat.list.find((q) => q.id === id2);
    return { roof, onGround: G.P.onGround, target, g, o, stats: a.combat.stats, ev };
  });
  check(!!td.roof, "found a roof over the street", td.roof);
  check(td.target, "from the roof, the unaware guard below is a rope target", td);
  check(td.stats.takedowns === 1 && td.g && td.g.state === "hung" && td.g.y > 2, "the rope takes him down: he hangs upside down", td);
  check(td.o && !td.o.aggro, "the guard beside him does not notice", td.o);
  await page.evaluate(() => { QA.step(1); G.test.render(); });
  await page.screenshot({ path: out + "/fight-takedown.png" });

  /* ---- the focus meter and the finisher ---- */
  const fin = await page.evaluate(() => {
    QA.clear(); QA.street();
    const ids = [G.test.spawnGoon(-151.4, 0, 2, true), G.test.spawnGoon(-151.4, 0, 3.2, true)];
    for (const g of G.combat.goons) g.hp = 20;
    QA.step(2);
    for (let i = 0; i < 4; i++) { G.test.press(0, true); QA.step(2); G.test.press(0, false); QA.step(16); }
    const mid = G.test.action();
    G.combat.focus = 1;
    G.combat.goons.forEach((g, k) => { g.x = -151.4; g.z = k ? 3.2 : 2; g.y = 0; g.state = "idle"; g.cool = 9; });
    QA.step(1);
    const prompt = G.test.action().hud.prompt;
    QA.tap("KeyF");
    const a = G.test.action();
    return { combo: mid.hud.combo, focusMid: mid.combat.focus, focusHud: mid.hud.focus, prompt, finishers: a.combat.stats.finishers, slowT: a.slowT, focus: a.combat.focus,
      states: a.combat.list.filter((q) => ids.includes(q.id)).map((q) => q.state), ropes: G.test.state().ropes.map((r) => r.state) };
  });
  check(fin.combo >= 2, "the combo count shows (" + fin.combo + " HITS)", fin);
  check(fin.focusMid > 0 && fin.focusHud > 0, "blows fill the focus meter", fin);
  check(/FINISH/.test(fin.prompt), "a full meter in reach says F FINISH", fin.prompt);
  check(fin.finishers === 1 && fin.states.every((s) => s === "down" || s === "out") && fin.focus === 0, "F finishes both goons and empties the meter", fin);
  check(fin.slowT > 0 && fin.ropes.every((s) => s === "idle"), "the finisher slows the world, and F fired no yank", fin);
  await page.evaluate(() => { G.test.render(); });
  await page.screenshot({ path: out + "/fight-finisher.png" });

  check(page.errors.length === 0, "no page errors", page.errors);
  await page.context().close();
} catch (e) { check(false, "the fight-moves check threw", e.stack || String(e)); }

/* ---- a phone: the DODGE button ---- */
try {
  const page = await newPage({ width: 390, height: 844 });
  await page.addInitScript(quiet);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
    window.DeviceOrientationEvent.requestPermission = () => Promise.resolve("denied");
    window.DeviceMotionEvent.requestPermission = () => Promise.resolve("denied");
  });
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await page.evaluate(SETUP);
  const before = await page.evaluate(() => {
    QA.clear(); QA.street();
    const quietHud = G.test.action().hud.dodge;
    G.test.spawnGoon(-151.6, 0, 2, true);
    for (let i = 0; i < 200 && !G.test.action().hud.warn; i++) QA.step(1);
    G.test.render();
    return { phone: !!G.input.easySwing, quietHud, hud: G.test.action().hud };
  });
  await page.screenshot({ path: out + "/fight-phone-dodge.png" });
  await page.locator("#actTouch .dodge").dispatchEvent("pointerdown");
  const after = await page.evaluate(() => { QA.step(40); const a = G.test.action(); return { dodges: a.combat.stats.dodges, hp: a.combat.hp }; });
  check(before.phone, "the page plays as a phone", before.phone);
  check(!before.quietHud && before.hud.dodge && before.hud.warn, "the DODGE button shows only while a goon winds up", before);
  check(before.hud.prompt === "", "a phone shows no keyboard prompt for the dodge", before.hud.prompt);
  check(after.dodges === 1 && after.hp === 5, "a tap on DODGE dodges the blow", after);
  check(page.errors.length === 0, "no page errors on the phone", page.errors);
  await page.context().close();
} catch (e) { check(false, "the phone dodge check threw", e.stack || String(e)); }

await close();
done();
