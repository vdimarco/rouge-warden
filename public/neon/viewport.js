import {orientationLayout,mapViewportPoint} from './motion-frame.js';
const root=document.getElementById('gameViewport');
export const viewport={width:innerWidth,height:innerHeight,angle:0,startAngle:0,locked:false,native:false};
export function screenAngle(){return Number(screen.orientation?.angle??window.orientation??0)||0}
export function updateViewport(){
  Object.assign(viewport,orientationLayout(innerWidth,innerHeight,viewport.startAngle,screenAngle(),viewport.locked));
  root.style.width=viewport.width+'px';root.style.height=viewport.height+'px';root.style.transform=`translate(-50%,-50%) rotate(${viewport.angle}deg)`;
  root.dataset.layout=viewport.width>viewport.height?'landscape':'portrait';
}
export function viewportPoint(e){return mapViewportPoint(e.clientX,e.clientY,innerWidth,innerHeight,viewport)}
export function centeredPoint(e,element){const b=element.getBoundingClientRect(),a=-viewport.angle*Math.PI/180,x=e.clientX-(b.left+b.width/2),y=e.clientY-(b.top+b.height/2);return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)}}
export async function lockViewport(){
  if(!viewport.locked){viewport.startAngle=screenAngle();viewport.locked=true;updateViewport()}
  const type=screen.orientation?.type|| (viewport.width>viewport.height?'landscape-primary':'portrait-primary');
  try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();await screen.orientation?.lock?.(type);viewport.native=typeof screen.orientation?.lock==='function'}catch{viewport.native=false}
  // CSS compensation keeps the game layout stable if native locking is refused.
  updateViewport();return viewport.native;
}
export function unlockViewport(){viewport.locked=false;viewport.native=false;try{screen.orientation?.unlock?.()}catch{}updateViewport()}
addEventListener('resize',updateViewport);screen.orientation?.addEventListener?.('change',()=>{updateViewport();dispatchEvent(new Event('resize'))});
addEventListener('orientationchange',()=>{updateViewport();dispatchEvent(new Event('resize'))});
updateViewport();
