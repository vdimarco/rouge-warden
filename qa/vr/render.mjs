// Renders the city at every named camera shot and the diorama, saves the screenshots, and checks each picture: not blank,
// not washed out (mean luminance, spread and colourfulness from pixels read in the loop), alpha 1 everywhere, no shader
// errors or warnings. It also checks the comic look: the art loads, the sky is the painted strip (saturated violet and
// orange, its sun on SUN_DIR's azimuth), ink lines run along the building edges, and dots stay out of screen space.
// The rest: the sky's alpha in flat play, the district clog, King and finale tints, the stencil switch and warm().
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/render.mjs
import { checker, watchdog, newPage, open, close, waitFor, waitState, ROOT } from "./lib.mjs";
import { mkdir, readFile } from "fs/promises";
import path from "path";

const { check, done } = checker("render");
watchdog(20 * 60 * 1000, "render");
const OUT = process.env.SHOTS || "/tmp/claude-0/-home-user-rouge-warden/2ed40449-f099-5b3f-b570-4c2f962d8398/scratchpad/shots/view";
await mkdir(OUT, { recursive: true });
const SHOTS = ["start", "needle", "canyon", "harbour", "aerial", "street", "diorama"];

// a 16 x 9 grid of pixels, read right after the render in the loop
const GRID = [];
for (let j = 0; j < 9; j++) for (let i = 0; i < 16; i++) GRID.push([(i + 0.5) / 16, (j + 0.5) / 9]);
const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
const sat = (p) => { const mx = Math.max(p[0], p[1], p[2]), mn = Math.min(p[0], p[1], p[2]); return mx > 30 ? (mx - mn) / mx : 0; };
function stats(px) {
  const L = px.map(lum), n = L.length, mean = L.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const avg = [0, 1, 2].map((c) => px.reduce((a, p) => a + p[c], 0) / n);
  const colourful = px.reduce((a, p) => a + sat(p), 0) / n;
  return { mean: +mean.toFixed(1), sd: +sd.toFixed(1), alphaMin: Math.min(...px.map((p) => p[3])), distinct: new Set(px.map((p) => p.slice(0, 3).join())).size, avg: avg.map((x) => +x.toFixed(1)), sat: +colourful.toFixed(2) };
}
async function sampleShot(page, name) {
  if (name !== undefined) await page.evaluate((n) => G.test.camera(n), name);
  const f0 = await page.evaluate(() => G.frame);
  await page.waitForFunction((f) => G.frame > f + 3, f0, { timeout: 120000, polling: 50 });
  return page.evaluate((g) => G.test.sample(g), GRID);
}
// One row of pixels across the picture, every pixel (the picture is 640 wide): runs of ink-coloured pixels are the lines
async function scanRow(page, fy, w) {
  const pts = [];
  for (let i = 0; i < w; i++) pts.push([(i + 0.5) / w, fy]);
  const f0 = await page.evaluate(() => G.frame);
  await page.waitForFunction((f) => G.frame > f + 1, f0, { timeout: 120000, polling: 50 });
  return page.evaluate((g) => G.test.sample(g), pts);
}
// the ink is #140a18: dark in every channel. Shade faces are dark too but blue, so they do not count.
const isInk = (p) => Math.max(p[0], p[1], p[2]) < 46;
function inkRuns(row) {
  const runs = [];
  let i = 0;
  while (i < row.length) {
    if (!isInk(row[i])) { i++; continue; }
    let j = i;
    while (j < row.length && isInk(row[j])) j++;
    runs.push({ at: i, len: j - i, edge: i === 0 || j === row.length });
    i = j;
  }
  return runs;
}

