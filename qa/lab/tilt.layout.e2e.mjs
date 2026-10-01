// Responsive checks for the public celestial-adventure interface.
import assert from 'node:assert/strict';
import { open, shot } from './lib.mjs';
for (const size of [
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
  { name: 'tablet-landscape', width: 1366, height: 1024, touch: true },
  { name: 'phone-portrait', width: 390, height: 844, touch: true },
]) {
  const { page, errors, close } = await open('tilt/', size);
  try {
    assert.match(await page.title(), /Full Tilt.*pinball voyage/);
    await page.getByRole('button', {name:'Start voyage',exact:true}).click();
    await page.locator('#hud').waitFor({state:'visible'});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'no horizontal overflow');
    const bounds=await page.locator('#view').boundingBox();
    assert.equal(Math.round(bounds.width),size.width); assert.equal(Math.round(bounds.height),size.height);
    for(const id of ['left-flip','right-flip','launch-button','pause-button','map-button']) {
      const box=await page.locator('#'+id).boundingBox();
      assert(box && box.width>=44 && box.height>=44, id+' has a usable touch area');
      assert(box.x>=0 && box.y>=0 && box.x+box.width<=size.width+1 && box.y+box.height<=size.height+1,id+' fits');
    }
    await shot(page,`${size.name}-ready`);
    const left=page.locator('#left-flip');
    const pad=await left.boundingBox();
    await page.mouse.move(pad.x+pad.width/2,pad.y+pad.height/2);await page.mouse.down();
    assert(await left.evaluate(el=>el.classList.contains('held')));
    await page.setViewportSize({width:size.height,height:size.width});
    await page.waitForFunction(()=>!document.querySelector('#left-flip').classList.contains('held'));
    await page.mouse.up();
    assert(await page.locator('#launch-button').isVisible(),'rotation keeps the dock ready');
    await page.getByRole('button',{name:'Map',exact:true}).click();
    assert.equal(await page.locator('#route-list > li').count(),6);
    await page.getByRole('button',{name:'Close map',exact:true}).click();
    await page.locator('#launch-button').click();
    await page.locator('#pulse-button').waitFor({state:'visible'});
    await shot(page,`${size.name}-flight`);
    assert.deepEqual(errors,[],'no browser errors');
    console.log(`PASS ${size.name}: viewport, touch areas, rotation, route, launch`);
  } catch(error) { await shot(page,`${size.name}-failure`); throw error; }
  finally { await close(); }
}
