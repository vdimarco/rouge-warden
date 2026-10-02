import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compile=async file=>{const result=await build({entryPoints:[file],bundle:true,write:false,format:'esm',platform:'node'});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)};
const {project,unproject,screenInput,readView}=await compile('lib/game/camera.ts');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);
for(const view of ['isometric','top-down']){
 test(`${view}: projection round-trips distant and negative coordinates`,()=>{for(const point of [{x:0,y:0},{x:-420,y:1790},{x:99999,y:-3210}]){const result=unproject(project(point,view),view);near(result.x,point.x);near(result.y,point.y)}});
 test(`${view}: input follows screen direction with capped world speed`,()=>{for(const p of [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1},{x:1,y:1},{x:.2,y:-.3}]){const world=screenInput(p,view),screen=project(world,view);near(screen.x*p.y-screen.y*p.x,0);assert.ok(screen.x*p.x+screen.y*p.y>0);near(Math.hypot(world.x,world.y),Math.min(1,Math.hypot(p.x,p.y)))}});
}
globalThis.Image=class{set src(value){}};globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.document={addEventListener(){},removeEventListener(){}};
const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
const {Game}=await compile('lib/game/engine.ts');
const canvas={getContext:()=>({}),getBoundingClientRect:()=>({width:390,height:844}),addEventListener(){},removeEventListener(){}};
test('camera defaults, persists and tolerates unavailable storage',()=>{storage.clear();assert.equal(readView(),'isometric');const g=new Game(canvas,()=>{});g.toggleView();assert.equal(readView(),'top-down');const original=globalThis.localStorage;globalThis.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.equal(readView(),'isometric');g.toggleView();assert.equal(g.view,'isometric');globalThis.localStorage=original;g.destroy()});
test('pause toggle preserves simulation and clears input; live toggling is rejected',()=>{const g=new Game(canvas,()=>{});g.mode='pause';g.p={x:85,y:-32,hp:67};g.time=51;g.xp=11;g.enemies=[{x:3,y:4,hp:9}];const before=JSON.stringify([g.p,g.time,g.xp,g.enemies,g.powers]);g.joy.dx=1;g.keys.add('d');g.vel.x=195;g.toggleView();assert.equal(JSON.stringify([g.p,g.time,g.xp,g.enemies,g.powers]),before);assert.equal(g.joy.dx,0);assert.equal(g.keys.size,0);assert.equal(g.vel.x,0);g.mode='play';const view=g.view;g.toggleView();assert.equal(g.view,view);g.destroy()});
test('engine movement and facing follow keyboard screen directions in both views',()=>{for(const view of ['isometric','top-down'])for(const [key,direction] of [['d',{x:1,y:0}],['s',{x:0,y:1}],['a',{x:-1,y:0}],['w',{x:0,y:-1}]]){const g=new Game(canvas,()=>{});g.view=view;g.mode='play';g.keys.add(key);g.spawnTimer=100;g.tick(.05);const screen=project(g.p,view);near(screen.x*direction.y-screen.y*direction.x,0);assert.ok(screen.x*direction.x+screen.y*direction.y>0);if(direction.x)assert.equal(g.facing,direction.x);g.destroy()}});
