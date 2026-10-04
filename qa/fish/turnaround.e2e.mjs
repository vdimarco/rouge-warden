// The time from the end of a cast to the next cast, in the real page: node qa/fish/turnaround.e2e.mjs
// (serve public/ first; FISH_URL sets the address). It prints each gap, and checks it:
// - an empty retrieve (nothing is coming): the lure skips home within a few seconds, and a fast crank brings it home faster.
//   Once "Nothing is biting here." shows, a slow crank from far out brings it home in about 3 s
// - "Nothing this time.": the next cast is ready about 1 s after the lure is home, and at once after a press past 350 ms
// - a cast onto the shore: ready in under 1.2 s, and at once after a press past 350 ms. Its report (what to fix in the
//   release) stays up over the new cast for its own time
// - a loss: the loss line keeps its time, a press in its first 800 ms does nothing, and a press after that ends it
// - the press that ends a beat goes on into the next cast: a held mouse button casts, Space casts, a finger's drag down
//   takes the line, and a motion press on the reel holds it. A tap that only ends the beat gets no tip
// - a press on a HUD button or on the drag bar does not end a beat; a derby keeps its rules (a skip uses up no cast, and the
//   last cast's beat ends in the results)
// - a player still working the reel when the beat starts (a fresh press on the crank, one more pump on the rod pad, a thumb
//   on the crank in motion play): the press may end the beat, but it throws no cast, holds no line and uses up no derby cast
// - the catch card: Space presses Cast again once the photo beat is done, and not during it
// The automatic waits are timed by the game's frames: a check allows the one frame that ended the wait (a software renderer
// on a busy machine can draw a frame a second). The retrieve times are game seconds. A fresh save, free fishing.
// Exits with code 1 when something fails.
import { open, until, sleep } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const gaps = [];
const note = (name, v, unit = "ms") => { gaps.push([name, v, unit]); return v; };
// unit "r": a wait the game ended in a frame (__ready): the time, and the gap before that frame it allows
const fmt = (v, unit = "ms") => (v == null ? "none" : unit === "r" ? fmtR(v) : unit === "s" ? v.toFixed(1) + " s" : Math.round(v) + " ms");
const fmtR = (r) => (r && r.ms != null ? Math.round(r.ms) + " ms" + (r.gap > 40 ? " (the frame before it came " + Math.round(r.gap) + " ms earlier)" : "") : "none");
const within = (r, lo, hi) => !!r && r.ms != null && r.ms >= lo && r.ms - r.gap < hi;
// a tip that a press which only ended the beat must not get
const TIP = /Hold Space until|Keep holding until|Drag down|Swing the phone|flick up and let go/i;

