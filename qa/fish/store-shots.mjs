// The store screenshots of Reel It In (apps/fish/store/screenshots.md): the eight scenes in the store build, staged with the
// game's QA hooks, at the size each store slot needs. Each file is a PNG with no alpha (RGB) at the exact size.
// Run (serve public/ first): NODE_PATH=qa/browser/node_modules node qa/fish/store-shots.mjs
//   SLOTS=android,iphone-6.9   the slots to make (android 1080x1920, iphone-6.9 1320x2868, iphone-6.5 1284x2778,
//                              ipad-13 2064x2752; default android)
//   OUT=<dir>                  the folder (default apps/fish/store/screenshots); each slot gets its own folder in it
// It prints what it checked in each scene and exits with code 1 when a scene is not as the list says. Look at the pictures too.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { URL, installPhone, sleep, SEEN, pointer, center } from "./lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sharp = createRequire(path.join(ROOT, "apps/fish/package.json"))("sharp");
// the CSS viewport and the pixel scale of each slot: phones at 3x, the iPad at 2x like a real one
const SIZES = { android: [360, 640, 3], "iphone-6.9": [440, 956, 3], "iphone-6.5": [428, 926, 3], "ipad-13": [1032, 1376, 2] };
const BG = "#0d2f38";
const OUT = path.resolve(process.env.OUT || path.join(ROOT, "apps/fish/store/screenshots"));
const SLOTS = (process.env.SLOTS || "android").split(",").map((s) => s.trim());
for (const s of SLOTS) if (!SIZES[s]) { console.error("Unknown slot " + s + ". Use " + Object.keys(SIZES).join(", ")); process.exit(2); }

// A player some way into the game: every place open, a journal with fish at Loon Lake, no first-time tips or cards
const SAVE = {
  v: 1, cuts: SEEN, input: "motion", assist: true, artStyle: "painted", reelSide: "right", place: "loon", casts: 140, caught: 61, longest: 52,
  journal: {
    pumpkinseed: { n: 9, kg: 0.21, cm: 17 }, perch: { n: 14, kg: 0.48, cm: 31 }, rockbass: { n: 6, kg: 0.35, cm: 22 },
    smallmouth: { n: 8, kg: 1.9, cm: 46 }, largemouth: { n: 5, kg: 2.2, cm: 44 }, walleye: { n: 7, kg: 2.6, cm: 58 }, pike: { n: 3, kg: 4.1, cm: 79 },
  },
  places: {
    loon: { open: 1, d: 9.4, kg: 4.1, id: "pike", n: 52, lg: 1, g: 63 }, stumps: { open: 1, d: 0, kg: 2.4, id: "crappie", n: 6, lg: 0, g: 0 },
    river: { open: 1, d: 0, kg: 1.8, id: "brooktrout", n: 2, lg: 0, g: 0 }, sea: { open: 1, d: 0, kg: 0, id: null, n: 0, lg: 0, g: 0 },
  },
  seen: { run: 1, bite: 1, "ring.tip": 1, cast: 1, bail: 1, "river.swing": 1, "at.stumps": 1, "at.river": 1, "at.sea": 1, "opened.stumps": 1, "opened.river": 1, "opened.sea": 1 },
};

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); return ok; };

