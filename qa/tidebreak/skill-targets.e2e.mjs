// The skill buttons are easy to hit at eleven screen sizes, with skill points to spend and without:
// 1. every point of each skill's visible disc reaches that skill, and no other control covers it. The "+" badges
//    cover no disc and are easy to hit themselves.
// 2. the command bar shows at every size, with the four skills in a row. Skills are at least 64 px with a mouse on a large screen
//    and 48 px elsewhere; the "+" badges are at least 24 px with a mouse and 34 px on touch screens. The skills stay
//    clear of the market, the auto-status label, the minimap and the point button. On phones R is within 150 px of the
//    bottom-right corner and every skill within 300 px, so the right thumb reaches them.
// 3. a press in the gap between two skills, inside the cluster, goes to the nearest skill (the nearest disc edge).
// Real presses check 1 and 3: in upgrade mode a press on a skill spends a point on it, so the rank shows which skill took
// the press. Mouse on desktop, touch on phones.
// Needs the static server (see AGENTS.md): NODE_PATH=qa/browser/node_modules node qa/tidebreak/skill-targets.e2e.mjs
// SHOTS=<folder> saves a picture of the cluster at each size.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/';
const SHOTS = process.env.SHOTS;
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// 600x500 is a small landscape window: it gets the phone cluster, and the market bar reaches close under C.
// 640x360 and 568x320 are small phones on their side: a smaller minimap, and the point button is a pill beside it.
// 1040x640 is the smallest window with the desktop command bar.
// 768x1024 is an upright tablet window: the stacked bar with a mouse.
const SIZES = [[1040, 640], [768, 1024], [1440, 900], [1920, 1080], [3440, 1440], [844, 390], [600, 500], [640, 360], [568, 320], [390, 844], [320, 568]];
const KEYS = ['Q', 'E', 'C', 'R'], CLEAR = ['#skill-points', '#auto-status', '#map-button', '#shop', '#quick-buy', '#loadout', '#inventory', '.inventory-slot', '.health', '#joystick', '#rally'];
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// Sets the player up in the page: 'points' shows all four "+" badges, 'none' has every skill learned and ready.
const setup = mode => `(async () => {
  const s = (await import('/tidebreak/main.js')).qaState(), p = s.units.find(u => u.id === s.playerId), c = document.querySelector('.abilities');
  p.hp = p.maxHp; p.mana = p.maxMana; p.cd = [0, 0, 0, 0]; p.level = 6; p.queuedCast = null; p.castIntent = null; p.recoveryUntil = 0;
  if (${JSON.stringify(mode)} === 'none') { p.skillRanks = [1, 1, 1, 1]; p.skillPoints = 0; c.classList.remove('upgrade-mode'); }
  else { p.skillRanks = [0, 0, 0, 0]; p.skillPoints = 9; if (${JSON.stringify(mode)} === 'press') c.classList.add('upgrade-mode'); }
})()`;
const ranks = `(async () => { const s = (await import('/tidebreak/main.js')).qaState(); return [...s.units.find(u => u.id === s.playerId).skillRanks]; })()`;

