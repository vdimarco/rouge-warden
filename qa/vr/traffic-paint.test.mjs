import assert from 'node:assert/strict';
import {trafficAt,CAR_PAINT} from '../../public/vr/js/cars.js';
const T={n:4,lane:[0,0,0,0,10,0,0,1,0,0,10,2,0,0,20,3],move:[100,2,20,0,100,3,30,0,100,4,40,0,100,5,50,0],color:[.1,.2,.3,.4,.5,.6,.7,.8,.9,1,.2,.4]},out={},arrays=new Set(),palette=JSON.stringify(CAR_PAINT);
for(let k=0;k<100;k++){
 const i=k%4,t=k-50,copy=trafficAt(T,i,t),o=i*4,len=T.move[o],speed=T.move[o+1],distance=((T.move[o+2]+speed*t)%len+len)%len;
 const h=[[1,0,-Math.PI/2],[-1,0,Math.PI/2],[0,1,Math.PI],[0,-1,0]][i];
 assert.deepEqual(copy,{i,s:distance,len,x:T.lane[o]+h[0]*distance,y:T.lane[o+1],z:T.lane[o+2]+h[1]*distance,yaw:h[2],fx:h[0],fz:h[1],speed,paint:T.color.slice(i*3,i*3+3)});trafficAt(T,i,t,out);arrays.add(out.paint);assert.deepEqual(out,copy);assert.notEqual(out.paint,copy.paint);const old=copy.paint.slice();trafficAt(T,(i+1)%4,t+1,out);assert.deepEqual(copy.paint,old);
}
assert.equal(arrays.size,1,'one array for reused output');
const fallback={...T,color:null};trafficAt(fallback,0,-2,out);assert.deepEqual(out.paint,CAR_PAINT[0]);assert.notEqual(out.paint,CAR_PAINT[0]);assert.equal(JSON.stringify(CAR_PAINT),palette);
const independent=trafficAt(fallback,0,0);independent.paint[0]=99;assert.equal(JSON.stringify(CAR_PAINT),palette);assert.notEqual(independent.paint,out.paint);
const expected=[[40,0],[-50,0],[0,90],[0,20]];for(let i=0;i<4;i++){const r=trafficAt(T,i,10);assert.deepEqual([r.x,r.z],expected[i]);}
console.log('PASS: 100 samples reuse one paint array; independent outputs, fallback palette and four directions preserved');
