// Shared helpers for Ahead of the Light's browser checks (final.md 22.1): the three sizes, a browser on SwiftShader,
// a page with its errors collected (page errors, console errors and any 4xx or 5xx), synthetic pointer events with
// exact gaps, keys timed inside the page, a scan for NaN and broken text, and a pass or fail reporter.
// Each *.e2e.mjs imports this file and runs alone: NODE_PATH=qa/browser/node_modules node qa/ahead-of-the-light/<file>
// with the site served on 8765 (BASE_URL overrides it).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) {
  console.log('FAIL Playwright is not found: run with NODE_PATH=qa/browser/node_modules');
  process.exit(1);
}
export const chromium = pw.chromium;
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '') + '/ahead-of-the-light/';
const UA = 'ahead-of-the-light-qa/1.0';

export const SIZES = {
  portrait: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  landscape: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};
// ONLY=portrait,desktop runs some sizes while you work
export const sizeList = () => (process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(SIZES));

export async function launch() {
  const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
  return chromium.launch({
    ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required'],
  });
}

// A page at one size, with its errors collected. store: localStorage keys set before the page loads.
export async function open(browser, size, query = '', { store = null, reduced = false, clear = true } = {}) {
  const ctx = await browser.newContext({ ...SIZES[size], userAgent: UA, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  // the game switcher probes a game still in the works with a HEAD request that may fail; nothing else may
  page.on('requestfailed', (r) => {
    if (r.method() !== 'HEAD' && !/analytics|posthog/.test(r.url())) errors.push(`failed ${r.url()} ${r.failure()?.errorText || ''}`);
  });
  // the arcade's analytics beacon has no server here
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: '' }));
  await page.addInitScript(({ store, clear }) => {
    try {
      if (clear && !sessionStorage.getItem('aotl-qa')) { localStorage.clear(); sessionStorage.setItem('aotl-qa', '1'); }
      if (store) for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
    } catch (e) { /* storage off */ }
  }, { store, clear });
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__race && window.__race.state && window.__race.state().frames > 2, null,
    { timeout: 60000 });
  return { ctx, page, errors, size, W: SIZES[size].viewport.width, H: SIZES[size].viewport.height };
}

// A reporter: check(name, ok, detail) prints one line; done() prints the tally and sets the exit code.
export function reporter(title) {
  let pass = 0, fail = 0;
  const failed = [];
  console.log(title);
  return {
    check(name, ok, detail = '') {
      if (ok) pass++; else { fail++; failed.push(name); }
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  (' + detail + ')' : ''}`);
      return ok;
    },
    note(text) { console.log(`       ${text}`); },
    section(text) { console.log(text); },
    done() {
      console.log(`${fail ? 'FAIL' : 'ok'}: ${pass} passed, ${fail} failed${fail ? ': ' + failed.join('; ') : ''}`);
      process.exitCode = fail ? 1 : 0;
      return fail === 0;
    },
    get failed() { return fail; },
  };
}

export const R = (page, fn, arg) => page.evaluate(fn, arg);
export const S = (page) => page.evaluate(() => window.__race.state());
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export async function waitMode(page, modes, ms = 30000) {
  const list = Array.isArray(modes) ? modes : [modes];
  await page.waitForFunction((l) => l.includes(window.__race.state().mode), list, { timeout: ms });
}

