// One normalized arc for the rider, generated gold and physical pickup checks.
export const JUMP_ARC_SECONDS=.66;
export const JUMP_REWARD_LEAD=.31;
export const JUMP_REWARD_OFFSETS=Object.freeze([-.08,-.04,0,.04,.08]);
export const COIN_ARC_HEIGHT_RADIUS=.37;
export function jumpArcHeight(time){
 const p=Math.max(0,Math.min(1,Number.isFinite(time)?time/JUMP_ARC_SECONDS:0));
 return 4*p*(1-p);
}
export function coinJumpHeight(entity){
 return Number.isFinite(entity?.jumpHeight)?Math.max(0,Math.min(1,entity.jumpHeight)):null;
}
