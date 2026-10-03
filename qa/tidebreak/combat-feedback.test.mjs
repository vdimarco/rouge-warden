import assert from 'node:assert/strict';
import { combatMarks, controlLabels, followUpFeedback, recentCombatFeedback } from '../../public/tidebreak/combat-feedback.js';
import { Sound } from '../../public/tidebreak/audio.js';

assert.deepEqual(combatMarks({wetUntil:12,brineUntil:10,chillUntil:13,spiritUntil:11},10).map(m=>[m.type,m.remaining]),[['wet',2],['chill',3],['spirit',1]],'marks expire exactly at their deadline');
assert.deepEqual(controlLabels({stun:0,snaredUntil:12},10),['ROOTED'],'roots render without a stun');
assert.deepEqual(controlLabels({stun:1,snaredUntil:12,silencedUntil:11,disarmedUntil:11},10),['STUNNED','ROOTED','SILENCED','DISARMED'],'simultaneous controls retain distinct labels');

const p={id:1,team:0,hero:4,hp:100,x:1000,y:1000,mana:400,skillRanks:[0,1,1,0],cd:[0,0,0,0]},t={id:2,team:1,kind:'hero',hp:100,maxHp:100,x:1200,y:1000,radius:24,brineUntil:15};
const s={time:10,phase:0,winner:null,units:[p,t]},opts={visible:new Set([1,2]),clear:()=>true};
assert.equal(followUpFeedback(s,p,opts).slot,2);
for (const change of [{mana:0},{skillRanks:[0,1,0,0]},{cd:[0,0,2,0]},{hp:0},{stun:1},{fear:1},{silencedUntil:12},{castIntent:{}},{recoveryUntil:12}]) assert.equal(followUpFeedback(s,{...p,...change},opts),null,'unusable spells never advertise a follow-up');
assert.equal(followUpFeedback(s,p,{...opts,visible:new Set([1])}),null,'fog hides the cue');
assert.equal(followUpFeedback(s,p,{...opts,clear:()=>false}),null,'cover blocks the cue');
assert.equal(followUpFeedback({...s,time:15},p,opts),null,'expired marks clear the cue');
assert.equal(followUpFeedback({...s,time:14.8},p,opts),null,'a mark that expires during cast windup cannot promise a combo');
assert.equal(followUpFeedback({...s,units:[p,{...t,x:1600}]},p,opts),null,'out-of-range marks do not promise a bonus');
assert.equal(followUpFeedback(s,{...p,snaredUntil:15},opts).slot,2,'root preserves a usable non-movement finisher');
assert.deepEqual(recentCombatFeedback(s,p),[],'old snapshots do not need an event list');
const events=[{id:1,time:9.5,type:'combo',source:1,target:2,x:1200,y:1000},{id:2,time:9,type:'kill',source:1,target:2,x:1200,y:1000},{id:3,time:10,type:'interrupt',source:3,target:4,x:1300,y:1000},{id:4,time:10,type:'kill',source:3,target:4,x:4000,y:1000}];
assert.deepEqual(recentCombatFeedback({...s,combatFeedback:events},p,{visible:new Set([3])}).map(e=>e.id),[1,3],'feedback limits itself to fresh player or nearby visible events');
const sound=new Sound(),tones=[];sound.tone=(...args)=>tones.push(args);
for(let hero=0;hero<12;hero++)sound.skill(1,hero);
assert.equal(new Set(tones.map(t=>t[0])).size,12,'every hero has a distinct cast pitch');
tones.length=0;const sounds={...s,combatFeedback:[{...events[0],time:9.8}]};sound.syncFeedback(sounds,p);assert.equal(tones.length,2,'an earned combo gets its own two-note result');sound.syncFeedback(sounds,p);assert.equal(tones.length,2,'each event plays only once');
sounds.combatFeedback.push({id:5,time:10,type:'kill',source:3,target:4});sound.syncFeedback(sounds,p);assert.equal(tones.length,2,'unrelated fights do not compete with player feedback');
console.log('PASS: mark expiry, independent control labels, learned/ready/affordable/visible/reachable combos, and local result feedback.');
