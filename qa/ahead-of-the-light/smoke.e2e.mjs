// Ahead of the Light in a browser (the site served at 127.0.0.1:8765). At 1280 × 800, 800 × 600, 390 × 844,
// 320 × 568 and 844 × 390: the title fits with no scroll and its buttons are 44 px or more; DEPLOY starts a run;
// the HUD draws inside the screen and clear of the touch buttons; the keys (or a drag on a touch screen) steer;
// SPACE or the SONAR button pings and marks gates; SHIFT or the BOOST button boosts; pause and resume; the light
// catching you shows its card and R or FLY AGAIN starts a new run; the autopilot gets through a sector into the
// next one's banner; a run past Earth shows HOME. No page errors. Shots go to /tmp/ahead-of-the-light-smoke.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:8765/ahead-of-the-light/?seed=5';
const OUT = '/tmp/ahead-of-the-light-smoke';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) { pass++; console.log('  ok  ', msg); } else { fail++; console.log('  FAIL', msg); } };
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const SIZES = [[1280, 800, false], [800, 600, false], [390, 844, true], [320, 568, true], [844, 390, true]];
const inside = (b, w, h) => b && b.x >= 0 && b.y >= 0 && b.x + b.w <= w + 0.5 && b.y + b.h <= h + 0.5;
const overlap = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const [w, h, touch] of SIZES) {
  console.log(`${w} × ${h}${touch ? ' touch' : ''}`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL);
  await p.waitForFunction(() => window.__race && __race.mode === 'title' && __race.attract);
  await p.waitForTimeout(800);
  const t = await p.evaluate(() => {
    const panel = document.querySelector('#title .panel');
    const vis = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const btns = [...document.querySelectorAll('#title button, #title a')].filter(vis).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 16), w: r.width, h: r.height, bottom: r.bottom, right: r.right }; });
    return { over: panel.scrollHeight - panel.clientHeight, btns, input: document.documentElement.dataset.input, h1: document.querySelector('#title h1').getBoundingClientRect().width };
  });
  check(t.over <= 1, `the title panel fits with no scroll (over by ${t.over})`);
  check(t.btns.every((b) => Math.min(b.w, b.h) >= 44 && b.bottom <= h + 0.5 && b.right <= w + 0.5), `title buttons are 44 px or more and on screen: ${t.btns.map((b) => `${b.t} ${Math.round(b.w)}×${Math.round(b.h)}`).join(', ')}`);
  check(t.input === (touch ? 'touch' : 'desk'), `controls shown for ${t.input}`);
  await p.screenshot({ path: `${OUT}/${w}x${h}-title.png` });

  // DEPLOY
  if (touch) await p.tap('#go'); else await p.click('#go');
  await p.waitForFunction(() => __race.mode === 'play');
  await p.waitForTimeout(700);
  const d0 = await p.evaluate(() => ({ x: __race.run.ship.x, d: __race.run.ship.d, drawn: __race.drawn }));
  check(d0.d > 5, `DEPLOY starts the run flying (${d0.d.toFixed(0)} m)`);
  const boxes = await p.evaluate(() => [...document.querySelectorAll('#touch button')].filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(); return { id: b.id, x: r.x, y: r.y, w: r.width, h: r.height }; }));
  const dr = d0.drawn;
  const parts = ['tape', 'sector', 'light', 'bars', 'arcs'];
  check(parts.every((k) => inside(dr[k], w, h)), `the HUD's parts are on screen: ${parts.filter((k) => !inside(dr[k], w, h)).join(', ') || 'all'}`);
  if (touch) {
    check(boxes.length === 3 && boxes.every((b) => Math.min(b.w, b.h) >= 44), `touch buttons: ${boxes.map((b) => `${b.id} ${Math.round(b.w)}`).join(', ')}`);
    const hits = [];
    for (const b of boxes) for (const k of ['tape', 'sector', 'light', 'bars']) if (overlap(b, dr[k])) hits.push(`${b.id}/${k}`);
    check(hits.length === 0, `touch buttons clear of the HUD ${hits.join(' ')}`);
  }
  // steer
  if (touch) {
    const sx = w * 0.3, sy = h * 0.6;
    const cdp = await ctx.newCDPSession(p);
    const pt = (x, y) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(sx, sy) });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(sx + i * 12, sy) }); await p.waitForTimeout(30); }
    await p.waitForTimeout(400);
    const vx = await p.evaluate(() => __race.run.ship.vx);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(vx > 10, `a drag right strafes right (vx ${vx.toFixed(1)})`);
  } else {
    await p.keyboard.down('KeyD'); await p.waitForTimeout(400);
    const vx = await p.evaluate(() => __race.run.ship.vx);
    await p.keyboard.up('KeyD');
    check(vx > 10, `D strafes right (vx ${vx.toFixed(1)})`);
    await p.keyboard.down('KeyW'); await p.waitForTimeout(300);
    const vy = await p.evaluate(() => __race.run.ship.vy);
    await p.keyboard.up('KeyW');
    check(vy > 8, `W climbs (vy ${vy.toFixed(1)})`);
  }
  // sonar and boost
  await p.evaluate(() => { __race.run.ping.cool = 0; __race.run.ship.charge = 1; });
  if (touch) await p.tap('#sonar'); else await p.keyboard.press('Space');
  await p.waitForTimeout(250);
  const ping = await p.evaluate(() => ({ n: __race.run.stats.pings, marks: __race.run.marks.size }));
  check(ping.n === 1 && ping.marks >= 1, `sonar pings and marks ${ping.marks} gates`);
  await p.screenshot({ path: `${OUT}/${w}x${h}-ping.png` });
  if (touch) {
    const b = boxes.find((x) => x.id === 'boost');
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.w / 2, y: b.y + b.h / 2, id: 2 }] });
    await p.waitForTimeout(400);
    const boosting = await p.evaluate(() => __race.run.ship.boosting);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(boosting, 'holding BOOST boosts');
  } else {
    await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(400);
    const boosting = await p.evaluate(() => __race.run.ship.boosting);
    await p.keyboard.up('ShiftLeft');
    check(boosting, 'SHIFT boosts');
  }
  // pause
  if (touch) await p.tap('#pause'); else await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  const pd = await p.evaluate(() => ({ mode: __race.mode, d: __race.run.ship.d }));
  await p.waitForTimeout(300);
  const pd2 = await p.evaluate(() => __race.run.ship.d);
  check(pd.mode === 'paused' && pd2 === pd.d, 'pause stops the run');
  await p.screenshot({ path: `${OUT}/${w}x${h}-paused.png` });
  if (touch) await p.tap('#resume'); else await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  check(await p.evaluate(() => __race.mode === 'play'), 'resume goes on');
  // through a sector into the next
  await p.evaluate(() => { __race.autopilot(0.9); __race.warp(__race.SECTOR_LEN * 3 - 250); });
  await p.waitForFunction(() => __race.run.sector === 3 || __race.mode !== 'play', null, { timeout: 30000 });
  await p.waitForTimeout(400);
  const ban = await p.evaluate(() => ({ banner: __race.drawn.banner, sector: __race.run.sector }));
  check(ban.sector === 3 && ban.banner === 'THE LOCAL GROUP', `crossing into sector 4 shows its name (${ban.banner})`);
  await p.screenshot({ path: `${OUT}/${w}x${h}-sector.png` });
  // caught
  await p.evaluate(() => { __race.autopilot(null); const r = __race.run; r.light.d = r.ship.d - 30; });
  await p.waitForFunction(() => __race.mode === 'result', null, { timeout: 15000 });
  const res = await p.evaluate(() => ({ title: document.getElementById('rTitle').textContent, over: (() => { const pn = document.querySelector('#result .panel').getBoundingClientRect(); return pn.top >= 0 && pn.bottom <= innerHeight + 0.5; })() }));
  check(/LIGHT CAUGHT YOU|HULL LOST/.test(res.title) && res.over, `the result card shows (${res.title}) and fits`);
  await p.screenshot({ path: `${OUT}/${w}x${h}-result.png` });
  if (touch) await p.tap('#again'); else await p.keyboard.press('KeyR');
  await p.waitForFunction(() => __race.mode === 'play' && __race.run.ship.d < 200);
  check(true, 'FLY AGAIN starts a new run');
  // home
  await p.evaluate(() => { __race.autopilot(0.9); __race.warp(__race.COURSE_LEN - 300); });
  await p.waitForFunction(() => __race.mode === 'result', null, { timeout: 30000 });
  const home = await p.evaluate(() => document.getElementById('rTitle').textContent);
  check(home === 'HOME AHEAD OF THE LIGHT', `past Earth: ${home}`);
  await p.screenshot({ path: `${OUT}/${w}x${h}-home.png` });
  await p.click('#toTitle');
  await p.waitForFunction(() => __race.mode === 'title');
  const best = await p.evaluate(() => document.getElementById('best').textContent);
  check(/HOME 1×/.test(best), `the title shows the best run (${best})`);
  const fm = await p.evaluate(() => __race.frameMs());
  console.log(`  info  frame work p50 ${fm?.p50.toFixed(1)} ms, p95 ${fm?.p95.toFixed(1)} ms (CPU side, SwiftShader)`);
  check(errs.length === 0, `no page errors ${errs.slice(0, 3).join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(`${fail ? 'FAIL' : 'ok'}: ${pass} passed, ${fail} failed · shots in ${OUT}`);
process.exit(fail ? 1 : 0);
