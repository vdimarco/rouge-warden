// Measure the page's controls at five layouts without WebGL (no world loads): unhide the HUD, tools and Jump, show a toast, and read
// their boxes. Then lay a proposed set of combat buttons and bars over the page (injected CSS, in the browser only) and check that
// each is 44 px or more, inside the screen, and clear of the Lab bar, the HUD, the tools and each other.
// A design tool from the combat run's design rounds, not a check: it drew the touch buttons' sizes in design.md. Pictures go to SHOTS
// (default the system temp folder), and OUT=<file> keeps the boxes as JSON. Needs the site served (SITE_URL).
// Run: node games/gloam-downs/tools/layout.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../../../qa/browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SHOTS = (process.env.SHOTS || path.join(os.tmpdir(), 'gloam-layout')) + '/';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--disable-webgl', '--disable-3d-apis'] });
const LAYOUTS = [[320, 640, true], [360, 640, true], [390, 844, true], [800, 600, false], [1280, 720, false], [800, 600, true]];
// the proposal: right-thumb cluster (Attack biggest, Roll, Jump, Heal), health and flasks in the HUD column, boss bar at the bottom
const CSS = `
  .cx { position: fixed; z-index: 8; box-sizing: border-box; border-radius: 50%; display: grid; place-items: center; font: 800 13px/1 sans-serif; color: #ffd9a8; background: rgba(60,20,12,.72); border: 2px solid #d2551c; }
  #xAtk  { width: 84px; height: 84px; right: calc(16px + env(safe-area-inset-right,0px)); bottom: calc(var(--sab) + 96px); }
  #xRoll { width: 64px; height: 64px; right: calc(112px + env(safe-area-inset-right,0px)); bottom: calc(var(--sab) + 30px); }
  #bJump { width: 72px !important; height: 72px !important; right: calc(16px + env(safe-area-inset-right,0px)) !important; bottom: calc(var(--sab) + 16px) !important; }
  #xHeal { width: 52px; height: 52px; right: calc(112px + env(safe-area-inset-right,0px)); bottom: calc(var(--sab) + 110px); }
  .hpbar { position: fixed; left: 10px; width: min(200px, calc(100vw - 150px)); height: 14px; z-index: 6; background: #140c0c; border: 1px solid #5a3424; }
  .boss { position: fixed; left: 50%; transform: translateX(-50%); width: min(520px, calc(100vw - 32px)); height: 30px; z-index: 6; background: rgba(8,8,14,.88); border: 1px solid #5a3424; }
  /* short windows: the cluster goes lower and tighter */
  @media (max-height: 660px) {
    #xAtk { width: 76px; height: 76px; bottom: calc(var(--sab) + 84px); }
    #xRoll { right: calc(100px + env(safe-area-inset-right,0px)); bottom: calc(var(--sab) + 18px); width: 60px; height: 60px; }
    #bJump { width: 64px !important; height: 64px !important; bottom: calc(var(--sab) + 12px) !important; }
    #xHeal { right: calc(104px + env(safe-area-inset-right,0px)); bottom: calc(var(--sab) + 94px); width: 48px; height: 48px; }
  }
`;
const rows = [];
for (const [w, h, touch] of LAYOUTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  const p = await ctx.newPage();
  await p.goto(`${SITE}/lab/gloam-downs/?fresh&test`);
  await p.waitForFunction(() => /WebGL 2/.test(document.getElementById('loadLine').textContent), null, { timeout: 30000 });
  const box = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }, sel);
  // the page as it plays: loading gone, HUD, tools and (touch) Jump shown, a toast up, the hint as in the Gaol
  await p.evaluate(touch => {
    document.getElementById('loading').classList.add('done');
    document.getElementById('hud').hidden = false; document.getElementById('tools').hidden = false; document.getElementById('bJump').hidden = !touch;
    document.getElementById('hint').textContent = 'Climb to the keep. Light the beacon.';
    const t = document.getElementById('toast'); t.innerHTML = '<b>◆</b> Wisp 1 of 5'; t.classList.add('on');
  }, touch);
  const now = {};
  for (const [k, s] of Object.entries({ back: '.labbar .back', menu: '#menu', hud: '#hud', where: '#where', count: '#count', hint: '#hint', tools: '#tools', look: '#bLook', map: '#bMap', jump: '#bJump', toast: '#toast' })) now[k] = await box(s);
  await p.screenshot({ path: `${SHOTS}now-${w}x${h}${touch ? '-touch' : ''}.png` });
  // the proposal
  await p.evaluate(([css, touch]) => {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    for (const [id, t] of [['xAtk', 'ATTACK'], ['xRoll', 'ROLL'], ['xHeal', 'HEAL']]) { const b = document.createElement('button'); b.id = id; b.className = 'cx'; b.textContent = t; b.hidden = !touch; document.body.appendChild(b); }
    // health under the HUD's last line; boss bar at the bottom, above the buttons on touch, at the foot on desktop
    const hp = document.createElement('p'); hp.id = 'xHp'; hp.innerHTML = '<i style="display:inline-block;width:120px;height:10px;background:#d2551c"></i> &#9679;&#9679;&#9675;'; hp.style.padding = '5px 10px';
    document.getElementById('hud').insertBefore(hp, document.getElementById('count'));
    const st2 = document.createElement('style'); st2.textContent = '@media (max-width: 520px) { .toast { top: calc(var(--sat) + 150px) !important; } } .boss2 { position: fixed; z-index: 31; height: 44px; box-sizing: border-box; background: rgba(8,8,14,.88); border: 1px solid #5a3424; border-radius: 10px; }';
    document.head.appendChild(st2);
    const boss = document.createElement('div'); boss.className = 'boss2'; boss.id = 'xBoss';
    if (touch) { boss.style.top = 'calc(var(--sat) + 8px)'; boss.style.left = '85px'; boss.style.right = '85px'; }
    else { boss.style.bottom = '24px'; boss.style.left = '50%'; boss.style.transform = 'translateX(-50%)'; boss.style.width = 'min(520px, calc(100vw - 32px))'; }
    document.body.appendChild(boss);
  }, [CSS, touch]);
  const pro = {};
  for (const [k, s] of Object.entries({ atk: '#xAtk', roll: '#xRoll', jump: '#bJump', heal: '#xHeal', hp: '#xHp', boss: '#xBoss' })) pro[k] = await box(s);
  await p.screenshot({ path: `${SHOTS}pro2-${w}x${h}${touch ? '-touch' : ''}.png` });
  // checks
  const over = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const inside = a => !a || (a.x >= 0 && a.y >= 0 && a.x + a.w <= w && a.y + a.h <= h);
  const now2 = { hud: await box('#hud'), toast: await box('#toast') };
  const fixed = { back: now.back, menu: now.menu, hud: now2.hud, tools: now.tools, toast: now2.toast };
  pro.hudNow = now2.hud; pro.toastNow = now2.toast;
  const issues = [];
  for (const [k, b] of Object.entries(pro)) {
    if (!b) continue;
    if (!inside(b)) issues.push(`${k} outside`);
    if (['hudNow', 'toastNow', 'hp'].includes(k)) continue;
    if (['atk', 'roll', 'jump', 'heal'].includes(k) && Math.min(b.w, b.h) < 44) issues.push(`${k} under 44`);
    for (const [f, fb] of Object.entries(fixed)) if (over(b, fb)) issues.push(`${k} over ${f}`);
    for (const [k2, b2] of Object.entries(pro)) if (k < k2 && !['hudNow', 'toastNow', 'hp'].includes(k2) && over(b, b2)) issues.push(`${k} over ${k2}`);
  }
  // the room left for the stick: the left half below the HUD and health bar
  const stickTop = now2.hud.y + now2.hud.h;
  rows.push({ layout: `${w}x${h}${touch ? ' touch' : ''}`, now, pro, stickRoom: { x: 0, y: stickTop, w: Math.round(w / 2), h: h - stickTop }, issues });
  await ctx.close();
}
await browser.close();
for (const r of rows) {
  console.log(`== ${r.layout}`);
  console.log('  now ', Object.entries(r.now).map(([k, b]) => `${k} ${b ? `${b.x},${b.y} ${b.w}x${b.h}` : '-'}`).join(' | '));
  console.log('  pro ', Object.entries(r.pro).map(([k, b]) => `${k} ${b ? `${b.x},${b.y} ${b.w}x${b.h}` : '-'}`).join(' | '));
  console.log('  stick room', JSON.stringify(r.stickRoom), ' issues:', r.issues.length ? r.issues.join(', ') : 'none');
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(rows, null, 1));
