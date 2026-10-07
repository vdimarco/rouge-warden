// The second set of Spider-Man moves in flat play, in the browser: Space held in the air glides; a fast jump at a wall with W held
// runs up it and Space leaps off; G throws a lid at a goon; a rope pull drags a group into a heap; crimes start near the hero
// (a getaway car stopped by a rope, a tanker's leak sealed by three ropes); the music adds its fight layer; a phone shows GLIDE
// and THROW. Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/spider-world.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("spider-world");
watchdog(900000, "spider-world");
const out = SHOTS || "/tmp/swing-qa";
await mkdir(out, { recursive: true });
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, "getGamepads", { value: () => [] }); };
const SETUP = () => {
  window.QA = {
    step(n = 1) { G.test.step(1 / 60, n); },
    key(code, on) { window.dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { code })); },
    tap(code) { QA.key(code, true); QA.step(1); QA.key(code, false); QA.step(1); },
    street() { G.test.teleport(-150, 0, 14); G.rigYaw = Math.PI / 2; G.desktop.level(0); G.flatcam.reset(Math.PI / 2); QA.step(5); },
    clear() { G.jobs.cancel(); for (const g of G.combat.goons) g.on = false; G.combat.update(0, null); G.combat.focus = 0; G.combat.hits = 0; G.combat.heal(); },
  };
};
async function boot(page) {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await page.evaluate(SETUP);
}

