// The cutscenes of Reel It In in the real page (public/fish/js/cutscenes.js and its call sites in main.js):
//   A. the opening on a fresh save's first "Go fishing", once; a skip by a tap, Space or Escape ends it within 0.3 s in its
//      end state, the camera on the dock at once; the fly-in at Stump Bay before the arrival card, once; "Watch" on the
//      Places card replays it and comes back
//   B. no cutscene in a fight; a legend's reveal after it, with the derby clock and the casts left held, and the camera back
//      on the dock as it ends; not twice; the hero shot of a legend landed before its card, once
//   C. the finale after the fourth legend (a double tap on the card does not skip it), and the Android back button (a
//      stubbed Capacitor bridge) skips
//   D. an old save with places open and a legend seen: no arrival, no reveal, no opening
//   E. calm effects and reduced motion: still shots joined by fades, the caption and the sound; a calm reveal hides the aim
//      and gives the camera back on the dock, by itself or skipped
//   F. the bars, the caption and the Skip hint at 390x844, 360x640, 844x390 and 1280x800, clear of the safe areas
//      (screenshots in SHOTS, or a new folder <tmp>/fish-cuts-XXXXXX for each run, to check by eye)
//   G. a desktop mouse held on the crank and let go over the hero shot lets go of the crank; the card keeps the key focus
//   H. a press held into a reveal casts nothing, under it or after it (a mouse let go in it or after it, a finger that drags
//      and flicks in it), and the derby casts left stay the same; Space on the beat or on the catch card plays the first
//      reveal in place of the cast, and Space held through it casts nothing; a legend hooked or landed marks its reveal seen
// Run: serve public/ (cd public && python3 -m http.server 8765), then node qa/fish/cutscenes.e2e.mjs (FISH_URL for another
// address; PARTS=A,E for some parts only). The script scripts themselves are checked in node by qa/fish/cutscenes.test.mjs.
import os from "os";
import fs from "fs";
import path from "path";
import { open, until, sleep } from "./lib.mjs";
import { CUTS } from "../../public/fish/js/save.js";

// PARTS=A,E runs only those parts
const PARTS = process.env.PARTS ? process.env.PARTS.split(",") : null, part = (p) => !PARTS || PARTS.includes(p);
// (a new folder for each run: two runs at the same time do not write over each other's screenshots)
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fish-cuts-"));
fs.mkdirSync(SHOTS, { recursive: true });
const fails = [];
let passes = 0;
const check = (ok, msg) => { if (ok) passes++; else fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const SEEN = Object.fromEntries(CUTS.map((k) => [k, 1]));
const except = (...ids) => Object.fromEntries(CUTS.filter((k) => !ids.includes(k)).map((k) => [k, 1]));

// in the page: every cutscene that starts ({ id, calm }), the time of each input and of each end, and every sound
async function watchCuts(page) {
  await page.evaluate(() => {
    const g = document.getElementById("game");
    window.__cuts = []; window.__sfx = []; window.__in = 0; window.__end = 0;
    new MutationObserver(() => {
      if (g.dataset.cut) { if (!window.__cuts.length || window.__cuts[window.__cuts.length - 1].end) window.__cuts.push({ id: FISH.cuts.id, calm: FISH.cuts.calm, end: 0 }); }
      else if (window.__cuts.length && !window.__cuts[window.__cuts.length - 1].end) { window.__end = performance.now(); window.__cuts[window.__cuts.length - 1].end = window.__end; }
    }).observe(g, { attributes: true, attributeFilter: ["data-cut"] });
    for (const t of ["pointerdown", "keydown"]) addEventListener(t, () => { window.__in = performance.now(); }, true);
    const S = FISH.Sound, sfx = S.sfx;
    S.sfx = function (n, v) { window.__sfx.push(n); return sfx.call(this, n, v); };
  });
}
const cutsSeen = (page) => page.evaluate(() => window.__cuts.map((c) => c.id));
const playing = (page) => page.evaluate(() => FISH.cuts.playing);
const state = (page) => page.evaluate(() => FISH.cuts.state);
// play the cutscene out now, through its own update (the frames would get there in a few seconds)
const ff = (page) => page.evaluate(() => { const C = FISH.cuts; for (let n = 0; C.playing && n < 1000; n++) C.update(0.05); });
const waitCut = (page, id, ms = 60000) => until(page, (id) => FISH.cuts.playing && FISH.cuts.id === id, id, ms);
const waitT = (page, t, ms = 60000) => until(page, (t) => FISH.cuts.playing && FISH.cuts.state.t >= t, t, ms);
// a skip: the time from the input to the end of the cutscene, as the page saw them
async function skipBy(page, how) {
  await page.evaluate(() => { window.__in = 0; window.__end = 0; });
  if (how === "tap") { const s = page.viewportSize(); await page.touchscreen.tap(s.width / 2, s.height / 2); }
  else if (how === "back") await page.evaluate(() => { window.__in = performance.now(); window.__cap.fire("backButton"); });
  // (a key's own listener would come after the game's, which takes every key while a cutscene plays: timed from the press)
  else { await page.evaluate(() => { window.__in = performance.now(); }); await page.keyboard.press(how); }
  // (a busy page can be slow to handle the input: the skip time comes from the page clock, not from this wait)
  await need(page, () => !FISH.cuts.playing, null, 30000, "a skip by " + how + " ends the cutscene");
  return page.evaluate(() => ({ ms: window.__end && window.__in ? window.__end - window.__in : null, playing: FISH.cuts.playing }));
}
const at = (page) => page.evaluate(() => ({ phase: FISH.G.phase, step: FISH.G.step, mode: FISH.G.mode, paused: FISH.G.paused, pin: !!FISH.G.pin, place: FISH.place.id, hud: !document.getElementById("hud").hidden, screen: document.body.dataset.screen || "" }));
// until, but a timeout fails with what the check waited for and the state of play then
async function need(page, fn, arg, ms, what) {
  try { return await until(page, fn, arg, ms); }
  catch (e) { throw new Error(`${what}: not so after ${ms / 1000} s (${JSON.stringify(await at(page).catch(() => null))}, cut ${JSON.stringify(await page.evaluate(() => FISH.cuts.id).catch(() => null))})`); }
}
// until the game has run n more frames, so that a read after it sees what play did in them (a fixed sleep can hold no
// frame at all on a slow software renderer)
async function frames(page, n = 2, ms = 60000) {
  const f = await page.evaluate((n) => FISH.G.frame + n, n);
  return need(page, (f) => FISH.G.frame >= f, f, ms, n + " more frames");
}
// The catch card when a tap can press its button: the photo beat is over, the weight has counted up, and nothing on the
// card moves (its 0.4 s slide up, the badges' stamp, the weight's pop). Then the middle of the button, read just before
// the tap, and whether that point is on the button. (Under load the slide can start late: read during it, the point is
// 36 px low, under the button)
async function cardButton(page, ms = 20000) {
  await need(page, () => {
    const card = document.querySelector("#catch .card");
    return !FISH.G.cardWait && !document.getElementById("catch").hidden && !!document.getElementById("ckg").dataset.kg && !card.getAnimations({ subtree: true }).some((a) => a.playState === "running" || a.pending);
  }, null, ms, "the catch card is still and ready for a tap");
  return page.evaluate(() => {
    const b = document.getElementById("catchGo"), r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { x, y, hit: b.contains(document.elementFromPoint(x, y)) };
  });
}
// the camera on the first frame drawn after the cutscene that plays now ends: how far it is from the eye on the stand.
// camAfter arms it while the cutscene plays; camRead waits for that frame
const camAfter = (page) => page.evaluate(() => {
  const W = FISH.world, r = W.render;
  window.__camAfter = null;
  W.render = function () {
    r.call(this);
    if (FISH.cuts.playing) return;
    const p = W.camera.position, e = FISH.place.stand.eye;
    window.__camAfter = +Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z).toFixed(3);
    W.render = r;
  };
});
const camRead = async (page) => { await need(page, () => window.__camAfter != null, null, 60000, "a frame drawn after the cutscene"); return page.evaluate(() => window.__camAfter); };
// how strong the aim line on the water is (0: not drawn)
const aimOn = (page) => page.evaluate(() => { let a = null; FISH.world.scene.traverse((o) => { const u = o.material && o.material.uniforms; if (u && u.uAim) a = u.uAim.value.z; }); return a; });

