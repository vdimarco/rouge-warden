import { nearestSkill, skillReach } from './skill-reach.js';
// A second touch is not guaranteed to dispatch click. Activate its own captured release.
export function pointerAction(button, action, enabled=()=>!button.disabled) {
  let pointer=null,origin;
  button.addEventListener('pointerdown',e=>{e.stopPropagation();if(pointer!==null||e.button!==0||!enabled())return;e.preventDefault();pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};button.setPointerCapture?.(pointer);});
  button.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;const rect=button.getBoundingClientRect(),slop=e.pointerType==='touch'?22:8,inside=e.clientX>=rect.left-slop&&e.clientX<=rect.right+slop&&e.clientY>=rect.top-slop&&e.clientY<=rect.bottom+slop,travel=Math.hypot(e.clientX-origin.x,e.clientY-origin.y);pointer=null;if(inside&&enabled()&&travel<(e.pointerType==='touch'?60:28))action();});
  for(const event of ['pointercancel','lostpointercapture'])button.addEventListener(event,e=>{if(e.pointerId===pointer)pointer=null;});
  button.addEventListener('click',e=>{if(e.detail===0&&enabled())action();});
}

export function movementPointer(pad,{movement,thumb,enabled,onStart}) {
  let pointer=null,origin;
  const reset=()=>{pointer=null;movement.x=movement.y=0;thumb.style.transform='';pad.classList.remove('active');};
  const move=e=>{if(e.pointerId!==pointer)return;const x=e.clientX-origin.x,y=e.clientY-origin.y,d=Math.max(1,Math.hypot(x,y)/38);movement.x=x/d/38;movement.y=y/d/38;thumb.style.transform=`translate(${movement.x*29}px,${movement.y*29}px)`;};
  pad.addEventListener('pointerdown',e=>{if(pointer!==null||!enabled())return;e.preventDefault();e.stopPropagation();onStart();pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};pad.classList.add('active');pad.setPointerCapture(pointer);move(e);});
  pad.addEventListener('pointermove',move);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
  return {reset};
}

export function abilityPointers(buttons,{enabled,onStart,onAim,onCast,onStatus=()=>{}}) {
  let pointer=null,origin,center,slot,aim=null,aimed=false,cancelled=false;
  const reset=()=>{pointer=null;slot=null;aim=null;aimed=cancelled=false;onAim(null);onStatus(null);};
  const update=e=>{
    const x=e.clientX-origin.x,y=e.clientY-origin.y,drag=Math.hypot(x,y);
    aimed ||= drag>12;
    cancelled=aimed&&Math.hypot(e.clientX-center.x,e.clientY-center.y)<=center.cancelRadius;
    aim=aimed&&!cancelled?{x,y}:null;
    onAim(aim?{...aim,slot}:null);
    onStatus(aimed?{slot,cancelled}:null);
  };
  const available=button=>enabled()&&button.getAttribute('aria-disabled')!=='true';
  // A press goes to the skill with the nearest disc edge, so a press in a gap of the cluster still casts.
  const start=(button,e)=>{if(pointer!==null||e.button!==0||!button||!available(button))return;e.preventDefault();e.stopPropagation();onStart();pointer=e.pointerId;slot=+button.dataset.skill;origin={x:e.clientX,y:e.clientY};const rect=button.getBoundingClientRect();center={x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2,cancelRadius:Math.min(rect.right-rect.left,rect.bottom-rect.top)*.27};aim=null;aimed=cancelled=false;onAim(null);onStatus(null);button.setPointerCapture(pointer);};
  skillReach(buttons,start);
  for(const button of buttons){
    button.addEventListener('click',e=>{if(e.detail===0&&available(button)){onStart();onCast({slot:+button.dataset.skill,aim:null});}});
    button.addEventListener('pointerdown',e=>start(nearestSkill(buttons,e.clientX,e.clientY)||button,e));
    button.addEventListener('pointermove',e=>{if(e.pointerId===pointer)update(e);});
    button.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;update(e);if(available(button)&&!cancelled)onCast({slot,aim});reset();});
    for(const event of ['pointercancel','lostpointercapture'])button.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
  }
  return {reset};
}


export function screenMovementPointer(surface,{movement,enabled,onStart,onDragStart=()=>{},onTap=()=>{},threshold=12,radius=46}) {
  let pointer=null,origin=null,dragging=false;
  const reset=()=>{pointer=null;origin=null;dragging=false;movement.x=movement.y=0;};
  const update=e=>{
    if(e.pointerId!==pointer)return;
    const x=e.clientX-origin.x,y=e.clientY-origin.y,dist=Math.hypot(x,y);
    if(!dragging&&dist>=threshold){dragging=true;onDragStart();}
    if(!dragging)return;
    const denom=Math.max(radius,dist);
    movement.x=x/denom;movement.y=y/denom;
  };
  surface.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'||pointer!==null||e.button!==0||!enabled())return;
    e.preventDefault();onStart();pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};dragging=false;
    surface.setPointerCapture?.(pointer);
  });
  surface.addEventListener('pointermove',update);
  surface.addEventListener('pointerup',e=>{
    if(e.pointerId!==pointer)return;
    if(!dragging)onTap(e);
    reset();
  });
  for(const event of ['pointercancel','lostpointercapture'])surface.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
  return {reset,get active(){return pointer!==null;},get dragging(){return dragging;}};
}
