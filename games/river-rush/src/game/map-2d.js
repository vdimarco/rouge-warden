import { levelAt } from './levels.js';
import { bankScenery } from './world.js';
import { currentDistance,WAVE_CADENCE } from './hydrodynamics.js';
import { FINISH_GATE,prepareFinishArt } from './finish-line.js';
import { courseIntensity } from './course-intensity.js';
import { createCourseProfile,rapidAt,riverHash,riverHalfWidth } from './river-course.js';
import {paintMoonlitSky,MOONLIT_LAYERS,moonlitPlacement,moonlitLayerRange} from './moonlit-horizon.js';
import {CENTER_LANE,MAX_LANE,PLAYABLE_HALF_WIDTH,xToLane} from './lanes.js';

// Painted bank aprons keep their perspective scale while leaving every raft
// envelope on water even at the tightest procedural narrows.
export const fallbackBankHalfWidth=(course,profile)=>Math.max(PLAYABLE_HALF_WIDTH+1.1,riverHalfWidth(course,profile)*.5);

// All texture cards are made at loading time. Stage changes only select an
// existing image; the fallback never starts a new graphics context mid-run.
const patternCache=new WeakMap();
const profiles=new WeakMap();
const make=(width,height,paint)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'));return canvas;};
const hash=n=>{let v=Math.imul(n^0x4c71a27,1597334677);v=Math.imul(v^(v>>>16),2246822519);return((v^(v>>>13))>>>0)/4294967296;};

function cliffCard(art,variant){
  return make(384,512,ctx=>{
    const ridges=[[[8,512],[11,326],[34,319],[42,220],[70,214],[84,139],[123,145],[136,76],[175,67],[187,22],[232,30],[248,85],[295,92],[306,184],[338,202],[351,323],[377,348],[384,512]],[[8,512],[28,246],[62,191],[73,85],[111,30],[143,62],[155,189],[227,186],[251,69],[283,45],[313,126],[322,258],[364,348],[384,512]],[[0,512],[24,388],[53,265],[91,208],[117,126],[164,150],[215,105],[248,123],[278,215],[318,259],[353,377],[384,512]]];
    const ridge=ridges[variant];
    ctx.beginPath();ctx.moveTo(...ridge[0]);for(const p of ridge.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.clip();
    const light=ctx.createLinearGradient(0,0,384,0);light.addColorStop(0,'#8c4437');light.addColorStop(.3,'#e8ad73');light.addColorStop(.65,'#b46a49');light.addColorStop(1,'#693c35');ctx.fillStyle=light;ctx.fillRect(0,0,384,512);
    ctx.globalAlpha=.36;ctx.globalCompositeOperation='multiply';ctx.drawImage(art.surfacerock,0,0,384,512);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    for(let i=0;i<18;i++){
      const y=32+i*28+hash(i+variant*71)*16;
      ctx.strokeStyle=i%3===0?'#ffe0ab55':'#572c3550';ctx.lineWidth=i%3===0?3:5;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(93,y+12,204,y-13,384,y+hash(i*27)*17);ctx.stroke();
    }
    for(let i=0;i<11;i++){
      const x=20+i*35,y=hash(i+variant*9)*140;ctx.strokeStyle='#462b3655';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8,320);ctx.lineTo(x+12,512);ctx.stroke();
    }
    ctx.fillStyle='#edcba142';ctx.beginPath();ctx.moveTo(84,139);ctx.lineTo(123,145);ctx.lineTo(139,512);ctx.lineTo(70,512);ctx.fill();
    if(variant===1){ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.ellipse(192,373,46,127,0,0,Math.PI*2);ctx.fill();}
  });
}