/* ---------- A. the opening, the skip, the fly-in and Watch ---------- */
if (part("A")) {
  const { browser, page, errors } = await open({ cuts: true, query: "?open" });
  try {
    await watchCuts(page);
    // the first "Go fishing": the motion or touch card, then the opening at Loon Lake at dawn
    await page.click("#freeBtn");
    await page.waitForSelector("#setup:not([hidden])");
    await sleep(350);
    await page.click("#useTouch");
    await waitCut(page, "open");
    const o = await page.evaluate(() => ({ phase: FISH.G.phase, hour: FISH.G.hour, cut: document.getElementById("game").dataset.cut, title: document.getElementById("title").hidden, hud: getComputedStyle(document.getElementById("hud")).visibility, prompt: getComputedStyle(document.getElementById("prompt")).visibility, bars: [...document.querySelectorAll("#cut .bar")].map((b) => Math.round(b.getBoundingClientRect().height)), seen: FISH.save.cuts.open, saved: JSON.parse(localStorage.getItem("fish.v1")).cuts.open }));
    check(o.phase === "title" && o.title && o.cut === "arrive" && o.hour > 5.5 && o.hour < 7 && o.bars.length === 2 && o.bars.every((h) => h >= 26), "Go fishing on a fresh save: the opening plays over the lake at dawn, with the title gone and the letterbox bars (" + JSON.stringify(o) + ")");
    check(o.seen === 1 && o.saved === 1, "the opening is marked seen in the save as it starts");
    await waitT(page, 1.4);
    const cap = await page.evaluate(() => ({ on: document.querySelector("#cut .cap").classList.contains("on"), text: document.querySelector("#cut .cap").innerText.replace(/\s+/g, " ").trim(), skip: document.querySelector("#cut .skip").textContent }));
    check(cap.on && cap.text === "Loon Lake The fish are rising." && cap.skip === "Tap to skip", "its caption names the place, and the hint says Tap to skip (" + JSON.stringify(cap) + ")");
    // it ends by itself, in the cast view, and the cast starts, with the camera on the dock on the first frame after it
    // (also when it ends in the last step of a slow frame: no flight home from the title view)
    await camAfter(page);
    const t0 = Date.now();
    await need(page, () => !FISH.cuts.playing, null, 120000, "the opening ends by itself");
    const end = await at(page), cam = await camRead(page);
    check(end.phase === "cast" && end.mode === "free" && end.hud && end.step === "ready" && cam != null && cam < 0.1, "it ends by itself and the cast starts, the camera on the dock on the first frame after it (" + JSON.stringify({ ...end, cam, waited: (Date.now() - t0) / 1000 }) + ")");
    const sfx = await page.evaluate(() => window.__sfx.slice());
    check(sfx.includes("swell") && sfx.includes("loonWail"), "its sound: the swell and the loon (" + sfx.join(" ") + ")");
    // once: the next Go fishing goes straight to the water
    await page.evaluate(() => FISH.toTitle());
    await sleep(400);
    await page.click("#freeBtn");
    await until(page, () => FISH.G.phase === "cast", null, 20000);
    check((await cutsSeen(page)).join() === "open", "the second Go fishing has no opening (" + (await cutsSeen(page)).join() + ")");

    // the skip: a tap, Space and Escape, 1 s into the opening, end it within 0.3 s, in the cast, with the press or the key used
    // up (no thumb on the line, no pause), and the camera on the dock on the first frame after (no flight home over the lake)
    for (const how of ["tap", "Space", "Escape"]) {
      await page.evaluate(() => { FISH.toTitle(); FISH.save.cuts = {}; });
      await sleep(400);
      await page.click("#freeBtn");
      await waitCut(page, "open");
      await waitT(page, 1);
      await camAfter(page);
      const r = await skipBy(page, how), a = await at(page), cam = await camRead(page);
      check(!r.playing && r.ms != null && r.ms <= 300 && a.phase === "cast" && a.step === "ready" && !a.pin && !a.paused && a.hud && cam != null && cam < 0.1, `${how === "tap" ? "A tap" : how} 1 s in skips the opening within 0.3 s and the cast starts, the camera on the dock at once (${JSON.stringify({ ...r, ...a, cam })})`);
    }

    // the fly-in: the first trip to Stump Bay plays it at the place's own hour, then the arrival card
    await page.evaluate(() => FISH.toTitle());
    await sleep(400);
    await page.click("#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    await sleep(400);
    await page.click('.pcard[data-place="stumps"] button');
    await waitCut(page, "arrive.stumps");
    await waitT(page, 0.9);
    const f = await page.evaluate(() => ({ place: FISH.place.id, hour: FISH.G.hour, travel: document.getElementById("travel").hidden, arrive: document.getElementById("arrive").hidden, cap: document.querySelector("#cut .cap b").textContent }));
    check(f.place === "stumps" && f.hour === 19 && f.travel && f.arrive && f.cap === "Stump Bay", "the first trip to Stump Bay: the travel card, then the fly-in at dusk with its name (" + JSON.stringify(f) + ")");
    await ff(page);
    await sleep(300);
    check(await page.isVisible("#arrive") && (await page.textContent("#aname")) === "Stump Bay", "after the fly-in, the arrival card");
    await sleep(400);
    await page.click("#aStart");
    await until(page, () => FISH.G.phase === "cast", null, 20000);
    // back to Loon Lake, and to Stump Bay a second time: no fly-in
    for (const id of ["loon", "stumps"]) {
      await page.evaluate(() => FISH.toTitle());
      await sleep(400);
      await page.click("#placesBtn");
      await page.waitForSelector("#places:not([hidden])");
      await sleep(400);
      await page.click(`.pcard[data-place="${id}"] button`);
      await until(page, (id) => FISH.place.id === id && !document.getElementById("title").hidden, id, 60000);
    }
    check((await cutsSeen(page)).filter((c) => c === "arrive.stumps").length === 1, "Stump Bay a second time: the fly-in does not play again (" + (await cutsSeen(page)).join() + ")");

    // Watch: the Stump Bay card replays its fly-in, from Loon Lake, and the Places card comes back
    await page.evaluate(() => FISH.setPlace("loon"));
    await until(page, () => FISH.place.id === "loon" && !document.getElementById("title").hidden, null, 60000);
    await sleep(400);
    await page.click("#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    const w = await page.evaluate(() => [...document.querySelectorAll("#plist .pcard")].map((c) => c.dataset.place + ":" + [...c.querySelectorAll("button")].map((b) => b.textContent).join("+")));
    check(w.join() === "loon:You are here+Watch,stumps:Fish here+Watch,river:Fish here,sea:Fish here", "Watch shows on the cards whose cutscenes were seen (" + w.join(" | ") + ")");
    const before = await page.evaluate(() => JSON.stringify(FISH.save.cuts));
    await sleep(400);
    await page.click('.pcard[data-place="stumps"] button.watch');
    await waitCut(page, "arrive.stumps");
    check((await page.evaluate(() => FISH.place.id)) === "stumps", "Watch on the Stump Bay card goes there and plays its fly-in");
    await waitT(page, 1);
    await ff(page);
    await until(page, () => !document.getElementById("places").hidden, null, 60000);
    const back = await page.evaluate(() => ({ place: FISH.place.id, places: !document.getElementById("places").hidden, title: !document.getElementById("title").hidden, phase: FISH.G.phase, cuts: JSON.stringify(FISH.save.cuts), hour: FISH.G.hour }));
    check(back.place === "loon" && back.places && back.phase === "title" && back.cuts === before && back.hour > 6 && back.hour < 6.5, "after it, Loon Lake again and the Places card, the save as it was (" + JSON.stringify(back) + ")");
    // a skip ends a replay too, and Close still goes to the title
    await sleep(400);
    await page.click('.pcard[data-place="loon"] button.watch');
    await waitCut(page, "open");
    await waitT(page, 0.6);
    const sk = await skipBy(page, "tap");
    await until(page, () => !document.getElementById("places").hidden, null, 30000);
    check(!sk.playing && sk.ms <= 300, "a tap skips the replay of the opening, and the Places card is back (" + JSON.stringify(sk) + ")");
    await sleep(500);
    await page.click("#places [data-close]");
    check(await page.isVisible("#title"), "Close on the Places card still goes to the title");
  } catch (e) { check(false, "exception in part A: " + (e && e.stack)); }
  check(errors.length === 0, "part A: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- B. the fight, the derby, the reveal and the hero shot ---------- */
const stageFight = (page) => page.evaluate(() => {
  const G = FISH.G;
  G.sim = { fake: true, events: [], step() {}, state: { phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.3, slip: 0, dragN: 18, breakN: 45, lineOut: 20, slack: false, bend: 0.3,
    fish: { id: "walleye", kg: 2, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move: "swim", jump: 0, near: 0.5, known: true } } };
  G.bail = "closed";
  FISH.enterReel();
});
const landFish = (page, c) => page.evaluate((c) => {
  const G = FISH.G;
  G.sim = { fake: true, events: [], step() {}, state: { phase: "caught", catch: c, lure: { x: 0, y: -0.2, z: -6, speed: 0 }, fish: null } };
  if (G.phase !== "reel") FISH.enterReel();
}, c);
const goldRing = (page, x, z) => page.evaluate(([x, z]) => { FISH.rises.list = FISH.rises.list.filter((g) => !g.gold); FISH.rises.list.push({ x, z, ttl: 90, species: "golden", gold: true, pulse: 0.2 }); }, [x, z]);
if (part("B")) {
  const save = { v: 1, casts: 24, caught: 3, input: "touch", journal: { perch: { n: 3, kg: 0.4, cm: 26 } }, cuts: except("reveal.loon", "landed.loon") };
  const { browser, page, errors } = await open({ cuts: true, save });
  try {
    await watchCuts(page);
    await page.evaluate(() => { window.__toasts = []; const t = document.getElementById("toast"); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
    // a derby at golden hour; a fight starts, and the legend's gold ring rises in the middle of it: no cutscene
    // (no gold ring of its own: the test raises them)
    await page.evaluate(() => { FISH.startMode("derby"); const R = FISH.rises, sp = R.spawn.bind(R); R.spawn = () => { const g = sp(); return g && g.gold ? null : g; }; });
    await until(page, () => FISH.G.phase === "cast", null, 20000);
    await stageFight(page);
    await goldRing(page, 6, -44);
    // (the ring rises in the fight, and play goes on for some frames after it)
    await need(page, () => FISH.rises.list.some((g) => g.gold && g.pulse > 1), null, 60000, "the gold ring rises in the fight");
    await frames(page, 3);
    check((await cutsSeen(page)).length === 0 && (await page.evaluate(() => FISH.G.phase)) === "reel", "a gold ring in a fight starts no cutscene (" + (await cutsSeen(page)).join() + ")");
    // the fight ends: back in the cast, the reveal plays before the next cast, and holds the derby
    await page.evaluate(() => {
      const C = FISH.cuts, u = C.update, G = FISH.G;
      window.__before = window.__after = null; window.__hours = [];
      C.update = function (dt) {
        if (!window.__before) window.__before = { hour: G.hour, left: G.castsLeft, casts: G.casts };
        u.call(this, dt);
        if (C.playing) window.__hours.push(G.hour);
        else if (!window.__after) window.__after = { hour: G.hour, left: G.castsLeft, casts: G.casts };
      };
      FISH.G.sim = null; FISH.newCast();
    });
    await waitCut(page, "reveal.loon", 30000);
    await camAfter(page);
    const r0 = await page.evaluate(() => ({ phase: FISH.G.phase, step: FISH.G.step, prompt: getComputedStyle(document.getElementById("prompt")).visibility, hud: getComputedStyle(document.getElementById("hud")).visibility }));
    check(r0.phase === "cast" && r0.step === "ready" && r0.prompt === "hidden" && r0.hud === "hidden", "after the fight, in the cast: the reveal, the HUD and the prompt hidden (" + JSON.stringify(r0) + ")");
    // the legend breaches in its ring, and its name shows
    await waitT(page, 3.3);
    const fish = await page.evaluate(() => { let m = null; FISH.world.scene.traverse((o) => { if (o.visible && o.userData && o.userData.id === "golden" && o.parent === FISH.world.scene) m = { x: o.position.x, y: o.position.y, z: o.position.z }; }); return m; });
    const cap3 = await page.evaluate(() => document.querySelector("#cut .cap b").textContent);
    check(!!fish && Math.hypot(fish.x - 6, fish.z + 44) < 1.5 && fish.y > 0 && cap3 === "Golden Loon Bass", "the legend leaps out of its ring, and the Golden Loon Bass is named (" + JSON.stringify({ fish, cap3 }) + ")");
    await until(page, () => !FISH.cuts.playing, null, 90000);
    const camEnd = await camRead(page);
    await sleep(200);
    const d = await page.evaluate(() => ({ before: window.__before, after: window.__after, hours: [...new Set(window.__hours)], phase: FISH.G.phase, step: FISH.G.step, fishLeft: (() => { let n = 0; FISH.world.scene.traverse((o) => { if (o.visible && o.userData && o.userData.id === "golden" && o.parent === FISH.world.scene) n++; }); return n; })() }));
    check(!!d.before && !!d.after && d.after.hour === d.before.hour && d.after.left === d.before.left && d.after.casts === d.before.casts && d.hours.length <= 1, "the derby clock and the casts left are the same after the reveal as before it (" + JSON.stringify(d) + ")");
    check(d.phase === "cast" && d.step === "ready" && d.fishLeft === 0, "play goes on from the same cast state, with no fish left in the air");
    check(camEnd != null && camEnd < 0.1, "the reveal ends through black with the camera back on the dock on the first frame, not 30 m out on the lake (" + camEnd + " m)");
    const toasts = await page.evaluate(() => window.__toasts.slice());
    check(!toasts.some((t) => /gold ring/.test(t)), "the ring that played its reveal has no toast (" + toasts.join(" | ") + ")");
    // once: the next gold ring has its toast and no reveal
    await goldRing(page, -10, -46);
    await need(page, () => window.__toasts.some((t) => /gold ring/.test(t)), null, 60000, "the second gold ring has its toast");
    check((await cutsSeen(page)).join() === "reveal.loon" && (await page.evaluate(() => window.__toasts.some((t) => /gold ring/.test(t)))), "a second gold ring has the toast and no reveal (" + (await cutsSeen(page)).join() + ")");

    // the legend landed: the hero shot, with its name and weight, before the card; a tap skips to the card
    await page.evaluate(() => { window.__toasts = []; });
    await landFish(page, { id: "golden", kg: 4.6, cm: 58 });
    await waitCut(page, "landed.loon", 30000);
    await waitT(page, 0.6);
    const h = await page.evaluate(() => ({ phase: FISH.G.phase, wait: FISH.G.cardWait, card: document.getElementById("catch").classList.contains("wait"), cap: document.querySelector("#cut .cap").innerText.replace(/\s+/g, " ").trim(), toast: document.getElementById("toast").classList.contains("on") }));
    check(h.phase === "catch" && h.wait && h.card && h.cap === "Golden Loon Bass 4.6 kg" && !h.toast, "landing the legend: the hero shot names it and its weight, and the card and the news wait (" + JSON.stringify(h) + ")");
    await waitT(page, 1);
    const hs = await skipBy(page, "tap");
    await need(page, () => !FISH.G.cardWait, null, 30000, "the card comes after the hero shot");
    const card = await page.evaluate(() => ({ wait: FISH.G.cardWait, shown: !document.getElementById("catch").hidden && !document.getElementById("catch").classList.contains("wait"), name: document.getElementById("cname").textContent }));
    check(!hs.playing && hs.ms <= 300 && !card.wait && card.shown && card.name === "Golden Loon Bass", "a tap skips the hero shot within 0.3 s, and the card comes (" + JSON.stringify({ ...hs, ...card }) + ")");
    // (a toast that waited in line, the gold ring's, may show first)
    await need(page, () => { const t = document.getElementById("toast"); return t.classList.contains("on") && /Your first fish today\./.test(t.textContent); }, null, 60000, "the catch's news shows over the card");
    const news = await page.evaluate(() => ({ text: document.getElementById("toast").textContent, on: document.getElementById("toast").classList.contains("on") }));
    check(news.on && /Your first fish today\./.test(news.text), "the catch's news, held while the hero shot played, shows over the card (" + JSON.stringify(news) + ")");
    await sleep(500);
    await page.click("#catchGo");
    await until(page, () => FISH.G.phase === "cast" || FISH.G.phase === "results", null, 20000);
    // once: the next Golden Loon Bass has the photo beat alone
    await landFish(page, { id: "golden", kg: 4.9, cm: 60 });
    await until(page, () => FISH.G.phase === "catch", null, 20000);
    await until(page, () => !FISH.G.cardWait, null, 20000);
    check((await cutsSeen(page)).filter((c) => c === "landed.loon").length === 1, "the same legend landed again: no hero shot (" + (await cutsSeen(page)).join() + ")");
  } catch (e) { check(false, "exception in part B: " + (e && e.stack)); }
  check(errors.length === 0, "part B: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- C. the finale, and the Android back button ---------- */
function capStub() {
  const log = (window.__cap = { calls: [], on: {} });
  const rec = (name) => () => { log.calls.push(name); return Promise.resolve(); };
  log.fire = (ev) => (log.on[ev] || []).forEach((f) => f({}));
  const Plugins = {
    App: { addListener(ev, fn) { (log.on[ev] = log.on[ev] || []).push(fn); return Promise.resolve({ remove() {} }); }, minimizeApp: rec("App.minimizeApp") },
    SplashScreen: { hide: rec("SplashScreen.hide") }, StatusBar: { hide: rec("StatusBar.hide") },
    KeepAwake: { keepAwake: rec("KeepAwake.keepAwake"), allowSleep: rec("KeepAwake.allowSleep") },
    Preferences: { get: () => Promise.resolve({ value: null }), set: () => Promise.resolve() },
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", isPluginAvailable: (n) => n in Plugins, Plugins };
}
if (part("C")) {
  const save = { v: 1, casts: 300, caught: 60, input: "touch", journal: { whiskers: { n: 1, kg: 20, cm: 120 }, hookjaw: { n: 1, kg: 24, cm: 122 }, bigblue: { n: 1, kg: 80, cm: 180 } },
    places: { loon: { open: 1, lg: 2 }, stumps: { open: 1, lg: 3 }, river: { open: 1, lg: 3 }, sea: { open: 1, lg: 3 } }, cuts: except("landed.loon", "finale") };
  const { browser, page, errors } = await open({ cuts: true, save });
  try {
    // (the bridge goes in before the game's scripts: a page with the stub)
    await page.addInitScript(capStub);
    await page.reload();
    await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
    check(await page.evaluate(() => document.documentElement.dataset.build === "store" && !!window.__cap.on.backButton), "the stubbed app bridge is in, and the game listens for back");
    await watchCuts(page);
    await page.evaluate(() => FISH.startMode("free"));
    await until(page, () => FISH.G.phase === "cast", null, 20000);
    // the fourth legend: the hero shot (back skips it), the card, then the finale after the card's button
    await landFish(page, { id: "golden", kg: 4.2, cm: 56 });
    await waitCut(page, "landed.loon", 30000);
    await waitT(page, 1);
    const b1 = await skipBy(page, "back");
    await need(page, () => !FISH.G.cardWait, null, 30000, "the card comes after the hero shot");
    const c1 = await at(page);
    check(!b1.playing && b1.ms != null && b1.ms <= 300 && c1.phase === "catch" && !c1.paused, "the back button skips the hero shot within 0.3 s, to the card, with no pause (" + JSON.stringify({ ...b1, ...c1 }) + ")");
    // a quick double tap on the card's button: the first tap plays the finale, and the second, in its first moment, does not
    // skip it (it plays once). Both taps go to the point where the button is when the card is still
    const go = await cardButton(page);
    await page.evaluate(() => { window.__downs = []; addEventListener("pointerdown", (e) => window.__downs.push(e.timeStamp), true); });
    // (the taps carry their own times, like a phone's: the second press goes down 120 ms after the first, however long the
    // page takes to handle the first. page.touchscreen sends a press only after the page has handled the one before it, so
    // under load its two presses can be more than 1 s apart)
    const cdp = await page.context().newCDPSession(page), t0 = Date.now(), pt = [{ x: go.x, y: go.y, id: 1 }];
    for (const [type, ms] of [["touchStart", 0], ["touchEnd", 50], ["touchStart", 120], ["touchEnd", 170]]) await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : pt, timestamp: (t0 + ms) / 1000 });
    // (the page has handled both presses: the second went down on the finale, or on the card if the first did nothing)
    await need(page, () => window.__downs.length >= 2, null, 20000, "the page handles both taps");
    const dbl = await page.evaluate(() => ({ playing: FISH.cuts.playing, id: FISH.cuts.id, gap: Math.round(window.__downs[1] - window.__downs[0]) }));
    check(go.hit && dbl.playing && dbl.id === "finale", "a double tap on the fourth legend's card plays the finale, and the second tap does not skip it (" + JSON.stringify({ ...dbl, ...go }) + ")");
    await need(page, () => FISH.cuts.playing && FISH.cuts.id === "finale", null, 20000, "the finale plays after the fourth legend's card");
    await waitT(page, 1.5);
    const fi = await page.evaluate(() => ({ cap: document.querySelector("#cut .cap").innerText.replace(/\s+/g, " ").trim(), catch: document.getElementById("catch").hidden, seen: FISH.save.cuts.finale, sfx: window.__sfx.includes("swell") }));
    check(fi.cap === "You fished them all. Every legend is in your journal." && fi.catch && fi.seen === 1 && fi.sfx, "after the fourth legend's card: the finale, \"You fished them all.\", and its sound (" + JSON.stringify(fi) + ")");
    const b2 = await skipBy(page, "back");
    await need(page, () => FISH.G.phase === "cast", null, 30000, "the next cast starts after the finale");
    const c2 = await at(page);
    check(!b2.playing && b2.ms <= 300 && c2.phase === "cast" && c2.step === "ready" && !c2.paused, "back skips the finale, and the next cast starts as the card's button would (" + JSON.stringify({ ...b2, ...c2 }) + ")");
    // once
    await landFish(page, { id: "golden", kg: 4.4, cm: 57 });
    await until(page, () => FISH.G.phase === "catch" && !FISH.G.cardWait, null, 20000);
    await sleep(500);
    await page.click("#catchGo");
    await until(page, () => FISH.G.phase === "cast", null, 20000);
    check((await cutsSeen(page)).join() === "landed.loon,finale", "the hero shot and the finale play once (" + (await cutsSeen(page)).join() + ")");
    // back with no cutscene still pauses play
    await page.evaluate(() => window.__cap.fire("backButton"));
    await sleep(200);
    check(await page.evaluate(() => FISH.G.paused), "with no cutscene, back pauses play as before");
  } catch (e) { check(false, "exception in part C: " + (e && e.stack)); }
  check(errors.length === 0, "part C: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- D. an old save ---------- */
if (part("D")) {
  const old = { v: 1, casts: 40, caught: 6, input: "touch", journal: { perch: { n: 3, kg: 0.5, cm: 30 }, walleye: { n: 1, kg: 3.6, cm: 63 } }, longest: 40, seen: { bail: 1 },
    places: { loon: { open: 1, kg: 3.6, id: "walleye", n: 6, lg: 1 }, stumps: { open: 1, lg: 1 } } };
  const { browser, page, errors } = await open({ cuts: true, save: old, query: "" });
  try {
    await watchCuts(page);
    const c = await page.evaluate(() => FISH.save.cuts);
    check(JSON.stringify(c) === JSON.stringify({ open: 1, "arrive.stumps": 1, "reveal.loon": 1, "reveal.stumps": 1 }), "an old save loads with the opening, Stump Bay's arrival and the two rings it saw as seen (" + JSON.stringify(c) + ")");
    // Go fishing at Loon Lake: no opening; a gold ring: its toast, no reveal
    await page.click("#freeBtn");
    await until(page, () => FISH.G.phase === "cast", null, 20000);
    await page.evaluate(() => { window.__toasts = []; const t = document.getElementById("toast"); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
    await goldRing(page, 4, -45);
    await need(page, () => window.__toasts.some((t) => /gold ring/.test(t)), null, 60000, "the gold ring has its toast");
    // the first trip to Stump Bay (its arrival card not seen yet): the card, with no fly-in
    await page.evaluate(() => FISH.toTitle());
    await sleep(400);
    await page.click("#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    await sleep(400);
    await page.click('.pcard[data-place="stumps"] button');
    await page.waitForSelector("#arrive:not([hidden])", { timeout: 60000 });
    check((await cutsSeen(page)).length === 0 && (await page.evaluate(() => window.__toasts.some((t) => /gold ring/.test(t)))), "the old save gets no opening, no reveal and no fly-in, and the gold ring has its toast (" + (await cutsSeen(page)).join() + ")");
  } catch (e) { check(false, "exception in part D: " + (e && e.stack)); }
  check(errors.length === 0, "part D: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- E. calm effects and reduced motion ---------- */
if (part("E")) {
  const { browser, page, errors } = await open({ cuts: true, touch: false, phone: false, width: 1280, height: 800 });
  try {
    await watchCuts(page);
    // (the clock is moved by hand here, from the start, so the camera can be read at set times)
    await page.evaluate(() => { document.documentElement.dataset.calm = "1"; const C = FISH.cuts; window.__u = C.update; C.update = () => {}; });
    await page.click("#freeBtn");
    await waitCut(page, "open");
    const read = (t) => page.evaluate(async (t) => {
      const C = FISH.cuts;
      while (C.playing && C.state.t < t - 1e-6) window.__u(Math.min(0.05, t - C.state.t));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const p = FISH.world.camera.position, s = C.state;
      return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), fade: +s.fade.toFixed(2), calm: s.calm, cap: document.querySelector("#cut .cap").classList.contains("on"), shown: +getComputedStyle(document.getElementById("cutFade")).opacity };
    }, t);
    const p = [await read(0.1), await read(1.2), await read(2.6), await read(4), await read(5.2), await read(7)];
    const same = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;
    check(p.every((q) => q.calm) && same(p[1], p[2]) && same(p[4], p[5]) && !same(p[2], p[4]), "calm effects: still shots (the camera holds still in each, and the shots differ) (" + JSON.stringify(p) + ")");
    check(p[0].fade > 0.5 && p[1].fade === 0 && p[3].fade === 1 && p[3].shown > 0.9 && p[4].fade === 0, "joined by fades: in from dark, and dark between the shots (" + p.map((q) => q.fade + "/" + q.shown).join(" ") + ")");
    check(p[2].cap && p[5].cap && (await page.evaluate(() => window.__sfx.includes("swell"))), "the caption and the sound stay");
    await page.evaluate(() => { const C = FISH.cuts; C.update = window.__u; });
    await ff(page);
    await until(page, () => FISH.G.phase === "cast", null, 20000);
    const lift = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 700)); return { hidden: document.getElementById("cutFade").hidden, phase: FISH.G.phase }; });
    check(lift.hidden && lift.phase === "cast", "the fade lifts over the cast as the opening ends (" + JSON.stringify(lift) + ")");
    // a calm reveal: the aim on the water goes with the rod at once, and on the first frame after it the camera is on the
    // dock, whether it ends by itself (through black) or by a skip: no flight home
    // (the aim fades in over the cast view: read once it is up. It takes 4 frames or more, as a slow frame moves the world
    // on by 50 ms at most)
    await need(page, () => { let a = 0; FISH.world.scene.traverse((o) => { const u = o.material && o.material.uniforms; if (u && u.uAim) a = u.uAim.value.z; }); return a > 0.5; }, null, 60000, "the aim line on the water fades in over the cast view");
    const aim0 = await aimOn(page);
    await page.evaluate(() => { FISH.save.caught = 1; });
    await goldRing(page, 6, -44);
    await waitCut(page, "reveal.loon", 30000);
    await camAfter(page);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const aim1 = await aimOn(page), rc = await page.evaluate(() => FISH.cuts.calm);
    check(aim0 > 0.5 && aim1 === 0 && rc, "the calm reveal hides the aim line on the water at once (" + JSON.stringify({ before: aim0, in: aim1, calm: rc }) + ")");
    await ff(page);
    const ce = await camRead(page);
    check(ce != null && ce < 0.1, "a calm reveal that ends by itself: the camera is on the dock on the first frame after it (" + ce + " m)");
    await page.evaluate(() => { delete FISH.save.cuts["reveal.loon"]; });
    await goldRing(page, -10, -46);
    await waitCut(page, "reveal.loon", 30000);
    await waitT(page, 1);
    await camAfter(page);
    const rs = await skipBy(page, "Space"), cs = await camRead(page), ra = await at(page);
    check(!rs.playing && rs.ms != null && rs.ms <= 300 && cs != null && cs < 0.1 && ra.phase === "cast" && ra.step === "ready", "a calm reveal skipped by Space 1 s in: the cast, with the camera on the dock on the first frame (" + JSON.stringify({ ...rs, cam: cs, ...ra }) + ")");
    // reduced motion, with Calm effects off: the replay on the Places card is the still version too
    await page.evaluate(() => { delete document.documentElement.dataset.calm; FISH.toTitle(); });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await sleep(400);
    await page.click("#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    await sleep(400);
    await page.click('.pcard[data-place="loon"] button.watch');
    await waitCut(page, "open");
    check(await page.evaluate(() => FISH.cuts.calm), "with reduced motion the opening is the still version");
    await page.keyboard.press("Escape");
    await until(page, () => !document.getElementById("places").hidden, null, 30000);
    const ce5 = await cutsSeen(page);
    check(ce5.join() === "open,reveal.loon,reveal.loon,open" && (await page.evaluate(() => window.__cuts.every((c) => c.calm))), "and Escape ends it, back on the Places card (" + ce5.join() + ")");
  } catch (e) { check(false, "exception in part E: " + (e && e.stack)); }
  check(errors.length === 0, "part E: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- F. the layouts ---------- */
if (part("F")) {
  const { browser, page, errors } = await open({ cuts: true, touch: true, width: 390, height: 844 });
  try {
    await page.click("#freeBtn");
    await page.waitForSelector("#setup:not([hidden])");
    await sleep(350);
    await page.click("#useTouch");
    await waitCut(page, "open");
    await page.evaluate(() => { const C = FISH.cuts; window.__u = C.update; C.update = () => {}; while (C.state.t < 2.4) window.__u(0.05); });
    // a notch and a home bar: the safe areas the game reads (--sat, --sab, and the sides held sideways)
    const SIZES = [[390, 844, { sat: 47, sab: 34 }], [360, 640, { sat: 24, sab: 0 }], [844, 390, { sal: 47, sar: 47, sab: 21 }], [1280, 800, {}], [390, 844, { sat: 47, sab: 34, scale: 1.3 }]];
    for (const [w, h, ins] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      const m = await page.evaluate(async (ins) => {
        const g = document.getElementById("game");
        for (const k of ["sat", "sab", "sal", "sar"]) g.style.setProperty("--" + k, (ins[k] || 0) + "px");
        if (ins.scale) g.style.setProperty("--ui-scale", String(ins.scale)); else g.style.removeProperty("--ui-scale");
        await new Promise((r) => setTimeout(r, 500));
        // (the bars slide in as the cutscene starts: measured once they are in)
        await Promise.all([...document.querySelectorAll("#cut .bar")].flatMap((b) => b.getAnimations().map((a) => a.finished)));
        const R = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height }; };
        const cap = R("#cut .cap"), b = R("#cut .cap b"), sp = R("#cut .cap span"), top = R("#cut .bar.top"), bot = R("#cut .bar.bot"), skip = R("#cut .skip");
        const fits = (e) => e.scrollWidth <= e.clientWidth + 1;
        return { W: innerWidth, H: innerHeight, cap, b, sp, top, bot, skip, one: fits(document.querySelector("#cut .cap b")) && fits(document.querySelector("#cut .cap span")), title: parseFloat(getComputedStyle(document.querySelector("#cut .cap b")).fontSize) };
      }, ins);
      const sat = ins.sat || 0, sab = ins.sab || 0, sal = ins.sal || 0, sar = ins.sar || 0;
      const why = Object.entries({ "top bar": m.top.h >= sat + 26, "bottom bar": m.bot.h >= sab + 26, "title over the home bar": m.b.b <= m.H - sab, "line over the home bar": m.sp.b <= m.H - sab - 2,
        "title under the top bar": m.b.t > m.top.b, "inside the sides": m.b.l >= sal && m.b.r <= m.W - sar && m.sp.l >= sal && m.sp.r <= m.W - sar,
        "hint under the notch": m.skip.t >= sat, "hint on the top bar": m.skip.b <= m.top.b && m.skip.r <= m.W - sar, "no overflow": m.one }).filter(([, v]) => !v).map(([k]) => k);
      check(why.length === 0, `${w}x${h}${ins.scale ? " with Larger text" : ""}: the bars hold the safe areas, the caption fits inside them, the Skip hint sits on the top bar (title ${m.title}px; ${JSON.stringify({ cap: m.cap, skip: m.skip, top: m.top.h, bot: m.bot.h })})` + (why.length ? ": " + why.join(", ") : ""));
      const file = path.join(SHOTS, `cut-${w}x${h}${ins.scale ? "-larger" : ""}.png`);
      await page.screenshot({ path: file });
      console.log("     shot: " + file);
    }
    const big = await page.evaluate(() => { const g = document.getElementById("game"); const a = parseFloat(getComputedStyle(document.querySelector("#cut .cap b")).fontSize); g.style.removeProperty("--ui-scale"); const b = parseFloat(getComputedStyle(document.querySelector("#cut .cap b")).fontSize); return { a, b }; });
    check(big.a > big.b * 1.25, "Larger text (--ui-scale) scales the caption (" + JSON.stringify(big) + ")");
  } catch (e) { check(false, "exception in part F: " + (e && e.stack)); }
  check(errors.length === 0, "part F: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- G. a desktop player: the mouse on the crank, and the keys after the hero shot ---------- */
if (part("G")) {
  const save = { v: 1, casts: 24, caught: 3, input: "touch", journal: { perch: { n: 3, kg: 0.4, cm: 26 } }, places: { loon: { open: 1 }, stumps: { open: 1 } }, cuts: except("landed.loon") };
  const { browser, page, errors } = await open({ cuts: true, save, touch: false, phone: false, width: 1280, height: 800 });
  try {
    await watchCuts(page);
    await page.evaluate(() => FISH.startMode("free"));
    await until(page, () => FISH.G.phase === "cast", null, 20000);
    // a fight with the legend, the crank turned with the mouse
    await page.evaluate(() => {
      const G = FISH.G;
      G.sim = { fake: true, events: [], step() {}, state: { phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.3, slip: 0, dragN: 18, breakN: 45, lineOut: 20, slack: false, bend: 0.3,
        fish: { id: "golden", kg: 4, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move: "swim", jump: 0, near: 0.5, known: true } } };
      G.bail = "closed";
      FISH.enterReel();
    });
    await until(page, () => FISH.G.phase === "reel" && !document.getElementById("reelUI").hidden, null, 20000);
    await sleep(800);
    const b = await page.evaluate(() => { const r = document.getElementById("crankBox").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: Math.min(r.width, r.height) * 0.35 }; });
    const turn = async () => { for (let i = 1; i <= 8; i++) { const a = (i * Math.PI) / 4; await page.mouse.move(b.x + b.R * Math.cos(a), b.y + b.R * Math.sin(a), { steps: 2 }); } };
    await page.mouse.move(b.x + b.R, b.y);
    await page.mouse.down();
    await turn();
    const held = await page.evaluate(() => !!FISH.crank.drag);
    // the legend is landed with the button still down, and it comes up over the hero shot
    await page.evaluate((c) => { FISH.G.sim = { fake: true, events: [], step() {}, state: { phase: "caught", catch: c, lure: { x: 0, y: -0.2, z: -6, speed: 0 }, fish: null } }; }, { id: "golden", kg: 4.6, cm: 58 });
    await waitCut(page, "landed.loon", 30000);
    await page.mouse.up();
    await sleep(200);
    const a0 = await page.evaluate(() => FISH.crank.angle);
    await turn();
    const g = await page.evaluate((a0) => ({ drag: !!FISH.crank.drag, turned: +Math.abs(FISH.crank.angle - a0).toFixed(3), focus: document.activeElement && document.activeElement.id, playing: FISH.cuts.playing }), a0);
    check(held && !g.drag && g.turned === 0 && g.playing, "a mouse let go over the hero shot lets go of the crank, and a hover after turns nothing (" + JSON.stringify({ held, ...g }) + ")");
    check(g.focus === "catchGo", "the catch card's button keeps the focus under the hero shot (" + g.focus + ")");
    // Space skips it; the card comes with the focus on its button, and Space presses it
    await waitT(page, 1);
    const sk = await skipBy(page, "Space");
    await need(page, () => !FISH.G.cardWait, null, 30000, "the card comes after the hero shot");
    await sleep(400);
    const f = await page.evaluate(() => ({ focus: document.activeElement && document.activeElement.id, card: !document.getElementById("catch").hidden }));
    await page.keyboard.press("Space");
    await need(page, () => FISH.G.phase === "cast", null, 30000, "Space on the card casts again");
    const ph = await page.evaluate(() => ({ phase: FISH.G.phase, card: !document.getElementById("catch").hidden }));
    check(!sk.playing && sk.ms != null && sk.ms <= 300 && f.focus === "catchGo" && f.card && ph.phase === "cast" && !ph.card, "Space skips the hero shot, the card comes with the focus on its button, and Space casts again (" + JSON.stringify({ ...sk, ...f, after: ph }) + ")");
  } catch (e) { check(false, "exception in part G: " + (e && e.stack)); }
  check(errors.length === 0, "part G: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- H. a press held into a reveal, a Space chain, and a legend met before its reveal ---------- */
// play starts with none of the game's own gold rings, then or later: the test raises the legend's ring itself
const startNoGold = (page, mode) => page.evaluate((mode) => { FISH.startMode(mode); const R = FISH.rises, sp = R.spawn.bind(R); R.spawn = () => { const g = sp(); return g && g.gold ? null : g; }; }, mode);
// In the page: pointers and Space with exact timing (a slow software renderer would stretch CDP input), the legend's ring, a
// cast that comes home with nothing on it (then the beat after it; a derby cast is used up), a press in the step that starts
// the reveal, a wait for frames, and the cast as it is now
function pressKit(kind) {
  const G = FISH.G, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let target = null;
  window.__wait = wait;
  window.__ptr = (type, x, y, id = 7) => {
    // (a finger's events go to where it came down)
    const el = kind === "touch" && type !== "pointerdown" && target ? target : document.elementFromPoint(x, y) || document.body;
    if (type === "pointerdown") target = el;
    el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    return el.id || el.tagName;
  };
  window.__key = (type, repeat = false) => window.dispatchEvent(new KeyboardEvent(type, { code: "Space", key: " ", repeat, bubbles: true, cancelable: true }));
  window.__gold = (x = 6, z = -44) => FISH.rises.list.push({ x, z, ttl: 90, species: "golden", gold: true, pulse: 0.2 });
  window.__home = async () => {
    FISH.newCast(); FISH.enterReel();
    G.lastEvent = {}; G.hold = null; G.bail = "closed";
    G.casts++; if (G.mode === "derby") G.castsLeft--;
    G.sim = { fake: true, events: [], step() {}, state: { phase: "home", lure: { x: 0, y: -0.2, z: -1, speed: 0 }, tfrac: 0, slip: 0, dragN: 18, breakN: 45, lineOut: 1, slack: false, bend: 0, fish: null } };
    const t0 = performance.now();
    while (G.phase === "reel") { if (performance.now() - t0 > 60000) throw new Error("the cast that comes home: still in the reel after 60 s"); await wait(2); }
    // (the beat stays up until the check presses: a slow frame would end it first)
    G.lossMs = 600000;
    return G.phase;
  };
  window.__cast = () => ({ phase: G.phase, step: G.step, pin: !!G.pin, casts: G.casts, left: G.castsLeft, cut: FISH.cuts.id });
  // The button comes down in the step that starts the reveal, just before it: the legend's ring rises in that step. (A press
  // before it can wait seconds for that step on a slow page, and its hold timer would take the line first)
  window.__pressAtReveal = async (x, y) => {
    const R = FISH.rises, st = R.step;
    let on = null;
    R.step = function (...a) {
      const ev = st.apply(this, a);
      if (G.phase === "cast" && G.step === "ready" && !FISH.cuts.playing && FISH.reelPanel.s.grab === "lock") { delete R.step; on = window.__ptr("pointerdown", x, y); window.__gold(); }
      return ev;
    };
    const t0 = performance.now();
    while (on == null) { if (performance.now() - t0 > 60000) { delete R.step; throw new Error("the press at the reveal: no step of the cast in 60 s"); } await wait(2); }
    return { on, cut: FISH.cuts.id };
  };
  // until the game has run n more frames (a fixed wait can hold no frame at all on a slow page)
  window.__frames = async (n = 2) => {
    const f = G.frame + n, t0 = performance.now();
    while (G.frame < f) { if (performance.now() - t0 > 60000) throw new Error(n + " more frames: not so after 60 s"); await wait(5); }
  };
}
// the reveal at Loon Lake not seen again, in the game and in the saved copy, and no gold ring on the water (so it plays only
// when the check raises one)
const unseen = (page) => page.evaluate(() => {
  FISH.rises.list = FISH.rises.list.filter((g) => !g.gold);
  delete FISH.save.cuts["reveal.loon"];
  const s = JSON.parse(localStorage.getItem("fish.v1"));
  delete s.cuts["reveal.loon"];
  localStorage.setItem("fish.v1", JSON.stringify(s));
});
const castNow = (page) => page.evaluate(() => window.__cast());
if (part("H")) {
  const save = { v: 1, casts: 24, caught: 3, input: "touch", journal: { perch: { n: 3, kg: 0.4, cm: 26 } }, places: { loon: { open: 1 }, stumps: { open: 1 } }, cuts: except("reveal.loon") };
  const { browser, page, errors } = await open({ cuts: true, save, touch: false, phone: false, width: 960, height: 600 });
  try {
    await watchCuts(page);
    await page.evaluate(pressKit, "mouse");
    await startNoGold(page, "free");
    await until(page, () => FISH.G.phase === "cast" && FISH.G.step === "ready" && FISH.reelPanel.s.grab === "lock", null, 30000);
    await sleep(500);
    // The mouse button comes down on the lake just before the reveal starts, while its hold timer still runs (the press
    // comes in the step that starts the reveal, see __pressAtReveal), and the button stays down past it. hold: the button
    // stays down through the whole reveal
    const pressReveal = async (hold) => {
      await unseen(page);
      await page.evaluate(() => FISH.newCast());
      await until(page, () => FISH.G.phase === "cast" && FISH.G.step === "ready" && FISH.reelPanel.s.grab === "lock", null, 30000);
      return page.evaluate(async (hold) => {
        const c0 = window.__cast(), { on, cut } = await window.__pressAtReveal(480, 380);
        if (cut !== "reveal.loon" || hold) { if (cut !== "reveal.loon") window.__ptr("pointerup", 480, 380); return { on, cut, c0 }; }
        await window.__wait(1600);
        const during = window.__cast();
        window.__ptr("pointerup", 480, 380);
        await window.__wait(100);
        return { on, cut, c0, during, up: window.__cast() };
      }, hold);
    };
    // let go 1.6 s into the reveal
    const m1 = await pressReveal(false);
    await ff(page);
    await frames(page);
    const m1e = await castNow(page);
    check(m1.cut === "reveal.loon" && !m1.during.pin && m1.during.step === "ready" && m1.up.step === "ready" && m1.up.casts === m1.c0.casts && m1e.step === "ready" && !m1e.pin && m1e.casts === m1.c0.casts, "a mouse button pressed just before the reveal and let go in it takes no line and casts nothing, under it or after it (" + JSON.stringify({ ...m1, end: m1e }) + ")");
    // held through the whole reveal as it plays (its hold timer would end in it), and let go after it
    const m2 = await pressReveal(true);
    await need(page, () => !FISH.cuts.playing, null, 120000, "the reveal ends by itself");
    await frames(page);
    const m2e = await page.evaluate(async () => { const held = window.__cast(); window.__ptr("pointerup", 480, 380); await window.__frames(2); return { held, up: window.__cast() }; });
    check(m2.cut === "reveal.loon" && m2e.held.step === "ready" && !m2e.held.pin && m2e.up.step === "ready" && m2e.up.casts === m2.c0.casts, "a mouse button held through the whole reveal casts nothing as it ends, nor when it lets go after it (" + JSON.stringify({ ...m2, ...m2e }) + ")");
    // the player presses again: the hold takes the line as before (let go in the back swing, nothing flies). The button
    // comes up in the same moment the hold takes the line: the hold cast runs on the clock, so a slow frame between the two
    // would swing the rod forward
    const m3 = await page.evaluate(async () => {
      const G = FISH.G, RP = FISH.reelPanel;
      let on;
      const took = new Promise((res) => {
        on = () => { RP.off("pin", on); const out = { pin: !!(G.pin && G.pin.key), step: G.step }; queueMicrotask(() => { window.__ptr("pointerup", 480, 380); res(out); }); };
        RP.on("pin", on);
      });
      window.__ptr("pointerdown", 480, 380);
      const out = await Promise.race([took, window.__wait(30000).then(() => ({ pin: false, step: G.step, late: true }))]);
      if (out.late) { RP.off("pin", on); window.__ptr("pointerup", 480, 380); }
      await window.__frames(2);
      return { ...out, after: window.__cast() };
    });
    check(m3.pin && m3.step === "pinned" && m3.after.step === "ready", "after it, a new press takes the line as before (" + JSON.stringify(m3) + ")");

    // a derby: a click that ends the beat, with the legend's ring on the water, plays the reveal at once (no cast), and the
    // casts left are the same after it
    await unseen(page);
    await startNoGold(page, "derby");
    await until(page, () => FISH.G.mode === "derby" && FISH.G.phase === "cast" && FISH.G.step === "ready", null, 30000);
    await sleep(500);
    const d = await page.evaluate(async () => {
      const beat = await window.__home();
      window.__gold();
      await window.__wait(450);
      const c0 = window.__cast();
      window.__ptr("pointerdown", 480, 380);
      const cut = FISH.cuts.id;
      await window.__wait(1500);
      const during = window.__cast();
      window.__ptr("pointerup", 480, 380);
      return { beat, c0, cut, during };
    });
    await ff(page);
    await frames(page);
    const de = await castNow(page);
    check(d.beat === "lost" && d.cut === "reveal.loon" && d.during.left === d.c0.left && !d.during.pin && de.left === d.c0.left && de.casts === d.c0.casts && de.step === "ready" && !de.pin, "a derby: a click that ends the beat with the legend's ring on the water plays the reveal, and the casts left are the same after it (" + JSON.stringify({ ...d, end: de }) + ")");

    // a Space chain: Space that ends the beat plays the reveal in place of the Space cast; held through it, it casts nothing
    await unseen(page);
    await startNoGold(page, "free");
    await until(page, () => FISH.G.mode === "free" && FISH.G.phase === "cast" && FISH.G.step === "ready", null, 30000);
    await sleep(500);
    const s = await page.evaluate(async () => { const beat = await window.__home(); window.__gold(); await window.__wait(450); const c0 = window.__cast(); window.__key("keydown"); return { beat, c0, at: window.__cast() }; });
    await ff(page);
    const se = await page.evaluate(async () => {
      await window.__frames(2);
      // (the key still held: its repeats, then it lets go)
      for (let i = 0; i < 3; i++) { window.__key("keydown", true); await window.__wait(40); }
      const held = window.__cast();
      window.__key("keyup");
      await window.__frames(2);
      return { held, up: window.__cast() };
    });
    check(s.beat === "lost" && s.at.phase === "cast" && s.at.cut === "reveal.loon" && !s.at.pin, "Space that ends the beat with the legend's ring on the water plays the reveal in place of the Space cast (" + JSON.stringify(s) + ")");
    check(se.held.step === "ready" && !se.held.pin && se.up.step === "ready" && se.up.casts === s.c0.casts, "Space held through the reveal casts nothing after it: the player presses again (" + JSON.stringify(se) + ")");
    // Space on the catch card, with the legend's ring on the water: the reveal in place of the Space cast
    await unseen(page);
    await landFish(page, { id: "perch", kg: 0.4, cm: 26 });
    await until(page, () => FISH.G.phase === "catch" && !document.getElementById("catch").hidden && !FISH.G.cardWait, null, 20000);
    await sleep(500);
    const cc = await page.evaluate(() => { window.__gold(); window.__key("keydown"); const at = window.__cast(); window.__key("keyup"); return at; });
    await ff(page);
    check(cc.phase === "cast" && cc.cut === "reveal.loon" && !cc.pin, "Space on the catch card with the legend's ring on the water plays the reveal in place of the Space cast (" + JSON.stringify(cc) + ")");

    // the legend landed before its reveal: the reveal is marked seen, and its next gold ring (in a new place: one ring has its
    // toast once) has the toast and no reveal
    await unseen(page);
    await until(page, () => FISH.G.phase === "cast" && FISH.G.step === "ready", null, 20000);
    await landFish(page, { id: "golden", kg: 4.6, cm: 58 });
    await until(page, () => FISH.G.phase === "catch" && !FISH.G.cardWait, null, 30000);
    const ls = await page.evaluate(() => ({ seen: FISH.save.cuts["reveal.loon"], kept: JSON.parse(localStorage.getItem("fish.v1")).cuts["reveal.loon"] }));
    await sleep(500);
    await page.click("#catchGo");
    await until(page, () => FISH.G.phase === "cast" && FISH.G.step === "ready", null, 20000);
    const n0 = (await cutsSeen(page)).length;
    await page.evaluate(() => { window.__toasts = []; const t = document.getElementById("toast"); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); window.__gold(-10, -46); });
    await need(page, () => window.__toasts.some((t) => /gold ring/.test(t)), null, 60000, "the next gold ring has its toast");
    const after = (await cutsSeen(page)).slice(n0), toasted = await page.evaluate(() => window.__toasts.some((t) => /gold ring/.test(t)));
    check(ls.seen === 1 && ls.kept === 1 && !after.length && toasted, "a legend landed before its reveal marks the reveal seen, and its next gold ring has the toast and no reveal (" + JSON.stringify({ ...ls, after, toasted }) + ")");
    // the legend hooked: its reveal is marked seen too
    await unseen(page);
    const hk = await page.evaluate(async () => {
      const G = FISH.G;
      G.sim = { fake: true, events: [{ type: "hooked", id: "golden" }], step() {}, state: { phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.3, slip: 0, dragN: 18, breakN: 45, lineOut: 20, slack: false, bend: 0.3,
        fish: { id: "golden", kg: 4, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move: "swim", jump: 0, near: 0.5, known: true } } };
      G.bail = "closed";
      FISH.enterReel();
      const t0 = performance.now();
      while (G.sim.events.length) { if (performance.now() - t0 > 60000) throw new Error("the hook set: not handled after 60 s"); await window.__wait(5); }
      return { seen: FISH.save.cuts["reveal.loon"], kept: JSON.parse(localStorage.getItem("fish.v1")).cuts["reveal.loon"] };
    });
    check(hk.seen === 1 && hk.kept === 1, "a legend hooked marks its reveal seen (" + JSON.stringify(hk) + ")");
  } catch (e) { check(false, "exception in part H (mouse and keys): " + (e && e.stack)); }
  check(errors.length === 0, "part H (mouse and keys): no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}
if (part("H")) {
  const save = { v: 1, casts: 24, caught: 3, input: "touch", journal: { perch: { n: 3, kg: 0.4, cm: 26 } }, cuts: except("reveal.loon") };
  const { browser, page, errors } = await open({ cuts: true, save, width: 390, height: 844 });
  try {
    await page.evaluate(pressKit, "touch");
    await startNoGold(page, "derby");
    await until(page, () => FISH.G.phase === "cast" && FISH.G.step === "ready", null, 30000);
    await sleep(500);
    // a phone in a derby: the tap that ends the beat plays the reveal, and the same finger drags down, flicks up and lifts
    // in it
    const t = await page.evaluate(async () => {
      const beat = await window.__home(), x = 200, y = 520;
      window.__gold();
      await window.__wait(450);
      const c0 = window.__cast();
      window.__ptr("pointerdown", x, y, 11);
      const cut = FISH.cuts.id;
      for (let i = 1; i <= 12; i++) { window.__ptr("pointermove", x, y + i * 15, 11); await window.__wait(30); }
      for (let i = 11; i >= -8; i--) { window.__ptr("pointermove", x, y + i * 15, 11); await window.__wait(6); }
      window.__ptr("pointerup", x, y - 120, 11);
      return { beat, c0, cut, during: window.__cast() };
    });
    await ff(page);
    await frames(page);
    const te = await castNow(page);
    check(t.beat === "lost" && t.cut === "reveal.loon" && !t.during.pin && t.during.step === "ready" && t.during.left === t.c0.left && te.left === t.c0.left && te.casts === t.c0.casts && te.step === "ready", "a phone in a derby: a finger that ends the beat, then drags and flicks in the reveal, casts nothing, and the casts left are the same after it (" + JSON.stringify({ ...t, end: te }) + ")");
  } catch (e) { check(false, "exception in part H (touch): " + (e && e.stack)); }
  check(errors.length === 0, "part H (touch): no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

console.log(fails.length ? `\n${fails.length} of ${passes + fails.length} checks failed:\n  ` + fails.join("\n  ") : `\nAll ${passes} checks passed`);
console.log("Screenshots in " + SHOTS);
process.exit(fails.length ? 1 : 0);
