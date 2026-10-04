// Plays a House Rules layer in Down the Drain: NODE_PATH=$(npm root -g) node qa/lab/rules.drain.mjs (serve public/)
// 1. Test it: the painted ground, critters, tank and drains show up in the game, the Cottage's tuning and your
//    unlocks and banked caps stay out of it, a death says how far down you got and counts the try, and reaching a
//    drain records the clear, which unlocks Share. The editor then counts your tries and what got you.
// 2. A friend's link: the intro and the HUD race the maker's time, a death gives a retry card with the depth and
//    the try, the controls hint shows on the first try only, and the saves stay as they were. A clear sends the
//    time back in a link that says "Best", and "Remix this layer" opens the layer in the editor.
// 3. A broken link says so, and a plain /fall/ link still opens the normal title.
// SHOTS=<folder> saves screenshots. Exit code 1 on failure.
import { open, until, shot, sleep, report, BASE, PHONE, DESK } from "./lib.mjs";
import { blank, encode, decode, build, stampFor, recordClear, W, H, TOP } from "../../public/lab/rules/layer.js";
import { fnv1a } from "../../public/lab/kit/rng.js";

const R = report("rules.drain");

// a layer: a tunnel from the hole to the left drain, a raccoon off to the side, and a propane tank
const L = blank(424242);
L.name = "Straight Down";
L.strokes.push({ p: 0, r: 3, pts: [[512, 44], [512, 300], [362, 500], [362, 700]] });
L.critters.push({ k: 0, x: 700, y: 400 });
L.tanks.push({ x: 800, y: 300 });
const code = await encode(L);
const ground = build(L);
const groundHash = fnv1a(ground.subarray(TOP * W));

// saves a player could have: a tuned game, unlocks, banked caps, tips already seen
const SAVES = {
  "plungerd.drain.v1": JSON.stringify({ runs: 7, deepest: 5, hands: 1, tagCasts: {}, deathsBy: { lava: 2 }, lastDeath: "lava", gold: 0, crew: 0, meta: { unlocked: { spade: true, purse: true, hotdog1: true }, spent: 90 }, startMelee: "plunger", bankCaps: 50, tips: { hover: 1, eat: 1, wall: 1 } }),
  "plungerd.drain.tune.v1": JSON.stringify({ dials: { foeHp: 1.4, pressure: 1.3, hotdogs: 2 }, kind: { raccoon: 1.5 }, history: [] }),
  "plungerd.drain.scores.v1": JSON.stringify([{ name: "AAA", score: 1234, depth: 3 }]),
};
// an init script with the saves written into its text (a function would lose them on the way to the page)
const seed = (saves) => ({ content: `(() => { if (sessionStorage.getItem("qa-seeded")) return; const s = ${JSON.stringify(saves)}; for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem("qa-seeded", "1"); })();` });
const saves = (page) => page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])), Object.keys(SAVES));
const clock = (page) => page.textContent("#fastText");
// the game's controls hint, if it shows
const hintText = (page) => page.evaluate(() => { const h = document.getElementById("hint"); return h.hidden ? "" : h.textContent; });
const toDrain = (page, x) => page.evaluate((x) => { const p = Game.player; p.x = x - p.w / 2; p.y = 703 - p.h; p.vx = 0; p.vy = 0; }, x);
async function retry(page) {
  await page.click("[data-rules] [data-act=again]");
  await until(page, () => Game.state === "play" && !run.over, null, 60000);
}

