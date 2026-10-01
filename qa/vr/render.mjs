// Renders the city at every named camera shot and the diorama, saves the screenshots, and checks each picture: not
// blank, not washed out (mean luminance and spread from pixels read in the loop), alpha 1 everywhere, no shader
// errors or warnings. Also checks the sky's alpha in flat play, the district clog, King and finale tints, the stencil
// switch and warm().
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/render.mjs
import { checker, watchdog, newPage, open, close, waitFor, waitState, enterXR } from "./lib.mjs";
import { mkdir } from "fs/promises";
import path from "path";

const { check, done } = checker("render");
watchdog(14 * 60 * 1000, "render");
const OUT = process.env.SHOTS || "/tmp/claude-0/-home-user-rouge-warden/2ed40449-f099-5b3f-b570-4c2f962d8398/scratchpad/shots/view";
await mkdir(OUT, { recursive: true });
const SHOTS = ["start", "needle", "canyon", "harbour", "aerial", "street", "diorama"];

// a 16 x 9 grid of pixels, read right after the render in the loop
const GRID = [];
for (let j = 0; j < 9; j++) for (let i = 0; i < 16; i++) GRID.push([(i + 0.5) / 16, (j + 0.5) / 9]);
const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
function stats(px) {
  const L = px.map(lum), n = L.length, mean = L.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const avg = [0, 1, 2].map((c) => px.reduce((a, p) => a + p[c], 0) / n);
  return { mean: +mean.toFixed(1), sd: +sd.toFixed(1), alphaMin: Math.min(...px.map((p) => p[3])), distinct: new Set(px.map((p) => p.slice(0, 3).join())).size, avg: avg.map((x) => +x.toFixed(1)) };
}
async function sampleShot(page, name) {
  if (name !== undefined) await page.evaluate((n) => G.test.camera(n), name);
  const f0 = await page.evaluate(() => G.frame);
  await page.waitForFunction((f) => G.frame > f + 3, f0, { timeout: 120000, polling: 50 });
  return page.evaluate((g) => G.test.sample(g), GRID);
}

try {
  const page = await newPage({ width: 640, height: 360 });
  await open(page, "");
  await waitFor(page, () => G.viewDone, null, 300000);
  // the title overlay is DOM over the canvas: hide it so the screenshots show the city
  await page.evaluate(() => { document.querySelector("#title").hidden = true; });
  const res = {};
  for (const n of SHOTS) {
    const px = await sampleShot(page, n);
    const st = (res[n] = stats(px));
    const file = path.join(OUT, n + ".png");
    await page.screenshot({ path: file });
    console.log("INFO: " + n.padEnd(8) + " mean " + st.mean + " spread " + st.sd + " colours " + st.distinct + " rgb " + st.avg.join("/") + " -> " + file);
  }
  for (const n of SHOTS) {
    const st = res[n];
    // the diorama floats in a dark void, so its picture is darker on average
    const lo = n === "diorama" ? 8 : 35, colours = n === "diorama" ? 8 : 40;
    check(st.mean > lo && st.mean < 215 && st.sd > 10 && st.distinct > colours, n + ": the picture is neither blank nor washed out", st);
    check(st.alphaMin === 255, n + ": every pixel writes alpha 1", st.alphaMin);
  }
  const dpx = await sampleShot(page, "diorama");
  const mid = dpx.filter((p, i) => { const x = (i % 16) / 16, y = Math.floor(i / 16) / 9; return x > 0.3 && x < 0.7 && y > 0.3 && y < 0.7; });
  check(stats(mid).mean > 45, "the diorama shows the city in the middle of the view", stats(mid));

  /* ---------------- the tints ---------------- */
  // the canyon: facades fill the view and no car passes close by, so only the tints change the picture
  await page.evaluate(() => G.test.camera("canyon"));
  const base = stats(await sampleShot(page));
  await page.evaluate(() => { for (let d = 0; d < 6; d++) G.view.setDistrictClog(d, 1); });
  await page.waitForTimeout(4000);
  const clog = stats(await sampleShot(page));
  const gshare = (s) => s.avg[1] / (s.avg[0] + s.avg[1] + s.avg[2] + 1e-6);
  check(gshare(clog) > gshare(base) + 0.004, "setDistrictClog turns the district greener", { before: base.avg, after: clog.avg });
  await page.evaluate(() => { for (let d = 0; d < 6; d++) G.view.setDistrictClog(d, 0); G.view.setFinale(1); });
  await page.waitForTimeout(6000);
  const fin = stats(await sampleShot(page));
  check(fin.mean > base.mean + 1, "setFinale(1) lights and warms the city", { before: base, after: fin });
  await page.evaluate(() => { G.view.setFinale(0); G.view.setKing(1); G.test.camera("needle"); });
  await page.waitForTimeout(3000);
  const kpx = await page.evaluate(async () => {
    // the pod's window band, projected to the screen
    const N = G.city.needle, v = new (G.camera.position.constructor)(N.x, (N.podY0 + 12), N.z - N.podR - 0.5);
    v.project(G.camera);
    const p = await G.test.sample([[(v.x + 1) / 2, (1 - v.y) / 2]]);
    return p[0];
  });
  check(kpx[1] > kpx[0], "setKing(1) makes the pod's window band glow green", kpx);
  await page.evaluate(() => G.view.setKing(0));

  /* ---------------- stencil and warm ---------------- */
  const sw = await page.evaluate(() => {
    const V = G.view, out = {};
    V.stencil(1);
    const ms = new Set(); V.root.traverse((o) => { if (o.material) ms.add(o.material); });
    out.on = [...ms].every((m) => m.stencilWrite && m.stencilRef === 1 && m.stencilFunc === 514);
    V.stencil(null);
    out.off = [...ms].every((m) => !m.stencilWrite);
    V.warm(G.renderer, G.camera);
    out.after = [...ms].every((m) => m.colorWrite && m.depthWrite !== undefined);
    out.sky = V.skyColorAt({ x: 0, y: 0.05, z: 1 }).toArray();
    out.info = V.info;
    return out;
  });
  check(sw.on && sw.off, "V.stencil(1) sets an Equal test on every city material and V.stencil(null) clears it", sw);
  check(sw.after && sw.sky.every((c) => c > 0 && c < 2) && sw.info.meshes > 20 && sw.info.tris > 1000, "V.warm runs, and skyColorAt and info answer", sw);
  const after = stats(await sampleShot(page, "start"));
  check(after.mean > 35 && after.alphaMin === 255, "the city draws as before after warm()", after);
  check(page.errors.length === 0, "no shader errors or warnings on the title", page.errors);

  /* ---------------- flat play: the sky writes alpha 1 ---------------- */
  await page.evaluate(() => { G.test.camera(null); document.querySelector("#title").hidden = false; });
  await enterXR(page, "desktop");
  await page.evaluate(() => G.test.skipIntro());
  await waitState(page, { mode: "desktop", state: "play" }, 60000);
  await page.evaluate(() => G.test.camera("needle"));
  const sky = await sampleShot(page);
  const top = sky.slice(0, 32);
  check(top.every((p) => p[3] === 255) && stats(top).mean > 40, "in flat play the sky writes alpha 1 (top two rows of samples)", top.slice(0, 6));
  await page.screenshot({ path: path.join(OUT, "play-needle.png") });
  await page.evaluate(() => G.test.camera(null));
  check(page.errors.length === 0, "no errors in flat play", page.errors);
  await page.context().close();
} catch (e) { check(false, "render threw", e.stack || String(e)); }

await close();
done();
