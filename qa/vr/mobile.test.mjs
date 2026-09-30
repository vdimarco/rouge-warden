// Deterministic phone input tests; GPU integration lives in mobile.e2e.mjs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
class Element extends EventTarget {
 constructor(){super();this.nodes=new Map();this.classList={add(){},remove(){},toggle(){}};this.attrs={};}
 querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Element());return this.nodes.get(s);}
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
const canvas=new Element(),m=createMobile(canvas,()=>active),button=panel.querySelector('[data-action="throw"]');
const send=(target,type,data={})=>{const ev=new Event(type);Object.assign(ev,data);target.dispatchEvent(ev);};
await m.start();m.sample(.016);button.onclick();let p=m.sample(.016);assert(p.hold&&p.fire,'tap fires without gesture');assert(m.sample(.016).hold,'rope stays held');assert(!m.sample(.016).fire,'fire is an edge');
button.onclick();assert(!m.sample(.016).hold,'second tap releases');
send(canvas,'pointerdown',{pointerId:1,clientX:300,clientY:200});send(canvas,'pointerup',{pointerId:1,clientX:300,clientY:200});p=m.sample(.016);assert(p.fire);assert.deepEqual(p.aim,{x:.5,y:.5});
send(canvas,'pointerdown',{pointerId:2,clientX:100,clientY:100});send(canvas,'pointermove',{pointerId:2,clientX:170,clientY:120});send(canvas,'pointerup',{pointerId:2,clientX:170,clientY:120});p=m.sample(.016);assert(!p.fire&&p.turn!==0,'drag aims without throwing');
send(win,'deviceorientation',{alpha:0,beta:60,gamma:0});send(win,'deviceorientation',{alpha:8,beta:65,gamma:0});p=m.sample(.016);assert(Math.abs(p.turn)+Math.abs(p.pitch)>0);
now=600;send(win,'devicemotion',{acceleration:{z:7}});p=m.sample(.016);assert(p.reel>0&&p.yank>0,'optional motion pull');
now=650;send(win,'devicemotion',{acceleration:{z:8}});assert.equal(m.sample(.016).yank,0,'yank cooldown');
send(win,'blur');assert(!m.sample(.016).hold,'blur clears latch');
active=false;m.sample(.016);assert(panel.hidden);active=true;m.sample(.016);
win.DeviceOrientationEvent.requestPermission=async()=>'denied';win.DeviceMotionEvent.requestPermission=async()=>'denied';await m.start();button.onclick();assert(m.sample(.016).hold,'denied sensors still playable');
m.miss();assert(!m.sample(.016).hold,'miss clears latch');
send(win,'devicemotion',{acceleration:null,accelerationIncludingGravity:{z:9.8}});assert.equal(m.sample(.016).yank,0);
console.log('PASS: one-tap cast, latch, release, screen aim, drag, gyro, optional pull, cooldown, blur, denied sensors, miss, gravity rejection');
