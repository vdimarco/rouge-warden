// The seam between the arena and the story, played through the page as a player would:
// 1. NEW STORY opens on the time card with the bridge silhouette; the win hands over to the story 2.0 s
//    later (on stepped game time) and records a best time; c0 and i0 (about 62 s of cines) lead to f1 with no skipping; the
//    arena is hidden, Sedona shows, the depth range is 0.3/2600 and the save is written at f1.
//    Esc and SAVE & QUIT return to the title with CONTINUE and its summary, and the arena comes back.
// 2. After a reload, CONTINUE resumes at f1 without the fight. Autopilot then finishes f1 and e1, the
//    credits roll on game time, and KEEP PLAYING goes on to free roam.
//    A hide while CONTINUE is still loading leaves the save as it was.
// 3. ?chapter=f1 jumps straight into the story; ?mission=f1&step=3 starts at that step; ?chapter=c0 plays
//    the cold open in the arena, then i0 swaps to Sedona.
// 4. In NEW STORY, 3 deaths offer STORY ASSIST and 5 add SKIP TO THE STORY, by key (1 and 2) as well as by
//    tap; the skip hides the death card, shows THE BEAR YIELDS and reaches f1.
// 5. When the story module arrives late after a win, the arena plays on until it does.
// The story is driven through the frozen S.test handles (types.js CONTRACT), never a package's own DOM.
// No page errors anywhere.
import { open, step, stepUntil, ticksUntil, nextFrames, invariants, finish } from "./lib.mjs";

const fails = [], errs = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const state = (page) => page.evaluate(() => {
  const C = __crimson, S = C.story;
  return { state: C.game.state, mode: C.game.mode, arena: C.arenaVisible, depth: C.depth, chapter: S && S.chapter, smode: S && S.mode,
    sedona: !!(S && S.S.world.visible), end: document.getElementById("end").classList.contains("show"), body: document.body.className,
    save: JSON.parse(localStorage.getItem("crimson.story.v1") || "null"), fightStarted: C.boss.state !== "wait" };
});
const quitToTitle = async (page) => {
  await page.keyboard.press("Escape");
  await step(page, 0.05);
  const open = await page.evaluate(() => __crimson.story.S.ui.menu.isOpen && __crimson.story.mode === "menu");
  check(open, "Esc opens the story menu");
  await page.evaluate(() => __crimson.story.S.test.ui.quit()); // the menu's SAVE & QUIT
  await step(page, 0.05);
};

