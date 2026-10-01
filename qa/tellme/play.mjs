// Tell Me browser QA. Serves public/ itself and drives Chromium at 390×844 with touch.
//   node qa/tellme/play.mjs
// Uses the playwright package installed under qa/browser.
// Screenshots land in SHOTS (default /opt/cursor/artifacts/screenshots).
import { createRequire } from "module";
import { fileURLToPath } from "url";
import http from "http";
import fs from "fs";
import path from "path";
import { LINES, createLinePicker } from "../../public/tellme/lines.js";

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

function showdown(hand) {
  const folded = new Set(hand.actions.filter((a) => a.act === "fold").map((a) => a.who));
  const still = ["player", "bram", "fennel"].filter((s) => !folded.has(s));
  if (!still.length) return { folded, still, winners: [] };
  const best = Math.max(...still.map((s) => hand.cards[s].rank));
  const winners = ["player", "bram", "fennel"].filter((s) => still.includes(s) && hand.cards[s].rank === best);
  return { folded, still, winners };
}

function expectedRead(hand) {
  const { still, winners } = showdown(hand);
  const pCall = hand.actions.some((a) => a.who === "player" && a.act === "call");
  const pFold = hand.actions.some((a) => a.who === "player" && a.act === "fold");
  if (!pCall && !pFold) return { read: null, tie: false, winners };
  const endedTie = winners.length > 1;
  const opps = ["bram", "fennel"].filter((s) => still.includes(s));
  const bestOpp = opps.length ? Math.max(...opps.map((s) => hand.cards[s].rank)) : null;
  const wouldTie = pFold && bestOpp !== null && hand.cards.player.rank === bestOpp;
  if (endedTie || wouldTie) return { read: null, tie: true, winners };
  if (pCall) return { read: { correct: winners.length === 1 && winners[0] === "player" }, tie: false, winners };
  return { read: { correct: bestOpp === null || hand.cards.player.rank < bestOpp }, tie: false, winners };
}

function cappedPot(contrib, stackBefore) {
  const allIn = contrib.player === stackBefore;
  const bram = allIn ? Math.min(contrib.bram, contrib.player) : contrib.bram;
  const fennel = allIn ? Math.min(contrib.fennel, contrib.player) : contrib.fennel;
  return { allIn, total: contrib.player + bram + fennel };
}

function expectedRating(correct, total) {
  if (total < 4) return "Too few reads";
  const pct = correct / total;
  if (pct >= 0.8) return "Sharp";
  if (pct >= 0.6) return "Good";
  return "Rookie";
}

