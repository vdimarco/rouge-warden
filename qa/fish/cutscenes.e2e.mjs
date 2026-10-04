// The cutscenes of Reel It In in the real page (public/fish/js/cutscenes.js and its call sites in main.js):
//   A. the opening on a fresh save's first "Go fishing", once; a skip by a tap, Space or Escape ends it within 0.3 s in its
//      end state; the fly-in at Stump Bay before the arrival card, once; "Watch" on the Places card replays it and comes back
//   B. no cutscene in a fight; a legend's reveal after it, with the derby clock and the casts left held; not twice; the hero
//      shot of a legend landed before its card, once
//   C. the finale after the fourth legend, and the Android back button (a stubbed Capacitor bridge) skips
//   D. an old save with places open and a legend seen: no arrival, no reveal, no opening
//   E. calm effects and reduced motion: still shots joined by fades, the caption and the sound
//   F. the bars, the caption and the Skip hint at 390x844, 360x640, 844x390 and 1280x800, clear of the safe areas
//      (screenshots in SHOTS, or <tmp>/fish-cuts, to check by eye)
// Run: serve public/ (cd public && python3 -m http.server 8765), then node qa/fish/cutscenes.e2e.mjs (FISH_URL for another
// address). The script scripts themselves are checked in node by qa/fish/cutscenes.test.mjs.
import os from "os";
import fs from "fs";
import path from "path";
import { open, until, sleep } from "./lib.mjs";
import { CUTS } from "../../public/fish/js/save.js";

const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), "fish-cuts");
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
  await until(page, () => !FISH.cuts.playing, null, 3000).catch(() => {});
  await sleep(50);
  return page.evaluate(() => ({ ms: window.__end && window.__in ? window.__end - window.__in : null, playing: FISH.cuts.playing }));
}
const at = (page) => page.evaluate(() => ({ phase: FISH.G.phase, step: FISH.G.step, mode: FISH.G.mode, paused: FISH.G.paused, pin: !!FISH.G.pin, place: FISH.place.id, hud: !document.getElementById("hud").hidden, screen: document.body.dataset.screen || "" }));

