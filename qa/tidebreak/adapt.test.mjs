// The canvas resolution rule (Renderer.prototype.adapt): it steps down only when fewer pixels make frames faster, it
// comes back up when frames recover on 60 Hz and 144 Hz screens, and a stall or a slow patch does not latch it low.
import assert from 'node:assert/strict';
import { Renderer } from '../../public/tidebreak/illustrated-render.js';

// A renderer with only the timing state; resize() restarts the timing window as the real one does.
function rig() {
  const r = Object.create(Renderer.prototype);
  r.quality = 1; r.resizes = 0; r.resize = function () { this.resizes++; this.restartTiming(); };
  return r;
}
// Frames land on whole refresh intervals: work that misses one refresh waits for the next.
const onVsync = (work, hz) => Math.max(1, Math.ceil(work / (1000 / hz))) * (1000 / hz);
function run(r, seconds, hz, work) {
  let t = 0, low = 0;
  while (t < seconds * 1000) { const ms = onVsync(work(r.quality ?? 1, t), hz); r.adapt(ms); t += ms; if ((r.quality ?? 1) < .99) low += ms; }
  return low / (seconds * 1000);
}

{ // A smooth 60 Hz screen never changes resolution.
  const r = rig(); run(r, 60, 60, () => 10);
  assert.equal(r.quality, 1); assert.equal(r.resizes, 0);
  console.log('PASS a smooth 60 Hz screen keeps full resolution');
}
{ // 144 Hz with 9 ms of work (every other refresh) and one 300 ms stall: no change.
  const r = rig(); run(r, 30, 144, (q, t) => (t > 10000 && t < 10400 ? 300 : 9));
  assert.equal(r.quality, 1, 'quality ' + r.quality);
  console.log('PASS 144 Hz with a stall keeps full resolution');
}
{ // A first 2 ms sample, then 60 Hz, then 3 s at 30 fps that pixels cannot fix, then 60 Hz again: back to full.
  const r = rig(); r.adapt(2);
  run(r, 10, 60, () => 10); run(r, 3, 60, () => 30); run(r, 20, 60, () => 10);
  assert.equal(r.quality, 1, 'quality ' + r.quality);
  assert(r.refreshMs > 15, 'the refresh estimate is not poisoned by the first sample: ' + r.refreshMs);
  console.log('PASS a slow patch and a short first sample do not latch the resolution low');
}
{ // Constant 30 ms frames whose cost does not depend on pixels: a drop is undone, and tried again only once a minute.
  const r = rig(); const lowShare = run(r, 180, 60, () => 30);
  assert(lowShare < .1, 'time at reduced resolution ' + lowShare);
  assert(r.resizes <= 8, 'resizes ' + r.resizes);
  console.log('PASS a CPU-bound frame keeps full resolution', JSON.stringify({ lowShare: +lowShare.toFixed(3), resizes: r.resizes }));
}
{ // A fill-bound GPU (cost grows with pixels) steps down until frames keep up, and not below the floor.
  const r = rig(); run(r, 300, 60, q => 32 * q * q);
  assert(r.quality < 1 && r.quality >= .5, 'quality ' + r.quality);
  assert(r.resizes <= 20, 'resizes ' + r.resizes);
  console.log('PASS a fill-bound GPU steps the resolution down and stays steady', JSON.stringify({ quality: +r.quality.toFixed(2), resizes: r.resizes }));
}
{ // A 144 Hz screen that recovers after a fill-bound patch returns to full resolution.
  const r = rig(); run(r, 20, 144, () => 5); run(r, 15, 144, q => 40 * q * q); run(r, 240, 144, () => 5);
  assert.equal(r.quality, 1, 'quality ' + r.quality);
  console.log('PASS a 144 Hz screen returns to full resolution after a slow patch');
}
