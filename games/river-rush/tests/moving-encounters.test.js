import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,queueAction,updateGame,timeToImpact,snapshot,speedAt} from '../src/game/engine.js';
import {LEVELS,FINISH_RUNWAY} from '../src/game/levels.js';
import {entityLane,encounterMotion,TARGET_VALUE,TARGET_CHARGE} from '../src/game/moving-encounters.js';
import {worldEntityVisible,laneSpring} from '../src/game/world.js';
const hazard=e=>['rock','log','branch'].includes(e.type);
function fixture(entity,extra={}){
 const g=createGame(37);
 Object.assign(g,{entities:[entity],nextRow:1e9,shield:false,...extra});
 return g;
}

test('course-space motion is smooth, endpoint-locked, finite and paused with the simulation',()=>{
 for(const level of LEVELS)for(const lane of [0,1,2])for(const kind of ['crocodile','bird','target']){
  const speed=level.maxSpeed*1.32,motion=encounterMotion(lane,1000,speed,kind,17),e={lane,motion};
  assert.equal(entityLane(e,motion.startD-100),motion.from);
  assert.equal(entityLane(e,motion.endD+100),lane);
  assert.ok(Math.abs(entityLane(e,(motion.startD+motion.endD)/2)-(motion.from+lane)/2)<1e-12);
  assert.ok((1000-motion.endD)/speed>=(kind==='target'?.399:.999));
  const before=entityLane(e,motion.endD-.001),after=entityLane(e,motion.endD+.001);
  assert.ok(Math.abs(before-after)<1e-7,'lane snaps at the endpoint');
  const g=fixture({id:1,type:'target',d:1000,...e},{distance:motion.startD+10,phase:'paused'}),distance=g.distance,position=entityLane(e,g.distance);
  updateGame(g,emptyInput(),.05);assert.equal(g.distance,distance);assert.equal(entityLane(e,g.distance),position);
 }
 assert.equal(entityLane({lane:2},50),2);
 assert.equal(entityLane({lane:1,motion:{startD:0,endD:0}},50),1);
});

test('moving relic contact samples its physical lane at crossing, once, at 30/60/120 Hz',()=>{
 for(const hz of [30,60,120]){
  const d=52/(hz*2),entity={id:501,type:'target',lane:2,d,motion:{from:0,to:2,startD:d-10,endD:d+10}};
  const g=fixture(entity),input=emptyInput();
  updateGame(g,input,1/hz);
  assert.ok(entity.collected);assert.equal(g.bonus,TARGET_VALUE);assert.equal(g.charge,TARGET_CHARGE);assert.equal(g.coins,0);
  const effect=g.effects.find(e=>e.type==='target');
  assert.equal(effect.lane,entityLane(entity,d));assert.equal(effect.playerLane,1);assert.equal(effect.distance,d);assert.equal(effect.entityId,501);
  assert.ok(effect.contactTime>0&&effect.contactTime<1/hz);assert.equal(effect.value,TARGET_VALUE);
  assert.equal(worldEntityVisible(entity,g.distance,180),false);
  updateGame(g,input,1/hz);assert.equal(g.effects.filter(e=>e.type==='target').length,1);assert.equal(g.bonus,TARGET_VALUE);assert.equal(g.charge,TARGET_CHARGE);
 }
});

test('relic misses beside or above the raft pass silently and boosts never widen contact',()=>{
 for(const hz of [30,60,120])for(const miss of ['side','airborne'])for(const boost of ['none','gold','rush']){
  const e={id:501,type:'target',lane:miss==='side'?1.251:1,d:.1};
  const g=fixture(e,{action:miss==='airborne'?'jump':'',actionTime:miss==='airborne'?.30:0,magnet:boost==='gold'?8:0,rush:boost==='rush'?4:0});
  updateGame(g,emptyInput(),1/hz);
  assert.ok(e.done);assert.ok(!e.collected);assert.equal(g.bonus,0);assert.equal(g.charge,0);assert.equal(g.effects.filter(e=>e.type==='target').length,0);
 }
 for(const rush of [4,.001]){
  const g=fixture({id:502,type:'target',lane:1,d:.15},{rush,charge:0});
  updateGame(g,emptyInput(),1/30);assert.equal(g.bonus,TARGET_VALUE);assert.equal(g.charge,rush===4?0:TARGET_CHARGE);
 }
 const capped=fixture({id:503,type:'target',lane:1,d:.1},{charge:96});updateGame(capped,emptyInput(),1/60);assert.equal(capped.charge,100);assert.equal(capped.effects.find(e=>e.type==='target').charge,4);
});