/* ---------- A. the opening, the skip, the fly-in and Watch ---------- */
{
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
    // it ends by itself, in the cast view, and the cast starts
    const t0 = Date.now();
    await until(page, () => !FISH.cuts.playing, null, 90000);
    const end = await at(page), cam = await page.evaluate(() => { const p = FISH.world.camera.position, e = FISH.place.stand.eye; return Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z); });
    check(end.phase === "cast" && end.mode === "free" && end.hud && end.step === "ready" && cam < 0.3, "it ends by itself and the cast starts, the camera on the dock (" + JSON.stringify({ ...end, cam: +cam.toFixed(3), waited: (Date.now() - t0) / 1000 }) + ")");
    const sfx = await page.evaluate(() => window.__sfx.slice());
    check(sfx.includes("swell") && sfx.includes("loonWail"), "its sound: the swell and the loon (" + sfx.join(" ") + ")");
    // once: the next Go fishing goes straight to the water
    await page.evaluate(() => FISH.toTitle());
    await sleep(400);
    await page.click("#freeBtn");
    await until(page, () => FISH.G.phase === "cast", null, 20000);
    check((await cutsSeen(page)).join() === "open", "the second Go fishing has no opening (" + (await cutsSeen(page)).join() + ")");

    // the skip: a tap, Space and Escape, 1 s into the opening, end it within 0.3 s, in the cast, with the press or the key used
    // up (no thumb on the line, no pause)
    for (const how of ["tap", "Space", "Escape"]) {
      await page.evaluate(() => { FISH.toTitle(); FISH.save.cuts = {}; });
      await sleep(400);
      await page.click("#freeBtn");
      await waitCut(page, "open");
      await waitT(page, 1);
      const r = await skipBy(page, how), a = await at(page);
      check(!r.playing && r.ms != null && r.ms <= 300 && a.phase === "cast" && a.step === "ready" && !a.pin && !a.paused && a.hud, `${how === "tap" ? "A tap" : how} 1 s in skips the opening within 0.3 s and the cast starts (${JSON.stringify({ ...r, ...a })})`);
    }

    // the fly-in: the first trip to Stump Bay plays it at the place's own hour, then the arrival card
    await page.evaluate(() => FISH.toTitle());
    await sleep(400);
    await page.click("#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    await sleep(400);
    await page.click('.pcard[data-place="stumps"] button');
    await waitCut(page, "arrive.stumps");
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
{
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
    await sleep(2500);
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
    const r0 = await page.evaluate(() => ({ phase: FISH.G.phase, step: FISH.G.step, prompt: getComputedStyle(document.getElementById("prompt")).visibility, hud: getComputedStyle(document.getElementById("hud")).visibility, cap: document.querySelector("#cut .cap b").textContent }));
    check(r0.phase === "cast" && r0.step === "ready" && r0.prompt === "hidden" && r0.hud === "hidden" && r0.cap === "Golden Loon Bass", "after the fight, in the cast: the reveal of the Golden Loon Bass, the HUD and the prompt hidden (" + JSON.stringify(r0) + ")");
    // the legend breaches in its ring
    await waitT(page, 3.3);
    const fish = await page.evaluate(() => { let m = null; FISH.world.scene.traverse((o) => { if (o.visible && o.userData && o.userData.id === "golden" && o.parent === FISH.world.scene) m = { x: o.position.x, y: o.position.y, z: o.position.z }; }); return m; });
    check(!!fish && Math.hypot(fish.x - 6, fish.z + 44) < 1.5 && fish.y > 0, "the legend leaps out of its ring (" + JSON.stringify(fish) + ")");
    await until(page, () => !FISH.cuts.playing, null, 90000);
    await sleep(200);
    const d = await page.evaluate(() => ({ before: window.__before, after: window.__after, hours: [...new Set(window.__hours)], phase: FISH.G.phase, step: FISH.G.step, fishLeft: (() => { let n = 0; FISH.world.scene.traverse((o) => { if (o.visible && o.userData && o.userData.id === "golden" && o.parent === FISH.world.scene) n++; }); return n; })() }));
    check(!!d.before && !!d.after && d.after.hour === d.before.hour && d.after.left === d.before.left && d.after.casts === d.before.casts && d.hours.length <= 1, "the derby clock and the casts left are the same after the reveal as before it (" + JSON.stringify(d) + ")");
    check(d.phase === "cast" && d.step === "ready" && d.fishLeft === 0, "play goes on from the same cast state, with no fish left in the air");
    const toasts = await page.evaluate(() => window.__toasts.slice());
    check(!toasts.some((t) => /gold ring/.test(t)), "the ring that played its reveal has no toast (" + toasts.join(" | ") + ")");
    // once: the next gold ring has its toast and no reveal
    await goldRing(page, -10, -46);
    await until(page, () => window.__toasts.some((t) => /gold ring/.test(t)), null, 15000).catch(() => {});
    check((await cutsSeen(page)).join() === "reveal.loon" && (await page.evaluate(() => window.__toasts.some((t) => /gold ring/.test(t)))), "a second gold ring has the toast and no reveal (" + (await cutsSeen(page)).join() + ")");

    // the legend landed: the hero shot, with its name and weight, before the card; a tap skips to the card
    await page.evaluate(() => { window.__toasts = []; });
    await landFish(page, { id: "golden", kg: 4.6, cm: 58 });
    await waitCut(page, "landed.loon", 30000);
    const h = await page.evaluate(() => ({ phase: FISH.G.phase, wait: FISH.G.cardWait, card: document.getElementById("catch").classList.contains("wait"), cap: document.querySelector("#cut .cap").innerText.replace(/\s+/g, " ").trim(), toast: document.getElementById("toast").classList.contains("on") }));
    check(h.phase === "catch" && h.wait && h.card && h.cap === "Golden Loon Bass 4.6 kg" && !h.toast, "landing the legend: the hero shot names it and its weight, and the card and the news wait (" + JSON.stringify(h) + ")");
    await waitT(page, 1);
    const hs = await skipBy(page, "tap");
    await until(page, () => !FISH.G.cardWait, null, 5000).catch(() => {});
    const card = await page.evaluate(() => ({ wait: FISH.G.cardWait, shown: !document.getElementById("catch").hidden && !document.getElementById("catch").classList.contains("wait"), name: document.getElementById("cname").textContent }));
    check(!hs.playing && hs.ms <= 300 && !card.wait && card.shown && card.name === "Golden Loon Bass", "a tap skips the hero shot within 0.3 s, and the card comes (" + JSON.stringify({ ...hs, ...card }) + ")");
    // (a toast that waited in line, the gold ring's, may show first)
    await until(page, () => { const t = document.getElementById("toast"); return t.classList.contains("on") && /Your first fish today\./.test(t.textContent); }, null, 8000).catch(() => {});
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
{
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
    await until(page, () => !FISH.G.cardWait, null, 5000).catch(() => {});
    const c1 = await at(page);
    check(!b1.playing && b1.ms != null && b1.ms <= 300 && c1.phase === "catch" && !c1.paused, "the back button skips the hero shot within 0.3 s, to the card, with no pause (" + JSON.stringify({ ...b1, ...c1 }) + ")");
    await sleep(500);
    await page.click("#catchGo");
    await waitCut(page, "finale", 20000);
    await waitT(page, 1.2);
    const fi = await page.evaluate(() => ({ cap: document.querySelector("#cut .cap").innerText.replace(/\s+/g, " ").trim(), catch: document.getElementById("catch").hidden, seen: FISH.save.cuts.finale, sfx: window.__sfx.includes("swell") }));
    check(fi.cap === "You fished them all. Every legend is in your journal." && fi.catch && fi.seen === 1 && fi.sfx, "after the fourth legend's card: the finale, \"You fished them all.\", and its sound (" + JSON.stringify(fi) + ")");
    const b2 = await skipBy(page, "back");
    await until(page, () => FISH.G.phase === "cast", null, 20000).catch(() => {});
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
{
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
    await until(page, () => window.__toasts.some((t) => /gold ring/.test(t)), null, 15000).catch(() => {});
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
{
  const { browser, page, errors } = await open({ cuts: true, touch: false, phone: false, width: 1280, height: 800 });
  try {
    await watchCuts(page);
    await page.evaluate(() => { document.documentElement.dataset.calm = "1"; });
    await page.click("#freeBtn");
    await waitCut(page, "open");
    // the clock is moved by hand here, so the camera can be read at set times
    await page.evaluate(() => { const C = FISH.cuts; window.__u = C.update; C.update = () => {}; });
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
    check((await cutsSeen(page)).length === 2 && (await page.evaluate(() => window.__cuts.every((c) => c.calm))), "and Escape ends it, back on the Places card");
  } catch (e) { check(false, "exception in part E: " + (e && e.stack)); }
  check(errors.length === 0, "part E: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- F. the layouts ---------- */
{
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

console.log(fails.length ? `\n${fails.length} of ${passes + fails.length} checks failed:\n  ` + fails.join("\n  ") : `\nAll ${passes} checks passed`);
process.exit(fails.length ? 1 : 0);
