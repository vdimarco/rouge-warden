import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const root = path.resolve('public'), shots = process.env.SHOTS || '/tmp/creature-browser'; fs.mkdirSync(shots, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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
  for (const [name, width, height] of [['phone', 390, 844], ['landscape', 844, 390], ['desktop', 1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
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
    const selectState = await page.evaluate(() => {
      const ids=['hero-picks','hero-art','hero-preview','hero-spell-note','play'];
      const box = id => {
        const el=document.getElementById(id), r=el?.getBoundingClientRect();
        return r ? {x:r.x,y:r.y,w:r.width,h:r.height,visible:r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth} : null;
      };
      return Object.fromEntries(ids.map(id=>[id,box(id)]));
    });
    console.log(name,'selection',JSON.stringify(selectState));
    assert(Object.values(selectState).every(v=>v?.visible), 'hero selection essentials stay visible');
    await page.locator('[data-hero-spell="1"]').hover();
    assert.match(await page.locator('#hero-spell-note').innerText(), /Undertow/);
    const noteFits = await page.locator('#hero-spell-note').evaluate(el => {
      const r=el.getBoundingClientRect(), f=el.closest('.hero-feature').getBoundingClientRect();
      return r.left>=f.left-1&&r.right<=f.right+1&&r.top>=f.top-1&&r.bottom<=f.bottom+1;
    });
    assert(noteFits, 'hover description fits the selected hero panel');
    await page.screenshot({ path: path.join(shots, `${name}-shore-select.png`), fullPage: true });
    await page.locator('#play').waitFor(); await page.waitForFunction(() => !document.querySelector('#play').disabled);
    await page.locator('#play').click();
    await page.evaluate(async () => { window.__mobaSnapshot = (await import('/tidebreak/main.js')).snapshot; });
    // Starting a match opens the spellbook and pauses play until training is done.
    assert.equal(await page.evaluate(() => window.__mobaSnapshot().paused), true);
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
    assert.deepEqual(errors, []); console.log(`PASS ${name}: gallery loads 18 originals; walk and turn; MOBA creature sprites load; move, pause and resume; no asset or page errors.`);
    await page.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
