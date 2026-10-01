// Physics lives on the island plane. The renderer projects depth at the reference angle.
export const project = p => ({x:p.x,y:400+(p.y-400)*.60});
export const unproject = (x,y) => ({x,y:400+(y-400)/.60});
const pt=(x,y)=>unproject(x,y);
const outline=[[1270,496],[1270,531],[1358,589],[1409,616],[1470,622],[1595,564],[1620,519],[1590,414],[1490,375],[1400,353],[1340,383],[1300,449]].map(([x,y])=>pt(x,y));
export const stars=[[1423,469],[1512,222],[1433,281],[1118,430],[1202,453]].map(([x,y])=>({x,y}));
export function createRun(depth=1){return {depth,clock:0,score:0,lives:3,phase:'ready',ball:{...pt(1560,449),vx:0,vy:0,r:14},left:0,right:0,lit:new Set(),target:0,rail:null,cooldown:0,shield:0,combo:0,hitUntil:0,events:[],power:1,railCount:0,bumper:0,orbitAfter:0,leftKick:0,rightKick:0,leftHeld:false,rightHeld:false};}
const emit=(r,type,data={})=>r.events.push({type,...data});
export function launch(r){if(r.phase!=='ready')return false;r.phase='play';r.shield=r.clock<.05?5:0;r.rail={kind:'launch',t:0,duration:2.3};emit(r,'launch');return true;}
export const railPoints=[[1560,449],[1584,437],[1540,411],[1454,374],[1370,333],[1264,304],[1175,310],[1110,333],[1050,370],[983,392],[935,396],[1010,401],[1075,368],[1110,333],[1210,320],[1290,351],[1315,406],[1320,485]];
export function railPosition(t){let a=Math.min(railPoints.length-1.00001,Math.max(0,t)*(railPoints.length-1)),i=Math.floor(a),f=a-i;const p0=railPoints[Math.max(0,i-1)],p1=railPoints[i],p2=railPoints[i+1],p3=railPoints[Math.min(railPoints.length-1,i+2)];const component=j=>.5*((2*p1[j])+(-p0[j]+p2[j])*f+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*f*f+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*f*f*f);return {x:component(0),y:component(1)};}
export function flipper(r,left){const pivot=left?pt(1288,526):pt(1579,540),tip=left?pt(1397,578):pt(1465,590);const rest=Math.atan2(tip.y-pivot.y,tip.x-pivot.x),length=Math.hypot(tip.x-pivot.x,tip.y-pivot.y),amount=left?r.left:r.right,angle=rest+(left?-1:1)*amount*.68;return {pivot,tip:{x:pivot.x+Math.cos(angle)*length,y:pivot.y+Math.sin(angle)*length},amount};}
export function segment(b,a,c,width=6,e=.8){const dx=c.x-a.x,dy=c.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((b.x-a.x)*dx+(b.y-a.y)*dy)/l)):0,px=a.x+t*dx,py=a.y+t*dy,d=Math.hypot(b.x-px,b.y-py),radius=b.r+width;if(d>=radius)return null;let nx=(b.x-px)/(d||1),ny=(b.y-py)/(d||1);if(!d){nx=0;ny=-1;}b.x=px+nx*(radius+.05);b.y=py+ny*(radius+.05);const dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=dot*nx*(1+e);b.vy-=dot*ny*(1+e);}return {t,nx,ny,approaching:dot<0};}
export function pulse(r){if(r.phase!=='play'||r.cooldown||r.rail)return false;r.cooldown=2.8;r.ball.vy-=340;r.ball.vx+=(1430-r.ball.x)*1.8;emit(r,'pulse');return true;}
export function next(r,charm){const n=createRun(r.depth+1);n.score=r.score;n.lives=Math.min(5,r.lives+(charm==='heart'?1:0));n.power=Math.min(1.65,r.power+(charm==='power'?.12:0));return n;}
export function step(r,dt,input){r.events=[];if(!['play','ready'].includes(r.phase))return;r.clock+=dt;r.cooldown=Math.max(0,r.cooldown-dt);r.shield=Math.max(0,r.shield-dt);for(const k of ['left','right']){const target=input[k]?1:0;if(target&&!r[k+'Held'])r[k+'Kick']=r.clock+.12;r[k+'Held']=!!target;r[k]+=Math.max(-dt*10,Math.min(dt*20,target-r[k]));}
if(r.phase==='ready')return;const b=r.ball;
if(r.rail){r.rail.t+=dt;let f=Math.min(1,r.rail.t/r.rail.duration);let p=railPosition(f);Object.assign(b,unproject(p.x,p.y));if(f>=1){const kind=r.rail.kind;r.rail=null;b.vx=430;b.vy=200;r.orbitAfter=r.clock+.8;r.railCount++;r.score+=kind==='launch'?100:600*r.depth;emit(r,'rail',{x:1110,y:333});r.lit.add(3);r.lit.add(4);}return;}
b.vy+=Math.min(1500,1000+r.depth*25)*dt;b.vx*=Math.pow(.999,dt*240);b.x+=b.vx*dt;b.y+=b.vy*dt;
// Returning up the left lane follows the actual rail, bridge, and upper orbit.
const s=project(b);if(s.x<1340&&s.y<476&&b.vy<-250&&r.clock>r.orbitAfter){r.rail={kind:'orbit',t:0,duration:1.9};emit(r,'orbit');return;}
for(let i=0;i<outline.length;i++){// Keep the visible opening between the two flippers as the drain.
if(i===3||i===4)continue;segment(b,outline[i],outline[(i+1)%outline.length],5,.77);}
const obstacles=[pt(1423,469),pt(1484,400),pt(1562,453)];for(let i=0;i<obstacles.length;i++){const o=obstacles[i],d=Math.hypot(b.x-o.x,b.y-o.y),rad=b.r+(i===0?19:13);if(d<rad){const nx=(b.x-o.x)/(d||1),ny=(b.y-o.y)/(d||1),dot=b.vx*nx+b.vy*ny;b.x=o.x+nx*(rad+.1);b.y=o.y+ny*(rad+.1);if(dot<0){b.vx-=dot*nx*1.85;b.vy-=dot*ny*1.85;b.vx+=nx*200;b.vy+=ny*200;r.score+=75;r.bumper++;r.lit.add(i===0?0:2);emit(r,'hit',{...project(o),value:75});}}}
if(s.y<405&&s.x>1390){if(!r.lit.has(1)){r.lit.add(1);r.score+=300;emit(r,'hit',{x:1512,y:222,value:300});}}
for(const left of [true,false]){const f=flipper(r,left),h=segment(b,f.pivot,f.tip,14,.52);if(h?.approaching&&f.amount>.12&&r.clock<r[(left?'left':'right')+'Kick']){b.vy=-Math.max(670,920*r.power+(h.t*160));b.vx=(left?1:-1)*(210+h.t*260);r.score+=10;emit(r,'flip');}}
let speed=Math.hypot(b.vx,b.vy);if(speed>1700){b.vx*=1700/speed;b.vy*=1700/speed;}
if(r.lit.size>=5&&r.railCount>=2+Math.min(5,Math.floor(r.depth/3))){r.phase='clear';r.score+=1500*r.depth;emit(r,'clear');return;}
if(project(b).y>649||b.x<1210||b.x>1660){if(r.shield<=0)r.lives--;r.phase=r.lives>0?'ready':'over';Object.assign(b,{...pt(1560,449),vx:0,vy:0});emit(r,r.phase==='over'?'over':'drain',{saved:r.shield>0});}
}
