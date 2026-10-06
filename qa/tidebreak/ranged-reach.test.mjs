import assert from 'node:assert/strict';
import {createMatch,player,step,HEROES,RANGED_REACH,reach,commandOrder} from '../../public/tidebreak/sim.js';
import { near } from './open-ground.mjs';
// Ranged heroes attack from 1.5 times their listed range; melee reach does not change; wards still out-range heroes.
const setup=hero=>{const s=createMatch(hero,42),p=player(s);s.units=[p];s.nextWave=s.objectiveAt=Infinity;s.campTimers=s.campTimers.map(()=>Infinity);Object.assign(p,near(2400,2800));return{s,p};};
const wisp=(s,p,d)=>{const t={id:900,kind:'minion',team:1,x:p.x,y:p.y-d,radius:16,hp:10000,maxHp:10000,damage:0,speed:0,attackCd:100,lane:1,shield:0,stun:0,slow:0,fear:0,armor:0,lastHit:0};s.units.push(t);return t;};
assert.equal(RANGED_REACH,1.5);
for(let hero=0;hero<HEROES.length;hero++){
 const {s,p}=setup(hero),h=HEROES[hero],ranged=h.attackType==='Ranged';
 if(ranged)assert(h.range>=430,`${h.name} reaches at least 430`);else assert(h.range<=160,`${h.name} stays melee`);
 const t=wisp(s,p,h.range*.9),start={x:p.x,y:p.y};let bolt=false;
 commandOrder(s,p,{type:'attack',target:t.id});
 for(let i=0;i<40;i++){step(s,{},.05);bolt||=s.effects.some(f=>f.type==='bolt'&&f.source===p.id);}
 assert(t.hp<t.maxHp,`${h.name} hits from 90% of its reach`);assert(Math.hypot(p.x-start.x,p.y-start.y)<1,`${h.name} does not walk in`);
 assert.equal(bolt,ranged,`${h.name}: a bolt shows only for ranged attacks`);
}
{
 const s=createMatch(2,42),p=player(s),ward=s.units.find(u=>u.kind==='tower');
 assert(reach(p,ward)+ward.radius<ward.range,'a ranged hero must step inside the ward\'s reach to hit it');
}
console.log('PASS: ranged heroes attack from 1.5x reach without walking in and show a bolt; melee reach unchanged; wards still out-range heroes.');
