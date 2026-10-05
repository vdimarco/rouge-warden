// Frame timing the player can read and copy, shown with ?perf in the address or the "Show performance" setting.
// It tells a slow graphics card, a browser drawing without the graphics card and a busy main thread apart.
const KEY = 'tidebreak.perf', SAMPLES = 600;
// The WebGL renderer string names the graphics card, or a software rasterizer when the browser does not use one.
export function graphicsRenderer() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return 'none';
    const info = gl.getExtension('WEBGL_debug_renderer_info'), name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return 'unknown'; }
}
export const softwareRendering = name => /swiftshader|llvmpipe|softpipe|basic render|software/i.test(name);
const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
const percentile = (list, p) => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
export class PerfMeter {
  constructor(el) {
    this.el = el; this.frames = []; this.draws = []; this.stepLog = []; this.shownAt = 0;
    this.gpu = graphicsRenderer(); this.software = softwareRendering(this.gpu);
    let saved = false; try { saved = localStorage.getItem(KEY) === 'on'; } catch {}
    this.on = saved || new URLSearchParams(location.search).has('perf');
    el.querySelector('button').onclick = () => { const text = JSON.stringify(this.report(this.renderer), null, 1); navigator.clipboard?.writeText(text).catch(() => {}); el.querySelector('button').textContent = 'Copied'; };
  }
  toggle() { this.on = !this.on; try { localStorage.setItem(KEY, this.on ? 'on' : 'off'); } catch {} if (!this.on) this.el.hidden = true; return this.on; }
  // A new match starts from no samples, so menu and draft frames never colour its numbers.
  reset() { this.frames = []; this.draws = []; this.stepLog = []; }
  // sample: the match is running and not paused. Only those frames count; the readout shows whenever a match is open.
  frame(ms, steps, drawMs, renderer, visible, sample = visible) {
    this.renderer = renderer;
    if (sample && ms > 0 && ms < 500) {
      this.frames.push(ms); this.draws.push(drawMs); this.stepLog.push(Math.min(3, steps));
      if (this.frames.length > SAMPLES) { this.frames.shift(); this.draws.shift(); this.stepLog.shift(); }
    }
    this.el.hidden = !(this.on && visible);
    const now = performance.now(); if (this.el.hidden || now - this.shownAt < 500) return; this.shownAt = now;
    const r = this.report(renderer);
    this.el.querySelector('pre').textContent = `frame ${r.medianMs} ms median · ${r.p95Ms} ms p95 · ${r.fps} fps\nslow frames ${r.slowPercent}% · draw ${r.drawMs} ms · steps/frame ${r.stepsPerFrame.join('/')}\ncanvas ${r.canvas} · quality ${r.quality} · pixel ratio ${r.pixelRatio} · screen ${r.screen}\ngraphics ${r.gpu}${this.software ? '\nThis browser draws the game without the graphics card. Turn on graphics acceleration in the browser settings.' : ''}`;
  }
  report(renderer) {
    const m = median(this.frames), refresh = Math.min(m || 16.7, renderer?.refreshMs ?? 16.7), counts = [0, 0, 0, 0], total = this.stepLog.length || 1;
    for (const n of this.stepLog) counts[n]++;
    return {
      medianMs: +m.toFixed(1), p95Ms: +percentile(this.frames, .95).toFixed(1), fps: m ? Math.round(1000 / m) : 0,
      slowPercent: Math.round(100 * this.frames.filter(f => f > refresh * 1.5).length / (this.frames.length || 1)),
      drawMs: +median(this.draws).toFixed(1), stepsPerFrame: counts.map(n => Math.round(100 * n / total)),
      canvas: renderer ? `${renderer.canvas.width}x${renderer.canvas.height}` : 'none', quality: +(renderer?.quality ?? 1).toFixed(2),
      pixelRatio: +(renderer?.dpr ?? 1).toFixed(2), screen: `${innerWidth}x${innerHeight} @${devicePixelRatio}`, gpu: this.gpu, software: this.software,
    };
  }
}
