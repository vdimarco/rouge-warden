// Gloam Downs' cameras in a real browser (public/lab/gloam-downs/), on software WebGL 2:
//   at 1280x720, 800x600, 390x844, 360x640 and 320x640, in each of the five places, at the start and at two waypoints of the route:
//   the camera's distance against its layout's, its field of view, how much of a 4 m ring round the lamplighter is on screen (through
//   the page's own __gloam.project), a foe 3.5 m to each side, and the figure's height; in a run on a phone, the combat camera turns to
//   a training post and stops at 20°, and the lineup's four foes, 4.5 m ahead and up to 2.55 m to the side, are all in view; and the
//   frame ratio: in one page, the draw time with stage 1's framing against the new one, drawn in turn (__gloam.layout sets the framing);
//   and the frame between steps: without ?test, main.js frame() handed a 144 Hz display's times, a steady mouse move turns the drawn
//   view by the same angle on every frame, and the first move once the mouse is taken is held to one frame's spike.
// The page runs with ?test: the game is stepped by __gloam.tick() and drawn by __gloam.draw(), because software WebGL takes about a
// second a frame. Needs the site served: python3 -m http.server 8822 --bind 127.0.0.1 --directory public
// Run: node qa/lab/gloam-downs-camera.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir> to keep pictures)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeWalk } from '../../public/lab/gloam-downs/play.js';
import { ROUTES } from '../../games/gloam-downs/lib/zones.mjs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8822').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const DIR = fileURLToPath(new URL('../../public/lab/gloam-downs/', import.meta.url));
const ORDER = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const LAYOUTS = [[1280, 720], [800, 600], [390, 844], [360, 640], [320, 640]];
const phone = ([w, h]) => w < h;
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
// the walk maps, read here for the floor under each ring point
const walks = Object.fromEntries(ORDER.map(id => {
  const meta = JSON.parse(fs.readFileSync(`${DIR}worlds/${id}.json`, 'utf8')), raw = zlib.gunzipSync(fs.readFileSync(`${DIR}worlds/${id}.walk.bin.gz`));
  return [id, makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1))];
}));
const floorAt = (walk, x, z, y) => walk.support(x, z, y + 1.6) ?? walk.top(x, z);

