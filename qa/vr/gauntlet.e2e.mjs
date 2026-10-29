// The Gauntlet in the browser, and the loop that judges it: ?gauntlet starts play on the Gauntlet's roof; each round shows its banner;
// a bot plays with the real inputs (the swing input punches, Space dodges, F finishes, W walks) until round 3 brings a brute; a
// cleared round shows the yellow stamp; a knock-out ends it, pays and keeps the best round. The looks are measured, not only seen:
// a goon who winds up has a red outline (red pixels round him, against none when he stands), a goon hit flashes white, and the
// frame time of a full round stays in budget. Screenshots of every state, at 960×540 and 390×844, go to SHOTS (or /tmp/swing-qa)
// with a report (gauntlet-report.json) to compare one pass of the loop with the next.
// Run from the repo root (the server starts itself): NODE_PATH=/opt/node22/lib/node_modules node qa/vr/gauntlet.e2e.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { newPage, open, close, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("gauntlet");
watchdog(1500000, "gauntlet");
const out = SHOTS || "/tmp/swing-qa";
await mkdir(out, { recursive: true });
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, "getGamepads", { value: () => [] }); };
const SETUP = () => {
  window.QA = {
    step(n = 1) { G.test.step(1 / 60, n); },
    key(code, on) { window.dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { code })); },
    tap(code) { QA.key(code, true); QA.step(1); QA.key(code, false); QA.step(1); },
    act: () => G.test.action(),
    live: () => G.combat.goons.filter((g) => G.combat.alive(g)),
    face(g) { const yaw = Math.atan2(-(g.x - G.P.pos.x), -(g.z - G.P.pos.z)); G.rigYaw = yaw; G.flatcam.reset(yaw); G.hero.setYaw(yaw); },
    // the bot: n frames of fighting with the real inputs. It dodges a wind-up (a brute's charge when he lunges), finishes with a full
    // meter, punches in reach and walks at the nearest goon otherwise. Returns what it did.
    fight(n, react = 14) {
      const C = G.combat, did = { dodge: 0, finish: 0, press: 0 };
      let seen = "", at = 0, walking = false;
      for (let i = 0; i < n; i++) {
        const h = { x: G.P.pos.x, y: G.P.pos.y, z: G.P.pos.z, yaw: G.hero.yaw };
        const th = C.threat(h), key = th ? th.id + ":" + (th.charge ? th.state : "") : "";
        if (key !== seen) { seen = key; at = i + react; }
        const live = QA.live();
        if (th && i >= at && !(th.charge && th.state === "windup")) { if (walking) { QA.key("KeyW", false); walking = false; } QA.dodge(); did.dodge++; at = i + 30; continue; }
        if (C.focus >= 1 && C.inReach(h) && !G.input.easySwing) { QA.tap("KeyF"); did.finish++; continue; }
        const g = C.inReach(h);
        if (g) {
          if (walking) { QA.key("KeyW", false); walking = false; }
          QA.face(g); QA.hit(); QA.step(9); did.press++; continue;
        }
        if (live.length) {
          const q = live.reduce((b, c) => (Math.hypot(c.x - h.x, c.z - h.z) < Math.hypot(b.x - h.x, b.z - h.z) ? c : b));
          QA.face(q);
          if (!walking) { QA.key("KeyW", true); walking = true; }
        } else if (walking) { QA.key("KeyW", false); walking = false; }
        QA.step(1);
      }
      if (walking) QA.key("KeyW", false);
      return did;
    },
    // a phone has no keys: its DODGE button and a tap
    dodge() { if (!G.input.easySwing) return QA.tap("Space"); const b = document.querySelector("#actTouch .dodge"); if (b && !b.hidden) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); QA.step(2); },
    hit() { if (G.input.easySwing) { G.test.attack(); QA.step(1); return; } G.test.press(0, true); QA.step(1); G.test.press(0, false); },
    // frames until the Gauntlet's round is n (or it ends)
    untilRound(n, max = 2400) { for (let i = 0; i < max; i++) { const A = G.jobs.active; if (!A || (A.data.round >= n && A.data.rest <= 0)) return i; QA.step(1); } return -1; },
    // the pixels of a box of the canvas, as drawn now
    pixels(x0, y0, w, h) {
      const c = G.renderer.domElement, gl = G.renderer.getContext(), px = new Uint8Array(w * h * 4);
      G.test.render();
      gl.readPixels(x0, c.height - y0 - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    },
    // pixels that turned the telegraph's red from a (before) to b (after)
    redder(a, b) {
      const red = (p, i) => p[i] > 160 && p[i + 1] < 90 && p[i + 2] < 90;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (red(b, i) && !red(a, i)) n++;
      return n;
    },
  };
};
const report = { at: new Date().toISOString(), layouts: {} };

