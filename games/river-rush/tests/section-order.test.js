import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainKindAt,terrainSection} from '../src/game/course-sections.js';
import {LEVELS} from '../src/game/levels.js';

test('seeded terrain order varies without neighboring repeats or a fixed three-kind cycle',()=>{
 const routes=new Set();
 for(let seed=0;seed<251;seed++){
  const route=Array.from({length:40},(_,cell)=>terrainKindAt(cell,seed));
  assert.ok(route.every(kind=>Number.isInteger(kind)&&kind>=0&&kind<3));
  assert.ok(route.slice(1).every((kind,i)=>kind!==route[i]));
  assert.ok(route.slice(3).some((kind,i)=>kind!==route[i]),'fixed three-kind cycle');
  for(let block=0;block<10;block++)assert.equal(new Set(route.slice(block*4,block*4+3)).size,3);
  assert.deepEqual(route,Array.from({length:40},(_,cell)=>terrainKindAt(cell,seed)));
  routes.add(route.join(','));
 }
 assert.ok(routes.size>100,'different seeds should offer different course orders');
});

test('finite maps expose a consistent next encounter and retain all terrain types',()=>{
 for(const level of LEVELS)for(let seed=0;seed<30;seed++){
  const profile={seed,length:level.length,mapIndex:level.index},seen=new Set();
  let previous;
  for(let d=300;d<level.length-220;d+=5){
   const section=terrainSection(d,profile);if(section.phase!=='active')continue;
   seen.add(section.type);
   if(previous?.id!==section.id){if(previous){assert.notEqual(previous.type,section.type);assert.equal(previous.next,section.name);}previous=section;}
  }
  assert.equal(seen.size,3);
 }
});
