import fs from 'node:fs';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{style:{setProperty(){}},addEventListener(){},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:104,height:104})});return elements.get(id)};
globalThis.innerWidth=390;globalThis.innerHeight=844;globalThis.devicePixelRatio=1;
globalThis.document={body:{prepend(){}},getElementById:el,createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};globalThis.addEventListener=()=>{};
let src=fs.readFileSync(root+'/public/neon/district.js','utf8');
src=src.replace("import * as THREE from '../crimson/lib/three.module.min.js';",`import * as Real from 'file://${root}/public/crimson/lib/three.module.min.js';const THREE={...Real,WebGLRenderer:class{constructor(){this.domElement={}}setPixelRatio(){}setSize(){}render(s,c){s.updateMatrixWorld();c.updateMatrixWorld()}}};`);
const {District}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const d=new District();const enemy={boss:false,phase:'windup',timer:1,period:1.5,dir:0,hit:0};
assert.ok(d.batchStats.before>100);assert.ok(d.batchStats.after<60);assert.ok(d.batchStats.after<d.batchStats.before/5);assert.equal(d.collides(-14,-13),true);assert.equal(d.collides(0,0),false);
d.placeEnemy(enemy);assert.equal(d.canStrike(),false);d.keys.add('KeyW');for(let i=0;i<10;i++)d.update(.04,true,enemy);assert.ok(d.position.z<8);assert.equal(d.canStrike(),true);
d.yaw=Math.PI;assert.equal(d.canStrike(),false);d.update(.02,false,enemy);assert.equal(d.keys.size,0);assert.equal(d.move.x,0);
d.reset();d.position.set(-8,1.65,-13);d.keys.add('KeyA');for(let i=0;i<100;i++)d.update(.04,true,enemy);assert.equal(d.collides(d.position.x,d.position.z),false);
let pickups=0;d.onPickup=()=>pickups++;d.position.set(-23,1.65,5);d.clearInput();d.update(.02,true,enemy);assert.equal(pickups,1);d.update(.02,true,enemy);assert.equal(pickups,1);
innerWidth=844;innerHeight=390;d.resize();assert.equal(d.camera.aspect,844/390);
const colors=Object.values(d.materials).map(m=>m.color.getHex());d.setStyle('rick-morty');assert.equal(d.portal.visible,true);assert.equal(d.ink.visible,true);assert.equal(d.alienEyes.visible,true);d.setStyle('ghibli');assert.deepEqual(Object.values(d.materials).map(m=>m.color.getHex()),colors);assert.equal(d.portal.visible,false);
function travel(hz){d.reset();d.actor.visible=false;d.keys.add('KeyW');for(let i=0;i<hz;i++)d.update(1/hz,true,null);return 8-d.position.z}
assert.ok(Math.abs(travel(60)-10.5)<.001);assert.ok(Math.abs(travel(30)-travel(60))<.001);assert.ok(Math.abs(travel(15)-travel(60))<.001);
d.reset();d.actor.visible=false;d.position.set(-8,1.65,-13);d.keys.add('KeyA');for(let i=0;i<20;i++)d.update(.1,true,null);assert.equal(d.collides(d.position.x,d.position.z),false);
console.log('Scenery batches:',d.batchStats);
console.log('PASS: real Three scene construction, walk movement, building collision, approach/range/facing gates, pause reset, pickup debounce, viewport resize. GPU renderer mocked.');

// Phone look keeps the current heading when recentered and unwraps compass turns.
d.reset();d.yaw=.8;d.pitch=.1;d.beginMotionView();d.aimMotionView(.5,.3,.1);assert.ok(d.yaw>.8);assert.ok(d.pitch>.1);const heading=d.yaw;d.beginMotionView();d.aimMotionView(0,0,.1);assert.equal(d.yaw,heading);d.aimMotionView(Math.PI-.01,0,.1);const beforeWrap=d.yaw;d.aimMotionView(-Math.PI+.01,0,.1);assert.ok(Math.abs(d.yaw-beforeWrap)<.5);d.aimMotionView(0,10,.1);assert.ok(d.pitch<=.85);d.endMotionView();assert.equal(d.motionView,null);

// A patrol has bounded threats, readable windups, and dash escape windows.
d.reset();d.actor.visible=false;d.reinforce(1);assert.equal(d.drones.length,2);d.reinforce(50);assert.equal(d.drones.length,5);d.reinforce(50);assert.equal(d.drones.length,5);
let droneHits=0,droneKills=0;d.onDroneAttack=()=>droneHits++;d.onDroneKill=()=>droneKills++;
for(const drone of d.drones)drone.mesh.position.set(0,1.35,6);
d.updateDrones(.01);assert.ok(d.drones.every(x=>x.phase==='windup'));assert.equal(droneHits,0);
d.active=true;assert.equal(d.requestDash(1,0),true);assert.equal(d.requestDash(1,0),false);d.updateDrones(1);assert.equal(droneHits,0);
d.dash=0;for(const drone of d.drones){drone.phase='windup';drone.timer=.01}d.updateDrones(.02);assert.equal(droneHits,5);
assert.equal(d.cutDrones(),5);assert.equal(droneKills,5);assert.equal(d.drones.length,0);
d.reinforce(1);d.reset();assert.equal(d.drones.length,0);assert.equal(d.dashCooldown,0);
d.actor.position.set(0,0,2);d.lunge();assert.ok(d.position.z<8);assert.equal(d.collides(d.position.x,d.position.z),false);
d.active=true;d.position.set(-8,1.65,-13);d.requestDash(-1,0);d.update(.1,true,null);assert.equal(d.collides(d.position.x,d.position.z),false);const dashTime=d.dash;d.update(.5,false,null);assert.equal(d.dash,dashTime);
console.log('PASS: patrol cap, attack windup, dash immunity/cooldown, cleave, reset, lunge collision and pause.');