// In the page: staged ends of a cast, presses with exact timing, and a clock for the next cast
function helpers() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const G = FISH.G;
  window.__wait = wait;
  // the times the frames ran, and the moment the game made the next cast ready (G.step turned "ready": inside the frame or
  // the press, before that frame draws the new layout)
  const frames = (window.__frames = []);
  const rec = () => { frames.push(performance.now()); if (frames.length > 600) frames.splice(0, 300); requestAnimationFrame(rec); };
  requestAnimationFrame(rec);
  let step = G.step, readyAt = 0;
  Object.defineProperty(G, "step", { get: () => step, set: (v) => { if (v === "ready") readyAt = performance.now(); step = v; }, configurable: true, enumerable: true });
  // ms from t0 until the next cast is ready (phase cast, step ready; null if not), and the gap since the frame before: a
  // wait the game ends in a frame ends somewhere in that gap
  window.__ready = async (t0, limit = 9000) => {
    const ok = () => G.phase === "cast" && G.step === "ready";
    while (!ok() && performance.now() - t0 < limit) await wait(2);
    if (!ok()) return { ms: null, gap: 0 };
    let gap = 0;
    for (let i = frames.length - 1; i >= 0; i--) if (frames[i] < readyAt) { gap = readyAt - frames[i]; break; }
    return { ms: readyAt - t0, gap };
  };
  // a stand-in for the sim, in a state the reel reads on its next frame ("home", "lost", "caught"). Resolves to outcomeAt
  window.__stage = async (state) => {
    if (G.phase !== "reel") { FISH.newCast(); FISH.enterReel(); }
    G.lastEvent = {}; G.hold = null; G.bail = "closed"; G.thrownBy = "";
    G.sim = { fake: true, events: [], step() {}, state: Object.assign({ phase: "retrieve", lure: { x: 0, y: -0.2, z: -6, speed: 0 }, tfrac: 0, slip: 0, dragN: 18, breakN: 45, lineOut: 6, slack: false, bend: 0, fish: null }, state) };
    const t0 = performance.now();
    while (G.phase === "reel" && performance.now() - t0 < 8000) await wait(2);
    return G.outcomeAt;
  };
  // a cast that lands at (x, z) on the ground `land` ("water", "land"), as the flight would leave it. Resolves to the time
  // it landed (outcomeAt on the shore)
  window.__land = async (x, z, land = "water") => {
    FISH.newCast(); G.cast = null;
    G.step = "flight"; G.flight = { step: () => ({ x, y: 0, z, done: true, land, lineOut: Math.hypot(x, z), spool: 0 }) };
    const t0 = performance.now();
    while (G.step === "flight" && performance.now() - t0 < 8000) await wait(2);
    return land === "water" ? performance.now() : G.outcomeAt;
  };
  const fire = (type, x, y, kind, id) => {
    const el = document.elementFromPoint(x, y) || document.body;
    el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    return el;
  };
  window.__fire = fire;
  const key = (type, code = "Space") => window.dispatchEvent(new KeyboardEvent(type, { code, key: code === "Space" ? " " : code, bubbles: true, cancelable: true }));
  window.__key = key;
  // every toast from now on
  window.__toasts = [];
  const el = document.querySelector("#toast"), d = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  Object.defineProperty(el, "textContent", { get() { return d.get.call(this); }, set(v) { window.__toasts.push(v); d.set.call(this, v); }, configurable: true });
  // a press (mouse, touch or Space) `at` ms after t0, let go `hold` ms later. next: the press started the next cast at once
  // (it is ready, or Space holds the line); after: ms from the press until the cast is ready; toasts: what it said
  window.__press = async ({ t0, at, kind = "mouse", x = 300, y = 450, hold = 60, id = 1 }) => {
    while (performance.now() - t0 < at) await wait(1);
    const tp = performance.now(), n0 = window.__toasts.length, ready = () => G.phase === "cast" && G.step === "ready";
    // (what the press met, for a failure: the phase, how long the beat had been up, and the element under it)
    const was = { at: G.phase + "/" + G.step, ms: Math.round(tp - G.outcomeAt), paused: G.paused };
    if (kind === "key") key("keydown"); else was.on = fire("pointerdown", x, y, kind, id).id;
    const next = G.phase === "cast" && (G.step === "ready" || G.step === "pinned");
    let after = ready() ? performance.now() - tp : null;
    while (performance.now() - tp < hold) { if (after == null && ready()) after = performance.now() - tp; await wait(2); }
    if (kind === "key") key("keyup"); else fire("pointerup", x, y, kind, id);
    if (after == null) after = (await window.__ready(tp, 6000)).ms;
    await wait(150);
    return { next, after, toasts: window.__toasts.slice(n0), was };
  };
  return true;
}

