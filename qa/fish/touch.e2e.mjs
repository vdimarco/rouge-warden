// The cast and the touch controls in the real page: node qa/fish/touch.e2e.mjs   (serve public/ first; FISH_URL sets the address)
// Touch play: a press anywhere waits for the drag (up and down takes the line where it pressed, sideways aims and the bail
// stays shut), a stray swipe up casts nothing, the rod and the reel and the lake all start a cast, the release is graded at
// the finger however long it rested, a flick that carries on past the press point still casts far (on a phone on its side
// too), "Sweet!" and a sound come at the release, the rail beside the finger (under the prompt, however high the press), a
// cancelled touch, the aim line's preview and the near miss on the report, the crank on the left in a touch fight with the
// rod pad on the right, and a fling up on the open lake that sets the hook in a strike.
// Motion play: no back swing says to tip the phone back, and sensors that stop offer touch within 2.5 to 4.5 s (the rod cue
// hides meanwhile, and the settings show touch after the switch). A computer: a Space cast graded by when Space comes up.
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
    out.railBox = window.__railBox();
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
    const rel = window.__sfx.slice(sfxFrom), tr = rel.find((s) => s[0] === "release"), tu = rel.find((s) => s[0] === "zing");
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
  // frame passes to the fish). The moves are spaced by a spin, not a timer: a busy page would stretch a timer and slow
  // the fling
  window.__fling = async ({ x, y, id = 21 }) => {
    const el = document.elementFromPoint(x, y) || document.body, spin = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
    FISH.G.hookReq = false;
    fire(el, "pointerdown", x, y, id); await wait(30);
    for (let i = 1; i <= 6; i++) { fire(el, "pointermove", x, y - 15 * i, id); spin(10); }
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
  // the rail (null when hidden), how much of its green band shows, and the boxes it must stay under
  window.__railBox = () => {
    const r = document.querySelector("#castRail"), band = r.querySelector(".band");
    return { rail: r.hidden ? null : window.__rect("#castRail"), band: band.hidden ? 0 : band.offsetHeight, go: !r.querySelector(".t-go").hidden,
      over: ["#hud", "#prompt .p1", "#prompt .p2"].map(window.__rect).filter((b) => b && b.h > 0) };
  };
  // the next toast after one that said `was` (the queue may hold it back behind another for a moment)
  window.__nextToast = async (was) => {
    const t = document.querySelector("#toast"), t0 = performance.now();
    while (t.textContent === was && performance.now() - t0 < 3000) await wait(20);
    return t.textContent;
  };
  // a quick swipe up from (x, y), with no drag down first: the stray swipe of a hand on the screen
  window.__swipeUp = async ({ x, y, up = 40, dx = 30, ms = 60, id = 13 }) => {
    const el = document.elementFromPoint(x, y) || document.body, n0 = window.__sfx.length, casts = FISH.G.casts, said = document.querySelector("#toast").textContent;
    fire(el, "pointerdown", x, y, id);
    for (let i = 1; i <= 5; i++) { await wait(ms / 5); fire(el, "pointermove", x + (dx * i) / 5, y - (up * i) / 5, id); }
    fire(el, "pointerup", x + dx, y - up, id); await wait(60);
    const out = { cast: FISH.G.casts - casts, step: FISH.G.step, bail: FISH.G.bail, opened: window.__sfx.slice(n0).some((s) => s[0] === "bailOpen") };
    out.toast = await window.__nextToast(said);
    return out;
  };
  // the boxes, in client px
  window.__rect = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  return true;
}
const overlap = (a, b) => !!(a && b) && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
// the rail of a press high on the screen: on the screen, clear of the HUD and the prompt (with the room its words take
// beside it), and still showing the green band
function railClear(rb, vh) {
  const r = rb && rb.rail;
  if (!r) return false;
  const words = { x: r.x - 90, y: r.y, w: r.w + 180, h: r.h };
  return r.y >= 0 && r.y + r.h <= vh && !rb.over.some((b) => overlap(words, b)) && rb.band >= 6;
}
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

    // a stray swipe up on the lake, with no drag down: nothing flies, no cast is used up, and the toast says what to do
    const stray = await page.evaluate(() => window.__swipeUp({ x: 160, y: 600 }));
    check(stray.cast === 0 && stray.step === "ready" && stray.bail === "closed" && stray.toast === "Drag down first.", `a stray swipe up casts nothing and says "${stray.toast}" (${JSON.stringify(stray)})`);
    await fresh(page);

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

    // a press high on the screen: the rail is cut short under the prompt, and its green band still shows
    await fresh(page);
    const hi = await page.evaluate((a) => window.__cast(a), { x: rb.x, y: 140, down: 80, up: 50, pxs: 1300 });
    check(railClear(hi.railBox, vh), `a press 140 px from the top: the rail stays on the screen, under the HUD and the prompt (${JSON.stringify(hi.railBox)})`);

    // the browser takes the touch away (a system gesture, the screen still upright): the line slipped
    // (no real rings for this check: a ring's one-time tip can take the toast first)
    await page.evaluate(() => { window.__spawn = FISH.rises.spawn; FISH.rises.list = []; FISH.rises.spawn = () => null; FISH.world.setRings([]); });
    await fresh(page);
    const cx = await page.evaluate((a) => window.__cast(a), { x: rb.x, y: rb.y, cancel: true });
    check(cx.toast === "The line slipped. Try again." && (await page.evaluate(() => FISH.G.step)) === "ready", `a cancelled touch says "${cx.toast}" and the cast starts again`);
    await page.evaluate(() => { FISH.rises.spawn = window.__spawn; });

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
    // the rod dragged up and held (a fish lifted out): the next reel starts with the rod at 55 degrees again
    const rod = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms)), pad = document.querySelector("#padBox"), b = pad.getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height * 0.9, ev = (type, yy) => pad.dispatchEvent(new PointerEvent(type, { pointerId: 17, pointerType: "touch", isPrimary: true, clientX: x, clientY: yy, bubbles: true, cancelable: true, buttons: type === "pointerup" ? 0 : 1 }));
      const start = FISH.rodPad.theta;
      ev("pointerdown", y);
      for (let i = 1; i <= 12; i++) { ev("pointermove", y - (220 * i) / 12); await wait(30); }
      ev("pointerup", y - 220);
      const lifted = FISH.rodPad.theta;
      FISH.newCast(); window.__fight("retrieve");
      await wait(100);
      return { start, lifted: Math.round(lifted), next: Math.round(FISH.rodPad.theta) };
    });
    check(rod.start === 55 && rod.lifted >= 100 && rod.next === 55, `a rod dragged up in one fight starts the next reel at 55 degrees (${JSON.stringify(rod)})`);

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
    // a new player (the guide is on) holds the line on the rod: the rail and its LOAD and LET GO words show, and the guide
    // gives way to them
    await fresh(page);
    const held = await page.evaluate(async ([x, y]) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms)), el = document.elementFromPoint(x, y) || document.body;
      const ev = (type, yy) => el.dispatchEvent(new PointerEvent(type, { pointerId: 19, pointerType: "touch", isPrimary: true, clientX: x, clientY: yy, bubbles: true, cancelable: true, buttons: type === "pointercancel" ? 0 : 1 }));
      ev("pointerdown", y);
      for (let i = 1; i <= 12; i++) { ev("pointermove", y + 5 * i); await wait(16); }
      const t0 = performance.now();
      while (FISH.G.step !== "loaded" && performance.now() - t0 < 3000) await wait(20);
      const f = FISH.G.frame;
      while (FISH.G.frame < f + 3 && performance.now() - t0 < 6000) await wait(10);
      const g = document.querySelector("#fishGuide"), words = [...document.querySelectorAll("#castRail span")].filter((s) => !s.hidden).map((s) => { const b = s.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
      const out = { step: FISH.G.step, rail: window.__rect("#castRail"), words, guide: g.hidden ? null : window.__rect("#fishGuide"), guideOn: document.querySelector("#guideToggle").getAttribute("aria-label") === "Hide the moves guide" };
      ev("pointercancel", y + 60);
      await wait(100);
      return out;
    }, [Math.round(vw * 0.72), Math.round(vh * 0.68)]);
    check(held.guideOn && !!held.rail && held.words.length === 2 && !overlap(held.guide, held.rail) && !held.words.some((w) => overlap(held.guide, w)), `${vw}x${vh}: a new player holds the line on the rod: the rail and its LOAD and LET GO words show, clear of the guide (${JSON.stringify(held)})`);
    // a flick that carries on 130 px past the press point, and a bigger one at 160 px: still far out on a short screen
    for (const [pxs, up] of [[1500, 130], [1800, 160]]) {
      await fresh(page);
      const o = await page.evaluate((a) => window.__cast(a), { x: rb.x, y: rb.y, down: 60, up, pxs });
      check(o.land === "water" && o.dist >= 25, `${vw}x${vh}: a ${pxs} px/s flick that lifts ${up} px above the press point lands ${(o.dist || 0).toFixed(1)} m out (${o.verdict})`);
    }
    await fresh(page);
    const hi = await page.evaluate((a) => window.__cast(a), { x: rb.x, y: 120, down: 60, up: 40, pxs: 1300 });
    check(railClear(hi.railBox, vh), `${vw}x${vh}: a press 120 px from the top: the rail stays on the screen, under the HUD and the prompt (${JSON.stringify(hi.railBox)})`);
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

    // the sensors stop in the cast: after 3 s the game offers touch, and a tap switches to it. Timed in the page, from the
    // last sample the phone sent (a slow frame may add a little)
    await page.evaluate(() => { FISH.newCast(); });
    await sleep(600);
    const st = await page.evaluate(async () => {
      const P = window.__phone, wait = (ms) => new Promise((r) => setTimeout(r, ms)), said = () => document.querySelector("#prompt .p1 span").textContent;
      const sent = P.sent;
      while (P.sent === sent) await wait(1);
      P.on = false;
      const t0 = performance.now();
      while (said() !== "The motion sensors stopped. Play with touch?" && performance.now() - t0 < 8000) await wait(10);
      return { s: (performance.now() - t0) / 1000, said: said(), cue: !document.querySelector("#rodCue").hidden };
    });
    check(st.said === "The motion sensors stopped. Play with touch?" && st.s >= 2.5 && st.s <= 4.5, `3 s with no motion sample in the cast: the prompt says "${st.said}" (after ${st.s.toFixed(1)} s)`);
    await sleep(300);
    check(await page.evaluate(() => document.querySelector("#rodCue").hidden), "while it asks, the rod cue is hidden (no \"Hold rod\" beside \"Tap the screen\")");
    await page.evaluate(() => window.__fling({ x: 200, y: 520, id: 31 }));
    await until(page, () => FISH.G.input === "touch", null, 3000).then(() => check(true, "a tap switches to touch play"), () => check(false, "a tap switches to touch play"));
    await sleep(400);
    const rb2 = await center(page, "#reelBox");
    const tc = await page.evaluate((a) => window.__cast(a), { x: rb2.x, y: rb2.y, down: 80, up: 50, pxs: 1400 });
    check(tc.dist > 0, `and a touch cast works after it (${tc.verdict}, ${(tc.dist || 0).toFixed(1)} m)`);
    // the sensors come back: the settings still show touch for this visit, so picking Motion turns them on again
    await page.evaluate(() => { window.__phone.on = true; });
    await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore" || FISH.G.step === "ready", null, 30000).catch(() => {});
    await page.click("#pauseBtn");
    await page.click("#pSet");
    const set = await page.evaluate(() => ({ input: FISH.G.input, select: document.querySelector("#optInput").value, note: document.querySelector("#inputNote").textContent }));
    check(set.input === "touch" && set.select === "touch" && /Motion/.test(set.note), `after the switch the settings show touch, and say how to go back (${JSON.stringify(set)})`);
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
    await page.evaluate(helpers);
    await sleep(1200);
    // held until the aim moves (a slow software renderer may draw no frame in half a second)
    await page.keyboard.down("ArrowRight");
    await sleep(500);
    await until(page, () => FISH.G.aimYaw > 8, null, 8000).catch(() => {});
    await page.keyboard.up("ArrowRight");
    const yaw = await page.evaluate(() => FISH.G.aimYaw);
    check(yaw > 8, `the right arrow aims right (${yaw.toFixed(1)}°)`);
    // Space held: the rod tips back, then swings forward by itself; Space coming up lets go there. Played inside the page
    // for the timing; a hold that a busy page stretched by more than 40 ms is tried again
    const hold = (ms) => page.evaluate(async ({ ms, yaw }) => {
      const wait = (m) => new Promise((r) => setTimeout(r, m)), key = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: "Space", key: " " }));
      // (a new cast faces ahead again: keep the aim)
      FISH.newCast(); FISH.G.aimYaw = yaw; document.querySelector("#report").hidden = true;
      await wait(400);
      const casts = FISH.G.casts, said = document.querySelector("#toast").textContent;
      key("keydown");
      const t0 = FISH.G.pin && FISH.G.pin.key;
      let rail = false;
      while (FISH.G.pin && performance.now() - t0 < ms) { if (!document.querySelector("#castRail").hidden) rail = true; await wait(1); }
      const held = performance.now() - t0;
      key("keyup");
      await wait(30);
      const c = FISH.G.casts > casts ? FISH.G.cast : null;
      const out = { held: Math.round(held), cast: c && c.verdict, yaw: c && c.yaw, cue: document.querySelector("#report.cue .verdict")?.textContent || "", rail };
      out.toast = c ? "" : await window.__nextToast(said);
      return out;
    }, { ms, yaw });
    const tryHold = async (ms) => { let r; for (let i = 0; i < 3; i++) { r = await hold(ms); if (Math.abs(r.held - ms) <= 40 || ms > 1100) break; console.log("     (the page was busy: " + JSON.stringify(r) + ")"); } return r; };
    const tap = await tryHold(250);
    check(!tap.cast && tap.toast === "Hold Space until the rod comes forward.", `a short tap of Space casts nothing and says "${tap.toast}" (${JSON.stringify(tap)})`);
    const soon = await tryHold(600);
    check(soon.cast === "high", `letting go as the rod starts forward is too soon: ${soon.cast} (${JSON.stringify(soon)})`);
    const good = await tryHold(780);
    check(good.cast === "sweet" && good.cue === "Sweet!" && Math.abs(good.yaw - yaw) < 1 && good.rail, `letting go as the rod comes through 11 o'clock is sweet, along the aim, with the rail beside the reel (${JSON.stringify(good)})`);
    const late = await tryHold(900);
    check(late.cast === "low", `letting go after it is too late: ${late.cast} (${JSON.stringify(late)})`);
    const end = await tryHold(1500);
    check(end.cast === "slam", `holding on to the end lets go there, late: ${end.cast} (${JSON.stringify(end)})`);
  } catch (e) {
    check(false, "keys: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "keys: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
process.exit(fails.length ? 1 : 0);
