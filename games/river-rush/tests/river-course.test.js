import {LANES,laneToX,LANE_SPACING,PLAYABLE_HALF_WIDTH,RIVER_WIDTH_EXPANSION} from '../src/game/lanes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {riverCenter,riverTangent,riverHalfWidth,riverElevation,riverGrade,rapidAt,rapidDerivative,riverPoint,shoalAt,createCourseProfile,chuteAt,riverIntensity,COURSE_GLSL} from '../src/game/river-course.js';
import {surfaceAt,floatTarget} from '../src/game/hydrodynamics.js';
import {COURSE_ACTS,courseAct,courseIntensity,intensityDerivative,intensityIntegral} from '../src/game/course-intensity.js';

test('seeded river stays wide, descends downstream and has continuous chute boundaries',()=>{
 for(const seed of [0,3,137,7123,249]){
  let minWidth=Infinity,maxWidth=0,minGrade=0,maxRapid=0;
  for(let d=-200;d<3000;d+=.71){
   const width=riverHalfWidth(d,seed)*2,grade=riverGrade(d,seed);
   assert.ok(width>21.1+RIVER_WIDTH_EXPANSION*2&&width<44.5+RIVER_WIDTH_EXPANSION*2);assert.ok(grade<=-.0219);
   assert.ok(riverElevation(d+1,seed)<riverElevation(d,seed));
   assert.ok(rapidAt(d,seed)>=.12&&rapidAt(d,seed)<=1);
   minWidth=Math.min(minWidth,width);maxWidth=Math.max(maxWidth,width);minGrade=Math.min(minGrade,grade);maxRapid=Math.max(maxRapid,rapidAt(d,seed));
  }
  assert.ok(maxWidth-minWidth>8);assert.ok(minGrade<-.18);assert.equal(maxRapid,1);
  for(let cell=-2;cell<30;cell++)for(const profile of [riverElevation,riverCenter,riverHalfWidth,rapidAt]){
   assert.ok(Math.abs(profile(cell*130-1e-5,seed)-profile(cell*130+1e-5,seed))<1e-4);
  }
 }
 assert.notEqual(riverCenter(100,3),riverCenter(100,137));
});

test('four course acts intensify smoothly and their drop integral has the correct derivative',()=>{
 assert.deepEqual(COURSE_ACTS.map(act=>act.from),[0,.2,.48,.76]);
 for(const [index,length] of [[0,4200],[1,5400],[2,6600]]){
  let previous=0;const e=.001;
  for(let d=-10;d<=length+10;d+=7.13){
   const s=courseIntensity(d,length,index);assert.ok(s>=previous&&s<=1);previous=s;
   assert.ok(Math.abs((courseIntensity(d+e,length,index)-courseIntensity(d-e,length,index))/(2*e)-intensityDerivative(d,length,index))<1e-7);
   assert.ok(Math.abs((intensityIntegral(d+e,length,index)-intensityIntegral(d-e,length,index))/(2*e)-s)<1e-7);
  }
  for(const act of COURSE_ACTS){assert.equal(courseAct(act.from*length,length),COURSE_ACTS.indexOf(act));assert.equal(intensityDerivative(act.from*length,length,index),0);}
  assert.equal(courseIntensity(length,length,index),1);assert.equal(courseAct(length,length),3);
 }
});

test('profiled rivers stay downhill, wide and continuous through all acts and seeded recovery stretches',()=>{
 for(const [index,length] of [[0,4200],[1,5400],[2,6600]])for(const seed of [0,3,137,7123,249]){
  const course=createCourseProfile(seed,length,index),span=150-index*12;
  assert.ok(Object.isFrozen(course));
  for(let d=-100;d<=length+150;d+=1.77){
   const width=riverHalfWidth(d,course),grade=riverGrade(d,course),rapid=rapidAt(d,course);
   assert.ok(width>=11.1+RIVER_WIDTH_EXPANSION&&width<=26.5+RIVER_WIDTH_EXPANSION);assert.ok(grade<=-.01999&&grade>=-.563);assert.ok(rapid>=0&&rapid<=1);
   assert.ok(Math.abs(riverCenter(d,course))<=33.2);assert.ok(riverElevation(d+1,course)<riverElevation(d,course));
  }
  const boundaries=[...COURSE_ACTS.map(act=>act.from*length),length];
  for(let cell=-1;cell<=Math.ceil(length/span)+1;cell++)boundaries.push(cell*span);
  for(let episode=0;episode<=Math.ceil(length/320);episode++)boundaries.push(episode*320);
  for(const d of boundaries)for(const sample of [riverElevation,riverGrade,riverCenter,riverTangent,riverHalfWidth,rapidAt,rapidDerivative]){
   assert.ok(Math.abs(sample(d-1e-5,course)-sample(d+1e-5,course))<1e-4,`${sample.name} boundary ${index}:${seed}:${d}`);
  }
  for(let n=0;n<Math.ceil(length/34);n++){const rock=shoalAt(n,course);assert.ok(Math.abs(rock.x)-rock.size*2*1.18>PLAYABLE_HALF_WIDTH-.2,'shoals stay outside the playable lanes');}
 }
});

