// Neon Stack in a browser. Serves nothing; the site must already be on :8765
// (python3 -m http.server 8765 --bind 127.0.0.1 --directory public).
// NODE_PATH=qa/browser/node_modules node qa/neon/stack.e2e.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const GAME = process.env.URL || "http://127.0.0.1:8765/neon-stack/";
const HOME = new URL("/", GAME).href;
const OUT = process.env.SHOTS || "/tmp/neon-stack";
fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROME || "/usr/local/bin/chrome";
let failed = 0;
const check = (ok, msg) => {
  console.log((ok ? "  ok   " : "  FAIL ") + msg);
  if (!ok) failed++;
};
const browser = await chromium.launch({
  executablePath: fs.existsSync(exe) ? exe : undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

async function open(width, height, dpr, touch) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    hasTouch: !!touch,
    isMobile: !!touch,
  });
  const page = await context.newPage();
  const errs = [];
  const images = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) errs.push("HTTP " + r.status() + " " + r.url()); });
  page.on("request", (r) => { if (r.resourceType() === "image") images.push(r.url()); });
  return { context, page, errs, images };
}

async function ready(page, seed) {
  await page.goto(GAME + "?seed=" + seed, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__test && __test.ready());
  await page.waitForTimeout(120);
}

const desk = await open(1280, 800, 1, false);
console.log("1280 × 800");
const t0 = Date.now();
await ready(desk.page, 4);
check(Date.now() - t0 < 2000, "first paint under 2 s (" + (Date.now() - t0) + " ms)");
check(desk.errs.length === 0, "no errors on load " + desk.errs.slice(0, 3).join(" | "));
check(desk.images.length === 0, "0 image requests (" + desk.images.length + ")");
const spun = await desk.page.evaluate(async () => {
  const a = __test.state().yaw;
  await new Promise((r) => setTimeout(r, 250));
  return Math.abs(__test.state().yaw - a);
});
check(spun > 0.4, "attract yaw moves (" + spun.toFixed(2) + ")");
const shot = async (name) => {
  const t = Date.now();
  await desk.page.screenshot({ path: OUT + "/" + name + ".png" });
  check(Date.now() - t < 15000, name + " screenshot under 15 s");
};
await shot("1280-attract");

await desk.page.evaluate(() => __test.enter());
const view = await desk.page.evaluate(() => __test.view());
check(view.artW === 320 && view.scale === 4, "1280 art buffer is 320 at 4x (" + view.artW + " at " + view.scale + ")");
const budget = await desk.page.evaluate(() => __test.state());
check(budget.drawCalls <= 50, "drawCalls " + budget.drawCalls);
check(budget.slices <= 3000, "slices " + budget.slices);
check(budget.frameMs > 0, "frameMs " + budget.frameMs.toFixed(1));
console.log("  nums  drawCalls=" + budget.drawCalls + " slices=" + budget.slices + " frameMs=" + budget.frameMs.toFixed(1) + " fps=" + budget.fps.toFixed(1));

const tilt = await desk.page.evaluate(() => ({ low: (__test.setTilt(0), __test.state().tilt), high: (__test.setTilt(120), __test.state().tilt) }));
check(tilt.low === 20 && tilt.high === 87, "tilt clamps at 20 and 87 (" + tilt.low + ", " + tilt.high + ")");
await desk.page.evaluate(() => __test.setTilt(20));
await desk.page.waitForTimeout(80);
await shot("1280-tilt20");
await desk.page.evaluate(() => __test.setTilt(87));
await desk.page.waitForTimeout(80);
await shot("1280-tilt87");
const yaw = await desk.page.evaluate(() => {
  __test.setYaw(10); const a = __test.state().yaw;
  __test.setYaw(270); const b = __test.state().yaw;
  __test.setYaw(360); const c = __test.state().yaw;
  return { a, b, c };
});
check(yaw.a === 10 && yaw.b === 270 && yaw.c === 0, "yaw covers the circle (" + JSON.stringify(yaw) + ")");