/* ---------------- 1 and 2: NEW STORY, the handoff, SAVE & QUIT, CONTINUE, the credits ---------------- */
{
  const { browser, page, errors } = await open({ query: "?seed=7&god&nomusic" });
  await page.evaluate(() => { __crimson.seed(7); __crimson.startGame("story"); });
  await step(page, 0.2);
  let card = await page.evaluate(() => [document.querySelector("#card h2").textContent, document.querySelector("#card p").textContent]);
  check(card[0] === "SUNDAY · 2:58 AM" && card[1] === "MIDGLEY BRIDGE", `NEW STORY opens on the time card (${card.join(" / ")})`);
  check(await page.evaluate(() => __crimson.bridgeVisible && __crimson.game.mode === "story"), "the bridge silhouette shows in NEW STORY");
  await step(page, 3.2);
  card = await page.evaluate(() => document.querySelector("#card h2").textContent);
  check(card === "GABE", `then the boss card (${card})`);
  await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 100 });
  await page.evaluate(() => __crimson.win());
  const k = await ticksUntil(page, () => __crimson.game.state === "story", 400);
  check(k === 120, `the story takes over 2.0 s after the win (${k} ticks of 1/60 s)`);
  check(await page.evaluate(() => !!localStorage.getItem("crimson.best.v1")), "the NEW STORY win records a best time");
  let r = await stepUntil(page, () => __crimson.story.chapter === "c0", { maxSec: 5 });
  let s = await state(page);
  check(r.ok && s.arena && s.smode === "play", `the cold open c0 plays in the arena (chapter ${s.chapter}, arena ${s.arena})`);
  r = await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 90 });
  s = await state(page);
  check(r.ok, `no skip: c0 and i0 lead to f1 (${r.sec} s)`);
  check(!s.arena && s.sedona, "the arena is hidden and Sedona shows");
  check(s.depth[0] === 0.3 && s.depth[1] === 2600, `the story depth range is 0.3/2600 (${s.depth})`);
  check(!!s.save && s.save.v === 1 && s.save.chapter === "f1" && s.save.summary.chapter === 3, `the save is written at f1 (${s.save && s.save.chapter})`);
  check(/\bstory\b/.test(s.body), "body.story is set");
  let inv = await invariants(page);
  check(!inv.length, `story invariants hold at f1${inv.length ? ": " + inv.join("; ") : ""}`);
  await step(page, 3);
  await quitToTitle(page);
  const t = await page.evaluate(() => ({ state: __crimson.game.state, title: !document.getElementById("title").classList.contains("hidden"), cont: !document.getElementById("modeContinue").hidden,
    sum: document.querySelector("#modeContinue small").textContent, focus: __crimson.focusMode, press: document.querySelector("#title .press").textContent, arena: __crimson.arenaVisible, depth: __crimson.depth, body: document.body.className }));
  check(t.state === "title" && t.title && t.cont && t.focus === "continue", "SAVE & QUIT returns to the title with CONTINUE in focus");
  check(t.sum === "CHAPTER 3 · TEN SEATS", `CONTINUE shows the summary (${t.sum})`);
  check(t.press === "PRESS ANY KEY TO CONTINUE", `the title says what a key does (${t.press})`);
  check(t.arena && t.depth[0] === 0.1 && t.depth[1] === 3000 && !/\bstory\b/.test(t.body), "the arena is back with its depth range");

  // CONTINUE after a reload: straight into f1, no fight
  await page.reload();
  await page.waitForFunction(() => window.__crimson && __crimson.game.ready, null, { timeout: 300000, polling: 100 });
  await page.evaluate(() => __crimson.step(0, false));
  check(await page.evaluate(() => !document.getElementById("modeContinue").hidden && __crimson.focusMode === "continue"), "after a reload the title offers CONTINUE");
  const saved = await page.evaluate(() => localStorage.getItem("crimson.story.v1"));
  await page.keyboard.press("Enter");
  // the page hides while CONTINUE is still loading: the save it is loading must stay as it is
  await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 50 });
  await page.evaluate(() => __crimson.step(1 / 60, false));
  const booting = await page.evaluate(() => __crimson.story.mode);
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  const kept = (await page.evaluate(() => localStorage.getItem("crimson.story.v1"))) === saved;
  check(booting === "boot" && kept, `a hide while CONTINUE loads leaves the save alone (mode ${booting}, save ${kept ? "kept" : "rewritten"})`);
  r = await stepUntil(page, () => __crimson.story && __crimson.story.chapter === "f1", { maxSec: 40 });
  s = await state(page);
  check(r.ok && s.state === "story" && !s.fightStarted, `CONTINUE resumes at f1 without the fight (${s.chapter})`);
  check(!s.arena && s.sedona, "CONTINUE hides the arena and shows Sedona");

  // autopilot: f1 passes, e1 rolls the credits on game time, KEEP PLAYING goes on
  await page.evaluate(() => __crimson.story.autopilot(true));
  r = await stepUntil(page, () => __crimson.story.mode === "credits", { maxSec: 60 });
  check(r.ok, `autopilot finishes f1 and e1 and rolls the credits (${r.sec} s)`);
  await nextFrames(page);
  const c = await page.evaluate(() => ({ shown: !document.getElementById("credits").classList.contains("hidden"), again: (document.getElementById("creditsAgain") || {}).textContent,
    text: document.getElementById("roll").textContent, y: getComputedStyle(document.getElementById("roll")).transform }));
  check(c.shown && c.again === "▶ KEEP PLAYING", `the credits show KEEP PLAYING (${c.again})`);
  check(c.text.includes("1-888-373-7888") && c.text.includes("Text HELP to 233733") && c.text.includes("Gabe is the best man."), "the credits carry the hotline card and the closing note");
  await step(page, 8);
  await nextFrames(page);
  const y1 = await page.evaluate(() => getComputedStyle(document.getElementById("roll")).transform);
  check(y1 !== c.y, "the credits scroll moves with stepped game time");
  await page.keyboard.press("Space");
  await step(page, 1.5);
  check(await page.evaluate(() => __crimson.story.S.test.credits && __crimson.story.S.test.credits.atEnd), "a key skips the credits to the end");
  await page.click("#creditsAgain");
  await step(page, 0.2);
  s = await state(page);
  const obj = await page.evaluate(() => __crimson.story.S.test.ui.objective);
  check(s.smode === "play" && !(await page.evaluate(() => !document.getElementById("credits").classList.contains("hidden"))) && /Free roam/.test(obj), `KEEP PLAYING goes on to free roam (${obj})`);
  check(!!s.save && s.save.done.includes("e1"), "the save records the finished story");
  inv = await invariants(page);
  check(!inv.length, `story invariants hold in free roam${inv.length ? ": " + inv.join("; ") : ""}`);
  errs.push(...errors);
  await browser.close();
}

