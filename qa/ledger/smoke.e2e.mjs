// Warden's Ledger in a browser. Needs the site served at http://127.0.0.1:8765/.
// Run: NODE_PATH=qa/browser/node_modules node qa/ledger/smoke.e2e.mjs [--live]
// By default the 1Click API is mocked so the run is the same every time. --live also runs a pass against the real API.
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE || "http://127.0.0.1:8765";
const LIVE = process.argv.includes("--live");
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? " · " + extra : ""}`); if (!ok) fails++; };

const TOKENS = [
  ["nep141:wrap.near", 3.7], ["nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", 1], ["nep141:usdt.tether-token.near", 1],
  ["nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", 1], ["nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", 1],
  ["nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near", 1], ["nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near", 1],
].map(([assetId, price]) => ({ assetId, price, decimals: 6, symbol: "X", blockchain: "near" }));
async function mock(page, mode) {
  await page.route("https://1click.chaindefuser.com/**", async (route) => {
    if (mode === "down") return route.abort();
    const url = route.request().url();
    if (url.endsWith("/v0/tokens")) return route.fulfill({ json: TOKENS, headers: { "access-control-allow-origin": "*" } });
    const body = JSON.parse(route.request().postData());
    const dest = TOKENS.find((t) => t.assetId === body.destinationAsset);
    const decimals = body.destinationAsset === "nep141:wrap.near" ? 24 : 6;
    const out = Number(BigInt(body.amount) / 10n ** BigInt(decimals - 6)) / 1e6;
    const nearIn = (out * (dest.price / 3.7)) * 1.01;
    const units = BigInt(Math.round(nearIn * 1e6)) * 10n ** 18n;
    return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" }, json: { quote: { amountIn: units.toString(), amountOut: body.amount, amountInUsd: String(nearIn * 3.7), timeEstimate: 20 }, signature: "ed25519:MOCKSIG", correlationId: "mock-correlation", timestamp: new Date().toISOString() } });
  });
}
const state = (page) => page.evaluate(() => { const S = window.__ledger.app.S; return { day: S.day.n, cap: S.day.cap, spent: S.day.spent, locked: S.day.locked, closed: S.day.closed, receipts: S.receipts, done: S.done, wallet: S.wallet }; });

const browser = await chromium.launch();

/* ---------- 1. a hand-played day with mocked quotes, at 1280 */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await mock(page, "up");
  await page.goto(BASE + "/ledger/?seed=42");
  await page.waitForSelector("#title[open]");
  check("title sheet opens", true);
  await page.click("#start");
  const st = await state(page);
  check("day 1 shows budget, payout, tasks and 8 hours", st.day === 1 && (await page.locator(".task").count()) >= 3 && (await page.textContent("#clock-text")).includes("0 of 8"));
  check("mode chip reads live", (await page.textContent("#mode")).includes("live"));
  check("switch game button", (await page.locator("button[data-switch]").count()) === 1);
  // one counter per bid
  const firstBid = page.locator(".task").first().locator(".bid").first();
  const bidId = await firstBid.locator('button[data-act="counter"]').first().getAttribute("data-bid");
  await firstBid.locator('button[data-act="counter"]').first().click();
  check("a countered bid offers no second counter", (await page.locator(`button[data-act="counter"][data-bid="${bidId}"]`).count()) === 0);
  // hire what fits until nothing does
  for (let i = 0; i < 6; i++) { const h = page.locator('#tasks button[data-act="hire"]:not([disabled])'); if (!(await h.count())) break; await h.first().click(); }
  const s2 = await state(page);
  check("locks stay inside the budget", s2.spent + s2.locked <= s2.cap + 1e-9, `${s2.spent}+${s2.locked} > ${s2.cap}`);
  const short = await page.locator('.bid .why:has-text("budget short")').count();
  const disabledHire = await page.locator('#tasks button[data-act="hire"][disabled]').count();
  check("a bid too dear has a disabled Hire", short === 0 || disabledHire >= short);
  // take deliveries until the day closes
  for (let i = 0; i < 20 && !(await page.locator("#summary[open]").count()); i++) {
    if (await page.locator("#next:not([disabled])").count()) { await page.click("#next"); await page.waitForFunction(() => !window.__ledger.app.busy); continue; }
    const h = page.locator('#tasks button[data-act="hire"]:not([disabled])');
    if (await h.count()) { await h.first().click(); continue; }
    if (await page.locator("#endday:not([disabled])").count()) await page.click("#endday");
  }
  const s3 = await state(page);
  check("the day closes with a summary", s3.closed && (await page.locator("#summary[open]").count()) === 1);
  check("every finished task has a receipt", s3.receipts.length >= 1);
  const paid = s3.receipts.find((r) => r.check.pass);
  if (paid) check("a passed receipt carries the 1Click quote", paid.payment.source === "1click" && paid.payment.correlationId === "mock-correlation" && paid.payment.mode.includes("no funds"));
  const failed = s3.receipts.find((r) => !r.check.pass);
  if (failed) check("a failed receipt pays nothing", failed.payment === null && failed.check.reason.length > 0);
  check("inspection shows the check", (await page.locator(".verdict").count()) === 1);
  await page.click("#summary-go");
  check("next day starts", (await state(page)).day === 2);
  // Esc on the summary: the day is closed, so the next day starts
  await page.click("#endday");
  await page.waitForSelector("#summary[open]");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__ledger.app.S.day.n === 3 && !window.__ledger.app.S.day.closed, null, { timeout: 3000 }).catch(() => {});
  const s4 = await state(page);
  check("Esc on the summary starts the next day", s4.day === 3 && !s4.closed && (await page.locator("#summary[open]").count()) === 0, `day ${s4.day}, closed ${s4.closed}`);
  await page.click('.tab[data-tab="receipts"]').catch(() => {});
  const dl = page.waitForEvent("download");
  await page.click("#export");
  const file = await dl;
  const json = JSON.parse(fs.readFileSync(await file.path(), "utf8"));
  check("export saves ledger-receipts.json", file.suggestedFilename() === "ledger-receipts.json" && json.receipts.length === s3.receipts.length);
  check("no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

/* ---------- 2. offline: the API is down */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await mock(page, "down");
  await page.goto(BASE + "/ledger/?seed=8");
  await page.waitForSelector("#title[open]");
  await page.click("#start");
  check("mode chip reads offline", (await page.textContent("#mode")).includes("offline"));
  for (let i = 0; i < 30; i++) {
    const st = await state(page);
    if (st.receipts.some((r) => r.check.pass) || st.closed) break;
    const h = page.locator('#tasks button[data-act="hire"]:not([disabled])');
    if (await h.count()) { await h.first().click(); continue; }
    if (await page.locator("#next:not([disabled])").count()) { await page.click("#next"); await page.waitForFunction(() => !window.__ledger.app.busy); continue; }
    break;
  }
  const r = (await state(page)).receipts.find((x) => x.check.pass);
  check("offline payment is an estimate", !!r && r.payment.source === "offline");
  await page.close();
}

/* ---------- 3. Auto plays a season inside every budget */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await mock(page, "up");
  await page.goto(BASE + "/ledger/?seed=5&auto=1&fast=1");
  let over = 0, seen = 0;
  for (let i = 0; i < 600; i++) {
    const st = await state(page);
    if (st.spent + st.locked > st.cap + 1e-9) over++;
    seen = Math.max(seen, st.day);
    if (st.done) break;
    await page.waitForTimeout(100);
  }
  const st = await state(page);
  check("Auto finishes the season", st.done, `reached day ${seen}`);
  check("Auto never spends past the budget", over === 0);
  await page.close();
}

/* ---------- 4. layouts */
for (const [w, h] of [[1280, 800], [1920, 1080], [1280, 540], [390, 844], [320, 640]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await mock(page, "up");
  await page.goto(BASE + "/ledger/?seed=42");
  await page.waitForSelector("#title[open]");
  const titleOk = await page.evaluate(() => { const r = document.querySelector("#title").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
  await page.click("#start");
  const layout = await page.evaluate(() => {
    const small = [];
    for (const b of document.querySelectorAll("button")) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height || b.closest("dialog:not([open])") || b.closest("[data-switch-host], .sw-box")) continue;
      if (Math.min(r.width, r.height) < 44) small.push((b.textContent || b.getAttribute("aria-label") || "").trim().slice(0, 20) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return { sw: document.documentElement.scrollWidth, small, tabs: getComputedStyle(document.querySelector(".tabs")).display };
  });
  check(`${w}px: no sideways scroll`, layout.sw <= w, "scrollWidth " + layout.sw);
  check(`${w}px: controls at least 44px`, layout.small.length === 0, layout.small.slice(0, 5).join(", "));
  check(`${w}px: title sheet fits`, titleOk);
  check(`${w}px: tabs ${w < 900 ? "shown" : "hidden"}`, (layout.tabs !== "none") === (w < 900));
  if (w >= 900) {
    // a wide window: the ledger fills it, edge to edge, and each pane scrolls by itself
    const fill = await page.evaluate(() => {
      const box = (s) => document.querySelector(s).getBoundingClientRect();
      const board = box("#pane-board"), rec = box("#pane-receipts"), ag = box("#pane-agents"), next = box("#next");
      const pane = document.querySelector("#pane-board");
      return {
        pageScrolls: document.documentElement.scrollHeight > innerHeight + 1,
        left: board.left, right: innerWidth - ag.right, bottom: innerHeight - Math.max(board.bottom, ag.bottom), top: board.top - box(".top").bottom,
        sideUnder: Math.abs(rec.left - ag.left) < 1 && ag.top > rec.bottom, boardScrolls: pane.scrollHeight > pane.clientHeight + 1,
        nextInView: next.top >= 0 && next.bottom <= innerHeight, cols: getComputedStyle(document.querySelector("#tasks")).gridTemplateColumns.split(" ").length,
      };
    });
    if (h >= 560) {
      check(`${w}x${h}: the page does not scroll`, !fill.pageScrolls);
      check(`${w}x${h}: the panes reach the window's edges`, fill.left <= 16.5 && fill.right <= 16.5 && fill.bottom <= 16.5 && fill.top <= 16.5 && fill.sideUnder, JSON.stringify(fill));
      check(`${w}x${h}: Next delivery is in view`, fill.nextInView);
      check(`${w}x${h}: tasks sit in ${w >= 1900 ? "three or more columns" : "two columns"}`, w >= 1900 ? fill.cols >= 3 : fill.cols === 2, `${fill.cols} columns`);
      // a delivery brings the board back to its top, where the check shows
      await page.locator('#tasks button[data-act="hire"]:not([disabled])').first().click();
      await page.evaluate(() => { document.querySelector("#pane-board").scrollTop = 9999; });
      await page.click("#next");
      await page.waitForFunction(() => !window.__ledger.app.busy);
      const seen = await page.evaluate(() => { const r = document.querySelector("#inspect").getBoundingClientRect(); return !document.querySelector("#inspect").hidden && r.top >= 0 && r.top < innerHeight - 60; });
      check(`${w}x${h}: a delivery shows at the top of the board`, seen);
    } else {
      check(`${w}x${h}: a short window keeps the scrolling page`, fill.pageScrolls);
    }
  }
  if (w < 900) {
    await page.click('.tab[data-tab="agents"]');
    check(`${w}px: Agents tab shows one pane`, await page.evaluate(() => [...document.querySelectorAll(".pane")].filter((p) => getComputedStyle(p).display !== "none").map((p) => p.dataset.pane).join() === "agents"));
  }
  await page.close();
}

