import { jumpHeight, VIEW_DISTANCE } from './engine.js';
import { bankScenery, rapids, prepareWorldArt } from './world.js';
import { riderPose, RIDER_SIZE } from './rider.js';
import { drawWater } from './water.js';
import { createMotion, advanceMotion, landingPulse, impactPulse, pickupProgress, paddleSample } from './motion.js';
import {shorelineBranch,branchLeafArt,limbPoint} from './shoreline-branch.js';
import { levelAt } from './levels.js';
import { prepareMap2D, drawMap2D, drawMapBanks2D, drawFinish2D } from './map-2d.js';
const motions=new WeakMap();
const branchShapes=new WeakMap();
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
  sources.push(['mapjungle','valley-vista','webp',true],['mapcanyon','map-canyon','webp',true],['mapruins','map-ruins','webp',true]);
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
function hero(ctx,frame,raft,x,bottom,width,roll,alpha=1,squash=0){
  const scale=width/300;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,bottom);ctx.rotate(roll);ctx.scale(1+squash*.025,1-squash*.05);
  const split=raft.height-88;
  ctx.drawImage(raft,74,split,300,88,-150*scale,(split-raft.height+16)*scale,300*scale,88*scale);ctx.restore();
  // Draw the independent rider above the deck. A crouch keeps its own anatomy
  // and the same foot registration; it is never a vertically squashed jump.
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,bottom);ctx.rotate(roll);
  const riderScale=width/512;
  ctx.drawImage(frame,-frame.width/2*riderScale,-RIDER_SIZE.foot*riderScale-width*.14,frame.width*riderScale,frame.height*riderScale);ctx.restore();
}
export function projection(width, height, lane, z) {
  const horizon = height * .29, foot = height * (height < 500 ? .73 : width/height<.85?.77:.8);
  const corridor = Math.min(width * .99, height * 1.17);
  const scale = 1 / (1 + Math.max(-14, z) / 29);
  return { x: width / 2 + (lane - 1) * corridor / 3 * scale, y: horizon + (foot - horizon) * scale, scale, corridor, foot, horizon };
}
function sprite(ctx, atlas, index, x, bottom, w, rotation = 0, alpha = 1, squeeze = 1) {
  const [sx,sy,sw,sh] = regions[index], h = w * sh / sw;
  ctx.save();ctx.globalAlpha *= alpha;ctx.translate(x,bottom);ctx.rotate(rotation);ctx.scale(squeeze,1);
  ctx.drawImage(atlas,sx,sy,sw,sh,-w/2,-h,w,h);ctx.restore();
}
function water(ctx,g,art,w,h,reduce,active) {
  drawWater(ctx,g,art,w,h,reduce,active);
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
  let shape=branchShapes.get(e);if(!shape){shape=shorelineBranch(e,e.d,g.seed);branchShapes.set(e,shape);}
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
export function renderGame(ctx,g,art,width,height,reducedMotion=false,active=true) {
  ctx.clearRect(0,0,width,height);
  water(ctx,g,art,width,height,reducedMotion,active);
  banks(ctx,g,art,width,height,reducedMotion);
  drawFinish2D(ctx,g,width,height,projection,VIEW_DISTANCE);
  if(!motions.has(g))motions.set(g,createMotion(g));
  const motion=advanceMotion(motions.get(g),g,reducedMotion);
  const player=projection(width,height,g.visualLane,0);
  const heroWidth=Math.min(width*.33,height*.255,width/height<.85?480:245);
  const shake=impactPulse(motion,g.time,reducedMotion)*heroWidth*.035;
  if(g.rush>0) {
    ctx.fillStyle='rgba(17,224,203,.1)';ctx.fillRect(0,0,width,height);
    if(!reducedMotion) {
      ctx.save();ctx.strokeStyle='#c9ffef80';ctx.lineWidth=2;
      for(let i=0;i<12;i++) { const x=width*fract(i*.618+g.time*.04), y=height*fract(i*.37+g.time*.75);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(x-width/2)*.05,y+50);ctx.stroke(); }ctx.restore();
    }
  }
  // Distant entities draw first. The player is inserted at collision depth.
  const visible=g.entities.filter(e=>((e.type==='coin'||e.type==='magnet'||e.type==='shield')?!e.collected:!e.done||e.type==='branch') && e.d-g.distance<VIEW_DISTANCE && e.d-g.distance>-16).sort((a,b)=>b.d-a.d);
  for(const e of visible) {
    const z=e.d-g.distance, p=projection(width,height,e.lane,z);
    let size;
    if(e.type==='coin') size=heroWidth*.28*p.scale;
    else if(e.type==='magnet'||e.type==='shield') size=heroWidth*.52*p.scale;
    else size=p.corridor/3*(e.type==='branch' ? 1.02 : .86)*p.scale;
    const high=e.high ? heroWidth*.5*p.scale : 0;
    const bottom=p.y-high;
    if(e.type==='coin'||e.type==='magnet'||e.type==='shield') {
      ctx.save();ctx.fillStyle=e.type==='coin'?'#ffcf5f28':'#7dfdd33b';ctx.beginPath();ctx.ellipse(p.x,bottom-size*.43,size*.53,size*.63,0,0,TAU);ctx.fill();ctx.restore();
    }
    if(e.type==='branch')shorelineTree(ctx,g,e,art,width,height);
    else sprite(ctx,art.sprites,indexes[e.type],p.x,bottom,size,e.type==='coin' && !reducedMotion?Math.sin(g.time*3+e.id)*.045:0,1,e.type==='coin'&&!reducedMotion?.28+.72*Math.abs(Math.cos(g.time*5+e.id)):1);
    if(!e.done&&['log','branch','rock'].includes(e.type)&&z<g.speed*1.65&&z>10) {
      const label=e.type==='log'?'JUMP ↑':e.type==='branch'?'DUCK ↓':'DODGE ↔';
      const font=Math.max(10,15*p.scale);ctx.font=`800 ${font}px system-ui`;ctx.textAlign='center';
      const tw=ctx.measureText(label).width;ctx.fillStyle='#042a26dd';ctx.beginPath();ctx.roundRect(p.x-tw/2-7,bottom-size*.9-22,tw+14,20,5);ctx.fill();
      ctx.fillStyle=e.type==='branch'?'#94ffe3':'#ffe49c';ctx.fillText(label,p.x,bottom-size*.9-8);
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
  const roll=reducedMotion?0:Math.max(-.16,Math.min(.16,-g.laneVelocity*.016))+Math.sin(g.distance*.13)*.01;
  const landing=landingPulse(motion,g.time,reducedMotion);
  if(!reducedMotion&&Math.abs(g.lane-g.visualLane)>.03){
    ctx.save();ctx.strokeStyle='#c8fff99c';ctx.lineWidth=2;
    for(let i=0;i<3;i++){const side=Math.sign(g.lane-g.visualLane);ctx.beginPath();ctx.moveTo(player.x-side*heroWidth*(.4+i*.12),player.foot+i*6);ctx.lineTo(player.x-side*heroWidth*(.9+i*.15),player.foot+20+i*8);ctx.stroke();}ctx.restore();
  }
  const bottom=player.foot-lift+bob+landing*heroWidth*.08;
  const alpha=g.grace>0&&Math.floor(g.time*12)%2?.7:1;
  const pose=riderPose(g,reducedMotion);
  const frame=art.downstreamFrames[pose.index];
  hero(ctx,frame,art.paddleFrames[0],player.x+shake,bottom,heroWidth,roll,alpha,landing);
  if(!reducedMotion){
    // Paddle-tip spray follows the stroke instead of covering hazards.
    if(motion.weights[0]>.8&&paddleSample(g.distance).index<4){
      ctx.save();ctx.strokeStyle='#d4fffaca';ctx.lineWidth=1.5;
      for(let i=0;i<6;i++){const t=fract(g.time*4+i/6);ctx.globalAlpha=(1-t)*.65;ctx.beginPath();ctx.arc(player.x-heroWidth*.62-t*heroWidth*.08,player.foot-heroWidth*.08-Math.sin(t*Math.PI)*heroWidth*.11,1.5,0,TAU);ctx.stroke();}ctx.restore();
    }
    if(g.magnet>0){
      ctx.save();ctx.strokeStyle='#ffb1bf9c';ctx.lineWidth=1.8;
      for(let i=0;i<3;i++){const a=g.time*2+i*TAU/3;ctx.beginPath();ctx.ellipse(player.x,player.foot-heroWidth*.38-lift,heroWidth*.57,heroWidth*.22,a*.12,a,a+.8);ctx.stroke();}ctx.restore();
    }
    for(const e of motion.bursts){
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
      const t=pickupProgress(e,g.time),at=projection(width,height,e.lane,0),startY=at.foot-heroWidth*(e.high?.8:.25);
      let x,y;
      if(e.attracted&&t<.3){const q=t/.3,mid=projection(width,height,e.playerLane,0);x=at.x+(mid.x-at.x)*q;y=startY-Math.sin(q*Math.PI)*heroWidth*.4;}
      else{const q=e.attracted?(t-.3)/.7:t,from=e.attracted?projection(width,height,e.playerLane,0).x:at.x,ease=1-(1-q)*(1-q);x=from+(target.x-from)*ease;y=startY+(target.y-startY)*ease-Math.sin(q*Math.PI)*heroWidth*.24;}
      ctx.save();ctx.globalAlpha=Math.min(1,(1-t)*5);ctx.strokeStyle='#ffe29c88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-(target.x-at.x)*.025,y+16);ctx.stroke();
      sprite(ctx,art.sprites,6,x,y+9,heroWidth*(.23*(1-t)+.09),g.time*3,1,.4+.6*Math.abs(Math.cos(g.time*9)));ctx.restore();
    }
  }
  if(g.phase==='lost') {ctx.fillStyle='#09292d55';ctx.fillRect(0,0,width,height);}
}