function auditHand(hand, stackBefore) {
  const { contrib, payouts, pot, winners, stack, read } = hand.result;
  const capped = cappedPot(contrib, stackBefore);
  const cout = payouts.player + payouts.bram + payouts.fennel;
  if (pot !== capped.total || cout !== pot) return `pot ${pot} capped ${capped.total} out ${cout}`;
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
  const dealt = showdown(hand);
  if (!dealt.still.length) return "empty showdown";
  if (dealt.winners.join() !== winners.join()) return `winners ${winners} expected ${dealt.winners}`;
  const base = Math.floor(pot / dealt.winners.length);
  let rem = pot - base * dealt.winners.length;
  for (const w of dealt.winners) {
    const share = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
    if (payouts[w] !== share) return `payout ${w} ${payouts[w]} expected ${share}`;
  }
  for (const seat of ["bram", "fennel"]) {
    if (!dealt.winners.includes(seat) && payouts[seat] !== 0) return `${seat} paid without winning`;
  }
  const want = expectedRead(hand);
  if (want.read === null) {
    if (read) return want.tie ? "tie was counted as a read" : "read without a call or fold";
  } else {
    if (!read) return "missing read";
    if (read.correct !== want.read.correct) return `read ${read.correct} expected ${want.read.correct}`;
  }
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

function auditLines() {
  const situations = ["deal", "small", "big", "check", "call", "fold", "win", "lose", "idle", "start", "end"];
  const banned = /\b(aces?|kings?|queens?|jacks?|deuces?|bluffs?|bluffing|lying|liar|honest|honesty|nervous|smug|sweats?|sweating|tails?|flicks?|flicked|weak|strong|high card|low card|hole|faces?|tells?)\b|purchase|cash-?out|withdraw|wager|\$\d|real money|buy chips/i;
  const problems = [];
  for (const who of ["bram", "fennel"]) {
    const seen = new Set();
    for (const sit of situations) {
      const bank = LINES[who] && LINES[who][sit];
      if (!bank || bank.length < 12) problems.push(`${who} ${sit} has ${bank ? bank.length : 0} lines`);
      for (const line of bank || []) {
        const n = line.trim().split(/\s+/).filter(Boolean).length;
        if (n < 1 || n > 8) problems.push(`${who} ${sit} "${line}" is ${n} words`);
        if (banned.test(line)) problems.push(`${who} line may leak: ${line}`);
        if (seen.has(line)) problems.push(`duplicate ${who} line: ${line}`);
        seen.add(line);
      }
    }
  }
  return problems;
}

function repeats(rows) {
  const last = {};
  const bad = [];
  for (const row of rows) {
    if (last[row.who] === row.text) bad.push(`${row.who} repeated "${row.text}"`);
    last[row.who] = row.text;
  }
  return bad;
}

const ACTION_SITS = ["check", "small", "big", "call", "fold"];

function linesForCard(seed, playerRank) {
  const pick = createLinePicker(seed);
  const out = [];
  const ctx = {
    playerRank,
    pot: 18,
    cards: {
      player: { rank: playerRank, suit: 1 },
      bram: { rank: 11, suit: 0 },
      fennel: { rank: 4, suit: 2 },
    },
    strength: playerRank,
    face: playerRank >= 13 ? "sweating" : "smug",
  };
  for (const who of ["bram", "fennel"]) {
    for (const action of ACTION_SITS) {
      out.push(pick(who, action, ctx));
      out.push(pick(who, action, ctx));
    }
  }
  return out;
}

function nthActionLines(rows) {
  const n = { bram: {}, fennel: {} };
  const map = new Map();
  for (const row of rows) {
    if (!ACTION_SITS.includes(row.situation)) continue;
    const i = n[row.who][row.situation] || 0;
    n[row.who][row.situation] = i + 1;
    map.set(`${row.who}:${row.situation}:${i}`, row.text);
  }
  return map;
}

async function open(browser, url, opts = {}) {
  const viewport = opts.width && opts.height
    ? { width: opts.width, height: opts.height }
    : (opts.viewport || { width: 390, height: 844 });
  const ctx = await browser.newContext({
    viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  if (opts.chat === false) {
    await page.addInitScript(() => localStorage.setItem("tellme-chat", "0"));
  }
  await page.addInitScript(() => {
    window.__bubbleHits = [];
    const overlap = (a, b) => a.width > 2 && b.width > 2 && a.height > 2 && b.height > 2
      && a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const scan = () => {
      for (const b of document.querySelectorAll(".bubble")) {
        if (b.hidden) continue;
        const br = b.getBoundingClientRect();
        const sprite = b.closest(".critter") && b.closest(".critter").querySelector(".sprite");
        if (sprite) {
          const s = sprite.getBoundingClientRect();
          const face = { left: s.left, top: s.top, right: s.right, bottom: s.top + s.height * 0.62, width: s.width, height: s.height * 0.62 };
          if (overlap(br, face)) window.__bubbleHits.push("face " + b.textContent);
        }
        for (const btn of document.querySelectorAll("#actions button, #again, #start-btn, #mute, #chat")) {
          if (btn.hidden) continue;
          const ar = btn.getBoundingClientRect();
          if (overlap(br, ar)) window.__bubbleHits.push((btn.dataset.act || btn.id) + " :: " + b.textContent);
        }
      }
      const end = document.getElementById("end-line");
      const again = document.getElementById("again");
      if (end && again && !end.hidden && !again.hidden) {
        if (overlap(end.getBoundingClientRect(), again.getBoundingClientRect())) window.__bubbleHits.push("end-line overlaps again");
      }
    };
    const boot = () => {
      if (!document.documentElement) {
        setTimeout(boot, 0);
        return;
      }
      window.__bubbleWatch = true;
      new MutationObserver(scan).observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["hidden", "class"],
      });
    };
    boot();
  });
  page.setDefaultTimeout(20000);
  const errors = [];
  const console404 = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(text)) errors.push("console: " + text);
    if (/Failed to load resource|status of 404/.test(text)) console404.push(text);
  });
  let bytes = 0;
  const files = [];
  const net404 = [];
  page.on("response", (res) => {
    const len = Number(res.headers()["content-length"] || 0);
    bytes += len;
    const path = res.url().replace(/^https?:\/\/[^/]+/, "");
    files.push({ url: path, status: res.status(), len });
    if (res.status() === 404) net404.push(path);
  });
  await page.goto(url, { waitUntil: "networkidle" });
  return { page, errors, console404, net404, bytes: () => bytes, files, close: () => ctx.close() };
}

async function snapshot(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__test)));
}

