// In Full Swing: bloom for flat play. The bright parts of the view (neon, lit windows, the sun, the lamps) glow past their
// edges. No post-processing add-ons ship with the game, so this is a small pass of its own: the scene renders to a
// half-float target, a bright pass keeps what is over a threshold at half size, a chain of blurs at 1/2, 1/4, 1/8 and 1/16
// spreads it, and one full-screen draw adds it over the scene on the canvas. A headset always renders straight.
import * as THREE from "three";

// level → strength (how much glow is added) and threshold (the brightness where glow starts, with a soft knee)
export const BLOOM = {
  low: { strength: 0.55, threshold: 0.8, knee: 0.25 },
  high: { strength: 1.15, threshold: 0.62, knee: 0.3 },
};
const LEVELS = 4;

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const BRIGHT_FS = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThreshold, uKnee;
varying vec2 vUv;
void main() {
  // four taps (a 2 x 2 box at half size), then a soft knee on the brightest channel
  vec3 c = texture2D(uTex, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(uTex, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture2D(uTex, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(uTex, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  c *= 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float w = max(soft, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(c * w, vec3(8.0)), 1.0);
}
`;
const BLUR_FS = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uDir; // one texel along the blur, in uv
varying vec2 vUv;
void main() {
  // a 9-tap Gaussian in five bilinear fetches
  vec3 c = texture2D(uTex, vUv).rgb * 0.2270270;
  c += (texture2D(uTex, vUv + uDir * 1.3846154).rgb + texture2D(uTex, vUv - uDir * 1.3846154).rgb) * 0.3162162;
  c += (texture2D(uTex, vUv + uDir * 3.2307692).rgb + texture2D(uTex, vUv - uDir * 3.2307692).rgb) * 0.0702703;
  gl_FragColor = vec4(c, 1.0);
}
`;
const COMPOSITE_FS = /* glsl */ `
uniform sampler2D uScene, uB0, uB1, uB2, uB3;
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(uScene, vUv).rgb;
  vec3 b = texture2D(uB0, vUv).rgb * 1.0 + texture2D(uB1, vUv).rgb * 0.8 + texture2D(uB2, vUv).rgb * 0.6 + texture2D(uB3, vUv).rgb * 0.45;
  // added light, then a gentle shoulder so a bloomed highlight rolls off instead of clipping flat
  vec3 c = s + b * uStrength;
  c = mix(c, 1.0 - exp(-c), smoothstep(0.85, 1.6, c));
  gl_FragColor = vec4(c, 1.0);
}
`;

export function createBloom(renderer) {
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
  const gl2 = renderer.capabilities.isWebGL2 !== false;
  const sceneRT = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: true, stencilBuffer: true, samples: gl2 ? 4 : 0 });
  const A = [], Bt = []; // per level: the blurred result, and the scratch for the first blur direction
  for (let i = 0; i < LEVELS; i++) { A.push(new THREE.WebGLRenderTarget(1, 1, rtOpts)); Bt.push(new THREE.WebGLRenderTarget(1, 1, rtOpts)); }
  const tri = new THREE.BufferGeometry();
  tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(tri, null);
  quad.frustumCulled = false;
  const mk = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false, fog: false });
  const bright = mk(BRIGHT_FS, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.8 }, uKnee: { value: 0.25 } });
  const blur = mk(BLUR_FS, { uTex: { value: null }, uDir: { value: new THREE.Vector2() } });
  const comp = mk(COMPOSITE_FS, { uScene: { value: sceneRT.texture }, uB0: { value: A[0].texture }, uB1: { value: A[1].texture }, uB2: { value: A[2].texture }, uB3: { value: A[3].texture }, uStrength: { value: 0.5 } });
  const size = new THREE.Vector2();
  let w = 0, h = 0;
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quad, cam); };

  const B = {
    level: "off", frames: 0, last: { calls: 0, triangles: 0 }, // last: the scene's own draw counts (the passes after it would reset them)
    // render scene through camera with the glow of `level` ("off" | "low" | "high"); "off" draws straight to the canvas
    render(scene, camera, level) {
      const L = BLOOM[level];
      B.level = L ? level : "off";
      if (!L) { renderer.render(scene, camera); B.last.calls = renderer.info.render.calls; B.last.triangles = renderer.info.render.triangles; return; }
      renderer.getDrawingBufferSize(size);
      if (size.x !== w || size.y !== h) {
        w = size.x; h = size.y;
        sceneRT.setSize(w, h);
        for (let i = 0; i < LEVELS; i++) { const s = 2 ** (i + 1); A[i].setSize(Math.max(1, Math.round(w / s)), Math.max(1, Math.round(h / s))); Bt[i].setSize(A[i].width, A[i].height); }
      }
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
      B.last.calls = renderer.info.render.calls; B.last.triangles = renderer.info.render.triangles;
      // the bright pass, to 1/2
      bright.uniforms.uTex.value = sceneRT.texture;
      bright.uniforms.uTexel.value.set(1 / w, 1 / h);
      bright.uniforms.uThreshold.value = L.threshold; bright.uniforms.uKnee.value = L.knee;
      pass(bright, A[0]);
      // each level: across into its scratch (reading the level above, which also shrinks it), then down into the level
      for (let i = 0; i < LEVELS; i++) {
        blur.uniforms.uTex.value = A[Math.max(0, i - 1)].texture; blur.uniforms.uDir.value.set(1 / A[i].width, 0);
        pass(blur, Bt[i]);
        blur.uniforms.uTex.value = Bt[i].texture; blur.uniforms.uDir.value.set(0, 1 / A[i].height);
        pass(blur, A[i]);
      }
      comp.uniforms.uStrength.value = L.strength;
      pass(comp, prev);
      B.frames++;
    },
    info: () => ({ level: B.level, size: [w, h], frames: B.frames }),
    dispose() { sceneRT.dispose(); for (const t of [...A, ...Bt]) t.dispose(); tri.dispose(); bright.dispose(); blur.dispose(); comp.dispose(); },
  };
  return B;
}
