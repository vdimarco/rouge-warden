// Light Years Home v3: shared helpers for the browser checks (final.md 19). Each *.e2e.mjs file runs alone:
//   NODE_PATH=qa/browser/node_modules node qa/light-years-home/v3/<name>.e2e.mjs [desk|por|land ...]
// It needs the site served (python3 -m http.server 8765 --bind 0.0.0.0 --directory public; BASE_URL overrides) and
// prints one line per check. Chromium runs with SwiftShader, so frame times only compare runs; where a check is about
// wall time, a software GPU gets a wider limit and the line says so.
import { createRequire } from 'module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
export const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '') + '/light-years-home/';
export const SIZES = {
  desk: { name: '1440 × 900 (keys, mouse, a mocked pad)', viewport: { width: 1440, height: 900 } },
  por: { name: '390 × 844 (touch)', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  land: { name: '844 × 390 (touch)', viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
};
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const ORANGE = [240, 138, 44];

const results = [];
export function check(name, ok, detail = '') {
  results.push(!!ok);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`);
  return !!ok;
}
export function note(text) { console.log(`  note ${text}`); }
export function summary() {
  const failed = results.filter((x) => !x).length;
  console.log(failed ? `${failed} of ${results.length} checks failed` : `all ${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
}

// The sizes to run: the command line's names, else all three.
export function sizesFromArgs() {
  const asked = process.argv.slice(2).filter((a) => SIZES[a]);
  return asked.length ? asked : ['desk', 'por', 'land'];
}

export async function launch() {
  try {
    const res = await fetch(BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error(`FAIL cannot load ${BASE} (${e.message}). Start the server: python3 -m http.server 8765 --bind 0.0.0.0 --directory public`);
    process.exit(2);
  }
  const exe = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
}

// A page at one size, with every page error, console error and failed request collected. opts.query is added to the
// URL; opts.store fills localStorage first; opts.pad mocks navigator.getGamepads with window.__pad.
export async function open(browser, size, { query = '', store = null, pad = false } = {}) {
  const ctx = await browser.newContext({ ...SIZES[size], deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  if (store) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, store);
  if (pad) {
    await page.addInitScript(() => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      window.__pad = { id: 'mock pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons,
        timestamp: 0 };
      navigator.getGamepads = () => [window.__pad, null, null, null];
    });
  }
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__lyh && window.__lyh.ready, null, { timeout: 120000 });
  const software = await page.evaluate(() => document.getElementById('view').dataset.backend === 'software');
  return { ctx, page, errors, software };
}

// Wait until the core has run `seconds` of its own time (a slow software GPU runs fewer core steps per wall second).
export async function waitGame(page, seconds, maxMs = 20000) {
  const t0 = await page.evaluate(() => window.__lyh.state().t);
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await wait(40);
    const t = await page.evaluate(() => window.__lyh.state().t);
    if (t >= t0 + seconds) return t - t0;
  }
  return null;
}

// Click or tap PLAY (the title's main button).
export async function play(page, size) {
  if (SIZES[size].hasTouch) await page.tap('.m-title button.primary');
  else await page.click('.m-title button.primary');
}

// The hook, called in the page: hook(page, 'mode') or hook(page, 'step', input, seconds).
export const hook = (page, name, ...args) => page.evaluate(([n, a]) => {
  const h = window.__lyh;
  const v = h[n];
  return typeof v === 'function' ? v(...a) : v;
}, [name, args]);

// Step the core by hand in chunks until pred(event) holds for an event; returns the event or null.
export async function stepUntil(page, pred, { max = 60, chunk = 0.25, input = null } = {}) {
  const src = pred.toString();
  return page.evaluate(([src, max, chunk, input]) => {
    const fn = (0, eval)(`(${src})`);
    for (let t = 0; t < max; t += chunk) {
      const ev = window.__lyh.step(input, chunk);
      const hit = ev.find((e) => fn(e, window.__lyh));
      if (hit) return hit;
    }
    return null;
  }, [src, max, chunk, input]);
}

// Touches through the DevTools protocol: start(id, x, y), move(id, x, y), end(id). Several fingers at once.
export async function touches(page) {
  const cdp = await page.context().newCDPSession(page);
  const live = new Map();
  const points = () => [...live.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id }));
  return {
    async start(id, x, y) { live.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points() }); },
    async move(id, x, y) { live.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points() }); },
    // touchEnd lifts the points it is given: send only the finger that lifts (sending the ones still down lifted
    // them instead).
    async end(id) {
      const p = live.get(id);
      live.delete(id);
      if (!p) return;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p.x, y: p.y, id }] });
    },
    // A quick swipe with its own event times (a slow software GPU delivers touches late, which would hide the
    // speed): the moves are stamped dt s apart.
    async swipe(id, x0, y0, x1, y1, steps = 3, dt = 0.02) {
      const t0 = Date.now() / 1000;
      live.set(id, { x: x0, y: y0 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(), timestamp: t0 });
      for (let i = 1; i <= steps; i++) {
        live.set(id, { x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(), timestamp: t0 + dt * i });
      }
    },
    // A tap with its own event times (50 ms down), so a slow frame never turns it into a hold.
    async tap(id, x, y) {
      const t0 = Date.now() / 1000;
      live.set(id, { x, y });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(), timestamp: t0 });
      live.delete(id);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x, y, id }], timestamp: t0 + 0.05 });
    },
    async drag(id, x0, y0, x1, y1, ms = 120, steps = 6) {
      await this.start(id, x0, y0);
      for (let i = 1; i <= steps; i++) {
        await wait(ms / steps);
        await this.move(id, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      }
    },
  };
}

