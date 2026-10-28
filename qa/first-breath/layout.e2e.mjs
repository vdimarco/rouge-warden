// First Breath: the layout check (design.md 8, 9, 12, 17 "Layout", "Thumb reach", "The race HUD", "The fork in view",
// "The egg and its arc", "The gold's path in portrait"; tasks.md 5.4). With the site served (it starts
// `python3 -m http.server 8765 --directory public` itself when nothing answers), in headless Chromium with
// --disable-gpu (design.md 14.3), at 390 × 844 and 844 × 390 with touch and at 1440 × 900, every page with
// ?inset=47,0,34,0 (safe areas added to the real ones), it checks:
// - every screen (the title, Settings, Stages, Sources, the Tap test, pause, the Almost card, the stage-end overlay,
//   the stage card and the result) shows, has no horizontal scroll, has every button, link and control at least
//   44 px on the shorter side (Play 56 px tall, pause 48 × 48) and every one of them reachable inside the safe area;
// - the Music switch (first-breath-score, "The switch in every layout"): found in Settings by its role and name
//   (a switch named "Music"), it sits next to Sound (the control right after Sound, side by side or one under the
//   other with at most 24 px between them), is at least 44 px on its shorter side, overlaps no other control and no
//   HUD part, and Tab reaches it with a visible focus ring (:focus-visible, an outline of 2 px or more) drawn as the
//   Sound switch's is (the same outline and shadow);
//   in portrait the in-world overlay and Almost card keep every word above 60% of the height and clear of the HUD;
// - in every stage and the ending, played by the ref bot and sampled every 0.25 s of stage time: the HUD tags, the
//   prompt line and the caption sit inside the safe area and overlap neither each other nor the pause button; in
//   portrait the caption sits in its stage's band (50 to 58% of the height; 18 to 26% in stage 2; just under the
//   subject's body in stages 1, 3, 4 and 7, to 60%; 8 px under the prompt line in stages 5, 6 and 8) and never covers
//   the subject's own body (its sperm, cells, disc or figure, not only its ring), nothing to read sits below
//   60%, the subject (targets().anchor) stays above 60% (the thumb reach), and the scale bar sits under the clock at
//   the top left; in landscape and on desktop the scale bar sits bottom left; in stage 2 landscape a caption is one
//   line; in stage 1 portrait a caption is one line;
// - stage 1: the place slot reads "Nth of 20", matches __fb.race().place at every sample, sits under the score,
//   right-aligned with it, left of the pause button, and (portrait) at about 12 to 15% of the height; the fork: both
//   branch mouths on screen and under no HUD or prompt box 1.5 s before your head reaches the split (1,330 u);
// - stage 1 portrait in real time: every caption page is gone within 2.5 s;
// - stage 2 (?seed=1, the guard stepped 33 s): the egg's centre is the layout's subject point (portrait 50% × 45%,
//   landscape 38% × 55%, desktop 40% × 50%) at 140 u across the short axis; every stuck or held sperm (head and
//   tail) and your sperm are inside the safe area and under no HUD, prompt or caption box;
// - the gold's path in portrait over 20 seeds, places 1, 3 and 20, idle and with the ref bot: from goldIn to enter,
//   your sperm's screen point is never inside a caption box and never below 60% of the height (GOLD_SEEDS=n runs
//   fewer seeds);
// - the ending's thumb ring: bottom centre at about 78% of the height in portrait; in landscape low in the corner,
//   right with no touch and left after a touch on the left, inside the safe area;
// - the same bands and overlaps with Large text (portrait and landscape, stages 1 and 2, the title and Settings);
// - other screens (review F25 to F31), with no inset: the Almost card and the stage 2, 3 and 7 overlays at 320 × 568,
//   375 × 553 and 360 × 640, normal and Large text: every part inside the panel and above 60%, under no HUD tag,
//   each button's centre takes a tap (a real tap on Go on goes on), and a fact that does not fit scrolls; the run
//   result with every stage Glowing (?seed=3) at five sizes, normal and Large: the grade chips wrap inside the
//   panel; the scale bar drawn at its label's true length at 390 × 844, 844 × 390 and 1440 × 900; tablets in portrait
//   (768 × 1024, 600 × 960, 820 × 1180) and small phones: captions clear of the subject's body, the HUD and the
//   bottom 40%; stage 2 on small phones: captions clear of the HUD and the prompt and above the egg's 28 u zone (not
//   at 320 × 568 with Large text, where the HUD ends 16 px above that zone); small landscape phones (568 × 320 to
//   667 × 375): captions clear of the scale tag and every HUD tag.
// SHOTS=<dir> saves a screenshot of every stage and screen at each size. ONLY=portrait,landscape,desktop picks sizes
// (ONLY=other runs only the other screens).
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/layout.e2e.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FILE = "qa/first-breath/layout.e2e.mjs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) {
  console.log(`FAIL ${FILE}: Playwright is not found; run with NODE_PATH=qa/browser/node_modules`);
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGIN = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const BASE = ORIGIN + "/first-breath/";
const INSET = { t: 47, r: 0, b: 34, l: 0 };
const INSET_Q = "inset=47,0,34,0";
const SIZES = {
  portrait: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  landscape: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};
const SUBJECT = { portrait: [0.5, 0.45], landscape: [0.38, 0.55], desktop: [0.40, 0.5] };
const PX_PER_U = { portrait: 390 / 140, landscape: 390 / 140, desktop: 900 / 140 };
const STAGES = ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth", "ending"];
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
const GOLD_SEEDS = Math.max(1, Math.min(20, Number(process.env.GOLD_SEEDS) || 20));
const sizeList = () => (process.env.ONLY ? process.env.ONLY.split(",").filter((s) => SIZES[s]) : Object.keys(SIZES));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0;
const failed = [], notes = [];
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed.push(`${name}${detail ? ` (${detail})` : ""}`);
  return ok;
}
const list = (xs, n = 4) => xs.slice(0, n).join("; ") + (xs.length > n ? `; … ${xs.length - n} more` : "");

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

const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({
  ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  args: ["--disable-gpu", "--autoplay-policy=no-user-gesture-required"],
});

