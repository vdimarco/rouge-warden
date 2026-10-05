// The first run, the menus and access (the fish-menus-access spec), in the real page:
//   the title (Go fishing first and red, Derby next, no art picker; 8 controls on the web and 6 in the store build), the
//   red button starts free fishing, the guide on a fresh save in motion and touch play (and off after the first fish),
//   How to play on the tab for the input with no scroll at 390x844, the settings rows, About and Privacy (open and close,
//   no network), the Painted style name, Larger text that fits at 360x640 (the rod cue's words, the gauge's fish name and
//   a long toast beside the bigger gauge too), Calm effects (no strike flash, no pulse, a still guide, the words and the
//   sound stay), the reel side mirror with no overlap, the drag beside the crank, the live regions and the
//   dialogs, the HUD chip at 360 px, the Space words on the rod cue, ?shot, and the numbers on the measuring board.
// Serve public/ first, then: NODE_PATH=qa/browser/node_modules node qa/fish/menus.e2e.mjs   (FISH_URL sets the address)
// PARTS=3 runs part 3 only. Exits with code 1 when something fails.
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { URL as FISH_URL, installPhone, until, sleep, SEEN } from "./lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"];
const PAUSE = 350;   // the double-tap guard ignores a click in the first 300 ms of a screen
const click = async (page, sel) => { await sleep(PAUSE); await page.click(sel); };
// PARTS=1,4 runs only those parts
const PARTS = process.env.PARTS ? process.env.PARTS.split(",") : null, part = (p) => !PARTS || PARTS.includes(p);
const shown = (page, id) => page.waitForSelector("#" + id + ":not([hidden])", { timeout: 30000 });

