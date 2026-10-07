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
const send=(target,type,data={})=>{const ev=new Event(type);Object.defineProperty(ev,'timeStamp',{value:now});Object.assign(ev,data);target.dispatchEvent(ev);};
// a finger goes down on the city; its moves, ups and cancels reach the window (they bubble there in a browser)
const tap=(id,x,y)=>{send(canvas,'pointerdown',{pointerId:id,clientX:x,clientY:y});send(win,'pointerup',{pointerId:id,clientX:x,clientY:y});};
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
send(win,'pointerup',{pointerId:3,clientX:50,clientY:300});send(win,'pointerup',{pointerId:4,clientX:350,clientY:300});
p=m.sample(.016);assert(p.fires[0]&&p.fires[1],'two fingers at once throw both plungers');
// a tap on the same side again swings on (that plunger stays held, a new shot fires)
tap(5,320,100);p=m.sample(.016);assert(p.fires[1]&&p.holds[1],'a second tap on a side swings on (the rope is never let go by a tap)');
// a drag looks and throws nothing, even while another finger taps
send(canvas,'pointerdown',{pointerId:6,clientX:100,clientY:100});send(win,'pointermove',{pointerId:6,clientX:170,clientY:120});
tap(7,330,400);send(win,'pointerup',{pointerId:6,clientX:170,clientY:120});p=m.sample(.016);
assert(p.turn!==0&&!p.fires[0]&&p.fires[1],'a drag aims without throwing, while another finger still taps');
// a real phone: the second thumb lands, the browser cancels the first finger (it reads a pinch); that finger still throws
send(canvas,'pointerdown',{pointerId:8,clientX:60,clientY:500});send(canvas,'pointerdown',{pointerId:9,clientX:340,clientY:500});
send(win,'pointercancel',{pointerId:8});send(win,'pointerup',{pointerId:9,clientX:340,clientY:500});
p=m.sample(.016);assert(p.fires[0]&&p.fires[1],'a finger the browser cancels while it is still a tap throws its plunger');
// a cancel after a drag, or after a long hold, throws nothing
send(canvas,'pointerdown',{pointerId:10,clientX:60,clientY:500});send(win,'pointermove',{pointerId:10,clientX:120,clientY:500});send(win,'pointercancel',{pointerId:10});
now+=1000;send(canvas,'pointerdown',{pointerId:11,clientX:340,clientY:500});now+=600;send(win,'pointercancel',{pointerId:11});
p=m.sample(.016);assert(!p.fires[0]&&!p.fires[1],'a cancelled drag, or a finger cancelled after a long hold, throws nothing');
// a thumb that rocks a few px as the other one lands is still a tap, and it does not turn the view
send(canvas,'pointerdown',{pointerId:12,clientX:60,clientY:500});send(canvas,'pointerdown',{pointerId:13,clientX:340,clientY:500});
for(const [x,y] of [[64,503],[57,496],[66,505],[60,500]])send(win,'pointermove',{pointerId:12,clientX:x,clientY:y});
send(win,'pointerup',{pointerId:12,clientX:60,clientY:500});send(win,'pointerup',{pointerId:13,clientX:340,clientY:500});
p=m.sample(.016);assert(p.fires[0]&&p.fires[1]&&p.turn===0&&p.pitch===0,'a rocking thumb still taps, and the view does not turn');
// an up that never came (the id is still listed): the next press with that id taps as normal
send(canvas,'pointerdown',{pointerId:14,clientX:60,clientY:500});tap(14,340,500);p=m.sample(.016);
assert(p.fires[1]&&!p.fires[0],'a pointer id with a lost up taps again');
// the city cancels the touches, so the browser starts no pinch or zoom
const ts=new Event('touchstart',{cancelable:true});canvas.dispatchEvent(ts);assert(ts.defaultPrevented,'a touch on the city starts no pinch or zoom');
const gs=new Event('gesturestart',{cancelable:true});doc.dispatchEvent(gs);assert(gs.defaultPrevented,'no gesture (iPhone Safari pinch)');
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
console.log('PASS: left and right taps throw their own plungers, two fingers at once, chained taps, screen aim (one frame), drag beside a tap, a cancelled finger, a rocking thumb, a lost up, no pinch, tap(side), released(side), gyro, optional pull, cooldown, blur, denied sensors, miss, gravity rejection');
