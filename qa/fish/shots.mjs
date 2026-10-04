// Screenshots of every screen of Reel It In at the six store sizes, and a layout scan of each one: a control off the
// screen (and not in a list that scrolls), text cut off, a control over another, a tap target under 44 px, and a screen
// that scrolls as a whole. Look at the pictures too: the scan cannot see a word over a busy sky.
// Run (serve public/ first): SHOTS=/some/folder NODE_PATH=qa/browser/node_modules node qa/fish/shots.mjs
//   SIZES=390x844,360x640   some sizes only (default: 390x844, 360x640, 430x932, 844x390, 820x1180, 1280x800)
//   SCALE=3                 the device pixel ratio of the pictures (default 1). The page runs with ?shot: Graphics High,
//                           the lake at up to 3x, and no automatic render scale
//   TEXT=large              with Larger text on;  CALM=1 with Calm effects on;  WEB=1 the web build (default: the store
//                           build, as the app shows it, after one picture of the web title)
// It writes <SHOTS>/<size>/<nn>-<screen>.png and <SHOTS>/report.json, prints the problems it found, and exits with code 1
// when there are any.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { URL, installPhone, sleep } from "./lib.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = process.env.SHOTS;
if (!OUT) { console.error("Set SHOTS to the folder for the pictures."); process.exit(2); }
const SIZES = (process.env.SIZES || "390x844,360x640,430x932,844x390,820x1180,1280x800").split(",").map((s) => s.trim().split("x").map(Number));
const SCALE = +process.env.SCALE || 1, LARGE = process.env.TEXT === "large", CALM = process.env.CALM === "1", WEB = process.env.WEB === "1";
fs.mkdirSync(OUT, { recursive: true });
const report = { url: URL, scale: SCALE, large: LARGE, calm: CALM, web: WEB, sizes: {} };
const problems = [];

// In the page: the layout scan of one screen (id) or of the play view (no id)
function scan(id) {
  const root = id ? document.getElementById(id) : document.getElementById("game");
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || el.closest("[hidden]")) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false; }
    return true;
  };
  const label = (el) => ((el.id ? "#" + el.id + " " : "") + (el.getAttribute("aria-label") || el.textContent || el.value || "").trim().replace(/\s+/g, " ")).slice(0, 44);
  // the box a finger hits: a checkbox or a select in a row hits with the whole row
  const hitBox = (el) => (el.closest(".set label") || el).getBoundingClientRect();
  // the list that scrolls around a box, and the part of the box that shows through every such list
  const scroller = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 2) return p; } return null; };
  const seen = (el) => {
    const r = el.getBoundingClientRect(), v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (!/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY)) continue;
      const q = p.getBoundingClientRect();
      v.left = Math.max(v.left, q.left); v.top = Math.max(v.top, q.top); v.right = Math.min(v.right, q.right); v.bottom = Math.min(v.bottom, q.bottom);
    }
    return v;
  };
  const out = { small: [], offscreen: [], clipped: [], overlaps: [], scrollers: [] };
  const sel = "button, a[href], select, input, summary, [role=tab]";
  const controls = [...root.querySelectorAll(sel)].filter(vis);
  for (const el of controls) {
    if (el.matches("input[switch]")) continue;
    const r = hitBox(el);
    if (Math.round(r.width) < 44 || Math.round(r.height) < 44) out.small.push([label(el), Math.round(r.width), Math.round(r.height)]);
    const s = scroller(el);
    const off = r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.left < -1;
    if (off && !s) out.offscreen.push([label(el), Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]);
  }
  for (const el of root.querySelectorAll("*")) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) out.scrollers.push([el.id ? "#" + el.id : String(el.className || el.tagName), el.clientHeight, el.scrollHeight]);
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own && !el.classList.contains("sr-only") && el.scrollWidth > el.clientWidth + 1 && (cs.overflowX === "hidden" || cs.textOverflow === "ellipsis")) out.clipped.push([label(el), el.clientWidth, el.scrollWidth]);
  }
  if (id) out.screenScroll = [root.clientHeight, root.scrollHeight];
  // a control over another (one inside the other is not)
  for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
    const A = controls[i], B = controls[j];
    if (A.contains(B) || B.contains(A) || A.closest("label") === B.closest("label") && A.closest("label")) continue;
    const a = seen(A), b = seen(B);
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 2 && oy > 2) out.overlaps.push([label(A), label(B), Math.round(ox), Math.round(oy)]);
  }
  // play: the reel controls, the prompt and the HUD must not cover each other
  if (!id) {
    const R = (s) => { const e = document.querySelector(s); return e && vis(e) ? e.getBoundingClientRect() : null; };
    const parts = ["#hud", "#prompt .p1", "#gaugeBox", "#dragBar", "#crankBox", "#pullStrength", "#toast.on", "#fishGuide"].map((s) => [s, R(s)]).filter((p) => p[1]);
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const [na, a] = parts[i], [nb, b] = parts[j];
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2) out.overlaps.push([na, nb, Math.round(ox), Math.round(oy)]);
    }
    const chip = document.querySelector("#modeChip");
    if (chip && vis(chip)) { const kg = chip.querySelector("b"); out.chip = [chip.textContent, chip.scrollWidth <= chip.clientWidth + 1 && (!kg || kg.scrollWidth <= kg.clientWidth + 1)]; }
  }
  return out;
}

