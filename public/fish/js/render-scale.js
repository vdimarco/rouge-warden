// The automatic render scale: the share of the full pixel ratio that world.js draws the lake at. Pure (no DOM), so node
// can test it: node qa/fish/render-scale.test.mjs.
// It reads the slowest quarter of the last frame times, so one hitch (a GC pause, a texture upload, a notification) is
// one frame in the window and moves nothing, while a lake that misses a frame in four is slow. Frames slow for a while: a step down. Fast again for a while: a step up,
// until it is back at 1. The clock is the frame times themselves, so a test can feed it any cadence.
// Frame times come in whole screen refreshes. On a 60 Hz screen a lake that costs 20 ms takes 33 ms a frame, the same as
// on a screen held at 30 Hz (iPhone Low Power Mode). So a steady 33 ms is put to the test: a step down, then the floor.
// Faster frames: it was the load. Not even the floor helps: it is the screen. The scale goes back to where the test
// began, and 30 fps is the goal until 60 fps comes back.
// A climb that turns slow goes straight back to the scale it came from, and the next try at that scale waits, twice as
// long after each failure, so a phone on the edge does not pump the sharpness up and down.

export const RES = {
  MIN: 0.6, DOWN: 0.85, UP: 1.1,
  N: 30, MIN_N: 15,      // frames in the window, and the fewest it decides on
  TARGET: 1000 / 60,     // ms: 60 fps is the goal, also on a 90 or 120 Hz screen
  Q: 0.75,               // the frame time it judges by: three frames in four are at least this fast
  SLOW: 1.3,             // that time above the goal x SLOW is slow ...
  FAST: 1.15,            // ... and at or below the goal x FAST is fast
  SLOW_FOR: 1000,        // ms of slow frames before a step down
  FAST_FOR: 1000,        // ms of fast frames before a step up
  AFTER_DOWN: 2000,      // ms after a step down before the first step up
  STALL: 250,            // ms: a longer frame is a stall (the page was away), not load: it does not count
  // a steady 30 Hz: the median in CAP and the spread of the window under CAP_JITTER. CAPPED: the goal on such a screen
  CAP: [30.5, 36.5], CAP_JITTER: 4, CAPPED: 1000 / 30,
  RETRY: 8000, RETRY_MAX: 120000,   // ms before a scale that failed a climb is tried again; doubles with each failure
  HELD: 10000,           // ms a climb must last without turning slow to count as a success
};

export function createRenderScale(R = RES) {
  let scale = 1, clock = 0, slowSince = -1, fastSince = -1, lastDown = -1e9;
  // capped: the screen holds 30 Hz. probe: the scale a test of a steady 30 Hz began at (0: no test)
  let capped = false, probe = 0;
  // the last climb (from, at), and the scale that was too slow (badAt) with the time it may be tried again
  let from = 1, climbAt = -1, badAt = Infinity, retry = 0, retryAt = 0;
  const win = [];
  function step(to) {
    scale = to;
    win.length = 0;
    slowSince = fastSince = -1;
    return true;
  }
  // a step down from a scale that was slow: a climb back to it may come after AFTER_DOWN
  function down(to) { badAt = scale; retryAt = clock; lastDown = clock; climbAt = -1; return step(Math.max(R.MIN, to)); }
  return {
    get scale() { return scale; },
    // the screen was found to hold 30 Hz
    get capped() { return capped; },
    // one frame took ms. Returns true when the scale changed
    frame(ms) {
      if (!(ms > 0) || ms > R.STALL) return false;
      clock += ms;
      win.push(ms);
      if (win.length > R.N) win.shift();
      if (win.length < R.MIN_N) return false;
      const s = win.slice().sort((a, b) => a - b), med = s[s.length >> 1], q = s[Math.floor(s.length * R.Q)];
      const jitter = s[Math.floor(s.length * 0.9)] - s[Math.floor(s.length * 0.1)];
      const steady30 = med >= R.CAP[0] && med <= R.CAP[1] && jitter < R.CAP_JITTER;
      // 60 fps: no cap holds the screen, and a test of a steady 30 Hz found load
      if (med <= R.TARGET * R.FAST) { capped = false; probe = 0; }
      const goal = capped ? R.CAPPED : R.TARGET;
      const slow = q > goal * R.SLOW, fast = q <= goal * R.FAST;
      slowSince = slow ? (slowSince < 0 ? clock : slowSince) : -1;
      fastSince = fast ? (fastSince < 0 ? clock : fastSince) : -1;
      // a climb that held: the scale that was too slow is forgotten
      if (climbAt >= 0 && clock - climbAt >= R.HELD) { climbAt = -1; if (scale >= badAt - 1e-9) { badAt = Infinity; retry = 0; } }
      if (slow && clock - slowSince >= R.SLOW_FOR) {
        // a climb that turned slow: back where it came from, and a longer wait before that scale is tried again
        if (climbAt >= 0) {
          badAt = scale; retry = Math.min(R.RETRY_MAX, retry ? retry * 2 : R.RETRY); retryAt = clock + retry;
          lastDown = clock; climbAt = -1;
          return step(from);
        }
        if (steady30 && !capped) {
          if (!probe) { probe = scale; if (scale > R.MIN) return down(scale * R.DOWN); }
          else if (scale > R.MIN) return down(R.MIN);
          // the floor did not help: the screen holds 30 Hz. Back to the scale the test began at
          const to = probe;
          capped = true; probe = 0; badAt = Infinity;
          return to !== scale ? step(to) : false;
        }
        if (scale > R.MIN) return down(scale * R.DOWN);
        return false;
      }
      if (fast && scale < 1 && clock - fastSince >= R.FAST_FOR && clock - lastDown >= R.AFTER_DOWN) {
        const to = Math.min(1, scale * R.UP);
        if (to >= badAt - 1e-9 && clock < retryAt) return false;
        from = scale; climbAt = clock;
        return step(to);
      }
      return false;
    },
    // back to the full scale, with no memory of the load (the screen's cap is kept)
    reset() { lastDown = -1e9; probe = 0; climbAt = -1; badAt = Infinity; retry = 0; step(1); },
  };
}
