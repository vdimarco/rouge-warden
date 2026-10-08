import {laneToX,MAX_LANE,LANE_SPACING,PLAYABLE_HALF_WIDTH} from './lanes.js';
import {riverHash,riverHalfWidth,riverBankHeight} from './river-course.js';
import {branchSpan} from './branch-spans.js';

let leafArt;
export function branchLeafArt(){
  if(leafArt)return leafArt;
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d');
  for(let i=0;i<46;i++){
    const a=i*2.399,r=12+Math.sqrt(i/46)*85;
    ctx.save();ctx.translate(128+Math.cos(a)*r,128+Math.sin(a)*r);ctx.rotate(a+.5);
    const length=24+(i%5)*3,width=9+(i%3)*2;
    const light=ctx.createLinearGradient(0,-width,0,width);
    light.addColorStop(0,['#93b954','#77a53d','#b1c76a'][i%3]);light.addColorStop(1,'#315c2a');
    ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(-length,0);ctx.quadraticCurveTo(-5,-width*1.5,length,0);ctx.quadraticCurveTo(-5,width*1.5,-length,0);ctx.fill();
    ctx.strokeStyle='#d5dd8266';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(length*.8,0);ctx.stroke();ctx.restore();
  }
  return leafArt=c;
}

export const BRANCH_TREE_PARTS=96;
// A branch is an entire rooted tree, not a pole holding a separate beam. The
// main limb wanders in height and depth; its connected forks grow sideways,
// uphill and downriver at irregular intervals. Width controls reach only.
export function shorelineBranch(e,course=e.d,seed=137){
  const declared=branchSpan(e),side=declared.side,lane=laneToX(e.lane);
  const minCenter=laneToX(declared.minLane),maxCenter=laneToX(declared.maxLane);
  const span={...declared,minX:minCenter-LANE_SPACING/2,maxX:maxCenter+LANE_SPACING/2,centerX:(minCenter+maxCenter)/2};
  const rand=n=>riverHash(e.id+n,seed),node=(x,y,d=0)=>({x,y,d});
  const rootD=1.15+rand(31)*.65,x=side*(riverHalfWidth(course+rootD,seed)+1.5),ground=riverBankHeight(x,course+rootD,seed);
  const root=node(x,ground,rootD),wood=[],leaves=[];
  const limb=(a,b,r,kind='fork')=>{const part={a,b,r,kind};wood.push(part);return part;};
  const collar=node(x-side*(2.15+rand(34)*1.05),Math.max(6.35,ground+4.25),rootD-.65);
  const knee=node(x-side*.32,ground+(collar.y-ground)*.46,rootD+.33);
  limb(root,knee,1.35,'trunk');limb(knee,collar,1.05,'trunk');
  // Irregular roots share the trunk foot and are buried in the actual bank.
  for(let i=0;i<4;i++){
    const a=i*1.51+.4,rx=x+side*(.45+rand(40+i)*1.2),rd=rootD+Math.sin(a)*(1.25+rand(45+i));
    limb(node(rx,riverBankHeight(rx,course+rd,seed)-.04,rd),knee,.26+rand(50+i)*.12,'root');
  }
  const far=side<0?span.maxX-.68:span.minX+.68;
  const legacyCenter=declared.minLane>0&&declared.maxLane<MAX_LANE;
  const nearEdge=side<0?span.minX:span.maxX;
  const start=node(legacyCenter?nearEdge-side*.98:side*(PLAYABLE_HALF_WIDTH+.95+rand(59)*.3),3.27+rand(61)*.14,.28+rand(63)*.24);
  // The long bank-reaching arm has a real collar and a crooked elbow, rather
  // than two cylinders meeting at a sharp angle over the navigation corridor.
  const elbow=node(x-side*(Math.abs(x-start.x)*.45),legacyCenter?9.5:4.75+rand(68)*.5,.9+rand(71)*.5);
  limb(collar,elbow,.86,'arm');limb(elbow,start,legacyCenter?.42:.69,'arm');
  const spanLength=Math.abs(far-start.x),stationTs=[0,.15+rand(77)*.035,.34+rand(79)*.035,.55+rand(83)*.035,.75+rand(89)*.035,1];
  for(const covered of declared.lanes){const t=(laneToX(covered)-start.x)/(far-start.x);if(t>0&&t<1)stationTs.push(t);}
  const ts=[...new Set(stationTs)].sort((a,b)=>a-b),stations=[];
  const pointAt=t=>node(start.x+(far-start.x)*t,3.12+.22*Math.sin(t*6.5+rand(94))+.12*Math.sin(t*13+rand(96)*2),.28*Math.sin(t*5.5+rand(98))+.18*Math.sin(t*11));
  for(const t of ts)stations.push({t,p:t===0?start:pointAt(t)});
  for(let i=1;i<stations.length;i++)limb(stations[i-1].p,stations[i].p,.64-stations[i-1].t*.43,'span');
  // Seeded forks are not counted by the number of lanes. Their differing
  // lengths, directions and branching depths produce a living-tree silhouette.
  const forkCount=3+Math.floor(rand(101)*3);
  for(let i=0;i<forkCount;i++){
    const index=1+Math.floor((i+.4)/forkCount*(stations.length-2)),station=stations[index],p=station.p;
    const fan=rand(110+i)>.5?1:-1,major=i===0||i===2;
    // Broad oblique first limbs have visible lateral reach in the camera,
    // not just foreshortened depth. Upper limbs can grow over a clear lane.
    const backwards=major&&station.t>.55?side:-side;
    const length=major?2.8+rand(121+i)*1.6:1.25+rand(123+i)*1.3;
    const y=major?4.9+rand(131+i)*1.1:p.y+.35+rand(133+i)*.4;
    const rawX=p.x+backwards*length;
    const b=node(major?rawX:Math.max(span.minX+.35,Math.min(span.maxX-.35,rawX)),y,p.d+fan*(.8+rand(141+i)*1.2));
    const c=node(major?b.x-side*(2.1+rand(151+i)*2):Math.max(span.minX+.2,Math.min(span.maxX-.2,b.x-side*.9)),b.y+(major?.65:0)+(rand(153+i)-.4)*.9,b.d+fan*(.8+rand(161+i)));
    const radius=major?.32+rand(171+i)*.1:.16+rand(173+i)*.1;
    limb(p,b,radius,'fork');limb(b,c,radius*.58,'fork');
    const twigCount=2+Math.floor(rand(181+i)*2);
    for(let j=0;j<twigCount;j++){
      const origin=j===0?b:c,dir=j%2?side:-side;
      const ty=Math.max(3.12,origin.y+(rand(211+i*3+j)-.55)*1.4),tx=origin.x+dir*(.8+rand(191+i*4+j)*1.3);
      const t1=node(ty>4.2?tx:Math.max(span.minX+.2,Math.min(span.maxX-.2,tx)),ty,origin.d-fan*(.45+rand(231+i*3+j)*.9));
      const ty2=t1.y-.08+rand(251+i*3+j)*.42,tx2=t1.x+dir*.43;
      const t2=node(ty2>4.2?tx2:Math.max(span.minX+.2,Math.min(span.maxX-.2,tx2)),ty2,t1.d+fan*.35);
      limb(origin,t1,radius*.26,'twig');limb(t1,t2,radius*.11,'twig');
      for(const [at,k] of [[.28,0],[.63,1]]){
        const q=node(origin.x+(t1.x-origin.x)*at,origin.y+(t1.y-origin.y)*at,origin.d+(t1.d-origin.d)*at),size=.24+rand(271+i*6+j*2+k)*.3;
        leaves.push({p:q,size:[size*2.3,size*.75,size*1.2],turn:rand(301+i*6+j*2+k)*Math.PI*2});
      }
    }
    if(rand(341+i)>.4&&Math.abs(c.d)>2){
      const hanging=node(c.x+side*.12,c.y-.45-rand(347+i)*.55,c.d+fan*.1);
      const end=node(hanging.x-side*(.08+rand(353+i)*.25),Math.max(2.2,hanging.y-.65-rand(359+i)*.85),hanging.d-fan*.2);
      limb(c,hanging,.046,'vine');limb(hanging,end,.023,'vine');
    }
  }
  // The parent trunk continues beyond the lateral collar. A second broad
  // upper daughter stretches toward the river and carries a loose canopy.
  const crownBase=node(collar.x-side*1.35,collar.y+2.65,collar.d+.4),crownTop=node(crownBase.x+side*.55,crownBase.y+2.1,crownBase.d+.65);
  limb(collar,crownBase,.68,'crown');limb(crownBase,crownTop,.39,'crown');
  const upperA=node(collar.x-side*5.5,collar.y+1.3,collar.d+1.35),upperB=node(upperA.x-side*(3.5+rand(367)*2),upperA.y-.6,upperA.d+1.4);
  limb(collar,upperA,.56,'crown');limb(upperA,upperB,.34,'crown');
  const crownLimbs=[[crownBase,crownTop],[collar,upperA],[upperA,upperB]];
  for(let i=0;i<3;i++){
    const a=crownLimbs[i][0],b=crownLimbs[i][1];
    for(let j=0;j<3;j++){
      const t=.21+j*.27,base=node(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.d+(b.d-a.d)*t),end=node(base.x+(j%2?side:-side)*(1.15+rand(381+i*3+j)*1.2),base.y+.55+(j%2?-.3:.4),base.d+(j%2?1:-1)*1.1);
      limb(base,end,.09+rand(389+i*3+j)*.055,'twig');
      leaves.push({p:node((base.x+end.x)*.5,(base.y+end.y)*.5,(base.d+end.d)*.5),size:[1.65,.73,1.1],turn:rand(397+i*3+j)*6});
    }
  }
  curveLimbs(wood);
  if(legacyCenter){const arm=wood.filter(p=>p.kind==='arm').at(-1);arm.c2=node(start.x+side*1.7,5.35,start.d+.12);}
  const contacts=declared.lanes.map(covered=>({lane:covered,...stations.find(s=>Math.abs(s.p.x-laneToX(covered))<1e-6)?.p}));
  const contact=contacts.find(p=>p.lane===e.lane)??contacts[Math.floor(contacts.length/2)];
  return {side,root,tip:contact,lane,wood,leaves,span,contacts,spanLength,nativeReach:far,variation:rand(397),anatomy:'rooted-recursive-oak',legacyCenter,course,profile:seed};
}

