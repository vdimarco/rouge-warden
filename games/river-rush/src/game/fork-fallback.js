import {LANE_SPACING,PLAYABLE_WIDTH,PLAYABLE_HALF_WIDTH,laneToX} from './lanes.js';
import {riverHalfWidth,riverHash} from './river-course.js';
import {riverFork,forkLaneCross,nextRiverFork,islandHeight} from './river-forks.js';
import {levelAt} from './levels.js';
import {currentDistance} from './hydrodynamics.js';

const TAU=Math.PI*2;
const patternCache=new WeakMap();
const profileOf=g=>g?.terrainProfile;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const t=clamp(n,0,1);return t*t*(3-2*t);};

// Preview the whole fork, then ride close inside the chosen stream. This keeps
// the rider at its accepted size instead of shrinking it for a long median.
export function fallbackCamera(g){
 const profile=profileOf(g);if(!profile?.length)return{width:PLAYABLE_WIDTH,cross:0,commit:0};
 const a=riverFork(g.distance,profile),b=riverFork(g.distance+42,profile);
 const fan=Math.max(a?.fanOffset??0,b?.fanOffset??0),strength=Math.max(a?.strength??0,b?.strength??0);
 const selection=clamp(((g.visualLane??2)-2)/.75,-1,1),side=selection<0?-1:1;
 const commit=smooth(((a?.strength??0)-.12)/.5)*smooth(Math.abs(selection));
 const channel=a?.channels.find(value=>value.side===side),cross=(channel?.center??0)*commit;
 return{width:PLAYABLE_WIDTH+(fan*2+strength*4)*(1-commit),cross,commit};
}
export function fallbackFrameWidth(g){return fallbackCamera(g).width;}
export function projectPhysical(width,height,cross,z,g){
 const horizon=height*.29,foot=height*(height<500?.73:width/height<.85?.77:.8);
 const corridor=Math.min(width*.94,height*1.17),scale=1/(1+Math.max(-14,z)/29);
 const camera=fallbackCamera(g),unit=corridor/camera.width*scale;
 return{x:width/2+(cross-camera.cross)*unit,y:horizon+(foot-horizon)*scale,scale,corridor,laneSpacing:LANE_SPACING*unit,unit,foot,horizon};
}
export function projectLane(width,height,lane,z,g){
 const cross=profileOf(g)?.length?forkLaneCross(lane,g.distance+z,profileOf(g)):laneToX(lane);
 return projectPhysical(width,height,cross,z,g);
}
// Keep the approved painted normal banks. Only island approaches widen to the
// physical outer shoreline; entry and exit use the topology's smooth envelope.
export function fallbackShoreHalfWidth(course,profile){
 const fork=riverFork(course,profile),width=riverHalfWidth(course,profile);
 const ordinary=Math.max(PLAYABLE_HALF_WIDTH+1.1,(width-(fork?.fanOffset??0))*.5);
 return ordinary+(width-ordinary)*(fork?.strength??0);
}

