import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainSection,TERRAIN_SECTIONS} from '../src/game/course-sections.js';
import {createCourseProfile,riverHalfWidth,rapidAt,rapidDerivative,shoalAt} from '../src/game/river-course.js';
import {createGame,generateAhead,updateGame,emptyInput,snapshot} from '../src/game/engine.js';
import {LEVELS,FINISH_RUNWAY} from '../src/game/levels.js';

test('each seeded finite river has all three terrain encounters, calm transitions and a clean opening/finish',()=>{
 for(let seed=0;seed<30;seed++)for(const level of LEVELS){
  const profile=createCourseProfile(seed,level.length,level.index),seen=new Set(),phases=new Set();
  for(let d=0;d<level.length;d+=7.7){
   const section=terrainSection(d,profile);phases.add(section.phase);
   assert.deepEqual(section,terrainSection(d,profile));
   assert.ok(section.strength>=0&&section.strength<=1);
   if(section.phase==='active')seen.add(section.type);
   if(d<250||d>=level.length-FINISH_RUNWAY){assert.equal(section.phase,'recovery');assert.equal(section.strength,0);}
  }
  assert.deepEqual([...seen].sort(),TERRAIN_SECTIONS.map(s=>s.type).sort());
  assert.deepEqual([...phases].sort(),['active','approach','recovery']);
  assert.equal(terrainSection(1000000,profile).strength,0);
 }
});

test('section envelopes and rough water remain continuous with analytic derivatives at every transition',()=>{
 const e=1e-4;
 for(const level of LEVELS)for(const seed of [0,73,137,249]){
  const profile=createCourseProfile(seed,level.length,level.index),boundaries=new Set([250,level.length-220,level.length-150]);
  for(let d=0;d<level.length;d+=11.79){
   const section=terrainSection(d,profile);boundaries.add(section.start);boundaries.add(section.end);
   const derivative=(terrainSection(d+e,profile).strength-terrainSection(d-e,profile).strength)/(2*e);
   assert.ok(Math.abs(derivative-section.derivative)<1e-7);
   assert.ok(Math.abs((rapidAt(d+e,profile)-rapidAt(d-e,profile))/(2*e)-rapidDerivative(d,profile))<1e-6);
  }
  for(const d of boundaries)for(const sample of [riverHalfWidth,rapidAt,rapidDerivative])assert.ok(Math.abs(sample(d-e,profile)-sample(d+e,profile))<2e-4,`${sample.name}:${d}`);
 }
});

test('terrain changes playable river shape and water while shoals remain outside the lane corridor',()=>{
 const samples=Object.fromEntries(TERRAIN_SECTIONS.map(s=>[s.type,{width:0,rapid:0,count:0}]));
 for(let seed=1;seed<=25;seed++)for(const level of LEVELS){
  const profile=createCourseProfile(seed,level.length,level.index);
  for(let d=300;d<level.length-FINISH_RUNWAY;d+=13.1){
   const section=terrainSection(d,profile),width=riverHalfWidth(d,profile),rapid=rapidAt(d,profile);
   assert.ok(width>=11.8&&width<=26.5);assert.ok(rapid>=0&&rapid<=1);
   if(section.strength>.999){const s=samples[section.type];s.width+=width;s.rapid+=rapid;s.count++;}
  }
  for(let n=0;n<Math.ceil(level.length/34);n++){const rock=shoalAt(n,profile);assert.ok(Math.abs(rock.x)-rock.size*2*1.18>5.5);}
 }
 const average=(type,key)=>samples[type][key]/samples[type].count;
 assert.ok(average('low-canopy','width')-average('narrows','width')>3,'narrows do not visibly tighten');
 assert.ok(average('wave-train','rapid')-average('low-canopy','rapid')>.2,'jump water does not differ from quiet canopy water');
});

test('terrain biases mixed readable routes with jump arcs, low canopy gold and safe adjacent choices',()=>{
 const density=Object.fromEntries(TERRAIN_SECTIONS.map(s=>[s.type,{rock:0,log:0,branch:0,total:0}]));
 for(let seed=1;seed<=25;seed++)for(const level of LEVELS){
  const g=createGame(seed,level.index),seen=new Set(),rows=new Map();
  for(let d=0;d<level.length;d+=120){g.distance=d;g.time=d/level.startSpeed;generateAhead(g);}
  for(const item of g.entities.filter(e=>['rock','log','branch'].includes(e.type))){
   if(!rows.has(item.row))rows.set(item.row,[]);rows.get(item.row).push(item);
   if(item.terrainActive){
    seen.add(item.sectionType);
    density[item.sectionType][item.type]++;density[item.sectionType].total++;
    assert.equal(terrainSection(item.d,g.terrainProfile).id,item.sectionId);
    assert.ok(item.d<level.length-FINISH_RUNWAY);
   }
  }
  assert.equal(seen.size,3);
  for(const row of rows.values()){
   assert.ok(row.length<=2||row.every(e=>e.type==='log')||row.every(e=>e.type==='branch'));
   if(row.length===3)assert.ok(row[0].row>=3,'tutorial row became a mandatory wall');
   const coins=g.entities.filter(e=>e.type==='coin'&&e.row===row[0].row);
   for(const coin of coins.filter(e=>Number.isFinite(e.jumpHeight)))assert.ok(row.some(e=>e.type==='log'&&e.lane===coin.lane),'raised route points at a different lane than its log');
   if(row[0].terrainActive&&row[0].sectionType==='wave-train'&&row.every(e=>e.type==='log'))assert.equal(coins.filter(e=>e.high).length,5);
  }
 }
 for(const type of ['narrows','wave-train','low-canopy'])assert.ok(['rock','log','branch'].every(h=>density[type][h]>0),'terrain section repeats one hazard type');
 const share=(section,type)=>density[section][type]/density[section].total;
 assert.ok(share('narrows','rock')>share('wave-train','rock')+.10);
 assert.ok(share('wave-train','log')>share('low-canopy','log')+.10);
 assert.ok(share('low-canopy','branch')>share('wave-train','branch')+.05);
});