R.section("Test it: your own layer in Down the Drain");
{
  const { page, errors, close } = await open("../fall/", { ...PHONE, hash: "#L=" + code + "&edit=1", init: seed(SAVES) });
  await page.waitForSelector("[data-rules] [data-act=go]", { timeout: 60000 });
  R.check(await page.evaluate(() => document.getElementById("attract").hidden), "the painted layer's intro card stands in for the title");
  R.check(/Straight Down/.test(await page.textContent("[data-rules] h2")), "it shows the layer's name");
  await shot(page, "rules-drain-intro");
  await page.click("[data-rules] [data-act=go]");
  await until(page, () => Game.state === "play", null, 60000);
  const got = await page.evaluate(({ TOP, W }) => {
    let h = 0x811c9dc5;
    for (let i = TOP * W; i < World.mat.length; i++) { h ^= World.mat[i]; h = Math.imul(h, 0x01000193); }
    return {
      hash: h >>> 0,
      foes: Game.foes.map((f) => [f.kind, f.x, f.y]),
      tanks: Game.props.filter((p) => p.kind === "tank").map((p) => [p.x, p.y]),
      exits: Game.level.exits.map((e) => e.x),
      rooms: Game.level.rooms.length,
      dials: [Tune.get("foeHp"), Tune.get("pressure"), Tune.kind("raccoon")],
      caps: run.caps, flasks: run.flaskMax, shovel: run.shovel, gold: run.gold,
      watch: Game.watchT,
    };
  }, { TOP, W });
  R.check(got.hash === groundHash, "the ground under the outhouse is exactly the painted layer");
  R.check(JSON.stringify(got.foes) === JSON.stringify([["raccoon", 696, 394]]) && JSON.stringify(got.tanks) === JSON.stringify([[800, 300]]), "the painted raccoon and the propane tank are where they were placed");
  R.check(JSON.stringify(got.exits) === JSON.stringify(L.drains) && got.rooms === 0, "the two drains are where they were placed, and the Cottage adds no rooms");
  R.check(got.dials.every((v) => v === 1), `the Cottage's tuning stays out of it (dials ${got.dials.join(", ")})`);
  R.check(got.caps === 0 && got.flasks === 2 && got.shovel === 1 && got.gold === 0, "no banked caps and no unlocks: everyone starts the same");
  R.check(got.watch === Infinity, "the Cottage pours nothing while you play");
  const t0 = await clock(page);
  R.check(/^⏱ \d+:\d\d$/.test(t0), `the HUD clock counts up from the start, with no fast-drain countdown and no time to beat yet ("${t0}")`);
  R.check(/Tap Hit to swing/.test(await hintText(page)), "the first try shows the controls hint");
  await sleep(600);
  await shot(page, "rules-drain-play");
  // a death: the card waits a moment, then says how far down you got, when, and which try it was
  const gap = await page.evaluate(() => new Promise((done) => {
    const t = performance.now(), mo = new MutationObserver(() => { if (document.querySelector("[data-rules]")) { mo.disconnect(); done(performance.now() - t); } });
    mo.observe(document.body, { childList: true });
    die("lava");
  }));
  R.check(gap >= 590, `the death stays in sight for ${Math.round(gap)} ms before the card covers it`);
  await page.waitForSelector("[data-rules] [data-act=again]", { timeout: 10000 });
  const dead = await page.textContent("[data-rules]");
  R.check(/The lava got you/.test(dead) && /Flushed \d+% of the way down, at \d+:\d\d\. Try 1\./.test(dead), `the card says how close you came ("${dead.slice(0, 70)}")`);
  await shot(page, "rules-drain-test-died");
  await retry(page);
  await sleep(500);
  R.check(!(await hintText(page)), "Try again does not show the controls hint again");
  // walk into the left drain
  await toDrain(page, L.drains[0]);
  await page.waitForSelector("[data-rules] [data-act=edit]", { timeout: 10000 });
  const title = await page.textContent("[data-rules] h2");
  R.check(/^Cleared in \d+:\d\d$/.test(title), `reaching a drain shows the clear card ("${title}")`);
  R.check(/on try 2\./.test(await page.textContent("[data-rules]")), "and says which try it was");
  await shot(page, "rules-drain-cleared");
  const clears = await page.evaluate(() => JSON.parse(localStorage.getItem("lab.rules.clears") || "{}"));
  R.check(Object.keys(clears).length === 1, "and records the clear in this browser");
  const after = await saves(page);
  R.check(Object.keys(SAVES).every((k) => after[k] === SAVES[k]), "the game's own saves are just as they were");
  // back in the editor, the same layer may be shared now
  await page.evaluate((L) => localStorage.setItem("lab.rules.draft", JSON.stringify(L)), L);
  await Promise.all([page.waitForURL(/\/lab\/rules\/$/), page.click("[data-rules] [data-act=edit]")]);
  await page.waitForFunction(() => window.QA && QA.code && !document.getElementById("share").disabled, null, { timeout: 15000 });
  R.check(true, "Back to the editor: Share is open for this layer");
  const status = await page.textContent("#status");
  R.check(/^2 tries: 1 lava\. You cleared this layer in \d+:\d\d\./.test(status), `the editor counts your tries and what got you ("${status}")`);
  for (const e of errors) R.check(false, e);
  await close();
}