export function forkFallbackGeometry(g,width,height,view=245){
 const profile=profileOf(g);if(!profile?.length)return[];
 const result=[],first=g.distance-14,last=g.distance+view;
 let next=nextRiverFork(first,profile);
 for(let slot=0;next&&next.start<=last&&slot<3;slot++){
  const near=Math.max(first,next.start),far=Math.min(last,next.end),nearScale=1/(1+(near-g.distance)/29),farScale=1/(1+(far-g.distance)/29);
  const sides={outerLeft:[],innerLeft:[],innerRight:[],outerRight:[]};
  for(let i=0;i<=32;i++){
   const scale=farScale+(nearScale-farScale)*i/32,course=g.distance+29*(1/scale-1),fork=riverFork(Math.max(next.start,Math.min(next.end,course)),profile);
   const half=fallbackShoreHalfWidth(course,profile),crosses=[-half,fork.islandCenter-fork.islandHalfWidth,fork.islandCenter+fork.islandHalfWidth,half];
   for(const [index,key] of ['outerLeft','innerLeft','innerRight','outerRight'].entries())sides[key].push({...projectPhysical(width,height,crosses[index],course-g.distance,g),course,cross:crosses[index]});
  }
  result.push({...next,near,far,...sides});
  next=nextRiverFork(next.end+.001,profile);
 }
 return result.reverse();
}
function pathBetween(ctx,left,right){
 ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);for(let i=1;i<left.length;i++)ctx.lineTo(left[i].x,left[i].y);
 for(let i=right.length-1;i>=0;i--)ctx.lineTo(right[i].x,right[i].y);ctx.closePath();
}
function islandPlant(ctx,x,y,size,variant,moon){
 ctx.save();ctx.translate(x,y);ctx.scale(size,size);
 if(variant===0){
  // Crooked rooted sapling with independent branching fronds.
  ctx.strokeStyle=moon?'#6b6880':'#62563b';ctx.lineCap='round';ctx.lineWidth=.085;
  ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-.13,-.48,.18,-.7,.03,-1.25);ctx.stroke();
  for(let i=0;i<5;i++){
   const side=i%2?-1:1,y=-.45-i*.14;
   ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(.02,y);ctx.quadraticCurveTo(side*.28,y-.22,side*.48,y-.12);ctx.stroke();
   ctx.fillStyle=moon?'#647c70':i%2?'#709749':'#3d713b';ctx.beginPath();ctx.ellipse(side*.34,y-.15,.29,.105,side*.25,0,TAU);ctx.fill();
  }
 }else{
  ctx.fillStyle=moon?'#7c8895':'#aaa382';ctx.beginPath();ctx.moveTo(-.44,0);ctx.lineTo(-.3,-.42);ctx.lineTo(.02,-.54);ctx.lineTo(.4,-.32);ctx.lineTo(.5,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=moon?'#525d73':'#69794f';ctx.beginPath();ctx.moveTo(-.3,-.42);ctx.lineTo(.02,-.54);ctx.lineTo(.13,-.27);ctx.lineTo(-.13,-.21);ctx.closePath();ctx.fill();
  ctx.fillStyle=moon?'#9ba5ac':'#c6bf98';ctx.beginPath();ctx.moveTo(.02,-.54);ctx.lineTo(.4,-.32);ctx.lineTo(.13,-.27);ctx.closePath();ctx.fill();
 }
 ctx.restore();
}

// Normal and fork water use one screen-registered surface and flow phase. The
// channel clip changes the geography without painting a new colored rectangle
// at the island nose or confluence. Land is painted separately and stays solid.
export function drawFallbackWaterSurface(ctx,g,art,width,height,reducedMotion=false){
 const level=levelAt(g.levelIndex);
 if(level.index===0){
  const source=(width/height<.85?art.portrait:art.environment)??art.surfacewater;
  ctx.drawImage(source,0,0,width,height);return;
 }
 let patterns=patternCache.get(ctx);if(!patterns){patterns={ground:[],water:[]};patternCache.set(ctx,patterns);}
 patterns.water[level.index]??=ctx.createPattern(art.map2d?.rivers?.[level.index]??art.surfacewater,'repeat');
 const far=projectPhysical(width,height,0,1400,g),near=projectPhysical(width,height,0,-14,g);
 const river=ctx.createLinearGradient(0,far.y,0,near.y);river.addColorStop(0,level.waterEdge);river.addColorStop(.35,level.waterDeep);river.addColorStop(1,level.waterEdge);
 ctx.fillStyle=river;ctx.fillRect(0,far.y,width,height-far.y);
 const offset=reducedMotion?0:currentDistance(g.distance,g.time)*8%256;
 ctx.save();ctx.translate(0,offset);ctx.globalAlpha=.52;ctx.fillStyle=patterns.water[level.index];ctx.fillRect(0,far.y-offset,width,height);ctx.restore();
 if(level.index===2){
  const reflection=ctx.createLinearGradient(width*.42,0,width*.58,0);reflection.addColorStop(0,'#c9b7ff00');reflection.addColorStop(.5,'#c9b7ff20');reflection.addColorStop(1,'#c9b7ff00');ctx.fillStyle=reflection;ctx.fillRect(width*.42,far.y,width*.16,height);
 }
}