await desk.page.evaluate(() => { __test.setTilt(48); __test.setYaw(40); });
const before = await desk.page.evaluate(() => ({ ...__test.state().player }));
await desk.page.mouse.move(640, 400);
await desk.page.mouse.down({ button: "right" });
for (let i = 1; i <= 6; i++) await desk.page.mouse.move(640 + i * 16, 400);
await desk.page.mouse.up({ button: "right" });
const dragged = await desk.page.evaluate(() => __test.state());
check(Math.abs(dragged.player.x - before.x) < 0.02 && Math.abs(dragged.player.y - before.y) < 0.02, "right-drag does not walk");
check(Math.abs(dragged.yaw - 40) > 2, "right-drag turns (" + dragged.yaw.toFixed(1) + ")");
await desk.page.mouse.move(500, 420);
await desk.page.mouse.down();
for (let i = 1; i <= 5; i++) await desk.page.mouse.move(500 + i * 14, 420 + i * 6);
await desk.page.mouse.up();
const left = await desk.page.evaluate(() => __test.state().player);
check(Math.abs(left.x - dragged.player.x) < 0.02 && Math.abs(left.y - dragged.player.y) < 0.02, "left-drag does not walk");

await desk.page.evaluate(() => { __test.moveTo(2.5, 1.5); __test.setYaw(180); __test.setTilt(50); });
await desk.page.waitForTimeout(200);
const walked = await desk.page.evaluate(() => ({ c: __test.client(2.5, 2.5, 0.3), p: __test.project(2.5, 2.5, 0.3) }));
check(walked.p.y > 0 && walked.p.y < 200 && walked.c.y > 0 && walked.c.y < 800, "the goal tile is on screen");
await desk.page.mouse.click(walked.c.x, walked.c.y);
const arrived = await desk.page.waitForFunction(() => __test.state().player.y > 2.05, null, { timeout: 4000 }).then(() => true, () => false);
const at = await desk.page.evaluate(() => __test.state().player);
check(arrived && Math.abs(at.x - 2.5) < 0.45, "click walks the alley (now " + at.x.toFixed(2) + "," + at.y.toFixed(2) + ")");

const cut = await desk.page.evaluate(async () => {
  const b = __test.buildings().find((x) => x.x === 1);
  __test.moveTo(2.5, b.y + 0.5);
  __test.setYaw(270);
  __test.setTilt(36);
  __test.forceCutaway(true);
  await new Promise((r) => setTimeout(r, 280));
  const on = __test.state().slices;
  __test.forceCutaway(false);
  await new Promise((r) => setTimeout(r, 280));
  const off = __test.state().slices;
  __test.forceCutaway(true);
  await new Promise((r) => setTimeout(r, 280));
  let hit = null;
  const view = __test.view();
  for (let y = 0; y < view.artH && !hit; y += 2) for (let x = 0; x < view.artW; x += 2) {
    const c = __test.pixel(x, y);
    const ochre = c[0] > 70 && c[1] > 40 && c[2] < 80 && c[0] > c[2] + 25;
    const paper = c[0] > 190 && c[1] > 180 && c[2] > 160;
    if (ochre || paper) hit = c.join(",");
  }
  return { on, off, hit };
});
check(cut.on < cut.off, "cutaway drops slices (" + cut.on + " then " + cut.off + ")");
check(!!cut.hit, "runner stays visible (" + cut.hit + ")");
await shot("1280-cutaway");