function templeCard(art,variant){
  return make(384,512,ctx=>{
    // Stepped sanctuary, projecting ledges, tall carved doors and broken caps.
    const stone=ctx.createLinearGradient(0,0,384,0);stone.addColorStop(0,'#565575');stone.addColorStop(.42,'#aaa3ba');stone.addColorStop(1,'#393d5e');
    const shapes=[[[16,424,352,88],[39,390,306,38],[67,340,251,52],[87,182,211,160],[70,167,247,24],[113,137,165,32],[133,110,125,28],[146,87,100,28],[162,56,65,41],[172,35,40,30]],[[18,434,349,78],[43,398,299,38],[65,193,62,207],[259,193,62,207],[52,174,282,25],[84,136,218,40],[126,103,138,35],[148,81,94,24]],[[69,438,245,74],[94,408,197,33],[110,377,166,33],[141,114,104,265],[125,98,136,20],[151,69,84,30],[171,35,44,36]]];
    const blocks=shapes[variant];
    ctx.fillStyle=stone;for(const [x,y,w,h] of blocks){ctx.fillRect(x,y,w,h);ctx.fillStyle='#cbc7d43a';ctx.fillRect(x,y,w,4);ctx.fillStyle=stone;}
    ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=.35;ctx.drawImage(art.surfacerock,0,0,384,512);ctx.globalAlpha=1;
    for(let y=201;y<510;y+=29){ctx.strokeStyle='#252b4355';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(67,y);ctx.lineTo(318,y);ctx.stroke();for(let x=80+(y%58===0?0:28);x<307;x+=57){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+27);ctx.stroke();}}
    for(const x of variant===0?[119,173,227]:variant===2?[175]:[]){
      ctx.fillStyle='#25253f';ctx.fillRect(x,247,32,90);ctx.fillStyle='#ded5dc66';ctx.fillRect(x-5,240,42,6);ctx.fillStyle='#79758f';ctx.fillRect(x-5,246,5,94);ctx.fillStyle='#30354b';ctx.fillRect(x+32,246,5,94);
    }
    ctx.fillStyle='#526a68';for(let i=0;i<13;i++){const x=96+hash(i+variant*13)*189,y=183+hash(i+43)*167;ctx.beginPath();ctx.ellipse(x,y,10,4,hash(i*3)*3,0,Math.PI*2);ctx.fill();}
    const glow=ctx.createRadialGradient(190,278,0,190,278,44);glow.addColorStop(0,'#dfc28488');glow.addColorStop(1,'#dfc28400');ctx.fillStyle=glow;ctx.fillRect(145,233,89,101);
  });
}

function canyonSkyline(art,layer){
  return make(1536,320,ctx=>{
    // No river, water edge or foreground is baked into this skyline. Its
    // subdued silhouettes can sit at actual distant projection depths.
    const points=[];
    for(let i=0;i<=48;i++){
      const x=i*32,side=Math.abs(x/768-1),ridge=35+hash(i+layer*91)*55;
      const y=305-Math.pow(side,.65)*(ridge+75+layer*24);
      points.push([x,y]);
    }
    ctx.beginPath();ctx.moveTo(0,320);for(const p of points)ctx.lineTo(...p);ctx.lineTo(1536,320);ctx.closePath();ctx.clip();
    const haze=ctx.createLinearGradient(0,80,0,320);
    haze.addColorStop(0,layer===0?'#bca094':'#bf936f');haze.addColorStop(1,layer===0?'#dcb597':'#ceaa83');ctx.fillStyle=haze;ctx.fillRect(0,0,1536,320);
    ctx.globalAlpha=layer===0?.08:.14;ctx.globalCompositeOperation='multiply';ctx.drawImage(art.surfacerock,0,0,1536,320);ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.12;ctx.strokeStyle='#e5c8a0';ctx.lineWidth=2;
    for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(0,145+i*23);ctx.bezierCurveTo(470,138+i*23,820,154+i*23,1536,144+i*23);ctx.stroke();}
  });
}

