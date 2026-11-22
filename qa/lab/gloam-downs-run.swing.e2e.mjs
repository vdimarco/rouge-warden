// Gloam Downs: the lamplighter's swings in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2, at 1280x720 and
// 390x844 (touch): the held string at a training post logs swing, strike, hit and recover at the steps of play.js SWINGS; the trail of
// each swing lays lamp-coloured smears, so the hit step's picture has more lamp pixels round the figure with the trail than without
// it (__gloam.fx({ trail: false })); and the page logs no error.
// Takes pictures of the hit steps (SHOTS=<dir> keeps them).
// Needs the site served: python3 -m http.server 8851 --bind 127.0.0.1 --directory public
// Run: node qa/lab/gloam-downs-run.swing.e2e.mjs   (SITE_URL to point elsewhere)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8851').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
const G = (page, fn, arg) => page.evaluate(fn, arg);

async function open(viewport, touch) {
  const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 });
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/?run&test&fresh&seed=7`);
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
  await (touch ? page.tap('#bBegin') : page.click('#bBegin'));
  return { ctx, page, errors };
}
/* the Gaol's yard with no foes, a post 2.6 m ahead, then the string held until the first hit lands; the hit step is drawn, and the
   lamp pixels (within 12 on each of R, G and B of slots 46 and 47) are counted in a box round the figure */
async function string(page, trail) {
  return G(page, trail => {
    const g = window.__gloam;
    g.fx({ trail });
    for (const z of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']) g.out(z);
    g.clearPosts();
    g.teleport(5.6, 11.2, -Math.PI / 2);
    g.tick(4, {});
    const s0 = g.state();
    g.post(s0.x + Math.sin(s0.yaw) * 2.6, s0.z + Math.cos(s0.yaw) * 2.6);
    g.tick(0.2, {});
    const n0 = g.sounds().length;
    let i = 0;
    for (; i < 40; i++) { g.tick(1 / 60, { attack: true }); if (g.sounds().slice(n0).some(c => c.cue === 'hit')) break; }
    // one more step: the hit stop holds the pose, the trail is laid
    g.tick(1 / 60, {});
    g.draw();
    const s = g.state(), c = document.getElementById('view'), gl = c.getContext('webgl2'), w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const r = c.getBoundingClientRect(), sx = w / r.width, sy = h / r.height;
    const pts = [];
    for (let a = 0; a < 8; a++) for (const y of [0, 1.8]) pts.push(g.project([s.x + Math.sin(a * Math.PI / 4) * 1.8, s.y + y, s.z + Math.cos(a * Math.PI / 4) * 1.8]));
    const q = pts.filter(Boolean);
    const x0 = Math.max(0, Math.floor((Math.min(...q.map(v => v[0])) - r.left) * sx)), x1 = Math.min(w - 1, Math.ceil((Math.max(...q.map(v => v[0])) - r.left) * sx));
    const y0 = Math.max(0, Math.floor((Math.min(...q.map(v => v[1])) - r.top) * sy)), y1 = Math.min(h - 1, Math.ceil((Math.max(...q.map(v => v[1])) - r.top) * sy));
    const pal = g.palette(), lamp = [pal[46], pal[47]].map(v => [(v >> 16) & 255, (v >> 8) & 255, v & 255]);
    let k = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = ((h - 1 - y) * w + x) * 4;
      if (lamp.some(f => Math.abs(px[o] - f[0]) <= 12 && Math.abs(px[o + 1] - f[1]) <= 12 && Math.abs(px[o + 2] - f[2]) <= 12)) k++;
    }
    return { lamp: k, box: [x0, y0, x1, y1], trails: s.trails, act: s.act, cues: g.sounds().slice(n0).map(c => [c.cue, c.play, c.hit]) };
  }, trail);
}
for (const [name, viewport, touch] of [['desktop', { width: 1280, height: 720 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const { ctx, page, errors } = await open(viewport, touch);
  const off = await string(page, false);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/swing-${name}-off.png` });
  // a fresh page for the trail on, so both strings start the same
  await page.reload();
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
  await (touch ? page.tap('#bBegin') : page.click('#bBegin'));
  const on = await string(page, true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/swing-${name}-on.png` });
  // the cues: swing, strike 4 play steps later, hit 6 steps after the swing, in the same play steps with the trail on or off
  const at = (r, cue) => r.cues.find(c => c[0] === cue)?.[1];
  for (const r of [off, on]) {
    assert.equal(at(r, 'strike') - at(r, 'swing'), 4, JSON.stringify(r.cues));
    assert.equal(at(r, 'hit') - at(r, 'swing'), 6, JSON.stringify(r.cues));
  }
  assert.deepEqual(on.cues, off.cues, 'the trail changes no cue');
  assert(on.act && on.act.move === 'cut1' && on.act.ph === 'act', `the hit step shows the cut's active time: ${JSON.stringify(on.act)}`);
  assert(off.trails === 0 && on.trails >= 2, `trail steps: off ${off.trails}, on ${on.trails}`);
  assert(on.lamp >= off.lamp + 12, `lamp pixels round the figure: ${on.lamp} with the trail, ${off.lamp} without`);
  assert.deepEqual(errors, []);
  pass(`${name}: the string's cues at the steps of SWINGS, and the first cut's trail on its hit step`, { lamp: [off.lamp, on.lamp], trails: on.trails, box: on.box });
  await ctx.close();
}
await browser.close();
console.log(`${n} checks passed`);
