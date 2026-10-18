// First Breath: the wave-0 boot check (tasks.md 1.11, 1.12). With the site served (it starts
// `python3 -m http.server 8765 --directory public` itself when nothing answers), at 390 × 844 and 844 × 390 with touch
// and at 1440 × 900 in Chromium with --disable-gpu, it opens /first-breath/?test=1 and checks:
// - /arcade/quiet.js is the first script in <head>, /arcade/switch.js the next, /arcade/analytics.js the last in <body>;
// - every member of window.__fb (design.md 16.9) is there;
// - the title has #play (at least 56 px tall), "‹ Arcade" to / and a Switch game button;
// - a real click (a tap on touch) on #play starts stage 1, and a whole run plays through the 8 stub stages and the
//   ending to the result by __fb.step and __fb.finish and real clicks on the screens (Go on, Next, the card's skip),
//   and AGAIN starts a new run;
// - __fb.goto reaches every stage and the ending, steps it, draws it, and its finish leads to the result; in stage 2 a
//   tap on the next target through __fb.tap is judged In time;
// - without ?test=1, after #play the rAF loop advances the stage clock and her beats go to the sound once each;
// - no page error, console error or failed request anywhere.
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/boot.e2e.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FILE = "qa/first-breath/boot.e2e.mjs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) {
  console.log(`FAIL ${FILE}: Playwright is not found; run with NODE_PATH=qa/browser/node_modules`);
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGIN = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const BASE = ORIGIN + "/first-breath/";
const SIZES = {
  portrait: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  landscape: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};
const sizeList = () => (process.env.ONLY ? process.env.ONLY.split(",") : Object.keys(SIZES));
const STAGE_IDS = ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"];
const MEMBERS = ["state", "goto", "jump", "realtime", "step", "input", "tap", "press", "release", "nextTarget", "bot",
  "finish", "retry", "skip", "act", "result", "targets", "facts", "race", "guard", "perf", "sound", "motion", "lum", "save"];
const GETTERS = new Set(["perf", "sound", "motion"]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
const failed = [];
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed.push(`${name}${detail ? ` (${detail})` : ""}`);
  return ok;
}

// ---- the server
async function answers() {
  try { const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch (e) { return false; }
}
let server = null;
if (!(await answers())) {
  server = spawn("python3", ["-m", "http.server", "8765", "--bind", "0.0.0.0", "--directory", path.join(ROOT, "public")],
    { stdio: "ignore", detached: false });
  for (let i = 0; i < 100 && !(await answers()); i++) await wait(100);
}
if (!(await answers())) {
  console.log(`FAIL ${FILE}: nothing answers at ${BASE}`);
  if (server) server.kill();
  process.exit(1);
}

// ---- Chromium with --disable-gpu (Canvas 2D, design.md 14.3; no SwiftShader flags)
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({
  ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  args: ["--disable-gpu", "--autoplay-policy=no-user-gesture-required"],
});

async function open(size, query) {
  const ctx = await browser.newContext({ ...SIZES[size] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && r.request().method() !== "HEAD") errors.push(`${r.status()} ${r.url()}`); });
  // the game switcher may probe a game still in the works with a HEAD request; nothing else may fail
  page.on("requestfailed", (r) => {
    if (r.method() !== "HEAD" && !/analytics|posthog/.test(r.url())) errors.push(`failed ${r.url()} ${r.failure()?.errorText || ""}`);
  });
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.addInitScript(() => { try { if (!sessionStorage.getItem("fb-qa")) { localStorage.clear(); sessionStorage.setItem("fb-qa", "1"); } } catch (e) { /* off */ } });
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__fb && window.__fb.state && window.__fb.state().frames > 1, null, { timeout: 60000 });
  return { ctx, page, errors };
}

// Every object of a probe with a world point carries its screen point.
function probeMapped(p) {
  let ok = true;
  const walk = (o) => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== "object") return;
    if (Number.isFinite(o.x) && Number.isFinite(o.y)) ok = ok && !!(o.screen && Number.isFinite(o.screen.x) && Number.isFinite(o.screen.y));
    for (const [k, v] of Object.entries(o)) if (k !== "screen") walk(v);
  };
  walk(p);
  return ok;
}

