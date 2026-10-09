import {LANE_SPACING,PLAYABLE_WIDTH,PLAYABLE_HALF_WIDTH,laneToX} from './lanes.js';
import {riverHalfWidth,riverHash} from './river-course.js';
import {riverFork,forkLaneCross,nextRiverFork,islandHeight} from './river-forks.js';
import {levelAt} from './levels.js';
import {currentDistance} from './hydrodynamics.js';
import {FORK_PALETTES,islandLandmarks,islandShoreClusters,islandGroundClumps} from './fork-art-direction.js';

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
export function islandRelief2D(g,width,height,geometry){
 const fractions=[-1,-.96,-.88,-.42,0,.42,.88,.96,1];
 return geometry.innerLeft.map(edge=>{
  const fork=riverFork(edge.course,g.terrainProfile);if(!fork)return[];
  return fractions.map(fraction=>{
   const cross=fork.islandCenter+fork.islandHalfWidth*fraction,point=projectPhysical(width,height,cross,edge.course-g.distance,g),surfaceHeight=islandHeight(cross,edge.course,g.terrainProfile);
   return{...point,cross,course:edge.course,fraction,height:surfaceHeight,waterY:point.y,y:point.y-surfaceHeight*point.unit};
  });
 });
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
function landmark2D(ctx,type,x,y,unit,scale,palette,turn){
 ctx.save();ctx.translate(x,y);ctx.scale(unit*scale,unit*scale);ctx.lineJoin='round';ctx.lineCap='round';
 const flip=Math.cos(turn)>=0?1:-1;ctx.scale(flip,1);
 if(type==='root-grove'){
  ctx.strokeStyle=palette.root;
  for(let i=0;i<5;i++){
   const side=i%2?-1:1,reach=.65+(i%3)*.38;ctx.lineWidth=.18-i*.025;
   ctx.beginPath();ctx.moveTo(.05,-.85);ctx.bezierCurveTo(side*.3,-.3,side*reach,-.13,side*(reach+.15),.02);ctx.stroke();
  }
  for(const [offset,sway,h] of [[-.12,-.32,3.7],[.32,.52,2.9]]){
   ctx.strokeStyle=palette.root;ctx.lineWidth=.28;ctx.beginPath();ctx.moveTo(offset,-.3);ctx.bezierCurveTo(offset+.1,-1.1,offset+sway,-2,offset+sway*.8,-h);ctx.stroke();
   ctx.strokeStyle=palette.moss;ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(offset+.08,-.5);ctx.quadraticCurveTo(offset+sway*.7,-1.5,offset+sway*.8,-h);ctx.stroke();
   for(let j=0;j<6;j++){
    const a=j*Math.PI/3+.2,reach=1.04+(j%2)*.2,tx=offset+sway*.8,ty=-h;
    ctx.strokeStyle=palette.moss;ctx.lineWidth=.12;ctx.beginPath();ctx.moveTo(tx,ty);ctx.quadraticCurveTo(tx+Math.cos(a)*reach*.7,ty-Math.sin(a)*.25,tx+Math.cos(a)*reach,ty+.33+Math.sin(a)*.5);ctx.stroke();
    ctx.strokeStyle=palette.earth;ctx.lineWidth=.025;ctx.stroke();
   }
  }
  for(let j=0;j<7;j++){
   const side=j%2?-1:1,reach=.6+j*.065,base=.5;ctx.strokeStyle=palette.moss;ctx.lineWidth=.045;ctx.beginPath();ctx.moveTo(base,0);ctx.quadraticCurveTo(base+side*reach*.55,-.8,base+side*reach,-.15);ctx.stroke();
   for(let k=1;k<5;k++){const t=k/5,px=base+side*reach*t,py=-Math.sin(t*Math.PI)*.44;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-side*.12,py-.15);ctx.moveTo(px,py);ctx.lineTo(px+side*.12,py+.09);ctx.stroke();}
  }
 }else if(type==='sandstone-shelf'){
  for(let step=0;step<4;step++){
   const spread=1.65-step*.24,top=-.36-step*.42,y=-step*.36;
   ctx.fillStyle=step%2?palette.earth:palette.ridge;ctx.beginPath();ctx.moveTo(-spread,y);ctx.lineTo(-spread*.86,top);ctx.lineTo(spread*.47,top-.16);ctx.lineTo(spread,top+.04);ctx.lineTo(spread*.84,y);ctx.closePath();ctx.fill();
   ctx.strokeStyle=palette.shore;ctx.lineWidth=.07;ctx.beginPath();ctx.moveTo(-spread*.86,top+.02);ctx.lineTo(spread*.47,top-.13);ctx.lineTo(spread,top+.06);ctx.stroke();
   ctx.strokeStyle=palette.wet;ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(-spread*.8,y-.05);ctx.lineTo(spread*.84,y-.05);ctx.stroke();
  }
  ctx.strokeStyle=palette.wet;ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(-.3,-1.55);ctx.lineTo(-.17,-.86);ctx.lineTo(-.42,-.28);ctx.stroke();
 }else{
  ctx.fillStyle=palette.stone;ctx.beginPath();ctx.moveTo(-.55,0);ctx.lineTo(-.44,-3.25);ctx.lineTo(-.09,-3.63);ctx.lineTo(.08,-3.23);ctx.lineTo(.32,-3.5);ctx.lineTo(.48,-3.06);ctx.lineTo(.59,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.ridge;ctx.beginPath();ctx.moveTo(-.44,-3.25);ctx.lineTo(-.09,-3.63);ctx.lineTo(.01,-.12);ctx.lineTo(-.55,0);ctx.closePath();ctx.fill();
  ctx.strokeStyle=palette.wet;ctx.lineWidth=.07;ctx.beginPath();ctx.moveTo(.04,-3.31);ctx.lineTo(-.07,-2.44);ctx.lineTo(.13,-2.08);ctx.lineTo(-.18,-1.72);ctx.lineTo(-.07,-.7);ctx.stroke();
  ctx.strokeStyle=palette.accent;ctx.lineWidth=.055;ctx.beginPath();ctx.moveTo(-.25,-2.4);ctx.lineTo(.24,-2.4);ctx.moveTo(0,-2.65);ctx.lineTo(0,-2.16);ctx.stroke();
  ctx.fillStyle=palette.moss;ctx.beginPath();ctx.ellipse(-.31,-.26,.35,.12,.2,0,TAU);ctx.ellipse(.29,-1.36,.18,.07,-.3,0,TAU);ctx.fill();
  ctx.fillStyle=palette.stone;ctx.beginPath();ctx.moveTo(-1.1,.1);ctx.lineTo(-.93,-.31);ctx.lineTo(-.61,-.25);ctx.lineTo(-.51,.05);ctx.closePath();ctx.fill();
 }
 ctx.restore();
}

function drawIslandRelief(ctx,g,width,height,geometry,palette,pattern){
 const rows=islandRelief2D(g,width,height,geometry).filter(row=>row.length===9);
 ctx.save();pathBetween(ctx,geometry.innerLeft,geometry.innerRight);ctx.fillStyle=palette.wet;ctx.fill();
 if(rows.length>1)for(let band=0;band<8;band++){
  const left=rows.map(row=>row[band]),right=rows.map(row=>row[band+1]);
  pathBetween(ctx,left,right);ctx.fillStyle=palette.earth;ctx.fill();
  ctx.save();ctx.clip();ctx.globalAlpha=.94;ctx.fillStyle=pattern;const offset=g.distance*2%256;ctx.translate(0,offset);ctx.fillRect(0,-offset,width,height+256);ctx.translate(0,-offset);
  // One continuous material follows the height mesh. Lighting is restrained;
  // boundaries between the mesh strips cannot become colored road markings.
  ctx.fillStyle=band<4?'#fff5cc':'#1e2c31';ctx.globalAlpha=band===0||band===7?.06:.025;ctx.fill();ctx.restore();
 }
 ctx.restore();
}
export function islandGroundPatches(geometry,profile){
 return islandGroundClumps(geometry,profile).map(clump=>({...clump,fraction:clump.crossFraction}));
}
function drawGroundPatches(ctx,g,width,height,geometry,palette){
 const patches=islandGroundPatches(geometry,g.terrainProfile);
 for(const patch of patches){
  if(patch.d<geometry.near-8||patch.d>geometry.far+8)continue;
  const center=riverFork(patch.d,g.terrainProfile);if(!center||center.strength<.45)continue;
  const color=patch.kind===0?palette.moss:patch.kind===1?palette.shore:palette.ridge;
  ctx.save();ctx.fillStyle=color;ctx.globalAlpha=patch.kind===1?.26:.35;ctx.beginPath();
  for(let point=0;point<9;point++){
   const angle=point*TAU/9+patch.turn,warp=.7+riverHash(point+Math.floor(patch.d)+47,g.terrainProfile)*.3,course=patch.d+Math.sin(angle)*patch.length*warp;
   const fork=riverFork(course,g.terrainProfile);if(!fork)continue;
   const fraction=clamp(patch.fraction+Math.cos(angle)*patch.width*warp/fork.islandHalfWidth,-.97,.97),cross=fork.islandCenter+fraction*fork.islandHalfWidth,at=projectPhysical(width,height,cross,course-g.distance,g),y=at.y-islandHeight(cross,course,g.terrainProfile)*at.unit;
   if(point===0)ctx.moveTo(at.x,y);else ctx.lineTo(at.x,y);
  }
  ctx.closePath();ctx.fill();ctx.restore();
 }
}
function drawGroundClumps(ctx,g,art,width,height,geometry,palette){
 const patches=islandGroundPatches(geometry,g.terrainProfile).filter(patch=>patch.d>=geometry.near&&patch.d<=geometry.far).sort((a,b)=>b.d-a.d);
 for(const patch of patches){
  const fork=riverFork(patch.d,g.terrainProfile);if(!fork||fork.strength<.45)continue;
  const cross=fork.islandCenter+patch.fraction*fork.islandHalfWidth,at=projectPhysical(width,height,cross,patch.d-g.distance,g),y=at.y-islandHeight(cross,patch.d,g.terrainProfile)*at.unit;
  const stone=(patch.kind===1?1.1:.67)*at.unit,moon=(g.levelIndex??0)===2;
  ctx.save();ctx.globalAlpha=Math.min(1,at.scale*5);
  const rock=art.fork2d?.rocks?.[g.levelIndex??0],plantArt=art.fork2d?.plants?.[g.levelIndex??0]??art.branchLeaves;
  if(rock||art.sprites){
   // The same detailed mossy stone used by the river atlas sits entirely on
   // land. Fixed world clumps replace the empty, uniformly painted median.
   ctx.save();ctx.translate(at.x,y);ctx.rotate((patch.turn-Math.PI)*.045);
   if(rock)ctx.drawImage(rock,-stone*.5,-stone*.825,stone,stone*.825);else ctx.drawImage(art.sprites,0,545,430,355,-stone*.5,-stone*.825,stone,stone*.825);ctx.restore();
   if(patch.kind===1){const x=at.x-patch.side*stone*.7-stone*.28;if(rock)ctx.drawImage(rock,x,y-stone*.5,stone*.56,stone*.46);else ctx.drawImage(art.sprites,0,545,430,355,x,y-stone*.5,stone*.56,stone*.46);}
  }else islandPlant(ctx,at.x,y,stone,1,moon);
  if((g.levelIndex??0)!==1&&patch.kind!==1){
   const plantCross=cross-patch.side*.3,plant=projectPhysical(width,height,plantCross,patch.d-g.distance+.7,g),plantY=plant.y-islandHeight(plantCross,patch.d+.7,g.terrainProfile)*plant.unit,size=plant.unit*(moon?.8:1.2);
   if(plantArt){
    ctx.globalAlpha*=moon?.8:.9;ctx.drawImage(plantArt,plant.x-size*.5,plantY-size*.44,size,size*.63);
   }else islandPlant(ctx,plant.x,plantY,size,0,moon);
  }
  ctx.restore();
 }
}

function drawForkEddies(ctx,g,width,height,geometry,palette,reduced){
 for(const course of [geometry.start+38,geometry.end-38]){
  if(course<g.distance-12||course>g.distance+245)continue;
  const fork=riverFork(course,g.terrainProfile);if(!fork)continue;
  for(const side of [-1,1]){
   const cross=fork.islandCenter+side*(fork.islandHalfWidth+1.1),at=projectPhysical(width,height,cross,course-g.distance,g),phase=reduced?0:g.time*.7+side*.4;
   ctx.save();ctx.strokeStyle=palette.foam;ctx.lineWidth=Math.max(.6,at.unit*.035);ctx.globalAlpha=.4*fork.strength;
   for(let ring=0;ring<2;ring++){ctx.beginPath();ctx.ellipse(at.x,at.y,(.8+ring*.3)*at.unit,(.2+ring*.05)*at.unit,side*.08,phase+ring*.5,phase+ring*.5+Math.PI*1.4);ctx.stroke();}ctx.restore();
  }
 }
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
 const level=levelAt(g.levelIndex),profile=profileOf(g),palette=FORK_PALETTES[level.index];
 let patterns=patternCache.get(ctx);if(!patterns){patterns={ground:[],water:[]};patternCache.set(ctx,patterns);}
 patterns.ground[level.index]??=ctx.createPattern(art.fork2d?.grounds?.[level.index]??art.map2d?.grounds?.[level.index]??art.surfaceground,'repeat');
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
    ctx.strokeStyle=palette.foam;ctx.lineWidth=Math.max(.65,at.unit*.055);ctx.globalAlpha=Math.min(.5,at.scale*.65);
    ctx.beginPath();ctx.moveTo(at.x-length/2,at.y);ctx.quadraticCurveTo(at.x,at.y-at.unit*.1,at.x+length/2,at.y-at.unit*.035);ctx.stroke();
   }
   ctx.restore();
  }
  drawIslandRelief(ctx,g,width,height,fork,palette,patterns.ground[level.index]);
  drawGroundPatches(ctx,g,width,height,fork,palette);
  // Ochre banks with broken froth stay organic and never form white poles.
  for(const edge of [fork.innerLeft,fork.innerRight]){
   ctx.save();ctx.strokeStyle=palette.shore;ctx.globalAlpha=.7;ctx.lineWidth=Math.max(1,width*.003);ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(edge[0].x,edge[0].y);for(let i=1;i<edge.length;i++)ctx.lineTo(edge[i].x,edge[i].y);ctx.stroke();
   ctx.strokeStyle=palette.foam;ctx.globalAlpha=.42;ctx.lineWidth=1;
   for(let i=2;i<edge.length-1;i+=3){const p=edge[i],side=edge===fork.innerLeft?-1:1;ctx.beginPath();ctx.moveTo(p.x+side*p.unit*.15,p.y);ctx.quadraticCurveTo(p.x+side*p.unit*.3,p.y-p.unit*.06,p.x+side*p.unit*.6,p.y+p.unit*.04);ctx.stroke();}ctx.restore();
  }
  drawForkEddies(ctx,g,width,height,fork,palette,reducedMotion);
  drawGroundClumps(ctx,g,art,width,height,fork,palette);
  const details=[...islandLandmarks(fork,profile),...islandShoreClusters(fork,profile)].filter(mark=>mark.d>=fork.near&&mark.d<=fork.far).sort((a,b)=>b.d-a.d);
  for(const mark of details){
   const atFork=riverFork(mark.d,profile);if(!atFork||atFork.strength<.4||atFork.islandHalfWidth<2.3)continue;
   const cross=atFork.islandCenter+mark.crossFraction*atFork.islandHalfWidth,at=projectPhysical(width,height,cross,mark.d-g.distance,g),lift=islandHeight(cross,mark.d,profile)*at.unit;
   ctx.save();ctx.globalAlpha=Math.min(1,at.scale*4);ctx.fillStyle='#122e2845';ctx.beginPath();ctx.ellipse(at.x,at.y-lift,at.unit*mark.scale*.7,at.unit*.12,0,0,TAU);ctx.fill();
   if(mark.type)landmark2D(ctx,mark.type,at.x,at.y-lift,at.unit,mark.scale,palette,mark.turn);
   else for(let member=0;member<3;member++){
    const px=cross-mark.side*member*.23,plant=projectPhysical(width,height,px,mark.d-g.distance+member*.25,g),y=plant.y-islandHeight(px,mark.d+member*.25,profile)*plant.unit;
    islandPlant(ctx,plant.x,y,plant.unit*mark.scale*(member===0?1:.65),level.index===0&&member===2?0:1,level.index===2);
   }
   ctx.restore();
  }
 }
 return true;
}

