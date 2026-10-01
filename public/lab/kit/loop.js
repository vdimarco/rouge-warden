// The frame loop for the lab toys: the rules step at a fixed rate (1/120 s by default), and the picture is drawn
// once a frame with alpha, how far the clock is between two steps. At most maxSteps run in one frame, so a stalled
// tab does not try to catch up on seconds of play. It stops stepping while the tab is hidden.
// scale() slows the clock (0.3 = slow motion) without changing the step, so the rules stay exact.
export function startLoop({ step, draw, h = 1 / 120, maxSteps = 8, scale = () => 1 }) {
  let last = performance.now(), acc = 0, raf = 0, paused = false, alive = true;
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;
    if (!paused && !document.hidden) {
      acc += dt * scale();
      let n = 0;
      while (acc >= h && n < maxSteps) { step(h); acc -= h; n++; }
      if (n === maxSteps) acc = 0;
    }
    draw(acc / h, dt);
  }
  raf = requestAnimationFrame(frame);
  return {
    stop() { alive = false; cancelAnimationFrame(raf); },
    get paused() { return paused; },
    set paused(v) { paused = !!v; last = performance.now(); },
  };
}

// Size a canvas to its box at the screen's pixel ratio (capped), and call back on every change.
export function fitCanvas(canvas, onSize, maxRatio = 2) {
  const fit = () => {
    const r = Math.min(maxRatio, window.devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight;
    const W = Math.max(1, Math.round(w * r)), H = Math.max(1, Math.round(h * r));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    onSize(W, H, r);
  };
  window.addEventListener("resize", fit);
  if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(canvas);
  fit();
  return fit;
}
