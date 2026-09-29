// Deterministic phone sensor tests; no browser or GPU required.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
class Element extends EventTarget {
  constructor() { super(); this.nodes = new Map(); this.classList = { add() {}, remove() {} }; }
  querySelector(s) { if (!this.nodes.has(s)) this.nodes.set(s, new Element()); return this.nodes.get(s); }
  setPointerCapture() {}
}
const win = new EventTarget(), doc = new EventTarget();
let panel, now = 0, active = true;
doc.createElement = () => (panel = new Element()); doc.body = { append() {} }; doc.hidden = false;
Object.assign(globalThis, { window: win, document: doc, matchMedia: () => ({matches:true}), addEventListener: win.addEventListener.bind(win), screen: {orientation: new EventTarget()} });
Object.defineProperty(globalThis, 'navigator', {value:{maxTouchPoints:1,vibrate(){}},configurable:true});
Object.defineProperty(globalThis, 'performance', {value:{now:()=>now},configurable:true});
win.DeviceOrientationEvent = {requestPermission: async ()=>'granted'};
win.DeviceMotionEvent = {requestPermission: async ()=>'granted'};
const source = (await readFile(new URL('../../public/vr/js/mobile.js',import.meta.url),'utf8')).replace("'three'",JSON.stringify(new URL('../../public/vr/lib/three.module.min.js',import.meta.url).href));
const {createMobile}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function send(target,type,data={}) {const ev=new Event(type);Object.assign(ev,data);target.dispatchEvent(ev);}
const m=createMobile(new Element(),()=>active), b=panel.querySelector('[data-action="throw"]');
await m.start();m.sample(.016);
const motion=z=>send(win,'devicemotion',{acceleration:{z},rotationRate:{alpha:0,beta:0,gamma:0}});
motion(0);send(b,'pointerdown',{pointerId:1});assert.equal(m.sample(.016).hold,false);
now=120;motion(-5);assert.equal(m.sample(.016).hold,true);
now=600;motion(7);let input=m.sample(.016);assert(input.reel>0 && input.reel<=1);assert(input.yank>0);
now=650;motion(8);assert.equal(m.sample(.016).yank,0,'yank cooldown');
send(b,'pointerup',{pointerId:1});assert.equal(m.sample(.016).hold,false);
send(win,'deviceorientation',{alpha:0,beta:60,gamma:0});send(win,'deviceorientation',{alpha:8,beta:65,gamma:0});
input=m.sample(.016);assert(Math.abs(input.turn)+Math.abs(input.pitch)>0,'sensor aim');
send(b,'pointerdown',{pointerId:2});send(win,'blur');assert.equal(m.sample(.016).hold,false,'blur releases');
active=false;assert.equal(m.sample(.016).hold,false);assert.equal(panel.hidden,true);
active=true;m.sample(.016);assert.equal(panel.hidden,false);
win.DeviceOrientationEvent.requestPermission=async ()=>'denied';win.DeviceMotionEvent.requestPermission=async ()=>'denied';
await m.start();send(b,'pointerdown',{pointerId:3});assert.equal(m.sample(.016).hold,true,'touch fallback');send(b,'pointercancel',{pointerId:3});assert.equal(m.sample(.016).hold,false,'cancel releases');
const reel=panel.querySelector('[data-action="reel"]');send(reel,'pointerdown',{pointerId:4});assert.equal(m.sample(.016).reel,1);send(reel,'pointerup',{pointerId:4});
send(win,'devicemotion',{acceleration:null,accelerationIncludingGravity:{z:9.8}});assert.equal(m.sample(.016).yank,0,'gravity cannot yank');
console.log('PASS: phone permission, aim, throw, proportional pull, cooldown, release, blur, inactive state, touch fallback, pointer cancel, gravity rejection');
