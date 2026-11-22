// The last slot of every Alley row has to sit inside the window and open on a click.
// A wide ring used to leave that slot about 5000 px off to the side, so the click missed.
// Serve public/ first. Run: NODE_PATH=qa/browser/node_modules node qa/lab/riftwalk-rows.e2e.mjs
// SHOTS=/tmp/dir saves the last Lab slot. CHROME or CHROMIUM_PATH picks the browser.
import { createRequire } from "module";
import path from "path";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = (process.env.ARCADE_URL || "http://127.0.0.1:8765/").replace(/\/?$/, "/");
const SHOTS = process.env.SHOTS || "";
const SIZES = [
  { name: "1280", width: 1280, height: 800, touch: false },
  { name: "390", width: 390, height: 844, touch: true },
];
let failures = 0;
const check = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) failures++; };
const exe = process.env.CHROME || process.env.CHROMIUM_PATH;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });

for (const size of SIZES) {
  console.log(size.name);
  const probe = await browser.newContext({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch });
  const first = await probe.newPage();
  await first.goto(BASE + "lab/riftwalk/?world=none&zone=cottage", { waitUntil: "domcontentloaded" });
  await first.waitForSelector("#go:not([disabled])", { timeout: 20000 });
  const zones = await first.evaluate(() => [...document.querySelectorAll("#groups button")].map((b) => b.dataset.zone));
  await probe.close();
  const errors = [];
  for (const zone of zones) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch });
    const page = await ctx.newPage();
    const gone = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) => {
      const req = route.request();
      if (req.isNavigationRequest() && !req.url().includes("/lab/riftwalk/")) { gone.push(new URL(req.url()).pathname); return route.abort(); }
      return route.continue();
    });
    await page.goto(BASE + "lab/riftwalk/?world=none&zone=" + zone, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#go:not([disabled])", { timeout: 20000 });
    await page.click("#go");
    await page.click("#kRoom");
    await page.waitForFunction((id) => window.__riftwalk && window.__riftwalk.state().room === id, zone);
    // the last page of this row, then the last slot on it
    for (let guard = 0; guard < 8; guard++) {
      const more = page.locator("#kMore");
      if (await more.isHidden()) break;
      const nums = ((await more.textContent()) || "").match(/\d+/g)?.map(Number) || [];
      if (nums.length < 2 || nums[0] === nums[1]) break;
      await more.click();
      await page.waitForTimeout(100);
    }
    const slot = await page.evaluate(() => {
      const s = window.__riftwalk.state();
      const last = s.machines.reduce((at, m, i) => (m.game ? i : at), -1);
      const edges = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => window.__riftwalk.rim(last, x, y));
      const centre = window.__riftwalk.screen(last);
      const inside = edges.every((p) => p && p.x >= -1 && p.x <= innerWidth + 1 && p.y >= -1 && p.y <= innerHeight + 1);
      return { last, title: s.machines[last].title, url: s.machines[last].url, centre, inside, edge: edges.map((p) => p && Math.round(p.x) + "," + Math.round(p.y)) };
    });
    check(slot.inside, `${size.name} ${zone}: the last slot (${slot.title}) is inside the window (${slot.edge.join(" ")})`);
    if (zone === "lab" && SHOTS) await page.screenshot({ path: path.join(SHOTS, `lab-last-${size.name}.png`) });
    gone.length = 0;
    await page.mouse.click(slot.centre.x, slot.centre.y);
    const want = new URL(slot.url, BASE).pathname;
    const end = Date.now() + 5000;
    while (!gone.length && Date.now() < end) await page.waitForTimeout(50);
    // The click is kept on this page: the navigation is noted and stopped, so the next row can be checked.
    check(gone[0] === want, `${size.name} ${zone}: clicking the last slot opens ${slot.url}` + (gone[0] === want ? "" : ` (went to ${gone[0] || "nowhere"})`));
    await ctx.close();
  }
  check(errors.length === 0, `${size.name}: no page errors` + (errors.length ? ": " + errors.join(" | ") : ""));
}
await browser.close();
console.log(failures ? failures + " failed" : "all passed");
process.exit(failures ? 1 : 0);
