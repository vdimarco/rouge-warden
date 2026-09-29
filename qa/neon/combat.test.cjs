const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function boot(){
 const elements=new Map(),events={};
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',innerHTML:'',onclick:null,addEventListener(){},setPointerCapture(){},getContext:()=>ctx});return elements.get(id)};
 const s={console,Math,Number,innerWidth:390,innerHeight:844,devicePixelRatio:2,performance:{now:()=>s.now},now:1000,screen:{orientation:{angle:0}},localStorage:{getItem:()=>0,setItem(){}},document:{getElementById:element,addEventListener(){},querySelectorAll:()=>[]},addEventListener:(n,f)=>events[n]=f,requestAnimationFrame(){},setTimeout:()=>1,clearTimeout(){},DeviceMotionEvent:function(){},DeviceOrientationEvent:function(){},isSecureContext:true};
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
test('phone pose moves the sword, blocks with geometry and hides combat buttons',async()=>{
 const {run,events,elements}=boot();run('start();enemy.dir=0;enemy.hp=10');await elements.get('motion').onclick();
 const pose=(alpha,beta=0,gamma=0)=>{run('now+=40');events.deviceorientation({alpha,beta,gamma})};
 pose(0);pose(0);run('update(.01)');
 assert.equal(run('guard'),true);assert.equal(elements.get('guard').hidden,true);assert.equal(elements.get('burst').hidden,true);
 run('guardAt=time-1;enemy.timer=.01;update(.02)');assert.equal(run('health'),100);
 // A vertical blade cannot catch a vertical attack.
 run('enemy.phase="windup";enemy.dir=1;enemy.timer=.01;update(.02)');assert.equal(run('health'),84);
 // Roll the grip to lay the blade across a vertical strike.
 pose(90);for(let i=0;i<8;i++)pose(90);
 run('enemy.phase="windup";enemy.dir=1;enemy.timer=1;update(.01)');assert.equal(run('guard'),true);
 assert.ok(run('Math.abs(Math.cos(sword.pose.angle))>.95'));
 run('enemy.timer=.01;update(.02)');assert.equal(run('health'),84);assert.equal(run('enemy.phase'),'open');
 elements.get('center').onclick();assert.equal(run('base'),null);assert.equal(run('guard'),false);
 pose(90);assert.ok(run('Math.abs(sword.pose.angle+Math.PI/2)<.01'));
});
test('gyro cuts require a physical blade sweep and rearm; stale sensors pause safely',async()=>{
 const {run,events,elements}=boot();run('start();enemy.dir=0;enemy.hp=10');await elements.get('motion').onclick();
 function pose(a){run('now+=40');events.deviceorientation({alpha:a,beta:0,gamma:0})}
 pose(0);pose(0);pose(35);assert.ok(run('enemy.hp<10'));
 const hp=run('enemy.hp');run('cooldown=0');pose(70);assert.equal(run('enemy.hp'),hp);
 for(let i=0;i<6;i++)pose(70);assert.equal(run('gyroReady'),true);
 run('charge=100;cooldown=0;enemy.phase="open"');pose(35);assert.equal(run('slow'),4);
 run('now+=1600;update(.02)');assert.equal(run('gyro'),false);assert.equal(run('state'),'pause');assert.equal(elements.get('guard').hidden,false);
});
test('permission denial, null samples and landscape calibration preserve touch fallback',async()=>{
 const {run,events,elements}=boot();run('start();DeviceOrientationEvent.requestPermission=async()=>"denied"');await elements.get('motion').onclick();assert.equal(run('gyro'),false);
 run('DeviceOrientationEvent.requestPermission=undefined;screen.orientation.angle=90');await elements.get('motion').onclick();
 events.deviceorientation({alpha:null,beta:null,gamma:null});assert.equal(run('raw'),null);
 run('now+=40');events.deviceorientation({alpha:359,beta:55,gamma:10});
 run('now+=40');events.deviceorientation({alpha:0,beta:55,gamma:10});assert.ok(run('sword.speed<30'));
 run('resize()');assert.equal(run('raw'),null);
 await elements.get('motion').onclick();run('enemy.dir=0;cooldown=0');
 elements.get('world').onpointerdown({pointerId:1,clientX:20,clientY:300});elements.get('world').onpointermove({pointerId:1,clientX:200,clientY:300});assert.equal(run('enemy.hp'),1);
});
test('render path runs at portrait and landscape sizes',()=>{const {run}=boot();run('start();draw();innerWidth=844;innerHeight=390;resize();draw()')});
