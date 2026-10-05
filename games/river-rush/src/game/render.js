import { jumpHeight, VIEW_DISTANCE } from './engine.js';
const TAU = Math.PI * 2, fract = n => n - Math.floor(n);
// Generated atlas has unequal row heights; rectangles preserve full silhouettes.
const regions = [
  [0,0,435,540],[435,0,415,540],[850,0,404,540],
  [0,545,430,355],[430,550,420,350],[850,545,404,360],
  [0,900,425,354],[425,900,425,354],[850,900,404,354]
];
const indexes = { rock: 3, log: 4, branch: 5, coin: 6, magnet: 7, shield: 8 };
export function loadArt() {
  return Promise.all([['environment','runner-river'],['portrait','runner-portrait'],['sprites','runner-sprites'],['menu','menu']].map(([key,name]) => new Promise((resolve,reject) => {
    const image = new Image(); image.onload = () => resolve([key,image]); image.onerror = () => reject(new Error(`Could not load ${name}.`)); image.src = `${import.meta.env.BASE_URL}art/${name}.png`;
  }))).then(entries => Object.fromEntries(entries));
}
export function projection(width, height, lane, z) {
  const horizon = height * .29, foot = height * (height < 500 ? .73 : .8);
  const corridor = Math.min(width * .99, height * 1.17);
  const scale = 1 / (1 + Math.max(-14, z) / 29);
  return { x: width / 2 + (lane - 1) * corridor / 3 * scale, y: horizon + (foot - horizon) * scale, scale, corridor, foot, horizon };
}
function sprite(ctx, atlas, index, x, bottom, w, rotation = 0, alpha = 1) {
  const [sx,sy,sw,sh] = regions[index], h = w * sh / sw;
  ctx.save();ctx.globalAlpha *= alpha;ctx.translate(x,bottom);ctx.rotate(rotation);
  ctx.drawImage(atlas,sx,sy,sw,sh,-w/2,-h,w,h);ctx.restore();
}
function water(ctx,g,art,w,h,reduce) {
  ctx.drawImage(w/h<.85?art.portrait:art.environment,0,0,w,h);
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
  if(!reduce) for(let i=0;i<46;i++) {
    const z=fract(i*.618+g.distance*.0035)*VIEW_DISTANCE;
    const lane=fract(i*.381)*3-.5, at=projection(w,h,lane,z);
    ctx.strokeStyle=`rgba(234,255,250,${.1+at.scale*.45})`;ctx.lineWidth=Math.max(1,at.scale*2.5);
    ctx.beginPath();ctx.moveTo(at.x,at.y);ctx.lineTo(at.x+(lane-1)*at.scale*6,at.y+at.scale*18);ctx.stroke();
  }
  ctx.restore();
}
export function renderGame(ctx,g,art,width,height,reducedMotion=false) {
  ctx.clearRect(0,0,width,height);
  water(ctx,g,art,width,height,reducedMotion);
  const player=projection(width,height,g.visualLane,0);
  const heroWidth=Math.min(width*.42,height*.255,width/height<.85?480:245);
  const shake=!reducedMotion && g.grace>.75 ? Math.sin(g.time*60)*4 : 0;
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
    sprite(ctx,art.sprites,indexes[e.type],p.x,bottom,size,e.type==='coin' && !reducedMotion?Math.sin(g.time*3+e.id)*.045:0);
    if(['log','branch','rock'].includes(e.type)&&z<60&&z>10) {
      const label=e.type==='log'?'JUMP ↑':e.type==='branch'?'DUCK ↓':'DODGE ↔';
      const font=Math.max(10,15*p.scale);ctx.font=`800 ${font}px system-ui`;ctx.textAlign='center';
      const tw=ctx.measureText(label).width;ctx.fillStyle='#042a26dd';ctx.beginPath();ctx.roundRect(p.x-tw/2-7,bottom-size*.9-22,tw+14,20,5);ctx.fill();
      ctx.fillStyle=e.type==='branch'?'#94ffe3':'#ffe49c';ctx.fillText(label,p.x,bottom-size*.9-8);
    }
  }
  const lift=jumpHeight(g)*heroWidth*.57;
  const bob=reducedMotion?0:Math.sin(g.time*7)*heroWidth*.013;
  // Ground shadow remains while the entire raft lifts; landing wakes explain timing.
  ctx.save();ctx.fillStyle='#053c4670';ctx.beginPath();ctx.ellipse(player.x,player.foot+4,heroWidth*.44*(1-jumpHeight(g)*.18),heroWidth*.095,0,0,TAU);ctx.fill();ctx.restore();
  if(!reducedMotion) {
    ctx.save();ctx.strokeStyle='#e9fffaaa';ctx.lineWidth=2;
    for(let i=0;i<6;i++){const t=fract(g.time*1.6+i/6);ctx.globalAlpha=1-t;ctx.beginPath();ctx.ellipse(player.x,player.foot+t*heroWidth*.4,heroWidth*(.35+t*.23),heroWidth*(.035+t*.06),0,.12,Math.PI-.12);ctx.stroke();}ctx.restore();
  }
  if(g.shield||g.rush>0||g.grace>0) {
    ctx.save();ctx.strokeStyle=g.rush?'#fff0a4':'#8cfff1';ctx.lineWidth=2.5;ctx.fillStyle='#81ffe918';
    ctx.beginPath();ctx.ellipse(player.x,player.foot-heroWidth*.58-lift,heroWidth*.54,heroWidth*.68,0,0,TAU);ctx.fill();ctx.stroke();ctx.restore();
  }
  const pose=g.action==='duck'?2:g.action==='jump'?1:0;
  const roll=reducedMotion?0:(g.lane-g.visualLane)*-.09+Math.sin(g.time*5)*.013;
  sprite(ctx,art.sprites,pose,player.x+shake,player.foot-lift+bob,heroWidth,roll,g.grace>0&&Math.floor(g.time*12)%2?.7:1);
  if(!reducedMotion) for(const e of g.effects) {
    if(['jump','duck','swap'].includes(e.type))continue;
    const age=g.time-e.time,t=age/.75,at=projection(width,height,e.lane,0);
    ctx.save();ctx.globalAlpha=1-t;
    const gold=['coin','perfect'].includes(e.type);
    ctx.fillStyle=gold?'#ffe083':'#a8fff2';
    const count=e.type==='coin'?5:14;
    for(let i=0;i<count;i++){const angle=i*2.399;const radius=age*(60+i*6);ctx.beginPath();ctx.arc(at.x+Math.cos(angle)*radius,at.foot-heroWidth*.48+Math.sin(angle)*radius*.6-age*35,Math.max(1,3*(1-t)),0,TAU);ctx.fill();}
    ctx.restore();
  }
  if(g.phase==='lost') {ctx.fillStyle='#09292d55';ctx.fillRect(0,0,width,height);}
}
