import { newPage, open, close, enterXR, checker, watchdog, shot } from './lib.mjs';
const { check, done } = checker('map distance');
watchdog(600000, 'map distance');
try {
  for (const [width, height] of [[960, 540], [390, 844]]) {
    const page = await newPage({ width, height });
    await page.addInitScript(() => { window.AudioContext = window.webkitAudioContext = undefined; });
    await open(page, '?nosw&skipintro');
    await page.waitForFunction(() => G.viewDone);
    await enterXR(page, 'desktop');
    await page.waitForFunction(() => G.state === 'play');
    for (const offset of [0, 100]) {
      await page.evaluate(offset => {
        G.ui.closePause(); G.test.hold(true);
        const s = G.city.start; G.test.teleport(s.x + offset, s.y, s.z); G.test.step(1 / 60, 2);
        G.ui.openMap(); G.test.step(1 / 60, 2);
      }, offset);
      const result = await page.evaluate(() => {
        const spots = G.game.travelSpots().concat(G.jobs.offers.map(o => ({ ...o, id: 'job:' + o.id })));
        const buttons = [...document.querySelectorAll('.fs-map button[data-id^="pin:"]')];
        const rows = buttons.map(b => {
          const s = spots.find(s => 'pin:' + s.id === b.dataset.id);
          return { id: b.dataset.id, label: b.querySelector('small')?.textContent,
            expected: s && Math.round(Math.hypot(s.x - G.P.pos.x, s.z - G.P.pos.z)) + ' m' };
        });
        const side = document.querySelector('.fs-map-side');
        return { rows, wide: document.documentElement.scrollWidth > innerWidth || side.scrollWidth > side.clientWidth + 1 };
      });
      check(result.rows.length >= 4 && result.rows.every(r => r.label === r.expected), `${width}, offset ${offset}: every destination has the correct distance`, result.rows);
      check(result.rows.find(r => r.id === 'pin:start')?.label === offset + ' m', `${width}, offset ${offset}: start distance refreshes, including zero`);
      check(!result.wide, `${width}, offset ${offset}: no sideways overflow`);
      await shot(page, `map-distance-${width}-${offset}`);
    }
    await page.locator('.fs-map button[data-id="pin:start"]').click();
    await page.waitForFunction(() => !G.ui.info().map.open);
    check(await page.evaluate(() => !G.ui.info().map.open && Math.hypot(G.P.pos.x - G.city.start.x, G.P.pos.z - G.city.start.z) < 1), `${width}: start destination still travels and closes the map`);
    check(page.errors.length === 0, `${width}: no page errors`, page.errors);
    await page.context().close();
  }
} finally { await close(); }
done();
