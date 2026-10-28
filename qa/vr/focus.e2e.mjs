// Keyboard focus must remain visible against the flat panels' paper at desktop and narrow widths.
import { newPage, open, close, enterXR, checker, watchdog, shot } from './lib.mjs';
const { check, done } = checker('keyboard focus');
watchdog(600000, 'keyboard focus');
const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(c => {
  c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
try {
  for (const [width, height] of [[960, 540], [390, 844]]) {
    const page = await newPage({ width, height });
    await page.addInitScript(() => { window.AudioContext = window.webkitAudioContext = undefined; });
    await open(page, '?nosw&skipintro');
    await page.waitForFunction(() => G.viewDone);
    await enterXR(page, 'desktop');
    await page.waitForFunction(() => G.state === 'play');
    await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.ui.openPause(); G.test.step(1 / 60, 3); });
    for (const screen of ['pause', 'comfort']) {
      const panel = '.fs-menu';
      if (screen === 'comfort') await page.locator('#fsMenu [data-id=comfort]').click();
      await page.locator(panel + ' button').first().focus();
      const first = await page.evaluate(() => document.activeElement.textContent);
      await page.keyboard.press('Tab');
      const focus = await page.evaluate((selector) => {
        const e = document.activeElement, s = getComputedStyle(e), p = document.querySelector(selector), b = e.getBoundingClientRect();
        const extent = parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset);
        return { text: e.textContent, within: p.contains(e), visible: e.matches(':focus-visible'), color: s.outlineColor,
          paper: getComputedStyle(p).backgroundColor, style: s.outlineStyle, width: parseFloat(s.outlineWidth),
          fits: b.left - extent >= 0 && b.top - extent >= 0 && b.right + extent <= innerWidth && b.bottom + extent <= innerHeight };
      }, panel);
      const a = luminance(focus.color), b = luminance(focus.paper), contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      check(focus.within && focus.visible && focus.text !== first, `${width} ${screen}: Tab moves visible focus to the next control`, focus);
      check(focus.style !== 'none' && focus.width >= 2 && contrast >= 3, `${width} ${screen}: outline contrasts at least 3:1 (${contrast.toFixed(2)})`, focus);
      check(focus.fits, `${width} ${screen}: focus outline fits the viewport`, focus);
      await shot(page, `focus-${width}-${screen}`);
    }
    check(page.errors.length === 0, `${width}: no page errors`, page.errors);
    await page.context().close();
  }
} finally { await close(); }
done();
