// The messages in play keep clear of the lure (the fish-feedback spec, "Messages clear of the lure"), in the real page:
// a cast lands at 15, 35 and 55 m, and while the cast report is up, and after it, no message covers the lure on the
// water: the prompt and its sub, the cast report, the banner and a toast. The report also stays clear of the gauge, the
// HUD and the prompt, and on the screen. Motion play at 360x640, 390x844, 412x915 and 430x932 (and the reel on the left),
// touch play at 390x844, 844x390 and 640x360, and Larger text at 360x640 and 844x390.
// Serve public/ first, then: NODE_PATH=qa/browser/node_modules node qa/fish/messages.e2e.mjs   (FISH_URL sets the address)
// Exits with code 1 when something fails.
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { URL, installPhone, sleep, SEEN } from "./lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"];
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? "ok   " : "FAIL ") + msg); return ok; };
// room kept around the lure, in CSS px: the lure, its splash and the first ring
const PAD = 22;
const DISTS = [15, 35, 55];

const RUNS = [
  { input: "motion", sizes: [[360, 640], [390, 844], [412, 915], [430, 932]] },
  { input: "motion", reelSide: "left", sizes: [[412, 915]] },
  { input: "touch", sizes: [[390, 844], [844, 390], [640, 360]] },
  { input: "motion", large: true, sizes: [[360, 640]] },
  { input: "touch", large: true, sizes: [[844, 390]] },
];

// what the page shows: the boxes of the messages, the gauge, the HUD, and the lure on the screen
function look() {
  const box = (e) => { if (!e || e.closest("[hidden]") || !e.getClientRects().length) return null; const cs = getComputedStyle(e); if (cs.visibility === "hidden" || +cs.opacity < 0.05) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { x: r.left, y: r.top, r: r.right, b: r.bottom } : null; };
  const q = (s) => box(document.querySelector(s));
  const t = document.querySelector("#toast");
  const v = document.querySelector("#view").getBoundingClientRect(), L = FISH.world.lureScreen();
  return {
    lure: L && { x: L.x + v.left, y: L.y + v.top },
    msgs: { prompt: q("#prompt .p1"), sub: q("#prompt .p2"), dist: q("#report .dist"), verdict: q("#report .verdict"), zone: q("#report .zone"), banner: q("#banner b"), toast: t.classList.contains("on") ? box(t) : null },
    report: q("#report"), gauge: q("#gaugeBox"), hud: q("#hud"), layout: FISH.G.layout, W: innerWidth, H: innerHeight,
  };
}
const hit = (a, b) => !!a && !!b && a.x < b.r - 1 && a.r > b.x + 1 && a.y < b.b - 1 && a.b > b.y + 1;
const near = (m, L) => !!m && !!L && m.x < L.x + PAD && m.r > L.x - PAD && m.y < L.y + PAD && m.b > L.y - PAD;
const fmt = (b) => b ? `${Math.round(b.y)}-${Math.round(b.b)}` : "-";

async function run({ input, reelSide = "right", large = false, sizes }) {
  const [W0, H0] = sizes[0];
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext({ viewport: { width: W0, height: H0 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/three.module.min.js", (r) => r.fulfill({ path: path.join(ROOT, "public/crimson/lib/three.module.min.js"), contentType: "application/javascript" }));
  const save = { v: 1, cuts: SEEN, input, assist: true, reelSide, place: "loon", casts: 140, caught: 61, longest: 30, seen: { run: 1, bite: 1, "ring.tip": 1, cast: 1, bail: 1 } };
  await page.addInitScript(([save, large]) => { localStorage.clear(); localStorage.setItem("fish.v1", JSON.stringify(save)); if (large) localStorage.setItem("fish.text", "large"); }, [save, large]);
  await page.addInitScript(installPhone);
  await page.goto(URL);
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  await sleep(400);
  await page.click("#freeBtn");
  await page.waitForFunction(() => FISH.G.phase === "cast", null, { timeout: 60000 });
  await page.evaluate(() => { FISH.rises.list = []; FISH.rises.spawn = () => null; FISH.world.setRings([]); });
  const name = `${input}${reelSide === "left" ? ", reel on the left" : ""}${large ? ", Larger text" : ""}`;
  for (const [W, H] of sizes) {
    await page.setViewportSize({ width: W, height: H });
    await sleep(900);
    for (const d of DISTS) {
      // a cast lands d m out, straight ahead (as menus.e2e.mjs stages a landing)
      await page.evaluate(async (d) => {
        const G = FISH.G, wait = (ms) => new Promise((r) => setTimeout(r, ms));
        FISH.newCast(); await wait(300);
        G.cast = { verdict: "sweet", yaw: 0, stroke: 1 };
        G.step = "flight"; G.flight = { step: () => ({ x: 0, y: 0, z: -d, done: true, land: "water", lineOut: d, spool: 0 }) };
        const t0 = performance.now();
        while (G.phase !== "reel" && performance.now() - t0 < 8000) await wait(10);
      }, d);
      for (const [when, ms] of [["with the report", 700], ["with the report, the camera settled", 1500], ["after the report", 2400]]) {
        await sleep(ms === 700 ? 700 : ms === 1500 ? 800 : 1300);
        const s = await page.evaluate(look);
        const on = Object.entries(s.msgs).filter(([, m]) => near(m, s.lure)).map(([k, m]) => k + " " + fmt(m));
        const tag = `${name} ${W}x${H}, ${d} m, ${when}`;
        check(!!s.lure && !on.length, `${tag}: no message covers the lure (lure ${s.lure ? Math.round(s.lure.x) + "," + Math.round(s.lure.y) : "not on screen"}${on.length ? "; on it: " + on.join(", ") : ""})`);
        // the report as it shows: its distance, its verdict and its note
        const parts = [s.msgs.dist, s.msgs.verdict, s.msgs.zone].filter(Boolean);
        if (s.report && parts.length) {
          const r = { x: Math.min(...parts.map((b) => b.x)), y: Math.min(...parts.map((b) => b.y)), r: Math.max(...parts.map((b) => b.r)), b: Math.max(...parts.map((b) => b.b)) }, clash = ["gauge", "hud"].filter((k) => hit(r, s[k])).concat(["prompt", "sub"].filter((k) => hit(r, s.msgs[k])));
          check(!clash.length && r.x >= 0 && r.r <= s.W && r.y >= 0, `${tag}: the report (${fmt(r)}) is on the screen and clear of ${clash.length ? "all but " + clash.join(", ") : "the gauge, the HUD and the prompt"}`);
        }
      }
    }
  }
  check(!errors.length, `${name}: no page errors` + (errors.length ? " (" + errors.slice(0, 3).join(" | ") + ")" : ""));
  await browser.close();
}

for (const r of RUNS) await run(r);
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
