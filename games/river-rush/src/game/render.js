import { jumpHeight, VIEW_DISTANCE } from './engine.js';
import { foamDepth } from './quality.js';
import { drawWater } from './water.js';
import { createMotion, advanceMotion, landingPulse, impactPulse, pickupProgress, paddleSample } from './motion.js';
const motions=new WeakMap();
const TAU = Math.PI * 2, fract = n => n - Math.floor(n);
// Generated atlas has unequal row heights; rectangles preserve full silhouettes.
const regions = [
  [0,0,435,540],[435,0,415,540],[850,0,404,540],
  [0,545,430,355],[430,550,420,350],[850,545,404,360],
  [0,900,425,354],[425,900,425,354],[850,900,404,354]
];
const indexes = { rock: 3, log: 4, branch: 5, coin: 6, magnet: 7, shield: 8 };
let artPromise;
export function loadArt() {
  return artPromise??=Promise.all([['environment','runner-river'],['portrait','runner-portrait'],['sprites','runner-sprites'],['menu','menu'],['paddle','paddle-frames']].map(([key,name]) => new Promise((resolve,reject) => {
    const image = new Image(); image.onload = () => resolve([key,image]); image.onerror = () => reject(new Error(`Could not load ${name}.`)); image.src = `${import.meta.env.BASE_URL}art/${name}.png`;
  }))).then(entries => prepareHeroArt(Object.fromEntries(entries)));
}
const paddleAnchors=[[264,422],[264,422],[265,422],[265,422],[266,408],[264,408],[266,408],[265,410]];
async function prepareHeroArt(art){
  function frame(source,rect,anchor,raftWidth){
    const canvas=document.createElement('canvas');canvas.width=448;canvas.height=480;
    const scale=300/raftWidth,ctx=canvas.getContext('2d');
    ctx.drawImage(source,...rect,224-anchor[0]*scale,464-anchor[1]*scale,rect[2]*scale,rect[3]*scale);return canvas;
  }
  const sw=art.paddle.width/4,sh=art.paddle.height/2;
  const frames=paddleAnchors.map((anchor,i)=>frame(art.paddle,[i%4*sw,Math.floor(i/4)*sh,sw,sh],anchor,350));
  art.paddleFrames=[];
  // Six cached in-betweens per source frame: 72 pose samples/second at
  // starting speed. No blending/readback is needed in the hot render loop.
  for(let i=0;i<8;i++)for(let step=0;step<6;step++){
    const canvas=document.createElement('canvas');canvas.width=448;canvas.height=380;
    const ctx=canvas.getContext('2d'),t=step/6;
    ctx.globalAlpha=1-t;ctx.drawImage(frames[i],0,100,448,380,0,0,448,380);
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=t;ctx.drawImage(frames[(i+1)%8],0,100,448,380,0,0,448,380);
    try{art.paddleFrames.push(await createImageBitmap(canvas));}catch{art.paddleFrames.push(canvas);}
  }
  art.actionFrames=[null,frame(art.sprites,regions[1],[207,535],414),frame(art.sprites,regions[2],[206,537],370)];
  return art;
}
function hero(ctx,frame,x,bottom,width,roll,alpha=1,squash=0){
  const scale=width/300;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,bottom);ctx.rotate(roll);ctx.scale(1+squash*.025,1-squash*.05);
  ctx.drawImage(frame,-frame.width/2*scale,-(frame.height-16)*scale,frame.width*scale,frame.height*scale);ctx.restore();
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
  // The photographic river is an art layer; moving foam and projected objects
  // communicate forward speed without stretching thin image scanlines.
  // Lane guidance lives on the water plane, so coins and hazards share it.
  ctx.save();ctx.lineWidth = 1;ctx.setLineDash([10,20]);ctx.lineDashOffset = -g.distance*3;
  ctx.strokeStyle = 'rgba(214,255,246,.22)';
  for(const lane of [.5,1.5]) {
    const far=projection(w,h,lane,VIEW_DISTANCE), near=projection(w,h,lane,-10);
    ctx.beginPath();ctx.moveTo(far.x,far.y);ctx.lineTo(near.x,near.y);ctx.stroke();
  }
  ctx.setLineDash([]);
  if(!reduce) for(let i=0;i<64;i++) {
    const z=foamDepth(i,g.distance,VIEW_DISTANCE);
    const lane=fract(i*.381)*3-.5, at=projection(w,h,lane,z);
    ctx.strokeStyle=`rgba(234,255,250,${.08+at.scale*.38})`;ctx.lineWidth=Math.max(1,at.scale*2.5);
    ctx.beginPath();ctx.moveTo(at.x,at.y);ctx.lineTo(at.x+(lane-1)*at.scale*6,at.y+at.scale*at.scale*(g.rush?90:44));ctx.stroke();
  }
  ctx.restore();
}
export function renderGame(ctx,g,art,width,height,reducedMotion=false,active=true) {
  water(ctx,g,art,width,height,reducedMotion,active);
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
  const visible=g.entities.filter(e=>!e.done && e.d-g.distance<VIEW_DISTANCE && e.d-g.distance>-14).sort((a,b)=>b.d-a.d);
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
    sprite(ctx,art.sprites,indexes[e.type],p.x,bottom,size,e.type==='coin' && !reducedMotion?Math.sin(g.time*3+e.id)*.045:0,1,e.type==='coin'&&!reducedMotion?.28+.72*Math.abs(Math.cos(g.time*5+e.id)):1);
    if(['log','branch','rock'].includes(e.type)&&z<60&&z>10) {
      const label=e.type==='log'?'JUMP ↑':e.type==='branch'?'DUCK ↓':'DODGE ↔';
      const font=Math.max(10,15*p.scale);ctx.font=`800 ${font}px system-ui`;ctx.textAlign='center';
      const tw=ctx.measureText(label).width;ctx.fillStyle='#042a26dd';ctx.beginPath();ctx.roundRect(p.x-tw/2-7,bottom-size*.9-22,tw+14,20,5);ctx.fill();
      ctx.fillStyle=e.type==='branch'?'#94ffe3':'#ffe49c';ctx.fillText(label,p.x,bottom-size*.9-8);
    }
  }
  const lift=jumpHeight(g)*heroWidth*.70;
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
  const roll=reducedMotion?0:(g.lane-g.visualLane)*-.13+Math.sin(g.time*5)*.018;
  const landing=landingPulse(motion,g.time,reducedMotion);
  if(!reducedMotion&&Math.abs(g.lane-g.visualLane)>.03){
    ctx.save();ctx.strokeStyle='#c8fff99c';ctx.lineWidth=2;
    for(let i=0;i<3;i++){const side=Math.sign(g.lane-g.visualLane);ctx.beginPath();ctx.moveTo(player.x-side*heroWidth*(.4+i*.12),player.foot+i*6);ctx.lineTo(player.x-side*heroWidth*(.9+i*.15),player.foot+20+i*8);ctx.stroke();}ctx.restore();
  }
  const bottom=player.foot-lift+bob+landing*heroWidth*.08;
  const alpha=g.grace>0&&Math.floor(g.time*12)%2?.7:1;
  const pose=g.action==='jump'?1:g.action==='duck'?2:0;
  if(pose){hero(ctx,art.actionFrames[pose],player.x+shake,bottom,heroWidth,roll,alpha);}
  else{
    const sample=paddleSample(g.distance,reducedMotion);
    const frame=art.paddleFrames[sample.index*6+Math.floor(sample.blend*6)];
    hero(ctx,frame,player.x+shake,bottom,heroWidth,roll,alpha,landing);
  }
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
