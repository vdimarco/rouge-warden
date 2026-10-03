const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
// game.js is an ES module. The tests need its top-level state, so the harness turns it into one
// script. Each imported module runs in its own function scope and returns its exports.
// three.js is not loaded: the fixed-view game and drawAlienBackdrop do not use it.
function bundle(districtClass){
 const dir='public/neon',done=new Set();let out='const __mod={};\n';
 const imports=(src,from)=>src.replace(/^import\s+(?:\*\s+as\s+(\w+)|\{([^}]*)\})\s+from\s+'([^']+)';?/gm,(_,star,names,spec)=>{
  const key=spec.includes('three.module')?'three':path.posix.join(path.posix.dirname(from),spec);
  if(key!=='three'&&!key.endsWith('/district.js'))load(key);
  return star?`const ${star}=__mod[${JSON.stringify(key)}];`:`const {${names.replace(/\s+as\s+/g,':')}}=__mod[${JSON.stringify(key)}];`;
 });
 function load(file){
  if(done.has(file))return;done.add(file);const names=[];
  let src=imports(fs.readFileSync(file,'utf8'),file);
  src=src.replace(/^export\s+(async\s+function|function|class|const|let)\s+(\w+)/gm,(_,kind,name)=>{names.push(name);return `${kind} ${name}`});
  out+=`__mod[${JSON.stringify(file)}]=(function(){${src}\nreturn {${names.join(',')}}})();\n`;
 }
 out+=`__mod['three']={};__mod[${JSON.stringify(dir+'/district.js')}]=(function(){${districtClass||"class District {constructor(){throw Error('No WebGL in unit test')}}"}\nreturn {District}})();\n`;
 const game=imports(fs.readFileSync(dir+'/game.js','utf8'),dir+'/game.js');
 return out+game;
}
function boot(districtClass=null,extra={}){
 const elements=new Map(),events={},timers=[];
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:40})},{get:(o,k)=>o[k]??(()=>{})});
 const element=id=>{if(!elements.has(id))elements.set(id,{id,hidden:false,textContent:'',innerHTML:'',value:'',onclick:null,style:{setProperty(){}},dataset:{},classList:{toggle(){},add(){},remove(){},contains:()=>false},addEventListener(){},setPointerCapture(){},getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),select(){},focus(){}});return elements.get(id)};
 const s={Image:class{constructor(){this.complete=false;this.naturalWidth=0;this.naturalHeight=0}},console:{...console,warn(){}},Math,Number,innerWidth:390,innerHeight:844,devicePixelRatio:2,performance:{now:()=>s.now},now:1000,screen:{orientation:{angle:0}},localStorage:{getItem:()=>0,setItem(){}},document:{getElementById:element,addEventListener(){},querySelectorAll:()=>[],body:{classList:{toggle(){},add(){},remove(){},contains:()=>false}}},matchMedia:()=>({matches:false}),addEventListener:(n,f)=>events[n]=f,dispatchEvent(){},requestAnimationFrame(){},setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length},clearTimeout(){},DeviceMotionEvent:function(){},DeviceOrientationEvent:function(){},isSecureContext:true,...extra};
 s.window=s;vm.createContext(s);vm.runInContext(bundle(districtClass),s);
 return {run:code=>vm.runInContext(code,s),events,elements,timers,sandbox:s};
}
// A stand-in for the 3D district: every fighter stands 2 m away, in front of the player.
const DISTRICT=`class District {constructor(){this.drones=[];this.dash=0;this.evade=0;this.rollTime=0;this.collected=0;this.assetsRequested=true;this.clock=0;this.yaw=0;this.pitch=0}setStyle(){}resize(){}reset(){}endMotionView(){}beginMotionView(){}beginEncounter(f){this.fighters=f;this.selected=f[0]}chooseFighter(){return this.selected}selectFighter(f){this.selected=f}fighterDistance(){return 2}target(){return{x:195,y:400}}canStrike(){return true}lunge(){this.lunged=true}}`;
// Runs the game loop for a number of seconds in small steps, as frames would.
const step=(run,seconds,dt=1/60)=>run(`for(let i=0;i<${Math.round(seconds/dt)};i++)update(${dt})`);
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
 pose(45);pose(90);for(let i=0;i<8;i++)pose(90);
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
 run('charge=100;cooldown=0;enemy.phase="open"');pose(0);assert.equal(run('slow'),4);
 run('now+=1600;update(.02)');assert.equal(run('gyro'),false);assert.equal(run('state'),'pause');assert.equal(elements.get('guard').hidden,false);
});
test('permission denial, null samples and landscape calibration preserve touch fallback',async()=>{
 const {run,events,elements}=boot();run('start();DeviceOrientationEvent.requestPermission=async()=>"denied"');await elements.get('motion').onclick();assert.equal(run('gyro'),false);
 run('DeviceOrientationEvent.requestPermission=undefined;screen.orientation.angle=90');await elements.get('motion').onclick();
 events.deviceorientation({alpha:null,beta:null,gamma:null});assert.equal(run('raw'),null);
 run('now+=40');events.deviceorientation({alpha:359,beta:55,gamma:10});
 run('now+=40');events.deviceorientation({alpha:0,beta:55,gamma:10});assert.ok(run('sword.speed<30'));
 // The layout stays locked during play, so a resize keeps the grip and causes no false swing.
 const grip=run('raw');run('resize()');assert.equal(run('raw'),grip);assert.ok(run('base!==null'));
 run('now+=40');events.deviceorientation({alpha:0,beta:55,gamma:10});assert.ok(run('sword.speed<30'));
 await elements.get('motion').onclick();run('enemy.dir=0;cooldown=0');
 // The layout stays locked at its start angle and the screen is now turned 90 degrees,
 // so a swipe down the physical screen is a horizontal cut in the game.
 assert.equal(run('viewport.angle'),90);
 elements.get('world').onpointerdown({pointerId:1,clientX:195,clientY:250});elements.get('world').onpointermove({pointerId:1,clientX:195,clientY:430});assert.equal(run('enemy.hp'),1);
});
test('render path runs at portrait and landscape sizes',()=>{const {run}=boot();run('start();draw();innerWidth=844;innerHeight=390;resize();draw()')});

