// Periodic gradient noise for absolute bank coordinates. Every sample is
// scalar math: no tables, arrays, objects or mutable generation state.
export const TERRAIN_PERIOD = 64;
export const TERRAIN_RELIEF_LIMIT = 12;
export const TERRAIN_SHORE_FADE = 5;
const SQRT2=Math.SQRT2,DIAGONAL=Math.SQRT1_2;
const wrap=(value,period)=>((value%period)+period)%period;
const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
const fade=value=>value*value*value*(value*(value*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
const seedValue=seed=>wrap(Math.floor(Number.isFinite(seed)?seed:137),251);

function gradientDot(x,z,seed,dx,dz){
  // The largest hash intermediate is <1.11 million, so these integers are
  // exactly representable by GLSL float32 as well as JavaScript numbers.
  const k=wrap(x*157+z*113+seed*37,251),direction=wrap(wrap(k*k*17+k*137+seed*29,251),8);
  if(direction<4){const sign=direction<2?1:-1;return direction%2===0?sign*dx:sign*dz;}
  return DIAGONAL*((direction%2===0?1:-1)*dx+(direction<6?1:-1)*dz);
}

function noiseSample(x,z,seed,period){
  const px=wrap(x,period),pz=wrap(z,period),ix=Math.floor(px),iz=Math.floor(pz),u=px-ix,v=pz-iz;
  const nx=wrap(ix+1,period),nz=wrap(iz+1,period),fx=fade(u),fz=fade(v);
  const a=gradientDot(ix,iz,seed,u,v),b=gradientDot(nx,iz,seed,u-1,v);
  const c=gradientDot(ix,nz,seed,u,v-1),d=gradientDot(nx,nz,seed,u-1,v-1);
  return mix(mix(a,b,fx),mix(c,d,fx),fz)*SQRT2;
}

export function periodicNoise2D(x,z,seed=137,period=TERRAIN_PERIOD){
  const tile=Number.isFinite(period)?clamp(Math.floor(period),1,251):TERRAIN_PERIOD;
  return noiseSample(x,z,seedValue(seed),tile);
}

export function terrainFbm(x,z,seed=137){
  const normalized=seedValue(seed);
  return noiseSample(x,z,normalized,TERRAIN_PERIOD)*(2/3)+noiseSample(x*2+19,z*2-7,wrap(normalized+71,251),TERRAIN_PERIOD)*(1/3);
}

function terrace(value,steps){const scaled=value*steps,base=Math.floor(scaled);return(base+fade(scaled-base))/steps;}

// Distinct continuous shaping of the same two-octave field. Absolute cross
// and distance coordinates make adjacent/recycled chunks meet exactly.
export function terrainShape(cross,distance,seed=137,mapIndex=0,intensity=0){
  const n=terrainFbm(cross/32+11.25,distance/128+7.5,seed),t=clamp(.5+n*.5,0,1),gain=.85+.3*clamp(intensity,0,1);
  if(mapIndex<.5)return(.3+4*fade(t))*gain;
  if(mapIndex<1.5){const ridge=Math.max(0,1-Math.abs(n));return(.8+7.2*ridge*ridge+2.1*terrace(t,6))*gain;}
  const broken=Math.max(0,1-Math.abs(n*1.6+.15));return(.5+5.7*terrace(t,4)+2*broken*broken)*gain;
}

export function bankTerrainOffset(cross,distance,halfWidth,seed=137,mapIndex=0,intensity=0){
  const outside=Math.abs(cross)-halfWidth;if(outside<=0)return 0;
  return terrainShape(cross,distance,seed,mapIndex,intensity)*fade(clamp(outside/TERRAIN_SHORE_FADE,0,1));
}

// Explicit seed/profile arguments let each shader share the CPU function
// without adding a global terrain state or uniforms of its own. The caller
// supplies its normalized uSeed, map index and smooth course intensity.
export const TERRAIN_GLSL=`
float tnFade(float t){return t*t*t*(t*(t*6.-15.)+10.);}
float tnGradDot(vec2 cell,float seed,vec2 delta){
 float k=mod(cell.x*157.+cell.y*113.+seed*37.,251.),direction=mod(mod(k*k*17.+k*137.+seed*29.,251.),8.);
 if(direction<4.){float s=direction<2.?1.:-1.;return mod(direction,2.)<.5?s*delta.x:s*delta.y;}
 return ${DIAGONAL}*((mod(direction,2.)<.5?1.:-1.)*delta.x+(direction<6.?1.:-1.)*delta.y);
}
float tnNoise(vec2 p,float seed,float period){
 float tile=clamp(floor(period),1.,251.);vec2 q=mod(p,tile),cell=floor(q),f=q-cell,next=mod(cell+1.,tile);
 seed=mod(floor(seed),251.);vec2 ease=vec2(tnFade(f.x),tnFade(f.y));
 float a=tnGradDot(cell,seed,f),b=tnGradDot(vec2(next.x,cell.y),seed,f-vec2(1.,0.));
 float c=tnGradDot(vec2(cell.x,next.y),seed,f-vec2(0.,1.)),d=tnGradDot(next,seed,f-vec2(1.,1.));
 return mix(mix(a,b,ease.x),mix(c,d,ease.x),ease.y)*${SQRT2};
}
float tnFbm(vec2 p,float seed){seed=mod(floor(seed),251.);return tnNoise(p,seed,${TERRAIN_PERIOD}.)*${2/3}+tnNoise(p*2.+vec2(19.,-7.),mod(seed+71.,251.),${TERRAIN_PERIOD}.)*${1/3};}
float tnTerrace(float value,float steps){float scaled=value*steps,base=floor(scaled);return(base+tnFade(scaled-base))/steps;}
float tnShape(float cross,float d,float seed,float mapIndex,float intensity){
 float n=tnFbm(vec2(cross/32.+11.25,d/128.+7.5),seed),t=clamp(.5+n*.5,0.,1.),gain=.85+.3*clamp(intensity,0.,1.);
 if(mapIndex<.5)return(.3+4.*tnFade(t))*gain;
 if(mapIndex<1.5){float ridge=max(0.,1.-abs(n));return(.8+7.2*ridge*ridge+2.1*tnTerrace(t,6.))*gain;}
 float broken=max(0.,1.-abs(n*1.6+.15));return(.5+5.7*tnTerrace(t,4.)+2.*broken*broken)*gain;
}
float tnBankOffset(float cross,float d,float halfWidth,float seed,float mapIndex,float intensity){
 float outside=abs(cross)-halfWidth;if(outside<=0.)return 0.;return tnShape(cross,d,seed,mapIndex,intensity)*tnFade(clamp(outside/${TERRAIN_SHORE_FADE}.,0.,1.));
}
`;
