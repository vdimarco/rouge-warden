// The skill buttons are easy to hit at seven screen sizes, with skill points to spend and without:
// 1. every point of each skill's visible disc reaches that skill, and no other control covers it. The "+" badges
//    cover no disc and are easy to hit themselves.
// 2. E and C, the skills nearest the middle of the screen, are at least 80 px wide on desktop and 70 px on phones. The
//    cluster stays clear of the market, the auto-status label, the minimap and the point button, and on phones it stays
//    in thumb reach of the bottom-right corner.
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
const browser = await chromium.launch({ executablePath });
// 600x500 is a small landscape window: it gets the phone cluster, and the market bar reaches close under C.
const SIZES = [[1440, 900], [1920, 1080], [3440, 1440], [844, 390], [600, 500], [390, 844], [320, 568]];
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
  return { skills, badges, clear, chat, view: { w: innerWidth, h: innerHeight } };
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
    const phone = w <= 430 || (h <= 520 && w >= 600), name = `${w}x${h}`;
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?renderer=2d');
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
        check(b.disc.r * 2 >= 34, `${at}: the ${KEYS[b.slot]} badge is ${Math.round(b.disc.r * 2)} px, under 34 px`);
        for (const s of m.skills) check(Math.hypot(b.disc.x - s.disc.x, b.disc.y - s.disc.y) >= b.disc.r + s.disc.r - .5, `${at}: the ${KEYS[b.slot]} badge covers the ${KEYS[s.slot]} disc`);
      }
      // Goal 2: E and C are large; Q is not smaller than before; the cluster keeps clear of the other controls.
      for (const s of m.skills.filter(s => s.slot === 1 || s.slot === 2)) check(s.size >= (phone ? 70 : 80), `${at}: ${KEYS[s.slot]} is ${Math.round(s.size)} px, under ${phone ? 70 : 80} px`);
      check(m.skills[0].size >= (phone ? 70 : 80), `${at}: Q is ${Math.round(m.skills[0].size)} px`);
      const parts = [...m.skills.map(s => s.hit), ...m.badges.map(b => discBox(b.disc))];
      for (const [sel, r] of Object.entries(m.clear)) check(!parts.some(p => overlap(p, r)), `${at}: the skill cluster overlaps ${sel}`);
      // Chat lines fade after a few seconds and take no presses, so an overlap with them is a note, not a failure.
      if (m.chat.some(c => m.clear['#skill-points'] && overlap(c, m.clear['#skill-points']))) console.log(`note ${at}: the point button touches a team chat line`);
      check(parts.every(p => p.x >= 0 && p.y >= 0 && p.x + p.w <= m.view.w && p.y + p.h <= m.view.h), `${at}: the skill cluster leaves the screen`);
      const reach = Math.max(...m.skills.map(s => Math.hypot(m.view.w - s.disc.x, m.view.h - s.disc.y)));
      if (phone) check(reach <= 250, `${at}: a skill centre is ${Math.round(reach)} px from the bottom-right corner, out of thumb reach`);
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
      // A press well clear of the cluster, left of C, stays with the battlefield.
      const c = m.skills[2].disc, outside = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? !!el.closest('.ability,.skill-reach') : false; }, [c.x - c.r - 30, c.y]);
      check(!outside, `${at}: a press 30 px left of C still reaches a skill`);
      check(gaps.length >= 3, `${at}: at least three gaps between neighbours were pressed (${gaps.length})`);
      row.gaps = gaps.join(' ');
    }
    check(errors.length === 0, `${name}: page errors ${errors.join('; ')}`);
    report.push(row); console.log(JSON.stringify(row));
    await page.close();
  }
} finally { await browser.close(); }
if (failures.length) { console.log(failures.map(f => 'FAIL ' + f).join('\n')); assert.fail(`${failures.length} skill target checks failed`); }
console.log('PASS: at seven sizes each skill disc reaches its skill, the badges cover no disc, E and C are large, the cluster keeps clear of other controls and gap presses reach the nearest skill.');
