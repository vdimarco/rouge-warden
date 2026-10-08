// Motion lives in course space, so paused simulation and both renderers agree.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const TARGET_VALUE=200;
export const TARGET_CHARGE=10;
export const ENEMY_LOCK_SECONDS=1;
export const TARGET_LOCK_SECONDS=.4;
export function entityLane(entity,distance){
 const motion=entity.motion;
 if(!motion||!Number.isFinite(motion.startD)||!Number.isFinite(motion.endD)||motion.endD<=motion.startD)return entity.lane;
 const t=clamp((distance-motion.startD)/(motion.endD-motion.startD),0,1),u=t*t*(3-2*t);
 return motion.from+(motion.to-motion.from)*u;
}
export function encounterMotion(lane,distance,maxRushSpeed,kind,seed=0){
 const from=lane===0?1:lane===2?1:(seed&1?0:2);
 const lock=kind==='target'?TARGET_LOCK_SECONDS:ENEMY_LOCK_SECONDS;
 return Object.freeze({from,to:lane,startD:distance-maxRushSpeed*(kind==='target'?1:1.5),endD:distance-maxRushSpeed*lock});
}
// Separate deterministic cadence leaves the original route random stream intact.
export function encounterGap(seed,index,mapIndex){
 const mixed=(Math.imul((seed^Math.imul(index+1,0x45d9f3b))>>>0,0x27d4eb2d)>>>0);
 return 6-mapIndex+mixed%4;
}
