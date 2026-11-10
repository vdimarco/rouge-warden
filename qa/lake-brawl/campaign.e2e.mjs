// Plays the Lake Brawl campaign from the title to the epilogue: node qa/lake-brawl/campaign.e2e.mjs
// Serve public/ first (for example: python3 -m http.server 8765 --directory public), or set ARCADE_URL.
// Needs Playwright (NODE_PATH=qa/browser/node_modules). Fights are stepped by the game's own update loop
// through window.dbg and ended with one real kick on a rival left at 1 health, so the run takes seconds.
// Exit code 1 on failure.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = (process.env.ARCADE_URL || "http://localhost:8765/").replace(/\/?$/, "/");
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); return ok; };

// helpers that run in the page
const HELPERS = () => {
  const d = window.dbg;
  window.step = (s) => { for (let i = 0; i < s * 60; i++) { d.update(1 / 60); d.draw(); for (const k in d.pressed) delete d.pressed[k]; } };
  window.key = (k) => { d.pressed[k] = true; window.step(0.04); };
  window.tap = (x, y) => { const c = document.getElementById("front"), b = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent("pointerdown", { clientX: b.left + x / 960 * b.width, clientY: b.top + y / 540 * b.height, bubbles: true })); window.step(0.04); };
  // from a chapter card: start the fight, land one kick on a rival at 1 health, wait for the result screen
  window.winFight = () => {
    window.key("Enter"); window.step(1.8);
    const g = d.game, was = { phase: g.phase, stage: g.stage, foe: g.p2.name, power: g.p2.power };
    g.ai.t = 9; g.ai.block = -9; g.p2.hp = 1; g.p2.block = false; g.p1.x = g.p2.x - 100; g.p1.facing = 1;
    d.startAtk(g.p1, "kick"); window.step(0.4); window.step(3.5);
    return { ...was, end: d.game.phase, won: d.game.winner === d.game.p1 };
  };
};

