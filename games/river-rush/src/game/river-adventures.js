// A fork is a remembered episode, with one climax in each stream. Geometry is
// stateless; this small packet stores only earned progress while it is nearby.
export const TREASURE_BASE=200;
export const TREASURE_CLEAN_BONUS=400;
export const STASH_VALUES=Object.freeze({'wildlife-bank':120,'boulder-snatch':120,'landing-detour':200});
export const ADVENTURE_PHRASES=Object.freeze(['iio','oii','ioo','ooi']);
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
 const themeIndex=['crocodile-run','canopy-cut','rapids-gates'].indexOf(fork.theme),ordinal=fork.ordinal??fork.id;
 let phraseIndex=((ordinal+themeIndex+levelIndex)%4+4)%4;
 // Canopy's detour returns to the actual single bird. The final full-width
 // tree cannot honestly demand a lateral return for a clean action.
 if(fork.theme==='canopy-cut')phraseIndex=phraseIndex&1?3:0;
 const phrase=ADVENTURE_PHRASES[phraseIndex],safePhrase=ADVENTURE_PHRASES[(phraseIndex+2)%4];
 const laneFor=(letter,side)=>letter==='i'?innerStreamLane(side):outerStreamLane(side);
 const guardId=step=>`guard-${levelIndex}-${fork.id}-${step}`;
 const nodes=beats.map((d,step)=>({kind:'beat',step,d,guardId:guardId(step),riskLane:laneFor(phrase[step],fork.riskSide),safeLane:laneFor(safePhrase[step],fork.safeSide),guard:actions[step]}));
 const choices=[];
 const choice=(family,step,side,entryLane,alternativeLane,exitLane,choiceD,guardD,exitD,action,extra={})=>{
  const id=`choice-${levelIndex}-${fork.id}-${family}`,value=STASH_VALUES[family],role=side===fork.riskSide?'risk':'safe';
  const packet={id,family,step,routeSide:side,routeRole:role,entryLane,alternativeLane,exitLane,choiceD,guardD,exitD,action,baseValue:value,
    guardId:guardId(step),returnSeconds:(exitD-choiceD)/maxRushSpeed,collected:false,earned:0,...extra};
  choices.push(packet);nodes.push({kind:'stash',step,side,d:choiceD,lane:alternativeLane,value,choiceId:id,choiceFamily:family,choiceRole:family==='wildlife-bank'?'bank':family==='boulder-snatch'?'snatch':'detour'});
 };
 const wildlife=nodes.filter(node=>['crocodile','fish','bird'].includes(node.guard)),bank=wildlife[(ordinal+levelIndex)%wildlife.length];
 const afterBank=nodes.find(node=>node.kind==='beat'&&node.step===bank.step+1);
 choice('wildlife-bank',bank.step,fork.riskSide,bank.riskLane,streamLanes(fork.riskSide).find(lane=>lane!==bank.riskLane),afterBank?.riskLane??outerStreamLane(fork.riskSide),bank.d,bank.d,afterBank?.d??cacheD,bank.guard==='bird'?'duck':'jump',
  {actionBasePoints:100+(bank.guard==='bird'?2:3)*20});
 const pair=nodes.find(node=>node.kind==='beat'&&node.step<2&&node.riskLane===nodes.find(next=>next.kind==='beat'&&next.step===node.step+1)?.riskLane);
 const next=nodes.find(node=>node.kind==='beat'&&node.step===pair.step+1),detourD=pair.d+maxRushSpeed*.50;
 // At least .46 future-Rush seconds to impact, including a realistic delayed
 // cutback. Jump launch can overlap the lateral return; it is not a teleport.
 if(next.d-detourD>=maxRushSpeed*.42){
  choice('landing-detour',next.step,fork.riskSide,pair.riskLane,streamLanes(fork.riskSide).find(lane=>lane!==pair.riskLane),next.riskLane,detourD,next.d,next.d,next.guard==='bird'||next.guard==='branch'?'duck':'jump',
   {sourceGuardId:pair.guardId,sourceGuardD:pair.d,sourceStep:pair.step,actionBasePoints:0});
 }
 const snatchStep=safePhrase[0]===safePhrase[1]?1:2,snatch=nodes.find(node=>node.kind==='beat'&&node.step===snatchStep);
 choice('boulder-snatch',snatchStep,fork.safeSide,snatch.safeLane,streamLanes(fork.safeSide).find(lane=>lane!==snatch.safeLane),snatch.safeLane,snatch.d-maxRushSpeed*.54,snatch.d,snatch.d,'dodge',{actionBasePoints:0,guardId:`rock-${levelIndex}-${fork.id}-${snatchStep}`});
 for(const side of [-1,1])nodes.push({kind:'treasure',side,d:cacheD,lane:outerStreamLane(side)});
 nodes.sort((a,b)=>a.d-b.d);
 return{id:fork.id,name:ADVENTURE_NAMES[fork.theme],theme:fork.theme,start:fork.start,splitStart:fork.splitStart,splitEnd:fork.splitEnd,end:fork.end,
  riskSide:fork.riskSide,safeSide:fork.safeSide,levelIndex,phrase,safePhrase,choices,nodes,nextNode:0,left:route(-1),right:route(1)};
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
