// A second touch is not guaranteed to dispatch click. Activate its own captured release.
export function pointerAction(button, action, enabled=()=>!button.disabled) {
  let pointer=null,origin;
  button.addEventListener('pointerdown',e=>{e.stopPropagation();if(pointer!==null||e.button!==0||!enabled())return;e.preventDefault();pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};button.setPointerCapture(pointer);});
  button.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;const rect=button.getBoundingClientRect(),inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;pointer=null;if(inside&&enabled()&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)<24)action();});
  for(const event of ['pointercancel','lostpointercapture'])button.addEventListener(event,e=>{if(e.pointerId===pointer)pointer=null;});
  button.addEventListener('click',e=>{if(e.detail===0&&enabled())action();});
}

export function movementPointer(pad,{movement,thumb,enabled,onStart}) {
  let pointer=null,origin;
  const reset=()=>{pointer=null;movement.x=movement.y=0;thumb.style.transform='';pad.classList.remove('active');};
  const move=e=>{if(e.pointerId!==pointer)return;const x=e.clientX-origin.x,y=e.clientY-origin.y,d=Math.max(1,Math.hypot(x,y)/38);movement.x=x/d/38;movement.y=y/d/38;thumb.style.transform=`translate(${movement.x*29}px,${movement.y*29}px)`;};
  pad.addEventListener('pointerdown',e=>{if(pointer!==null||!enabled())return;e.preventDefault();onStart();pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};pad.classList.add('active');pad.setPointerCapture(pointer);move(e);});
  pad.addEventListener('pointermove',move);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
  return {reset};
}

export function abilityPointers(buttons,{enabled,onStart,onAim,onCast}) {
  let pointer=null,origin,slot,aim=null;
  const reset=()=>{pointer=null;slot=null;aim=null;onAim(null);};
  for(const button of buttons){
    const available=()=>enabled()&&button.getAttribute('aria-disabled')!=='true';
    button.addEventListener('click',e=>{if(e.detail===0&&available()){onStart();onCast({slot:+button.dataset.skill,aim:null});}});
    button.addEventListener('pointerdown',e=>{if(pointer!==null||!available())return;e.preventDefault();onStart();pointer=e.pointerId;slot=+button.dataset.skill;origin={x:e.clientX,y:e.clientY};aim=null;onAim(null);button.setPointerCapture(pointer);});
    button.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;const x=e.clientX-origin.x,y=e.clientY-origin.y;aim=Math.hypot(x,y)>12?{x,y}:null;onAim(aim);});
    button.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;if(available())onCast({slot,aim});reset();});
    for(const event of ['pointercancel','lostpointercapture'])button.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
  }
  return {reset};
}