test('profiled geography and stronger standing waves preserve analytic derivatives',()=>{
 const e=1e-4;
 for(const [index,length] of [[0,4200],[1,5400],[2,6600]])for(const seed of [137,7123]){
  const course=createCourseProfile(seed,length,index);
  for(let d=0;d<=length;d+=13.79){
   for(const [sample,derivative] of [[riverCenter,riverTangent],[riverElevation,riverGrade],[rapidAt,rapidDerivative]])assert.ok(Math.abs((sample(d+e,course)-sample(d-e,course))/(2*e)-derivative(d,course))<1e-6,`${sample.name} ${index}:${d}`);
   const x=Math.sin(d)*3.8,time=d/80,surface=surfaceAt(x,d,time,false,course);
   assert.ok(Math.abs(surface.height)<.967);
   assert.ok(Math.abs((surfaceAt(x+e,d,time,false,course).height-surfaceAt(x-e,d,time,false,course).height)/(2*e)-surface.dx)<1e-6);
   assert.ok(Math.abs((surfaceAt(x,d+e,time,false,course).height-surfaceAt(x,d-e,time,false,course).height)/(2*e)-surface.dz)<1e-6);
  }
 }
});

test('final rapids measurably intensify while retaining quiet pools and varied chute drops',()=>{
 for(const [index,length] of [[0,4200],[1,5400],[2,6600]])for(const seed of [3,137,7123]){
  const course=createCourseProfile(seed,length,index);
  const sample=(from,to)=>{let rapid=0,drop=0,bend=0,count=0,min=1,max=0;for(let d=length*from;d<length*to;d+=1.1){const r=rapidAt(d,course);rapid+=r;drop+=-riverGrade(d,course);bend+=riverTangent(d,course)**2;min=Math.min(min,r);max=Math.max(max,r);count++;}return {rapid:rapid/count,drop:drop/count,bend:Math.sqrt(bend/count),min,max};};
  const opening=sample(0,.2),finale=sample(.76,1);
  assert.ok(finale.rapid>opening.rapid*1.5);assert.ok(finale.drop>opening.drop*1.35);assert.ok(finale.bend>opening.bend*1.25);
  assert.ok(finale.max>.8&&finale.min<.16,'wild bursts retain readable calm gaps');
  assert.ok(chuteAt(length*.94,course).amplitude>chuteAt(length*.04,course).amplitude);
  assert.ok(riverIntensity(length*.94,course)>riverIntensity(length*.04,course));
 }
});

test('course and whitewater derivatives agree with finite differences through pools and chutes',()=>{
 const e=1e-4;
 for(let d=0;d<1800;d+=3.79){
  for(const [profile,derivative] of [[riverCenter,riverTangent],[riverElevation,riverGrade],[rapidAt,rapidDerivative]]){
   assert.ok(Math.abs((profile(d+e,7123)-profile(d-e,7123))/(2*e)-derivative(d,7123))<1e-6);
  }
  const s=surfaceAt(2,d,9,false,7123);
  assert.ok(Math.abs((surfaceAt(2,d+e,9,false,7123).height-surfaceAt(2,d-e,9,false,7123).height)/(2*e)-s.dz)<1e-6);
 }
});

test('floating course preserves lane spacing, follows downhill bends and places shoals outside hazards',()=>{
 for(const origin of [0,55,130,795,1000000]){
  const zero=riverPoint(origin,origin,0,7123);assert.equal(Math.hypot(zero.x,zero.y,zero.z),0);
  const p=riverPoint(origin,origin+100,0,7123);assert.ok(p.y< -2);assert.equal(p.z,-100);
  const left=riverPoint(origin,origin+20,-3.8,7123),right=riverPoint(origin,origin+20,3.8,7123);
  assert.ok(Math.abs(right.x-left.x-7.6)<1e-10);assert.equal(right.y,left.y);
  for(let n=Math.floor(origin/34);n<Math.floor(origin/34)+9;n++){
   const rock=shoalAt(n,7123);assert.ok(Math.abs(rock.x)-rock.size*2*1.18>PLAYABLE_HALF_WIDTH-.2);
  }
 }
 const pool=floatTarget(0,0,0,false,7123),chute=floatTarget(0,67,0,false,7123);
 assert.ok(chute.pitch<pool.pitch);assert.deepEqual(floatTarget(0,67,0,true,7123),{height:.12,pitch:0,roll:0});
});


