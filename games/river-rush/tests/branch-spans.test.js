import test from 'node:test';
import {LANES,LANE_COUNT,CENTER_LANE,MAX_LANE,RIVER_WIDTH_EXPANSION,PLAYABLE_HALF_WIDTH} from '../src/game/lanes.js';
import assert from 'node:assert/strict';
import {BRANCH_LANE_RADIUS,isBranchSpan,branchLanes,branchSpan,branchOverlap} from '../src/game/branch-spans.js';
import {createGame,emptyInput,updateGame,snapshot,generateAhead,hazardTouchesLane} from '../src/game/engine.js';
import {LEVELS,FINISH_RUNWAY} from '../src/game/levels.js';
import {coveredLanes,actionWall} from './route-coverage.js';
const spans=[[0],[4],[0,1],[3,4],[0,1,2],[2,3,4]];
const tree=(lanes,extra={})=>({id:501,type:'branch',lane:lanes[0],branchLanes:lanes,d:.4,row:8,...extra});
function crossing(entity,physicalLane,{hz=60,...extra}={}){
 const g=Object.assign(createGame(37,1),{time:1000,entities:[entity],nextRow:1e9,shield:false,lane:physicalLane,visualLane:physicalLane,laneVelocity:0,goal:{kind:'tricks',start:0,target:1e9},...extra});
 updateGame(g,emptyInput(),1/hz);return g;
}
test('coverage is contiguous, bank anchored and compatible with legacy centered trees and single-lane birds',()=>{
 for(const lanes of spans){const e=tree(lanes),span=branchSpan(e);assert.deepEqual(span.lanes,lanes);assert.equal(span.width,lanes.length);assert.equal(span.centerLane,(lanes[0]+lanes.at(-1))/2);assert.ok(isBranchSpan(e));}
 assert.equal(branchSpan(tree([0,1])).side,-1);assert.equal(branchSpan(tree([3,4])).side,1);
 for(const side of [-1,1])assert.equal(branchSpan(tree([CENTER_LANE],{branchSide:side})).side,side);
 assert.equal(branchSpan({id:1,type:'branch',lane:1}).side,-1);assert.equal(branchSpan({id:2,type:'branch',lane:1}).side,1);
 assert.deepEqual(branchLanes(tree([1,0,1])),[0,1]);
 for(const invalid of [[],[0,2],[-1,0],[0,1,3],[.5,1],['0',1],null])assert.deepEqual(branchLanes({type:'branch',lane:1,branchLanes:invalid}),[1]);
 const bird={id:601,type:'branch',enemy:'bird',lane:2,d:10,branchLanes:[0,1,2],motion:{from:0,to:2,startD:0,endD:20}};
 assert.equal(isBranchSpan(bird),false);assert.deepEqual(branchLanes(bird),[2]);assert.ok(hazardTouchesLane(bird,1));assert.ok(!hazardTouchesLane(bird,0));
});
test('covered lanes and their seams hit standing rafts and clear with one duck at 30/60/120 Hz',()=>{
 for(const hz of [30,60,120])for(const lanes of spans){
  const positions=[...lanes,...lanes.slice(1).map((lane,n)=>(lanes[n]+lane)/2)];
  for(const lane of positions){
   const standing=crossing(tree(lanes),lane,{hz});assert.equal(standing.phase,'lost');assert.equal(standing.rowsPassed,1);assert.equal(standing.effects.filter(e=>e.type==='lose').length,1);
   const duck=crossing(tree(lanes),lane,{hz,action:'duck',actionTime:.2});assert.equal(duck.phase,'playing');assert.equal(duck.ducks,1);assert.equal(duck.bonus,100);assert.equal(duck.charge,12);
   const perfect=duck.effects.filter(e=>e.type==='perfect');assert.equal(perfect.length,1);assert.deepEqual(perfect[0].branchLanes,lanes);assert.equal(perfect[0].spanWidth,lanes.length);
   updateGame(duck,emptyInput(),1/hz);assert.equal(duck.ducks,1);assert.equal(duck.bonus,100);
  }
  for(const lane of LANES.filter(l=>!lanes.includes(l))){const dodge=crossing(tree(lanes),lane,{hz});assert.equal(dodge.phase,'playing');assert.equal(dodge.dodges,1);assert.equal(dodge.ducks,0);}
  const jumping=crossing(tree(lanes),lanes[0],{hz,action:'jump',actionTime:.3});assert.equal(jumping.phase,'lost','airborne raft bypasses high wood');
 }
});
test('continuous span boundaries preserve physical raft coverage, shield once and Rush protection without farming',()=>{
 for(const lanes of spans){
  const e=tree(lanes),left=lanes[0]-BRANCH_LANE_RADIUS,right=lanes.at(-1)+BRANCH_LANE_RADIUS;
  assert.ok(branchOverlap(e,left));assert.ok(branchOverlap(e,right));assert.ok(!branchOverlap(e,left-.001));assert.ok(!branchOverlap(e,right+.001));
  for(const hz of [30,60,120])for(const power of ['shield','rush']){
   const g=crossing(tree(lanes),lanes.at(-1),{hz,shield:power==='shield',rush:power==='rush'?4:0});
   assert.equal(g.phase,'playing');assert.equal(g.shieldsUsed,power==='shield'?1:0);assert.equal(g.effects.filter(e=>e.type===(power==='shield'?'hit':'smash')).length,1);assert.equal(g.ducks,0);assert.equal(g.bonus,0);assert.equal(g.charge,0);
   updateGame(g,emptyInput(),1/hz);assert.equal(g.shieldsUsed,power==='shield'?1:0);
  }
 }
});
test('span hints show every covered lane and wide wood never widens coin pickup',()=>{
 for(const hz of [30,60,120]){
  const branch=tree([0,1,2]),coins=[{id:502,type:'coin',lane:1,d:.4},{id:503,type:'coin',lane:2,d:.4}],g=crossing(branch,1,{hz,action:'duck',actionTime:.2,entities:[branch,...coins]});
  assert.equal(g.ducks,1);assert.equal(g.coins,1);assert.equal(g.bonus,110);assert.ok(coins[0].collected);assert.ok(!coins[1].collected);
 }
 const full=Object.assign(createGame(37),{entities:[tree([0,1,2],{d:40})],lane:2,visualLane:2}),hint=snapshot(full).hint;
 assert.deepEqual(hint.spanLanes,[0,1,2]);assert.equal(hint.spanWidth,3);assert.equal(hint.destinationLane,1);assert.equal(hint.safeLane,3);assert.equal(hint.fullRiver,false);
 const partial=Object.assign(createGame(37),{entities:[tree([0,1],{d:40})],lane:1,visualLane:1}),safe=snapshot(partial).hint;
 assert.deepEqual(safe.spanLanes,[0,1]);assert.equal(safe.spanWidth,2);assert.equal(safe.safeLane,2);
});
test('all seeded maps emit all three widths as coherent trees with fair uncovered routes and unchanged jump rewards',()=>{
 let trees=0,full=0,arcs=0;const origins=new Set();
 for(let seed=1;seed<=50;seed++)for(const level of LEVELS){
  const g=createGame(seed,level.index);for(let d=0;d<level.length;d+=120){g.distance=d;g.time=d/level.startSpeed;generateAhead(g);}
  const branches=g.entities.filter(isBranchSpan);assert.deepEqual([...new Set(branches.map(e=>branchLanes(e).length))].sort(),[1,2,3],`${level.id} seed${seed} omits a width`);
  const rows=new Map();for(const e of g.entities.filter(e=>['rock','log','branch'].includes(e.type))){if(!rows.has(e.row))rows.set(e.row,[]);rows.get(e.row).push(e);}
  for(const e of branches){
   trees++;const span=branchSpan(e),row=rows.get(e.row);assert.ok(e.d<level.length-FINISH_RUNWAY);assert.ok(span.lanes.includes(e.lane));origins.add(`${span.width}:${span.side}`);
   if(span.width===1)assert.ok(e.lane===0||e.lane===MAX_LANE,'generated single tree floats in the center');
   if(e.fullRiver){if(e.canopyLead)full++;assert.equal(row.length,2,'full river canopy must pair two native bank trees');assert.deepEqual(row.map(h=>branchLanes(h).length).sort(),[2,3]);assert.ok(actionWall(row));assert.ok(e.branchSide===-1||e.branchSide===1);}
   else assert.ok(LANES.some(l=>!row.some(h=>hazardTouchesLane(h,l))),'partial tree row lost its safe route');
   assert.ok(row.filter(h=>h!==e).every(h=>coveredLanes([h]).every(l=>!span.lanes.includes(l))),'another hazard hides inside its duck span');
  }
  for(const row of rows.values()){
   assert.ok(coveredLanes(row).length<LANE_COUNT||actionWall(row),'mixed wall is impassable');
   const raised=g.entities.filter(e=>e.row===row[0].row&&Number.isFinite(e.jumpHeight));
   if(raised.length){arcs++;assert.equal(raised.length,5);assert.ok(raised.every(c=>row.some(h=>h.type==='log'&&h.lane===c.lane)),'branch swallowed its original raised log reward');}
  }
 }
 assert.equal(origins.size,6);assert.ok(full>500);assert.ok(arcs>2000);console.log(JSON.stringify({seedMaps:150,trees,pairedFullRiverCanopies:full,jumpRewardArcs:arcs,bankWidthVariants:origins.size}));
});
