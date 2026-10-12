import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://127.0.0.1:8765/river-rush/';
const out=process.env.SHOTS||'/tmp/river-epic-music';
await fs.mkdir(out,{recursive:true});
const report={passed:false,kind:'actual-App-streaming-music-and-audio-lifecycle',base,stateOrClockMutations:false,rows:[],errors:[],limits:['Chromium desktop browser with SwiftShader; physical speaker quality and real phone app switching were not measured.','Visibility events are emulated.']};
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
function observeAudio(){
 window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(tool){window.__tools[tool.name]=tool.execute;}}});
 const rawConnect=AudioNode.prototype.connect,Base=window.AudioContext||window.webkitAudioContext;
 window.__audioProbe={contexts:[],edges:[],sources:[],media:[],masters:[],plays:0,pauses:0};
 const attach=(source,ctx)=>{const analyser=ctx.createAnalyser(),sink=ctx.createGain();analyser.fftSize=2048;sink.gain.value=0;rawConnect.call(source,analyser);rawConnect.call(analyser,sink);rawConnect.call(sink,ctx.destination);return analyser;};
 class ObservedContext extends Base{
  constructor(...args){super(...args);__audioProbe.contexts.push(this);}
  createMediaElementSource(media){const source=super.createMediaElementSource(media);__audioProbe.media.push(media);__audioProbe.sources.push({source,ctx:this,analyser:attach(source,this)});return source;}
 }
 if(window.AudioContext)window.AudioContext=ObservedContext;if(window.webkitAudioContext)window.webkitAudioContext=ObservedContext;
 AudioNode.prototype.connect=function(destination,...args){const value=rawConnect.call(this,destination,...args);__audioProbe.edges.push({from:this,to:destination});if(destination===this.context.destination&&!__audioProbe.masters.some(x=>x.source===this))__audioProbe.masters.push({source:this,ctx:this.context,analyser:attach(this,this.context)});return value;};
 const play=HTMLMediaElement.prototype.play,pause=HTMLMediaElement.prototype.pause;
 HTMLMediaElement.prototype.play=function(...args){if(this.src.includes('river-rush-adventure')){__audioProbe.plays++;if(window.__rejectMusicPlay)return Promise.reject(new DOMException('Blocked by deterministic QA fixture','NotAllowedError'));}return play.apply(this,args);};
 HTMLMediaElement.prototype.pause=function(...args){if(this.src.includes('river-rush-adventure'))__audioProbe.pauses++;return pause.apply(this,args);};
 window.__audioSnapshot=()=>{
  const rms=(a,ctx)=>{if(ctx.state!=='running')return 0;const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,n)=>sum+n*n,0)/data.length);};
  return{contexts:__audioProbe.contexts.map(ctx=>({state:ctx.state})),musicSources:__audioProbe.sources.length,media:__audioProbe.media.map(m=>({src:m.currentSrc||m.src,time:m.currentTime,paused:m.paused,readyState:m.readyState,error:m.error?.code??null})),musicRms:__audioProbe.sources.map(s=>rms(s.analyser,s.ctx)),outputRms:__audioProbe.masters.map(s=>rms(s.analyser,s.ctx)),masterGains:__audioProbe.masters.map(s=>s.source.gain?.value??null),plays:__audioProbe.plays,pauses:__audioProbe.pauses};
 };
}
const status=p=>p.evaluate(()=>window.__tools.get_run_status({}));
const audio=p=>p.evaluate(()=>window.__audioSnapshot());
async function ready(p){await p.goto(base);await p.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Start run"]');return b&&!b.disabled;},{},{timeout:90000});}
async function until(p,test,timeout=15000){const end=Date.now()+timeout;let s;while(Date.now()<end){s=await status(p);if(test(s))return s;await p.waitForTimeout(30);}throw new Error(`Status timed out: ${JSON.stringify(s)}`);}
async function sample(p){const rows=[];for(let i=0;i<6;i++){rows.push(await audio(p));await p.waitForTimeout(100);}return rows;}
const record=async row=>{report.rows.push(row);await fs.writeFile(`${out}/epic-music.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({case:row.case,passed:true}));};
async function create(layout,fallback=false){const p=await browser.newPage({viewport:layout});await p.addInitScript(observeAudio);if(fallback)await p.addInitScript(()=>{const raw=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:raw.call(this,type,...args);};});p.on('pageerror',e=>report.errors.push(e.message));return p;}
try{
 for(const layout of [{name:'desktop',width:1536,height:1024},{name:'phone',width:390,height:844},{name:'landscape',width:844,height:390}]){
  if(process.env.CASE==='desktop'&&layout.name!=='desktop')continue;
  const p=await create(layout);await ready(p);const menu=await audio(p);assert.equal(menu.contexts.length,0,'The menu must not construct or autoplay audio');
  assert.equal(await p.getByRole('button',{name:'Mute sound',exact:true}).getAttribute('aria-pressed'),'true');await p.getByRole('button',{name:'Start run',exact:true}).click();
  await until(p,s=>s.screen==='playing'&&s.audio.musicPlaying&&s.run.distance>=8);
  const audible=await sample(p);assert.ok(audible.some(s=>s.musicRms.some(r=>r>.003)),'The streamed music must produce real nonzero decoded audio');assert.ok(audible.some(s=>s.outputRms.some(r=>r>.001)),'The actual output mix must produce audio');assert.ok(audible.every(s=>s.contexts.length===1&&s.musicSources===1&&s.media.length===1),'Only one context/media source may be created');
  await p.keyboard.press('Escape');await until(p,s=>s.screen==='paused'&&!s.audio.active);const pausedBefore=await audio(p);await p.waitForTimeout(300);const pausedAfter=await audio(p);assert.equal(pausedAfter.media[0].time,pausedBefore.media[0].time);assert.ok(pausedAfter.media[0].paused);assert.ok(pausedAfter.contexts.every(c=>c.state==='suspended'));assert.ok(pausedAfter.outputRms.every(r=>r===0));
  await p.getByRole('button',{name:'Resume run',exact:true}).click();await until(p,s=>s.screen==='playing'&&s.audio.musicPlaying);await p.getByRole('button',{name:'Mute sound',exact:true}).click();const muted=await until(p,s=>s.screen==='playing'&&!s.audio.enabled);const mutedAudio=await audio(p);assert.ok(mutedAudio.media[0].paused);assert.ok(mutedAudio.contexts.every(c=>c.state==='suspended'));assert.ok(mutedAudio.outputRms.every(r=>r===0));
  const mutedDistance=muted.run.distance;await until(p,s=>s.screen==='playing'&&s.run.distance>mutedDistance+8);assert.equal(await p.evaluate(()=>localStorage.getItem('river-rush-sound-enabled')),'false');
  await p.getByRole('button',{name:'Enable sound',exact:true}).click();await until(p,s=>s.audio.musicPlaying);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await until(p,s=>s.screen==='paused'&&!s.audio.active);
  const hidden=await audio(p);await p.evaluate(()=>{delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(300);const restored=await status(p),restoredAudio=await audio(p);assert.equal(restored.screen,'paused');assert.ok(restoredAudio.media[0].paused);assert.ok(restoredAudio.contexts.every(c=>c.state==='suspended'),'Showing a tab must not resume paused music');assert.equal(restoredAudio.media[0].time,hidden.media[0].time);
  await p.getByRole('button',{name:'Resume run',exact:true}).click();await until(p,s=>s.audio.musicPlaying);await p.keyboard.press('Escape');await until(p,s=>s.screen==='paused');await p.getByRole('button',{name:'Restart this map',exact:true}).click();await until(p,s=>s.screen==='playing'&&s.audio.musicPlaying);const retry=await audio(p);assert.equal(retry.contexts.length,1);assert.equal(retry.musicSources,1);assert.equal(retry.media.length,1);
  await p.getByRole('button',{name:'Mute sound',exact:true}).click();await p.keyboard.press('Escape');await until(p,s=>s.screen==='paused');await p.reload();await p.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Start run"]');return b&&!b.disabled;},{},{timeout:90000});assert.equal(await p.getByRole('button',{name:'Enable sound',exact:true}).getAttribute('aria-pressed'),'false');assert.equal((await status(p)).audio.enabled,false);await p.getByRole('button',{name:'Start run',exact:true}).click();await until(p,s=>s.screen==='playing'&&s.run.distance>=8);const persisted=await audio(p);assert.ok(persisted.contexts.every(c=>c.state==='suspended'));assert.ok(persisted.media.every(m=>m.paused));
  await record({case:`music-${layout.name}`,layout,menu,audible,pausedBefore,pausedAfter,mutedAudio,hidden,restoredAudio,retry,persisted,actualOutputMeasured:true});await p.close();
 }
 for(const failure of ['missing-music','play-rejection']){
  const p=await create({width:390,height:844},true);if(failure==='missing-music')await p.route('**/audio/river-rush-adventure.mp3',r=>r.fulfill({status:404,body:'Music missing in deterministic QA fixture'}));else await p.addInitScript(()=>{window.__rejectMusicPlay=true;});await ready(p);await p.getByRole('button',{name:'Start run',exact:true}).click();const started=await until(p,s=>s.screen==='playing'&&s.run.distance>=8);await p.keyboard.press('ArrowRight');await until(p,s=>s.run.lane===2);await p.keyboard.press('ArrowUp');await until(p,s=>s.run.action==='jump');await p.keyboard.press('ArrowDown');await until(p,s=>s.run.action==='duck');await p.keyboard.press('Escape');await until(p,s=>s.screen==='paused');await p.getByRole('button',{name:'Resume run',exact:true}).click();await until(p,s=>s.screen==='playing'&&s.run.distance>=started.run.distance+8);const survived=await status(p);assert.equal(survived.audio.enabled,true,'An optional music failure must keep effects enabled');assert.ok(['unavailable','blocked'].includes(survived.audio.musicState));
  await record({case:failure,started,survived,audio:await audio(p),controls:['left/right','jump','duck','pause','resume'],optionalFailureIsolated:true});await p.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(`${out}/epic-music.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:report.passed,rows:report.rows.length,report:`${out}/epic-music.json`}));
