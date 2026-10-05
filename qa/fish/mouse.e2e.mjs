// The cast with a mouse on a computer, in the real page: node qa/fish/mouse.e2e.mjs   (serve public/ first; FISH_URL sets
// the address). The hold cast: hold the button still and the rod tips back by itself, then swings forward; letting go in the
// green casts, graded at the rod angle then, like Space. Too soon casts high or nothing, held to the end slams, and the
// mouse moved sideways while it holds aims. The rail shows beside the press, all of it on the screen. With the bail opened
// first (the E key) the button held still is the same hold cast, and a press that moves down is the drag. The drag and
// flick still casts, a press on a HUD button never casts, a click during the flight feathers the line, and a click during
// the reel starts no cast. The moves guide holds its first step still (no touch clip), and during the hold it says the
// hold's words with MOUSE. The flight's tip (on the third to the eighth cast) says to click the lake, and the click names the
// mouse button. In a fight the words name the mouse after a mouse press, and the keys (W, S, A, D, R, Space) after a press
// of a rod key, with KEYS on the guide. A key that repeats, Space, R and the wheel keep the words. Exits with code 1 when
// something fails.
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

  // ---- the moves guide (on for a new player): on a computer its first step holds still, with no touch clip; during the
  // hold cast it says what the prompt and the rod cue say, with MOUSE ----
  const guideNow = () => page.evaluate(() => { const g = document.querySelector("#fishGuide"), v = g.querySelector("video"); return { shown: !g.hidden, count: g.querySelector(".guide-count").textContent, clip: !!v && (!v.paused || !v.hidden) }; });
  const g0 = await guideNow();
  await sleep(3000);
  const g1 = await guideNow();
  check(g0.shown && g0.count === "1 / 3" && g1.count === "1 / 3" && !g0.clip && !g1.clip, `on a computer the guide holds its first step still, with no touch clip (${JSON.stringify({ g0, g1 })})`);
  await page.evaluate(() => window.__fresh());
  const hg = await page.evaluate(async () => {
    const G = FISH.G, wait = window.__wait, out = {};
    const read = () => { const g = document.querySelector("#fishGuide"); return { prompt: document.querySelector("#prompt .p1 span").textContent, guide: g.hidden ? "" : g.querySelector(".guide-caption").textContent, count: g.querySelector(".guide-count").textContent, cue: document.querySelector("#rodCue").hidden ? "" : document.querySelector("#rodCue span").textContent }; };
    window.__fire("pointerdown", 520, 520);
    const tp = performance.now();
    while (!(G.pin && G.pin.key) && performance.now() - tp < 1500) await wait(1);
    // the rod's clock held in each step, so a slow frame can show it: read two frames after the prompt says it
    for (const [step, said, ms] of [["pinned", "Keep holding.", () => 100], ["loaded", "Let go in the green.", () => (G.step === "loaded" ? 700 : 450)]]) {
      const t0 = performance.now();
      let f = 0;
      while (performance.now() - t0 < 10000) {
        if (G.pin && G.pin.key) G.pin.key = performance.now() - ms();
        if (!f && G.step === step && read().prompt === said) f = G.frame;
        if (f && G.frame >= f + 2) break;
        await wait(5);
      }
      out[step] = { step: G.step, ...read() };
    }
    window.__fire("pointerup", 520, 520);
    return out;
  });
  check(hg.pinned.guide === "Keep holding" && hg.pinned.cue === "Keep holding" && hg.pinned.count === "MOUSE" && hg.loaded.guide === "Let go in the green" && hg.loaded.cue === "Let go in the green" && hg.loaded.count === "MOUSE", `during a mouse hold the guide says what the prompt and the rod cue say, "Keep holding", then "Let go in the green", with MOUSE (${JSON.stringify(hg)})`);
  await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});

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
        // the player's fourth cast: the flight's tip shows on the third to the eighth
        FISH.save.casts = 3;
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
          // (the words of the flight on a computer: a click on the lake, not a touch on the rod)
          out.flightCue = document.querySelector("#rodCue span").textContent; out.flightSaid = document.querySelector("#prompt").hidden ? "" : document.querySelector("#prompt .p1 span").textContent;
          window.__fire("pointerdown", 300, 360);
          out.pin = !!(G.pin && G.pin.feather);
          // the words of the feather name the mouse button, not a thumb (once a frame has taken the press)
          const tw = performance.now();
          while (G.step === "flight" && !G.feathered && performance.now() - tw < 5000) await wait(2);
          out.featherSaid = document.querySelector("#prompt").hidden ? "" : document.querySelector("#prompt .p1 span").textContent;
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
  check(slowed.flightCue === "Click to slow" && slowed.flightSaid === "To stop the lure short, click the lake.", `in the flight of the fourth cast the rod cue says "${slowed.flightCue}", and the tip "${slowed.flightSaid}" (a click, not a touch)`);
  check(slowed.featherSaid === "The mouse button slows the line.", `the click on the lake says "${slowed.featherSaid}" (the mouse button, not a thumb)`);

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

  // ---- the fight words name the input the player used last: after a mouse press the mouse moves, after a key the keys.
  // The prompt, the guide (with MOUSE or KEYS) and the rod cue say the same ----
  const fw = await page.evaluate(async () => {
    const G = FISH.G, wait = window.__wait, out = {};
    const fish = (move) => ({ id: "walleye", kg: 2, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move, jump: 0, near: 0.5, known: true });
    const read = () => { const g = document.querySelector("#fishGuide"); return { h: document.querySelector("#prompt .p1 span").textContent, sub: document.querySelector("#prompt .p2").textContent, guide: g.hidden ? "" : g.querySelector(".guide-count").textContent + " " + g.querySelector(".guide-caption").textContent, cue: document.querySelector("#rodCue span").textContent }; };
    const say = async (patch, h) => {
      G.lastEvent = {}; G.hold = null; G.bail = "closed";
      G.sim = { fake: true, events: [], step() {}, state: Object.assign({ phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.3, slip: 0, dragN: 18, breakN: 45, lineOut: 20, slack: false, bend: 0.3, fish: fish("swim") }, patch) };
      if (G.phase !== "reel") FISH.enterReel();
      const t0 = performance.now();
      let f = 0;
      while (performance.now() - t0 < 8000) { if (!f && read().h === h) f = G.frame; if (f && G.frame >= f + 2) break; await wait(5); }
      return read();
    };
    window.__fire("pointerdown", 520, 420); window.__fire("pointerup", 520, 420);
    out.mouse = { strike: await say({ phase: "strike", fish: null }, "DRAG THE ROD UP FAST! Set the hook!"), jump: await say({ fish: fish("jump") }, "It jumped! Lower the rod!") };
    const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
    key("keydown", "KeyW"); key("keyup", "KeyW");
    out.keys = { strike: await say({ phase: "strike", fish: null }, "PRESS SPACE! Set the hook!"), jump: await say({ fish: fish("jump") }, "It jumped! Lower the rod!"),
      sulk: await say({ fish: fish("sulk") }, "It holds on the bottom."), cover: await say({ cover: { side: -1, steer: 1, kind: "stumps" } }, "It swims to the stumps!"), reel: await say({ phase: "retrieve", fish: null }, "Hold R to reel.") };
    // only a rod input picks the words. S held down (the key repeats) while the wheel turns the crank: the keys words stay
    // up in every frame. After a mouse press, Space, R and the wheel keep the mouse words
    const view = document.querySelector("#view") || document.body, wheel = () => view.dispatchEvent(new WheelEvent("wheel", { deltaY: 60, bubbles: true, cancelable: true }));
    const look = () => { const r = read(); return r.sub + " | " + r.guide + " | " + r.cue; };
    await say({ fish: fish("jump") }, "It jumped! Lower the rod!");
    key("keydown", "KeyS");
    const held = new Set(), f0 = G.frame, t0 = performance.now();
    while (G.frame < f0 + 10 && performance.now() - t0 < 15000) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyS", key: "KeyS", repeat: true, bubbles: true, cancelable: true }));
      wheel();
      await new Promise((r) => requestAnimationFrame(r));
      held.add(look());
    }
    key("keyup", "KeyS");
    window.__fire("pointerdown", 520, 420); window.__fire("pointerup", 520, 420);
    for (const code of ["Space", "KeyR"]) { key("keydown", code); key("keyup", code); }
    wheel();
    await say({ fish: fish("jump") }, "It jumped! Lower the rod!");
    out.mixed = { held: [...held], mouse: look() };
    // the loss line names the steer of the keys, as the fight does (last: the loss beat goes on to the next cast)
    key("keydown", "KeyA"); key("keyup", "KeyA");
    out.keys.lost = await say({ phase: "lost", reason: "weeds" }, "It wrapped the line in the weeds.");
    return out;
  });
  const same = (r, w, label) => !!r && r.cue === w && r.guide === label + " " + w;
  check(fw.mouse.strike.h === "DRAG THE ROD UP FAST! Set the hook!" && same(fw.mouse.strike, "Drag the rod up fast!", "MOUSE") && fw.mouse.jump.sub === "Drag the rod down." && same(fw.mouse.jump, "Drag the rod down.", "MOUSE"), `after a mouse press the fight words are the mouse's, with MOUSE (${JSON.stringify(fw.mouse)})`);
  check(fw.mixed.held.length === 1 && fw.mixed.held[0] === "Hold S. | KEYS Hold S. | Hold S." && fw.mixed.mouse === "Drag the rod down. | MOUSE Drag the rod down. | Drag the rod down.", `S held with the wheel keeps the keys words in every frame; after a mouse press, Space, R and the wheel keep the mouse words (${JSON.stringify(fw.mixed)})`);
  const K = fw.keys;
  check(K.strike.h === "PRESS SPACE! Set the hook!" && same(K.strike, "Press Space!", "KEYS") && K.jump.sub === "Hold S." && same(K.jump, "Hold S.", "KEYS") && K.sulk.sub === "Hold W. Then hold S and R." && same(K.sulk, K.sulk.sub, "KEYS") && K.cover.sub === "Hold D." && K.cover.cue === "Hold D." && K.reel.h === "Hold R to reel." && same(K.reel, "Hold R to reel.", "KEYS") && K.lost.sub === "Hold A or D to steer it.", `after a key press the fight words name the keys, with KEYS, and so does the loss line (${JSON.stringify(K)})`);
} catch (e) {
  check(false, "exception: " + (e && e.stack));
}
check(errors.length === 0, "no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
await browser.close();
console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
process.exit(fails.length ? 1 : 0);
