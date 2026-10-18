// Checks that every game has a machine in the arcade: node qa/arcade/machines.mjs
// Serve public/ first (for example: cd public && python3 -m http.server 8765), or set ARCADE_URL to the address of the same tree.
// Needs Playwright (NODE_PATH=$(npm root -g)). The games are never loaded: the test stops each page change and reads where it was going.
// Exit code 1 on failure.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUB = path.join(ROOT, "public");
const BASE = (process.env.ARCADE_URL || "http://localhost:8765/").replace(/\/?$/, "/");
const GTA_URL = "/gta/";
const SHOTS = process.env.SHOTS || ""; // a folder for screenshots; none are taken without it
const PARTS = (process.env.PARTS || "gta,walk,layout,marquee,switcher,saves,credits,focus,backlinks").split(","); // run only some of the browser parts while you work on the page
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const fails = [];
setTimeout(() => { console.log("  FAIL the run did not finish in 30 minutes"); process.exit(1); }, 30 * 60 * 1000).unref();
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); return ok; };

/* ---------------- what is a game ---------------- */
// Folders of public/ that are not games, each with the reason.
const NOT_GAMES = {
  arcade: "the art on the machines, the game switcher, and the creature viewer (a tool)",
  icons: "the site's icons",
  fonts: "self-hosted faces for the arcade home (Press Start 2P, Monoton, Bungee)",
  lib: "shared libraries",
  ".well-known": "files that app stores read",
};
// Games that have no machine of their own, each with the reason. "coveredBy" names the machine that stands in for it.
const ALLOW = {
  breakthrough: { reason: "the older build of BREAKTHROUGH; its machine opens /breakthrough2/ and this page stays only as a copy (openspec/changes/breakthrough-cabinet-current)", coveredBy: "/breakthrough2/" },
  tennis: { reason: "Lawn Tennis stays on disk, but its Cottage cabinet and switcher entry are now Table Tennis at /pingpong/", coveredBy: "/pingpong/" },
};
// The lab keeps its toys in sub-folders, and each toy with a page is a game. Sub-folders that are not:
const LAB_NOT_GAMES = {
  kit: "the code the toys share; it has no page",
};