test('river widening preserves original organic course samples and uses the same shared GPU expansion',()=>{
 const before=[{"seed":0,"length":0,"mapIndex":0,"d":0,"width":12.315199999999999},{"seed":0,"length":0,"mapIndex":0,"d":110,"width":17.76146451046025},{"seed":0,"length":0,"mapIndex":0,"d":580,"width":15.296686547883866},{"seed":0,"length":0,"mapIndex":0,"d":1380,"width":17.283900086349007},{"seed":0,"length":0,"mapIndex":0,"d":4872,"width":17.089637948785686},{"seed":137,"length":0,"mapIndex":0,"d":0,"width":20.968},{"seed":137,"length":0,"mapIndex":0,"d":110,"width":17.907432992864635},{"seed":137,"length":0,"mapIndex":0,"d":580,"width":13.507886547883864},{"seed":137,"length":0,"mapIndex":0,"d":1380,"width":15.503935217343662},{"seed":137,"length":0,"mapIndex":0,"d":4872,"width":15.334219007177687},{"seed":98213,"length":0,"mapIndex":0,"d":0,"width":15.6432},{"seed":98213,"length":0,"mapIndex":0,"d":110,"width":15.49457580817403},{"seed":98213,"length":0,"mapIndex":0,"d":580,"width":13.805873341089148},{"seed":98213,"length":0,"mapIndex":0,"d":1380,"width":13.542171311201525},{"seed":98213,"length":0,"mapIndex":0,"d":4872,"width":16.31662980732849},{"seed":137,"length":4200,"mapIndex":0,"d":0,"width":24.729951999999997},{"seed":137,"length":4200,"mapIndex":0,"d":110,"width":22.031811257273056},{"seed":137,"length":4200,"mapIndex":0,"d":580,"width":16.17794559146528},{"seed":137,"length":4200,"mapIndex":0,"d":1380,"width":18.376591049100558},{"seed":137,"length":4200,"mapIndex":0,"d":4872,"width":15.776088855061161},{"seed":137,"length":5400,"mapIndex":1,"d":0,"width":24.734427999999998},{"seed":137,"length":5400,"mapIndex":1,"d":110,"width":22.02023614572925},{"seed":137,"length":5400,"mapIndex":1,"d":580,"width":15.198251690896086},{"seed":137,"length":5400,"mapIndex":1,"d":1380,"width":18.922904585722417},{"seed":137,"length":5400,"mapIndex":1,"d":4872,"width":19.697913623331978},{"seed":137,"length":6600,"mapIndex":2,"d":0,"width":24.7384},{"seed":137,"length":6600,"mapIndex":2,"d":110,"width":22.007785742632706},{"seed":137,"length":6600,"mapIndex":2,"d":580,"width":15.32342422657814},{"seed":137,"length":6600,"mapIndex":2,"d":1380,"width":19.5030517897516},{"seed":137,"length":6600,"mapIndex":2,"d":4872,"width":20.61178014559804}];
 for(const c of before){const profile=c.length?createCourseProfile(c.seed,c.length,c.mapIndex):c.seed;assert.ok(Math.abs(riverHalfWidth(c.d,profile)-c.width-RIVER_WIDTH_EXPANSION)<1e-12);}
 const gpuWidth=COURSE_GLSL.match(/float rWidth\(float d\)\{([^\n]+)\}/)[1];
 assert.equal((gpuWidth.match(new RegExp(RIVER_WIDTH_EXPANSION.toFixed(4).replace('.', '\\.'),'g'))??[]).length,2,'both GPU profile paths include the same imported width expansion');
 for(const origin of [0,580,4872]){const points=LANES.map(lane=>riverPoint(origin,origin+20,laneToX(lane),137));for(let i=1;i<points.length;i++)assert.ok(Math.abs(points[i].x-points[i-1].x-LANE_SPACING)<1e-10);assert.ok(riverHalfWidth(origin,137)>PLAYABLE_HALF_WIDTH+2);}
});