const S = (page) => page.evaluate(() => window.__fb.state());
const F = (page, fn, arg) => page.evaluate(fn, arg);
async function press(page, size, selector) {
  if (SIZES[size].hasTouch) await page.tap(selector, { timeout: 5000 });
  else await page.click(selector, { timeout: 5000 });
}

for (const size of sizeList()) {
  const tag = size;
  const { ctx, page, errors } = await open(size, "?test=1");

  // ---- the page's scripts, in order
  const scripts = await F(page, () => {
    const head = [...document.head.children];
    const firstScript = head.find((e) => e.tagName === "SCRIPT");
    const all = [...document.scripts].map((s) => s.getAttribute("src") || (s.type === "module" ? "module-inline" : "inline"));
    const body = [...document.body.children].filter((e) => e.tagName === "SCRIPT");
    const last = body[body.length - 1];
    return {
      first: firstScript ? firstScript.getAttribute("src") : null,
      firstIsFirstChildScript: head.indexOf(firstScript) === head.findIndex((e) => e.tagName === "SCRIPT"),
      second: all[1] || null,
      last: last ? last.getAttribute("src") : null,
      lastGame: last ? last.dataset.game : null,
      all,
    };
  });
  check(`${tag}: quiet.js is the first script in <head>`, scripts.first === "/arcade/quiet.js" && scripts.all[0] === "/arcade/quiet.js",
    scripts.all.join(", "));
  check(`${tag}: switch.js is the next script`, scripts.second === "/arcade/switch.js", scripts.second);
  check(`${tag}: analytics.js with data-game="first-breath" is the last in <body>`,
    scripts.last === "/arcade/analytics.js" && scripts.lastGame === "first-breath", `${scripts.last} ${scripts.lastGame}`);

  // ---- every member of window.__fb
  const members = await F(page, (names) => {
    const out = {};
    for (const n of names) {
      const d = Object.getOwnPropertyDescriptor(window.__fb, n);
      out[n] = !d ? "missing" : d.get ? typeof window.__fb[n] : typeof d.value;
    }
    return out;
  }, MEMBERS);
  const badMembers = MEMBERS.filter((n) => (GETTERS.has(n) ? members[n] !== "object" : members[n] !== "function"));
  check(`${tag}: window.__fb has every member of 16.9`, badMembers.length === 0, badMembers.map((n) => `${n}: ${members[n]}`).join(", "));

  // ---- the title
  const title = await F(page, () => {
    const play = document.getElementById("play");
    const r = play ? play.getBoundingClientRect() : null;
    const back = document.querySelector('#title a[href="/"]');
    return {
      screen: window.__fb.state().screen,
      play: r ? { w: r.width, h: r.height, shown: r.width > 0 && !play.closest("[hidden]") } : null,
      back: back ? back.textContent.trim() : null,
      sw: !!document.querySelector("#title [data-switch]"),
      area: getComputedStyle(document.getElementById("area")).touchAction,
      view: !!document.querySelector("canvas#view"), rings: !!document.querySelector("svg#rings"),
      herRing: document.querySelectorAll('#rings g[data-kind="mother"]').length,
    };
  });
  check(`${tag}: her ring pulses on the title (svg#rings)`, title.herRing === 1, String(title.herRing));
  check(`${tag}: the title shows #play at least 56 px tall`, title.screen === "title" && title.play && title.play.shown && title.play.h >= 56,
    JSON.stringify(title.play));
  check(`${tag}: the title has "‹ Arcade" to / and a Switch game button`, title.back === "‹ Arcade" && title.sw);
  check(`${tag}: canvas#view and svg#rings, touch-action none on the play area`, title.view && title.rings && title.area === "none", title.area);

  // ---- a whole run by real clicks through the stub stages
  await press(page, size, "#play");
  let s = await S(page);
  check(`${tag}: #play starts stage 1`, s.screen === "stage" && s.stageId === "swim" && s.stage === 1, `${s.screen} ${s.stageId}`);
  check(`${tag}: stage 1's prompt is a drag`, s.prompt && s.prompt.gesture === "drag", JSON.stringify(s.prompt));
  const visited = [];
  let runOk = true;
  for (let i = 0; i < STAGE_IDS.length; i++) {
    s = await F(page, () => window.__fb.step(30));
    visited.push(s.stageId);
    if (!check(`${tag}: run stage ${i + 1} is ${STAGE_IDS[i]} and its clock runs`, s.stageId === STAGE_IDS[i] && Math.abs(s.t - 0.5) < 0.02,
      `${s.stageId} t=${s.t}`)) { runOk = false; break; }
    await F(page, () => window.__fb.finish());
    s = await S(page);
    if (s.screen === "almost") {
      await press(page, size, "#goOn");
      s = await S(page);
    }
    if (i === STAGE_IDS.length - 1) {
      check(`${tag}: no overlay after Birth: the ending follows`, s.screen === "ending" && s.stageId === "ending", s.screen);
      break;
    }
    if (!check(`${tag}: stage ${i + 1} ends on its overlay`, s.screen === "overlay", s.screen)) { runOk = false; break; }
    await press(page, size, "#next");
    s = await S(page);
    if (!check(`${tag}: the overlay's Next shows the card for stage ${i + 2}`, s.screen === "card", s.screen)) { runOk = false; break; }
    await F(page, () => window.__fb.step(65));
    await press(page, size, "#skip");
    s = await S(page);
    if (!check(`${tag}: the card skips to stage ${i + 2}`, s.screen === "stage" && s.stageId === STAGE_IDS[i + 1], `${s.screen} ${s.stageId}`)) {
      runOk = false; break;
    }
  }
  if (runOk) {
    s = await F(page, () => window.__fb.step(30));
    check(`${tag}: the ending runs`, s.screen === "ending" && s.t > 0.4, `${s.screen} ${s.t}`);
    await F(page, () => window.__fb.finish());
    const res = await F(page, () => {
      const again = document.getElementById("again");
      const r = again ? again.getBoundingClientRect() : null;
      return { s: window.__fb.state(), sum: window.__fb.result(), again: r ? { w: r.width, h: r.height } : null };
    });
    check(`${tag}: the run reaches its result with 8 stages and an AGAIN button`,
      res.s.screen === "result" && res.sum && res.sum.done === true && res.sum.stages.length === 8 && res.again && res.again.h >= 44,
      `${res.s.screen} ${res.sum && res.sum.stages && res.sum.stages.length} ${JSON.stringify(res.again)}`);
    check(`${tag}: the run total and time are counted`, res.sum.total > 0 && res.sum.ms > 0, `${res.sum.total} ${res.sum.ms}`);
    const saved = await F(page, () => window.__fb.save());
    check(`${tag}: the save keeps the finished run`, saved.best && saved.best.done === true && saved.best.score === res.sum.total,
      JSON.stringify(saved.best));
    await press(page, size, "#again");
    s = await S(page);
    check(`${tag}: AGAIN starts a new run at stage 1`, s.screen === "stage" && s.stageId === "swim" && s.t < 0.1, `${s.screen} ${s.stageId}`);
  }

  // ---- every stage by goto, stepped, drawn and finished to the result
  let tapChecked = null;
  for (const target of [1, 2, 3, 4, 5, 6, 7, 8, "ending"]) {
    const id = target === "ending" ? "ending" : STAGE_IDS[target - 1];
    const ok = await F(page, (t) => window.__fb.goto(t, { seed: 7 }), target);
    s = await F(page, () => window.__fb.step(120));
    await F(page, () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const look = await F(page, () => ({ perf: window.__fb.perf, race: window.__fb.race(), guard: window.__fb.guard(),
      next: window.__fb.nextTarget(), targets: window.__fb.targets(), rings: document.querySelectorAll("#rings g[data-id]").length }));
    check(`${tag}: goto(${JSON.stringify(target)}) reaches ${id} and steps 120 frames`,
      ok === true && s.stageId === id && (target === "ending" ? s.stage === "ending" : s.stage === target) && Math.abs(s.t - 2) < 0.02,
      `${ok} ${s.stageId} ${s.stage} t=${s.t}`);
    check(`${tag}: ${id} draws (layers, the anchor on screen)`,
      look.perf.draws > 0 && look.perf.w > 0 && s.anchor && Number.isFinite(s.anchor.x) && Number.isFinite(s.anchor.y),
      `draws ${look.perf.draws} rings ${look.rings} anchor ${JSON.stringify(s.anchor)}`);
    // race() only in stage 1 and guard() only in stage 2 (null in a stub); every world point gets its screen point
    check(`${tag}: ${id}: race() and guard() follow their stage`,
      (id === "swim" ? look.race === null || probeMapped(look.race) : look.race === null)
      && (id === "egg" ? look.guard === null || (probeMapped(look.guard) && Number.isFinite(look.guard.arc.screenAngle)) : look.guard === null),
      `race ${look.race ? "shape" : null} guard ${look.guard ? "shape" : null}`);
    // a tap on the next tap or press target, through the hook, is judged In time (the first stage that has one)
    if (!tapChecked && look.next && (look.next.kind === "tap" || look.next.kind === "press") && look.next.t - s.t < 6) {
      const tp = await F(page, () => window.__fb.tap({ errMs: 0 }));
      const now = (await S(page)).t;
      const due = tp ? Math.max(1, Math.ceil((tp.t - now + 0.3) * 60)) : 1;
      s = await F(page, (n) => window.__fb.step(n), due);
      const j = s.judges.find((x) => tp && x.target === tp.target);
      check(`${tag}: ${id}: __fb.tap() on the next target is judged In time`, tp && tp.target && j && j.grade === "in" && Math.abs(j.errMs) < 1,
        `${JSON.stringify(tp)} ${JSON.stringify(j)}`);
      tapChecked = id;
    }
    await F(page, () => window.__fb.finish());
    for (let k = 0; k < 4; k++) {
      s = await S(page);
      if (s.screen === "almost") await F(page, () => window.__fb.act("goOn"));
      else if (s.screen === "overlay") await F(page, () => window.__fb.act("next"));
      else break;
    }
    s = await S(page);
    check(`${tag}: ${id}: finish() leads to the result`, s.screen === "result", s.screen);
  }

  check(`${tag}: some stage had a tap target for __fb.tap()`, !!tapChecked);
  check(`${tag}: no page or console errors (test mode)`, errors.length === 0, errors.slice(0, 5).join(" || "));
  await ctx.close();

  // ---- realtime: the rAF loop advances the stage clock
  const rt = await open(size, "");
  await press(rt.page, size, "#play");
  const a = await S(rt.page);
  await wait(2200);
  const b = await S(rt.page);
  check(`${tag}: without ?test=1 the rAF loop advances the stage clock`,
    a.screen === "stage" && b.screen === "stage" && b.realtime === true && b.t - a.t > 1, `t ${a.t} → ${b.t}`);
  // her beats go to the sound from run.beats(), each once, about a beat period apart
  const snd = await F(rt.page, () => window.__fb.sound);
  const gaps = snd.beats.mother.slice(1).map((x, i) => x - snd.beats.mother[i]);
  check(`${tag}: her beats are scheduled once each, a beat apart`,
    snd.scheduled.mother >= 2 && snd.scheduled.mother === snd.beats.mother.length && gaps.every((g) => g > 0.5 && g < 1.2),
    `${snd.scheduled.mother} scheduled, gaps ${gaps.map((g) => g.toFixed(3)).join(" ")}`);
  const rtPerf = await F(rt.page, () => window.__fb.perf);
  check(`${tag}: realtime frames keep the frame cost`, rtPerf.emaMs > 0 && rtPerf.p95Ms > 0, JSON.stringify(rtPerf));
  check(`${tag}: no page or console errors (realtime)`, rt.errors.length === 0, rt.errors.slice(0, 5).join(" || "));
  await rt.ctx.close();
}

await browser.close();
if (server) server.kill();

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${FILE}: ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exit(1);
}
console.log(`PASS ${FILE}: ${passed} checks (${sizeList().join(", ")})`);
