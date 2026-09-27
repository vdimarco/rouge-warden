// Golden image of the arena: the title orbit with no actors, at two camera times, drawn at a fixed
// post-effect time. The picture must match qa/crimson/golden/arena-still-{a,b}.png
// (mean abs diff <= 1.0 and 99th percentile <= 12 on 0-255). --update writes new goldens.
// --after-story first plays NEW STORY into the story and SAVE & QUITs back to the title: the story must
// hand the arena back exactly (fog, background, grass, toon ramp, lights, depth, camera; B11).
import { open, step, stepUntil, canvasRGBA, readPNG, writePNG, imageDiff, finish, here, UPDATE } from "./lib.mjs";
import { existsSync } from "fs";

const AFTER = process.argv.includes("--after-story");
const SHOTS = [["a", 12.3], ["b", 71.0]];
const { browser, page, errors } = await open({ query: "?qa=still&seed=7" });
const fails = [];
if (AFTER) {
  await page.evaluate(() => { __crimson.seed(7); __crimson.startGame("story"); });
  await step(page, 1);
  await page.waitForFunction(() => __crimson.storyLoaded, null, { timeout: 120000, polling: 100 });
  await page.evaluate(() => __crimson.win());
  const r = await stepUntil(page, () => __crimson.story && __crimson.story.chapter === "f1", { maxSec: 40 });
  if (!r.ok) fails.push("NEW STORY did not reach f1");
  await step(page, 3);
  await page.keyboard.press("Escape");
  await step(page, 0.05);
  await page.click("#sQuit");
  await step(page, 0.05);
  const st = await page.evaluate(() => __crimson.game.state);
  if (st !== "title") fails.push(`SAVE & QUIT left the game in '${st}'`);
  else console.log("played NEW STORY into f1, then SAVE & QUIT back to the title");
}
for (const [id, t] of SHOTS) {
  const img = await canvasRGBA(page, (t) => __crimson.still(t), t);
  const info = await page.evaluate(() => ({ ...__crimson.lastInfo }));
  const path = here(`golden/arena-still-${id}.png`);
  if (img.width !== 640 || img.height !== 360) fails.push(`${id}: canvas is ${img.width}x${img.height}, expected 640x360`);
  let lum = 0; for (let i = 0; i < img.data.length; i += 4) lum += img.data[i] + img.data[i + 1] + img.data[i + 2];
  lum /= img.data.length / 4 * 3;
  if (lum < 3 || lum > 240) fails.push(`${id}: picture is blank (mean ${lum.toFixed(1)})`);
  if (UPDATE && !AFTER) { writePNG(path, img); console.log(`${id} t=${t}: wrote ${path} (mean level ${lum.toFixed(1)}, ${info.calls} calls, ${info.triangles} triangles)`); continue; }
  if (!existsSync(path)) { fails.push(`${id}: no golden at ${path}; run with --update`); continue; }
  const d = imageDiff(img, readPNG(path));
  const ok = d.mean <= 1.0 && d.p99 <= 12;
  console.log(`${id} t=${t}: mean abs diff ${d.mean.toFixed(3)}, p99 ${d.p99}, max ${d.max}, ${info.calls} calls, ${info.triangles} triangles ${ok ? "ok" : "BAD"}`);
  if (!ok) { fails.push(`${id}: mean ${d.mean.toFixed(3)} p99 ${d.p99} (limits 1.0 and 12)`); writePNG(here(`golden/arena-still-${id}${AFTER ? ".after" : ""}.actual.png`), img); }
}
await finish(AFTER ? "render --after-story" : "render", fails, browser, errors);
