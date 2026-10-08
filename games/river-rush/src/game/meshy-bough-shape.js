// The generated prop's thick cut end is +X. Fit its stem to the existing
// rooted duck tree; broad upper forks keep their original asymmetric topology.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function boughFrame(shape){
 return shape.meshFrame;
}
export const MESHY_BOUGH_CORE_END=.5;
export const MESHY_BOUGH_SCALE=Object.freeze({y:2.6,under:.5,d:1.1,contactD:1.1,twigs:1.3,depthStart:.3,depthSpan:.42});
export function boughVertex(vertex,shape,scale=MESHY_BOUGH_SCALE){
 const sourceT=clamp(vertex.x,0,1),t=Math.min(sourceT/MESHY_BOUGH_CORE_END,1),u=1-t,p=boughFrame(shape),out={};
 for(const k of ['x','y','d'])out[k]=u*u*u*p[0][k]+3*u*u*t*p[1][k]+3*u*t*t*p[2][k]+t*t*t*p[3][k];
 if(sourceT>MESHY_BOUGH_CORE_END)out.x-=shape.side*(sourceT-MESHY_BOUGH_CORE_END)*scale.twigs;
 // Preserve upper forks and smoothly narrow their depth toward the duck
 // contact. Native downward twigs use compact offsets, never planar slicing.
 const depthT=clamp((sourceT-scale.depthStart*MESHY_BOUGH_CORE_END)/(scale.depthSpan*MESHY_BOUGH_CORE_END),0,1),depth=scale.d+(scale.contactD-scale.d)*depthT*depthT*(3-2*depthT);
 out.y+=vertex.y*(vertex.y<0?scale.under:scale.y);out.d+=vertex.z*depth*shape.side;
 return out;
}

// Convert the downloaded geometry into root-to-tip X and offsets from a
// smooth main-stem baseline. Keep UVs/topology/materials and detailed knots.
export function normalizeBoughPositions(arrays){
 const all=arrays.flatMap(a=>Array.from({length:a.length/3},(_,i)=>[a[i*3],a[i*3+1],a[i*3+2]]));
 if(!all.length)throw new Error('Empty Meshy bough');
 const lo=[0,1,2].map(k=>Math.min(...all.map(v=>v[k]))),hi=[0,1,2].map(k=>Math.max(...all.map(v=>v[k])));
 const along=hi[0]-lo[0],height=hi[1]-lo[1],depth=hi[2]-lo[2];
 if(Math.min(along,height,depth)<1e-6)throw new Error('Degenerate Meshy bough');
 const bins=Array.from({length:16},()=>[]);
 for(const v of all)bins[clamp(Math.floor((hi[0]-v[0])/along*16),0,15)].push(v[1]);
 const baseline=bins.map(b=>{b.sort((a,b)=>a-b);return b.length?b[Math.floor((b.length-1)*.3)]:null;});
 for(let i=0;i<16;i++)if(baseline[i]===null)baseline[i]=baseline.find(v=>v!==null);
 const smooth=baseline.map((_,i)=>{
  if(i===0||i>=14)return baseline[i];
  let total=0,weight=0;for(let j=Math.max(0,i-2);j<=Math.min(15,i+2);j++){const w=3-Math.abs(j-i);total+=baseline[j]*w;weight+=w;}return total/weight;
 });
 const centerZ=(hi[2]+lo[2])*.5;
 const result=arrays.map(a=>{
  const out=new Float32Array(a.length);
  for(let i=0;i<a.length;i+=3){
   const t=clamp((hi[0]-a[i])/along,0,1),at=t*15,index=Math.min(14,Math.floor(at)),base=smooth[index]+(smooth[index+1]-smooth[index])*(at-index);
   out[i]=t;out[i+1]=(a[i+1]-base)/height;out[i+2]=(a[i+2]-centerZ)/depth;
  }
  return out;
 });
 return {arrays:result,bounds:{lo,hi},baseline:smooth};
}
