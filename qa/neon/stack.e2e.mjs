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
check(budget.slices <= 900, "slices " + budget.slices);
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
check(Math.hypot(afterDrag.player.x - hold.player.x, afterDrag.player.y - hold.player.y) > 0.05, "a phone drag walks (" + afterDrag.player.x.toFixed(2) + "," + afterDrag.player.y.toFixed(2) + ")");
check(Math.abs(afterDrag.yaw - hold.yaw) < 2, "a phone drag does not turn (" + afterDrag.yaw.toFixed(1) + ")");
const compass = await phone.page.evaluate(async () => {
  const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const miss = (got, want) => Math.acos(Math.min(1, Math.max(-1, got[0] * want[0] + got[1] * want[1]))) * 180 / Math.PI;
  const canvas = document.querySelector("canvas");
  const box = canvas.getBoundingClientRect();
  const report = {};
  __test.enter();
  __test.moveTo(3, 3);
  __test.setTilt(30);
  __test.setYaw(0);
  await new Promise((r) => setTimeout(r, 250));
  for (const kind of ["moveInput", "keys", "touch"]) {
    let fail = 0, worst = 0, n = 0;
    const bad = [];
    for (const tilt of [30, 75]) for (const yaw of [0, 45, 90, 180, 270]) {
      __test.setTilt(tilt);
      __test.setYaw(yaw);
      for (const [mx, my] of dirs) {
        __test.moveTo(3, 3);
        await new Promise((r) => setTimeout(r, 180));
        const here = __test.state().player;
        const yr = __test.state().yaw * Math.PI / 180;
        const fx = here.x + Math.sin(yr) * (36 / 32);
        const fy = here.y + Math.cos(yr) * (36 / 32);
        const o = __test.project(fx, fy, 0);
        const px = __test.project(fx + 0.3, fy, 0);
        const py = __test.project(fx, fy + 0.3, 0);
        const ox = [px.x - o.x, px.y - o.y];
        const oy = [py.x - o.x, py.y - o.y];
        const a = here;
        if (kind === "moveInput") {
          __test.moveInput(mx, my, 150);
          await new Promise((r) => setTimeout(r, 180));
        } else if (kind === "keys") {
          const keys = [];
          if (mx < 0) keys.push("a");
          if (mx > 0) keys.push("d");
          if (my < 0) keys.push("w");
          if (my > 0) keys.push("s");
          for (const k of keys) window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
          await new Promise((r) => setTimeout(r, 90));
          for (const k of keys) window.dispatchEvent(new KeyboardEvent("keyup", { key: k, bubbles: true }));
        } else {
          const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
          const ev = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
          ev("pointerdown", cx, cy);
          ev("pointermove", cx + mx * 70, cy + my * 70);
          await new Promise((r) => setTimeout(r, 90));
          ev("pointerup", cx + mx * 70, cy + my * 70);
        }
        const p = __test.state().player;
        const wdx = p.x - a.x, wdy = p.y - a.y;
        const sx = ox[0] * wdx / 0.3 + oy[0] * wdy / 0.3;
        const sy = ox[1] * wdx / 0.3 + oy[1] * wdy / 0.3;
        const err = miss(unit(sx, sy), unit(mx, my));
        n++;
        if (err > worst) worst = err;
        if (err > 10) { fail++; if (bad.length < 3) bad.push(tilt + "/" + yaw + " " + mx + "," + my + " " + err.toFixed(1)); }
        await new Promise((r) => setTimeout(r, 140));
      }
    }
    report[kind] = { n, fail, worst: +worst.toFixed(1), bad };
  }
  return report;
});
for (const kind of ["moveInput", "keys", "touch"]) {
  const r = compass[kind];
  check(r.fail === 0, kind + " stays within 10 deg (" + (r.n - r.fail) + "/" + r.n + ", worst " + r.worst + (r.bad.length ? " " + r.bad.join("; ") : "") + ")");
}
await phone.context.close();
await desk.context.close();

