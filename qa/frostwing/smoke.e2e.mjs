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
// Gameplay checks run on Fast graphics: software WebGL draws High (shadows and bloom) at about 2 fps, too slow for
// timing checks. A separate block below starts High and checks the models, shadows and bloom load without errors.
async function open(opts, gfx = 0) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.addInitScript((g) => { try { const k = "frostwing.save.v1", s = JSON.parse(localStorage.getItem(k) || "{}"); if (s.gfx === undefined) localStorage.setItem(k, JSON.stringify({ ...s, gfx: g })); } catch (e) { /* storage off */ } }, gfx);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__fw && __fw.state === "title" && !document.querySelector("#playBtn").disabled, null, { timeout: 30000 });
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
// wait for game time, not wall time: software WebGL can run the game well below real time
const gameWait = (page, sec) => page.evaluate((sec) => new Promise((done) => { const t0 = __fw.match.time; const tick = () => (t0 - __fw.match.time >= sec || __fw.match.over || __fw.state !== "play" ? done() : setTimeout(tick, 30)); tick(); }), sec);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `frostwing-${name}.png`) }); };

/* ---------- desktop: keyboard play from title to results ---------- */
{
  const tag = "1280x720";
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  await shot(page, "title-1280");
  check(await page.evaluate(() => document.activeElement && document.activeElement.id) === "storyBtn", `${tag}: the title opens with STORY in focus`);
  const quiet0 = await page.evaluate(() => __fw.music);
  check(quiet0.wanted === "title" && !quiet0.playing, `${tag}: no music plays before the player's first tap or key`);
  await page.mouse.click(640, 60); // a click on the title art, not on a button
  await page.waitForFunction(() => __fw.music.playing, null, { timeout: 8000 }).catch(() => {});
  const m0 = await page.evaluate(() => __fw.music);
  check(m0.track === "title" && m0.playing, `${tag}: the first click anywhere starts the title theme (${JSON.stringify(m0)})`);
  await page.click("#playBtn"); // QUICK MATCH
  await page.waitForSelector("#select:not(.hidden)");
  check((await page.$$eval(".pcard", (c) => c.map((x) => x.dataset.pilot))).join() === "juno,pip,brann,silas", `${tag}: the pilot screen offers Juno, Pip, Brann and Silas Vane`);
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  check(await page.$eval(".pcard.sel", (c) => c.dataset.pilot) === "silas", `${tag}: arrow keys pick Silas Vane`);
  await page.click('#diff [data-d="cadet"]');
  await shot(page, "select-1280");
  await page.click("#launchBtn");
  await page.waitForFunction(() => __fw.state === "play");
  check(await page.evaluate(() => __fw.match.player.pilot === "silas" && __fw.match.diff.label === "Cadet"), `${tag}: the match starts with Silas Vane against Cadet rivals`);
  check(await page.evaluate(() => __fw.music.track === "battleA" && __fw.music.playing), `${tag}: a match by day plays the first battle theme`);
  await page.evaluate(() => __fw.skipCountdown());
  await page.waitForTimeout(300);
  const y0 = await page.evaluate(() => __fw.match.player.yaw);
  await page.keyboard.down("KeyA"); await page.keyboard.down("Space");
  await gameWait(page, 0.9);
  await page.keyboard.up("KeyA");
  const r = await page.evaluate(() => ({ yaw: __fw.match.player.yaw, bolts: __fw.match.bolts.filter((b) => b.owner === __fw.match.player.id).length }));
  check(Math.abs(r.yaw - y0) > 0.3, `${tag}: A turns the ship left (yaw ${y0.toFixed(2)} to ${r.yaw.toFixed(2)})`);
  check(r.bolts > 0, `${tag}: Space fires lasers (${r.bolts} bolts in the air)`);
  await page.keyboard.up("Space");
  await page.keyboard.down("ShiftLeft"); await gameWait(page, 0.8);
  check(await page.evaluate(() => __fw.match.player.speed > 180), `${tag}: Shift boosts`);
  await page.keyboard.up("ShiftLeft");
  check(await within(page, "#sys, #board, #banner, #radar"), `${tag}: the HUD panels sit inside the window`);
  check(!(await overlap(page, "#banner", "#radar")) && !(await overlap(page, "#board", "#sys")), `${tag}: the objective banner, radar, scoreboard and systems panel do not overlap`);
  await shot(page, "play-1280");
  await page.keyboard.press("Escape");
  check(await page.evaluate(() => __fw.state === "pause") && await page.isVisible("#pause"), `${tag}: Esc pauses`);
  check(await page.evaluate(() => !__fw.music.playing), `${tag}: the music pauses with the game`);
  const t1 = await page.evaluate(() => __fw.match.time); await page.waitForTimeout(600);
  check(await page.evaluate((t) => __fw.match.time === t, t1), `${tag}: the clock stops while paused`);
  await page.click("#resumeBtn");
  check(await page.evaluate(() => __fw.state === "play"), `${tag}: Resume goes back to the fight`);
  await page.waitForFunction(() => __fw.music.playing, null, { timeout: 5000 }).catch(() => {});
  check(await page.evaluate(() => __fw.music.track === "battleA" && __fw.music.playing), `${tag}: the battle theme resumes`);
  await page.evaluate(() => __fw.fastForward(260));
  await page.waitForSelector("#results:not(.hidden)", { timeout: 10000 });
  const res = await page.evaluate(() => ({ rows: document.querySelectorAll("#tally tr").length, title: document.querySelector("#resultTitle").textContent, save: __fw.save }));
  check(res.rows === 8 && /VICTORY|DEFEAT|DRAW/.test(res.title), `${tag}: the results list all eight pilots under ${res.title}`);
  const sting = await page.evaluate(() => __fw.music.track);
  check(res.title === "DRAW" ? sting === "title" : sting === (res.title === "VICTORY" ? "win" : "lose"), `${tag}: the match ends on the ${res.title === "VICTORY" ? "victory" : res.title === "DEFEAT" ? "defeat" : "title"} music (${sting})`);
  const after = await page.waitForFunction(() => __fw.music.track === "title" && __fw.music.playing, null, { timeout: 25000 }).then(() => true, () => false);
  check(after, `${tag}: after the sting the title theme plays under the results`);
  check(res.save.played === 1 && res.save.pilot === "silas", `${tag}: the result is saved (played ${res.save.played})`);
  await shot(page, "results-1280");
  await page.click("#againBtn");
  check(await page.evaluate(() => __fw.state === "play" && __fw.match.time > 200), `${tag}: Fly Again starts a fresh match`);
  check(errors.length === 0, `${tag}: no page errors (${errors.join("; ")})`);
  await ctx.close();
}

