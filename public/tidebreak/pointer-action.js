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

export function abilityPointers(buttons,{enabled,onStart,onAim,onCast,onStatus=()=>{},onCancel=()=>{},onUnavailable=()=>{}}) {
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
  const start=(button,e)=>{if(pointer!==null||e.button!==0||!button||!enabled())return;if(!available(button)){onUnavailable({slot:+button.dataset.skill});return;}e.preventDefault();e.stopPropagation();onStart();pointer=e.pointerId;slot=+button.dataset.skill;origin={x:e.clientX,y:e.clientY};const rect=button.getBoundingClientRect();center={x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2,cancelRadius:Math.min(rect.right-rect.left,rect.bottom-rect.top)*.27};aim=null;aimed=cancelled=false;onAim(null);onStatus(null);button.setPointerCapture(pointer);};
  skillReach(buttons,start);
  for(const button of buttons){
    button.addEventListener('click',e=>{if(e.detail===0&&enabled()){if(available(button)){onStart();onCast({slot:+button.dataset.skill,aim:null});}else onUnavailable({slot:+button.dataset.skill});}});
    button.addEventListener('pointerdown',e=>start(nearestSkill(buttons,e.clientX,e.clientY)||button,e));
    button.addEventListener('pointermove',e=>{if(e.pointerId===pointer)update(e);});
    button.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;update(e);if(cancelled)onCancel({slot});else if(available(button))onCast({slot,aim});else if(enabled())onUnavailable({slot});reset();});
    for(const event of ['pointercancel','lostpointercapture'])button.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
  }
  return {reset};
}


export function screenMovementPointer(surface,{movement,enabled,onStart,onDragStart=()=>{},onTap=()=>{},onZoom,threshold=12,radius=46}) {
  let pointer=null,origin=null,dragging=false,pinching=false,gap=0;
  const touches=new Map();
  const separation=()=>{const [a,b]=[...touches.values()];return Math.max(8,Math.hypot(a.x-b.x,a.y-b.y));};
  const reset=()=>{pointer=null;origin=null;dragging=pinching=false;gap=0;touches.clear();movement.x=movement.y=0;};
  const update=e=>{
    if(pinching){
      if(!touches.has(e.pointerId))return;
      touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(touches.size===2&&enabled()){const next=separation();onZoom(gap/next);gap=next;}
      return;
    }
    if(e.pointerId!==pointer)return;
    const x=e.clientX-origin.x,y=e.clientY-origin.y,dist=Math.hypot(x,y);
    if(!dragging&&dist>=threshold){dragging=true;onDragStart();}
    if(!dragging)return;
    const denom=Math.max(radius,dist);
    movement.x=x/denom;movement.y=y/denom;
  };
  surface.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'||e.button!==0||!enabled())return;
    if(pointer!==null){
      if(!onZoom||e.pointerType!=='touch'||!touches.size||touches.size>=2||touches.has(e.pointerId))return;
      e.preventDefault();touches.set(e.pointerId,{x:e.clientX,y:e.clientY});surface.setPointerCapture?.(e.pointerId);
      if(!pinching){if(dragging)movement.x=movement.y=0;dragging=false;pinching=true;onDragStart();}
      gap=separation();return;
    }
    e.preventDefault();onStart();pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};dragging=false;
    if(e.pointerType==='touch')touches.set(pointer,{x:e.clientX,y:e.clientY});
    surface.setPointerCapture?.(pointer);
  });
  surface.addEventListener('pointermove',e=>{if(!pinching&&touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});update(e);});
  // Keep the surviving finger inert until the entire pinch has ended.
  const finishPinch=e=>{if(!pinching||!touches.has(e.pointerId))return false;touches.delete(e.pointerId);if(!touches.size)reset();return true;};
  surface.addEventListener('pointerup',e=>{
    if(finishPinch(e))return;
    if(e.pointerId!==pointer||pinching)return;
    if(!dragging)onTap(e);
    reset();
  });
  for(const event of ['pointercancel','lostpointercapture'])surface.addEventListener(event,e=>{if(finishPinch(e))return;if(e.pointerId===pointer&&!pinching)reset();});
  return {reset,get active(){return pointer!==null;},get dragging(){return dragging;},get pinching(){return pinching;}};
}