// ---- the measuring helpers, in the page
function pageHelpers(inset) {
  const vis = (el) => {
    if (!el || el.hidden) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const rect = (el) => {
    if (!vis(el)) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
  };
  const overlap = (a, b) => !!(a && b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5);
  const inside = (a, W, H) => a.x >= inset.l - 0.5 && a.y >= inset.t - 0.5 && a.r <= W - inset.r + 0.5 && a.b <= H - inset.b + 0.5;
  const hud = () => {
    const root = document.getElementById("hud");
    if (!root || root.hidden) return {};
    const q = (n) => rect(root.querySelector(`[data-hud="${n}"]`));
    return { stage: q("stage"), clock: q("clock"), scale: q("scale"), score: q("score"), place: q("place"), prompt: q("prompt"),
      pause: rect(document.getElementById("pause")) };
  };
  const cap = () => {
    const el = document.querySelector("#captions .cap");
    const r = rect(el);
    if (!r) return null;
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    return { ...r, lines: Math.round((r.h - pad) / lh), id: el.dataset.id || "", page: el.dataset.page || "", text: el.textContent };
  };
  // The portrait caption bands (design.md 9): [top, bottom] as shares of the height, or "top" for the band 8 px under
  // the HUD's bottom (style.css, --hud-b), 8% tall. Every stage not named keeps 50 to 58%.
  const BANDS = { egg: [0.18, 0.26], swim: [0.52, 0.6], split: [0.53, 0.6], turn: [0.53, 0.6], root: [0.55, 0.6],
    grow: "top", answer: "top", birth: "top" };
  // The subject's own body on screen, as one box: stage 1 your sperm (its head at the anchor, its 22 u body with the
  // tail straight down, the longest case, at the stage's closest span, 150 u); else the baby's figure and heart
  // pieces, the stage 3 cells round the anchor, and any disc (under 80 px) that holds the anchor.
  function subjectBox(s) {
    const a = s.anchor;
    if (!a) return null;
    let box = null;
    const add = (x0, y0, x1, y1) => { box = box ? { x: Math.min(box.x, x0), y: Math.min(box.y, y0), r: Math.max(box.r, x1), b: Math.max(box.b, y1) } : { x: x0, y: y0, r: x1, b: y1 }; };
    if (s.stageId === "swim") {
      const k = Math.min(innerWidth, innerHeight) / 150;
      add(a.x - 3 * k, a.y - 3 * k, a.x + 3 * k, a.y + 19 * k);
    } else {
      for (const b of (window.__fbPaper && window.__fbPaper.lastBodies) || []) {
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (b.kind === "figure" || b.kind === "heart" || (b.kind === "cells" && d < 70) || (b.kind === "solo" && d <= b.r + 2 && b.r < 80)) {
          add(b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r);
        }
      }
    }
    return box;
  }
  // The checks of one frame in play; → a list of problems.
  function frame(ctx) {
    const W = innerWidth, H = innerHeight, portrait = H >= W;
    const s = window.__fb.state();
    const bad = [];
    const at = `${s.stageId}@${s.t !== null ? s.t.toFixed(2) : "-"}`;
    const h = hud(), c = cap();
    const named = Object.entries(h).filter(([, v]) => v);
    if (c) named.push(["caption", c]);
    if (document.documentElement.scrollWidth > W + 0.5) bad.push(`${at} horizontal scroll`);
    for (const [n, b] of named) if (!inside(b, W, H)) bad.push(`${at} ${n} outside the safe area ${JSON.stringify([b.x, b.y, b.r, b.b].map(Math.round))}`);
    const groups = { stage: "L", clock: "L", scale: "S", score: "R", place: "R", pause: "P", prompt: "M", caption: "C" };
    for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) {
      const [a, A] = named[i], [b, B] = named[j];
      if (overlap(A, B)) bad.push(`${at} ${a} overlaps ${b}`);
      void groups;
    }
    if (portrait) {
      if (c) {
        const band = BANDS[s.stageId] || [0.5, 0.58];
        if (band === "top") {
          const hb = Math.ceil(document.getElementById("hud").getBoundingClientRect().bottom);
          const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hud-b"));
          const lo = (Number.isFinite(v) ? v : hb) + 8, hi = lo + 0.08 * H;
          if (c.y < hb + 8 - 1 || c.y < lo - 1 || c.b > hi + 1) bad.push(`${at} caption ${Math.round(c.y)}..${Math.round(c.b)} not 8 px under the HUD (${hb}) in its band ${Math.round(lo)}..${Math.round(hi)}`);
        } else {
          const [lo, hi] = band;
          if (c.y < lo * H - 1 || c.b > hi * H + 1) bad.push(`${at} caption ${Math.round(c.y)}..${Math.round(c.b)} outside ${lo * 100}..${hi * 100}%`);
        }
        if (s.stageId === "swim" && c.lines > 1) bad.push(`${at} stage 1 caption on ${c.lines} lines: ${c.text}`);
        const body = s.screen === "stage" || s.screen === "ending" ? subjectBox(s) : null;
        if (body && overlap(c, body)) bad.push(`${at} caption ${Math.round(c.y)}..${Math.round(c.b)} covers the subject's body ${Math.round(body.y)}..${Math.round(body.b)}`);
      }
      for (const [n, b] of named) if (n !== "pause" && b.b > 0.6 * H + 0.5) bad.push(`${at} ${n} text below 60% (${Math.round(b.b)})`);
      if (s.screen === "stage" && s.anchor && s.anchor.y > 0.6 * H + 0.5) bad.push(`${at} the subject below 60% (${Math.round(s.anchor.y)})`);
      if (h.scale && h.clock && !(h.scale.y >= h.clock.b - 0.5 && Math.abs(h.scale.x - h.clock.x) <= 1.5 + (h.stage ? Math.abs(h.stage.x - h.clock.x) : 0) && h.scale.y < 0.25 * H)) {
        bad.push(`${at} the scale bar is not under the clock, top left`);
      }
    } else {
      if (h.scale && !(h.scale.x <= inset.l + 24 && h.scale.b >= H - inset.b - 40)) bad.push(`${at} the scale bar is not bottom left`);
      if (c && s.stageId === "egg" && c.lines > 1) bad.push(`${at} stage 2 caption on ${c.lines} lines in landscape`);
    }
    if (h.pause && (h.pause.w < 48 - 0.5 || h.pause.h < 48 - 0.5)) bad.push(`${at} pause ${h.pause.w}×${h.pause.h}`);
    if (h.place) {
      const el = document.querySelector('[data-hud="place"]');
      const text = el.textContent.trim();
      const race = window.__fb.race();
      const ord = (n) => { const t = n % 100, u = n % 10; return n + (t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"); };
      if (!/^\d+(st|nd|rd|th) of 20$/.test(text)) bad.push(`${at} place slot reads "${text}"`);
      else if (race && Number.isFinite(race.place) && text !== `${ord(race.place)} of 20`) bad.push(`${at} place slot "${text}" vs race().place ${race.place}`);
      if (h.score && !(h.place.y >= h.score.b - 0.5 && Math.abs(h.place.r - h.score.r) <= 2)) bad.push(`${at} place slot not under the score`);
      if (h.pause && h.place.r > h.pause.x + 0.5) bad.push(`${at} place slot not left of the pause button`);
      if (portrait && ctx && ctx.inset && (h.place.y < 0.09 * H || h.place.b > 0.17 * H)) bad.push(`${at} place slot at ${Math.round(h.place.y)}..${Math.round(h.place.b)} px`);
    }
    return bad;
  }
  // Every visible button, link and control in a screen: size, and reachable inside the safe area.
  function screen(name) {
    const W = innerWidth, H = innerHeight, portrait = H >= W;
    const sec = document.querySelector(`#screens section.screen[data-screen="${name}"]`);
    const bad = [];
    if (!vis(sec)) return { bad: [`${name} is not shown`], n: 0 };
    if (sec.scrollWidth > sec.clientWidth + 1) bad.push(`${name}: horizontal scroll (${sec.scrollWidth} > ${sec.clientWidth})`);
    if (document.documentElement.scrollWidth > W + 0.5) bad.push(`${name}: the page scrolls sideways`);
    const els = [...sec.querySelectorAll("button, a[href], input, select, [data-act]")].filter(vis);
    for (const el of els) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      const r = el.getBoundingClientRect();
      const label = (el.id ? "#" + el.id : el.dataset.act || el.dataset.set || el.tagName) + " " + (el.textContent || "").trim().slice(0, 24);
      if (Math.min(r.width, r.height) < 44 - 0.5) bad.push(`${name}: ${label} is ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (el.id === "play" && r.height < 56 - 0.5) bad.push(`${name}: Play is ${Math.round(r.height)} px tall`);
      if (r.left < inset.l - 0.5 || r.right > W - inset.r + 0.5 || r.top < inset.t - 0.5 || r.bottom > H - inset.b + 0.5) {
        bad.push(`${name}: ${label} not reachable inside the safe area ${JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round))}`);
      }
    }
    sec.scrollTop = 0;
    if (portrait && (name === "overlay" || name === "almost")) {
      const h = hud();
      for (const el of sec.querySelectorAll("p, h2, button")) {
        const r = rect(el);
        if (!r) continue;
        if (r.b > 0.6 * H + 0.5) bad.push(`${name}: "${el.textContent.trim().slice(0, 24)}" below 60% (${Math.round(r.b)})`);
      }
      const p = rect(sec.querySelector(".panel"));
      for (const [n, b] of Object.entries(h)) if (b && overlap(p, b)) bad.push(`${name}: the panel overlaps the HUD ${n}`);
    }
    return { bad, n: els.length };
  }
  // A least-squares map world → screen from the points of a probe (rotation, scale and shift).
  function fit(points) {
    const P = points.filter((p) => p && p.screen && Number.isFinite(p.x) && Number.isFinite(p.screen.x));
    if (P.length < 3) return null;
    // screen = [a −b; b a] world + [c d]  (or a mirror-free map with y flipped: try both, keep the better)
    const solve = (flip) => {
      let n = 0, sx = 0, sy = 0, su = 0, sv = 0, sxx = 0, sxu = 0, syv = 0, sxv = 0, syu = 0;
      for (const p of P) {
        const x = p.x, y = flip ? -p.y : p.y, u = p.screen.x, v = p.screen.y;
        n++; sx += x; sy += y; su += u; sv += v; sxx += x * x + y * y; sxu += x * u + y * v; sxv += x * v - y * u;
        void syv; void syu;
      }
      const mx = sx / n, my = sy / n, mu = su / n, mv = sv / n;
      const den = sxx - n * (mx * mx + my * my);
      if (!(den > 1e-9)) return null;
      const a = (sxu - n * (mx * mu + my * mv)) / den, b = (sxv - n * (mx * mv - my * mu)) / den;
      const c = mu - (a * mx - b * my), d = mv - (b * mx + a * my);
      let err = 0;
      for (const p of P) {
        const x = p.x, y = flip ? -p.y : p.y;
        err = Math.max(err, Math.hypot(a * x - b * y + c - p.screen.x, b * x + a * y + d - p.screen.y));
      }
      return { map: (x, y0) => { const y = flip ? -y0 : y0; return { x: a * x - b * y + c, y: b * x + a * y + d }; }, scale: Math.hypot(a, b), err };
    };
    const A = solve(false), B = solve(true);
    if (!A) return B;
    if (!B) return A;
    return A.err <= B.err ? A : B;
  }
  window.__lay = { rect, overlap, inside, hud, cap, frame, screen, fit, subjectBox };
}

async function open(size, query = "", { large = false } = {}) {
  const ctx = await browser.newContext({ ...SIZES[size] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.addInitScript(({ large }) => {
    try {
      if (!sessionStorage.getItem("fb-qa")) {
        localStorage.clear();
        if (large) localStorage.setItem("first-breath.save.v1", JSON.stringify({ v: 1, settings: { largeText: true } }));
        sessionStorage.setItem("fb-qa", "1");
      }
    } catch (e) { /* storage off */ }
  }, { large });
  await page.addInitScript(pageHelpers, INSET);
  const sep = query.includes("?") ? "&" : "?";
  await page.goto(BASE + query + sep + INSET_Q);
  await page.waitForFunction(() => window.__fb && window.__fb.state && window.__fb.state().frames > 0 && window.__lay, null, { timeout: 60000 });
  return { ctx, page, errors };
}
const shot = async (page, size, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${size}-${name}.png`) }); };

