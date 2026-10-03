import {test} from 'node:test';import assert from 'node:assert/strict';import {Duel,seededRandom,seedFrom,dayKey,pick,PARRY_WINDOW} from '../../public/neon/duel.js';
test('guard stops health damage; each opening allows only one hit',()=>{const d=new Duel(),f=d.fighters[0];for(let i=0;i<5;i++)d.swing(f,0);assert.equal(f.hp,6);d.open(f);assert.equal(d.swing(f,0,99).damage,3);assert.equal(f.hp,3);d.swing(f,1,99);assert.equal(f.hp,3);assert.equal(d.finished,false)});
test('one parry opens the guard at once, and a miss deals damage',()=>{const d=new Duel(1,seededRandom(4)),f=d.fighters[0];let mode='parry',events=[],attacks=[];const ctx={canAttack:()=>true,defense:()=>({inRange:true,blocked:mode==='parry',perfect:true}),event:(k,x)=>{events.push(k);if(k==='windup')attacks.push(x.attack)}};for(let i=0;i<60&&f.phase!=='open';i++)d.update(.1,ctx);assert.ok(!attacks.includes('sweep'),'this seed must not start with a sweep, which no guard can stop');assert.equal(f.phase,'open');assert.deepEqual(events,['windup','parry']);assert.equal(f.hp,6);assert.equal(d.swing(f,0,2).kind,'hit');assert.equal(f.hp,4);mode='miss';for(let i=0;i<35;i++)d.update(.1,ctx);assert.ok(events.includes('damage'))});
test('groups progress and share one attack slot, with every fighter getting a turn',()=>{assert.equal(new Duel(1).fighters.length,1);assert.equal(new Duel(3).fighters.length,2);assert.equal(new Duel(5).fighters.length,3);assert.equal(new Duel(99).fighters.length,5);const d=new Duel(5),turns=new Set();for(let i=0;i<250;i++){d.update(.1,{canAttack:()=>true,defense:()=>({inRange:true,dashing:true}),event:(k,f)=>{if(k==='windup')turns.add(f.id)}});assert.ok(d.fighters.filter(f=>f.phase==='windup').length<=1)}assert.equal(turns.size,3)});
test('dead fighters never attack; encounter ends only after the whole group',()=>{const d=new Duel(3);for(const f of d.fighters){while(f.hp){d.open(f);d.swing(f,0,3)}if(f.id===0)assert.equal(d.finished,false)}assert.equal(d.finished,true);d.update(10,{event:()=>assert.fail('dead attack')});});

// One exchange with a fixed defense. The seed starts with a delayed cut, which a guard can stop.
function exchange(defense,seed=4){const d=new Duel(1,seededRandom(seed)),f=d.fighters[0];let result=null;for(let i=0;i<200&&!result;i++)d.update(.05,{canAttack:()=>true,defense:()=>defense,event:(k,x)=>{if(k!=='windup')result={kind:k,phase:x.phase,posture:x.posture}}});return result}
test('a parry opens the guard; a block adds 1 and a dodge adds 2, and neither opens it',()=>{
 assert.deepEqual(exchange({inRange:true,blocked:true,perfect:true}),{kind:'parry',phase:'open',posture:4});
 assert.deepEqual(exchange({inRange:true,blocked:true,perfect:false}),{kind:'block',phase:'recover',posture:1});
 assert.deepEqual(exchange({inRange:true,dashing:true}),{kind:'evade',phase:'recover',posture:2});
 assert.deepEqual(exchange({inRange:true,dashing:true,blocked:true,perfect:true}),{kind:'evade',phase:'recover',posture:2});
 // Out of reach, the attack cuts air and the guard stays whole.
 assert.deepEqual(exchange({inRange:false}),{kind:'whiff',phase:'recover',posture:0});
 // Dodges still add up. The guard breaks when the bar is full, never after one dodge.
 const d=new Duel(1,seededRandom(9)),f=d.fighters[0],phases=[];for(let i=0;i<600&&f.phase!=='open';i++)d.update(.05,{canAttack:()=>true,defense:()=>({inRange:true,dashing:true}),event:(k,x)=>{if(k==='evade')phases.push(x.phase)}});
 assert.equal(f.phase,'open');assert.ok(phases.length>=2);assert.ok(phases.slice(0,-1).every(p=>p!=='open'));
 // A touch guard has a wider parry window than a blade set with the gyro.
 assert.ok(PARRY_WINDOW.touch>=.55&&PARRY_WINDOW.touch<=.65);assert.ok(PARRY_WINDOW.gyro<PARRY_WINDOW.touch);
});
test('every hit comes at least 0.3 s after the windup that warns of it',()=>{
 // A scripted defense: it misses, blocks, parries, dodges or steps away, in a fixed pattern.
 const pattern=seededRandom(21),d=new Duel(5,seededRandom(5));let t=0;const warned=new Map(),gaps=[],kinds=new Set();
 const pick=()=>{const r=pattern();return r<.4?{inRange:true}:r<.6?{inRange:true,blocked:true}:r<.75?{inRange:true,blocked:true,perfect:true}:r<.9?{inRange:true,dashing:true}:{inRange:false}};
 const ctx={canAttack:()=>true,defense:()=>pick(),event:(k,f)=>{kinds.add(k);if(k==='windup'){assert.ok(!warned.has(f.id));warned.set(f.id,t);return}if(k==='damage')gaps.push(t-(warned.get(f.id)??Infinity));warned.delete(f.id)}};
 for(let i=0;i<60*120;i++){t+=1/60;d.update(1/60,ctx)}
 assert.ok(gaps.length>=10,`only ${gaps.length} hits in two minutes`);assert.ok(gaps.every(g=>g>=.3),`a hit came ${Math.min(...gaps).toFixed(2)} s after its warning`);
 for(const k of ['parry','block','evade','whiff','damage'])assert.ok(kinds.has(k),`the script never caused a ${k}`);
});
test('the same seed gives the same attacks and the same circuits',()=>{
 const attacks=seed=>{const d=new Duel(5,seededRandom(seed)),log=[];for(let i=0;i<600;i++)d.update(.05,{canAttack:()=>true,defense:()=>({inRange:true,blocked:true}),event:(k,f)=>{if(k==='windup')log.push(`${f.id}:${f.attack}:${f.dir}:${f.period.toFixed(3)}`)}});return log};
 const a=attacks(seedFrom('2026-10-03',5)),b=attacks(seedFrom('2026-10-03',5)),c=attacks(seedFrom('2026-10-04',5));
 assert.ok(a.length>10);assert.deepEqual(a,b);assert.notDeepEqual(a,c);
 const circuits=['Edge amplifier','Time crystal','Repair pulse','Vampire circuit','Capacitor'],seed=seedFrom('2026-10-03',2,'circuits');
 const picks=pick(circuits,3,seededRandom(seed));assert.deepEqual(pick(circuits,3,seededRandom(seed)),picks);assert.equal(new Set(picks).size,3);
 assert.notEqual(seedFrom('2026-10-03',2),seedFrom('2026-10-03',3));assert.equal(dayKey(new Date(2026,9,3,23,59)),'2026-10-03');
});