/* ---------- desktop: the story, its cut scenes and the logbook ---------- */
{
  const tag = "1280x720 story";
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  await page.click("#logBtn");
  const log0 = await page.evaluate(() => ({ all: document.querySelectorAll("#logList article").length, locked: document.querySelectorAll("#logList article.locked").length }));
  check(log0.all === 16 && log0.locked === 8, `${tag}: a new logbook shows 16 entries, 8 of them locked (${log0.all}, ${log0.locked} locked)`);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter"); // STORY has focus
  await page.waitForSelector("#scene:not(.hidden)");
  const s1 = await page.evaluate(() => ({ title: document.querySelector("#sceneTitle").textContent, layer: !!document.querySelector("#sceneStage .layer.on"), box: document.querySelector("#sceneBox").className, left: __fw.story.left }));
  check(await page.evaluate(() => __fw.music.track === "story"), `${tag}: a cut scene plays the story underscore`);
  check(s1.title === "HOLLOWMERE" && s1.layer && s1.box === "narr" && s1.left === 5, `${tag}: STORY opens the prologue: a still, a narrator caption and five more slides (${JSON.stringify(s1)})`);
  await page.waitForTimeout(250);
  const typed = await page.textContent("#sceneText");
  await page.keyboard.press("Enter");
  const whole = await page.textContent("#sceneText");
  check(typed.length < whole.length && whole === await page.evaluate(() => __fw.story.text) && await page.evaluate(() => __fw.story.left) === 5, `${tag}: the caption types out, and the first Enter finishes the line without leaving the slide (${typed.length} of ${whole.length} characters typed)`);
  await page.keyboard.press("Enter");
  check(await page.evaluate(() => __fw.story.left) === 4, `${tag}: the next Enter goes to the next slide`);
  for (let i = 0; i < 8; i++) await page.keyboard.press("Enter"); // to the last slide, a line of dialogue
  const s2 = await page.evaluate(() => ({ box: document.querySelector("#sceneBox").className, who: document.querySelector("#sceneWho").textContent, face: document.querySelector("#sceneFace").getAttribute("src"), next: document.querySelector("#sceneNext").textContent }));
  check(s2.box === "t0" && /^JUNO REYES/.test(s2.who) && s2.face === "art/juno.webp" && /CONTINUE/.test(s2.next), `${tag}: a pilot's line shows their portrait and name, and the last slide's button reads CONTINUE (${JSON.stringify(s2)})`);
  check(await within(page, "#sceneBox, #sceneBtns .btn"), `${tag}: the caption and the Next and Skip buttons sit inside the window`);
  await shot(page, "scene-1280");
  await page.click("#sceneSkip");
  check(await page.evaluate(() => __fw.state === "scene" && document.querySelector("#sceneTitle").textContent === "OPERATION 1 · FIRST LIGHT" && !!document.querySelector("#sceneStage .layer")), `${tag}: after the prologue the briefing for Operation 1 starts, with its still`);
  await page.keyboard.press("Escape");
  await page.waitForSelector("#select:not(.hidden)");
  const sel = await page.evaluate(() => ({ title: document.querySelector("#selTitle").textContent, cards: [...document.querySelectorAll(".pcard")].map((c) => c.dataset.pilot).join(), diff: document.querySelector("#diff").classList.contains("hidden"), line: document.querySelector("#opLine").textContent }));
  check(sel.title === "OPERATION 1 · FIRST LIGHT" && sel.cards === "juno,pip,brann" && sel.diff && /Brannoch Vale/.test(sel.line), `${tag}: Esc skips to the pilot screen for Operation 1 with three pilots and no rival setting (${sel.cards})`);
  await page.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
  await page.click("#launchBtn");
  const m = await page.evaluate(() => ({ ships: __fw.match.ships.map((s) => s.pilot).join(), len: __fw.match.length, weather: __fw.look.weather }));
  check(m.ships === "juno,pip,brann,nyra,grell,sable" && m.len === 180 && m.weather === "day", `${tag}: Operation 1 is three on three for three minutes by day (${JSON.stringify(m)})`);
  // lose it first
  await page.evaluate(() => { __fw.skipCountdown(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { __fw.match.score[1] = 900; __fw.fastForward(400); });
  await page.waitForSelector("#results:not(.hidden)", { timeout: 20000 });
  const lost = await page.evaluate(() => ({ title: document.querySelector("#resultTitle").textContent, cont: document.querySelector("#contBtn").classList.contains("hidden"), again: document.querySelector("#againBtn").textContent, note: document.querySelector("#resultNote").textContent, won: __fw.story.won }));
  check(lost.title === "OPERATION FAILED" && lost.cont && lost.again === "TRY AGAIN" && /Juno Reyes/.test(lost.note) && lost.won === 0, `${tag}: a lost operation reads OPERATION FAILED with TRY AGAIN and a line from the squad, and saves no progress`);
  await page.click("#againBtn");
  await page.evaluate(() => { __fw.skipCountdown(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { __fw.match.score[0] = 900; __fw.fastForward(400); });
  await page.waitForSelector("#results:not(.hidden)", { timeout: 20000 });
  const won = await page.evaluate(() => ({ title: document.querySelector("#resultTitle").textContent, cont: !document.querySelector("#contBtn").classList.contains("hidden"), won: __fw.story.won, saved: __fw.save.story }));
  check(won.title === "OPERATION COMPLETE" && won.cont && won.won === 1 && won.saved === 1, `${tag}: a won operation reads OPERATION COMPLETE, offers CONTINUE and saves the progress`);
  await page.click("#contBtn");
  await page.waitForSelector("#scene:not(.hidden)");
  await page.click("#sceneSkip"); // the debrief
  const b2 = await page.evaluate(() => ({ title: document.querySelector("#sceneTitle").textContent, layer: !!document.querySelector("#sceneStage .layer"), op: __fw.story.op }));
  check(b2.title === "OPERATION 2 · EMBERS AT DUSK" && b2.layer && b2.op === 1, `${tag}: after the debrief the briefing for Operation 2 starts, with its still`);
  await page.click("#sceneSkip");
  await page.waitForSelector("#select:not(.hidden)");
  check((await page.$$eval(".pcard", (c) => c.map((x) => x.dataset.pilot))).join() === "juno,pip,brann,silas", `${tag}: Silas Vane joins the pilot screen in Operation 2`);
  await page.click('.pcard[data-pilot="silas"]');
  await page.click("#launchBtn");
  const m2 = await page.evaluate(() => ({ n: __fw.match.ships.length, weather: __fw.look.weather, me: __fw.match.player.pilot }));
  check(m2.n === 8 && m2.weather === "dusk" && m2.me === "silas", `${tag}: Operation 2 is four on four at dusk (${JSON.stringify(m2)})`);
  await page.keyboard.press("Escape"); await page.click("#quitBtn");
  const t = await page.evaluate(() => ({ best: document.querySelector("#best").textContent, btn: document.querySelector("#storyBtn").textContent }));
  check(/Story: operation 2 of 5/.test(t.best) && t.btn === "CONTINUE STORY", `${tag}: the title shows the story progress and CONTINUE STORY ("${t.best}")`);
  await page.click("#logBtn");
  check(await page.evaluate(() => document.querySelectorAll("#logList article.locked").length) === 6, `${tag}: winning Operation 1 opens two more logbook entries`);
  await shot(page, "log-1280");
  // the last operation: Vex flies the Nightjar, and winning it ends the story
  await page.keyboard.press("Escape");
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("frostwing.save.v1")); s.story = 4; s.log = 4; localStorage.setItem("frostwing.save.v1", JSON.stringify(s)); });
  await page.reload();
  await page.waitForFunction(() => window.__fw && !document.querySelector("#storyBtn").disabled, null, { timeout: 30000 });
  await page.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
  await page.click("#storyBtn"); await page.click("#sceneSkip"); await page.click("#launchBtn");
  const m5 = await page.evaluate(() => { const v = __fw.match.ships.find((s) => s.pilot === "vex"); return { boss: v.boss, shield: v.maxShield, weather: __fw.look.weather, len: __fw.match.length }; });
  check(await page.evaluate(() => __fw.music.track === "battleB"), `${tag}: Operation 5 plays the second battle theme`);
  check(m5.boss && m5.shield > 200 && m5.weather === "dawn" && m5.len === 240, `${tag}: in Operation 5 Vex flies the Nightjar with a ${m5.shield}-point shield, at dawn`);
  await page.evaluate(() => { __fw.skipCountdown(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { __fw.match.score[0] = 900; __fw.fastForward(400); });
  await page.waitForSelector("#results:not(.hidden)", { timeout: 20000 });
  await page.click("#contBtn"); await page.click("#sceneSkip");
  const end = await page.evaluate(() => ({ state: __fw.state, best: document.querySelector("#best").textContent, btn: document.querySelector("#storyBtn").textContent, done: __fw.save.storyDone }));
  check(end.state === "title" && /Story complete/.test(end.best) && end.btn === "REPLAY STORY" && end.done === 1, `${tag}: winning Operation 5 plays the ending, returns to the title and marks the story complete`);
  check(errors.length === 0, `${tag}: no page errors (${errors.join("; ")})`);
  await ctx.close();
}

/* ---------- desktop: High graphics start cleanly ---------- */
{
  const tag = "1280x720 high";
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, 1);
  const look = await page.evaluate(() => __fw.look);
  check(look.ready && look.high, `${tag}: the generated models load and High graphics are on (${JSON.stringify(look)})`);
  await page.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; __fw.launch("silas", "ace"); __fw.skipCountdown(); });
  await page.waitForTimeout(2500);
  for (const w of ["dusk", "night", "storm", "day"]) await page.evaluate((w) => __fw.weather(w), w);
  await page.waitForTimeout(1500);
  await shot(page, "play-high");
  check(errors.length === 0, `${tag}: a match with shadows, bloom and every weather runs with no page errors (${errors.join("; ")})`);
  await ctx.close();
}

