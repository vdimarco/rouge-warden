// Boot and the app shell of Reel It In, in the real game on a 390x844 phone (the fish-boot and fish-app-shell specs):
//   1. offline: every request to another host is aborted. The boot screen shows from the first frame and the page is
//      never blank; the title shows, a cast and a catch work, and the request list holds no other host. The web build
//      keeps "Switch game" and "Back to the arcade"
//   2. slow fonts: the first paint comes before the fonts, in a system font, and the game font swaps in later
//   3. the boot card: a module that does not load, no WebGL, and a title that is not ready after 15 s (that card goes
//      when the title comes); "Try again" reloads
//   4. the store build, with a stub window.Capacitor (Android): no arcade parts, the six title controls and the five
//      pause buttons, the splash and the status bar, keep awake, back on every screen, app pause and resume, the save
//      mirror, the app copy when motion is denied, a save restored from native storage, a native answer that comes
//      late (it is never covered by a new save), and one that never comes
//   5. a GL context lost in a fight and restored 1 s later under the pause screen (Resume waits for it); a context
//      that never comes back
//   6. the render scale in the page (a new pixel ratio redraws a still lake), and the lake drawn less under opaque
//      screens and on the title over the live lake
// Serve public/ first (python3 -m http.server 8765 --directory public), then: node qa/fish/boot.e2e.mjs
// FISH_URL picks another address. Part 3 waits 15 s on purpose. Exits with code 1 when something fails.
import { createRequire } from "module";
import { URL as FISH_URL, installPhone, until, sleep } from "./lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const HOST = new URL(FISH_URL).host;
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"];
const PAUSE = 350;   // the double-tap guard ignores a click in the first 300 ms of a screen
const click = async (page, sel) => { await sleep(PAUSE); await page.click(sel); };

// A phone page with no help from lib.mjs: nothing is routed, so three.js and the fonts come from the game's own files.
// offline: abort every request to another host. init: scripts to run before the page (fn, arg). save: a first save.
async function launch({ offline = false, init = [], route = null, query = "", save = null, phone = true, waitTitle = true } = {}) {
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [], requests = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push("console: " + m.text()); });
  ctx.on("request", (r) => requests.push(r.url()));
  if (offline) await ctx.route("**/*", (r) => { const u = r.request().url(); return /^https?:/.test(u) && new URL(u).host !== HOST ? r.abort("internetdisconnected") : r.continue(); });
  if (route) await route(ctx);
  if (save) await page.addInitScript((save) => { if (!sessionStorage.getItem("qa-kept")) { localStorage.setItem("fish.v1", JSON.stringify(save)); sessionStorage.setItem("qa-kept", "1"); } }, save);
  for (const [fn, arg] of init) await page.addInitScript(fn, arg);
  if (phone) await page.addInitScript(installPhone);
  await page.goto(FISH_URL + query, { waitUntil: "commit" });
  if (waitTitle) await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  return { browser, page, errors, requests };
}
const foreign = (requests) => [...new Set(requests.filter((u) => /^https?:/.test(u) && new URL(u).host !== HOST).map((u) => new URL(u).host))];
const visibleButtons = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((b) => b.offsetParent !== null && getComputedStyle(b).display !== "none").map((b) => b.textContent.trim()), sel);

