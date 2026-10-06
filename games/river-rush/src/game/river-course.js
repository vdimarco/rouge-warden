// One deterministic course profile for CPU placement, buoyancy and GPU geometry.
// Small integer hashes are exactly representable in GLSL float arithmetic.
const mod=(x,n)=>((x%n)+n)%n;
export const riverSeed=seed=>mod(seed??137,251);
export function riverHash(n,seed=137){const k=mod(n,251);return mod(k*k*17+k*137+riverSeed(seed)*29,251)/250;}
export function riverNoise(x,seed=137){const i=Math.floor(x),u=x-i,s=u*u*(3-2*u);return (riverHash(i,seed)+(riverHash(i+1,seed)-riverHash(i,seed))*s)*2-1;}
function noiseDerivative(x,seed){const i=Math.floor(x),u=x-i;return (riverHash(i+1,seed)-riverHash(i,seed))*12*u*(1-u);}
const smooth=u=>{const t=Math.max(0,Math.min(1,u));return t*t*(3-2*t);};
export function riverCenter(d,seed=137){return riverNoise(d/137+19,seed)*8+Math.sin(d*.023+riverSeed(seed)*.031)*9+riverNoise(d/331+73,seed)*4;}
export function riverTangent(d,seed=137){return noiseDerivative(d/137+19,seed)*8/137+Math.cos(d*.023+riverSeed(seed)*.031)*.207+noiseDerivative(d/331+73,seed)*4/331;}
export function riverHalfWidth(d,seed=137){return 17+riverNoise(d/61.7+31,seed)*2.8+riverNoise(d/193+87,seed)*2.4-rapidAt(d,seed)*1.2;}
export function chuteAt(d,seed=137){
 const cell=Math.floor(d/130),along=d-cell*130,start=25+riverHash(cell+43,seed)*36,length=23+riverHash(cell+91,seed)*13;
 const amplitude=4.1+1.8*(riverHash(cell+1,seed)-riverHash(cell,seed)),u=(along-start)/length;
 return {cell,along,start,length,amplitude,u};
}
export function riverElevation(d,seed=137){const c=chuteAt(d,seed);return -.022*d-(4.1*c.cell+1.8*(riverHash(c.cell,seed)-riverHash(0,seed))+c.amplitude*smooth(c.u));}
export function riverGrade(d,seed=137){const c=chuteAt(d,seed),u=Math.max(0,Math.min(1,c.u));return -.022-c.amplitude*6*u*(1-u)/c.length;}
export function rapidAt(d,seed=137){const c=chuteAt(d,seed),a=smooth((c.along-c.start+12)/16),b=1-smooth((c.along-c.start-c.length-8)/24);return .12+.88*a*b;}
export function rapidDerivative(d,seed=137){const c=chuteAt(d,seed),u=(c.along-c.start+12)/16,v=(c.along-c.start-c.length-8)/24,du=u>0&&u<1?6*u*(1-u)/16:0,dv=v>0&&v<1?6*v*(1-v)/24:0;return .88*(du*(1-smooth(v))-smooth(u)*dv);}
export function riverPoint(origin,course,cross=0,seed=137){const ahead=course-origin;return {x:cross+riverCenter(course,seed)-riverCenter(origin,seed)-riverTangent(origin,seed)*ahead,y:riverElevation(course,seed)-riverElevation(origin,seed),z:-ahead};}
export function riverBankHeight(cross,course,seed=137){const across=Math.max(0,(Math.abs(cross)-riverHalfWidth(course,seed))/32);return .16+Math.pow(across,.8)*(6+riverNoise(course/103+77,seed)*2)+riverNoise(course/29+across*3,seed)*1.5*Math.min(1,across*3);}
export function shoalAt(n,seed=137){const d=n*34+8+riverHash(n+17,seed)*18,side=riverHash(n+53,seed)>.5?1:-1;return {d,side,x:side*(riverHalfWidth(d,seed)-.65),size:.7+riverHash(n+79,seed)*1.1};}

export const COURSE_GLSL=`
uniform float uSeed,uDistance;
float rHash(float n){float k=mod(n,251.);return mod(k*k*17.+k*137.+uSeed*29.,251.)/250.;}
float rNoise(float x){float i=floor(x),u=fract(x);return mix(rHash(i),rHash(i+1.),u*u*(3.-2.*u))*2.-1.;}
float rNoiseD(float x){float i=floor(x),u=fract(x);return (rHash(i+1.)-rHash(i))*12.*u*(1.-u);}
float rSmooth(float u){u=clamp(u,0.,1.);return u*u*(3.-2.*u);}
float rCenter(float d){return rNoise(d/137.+19.)*8.+sin(d*.023+uSeed*.031)*9.+rNoise(d/331.+73.)*4.;}
float rTangent(float d){return rNoiseD(d/137.+19.)*8./137.+cos(d*.023+uSeed*.031)*.207+rNoiseD(d/331.+73.)*4./331.;}
vec4 rChute(float d){float cell=floor(d/130.),along=d-cell*130.,start=25.+rHash(cell+43.)*36.,len=23.+rHash(cell+91.)*13.;return vec4(cell,along,start,len);}
float rElevation(float d){vec4 c=rChute(d);float amp=4.1+1.8*(rHash(c.x+1.)-rHash(c.x));return -.022*d-(4.1*c.x+1.8*(rHash(c.x)-rHash(0.))+amp*rSmooth((c.y-c.z)/c.w));}
float rGrade(float d){vec4 c=rChute(d);float u=clamp((c.y-c.z)/c.w,0.,1.),amp=4.1+1.8*(rHash(c.x+1.)-rHash(c.x));return -.022-amp*6.*u*(1.-u)/c.w;}
float rRapid(float d){vec4 c=rChute(d);return .12+.88*rSmooth((c.y-c.z+12.)/16.)*(1.-rSmooth((c.y-c.z-c.w-8.)/24.));}
float rRapidD(float d){vec4 c=rChute(d);float u=(c.y-c.z+12.)/16.,v=(c.y-c.z-c.w-8.)/24.,du=u>0.&&u<1.?6.*u*(1.-u)/16.:0.,dv=v>0.&&v<1.?6.*v*(1.-v)/24.:0.;return .88*(du*(1.-rSmooth(v))-rSmooth(u)*dv);}
float rWidth(float d){return 17.+rNoise(d/61.7+31.)*2.8+rNoise(d/193.+87.)*2.4-rRapid(d)*1.2;}
float rLocalX(float d){return rCenter(d)-rCenter(uDistance)-rTangent(uDistance)*(d-uDistance);}
float rLocalY(float d){return rElevation(d)-rElevation(uDistance);}
float rBank(float cross,float d){float a=max(0.,(abs(cross)-rWidth(d))/32.);return .16+pow(a,.8)*(6.+rNoise(d/103.+77.)*2.)+rNoise(d/29.+a*3.)*1.5*min(1.,a*3.);}
`;