export function prepareMap2D(art){
  const rivers=[null,...[1,2].map(index=>make(256,256,ctx=>{
    const level=levelAt(index);ctx.fillStyle=level.waterDeep;ctx.fillRect(0,0,256,256);ctx.globalAlpha=.32;ctx.drawImage(art.surfacewater,0,0,256,256);ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.72;ctx.fillStyle=level.waterEdge;ctx.fillRect(0,0,256,256);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    for(let i=0;i<42;i++){const x=hash(i*27)*256,y=hash(i*63+2)*256;ctx.strokeStyle=index===2?'#aebff12e':'#c7efee33';ctx.lineWidth=1+hash(i)*2;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+9,y-3,x+18,y+3,x+29,y);ctx.stroke();}
  }))];
  const grounds=[null,...[1,2].map(index=>make(256,256,ctx=>{
    const level=levelAt(index);ctx.fillStyle=level.ground;ctx.fillRect(0,0,256,256);ctx.globalAlpha=.25;ctx.drawImage(art.surfaceground,0,0,256,256);ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.65;ctx.fillStyle=level.ground;ctx.fillRect(0,0,256,256);
  }))];
  const moonlitSky=make(1024,512,ctx=>paintMoonlitSky(ctx,1024,512));
  const moonlitRidges=[0,1,2].map(layer=>make(512,384,ctx=>{
    const ridge=[];
    for(let i=0;i<=40;i++){
      const x=i*512/40,edge=Math.sin(Math.PI*i/40),crown=(.65+hash(i+layer*79)*.35)*edge;
      ridge.push([x,360-crown*(205+layer*18)-(i%3===1?18*edge:0)]);
    }
    ctx.beginPath();ctx.moveTo(0,384);for(const p of ridge)ctx.lineTo(...p);ctx.lineTo(512,384);ctx.closePath();ctx.clip();
    const shade=ctx.createLinearGradient(0,50,0,384);shade.addColorStop(0,['#596380','#737396','#8b83a6'][layer]);shade.addColorStop(1,['#343e5c','#555571','#716783'][layer]);ctx.fillStyle=shade;ctx.fillRect(0,0,512,384);
    ctx.globalAlpha=.13;ctx.globalCompositeOperation='multiply';ctx.drawImage(art.surfacerock,0,0,512,384);
  }));
  return{rivers,grounds,moonlitSky,moonlitRidges,canyonSkyline:[0,1].map(layer=>canyonSkyline(art,layer)),props:[null,[0,1,2].map(v=>cliffCard(art,v)),[0,1,2].map(v=>templeCard(art,v))],finish:prepareFinishArt()};
}

function drawMoonlitHorizon2D(ctx,g,art,width,height,project){
  const level=levelAt(g.levelIndex),travel=g.distance;
  let profile=profiles.get(g);if(!profile){profile=createCourseProfile(g.seed,level.length,level.index);profiles.set(g,profile);}
  ctx.save();
  for(let i=MOONLIT_LAYERS.length-1;i>=0;i--){
    const layer=MOONLIT_LAYERS[i],range=moonlitLayerRange(travel,layer);let count=0;
    for(let n=range.first;n<=range.last;n++)for(const side of [-1,1]){
      const at=moonlitPlacement(travel,layer,n,side,profile);if(!at||at.visibility<.0001||count>=layer.capacity)continue;count++;
      const p=project(width,height,xToLane(at.x),at.ahead),unit=p.unit;
      const w=at.width*2*unit,h=at.height*1.4*unit,foot=p.y-at.y*unit;
      ctx.globalAlpha=1;ctx.save();ctx.translate(p.x,foot);ctx.scale(side,1);
      ctx.drawImage(art.map2d.moonlitRidges[i],-w/2,-h,w,h);ctx.restore();
    }
  }
  ctx.restore();
}

