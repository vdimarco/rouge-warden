// The messages in play keep clear of the lure (the fish-feedback spec, "Messages clear of the lure"), in the real page:
// a cast lands at 15, 35 and 55 m, and while the cast report is up, and after it, no message covers the lure on the
// water: the prompt and its sub, the cast report, the banner and a toast. The report also stays clear of the gauge, the
// HUD and the prompt, and on the screen. Motion play at 360x640, 390x844, 412x915 and 430x932 (and the reel on the left),
// touch play at 390x844, 844x390 and 640x360, and Larger text at 360x640 and 844x390.
// Each read waits for the state it checks, in a frame that shows it: the report up 0.7 s and 1.5 s after the landing on
// the lake's clock (the camera on its way, then settled), and then the report gone.
// Serve public/ first, then: NODE_PATH=qa/browser/node_modules node qa/fish/messages.e2e.mjs   (FISH_URL sets the address,
// PARTS=goal runs only the goal toast check)
// Exits with code 1 when something fails.
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { URL, installPhone, until, SEEN } from "./lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"];
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
// until(), and when the time is up an error that says what did not come
const waitFor = (page, what, fn, arg, ms = 60000) => until(page, fn, arg, ms).catch(() => { throw new Error(`no ${what} in ${ms / 1000} s`); });
// room kept around the lure, in CSS px: the lure, its splash and the first ring
const PAD = 22;
const DISTS = [15, 35, 55];

const RUNS = [
  { input: "motion", sizes: [[360, 640], [390, 844], [412, 915], [430, 932]] },
  { input: "motion", reelSide: "left", sizes: [[412, 915]] },
  { input: "touch", sizes: [[390, 844], [844, 390], [640, 360]] },
  { input: "motion", large: true, sizes: [[360, 640]] },
  { input: "touch", large: true, sizes: [[844, 390]] },
];

// what the page shows: the boxes of the messages, the gauge, the HUD, and the lure on the screen
function look() {
  const box = (e) => { if (!e || e.closest("[hidden]") || !e.getClientRects().length) return null; const cs = getComputedStyle(e); if (cs.visibility === "hidden" || +cs.opacity < 0.05) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { x: r.left, y: r.top, r: r.right, b: r.bottom } : null; };
  const q = (s) => box(document.querySelector(s));
  const t = document.querySelector("#toast");
  const v = document.querySelector("#view").getBoundingClientRect(), L = FISH.world.lureScreen();
  return {
    lure: L && { x: L.x + v.left, y: L.y + v.top },
    msgs: { prompt: q("#prompt .p1"), sub: q("#prompt .p2"), dist: q("#report .dist"), verdict: q("#report .verdict"), zone: q("#report .zone"), banner: q("#banner b"), toast: t.classList.contains("on") ? box(t) : null },
    report: q("#report"), gauge: q("#gaugeBox"), hud: q("#hud"), layout: FISH.G.layout, W: innerWidth, H: innerHeight,
  };
}
const hit = (a, b) => !!a && !!b && a.x < b.r - 1 && a.r > b.x + 1 && a.y < b.b - 1 && a.b > b.y + 1;
const near = (m, L) => !!m && !!L && m.x < L.x + PAD && m.r > L.x - PAD && m.y < L.y + PAD && m.b > L.y - PAD;
const fmt = (b) => b ? `${Math.round(b.y)}-${Math.round(b.b)}` : "-";

