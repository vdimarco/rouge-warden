import assert from 'node:assert/strict';
import { pointerAction, movementPointer, abilityPointers } from '../../public/tidebreak/pointer-action.js';
import { createMatch, player, trainSkill, step } from '../../public/tidebreak/sim.js';
class Control extends EventTarget {
  constructor(){super();this.style={};this.disabled=false;this.dataset={skill:'0'};this.attributes={};this.classList={add(){},remove(){}};}
  setPointerCapture(id){this.captured=id;}
  getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100};}
  getAttribute(key){return this.attributes[key]??null;}
  send(type,id,x=50,y=50,extra={}){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,clientX:x,clientY:y,button:0,pointerType:'touch',isPrimary:id===1,...extra});this.dispatchEvent(e);}
}
for(let hero=0;hero<12;hero++){
 const state=createMatch(hero,42),p=player(state),movement={x:0,y:0},pad=new Control(),thumb=new Control(),plus=new Control(),spell=new Control(),casts=[],statuses=[],previews=[];
 state.units=[p];state.nextWave=state.objectiveAt=Infinity;state.campTimers=state.campTimers.map(()=>Infinity);
 const controls=movementPointer(pad,{movement,thumb,enabled:()=>true,onStart(){}});
 pointerAction(plus,()=>trainSkill(p,0),()=>p.skillPoints>0);
 const skills=abilityPointers([spell],{enabled:()=>true,onStart(){},onAim:aim=>previews.push(aim),onStatus:status=>statuses.push(status),onCast:cast=>casts.push(cast)});
 pad.send('pointerdown',1);pad.send('pointermove',1,88,50);assert.equal(movement.x,1);
 const before={x:p.x,y:p.y};step(state,{...movement},.05);assert(Math.hypot(p.x-before.x,p.y-before.y)>0,'held movement reaches simulation');
 plus.send('pointerdown',2);plus.send('pointerup',2);plus.send('click',2,50,50,{detail:1});
 assert.equal(p.skillRanks[0],1,'non-primary touch learns exactly once');assert.equal(p.skillPoints,0);assert.equal(movement.x,1,'upgrade release preserves held pad');
 spell.send('pointerdown',3);spell.send('pointermove',3,90,70);spell.send('pointerup',3,90,70);
 assert.equal(casts.length,1);assert.deepEqual(casts[0],{slot:0,aim:{x:40,y:20}});assert.equal(movement.x,1,'cast release preserves held pad');
 spell.send('pointerdown',4);spell.send('pointercancel',4);spell.send('pointerup',4);assert.equal(casts.length,1);
 spell.send('pointerdown',9);spell.send('pointermove',9,100,50);spell.send('pointermove',9,50,50);
 assert.deepEqual(statuses.at(-1),{slot:0,cancelled:true});assert.equal(previews.at(-1),null,'returning to center clears the aim preview');
 spell.send('pointerup',9);assert.equal(casts.length,1,'returning an aimed pointer to the button center cancels');assert.equal(movement.x,1,'deliberate cancellation preserves held movement');
 spell.send('pointerdown',10);spell.send('pointerup',10);assert.deepEqual(casts.at(-1),{slot:0,aim:null},'an unmoved tap retains automatic aim');
 spell.send('pointerdown',11);spell.send('pointermove',11,100,50);spell.send('pointermove',11,50,50);spell.send('pointermove',11,110,70);spell.send('pointerup',11,110,70);
 assert.deepEqual(casts.at(-1),{slot:0,aim:{x:60,y:20}},'dragging out of the cancel center resumes aiming');
 const count=casts.length;spell.send('pointerdown',12);spell.send('lostpointercapture',12);spell.send('pointerup',12);assert.equal(casts.length,count,'lost capture cancels without a cast');assert.equal(movement.x,1);
 p.skillPoints=1;p.level=3;plus.send('pointerdown',5);plus.send('pointercancel',5);plus.send('pointerup',5);assert.equal(p.skillRanks[0],1);assert.equal(movement.x,1);
 plus.send('pointerdown',6);plus.send('pointerup',6,150,50);assert.equal(p.skillRanks[0],1,'release outside does not train');
 plus.send('click',0,50,50,{detail:0});assert.equal(p.skillRanks[0],2,'keyboard trains once');
 pad.send('pointerup',7);assert.equal(movement.x,1,'unrelated pointer cannot release movement');pad.send('pointercancel',1);assert.deepEqual(movement,{x:0,y:0});
 pad.send('pointerdown',8);pad.send('pointermove',8,88,50);controls.reset();skills.reset();assert.deepEqual(movement,{x:0,y:0});
}
console.log('All 12 heroes: concurrent movement, non-primary training, aiming, cancellation and keyboard input pass.');
