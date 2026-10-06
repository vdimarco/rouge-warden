import {riverHash,riverHalfWidth,riverBankHeight} from './river-course.js';

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

// Heights are relative to the river at each node's course offset. Only the
// terminal limb dips to duck height; the long reach stays over standing heads.
export function shorelineBranch(e,course=e.d,seed=137){
  const side=e.lane===0?-1:e.lane===2?1:riverHash(e.id+19,seed)>.5?1:-1;
  const lane=(e.lane-1)*3.8,d=4+e.lane*3+riverHash(e.id+31,seed)*2;
  const x=side*(riverHalfWidth(course+d,seed)+1.8),ground=riverBankHeight(x,course+d,seed);
  const wood=[],leaves=[],node=(x,y,d=0)=>({x,y,d});
  const limb=(a,b,r)=>wood.push({a,b,r});
  const root=node(x,ground,d),fork=node(x-side*.9,7.2+ground*.4,d-.7);
  const trunk=[root,node(x-side*.15,ground+2.2,d-.2),node(x-side*.45,ground+4.5,d-.5),fork,node(x-side*.2,9.5+ground*.3,d+.5)];
  for(let i=1;i<trunk.length;i++)limb(trunk[i-1],trunk[i],.98-i*.14);
  for(const sign of [-1,1]){
    const rx=x+side*.75,rd=d+sign*1.15;
    limb(node(rx,riverBankHeight(rx,course+rd,seed),rd),trunk[1],.34);
    limb(fork,node(x+sign*1.6,8.7,d+sign*1.4),.19);
  }
  let previous=fork;
  for(let i=1;i<=5;i++){
    const t=i/5,p=node(fork.x+(lane+side*1.4-fork.x)*t,7.2+ground*.4-(1.6+ground*.4)*t+Math.sin(t*Math.PI)*.38,(d-.7)*(1-t)+Math.sin(t*Math.PI)*1.1);
    limb(previous,p,.38-t*.15);
    if(i===2||i===4){const twig=node(p.x+side*.6,p.y+1.05,p.d+.8);limb(p,twig,.075);leaves.push({p:twig,size:[.75,.55,.65],turn:e.id+i});}
    previous=p;
  }
  const dip=[node(lane+side*1.3,4.6,.8),node(lane+side*1.1,3.6,.3),node(lane+side*.8,2.95,.08),node(lane+side*.55,2.65,0)];
  for(let i=0;i<dip.length;i++){limb(previous,dip[i],.23-i*.012);previous=dip[i];}
  const knuckle=previous;
  const middle=node(lane,2.42,0),tip=node(lane-side*1.35,2.57,-.08);
  limb(knuckle,middle,.22);limb(middle,tip,.17);
  limb(middle,node(lane-side*.1,3.2,.38),.09);
  limb(tip,node(lane-side*1.55,3.02,-.3),.075);
  limb(knuckle,node(lane+side*1.6,3.25,-.45),.085);
  crown(leaves,x,d,e.id,seed,ground);
  for(const t of [.3,.65])leaves.push({p:node(fork.x+(lane+side*1.4-fork.x)*t,7.4-t*1.4,(d-.7)*(1-t)+1.1),size:[1.5,1.1,1.3],turn:e.id+t});
  leaves.push({p:node(lane-side*.8,3.35,-.18),size:[.65,.4,.6],turn:e.id});
  curveLimbs(wood);
  return {side,root,tip:middle,lane,wood,leaves};
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
function crown(leaves,x,d,id,seed,ground=0){
 for(let i=0;i<21;i++){
  const a=i*2.399+riverHash(id+43,seed),spread=.5+Math.sqrt(i/21)*2.9,scale=.85+riverHash(id+i+81,seed)*.5;
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
