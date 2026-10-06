// Keep large retina viewports from multiplying every canvas draw by four.
export function renderDpr(width,height,deviceDpr=1){return Math.min(deviceDpr,2,Math.sqrt((width>=900?900000:1200000)/Math.max(1,width*height)));}
// Distance moves projected water in the same direction as course objects.
export function foamDepth(index,distance,viewDistance){const n=index*.618-distance/viewDistance;return(n-Math.floor(n))*viewDistance;}
export function riverRate(speed){return Math.max(1,Math.min(2.3,speed/30*1.12));}