// Endpoint tangents follow adjoining limbs. Tubes share endpoints and taper;
// controls remain inside the local bend rather than bulging into safe lanes.
function curveLimbs(wood){
 const direction=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,dd=b.d-a.d,l=Math.hypot(dx,dy,dd);return{x:dx/l,y:dy/l,d:dd/l};};
 const blend=(a,b)=>{const x=a.x+b.x,y=a.y+b.y,d=a.d+b.d,l=Math.hypot(x,y,d);return l>.2?{x:x/l,y:y/l,d:d/l}:a;};
 for(const limb of wood){
  const dir=direction(limb.a,limb.b),length=Math.hypot(limb.b.x-limb.a.x,limb.b.y-limb.a.y,limb.b.d-limb.a.d);
  const before=wood.filter(s=>s.b===limb.a).sort((a,b)=>b.r-a.r)[0],after=wood.filter(s=>s.a===limb.b).sort((a,b)=>b.r-a.r)[0];
  const start=before?blend(direction(before.a,before.b),dir):dir,end=after?blend(dir,direction(after.a,after.b)):dir;
  const k=length*.28;
  limb.c1={x:limb.a.x+start.x*k,y:limb.a.y+start.y*k,d:limb.a.d+start.d*k};
  limb.c2={x:limb.b.x-end.x*k,y:limb.b.y-end.y*k,d:limb.b.d-end.d*k};
  limb.rEnd=after?Math.min(limb.r,after.r):limb.r*.32;
 }
}
function crown(leaves,x,d,id,seed,ground=0,count=21){
 for(let i=0;i<count;i++){
  const a=i*2.399+riverHash(id+43,seed),spread=.5+Math.sqrt(i/count)*2.9,scale=.85+riverHash(id+i+81,seed)*.5;
  leaves.push({p:{x:x+Math.cos(a)*spread,y:8.4+ground*.3+Math.sin(i*1.7)*1.6,d:d+Math.sin(a)*spread*.85},size:[2.25*scale,1.65*scale,2*scale],turn:a});
 }
}
export function scenicTree(e,course=e.d,seed=137){
 const side=e.side,d=0,x=side*(riverHalfWidth(course,seed)+4.2),ground=riverBankHeight(x,course,seed),height=8.5+riverHash(e.id+17,seed)*3;
 const wood=[],leaves=[],node=(x,y,d=0)=>({x,y,d}),limb=(a,b,r)=>wood.push({a,b,r});
 const root=node(x,ground),a=node(x+side*.35,ground+2.4,.2),b=node(x-side*.4,ground+5,-.5),top=node(x+side*.5,height,.35);
 limb(root,a,1.0);limb(a,b,.66);limb(b,top,.4);
 for(let i=0;i<4;i++){
  const angle=i*Math.PI/2+.3,rx=x+Math.cos(angle)*1.5,rd=Math.sin(angle)*1.5;
  limb(node(rx,riverBankHeight(rx,course+rd,seed),rd),a,.36);
  limb(b,node(x+Math.cos(angle)*2,height-.6,Math.sin(angle)*2),.19);
 }
 crown(leaves,x,0,e.id,seed,ground);curveLimbs(wood);
 return{side,root,wood,leaves,scenic:true};
}
export function limbPoint(limb,t){
 const u=1-t;return Object.fromEntries(['x','y','d'].map(k=>[k,u*u*u*limb.a[k]+3*u*u*t*limb.c1[k]+3*u*t*t*limb.c2[k]+t*t*t*limb.b[k]]));
}
