import assert from 'node:assert/strict';
import {MouseLook,MouseSword} from '../public/neon/mouse-sword.js';
const run=rate=>{const look=new MouseLook();look.move(120,-80);let yaw=0,pitch=0;for(let i=0;i<rate;i++){const t=look.update(1/rate,pitch);yaw+=t.yaw;pitch=t.pitch}return {yaw,pitch}};
for(const rate of [15,30,60,120]){const r=run(rate);assert(Math.abs(r.yaw+.36)<1e-9);assert(Math.abs(r.pitch-.192)<1e-9)}
const look=new MouseLook();for(let i=0;i<100;i++)look.move(20,-100);assert.equal(look.update(1,0).pitch,.65);look.reset();assert.equal(look.update(.1,0).yaw,0);look.move(NaN,0);assert.equal(look.update(.1,0).yaw,0);
const sword=new MouseSword();sword.move(500,200,1000,600);sword.move(650,250,1000,600);sword.update(.1);assert(sword.x>.6);assert(sword.y>.4);
console.log('Mouse view tests passed: both axes, frame-rate independence, pitch limits, reset, invalid input and blade movement.');
