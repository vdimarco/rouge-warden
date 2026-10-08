import test from 'node:test';
import assert from 'node:assert/strict';
import {FINISH_GATE,finishLayout} from '../src/game/finish-line.js';
import {LANES,laneToX,PLAYABLE_HALF_WIDTH} from '../src/game/lanes.js';
import {LEVELS} from '../src/game/levels.js';
import {createCourseProfile,riverPoint,riverBankHeight} from '../src/game/river-course.js';

test('the widened finish gate leaves all five raft envelopes open and its banner clears jumps',()=>{
 assert.equal(FINISH_GATE.halfWidth,PLAYABLE_HALF_WIDTH+1.1);
 assert.equal(FINISH_GATE.halfWidth*2,21.2);
 for(const lane of LANES){assert.ok(Math.abs(laneToX(lane))+1.55<FINISH_GATE.halfWidth-1.15,'the outer raft clears the widest low pier');assert.ok(Math.abs(laneToX(lane))+2.4<FINISH_GATE.halfWidth-.525,'arms/paddle clear the narrow upright column');}
 assert.ok(FINISH_GATE.bannerBottom>3.7+2.9+.85,'a jumping rider remains below the finish banner');
});

test('posts, docks, approach markers and visibility share the exact widened course field on all maps',()=>{
 for(const seed of [0,137,98213])for(const level of LEVELS)for(const remaining of [-13,-12,0,15,40,80,120,300,301]){
  const g={seed,distance:level.length-remaining},profile=createCourseProfile(seed,level.length,level.index),travel=g.distance,layout=finishLayout(g,travel,level,profile);
  assert.equal(layout.remaining,remaining);assert.equal(layout.course,level.length);assert.equal(layout.visible,remaining>=-12&&remaining<=300);
  assert.equal(layout.posts.length,2);assert.equal(layout.docks.length,2);assert.equal(layout.markers.length,8);
  for(const post of layout.posts)assert.deepEqual({x:post.x,y:post.y,z:post.z},riverPoint(travel,level.length,post.side*FINISH_GATE.halfWidth,profile));
  for(const marker of layout.markers)assert.deepEqual({x:marker.x,y:marker.y,z:marker.z},riverPoint(travel,level.length-marker.offset,marker.side*FINISH_GATE.halfWidth,profile));
  for(const dock of layout.docks){const p=riverPoint(travel,level.length,0,profile),cross=dock.x-p.x;assert.ok(Math.abs(dock.y-riverPoint(travel,level.length,cross,profile).y-riverBankHeight(cross,level.length,profile))<1e-10);}
 }
});
