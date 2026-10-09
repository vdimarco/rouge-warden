import assert from 'node:assert/strict';
import { pointerAction, movementPointer, abilityPointers, screenMovementPointer } from '../../public/tidebreak/pointer-action.js';
import { createMatch, player, trainSkill, step } from '../../public/tidebreak/sim.js';
class Control extends EventTarget {
  constructor(){super();this.style={};this.disabled=false;this.dataset={skill:'0'};this.attributes={};this.classList={add(){},remove(){}};}
  setPointerCapture(id){this.captured=id;}
  getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100};}
  getAttribute(key){return this.attributes[key]??null;}
  send(type,id,x=50,y=50,extra={}){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,clientX:x,clientY:y,button:0,pointerType:'touch',isPrimary:id===1,...extra});this.dispatchEvent(e);}
}
for(let hero=0;hero<16;hero++){
 const state=createMatch(hero,42),p=player(state),movement={x:0,y:0},pad=new Control(),thumb=new Control(),plus=new Control(),spell=new Control(),casts=[],statuses=[],previews=[];let upgradeMode=false;
 state.units=[p];state.nextWave=state.objectiveAt=Infinity;state.campTimers=state.campTimers.map(()=>Infinity);
 const controls=movementPointer(pad,{movement,thumb,enabled:()=>true,onStart(){}});
 pointerAction(plus,()=>trainSkill(p,0),()=>p.skillPoints>0);
 const skills=abilityPointers([spell],{enabled:()=>true,onStart(){},onAim:aim=>previews.push(aim),onStatus:status=>statuses.push(status),onCast:cast=>{if(upgradeMode)trainSkill(p,cast.slot);else casts.push(cast);}});
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
 p.skillPoints=1;p.level=3;upgradeMode=true;spell.send('pointerdown',5);spell.send('pointerup',5);upgradeMode=false;
 assert.equal(p.skillRanks[0],2,'full ability icon spends a point in upgrade mode');assert.equal(p.skillPoints,0);assert.equal(movement.x,1,'full-icon upgrade preserves held movement');
 p.skillPoints=1;p.level=5;plus.send('pointerdown',6);plus.send('pointercancel',6);plus.send('pointerup',6);assert.equal(p.skillRanks[0],2);assert.equal(movement.x,1);
 plus.send('pointerdown',7);plus.send('pointerup',7,150,50);assert.equal(p.skillRanks[0],2,'release outside does not train');
 plus.send('click',0,50,50,{detail:0});assert.equal(p.skillRanks[0],3,'keyboard trains once');
 pad.send('pointerup',17);assert.equal(movement.x,1,'unrelated pointer cannot release movement');pad.send('pointercancel',1);assert.deepEqual(movement,{x:0,y:0});
 pad.send('pointerdown',8);pad.send('pointermove',8,88,50);controls.reset();skills.reset();assert.deepEqual(movement,{x:0,y:0});
}
console.log('All 16 heroes: concurrent movement, full-icon upgrades, aiming, cancellation and keyboard input pass.');

{
 const movement={x:0,y:0},surface=new Control(),taps=[];
 const screen=screenMovementPointer(surface,{movement,enabled:()=>true,onStart(){},onDragStart(){},onTap:e=>taps.push([e.clientX,e.clientY])});
 surface.send('pointerdown',21,20,20);surface.send('pointermove',21,65,20);
 assert(movement.x>.95&&Math.abs(movement.y)<.01,'drag anywhere steers from its touch origin');
 surface.send('pointerup',21,65,20);assert.deepEqual(movement,{x:0,y:0},'release stops anywhere-drag movement');
 surface.send('pointerdown',22,40,40);surface.send('pointerup',22,44,43);
 assert.deepEqual(taps.at(-1),[44,43],'short screen touch remains a tap');
 surface.send('pointerdown',23,80,80);surface.send('pointercancel',23);assert.deepEqual(movement,{x:0,y:0},'cancel clears anywhere-drag movement');
 screen.reset();
}
console.log('Anywhere-drag screen movement preserves taps and releases cleanly.');

{
 const movement={x:0,y:0},surface=new Control(),factors=[],taps=[];let enabled=true,stops=0;
 const input=screenMovementPointer(surface,{movement,enabled:()=>enabled,onStart(){},onDragStart(){stops++;},onTap:e=>taps.push(e.pointerId),onZoom:f=>factors.push(f)});
 surface.send('pointerdown',41,10,50);surface.send('pointermove',41,60,50);assert.equal(movement.x,1);
 surface.send('pointerdown',42,160,50);assert(input.pinching);assert.deepEqual(movement,{x:0,y:0});assert.equal(stops,2);
 surface.send('pointermove',42,110,50);assert.equal(factors.at(-1),2,'fingers together zoom out');
 surface.send('pointermove',42,160,50);assert.equal(factors.at(-1),.5,'fingers apart zoom in');
 const count=factors.length;surface.send('pointermove',99,300,50);assert.equal(factors.length,count);
 enabled=false;surface.send('pointermove',42,110,50);assert.equal(factors.length,count,'inactive gestures cannot zoom');enabled=true;
 surface.send('pointercancel',41);surface.send('lostpointercapture',41);surface.send('pointerup',41);
 surface.send('pointermove',42,200,50);assert.deepEqual(movement,{x:0,y:0});surface.send('pointerup',42);assert.equal(taps.length,0);assert(!input.active);
 surface.send('pointerdown',43,10,50);surface.send('pointerup',43);assert.deepEqual(taps,[43],'fresh single touch still taps');
 surface.send('pointerdown',44,10,50);surface.send('pointerdown',45,110,50);surface.send('lostpointercapture',45);surface.send('pointerup',44);assert.deepEqual(taps,[43]);assert(!input.active);
 surface.send('pointerdown',46,10,50);surface.send('pointerdown',47,110,50);input.reset();surface.send('pointerup',46);surface.send('pointerup',47);assert(!input.pinching);assert.deepEqual(taps,[43]);
 const pad=new Control(),thumb=new Control(),skill=new Control(),casts=[];
 movementPointer(pad,{movement,thumb,enabled:()=>true,onStart(){}});abilityPointers([skill],{enabled:()=>true,onStart(){},onAim(){},onCast:c=>casts.push(c)});
 pad.send('pointerdown',51);pad.send('pointermove',51,88,50);skill.send('pointerdown',52);skill.send('pointerup',52);
 assert.equal(movement.x,1);assert.equal(casts.length,1);assert(!input.pinching,'control touches do not enter battlefield pinch');
 pad.send('pointerup',51);
}
console.log('Battlefield pinch: ratios, movement suppression, unrelated touches, inactive states and cancellation pass.');