// Play a stage with the ref bot (or idle), sampling every `every` steps; → the problems and what was seen.
async function playStage(page, stage, { bot = 1, maxS = 75, every = 15, seed = 1 } = {}) {
  return page.evaluate(({ stage, bot, maxS, every, seed }) => {
    const fb = window.__fb;
    fb.goto(stage, { seed });
    if (bot !== null) fb.bot(bot);
    const bad = [], seen = { captions: 0, prompt: 0, place: 0, samples: 0 };
    const capIds = new Set();
    for (let i = 0; i < Math.ceil((maxS * 60) / every); i++) {
      const s = fb.step(every);
      if (s.screen !== "stage" && s.screen !== "ending") break;
      bad.push(...window.__lay.frame({ inset: true }));
      const h = window.__lay.hud(), c = window.__lay.cap();
      seen.samples++;
      if (c && !capIds.has(c.id + c.page)) { capIds.add(c.id + c.page); seen.captions++; }
      if (h.prompt) seen.prompt++;
      if (h.place) seen.place++;
    }
    fb.bot(false);
    return { bad, seen };
  }, { stage, bot, maxS, every, seed });
}

for (const size of sizeList()) {
  const tag = size;
  const portrait = size === "portrait";

  // ---- the screens
  {
    const { ctx, page, errors } = await open(size, "?test=1&seed=1");
    const scr = async (name) => {
      const r = await page.evaluate((n) => window.__lay.screen(n), name);
      check(`${tag}: the ${name} screen fits, its targets are ≥ 44 px and reachable`, r.bad.length === 0 && r.n > 0, r.n ? list(r.bad) : "no targets");
      await shot(page, size, "screen-" + name);
    };
    await scr("title");
    for (const m of ["settings", "stages", "sources", "tapTest"]) {
      await page.evaluate((m) => window.__fb.act(m), m);
      await scr(m);
      await page.evaluate(() => window.__fb.act("back"));
    }
    // a settings change keeps the screen whole (the carer word and Large text)
    await page.evaluate(() => window.__fb.act("settings"));
    if (SIZES[size].hasTouch) await page.tap('[data-set="carer"][data-val="mum"]');
    else await page.click('[data-set="carer"][data-val="mum"]');
    const carer = await page.evaluate(() => window.__fb.state().settings.carer);
    check(`${tag}: Settings sets the carer word`, carer === "mum", carer);
    await page.evaluate(() => window.__fb.act("back"));

    // the Music switch, found by its role and name
    await page.evaluate(() => window.__fb.act("settings"));
    const musicSw = page.locator('#screens section.screen[data-screen="settings"]').getByRole("switch", { name: /^Music/ });
    const found = await musicSw.count();
    if (found === 1) await musicSw.scrollIntoViewIfNeeded();
    const geo = await page.evaluate(() => {
      const sec = document.querySelector('#screens section.screen[data-screen="settings"]');
      const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
      const R = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
      const ctl = [...sec.querySelectorAll("button, a[href], input, select, [data-act], [data-set]")].filter(vis);
      const m = ctl.find((e) => e.getAttribute("role") === "switch" && /^Music/.test(e.textContent.trim()));
      const snd = sec.querySelector('[data-set="sound"]');
      if (!m || !snd) return { m: !!m, snd: !!snd };
      const a = R(m), b = R(snd);
      const ov = (p, q) => p.x < q.r - 0.5 && q.x < p.r - 0.5 && p.y < q.b - 0.5 && q.y < p.b - 0.5;
      const over = ctl.filter((e) => e !== m && !m.contains(e) && !e.contains(m) && ov(a, R(e))).map((e) => (e.dataset.set || e.dataset.act || e.tagName) + "");
      for (const id of ["hud", "pause"]) { const h = document.getElementById(id); if (h && vis(h) && ov(a, R(h))) over.push("#" + id); }
      const row = Math.abs(a.y - b.y) <= 2 && Math.max(a.x - b.r, b.x - a.r) <= 24;
      const col = Math.abs(a.x - b.x) <= 2 && Math.max(a.y - b.b, b.y - a.b) <= 24;
      return { m: true, snd: true, a, b, after: ctl.indexOf(m) === ctl.indexOf(snd) + 1, beside: row || col, over, inView: a.y >= 0 && a.b <= innerHeight && a.x >= 0 && a.r <= innerWidth };
    });
    check(`${tag}: Settings has one switch named Music, right after Sound and beside it`, found === 1 && geo.m && geo.after && geo.beside,
      JSON.stringify({ found, after: geo.after, beside: geo.beside, music: geo.a && [geo.a.x, geo.a.y, geo.a.w, geo.a.h].map(Math.round), sound: geo.b && [geo.b.x, geo.b.y, geo.b.w, geo.b.h].map(Math.round) }));
    check(`${tag}: the Music switch is at least 44 px on its shorter side, on screen, and overlaps nothing`, !!geo.a && Math.min(geo.a.w, geo.a.h) >= 44 - 0.5 && geo.inView && geo.over.length === 0,
      geo.a ? `${Math.round(geo.a.w)}×${Math.round(geo.a.h)}, on screen ${geo.inView}, overlaps ${geo.over.join(", ") || "nothing"}` : "not found");
    // Tab from the top of the panel until the focus is on it; its focus ring, then Sound's (Shift+Tab, one back)
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    let tabs = 0, onMusic = false;
    for (; tabs < 60 && !onMusic; tabs++) {
      await page.keyboard.press("Tab");
      onMusic = await page.evaluate(() => { const a = document.activeElement; return !!a && a.getAttribute("role") === "switch" && /^Music/.test(a.textContent.trim()); });
    }
    const ring = () => page.evaluate(() => {
      const a = document.activeElement, cs = getComputedStyle(a);
      return { id: a.dataset.set || null, fv: a.matches(":focus-visible"), style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, shadow: cs.boxShadow };
    });
    const mRing = onMusic ? await ring() : null;
    await page.keyboard.press("Shift+Tab");
    const sRing = await ring();
    const same = !!mRing && sRing.id === "sound" && mRing.style === sRing.style && mRing.width === sRing.width && mRing.color === sRing.color && mRing.shadow === sRing.shadow;
    check(`${tag}: Tab reaches the Music switch, with a visible focus ring like the Sound switch's`,
      onMusic && mRing.fv && mRing.style !== "none" && mRing.width >= 2 && !/rgba\([^)]*, 0\)|transparent/.test(mRing.color) && same,
      JSON.stringify({ tabs, music: mRing, sound: sRing }));
    await shot(page, size, "screen-settings-music");
    await page.evaluate(() => window.__fb.act("back"));

    await page.evaluate(() => { window.__fb.act("play"); window.__fb.step(90); });
    await shot(page, size, "stage-swim-start");
    await page.evaluate(() => window.__fb.act("pause"));
    await scr("pause");
    await page.evaluate(() => window.__fb.act("resume"));
    await page.evaluate(() => window.__fb.finish());
    const s1 = await page.evaluate(() => window.__fb.state().screen);
    if (check(`${tag}: finishing stage 1 early shows the Almost card`, s1 === "almost", s1)) await scr("almost");
    await page.evaluate(() => { window.__fb.act("goOn"); for (let i = 0; i < 60 && window.__fb.state().screen !== "overlay"; i++) window.__fb.step(10); });
    if (check(`${tag}: the overlay shows`, (await page.evaluate(() => window.__fb.state().screen)) === "overlay")) await scr("overlay");
    await page.evaluate(() => { window.__fb.act("next"); window.__fb.step(6); });
    if (check(`${tag}: the card shows`, (await page.evaluate(() => window.__fb.state().screen)) === "card")) await scr("card");
    await page.evaluate(() => { window.__fb.goto("birth"); window.__fb.finish(); });
    if (check(`${tag}: the result shows`, (await page.evaluate(() => window.__fb.state().screen)) === "result")) await scr("result");
    check(`${tag}: no page errors on the screens`, errors.length === 0, list(errors));
    await ctx.close();
  }

  // ---- every stage, played by the ref bot
  {
    const { ctx, page, errors } = await open(size, "?test=1&seed=1");
    for (const st of STAGES) {
      const r = await playStage(page, st, { maxS: st === "ending" ? 34 : 75 });
      check(`${tag}: ${st}: HUD, prompt and captions in place (${r.seen.samples} frames, ${r.seen.captions} captions)`,
        r.bad.length === 0 && r.seen.samples > 10, list(r.bad));
      if (st === "swim") check(`${tag}: swim: the place slot showed`, r.seen.place > 0, String(r.seen.place));
      await page.evaluate((st) => { window.__fb.goto(st, { seed: 1 }); window.__fb.bot(1); window.__fb.step(st === "ending" ? 800 : 600); window.__fb.bot(false); }, st);
      await shot(page, size, "stage-" + st);
    }
    check(`${tag}: no page errors in the stages`, errors.length === 0, list(errors));
    await ctx.close();
  }

  // ---- stage 1: the fork in view, 1.5 s before your head reaches the split
  {
    const { ctx, page } = await open(size, "?test=1&seed=1");
    const r = await page.evaluate(({ inset }) => {
      const fb = window.__fb;
      fb.goto("swim", { seed: 1 });
      fb.bot(1);
      const W = innerWidth, H = innerHeight;
      const samples = [];
      for (let i = 0; i < 70 * 20; i++) {
        const s = fb.step(3);
        if (s.screen !== "stage") break;
        const race = fb.race();
        if (!race) continue;
        const m = window.__lay.fit([race.you, ...race.rivals]);
        const h = window.__lay.hud();
        const mouths = m ? [m.map(30, 1345), m.map(-30, 1345)] : null;
        samples.push({ t: s.t, p: race.you.progress, mouths, boxes: [h.stage, h.clock, h.scale, h.score, h.place, h.prompt, h.pause].filter(Boolean) });
        if (race.you.progress >= 1330) break;
      }
      fb.bot(false);
      const split = samples.find((x) => x.p >= 1330);
      if (!split) return { ok: false, why: "never reached the split" };
      const at = samples.filter((x) => x.t >= split.t - 1.5 - 0.06 && x.t <= split.t - 1.5 + 0.06);
      const bad = [];
      for (const x of at.length ? at : [samples[0]]) {
        if (!x.mouths) { bad.push("no map"); continue; }
        for (const q of x.mouths) {
          if (!(q.x >= inset.l && q.x <= W - inset.r && q.y >= inset.t && q.y <= H - inset.b)) bad.push(`mouth off screen at ${Math.round(q.x)},${Math.round(q.y)} (t ${x.t.toFixed(2)}, split at ${split.t.toFixed(2)})`);
          for (const b of x.boxes) if (q.x >= b.x && q.x <= b.r && q.y >= b.y && q.y <= b.b) bad.push(`mouth under a HUD box at ${Math.round(q.x)},${Math.round(q.y)}`);
        }
      }
      return { ok: bad.length === 0, why: bad.join("; "), split: split.t };
    }, { inset: INSET });
    check(`${tag}: swim: both fork mouths in view 1.5 s before the split`, r.ok, r.why);
    await ctx.close();
  }

  // ---- stage 1 portrait in real time: every caption page goes within 2.5 s
  if (portrait) {
    const { ctx, page } = await open(size, "?seed=1");
    await page.evaluate(() => {
      window.__capLog = [];
      const root = document.getElementById("captions");
      const live = new Map();
      new MutationObserver(() => {
        const el = root.querySelector(".cap");
        const key = el ? (el.dataset.id || "") + "#" + (el.dataset.page || "") + "#" + el.textContent : null;
        const t = performance.now();
        for (const [k, t0] of live) if (k !== key) { window.__capLog.push({ k, ms: t - t0 }); live.delete(k); }
        if (key && !live.has(key)) live.set(key, t);
      }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
    });
    await page.tap("#play");
    await page.evaluate(() => window.__fb.bot(1));
    await wait(22000);
    const log = await page.evaluate(() => window.__capLog.slice());
    const long = log.filter((x) => x.ms > 2500 + 150);
    check(`${tag}: swim in real time: every caption page goes within 2.5 s (${log.length} seen)`, log.length > 0 && long.length === 0,
      list(long.map((x) => `${Math.round(x.ms)} ms ${x.k}`)));
    await ctx.close();
  }

  // ---- stage 2: the egg, its arc and the sperm in the free part of the screen
  {
    // the guard played by the ref bot (first-breath-action-genres design.md 5.2): every half second until your sperm
    // enters, the field's rim, every rival in a ring, every stuck or held one and your sperm inside the rim
    const { ctx, page } = await open(size, "?test=1&seed=1&stage=2&moment=guard");
    const r = await page.evaluate(({ inset, subject, ppu }) => {
      const fb = window.__fb;
      const W = innerWidth, H = innerHeight;
      const bad = [];
      let n = 0, gold = null, frames = 0, swarm = false;
      fb.bot(1);
      for (let k = 0; k < 120; k++) {
        fb.step(30);
        const g = fb.guard();
        if (!g || g.entered) break;
        frames++;
        const e = g.egg.screen;
        if (k === 0 && !(Math.abs(e.x - subject[0] * W) <= 4 && Math.abs(e.y - subject[1] * H) <= 4)) bad.push(`egg centre at ${Math.round(e.x)},${Math.round(e.y)}, wanted ${Math.round(subject[0] * W)},${Math.round(subject[1] * H)}`);
        const m = window.__lay.fit([...g.sperm, ...(g.gold ? [g.gold] : []), g.egg]);
        if (!m) { bad.push("no map"); continue; }
        if (k === 0 && Math.abs(m.scale - ppu) / ppu > 0.03) bad.push(`scale ${m.scale.toFixed(2)} px/u, wanted ${ppu.toFixed(2)} (140 u span)`);
        const h = window.__lay.hud(), c = window.__lay.cap();
        const boxes = [h.stage, h.clock, h.scale, h.score, h.prompt, h.pause, c].filter(Boolean);
        const pts = [];
        for (let a = 0; a < 16; a++) pts.push([`the rim at ${a * 22.5}°`, m.map(g.rim * Math.cos((a * Math.PI) / 8), g.rim * Math.sin((a * Math.PI) / 8))]);
        for (const sp of g.sperm) if (["ring", "stuck", "held"].includes(sp.state) && sp.r <= g.rim + 1) pts.push([`a rival (${sp.state})`, sp.screen]);
        if (g.gold && g.gold.screen && g.gold.r <= g.rim) { pts.push(["your sperm", g.gold.screen]); gold = g.gold.state; }
        if (g.sperm.some((sp) => sp.state === "ring" && sp.r > 40)) swarm = true;
        for (const [id, q] of pts) {
          if (!(q.x >= inset.l && q.x <= W - inset.r && q.y >= inset.t && q.y <= H - inset.b)) bad.push(`${id} outside the safe area`);
          for (const b of boxes) if (q.x >= b.x && q.x <= b.r && q.y >= b.y && q.y <= b.b) bad.push(`${id} under a HUD, prompt or caption box`);
        }
        n += pts.length;
      }
      fb.bot(false);
      return { bad: [...new Set(bad)], n, gold, frames, swarm };
    }, { inset: INSET, subject: SUBJECT[size], ppu: PX_PER_U[size] });
    check(`${tag}: egg: the egg at the subject point at 140 u; the rim, every rival in a ring or stuck and yours in the free screen (${r.frames} frames, ${r.n} points, gold ${r.gold})`,
      r.bad.length === 0 && r.n > 0 && r.swarm && r.gold !== null, list(r.bad));
    await shot(page, size, "egg-guard-rush");
    await ctx.close();
  }

  // ---- the gold's path in portrait: never under a caption, never below 60%
  if (portrait) {
    const { ctx, page } = await open(size, "?test=1&seed=1");
    const bad = [];
    let runs = 0, entered = 0;
    for (let seed = 1; seed <= GOLD_SEEDS; seed++) {
      for (const place of [1, 3, 20]) {
        for (const bot of [null, 1]) {
          const r = await page.evaluate(({ seed, place, bot }) => {
            const fb = window.__fb, H = innerHeight;
            fb.goto("egg", { seed, carry: { sperm: { hue: 0.11, place, glow: 0.5 } } });
            fb.jump("guard");
            if (bot !== null) fb.bot(bot);
            const bad = [];
            let g = fb.guard();
            // idle: the shell needs a rest (a knock-out), and Go on brings your sperm in alone
            for (let i = 0; i < 60 * 2 && !(g && g.gold); i++) { fb.step(30); if (fb.state().screen === "almost") fb.act("goOn"); g = fb.guard(); }
            let n = 0;
            for (let i = 0; i < 60 * 12 && g && g.gold && !g.entered; i++) {
              fb.step(3);
              g = fb.guard();
              if (!g || !g.gold || g.entered) break;
              const q = g.gold.screen, c = window.__lay.cap();
              n++;
              if (q.y > 0.6 * H) bad.push(`seed ${seed} place ${place}${bot ? " ref" : " idle"}: below 60% at ${Math.round(q.y)}`);
              if (c && q.x >= c.x && q.x <= c.r && q.y >= c.y && q.y <= c.b) bad.push(`seed ${seed} place ${place}${bot ? " ref" : " idle"}: under the caption "${c.text.slice(0, 24)}"`);
            }
            fb.bot(false);
            return { bad: bad.slice(0, 2), n, entered: !!(g && g.entered) };
          }, { seed, place, bot });
          runs++;
          if (r.entered) entered++;
          bad.push(...r.bad);
        }
      }
    }
    check(`${tag}: egg: your sperm's path from goldIn to enter is never under a caption or below 60% (${runs} runs)`, bad.length === 0, list(bad));
    check(`${tag}: egg: your sperm enters in every run checked`, entered === runs, `${entered} of ${runs}`);
    await ctx.close();
  }

  // ---- the ending's thumb ring
  if (size !== "desktop") {
    const { ctx, page } = await open(size, "?test=1&seed=1");
    const ring = async () => page.evaluate(() => {
      const g = document.querySelector('#rings g[data-kind="rest"]');
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, r: r.right, b: r.bottom };
    });
    await page.evaluate(() => { window.__fb.goto("ending", { seed: 1 }); window.__fb.jump("thumb"); window.__fb.step(30); });
    const W = SIZES[size].viewport.width, H = SIZES[size].viewport.height;
    const a = await ring();
    const safe = (q) => q && q.l >= INSET.l && q.t >= INSET.t && q.r <= W - INSET.r && q.b <= H - INSET.b;
    if (portrait) {
      check(`${tag}: ending: the thumb ring at bottom centre, about 78% of the height`,
        !!a && Math.abs(a.x - W / 2) <= 12 && Math.abs(a.y - 0.78 * H) <= 0.04 * H && safe(a), JSON.stringify(a));
    } else {
      check(`${tag}: ending: with no touch the thumb ring sits low on the right`, !!a && a.x > 0.6 * W && a.y > 0.55 * H && safe(a), JSON.stringify(a));
      await page.touchscreen.tap(90, H - 90);
      await page.evaluate(() => window.__fb.step(20));
      const b = await ring();
      check(`${tag}: ending: after a touch on the left the thumb ring sits low on the left`, !!b && b.x < 0.4 * W && b.y > 0.55 * H && safe(b), JSON.stringify(b));
    }
    await shot(page, size, "ending-thumb");
    await ctx.close();
  }

  // ---- Large text: the same bands and overlaps
  if (size !== "desktop") {
    const { ctx, page, errors } = await open(size, "?test=1&seed=1", { large: true });
    const large = await page.evaluate(() => document.documentElement.classList.contains("large"));
    check(`${tag}: Large text from the save`, large);
    for (const n of ["title", "settings"]) {
      if (n !== "title") await page.evaluate((m) => window.__fb.act(m), n);
      const r = await page.evaluate((m) => window.__lay.screen(m), n);
      check(`${tag}: Large text: the ${n} screen fits and its targets are ≥ 44 px`, r.bad.length === 0, list(r.bad));
      if (n !== "title") await page.evaluate(() => window.__fb.act("back"));
    }
    for (const st of ["swim", "egg"]) {
      const r = await playStage(page, st, { maxS: 60 });
      check(`${tag}: Large text: ${st}: HUD, prompt and captions in place`, r.bad.length === 0, list(r.bad));
      await page.evaluate((st) => { window.__fb.goto(st, { seed: 1 }); window.__fb.bot(1); window.__fb.step(st === "egg" ? 1500 : 600); window.__fb.bot(false); }, st);
      await shot(page, size, "large-" + st);
    }
    check(`${tag}: no page errors with Large text`, errors.length === 0, list(errors));
    await ctx.close();
  }
}