const fire = await desk.page.evaluate(async () => {
  const lights = __test.state().lights;
  const barrel = lights.find((l) => l.type === "fire");
  const neon = lights.filter((l) => l.type === "neon");
  const dist = Math.min(...neon.map((l) => Math.hypot(l.x - barrel.x, l.y - barrel.y)));
  __test.moveTo(2.5, 2.5);
  __test.setTilt(48);
  const dx = barrel.x - 2.5, dy = barrel.y - 2.5;
  __test.setYaw((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360);
  await new Promise((r) => setTimeout(r, 280));
  const view = __test.view();
  let warm = null;
  for (let y = 0; y < view.artH && !warm; y += 2) for (let x = 0; x < view.artW; x += 2) {
    const c = __test.pixel(x, y);
    if (c[0] > 150 && c[1] > c[2] + 25 && c[0] > c[1] && c[2] < 120) warm = c.join(",");
  }
  return { dist, warm, on: barrel.on };
});
check(fire.dist <= 2, "barrel within 2 tiles (" + fire.dist.toFixed(2) + ")");
check(!!fire.warm, "fire lights a nearby surface (" + fire.warm + ")");
await shot("1280-fire");

await desk.page.evaluate(() => __test.setSign(0, false));
await desk.page.waitForTimeout(220);
const faded = await desk.page.evaluate(() => __test.state().lights[0]);
check(faded.on === false, "a switched-off sign reports on: false");
await desk.page.evaluate(() => __test.setSign(0, null));

const loss = await desk.page.evaluate(async () => {
  const gl = document.querySelector("canvas").getContext("webgl2");
  const ext = gl.getExtension("WEBGL_lose_context");
  ext.loseContext();
  await new Promise((r) => setTimeout(r, 60));
  ext.restoreContext();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 50));
    if (__test.state().slices > 100 && __test.state().drawCalls > 0) return __test.state().slices;
  }
  return 0;
});
check(loss > 100, "context restore draws again (" + loss + " slices)");
check(desk.errs.length === 0, "no errors after restore " + desk.errs.slice(0, 2).join(" | "));

const other = await open(1280, 800, 1, false);
await ready(other.page, 4);
const same = await Promise.all([desk.page.evaluate(() => __test.buildings()), other.page.evaluate(() => __test.buildings())]);
check(JSON.stringify(same[0]) === JSON.stringify(same[1]), "the same seed builds the same block");
await other.context.close();

console.log("390 × 844 @2x");
const phone = await open(390, 844, 2, true);
await ready(phone.page, 4);
check(phone.errs.length === 0 && phone.images.length === 0, "phone load is quiet");
const pv = await phone.page.evaluate(() => __test.view());
check(pv.artW >= 256 && pv.artW <= 320, "phone art width " + pv.artW);
await phone.page.evaluate(() => { __test.enter(); __test.setTilt(50); __test.setYaw(50); });
await phone.page.waitForTimeout(80);
await phone.page.screenshot({ path: OUT + "/390-play.png" });
await phone.page.evaluate(() => { __test.moveTo(2.5, 1.5); __test.setYaw(180); __test.setTilt(50); });
await phone.page.waitForTimeout(200);
const tap = await phone.page.evaluate(() => __test.client(2.5, 2.5, 0.3));
await phone.page.touchscreen.tap(tap.x, tap.y);
const phoneWalk = await phone.page.waitForFunction(() => __test.state().player.y > 2, null, { timeout: 4000 }).then(() => true, () => false);
check(phoneWalk, "a tap walks on the phone");
await phone.page.evaluate(() => __test.moveTo(2.5, 1.2));
await phone.page.waitForTimeout(60);
const hold = await phone.page.evaluate(() => __test.state());
const cdp = await phone.context.newCDPSession(phone.page);
const pt = (x, y, id) => ({ x, y, id });
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt(120, 400, 1)] });
for (let i = 1; i <= 6; i++) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [pt(120 + i * 20, 400, 1)] });
  await phone.page.waitForTimeout(30);
}
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await phone.page.waitForTimeout(80);
const afterDrag = await phone.page.evaluate(() => __test.state());
check(Math.abs(afterDrag.player.x - hold.player.x) < 0.05 && Math.abs(afterDrag.player.y - hold.player.y) < 0.05, "a phone drag does not walk");
check(Math.abs(afterDrag.yaw - hold.yaw) > 2, "a phone drag turns (" + afterDrag.yaw.toFixed(1) + ")");
await phone.context.close();
await desk.context.close();

