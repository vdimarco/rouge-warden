import assert from 'node:assert/strict';
import {loadDistrict,listeners} from './node-district.mjs';
const District=await loadDistrict();
const d=new District();const enemy={boss:false,phase:'windup',timer:1,period:1.5,dir:0,hit:0};
assert.ok(d.batchStats.before>100);assert.ok(d.batchStats.after<60);assert.ok(d.batchStats.after<d.batchStats.before/5);assert.equal(d.collides(-14,-13),true);assert.equal(d.collides(0,0),false);
d.placeEnemy(enemy);assert.equal(d.canStrike(),false);d.keys.add('KeyW');for(let i=0;i<10;i++)d.update(.04,true,enemy);assert.ok(d.position.z<8);assert.equal(d.canStrike(),true);
d.yaw=Math.PI;assert.equal(d.canStrike(),false);d.update(.02,false,enemy);assert.equal(d.keys.size,0);assert.equal(d.move.x,0);
d.reset();d.position.set(-8,1.65,-13);d.keys.add('KeyA');for(let i=0;i<100;i++)d.update(.04,true,enemy);assert.equal(d.collides(d.position.x,d.position.z),false);
let pickups=0;d.onPickup=()=>pickups++;d.position.set(-23,1.65,5);d.clearInput();d.update(.02,true,enemy);assert.equal(pickups,1);d.update(.02,true,enemy);assert.equal(pickups,1);
// A browser resize event updates the shared viewport first; the camera then follows it.
innerWidth=844;innerHeight=390;listeners.resize.forEach(f=>f());d.resize();assert.equal(d.camera.aspect,844/390);
// The Portal Badlands style swaps in the alien biome and its walls. The courtyard comes back unchanged.
const colors=Object.values(d.materials).map(m=>m.color.getHex());d.setStyle('rick-morty');assert.equal(d.alienWorld.root.visible,true);assert.equal(d.solids,d.alienWorld.solids);assert.ok(d.cityScenery.every(m=>!m.visible));assert.equal(d.portal.visible,false);d.setStyle('ghibli');assert.deepEqual(Object.values(d.materials).map(m=>m.color.getHex()),colors);assert.equal(d.alienWorld.root.visible,false);assert.equal(d.solids,d.citySolids);assert.ok(d.cityScenery.filter(m=>m!==d.ink).every(m=>m.visible));
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

// Full groups preserve arm animation, select living targets, and retire old encounters.
const fsquad=[{id:0,hp:6,phase:'guard',period:1,dir:0},{id:1,hp:6,phase:'windup',period:1,timer:.5,dir:1}];d.reset();d.beginEncounter(fsquad);assert.equal(d.crowd.length,2);assert.ok(d.crowd.every(c=>c.arm&&c.legs.every(Boolean)));d.update(.05,true,fsquad[0]);assert.ok(d.crowd[1].arm.rotation.x<-.35);fsquad[0].hp=0;assert.equal(d.chooseFighter(null),fsquad[1]);d.update(.05,true,fsquad[1]);assert.equal(d.crowd[0].mesh.visible,false);const retired=d.crowd.map(c=>c.mesh);d.beginEncounter([{id:2,hp:6,phase:'guard'}]);assert.ok(retired.every(m=>!d.scene.children.includes(m)));

// The duel stays in view: a view test, a soft lock-on and circling that stays near the middle of the view.
const portrait=()=>{innerWidth=390;innerHeight=844;listeners.resize.forEach(f=>f());d.resize()};
const solo=(x,z,phase='guard')=>{const f={id:9,hp:6,max:6,phase,attack:'cut',dir:0,hit:0,period:1,timer:1,posture:0};d.reset();d.setStyle('rick-morty');d.position.set(0,1.65,8);d.beginEncounter([f]);d.crowd[0].mesh.position.set(x,0,z);return f};
const ahead=a=>[-3*Math.sin(a),8-3*Math.cos(a)];
portrait();let f=solo(...ahead(0));
assert.ok(Math.abs(d.bearing(d.crowd[0].mesh.position))<1e-9);assert.equal(d.inView(f),true);assert.equal(d.canEngage(f),true);
// A portrait phone sees about 17 degrees to each side. A fighter 30 degrees to the left is off screen.
assert.ok(d.halfView()>.27&&d.halfView()<.33,`half view ${d.halfView()}`);
f=solo(...ahead(.52));assert.ok(Math.abs(d.bearing(d.crowd[0].mesh.position)-.52)<.01);assert.equal(d.inView(f),false);assert.equal(d.canEngage(f),false);
// The lock-on turns toward that fighter. During a windup it is centered within a second.
for(let i=0;i<30;i++)d.turnToward(f,1/30,7,0);assert.ok(Math.abs(d.bearing(d.crowd[0].mesh.position))<.035);assert.equal(d.inView(f),true);
// A drag on the look pad pauses the lock-on for a moment.
f=solo(...ahead(.52));d.lookedAt=d.clock;const yaw=d.yaw;d.assist(f,f,1/30);assert.equal(d.yaw,yaw);d.lookedAt=d.clock-1;d.assist(f,f,1/30);assert.ok(d.yaw>yaw);
// Behind the player, a fighter is never in view.
f=solo(...ahead(Math.PI));assert.equal(d.inView(f),false);
// In guard, a fighter circles but stays inside the band: in view for ten seconds while the player stands still.
f=solo(...ahead(0));let worst=0;for(let i=0;i<300;i++){d.update(1/30,true,f,false);worst=Math.max(worst,Math.abs(d.bearing(d.crowd[0].mesh.position)))}
assert.ok(worst<=.26+.03,`circled out to ${(worst*180/Math.PI).toFixed(1)} degrees`);assert.equal(d.inView(f,0),true);
// A fighter that starts far to the side circles back toward the middle of the view.
for(const side of [1.2,-1.2]){f=solo(...ahead(side));for(let i=0;i<90;i++)d.update(1/30,true,f,false);assert.ok(Math.abs(d.bearing(d.crowd[0].mesh.position))<1.2-.4,`a fighter at ${side} rad did not come back`)}
// A fighter that ends up too close is not frozen there: it steps back out to fighting range.
f=solo(...ahead(0));d.crowd[0].mesh.position.set(0,0,7.5);for(let i=0;i<30;i++)d.update(1/30,true,f,false);assert.ok(d.fighterDistance(f)>1.1,`still ${d.fighterDistance(f).toFixed(2)} m away`);
// A cut goes to an open guard in reach, even when another fighter is the chosen target.
const pair=[{id:0,hp:6,max:6,phase:'windup',attack:'cut',dir:0,hit:0,period:1,timer:1,posture:0},{id:1,hp:6,max:6,phase:'open',attack:'cut',dir:0,hit:0,period:1,timer:1,posture:4}];
d.reset();d.position.set(0,1.65,8);d.beginEncounter(pair);d.crowd[0].mesh.position.set(-.8,0,5.5);d.crowd[1].mesh.position.set(.8,0,5.5);
assert.equal(d.strikeTarget(pair[0]),pair[1]);pair[1].phase='guard';assert.equal(d.strikeTarget(pair[0]),pair[0]);
console.log('PASS: view test, lock-on, look-pad priority, circling that stays in view, step back and cut target.');
