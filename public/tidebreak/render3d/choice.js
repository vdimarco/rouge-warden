// Probe 3D graphics support. Shore has one battlefield renderer.
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