// Reads the layout: each skill's hit box and visible disc, the badges, the controls the cluster must keep clear of,
// and who owns each point of each disc and badge.
const MEASURE = clearList => {
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const shown = el => { if (!el) return false; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const label = el => el ? (el.id ? '#' + el.id : el.dataset?.skill ? 'skill ' + el.dataset.skill : el.dataset?.upgrade ? 'badge ' + el.dataset.upgrade : String(el.className || el.tagName).slice(0, 30)) : 'none';
  const owner = (x, y) => { let el = document.elementFromPoint(x, y); while (el && !el.dataset?.skill && !el.dataset?.upgrade && !el.id && el !== document.body) el = el.parentElement; return el; };
  const share = (disc, test) => { let own = 0, total = 0; const others = {}; for (let i = 0; i < 25; i++) for (let j = 0; j < 25; j++) { const x = disc.x - disc.r + (i + .5) * disc.r * 2 / 25, y = disc.y - disc.r + (j + .5) * disc.r * 2 / 25; if (Math.hypot(x - disc.x, y - disc.y) > disc.r - .5) continue; total++; const el = owner(x, y); if (test(el)) own++; else { const k = label(el); others[k] = (others[k] || 0) + 1; } } return { own: own / total, others }; };
  const skills = [...document.querySelectorAll('button.ability[data-skill]')].map(b => {
    const hit = box(b), art = b.querySelector('.hud-atlas-crop') || b, v = box(art);
    const disc = { x: v.x + v.w / 2, y: v.y + v.h / 2, r: Math.min(v.w, v.h) / 2 };
    return { slot: +b.dataset.skill, hit, disc, size: Math.min(hit.w, hit.h), share: share(disc, el => el === b) };
  });
  const badges = [...document.querySelectorAll('.ability-upgrade')].filter(shown).map(b => { const r = box(b), disc = { x: r.x + r.w / 2, y: r.y + r.h / 2, r: Math.min(r.w, r.h) / 2 }; return { slot: +b.dataset.upgrade, disc, share: share(disc, el => el === b) }; });
  const clear = Object.fromEntries(clearList.flatMap(s => [...document.querySelectorAll(s)].filter(shown).map((el, i) => [i ? `${s} ${i + 1}` : s, box(el)])));
  const chat = [...document.querySelectorAll('#team-chat li')].filter(shown).map(box);
  const extra = Object.fromEntries(['#map-button', '#objective-clock', '#objective', '#joystick'].map(s => document.querySelector(s)).filter(shown).map(el => ['#' + el.id, box(el)]));
  const bar = getComputedStyle(document.getElementById('hud'), '::before').content !== 'none';
  return { skills, badges, clear, chat, extra, bar, view: { w: innerWidth, h: innerHeight } };
};

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const discBox = d => ({ x: d.x - d.r, y: d.y - d.r, w: d.r * 2, h: d.r * 2 });
// The skill a press at (x, y) should reach: the one with the nearest disc edge.
const nearest = (skills, x, y) => skills.reduce((best, s) => { const d = Math.hypot(x - s.disc.x, y - s.disc.y) - s.disc.r; return d < best.d ? { s, d } : best; }, { d: Infinity }).s;

async function press(page, touch, x, y) {
  await page.evaluate(setup('press'));
  await page.waitForFunction(() => [...document.querySelectorAll('button.ability[data-skill]')].every(b => b.getAttribute('aria-disabled') === 'false'), null, { timeout: 30000 });
  if (touch) await page.touchscreen.tap(x, y); else { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); }
  await page.waitForTimeout(40);
  const r = await page.evaluate(ranks), hit = r.findIndex(v => v > 0);
  return r.filter(v => v > 0).length === 1 ? hit : r.some(v => v > 0) ? 'several' : 'none';
}

