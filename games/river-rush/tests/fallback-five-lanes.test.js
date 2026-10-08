import test from 'node:test';
import assert from 'node:assert/strict';
import {projection,fallbackRiderWidth} from '../src/game/render.js';
import {fallbackBankHalfWidth} from '../src/game/map-2d.js';
import {LANES,CENTER_LANE,LANE_SPACING,PLAYABLE_HALF_WIDTH,laneToX,xToLane} from '../src/game/lanes.js';
import {createCourseProfile} from '../src/game/river-course.js';
import {FINISH_GATE} from '../src/game/finish-line.js';
import {RIDER_SIZE} from '../src/game/rider.js';
import {LEVELS} from '../src/game/levels.js';

const layouts=[[390,844],[360,640],[1365,900],[1536,1024],[844,390]];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);

test('all five fallback lane centers share course-space pickup and hazard registration on every layout',()=>{
 for(const [width,height] of layouts)for(const z of [0,25,90,240]){
  const center=projection(width,height,CENTER_LANE,z),points=LANES.map(lane=>projection(width,height,lane,z));
  close(center.x,width/2);
  for(const [index,p] of points.entries()){
   close(p.x-center.x,laneToX(index)*p.unit);
   close(p.y,center.y);assert.ok(p.x>0&&p.x<width);
   if(index>0){assert.ok(p.x>points[index-1].x);close(p.x-points[index-1].x,LANE_SPACING*p.unit);}
   close(projection(width,height,xToLane(laneToX(index)),z).x,p.x);
  }
 }
});

test('the complete registered rider frame stays visible at outer lane centers while banking',()=>{
 for(const [width,height] of layouts){
  const rider=fallbackRiderWidth(width,height),half=rider/2,top=rider*(RIDER_SIZE.foot/RIDER_SIZE.width+.14);
  for(const lane of [LANES[0],LANES.at(-1)])for(const roll of [-.16,0,.16]){
   const p=projection(width,height,lane,0);
   const extent=half*Math.cos(roll)+top*Math.abs(Math.sin(roll));
   assert.ok(p.x-extent>=0,`${width}x${height} left rider edge clips`);
   assert.ok(p.x+extent<=width,`${width}x${height} right rider edge clips`);
  }
 }
});

test('organic fallback narrows leave outer raft contact on water and the finish beyond every lane',()=>{
 for(const level of LEVELS)for(const seed of [1,137,249]){
  const profile=createCourseProfile(seed,level.length,level.index);
  for(let course=0;course<=level.length;course+=31){
   const bank=fallbackBankHalfWidth(course,profile);
   assert.ok(bank>PLAYABLE_HALF_WIDTH,'painted bank may not enter a playable raft envelope');
   for(const [width,height] of layouts){
    const center=projection(width,height,CENTER_LANE,0),rider=fallbackRiderWidth(width,height);
    for(const lane of [LANES[0],LANES.at(-1)]){
     const player=projection(width,height,lane,0);
     assert.ok(Math.abs(player.x-center.x)+rider*.5<bank*center.unit,'outer raft may not ride the painted shore');
     assert.ok(Math.abs(player.x-center.x)+rider*.5<FINISH_GATE.halfWidth*center.unit,'finish pier may not block an outer lane');
    }
   }
  }
 }
});
