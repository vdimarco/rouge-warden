import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Duel} from '../public/neon/duel.js';
const ds=await readFile(new URL('../public/neon/district.js',import.meta.url),'utf8');
const {District}=await import('data:text/javascript,'+encodeURIComponent(ds.replace(/^import .*;$/gm,'')));
const make=()=>{const d=Object.create(District.prototype);Object.assign(d,{active:true,dashCooldown:0,move:{x:0,y:0},keys:new Set(),yaw:0});return d};
for(const [key,x,z] of [['KeyW',0,-1],['KeyS',0,1],['KeyA',-1,0],['KeyD',1,0],[null,0,1]]){const d=make();if(key)d.keys.add(key);assert(d.requestRoll());assert.equal(d.dashVector.x,x);assert.equal(d.dashVector.z,z);assert.equal(d.evade,.25);assert(!d.requestRoll());}
const d=make();d.active=false;assert(!d.requestRoll());
for(const type of ['cut','overhead','lunge','sweep','delayed']){
  const duel=new Duel(),f=duel.fighters[0];
  const dodge=()=>{duel.active=f;f.phase='windup';f.attack=type;f.timer=.01;let event;duel.update(.02,{defense:()=>({inRange:true,dashing:true,blocked:false}),event:k=>event=k,canAttack:()=>false});return event};
  // One dodge adds guard pressure but opens nothing, so the parry stays the key move.
  assert.equal(dodge(),'evade');assert.equal(f.hp,6);assert.equal(f.phase,'recover');assert.equal(f.posture,2);assert.equal(duel.swing(f,0,2).kind,'clash');
  // A second dodge fills the guard bar and opens a counter.
  assert.equal(dodge(),'evade');assert.equal(f.phase,'open');assert.equal(duel.swing(f,0,2).kind,'hit');
}
for(const blocked of [true,false]){const duel=new Duel(),f=duel.fighters[0];Object.assign(f,{phase:'windup',attack:'sweep',timer:.01});duel.active=f;let event;duel.update(.02,{defense:()=>({inRange:true,dashing:false,blocked,perfect:true}),event:k=>event=k,canAttack:()=>false});assert.equal(event,'damage')}
const duel=new Duel(3,()=>.6);let previous=null;
for(let i=0;i<12;i++){const f=duel.fighters[0];duel.active=null;duel.gap=0;for(const q of duel.fighters){q.phase='guard';q.timer=0}duel.update(.01,{canAttack:q=>q===f,event:()=>{}});assert.notEqual(f.attack,previous);previous=f.attack;assert(f.period>=.7)}
// Movement circles a stationary player and respects obstacles.
const movement=make();movement.position={x:0,z:0};movement.clock=1;movement.collides=()=>false;
const mesh={position:{x:0,y:0,z:2.6},lookAt(){}};movement.crowd=[{fighter:{id:0,hp:6,phase:'guard',attack:'cut',hit:0,dir:0},mesh,orbit:1,legs:[],ring:{material:{color:{set(){}}},scale:{setScalar(){}}}}];
movement.updateCrowd(.1);assert(Math.abs(mesh.position.x)>.1);
movement.collides=()=>true;const p={...mesh.position};movement.updateCrowd(.1);assert.equal(mesh.position.x,p.x);assert.equal(mesh.position.z,p.z);
console.log('Evasion checks passed: directional rolls, cooldown, dodges add guard pressure, two dodges open a counter, sweep guard bypass, attack variation, circling and collision.');
