import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,generateAhead} from '../src/game/engine.js';
import {LEVELS,FINISH_RUNWAY} from '../src/game/levels.js';
import {courseAct} from '../src/game/course-intensity.js';

const hazardTypes=new Set(['rock','log','branch']);
function inspectCourse(seed,index){
 const g=createGame(seed,index),level=LEVELS[index];
 for(let distance=0;distance<level.length;distance+=120){g.distance=distance;g.time=distance/level.startSpeed;generateAhead(g);}
 const rows=new Map();
 for(const item of g.entities.filter(e=>hazardTypes.has(e.type))){if(!rows.has(item.row))rows.set(item.row,[]);rows.get(item.row).push(item);}
 return{g,rows:[...rows.values()].sort((a,b)=>a[0].d-b[0].d)};
}

test('each finite river is 50 percent longer and has a clean 150 m finish approach',()=>{
 assert.deepEqual(LEVELS.map(level=>level.length),[4200,5400,6600]);
 assert.equal(LEVELS.reduce((total,level)=>total+level.length,0),16200);
 assert.equal(FINISH_RUNWAY,150);
 for(const level of LEVELS){
  const {g,rows}=inspectCourse(139,level.index);
  assert.ok(rows.every(row=>row[0].d<level.length-FINISH_RUNWAY));
  const approach=g.entities.filter(e=>e.motif==='finish-runway');
  assert.equal(approach[0].d,level.length-130);assert.equal(approach.at(-1).d,level.length-15);
  assert.ok(approach.every(e=>e.type==='coin'&&e.lane===1));
  assert.ok(g.entities.every(e=>e.d<level.length));
 }
});

test('seeded episodes cross four acts with varied lengths, recovery gaps and increasingly demanding formations',()=>{
 const totals=Array.from({length:4},()=>({rows:0,paired:0,waves:0,gaps:0}));
 const episodeLengths=new Set();
 for(let seed=1;seed<=40;seed++)for(const level of LEVELS){
  const {g,rows}=inspectCourse(seed,level.index),episodes=new Map();
  assert.equal(new Set(g.patternsSeen.filter(id=>id!=='tutorial')).size,6);
  assert.deepEqual([...new Set(rows.map(row=>row[0].act))],[0,1,2,3]);
  for(const act of [0,1,2,3])assert.ok(rows.some(row=>row[0].act===act&&row[0].recovery),`seed ${seed}, ${level.id}, act ${act} has no recovery`);
  for(let i=0;i<rows.length;i++){
   const row=rows[i],item=row[0],act=courseAct(item.d,level.length),stats=totals[act];
   assert.equal(item.act,act);stats.rows++;stats.paired+=row.length>1?1:0;stats.waves+=row.length===3?1:0;
   assert.ok(row.length<3||row.every(e=>e.type===row[0].type&&e.type!=='rock'),'mixed wall has no safe route');
   if(item.episode>=0){
    if(!episodes.has(item.episode))episodes.set(item.episode,[]);episodes.get(item.episode).push(item);
    const next=rows[i+1]?.[0];
    if(next){
     const spacing=(next.d-item.d)/Math.min(level.maxSpeed,level.startSpeed+item.d/level.startSpeed*level.acceleration);
     if(item.recovery){assert.ok(spacing>level.minInterval+.27,'episode recovery is too short');stats.gaps++;}
    }
   }
  }
  for(const episode of episodes.values())if(episode.at(-1).recovery)episodeLengths.add(episode.length);
  assert.ok(rows.some(row=>row[0].recovery),'no recovery between bursts');
 }
 assert.ok(episodeLengths.size>=4,'episodes repeat one fixed row count');
 assert.equal(totals[0].waves,0,'opening contains full-width action waves');
 assert.ok(totals[3].waves/totals[3].rows>totals[1].waves/totals[1].rows,'late action waves do not intensify');
 assert.ok(totals[3].paired/totals[3].rows>totals[0].paired/totals[0].rows+.15,'late formations do not become more demanding');
 assert.ok(totals.every(act=>act.gaps>0),'one act lacks recovery stretches');
});
