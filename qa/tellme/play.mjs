// Tell Me browser QA. Serves public/ itself and drives Chromium at 390×844 with touch.
//   node qa/tellme/play.mjs
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

function serve(dir) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
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

function faceFor(rank) {
  if (rank <= 5) return "smug";
  if (rank <= 9) return "calm";
  if (rank <= 12) return "nervous";
  return "sweating";
}

function auditHand(hand, stackBefore) {
  const { contrib, payouts, pot, winners, stack, read } = hand.result;
  const cin = contrib.player + contrib.bram + contrib.fennel;
  const cout = payouts.player + payouts.bram + payouts.fennel;
  if (cin !== pot || cout !== pot) return `pot ${pot} in ${cin} out ${cout}`;
  if (stackBefore - contrib.player + payouts.player !== stack) return `stack ${stack} from ${stackBefore}`;
  let sim = stackBefore;
  const paid = { player: 0, bram: 0, fennel: 0 };
  for (const seat of ["player", "bram", "fennel"]) {
    const ante = seat === "player" ? Math.min(2, sim) : 2;
    if (seat === "player") sim -= ante;
    paid[seat] += ante;
  }
  for (const a of hand.actions) {
    if (a.who === "player") {
      if (a.chips > sim) return `player paid ${a.chips} with ${sim} left`;
      sim -= a.chips;
    }
    paid[a.who] += a.chips;
  }
  for (const seat of ["player", "bram", "fennel"]) {
    if (paid[seat] !== contrib[seat]) return `${seat} contrib ${contrib[seat]} vs chips ${paid[seat]}`;
  }
  const folded = new Set(hand.actions.filter((a) => a.act === "fold").map((a) => a.who));
  const still = ["player", "bram", "fennel"].filter((s) => !folded.has(s));
  if (!still.length) return "empty showdown";
  const best = Math.max(...still.map((s) => hand.cards[s].rank));
  const expectW = ["player", "bram", "fennel"].filter((s) => still.includes(s) && hand.cards[s].rank === best);
  if (expectW.join() !== winners.join()) return `winners ${winners} expected ${expectW}`;
  const base = Math.floor(pot / expectW.length);
  let rem = pot - base * expectW.length;
  for (const w of expectW) {
    const share = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
    if (payouts[w] !== share) return `payout ${w} ${payouts[w]} expected ${share}`;
  }
  for (const seat of ["bram", "fennel"]) {
    if (!expectW.includes(seat) && payouts[seat] !== 0) return `${seat} paid without winning`;
  }
  const pCall = hand.actions.some((a) => a.who === "player" && a.act === "call");
  const pFold = hand.actions.some((a) => a.who === "player" && a.act === "fold");
  if (pCall || pFold) {
    if (!read) return "missing read";
    const opps = ["bram", "fennel"].filter((s) => !folded.has(s));
    const correct = pCall
      ? expectW.length === 1 && expectW[0] === "player"
      : hand.cards.player.rank < Math.max(...opps.map((s) => hand.cards[s].rank));
    if (read.correct !== correct) return `read ${read.correct} expected ${correct}`;
  } else if (read) return "read without a call or fold";
  return null;
}

function auditRun(test) {
  let stack = 100;
  let correct = 0;
  let total = 0;
  const problems = [];
  test.log.forEach((hand, i) => {
    const err = auditHand(hand, stack);
    if (err) problems.push(`hand ${i + 1}: ${err}`);
    stack = hand.result.stack;
    if (hand.result.read) {
      total++;
      if (hand.result.read.correct) correct++;
    }
  });
  if (stack !== test.score) problems.push(`score ${test.score} vs stack ${stack}`);
  if (test.hands !== test.log.length) problems.push(`hands ${test.hands} vs log ${test.log.length}`);
  if (test.reads.correct !== correct || test.reads.total !== total) problems.push("reads counters");
  if (stack < 0) problems.push("negative stack");
  return problems;
}

const PREF = [
  ["check", "call", "fold", "small", "big"],
  ["small", "call", "check", "fold", "big"],
  ["big", "call", "fold", "check", "small"],
  ["fold", "call", "check", "big", "small"],
  ["call", "fold", "check", "big", "small"],
  ["check", "fold", "call", "small", "big"],
  ["big", "fold", "call", "check"],
  ["small", "fold", "call", "check"],
  ["call", "check", "big", "fold"],
  ["fold", "big", "call", "check", "small"],
];
function scripted(hand, available) {
  for (const a of PREF[hand % 10]) if (available.includes(a)) return a;
  return available[0];
}
function bustPolicy(_hand, available) {
  for (const a of ["big", "call", "small", "check", "fold"]) if (available.includes(a)) return a;
  return available[0];
}
function calmPolicy(_hand, available) {
  for (const a of ["check", "call", "fold", "small", "big"]) if (available.includes(a)) return a;
  return available[0];
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
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push("console: " + m.text());
  });
  let bytes = 0;
  const files = [];
  page.on("response", (res) => {
    const len = Number(res.headers()["content-length"] || 0);
    bytes += len;
    files.push({ url: res.url().replace(/^https?:\/\/[^/]+/, ""), status: res.status(), len });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  return { page, errors, bytes: () => bytes, files, close: () => ctx.close() };
}

async function snapshot(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__test)));
}

