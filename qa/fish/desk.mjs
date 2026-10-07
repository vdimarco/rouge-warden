// The game on a computer, with no sensors: a press on the reel and a drag down opens the bail and holds the line (the
// drag decides: down holds the line, sideways aims), a flick up casts, the reel starts when the lure lands, the mouse
// wheel reels (its first turn closes the bail), Space sets the hook, and W and S work the rod. The hold cast with the
// mouse is in mouse.e2e.mjs.
// Serve public/ first (cd public && python3 -m http.server 8765), then: node qa/fish/desk.mjs
// Exits with code 1 when something fails. Set SHOTS to a folder to save screenshots.
import { open, until, untilPlay, center, shot, sleep } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const { browser, page, errors } = await open({ width: 1280, height: 720, touch: false, phone: false, query: "?debug" });
// until, but a timeout fails with what it waited for. (A frame or two gives each of these: a slow software renderer can
// draw none for some seconds)
const waitFor = (what, fn, arg, ms = 60000) => until(page, fn, arg, ms).catch(() => { throw new Error(`no ${what} in ${ms / 1000} s`); });
// until, for a check: "" when it came, or the words that say it did not
const late = (fn, arg, ms = 60000) => until(page, fn, arg, ms).then(() => "", () => `not in ${ms / 1000} s: `);
page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log("     navigated to " + f.url()); });

