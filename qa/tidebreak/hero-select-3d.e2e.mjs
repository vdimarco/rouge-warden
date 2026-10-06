// Shore of the Ancients, the 3D arena behind the hero select (main.js drawArena, three-render.js showcaseCamera), checked
// in Chromium with SwiftShader and ?renderer=3d:
// - the 3D canvas draws behind the menu with the hero select camera, and the painted stage and portrait step aside;
// - the selected hero's model stands on screen inside the portrait's box, and choosing another hero swaps the model;
// - the arena draws at most about 30 frames a second, and not while the tab is hidden;
// - the roster, the skill previews and Play stay on top and take clicks at five screen sizes;
// - with reduced motion the camera holds still;
// - starting the draft stops the arena, and the match draws with the gameplay camera;
// - ?renderer=2d keeps the painted stage and portrait.
// Needs the static server (see AGENTS.md): NODE_PATH=qa/browser/node_modules node qa/tidebreak/hero-select-3d.e2e.mjs
// SHOTS=<dir> also saves a screenshot of the hero select at each size.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const SIZES = ['1440x900', '3440x1440', '390x844', '844x390', '320x568'];
const results = [];
const pass = (name, data) => { results.push(name); console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
// requestAnimationFrame runs from the real one while __auto is on; the test can stop it and pump exact frames.
const VIRTUAL_RAF = () => {
  const real = window.requestAnimationFrame.bind(window); let queue = []; window.__auto = true; window.__ts = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__pump = ts => { const q = queue; queue = []; for (const cb of q) cb(ts); };
  const tick = () => { if (window.__auto) { window.__ts = performance.now(); window.__pump(window.__ts); } real(tick); }; real(tick);
};
async function open(query, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...options });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(VIRTUAL_RAF);
  await page.goto(URL + query, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 240000 });
  const pump = (n, ms = 34) => page.evaluate(([n, ms]) => { for (let i = 0; i < n; i++) { window.__ts += ms; window.__pump(window.__ts); } }, [n, ms]);
  return { page, errors, pump };
}
const arenaOn = page => page.waitForFunction(() => document.getElementById('menu').classList.contains('arena-3d'), null, { timeout: 240000 });
// The player's hero view in the arena: model, place on screen and the portrait box it should stand in.
const heroView = page => page.evaluate(() => {
  const r = document.getElementById('battle').__shore3d, s = r.stateRef, p = s.units.find(u => u.id === s.playerId), v = r.units.views.get(p.id);
  const feet = r.project(p.x, p.y, 0), head = r.project(p.x, p.y, v.height * .9), art = document.getElementById('hero-art').getBoundingClientRect();
  return { slug: v.slug, model: !!v.model, visible: !!v.root.visible, feet, head, art: { left: art.left, right: art.right, top: art.top, bottom: art.bottom }, frames: r.frames, stats: r.stats(), camera: r.camera.position.toArray().map(n => +n.toFixed(2)), width: innerWidth, height: innerHeight };
});
try {
  {
    const t = await open('?renderer=3d'), { page, pump } = t;
    await arenaOn(page);
    await page.evaluate(() => { window.__auto = false; }); await pump(3);
    let h = await heroView(page);
    const look = await page.evaluate(() => { const m = document.getElementById('menu'), cs = getComputedStyle(m); return { bg: cs.backgroundImage, art: getComputedStyle(document.getElementById('hero-art')).visibility, canvas: !!document.getElementById('battle-3d') }; });
    assert(h.stats.showcase && h.stats.fov === 30 && h.stats.cameraPitch === 15, 'the hero select camera draws: ' + JSON.stringify(h.stats.showcase));
    assert(look.canvas && !/shore-scene/.test(look.bg) && look.art === 'hidden', 'the painted stage and portrait step aside: ' + JSON.stringify(look));
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('battle-3d')).display), 'block');
    pass('the 3D arena draws behind the menu', { drawCalls: h.stats.drawCalls, pitch: h.stats.cameraPitch });

    // The hero model stands in the portrait's box: feet near its lower edge, centred, head inside the screen.
    const inBox = h => h.model && h.visible && Math.abs(h.feet.x - (h.art.left + h.art.right) / 2) < 6 && h.feet.y <= h.art.bottom + 2 && h.feet.y > h.art.top && h.head.y >= 0 && h.head.y < h.feet.y - 80;
    assert(inBox(h), 'the selected hero model is on screen in the portrait box: ' + JSON.stringify(h));
    assert.equal(h.slug, 'tidewarden');
    pass('the selected hero model stands where the portrait stood', { slug: h.slug, feet: h.feet, head: h.head });

    // Choosing another hero swaps the model; the card stays on top of the 3D canvas.
    const top = await page.evaluate(() => { const b = document.querySelector('[data-hero="1"]').getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!e?.closest('[data-hero="1"]'); });
    assert(top, 'the roster card takes the pointer');
    await page.evaluate(() => document.querySelector('[data-hero="1"]').click()); // a native click: the held frames would stall the pointer's wait for a stable element
    for (let i = 0; i < 240; i++) { await pump(1); h = await heroView(page); if (h.slug === 'embersong' && h.model) break; await page.waitForTimeout(250); }
    assert(h.slug === 'embersong' && inBox(h), 'choosing Embersong swaps the model: ' + JSON.stringify(h));
    // Arrow keys in the roster choose too.
    await page.focus('[data-hero="1"]'); await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 240; i++) { await pump(1); h = await heroView(page); if (h.slug === 'voidcaller' && h.model) break; await page.waitForTimeout(250); }
    assert.equal(h.slug, 'voidcaller', 'the keyboard choice swaps the model');
    pass('choosing another hero changes the model', { slug: h.slug });

    // The frame cap: half a second of a 125 Hz and a 60 Hz screen draws about 15 frames each. (SwiftShader renders each
    // frame slowly, so the test keeps the frame count low.)
    const count = async (n, ms) => { const a = (await heroView(page)).frames; await pump(n, ms); return (await heroView(page)).frames - a; };
    const fast = await count(62, 8), slow = await count(30, 1000 / 60);
    assert(fast >= 13 && fast <= 16 && slow >= 13 && slow <= 16, 'about 30 frames a second: ' + JSON.stringify({ fast, slow }));
    // A hidden tab draws nothing.
    await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
    const hidden = await count(10, 34);
    await page.evaluate(() => { delete document.hidden; });
    assert.equal(hidden, 0, 'no frames while the tab is hidden');
    pass('the arena draws at most 30 frames a second and pauses when hidden', { fast, slow, hidden });

    // The camera sways slowly.
    const c0 = (await heroView(page)).camera; await pump(3, 500); const c1 = (await heroView(page)).camera;
    assert(Math.hypot(c0[0] - c1[0], c0[2] - c1[2]) > 1, 'the camera drifts: ' + JSON.stringify([c0, c1]));

    // Every size: the hero stands in the portrait box, and the roster, a skill preview and Play take the pointer.
    for (const size of SIZES) {
      const [width, height] = size.split('x').map(Number);
      await page.setViewportSize({ width, height });
      // The renderer takes the new size on the resize event, then the next arena frame sets the hero select lens again.
      await page.waitForFunction(([w, h]) => { const r = document.getElementById('battle').__shore3d; return r.width === w && r.height === h; }, [width, height], { polling: 100, timeout: 60000 }); await pump(3);
      h = await heroView(page);
      assert(inBox(h), `${size}: the hero stands in the portrait box: ` + JSON.stringify(h));
      const hits = await page.evaluate(() => Object.fromEntries([['card', '#hero-picks [data-hero]'], ['skill', '#hero-preview [data-hero-spell]'], ['play', '#play']].map(([k, sel]) => {
        const el = document.querySelector(sel), b = el.getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height / 2, 20));
        return [k, b.width > 0 && b.bottom <= innerHeight + 1 && !!e && (e === el || el.contains(e))];
      })));
      assert(Object.values(hits).every(Boolean), `${size}: the menu controls take the pointer: ` + JSON.stringify(hits));
      if (process.env.SHOTS) { mkdirSync(process.env.SHOTS, { recursive: true }); await page.screenshot({ path: join(process.env.SHOTS, `hero-select-3d-${size}.png`), timeout: 180000 }); }
    }
    await page.setViewportSize({ width: 1440, height: 900 }); await pump(2);
    // A hovered skill preview still explains the skill.
    await page.evaluate(() => document.querySelector('#hero-preview [data-hero-spell="2"]').dispatchEvent(new PointerEvent('pointerenter')));
    assert.equal(await page.evaluate(() => document.querySelector('#hero-preview [data-hero-spell="2"]').getAttribute('aria-pressed')), 'true');
    pass('the menu controls stay on top and work at every size', { sizes: SIZES });

    // Play opens the draft: the arena stops. The match then draws with the gameplay camera.
    await page.evaluate(() => { window.__auto = true; });
    await page.click('#play');
    await page.waitForFunction(() => !document.getElementById('draft').hidden, null, { timeout: 60000 });
    await page.evaluate(() => { window.__auto = false; });
    const draftFrames = await count(10, 34);
    assert.equal(draftFrames, 0, 'no arena frames during the draft');
    await page.evaluate(() => { window.__auto = true; });
    for (let i = 0; i < 160 && await page.evaluate(() => document.getElementById('hud').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
    await page.waitForFunction(() => !document.getElementById('hud').hidden, null, { timeout: 60000 });
    // The first match frame builds the new map, which takes SwiftShader a while.
    await page.waitForFunction(() => !document.getElementById('battle').__shore3d.showcase, null, { timeout: 240000, polling: 500 });
    const g = await page.evaluate(() => { const r = document.getElementById('battle').__shore3d; return { ...r.stats(), offset: !!r.camera.view?.enabled, near: r.camera.near }; });
    assert(!g.showcase && g.fov === 34 && g.cameraPitch === 55 && !g.offset && g.near === 150, 'the match uses the gameplay camera: ' + JSON.stringify({ showcase: g.showcase, fov: g.fov, offset: g.offset, near: g.near }));
    pass('starting the draft stops the arena; the match uses the gameplay camera', { draftFrames });
    assert.deepEqual(t.errors, [], 'no console errors'); await page.close();
  }
  {
    // Reduced motion: no sway and no flourish.
    const t = await open('?renderer=3d', { reducedMotion: 'reduce' }), { page, pump } = t;
    await arenaOn(page); await page.evaluate(() => { window.__auto = false; });
    await pump(2); const a = (await heroView(page)).camera; await pump(3, 500); const b = (await heroView(page)).camera;
    assert.deepEqual(a, b, 'with reduced motion the camera holds still');
    pass('reduced motion holds the camera still');
    assert.deepEqual(t.errors, []); await page.close();
  }
  {
    const t = await open('?renderer=2d'), { page, pump } = t;
    await pump(10);
    const look = await page.evaluate(() => ({ bg: getComputedStyle(document.getElementById('menu')).backgroundImage, art: getComputedStyle(document.getElementById('hero-art')).visibility, arena: document.getElementById('menu').classList.contains('arena-3d'), canvas: !!document.getElementById('battle-3d') }));
    assert(/shore-scene/.test(look.bg) && look.art === 'visible' && !look.arena && !look.canvas, '?renderer=2d keeps the painted stage: ' + JSON.stringify(look));
    pass('?renderer=2d keeps the painted stage and portrait');
    assert.deepEqual(t.errors, []); await page.close();
  }
  console.log(`${results.length} checks passed`);
} finally { await browser.close(); }
