import assert from 'node:assert/strict';
import {generate} from '../../public/vr/js/city.js';
import {createStreet} from '../../public/vr/js/street.js';
import {createCars} from '../../public/vr/js/cars.js';
const K=createCars(generate()),out=[],c=K.cars[0],d=K.cars[1];Object.assign(c,{on:true,x:10,z:20,yaw:0,speed:5,vx:1,vz:2});Object.assign(d,{on:true,x:30,z:40,yaw:Math.PI/2,speed:-5,vx:-2,vz:0});
const expected=()=>K.cars.filter(c=>c.on&&Math.abs(c.speed)>2).map(c=>({x:c.x-Math.sin(c.yaw)*1.6*Math.sign(c.speed),z:c.z-Math.cos(c.yaw)*1.6*Math.sign(c.speed),vx:c.vx,vz:c.vz,r:3.2}));
assert.equal(K.hazards(out),out);const first=out[0],second=out[1];
for(let i=0;i<100;i++){c.x+=.1;d.z-=.2;assert.deepEqual(K.hazards(out),expected());assert.equal(out[0],first);assert.equal(out[1],second);}
const fresh=K.hazards(),snapshot=structuredClone(fresh);c.x+=10;K.hazards(out);assert.deepEqual(fresh,snapshot);assert.notEqual(fresh[0],out[0]);
d.on=false;K.hazards(out);assert.equal(out.length,1);assert.equal(out[0],first);c.speed=2;K.hazards(out);assert.equal(out.length,0);c.speed=-3;d.on=true;K.hazards(out);assert.deepEqual(out,expected());assert.equal(out.length,2);
const S=createStreet(generate()),focus={x:110,y:0,z:1};S.update(1/60,0,focus,null);const person=S.people.find(p=>p.on);assert.ok(person);person.delay=0;person.state='walk';Object.assign(c,{on:true,x:person.x,z:person.z+1.6,yaw:0,speed:5});d.on=false;S.update(1/60,1,focus,null,K.hazards(out));assert.equal(person.state,'flee');assert.ok(S.stats.dodges>0,'pedestrian avoids reused hazard');
console.log('PASS: 100 hazard lists reuse records; reverse values, fresh outputs, shrink/empty/grow preserved');