try {
  const page = await newPage({ width: 960, height: 540 });
  await page.addInitScript(quiet);
  await boot(page);

  /* ---- glide ---- */
  const glide = await page.evaluate(() => {
    QA.clear();
    const S = G.city.start;
    G.test.teleport(S.x, S.y + 60, S.z); G.P.vel.y = -14; G.P.onGround = false;
    QA.key("Space", true); QA.step(90);
    const a = { vy: G.P.vel.y, hs: Math.hypot(G.P.vel.x, G.P.vel.z), gliding: G.P.gliding, pose: G.hero.info().pose };
    QA.key("Space", false); QA.step(30);
    return { a, after: { gliding: G.P.gliding, vy: G.P.vel.y } };
  });
  check(glide.a.gliding && glide.a.vy > -5 && glide.a.hs >= 13.9, "Space held in the air glides: " + glide.a.vy.toFixed(1) + " m/s down, " + glide.a.hs.toFixed(1) + " m/s along", glide);
  check(glide.a.pose === "glide", "the hero spreads out in the glide pose", glide.a.pose);
  check(!glide.after.gliding && glide.after.vy < glide.a.vy, "letting go of Space ends the glide", glide.after);

  /* ---- wall run and leap ---- */
  const wr = await page.evaluate(() => {
    QA.clear();
    // a street face of a building: from the avenue centre, along -z to the first wall
    const C = G.city, x = -150, z0 = 14;
    let wz = null;
    for (let d = 0; d < 30; d += 0.25) if (C.collideSphere(x, 5, z0 - d, 0.1)) { wz = z0 - d; break; }
    if (wz == null) return { wall: null };
    G.test.teleport(x, 4, wz + 5); G.rigYaw = 0; G.desktop.level(0); G.flatcam.reset(0);
    G.P.vel.x = 0; G.P.vel.y = 2; G.P.vel.z = -16; G.P.onGround = false;
    const e0 = G.test.events().length;
    QA.key("KeyW", true); QA.step(20);
    const ev = G.test.events().slice(e0).map((e) => e.type);
    const y0 = G.P.pos.y; QA.step(20); const rate = (G.P.pos.y - y0) / (20 / 60);
    const running = !!G.P.wallRun;
    QA.key("KeyW", false);
    QA.tap("Space");
    const leap = G.P.vel.y;
    QA.step(30);
    return { wall: wz, ev, rate, running, leap };
  });
  check(wr.wall != null && wr.ev.includes("wallrun"), "W held and a fast jump at a wall: a wall run", wr);
  check(wr.rate > 8, "the run climbs fast: " + (wr.rate || 0).toFixed(1) + " m/s", wr);
  check(wr.leap > 7, "Space off the run leaps " + (wr.leap || 0).toFixed(1) + " m/s up", wr);

  /* ---- throw and group pull ---- */
  const thr = await page.evaluate(() => {
    QA.clear(); QA.street();
    const id = G.test.spawnGoon(-158, 0, 14, true);
    G.combat.goons.find((g) => g.id === id).hp = 5;
    QA.step(2);
    const prompt = G.test.action().hud.prompt;
    QA.tap("KeyG"); QA.step(40);
    const a = G.test.action(), g = a.combat.list.find((q) => q.id === id);
    return { prompt, throws: a.combat.stats.throws, hp: g && g.hp };
  });
  check(/THROW/.test(thr.prompt), "a goon in range: the prompt says G THROW", thr.prompt);
  check(thr.throws === 1 && thr.hp <= 3, "G throws a lid, and it hits him", thr);
  const heap = await page.evaluate(() => {
    QA.clear(); QA.street();
    const ids = [G.test.spawnGoon(-168, 0, 14, true), G.test.spawnGoon(-169, 0, 15.2, true), G.test.spawnGoon(-168.5, 0, 12.6, true)];
    QA.step(3);
    const g = G.test.action().combat.list.find((q) => q.id === ids[0]);
    G.test.aimAt(1, g.x, g.y + 1.1, g.z); G.test.press(1, true); QA.step(40); G.test.press(1, false); G.test.aimAt(1, null); QA.step(30);
    return { heaps: G.test.action().combat.stats.heaps };
  });
  check(heap.heaps >= 1, "a rope on a goon in a group pulls them into a heap", heap);

  /* ---- crimes: a getaway car, then a tanker ---- */
  const gw = await page.evaluate(() => {
    QA.clear(); QA.street();
    G.test.jobOffers(true); QA.step(2); // (as after Mission 1: offers and crimes are on)
    const h = { x: G.P.pos.x, y: G.P.pos.y, z: G.P.pos.z };
    const o = G.jobs.crime("getaway", h, G.time);
    QA.step(2);
    const marker = G.test.action().view.markers;
    G.test.teleport(o.x + 10, 8, o.z); G.P.vel.x = G.P.vel.y = G.P.vel.z = 0;
    QA.step(3);
    const started = G.jobs.active && G.jobs.active.type;
    QA.step(60);
    const car = G.jobs.active.data.car;
    // land on the street beside the car and rope it
    G.test.teleport(car.x + 8, 0, car.z + 8); QA.step(5);
    G.test.aimAt(0, car.x, 1.3, car.z); G.test.press(0, true); QA.step(30); G.test.press(0, false); G.test.aimAt(0, null);
    const stopped = G.jobs.active && G.jobs.active.data.stopped;
    QA.step(240);
    const crew = G.combat.group("job").length;
    return { o: !!o, marker, started, stopped, speed: car.speed, crew };
  });
  check(gw.o && gw.marker > 0, "a crime puts a marker near the hero", gw);
  check(gw.started === "getaway", "swinging close takes it", gw.started);
  check(gw.stopped && Math.abs(gw.speed) < 0.5, "a rope on the getaway car stops it", gw);
  check(gw.crew === 2, "the crew jumps out", gw.crew);
  await page.evaluate(() => G.test.render());
  await page.screenshot({ path: out + "/world-getaway.png" });
  const tk = await page.evaluate(() => {
    QA.clear(); QA.street();
    G.jobs.start("tanker", null, { x: G.P.pos.x, y: 0, z: G.P.pos.z });
    const leak = G.jobs.active.data.leak, C = G.city;
    // a spot 7 m off on the street with a clear line to the leak
    let spot = null;
    for (let k = 0; k < 16 && !spot; k++) {
      const a = (k / 16) * Math.PI * 2, x = leak.x + Math.cos(a) * 7, z = leak.z + Math.sin(a) * 7;
      let ok = !C.isWater(x, z) && C.groundY(x, z) < 0.3;
      for (let f = 0; f <= 1 && ok; f += 0.1) if (C.collideSphere(x + (leak.x - x) * f, 1.4, z + (leak.z - z) * f, 0.3)) ok = false;
      if (ok) spot = { x, z };
    }
    if (!spot) return { seals: -1, done: 0 };
    G.test.teleport(spot.x, 0, spot.z);
    for (const g of G.combat.group("job")) g.on = false; // (the crew is another check's job)
    G.combat.update(0, null);
    QA.step(5);
    for (let k = 0; k < 3; k++) { G.test.aimAt(0, leak.x, leak.y, leak.z); G.test.press(0, true); QA.step(30); G.test.press(0, false); G.test.aimAt(0, null); QA.step(20); }
    const seals = G.jobs.active ? G.jobs.active.data.seals : 3;
    const dbg = { tg: G.test.action().ropeTargets, active: G.jobs.active && G.jobs.active.type, ev: G.test.events().slice(-12).map((e) => e.type + (e.target ? ":" + e.target.tag : "")) };
    QA.step(5);
    return { seals, done: G.jobs.info().done.tanker || 0, dbg };
  });
  check(tk.seals === 3 || tk.done === 1, "three ropes seal the tanker's leak", tk);
  check(tk.done === 1, "with the crew gone, the tanker job is done", tk);

  /* ---- the music's fight layer ---- */
  const mus = await page.evaluate(() => {
    QA.clear(); QA.street();
    G.test.spawnGoon(-152, 0, 14, true); QA.step(10);
    const on = G.audio ? G.audio.fightOn : null;
    QA.clear(); QA.step(10);
    return { on, off: G.audio ? G.audio.fightOn : null };
  });
  check(mus.on === true && mus.off === false, "the music adds its fight layer while goons fight, and drops it after", mus);

  check(page.errors.length === 0, "no page errors", page.errors);
  await page.context().close();
} catch (e) { check(false, "the spider-world check threw", e.stack || String(e)); }