// ---- other screens (review F25 to F31): small phones, tablets in portrait, small landscape phones. ONLY=other runs
// just these; any other ONLY skips them.
async function openAt(w, h, query = "", { touch = true, large = false, inset = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.addInitScript(({ large }) => {
    try {
      if (!sessionStorage.getItem("fb-qa")) {
        localStorage.clear();
        if (large) localStorage.setItem("first-breath.save.v1", JSON.stringify({ v: 1, settings: { largeText: true } }));
        sessionStorage.setItem("fb-qa", "1");
      }
    } catch (e) { /* storage off */ }
  }, { large });
  await page.addInitScript(pageHelpers, inset ? INSET : { t: 0, r: 0, b: 0, l: 0 });
  const sep = query.includes("?") ? "&" : "?";
  await page.goto(BASE + query + (inset ? sep + INSET_Q : ""));
  await page.waitForFunction(() => window.__fb && window.__fb.state && window.__fb.state().frames > 0 && window.__lay, null, { timeout: 60000 });
  return { ctx, page, errors };
}
const runOther = !process.env.ONLY || process.env.ONLY.split(",").includes("other");

// F25: the in-world overlay and the Almost card on small portrait phones, with and without Large text: every part of
// the panel inside it and above 60%, the panel under no HUD tag, each button's centre takes a tap, a fact that does
// not fit scrolls (and shows two lines at the least), and a real tap on Go on goes on
if (runOther) {
  for (const [w, h] of [[320, 568], [375, 553], [360, 640]]) for (const large of [false, true]) {
    const tag = `${w}x${h}${large ? " Large" : ""}`;
    const { ctx, page, errors } = await openAt(w, h, "?test=1&seed=1", { large });
    const panelBad = () => page.evaluate(() => {
      const sec = document.querySelector("#screens section.screen:not([hidden])");
      if (!sec || !sec.classList.contains("inworld")) return [`no in-world screen (${window.__fb.state().screen})`];
      const p = sec.querySelector(".panel"), pr = p.getBoundingClientRect(), bad = [], H = innerHeight;
      if (pr.bottom > 0.6 * H + 0.5) bad.push(`panel ends at ${Math.round(pr.bottom)}, below 60%`);
      for (const c of p.children) {
        const r = c.getBoundingClientRect();
        if (r.bottom > pr.bottom + 0.5 || r.top < pr.top - 0.5) bad.push(`"${c.textContent.trim().slice(0, 24)}" ${Math.round(r.top)}..${Math.round(r.bottom)} outside the panel ${Math.round(pr.top)}..${Math.round(pr.bottom)}`);
      }
      for (const b of p.querySelectorAll("button")) {
        const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!(hit === b || b.contains(hit))) bad.push(`${b.id || b.dataset.act}: its centre does not take a tap`);
      }
      const f = p.querySelector(".fact, .kept");
      if (f && f.scrollHeight > f.clientHeight + 1) {
        const lh = parseFloat(getComputedStyle(f).lineHeight) || 22;
        if (getComputedStyle(f).overflowY !== "auto") bad.push("a cut fact does not scroll");
        if (f.clientHeight < 2 * lh - 1) bad.push(`the fact shows ${f.clientHeight} px, under two lines`);
      }
      for (const n of ["stage", "clock", "scale", "score", "place"]) {
        const e = document.querySelector(`[data-hud="${n}"]`);
        if (!e || e.hidden || getComputedStyle(e).visibility === "hidden") continue;
        const r = e.getBoundingClientRect();
        if (r.width && r.left < pr.right && r.right > pr.left && r.top < pr.bottom && r.bottom > pr.top) bad.push(`the panel is under the HUD ${n}`);
      }
      const pause = document.getElementById("pause").getBoundingClientRect();
      if (pause.left < pr.right && pause.right > pr.left && pause.top < pr.bottom && pause.bottom > pr.top) bad.push("the panel is under the pause button");
      return bad;
    });
    await page.evaluate(() => { const fb = window.__fb; fb.goto("swim", { seed: 1 }); fb.step(300); fb.finish(); });
    const a = await panelBad();
    check(`${tag}: the Almost card fits above 60% and every part takes a tap`, a.length === 0, list(a));
    const box = await page.evaluate(() => { const r = document.getElementById("goOn").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.touchscreen.tap(box.x, box.y);
    const on = await page.evaluate(() => { for (let i = 0; i < 60 && window.__fb.state().screen !== "overlay"; i++) window.__fb.step(10); return window.__fb.state().screen; });
    check(`${tag}: a tap on Go on goes on`, on === "overlay", on);
    for (const st of ["egg", "split", "turn"]) {
      await page.evaluate((st) => {
        const fb = window.__fb;
        fb.goto(st, { seed: 1 }); fb.bot(3);
        for (let i = 0; i < 400 && fb.state().screen === "stage"; i++) fb.step(30);
        fb.bot(false);
        if (fb.state().screen === "stage") fb.finish();
      }, st);
      const b = await panelBad();
      check(`${tag}: the ${st} overlay fits above 60%, nothing cut off`, b.length === 0, list(b));
    }
    check(`${tag}: no page errors (in-world)`, errors.length === 0, list(errors));
    await ctx.close();
  }
}

// F26: the run result with every stage Glowing (?seed=3, the ref bot): at each size, normal and Large text, the
// chips wrap: none leaves the chip row or the panel, none is cut, and nothing scrolls sideways
if (runOther) {
  const { ctx, page, errors } = await openAt(390, 844, "?test=1&seed=3");
  await page.evaluate(() => { window.__fb.act("play"); window.__fb.bot(1); });
  for (let i = 0; i < 400; i++) {
    const s = await page.evaluate(() => { const fb = window.__fb; for (let k = 0; k < 10 && fb.state().screen !== "result"; k++) fb.step(120); return fb.state().screen; });
    if (s === "result") break;
  }
  const grades = await page.evaluate(() => [...document.querySelectorAll('section[data-screen="result"] .chips li')].map((li) => li.textContent.trim()));
  check(`the result shows 8 chips (${grades.join(", ")})`, grades.length === 8);
  if (!grades.every((g) => /Glowing$/.test(g))) notes.push(`the seed 3 run was not Glowing in every stage: ${grades.join(", ")}`);
  for (const [w, h] of [[390, 844], [360, 640], [320, 568], [844, 390], [1440, 900]]) for (const large of [false, true]) {
    await page.setViewportSize({ width: w, height: h });
    const bad = await page.evaluate((large) => {
      document.documentElement.classList.toggle("large", large);
      const sec = document.querySelector('section.screen[data-screen="result"]');
      const ul = sec.querySelector(".chips").getBoundingClientRect(), pr = sec.querySelector(".panel").getBoundingClientRect();
      const out = [];
      if (sec.scrollWidth > sec.clientWidth + 1) out.push(`scrolls sideways ${sec.scrollWidth} > ${sec.clientWidth}`);
      for (const li of sec.querySelectorAll(".chips li")) {
        const r = li.getBoundingClientRect();
        if (r.left < ul.left - 0.5 || r.right > ul.right + 0.5 || r.right > pr.right + 0.5) out.push(`"${li.textContent.trim()}" ${Math.round(r.left)}..${Math.round(r.right)} outside ${Math.round(ul.left)}..${Math.round(ul.right)}`);
        if (li.scrollWidth > li.clientWidth + 1) out.push(`"${li.textContent.trim()}" is cut`);
      }
      return out;
    }, large);
    check(`${w}x${h}${large ? " Large" : ""}: the result's grade chips wrap inside the panel`, bad.length === 0, list(bad));
  }
  check("no page errors (result chips)", errors.length === 0, list(errors));
  await ctx.close();
}

// F27: the scale bar is drawn at the true length of its label in every layout (desktop too: no 120 px cap)
if (runOther) {
  for (const [w, h, touch] of [[390, 844, true], [844, 390, true], [1440, 900, false]]) {
    const { ctx, page, errors } = await openAt(w, h, "?test=1&seed=1", { touch });
    const rows = await page.evaluate(async () => {
      const { mmPerShortAxis } = await import("/first-breath/core/clock.js");
      const { STAGES } = await import("/first-breath/core/stages/index.js");
      const MM = { "0.1 mm": 0.1, "1 mm": 1, "1 cm": 10, "10 cm": 100, "1 m": 1000 };
      const out = [];
      for (const [st, s] of [["split", 14], ["root", 5], ["grow", 5], ["grow", 40], ["answer", 40], ["turn", 33], ["birth", 30]]) {
        const fb = window.__fb;
        fb.goto(st, { seed: 1 }); fb.bot(1); fb.step(Math.round(s * 60)); fb.bot(false);
        const tag = document.querySelector('[data-hud="scale"]'), bar = tag && tag.querySelector(".bar");
        const label = tag ? tag.textContent.trim() : "";
        if (!bar || !(label in MM)) { out.push({ at: `${st}@${s}`, label, bad: "no bar" }); continue; }
        const mm = mmPerShortAxis(STAGES.find((m) => m.meta.id === st).meta, fb.state().gaDay);
        const want = (MM[label] / mm) * Math.min(innerWidth, innerHeight), got = bar.getBoundingClientRect().width;
        out.push({ at: `${st}@${s}`, label, want: Math.round(want), got: Math.round(got), bad: Math.abs(want - got) > 1.5 ? "length" : null });
      }
      return out;
    });
    const bad = rows.filter((r) => r.bad).map((r) => `${r.at} "${r.label}" ${r.bad}: true ${r.want} px, drawn ${r.got} px`);
    check(`${w}x${h}: the scale bar's length matches its label (${rows.length} samples)`, bad.length === 0, list(bad));
    check(`${w}x${h}: no page errors (scale bar)`, errors.length === 0, list(errors));
    await ctx.close();
  }
}

// F29: tablets and other wide portrait screens: a caption never covers the subject's body, never sits below 60%, and
// never covers the HUD (the band moves under the HUD when no line fits under the body)
// F31: small portrait phones in stage 2: the caption never covers the HUD or the prompt line, and (but at 320 × 568
// with Large text, where the HUD ends 16 px above the egg's zone) stays above the egg's 28 u zone
if (runOther) {
  const capCheck = (page, stages, { eggZone = false } = {}) => page.evaluate(({ stages, eggZone }) => {
    const fb = window.__fb, bad = [], H = innerHeight;
    let n = 0;
    for (const st of stages) {
      fb.goto(st, { seed: 1 }); fb.bot(1);
      for (let i = 0; i < 300; i++) {
        const s = fb.step(15);
        if (s.screen !== "stage") break;
        const c = window.__lay.cap();
        if (!c) continue;
        n++;
        const at = `${st}@${s.t.toFixed(2)} "${c.text.slice(0, 24)}"`;
        const h = window.__lay.hud();
        for (const [k, b] of Object.entries(h)) if (b && window.__lay.overlap(c, b)) bad.push(`${at} covers the HUD ${k}`);
        if (c.b > 0.6 * H + 0.5) bad.push(`${at} below 60% (${Math.round(c.b)})`);
        const body = window.__lay.subjectBox ? window.__lay.subjectBox(s) : null;
        if (body && window.__lay.overlap(c, body)) bad.push(`${at} covers the body ${Math.round(body.y)}..${Math.round(body.b)}`);
        if (eggZone && st === "egg") {
          const g = fb.guard();
          if (g && c.b > g.egg.screen.y - 28 * (innerWidth / 140) + 0.5) bad.push(`${at} ends at ${Math.round(c.b)}, in the egg's zone`);
        }
      }
      fb.bot(false);
    }
    return { bad, n };
  }, { stages, eggZone });
  for (const [w, h] of [[768, 1024], [600, 960], [820, 1180]]) {
    const { ctx, page, errors } = await openAt(w, h, "?test=1&seed=1");
    const r = await capCheck(page, ["swim", "split", "root", "turn"]);
    check(`${w}x${h}: captions clear of the body, the HUD and the bottom 40% (${r.n} frames)`, r.bad.length === 0 && r.n > 0, list(r.bad));
    check(`${w}x${h}: no page errors (tablet)`, errors.length === 0, list(errors));
    await ctx.close();
  }
  for (const [w, h, large] of [[360, 640, false], [360, 640, true], [375, 553, true], [320, 568, true], [375, 667, true]]) {
    const { ctx, page, errors } = await openAt(w, h, "?test=1&seed=1", { large });
    const r = await capCheck(page, ["egg"], { eggZone: !(w === 320 && large) });
    check(`${w}x${h}${large ? " Large" : ""}: stage 2's captions clear of the HUD and the prompt${w === 320 && large ? "" : ", above the egg"} (${r.n} frames)`,
      r.bad.length === 0 && r.n > 0, list(r.bad));
    const b = await capCheck(page, ["split", "root", "turn"]);
    // with Large text on a small phone the HUD and the body can leave no free band (stage 4's end, stage 3 at
    // 375 × 553): a note, not a fault
    if (large) { if (b.bad.length) notes.push(`${w}x${h} Large: stages 3, 4 and 7: ${list(b.bad, 2)}`); }
    else check(`${w}x${h}: stages 3, 4 and 7: captions clear of the body, the HUD and the bottom 40%`, b.bad.length === 0, list(b.bad));
    check(`${w}x${h}: no page errors (small portrait)`, errors.length === 0, list(errors));
    await ctx.close();
  }
}

// F30: small landscape phones: a caption never covers the scale tag (or any HUD tag) at the bottom left
if (runOther) {
  for (const [w, h, large] of [[568, 320, false], [640, 360, false], [667, 375, false], [667, 375, true]]) {
    const { ctx, page, errors } = await openAt(w, h, "?test=1&seed=1", { large });
    const r = await page.evaluate(() => {
      const fb = window.__fb, bad = [];
      let n = 0;
      for (const st of ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"]) {
        fb.goto(st, { seed: 1 }); fb.bot(1);
        for (let i = 0; i < 300; i++) {
          const s = fb.step(15);
          if (s.screen !== "stage") break;
          const c = window.__lay.cap();
          if (!c) continue;
          n++;
          for (const [k, b] of Object.entries(window.__lay.hud())) if (b && window.__lay.overlap(c, b)) bad.push(`${st}@${s.t.toFixed(2)} "${c.text.slice(0, 24)}" covers the HUD ${k}`);
        }
        fb.bot(false);
      }
      return { bad, n };
    });
    check(`${w}x${h}${large ? " Large" : ""}: landscape captions clear of the scale tag and the HUD (${r.n} frames)`, r.bad.length === 0 && r.n > 0, list(r.bad));
    check(`${w}x${h}: no page errors (small landscape)`, errors.length === 0, list(errors));
    await ctx.close();
  }
}

// stage 3's gift bubbles (first-breath-action-genres, design.md 4.6 and 5.3): at a pick left alone (seed 1, after
// Day 1), at 390 × 844 with the safe-area inset, 844 × 390 and 1440 × 900, the three one-word tags show inside the
// safe area, whole (not cut), clear of each other, of the HUD's tags and of the prompt line
if (runOther) {
  for (const [w, h, touch, ins] of [[390, 844, true, true], [844, 390, true, false], [1440, 900, false, false]]) {
    const { ctx, page, errors } = await openAt(w, h, `?test=1&seed=1${ins ? "&" + INSET_Q : ""}`, { touch, inset: ins });
    const r = await page.evaluate((inset) => {
      const fb = window.__fb;
      fb.goto("split", { seed: 1 });
      const NAMES = new Set(["Quick", "Spread", "Bounce", "Sticky", "Shell", "Dash", "Orbit", "Chain", "Magnet"]);
      const tags = () => [...document.querySelectorAll("#pops .pop")].filter((e) => !e.hidden && NAMES.has(e.textContent.trim()) && Number(e.style.opacity || 1) > 0.9);
      for (let i = 0; i < 160 && tags().length < 3; i++) fb.step(10);
      const W = innerWidth, H = innerHeight, bad = [];
      const list = tags().map((e) => ({ text: e.textContent.trim(), r: e.getBoundingClientRect(), cut: e.scrollWidth > e.clientWidth + 1 }));
      if (list.length !== 3) return { bad: [`${list.length} gift tags`], n: list.length };
      const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const others = [...document.querySelectorAll("[data-hud]")].filter((e) => !e.hidden && e.getBoundingClientRect().width > 0 && e.textContent.trim()).map((e) => ({ k: e.dataset.hud, r: e.getBoundingClientRect() }));
      list.forEach((t, i) => {
        if (t.r.left < inset.l - 0.5 || t.r.right > W - inset.r + 0.5 || t.r.top < inset.t - 0.5 || t.r.bottom > H - inset.b + 0.5) bad.push(`"${t.text}" outside the safe area`);
        if (t.cut) bad.push(`"${t.text}" is cut`);
        for (let j = i + 1; j < list.length; j++) if (hit(t.r, list[j].r)) bad.push(`"${t.text}" over "${list[j].text}"`);
        for (const o of others) if (hit(t.r, o.r)) bad.push(`"${t.text}" under the HUD ${o.k}`);
      });
      return { bad, n: list.length };
    }, ins ? INSET : { t: 0, r: 0, b: 0, l: 0 });
    check(`${w}x${h}: stage 3's gift tags show whole inside the safe area, clear of the HUD and each other`, r.bad.length === 0 && r.n === 3, list(r.bad));
    check(`${w}x${h}: no page errors (stage 3 gifts)`, errors.length === 0, list(errors));
    await ctx.close();
  }
}

await browser.close();
if (server) server.kill();
for (const n of notes) console.log(`NOTE ${n}`);
if (failed.length) {
  console.log(`FAIL ${FILE}: ${failed.length} failed, ${passed} passed`);
  for (const f of failed) console.log("  - " + f);
  process.exit(1);
}
console.log(`PASS ${FILE}: ${passed} checks`);
