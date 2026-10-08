// Branch wood, warnings and contact share one contiguous river-lane span.
// Legacy isolated fixtures retain their single lane; wildlife is never a tree.
import {MIN_LANE,MAX_LANE} from './lanes.js';
export const isBranchSpan=entity=>entity.type==='branch'&&!entity.enemy;
export const BRANCH_LANE_RADIUS=.68;
export function branchLanes(entity){
 if(!isBranchSpan(entity)||!Array.isArray(entity.branchLanes))return[entity.lane];
 const lanes=[...new Set(entity.branchLanes)].sort((a,b)=>a-b);
 if(!lanes.length||lanes.length>3||lanes.some((lane,index)=>!Number.isInteger(lane)||lane<MIN_LANE||lane>MAX_LANE||index>0&&lane!==lanes[index-1]+1))return[entity.lane];
 return lanes;
}
export function branchSpan(entity){
 const lanes=branchLanes(entity),minLane=lanes[0],maxLane=lanes.at(-1);
 const side=minLane===MIN_LANE&&maxLane<MAX_LANE?-1:maxLane===MAX_LANE&&minLane>MIN_LANE?1:entity.branchSide===-1||entity.branchSide===1?entity.branchSide:(entity.id??entity.row??0)&1?-1:1;
 return{lanes,width:lanes.length,minLane,maxLane,centerLane:(minLane+maxLane)/2,side};
}
export function branchOverlap(entity,physicalLane,radius=BRANCH_LANE_RADIUS){
 const {minLane,maxLane}=branchSpan(entity);
 return Number.isFinite(physicalLane)&&physicalLane>=minLane-radius&&physicalLane<=maxLane+radius;
}
