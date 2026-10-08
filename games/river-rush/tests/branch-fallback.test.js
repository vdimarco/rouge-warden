import test from 'node:test';
import assert from 'node:assert/strict';
import {branchProjection,projection,encounterProjection} from '../src/game/render.js';
import {branchOverlap,branchSpan} from '../src/game/branch-spans.js';
import {HAZARD_LANE_RADIUS} from '../src/game/engine.js';
import {encounterMotion} from '../src/game/moving-encounters.js';

const layouts=[[390,844],[360,640],[1440,900],[844,390]];
const spans=[[0],[2],[0,1],[1,2],[0,1,2]];
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} differs from ${expected}`);
const branch=(lanes,side=-1)=>({id:13,type:'branch',lane:lanes[0],d:300,branchLanes:lanes,branchSide:side});

test('one-, two- and full-width fallback branch cues match exact continuous physical coverage',()=>{
 for(const [width,height] of layouts)for(const lanes of spans)for(const distance of [240,285,300]){
  const e=branch(lanes),g={distance},p=branchProjection(e,g,width,height),span=branchSpan(e);
  assert.equal(p.width,lanes.length);assert.equal(p.marks.length,lanes.length);
  close(p.low,lanes[0]-HAZARD_LANE_RADIUS);close(p.high,lanes.at(-1)+HAZARD_LANE_RADIUS);
  close(p.center.x,projection(width,height,span.centerLane,e.d-distance).x);
  assert.ok(p.start.x<p.end.x);assert.ok(p.corners.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));
  assert.match(p.label,/DUCK/);assert.match(p.label,lanes.length===3?/FULL RIVER/:new RegExp(`${lanes.length} LANES?`));
  for(let lane=-1;lane<=3;lane+=.05){
   const at=projection(width,height,lane,e.d-distance),inside=at.x>=p.start.x-1e-9&&at.x<=p.end.x+1e-9;
   const physical=branchOverlap(e,lane);
   // The thin water-plane band's horizontal footprint must mean the same
   // thing as standing contact, including the gap between two lane centers.
   if(Math.abs(lane-p.low)>1e-8&&Math.abs(lane-p.high)>1e-8)assert.equal(inside,physical,`${lanes} disagrees at physical lane ${lane}`);
  }
  for(const mark of p.marks)assert.ok(mark.x>p.start.x&&mark.x<p.end.x);
 }
});

test('wider branch cues grow from either bank without moving the representative reward lane',()=>{
 for(const [width,height] of layouts)for(const side of [-1,1]){
  const widths=[];
  for(let count=1;count<=3;count++){
   const lanes=side<0?[0,1,2].slice(0,count):[0,1,2].slice(3-count),e=branch(lanes,side),before=JSON.stringify(e),p=branchProjection(e,{distance:285},width,height);
   widths.push(p.end.x-p.start.x);assert.equal(JSON.stringify(e),before);
   if(count<3)for(const clear of [0,1,2].filter(lane=>!lanes.includes(lane))){const at=projection(width,height,clear,15);assert.ok(at.x<p.start.x||at.x>p.end.x,'uncovered lane center must stay visibly clear');}
   if(count===2)assert.notEqual(p.center.x,projection(width,height,e.lane,15).x,'one whole-span label belongs between covered lanes');
  }
  assert.ok(widths[0]<widths[1]&&widths[1]<widths[2]);
  close(widths[2]-widths[1],widths[1]-widths[0]);
 }
});

test('branch projection stays deterministic while paused and does not change wildlife pose',()=>{
 for(const lanes of spans){
  const e=branch(lanes),normal=branchProjection(e,{distance:270,time:1},390,844),stopped=branchProjection(e,{distance:270,time:60,phase:'paused',reducedMotion:true},390,844);
  assert.deepEqual(stopped,normal);assert.notDeepEqual(branchProjection(e,{distance:275},390,844),normal);
 }
 const e={id:14,type:'branch',enemy:'bird',lane:1,d:300,motion:encounterMotion(1,300,100,'bird',0),branchLanes:[0,1,2]};
 const p=encounterProjection(e,{distance:240},390,844);
 assert.equal(p.action,'duck');assert.ok(p.lift>0);assert.equal(p.contactLane,1);
});
