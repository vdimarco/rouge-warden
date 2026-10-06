// Keep large retina viewports from multiplying every canvas draw by four.
export function renderDpr(width,height,deviceDpr=1){return Math.min(deviceDpr,2,Math.sqrt((width>=900?600000:900000)/Math.max(1,width*height)));}
// Distance moves projected water in the same direction as course objects.
export function foamDepth(index,distance,viewDistance){const n=index*.618-distance/viewDistance;return(n-Math.floor(n))*viewDistance;}
export function riverRate(speed){return Math.max(1,Math.min(1.25,1+(speed/42-1)*.15));}
// Back off fill rate on sustained slow GPU frames; restore detail cautiously.
// Startup compilation, pause gaps and hidden-page frames never set quality.
export function createFrameBudget(){return {scale:1,samples:0,total:0,meanMs:0,warm:0,fastWindows:0};}
export function sampleFrameBudget(b,ms){
  if(!Number.isFinite(ms)||ms<3||ms>1000)return false;
  if(b.warm++<24)return false;
  b.total+=ms;if(++b.samples<30)return false;
  b.meanMs=b.total/b.samples;b.total=0;b.samples=0;
  const before=b.scale;
  if(b.meanMs>21.5){b.scale=Math.max(.55,b.scale*.9);b.fastWindows=0;}
  else if(b.meanMs<17.8){if(++b.fastWindows>=6){b.scale=Math.min(1,b.scale*1.04);b.fastWindows=0;}}
  else b.fastWindows=0;
  return b.scale!==before;
}
