// Opt-in CPU-side diagnostics. Submission is not GPU completion or display latency.
export function createFrameMetrics() {
  const frames = [], inputs = [];
  let last = null, pending = null, frameIndex = 0, inputIndex = 0;
  const record = (values, index, value, limit) => { values[index % limit] = value; };
  return {
    input(time) { if (Number.isFinite(time) && time >= 0) pending = pending === null ? time : Math.min(pending, time); },
    frame(time, submitted, active) {
      if (!active) { last = pending = null; return; }
      if (last !== null && time > last) record(frames, frameIndex++, time - last, 600);
      last = time;
      if (pending !== null && submitted >= pending) record(inputs, inputIndex++, submitted - pending, 120);
      pending = null;
    },
    report() {
      const sorted = frames.slice().sort((a, b) => a - b), input = inputs.slice().sort((a, b) => a - b);
      const percentile = (xs, q) => xs.length ? xs[Math.ceil(xs.length * q) - 1] : null;
      const elapsedMs = frames.reduce((a, b) => a + b, 0);
      return { frames: frames.length, elapsedMs, fps: elapsedMs ? frames.length * 1000 / elapsedMs : null,
        medianMs: percentile(sorted, .5), p95Ms: percentile(sorted, .95), p99Ms: percentile(sorted, .99), over50: frames.filter(x => x > 50).length,
        inputs: input.length, inputSubmitP95Ms: percentile(input, .95) };
    },
    reset() { frames.length = inputs.length = 0; last = pending = null; frameIndex = inputIndex = 0; },
  };
}
