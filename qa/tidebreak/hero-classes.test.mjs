import assert from 'node:assert/strict';
import {createMatch,player,cast,step,damage,HEROES} from '../../public/tidebreak/sim.js';
import {recalculate} from '../../public/tidebreak/items.js';
import {KITS} from '../../public/tidebreak/abilities.js';
import {rosterHTML,heroPreviewHTML,ROLES} from '../../public/tidebreak/roster.js';
import {HERO_IDENTITIES} from '../../public/tidebreak/hero-identities.js';
const setup=hero=>{const s=createMatch(hero,42),p=player(s);s.units=[p];s.nextWave=s.objectiveAt=Infinity;s.campTimers=s.campTimers.map(()=>Infinity);Object.assign(p,{x:2400,y:2800,skillRanks:[1,1,1,1],level:6,nextShop:Infinity});return{s,p};};
const foe=(s,p,extra={})=>{const t={id:100+s.units.length,kind:'minion',team:1,x:p.x,y:p.y-170,radius:16,hp:10000,maxHp:10000,shield:0,armor:0,speed:0,damage:0,range:0,attackCd:999,stun:0,slow:0,fear:0,lane:1,lastHit:0,itemState:{},inventory:[],hero:0,player:true,level:1,mana:420,maxMana:420,cd:[100,100,100,100],skillRanks:[0,0,0,0],skillPoints:0,gold:0,nextShop:Infinity,portalCd:0,respawn:0,regen:0,haste:1,...extra};s.units.push(t);p.target=t.id;return t;};
const advance=(s,seconds,input={attack:false})=>{for(let i=0;i<Math.ceil(seconds*100);i++)step(s,input,.01);};
assert.equal(new Set(KITS.flat().map(a=>a.name)).size,48);
for(const h of HEROES)assert.equal(h.skills.length,4);
assert.deepEqual(HEROES.filter(h=>h.attribute==='Strength').map(h=>h.slug),['nessie','wendigo','golem']);
assert.deepEqual(HEROES.filter(h=>h.attribute==='Agility').map(h=>h.slug),['mothman','devil','kitsune','gorgon']);
assert.equal(HEROES.filter(h=>h.attribute==='Intelligence').length,5);
for(const filter of ['Carry','Bruiser','Mage','Support','Initiator']){
 assert(ROLES.includes(filter));const ids=[...rosterHTML(0,filter).matchAll(/data-hero="(\d+)"/g)].map(m=>+m[1]);assert(ids.length);
 for(const id of ids){const identity=HERO_IDENTITIES[id],h=HEROES[identity.kit];assert(identity.filters.includes(filter));assert(heroPreviewHTML(id).includes(h.attribute));assert.equal((heroPreviewHTML(id).match(/data-hero-spell=/g)||[]).length,4);}
}
for(let hero=0;hero<12;hero++){
 const {p}=setup(hero),h=HEROES[hero];p.level=1;recalculate(p,h);const before={hp:p.maxHp,mana:p.maxMana,rate:p.rate,armor:p.armor,power:p.power,regen:p.regen};
 p.level=2;recalculate(p,h);
 assert.equal(p.maxHp-before.hp,h.attribute==='Strength'?145:110);
 assert.equal(p.maxMana-before.mana,h.attribute==='Intelligence'?48:32);
 assert.equal(p.power-before.power,h.attribute==='Intelligence'?3:0);
 assert.equal(p.armor-before.armor,h.attribute==='Agility'?.4:0);
 assert.equal(p.regen-before.regen,h.attribute==='Strength'?.4:0);
 assert.equal(p.rate,h.attribute==='Agility'?before.rate/1.025:before.rate);
 const derived={hp:p.maxHp,mana:p.maxMana,rate:p.rate,armor:p.armor,power:p.power};recalculate(p,h);assert.deepEqual({hp:p.maxHp,mana:p.maxMana,rate:p.rate,armor:p.armor,power:p.power},derived,'recalculation never compounds growth');
}
{
 const {s,p}=setup(4),t=foe(s,p,{kind:'hero',mana:100,brineUntil:9});const mana=p.mana;cast(s,p,2);assert.equal(t.mana,35);assert.equal(p.mana,mana-80+65);
 cast(s,p,3);const d=Math.hypot(t.x-p.x,t.y-p.y);advance(s,.05);assert(Math.hypot(t.x-p.x,t.y-p.y)<d,'abyss draws enemies inward');
}
{
 const {s,p}=setup(5);cast(s,p,3);advance(s,.6,{x:1,attack:false});const z=s.zones.find(z=>z.type==='blizzard');assert(Math.abs(z.x-p.x)<6);assert(p.x>2400);assert.equal(z.y,p.y);
 damage(s,foe(s,p),p,99999);advance(s,.05);assert(!s.zones.some(z=>z.type==='blizzard'),'storm ends on death');
}
{
 const {s,p}=setup(6),t=foe(s,p);cast(s,p,1);assert.equal(s.missiles.length,3);assert.equal(t.hp,t.maxHp,'foxfire travels');advance(s,.5);assert(t.spiritUntil>s.time);assert.equal(t.maxHp-t.hp,270);assert.equal(s.missiles.length,0);
}
{
 const {s,p}=setup(7),t=foe(s,p,{kind:'hero',hero:0,player:true,level:1,cd:[0,0,0,0],skillRanks:[1,1,0,0],mana:420,maxMana:420,itemState:{},inventory:[],nextShop:Infinity,gold:0,portalCd:0,respawn:0});cast(s,p,1);assert(t.disarmedUntil>s.time);t.stun=0;t.damage=100;t.range=300;t.rate=.1;const hp=p.hp;advance(s,1,{attack:true});assert.equal(p.hp,hp,'disarmed hero cannot attack');assert(cast(s,t,0),'disarm permits spells');
}
{
 const {s,p}=setup(8),t=foe(s,p);p.hp-=700;const hp=p.hp;cast(s,p,3);assert.equal(s.missiles.length,6);assert.equal(p.hp,hp,'healing waits for returning spirits');advance(s,.8);assert.equal(t.maxHp-t.hp,540);assert(p.hp>hp+200);assert.equal(s.missiles.length,0);
}
{
 const {s,p}=setup(9),t=foe(s,p),outside=foe(s,p,{x:p.x+250});cast(s,p,2,{x:0,y:-1});advance(s,.1);assert(t.hp<t.maxHp);assert.equal(outside.hp,outside.maxHp,'ray only hits its narrow line');const z=s.zones.find(z=>z.type==='sunray');advance(s,.2,{x:1,attack:false});assert(Math.abs(z.x-p.x)<6,'ray follows movement');p.silencedUntil=9;advance(s,.01);assert(!s.zones.some(z=>z.type==='sunray'),'silence cancels ray');
}
{
 const {s,p}=setup(10),ally={...p,id:89,player:false,x:p.x+120,hp:p.maxHp-800,mana:100,skillRanks:[0,0,0,0],skillPoints:0};s.units.push(ally);p.hp-=200;const hp=p.hp;cast(s,p,2,{x:1,y:0,distance:120});assert(ally.bloom);assert.equal(p.hp,hp,'aim chooses one ally');const mana=ally.mana;advance(s,2.1);assert(ally.hp>ally.maxHp-600);assert(ally.mana>mana+28,'bloom also restores mana');assert.equal(p.bloom,undefined);
}
{
 const {s,p}=setup(10),first=foe(s,p),second=foe(s,p,{x:p.x+220}),third=foe(s,p,{x:p.x+440});cast(s,p,1,{x:0,y:-1,distance:170});advance(s,.55);assert(first.snaredUntil>s.time);assert.equal(second.hp,second.maxHp);advance(s,.5);assert(second.snaredUntil>s.time);advance(s,1);assert.equal(third.hp,third.maxHp,'roots spread only one generation');
}
{
 const {s,p}=setup(11),first=foe(s,p),second=foe(s,p,{x:p.x+120}),third=foe(s,p,{x:p.x+240}),fourth=foe(s,p,{x:p.x+360});cast(s,p,1,{x:0,y:-1});assert.equal(first.hp,first.maxHp);advance(s,.8);for(const t of [first,second,third])assert.equal(t.bleed.type,'poison');assert.equal(fourth.hp,fourth.maxHp,'venom stops after three targets');assert.equal(first.maxHp-first.hp,165,'venom never bounces back');
}
{
 const {s,p}=setup(8);foe(s,p);cast(s,p,3);damage(s,s.units[1],p,99999);advance(s,.1);assert.equal(s.missiles.length,0,'spirits stop on death');
}
console.log('PASS: four skills per hero, five class/role filters, distinct non-compounding class growth, mana theft, moving storm, seeking foxfire, disarm, returning spirits, movable beam, targeted restoration, spreading roots and bounded venom bounces.');
