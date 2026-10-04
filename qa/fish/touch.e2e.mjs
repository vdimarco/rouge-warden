// The cast and the touch controls in the real page: node qa/fish/touch.e2e.mjs   (serve public/ first; FISH_URL sets the address)
// Touch play: a press anywhere waits for the drag (up and down takes the line where it pressed, sideways aims and the bail
// stays shut), the rod and the reel and the lake all start a cast, the release is graded at the finger however long it
// rested, a flick that carries on past the press point still casts far, "Sweet!" and a sound come at the release, the rail
// beside the finger, a cancelled touch, the aim line's preview and the near miss on the report, the crank on the left in
// a touch fight with the rod pad on the right, and a fling up on the open lake that sets the hook in a strike.
// Motion play: no back swing says to tip the phone back, and sensors that stop offer touch. A computer: a cast from the keys.
// Exits with code 1 when something fails. Set SHOTS to a folder to save screenshots.
import { open, until, center, shot, sleep } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const TOUCH = { v: 1, input: "touch" };

// In the page: gestures as a finger makes them, with exact timing (a slow software renderer would stretch CDP input).
// Each event goes to the element under the press point and bubbles, like a real touch.
function helpers() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__sfx = [];
  const sfx = FISH.Sound.sfx;
  FISH.Sound.sfx = (n, v) => { window.__sfx.push([n, performance.now()]); return sfx.call(FISH.Sound, n, v); };
  const fire = (el, type, x, y, id, kind = "touch") => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1 }));
  // press at (x, y), drag down by `down` px, rest, flick up to `up` px above the press point at pxs px/s, rest `gap` ms, lift
  window.__cast = async ({ x, y, down = 80, up = 60, pxs = 1500, gap = 0, id = 9, kind = "touch", cancel = false, watch = false }) => {
    const el = document.elementFromPoint(x, y) || document.body, out = { target: el.id || el.tagName };
    let rail = null;
    if (watch) {
      // the frame where the rod loads: is the rail's bead past LOAD in that same frame?
      rail = { seen: false, same: null };
      const poll = () => { if (rail.same != null) return; const r = document.querySelector("#castRail"); if (!r.hidden) rail.seen = true; if (FISH.G.step === "loaded") rail.same = r.classList.contains("loaded"); else requestAnimationFrame(poll); };
      requestAnimationFrame(poll);
    }
    fire(el, "pointerdown", x, y, id, kind); await wait(60);
    out.afterPress = FISH.G.step + "/" + FISH.G.bail;
    for (let i = 1; i <= 20; i++) { fire(el, "pointermove", x, y + (down * i) / 20, id, kind); await wait(12); }
    // rest at the bottom: long enough for a frame to see the rod past LOAD (a software renderer draws slowly)
    const rest = performance.now();
    do await wait(50); while (down > 40 && FISH.G.step !== "loaded" && performance.now() - rest < 3000);
    out.afterDrag = FISH.G.step + "/" + FISH.G.bail;
    if (cancel) { fire(el, "pointercancel", x, y + down, id, kind); await wait(50); out.toast = document.querySelector("#toast").textContent; return out; }
    const t0 = performance.now(), dur = ((down + up) / pxs) * 1000;
    let k = 0;
    while (k < 1) { k = Math.min(1, (performance.now() - t0) / dur); fire(el, "pointermove", x, y + down - (down + up) * k, id, kind); await wait(8); }
    out.finger = FISH.G.pin && FISH.G.pin.theta;
    const tl = performance.now();
    while (performance.now() - tl < gap) await wait(2);
    const sfxFrom = window.__sfx.length;
    fire(el, "pointerup", x, y - up, id, kind);
    const r = document.querySelector("#report");
    out.cue = !r.hidden && r.classList.contains("cue") ? r.querySelector(".verdict").textContent : "";
    const rel = window.__sfx.slice(sfxFrom), tr = rel.find((s) => s[0] === "release"), tu = rel.find((s) => s[0] === "ui");
    out.chime = !!(tr && tu && tu[1] - tr[1] < 50);
    const c = FISH.G.cast, lr = FISH.G.lastRelease;
    out.verdict = c ? c.verdict : null; out.release = lr ? lr.theta : null; out.step = FISH.G.step; out.yaw = c ? c.yaw : null;
    // fly the lure to the end (the game lands it on its next frame)
    if (FISH.G.flight) { const f = FISH.G.flight; let s, n = 0; do { s = f.step(1 / 60); n++; } while (!s.done && n < 3000); out.dist = Math.hypot(s.x, s.z); out.land = s.land; }
    if (rail) { await wait(30); out.railSeen = rail.seen; out.railLoad = rail.same; }
    return out;
  };
  // a drag sideways from (x, y)
  window.__side = async ({ x, y, dx = 120, id = 11 }) => {
    const el = document.elementFromPoint(x, y) || document.body, n0 = window.__sfx.length, yaw0 = FISH.G.aimYaw;
    fire(el, "pointerdown", x, y, id);
    for (let i = 1; i <= 12; i++) { fire(el, "pointermove", x + (dx * i) / 12, y + (i % 2), id); await wait(16); }
    fire(el, "pointerup", x + dx, y, id); await wait(50);
    return { yaw: FISH.G.aimYaw - yaw0, bail: FISH.G.bail, step: FISH.G.step, clack: window.__sfx.slice(n0).some((s) => s[0] === "bailOpen") };
  };
  // a fast fling up from (x, y): 90 px in 60 ms. Says whether the game asked for a hook set (G.hookReq, which the next
  // frame passes to the fish)
  window.__fling = async ({ x, y, id = 21 }) => {
    const el = document.elementFromPoint(x, y) || document.body;
    FISH.G.hookReq = false;
    fire(el, "pointerdown", x, y, id); await wait(30);
    for (let i = 1; i <= 6; i++) { fire(el, "pointermove", x, y - 15 * i, id); await wait(10); }
    fire(el, "pointerup", x, y - 90, id);
    const hook = FISH.G.hookReq;
    await wait(60);
    return { on: el.id || el.tagName, hook };
  };
  // a fight on a fake fish that records each hook set the game passes to it
  window.__fight = (phase) => {
    const G = FISH.G;
    window.__hooks = 0;
    G.lastEvent = {}; G.hold = null; G.bail = "closed"; G.hookReq = false;
    G.sim = { fake: true, events: [], step(dt, inp) { if (inp && inp.hookset) window.__hooks++; }, state: {
      phase, lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.3, slip: 0, dragN: 18, breakN: 45, lineOut: 20, slack: false, bend: 0.3, fish: null,
    } };
    if (G.phase !== "reel") FISH.enterReel();
  };
  // a cast that lands at (x, z), with no report hint from the clock (screens.mjs does the same)
  window.__land = (x, z) => {
    const G = FISH.G;
    FISH.newCast(); G.cast = null;
    G.step = "flight"; G.flight = { step: () => ({ x, y: 0, z, done: true, land: "water", lineOut: Math.hypot(x, z), spool: 0 }) };
  };
  // the boxes, in client px
  window.__rect = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  return true;
}
const overlap = (a, b) => !!(a && b) && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
async function startTouch(page) {
  await page.click("#freeBtn");
  await until(page, () => window.FISH && FISH.G.phase === "cast" && FISH.G.input === "touch", null, 30000);
  await page.evaluate(helpers);
  await sleep(1200);
}
// a new cast, once a frame has run (the frame hands the press over to the reel panel: a slow renderer can take a while)
async function fresh(page) {
  await page.evaluate(() => { FISH.newCast(); document.querySelector("#report").hidden = true; });
  await until(page, () => FISH.G.phase === "cast" && FISH.G.step === "ready" && FISH.reelPanel.s.grab === "lock", null, 10000);
  await sleep(200);
}

