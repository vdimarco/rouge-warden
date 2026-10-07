import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const source=process.env.DEV_URL||'http://127.0.0.1:3001/',out=process.env.SHOTS||'/tmp/river-terrain-feedback';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
const report={passed:false,kind:'isolated-production-RiverAudio-real-OfflineAudioContext-waveforms',source,rows:[],limitations:['Music and river ambience muted in this cue-only fixture. Real speakers were not auditioned.']};
try{
 const p=await browser.newPage(),url=new URL('cue-waveforms/',source).href;
 await p.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated cue waveform fixture</title>'}));await p.goto(url);
 for(const type of ['coin','hit','lose','smash','terrain-combo','burst-impact']){
  const row=await p.evaluate(async type=>{
   const {RiverAudio}=await import('/src/game/audio.js'),rate=48000,length=rate*.8;
   const context=new OfflineAudioContext(1,length,rate),proxy=new Proxy(context,{get(target,key){if(key==='state')return'running';if(['resume','suspend','close'].includes(key))return()=>Promise.resolve();const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});
   const audio=new RiverAudio({createContext:()=>proxy,createMedia:()=>{throw new Error('Cue-only fixture');}});audio.setEnabled(true);audio.start({reset:true});audio.nodes.riverGain.gain.value=0;
   let scheduled;if(type==='burst-impact'){for(let i=0;i<30;i++)audio.tone('coin',{id:i,streak:i});scheduled=audio.tone('lose',{id:901});}else scheduled=audio.tone(type,{id:901});
   const atStart=audio.status,voiceShape=[...audio.voices].map(v=>({wave:v.source.type??'noise',frequency:v.source.frequency?.value??v.filter.frequency.value,event:v.event}));
   const buffer=await context.startRendering(),data=buffer.getChannelData(0);let peak=0,energy=0,lastAudible=0,clipped=0;
   for(let i=0;i<data.length;i++){const a=Math.abs(data[i]);peak=Math.max(peak,a);energy+=a*a;if(a>.00025)lastAudible=i/rate;if(a>=.999)clipped++;}
   const rmsWindows=[];for(let i=0;i<data.length;i+=rate*.01){let sum=0;for(let j=i;j<Math.min(i+rate*.01,data.length);j++)sum+=data[j]**2;rmsWindows.push(Math.sqrt(sum/(rate*.01)));}
   const pcm=new Int16Array(data.length);for(let i=0;i<data.length;i++)pcm[i]=Math.round(Math.max(-1,Math.min(1,data[i]))*32767);const bytes=new Uint8Array(pcm.buffer);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
   audio.dispose();return{type,scheduled,atStart,voiceShape,peak,rms:Math.sqrt(energy/data.length),lastAudible,clipped,rmsWindows,rate,pcm:btoa(binary)};
  },type);
  assert.equal(row.scheduled,true);assert.ok(row.rms>.005);assert.ok(row.peak>.03&&row.peak<1);assert.equal(row.clipped,0);assert.ok(row.atStart.activeVoices<=12);
  if(type==='coin'){assert.ok(row.voiceShape.every(v=>v.wave==='sine'));assert.ok(row.lastAudible<.2);}
  if(['hit','lose','smash','burst-impact'].includes(type)){assert.ok(row.voiceShape.some(v=>v.wave==='triangle'));assert.ok(row.voiceShape.some(v=>v.wave==='noise'));}
  if(type==='lose')assert.ok(row.lastAudible>.3&&row.lastAudible<.55,'Fatal sound must decay before the .60 second wipeout completes');
  const pcm=Buffer.from(row.pcm,'base64'),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(row.rate,24);header.writeUInt32LE(row.rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);delete row.pcm;
  row.wav=`${out}/cue-${type}.wav`;await fs.writeFile(row.wav,Buffer.concat([header,pcm]));report.rows.push(row);console.log(JSON.stringify({case:type,rms:row.rms,peak:row.peak,lastAudible:row.lastAudible,passed:true}));
 }
 assert.ok(report.rows.find(r=>r.type==='lose').lastAudible>report.rows.find(r=>r.type==='coin').lastAudible+.15);report.passed=true;
}finally{await fs.writeFile(`${out}/cue-waveforms.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
