// The automatic render scale: the share of the full pixel ratio that world.js draws the lake at. Pure (no DOM), so node
// can test it: node qa/fish/render-scale.test.mjs.
// It reads the median of the last frame times, so one hitch (a GC pause, a texture upload, a notification) is one
// frame in the window and moves nothing. Frames slow for a while: a step down. Fast again for a while: a step up,
// until it is back at 1. The clock is the frame times themselves, so a test can feed it any cadence.

export const RES = {
  MIN: 0.6, DOWN: 0.85, UP: 1.1,
  N: 30, MIN_N: 15,      // frames in the window, and the fewest it decides on
  TARGET: 1000 / 60,     // ms: 60 fps is the goal, also on a 90 or 120 Hz screen
  SLOW: 1.3,             // a median above TARGET x SLOW is slow ...
  FAST: 1.15,            // ... and at or below TARGET x FAST is fast
  SLOW_FOR: 1000,        // ms of slow frames before a step down
  FAST_FOR: 1000,        // ms of fast frames before a step up
  AFTER_DOWN: 2000,      // ms after a step down before the first step up
  STALL: 250,            // ms: a longer frame is a stall (the page was away), not load: it does not count
  // a steady 30 Hz (iPhone Low Power Mode caps the frame rate): an even 33 ms is the screen, not the load
  CAP: [30.5, 36.5], CAP_JITTER: 4,
};

export function createRenderScale(R = RES) {
  let scale = 1, clock = 0, slowSince = -1, fastSince = -1, lastDown = -1e9;
  const win = [];
  function step(to) {
    scale = to;
    win.length = 0;
    slowSince = fastSince = -1;
    return true;
  }
  return {
    get scale() { return scale; },
    // one frame took ms. Returns true when the scale changed
    frame(ms) {
      if (!(ms > 0) || ms > R.STALL) return false;
      clock += ms;
      win.push(ms);
      if (win.length > R.N) win.shift();
      if (win.length < R.MIN_N) return false;
      const s = win.slice().sort((a, b) => a - b), med = s[s.length >> 1];
      const jitter = s[Math.floor(s.length * 0.9)] - s[Math.floor(s.length * 0.1)];
      const capped = med >= R.CAP[0] && med <= R.CAP[1] && jitter < R.CAP_JITTER;
      const slow = !capped && med > R.TARGET * R.SLOW, fast = med <= R.TARGET * R.FAST;
      slowSince = slow ? (slowSince < 0 ? clock : slowSince) : -1;
      fastSince = fast ? (fastSince < 0 ? clock : fastSince) : -1;
      if (slow && scale > R.MIN && clock - slowSince >= R.SLOW_FOR) { lastDown = clock; return step(Math.max(R.MIN, scale * R.DOWN)); }
      if (fast && scale < 1 && clock - fastSince >= R.FAST_FOR && clock - lastDown >= R.AFTER_DOWN) return step(Math.min(1, scale * R.UP));
      return false;
    },
    reset() { lastDown = -1e9; step(1); },
  };
}
