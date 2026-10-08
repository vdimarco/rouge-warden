import { jumpHeight, VIEW_DISTANCE } from './engine.js';
import {coinPixelLift,coinFlightPixelLift} from './coin-presentation.js';
import { bankScenery, rapids, prepareWorldArt, worldEntityVisible } from './world.js';
import { riderPose, RIDER_SIZE } from './rider.js';
import { drawWater } from './water.js';
import { createMotion, advanceMotion, landingPulse, pickupProgress, paddleSample } from './motion.js';
import {shorelineBranch,branchLeafArt,limbPoint} from './shoreline-branch.js';
import { levelAt } from './levels.js';
import {createCourseProfile} from './river-course.js';
import { prepareMap2D, drawMap2D, drawMapBanks2D, drawFinish2D,drawRapids2D,drawCanopyTerrain2D } from './map-2d.js';
import {impactFeedback,impactParticle} from './impact-feedback.js';
import {entityPose} from './moving-encounters.js';
const motions=new WeakMap();
const branchShapes=new WeakMap();
const courseProfiles=new WeakMap();
const TAU = Math.PI * 2, fract = n => n - Math.floor(n);
// Generated atlas has unequal row heights; rectangles preserve full silhouettes.
const regions = [
  [0,0,435,540],[435,0,415,540],[850,0,404,540],
  [0,545,430,355],[430,550,420,350],[850,545,404,360],
  [0,900,425,354],[425,900,425,354],[850,900,404,354]
];
const indexes = { rock: 3, log: 4, branch: 5, coin: 6, magnet: 7, shield: 8 };
let artPromise;
function loadImage(key,name,extension='png',optional=false){return new Promise((resolve,reject)=>{
  let attempt=0,done=false;const image=new Image();
  const timer=optional?setTimeout(()=>{done=true;resolve([key,null]);},8000):null;
  image.onload=()=>{if(done)return;done=true;clearTimeout(timer);resolve([key,image]);};
  image.onerror=()=>{if(done)return;if(attempt<2){attempt++;setTimeout(()=>{image.src=`${import.meta.env.BASE_URL}art/${name}.${extension}?retry=${attempt}`;},attempt*350);}else{done=true;clearTimeout(timer);if(optional)resolve([key,null]);else reject(new Error(`Could not load ${name}.`));}};
  image.src=`${import.meta.env.BASE_URL}art/${name}.${extension}`;
});}
export function loadArt() {
  const sources=[['environment','runner-river'],['portrait','runner-portrait'],['sprites','runner-sprites'],['menu','menu'],['paddle','paddle-frames'],['downstream','rider-downstream'],['lowDuck','rider-low-duck']];
  for(const name of ['rock','wood','ground','water'])sources.push([`surface${name}`,`surface-${name}`,'webp']);
  for(const name of ['rock','wood','ground'])sources.push([`normal${name}`,`surface-${name}-normal`]);
  sources.push(['treebark','tree-bark','webp',true],['treebarknormal','tree-bark-normal','webp',true],['treeleaves','tree-foliage','webp',true]);
  sources.push(['mapjungle','valley-vista','webp',true],['mapcanyon','map-canyon','webp',true]);
  return artPromise??=Promise.all(sources.map(([key,name,extension,optional])=>loadImage(key,name,extension,optional))).then(entries=>prepareHeroArt(Object.fromEntries(entries))).catch(error=>{artPromise=null;throw error;});
}
const paddleAnchors=[[264,422],[264,422],[265,422],[265,422],[266,408],[264,408],[266,408],[265,410]];
async function prepareHeroArt(art){
  art.world=prepareWorldArt();
  art.map2d=prepareMap2D(art);
  art.branchLeaves=art.treeleaves??branchLeafArt();
  function frame(source,rect,anchor,raftWidth){
    const canvas=document.createElement('canvas');canvas.width=448;canvas.height=480;
    const scale=300/raftWidth,ctx=canvas.getContext('2d');
    ctx.drawImage(source,...rect,224-anchor[0]*scale,464-anchor[1]*scale,rect[2]*scale,rect[3]*scale);return canvas;
  }
  const sw=art.paddle.width/4,sh=art.paddle.height/2;
  const frames=paddleAnchors.map((anchor,i)=>frame(art.paddle,[i%4*sw,Math.floor(i/4)*sh,sw,sh],anchor,350));
  art.paddleFrames=[];
  // Keep a single opaque rider pose per frame. Blending different photo poses
  // produces doubled faces/arms, especially when a jump freezes the blend.
  for(const source of frames){
    const canvas=document.createElement('canvas');canvas.width=448;canvas.height=380;
    canvas.getContext('2d').drawImage(source,0,100,448,380,0,0,448,380);
    try{art.paddleFrames.push(await createImageBitmap(canvas));}catch{art.paddleFrames.push(canvas);}
  }
  art.downstreamFrames=[];
  for(let i=0;i<8;i++){
    const canvas=document.createElement('canvas');canvas.width=RIDER_SIZE.width;canvas.height=RIDER_SIZE.height;
    canvas.getContext('2d').drawImage(art.downstream,i%4*RIDER_SIZE.width,Math.floor(i/4)*RIDER_SIZE.height,RIDER_SIZE.width,RIDER_SIZE.height,0,0,RIDER_SIZE.width,RIDER_SIZE.height);
    try{art.downstreamFrames.push(await createImageBitmap(canvas));}catch{art.downstreamFrames.push(canvas);}
  }
  art.downstreamFrames.push(art.lowDuck);
  return art;
}
function hero(ctx,frame,raft,x,bottom,width,roll,alpha=1,squash=0,brace=0){
  const scale=width/300;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,bottom);ctx.rotate(roll);ctx.scale(1+squash*.025,1-squash*.05);
  const split=raft.height-88;
  ctx.drawImage(raft,74,split,300,88,-150*scale,(split-raft.height+16)*scale,300*scale,88*scale);ctx.restore();
  // Draw the independent rider above the deck. A crouch keeps its own anatomy
  // and the same foot registration; it is never a vertically squashed jump.
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,bottom+width*.018*brace);ctx.rotate(roll-brace*.16);
  const riderScale=width/512;
  ctx.drawImage(frame,-frame.width/2*riderScale,-RIDER_SIZE.foot*riderScale-width*.14,frame.width*riderScale,frame.height*riderScale);ctx.restore();
}
export function projection(width, height, lane, z) {
  const horizon = height * .29, foot = height * (height < 500 ? .73 : width/height<.85?.77:.8);
  const corridor = Math.min(width * .99, height * 1.17);
  const scale = 1 / (1 + Math.max(-14, z) / 29);
  return { x: width / 2 + (lane - 1) * corridor / 3 * scale, y: horizon + (foot - horizon) * scale, scale, corridor, foot, horizon };
}
// The body, water shadow and exact contact marker have separate registration.
// Shared course-space lift stays visible even when decorative motion reduces.
export function encounterProjection(e,g,width,height){
  const pose=entityPose(e,g.distance),z=e.d-g.distance,p=projection(width,height,pose.lane,z);
  const unit=p.corridor/11.4*p.scale,base=e.enemy==='bird'?2.33:e.enemy==='fish'?.25:0;
  return {...p,...pose,unit,bodyY:p.y-(base+pose.lift)*unit,destination:projection(width,height,pose.contactLane,z),action:e.enemy==='bird'?'duck':e.enemy?'jump':'collect'};
}
function encounterGuide(ctx,e,p,size){
  const to=p.destination,target=e.type==='target',color=target?'#72fff1':'#ff9377';
  ctx.save();ctx.strokeStyle=color;ctx.fillStyle=target?'#35d3bb20':'#ff76501c';ctx.lineWidth=Math.max(.8,size*.016);
  ctx.beginPath();ctx.ellipse(to.x,to.y,size*.38,size*.085,0,0,TAU);ctx.fill();ctx.stroke();
  if(Math.abs(p.x-to.x)>size*.05){
    const side=Math.sign(to.x-p.x);ctx.globalAlpha*=.7;
    for(let i=1;i<=3;i++){
      const x=p.x+(to.x-p.x)*i/4,half=Math.max(1,size*.035);
      ctx.beginPath();ctx.moveTo(x-side*half,to.y-half);ctx.lineTo(x+side*half,to.y);ctx.lineTo(x-side*half,to.y+half);ctx.stroke();
    }
  }
  ctx.restore();
}
function crocodile(ctx,p,size,time,reduced){
  const tail=reduced?0:Math.sin(time*3.6)*.075,jaw=reduced?.018:.026+Math.max(0,Math.sin(time*2.7))*.044;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(size,size);
  ctx.fillStyle='#062f3766';ctx.beginPath();ctx.ellipse(0,.028,.47,.078,0,0,TAU);ctx.fill();
  // A curved wake follows the shared swimming direction. The body banks as it
  // reverses, rather than looking like a stationary log sliding across lanes.
  const bank=Math.max(-.2,Math.min(.2,p.lateralSlope*1.9));
  ctx.strokeStyle='#c4fff28c';ctx.lineWidth=.009;
  for(let i=0;i<3;i++){
    const spread=.026+i*.029;ctx.beginPath();ctx.moveTo(-.41-bank*.4,spread);ctx.quadraticCurveTo(-bank*.34,.07+spread,.38-bank*.4,spread);ctx.stroke();
  }
  ctx.rotate(bank);
  // A thick tapering tail, four feet and dorsal armor give the low enemy a
  // reptile silhouette rather than reusing the log sprite.
  ctx.fillStyle='#263e2b';ctx.beginPath();ctx.moveTo(-.18,-.055);ctx.bezierCurveTo(-.35,-.08,-.47,-.22+tail,-.55,-.18+tail);ctx.bezierCurveTo(-.5,-.28+tail,-.33,-.26,-.14,-.16);ctx.closePath();ctx.fill();
  ctx.fillStyle='#466640';
  for(const side of [-1,1])for(const x of [-.18,.05]){
    ctx.beginPath();ctx.moveTo(x,-.12);ctx.lineTo(x-.045,-.11+side*.09);ctx.lineTo(x+.055,-.11+side*.075);ctx.lineTo(x+.085,-.13);ctx.closePath();ctx.fill();
  }
  const body=ctx.createLinearGradient(0,-.23,0,.01);body.addColorStop(0,'#709059');body.addColorStop(.5,'#425f39');body.addColorStop(1,'#253e2c');ctx.fillStyle=body;
  ctx.beginPath();ctx.ellipse(-.08,-.125,.285,.117,-.05,0,TAU);ctx.fill();
  ctx.fillStyle='#243d28';
  for(let row=0;row<2;row++)for(let i=0;i<5;i++){
    const x=-.26+i*.078,y=-.185+row*.073;
    ctx.beginPath();ctx.moveTo(x-.019,y+.018);ctx.lineTo(x,y-.018);ctx.lineTo(x+.032,y+.009);ctx.lineTo(x+.006,y+.031);ctx.closePath();ctx.fill();
  }
  // The jaw opens locally; its mouth remains centered inside the collision lane.
  ctx.fillStyle='#142b24';ctx.beginPath();ctx.moveTo(.1,-.137);ctx.lineTo(.42,-.117+jaw);ctx.lineTo(.44,-.16);ctx.lineTo(.12,-.175);ctx.closePath();ctx.fill();
  ctx.fillStyle='#7d9760';ctx.beginPath();ctx.moveTo(.1,-.175);ctx.quadraticCurveTo(.25,-.205,.44,-.161);ctx.lineTo(.42,-.137);ctx.lineTo(.14,-.131);ctx.closePath();ctx.fill();
  ctx.fillStyle='#dfd8a7';
  for(let i=0;i<6;i++){const x=.18+i*.038;ctx.beginPath();ctx.moveTo(x,-.137);ctx.lineTo(x+.014,-.124+jaw*.52);ctx.lineTo(x+.024,-.14);ctx.closePath();ctx.fill();}
  for(const x of [.14,.205]){
    ctx.fillStyle='#cdb462';ctx.beginPath();ctx.ellipse(x,-.184,.029,.027,0,0,TAU);ctx.fill();ctx.fillStyle='#101c16';ctx.beginPath();ctx.ellipse(x+.004,-.184,.006,.019,0,0,TAU);ctx.fill();
  }
  ctx.strokeStyle='#d4fff060';ctx.lineWidth=.008;ctx.beginPath();ctx.moveTo(-.35,.025);ctx.quadraticCurveTo(-.06,.058,.4,.025);ctx.stroke();ctx.restore();
}
function swoopingBird(ctx,p,size,time,reduced){
  const flap=reduced?0:Math.sin(time*7.5)*.24;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(size,size);
  ctx.fillStyle='#062f374d';ctx.beginPath();ctx.ellipse(0,0,.31,.065,0,0,TAU);ctx.fill();
  ctx.translate(0,(p.bodyY-p.y)/size);ctx.rotate(Math.max(-.23,Math.min(.23,p.lateralSlope*.8)));
  for(const side of [-1,1]){
    ctx.save();ctx.scale(side,1);ctx.rotate(flap);
    ctx.fillStyle='#654d39';ctx.beginPath();ctx.moveTo(.045,-.075);ctx.quadraticCurveTo(.24,-.18,.52,-.09);ctx.lineTo(.39,.1);ctx.lineTo(.1,.055);ctx.closePath();ctx.fill();
    for(let i=0;i<6;i++){
      const x=.16+i*.06;ctx.fillStyle=i%2?'#402f2b':'#b07648';ctx.beginPath();ctx.moveTo(x,-.055);ctx.lineTo(x+.105,.03+i*.018);ctx.quadraticCurveTo(x+.092,.12+i*.018,x+.035,.11);ctx.lineTo(x-.025,.015);ctx.closePath();ctx.fill();
    }
    ctx.strokeStyle='#e3ab71';ctx.lineWidth=.009;ctx.beginPath();ctx.moveTo(.08,-.075);ctx.quadraticCurveTo(.28,-.125,.49,-.07);ctx.stroke();ctx.restore();
  }
  ctx.fillStyle='#4c332b';ctx.beginPath();ctx.moveTo(-.085,.07);ctx.lineTo(-.1,.25);ctx.lineTo(0,.185);ctx.lineTo(.1,.25);ctx.lineTo(.085,.07);ctx.closePath();ctx.fill();
  const breast=ctx.createLinearGradient(-.09,0,.11,0);breast.addColorStop(0,'#45342e');breast.addColorStop(.55,'#bf8556');breast.addColorStop(1,'#634633');ctx.fillStyle=breast;ctx.beginPath();ctx.ellipse(0,.005,.095,.145,0,0,TAU);ctx.fill();
  ctx.fillStyle='#f0d0a3';ctx.beginPath();ctx.ellipse(0,-.115,.081,.075,0,0,TAU);ctx.fill();ctx.fillStyle='#362920';ctx.beginPath();ctx.ellipse(0,-.132,.083,.042,0,Math.PI,TAU);ctx.fill();
  ctx.fillStyle='#efb444';ctx.beginPath();ctx.moveTo(-.028,-.087);ctx.lineTo(.028,-.087);ctx.lineTo(0,-.044);ctx.closePath();ctx.fill();
  for(const side of [-1,1]){ctx.fillStyle='#ce992b';ctx.beginPath();ctx.arc(side*.04,-.121,.018,0,TAU);ctx.fill();ctx.fillStyle='#161b19';ctx.beginPath();ctx.arc(side*.04,-.122,.009,0,TAU);ctx.fill();}
  ctx.restore();
}
function leapingFish(ctx,p,size,time,reduced,id){
  const tail=reduced?0:Math.sin(time*12+id*.61)*.06;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(size,size);
  // Water-level rings and a small spray explain where the fish breaks the
  // surface, while the body uses the same airborne lift as physical contact.
  const splash=.4+.6*Math.max(0,1-p.lift/.72),radius=.24+.06*Math.sin(Math.PI*p.leapProgress);
  ctx.strokeStyle='#b4fff3';ctx.lineWidth=.012;ctx.globalAlpha*=splash*.82;
  ctx.beginPath();ctx.ellipse(0,0,radius,.052,0,0,TAU);ctx.stroke();
  ctx.beginPath();ctx.ellipse(0,.006,radius*.73,.031,0,0,TAU);ctx.stroke();
  if(!reduced)for(let i=0;i<6;i++){
    const angle=i*2.399+id*.1,t=fract(time*2.2+i/6),spread=.13+t*.23;
    ctx.beginPath();ctx.arc(Math.cos(angle)*spread,-Math.sin(t*Math.PI)*.13,.007*(1-t)+.003,0,TAU);ctx.fillStyle='#d1fffa';ctx.fill();
  }
  ctx.restore();
  ctx.save();ctx.translate(p.x,p.bodyY);ctx.scale(size,size);
  ctx.rotate(-Math.cos(Math.PI*p.leapProgress)*.24);
  // A broad forked tail, red dorsal sail and bright scale bands create a
  // distinct salmon silhouette, with a compact low jump-compatible body.
  ctx.fillStyle='#d66b43';ctx.beginPath();ctx.moveTo(-.2,-.01);ctx.lineTo(-.43,-.16+tail);ctx.quadraticCurveTo(-.37,-.02,-.43,.15+tail);ctx.lineTo(-.2,.027);ctx.closePath();ctx.fill();
  ctx.fillStyle='#9c3438';ctx.beginPath();ctx.moveTo(-.16,-.063);ctx.lineTo(-.055,-.205);ctx.lineTo(.04,-.105);ctx.lineTo(.13,-.056);ctx.closePath();ctx.fill();
  const scales=ctx.createLinearGradient(0,-.095,0,.08);scales.addColorStop(0,'#3c7782');scales.addColorStop(.43,'#b3e1d0');scales.addColorStop(.72,'#f1dca2');scales.addColorStop(1,'#749d96');ctx.fillStyle=scales;
  ctx.beginPath();ctx.moveTo(-.24,0);ctx.bezierCurveTo(-.11,-.13,.18,-.12,.32,-.015);ctx.quadraticCurveTo(.345,.01,.305,.04);ctx.bezierCurveTo(.13,.115,-.1,.1,-.24,0);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#56878a88';ctx.lineWidth=.009;
  for(let i=0;i<5;i++){const x=-.12+i*.057;ctx.beginPath();ctx.moveTo(x,-.055);ctx.quadraticCurveTo(x-.033,0,x,.06);ctx.stroke();}
  ctx.fillStyle='#d4844f';ctx.beginPath();ctx.moveTo(.02,.025);ctx.lineTo(-.02,.14);ctx.lineTo(.12,.07);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#437582';ctx.lineWidth=.009;ctx.beginPath();ctx.moveTo(.2,-.044);ctx.quadraticCurveTo(.15,0,.2,.052);ctx.stroke();
  ctx.fillStyle='#ffe39a';ctx.beginPath();ctx.arc(.255,-.025,.024,0,TAU);ctx.fill();ctx.fillStyle='#142b30';ctx.beginPath();ctx.arc(.26,-.025,.013,0,TAU);ctx.fill();
  ctx.strokeStyle='#fff5dba8';ctx.lineWidth=.008;ctx.beginPath();ctx.moveTo(-.16,-.031);ctx.quadraticCurveTo(.06,-.087,.22,-.043);ctx.stroke();
  ctx.restore();
}
function relicTarget(ctx,p,size,time,reduced){
  const spin=reduced?1:.72+.28*Math.abs(Math.cos(time*3.2));
  ctx.save();ctx.translate(p.x,p.y-size*.53);ctx.fillStyle='#5af7e927';ctx.beginPath();ctx.ellipse(0,0,size*.63,size*.62,0,0,TAU);ctx.fill();ctx.scale(spin,1);
  ctx.strokeStyle='#715527';ctx.lineWidth=size*.105;ctx.beginPath();ctx.arc(0,0,size*.39,0,TAU);ctx.stroke();ctx.strokeStyle='#ffe09a';ctx.lineWidth=size*.061;ctx.stroke();
  ctx.fillStyle='#2a837c';ctx.beginPath();ctx.moveTo(0,-size*.315);ctx.lineTo(size*.23,0);ctx.lineTo(0,size*.315);ctx.lineTo(-size*.23,0);ctx.closePath();ctx.fill();
  ctx.fillStyle='#8cfff1';ctx.beginPath();ctx.moveTo(0,-size*.315);ctx.lineTo(0,size*.04);ctx.lineTo(-size*.23,0);ctx.closePath();ctx.fill();ctx.fillStyle='#4be1ce';ctx.beginPath();ctx.moveTo(0,-size*.315);ctx.lineTo(size*.23,0);ctx.lineTo(0,size*.04);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#fff3c5';ctx.lineWidth=Math.max(.75,size*.022);ctx.beginPath();ctx.moveTo(0,-size*.315);ctx.lineTo(size*.23,0);ctx.lineTo(0,size*.315);ctx.lineTo(-size*.23,0);ctx.closePath();ctx.stroke();ctx.restore();
}
function sprite(ctx, atlas, index, x, bottom, w, rotation = 0, alpha = 1, squeeze = 1) {
  const [sx,sy,sw,sh] = regions[index], h = w * sh / sw;
  ctx.save();ctx.globalAlpha *= alpha;ctx.translate(x,bottom);ctx.rotate(rotation);ctx.scale(squeeze,1);
  ctx.drawImage(atlas,sx,sy,sw,sh,-w/2,-h,w,h);ctx.restore();
}
function water(ctx,g,art,w,h,reduce,active) {
  drawWater(ctx,g,art,w,h,reduce,active);
  drawCanopyTerrain2D(ctx,g,art,w,h,projection);
  if(levelAt(g.levelIndex).index>0)drawMap2D(ctx,g,art,w,h,reduce,projection);
  // Near whitewater flows on the course plane at every display frame,
  // independent of video fps; Redstone has no painted near-river backdrop.
  if(!reduce){
    ctx.save();
    for(const patch of rapids(g.distance,VIEW_DISTANCE)){
      const at=projection(w,h,patch.lane,patch.z),size=at.corridor*patch.width*at.scale;
      ctx.globalAlpha=Math.min(.8,at.scale*.9)*Math.min(1,(VIEW_DISTANCE-patch.z)/24);
      ctx.drawImage(art.world.foam[patch.variant],at.x-size/2,at.y-size*.035,size,size*.075);
    }
    ctx.restore();
  }
  // Faint projected guides stay legible without resembling stationary rails.
  ctx.save();ctx.lineWidth = 1;ctx.setLineDash([10,20]);ctx.lineDashOffset = -g.distance*3;
  ctx.strokeStyle = levelAt(g.levelIndex).index===2?'rgba(203,196,255,.2)':'rgba(214,255,246,.22)';
  for(const lane of [.5,1.5]) {
    const far=projection(w,h,lane,VIEW_DISTANCE), near=projection(w,h,lane,-10);
    ctx.beginPath();ctx.moveTo(far.x,far.y);ctx.lineTo(near.x,near.y);ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}
function shorelineTree(ctx,g,e,art,w,h){
  let profile=courseProfiles.get(g);if(!profile){const level=levelAt(g.levelIndex);profile=createCourseProfile(g.seed,level.length,level.index);courseProfiles.set(g,profile);}
  let shape=branchShapes.get(e);if(!shape){shape=shorelineBranch(e,e.d,profile);branchShapes.set(e,shape);}
  const locate=n=>{const p=projection(w,h,1+n.x/3.8,e.d+n.d-g.distance),unit=p.corridor/11.4*p.scale;return{x:p.x,y:p.y-n.y*unit,unit};};
  ctx.save();ctx.globalAlpha=Math.min(1,(VIEW_DISTANCE-e.d+g.distance)/24);ctx.lineCap='round';
  const bark=ctx.createPattern(art.treebark??art.surfacewood,'repeat');
  for(const limb of shape.wood){
    const points=Array.from({length:13},(_,i)=>{const t=i/12,p=locate(limbPoint(limb,t));return{...p,r:Math.max(.5,(limb.r+(limb.rEnd-limb.r)*t)*p.unit)};});
    const left=[],right=[];
    for(let i=0;i<points.length;i++){
      const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
      left.push({x:p.x-dy/length*p.r,y:p.y+dx/length*p.r});right.push({x:p.x+dy/length*p.r,y:p.y-dx/length*p.r});
    }
    ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);for(const p of left.slice(1))ctx.lineTo(p.x,p.y);for(const p of right.reverse())ctx.lineTo(p.x,p.y);ctx.closePath();
    ctx.fillStyle=bark;ctx.fill();ctx.strokeStyle='#30291f99';ctx.lineWidth=.75;ctx.stroke();
    ctx.strokeStyle='#e3cf9b30';ctx.lineWidth=Math.max(.5,points[0].r*.25);ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);for(const p of left.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();
  }
  for(const leaf of shape.leaves){const p=locate(leaf.p),lw=leaf.size[0]*p.unit*2,lh=leaf.size[1]*p.unit*2;ctx.drawImage(art.branchLeaves,p.x-lw/2,p.y-lh/2,lw,lh);}
  ctx.restore();
}
function banks(ctx,g,art,w,h,reduce){
  if(levelAt(g.levelIndex).index>0){drawMapBanks2D(ctx,g,art,w,h,reduce,projection,VIEW_DISTANCE);return;}
  if(reduce)return;
  ctx.save();
  for(const item of bankScenery(g.distance,VIEW_DISTANCE)){
    const at=projection(w,h,item.lane,item.z),size=at.corridor*.27*item.size*at.scale;
    if(at.x+size*.8<0||at.x-size*.8>w)continue;
    // Keep silhouettes outside the playable corridor, including near props.
    ctx.globalAlpha=Math.min(1,(VIEW_DISTANCE-item.z)/25);
    // Reuse the approved detailed mossy rock texture; bank-only clusters are
    // grounded beyond the river lanes and cannot be confused with a hazard.
    sprite(ctx,art.sprites,3,at.x,at.y,size,item.variant*.12);
    if(item.kind===1)sprite(ctx,art.sprites,3,at.x+(item.lane<1?-1:1)*size*.42,at.y+size*.025,size*.6,-.2);
  }
  ctx.restore();
}
export function renderGame(ctx,g,art,width,height,reducedMotion=false,active=true,fatalElapsed=0) {
  ctx.clearRect(0,0,width,height);
  water(ctx,g,art,width,height,reducedMotion,active);
  drawRapids2D(ctx,g,width,height,reducedMotion,projection);
  banks(ctx,g,art,width,height,reducedMotion);
  drawFinish2D(ctx,g,width,height,projection,VIEW_DISTANCE,art.map2d.finish,reducedMotion);
  if(!motions.has(g))motions.set(g,createMotion(g));
  const motion=advanceMotion(motions.get(g),g,reducedMotion);
  const player=projection(width,height,g.visualLane,0);
  const heroWidth=Math.min(width*.33,height*.255,width/height<.85?480:245);
  const impact=impactFeedback(g,reducedMotion,fatalElapsed);
  const shake=impact.shakeX*heroWidth*.5;
  if(g.rush>0) {
    ctx.fillStyle='rgba(17,224,203,.1)';ctx.fillRect(0,0,width,height);
    if(!reducedMotion) {
      ctx.save();ctx.strokeStyle='#c9ffef80';ctx.lineWidth=2;
      for(let i=0;i<12;i++) { const x=width*fract(i*.618+g.time*.04), y=height*fract(i*.37+g.time*.75);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(x-width/2)*.05,y+50);ctx.stroke(); }ctx.restore();
    }
  }
  // Distant entities draw first. The player is inserted at collision depth.
  const visible=g.entities.filter(e=>worldEntityVisible(e,g.distance,VIEW_DISTANCE)).sort((a,b)=>b.d-a.d);
  for(const e of visible) {
    const encounter=!!e.enemy||e.type==='target';
    const z=e.d-g.distance, p=encounter?encounterProjection(e,g,width,height):projection(width,height,e.lane,z);
    let size;
    if(e.type==='coin') size=heroWidth*.28*p.scale;
    else if(e.type==='target')size=heroWidth*.4*p.scale;
    else if(e.type==='magnet'||e.type==='shield') size=heroWidth*.52*p.scale;
    else size=p.corridor/3*(e.type==='branch'&&!e.enemy ? 1.02 : .86)*p.scale;
    const high=coinPixelLift(e,heroWidth,p.scale);
    const bottom=p.y-high;
    if(e.type==='coin'||e.type==='magnet'||e.type==='shield') {
      ctx.save();ctx.fillStyle=e.type==='coin'?'#ffcf5f28':'#7dfdd33b';ctx.beginPath();ctx.ellipse(p.x,bottom-size*.43,size*.53,size*.63,0,0,TAU);ctx.fill();ctx.restore();
    }
    if(encounter){
      ctx.save();ctx.globalAlpha=Math.min(1,(VIEW_DISTANCE-z)/24);
      if(!e.done)encounterGuide(ctx,e,p,e.type==='target'?p.corridor/3*.65*p.scale:size);
      if(e.enemy==='crocodile')crocodile(ctx,p,size,g.time,reducedMotion);
      else if(e.enemy==='bird')swoopingBird(ctx,p,size,g.time,reducedMotion);
      else if(e.enemy==='fish')leapingFish(ctx,p,size,g.time,reducedMotion,e.id);
      else relicTarget(ctx,p,size,g.time,reducedMotion);
      ctx.restore();
    }
    else if(e.type==='branch')shorelineTree(ctx,g,e,art,width,height);
    else sprite(ctx,art.sprites,e.type==='magnet'?indexes.coin:indexes[e.type],p.x,bottom,size,e.type==='coin' && !reducedMotion?Math.sin(g.time*3+e.id)*.045:0,1,e.type==='coin'&&!reducedMotion?.28+.72*Math.abs(Math.cos(g.time*5+e.id)):1);
    if(e.type==='magnet'){ctx.save();ctx.font=`900 ${Math.max(12,size*.3)}px system-ui`;ctx.textAlign='center';ctx.strokeStyle='#3f2e14';ctx.lineWidth=3;ctx.strokeText('×2',p.x,bottom-size*.32);ctx.fillStyle='#fff8d0';ctx.fillText('×2',p.x,bottom-size*.32);ctx.restore();}
    if(!e.done&&['log','branch','rock'].includes(e.type)&&z<g.speed*1.65&&z>10) {
      const label=e.enemy==='crocodile'?'CROC · JUMP ↑':e.enemy==='bird'?'BIRD · DUCK ↓':e.enemy==='fish'?'FISH · JUMP ↑':e.type==='log'?'JUMP ↑':e.type==='branch'?'DUCK ↓':'DODGE ↔';
      const font=Math.max(10,15*p.scale);ctx.font=`800 ${font}px system-ui`;ctx.textAlign='center';
      const labelX=e.enemy?p.destination.x:p.x,tw=ctx.measureText(label).width;ctx.fillStyle='#042a26dd';ctx.beginPath();ctx.roundRect(labelX-tw/2-7,bottom-size*.9-22,tw+14,20,5);ctx.fill();
      ctx.fillStyle=e.type==='branch'?'#94ffe3':'#ffe49c';ctx.fillText(label,labelX,bottom-size*.9-8);
    }
  }
  const lift=jumpHeight(g)*heroWidth*.95;
  const bob=reducedMotion?0:Math.sin(g.distance*.65)*heroWidth*.006;
  // Ground shadow remains while the entire raft lifts; landing wakes explain timing.
  ctx.save();ctx.fillStyle='#053c4670';ctx.beginPath();ctx.ellipse(player.x,player.foot+4,heroWidth*.44*(1-jumpHeight(g)*.18),heroWidth*.095,0,0,TAU);ctx.fill();ctx.restore();
  if(!reducedMotion) {
    ctx.save();ctx.strokeStyle='#e9fffaaa';ctx.lineWidth=2;
    for(let i=0;i<6;i++){const t=fract(g.time*1.6+i/6);ctx.globalAlpha=1-t;ctx.beginPath();ctx.ellipse(player.x,player.foot+t*heroWidth*.4,heroWidth*(.35+t*.23),heroWidth*(.035+t*.06),0,.12,Math.PI-.12);ctx.stroke();}ctx.restore();
  }
  if(g.shield||g.rush>0||g.grace>0) {
    ctx.save();ctx.strokeStyle=g.rush?'#fff0a4':'#8cfff1';ctx.lineWidth=2;ctx.fillStyle='#81ffe90a';
    ctx.beginPath();ctx.ellipse(player.x,player.foot-heroWidth*.32-lift,heroWidth*.58,heroWidth*.37,0,.12,Math.PI-.12);ctx.stroke();ctx.restore();
  }
  const roll=reducedMotion?0:Math.max(-.16,Math.min(.16,-g.laneVelocity*.016))+Math.sin(g.distance*.13)*.01+impact.roll;
  const landing=landingPulse(motion,g.time,reducedMotion);
  if(!reducedMotion&&Math.abs(g.lane-g.visualLane)>.03){
    ctx.save();ctx.strokeStyle='#c8fff99c';ctx.lineWidth=2;
    for(let i=0;i<3;i++){const side=Math.sign(g.lane-g.visualLane);ctx.beginPath();ctx.moveTo(player.x-side*heroWidth*(.4+i*.12),player.foot+i*6);ctx.lineTo(player.x-side*heroWidth*(.9+i*.15),player.foot+20+i*8);ctx.stroke();}ctx.restore();
  }
  const bottom=player.foot-lift+bob+landing*heroWidth*.08+impact.recoil*heroWidth*.075+impact.shakeY*heroWidth*.5;
  const alpha=g.grace>0&&Math.floor(g.time*12)%2?.7:1;
  const pose=riderPose(g,reducedMotion);
  const frame=art.downstreamFrames[pose.index];
  hero(ctx,frame,art.paddleFrames[0],player.x+shake,bottom,heroWidth,roll,alpha,landing+Math.abs(impact.pitch),impact.brace);
  for(const effect of g.effects){
    if(effect.type!=='target')continue;
    const age=g.time-(effect.contactTime??effect.time),duration=reducedMotion?.28:.55;
    if(age<0||age>=duration)continue;
    const at=projection(width,height,effect.lane,0),progress=age/duration;
    ctx.save();ctx.globalAlpha=1-progress;ctx.strokeStyle='#99ffed';ctx.lineWidth=Math.max(2,heroWidth*.014);
    ctx.beginPath();ctx.ellipse(at.x,at.foot-heroWidth*.17,heroWidth*(.22+(reducedMotion?0:progress*.22)),heroWidth*.13,0,0,TAU);ctx.stroke();
    ctx.font=`900 ${Math.max(14,heroWidth*.15)}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#d9fff2';ctx.strokeStyle='#123d35';ctx.lineWidth=3;
    const y=at.foot-heroWidth*(.43+(reducedMotion?0:progress*.2));ctx.strokeText(`+${effect.value??200}`,at.x,y);ctx.fillText(`+${effect.value??200}`,at.x,y);ctx.restore();
  }
  if(impact.active){
    // A local contact halo stays readable under reduced motion. It never
    // becomes a full-screen white flash or hides the next hazard.
    ctx.save();ctx.globalAlpha=Math.max(impact.flash,impact.strength*.28);ctx.strokeStyle=impact.fatal?'#ff9b70':'#9bfff0';ctx.lineWidth=Math.max(3,heroWidth*.035);
    ctx.beginPath();ctx.ellipse(player.x,bottom-heroWidth*.28,heroWidth*.58,heroWidth*.44,roll,0,TAU);ctx.stroke();ctx.restore();
    if(!reducedMotion){
      const p={};ctx.save();ctx.globalAlpha=Math.max(.05,1-impact.age/.62);ctx.fillStyle='#d6fff8';
      for(let i=0;i<impact.splashParticles+impact.shieldShards;i++){
        impactParticle(i,impact,p);const px=player.x+p.x*heroWidth*.25,py=player.foot-p.y*heroWidth*.24+p.z*heroWidth*.024;
        if(p.shard){ctx.save();ctx.translate(px,py);ctx.rotate(i*2.4+impact.age*5);ctx.fillRect(-heroWidth*.012,-heroWidth*.035,heroWidth*.024,heroWidth*.07);ctx.restore();}
        else{ctx.beginPath();ctx.arc(px,py,Math.max(1,heroWidth*.012*(1-impact.age/.65)),0,TAU);ctx.fill();}
      }ctx.restore();
    }
  }
  if(!reducedMotion){
    // Paddle-tip spray follows the stroke instead of covering hazards.
    if(motion.weights[0]>.8&&paddleSample(g.distance).index<4){
      ctx.save();ctx.strokeStyle='#d4fffaca';ctx.lineWidth=1.5;
      for(let i=0;i<6;i++){const t=fract(g.time*4+i/6);ctx.globalAlpha=(1-t)*.65;ctx.beginPath();ctx.arc(player.x-heroWidth*.62-t*heroWidth*.08,player.foot-heroWidth*.08-Math.sin(t*Math.PI)*heroWidth*.11,1.5,0,TAU);ctx.stroke();}ctx.restore();
    }
    if(g.magnet>0){
      ctx.save();ctx.strokeStyle='#ffe5a69c';ctx.lineWidth=1.8;
      for(let i=0;i<3;i++){const a=g.time*2+i*TAU/3;ctx.beginPath();ctx.ellipse(player.x,player.foot-heroWidth*.38-lift,heroWidth*.57,heroWidth*.22,a*.12,a,a+.8);ctx.stroke();}ctx.restore();
    }
    for(const e of motion.bursts){
      if(e.type==='hit')continue; // Contact droplets now share the 3D impact beat.
      const age=g.time-e.time,t=age/.55,at=projection(width,height,e.lane,0),land=e.type==='land',hit=e.type==='hit';
      const centerY=at.foot-(land?0:heroWidth*.45);
      ctx.save();ctx.globalAlpha=(1-t)*(1-t);ctx.strokeStyle=hit?'#b8fff5':'#fff0b0';ctx.fillStyle=land||hit?'#cafff7':'#ffe083';ctx.lineWidth=2;
      if(land){ctx.beginPath();ctx.ellipse(at.x,at.foot,heroWidth*(.4+age*.75),heroWidth*(.05+age*.15),0,0,TAU);ctx.stroke();}
      for(let i=0;i<(land?10:12);i++){
        const angle=i*2.399,radius=age*(heroWidth*.45+i*2),x=at.x+Math.cos(angle)*radius,y=centerY+Math.sin(angle)*radius*(land?.3:.65)-Math.sin(Math.min(1,age/.55)*Math.PI)*heroWidth*.14;
        if(e.type==='smash'&&e.obstacle){
          const [sx,sy,sw,sh]=regions[indexes[e.obstacle]],cx=i%2,cy=Math.floor(i/2)%2,sz=heroWidth*.13;
          if(i>3)continue;ctx.save();ctx.translate(x,y);ctx.rotate(age*(i%2?5:-5));ctx.drawImage(art.sprites,sx+cx*sw/2,sy+cy*sh/2,sw/2,sh/2,-sz/2,-sz/2,sz,sz);ctx.restore();
        }else if(hit){ctx.save();ctx.translate(x,y);ctx.rotate(angle+age*3);ctx.fillRect(-3,-7,6,14);ctx.restore();}
        else{ctx.beginPath();ctx.arc(x,y,Math.max(1,heroWidth*.015*(1-t)),0,TAU);ctx.fill();}
      }ctx.restore();
    }
    const target=art.coinTarget??{x:width*.5,y:40};
    for(const e of motion.pickups){
      const t=pickupProgress(e,g.time),at=projection(width,height,e.lane,0),startY=at.foot-coinFlightPixelLift(e,heroWidth);
      const ease=t*t*(3-2*t),x=at.x+(target.x-at.x)*ease,y=startY+(target.y-startY)*ease-Math.sin(t*Math.PI)*heroWidth*.24;
      if(t<.4){const contact=projection(width,height,e.playerLane??e.lane,0);ctx.save();ctx.globalAlpha=1-t/.4;ctx.strokeStyle='#fff7d2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(contact.x,contact.foot-heroWidth*((e.playerHeight??0)*.95+.15),heroWidth*(.06+t*.22),0,TAU);ctx.stroke();ctx.restore();}
      ctx.save();ctx.globalAlpha=Math.min(1,(1-t)*5);ctx.strokeStyle='#ffe29c88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-(target.x-at.x)*.025,y+16);ctx.stroke();
      sprite(ctx,art.sprites,6,x,y+9,heroWidth*(.17*(1-t)+.05),g.time*3,1,.4+.6*Math.abs(Math.cos(g.time*9)));ctx.restore();
    }
  }
  if(g.phase==='lost') {ctx.fillStyle=`rgba(9,41,45,${.16+Math.min(.16,fatalElapsed*.25)})`;ctx.fillRect(0,0,width,height);}
  return impact;
}