try {
  await page.click("#freeBtn");
  await waitFor("free fishing", () => window.FISH && FISH.G.phase === "cast");
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
  await waitFor("frame that hands the press to the reel panel", () => FISH.reelPanel.s.grab === "lock");
  const rb = await center(page, "#reelBox");
  const x = rb.x, y0 = rb.y - rb.h * 0.15;
  const fire =(type, y) => page.evaluate(({ type, x, y }) => {
    const el = document.elementFromPoint(x, y) || document.body, spin = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
    const ev = (t, yy) => el.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: yy, bubbles: true, button: 0, buttons: 1 }));
    // the press and its first 22 px down in one go
    if (type === "down") { ev("pointerdown", y); for (let i = 1; i <= 4; i++) { spin(6); ev("pointermove", y + 5.5 * i); } } else ev("pointermove", y);
  }, { type, x, y });
  await fire("down", y0);
  await until(page, () => FISH.G.step === "pinned" && FISH.G.bail === "open" && !FISH.G.pin.key, null, 30000).then(() => check(true, "pressing on the reel and dragging down opens the bail and holds the line"), () => check(false, "pressing on the reel and dragging down opens the bail and holds the line (not in 30 s)"));
  for (let i = 2; i <= 12; i++) { await fire("move", y0 + i * 22); await sleep(25); }
  // (a frame loads the rod: a slow software renderer can draw none for a second or more)
  const notLoaded = await late(() => FISH.G.step === "loaded");
  const loaded = await page.evaluate(() => FISH.G.step);
  check(loaded === "loaded", "dragging down loads the rod (" + notLoaded + loaded + ")");
  // the flick: up fast, let go part way. Played inside the page, because a slow software renderer holds back
  // each CDP mouse move by hundreds of ms, and a flick is all about speed
  await page.evaluate(async ({ x, y }) => {
    // (the drag can end below the window: the reel listens on the window, so any element will do)
    const el = document.elementFromPoint(x, y) || document.body;
    const fire = (type, yy) => el.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: yy, bubbles: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    for (let i = 1; i <= 6; i++) { fire("pointermove", y - i * 36); await new Promise((r) => setTimeout(r, 8)); }
    fire("pointerup", y - 216);
  }, { x, y: y0 + 264 });
  const notCast = await late(() => FISH.G.step === "flight" || FISH.G.step === "landed" || FISH.G.step === "ashore");
  const cast = await page.evaluate(() => FISH.G.cast);
  check(!!cast, "a mouse flick casts" + (cast ? " (" + cast.verdict + ", " + cast.v0.toFixed(1) + " m/s, pitch " + cast.pitch.toFixed(0) + "°)" : " (" + notCast + (await page.evaluate(() => FISH.G.step)) + ")"));
  // (a slow frame moves the game on by 0.25 s at most, so a flight can take minutes)
  const notDown = cast ? await untilPlay(page, () => FISH.G.step === "landed" || FISH.G.step === "ashore", null, "the lure comes down").then(() => "", (e) => e.message + ": ") : "";
  const land = await page.evaluate(() => ({ step: FISH.G.step, dist: FISH.G.landing && FISH.G.landing.dist }));
  check(land.step === "landed", "the lure lands in the water (" + notDown + land.step + (land.dist ? ", " + land.dist.toFixed(1) + " m" : "") + ")");
  await shot(page, "desk-2-landed");

  if (land.step === "landed") {
    await until(page, () => FISH.G.phase === "reel", null, 30000).then(() => check(true, "the reel starts when the lure lands"), () => check(false, "the reel starts when the lure lands (not in 30 s)"));
    check((await page.evaluate(() => FISH.G.layout)) === "reel", "the reel uses the wide layout");
    // reel with the wheel until the strike, then Space. The bail closes in the game frame where the wheel first turns the
    // crank (one frame, two on a busy machine): the page notes the frame of the first wheel turn and of the bail's sound,
    // so the check counts game frames, not test steps (slow frames)
    await page.evaluate(() => {
      window.__wheelF = null; window.__closeF = null;
      addEventListener("wheel", () => { if (window.__wheelF == null) window.__wheelF = FISH.G.frame; }, true);
      const sfx = FISH.Sound.sfx;
      FISH.Sound.sfx = function (name, ...a) { if (name === "bailClose" && window.__closeF == null) window.__closeF = FISH.G.frame; return sfx.call(this, name, ...a); };
    });
    await page.mouse.move(640, 360);
    // (up to 60 s of the game's clock, with a short pause in each 1.6 s of it: a slow test browser runs the game slower
    // than the wall clock. It stops when no frame came for a minute)
    let phase = "", still = "", f = -1, ft = Date.now();
    for (;;) {
      const st = await page.evaluate(() => ({ p: FISH.G.sim ? FISH.G.sim.state.phase : "none", g: FISH.G.phase, t: FISH.G.sim ? FISH.G.sim.state.t : 0, f: FISH.G.frame }));
      phase = st.p;
      if (phase === "strike" || phase === "fight" || phase === "lost" || phase === "home" || st.g !== "reel") break;
      if (st.f !== f) { f = st.f; ft = Date.now(); }
      if (st.t > 60) { still = ", no strike in 60 s of the game's clock"; break; }
      if (Date.now() - ft > 60000) { still = ", and no frame came for a minute"; break; }
      if (st.t % 1.6 < 1.36) await page.mouse.wheel(0, 90);
      await sleep(30);
    }
    const cl = await page.evaluate(() => ({ wheel: window.__wheelF, close: window.__closeF }));
    const closeFrames = cl.wheel != null && cl.close != null ? cl.close - cl.wheel : null;
    check(closeFrames != null && closeFrames <= 2, "the wheel's first turn closes the bail (" + closeFrames + " game frames after the first wheel turn)");
    check(phase === "strike" || phase === "fight", "the wheel reels until a strike (" + phase + still + ")");
    if (phase === "strike") {
      await page.keyboard.press("Space");
      const notSet = await late(() => FISH.G.sim && FISH.G.sim.state.phase !== "strike");
      phase = await page.evaluate(() => FISH.G.sim.state.phase);
      check(phase === "fight" || phase === "land" || phase === "caught", "Space sets the hook (" + notSet + phase + ")");
    }
    await shot(page, "desk-3-fight");
    // fight with the keys and the wheel, played inside the page in real time: W and S hold the rod near a
    // target that pumps between 50° and 85°, the wheel reels on the way down, and it stops when the drag slips. Up to
    // 150 s of the game's clock (a slow test browser runs the game slower than the wall clock), or until no frame came
    // for a minute
    const done = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code === "KeyW" ? "w" : "s", bubbles: true }));
      let held = null, target = 85, up = true, lastWheel = 0, fr = FISH.G.frame, ft = performance.now(), still = "";
      const hold = (code) => { if (held === code) return; if (held) key("keyup", held); held = code; if (code) key("keydown", code); };
      for (;;) {
        if (FISH.G.phase !== "reel") break;
        if (FISH.G.sim.state.fightT > 150) { still = ", not landed in 150 s of the game's clock"; break; }
        if (FISH.G.frame !== fr) { fr = FISH.G.frame; ft = performance.now(); }
        if (performance.now() - ft > 60000) { still = ", and no frame came for a minute"; break; }
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
      return FISH.G.phase === "catch" ? "catch" : FISH.G.phase + " (" + (FISH.G.sim && FISH.G.sim.state.reason) + still + ")";
    });
    check(done === "catch", "the keys and the wheel land the fish (" + done + ")");
    if (done === "catch") {
      // (the card takes its button once the photo beat is over)
      await waitFor("catch card that takes Enter", () => !document.querySelector("#catch").hidden && !FISH.G.cardWait);
      await shot(page, "desk-4-catch");
      await page.keyboard.press("Enter");
      await until(page, () => FISH.G.phase === "cast", null, 30000).then(() => check(true, "Enter casts again"), () => check(false, "Enter casts again (not in 30 s)"));
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