console.log("homepage");
for (const [w, h, dpr] of [[1280, 800, 1], [390, 844, 2], [320, 640, 2]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto(HOME + "?view=classic#lab", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("article[data-game='neon-stack']");
  const info = await page.evaluate(() => {
    const lab = [...document.querySelectorAll("#machinePicker optgroup")].find((g) => g.label === "Lab");
    const last = lab.lastElementChild;
    const cab = document.querySelector("article[data-game='neon-stack']");
    const b = cab.querySelector(".marquee b");
    const small = cab.querySelector(".marquee small");
    const br = b.getBoundingClientRect();
    const mr = cab.querySelector(".marquee").getBoundingClientRect();
    return {
      last: last.value,
      url: cab.dataset.url,
      title: b.textContent,
      sub: getComputedStyle(small).display,
      inside: br.left >= mr.left - 1 && br.right <= mr.right + 1,
    };
  });
  check(info.last === "neon-stack" && info.url === "/neon-stack/" && info.title === "NEON STACK", w + " cabinet is last in Lab (" + info.last + " " + info.url + ")");
  check(info.inside, w + " marquee holds the title");
  if (w <= 320) check(info.sub === "none", w + " hides the subtitle instead of cutting it (" + info.sub + ")");
  await page.selectOption("#machinePicker", "neon-stack");
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + "/lab-" + w + ".png" });
  await ctx.close();
}

