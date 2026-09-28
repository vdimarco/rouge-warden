// Plays a House Rules layer in Down the Drain: NODE_PATH=$(npm root -g) node qa/lab/rules.drain.mjs (serve public/)
// 1. Test it: the painted ground, critters, tank and drains show up in the game, the Cottage's tuning and your
//    unlocks and banked caps stay out of it, and reaching a drain records the clear, which unlocks Share.
// 2. A friend's link: the intro says the maker's time, a death gives a retry card, and the saves stay as they were.
// 3. A broken link says so, and a plain /fall/ link still opens the normal title.
// SHOTS=<folder> saves screenshots. Exit code 1 on failure.
import { open, until, shot, sleep, report, PHONE, DESK } from "./lib.mjs";
import { blank, encode, build, stampFor, recordClear, W, H, TOP } from "../../public/lab/rules/layer.js";
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
  await sleep(600);
  await shot(page, "rules-drain-play");
  // walk into the left drain
  await page.evaluate((x) => { const p = Game.player; p.x = x - p.w / 2; p.y = 703 - p.h; p.vx = 0; p.vy = 0; }, L.drains[0]);
  await page.waitForSelector("[data-rules] [data-act=edit]", { timeout: 10000 });
  const title = await page.textContent("[data-rules] h2");
  R.check(/^Cleared in \d+:\d\d$/.test(title), `reaching a drain shows the clear card ("${title}")`);
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
  for (const e of errors) R.check(false, e);
  await close();
}

R.section("A friend's link");
{
  const hash = "#L=" + code + "&c=" + stampFor(code, 47);
  const { page, errors, close } = await open("../fall/", { ...DESK, hash, init: seed(SAVES) });
  await page.waitForSelector("[data-rules] [data-act=go]", { timeout: 60000 });
  R.check(/cleared it in 0:47/.test(await page.textContent("[data-rules]")), "the intro says the maker cleared it in 0:47");
  await page.click("[data-rules] [data-act=go]");
  await until(page, () => Game.state === "play", null, 60000);
  await page.evaluate(() => die("lava"));
  await page.waitForSelector("[data-rules] [data-act=again]", { timeout: 10000 });
  R.check(/lava got you/.test(await page.textContent("[data-rules]")), "a death gives a retry card that names the lava");
  await shot(page, "rules-drain-died");
  const after = await saves(page);
  R.check(Object.keys(SAVES).every((k) => after[k] === SAVES[k]) && after["plungerd.drain.scores.v1"] === SAVES["plungerd.drain.scores.v1"], "the death leaves every save alone: no memory, no retune, no high score");
  await page.click("[data-rules] [data-act=again]");
  await until(page, () => Game.state === "play" && !run.over, null, 60000);
  R.check(await page.evaluate(() => Game.foes.length === 1 && Game.level.exits[0].x === 362), "Try again starts the same layer");
  const wrong = "#L=" + code + "&c=" + stampFor(code, 47).replace(/^47/, "12");
  await page.goto(page.url().replace(/#.*$/, "") + wrong);
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