// In the page. __when(ok): look() in the first frame in which ok() holds, read after the game's own work in that frame. A
// slow software renderer may draw no frame for seconds, so the limit counts frames: null when ok() did not hold in 3600
// frames (a minute at 60 fps), or when no frame came for a minute.
// The hold: the landing's report, and a toast that shows after the landing, stay up while the test holds them. One whose
// time came goes when the test lets it go (__let). The lake's clock moves the camera, at most 50 ms a frame, so on slow
// frames the camera settles long after the report's 2.6 s. At 60 fps the camera settles first, and the hold does nothing.
// The landing's sim runs on the lake's clock too while the test reads (see land): at 60 fps that changes nothing
function helpers() {
  const G = FISH.G, r = document.querySelector("#report"), t = document.querySelector("#toast");
  window.__late = "it did not come in 3600 frames, or no frame came for a minute";
  window.__when = (ok) => new Promise((done) => {
    const f0 = G.frame;
    let last = f0, at = performance.now();
    const go = () => {
      if (ok()) return done(window.__look());
      if (G.frame !== last) { last = G.frame; at = performance.now(); }
      if (G.frame - f0 > 3600 || performance.now() - at > 60000) return done(null);
      requestAnimationFrame(go);
    };
    requestAnimationFrame(go);
  });
  const hold = (window.__hold = { report: false, toast: false, fresh: false, due: {} }), H = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hidden");
  Object.defineProperty(r, "hidden", { configurable: true, get() { return H.get.call(this); }, set(v) {
    if (v && hold.report) { hold.due.report = true; return; }
    H.set.call(this, v);
  } });
  // (a toast that was up before the landing goes at its own time)
  new MutationObserver((l) => {
    if (!hold.toast) return;
    if (l.some((m) => m.type === "childList")) hold.fresh = true;
    if (hold.fresh && !t.classList.contains("on") && l.some((m) => m.type === "attributes" && (m.oldValue || "").split(" ").includes("on"))) { hold.due.toast = true; t.classList.add("on"); }
  }).observe(t, { childList: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  window.__let = (k) => { hold[k] = false; if (hold.due[k]) { hold.due[k] = false; if (k === "report") r.hidden = true; else t.classList.remove("on"); } };
  // nothing on the report or the toast moves: the report's pop, the toast's fade (a read in the frame that starts one
  // sees where it starts)
  window.__still = () => ![r, t].some((e) => e.getAnimations({ subtree: true }).some((a) => a.playState === "running" || a.pending));
}

// In the page: a cast lands d m out, straight ahead (as menus.e2e.mjs stages a landing). Returns what the page shows with
// the report up 0.7 s after the landing on the lake's clock (the camera on its way) and 1.5 s after it (the camera
// settled), and after the report, each in a frame in which the report and the toast are still
async function land(d) {
  const G = FISH.G, r = document.querySelector("#report"), clock = () => FISH.world.feel().clock, hold = window.__hold;
  const when = async (what, ok) => {
    const s = await window.__when(ok);
    if (!s) throw new Error(`${d} m: no ${what}: ${window.__late} (${G.phase}/${G.step}, the report ${r.hidden ? "hidden" : "up"}, lake clock ${clock().toFixed(2)} s)`);
    return s;
  };
  // a new cast, and 0.3 s on the lake's clock in its view
  FISH.newCast();
  let c = clock();
  await when("0.3 s of a new cast", () => clock() >= c + 0.3);
  Object.assign(hold, { report: true, toast: true, fresh: false, due: {} });
  G.cast = { verdict: "sweet", yaw: 0, stroke: 1 };
  G.step = "flight"; G.flight = { step: () => ({ x: 0, y: 0, z: -d, done: true, land: "water", lineOut: d, spool: 0 }) };
  await when("landing in the reel with the report up", () => G.phase === "reel" && !r.hidden);
  c = clock();
  // the landing's sim runs on the lake's clock, as the camera does. The page's clock runs ahead of both on slow frames,
  // and the lure would sink further, or a fish come, before the camera settles. At 60 fps the two clocks agree
  { const sim = G.sim, step = sim.step.bind(sim); let t = 0;
    sim.step = (dt, ...a) => { const room = clock() - c - t; if (room <= 0) return; dt = Math.min(dt, room); t += dt; return step(dt, ...a); }; }
  const out = [];
  for (const s of [0.7, 1.5]) out.push(await when(`report up ${s} s after the landing`, () => clock() >= c + s && window.__still()));
  window.__let("report");
  out.push(await when("end of the report", () => r.hidden && window.__still()));
  window.__let("toast");
  return out;
}

async function run({ input, reelSide = "right", large = false, sizes }) {
  const [W0, H0] = sizes[0];
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext({ viewport: { width: W0, height: H0 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/three.module.min.js", (r) => r.fulfill({ path: path.join(ROOT, "public/crimson/lib/three.module.min.js"), contentType: "application/javascript" }));
  const save = { v: 1, cuts: SEEN, input, assist: true, reelSide, place: "loon", casts: 140, caught: 61, longest: 30, seen: { run: 1, bite: 1, "ring.tip": 1, cast: 1, bail: 1 } };
  await page.addInitScript(([save, large]) => { localStorage.clear(); localStorage.setItem("fish.v1", JSON.stringify(save)); if (large) localStorage.setItem("fish.text", "large"); }, [save, large]);
  await page.addInitScript(installPhone);
  await page.goto(URL);
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  // (the double-tap guard holds back only a screen that a tap put up)
  await page.click("#freeBtn");
  await waitFor(page, "cast after Go fishing", () => FISH.G.phase === "cast");
  await page.evaluate(`window.__look = ${look}`);
  await page.evaluate(helpers);
  await page.evaluate(() => { FISH.rises.list = []; FISH.rises.spawn = () => null; FISH.world.setRings([]); });
  const name = `${input}${reelSide === "left" ? ", reel on the left" : ""}${large ? ", Larger text" : ""}`;
  for (const [W, H] of sizes) {
    await page.setViewportSize({ width: W, height: H });
    // the page lays itself out and draws at the new size, then the lake's clock runs 0.9 s (the camera moves by it)
    await page.evaluate(async ([W, H]) => {
      const G = FISH.G, v = document.querySelector("#view"), clock = () => FISH.world.feel().clock;
      if (!(await window.__when(() => innerWidth === W && innerHeight === H && G.vw === W && G.vh === H && Math.abs(FISH.world.camera.aspect - v.clientWidth / v.clientHeight) < 1e-3))) throw new Error(`no layout at ${W}x${H}: ${window.__late}`);
      const c = clock();
      if (!(await window.__when(() => clock() >= c + 0.9))) throw new Error(`no 0.9 s on the lake's clock at ${W}x${H}: ${window.__late}`);
    }, [W, H]);
    for (const d of DISTS) {
      const reads = await page.evaluate(land, d);
      for (const [i, when] of ["with the report", "with the report, the camera settled", "after the report"].entries()) {
        const s = reads[i];
        const on = Object.entries(s.msgs).filter(([, m]) => near(m, s.lure)).map(([k, m]) => k + " " + fmt(m));
        const tag = `${name} ${W}x${H}, ${d} m, ${when}`;
        check(!!s.lure && !on.length, `${tag}: no message covers the lure (lure ${s.lure ? Math.round(s.lure.x) + "," + Math.round(s.lure.y) : "not on screen"}${on.length ? "; on it: " + on.join(", ") : ""})`);
        // the report as it shows, while it is up: its distance, its verdict and its note
        const parts = [s.msgs.dist, s.msgs.verdict, s.msgs.zone].filter(Boolean);
        if (i < 2) {
          const r = s.report && parts.length ? { x: Math.min(...parts.map((b) => b.x)), y: Math.min(...parts.map((b) => b.y)), r: Math.max(...parts.map((b) => b.r)), b: Math.max(...parts.map((b) => b.b)) } : null, clash = r ? ["gauge", "hud"].filter((k) => hit(r, s[k])).concat(["prompt", "sub"].filter((k) => hit(r, s.msgs[k]))) : [];
          check(!!r && !clash.length && r.x >= 0 && r.r <= s.W && r.y >= 0, `${tag}: the report (${r ? fmt(r) : "not shown"}) is on the screen and clear of ${clash.length ? "all but " + clash.join(", ") : "the gauge, the HUD and the prompt"}`);
        }
      }
    }
  }
  check(!errors.length, `${name}: no page errors` + (errors.length ? " (" + errors.slice(0, 3).join(" | ") + ")" : ""));
  await browser.close();
}

// A cast that finishes a goal, in the tall reel: the report covers the toast while it is up, so the "Goal done" toast
// waits until the report goes, and then shows in full for its time (it showed for about 0.4 s when it came first)
async function goalToast() {
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/three.module.min.js", (r) => r.fulfill({ path: path.join(ROOT, "public/crimson/lib/three.module.min.js"), contentType: "application/javascript" }));
  const save = { v: 1, cuts: SEEN, input: "motion", assist: true, place: "loon", casts: 140, caught: 61, longest: 30, seen: { run: 1, bite: 1, "ring.tip": 1, cast: 1, bail: 1 } };
  await page.addInitScript((save) => { localStorage.clear(); localStorage.setItem("fish.v1", JSON.stringify(save)); }, save);
  await page.addInitScript(installPhone);
  await page.goto(URL);
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  await page.click("#freeBtn");
  await waitFor(page, "cast after Go fishing", () => FISH.G.phase === "cast");
  await page.evaluate(() => { FISH.rises.list = []; FISH.rises.spawn = () => null; FISH.world.setRings([]); });
  const g = await page.evaluate(async () => {
    const G = FISH.G, r = document.querySelector("#report"), t = document.querySelector("#toast"), out = { layout: "", on: 0, off: 0, under: false, covered: false, full: false };
    const frames = (n) => new Promise((done) => { const f = G.frame; const go = () => (G.frame >= f + n ? done() : requestAnimationFrame(go)); requestAnimationFrame(go); });
    // the goal toast's life on the page's clock: when it is put up (and whether the report was up then), and when it goes
    new MutationObserver(() => {
      const goal = /Goal done/.test(t.textContent), on = t.classList.contains("on");
      if (goal && on && !out.on) { out.on = performance.now(); out.under = !r.hidden; }
      if (out.on && !out.off && !on) out.off = performance.now();
    }).observe(t, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    // no toast up or waiting when the cast lands (the reminder of Go fishing waits 1.2 s at most behind another, on the page's
    // clock, as toasts do): a goal toast then has nothing to wait behind
    let moved = performance.now();
    new MutationObserver(() => { moved = performance.now(); }).observe(t, { attributes: true, attributeFilter: ["class"], childList: true });
    FISH.newCast();
    const fq = G.frame;
    while (t.classList.contains("on") || performance.now() - moved < 1500) {
      if (G.frame - fq > 3600) return out;
      await frames(1);
    }
    G.cast = { verdict: "sweet", yaw: 0, stroke: 1 };
    G.step = "flight"; G.flight = { step: () => ({ x: 0, y: 0, z: -55, done: true, land: "water", lineOut: 55, spool: 0 }) };
    // each frame until the toast goes: the layout of the reel, and a frame that shows the toast in full
    const f0 = G.frame;
    await new Promise((done) => {
      const go = () => {
        if (G.phase === "reel") out.layout = G.layout;
        if (out.on && !out.off && r.hidden && +getComputedStyle(t).opacity > 0.95) out.full = true;
        // (the report over the toast while it is up: the player does not see it)
        if (out.on && !out.off && !r.hidden) out.covered = true;
        if (out.off || G.frame - f0 > 3600) return done();
        requestAnimationFrame(go);
      };
      requestAnimationFrame(go);
    });
    return out;
  });
  const ms = g.on && g.off ? Math.round(g.off - g.on) : 0;
  check(g.layout === "tall-reel" && !!g.on && !g.under && !g.covered && g.full && ms >= 2900, `a cast of 55 m finishes "Cast 40 m." in the tall reel (${g.layout}): the goal toast comes after the report (${!g.on ? "it never came" : g.under || g.covered ? "the report covered it" : "it did"}), shows in full (${g.full}), and stays ${ms} ms (2900 or more)`);
  check(!errors.length, "goal toast: no page errors" + (errors.length ? " (" + errors.slice(0, 3).join(" | ") + ")" : ""));
  await browser.close();
}

// PARTS=goal runs only the goal toast check
if (process.env.PARTS !== "goal") for (const r of RUNS) await run(r);
await goalToast();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