/* ================= A: touch play at 390x844 ================= */
{
  const { browser, page, errors } = await open({ touch: true, phone: false, save: TOUCH });
  try {
    await startTouch(page);
    const rb = await center(page, "#reelBox");
    const vw = 390, vh = 844;

    // a press alone takes nothing: the drag decides
    const press = await page.evaluate(async ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      el.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 3, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true, buttons: 1 }));
      await new Promise((r) => setTimeout(r, 300));
      const s = FISH.G.step + "/" + FISH.G.bail;
      el.dispatchEvent(new PointerEvent("pointerup", { pointerId: 3, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true }));
      await new Promise((r) => setTimeout(r, 60));
      return { held: s, after: FISH.G.step + "/" + FISH.G.bail, prompt: document.querySelector("#prompt .p1 span").textContent };
    }, rb);
    check(press.held === "ready/closed" && press.after === "ready/closed", `a press with no drag holds nothing and leaves the bail shut (${JSON.stringify(press)})`);

    // sideways on the lake aims, and the bail stays shut with no clack
    const side = await page.evaluate(() => window.__side({ x: 140, y: 560, dx: 120 }));
    check(side.yaw > 15 && side.bail === "closed" && side.step === "ready" && !side.clack, `a sideways drag on the lake turns the aim ${side.yaw.toFixed(1)}° and the bail stays shut, with no clack (${JSON.stringify(side)})`);
    await page.evaluate(() => { FISH.G.aimYaw = 0; });

    // the rod blank above the old box, the reel left of it, and the lower lake all start a cast
    for (const [name, x, y] of [["the rod blank, 120 px above the old box", rb.x, rb.y - 120], ["the reel, 30 px left of the old box", rb.x - 94, rb.y], ["the lower lake", 200, 600]]) {
      await fresh(page);
      const r = await page.evaluate((a) => window.__cast(a), { x, y, down: 80, up: 50, pxs: 1300 });
      check(r.afterDrag.startsWith("loaded/open") && r.dist > 0, `a press on ${name}, a drag down and a flick: the lure flies (${r.target}; ${r.afterDrag}, ${r.verdict}, ${(r.dist || 0).toFixed(1)} m)`);
    }

    // the same flick with 0 to 120 ms of rest before the lift: the same cast, graded at the finger
    const gaps = [];
    for (const gap of [0, 40, 80, 120]) {
      await fresh(page);
      gaps.push({ gap, ...(await page.evaluate((a) => window.__cast(a), { x: rb.x, y: rb.y, down: 80, up: 50, pxs: 1500, gap, watch: gap === 0 })) });
    }
    for (const g of gaps) console.log(`     gap ${String(g.gap).padStart(3)} ms: finger θ ${(g.finger || 0).toFixed(1)}, release θ ${(g.release || 0).toFixed(1)}, ${g.verdict}, ${(g.dist || 0).toFixed(1)} m`);
    check(gaps.every((g) => g.verdict && g.verdict === gaps[0].verdict), `the same flick gets the same verdict at every gap (${gaps.map((g) => g.verdict).join(", ")})`);
    check(gaps.every((g) => g.release != null && Math.abs(g.release - g.finger) <= 2), "the release angle stays within 2° of the finger's");
    check(gaps[0].railSeen && gaps[0].railLoad === true, `the rail shows beside the finger, and its bead is past LOAD in the frame the rod loads (${gaps[0].railSeen}, ${gaps[0].railLoad})`);
    const sw = gaps.find((g) => g.verdict === "sweet");
    check(!!sw && sw.cue === "Sweet!" && sw.chime, `a sweet release says "Sweet!" and plays a sound at once, before the lure lands (${sw ? JSON.stringify({ cue: sw.cue, chime: sw.chime }) : "no sweet cast"})`);
    await shot(page, "touch-1-cast");

    // the aim line runs out to where a cast like the last one lands
    await until(page, () => FISH.G.phase === "reel", null, 10000).catch(() => {});
    const last = gaps[gaps.length - 1];
    await page.evaluate(() => { FISH.G.aimYaw = 0; FISH.newCast(); });
    await until(page, () => !!FISH.G.aimTo, null, 8000).catch(() => {});
    const aim = await page.evaluate(() => FISH.G.aimTo && { d: Math.hypot(FISH.G.aimTo.x, FISH.G.aimTo.z), warn: FISH.G.aimTo.warn });
    check(!!aim && Math.abs(aim.d - last.dist) < 1.5 && !aim.warn, `the aim line shows how far a cast like the last one goes (${aim ? aim.d.toFixed(1) : "none"} m, the cast went ${last.dist.toFixed(1)} m)`);
    await shot(page, "touch-2-aim");

    // a flick that carries on past the press point still lands far out
    for (const [pxs, up] of [[1000, 30], [1500, 100], [2000, 130]]) {
      await fresh(page);
      const r = await page.evaluate((a) => window.__cast(a), { x: rb.x, y: rb.y, down: 80, up, pxs });
      check(r.land === "water" && r.dist >= 25, `a ${pxs} px/s flick that lifts ${up} px above the press point lands ${(r.dist || 0).toFixed(1)} m out (${r.verdict})`);
    }
    // ...and a lift below the press point grades high
    await fresh(page);
    const soon = await page.evaluate((a) => window.__cast(a), { x: rb.x, y: rb.y, down: 80, up: -30, pxs: 1200 });
    check(soon.verdict === "high", `a lift 30 px below the press point grades ${soon.verdict}`);

    // the browser takes the touch away (a system gesture, the screen still upright): the line slipped
    await fresh(page);
    const cx = await page.evaluate((a) => window.__cast(a), { x: rb.x, y: rb.y, cancel: true });
    check(cx.toast === "The line slipped. Try again." && (await page.evaluate(() => FISH.G.step)) === "ready", `a cancelled touch says "${cx.toast}" and the cast starts again`);

    // the report's line: a near miss says how far and which way; a cast on the ring says so
    const land = async (x, z) => {
      // one ring 38 m out ahead, one far off to the right; no new ones for now
      await page.evaluate(([x, z]) => {
        const R = FISH.rises;
        R.list = [{ x: 0, z: -38, gold: false, ttl: 60, pulse: 9, species: "perch" }, { x: 40, z: -12, gold: false, ttl: 60, pulse: 9, species: "perch" }];
        R.spawnT = 999;
        window.__land(x, z);
      }, [x, z]);
      await until(page, () => FISH.G.phase === "reel", null, 10000);
      return page.textContent("#report .zone");
    };
    let z = await land(0, -30);
    check(z === "8 m short of the ring.", `a cast 8 m short of a ring says "${z}"`);
    z = await land(0, -45);
    check(z === "7 m past the ring.", `a cast 7 m past it says "${z}"`);
    z = await land(8, -36);
    check(z === "8 m right of the ring.", `a cast 8 m to its right says "${z}"`);
    z = await land(2, -36);
    check(z === "Right on the rising fish!", `a cast on the ring says "${z}"`);

    // a touch fight: the crank on the left, the rod pad on the right, apart
    await page.evaluate(() => window.__fight("retrieve"));
    await sleep(500);
    const box = await page.evaluate(() => ({ pad: window.__rect("#padBox"), crank: window.__rect("#crankBox"), drag: window.__rect("#dragBar"), gauge: window.__rect("#gaugeBox") }));
    check(box.crank && box.pad && box.crank.x + box.crank.w / 2 < vw / 2 && box.pad.x + box.pad.w / 2 > vw / 2 && !overlap(box.pad, box.crank), `390x844 touch fight: the crank is on the left, the rod pad on the right, and they do not overlap (${JSON.stringify(box)})`);
    check(!overlap(box.crank, box.drag) && !overlap(box.crank, box.gauge), "and the crank clears the drag bar and the gauge");
    await shot(page, "touch-3-fight");

    // a fling up on the open lake sets the hook in a strike; not from the crank, and not during a nibble
    const spots = await page.evaluate(() => {
      const no = ["#padBox", "#crankBox", "#gaugeBox", "#dragBar", "#hud"].map(window.__rect).filter(Boolean);
      const W = innerWidth, H = innerHeight, out = [];
      for (const [fx, fy] of [[0.3, 0.55], [0.5, 0.62], [0.7, 0.4], [0.45, 0.45], [0.25, 0.42], [0.6, 0.7]]) {
        const p = { x: W * fx, y: H * fy };
        if (!no.some((r) => p.x > r.x - 10 && p.x < r.x + r.w + 10 && p.y > r.y - 10 && p.y < r.y + r.h + 10)) out.push(p);
      }
      return out.slice(0, 3);
    });
    let hooks = 0;
    await page.evaluate(() => window.__fight("strike"));
    await sleep(300);
    for (const p of spots) {
      const f = await page.evaluate((p) => window.__fling(p), p);
      if (f.hook) hooks++;
      else console.log("     (no hook set from " + JSON.stringify(p) + " on " + f.on + ")");
    }
    check(spots.length === 3 && hooks === 3, `a fling up on the open lake sets the hook during a strike (${hooks} of ${spots.length} spots)`);
    // ...and the fish gets it on the next frame
    await page.evaluate(() => { window.__hooks = 0; FISH.G.hookReq = true; });
    await until(page, () => window.__hooks > 0, null, 5000).then(() => check(true, "the hook set reaches the fish on the next frame"), () => check(false, "the hook set reaches the fish on the next frame"));
    const cr = await center(page, "#crankBox");
    const fc = await page.evaluate((p) => window.__fling(p), { x: cr.x, y: cr.y + 20 });
    check(!fc.hook, `a fling that starts on the crank does not (${fc.on})`);
    await page.evaluate(() => window.__fight("retrieve"));
    await sleep(300);
    const fn = await page.evaluate((p) => window.__fling(p), spots[0]);
    check(!fn.hook, "nor one during a nibble (the lure is still swimming)");

    // the settings say the reel side is for motion play
    await page.evaluate(() => { FISH.toTitle(); });
    await sleep(500);
    await page.click("#setBtn");
    const note = await page.textContent("#optReelSide >> xpath=.. >> small");
    check(/motion play/.test(note) && /left/.test(note), `the Reel side note says it is for motion play ("${note}")`);
  } catch (e) {
    check(false, "touch 390x844: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "touch 390x844: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= B: a small Android phone, 360x640; and the phone on its side, 844x390 ================= */
for (const [vw, vh] of [[360, 640], [844, 390]]) {
  const { browser, page, errors } = await open({ width: vw, height: vh, touch: true, phone: false, save: TOUCH });
  try {
    await startTouch(page);
    const rb = await center(page, "#reelBox");
    const r = await page.evaluate((a) => window.__cast(a), { x: rb.x, y: rb.y, down: 70, up: 40, pxs: 1300 });
    check(r.dist > 0, `${vw}x${vh}: a press on the reel, a drag down and a flick: the lure flies (${r.verdict}, ${(r.dist || 0).toFixed(1)} m)`);
    await page.evaluate(() => window.__fight("retrieve"));
    await sleep(500);
    const box = await page.evaluate(() => ({ pad: window.__rect("#padBox"), crank: window.__rect("#crankBox"), drag: window.__rect("#dragBar"), gauge: window.__rect("#gaugeBox") }));
    check(box.crank.x + box.crank.w / 2 < vw / 2 && box.pad.x + box.pad.w / 2 > vw / 2 && !overlap(box.pad, box.crank), `${vw}x${vh} touch fight: the crank on the left, the rod pad on the right, apart (${JSON.stringify({ pad: box.pad, crank: box.crank })})`);
    check(!overlap(box.crank, box.drag) && !overlap(box.crank, box.gauge) && !overlap(box.drag, box.gauge), `${vw}x${vh}: the crank, the drag bar and the gauge do not overlap (${JSON.stringify(box)})`);
    await shot(page, "touch-fight-" + vw + "x" + vh);
  } catch (e) {
    check(false, `${vw}x${vh}: exception: ` + (e && e.stack));
  }
  check(errors.length === 0, `${vw}x${vh}: no page errors` + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= C: motion play: no back swing, and sensors that stop ================= */
{
  const { browser, page, errors } = await open({ query: "?debug" });
  try {
    await page.click("#freeBtn");
    await page.waitForSelector("#setup:not([hidden])");
    await sleep(400);
    await page.click("#useMotion");
    await until(page, () => window.FISH && FISH.G.phase === "cast" && FISH.G.input === "motion", null, 30000);
    await page.evaluate(helpers);
    await page.evaluate(() => __phone.pose(88));
    await sleep(1500);
    // press, then whip forward from upright with no back swing, and lift at 11 o'clock
    const rb = await center(page, "#reelBox");
    const nb = await page.evaluate(async ({ x, y }) => {
      const P = window.__phone, el = document.elementFromPoint(x, y), wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const fire = (type) => el.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true, buttons: type === "pointerup" ? 0 : 1 }));
      fire("pointerdown"); await wait(300);
      const t0 = performance.now(), T = 160;
      let lifted = false;
      while (true) {
        const k = Math.min(1, (performance.now() - t0) / T), th = 88 - 68 * (0.5 - 0.5 * Math.cos(Math.PI * k));
        P.pose(th);
        if (!lifted && th <= 70) { lifted = true; fire("pointerup"); }
        if (k >= 1) break;
        await wait(4);
      }
      await wait(250);
      P.pose(88);
      return { verdict: FISH.G.cast && FISH.G.cast.verdict, stroke: FISH.G.cast && FISH.G.cast.stroke };
    }, rb);
    await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 30000).catch(() => {});
    const said = await page.textContent("#report .verdict");
    check(nb.verdict === "short" && said === "Tip the phone back first.", `a motion cast with no back swing says "${said}", not to swing faster (${JSON.stringify(nb)})`);

    // the sensors stop in the cast: after 3 s the game offers touch, and a tap switches to it
    await page.evaluate(() => { FISH.newCast(); });
    await sleep(600);
    await page.evaluate(() => { window.__phone.on = false; });
    const t0 = Date.now();
    const stalled = await until(page, () => document.querySelector("#prompt .p1 span").textContent === "The motion sensors stopped. Play with touch?", null, 8000).then(() => true, () => false);
    const p = await page.evaluate(() => document.querySelector("#prompt .p1 span").textContent);
    check(stalled && Date.now() - t0 >= 2500, `3 s with no motion sample in the cast: the prompt says "${p}" (after ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    await page.evaluate(() => window.__fling({ x: 200, y: 520, id: 31 }));
    await until(page, () => FISH.G.input === "touch", null, 3000).then(() => check(true, "a tap switches to touch play"), () => check(false, "a tap switches to touch play"));
    await sleep(400);
    const rb2 = await center(page, "#reelBox");
    const tc = await page.evaluate((a) => window.__cast(a), { x: rb2.x, y: rb2.y, down: 80, up: 50, pxs: 1400 });
    check(tc.dist > 0, `and a touch cast works after it (${tc.verdict}, ${(tc.dist || 0).toFixed(1)} m)`);
  } catch (e) {
    check(false, "motion: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "motion: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ================= D: a computer: cast from the keys ================= */
{
  const { browser, page, errors } = await open({ width: 1280, height: 720, touch: false, phone: false });
  try {
    await page.click("#freeBtn");
    await until(page, () => window.FISH && FISH.G.phase === "cast", null, 30000);
    await sleep(1200);
    await page.keyboard.down("ArrowRight");
    await sleep(500);
    await page.keyboard.up("ArrowRight");
    const yaw = await page.evaluate(() => FISH.G.aimYaw);
    check(yaw > 8, `the right arrow aims right (${yaw.toFixed(1)}°)`);
    await page.keyboard.down("Space");
    await sleep(700);
    await until(page, () => FISH.G.step === "loaded", null, 5000).catch(() => {});
    const held = await page.evaluate(() => FISH.G.step);
    await page.keyboard.up("Space");
    await sleep(100);
    const c = await page.evaluate(() => FISH.G.cast && { verdict: FISH.G.cast.verdict, yaw: FISH.G.cast.yaw, step: FISH.G.step });
    check(held === "loaded" && !!c && c.verdict === "sweet" && Math.abs(c.yaw - yaw) < 1, `holding Space tips the rod back (${held}), and letting go casts along the aim (${JSON.stringify(c)})`);
  } catch (e) {
    check(false, "keys: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "keys: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
process.exit(fails.length ? 1 : 0);
