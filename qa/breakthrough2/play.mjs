// Breakthrough browser QA. Serves public/ and drives Chromium at 390x844.
//   node qa/breakthrough2/play.mjs
import { createRequire } from "module";
import { fileURLToPath } from "url";
import http from "http";
import fs from "fs";
import path from "path";
import { createRun, clampEffect, IDEAS, IDEA_CLAMP, lagAlpha, CARDS, SYNERGIES, EVENTS, YEARS, ENDINGS } from "../../public/breakthrough2/model.js";
import { scripted, randomPolicy, greedyClean } from "./policies.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "qa/browser/package.json"));
const { chromium } = require("playwright");

const SHOTS = process.env.SHOTS || "/opt/cursor/artifacts/screenshots";
const PUBLIC = path.join(root, "public");
fs.mkdirSync(SHOTS, { recursive: true });

const fails = [];
let passes = 0;
function check(ok, msg) {
  if (ok) passes += 1;
  else fails.push(msg);
  console.log((ok ? "  ok   " : "  FAIL ") + msg);
  return ok;
}

function serve(dir) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".woff2": "font/woff2",
    ".webp": "image/webp",
    ".json": "application/json",
    ".txt": "text/plain; charset=utf-8",
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith("/")) rel += "index.html";
      const file = path.normalize(path.join(dir, rel));
      if (!file.startsWith(dir + path.sep) && file !== dir) {
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

async function open(browser, url) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  const net404 = [];
  const off = [];
  let bytes = 0;
  const origin = new URL(url).origin;
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("console: " + msg.text());
  });
  page.on("request", (req) => {
    if (!req.url().startsWith(origin)) off.push(req.url());
  });
  page.on("response", (res) => {
    bytes += Number(res.headers()["content-length"] || 0);
    if (res.status() === 404) net404.push(res.url().replace(origin, ""));
  });
  await page.goto(url, { waitUntil: "networkidle" });
  return {
    page,
    errors,
    net404,
    off,
    bytes: () => bytes,
    close: () => ctx.close(),
  };
}

async function shoot(page, name) {
  const file = path.join(SHOTS, name + ".png");
  await page.screenshot({ path: file, fullPage: false });
  const size = pngSize(file);
  check(size.w === 390 && size.h === 844, `${name}.png is ${size.w}x${size.h}`);
  return file;
}

function quoteAttr(id) {
  return id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function tapChoice(page, id) {
  const loc = page.locator(`[data-choice="${quoteAttr(id)}"]`);
  await loc.scrollIntoViewIfNeeded();
  await loc.tap();
}

async function playClicks(page, decide) {
  const ids = [];
  let minTap = null;
  await page.locator("#start").tap();
  await page.waitForFunction(() => window.__test.state().ui === "play");
  for (;;) {
    const phase = await page.evaluate(() => window.__test.state().phase);
    if (phase === "end") break;
    await page.waitForFunction(() => !window.__test.state().busy);
    const offers = await page.evaluate(() => window.__test.offers());
    const id = decide(offers);
    const before = await page.evaluate(() => ({
      turn: window.__test.state().turn,
      phase: window.__test.state().phase,
    }));
    ids.push(id);
    if (!minTap) {
      minTap = await page.locator(`[data-choice="${quoteAttr(id)}"]`).evaluate((el) => {
        const box = el.getBoundingClientRect();
        return { w: box.width, h: box.height };
      });
    }
    await tapChoice(page, id);
    await page.waitForFunction((prev) => {
      const state = window.__test.state();
      return state.phase === "end" || state.turn !== prev.turn || state.phase !== prev.phase;
    }, before);
  }
  return {
    ids,
    minTap,
    log: await page.evaluate(() => window.__test.log()),
    state: await page.evaluate(() => window.__test.state()),
  };
}

async function playChoose(page, ids) {
  await page.evaluate(() => window.__test.start());
  for (const id of ids) {
    await page.waitForFunction(() => !window.__test.state().busy);
    const result = await page.evaluate((choice) => window.__test.choose(choice), id);
    if (!result.ok) return { ok: false, id, result };
  }
  await page.waitForFunction(() => window.__test.state().phase === "end");
  return { ok: true, log: await page.evaluate(() => window.__test.log()) };
}

function nodeReplay(seed, ids) {
  const run = createRun(seed);
  for (const id of ids) {
    const result = run.choose(id);
    if (!result.ok) return { ok: false, id, result };
  }
  return { ok: true, log: run.log(), ending: run.ending() };
}

function tally(policyFor) {
  const counts = Object.fromEntries(ENDINGS.map((ending) => [ending.id, 0]));
  for (let seed = 1; seed <= 50; seed += 1) {
    const run = createRun(seed);
    let guard = 0;
    while (run.state().phase !== "end") {
      const offers = run.offers();
      const id = policyFor(seed)(offers, run.state());
      const result = run.choose(id);
      if (!result.ok) run.choose("pass");
      guard += 1;
      if (guard > 80) break;
    }
    counts[run.ending()] += 1;
  }
  return counts;
}

const server = await serve(PUBLIC);
const port = server.address().port;
const base = `http://127.0.0.1:${port}/breakthrough2/`;
console.log("serving", base);
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });

