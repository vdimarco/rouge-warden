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

export const BRANCH_TREE_PARTS=48;
// The low supporting limb is a shallow span, not a single hanging point.
// Its woody forks share real parent nodes and fan in depth above the route.
export function shorelineBranch(e,course=e.d,seed=137){
  const declared=branchSpan(e),side=declared.side,lane=(e.lane-1)*3.8;
  const minCenter=(declared.minLane-1)*3.8,maxCenter=(declared.maxLane-1)*3.8;
  const span={...declared,minX:minCenter-1.9,maxX:maxCenter+1.9,centerX:(minCenter+maxCenter)/2};
  const legacyCenter=declared.width===1&&declared.minLane===1;
  const d=1+riverHash(e.id+31,seed)*.8;
  const x=side*(riverHalfWidth(course+d,seed)+1.8),ground=riverBankHeight(x,course+d,seed);
  const wood=[],leaves=[],node=(x,y,d=0)=>({x,y,d});
  const limb=(a,b,r,kind)=>wood.push({a,b,r,kind});
  const forkHeight=legacyCenter?Math.max(6.0,ground+2.5):Math.max(3.6,ground+2.5);
  const root=node(x,ground,d),fork=node(x-side*.6,forkHeight,d-.4);
  const trunk=[root,node(x-side*.1,(ground+forkHeight)/2,d-.2),fork,node(x-side*.25,forkHeight+2.5,d+.1),node(x+side*.15,Math.max(9.5,ground+8),d+.5)];
  for(let i=1;i<trunk.length;i++)limb(trunk[i-1],trunk[i],[1.16,.98,.73,.48][i-1]);
  for(const sign of [-1,1]){
    const rx=x+side*.75,rd=d+sign*1.15;
    limb(node(rx,riverBankHeight(rx,course+rd,seed),rd),trunk[1],.34);
    limb(trunk[3],node(x+sign*1.6,8.7+ground*.2,d+sign*1.4),.23);
  }
  const farCenter=side<0?maxCenter:minCenter;
  const start=node(legacyCenter?side*1.1:side*6.7,3.1,0),end=node(farCenter-side*.55,2.96,0);
  const spanLength=Math.abs(end.x-start.x);
  const meshFrame=[start,node(start.x+(end.x-start.x)/3,2.55),node(start.x+(end.x-start.x)*2/3,2.55),end];
  const spanPoint=t=>{
    const u=1-t;return node(u*u*u*start.x+3*u*u*t*meshFrame[1].x+3*u*t*t*meshFrame[2].x+t*t*t*end.x,
      u*u*u*start.y+3*u*u*t*meshFrame[1].y+3*u*t*t*meshFrame[2].y+t*t*t*end.y,0);
  };
  const connectorEnd=legacyCenter?node(side*1.55,5.0,.15):node(side*8.4,3.28,.35);
  limb(fork,connectorEnd,.94,'connector');limb(connectorEnd,start,legacyCenter?.48:.67,'connector');
  const forkStations=declared.width===1?[.16,.48,.81]:declared.width===2?[.11,.36,.61,.85]:[.09,.26,.47,.69,.88];
  const forkTs=forkStations.map((t,i)=>t+(riverHash(e.id+i+103,seed)-.5)*.045);
  const ts=new Set([0,1,.2,.4,.6,.8,...forkTs]);
  for(const covered of declared.lanes)ts.add(((covered-1)*3.8-start.x)/(end.x-start.x));
  const stations=[...ts].filter(t=>t>=0&&t<=1).sort((a,b)=>a-b).map(t=>({t,p:spanPoint(t)}));
  // A rounded bark core and the generated knots use the same shallow center
  // curve. It stays substantial along all three lanes, not just at one tip.
  for(let i=1;i<stations.length;i++)limb(stations[i-1].p,stations[i].p,.54-stations[i-1].t*.13,'span');
  // Connect the rounded core to the bank with an identical shared endpoint.
  stations[0].p=start;wood.find(l=>l.kind==='span').a=start;
  for(let i=0;i<forkTs.length;i++){
    const p=stations.find(s=>Math.abs(s.t-forkTs[i])<1e-8).p,fan=i%2?1:-1;
    const elbowX=p.x+side*(.75+riverHash(e.id+i+43,seed)*.4);
    const elbow=node(legacyCenter?Math.max(span.minX+.45,Math.min(span.maxX-.45,elbowX)):elbowX,
      p.y+1.12+riverHash(e.id+i+49,seed)*.3,fan*(.45+riverHash(e.id+i+53,seed)*.45));
    const endFork=node(elbow.x-side*(.55+riverHash(e.id+i+57,seed)*.65),5.1+riverHash(e.id+i+68,seed)*.7,fan*(1.7+riverHash(e.id+i+81,seed)*.6));
    const smallA=node(elbow.x+side*.65,Math.max(4.85,elbow.y+.9),elbow.d+fan*.75),smallB=node(endFork.x-side*.65,endFork.y+.25,endFork.d-fan*.55);
    limb(p,elbow,.31+riverHash(e.id+i+95,seed)*.07,'fork');limb(elbow,endFork,.23,'fork');
    limb(elbow,smallA,.14,'twig');limb(endFork,smallB,.105,'twig');
    leaves.push({p:endFork,size:[.78,.58,.75],turn:e.id+i},{p:smallA,size:[.47,.38,.46],turn:e.id-i},{p:smallB,size:[.42,.34,.4],turn:e.id+i*2});
  }
  crown(leaves,x,d,e.id,seed,ground,18);
  curveLimbs(wood);
  const contacts=declared.lanes.map(covered=>({lane:covered,...spanPoint(((covered-1)*3.8-start.x)/(end.x-start.x))}));
  const contact=contacts.find(p=>p.lane===e.lane)??contacts[Math.floor(contacts.length/2)];
  return {side,root,tip:contact,lane,wood,leaves,span,contacts,meshFrame,spanLength};
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
