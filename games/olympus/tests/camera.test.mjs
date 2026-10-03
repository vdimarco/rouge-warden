import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compile=async file=>{const result=await build({entryPoints:[file],bundle:true,write:false,format:'esm',platform:'node'});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)};
const {project,unproject,screenInput,screenSpeedScale,readView}=await compile('lib/game/camera.ts');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);
for(const view of ['isometric','top-down']){
 test(`${view}: projection round-trips distant and negative coordinates`,()=>{for(const point of [{x:0,y:0},{x:-420,y:1790},{x:99999,y:-3210}]){const result=unproject(project(point,view),view);near(result.x,point.x);near(result.y,point.y)}});
 test(`${view}: input follows screen direction with consistent visible speed`,()=>{for(const p of [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1},{x:1,y:1},{x:1,y:-1},{x:-1,y:1},{x:-1,y:-1},{x:.2,y:-.3}]){const screen=project(screenInput(p,view),view);near(screen.x*p.y-screen.y*p.x,0);assert.ok(screen.x*p.x+screen.y*p.y>0);near(Math.hypot(screen.x,screen.y),Math.min(1,Math.hypot(p.x,p.y))*screenSpeedScale(view))}assert.deepEqual(screenInput({x:0,y:0},view),{x:0,y:0})});
}
globalThis.Image=class{set src(value){}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.document={addEventListener(){},removeEventListener(){}};
const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
const {Game}=await compile('lib/game/engine.ts');
const canvas={getContext:()=>({}),getBoundingClientRect:()=>({width:390,height:844}),addEventListener(){},removeEventListener(){}};
const directions=[['d'],['d','s'],['s'],['s','a'],['a'],['a','w'],['w'],['w','d']];
for(const view of ['isometric','top-down'])test(`${view}: timed keyboard and joystick travel match across directions, upgrades and layouts`,()=>{
 for(const [width,height] of [[390,844],[844,390],[540,900]])for(const hermes of [0,4])for(const strength of [1,.4])for(const keys of directions){
  const g=new Game({...canvas,getBoundingClientRect:()=>({width,height})},()=>{});g.view=view;g.mode='play';g.spawnTimer=100;g.powers.hermes=hermes;
  const raw={x:Number(keys.includes('d'))-Number(keys.includes('a')),y:Number(keys.includes('s'))-Number(keys.includes('w'))};
  if(strength===1)keys.forEach(key=>g.keys.add(key));else{const length=Math.hypot(raw.x,raw.y);g.joy.dx=raw.x/length*strength;g.joy.dy=raw.y/length*strength}
  const dt=1/60,smoothing=dt*20,speed=195*(1+.065*hermes)*screenSpeedScale(view)*strength;
  let expected=0,velocity=0;for(let i=0;i<60;i++){velocity+=(speed-velocity)*smoothing;expected+=velocity*dt;g.tick(dt)}
  const traveled=project(g.p,view);near(Math.hypot(traveled.x,traveled.y),expected);near(traveled.x*raw.y-traveled.y*raw.x,0);near(g.moving,velocity/(195*(1+.065*hermes)*screenSpeedScale(view)));g.destroy();
 }
});
test('full horizontal input preserves the established pace in both views',()=>{const iso=screenInput({x:1,y:0},'isometric');near(Math.hypot(iso.x,iso.y),1);assert.deepEqual(screenInput({x:1,y:0},'top-down'),{x:1,y:0})});
test('camera defaults, persists and tolerates unavailable storage',()=>{storage.clear();assert.equal(readView(),'isometric');const g=new Game(canvas,()=>{});g.toggleView();assert.equal(readView(),'top-down');const original=globalThis.localStorage;globalThis.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.equal(readView(),'isometric');g.toggleView();assert.equal(g.view,'isometric');globalThis.localStorage=original;g.destroy()});
test('pause toggle preserves simulation and clears input; live toggling is rejected',()=>{const g=new Game(canvas,()=>{});g.mode='pause';g.p={x:85,y:-32,hp:67};g.time=51;g.xp=11;g.enemies=[{x:3,y:4,hp:9}];const before=JSON.stringify([g.p,g.time,g.xp,g.enemies,g.powers]);g.joy.dx=1;g.keys.add('d');g.vel.x=195;g.toggleView();assert.equal(JSON.stringify([g.p,g.time,g.xp,g.enemies,g.powers]),before);assert.equal(g.joy.dx,0);assert.equal(g.keys.size,0);assert.equal(g.vel.x,0);g.mode='play';const view=g.view;g.toggleView();assert.equal(g.view,view);g.destroy()});
test('engine movement and facing follow keyboard screen directions in both views',()=>{for(const view of ['isometric','top-down'])for(const [key,direction] of [['d',{x:1,y:0}],['s',{x:0,y:1}],['a',{x:-1,y:0}],['w',{x:0,y:-1}]]){const g=new Game(canvas,()=>{});g.view=view;g.mode='play';g.keys.add(key);g.spawnTimer=100;g.tick(.05);const screen=project(g.p,view);near(screen.x*direction.y-screen.y*direction.x,0);assert.ok(screen.x*direction.x+screen.y*direction.y>0);if(direction.x)assert.equal(g.facing,direction.x);g.destroy()}});
