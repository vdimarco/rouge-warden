// Checks the Corridor cabinets of Lake Brawl and Eleven Wells against openspec/changes/arcade-corridor-default.
// Serve public/ first: python3 -m http.server 8765 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/arcade/corridor-cabinets.e2e.mjs   (SHOTS=/tmp/dir saves screenshots; SIZES=390 runs one width; CHROME or CHROMIUM_PATH picks the browser)
import { createRequire } from "module";
import path from "path";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = (process.env.ARCADE_URL || "http://localhost:8765/").replace(/\/?$/, "/");
const SHOTS = process.env.SHOTS || "";
const WALK = BASE + "corridor/";
const SIZES = [
  { name: "1280", width: 1280, height: 800, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
].filter((s) => !process.env.SIZES || process.env.SIZES.split(",").includes(s.name)); // SIZES=390 runs one width
// each game, the cabinet it stands after, and what its panel says
const GAMES = [
  { id: "lake-brawl", title: "Lake Brawl", kind: "Cottage", after: "Table Tennis", medium: "WHOSE LAKE IS IT ANYWAY?", url: "/lake-brawl/" },
  { id: "eleven-wells", title: "Eleven Wells", kind: "THE LAB", after: "Orbital Gardener", medium: "FALLING BLOCKS × ELEVEN GAMES", url: "/eleven-wells/" },
];
let failures = 0;
const check = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) failures++; return ok; };

const exe = process.env.CHROME || process.env.CHROMIUM_PATH;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

const spoken = (page) => page.evaluate(() => document.querySelector("#cap-sr").textContent);
// the walk has settled on a cabinet when the caption names it and the page has stopped scrolling.
// The camera follows the scroll, and software WebGL can take a minute to carry it the length of the hall.
async function rest(page, title) {
  await page.waitForFunction((t) => document.querySelector("#cap-sr").textContent.includes(": " + t + ","), title, { timeout: 120000 }).catch(() => {});
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => scrollY);
    if (y === last) break;
    last = y;
    await page.waitForTimeout(250);
  }
}
// how many different colours the open cabinet's picture shows: flat paint has a few, key art has hundreds
async function coloursInSlot(page) {
  const box = await page.evaluate(() => { const r = document.querySelector("#slot").getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  if (box.width < 40 || box.height < 40) return 0;
  const inset = { x: box.x + box.width * 0.2, y: box.y + box.height * 0.2, width: box.width * 0.6, height: box.height * 0.6 };
  const shot = await page.screenshot({ clip: inset, timeout: 20000 }).catch(() => null);   // a busy software renderer can miss one
  if (!shot) return 0;
  const png = shot.toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3);
    return seen.size;
  }, png);
}