test('photographic assets render after load and preserve fallback on failure',()=>{const {run}=boot();run('start();draw();for(const im of Object.values(art)){im.complete=true;im.naturalWidth=1024;im.naturalHeight=1536}draw();gyro=true;draw();innerWidth=844;innerHeight=390;resize();draw();art.duelist.naturalWidth=0;draw()')});

test('twisting the handle never cuts; blade depth changes its visible length',async()=>{
 const {run,events,elements}=boot();run('start();enemy.hp=20;enemy.dir=0');await elements.get('motion').onclick();
 const pose=(a,b,g)=>{run('now+=40');events.deviceorientation({alpha:a,beta:b,gamma:g})};
 pose(0,0,0);pose(0,0,0);
 for(let g=10;g<=70;g+=10)pose(0,0,g);
 assert.equal(run('enemy.hp'),20);assert.ok(run('sword.speed<.01'));
 assert.ok(run('Math.abs(sword.direction[0])<.001'));
 const length=run('Math.hypot(swordSegment().bx-swordSegment().ax,swordSegment().by-swordSegment().ay)');
 elements.get('center').onclick();pose(0,0,0);
 for(let b=10;b<=60;b+=10)pose(0,b,0);
 assert.ok(run('Math.hypot(swordSegment().bx-swordSegment().ax,swordSegment().by-swordSegment().ay)')<length*.6);
});


test('duel guard, exposed health damage, progression and widescreen fallback',async()=>{
 const {run,elements}=boot(DISTRICT);
 run('start();enemy.dir=0;slash(0,100)');assert.equal(run('enemy.hp'),6);assert.ok(run('enemy.posture>0'));assert.equal(run('district.lunged'),true);
 run('duel.open(enemy);cooldown=0;slash(100,0)');assert.equal(run('enemy.hp'),4);assert.equal(run('enemy.phase'),'recover');
 run('cooldown=0;slash(100,0)');assert.equal(run('enemy.hp'),4);
 run('duel.open(enemy);cooldown=0;charge=100;slash(100,0)');assert.equal(run('enemy.hp'),1);assert.ok(run('charge<100'));
 run('duel.open(enemy);cooldown=0;slash(100,0)');assert.equal(run('state'),'upgrade');assert.equal(run('wave'),2);
 run('wave=3;spawn();resume()');assert.equal(run('duel.fighters.length'),2);
 run('pause();const savedHP=enemy.hp;update(20)');assert.equal(run('enemy.hp===savedHP'),true);
 await elements.get('wideStart').onclick();assert.match(elements.get('wideHelp').textContent,/Rotate/);
});

test('a touch guard is a parry only in the last 0.6 s before impact; held longer, it is a block',()=>{
 for(const [early,phase,posture] of [[.8,'recover',1],[.4,'open',4]]){
  const {run}=boot(DISTRICT);run('start()');
  // One cut, by hand, that lands in 1.2 s.
  run("duel.active=enemy;enemy.phase='windup';enemy.attack='cut';enemy.period=1.2;enemy.timer=1.2");
  step(run,1.2-early);run('setGuard(true)');step(run,early+.02);
  assert.equal(run('enemy.phase'),phase,`guard pressed ${early} s before impact`);assert.equal(run('enemy.posture'),posture);
  assert.equal(run('health'),100);
 }
});
