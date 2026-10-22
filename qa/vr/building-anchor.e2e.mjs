// A held swing button lets go on the GO cue and catches the next building. Letting go early does not.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("holdchain");
watchdog(240000, "holdchain");
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
  check(page.errors.length===0,'no browser errors');
  done();
} finally {await close();}