R.section("A friend's link");
{
  const hash = "#L=" + code + "&c=" + stampFor(code, 47);
  const { page, errors, close } = await open("../fall/", { ...DESK, hash, init: seed(SAVES) });
  await page.waitForSelector("[data-rules] [data-act=go]", { timeout: 60000 });
  const intro = await page.textContent("[data-rules]");
  R.check(/cleared it in 0:47/.test(intro), "the intro says the maker cleared it in 0:47");
  R.check(/Maker 0:47/.test(intro) && !/Best/.test(intro), "and shows the time to beat: Maker 0:47");
  await page.click("[data-rules] [data-act=go]");
  await until(page, () => Game.state === "play", null, 60000);
  const c0 = await clock(page);
  R.check(/^⏱ \d+:\d\d \/ 0:47$/.test(c0), `the HUD races the maker: the time so far against 0:47 ("${c0}")`);
  R.check(/Left click hits/.test(await hintText(page)), "the first try shows the controls hint");
  await page.evaluate(() => die("lava"));
  await page.waitForSelector("[data-rules] [data-act=again]", { timeout: 10000 });
  const dead = await page.textContent("[data-rules]");
  R.check(/lava got you/.test(dead), "a death gives a retry card that names the lava");
  R.check(/\d+% of the way down/.test(dead) && /Try 1\./.test(dead) && !!(await page.$("[data-rules] .rules-depth")), "the card says how far down you got, with a bar, on try 1");
  await shot(page, "rules-drain-died");
  const after = await saves(page);
  R.check(Object.keys(SAVES).every((k) => after[k] === SAVES[k]) && after["plungerd.drain.scores.v1"] === SAVES["plungerd.drain.scores.v1"], "the death leaves every save alone: no memory, no retune, no high score");
  await retry(page);
  R.check(await page.evaluate(() => Game.foes.length === 1 && Game.level.exits[0].x === 362), "Try again starts the same layer");
  await sleep(500);
  R.check(!(await hintText(page)), "and the controls hint does not show again");
  await page.evaluate(() => die("moose"));
  await page.waitForSelector("[data-rules] [data-act=again]", { timeout: 10000 });
  R.check(/The moose got you/.test(await page.textContent("[data-rules]")) && /Try 2\./.test(await page.textContent("[data-rules]")), "the next death says Try 2");
  await retry(page);
  // a clear under the maker's time, then Send your time
  await sleep(1200);
  await toDrain(page, L.drains[1]);
  await page.waitForSelector("[data-rules] [data-act=send]", { timeout: 10000 });
  const won = await page.textContent("[data-rules]");
  const mine = +/Cleared in 0:(\d\d)/.exec(won)[1];
  R.check(mine < 47 && /You beat 0:47 by \d+ seconds\./.test(won), `a friend's clear under 47 s beats the maker ("${won.slice(0, 50)}")`);
  await shot(page, "rules-drain-friend-cleared");
  await page.evaluate(() => { window.__shared = null; navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
  await page.click("[data-rules] [data-act=send]");
  await until(page, () => !!window.__shared, null, 10000);
  const shared = await page.evaluate(() => window.__shared);
  const best = /&b=(\d+)-/.exec(shared.url);
  R.check(shared.url.includes("/fall/#L=" + code + "&c=" + stampFor(code, 47)) && best && +best[1] === mine && shared.url.endsWith("&b=" + stampFor(code, mine)), `Send your time shares the layer with the maker's stamp and a best-time stamp (&b=${best && best[1]})`);
  R.check(shared.text === `I cleared Straight Down in 0:${String(mine).padStart(2, "0")}. Yours: 0:47.`, `and says the two times ("${shared.text}")`);
  // the maker opens the reply: the intro shows the best, and the HUD races it
  await page.goto(shared.url);
  await page.reload();
  await page.waitForSelector("[data-rules] [data-act=go]", { timeout: 60000 });
  const reply = await page.textContent("[data-rules]");
  R.check(/Best 0:\d\d/.test(reply) && /Maker 0:47 · Best 0:/.test(reply), `the reply link's intro shows the best ("${(/Maker[^O]*/.exec(reply) || [""])[0]}")`);
  await shot(page, "rules-drain-reply");
  await page.click("[data-rules] [data-act=go]");
  await until(page, () => Game.state === "play", null, 60000);
  const c1 = await clock(page);
  R.check(c1.endsWith(" / 0:" + String(mine).padStart(2, "0")), `and the HUD races the best time ("${c1}")`);
  // a remix: the clear card opens the layer in the editor, ready for your own trap
  await toDrain(page, L.drains[0]);
  await page.waitForSelector("[data-rules] [data-act=remix]", { timeout: 10000 });
  await Promise.all([page.waitForURL(/\/lab\/rules\//), page.click("[data-rules] [data-act=remix]")]);
  await page.waitForFunction(() => window.QA && QA.code, null, { timeout: 15000 });
  await page.evaluate(() => QA.remixed);
  const ed = await page.evaluate(() => ({ L: JSON.stringify(QA.L), share: document.getElementById("share").disabled }));
  R.check(ed.L === JSON.stringify(Object.assign(blank(L.seed), await decode(code))) && ed.share, "Remix this layer opens it in the editor, with Share closed until you clear it");
  const wrong = "#L=" + code + "&c=" + stampFor(code, 47).replace(/^47/, "12");
  await page.goto(new URL("../fall/", BASE).href + wrong);
  await page.reload();
  await page.waitForSelector("[data-rules] [data-act=go]", { timeout: 60000 });
  R.check(/has not cleared it/.test(await page.textContent("[data-rules]")), "a stamp that does not match the link counts as no clear");
  for (const e of errors) R.check(false, e);
  await close();
}

R.section("Broken and plain links");
{
  const { page, errors, close } = await open("../fall/", { ...DESK, hash: "#L=" + code.slice(0, 12) });
  await page.waitForSelector("[data-rules] [data-act=game]", { timeout: 60000 });
  R.check(/broken/.test(await page.textContent("[data-rules] h2")), "a link cut short says the layer is broken, with a way to the normal game");
  await Promise.all([page.waitForURL(/\/fall\/$/), page.click("[data-rules] [data-act=game]")]);
  await page.waitForSelector("#attract:not([hidden])", { timeout: 60000 });
  R.check(await page.evaluate(() => Custom.on === false && Game.state === "intro"), "a plain /fall/ link opens the normal title, with House Rules off");
  for (const e of errors) R.check(false, e);
  await close();
}

R.done();
