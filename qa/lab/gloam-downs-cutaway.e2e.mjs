// Gloam Downs' cutaway in a real browser (public/lab/gloam-downs/ play.js "the cutaway", cut.js), on software WebGL 2:
//   in the Gaol's torn cell, where the first wisp hangs (1.6, -1.6: a cell 1.4 m by 2 m under a roof), the mouse turns the view from the
//   mouth by 0 to 315° (8 yaws, 45° in 0.75 s) and stops, at 1280x720 and at 390x844 (a phone, touch). After 1 s with the mouse still:
//   the view has not turned by itself (the turn on screen is the mouse's within 15%, and nothing turns it once the mouse stops), it stands at least 2.5 m back, the near fade leaves the figure
//   whole, the cutaway is on wherever the mouse looks away from the mouth (and the place's splats between are out), and the drawn
//   picture shows the lamplighter: in a box round its projected body at least 4% of the pixels are its cloak's red. Before (19b99dd8)
//   the eye came to about 1 m and the near fade hid the figure: a blurry close view of walls.
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
    for (let k = 0; k < 8; k++) {
      const turn = k * 45;
      const st = await page.evaluate(t => {
        const g = window.__gloam;
        g.teleport(1.6, -1.6, Math.PI, -1.7);
        g.tick(1, { mouse: true });
        const y0 = g.state().cam.yaw;
        if (t) g.tick(t / 45 * 0.75, { dyaw: (Math.PI / 4) / 45, mouse: true });
        const y1 = g.state().cam.yaw;
        const s = g.tick(1.0, { mouse: true }, true);
        const box = [[s.x, s.y, s.z], [s.x, s.y + 1.6, s.z], [s.x + 0.35, s.y + 0.9, s.z], [s.x - 0.35, s.y + 0.9, s.z], [s.x, s.y + 0.9, s.z + 0.35], [s.x, s.y + 0.9, s.z - 0.35]].map(p => g.project(p));
        return { y0, y1, yaw: s.cam.yaw, cut: s.cut, fade: s.fade, box };
      }, turn);
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
    assert.deepEqual(errors, [], `${w}x${h}: page errors`);
    await ctx.close();
  }
  pass('the torn cell: at 8 mouse yaws at both sizes the view keeps the mouse\'s yaw, stands 2.5 m back and shows the lamplighter', rows);
  console.log(`screenshots in ${SHOTS}`);
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
