import {LANES} from './lanes.js';
export const GROUND_COIN_PATTERNS=Object.freeze(['split','fork','offbeat','staggered','sweep']);
// Offsets are maximum-Rush seconds. Integer lanes keep every alternative
// collectible; primaryRoute distinguishes a reachable route from split choices.
export function groundCoinLayout({seed,row,lane,clearLanes=LANES,unvisitedLanes=[],index=0,recovery=false,allowCarve=false}){
 const point=(at,offset,primaryRoute=true)=>({lane:at,offset,primaryRoute});
 const clear=[...new Set(clearLanes)].sort((a,b)=>Math.abs(a-lane)-Math.abs(b-lane)||a-b),other=clear.filter(at=>at!==lane);
 if(!clear.includes(lane)||!other.length)return{pattern:'ribbon',endLane:lane,advance:false,coins:[-.08,-.04,0,.04,.08,.12].map(offset=>point(lane,offset))};
 let pattern=GROUND_COIN_PATTERNS[((seed>>>8)+index)%GROUND_COIN_PATTERNS.length];
 const side=other.find(at=>unvisitedLanes.includes(at))??other[(Math.imul(seed^row,0x45d9f3b)>>>0)%Math.min(2,other.length)],neighbor=other.find(at=>Math.abs(at-lane)===1);
 const core=[-.12,-.04,.04,.12].map(offset=>point(lane,offset));
 if(pattern==='sweep'&&recovery&&allowCarve&&neighbor!==undefined)return{pattern,endLane:neighbor,advance:true,coins:[point(lane,-.20),point(lane,-.14),point(neighbor,.10),point(neighbor,.16)]};
 if(pattern==='sweep')pattern='staggered';
 let alternatives;
 if(pattern==='split')alternatives=[-.12,-.04,.04,.12].map(offset=>point(side,offset,false));
 else if(pattern==='fork')alternatives=[point(side,0,false),...(other.length>1?[point(other.find(at=>at!==side),0,false)]:[point(side,.08,false)])];
 else if(pattern==='offbeat')alternatives=[point(side,-.10,false),point(side,.03,false),point(side,.10,false)];
 else alternatives=[point(side,-.08,false),point(side,.08,false),...(other.length>1?[point(other.find(at=>at!==side),0,false)]:[])];
 return{pattern,endLane:lane,advance:true,coins:[...core,...alternatives].sort((a,b)=>a.offset-b.offset||a.lane-b.lane)};
}