test('both enemy actions, dodge and fatal contact use the same moving lane and useful hints',()=>{
 for(const hz of [30,60,120])for(const enemy of ['crocodile','bird'])for(const response of ['action','dodge','hit']){
  const type=enemy==='crocodile'?'log':'branch',d=52/(hz*2),e={id:501,type,enemy,lane:2,d,motion:{from:0,to:2,startD:d-10,endD:d+10}};
  const g=fixture(e,response==='dodge'?{lane:0,visualLane:0}:response==='action'?{action:type==='log'?'jump':'duck',actionTime:.3}:{});
  updateGame(g,emptyInput(),1/hz);
  assert.equal(g.phase,response==='hit'?'lost':'playing');
  if(response==='action'){
   assert.equal(type==='log'?g.jumps:g.ducks,1);
   const contact=g.effects.find(e=>e.type==='perfect');assert.equal(contact.enemy,enemy);assert.equal(contact.obstacleLane,1);
  }else if(response==='hit'){
   assert.match(g.reason,enemy==='crocodile'?/Crocodile hit/:/Bird hit/);
   const contact=g.effects.find(e=>e.type==='lose');assert.equal(contact.enemy,enemy);assert.equal(contact.obstacleLane,1);assert.equal(g.distance,d);
  }else assert.equal(g.dodges,1);
 }
 const g=fixture({id:502,type:'log',enemy:'crocodile',lane:1,d:78,motion:{from:0,to:1,startD:-70,endD:20}});
 const hint=snapshot(g).hint;assert.equal(hint.enemy,'crocodile');assert.equal(hint.destinationLane,1);assert.equal(hint.lane,entityLane(g.entities[0],g.distance));assert.ok(hint.in>1.1);
});

test('Rush expiration integrates only its active portion and samples every exact crossing on either side',()=>{
 const dt=.05,expiry=.02,base=speedAt(dt),at=seconds=>base*(Math.min(expiry,seconds)*1.32+Math.max(0,seconds-expiry));
 const items=[
  {id:501,type:'coin',lane:1,d:at(.01)},
  {id:502,type:'target',lane:1,d:at(.01)},
  {id:503,type:'log',enemy:'crocodile',lane:1,d:at(.015)},
  {id:504,type:'target',lane:1,d:at(.025)},
  {id:505,type:'branch',enemy:'bird',lane:1,d:at(.03)},
  {id:506,type:'coin',lane:1,d:at(.04)}
 ];
 const g=fixture(items[0],{entities:items,rush:expiry,action:'duck',actionTime:.1});
 updateGame(g,emptyInput(),dt);
 assert.equal(g.distance,at(dt));assert.equal(g.speed,base);assert.equal(g.rush,0);assert.equal(g.phase,'playing');
 assert.equal(g.coins,2);assert.equal(g.ducks,1);assert.equal(g.bonus,520);assert.equal(g.charge,24);
 const contacts=new Map(g.effects.filter(e=>e.entityId).map(e=>[e.entityId,e]));
 for(const [id,time] of [[501,.01],[502,.01],[503,.015],[504,.025],[505,.03],[506,.04]])assert.ok(Math.abs(contacts.get(id).contactTime-time)<1e-12);
 assert.equal(contacts.get(502).charge,0);assert.equal(contacts.get(504).charge,10);
 assert.equal(contacts.get(503).type,'smash');assert.equal(contacts.get(505).type,'perfect');
 assert.equal(g.effects.filter(e=>e.type==='target').length,2);
});