/* ---------- desktop: mouse flight ---------- */
{
  const tag = "1280x720 mouse";
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  // Launch asks for the pointer. Refuse it here, so the test drives the stand-in lock and sees the hint first.
  check(await page.evaluate(() => { let asked = false; HTMLCanvasElement.prototype.requestPointerLock = function () { asked = true; }; __fw.launch("juno", "cadet"); return asked; }), `${tag}: Launch asks to capture the mouse`);
  await page.evaluate(() => __fw.skipCountdown());
  await page.waitForTimeout(300);
  check(await page.isVisible("#mouseHint"), `${tag}: before the mouse is captured, the screen says to click to fly with the mouse`);
  await page.evaluate(() => __fw.fakeLock(true)); // headless Chromium cannot take pointer lock
  const y0 = await page.evaluate(() => __fw.match.player.yaw);
  // keep the mouse moving right for about a second: one burst of moves every animation frame
  const mid = await page.evaluate(() => new Promise((done) => {
    let top = 0; const g0 = __fw.match.time;
    const tick = () => { for (let i = 0; i < 3; i++) dispatchEvent(new MouseEvent("mousemove", { movementX: 10, movementY: 0 })); top = Math.max(top, __fw.fly.x); if (g0 - __fw.match.time < 1) requestAnimationFrame(tick); else done({ yaw: __fw.match.player.yaw, x: top }); };
    requestAnimationFrame(tick);
  }));
  check(mid.x > 0.4 && mid.yaw - y0 < -0.15, `${tag}: moving the mouse right pushes the stick right and turns the ship right (stick ${mid.x.toFixed(2)}, yaw ${y0.toFixed(2)} to ${mid.yaw.toFixed(2)})`);
  check(await page.isVisible("#mouseStick") && !(await page.isVisible("#mouseHint")), `${tag}: the stick ring shows and the hint hides once the mouse is captured`);
  await page.waitForTimeout(1500);
  const rest = await page.evaluate(() => __fw.fly.x);
  check(Math.abs(rest) < 0.15, `${tag}: the stick eases back to centre when the mouse stops (${rest.toFixed(2)})`);
  const p0 = await page.evaluate(() => __fw.match.player.pitch);
  await page.evaluate(() => new Promise((done) => { const g0 = __fw.match.time; const tick = () => { for (let i = 0; i < 3; i++) dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: -10 })); if (g0 - __fw.match.time < 0.8) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); }));
  check(await page.evaluate((p) => __fw.match.player.pitch - p > 0.1, p0), `${tag}: moving the mouse up climbs`);
  await page.mouse.move(640, 360); await page.mouse.down();
  await gameWait(page, 0.4);
  const bolts = await page.evaluate(() => __fw.match.bolts.filter((b) => b.owner === __fw.match.player.id).length);
  await page.mouse.up();
  check(bolts > 0, `${tag}: the left button fires (${bolts} bolts)`);
  await page.evaluate(() => __fw.fakeLock(false));
  check(await page.evaluate(() => __fw.state === "pause"), `${tag}: losing the mouse capture pauses the match`);
  check(errors.length === 0, `${tag}: no page errors (${errors.join("; ")})`);
  await ctx.close();
}

