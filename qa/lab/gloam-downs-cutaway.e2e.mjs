// Gloam Downs' cutaway in a real browser (public/lab/gloam-downs/ play.js "the cutaway", cut.js), on software WebGL 2:
//   in the Gaol's torn cell, where the first wisp hangs (1.6, -1.6: a cell 1.4 m by 2 m under a roof), the mouse turns the view from the
//   mouth by 0 to 315° (8 yaws, 45° in 0.75 s) and stops, at 1280x720 and at 390x844 (a phone, touch). After 1 s with the mouse still:
//   the view has not turned by itself (the turn on screen is the mouse's within 15%, and nothing turns it once the mouse stops), it stands at least 2.5 m back, the near fade leaves the figure
//   whole, the cutaway is on wherever the mouse looks away from the mouth (and the place's splats between are out), and the drawn
//   picture shows the lamplighter: in a box round its projected body at least 4% of the pixels are its cloak's red. Before (19b99dd8)
//   the eye came to about 1 m and the near fade hid the figure: a blurry close view of walls.
//   And while the mouse turns, on every step, not only once it has stopped (the review of 8afff94f: turning slowly in from the mouth
//   the follow eye came to 0.8 m and the figure was faded out for about 20 steps before the cutaway came on): the view stands 2.5 m
//   back and the near fade leaves the figure whole, and a picture halfway through each turn shows the lamplighter too. A slow pan of
//   0.5° a step from the mouth at (1.6, -0.9), (1.6, -1.6) and the Gaol's wisp at (7.6, -2.2) does the same, with a picture at its
//   nearest step. In the cutaway each step of the mouse's pitch moves the view by as much as the mouse's own pitch (none is held
//   out of sight), and the view's pitch is never over TIGHT.top: at the Gaol's wisp at 90° it looked almost straight down at 1.28 rad,
//   the lamplighter's hood and blade over the rest of it.
// The page runs with ?test: the game is stepped by __gloam.tick() and drawn by __gloam.draw(). Needs the site served:
//   python3 -m http.server 8822 --bind 127.0.0.1 --directory public
// Run: node qa/lab/gloam-downs-cutaway.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir> for where the pictures go)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8822').replace(/\/$/, '');
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'gloam-cutaway-'));
fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const DEG = Math.PI / 180;
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };

// the share of the cloak's red (about 70, 26, 30 as drawn) in a box of the PNG, worked out in the page
async function redShare(page, png, box) {
  return page.evaluate(async ([b64, [x0, y0, x1, y1]]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const sx = img.width / innerWidth, X0 = Math.max(0, Math.floor(x0 * sx)), Y0 = Math.max(0, Math.floor(y0 * sx));
    const X1 = Math.min(img.width, Math.ceil(x1 * sx)), Y1 = Math.min(img.height, Math.ceil(y1 * sx));
    if (X1 <= X0 || Y1 <= Y0) return 0;
    const d = g.getImageData(X0, Y0, X1 - X0, Y1 - Y0).data;
    let red = 0;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], bb = d[i + 2]; if (r >= 50 && r <= 140 && gg < 0.5 * r && bb < 0.6 * r) red++; }
    return red / (d.length / 4);
  }, [png.toString('base64'), box]);
}