async function drive(page, policy) {
  const seen = { open: false, face: false, narrow: false };
  for (;;) {
    const phase = await page.waitForFunction(() => {
      const p = document.documentElement.dataset.phase;
      return p === "act" || p === "end" ? p : null;
    }).then((h) => h.jsonValue());
    if (phase === "end") return { test: await snapshot(page), seen };
    const buttons = await page.locator("#actions button:not([hidden])").evaluateAll((els) =>
      els.map((e) => ({
        act: e.dataset.act,
        disabled: e.disabled,
        w: e.getBoundingClientRect().width,
        h: e.getBoundingClientRect().height,
      })));
    if (buttons.some((b) => b.act === "check")) seen.open = true;
    if (buttons.some((b) => b.act === "call")) seen.face = true;
    for (const b of buttons) {
      if (b.w < 48 || b.h < 48) seen.narrow = `${b.act} ${b.w.toFixed(1)}x${b.h.toFixed(1)}`;
    }
    const scroll = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.body.clientWidth,
    ));
    if (scroll > 1) seen.narrow = (seen.narrow ? seen.narrow + "; " : "") + "scroll " + scroll;
    const available = buttons.filter((b) => !b.disabled).map((b) => b.act);
    const hand = await page.evaluate(() => window.__test.hands);
    const choice = policy(hand, available);
    const serial = await page.evaluate(() => document.documentElement.dataset.serial || "0");
    await page.locator(`#actions button[data-act="${choice}"]`).tap();
    await page.waitForFunction((s) => document.documentElement.dataset.serial !== s, serial);
  }
}

async function begin(page) {
  await page.locator("#start-btn").tap();
  await page.waitForFunction(() => document.documentElement.dataset.phase !== "start");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name) {
  const file = path.join(SHOTS, name + ".png");
  await page.screenshot({ path: file, fullPage: false });
  const size = pngSize(file);
  return { file, ...size };
}

const server = await serve(PUBLIC);
const port = server.address().port;
const base = `http://127.0.0.1:${port}/tellme/`;
console.log("serving", base);

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });

