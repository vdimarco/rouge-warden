// Home catalog: New and Updated orders, against the generated git dates.
// Serve public/ first: python3 -m http.server 8765 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/arcade/new-sort.e2e.mjs
import { createRequire } from "module";
import fs from "fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.ARCADE_URL || "http://127.0.0.1:8765/";
const FEATURED = ["fish", "tidebreak", "wild", "vr", "crimson", "river-rush"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shots = {
  new390: "/opt/cursor/artifacts/arcade-new-390.png",
  updated390: "/opt/cursor/artifacts/arcade-updated-390.png",
  new1280: "/opt/cursor/artifacts/arcade-new-1280.png",
};
fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });

const label = (iso, kind) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!match) return "";
  return (kind === "updated" ? "Updated " : "Added ") + MONTHS[Number(match[2]) - 1] + " " + Number(match[3]);
};
const byDate = (catalog, dates, key) => [...catalog].sort((a, b) => Date.parse(dates[b][key]) - Date.parse(dates[a][key]));
const byFeatured = (catalog) => [...catalog].sort((a, b) => {
  const rank = (id) => { const i = FEATURED.indexOf(id); return i === -1 ? FEATURED.length : i; };
  return rank(a) - rank(b);
});

let failures = 0;
const check = (ok, what) => { console.log((ok ? "PASS " : "FAIL ") + what); if (!ok) failures++; };

const browser = await chromium.launch({
  executablePath: process.env.CHROME || "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function openBoard(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  await page.route("**/api/arcade-leaderboard", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ source: "posthog", days: 30, updatedAt: "2026-10-15T00:00:00.000Z", games: {} }),
  }));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector(".scoreboard .board-when");
  await page.waitForFunction(() => {
    const text = document.querySelector(".board-status")?.textContent || "";
    return text && !text.startsWith("Loading");
  });
  return errors;
}

async function readBoard(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".scoreboard .gsw-game")].map((tile) => ({
      id: tile.querySelector("[data-arcade-like]")?.dataset.arcadeLike,
      when: tile.querySelector(".board-when")?.textContent || "",
    }));
    const buttons = [...document.querySelectorAll(".board-sort button")].map((b) => {
      const r = b.getBoundingClientRect();
      return { metric: b.dataset.metric, text: b.textContent, pressed: b.getAttribute("aria-pressed"), w: r.width, h: r.height, left: r.left, right: r.right, top: r.top };
    });
    return {
      cards,
      buttons,
      stored: localStorage.getItem("cottage-catalog-sort"),
      catalog: window.GameSwitch.GAMES.filter((g) => !g.labOnly).map((g) => g.id),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
}

const dates = await (await fetch(BASE + "arcade/game-dates.json")).json();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = await openBoard(page);
let board = await readBoard(page);
const catalog = board.catalog.filter((id) => board.cards.some((c) => c.id === id));
check(errors.length === 0, "no console errors on load: " + (errors.join(" | ") || "none"));
check(board.cards.map((c) => c.id).join(",") === byFeatured(catalog).join(","), "default Featured order is unchanged");
check(board.buttons.find((b) => b.metric === "featured").pressed === "true", "Featured is selected by default");
check(board.cards.every((c) => c.when === label(dates.games[c.id].added, "added")), "default cards read Added plus the first-commit day");

await page.locator(".board-sort button[data-metric='added']").click();
await page.waitForFunction(() => document.querySelector("[data-metric='added']").getAttribute("aria-pressed") === "true");
board = await readBoard(page);
const newOrder = byDate(catalog, dates.games, "added");
check(board.cards.map((c) => c.id).join(",") === newOrder.join(","), "New order matches git first-commit dates");
check(board.cards.every((c) => c.when === label(dates.games[c.id].added, "added")), "New cards read Added plus that day");
check(board.stored === "added", "New is stored in localStorage");
const newButtons = board.buttons.filter((b) => b.metric === "added" || b.metric === "updated");
check(newButtons.every((b) => b.h >= 44 && b.w >= 44 && b.left >= 0 && b.right <= 390), "New and Updated are at least 44px and on screen at 390");
check(board.scrollWidth <= board.clientWidth + 1, "no sideways scroll at 390");
await page.screenshot({ path: shots.new390 });

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".scoreboard [data-metric='added'][aria-pressed='true']");
board = await readBoard(page);
check(board.cards.map((c) => c.id).join(",") === newOrder.join(","), "New order persists after reload");

await page.locator(".board-sort button[data-metric='updated']").click();
await page.waitForFunction(() => document.querySelector("[data-metric='updated']").getAttribute("aria-pressed") === "true");
board = await readBoard(page);
const updatedOrder = byDate(catalog, dates.games, "updated");
check(board.cards.map((c) => c.id).join(",") === updatedOrder.join(","), "Updated order matches git last-commit dates");
check(board.cards.every((c) => c.when === label(dates.games[c.id].updated, "updated")), "Updated cards read Updated plus that day");
check(newOrder.join(",") !== updatedOrder.join(","), "the two date orders are not the same list");
check(board.scrollWidth <= board.clientWidth + 1, "no sideways scroll at 390 after Updated");
await page.screenshot({ path: shots.updated390 });

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".scoreboard [data-metric='updated'][aria-pressed='true']");
board = await readBoard(page);
check(board.cards.map((c) => c.id).join(",") === updatedOrder.join(",") && board.stored === "updated", "Updated order persists after reload");
check(errors.length === 0, "no console errors after both sorts and reloads: " + (errors.join(" | ") || "none"));

await page.locator(".board-sort button[data-metric='featured']").click();
board = await readBoard(page);
check(board.cards.map((c) => c.id).join(",") === byFeatured(catalog).join(","), "Featured returns to the default order");

const wide = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const desk = await wide.newPage();
const deskErrors = await openBoard(desk);
await desk.evaluate(() => localStorage.setItem("cottage-catalog-sort", "added"));
await desk.reload({ waitUntil: "networkidle" });
await desk.waitForSelector(".scoreboard [data-metric='added'][aria-pressed='true']");
await desk.screenshot({ path: shots.new1280 });
const deskBoard = await readBoard(desk);
check(deskBoard.cards.map((c) => c.id).join(",") === newOrder.join(","), "1280 New order matches the phone order");
check(deskBoard.scrollWidth <= deskBoard.clientWidth + 1, "no sideways scroll at 1280");
check(deskErrors.length === 0, "no console errors at 1280: " + (deskErrors.join(" | ") || "none"));

console.log("--- per-game dates (homepage catalog) ---");
for (const id of catalog) {
  const row = dates.games[id];
  console.log(id + "\t" + row.path + "\tadded " + row.added + "\tupdated " + row.updated);
}
console.log(failures ? "FAIL " + failures + " checks" : "PASS all catalog sort checks");
await browser.close();
process.exit(failures ? 1 : 0);