const report = [];
try {
  for (const [w, h] of SIZES) {
    const phone = w <= 430 || h <= 520, name = `${w}x${h}`;
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL);
    await page.waitForFunction(() => !document.getElementById('play')?.disabled, null, { timeout: 90000 });
    await page.evaluate(() => document.getElementById('play').click());
    for (let i = 0; i < 150 && await page.evaluate(() => document.getElementById('hud').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
    await page.waitForFunction(async () => (await import('/tidebreak/main.js')).snapshot().running, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    if (await page.evaluate(() => document.getElementById('sheet').open)) await page.keyboard.press('Escape');
    await page.evaluate(() => { const c = document.getElementById('coach'); if (c) c.hidden = true; });
    const row = { size: name };
    for (const mode of ['points', 'none']) {
      await page.evaluate(setup(mode));
      // The HUD redraws on a game timer; a slow software frame can take a while.
      await page.waitForFunction(want => [...document.querySelectorAll('.ability-upgrade')].filter(b => !b.hidden).length === want && [...document.querySelectorAll('button.ability[data-skill]')].every(b => b.getAttribute('aria-disabled') === String(want === 4)), mode === 'points' ? 4 : 0, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(200);
      const m = await page.evaluate(MEASURE, CLEAR), at = `${name} ${mode}`;
      if (SHOTS) { const xs = m.skills.flatMap(s => [s.hit.x, s.hit.x + s.hit.w]).concat(m.clear['#skill-points'] ? [m.clear['#skill-points'].x] : []), ys = m.skills.flatMap(s => [s.hit.y, s.hit.y + s.hit.h]).concat(m.clear['#skill-points'] ? [m.clear['#skill-points'].y] : []); const x = Math.max(0, Math.min(...xs) - 40), y = Math.max(0, Math.min(...ys) - 40); await page.screenshot({ path: `${SHOTS}/cluster-${name}-${mode}.png`, clip: { x, y, width: Math.min(w, Math.max(...xs) + 40) - x, height: Math.min(h, Math.max(...ys) + 40) - y } }); }
      // Goal 1: the whole visible disc reaches its own skill, and the badges cover no disc.
      for (const s of m.skills) check(s.share.own === 1, `${at}: only ${Math.round(s.share.own * 100)}% of ${KEYS[s.slot]}'s disc reaches it (${JSON.stringify(s.share.others)})`);
      if (mode === 'points') check(m.badges.length === 4, `${at}: all four "+" badges show (${m.badges.length})`);
      for (const b of m.badges) {
        check(b.share.own === 1, `${at}: only ${Math.round(b.share.own * 100)}% of the ${KEYS[b.slot]} badge reaches it (${JSON.stringify(b.share.others)})`);
        const least = phone ? 34 : 24;
        check(b.disc.r * 2 >= least, `${at}: the ${KEYS[b.slot]} badge is ${Math.round(b.disc.r * 2)} px, under ${least} px`);
        for (const s of m.skills) check(Math.hypot(b.disc.x - s.disc.x, b.disc.y - s.disc.y) >= b.disc.r + s.disc.r - .5, `${at}: the ${KEYS[b.slot]} badge covers the ${KEYS[s.slot]} disc`);
      }
      // Goal 2: E and C are large; Q is not smaller than before; the cluster keeps clear of the other controls.
      const big = w >= 1040 && h >= 600 && !phone ? 64 : 48;
      check(m.bar, `${at}: the command bar is missing`);
      for (const s of m.skills.filter(s => s.slot === 1 || s.slot === 2)) check(s.size >= big, `${at}: ${KEYS[s.slot]} is ${Math.round(s.size)} px, under ${big} px`);
      check(m.skills[0].size >= big, `${at}: Q is ${Math.round(m.skills[0].size)} px`);
      const parts = [...m.skills.map(s => s.hit), ...m.badges.map(b => discBox(b.disc))];
      for (const [sel, r] of Object.entries(m.clear)) check(!parts.some(p => overlap(p, r)), `${at}: the skill cluster overlaps ${sel}`);
      // The point button covers neither the minimap nor the objective timers.
      for (const sel of ['#map-button', '#objective-clock']) if (m.clear['#skill-points'] && m.extra[sel]) check(!overlap(m.clear['#skill-points'], m.extra[sel]), `${at}: the point button overlaps ${sel}`);
      // The objective text ends above the movement pad.
      if (m.extra['#objective'] && m.extra['#joystick']) check(!overlap(m.extra['#objective'], m.extra['#joystick']), `${at}: the objective text overlaps the movement pad`);
      // Chat lines fade after a few seconds and take no presses, so an overlap with them is a note, not a failure.
      if (m.chat.some(c => m.clear['#skill-points'] && overlap(c, m.clear['#skill-points']))) console.log(`note ${at}: the point button touches a team chat line`);
      check(parts.every(p => p.x >= 0 && p.y >= 0 && p.x + p.w <= m.view.w && p.y + p.h <= m.view.h), `${at}: the skill cluster leaves the screen`);
      const reach = Math.max(...m.skills.map(s => Math.hypot(m.view.w - s.disc.x, m.view.h - s.disc.y)));
      if (phone) {
        const ult = m.skills.find(s => s.slot === 3).disc;
        check(reach <= 300, `${at}: a skill centre is ${Math.round(reach)} px from the bottom-right corner, out of thumb reach`);
        check(Math.hypot(m.view.w - ult.x, m.view.h - ult.y) <= 150, `${at}: R is not next to the bottom-right corner`);
      }
      row[mode] = { sizes: m.skills.map(s => Math.round(s.size)).join('/'), discs: m.skills.map(s => Math.round(s.share.own * 100)).join('/'), badges: m.badges.map(b => Math.round(b.disc.r * 2)).join('/'), reach: Math.round(reach) };
      if (mode !== 'points') continue;
      // Goal 1 with real presses: the centre and four points near the rim of each disc.
      for (const s of m.skills) for (const [dx, dy] of [[0, 0], [.9, 0], [-.9, 0], [0, .9], [0, -.9]]) {
        const got = await press(page, phone, s.disc.x + dx * s.disc.r, s.disc.y + dy * s.disc.r);
        check(got === s.slot, `${at}: a press on ${KEYS[s.slot]} at (${dx}, ${dy}) went to ${KEYS[got] || got}`);
      }
      // Goal 3: presses in the gap between two neighbouring skills go to the nearer one.
      const gaps = [];
      for (const a of m.skills) for (const b of m.skills) {
        if (a.slot >= b.slot) continue;
        const d = Math.hypot(b.disc.x - a.disc.x, b.disc.y - a.disc.y), gap = d - a.disc.r - b.disc.r;
        if (gap > 40) continue;
        for (const f of [.3, .7]) {
          const t = (a.disc.r + gap * f) / d, x = a.disc.x + (b.disc.x - a.disc.x) * t, y = a.disc.y + (b.disc.y - a.disc.y) * t, want = nearest(m.skills, x, y);
          if (gap < 3 || (want !== a && want !== b)) continue;
          const got = await press(page, phone, x, y);
          gaps.push(`${KEYS[a.slot]}${KEYS[b.slot]}${f}:${KEYS[got] || got}`);
          check(got === want.slot, `${at}: a press in the ${KEYS[a.slot]}-${KEYS[b.slot]} gap (${Math.round(gap)} px) at ${f} went to ${KEYS[got] || got}, not ${KEYS[want.slot]}`);
        }
      }
      // The middle of the cluster, between all four skills, also reaches the nearest one.
      const mid = { x: m.skills.reduce((t, s) => t + s.disc.x, 0) / 4, y: m.skills.reduce((t, s) => t + s.disc.y, 0) / 4 }, midWant = nearest(m.skills, mid.x, mid.y), midGot = await press(page, phone, mid.x, mid.y);
      gaps.push(`mid:${KEYS[midGot] || midGot}`);
      check(midGot === midWant.slot, `${at}: a press in the middle of the cluster went to ${KEYS[midGot] || midGot}, not ${KEYS[midWant.slot]}`);
      // A press well clear of the row, below C, stays off the skills.
      const c = m.skills[2].disc, away = [c.x, c.y + c.r + 30], outside = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? !!el.closest('.ability,.skill-reach') : false; }, away);
      check(!outside, `${at}: a press 30 px below C still reaches a skill`);
      check(gaps.length >= 3, `${at}: at least three gaps between neighbours were pressed (${gaps.length})`);
      row.gaps = gaps.join(' ');
    }
    // Feeds: with three team chat lines and three kill feed lines, no shown line covers a skill, a badge or another HUD
    // part, and every shown line stays on the screen. The rally button keeps clear of the market button.
    const feeds = await page.evaluate(() => {
      const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
      const shown = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
      const line = (cls, html) => { const li = document.createElement('li'); li.className = cls; li.dataset.time = 1e9; li.innerHTML = html; return li; };
      document.getElementById('team-chat').replaceChildren(...[0, 1, 2].map(i => line('team', `<span><b>moonweaver (Salt Priestess):</b> Ready. Ping and I come, line ${i}.</span>`)));
      document.getElementById('kill-feed').replaceChildren(...[0, 1, 2].map(() => line('ally', '<b>Tidewarden</b><span>⚔</span><b>Voidcaller</b>')));
      const lines = [...document.querySelectorAll('#team-chat li, #kill-feed li')].filter(shown).map(el => ({ id: el.parentElement.id, ...box(el) }));
      const parts = ['button.ability[data-skill]', '.ability-upgrade', '#skill-points', '#map-button', '#objective', '#objective-clock', '#difficulty-badge', '#joystick', '#rally', '#shop', '#lineup'].flatMap(sel => [...document.querySelectorAll(sel)].filter(shown).map(el => ({ sel, ...box(el) })));
      const one = sel => { const el = document.querySelector(sel); return el && shown(el) ? box(el) : null; };
      return { lines, parts, rally: one('#rally'), shop: one('#shop'), view: { w: innerWidth, h: innerHeight } };
    });
    check(feeds.lines.some(l => l.id === 'team-chat') && feeds.lines.some(l => l.id === 'kill-feed'), `${name}: a team chat line and a kill feed line show`);
    for (const l of feeds.lines) {
      check(l.x >= 0 && l.y >= 0 && l.x + l.w <= feeds.view.w && l.y + l.h <= feeds.view.h, `${name}: a ${l.id} line leaves the screen`);
      for (const p of feeds.parts) check(!overlap(l, p), `${name}: a ${l.id} line covers ${p.sel}`);
    }
    if (feeds.rally && feeds.shop) check(!overlap(feeds.rally, feeds.shop), `${name}: the rally button covers the market button`);
    check(errors.length === 0, `${name}: page errors ${errors.join('; ')}`);
    report.push(row); console.log(JSON.stringify(row));
    await page.close();
  }
} finally { await browser.close(); }
if (failures.length) { console.log(failures.map(f => 'FAIL ' + f).join('\n')); assert.fail(`${failures.length} skill target checks failed`); }
console.log('PASS: at eleven sizes each skill disc reaches its skill, the badges cover no disc, the command bar shows with large skills that keep clear of other controls, gap presses reach the nearest skill, and the team chat and kill feed cover no HUD part.');
