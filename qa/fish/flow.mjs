// The whole game on a phone, with motion, all with the phone upright: one press opens the bail and holds the line,
// tip back, whip and let go, crank (the first turn closes the bail), set the hook with a pull, fight, and land it.
// Then the two forgiving cases: a lift with no swing starts again, and a swing with the thumb still down casts low.
// Serve public/ first (cd public && python3 -m http.server 8765), then: node qa/fish/flow.mjs
// Exits with code 1 when something fails. Set SHOTS to a folder to save screenshots.
import { open, until, pointer, center, shot, sleep } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const { browser, page, errors } = await open({ query: "?debug" });

try {
  // a derby, with motion
  await page.click("#derbyBtn");
  await page.waitForSelector("#setup:not([hidden])");
  // the double-tap guard ignores a click in the first 300 ms of a screen that a tap just opened
  await sleep(400);
  await page.click("#useMotion");
  await until(page, () => window.FISH && FISH.G.phase === "cast" && FISH.G.input === "motion", null, 15000);
  check(true, "Use motion starts the derby with motion input");
  // the next fish is a perch that will bite, so the test does not depend on luck
  // (kg: a long cast can roll a perch too heavy to swing in, and this test wants a small fish it can land)
  await page.evaluate(() => { FISH.G.force = { species: "perch", kg: 0.35, bite: true }; });

  // hold the phone upright; give the camera time to settle at the dock
  await page.evaluate(() => __phone.pose(88));
  await sleep(1500);
  const th = await page.evaluate(() => FISH.Motion.pose.theta);
  check(Math.abs(th - 88) < 3, "upright phone reads θ ≈ 88 (got " + th.toFixed(1) + ")");
  check((await page.evaluate(() => FISH.G.rot)) === 0, "no CSS rotation while upright");
  await shot(page, "flow-1-ready");

  check((await page.evaluate(() => FISH.G.bail)) === "closed", "the bail starts closed");

  // a press with no swing: nothing flies, and the game is ready again with no fuss
  const rb = await center(page, "#reelBox");
  const px = rb.x + rb.w * 0.2, py = rb.y + rb.h * 0.25;
  await pointer(page, "pointerdown", px, py);
  await until(page, () => FISH.G.step === "pinned" && FISH.G.bail === "open", null, 5000).then(() => check(true, "one press opens the bail and holds the line"), () => check(false, "one press opens the bail and holds the line"));
  await sleep(300);
  await pointer(page, "pointerup", px, py);
  await until(page, () => FISH.G.step === "ready" && FISH.G.bail === "closed" && !FISH.G.cast, null, 5000).then(() => check(true, "a lift with no swing starts again (bail shut, no cast)"), () => check(false, "a lift with no swing starts again (bail shut, no cast)"));

  // the thumb holds the line again
  await pointer(page, "pointerdown", px, py);
  await until(page, () => FISH.G.step === "pinned", null, 5000).then(() => check(true, "a second press holds the line again"), () => check(false, "a second press holds the line again"));

  // tip back over the shoulder, whip forward, and lift the thumb at 11 o'clock. Done inside the page so the timing is exact
  const rel = await page.evaluate(async ({ px, py }) => {
    const P = window.__phone, el = document.elementFromPoint(px, py);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i <= 25; i++) { P.pose(88 + 42 * (i / 25)); await wait(16); }   // back to 130°
    await wait(250);
    const loaded = FISH.G.step;
    let released = null;
    const t0 = performance.now(), T = 170;
    while (true) {
      const k = Math.min(1, (performance.now() - t0) / T), th = 130 - 110 * (0.5 - 0.5 * Math.cos(Math.PI * k));
      P.pose(th);
      if (released == null && th <= 70) {
        released = th;
        el.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: px, clientY: py, bubbles: true }));
      }
      if (k >= 1) break;
      await wait(4);
    }
    await wait(200);
    P.pose(40);
    return { loaded, released };
  }, { px, py });
  check(rel.loaded === "loaded", "tipping back past 100° loads the rod (step " + rel.loaded + ")");
  await until(page, () => FISH.G.step === "flight" || FISH.G.step === "landed", null, 5000).catch(() => {});
  const cast = await page.evaluate(() => FISH.G.cast);
  check(!!cast, "letting go during the whip casts");
  if (cast) {
    console.log("     cast: v0 " + cast.v0.toFixed(1) + " m/s, pitch " + cast.pitch.toFixed(0) + "°, " + cast.verdict + ", " + cast.clock + ", power " + cast.power.toFixed(2));
    check(cast.verdict === "sweet" || cast.verdict === "low" || cast.verdict === "high", "an 11 o'clock release gives a good cast (" + cast.verdict + ")");
  }
  await shot(page, "flow-2-flight");
  await until(page, () => FISH.G.step === "landed" || FISH.G.step === "ashore", null, 90000);
  const land = await page.evaluate(() => ({ step: FISH.G.step, dist: FISH.G.landing && FISH.G.landing.dist }));
  check(land.step === "landed", "the lure lands in the water");
  check(land.dist > 15, "a firm whip casts past 15 m (got " + (land.dist || 0).toFixed(1) + " m)");

  // the reel starts at once, with the phone still upright: no turn, no rotation
  await until(page, () => FISH.G.phase === "reel", null, 3000).then(() => check(true, "the reel starts as soon as the lure lands"), () => check(false, "the reel starts as soon as the lure lands"));
  const rs = await page.evaluate(() => ({ rot: FISH.G.rot, layout: FISH.G.layout, mode: FISH.Motion.mode, bail: FISH.G.bail, crank: !document.querySelector("#reelUI").hidden }));
  check(rs.rot === 0 && rs.layout === "tall-reel" && rs.mode === "portrait", "the reel stays upright (" + JSON.stringify(rs) + ")");
  check(rs.crank, "the crank shows");
  await page.evaluate(() => __phone.pose(50));
  await sleep(400);
  const lth = await page.evaluate(() => FISH.Motion.pose.theta);
  check(Math.abs(lth - 50) < 4, "the upright phone tipped to 50° reads θ ≈ 50 (got " + lth.toFixed(1) + ")");
  await shot(page, "flow-3-reel");

  // crank until the fish strikes, then pull up to set the hook
  const cr = await center(page, "#crankBox");
  const hooked = await page.evaluate(async ({ cx, cy, R }) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const el = () => document.elementFromPoint(cx + R, cy) || document.body;
    const target = el();
    const ev = (type, a) => target.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: "touch", clientX: cx + R * Math.cos(a), clientY: cy + R * Math.sin(a), bubbles: true, buttons: type === "pointerup" ? 0 : 1 }));
    // the bail closes in the game frame where the crank first turns: count game frames, not test time (slow frames)
    let a = 0, closedBy = null, turnF = null, closeF = null;
    ev("pointerdown", a);
    const t0 = performance.now();
    let log = [], strikeAt = null;
    while (performance.now() - t0 < 60000) {
      const s = FISH.G.sim && FISH.G.sim.state;
      if (!s || FISH.G.phase !== "reel") break;
      if (s.phase === "strike") { strikeAt = performance.now(); break; }
      // turn at 1.2 rev/s, with a short pause every few seconds (fish like a pause)
      const pause = ((performance.now() - t0) % 4000) > 3300;
      if (!pause) a += 2 * Math.PI * 1.2 * 0.016;
      ev("pointermove", a);
      if (turnF == null && FISH.crank && FISH.crank.rate > 0.25) turnF = FISH.G.frame;
      if (closedBy == null && FISH.G.bail === "closed") { closedBy = +(a / (2 * Math.PI)).toFixed(2); closeF = FISH.G.frame; if (turnF == null) turnF = closeF; }
      if (log.length < 400) log.push(s.phase);
      await wait(16);
    }
    ev("pointerup", a);
    const closeFrames = closeF != null ? closeF - turnF : null;
    if (strikeAt == null) return { ok: false, phase: FISH.G.sim && FISH.G.sim.state.phase, g: FISH.G.phase, closedBy, closeFrames };
    await wait(220);
    // the hook set: a fast pull up, 50° → 95° in 110 ms
    const P = window.__phone, t1 = performance.now();
    while (performance.now() - t1 < 110) { P.pose(50 + 45 * ((performance.now() - t1) / 110)); await wait(8); }
    P.pose(95);
    // slow test frames: give the game a moment to see it
    const t2 = performance.now();
    while (performance.now() - t2 < 4000 && FISH.G.sim && FISH.G.sim.state.phase === "strike") await wait(20);
    return { ok: true, phase: FISH.G.sim && FISH.G.sim.state.phase, byPull: FISH.G.lastHook >= t1, closedBy, closeFrames };
  }, { cx: cr.x, cy: cr.y, R: Math.min(cr.w, cr.h) * 0.3 });
  check(hooked.closeFrames != null && hooked.closeFrames <= 1, "the first turn of the crank closes the bail (" + hooked.closeFrames + " game frames after the crank turned, at " + hooked.closedBy + " test turns)");
  check(hooked.ok, "cranking brings a strike (" + JSON.stringify(hooked) + ")");
  check((hooked.phase === "fight" || hooked.phase === "land" || hooked.phase === "caught") && hooked.byPull, "pulling the phone up sets the hook (" + hooked.phase + ", by the pull: " + hooked.byPull + ")");
  await shot(page, "flow-5-fight");

  // fight: pump and reel, stop cranking when the drag slips, rod low on a jump, lift to land
  const fight = await page.evaluate(async ({ cx, cy, R }) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const target = document.elementFromPoint(cx + R, cy) || document.body;
    const ev = (type, a) => target.dispatchEvent(new PointerEvent(type, { pointerId: 8, pointerType: "touch", clientX: cx + R * Math.cos(a), clientY: cy + R * Math.sin(a), bubbles: true, buttons: type === "pointerup" ? 0 : 1 }));
    const P = window.__phone;
    window.__trace = [];
    let a = 0, th = 90, down = false, t0 = performance.now(), maxT = 0;
    ev("pointerdown", a);
    while (performance.now() - t0 < 120000) {
      if (FISH.G.phase !== "reel") break;
      const s = FISH.G.sim.state, f = s.fish || {};
      maxT = Math.max(maxT, s.tfrac || 0);
      let crank = true;
      if (s.phase === "land") { th = Math.min(100, th + 3); crank = false; }
      else if (f.move === "jump") { th = 30; crank = false; }
      else if ((s.slip || 0) > 0.05 || (s.tfrac || 0) > 0.75) { th = Math.min(90, th + 1); crank = false; }
      else { if (!down) { th += 1.6; if (th >= 88) down = true; } else { th -= 1.1; if (th <= 45) down = false; } crank = down || (s.tfrac || 0) < 0.2; }
      P.pose(th);
      // turn by real time, so slow frames do not slow the crank
      const now = performance.now(), dts = Math.min(0.05, (now - (window.__lastCrank || now)) / 1000);
      window.__lastCrank = now;
      if (crank) a += 2 * Math.PI * 1.4 * dts;
      ev("pointermove", a);
      if (window.__trace && ((now - t0) % 3000) < 20) window.__trace.push({ t: +((now - t0) / 1000).toFixed(1), line: +(s.lineOut || 0).toFixed(1), d: f.x != null ? +Math.hypot(f.x, f.z).toFixed(1) : null, st: +(f.stamina || 0).toFixed(2), tf: +(s.tfrac || 0).toFixed(2), slip: +(s.slip || 0).toFixed(2), rate: +(FISH.crank ? FISH.crank.rate : -1).toFixed(2), move: f.move, th: Math.round(th) });
      await wait(16);
    }
    ev("pointerup", a);
    const s = FISH.G.sim && FISH.G.sim.state;
    return { phase: FISH.G.phase, sim: s && s.phase, reason: s && s.reason, secs: (performance.now() - t0) / 1000, maxT, trace: window.__trace };
  }, { cx: cr.x, cy: cr.y, R: Math.min(cr.w, cr.h) * 0.3 });
  const { trace, ...fsum } = fight;
  console.log("     fight: " + JSON.stringify(fsum));
  if (fight.phase !== "catch") for (const r of trace || []) console.log("       " + JSON.stringify(r));
  check(fight.phase === "catch", "good technique lands the perch");
  if (fight.phase === "catch") {
    await page.waitForSelector("#catch:not([hidden])");
    const name = await page.textContent("#cname");
    check(/Perch/.test(name), "the catch card shows the fish (" + name + ")");
    await shot(page, "flow-6-catch");
    const j = await page.evaluate(() => FISH.save.journal.perch);
    check(j && j.n === 1 && j.kg > 0, "the perch goes in the journal");
    await page.click("#catchGo");
    // next cast: straight back to the cast, still upright
    await page.evaluate(() => __phone.pose(88));
    await until(page, () => FISH.G.phase === "cast" && FISH.G.step === "ready", null, 5000).then(() => check(true, "after a catch the next cast is ready at once"), () => check(false, "after a catch the next cast is ready at once"));
    check((await page.evaluate(() => FISH.G.rot)) === 0, "still no rotation");

    // swing through with the thumb still down: it casts anyway, low, and says to lift sooner
    await sleep(600);
    await pointer(page, "pointerdown", px, py);
    await until(page, () => FISH.G.step === "pinned", null, 5000).catch(() => {});
    const thru = await page.evaluate(async () => {
      const P = window.__phone, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i <= 20; i++) { P.pose(88 + 32 * (i / 20)); await wait(16); }
      await wait(200);
      const t0 = performance.now();
      while (performance.now() - t0 < 200) { const k = (performance.now() - t0) / 200; P.pose(120 - 110 * (0.5 - 0.5 * Math.cos(Math.PI * k))); await wait(4); }
      P.pose(10);
      const t1 = performance.now();
      while (performance.now() - t1 < 3000 && FISH.G.step !== "flight" && FISH.G.step !== "landed" && FISH.G.phase === "cast") await wait(20);
      return { step: FISH.G.step, phase: FISH.G.phase, verdict: FISH.G.cast && FISH.G.cast.verdict };
    });
    await pointer(page, "pointerup", px, py);
    check((thru.step === "flight" || thru.step === "landed" || thru.phase === "reel") && (thru.verdict === "low" || thru.verdict === "slam"), "a swing with the thumb still down casts low (" + JSON.stringify(thru) + ")");
  }
} catch (e) {
  check(false, "exception: " + (e && e.message));
}
check(errors.length === 0, "no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
await browser.close();

// the screen lock: a derby asks for one lock (begin and startMode ask in the same tick), and pause and quit let it go
{
  const { browser, page, errors } = await open({ query: "?debug", save: { v: 1, input: "touch" } });
  try {
    // a wake lock that answers after 5 ms, and counts the requests and the locks still held
    await page.evaluate(() => {
      const w = (window.__wl = { req: 0, live: 0 });
      const stub = { request: async () => { w.req++; await new Promise((r) => setTimeout(r, 5)); w.live++; const lock = new EventTarget(); lock.release = async () => { w.live--; lock.dispatchEvent(new Event("release")); }; return lock; } };
      Object.defineProperty(navigator, "wakeLock", { value: stub, configurable: true });
    });
    const wl = async () => { await sleep(150); return page.evaluate(() => ({ ...window.__wl })); };
    await page.click("#derbyBtn");
    await until(page, () => FISH.G.phase === "cast", null, 30000);
    let w = await wl();
    check(w.req === 1 && w.live === 1, "a derby asks for one wake lock (asked " + w.req + ", held " + w.live + ")");
    await page.click("#pauseBtn");
    await page.waitForSelector("#pause:not([hidden])");
    w = await wl();
    check(w.live === 0, "pause lets the lock go (held " + w.live + ")");
    await sleep(400);
    await page.click("#resumeBtn");
    w = await wl();
    check(w.req === 2 && w.live === 1, "resume takes one lock again (asked " + w.req + ", held " + w.live + ")");
    await page.click("#pauseBtn");
    await page.waitForSelector("#pause:not([hidden])");
    await sleep(400);
    await page.click("#quitBtn");
    await page.waitForSelector("#title:not([hidden])");
    w = await wl();
    check(w.live === 0, "and quitting to the title leaves no lock held (held " + w.live + ")");
  } catch (e) {
    check(false, "exception in the wake lock part: " + (e && e.message));
  }
  check(errors.length === 0, "wake lock part: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}
console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
process.exit(fails.length ? 1 : 0);
