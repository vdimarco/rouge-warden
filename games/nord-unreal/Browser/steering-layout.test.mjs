import { chromium } from '../../../qa/browser/node_modules/playwright/index.mjs';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,executablePath:process.env.NORD_CHROMIUM_PATH || '/usr/bin/chromium'});
const page = await browser.newPage();
const html = await readFile('index.html','utf8');
const css = await readFile('styles.css','utf8');
const code = (await readFile('touch-controls.js','utf8')).replace('export function', 'function');
for (const [width,height] of [[320,568],[390,844],[844,390],[1280,720]]) {
 await page.setViewportSize({width,height});
 await page.setContent(html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,''));
 await page.addStyleTag({content:css});
 await page.evaluate(`(() => {` + code + `;window.sent=[]; window.controls=setupTouchControls({root:document.querySelector('#touch-controls'),surface:document.querySelector('#frame'),stream:{toStreamerHandlers:new Map(['KeyDown','KeyUp'].map(n=>[n,v=>sent.push([n,...v])]))}});controls.setEnabled(true);controls.setDriving(true);document.body.classList.add('touch-input');document.body.dataset.state='playing';document.querySelector('#overlay').hidden=true;})()`);
 await page.addScriptTag({content: '(() => {' + await readFile('menu.js', 'utf8') + '})()'});
 const menuBox = await page.locator('#touch-menu').boundingBox();
 assert.equal(menuBox.x, 16); assert.equal(menuBox.y, 12);
 await page.locator('#touch-menu').click();
 assert.equal(await page.locator('#menu').isVisible(), true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#menu').isHidden(), true);
 const wheel = await page.locator('.touch-steering').boundingBox();
 const gas = await page.locator('#touch-gas').boundingBox();
 const brake = await page.locator('#touch-brake').boundingBox();
 assert.ok(wheel.x>=0 && wheel.x+wheel.width<=gas.x);
 assert.equal(gas.y,brake.y);
 for(const selector of ['.touch-steering button','#touch-gas','#touch-brake']) for(const box of await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>({w:n.offsetWidth,h:n.offsetHeight})))) assert.ok(box.w>=44 && box.h>=44);
 await page.mouse.move(wheel.x+28,wheel.y+56);await page.mouse.down();
 await page.mouse.move(wheel.x+84,wheel.y+56);await page.mouse.up();
 assert.deepEqual(await page.evaluate(()=>sent),[['KeyDown',65,0],['KeyUp',65],['KeyDown',68,0],['KeyUp',68]]);
 for (const mode of ['drive', 'walk', 'swim']) {
  await page.evaluate(mode => { controls.setDriving(mode === 'drive'); controls.setSwimming(mode === 'swim'); }, mode);
  const overflow = await page.locator('.touch-primary button, .touch-steering button, #touch-menu').evaluateAll(buttons => buttons.filter(b => b.getClientRects().length).flatMap(b => {
   const box = b.getBoundingClientRect();
   return [...b.querySelectorAll('b, span, svg')].filter(n => {
    const r = n.getBoundingClientRect();
    return r.left < box.left + 2 || r.right > box.right - 2 || r.top < box.top + 2 || r.bottom > box.bottom - 2 || n.scrollWidth > n.clientWidth + 1;
   }).map(n => b.id + ':' + n.textContent);
  }));
  assert.deepEqual(overflow, [], `${width}px ${mode}: labels fit fully inside controls`);
 }
 await page.evaluate(() => controls.setDriving(true));
 await page.screenshot({path:`.qa/steering-${width}.png`});
}
await browser.close();console.log('Wheel drag and layout passed at 320, 390, 844 and 1280px.');