try {
  // --- daily seed, before any tap ---
  {
    const day = new Date();
    const expect = day.getUTCFullYear() * 10000 + (day.getUTCMonth() + 1) * 100 + day.getUTCDate();
    const s = await open(browser, base);
    const label = await s.page.locator("#daily").innerText();
    const hook = await snapshot(s.page);
    check(label === `Daily #${expect}`, `daily label "${label}"`);
    check(hook.seed === expect && hook.score === 100 && hook.hands === 0 && hook.log.length === 0, "hook starts at 100 chips, daily seed, empty log");
    const startBox = await s.page.locator("#start-btn").boundingBox();
    const muteBox = await s.page.locator("#mute").boundingBox();
    check(startBox.height >= 48 && startBox.width >= 48, `start button ${startBox.width.toFixed(0)}x${startBox.height.toFixed(0)}`);
    check(muteBox.height >= 48 && muteBox.width >= 48, `mute button ${muteBox.width.toFixed(0)}x${muteBox.height.toFixed(0)}`);
    const words = await s.page.locator("body").innerText();
    check(!/purchase|cash-?out|withdraw|wager|\$\d|real money|buy chips/i.test(words), "no real-money wording on the start screen");
    const disk = ["index.html", "tellme.js", "style.css"].reduce((n, f) => n + fs.statSync(path.join(PUBLIC, "tellme", f)).size, 0);
    console.log(`  first-load transfer ${s.bytes()} bytes across ${s.files.length} responses; source files ${disk} bytes`);
    check(s.bytes() < 500 * 1024, `first load ${s.bytes()} bytes is under 500 KB`);
    globalThis.__bytes = s.bytes();
    globalThis.__files = s.files;
    globalThis.__disk = disk;
    for (const e of s.errors) check(false, e);
    await s.close();
  }

  // --- two fast runs, same seed, same taps ---
  async function full(url) {
    const s = await open(browser, url);
    const ident = await s.page.evaluate(() => {
      window.__keep = window.__test;
      return true;
    });
    check(ident, "hook installed");
    await begin(s.page);
    const out = await drive(s.page, scripted);
    const same = await s.page.evaluate(() => window.__test === window.__keep && window.__test.log === window.__keep.log);
    return { ...out, same, errors: s.errors, page: s.page, close: s.close };
  }

  console.log("\nseed 123 run A");
  const a = await full(base + "?seed=123&fast=1");
  console.log("\nseed 123 run B");
  const b = await full(base + "?seed=123&fast=1");
  const logA = JSON.stringify(a.test.log);
  const logB = JSON.stringify(b.test.log);
  check(logA === logB, `identical logs across two runs (${a.test.log.length} hands)`);
  check(a.test.seed === 123 && b.test.seed === 123, "seed is 123");
  check(a.test.score === b.test.score && a.test.hands === b.test.hands, `score ${a.test.score}, hands ${a.test.hands}`);
  check(JSON.stringify(a.test.reads) === JSON.stringify(b.test.reads), `reads ${a.test.reads.correct}/${a.test.reads.total}`);
  check(a.test.hands === 10 && a.test.log.length === 10, "full 10-hand run");
  check(a.same && b.same, "window.__test object stays live");
  check(a.seen.open && a.seen.face, "both Check/Small/Big and Call/Fold layouts appeared");
  check(!a.seen.narrow && !b.seen.narrow, "action buttons are at least 48px and the page does not scroll sideways");
  const problems = auditRun(a.test);
  check(problems.length === 0, problems.length ? problems.join("; ") : "chips conserved and reads match the cards");
  check(a.test.log.some((h) => h.cues.bram || h.cues.fennel), "at least one tail cue in the seeded run");
  const againBox = await a.page.locator("#again").boundingBox();
  check(againBox.height >= 48 && againBox.width >= 48, `play-again button ${againBox.width.toFixed(0)}x${againBox.height.toFixed(0)}`);
  const endText = await a.page.locator("#end").innerText();
  check(endText.includes(`${a.test.score} chips`), "end screen shows the final stack");
  check(endText.includes(`Reads ${a.test.reads.correct}/${a.test.reads.total}`), "end screen shows Reads x/y");
  check(/Sharp|Good|Rookie/.test(endText), "end screen shows a rating");
  check(endText.includes("Play again with same seed"), "end screen has play again with same seed");
  check(!/purchase|cash-?out|withdraw|wager|\$\d|real money/i.test(endText), "end screen has no real-money wording");

  const savedFirst = JSON.stringify(a.test.log[0]);
  await a.page.locator("#again").tap();
  await a.page.waitForFunction(() => window.__test.hands === 0 && window.__test.log.length === 0 && window.__test.seed === 123 && document.getElementById("end").hidden);
  const restarted = await a.page.evaluate(() => ({ score: window.__test.score, phase: document.documentElement.dataset.phase }));
  check(restarted.score <= 100 && restarted.phase !== "end", `play again resets the run (stack ${restarted.score}, ${restarted.phase}) and keeps the seed`);
  await driveUntil(a.page, scripted, () => window.__test.log.length >= 1);
  const replay = await snapshot(a.page);
  check(JSON.stringify(replay.log[0]) === savedFirst, "first hand after play again matches the original seed");
  for (const e of a.errors.concat(b.errors)) check(false, e);
  await a.close();
  await b.close();

  // --- honest faces ---
  console.log("\nhonest=1");
  const h = await open(browser, base + "?seed=123&honest=1&fast=1");
  await begin(h.page);
  const honest = await drive(h.page, scripted);
  let facesOk = true;
  let cuesOff = true;
  for (const hand of honest.test.log) {
    const want = faceFor(hand.cards.player.rank);
    if (hand.faces.bram !== want || hand.faces.fennel !== want) facesOk = false;
    if (hand.cues.bram || hand.cues.fennel) cuesOff = false;
  }
  check(facesOk, "honest=1 faces match the rank mapping on every hand");
  check(cuesOff, "honest=1 removes the tail cue");
  check(JSON.stringify(honest.test.log.map((x) => x.cards)) === JSON.stringify(a.test.log.map((x) => x.cards)), "honest mode deals the same cards");
  check(JSON.stringify(honest.test.log.map((x) => x.actions)) === JSON.stringify(a.test.log.map((x) => x.actions)), "honest mode keeps the same actions");
  for (const e of h.errors) check(false, e);
  await h.close();

  // --- short run ---
  console.log("\nhands=2");
  const short = await open(browser, base + "?seed=123&hands=2&fast=1");
  await begin(short.page);
  const two = await drive(short.page, scripted);
  check(two.test.hands === 2 && two.test.log.length === 2, "hands=2 stops after two hands");
  check(JSON.stringify(two.test.log) === JSON.stringify(a.test.log.slice(0, 2)), "hands=2 matches the start of the full run");
  for (const e of short.errors) check(false, e);
  await short.close();

  // --- bust ---
  console.log("\nbust seed 239");
  const bust = await open(browser, base + "?seed=239&fast=1");
  await begin(bust.page);
  const broke = await drive(bust.page, bustPolicy);
  const bustProblems = auditRun(broke.test);
  check(bustProblems.length === 0, bustProblems.length ? bustProblems.join("; ") : "bust run conserves chips");
  check(broke.test.score === 0 && broke.test.hands < 10 && broke.test.hands === broke.test.log.length, `bust ends early at ${broke.test.hands} hands with 0 chips`);
  const bustText = await bust.page.locator("#end").innerText();
  check(bustText.includes("0 chips") && bustText.includes("Out of chips"), "bust end screen shows 0 chips");
  for (const e of bust.errors) check(false, e);
  await bust.close();

  // --- real-time screenshots at 390x844 ---
  console.log("\nscreenshots");
  const shot = await open(browser, base + "?seed=1");
  const startShot = await shoot(shot.page, "tellme-start");
  await begin(shot.page);
  const got = { faces: new Set(), flick: false, flip: false, end: false };
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    const snap = await shot.page.evaluate(() => ({
      phase: document.documentElement.dataset.phase,
      flick: !!document.querySelector(".layer-tail.flick"),
      flip: document.getElementById("player-card").classList.contains("flipping"),
      faces: [...document.querySelectorAll(".critter")].map((c) => c.dataset.face || ""),
    }));
    if (snap.flick && !got.flick) {
      await sleep(100);
      await shoot(shot.page, "tellme-tail");
      got.flick = true;
    }
    if (snap.flip && !got.flip) {
      await sleep(430);
      await shoot(shot.page, "tellme-showdown");
      got.flip = true;
    }
    if (snap.phase === "act") {
      for (const f of snap.faces) {
        if (f && !got.faces.has(f)) {
          await shoot(shot.page, "tellme-face-" + f);
          got.faces.add(f);
        }
      }
      const available = await shot.page.locator("#actions button:not([hidden]):not([disabled])").evaluateAll((els) => els.map((e) => e.dataset.act));
      const choice = calmPolicy(0, available);
      const serial = await shot.page.evaluate(() => document.documentElement.dataset.serial || "0");
      await shot.page.locator(`#actions button[data-act="${choice}"]`).tap();
      await shot.page.waitForFunction((s) => document.documentElement.dataset.serial !== s, serial);
      continue;
    }
    if (snap.phase === "between") {
      await shot.page.locator("#middle").tap();
      continue;
    }
    if (snap.phase === "end") {
      await shoot(shot.page, "tellme-end");
      got.end = true;
      break;
    }
    await sleep(20);
  }
  const faceList = [...got.faces].sort().join(",");
  check(got.faces.size === 4, `four face states shot (${faceList})`);
  check(got.flick, "tail flick shot");
  check(got.flip, "showdown flip shot");
  check(got.end, "end screen shot");
  for (const name of ["tellme-start", "tellme-face-smug", "tellme-face-calm", "tellme-face-nervous", "tellme-face-sweating", "tellme-tail", "tellme-showdown", "tellme-end"]) {
    const file = path.join(SHOTS, name + ".png");
    if (!fs.existsSync(file)) {
      check(false, "missing " + name);
      continue;
    }
    const size = pngSize(file);
    check(size.w === 390 && size.h === 844, `${name}.png is ${size.w}x${size.h}`);
  }
  for (const e of shot.errors) check(false, e);
  const done = await snapshot(shot.page);
  check(done.hands === 10 && done.score === 86, `screenshot run finished ${done.hands} hands at ${done.score} chips`);
  await shot.close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\nqa/tellme: ${passes} passed, ${fails.length} failed`);
if (globalThis.__bytes != null) {
  console.log(`first-load ${globalThis.__bytes} bytes; html+css+js ${globalThis.__disk} bytes`);
}
if (fails.length) {
  for (const f of fails) console.log(" - " + f);
  process.exit(1);
}

async function driveUntil(page, policy, pred) {
  for (;;) {
    if (await page.evaluate(pred)) return;
    const phase = await page.waitForFunction(() => {
      const p = document.documentElement.dataset.phase;
      return p === "act" || p === "end" ? p : null;
    }).then((h) => h.jsonValue());
    if (phase === "end") return;
    const available = await page.locator("#actions button:not([hidden]):not([disabled])").evaluateAll((els) => els.map((e) => e.dataset.act));
    const hand = await page.evaluate(() => window.__test.hands);
    const serial = await page.evaluate(() => document.documentElement.dataset.serial || "0");
    await page.locator(`#actions button[data-act="${policy(hand, available)}"]`).tap();
    await page.waitForFunction((s) => document.documentElement.dataset.serial !== s, serial);
  }
}
