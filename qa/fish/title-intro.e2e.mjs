// The painted title sequence on the Reel It In title (fish-title-intro).
// Serve public/ first, then: NODE_PATH=qa/browser/node_modules node qa/fish/title-intro.e2e.mjs
// FISH_URL sets the address. SHOTS=dir saves the phone and desktop title with the sequence up.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { URL as FISH_URL, installPhone, sleep } from "./lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const SHOTS = process.env.SHOTS || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"];
const browser = await chromium.launch({ args: ARGS, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });

async function launch({ width, height, phone = false, reduced = false, calm = false, art = null } = {}) {
  const ctx = await browser.newContext(phone ? { viewport: { width, height }, isMobile: true, hasTouch: true } : { viewport: { width, height } });
  if (reduced) await ctx.setExtraHTTPHeaders({});
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push("console: " + m.text()); });
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(({ calm, art }) => {
    if (sessionStorage.getItem("qa-kept")) return;
    localStorage.clear();
    if (calm) localStorage.setItem("fish.calm", "1");
    if (art) localStorage.setItem("fish.v1", JSON.stringify({ v: 1, artStyle: art }));
    sessionStorage.setItem("qa-kept", "1");
  }, { calm, art });
  if (phone) await page.addInitScript(installPhone);
  await page.goto(FISH_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  return { ctx, page, errors };
}

const layout = () => {
  const R = (sel) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const intro = R("#titleIntro"), menu = R("#title .title-menu"), go = R("#freeBtn");
  const hit = document.elementFromPoint(go.x + go.w / 2, go.y + go.h / 2);
  const buttons = [...document.querySelectorAll("#title button, #title a")].filter((b) => b.offsetParent !== null && getComputedStyle(b).display !== "none").map((b) => b.textContent.trim());
  const v = document.querySelector("#titleIntroVideo");
  const overlap = intro.b > menu.y + 1 && intro.y < menu.b - 1 && intro.r > menu.x + 1 && intro.x < menu.r - 1;
  return {
    buttons, overlap, hit: hit && hit.closest("#freeBtn") ? "freeBtn" : (hit && (hit.id || hit.tagName)),
    src: v.currentSrc, w: v.videoWidth, h: v.videoHeight, muted: v.muted, inline: v.playsInline, paused: v.paused,
    intro: !document.querySelector("#titleIntro").hidden, playing: document.querySelector("#titleIntro").classList.contains("is-playing"),
    act: document.querySelector("#titleIntroAct").textContent, sound: document.querySelector("#titleIntroSound").textContent,
    pressed: document.querySelector("#titleIntroSound").getAttribute("aria-pressed"),
    scroll: [document.querySelector("#title").clientHeight, document.querySelector("#title").scrollHeight],
  };
};
async function seek(page) {
  await page.evaluate(() => new Promise((res) => {
    const v = document.getElementById("titleIntroVideo");
    if (Math.abs(v.currentTime - 4) < 0.2) { res(); return; }
    const done = () => { v.removeEventListener("seeked", done); res(); };
    v.addEventListener("seeked", done);
    v.currentTime = 4;
  }));
}