for (const size of SIZES) {
  console.log(size.name);
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const enter = async () => {
    await page.goto(WALK);
    await page.waitForSelector(".cr.is-ready", { timeout: 20000 });
  };
  await enter();
  check(await page.evaluate(() => !!document.querySelector(".cr-stage canvas")), "the corridor draws on a canvas");

  // the index lists both games, each after the last cabinet of its group
  const rows = await page.evaluate(() => [...document.querySelectorAll("#list button")].map((b) => ({
    n: b.querySelector(".cr-list-n").textContent, title: b.querySelector(".cr-list-b").textContent, kind: b.querySelector(".cr-list-t").textContent,
  })));
  const total = rows.length;
  check(rows.every((r, i) => Number(r.n) === i + 1), `the index numbers its ${total} cabinets 01 to ${String(total).padStart(2, "0")} with no gap`);
  check(await page.evaluate((n) => document.querySelector("#index-btn sup").textContent === String(n) && document.querySelector(".cr-cap-k").textContent.includes("/ " + n), total), `the Index control and the counter both read ${total}`);
  for (const g of GAMES) {
    const at = rows.findIndex((r) => r.title === g.title);
    g.at = at;
    check(at > 0 && rows[at].kind === g.kind && rows[at - 1].title === g.after && rows[at - 1].kind === g.kind,
      `the index lists ${g.title} under ${g.kind}, right after ${g.after} (${at >= 0 ? "number " + rows[at].n : "missing"})`);
  }
  await page.click("#index-btn");
  await page.waitForTimeout(500);
  const shown = await page.evaluate((titles) => titles.map((t) => {
    const b = [...document.querySelectorAll("#list button")].find((x) => x.querySelector(".cr-list-b").textContent === t);
    if (!b) return false;
    b.scrollIntoView({ block: "center" });
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth + 1;
  }), GAMES.map((g) => g.title));
  check(shown.every(Boolean), "both rows are on the open index, inside the screen's width");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${size.name}-index.png`) });
  await page.click("#index-btn");
  await page.waitForTimeout(400);

  for (const g of GAMES) {
    if (g.at < 0) continue;
    // walk there one cabinet at a time: forward from the entrance, or back from the far end, whichever is shorter
    await enter();
    const fromEnd = total - 1 - g.at < g.at;
    if (fromEnd) {
      // End crosses the whole hall. With reduced motion the page goes there at once. A smooth scroll that long is cut
      // short by the page's own snap when frames are slow, as they are in software WebGL.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.focus(".cr-stage");
      await page.keyboard.press("End");
      await rest(page, rows[total - 1].title);
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
    const steps = fromEnd ? total - 1 - g.at : g.at;
    for (let i = 1; i <= steps; i++) {
      await page.click(fromEnd ? "#step-prev" : "#step-next");
      await rest(page, rows[fromEnd ? total - 1 - i : i].title);
    }
    const said = await spoken(page);
    check(said.startsWith(`Cabinet ${g.at + 1} of ${total}: ${g.title}, ${g.kind}`), `${steps} steps ${fromEnd ? "back from the far end" : "from the entrance"} reach ${g.title} (${said})`);
    const cap = await page.evaluate(() => { const c = document.querySelector(".cr-cap-item.is-cur"); return c ? c.querySelector("h2").textContent : ""; });
    check(cap === g.title, `the caption reads ${g.title}`);
    await page.waitForTimeout(1200);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${size.name}-${g.id}-walk.png`) });

    // open the cabinet in front
    await page.focus(".cr-stage");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#case.is-open", { timeout: 5000 }).catch(() => {});
    // the picture lifts off the marquee; software WebGL takes a few seconds to bring it over
    let colours = 0;
    for (let i = 0; i < 8 && colours < 150; i++) {
      await page.waitForTimeout(3000);
      colours = await coloursInSlot(page);
    }
    await page.waitForTimeout(SHOTS ? 6000 : 0);
    const panel = await page.evaluate(() => {
      const cta = document.querySelector("#cta"), r = cta.getBoundingClientRect();
      return {
        open: document.querySelector("#case").classList.contains("is-open"),
        title: document.querySelector("#cr-case-title").textContent, k: document.querySelector("#p-k").textContent,
        medium: document.querySelector("#p-medium").textContent, text: document.querySelector("#p-p").textContent,
        href: cta.getAttribute("href"), w: r.width, h: r.height, inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        wide: document.documentElement.scrollWidth > innerWidth,
      };
    });
    check(panel.open && panel.title === g.title && panel.k.includes(g.kind) && panel.medium === g.medium && panel.text.length > 20, `the panel names ${g.title} (${panel.k} · ${panel.medium})`);
    check(panel.href === g.url, `Insert coin · Play points at ${g.url} on this site (${panel.href})`);
    check(panel.inView && panel.h >= 44 && panel.w >= 44, `Insert coin · Play is on screen and ${Math.round(panel.w)}x${Math.round(panel.h)}`);
    check(!panel.wide, "the open cabinet has no sideways scroll");
    check(colours >= 150, `the panel shows the game's art (${colours} colours in the picture)`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${size.name}-${g.id}-panel.png`) });

    await page.click("#cta");
    await page.waitForURL(BASE + g.url.slice(1), { timeout: 15000 }).catch(() => {});
    check(page.url() === BASE + g.url.slice(1), `Insert coin · Play opens ${g.url}`);
  }
  check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  await ctx.close();
}
await browser.close();
console.log(failures ? failures + " failed" : "all passed");
process.exit(failures ? 1 : 0);
