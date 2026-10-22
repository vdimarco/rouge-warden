// A held swing button lets go on the GO cue and catches the next building. Letting go early does not.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("building-anchor");
watchdog(240000, "building-anchor");
const out = SHOTS || "/tmp/swing-holdchain";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); });

  for (const [label,y] of [['water',30],['above-city',1500]]) {
    const result=await page.evaluate(y=>{
      G.game.skipTutorial();G.test.teleport(0,y,900);G.P.onGround=false;
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));
      G.test.step(1/60,4);
      const ropes=G.P.ropes.map(r=>({state:r.state,tag:r.target?.tag}));
      window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE'}));G.test.step(1/60,2);
      return ropes;
    },y);
    check(result.every(r=>r.state==='idle'),label+': no invisible attachment '+JSON.stringify(result));
  }
  const rooftop = await page.evaluate(() => {
    const candidates=G.city.colliders.filter(c=>c.type==='box'&&c.tag==='building'&&c.maxY>100);
    for(const c of candidates){
      const y=c.maxY+2,z=(c.minZ+c.maxZ)/2,x=c.minX-55;
      G.test.teleport(x,y,z);G.P.onGround=false;G.P.wall=null;
      G.test.face(x+100,z);G.P.vel.x=8;G.P.vel.z=0;
      G.test.step(1/60,1);
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));G.test.step(1/60,4);
      const rope=G.P.ropes.find(r=>r.state==='attached'&&r.target?.tag==='building');
      const col=rope&&G.city.colliders[rope.target.id];
      const result=col&&col.maxY<y ? {playerY:y,roofY:col.maxY,anchor:{...rope.anchor},tag:rope.target.tag}:null;
      window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE'}));G.test.step(1/60,2);
      if(result)return result;
    }
    return null;
  });
  console.log('ROOFTOP',JSON.stringify(rooftop));
  check(!!rooftop,'a reachable real building can attach below the player above its rooftop');
  check(page.errors.length===0,'no browser errors');
  done();
} finally {await close();}