// Pointer events dispatched in one task with set gaps (dt ms before each), so the page's own timestamps are true:
// CDP touch moves arrive 80 to 100 ms apart under SwiftShader, too slow for a flick (WP7's note in contract.md).
export function synth(page, pts, id = 7) {
  return page.evaluate(({ pts, id }) => {
    const sleep = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
    for (const p of pts) {
      sleep(p.dt || 0);
      const target = document.elementFromPoint(p.x, p.y) || window;
      target.dispatchEvent(new PointerEvent(p.type, { pointerId: p.id ?? id, pointerType: p.kind || 'touch',
        clientX: p.x, clientY: p.y, bubbles: true, cancelable: true, isPrimary: (p.id ?? id) === id,
        button: p.button ?? 0, buttons: p.type === 'pointerup' ? 0 : (p.buttons ?? 1) }));
    }
  }, { pts, id });
}
// A drag from (x, y) by (dx, dy) in n moves, gap ms apart; lift: false keeps the pointer down.
export function drag(x, y, dx, dy, { n = 5, gap = 16, id = 7, lift = true, down = true, kind = 'touch' } = {}) {
  const pts = [];
  if (down) pts.push({ type: 'pointerdown', x, y, id, kind });
  for (let i = 1; i <= n; i++) pts.push({ type: 'pointermove', x: x + (dx * i) / n, y: y + (dy * i) / n, dt: gap, id, kind });
  if (lift) pts.push({ type: 'pointerup', x: x + dx, y: y + dy, dt: 10, id, kind });
  return pts;
}
// A key down, a hold of ms, a key up, timed inside the page (CDP key-ups land late under SwiftShader).
export function holdKey(page, code, ms) {
  return page.evaluate(({ code, ms }) => new Promise((done) => {
    const key = code === 'Space' ? ' ' : code.replace(/^Key/, '').toLowerCase();
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true }));
    setTimeout(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true })); done(); }, ms);
  }), { code, ms });
}

// Visible text with NaN, undefined, null or Infinity in it, and numbers in the hook's state that are not finite.
export function badText(page) {
  return page.evaluate(() => {
    const out = [];
    const hidden = (el) => { for (let e = el; e; e = e.parentElement) { if (e.hidden) return true; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return true; } return false; };
    for (const el of document.querySelectorAll('#hud, #captions, #hint, #screens')) {
      if (hidden(el)) continue;
      const t = el.innerText || '';
      const m = t.match(/\b(NaN|undefined|null|Infinity|\[object)\b/);
      if (m) out.push(`${el.id}: "${t.slice(Math.max(0, m.index - 20), m.index + 20).replace(/\s+/g, ' ')}"`);
    }
    const s = window.__race.state();
    const walk = (o, p) => {
      if (typeof o === 'number' && !Number.isFinite(o)) out.push(`state.${p} = ${o}`);
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
    };
    walk(s.you, 'you');
    walk(window.__race.survival(), 'survival');
    return out;
  });
}

// How many pixels of the overlay canvas are drawn (alpha > 0), sampled every 7th pixel.
export function overlayPixels(page) {
  return page.evaluate(() => {
    const c = document.getElementById('overlay');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 28) if (d[i] > 0) n++;
    return n;
  });
}

