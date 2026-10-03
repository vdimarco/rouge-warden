import {open,storyReady,freeRoam,step} from './lib.mjs';
const touch=!!process.env.CRIMSON_TOUCH;
const {browser,page,errors}=await open({touch,query:'?chapter=i0&god&nomusic&q=2',width:touch?740:960,height:touch?390:540,autoplay:'user-gesture-required'});
try {
  if(!(await storyReady(page,{maxSec:60})).ok)throw Error('Story not ready');
  await freeRoam(page);
  await page.evaluate(()=>{const S=__crimson.story.S;S.ctx.Audio.ctx.suspend();S.cine.play('i0');});
  await step(page,.1);
  await page.waitForSelector('#cineSoundStart');
  await page.screenshot({path:'/tmp/crimson-sound-gate.png'});
  await page.click('#cineSoundStart');
  await page.waitForFunction(()=>__crimson.story.S.test.audio.cinematicReady&&!document.querySelector('#cineSoundStart'));
  await step(page,.1);
  const score=await page.evaluate(async()=>{
    const S=__crimson.story.S,A=S.ctx.Audio,source=S.test.audio.scoreSource;
    if(!source)throw Error('Score did not start');
    const a=A.ctx.createAnalyser();source.connect(a);const d=new Float32Array(a.fftSize);
    let peak=0;for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,50));a.getFloatTimeDomainData(d);peak=Math.max(peak,Math.sqrt(d.reduce((s,x)=>s+x*x,0)/d.length));}source.disconnect(a);return peak;
  });
  if(score<.005)throw Error('Silent score '+score);
  await step(page,2.5);
  const voice=await page.evaluate(async()=>{
    const S=__crimson.story.S,A=S.ctx.Audio,v=S.audio.voice;if(!v?.source)throw Error('No recorded voice');
    const a=A.ctx.createAnalyser();v.source.connect(a);const d=new Float32Array(a.fftSize);let peak=0,moved=0,count=0;
    for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,50));__crimson.step(1/60,false);a.getFloatTimeDomainData(d);peak=Math.max(peak,Math.sqrt(d.reduce((s,x)=>s+x*x,0)/d.length));
      const actor=S.cast.get(v.who);if(actor){const M=S.cast.talk.mouthOf(actor);count=M.affected.length;for(const x of M.affected)moved=Math.max(moved,Math.abs(M.geometry.attributes.position.getY(x.i)-M.base[x.i*3+1]));}}
    v.source.disconnect(a);const actor=S.cast.get(v.who),M=S.cast.talk.mouthOf(actor),p=M.geometry.attributes.position;let maxDisplacement=0;for(let i=0;i<p.count;i++)maxDisplacement=Math.max(maxDisplacement,Math.hypot(p.getX(i)-M.base[i*3],p.getY(i)-M.base[i*3+1],p.getZ(i)-M.base[i*3+2]));if(maxDisplacement>.03)throw Error('Face vertices spiked '+maxDisplacement);return {text:v.text,peak,moved,count,maxDisplacement,duration:v.duration};
  });
  if(voice.peak<.005||voice.moved<=0||voice.count<=0)throw Error('Voice or facial deformation failed '+JSON.stringify(voice));
  await page.evaluate(()=>{__crimson.step(0,true)});
  await page.screenshot({path:'/tmp/crimson-voice-face.png'});
  await page.evaluate(()=>__crimson.story.S.cine.skip());await step(page,.1);
  const end=await page.evaluate(()=>({active:__crimson.story.S.cine.active,score:!!__crimson.story.S.test.audio.scoreSource,voice:!!__crimson.story.S.audio.voice,gate:!!document.querySelector('#cineSoundStart')}));
  if(Object.values(end).some(Boolean))throw Error('Skip left sound running '+JSON.stringify(end));
  // A long recording must survive a camera timeline with a short line slot.
  await page.evaluate(()=>{const S=__crimson.story.S;S.cine.play({id:'voice-test',dur:1,lines:[{at:0,line:'i0.why'},{at:.3,line:'i0.three'}]});});
  await page.waitForTimeout(50);await step(page,.1);
  const long=await page.evaluate(()=>({text:__crimson.story.S.audio.voice?.text,duration:__crimson.story.S.audio.voice?.duration}));
  await step(page,.5);
  // Compare directly, keeping the recording's real clock independent of simulation time.
  if(await page.evaluate(t=>__crimson.story.S.audio.voice?.text!==t,long.text))throw Error('Next line cut off long recording');
  await page.waitForTimeout(Math.ceil(long.duration*1000));await step(page,.25);
  if(await page.evaluate(t=>__crimson.story.S.audio.voice?.text===t,long.text))throw Error('Timeline did not advance after recording');
  await page.evaluate(()=>__crimson.story.S.cine.skip());await step(page,.1);
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify({pass:true,scoreRms:score,voice,skip:end}));
}finally{await browser.close();}
