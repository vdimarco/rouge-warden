// The game on a computer, with no sensors: a press on the reel and a drag down opens the bail and holds the line (the
// drag decides: down holds the line, sideways aims), a flick up casts, the reel starts when the lure lands, the mouse
// wheel reels (its first turn closes the bail), Space sets the hook, and W and S work the rod. The hold cast with the
// mouse is in mouse.e2e.mjs.
// Serve public/ first (cd public && python3 -m http.server 8765), then: node qa/fish/desk.mjs
// Exits with code 1 when something fails. Set SHOTS to a folder to save screenshots.
import { open, until, center, shot, sleep } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const { browser, page, errors } = await open({ width: 1280, height: 720, touch: false, phone: false, query: "?debug" });
page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log("     navigated to " + f.url()); });

try {
  await page.click("#freeBtn");
  await until(page, () => window.FISH && FISH.G.phase === "cast", null, 15000);
  const st = await page.evaluate(() => ({ input: FISH.G.input, layout: FISH.G.layout }));
  check(st.input === "touch", "a computer plays with the mouse (" + st.input + ")");
  check(st.layout === "wide-cast", "a wide screen gets the wide cast layout (" + st.layout + ")");
  // (kg: a long cast can roll a pumpkinseed too heavy to swing in, and this test wants a small fish it can land)
  await page.evaluate(() => { FISH.G.force = { species: "pumpkinseed", kg: 0.25, bite: true }; });
  await shot(page, "desk-1-ready");

  // hold on the reel, drag down to tip the rod back, then flick up and let go during the flick. The press and the drag are
  // played inside the page: a mouse button that stays put for 150 ms is the hold cast (mouse.e2e.mjs), and a slow software
  // renderer can hold back a CDP mouse move longer than that
  // (once a frame has handed the press over to the reel panel: a slow renderer can take a while)
  await until(page, () => FISH.reelPanel.s.grab === "lock", null, 15000);
  const rb = await center(page, "#reelBox");
  const x = rb.x, y0 = rb.y - rb.h * 0.15;
  const fire =(type, y) => page.evaluate(({ type, x, y }) => {
    const el = document.elementFromPoint(x, y) || document.body, spin = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
    const ev = (t, yy) => el.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: yy, bubbles: true, button: 0, buttons: 1 }));
    // the press and its first 22 px down in one go
    if (type === "down") { ev("pointerdown", y); for (let i = 1; i <= 4; i++) { spin(6); ev("pointermove", y + 5.5 * i); } } else ev("pointermove", y);
  }, { type, x, y });
  await fire("down", y0);
  await until(page, () => FISH.G.step === "pinned" && FISH.G.bail === "open" && !FISH.G.pin.key, null, 3000).then(() => check(true, "pressing on the reel and dragging down opens the bail and holds the line"), () => check(false, "pressing on the reel and dragging down opens the bail and holds the line"));
  for (let i = 2; i <= 12; i++) { await fire("move", y0 + i * 22); await sleep(25); }
  // (a frame loads the rod: a slow software renderer can draw none for a second or more)
  await until(page, () => FISH.G.step === "loaded", null, 6000).catch(() => {});
  const loaded = await page.evaluate(() => FISH.G.step);
  check(loaded === "loaded", "dragging down loads the rod (" + loaded + ")");
  // the flick: up fast, let go part way. Played inside the page, because a slow software renderer holds back
  // each CDP mouse move by hundreds of ms, and a flick is all about speed
  await page.evaluate(async ({ x, y }) => {
    // (the drag can end below the window: the reel listens on the window, so any element will do)
    const el = document.elementFromPoint(x, y) || document.body;
    const fire = (type, yy) => el.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: yy, bubbles: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    for (let i = 1; i <= 6; i++) { fire("pointermove", y - i * 36); await new Promise((r) => setTimeout(r, 8)); }
    fire("pointerup", y - 216);
  }, { x, y: y0 + 264 });
  await until(page, () => FISH.G.step === "flight" || FISH.G.step === "landed" || FISH.G.step === "ashore", null, 5000).catch(() => {});
  const cast = await page.evaluate(() => FISH.G.cast);
  check(!!cast, "a mouse flick casts" + (cast ? " (" + cast.verdict + ", " + cast.v0.toFixed(1) + " m/s, pitch " + cast.pitch.toFixed(0) + "°)" : ""));
  await until(page, () => FISH.G.step === "landed" || FISH.G.step === "ashore", null, 90000).catch(() => {});
  const land = await page.evaluate(() => ({ step: FISH.G.step, dist: FISH.G.landing && FISH.G.landing.dist }));
  check(land.step === "landed", "the lure lands in the water (" + land.step + (land.dist ? ", " + land.dist.toFixed(1) + " m" : "") + ")");
  await shot(page, "desk-2-landed");

  if (land.step === "landed") {
    await until(page, () => FISH.G.phase === "reel", null, 5000).then(() => check(true, "the reel starts when the lure lands"), () => check(false, "the reel starts when the lure lands"));
    check((await page.evaluate(() => FISH.G.layout)) === "reel", "the reel uses the wide layout");
    // reel with the wheel until the strike, then Space
    await page.mouse.move(640, 360);
    let phase = "", closedAt = null;
    for (let i = 0; i < 1500; i++) {
      const st = await page.evaluate(() => ({ p: FISH.G.sim ? FISH.G.sim.state.phase : "none", g: FISH.G.phase }));
      phase = st.p;
      if (phase === "strike" || phase === "fight" || phase === "lost" || phase === "home" || st.g !== "reel") break;
      if (i % 40 < 34) await page.mouse.wheel(0, 90);
      await sleep(30);
      if (closedAt == null && (await page.evaluate(() => FISH.G.bail)) === "closed") closedAt = i;
    }
    check(closedAt != null && closedAt < 10, "the wheel's first turn closes the bail (after " + closedAt + " wheel steps)");
    check(phase === "strike" || phase === "fight", "the wheel reels until a strike (" + phase + ")");
    if (phase === "strike") {
      await page.keyboard.press("Space");
      await until(page, () => FISH.G.sim && FISH.G.sim.state.phase !== "strike", null, 4000).catch(() => {});
      phase = await page.evaluate(() => FISH.G.sim.state.phase);
      check(phase === "fight" || phase === "land" || phase === "caught", "Space sets the hook (" + phase + ")");
    }
    await shot(page, "desk-3-fight");
    // fight with the keys and the wheel, played inside the page in real time: W and S hold the rod near a
    // target that pumps between 50° and 85°, the wheel reels on the way down, and it stops when the drag slips
    const done = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code === "KeyW" ? "w" : "s", bubbles: true }));
      let held = null, target = 85, up = true, lastWheel = 0;
      const hold = (code) => { if (held === code) return; if (held) key("keyup", held); held = code; if (code) key("keydown", code); };
      const t0 = performance.now();
      while (performance.now() - t0 < 150000) {
        if (FISH.G.phase !== "reel") break;
        const s = FISH.G.sim.state, th = FISH.Motion.pose.theta, f = s.fish || {};
        if (s.phase === "land") target = 95;
        else if (f.move === "jump") target = 30;
        else if (up && th >= 84) { up = false; target = 50; }
        else if (!up && th <= 51) { up = true; target = 85; }
        hold(th < target - 3 ? "KeyW" : th > target + 3 ? "KeyS" : null);
        const now = performance.now();
        // reel on the way down, and any time the line goes slack (the game says so)
        if ((!up || s.slack) && s.phase !== "land" && (s.slip || 0) < 0.05 && (s.tfrac || 0) < 0.75 && now - lastWheel > 60) { lastWheel = now; window.dispatchEvent(new WheelEvent("wheel", { deltaY: 60, bubbles: true, cancelable: true })); }
        await wait(16);
      }
      hold(null);
      return FISH.G.phase === "catch" ? "catch" : FISH.G.phase + " (" + (FISH.G.sim && FISH.G.sim.state.reason) + ")";
    });
    check(done === "catch", "the keys and the wheel land the fish (" + done + ")");
    if (done === "catch") {
      await page.waitForSelector("#catch:not([hidden])");
      await shot(page, "desk-4-catch");
      await page.keyboard.press("Enter");
      await until(page, () => FISH.G.phase === "cast", null, 8000).then(() => check(true, "Enter casts again"), () => check(false, "Enter casts again"));
    }
  }
  // pause and the menus
  await page.keyboard.press("Escape");
  check(await page.isVisible("#pause"), "Esc pauses");
  await page.click("#pJournal");
  check(await page.isVisible("#journal"), "the journal opens from the pause menu");
  // Loon Lake counts its own 13 (9 fish, the legend, 3 junk), not all 29 kinds of the game. The list is short: the fish
  // caught, the next 3 to find, and how many more
  const rows = await page.evaluate(() => ({ n: document.querySelectorAll("#jlist .jfish").length, got: document.querySelectorAll("#jlist .jfish:not(.none)").length, note: (document.querySelector("#jlist .jnote") || {}).textContent, sum: document.querySelector("#jsum").textContent, tabs: document.querySelectorAll("#jtabs button").length }));
  check(rows.n === rows.got + 3 && rows.note === 10 - rows.got + " more to find here." && /^\d+ of 13 found here · \d+ of 29 in all/.test(rows.sum) && rows.tabs === 4, "the journal shows Loon Lake's fish caught, the next 3, how many more, and a chip for each of the 4 places (" + JSON.stringify(rows) + ")");
  await page.click("#journal [data-close]");
  check(await page.isVisible("#pause"), "closing the journal returns to the pause menu");
  await page.click("#quitBtn");
  check(await page.isVisible("#title"), "Quit goes back to the title");
  // the Places screen, from the keyboard
  await sleep(400);
  await page.click("#placesBtn");
  check(await page.isVisible("#places") && (await page.locator("#plist .pcard").count()) === 4, "Places shows four cards");
  await page.keyboard.press("Escape");
  check(await page.isVisible("#title") && !(await page.isVisible("#places")), "Esc closes Places");
} catch (e) {
  check(false, "exception: " + (e && e.message) + " at " + page.url() + "\n" + String(e && e.stack).split("\n").slice(0, 6).join("\n"));
}
check(errors.length === 0, "no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
await browser.close();
console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
process.exit(fails.length ? 1 : 0);
