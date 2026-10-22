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
 await p.keyboard.press('w');await p.keyboard.press('e');
 if(await p.evaluate(()=>typeof G.test.performance==='function')) await p.waitForFunction(()=>G.test.performance().frames>=3&&G.test.performance().inputs>0,null,{timeout:120000});
 const result=await p.evaluate(()=>({metrics:G.test.performance?.()||null,debug:document.querySelector('#debug').textContent,
  ua:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
 console.log('INFO software-rendered diagnostic sample '+JSON.stringify(result));
 check(result.metrics?.frames>0&&result.metrics?.fps>0,'real frame intervals are recorded',result.metrics);
 check(result.metrics?.inputs>0&&result.metrics?.inputSubmitP95Ms>=0,'keyboard events produce input-to-submit samples',result.metrics);
 check(result.debug.includes('p99')&&result.debug.includes('input→submit'),'overlay labels frame pacing and latency proxy');
 await shot(p,'frame-diagnostics');
 const invisibleAt=await p.evaluate(()=>{window.__metricUpdate=G.desktop.update;G.desktop.update=(...args)=>{const input=window.__metricUpdate(...args);input.visible=false;return input;};G.test.resetPerformance?.();return G.frame;});
 await p.waitForFunction(n=>G.frame>=n+3,invisibleAt);
 check(await p.evaluate(()=>G.test.performance?.().frames===0),'invisible input frames do not count as gameplay');
 await p.evaluate(()=>{G.desktop.update=window.__metricUpdate;delete window.__metricUpdate;});
 await p.evaluate(()=>{G.test.hold(true);G.test.resetPerformance?.();});await sleep(1000);
 check(await p.evaluate(()=>G.test.performance?.().frames===0),'held simulation does not masquerade as gameplay');
 check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}
done();