/* ---------- phones: touch layout and play ---------- */
for (const [name, dev] of [["portrait", devices["iPhone 13"]], ["landscape", devices["iPhone 13 landscape"]], ["small", { ...devices["iPhone SE"], viewport: { width: 320, height: 568 } }]]) {
  const { ctx, page, errors } = await open({ ...dev });
  const tag = `${name} ${dev.viewport.width}x${dev.viewport.height}`;
  await page.tap("#storyBtn");
  await page.waitForSelector("#scene:not(.hidden)");
  await page.tap("#sceneNext"); await page.waitForTimeout(700);
  const fit = await page.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect(), box = r("#sceneBox"), btn = r("#sceneBtns"), t = document.querySelector("#sceneText");
    return { inside: box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && btn.bottom <= innerHeight + 1, apart: box.bottom <= btn.top + 1, small: [...document.querySelectorAll("#sceneBtns .btn")].filter((b) => b.getBoundingClientRect().height < 44).length, clipped: t.scrollHeight > t.clientHeight + 1 }; });
  check(fit.inside && fit.apart && fit.small === 0 && !fit.clipped, `${tag}: a cut scene's caption fits the screen above 44 px Next and Skip buttons (${JSON.stringify(fit)})`);
  await shot(page, `scene-${name}`);
  await page.tap("#sceneSkip"); await page.tap("#sceneSkip");
  await page.waitForSelector("#select:not(.hidden)");
  await page.tap("#backBtn");
  await page.tap("#playBtn");
  await page.waitForSelector("#select:not(.hidden)");
  await shot(page, `select-${name}`);
  check(await page.evaluate(() => { const b = document.querySelector("#launchBtn"); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return r.height >= 44; }), `${tag}: Launch is at least 44 px tall`);
  await page.tap("#launchBtn");
  await page.waitForFunction(() => __fw.state === "play");
  await page.evaluate(() => __fw.skipCountdown());
  await page.waitForTimeout(200);
  check(await page.isVisible("#btns") && await page.isVisible("#stickZone"), `${tag}: touch buttons and the drag area show during play`);
  const ids = (await page.$$eval("#btns button", (bs) => bs.map((b) => b.id))).join();
  check(ids === "tRoll,tUturn,tBomb,tBoost", `${tag}: the touch buttons are roll, U-turn, bomb and boost, with no fire or lock button (${ids})`);
  const small = await page.$$eval("#btns button, #pauseBtn", (bs) => bs.filter((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height) < 44; }).map((b) => b.id));
  check(small.length === 0, `${tag}: every touch button is at least 44 px (${small.join(", ") || "all"})`);
  check(await within(page, "#btns button, #sys, #board, #radar, #banner"), `${tag}: buttons and HUD panels sit inside the screen`);
  const clash = [];
  for (const [a, b] of [["#btns", "#radar"], ["#banner", "#board"], ["#banner", "#radar"], ["#btns", "#banner"], ["#sys", "#board"]]) if (await overlap(page, a, b)) clash.push(a + "/" + b);
  check(clash.length === 0, `${tag}: buttons, radar, banner and scoreboard do not overlap (${clash.join(", ") || "none"})`);
  check(await page.isVisible("#touchHint"), `${tag}: a hint says to drag to steer and tap a rival`);
  const cdp = await ctx.newCDPSession(page);
  const tp = (type, x, y, id = 1) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id }] });
  const vp = dev.viewport;
  // keep the rivals out of the way and give the player a clean start
  await page.evaluate(() => { const m = __fw.match; for (const s of m.ships) if (s.team === 1) { s.alive = false; s.respawn = 1e9; } m.bolts.length = 0; });
  // a quick tap on open sky: no steering, no lasers
  const y00 = await page.evaluate(() => __fw.match.player.yaw);
  await tp("touchStart", vp.width * 0.3, vp.height * 0.5); await tp("touchEnd");
  await gameWait(page, 0.2);
  const tap0 = await page.evaluate(() => ({ lasers: __fw.match.bolts.filter((b) => b.owner === __fw.match.player.id && b.kind === "laser").length, yaw: __fw.match.player.yaw }));
  check(tap0.lasers === 0 && Math.abs(tap0.yaw - y00) < 0.05, `${tag}: a quick tap does not steer or fire the lasers`);
  // drag from the right half of the screen: the whole screen steers, and the lasers fire while the finger steers
  const sx = vp.width * 0.62, sy = vp.height * 0.45;
  const y0 = await page.evaluate(() => __fw.match.player.yaw);
  await tp("touchStart", sx, sy); await tp("touchMove", sx + 30, sy); await tp("touchMove", sx + 60, sy);
  await gameWait(page, 1);
  const d = await page.evaluate(() => ({ yaw: __fw.match.player.yaw, lasers: __fw.match.bolts.filter((b) => b.owner === __fw.match.player.id && b.kind === "laser").length, stick: getComputedStyle(document.querySelector("#stick")).display }));
  check(d.yaw - y0 < -0.25, `${tag}: a drag to the right, started on the right half of the screen, turns the ship right (yaw ${y0.toFixed(2)} to ${d.yaw.toFixed(2)})`);
  check(d.lasers > 0 && d.stick === "block", `${tag}: the lasers fire while a finger steers, and a ring shows where the drag began (${d.lasers} bolts)`);
  await tp("touchEnd");
  check(await page.evaluate(() => getComputedStyle(document.querySelector("#stick")).display === "none" && !__fw.touch.active), `${tag}: lifting the finger ends the steering`);
  // tap a rival: a homing shot goes after that ship
  const foe = await page.evaluate(() => {
    const m = __fw.match, me = m.player, f = __fw.S.forward(me.yaw, me.pitch), o = m.ships.find((s) => s.team === 1);
    Object.assign(o, { alive: true, respawn: 0, invuln: 0, human: true, x: me.x + f.x * 260 + 30, y: me.y + f.y * 260 + 14, z: me.z + f.z * 260, yaw: me.yaw, pitch: me.pitch });
    o.input.yaw = 0; o.input.pitch = 0;
    return o.id;
  });
  await page.waitForTimeout(400); // let the camera settle on the new frame
  const at = await page.evaluate((id) => __fw.screenOf(id), foe);
  await tp("touchStart", at.x, at.y); await tp("touchEnd");
  await gameWait(page, 0.1);
  const q = await page.evaluate((id) => { const m = __fw.match, me = m.player; return { shots: m.bolts.filter((b) => b.owner === me.id && b.kind === "charge").map((b) => b.target), cd: me.quickCd, id }; }, foe);
  check(at.front && q.shots.length >= 1 && q.shots.every((t) => t === foe) && q.cd > 0, `${tag}: a tap on a rival sends a homing shot at that ship and starts the recharge (${q.shots.length} shot, ${q.cd.toFixed(1)} s)`);
  await tp("touchStart", at.x, at.y); await tp("touchEnd");
  await gameWait(page, 0.1);
  const again = await page.evaluate(() => { const m = __fw.match; return m.bolts.filter((b) => b.owner === m.player.id && b.kind === "charge").length; });
  check(again === q.shots.length, `${tag}: a second tap during the recharge fires nothing`);
  check(!(await page.isVisible("#touchHint")), `${tag}: the hint goes once the player has dragged and tapped`);
  // the roll button rolls
  const rb = await page.$eval("#tRoll", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await tp("touchStart", rb.x, rb.y);
  await gameWait(page, 0.1);
  const rolled = await page.evaluate(() => __fw.match.player.roll > 0 && __fw.match.player.rollDir === 1);
  await tp("touchEnd");
  check(rolled, `${tag}: the ROLL button rolls right when the finger is not steering`);
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
