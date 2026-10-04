import { useCallback, useEffect, useRef, useState } from 'react';
import { tick, type ClockState } from './motion';

/** Called with the scene and the time span that the last frame played, so sounds can fire at their times. */
export type CueHandler = (scene: number, from: number, to: number) => void;

/**
 * The explainer's clock: the scene and the time in it, moved on each animation frame unless paused. `go` starts a
 * scene from its beginning. The scene after the last one is the end card, where the time stops.
 */
export function useSceneClock(lengths: readonly number[], paused: boolean, onCue: CueHandler) {
  const [state, setState] = useState<ClockState>({ scene: 0, t: 0 });
  const current = useRef(state);
  const pausedRef = useRef(paused);
  const cueRef = useRef(onCue);

  useEffect(() => {
    pausedRef.current = paused;
    cueRef.current = onCue;
  }, [paused, onCue]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        const prev = current.current;
        const next = tick(prev, dt, lengths);
        if (next !== prev) {
          cueRef.current(prev.scene, prev.t, next.scene === prev.scene ? next.t : (lengths[prev.scene] ?? prev.t));
          current.current = next;
          setState(next);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [lengths]);

  const go = useCallback(
    (scene: number) => {
      const next = { scene: Math.max(0, Math.min(lengths.length, scene)), t: 0 };
      current.current = next;
      setState(next);
    },
    [lengths],
  );

  return { scene: state.scene, t: state.t, go };
}