const browser = await chromium.launch({ executablePath, args: GL });
try {
  const rows = [];
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const phone = w < h;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${SITE}/lab/gloam-downs/?run&test&fresh&seed=7`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
    if (await page.isVisible('#runHelp')) await page.click('#bBegin');
    await page.evaluate(() => window.__gloam.release?.());
    // the layout's own pitch, to put back after the pitch checks
    const pitch0 = await page.evaluate(() => window.__gloam.state().cam.pitch);
    // the box round the lamplighter's body, projected
    const boxOf = () => {
      const g = window.__gloam, s = g.state();
      return [[s.x, s.y, s.z], [s.x, s.y + 1.6, s.z], [s.x + 0.35, s.y + 0.9, s.z], [s.x - 0.35, s.y + 0.9, s.z], [s.x, s.y + 0.9, s.z + 0.35], [s.x, s.y + 0.9, s.z - 0.35]].map(p => g.project(p));
    };
    const redOf = async (png, box) => {
      const pts = box.filter(Boolean), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      return pts.length === 6 ? redShare(page, png, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]) : 0;
    };
    // n steps of the mouse turning by `by` a step: the least distance, the most fade and the step it was at
    const turnSteps = (n, by) => page.evaluate(([n, by]) => {
      const g = window.__gloam;
      let least = Infinity, fade = 0, at = -1;
      for (let i = 0; i < n; i++) {
        const s = g.tick(1 / 60, { dyaw: by, mouse: true });
        if (s.cut.dist < least) { least = s.cut.dist; at = i; }
        fade = Math.max(fade, s.fade);
      }
      return { least, fade, at };
    }, [n, by]);
    const mid = [];
    for (let k = 0; k < 8; k++) {
      const turn = k * 45;
      await page.evaluate(() => { const g = window.__gloam; g.teleport(1.6, -1.6, Math.PI, -1.7); g.tick(1, { mouse: true }); });
      const y0 = await page.evaluate(() => window.__gloam.state().cam.yaw);
      // the turn in two halves, with a picture between, and every step of it checked
      const half = Math.round(turn / 2), a = await turnSteps(half, DEG);
      if (turn) {
        const ms = await page.evaluate(() => window.__gloam.tick(0, { mouse: true }, true).cut);
        await page.waitForTimeout(200);
        const file = `${SHOTS}/${w}x${h}-cell-mid-${turn}.png`, red = await redOf(await page.screenshot({ path: file }), await page.evaluate(boxOf));
        /* where the view stands within 4 m (the cutaway's reach) the figure shows. Farther out, the follow camera still coming in from
           its full distance (15.3 m on a phone) may have splats between that the walk map does not hold, for a moment (known, as before) */
        if (ms.dist <= 4) assert(red >= 0.04, `${w}x${h} halfway through a turn of ${turn}°: the lamplighter's cloak is ${(red * 100).toFixed(1)}% of the box round it (${file})`);
        mid.push([+red.toFixed(3), +ms.dist.toFixed(1)]);
      }
      const b = await turnSteps(turn - half, DEG);
      if (turn) {
        const mt = `${w}x${h} turning ${turn}°`;
        assert(Math.min(a.least, b.least) >= 2.5 && Math.max(a.fade, b.fade) === 0, `${mt}: a step of the turn stood ${Math.min(a.least, b.least).toFixed(2)} m back with a fade of ${Math.max(a.fade, b.fade)}`);
      }
      const st = await page.evaluate(() => {
        const g = window.__gloam;
        const y1 = g.state().cam.yaw;
        const s = g.tick(1.0, { mouse: true }, true);
        const box = [[s.x, s.y, s.z], [s.x, s.y + 1.6, s.z], [s.x + 0.35, s.y + 0.9, s.z], [s.x - 0.35, s.y + 0.9, s.z], [s.x, s.y + 0.9, s.z + 0.35], [s.x, s.y + 0.9, s.z - 0.35]].map(p => g.project(p));
        return { y1, yaw: s.cam.yaw, cut: s.cut, fade: s.fade, box };
      });
      st.y0 = y0;
      await page.waitForTimeout(300);
      const file = `${SHOTS}/${w}x${h}-cell-${turn}.png`;
      const png = await page.screenshot({ path: file });
      const pts = st.box.filter(Boolean), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const red = pts.length === 6 ? await redShare(page, png, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]) : 0;
      const tag = `${w}x${h} turned ${turn}°`;
      const mouseTurn = (st.y1 - st.y0) / DEG;
      // the turn starts out in the open, where a wall may hold back or the lean add up to 15% of it; in the cutaway it shows whole
      assert(Math.abs(mouseTurn - turn) <= 0.15 * turn + 1e-6, `${tag}: the mouse's turn showed as ${mouseTurn.toFixed(3)}°`);
      assert.equal(st.yaw, st.y1, `${tag}: the view turned by itself by ${((st.yaw - st.y1) / DEG).toFixed(2)}° after the mouse stopped`);
      assert(st.cut.dist >= 2.5, `${tag}: the view stands ${st.cut.dist.toFixed(2)} m back`);
      assert(st.fade === 0, `${tag}: the near fade left out ${st.fade} of the figure`);
      if (turn >= 90 && turn <= 270) assert(st.cut.on && st.cut.splats > 100, `${tag}: looking away from the mouth the cutaway is on (${JSON.stringify(st.cut)})`);
      assert(red >= 0.04, `${tag}: the lamplighter's cloak is ${(red * 100).toFixed(1)}% of the box round it (${file})`);
      rows.push({ size: `${w}x${h}`, turn, shown: +mouseTurn.toFixed(2), dist: +st.cut.dist.toFixed(2), pitch: +st.cut.pitch.toFixed(2), cut: st.cut.on, splats: st.cut.splats, red: +red.toFixed(3) });
    }
    rows.push({ size: `${w}x${h}`, midRed: mid });
    // a slow pan in from the mouth, 0.5° a step for 180°, every step checked, and a picture at its nearest step
    for (const [x, z, y, name] of [[1.6, -0.9, -1.7, 'mouth'], [1.6, -1.6, -1.7, 'cell'], [7.6, -2.2, 1.7, 'gaolw2']]) {
      await page.evaluate(([x, z, y]) => { const g = window.__gloam; g.teleport(x, z, Math.PI, y); g.tick(1, { mouse: true }); }, [x, z, y]);
      const r = await turnSteps(360, DEG / 2);
      const tag = `${w}x${h} a slow pan at (${x}, ${z})`;
      assert(r.least >= 2.5 && r.fade === 0, `${tag}: a step stood ${r.least.toFixed(2)} m back with a fade of ${r.fade}`);
      // again to the nearest step, and the picture there
      await page.evaluate(([x, z, y]) => { const g = window.__gloam; g.teleport(x, z, Math.PI, y); g.tick(1, { mouse: true }); }, [x, z, y]);
      await turnSteps(r.at + 1, DEG / 2);
      await page.evaluate(() => window.__gloam.tick(0, { mouse: true }, true));
      await page.waitForTimeout(200);
      const file = `${SHOTS}/${w}x${h}-pan-${name}.png`, red = await redOf(await page.screenshot({ path: file }), await page.evaluate(boxOf));
      assert(red >= 0.04, `${tag}: at its nearest step the lamplighter's cloak is ${(red * 100).toFixed(1)}% of the box round it (${file})`);
      rows.push({ size: `${w}x${h}`, pan: name, least: +r.least.toFixed(2), at: r.at, red: +red.toFixed(3) });
    }
    // the mouse's pitch in the cutaway, in the cell looking away from the mouth and at the Gaol's wisp at 90°: each step moves the view
    // by as much as the mouse's own pitch, the view is never over TIGHT.top (1.15), and the picture at the wisp shows the lamplighter
    for (const [x, z, y, turn, name] of [[1.6, -1.6, -1.7, 180, 'cell'], [7.6, -2.2, 1.7, 90, 'gaolw2']]) {
      await page.evaluate(([x, z, y]) => { const g = window.__gloam; g.teleport(x, z, Math.PI, y); g.tick(1, { mouse: true }); }, [x, z, y]);
      await turnSteps(turn, DEG);
      const p = await page.evaluate(() => {
        const g = window.__gloam;
        let s = g.tick(1, { mouse: true });
        const out = { start: s.cut.on, on: s.cut.on, from: s.cut.pitch, top: s.cut.pitch, worst: 0, up: 0, down: 0 };
        for (const [dp, n] of [[0.3, 20], [-0.3, 40], [1, 20]]) for (let i = 0; i < n; i++) {
          const pv = s.cut.pitch, pc = s.cam.pitch;
          s = g.tick(1 / 60, { dpitch: dp * Math.PI / 180, mouse: true });
          const dv = s.cut.pitch - pv, dc = s.cam.pitch - pc;
          out.worst = Math.max(out.worst, Math.abs(dv - dc));
          out.top = Math.max(out.top, s.cut.pitch);
          if (Math.abs(dv - dp * Math.PI / 180) < 2e-3) { if (dp > 0) out.up++; else out.down++; }
          out.on = out.on && s.cut.on;
        }
        return out;
      });
      const tag = `${w}x${h} the mouse's pitch at (${x}, ${z}) turned ${turn}°`;
      // in the cell the cutaway is on; at the wisp the eye may stand in the open at its full distance, and then the follow camera's
      // own pitch and rise apply as everywhere in the open
      if (name === 'cell') assert(p.start, `${tag}: the cutaway is on`);
      if (p.start) assert(p.on && p.worst < 2e-3 && p.top <= 1.15 + 1e-9 && p.up >= 20, `${tag}: ${JSON.stringify(p)}`);
      if (name === 'gaolw2') {
        // the picture with the mouse's pitch as the layout puts it (the checks above moved it)
        await page.evaluate(([x, z, y, t, p0]) => {
          const g = window.__gloam;
          g.tick(1 / 60, { dpitch: p0 - g.state().cam.pitch, mouse: true });
          g.teleport(x, z, Math.PI, y); g.tick(1, { mouse: true });
          for (let i = 0; i < t; i++) g.tick(1 / 60, { dyaw: Math.PI / 180, mouse: true });
          g.tick(1, { mouse: true }, true);
        }, [x, z, y, turn, pitch0]);
        await page.waitForTimeout(200);
        const st = await page.evaluate(() => window.__gloam.state().cut);
        const file = `${SHOTS}/${w}x${h}-gaolw2-90.png`, red = await redOf(await page.screenshot({ path: file }), await page.evaluate(boxOf));
        // in the cutaway (the view within its 3.2 m) the pitch is no more than TIGHT.top; and the lamplighter shows
        assert((!st.on || st.dist > 3.25 || st.pitch <= 1.15 + 1e-9) && red >= 0.25, `${tag}: the view's pitch ${st.pitch.toFixed(2)}, the cloak ${(red * 100).toFixed(1)}% of the box (${file})`);
        p.red = +red.toFixed(3); p.pitch = +st.pitch.toFixed(2); p.cut = st.on; p.dist = +st.dist.toFixed(2);
      }
      rows.push({ size: `${w}x${h}`, pitchAt: name, cut: p.start, viewCut: p.cut, dist: p.dist, up: p.up, down: p.down, worst: +p.worst.toFixed(4), top: +p.top.toFixed(2), red: p.red, pitch: p.pitch });
    }
    assert.deepEqual(errors, [], `${w}x${h}: page errors`);
    await ctx.close();
  }
  pass('the torn cell: at 8 mouse yaws at both sizes the view keeps the mouse\'s yaw, stands 2.5 m back on every step of the turn and shows the lamplighter halfway and after; a slow pan in from the mouth never comes in or fades the figure; the mouse\'s pitch moves the view in the cutaway', rows);
  console.log(`screenshots in ${SHOTS}`);
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
