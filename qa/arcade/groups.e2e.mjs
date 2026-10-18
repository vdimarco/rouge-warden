// Checks the arcade's group cabinets against openspec/specs/arcade-groups.
// Serve public/ first: python3 -m http.server 8765 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/arcade/groups.e2e.mjs   (SHOTS=/tmp/dir saves screenshots; CHROME or CHROMIUM_PATH picks the browser)
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = (process.env.ARCADE_URL || "http://localhost:8765/").replace(/\/?$/, "/");
const SHOTS = process.env.SHOTS || "";
const SIZES = [
  { name: "desktop", width: 1280, height: 800, touch: false },
  { name: "portrait", width: 390, height: 844, touch: true },
  { name: "landscape", width: 844, height: 390, touch: true },
];
let failures = 0;
const check = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) failures++; };

const state = (page) => page.evaluate(() => {
  const vis = [...document.querySelectorAll(".cab")].filter((c) => !c.hidden);
  const on = document.querySelector(".cab.on");
  const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width }; };
  const back = document.querySelector("#backBtn");
  return {
    visible: vis.map((c) => c.dataset.opens || c.dataset.game),
    groupsVisible: vis.filter((c) => c.dataset.opens).length,
    on: on && (on.dataset.opens || on.dataset.game),
    hash: location.hash,
    sign: document.querySelector(".sign p").textContent,
    tokens: document.querySelector("#count").textContent,
    back: back.hidden ? null : r(back),
    onScreen: on && r(on.querySelector(".screen")),
    onPanel: on && r(on.querySelector(".panel")),
    onCab: on && r(on),
    onDoor: on && r(on.querySelector(".door")),
    tray: [...document.querySelectorAll(".tray > *")].filter((el) => el.offsetParent).map(r),
    stage: r(document.querySelector("#stage")),
    allFit: vis.every((c) => { const b = c.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; }),
    picker: document.querySelector("#machinePicker").value,
  };
});
const overlap = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const settle = (page) => page.waitForTimeout(600);
// All Games opens a moment after the page loads, so give it time before deciding it stayed shut
const boardOpens = (page) => page.waitForSelector(".gsw.scoreboard:not([hidden])", { timeout: 3000 }).then(() => true, () => false);

