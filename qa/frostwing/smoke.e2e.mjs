// Frostwing in a browser: serve public/ at http://127.0.0.1:8765/ first, then
//   NODE_PATH=qa/browser/node_modules node qa/frostwing/smoke.e2e.mjs
// SHOTS=<folder> saves a screenshot of each layout. Covers the screens, keyboard and touch play, pause, and results
// at desktop, portrait phone and landscape phone sizes (openspec/changes/add-frostwing/specs/frostwing/spec.md).
import { createRequire } from "module";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = (process.env.FROSTWING_URL || "http://127.0.0.1:8765/frostwing/");
const SHOTS = process.env.SHOTS || "";
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); return ok; };

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
async function open(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__fw && __fw.state === "title");
  return { ctx, page, errors };
}
const within = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).every((e) => {
  const r = e.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
}), sel);
const overlap = (page, a, b) => page.evaluate(([a, b]) => {
  const A = document.querySelector(a).getBoundingClientRect(), B = document.querySelector(b).getBoundingClientRect();
  if (!document.querySelector(a).getClientRects().length || !document.querySelector(b).getClientRects().length) return false;
  return !(A.right <= B.left || B.right <= A.left || A.bottom <= B.top || B.bottom <= A.top);
}, [a, b]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `frostwing-${name}.png`) }); };

/* ---------- desktop: keyboard play from title to results ---------- */
{
  const tag = "1280x720";
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  await shot(page, "title-1280");
  await page.keyboard.press("Enter"); // PLAY has focus
  await page.waitForSelector("#select:not(.hidden)");
  check((await page.$$eval(".pcard", (c) => c.map((x) => x.dataset.pilot))).join() === "juno,pip,brann,silas", `${tag}: the pilot screen offers Juno, Pip, Brann and Silas Vane`);
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  check(await page.$eval(".pcard.sel", (c) => c.dataset.pilot) === "silas", `${tag}: arrow keys pick Silas Vane`);
  await page.click('#diff [data-d="cadet"]');
  await shot(page, "select-1280");
  await page.click("#launchBtn");
  await page.waitForFunction(() => __fw.state === "play");
  check(await page.evaluate(() => __fw.match.player.pilot === "silas" && __fw.match.diff.label === "Cadet"), `${tag}: the match starts with Silas Vane against Cadet rivals`);
  await page.evaluate(() => __fw.skipCountdown());
  await page.waitForTimeout(300);
  const y0 = await page.evaluate(() => __fw.match.player.yaw);
  await page.keyboard.down("KeyA"); await page.keyboard.down("Space");
  await page.waitForTimeout(900);
  await page.keyboard.up("KeyA");
  const r = await page.evaluate(() => ({ yaw: __fw.match.player.yaw, bolts: __fw.match.bolts.filter((b) => b.owner === __fw.match.player.id).length }));
  check(Math.abs(r.yaw - y0) > 0.3, `${tag}: A turns the ship left (yaw ${y0.toFixed(2)} to ${r.yaw.toFixed(2)})`);
  check(r.bolts > 0, `${tag}: Space fires lasers (${r.bolts} bolts in the air)`);
  await page.keyboard.up("Space");
  await page.keyboard.down("ShiftLeft"); await page.waitForTimeout(700);
  check(await page.evaluate(() => __fw.match.player.speed > 180), `${tag}: Shift boosts`);
  await page.keyboard.up("ShiftLeft");
  check(await within(page, "#sys, #board, #banner, #radar"), `${tag}: the HUD panels sit inside the window`);
  check(!(await overlap(page, "#banner", "#radar")) && !(await overlap(page, "#board", "#sys")), `${tag}: the objective banner, radar, scoreboard and systems panel do not overlap`);
  await shot(page, "play-1280");
  await page.keyboard.press("Escape");
  check(await page.evaluate(() => __fw.state === "pause") && await page.isVisible("#pause"), `${tag}: Esc pauses`);
  const t1 = await page.evaluate(() => __fw.match.time); await page.waitForTimeout(600);
  check(await page.evaluate((t) => __fw.match.time === t, t1), `${tag}: the clock stops while paused`);
  await page.click("#resumeBtn");
  check(await page.evaluate(() => __fw.state === "play"), `${tag}: Resume goes back to the fight`);
  await page.evaluate(() => __fw.fastForward(260));
  await page.waitForSelector("#results:not(.hidden)", { timeout: 10000 });
  const res = await page.evaluate(() => ({ rows: document.querySelectorAll("#tally tr").length, title: document.querySelector("#resultTitle").textContent, save: __fw.save }));
  check(res.rows === 8 && /VICTORY|DEFEAT|DRAW/.test(res.title), `${tag}: the results list all eight pilots under ${res.title}`);
  check(res.save.played === 1 && res.save.pilot === "silas", `${tag}: the result is saved (played ${res.save.played})`);
  await shot(page, "results-1280");
  await page.click("#againBtn");
  check(await page.evaluate(() => __fw.state === "play" && __fw.match.time > 200), `${tag}: Fly Again starts a fresh match`);
  check(errors.length === 0, `${tag}: no page errors (${errors.join("; ")})`);
  await ctx.close();
}