try {
  // the shaders keep the dots in the world: a source check, because a screen-space pattern swims with the head and
  // differs per eye (stereo rivalry), which no still picture shows
  const src = (await readFile(path.join(ROOT, "public/vr/js/cityview.js"), "utf8")) + (await readFile(path.join(ROOT, "public/vr/js/comic.js"), "utf8"));
  check(!/gl_FragCoord/.test(src), "no shader reads gl_FragCoord: dots and lines stay anchored in the world");
  check(!/new THREE\.RawShaderMaterial/.test(src), "no RawShaderMaterial (multiview)");

  const page = await newPage({ width: 640, height: 360 });
  await open(page, "");
  await waitFor(page, () => G.viewDone, null, 300000);
  await waitFor(page, () => G.view.art && G.view.art.loaded, null, 120000);
  // the title overlay is DOM over the canvas: hide it so the screenshots show the city
  await page.evaluate(() => { document.querySelector("#title").hidden = true; });

  /* ---------------- the art ---------------- */
  const art = await page.evaluate(() => G.view.art);
  check(art.sky && art.windows, "the comic art loads: the sky strip and the window atlas", art);

  const res = {};
  for (const n of SHOTS) {
    const px = await sampleShot(page, n);
    const st = (res[n] = stats(px));
    const file = path.join(OUT, n + ".png");
    await page.screenshot({ path: file, timeout: 600000 });
    console.log("INFO: " + n.padEnd(8) + " mean " + st.mean + " spread " + st.sd + " colours " + st.distinct + " colourful " + st.sat + " rgb " + st.avg.join("/") + " -> " + file);
  }
  for (const n of SHOTS) {
    const st = res[n];
    // the diorama floats in a dark void, so its picture is darker on average
    const lo = n === "diorama" ? 8 : 35, colours = n === "diorama" ? 8 : 40;
    check(st.mean > lo && st.mean < 215 && st.sd > 10 && st.distinct > colours, n + ": the picture is neither blank nor washed out", st);
    check(st.sat > 0.3, n + ": the colours are saturated, as in the key art (colourfulness " + st.sat + ")", st);
    check(st.alphaMin === 255, n + ": every pixel writes alpha 1", st.alphaMin);
  }
  const dpx = await sampleShot(page, "diorama");
  const mid = dpx.filter((p, i) => { const x = (i % 16) / 16, y = Math.floor(i / 16) / 9; return x > 0.3 && x < 0.7 && y > 0.3 && y < 0.7; });
  check(stats(mid).mean > 45, "the diorama shows the city in the middle of the view", stats(mid));

  /* ---------------- the painted sky ---------------- */
  // skyColorAt reads the same strip as the dome. The strip's sun sits at u 0.2515, turned onto SUN_DIR's azimuth.
  const sk = await page.evaluate(async () => {
    const { SUN_DIR } = await import("./js/config.js");
    const az = Math.atan2(SUN_DIR.x, SUN_DIR.z), rad = Math.PI / 180;
    const at = (a, el) => G.view.skyColorAt({ x: Math.sin(a) * Math.cos(el * rad), y: Math.sin(el * rad), z: Math.cos(a) * Math.cos(el * rad) }).toArray().map((c) => +c.toFixed(3));
    return { sun: at(az, 2.5), sunSide: at(az + 60 * rad, 2.5), high: at(az, 25), dusk: at(az + Math.PI, 45), duskLow: at(az + Math.PI, 8), zenith: at(0, 85) };
  });
  const [sr, sg, sb] = sk.sun;
  check(sr > 0.85 && sg > 0.75 && sb < 0.6, "the painted sun sits on SUN_DIR's azimuth (bright yellow at the horizon there)", sk);
  check(lum(sk.sun.map((c) => c * 255)) > lum(sk.sunSide.map((c) => c * 255)) + 12, "the sun disc is brighter than the sky 60 degrees to its side", sk);
  check(sk.high[0] > 0.8 && sk.high[2] < 0.5, "the sunset side is saturated orange, not the old pale gold gradient", sk.high);
  check(sk.dusk[2] > sk.dusk[0] * 1.5 && sk.dusk[1] < sk.dusk[2] * 0.5 && sk.dusk[0] < 0.5, "the dusk side is deep violet", sk.dusk);
  check(sk.zenith[2] > sk.zenith[1] * 2 && sk.zenith[0] < 0.4, "the zenith is flat violet", sk.zenith);
  // on the screen: the top rows of the needle shot are sky
  const npx = await sampleShot(page, "needle");
  const top = npx.slice(0, 48);
  check(top.reduce((a, p) => a + sat(p), 0) / top.length > 0.6, "the sky on the screen is saturated (painted strip, not a pale gradient)", top.slice(0, 5));

  /* ---------------- ink lines ---------------- */
  // the canyon: facades fill the view. Building edges must be inked: thin runs of ink-coloured pixels along a row.
  await page.evaluate(() => G.test.camera("canyon"));
  const rows = [await scanRow(page, 0.3, 640), await scanRow(page, 0.62, 640)];
  const runs = rows.flatMap((r) => inkRuns(r));
  const thin = runs.filter((r) => r.len >= 1 && r.len <= 12 && !r.edge);
  const inkShare = rows.flat().filter(isInk).length / (rows.length * 640);
  console.log("INFO: canyon ink: " + thin.length + " thin runs, " + (inkShare * 100).toFixed(1) + " % of the pixels on two rows are ink-coloured, runs " + JSON.stringify(thin.slice(0, 12).map((r) => r.len)));
  check(thin.length >= 6, "ink lines run along the building edges at the canyon shot (" + thin.length + " thin runs of ink pixels)", { thin: thin.length, inkShare });
  check(inkShare < 0.35, "the ink stays lines: it does not flood the picture (" + (inkShare * 100).toFixed(1) + " %)", inkShare);
  await page.screenshot({ path: path.join(OUT, "canyon.png"), timeout: 600000 });

  /* ---------------- the tints ---------------- */
  // the canyon: facades fill the view and no car passes close by, so only the tints change the picture
  const base = stats(await sampleShot(page, "canyon"));
  // (V.snap() jumps the eased tints to their targets: a software renderer is too slow to wait for the easing)
  await page.evaluate(() => { for (let d = 0; d < 6; d++) G.view.setDistrictClog(d, 1); G.view.snap(); });
  const clog = stats(await sampleShot(page));
  const gshare = (s) => s.avg[1] / (s.avg[0] + s.avg[1] + s.avg[2] + 1e-6);
  check(gshare(clog) > gshare(base) + 0.004, "setDistrictClog turns the district greener", { before: base.avg, after: clog.avg });
  await page.evaluate(() => { for (let d = 0; d < 6; d++) G.view.setDistrictClog(d, 0); G.view.setFinale(1); G.view.snap(); });
  const fin = stats(await sampleShot(page));
  check(fin.mean > base.mean + 1, "setFinale(1) lights and warms the city", { before: base, after: fin });
  await page.evaluate(() => { G.view.setFinale(0); G.view.setKing(1); G.view.snap(); G.test.camera("needle"); });
  await page.evaluate(() => new Promise((r) => { const f = G.frame; const t = () => (G.frame > f + 1 ? r() : setTimeout(t, 50)); t(); }));
  const kpx = await page.evaluate(async () => {
    // the pod's window band, projected to the screen
    const N = G.city.needle, v = new (G.camera.position.constructor)(N.x, (N.podY0 + 12), N.z - N.podR - 0.5);
    v.project(G.camera);
    const p = await G.test.sample([[(v.x + 1) / 2, (1 - v.y) / 2]]);
    return p[0];
  });
  check(kpx[1] > kpx[0], "setKing(1) makes the pod's window band glow green", kpx);
  await page.evaluate(() => { G.view.setKing(0); G.view.snap(); });

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

  /* ---------------- comic.js: the shared helpers compile and draw ---------------- */
  // a toonified lit sphere with an ink hull, a toonified instanced box with its instanced hull, and a shader that pastes every GLSL chunk
  const api = await page.evaluate(async () => {
    const THREE = await import("three"), C = await import("./js/comic.js");
    const R = G.renderer, out = { keys: Object.keys(C).sort().join(), ink: C.INK, pal: Object.keys(C.PAL).length, glsl: Object.keys(C.GLSL).sort().join() };
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 640 / 360, 0.1, 100);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), C.toonify(new THREE.MeshLambertMaterial({ color: 0xd2202a })));
    sphere.position.set(-1.6, 0, -4);
    sphere.add(C.outlineOf(sphere, { width: 0.02 }));
    const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), C.toonify(new THREE.MeshStandardMaterial({ color: 0xf4f1ea }), { dots: 0.05 }), 2);
    const m = new THREE.Matrix4();
    boxes.setMatrixAt(0, m.makeTranslation(1.2, 0, -4)); boxes.setMatrixAt(1, m.makeTranslation(2.4, 0.2, -5));
    boxes.add(C.outlineOf(boxes, { width: 0.02 }));
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), C.toonify(new THREE.MeshBasicMaterial({ color: 0xffcf5a }), { lit: 0, dots: 0 }));
    flat.position.set(0, 1.4, -3);
    const all = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      vertexShader: "varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "varying vec3 vP; " + C.GLSL.posterize + C.GLSL.halftone + C.GLSL.ink + C.GLSL.toon + " void main() { float b = comicBand(vP.x + 0.5, 0.3, 0.7); vec3 c = comicCel(vec3(0.6, 0.4, 0.3), b); c = mix(c, vec3(0.1), comicDots(vP.xy * 4.0, 0.2, 0.4) * 0.3 + comicInk(abs(vP.y) - 0.3, 1.5) + comicHatch(vP.xy, 0.1, 0.3) * 0.1); gl_FragColor = vec4(c * (1.0 + comicPoster(vP.y + 0.5, 3.0) * 0.01 + comicInkW(10.0, 1.0) * 0.001), 1.0); }",
    }));
    all.position.set(0, -1.2, -3);
    sc.add(sphere, boxes, flat, all);
    R.setClearColor(0x808080, 1);
    R.setRenderTarget(null);
    R.render(sc, cam);
    const gl = R.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
    const at = (x, y) => { gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [px[0], px[1], px[2]]; };
    // the sphere is at 640 * 0.5 - 1.6 / (4 * tan 30 deg * 16 / 9) * 320 ... read the row through its middle and count ink pixels
    const row = []; for (let x = 0; x < w; x++) row.push(at(x, h / 2));
    out.ink = row.filter((p) => Math.max(...p) < 46).length;
    out.centre = at(w * 0.5 - 1.6 * (h / 2) / (Math.tan(Math.PI / 6) * 4) * 1, h / 2);
    out.flat = at(w / 2, h / 2 + 1.4 * (h / 2) / (Math.tan(Math.PI / 6) * 3));
    out.bg = at(2, 2);
    R.setClearColor(0xe8a070, 1);
    return out;
  });
  check(["GLSL", "INK", "PAL", "toonify", "outlineOf", "loadArt"].every((k) => api.keys.split(",").includes(k)) && api.glsl === "halftone,ink,posterize,toon", "comic.js exports the contract: INK, PAL, GLSL, toonify, outlineOf, loadArt", api);
  check(page.errors.length === 0, "toonify, outlineOf and every GLSL chunk compile and draw with no errors", page.errors);
  check(api.ink >= 4, "outlineOf draws ink lines round a mesh and an instanced mesh (" + api.ink + " ink pixels on a row)", api);
  check(Math.abs(api.centre[0] - api.bg[0]) + Math.abs(api.centre[1] - api.bg[1]) + Math.abs(api.centre[2] - api.bg[2]) > 60 && api.centre[0] > api.centre[2], "toonify gives the lit red sphere cel colours", api);
  check(Math.abs(api.flat[0] - 255) < 40 && api.flat[2] < 140, "toonify with lit: 0 keeps a flat material colour", api.flat);

  /* ---------------- flat play: the sky writes alpha 1 ---------------- */
  await page.evaluate(() => { G.test.camera(null); document.querySelector("#title").hidden = false; });
  // the click starts the intro, which compiles the room and the hand-off programs: on a loaded software renderer that can take
  // minutes, so click from the page (no auto-wait) and give the state change a long time
  await page.waitForSelector("#playFlat:not([hidden]):not([disabled])", { timeout: 120000 });
  await page.evaluate(() => document.querySelector("#playFlat").click());
  await waitFor(page, () => G.mode === "desktop", null, 600000);
  await page.evaluate(() => G.test.skipIntro());
  await waitState(page, { mode: "desktop", state: "play" }, 600000);
  await page.evaluate(() => G.test.camera("needle"));
  const sky = await sampleShot(page);
  const top2 = sky.slice(0, 32);
  check(top2.every((p) => p[3] === 255) && stats(top2).mean > 40, "in flat play the sky writes alpha 1 (top two rows of samples)", top2.slice(0, 6));
  await page.screenshot({ path: path.join(OUT, "play-needle.png"), timeout: 600000 });
  await page.evaluate(() => G.test.camera(null));
  check(page.errors.length === 0, "no errors in flat play", page.errors);
  await page.context().close();

  /* ---------------- without the art: the procedural comic look (after the first page is closed, so two software renderers never compete) ---------------- */
  {
    const p2 = await newPage({ width: 320, height: 180 });
    await p2.route(/\/art\/(sky|windows|words)\.webp/, (r) => r.abort());
    await open(p2, "");
    await waitFor(p2, () => G.viewDone && G.view.art && G.view.art.loaded, null, 300000);
    await p2.evaluate(() => { document.querySelector("#title").hidden = true; });
    const a2 = await p2.evaluate(() => G.view.art);
    const st2 = stats(await sampleShot(p2, "needle"));
    const st3 = stats(await sampleShot(p2, "canyon"));
    // the aborted files log "Failed to load resource": those are expected. Nothing else may
    const bad = p2.errors.filter((e) => !/Failed to load resource|ERR_FAILED|net::/i.test(e));
    check(!a2.sky && !a2.windows, "with the art files failing the view knows it (no sky, no windows)", a2);
    check(st2.mean > 35 && st2.sd > 10 && st3.mean > 20 && st3.sd > 8 && st2.alphaMin === 255, "with no art the procedural comic look still draws (banded sky, flat windows)", { needle: st2, canyon: st3 });
    check(bad.length === 0, "with no art there are no shader errors or warnings", bad);
    await p2.screenshot({ path: path.join(OUT, "noart-canyon.png"), timeout: 600000 });
    await p2.context().close();
  }

} catch (e) { check(false, "render threw", e.stack || String(e)); }

await close();
done();
