// Software-rendered instrumentation check, not a hardware performance acceptance test.
import {readFile} from 'node:fs/promises';
import {newPage,open,close,enterXR,checker,watchdog,shot,sleep} from './lib.mjs';
const {check,done}=checker('frame diagnostics');watchdog(300000,'frame diagnostics');
try {
 const p=await newPage({width:960,height:540});
 await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 if(process.env.BASELINE_MAIN) await p.route('**/vr/js/main.js',async route=>route.fulfill({contentType:'text/javascript',body:await readFile(process.env.BASELINE_MAIN,'utf8')}));
 await open(p,'?nosw&skipintro&debug');await p.waitForFunction(()=>G.viewDone);
 await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 await p.evaluate(()=>{G.game.skipTutorial();G.test.resetPerformance?.();});
 await sleep(1000);await p.keyboard.press('w');await p.keyboard.press('e');await sleep(3000);
 const result=await p.evaluate(()=>({metrics:G.test.performance?.()||null,debug:document.querySelector('#debug').textContent,
  ua:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
 console.log('INFO software-rendered diagnostic sample '+JSON.stringify(result));
 check(result.metrics?.frames>0&&result.metrics?.fps>0,'real frame intervals are recorded',result.metrics);
 check(result.metrics?.inputs>0&&result.metrics?.inputSubmitP95Ms>=0,'keyboard events produce input-to-submit samples',result.metrics);
 check(result.debug.includes('p99')&&result.debug.includes('input→submit'),'overlay labels frame pacing and latency proxy');
 await shot(p,'frame-diagnostics');
 await p.evaluate(()=>{G.test.hold(true);G.test.resetPerformance?.();});await sleep(1000);
 check(await p.evaluate(()=>G.test.performance?.().frames===0),'held simulation does not masquerade as gameplay');
 check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}
done();