test('fractional Rush expiry freezes fatal physical contact correctly and exact 30 Hz expiration has no phantom boost frame',()=>{
 const dt=.05,expiry=.02,base=speedAt(dt),at=seconds=>base*(Math.min(expiry,seconds)*1.32+Math.max(0,seconds-expiry));
 const items=[{id:501,type:'coin',lane:1,d:at(.01)},{id:502,type:'rock',lane:1,d:at(.03)},{id:503,type:'target',lane:1,d:at(.04)}];
 const g=fixture(items[0],{entities:items,rush:expiry,lane:2});
 updateGame(g,emptyInput(),dt);
 assert.equal(g.phase,'lost');assert.ok(Math.abs(g.time-.03)<1e-12);assert.equal(g.distance,at(.03));assert.equal(g.coins,1);assert.equal(g.rush,0);
 assert.ok(Math.abs(g.visualLane-laneSpring(1,0,2,.03).position)<1e-12);assert.ok(!items[2].done);assert.equal(g.effects.filter(e=>e.type==='target').length,0);
 const live=fixture({id:599,type:'target',lane:2,d:10000},{rush:4,entities:[]});
 for(let n=0;n<120;n++)updateGame(live,emptyInput(),1/30);
 assert.equal(live.rush,0);
 const before=live.distance;updateGame(live,emptyInput(),1/30);
 assert.ok(Math.abs(live.distance-before-speedAt(live.time)/30)<1e-12,'Rush gets an extra full frame after its four seconds');
});

function naturalCourse(seed,index){
 const g=createGame(seed,index),items=new Map();
 while(g.phase==='playing'){
  for(const e of g.entities)items.set(e.id,{...e});
  g.entities=[];updateGame(g,emptyInput(),.05);
 }
 return [...items.values()];
}
test('all seeded maps offer both sparse species and reachable clear-water relics without replacing action walls or chains',()=>{
 let enemies=0,targets=0,latestFirst=0;
 for(let seed=1;seed<=100;seed++)for(const level of LEVELS){
  const entities=naturalCourse(seed,level.index),special=entities.filter(e=>e.enemy||e.type==='target'),foes=special.filter(e=>e.enemy),relics=special.filter(e=>e.type==='target');
  const arcs=entities.filter(e=>e.type==='coin'&&e.jumpOffset===0),promised=new Map();
  for(let n=1;n<arcs.length;n++)assert.ok(arcs[n].d-arcs[n-1].d>=level.maxSpeed*1.32*.90-1e-7,'future Rush compresses two rewarded jumps into one active animation');
  for(const e of entities)if(e.sectionType==='wave-train'&&e.terrainComboAvailable){
    if(!promised.has(e.sectionId))promised.set(e.sectionId,new Set());
    if(e.type==='log'&&e.terrainActive)promised.get(e.sectionId).add(e.row);
  }
  for(const [section,rows] of promised)assert.ok(rows.size>=3,`${level.id} seed${seed} section${section} advertises a chain with ${rows.size} jumps`);
  assert.equal(new Set(foes.map(e=>e.enemy)).size,2,`seed${seed} ${level.id} misses a species`);assert.ok(relics.length>0,`seed${seed} ${level.id} misses relics`);
  latestFirst=Math.max(latestFirst,foes[0].row);
  assert.ok(foes[0].d<level.length/3,'enemy variety arrives after the first third of the map');
  assert.notEqual(foes[0].enemy,foes[1].enemy,'the first two encounters must show different species');
  for(let i=0;i<special.length;i++){
   const e=special[i],row=entities.filter(h=>hazard(h)&&h.row===e.row);
   assert.equal(row.length,1);assert.ok(e.row>=7);assert.ok(e.d<level.length-FINISH_RUNWAY);
   if(i)assert.ok(e.row-special[i-1].row>=3,'special encounters overlap their cooldown');
   assert.equal(entityLane(e,e.d),e.lane);assert.ok(e.motion.from!==e.motion.to);
   if(e.enemy){
    enemies++;assert.equal(e.type,e.enemy==='crocodile'?'log':'branch');
    assert.ok((e.d-e.motion.endD)/(level.maxSpeed*1.32)>=.8);
    assert.ok(!(e.terrainActive&&e.sectionType==='wave-train'&&e.terrainComboAvailable),'an enemy replaces an advertised chain row');
   }else{
    targets++;assert.ok(e.recovery);assert.ok(row.every(h=>h.lane!==e.lane));assert.ok(row.every(h=>!h.enemy));
    assert.ok(entities.filter(c=>c.row===e.row&&c.type==='coin').every(c=>!Number.isFinite(c.jumpHeight)),'ground relic conflicts with its row jump gold');
    const before=entities.filter(h=>hazard(h)&&h.d<e.d).at(-1),after=entities.find(h=>hazard(h)&&h.d>e.d);
    assert.ok(!before||(e.d-before.d)/(level.maxSpeed*1.32)>.45,'the preceding reasonable late jump cannot land');
    assert.ok(!after||(after.d-e.d)/(level.maxSpeed*1.32)>.45,'the next reasonable early jump begins before ground contact');
   }
  }
 }
 console.log(JSON.stringify({naturalSeedMaps:300,enemies,targets,latestFirstEnemyRow:latestFirst}));
});

