// Desktop sound, measured at the output: a fresh desktop hears the PLAY click and a city it can hear during the opening;
// a saved arcade-wide mute shows SOUND: OFF on the title, says how to fix it at PLAY, and M brings the sound back.
// It runs Chromium with the desktop autoplay rule (a sound needs a click) and real audio (the other tests turn it off).
// Run from the repo root (the server is our own, see lib.mjs).
import assert from 'node:assert/strict';
import { serve, close, watchdog } from './lib.mjs';
import { createRequire } from 'node:module';
// CommonJS require honours NODE_PATH (CI sets it to qa/browser/node_modules), as lib.mjs does
const { chromium } = createRequire(import.meta.url)('playwright');
watchdog(420000, 'sound');
const url = await serve();
const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// a meter on the engine's output: RMS and peak since the last read
const meter = (page) => page.evaluate(() => {
  const E = G.audio._engine;
  if (!E) return null;
  if (!window.__an) { const an = E.ctx.createAnalyser(); an.fftSize = 2048; E.out.connect(an); window.__an = an; window.__d = new Float32Array(2048); window.__pk = 0; window.__ss = 0; window.__n = 0;
    setInterval(() => { window.__an.getFloatTimeDomainData(window.__d); let s = 0, p = 0; for (const v of window.__d) { s += v * v; p = Math.max(p, Math.abs(v)); } window.__pk = Math.max(window.__pk, p); window.__ss += s / window.__d.length; window.__n++; }, 50); }
  // one reading now as well, so a page too busy for the timer still gets a level
  window.__an.getFloatTimeDomainData(window.__d); let s0 = 0, p0 = 0; for (const v of window.__d) { s0 += v * v; p0 = Math.max(p0, Math.abs(v)); }
  window.__ss += s0 / window.__d.length; window.__n++; window.__pk = Math.max(window.__pk, p0);
  const r = { ctx: E.ctx.state, on: G.audio.isOn, rms: Math.sqrt(window.__ss / window.__n), peak: window.__pk };
  window.__pk = 0; window.__ss = 0; window.__n = 0;
  return r;
});
async function level(page, min, tries = 5) {
  let m = null;
  for (let i = 0; i < tries; i++) { await page.waitForTimeout(1500); m = await meter(page); if (m && m.rms > min) break; }
  return m;
}
async function fresh(muted) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.setDefaultTimeout(180000); // the opening compiles its shaders on the PLAY click: slow on a CI runner
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (muted) await page.addInitScript(() => localStorage.setItem('arcade.sound', 'false'));
  await page.goto(url + '?nosw&nocut');
  await page.waitForFunction(() => window.G && G.ready && !document.querySelector('#playFlat').disabled, null, { timeout: 180000 });
  return { page, errors };
}
try {
  /* ---------------- a fresh desktop ---------------- */
  {
    const { page, errors } = await fresh(false);
    assert.equal(await page.locator('#soundBtn').textContent(), 'SOUND: ON');
    // the click sound is over before a meter can be attached to the new engine, so spy on the call instead
    await page.evaluate(() => { const f = G.audio.sfx.bind(G.audio); window.__sfx = []; G.audio.sfx = (n, o) => { window.__sfx.push({ n, on: G.audio.isOn, ctx: G.audio._engine && G.audio._engine.ctx.state }); return f(n, o); }; });
    await page.click('#playFlat', { noWaitAfter: true });
    await meter(page);
    await page.waitForTimeout(1500);
    const click = await page.evaluate(() => window.__sfx.find((c) => c.n === 'ui'));
    await meter(page);
    const intro = await level(page, 0.01);
    assert(click && click.on && click.ctx === 'running', 'the PLAY click plays, with the sound running: ' + JSON.stringify(click));
    assert(intro.rms > 0.01, 'the opening is loud enough to hear on desktop speakers (over -40 dBFS): ' + JSON.stringify(intro));
    console.log('PASS a fresh desktop hears the PLAY click and the opening', JSON.stringify({ introRms: +intro.rms.toFixed(4) }));
    assert.equal(errors.length, 0, JSON.stringify(errors));
    await page.close();
  }
  /* ---------------- muted by the arcade's speaker button ---------------- */
  {
    const { page, errors } = await fresh(true);
    assert.equal(await page.locator('#soundBtn').textContent(), 'SOUND: OFF', 'the title shows that the sound is off');
    await page.click('#playFlat', { noWaitAfter: true });
    await page.waitForFunction(() => /Sound is off/.test(document.querySelector('.fs-toast')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
    const said = await page.evaluate(() => document.querySelector('.fs-toast').textContent);
    assert(/Sound is off\. Press M/.test(said), 'PLAY says how to turn the sound on: ' + said);
    const off = await meter(page);
    assert(off.rms < 1e-4, 'muted: nothing plays: ' + JSON.stringify(off));
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(500);
    await meter(page);
    const on = await level(page, 0.005);
    assert(on.on && on.ctx === 'running' && on.rms > 0.005, 'M turns the sound back on: ' + JSON.stringify(on));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('plungerd.vr.v1')).settings.sound);
    assert.equal(saved, true, 'the choice is saved for this game');
    console.log('PASS a muted arcade shows SOUND: OFF, PLAY says press M, and M brings the sound back', JSON.stringify({ said, on: +on.rms.toFixed(4) }));
    assert.equal(errors.length, 0, JSON.stringify(errors));
    await page.close();
  }
  /* ---------------- the title button ---------------- */
  {
    const { page } = await fresh(true);
    await page.click('#soundBtn');
    assert.equal(await page.locator('#soundBtn').textContent(), 'SOUND: ON', 'the title button turns the sound on');
    await page.click('#playFlat', { noWaitAfter: true });
    await meter(page);
    const m = await level(page, 0.005);
    assert(m.on && m.ctx === 'running' && m.rms > 0.005, 'and the game is heard: ' + JSON.stringify(m));
    console.log('PASS the title SOUND button turns a muted game back on');
    await page.close();
  }
} finally { await browser.close(); await close(); }
