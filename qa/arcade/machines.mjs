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
const SHOTS = process.env.SHOTS || ""; // a folder for screenshots; none are taken without it
const PARTS = (process.env.PARTS || "walk,layout,switcher,saves").split(","); // run only some of the browser parts while you work on the page
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); return ok; };

/* ---------------- what is a game ---------------- */
// Folders of public/ that are not games, each with the reason.
const NOT_GAMES = {
  arcade: "the art on the machines, the game switcher, and the creature viewer (a tool)",
  icons: "the site's icons",
  lib: "shared libraries",
  ".well-known": "files that app stores read",
};
// Games that have no machine of their own, each with the reason. "coveredBy" names the machine that stands in for it.
const ALLOW = {
  breakthrough: { reason: "the older build of BREAKTHROUGH; its machine opens /breakthrough2/ and this page stays only as a copy (openspec/changes/breakthrough-cabinet-current)", coveredBy: "/breakthrough2/" },
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
const switchUrls = [...sw.slice(sw.indexOf("const GAMES")).split("];")[0].matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]);
const switchIds = [...sw.slice(sw.indexOf("const GAMES")).split("];")[0].matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
const switchArt = [...sw.slice(sw.indexOf("const GAMES")).split("];")[0].matchAll(/art:\s*"([^"]+)"/g)].map((m) => m[1]);

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

// the art: every picture in a machine and in the switcher exists, and the pictures this change added stay small
const imgs = [...html.matchAll(/<article class="cab[\s\S]*?<\/article>/g)].flatMap((m) => [...m[0].matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((x) => x[1]));
for (const src of new Set([...imgs, ...switchArt])) {
  const f = path.join(PUB, src.replace(/^\//, ""));
  check(fs.existsSync(f) && fs.statSync(f).size > 0, `picture ${src} exists`);
}
for (const f of fs.readdirSync(path.join(PUB, "arcade")).filter((n) => /^(lab|worlds|neon|echo|tellme|plunge|creek|tilt|rules|olympus|moonwell|breakthrough)\.webp$/.test(n))) {
  const b = fs.readFileSync(path.join(PUB, "arcade", f));
  check(b.length < 60 * 1024 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP", `arcade/${f} is a WebP under 60 KB (${(b.length / 1024).toFixed(1)} KB)`);
}
check(/^\s*<script src="\/arcade\/quiet\.js"><\/script>/m.test(html.slice(html.indexOf("<head>"), html.indexOf("</head>"))) && html.indexOf("/arcade/quiet.js") < html.search(/<script(?![^>]*quiet)/), "quiet.js is the first script on the arcade page");

/* ---------------- the page ---------------- */
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { check(false, "Playwright is not found (set NODE_PATH=$(npm root -g))"); finish(); }
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

// a new page with the errors collected. The only thing allowed to fail to load is quiet.js, which comes from another change.
async function open(browser, { width, height, store = {}, mobile = width < 800 }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const errors = [], moves = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && !/\/arcade\/quiet\.js$|fonts\.g/.test(r.url())) errors.push(r.status() + " " + r.url()); });
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
  // a page change to a game is stopped and noted; the arcade stays where it is
  await page.route((u) => u.origin === new URL(BASE).origin && u.pathname !== new URL(BASE).pathname && /\/$/.test(u.pathname), (r) => {
    if (r.request().isNavigationRequest()) { const u = new URL(r.request().url()); moves.push(u.pathname + u.hash); r.abort("aborted"); } else r.continue();
  });
  await page.addInitScript((store) => { try { localStorage.clear(); for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v); } catch (e) { /* storage off */ } }, { "arcade.tokens": "99", "arcade.sound": "false", ...store });
  await page.goto(BASE);
  await page.waitForSelector(".cab.on");
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
const sel = (page) => page.evaluate(() => [...document.querySelectorAll(".cab")].findIndex((c) => c.classList.contains("on")));

if (chromium) {
  const browser = await chromium.launch({ args: ARGS });

  /* ----- walk to every machine, put a token in, start it, and see where it goes ----- */
  // four ways to play, so each machine is tried in more than one way across the two sizes
  const METHODS = ["drag a token, press START", "key 5, key 1", "key 5, Enter", "tap a slot, press START"];
  for (const vp of PARTS.includes("walk") ? [{ width: 390, height: 844 }, { width: 1280, height: 720 }] : []) {
    const tag = `${vp.width}x${vp.height}`;
    const { ctx, page, errors, moves } = await open(browser, vp);
    const names = await page.$$eval(".cab", (cs) => cs.map((c) => ({ game: c.dataset.game, url: c.dataset.url, name: c.querySelector(".marquee b").textContent })));
    check(names.length === machineUrls.length, `${tag}: the page has ${names.length} machines (the file has ${machineUrls.length})`);
    const opts = await page.$$eval("#machinePicker option", (os) => os.map((o) => Number(o.value)).sort((a, b) => a - b));
    check(opts.length === names.length && opts.every((v, i) => v === i), `${tag}: the machine picker lists every machine once`);
    // go to the first machine, then step with the next arrow
    await page.keyboard.press("ArrowLeft");
    await settle(page);
    const reached = [];
    for (let i = 0; i < names.length; i++) {
      const m = names[i];
      const at = await sel(page);
      if (at !== i) { check(false, `${tag}: arrow ${i} selects ${m.game} (selected ${at})`); break; }
      const method = (i + (vp.width === 390 ? 0 : 1)) % METHODS.length;
      const tokens0 = Number(await page.textContent("#count"));
      const credit = () => page.evaluate((i) => document.querySelectorAll(".cab")[i].querySelector(".credit").textContent + "|" + document.querySelectorAll(".cab")[i].querySelector(".press").textContent, i);
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
      try { await page.waitForFunction((i) => /CREDIT 1/.test(document.querySelectorAll(".cab")[i].querySelector(".credit").textContent), i, { timeout: 4000 }); } catch (e) { /* reported below */ }
      const c1 = await credit();
      const tokens1 = Number(await page.textContent("#count"));
      const lit = await page.evaluate((i) => document.querySelectorAll(".cab")[i].classList.contains("credit"), i);
      const ok1 = c1 === "CREDIT 1|PRESS START" && tokens1 === tokens0 - 1 && lit;
      if (SHOTS && (i === names.length - 1 || i === 11)) await page.screenshot({ path: path.join(SHOTS, `machines-${tag}-${m.game}-credit.png`) });
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
    check(await sel(page) === 0, `${tag}: the next arrow after the last machine comes back to the first`);
    // every game with a machine was reached by the arrows
    for (const g of games) if (!ALLOW[g.dir]) check(reached.includes(g.url), `${tag}: the arrows reach the machine for ${g.url}`);
    check(errors.length === 0, `${tag}: no page errors${errors.length ? ":\n    " + errors.join("\n    ") : ""}`);
    await ctx.close();
  }

  /* ----- the last machine by keyboard and by swipe, and the layout at the sizes people use ----- */
  const SIZES = [[360, 740], [390, 844], [430, 932], [375, 667], [768, 1024], [1280, 720], [1920, 1080]];
  for (const [width, height] of PARTS.includes("layout") ? SIZES : []) {
    const tag = `${width}x${height}`;
    const { ctx, page, errors } = await open(browser, { width, height });
    const n = await page.$$eval(".cab", (cs) => cs.length);
    await page.keyboard.press("ArrowLeft"); await settle(page);
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
      return [...document.querySelectorAll(".cab:not(.on)")].filter((c) => { const b = c.getBoundingClientRect(); return b.right > on.left + 2 && b.left < on.right - 2; }).length;
    });
    check(over === 0, `${tag}: no machine overlaps the chosen one`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `machines-${tag}-last.png`) });
    // by swipe (a finger on a phone, the mouse on a computer) from the first machine to the last
    {
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
    // the machine list under the machines, and the scroll wheel
    await page.selectOption("#machinePicker", "0"); await settle(page);
    const first = await sel(page);
    await page.selectOption("#machinePicker", String(n - 1)); await settle(page);
    check(first === 0 && await sel(page) === n - 1, `${tag}: the machine list goes to the first machine and to the last`);
    await page.selectOption("#machinePicker", "0"); await settle(page);
    await page.mouse.move(width / 2, box.stage.t + 40);
    await page.mouse.wheel(0, 120); await page.waitForTimeout(400); await settle(page);
    check(await sel(page) === 1, `${tag}: one flick of the scroll wheel moves one machine`);
    check(errors.length === 0, `${tag}: no page errors${errors.length ? ":\n    " + errors.join("\n    ") : ""}`);
    await ctx.close();
  }

  /* ----- the game switcher: all games, the right one marked, tiles you can tap, and the exits in reach ----- */
  for (const [width, height] of PARTS.includes("switcher") ? [[360, 740], [1280, 720]] : []) {
    const tag = `${width}x${height}`;
    const { ctx, page, errors } = await open(browser, { width, height });
    await page.addScriptTag({ url: new URL("arcade/switch.js", BASE).href });
    // the page answers to a game's address, so the switcher can work out where it is
    const here = { "/lab/": "The Lab", "/lab/worlds/": "Small Worlds", "/lab/plunge/": "Take the Plunge", "/lab/rules/": "House Rules", "/fall/": "Down the Drain", "/breakthrough2/": "Breakthrough", "/echo/": "Loon Echo", "/olympus/x": "Olympus" };
    for (const [p, name] of Object.entries(here)) {
      await page.evaluate((p) => { history.replaceState({}, "", p); GameSwitch.close(); GameSwitch.open(); }, p);
      await page.waitForSelector(".gsw-game");
      const marked = await page.$$eval(".gsw-game.here b", (bs) => bs.map((b) => b.textContent));
      check(marked.length === 1 && marked[0] === name, `${tag}: on ${p} the switcher marks ${name} (marked: ${marked.join(", ") || "none"})`);
    }
    await page.evaluate(() => { history.replaceState({}, "", "/"); GameSwitch.close(); GameSwitch.open(); });
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll(".gsw-game")], box = document.querySelector(".gsw"), row = document.querySelector(".gsw-row").getBoundingClientRect();
      return { n: tiles.length, hrefs: tiles.map((t) => t.getAttribute("href")), small: tiles.filter((t) => { const r = t.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length, scrolls: box.scrollHeight > box.clientHeight, rowIn: row.top >= 0 && row.bottom <= innerHeight + 1, vh: innerHeight };
    });
    check(info.n === switchUrls.length && switchUrls.every((u) => info.hrefs.includes(u) || u === "/wild/"), `${tag}: the switcher shows a tile for each of the ${switchUrls.length} games (${info.n})`);
    check(info.small === 0, `${tag}: every tile is at least 44 pixels each way`);
    check(info.rowIn, `${tag}: Back to the arcade and Keep playing stay in the window while the list is at the top`);
    check(info.scrolls || width > 800, `${tag}: a long list scrolls`);
    await page.evaluate(() => { const b = document.querySelector(".gsw"); b.scrollTop = b.scrollHeight; });
    await page.waitForTimeout(600);
    const end = await page.evaluate(() => { const last = [...document.querySelectorAll(".gsw-game")].pop().getBoundingClientRect(), row = document.querySelector(".gsw-row").getBoundingClientRect(); return { lastTop: last.top, lastBottom: last.bottom, rowTop: row.top, rowBottom: row.bottom, vh: innerHeight }; });
    check(end.lastBottom <= end.rowTop + 1 && end.rowBottom <= end.vh + 1, `${tag}: at the end of the list the last tile is clear of the exit buttons`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `switcher-${tag}-end.png`) });
    check(errors.length === 0, `${tag}: the switcher causes no page errors${errors.length ? ":\n    " + errors.join("\n    ") : ""}`);
    await ctx.close();
  }

  /* ----- the high-score lines: a game's own save shows, and junk never throws ----- */
  const JUNK = ["not json", "null", "[]", "{}", "[1,2]", "-5", "0", "1e999", "\"x\"", "{\"best\":\"x\",\"ms\":[],\"runs\":{}}", "true"];
  const KEYS = ["neon-best", "loon-echo-rescue-best", "tilt.voyage.best", "lab.stats.plunge", "lab.stats.creek", "lab.stats.rules", "lab.rules.clears", "small-worlds-best-threadwake", "small-worlds-best-heartship"];
  const lines = (page) => page.$$eval(".cab", (cs) => Object.fromEntries(cs.map((c) => [c.dataset.game, c.querySelector(".hi").textContent])));
  if (PARTS.includes("saves")) {
    const clean = await open(browser, { width: 390, height: 844 });
    const plain = await lines(clean.page);
    await clean.ctx.close();
    for (const junk of JUNK) {
      const { ctx, page, errors } = await open(browser, { width: 390, height: 844, store: Object.fromEntries(KEYS.map((k) => [k, junk])) });
      const got = await lines(page);
      const same = Object.keys(plain).filter((g) => got[g] !== plain[g]);
      // "0", "-5" and the like are not scores; "1e999" is not a finite number; none may change a line
      check(errors.length === 0 && same.length === 0, `junk save ${JSON.stringify(junk)}: no error, and the lines stay plain${same.length ? " (changed: " + same.map((g) => g + " -> " + got[g]).join("; ") + ")" : ""}${errors.length ? " " + errors.join("; ") : ""}`);
      await ctx.close();
    }
    const good = {
      "neon-best": "12345", "loon-echo-rescue-best": "210", "tilt.voyage.best": "9800",
      "lab.stats.plunge": JSON.stringify({ ms: 5000, runs: 2, best: 1234.4 }), "lab.stats.creek": JSON.stringify({ ms: 9000, runs: 3, best: 4000 }),
      "lab.stats.rules": JSON.stringify({ ms: 100, runs: 1 }), "lab.rules.clears": JSON.stringify({ a1: 40, b2: 95 }),
      "small-worlds-best-threadwake": "120", "small-worlds-best-heartship": "80",
    };
    const { ctx, page, errors } = await open(browser, { width: 390, height: 844, store: good });
    const got = await lines(page);
    const want = { neon: "BEST 12,345", echo: "BEST 210", tilt: "BEST 9,800", plunge: "BEST 1,234 M", creek: "RUNS 3", rules: "CLEARS 2", worlds: "WORLDS DONE 2/6", lab: "TOYS TRIED 4/4" };
    for (const [g, t] of Object.entries(want)) check(got[g] === t, `a real save shows on the ${g} machine: "${got[g]}" (want "${t}")`);
    // a save must change only its own machine's line
    const moved = Object.keys(plain).filter((g) => !(g in want) && got[g] !== plain[g]);
    check(moved.length === 0, `a real save changes no other machine's line${moved.length ? " (changed: " + moved.map((g) => g + " -> " + got[g]).join("; ") + ")" : ""}`);
    check(errors.length === 0, "real saves: no page errors" + (errors.length ? ": " + errors.join("; ") : ""));
    await ctx.close();
  }
  await browser.close();
}

function finish() {
  console.log(`\nmachines: ${fails.length ? fails.length + " failed" : "all passed"}`);
  process.exit(fails.length ? 1 : 0);
}
finish();