// without SHOTS nothing is drawn (&nodraw: a place is not drawn on load): the measures need only the page's projection
const NODRAW = SHOTS ? '' : '&nodraw';
// each page gets a browser of its own: on a loaded machine a later page's request could wait behind the earlier pages' connections
const browsers = new Set();
async function open(site, [w, h], query) {
  const browser = await chromium.launch({ executablePath, args: GL });
  browsers.add(browser);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(phone([w, h]) ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // a loaded machine can take long over the stylesheet and the fonts: wait for the page's own script instead
  await page.goto(`${site}/lab/gloam-downs/${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
  return { ctx, page, errors, close: async () => { await browser.close(); browsers.delete(browser); } };
}
const G = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { if (SHOTS) { await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const go = async (page, id) => {
  await G(page, id => window.__gloam.go(id), id);
  await page.waitForFunction(id => window.__gloam.ready() && window.__gloam.state().place === id, id, { timeout: 180000 });
  await G(page, () => window.__gloam.close());
};
/* stand at (x, z) facing (fx, fz), let the camera settle, and measure in CSS px with the page's own projection: the 4 m ring (16
   points on the floor), a foe 3.5 m to each side (feet and chest), the figure's height and the lamplighter's chest */
async function measure(page, walk, [x, z], [fx, fz], [w, h]) {
  const yaw = Math.atan2(fx - x, fz - z);
  const s = await G(page, ([x, z, yaw]) => { window.__gloam.teleport(x, z, yaw); return window.__gloam.tick(1.5, {}); }, [x, z, yaw]);
  const cy = s.cam.yaw, rt = [Math.cos(cy), -Math.sin(cy)], pts = [];
  for (let k = 0; k < 16; k++) { const px = s.x + 4 * Math.cos(k * Math.PI / 8), pz = s.z + 4 * Math.sin(k * Math.PI / 8); pts.push([px, floorAt(walk, px, pz, s.y), pz]); }
  for (const sg of [-1, 1]) { const px = s.x + rt[0] * 3.5 * sg, pz = s.z + rt[1] * 3.5 * sg, py = floorAt(walk, px, pz, s.y); pts.push([px, py, pz], [px, py + 0.9, pz]); }
  pts.push([s.x, s.y, s.z], [s.x, s.y + 1.6, s.z], [s.x, s.y + 0.9, s.z]);
  const p = await G(page, pts => pts.map(q => window.__gloam.project(q)), pts);
  const inside = q => q && q[0] >= 0 && q[0] <= w && q[1] >= 0 && q[1] <= h;
  return {
    dist: s.cam.dist, want: s.cam.want, fov: s.cam.fov, ring: p.slice(0, 16).filter(inside).length, side: p.slice(16, 20).every(inside),
    figure: p[20] && p[21] ? (p[20][1] - p[21][1]) / h : 1, chest: inside(p[22])
  };
}

try {
  /* ---------------- each layout, each place ---------------- */
  const table = [];
  for (const L of LAYOUTS) {
    const { page, errors, close } = await open(SITE, L, `?explore&fresh&test${NODRAW}`);
    await G(page, () => window.__gloam.close());
    const tag = `${L[0]}x${L[1]}`, rows = [];
    for (const id of ORDER) {
      await go(page, id);
      const r = ROUTES[id], spots = [[r[0], r[1]], [r[Math.floor(r.length / 3)], r[Math.floor(r.length / 3) + 1]], [r[Math.floor(2 * r.length / 3)], r[Math.floor(2 * r.length / 3) + 1]]];
      for (const [k, [a, b]] of spots.entries()) {
        const m = await measure(page, walks[id], [a[0], a[2]], [b[0], b[2]], L);
        rows.push({ id, k, ...m });
        assert(m.chest, `${tag} ${id} spot ${k}: the lamplighter's chest is on screen`);
        assert(m.dist >= 0.6 * m.want, `${tag} ${id} spot ${k}: the camera stands ${m.dist} back of ${m.want}`);
        assert(m.figure <= 0.45, `${tag} ${id} spot ${k}: the figure is ${m.figure} of the height`);
        if (k === 0) await shot(page, `${tag}-${id}`);
      }
    }
    // the ring and the foes to the side, over the 15 spots of the layout; a tall window keeps more of the ring (hills fall away
    // below the view in landscape, where the ring's near side is at the bottom edge on flat ground)
    const ring = rows.reduce((a, r) => a + r.ring, 0) / rows.length, side = rows.filter(r => r.side).length / rows.length;
    assert(ring >= (phone(L) ? 14 : 12), `${tag}: ${ring} of 16 ring points on screen`);
    assert(side >= (phone(L) ? 0.9 : 0.75), `${tag}: a foe 3.5 m to each side in view at ${side} of spots`);
    assert(phone(L) ? rows[0].fov > 55 * Math.PI / 180 : Math.abs(rows[0].fov - 48 * Math.PI / 180) < 1e-6, `${tag}: the field of view is ${rows[0].fov}`);
    assert.deepEqual(errors, []);
    table.push({ layout: tag, want: +rows[0].want.toFixed(2), fov: +(rows[0].fov * 180 / Math.PI).toFixed(1), ring: +ring.toFixed(1), side: +side.toFixed(2), far: +Math.min(...rows.map(r => r.dist / r.want)).toFixed(2), figure: +Math.max(...rows.map(r => r.figure)).toFixed(3) });
    await close();
  }
  pass('each layout in each place: the camera stays back, and the ground round the lamplighter is on screen', table);

  /* ---------------- a run on a phone ---------------- */
  {
    const { page, errors, close } = await open(SITE, [390, 844], `?fresh&test&run${NODRAW}`);
    if (await page.isVisible('#runHelp')) await page.tap('#bBegin');
    // a training post 5 m away, 60° to the right of the view's forward direction: the combat camera turns to it and stops at 20°
    const r = await G(page, () => {
      const g = window.__gloam, s = g.state(), y = s.cam.yaw, a = 60 * Math.PI / 180;
      const fw = [-Math.sin(y), -Math.cos(y)], rt = [Math.cos(y), -Math.sin(y)];
      const x = s.x + 5 * (fw[0] * Math.cos(a) + rt[0] * Math.sin(a)), z = s.z + 5 * (fw[1] * Math.cos(a) + rt[1] * Math.sin(a));
      g.post(x, z);
      const t = g.tick(3, {});
      const d = Math.atan2(Math.sin(Math.atan2(-(x - t.x), -(z - t.z)) - t.cam.yaw), Math.cos(Math.atan2(-(x - t.x), -(z - t.z)) - t.cam.yaw));
      return { foe: t.cam.foe, turned: Math.abs(t.cam.yaw - y), diff: d * 180 / Math.PI };
    });
    assert.equal(r.foe, 'post1', 'the combat camera has the post');
    assert(Math.abs(r.diff) <= 20.01 && Math.abs(r.diff) >= 19, `it stopped at a yaw difference of ${r.diff}°`);
    await shot(page, '390x844-run-post');
    assert.deepEqual(errors, []);
    pass('in a run on a phone the combat camera turns to a training post and stops at 20°', r);
    await close();
  }
  for (const L of [[390, 844], [320, 640]]) {
    const { page, errors, close } = await open(SITE, L, `?fresh&test&run&lineup${NODRAW}`);
    if (await page.isVisible('#runHelp')) await page.tap('#bBegin');
    const seen = await G(page, ([w, h]) => {
      const g = window.__gloam;
      g.teleport(1, 6, Math.PI);
      g.tick(1.5, {});
      const row = g.lineup({});
      return row.filter(q => 'SPMI'.includes(q.code)).map(q => [q.code, g.project([q.x, q.y + 0.9, q.z]), g.project([q.x, q.y, q.z])])
        .map(([c, a, b]) => [c, [a, b].every(p => p && p[0] >= 0 && p[0] <= w && p[1] >= 0 && p[1] <= h)]);
    }, L);
    assert(seen.length === 4 && seen.every(([, ok]) => ok), `${L.join('x')}: the lineup's foes in view: ${JSON.stringify(seen)}`);
    await shot(page, `${L.join('x')}-lineup`);
    assert.deepEqual(errors, []);
    pass(`${L.join('x')}: the four foes of the lineup, 4.5 m ahead and up to 2.55 m to the side, are all in view`);
    await close();
  }

  /* ---------------- the frame ratio ----------------
     In one page, so the load of the machine falls on both alike: the draw time with stage 1's framing (a 38° vertical field of view,
     8.5 m or 12.75 m back, pitch 0.34, aim 1.15 over the feet) against this window's framing, drawn in turn at the Gaol's start
     facing two ways. The art size does not depend on the camera */
  {
    const OLD = { fov: 38 * Math.PI / 180, pitch: 0.34, aim: 1.15 }, out = {};
    for (const L of [[1280, 720], [390, 844]]) {
      const { page, errors, close } = await open(SITE, L, '?explore&fresh&test&nodraw');
      const r = await G(page, ([old, w, h]) => {
        const g = window.__gloam, sp = g.points().spawn.p, ts = { old: [], now: [] };
        g.close();
        const time = () => { const t0 = performance.now(); g.draw(); document.getElementById('view').getContext('webgl2').finish(); return performance.now() - t0; };
        for (const yaw of [Math.PI, Math.PI / 2]) {
          g.teleport(sp[0], sp[2], yaw); g.tick(0.5, {});
          for (let k = 0; k < 5; k++) {
            g.layout(old); g.tick(0.05, {}); time(); ts.old.push(time());
            g.layout({ w, h }); g.tick(0.05, {}); time(); ts.now.push(time());
          }
        }
        const med = a => a.sort((x, y) => x - y)[a.length >> 1];
        return { art: g.state().art, old: med(ts.old), now: med(ts.now) };
      }, [{ ...OLD, dist: L[0] < L[1] ? 12.75 : 8.5 }, ...L]);
      const ratio = r.now / r.old;
      assert(ratio <= 1.15, `${L.join('x')}: the new framing draws in ${ratio.toFixed(2)} of the old one's time`);
      assert.deepEqual(errors, []);
      out[L.join('x')] = { art: r.art, old: +r.old.toFixed(1), now: +r.now.toFixed(1), ratio: +ratio.toFixed(2) };
      await close();
    }
    pass('the new framing draws no slower than stage 1\'s (in one page, in turn), at the same art size', out);
  }
  { /* the frame between steps (design.md "Smooth camera"): the page without ?test, its requestAnimationFrame stubbed so the test hands
       main.js frame() the times of a 144 Hz display, and the mouse moved 4 px before each frame. Each frame draws (state().frames) and
       turns the drawn view (state().cam.drawn) by the same 0.504°. Before (a8b46709): 0, 1.008, 0, 0, 1.513, 0, 1.008 ... a frame, the
       turn waiting for a fixed step */
    const browser = await chromium.launch({ executablePath, args: GL });
    browsers.add(browser);
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.__raf = [];
      window.requestAnimationFrame = cb => { window.__raf.push(cb); return window.__raf.length; };
      window.__pump = now => { const q = window.__raf.splice(0); for (const cb of q) cb(now); return q.length; };
    });
    await page.goto(`${SITE}/lab/gloam-downs/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    // (the frames are the test's to hand out, also while the place loads)
    const hz = 144;
    let t = 1000;
    for (let i = 0; i < 360 && !(await G(page, () => !!window.__gloam?.ready?.())); i++) { t += 1000 / hz; await G(page, n => window.__pump(n), t); await page.waitForTimeout(500); }
    await G(page, () => window.__gloam.close());
    for (let i = 0; i < 4; i++) { t += 1000 / hz; await G(page, n => window.__pump(n), t); }
    await page.mouse.move(320, 180);
    await page.mouse.down({ button: 'right' });
    const turns = [], drew = [];
    let x = 320, prev = await G(page, () => window.__gloam.state().cam.drawn.yaw);
    for (let f = 0; f < 24; f++) {
      x += 4; await page.mouse.move(x, 180);
      t += 1000 / hz;
      const r = await G(page, n => { const f0 = window.__gloam.state().frames; window.__pump(n); const s = window.__gloam.state(); return { yaw: s.cam.drawn.yaw, drew: s.frames - f0 }; }, t);
      turns.push(Math.abs(r.yaw - prev)); drew.push(r.drew);
      prev = r.yaw;
    }
    await page.mouse.up({ button: 'right' });
    const lo = Math.min(...turns), hi = Math.max(...turns);
    assert(drew.every(d => d === 1), `frames drawn: ${drew.join('')}`);
    assert(lo > 0 && hi / lo <= 1.3, `at 144 Hz a frame turned the drawn view by ${(lo * 180 / Math.PI).toFixed(3)} to ${(hi * 180 / Math.PI).toFixed(3)}°`);
    assert.deepEqual(errors, []);
    pass('at 144 Hz a steady mouse move turns the drawn view by the same angle on every frame', { deg: +(turns[0] * 180 / Math.PI).toFixed(3), ratio: +(hi / lo).toFixed(3), frames: turns.length });
    await browser.close(); browsers.delete(browser);
  }
  { /* the first move once the mouse is taken (input.js): a run's Begin takes the mouse for real, 50 ms pass, and Chrome's first locked
       move is a spike of 5000 px (dispatched by the test). It turns the view by one frame's cap, 120 px, 0.264 rad. (The case this
       guards, a free cursor move under 0.1 s before the first locked one, which before counted as the time since the last move and let
       up to 480 px through, does not come here: the lock takes about 250 ms in headless Chrome. This checks the cap on that first move
       holds; it passed before too) */
    const browser = await chromium.launch({ executablePath, args: GL });
    browsers.add(browser);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${SITE}/lab/gloam-downs/?run&test&fresh&seed=7`);
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
    await page.mouse.move(600, 500);
    await page.click('#bBegin');
    await page.waitForTimeout(250);
    assert(await G(page, () => document.pointerLockElement?.id === 'view' && window.__gloam.state().mouse.locked), 'Begin takes the mouse');
    await G(page, () => window.__gloam.tick(0.1, 'live'));
    await page.waitForTimeout(50);
    const yaw0 = await G(page, () => window.__gloam.state().cam.yaw);
    await G(page, () => document.getElementById('view').dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', movementX: 5000, bubbles: true })));
    await G(page, () => window.__gloam.tick(0.05, 'live'));
    const spun = Math.abs(await G(page, () => window.__gloam.state().cam.yaw) - yaw0);
    assert(spun > 0.2 && spun <= 120 * 0.0022 + 1e-6, `the first locked move turned the view by ${spun.toFixed(3)} rad`);
    assert.deepEqual(errors, []);
    pass('the first move once the mouse is taken is held to one frame\'s spike', { rad: +spun.toFixed(4), cap: +(120 * 0.0022).toFixed(4) });
    await browser.close(); browsers.delete(browser);
  }
} finally {
  for (const b of browsers) await b.close();
}
console.log(`\n${n} passed`);
