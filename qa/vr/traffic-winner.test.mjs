import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAR,trafficAt} from '../../public/vr/js/cars.js';
const before=readFileSync(new URL('./fixtures/near-traffic-before.js',import.meta.url),'utf8');
const source=readFileSync(process.env.TRAFFIC_SOURCE || new URL('../../public/vr/js/cars.js',import.meta.url),'utf8');
function query(source){
 const body=source.match(/(?:export )?function nearTraffic\([\s\S]*?\n\}/)[0].replace('export ','');
 const scratch={};let results=0;
 const near=Function('CAR','trafficAt','clamp','TQ',body+';return nearTraffic;')(CAR,(T,i,t,out)=>{if(out!==scratch)results++;return trafficAt(T,i,t,out)},(v,a,b)=>Math.max(a,Math.min(b,v)),scratch);
 return{near,count:()=>results};
}
function traffic(heading=0){
 const lane=[],move=[],color=[];
 for(const d of [3,2,1,.5]){lane.push(heading<2?0:d,0,heading<2?d:0,heading);move.push(200,1,50,0);color.push(d/4,.3,.7)}
 return{n:4,lane:new Float32Array(lane),move:new Float32Array(move),color:new Float32Array(color)};
}
const baseline=query(before),candidate=query(source);let traces=0,hits=0;
for(let h=0;h<4;h++)for(const t of [-49,0,40,145,150])for(const offset of [-3.5,-.5,0,.5,3.5])for(const reach of [0,1,3.5]){
 const T=traffic(h),p=trafficAt(T,0,t),x=p.x+(h<2?0:offset),z=p.z+(h<2?offset:0);
 const got=candidate.near(T,x,z,t,reach);assert.deepEqual(got,baseline.near(T,x,z,t,reach));traces++;if(got)hits++;
}
assert.ok(hits>0);console.log(`PASS ${traces} exact query results across four headings, clock wraps, lane fades and reach boundaries (${hits} hits)`);
for(const kind of ['missing','empty','high','hidden','short','tie','no-paint']){
 let T=traffic();
 if(kind==='missing')T=null;else if(kind==='empty')T.n=0;else if(kind==='high')for(let i=1;i<T.lane.length;i+=4)T.lane[i]=12;
 else if(kind==='hidden')for(let i=1;i<T.move.length;i+=4)T.move[i]=0;
 else if(kind==='short')for(let i=0;i<T.move.length;i+=4)T.move[i]=20;
 else if(kind==='tie')for(let i=2;i<T.lane.length;i+=4)T.lane[i]=1;else T.color=null;
 const got=candidate.near(T,50,0,0);assert.deepEqual(got,baseline.near(T,50,0,0));if(kind==='tie')assert.equal(got.i,0);
}
console.log('PASS missing/empty, expressway, hidden, short lanes, first tie and fallback paint');
const T=traffic(),first=candidate.near(T,50,0,0),saved=structuredClone(first);T.color.fill(0);T.move[14]=60;
const second=candidate.near(T,50,0,0);assert.deepEqual(first,saved);assert.notEqual(first,second);assert.notEqual(first.paint,second.paint);
console.log('PASS retained car and paint snapshots survive later queries and source changes');
const old=query(before),now=query(source);assert.deepEqual(now.near(traffic(),50,0,0),old.near(traffic(),50,0,0));
console.log(JSON.stringify({baselineResultRecords:old.count(),candidateResultRecords:now.count(),baselinePaintArrays:old.count(),candidatePaintArrays:now.count()}));
assert.equal(now.count(),1,'only the winning car should build a result record and paint array');
const miss=query(source);assert.equal(miss.near(traffic(),50,20,0),null);assert.equal(miss.count(),0);
console.log('PASS one result materialization on a hit, none on a miss');
