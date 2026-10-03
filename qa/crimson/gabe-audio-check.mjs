import {open,storyReady,step,freeRoam} from './lib.mjs';
const {browser,page,errors}=await open({query:'?chapter=i0&god&nomusic',width:640,height:360});
try {
  if (!(await storyReady(page,{maxSec:60})).ok) throw Error('Story failed to load');
  await freeRoam(page);
  await page.evaluate(()=>{
    const S=__crimson.story.S; window.audioEvents=[];
    S.audio={cue:n=>audioEvents.push(['cue',n]),loop:n=>{audioEvents.push(['loop',n]);return {stop:()=>audioEvents.push(['stop',n]),set(){}}},sfx(){},wind(){}};
    let done=false; S.film={active:true,play:()=>({get done(){return done},played:true}),skip(){done=true}};
    S.cine.play({id:'c0',arena:true,dur:2,film:{at:.1,src:'test'}});
  });
  await step(page,.4);
  await page.evaluate(()=>__crimson.story.S.cine.skip());
  await step(page,.2);
  const result=await page.evaluate(()=>({events:audioEvents,active:__crimson.story.S.cine.active}));
  for(const name of ['gabeMorph','creek','crickets']) if(!result.events.some(e=>e[0]==='loop'&&e[1]===name)||!result.events.some(e=>e[0]==='stop'&&e[1]===name))throw Error('Missing lifecycle '+name);
  if(result.active||!result.events.some(e=>e[0]==='cue'&&e[1]==='auto'))throw Error('Skip did not restore sound');
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: transformation and ambience start; skip stops all three loops and restores automatic music');
}finally{await browser.close()}