// The middle of a layout rectangle.
export const mid = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];

// Rectangles overlap (with a half-pixel slack).
export const hits = (a, b) => a[0] < b[0] + b[2] - 0.5 && b[0] < a[0] + a[2] - 0.5 && a[1] < b[1] + b[3] - 0.5
  && b[1] < a[1] + a[3] - 0.5;

// HUD checks every size shares: DOM boxes on their layout rectangles within 2 px, nothing overlapping another box or
// the ship (bar the shared slots and the drift pips over the ship), captions out of the bottom third.
export async function hudChecks(page, label) {
  const L = await hook(page, 'layout');
  const shares = await page.evaluate(() => {
    const k = window.__lyh.layout().kind;
    return k === 'landscape' ? [['hint', 'info']] : [];
  });
  const allow = new Set(shares.map((p) => p.slice().sort().join('|')));
  const names = Object.keys(L.dom);
  const off = names.filter((n) => L.rects[n] && L.dom[n].some((v, k) => Math.abs(v - L.rects[n][k]) > 2));
  check(`${label}: DOM HUD boxes sit on core/layout.js rectangles within 2 px`, off.length === 0,
    off.length ? off.map((n) => `${n} ${L.dom[n]} vs ${L.rects[n]}`).join('; ') : `${names.length} boxes`);
  const bad = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const key = [names[i], names[j]].sort().join('|');
      if (!allow.has(key) && hits(L.dom[names[i]], L.dom[names[j]])) bad.push(key);
    }
    if (L.rects.ship && names[i] !== 'pips' && hits(L.dom[names[i]], L.rects.ship)) bad.push(`${names[i]}|ship`);
  }
  check(`${label}: no HUD box overlaps another or the ship`, bad.length === 0, bad.join(', '));
  const vh = await page.evaluate(() => innerHeight);
  if (L.dom.captions) {
    check(`${label}: captions sit above the bottom third`, L.dom.captions[1] + L.dom.captions[3] <= (2 / 3) * vh,
      `bottom ${L.dom.captions[1] + L.dom.captions[3]} of ${vh}`);
  }
  const wide = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  check(`${label}: the page never scrolls sideways`, wide <= 0, `${wide} px extra`);
}

export function errorCheck(errors, label) {
  const real = errors.filter((e) => !/\/wild\/|KHR_parallel_shader_compile/.test(e));
  check(`${label}: no page errors, console errors or failed requests`, real.length === 0, real.slice(0, 4).join(' | '));
}