export function drawMap2D(ctx,g,art,width,height,reduced,project){
  const level=levelAt(g.levelIndex);if(level.index===0)return;
  const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,level.sky);sky.addColorStop(.6,level.fog);sky.addColorStop(1,level.waterDeep);ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  if(level.index===1){
    // Far land receives only small course parallax; bank cards below advance
    // much faster. Covering the screen with the old canyon painting pinned
    // its foreground river in place while the real world rushed underneath.
    for(let layer=0;layer<2;layer++){
      const depth=layer===0?2200:1050,p=project(width,height,CENTER_LANE,depth);
      const ridgeHeight=height*(layer===0?.19:.155),parallax=Math.sin(g.distance*.0008+layer*.7)*width*(layer===0?.007:.017);
      ctx.drawImage(art.map2d.canyonSkyline[layer],-width*.035+parallax,p.y-ridgeHeight,width*1.07,ridgeHeight);
    }
  }
  else if(level.index===2){
    const sky=art.map2d.moonlitSky,scale=Math.max(width/sky.width,height/sky.height),sw=width/scale,sh=height/scale;
    ctx.drawImage(sky,(sky.width-sw)/2,(sky.height-sh)/2,sw,sh,0,0,width,height);
    drawMoonlitHorizon2D(ctx,g,art,width,height,project);
  }
  else{const ground=ctx.createLinearGradient(0,height*.3,0,height);ground.addColorStop(0,level.fog);ground.addColorStop(1,level.ground);ctx.fillStyle=ground;ctx.fillRect(0,height*.3,width,height*.7);}
  let profile=profiles.get(g);if(!profile){profile=createCourseProfile(g.seed,level.length,level.index);profiles.set(g,profile);}
  const edges=[[],[]],distant=project(width,height,CENTER_LANE,1400),near=project(width,height,CENTER_LANE,-14);
  for(let i=0;i<=26;i++){
    const scale=distant.scale+(near.scale-distant.scale)*i/26,z=29*(1/scale-1),p=project(width,height,CENTER_LANE,z);
    const intensity=courseIntensity(g.distance+z,level.length,level.index);
    const bend=(Math.sin((g.distance+z)*.007)-Math.sin(g.distance*.007))*p.corridor*(.05+.07*intensity)*p.scale;
    const half=fallbackBankHalfWidth(g.distance+z,profile)*p.unit;
    edges[0].push([p.x+bend-half,p.y]);edges[1].push([p.x+bend+half,p.y]);
  }
  let patterns=patternCache.get(ctx);if(!patterns){patterns={river:[],ground:[]};patternCache.set(ctx,patterns);}
  patterns.ground[level.index]??=ctx.createPattern(art.map2d.grounds[level.index],'repeat');
  // A course-plane bank apron joins the distant skyline to moving cards.
  // Without it, a tall temple can look suspended in the painted sky.
  for(let side=0;side<2;side++){
    const edge=edges[side],outside=side===0?0:width;
    ctx.save();ctx.beginPath();ctx.moveTo(outside,distant.y);ctx.lineTo(...edge[0]);for(const p of edge.slice(1))ctx.lineTo(...p);ctx.lineTo(outside,near.y);ctx.closePath();ctx.clip();
    const soil=ctx.createLinearGradient(0,distant.y,0,height);soil.addColorStop(0,`${level.fog}00`);soil.addColorStop(.08,`${level.ground}ef`);soil.addColorStop(.35,level.ground);soil.addColorStop(1,level.index===1?'#70483c':'#333c53');ctx.fillStyle=soil;ctx.fillRect(0,distant.y,width,height-distant.y);
    const groundOffset=(g.distance*2)%256;ctx.globalAlpha=.26;ctx.fillStyle=patterns.ground[level.index];ctx.translate(0,groundOffset);ctx.fillRect(0,distant.y+height*.04-groundOffset,width,height);ctx.restore();
  }
  ctx.save();ctx.beginPath();ctx.moveTo(...edges[0][0]);for(const p of edges[0].slice(1))ctx.lineTo(...p);for(const p of [...edges[1]].reverse())ctx.lineTo(...p);ctx.closePath();ctx.clip();
  const river=ctx.createLinearGradient(0,distant.y,0,near.y);river.addColorStop(0,level.waterEdge);river.addColorStop(.35,level.waterDeep);river.addColorStop(1,level.waterEdge);ctx.fillStyle=river;ctx.fillRect(0,distant.y,width,height-distant.y);
  const source=art.map2d.rivers[level.index];patterns.river[level.index]??=ctx.createPattern(source,'repeat');
  const offset=reduced?0:(currentDistance(g.distance,g.time)*8)%256;ctx.translate(0,offset);ctx.globalAlpha=.52;ctx.fillStyle=patterns.river[level.index];ctx.fillRect(0,distant.y-offset,width,height);ctx.globalAlpha=1;ctx.translate(0,-offset);
  if(!reduced){
    // Small living crests use the same downstream phase as GPU current.
    // Projected positions accelerate toward the raft instead of scrolling
    // a full-screen painted river at one uniform screen-space velocity.
    ctx.strokeStyle=level.index===1?'#e0faf466':'#c3d6f555';ctx.lineCap='round';
    const flow=currentDistance(g.distance,g.time);
    for(let i=0;i<26;i++){
      const d=((i*37-flow+14)%254+254)%254-14,lane=.05+hash(i*19)*(MAX_LANE-.1),p=project(width,height,lane,d);
      const length=p.corridor*p.scale*(.05+hash(i*31)*.07),spark=.6+.4*Math.sin(g.time*WAVE_CADENCE*2.7+i);
      ctx.globalAlpha=Math.min(.7,p.scale*1.5)*Math.min(1,(240-d)/30)*spark;ctx.lineWidth=Math.max(.65,p.scale*2.5);ctx.beginPath();ctx.moveTo(p.x-length/2,p.y);ctx.quadraticCurveTo(p.x,p.y+p.scale*3,p.x+length/2,p.y);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  // Long reflections make the twilight channel feel wet without screen-space
  // shimmer that obscures upcoming obstacle silhouettes.
  if(level.index===2){const reflection=ctx.createLinearGradient(width*.42,0,width*.58,0);reflection.addColorStop(0,'#c9b7ff00');reflection.addColorStop(.5,'#c9b7ff20');reflection.addColorStop(1,'#c9b7ff00');ctx.fillStyle=reflection;ctx.fillRect(width*.42,distant.y,width*.16,height);}
  ctx.restore();
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  for(const edge of edges){ctx.strokeStyle=level.index===1?'#b8dfd37a':'#a8b9df5a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...edge[0]);for(const p of edge.slice(1))ctx.lineTo(...p);ctx.stroke();}
  ctx.restore();
}

// Seeded chutes come toward the player at their world coordinates, with
// stronger breaking crests later in a map. The fallback uses bounded paths.
export function drawRapids2D(ctx,g,width,height,reduced,project){
  if(reduced)return;
  const level=levelAt(g.levelIndex);
  let profile=profiles.get(g);if(!profile){profile=createCourseProfile(g.seed,level.length,level.index);profiles.set(g,profile);}
  const first=Math.floor(g.distance/11),last=first+27;
  ctx.save();ctx.lineCap='round';ctx.strokeStyle=level.index===2?'#d5dfff':'#e4fff5';
  for(let n=first;n<=last;n++){
    const d=n*11+riverHash(n+19,profile)*7,z=d-g.distance;if(z<1||z>270)continue;
    const energy=rapidAt(d,profile);if(energy<.16)continue;
    const p=project(width,height,.2+riverHash(n+47,profile)*(MAX_LANE-.4),z),span=p.corridor*p.scale*(.06+energy*.13),rise=energy*p.scale*9;
    ctx.globalAlpha=Math.min(.62,energy*.8)*Math.min(1,(270-z)/35);ctx.lineWidth=Math.max(.8,p.scale*(1+energy*2.8));
    ctx.beginPath();ctx.moveTo(p.x-span*.5,p.y);ctx.bezierCurveTo(p.x-span*.23,p.y-rise,p.x+span*.16,p.y+rise*.2,p.x+span*.5,p.y-rise*.45);ctx.stroke();
    if(energy>.5){ctx.globalAlpha*=.6;ctx.beginPath();ctx.moveTo(p.x-span*.3,p.y+rise*.8);ctx.quadraticCurveTo(p.x,p.y+rise*.15,p.x+span*.4,p.y+rise*.65);ctx.stroke();}
  }
  ctx.restore();
}

export function drawMapBanks2D(ctx,g,art,width,height,reduced,project,view){
  const level=levelAt(g.levelIndex),cards=art.map2d.props[level.index];if(!cards)return;
  ctx.save();
  for(const item of bankScenery(g.distance,view)){
    const courseId=Number.parseInt(item.id,10);
    if(level.index===2&&Math.abs(courseId)%3===1)continue;
    // Fixed world anchors advance even in reduced motion: they communicate
    // the course speed but have no independent decorative animation.
    const p=project(width,height,item.lane,item.z),size=p.laneSpacing*(level.index===1?1.26:.96)*item.size;
    if(p.x+size*.6<0||p.x-size*.6>width)continue;
    ctx.globalAlpha=Math.min(1,(view-item.z)/25)*Math.min(1,p.scale*4+.25);
    const card=cards[item.kind],tall=size*card.height/card.width;
    ctx.fillStyle='#1123333f';ctx.beginPath();ctx.ellipse(p.x,p.y,size*.48,size*.045,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(courseId%2?-1:1,1);ctx.drawImage(card,-size/2,-tall,size,tall);ctx.restore();
    if(level.index===2&&item.kind===1){ctx.fillStyle='#c7b0f22a';ctx.beginPath();ctx.ellipse(p.x,p.y-3,size*.4,size*.04,0,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
}

export function drawFinish2D(ctx,g,width,height,project,view,art,reduced=false){
  const level=levelAt(g.levelIndex),z=level.length-g.distance;if(z>FINISH_GATE.visibleFrom||z< -14)return;
  const p=project(width,height,CENTER_LANE,z),unit=p.unit,left=p.x-FINISH_GATE.halfWidth*unit,right=p.x+FINISH_GATE.halfWidth*unit;
  // The fallback's screen projection has no camera pitch. Limit the tall
  // arch's top in shallow layouts while retaining its projected river feet.
  const top=Math.max(height*(height<500?.25:.18),p.y-FINISH_GATE.bannerTop*unit),bannerHeight=Math.max(8,Math.min(3.1*unit,height*.135)),bottom=top+bannerHeight,postWidth=unit*1.15;
  const theme=level.index===0?'#8b6950':level.index===1?'#c98a63':'#9b92b0',t=reduced?0:g.time;
  ctx.save();ctx.lineJoin='round';ctx.globalAlpha=Math.min(1,(FINISH_GATE.visibleFrom-z)/32);
  // Paired beacons guide the safe run-in; they flank all five lane envelopes.
  for(const offset of FINISH_GATE.approach){const d=z-offset;if(d< -12||d>view)continue;for(const side of [-1,1]){
    const q=project(width,height,xToLane(side*FINISH_GATE.halfWidth),d),u=q.unit;
    ctx.fillStyle='#10292c66';ctx.beginPath();ctx.ellipse(q.x,q.y+u*.2,u*.65,u*.18,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=theme;ctx.fillRect(q.x-u*.48,q.y-u*.3,u*.96,u*.6);
    ctx.fillStyle=level.accent;ctx.fillRect(q.x-u*.22,q.y-u*1.7,u*.44,u*1.5);ctx.fillStyle='#fff3bd';ctx.fillRect(q.x-u*.35,q.y-u*1.8,u*.7,u*.22);
    ctx.beginPath();ctx.moveTo(q.x,q.y-u*2.1);ctx.lineTo(q.x+side*u*(1.05+Math.sin(t*2+offset)*.05),q.y-u*1.95);ctx.lineTo(q.x+side*u*.73,q.y-u*1.52);ctx.lineTo(q.x,q.y-u*1.62);ctx.closePath();ctx.fillStyle=level.accent;ctx.fill();
  }}
  // A bright checkered water ribbon marks the exact crossing beneath the arch.
  const ribbonHeight=Math.max(2,unit*.36);ctx.fillStyle='#fff1b3';ctx.beginPath();ctx.moveTo(left,p.y-ribbonHeight);ctx.lineTo(right,p.y-ribbonHeight);ctx.lineTo(right+unit*.4,p.y+ribbonHeight);ctx.lineTo(left-unit*.4,p.y+ribbonHeight);ctx.closePath();ctx.fill();
  ctx.fillStyle='#14333b';for(let i=0;i<16;i++)if(i%2===0)ctx.fillRect(left+i*(right-left)/16,p.y-ribbonHeight,(right-left)/16,ribbonHeight*2);
  for(const [x,side] of [[left,-1],[right,1]]){
    ctx.fillStyle='#071d2855';ctx.beginPath();ctx.ellipse(x,p.y,unit*1.4,unit*.28,0,0,Math.PI*2);ctx.fill();
    const pillar=ctx.createLinearGradient(x-postWidth*.5,0,x+postWidth*.5,0);pillar.addColorStop(0,theme);pillar.addColorStop(.26,'#e6cbaa');pillar.addColorStop(.45,theme);pillar.addColorStop(1,level.index===2?'#48435e':'#614536');ctx.fillStyle=pillar;ctx.fillRect(x-postWidth/2,top-unit*.3,postWidth,p.y-top+unit*.3);
    ctx.fillRect(x-unit*1.13,p.y-unit*.66,unit*2.26,unit*.74);ctx.fillRect(x-unit*.99,top-unit*.44,unit*1.98,unit*.25);
    ctx.fillStyle=level.accent;for(let i=0;i<3;i++)ctx.fillRect(x-postWidth*.57,bottom+(p.y-bottom)*(i+.3)/3,postWidth*1.14,Math.max(1,unit*.11));
    const beaconHeight=Math.min(unit*.66,height*.045);ctx.fillStyle='#fff1b7';ctx.fillRect(x-unit*.42,top-unit*.49-beaconHeight,unit*.84,beaconHeight);ctx.fillStyle=theme;ctx.fillRect(x-unit*.56,top-unit*.56-beaconHeight,unit*1.12,unit*.12);
    const flagY=top-unit*.65-beaconHeight;ctx.strokeStyle=level.accent;ctx.lineWidth=Math.max(1,unit*.07);ctx.beginPath();ctx.moveTo(x,flagY-unit*.8);ctx.lineTo(x,flagY+unit*.15);ctx.stroke();ctx.beginPath();ctx.moveTo(x,flagY-unit*.8);ctx.lineTo(x+side*unit*1.35,flagY-unit*.7);ctx.lineTo(x+side*unit*.98,flagY-unit*.3);ctx.lineTo(x+side*unit*1.3,flagY+unit*.04);ctx.lineTo(x,flagY);ctx.closePath();ctx.fillStyle=level.accent;ctx.fill();
  }
  ctx.fillStyle=level.accent;ctx.fillRect(left-unit*.17,top-unit*.12,right-left+unit*.34,Math.max(1,unit*.16));ctx.fillRect(left-unit*.17,bottom,right-left+unit*.34,Math.max(1,unit*.16));
  if(art?.banner)ctx.drawImage(art.banner,level.index*1024,0,1024,256,left,top,right-left,bannerHeight);
  else{ctx.fillStyle='#12323a';ctx.fillRect(left,top,right-left,bannerHeight);ctx.fillStyle='#fff4ca';ctx.font=`900 ${Math.max(9,bannerHeight*.6)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('FINISH',p.x,top+bannerHeight*.48);}
  ctx.restore();
}

// The Canopy fallback uses the same section widths instead of an unchanging
// painted river edge. This apron remains outside all five playable lanes.
export function drawCanopyTerrain2D(ctx,g,art,width,height,project){
 const level=levelAt(g.levelIndex);if(level.index!==0)return;
 let profile=profiles.get(g);if(!profile){profile=createCourseProfile(g.seed,level.length,level.index);profiles.set(g,profile);}
 const far=project(width,height,CENTER_LANE,420),near=project(width,height,CENTER_LANE,-14),edges=[[],[]];
 for(let i=0;i<=26;i++){
  const scale=far.scale+(near.scale-far.scale)*i/26,z=29*(1/scale-1),p=project(width,height,CENTER_LANE,z),half=fallbackBankHalfWidth(g.distance+z,profile)*p.unit;
  edges[0].push([p.x-half,p.y]);edges[1].push([p.x+half,p.y]);
 }
 for(let side=0;side<2;side++){
  const edge=edges[side],outside=side?width:0;
  ctx.save();ctx.beginPath();ctx.moveTo(outside,far.y);ctx.lineTo(...edge[0]);for(const p of edge.slice(1))ctx.lineTo(...p);ctx.lineTo(outside,near.y);ctx.closePath();ctx.clip();
  const soil=ctx.createLinearGradient(0,far.y,0,height);soil.addColorStop(0,'#51795c00');soil.addColorStop(.13,'#6f9541c0');soil.addColorStop(1,'#38613b');ctx.fillStyle=soil;ctx.fillRect(0,far.y,width,height-far.y);
  let patterns=patternCache.get(ctx);if(!patterns){patterns={river:[],ground:[]};patternCache.set(ctx,patterns);}patterns.ground[0]??=ctx.createPattern(art.surfaceground,'repeat');
  const offset=g.distance*2%256;ctx.globalAlpha=.24;ctx.translate(0,offset);ctx.fillStyle=patterns.ground[0];ctx.fillRect(0,far.y-offset,width,height);ctx.restore();
 }
}