/* ---- a phone: GLIDE and THROW ---- */
try {
  const page = await newPage({ width: 390, height: 844 });
  await page.addInitScript(quiet);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
    window.DeviceOrientationEvent.requestPermission = () => Promise.resolve("denied");
    window.DeviceMotionEvent.requestPermission = () => Promise.resolve("denied");
  });
  await boot(page);
  const a = await page.evaluate(() => {
    QA.clear();
    const S = G.city.start;
    G.test.teleport(S.x, S.y + 60, S.z); G.P.vel.y = -14; G.P.onGround = false; QA.step(3);
    return { phone: !!G.input.easySwing, glide: G.test.action().hud.glide };
  });
  await page.locator("#actTouch .glide").dispatchEvent("pointerdown");
  const b = await page.evaluate(() => { QA.step(60); return { gliding: G.P.gliding, vy: G.P.vel.y }; });
  await page.locator("#actTouch .glide").dispatchEvent("pointerup");
  const c = await page.evaluate(() => {
    QA.clear(); QA.street();
    G.test.spawnGoon(-158, 0, 14, true); QA.step(3);
    return { throwBtn: G.test.action().hud.throw };
  });
  await page.locator("#actTouch .throw").dispatchEvent("pointerdown");
  const d = await page.evaluate(() => { QA.step(40); return { throws: G.test.action().combat.stats.throws }; });
  check(a.phone && a.glide, "a phone shows GLIDE in the air", a);
  check(b.gliding && b.vy > -5, "holding GLIDE glides", b);
  check(c.throwBtn && d.throws === 1, "a phone shows THROW near a goon, and a tap throws", { c, d });
  check(page.errors.length === 0, "no page errors on the phone", page.errors);
  await page.context().close();
} catch (e) { check(false, "the phone check threw", e.stack || String(e)); }

await close();
done();