try {
  check(lagAlpha(10) > lagAlpha(6), `10 year lag ${lagAlpha(10).toFixed(3)} beats 6 year lag ${lagAlpha(6).toFixed(3)}`);
  check(CARDS.length >= 20, `${CARDS.length} breakthroughs`);
  check(SYNERGIES.length >= 8, `${SYNERGIES.length} synergies`);
  check(EVENTS.length >= 12, `${EVENTS.length} events`);
  const raw = IDEAS.find((idea) => idea.id === "enzymes").effect.emissions;
  check(raw < IDEA_CLAMP.emissions[0], `enzymes raw emissions ${raw} sit outside the clamp`);
  check(clampEffect({ emissions: raw, ecology: 30, trust: 9, warming: 3 }).emissions === -6, "enzymes emissions clamp to -6");

  console.log("\ntitle and first load");
  const boot = await open(browser, base + "?seed=123&fast=1");
  const bootState = await boot.page.evaluate(() => window.__test.state());
  check(bootState.seed === 123 && bootState.phase === "title" && bootState.badSeed === false, "seed 123 is waiting on the title");
  check(await boot.page.locator("#seed-warn").isHidden(), "good seed has no fallback note");
  const startBox = await boot.page.locator("#start").boundingBox();
  const helpBox = await boot.page.locator("#help").boundingBox();
  check(startBox.height >= 44 && startBox.width >= 44, `start button ${Math.round(startBox.width)}x${Math.round(startBox.height)}`);
  check(helpBox.height >= 44 && helpBox.width >= 44, `help button ${Math.round(helpBox.width)}x${Math.round(helpBox.height)}`);
  const words = await boot.page.locator("body").innerText();
  check(!/[\u2014\u2013]/.test(words), "no em or en dashes in the title copy");
  check(!/purchase|cash-?out|withdraw|wager|\$\d|real money|buy now/i.test(words), "no real-money wording");
  check(boot.off.length === 0, `off-origin requests ${boot.off.length}`);
  check(boot.net404.length === 0, `404s on load ${boot.net404.length ? boot.net404.join(", ") : "none"}`);
  check(boot.errors.length === 0, boot.errors.length ? boot.errors.join("; ") : "no console errors on load");
  check(boot.bytes() < 500 * 1024, `first load ${boot.bytes()} bytes is under 500 KB`);
  console.log(`  first-load transfer ${boot.bytes()} bytes`);
  globalThis.__bytes = boot.bytes();
  await shoot(boot.page, "breakthrough2-title");
  await boot.page.locator("#howto-open").tap();
  await boot.page.waitForFunction(() => !document.getElementById("howto").hidden);
  const helpText = await boot.page.locator("#howto").innerText();
  check(/10 year step|6 years or 10/.test(helpText) && /Idea Lab/.test(helpText), "how to play explains lag and the lab");
  const closeBox = await boot.page.locator("#howto-close").boundingBox();
  check(closeBox.height >= 44, "how to play close button is at least 44px");
  await boot.page.locator("#howto-close").tap();
  await boot.close();

  console.log("\nbad seed");
  const bad = await open(browser, base + "?seed=abc");
  const warn = await bad.page.locator("#seed-warn").innerText();
  const badState = await bad.page.evaluate(() => window.__test.state());
  const warnBox = await bad.page.locator("#seed-warn").boundingBox();
  check(warn === "Bad seed, using random", `bad seed note "${warn}"`);
  check(!!warnBox && warnBox.height >= 12 && warnBox.width >= 48, "bad seed note is visible");
  check(typeof badState.seed === "number" && badState.badSeed === true && badState.seed !== 0, `clock seed ${badState.seed}`);
  check(bad.net404.length === 0 && bad.off.length === 0 && bad.errors.length === 0, "bad seed load is clean");
  await bad.close();

  console.log("\nseed 123 click run");
  const runA = await open(browser, base + "?seed=123&fast=1");
  const played = await playClicks(runA.page, scripted);
  check(played.log.length === 12, `full run logged ${played.log.length} turns`);
  check(played.log.map((entry) => entry.year).join() === YEARS.join(), "years are 2026 through 2100");
  check(played.log.slice(0, 9).every((entry) => entry.span === 6), "the first nine steps are 6 years");
  check(played.log[9].span === 10 && played.log[10].span === 10, "2080 and 2090 are 10 year steps");
  check(played.state.ending && ENDINGS.some((ending) => ending.id === played.state.ending), `ending ${played.state.ending}`);
  const endText = await runA.page.locator("#ending").innerText();
  check(endText.includes(`Seed ${played.state.seed}`) && endText.includes(played.state.endingName), "end screen shows the ending and the seed");
  check(!/[\u2014\u2013]/.test(endText), "end screen has no em or en dashes");
  check(played.minTap && played.minTap.w >= 44 && played.minTap.h >= 44, `first choice target ${played.minTap ? Math.round(played.minTap.w) + "x" + Math.round(played.minTap.h) : "missing"}`);
  await shoot(runA.page, "breakthrough2-ending");

  console.log("\nseed 123 click replay");
  const runB = await open(browser, base + "?seed=123&fast=1");
  const replayed = await playClicks(runB.page, scripted);
  check(JSON.stringify(played.log) === JSON.stringify(replayed.log), "two click runs with seed 123 share a log");

  console.log("\nchoose() replay");
  const viaHook = await playChoose(runB.page, played.ids);
  check(viaHook.ok && JSON.stringify(viaHook.log) === JSON.stringify(played.log), "choose(id) matches the click log");
  const nodeLog = nodeReplay(123, played.ids);
  check(nodeLog.ok && JSON.stringify(nodeLog.log) === JSON.stringify(played.log), "node replay matches the browser log");

  console.log("\nfast off");
  const slow = await open(browser, base + "?seed=123");
  const slowPlay = await playChoose(slow.page, played.ids);
  check(slowPlay.ok && JSON.stringify(slowPlay.log) === JSON.stringify(played.log), "fast off keeps the same log");
  check(slow.errors.length === 0, slow.errors.length ? slow.errors.join("; ") : "no console errors in the slow run");

  console.log("\nother seed");
  const other = await open(browser, base + "?seed=7&fast=1");
  const seventh = await playClicks(other.page, scripted);
  check(JSON.stringify(seventh.log) !== JSON.stringify(played.log), "seed 7 diverges from seed 123");
  check(other.net404.length === 0 && other.off.length === 0, "seed 7 made no 404s and no off-origin requests");
  for (const err of runA.errors.concat(runB.errors, other.errors)) check(false, err);

  console.log("\nidea lab");
  const lab = await open(browser, base + "?seed=123&fast=1");
  await lab.page.locator("#start").tap();
  await lab.page.waitForFunction(() => window.__test.state().ui === "play");
  let guard = 0;
  while ((await lab.page.evaluate(() => window.__test.state().phase)) === "event" && guard < 4) {
    const offers = await lab.page.evaluate(() => window.__test.offers());
    await tapChoice(lab.page, scripted(offers));
    guard += 1;
  }
  const labOffers = await lab.page.evaluate(() => window.__test.offers());
  const shownIdeas = labOffers.ideas || [];
  check(shownIdeas.length === 2, `idea lab offers ${shownIdeas.length}`);
  let effectsOk = true;
  for (const idea of shownIdeas) {
    for (const [key, value] of Object.entries(idea.effect)) {
      const range = IDEA_CLAMP[key];
      if (!range || value < range[0] || value > range[1]) effectsOk = false;
    }
  }
  check(effectsOk, "shown idea effects sit inside the clamp");
  const clamped = await lab.page.evaluate(() => window.__test.clampEffect({
    emissions: -40, ecology: 30, trust: 9, warming: 5,
  }));
  check(clamped.emissions === -6 && clamped.ecology === 6 && clamped.trust === 5 && clamped.warming === 0, "clampEffect trims an oversized idea");
  const affordable = shownIdeas.find((idea) => idea.affordable);
  check(!!affordable, "an opening idea is affordable");
  if (affordable) {
    const dimmed = shownIdeas.filter((idea) => !idea.affordable);
    if (dimmed.length) {
      const faded = await lab.page.locator(`[data-choice="${dimmed[0].id}"]`).evaluate((el) => getComputedStyle(el).opacity);
      check(Number(faded) < 0.7, "unaffordable ideas are dimmed");
    } else {
      check(true, "both opening ideas can be paid");
    }
    await lab.page.locator("#lab").scrollIntoViewIfNeeded();
    await shoot(lab.page, "breakthrough2-idea-lab");
    const beforeTurn = await lab.page.evaluate(() => window.__test.state().turn);
    await tapChoice(lab.page, affordable.id);
    await lab.page.waitForFunction((turn) => window.__test.state().turn !== turn, beforeTurn);
    const again = await lab.page.evaluate((id) => window.__test.choose(id), affordable.id);
    const labState = await lab.page.evaluate(() => window.__test.state().lab);
    check(again.ok === false && again.reason === "cooldown", `second idea use refused (${again.reason})`);
    check(labState.ready === false && labState.turnsLeft > 0, `lab closed for ${labState.turnsLeft} turns`);
    const log = await lab.page.evaluate(() => window.__test.log());
    const used = log.at(-1);
    check(used && used.pick.kind === "idea" && used.pick.id === affordable.id, "the idea was the turn's pick");
  }
  check(lab.errors.length === 0 && lab.net404.length === 0, "idea lab run stayed clean");
  await lab.close();

  console.log("\nmap states");
  const maps = await open(browser, base + "?seed=4&fast=1");
  await maps.page.locator("#start").tap();
  for (let i = 0; i < 4; i += 1) {
    const phase = await maps.page.evaluate(() => window.__test.state().phase);
    if (phase === "end") break;
    const offers = await maps.page.evaluate(() => window.__test.offers());
    const id = scripted(offers);
    await maps.page.evaluate((choice) => window.__test.choose(choice), id);
  }
  await maps.page.evaluate(() => window.__test.tweak({
    ecology: 82, emissions: 32, energy: 28, prosperity: 74, trust: 70, warming: 1.48,
  }));
  const healthyYear = await maps.page.locator("#yearchip").innerText();
  check(/20/.test(healthyYear), `healthy map is mid-century (${healthyYear})`);
  await shoot(maps.page, "breakthrough2-map-healthy");
  await maps.page.evaluate(() => window.__test.tweak({
    ecology: 22, emissions: 102, energy: 86, prosperity: 30, trust: 24, warming: 2.62,
  }));
  await shoot(maps.page, "breakthrough2-map-degraded");
  check(maps.errors.length === 0 && maps.net404.length === 0 && maps.off.length === 0, "map probe added no errors, 404s, or off-origin calls");
  await maps.close();

  console.log("\nseeds 1 to 50");
  const randomCounts = tally((seed) => randomPolicy(seed));
  const randomAgain = tally((seed) => randomPolicy(seed));
  const greedyCounts = tally(() => greedyClean);
  const order = ENDINGS.map((ending) => ending.id);
  const fmt = (counts) => order.map((id) => `${id} ${counts[id]}`).join("  ");
  console.log("  random ", fmt(randomCounts));
  console.log("  greedy ", fmt(greedyCounts));
  const randomSum = order.reduce((sum, id) => sum + randomCounts[id], 0);
  const greedySum = order.reduce((sum, id) => sum + greedyCounts[id], 0);
  check(randomSum === 50 && greedySum === 50, "50 seeded runs each finish");
  check(JSON.stringify(randomCounts) === JSON.stringify(randomAgain), "seed 1 to 50 random tally is stable");
  check(order.filter((id) => randomCounts[id] > 0).length >= 3, "random seeds 1 to 50 reach more than two endings");

  await runA.close();
  await runB.close();
  await slow.close();
  await other.close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\nqa/breakthrough2: ${passes} passed, ${fails.length} failed`);
if (globalThis.__bytes != null) console.log(`first-load ${globalThis.__bytes} bytes`);
if (fails.length) {
  for (const fail of fails) console.log(" - " + fail);
  process.exit(1);
}
