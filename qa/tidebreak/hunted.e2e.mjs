// The "Hunted" mark under the health bar at five screen sizes. Needs the server on port 8765.
// NODE_PATH=qa/browser/node_modules node qa/tidebreak/hunted.e2e.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.TIDEBREAK_URL || 'http://127.0.0.1:8765/tidebreak/';
const hit = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let checks = 0;
for (const [w, h] of [[1440, 900], [390, 844], [844, 390], [320, 568], [568, 320]]) {
  const touch = w < 900, page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  for (let i = 0; i < 300 && await page.evaluate(() => document.getElementById('play').disabled); i++) await page.waitForTimeout(200);
  await page.click('#play');
  for (let i = 0; i < 150 && await page.evaluate(() => document.getElementById('hud').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
  for (let i = 0; i < 100 && !(await page.evaluate(async () => (await import('/tidebreak/main.js')).snapshot().running)); i++) await page.waitForTimeout(200);
  await page.waitForTimeout(600);
  if (await page.evaluate(() => document.getElementById('sheet')?.open)) await page.keyboard.press('Escape');
  const focus = id => page.evaluate(async id => { const s = (await import('/tidebreak/main.js')).qaState(); s.botFocus = [null, { id: id ?? s.playerId, until: s.time + 999 }]; }, id);
  assert.equal(await page.evaluate(() => document.getElementById('hunted').hidden), true, `${w}x${h}: no mark at the start`);
  await focus(); await page.waitForTimeout(400);
  const mark = await page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const el = document.getElementById('hunted'), r = rect(el);
    el.style.pointerEvents = 'auto'; const top = document.elementFromPoint(r.x + r.w / 2, r.y + r.h / 2); el.style.pointerEvents = '';
    const others = [...document.querySelectorAll('#hud .ability, #joystick, #map-button, #shop, #quick-buy, #recall, #portal, #rally, #auto-status, #objective, #objective-clock, #team-chat li, #difficulty-badge, #skill-points')]
      .filter(e => e.offsetParent && !e.hidden).map(e => [e.id || e.className, rect(e)]);
    return { hidden: el.hidden, text: el.textContent, role: el.getAttribute('role'), r, others, top: top === el, vw: innerWidth, vh: innerHeight };
  });
  assert.equal(mark.hidden, false, `${w}x${h}: the mark shows when the enemy bots focus the player`);
  assert.equal(mark.text, 'Hunted'); assert.equal(mark.role, 'status');
  assert.ok(mark.top && mark.r.x >= 0 && mark.r.y >= 0 && mark.r.x + mark.r.w <= mark.vw && mark.r.y + mark.r.h <= mark.vh && mark.r.w > 20, `${w}x${h}: the mark is on screen and on top`);
  assert.deepEqual(mark.others.filter(([, r]) => hit(mark.r, r)).map(([s]) => s), [], `${w}x${h}: the mark covers no HUD control`);
  await focus(-1); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.getElementById('hunted').hidden), true, `${w}x${h}: the mark goes away when the focus moves`);
  assert.deepEqual(errors, []);
  await page.close(); checks++;
}
await browser.close();
console.log(`${checks} hunted checks passed`);
