// A fork is a remembered episode, with one climax in each stream. Geometry is
// stateless; this small packet stores only earned progress while it is nearby.
export const TREASURE_BASE=200;
export const TREASURE_CLEAN_BONUS=400;
export const ADVENTURE_NAMES=Object.freeze({'crocodile-run':'Crocodile Run','canopy-cut':'Canopy Cut','rapids-gates':'Rapids Gates'});
export const streamLanes=side=>side<0?[0,1]:[3,4];
export const innerStreamLane=side=>side<0?1:3;
export const outerStreamLane=side=>side<0?0:4;
export function createAdventure(fork,maxRushSpeed,levelIndex){
 const first=fork.splitStart+12,last=fork.splitEnd-maxRushSpeed*.98;
 // The fixed three beats have at least .96 s even at future maximum Rush.
 const gap=Math.max(maxRushSpeed*.96,(last-first)/2);
 const beats=[first,first+gap,first+gap*2];
 const cacheD=beats[2]+maxRushSpeed*.92;
 const route=side=>({side,role:side===fork.riskSide?'risk':'safe',name:side===fork.riskSide?ADVENTURE_NAMES[fork.theme]:'Sheltered Stream',
  basePoints:TREASURE_BASE,maxPoints:TREASURE_BASE+(side===fork.riskSide?TREASURE_CLEAN_BONUS:0),cleanClears:0,totalClears:side===fork.riskSide?3:0,
  cleanEligible:true,clearedSteps:[],passedSteps:[],cacheLane:outerStreamLane(side),cacheD,collected:false,earned:0});
 const actions=fork.theme==='crocodile-run'?['crocodile','fish','bird']:fork.theme==='canopy-cut'?['branch','bird','branch']:['log','bird','fish'];
 const nodes=[];
 for(let step=0;step<3;step++)nodes.push({kind:'beat',step,d:beats[step],riskLane:step%2?outerStreamLane(fork.riskSide):innerStreamLane(fork.riskSide),safeLane:step%2?outerStreamLane(fork.safeSide):innerStreamLane(fork.safeSide),guard:actions[step]});
 for(const side of [-1,1])nodes.push({kind:'treasure',side,d:cacheD,lane:outerStreamLane(side)});
 nodes.sort((a,b)=>a.d-b.d);
 return{id:fork.id,name:ADVENTURE_NAMES[fork.theme],theme:fork.theme,start:fork.start,splitStart:fork.splitStart,splitEnd:fork.splitEnd,end:fork.end,
  riskSide:fork.riskSide,safeSide:fork.safeSide,levelIndex,nodes,nextNode:0,left:route(-1),right:route(1)};
}
export const adventureRoute=(packet,side)=>side<0?packet.left:packet.right;
export function recordAdventureClear(packet,side,step){
 if(!packet)return;
 const route=adventureRoute(packet,side);
 if(!route.clearedSteps.includes(step))route.clearedSteps.push(step);
 route.cleanClears=route.clearedSteps.length;
}
export function finishAdventureStep(packet,side,step){
 if(!packet)return;
 const route=adventureRoute(packet,side);
 if(!route.passedSteps.includes(step))route.passedSteps.push(step);
 if(!route.clearedSteps.includes(step))route.cleanEligible=false;
}
export function treasurePayout(packet,entity){
 const route=packet?adventureRoute(packet,entity.routeSide):null;
 const clean=!!route&&route.cleanEligible&&route.cleanClears===entity.requiredClears;
 return{value:entity.treasureBase+(clean?entity.treasureCleanBonus:0),clean,clears:route?.cleanClears??0};
}