async function proof(width, height, dpr, tag) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: width < 800 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(GAME + "?seed=4", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__test && __test.ready());
  await page.waitForTimeout(180);
  const attract = await page.evaluate(() => {
    const v = __test.view();
    return [[0, 0], [6, 0], [0, 6], [6, 6]].every(([x, y]) => {
      const p = __test.project(x, y, 0);
      return p.x >= -0.5 && p.y >= -0.5 && p.x <= v.artW + 0.5 && p.y <= v.artH + 0.5;
    });
  });
  check(attract, tag + " attract keeps the whole block in frame");
  await page.screenshot({ path: OUT + "/" + tag + "-open.png" });
  await page.evaluate(() => { __test.enter(); __test.moveTo(2.5, 2.5); __test.forceCutaway(false); __test.setTilt(55); __test.setYaw(20); });
  await page.waitForTimeout(220);
  const view = await page.evaluate(() => __test.view());
  check(view.artW >= 256 && view.artW <= 320, tag + " art width " + view.artW + " stays in 256..320");
  check(view.ratio <= 2, tag + " buffer ratio " + view.ratio + " is at most 2");
  const framed = await page.evaluate(() => {
    const v = __test.view();
    const box = document.querySelector("canvas").getBoundingClientRect();
    const corners = [[0, 0], [6, 0], [0, 6], [6, 6]].map(([x, y]) => {
      const p = __test.project(x, y, 0);
      return { x: p.x, y: p.y };
    });
    const inside = corners.every((p) => p.x >= -0.5 && p.y >= -0.5 && p.x <= v.artW + 0.5 && p.y <= v.artH + 0.5);
    const st = __test.state();
    const rp = __test.project(st.player.x, st.player.y, 16);
    let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1, n = 0;
    const x0 = Math.max(0, Math.floor(rp.x - 14)), x1 = Math.min(v.artW, Math.ceil(rp.x + 14));
    const y0 = Math.max(0, Math.floor(rp.y - 28)), y1 = Math.min(v.artH, Math.ceil(rp.y + 22));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const c = __test.pixel(x, y);
      const ochre = c[0] > 110 && c[0] < 215 && c[1] > 55 && c[1] < 170 && c[2] < 100 && c[0] > c[2] + 40;
      if (!ochre) continue;
      n++;
      if (x < minx) minx = x;
      if (y < miny) miny = y;
      if (x > maxx) maxx = x;
      if (y > maxy) maxy = y;
    }
    return {
      inside, corners, n, w: maxx - minx + 1, h: maxy - miny + 1,
      cssW: box.width, cssH: box.height, vw: innerWidth, vh: innerHeight, ox: v.ox, oy: v.oy,
    };
  });
  check(framed.inside, tag + " block corners stay inside at tilt 55 (" + framed.corners.map((p) => Math.round(p.x) + "," + Math.round(p.y)).join(" ") + ")");
  check(framed.cssW >= width * 0.95 && framed.cssH >= height * 0.95, tag + " canvas fills the viewport (" + Math.round(framed.cssW) + "x" + Math.round(framed.cssH) + " of " + framed.vw + "x" + framed.vh + ")");
  check(framed.n > 4 && framed.h > framed.w, tag + " runner is taller than wide (" + framed.w + "x" + framed.h + ", " + framed.n + " px)");
  await page.screenshot({ path: OUT + "/" + tag + "-block55.png" });
  await page.evaluate(() => __test.setTilt(20));
  await page.waitForTimeout(160);
  await page.screenshot({ path: OUT + "/" + tag + "-tilt20.png" });
  await page.evaluate(() => __test.setTilt(87));
  await page.waitForTimeout(160);
  await page.screenshot({ path: OUT + "/" + tag + "-tilt87.png" });

  const wall = await page.evaluate(async () => {
    __test.setTilt(50);
    __test.setYaw(18);
    __test.moveTo(2.5, 2.5);
    await new Promise((r) => setTimeout(r, 280));
    const v = __test.view();
    const snap = () => {
      const rows = [];
      for (let y = 0; y < v.artH; y += 3) {
        const row = [];
        for (let x = 0; x < v.artW; x += 3) row.push(__test.pixel(x, y));
        rows.push(row);
      }
      return rows;
    };
    const before = snap();
    for (let i = 0; i < 5; i++) __test.setSign(i, false);
    await new Promise((r) => setTimeout(r, 400));
    const after = snap();
    let hit = null;
    for (let y = 0; y < before.length && !hit; y++) for (let x = 0; x < before[0].length; x++) {
      const a = before[y][x], b = after[y][x];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const grey = Math.abs(a[0] - a[1]) < 18 && Math.abs(a[1] - a[2]) < 18;
      if (d > 80 && !grey) hit = { x: x * 3, y: y * 3, a, b, d: Math.round(d) };
    }
    return { hit, on: __test.state().lights.filter((l) => l.type === "neon").map((l) => l.on) };
  });
  check(wall.hit && wall.on.every((v) => v === false), tag + " a lit wall pixel changes when the signs go dark" + (wall.hit ? " (" + wall.hit.a.join(",") + " -> " + wall.hit.b.join(",") + ")" : ""));
  await page.screenshot({ path: OUT + "/" + tag + "-signs-off.png" });
  await page.evaluate(() => { for (let i = 0; i < 5; i++) __test.setSign(i, null); });
  await page.waitForTimeout(280);
  await page.screenshot({ path: OUT + "/" + tag + "-signs-on.png" });

  const sil = await page.evaluate(async () => {
    __test.moveTo(4.5, 2.5);
    __test.setYaw(0);
    __test.setTilt(55);
    __test.forceCutaway(false);
    await new Promise((r) => setTimeout(r, 300));
    const st = __test.state();
    const p = __test.project(st.player.x, st.player.y, 18);
    const v = __test.view();
    let near = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
    for (let y = Math.max(0, Math.floor(p.y - 36)); y < Math.min(v.artH, p.y + 36); y++) {
      for (let x = Math.max(0, Math.floor(p.x - 24)); x < Math.min(v.artW, p.x + 24); x++) {
        const c = __test.pixel(x, y);
        if (c[0] > 220 && c[1] > 210 && c[2] > 190) {
          near++;
          if (x < minx) minx = x;
          if (y < miny) miny = y;
          if (x > maxx) maxx = x;
          if (y > maxy) maxy = y;
        }
      }
    }
    return { near, w: maxx - minx + 1, h: maxy - miny + 1, p };
  });
  check(sil.near > 8 && sil.h > sil.w, tag + " paper figure covers the runner (" + sil.near + " px, " + sil.w + "x" + sil.h + ")");
  await page.screenshot({ path: OUT + "/" + tag + "-silhouette.png" });
  const nums = await page.evaluate(() => __test.state());
  console.log("  nums  " + tag + " drawCalls=" + nums.drawCalls + " slices=" + nums.slices + " frameMs=" + nums.frameMs.toFixed(1) + " fps=" + nums.fps.toFixed(1) + " art=" + view.artW + " ratio=" + view.ratio);
  check(errs.length === 0, tag + " stays quiet " + errs.slice(0, 2).join(" | "));
  await ctx.close();
}