const games = []; // { url, dir }: every game page found
const dirs = fs.readdirSync(PUB, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
for (const d of dirs) {
  if (NOT_GAMES[d]) continue;
  const page = fs.existsSync(path.join(PUB, d, "index.html"));
  if (!check(page, `public/${d}/ has an index.html (a folder with no page must be listed in NOT_GAMES with a reason)`)) continue;
  games.push({ url: `/${d}/`, dir: d });
}
for (const d of fs.readdirSync(path.join(PUB, "lab"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
  if (LAB_NOT_GAMES[d]) continue;
  const page = fs.existsSync(path.join(PUB, "lab", d, "index.html"));
  if (!check(page, `public/lab/${d}/ has an index.html (a folder with no page must be listed in LAB_NOT_GAMES with a reason)`)) continue;
  games.push({ url: `/lab/${d}/`, dir: `lab/${d}` });
}
check(games.length >= 10, `found ${games.length} game pages in public/`);

// an allow-list entry must still point at a real folder and a real machine, or it hides nothing and rots
for (const [d, a] of Object.entries(ALLOW)) check(fs.existsSync(path.join(PUB, d, "index.html")), `allow-list: public/${d}/ still exists (${a.reason})`);

/* ---------------- the files ---------------- */
const html = read("public/index.html");
const sw = read("public/arcade/switch.js");
const machineUrls = [...html.matchAll(/<article class="cab[^"]*"[^>]*data-url="([^"]+)"/g)].map((m) => m[1]);
const switchUrls = [...sw.slice(sw.indexOf("const GAMES")).split("];")[0].matchAll(/"?url"?:\s*"([^"]+)"/g)].map((m) => m[1]);
const switchIds = [...sw.slice(sw.indexOf("const GAMES")).split("];")[0].matchAll(/"?id"?:\s*"([^"]+)"/g)].map((m) => m[1]);
const switchArt = [...sw.slice(sw.indexOf("const GAMES")).split("];")[0].matchAll(/"?art"?:\s*"([^"]+)"/g)].map((m) => m[1]);

for (const g of games) {
  const allowed = ALLOW[g.dir];
  if (allowed) {
    check(machineUrls.includes(allowed.coveredBy), `${g.url} has no machine, and ${allowed.coveredBy} stands in for it`);
    continue;
  }
  check(machineUrls.includes(g.url), `${g.url} has a machine in public/index.html (.cab[data-url="${g.url}"])`);
  check(switchUrls.includes(g.url), `${g.url} is listed in public/arcade/switch.js GAMES`);
}
// the other way round: a machine or a switcher entry must point at a page that is there
for (const u of new Set([...machineUrls, ...switchUrls])) {
  const f = path.join(PUB, u.replace(/^\//, ""), "index.html");
  check(fs.existsSync(f), `${u} (machine or switcher entry) opens a real page`);
}
check(new Set(machineUrls).size === machineUrls.length, "no two machines open the same address");
check(new Set(switchIds).size === switchIds.length, "switch.js GAMES has no repeated id");
for (const u of machineUrls) check(switchUrls.includes(u), `machine ${u} is in switch.js, so every game menu can jump to it`);
for (const u of switchUrls) check(machineUrls.includes(u), `switch.js entry ${u} has a machine`);

// a machine and its switcher entry must be the same game: the same id and the same name. A swapped address or a game that was
// renamed on one side only fails here, and the walk below could not see it (it trusts each machine's own address).
{
  const gamesText = sw.slice(sw.indexOf("const GAMES")).split("];")[0];
  const entries = [...gamesText.matchAll(/\{\s*"?id"?:\s*"([^"]+)",\s*"?name"?:\s*"([^"]+)"[^\n]*?"?url"?:\s*"([^"]+)"/g)].map((m) => ({ id: m[1], name: m[2], url: m[3] }));
  const norm = (t) => t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").trim().toLowerCase();
  let matched = 0;
  for (const m of html.matchAll(/<article class="cab[^"]*"[^>]*?data-game="([^"]+)"[^>]*?data-url="([^"]+)"[\s\S]*?<div class="marquee">[\s\S]*?<b>([^<]*)<\/b>/g)) {
    matched++;
    const [, game, url, title] = m, e = entries.find((x) => x.url === url);
    if (!e) continue; // the check above already reports a missing entry
    check(e.id === game, `machine ${url} (data-game "${game}") and its switcher entry (id "${e.id}") have the same id`);
    check(norm(e.name) === norm(title), `machine ${url} is called "${title}" and its switcher entry is called "${e.name}"`);
  }
  check(matched === machineUrls.length, `the id and name check saw ${matched} of ${machineUrls.length} machines (an article needs data-game, then data-url, then a marquee <b>)`);
}

// the art: every picture in a machine and in the switcher exists, and the pictures this change added stay small
const imgs = [...html.matchAll(/<article class="cab[\s\S]*?<\/article>/g)].flatMap((m) => [...m[0].matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((x) => x[1]));
for (const src of new Set([...imgs, ...switchArt])) {
  const f = path.join(PUB, src.replace(/^\//, ""));
  check(fs.existsSync(f) && fs.statSync(f).size > 0, `picture ${src} exists`);
}
for (const f of fs.readdirSync(path.join(PUB, "arcade")).filter((n) => /^(lab|worlds|neon|echo|tellme|plunge|creek|tilt|rules|olympus|moonwell|breakthrough|follow-suit|river-rush)\.webp$/.test(n))) {
  const b = fs.readFileSync(path.join(PUB, "arcade", f));
  check(b.length < 60 * 1024 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP", `arcade/${f} is a WebP under 60 KB (${(b.length / 1024).toFixed(1)} KB)`);
}
// Ahead of the Light's and Light Years Home's screens are cut from real screenshots of the game in play: WebPs 480 px wide and under 60 KB
for (const id of ["ahead-of-the-light", "light-years-home"]) {
  const f = path.join(PUB, "arcade/key", id + ".webp");
  const b = fs.existsSync(f) ? fs.readFileSync(f) : Buffer.alloc(32);
  const vp8x = b.toString("latin1", 12, 16) === "VP8X", w = vp8x ? 1 + b.readUIntLE(24, 3) : b.toString("latin1", 12, 16) === "VP8 " ? b.readUInt16LE(26) & 0x3fff : 1 + (b.readUInt32LE(21) & 0x3fff);
  check(b.length < 60 * 1024 && b.toString("latin1", 8, 12) === "WEBP" && w === 480, `arcade/key/${id}.webp is a WebP 480 px wide under 60 KB (${w} px, ${(b.length / 1024).toFixed(1)} KB)`);
}
// the painted art from Higgsfield (higgsfield/arcade-key-art.json): one WebP for each entry, each under 100 KB
for (const { id } of JSON.parse(read("higgsfield/arcade-key-art.json")).art) {
  const f = path.join(PUB, "arcade", "key", id + ".webp");
  const b = fs.existsSync(f) ? fs.readFileSync(f) : Buffer.alloc(0);
  check(b.length > 0 && b.length < 100 * 1024 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP", `arcade/key/${id}.webp is a WebP under 100 KB (${(b.length / 1024).toFixed(1)} KB)`);
}
// the arcade page opens the same grid as ALL GAMES
check(/<button[^>]*class="all-games"[^>]*data-switch/.test(html) && html.includes('<script src="/arcade/switch.js"></script>'), "the arcade page has an ALL GAMES button that opens the game grid");
check(/<button[^>]*data-section="gta"[^>]*>GTA<\/button>/.test(html) && /id: "gta", label: "GTA", games: \["gta"\]/.test(html), "GTA has a collection button and its Montréal cabinet in the picker group");
check(/^\s*<script src="\/arcade\/quiet\.js"><\/script>/m.test(html.slice(html.indexOf("<head>"), html.indexOf("</head>"))) && html.indexOf("/arcade/quiet.js") < html.search(/<script(?![^>]*quiet)/), "quiet.js is the first script on the arcade page");

/* ---------------- the page ---------------- */
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { check(false, "Playwright is not found (set NODE_PATH=$(npm root -g))"); finish(); }
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

// a new page with the errors collected. The only thing allowed to fail to load is the Google font.
async function open(browser, { width, height, store = {}, mobile = width < 800, machines = true }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const errors = [], moves = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && !/fonts\.g/.test(r.url())) errors.push(r.status() + " " + r.url()); });
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
  // This static routing suite has no Vercel API; use valid empty activity without hiding unexpected responses.
  await page.route(new URL("/api/arcade-leaderboard", BASE).href, (r) => r.fulfill({ json: { source: "posthog", days: 30, updatedAt: "2026-10-10T00:00:00Z", games: {} } }));
  // a page change to a game is stopped and noted; the arcade stays where it is
  await page.route((u) => u.origin === new URL(BASE).origin && u.pathname !== new URL(BASE).pathname && /\/$/.test(u.pathname), (r) => {
    if (r.request().isNavigationRequest()) { const u = new URL(r.request().url()); moves.push(u.pathname + u.hash); r.abort("aborted"); } else r.continue();
  });
  await page.addInitScript((store) => { try { localStorage.clear(); for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v); } catch (e) { /* storage off */ } }, { "arcade.tokens": "99", "arcade.sound": "false", ...store });
  // ?machines is Old arcade: the machines, without All Games over them; machines: false opens the default All Games scoreboard
  await page.goto(machines ? BASE + "?machines" : BASE);
  await page.waitForSelector(machines ? ".cab.on" : ".scoreboard .board-launch");
  await page.waitForTimeout(600);
  return { ctx, page, errors, moves };
}
// the row slides for about half a second after a pick: wait until every move on the page has ended and two frames have been drawn
// (a slow computer draws few frames, so a position read in between would be old)
async function settle(page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter((a) => isFinite(a.effect.getComputedTiming().endTime)).map((a) => a.finished.catch(() => {})));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}
// the row shows the hall (one cabinet per group) or one group's machines; a selection is counted among the cabinets on show
const SHOWN = ".cab:not([hidden])";
const sel = (page) => page.evaluate((q) => [...document.querySelectorAll(q)].findIndex((c) => c.classList.contains("on")), SHOWN);
// open a group the way its address does
async function enter(page, id) { await page.evaluate((id) => { location.hash = id; }, id); await page.waitForFunction((id) => location.hash === "#" + id && !document.querySelector("#backBtn").hidden, id); await settle(page); }

if (chromium) {
  let browser = await chromium.launch({ args: ARGS, executablePath: process.env.CHROMIUM_PATH || undefined });
  // a fresh browser for each part: a headless browser with a software GPU slows down over a long run and can stop answering mouse moves
  const relaunch = async () => { await browser.close().catch(() => {}); browser = await chromium.launch({ args: ARGS, executablePath: process.env.CHROMIUM_PATH || undefined }); };

  /* ----- the Montréal cabinet: collection, artwork, pointer and keyboard launch ----- */
  for (const vp of PARTS.includes("gta") ? [{ width: 390, height: 844 }, { width: 1280, height: 720 }] : []) {
    const tag = `${vp.width}x${vp.height}`;
    const { ctx, page, errors, moves } = await open(browser, { ...vp, machines: false });
    check(page.url() === BASE && await page.title() === "Cottage Arcade" && await page.locator(".sign h1").innerText() === "COTTAGE ARCADE", `${tag}: the arcade identity and heading render before choosing GTA`);
    const defaultTile = page.locator(`.scoreboard .board-launch[href="${GTA_URL}"]`);
    check(await page.locator(".scoreboard").isVisible() && await defaultTile.locator("b").textContent() === "GTA Montréal", `${tag}: the default scoreboard contains the GTA Montréal launch link`);
    await defaultTile.click();
    const until = Date.now() + 6000;
    while (!moves.length && Date.now() < until) await page.waitForTimeout(50);
    check(moves.length === 1 && moves[0] === GTA_URL, `${tag}: clicking GTA in the default scoreboard launches its same-origin title page`);
    await page.locator(".scoreboard .machines-link").click();
    check(!await page.locator(".scoreboard").isVisible(), `${tag}: Old arcade exposes the cabinets`);
    await page.locator('[data-section="gta"]').click();
    await settle(page);
    const cabinet = await page.locator('.cab.gta').evaluate((c) => {
      const r = c.getBoundingClientRect(), img = c.querySelector("img");
      return { selected: c.classList.contains("on"), loaded: img.complete && img.naturalWidth > 0, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, group: document.querySelector("#machinePicker option:checked").parentElement.label };
    });
    check(cabinet.selected && cabinet.loaded && cabinet.inside && cabinet.group === "GTA", `${tag}: GTA selects the Montréal cabinet, its icon loads, and it fits the viewport in the GTA picker group`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `gta-${tag}-cabinet.png`) });
    for (const method of ["cabinet click", "5 + Enter", "All Games + Enter"]) {
      moves.length = 0;
      await page.evaluate(() => document.activeElement?.blur());
      if (method === "cabinet click") await page.locator('.cab.gta .marquee').click();
      else if (method === "5 + Enter") {
        await page.keyboard.press("5");
        await page.waitForFunction(() => document.querySelector('.cab.gta .credit').textContent === "CREDIT 1");
        await page.keyboard.press("Enter");
      } else {
        await page.locator("[data-switch]").click();
        const tile = page.locator(`.gsw .board-launch[href="${GTA_URL}"]`);
        await tile.focus();
        check(await tile.locator("b").textContent() === "GTA Montréal", `${tag}: All Games names the same Montréal game`);
        await page.keyboard.press("Enter");
      }
      const until = Date.now() + 6000;
      while (!moves.length && Date.now() < until) await page.waitForTimeout(50);
      check(moves.length === 1 && moves[0] === GTA_URL, `${tag}: ${method} launches the same-origin GTA Montréal title page`);
      await page.evaluate(() => { document.querySelectorAll(".boot").forEach((b) => b.remove()); GameSwitch.close(); });
    }
    check(errors.length === 0, `${tag}: Montréal cabinet causes no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
    await ctx.close();
  }

  await relaunch();
  /* ----- walk to every machine, put a token in, start it, and see where it goes ----- */
  // four ways to play, so each machine is tried in more than one way across the two sizes
  const METHODS = ["drag a token, press START", "key 5, key 1", "key 5, Enter", "tap a slot, press START"];
  for (const vp of PARTS.includes("walk") ? [{ width: 390, height: 844 }, { width: 1280, height: 720 }] : []) {
    const tag = `${vp.width}x${vp.height}`;
    const { ctx, page, errors, moves } = await open(browser, vp);
    const names = await page.$$eval(".cab[data-game]", (cs) => cs.map((c) => ({ game: c.dataset.game, url: c.dataset.url, name: c.querySelector(".marquee b").textContent })));
    check(names.length === machineUrls.length, `${tag}: the page has ${names.length} machines (the file has ${machineUrls.length})`);
    const opts = await page.$$eval("#machinePicker option", (os) => os.map((o) => o.value).filter((v) => v !== "hall").sort());
    check(opts.length === names.length && opts.join() === names.map((m) => m.game).sort().join(), `${tag}: the machine picker lists every machine once`);
    const groups = await page.$$eval(".cab[data-opens]", (cs) => cs.map((c) => c.dataset.opens));
    check(await sel(page) === 0 && groups.length > 1, `${tag}: the arcade opens on the hall of ${groups.length} groups, the first selected`);
    // walk the hall with the arrows; in each group, step through its machines with the next arrow, then go back
    const reached = [];
    let i = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      if (!check(await sel(page) === gi, `${tag}: the arrows in the hall reach the ${groups[gi]} group`)) break;
      await page.keyboard.press("1");
      await settle(page);
      const members = await page.$$eval(".cab[data-game]:not([hidden])", (cs) => cs.map((c) => c.dataset.game));
      check(members.length > 0 && !(await page.$(".cab[data-opens]:not([hidden])")), `${tag}: playing the ${groups[gi]} cabinet opens its ${members.length} machines`);
      for (let k = 0; k < members.length; k++, i++) {
        const m = names.find((x) => x.game === members[k]);
        const at = await sel(page);
        if (at !== k) { check(false, `${tag}: arrow ${k} in ${groups[gi]} selects ${m.game} (selected ${at})`); break; }
        const method = (i + (vp.width === 390 ? 0 : 1)) % METHODS.length;
        const tokens0 = Number(await page.textContent("#count"));
        const credit = () => page.evaluate((g) => { const c = document.querySelector('.cab[data-game="' + g + '"]'); return c.querySelector(".credit").textContent + "|" + c.querySelector(".press").textContent; }, m.game);
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        if (method === 0) {
          const a = await page.locator(".stack .token").last().boundingBox();
          const b = await page.locator(".cab.on .slot i").first().boundingBox();
          await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
          await page.mouse.down();
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
          await page.mouse.up();
        } else if (method === 3) await page.locator(".cab.on .slot").first().click();
        else await page.keyboard.press("5");
        try { await page.waitForFunction((g) => /CREDIT 1/.test(document.querySelector('.cab[data-game="' + g + '"] .credit').textContent), m.game, { timeout: 4000 }); } catch (e) { /* reported below */ }
        const c1 = await credit();
        const tokens1 = Number(await page.textContent("#count"));
        const lit = await page.evaluate((g) => document.querySelector('.cab[data-game="' + g + '"]').classList.contains("credit"), m.game);
        const ok1 = c1 === "CREDIT 1|PRESS START" && tokens1 === tokens0 - 1 && lit;
        if (SHOTS && k === members.length - 1) await page.screenshot({ path: path.join(SHOTS, `machines-${tag}-${m.game}-credit.png`) });
        moves.length = 0;
        if (method === 1) await page.keyboard.press("1");
        else if (method === 2) await page.keyboard.press("Enter");
        else await page.locator(".cab.on .start").click();
        try { await page.waitForFunction(() => document.querySelector(".boot"), null, { timeout: 2000 }); } catch (e) { /* the power-on may be too quick to catch */ }
        const t0 = Date.now();
        while (!moves.length && Date.now() - t0 < 6000) await page.waitForTimeout(50);
        const credit0 = await credit();
        check(ok1 && moves.length === 1 && moves[0].replace(/#.*$/, "") === m.url && credit0 === "CREDIT 0|INSERT COIN",
          `${tag}: ${m.name} (${METHODS[method]}): the token goes in (${c1}, tokens ${tokens0} to ${tokens1}), START goes to ${m.url} (went to ${moves.join(",") || "nowhere"})`);
        reached.push(m.url);
        await page.evaluate(() => document.querySelectorAll(".boot").forEach((b) => b.remove()));
        await page.locator("#nextBtn").click();
        await page.waitForTimeout(60);
        await settle(page);
      }
      check(await sel(page) === 0, `${tag}: in ${groups[gi]} the next arrow after the last machine comes back to the first`);
      await page.keyboard.press("Escape");
      await settle(page);
      check(await sel(page) === gi && !!(await page.$(`.cab.on[data-opens="${groups[gi]}"]`)), `${tag}: Escape goes back to the hall with ${groups[gi]} selected`);
      await page.locator("#nextBtn").click();
      await page.waitForTimeout(60);
      await settle(page);
    }
    // every game with a machine was reached by the arrows
    for (const g of games) if (!ALLOW[g.dir]) check(reached.includes(g.url), `${tag}: the arrows reach the machine for ${g.url}`);
    check(errors.length === 0, `${tag}: no page errors${errors.length ? ":\n    " + errors.join("\n    ") : ""}`);
    await ctx.close();
  }

  await relaunch();
  /* ----- the last machine by keyboard and by swipe, and the layout at the sizes people use ----- */
  const SIZES = [[360, 740], [390, 844], [430, 932], [375, 667], [768, 1024], [1280, 720], [1920, 1080]];
  for (const [width, height] of PARTS.includes("layout") ? SIZES : []) {
    // Each swipe-heavy size gets a fresh software GPU, as do the larger test parts.
    await relaunch();
    const { ctx, page, errors } = await open(browser, { width, height });
    // the hall first, then the group with the most machines
    const biggest = await page.$$eval(".cab[data-opens]", (cs) => cs.map((c) => [c.dataset.opens, Number(c.querySelector(".marquee small").textContent.match(/\d+/)[0])]).sort((a, b) => b[1] - a[1])[0][0]);
    for (const where of ["hall", biggest]) {
    if (where !== "hall") await enter(page, where);
    const tag = `${width}x${height} ${where}`;
    const n = await page.$$eval(SHOWN, (cs) => cs.length);
    // the hall and each group open on their first cabinet
    check(await sel(page) === 0, `${tag}: opens on the first cabinet`);
    await page.keyboard.press("ArrowLeft"); await settle(page);
    check(await sel(page) === n - 1, `${tag}: the left key from the first machine wraps to the last (${n - 1})`);
    const box = await page.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const cab = document.querySelector(".cab.on");
      return { cab: r(cab), stage: r(document.querySelector("#stage")), tray: r(document.querySelector(".tray")), sign: r(document.querySelector(".sign")), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight };
    });
    const inside = box.cab.l >= -1 && box.cab.r <= box.vw + 1;
    check(inside, `${tag}: the last machine sits inside the window (${Math.round(box.cab.l)} to ${Math.round(box.cab.r)} of ${box.vw})`);
    check(box.cab.b <= box.tray.t + 2 && box.cab.t >= box.sign.b - 2, `${tag}: the last machine is not under the sign or the token tray (machine ${Math.round(box.cab.t)} to ${Math.round(box.cab.b)}, sign ends ${Math.round(box.sign.b)}, tray starts ${Math.round(box.tray.t)})`);
    check(box.sw <= box.vw && box.sh <= box.vh, `${tag}: the page does not scroll (${box.sw}x${box.sh} in ${box.vw}x${box.vh})`);
    // the machines next to it do not overlap it
    const over = await page.evaluate(() => {
      const on = document.querySelector(".cab.on").getBoundingClientRect();
      return [...document.querySelectorAll(".cab:not(.on):not([hidden])")].filter((c) => { const b = c.getBoundingClientRect(); return b.right > on.left + 2 && b.left < on.right - 2; }).length;
    });
    check(over === 0, `${tag}: no machine overlaps the chosen one`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `machines-${tag}-last.png`) });
    // by swipe (a finger on a phone, the mouse on a computer) from the first machine to the last.
    // The hall's few cabinets fit side by side on a big screen, and there the mouse picks by pointing, not by swiping.
    if (await page.evaluate(() => document.querySelector("#stage").classList.contains("slide"))) {
      await page.keyboard.press("ArrowRight"); await settle(page);
      check(await sel(page) === 0, `${tag}: the right key goes back to the first machine`);
      const y = Math.round(box.stage.t + (box.stage.b - box.stage.t) * 0.25);
      for (let k = 0; k < n + 1; k++) {
        await page.mouse.move(width * 0.85, y);
        await page.mouse.down();
        await page.mouse.move(width * 0.15, y, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(60);
      }
      check(await sel(page) === n - 1, `${tag}: ${n + 1} swipes left end on the last machine, and do not go past it (${await sel(page)})`);
    }
    // the machine list under the machines (inside a group), and the scroll wheel
    if (where !== "hall") {
      const ids = await page.$$eval(".cab[data-game]:not([hidden])", (cs) => cs.map((c) => c.dataset.game));
      await page.selectOption("#machinePicker", ids[0]); await settle(page);
      const first = await sel(page);
      await page.selectOption("#machinePicker", ids[n - 1]); await settle(page);
      check(first === 0 && await sel(page) === n - 1, `${tag}: the machine list goes to the first machine and to the last`);
    }
    await page.keyboard.press("ArrowRight"); await settle(page);
    await page.mouse.move(width / 2, box.stage.t + 40); await settle(page);
    // pointing at a machine may choose it (where the row does not slide): count the flick from there
    const before = await sel(page);
    await page.mouse.wheel(0, 120); await page.waitForTimeout(400); await settle(page);
    check(await sel(page) === (before + 1) % n, `${tag}: one flick of the scroll wheel moves one machine`);
    }
    check(errors.length === 0, `${width}x${height}: no page errors${errors.length ? ":\n    " + errors.join("\n    ") : ""}`);
    await ctx.close();
  }

  await relaunch();
  /* ----- the two newest machines: the title and the sub line fit on the marquee, on a computer and on phones ----- */
  // The marquee is a box 13 % of the machine's height that hides what spills out, and its type stops shrinking at 12 px. At
  // 320 x 700 (or 375 x 667) the machine is about 122 x 265 and the box 112 x 34: room for the title on two lines and a sub
  // line of 8 characters. Wider, the title takes one line. In a shorter window (360 x 640 or 800 x 600: a machine about
  // 235 px tall, a box 99 x 30) the sub line is hidden and the title shows whole on two lines. Each size: the most title
  // lines, and whether the sub line shows.
  const MARQUEE = [[1280, 720, 1, true], [1280, 800, 1, true], [390, 844, 1, true], [360, 740, 2, true], [375, 667, 2, true], [320, 700, 2, true],
    [360, 640, 2, false], [800, 600, 2, false]];
  for (const [width, height, most, sub] of PARTS.includes("marquee") ? MARQUEE : []) {
    const tag = `${width}x${height}`;
    const { ctx, page, errors } = await open(browser, { width, height });
    await page.evaluate(() => document.fonts.ready);
    for (const id of ["light-years-home", "ahead-of-the-light"]) {
      await page.selectOption("#machinePicker", id);
      await page.waitForFunction((id) => document.querySelector(".cab.on")?.dataset.game === id, id);
      await settle(page);
      const f = await page.evaluate((id) => {
        const m = document.querySelector(`.cab[data-game="${id}"] .marquee`), box = m.getBoundingClientRect(), block = m.firstElementChild.getBoundingClientRect();
        const lines = (el) => { const r = document.createRange(); r.selectNodeContents(el); return [...r.getClientRects()]; };
        const t = lines(m.querySelector("b")), s = lines(m.querySelector("small"));
        const rows = (rs) => new Set(rs.map((r) => Math.round(r.top))).size;
        // a line wider than the box is cut at its sides; lines that stack taller than the box are cut at its top and bottom
        const sides = Math.max(0, ...[...t, ...s].map((r) => Math.max(box.left - r.left, r.right - box.right)));
        const ends = Math.max(0, box.top - block.top, block.bottom - box.bottom);
        // the machine itself: inside the window, below the sign and above the token tray
        const r = (q) => document.querySelector(q).getBoundingClientRect(), cab = r(".cab.on"), sign = r(".sign"), tray = r(".tray");
        const whole = cab.left >= -1 && cab.right <= innerWidth + 1 && cab.top >= sign.bottom - 2 && cab.bottom <= tray.top + 2;
        return { title: m.querySelector("b").textContent, sub: m.querySelector("small").textContent, titleRows: rows(t), subRows: rows(s), sides, ends, w: Math.round(box.width), h: Math.round(box.height),
          whole, at: `${Math.round(cab.left)} to ${Math.round(cab.right)} of ${innerWidth}, ${Math.round(cab.top)} to ${Math.round(cab.bottom)} between ${Math.round(sign.bottom)} and ${Math.round(tray.top)}` };
      }, id);
      check(f.whole, `${tag}: ${id}'s machine shows whole, not under the sign or the token tray (${f.at})`);
      const want = `${most === 1 ? "1 line" : "1 or 2 lines"}, ${sub ? "the sub line on 1" : "no sub line"}`;
      check(f.sides <= 0.5 && f.ends <= 0.5 && f.titleRows >= 1 && f.titleRows <= most && f.subRows === (sub ? 1 : 0), `${tag}: ${id}'s marquee (${f.w}x${f.h}) shows ${f.title} on ${f.titleRows} line${f.titleRows > 1 ? "s" : ""} and ${f.sub} on ${f.subRows} (want ${want}), and spills ${f.sides.toFixed(1)} px past its sides and ${f.ends.toFixed(1)} px past its top and bottom (want 0)`);
      if (SHOTS) await page.locator(`.cab[data-game="${id}"] .marquee`).screenshot({ path: path.join(SHOTS, `marquee-${tag}-${id}.png`) });
    }
    check(errors.length === 0, `${tag}: the marquees cause no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
    await ctx.close();
  }

  await relaunch();
  /* ----- the game switcher: all games, the right one marked, tiles you can tap, and the exits in reach ----- */
  for (const [width, height] of PARTS.includes("switcher") ? [[360, 740], [1280, 720]] : []) {
    const tag = `${width}x${height}`;
    const { ctx, page, errors } = await open(browser, { width, height });
    // the page answers to a game's address, so the switcher can work out where it is
    const here = { "/gta/": "GTA Montréal", "/lab/": "The Lab", "/lab/worlds/": "Small Worlds", "/lab/plunge/": "Take the Plunge", "/lab/rules/": "House Rules", "/fall/": "Down the Drain", "/breakthrough2/": "Breakthrough", "/echo/": "Loon Echo", "/olympus/x": "Olympus", "/light-years-home/": "Light Years Home", "/ahead-of-the-light/": "Ahead of the Light" };
    for (const [p, name] of Object.entries(here)) {
      await page.evaluate(async (p) => { history.replaceState({}, "", p); GameSwitch.close(); await GameSwitch.open(); }, p);
      await page.waitForSelector(".gsw-game");
      const marked = await page.$$eval(".gsw-game.here b", (bs) => bs.map((b) => b.textContent));
      check(marked.length === 1 && marked[0] === name, `${tag}: on ${p} the switcher marks ${name} (marked: ${marked.join(", ") || "none"})`);
    }
    await page.evaluate(async () => { history.replaceState({}, "", "/"); GameSwitch.close(); await GameSwitch.open(); });
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const box = document.querySelector(".gsw:not([hidden])"), tiles = [...box.querySelectorAll(".gsw-game")], links = tiles.map((t) => t.matches("a") ? t : t.querySelector("a.board-launch")), controls = box.querySelector(".gsw-row, .board-head").getBoundingClientRect();
      return { n: tiles.length, hrefs: links.map((a) => a.getAttribute("href")), small: links.filter((a) => { const r = a.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length, scrolls: box.scrollHeight > box.clientHeight, controlsIn: controls.top >= 0 && controls.bottom <= innerHeight + 1, vh: innerHeight };
    });
    check(info.n === switchUrls.length && switchUrls.every((u) => info.hrefs.includes(u) || u === "/wild/"), `${tag}: the switcher shows a tile for each of the ${switchUrls.length} games (${info.n})`);
    check(info.small === 0, `${tag}: every tile is at least 44 pixels each way`);
    check(info.controlsIn, `${tag}: switcher navigation controls stay in the window while the list is at the top`);
    check(info.scrolls || width > 800, `${tag}: a long list scrolls`);
    await page.evaluate(() => { const b = document.querySelector(".gsw"); b.scrollTop = b.scrollHeight; });
    await page.waitForTimeout(600);
    const end = await page.evaluate(() => { const box = document.querySelector(".gsw:not([hidden])"), last = [...box.querySelectorAll(".gsw-game")].pop().getBoundingClientRect(), controls = box.querySelector(".gsw-row, .board-head"), row = controls.getBoundingClientRect(); return { lastTop: last.top, lastBottom: last.bottom, controlsTop: row.top, controlsBottom: row.bottom, header: controls.matches(".board-head"), vh: innerHeight }; });
    check(end.controlsTop >= 0 && end.controlsBottom <= end.vh + 1 && (end.header ? end.lastTop >= end.controlsBottom - 1 && end.lastBottom <= end.vh + 1 : end.lastBottom <= end.controlsTop + 1), `${tag}: at the end of the list the last tile is clear of the navigation controls and inside the viewport`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `switcher-${tag}-end.png`) });
    check(errors.length === 0, `${tag}: the switcher causes no page errors${errors.length ? ":\n    " + errors.join("\n    ") : ""}`);
    await ctx.close();
  }

  await relaunch();
  /* ----- the high-score lines: a game's own save shows, and junk never throws ----- */
  const JUNK = ["not json", "null", "[]", "{}", "[1,2]", "-5", "0", "1e999", "\"x\"", "{\"best\":\"x\",\"ms\":[],\"runs\":{}}", "true"];
  const KEYS = ["primordia.best", "neon-best", "loon-echo-rescue-best", "tilt.voyage.best", "lab.stats.plunge", "lab.stats.creek", "lab.stats.rules", "lab.rules.clears", "small-worlds-best-threadwake", "small-worlds-best-heartship", "follow-suit:best-chain", "moonwell.best.v1", "ahead-of-the-light.meta.v1", "light-years-home.v3.save"];
  const lines = (page) => page.$$eval(".cab[data-game]", (cs) => Object.fromEntries(cs.map((c) => [c.dataset.game, c.querySelector(".hi").textContent])));
  // the machines that wear a gold frame (Ahead of the Light's last log unlock)
  const framed = (page) => page.$$eval(".cab.gold", (cs) => cs.map((c) => c.dataset.game));
  // an Ahead of the Light meta save with this best run
  const aotl = (best, pages, more = {}) => ({ "ahead-of-the-light.meta.v1": JSON.stringify({ v: 1, pages, records: { best }, ...more }) });
  if (PARTS.includes("saves")) {
    const clean = await open(browser, { width: 390, height: 844 });
    const plain = await lines(clean.page);
    await clean.ctx.close();
    for (const junk of JUNK) {
      const { ctx, page, errors } = await open(browser, { width: 390, height: 844, store: Object.fromEntries(KEYS.map((k) => [k, junk])) });
      const got = await lines(page), gold = await framed(page);
      const same = Object.keys(plain).filter((g) => got[g] !== plain[g]);
      // "0", "-5" and the like are not scores; "1e999" is not a finite number; none may change a line or put on a frame
      check(errors.length === 0 && same.length === 0 && gold.length === 0, `junk save ${JSON.stringify(junk)}: no error, and the lines stay plain${same.length ? " (changed: " + same.map((g) => g + " -> " + got[g]).join("; ") + ")" : ""}${gold.length ? " (framed: " + gold.join(", ") + ")" : ""}${errors.length ? " " + errors.join("; ") : ""}`);
      await ctx.close();
    }
    const good = {
      "primordia.best": "4200", "neon-best": "12345", "loon-echo-rescue-best": "210", "tilt.voyage.best": "9800",
      "lab.stats.plunge": JSON.stringify({ ms: 5000, runs: 2, best: 1234.4 }), "lab.stats.creek": JSON.stringify({ ms: 9000, runs: 3, best: 4000 }),
      "lab.stats.rules": JSON.stringify({ ms: 100, runs: 1 }), "lab.rules.clears": JSON.stringify({ a1: 40, b2: 95 }),
      "small-worlds-best-threadwake": "120", "small-worlds-best-heartship": "80", "follow-suit:best-chain": "5432",
      "moonwell.best.v1": JSON.stringify({ score: 12345, island: 17 }),
      "ahead-of-the-light.meta.v1": JSON.stringify({ v: 1, pages: ["home", "first-home"], records: { best: { home: true, legNo: 7, years: 14.23, ship: "lantern" } } }),
      // Light Years Home: where the save is and its golds (a tern medal counts as a gold), from races and jumps
      "light-years-home.v3.save": JSON.stringify({ v: 1, zoneId: "coma", events: { "wall-sprint": { medal: "gold" }, "wall-loop": { medal: "silver" }, "coma-dash": { medal: "tern" } }, jumps: { "wall-coma": { medal: "gold" } } }),
    };
    const { ctx, page, errors } = await open(browser, { width: 390, height: 844, store: good });
    const got = await lines(page);
    const want = { primordia: "BEST 4,200", neon: "BEST 12,345", echo: "BEST 210", tilt: "BEST 9,800", plunge: "BEST 1,234 M", creek: "RUNS 3", rules: "CLEARS 2", worlds: "WORLDS DONE 2/6", lab: "TOYS TRIED 4/4", "follow-suit": "BEST CHAIN 5,432", moonwell: "BEST 12,345 · ISLAND 17", "ahead-of-the-light": "FIRST HOME · 14.2 YR", "light-years-home": "COMA CITY · GOLDS 3" };
    for (const [g, t] of Object.entries(want)) check(got[g] === t, `a real save shows on the ${g} machine: "${got[g]}" (want "${t}")`);
    // a save must change only its own machine's line
    const moved = Object.keys(plain).filter((g) => !(g in want) && got[g] !== plain[g]);
    check(moved.length === 0, `a real save changes no other machine's line${moved.length ? " (changed: " + moved.map((g) => g + " -> " + got[g]).join("; ") + ")" : ""}`);
    check(errors.length === 0, "real saves: no page errors" + (errors.length ? ": " + errors.join("; ") : ""));
    await ctx.close();
    // Ahead of the Light's other two lines: home but not first, and the furthest leg of a run that never got home
    for (const [best, pages, t] of [[{ home: true, legNo: 7, years: 31.04 }, ["home"], "HOME IN 31.0 YR"], [{ home: false, legNo: 2, years: 9.5 }, [], "BEST: VIRGO"]]) {
      const o = await open(browser, { width: 390, height: 844, store: aotl(best, pages) });
      const line = (await lines(o.page))["ahead-of-the-light"];
      check(line === t && o.errors.length === 0, `Ahead of the Light's machine reads "${line}" (want "${t}")`);
      await o.ctx.close();
    }
    // Ahead of the Light's line fits its screen on a small phone, whichever line it is: a word wider than the screen is cut
    // on both sides. The machine's size follows the window's height, so 375 x 667 is as narrow a screen as 320 x 700.
    const AOTL_LINES = [...Array(8).keys()].map((legNo) => aotl({ home: false, legNo, years: 9.5 }, []))
      .concat([aotl({ home: true, legNo: 7, years: 31.04 }, ["home"]), aotl({ home: true, legNo: 7, years: 14.23 }, ["home", "first-home"])]);
    for (const [width, height] of [[320, 700], [375, 667]]) {
      const cut = [];
      for (const store of AOTL_LINES) {
        const o = await open(browser, { width, height, store });
        await o.page.selectOption("#machinePicker", "ahead-of-the-light");
        await o.page.waitForFunction(() => document.querySelector(".cab.on")?.dataset.game === "ahead-of-the-light");
        await settle(o.page);
        const f = await o.page.evaluate(() => {
          const c = document.querySelector('.cab[data-game="ahead-of-the-light"]'), hi = c.querySelector(".hi");
          const s = c.querySelector(".screen").getBoundingClientRect(), h = hi.getBoundingClientRect();
          return { text: hi.textContent, by: Math.max(0, s.left - h.left, h.right - s.right) };
        });
        if (f.by > 0.5 || o.errors.length) cut.push(`"${f.text}" by ${f.by.toFixed(1)} px${o.errors.length ? " " + o.errors.join("; ") : ""}`);
        await o.ctx.close();
      }
      check(cut.length === 0, `${width}x${height}: each of Ahead of the Light's ${AOTL_LINES.length} lines fits inside its screen${cut.length ? " (cut: " + cut.join("; ") + ")" : ""}`);
    }
    // the log's last unlock, at 84 pages, puts a gold frame round the screen; without it, or with unlocks that are not a list, there is none
    const UNLOCKED = ["reroll-2", "banish-1", "lucky-star", "reroll-3", "banish-2"];
    for (const [more, gold, what] of [[{ unlocks: [...UNLOCKED, "gold-frame"] }, true, "84 pages"], [{ unlocks: UNLOCKED }, false, "83 pages"], [{ unlocks: "gold-frame" }, false, "unlocks that are not a list"]]) {
      const o = await open(browser, { width: 390, height: 844, store: aotl({ home: false, legNo: 2, years: 9.5 }, [], more) });
      const f = await o.page.evaluate(() => { const c = document.querySelector('.cab[data-game="ahead-of-the-light"]'); return { gold: c.classList.contains("gold"), shadow: getComputedStyle(c.querySelector(".bezel")).boxShadow }; });
      const on = f.gold && /rgb\(255, 207, 74\)/.test(f.shadow), others = (await framed(o.page)).filter((g) => g !== "ahead-of-the-light");
      check(on === gold && others.length === 0 && o.errors.length === 0, `Ahead of the Light with ${what}: ${gold ? "a" : "no"} gold frame round its screen (class ${f.gold}, bezel ${f.shadow})`);
      await o.ctx.close();
    }
    // Light Years Home's other lines: the chapter done; a save in a zone the machine does not know, or of another version, leaves the plain line
    const LYH = "light-years-home.v3.save";
    for (const [save, t] of [
      [{ v: 1, zoneId: "virgo", chapterDone: true, events: { a: { medal: "gold" }, b: { medal: "gold" } }, jumps: { c: { medal: "tern" }, d: { medal: "bronze" } } }, "CHAPTER I DONE · GOLDS 3"],
      [{ v: 1, zoneId: "wall", events: [{ medal: "gold" }], jumps: { a: "gold", b: null, c: { medal: ["gold"] } } }, "THE WALL · GOLDS 0"],
      [{ v: 1, zoneId: "nowhere", events: { a: { medal: "gold" } } }, plain["light-years-home"]],
      [{ v: 2, zoneId: "coma", events: { a: { medal: "gold" } } }, plain["light-years-home"]],
      [{ v: 1, zoneId: "toString" }, plain["light-years-home"]],
    ]) {
      const o = await open(browser, { width: 390, height: 844, store: { [LYH]: JSON.stringify(save) } });
      const line = (await lines(o.page))["light-years-home"];
      check(line === t && o.errors.length === 0, `Light Years Home's machine reads "${line}" for ${JSON.stringify(save)} (want "${t}")${o.errors.length ? " " + o.errors.join("; ") : ""}`);
      await o.ctx.close();
    }
  }

  await relaunch();
  /* ----- Crimson Rogue's end card lists the games of the switcher: its buttons must stay in the window however long the list is ----- */
  for (const [width, height] of PARTS.includes("credits") ? [[360, 740], [390, 844], [1280, 720]] : []) {
    // not open(): that helper stops every page change to a game, and this part loads one
    const mobile = width < 800;
    const ctx = await browser.newContext({ viewport: { width, height }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
    // the game needs three.js from a CDN: serve the copy that is in the repo
    await page.route("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js", (r) => r.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(PUB, "crimson/lib/three.module.min.js")) }));
    await page.route("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/**", (r) => {
      const f = path.join(PUB, "crimson/lib/addons", r.request().url().split("/examples/jsm/")[1].split("?")[0]);
      if (fs.existsSync(f)) r.fulfill({ contentType: "application/javascript", body: fs.readFileSync(f) }); else r.continue();
    });
    await page.goto(BASE + "crimson/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const res = await page.evaluate(async () => {
      const m = await import("/crimson/js/credits.js");
      let clk = 1000;
      m.rollCredits({ crew: [{ name: "Ann", perk: "" }, { name: "Bo", perk: "" }], pick: 0, stats: { time: 120, parries: 3, deaths: 0 }, touch: innerWidth < 800, now: () => clk, onAgain() {} });
      await new Promise((r) => setTimeout(r, 300));
      clk = 1000 + 1500 + 200000; // the roll has run to its end
      await new Promise((r) => setTimeout(r, 2500));
      const box = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
      return { tiles: document.querySelectorAll("#roll .game").length, again: box(document.querySelector("#creditsAgain")), arcade: box(document.querySelector("#roll .again a")), vh: innerHeight };
    });
    const tag = `${width}x${height}`;
    check(res.tiles >= 8, `${tag}: the end card of Crimson Rogue lists the other games (${res.tiles} tiles)`);
    check(res.again.top >= 0 && res.again.bottom <= res.vh, `${tag}: at the end of the credits the play-again button is in the window (${Math.round(res.again.top)} to ${Math.round(res.again.bottom)} of ${res.vh})`);
    check(res.arcade.top >= 0 && res.arcade.bottom <= res.vh, `${tag}: and so is the arcade link (${Math.round(res.arcade.top)} to ${Math.round(res.arcade.bottom)} of ${res.vh})`);
    check(errors.length === 0, `${tag}: no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
    await ctx.close();
  }

  await relaunch();
  /* ----- keyboard: tabbing through the machines keeps the focused control in the window ----- */
  for (const [width, height, where] of PARTS.includes("focus") ? [[390, 844, "hall"], [1280, 720, "hall"], [390, 844, "lab"], [1280, 720, "lab"]] : []) {
    const { ctx, page, errors } = await open(browser, { width, height });
    if (where !== "hall") await enter(page, where);
    await settle(page);
    let outside = 0, stops = 0, seen = new Set();
    for (let i = 0; i < 70; i++) {
      await page.keyboard.press("Tab");
      // the row slides to the new machine: wait until the focused control stops moving
      for (let k = 0, prev = null; k < 30; k++) {
        const x = await page.evaluate(() => Math.round(document.activeElement.getBoundingClientRect().left * 10));
        if (x === prev) break;
        prev = x;
        await page.waitForTimeout(100);
      }
      const r = await page.evaluate(() => { const a = document.activeElement, b = a.getBoundingClientRect(); const cab = a.closest(".cab"); return { left: b.left, right: b.right, vw: innerWidth, game: cab ? cab.dataset.game || cab.dataset.opens : "", on: cab ? cab.classList.contains("on") : true, scroll: document.querySelector(".room").scrollLeft }; });
      stops++;
      if (r.game) seen.add(r.game);
      if (r.left < -1 || r.right > r.vw + 1 || r.scroll !== 0 || !r.on) outside++;
    }
    check(outside === 0, `${width}x${height} ${where}: after each of ${stops} Tab presses the focused control is in the window, and its machine is the chosen one (${outside} not)`);
    check(seen.size >= 3, `${width}x${height} ${where}: Tab reached controls of ${seen.size} different machines`);
    check(errors.length === 0, `${width}x${height}: no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
    await ctx.close();
  }

  await relaunch();
  /* ----- Tell Me and BREAKTHROUGH show a link back to the arcade, also over their start and end cards ----- */
  if (PARTS.includes("backlinks")) {
    const plain = async (width, height) => {
      // not open(): that helper stops every page change to a game, and this part loads one
      const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800 });
      const page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
      await page.route("https://fonts.g*/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
      return { ctx, page, errors };
    };
    // is the middle of the link what a finger would hit?
    const hit = (page, sel) => page.evaluate((q) => { const a = document.querySelector(q); if (!a) return { ok: false, w: 0, h: 0, inside: false }; const r = a.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { ok: e === a || a.contains(e), w: r.width, h: r.height, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; }, sel);
    const back = [
      { game: "tellme", states: [["the start card", "#home", () => {}], ["the end card", "#home", () => { document.getElementById("start").hidden = true; document.getElementById("end").hidden = false; }]] },
      { game: "breakthrough2", states: [["the title card", "#title-home", () => {}], ["the ending card", "#end-home", () => { document.getElementById("title").hidden = true; document.getElementById("ending").hidden = false; }]] },
    ];
    for (const b of back) for (const [width, height] of [[360, 740], [1280, 720]]) {
      const { ctx, page, errors } = await plain(width, height);
      await page.goto(BASE + b.game + "/", { waitUntil: "load" });
      await page.waitForTimeout(1500);
      for (const [name, sel, prepare] of b.states) {
        await page.evaluate(prepare);
        const h = await hit(page, sel);
        check(h.ok && h.inside && h.w >= 44 && h.h >= 44, `${b.game} ${width}x${height}: over ${name} the arcade link can be tapped (${Math.round(h.w)}x${Math.round(h.h)}, hit ${h.ok}, in window ${h.inside})`);
      }
      const last = b.states[b.states.length - 1][1];
      // a link that something covers cannot be clicked: that is a failed check, not a crash
      const went = page.waitForURL((u) => u.pathname === "/", { timeout: 8000 }).then(() => true, () => false);
      await page.click(last, { timeout: 4000 }).catch(() => {});
      check(await went, `${b.game} ${width}x${height}: a tap on the arcade link goes to the arcade`);
      check(errors.length === 0, `${b.game} ${width}x${height}: no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
      await ctx.close();
    }
    // Breakthrough 2: the help button keeps its size on a narrow phone
    for (const width of [320, 360, 375]) {
      const { ctx, page } = await plain(width, 700);
      await page.goto(BASE + "breakthrough2/", { waitUntil: "load" });
      await page.waitForTimeout(1200);
      const h = await page.evaluate(() => { const r = document.getElementById("help").getBoundingClientRect(); return { w: r.width, right: r.right, vw: innerWidth }; });
      check(h.w >= 44 && h.right <= h.vw, `breakthrough2 ${width}px wide: the help button is ${Math.round(h.w)} wide and ends at ${Math.round(h.right)} of ${h.vw}`);
      await ctx.close();
    }
  }
  await browser.close();
}

function finish() {
  console.log(`\nmachines: ${fails.length ? fails.length + " failed" : "all passed"}`);
  process.exit(fails.length ? 1 : 0);
}
finish();