export function treasurePresentation(entity){
 const base=entity.treasureBase??200,bonus=entity.treasureCleanBonus??0;
 return{base,bonus,payoff:base+bonus,risk:bonus>0,label:bonus>0?'CLEAN TREASURE':'TREASURE',color:bonus>0?'#ffc779':'#91eed3'};
}
export function stashPresentation(entity){
 const value=entity.value===200?200:entity.value===120?120:0;
 return{value,label:value?`+${value}`:'STASH',color:value===200?'#ffe3a1':'#ffd075',cloth:value===200?'#965542':'#746143'};
}
export function drawStash2D(ctx,entity,point,size,time,reducedMotion){
 const style=stashPresentation(entity),pulse=reducedMotion?1:1+Math.sin(time*3.4+entity.id)*.04;
 ctx.save();ctx.translate(point.x,point.y);ctx.scale(size,size);
 ctx.fillStyle='#082d3b70';ctx.beginPath();ctx.ellipse(0,.025,.47,.095,0,0,TAU);ctx.fill();
 ctx.save();ctx.globalAlpha=.22;ctx.strokeStyle=style.color;ctx.lineWidth=.035;ctx.beginPath();ctx.ellipse(0,0,.52*pulse,.14*pulse,0,0,TAU);ctx.stroke();ctx.restore();
 ctx.fillStyle=style.cloth;ctx.beginPath();ctx.moveTo(-.19,-.6);ctx.bezierCurveTo(-.19,-.45,-.48,-.4,-.43,-.17);ctx.quadraticCurveTo(-.38,.06,0,.015);ctx.quadraticCurveTo(.43,.025,.44,-.2);ctx.quadraticCurveTo(.44,-.44,.2,-.59);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#3f362d';ctx.lineWidth=.028;ctx.beginPath();ctx.moveTo(-.22,-.38);ctx.quadraticCurveTo(-.35,-.18,-.2,-.03);ctx.moveTo(.13,-.42);ctx.quadraticCurveTo(.3,-.18,.2,-.05);ctx.stroke();
 ctx.fillStyle='#dac18a';ctx.fillRect(-.22,-.59,.43,.075);ctx.strokeStyle='#e9d5a5';ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(.16,-.555);ctx.quadraticCurveTo(.49,-.56,.33,-.38);ctx.moveTo(.15,-.55);ctx.lineTo(.34,-.23);ctx.stroke();
 for(const [x,y] of [[-.13,-.69],[.08,-.72],[.23,-.66]]){
  ctx.fillStyle=style.color;ctx.strokeStyle='#a96828';ctx.lineWidth=.015;ctx.beginPath();ctx.ellipse(x,y,.11,.066,-.2,0,0,TAU);ctx.fill();ctx.stroke();
 }
 ctx.fillStyle=style.color;ctx.beginPath();ctx.moveTo(0,-.36);ctx.lineTo(.1,-.24);ctx.lineTo(0,-.12);ctx.lineTo(-.1,-.24);ctx.closePath();ctx.fill();ctx.restore();
 if(size>=12&&style.value){
  ctx.save();ctx.textAlign='center';ctx.font=`900 ${Math.max(10,size*.26)}px system-ui`;ctx.strokeStyle='#3a3329';ctx.fillStyle=style.color;ctx.lineWidth=3;const y=point.y-size*.88;ctx.strokeText(style.label,point.x,y);ctx.fillText(style.label,point.x,y);ctx.restore();
 }
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
