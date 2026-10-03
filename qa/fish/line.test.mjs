import assert from 'node:assert/strict';
import { LineMotion, HangingLure } from '../../public/fish/js/line-motion.js';
for (const fps of [30,60,120]) {
 const line=new LineMotion(), a={x:0,y:3,z:0}, b={x:0,y:0,z:-20};
 line.step(a,b,0.5,false,1/fps);
 a.x=1;
 let p=line.step(a,b,0.5,false,1/fps);
 assert.equal(p[0].x,1); assert.equal(p.at(-1).z,-20);
 assert.ok(p[20].x<1-20/43, 'middle trails endpoint motion');
 for(let i=0;i<fps*5;i++) p=line.step(a,b,0.5,false,1/fps);
 assert.ok(Math.abs(p[20].x-(1-20/43))<0.01,'line settles');
 for(const q of p) for(const v of Object.values(q)) assert.ok(Number.isFinite(v));
 const lure=new HangingLure(); let tip={x:0,y:3,z:0};
 lure.step(tip,0.6,1/fps); tip.x=0.3;
 let q=lure.step(tip,0.6,1/fps);
 assert.ok(q.x<tip.x,'lure swings behind moving tip');
 for(let i=0;i<fps*5;i++) q=lure.step(tip,0.6,1/fps);
 assert.ok(Math.abs(Math.hypot(q.x-tip.x,q.y-tip.y,q.z-tip.z)-0.6)<1e-8);
 assert.ok(Math.abs(q.x-tip.x)<0.02,'pendulum settles');
 line.reset(); p=line.step(a,b,0,true,0); assert.equal(p[0].x,a.x);
}
console.log('Line inertia, endpoints, settling and pendulum checks passed at 30/60/120 fps.');