async function drive(page, policy, onAct) {
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
        text: e.innerText.replace(/\s+/g, " ").trim(),
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
    if (onAct) await onAct(buttons);
    const lag = await page.evaluate(() => Number(document.documentElement.dataset.lag || 0));
    if (lag > 0) {
      seen.lags = (seen.lags || 0) + 1;
      seen.maxLag = Math.max(seen.maxLag || 0, lag);
    }
    const available = buttons.filter((b) => !b.disabled).map((b) => b.act);
    const hand = await page.evaluate(() => window.__test.hands);
    const choice = await policy(hand, available);
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
  const lineProblems = auditLines();
  check(lineProblems.length === 0, lineProblems.length ? lineProblems.slice(0, 6).join("; ") : "dialogue banks are flavor, unique, and at most 8 words");
  const lowCardLines = linesForCard(123, 2);
  const highCardLines = linesForCard(123, 14);
  const cardDrift = lowCardLines.filter((text, i) => text !== highCardLines[i]);
  check(lowCardLines.length === highCardLines.length && cardDrift.length === 0, cardDrift.length ? `action line changed with the player card: "${cardDrift[0]}"` : "same dialogue seed and action, different player card, same line");

  // --- daily seed, before any tap ---
  {
    const day = new Date();
    const expect = day.getUTCFullYear() * 10000 + (day.getUTCMonth() + 1) * 100 + day.getUTCDate();
    const s = await open(browser, base);
    const label = await s.page.locator("#daily").innerText();
    const hook = await snapshot(s.page);
    check(label === `Daily UTC #${expect}`, `daily label "${label}"`);
    check(hook.seed === expect && hook.score === 100 && hook.hands === 0 && hook.log.length === 0, "hook starts at 100 chips, daily seed, empty log");
    const startBox = await s.page.locator("#start-btn").boundingBox();
    const muteBox = await s.page.locator("#mute").boundingBox();
    check(startBox.height >= 48 && startBox.width >= 48, `start button ${startBox.width.toFixed(0)}x${startBox.height.toFixed(0)}`);
    check(muteBox.height >= 48 && muteBox.width >= 48, `mute button ${muteBox.width.toFixed(0)}x${muteBox.height.toFixed(0)}`);
    const words = await s.page.locator("body").innerText();
    check(!/purchase|cash-?out|withdraw|wager|\$\d|real money|buy chips/i.test(words), "no real-money wording on the start screen");
    const disk = fs.readdirSync(path.join(PUBLIC, "tellme"))
      .filter((f) => /\.(html|css|js)$/.test(f))
      .reduce((n, f) => n + fs.statSync(path.join(PUBLIC, "tellme", f)).size, 0);
    console.log(`  first-load transfer ${s.bytes()} bytes across ${s.files.length} responses; source files ${disk} bytes`);
    check(s.bytes() < 150 * 1024, `first load ${s.bytes()} bytes is under 150 KB`);
    check(s.bytes() < 500 * 1024, `first load ${s.bytes()} bytes is under 500 KB`);
    globalThis.__bytes = s.bytes();
    globalThis.__files = s.files;
    globalThis.__disk = disk;
    for (const e of s.errors) check(false, e);
    await s.close();
  }

  // --- two fast runs, same seed, same taps ---
  async function full(url, opts) {
    const s = await open(browser, url, opts);
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
  const linesA = await a.page.evaluate(() => window.__lineLog.map((row) => ({ who: row.who, situation: row.situation, text: row.text })));
  const lineRepeats = repeats(linesA);
  check(lineRepeats.length === 0, lineRepeats.length ? lineRepeats.slice(0, 4).join("; ") : "line selection never repeats back-to-back");
  check(linesA.length > 20 && linesA.some((row) => row.who === "bram") && linesA.some((row) => row.who === "fennel"), `dialogue spoke ${linesA.length} lines`);
  const hitsA = await a.page.evaluate(() => ({ hits: window.__bubbleHits || [], watch: window.__bubbleWatch === true }));
  check(hitsA.watch, "bubble overlap watcher is attached");
  check(hitsA.hits.length === 0, hitsA.hits.length ? `bubble overlap: ${hitsA.hits.slice(0, 3).join(" | ")}` : "bubbles never overlap faces or buttons");
  check((a.seen.lags || 0) > 0 && (a.seen.maxLag || 999) < 100, `button feedback ${a.seen.maxLag}ms`);

  console.log("\nseed 123 chat off");
  const quiet = await full(base + "?seed=123&fast=1", { chat: false });
  check(JSON.stringify(quiet.test.log) === logA, "chat off keeps the same window.__test.log");
  check(quiet.test.score === a.test.score && quiet.test.hands === a.test.hands, "chat off keeps the same score and hands");
  const quietLabel = await quiet.page.locator("#chat").innerText();
  check(quietLabel === "Chat off", `chat toggle starts off ("${quietLabel}")`);
  const quietBubbles = await quiet.page.evaluate(() => ({
    hits: window.__bubbleHits || [],
    shown: [...document.querySelectorAll(".bubble, #end-line")].filter((el) => !el.hidden).length,
    lines: window.__lineLog.length,
  }));
  check(quietBubbles.hits.length === 0 && quietBubbles.shown === 0, "chat off shows no bubbles");
  check(quietBubbles.lines === linesA.length, `chat off still picks ${quietBubbles.lines} lines without changing the draw`);
  for (const e of quiet.errors) check(false, e);
  await quiet.close();
  const againBox = await a.page.locator("#again").boundingBox();
  check(againBox.height >= 48 && againBox.width >= 48, `play-again button ${againBox.width.toFixed(0)}x${againBox.height.toFixed(0)}`);
  const endText = await a.page.locator("#end").innerText();
  check(endText.includes(`${a.test.score} chips`), "end screen shows the final stack");
  check(endText.includes(`Reads ${a.test.reads.correct}/${a.test.reads.total}`), "end screen shows Reads x/y");
  check(/Sharp|Good|Rookie|Too few reads/.test(endText), "end screen shows a rating");
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

  console.log("\nplayer card vs action lines");
  async function playedLines(rank) {
    const s = await open(browser, base + "?seed=123&fast=1&hands=4");
    await s.page.evaluate((r) => { window.__playerRankOverride = r; }, rank);
    await begin(s.page);
    const run = await drive(s.page, scripted);
    const rows = await s.page.evaluate(() => window.__lineLog.map((row) => ({
      who: row.who,
      situation: row.situation,
      text: row.text,
      revealed: row.revealed === true,
    })));
    for (const e of s.errors) check(false, e);
    await s.close();
    return { rows, log: run.test.log };
  }
  const playedLow = await playedLines(2);
  const playedHigh = await playedLines(14);
  const early = [...playedLow.rows, ...playedHigh.rows].filter((row) => (row.situation === "win" || row.situation === "lose") && !row.revealed);
  check(early.length === 0, early.length ? "win or lose line before the reveal" : "win and lose lines appear only after the card is revealed");
  const before = [...playedLow.rows, ...playedHigh.rows].filter((row) => ACTION_SITS.includes(row.situation) && row.revealed);
  check(before.length === 0, before.length ? "action line after the reveal" : "action lines stay before showdown");
  const mapLow = nthActionLines(playedLow.rows);
  const mapHigh = nthActionLines(playedHigh.rows);
  const drifted = [];
  let shared = 0;
  for (const [key, text] of mapLow) {
    if (!mapHigh.has(key)) continue;
    shared++;
    if (mapHigh.get(key) !== text) drifted.push(`${key} "${text}" vs "${mapHigh.get(key)}"`);
  }
  check(shared > 0, `compared ${shared} live action lines across player ranks 2 and 14`);
  check(drifted.length === 0, drifted.length ? drifted.slice(0, 3).join("; ") : "live action lines ignore the player card");
  const sameCritters = playedLow.log.length === playedHigh.log.length && playedLow.log.every((hand, i) => {
    const other = playedHigh.log[i];
    return hand.cards.bram.rank === other.cards.bram.rank
      && hand.cards.bram.suit === other.cards.bram.suit
      && hand.cards.fennel.rank === other.cards.fennel.rank
      && hand.cards.fennel.suit === other.cards.fennel.suit
      && hand.cards.player.rank === 2
      && other.cards.player.rank === 14;
  });
  check(sameCritters, "rank override keeps the critter cards and changes only the player's rank");
  function replayMismatch(rows) {
    const pick = createLinePicker(123);
    return rows.filter((row) => pick(row.who, row.situation) !== row.text).length;
  }
  check(replayMismatch(playedLow.rows) === 0 && replayMismatch(playedHigh.rows) === 0, "live lines match the separate dialogue picker");

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

  function asset404s(session) {
    return session.net404.filter((u) => u.includes("/tellme/assets/"));
  }
  function utcToday() {
    const day = new Date();
    return day.getUTCFullYear() * 10000 + (day.getUTCMonth() + 1) * 100 + day.getUTCDate();
  }

  // --- rule 1: rating tiers ---
  console.log("\nrule 1 rating");
  {
    const few = await open(browser, base + "?seed=123&hands=1&fast=1");
    await begin(few.page);
    const one = await drive(few.page, scripted);
    const rate = await few.page.locator("#end-rate").innerText();
    const readsLine = await few.page.locator("#end-reads").innerText();
    const want = expectedRating(one.test.reads.correct, one.test.reads.total);
    check(one.test.reads.total < 4, `one-hand run has ${one.test.reads.total} reads`);
    check(want === "Too few reads" && rate === "Too few reads", `end rating "${rate}" for ${one.test.reads.correct}/${one.test.reads.total}`);
    check(readsLine === `Reads ${one.test.reads.correct}/${one.test.reads.total}`, `end screen reads line "${readsLine}"`);
    check(!/\d+%/.test(await few.page.locator("#end").innerText()), "too-few end screen has no percent");
    const fewShot = await shoot(few.page, "tellme-too-few-reads");
    check(fewShot.w === 390 && fewShot.h === 844, `tellme-too-few-reads.png is ${fewShot.w}x${fewShot.h}`);
    for (const e of few.errors) check(false, e);
    await few.close();

    const seen = new Map([["Too few reads", `hands=1 ${one.test.reads.correct}/${one.test.reads.total}`]]);
    const samples = [
      ["123", scripted],
      ["239", bustPolicy],
      ["1", calmPolicy],
      ["7", scripted],
      ["11", bustPolicy],
      ["42", calmPolicy],
    ];
    for (const [seed, policy] of samples) {
      const s = await open(browser, base + `?seed=${seed}&honest=1&fast=1`);
      await begin(s.page);
      const out = await drive(s.page, policy);
      const got = await s.page.locator("#end-rate").innerText();
      const { correct, total } = out.test.reads;
      const expectRate = expectedRating(correct, total);
      check(got === expectRate, `seed ${seed} rating "${got}" for ${correct}/${total} (${expectRate})`);
      if (!seen.has(expectRate)) seen.set(expectRate, `${seed} ${correct}/${total}`);
      for (const e of s.errors) check(false, e);
      await s.close();
    }
    const facePage = await open(browser, base + "?seed=1&honest=1&fast=1");
    await begin(facePage.page);
    const faced = await drive(facePage.page, async (_hand, available) => {
      const info = await facePage.page.evaluate(() => {
        const faces = {};
        const ranks = {};
        const rankOf = { J: 11, Q: 12, K: 13, A: 14 };
        for (const c of document.querySelectorAll(".critter")) {
          faces[c.dataset.who] = c.dataset.face || "";
          const text = c.querySelector(".ccard .rank")?.textContent || "";
          ranks[c.dataset.who] = rankOf[text] || Number(text) || 0;
        }
        return { faces, ranks };
      });
      const buckets = { smug: [2, 5], calm: [6, 9], nervous: [10, 12], sweating: [13, 14] };
      const bucket = buckets[info.faces.bram] || buckets[info.faces.fennel] || [2, 14];
      const hiOpp = Math.max(info.ranks.bram || 0, info.ranks.fennel || 0);
      const sureWin = bucket[0] > hiOpp;
      const sureLose = bucket[1] < hiOpp;
      if (available.includes("call") || available.includes("fold")) {
        if (sureLose && available.includes("fold")) return "fold";
        if (available.includes("call")) return "call";
      }
      if (sureWin && available.includes("big")) return "big";
      if (sureLose && available.includes("check")) return "check";
      if (bucket[0] >= 10 && available.includes("big")) return "big";
      if (available.includes("check")) return "check";
      return available[0];
    });
    {
      const got = await facePage.page.locator("#end-rate").innerText();
      const { correct, total } = faced.test.reads;
      const expectRate = expectedRating(correct, total);
      check(got === expectRate, `face-reading rating "${got}" for ${correct}/${total} (${expectRate})`);
      if (!seen.has(expectRate)) seen.set(expectRate, `face ${correct}/${total}`);
    }
    for (const e of facePage.errors) check(false, e);
    await facePage.close();
    for (const band of ["Too few reads", "Sharp", "Good", "Rookie"]) {
      check(seen.has(band), seen.has(band) ? `${band} seen at ${seen.get(band)}` : `${band} was not produced by a played run`);
    }
    const fullRate = expectedRating(a.test.reads.correct, a.test.reads.total);
    check(a.test.reads.total >= 4 && fullRate !== "Too few reads", `seed 123 has ${a.test.reads.correct}/${a.test.reads.total}, rated ${fullRate}`);
  }

  // --- rule 2: daily label ---
  console.log("\nrule 2 daily label");
  {
    const expect = utcToday();
    const s = await open(browser, base);
    const daily = await s.page.locator("#daily").innerText();
    const start = await s.page.locator("#start-daily").innerText();
    const hook = await snapshot(s.page);
    check(daily === `Daily UTC #${expect}` && start === `Daily UTC #${expect}`, `daily labels "${daily}" / "${start}"`);
    check(hook.seed === expect, `hook seed ${hook.seed}`);
    check(await s.page.locator("#seed-warn").isHidden(), "good daily load has no bad-seed notice");
    const shot = await shoot(s.page, "tellme-daily-utc");
    check(shot.w === 390 && shot.h === 844, `tellme-daily-utc.png is ${shot.w}x${shot.h}`);
    for (const e of s.errors) check(false, e);
    await s.close();
  }

  // --- rule 3: short stack ---
  console.log("\nrule 3 short stack");
  {
    const s = await open(browser, base + "?seed=239&fast=1");
    await begin(s.page);
    let allInLabel = "";
    const out = await drive(s.page, async (_hand, available) => {
      if (available.includes("call")) return "call";
      if (available.includes("check")) return "check";
      if (available.includes("small")) return "small";
      if (available.includes("big")) return "big";
      return available[0];
    }, async (buttons) => {
      const call = buttons.find((b) => b.act === "call");
      if (!allInLabel && call && /^Call ([1-9]|1[01]) \(all-in\)$/.test(call.text)) {
        allInLabel = call.text;
        const shot = await shoot(s.page, "tellme-allin-call");
        check(shot.w === 390 && shot.h === 844, `tellme-allin-call.png is ${shot.w}x${shot.h}`);
      }
    });
    check(!!allInLabel, `all-in call label "${allInLabel}"`);
    let stackBefore = 100;
    let sawShort = false;
    const problems = auditRun(out.test);
    check(problems.length === 0, problems.length ? problems.join("; ") : "short-stack run conserves capped chips");
    for (const hand of out.test.log) {
      const ante = Math.min(2, stackBefore);
      const acted = hand.actions.filter((a) => a.who === "player").reduce((n, a) => n + a.chips, 0);
      if (hand.result.contrib.player !== ante + acted) {
        check(false, `ante ${ante} plus bets ${acted} !== contrib ${hand.result.contrib.player}`);
      }
      const capped = cappedPot(hand.result.contrib, stackBefore);
      if (capped.allIn && capped.total < hand.result.contrib.player + hand.result.contrib.bram + hand.result.contrib.fennel) {
        sawShort = true;
        const call = hand.actions.find((a) => a.who === "player" && a.act === "call");
        if (call && allInLabel) {
          const shown = Number(allInLabel.match(/Call (\d+)/)[1]);
          if (call.chips === shown) check(shown < 12 && call.chips === shown, `call paid ${call.chips}, button "${allInLabel}"`);
        }
      }
      stackBefore = hand.result.stack;
    }
    check(sawShort, "an all-in hand drops critter chips above the player's total");
    for (const e of s.errors) check(false, e);
    await s.close();
  }

  // --- rule 4: ties are neutral ---
  console.log("\nrule 4 ties");
  {
    let callTie = null;
    let foldTie = null;
    let splitTie = null;
    for (const seed of [123, 1, 7, 8, 9, 15, 21, 28, 33, 40, 4, 6, 18]) {
      const s = await open(browser, base + `?seed=${seed}&fast=1`);
      await begin(s.page);
      const out = await drive(s.page, scripted);
      let badTie = false;
      for (const hand of out.test.log) {
        const want = expectedRead(hand);
        if (!want.tie) continue;
        if (hand.result.read) badTie = true;
        const acted = hand.actions.find((a) => a.who === "player" && (a.act === "call" || a.act === "fold"));
        if (acted && acted.act === "call" && !callTie) callTie = seed;
        if (acted && acted.act === "fold" && !foldTie) foldTie = seed;
        if (hand.result.winners.length > 1) {
          const paid = hand.result.winners.every((w) => hand.result.payouts[w] > 0);
          if (!paid) check(false, `seed ${seed} tie pot did not split`);
          else if (!splitTie) splitTie = seed;
        }
      }
      check(!badTie, `seed ${seed} leaves tie hands out of reads`);
      for (const e of s.errors) check(false, e);
      await s.close();
      if (callTie && foldTie && splitTie) break;
    }
    check(!!callTie, callTie ? `called tie on seed ${callTie} is not a read` : "no called tie in the scanned seeds");
    check(!!foldTie, foldTie ? `folded tie on seed ${foldTie} is not a read` : "no folded tie in the scanned seeds");
    check(!!splitTie, splitTie ? `tie on seed ${splitTie} still splits the pot` : "no split pot in the scanned seeds");
  }

  // --- rule 5: minors ---
  console.log("\nrule 5 minors");
  {
    const load = await open(browser, base + "?seed=5&fast=1");
    const before = asset404s(load).length;
    const consoleBefore = load.console404.length;
    console.log(`  asset 404s on load: ${before} (${asset404s(load).join(", ") || "none"})`);
    console.log(`  console 404 lines on load: ${consoleBefore}`);
    await begin(load.page);
    await driveUntil(load.page, calmPolicy, () => window.__test.hands >= 2 && document.documentElement.dataset.phase === "act");
    await sleep(50);
    const after = asset404s(load).length;
    const consoleAfter = load.console404.length;
    console.log(`  asset 404s after two deals: ${after}`);
    console.log(`  console 404 lines after two deals: ${consoleAfter}`);
    check(before <= 1, `probe-once asset 404 count per load is ${before}`);
    check(after === before && consoleAfter === consoleBefore, `no repeated asset 404s across deals (${before} then ${after})`);
    for (const e of load.errors) check(false, e);
    await load.close();

    const bad = await open(browser, base + "?seed=abc");
    const warn = await bad.page.locator("#seed-warn").innerText();
    const daily = await bad.page.locator("#daily").innerText();
    const expect = utcToday();
    const hook = await snapshot(bad.page);
    const box = await bad.page.locator("#seed-warn").boundingBox();
    check(warn === "Bad seed, using daily", `bad seed notice "${warn}"`);
    check(box && box.height >= 12 && box.width >= 48, "bad seed notice is visible");
    check(daily === `Daily UTC #${expect}` && hook.seed === expect, `bad seed falls back to daily ${expect}`);
    const badShot = await shoot(bad.page, "tellme-bad-seed");
    check(badShot.w === 390 && badShot.h === 844, `tellme-bad-seed.png is ${badShot.w}x${badShot.h}`);
    for (const e of bad.errors) check(false, e);
    await bad.close();

    const broke = await open(browser, base + "?seed=239&fast=1");
    await begin(broke.page);
    const busted = await drive(broke.page, bustPolicy);
    const handLabel = await broke.page.locator("#handnum").innerText();
    const endHands = await broke.page.locator("#end-hands").innerText();
    const n = (endHands.match(/\d+/) || [])[0];
    check(handLabel === `Hand ${n}/10`, `post-bust status "${handLabel}" matches end "${endHands}"`);
    check(Number(n) === busted.test.hands && busted.test.hands < 10, `bust hand count is ${busted.test.hands}`);
    for (const e of broke.errors) check(false, e);
    await broke.close();

    const land = await open(browser, base + "?seed=1&fast=1", { width: 844, height: 390 });
    await begin(land.page);
    await land.page.waitForFunction(() => document.documentElement.dataset.phase === "act");
    const hit = await land.page.evaluate(() => {
      const box = (sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height };
      };
      const overlap = (a, b) => {
        const x = Math.min(a.r, b.r) - Math.max(a.x, b.x);
        const y = Math.min(a.b, b.b) - Math.max(a.y, b.y);
        return x > 0.5 && y > 0.5;
      };
      const card = box("#player-card");
      const bram = box(".critter.bram .sprite");
      const name = box(".critter.bram .name");
      const note = box("#note");
      return {
        cardBram: overlap(card, bram),
        cardName: overlap(card, name),
        cardNote: overlap(card, note),
        noteText: document.querySelector("#note").textContent,
      };
    });
    check(!hit.cardBram && !hit.cardName && !hit.cardNote, `landscape overlap card/bram ${hit.cardBram} card/name ${hit.cardName} card/note ${hit.cardNote}`);
    const landShot = await shoot(land.page, "tellme-landscape");
    check(landShot.w === 844 && landShot.h === 390, `tellme-landscape.png is ${landShot.w}x${landShot.h}`);
    for (const e of land.errors) check(false, e);
    await land.close();
  }

  // --- real-time screenshots at 390x844 ---
  console.log("\nscreenshots");
  const shot = await open(browser, base + "?seed=1");
  const startShot = await shoot(shot.page, "tellme-start");
  await begin(shot.page);
  const got = { faces: new Set(), pairs: new Set(), flick: false, flip: false, end: false, win: false, lose: false, fold: false, bubble: { bram: false, fennel: false }, both: false };
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    const snap = await shot.page.evaluate(() => ({
      phase: document.documentElement.dataset.phase,
      flick: !!document.querySelector(".layer-tail.flick"),
      flip: document.getElementById("player-card").classList.contains("flipping"),
      faces: [...document.querySelectorAll(".critter")].map((c) => ({ who: c.dataset.who, face: c.dataset.face || "" })),
      bubbles: [...document.querySelectorAll(".critter")].map((c) => {
        const b = c.querySelector(".bubble");
        return { who: c.dataset.who, on: !!b && !b.hidden && b.textContent.length > 0 };
      }),
      win: !!document.querySelector(".react-win"),
      lose: !!document.querySelector(".react-lose"),
      fold: !!document.querySelector(".react-fold"),
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
    if ((snap.win && !got.win) || (snap.lose && !got.lose) || (snap.fold && !got.fold)) {
      await sleep(280);
      if (snap.win && !got.win) {
        await shoot(shot.page, "tellme-react-win");
        got.win = true;
      }
      if (snap.lose && !got.lose) {
        await shoot(shot.page, "tellme-react-lose");
        got.lose = true;
      }
      if (snap.fold && !got.fold) {
        await shoot(shot.page, "tellme-react-fold");
        got.fold = true;
      }
    }
    const bubbleOn = Object.fromEntries(snap.bubbles.map((b) => [b.who, b.on]));
    if (bubbleOn.bram && !got.bubble.bram) {
      await shoot(shot.page, "tellme-bubble-bram");
      got.bubble.bram = true;
    }
    if (bubbleOn.fennel && !got.bubble.fennel) {
      await shoot(shot.page, "tellme-bubble-fennel");
      got.bubble.fennel = true;
    }
    if (bubbleOn.bram && bubbleOn.fennel && !got.both) {
      await shoot(shot.page, "tellme-bubbles");
      got.both = true;
    }
    if (snap.phase === "act" || snap.phase === "think") {
      for (const c of snap.faces) {
        if (!c.face) continue;
        if (!got.faces.has(c.face) && snap.phase === "act") {
          await shoot(shot.page, "tellme-face-" + c.face);
          got.faces.add(c.face);
        }
        const key = c.who + "-" + c.face;
        if (!got.pairs.has(key)) {
          await shoot(shot.page, "tellme-" + key);
          got.pairs.add(key);
        }
      }
    }
    if (snap.phase === "act") {
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
  const pairList = [...got.pairs].sort().join(",");
  check(got.faces.size === 4, `four face states shot (${faceList})`);
  check(got.pairs.size === 8, `each critter in all four faces (${pairList})`);
  check(got.bubble.bram && got.bubble.fennel, "speech bubble shot on each critter");
  check(got.flick, "tail flick shot");
  check(got.flip, "showdown flip shot");
  check(got.win && got.lose, "win and lose reactions shot");
  check(got.end, "end screen shot");
  const shotNames = [
    "tellme-start", "tellme-face-smug", "tellme-face-calm", "tellme-face-nervous", "tellme-face-sweating",
    "tellme-tail", "tellme-showdown", "tellme-end",
    "tellme-bram-smug", "tellme-bram-calm", "tellme-bram-nervous", "tellme-bram-sweating",
    "tellme-fennel-smug", "tellme-fennel-calm", "tellme-fennel-nervous", "tellme-fennel-sweating",
    "tellme-bubble-bram", "tellme-bubble-fennel", "tellme-react-win", "tellme-react-lose",
  ];
  for (const name of shotNames) {
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
  const shotLines = await shot.page.evaluate(() => window.__lineLog.map((row) => ({ who: row.who, situation: row.situation, text: row.text })));
  const shotRepeats = repeats(shotLines);
  check(shotRepeats.length === 0, shotRepeats.length ? shotRepeats.slice(0, 4).join("; ") : "screenshot run never repeats a line back-to-back");
  const needSituations = ["start", "deal", "small", "big", "check", "call", "fold", "win", "lose", "idle", "end"];
  const seenSituations = new Set(shotLines.map((row) => row.situation));
  const missingSituations = needSituations.filter((s) => !seenSituations.has(s));
  check(missingSituations.length === 0, missingSituations.length ? `missing dialogue situations ${missingSituations.join(",")}` : "every dialogue situation was used");
  const shotHits = await shot.page.evaluate(() => window.__bubbleHits || []);
  check(shotHits.length === 0, shotHits.length ? `screenshot bubble overlap: ${shotHits.slice(0, 3).join(" | ")}` : "screenshot run bubbles stay off the buttons");
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
    const choice = await policy(hand, available);
    await page.locator(`#actions button[data-act="${choice}"]`).tap();
    await page.waitForFunction((s) => document.documentElement.dataset.serial !== s, serial);
  }
}
