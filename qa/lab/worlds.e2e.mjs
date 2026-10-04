// The Small Worlds shell with each of its six games: NODE_PATH=$(npm root -g) node qa/lab/worlds.e2e.mjs (serve public/ first)
// Each world opens on today's seed and runs for a moment with no page errors. Then the shell ends it: the scene keeps
// moving in a short outro with input off, and then the result card gives the score and how it compares with your best.
// SHOTS=<folder> saves screenshots. Exit code 1 on failure.
import { createRequire } from "module";
import { open, until, shot, sleep, report, PHONE } from "./lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const R = report("worlds.e2e");
const browser = await chromium.launch({ args: ["--disable-accelerated-2d-canvas", "--autoplay-policy=no-user-gesture-required"] });
const state = (page) => page.evaluate(() => window.__worlds.getState());
const text = async (page, sel) => ((await page.textContent(sel)) || "").trim();
// ends the run through the shell, as a game does, and waits for the card
async function finishWith(page, out) {
  const t0 = Date.now();
  const mid = await page.evaluate((o) => { window.__worlds.finish(o); return { phase: window.__worlds.getState().phase, card: !document.getElementById("result").hidden }; }, out);
  await until(page, () => window.__worlds.getState().phase === "finished", null, 10000);
  return { mid, ms: Date.now() - t0 };
}
async function again(page) {
  await page.click("#retry-button");
  await until(page, () => window.__worlds.getState().phase === "playing");
  await sleep(300);
}

const first = await open("worlds/", { ...PHONE, browser });
await until(first.page, () => window.__worlds && window.__worlds.worlds.length === 6);
const ids = await first.page.evaluate(() => window.__worlds.worlds);
await first.close();

for (const id of ids) {
  R.section(id);
  const { page, errors, close } = await open("worlds/", { ...PHONE, hash: "#" + id, browser });
  await until(page, (id) => { const s = window.__worlds && window.__worlds.getState(); return s && s.id === id && s.phase === "intro"; }, id);
  R.check((await state(page)).daily === true && /Today’s world/.test(await text(page, "#best")), "with no seed in the link, it is today's world, and the intro card says so");
  await page.click("#start-button");
  await until(page, () => window.__worlds.getState().phase === "playing");
  R.check((await text(page, "#status")).length > 0, "a hint shows under the game after Play");
  await sleep(1500);
  const playing = await state(page);
  R.check(playing.phase === "playing" && playing.elapsed > 0.5, `the game runs (${playing.elapsed.toFixed(1)} s of game time)`);
  await shot(page, `worlds-${id}-play`);

  const a = await finishWith(page, { score: 120, unit: "m", win: true, title: "Test end" });
  R.check(a.mid.phase === "outro" && !a.mid.card, "at the end, the scene keeps moving with no card at first");
  R.check(a.ms >= 1200 && a.ms < 8000, `the card comes after the outro (${a.ms} ms)`);
  R.check(await text(page, "#result-score") === "120 m" && await text(page, "#result-best") === "Your first score in this world.", `the card gives the score and says it is the first ("${await text(page, "#result-best")}")`);
  R.check(await text(page, "#result-label") === "Today’s world", "the card says it was today's world");
  await shot(page, `worlds-${id}-card`);

  await again(page);
  await finishWith(page, { score: 100, unit: "m", win: false });
  R.check(await text(page, "#result-best") === "20 short of your best, 120 m.", `a lower score says how close it came ("${await text(page, "#result-best")}")`);
  await again(page);
  await finishWith(page, { score: 150, unit: "m", win: true });
  R.check(await text(page, "#result-best") === "New best. Your old best was 120.", `a higher score is a new best ("${await text(page, "#result-best")}")`);

  const seed = (await state(page)).seed;
  await page.click("#new-seed-button");
  await until(page, () => window.__worlds.getState().phase === "playing");
  const other = await state(page);
  R.check(other.seed !== seed && other.daily === false, "A different world leaves today's seed");
  for (const e of errors) R.check(false, e);
  await close();
}

await browser.close();
R.done();
