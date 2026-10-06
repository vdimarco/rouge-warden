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
  const x=side*(riverHalfWidth(course+d,seed)+1.4),ground=riverBankHeight(x,course+d,seed);
  const wood=[],leaves=[],node=(x,y,d=0)=>({x,y,d});
  const limb=(a,b,r)=>wood.push({a,b,r});
  const root=node(x,ground,d),fork=node(x-side*.9,7.2+ground*.4,d-.7);
  const trunk=[root,node(x-side*.15,ground+2.2,d-.2),node(x-side*.45,ground+4.5,d-.5),fork,node(x-side*.2,9.5+ground*.3,d+.5)];
  for(let i=1;i<trunk.length;i++)limb(trunk[i-1],trunk[i],.66-i*.09);
  for(const sign of [-1,1]){
    const rx=x+side*.75,rd=d+sign*1.15;
    limb(node(rx,riverBankHeight(rx,course+rd,seed),rd),trunk[1],.27);
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
  for(let i=0;i<7;i++){
    const a=i*2.399,spread=i===0?0:1.6;
    leaves.push({p:node(x+Math.cos(a)*spread,8.8+Math.sin(i*1.7)*.65,d+Math.sin(a)*1.5),size:[2.1,1.6,1.9],turn:a});
  }
  for(const t of [.3,.65])leaves.push({p:node(fork.x+(lane+side*1.4-fork.x)*t,7.4-t*1.4,(d-.7)*(1-t)+1.1),size:[1.5,1.1,1.3],turn:e.id+t});
  leaves.push({p:node(lane-side*.8,3.35,-.18),size:[.65,.4,.6],turn:e.id});
  return {side,root,tip:middle,lane,wood,leaves};
}
