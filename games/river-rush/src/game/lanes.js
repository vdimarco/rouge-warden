// Physical lane indices and world spacing are shared by simulation and views.
export const LANE_COUNT=5;
export const MIN_LANE=0;
export const MAX_LANE=LANE_COUNT-1;
export const CENTER_LANE=(MIN_LANE+MAX_LANE)/2;
export const LANES=Object.freeze(Array.from({length:LANE_COUNT},(_,lane)=>lane));
export const LANE_SPACING=3.8;
export const PLAYABLE_WIDTH=LANE_COUNT*LANE_SPACING;
export const PLAYABLE_HALF_WIDTH=PLAYABLE_WIDTH/2;
export const RIVER_WIDTH_EXPANSION=(LANE_COUNT-3)*LANE_SPACING/2;
export const laneToX=lane=>(lane-CENTER_LANE)*LANE_SPACING;
export const xToLane=x=>x/LANE_SPACING+CENTER_LANE;
export const clampLane=lane=>Math.max(MIN_LANE,Math.min(MAX_LANE,lane));
