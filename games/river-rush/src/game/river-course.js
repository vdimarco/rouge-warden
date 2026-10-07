// One deterministic course profile for CPU placement, buoyancy and GPU geometry.
// Small integer hashes are exactly representable in GLSL float arithmetic.
import {courseIntensity,intensityDerivative,intensityIntegral,INTENSITY_GLSL} from './course-intensity.js';
import {bankTerrainOffset,TERRAIN_GLSL} from './terrain-noise.js';
import {terrainSection,SECTIONS_GLSL} from './course-sections.js';
const mod=(x,n)=>((x%n)+n)%n;
export const riverSeed=seed=>mod(typeof seed==='object'?seed?.seed??137:seed??137,251);
export function createCourseProfile(seed=137,length=0,mapIndex=0){return Object.freeze({seed:riverSeed(seed),length:Number.isFinite(length)?Math.max(0,length):0,mapIndex:Math.max(0,Math.min(2,Math.trunc(mapIndex)||0))});}
const profiled=seed=>typeof seed==='object'&&seed?.length>0;
export const riverIntensity=(d,seed=137)=>profiled(seed)?courseIntensity(d,seed.length,seed.mapIndex):0;
export const riverIntensityDerivative=(d,seed=137)=>profiled(seed)?intensityDerivative(d,seed.length,seed.mapIndex):0;
export function riverHash(n,seed=137){const k=mod(n,251);return mod(k*k*17+k*137+riverSeed(seed)*29,251)/250;}
export function riverNoise(x,seed=137){const i=Math.floor(x),u=x-i,s=u*u*(3-2*u);return (riverHash(i,seed)+(riverHash(i+1,seed)-riverHash(i,seed))*s)*2-1;}
function noiseDerivative(x,seed){const i=Math.floor(x),u=x-i;return (riverHash(i+1,seed)-riverHash(i,seed))*12*u*(1-u);}
const smooth=u=>{const t=Math.max(0,Math.min(1,u));return t*t*(3-2*t);};
function baseCenter(d,seed){return riverNoise(d/137+19,seed)*8+Math.sin(d*.023+riverSeed(seed)*.031)*9+riverNoise(d/331+73,seed)*4;}
function baseTangent(d,seed){return noiseDerivative(d/137+19,seed)*8/137+Math.cos(d*.023+riverSeed(seed)*.031)*.207+noiseDerivative(d/331+73,seed)*4/331;}
export function riverCenter(d,seed=137){const base=baseCenter(d,seed);if(!profiled(seed))return base;const s=riverIntensity(d,seed),broad=Math.sin(d*.0107+riverSeed(seed)*.047)*4.5+riverNoise(d/229+6,seed)*3.5;return base*(.52+.68*s)+broad*s;}
export function riverTangent(d,seed=137){const tangent=baseTangent(d,seed);if(!profiled(seed))return tangent;const s=riverIntensity(d,seed),ds=riverIntensityDerivative(d,seed),broad=Math.sin(d*.0107+riverSeed(seed)*.047)*4.5+riverNoise(d/229+6,seed)*3.5,broadD=Math.cos(d*.0107+riverSeed(seed)*.047)*.04815+noiseDerivative(d/229+6,seed)*3.5/229;return tangent*(.52+.68*s)+baseCenter(d,seed)*.68*ds+broadD*s+broad*ds;}
export function riverHalfWidth(d,seed=137){if(!profiled(seed))return 17+riverNoise(d/61.7+31,seed)*2.8+riverNoise(d/193+87,seed)*2.4-rapidAt(d,seed)*1.2;const s=riverIntensity(d,seed),rapid=rapidAt(d,seed),section=terrainSection(d,seed),bias=section.type==='narrows'?-(3.1+.8*s):section.type==='wave-train'?-1.1:.7;return Math.max(11.8,Math.min(26.5,18.2+riverNoise(d/61.7+31,seed)*(1.6+s*.9)+riverNoise(d/193+87,seed)*2.6+(1-rapid)*3.2-rapid*(.5+s*1.5)+bias*section.strength));}
function dropBudget(cell,seed,span){return 2.55*cell+4.3/span*intensityIntegral(cell*span,seed.length,seed.mapIndex);}
export function chuteAt(d,seed=137){
 if(profiled(seed)){
  const span=150-seed.mapIndex*12,cell=Math.floor(d/span),along=d-cell*span,start=18+riverHash(cell+43,seed)*30,length=26+riverHash(cell+91,seed)*16-4*riverIntensity(cell*span,seed);
  const amplitude=dropBudget(cell+1,seed,span)-dropBudget(cell,seed,span)+1.1*(riverHash(cell+1,seed)-riverHash(cell,seed));
  return {cell,along,start,length,amplitude,u:(along-start)/length,span};
 }
 const cell=Math.floor(d/130),along=d-cell*130,start=25+riverHash(cell+43,seed)*36,length=23+riverHash(cell+91,seed)*13;
 const amplitude=4.1+1.8*(riverHash(cell+1,seed)-riverHash(cell,seed)),u=(along-start)/length;
 return {cell,along,start,length,amplitude,u};
}
export function riverElevation(d,seed=137){const c=chuteAt(d,seed);return profiled(seed)?-.02*d-(dropBudget(c.cell,seed,c.span)+1.1*(riverHash(c.cell,seed)-riverHash(0,seed))+c.amplitude*smooth(c.u)):-.022*d-(4.1*c.cell+1.8*(riverHash(c.cell,seed)-riverHash(0,seed))+c.amplitude*smooth(c.u));}
export function riverGrade(d,seed=137){const c=chuteAt(d,seed),u=Math.max(0,Math.min(1,c.u));return (profiled(seed)?-.02:-.022)-c.amplitude*6*u*(1-u)/c.length;}
function pulseDerivative(u,width){return u>0&&u<1?6*u*(1-u)/width:0;}
function recoveryAt(d,seed){const cell=Math.floor(d/320),along=d-cell*320,start=35+riverHash(cell+117,seed)*60,length=35+riverHash(cell+173,seed)*45,u=(along-start)/20,v=(along-start-length)/30,a=smooth(u),b=1-smooth(v);return {pulse:a*b,derivative:pulseDerivative(u,20)*b-a*pulseDerivative(v,30)};}
function sectionRapid(d,seed,rapid,derivative=0){const section=terrainSection(d,seed),s=riverIntensity(d,seed),ds=riverIntensityDerivative(d,seed),kind=section.type,scale=kind==='wave-train'?.75:kind==='narrows'?.45:.7,target=kind==='wave-train'?.94*s:kind==='narrows'?.14+.43*s:.055+.10*s,targetD=(kind==='wave-train'?.94:kind==='narrows'?.43:.10)*ds,q=section.strength*scale,dq=section.derivative*scale;return{value:rapid+(target-rapid)*q,derivative:derivative*(1-q)+(target-rapid)*dq+targetD*q};}
export function rapidAt(d,seed=137){const c=chuteAt(d,seed),a=smooth((c.along-c.start+12)/16),b=1-smooth((c.along-c.start-c.length-8)/24);if(!profiled(seed))return .12+.88*a*b;const s=riverIntensity(d,seed),base=.045+.105*s,recovery=recoveryAt(d,seed),gain=1-(.45-.2*s)*recovery.pulse;return sectionRapid(d,seed,base+(1-base)*(.3+.7*s)*gain*a*b).value;}
export function rapidDerivative(d,seed=137){const c=chuteAt(d,seed),u=(c.along-c.start+12)/16,v=(c.along-c.start-c.length-8)/24,a=smooth(u),b=1-smooth(v),dp=pulseDerivative(u,16)*b-a*pulseDerivative(v,24);if(!profiled(seed))return .88*dp;const s=riverIntensity(d,seed),ds=riverIntensityDerivative(d,seed),base=.045+.105*s,db=.105*ds,recovery=recoveryAt(d,seed),gain=1-(.45-.2*s)*recovery.pulse,dg=.2*ds*recovery.pulse-(.45-.2*s)*recovery.derivative,q=.3+.7*s,amp=(1-base)*q*gain,rapid=base+amp*a*b,derivative=db+(-db*q*gain+(1-base)*(.7*ds*gain+q*dg))*a*b+amp*dp;return sectionRapid(d,seed,rapid,derivative).derivative;}
export function riverPoint(origin,course,cross=0,seed=137){const ahead=course-origin;return {x:cross+riverCenter(course,seed)-riverCenter(origin,seed)-riverTangent(origin,seed)*ahead,y:riverElevation(course,seed)-riverElevation(origin,seed),z:-ahead};}
export function riverBankHeight(cross,course,seed=137){const width=riverHalfWidth(course,seed),across=Math.max(0,(Math.abs(cross)-width)/32),s=riverIntensity(course,seed),profileOn=profiled(seed);return .16+Math.pow(across,.8)*(6+riverNoise(course/103+77,seed)*2)*(profileOn?1+s*.6:1)+riverNoise(course/29+across*3,seed)*1.5*Math.min(1,across*3)*(profileOn ? .65+s*.55 : 1)+bankTerrainOffset(cross,course,width,riverSeed(seed),profileOn?seed.mapIndex:0,s);}
export function shoalAt(n,seed=137){const d=n*34+8+riverHash(n+17,seed)*18,side=riverHash(n+53,seed)>.5?1:-1;return {d,side,x:side*(riverHalfWidth(d,seed)-.65),size:.7+riverHash(n+79,seed)*1.1};}

