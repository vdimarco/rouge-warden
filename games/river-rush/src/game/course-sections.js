// A course-space encounter envelope shared by route generation and geography.
// There is no growing section list or wall-clock state to recycle.
const mod=(n,m)=>((n%m)+m)%m;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const u=clamp(n,0,1);return u*u*(3-2*u);};
const slope=(n,width)=>n>0&&n<1?6*n*(1-n)/width:0;
const seedOf=profile=>mod(profile?.seed??137,251);
function hash(n,seed){const k=mod(n,251);return mod(k*k*17+k*137+seed*29,251)/250;}
export const TERRAIN_SECTIONS=Object.freeze([
 Object.freeze({type:'narrows',name:'Boulder Narrows',cue:'Carve through the rock gates'}),
 Object.freeze({type:'wave-train',name:'Wave Train',cue:'Jump the crests · Chain 3 jumps +350'}),
 Object.freeze({type:'low-canopy',name:'Low Canopy',cue:'Duck the branches · Follow low gold'})
]);
const recovery=Object.freeze({type:'recovery',name:'Open Water',cue:'Catch your breath · Build your streak'});
export function terrainSection(distance,profile){
 const seed=seedOf(profile),map=clamp(profile?.mapIndex??0,0,2),length=profile?.length??0;
 const offset=260+hash(181,seed)*40,span=600-map*20+hash(199,seed)*40;
 const cell=Math.floor((distance-offset)/span),along=distance-offset-cell*span;
 const direction=hash(223,seed)<.5?1:-1,kind=mod(cell*direction+Math.floor(hash(211,seed)*3),3);
 const entry=70+hash(cell+131,seed)*24,exit=90+hash(cell+163,seed)*20;
 const a=along/entry,b=(along-span+exit)/exit,finish=(length-150-distance)/70;
 const enter=smooth(a),leave=1-smooth(b),runway=smooth(finish);
 const strength=length>0&&distance>=offset?enter*leave*runway:0;
 const derivative=strength===0?0:(slope(a,entry)*leave-enter*slope(b,exit))*runway-enter*leave*slope(finish,70);
 const open=!(length>0)||distance<offset||distance>=length-150;
 const phase=open||along>=span-exit?'recovery':along<entry?'approach':'active';
 const section=open?recovery:TERRAIN_SECTIONS[kind];
 const start=offset+cell*span,end=offset+(cell+1)*span;
 // 350 m fits three normal rows even after the longest preceding recovery
 // gap at the accepted 92 m/s cap. A shortened final encounter promises gold,
 // rather than a jump-chain objective that its runway cannot accommodate.
 const comboAvailable=section.type==='wave-train'&&phase!=='recovery'&&Math.min(end-exit,length-150)-(start+entry)>=350;
 const cue=section.type==='wave-train'&&!comboAvailable?'Jump the crests · Catch the raised gold':section.cue;
 return{id:open?'recovery':cell,type:section.type,name:phase==='recovery'?'Open Water':section.name,cue:phase==='recovery'?recovery.cue:cue,phase,strength,derivative,start,end,comboAvailable,next:TERRAIN_SECTIONS[mod((cell+1)*direction+Math.floor(hash(211,seed)*3),3)].name};
}

// rHash/rSmooth/rPulseD and course uniforms are supplied by river-course.js.
export const SECTIONS_GLSL=`
vec3 rSection(float d){
 if(uCourseLength<=0.)return vec3(0.);
 float offset=260.+rHash(181.)*40.,span=600.-clamp(uCourseMap,0.,2.)*20.+rHash(199.)*40.;
 float cell=floor((d-offset)/span),along=d-offset-cell*span;
 float direction=rHash(223.)<.5?1.:-1.,kind=mod(cell*direction+floor(rHash(211.)*3.),3.);
 float entry=70.+rHash(cell+131.)*24.,exit=90.+rHash(cell+163.)*20.;
 float a=along/entry,b=(along-span+exit)/exit,finish=(uCourseLength-150.-d)/70.;
 float enter=rSmooth(a),leave=1.-rSmooth(b),runway=rSmooth(finish);
 float pulse=d>=offset?enter*leave*runway:0.;
 float derivative=pulse==0.?0.:(rPulseD(a,entry)*leave-enter*rPulseD(b,exit))*runway-enter*leave*rPulseD(finish,70.);
 return vec3(kind,pulse,derivative);
}
`;