// Reads the framebuffer the page is actually showing. No seed, no posed camera.
async function visible(width, height, dpr) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: width < 800 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(GAME, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__test && __test.ready());
  await page.evaluate(() => __test.enter());
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const sample = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    const rect = canvas.getBoundingClientRect();
    const st = __test.state();
    const GROUND = [[0x2b, 0x2a, 0x33], [0x1a, 0x1a, 0x22]];
    const OCHRE = [0xc9, 0x8b, 0x3c];
    const near = (c, t, tol) => Math.abs(c[0] - t[0]) <= tol && Math.abs(c[1] - t[1]) <= tol && Math.abs(c[2] - t[2]) <= tol;
    const isGround = (c) => GROUND.some((g) => near(c, g, 6));
    const readAt = (clientX, clientY, n) => {
      const fx = (clientX - rect.left) * (canvas.width / rect.width);
      const fy = (clientY - rect.top) * (canvas.height / rect.height);
      const cx = Math.round(fx);
      const cy = Math.round(canvas.height - fy);
      const half = (n - 1) >> 1;
      const x0 = Math.min(canvas.width - n, Math.max(0, cx - half));
      const y0 = Math.min(canvas.height - n, Math.max(0, cy - half));
      const buf = new Uint8Array(n * n * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(x0, y0, n, n, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const px = [];
      for (let i = 0; i < n * n; i++) px.push([buf[i * 4], buf[i * 4 + 1], buf[i * 4 + 2]]);
      return px;
    };
    const body = __test.client(st.player.x, st.player.y, 16);
    const around = readAt(body.x, body.y, 9);
    const ochre = around.filter((c) => near(c, OCHRE, 6)).length;
    const allGround = around.every(isGround);
    const corners = [[0, 0], [6, 0], [0, 6], [6, 6]].map(([x, y]) => __test.project(x, y, 0));
    const ax = corners.reduce((s, p) => s + p.x, 0) / 4;
    const ay = corners.reduce((s, p) => s + p.y, 0) / 4;
    const v = __test.view();
    const midX = rect.left + (v.ox + ax * v.scale) * rect.width / v.backW;
    const midY = rect.top + (v.backH - (v.oy + (v.artH - ay) * v.scale)) * rect.height / v.backH;
    const centre = readAt(midX, midY, 1)[0];
    return { ochre, allGround, centre, n: around.length, body, errs: null };
  });
  check(!sample.allGround, width + " runner window is not all ground");
  check(sample.ochre >= 20, width + " shows " + sample.ochre + " ochre pixels in the 9x9 around the runner");
  const centreGround = [[0x2b, 0x2a, 0x33], [0x1a, 0x1a, 0x22]].some((g) =>
    Math.abs(sample.centre[0] - g[0]) <= 6 && Math.abs(sample.centre[1] - g[1]) <= 6 && Math.abs(sample.centre[2] - g[2]) <= 6);
  check(!centreGround, width + " block centre is not plain ground (" + sample.centre.join(",") + ")");
  check(errs.length === 0, width + " visible check stays quiet");
  console.log("  nums  " + width + " ochre=" + sample.ochre + "/81 centre=" + sample.centre.join(","));
  await page.screenshot({ path: OUT + "/" + width + "-visible.png" });
  await ctx.close();
  return sample;
}

console.log("visible canvas");
await visible(1280, 800, 1);
await visible(390, 844, 2);
console.log("proof 1280 and 390");
await proof(1280, 800, 1, "1280");
await proof(390, 844, 2, "390");
const hi = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const hiPage = await hi.newPage();
await hiPage.goto(GAME + "?seed=4", { waitUntil: "domcontentloaded" });
await hiPage.waitForFunction(() => window.__test && __test.ready());
await hiPage.waitForTimeout(200);
const hiView = await hiPage.evaluate(() => __test.view());
check(hiView.ratio <= 2, "DPR 3 keeps the buffer ratio at most 2 (" + hiView.ratio + ")");
check(hiView.artW >= 256 && hiView.artW <= 320, "DPR 3 art width " + hiView.artW);
await hi.close();

await browser.close();
console.log(failed ? "FAIL " + failed : "PASS neon stack e2e");
process.exit(failed ? 1 : 0);
