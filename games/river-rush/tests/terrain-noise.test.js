import test from 'node:test';
import assert from 'node:assert/strict';
import {TERRAIN_PERIOD,TERRAIN_RELIEF_LIMIT,TERRAIN_SHORE_FADE,periodicNoise2D,terrainFbm,terrainShape,bankTerrainOffset} from '../src/game/terrain-noise.js';

test('periodic gradient noise repeats exactly across positive and negative tile identities',()=>{
  for(const seed of [0,137,7123,0xffffffff])for(const period of [1,16,64,128])for(const x of [-128.375,-.25,0,.375,7.125,63.75])for(const z of [-73.25,0,1.375,41.125]){
    const value=periodicNoise2D(x,z,seed,period);
    for(const [dx,dz] of [[period,0],[0,-period],[period*17,-period*9]])assert.equal(periodicNoise2D(x+dx,z+dz,seed,period),value);
    assert.ok(Number.isFinite(value)&&Math.abs(value)<=1);
  }
  assert.equal(periodicNoise2D(.375,.125,137),periodicNoise2D(.375,.125,137+251));
});

test('noise values and first and second derivatives meet smoothly at tile seams',()=>{
  const e=.0001;
  const dx=(x,z)=> (periodicNoise2D(x+e,z)-periodicNoise2D(x-e,z))/(2*e);
  const dxx=(x,z)=> (periodicNoise2D(x+e,z)-2*periodicNoise2D(x,z)+periodicNoise2D(x-e,z))/(e*e);
  for(const z of [.125,.37,13.5,31.75,63.7]){
    assert.ok(Math.abs(periodicNoise2D(-e,z)-periodicNoise2D(TERRAIN_PERIOD-e,z))<1e-12);
    assert.ok(Math.abs(dx(-e,z)-dx(e,z))<1e-5);
    assert.ok(Math.abs(dxx(-e,z)-dxx(e,z))<.02);
    assert.ok(Math.abs(dx(0,z)-dx(TERRAIN_PERIOD,z))<1e-9);
  }
  for(const x of [.125,.37,13.5,31.75,63.7]){
    const dz=z=>(periodicNoise2D(x,z+e)-periodicNoise2D(x,z-e))/(2*e);
    assert.ok(Math.abs(dz(-e)-dz(e))<1e-5);
  }
});

test('two octaves stay periodic, seeded and varied along both terrain axes',()=>{
  let minimum=1,maximum=-1,seedChanges=0,crossChanges=0,distanceChanges=0;
  for(let i=0;i<4000;i++){
    const x=i%64+.375,z=Math.floor(i/64)+.625,value=terrainFbm(x,z,137);
    assert.equal(terrainFbm(x+TERRAIN_PERIOD,z-TERRAIN_PERIOD,137),value);
    assert.ok(Math.abs(value)<=1);minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);
    if(Math.abs(value-terrainFbm(x,z,138))>.01)seedChanges++;
    if(Math.abs(value-terrainFbm(x+.25,z,137))>.01)crossChanges++;
    if(Math.abs(value-terrainFbm(x,z+.25,137))>.01)distanceChanges++;
  }
  assert.ok(minimum<-.35&&maximum>.35);assert.ok(seedChanges>3500);assert.ok(crossChanges>3000&&distanceChanges>3000);
});

test('map-shaped bank relief is bounded and fades to zero at every navigable shoreline',()=>{
  for(const seed of [3,137,7319])for(const index of [0,1,2])for(const intensity of [0,.35,1])for(let d=-128;d<=16200;d+=37.73){
    const halfWidth=11.1+(Math.sin(d*.01)+1)*7.7;
    for(const cross of [-3.8,0,3.8,-halfWidth,halfWidth])assert.equal(bankTerrainOffset(cross,d,halfWidth,seed,index,intensity),0);
    for(const side of [-1,1]){
      const near=bankTerrainOffset(side*(halfWidth+.001),d,halfWidth,seed,index,intensity);
      assert.ok(near>=0&&near<1e-9,'relief and slope settle gently at the shore');
      for(const outside of [1,TERRAIN_SHORE_FADE,12,31,72]){
        const cross=side*(halfWidth+outside),height=bankTerrainOffset(cross,d,halfWidth,seed,index,intensity);
        assert.ok(height>=0&&height<TERRAIN_RELIEF_LIMIT);
        if(outside>=TERRAIN_SHORE_FADE)assert.ok(Math.abs(height-terrainShape(cross,d,seed,index,intensity))<1e-12);
      }
    }
  }
});

test('rounded, eroded and broken map shaping produce distinct continuous terrain fields',()=>{
  const means=[0,0,0],variances=[0,0,0];let changed=0;
  for(let i=0;i<1000;i++){
    const cross=-64+(i%20)*6.375,distance=Math.floor(i/20)*127.25;
    const a=terrainShape(cross,distance,137,0,.6),b=terrainShape(cross,distance,137,1,.6),c=terrainShape(cross,distance,137,2,.6);
    for(const [index,value] of [[0,a],[1,b],[2,c]]){means[index]+=value;variances[index]+=value*value;assert.ok(Math.abs(value-terrainShape(cross+.0001,distance+.0001,137,index,.6))<.001);}
    if(Math.abs(a-b)>.5&&Math.abs(a-c)>.5&&Math.abs(b-c)>.5)changed++;
  }
  for(let i=0;i<3;i++){means[i]/=1000;variances[i]=variances[i]/1000-means[i]**2;assert.ok(variances[i]>.2);}
  assert.ok(means[1]>means[0]*1.7);assert.ok(means[2]>means[0]*1.2);assert.ok(changed>600);
  // World periods use the same absolute coordinates regardless of chunks.
  for(const index of [0,1,2])assert.equal(terrainShape(33.5,19.25,137,index,.6),terrainShape(33.5+TERRAIN_PERIOD*32,19.25+TERRAIN_PERIOD*128,137,index,.6));
});
