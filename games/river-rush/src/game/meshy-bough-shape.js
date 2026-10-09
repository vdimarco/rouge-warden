import {riverBankHeight} from './river-course.js';
import {forkLaneCross} from './river-forks.js';
// The complete native oak keeps its authored trunk, crooked limb and forks.
// Placement is affine; the only deformation gently seats the bank root into
// terrain, and fades out before the river-facing limb begins.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Measured lower wood cross sections of Meshy job 01a11ba8-a049-7631-9a50-d06f57b957d8.
export const NATIVE_OAK_ANATOMY=Object.freeze({
 "extent": 1,
 "shaftY": 0.14844685886934658,
 "shaftZ": 0.07175104407902072,
 "rootFade": 0.25,
 "shaft": [
  {
   "x": 0.35,
   "y": 0.1582336626034519,
   "z": 0.052650987312214945,
   "yMin": 0.13613691089900548,
   "yMax": 0.18033041430789834,
   "zMin": 0.027326593438445696,
   "zMax": 0.0779753811859842,
   "segments": 25,
   "wood": 1
  },
  {
   "x": 0.4,
   "y": 0.14226053042146003,
   "z": 0.06525670244659547,
   "yMin": 0.1155883151420408,
   "yMax": 0.16893274570087924,
   "zMin": 0.04434863219087312,
   "zMax": 0.08616477270231782,
   "segments": 24,
   "wood": 1
  },
  {
   "x": 0.45,
   "y": 0.111606411540105,
   "z": 0.07792235882106611,
   "yMin": 0.08967710450146568,
   "yMax": 0.13353571857874433,
   "zMin": 0.05671704119408979,
   "zMax": 0.09912767644804243,
   "segments": 23,
   "wood": 1
  },
  {
   "x": 0.5,
   "y": 0.0937438413306059,
   "z": 0.10144016249910828,
   "yMin": 0.07396352445060418,
   "yMax": 0.1135241582106076,
   "zMin": 0.06688304477389996,
   "zMax": 0.1359972802243166,
   "segments": 24,
   "wood": 1
  },
  {
   "x": 0.55,
   "y": 0.1012966991646936,
   "z": 0.07982319989281665,
   "yMin": 0.08403696557692583,
   "yMax": 0.11855643275246136,
   "zMin": 0.058700321100234,
   "zMax": 0.1009460786853993,
   "segments": 22,
   "wood": 0.9848484848484849
  },
  {
   "x": 0.6,
   "y": 0.13231616311439073,
   "z": 0.06834216739513213,
   "yMin": 0.1115177816213676,
   "yMax": 0.15311454460741386,
   "zMin": 0.048859493525292244,
   "zMax": 0.08782484126497202,
   "segments": 20,
   "wood": 1
  },
  {
   "x": 0.65,
   "y": 0.16465105622409212,
   "z": 0.06979766094118509,
   "yMin": 0.149781696807813,
   "yMax": 0.17952041564037124,
   "zMin": 0.04828437636837,
   "zMax": 0.09131094551400018,
   "segments": 19,
   "wood": 1
  },
  {
   "x": 0.7,
   "y": 0.1772183864513735,
   "z": 0.06716478388040603,
   "yMin": 0.16005533825813453,
   "yMax": 0.1943814346446125,
   "zMin": 0.0511430931553208,
   "zMax": 0.08318647460549125,
   "segments": 25,
   "wood": 0.9600000000000002
  },
  {
   "x": 0.75,
   "y": 0.1627935565006407,
   "z": 0.06740145210378815,
   "yMin": 0.13597225926311177,
   "yMax": 0.18961485373816966,
   "zMin": 0.044097651784886706,
   "zMax": 0.09070525242268959,
   "segments": 46,
   "wood": 0.8768115942028986
  },
  {
   "x": 0.8,
   "y": 0.16431979456880857,
   "z": 0.06929454436075515,
   "yMin": 0.15525725124177606,
   "yMax": 0.17338233789584107,
   "zMin": 0.059983571828802436,
   "zMax": 0.07860551689270785,
   "segments": 11,
   "wood": 1
  },
  {
   "x": 0.85,
   "y": 0.168363014363286,
   "z": 0.06255916276980045,
   "yMin": 0.16132034664173472,
   "yMax": 0.17540568208483726,
   "zMin": 0.054382521370555326,
   "zMax": 0.07073580416904555,
   "segments": 11,
   "wood": 0.9696969696969696
  },
  {
   "x": 0.9,
   "y": 0.16181376173073678,
   "z": 0.07360218430467078,
   "yMin": 0.1563746515643455,
   "yMax": 0.16725287189712806,
   "zMin": 0.06712390802978203,
   "zMax": 0.0800804605795595,
   "segments": 10,
   "wood": 1
  },
  {
   "x": 0.94,
   "y": 0.163208658013781,
   "z": 0.08473151644420282,
   "yMin": 0.16137732594618412,
   "yMax": 0.1650399900813779,
   "zMin": 0.08130016803251465,
   "zMax": 0.08816286485589099,
   "segments": 7,
   "wood": 1
  },
  {
   "x": 0.96,
   "y": 0.16419425056538978,
   "z": 0.05386146379645259,
   "yMin": 0.16210426475759565,
   "yMax": 0.16628423637318387,
   "zMin": 0.051566335764496096,
   "zMax": 0.05615659182840908,
   "segments": 7,
   "wood": 1
  },
  {
   "x": 0.98,
   "y": 0.16428357173360203,
   "z": 0.05682291581788525,
   "yMin": 0.1622064161536254,
   "yMax": 0.16636072731357865,
   "zMin": 0.05391914333723527,
   "zMax": 0.059726688298535224,
   "segments": 8,
   "wood": 0.7083333333333334
  }
 ],
 "source": "Measured actual native triangle-plane cross sections after uniform native-to-root transform; brown/gray texture-supported lower woody loops, upper canopy excluded",
 "terminalNote": "Native main limb forks near x0.75. Lower terminal path tapers to fine connected twigs by x0.94\u20130.98; preserve those vertices in Lite rather than inflate or collapse them.",
 "verticalScaleLimit": 12
});
export function nativeOakShaft(x,anatomy=NATIVE_OAK_ANATOMY){
 const stations=anatomy.shaft;
 if(x<=stations[0].x)return {...stations[0],x};
 for(let i=1;i<stations.length;i++)if(x<=stations[i].x){const a=stations[i-1],b=stations[i],t=(x-a.x)/(b.x-a.x);return{x,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};}
 return {...stations.at(-1),x};
}
const frames=new WeakMap();
export function boughFrame(shape,anatomy=NATIVE_OAK_ANATOMY){
 const saved=frames.get(shape);if(saved?.anatomy===anatomy)return saved;
 const xScale=(shape.nativeReach-shape.root.x)/anatomy.extent;
 const nativeXs=shape.span.lanes.map(lane=>(forkLaneCross(lane,shape.course,shape.profile)-shape.root.x)/xScale);
 const nativeShafts=nativeXs.map(x=>nativeOakShaft(x,anatomy));
 const mean=(values)=>values.reduce((n,v)=>n+v,0)/values.length;
 const nativeYs=nativeShafts.map(p=>p.y),heightRange=Math.max(...nativeYs)-Math.min(...nativeYs);
 const yScale=Math.min(Math.abs(xScale),anatomy.verticalScaleLimit??12,heightRange>.0001?.78/heightRange:Infinity);
 const bodyY=3.26-yScale*mean(nativeYs);
 const zScale=Math.min(Math.abs(xScale),yScale)*(1+(shape.variation-.5)*.05);
 const depthDirection=shape.side<0?1:-1;
 const meanX=mean(nativeXs),meanZ=mean(nativeShafts.map(p=>p.z));
 const axisX={x:xScale,y:0,d:(-shape.root.d-meanZ*zScale*depthDirection)/meanX};
 const axisY={x:0,y:yScale,d:0},axisZ={x:0,y:0,d:zScale*depthDirection};
 const frame={origin:{x:shape.root.x,y:bodyY,d:shape.root.d},axisX,axisY,axisZ,rootLift:shape.root.y-bodyY,rootFade:anatomy.rootFade,nativeXs,anatomy};
 frames.set(shape,frame);return frame;
}
export function boughVertex(vertex,shape,anatomy=NATIVE_OAK_ANATOMY){
 const frame=boughFrame(shape,anatomy),out={...frame.origin};
 for(const k of ['x','y','d'])out[k]+=vertex.x*frame.axisX[k]+vertex.y*frame.axisY[k]+vertex.z*frame.axisZ[k];
 const t=clamp(vertex.x/frame.rootFade,0,1);
 const rootWeight=1-t*t*(3-2*t);out.y+=frame.rootLift*rootWeight;
 const footT=clamp((vertex.y-.006)/.019,0,1),seatWeight=rootWeight*(1-footT*footT*(3-2*footT));
 if(seatWeight>0)out.y+=(riverBankHeight(out.x,shape.course+out.d,shape.profile)-shape.root.y)*seatWeight;
 return out;
}
export function nativeOakContacts(shape,anatomy=NATIVE_OAK_ANATOMY){
 const frame=boughFrame(shape,anatomy);
 return shape.span.lanes.map((lane,i)=>({lane,...boughVertex(nativeOakShaft(frame.nativeXs[i],anatomy),shape,anatomy)}));
}
// Packing applies exactly one positive uniform transform. It keeps native
// proportions and curvature; no main-stem baseline is subtracted.
export function normalizeBoughPositions(arrays){
 const all=arrays.flatMap(a=>Array.from({length:a.length/3},(_,i)=>[a[i*3],a[i*3+1],a[i*3+2]]));
 if(!all.length)throw new Error('Empty Meshy tree');
 const lo=[0,1,2].map(k=>Math.min(...all.map(v=>v[k]))),hi=[0,1,2].map(k=>Math.max(...all.map(v=>v[k])));
 const scale=1/(hi[0]-lo[0]);if(!Number.isFinite(scale)||scale<=0)throw new Error('Degenerate Meshy tree');
 const root=[lo[0],lo[1],(lo[2]+hi[2])*.5];
 return {arrays:arrays.map(a=>Float32Array.from(a,(v,i)=>(v-root[i%3])*scale)),bounds:{lo,hi},uniformScale:scale,root};
}
