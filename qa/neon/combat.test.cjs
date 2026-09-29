const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function boot(){
 const elements=new Map(),events={};
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',innerHTML:'',onclick:null,addEventListener(){},setPointerCapture(){},getContext:()=>ctx});return elements.get(id)};
 const s={console,Math,Number,innerWidth:390,innerHeight:844,devicePixelRatio:2,performance:{now:()=>1000},screen:{orientation:{angle:0}},localStorage:{getItem:()=>0,setItem(){}},document:{getElementById:element,addEventListener(){},querySelectorAll:()=>[]},addEventListener:(n,f)=>events[n]=f,requestAnimationFrame(){},setTimeout:()=>1,clearTimeout(){},DeviceMotionEvent:function(){},isSecureContext:true};
 s.window=s;vm.createContext(s);vm.runInContext(fs.readFileSync('public/neon/game.js','utf8'),s);
 return {run:code=>vm.runInContext(code,s),events,elements};
}
test('direction, cooldown, parry, chip damage and pause',()=>{
 const {run}=boot();run('start();enemy.dir=0');
 assert.equal(run('slash(0,100);enemy.hp'),2);
 assert.equal(run('slash(100,0);enemy.hp'),2);
 assert.equal(run('update(.25);slash(100,0);enemy.hp'),1);
 assert.equal(run('cooldown=0;slash(100,0);score>0'),true);
 assert.equal(run('enemy.timer=.1;setGuard(true);update(.11);health'),100);
 assert.equal(run('enemy.phase'), 'open');
 assert.equal(run('enemy.phase="windup";enemy.timer=.5;update(.6);health'),95);
 assert.equal(run('pause();const before=enemy.timer;update(2);enemy.timer===before'),true);
});
test('wave upgrades, overdrive, death, restart and bounded effects',()=>{
 const {run}=boot();run('start();for(let i=0;i<4;i++)hit(100)');
 assert.equal(run('state'),'upgrade');assert.equal(run('wave'),2);
 run('spawn();resume();charge=100;overdrive()');assert.equal(run('slow'),4);assert.ok(run('charge<100'));
 run('health=1;guard=false;enemy.phase="windup";enemy.timer=0;update(.02)');assert.equal(run('state'),'over');
 run('start()');assert.equal(run('health'),100);assert.equal(run('wave'),1);
 run('for(let i=0;i<40;i++)burstParticles(0,0,"red")');assert.ok(run('particles.length<=220'));
});
test('gyro threshold, rearm, null data, recenter and touch fallback',async()=>{
 const {run,events,elements}=boot();run('start();enemy.dir=0');await elements.get('motion').onclick();
 events.devicemotion({rotationRate:null});assert.equal(run('enemy.hp'),2);
 events.devicemotion({rotationRate:{beta:0,gamma:0}});
 events.devicemotion({rotationRate:{beta:150,gamma:0}});assert.equal(run('enemy.hp'),1);
 run('cooldown=0');events.devicemotion({rotationRate:{beta:150,gamma:0}});assert.equal(run('enemy.hp'),1);
 events.devicemotion({rotationRate:{beta:0,gamma:0}});events.devicemotion({rotationRate:{beta:150,gamma:0}});assert.ok(run('score>0'));
 elements.get('center').onclick();assert.equal(run('gyroReady'),false);
 await elements.get('motion').onclick();assert.equal(run('gyro'),false);
 run('cooldown=0;enemy.dir=0');elements.get('world').onpointerdown({pointerId:1,clientX:20,clientY:300});elements.get('world').onpointermove({pointerId:1,clientX:200,clientY:300});assert.equal(run('enemy.hp'),1);
});
test('render path runs at portrait and landscape sizes',()=>{const {run}=boot();run('start();draw();innerWidth=844;innerHeight=390;resize();draw()')});
