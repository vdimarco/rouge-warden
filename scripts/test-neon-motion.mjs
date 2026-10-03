import assert from 'node:assert/strict';
import {multiply,inverse,orientationQuaternion,motionFrame,orientationLayout,mapViewportPoint} from '../public/neon/motion-frame.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`),axis=(x,y,z,a)=>[Math.cos(a/2),x*Math.sin(a/2),y*Math.sin(a/2),z*Math.sin(a/2)];
let checks=0;
for(const base of [[1,0,0,0],orientationQuaternion(350,30,-20),orientationQuaternion(12,78,0)])for(const screenAngle of [0,90,180,270])for(const degrees of [-170,-90,0,90,170]){const a=degrees*Math.PI/180,current=multiply(base,axis(0,0,1,a)),f=motionFrame(base,current,screenAngle);near(f.yaw,0);near(f.pitch,0);near(f.roll,a);near(Math.hypot(...f.direction),1);checks++;}
for(const [x,y,a] of [[1,0,.3],[0,1,.5]]){const f=motionFrame([1,0,0,0],axis(x,y,0,a));near(f.roll,0);near(x?f.pitch:f.yaw,a);checks++;}
for(const start of [0,90,180,270])for(const turn of [0,90,180,270]){const angle=(start+turn)%360,odd=turn%180===90,w=odd?800:400,h=odd?400:800,l=orientationLayout(w,h,start,angle,true);near(l.width,400);near(l.height,800);const p=mapViewportPoint(w/2,h/2,w,h,l);near(p.x,200);near(p.y,400);const target={x:100,y:300},a=l.angle*Math.PI/180,dx=target.x-200,dy=target.y-400;const mapped=mapViewportPoint(w/2+dx*Math.cos(a)-dy*Math.sin(a),h/2+dx*Math.sin(a)+dy*Math.cos(a),w,h,l);near(mapped.x,target.x);near(mapped.y,target.y);checks++;}
console.log(`${checks} orientation cases passed: low grips, portrait/landscape, ±90° wrist rolls, yaw/pitch separation, counterrotation and remapped touch coordinates.`);
