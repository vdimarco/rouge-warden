// All wildlife motion is sampled in course space. Pausing, contact and both
// renderers therefore see the same pose without an independent animation clock.
import {MIN_LANE,MAX_LANE,CENTER_LANE} from './lanes.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=t=>t*t*(3-2*t);
export const TARGET_VALUE=200;
export const TARGET_CHARGE=10;
export const TARGET_LOCK_SECONDS=.4;
function sample(entity,distance){
 const motion=entity.motion;
 if(!motion||!Number.isFinite(motion.startD)||!Number.isFinite(motion.endD)||motion.endD<=motion.startD)return{lane:entity.lane,lift:0,progress:0,lateralSlope:0,liftSlope:0,leapProgress:0};
 const progress=clamp((distance-motion.startD)/(motion.endD-motion.startD),0,1);
 const active=distance>motion.startD&&distance<motion.endD;
 if(motion.kind==='weave'){
  const at=clamp(distance,motion.startD,motion.endD),angle=motion.phase+(at-motion.contactD)*Math.PI*2/motion.periodD;
  return{lane:distance===motion.contactD?motion.to:(motion.center??CENTER_LANE)+motion.amplitude*Math.sin(angle),lift:0,progress,lateralSlope:active?motion.amplitude*Math.cos(angle)*Math.PI*2/motion.periodD:0,liftSlope:0,leapProgress:0};
 }
 const u=smooth(progress),span=motion.endD-motion.startD;
 let lane=motion.from+(motion.to-motion.from)*u,lift=0,liftSlope=0,leapProgress=0;
 const lateralSlope=active?(motion.to-motion.from)*6*progress*(1-progress)/span:0;
 if(motion.kind==='swoop'){
  if(distance===motion.contactD)lane=motion.contactLane;
  const before=clamp((distance-motion.startD)/(motion.contactD-motion.startD),0,1);
  const after=clamp((distance-motion.contactD)/(motion.endD-motion.contactD),0,1);
  lift=distance<=motion.contactD?2.7*(1-smooth(before)):.9*smooth(after);
  liftSlope=distance>motion.startD&&distance<motion.contactD?-2.7*6*before*(1-before)/(motion.contactD-motion.startD):distance>motion.contactD&&distance<motion.endD?.9*6*after*(1-after)/(motion.endD-motion.contactD):0;
 }else if(motion.kind==='leap'){
  const leapSpan=motion.leapEndD-motion.leapStartD;
  leapProgress=clamp((distance-motion.leapStartD)/leapSpan,0,1);
  lift=.72*Math.sin(Math.PI*leapProgress)**2;
  liftSlope=distance>motion.leapStartD&&distance<motion.leapEndD?.72*Math.PI*Math.sin(Math.PI*2*leapProgress)/leapSpan:0;
 }
 return{lane,lift,progress,lateralSlope,liftSlope,leapProgress};
}
export function entityPose(entity,distance){
 const pose=sample(entity,distance);
 const contactD=Number.isFinite(entity.d)?entity.d:entity.motion?.contactD;
 return{...pose,contactLane:Number.isFinite(contactD)?sample(entity,contactD).lane:entity.lane};
}
export function entityLane(entity,distance){return sample(entity,distance).lane;}
export function encounterMotion(lane,distance,maxRushSpeed,kind,seed=0,mapIndex=0,channelLanes=null,launchLane=null){
 const min=channelLanes?.[0]??MIN_LANE,max=channelLanes?.at(-1)??MAX_LANE,center=(min+max)/2;
 const adjacent=lane===min?min+1:lane===max?max-1:lane+(seed&1?-1:1);
 if(kind==='crocodile'){
  const amplitude=(max-min)/2,periodD=maxRushSpeed*(1.15-.15*clamp(mapIndex,0,2)),basePhase=Math.asin((lane-center)/amplitude),phase=seed&1?Math.PI-basePhase:basePhase,startD=distance-maxRushSpeed*2.4;
  return Object.freeze({kind:'weave',center,from:center+amplitude*Math.sin(phase+(startD-distance)*Math.PI*2/periodD),to:lane,startD,endD:distance+maxRushSpeed*.45,contactD:distance,periodD,phase,amplitude});
 }
 if(kind==='bird'){
  const from=Number.isFinite(launchLane)?launchLane:channelLanes?(min<CENTER_LANE?min-.85:max+.85):seed&1?MIN_LANE-.85:MAX_LANE+.85,startD=distance-maxRushSpeed*1.9,endD=distance+maxRushSpeed*.18;
  const contactProgress=(distance-startD)/(endD-startD),to=from+(lane-from)/smooth(contactProgress);
  return Object.freeze({kind:'swoop',from,to,startD,endD,contactD:distance,contactLane:lane});
 }
 if(kind==='fish')return Object.freeze({kind:'leap',from:adjacent,to:lane,startD:distance-maxRushSpeed*1.7,endD:distance-maxRushSpeed*.25,contactD:distance,leapStartD:distance-maxRushSpeed*.8,leapEndD:distance+maxRushSpeed*.8});
 return Object.freeze({kind:'glide',from:adjacent,to:lane,startD:distance-maxRushSpeed,endD:distance-maxRushSpeed*TARGET_LOCK_SECONDS,contactD:distance});
}
// Separate deterministic cadence leaves the original route random stream intact.
export function encounterGap(seed,index,mapIndex){
 const mixed=(Math.imul((seed^Math.imul(index+1,0x45d9f3b))>>>0,0x27d4eb2d)>>>0);
 return 6-mapIndex+mixed%4;
}
