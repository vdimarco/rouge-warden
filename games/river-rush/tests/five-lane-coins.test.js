import test from 'node:test';
import assert from 'node:assert/strict';
import {LANE_COUNT,LANES,CENTER_LANE,MIN_LANE,MAX_LANE,LANE_SPACING,laneToX,xToLane,clampLane} from '../src/game/lanes.js';
import {createGame,emptyInput,queueAction,updateGame,timeToImpact,hazardTouchesLane,snapshot,HAZARD_LANE_RADIUS} from '../src/game/engine.js';
import {LEVELS} from '../src/game/levels.js';
import {isBranchSpan,branchLanes} from '../src/game/branch-spans.js';
import {groundCoinLayout,GROUND_COIN_PATTERNS} from '../src/game/coin-layouts.js';
const hazard=e=>['rock','log','branch'].includes(e.type);
function normalizedGeometry(coins,spacing=1){
 const origin=Math.min(...coins.map(c=>c.d??c.offset)),lanes=coins.map(c=>c.lane),min=Math.min(...lanes),max=Math.max(...lanes);
 const shape=mirror=>JSON.stringify(coins.map(c=>[mirror?max-c.lane:c.lane-min,Math.round(((c.d??c.offset)-origin)/spacing*1e6)]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]));
 return [shape(false),shape(true)].sort()[0];
}
function naturalCourse(seed,index){const g=createGame(seed,index),items=new Map();while(g.phase==='playing'){for(const e of g.entities)items.set(e.id,{...e});g.entities=[];updateGame(g,emptyInput(),.05);}return[...items.values()];}
test('five physical centers map exactly and controls reach every lane while clamping both edges',()=>{
 assert.equal(LANE_COUNT,5);assert.deepEqual(LANES,[0,1,2,3,4]);assert.equal(CENTER_LANE,2);assert.equal(LANE_SPACING,3.8);
 for(const lane of LANES){assert.equal(xToLane(laneToX(lane)),lane);assert.equal(laneToX(lane),(lane-2)*3.8);}
 assert.equal(clampLane(-10),MIN_LANE);assert.equal(clampLane(10),MAX_LANE);
 const g=Object.assign(createGame(1),{entities:[],nextRow:1e9}),input=emptyInput();assert.equal(g.lane,2);assert.equal(g.visualLane,2);assert.equal(snapshot(g).laneCount,5);
 for(let n=0;n<8;n++){queueAction(input,'left');updateGame(g,input,1/60);}assert.equal(g.lane,0);
 for(let n=0;n<8;n++){queueAction(input,'right');updateGame(g,input,1/60);}assert.equal(g.lane,4);
});
test('paired three-plus-two canopies cover all five lanes once even at the seam',()=>{
 for(const hz of [30,60,120])for(const physicalLane of [...LANES,2.5])for(const response of ['stand','duck','shield','rush']){
  const entities=[{id:501,type:'branch',lane:1,branchLanes:[0,1,2],fullRiver:true,canopyLead:true,row:8,d:.4},{id:502,type:'branch',lane:3,branchLanes:[3,4],fullRiver:true,canopyLead:false,row:8,d:.4}];
  const g=Object.assign(createGame(2),{entities,nextRow:1e9,lane:physicalLane,visualLane:physicalLane,laneVelocity:0,shield:response==='shield',rush:response==='rush'?4:0,action:response==='duck'?'duck':'',actionTime:response==='duck'?.2:0});
  const hint=snapshot({...g,lane:2}).hint;assert.ok(hint.fullRiver);
  updateGame(g,emptyInput(),1/hz);assert.equal(g.phase,response==='stand'?'lost':'playing');
  const contacts=g.effects.filter(e=>['perfect','lose','hit','smash'].includes(e.type));assert.equal(contacts.length,1,`${hz}Hz ${response} lane${physicalLane} duplicates canopy contact`);
  assert.equal(g.ducks,response==='duck'?1:0);assert.equal(g.bonus,response==='duck'?100:0);assert.equal(g.shieldsUsed,response==='shield'?1:0);assert.equal(g.dodges,0);assert.equal(g.rowsPassed,1);
 }
 const solo={id:501,type:'branch',lane:2,branchLanes:[0,1,2],row:8,d:20},g=Object.assign(createGame(2),{entities:[solo]});assert.equal(snapshot(g).hint.fullRiver,false);
});
test('ground families have different actual geometry and primary sweeps retain future-Rush contact spacing',()=>{
 const layouts=GROUND_COIN_PATTERNS.map((_,index)=>groundCoinLayout({seed:0,row:10,lane:2,clearLanes:LANES,index,recovery:true,allowCarve:true}));
 const geometry=new Set(layouts.map(layout=>normalizedGeometry(layout.coins)));assert.equal(geometry.size,GROUND_COIN_PATTERNS.length);
 for(const layout of layouts){assert.ok(layout.coins.every(c=>Number.isInteger(c.lane)&&LANES.includes(c.lane)));assert.ok(layout.coins.some(c=>c.primaryRoute));}
 const sweep=layouts.find(e=>e.pattern==='sweep'),primary=sweep.coins.filter(c=>c.primaryRoute);
 for(let n=1;n<primary.length;n++)if(primary[n].lane!==primary[n-1].lane){assert.equal(Math.abs(primary[n].lane-primary[n-1].lane),1);assert.ok(primary[n].offset-primary[n-1].offset>=.24);}
});
test('every seeded five-lane map contains four geometric ground families and uses every gold lane safely',()=>{
 let coins=0,canopies=0;
 for(let seed=1;seed<=50;seed++)for(const level of LEVELS){
  const all=naturalCourse(seed,level.index),gold=all.filter(e=>e.type==='coin'),rows=new Map();coins+=gold.length;
  assert.deepEqual([...new Set(gold.map(e=>e.lane))].sort(),LANES,`${level.id} seed${seed} omits a gold lane`);
  for(const e of all)if(Number.isInteger(e.row)){if(!rows.has(e.row))rows.set(e.row,[]);rows.get(e.row).push(e);}
  const families=new Map();let previousPrimary;
  for(const row of rows.values()){
   const hazards=row.filter(hazard),ground=row.filter(e=>e.type==='coin'&&!Number.isFinite(e.jumpHeight)),primary=row.filter(e=>e.type==='coin'&&e.primaryRoute);
   for(const c of row.filter(e=>e.type==='coin')){
    assert.ok(!hazards.some(h=>h.type==='rock'&&hazardTouchesLane(h,c.lane)),'gold trail passes through a rock');
    if(!Number.isFinite(c.jumpHeight))assert.ok(!hazards.some(h=>h.type==='log'&&hazardTouchesLane(h,c.lane)),'ground gold conflicts with a log or leaping enemy');
   }
   if(primary.length){if(previousPrimary)assert.ok(Math.abs(primary[0].lane-previousPrimary.lane)<=1,'primary path jumps multiple lanes between stations');previousPrimary=primary.at(-1);}
   if(ground.length&&ground[0].coinPattern!=='ribbon'){
    const signature=normalizedGeometry(ground,level.maxSpeed*1.32);
    if(!families.has(ground[0].coinPattern))families.set(ground[0].coinPattern,signature);
   }
   const canopy=hazards.filter(e=>e.fullRiver);
   if(canopy.length){canopies++;assert.equal(canopy.length,2);assert.deepEqual(canopy.map(e=>branchLanes(e).length).sort(),[2,3]);assert.equal(canopy.filter(e=>e.canopyLead).length,1);assert.deepEqual([...new Set(canopy.flatMap(branchLanes))].sort(),LANES);}
   for(const e of hazards.filter(isBranchSpan)){const lanes=branchLanes(e);assert.ok(lanes.length<=3);assert.ok(lanes[0]===MIN_LANE||lanes.at(-1)===MAX_LANE);}
  }
  assert.ok(families.size>=4,`${level.id} seed${seed} has only${families.size} actual ground shapes`);assert.ok(new Set(families.values()).size>=4,'distinct labels share one geometry');
 }
 console.log(JSON.stringify({seedMaps:150,groundFamilyMinimum:4,coinLanes:LANES,coins,pairedCanopies:canopies}));
});
test('real primary routes including sweeps collect at early/late jumps and future earned Rush at 30/60/120 Hz',()=>{
 let stages=0,collected=0,sweeps=0,maxVisibleCoins=0,maxEntities=0;
 for(const hz of [30,60,120])for(const lead of [.22,.42])for(const useRush of [false,true])for(const seed of [1,12,137])for(const level of LEVELS){
  const g=createGame(seed,level.index),input=emptyInput(),handled=new Set();g.shield=false;
  while(g.phase==='playing'){
   const primary=g.entities.filter(e=>!e.done&&e.type==='coin'&&e.primaryRoute),next=primary[0];
   if(next&&timeToImpact(g,next.d)<.24&&g.lane!==next.lane)for(let n=0;n<Math.abs(next.lane-g.lane);n++)queueAction(input,next.lane>g.lane?'right':'left');
   const obstacles=g.entities.filter(e=>!e.done&&hazard(e)),first=obstacles[0];
   if(first&&!handled.has(first.row)&&timeToImpact(g,first.d)<=lead){const row=obstacles.filter(e=>e.row===first.row),at=next?.lane??g.lane,contact=row.find(e=>hazardTouchesLane(e,at));if(contact&&contact.type!=='rock')queueAction(input,contact.type==='log'?'jump':'duck');handled.add(first.row);}
   if(useRush&&g.charge>=100&&!g.rush)queueAction(input,'rush');
   const pending=g.entities.filter(e=>!e.done&&e.type==='coin'&&e.primaryRoute);
   updateGame(g,input,1/hz);assert.notEqual(g.phase,'lost',`${hz}Hz ${level.id} seed${seed} lead${lead} Rush${useRush}: ${g.reason}`);
   for(const coin of pending)if(coin.done){assert.ok(coin.collected,`${hz}Hz ${level.id} seed${seed} lead${lead} Rush${useRush} misses${coin.coinPattern} lane${coin.lane} row${coin.row}`);collected++;if(coin.coinPattern==='sweep')sweeps++;}
   maxEntities=Math.max(maxEntities,g.entities.length);maxVisibleCoins=Math.max(maxVisibleCoins,g.entities.filter(e=>!e.collected&&e.type==='coin'&&e.d>=g.distance&&e.d-g.distance<=180).length);
  }
  assert.equal(g.phase,'won');assert.equal(g.shieldsUsed,0);stages++;
 }
 assert.ok(sweeps>100);assert.ok(maxVisibleCoins<=64);assert.ok(maxEntities<120);
 console.log(JSON.stringify({stages,primaryCoinsCollected:collected,sweepCoinsCollected:sweeps,maxVisibleCoins,maxEntities,refreshRates:[30,60,120],jumpLeads:[.22,.42]}));
});
