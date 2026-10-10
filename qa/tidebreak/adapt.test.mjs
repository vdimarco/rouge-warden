// The canvas resolution rule (Renderer.prototype.adapt with the real backingRatio): every step changes the backing
// pixel count on common screens, it steps down only when fewer pixels make frames faster, it comes back up on 50, 60
// and 144 Hz screens, and a stall or a slow patch does not latch it low.
import assert from 'node:assert/strict';
import { BattlefieldOverlay as Renderer, backingRatio } from '../../public/tidebreak/battlefield-overlay.js';

// A renderer with only the timing state on a given screen; resize() sets the real backing ratio and restarts the timing
// window as the real one does. pixels() is the backing pixel count as a share of the full-quality count.
function rig(width = 1920, height = 1080, deviceRatio = 1) {
  const r = Object.create(Renderer.prototype), full = backingRatio(width, height, deviceRatio, 1) ** 2;
  r.quality = 1; r.resizes = 0; r.dpr = backingRatio(width, height, deviceRatio, 1);
  r.resize = function () { this.resizes++; this.dpr = backingRatio(width, height, deviceRatio, this.quality); this.restartTiming(); };
  r.pixels = () => r.dpr ** 2 / full;
  return r;
}
// Frames land on whole refresh intervals: work that misses one refresh waits for the next.
const onVsync = (work, hz) => Math.max(1, Math.ceil(work / (1000 / hz))) * (1000 / hz);
function run(r, seconds, hz, work) {
  let t = 0, low = 0;
  while (t < seconds * 1000) { const ms = onVsync(work(r, t), hz); r.adapt(ms); t += ms; if ((r.quality ?? 1) < .99) low += ms; }
  return low / (seconds * 1000);
}
// A fill-bound GPU: the frame cost is in proportion to the backing pixels.
const fill = full => r => full * r.pixels();

{ // Every quality step removes pixels in proportion, on a 1080p screen at 1x and 1.25x and on an ultra-wide.
  for (const [w, h, dr] of [[1920, 1080, 1], [1536, 864, 1.25], [3440, 1440, 1], [2560, 1440, 2]]) {
    const full = backingRatio(w, h, dr, 1) ** 2;
    for (const q of [.8, .64, .512]) { const share = backingRatio(w, h, dr, q) ** 2 / full; assert(Math.abs(share - q) < .01, `${w}x${h}@${dr} q ${q}: pixel share ${share}`); }
  }
  console.log('PASS each quality step changes the backing pixels in proportion on every screen');
}
{ // A smooth 60 Hz screen never changes resolution.
  const r = rig(); run(r, 60, 60, () => 10);
  assert.equal(r.quality, 1); assert.equal(r.resizes, 0);
  console.log('PASS a smooth 60 Hz screen keeps full resolution');
}
{ // 144 Hz with 9 ms of work (every other refresh) and one 300 ms stall: no change.
  const r = rig(); run(r, 30, 144, (_, t) => (t > 10000 && t < 10400 ? 300 : 9));
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
{ // A fill-bound GPU at 1080p that takes 32 ms at full size: the descent goes on through steps that show no change
  // (frames land on 33 ms until the work fits one refresh) and keeps the first resolution that runs at 60 Hz.
  const r = rig(); run(r, 300, 60, fill(32));
  assert(r.quality < 1 && r.quality >= .5, 'quality ' + r.quality);
  assert(onVsync(32 * r.pixels(), 60) < 17, 'the kept resolution runs at the refresh rate: ' + 32 * r.pixels());
  assert(r.resizes <= 20, 'resizes ' + r.resizes);
  console.log('PASS a fill-bound GPU at 1080p steps down until frames keep up', JSON.stringify({ quality: +r.quality.toFixed(2), resizes: r.resizes }));
}
{ // A GPU that can never keep up stops at the floor: half the pixels, not fewer.
  const r = rig(); run(r, 300, 60, fill(80));
  assert(r.quality >= .5, 'quality ' + r.quality); assert(r.pixels() >= .49, 'pixels ' + r.pixels());
  console.log('PASS the resolution never drops below half the pixels', JSON.stringify({ quality: +r.quality.toFixed(2) }));
}
{ // 144 Hz with 9 ms of work (every other refresh): after a fill-bound patch it returns to full resolution.
  const r = rig(); run(r, 10, 144, () => 9); run(r, 10, 144, fill(30)); run(r, 240, 144, () => 9);
  assert.equal(r.quality, 1, 'quality ' + r.quality);
  console.log('PASS a 144 Hz screen at every other refresh returns to full resolution');
}
{ // A 50 Hz screen: frames at 20 ms are at its refresh rate, so after a slow patch the resolution comes back.
  const r = rig(); run(r, 10, 50, () => 12); run(r, 6, 50, fill(45)); run(r, 240, 50, () => 12);
  assert.equal(r.quality, 1, 'quality ' + r.quality);
  console.log('PASS a 50 Hz screen returns to full resolution after a slow patch');
}
{ // A 144 Hz screen that recovers after a fill-bound patch returns to full resolution.
  const r = rig(); run(r, 20, 144, () => 5); run(r, 15, 144, fill(40)); run(r, 240, 144, () => 5);
  assert.equal(r.quality, 1, 'quality ' + r.quality);
  console.log('PASS a 144 Hz screen returns to full resolution after a slow patch');
}
