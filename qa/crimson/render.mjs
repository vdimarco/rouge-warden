// Golden image of the arena: the title orbit with no actors, at two camera times, drawn at a fixed
// post-effect time. The picture must match qa/crimson/golden/arena-still-{a,b}.png
// (mean abs diff <= 1.0 and 99th percentile <= 12 on 0-255). --update writes new goldens.
import { open, canvasRGBA, readPNG, writePNG, imageDiff, finish, here, UPDATE } from "./lib.mjs";
import { existsSync } from "fs";

const SHOTS = [["a", 12.3], ["b", 71.0]];
const { browser, page, errors } = await open({ query: "?qa=still&seed=7" });
const fails = [];
for (const [id, t] of SHOTS) {
  const img = await canvasRGBA(page, (t) => __crimson.still(t), t);
  const info = await page.evaluate(() => ({ ...__crimson.lastInfo }));
  const path = here(`golden/arena-still-${id}.png`);
  if (img.width !== 640 || img.height !== 360) fails.push(`${id}: canvas is ${img.width}x${img.height}, expected 640x360`);
  let lum = 0; for (let i = 0; i < img.data.length; i += 4) lum += img.data[i] + img.data[i + 1] + img.data[i + 2];
  lum /= img.data.length / 4 * 3;
  if (lum < 3 || lum > 240) fails.push(`${id}: picture is blank (mean ${lum.toFixed(1)})`);
  if (UPDATE) { writePNG(path, img); console.log(`${id} t=${t}: wrote ${path} (mean level ${lum.toFixed(1)}, ${info.calls} calls, ${info.triangles} triangles)`); continue; }
  if (!existsSync(path)) { fails.push(`${id}: no golden at ${path}; run with --update`); continue; }
  const d = imageDiff(img, readPNG(path));
  const ok = d.mean <= 1.0 && d.p99 <= 12;
  console.log(`${id} t=${t}: mean abs diff ${d.mean.toFixed(3)}, p99 ${d.p99}, max ${d.max}, ${info.calls} calls, ${info.triangles} triangles ${ok ? "ok" : "BAD"}`);
  if (!ok) { fails.push(`${id}: mean ${d.mean.toFixed(3)} p99 ${d.p99} (limits 1.0 and 12)`); writePNG(here(`golden/arena-still-${id}.actual.png`), img); }
}
await finish("render", fails, browser, errors);
