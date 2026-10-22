// Trial lower fill cost only under sustained load; undo it if frame pacing does not improve.
export function createRenderScale() {
  let scale = 1, last = null, elapsed = 0, frames = 0, slow = 0, trial = null, stopped = false;
  const clear = () => { last = null; elapsed = frames = slow = 0; };
  return {
    get scale() { return scale; },
    frame(time, active) {
      if (!active || !Number.isFinite(time)) { clear(); return false; }
      if (stopped) return false;
      if (last === null) { last = time; return false; }
      const dt = time - last; last = time;
      if (dt <= 0) { clear(); return false; }
      elapsed += dt; frames++; if (dt > 25) slow++;
      if (elapsed < 3000) return false;
      const mean = elapsed / frames, sustained = slow * 2 > frames; elapsed = frames = slow = 0;
      if (trial) {
        if (mean > trial.mean * .9) { scale = trial.scale; trial = null; stopped = true; return true; }
        trial = null;
      }
      if (mean <= 25 || !sustained || scale <= .5) return false;
      trial = { mean, scale };
      scale = Math.max(.5, scale * .85);
      return true;
    },
    reset() { scale = 1; trial = null; stopped = false; clear(); },
  };
}