try {
  const phone = await launch({ width: 390, height: 844, phone: true });
  try {
    await phone.page.waitForFunction(() => { const v = document.querySelector("#titleIntroVideo"); return v && !v.paused && v.currentTime > 0 && v.videoWidth === 720; });
    await seek(phone.page);
    if (SHOTS) await phone.page.screenshot({ path: path.join(SHOTS, "title-intro-mobile.png") });
    let L = await phone.page.evaluate(layout);
    check(L.buttons.length === 8 && L.buttons[0] === "Go fishing", "the title menu is unchanged (" + L.buttons.join(" | ") + ")");
    check(/title-portrait\.mp4/.test(L.src) && L.w === 720 && L.h === 1280 && L.muted && L.inline && L.playing && L.act === "Skip", "portrait title plays the vertical film muted and inline (" + JSON.stringify({ src: L.src, w: L.w, h: L.h, muted: L.muted, act: L.act }) + ")");
    check(!L.overlap && L.hit === "freeBtn" && L.scroll[1] <= L.scroll[0] + 2, "the sequence stays in the logo and Go fishing is still hit (" + JSON.stringify({ overlap: L.overlap, hit: L.hit, scroll: L.scroll }) + ")");
    await sleep(400);
    await phone.page.click("#titleIntroSound");
    L = await phone.page.evaluate(layout);
    check(!L.muted && L.pressed === "true" && L.sound === "Mute", "Unmute turns the sequence sound on (" + L.sound + ", muted " + L.muted + ")");
    await phone.page.click("#titleIntroSound");
    check(await phone.page.evaluate(() => document.querySelector("#titleIntroVideo").muted), "Mute turns it off again");
    await sleep(400);
    await phone.page.click("#setBtn");
    await phone.page.waitForSelector("#settings:not([hidden])");
    check(await phone.page.evaluate(() => document.querySelector("#titleIntro").hidden && document.querySelector("#titleIntroVideo").paused), "Settings pauses the sequence");
    await phone.page.click("#optCalm");
    await sleep(400);
    await phone.page.click("#settings [data-close]");
    await phone.page.waitForSelector("#title:not([hidden])");
    await phone.page.waitForFunction(() => document.documentElement.dataset.calm === "1" && !document.querySelector("#titleIntro").hidden && document.querySelector("#titleIntroVideo").paused && document.querySelector("#titleIntroAct").textContent === "Play");
    check(true, "Calm effects shows the poster and Play");
    await phone.page.click("#titleIntroAct");
    await phone.page.waitForFunction(() => { const v = document.querySelector("#titleIntroVideo"); return v && !v.paused && document.querySelector("#titleIntro").classList.contains("is-playing"); });
    check(true, "Play on the poster starts the film");
    await phone.page.click("#titleIntroAct");
    check(await phone.page.evaluate(() => document.querySelector("#titleIntro").hidden), "Skip closes the sequence");
    await sleep(400);
    await phone.page.click("#freeBtn");
    await phone.page.waitForFunction(() => document.body.dataset.screen !== "title");
    check(await phone.page.evaluate(() => document.querySelector("#titleIntro").hidden), "Go fishing leaves the sequence closed");
  } catch (e) {
    check(false, "phone: " + (e && e.stack || e));
  }
  check(phone.errors.length === 0, "phone: no page errors" + (phone.errors.length ? ":\n" + phone.errors.join("\n") : ""));
  await phone.ctx.close();

  const desk = await launch({ width: 1280, height: 800 });
  try {
    await desk.page.waitForFunction(() => { const v = document.querySelector("#titleIntroVideo"); return v && !v.paused && v.videoWidth === 1280; });
    await seek(desk.page);
    if (SHOTS) await desk.page.screenshot({ path: path.join(SHOTS, "title-intro-desktop.png") });
    const L = await desk.page.evaluate(layout);
    check(/title-landscape\.mp4/.test(L.src) && L.w === 1280 && L.h === 720 && !L.overlap && L.hit === "freeBtn", "desktop plays the horizontal film clear of the menu (" + JSON.stringify({ src: L.src, w: L.w, overlap: L.overlap, hit: L.hit }) + ")");
    await sleep(400);
    await desk.page.click("#freeBtn");
    await desk.page.waitForFunction(() => document.body.dataset.screen !== "title" && document.querySelector("#titleIntro").hidden);
    check(true, "Go fishing works while the desktop sequence is up");
  } catch (e) {
    check(false, "desktop: " + (e && e.stack || e));
  }
  check(desk.errors.length === 0, "desktop: no page errors" + (desk.errors.length ? ":\n" + desk.errors.join("\n") : ""));
  await desk.ctx.close();

  const still = await launch({ width: 390, height: 844, phone: true, reduced: true });
  try {
    await still.page.waitForFunction(() => !document.querySelector("#titleIntro").hidden && document.querySelector("#titleIntroAct").textContent === "Play");
    const L = await still.page.evaluate(layout);
    const poster = await still.page.evaluate(() => { const e = document.querySelector("#titleIntro .still-portrait"); const s = getComputedStyle(e); return s.display !== "none" && e.getBoundingClientRect().height > 40; });
    check(L.paused && !L.playing && L.act === "Play" && poster && L.hit === "freeBtn", "reduced motion shows the poster, not the film (" + JSON.stringify({ paused: L.paused, act: L.act, poster, hit: L.hit }) + ")");
    await still.page.click("#titleIntroAct");
    await still.page.waitForFunction(() => !document.querySelector("#titleIntroVideo").paused && document.querySelector("#titleIntroAct").textContent === "Skip");
    check(true, "Play starts the film under reduced motion, and the control says Skip");
  } catch (e) {
    check(false, "reduced motion: " + (e && e.stack || e));
  }
  check(still.errors.length === 0, "reduced motion: no page errors" + (still.errors.length ? ":\n" + still.errors.join("\n") : ""));
  await still.ctx.close();

  const original = await launch({ width: 390, height: 844, phone: true, art: "original" });
  try {
    await sleep(500);
    check(await original.page.evaluate(() => document.body.dataset.artStyle === "original" && document.querySelector("#titleIntro").hidden), "the Original style does not show the sequence");
  } catch (e) {
    check(false, "original: " + (e && e.stack || e));
  }
  await original.ctx.close();
} finally {
  await browser.close();
}

if (fails.length) { console.log("\n" + fails.length + " failed"); process.exit(1); }
console.log("\nall passed");