async function runSlot(slot) {
  const [W, H, SCALE] = SIZES[slot], dir = path.join(OUT, slot);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`${slot}: ${W * SCALE}x${H * SCALE}`);
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.route("**/three.module.min.js", (r) => r.fulfill({ path: path.join(ROOT, "public/crimson/lib/three.module.min.js"), contentType: "application/javascript" }));
  await page.addInitScript((save) => { if (!sessionStorage.getItem("qa-kept")) { localStorage.clear(); localStorage.setItem("fish.v1", JSON.stringify(save)); sessionStorage.setItem("qa-kept", "1"); } }, SAVE);
  await page.addInitScript(installPhone);
  await page.goto(URL + "?shot");
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  const wait = (fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 });
  const shown = (id) => wait((id) => !document.getElementById(id).hidden, id);
  const tap = async (sel) => { await sleep(380); await page.click(sel); };
  // G.sim becomes a stand-in with the shape of LakeSim's state, as in screens.mjs and moments.e2e.mjs
  const stage = (patch, events = [], fresh = true) => page.evaluate(([patch, events, fresh]) => {
    const G = FISH.G;
    if (fresh || !G.sim || !G.sim.fake) {
      G.lastEvent = {}; G.walk = false; G.hold = null; G.big = null;
      G.sim = { fake: true, events: [], step() {}, state: {
        phase: "fight", lure: { x: 0, y: -0.2, z: -20, speed: 0 }, tfrac: 0.45, slip: 0, dragN: 18, breakN: 45, lineOut: 22, slack: false, bend: 0.4, spoolFrac: 0.2,
        fish: { id: "walleye", kg: 2.1, cm: 52, x: 0, y: -1.2, z: -20, heading: 0, len: 0.5, stamina: 0.62, move: "swim", jump: 0, near: 0.5, known: true },
      } };
      G.bail = "closed";
      if (G.phase !== "reel") FISH.enterReel();
    }
    const s = G.sim.state, { fish, ...rest } = patch;
    Object.assign(s, rest);
    if (fish === null) s.fish = null; else if (fish) s.fish = { ...(s.fish || {}), ...fish };
    G.sim.events.push(...events);
  }, [patch, events, fresh]);
  async function snap(name, settle = 700) {
    await sleep(settle);
    const raw = await page.screenshot({ type: "png" });
    const file = path.join(dir, name + ".png");
    await sharp(raw).flatten({ background: BG }).removeAlpha().png().toFile(file);
    const m = await sharp(file).metadata();
    check(m.width === W * SCALE && m.height === H * SCALE && m.channels === 3 && !m.hasAlpha, `${name}.png is ${m.width}x${m.height}, ${m.channels} channels`);
  }
  const visible = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest("[hidden]") && getComputedStyle(e).visibility !== "hidden"; }, sel);

  try {
    // 1. the title in the store build
    await page.evaluate(() => { document.documentElement.dataset.build = "store"; FISH.toTitle(); });
    await sleep(1500);
    const title = await page.evaluate(() => ({ first: document.querySelector("#title .btn")?.textContent.trim(), arcade: /Switch game|Back to the arcade/.test(document.querySelector("#title").innerText) }));
    check(/Go fishing/.test(title.first || "") && !title.arcade, `the title shows "Go fishing" first and no arcade parts (${JSON.stringify(title)})`);
    await snap("01-title", 800);

    // today's goal is done already, so no goal toast covers a scene
    await page.evaluate(async () => { const g = await import("/fish/js/goals.js"), d = g.dayOf(), dg = g.dailyGoal(d, FISH.save); FISH.save.today = { d, k: dg.k, n: dg.n, done: 1 }; });
    const eye = await page.evaluate(() => FISH.place.stand.eye);

    // 2. a motion cast in flight: the thumb on the reel, the phone tipped back and whipped forward, the thumb lifted at
    // 11 o'clock (as in flow.mjs), and the lure held in the air as it comes down over the water
    await tap("#freeBtn");
    await wait(() => FISH.G.phase === "cast" && document.body.dataset.screen === "", null, 60000);
    check(await page.evaluate(() => FISH.G.input) === "motion", "motion play is on");
    await page.evaluate(() => __phone.pose(88));
    await sleep(1500);
    const rb = await center(page, "#reelBox"), px = rb.x + rb.w * 0.2, py = rb.y + rb.h * 0.25;
    await pointer(page, "pointerdown", px, py);
    await wait(() => FISH.G.step === "pinned", null, 5000);
    await page.evaluate(async ({ px, py }) => {
      const P = window.__phone, el = document.elementFromPoint(px, py), pause = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i <= 25; i++) { P.pose(88 + 42 * (i / 25)); await pause(16); }
      await pause(250);
      let lifted = false;
      const t0 = performance.now(), T = 170;
      while (true) {
        const k = Math.min(1, (performance.now() - t0) / T), th = 130 - 110 * (0.5 - 0.5 * Math.cos(Math.PI * k));
        P.pose(th);
        if (!lifted && th <= 70) { lifted = true; el.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: px, clientY: py, bubbles: true })); }
        if (k >= 1) break;
        await pause(4);
      }
    }, { px, py });
    await wait(() => FISH.G.step === "flight", null, 5000);
    await page.evaluate(() => {
      const F = FISH.G.flight, step = F.step.bind(F);
      let t = 0, held = null;
      F.step = (dt, feather) => { if (held) return held; const r = step(dt, feather); t += dt; if (t > 0.9 || r.done) held = { ...r, done: false }; return held || r; };
    });
    await page.evaluate(() => __phone.pose(60));
    await sleep(1800);
    const fly = await page.evaluate(() => ({ step: FISH.G.step, verdict: FISH.G.cast && FISH.G.cast.verdict }));
    check(fly.step === "flight" && ["sweet", "low", "high"].includes(fly.verdict), `the lure is in the air after a good motion cast (${JSON.stringify(fly)})`);
    await snap("02-cast", 200);

    // 3. the strike: a bass under the lure takes it (no rising rings from here on, so no ring toast covers a scene)
    await page.evaluate(() => { FISH.rises.list = []; FISH.rises.spawn = () => null; FISH.world.setRings([]); FISH.newCast(); });
    await wait(() => FISH.G.phase === "cast");
    // the shadow is drawn on the water (world.js drawFollower): a big bass close in, given 2 s to fade in
    const L = { x: eye.x + 0.3, y: -0.15, z: eye.z - 7, speed: 0 };
    await stage({ phase: "strike", lure: L, lineOut: 7.5, fish: null, follower: { id: "largemouth", x: L.x + 0.05, y: -0.2, z: L.z + 0.6, heading: Math.PI / 2, len: 0.9 } });
    await sleep(2200);
    const strike = await page.evaluate(() => document.querySelector("#prompt .p1")?.textContent || "");
    check(/Set the hook/.test(strike), `the strike prompt says to set the hook ("${strike}")`);
    await snap("03-strike", 0);

    // 4. a fight: the gauge, the crank, and a smallmouth bass in the air
    const jx = eye.x - 0.8, jz = eye.z - 11;
    await stage({ tfrac: 0.62, lineOut: 11.5, fish: { id: "smallmouth", kg: 1.7, cm: 44, len: 0.44, x: jx, z: jz, y: -0.4, heading: Math.PI / 2, move: "swim", jump: 0, stamina: 0.7, known: true } });
    await sleep(1500);
    await stage({ fish: { y: 0.9, jump: 0.8, move: "jump" } }, [{ type: "jump", size: 0.44, x: jx, z: jz }], false);
    await wait(() => FISH.world.feel().zoom > 0.95, null, 20000).catch(() => {});
    const fight = await page.evaluate(() => ({ prompt: document.querySelector("#prompt .p1")?.textContent || "", zoom: FISH.world.feel().zoom }));
    check(/jump/i.test(fight.prompt) && fight.zoom > 0.9, `the fish jumps, and the view zooms in (${JSON.stringify(fight)})`);
    check(await visible("#gaugeBox") && await visible("#crankBox"), "the gauge and the crank show");
    await snap("04-fight", 300);

    // 5. a trophy: the photo with the TROPHY badge and the ruler, right after the jump (its zoom is still on). In motion
    // play the view follows the phone, so the phone is held upright first
    await page.evaluate(() => __phone.pose(88));
    await sleep(1200);
    await page.evaluate(() => FISH.newCast());
    await wait(() => FISH.G.phase === "cast");
    await stage({ phase: "caught", catch: { id: "largemouth", name: "Largemouth Bass", kg: 3.9, cm: 55, junk: false }, fish: null });
    await shown("catch");
    await wait(() => !FISH.G.cardWait, null, 20000);
    await wait(() => document.querySelector("#ckg").dataset.kg === "3.9", null, 20000);
    await sleep(2200);
    const badges = await page.evaluate(() => [...document.querySelectorAll("#cbadges .badge")].map((b) => b.textContent));
    check(badges.includes("TROPHY"), `the catch card has the TROPHY badge (${badges.join(", ")})`);
    await snap("05-trophy", 300);
    await page.evaluate(() => FISH.toTitle());
    await shown("title");

    // 6. the journal at Loon Lake
    await tap("#journalBtn"); await shown("journal");
    await snap("06-journal", 900);
    await tap("#journal [data-close]"); await sleep(200);

    // 7. the places, with Gull Rock in view
    await tap("#placesBtn"); await shown("places");
    // Gull Rock at the top of the list, just under the heading, with the card above it scrolled fully away
    const gull = await page.evaluate(() => {
      const items = [...document.querySelectorAll("#plist > li")], g = items.find((li) => /Gull Rock/.test(li.innerText));
      let box = document.getElementById("plist");
      while (box && box !== document.body && !(/(auto|scroll)/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight)) box = box.parentElement;
      if (g && box) {
        const prev = g.previousElementSibling, gap = prev ? g.getBoundingClientRect().top - prev.getBoundingClientRect().bottom : 12;
        const head = document.querySelector("#places .psub").getBoundingClientRect().bottom;
        box.scrollTop += g.getBoundingClientRect().top - head - gap;
      }
      return { places: items.length, gull: !!g };
    });
    check(gull.places === 4 && gull.gull, `the Places list has all four places, and Gull Rock is in view (${JSON.stringify(gull)})`);
    await snap("07-places", 900);
    await tap("#places [data-close]"); await sleep(200);

    // 8. touch play: a fight with the crank and the rod pad
    await page.evaluate(() => { FISH.save.input = "touch"; FISH.G.input = "touch"; FISH.startMode("free"); FISH.relayout(true); });
    await wait(() => FISH.G.phase === "cast" && document.body.dataset.screen === "", null, 60000);
    await page.evaluate(() => { FISH.rises.list = []; FISH.rises.spawn = () => null; FISH.world.setRings([]); const t = document.querySelector("#toast"); if (t) t.classList.remove("on"); });
    await stage({ tfrac: 0.5, lineOut: 18, fish: { id: "walleye", kg: 2.3, cm: 55, len: 0.52, x: eye.x + 1.2, z: eye.z - 18, y: -1.1, heading: -Math.PI / 3, move: "swim", stamina: 0.55, known: true } });
    await sleep(1800);
    const touch = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
      const c = r("#crankBox"), p = r("#padBox");
      return { input: FISH.G.input, crankLeft: c ? c.left + c.width / 2 < innerWidth / 2 : null, padRight: p ? p.left + p.width / 2 > innerWidth / 2 : null };
    });
    check(touch.input === "touch" && touch.crankLeft === true && touch.padRight === true, `touch play, with the crank on the left and the rod pad on the right (${JSON.stringify(touch)})`);
    await snap("08-touch", 300);
  } catch (e) {
    check(false, `${slot}: the run stopped: ${e && e.message}`);
    await page.screenshot({ path: path.join(dir, "zz-error.png") }).catch(() => {});
  }
  for (const e of errors) check(false, `${slot}: ${e}`);
  await browser.close();
}

for (const s of SLOTS) await runSlot(s);
console.log(fails.length ? `\n${fails.length} problems` : "\nNo problems found. Now look at the pictures.");
process.exit(fails.length ? 1 : 0);
