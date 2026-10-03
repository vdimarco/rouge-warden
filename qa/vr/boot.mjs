// Checks that In Full Swing boots: the lib patch, a clean desktop load, the title, the city build under the loading bar,
// flat play from PLAY ON THIS SCREEN, G.test.step, a drawn frame, and the PWA launch straight into a session.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/boot.mjs
import { readFile } from "fs/promises";
import path from "path";
import { PUB, checker, watchdog, newPage, open, close, state, waitFor, waitState, enterXR, shot } from "./lib.mjs";

const { check, done } = checker("boot");
watchdog(12 * 60 * 1000, "boot");

/* ---------------- the vendored lib ---------------- */
const lib = await readFile(path.join(PUB, "vr/lib/three.module.min.js"), "utf8");
check(lib.includes("Ce.runDeferredUploads(),t.isArrayCamera"), "the lib carries the deferred-upload patch (lib/PATCHES.md)");
const html = await readFile(path.join(PUB, "vr/index.html"), "utf8");
check(!/cdn\.jsdelivr\.net\/npm\/three/.test(html) && /"three":\s*"\.\/lib\/three\.module\.min\.js"/.test(html), "the import map loads three from ./lib, never from a CDN");

/* ---------------- desktop: load, title, city ---------------- */
try {
  const page = await newPage({ width: 640, height: 360 });
  const t0 = Date.now();
  await open(page, "");
  check(page.errors.length === 0, "the page loads with no errors (" + (Date.now() - t0) + " ms to G.ready)", page.errors);
  const t = await page.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return !e.closest("[hidden]") && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; };
    return {
      title: vis("#title"), h1: document.querySelector("#title h1").textContent.replace(/\s+/g, " ").trim(), kicker: document.querySelector(".kicker").textContent.trim(),
      flat: vis("#playFlat"), how: vis("#howBtn"), comfort: vis("#comfortBtn"), sw: vis("[data-switch]"), canvas: !!document.querySelector("#view canvas"),
      mode: G.mode, state: G.state, version: G.version, three: !!G.renderer && G.renderer.xr.enabled,
    };
  });
  check(t.title && t.h1 === "IN FULL SWING" && t.kicker === "A Cottage Arcade machine for phone & Quest", "the title shows the logo and the kicker", t);
  check(t.flat && t.how && t.comfort && t.sw && t.canvas, "PLAY ON THIS SCREEN, HOW TO PLAY, COMFORT and SWITCH GAME show over the live canvas", t);
  check(t.mode === "title" && t.state === "title", "G starts in the title state", t);

  // how to play and comfort open as dialogs; the comfort preset is saved
  await page.click("#howBtn");
  const howOpen = await page.evaluate(() => document.querySelector("#how").open && /pinch/i.test(document.querySelector("#how").textContent) && /Shift/.test(document.querySelector("#how").textContent));
  await page.click("#how [data-close]");
  check(howOpen && !(await page.evaluate(() => document.querySelector("#how").open)), "HOW TO PLAY opens (controllers, hands, keyboard) and closes");
  await page.click("#comfortBtn");
  await page.click("label.preset:has(input[value=intense])");
  const saved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("plungerd.vr.v1")); } catch (e) { return null; } });
  await page.click("label.preset:has(input[value=moderate])");
  await page.click("#comfort [data-close]");
  check(saved && saved.settings && saved.settings.preset === "intense" && saved.settings.turn === "smooth", "COMFORT saves the chosen preset in settings", saved && saved.settings);

  // the city builds under the loading bar
  await waitFor(page, () => document.querySelector("#load").getAttribute("aria-valuenow") === "100" && G.viewDone, null, 180000);
  check(true, "the city builds and the loading bar reaches 100 %");

  // the attract camera moves while the title shows
  const c0 = await page.evaluate(() => G.camera.position.toArray());
  await page.waitForTimeout(600);
  const c1 = await page.evaluate(() => G.camera.position.toArray());
  check(Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]) > 0.01, "the attract camera flies over the city behind the title");
  await shot(page, "boot-title");

  /* ---------------- flat play ---------------- */
  await enterXR(page, "desktop");
  await page.evaluate(() => G.test.skipIntro());
  const s = await waitState(page, { mode: "desktop", state: "play" }, 60000);
  const hidden = await page.evaluate(() => document.querySelector("#title").hidden);
  const S = await page.evaluate(() => G.city.start);
  check(hidden && s.onGround && Math.hypot(s.pos.x - S.x, s.pos.z - S.z) < 1 && Math.abs(s.pos.y - S.y) < 0.01, "PLAY ON THIS SCREEN starts play on the start roof and hides the title", s);
  check(Math.abs(s.head.y - (S.y + 1.65)) < 0.01 && Math.abs(s.rig.yaw - S.yaw) < 0.01, "the flat camera stands at 1.65 m and faces the Needle", { head: s.head, yaw: s.rig.yaw, want: S.yaw });

  // losing the pointer lock pauses; a click on the city goes back to play
  const lk = await page.evaluate(() => G.desktop.locked);
  if (lk) {
    await page.evaluate(() => document.exitPointerLock());
    const pz = await waitState(page, { state: "paused" }, 20000).catch(() => state(page));
    await page.mouse.click(320, 200);
    const back = await waitState(page, { state: "play" }, 20000).catch(() => state(page));
    check(pz.state === "paused" && back.state === "play" && (await page.evaluate(() => G.desktop.locked)), "losing the pointer lock pauses flat play, and a click goes back to play", { paused: pz.state, back: back.state });
  } else console.log("INFO: no pointer lock in this browser: the lock and pause check is skipped");

  // G.test.step owns time while the loop is held
  const st = await page.evaluate(() => { G.test.hold(true); const a = G.test.state(); const b = G.test.step(1 / 60, 30); return { a, b }; });
  const dt = st.b.time - st.a.time, df = st.b.frame - st.a.frame;
  check(Math.abs(dt - 0.5) < 1e-6 && df === 30, "G.test.step(1/60, 30) moves time by 0.5 s and 30 frames", { dt, df });
  const still = await page.evaluate(async () => { const f = G.frame; await new Promise((r) => setTimeout(r, 300)); return G.frame - f; });
  check(still === 0, "G.test.hold(true) stops the loop's logic", { frames: still });
  // walking forward with W moves the body; the step is deterministic
  const walk = await page.evaluate(() => { const a = G.test.state().pos; window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" })); G.test.step(1 / 60, 30); window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" })); G.test.step(1 / 60, 30); return { a, b: G.test.state().pos }; });
  check(Math.hypot(walk.b.x - walk.a.x, walk.b.z - walk.a.z) > 0.8, "W walks the body along the roof in flat play", walk);

  // the G.test hooks in flat play: aim and fire a rope with aimAt + press, then let go
  const hk = await page.evaluate(() => {
    const S = G.city.start, R = G.city.goldRing, out = {};
    G.test.teleport(S.x, S.y, S.z);
    G.test.step(1 / 60, 2);
    G.test.aimAt(1, R.x, R.y, R.z);
    G.test.step(1 / 60, 1);
    out.aim = G.test.aim(1);
    const f0 = G.frame;
    G.test.press(1, true);
    G.test.step(1 / 60, 30);
    out.rope = G.test.state().ropes[1];
    out.ev1 = G.test.events().filter((e) => e.frame > f0).map((e) => e.type);
    G.test.yank(1, 3);
    G.test.step(1 / 60, 1);
    out.ev2 = G.test.events().filter((e) => e.frame > f0).map((e) => e.type);
    G.test.press(1, false);
    G.test.step(1 / 60, 2);
    out.after = G.test.state().ropes[1].state;
    out.ev3 = G.test.events().filter((e) => e.frame > f0).map((e) => e.type);
    // "toggle" hold: a second press lets go, not the trigger opening
    G.settings.hold = "toggle";
    G.test.teleport(S.x, S.y, S.z);
    G.test.step(1 / 60, 2);
    G.test.press(1, true); G.test.step(1 / 60, 30); G.test.press(1, false); G.test.step(1 / 60, 10);
    out.toggleHeld = G.test.state().ropes[1].state;
    G.test.press(1, true); G.test.step(1 / 60, 2); G.test.press(1, false); G.test.step(1 / 60, 2);
    out.toggleLet = G.test.state().ropes[1].state;
    G.settings.hold = "hold";
    G.test.aimAt(1, null);
    const w = G.test.toWorld(0.3, 1.2, -0.4), l = G.test.toLocal(w.x, w.y, w.z);
    out.round = Math.hypot(l.x - 0.3, l.y - 1.2, l.z + 0.4);
    out.inp = G.test.input();
    out.portal = G.test.portal();
    out.ui = G.test.ui();
    out.reality = G.test.reality();
    G.test.wakeKing(); G.test.clearClog(0);
    out.progress = G.test.state().progress;
    return out;
  });
  check(hk.aim && hk.aim.valid && Math.hypot(hk.aim.x - S.x, hk.aim.z - S.z) > 30, "G.test.aimAt aims the right rope in flat play", hk.aim);
  check(hk.rope.state === "attached" && hk.ev1.includes("fire") && hk.ev1.includes("attach"), "G.test.press fires the rope and it attaches", { rope: hk.rope.state, events: hk.ev1 });
  check(hk.ev2.includes("yank") && hk.after === "idle" && hk.ev3.includes("detach"), "G.test.yank yanks, and press(false) lets go", { ev2: hk.ev2, after: hk.after });
  check(hk.toggleHeld === "attached" && hk.toggleLet === "idle", "the toggle hold keeps the rope after the button opens, and the next press lets go", { held: hk.toggleHeld, let: hk.toggleLet });
  check(hk.round < 1e-9, "G.test.toLocal undoes G.test.toWorld", hk.round);
  check(hk.inp.mode === "desktop" && hk.inp.kind === "mouse" && hk.inp.hands.length === 2 && hk.inp.hands.every((h) => h.connected), "G.test.input gives the flat Input", hk.inp.kind);
  check(hk.portal && typeof hk.portal.phase === "string" && hk.ui && typeof hk.ui.paused === "boolean" && Array.isArray(hk.ui.buttons) && hk.reality && "maxFade" in hk.reality, "G.test.portal, ui and reality answer", { portal: hk.portal, ui: hk.ui, reality: hk.reality });
  check(hk.progress && hk.progress.king === "awake" && hk.progress.clogs === 1 && hk.progress.clogsTotal === 12, "G.test.wakeKing and clearClog reach the game", hk.progress);
  const cam = await page.evaluate(async () => {
    const out = {};
    for (const n of ["start", "needle", "canyon", "harbour", "aerial", "street", "diorama"]) {
      out[n] = !!G.test.camera(n);
      const px = await G.test.sample([[0.5, 0.5], [0.5, 0.2]]);
      out[n + "Px"] = px[0][0] + px[0][1] + px[0][2] + px[1][0] + px[1][1] + px[1][2];
    }
    G.test.camera(null);
    out.back = G.test.camera("nothing") === null;
    return out;
  });
  check(["start", "needle", "canyon", "harbour", "aerial", "street", "diorama"].every((n) => cam[n] && cam[n + "Px"] > 60) && cam.back, "G.test.camera gives every named shot, and each draws", cam);
  await page.evaluate(() => G.test.hold(true));

  // a drawn frame is not black (read in the loop, right after render)
  const px = await page.evaluate(async () => { G.test.hold(false); return G.test.sample([[0.5, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.5]]); });
  const bright = px.filter((p) => p[0] + p[1] + p[2] > 60).length;
  check(bright >= 3, "a rendered frame is not black", px);
  const ri = await page.evaluate(() => G.test.renderInfo());
  check(ri.calls > 0 && ri.tris > 0 && ri.views === 1, "renderInfo reports draw calls and triangles", ri);
  await shot(page, "boot-desktop");
  check(page.errors.length === 0, "no errors in flat play", page.errors);
  await page.context().close();
} catch (e) { check(false, "desktop boot threw", e.stack || String(e)); }

