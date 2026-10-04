// The cast with a mouse on a computer, in the real page: node qa/fish/mouse.e2e.mjs   (serve public/ first; FISH_URL sets
// the address). The hold cast: hold the button still and the rod tips back by itself, then swings forward; letting go in the
// green casts, graded at the rod angle then, like Space. Too soon casts high or nothing, held to the end slams, and the
// mouse moved sideways while it holds aims. The rail shows beside the press, all of it on the screen. With the bail opened
// first (the E key) the button held still is the same hold cast, and a press that moves down is the drag. The drag and
// flick still casts, a press on a HUD button never casts, a click during the flight feathers the line, and a click during
// the reel starts no cast. Exits with code 1 when something fails.
import { open, until, sleep } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };

// In the page: mouse gestures with exact timing (a slow software renderer would stretch CDP input)
function helpers() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const G = FISH.G;
  window.__wait = wait;
  const fire = (type, x, y) => {
    const el = document.elementFromPoint(x, y) || document.body;
    el.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    return el;
  };
  window.__fire = fire;
  window.__rect = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  // a new cast, once a frame has handed the press over to the reel panel
  window.__fresh = async (yaw = 0) => {
    FISH.newCast(); G.aimYaw = yaw; document.querySelector("#report").hidden = true;
    const t0 = performance.now();
    while (!(G.phase === "cast" && G.step === "ready" && FISH.reelPanel.s.grab === "lock") && performance.now() - t0 < 10000) await wait(5);
    await wait(150);
  };
  // the hold cast: press at (x, y), keep still, and let go `ms` after the rod starts to tip back (G.pin.key). moves: sideways
  // px to move while it holds. A hold that a busy page stretched by more than 40 ms says so (busy). look: hold on until a
  // frame has shown the rail and the prompt to let go (a slow software renderer may draw no frame for a second), and say
  // what the rail, the prompts and the boxes it must stay under were then
  window.__hold = async ({ x = 520, y = 520, ms = 780, moves = 0, look = false }) => {
    const casts = G.casts, said = document.querySelector("#toast").textContent, out = {};
    const tp = performance.now();
    out.on = fire("pointerdown", x, y).id;
    while (!(G.pin && G.pin.key) && performance.now() - tp < 1500) await wait(1);
    if (!(G.pin && G.pin.key)) { fire("pointerup", x, y); out.held = false; return out; }
    const t0 = G.pin.key;
    out.held = true; out.afterMs = Math.round(t0 - tp); out.bail = G.bail; out.step = G.step;
    for (let i = 1; i <= moves && G.pin; i++) { fire("pointermove", x + (100 * i) / moves, y + (i % 2)); await wait(10); }
    out.yawHeld = G.aimYaw;
    const prompts = new Set(), rail = document.querySelector("#castRail"), said1 = () => document.querySelector("#prompt .p1 span").textContent;
    while (G.pin && performance.now() - t0 < (look ? 5000 : ms)) {
      prompts.add(said1());
      // (look: the rod stays where it has swung back past LOAD, so a slow frame cannot find it at the end of its swing)
      if (look && G.pin.key) G.pin.key = performance.now() - 600;
      if (look && !rail.hidden && said1() === "Let go in the green.") {
        out.rail = { box: window.__rect("#castRail"), band: rail.querySelector(".band").hidden ? 0 : rail.querySelector(".band").offsetHeight };
        out.boxes = ["#hud", "#prompt .p1", "#prompt .p2"].map(window.__rect).filter((b) => b && b.h > 0);
        break;
      }
      await wait(1);
    }
    out.ms = Math.round(performance.now() - t0);
    fire("pointerup", x + (moves ? 100 : 0), y);
    out.prompts = [...prompts];
    const c = G.casts > casts ? G.cast : null;
    out.cast = c && c.verdict; out.yaw = c && c.yaw; out.stepAfter = G.step;
    out.cue = !document.querySelector("#report").hidden && document.querySelector("#report").classList.contains("cue") ? document.querySelector("#report .verdict").textContent : "";
    // fly a copy of the lure to the end, for the distance (the game flies its own)
    if (c && G.flight) { const f = Object.assign(Object.create(Object.getPrototypeOf(G.flight)), JSON.parse(JSON.stringify(G.flight))); let s, n = 0; do { s = f.step(1 / 60); n++; } while (!s.done && n < 3000); out.dist = Math.hypot(s.x, s.z); out.land = s.land; }
    if (!c) { const t1 = performance.now(); while (document.querySelector("#toast").textContent === said && performance.now() - t1 < 1500) await wait(10); out.toast = document.querySelector("#toast").textContent; }
    out.busy = !look && Math.abs(out.ms - ms) > 40 && ms < 1100;
    return out;
  };
  return true;
}
const tryHold = async (page, a) => {
  let r;
  for (let i = 0; i < 3; i++) {
    await page.evaluate((yaw) => window.__fresh(yaw), a.yaw || 0);
    r = await page.evaluate((a) => window.__hold(a), a);
    if (!r.busy) break;
    console.log("     (the page was busy: " + JSON.stringify({ ms: r.ms, cast: r.cast }) + ")");
  }
  return r;
};
const overlap = (a, b) => !!(a && b) && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const { browser, page, errors } = await open({ width: 1280, height: 800, touch: false, phone: false, save: { v: 1, quality: "low" } });
try {
  await page.click("#freeBtn");
  await until(page, () => window.FISH && FISH.G.phase === "cast", null, 30000);
  await page.evaluate(helpers);
  await sleep(800);
  const ready = await page.evaluate(() => [document.querySelector("#prompt .p1 span").textContent, document.querySelector("#prompt .p2").textContent]);
  check(ready[0] === "Hold the mouse button. Let go in the green." && /Drag sideways to aim/.test(ready[1]), `the cast prompt on a computer says how: "${ready.join(" / ")}"`);

  // ---- the hold cast, let go in the green ----
  const good = await tryHold(page, { ms: 780 });
  check(good.held && good.afterMs >= 140 && good.afterMs < 400 && good.bail === "open" && good.step === "pinned", `a mouse button held still takes the line after about 150 ms and opens the bail (${JSON.stringify({ afterMs: good.afterMs, bail: good.bail, step: good.step })})`);
  check(good.cast === "sweet" && good.cue === "Sweet!" && good.land === "water" && good.dist >= 25, `let go as the rod comes through the green: sweet, and the lure flies ${(good.dist || 0).toFixed(1)} m (${JSON.stringify({ ms: good.ms, cast: good.cast, cue: good.cue, land: good.land })})`);
  await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});

  // ---- what it shows while it holds: the hold's own prompts (never the drag ones), and the rail beside the press, all of
  // it on the screen and clear of the HUD and the prompt (a press high up stands it lower) ----
  const HOLD_WORDS = ["Hold the mouse button. Let go in the green.", "Keep holding.", "Let go in the green."];
  const clear = (o) => { const r = o.rail && o.rail.box, words = r && { x: r.x - 90, y: r.y, w: r.w + 180, h: r.h }; return !!r && o.rail.band >= 30 && r.y >= 0 && r.y + r.h <= 800 && !o.boxes.some((b) => overlap(words, b)); };
  for (const y of [520, 150]) {
    await page.evaluate(() => window.__fresh());
    const o = await page.evaluate((y) => window.__hold({ y, look: true }), y);
    check(o.prompts.includes("Let go in the green.") && o.prompts.every((p) => HOLD_WORDS.includes(p)), `a hold at y ${y}: the prompts are the hold's own (${o.prompts.join(" / ")})`);
    check(clear(o), `a hold at y ${y}: the whole rail and its green band show beside the press, clear of the HUD and the prompt (${JSON.stringify({ rail: o.rail, boxes: o.boxes })})`);
    await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});
  }

  // ---- too soon, as Space: nothing in the back swing, high as the rod starts forward ----
  const tap = await tryHold(page, { ms: 300 });
  check(tap.held && !tap.cast && tap.stepAfter === "ready" && tap.toast === "Keep holding until the rod comes forward.", `let go in the back swing: nothing flies, and it says "${tap.toast}" (${JSON.stringify({ ms: tap.ms, cast: tap.cast, step: tap.stepAfter })})`);
  const soon = await tryHold(page, { ms: 600 });
  check(soon.cast === "high", `let go as the rod starts forward: too soon, ${soon.cast} (${soon.ms} ms)`);
  await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});
  const end = await tryHold(page, { ms: 1600 });
  check(end.cast === "slam", `held to the end: it lets go there, late: ${end.cast}`);
  await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});

  // ---- the mouse moved sideways while it holds aims ----
  const aim = await tryHold(page, { ms: 780, moves: 10 });
  check(aim.yawHeld > 15 && Math.abs(aim.yaw - aim.yawHeld) < 1 && !!aim.cast, `moving the mouse 100 px right while it holds turns the aim ${aim.yawHeld.toFixed(1)}°, and the cast goes that way (yaw ${aim.yaw != null ? aim.yaw.toFixed(1) : "none"}, ${aim.cast})`);
  await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});

  // ---- the bail opened first with the E key: the prompt says the same, a button held still is the hold cast, and a press
  // that moves down at once is the drag ----
  const openBail = () => page.evaluate(async () => {
    const G = FISH.G, wait = window.__wait, p2 = () => document.querySelector("#prompt .p2").textContent;
    for (const type of ["keydown", "keyup"]) window.dispatchEvent(new KeyboardEvent(type, { code: "KeyE", key: "e", bubbles: true, cancelable: true }));
    const t0 = performance.now();
    while (!/line/.test(p2()) && performance.now() - t0 < 3000) await wait(10);
    return { step: G.step, bail: G.bail, said: [document.querySelector("#prompt .p1 span").textContent, p2()] };
  });
  let opened, before;
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__fresh());
    before = await openBail();
    opened = await page.evaluate(() => window.__hold({ ms: 780 }));
    if (!opened.busy) break;
    console.log("     (the page was busy: " + JSON.stringify({ ms: opened.ms, cast: opened.cast }) + ")");
    await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});
  }
  check(before.step === "open" && before.bail === "open" && before.said[0] === "Hold the mouse button. Let go in the green.", `the E key opens the bail, and the prompt still says how to cast with the mouse (${JSON.stringify(before)})`);
  check(opened.held && opened.afterMs >= 140 && opened.afterMs < 400 && opened.step === "pinned" && opened.cast === "sweet" && opened.prompts.every((p) => HOLD_WORDS.includes(p)), `with the bail open, a mouse button held still is the hold cast: let go in the green, sweet (${JSON.stringify({ afterMs: opened.afterMs, step: opened.step, ms: opened.ms, cast: opened.cast, prompts: opened.prompts, toast: opened.toast })})`);
  await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});
  await page.evaluate(() => window.__fresh());
  await openBail();
  const odrag = await page.evaluate(async () => {
    const G = FISH.G, x = 520, y = 420, spin = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
    window.__fire("pointerdown", x, y);
    const out = { pinnedAtOnce: G.step === "pinned" };
    for (let i = 1; i <= 6; i++) { spin(8); window.__fire("pointermove", x, y + 4 * i); }
    Object.assign(out, { step: G.step, hold: !!(G.pin && G.pin.key), y0: G.pin && G.pin.y0 });
    window.__fire("pointerup", x, y + 24);
    await window.__wait(100);
    return out;
  });
  check(!odrag.pinnedAtOnce && odrag.step === "pinned" && !odrag.hold && odrag.y0 === 420, `with the bail open, a mouse press that moves down at once is the drag, and it takes the line where it pressed (${JSON.stringify(odrag)})`);

  // ---- the drag and flick still casts ----
  await page.evaluate(() => window.__fresh());
  const flick = await page.evaluate(async () => {
    const G = FISH.G, wait = window.__wait, x = 520, y = 420, spin = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
    // the first 24 px in 48 ms, spaced by a spin, so a busy page cannot hold the moves back past the hold's 150 ms
    window.__fire("pointerdown", x, y);
    for (let i = 1; i <= 6; i++) { spin(8); window.__fire("pointermove", x, y + 4 * i); }
    const out = { pinned: G.step === "pinned", hold: !!(G.pin && G.pin.key) };
    for (let i = 7; i <= 22; i++) { window.__fire("pointermove", x, y + 4 * i); await wait(12); }
    const tr = performance.now();
    while (G.step !== "loaded" && performance.now() - tr < 3000) await wait(20);
    out.loaded = G.step === "loaded";
    const t0 = performance.now();
    let k = 0;
    while (k < 1) { k = Math.min(1, (performance.now() - t0) / 100); window.__fire("pointermove", x, y + 88 - 140 * k); await wait(8); }
    window.__fire("pointerup", x, y - 52);
    out.cast = G.cast && G.step === "flight" ? G.cast.verdict : null;
    return out;
  });
  check(flick.pinned && !flick.hold && flick.loaded && !!flick.cast, `a press that moves down at once is still the drag and flick: it loads and casts (${JSON.stringify(flick)})`);
  await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});

  // ---- a press on a HUD button never casts ----
  await page.evaluate(() => window.__fresh());
  const hud = await page.evaluate(async () => {
    const G = FISH.G, out = [];
    for (const sel of ["#pauseBtn", "#guideToggle"]) {
      const r = window.__rect(sel);
      if (!r) continue;
      const x = r.x + r.w / 2, y = r.y + r.h / 2, el = window.__fire("pointerdown", x, y);
      await window.__wait(450);
      out.push({ on: el.id, step: G.step, pin: !!G.pin, bail: G.bail });
      window.__fire("pointerup", x, y);
      await window.__wait(50);
    }
    return out;
  });
  check(hud.length === 2 && hud.every((h) => h.step === "ready" && !h.pin && h.bail === "closed"), `a mouse button held on a HUD button takes no line (${JSON.stringify(hud)})`);

  // ---- feathering: a click anywhere during the flight slows the line ----
  const fly = async (feather) => {
    let r;
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__fresh());
      r = await page.evaluate(async (feather) => {
        const G = FISH.G, wait = window.__wait, x = 520, y = 520;
        window.__fire("pointerdown", x, y);
        const tp = performance.now();
        while (!(G.pin && G.pin.key) && performance.now() - tp < 1500) await wait(1);
        const t0 = G.pin && G.pin.key;
        while (G.pin && performance.now() - t0 < 780) await wait(1);
        const ms = performance.now() - t0;
        window.__fire("pointerup", x, y);
        const out = { ms: Math.round(ms), cast: G.cast && G.cast.verdict };
        if (feather) {
          // once a frame has set up the flight, click on the lake far from the rod, and hold it until the lure is down
          const tf = performance.now();
          while (G.step === "flight" && FISH.reelPanel.s.grab !== "feather" && performance.now() - tf < 5000) await wait(2);
          window.__fire("pointerdown", 300, 360);
          out.pin = !!(G.pin && G.pin.feather);
        }
        const tl = performance.now();
        while (G.step === "flight" && performance.now() - tl < 60000) await wait(5);
        if (feather) window.__fire("pointerup", 300, 360);
        out.dist = G.landing ? G.landing.dist : null; out.feathered = !!(G.landing && G.landing.feather); out.step = G.step;
        return out;
      }, feather);
      if (Math.abs(r.ms - 780) <= 40) break;
      await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});
    }
    await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});
    return r;
  };
  const plain = await fly(false), slowed = await fly(true);
  check(slowed.pin && slowed.feathered && plain.dist && slowed.dist && slowed.dist < plain.dist - 4, `a mouse click on the lake during the flight feathers the line: ${(slowed.dist || 0).toFixed(1)} m against ${(plain.dist || 0).toFixed(1)} m (${JSON.stringify(slowed)})`);

  // ---- a click during the reel starts no cast ----
  const reel = await page.evaluate(async () => {
    const G = FISH.G, wait = window.__wait;
    const t0 = performance.now();
    while (G.phase !== "reel" && performance.now() - t0 < 20000) await wait(10);
    const casts = G.casts, phase = G.phase;
    window.__fire("pointerdown", 520, 420);
    await wait(500);
    const out = { before: phase, phase: G.phase, pin: !!G.pin, casts: G.casts - casts };
    window.__fire("pointerup", 520, 420);
    await wait(100);
    out.after = G.phase;
    return out;
  });
  check(reel.before === "reel" && reel.phase === "reel" && !reel.pin && reel.casts === 0 && reel.after === "reel", `a mouse button held during the reel starts no cast (${JSON.stringify(reel)})`);
} catch (e) {
  check(false, "exception: " + (e && e.stack));
}
check(errors.length === 0, "no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
await browser.close();
console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
process.exit(fails.length ? 1 : 0);