async function runSize(W, H) {
  const desk = W >= 1024, name = W + "x" + H, dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"] });
  const ctx = await browser.newContext(desk ? { viewport: { width: W, height: H }, deviceScaleFactor: SCALE } : { viewport: { width: W, height: H }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.route("**/three.module.min.js", (r) => r.fulfill({ path: path.join(ROOT, "public/crimson/lib/three.module.min.js"), contentType: "application/javascript" }));
  await page.addInitScript(({ large, calm }) => {
    if (sessionStorage.getItem("qa-kept")) return;
    localStorage.clear();
    if (large) localStorage.setItem("fish.text", "large");
    if (calm) localStorage.setItem("fish.calm", "1");
    sessionStorage.setItem("qa-kept", "1");
  }, { large: LARGE, calm: CALM });
  if (!desk) await page.addInitScript(installPhone);
  await page.goto(URL + "?shot");
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  const rec = (report.sizes[name] = { screens: {}, errors });
  const wait = (fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 });
  const shown = (id) => wait((id) => !document.getElementById(id).hidden, id);
  let n = 0;
  async function snap(key, id, settle = 700) {
    await sleep(settle);
    const file = String(++n).padStart(2, "0") + "-" + key;
    await page.screenshot({ path: path.join(dir, file + ".png") });
    const s = await page.evaluate(scan, id || null);
    rec.screens[file] = s;
    const bad = (kind, list) => { for (const x of list) problems.push(`${name} ${file}: ${kind} ${JSON.stringify(x)}`); };
    bad("off the screen", s.offscreen); bad("cut off", s.clipped); bad("overlap", s.overlaps); bad("under 44 px", s.small);
    if (s.screenScroll && s.screenScroll[1] > s.screenScroll[0] + 2) problems.push(`${name} ${file}: the screen scrolls ${JSON.stringify(s.screenScroll)}`);
    if (s.chip && !s.chip[1]) problems.push(`${name} ${file}: the HUD chip cuts "${s.chip[0]}"`);
  }
  const tap = async (sel) => { await sleep(380); await page.click(sel); };
  const close = async (id) => { await tap("#" + id + " [data-close]"); await sleep(150); };
  const stage = (patch) => page.evaluate((patch) => {
    const G = FISH.G;
    G.lastEvent = {}; G.hold = null; G.bail = "closed";
    G.sim = { fake: true, events: [], step() {}, state: Object.assign({
      phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.45, slip: 0, dragN: 18, breakN: 45, lineOut: 24.6, slack: false, bend: 0.4, spoolFrac: 0.2,
      fish: { id: "walleye", kg: 2.1, cm: 52, x: 0, y: -1.2, z: -20, heading: 0, len: 0.5, stamina: 0.62, move: "swim", jump: 0, near: 0.5, known: true },
    }, patch) };
    if (G.phase !== "reel") FISH.enterReel();
  }, patch);
  try {
    await sleep(1200);
    if (!WEB) {
      await snap("title-web", "title");
      // the store build from here on: the arcade parts go, and the title kicker names the place alone
      await page.evaluate(() => { document.documentElement.dataset.build = "store"; FISH.toTitle(); });
    }
    await snap("title", "title");
    await tap("#helpBtn"); await shown("help");
    await snap("help", "help");
    for (const t of ["m", "t"]) {
      await tap(`#help [data-tab='${t}']`);
      await snap("help-" + (t === "m" ? "motion" : "touch"), "help", 400);
    }
    const moves = await page.$("#help .moves:not([hidden]) summary");
    const panel = await page.$("#help [role=tabpanel]:not([hidden]) .moves summary");
    if (panel || moves) { await (panel || moves).click(); await snap("help-moves", "help", 400); }
    await close("help");
    await tap("#setBtn"); await shown("settings");
    await snap("settings", "settings");
    if (await page.$("#aboutBtn")) {
      await tap("#aboutBtn"); await shown("about");
      await snap("about", "about");
      if (await page.$("#privacyBtn")) {
        await tap("#privacyBtn"); await shown("privacy");
        await page.waitForFunction(() => { const f = document.querySelector("#privacy iframe"); return f && f.contentDocument && f.contentDocument.readyState === "complete" && f.contentDocument.body && f.contentDocument.body.textContent.length > 100; });
        await snap("privacy", "privacy", 900);
        await page.evaluate(() => document.querySelector("#privacy iframe").contentDocument.getElementById("back").click());
        await shown("about");
      }
      await tap("#about [data-back]"); await shown("settings");
    }
    await close("settings");
    await tap("#journalBtn"); await shown("journal");
    await snap("journal", "journal");
    await close("journal");
    await tap("#placesBtn"); await shown("places");
    await snap("places", "places");
    await close("places");
    // the first play: the choice of input on a phone, then the cast
    await tap("#freeBtn");
    const setup = await page.waitForSelector("#setup:not([hidden])", { timeout: 5000 }).then(() => true, () => false);
    if (setup) { await snap("setup", "setup"); await tap("#useMotion"); }
    await wait(() => FISH.G.phase === "cast" && document.body.dataset.screen === "", null, 60000);
    if (!desk) await page.evaluate(() => __phone.pose(88));
    await snap("cast", null, 2500);
    await page.evaluate(() => document.querySelector("#pauseBtn").click());
    await shown("pause");
    await snap("pause", "pause");
    await tap("#resumeBtn");
    // a fight with the gauge, a hot one, the other reel side in motion play, and touch play
    await stage({});
    await snap("fight", null, 1800);
    await stage({ tfrac: 0.92 });
    await snap("fight-hot", null, 1200);
    if (!desk) {
      await page.evaluate(() => { FISH.save.reelSide = "left"; document.querySelector("#game").dataset.reelSide = "left"; FISH.relayout(true); });
      await stage({});
      await snap("fight-left", null, 1500);
      await page.evaluate(() => { FISH.save.reelSide = "right"; document.querySelector("#game").dataset.reelSide = "right"; FISH.G.input = "touch"; FISH.relayout(true); });
      await stage({});
      await snap("fight-touch", null, 1500);
      await page.evaluate(() => { FISH.G.input = "motion"; FISH.relayout(true); });
    }
    // a trophy that opens Stump Bay: the photo beat, the card, then the card of the new place
    await stage({ phase: "caught", catch: { id: "largemouth", name: "Largemouth Bass", kg: 3.9, cm: 55, junk: false }, fish: null });
    await shown("catch");
    await wait(() => !FISH.G.cardWait, null, 20000);
    await snap("catch", "catch", 2600);
    await tap("#catchGo"); await shown("unlock");
    await snap("unlock", "unlock");
    // the trip: a stand-in load, so the arrival card comes fast
    await page.evaluate(() => { FISH.world.setPlace = async () => ({ ms: 0 }); });
    await tap("#uGo"); await shown("arrive");
    await snap("arrive", "arrive", 1600);
    await tap("#aStart");
    await wait(() => FISH.G.phase === "cast", null, 30000);
    // the derby results with a bag
    await page.evaluate(() => { FISH.startMode("derby"); const G = FISH.G; G.bag = [{ id: "perch", kg: 0.41 }, { id: "walleye", kg: 2.3 }, { id: "smallmouth", kg: 1.6 }, { id: "pike", kg: 4.1 }, { id: "rockbass", kg: 0.3 }, { id: "pumpkinseed", kg: 0.2 }]; G.castsLeft = 0; G.casts = 10; FISH.newCast(); });
    await shown("results");
    await snap("results", "results", 1200);
  } catch (e) {
    problems.push(`${name}: the run stopped: ${e && e.message}`);
    await page.screenshot({ path: path.join(dir, "zz-error.png") }).catch(() => {});
  }
  for (const e of errors) problems.push(`${name}: ${e}`);
  console.log(`${name}: ${n} pictures`);
  await browser.close();
}

for (const [W, H] of SIZES) await runSize(W, H);
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
for (const p of problems) console.log("FAIL " + p);
console.log(problems.length ? `${problems.length} problems (see ${path.join(OUT, "report.json")})` : "No problems found. Now look at the pictures.");
process.exit(problems.length ? 1 : 0);