// This is actual land over the water plane, with two clipped flowing channels.
// All stations and texture patterns are bounded and derive from world distance.
export function drawForkFallback(ctx,g,art,width,height,reducedMotion=false){
 const geometry=forkFallbackGeometry(g,width,height);if(!geometry.length)return false;
 const level=levelAt(g.levelIndex),profile=profileOf(g);
 let patterns=patternCache.get(ctx);if(!patterns){patterns={ground:[],water:[]};patternCache.set(ctx,patterns);}
 patterns.ground[level.index]??=ctx.createPattern(art.map2d?.grounds?.[level.index]??art.surfaceground,'repeat');
 for(const fork of geometry){
  for(const [left,right] of [[fork.outerLeft,fork.innerLeft],[fork.innerRight,fork.outerRight]]){
   ctx.save();pathBetween(ctx,left,right);ctx.clip();
   drawFallbackWaterSurface(ctx,g,art,width,height,reducedMotion);
   // Short flowing crests read as current rather than straight shoreline rails.
   const first=Math.floor((g.distance-14)/8),last=first+33;
   for(let n=last;n>=first;n--){
    const course=n*8+riverHash(n+79,profile)*5,water=riverFork(course,profile);if(!water||water.id!==fork.id)continue;
    const side=left===fork.outerLeft?-1:1,inner=water.islandCenter+side*water.islandHalfWidth,outer=side*fallbackShoreHalfWidth(course,profile),t=.22+riverHash(n+91+side,profile)*.53;
    const at=projectPhysical(width,height,inner+(outer-inner)*t,course-g.distance,g),length=(1.4+riverHash(n+29,profile)*2.2)*at.unit;
    ctx.strokeStyle=level.index===2?'#c4d4f68c':'#d1fff08c';ctx.lineWidth=Math.max(.65,at.unit*.055);ctx.globalAlpha=Math.min(.65,at.scale*.8);
    ctx.beginPath();ctx.moveTo(at.x-length/2,at.y);ctx.quadraticCurveTo(at.x,at.y-at.unit*.1,at.x+length/2,at.y-at.unit*.035);ctx.stroke();
   }
   ctx.restore();
  }
  ctx.save();pathBetween(ctx,fork.innerLeft,fork.innerRight);ctx.clip();
  const soil=ctx.createLinearGradient(0,fork.innerLeft[0].y,0,fork.innerLeft.at(-1).y);
  soil.addColorStop(0,level.index===1?'#b78955':level.index===2?'#77758c':'#97a45b');soil.addColorStop(.5,level.ground);soil.addColorStop(1,level.index===1?'#725344':level.index===2?'#424b5d':'#4a6c3b');ctx.fillStyle=soil;ctx.fillRect(0,0,width,height);
  ctx.globalAlpha=.32;ctx.fillStyle=patterns.ground[level.index];const drift=g.distance*2%256;ctx.translate(0,drift);ctx.fillRect(0,-drift,width,height+256);ctx.restore();
  // Ochre banks with broken froth stay organic and never form white poles.
  for(const edge of [fork.innerLeft,fork.innerRight]){
   ctx.save();ctx.strokeStyle=level.index===2?'#8c98ac80':'#b1ad7790';ctx.lineWidth=Math.max(1,width*.003);ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(edge[0].x,edge[0].y);for(let i=1;i<edge.length;i++)ctx.lineTo(edge[i].x,edge[i].y);ctx.stroke();
   ctx.strokeStyle=level.index===2?'#b4c6e078':'#cbf3d578';ctx.lineWidth=1;
   for(let i=2;i<edge.length-1;i+=3){const p=edge[i],side=edge===fork.innerLeft?-1:1;ctx.beginPath();ctx.moveTo(p.x+side*p.unit*.15,p.y);ctx.quadraticCurveTo(p.x+side*p.unit*.3,p.y-p.unit*.06,p.x+side*p.unit*.6,p.y+p.unit*.04);ctx.stroke();}ctx.restore();
  }
  const first=Math.ceil(fork.near/28),last=Math.floor(fork.far/28);
  for(let n=last;n>=first;n--){
   const course=n*28,atFork=riverFork(course,profile);if(!atFork||atFork.strength<.6)continue;
   const cross=atFork.islandCenter+(riverHash(n+57,profile)-.5)*atFork.islandHalfWidth*.85,at=projectPhysical(width,height,cross,course-g.distance,g);
   const lift=islandHeight(cross,course,profile)*at.unit*.24,size=(1.4+riverHash(n+103,profile)*1.3)*at.unit;
   ctx.save();ctx.globalAlpha=Math.min(1,at.scale*4);ctx.fillStyle='#122e2845';ctx.beginPath();ctx.ellipse(at.x,at.y-lift,size*.44,size*.09,0,0,TAU);ctx.fill();islandPlant(ctx,at.x,at.y-lift,size,level.index===1?1:n%3===0?1:0,level.index===2);ctx.restore();
  }
 }
 return true;
}