// the app: a stub Capacitor with no plugins, so the page is the store build and every native call does nothing
function capStub() { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", isPluginAvailable: () => false, Plugins: {} }; }

// a page: phone (touch and the virtual sensors) or a computer; save: a first save; local: first web storage keys
async function launch({ width = 390, height = 844, phone = true, query = "", save = null, local = null, init = [], scale = 1 } = {}) {
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext(phone ? { viewport: { width, height }, deviceScaleFactor: scale, isMobile: true, hasTouch: true } : { viewport: { width, height }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.route("**/three.module.min.js", (r) => r.fulfill({ path: path.join(ROOT, "public/crimson/lib/three.module.min.js"), contentType: "application/javascript" }));
  // every cutscene seen, as lib.mjs open() does, so the opening never holds up a check of the menus
  if (!(save && save.cuts)) save = { ...(save || {}), cuts: SEEN };
  await page.addInitScript(({ save, local }) => {
    if (sessionStorage.getItem("qa-kept")) return;
    localStorage.clear();
    if (save) localStorage.setItem("fish.v1", JSON.stringify(save));
    for (const [k, v] of Object.entries(local || {})) localStorage.setItem(k, v);
    sessionStorage.setItem("qa-kept", "1");
  }, { save, local });
  for (const fn of init) await page.addInitScript(fn);
  if (phone) await page.addInitScript(installPhone);
  await page.goto(FISH_URL + query);
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  await sleep(600);
  return { browser, page, errors };
}
const titleControls = (page) => page.evaluate(() => [...document.querySelectorAll("#title button, #title a")].filter((b) => b.offsetParent !== null && getComputedStyle(b).display !== "none").map((b) => ({ t: b.textContent.trim(), go: b.classList.contains("go"), id: b.id })));
const rect = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e || e.hidden || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const hit = (a, b) => !!a && !!b && a.x < b.r - 1 && a.r > b.x + 1 && a.y < b.b - 1 && a.b > b.y + 1;
// a fight with a stand-in for the sim, as screens.mjs stages one
const stage = (page, patch = {}) => page.evaluate((patch) => {
  const G = FISH.G;
  G.lastEvent = {}; G.hold = null; G.bail = "closed";
  G.sim = { fake: true, events: patch.events || [], step() {}, state: Object.assign({
    phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.4, slip: 0, dragN: 18, breakN: 45, lineOut: 20, slack: false, bend: 0.3,
    fish: { id: "walleye", kg: 2, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move: "swim", jump: 0, near: 0.5, known: true },
  }, patch, { events: undefined }) };
  if (G.phase !== "reel") FISH.enterReel();
}, patch);
// every screen that is open now: the screen itself does not scroll, and its main button is on the screen
const fits = (page) => page.evaluate(() => {
  const s = [...document.querySelectorAll(".screen")].find((e) => !e.hidden);
  if (!s) return { ok: false, why: "no screen" };
  const go = [...s.querySelectorAll(".btn.go, [data-close], [data-back]")].find((b) => b.offsetParent !== null);
  const r = go && go.getBoundingClientRect();
  const ok = s.scrollHeight <= s.clientHeight + 2 && (!go || (r.bottom <= innerHeight + 1 && r.top >= -1 && r.right <= innerWidth + 1));
  return { ok, id: s.id, scroll: [s.clientHeight, s.scrollHeight], go: go && go.textContent.trim(), bottom: r && Math.round(r.bottom) };
});

/* ---------- 1. a phone, a fresh save, the web build ---------- */
if (part("1")) {
  const { browser, page, errors } = await launch();
  try {
    // the title
    const tc = await titleControls(page);
    check(tc.length === 8 && tc[0].t === "Go fishing" && tc[0].go && tc[0].id === "freeBtn" && tc[1].t === "Derby: 10 casts" && !tc[1].go && tc.filter((b) => b.go).length === 1,
      "web title: Go fishing first and red, Derby: 10 casts next as a plain button, 8 controls (" + tc.map((b) => b.t).join(" | ") + ")");
    check(await page.evaluate(() => !document.querySelector("#title [data-art], #title .art-picker")), "the art style picker is not on the title");
    check(await page.evaluate(() => !/ghibli/i.test(document.documentElement.outerHTML) && FISH.save.artStyle === "painted" && document.body.dataset.artStyle === "painted"), "a new save has the Painted style, and the page has no \"ghibli\" in it");
    // dialogs and live regions
    const dl = await page.evaluate(() => [...document.querySelectorAll(".screen")].map((s) => { const h = document.getElementById(s.getAttribute("aria-labelledby") || ""); return { id: s.id, role: s.getAttribute("role"), modal: s.getAttribute("aria-modal"), name: h ? (h.getAttribute("aria-label") || h.textContent).trim() : null }; }));
    check(dl.every((d) => d.role === "dialog" && d.modal === "true" && d.name !== null) && dl.find((d) => d.id === "pause").name === "Paused" && dl.find((d) => d.id === "title").name === "Reel It In",
      "every screen is a dialog with aria-modal and a label (" + dl.filter((d) => !(d.role === "dialog" && d.name !== null)).map((d) => d.id).join(", ") + ")");
    check(await page.evaluate(() => { const t = document.querySelector("#toast"), s = document.querySelector("#say"); return t.getAttribute("role") === "status" && t.getAttribute("aria-live") === "polite" && s.getAttribute("aria-live") === "polite"; }), "the toast is a polite status, and the prompt has a polite live region");

    // How to play: a phone that has not chosen opens on Motion (it can play with motion); each tab fits with no scroll
    await click(page, "#helpBtn"); await shown(page, "help");
    const tabNow = () => page.evaluate(() => document.querySelector("#help [aria-selected='true']").textContent);
    check((await tabNow()) === "Motion", "a phone that can use motion opens How to play on Motion (" + (await tabNow()) + ")");
    for (const t of ["m", "t"]) {
      await click(page, `#help [data-tab='${t}']`);
      const h = await page.evaluate((t) => { const p = document.querySelector(t === "m" ? "#helpM" : "#helpT"); return { scroll: [p.clientHeight, p.scrollHeight], text: p.textContent, moves: !!p.querySelector("details.moves:not([open]) summary"), screen: document.querySelector("#help").scrollHeight <= document.querySelector("#help").clientHeight + 2, hidden: p.hidden }; }, t);
      check(!h.hidden && h.scroll[1] <= h.scroll[0] + 1 && h.screen, `the ${t === "m" ? "Motion" : "Touch"} tab fits with no scroll at 390x844 (${h.scroll.join(" / ")})`);
      check(/Rings on the water are rising fish/.test(h.text) && h.moves && /Fish moves/.test(h.text), `and it teaches the rising rings, with the fish moves behind a closed "Fish moves" row`);
      if (t === "t") check(/crank on the left with your left thumb/.test(h.text) && /right thumb works the rod/.test(h.text), "the touch tab tells of the crank on the left and the rod on the right");
    }
    await click(page, "#helpT summary");
    const mv = await page.evaluate(() => document.querySelector("#helpT .moves").open && document.querySelector("#helpT .moves").textContent);
    check(!!mv && /It jumps\. Drag the rod down\./.test(mv) && /It holds on the bottom\. Drag the rod up\. Reel as it comes down\./.test(mv), "the Fish moves row opens to the moves, in the words of the fight prompts");
    // the picture beside "A fish strikes?" points up on both tabs, as the words say ("Snap it up!", "Swipe it up!")
    const ups = await page.evaluate(() => [...document.querySelectorAll("#helpM .steps li, #helpT .steps li")].filter((li) => /strikes/.test(li.textContent)).map((li) => {
      const m = [...li.querySelectorAll("path")].map((p) => /M\s*[\d.]+\s+([\d.]+)\s*V\s*([\d.]+)/.exec(p.getAttribute("d") || "")).find(Boolean);
      return m ? +m[2] < +m[1] : null;
    }));
    check(ups.length >= 2 && ups.every((u) => u === true), "the hook row's arrow points up on the Motion and the Touch tab (" + JSON.stringify(ups) + ")");
    await click(page, "#help [data-close]");

    // Settings
    await click(page, "#setBtn"); await shown(page, "settings");
    const st = await page.evaluate(() => ({
      rows: [...document.querySelectorAll("#settings .set label")].map((l) => l.firstChild.textContent.trim().split("\n")[0]),
      art: [...document.querySelectorAll("#optArtStyle option")].map((o) => o.value + ":" + o.textContent).join(), artNow: document.querySelector("#optArtStyle").value,
      input: document.querySelector("#inputNote").textContent, about: document.querySelector("#aboutBtn").textContent, privacy: !!document.querySelector("#privacyRow"),
      head: document.querySelector("#settings .sethead").textContent, calm: document.querySelector("#calmNote").textContent,
    }));
    check(["Sound", "Buzz and taps", "Easy mode", "Controls", "Reel side", "Art style", "Graphics", "Larger text", "Calm effects"].every((r) => st.rows.some((x) => x.startsWith(r))) && st.head === "Easier play",
      "Settings has the rows, with Larger text and Calm effects under Easier play (" + st.rows.join(" | ") + ")");
    check(st.art === "original:Original,painted:Painted" && st.artNow === "painted", "the art style is Original or Painted, and Painted is chosen (" + st.art + ")");
    check(st.input === "You choose when you start.", "Controls on a phone that has not chosen: \"You choose when you start.\" (" + st.input + ")");
    check(/About\s*1\.0\.0/.test(st.about) && st.privacy, "an About row with the version, and a Privacy row (" + st.about + ")");
    const ss = await page.evaluate(() => [...document.querySelectorAll("#settings select, #settings .set label, #settings button")].filter((e) => e.offsetParent !== null).map((e) => [e.id || e.textContent.trim().slice(0, 12), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
    check(!ss.length, "every settings row, list and button is 44 px tall or more (" + JSON.stringify(ss) + ")");
    // About and Privacy
    await click(page, "#aboutBtn"); await shown(page, "about");
    const ab = await page.evaluate(() => document.querySelector("#about .card").textContent.replace(/\s+/g, " "));
    check(/Version 1\.0\.0/.test(ab) && /Made by Cottage Arcade/.test(ab), "About shows the version and a credit line (" + ab.trim() + ")");
    await click(page, "#privacyBtn"); await shown(page, "privacy");
    await page.waitForFunction(() => { const d = document.querySelector("#privacyFrame").contentDocument; return d && d.readyState === "complete" && /collects no personal data/.test(d.body.textContent); });
    check(await page.evaluate(() => new URL(document.querySelector("#privacyFrame").src).pathname.endsWith("/fish/privacy.html")), "Privacy shows the game's own privacy.html in a frame");
    await page.evaluate(() => document.querySelector("#privacyFrame").contentDocument.getElementById("back").click());
    await shown(page, "about");
    check(await page.evaluate(() => document.querySelector("#privacy").hidden), "the policy's own Back button closes it (a message to the game), back to About");
    await click(page, "#about [data-back]"); await shown(page, "settings");
    await click(page, "#privacyRow"); await shown(page, "privacy");
    await page.keyboard.press("Escape");
    await shown(page, "settings");
    check(await page.evaluate(() => document.querySelector("#privacy").hidden && !document.querySelector("#settings").hidden), "the Privacy row opens it straight from Settings, and Escape goes back to Settings");
    await click(page, "#settings [data-close]"); await shown(page, "title");
    check(true, "Done in Settings goes back to the title after About and Privacy");

    // the first play: motion. The guide shows its first step
    await click(page, "#freeBtn"); await shown(page, "setup");
    await click(page, "#useMotion");
    await until(page, () => FISH.G.phase === "cast" && FISH.G.mode === "free" && FISH.G.input === "motion", null, 30000);
    await page.evaluate(() => __phone.pose(88));
    await until(page, () => !document.querySelector("#fishGuide").hidden, null, 10000).catch(() => {});
    const g = await page.evaluate(() => ({ shown: !document.querySelector("#fishGuide").hidden, kick: document.querySelector("#fishGuide .guide-kicker").textContent, count: document.querySelector("#fishGuide .guide-count").textContent, label: document.querySelector("#guideToggle").getAttribute("aria-label"), bars: document.querySelector("#fishGuide .guide-track").offsetHeight > 0 }));
    check(g.shown && g.kick === "WATCH + TRY" && /^\d \/ 3$/.test(g.count) && g.bars && g.label === "Hide the moves guide", "a new player in motion play sees the guide on the first cast screen, with its step bars, and the ? button says it hides the guide (" + JSON.stringify(g) + ")");
    // the preview goes round the three cast moves only, never a reel move: watch it, frame by frame, until it starts again
    const loop = await page.evaluate(async () => {
      const el = document.querySelector("#fishGuide"), lessons = new Set(), captions = new Set(), t0 = performance.now();
      let top = false, wrapped = false;
      while (!wrapped && performance.now() - t0 < 40000) {
        const n = el.querySelector(".guide-count").textContent;
        lessons.add(el.dataset.lesson); captions.add(el.querySelector(".guide-caption").textContent);
        if (n === "3 / 3") top = true; else if (top && n === "1 / 3") wrapped = true;
        await new Promise((r) => requestAnimationFrame(r));
      }
      return { wrapped, lessons: [...lessons].sort(), captions: [...captions], step: FISH.G.step };
    });
    check(loop.wrapped && loop.lessons.join() === "back,cast,hold", "the first cast screen's guide goes round hold, back and cast only, 1 / 3 to 3 / 3 (" + JSON.stringify(loop) + ")");
    // the HUD behind a screen: no focus, no taps; the prompt headline reaches the live region
    await until(page, () => document.querySelector("#say").textContent === "Hold your thumb on the rod.", null, 5000).catch(() => {});
    check((await page.evaluate(() => document.querySelector("#say").textContent)) === "Hold your thumb on the rod.", "the live region says the prompt's headline");
    await page.evaluate(() => document.querySelector("#pauseBtn").click());
    await shown(page, "pause");
    check(await page.evaluate(() => document.querySelector("#hud").inert && document.querySelector("#castUI").inert && document.querySelector("#reelUI").inert), "while Pause is open, the HUD and the play controls are inert");
    await click(page, "#resumeBtn");
    check(await page.evaluate(() => !document.querySelector("#hud").inert), "and after Resume they work again");

    // a fight: the drag beside the crank, then the reel side on the left mirrors the crank, the drag and the gauge
    for (const side of ["right", "left"]) {
      await page.evaluate((side) => { FISH.save.reelSide = side; document.querySelector("#game").dataset.reelSide = side; FISH.relayout(true); }, side);
      await stage(page, {});
      await sleep(900);
      const L = await page.evaluate(() => { const R = (s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }; return { crank: R("#crankBox"), drag: R("#dragBar"), up: R("#dragUp"), down: R("#dragDown"), gauge: R("#gaugeBox"), prompt: R("#prompt .p1"), pull: document.querySelector("#pullStrength").hidden ? null : R("#pullStrength"), cue: document.querySelector("#rodCue").hidden ? null : R("#rodCue span"), W: innerWidth }; });
      const c = { x: L.crank.x + L.crank.w / 2, y: L.crank.y + L.crank.h / 2 }, d = (b) => Math.hypot(b.x + b.w / 2 - c.x, b.y + b.h / 2 - c.y);
      const parts = ["crank", "drag", "gauge", "prompt", "pull", "cue"].filter((k) => L[k]), over = [];
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) if (hit(L[parts[i]], L[parts[j]])) over.push(parts[i] + "/" + parts[j]);
      const leftSide = side === "left";
      const placed = leftSide ? c.x < L.W / 2 && L.gauge.x + L.gauge.w / 2 > L.W / 2 : c.x > L.W / 2 && L.gauge.x + L.gauge.w / 2 < L.W / 2;
      check(placed && !!L.cue && !over.length, `motion play, reel side ${side}: the crank ${leftSide ? "left and the gauge right" : "right and the gauge left"}, nothing overlaps, the rod cue's words neither (${over.join(", ") || "none"})`);
      check(L.up.w >= 44 && L.down.w >= 44 && d(L.up) < 200 && d(L.down) < 200 && L.up.x > L.down.x && Math.abs(L.up.y - L.down.y) < 1, `the drag buttons are 44 px or more, − and + side by side, within 200 px of the crank's centre (${Math.round(d(L.up))} and ${Math.round(d(L.down))} px)`);
    }
    await page.evaluate(() => { FISH.save.reelSide = "right"; document.querySelector("#game").dataset.reelSide = "right"; FISH.relayout(true); });
    // in the fight the guide shows the move to make now, with no step bars (the bars are the steps of the cast)
    await until(page, () => { const g = document.querySelector("#fishGuide"); return !g.hidden && g.querySelector(".guide-kicker").textContent === "YOUR MOVE"; }, null, 10000).catch(() => {});
    const gf = await page.evaluate(() => { const g = document.querySelector("#fishGuide"); return { shown: !g.hidden, kick: g.querySelector(".guide-kicker").textContent, caption: g.querySelector(".guide-caption").textContent, bars: g.querySelector(".guide-track").offsetHeight }; });
    check(gf.shown && gf.kick === "YOUR MOVE" && gf.bars === 0, "in a fight the guide shows YOUR MOVE and no step bars (" + JSON.stringify(gf) + ")");
    // a strike with calm effects off: the red flash runs and the hot prompt has its strike look
    await stage(page, { phase: "strike", fish: null, events: [{ type: "strike" }] });
    await until(page, () => document.querySelector("#flash").classList.contains("go") && document.querySelector("#prompt").classList.contains("hot"), null, 10000).catch(() => {});
    const fl = await page.evaluate(() => ({ go: document.querySelector("#flash").classList.contains("go"), vis: getComputedStyle(document.querySelector("#flash")).visibility, anim: getComputedStyle(document.querySelector("#flash")).animationName }));
    check(fl.go && fl.vis === "visible" && fl.anim !== "none", "a strike with calm effects off: the red flash runs (" + JSON.stringify(fl) + ")");
    const hot = await page.evaluate(() => { const p = document.querySelector("#prompt .p1"); return getComputedStyle(p).backgroundColor; });
    check(hot === "rgb(165, 67, 50)", "the urgent prompt sits on the darker red of the painted style, 5.6:1 with its words (" + hot + ")");
    // the words on the red, in both styles: the urgent prompt and the main button read at 4.5:1 or more
    const ratios = await page.evaluate(() => {
      const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number), lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b), cr = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
      const of = (sel) => { const cs = getComputedStyle(document.querySelector(sel)); return +cr(rgb(cs.color), rgb(cs.backgroundColor)).toFixed(2); };
      const out = {};
      for (const style of ["painted", "original"]) { document.body.dataset.artStyle = style; out[style] = { prompt: of("#prompt .p1"), go: of("#settings .btn.go"), title: of("#freeBtn") }; }
      document.body.dataset.artStyle = FISH.save.artStyle;
      return out;
    });
    check(Object.values(ratios).every((r) => Object.values(r).every((v) => v >= 4.5)), "the urgent prompt and the red buttons read at 4.5:1 or more in both styles (" + JSON.stringify(ratios) + ")");

    // the first fish landed: the guide goes away (the player never chose)
    await stage(page, { phase: "caught", catch: { id: "perch", name: "Yellow Perch", kg: 0.3, cm: 26, junk: false }, fish: null });
    await shown(page, "catch");
    await sleep(500);
    await click(page, "#catchGo");
    await until(page, () => FISH.G.phase === "cast", null, 20000);
    await sleep(800);
    const g2 = await page.evaluate(() => ({ caught: FISH.save.caught, hidden: document.querySelector("#fishGuide").hidden, label: document.querySelector("#guideToggle").getAttribute("aria-label") }));
    check(g2.caught === 1 && g2.hidden && g2.label === "Show the moves guide", "after the first catch the guide hides, and the ? button says it shows the guide (" + JSON.stringify(g2) + ")");
    await page.evaluate(() => document.querySelector("#guideToggle").click());
    await sleep(800);
    check(await page.evaluate(() => !document.querySelector("#fishGuide").hidden && localStorage.getItem("reel-it-in-guide-v1") === "shown"), "a tap on ? turns it on again, and that choice is kept");
  } catch (e) {
    check(false, "phone, fresh save: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "phone, fresh save: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- 2. the store build: six controls, and the red button starts free fishing in touch play with the guide ---------- */
if (part("2")) {
  const { browser, page, errors } = await launch({ init: [capStub], save: { v: 1, input: "touch" } });
  try {
    const tc = await titleControls(page);
    check(tc.length === 6 && tc[0].t === "Go fishing" && tc[0].go && tc[1].t === "Derby: 10 casts", "store title: six controls, Go fishing first (" + tc.map((b) => b.t).join(" | ") + ")");
    await click(page, "#freeBtn");
    await until(page, () => FISH.G.phase === "cast", null, 30000);
    const p = await page.evaluate(() => ({ mode: FISH.G.mode, input: FISH.G.input, left: FISH.G.castsLeft }));
    check(p.mode === "free" && p.input === "touch" && p.left === Infinity, "the red button starts free fishing, with no clock (" + JSON.stringify(p) + ")");
    await until(page, () => !document.querySelector("#fishGuide").hidden, null, 10000).catch(() => {});
    const g = await page.evaluate(() => ({ shown: !document.querySelector("#fishGuide").hidden, mode: document.querySelector("#fishGuide").dataset.mode, kick: document.querySelector("#fishGuide .guide-kicker").textContent }));
    check(g.shown && g.mode === "touch" && g.kick === "WATCH + TRY", "a new player in touch play sees the guide on the first cast screen (" + JSON.stringify(g) + ")");
    // the touch fight: the crank stays on the left whatever the reel side says, and the drag sits beside it
    await page.evaluate(() => { FISH.save.reelSide = "right"; document.querySelector("#game").dataset.reelSide = "right"; });
    await stage(page, {});
    await sleep(900);
    const L = { crank: await rect(page, "#crankBox"), drag: await rect(page, "#dragBar"), gauge: await rect(page, "#gaugeBox") };
    check(L.crank.x < 195 && L.drag.x > L.crank.r && L.drag.x - L.crank.r <= 16 && !hit(L.drag, L.crank) && !hit(L.drag, L.gauge), "touch play: the crank on the left, the drag right beside it (" + JSON.stringify(L) + ")");
  } catch (e) {
    check(false, "store build: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "store build: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- 3. a computer: How to play on Touch and mouse, the red button, the Space words on the rod cue, the board ---------- */
if (part("3")) {
  // (Graphics Low, so the frames come fast enough to see each step of a Space cast)
  const { browser, page, errors } = await launch({ width: 1280, height: 800, phone: false, save: { v: 1, quality: "low" } });
  try {
    await click(page, "#helpBtn"); await shown(page, "help");
    const t = await page.evaluate(() => ({ tab: document.querySelector("#help [aria-selected='true']").textContent, text: document.querySelector("#helpT").textContent }));
    check(t.tab === "Touch and mouse" && /Hold the mouse button or Space/.test(t.text) && /W\sA\sS\sD/.test(t.text), "a computer opens How to play on Touch and mouse, with the mouse hold cast and the keys (" + t.tab + ")");
    // the strike in the words of play: the mouse's move first (as the strike prompt says), and Space
    check(t.text.includes("A fish strikes? Drag the rod up fast, or press Space."), "the strike row names the mouse move and Space (" + (/A fish strikes\?[^.]*\./.exec(t.text) || [""])[0] + ")");
    await click(page, "#help [data-close]");
    await click(page, "#freeBtn");
    await until(page, () => FISH.G.phase === "cast" && FISH.G.step === "ready", null, 30000);
    check(await page.evaluate(() => FISH.G.mode === "free"), "the red button starts free fishing on a computer");
    await sleep(500);
    // a Space cast on a slowed clock, so each step of it shows for as long as the check needs (the frames are slow here)
    await page.evaluate(() => {
      const real = performance.now.bind(performance), C = (window.__c = { t: real(), on: true, off: 0, real });
      performance.now = () => (C.on ? (C.t += 0.01) : real() + C.off);
    });
    const cueIs = (t) => until(page, (t) => document.querySelector("#rodCue span").textContent === t, t, 15000).then(() => t, () => page.evaluate(() => document.querySelector("#rodCue span").textContent));
    await page.keyboard.down("Space");
    const a = await cueIs("Keep holding");
    // a Space cast is a rod input: the guide names the keys
    const ag = await page.evaluate(() => { const g = document.querySelector("#fishGuide"); return { desk: FISH.G.desk, label: g.hidden ? "" : g.querySelector(".guide-count").textContent }; });
    await page.evaluate(() => { window.__c.t += 300; });
    const b = await cueIs("Let go in the green");
    // the clock runs again from where it was (it never goes back)
    await page.evaluate(() => { const C = window.__c; C.off = C.t - C.real(); C.on = false; });
    await page.keyboard.up("Space");
    check(a === "Keep holding" && b === "Let go in the green", `a Space cast: the rod cue says the hold words, not "Pull back" and "Flick up!" ("${a}", then "${b}")`);
    check(ag.desk === "keys" && ag.label === "KEYS", `and the guide labels the Space cast KEYS (${JSON.stringify(ag)})`);
    // the numbers on the measuring board: none runs into another, and the end one is always there
    const bl = await page.evaluate(async () => {
      const { boardLabels, BOARD_LENGTHS } = await import("/fish/js/world-fx.js");
      const x = document.createElement("canvas").getContext("2d"); x.font = "bold 21px sans-serif";
      return BOARD_LENGTHS.map((n) => { const L = boardLabels(n, (s) => x.measureText(s).width); let gap = Infinity; for (let i = 1; i < L.length; i++) gap = Math.min(gap, (L[i].x - L[i].w / 2) - (L[i - 1].x + L[i - 1].w / 2)); return { n, last: L[L.length - 1].text, gap: Math.round(gap), inside: L.every((l) => l.x - l.w / 2 >= 3 && l.x + l.w / 2 <= 509) }; });
    });
    check(bl.every((b) => b.gap >= 8 && b.last === String(b.n) && b.inside), "the measuring board: no number runs into another, and the end number shows (" + JSON.stringify(bl) + ")");
  } catch (e) {
    check(false, "computer: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "computer: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- 4. a small phone, 360x640: the HUD chip, then Larger text and Calm effects ---------- */
if (part("4")) {
  const { browser, page, errors } = await launch({ width: 360, height: 640, save: { v: 1, input: "touch", caught: 2, casts: 9 } });
  try {
    // the Fish moves row opens below the part of the list that shows: the list scrolls to bring the moves into view
    await click(page, "#helpBtn"); await shown(page, "help");
    await click(page, "#help [data-tab='t']");
    await click(page, "#helpT summary");
    const seen = () => { const p = document.querySelector("#helpT"), li = p.querySelector(".moves li"), a = p.getBoundingClientRect(), b = li && li.getBoundingClientRect();
      return !!b && p.querySelector(".moves").open && b.top >= a.top - 1 && b.bottom <= a.bottom + 1; };
    const inView = await until(page, seen, null, 5000).then(() => true, () => false);
    check(inView, "at 360x640 the opened Fish moves row scrolls its first move into view");
    await click(page, "#help [data-close]");
    await click(page, "#freeBtn");
    await until(page, () => FISH.G.phase === "cast", null, 30000);
    const chip = async (kgs, mode, casts) => {
      await page.evaluate(([kgs, mode, casts]) => { FISH.G.mode = mode; FISH.G.bag = kgs.map((kg) => ({ id: "perch", kg })); FISH.G.casts = casts; FISH.G.castsLeft = mode === "derby" ? 10 - casts : Infinity; FISH.newCast(); }, [kgs, mode, casts]);
      await sleep(100);
      return page.evaluate(() => { const c = document.querySelector("#modeChip"), b = c.querySelector("b"), k = document.querySelector("#clock").getBoundingClientRect(); return { text: c.textContent, kg: b.textContent, whole: b.scrollWidth <= b.clientWidth + 1 && b.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1, clear: c.getBoundingClientRect().right <= k.left, clock: document.querySelector("#clock").innerText }; });
    };
    for (const [kgs, mode, casts, want] of [[[12.4], "derby", 0, "12.4 kg"], [[5, 6, 7, 5.45], "derby", 9, "23.4 kg"], [[30, 30, 30, 10, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], "free", 0, "104 kg"], [[120], "free", 0, "120 kg"]]) {
      const c = await chip(kgs, mode, casts);
      check(c.kg === want && c.whole && c.clear, `the HUD chip at 360 px shows the whole weight: "${c.text}" (${want}), clear of the clock "${c.clock}"`);
    }
    check(!/AM|PM/.test((await chip([], "free", 0)).clock), "under 400 px the clock has no AM or PM");
    // Larger text: the setting from Settings over the pause card
    await page.evaluate(() => document.querySelector("#pauseBtn").click());
    await shown(page, "pause");
    await click(page, "#pSet"); await shown(page, "settings");
    await click(page, "#optText");
    check(await page.evaluate(() => document.querySelector("#game").dataset.text === "large" && localStorage.getItem("fish.text") === "large" && getComputedStyle(document.querySelector("#game")).getPropertyValue("--ui-scale").trim() === "1.25"), "Larger text sets --ui-scale on #game, and it is kept");
    const f1 = await fits(page);
    check(f1.ok, "Larger text at 360x640: Settings fits, Done in view (" + JSON.stringify(f1) + ")");
    await click(page, "#settings [data-close]"); await shown(page, "pause");
    const f2 = await fits(page);
    check(f2.ok, "and the pause card fits (" + JSON.stringify(f2) + ")");
    for (const [btn, id] of [["#pHelp", "help"], ["#pJournal", "journal"]]) {
      await click(page, btn); await shown(page, id);
      const f = await fits(page);
      check(f.ok, `and ${id} fits (${JSON.stringify(f)})`);
      await click(page, "#" + id + " [data-close]"); await shown(page, "pause");
    }
    await click(page, "#resumeBtn");
    // (a fish on the bottom: the longest rod cue in touch play, three lines with Larger text)
    const PUMP = "Drag the rod up. Reel as it comes down.";
    await stage(page, { fish: { id: "walleye", kg: 2, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move: "sulk", jump: 0, near: 0.5, known: true } });
    await until(page, (t) => document.querySelector("#rodCue span").textContent === t && FISH.gauge.box && FISH.gauge.box.name, PUMP, 15000).catch(() => {});
    await sleep(700);
    const pr = await page.evaluate(() => ({ px: parseFloat(getComputedStyle(document.querySelector("#prompt .p1")).fontSize), toast: parseFloat(getComputedStyle(document.querySelector("#toast")).fontSize), name: FISH.gauge.box && FISH.gauge.box.name }));
    const gw = await page.evaluate(async () => { const { GAUGE } = await import("/fish/js/reel.js"); return [GAUGE.WORD_PX, GAUGE.LABEL_PX]; });
    check(pr.px >= 20 && pr.toast >= 17 && gw[0] >= 15 && gw[1] >= 12, `Larger text: the prompt is ${pr.px.toFixed(1)} px (20 or more), the toast ${pr.toast.toFixed(1)} px, the gauge words ${gw.join(" and ")} px`);
    check(!!pr.name && pr.name.px >= 15 && pr.name.w <= pr.name.max + 0.5, "Larger text: the gauge draws the fish name at 15 px or more, and it fits (" + JSON.stringify(pr.name) + ")");
    const L = { prompt: await rect(page, "#prompt .p1"), crank: await rect(page, "#crankBox"), gauge: await rect(page, "#gaugeBox"), drag: await rect(page, "#dragBar"), hud: await rect(page, "#hud"), cue: await rect(page, "#rodCue span") };
    const over = Object.keys(L).flatMap((a, i) => Object.keys(L).slice(i + 1).filter((b) => hit(L[a], L[b])).map((b) => a + "/" + b));
    const cueText = await page.evaluate(() => document.querySelector("#rodCue span").textContent);
    check(cueText === PUMP && !!L.cue && !over.length, `Larger text in a fight at 360x640: the prompt, the gauge, the drag, the crank, the HUD and the rod cue's words ("${cueText}") do not overlap (` + (over.join(", ") || "none") + ")");
    // a cast lands in the water: the report (the distance, the verdict and a note) stands under the prompt and its sub,
    // which takes two lines here
    await page.evaluate(async () => {
      const G = FISH.G, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      FISH.newCast(); G.cast = { verdict: "high", yaw: 0, stroke: 1 };
      G.step = "flight"; G.flight = { step: () => ({ x: 0, y: 0, z: -55, done: true, land: "water", lineOut: 55, spool: 0 }) };
      const t0 = performance.now();
      while (G.phase !== "reel" && performance.now() - t0 < 8000) await wait(10);
      await wait(700);
    });
    const RP = { p1: await rect(page, "#prompt .p1"), p2: await rect(page, "#prompt .p2"), dist: await rect(page, "#report .dist"), zone: await rect(page, "#report .zone") };
    check(!!RP.dist && !!RP.p2 && !!RP.zone && !hit(RP.dist, RP.p1) && !hit(RP.dist, RP.p2), `Larger text at 360x640: the cast report stands clear under the prompt (${JSON.stringify(RP)})`);
    await stage(page, { fish: { id: "walleye", kg: 2, cm: 50, x: 0, y: -1, z: -20, heading: 0, len: 0.5, stamina: 0.6, move: "sulk", jump: 0, near: 0.5, known: true } });
    // a long toast (a legend's stage name) beside the bigger gauge, on the taller phones where it sits in the sky
    const LONG = "It runs down the river! Steer it off the logs!";
    for (const [W, H] of [[390, 844], [430, 932]]) {
      await page.setViewportSize({ width: W, height: H });
      await sleep(900);
      await page.evaluate((msg) => FISH.G.sim.events.push({ type: "phase", n: 2, of: 3, name: msg }), LONG);
      await until(page, (msg) => { const t = document.querySelector("#toast"); return t.textContent === msg && t.classList.contains("on") && +getComputedStyle(t).opacity > 0.95; }, LONG, 15000).catch(() => {});
      const T = { toast: await rect(page, "#toast"), gauge: await rect(page, "#gaugeBox"), prompt: await rect(page, "#prompt .p1"), crank: await rect(page, "#crankBox"), drag: await rect(page, "#dragBar"), cue: await rect(page, "#rodCue span") };
      const on = await page.evaluate((msg) => document.querySelector("#toast").textContent === msg, LONG);
      const hits = ["gauge", "prompt", "crank", "drag", "cue"].filter((k) => hit(T.toast, T[k]));
      check(on && !!T.toast && !hits.length && T.toast.x >= 0 && T.toast.r <= W, `Larger text at ${W}x${H}: a long toast is clear of the bigger gauge, the prompt, the crank, the drag and the rod cue (toast ${JSON.stringify(T.toast)}${hits.length ? "; on the " + hits.map((k) => k + " " + JSON.stringify(T[k])).join(", ") : ""})`);
    }
    await page.setViewportSize({ width: 360, height: 640 });
    await sleep(600);
    await page.evaluate(() => FISH.toTitle());
    await shown(page, "title");
    const f3 = await fits(page);
    check(f3.ok, "and the title fits (" + JSON.stringify(f3) + ")");
    for (const [btn, id] of [["#placesBtn", "places"], ["#setBtn", "settings"]]) {
      await click(page, btn); await shown(page, id);
      const f = await fits(page);
      check(f.ok, `and ${id} fits (${JSON.stringify(f)})`);
      await click(page, "#" + id + " [data-close]"); await shown(page, "title");
    }

    // Calm effects: html data-calm, no red flash, no pulse; the words and the sound stay
    await click(page, "#setBtn"); await shown(page, "settings");
    await click(page, "#optCalm");
    check(await page.evaluate(() => document.documentElement.dataset.calm === "1" && localStorage.getItem("fish.calm") === "1"), "Calm effects sets html data-calm=\"1\", and it is kept");
    await click(page, "#settings [data-close]"); await shown(page, "title");
    await click(page, "#freeBtn");
    await until(page, () => FISH.G.phase === "cast", null, 30000);
    // the guide with Calm effects (and no reduced motion on the system): its first step holds still, with no clip
    await page.evaluate(() => document.querySelector("#guideToggle").click());
    await until(page, () => !document.querySelector("#fishGuide").hidden, null, 10000).catch(() => {});
    const g0 = await page.evaluate(() => document.querySelector("#fishGuide .guide-count").textContent);
    await sleep(3400);
    const gc = await page.evaluate(() => { const v = document.querySelector("#fishGuide video"); return { reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, shown: !document.querySelector("#fishGuide").hidden, first: document.querySelector("#fishGuide .guide-count").textContent, clip: !!v && (!v.paused || !v.hidden) }; });
    check(!gc.reduced && gc.shown && g0 === "1 / 3" && gc.first === "1 / 3" && !gc.clip, "Calm effects: the guide holds its first step still after 3 s and plays no clip (" + JSON.stringify({ g0, ...gc }) + ")");
    await page.evaluate(() => document.querySelector("#guideToggle").click());
    await page.evaluate(() => { window.__sfx = []; const f = FISH.Sound.sfx; FISH.Sound.sfx = function (n, ...a) { window.__sfx.push(n); return f.call(this, n, ...a); }; });
    await stage(page, { phase: "strike", fish: null, events: [{ type: "strike" }] });
    await until(page, () => document.querySelector("#prompt").classList.contains("hot") && window.__sfx.includes("strike"), null, 10000).catch(() => {});
    const calm = await page.evaluate(() => {
      const f = document.querySelector("#flash"), p = document.querySelector("#prompt"), p1 = p.querySelector(".p1"), cs = getComputedStyle(f);
      return { flash: cs.visibility === "hidden" || cs.animationName === "none" || +cs.opacity === 0, pulse: getComputedStyle(p1).animationName, hot: p.classList.contains("hot"), words: p1.textContent, sound: window.__sfx.includes("strike") };
    });
    check(calm.flash && calm.pulse === "none" && calm.hot && /Set the hook!/.test(calm.words) && calm.sound, "Calm effects in a strike: no red flash and no pulse, while the words and the strike sound stay (" + JSON.stringify(calm) + ")");
    // the cast report shows with no pop
    check(await page.evaluate(() => { const r = document.querySelector("#report"); r.hidden = false; r.classList.add("show"); const a = getComputedStyle(r).animationName; r.hidden = true; return a === "none"; }), "Calm effects: the cast report does not pop");
    // after a reload the setting is still on from the first frame
    await page.reload();
    await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
    check(await page.evaluate(() => document.documentElement.dataset.calm === "1" && document.querySelector("#game").dataset.text === "large"), "after a reload, Calm effects and Larger text are still on");
  } catch (e) {
    check(false, "small phone: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "small phone: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

/* ---------- 5. ?shot: Graphics High and the lake at up to 3x, never saved ---------- */
if (part("5")) {
  const { browser, page, errors } = await launch({ query: "?shot", scale: 3, save: { v: 1, input: "touch", quality: "auto" } });
  try {
    const r = await page.evaluate(() => ({ ratio: FISH.world.renderer.getPixelRatio(), q: FISH.save.quality, stored: JSON.parse(localStorage.getItem("fish.v1") || "{}").quality }));
    check(r.ratio === 3 && r.q === "auto" && r.stored !== "high", "?shot draws the lake at 3x on a 3x phone, and the saved Graphics stays Auto (" + JSON.stringify(r) + ")");
  } catch (e) {
    check(false, "?shot: exception: " + (e && e.stack));
  }
  check(errors.length === 0, "?shot: no page errors" + (errors.length ? ":\n" + errors.join("\n") : ""));
  await browser.close();
}

console.log(fails.length ? `\n${fails.length} FAILED` : "\nall menus checks passed");
process.exit(fails.length ? 1 : 0);
