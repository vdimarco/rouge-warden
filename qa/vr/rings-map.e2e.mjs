// Flat play: full screen on PLAY; the trial rings (a green START ring for each trial, flying through it starts the trial,
// the compass and the HUD show the next ring, every pass flashes and counts, the finish cheers); and the flat map (a plan of
// the city that fills the screen, a list hover names its pin, a click on a pin travels there). Run from the repo root.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { newPage, open, close, watchdog } from './lib.mjs';
watchdog(420000, 'rings and map');
const out = process.env.SHOTS || '/tmp/swing-qa'; await mkdir(out, { recursive: true });
const page = await newPage({ width: 640, height: 360 });
page.setDefaultTimeout(180000);
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, 'getGamepads', { value: () => [] });
  // count full screen requests (a headless browser may refuse them)
  window.__fs = 0;
  const req = Element.prototype.requestFullscreen;
  Element.prototype.requestFullscreen = function (...a) { window.__fs++; return req ? req.apply(this, a).catch(() => {}) : Promise.resolve(); };
});
try {
  await open(page, '?nosw&skipintro'); await page.waitForFunction(() => G.viewDone);
  await page.locator('#playFlat').click({ noWaitAfter: true }); await page.waitForFunction(() => G.state === 'play');
  assert(await page.evaluate(() => window.__fs) >= 1, 'PLAY asks for full screen');
  console.log('PASS PLAY ON THIS SCREEN goes full screen');

  /* ---------------- trial rings ---------------- */
  await page.evaluate(() => G.test.hold(true));
  const r = await page.evaluate(() => {
    const t = G.city.trials[1], r0 = t.rings[0];
    const before = !!G.game.progress.trial;
    // fly through the START ring from 3 m before it, along its normal
    G.test.teleport(r0.x - r0.nx * 3, r0.y - r0.ny * 3 - G.P.chest, r0.z - r0.nz * 3);
    G.P.vel.x = r0.nx * 25; G.P.vel.y = r0.ny * 25 + 4; G.P.vel.z = r0.nz * 25;
    for (let i = 0; i < 20 && !G.game.progress.trial; i++) G.test.step(1 / 60, 1);
    const p = G.game.progress.trial;
    G.test.step(1 / 60, 2);
    const pill = document.querySelector('[data-k=trial]').textContent, said = document.querySelector('.fs-sub').textContent;
    const next = p && p.next, compass = !document.querySelector('[data-k=compassBox]').hidden;
    return { before, id: p && p.id, ring: p && p.ring, total: p && p.total, pill, said, next: !!next, compass, flash: !!document.querySelector('.fs-flash') };
  });
  assert(!r.before && r.id === 1 && r.ring === 1 && r.total > 5, 'flying through the green START ring starts the trial and counts it: ' + JSON.stringify(r));
  assert(new RegExp('^1/' + r.total).test(r.pill) && r.next && r.compass && r.flash && /Ring 1 of/.test(r.said), 'the HUD counts the ring, the compass points on, the edges glow: ' + JSON.stringify(r));
  console.log('PASS a START ring starts the trial; the count, the compass and the glow show', JSON.stringify({ pill: r.pill, said: r.said }));
  await page.screenshot({ path: out + '/trial-ring.png' });
  const fin = await page.evaluate(() => {
    const t = G.city.trials[1];
    for (let k = 1; k < t.rings.length; k++) {
      const rk = t.rings[k];
      // move the body with no teleport (a respawn would end the trial), 5 m before the ring, flying through it
      const P = G.P; P.pos.x = rk.x - rk.nx * 5; P.pos.y = rk.y - rk.ny * 5 - P.chest; P.pos.z = rk.z - rk.nz * 5;
      P.vel.x = rk.nx * 20; P.vel.y = rk.ny * 20; P.vel.z = rk.nz * 20; P.onGround = false; P.ground = null; P.wall = null;
      G.test.step(1 / 60, 30);
    }
    return { trial: G.game.progress.trial, best: G.save.best[String(t.id)], said: document.querySelector('.fs-sub').textContent };
  });
  assert(fin.trial === null && fin.best > 0 && /done!/.test(fin.said), 'the last ring finishes the trial with a cheer: ' + JSON.stringify(fin));
  console.log('PASS the last ring finishes the trial:', fin.said);
  // a teleport across a START ring is not a flight
  const tp = await page.evaluate(() => {
    const t = G.city.trials[0], r0 = t.rings[0];
    G.test.teleport(r0.x - r0.nx * 4, r0.y - G.P.chest, r0.z - r0.nz * 4); G.test.step(1 / 60, 2);
    G.test.teleport(r0.x + r0.nx * 4, r0.y - G.P.chest, r0.z + r0.nz * 4); G.test.step(1 / 60, 2);
    return G.game.progress.trial;
  });
  assert.equal(tp, null, 'a teleport across a START ring starts nothing');
  console.log('PASS a teleport across a START ring starts nothing');

  /* ---------------- the flat map ---------------- */
  await page.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y, s.z); G.test.step(1 / 60, 2); G.test.hold(false); });
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => G.test.ui().panel === 'map');
  // the plan draws on the next animation frame: wait for its first pixels (read from a copy, so the page's own canvas never
  // sees a readback)
  await page.evaluate(() => { window.__px = (c) => { const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0); return x.getImageData(0, 0, o.width, o.height).data; }; });
  await page.waitForFunction(() => { const c = document.querySelector('.fs-map-plan canvas'); if (!c || !c.width) return false; const d = window.__px(c); return d[(((c.height >> 1) * c.width + (c.width >> 1)) << 2) + 3] > 0; }, null, { timeout: 30000, polling: 250 });
  const m = await page.evaluate(() => {
    const cv = document.querySelector('.fs-map-plan canvas'), d = window.__px(cv);
    let lit = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) lit++;
    const r = cv.getBoundingClientRect();
    return { lit: lit / (d.length / 16), w: r.width, h: r.height, table: G.scene.getObjectByName('ui:map')?.visible, places: document.querySelectorAll('.fs-map-side .btn').length };
  });
  assert(m.lit > 0.4 && m.w > 300 && m.h > 200 && m.table === false && m.places >= 4, 'Tab shows the plan map, not the small table model: ' + JSON.stringify(m));
  await page.screenshot({ path: out + '/map-plan.png' });
  await page.hover("#fsMap button[data-id='pin:start']");
  const tag = await page.evaluate(() => {
    const t = document.querySelector('.fs-map-tip'), p = document.querySelector('.fs-map-plan').getBoundingClientRect(), r = t.getBoundingClientRect();
    const others = [...document.querySelectorAll('.fs-tip')].filter((e) => !e.hidden && e.getBoundingClientRect().width > 0).length;
    return { shown: !t.hidden, text: t.textContent, inside: r.left >= p.left - 1 && r.right <= p.right + 1 && r.top >= p.top - 1 && r.bottom <= p.bottom + 1, others };
  });
  assert(tag.shown && /start roof/i.test(tag.text) && tag.inside && tag.others === 0, 'hovering a place names its pin on the plan: ' + JSON.stringify(tag));
  // click the Tower Run pin on the plan: you go there
  const pin = await page.evaluate(() => {
    const t = G.city.trials[1], cv = document.querySelector('.fs-map-plan canvas'), r = cv.getBoundingClientRect();
    const B = G.city.bounds, x0 = B.minX - 16, x1 = B.maxX + 16, z0 = B.minZ - 16, z1 = G.city.shoreZ + 70;
    const s = Math.min(r.width / (x1 - x0), r.height / (z1 - z0)), ox = (r.width - (x1 - x0) * s) / 2, oz = (r.height - (z1 - z0) * s) / 2;
    return { x: r.left + ox + (t.start.x - x0) * s, y: r.top + oz + (t.start.z - z0) * s, to: t.start };
  });
  await page.mouse.click(pin.x, pin.y);
  await page.waitForFunction(() => G.test.ui().panel !== 'map', null, { timeout: 60000 });
  await page.waitForFunction((to) => { const p = G.P.pos; return Math.hypot(p.x - to.x, p.z - to.z) < 12; }, pin.to, { timeout: 60000 });
  console.log('PASS Tab shows the plan map; a list hover names its pin; a click on a pin travels there');
  assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
  console.log('PASS no runtime errors');
} finally { await close(); }
