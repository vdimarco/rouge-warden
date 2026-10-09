import {nextRiverFork,riverFork} from '../src/game/river-forks.js';
import {queueAction,updateGame,emptyInput} from '../src/game/engine.js';
import {LANES} from '../src/game/lanes.js';
// Controllers must choose water at a real fork. They use normal input; this
// helper never changes game position, protection, clocks or terrain.
export function chooseForkWater(g,input,role='safe'){
 const fork=nextRiverFork(g.distance,g.terrainProfile);
 if(fork&&g.distance>=fork.start-g.speed*.18&&g.distance<fork.splitStart){
  const side=role==='risk'?fork.riskSide:fork.safeSide,lane=side<0?1:3;
  for(let n=0;n<Math.abs(g.lane-lane);n++)queueAction(input,lane>g.lane?'right':'left');
 }
}
export function waterLanes(g){const fork=riverFork(g.distance,g.terrainProfile);return fork&&fork.islandHalfWidth>.035?(g.lane<2?[0,1]:[3,4]):LANES;}
export function advanceCourseScanner(g,dt=.05){const input=emptyInput();chooseForkWater(g,input);updateGame(g,input,dt);}
