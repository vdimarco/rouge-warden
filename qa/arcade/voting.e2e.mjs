// Run against a static server or production with ARCADE_URL.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.ARCADE_URL || 'http://127.0.0.1:8765/';
const expected = {
  fish: ['fish', 'reel-it-in-lake-fishing'], tidebreak: ['tidebreak', 'shore-of-the-ancients'],
  wild: ['wild', 'breath-of-the-lake'], vr: ['vr', 'in-full-swing'],
  crimson: ['crimson', 'crimson-rogue'], 'river-rush': ['river-rush', 'river-rush'],
};
const browser = await chromium.launch({args:['--no-sandbox']});
fs.mkdirSync('test-results/voting', {recursive:true});
try {
  for (const width of [320,390,1280]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    // Isolate external services, artwork and metrics. Never cast real votes.
    await page.route('**/api/arcade-leaderboard',r=>r.fulfill({json:{source:'posthog',days:30,updatedAt:new Date().toISOString(),games:{}}}));
    await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:''}));
    await page.route('**/*', async r=>{
      if(r.request().resourceType()==='image') return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>'});
      return r.fallback();
    });
    await page.route('**/wild/',r=>r.request().method()==='HEAD'?r.fulfill({status:200,body:''}):r.fallback());
    await page.goto(base);
    await page.locator('.scoreboard .arcade-vote').first().waitFor();
    assert.equal(await page.locator('.scoreboard .arcade-vote').count(),6);
    for (const [id,[,slug]] of Object.entries(expected)) {
      const card=page.locator('.gsw-game').filter({has:page.locator(`[data-arcade-like="${id}"]`)});
      const vote=card.locator('.arcade-vote');
      assert.equal(await vote.getAttribute('href'),'https://vibetoplist.com/vote/'+slug);
      assert.equal(await vote.getAttribute('target'),'_blank');
      assert.match(await vote.getAttribute('rel'),/noopener/);
      assert.match(await vote.getAttribute('aria-label'),/opens in a new tab/);
      assert.equal(await vote.locator('a').count(),0);
      const box=await vote.boundingBox(); assert.ok(box.height>=44 && box.x>=0 && box.x+box.width<=width);
    }
    const first=page.locator('.arcade-vote').first();
    await first.press('Shift+Tab'); await page.keyboard.press('Tab');
    assert.ok(await first.evaluate(e=>e===document.activeElement && getComputedStyle(e).outlineStyle!=='none'));
    await page.screenshot({path:`test-results/voting/home-${width}.png`});
    assert.deepEqual(errors,[]);
    // Use isolated menu hosts on real game routes to verify the shared menu without changing gameplay.
    for (const [id,[route,slug]] of Object.entries(expected)) {
      await page.route(new URL(route+'/',base).href,r=>r.fulfill({contentType:'text/html',body:'<button data-switch>Switch game</button><script src="/arcade/switch.js"></script>'}));
      await page.goto(new URL(route+'/',base).href);
      await page.getByRole('button',{name:'Switch game',exact:true}).click();
      const vote=page.locator('.gsw-row .arcade-vote');
      assert.equal(await vote.getAttribute('href'),'https://vibetoplist.com/vote/'+slug);
      const box=await vote.boundingBox(); assert.ok(box.height>=44 && box.x>=0 && box.x+box.width<=width);
      if(id==='fish') await page.screenshot({path:`test-results/voting/menu-${width}.png`});
      await page.getByRole('button',{name:'Keep playing',exact:true}).click();
      assert.equal(await page.locator('.gsw').isVisible(),false);
      await page.getByRole('button',{name:'Switch game',exact:true}).click();
      assert.equal(await page.locator('.arcade-vote').count(),1);
    }
    await page.close();
    console.log(`PASS ${width}px: six URLs, accessible links, focus, menu reopen and Keep playing`);
  }
} finally { await browser.close(); }
