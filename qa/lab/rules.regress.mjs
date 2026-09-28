// Proves the House Rules hooks change nothing in the normal game: NODE_PATH=$(npm root -g) node qa/lab/rules.regress.mjs
// It plays public/fall/index.html from before the hooks (the branch's fork from main, or BASE_REF) and from now,
// with the same seeded random and a fake clock, and compares the world, the critters, the props, the player and the
// score after the first layer settles, and again after 8 seconds of scripted play (walk, swing, dig down). A second
// run of the new file shows that the test repeats. Then it checks that every changed hunk of the file names Custom.
// Serve public/ first. Exit code 1 on failure.
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { BASE, ROOT, report } from "./lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const R = report("rules.regress");
const git = (cmd) => execSync("git " + cmd, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
let base = process.env.BASE_REF;
if (!base) for (const ref of ["origin/main", "main"]) { try { base = git(`merge-base HEAD ${ref}`).trim(); break; } catch (e) { /* try the next */ } }
if (!base) { console.log("No base to compare with: set BASE_REF."); process.exit(1); }
const OLD = git(`show ${base}:public/fall/index.html`);
const NEW = fs.readFileSync(path.join(ROOT, "public/fall/index.html"), "utf8");
console.log(`base ${base.slice(0, 10)}: ${OLD.split("\n").length} lines before, ${NEW.split("\n").length} now`);

const FALL = new URL("../fall/", BASE).href;
const SEEDED = `(() => { let s = 12345 >>> 0; Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

// what a run looks like at a moment: hashes of the world and the lists that matter
const SNAP = () => {
  const h = (a) => { let x = 0x811c9dc5; for (let i = 0; i < a.length; i++) { x ^= a[i]; x = Math.imul(x, 0x01000193); } return x >>> 0; };
  const r2 = (v) => Math.round(v * 100) / 100;
  return {
    state: Game.state, mat: h(World.mat), life: h(World.life),
    foes: Game.foes.map((f) => [f.kind, r2(f.x), r2(f.y), f.hp]),
    props: (Game.props || []).map((p) => [p.kind, p.x, p.y]),
    pickups: Game.pickups.map((p) => [r2(p.x), r2(p.y)]),
    exits: Game.level.exits.map((e) => [e.x, e.theme, e.rich]),
    player: [r2(Game.player.x), r2(Game.player.y), run.hp],
    score: run.score, gold: run.gold, depth: run.depth, theme: Game.level.theme,
  };
};

async function play(html, label) {
  const browser = await chromium.launch({ args: ["--disable-accelerated-2d-canvas", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // a clock that moves only when the test moves it
  await page.clock.install({ time: new Date("2026-09-28T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-28T12:00:01Z"));
  await page.addInitScript({ content: SEEDED });
  // the classic look: the painted look switches on when its pictures finish loading, on the real clock
  await page.addInitScript({ content: `localStorage.setItem("drain.gfx", "classic");` });
  // sound fills a noise buffer with 0.8 s of random samples: keep the sample rate the same in every run
  await page.addInitScript({ content: `if (window.AudioContext) { const AC = window.AudioContext; window.AudioContext = class extends AC { constructor(o) { super(Object.assign({}, o, { sampleRate: 44100 })); } }; }` });
  await page.route(FALL, (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
  // art, clips, fonts and the title music load on the real clock; the game runs without them, and the same every time
  await page.route(/\.(webp|png|jpe?g|webm|mp4|woff2?|ttf)(\?|$)|fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.route(/\/chip\.js(\?|$)/, (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await page.goto(FALL);
  await page.waitForSelector("#attractPress");
  await page.waitForLoadState("networkidle");
  // The paused clock still lets a few real milliseconds into the page's performance.now() at load (2 to 5). Frames
  // follow the page's time and timers follow the clock's, so that gap decides which fires first. Step the clock
  // until the page's time reads 32 in every run, and start the game's frame loop from there (both files alike).
  const off = await page.evaluate(() => performance.now());
  await page.clock.runFor(32 - (off % 16));
  await page.evaluate(() => { lastT = -1e9; acc = 0; });
  const tick = async (ms) => { await page.clock.runFor(ms); };
  await page.click("#attractPress");
  await tick(200);
  await page.click("#goDown");
  await tick(200);
  await page.click("#startBtn");
  let t = 0;
  while (t < 30000 && (await page.evaluate(() => Game.state)) !== "play") { await tick(100); t += 100; }
  const settled = await page.evaluate(SNAP);
  // play: walk right, swing, then dig down, all on the game's clock
  await page.keyboard.down("d");
  await tick(1500);
  await page.keyboard.press("j");
  await tick(500);
  await page.keyboard.up("d");
  await page.keyboard.down("s");
  await page.keyboard.down("f");
  await tick(4000);
  await page.keyboard.up("f");
  await page.keyboard.up("s");
  await tick(2000);
  const later = await page.evaluate(SNAP);
  await browser.close();
  console.log(`  ${label}: layer ${settled.theme}, ${settled.foes.length} critters, world ${settled.mat}; after 8 s: player at ${later.player.slice(0, 2).join(", ")}, score ${later.score}`);
  return { settled, later, errors };
}

R.section("The same game before and after the hooks");
const a = await play(OLD, "before the hooks");
const b = await play(NEW, "with the hooks  ");
const c = await play(NEW, "with the hooks  ");
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
R.check(same(b, c), "two runs of the same file with the same seed and clock match (the test repeats)");
R.check(a.settled.state === "play" && same(a.settled, b.settled), "after the first layer settles: the same world, critters, props, drains and player");
R.check(same(a.later, b.later), "after 8 seconds of play: the same world, critters, player and score");
if (!same(a.later, b.later)) for (const k of Object.keys(a.later)) if (!same(a.later[k], b.later[k])) console.log(`    ${k}: ${JSON.stringify(a.later[k]).slice(0, 120)} vs ${JSON.stringify(b.later[k]).slice(0, 120)}`);
R.check(!a.errors.length && !b.errors.length, `no page errors${a.errors.concat(b.errors).length ? ": " + a.errors.concat(b.errors).join("; ") : ""}`);

R.section("Every change names Custom");
{
  const diff = git(`diff -U0 ${base} -- public/fall/index.html`);
  const hunks = diff.split(/\n(?=@@)/).slice(1);
  const bad = hunks.filter((hk) => !/Custom/.test(hk));
  R.check(hunks.length > 0 && bad.length === 0, `${hunks.length} changed hunks, and each one names Custom${bad.length ? "; not: " + bad.map((x) => x.split("\n")[0]).join(", ") : ""}`);
  const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  R.check(added <= 60, `the change to the game stays small (${added} lines added)`);
}

R.done();
