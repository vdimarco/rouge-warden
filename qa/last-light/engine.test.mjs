import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoyage,start,pause,resume,dash,update,readBest,saveBest} from '../../public/last-light/engine.js';
test('complete seeded voyages remain winnable while collecting lights',()=>{
 for(const seed of [2,9,13]) {
  const s=createVoyage(seed);start(s);
  while(s.status==='playing') {
   const danger=s.entities.filter(e=>e.type==='rock'&&e.y>.7&&e.y<s.y+.07).sort((a,b)=>b.y-a.y)[0];
   const light=s.entities.filter(e=>e.type==='light'&&e.y>.68&&e.y<s.y).sort((a,b)=>b.y-a.y)[0];
   let target=light?.x??.5;
   if(danger&&Math.abs(danger.x-s.x)<.065&&!dash(s)) target=danger.x>.5?.1:.9;
   update(s,{x:Math.abs(target-s.x)<.015?0:Math.sign(target-s.x)},1/60);
  }
  assert.equal(s.status,'won');assert.ok(s.lights>40);assert.ok(s.score>500);
 }
});
test('steering is bounded, diagonal movement is normalized',()=>{
 const s=createVoyage();start(s);update(s,{x:1,y:-1},.05);
 assert.ok(s.x>.5 && s.y<.86);
 for(let i=0;i<100;i++)update(s,{x:1,y:-1},.05);
 assert.equal(s.x,.955);assert.equal(s.y,.64);
});
test('pause freezes the complete simulation',()=>{
 const s=createVoyage();start(s);dash(s);update(s,{},.05);pause(s);
 const frozen=structuredClone(s);update(s,{x:1},.05);assert.deepEqual(s,frozen);
 resume(s);update(s,{},.05);assert.ok(s.time>frozen.time);
});
test('dash prevents damage and has a cooldown',()=>{
 const s=createVoyage();start(s);assert.equal(dash(s),true);
 assert.equal(dash(s),false);
 s.entities=[{id:1,type:'rock',x:s.x,y:s.y,age:0,speed:0}];
 update(s,{},.01);assert.equal(s.hull,3);assert.equal(s.score,5);
 for(let i=0;i<61;i++){s.entities=[];s.spawn=100;update(s,{},.05);}
 assert.equal(dash(s),true);
});
test('collecting sparks rewards streaks; damage breaks a streak',()=>{
 const s=createVoyage();start(s);
 for(let i=0;i<2;i++){s.entities=[{id:i,type:'light',x:s.x,y:s.y,age:0,speed:0}];update(s,{},.01);}
 assert.equal(s.lights,2);assert.equal(s.score,22);
 s.entities=[{id:3,type:'rock',x:s.x,y:s.y,age:0,speed:0}];update(s,{},.01);
 assert.equal(s.hull,2);assert.equal(s.combo,0);assert.ok(s.safe>0);
 s.entities=[{id:4,type:'rock',x:s.x,y:s.y,age:0,speed:0}];update(s,{},.01);
 assert.equal(s.hull,2);
});
test('three unprotected hits end the voyage and stop updates',()=>{
 const s=createVoyage();start(s);
 for(let i=0;i<3;i++){s.safe=0;s.entities=[{id:i,type:'rock',x:s.x,y:s.y,age:0,speed:0}];update(s,{},.01);}
 assert.equal(s.status,'lost');assert.equal(s.hull,0);
 const frozen=structuredClone(s);update(s,{},.05);assert.deepEqual(s,frozen);
});
test('crossings advance and victory awards remaining hull once',()=>{
 const s=createVoyage();start(s);s.time=34.99;s.spawn=100;update(s,{},.02);assert.equal(s.crossing,1);
 s.time=69.99;update(s,{},.02);assert.equal(s.crossing,2);
 s.time=104.99;update(s,{},.02);assert.equal(s.status,'won');assert.equal(s.score,300);
 update(s,{},.05);assert.equal(s.score,300);
});
test('records tolerate blocked/malformed storage and retain the maximum',()=>{
 const denied={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(readBest(denied),0);assert.equal(saveBest(denied,25,20),25);
 for(const bad of ['null','{}','-1','1.5','100001','"500"','broken'])assert.equal(readBest({getItem:()=>bad}),0);
 let value='40';const storage={getItem:()=>value,setItem:(k,v)=>value=v};
 assert.equal(readBest(storage),40);assert.equal(saveBest(storage,20,40),40);
 assert.equal(saveBest(storage,90,40),90);assert.equal(value,'90');
});