/* ---------------- 3: ?chapter=f1 and ?mission=f1&step=3 ---------------- */
{
  const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic" });
  const r = await stepUntil(page, () => __crimson.story && __crimson.story.chapter === "f1", { maxSec: 40 });
  const s = await state(page);
  check(r.ok && s.state === "story" && !s.fightStarted && !s.arena, `?chapter=f1 jumps into f1 without the fight (${s.chapter})`);
  errs.push(...errors);
  await browser.close();
}
{
  const { browser, page, errors } = await open({ query: "?mission=f1&step=3&seed=7&nomusic" });
  const r = await stepUntil(page, () => __crimson.story && __crimson.story.mission && __crimson.story.mission.id === "f1", { maxSec: 40 });
  const m = await page.evaluate(() => __crimson.story.mission && { ...__crimson.story.mission, chapter: __crimson.story.chapter });
  check(r.ok && m.step === 3 && m.type === "drive" && m.chapter === "f1", `?mission=f1&step=3 starts f1 at its drive step (${m && m.type} ${m && m.step})`);
  errs.push(...errors);
  await browser.close();
}
{
  const { browser, page, errors } = await open({ query: "?chapter=c0&seed=7&nomusic" });
  const r = await stepUntil(page, () => __crimson.story && __crimson.story.chapter === "c0" && __crimson.story.mode === "play", { maxSec: 20, chunk: 1 / 60, realMs: 5 });
  let s = await state(page);
  check(r.ok && s.arena && !s.sedona && s.depth[0] === 0.1 && s.depth[1] === 3000, `?chapter=c0 plays the cold open in the arena (arena ${s.arena}, sedona ${s.sedona}, depth ${s.depth})`);
  const r2 = await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 90 });
  s = await state(page);
  check(r2.ok && !s.arena && s.sedona, `then i0 swaps to Sedona and f1 starts (arena ${s.arena}, sedona ${s.sedona})`);
  errs.push(...errors);
  await browser.close();
}

