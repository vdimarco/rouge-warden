import {COURSE_GLSL} from './river-course.js';
import {WAVES} from './hydrodynamics.js';

const wave=WAVES.map(w=>`{float p=x*${w.kx}+d*${w.kz}-uTime*${w.omega}+${w.phase.toFixed(1)};s+=vec3(${w.amplitude}*sin(p),${w.amplitude*w.kx}*cos(p),${w.amplitude*w.kz}*cos(p));}`).join('\n');
const waterSample=`vec3 surface(float x,float d){vec3 s=vec3(0.);${wave}
 float rapid=rRapid(d),dr=rRapidD(d),energy=.65+rapid*1.15,p=d*.68+x*.23;
 return vec3(s.x*energy+.24*rapid*sin(p),s.y*energy+.24*rapid*.23*cos(p),s.z*energy+s.x*1.15*dr+.24*(dr*sin(p)+rapid*.68*cos(p)))*uMotion;}`;
const varyings=`varying vec3 vWorld,vNormal;varying vec2 vCourse;flat varying vec2 vShoal0,vShoal1;
varying vec4 vProfile;varying float vRapid;`;
export const waterVertex=`
${COURSE_GLSL}
uniform float uTime,uMotion;
${varyings}
${waterSample}
vec2 shoal(float cell){float d=cell*34.+8.+rHash(cell+17.)*18.,side=rHash(cell+53.)>.5?1.:-1.;return vec2(side*(rWidth(d)-.65),d);}
void main(){float d=uDistance-position.z,width=rWidth(d),x=position.x*width;vec3 s=surface(x,d);
 vec3 p=vec3(x+rLocalX(d),rLocalY(d)+s.x,position.z);
 float grade=rGrade(d),tangent=rTangent(d)-rTangent(uDistance);
 vWorld=p;vCourse=vec2(x,d);vRapid=rRapid(d);
 vProfile=vec4(width,grade,rRapidD(d),tangent);
 vNormal=normalize(vec3(-s.y,1.,grade+s.z-s.y*tangent));
 // Shoal identities are discrete. Flat varyings prevent interpolation from
 // inventing moving boulders where adjacent rows cross a seeded cell boundary.
 float cell=floor(d/34.);vShoal0=shoal(cell);vShoal1=shoal(cell-1.);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;

// Seeded geography belongs at mesh vertices, not at every covered pixel. The
// fine native normal remains analytic so wide water does not become faceted.
const fineNormal=`vec3 fineSurface(float x,float d){vec3 s=vec3(0.);${wave}
 float energy=.65+vRapid*1.15,p=d*.68+x*.23;
 return vec3(s.x*energy+.24*vRapid*sin(p),s.y*energy+.24*vRapid*.23*cos(p),s.z*energy+s.x*1.15*vProfile.z+.24*(vProfile.z*sin(p)+vRapid*.68*cos(p)))*uMotion;}`;
const common=`
uniform float uTime,uMotion,uRush;uniform sampler2D uDetail;
uniform vec2 uRaft;uniform vec4 uRipples[4];
${varyings}
float square(float x){return x*x;}
float streak(float p,float width){return 1.-smoothstep(width,width+.12,abs(sin(p)));}
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
`;
function foamCode(simple){return `float foamAt(vec2 p,float grain){
 float x=p.x,d=p.y,flow=d-uTime*22.*uMotion;
 float bend=x*.78+sin(d*.11+x*.3)*.8+sin(d*.037-x*.27)*1.1;
 float threads=streak(bend,.07)*smoothstep(.28,.72,.5+.5*sin(flow*.42+x*2.));
 float crest=streak(d*.68+x*.23+sin(x*.63+d*.08)*1.1+sin(x*.27-d*.14)*.55,.16)*smoothstep(.3,.76,grain)*vRapid;
 ${simple?'float chop=0.;':'float chop=streak(flow*.81+x*1.7+sin(x*2.),.045)*smoothstep(.5,.85,grain)*vRapid;'}
 float edge=smoothstep(vProfile.x-2.2,vProfile.x-.15,abs(x));
 float breaker=square(square(max(sin(d*.54+sin(x*.5+d*.08)*1.2),0.)))*smoothstep(.42,.7,grain)*vRapid;
 float foam=threads*(.055+vRapid*.19)+crest*.52+chop*.32+breaker*.75+edge*(.12+grain*.4);
 // The wet boulders and their downstream eddies share vertex-sampled positions.
 for(int j=0;j<2;j++){vec2 rock=j==0?vShoal0:vShoal1;float tail=d-rock.y;
 if(tail>0.&&tail<17.){float xx=x-rock.x,spread=.75+tail*.1;
 ${simple?`float ring=max(0.,1.-abs(abs(xx)-spread)*1.4),swirl=.65+.35*sin(tail*.9+xx*2.-uTime*3.*uMotion);
 foam+=ring*ring*(1.-tail/17.)*swirl*.5;`:`float swirl=sin(atan(xx,tail-4.)*4.+length(vec2(xx,tail-4.))*2.-uTime*3.*uMotion);
 foam+=exp(-square((abs(xx)-spread)*2.))*exp(-tail*.13)*(.28+.25*swirl);`}}}
 float behind=vWorld.z-uRaft.y;
 if(behind>0.&&behind<22.){float sideDist=abs(vWorld.x-uRaft.x),width=1.25+behind*.18;
 ${simple?`float ribbon=max(0.,1.-abs(sideDist-width)*3.);foam+=ribbon*ribbon*(1.-behind/22.)*(.5+grain*.5)*(.65+uRush*.35);`:`foam+=exp(-square((sideDist-width)*4.))*exp(-behind*.10)*(.5+grain*.5)*(.65+uRush*.35);`}}
 for(int i=0;i<4;i++){vec4 r=uRipples[i];float age=uTime-r.z;
 if(age>=0.&&age<1.4){float ring=distance(vWorld.xz,r.xy)-age*5.;
 ${simple?'foam+=square(max(0.,1.-abs(ring)*2.))*(1.-age/1.4)*r.w;':'foam+=exp(-square(ring*3.))*(1.-age/1.4)*r.w;'}}}
 return clamp(foam*uMotion,0.,.88);
}`;}
export function waterFragment(simple=false){return `${common}
${simple?'':fineNormal}
${foamCode(simple)}
void main(){vec2 p=vCourse;float flow=p.y-uTime*22.*uMotion;
 vec3 detail=texture2D(uDetail,vec2(p.x*.09,flow*.045)).rgb;
 float grain=${simple?'detail.g':'noise(vec2(p.x*1.15,flow*.44))*.75+detail.g*.25'};
 ${simple?'vec3 n=normalize(vNormal+vec3(detail.r-.4,0.,detail.g-.4)*.12*uMotion);':`vec3 s=fineSurface(p.x,p.y);vec3 n=normalize(vec3(-s.y,1.,vProfile.y+s.z-s.y*vProfile.w)+vec3(detail.r-.4,0.,detail.g-.4)*.08*uMotion);`}
 vec3 view=normalize(cameraPosition-vWorld);
 float fresnel=pow(1.-max(dot(view,n),0.),3.),edge=smoothstep(.45,1.,abs(p.x)/vProfile.x);
 vec3 color=mix(vec3(.012,.19,.24),vec3(.055,.43,.37),edge*.55+vRapid*.22+grain*.18);
 color=mix(color,vec3(.39,.69,.76),fresnel*.3);
 ${simple?'':'float sun=pow(max(dot(reflect(-normalize(vec3(-.5,.8,.35)),n),view),0.),90.);color+=vec3(1.,.88,.56)*sun*.6;'}
 color=mix(color,vec3(.84,.97,.93),foamAt(p,grain)*.88);
 vec2 fog=vWorld.xz-cameraPosition.xz;color=mix(color,vec3(.53,.77,.79),1.-exp(-dot(fog,fog)*.00001936));
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;}