const browser = await chromium.launch();
try {
  /* ----- a damaged save does not break the page ----- */
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("lake-brawl.save.v1", JSON.stringify({ cleared: 5, run: { p1: 99, foes: "x", stage: 2 } })));
    await page.goto(BASE + "lake-brawl/");
    await page.waitForFunction(() => window.dbg && window.dbg.ROSTER.every((c) => c.sprites.ready));
    await page.evaluate(HELPERS);
    const r = await page.evaluate(() => { window.step(0.1); window.key("Enter"); window.step(0.1); return { phase: window.dbg.game.phase, mode: window.dbg.run.mode, cleared: window.dbg.save.cleared, run: window.dbg.save.run }; });
    check(errors.length === 0, "a save with the wrong shapes raises no page error" + (errors.length ? ": " + errors[0] : ""));
    check(Array.isArray(r.cleared) && r.cleared.length === 0 && r.run === null, "the damaged save is read as no campaign and no cleared leaders");
    check(r.phase === "select" && r.mode === "campaign", "the first title line is Campaign, not Continue, and opens leader select");
    await ctx.close();
  }

  /* ----- the campaign, start to finish ----- */
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "lake-brawl/");
  await page.waitForFunction(() => window.dbg && window.dbg.ROSTER.every((c) => c.sprites.ready && c.art.naturalWidth > 0));
  check(true, "all 14 leaders have eight pose sprites and a portrait");
  await page.evaluate(HELPERS);
  check(await page.evaluate(() => { window.step(0.1); const b = document.querySelector("[data-switch]"); return !!b && b.getClientRects().length > 0 && b.getBoundingClientRect().height >= 44; }), "the title shows a Switch game button at least 44 px tall");

  // touch: leader select has a way back to the title at step 0
  let r = await page.evaluate(() => { window.key("Enter"); const a = window.dbg.game.phase; window.tap(480, 40); return [a, window.dbg.game.phase]; });
  check(r[0] === "select" && r[1] === "title", "a tap above the leader grid at step 0 goes back to the title");
  check(await page.evaluate(() => { window.step(0.1); return !document.body.classList.contains("fighting"); }), "the touch pad is not shown on the title");

  r = await page.evaluate(() => {
    const d = window.dbg;
    window.key("Enter"); d.sel.cur = 1; window.key("Enter");
    const intro = d.game.card && d.game.card.kind; window.key("Enter");
    return { intro, card: d.game.card && d.game.card.kind, kicker: d.game.card && d.game.card.kicker, foes: d.run.foes.map((i) => d.ROSTER[i].name), me: d.game.p1.name, saved: JSON.parse(localStorage.getItem("lake-brawl.save.v1")) };
  });
  check(r.intro === "intro" && r.card === "stage" && r.kicker === "CHAPTER 1 OF 5", "picking a leader shows the prologue, then the chapter 1 card");
  check(r.foes.length === 5 && new Set(r.foes).size === 5 && !r.foes.includes(r.me) && r.foes[4] === "TRUMP", "five different rivals, none of them the player, with Trump last: " + r.foes.join(", "));
  check(r.saved.run && r.saved.run.stage === 0 && r.saved.total === 14, "the new campaign is saved at chapter 1 with the roster size");

  const powers = [];
  for (let ch = 0; ch < 5; ch++) {
    const f = await page.evaluate(() => window.winFight());
    powers.push(f.power);
    check(f.phase === "fight" && f.stage === ch && f.foe === r.foes[ch], `chapter ${ch + 1} is fought on stage ${ch + 1} against ${r.foes[ch]}`);
    check(f.end === "win" && f.won, `chapter ${ch + 1}: the knock-out leads to the result screen with the player as winner`);
    if (ch === 0) {
      // a campaign in flight can be continued after a reload
      const page2 = await ctx.newPage();
      await page2.goto(BASE + "lake-brawl/");
      await page2.waitForFunction(() => !!window.dbg);
      await page.evaluate(() => window.key("Enter"));
      await page2.reload(); await page2.waitForFunction(() => !!window.dbg);
      await page2.evaluate(HELPERS);
      const c = await page2.evaluate(() => { window.step(0.1); window.key("Enter"); const d = window.dbg; return { phase: d.game.phase, kicker: d.game.card && d.game.card.kicker, stage: d.run.stage }; });
      check(c.phase === "story" && c.kicker === "CHAPTER 2 OF 5" && c.stage === 1, "after a reload, Continue Campaign opens the chapter 2 card");
      await page2.close();
    } else {
      const next = await page.evaluate(() => { window.key("Enter"); const d = window.dbg; return { phase: d.game.phase, kind: d.game.card && d.game.card.kind, kicker: d.game.card && d.game.card.kicker }; });
      if (ch < 4) check(next.phase === "story" && next.kicker === `CHAPTER ${ch + 2} OF 5`, `continuing shows the chapter ${ch + 2} card`);
      else check(next.phase === "story" && next.kind === "ending", "continuing after chapter 5 shows the epilogue");
    }
  }
  check(powers.every((p, i) => i === 0 || p > powers[i - 1] * 0.9) && powers[4] > powers[0], "rivals hit harder as the chapters go on: " + powers.map((p) => p.toFixed(2)).join(", "));

  r = await page.evaluate(() => { window.key("Enter"); const d = window.dbg; return { phase: d.game.phase, saved: JSON.parse(localStorage.getItem("lake-brawl.save.v1")) }; });
  check(r.phase === "title" && r.saved.run === null && r.saved.cleared.length === 1 && r.saved.cleared[0] === "CARNEY", "the epilogue returns to the title, clears the saved campaign and marks Carney as cleared");

  // losing a chapter: retry starts the same chapter again
  r = await page.evaluate(() => {
    const d = window.dbg;
    window.key("Enter"); d.sel.cur = 2; window.key("Enter"); window.key("Enter"); window.key("Enter"); window.step(1.8);
    const g = d.game; g.ai.t = 9; g.p1.hp = 1; g.p1.block = false; g.p2.x = g.p1.x + 100; g.p2.facing = -1; d.startAtk(g.p2, "kick"); window.step(0.4); window.step(3.5);
    const lost = d.game.phase === "win" && d.game.winner === d.game.p2;
    window.key("Enter"); window.step(0.1);
    return { lost, phase: d.game.phase, stage: d.game.stage, hp: [d.game.p1.hp, d.game.p2.hp] };
  });
  check(r.lost && r.phase === "intro" && r.stage === 0 && r.hp[0] === 100 && r.hp[1] === 100, "after a loss, retry restarts chapter 1 with both fighters at full health");
  check(errors.length === 0, "no page errors during the run" + (errors.length ? ": " + errors[0] : ""));

  /* ----- the arcade cabinet reads the save ----- */
  await page.goto(BASE);
  const line = await page.evaluate(() => { const c = document.querySelector('.cab[data-game="lake-brawl"]'); return c && c.querySelector(".hi").textContent; });
  check(line === "CAMPAIGN CLEARED 1/14", `the cabinet line reads the save: ${line}`);
  await ctx.close();
} finally {
  await browser.close();
}
console.log(fails.length ? `\nlake-brawl: ${fails.length} failed` : "\nlake-brawl: all passed");
process.exit(fails.length ? 1 : 0);
