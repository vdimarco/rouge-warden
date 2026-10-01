// Breakthrough browser QA. Serves public/ and drives Chromium at 390x844.
//   node qa/breakthrough/play.mjs
// Uses the playwright package installed under qa/browser.
// Screenshots land in SHOTS (default /opt/cursor/artifacts/screenshots).
import { createRequire } from "module";
import { fileURLToPath } from "url";
import http from "http";
import fs from "fs";
import path from "path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "qa/browser/package.json"));
const { chromium } = require("playwright");

const SHOTS = process.env.SHOTS || "/opt/cursor/artifacts/screenshots";
const PUBLIC = path.join(root, "public");
fs.mkdirSync(SHOTS, { recursive: true });

const fails = [];
let passes = 0;
function check(ok, msg) {
  if (ok) passes++;
  else fails.push(msg);
  console.log((ok ? "  ok   " : "  FAIL ") + msg);
  return ok;
}

const YEARS = [2026, 2032, 2038, 2044, 2050, 2056, 2062, 2068, 2074, 2080, 2090, 2100];
const ENDINGS = [
  "The Age of Abundance",
  "The Regeneration Century",
  "The Managed Transition",
  "The Hot Growth Era",
  "The Fractured Century",
  "The Long Emergency",
];

function warmingFrom(emissions) {
  return +(1.35 + (emissions / 100) * 1.55).toFixed(2);
}
function endingFrom(s) {
  if (s.warming <= 1.65 && s.prosperity >= 60 && s.ecology >= 60) return "The Age of Abundance";
  if (s.warming <= 1.9 && s.ecology >= 65) return "The Regeneration Century";
  if (s.warming <= 2.0) return "The Managed Transition";
  if (s.prosperity >= 70) return "The Hot Growth Era";
  if (s.trust < 3 || s.political < 2) return "The Fractured Century";
  return "The Long Emergency";
}

function serve(dir) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith("/")) rel += "index.html";
      const file = path.normalize(path.join(dir, rel));
      if (!file.startsWith(dir + path.sep)) {
        res.writeHead(403);
        res.end("no");
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          const body = Buffer.from("not found");
          res.writeHead(404, { "content-type": "text/plain", "content-length": body.length });
          res.end(body);
          return;
        }
        res.writeHead(200, {
          "content-type": types[path.extname(file)] || "application/octet-stream",
          "content-length": data.length,
          "cache-control": "no-store",
        });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), bytes: buf.length };
}

function watch(page, origin) {
  const errors = [];
  const failed = [];
  const foreign = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  page.on("request", (req) => {
    let u;
    try { u = new URL(req.url()); } catch { foreign.push(req.url()); return; }
    if (u.protocol === "data:" || u.protocol === "blob:") return;
    if (u.origin !== origin) foreign.push(req.url());
  });
  page.on("requestfailed", (req) => {
    failed.push((req.failure()?.errorText || "failed") + " " + req.url());
  });
  page.on("response", (res) => {
    if (res.status() >= 400) failed.push(res.status() + " " + res.url());
  });
  return { errors, failed, foreign };
}

async function open(browser, url) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const origin = new URL(url).origin;
  const net = watch(page, origin);
  await page.goto(url, { waitUntil: "networkidle" });
  return { page, ...net, close: () => ctx.close() };
}

async function shoot(page, name) {
  const file = path.join(SHOTS, name + ".png");
  await page.screenshot({ path: file, fullPage: false });
  const size = pngSize(file);
  return { file, ...size };
}

async function firstAffordable(page) {
  return page.evaluate(() => {
    const offers = window.__test.offers();
    const turn = window.__test.state().turn;
    for (const id of offers) {
      window.__test.choose(id);
      const now = window.__test.state();
      if (now.turn !== turn || window.__test.ending()) return id;
    }
    return null;
  });
}

async function play(page) {
  const choices = [];
  for (let i = 0; i < 12; i++) {
    const before = await page.evaluate(() => window.__test.state());
    if (!before) return { error: "no state" };
    if (before.turn !== i) return { error: `turn ${before.turn} expected ${i}`, choices };
    if (before.year !== YEARS[i]) return { error: `year ${before.year} expected ${YEARS[i]}`, choices };
    const offers = await page.evaluate(() => window.__test.offers());
    if (!Array.isArray(offers) || offers.length !== 3) return { error: `offers ${JSON.stringify(offers)}`, choices };
    const picked = await firstAffordable(page);
    if (!picked) return { error: `no affordable tech on turn ${i}: ${offers.join(", ")}`, choices };
    choices.push(picked);
    const ended = await page.evaluate(() => window.__test.ending());
    if (ended) break;
  }
  const final = await page.evaluate(() => ({
    state: window.__test.state(),
    log: window.__test.log(),
    ending: window.__test.ending(),
    title: document.getElementById("endingTitle").textContent,
    endText: document.getElementById("endStats").innerText,
  }));
  return { choices, final };
}

