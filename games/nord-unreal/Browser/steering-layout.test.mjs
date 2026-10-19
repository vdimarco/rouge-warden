import { chromium } from '../../../qa/browser/node_modules/playwright/index.mjs';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,executablePath:process.env.NORD_CHROMIUM_PATH || '/usr/bin/chromium'});
const page = await browser.newPage();
const html = await readFile('index.html','utf8');
// The menu's own stylesheet keeps it an overlay, so opening it cannot scroll the game frame under the controls.
const css = await readFile('styles.css','utf8') + await readFile('menu.css','utf8');
const code = (await readFile('touch-controls.js','utf8')).replace(/^export /gm, '');
// Native HUD regions in 1280x720 units for a viewport-shaped frame (as in mobile.test.mjs): right/bottom regions anchor to those edges.
const hud = (width, height) => {
 const unit = Math.min(height / 720, width / 1280);
 return [['briefing', 0, 0, 480, 200], ['identity', 1040, 0, 240, 120], ['radar and credits', 1018, 96, 240, 240], ['objective', 620, 22, 460, 170],
  ['speed digits and units', 674, 624, 164, 74], ['prompt', 240, 620, 539, 100], ['completion', 490, 150, 310, 100]]
  .map(([name, x, y, w, h]) => ({ name, x: x >= 620 ? width - (1280 - x) * unit : x * unit, y: y >= 620 ? height - (720 - y) * unit : y * unit, width: w * unit, height: h * unit }));
};
const overlap = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
const boxes = selector => page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => {
 const { x, y, width, height } = n.getBoundingClientRect();
 return { id: n.id || n.getAttribute('aria-label'), x, y, width, height };
}));
for (const [width,height] of [[320,568],[360,640],[375,667],[390,844],[568,320],[667,375],[800,360],[844,390],[1280,720]]) {
 await page.setViewportSize({width,height});
 await page.setContent(html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,''));
 await page.addStyleTag({content:css});
 await page.evaluate(`(() => {` + code + `;window.sent=[]; window.controls=setupTouchControls({root:document.querySelector('#touch-controls'),surface:document.querySelector('#frame'),stream:{toStreamerHandlers:new Map(['KeyDown','KeyUp','MouseEnter','MouseDown','MouseUp'].map(n=>[n,v=>sent.push([n,...v])]))}});controls.setEnabled(true);controls.setDriving(true);document.body.classList.add('touch-input');document.body.dataset.state='playing';document.querySelector('#overlay').hidden=true;})()`);
 await page.addScriptTag({content: '(() => {' + await readFile('menu.js', 'utf8') + '})()'});
 const menuBox = await page.locator('#touch-menu').boundingBox();
 const useBox = await page.locator('#touch-use').boundingBox();
 const jumpBox = await page.locator('#touch-brake').boundingBox();
 // Menu fills the bottom-right corner of the action group: beside Use, under Jump.
 assert.equal(menuBox.y, useBox.y); assert.ok(menuBox.x > useBox.x); assert.equal(menuBox.x, jumpBox.x);
 assert.ok(Math.abs(width - 16 - (menuBox.x + menuBox.width)) <= 1 && Math.abs(height - 16 - (menuBox.y + menuBox.height)) <= 1, `${width}px: Menu sits in the bottom-right corner`);
 await page.locator('#touch-menu').click();
 assert.equal(await page.locator('#menu').isVisible(), true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#menu').isHidden(), true);
 const wheel = await page.locator('.touch-steering').boundingBox();
 const gas = await page.locator('#touch-gas').boundingBox();
 const brake = await page.locator('#touch-brake').boundingBox();
 assert.ok(wheel.x>=0 && wheel.x+wheel.width<=gas.x);
 assert.equal(gas.y,brake.y);
 for(const selector of ['.touch-steering button','#touch-gas','#touch-brake','#touch-auto']) for(const box of await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>({w:n.offsetWidth,h:n.offsetHeight})))) assert.ok(box.w>=44 && box.h>=44, `${width}px: ${selector} is a 44 px target`);
 // Graded wheel: the drawn Left/Right centres (28 px from the middle of the 112 px wheel) are the gentle 0.33 levels.
 await page.mouse.move(wheel.x+28,wheel.y+56);await page.mouse.down();
 await page.mouse.move(wheel.x+84,wheel.y+56);await page.mouse.up();
 assert.deepEqual(await page.evaluate(()=>sent),[['KeyDown',97,0],['KeyUp',97],['KeyDown',100,0],['KeyUp',100]]);
 // Full lock needs a drag past 0.75 of the 1.4x reach (about 59 px), here 70 px each way.
 await page.evaluate(()=>{sent.length=0;});
 await page.mouse.move(wheel.x+56,wheel.y+56);await page.mouse.down();
 await page.mouse.move(wheel.x+56+70,wheel.y+56);await page.mouse.move(wheel.x+56-70,wheel.y+56);await page.mouse.up();
 assert.deepEqual(await page.evaluate(()=>sent),[['KeyDown',68,0],['KeyUp',68],['KeyDown',65,0],['KeyUp',65]]);
 // Auto gas: one tap holds Gas, a second tap lets go.
 await page.evaluate(()=>{sent.length=0;});
 await page.locator('#touch-auto').click();
 assert.equal(await page.locator('#touch-auto').getAttribute('aria-pressed'), 'true');
 await page.locator('#touch-auto').click();
 assert.deepEqual(await page.evaluate(()=>sent),[['KeyDown',87,0],['KeyUp',87]]);
 assert.equal(await page.locator('#touch-auto').getAttribute('aria-pressed'), 'false');
 for (const mode of ['drive', 'walk', 'swim']) {
  await page.evaluate(mode => { controls.setDriving(mode === 'drive'); controls.setSwimming(mode === 'swim'); }, mode);
  const overflow = await page.locator('.touch-primary button, .touch-steering button, .touch-combat button, #touch-auto, #touch-menu').evaluateAll(buttons => buttons.filter(b => b.getClientRects().length).flatMap(b => {
   const box = b.getBoundingClientRect();
   return [...b.querySelectorAll('b, span, svg')].filter(n => {
    const r = n.getBoundingClientRect();
    return r.left < box.left + 2 || r.right > box.right - 2 || r.top < box.top + 2 || r.bottom > box.bottom - 2 || n.scrollWidth > n.clientWidth + 1;
   }).map(n => b.id + ':' + n.textContent);
  }));
  assert.deepEqual(overflow, [], `${width}px ${mode}: labels fit fully inside controls`);
  // Combat buttons on foot, Auto gas in a car: 44 px targets inside the screen, clear of the other controls and the native HUD text.
  const extra = await boxes(mode === 'drive' ? '#touch-auto' : '.touch-combat button');
  const others = await boxes(mode === 'drive' ? '.touch-steering, .touch-primary button' : '.move-stick, .touch-primary button');
  assert.equal(extra.length, mode === 'drive' ? 1 : 3, `${width}px ${mode}: ${mode === 'drive' ? 'Auto' : 'Weapon, Aim and Fire'} shown`);
  assert.equal(await page.locator(mode === 'drive' ? '.touch-combat' : '#touch-auto').isHidden(), true, `${width}px ${mode}: the other mode's extra controls hide`);
  for (const box of extra) {
   assert.ok(box.width >= 44 && box.height >= 44, `${width}px ${mode}: ${box.id} is a 44 px target`);
   assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `${width}px ${mode}: ${box.id} fits the screen`);
   for (const other of others) assert.equal(overlap(box, other), false, `${width}px ${mode}: ${box.id} clears ${other.id}`);
   if (width > height) for (const region of hud(width, height)) assert.equal(overlap(box, region), false, `${width}px ${mode}: ${box.id} leaves native ${region.name} clear`);
   else assert.ok(box.y >= height * .6 - .5, `${width}px ${mode}: ${box.id} stays in the bottom 40% the portrait HUD keeps clear`);
  }
  for (const [index, box] of extra.entries()) for (const other of extra.slice(index + 1)) assert.equal(overlap(box, other), false);
  if (mode === 'walk') await page.screenshot({path:`.qa/combat-${width}x${height}.png`});
 }
 await page.evaluate(() => controls.setDriving(true));
 await page.screenshot({path:`.qa/steering-${width}x${height}.png`});
}
await browser.close();console.log('Graded wheel, Auto gas, combat buttons and layout passed at 320 to 1280 px, portrait and landscape.');