/* ---------------- 4: STORY ASSIST at 3 deaths, SKIP TO THE STORY at 5 ---------------- */
{
  const { browser, page, errors } = await open({ query: "?seed=7&god&nomusic" });
  await page.evaluate(() => { __crimson.seed(7); __crimson.startGame("story"); });
  await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 100 });
  for (let d = 1; d <= 5; d++) {
    await step(page, 0.5);
    await page.evaluate(() => __crimson.die());
    const k = await ticksUntil(page, () => __crimson.game.state === "end", 400);
    const a = await page.evaluate(() => ({ deaths: __crimson.game.deaths, box: !document.getElementById("endAssist").hidden, assist: !document.getElementById("assistBtn").hidden, skip: !document.getElementById("skipBtn").hidden }));
    if (d === 1) check(k === 156, `the death card comes 2.6 s after a death (${k} ticks)`);
    if (d < 3) check(!a.box, `no assist buttons after ${d} death(s)`);
    if (d === 3) {
      check(a.box && a.assist && !a.skip, "3 deaths offer STORY ASSIST only");
      const keys = await page.evaluate(() => [document.getElementById("assistKey").textContent, document.getElementById("skipKey").textContent]);
      check(keys.join(",") === "1,2", `the buttons show their keys (${keys.join(", ")})`);
      await page.waitForTimeout(950); // the card takes keys once it has settled (0.9 s)
      await page.keyboard.press("Digit1");
      await step(page, 0.1);
      const as = await page.evaluate(() => ({ on: __crimson.game.assist, state: __crimson.game.state, parry: __crimson.player.stats.parryWin }));
      check(as.on && as.state === "fight" && Math.abs(as.parry - 0.38) < 1e-9, `STORY ASSIST restarts the fight with assist on (parry window ${as.parry})`);
      continue;
    }
    if (d === 4) check(a.box && !a.assist && !a.skip, "with assist on, 4 deaths show no more buttons");
    if (d < 5) { await page.evaluate(() => __crimson.restart()); continue; }
    check(a.box && a.skip, "5 deaths offer SKIP TO THE STORY");
    await page.waitForTimeout(950);
    await page.keyboard.press("Digit2");
    await step(page, 0.3);
    let s = await state(page);
    // the real world may still be building in its worker (real time): the loading card shows first, then the title card
    await stepUntil(page, () => __crimson.story && __crimson.story.S.test.ui.card === "THE BEAR YIELDS", { maxSec: 20, chunk: 0.1, realMs: 100 });
    const card = await page.evaluate(() => __crimson.story && __crimson.story.S.test.ui.card);
    check(s.state === "story" && !s.end && !s.arena, `the skip hides the death card and the arena (end ${s.end}, arena ${s.arena})`);
    check(card === "THE BEAR YIELDS", `the skip opens on THE BEAR YIELDS (${card})`);
    const r = await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 60 }); // i0 plays its 34 s in full
    s = await state(page);
    check(r.ok && !s.end, `the skip path reaches f1 by way of i0 (${s.chapter})`);
    const ronin = await page.evaluate(() => __crimson.player.state);
    check(ronin !== "dead", `the skip stands the ronin back up (${ronin})`);
  }
  errs.push(...errors);
  await browser.close();
}

/* ---------------- 5: the story module arrives late after a win ---------------- */
{
  const { browser, page, errors } = await open({ query: "?seed=7&god&nomusic" });
  let release = null;
  const held = new Promise((res) => { release = res; });
  await page.route("**/js/story/index.js", async (route) => { await held; route.continue(); });
  await page.evaluate(() => { __crimson.seed(7); __crimson.startGame("story"); });
  await step(page, 1);
  await page.evaluate(() => __crimson.win());
  const k = await ticksUntil(page, () => __crimson.game.state === "story", 400);
  const t0 = await page.evaluate(() => ({ loaded: __crimson.storyLoaded, time: __crimson.game.time, cam: __crimson.cam.pos.toArray() }));
  await step(page, 1);
  const t1 = await page.evaluate(() => ({ loaded: __crimson.storyLoaded, time: __crimson.game.time, cam: __crimson.cam.pos.toArray() }));
  check(k === 120 && !t0.loaded && !t1.loaded && t1.time - t0.time > 0.9, `while the story loads after a win, the arena plays on (game time ${t0.time.toFixed(2)} to ${t1.time.toFixed(2)})`);
  release();
  await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 100 });
  const r = await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 90 });
  check(r.ok, `once it arrives, the story runs the cold open and reaches f1 (${r.sec} s)`);
  errs.push(...errors);
  await browser.close();
}

await finish("handoff", fails, null, errs);