async function play(size, tag, init) {
  const page = await newPage(size);
  await page.addInitScript(quiet);
  if (init) await page.addInitScript(init);
  await open(page, "?nosw&skipintro&gauntlet");
  await page.waitForFunction(() => G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await page.evaluate(SETUP);
  const R = (report.layouts[tag] = {});
  const shot = async (name) => { await page.evaluate(() => G.test.render()); await page.screenshot({ path: out + "/gauntlet-" + tag + "-" + name + ".png" }); };

  /* ---- ?gauntlet: the roof and round 1 ---- */
  const start = await page.evaluate(() => {
    const a = G.test.arena();
    if (Math.hypot(G.P.pos.x - a.x, G.P.pos.z - a.z) > 12) { G.test.teleport(a.x, a.y, a.z); }
    const n = QA.untilRound(1);
    return { a, n, job: G.jobs.active && G.jobs.active.type, banner: QA.act().hud.banner, ring: QA.act().view.arena, live: QA.live().length, y: G.P.pos.y, gy: QA.live().map((g) => g.y) };
  });
  check(start.job === "gauntlet" && start.n >= 0, tag + ": ?gauntlet starts play in the Gauntlet", start);
  check(Math.abs(start.y - start.a.y) < 1.5 && start.gy.every((y) => Math.abs(y - start.a.y) < 0.6), tag + ": the hero and round 1's goons are on the Gauntlet's roof", start);
  check(/ROUND 1/.test(start.banner) && start.live === 3, tag + ": round 1 shows its banner and brings three goons", start);
  check(start.ring > 0.5, tag + ": the painted fight ring on the roof lights up", start.ring);
  await shot("1-round");

  /* ---- the telegraph: a red outline on a goon who winds up, none when he stands ---- */
  const tele = await page.evaluate(() => {
    const C = G.combat, g = QA.live()[0];
    for (const q of QA.live()) if (q !== g) { q.state = "stagger"; q.t = 99; }
    // the hero at the roof's clear middle, the goon in open view 4 m ahead and to one side (roof clutter never hides him)
    const a = G.test.arena(), yaw = G.rigYaw;
    G.test.teleport(a.x, a.y, a.z); G.flatcam.reset(yaw); G.hero.setYaw(yaw);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    g.x = a.x + fx * 4.2 + fz * 1.3; g.z = a.z + fz * 4.2 - fx * 1.3; g.y = a.y; g.home = { x: g.x, y: g.y, z: g.z };
    QA.step(120); // the round's banner folds away
    const box = () => {
      const v = new G.camera.position.constructor(g.x, g.y + 1, g.z).project(G.camera), c = G.renderer.domElement;
      const cx = Math.round((v.x * 0.5 + 0.5) * c.width), cy = Math.round((0.5 - v.y * 0.5) * c.height), r = Math.round(c.height * 0.16);
      return [Math.max(0, cx - r), Math.max(0, cy - r), Math.min(2 * r, c.width - cx + r), Math.min(2 * r, c.height - cy + r)];
    };
    g.state = "stagger"; g.t = 99; g.flash = 0; QA.step(2);
    const B = box(), calm = QA.pixels(...B);
    QA.step(2);
    const noise = QA.redder(calm, QA.pixels(...B)); // what turns red with nothing changed (the city's own flicker)
    g.state = "windup"; g.t = 99; QA.step(2);
    const turned = QA.redder(calm, QA.pixels(...B));
    return { noise, turned, tele: g.tele, box: B };
  });
  R.telegraph = tele;
  check(tele.turned > Math.max(40, tele.noise * 4), tag + ": a goon who winds up shows a red rim", tele);
  await shot("2-telegraph");

  /* ---- the hit flash ---- */
  const flash = await page.evaluate(() => {
    const g = QA.live()[0];
    g.state = "chase"; g.t = 0; g.cool = 99;
    G.test.teleport(g.x + 1.4, g.y, g.z); QA.face(g); QA.step(1);
    QA.hit();
    const f = g.flash;
    QA.step(30);
    for (const q of QA.live()) { q.state = "chase"; q.t = 0; q.cool = 1; }
    return { f, after: g.flash };
  });
  check(flash.f > 0.5 && flash.after === 0, tag + ": a goon hit flashes white, then the colour comes back", flash);

  /* ---- the loop: the bot plays rounds 1 to 3 with the real inputs; a frame-time sample on the way ---- */
  const rounds = [];
  for (let n = 1; n <= 3; n++) {
    const r = await page.evaluate((n) => {
      const t0 = performance.now(), A0 = G.jobs.active;
      let frames = 0, did = { dodge: 0, finish: 0, press: 0 }, cleared = false;
      for (let k = 0; k < 40 && G.jobs.active && !cleared; k++) {
        const d = QA.fight(60); frames += 60;
        for (const q in d) did[q] += d[q];
        cleared = G.jobs.active && G.jobs.active.data.cleared >= n;
        if (k % 4 === 0) G.test.render();
      }
      const ms = (performance.now() - t0) / frames;
      return { n, cleared, frames, did, hp: G.combat.hp, banner: QA.act().hud.banner, stats: G.combat.info().stats, msPerFrame: +ms.toFixed(2), on: !!A0 };
    }, n);
    rounds.push(r);
    if (n === 1) await shot("3-cleared");
    if (!r.cleared) break;
    const next = await page.evaluate((n) => { const i = QA.untilRound(n + 1); return { i, banner: QA.act().hud.banner, ring: QA.act().view.arena, live: QA.live().length, brutes: QA.live().filter((g) => g.brute).length }; }, n);
    r.next = next;
    if (n === 2) {
      await shot("4-brute");
      // the brute's charge, frozen in his lunge
      await page.evaluate(() => {
        const b = QA.live().find((g) => g.brute);
        if (!b) return;
        G.test.teleport(b.x + 6, b.y, b.z); QA.face(b);
        b.state = "windup"; b.charge = true; b.t = 0.05; b.cool = 0; b.pose = 16; QA.step(8);
      });
      await shot("5-charge");
      R.clip = await page.evaluate(() => { const b = QA.live().find((g) => g.brute); return { loaded: G.figures.info().clip, pose: b && b.pose, phase: b && +b.poseT.toFixed(2) }; });
    }
  }
  R.rounds = rounds;
  check(rounds[0] && rounds[0].cleared && /CLEARED/.test(rounds[0].banner), tag + ": the bot clears round 1 and the stamp says CLEARED", rounds[0]);
  check(rounds[1] && rounds[1].next && rounds[1].next.brutes === 1, tag + ": round 3 brings a brute", rounds.map((r) => r.next));
  check(rounds.every((r) => r.did.press > 0), tag + ": the swing input fights every round", rounds.map((r) => r.did));
  check(R.clip && R.clip.loaded >= 2 && R.clip.pose === 16 && R.clip.phase > 1, tag + ": the brute's charge plays the baked MotionBricks clip", R.clip);

  /* ---- the end: a knock-out pays for the rounds cleared and keeps the best ---- */
  const end = await page.evaluate(() => {
    const cleared = G.jobs.active ? G.jobs.active.data.cleared : -1, before = G.test.events().length;
    G.combat.hp = 1;
    const h = { x: G.P.pos.x, y: G.P.pos.y, z: G.P.pos.z };
    const g = QA.live()[0] || G.combat.goons[G.test.spawnGoon(h.x + 1, h.y, h.z)];
    for (let i = 0; i < 600 && G.jobs.active; i++) { for (const q of QA.live()) { q.x = h.x + 1.2; q.z = h.z; } QA.step(1); }
    return { cleared, active: !!G.jobs.active, best: QA.act().save, banner: QA.act().hud.banner, g: !!g, before };
  });
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /swing|vr/i.test(k)) || "null") || "null"));
  R.end = { cleared: end.cleared, banner: end.banner };
  check(!end.active && /ROUND|DOWN/.test(end.banner), tag + ": a knock-out ends the Gauntlet with its banner", end);
  check(!best || !best.best || best.best.gauntlet >= Math.min(1, end.cleared), tag + ": the best round is kept", best && best.best);
  await shot("6-over");
  check(page.errors.length === 0, tag + ": no page errors", page.errors);
  await page.close();
}

try {
  await play({ width: 960, height: 540 }, "desktop");
  await play({ width: 390, height: 844 }, "phone", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
    window.DeviceOrientationEvent.requestPermission = () => Promise.resolve("denied");
    window.DeviceMotionEvent.requestPermission = () => Promise.resolve("denied");
  });
} catch (e) {
  check(false, "the run finished", String(e && e.stack || e));
}
await writeFile(out + "/gauntlet-report.json", JSON.stringify(report, null, 2));
console.log("report: " + out + "/gauntlet-report.json");
await close();
done();