const chrome = process.env.CHROME || process.env.CHROMIUM_PATH;
const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
for (const size of SIZES) {
  console.log(size.name + " " + size.width + "x" + size.height);
  const ctx = await browser.newContext(size.touch ? { viewport: size, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: size });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  check(await boardOpens(page), "/ opens All Games");
  await page.locator(".gsw .machines-link").click();
  await settle(page);

  let s = await state(page);
  check(!(await page.isVisible(".gsw.scoreboard")), "Old arcade closes All Games and shows the hall");
  check(s.groupsVisible === 6 && s.visible.length === 6, "hall shows exactly the six group cabinets: " + s.visible.join(", "));
  check(JSON.stringify(s.visible) === JSON.stringify(["cottage", "action", "ascii", "strategy", "gta", "lab"]), "the groups stand in order: Cottage, Action, ASCII Scenes, Strategy, GTA, Lab");
  check(s.on === "cottage", "first group is selected");
  check(s.back === null, "no back control in the hall");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, size.name + "-hall.png") });

  // open Action with the keys: no token spent
  const tokens = s.tokens;
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await settle(page);
  s = await state(page);
  check(JSON.stringify(s.visible) === JSON.stringify(["olympus", "crimson", "tidebreak", "moonwell", "primordia", "river-rush", "ahead-of-the-light", "light-years-home", "first-breath"]), "Action shows its nine games, First Breath last: " + s.visible.join(", "));
  check(s.on === "olympus", "first game selected");
  check(s.tokens === tokens, "opening a group spends no token");
  check(s.hash === "#action" && /ACTION/.test(s.sign) && !!s.back, "sign, address and back control show the group");
  check(!overlap(s.back, s.onCab), "back control does not cover the selected machine");
  check(s.tray.every((t) => !overlap(t, s.onDoor)), "the tray does not cover the selected machine's coin slots");
  const mid = (s.onCab.l + s.onCab.r) / 2, smid = (s.stage.l + s.stage.r) / 2;
  check(s.allFit || Math.abs(mid - smid) < 4, "machines fit side by side or the selected one is centered");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, size.name + "-action.png") });

  // arrows move within the group
  await page.keyboard.press("ArrowRight");
  s = await state(page);
  check(s.on === "crimson", "arrow key moves to the next game in the group");

  // Escape returns to the hall with the group selected
  await page.keyboard.press("Escape");
  await settle(page);
  s = await state(page);
  check(s.visible.length === 6 && s.on === "action" && s.hash === "", "Escape returns to the hall with Action selected");

  // a click opens a group; the browser's back button returns to the hall
  await page.evaluate(() => document.querySelector('.cab[data-opens="strategy"]').click());
  await settle(page);
  s = await state(page);
  check(JSON.stringify(s.visible) === JSON.stringify(["breakthrough", "follow-suit"]) && s.hash === "#strategy", "clicking Strategy opens it");
  await page.goBack();
  await settle(page);
  s = await state(page);
  check(s.groupsVisible === 6 && s.on === "strategy" && page.url() === BASE, "browser back returns to the hall");

  // the sign's collection buttons open their group
  const nav = page.locator('.section-nav button[data-section="cottage"]');
  if (await nav.isVisible()) {
    await nav.click();
    await settle(page);
    s = await state(page);
    check(s.hash === "#cottage" && s.on === "plungerd", "the COTTAGE button opens Cottage");
    await page.keyboard.press("Escape");
    await settle(page);
  }

  // the picker jumps straight into a group
  await page.selectOption("#machinePicker", "moonwell");
  await settle(page);
  s = await state(page);
  check(s.hash === "#action" && s.on === "moonwell" && s.picker === "moonwell", "picker opens Action with Moonwell selected");
  await page.click("#backBtn");
  await settle(page);
  s = await state(page);
  check(s.visible.length === 6 && s.on === "action", "the back control returns to the hall with Action selected");
  await page.keyboard.press("Enter");
  await settle(page);
  await page.keyboard.press("Backspace");
  await settle(page);
  s = await state(page);
  check(s.visible.length === 6 && s.on === "action", "Backspace returns to the hall");

  // play a game from a group, then come back to it
  await page.evaluate(() => { localStorage.setItem("arcade.tokens", "3"); sessionStorage.removeItem("arcade.last"); });
  // a hash-only goto would not reload the page (it keeps the group's earlier selection), so reload for a fresh start
  await page.goto(BASE + "#strategy");
  await page.reload();
  await settle(page);
  s = await state(page);
  check(s.hash === "#strategy" && s.on === "breakthrough", "/#strategy opens Strategy on its first game");
  check(!(await boardOpens(page)), "a group link opens no All Games over its group");
  await page.keyboard.press("5");
  await settle(page);
  s = await state(page);
  const credit = await page.evaluate(() => document.querySelector('.cab[data-game="breakthrough"] .osd .credit').textContent);
  check(s.tokens === "2" && credit === "CREDIT 1", "a coin dropped inside a group spends a token and adds a credit");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/follow-suit\//, { timeout: 15000 }).then(() => check(true, "Follow Suit powers on and loads /follow-suit/"), () => check(false, "Follow Suit powers on and loads /follow-suit/"));
  await page.goBack();
  await settle(page);
  s = await state(page);
  check(s.hash === "#strategy" && s.on === "follow-suit", "returning from a game reopens its group with it selected (" + s.hash + ", " + s.on + ")");
  check(!(await boardOpens(page)), "and no All Games opens over it");

  // group links
  await page.goto(BASE + "#lab");
  await settle(page);
  s = await state(page);
  check(s.visible.length === 17 && s.on === "lab", "/#lab opens the Lab with its nine toys and eight ASCII sketches");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, size.name + "-lab.png") });
  await page.goto(BASE + "#ascii");
  await settle(page);
  s = await state(page);
  check(s.visible.length === 2 && s.on === "ascii-front", "/#ascii opens ASCII Scenes with ASCII Front and Battle Tanks");

  check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  await ctx.close();
}
await browser.close();
console.log(failures ? failures + " failed" : "all passed");
process.exit(failures ? 1 : 0);
