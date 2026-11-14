// Checks which view the arcade home opens against openspec/changes/arcade-corridor-default.
// Serve public/ first: python3 -m http.server 8765 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/arcade/default-view.e2e.mjs   (SHOTS=/tmp/dir saves screenshots; CHROME or CHROMIUM_PATH picks the browser)
import { createRequire } from "module";
import path from "path";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = (process.env.ARCADE_URL || "http://localhost:8765/").replace(/\/?$/, "/");
const SHOTS = process.env.SHOTS || "";
const WALK = BASE + "corridor/";
const SIZES = [
  { name: "1280", width: 1280, height: 800, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
  { name: "320", width: 320, height: 640, touch: true },
];
let failures = 0;
const check = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) failures++; };
const isHall = (page) => page.evaluate(() => !!document.querySelector("#row .cab"));
const settle = (page) => page.waitForTimeout(600);

const exe = process.env.CHROME || process.env.CHROMIUM_PATH;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const size of SIZES) {
  console.log(size.name);
  // a visitor's browser: the page cannot tell it is automated
  const visitor = async () => {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch });
    await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
    return ctx;
  };
  let ctx = await visitor();
  let page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(BASE);
  await page.waitForURL(WALK);
  await page.waitForSelector(".cr.is-ready", { timeout: 20000 });
  check(page.url() === WALK, "the home opens the corridor");
  const walk = await page.evaluate(() => {
    const a = document.querySelector(innerWidth <= 760 ? "#classic-pill" : "#classic-link"), b = a.getBoundingClientRect();
    const play = [...document.querySelectorAll("a[href]")].map((x) => x.getAttribute("href")).filter((h) => /^https?:\/\/arcade\./.test(h));
    return { canvas: !!document.querySelector("canvas"), w: b.width, h: b.height, inView: b.left >= 0 && b.right <= innerWidth && b.top >= 0, offsite: play.length, wide: document.documentElement.scrollWidth > innerWidth };
  });
  check(walk.canvas, "the corridor draws on a canvas");
  check(walk.inView && walk.h >= 30 && walk.w >= 44, `All games control is on screen and ${Math.round(walk.w)}x${Math.round(walk.h)}`);
  check(!walk.wide, "the corridor has no sideways scroll");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, size.name + "-corridor.png") });

  await page.click(size.width <= 760 ? "#classic-pill" : "#classic-link");
  await page.waitForURL(BASE + "?view=classic");
  await settle(page);
  check(await isHall(page), "All games opens the hall page");
  // wide screens show the control in the bar; a phone keeps it in Menu
  const inBar = size.width > 480;
  if (!inBar) await page.click(".board-menu summary");
  const nav = await page.evaluate((sel) => {
    const a = document.querySelector(sel), b = a.getBoundingClientRect(), t = document.querySelector(".board-head h2");
    const tb = t.getBoundingClientRect();
    // every control shown in the bar starts to the right of the title, or on another line
    const clear = [...document.querySelectorAll(".board-nav > *")].map((x) => x.getBoundingClientRect()).filter((x) => x.width > 0)
      .every((x) => x.left >= tb.right - 1 || x.top >= tb.bottom || x.bottom <= tb.top);
    return { w: b.width, h: b.height, inView: b.left >= 0 && b.right <= innerWidth && b.width > 0, clear };
  }, inBar ? ".board-nav .walk-link" : ".board-menu .walk-menu");
  check(nav.inView && nav.h >= (inBar ? 24 : 36) && nav.w >= 44, `Corridor control is on screen and ${Math.round(nav.w)}x${Math.round(nav.h)}`);
  check(nav.clear, "the bar's controls do not cover its title");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, size.name + "-hall.png") });
  await page.goto(BASE);
  await settle(page);
  check(page.url() === BASE && await isHall(page), "the hall is remembered on the next visit");
  if (!inBar) await page.click(".board-menu summary");
  await page.click(inBar ? ".board-nav .walk-link" : ".board-menu .walk-menu");
  await page.waitForURL(WALK);
  await page.goto(BASE);
  await page.waitForURL(WALK);
  check(page.url() === WALK, "Corridor returns to the corridor and forgets the choice");
  await ctx.close();

  ctx = await visitor();
  page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "#strategy");
  await settle(page);
  check(page.url() === BASE + "#strategy" && await isHall(page), "a group link stays in the hall");
  await ctx.close();

  // a cabinet in the corridor leads to its game on this site
  ctx = await visitor();
  page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(WALK);
  await page.waitForSelector(".cr.is-ready", { timeout: 20000 });
  await page.click("#index-btn");
  await settle(page);
  const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((x) => x.getAttribute("href")));
  check(!hrefs.some((h) => /^https?:\/\/arcade\.uptick\.systems/.test(h)), "no link leaves for the production address");
  await ctx.close();

  check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));

  // a clean browser leaves webdriver on and has no stored choice. / is the corridor, same as ?view=walk.
  ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch });
  page = await ctx.newPage();
  const cleanErrors = [];
  page.on("pageerror", (e) => cleanErrors.push(e.message));
  const visible = (sels) => page.evaluate((sels) => {
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const s = getComputedStyle(el), b = el.getBoundingClientRect();
      if (s.display === "none" || s.visibility === "hidden" || b.width < 1 || b.height < 1) continue;
      return sel;
    }
    return "";
  }, sels);
  const hit = (sel) => page.evaluate((sel) => {
    const el = document.querySelector(sel), b = el.getBoundingClientRect();
    const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { self: top === el, id: top && top.id, cls: top && String(top.className || "") };
  }, sel);
  await page.goto(BASE);
  await page.waitForURL(WALK);
  await page.waitForSelector(".cr.is-ready", { timeout: 20000 });
  await page.waitForFunction(() => ["#classic-link", "#classic-pill"].some((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const b = el.getBoundingClientRect();
    return getComputedStyle(el).display !== "none" && b.width > 0 && b.height > 0;
  }));
  const boardUp = () => page.locator(".gsw.scoreboard").isVisible();
  check(page.url() === WALK && !(await boardUp()), "a clean / opens the corridor with the leaderboard closed");
  if (size.width === 390 || size.width === 1280) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "clean-" + size.name + "-corridor.png") });
    const games = await visible(["#classic-link", "#classic-pill"]);
    const at = await hit(games);
    check(!!games && at.self, `${size.name}: All Games is the element at its centre (${games}; hit ${at.id || at.cls})`);
    // A normal click, not a forced one. On software WebGL the corridor's frame is most of a second,
    // so the click's own stability check can take longer than the open. The list has to be up within 1s of arrival.
    let arrived = 0;
    const mark = () => { arrived = Date.now(); };
    page.on("framenavigated", mark);
    const t0 = Date.now();
    await page.locator(games).click({ timeout: 20000 });
    const clickMs = Date.now() - t0;
    page.off("framenavigated", mark);
    const tList = Date.now();
    await page.waitForSelector(".gsw.scoreboard .board-launch", { timeout: 1000 });
    const listMs = Date.now() - (arrived || tList);
    check(listMs <= 1000 && await boardUp(), `${size.name}: All Games opens the list in ${listMs} ms of arrival (${clickMs} ms for the click on this machine)`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "clean-" + size.name + "-all-games.png") });

    await page.goto(BASE + "?view=walk");
    await page.waitForURL(WALK);
    await page.waitForSelector(".cr.is-ready", { timeout: 20000 });
    check(page.url() === WALK && !(await boardUp()), "?view=walk opens the corridor");

    await page.goto(BASE + "?view=board");
    await page.waitForSelector(".gsw.scoreboard:not([hidden]) .board-launch");
    check(new URL(page.url()).searchParams.get("view") === "board" && await boardUp(), "?view=board opens the leaderboard");
    const over = await hit(".all-games");
    check(over.self, `${size.name}: with the board open, All Games is the element at its centre (hit ${over.id || over.cls})`);
    if (SHOTS && size.width === 390) await page.screenshot({ path: path.join(SHOTS, "clean-390-board.png") });

    await page.getByRole("button", { name: "Close", exact: true }).click();
    check(!(await boardUp()), "X closes the board");
    await page.locator("#scores-btn").click();
    await page.waitForSelector(".gsw.scoreboard:not([hidden])");
    check(await boardUp(), "Scores opens the board");
    await page.keyboard.press("Escape");
    check(!(await boardUp()), "Esc closes the board");
    await page.locator("#scores-btn").click();
    await page.waitForSelector(".gsw.scoreboard:not([hidden])");
    await page.locator(".sign h1").click();
    check(!(await boardUp()), "a tap outside closes the board");
    await page.locator("#scores-btn").click();
    await page.waitForSelector(".gsw.scoreboard:not([hidden]) .board-launch");
    const still = await hit(".all-games");
    check(still.self, `${size.name}: All Games stays on top after Scores reopens the board`);
    const t1 = Date.now();
    await page.locator(".all-games").click({ timeout: 1000 });
    await page.waitForSelector(".gsw.scoreboard .board-launch", { timeout: 1000 });
    check(Date.now() - t1 <= 1000 && await boardUp(), `${size.name}: All Games still opens the list while the board is up (${Date.now() - t1} ms)`);
  }
  check(cleanErrors.length === 0, "no page errors on a clean visit" + (cleanErrors.length ? ": " + cleanErrors.join(" | ") : ""));
  await ctx.close();
}
await browser.close();
console.log(failures ? failures + " failed" : "all passed");
process.exit(failures ? 1 : 0);