test('relic-chasing full maps remain reachable at early/late action leads and 30/60/120 Hz with naturally earned Rush',()=>{
 let picked=0,avoided=0,stages=0,maxEntities=0,rushes=0,arcCoins=0;
 for(const hz of [30,60,120])for(const lead of [.22,.42])for(const useRush of [false,true])for(const seed of [2,8,12,137,311])for(const level of LEVELS){
  const g=createGame(seed,level.index),input=emptyInput(),handled=new Set();g.shield=false;
  let holdUntil=0;
  while(g.phase==='playing'){
   const obstacles=g.entities.filter(e=>!e.done&&hazard(e)),first=obstacles[0];
   if(first){
    const row=obstacles.filter(e=>e.row===first.row),target=g.entities.find(e=>!e.done&&e.type==='target'&&e.row===first.row),coins=g.entities.filter(e=>e.type==='coin'&&e.row===first.row);
    const lane=target?.lane??coins[0]?.lane??[0,1,2].find(l=>!row.some(e=>e.lane===l));
    const contact=row.find(e=>e.lane===lane);
    if(g.distance>=holdUntil&&timeToImpact(g,first.d)<.85&&lane!==undefined&&g.lane!==lane)for(let n=0;n<Math.abs(lane-g.lane);n++)queueAction(input,lane>g.lane?'right':'left');
    if(contact&&contact.type!=='rock'&&!handled.has(first.row)&&timeToImpact(g,first.d)<=lead){queueAction(input,contact.type==='log'?'jump':'duck');handled.add(first.row);holdUntil=Math.max(first.d,...coins.map(e=>e.d));}
   }
   if(useRush&&g.charge>=100&&!g.rush){queueAction(input,'rush');rushes++;}
   const pending=g.entities.filter(e=>!e.done&&(e.type==='target'||e.enemy||Number.isFinite(e.jumpHeight)));
   updateGame(g,input,1/hz);maxEntities=Math.max(maxEntities,g.entities.length);
   assert.notEqual(g.phase,'lost',`${hz}Hz ${level.id} seed${seed} lead${lead} Rush${useRush}: ${g.reason}`);
   for(const e of pending)if(e.done){if(e.type==='target'){assert.ok(e.collected,`${hz}Hz ${level.id} seed${seed} lead${lead} misses relic row${e.row}`);picked++;}else if(e.enemy)avoided++;else{assert.ok(e.collected,`${hz}Hz ${level.id} seed${seed} lead${lead} Rush${useRush} misses jump gold row${e.row} offset${e.jumpOffset}`);arcCoins++;}}
  }
  assert.equal(g.phase,'won');assert.equal(g.shieldsUsed,0);assert.equal(g.distance,level.length);stages++;
 }
 assert.ok(picked>300);assert.ok(avoided>500);assert.ok(maxEntities<120);assert.ok(rushes>100);
 console.log(JSON.stringify({relicChasingStages:stages,relicsCollected:picked,jumpArcCoinsCollected:arcCoins,enemiesClearedOrDodged:avoided,rushes,maxLiveEntities:maxEntities,refreshRates:[30,60,120],actionLeads:[.22,.42]}));
});
