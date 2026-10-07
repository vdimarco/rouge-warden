// Course acts describe distance, never wall time. These pure functions are
// shared by route generation, geography, water and presentation.
export const COURSE_ACTS = Object.freeze([
  {id:'opening',title:'Open water',from:0,to:.2},
  {id:'bends',title:'River bends',from:.2,to:.48},
  {id:'whitewater',title:'Whitewater chutes',from:.48,to:.76},
  {id:'wild',title:'Wild rapids',from:.76,to:1}
]);
const knots=[0,.2,.48,.76,1],values=[0,.16,.46,.77,1];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mapFloor=index=>.12+clamp(Number.isFinite(index)?index:0,0,2)*.04;
export function courseAct(distance,length){
  const p=length>0?clamp(distance/length,0,1):0;
  return p>=.76?3:p>=.48?2:p>=.2?1:0;
}
export function courseIntensity(distance,length,mapIndex=0){
  const floor=mapFloor(mapIndex);if(!(length>0))return floor;
  const p=clamp(distance/length,0,1),i=courseAct(distance,length),u=(p-knots[i])/(knots[i+1]-knots[i]);
  return floor+(1-floor)*(values[i]+(values[i+1]-values[i])*u*u*(3-2*u));
}
export function intensityDerivative(distance,length,mapIndex=0){
  if(!(length>0)||distance<=0||distance>=length)return 0;
  const p=distance/length,i=courseAct(distance,length),width=knots[i+1]-knots[i],u=(p-knots[i])/width;
  return (1-mapFloor(mapIndex))*(values[i+1]-values[i])*6*u*(1-u)/(width*length);
}
// Exact distance integral of the eased intensity. A cumulative drop budget
// derived from it remains continuous at every chute without summing old cells.
export function intensityIntegral(distance,length,mapIndex=0){
  const floor=mapFloor(mapIndex);if(!(length>0))return distance*floor;
  if(distance<=0)return distance*floor;
  const p=clamp(distance/length,0,1);let result=0;
  for(let i=0;i<4;i++){
    const width=knots[i+1]-knots[i],u=clamp((p-knots[i])/width,0,1);
    result+=width*(values[i]*u+(values[i+1]-values[i])*(u*u*u-u*u*u*u*.5));
  }
  return length*(floor*p+(1-floor)*result)+Math.max(0,distance-length);
}

// Embedded once in each course shader. These are the same eased polynomials,
// including their derivative and integral; there is no mutable profile state.
export const INTENSITY_GLSL=`
uniform float uCourseLength,uCourseMap;
float rFloor(){return .12+clamp(uCourseMap,0.,2.)*.04;}
vec4 rAct(float d){float p=clamp(d/max(uCourseLength,1.),0.,1.);
 if(p<.2)return vec4(0.,.2,0.,.16);
 if(p<.48)return vec4(.2,.28,.16,.30);
 if(p<.76)return vec4(.48,.28,.46,.31);
 return vec4(.76,.24,.77,.23);}
float rIntensity(float d){vec4 a=rAct(d);float p=clamp(d/max(uCourseLength,1.),0.,1.),u=(p-a.x)/a.y;
 return rFloor()+(1.-rFloor())*(a.z+a.w*u*u*(3.-2.*u));}
float rIntensityD(float d){if(uCourseLength<=0.||d<=0.||d>=uCourseLength)return 0.;
 vec4 a=rAct(d);float u=(d/uCourseLength-a.x)/a.y;return (1.-rFloor())*a.w*6.*u*(1.-u)/(a.y*uCourseLength);}
float rIntegralSegment(float p,vec4 a){float u=clamp((p-a.x)/a.y,0.,1.);return a.y*(a.z*u+a.w*(u*u*u-u*u*u*u*.5));}
float rIntegral(float d){if(uCourseLength<=0.)return d*rFloor();if(d<=0.)return d*rFloor();
 float p=clamp(d/uCourseLength,0.,1.),sum=rIntegralSegment(p,vec4(0.,.2,0.,.16))+rIntegralSegment(p,vec4(.2,.28,.16,.30))+rIntegralSegment(p,vec4(.48,.28,.46,.31))+rIntegralSegment(p,vec4(.76,.24,.77,.23));
 return uCourseLength*(rFloor()*p+(1.-rFloor())*sum)+max(0.,d-uCourseLength);}
`;
