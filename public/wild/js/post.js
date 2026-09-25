// The painted look. The scene is drawn into a texture first, then one full-screen pass turns it into
// something closer to a hand-painted film frame: soft brush strokes (a Kuwahara filter), thin ink lines
// where the depth jumps, warm colour grading, a soft glow on bright things, haze around the sun, and paper grain.
import * as THREE from "three";

export const QUALITY = {
  low: { radius: 0, ratio: 0.85, glow: 0, samples: 0, grass: 32000, patch: 64, shadow: 1024 },
  medium: { radius: 2, ratio: 1, glow: 1, samples: 0, grass: 90000, patch: 96, shadow: 2048 },
  high: { radius: 3, ratio: 1.25, glow: 1, samples: 4, grass: 150000, patch: 118, shadow: 2048 },
};

export class Painter {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.q = quality;
    this.scale = 1;
    this.target = null;
    this.uniforms = {
      tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.3 }, uFar: { value: 5000 }, uRadius: { value: quality.radius }, uGlow: { value: quality.glow },
      uTime: { value: 0 }, uSun: { value: new THREE.Vector2(-9, -9) }, uSunVis: { value: 0 }, uSunCol: { value: new THREE.Color(1, 0.92, 0.75) },
      uNight: { value: 0 }, uInk: { value: new THREE.Color(0.2, 0.15, 0.12) },
    };
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: FRAG,
    }));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setQuality(q) {
    this.q = q;
    this.uniforms.uRadius.value = q.radius;
    this.uniforms.uGlow.value = q.glow;
    this.dispose();
  }
  dispose() { if (this.target) { this.target.depthTexture.dispose(); this.target.dispose(); this.target = null; } }
  ensure() {
    const r = this.renderer, s = r.getDrawingBufferSize(new THREE.Vector2());
    if (this.target && this.target.width === s.x && this.target.height === s.y) return;
    this.dispose();
    const dt = new THREE.DepthTexture(s.x, s.y);
    dt.type = THREE.UnsignedIntType;
    this.target = new THREE.WebGLRenderTarget(s.x, s.y, { depthTexture: dt, samples: this.q.samples, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.uniforms.uRes.value.set(s.x, s.y);
  }
  render(scene, camera, look) {
    const r = this.renderer, U = this.uniforms;
    this.ensure();
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    U.tColor.value = this.target.texture;
    U.tDepth.value = this.target.depthTexture;
    U.uNear.value = camera.near; U.uFar.value = camera.far;
    if (look) {
      U.uTime.value = look.time;
      U.uNight.value = look.night;
      // where the sun is on screen, and whether anything hides it
      const p = look.sunDir.clone().multiplyScalar(1000).add(camera.position).project(camera);
      const front = p.z < 1 && look.sunDir.y > -0.05;
      U.uSun.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
      U.uSunVis.value = front ? Math.max(0, Math.min(1, look.sunDir.y * 4 + 0.2)) * (1 - look.night) : 0;
      U.uSunCol.value.copy(look.sunCol);
    }
    r.render(this.scene, this.cam);
  }
}

const FRAG = /* glsl */ `
uniform sampler2D tColor, tDepth; uniform vec2 uRes, uSun; uniform float uNear, uFar, uRadius, uGlow, uTime, uSunVis, uNight;
uniform vec3 uSunCol, uInk; varying vec2 vUv;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
// Kuwahara: split the neighbourhood in four, and keep the average of the calmest quarter.
// Edges stay sharp and flat areas turn into soft patches of colour, like brush strokes.
vec3 kuwahara(vec2 uv, float R) {
  vec2 px = 1.0 / uRes;
  vec3 m[4]; vec3 s[4];
  for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
  float n = 0.0;
  for (int j = 0; j <= 3; j++) {
    if (float(j) > R) break;
    for (int i = 0; i <= 3; i++) {
      if (float(i) > R) break;
      vec3 a = texture2D(tColor, uv + vec2(-i, -j) * px).rgb; m[0] += a; s[0] += a * a;
      vec3 b = texture2D(tColor, uv + vec2( i, -j) * px).rgb; m[1] += b; s[1] += b * b;
      vec3 c = texture2D(tColor, uv + vec2(-i,  j) * px).rgb; m[2] += c; s[2] += c * c;
      vec3 d = texture2D(tColor, uv + vec2( i,  j) * px).rgb; m[3] += d; s[3] += d * d;
      n += 1.0;
    }
  }
  vec3 best = m[0] / n; float bv = 1e9;
  for (int k = 0; k < 4; k++) {
    vec3 mu = m[k] / n; vec3 v = abs(s[k] / n - mu * mu);
    float vv = v.r + v.g + v.b;
    if (vv < bv) { bv = vv; best = mu; }
  }
  return best;
}
void main() {
  vec2 uv = vUv, px = 1.0 / uRes;
  vec3 col = uRadius > 0.5 ? kuwahara(uv, uRadius) : texture2D(tColor, uv).rgb;
  // ink lines where the depth jumps: silhouettes of hills, trees, people, and buildings
  float d0 = texture2D(tDepth, uv).r;
  float z0 = lin(d0);
  float zl = lin(texture2D(tDepth, uv - vec2(px.x, 0.0)).r), zr = lin(texture2D(tDepth, uv + vec2(px.x, 0.0)).r);
  float zd = lin(texture2D(tDepth, uv - vec2(0.0, px.y)).r), zu = lin(texture2D(tDepth, uv + vec2(0.0, px.y)).r);
  float lap = abs(zl + zr + zd + zu - 4.0 * z0) / max(z0, 0.001);
  float ink = smoothstep(0.08, 0.35, lap) * (1.0 - smoothstep(40.0, 320.0, z0)) * (d0 < 1.0 ? 1.0 : 0.0);
  col = mix(col, col * uInk * 2.2, ink * 0.55);
  // soft glow on bright things: sunlit clouds, water sparkles, fire, the King's eyes
  if (uGlow > 0.5) {
    vec3 g = vec3(0.0);
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.785398;
      vec2 o = vec2(cos(a), sin(a)) * px;
      vec3 c1 = texture2D(tColor, uv + o * 5.0).rgb, c2 = texture2D(tColor, uv + o * 13.0).rgb;
      g += max(c1 - 0.78, 0.0) + max(c2 - 0.8, 0.0) * 0.7;
    }
    col += g * 0.16;
  }
  // haze around the sun, like light in the air on a summer afternoon
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float sd = length((uv - uSun) * asp);
  col += uSunCol * uSunVis * (exp(-sd * 3.2) * 0.28 + exp(-sd * 12.0) * 0.25);
  // colour grade: cool, lifted shadows, warm highlights, a touch more colour
  float l = luma(col);
  col = mix(vec3(l), col, 1.04 - uNight * 0.2);
  col = mix(col * vec3(0.9, 0.97, 1.08) + vec3(0.02, 0.03, 0.05), col, smoothstep(0.0, 0.45, l));
  col = mix(col, col * vec3(1.05, 1.01, 0.92), smoothstep(0.55, 1.0, l));
  // paper grain and a soft vignette
  float grain = vnoise(uv * uRes * 0.5) * 0.6 + vnoise(uv * uRes * 0.12) * 0.4;
  col *= 0.965 + 0.05 * grain;
  float v = length((uv - 0.5) * asp);
  col *= mix(1.0, 0.8, smoothstep(0.45, 1.05, v));
  gl_FragColor = vec4(col, 1.0);
}`;
