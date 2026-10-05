// Enemy difficulty control and match label at five screen sizes. Needs the server on port 8765.
// NODE_PATH=qa/browser/node_modules node qa/tidebreak/difficulty.e2e.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.TIDEBREAK_URL || 'http://127.0.0.1:8765/tidebreak/';
const hit = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const rect = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
let checks = 0;
for (const [w, h] of [[1440, 900], [390, 844], [844, 390], [320, 568], [568, 320]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: w < 900 }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL); await page.evaluate(() => localStorage.setItem('tidebreak.difficulty', 'mythic')); await page.reload();
  await page.waitForSelector('#difficulty-picker [data-difficulty]'); await page.waitForTimeout(1500);
  // Every button is on screen, wide enough, and receives the tap. The picker covers no menu control.
  const menu = await page.evaluate(src => {
    const rect = new Function(`return ${src}`)();
    const buttons = [...document.querySelectorAll('#difficulty-picker button')].map(b => { const r = rect(b), top = document.elementFromPoint(r.x + r.w / 2, r.y + r.h / 2); return { r, ok: b === top || b.contains(top) }; });
    const others = ['#play', '.menu-links', '#role-filters', '#hero-picks', '.selection-tabs', '.selection-account'].map(s => [s, rect(document.querySelector(s))]);
    return { picker: rect(document.querySelector('#difficulty-picker')), buttons, others, checked: document.querySelector('#difficulty-picker [aria-checked="true"]').dataset.difficulty, vw: innerWidth, vh: innerHeight };
  }, rect.toString());
  assert.equal(menu.checked, 'mythic', `${w}x${h}: the saved choice is shown`);
  for (const { r, ok } of menu.buttons) assert.ok(ok && r.x >= 0 && r.y >= 0 && r.x + r.w <= menu.vw && r.y + r.h <= menu.vh && r.w >= 30, `${w}x${h}: a picker button is on screen and takes taps`);
  assert.deepEqual(menu.others.filter(([, r]) => hit(menu.picker, r)).map(([s]) => s), [], `${w}x${h}: the picker covers no menu control`);
  // The match label shows the choice and covers no HUD part.
  await page.click('#difficulty-picker [data-difficulty="apprentice"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('tidebreak.difficulty')), 'apprentice');
  await page.click('#play'); await page.waitForTimeout(700); await page.keyboard.press('Enter'); await page.waitForTimeout(500); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#hud').hidden, null, { timeout: 30000 }); await page.waitForTimeout(1200);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /Back to the hunt/.test(b.textContent))?.click()); await page.waitForTimeout(1200);
  const hud = await page.evaluate(src => {
    const rect = new Function(`return ${src}`)(), badge = document.querySelector('#difficulty-badge');
    const others = [...document.querySelectorAll('#objective-clock span, #lineup *, #clock, #allied-score, #enemy-score, .hud-corner button, #hud .abilities *, #map-button, #gpu-note, #team-chat *')].filter(e => e.offsetParent).map(e => [e.id || e.className || e.tagName, rect(e)]);
    badge.style.pointerEvents = 'auto'; const r = rect(badge), top = document.elementFromPoint(r.x + r.w / 2, r.y + r.h / 2); badge.style.pointerEvents = '';
    return { text: badge.textContent, hidden: badge.hidden, badge: r, others, visible: top === badge, vw: innerWidth, vh: innerHeight };
  }, rect.toString());
  assert.equal(hud.text, 'Apprentice'); assert.equal(hud.hidden, false);
  assert.ok(hud.visible && hud.badge.x >= 0 && hud.badge.x + hud.badge.w <= hud.vw && hud.badge.y >= 0, `${w}x${h}: the label is on screen and on top`);
  assert.deepEqual(hud.others.filter(([, r]) => hit(hud.badge, r)).map(([s]) => s), [], `${w}x${h}: the label covers no HUD part`);
  assert.deepEqual(errors, []);
  await page.close(); checks++;
}
// Blocked storage: the picker still changes, and the match uses the choice.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => { const fail = () => { throw new Error('blocked'); }; Object.defineProperty(window, 'localStorage', { get: fail }); });
  await page.goto(URL); await page.waitForSelector('#difficulty-picker [data-difficulty]'); await page.waitForTimeout(800);
  await page.click('#difficulty-picker [data-difficulty="mythic"]');
  assert.equal(await page.$eval('#difficulty-picker [aria-checked="true"]', b => b.dataset.difficulty), 'mythic', 'blocked storage does not lock the picker');
  await page.focus('#difficulty-picker [aria-checked="true"]'); await page.keyboard.press('ArrowLeft');
  assert.equal(await page.$eval('#difficulty-picker [aria-checked="true"]', b => b.dataset.difficulty), 'veteran', 'arrow keys work with blocked storage');
  await page.close(); checks++;
}
await browser.close();
console.log(`${checks} difficulty checks passed`);
