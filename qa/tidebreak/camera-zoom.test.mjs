import assert from 'node:assert/strict';
import { clampZoom, wheelZoomFactor } from '../../public/tidebreak/camera-zoom.js';
assert.equal(clampZoom(.1),1);assert.equal(clampZoom(10),2.4);assert.equal(clampZoom(1.8),1.8);assert.equal(clampZoom(NaN),1);
const wheel=(deltaY,deltaMode=0)=>wheelZoomFactor({deltaY,deltaMode},800);
assert(wheel(120)>1);assert(wheel(-120)<1);assert.equal(wheel(0),1);
assert.equal(wheel(3,1),wheel(48));assert.equal(wheel(.1,2),wheel(80));
assert(wheel(1e6)<1.5,'large wheel deltas remain controlled');assert(Math.abs(wheel(120)*wheel(-120)-1)<1e-10);
console.log('Camera zoom bounds, reversal and pixel/line/page wheel normalization pass.');
