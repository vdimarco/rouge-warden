// Deterministic phone input tests; GPU integration lives in mobile.e2e.mjs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
class Element extends EventTarget {
 constructor(){super();this.nodes=new Map();this.classList={add(){},remove(){},toggle(){}};this.attrs={};}
 querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Element());return this.nodes.get(s);} querySelectorAll(){return [];}
 setPointerCapture(){} setAttribute(k,v){this.attrs[k]=v;} getBoundingClientRect(){return {left:0,top:0,width:400,height:800};}
}
const win=new EventTarget(),doc=new EventTarget();let panel,now=0,active=true;
doc.createElement=()=>panel=new Element();doc.body={append(){}};
Object.assign(globalThis,{window:win,document:doc,matchMedia:()=>({matches:true}),addEventListener:win.addEventListener.bind(win),screen:{orientation:new EventTarget()}});
Object.defineProperty(globalThis,'navigator',{value:{maxTouchPoints:1,vibrate(){}},configurable:true});
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
win.DeviceOrientationEvent={requestPermission:async()=>'granted'};win.DeviceMotionEvent={requestPermission:async()=>'granted'};
const src=(await readFile(new URL('../../public/vr/js/mobile.js',import.meta.url),'utf8')).replace("'three'",JSON.stringify(new URL('../../public/vr/lib/three.module.min.js',import.meta.url).href));
const {createMobile}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const canvas=new Element(),m=createMobile(canvas,()=>active);
const send=(target,type,data={})=>{const ev=new Event(type);Object.assign(ev,data);target.dispatchEvent(ev);};
const tap=(id,x,y)=>{send(canvas,'pointerdown',{pointerId:id,clientX:x,clientY:y});send(canvas,'pointerup',{pointerId:id,clientX:x,clientY:y});};
const held=p=>p.holds[0]||p.holds[1];
assert.equal(panel.querySelector('[data-action="throw"]').onclick,undefined,'no SWING button: the city is the control');
await m.start();m.sample(.016);
// the right half throws the right plunger (1), aimed through the tapped point; the fire is an edge, the hold stays
tap(1,300,200);let p=m.sample(.016);assert(p.fires[1]&&!p.fires[0]&&p.holds[1]&&!p.holds[0],'a tap on the right half throws the right plunger');assert.deepEqual(p.aims[1],{x:.5,y:.5});
p=m.sample(.016);assert(p.holds[1]&&!p.fires[1]&&p.aims[1]===null,'the right rope stays held; the fire and the tap ray last one frame');
// the left half throws the left plunger, and the right one stays out
tap(2,100,600);p=m.sample(.016);assert(p.fires[0]&&!p.fires[1]&&p.holds[0]&&p.holds[1],'a tap on the left half throws the left plunger; the right one stays');assert.deepEqual(p.aims[0],{x:-.5,y:-.5});
// two thumbs down at once: both plungers fire in the same frame
send(canvas,'pointerdown',{pointerId:3,clientX:50,clientY:300});send(canvas,'pointerdown',{pointerId:4,clientX:350,clientY:300});
send(canvas,'pointerup',{pointerId:3,clientX:50,clientY:300});send(canvas,'pointerup',{pointerId:4,clientX:350,clientY:300});
p=m.sample(.016);assert(p.fires[0]&&p.fires[1],'two fingers at once throw both plungers');
// a tap on the same side again swings on (that plunger stays held, a new shot fires)
tap(5,320,100);p=m.sample(.016);assert(p.fires[1]&&p.holds[1],'a second tap on a side swings on (the rope is never let go by a tap)');
// a drag looks and throws nothing, even while another finger taps
send(canvas,'pointerdown',{pointerId:6,clientX:100,clientY:100});send(canvas,'pointermove',{pointerId:6,clientX:170,clientY:120});
tap(7,330,400);send(canvas,'pointerup',{pointerId:6,clientX:170,clientY:120});p=m.sample(.016);
assert(p.turn!==0&&!p.fires[0]&&p.fires[1],'a drag aims without throwing, while another finger still taps');
// tap() from code: the side given, the marked target (no aim)
m.tap(0);p=m.sample(.016);assert(p.fires[0]&&p.aims[0]===null,'tap(side) throws at the marked target');
// a rope that lets go by itself: only its side goes dark
m.released(0);p=m.sample(.016);assert(!p.holds[0]&&p.holds[1],'released(side) clears only that plunger');
m.released();assert(!held(m.sample(.016)),'released() clears both');
send(win,'deviceorientation',{alpha:0,beta:60,gamma:0});send(win,'deviceorientation',{alpha:8,beta:65,gamma:0});p=m.sample(.016);assert(Math.abs(p.turn)+Math.abs(p.pitch)>0);
m.tap(1);m.sample(.016);
now=600;send(win,'devicemotion',{acceleration:{z:7}});p=m.sample(.016);assert(p.reel>0&&p.yank>0,'optional motion pull');
now=650;send(win,'devicemotion',{acceleration:{z:8}});assert.equal(m.sample(.016).yank,0,'yank cooldown');
send(win,'blur');assert(!held(m.sample(.016)),'blur clears both plungers');
active=false;m.sample(.016);assert(panel.hidden);active=true;m.sample(.016);
win.DeviceOrientationEvent.requestPermission=async()=>'denied';win.DeviceMotionEvent.requestPermission=async()=>'denied';await m.start();m.tap(1);assert(m.sample(.016).holds[1],'denied sensors still playable');
m.miss(1);assert(!held(m.sample(.016)),'miss clears that plunger');
send(win,'devicemotion',{acceleration:null,accelerationIncludingGravity:{z:9.8}});assert.equal(m.sample(.016).yank,0);
console.log('PASS: left and right taps throw their own plungers, two fingers at once, chained taps, screen aim (one frame), drag beside a tap, tap(side), released(side), gyro, optional pull, cooldown, blur, denied sensors, miss, gravity rejection');
