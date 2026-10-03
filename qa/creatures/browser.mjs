import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { HERO_IDENTITIES, identitySkill } from '../../public/tidebreak/hero-identities.js';
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const root = path.resolve('public'), shots = process.env.SHOTS || '/tmp/creature-browser'; fs.mkdirSync(shots, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch({ headless: true });
try {
  for (const [name, width, height] of [['phone', 390, 844], ['small-phone', 320, 568], ['landscape', 844, 390], ['desktop', 1536, 864]]) {
    const page = await browser.newPage({ viewport: { width, height } }), errors = [], loadedAssets = new Set();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('response', r => { if (r.url().startsWith(origin)) { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); else loadedAssets.add(new URL(r.url()).pathname); } });
    await page.goto(origin + '/arcade/creatures/');
    assert.match(await page.title(), /Creature Field Guide/); assert.equal(await page.locator('.card').count(), 18);
    await page.waitForFunction(() => { const s = window.creatureGallery?.(); return s && s.ready + s.failed === 18; });
    console.log(name, JSON.stringify(await page.evaluate(() => window.creatureGallery())), errors);
    await page.screenshot({ path: path.join(shots, `${name}-gallery-loaded.png`), fullPage: true });
    assert.equal((await page.evaluate(() => window.creatureGallery())).failed, 0);
    await page.getByRole('button', { name: 'Walk', exact: true }).click();
    assert.equal((await page.evaluate(() => window.creatureGallery())).state, 'walk');
    await page.getByRole('button', { name: 'Turn', exact: false }).click();
    assert.equal((await page.evaluate(() => window.creatureGallery())).facing, Math.PI / 4);
    await page.screenshot({ path: path.join(shots, `${name}-creatures.png`), fullPage: true });
    await page.goto(origin + '/tidebreak/'); assert.match(await page.title(), /Shore of the Ancients/);
    await page.locator('#menu').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('#hero-picks [data-hero]').length === 16);
    assert.equal(await page.locator('#hero-name').innerText(), 'Tidewarden');
    const selectState = await page.evaluate(() => {
      // The stage illustration can overscan. Selection controls must fit the viewport.
      const ids=['hero-picks','role-filters','hero-name','hero-preview','hero-spell-note','play'];
      const box = id => {
        const el=document.getElementById(id), r=el?.getBoundingClientRect();
        return r ? {x:r.x,y:r.y,w:r.width,h:r.height,visible:r.width>0&&r.height>0&&r.top>=-1&&r.left>=-1&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1} : null;
      };
      return Object.fromEntries(ids.map(id=>[id,box(id)]));
    });
    console.log(name,'selection',JSON.stringify(selectState));
    assert(Object.values(selectState).every(v=>v?.visible), 'hero selection essentials stay visible');
    assert(selectState['hero-picks'].w >= width * (width >= 600 ? .27 : .8), 'four-column roster has room to browse heroes');
    if (name === 'desktop') {
      const roster = await page.locator('.roster-browser').boundingBox();
      assert(Math.abs(roster.width / width - .32) <= .01, 'desktop roster follows the reference width');
    }
    const controlsFit = await page.evaluate(() => {
      const rect = el => el.getBoundingClientRect();
      const inside = (r, p) => r.width>0&&r.height>0&&r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1;
      const viewport = {left:0,top:0,right:innerWidth,bottom:innerHeight};
      const footer = [...document.querySelectorAll('#play, .roster-footer .menu-links button')].map(rect);
      const overlaps = (a, b) => Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
      const roster = rect(document.querySelector('#hero-picks'));
      const cards = [...document.querySelectorAll('#hero-picks button')].map(rect).filter(r=>inside(r,roster));
      const spells = [...document.querySelectorAll('#hero-preview [data-hero-spell]')].map(rect);
      const filters = [...document.querySelectorAll('#role-filters button')].map(rect);
      return {
        footer:footer.every(r=>inside(r,viewport))&&footer.every((r,i)=>footer.slice(i+1).every(other=>!overlaps(r,other))),
        spells:spells.length===4&&spells.every(r=>inside(r,viewport))&&spells.every((r,i)=>spells.slice(i+1).every(other=>!overlaps(r,other))),
        filters:filters.length===6&&filters.every(r=>inside(r,viewport)),
        cards:cards.filter(r=>r.width>=48&&r.height>=44).length>=4,
        columns:new Set(cards.map(r=>Math.round(r.left))).size===4,
        allCardsFit:[...document.querySelectorAll('#hero-picks button')].every(el=>inside(rect(el),roster)),
      };
    });
    console.log(name,'selection controls',JSON.stringify(controlsFit));
    assert(controlsFit.footer, 'Start and menu links fit without overlapping');
    assert(controlsFit.spells, 'four skill buttons fit without overlapping');
    assert(controlsFit.filters, 'all six role controls fit');
    assert(controlsFit.cards, 'at least one row of four usable hero cards fits');
    assert(controlsFit.columns, 'the roster uses four columns');
    if (name === 'desktop') assert(controlsFit.allCardsFit, 'all sixteen portraits fit the desktop roster');
    for (const identity of HERO_IDENTITIES) {
      await page.locator(`#hero-picks [data-hero="${identity.id}"]`).click();
      assert.equal(await page.locator('#hero-name').innerText(), identity.name);
      assert.equal(await page.locator('#hero-role').innerText(), identity.subtitle);
      assert.equal(await page.locator('#hero-note').textContent(), identity.note);
      assert.equal(await page.locator('#hero-picks [aria-pressed="true"]').getAttribute('data-hero'), String(identity.id));
      assert.equal(await page.locator('#hero-art').getAttribute('src'), `./art/reference/${identity.slug}.webp`);
      await page.waitForFunction(slug => { const image=document.querySelector('#hero-art'); return image.src.endsWith(`/reference/${slug}.webp`)&&image.complete&&image.naturalWidth>0; }, identity.slug);
      assert.deepEqual(await page.locator('#hero-tags span').allTextContents(), [...identity.tags]);
      for (let slot=0;slot<4;slot++) {
        const button=page.locator(`#hero-preview [data-hero-spell="${slot}"]`), move=identitySkill(identity.id,slot);
        assert.equal(await button.getAttribute('title'), `${move.name}: ${move.description}`);
        assert.equal(await button.locator('kbd').innerText(), ['Q','E','C','R'][slot]);
      }
      assert.match(await page.locator('#hero-spell-note').innerText(), new RegExp(identity.skills[1]));
    }
    for (const role of ['Carry','Bruiser','Mage','Support','Initiator','All']) {
      await page.locator(`#role-filters [data-role="${role}"]`).click();
      const expected=HERO_IDENTITIES.filter(h=>role==='All'||h.filters.includes(role)).map(h=>String(h.id));
      const actual=await page.locator('#hero-picks [data-hero]').evaluateAll(cards=>cards.map(card=>card.dataset.hero));
      assert.deepEqual(actual, expected, `${role} shows the correct heroes`);
      assert.equal(await page.locator(`#role-filters [data-role="${role}"]`).getAttribute('aria-pressed'), 'true');
      await page.locator('#hero-picks [data-hero]').first().click();
      assert.equal(await page.locator('#hero-name').innerText(), HERO_IDENTITIES[Number(expected[0])].name);
    }
    await page.locator('#hero-picks [data-hero="0"]').focus();
    for (const [key,identity] of [['ArrowRight',1],['ArrowDown',5],['ArrowLeft',4],['ArrowUp',0],['End',15],['Home',0]]) {
      await page.keyboard.press(key);
      assert.equal(await page.locator('#hero-name').innerText(), HERO_IDENTITIES[identity].name, `${key} selects the correct grid neighbor`);
      assert.equal(await page.locator('#hero-picks [data-hero]:focus').getAttribute('data-hero'), String(identity));
    }
    await page.locator('[data-hero-spell="1"]').hover();
    assert.match(await page.locator('#hero-spell-note').innerText(), /Rising Current/);
    assert.match(await page.locator('#hero-spell-note').innerText(), /Pull enemies in a cone/);
    const noteFits = await page.locator('#hero-spell-note').evaluate(el => {
      const r=el.getBoundingClientRect(), f=el.closest('.hero-feature').getBoundingClientRect();
      return r.left>=f.left-1&&r.right<=f.right+1&&r.top>=f.top-1&&r.bottom<=f.bottom+1;
    });
    assert(noteFits, 'hover description fits the selected hero panel');
    await page.locator('#hero-preview [data-hero-spell="1"]').click();
    assert.equal(await page.locator('#sheet h2').textContent(), 'Rising Current');
    await page.locator('#sheet .panel-pages').waitFor();
    const backToHeroes=page.getByRole('button', { name: 'Back to heroes', exact:true });
    let descriptionSeen=(await page.locator('#sheet-content').innerText()).includes('Pull enemies in a cone');
    for (let panelPage=0;!(await backToHeroes.isVisible())&&panelPage<12;panelPage++) {
      const nextPage=page.getByRole('button', { name:'Next panel page', exact:true });
      assert(await nextPage.isEnabled(), 'skill details keep the return action reachable');
      await nextPage.click();
      descriptionSeen ||= (await page.locator('#sheet-content').innerText()).includes('Pull enemies in a cone');
    }
    assert(descriptionSeen, 'tapping a skill exposes its description');
    await backToHeroes.click();
    assert.equal(await page.locator('#sheet').isVisible(), false);
    await page.keyboard.press('f');
    assert.equal(await page.locator('#sheet h2').textContent(), 'Tidewarden');
    assert.equal(await page.locator('#sheet h3').count(), 4);
    assert.match(await page.locator('#sheet-content').textContent(), /Q · Tidal Cleave/);
    await page.keyboard.press('Escape');
    for (const [selector,title] of [['#hero-profile','Tidecaller'],['[data-menu-tab="realms"]','The shifting realms'],['[data-menu-tab="lore"]','Tidewarden'],...(name==='desktop'?[['[data-menu-tab="shop"]','The Night Market']]:[])]) {
      await page.locator(selector).click();
      assert.equal(await page.locator('#sheet h2').textContent(), title);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#sheet').isVisible(), false);
    }
    await page.locator('#hero-settings').click();
    assert.equal(await page.locator('#sheet h2').textContent(), 'Game settings');
    const soundSetting=page.locator('#selection-sound'),originalSound=await soundSetting.innerText();
    await soundSetting.click();
    assert.notEqual(await soundSetting.innerText(), originalSound);
    await soundSetting.click();
    assert.equal(await soundSetting.innerText(), originalSound);
    await page.keyboard.press('Escape');
    await page.locator('[data-menu-tab="heroes"]').click();
    assert.equal(await page.locator('#hero-picks [data-hero]:focus').getAttribute('data-hero'), '0');
    await page.waitForFunction(() => document.querySelector('#hero-art').complete&&document.querySelector('#hero-art').naturalWidth>0);
    assert(loadedAssets.has('/tidebreak/art/reference/reference-source.png'), 'source portrait and logo artwork loads');
    assert(loadedAssets.has('/tidebreak/art/reference/shore-scene.webp'), 'clean shore scene artwork loads');
    assert.match(await page.locator('.reference-portrait').first().evaluate(el=>getComputedStyle(el).backgroundImage), /reference-source\.png/);
    await page.screenshot({ path: path.join(shots, `${name}-shore-select.png`), fullPage: true });
    await page.locator('#play').waitFor(); await page.waitForFunction(() => !document.querySelector('#play').disabled);
    if (name==='desktop') { await page.locator('#play').focus(); await page.keyboard.press('Enter'); }
    else await page.locator('#play').click();
    await page.evaluate(async () => { window.__mobaSnapshot = (await import('/tidebreak/main.js')).snapshot; });
    // Starting a match opens the spellbook and pauses play until training is done.
    assert.equal(await page.evaluate(() => window.__mobaSnapshot().paused), true);
    assert.equal(await page.evaluate(() => window.__mobaSnapshot().player.identity), 0);
    assert.equal(await page.evaluate(() => window.__mobaSnapshot().player.hero), 1);
    assert.equal(await page.evaluate(() => window.__mobaSnapshot().player.name), 'Tidewarden');
    assert.match(await page.locator('.spellbook-heading').innerText(), /Tidewarden/);
    assert.match(await page.locator('#train-selected').innerText(), /Learn Tidal Cleave/);
    const initialRank = await page.evaluate(() => window.__mobaSnapshot().player.skillRanks.reduce((sum, rank) => sum + rank, 0));
    await page.locator('#train-selected').click();
    assert.equal(await page.evaluate(() => window.__mobaSnapshot().player.skillRanks.reduce((sum, rank) => sum + rank, 0)), initialRank + 1);
    await page.locator('#back-skills').click();
    assert.equal(await page.evaluate(() => window.__mobaSnapshot().paused), false);
    await page.waitForFunction(() => window.__mobaSnapshot().time > 3 && window.__mobaSnapshot().graphics.creatures.loaded > 0);
    const before = await page.evaluate(async () => (await import('/tidebreak/main.js')).snapshot());
    assert(before.running); assert(before.time > 3); assert(before.graphics.creatures.loaded > 0); assert.equal(before.graphics.creatures.failed, 0);
    await page.keyboard.down('d'); await page.waitForTimeout(350); await page.keyboard.up('d');
    const after = await page.evaluate(async () => (await import('/tidebreak/main.js')).snapshot());
    assert(after.player.x > before.player.x, 'movement stays live with procedural creatures');
    if (await page.locator('#coach-close').isVisible()) await page.locator('#coach-close').click();
    await page.locator('#pause').click(); assert(await page.locator('#sheet').isVisible());
    await page.getByRole('button', { name: 'Keep playing' }).click(); assert(!(await page.locator('#sheet').isVisible()));
    await page.screenshot({ path: path.join(shots, `${name}-moba.png`) });
    assert.deepEqual(errors, []); console.log(`PASS ${name}: gallery loads 18 originals; sixteen hero identities and source art; role filters, keyboard grid, hover and tap; Tidewarden skill training; MOBA creature sprites, movement, pause and resume; no asset or page errors.`);
    await page.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
