import { spellShape, spellPlacement, placementRange, canReturn } from './combat-rules.js';
import { castTarget } from './sim.js';
import { SIZE, clamp, distance, lineOfSight, resolveBody } from './world.js';

// A full thumb drag reaches the spell's range. Short drags place ground spells nearby.
export const AIM_DRAG_RANGE = 96;
export function skillAimRange(e,slot) {
  if(e.hero===2&&[1,2].includes(slot)||e.hero===6&&slot===2||e.hero===10&&[0,1,2].includes(slot)||e.hero===12&&slot===3||e.hero===14&&slot===2||e.hero===15&&slot===0)return placementRange(e,slot);
  if([0,8].includes(e.hero)&&slot===2)return 540;
  if(slot===0){
    if(e.hero<4)return [490,410,330,460][e.hero]+Math.max(0,e.skillRanks[slot]-1)*25;
    if(e.hero===6)return 430+Math.max(0,e.skillRanks[slot]-1)*25;
    if([7,8,9].includes(e.hero))return e.hero===9?570:460;
    if([13,14].includes(e.hero))return (e.hero===13?380:340)+Math.max(0,e.skillRanks[slot]-1)*25;
  }
  return spellShape(e,slot,{x:1,y:0}).radius||0;
}

export function cursorSkillAim(e,slot,point) {
  if(!point)return null;
  const x=point.x-e.x,y=point.y-e.y;
  return {x,y,distance:Math.min(Math.hypot(x,y),skillAimRange(e,slot))};
}

export function dragSkillAim(e,slot,drag,screenDirection) {
  if(!drag)return null;
  const direction=screenDirection(drag.x,drag.y);
  return {...direction,distance:skillAimRange(e,slot)*Math.min(1,Math.hypot(drag.x,drag.y)/AIM_DRAG_RANGE)};
}

export function skillAimPreview(s,e,slot,aim) {
  if(!aim)return null;
  const angle=Math.hypot(aim.x,aim.y)>.1?Math.atan2(aim.y,aim.x):e.facing;
  let shape=spellShape(e,slot,aim);
  if(slot===0&&canReturn(s,e))shape={shape:'path',x:e.x,y:e.y,tx:e.returnAnchor.x,ty:e.returnAnchor.y,radius:20};
  else if(slot===0&&(e.hero<4||[6,7,8,9,13,14].includes(e.hero))){
    const length=skillAimRange(e,slot),end={x:clamp(e.x+Math.cos(angle)*length,180,SIZE-180),y:clamp(e.y+Math.sin(angle)*length,180,SIZE-180),radius:e.radius};
    resolveBody(s,end);
    const points=e.hero===9?Array.from({length:17},(_,i)=>{const progress=i/16,curve=Math.sin(progress*Math.PI)*150;return {x:clamp(e.x+Math.cos(angle)*length*progress-Math.sin(angle)*curve,180,SIZE-180),y:clamp(e.y+Math.sin(angle)*length*progress+Math.cos(angle)*curve,180,SIZE-180)};}):undefined;
    shape={shape:'path',x:e.x,y:e.y,tx:end.x,ty:end.y,radius:e.hero===3?160:[7,8,9].includes(e.hero)?110:20,points};
  }
  else if(e.hero===12&&slot===3||e.hero===14&&slot===2||e.hero===15&&slot===0){const point=spellPlacement(e,slot,aim);shape={shape:'circle',x:point.x,y:point.y,radius:e.hero===12?380:e.hero===14?180:220};}
  else if(e.hero===2&&[1,2].includes(slot)||e.hero===6&&slot===2||e.hero===10&&[0,1].includes(slot)){
    const point={...spellPlacement(e,slot,aim),radius:e.hero===10&&slot===0?24:20};
    if(e.hero===2&&slot===1||e.hero===10&&slot===0)resolveBody(s,point);
    shape={shape:'circle',x:point.x,y:point.y,radius:e.hero===2&&slot===1?145:e.hero===10&&slot===0?310:190};
  }
  else if([0,8].includes(e.hero)&&slot===2){
    const target=castTarget(s,e,slot,aim),point=target||{x:e.x+Math.cos(angle)*aim.distance,y:e.y+Math.sin(angle)*aim.distance};
    shape={shape:'circle',x:point.x,y:point.y,radius:target?target.radius+20:35,targetId:target?.id,valid:!!target};
  }
  else if(e.hero===10&&slot===2){
    const point=spellPlacement(e,slot,aim),target=s.units.filter(t=>t.kind==='hero'&&t.team===e.team&&t.hp>0&&distance(e,t)<500&&lineOfSight(s,e,t)).sort((a,b)=>distance(a,point)-distance(b,point)||a.id-b.id)[0];
    shape={shape:'circle',x:target?.x??point.x,y:target?.y??point.y,radius:target?target.radius+20:35,targetId:target?.id,valid:!!target};
  }
  else if(slot===0&&![12,15].includes(e.hero)){shape={shape:'circle',x:e.x,y:e.y,radius:e.hero===4?290:e.radius+25};}
  else if(slot===2&&e.hero===7||slot===3&&[3,9].includes(e.hero)||[13].includes(e.hero)&&[1,2].includes(slot)){shape={shape:'circle',x:e.x,y:e.y,radius:e.radius+25};}
  const endpoint=shape.shape==='path'?{x:shape.tx,y:shape.ty}:shape.x!==e.x||shape.y!==e.y?shape:null;
  return {...aim,slot,shape,...endpoint?{x:endpoint.x-e.x,y:endpoint.y-e.y,distance:distance(e,endpoint)}:{}};
}