/* ================= a computer: the mouse and Space ================= */
{
  const { browser, page, errors } = await open({ width: 1280, height: 800, touch: false, phone: false, save: { v: 1, quality: "low" } });
  try {
    await page.click("#freeBtn");
    await until(page, () => window.FISH && FISH.G.phase === "cast", null, 30000);
    await page.evaluate(helpers);
    await sleep(800);

    // ---- a real empty retrieve: a Space cast, then the R key held (1.6 turns a second) until the lure is home ----
    const real = await page.evaluate(async () => {
      const G = FISH.G, wait = window.__wait;
      G.force = { bite: false };
      let land = null;
      for (let i = 0; i < 4 && !land; i++) {
        FISH.newCast(); G.aimYaw = 0; document.querySelector("#report").hidden = true;
        await wait(300);
        window.__key("keydown");
        const t0 = G.pin && G.pin.key;
        while (G.pin && performance.now() - t0 < 780) await wait(1);
        window.__key("keyup");
        const t1 = performance.now();
        while (G.phase === "cast" && G.step !== "ashore" && performance.now() - t1 < 30000) await wait(5);
        if (G.phase === "reel") land = { t: performance.now(), dist: G.landing.dist };
      }
      if (!land) return null;
      window.__key("keydown", "KeyR");
      while (G.phase === "reel" && performance.now() - land.t < 120000) await wait(2);
      window.__key("keyup", "KeyR");
      const home = G.outcomeAt, game = G.sim && G.sim.state.t, said = document.querySelector("#prompt .p1 span").textContent;
      return { dist: land.dist, game, wall: home - land.t, said, ready: await window.__ready(home) };
    });
    if (check(!!real, "a Space cast lands in the water for the empty retrieve")) {
      console.log(`     a ${real.dist.toFixed(1)} m cast with nothing coming, the R key held: home after ${fmt(real.game, "s")} of game time (${fmt(real.wall)} here); "${real.said}"; ready ${fmtR(real.ready)} later`);
      note("empty retrieve, " + real.dist.toFixed(0) + " m cast, R held (1.6 turns/s), game time", real.game, "s");
      note("home to ready, no input (after that retrieve)", real.ready, "r");
      check(real.said === "Nothing this time.", `the lure comes home: "${real.said}"`);
      check(within(real.ready, 1000, 1300), `home to the next cast with no input: about 1 s (${fmtR(real.ready)})`);
    }

    // ---- a steady crank and a fast crank, from 30 m with nothing coming, and a slow crank from 53 m (game time; words: the
    // game time when "Nothing is biting here." showed) ----
    const crank = async (rps, dist = 30) => page.evaluate(async ([rps, dist]) => {
      const G = FISH.G, wait = window.__wait;
      G.force = { bite: false };
      Object.defineProperty(FISH.crank, "rate", { get: () => rps, configurable: true });
      const t0 = await window.__land(0, -dist);
      let words = null;
      while (G.phase === "reel" && performance.now() - t0 < 120000) {
        if (words == null && document.querySelector("#prompt .p1 span").textContent === "Nothing is biting here.") words = G.sim.state.t;
        await wait(2);
      }
      delete FISH.crank.rate;
      return G.phase === "lost" && G.sim ? { t: G.sim.state.t, words } : { t: null, words };
    }, [rps, dist]);
    const steady = note("empty retrieve, 30 m, crank 1.6 turns/s, game time", (await crank(1.6)).t, "s"), fast = note("empty retrieve, 30 m, crank 4 turns/s, game time", (await crank(4)).t, "s");
    console.log(`     30 m with nothing coming: home after ${fmt(steady, "s")} at 1.6 turns a second, ${fmt(fast, "s")} at 4 (game time)`);
    check(steady != null && steady < 6.5, `an empty retrieve at a steady crank comes home in under 6.5 s (${fmt(steady, "s")})`);
    check(fast != null && fast < 3.6 && fast < steady * 0.6, `a fast crank brings it home in under 3.6 s, sooner still (${fmt(fast, "s")})`);
    const far = await crank(1, 53), after = far.t != null && far.words != null ? far.t - far.words : null;
    note("empty retrieve, 53 m, 1 turn/s: the words to home, game time", after, "s");
    check(after != null && after < 4, `from 53 m at the guide's slow pace (1 turn a second), the lure is home ${fmt(after, "s")} after "Nothing is biting here." (under 4 s; ${JSON.stringify(far)})`);

    // ---- "Nothing this time.": no input, a press too soon, a press after 350 ms ----
    const home = (press) => page.evaluate(async (press) => { const t0 = await window.__stage({ phase: "home" }); return press ? window.__press({ t0, ...press }) : window.__ready(t0); }, press);
    let r = await home(null);
    note("home to ready, no input", r, "r");
    check(within(r, 1000, 1300), `"Nothing this time." to the next cast with no input: about 1 s (${fmtR(r)})`);
    r = await home({ at: 400, kind: "mouse", hold: 60 });
    note("home to ready, a mouse click at 400 ms (after the click)", r.after);
    check(r.next && r.after != null && r.after < 50 && !r.toasts.some((t) => TIP.test(t)), `a mouse click 400 ms in ends it at once: ready ${fmt(r.after)} after the click, and no tip (${JSON.stringify(r.toasts)})`);
    r = await home({ at: 150, kind: "mouse", hold: 40 });
    check(!r.next && r.after != null && r.after > 600, `a click in the first 350 ms does not end it (ready ${fmt(r.after)} after the click)`);
    r = await home({ at: 400, kind: "key", hold: 60 });
    note("home to ready, Space at 400 ms (after the press)", r.after);
    check(r.next && r.after != null && r.after < 150 && !r.toasts.some((t) => TIP.test(t)), `Space 400 ms in ends it at once and holds the line; a short tap gets no tip (${fmt(r.after)}, ${JSON.stringify(r.toasts)})`);

    // ---- a cast onto the shore ----
    const shore = (press) => page.evaluate(async (press) => { const t0 = await window.__land(0, 3, "land"); return press ? window.__press({ t0, ...press }) : window.__ready(t0); }, press);
    r = await shore(null);
    note("ashore to ready, no input", r, "r");
    check(within(r, 900, 1200), `a cast onto the shore to the next cast with no input: under 1.2 s (${fmtR(r)})`);
    r = await shore({ at: 400, kind: "mouse" });
    note("ashore to ready, a mouse click at 400 ms (after the click)", r.after);
    check(r.next && r.after != null && r.after < 50, `a click 400 ms after the shore ends it at once (${fmt(r.after)} after the click)`);
    // its report stays up over the new cast (a click 400 ms in starts it at once, whatever the frames do), and goes by itself
    // 2.6 s after the landing
    const rep = await page.evaluate(async () => {
      const wait = window.__wait, el = document.querySelector("#report");
      const t0 = await window.__land(0, 3, "land");
      const said = el.hidden ? "" : el.querySelector(".zone").textContent;
      while (performance.now() - t0 < 400) await wait(1);
      window.__fire("pointerdown", 300, 450, "mouse", 1);
      const ready = FISH.G.phase === "cast" && FISH.G.step === "ready", up = !el.hidden;
      window.__fire("pointerup", 300, 450, "mouse", 1);
      while (!el.hidden && performance.now() - t0 < 8000) await wait(10);
      return { said, ready, up, gone: el.hidden ? Math.round(performance.now() - t0) : null };
    });
    check(rep.said === "You cast onto the shore." && rep.ready && rep.up && rep.gone >= 2500 && rep.gone < 6000, `the shore cast's report stays up over the new cast, and goes ${rep.gone} ms after the landing (${JSON.stringify(rep)})`);

    // ---- a loss: the line keeps its time; a press after 800 ms ends it ----
    const FISHY = { id: "walleye", kg: 2, cm: 50, x: 0, y: -1, z: -14, heading: 0, len: 0.5, stamina: 0.6, move: "swim", jump: 0, near: 0.5, known: true };
    const loss = (press, fish = FISHY) => page.evaluate(async ([press, fish]) => { const t0 = await window.__stage({ phase: "lost", reason: "thrown", fish }); return press ? window.__press({ t0, ...press }) : window.__ready(t0); }, [press, fish]);
    r = await loss(null);
    note("loss to ready, no input", r, "r");
    check(within(r, 3400, 3800), `a loss keeps its line up: the next cast ${fmtR(r)} later with no input`);
    r = await loss(null, { ...FISHY, id: "golden", kg: 4.2 });
    note("legend loss to ready, no input", r, "r");
    check(within(r, 4500, 4900), `a legend's loss line stays longer (${fmtR(r)})`);
    r = await loss({ at: 500, kind: "mouse" });
    check(!r.next && r.after != null && r.after > 2400, `a click 500 ms into a loss does not end it (ready ${fmt(r.after)} after the click)`);
    r = await loss({ at: 900, kind: "mouse" });
    note("loss to ready, a mouse click at 900 ms (after the click)", r.after);
    check(r.next && r.after != null && r.after < 50, `a click 900 ms into a loss ends it at once (${fmt(r.after)} after the click; ${JSON.stringify(r.was)})`);

    // ---- the same press goes on into the next cast ----
    // a held mouse button: it ends the beat, the rod tips back by itself, and letting go in the green casts
    const flow = await page.evaluate(async () => {
      const G = FISH.G, wait = window.__wait;
      G.force = { bite: false };
      const t0 = await window.__stage({ phase: "home" });
      while (performance.now() - t0 < 400) await wait(1);
      window.__fire("pointerdown", 300, 450, "mouse", 1);
      const ready = G.phase === "cast" && G.step === "ready", tp = performance.now();
      while (!(G.pin && G.pin.key) && performance.now() - tp < 2000) await wait(1);
      const tk = G.pin && G.pin.key;
      // let go as the rod comes through the green band (780 ms into the hold, as Space)
      while (G.pin && performance.now() - tk < 780) await wait(1);
      const ms = Math.round(performance.now() - tk);
      window.__fire("pointerup", 300, 450, "mouse", 1);
      await wait(30);
      return { ready, held: !!tk, ms, step: G.step, verdict: G.cast && G.cast.verdict };
    });
    check(flow.ready && flow.held && flow.step === "flight" && (flow.verdict === "sweet" || Math.abs(flow.ms - 780) > 40), `the click that ends "Nothing this time.", held down, goes on into a hold cast, with no second press (${JSON.stringify(flow)})`);
    await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});
    // Space held: it ends a loss after 800 ms, and casts when it comes up in the green
    const sflow = await page.evaluate(async () => {
      const G = FISH.G, wait = window.__wait;
      const t0 = await window.__stage({ phase: "lost", reason: "snap", fish: { id: "perch", kg: 0.3, x: 0, y: -1, z: -12, len: 0.2 } });
      while (performance.now() - t0 < 900) await wait(1);
      window.__key("keydown");
      const pin = G.pin && G.pin.id, tk = G.pin && G.pin.key;
      while (G.pin && performance.now() - tk < 780) await wait(1);
      const ms = Math.round(performance.now() - tk);
      window.__key("keyup");
      await wait(30);
      return { pin, ms, step: G.step, verdict: G.cast && G.cast.verdict };
    });
    check(sflow.pin === "key" && sflow.step === "flight" && (sflow.verdict === "sweet" || Math.abs(sflow.ms - 780) > 40), `Space that ends a loss, held, goes on into the Space cast (${JSON.stringify(sflow)})`);
    await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});

    // ---- a press on a HUD button or on the drag bar is no cast input ----
    const btn = await page.evaluate(async () => {
      const G = FISH.G, wait = window.__wait, out = [];
      for (const sel of ["#pauseBtn", "#dragName"]) {
        const t0 = await window.__stage({ phase: "lost", reason: "snap", fish: { id: "perch", kg: 0.3, x: 0, y: -1, z: -12, len: 0.2 } });
        while (performance.now() - t0 < 900) await wait(1);
        const b = document.querySelector(sel).getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
        const el = window.__fire("pointerdown", x, y, "mouse", 1);
        out.push({ on: el.id, phase: G.phase });
        window.__fire("pointerup", x, y, "mouse", 1);
        await window.__ready(t0);
      }
      return out;
    });
    check(btn.length === 2 && btn.every((b) => b.phase === "lost"), `a press on a HUD button or on the drag bar does not end the beat (${JSON.stringify(btn)})`);

    // ---- a derby: a skip uses up no cast; the last cast's beat ends in the results ----
    const derby = await page.evaluate(async () => {
      const G = FISH.G, wait = window.__wait;
      FISH.startMode("derby");
      await wait(300);
      G.castsLeft = 6;
      let t0 = await window.__stage({ phase: "home" });
      const mid = await window.__press({ t0, at: 400, kind: "mouse" });
      const left = G.castsLeft;
      // the last cast is in the water: none left
      FISH.enterReel(); G.castsLeft = 0;
      t0 = await window.__stage({ phase: "home" });
      while (performance.now() - t0 < 400) await wait(1);
      window.__fire("pointerdown", 300, 450, "mouse", 1);
      const results = G.phase === "results" && !document.querySelector("#results").hidden;
      window.__fire("pointerup", 300, 450, "mouse", 1);
      await wait(100);
      return { mid: mid.after, left, results, still: !document.querySelector("#results").hidden };
    });
    check(derby.mid != null && derby.mid < 50 && derby.left === 6, `in a derby a click ends the beat and uses up no cast (${JSON.stringify(derby)})`);
    check(derby.results && derby.still, "a click in the last cast's beat goes to the derby results, and stays there");
    await page.evaluate(() => { FISH.startMode("free"); });
    await sleep(500);

    // ---- the catch card: Space presses Cast again, but not in the photo beat ----
    const card = (c) => page.evaluate(async (c) => {
      const G = FISH.G, wait = window.__wait;
      await window.__stage({ phase: "caught", catch: c });
      const t0 = performance.now(), out = {}, n0 = window.__toasts.length;
      while (document.querySelector("#catch").hidden && performance.now() - t0 < 8000) await wait(5);
      await wait(400);
      out.wait = G.cardWait;
      window.__key("keydown"); window.__key("keyup");
      await wait(60);
      out.early = G.phase;
      while (G.cardWait && performance.now() - t0 < 8000) await wait(5);
      await wait(100);
      if (G.phase === "catch") {
        const tk = performance.now();
        window.__key("keydown");
        out.pin = G.pin && G.pin.id;
        while (performance.now() - tk < 60) await wait(2);
        window.__key("keyup");
        await wait(60);
      }
      out.after = G.phase + "/" + G.step;
      out.toasts = window.__toasts.slice(n0);
      return out;
    }, c);
    let c = await card({ id: "perch", name: "Yellow Perch", kg: 0.3, cm: 26, junk: false });
    check(c.early === "cast" && c.after === "cast/ready" && !c.toasts.some((t) => TIP.test(t)), `the catch card: Space presses Cast again, and a short tap gets no tip (${JSON.stringify(c)})`);
    c = await card({ id: "perch", name: "Yellow Perch", kg: 0.6, cm: 34, junk: false });
    check(c.wait && c.early === "catch" && c.pin === "key" && c.after === "cast/ready", `a trophy's card: Space waits for the photo beat, then presses Cast again and holds the line (${JSON.stringify(c)})`);
  } catch (e) {
    check(false, "computer: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "computer: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= a phone with touch ================= */
{
  const { browser, page, errors } = await open({ touch: true, phone: false, save: { v: 1, input: "touch", quality: "low" } });
  try {
    await page.click("#freeBtn");
    await until(page, () => window.FISH && FISH.G.phase === "cast" && FISH.G.input === "touch", null, 30000);
    await page.evaluate(helpers);
    await sleep(800);
    // a tap ends "Nothing this time." and takes nothing
    const tap = await page.evaluate(async () => { const t0 = await window.__stage({ phase: "home" }); return window.__press({ t0, at: 400, kind: "touch", x: 200, y: 560, id: 5, hold: 50 }); });
    note("touch: home to ready, a tap at 400 ms (after the tap)", tap.after);
    check(tap.next && tap.after != null && tap.after < 50 && !tap.toasts.some((t) => TIP.test(t)), `a tap 400 ms in ends "Nothing this time." at once, and gets no tip (${JSON.stringify(tap)})`);
    // the press that ends a loss drags down and flicks: the lure flies, with no second press
    const drag = await page.evaluate(async () => {
      const G = FISH.G, wait = window.__wait, x = 200, y = 560, id = 6;
      const t0 = await window.__stage({ phase: "lost", reason: "thrown", fish: { id: "perch", kg: 0.3, x: 0, y: -1, z: -12, len: 0.2 } });
      while (performance.now() - t0 < 900) await wait(1);
      window.__fire("pointerdown", x, y, "touch", id);
      const ready = G.phase === "cast" && G.step === "ready";
      for (let i = 1; i <= 16; i++) { window.__fire("pointermove", x, y + 5 * i, "touch", id); await wait(12); }
      const tr = performance.now();
      while (G.step !== "loaded" && performance.now() - tr < 3000) await wait(20);
      const step = G.step, tf = performance.now();
      let k = 0;
      while (k < 1) { k = Math.min(1, (performance.now() - tf) / 90); window.__fire("pointermove", x, y + 80 - 130 * k, "touch", id); await wait(8); }
      window.__fire("pointerup", x, y - 50, "touch", id);
      await wait(30);
      return { ready, step, after: G.step, verdict: G.cast && G.cast.verdict };
    });
    check(drag.ready && drag.step === "loaded" && drag.after === "flight", `the finger that ends a loss drags down and flicks, and the lure flies (${JSON.stringify(drag)})`);
    await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});
    // a derby, and a player still working the reel controls when the beat starts: a fresh press on the crank 420 ms into
    // "Nothing this time.", then circles at 2 turns a second; one more pump on the rod pad 900 ms into a loss (down, then a
    // quick lift). Either press ends the beat, and neither throws a cast or uses one up
    const fight = await page.evaluate(async () => {
      const G = FISH.G, wait = window.__wait, out = {}, at = () => G.phase + "/" + G.step;
      FISH.startMode("derby");
      await wait(300);
      G.castsLeft = 5;
      let t0 = await window.__stage({ phase: "home" });
      let b = document.querySelector("#crankBox").getBoundingClientRect();
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2, R = Math.min(45, b.width / 3);
      while (performance.now() - t0 < 420) await wait(1);
      let casts = G.casts, on = window.__fire("pointerdown", cx + R, cy, "touch", 31);
      out.crank = { on: !!on.closest("#crankBox"), after: at() };
      const ts = performance.now();
      while (performance.now() - ts < 2500) { const a = ((performance.now() - ts) / 1000) * 4 * Math.PI; window.__fire("pointermove", cx + R * Math.cos(a), cy + R * Math.sin(a), "touch", 31); await wait(12); }
      window.__fire("pointerup", cx + R, cy, "touch", 31);
      await wait(300);
      Object.assign(out.crank, { end: at(), casts: G.casts - casts, left: G.castsLeft });
      G.castsLeft = 5;
      t0 = await window.__stage({ phase: "lost", reason: "snap", fish: { id: "perch", kg: 0.3, x: 0, y: -1, z: -12, len: 0.2 } });
      b = document.querySelector("#padBox").getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height * 0.4;
      while (performance.now() - t0 < 900) await wait(1);
      casts = G.casts; on = window.__fire("pointerdown", x, y, "touch", 41);
      out.pump = { on: !!on.closest("#padBox"), after: at() };
      for (let i = 1; i <= 12; i++) { window.__fire("pointermove", x, y + 7 * i, "touch", 41); await wait(14); }
      const tf = performance.now();
      let k = 0;
      while (k < 1) { k = Math.min(1, (performance.now() - tf) / 90); window.__fire("pointermove", x, y + 84 - 140 * k, "touch", 41); await wait(8); }
      window.__fire("pointerup", x, y - 56, "touch", 41);
      await wait(300);
      Object.assign(out.pump, { end: at(), casts: G.casts - casts, left: G.castsLeft });
      FISH.startMode("free");
      return out;
    });
    const still = (o) => !!o && o.on && o.after === "cast/ready" && o.end === "cast/ready" && o.casts === 0 && o.left === 5;
    check(still(fight.crank), `a derby: a fresh press on the crank 420 ms into "Nothing this time.", cranked in circles, ends the beat and throws no cast (${JSON.stringify(fight.crank)})`);
    check(still(fight.pump), `a derby: one more pump on the rod pad 900 ms into a loss ends the beat and throws no cast (${JSON.stringify(fight.pump)})`);
  } catch (e) {
    check(false, "touch: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "touch: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= a phone with motion ================= */
{
  const { browser, page, errors } = await open({ save: { v: 1, quality: "low" } });
  try {
    await page.click("#freeBtn");
    await page.waitForSelector("#setup:not([hidden])");
    await sleep(400);
    await page.click("#useMotion");
    await until(page, () => window.FISH && FISH.G.phase === "cast" && FISH.G.input === "motion", null, 30000);
    await page.evaluate(helpers);
    await page.evaluate(() => __phone.pose(88));
    await sleep(1200);
    // a thumb on the screen after 800 ms of a loss: the next cast, and the thumb holds the line at once
    const m = await page.evaluate(async () => {
      const G = FISH.G, wait = window.__wait;
      const t0 = await window.__stage({ phase: "lost", reason: "snap", fish: { id: "perch", kg: 0.3, x: 0, y: -1, z: -12, len: 0.2 } });
      while (performance.now() - t0 < 900) await wait(1);
      const n0 = window.__toasts.length;
      window.__fire("pointerdown", 200, 600, "touch", 7);
      const out = { phase: G.phase, step: G.step, bail: G.bail };
      await wait(200);
      window.__fire("pointerup", 200, 600, "touch", 7);
      const tu = performance.now();
      while (G.step !== "ready" && performance.now() - tu < 4000) await wait(10);
      await wait(100);
      out.after = G.step; out.toasts = window.__toasts.slice(n0);
      return out;
    });
    check(m.phase === "cast" && m.step === "pinned" && m.bail === "open", `motion: a thumb on the screen 900 ms into a loss starts the next cast and holds the line (${JSON.stringify(m)})`);
    check(m.after === "ready" && !m.toasts.some((t) => TIP.test(t)), `and lifting it with no swing starts again with no tip (${JSON.stringify(m.toasts)})`);
    // a thumb on the crank 900 ms into a loss: it ends the beat, but holds no line
    const mc = await page.evaluate(async () => {
      const G = FISH.G, wait = window.__wait;
      const t0 = await window.__stage({ phase: "lost", reason: "snap", fish: { id: "perch", kg: 0.3, x: 0, y: -1, z: -12, len: 0.2 } });
      const b = document.querySelector("#crankBox").getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
      while (performance.now() - t0 < 900) await wait(1);
      const on = window.__fire("pointerdown", x, y, "touch", 8);
      const out = { on: !!on.closest("#crankBox"), at: G.phase + "/" + G.step, bail: G.bail, pin: !!G.pin };
      await wait(300);
      out.later = { step: G.step, bail: G.bail, pin: !!G.pin };
      window.__fire("pointerup", x, y, "touch", 8);
      return out;
    });
    check(mc.on && mc.at === "cast/ready" && mc.bail === "closed" && !mc.pin && mc.later.step === "ready" && !mc.later.pin, `motion: a thumb on the crank 900 ms into a loss ends it, but holds no line (${JSON.stringify(mc)})`);
  } catch (e) {
    check(false, "motion: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "motion: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

console.log("\nthe gaps:");
for (const [name, v, unit] of gaps) console.log("  " + name.padEnd(68) + fmt(v, unit));
console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
process.exit(fails.length ? 1 : 0);