/* ---------- 5. full screen */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await mock(page, "up");
  await page.goto(BASE + "/ledger/?seed=42");
  await page.waitForSelector("#title[open]");
  const full = () => page.evaluate(() => ({ on: !!document.fullscreenElement, pressed: document.querySelector("#fs").getAttribute("aria-pressed"), saved: localStorage.getItem("ledger.fullscreen"), shown: !document.querySelector("#fs").hidden }));
  const settle = (on) => page.waitForFunction((v) => !!document.fullscreenElement === v && document.querySelector("#fs").getAttribute("aria-pressed") === String(v), on, { timeout: 3000 }).catch(() => {});
  check("the Full screen button shows where the browser has full screen", (await full()).shown);
  await page.click("#start");
  await settle(true);
  let f = await full();
  check("Start goes full screen", f.on && f.pressed === "true", JSON.stringify(f));
  await page.click("#fs");
  await settle(false);
  f = await full();
  check("the Full screen button leaves full screen and saves the choice", !f.on && f.pressed === "false" && f.saved === "off", JSON.stringify(f));
  await page.reload();
  await page.waitForSelector("#title[open]");
  await page.click("#start");
  await page.waitForTimeout(400);
  f = await full();
  check("with full screen turned off, Start stays in the window", !f.on && f.pressed === "false", JSON.stringify(f));
  await page.click("#fs");
  await settle(true);
  f = await full();
  check("the Full screen button goes full screen and saves the choice", f.on && f.pressed === "true" && f.saved === "on", JSON.stringify(f));
  await ctx.close();
}
// a browser with no full screen mode for pages keeps the button out of the header
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false }); Object.defineProperty(Document.prototype, "webkitFullscreenEnabled", { get: () => false }); });
  await mock(page, "up");
  await page.goto(BASE + "/ledger/?seed=42");
  await page.waitForSelector("#title[open]");
  await page.click("#start");
  check("no full screen in the browser: no Full screen button, and the game starts", await page.evaluate(() => getComputedStyle(document.querySelector("#fs")).display === "none" && !document.querySelector("#title").open));
  await page.close();
}