async function replay(page, choices, seed) {
  await page.evaluate((seed) => {
    if (seed == null) window.__test.start();
    else window.__test.start(seed);
  }, seed);
  for (const id of choices) {
    const before = await page.evaluate(() => window.__test.state().turn);
    await page.evaluate((id) => window.__test.choose(id), id);
    const now = await page.evaluate(() => ({ turn: window.__test.state().turn, ending: window.__test.ending() }));
    if (now.turn === before && !now.ending) return { error: `replay stuck on ${id}` };
  }
  return page.evaluate(() => ({
    state: window.__test.state(),
    log: window.__test.log(),
    ending: window.__test.ending(),
  }));
}

function sameRun(a, b) {
  return JSON.stringify({ state: a.state, log: a.log }) === JSON.stringify({ state: b.state, log: b.log });
}

const server = await serve(PUBLIC);
const port = server.address().port;
const base = `http://127.0.0.1:${port}/breakthrough/`;
console.log("serving", base);

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const allErrors = [];
const allFailed = [];
const allForeign = [];
function collect(s) {
  allErrors.push(...s.errors);
  allFailed.push(...s.failed);
  allForeign.push(...s.foreign);
}

try {
  let choices = [];
  let final = null;
  let firstSnap = null;

  console.log("\nseed 123 fast");
  {
    const s = await open(browser, base + "?seed=123&fast=1");
    const titleShot = await shoot(s.page, "breakthrough-title");
    check(titleShot.w === 390 && titleShot.h === 844, `title shot ${titleShot.w}x${titleShot.h}`);

    const boot = await s.page.evaluate(async () => {
      await document.fonts.ready;
      const html = document.documentElement.outerHTML;
      return {
        hook: typeof window.__test?.state === "function"
          && typeof window.__test.log === "function"
          && typeof window.__test.offers === "function"
          && typeof window.__test.choose === "function"
          && typeof window.__test.start === "function"
          && typeof window.__test.ending === "function",
        frozen: Object.isFrozen(window.__test),
        state: window.__test.state(),
        ending: window.__test.ending(),
        fast: document.documentElement.classList.contains("fast"),
        noteHidden: document.getElementById("seedNote").classList.contains("hidden"),
        noteText: document.getElementById("seedNote").textContent,
        google: html.includes("fonts.googleapis.com") || html.includes("fonts.gstatic.com"),
      };
    });
    check(boot.hook, "window.__test is present before a run");
    check(boot.frozen, "__test is frozen");
    check(boot.state === null && boot.ending === null, "no run yet, ending is null");
    check(boot.fast, "fast=1 sets the fast class");
    check(boot.noteHidden && boot.noteText === "", "valid seed hides the bad-seed note");
    check(!boot.google, "page has no Google Fonts link");

    await s.page.evaluate(() => window.__test.start());
    const opened = await s.page.evaluate(async () => {
      await document.fonts.ready;
      const state = window.__test.state();
      const offers = window.__test.offers();
      const tampered = window.__test.state();
      tampered.owned.push("tamper");
      tampered.capital = -1;
      if (tampered.event) tampered.event.name = "tamper";
      const again = window.__test.state();
      const log = window.__test.log();
      if (log[0]) log[0].title = "tamper";
      const logAgain = window.__test.log();
      const offersCopy = window.__test.offers();
      offersCopy.push("tamper");
      return {
        seed: state.seed,
        turn: state.turn,
        year: state.year,
        ending: window.__test.ending(),
        offers,
        hud: document.getElementById("runSeed").textContent,
        hudVisible: document.getElementById("runSeed").getClientRects().length > 0,
        transition: getComputedStyle(document.querySelector(".card")).transitionDuration,
        copyOk: again.capital !== -1 && !again.owned.includes("tamper") && (!again.event || again.event.name !== "tamper"),
        logOk: !logAgain[0] || logAgain[0].title !== "tamper",
        offersOk: !window.__test.offers().includes("tamper") && window.__test.offers().join() === offers.join(),
        dm: document.fonts.check('400 16px "DM Sans"'),
        dm700: document.fonts.check('700 16px "DM Sans"'),
        fr600: document.fonts.check('600 16px Fraunces'),
        fr700: document.fonts.check('700 16px Fraunces'),
      };
    });
    check(opened.dm && opened.dm700 && opened.fr600 && opened.fr700, `bundled fonts loaded dm400=${opened.dm} dm700=${opened.dm700} fr600=${opened.fr600} fr700=${opened.fr700}`);
    check(opened.seed === 123 && opened.turn === 0 && opened.year === 2026, `opening seed ${opened.seed} turn ${opened.turn} year ${opened.year}`);
    check(opened.ending === null, "ending is null during play");
    check(opened.offers.length === 3, `three offers (${opened.offers.join(", ")})`);
    check(opened.hud === "Seed 123" && opened.hudVisible, `hud shows "${opened.hud}"`);
    check(opened.transition === "0s" || opened.transition.split(",").every((x) => x.trim() === "0s"), `fast card transition "${opened.transition}"`);
    check(opened.copyOk && opened.logOk && opened.offersOk, "state, log, and offers return copies");

    const gameShot = await shoot(s.page, "breakthrough-game");
    check(gameShot.w === 390 && gameShot.h === 844, `game shot ${gameShot.w}x${gameShot.h}`);

    const clickId = opened.offers[0];
    await s.page.locator(`.card[data-id="${clickId}"]`).click();
    const afterClick = await s.page.evaluate(() => ({
      state: window.__test.state(),
      log: window.__test.log(),
      turn: window.__test.state().turn,
    }));
    check(afterClick.turn === 1, `click advanced the turn (now ${afterClick.turn})`);
    await s.page.evaluate(() => window.__test.start());
    await s.page.evaluate((id) => window.__test.choose(id), clickId);
    const afterChoose = await s.page.evaluate(() => ({
      state: window.__test.state(),
      log: window.__test.log(),
    }));
    check(sameRun(afterClick, afterChoose), "click and __test.choose take the same path");
    firstSnap = afterChoose;

    await s.page.evaluate(() => window.__test.start());
    const run = await play(s.page);
    if (run.error) check(false, run.error);
    choices = run.choices || [];
    final = run.final;
    check(choices.length === 12, `played ${choices.length} turns`);
    if (final) {
      check(final.ending && ENDINGS.includes(final.ending), `ending "${final.ending}"`);
      check(final.title === final.ending, "end screen title matches __test.ending()");
      check(final.state.turn === 12 && final.state.year === 2100, `finished at turn ${final.state.turn} year ${final.state.year}`);
      check(final.state.seed === 123, "finished seed is 123");
      check(final.state.warming === warmingFrom(final.state.emissions), `warming ${final.state.warming} matches emissions ${final.state.emissions}`);
      check(final.ending === endingFrom(final.state), "ending matches the state thresholds");
      check(String(final.endText).includes("123"), "end screen shows the seed");
      check(Array.isArray(final.log) && final.log.every((e) => e.year && e.title && e.text), `log has ${final.log.length} entries`);
      const endShot = await shoot(s.page, "breakthrough-end");
      check(endShot.w === 390 && endShot.h === 844, `end shot ${endShot.w}x${endShot.h}`);
      console.log("  choices", choices.join(" "));
      console.log("  ending", final.ending, "warming", final.state.warming);
    }

    const again = await replay(s.page, choices, null);
    if (again.error) check(false, again.error);
    else check(final && sameRun(final, again) && again.ending === final.ending, "replay of seed 123 matches state and log");

    const modal = await s.page.evaluate(() => {
      window.__test.start(123);
      document.getElementById("timelineBtn").click();
      const m = document.getElementById("modal");
      const anim = getComputedStyle(m).animationName;
      const dur = getComputedStyle(m).animationDuration;
      return { open: m.open, anim, dur };
    });
    check(modal.open, "timeline modal opens");
    check(modal.anim === "none" && (modal.dur === "0s" || modal.dur === "0s, 0s"), `modal animation ${modal.anim} ${modal.dur}`);

    collect(s);
    await s.close();
  }

  console.log("\nseed 123 without fast");
  {
    const s = await open(browser, base + "?seed=123");
    const slow = await replay(s.page, choices, null);
    const dur = await s.page.evaluate(() => getComputedStyle(document.querySelector(".card") || document.body).transitionDuration);
    const fastClass = await s.page.evaluate(() => document.documentElement.classList.contains("fast"));
    check(!fastClass, "fast class stays off without ?fast=1");
    check(dur !== "0s", `card transition still present ("${dur}")`);
    if (slow.error) check(false, slow.error);
    else check(final && sameRun(final, slow) && slow.ending === final.ending, "same seed and choices match with fast off");
    collect(s);
    await s.close();
  }

  console.log("\ntwo seeds");
  {
    const s = await open(browser, base + "?fast=1");
    await s.page.evaluate(() => window.__test.start(1));
    const a = await play(s.page);
    await s.page.evaluate(() => window.__test.start(2));
    const b = await play(s.page);
    if (a.error) check(false, "seed 1 " + a.error);
    if (b.error) check(false, "seed 2 " + b.error);
    if (a.final && b.final) {
      check(!sameRun(a.final, b.final), "seed 1 and seed 2 diverge");
      check(a.final.state.seed === 1 && b.final.state.seed === 2, "explicit start seeds are kept");
    }
    collect(s);
    await s.close();
  }

  console.log("\nbad seed");
  {
    const s = await open(browser, base + "?seed=abc&fast=1");
    const note = await s.page.locator("#seedNote").innerText();
    const visible = await s.page.locator("#seedNote").isVisible();
    check(visible && note === "Bad seed, using random", `bad seed note "${note}" visible=${visible}`);
    const started = await s.page.evaluate(() => {
      const before = Date.now();
      window.__test.start();
      const seed = window.__test.state().seed;
      const after = Date.now();
      const mod = 2147483647;
      const lo = before % mod;
      const hi = after % mod;
      const inWindow = seed >= Math.min(lo, hi) && seed <= Math.max(lo, hi);
      return { seed, inWindow, integer: Number.isInteger(seed) };
    });
    check(started.integer && started.inWindow, `fallback clock seed ${started.seed}`);
    collect(s);
    await s.close();
  }

  console.log("\nseeds 1 to 50");
  {
    const s = await open(browser, base + "?fast=1");
    const rows = await s.page.evaluate(() => {
      const out = [];
      for (let seed = 1; seed <= 50; seed++) {
        window.__test.start(seed);
        for (let turn = 0; turn < 12; turn++) {
          const offers = window.__test.offers();
          const before = window.__test.state().turn;
          let moved = false;
          for (const id of offers) {
            window.__test.choose(id);
            if (window.__test.state().turn !== before || window.__test.ending()) { moved = true; break; }
          }
          if (!moved) return { error: `seed ${seed} stuck on turn ${turn}` };
          if (window.__test.ending()) break;
        }
        const state = window.__test.state();
        out.push({ seed, ending: window.__test.ending(), warming: state.warming, turn: state.turn });
      }
      return { rows: out };
    });
    if (rows.error) check(false, rows.error);
    const list = rows.rows || [];
    check(list.length === 50 && list.every((r) => r.ending && r.turn === 12), `distribution finished ${list.length} runs`);
    const counts = {};
    console.log("\nseed  ending                      warming");
    for (const row of list) {
      counts[row.ending] = (counts[row.ending] || 0) + 1;
      const name = row.ending.padEnd(28, " ");
      console.log(String(row.seed).padStart(4, " ") + "  " + name + row.warming.toFixed(2));
    }
    console.log("\ndistribution");
    for (const [name, n] of Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      console.log(`  ${String(n).padStart(2, " ")}  ${name}`);
    }
    if (list.length) {
      const warm = list.map((r) => r.warming);
      console.log(`warming min ${Math.min(...warm).toFixed(2)}  max ${Math.max(...warm).toFixed(2)}`);
    }
    collect(s);
    await s.close();
  }

  check(allErrors.length === 0, allErrors.length ? `console errors: ${allErrors.slice(0, 4).join(" | ")}` : "zero console errors");
  check(allFailed.length === 0, allFailed.length ? `failed requests: ${allFailed.slice(0, 4).join(" | ")}` : "zero failed network requests");
  check(allForeign.length === 0, allForeign.length ? `foreign hosts: ${allForeign.slice(0, 4).join(" | ")}` : "no request left the page origin");

  if (firstSnap) check(firstSnap.state.seed === 123, "click path stayed on seed 123");
} finally {
  await browser.close();
  server.close();
}

console.log(`\nqa/breakthrough: ${passes} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(" - " + f);
  process.exit(1);
}
