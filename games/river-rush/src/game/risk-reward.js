import {LANES,CENTER_LANE} from './lanes.js';

export const ORDINARY_COIN_VALUE=10;
export const GUARDED_COIN_VALUE=20;
export const SAFE_COIN_OFFSETS=Object.freeze([-.055,.055]);
export const GUARDED_DUCK_OFFSETS=Object.freeze([-.12,0,.07]);
const hash=(seed,row)=>Math.imul((seed^Math.imul(row+1,0x45d9f3b))>>>0,0x27d4eb2d)>>>0;

// A choice is authored from the real, already-shaped hazards. No new action
// walls or hidden collisions are inserted to manufacture its advertised risk.
export function chooseGuardedRoute({seed,row,levelIndex,intensity,previousLane=CENTER_LANE,
 safe,coinLane,hazards,recovery,terrain,lastDecisionRow=-99,touches}){
 if(row<7||hazards.some(h=>h.fullRiver)||row-lastDecisionRow<5
   ||terrain.type==='wave-train'&&terrain.comboAvailable&&terrain.phase==='active')return null;
 if(recovery&&!hazards.some(h=>h.enemy))return null;
 const clear=LANES.filter(lane=>Math.abs(lane-previousLane)<=1&&!hazards.some(h=>touches(h,lane)));
 if(!clear.length)return null;
 const safeLane=clear.sort((a,b)=>Math.abs(a-coinLane)-Math.abs(b-coinLane)||Math.abs(a-safe)-Math.abs(b-safe))[0];
 const later=levelIndex>0||intensity>=.55,maxWidth=later?2:1,mixed=hash(seed,row);
 const candidates=hazards.filter(h=>['log','branch'].includes(h.type)).flatMap(guard=>LANES
  .filter(lane=>touches(guard,lane)&&Math.abs(lane-safeLane)<=maxWidth&&Math.abs(lane-previousLane)<=3
    &&!hazards.some(other=>other!==guard&&touches(other,lane)))
  .map(lane=>({guard,lane,width:Math.abs(lane-safeLane)})));
 if(!candidates.length)return null;
 // Late forks favor a real extra lane of exposure; seed and action variation
 // retain close decisions too, rather than teaching one permanent best route.
 const desiredWidth=later&&mixed%4!==0?2:1,desiredAction=mixed&1?'branch':'log';
 candidates.sort((a,b)=>Math.abs(a.width-desiredWidth)-Math.abs(b.width-desiredWidth)
  ||Number(a.guard.type!==desiredAction)-Number(b.guard.type!==desiredAction)
  ||((a.lane+(mixed>>>4))%5)-((b.lane+(mixed>>>4))%5));
 const {guard,lane:riskLane,width}=candidates[0];
 return {safeLane,riskLane,entryLane:previousLane,action:guard.type==='log'?'jump':'duck',enemy:guard.enemy??null,
  safeBasePoints:SAFE_COIN_OFFSETS.length*ORDINARY_COIN_VALUE,riskBasePoints:(guard.type==='log'?5:GUARDED_DUCK_OFFSETS.length)*GUARDED_COIN_VALUE,
  skillBasePoints:100,variant:width>1?'deep-fork':'guarded-fork',entryWidth:Math.abs(riskLane-previousLane),
  // Spacing is in maximum future Rush seconds, including a newly earned boost.
  returnSeconds:later?.98:1.10};
}

export function linkDecisionExit(decision,coin){
 if(!decision||!coin)return;
 decision.exitLane=coin.lane;decision.exitD=coin.d;
 decision.exitWidth=Math.abs(decision.riskLane-coin.lane);
 if(decision.exitWidth>1)decision.variant='deep-cutback';
 else if(decision.exitWidth===1&&decision.variant!=='deep-fork')decision.variant='cutback';
}