/* ---------------- PWA launch: straight into a session, no title ---------------- */
try {
  const page = await newPage({ width: 640, height: 360 });
  // record every moment the title is visible, from the first script on
  await page.addInitScript(() => {
    window.__titleSeen = 0;
    const look = () => { const t = document.querySelector("#title"); if (t && !t.hidden && getComputedStyle(t).display !== "none") window.__titleSeen++; requestAnimationFrame(look); };
    requestAnimationFrame(look);
  });
  await open(page, "?source=pwa&emulate", { wait: false });
  await waitFor(page, () => window.G && G.ready && G.xr && G.xr.session, null, 180000);
  const s = await waitState(page, { state: "play" }, 60000).catch(async () => state(page));
  const r = await page.evaluate(() => ({ seen: window.__titleSeen, shows: G.titleShows, hidden: getComputedStyle(document.querySelector("#title")).display === "none" || document.querySelector("#title").hidden }));
  check(s.xr.session && (s.mode === "ar" || s.mode === "vr"), "?source=pwa starts a session with no click (" + s.mode + ")", s.xr);
  check(r.seen === 0 && r.shows === 0 && r.hidden, "the PWA launch never shows the title", r);
  check(s.state === "play" || s.state === "intro", "the PWA launch goes on into the opening and play", s.state);
  check(page.errors.length === 0, "no errors on the PWA launch", page.errors);
  await page.context().close();
} catch (e) { check(false, "PWA launch threw", e.stack || String(e)); }

await close();
done();
