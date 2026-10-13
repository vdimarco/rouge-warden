// Light Years Home: the frame meter. It keeps the last 600 frame times (rAF deltas) and the CPU time of each frame's
// game work (main.js wraps the engine, camera, overlay and HUD in begin() and end()), plus the draw calls and points
// the renderer reports. With ?perf it shows a small readout: median and p95 frame time, CPU p95, draw calls, points,
// quality tier, pixel ratio and the graphics card, with a Copy button that copies the numbers as JSON (the pattern of
// public/tidebreak/perf.js). It sends nothing anywhere.

const SAMPLES = 600;
const SHOW_EVERY = 500;          // ms between readout updates
const SOFTWARE_NOTE = 'Drawn without the graphics card: turn on graphics acceleration in the browser settings.';

// The WebGL renderer string: the graphics card, or a software rasterizer when the browser does not use one.
export function graphicsName(doc = document) {
  try {
    const gl = doc.createElement('canvas').getContext('webgl2') || doc.createElement('canvas').getContext('webgl');
    if (!gl) return 'none';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return 'unknown';
  }
}
export const isSoftware = (name) => /swiftshader|llvmpipe|softpipe|basic render|software/i.test(String(name));

// p50 and p95 of the first n values of a ring buffer, rounded to 0.01 ms.
function percentiles(buf, n) {
  if (!n) return { p50: 0, p95: 0 };
  const s = Array.from(buf.subarray(0, n)).sort((a, b) => a - b);
  const at = (p) => s[Math.min(n - 1, Math.floor(n * p))];
  return { p50: Math.round(at(0.5) * 100) / 100, p95: Math.round(at(0.95) * 100) / 100 };
}

export function createPerf({ doc = typeof document !== 'undefined' ? document : null } = {}) {
  const frames = new Float64Array(SAMPLES), cpus = new Float64Array(SAMPLES);
  let nF = 0, iF = 0, nC = 0, iC = 0, t0 = -1;
  let calls = 0, points = 0, view = null, gpu = null;
  let el = null, pre = null, button = null, shown = false, shownAt = -Infinity;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function begin() { t0 = now(); }
  function end() {
    if (t0 < 0) return;
    cpus[iC] = now() - t0;
    iC = (iC + 1) % SAMPLES;
    nC = Math.min(SAMPLES, nC + 1);
    t0 = -1;
  }

  // dtMs: the time since the last frame; r: what the renderer drew ({ calls, points }).
  function frame(dtMs, r) {
    if (dtMs > 0 && dtMs < 500) {
      frames[iF] = dtMs;
      iF = (iF + 1) % SAMPLES;
      nF = Math.min(SAMPLES, nF + 1);
    }
    if (r) {
      if (Number.isFinite(r.calls)) calls = r.calls;
      if (Number.isFinite(r.points)) points = r.points;
    }
    if (shown && now() - shownAt >= SHOW_EVERY) paint();
  }

  function stats() {
    return { cpu: percentiles(cpus, nC), frame: percentiles(frames, nF), samples: nF, calls, points };
  }

  // Everything the readout shows, as plain data (what Copy copies).
  function report() {
    const s = stats();
    let info = {};
    try {
      // the attached renderer, else what the page's test hook reports (it reads the same view.info())
      const hook = typeof window !== 'undefined' && window.__lyh;
      info = (view && view.info && view.info()) || (hook && hook.perf) || {};
    } catch { info = {}; }
    if (!gpu) gpu = info.gpu || (doc ? graphicsName(doc) : 'unknown');
    const fr = Array.from(frames.subarray(0, nF));
    const slow = Math.max(s.frame.p50 || 16.7, 16.7) * 1.5;   // a slow frame: half as long again as usual
    return {
      game: 'light-years-home',
      frame: s.frame, cpu: s.cpu, fps: s.frame.p50 ? Math.round(1000 / s.frame.p50) : 0,
      slowPercent: fr.length ? Math.round((100 * fr.filter((f) => f > slow).length) / fr.length) : 0,
      samples: s.samples, calls: info.calls ?? calls, points: info.points ?? points,
      tier: info.tier ?? null, ratio: info.ratio ?? null, maxSpritePx: info.maxSpritePx ?? null,
      texBytes: info.texBytes ?? null, backend: info.backend ?? (isSoftware(gpu) ? 'software' : 'hardware'), gpu,
      screen: typeof innerWidth === 'number' ? `${innerWidth}x${innerHeight} @${globalThis.devicePixelRatio || 1}` : '',
    };
  }

  function make() {
    if (el || !doc) return;
    el = doc.createElement('div');
    el.className = 'lyh-perf';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;z-index:40;right:calc(8px + env(safe-area-inset-right,0px));'
      + 'top:calc(100px + env(safe-area-inset-top,0px));max-width:min(300px,calc(100vw - 16px));padding:6px 8px;'
      + 'background:rgba(0,0,0,0.72);color:#d8d8d8;border:1px solid rgba(255,255,255,0.18);border-radius:6px;'
      + 'font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none';
    pre = doc.createElement('pre');
    pre.style.cssText = 'margin:0 0 4px;white-space:pre-wrap;user-select:text';
    button = doc.createElement('button');
    button.type = 'button';
    button.textContent = 'Copy';
    button.style.cssText = 'pointer-events:auto;min-width:44px;min-height:28px;font:inherit;color:#fff;'
      + 'background:#333;border:1px solid #666;border-radius:4px;cursor:pointer';
    button.addEventListener('click', copy);
    el.append(pre, button);
    doc.body.appendChild(el);
  }

  function copy() {
    const text = JSON.stringify(report(), null, 1);
    const done = (label) => { button.textContent = label; setTimeout(() => { button.textContent = 'Copy'; }, 1500); };
    try {
      navigator.clipboard.writeText(text).then(() => done('Copied'), () => { selectText(); done('Select and copy'); });
    } catch {
      selectText();
      done('Select and copy');
    }
  }

  // With no clipboard, the numbers are selected so the player can copy them by hand.
  function selectText() {
    try {
      pre.textContent = JSON.stringify(report(), null, 1);
      const range = doc.createRange();
      range.selectNodeContents(pre);
      const sel = doc.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch { /* nothing more to do */ }
  }

  function paint() {
    if (!el) return;
    shownAt = now();
    const r = report();
    const mb = r.texBytes ? ` · ${(r.texBytes / 1048576).toFixed(1)} MB textures` : '';
    pre.textContent = `frame ${r.frame.p50} ms median · ${r.frame.p95} ms p95 · ${r.fps} fps\n`
      + `cpu ${r.cpu.p50} ms median · ${r.cpu.p95} ms p95 · slow ${r.slowPercent}%\n`
      + `${r.calls} draw calls · ${Math.round(r.points / 1000)}k points${mb}\n`
      + `tier ${r.tier ?? '?'} · pixel ratio ${r.ratio ?? '?'} · ${r.screen}\n`
      + r.gpu + (r.backend === 'software' ? `\n${SOFTWARE_NOTE}` : '');
  }

  function show(on) {
    shown = Boolean(on);
    if (shown) { make(); if (el) el.hidden = false; paint(); } else if (el) el.hidden = true;
  }

  // The renderer, for the readout's tier, pixel ratio, textures and graphics card (view.info()).
  function attach(v) { view = v || null; }

  function reset() { nF = 0; iF = 0; nC = 0; iC = 0; }

  return { begin, end, frame, stats, show, attach, report, reset, get shown() { return shown; } };
}
