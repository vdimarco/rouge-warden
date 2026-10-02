import assert from 'node:assert/strict';
import { createMatch, player, damage, commandOrder, step } from '../../public/tidebreak/sim.js';
import { SIZE, TOWER_POSITIONS, BASES, resolveBody, distance } from '../../public/tidebreak/world.js';
import { structureProtected, nextObjective, objectiveText } from '../../public/tidebreak/objectives.js';
for (let lane=0;lane<3;lane++) {
  const s=createMatch(1,49),p=player(s),core=s.units.find(e=>e.kind==='core'&&e.team===1);
  const towers=s.units.filter(e=>e.kind==='tower'&&e.team===1&&e.lane===lane),outer=towers.find(e=>e.tier===0),inner=towers.find(e=>e.tier===1);
  assert.equal(s.units.filter(e=>e.kind==='tower').length,12);assert.deepEqual(s.towers,[6,6]);assert(distance(outer,inner)>400);
  for(const tower of s.units.filter(e=>e.kind==='tower'))for(const phase of [0,1]){const body={...tower};resolveBody({phase},body);assert(distance(body,tower)<.01,'tower footprints lie on traversable lanes');}
  assert(structureProtected(s,inner));assert(structureProtected(s,core));assert.equal(commandOrder(s,p,{type:'attack',target:inner.id}),false);
  damage(s,p,inner,99999);damage(s,p,core,99999);assert.equal(inner.hp,inner.maxHp);assert.equal(core.hp,core.maxHp);
  assert.equal(nextObjective(s,1,lane),outer);assert.match(objectiveText(s,lane),/outer/);
  damage(s,p,outer,99999);assert(!structureProtected(s,inner));assert(structureProtected(s,core));assert.equal(nextObjective(s,1,lane),inner);assert.match(objectiveText(s,lane),/inner/);
  // Destroying an unrelated outer tower must not bypass the same-lane inner gate.
  const other=s.units.find(e=>e.kind==='tower'&&e.team===1&&e.lane!==lane&&e.tier===1);
  assert(structureProtected(s,other));
  damage(s,p,inner,99999);assert(!structureProtected(s,core));assert.equal(nextObjective(s,1,lane),core);
  const count=s.towers[1];damage(s,p,inner,99999);assert.equal(s.towers[1],count,'destroyed ward does not give duplicate rewards');
  damage(s,p,core,99999);assert.equal(s.winner,0);
}
{
  const s=createMatch(1),p=player(s),outer=TOWER_POSITIONS[0][1][0];
  assert(p.y>outer.y&&p.y<BASES[0].y,'player starts safely behind the allied outer ward');
  assert.equal(SIZE,6400);
  s.units=[p];s.nextWave=s.objectiveAt=Infinity;s.campTimers=s.campTimers.map(()=>Infinity);
  const goal={x:p.x+280,y:p.y};commandOrder(s,p,{type:'move',...goal});for(let i=0;i<240;i++)step(s,{attack:false},1/60);assert(distance(p,goal)<12,'map-equivalent movement order travels and stops');
}
console.log('PASS: 6400-unit arena, 12 tower footprints, all three lane gates, core protection, next-stage HUD, safe start and movement orders.');
