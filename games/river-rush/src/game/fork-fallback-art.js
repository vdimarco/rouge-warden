import {FORK_PALETTES,islandSurfaceTile} from './fork-art-direction.js';

const TAU=Math.PI*2;
const hash=n=>{let v=Math.imul(n^0x614bc83,1597334677);v=Math.imul(v^(v>>>16),2246822519);return((v^(v>>>13))>>>0)/4294967296;};
const make=(createCanvas,w,h,paint)=>{const canvas=createCanvas();canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'));return canvas;};
const rgb=hex=>[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16));
const smooth=(a,b,n)=>{const t=Math.max(0,Math.min(1,(n-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t);

// These seamless material and alpha-mask cards are prepared once with the
// rider art. Running, changing map and pausing cannot allocate new canvases.
export function prepareForkFallbackArt(art,createCanvas=()=>document.createElement('canvas')){
 const grounds=FORK_PALETTES.map((palette,map)=>make(createCanvas,256,256,ctx=>{
  const tile=islandSurfaceTile(),pixels=ctx.createImageData(tile.width,tile.height),earth=rgb(palette.earth),ridge=rgb(palette.ridge),moss=rgb(palette.moss),shore=rgb(palette.shore);
  for(let i=0;i<tile.data.length;i+=4){
   const broad=tile.data[i]/255,medium=tile.data[i+1]/255,fine=tile.data[i+2]/255;
   let color=mix(earth,ridge,smooth(.23,.76,broad));color=mix(color,moss,smooth(.6,.85,medium)*(map===1?.14:.5));color=mix(color,shore,smooth(.68,.88,broad)*.3);
   const grain=.86+fine*.28;for(let c=0;c<3;c++)pixels.data[i+c]=Math.round(color[c]*grain);pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  // Keep the ground periodic: the detailed rock atlas is not seamless and
  // belongs on the separate clump cards rather than this repeating material.
  for(let i=0;i<190;i++){
   const x=hash(i*17+19)*256,y=hash(i*23+47)*256,size=.3+hash(i*31)*1.4;
   ctx.globalAlpha=.14+hash(i+71)*.19;ctx.fillStyle=i%3===0?palette.wet:palette.stone;
   ctx.beginPath();ctx.ellipse(x,y,size,size*.58,hash(i+37)*TAU,0,TAU);ctx.fill();
  }
  ctx.globalAlpha=1;
 }));
 const rocks=FORK_PALETTES.map(palette=>make(createCanvas,430,355,ctx=>{
  ctx.drawImage(art.sprites,0,545,430,355,0,0,430,355);
  ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=.53;ctx.fillStyle=palette.stone;ctx.fillRect(0,0,430,355);
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 }));
 const plants=FORK_PALETTES.map((palette,map)=>make(createCanvas,384,256,ctx=>{
  ctx.drawImage(art.branchLeaves,0,0,384,256);
  ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=map===2?.64:.25;ctx.fillStyle=palette.moss;ctx.fillRect(0,0,384,256);
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 }));
 return{grounds,rocks,plants};
}