// A modal can replace the original pointer target between pointerup and click.
// Route the event through document capture before its new target, as the browser does.
{
 const doc=new EventTarget(),otherDoc=new EventTarget(),map=new Control(),otherMap=new Control(),close=new EventTarget();
 map.ownerDocument=doc;otherMap.ownerDocument=otherDoc;
 let open=false,opens=0,closes=0,immediateClick=false;
 close.addEventListener('click',()=>{open=false;closes++;});
 const route=(document,target,type,id=71,x=50,y=50,detail=1)=>{
  const e=new Event(type,{cancelable:true});
  Object.assign(e,{clientX:x,clientY:y,button:0,pointerType:'touch',detail});
  if(id!==undefined&&id!==null)Object.assign(e,{pointerId:id});
  document.dispatchEvent(e);
  if(!e.defaultPrevented)target.dispatchEvent(e);
  return e;
 };
 const release=(id=71)=>{route(doc,map,'pointerdown',id);route(doc,map,'pointerup',id);};
 pointerAction(map,()=>{open=true;opens++;if(immediateClick)route(doc,close,'click',71);});
 pointerAction(otherMap,()=>{});
 release();assert.equal(opens,1,'pointerup opens the modal once');
 const retargeted=route(doc,close,'click',71);
 assert(retargeted.defaultPrevented,'matching compatibility click is stopped at document capture');
 assert(open&&closes===0,'the retargeted click cannot close the new modal');
 route(doc,close,'click',71);assert.equal(closes,1,'only one matching click is consumed');

 // The guard must be armed before the action replaces its DOM, not after it returns.
 immediateClick=true;release();assert(open&&closes===1,'a click triggered as the action changes the UI is already guarded');immediateClick=false;

 release(72);
 route(doc,close,'click',99);assert.equal(closes,2,'a different pointer is not suppressed at matching coordinates');
 open=true;assert(route(doc,close,'click',72).defaultPrevented,'the original pointer still owns its pending compatibility click');
 assert(open,'unrelated input does not replace the pending pointer identity');

 release(73);route(doc,map,'click',-1,50,50,0);
 assert.equal(opens,5,'keyboard activation still runs the pointerAction callback exactly once');
 const keyboard=route(doc,close,'click',-1,50,50,0);assert(!keyboard.defaultPrevented&&closes===3,'keyboard dismissal remains available');

 release(74);route(doc,close,'pointerdown',80);route(doc,close,'pointerup',80);
 assert(!route(doc,close,'click',74).defaultPrevented,'the next real pointerdown clears the old guard');
 assert.equal(closes,4,'a distinct press can close the modal even at the same coordinates');

 // Safari can deliver a MouseEvent with no pointer ID. Its location and short deadline identify the old click.
 release(75);const safari=route(doc,close,'click',null,51,50);
 assert(safari.defaultPrevented&&open,'nearby MouseEvent fallback consumes the compatibility click');
 release(76);assert(!route(doc,close,'click',null,90,90).defaultPrevented,'a different MouseEvent location stays available');

 const originalPerformance=Object.getOwnPropertyDescriptor(globalThis,'performance');let clock=0;
 try{
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock}});
  release(77);clock=501;
  assert(!route(doc,close,'click',null).defaultPrevented,'an expired fallback cannot suppress a future click');
 }finally{if(originalPerformance)Object.defineProperty(globalThis,'performance',originalPerformance);else delete globalThis.performance;}

 release(78);assert(!route(otherDoc,close,'click',78).defaultPrevented,'another document has an independent guard');
 map.disabled=true;route(doc,map,'pointerdown',79);route(doc,map,'pointerup',79);open=true;
 assert(!route(doc,close,'click',79).defaultPrevented,'a rejected action does not arm click suppression');
 map.disabled=false;route(doc,map,'pointerdown',81);route(doc,map,'pointercancel',81);route(doc,map,'pointerup',81);
 assert(!route(doc,close,'click',81).defaultPrevented,'a cancelled pointer does not arm click suppression');
}
console.log('Pointer actions: retargeted compatibility clicks, keyboard activation, distinct presses, legacy MouseEvents and per-document guards pass.');