// Share of each plate's changing texels that are actually on screen. The fractions are the
// on-versus-off texels in the 32×48 frames (431, 236, 232, 310, 262, 372 of 1536).
const PLATE_FRAC = [122, 138, 115, 96, 91, 138].map((n) => n / 1536);
async function plates(width, height, dpr) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  for (const seed of [1, 4, 7, 9]) {
    const page = await ctx.newPage();
    await page.goto(GAME + "?seed=" + seed, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__test && __test.ready());
    const rows = await page.evaluate(async (frac) => {
      __test.enter();
      __test.moveTo(2.5, 5.2);
      __test.setTilt(55);
      __test.setYaw(0);
      for (let i = 0; i < 6; i++) __test.setSign(i, true);
      await new Promise((r) => setTimeout(r, 180));
      const canvas = document.querySelector("canvas");
      const gl = canvas.getContext("webgl2");
      const grab = () => {
        const buf = new Uint8Array(canvas.width * canvas.height * 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return buf;
      };
      const v = __test.view();
      const signs = __test.signs();
      const out = [];
      for (let i = 0; i < signs.length; i++) {
        const p = signs[i].plate;
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => p.orient === 1
          ? __test.project(p.x / 32, (p.z + sx * p.hx) / 32, p.y + sy * p.hz)
          : __test.project((p.x + sx * p.hx) / 32, p.z / 32, p.y + sy * p.hz));
        const poly = corners.map((c) => [v.ox + c.x * v.scale, v.oy + (v.artH - c.y) * v.scale]);
        let area = 0;
        for (let a = 0; a < 4; a++) {
          const q = poly[a], r = poly[(a + 1) % 4];
          area += q[0] * r[1] - r[0] * q[1];
        }
        area = Math.abs(area) / 2;
        const on = grab();
        __test.setSign(i, false);
        await new Promise((r) => setTimeout(r, 40));
        const off = grab();
        __test.setSign(i, true);
        const inside = (x, y) => {
          let n = false;
          for (let a = 0, b = 3; a < 4; b = a++) {
            const yi = poly[a][1], yj = poly[b][1];
            if ((yi > y) !== (yj > y) && x < (poly[b][0] - poly[a][0]) * (y - yi) / ((yj - yi) || 1e-6) + poly[a][0]) n = !n;
          }
          return n;
        };
        let diff = 0;
        const W = canvas.width;
        for (let k = 0; k < on.length; k += 4) {
          if (Math.abs(on[k] - off[k]) + Math.abs(on[k + 1] - off[k + 1]) + Math.abs(on[k + 2] - off[k + 2]) <= 18) continue;
          const px = (k / 4) % W, py = Math.floor(k / 4 / W);
          if (inside(px + 0.5, py + 0.5)) diff++;
        }
        out.push({ name: signs[i].name, share: area ? diff / (area * frac[i]) : 0 });
      }
      const lights = __test.state().lights.filter((l) => l.type === "neon");
      const dark = (ty) => {
        let n = 0;
        for (let tx = 0; tx < 6; tx++) {
          if (tx === 2 || tx === 3) continue;
          const x = tx + 0.5, y = ty + 0.5;
          if (lights.every((l) => Math.hypot(l.x - x, l.y - y) > 2)) n++;
        }
        return n;
      };
      return { out, alley: [dark(2), dark(4)] };
    }, PLATE_FRAC);
    for (const row of rows.out) check(row.share >= 0.8, width + " seed " + seed + " " + row.name + " plate " + Math.round(row.share * 100) + "% visible");
    check(rows.alley[0] >= 2 && rows.alley[1] >= 2, width + " alleys keep dark tiles (" + rows.alley.join(",") + ")");
    await page.close();
  }
  await ctx.close();
}
console.log("plates");
await plates(1280, 800, 1);
await plates(390, 844, 2);

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
  const spawn = await page.evaluate(async () => {
    __test.enter();
    __test.setTilt(55);
    __test.setYaw(0);
    await new Promise((r) => setTimeout(r, 160));
    const v = __test.view();
    const corners = [[0, 0], [6, 0], [0, 6], [6, 6]].map(([x, y]) => __test.project(x, y, 0));
    const span = Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x));
    const rr = __test.runnerRect();
    const box = document.querySelector("canvas").getBoundingClientRect();
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    const edge = new Uint8Array(4);
    gl.readPixels(1, Math.floor(canvas.height * 0.5), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, edge);
    const stSpawn = __test.state().player;
    const goals = __test.goals();
    const steps = (sx, sy, gx, gy) => {
      const tx = Math.floor(gx), ty = Math.floor(gy);
      const q = [[Math.floor(sx), Math.floor(sy), 0]];
      const seen = new Set([Math.floor(sx) + "," + Math.floor(sy)]);
      while (q.length) {
        const [x, y, n] = q.shift();
        if (x === tx && y === ty) return n;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          const k = nx + "," + ny;
          if (seen.has(k) || __test.solid(nx, ny)) continue;
          seen.add(k);
          q.push([nx, ny, n + 1]);
        }
      }
      return -1;
    };
    const door = __test.project(goals.exit.x, goals.exit.y, 16);
    const doorPts = [[-0.45, 0], [0.45, 0], [0, 8], [0, 28]].map(([dx, z]) => __test.project(goals.exit.x + dx, goals.exit.y, z));
    const full = doorPts.every((p) => p.x > 2 && p.y > 2 && p.x < v.artW - 2 && p.y < v.artH - 2);
    const dx = Math.round(v.ox + door.x * v.scale);
    const dy = Math.round(v.oy + (v.artH - door.y) * v.scale);
    const pix = new Uint8Array(4);
    const onScreen = door.x > 2 && door.x < v.artW - 2 && door.y > 2 && door.y < v.artH - 2;
    if (onScreen) gl.readPixels(dx, dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix);
    const cyan = pix[1] > 140 && pix[2] > 140 && pix[1] > pix[0] + 30 && pix[2] > pix[0] + 30;
    return {
      width: span / v.artW,
      runner: rr.y > 0 && rr.y + rr.h < box.height,
      feet: Math.round((box.height - (rr.y + rr.h)) / box.height * 100),
      edge: [...edge].slice(0, 3),
      exitSteps: steps(stSpawn.x, stSpawn.y, goals.exit.x, goals.exit.y),
      termSteps: steps(goals.terminal.x, goals.terminal.y, goals.exit.x, goals.exit.y),
      exitLight: Math.min(...__test.state().lights.filter((l) => l.type === "neon").map((l) => Math.hypot(l.x - goals.exit.x, l.y - goals.exit.y))),
      door: onScreen ? [...pix].slice(0, 3) : null,
      cyan: onScreen && cyan,
      full,
    };
  });
  check(spawn.exitSteps >= 3 && spawn.termSteps >= 3, tag + " path spawn->exit " + spawn.exitSteps + " terminal->exit " + spawn.termSteps);
  check(spawn.exitLight >= 2, tag + " nearest sign light to exit " + (spawn.exitLight || 0).toFixed(2));
  check(spawn.cyan && spawn.full, tag + " exit is fully visible cyan (" + (spawn.door || []).join(",") + ")");
  if (tag === "1280") {
    check(spawn.width >= 0.34 && spawn.width <= 0.40, tag + " spawn block is " + Math.round(spawn.width * 100) + "% wide");
    console.log("  nums  " + tag + " runner feet " + (spawn.feet == null ? "n/a" : spawn.feet));
    check(spawn.edge[0] === 26 && spawn.edge[1] === 26 && spawn.edge[2] === 34, tag + " side edge is ink (" + spawn.edge.join(",") + ")");
  }
  console.log("  nums  " + tag + " spawn width " + Math.round(spawn.width * 100) + "%");
  await page.evaluate(() => { __test.enter(); __test.moveTo(2.5, 2.5); __test.forceCutaway(false); __test.setTilt(55); __test.setYaw(0); });
  await page.waitForTimeout(200);
  const yaw0 = await page.evaluate(() => {
    const v = __test.view();
    const corners = [[0, 0], [6, 0], [0, 6], [6, 6]].map(([x, y]) => __test.project(x, y, 0));
    const inside = corners.every((p) => p.x >= -0.5 && p.y >= -0.5 && p.x <= v.artW + 0.5 && p.y <= v.artH + 0.5);
    const span = Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x));
    return { inside, width: span / v.artW, frameMs: __test.state().frameMs };
  });
  check(yaw0.inside, tag + " yaw 0 keeps the corners on screen");
  if (tag === "390") check(yaw0.width >= 0.8, tag + " yaw 0 block fills " + Math.round(yaw0.width * 100) + "% of the canvas width");
  console.log("  nums  " + tag + " yaw0 block=" + Math.round(yaw0.width * 100) + "% frameMs=" + yaw0.frameMs.toFixed(1));
  const neonShare = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    const buf = new Uint8Array(canvas.width * canvas.height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const W = canvas.width, H = canvas.height;
    const v = __test.view();
    const sat = (r, g, b) => {
      if (Math.abs(r - 201) <= 16 && Math.abs(g - 133) <= 16 && Math.abs(b - 58) <= 16) return false;
      const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
      return hi - lo > 36 && hi > 70;
    };
    const body = (r, g, b) => Math.abs(r - 0xf2) <= 28 && Math.abs(g - 0xa3) <= 28 && Math.abs(b - 0x3a) <= 22;
    const inside = (poly, x, y) => {
      let n = false;
      for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        const yi = poly[a][1], yj = poly[b][1];
        if ((yi > y) !== (yj > y) && x < (poly[b][0] - poly[a][0]) * (y - yi) / ((yj - yi) || 1e-6) + poly[a][0]) n = !n;
      }
      return n;
    };
    let n = 0;
    for (const s of __test.signs()) {
      const p = s.plate;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => p.orient === 1
        ? __test.project(p.x / 32, (p.z + sx * p.hx) / 32, p.y + sy * p.hz)
        : __test.project((p.x + sx * p.hx) / 32, p.z / 32, p.y + sy * p.hz));
      const poly = corners.map((c) => [v.ox + c.x * v.scale, v.oy + (v.artH - c.y) * v.scale]);
      const xs = poly.map((q) => q[0]), ys = poly.map((q) => q[1]);
      const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!inside(poly, x + 0.5, y + 0.5)) continue;
        const i = (y * W + x) * 4;
        if (sat(buf[i], buf[i + 1], buf[i + 2])) n++;
      }
    }
    const rr = __test.runnerRect();
    const box = canvas.getBoundingClientRect();
    const sx = canvas.width / box.width, sy = canvas.height / box.height;
    const rx0 = Math.max(0, Math.floor(rr.x * sx)), rx1 = Math.min(W - 1, Math.ceil((rr.x + rr.w) * sx));
    const ry0 = Math.max(0, Math.floor((box.height - rr.y - rr.h) * sy)), ry1 = Math.min(H - 1, Math.ceil((box.height - rr.y) * sy));
    for (let y = ry0; y <= ry1; y++) for (let x = rx0; x <= rx1; x++) {
      const i = (y * W + x) * 4;
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      if (sat(r, g, b) && !body(r, g, b)) n++;
    }
    return n / (buf.length / 4);
  });
  const neonCap = tag === "390" ? 0.025 : 0.045;
  check(neonShare <= neonCap, tag + " plate and outline neon is " + (neonShare * 100).toFixed(1) + "% of the frame");
  console.log("  nums  " + tag + " neon=" + (neonShare * 100).toFixed(1) + "%");
  const body = await page.evaluate(() => __test.runnerRect());
  const tilesTall = body.h / body.tilePx;
  if (tag === "390") check(tilesTall >= 1.3 && tilesTall <= 1.7, tag + " runner is " + tilesTall.toFixed(2) + " tiles tall");
  console.log("  nums  " + tag + " runner h/tile=" + tilesTall.toFixed(2) + " h=" + body.h.toFixed(1) + " tilePx=" + body.tilePx.toFixed(1));
  await page.screenshot({ path: OUT + "/" + tag + "-yaw0-on.png" });
  await page.evaluate(() => __test.setYaw(20));
  await page.waitForTimeout(200);
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
    const rr = __test.runnerRect();
    return {
      inside, corners, n: Math.round(rr.h), w: rr.w, h: rr.h,
      cssW: box.width, cssH: box.height, vw: innerWidth, vh: innerHeight, ox: v.ox, oy: v.oy,
    };
  });
  const span = Math.max(...framed.corners.map((p) => p.x)) - Math.min(...framed.corners.map((p) => p.x));
  const blockWidth = span / view.artW;
  check(framed.inside, tag + " block corners stay inside at tilt 55 (" + framed.corners.map((p) => Math.round(p.x) + "," + Math.round(p.y)).join(" ") + ")");
  check(blockWidth >= (tag === "1280" ? 0.45 : 0.75), tag + " block fills " + Math.round(blockWidth * 100) + "% of the canvas width");
  check(framed.cssW >= width * 0.95 && framed.cssH >= height * 0.95, tag + " canvas fills the viewport (" + Math.round(framed.cssW) + "x" + Math.round(framed.cssH) + " of " + framed.vw + "x" + framed.vh + ")");
  check(framed.n > 4 && framed.h > framed.w, tag + " runner is taller than wide (" + framed.w + "x" + framed.h + ", " + framed.n + " px)");
  await page.screenshot({ path: OUT + "/" + tag + "-tilt55-on.png" });
  await page.screenshot({ path: OUT + "/" + tag + "-block55.png" });
  const diff = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    const grab = () => {
      const buf = new Uint8Array(canvas.width * canvas.height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf;
    };
    const on = grab();
    const close = (r, g, b, t) => Math.abs(r - t[0]) <= 12 && Math.abs(g - t[1]) <= 12 && Math.abs(b - t[2]) <= 12;
    let concrete = 0, other = 0;
    for (let i = 0; i < on.length; i += 4) {
      const r = on[i], g = on[i + 1], b = on[i + 2], mx = Math.max(r, g, b);
      if (mx < 40 || mx > 170) continue;
      if (close(r, g, b, [0x2b, 0x2a, 0x33]) || close(r, g, b, [0x4a, 0x48, 0x52])) concrete++;
      else other++;
    }
    for (let i = 0; i < 6; i++) __test.setSign(i, false);
    await new Promise((r) => setTimeout(r, 450));
    const off = grab();
    let changed = 0;
    const count = on.length / 4;
    for (let i = 0; i < on.length; i += 4) {
      if (Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]) > 24) changed++;
    }
    const hue = (colour, r, g, b) => {
      if (Math.abs(r - 201) <= 16 && Math.abs(g - 133) <= 16 && Math.abs(b - 58) <= 16) return false;
      if (Math.abs(r - 0xc9) <= 18 && Math.abs(g - 0x8b) <= 18 && Math.abs(b - 0x3c) <= 18) return false;
      if (colour === "#FF3D8B") return r > g + 45 && b > g + 30 && r > b;
      if (colour === "#3DE0E8") return g > r + 35 && b > r + 35;
      if (colour === "#F2A33A") return r > b + 55 && g > b + 35 && r + 8 >= g && b < 110;
      if (colour === "#B6F23A") return g > r + 45 && g > b + 45;
      return false;
    };
    const lights = __test.state().lights.filter((l) => l.type === "neon");
    const v = __test.view();
    const st = __test.state();
    const rp = __test.project(st.player.x, st.player.y, 40);
    const rx = v.ox + rp.x * v.scale;
    const ry = v.oy + (v.artH - rp.y) * v.scale;
    const rad = 90 * v.scale;
    const onRunner = (x, y) => (x - rx) * (x - rx) + (y - ry) * (y - ry) < rad * rad;
    let leaked = 0;
    for (const s of lights) {
      const p = __test.project(s.x, s.y, 0);
      const q = __test.project(s.x + 3, s.y, 0);
      const rad = Math.hypot((q.x - p.x) * v.scale, (q.y - p.y) * v.scale);
      const gx = v.ox + p.x * v.scale;
      const gy = v.oy + (v.artH - p.y) * v.scale;
      const x0 = Math.max(0, Math.floor(gx - rad)), x1 = Math.min(canvas.width - 1, Math.ceil(gx + rad));
      const y0 = Math.max(0, Math.floor(gy - rad)), y1 = Math.min(canvas.height - 1, Math.ceil(gy + rad));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if ((x - gx) * (x - gx) + (y - gy) * (y - gy) > rad * rad) continue;
        if (onRunner(x, y)) continue;
        const i = (y * canvas.width + x) * 4;
        if (hue(s.colour, off[i], off[i + 1], off[i + 2])) leaked++;
      }
    }
    const corners = [[0, 0], [6, 0], [0, 6], [6, 6]].flatMap(([x, y]) => [__test.project(x, y, 0), __test.project(x, y, 256)]);
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const p of corners) {
      if (p.x < minx) minx = p.x;
      if (p.y < miny) miny = p.y;
      if (p.x > maxx) maxx = p.x;
      if (p.y > maxy) maxy = p.y;
    }
    const pad = 8;
    minx -= pad; miny -= pad; maxx += pad; maxy += pad;
    const neon = (r, g, b) => {
      if (Math.abs(r - 0xc9) <= 18 && Math.abs(g - 0x8b) <= 18 && Math.abs(b - 0x3c) <= 18) return false;
      const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
      return hi - lo > 36 && hi > 70;
    };
    let outside = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (!neon(on[i], on[i + 1], on[i + 2])) continue;
      const ax = (x - v.ox) / v.scale;
      const ay = v.artH - (y - v.oy) / v.scale;
      if (ax < minx || ax > maxx || ay < miny || ay > maxy) outside++;
    }
    const box = canvas.getBoundingClientRect();
    const rr = __test.runnerRect();
    const sx = canvas.width / box.width;
    const sy = canvas.height / box.height;
    const rx0 = (rr.x - box.left) * sx;
    const ry0 = (rr.y - box.top) * sy;
    const rx1 = rx0 + rr.w * sx;
    const ry1 = ry0 + rr.h * sy;
    const margin = 10 * sx;
    const outlineCol = (r, g, b) => {
      if (Math.abs(r - 242) <= 14 && Math.abs(g - 163) <= 14 && Math.abs(b - 58) <= 16) return true;
      if (r > g + 45 && b > g + 30 && r > b && r > 140) return true;
      if (g > r + 35 && b > r + 35 && g > 140) return true;
      if (g > r + 45 && g > b + 45 && g > 140) return true;
      return false;
    };
    let stray = 0;
    for (let y = Math.max(0, Math.floor(ry0 - margin)); y <= Math.min(canvas.height - 1, Math.ceil(ry1 + margin)); y++) {
      for (let x = Math.max(0, Math.floor(rx0 - margin)); x <= Math.min(canvas.width - 1, Math.ceil(rx1 + margin)); x++) {
        const inside = x >= rx0 + 2 && x <= rx1 - 2 && y >= ry0 + 2 && y <= ry1 - 2;
        if (inside) continue;
        const i = (y * canvas.width + x) * 4;
        if (outlineCol(off[i], off[i + 1], off[i + 2])) stray++;
      }
    }
    return { pct: changed / count, concrete, other, leaked, outside, stray };
  });
  check(diff.pct >= 0.004, tag + " signs on/off differ by " + Math.round(diff.pct * 100) + "% of pixels");
  check(diff.leaked === 0, tag + " signs off leave no sign hue within 3 tiles (" + diff.leaked + ")");
  check(diff.outside === 0, tag + " neon pixels outside the block: " + diff.outside);
  check(diff.stray === 0, tag + " signs off leave neon only on the runner (" + diff.stray + ")");
  const concretePct = diff.concrete / Math.max(1, diff.concrete + diff.other);
  console.log("  nums  " + tag + " diff=" + Math.round(diff.pct * 100) + "% concrete=" + Math.round(concretePct * 100) + "% block=" + Math.round(blockWidth * 100) + "% outside=" + diff.outside);
  await page.screenshot({ path: OUT + "/" + tag + "-tilt55-off.png" });
  await page.evaluate(() => __test.setYaw(0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + "/" + tag + "-yaw0-off.png" });
  await page.evaluate(() => { for (let i = 0; i < 6; i++) __test.setSign(i, null); });
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
    for (let i = 0; i < 6; i++) __test.setSign(i, false);
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
  await page.evaluate(() => { for (let i = 0; i < 6; i++) __test.setSign(i, null); });
  await page.waitForTimeout(280);
  await page.screenshot({ path: OUT + "/" + tag + "-signs-on.png" });

  const street = await page.evaluate(async () => {
    __test.moveTo(2.5, 4.8);
    __test.setYaw(0);
    __test.setTilt(55);
    await new Promise((r) => setTimeout(r, 200));
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    const grab = () => {
      const buf = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf;
    };
    const hue = (colour, r, g, b) => {
      if (colour === "#FF3D8B") return r > g + 30 && r > b && r > 90;
      if (colour === "#3DE0E8") return g > r + 20 && b > r + 20 && g > 80;
      if (colour === "#F2A33A") return r > b + 40 && g > b + 20 && r > 90 && b < 140;
      if (colour === "#B6F23A") return g > r + 25 && g > b + 25 && g > 90;
      return false;
    };
    const lights = __test.state().lights.filter((l) => l.street);
    const changed = [];
    for (const l of lights) {
      for (let i = 0; i < 6; i++) __test.setSign(i, false);
      __test.setSign(__test.state().lights.filter((x) => x.type === "neon").findIndex((x) => x.x === l.x && x.y === l.y), true);
      await new Promise((r) => setTimeout(r, 280));
      const on = grab();
      for (let i = 0; i < 6; i++) __test.setSign(i, false);
      await new Promise((r) => setTimeout(r, 280));
      const off = grab();
      const v = __test.view();
      const p = __test.project(l.x, l.y, 0);
      const q = __test.project(l.x + 2, l.y, 0);
      const rad = Math.hypot((q.x - p.x) * v.scale, (q.y - p.y) * v.scale);
      const gx = v.ox + p.x * v.scale;
      const gy = v.oy + (v.artH - p.y) * v.scale;
      let n = 0;
      const x0 = Math.max(0, Math.floor(gx - rad)), x1 = Math.min(canvas.width - 1, Math.ceil(gx + rad));
      const y0 = Math.max(0, Math.floor(gy - rad)), y1 = Math.min(canvas.height - 1, Math.ceil(gy + rad));
      for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
        if ((x - gx) * (x - gx) + (y - gy) * (y - gy) > rad * rad) continue;
        const i = (y * canvas.width + x) * 4;
        if (hue(l.colour, on[i], on[i + 1], on[i + 2]) && !hue(l.colour, off[i], off[i + 1], off[i + 2])) n++;
      }
      changed.push(n);
    }
    for (let i = 0; i < 6; i++) __test.setSign(i, null);
    return changed;
  });
  street.forEach((n, i) => check(n > 0, tag + " street sign " + i + " paints its own hue within 2 tiles (" + n + ")"));

  if (tag === "1280") {
    const outline = await page.evaluate(async () => {
      const sign = __test.state().lights.find((l) => l.street);
      const read = async (dist) => {
        __test.moveTo(sign.x, sign.y - dist);
        __test.setYaw(0);
        __test.setTilt(55);
        await new Promise((r) => setTimeout(r, 200));
        return __test.outline().on;
      };
      const near = await read(1.9);
      const far = await read(2.1);
      return { near, far };
    });
    check(outline.near === 1 && outline.far === 0, "outline on at 1.9 (" + outline.near + ") and off at 2.1 (" + outline.far + ")");
    const moved = await page.evaluate(async () => {
      const out = [];
      for (const yaw of [0, 90, 180]) {
        __test.moveTo(2.5, 3.2);
        __test.setYaw(yaw);
        __test.setTilt(55);
        await new Promise((r) => setTimeout(r, 80));
        const mark = __test.project(2.5, 2.2, 0);
        const step = __test.viewStep(0, -1, 0.08);
        await new Promise((r) => setTimeout(r, 80));
        const moved = __test.project(2.5, 2.2, 0);
        out.push({ yaw, dy: moved.y - mark.y, world: step.after });
      }
      return out;
    });
    for (const row of moved) {
      check(row.dy > 0.4, "yaw " + row.yaw + " up moves toward the top of the screen (" + row.dy.toFixed(1) + ")");
    }
  }

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
        if (c[0] > 180 && c[1] > 80 && c[1] < 210 && c[2] < 120 && c[0] > c[2] + 40) {
          near++;
          if (x < minx) minx = x;
          if (y < miny) miny = y;
          if (x > maxx) maxx = x;
          if (y > maxy) maxy = y;
        }
      }
    }
    const rr = __test.runnerRect();
    return { near, w: rr.w, h: rr.h, p };
  });
  check(sil.near > 8 && sil.h > sil.w, tag + " runner figure is taller than wide (" + sil.near + " px, " + sil.w.toFixed(0) + "x" + sil.h.toFixed(0) + ")");
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
    const OCHRE = [0xf2, 0xa3, 0x3a];
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
    const rr = __test.runnerRect();
    let ochre = 0;
    let around = [];
    for (const t of [0.2, 0.35, 0.5, 0.7]) {
      const sample = readAt(rr.x + rr.w / 2, rr.y + rr.h * t, 9);
      const n = sample.filter((c) => near(c, OCHRE, 8)).length;
      if (n >= ochre) { ochre = n; around = sample; }
    }
    const allGround = around.every(isGround);
    const HX = 11 / 32;
    const lights = st.lights.filter((l) => l.type === "neon");
    const buildings = __test.buildings();
    let pick = null;
    lights.forEach((s, i) => {
      buildings.forEach((b) => {
        const cx = b.x + 0.5, cz = b.y + 0.5;
        const faces = [
          { n: [1, 0], x: cx + HX, z: cz },
          { n: [-1, 0], x: cx - HX, z: cz },
          { n: [0, 1], x: cx, z: cz + HX },
          { n: [0, -1], x: cx, z: cz - HX },
        ];
        faces.forEach((f) => {
          const dx = s.x - f.x, dz = s.y - f.z;
          const dist = Math.hypot(dx, dz);
          const toward = f.n[0] * dx + f.n[1] * dz;
          if (dist < 1 || dist > 3 || toward / dist < 0.7) return;
          if (!pick || dist < pick.dist) pick = { i, colour: s.colour, z: s.z, x: s.x, y: s.y, dist, face: f };
        });
      });
    });
    return { ochre, allGround, pick };
  });
  check(!sample.allGround, width + " runner window is not all ground");
  check(sample.ochre >= 20, width + " shows " + sample.ochre + " ochre pixels in the 9x9 around the runner");
  check(!!sample.pick, width + " has a wall face 1 to 3 tiles from a sign");
  await page.screenshot({ path: OUT + "/" + width + "-visible.png" });
  const wall = await page.evaluate(async (pick) => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    const yaw = Math.atan2(pick.face.n[0], pick.face.n[1]) * 180 / Math.PI;
    const side = [-pick.face.n[1], pick.face.n[0]];
    let sx = pick.face.x + pick.face.n[0] * 0.7 + side[0] * 0.45;
    let sz = pick.face.z + pick.face.n[1] * 0.7 + side[1] * 0.45;
    if (__test.solid(sx, sz)) { sx += pick.face.n[0]; sz += pick.face.n[1]; }
    __test.moveTo(sx, sz);
    __test.setYaw(yaw);
    __test.setTilt(32);
    for (let i = 0; i < 6; i++) __test.setSign(i, null);
    await new Promise((r) => setTimeout(r, 280));
    const grab = () => {
      const buf = new Uint8Array(canvas.width * canvas.height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf;
    };
    const on = grab();
    for (let i = 0; i < 6; i++) __test.setSign(i, false);
    await new Promise((r) => setTimeout(r, 400));
    const off = grab();
    const dom = (r, g, b) => (r >= g && r >= b ? 0 : g >= b ? 1 : 2);
    const signDom = dom(parseInt(pick.colour.slice(1, 3), 16), parseInt(pick.colour.slice(3, 5), 16), parseInt(pick.colour.slice(5, 7), 16));
    let hue = 0, onLum = 0, offLum = 0;
    for (let i = 0; i < on.length; i += 16) {
      const o = on[i] + on[i + 1] + on[i + 2];
      const f = off[i] + off[i + 1] + off[i + 2];
      onLum += o;
      offLum += f;
      if (dom(on[i], on[i + 1], on[i + 2]) === signDom && o > f) hue++;
    }
    return { hue, onLum, offLum, colour: pick.colour, dist: pick.dist, signDom };
  }, sample.pick);
  check(wall.hue >= 4, width + " lit wall has " + wall.hue + " hue pixels (" + wall.colour + ")");
  check(wall.onLum > wall.offLum, width + " signs on are brighter (" + wall.onLum + " vs " + wall.offLum + ")");
  check(errs.length === 0, width + " visible check stays quiet");
  console.log("  nums  " + width + " ochre=" + sample.ochre + "/81 wall=" + wall.hue + "/81 onLum=" + wall.onLum + " offLum=" + wall.offLum + " " + wall.colour);
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