// The DOM layout rules of 22.1 on what is open now: tap targets 44 px or more, nothing outside the screen or the
// safe area, card and chip text inside its box, no HUD items over each other.
export function layoutFaults(page, inset = { t: 0, r: 0, b: 0, l: 0 }) {
  return page.evaluate((ins) => {
    const W = innerWidth, H = innerHeight;
    const out = { small: [], outside: [], overflow: [], overlap: [] };
    const hiddenUp = (el) => { for (let e = el; e; e = e.parentElement) { if (e.hidden) return true; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return true; } return false; };
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !hiddenUp(el); };
    const desc = (el, r) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList.length ? '.' + [...el.classList].join('.') : ''}[${(el.textContent || '').trim().slice(0, 20)}] ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    const outside = (r) => r.left < ins.l - 0.5 || r.top < ins.t - 0.5 || r.right > W - ins.r + 0.5 || r.bottom > H - ins.b + 0.5;
    // a box inside a scrolling list counts only while it is scrolled into its list
    const clipped = (el) => { const sc = el.closest('.pages, .pbuild, .scroll'); if (!sc || sc === el) return false; const a = el.getBoundingClientRect(), c = sc.getBoundingClientRect(); return a.bottom > c.bottom + 1 || a.top < c.top - 1; };
    for (const el of document.querySelectorAll('button, a, [data-act]')) {
      if (!vis(el) || el.matches('section[data-act]') || clipped(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.small.push(desc(el, r));
      if (outside(r)) out.outside.push(desc(el, r));
    }
    for (const el of document.querySelectorAll('#screens p, #screens h1, #screens h2, #screens span, #screens b, #hud p, #hint')) {
      if (!vis(el) || clipped(el)) continue;
      const r = el.getBoundingClientRect();
      if (outside(r)) out.outside.push(desc(el, r));
    }
    for (const box of document.querySelectorAll('.card, .lane, .dchip, .chip, .btn, .toggle, .ship, .tab')) {
      if (!vis(box) || clipped(box)) continue;
      const B = box.getBoundingClientRect();
      for (const el of box.querySelectorAll('span, b, small, p')) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.right > B.right + 1 || r.bottom > B.bottom + 1 || r.left < B.left - 1 || r.top < B.top - 1) out.overflow.push(desc(el, r) + ' in ' + desc(box, B));
      }
      if (box.scrollWidth > box.clientWidth + 1) out.overflow.push('wide ' + desc(box, B));
    }
    const capBox = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); return rg.getBoundingClientRect(); };
    const hud = ['speed', 'land', 'place', 'pause', 'captions'].map((id) => document.getElementById(id))
      .filter((e) => e && vis(e) && (e.textContent.trim() || e.id === 'pause'));
    const ov = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    for (let i = 0; i < hud.length; i++) for (let j = i + 1; j < hud.length; j++) {
      const a = hud[i].id === 'captions' ? capBox(hud[i]) : hud[i].getBoundingClientRect();
      const b = hud[j].id === 'captions' ? capBox(hud[j]) : hud[j].getBoundingClientRect();
      if (a.width && b.width && ov(a, b)) out.overlap.push(`${hud[i].id} × ${hud[j].id}`);
    }
    const cap = document.getElementById('captions');
    if (cap && vis(cap) && cap.textContent.trim() && outside(capBox(cap))) out.outside.push(desc(cap, capBox(cap)));
    // no two tap targets (buttons, links, lane chips, cards) cover each other, unless one holds the other
    const taps = [...document.querySelectorAll('button, a, .lane, .card')]
      .filter((el) => vis(el) && !el.matches('section[data-act]') && !clipped(el));
    for (let i = 0; i < taps.length; i++) for (let j = i + 1; j < taps.length; j++) {
      const a = taps[i], b = taps[j];
      if (a.contains(b) || b.contains(a)) continue;
      const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
      if (A.left < B.right - 2 && B.left < A.right - 2 && A.top < B.bottom - 2 && B.top < A.bottom - 2) out.overlap.push(`${desc(a, A)} × ${desc(b, B)}`);
    }
    return out;
  }, inset);
}
export const faultCount = (f) => Object.values(f).reduce((n, l) => n + l.length, 0);
export const faultText = (f) => Object.entries(f).filter(([, l]) => l.length).map(([k, l]) => `${k}: ${l.slice(0, 4).join(' | ')}`).join('; ');

// Drive a whole run with a bot through the hook: advance in chunks, take card 0 and lane 0 at each break.
// onLeg(page, s) runs once per leg after its launch. → { legs, phase, mode, s }.
export async function botRun(page, { bot = 'mid', chunk = 2, maxSteps = 3000, onLeg = null, onBreak = null, beforeEach = null } = {}) {
  await R(page, (b) => window.__race.bot(b), bot);
  let lastLeg = -1, s = await S(page), steps = 0;
  const legs = [];
  while (steps++ < maxSteps) {
    s = await S(page);
    if (s.mode === 'result' || s.mode === 'toycard' || s.mode === 'title') break;
    if (s.mode === 'play' && s.leg !== lastLeg) {
      lastLeg = s.leg;
      legs.push({ leg: s.leg, type: s.type });
      if (onLeg) await onLeg(page, s);
    }
    if (beforeEach) await beforeEach(page, s);
    if (s.mode === 'break') {
      if (onBreak) await onBreak(page, s);
      const b = await R(page, () => window.__race.run());
      if (b && b.offer && !b.offer.taken?.length && b.offer.cards?.length) await R(page, () => window.__race.pick(0));
      s = await S(page);
      if (s.mode === 'break') await R(page, () => window.__race.lane(0));
      else if (s.mode === 'chart') await R(page, () => window.__race.lane(0));
      continue;
    }
    if (s.mode === 'chart') { await R(page, () => window.__race.lane(0)); continue; }
    if (s.mode === 'play' || s.mode === 'vista' || s.mode === 'ending') {
      await R(page, (c) => window.__race.advance(c), chunk);
      continue;
    }
    await wait(50);
  }
  const run = await R(page, () => window.__race.run());
  return { legs, phase: run ? run.phase : null, mode: s.mode, s, run };
}