// Runs in the page from its first frame: one sample a frame of what shows, until the title is up
function sampler() {
  window.__frames = [];
  const tick = () => {
    const b = document.getElementById("boot"), t = document.getElementById("title");
    if (b) {
      const shown = !b.hidden && getComputedStyle(b).display !== "none", title = !!t && !t.hidden;
      if (!window.__boot0 && shown) {
        const bar = b.querySelector(".boot-bar i"), a = bar && bar.getAnimations()[0];
        window.__boot0 = { text: b.innerText.replace(/\s+/g, " ").trim(), bar: a ? a.playState : "none", state: b.dataset.state };
      }
      window.__frames.push([Math.round(performance.now()), shown ? 1 : 0, title ? 1 : 0]);
      if (title) return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// A stand-in for the fight sim, as in screens.mjs: G.sim takes the shape of LakeSim's state
async function stage(page, patch = {}) {
  await page.evaluate((patch) => {
    const G = FISH.G;
    G.lastEvent = {}; G.walk = false;
    window.__simSteps = 0;
    G.sim = { fake: true, events: [], step() { window.__simSteps++; }, state: Object.assign({
      phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.3, slip: 0, dragN: 18, breakN: 45, lineOut: 20, slack: false, bend: 0.3,
      fish: { id: "walleye", kg: 2, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move: "swim", jump: 0, near: 0.5, known: true },
    }, patch) };
    G.bail = "closed";
    if (G.phase !== "reel") FISH.enterReel();
  }, patch);
}
const CATCH = { id: "perch", name: "Yellow Perch", kg: 0.35, cm: 27, junk: false };
async function landFish(page, c = CATCH) {
  await stage(page, { phase: "caught", catch: c, fish: null });
  await page.waitForSelector("#catch:not([hidden])");
  await until(page, () => !FISH.G.cardWait, null, 20000);
}

/* ---------- 1. offline ---------- */
{
  const t0 = Date.now();
  const { browser, page, errors, requests } = await launch({ offline: true, init: [[sampler]], waitTitle: false });
  try {
    await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
    const ms = Date.now() - t0;
    check(ms < 10000, "offline: the title shows in " + (ms / 1000).toFixed(1) + " s (10 s at most)");
    const fr = await page.evaluate(() => ({ frames: window.__frames, boot0: window.__boot0 }));
    const blank = fr.frames.filter((f) => !f[1] && !f[2]);
    check(fr.frames.length > 0 && fr.frames[0][1] === 1, "the boot screen is up from the first frame (" + fr.frames.length + " frames sampled)");
    check(blank.length === 0, "no frame is blank before the title" + (blank.length ? " (" + blank.length + " blank, first at " + blank[0][0] + " ms)" : ""));
    check(!!fr.boot0 && /REEL IT IN/.test(fr.boot0.text) && /Loading the lake\./.test(fr.boot0.text), "the boot screen says REEL IT IN and Loading the lake. (" + JSON.stringify(fr.boot0 && fr.boot0.text) + ")");
    check(!!fr.boot0 && fr.boot0.bar === "running", "the bar on the boot screen moves (" + (fr.boot0 && fr.boot0.bar) + ")");
    check((await page.evaluate(() => document.documentElement.dataset.bootArt)) === "painted", "a new player gets the boot screen of the painted style, like the title after it");
    const pic = await page.evaluate(() => { const e = performance.getEntriesByType("resource").find((r) => /film-lake\.webp/.test(r.name)), t = window.__frames.find((f) => f[2]); return { end: e ? Math.round(e.responseEnd) : null, title: t ? t[0] : null }; });
    check(pic.end != null && pic.title != null && pic.end <= pic.title + 100, "the painted title's picture loads during the boot (in at " + pic.end + " ms, the title at " + pic.title + " ms)");
    await sleep(600);
    check(await page.evaluate(() => document.getElementById("boot").hidden), "the boot screen is gone once the title shows");
    // the web build keeps the arcade parts
    const web = await page.evaluate(() => ({ build: document.documentElement.dataset.build || "", kick: document.getElementById("tkick").textContent, sw: !!window.GameSwitch }));
    const tb = await visibleButtons(page, "#tmenu .btn");
    check(!web.build && /^GET PLUNGER'D · LOON LAKE$/.test(web.kick) && tb.includes("Switch game") && tb.includes("Back to the arcade") && web.sw,
      "the web build keeps Switch game, Back to the arcade, the switcher and the kicker (" + JSON.stringify({ ...web, tb }) + ")");
    // a cast with the motion rod, then a catch
    await click(page, "#freeBtn");
    await page.waitForSelector("#setup:not([hidden])");
    await click(page, "#useMotion");
    await until(page, () => FISH.G.phase === "cast" && FISH.G.input === "motion", null, 30000);
    await page.evaluate(() => { FISH.G.force = { species: "perch", kg: 0.35, bite: true }; __phone.pose(88); });
    await sleep(1200);
    const rb = await page.evaluate(() => { const r = document.querySelector("#reelBox").getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.4 }; });
    const cast = await page.evaluate(async ({ x, y }) => {
      const P = window.__phone, el = document.elementFromPoint(x, y), wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const ev = (type) => el.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true, buttons: type === "pointerup" ? 0 : 1 }));
      ev("pointerdown");
      for (let i = 0; i < 100 && FISH.G.step !== "pinned"; i++) await wait(20);
      for (let i = 0; i <= 25; i++) { P.pose(88 + 42 * (i / 25)); await wait(16); }
      await wait(250);
      const t0 = performance.now();
      let up = false;
      for (;;) {
        const k = Math.min(1, (performance.now() - t0) / 170), th = 130 - 110 * (0.5 - 0.5 * Math.cos(Math.PI * k));
        P.pose(th);
        if (!up && th <= 70) { up = true; ev("pointerup"); }
        if (k >= 1) break;
        await wait(4);
      }
      await wait(200);
      P.pose(40);
      return !!FISH.G.cast;
    }, rb);
    check(cast, "offline: the motion cast flies");
    await until(page, () => FISH.G.phase === "reel" || FISH.G.step === "ashore", null, 90000);
    check(await page.evaluate(() => FISH.G.phase === "reel"), "offline: the lure lands in the water and the reel starts");
    await landFish(page);
    check(/Perch/.test(await page.textContent("#cname")), "offline: a catch shows the catch card");
    await sleep(500);
    const hosts = foreign(requests);
    check(hosts.length === 0, "offline: no request to another host" + (hosts.length ? " (" + hosts.join(", ") + ")" : ` (${requests.length} requests, all to ${HOST})`));
  } catch (e) { check(false, "exception in part 1: " + (e && e.stack)); }
  check(errors.length === 0, "part 1: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- 2. slow fonts ---------- */
{
  // the Original style: its boot screen and title use the slab font, so both fonts are on the first screen
  const delayFonts = async (ctx) => ctx.route(/\/fonts\/.*\.woff2$/, async (r) => { await sleep(5000); r.continue().catch(() => {}); });
  const { browser, page, errors } = await launch({ route: delayFonts, waitTitle: false, save: { v: 1, artStyle: "original" } });
  try {
    await page.waitForSelector("#boot", { state: "attached" });
    check((await page.evaluate(() => document.documentElement.dataset.bootArt)) === "original", "a player of the Original style gets its boot screen");
    await until(page, () => performance.getEntriesByName("first-contentful-paint").length > 0, null, 30000);
    const early = await page.evaluate(() => ({ fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0].startTime), nunito: document.fonts.check("800 16px Nunito"), slab: document.fonts.check("40px 'Alfa Slab One'"), now: Math.round(performance.now()) }));
    check(early.fcp < 3000 && !early.slab, "slow fonts: the boot screen paints at " + early.fcp + " ms, in a system font (the slab font is not in yet: " + !early.slab + ")");
    await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
    await until(page, () => document.fonts.check("800 16px Nunito") && document.fonts.check("40px 'Alfa Slab One'"), null, 30000).catch(() => {});
    const late = await page.evaluate(() => ({ nunito: document.fonts.check("800 16px Nunito"), slab: document.fonts.check("40px 'Alfa Slab One'"), at: Math.round(performance.now()) }));
    check(late.nunito && late.slab, "slow fonts: the game fonts swap in when they arrive (" + JSON.stringify(late) + ")");
  } catch (e) { check(false, "exception in part 2: " + (e && e.stack)); }
  check(errors.length === 0, "part 2: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- 3. the boot card ---------- */
{
  // a module that does not load: three.js is missing
  const noThree = async (ctx) => ctx.route(/three\.module\.min\.js$/, (r) => r.abort("failed"));
  const { browser, page } = await launch({ route: noThree, waitTitle: false });
  try {
    const t0 = Date.now();
    await page.waitForSelector("#boot[data-state='error']", { timeout: 10000 });
    const card = await page.evaluate(() => ({ kind: document.getElementById("boot").dataset.kind, msg: document.getElementById("bootMsg").textContent, btn: document.getElementById("bootRetry").textContent, shown: document.getElementById("bootRetry").offsetParent !== null }));
    check(card.kind === "load" && card.msg === "The game did not load." && card.btn === "Try again" && card.shown, "a module that does not load: the card says so in " + ((Date.now() - t0) / 1000).toFixed(1) + " s, with Try again (" + JSON.stringify(card) + ")");
    const origin0 = await page.evaluate(() => performance.timeOrigin);
    await page.click("#bootRetry");
    await page.waitForFunction((o) => performance.timeOrigin !== o, origin0, { timeout: 15000 });
    await page.waitForSelector("#boot[data-state='error']", { timeout: 10000 });
    check(true, "Try again reloads the game (and the card comes back while three.js is still missing)");
  } catch (e) { check(false, "exception in part 3a: " + (e && e.message)); }
  await browser.close();
}
{
  // no WebGL: the canvas gives no 3D context
  const noGL = () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/i.test(k) ? null : g.call(this, k, ...a); }; };
  const { browser, page } = await launch({ init: [[noGL]], waitTitle: false });
  try {
    await page.waitForSelector("#boot[data-state='error']", { timeout: 60000 });
    const card = await page.evaluate(() => ({ kind: document.getElementById("boot").dataset.kind, msg: document.getElementById("bootMsg").textContent, sub: document.getElementById("bootSub").textContent }));
    check(card.kind === "webgl" && card.msg === "This device cannot draw the lake." && !/WebGL/.test(card.msg + card.sub), "no WebGL: the card says the device cannot draw the lake, in plain words (" + JSON.stringify(card) + ")");
  } catch (e) { check(false, "exception in part 3b: " + (e && e.message)); }
  await browser.close();
}
{
  // a title that is not ready after 15 s: world.js takes 18 s to arrive. The card shows, then goes when the title comes
  const slowWorld = async (ctx) => ctx.route(/\/js\/world\.js$/, async (r) => { await sleep(18000); r.continue().catch(() => {}); });
  const { browser, page, errors } = await launch({ route: slowWorld, waitTitle: false });
  try {
    const t0 = Date.now();
    await page.waitForSelector("#boot[data-state='error']", { timeout: 30000 });
    const s = (Date.now() - t0) / 1000, msg = await page.textContent("#bootMsg");
    check(s >= 12 && msg === "The lake is slow to load.", "a slow boot: the card comes at " + s.toFixed(1) + " s (" + msg + ")");
    await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
    await sleep(700);
    check(await page.evaluate(() => document.getElementById("boot").hidden), "and it goes when the title is ready");
  } catch (e) { check(false, "exception in part 3c: " + (e && e.message)); }
  check(errors.length === 0, "part 3c: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- 4. the store build ---------- */
// window.Capacitor as the app gives it: plugins by name, each call logged. prefs: what native storage holds at the
// start. delay: ms before Preferences.get answers (-1: never). Native storage outlives a reload (sessionStorage keeps it
// for the test), and every write to it is kept in qa-writes
function capStub({ prefs = {}, delay = 0 } = {}) {
  const kept = sessionStorage.getItem("qa-prefs");
  const log = (window.__cap = { calls: [], on: {}, prefs: kept ? JSON.parse(kept) : Object.assign({}, prefs) });
  const rec = (name) => () => { log.calls.push(name); return Promise.resolve(); };
  log.fire = (ev) => (log.on[ev] || []).forEach((f) => f({}));
  log.count = (name) => log.calls.filter((c) => c === name).length;
  const Plugins = {
    App: { addListener(ev, fn) { (log.on[ev] = log.on[ev] || []).push(fn); log.calls.push("App.on:" + ev); return Promise.resolve({ remove() {} }); }, minimizeApp: rec("App.minimizeApp") },
    SplashScreen: { hide: rec("SplashScreen.hide") },
    StatusBar: { hide: rec("StatusBar.hide") },
    KeepAwake: { keepAwake: rec("KeepAwake.keepAwake"), allowSleep: rec("KeepAwake.allowSleep") },
    Preferences: {
      get({ key }) {
        log.calls.push("Preferences.get:" + key);
        const v = { value: key in log.prefs ? log.prefs[key] : null };
        return delay < 0 ? new Promise(() => {}) : delay ? new Promise((r) => setTimeout(() => r(v), delay)) : Promise.resolve(v);
      },
      set({ key, value }) {
        log.calls.push("Preferences.set:" + key); log.prefs[key] = value;
        sessionStorage.setItem("qa-prefs", JSON.stringify(log.prefs));
        sessionStorage.setItem("qa-writes", JSON.stringify([...JSON.parse(sessionStorage.getItem("qa-writes") || "[]"), [key, value]]));
        return Promise.resolve();
      },
    },
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", isPluginAvailable: (n) => n in Plugins, Plugins };
}
{
  const { browser, page, errors, requests } = await launch({ init: [[capStub, {}]], save: { v: 1, input: "touch" }, query: "?open" });
  const cap = () => page.evaluate(() => ({ calls: window.__cap.calls.slice(), prefs: { ...window.__cap.prefs } }));
  const count = (name) => page.evaluate((n) => window.__cap.count(n), name);
  const back = async () => { await page.evaluate(() => window.__cap.fire("backButton")); await sleep(150); };
  const shown = (id) => page.evaluate((id) => !document.getElementById(id).hidden, id);
  try {
    const t = await page.evaluate(() => ({ build: document.documentElement.dataset.build, kick: document.getElementById("tkick").textContent, sw: !!window.GameSwitch }));
    const tb = await visibleButtons(page, "#tmenu .btn");
    check(t.build === "store" && t.kick === "LOON LAKE" && !t.sw, "store: the page is the store build, the kicker is the place alone, no switcher (" + JSON.stringify(t) + ")");
    check(!requests.some((u) => /\/arcade\/switch\.js/.test(u) || /\/wild\//.test(u)), "store: the arcade script is not loaded and nothing probes /wild/");
    check(tb.length === 6 && !tb.some((b) => /Switch game|arcade|Fullscreen/.test(b)), "store: the title menu has six controls (" + tb.join(" | ") + ")");
    const all = await visibleButtons(page, "#title button, #title a");
    check(!all.some((b) => /Switch game|arcade|Fullscreen/.test(b)), "store: nothing of the arcade anywhere on the title (" + all.join(" | ") + ")");
    const c = await cap();
    check(c.calls.includes("SplashScreen.hide") && c.calls.includes("StatusBar.hide"), "store: the splash hides when the title is ready, and the status bar hides");
    check(["App.on:backButton", "App.on:pause", "App.on:resume"].every((n) => c.calls.includes(n)), "store: the game listens for back, pause and resume");
    check(!c.calls.includes("Preferences.get:fish.v1"), "store: with a save in web storage, the game does not wait for native storage");

    // back on the title: the app goes to the background
    await back();
    check((await count("App.minimizeApp")) === 1 && (await shown("title")), "back on the title sends the app to the background");
    // back closes each screen of the title
    for (const [btn, id] of [["#helpBtn", "help"], ["#setBtn", "settings"], ["#journalBtn", "journal"], ["#placesBtn", "places"]]) {
      await click(page, btn);
      await page.waitForSelector("#" + id + ":not([hidden])");
      if (id === "settings") { const fb = await visibleButtons(page, "#settings .btn"); check(!fb.some((b) => /Fullscreen/.test(b)), "store: Settings has no Fullscreen button (" + fb.join(" | ") + ")"); }
      await back();
      check(!(await shown(id)) && (await shown("title")), "back closes " + id);
    }
    check((await count("App.minimizeApp")) === 1, "no back on a screen sent the app away");

    // play: back pauses, a second back resumes; keep awake follows
    await click(page, "#freeBtn");
    await until(page, () => FISH.G.phase === "cast", null, 30000);
    await sleep(200);
    check((await count("KeepAwake.keepAwake")) >= 1, "store: the screen stays awake while the player fishes");
    await back();
    check((await shown("pause")) && (await page.evaluate(() => FISH.G.paused)), "back in the cast pauses the game");
    const pb = await visibleButtons(page, "#pause .btn");
    check(pb.join("|") === "Resume|How to play|Journal|Settings|Quit to the title", "store: the pause card shows Resume, How to play, Journal, Settings, Quit to the title (" + pb.join(" | ") + ")");
    check((await count("KeepAwake.allowSleep")) >= 1, "store: a paused game lets the screen sleep");
    await click(page, "#pHelp");
    await page.waitForSelector("#help:not([hidden])");
    await back();
    check((await shown("pause")) && !(await shown("help")), "back on Help over the pause card goes back to the pause card");
    await back();
    check(!(await shown("pause")) && !(await page.evaluate(() => FISH.G.paused)), "a second back resumes");

    // a fight: back pauses and resumes; the app going to the background pauses it, and the sound comes back with Resume
    await stage(page);
    await sleep(300);
    await back();
    check((await page.evaluate(() => FISH.G.paused && FISH.G.phase === "reel")) && (await shown("pause")), "back in a fight pauses it");
    await back();
    check(!(await page.evaluate(() => FISH.G.paused)), "and a second back resumes the fight");
    await page.evaluate(() => {
      window.__snd = [];
      for (const n of ["setAmbience", "sfx", "init"]) { const f = FISH.Sound[n]; FISH.Sound[n] = function (...a) { window.__snd.push(n + ":" + a[0]); return f.apply(this, a); }; }
    });
    await page.evaluate(() => window.__cap.fire("pause"));
    await sleep(200);
    check((await shown("pause")) && (await page.evaluate(() => FISH.G.paused && __snd.includes("setAmbience:false"))), "the app goes to the background in a fight: the pause screen, and the lake goes quiet");
    await page.evaluate(() => window.__cap.fire("resume"));
    await sleep(200);
    check((await shown("pause")) && (await page.evaluate(() => __snd.includes("setAmbience:true"))), "the app comes back: still paused, the lake sounds again");
    await click(page, "#resumeBtn");
    check(!(await page.evaluate(() => FISH.G.paused)) && (await page.evaluate(() => __snd.includes("sfx:ui"))), "Resume plays on, with sound");

    // the catch card (a catch always saves): the save goes to native storage too, and back presses the main button
    await landFish(page);
    const mirror = await page.evaluate(() => ({ set: window.__cap.calls.includes("Preferences.set:fish.v1"), same: window.__cap.prefs["fish.v1"] === localStorage.getItem("fish.v1"), perch: /perch/.test(window.__cap.prefs["fish.v1"] || "") }));
    check(mirror.set && mirror.same && mirror.perch, "store: the save, with the new catch, is mirrored to native storage (" + JSON.stringify(mirror) + ")");
    await back();
    await until(page, () => FISH.G.phase === "cast", null, 15000).catch(() => {});
    check(!(await shown("catch")) && (await page.evaluate(() => FISH.G.phase === "cast")), "back on the catch card casts again");
    // a walleye of 3.6 kg opens Stump Bay: back on its catch card presses Next, back on the card of the new place stays here
    await landFish(page, { id: "walleye", name: "Walleye", kg: 3.6, cm: 62, junk: false });
    check((await page.textContent("#catchGo")) === "Next", "a catch that opens a place says Next");
    await back();
    await page.waitForSelector("#unlock:not([hidden])", { timeout: 15000 });
    await back();
    await until(page, () => FISH.G.phase === "cast", null, 15000).catch(() => {});
    check(!(await shown("unlock")) && (await page.evaluate(() => FISH.G.phase === "cast" && FISH.G.place.id === "loon")), "back on the card of a new place stays here and fishes on");
    // the results: back on the last catch card shows the results, back on the results fishes again
    await page.evaluate(() => { FISH.startMode("derby"); FISH.G.castsLeft = 0; });
    await landFish(page);
    check((await page.textContent("#catchGo")) === "See the results", "the last derby catch says See the results");
    await back();
    await page.waitForSelector("#results:not([hidden])", { timeout: 15000 });
    check(true, "back on the catch card shows the results");
    await back();
    await until(page, () => FISH.G.phase === "cast" && FISH.G.mode === "derby" && FISH.G.castsLeft === 10, null, 15000).then(() => check(true, "back on the results presses Fish again"), () => check(false, "back on the results presses Fish again"));
    // a place that loads: back does nothing; then back on the arrival card presses Start
    await page.evaluate(() => FISH.toTitle());
    await click(page, "#placesBtn");
    await page.waitForSelector("#places:not([hidden])");
    // back is pressed from inside the page the moment the travel card shows: on a slow machine the place can build in
    // one long task, and the card may be gone before a test poll sees it
    await page.evaluate(() => {
      const el = document.getElementById("travel");
      window.__trip = null;
      const mo = new MutationObserver(() => {
        if (el.hidden || window.__trip) return;
        const m0 = window.__cap.count("App.minimizeApp");
        window.__cap.fire("backButton");
        window.__trip = { screen: document.body.dataset.screen, travel: !el.hidden, minimized: window.__cap.count("App.minimizeApp") - m0 };
        mo.disconnect();
      });
      mo.observe(el, { attributes: true, attributeFilter: ["hidden"] });
    });
    await sleep(PAUSE);
    await page.click("#plist .pcard[data-place='stumps'] .btn");
    await page.waitForSelector("#arrive:not([hidden])", { timeout: 60000 });
    const trip = await page.evaluate(() => window.__trip);
    check(!!trip && trip.travel && trip.screen === "travel" && trip.minimized === 0, "back while a place loads does nothing (" + JSON.stringify(trip) + ")");
    await back();
    check((await shown("title")) && (await page.textContent("#tkick")) === "STUMP BAY", "back on the arrival card starts at the new place (" + (await page.textContent("#tkick")) + ")");
  } catch (e) { check(false, "exception in part 4: " + (e && e.stack)); }
  check(errors.length === 0, "part 4: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}
{
  // motion denied in the app: the app copy, and touch play starts
  const denied = () => {
    for (const C of [window.DeviceMotionEvent, window.DeviceOrientationEvent]) if (C) Object.defineProperty(C, "requestPermission", { value: () => Promise.resolve("denied"), configurable: true });
  };
  const { browser, page, errors } = await launch({ init: [[capStub, {}], [denied]], phone: false });
  try {
    await click(page, "#derbyBtn");
    await page.waitForSelector("#setup:not([hidden])");
    // every toast, as it shows: a gold ring can rise in the first second of the derby and say so over it
    await page.evaluate(() => { const t = document.getElementById("toast"); window.__toasts = []; new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
    await click(page, "#useMotion");
    await until(page, () => FISH.G.phase === "cast", null, 30000);
    await sleep(100);
    const r = await page.evaluate(() => ({ toasts: window.__toasts, input: FISH.G.input, setup: !document.getElementById("setup").hidden }));
    check(r.toasts.includes("Motion is off for Reel It In. You can turn it on in Settings. You can play with touch now.") && r.input === "touch" && !r.setup, "store: motion denied gives the app copy, and touch play starts (" + JSON.stringify(r) + ")");
    const all = await page.evaluate(() => document.getElementById("game").innerText);
    check(!/Safari|site settings|browser/i.test(all), "store: no word of Safari, site settings or a browser on the screen");
  } catch (e) { check(false, "exception in part 4b: " + (e && e.message)); }
  check(errors.length === 0, "part 4b: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}
{
  // the phone cleared web storage: the save and the two switches come back from native storage
  const kept = { v: 1, input: "touch", casts: 30, caught: 4, journal: { perch: { n: 3, kg: 0.6, cm: 30 } }, place: "stumps", places: { loon: { open: 1, d: 0, kg: 3.8, id: "pike", n: 4, lg: 0 }, stumps: { open: 1, d: 0, kg: 0, id: null, n: 0, lg: 0 } }, seen: { "at.stumps": 1, "opened.stumps": 1 }, quality: "low", reelSide: "left" };
  const prefs = { "fish.v1": JSON.stringify(kept), "fish.haptics": "false", "arcade.sound": "false", "reel-it-in-guide-v1": "shown" };
  const { browser, page, errors } = await launch({ init: [[capStub, { prefs }]] });
  try {
    const r = await page.evaluate(() => ({ j: FISH.save.journal.perch, open: FISH.save.places.stumps && FISH.save.places.stumps.open, place: FISH.G.place.id, side: FISH.save.reelSide, q: FISH.save.quality,
      hx: FISH.Haptics.enabled, snd: FISH.Sound.isOn(), ls: !!localStorage.getItem("fish.v1"), kick: document.getElementById("tkick").textContent }));
    check(r.j && r.j.n === 3 && r.open === 1 && r.place === "stumps" && r.side === "left" && r.q === "low", "web storage cleared: the journal, the places and the settings are back (" + JSON.stringify(r) + ")");
    check(r.hx === false && r.snd === false && (await page.evaluate(() => localStorage.getItem("reel-it-in-guide-v1"))) === "shown", "and the buzz, sound and guide switches are back");
    check(r.ls, "and the save is written back to web storage");
    check(await page.evaluate(() => window.__cap.calls.includes("Preferences.get:fish.v1")), "an empty web storage asked native storage for the save");
  } catch (e) { check(false, "exception in part 4c: " + (e && e.message)); }
  check(errors.length === 0, "part 4c: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}
const kept4 = { v: 1, input: "touch", casts: 30, caught: 4, journal: { perch: { n: 3, kg: 0.6, cm: 30 } }, place: "loon", places: { loon: { open: 1, d: 0, kg: 3.8, id: "pike", n: 4, lg: 0 } }, seen: {} };
// one change in Settings (Easy mode), which saves
async function changeSetting(page) {
  await click(page, "#setBtn");
  await page.waitForSelector("#settings:not([hidden])");
  await click(page, "#optAssist");
  await sleep(300);
  await click(page, "#settings [data-close]");
}
{
  // web storage cleared, and native storage answers after 600 ms (the 400 ms of the boot are over): the game waits for
  // that answer before it writes to native storage, then starts again with the save it held
  const { browser, page, errors } = await launch({ init: [[capStub, { prefs: { "fish.v1": JSON.stringify(kept4) }, delay: 600 }]], waitTitle: false });
  try {
    await page.waitForFunction(() => performance.getEntriesByType("navigation")[0].type === "reload" && !document.getElementById("title").hidden, null, { timeout: 180000 });
    const r = await page.evaluate(() => ({ j: FISH.save.journal.perch, caught: FISH.save.caught, ls: /perch/.test(localStorage.getItem("fish.v1") || ""), unread: localStorage.getItem("fish.native-unread") }));
    check(r.j && r.j.n === 3 && r.caught === 4 && r.ls && r.unread == null, "a late native answer: the game starts again once, with the journal back (" + JSON.stringify(r) + ")");
    await changeSetting(page);
    const w = await page.evaluate(() => ({ writes: JSON.parse(sessionStorage.getItem("qa-writes") || "[]").filter((x) => x[0] === "fish.v1").map((x) => JSON.parse(x[1])), now: JSON.parse(window.__cap.prefs["fish.v1"]) }));
    check(w.writes.length >= 1 && w.writes.every((x) => x.journal.perch && x.caught === 4) && w.now.assist === false,
      "native storage is never covered by a blank save, and the next save goes there in full (" + w.writes.length + " writes, " + JSON.stringify(w.writes.map((x) => x.caught)) + ")");
  } catch (e) { check(false, "exception in part 4d: " + (e && e.stack)); }
  check(errors.length === 0, "part 4d: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}
{
  // native storage never answers: the game boots, plays and saves to web storage, writes nothing to native storage,
  // and marks the read for the next start
  const { browser, page, errors } = await launch({ init: [[capStub, { prefs: { "fish.v1": JSON.stringify(kept4) }, delay: -1 }]] });
  try {
    await changeSetting(page);
    await sleep(300);
    const r = await page.evaluate(() => ({ sets: window.__cap.calls.filter((c) => c.startsWith("Preferences.set")), unread: localStorage.getItem("fish.native-unread"), ls: !!localStorage.getItem("fish.v1"), reload: performance.getEntriesByType("navigation")[0].type }));
    check(r.sets.length === 0 && r.unread === "1" && r.ls && r.reload !== "reload", "native storage that never answers: the game plays, saves to web storage only, and asks again next time (" + JSON.stringify(r) + ")");
  } catch (e) { check(false, "exception in part 4e: " + (e && e.stack)); }
  check(errors.length === 0, "part 4e: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- 5 and 6. the GL context, the render scale, the lake under opaque screens ---------- */
{
  const { browser, page, errors } = await launch({ save: { v: 1, input: "touch" } });
  try {
    // count the draws of the lake and the frames of the loop
    await page.evaluate(() => {
      const w = FISH.world, r = w.render;
      window.__draws = 0; window.__raf = 0;
      w.render = function (...a) { window.__draws++; return r.apply(this, a); };
      const tick = () => { window.__raf++; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const rate = async (ms) => { const a = await page.evaluate(() => [__draws, __raf]); await sleep(ms); const b = await page.evaluate(() => [__draws, __raf]); return { draws: b[0] - a[0], frames: b[1] - a[1], fps: ((b[0] - a[0]) * 1000) / ms }; };
    await sleep(800);
    const title = await rate(5000);
    check(title.fps <= 15, "the painted title at rest: the lake draws " + title.draws + " times in 5 s (" + title.frames + " loop frames), 15 a second at most");
    await click(page, "#journalBtn");
    await page.waitForSelector("#journal:not([hidden])");
    await sleep(300);
    const jr = await rate(2000);
    check(jr.draws <= 1, "the journal over the lake: " + jr.draws + " draws in 2 s");
    await click(page, "#journal [data-close]");
    // the title over the live lake (the Original style) draws it at 15 frames a second at most, and it still moves.
    // The draw is stubbed for this, so the loop runs as fast as the screen and only the throttle holds the lake back
    await click(page, "[data-art='original']");
    await sleep(1500);
    const art = await page.evaluate(() => document.body.dataset.artStyle);
    await page.evaluate(() => { const w = FISH.world; window.__render = w.render; w.render = function () { window.__draws++; }; });
    const og = await rate(3000);
    await page.evaluate(() => { FISH.world.render = window.__render; });
    check(art === "original" && og.draws >= 15 && og.draws <= 46 && og.frames > og.draws, "the Original title: the lake draws " + og.draws + " times in 3 s (" + og.frames + " loop frames, style " + art + "), 15 a second at most");
    await click(page, "#freeBtn");
    await until(page, () => FISH.G.phase === "cast", null, 30000);
    await sleep(500);
    const play = await rate(3000);
    check(play.frames > 0 && play.draws >= play.frames * 0.9, "play draws at the full rate (" + play.draws + " draws in " + play.frames + " frames)");
    // the render scale steps on the frame after the one draw under the pause screen: the new pixel ratio clears the
    // canvas, and the loop draws the lake again
    await page.evaluate(() => {
      const w = FISH.world, f = w.frameTime;
      w.frameTime = function (ms) {
        if (!FISH.G.stillDrawn) return f.call(w, ms);
        w.frameTime = f;
        window.__stepAt = window.__draws;
        w.renderer.setPixelRatio(w.renderer.getPixelRatio());
        return true;
      };
      window.__d0 = window.__draws;
      document.getElementById("pauseBtn").click();
    });
    await sleep(1200);
    const ps = await page.evaluate(() => ({ draws: __draws - __d0, stepAt: window.__stepAt - __d0, paused: FISH.G.paused, stillDrawn: FISH.G.stillDrawn }));
    check(ps.paused && ps.stepAt === 1 && ps.draws === 2 && ps.stillDrawn, "a new pixel ratio under the pause screen draws the still lake again (" + JSON.stringify(ps) + ")");
    await click(page, "#resumeBtn");

    // the render scale in the page: one hitch changes nothing, a slow stretch lowers the pixel ratio, fast frames bring it back
    const rs = await page.evaluate(() => {
      const w = FISH.world, px = () => +w.renderer.getPixelRatio().toFixed(3), out = {};
      // 40 s of fast frames: whatever the slow software renderer did to the scale before is undone and forgotten
      for (let i = 0; i < 2400; i++) w.frameTime(1000 / 60);
      out.start = { s: w.info().scale, px: px() };
      w.frameTime(140);
      for (let i = 0; i < 120; i++) w.frameTime(1000 / 60);
      out.hitch = { s: w.info().scale, px: px() };
      for (let i = 0; i < 60; i++) w.frameTime(40);
      out.slow = { s: w.info().scale, px: px() };
      for (let i = 0; i < 240; i++) w.frameTime(1000 / 60);
      out.back = { s: w.info().scale, px: px() };
      return out;
    });
    check(rs.start.s === 1 && rs.hitch.s === 1 && rs.hitch.px === rs.start.px, "render scale: a 140 ms hitch at 60 Hz leaves it at 1 (" + JSON.stringify(rs.hitch) + ")");
    check(rs.slow.s < 1 && rs.slow.px < rs.start.px, "render scale: 2 s of slow frames lower it, and the pixel ratio with it (" + JSON.stringify(rs.slow) + ")");
    check(rs.back.s === 1 && rs.back.px === rs.start.px, "render scale: 4 s of fast frames bring it back (" + JSON.stringify(rs.back) + ")");

    // a context lost in a fight, restored 1 s later
    await stage(page);
    await sleep(500);
    await page.evaluate(() => { window.__lc = FISH.world.renderer.getContext().getExtension("WEBGL_lose_context"); window.__lc.loseContext(); });
    await until(page, () => FISH.G.paused && !document.getElementById("pause").hidden, null, 10000).then(() => check(true, "context lost in a fight: the pause screen shows"), () => check(false, "context lost in a fight: the pause screen shows"));
    // Resume, Escape and back wait while the lake is not there: the fight does not go on unseen
    await sleep(PAUSE);
    const held = () => page.evaluate(() => ({ paused: FISH.G.paused, pause: !document.getElementById("pause").hidden, steps: window.__simSteps - window.__s0, disabled: document.getElementById("resumeBtn").disabled, note: document.getElementById("pauseSum").textContent.split("\n")[0] }));
    await page.evaluate(() => { window.__s0 = window.__simSteps; document.getElementById("resumeBtn").click(); });
    await sleep(500);
    const lost = await held();
    check(lost.paused && lost.pause && lost.steps === 0 && lost.disabled && lost.note === "The lake is coming back.", "while the context is lost, Resume waits and the fight stands still (" + JSON.stringify(lost) + ")");
    await page.evaluate(() => { window.__s0 = window.__simSteps; });
    await page.keyboard.press("Escape");
    await sleep(500);
    const esc = await held();
    check(esc.paused && esc.pause && esc.steps === 0, "and Escape waits too (" + JSON.stringify(esc) + ")");
    const d0 = await page.evaluate(() => __draws);
    await page.evaluate(() => window.__lc.restoreContext());
    await until(page, () => !FISH.world.lost && !FISH.G.ctxLost, null, 20000);
    await sleep(800);
    const under = await page.evaluate((d0) => ({ draws: __draws - d0, paused: FISH.G.paused, geo: FISH.world.renderer.info.memory.geometries, calls: FISH.world.info().calls }), d0);
    check(under.paused && under.draws >= 1 && under.geo > 0 && under.calls > 0, "restored under the pause screen: the lake draws again (" + JSON.stringify(under) + ")");
    const back = await page.evaluate(() => ({ disabled: document.getElementById("resumeBtn").disabled, note: /coming back/.test(document.getElementById("pauseSum").textContent) }));
    check(!back.disabled && !back.note, "and Resume works again (" + JSON.stringify(back) + ")");
    await click(page, "#resumeBtn");
    await sleep(800);
    const after = await page.evaluate(() => {
      const w = FISH.world, gl = w.renderer.getContext(), c = gl.canvas, px = new Uint8Array(4);
      w.update(0.016); w.render();
      gl.readPixels(c.width >> 1, c.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return { phase: FISH.G.phase, sim: FISH.G.sim && FISH.G.sim.state.phase, px: [...px], paused: FISH.G.paused };
    });
    const afterRate = await rate(1500);
    check(after.phase === "reel" && after.sim === "fight" && !after.paused && after.px.some((v) => v > 0) && afterRate.draws > 0, "after Resume the lake draws and the fight goes on (" + JSON.stringify({ ...after, draws: afterRate.draws }) + ")");
    // a context that never comes back: the card, which goes when it does come back
    await page.evaluate(() => { window.__lc = FISH.world.renderer.getContext().getExtension("WEBGL_lose_context"); window.__lc.loseContext(); });
    await page.waitForSelector("#boot[data-state='error'][data-kind='gpu']", { timeout: 15000 }).then(() => check(true, "a context that stays lost gets a card with Try again"), () => check(false, "a context that stays lost gets a card with Try again"));
    check((await page.textContent("#bootMsg")) === "The lake stopped drawing.", "the card says the lake stopped drawing");
    await page.evaluate(() => window.__lc.restoreContext());
    await until(page, () => document.getElementById("boot").hidden, null, 20000).then(() => check(true, "the card goes when the context comes back"), () => check(false, "the card goes when the context comes back"));
  } catch (e) { check(false, "exception in parts 5-6: " + (e && e.stack)); }
  const real = errors.filter((e) => !/Context Lost|Context Restored|CONTEXT_LOST/i.test(e));
  check(real.length === 0, "parts 5-6: no page errors" + (real.length ? ":\n" + real.join("\n") : ""));
  await browser.close();
}

console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
process.exit(fails.length ? 1 : 0);
