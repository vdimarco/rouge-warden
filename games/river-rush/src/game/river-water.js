import {COURSE_GLSL} from './river-course.js';
import {WAVES} from './hydrodynamics.js';

const wave=WAVES.map(w=>`{float p=x*${w.kx}+d*${w.kz}-uTime*${w.omega}+${w.phase.toFixed(1)};s+=vec3(${w.amplitude}*sin(p),${w.amplitude*w.kx}*cos(p),${w.amplitude*w.kz}*cos(p));}`).join('\n');
const waterSample=`vec3 surface(float x,float d){vec3 s=vec3(0.);${wave}
 float rapid=rRapid(d),dr=rRapidD(d),energy=.65+rapid*1.15,p=d*.68+x*.23;
 return vec3(s.x*energy+.24*rapid*sin(p),s.y*energy+.24*rapid*.23*cos(p),s.z*energy+s.x*1.15*dr+.24*(dr*sin(p)+rapid*.68*cos(p)))*uMotion;}`;
export const waterVertex=`
${COURSE_GLSL}
uniform float uTime,uMotion;
varying vec3 vWorld,vNormal;varying vec2 vCourse;varying float vHeight,vRapid;
${waterSample}
void main(){float d=uDistance-position.z,x=position.x*rWidth(d);vec3 s=surface(x,d);
 vec3 p=vec3(x+rLocalX(d),rLocalY(d)+s.x,position.z);
 vWorld=p;vCourse=vec2(x,d);vHeight=s.x;vRapid=rRapid(d);
 vNormal=normalize(vec3(-s.y,1.,rGrade(d)+s.z));
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;

const common=`${COURSE_GLSL}
uniform float uTime,uMotion,uRush;uniform sampler2D uDetail;
uniform vec2 uRaft;uniform vec4 uRipples[4];
varying vec3 vWorld,vNormal;varying vec2 vCourse;varying float vHeight,vRapid;
float streak(float p,float width){return 1.-smoothstep(width,width+.12,abs(sin(p)));}
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float foamAt(vec2 p,float grain){
 float x=p.x,d=p.y,flow=d-uTime*22.*uMotion;
 float bend=x*.78+sin(d*.11+x*.3)*.8+sin(d*.037-x*.27)*1.1;
 float threads=streak(bend,.07)*smoothstep(.28,.72,.5+.5*sin(flow*.42+x*2.));
 float crest=streak(d*.68+x*.23+sin(x*.63+d*.08)*1.1+sin(x*.27-d*.14)*.55,.16)*smoothstep(.3,.76,grain)*vRapid;
 float chop=streak(flow*.81+x*1.7+sin(x*2.),.045)*smoothstep(.5,.85,grain)*vRapid;
 float edge=smoothstep(rWidth(d)-2.2,rWidth(d)-.15,abs(x));
 float breaker=pow(max(sin(d*.54+sin(x*.5+d*.08)*1.2),0.),4.)*smoothstep(.42,.7,grain)*vRapid;
 float foam=threads*(.055+vRapid*.19)+crest*.52+chop*.32+breaker*.75+edge*(.12+grain*.4);
 // The seeded wet boulders and their downstream eddies share these positions.
 for(int j=0;j<2;j++){float cell=floor(d/34.)-float(j),rockD=cell*34.+8.+rHash(cell+17.)*18.;
 float side=rHash(cell+53.)>.5?1.:-1.,rockX=side*(rWidth(rockD)-.65),tail=d-rockD;
 if(tail>0.&&tail<17.){float xx=x-rockX,spread=.75+tail*.1;
   float swirl=sin(atan(xx,tail-4.)*4.+length(vec2(xx,tail-4.))*2.-uTime*3.*uMotion);
   foam+=exp(-pow((abs(xx)-spread)*2.,2.))*exp(-tail*.13)*(.28+.25*swirl);}}
 float behind=vWorld.z-uRaft.y;
 if(behind>0.&&behind<22.){float sideDist=abs(vWorld.x-uRaft.x),width=1.25+behind*.18;
   foam+=exp(-pow((sideDist-width)*4.,2.))*exp(-behind*.10)*(.5+grain*.5)*(.65+uRush*.35);}
 for(int i=0;i<4;i++){vec4 r=uRipples[i];float age=uTime-r.z;
   if(age>=0.&&age<1.4)foam+=exp(-pow((distance(vWorld.xz,r.xy)-age*5.)*3.,2.))*(1.-age/1.4)*r.w;}
 return clamp(foam*uMotion,0.,.88);
}`;
export function waterFragment(simple=false){return `${common}
${waterSample}
void main(){vec2 p=vCourse;float flow=p.y-uTime*22.*uMotion;
 vec3 detail=texture2D(uDetail,vec2(p.x*.09,flow*.045)).rgb;
 float grain=noise(vec2(p.x*1.15,flow*.44))*.75+detail.g*.25;
 vec3 s=surface(p.x,p.y);vec3 n=normalize(vec3(-s.y,1.,rGrade(p.y)+s.z-s.y*(rTangent(p.y)-rTangent(uDistance)))+vec3(detail.r-.4,0.,detail.g-.4)*.08*uMotion),view=normalize(cameraPosition-vWorld);
 float fresnel=pow(1.-max(dot(view,n),0.),3.),edge=smoothstep(.45,1.,abs(p.x)/rWidth(p.y));
 vec3 color=mix(vec3(.012,.19,.24),vec3(.055,.43,.37),edge*.55+vRapid*.22+grain*.18);
 color=mix(color,vec3(.39,.69,.76),fresnel*.3);
 ${simple?'':'float sun=pow(max(dot(reflect(-normalize(vec3(-.5,.8,.35)),n),view),0.),90.);color+=vec3(1.,.88,.56)*sun*.6;'}
 color=mix(color,vec3(.84,.97,.93),foamAt(p,grain)*.88);
 color=mix(color,vec3(.53,.77,.79),1.-exp(-pow(length(vWorld.xz-cameraPosition.xz)*.0044,2.)));
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;}
