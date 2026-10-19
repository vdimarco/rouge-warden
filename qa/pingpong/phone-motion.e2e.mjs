import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({args:['--no-sandbox']});
const base=process.env.ARCADE_URL || 'http://127.0.0.1:8765';
fs.mkdirSync('test-results/phone-motion',{recursive:true});
try {
for(const angle of [0,90,270]){
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:angle?{width:844,height:390}:{width:390,height:844}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({angle})=>{
    Object.defineProperty(screen.orientation,'angle',{configurable:true,get:()=>angle});
    window.sensor={alpha:0,beta:angle===90?0:angle===270?0:75,gamma:angle===90?-75:angle===270?75:0,acceleration:{x:0,y:0,z:0}};
    setInterval(()=>{
      const s=window.sensor;
      const orient=new Event('deviceorientation');for(const k of ['alpha','beta','gamma'])Object.defineProperty(orient,k,{value:s[k]});window.dispatchEvent(orient);
      const motion=new Event('devicemotion');Object.defineProperties(motion,{acceleration:{value:s.acceleration},rotationRate:{value:{alpha:0,beta:0,gamma:0}},accelerationIncludingGravity:{value:{x:0,y:0,z:9.81}}});window.dispatchEvent(motion);
    },16);
  },{angle});
  await page.goto(base+'/pingpong/');
  await page.getByRole('button',{name:'Tap to pick up your bat'}).click();
  await page.locator('#gate').waitFor({state:'hidden'});
  await page.waitForTimeout(150);
  const read=()=>page.evaluate(()=>window.__test.bat);
  await page.getByRole('button',{name:'Center',exact:true}).click();
  const home=await read();
  await page.evaluate(()=>{window.sensor.acceleration={x:0,y:0,z:-5};});
  await page.waitForTimeout(200);const forward=await read();
  assert.ok(forward.depth>home.depth+0.12,JSON.stringify({angle,home,forward,phone:await page.evaluate(()=>window.__test.phone())}));
  await page.screenshot({path:`test-results/phone-motion/forward-${angle}.png`});
  await page.evaluate(()=>{window.sensor.acceleration={x:0,y:0,z:0};});
  await page.getByRole('button',{name:'Center',exact:true}).click();
  await page.evaluate(()=>{window.sensor.acceleration={x:0,y:0,z:5};});
  await page.waitForTimeout(200);const back=await read();
  assert.ok(back.depth<home.depth-0.1,JSON.stringify({angle,home,back}));
  await page.screenshot({path:`test-results/phone-motion/back-${angle}.png`});
  await page.evaluate(()=>{window.sensor.acceleration={x:0,y:0,z:0};});
  await page.getByRole('button',{name:'Center',exact:true}).click();
  await page.evaluate(()=>{window.sensor.alpha=335;});
  await page.waitForTimeout(160);const right=await read();assert.ok(right.x>0.4,JSON.stringify({angle,right}));
  await page.evaluate(()=>{window.sensor.alpha=25;});
  await page.waitForTimeout(160);const left=await read();assert.ok(left.x< -0.4,JSON.stringify({angle,left}));
  await page.getByRole('button',{name:'Center',exact:true}).click();
  await page.waitForTimeout(60);const centred=await read();assert.ok(Math.abs(centred.x)<0.06,JSON.stringify({angle,centred}));
  assert.deepEqual(errors,[]);
  console.log(`PASS phone ${angle}: real sensor events move forward/back, wrist sweeps both ways, Center clears motion`);
  await context.close();
}
}finally{await browser.close();}
