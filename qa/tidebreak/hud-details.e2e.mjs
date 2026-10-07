// HUD details in Shore of the Ancients, checked in Chromium at a desktop, an upright phone and a phone on its side:
// - the skill card: a mouse over a skill (or a tap on a phone) shows its name, key, mana, cooldown, text and status; it
//   covers no skill, badge, point button or quick-buy tab and stays on screen; on phones it is compact (at most 100 px
//   high) and sits left of the skills, over the items; it goes when the mouse leaves, or about 2 s after a tap; a tap still
//   casts a ready skill;
// - the Night Market: the Relics tab shows the relics on the first view and selects the first relic;
// - the quick-buy tab sits above the item slots and says QUICK BUY; it previews the next purchase: its icon and price,
//   saved/needed embers when it cannot be bought, and the build goal; a press buys it.
// Needs the static server (see AGENTS.md): node qa/tidebreak/hud-details.e2e.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const SIZES = [{ name: 'desktop', w: 1440, h: 900 }, { name: 'phone', w: 390, h: 844, touch: true }, { name: 'landscape', w: 844, h: 390, touch: true }];
const player = fn => `(async () => { const s = (await import('/tidebreak/main.js')).qaState(), p = s.units.find(u => u.id === s.playerId); ${fn} })()`;
let checks = 0;
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, hasTouch: !!size.touch, isMobile: !!size.touch });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?renderer=2d');
    await page.waitForFunction(() => !document.getElementById('play')?.disabled, null, { timeout: 90000 });
    await page.evaluate(() => document.getElementById('play').click());
    for (let i = 0; i < 150 && await page.evaluate(() => document.getElementById('hud').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
    await page.waitForFunction(async () => (await import('/tidebreak/main.js')).snapshot().running, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    if (await page.evaluate(() => document.getElementById('sheet').open)) await page.keyboard.press('Escape');
    await page.evaluate(() => { document.getElementById('coach').hidden = true; });
    const at = name => `${size.name}: ${name}`;

    // Skill card on a skill that is cooling down.
    await page.evaluate(player('p.level = 3; p.skillPoints = 1; p.skillRanks = [2, 0, 0, 0]; p.cd = [6, 0, 0, 0]; p.mana = p.maxMana;'));
    await page.waitForTimeout(300);
    const q = await (await page.$('.ability.dash')).boundingBox(), qx = q.x + q.width / 2, qy = q.y + q.height / 2;
    if (size.touch) await page.touchscreen.tap(qx, qy); else await page.mouse.move(qx, qy);
    await page.waitForTimeout(350);
    const card = await page.evaluate(() => {
      const c = document.getElementById('skill-card'), b = c.getBoundingClientRect();
      const covers = [...document.querySelectorAll('.ability,.ability-upgrade:not([hidden]),#skill-points,#quick-buy')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top; }).map(e => e.id || e.className);
      return { hidden: c.hidden, text: c.innerText, covers, inView: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, height: b.height, centre: b.left + b.width / 2, skills: document.querySelector('.ability.dash').getBoundingClientRect().left };
    });
    assert.equal(card.hidden, false, at('the skill card shows'));
    assert.match(card.text, /\bQ\b/); assert.match(card.text, /mana/); assert.match(card.text, /\d(\.\d)?s\b/, at('the card shows the cooldown')); assert.match(card.text, /Ready in \d+s/, at('the card shows the cooldown left'));
    assert.deepEqual(card.covers, [], at('the card covers no skill, badge, point button or quick-buy tab')); assert.ok(card.inView, at('the card is on screen'));
    if (size.touch) assert.ok(card.height <= 100 && card.centre < card.skills, at(`the phone card is compact and left of the skills: ${Math.round(card.height)} px high, centre at ${Math.round(card.centre)}, skills from ${Math.round(card.skills)}`));
    checks++;
    // An unlearned skill says how to learn it.
    const e = await (await page.$('.ability.surge')).boundingBox();
    if (size.touch) await page.touchscreen.tap(e.x + e.width / 2, e.y + e.height / 2); else await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2);
    await page.waitForTimeout(350);
    assert.match(await page.evaluate(() => document.getElementById('skill-card').innerText), /Not learned yet|Learn at level/, at('an unlearned skill says how to learn it'));
    if (size.touch) await page.waitForTimeout(3000); else await page.mouse.move(size.w / 2, 120);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.getElementById('skill-card').hidden), true, at('the card goes away'));
    checks++;
    // A tap on a ready skill still casts it and shows its card.
    if (size.touch) {
      await page.evaluate(player('p.cd = [0, 0, 0, 0]; p.mana = p.maxMana; p.skillRanks = [1, 0, 0, 0];'));
      await page.waitForTimeout(300);
      await page.touchscreen.tap(qx, qy); await page.waitForTimeout(400);
      const after = await page.evaluate(player('return { cd: p.cd[0], card: !document.getElementById("skill-card").hidden };'));
      assert.ok(after.cd > 0 && after.card, at(`a tap casts the skill and shows its card ${JSON.stringify(after)}`));
      checks++;
    }

    // Quick-buy preview.
    await page.evaluate(player('p.gold = 40; p.inventory = [];'));
    await page.waitForTimeout(400);
    const poor = await page.evaluate(() => { const b = document.getElementById('quick-buy'); return { label: b.getAttribute('aria-label'), icon: !!b.querySelector('.item-icon'), disabled: b.disabled, text: b.innerText }; });
    assert.ok(poor.icon && poor.disabled, at('the preview shows the next item while it cannot be bought'));
    const tab = await page.evaluate(() => { const b = document.getElementById('quick-buy').getBoundingClientRect(), slots = document.getElementById('inventory').getBoundingClientRect(), label = document.querySelector('#quick-buy .qb-label'); return { above: b.bottom <= slots.top + 1, label: label?.innerText.trim(), shown: !!label && label.getBoundingClientRect().width > 0 }; });
    assert.ok(tab.above, at('the quick-buy tab sits above the item slots'));
    assert.ok(tab.shown && /quick buy/i.test(tab.label), at(`the tab says QUICK BUY: ${tab.label}`));
    assert.match(poor.label, /^Next: .+, 40 of \d+ embers/, at('the label says the embers saved toward it'));
    await page.evaluate(player('p.gold = 3000;'));
    await page.waitForTimeout(400);
    const rich = await page.evaluate(() => { const b = document.getElementById('quick-buy'); return { label: b.getAttribute('aria-label'), affordable: b.classList.contains('affordable') }; });
    assert.ok(rich.affordable, at('the preview glows when it can be bought')); assert.match(rich.label, /^Buy .+ for \d+ embers/);
    const name = rich.label.match(/^Buy (.+?) for/)[1];
    if (size.touch) { const b = await (await page.$('#quick-buy')).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); } else await page.click('#quick-buy');
    await page.waitForTimeout(400);
    const owned = await page.evaluate(async () => { const { ITEM } = await import('/tidebreak/items.js'); return (await import('/tidebreak/main.js')).snapshot().player.inventory.map(id => ITEM[id].name); });
    assert.ok(owned.includes(name), at(`a press buys the previewed item ${name}: ${owned}`));
    checks++;

    // Night Market relics on the first view.
    await page.evaluate(() => document.getElementById('shop').click()); await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('[data-category="Relics"]').click()); await page.waitForTimeout(400);
    const relics = await page.evaluate(async () => {
      const { ITEM } = await import('/tidebreak/items.js');
      const visible = [...document.querySelectorAll('.market-grid [data-item]')].filter(b => { const r = b.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight && r.bottom > 0 && getComputedStyle(b).visibility !== 'hidden'; });
      const title = document.querySelector('.market-detail h3')?.textContent;
      return { visible: visible.filter(b => ITEM[b.dataset.item].tier === 3).length, first: visible[0] && ITEM[visible[0].dataset.item].name, title, pager: !!document.querySelector('#sheet .panel-pagination:not([hidden])') };
    });
    assert.ok(relics.visible >= 2, at(`relics show on the first view of the Relics tab: ${JSON.stringify(relics)}`));
    assert.equal(relics.pager, false, at('the market is not cut into pages'));
    assert.equal(relics.title, relics.first, at('the Relics tab selects its first relic'));
    checks++;
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, [], at('no page errors'));
    console.log(`PASS ${size.name} ${size.w}x${size.h}`);
    await page.close();
  }
} finally { await browser.close(); }
console.log(`${checks} HUD detail checks passed`);