export function treasurePresentation(entity){
 const base=entity.treasureBase??200,bonus=entity.treasureCleanBonus??0;
 return{base,bonus,payoff:base+bonus,risk:bonus>0,label:bonus>0?'CLEAN TREASURE':'TREASURE',color:bonus>0?'#ffc779':'#91eed3'};
}
export function drawTreasure2D(ctx,entity,point,size,time,reducedMotion){
 const style=treasurePresentation(entity),pulse=reducedMotion?0:Math.sin(time*3.2+entity.id)*.06;
 ctx.save();ctx.translate(point.x,point.y);ctx.scale(size,size);
 const glow=ctx.createRadialGradient(0,-.3,.03,0,-.3,.85);glow.addColorStop(0,style.risk?'#ffd27579':'#8eeed954');glow.addColorStop(1,'#fff6d000');ctx.fillStyle=glow;ctx.fillRect(-1,-1.2,2,1.6);
 ctx.fillStyle='#082c3d70';ctx.beginPath();ctx.ellipse(0,.03,.5,.1,0,0,TAU);ctx.fill();
 ctx.translate(0,pulse*.035);ctx.fillStyle='#6b4229';ctx.beginPath();ctx.moveTo(-.43,-.47);ctx.lineTo(.28,-.47);ctx.lineTo(.49,-.33);ctx.lineTo(.49,-.025);ctx.lineTo(-.26,.02);ctx.lineTo(-.43,-.11);ctx.closePath();ctx.fill();
 ctx.fillStyle='#af7850';ctx.beginPath();ctx.moveTo(-.43,-.47);ctx.quadraticCurveTo(-.38,-.73,-.1,-.73);ctx.lineTo(.26,-.73);ctx.quadraticCurveTo(.5,-.63,.49,-.33);ctx.lineTo(-.26,-.29);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#4b3026';ctx.lineWidth=.025;for(const y of [-.15,-.34,-.52]){ctx.beginPath();ctx.moveTo(-.25,y);ctx.lineTo(.47,y-.035);ctx.stroke();}
 ctx.strokeStyle=style.risk?'#ffcc70':'#b3c69a';ctx.lineWidth=.055;for(const x of [-.15,.32]){ctx.beginPath();ctx.moveTo(x,-.7);ctx.lineTo(x+.025,-.32);ctx.lineTo(x+.025,0);ctx.stroke();}
 ctx.strokeStyle='#ffe5a0';ctx.lineWidth=.036;ctx.beginPath();ctx.moveTo(-.42,-.47);ctx.lineTo(-.26,-.29);ctx.lineTo(.49,-.33);ctx.stroke();ctx.fillStyle='#ffe5a0';ctx.fillRect(.035,-.4,.13,.16);ctx.fillStyle='#4a3625';ctx.fillRect(.079,-.345,.035,.053);
 if(style.risk){ctx.fillStyle='#d79345';ctx.beginPath();ctx.moveTo(.16,-.68);ctx.lineTo(.22,-.78);ctx.lineTo(.29,-.68);ctx.lineTo(.35,-.78);ctx.lineTo(.4,-.66);ctx.closePath();ctx.fill();}
 ctx.restore();
}
