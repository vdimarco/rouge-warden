import {LANES} from './lanes.js';
// Gold names an actual safe pocket, low passage or attainable cutback. It no
// longer paints a changing geometric carpet across every available lane.
export const GROUND_COIN_PATTERNS=Object.freeze(['shelter','low-passage','landing-pocket','cutback']);
export function groundCoinLayout({seed,row,lane,clearLanes=LANES,index=0,recovery=false,allowCarve=false,guardType=null}){
 const point=(at,offset)=>({lane:at,offset,primaryRoute:true});
 if(guardType==='branch')return{pattern:'low-passage',endLane:lane,advance:true,coins:[point(lane,-.035),point(lane,.055)]};
 const neighbor=clearLanes.find(at=>Math.abs(at-lane)===1);
 if(recovery&&allowCarve&&neighbor!==undefined&&((seed^row)&3)===0)return{pattern:'cutback',endLane:neighbor,advance:true,coins:[point(lane,-.16),point(neighbor,.16)]};
 // Quiet recoveries have a landing pocket; guarded/slalom water has a single
 // clue at its clean opening. Optional treasure encounters supply the prize.
 if(recovery)return{pattern:'landing-pocket',endLane:lane,advance:true,coins:[point(lane,-.045),point(lane,.055)]};
 return{pattern:'shelter',endLane:lane,advance:true,coins:[point(lane,.04)]};
}