export const COURSE_GLSL=`
uniform float uSeed,uDistance;
${INTENSITY_GLSL}
${TERRAIN_GLSL}
float rHash(float n){float k=mod(n,251.);return mod(k*k*17.+k*137.+uSeed*29.,251.)/250.;}
float rNoise(float x){float i=floor(x),u=fract(x);return mix(rHash(i),rHash(i+1.),u*u*(3.-2.*u))*2.-1.;}
float rNoiseD(float x){float i=floor(x),u=fract(x);return (rHash(i+1.)-rHash(i))*12.*u*(1.-u);}
float rSmooth(float u){u=clamp(u,0.,1.);return u*u*(3.-2.*u);}
float rBaseCenter(float d){return rNoise(d/137.+19.)*8.+sin(d*.023+uSeed*.031)*9.+rNoise(d/331.+73.)*4.;}
float rBaseTangent(float d){return rNoiseD(d/137.+19.)*8./137.+cos(d*.023+uSeed*.031)*.207+rNoiseD(d/331.+73.)*4./331.;}
float rCenter(float d){float b=rBaseCenter(d);if(uCourseLength<=0.)return b;float s=rIntensity(d),broad=sin(d*.0107+uSeed*.047)*4.5+rNoise(d/229.+6.)*3.5;return b*(.52+.68*s)+broad*s;}
float rTangent(float d){float tangent=rBaseTangent(d);if(uCourseLength<=0.)return tangent;float s=rIntensity(d),ds=rIntensityD(d),broad=sin(d*.0107+uSeed*.047)*4.5+rNoise(d/229.+6.)*3.5,broadD=cos(d*.0107+uSeed*.047)*.04815+rNoiseD(d/229.+6.)*3.5/229.;return tangent*(.52+.68*s)+rBaseCenter(d)*.68*ds+broadD*s+broad*ds;}
float rSpan(){return uCourseLength>0.?150.-clamp(uCourseMap,0.,2.)*12.:130.;}
float rBudget(float cell){float span=rSpan();return 2.55*cell+4.3/span*rIntegral(cell*span);}
vec4 rChute(float d){float span=rSpan(),cell=floor(d/span),along=d-cell*span;
 float start=uCourseLength>0.?18.+rHash(cell+43.)*30.:25.+rHash(cell+43.)*36.;
 float len=uCourseLength>0.?26.+rHash(cell+91.)*16.-4.*rIntensity(cell*span):23.+rHash(cell+91.)*13.;return vec4(cell,along,start,len);}
float rAmplitude(float cell){return uCourseLength>0.?rBudget(cell+1.)-rBudget(cell)+1.1*(rHash(cell+1.)-rHash(cell)):4.1+1.8*(rHash(cell+1.)-rHash(cell));}
float rElevation(float d){vec4 c=rChute(d);float amp=rAmplitude(c.x);if(uCourseLength<=0.)return -.022*d-(4.1*c.x+1.8*(rHash(c.x)-rHash(0.))+amp*rSmooth((c.y-c.z)/c.w));return -.02*d-(rBudget(c.x)+1.1*(rHash(c.x)-rHash(0.))+amp*rSmooth((c.y-c.z)/c.w));}
float rGrade(float d){vec4 c=rChute(d);float u=clamp((c.y-c.z)/c.w,0.,1.);return (uCourseLength>0.?-.02:-.022)-rAmplitude(c.x)*6.*u*(1.-u)/c.w;}
float rPulseD(float u,float width){return u>0.&&u<1.?6.*u*(1.-u)/width:0.;}
${SECTIONS_GLSL}
vec2 rRecovery(float d){float cell=floor(d/320.),along=d-cell*320.,start=35.+rHash(cell+117.)*60.,len=35.+rHash(cell+173.)*45.,u=(along-start)/20.,v=(along-start-len)/30.,a=rSmooth(u),b=1.-rSmooth(v);return vec2(a*b,rPulseD(u,20.)*b-a*rPulseD(v,30.));}
vec2 rSectionRapid(float d,float rapid,float derivative){vec3 section=rSection(d);float s=rIntensity(d),ds=rIntensityD(d),kind=section.x,scale=kind<.5?.45:kind<1.5?.75:.7,target=kind<.5?.14+.43*s:kind<1.5?.94*s:.055+.10*s,targetD=(kind<.5?.43:kind<1.5?.94:.10)*ds,q=section.y*scale,dq=section.z*scale;return vec2(rapid+(target-rapid)*q,derivative*(1.-q)+(target-rapid)*dq+targetD*q);}
float rRapid(float d){vec4 c=rChute(d);float pulse=rSmooth((c.y-c.z+12.)/16.)*(1.-rSmooth((c.y-c.z-c.w-8.)/24.));if(uCourseLength<=0.)return .12+.88*pulse;float s=rIntensity(d),base=.045+.105*s,gain=1.-(.45-.2*s)*rRecovery(d).x;return rSectionRapid(d,base+(1.-base)*(.3+.7*s)*gain*pulse,0.).x;}
float rRapidD(float d){vec4 c=rChute(d);float u=(c.y-c.z+12.)/16.,v=(c.y-c.z-c.w-8.)/24.,a=rSmooth(u),b=1.-rSmooth(v),dp=rPulseD(u,16.)*b-a*rPulseD(v,24.);if(uCourseLength<=0.)return .88*dp;float s=rIntensity(d),ds=rIntensityD(d),base=.045+.105*s,db=.105*ds;vec2 rec=rRecovery(d);float gain=1.-(.45-.2*s)*rec.x,dg=.2*ds*rec.x-(.45-.2*s)*rec.y,q=.3+.7*s,amp=(1.-base)*q*gain,rapid=base+amp*a*b,derivative=db+(-db*q*gain+(1.-base)*(.7*ds*gain+q*dg))*a*b+amp*dp;return rSectionRapid(d,rapid,derivative).y;}
float rWidth(float d){float rapid=rRapid(d);if(uCourseLength<=0.)return 17.+rNoise(d/61.7+31.)*2.8+rNoise(d/193.+87.)*2.4-rapid*1.2;float s=rIntensity(d);vec3 section=rSection(d);float bias=section.x<.5?-(3.1+.8*s):section.x<1.5?-1.1:.7;return clamp(18.2+rNoise(d/61.7+31.)*(1.6+s*.9)+rNoise(d/193.+87.)*2.6+(1.-rapid)*3.2-rapid*(.5+s*1.5)+bias*section.y,11.8,26.5);}
float rLocalX(float d){return rCenter(d)-rCenter(uDistance)-rTangent(uDistance)*(d-uDistance);}
float rLocalY(float d){return rElevation(d)-rElevation(uDistance);}
float rBank(float cross,float d){float width=rWidth(d),a=max(0.,(abs(cross)-width)/32.),s=rIntensity(d),profileOn=step(.5,uCourseLength);return .16+pow(a,.8)*(6.+rNoise(d/103.+77.)*2.)*mix(1.,1.+s*.6,profileOn)+rNoise(d/29.+a*3.)*1.5*min(1.,a*3.)*mix(1.,.65+s*.55,profileOn)+tnBankOffset(cross,d,width,uSeed,uCourseMap*profileOn,s);}
`;
