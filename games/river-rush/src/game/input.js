// First swipe is quick; extra lane steps require a deliberate longer drag.
export function readSwipe(pointer,x,y){
 if(!pointer)return null;
 const dx=x-pointer.x,dy=y-pointer.y,threshold=pointer.threshold??26;
 const horizontal=pointer.axis==='x'||Math.abs(dx)>Math.abs(dy);
 if((horizontal?Math.abs(dx):Math.abs(dy))<threshold)return null;
 return {action:horizontal?(dx>0?'right':'left'):(dy>0?'duck':'jump'),next:horizontal?{x,y,axis:'x',threshold:56}:null};
}
