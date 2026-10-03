import assert from 'node:assert/strict';
import { createMatch, player, cast, castTarget } from '../../public/tidebreak/sim.js';
import { Renderer } from '../../public/tidebreak/illustrated-render.js';
import { cursorSkillAim, dragSkillAim, skillAimPreview, skillAimRange, AIM_DRAG_RANGE } from '../../public/tidebreak/skill-aim.js';

const close=(a,b,message)=>assert(Math.abs(a-b)<1e-7,`${message}: ${a} vs ${b}`);
function setup(hero){const s=createMatch(hero,49),p=player(s);s.units=[p];Object.assign(p,{x:2400,y:3100,level:18,skillRanks:[4,4,4,3],mana:3000,maxMana:3000});return {s,p};}
const screenDirection=(x,y)=>Renderer.prototype.screenDirection(x,y);

for(const [width,height] of [[1440,900],[390,844],[844,390]]){
  const {p}=setup(2),view={width,height,scale:Math.min(width/1200,height/1680),anchor:height<520?.70:.78,cam:{x:p.x+65,y:p.y-95},shakeX:2,shakeY:-1};
  const point={x:p.x+200,y:p.y-120},screen=Renderer.prototype.project.call(view,point.x,point.y),world=Renderer.prototype.world.call(view,screen.x,screen.y),aim=cursorSkillAim(p,2,world);
  close(aim.x,200,'desktop preserves world x');close(aim.y,-120,'desktop preserves world y without a second screen correction');close(aim.distance,Math.hypot(200,120),'desktop nearby placement distance');
}

for(const [hero,slot] of [[2,1],[2,2],[6,2],[10,0],[10,1],[10,2]]){
  const {s,p}=setup(hero),short=dragSkillAim(p,slot,{x:AIM_DRAG_RANGE/4,y:0},screenDirection),long=dragSkillAim(p,slot,{x:AIM_DRAG_RANGE*2,y:0},screenDirection);
  close(short.distance,skillAimRange(p,slot)/4,'short thumb drag scales placement');close(long.distance,skillAimRange(p,slot),'long thumb drag caps placement');
  const preview=skillAimPreview(s,p,slot,short);assert(Number.isFinite(preview.shape.x)&&Number.isFinite(preview.shape.y));
  if(hero===10&&slot===2)continue;
  assert(cast(s,p,slot,short),'trained ground spell resolves');
  const actual=hero===2&&slot===1?s.traps.at(-1):hero===10&&slot===0?s.units.find(e=>e.kind==='summon'):s.zones.at(-1);
  close(preview.shape.x,actual.x,'preview matches ground spell x');close(preview.shape.y,actual.y,'preview matches ground spell y');
}

for(const hero of [0,1,2,3,6]){
  const {s,p}=setup(hero),aim=dragSkillAim(p,0,{x:30,y:-40},screenDirection),preview=skillAimPreview(s,p,0,aim);
  assert.equal(preview.shape.shape,'path');assert(cast(s,p,0,aim));
  close(preview.shape.tx,p.x,'movement preview matches landing x');close(preview.shape.ty,p.y,'movement preview matches landing y');
}

for(const hero of [0,8]){
  const {s,p}=setup(hero),foe={id:500,kind:'hero',team:1,hp:1000,maxHp:1000,x:p.x+220,y:p.y-80,radius:25,stun:0,cloak:0};s.units.push(foe);
  const aim=cursorSkillAim(p,2,foe),preview=skillAimPreview(s,p,2,aim);
  assert.equal(preview.shape.targetId,castTarget(s,p,2,aim)?.id);assert.equal(preview.shape.targetId,foe.id);assert.equal(preview.shape.valid,true);
  const empty=skillAimPreview(s,p,2,cursorSkillAim(p,2,{x:p.x-350,y:p.y}));assert.equal(empty.shape.valid,false,'manual empty spot does not preview a different auto target');
}

for(let hero=0;hero<12;hero++)for(let slot=0;slot<4;slot++){
  const {s,p}=setup(hero),aim=dragSkillAim(p,slot,{x:48,y:-32},screenDirection),preview=skillAimPreview(s,p,slot,aim);
  assert(preview&&Number.isFinite(preview.shape.x)&&Number.isFinite(preview.shape.y)&&Number.isFinite(preview.shape.radius),`hero ${hero} slot ${slot} has a finite preview`);
}
assert.equal(cursorSkillAim(setup(2).p,2,null),null);assert.equal(dragSkillAim(setup(2).p,2,null,screenDirection),null);
console.log('PASS: cursor world aim in desktop, portrait and landscape; thumb placement range; exact ground and leap previews; manual target previews; all 48 finite spell previews.');