test('natural no-Rush generation provides at least three eligible jumps for every advertised chain',()=>{
 let advertised=0,truncated=0,minEligible=Infinity;
 for(const seed of [...Array.from({length:50},(_,n)=>n+1),55])for(const level of LEVELS){
  const g=createGame(seed,level.index),rows=new Map(),promises=new Map(),shortened=new Set();
  for(let d=260;d<level.length-FINISH_RUNWAY;d+=10){
   const section=terrainSection(d,g.terrainProfile);
   if(section.type==='wave-train'&&section.phase!=='recovery'){
    if(section.comboAvailable)promises.set(section.id,section);
    else{shortened.add(section.id);assert.doesNotMatch(section.cue,/Chain 3/);}
   }
  }
  // Remove hazards after recording them so the simulation can reveal the
  // whole route with its normal acceleration and time-to-impact forecasting.
  // Distance and clocks are never teleported to a fabricated generation time.
  while(g.phase==='playing'){
   for(const item of g.entities)if(item.type==='log'&&item.terrainActive&&item.terrainComboAvailable){
    if(!rows.has(item.sectionId))rows.set(item.sectionId,new Set());rows.get(item.sectionId).add(item.row);
   }
   g.entities=[];updateGame(g,emptyInput(),.05);
  }
  assert.equal(g.phase,'won');truncated+=shortened.size;
  for(const [id,section] of promises){
   const count=rows.get(id)?.size??0;advertised++;minEligible=Math.min(minEligible,count);
   assert.ok(count>=3,`${level.id} seed${seed} section${id} has ${count} eligible rows (${section.start}–${section.end})`);
  }
 }
 assert.ok(advertised>200);assert.ok(truncated>0);
 console.log(JSON.stringify({naturalSeedMaps:153,advertisedWaveEncounters:advertised,minEligibleJumps:minEligible,truncatedEncountersWithoutChainCue:truncated}));
});

function waveFixture(){
 const g=createGame(73,1);
 let d=300;while(terrainSection(d,g.terrainProfile).type!=='wave-train'||terrainSection(d,g.terrainProfile).phase!=='active')d+=5;
 return Object.assign(g,{distance:d,time:1000,entities:[],nextRow:1e9,shield:false,goal:{kind:'tricks',start:0,target:1e9}});
}
function clearWave(g,id,extra={}){
 const section=terrainSection(g.distance,g.terrainProfile);
 g.entities=[0,1,2].map(lane=>({id:id*3+lane,type:'log',lane,d:g.distance+1,row:id,terrainActive:true,terrainComboAvailable:section.comboAvailable,sectionType:'wave-train',sectionId:section.id}));
 Object.assign(g,{action:'jump',actionTime:.2},extra);updateGame(g,emptyInput(),.05);
}
test('three actual wave jumps pay one chain reward, a new section resets it and powered contacts cannot farm it',()=>{
 const g=waveFixture();for(let row=0;row<3;row++)clearWave(g,row);
 assert.equal(g.jumps,3);assert.equal(g.bonus,650);assert.equal(snapshot(g).terrain.comboProgress,3);assert.equal(snapshot(g).terrain.comboClaimed,true);
 assert.equal(g.effects.filter(e=>e.type==='terrain-combo').length,1);
 clearWave(g,4);assert.equal(g.bonus,750);assert.equal(g.effects.filter(e=>e.type==='terrain-combo').length,1);
 g.distance=terrainSection(g.distance,g.terrainProfile).end+10;updateGame(g,emptyInput(),.016);assert.equal(snapshot(g).terrain.comboProgress,0);assert.equal(snapshot(g).terrain.comboClaimed,false);
 for(const power of ['rush','grace']){
  const powered=waveFixture();clearWave(powered,5,{[power]:1});
  assert.equal(powered.jumps,0);assert.equal(powered.charge,0);assert.equal(powered.bonus,0);assert.equal(snapshot(powered).terrain.comboProgress,0);
 }
});

test('bypassing a jump row breaks the chain and new coin effects report each true streak contact',()=>{
 const g=waveFixture();clearWave(g,1);assert.equal(g.terrainCombo.count,1);
 const section=terrainSection(g.distance,g.terrainProfile);
 g.entities=[{id:20,type:'log',lane:0,d:g.distance+1,row:20,terrainActive:true,sectionType:'wave-train',sectionId:section.id}];
 Object.assign(g,{action:'',actionTime:0});updateGame(g,emptyInput(),.05);assert.equal(g.terrainCombo.count,0);
 g.entities=[{id:21,type:'coin',lane:1,d:g.distance+.5},{id:22,type:'coin',lane:1,d:g.distance+1},{id:23,type:'coin',lane:2,d:g.distance+1.5}];
 updateGame(g,emptyInput(),.05);
 const coins=g.effects.filter(e=>e.type==='coin');assert.equal(coins.length,2);assert.deepEqual(coins.map(e=>[e.streak,e.multiplier]),[[1,1],[2,1]]);assert.equal(g.coins,2);
});