/* ---------- 6. --live: a real dry quote from 1Click */
if (LIVE) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(BASE + "/ledger/?seed=42");
  await page.waitForSelector("#title[open]");
  await page.click("#start");
  check("live: mode chip reads live", (await page.textContent("#mode")).includes("live"));
  for (let i = 0; i < 30; i++) {
    const st = await state(page);
    if (st.receipts.some((r) => r.check.pass) || st.closed) break;
    const h = page.locator('#tasks button[data-act="hire"]:not([disabled])');
    if (await h.count()) { await h.first().click(); continue; }
    if (await page.locator("#next:not([disabled])").count()) { await page.click("#next"); await page.waitForFunction(() => !window.__ledger.app.busy, null, { timeout: 20000 }); continue; }
    break;
  }
  const r = (await state(page)).receipts.find((x) => x.check.pass);
  check("live: a passed receipt has a signed 1Click quote", !!r && r.payment.source === "1click" && /^ed25519:/.test(r.payment.signature), JSON.stringify(r && r.payment));
  if (r) console.log(`     ${r.payment.nearIn.toFixed(4)} wNEAR → ${r.payment.amountOut} ${r.payment.symbol} on ${r.payment.chain}, quote ${r.payment.correlationId}`);
  await page.close();
}

await browser.close();
console.log(fails ? `${fails} checks failed` : "all checks passed");
process.exit(fails ? 1 : 0);