/* ---------- phones: touch layout and play ---------- */
for (const [name, dev] of [["portrait", devices["iPhone 13"]], ["landscape", devices["iPhone 13 landscape"]], ["small", { ...devices["iPhone SE"], viewport: { width: 320, height: 568 } }]]) {
  const { ctx, page, errors } = await open({ ...dev });
  const tag = `${name} ${dev.viewport.width}x${dev.viewport.height}`;
  await page.tap("#playBtn");
  await page.waitForSelector("#select:not(.hidden)");
  await shot(page, `select-${name}`);
  check(await page.evaluate(() => { const b = document.querySelector("#launchBtn"); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return r.height >= 44; }), `${tag}: Launch is at least 44 px tall`);
  await page.tap("#launchBtn");
  await page.waitForFunction(() => __fw.state === "play");
  await page.evaluate(() => __fw.skipCountdown());
  await page.waitForTimeout(200);
  check(await page.isVisible("#btns") && await page.isVisible("#stickZone"), `${tag}: touch buttons and the steering area show during play`);
  const small = await page.$$eval("#btns button, #pauseBtn", (bs) => bs.filter((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height) < 44; }).map((b) => b.id));
  check(small.length === 0, `${tag}: every touch button is at least 44 px (${small.join(", ") || "all"})`);
  check(await within(page, "#btns button, #sys, #board, #radar, #banner"), `${tag}: buttons and HUD panels sit inside the screen`);
  const clash = [];
  for (const [a, b] of [["#btns", "#radar"], ["#banner", "#board"], ["#banner", "#radar"], ["#btns", "#banner"], ["#sys", "#board"]]) if (await overlap(page, a, b)) clash.push(a + "/" + b);
  check(clash.length === 0, `${tag}: buttons, radar, banner and scoreboard do not overlap (${clash.join(", ") || "none"})`);
  // steer with the stick: drag right from the middle of the left area
  const z = await page.$eval("#stickZone", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const y0 = await page.evaluate(() => __fw.match.player.yaw);
  const cdp = await ctx.newCDPSession(page);
  const tp = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  await tp("touchStart", z.x, z.y); await tp("touchMove", z.x + 60, z.y);
  await page.waitForTimeout(700);
  const y1 = await page.evaluate(() => __fw.match.player.yaw);
  await tp("touchEnd");
  check(y1 - y0 < -0.25, `${tag}: dragging right on the left side turns the ship right (yaw ${y0.toFixed(2)} to ${y1.toFixed(2)})`);
  const f = await page.$eval("#tFire", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: f.x, y: f.y, id: 2 }] });
  await page.waitForTimeout(400);
  const bolts = await page.evaluate(() => __fw.match.bolts.filter((b) => b.owner === __fw.match.player.id).length);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  check(bolts > 0, `${tag}: holding FIRE shoots (${bolts} bolts)`);
  await page.waitForTimeout(300);
  await shot(page, `play-${name}`);
  await page.tap("#pauseBtn");
  check(await page.evaluate(() => __fw.state === "pause"), `${tag}: the pause button pauses`);
  check(errors.length === 0, `${tag}: no page errors (${errors.join("; ")})`);
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} failed` : "\nall passed");
process.exit(fails.length ? 1 : 0);
