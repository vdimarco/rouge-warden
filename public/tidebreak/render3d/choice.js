// Which battlefield renderer to start: the 3D one needs WebGL2 on a graphics card. This file does not import three.js,
// so the 2D fallback never downloads it.
const KEY = 'tidebreak.renderer';
let probe = null;
// { webgl2, software, name }: one throwaway context, released at once.
export function graphicsSupport() {
  if (probe) return probe;
  probe = { webgl2: false, software: false, name: 'none' };
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      probe.name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      probe.webgl2 = true; probe.software = /swiftshader|llvmpipe|softpipe|basic render|software/i.test(probe.name);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {}
  return probe;
}
// ?renderer=2d|3d wins, then the player's saved choice, then 3D where a graphics card draws WebGL2. A browser that draws
// without the graphics card gets 2D, which stays playable there; ?renderer=3d still forces 3D (QA uses it).
export function rendererChoice(search = location.search) {
  const asked = /[?&]renderer=(2d|3d)/i.exec(search)?.[1]?.toLowerCase(), support = graphicsSupport();
  if (asked) return asked === '3d' && support.webgl2 ? '3d' : '2d';
  let saved = null; try { saved = localStorage.getItem(KEY); } catch {}
  if (!support.webgl2) return '2d';
  if (saved === '2d' || saved === '3d') return saved;
  return support.software ? '2d' : '3d';
}
export function saveRendererChoice(mode) { try { localStorage.setItem(KEY, mode); } catch {} }
