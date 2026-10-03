import assert from 'node:assert/strict';
import {createMatch,player,cast,step,damage,HEROES} from '../../public/tidebreak/sim.js';
import {KITS} from '../../public/tidebreak/abilities.js';
import {spellbookHTML,spellDetail} from '../../public/tidebreak/spellbook.js';
import {rosterHTML} from '../../public/tidebreak/roster.js';
import {BASIC_ATTACKS} from '../../public/tidebreak/basic-attacks.js';
const setup=hero=>{const s=createMatch(hero,42),p=player(s);s.units=[p];s.nextWave=s.objectiveAt=Infinity;s.campTimers=s.campTimers.map(()=>Infinity);Object.assign(p,{x:2400,y:2800,skillRanks:[1,1,1,1],level:6,gold:0,nextShop:Infinity});return{s,p};};
const foe=(s,p,extra={})=>{const t={id:100+s.units.length,kind:'minion',team:1,x:p.x,y:p.y-170,facing:Math.PI/2,radius:16,hp:10000,maxHp:10000,damage:0,speed:0,attackCd:100,lane:1,shield:0,stun:0,slow:0,fear:0,armor:0,lastHit:0,...extra};s.units.push(t);p.target=t.id;return t;};
const advance=(s,t)=>{for(let i=0;i<t*20;i++)step(s,{attack:false},.05);};
assert.equal(HEROES.length,12);assert.equal(KITS.length,12);assert.equal(BASIC_ATTACKS.length,12);assert.equal(new Set(HEROES.map(h=>h.slug)).size,12);assert.equal(new Set(KITS.flat().map(a=>a.name)).size,48);
for(let hero=0;hero<12;hero++){
 const {s,p}=setup(hero);assert.equal(p.name,HEROES[hero].name);assert(p.build);assert.equal(BASIC_ATTACKS[hero].length,3);
 for(let slot=0;slot<4;slot++){assert(spellDetail(hero,slot).combo);assert(spellbookHTML(p,slot).includes(KITS[hero][slot].name));}
 if(hero>=4)for(let slot=0;slot<4;slot++){const {s,p}=setup(hero);foe(s,p);p.hp-=300;assert(cast(s,p,slot));advance(s,1);assert(s.units.every(e=>Number.isFinite(e.x+e.y+e.hp)));}
}
assert.equal((rosterHTML(0).match(/data-hero=/g)||[]).length,12);assert.equal((rosterHTML(0,'Mage').match(/data-hero=/g)||[]).length,4);
{
 const {s,p}=setup(4),t=foe(s,p);cast(s,p,1);assert(t.brineUntil>s.time);const hp=t.hp;cast(s,p,2);assert(hp-t.hp>=340,'Kraken brine bonus');
}
{
 const {s,p}=setup(5),t=foe(s,p,{chillUntil:10});cast(s,p,1);assert(t.stun>0);p.hp-=500;const hp=p.hp;cast(s,p,2);assert(p.hp>hp,'Wendigo feeds');
}
{
 const {s,p}=setup(6),t=foe(s,p);cast(s,p,1);advance(s,.4);assert(t.spiritUntil>s.time);const hp=t.hp;cast(s,p,2);advance(s,.6);assert(hp-t.hp>=320);assert(t.stun>0);cast(s,p,3);const zone=s.zones.find(z=>z.type==='ninelights');advance(s,5.5);assert.equal(zone.pulses,9);
}
{
 const {s,p}=setup(7),t=foe(s,p);cast(s,p,2);const hp=t.hp;damage(s,t,p,100,'attack');assert(t.hp<hp);p.cd[3]=0;const before=t.hp;cast(s,p,3);advance(s,.6);assert.equal(t.hp,before,'Worldbreaker warns');advance(s,.3);assert(t.hp<before);assert(t.stun>0);
}
{
 const {s,p}=setup(8),t=foe(s,p,{kind:'hero',hero:0,cd:[0,0,0,0],skillRanks:[1,0,0,0],itemState:{},inventory:[]});cast(s,p,1);assert(t.silencedUntil>s.time);assert.equal(cast(s,t,0),false);p.hp-=500;const hp=p.hp;cast(s,p,2);damage(s,p,t,100);assert(p.hp>hp,'Soul thread drains');
}
{
 const {s,p}=setup(9),t=foe(s,p);cast(s,p,1);assert.equal(t.bleed.type,'fire');const hp=t.hp;cast(s,p,2);advance(s,.6);assert(hp-t.hp>100);assert(t.bleed,'Sun ray amplifies a burning target');cast(s,p,3);damage(s,t,p,99999);assert.equal(p.hp,p.maxHp*.35);assert.equal(p.deaths,0);damage(s,t,p,99999);assert.equal(p.hp,0,'Last ember works once');
}
{
 const {s,p}=setup(10);p.hp-=500;const hp=p.hp;cast(s,p,2);assert(p.hp>hp);assert(p.bloom);advance(s,2);const t=foe(s,p);cast(s,p,3);advance(s,.1);assert(t.stun>0);assert(p.hp>hp+250,'Grove heals');
}
{
 const {s,p}=setup(11),t=foe(s,p);p.bleed={type:'poison',until:5};p.slow=2;cast(s,p,0,{x:1,y:0});assert.equal(p.bleed,null);assert.equal(p.slow,0);p.x=2400;p.y=2800;cast(s,p,1,{x:0,y:-1});advance(s,.4);assert.equal(t.bleed.type,'poison');cast(s,p,2,{x:0,y:-1});assert(t.stun>0);t.stun=0;t.facing=-Math.PI/2;p.cd[2]=0;cast(s,p,2,{x:0,y:-1});assert.equal(t.stun,0,'Gaze checks enemy facing');cast(s,p,3);advance(s,1.5);assert(t.stun>0,'Garden stuns every third pulse');
}
console.log('PASS: twelve heroes, 48 named spells, previews, role filters, all new casts, eight combinations, silence, delayed warnings, nine pulses and single-use rebirth.');
