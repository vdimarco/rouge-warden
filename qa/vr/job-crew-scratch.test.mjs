import assert from 'node:assert/strict';
import {generate} from '../../public/vr/js/city.js';
import {createCombat} from '../../public/vr/js/combat.js';
const C=createCombat(generate()),out=[],a=C.spawn(0,0,0,'job'),b=C.spawn(1,0,0,'other'),c=C.spawn(2,0,0,'job');
assert.equal(C.group('job',out),out,'provided storage returned');
for(let i=0;i<100;i++){a.on=i%2===0;c.group=i%3?'job':'other';c.state=i%5?'idle':'down';const expected=C.goons.filter(g=>g.on&&g.group==='job');assert.deepEqual(C.group('job',out),expected);for(let k=0;k<out.length;k++)assert.equal(out[k],expected[k]);}
const fresh=C.group('other'),snapshot=fresh.slice();b.on=false;C.group('other',out);assert.deepEqual(fresh,snapshot);assert.notEqual(C.group('other'),C.group('other'));
C.clearGroup('job');assert.equal(C.group('job',out).length,0);const d=C.spawn(3,0,0,'job');assert.deepEqual(C.group('job',out),[d]);
console.log('PASS: 100 reused crew lists; on/group/state membership, order/live references, fresh default arrays, empty/regrow');
