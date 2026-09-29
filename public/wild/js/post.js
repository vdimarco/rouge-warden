// The painted look. The scene is drawn into a texture first, then one full-screen pass turns it into
// something closer to a hand-painted film frame: soft brush strokes (a Kuwahara filter), thin ink lines
// where the depth jumps, warm colour grading, a soft glow on bright things, haze around the sun, and paper grain.
// The glow is gathered just before, in a small pass at half size.
import * as THREE from "three";

export const QUALITY = {
// ratio is the starting pixel ratio and maxRatio the most the dynamic resolution may climb to on a sharp screen.
// Low smooths its edges with FXAA in the final pass; Medium and High draw the scene with 4x multisampling.
// dof blurs the few metres right in front of the camera, like a film lens.
  low: { farR: 0, radius: 0, ratio: 0.85, maxRatio: 1.5, glow: 0, samples: 0, fxaa: 1, dof: 0, grass: 50000, patch: 64, shadow: 1024 },
  medium: { farR: 1, radius: 2, ratio: 1, maxRatio: 2, glow: 1, samples: 4, fxaa: 0, dof: 0, grass: 190000, patch: 96, shadow: 2048 },
  high: { farR: 2, radius: 3, ratio: 1.25, maxRatio: 2, glow: 1, samples: 4, fxaa: 0, dof: 1, grass: 310000, patch: 118, shadow: 2048 },
};

export class Painter {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.q = quality;
    this.scale = 1;
    this.target = null;
    this.uniforms = {
      tColor: { value: null }, tDepth: { value: null }, tGlow: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.3 }, uFar: { value: 5000 }, uRadius: { value: quality.radius }, uFarR: { value: quality.farR || 0 }, uHaze: { value: new THREE.Color(0.6, 0.75, 0.9) }, uGlow: { value: quality.glow },
      uTime: { value: 0 }, uSun: { value: new THREE.Vector2(-9, -9) }, uSunVis: { value: 0 }, uSunCol: { value: new THREE.Color(1, 0.92, 0.75) },
      uNight: { value: 0 }, uMood: { value: 0 }, uPunch: { value: 0 }, uInk: { value: new THREE.Color(0.2, 0.15, 0.12) },
    };
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: VERT,
      fragmentShader: frag(quality),
    }));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    // the glow on bright things is gathered first, into a half-size picture that the main pass adds
    this.glowQuad = new THREE.Mesh(this.quad.geometry, new THREE.ShaderMaterial({
      uniforms: { tColor: this.uniforms.tColor, uRes: this.uniforms.uRes }, depthTest: false, depthWrite: false,
      vertexShader: VERT,
      fragmentShader: GLOW,
    }));
    this.glowQuad.frustumCulled = false;
    this.glowScene = new THREE.Scene();
    this.glowScene.add(this.glowQuad);
    this.glowRT = null;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setQuality(q) {
    this.q = q;
    this.uniforms.uRadius.value = q.radius;
    this.uniforms.uFarR.value = q.farR || 0;
    this.uniforms.uGlow.value = q.glow;
    // the brush sizes are written into the shader, so a new setting builds it again
    this.quad.material.fragmentShader = frag(q);
    this.quad.material.needsUpdate = true;
    this.dispose();
  }
  dispose() {
    if (this.target) { this.target.depthTexture.dispose(); this.target.dispose(); this.target = null; }
    if (this.glowRT) { this.glowRT.dispose(); this.glowRT = null; }
  }
  ensure() {
    const r = this.renderer, s = r.getDrawingBufferSize(new THREE.Vector2());
    if (this.target && this.target.width === s.x && this.target.height === s.y) return;
    this.dispose();
    const dt = new THREE.DepthTexture(s.x, s.y);
    dt.type = THREE.UnsignedIntType;
    this.target = new THREE.WebGLRenderTarget(s.x, s.y, { depthTexture: dt, samples: this.q.samples, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    // the glow is soft, so half the size each way is enough
    if (this.q.glow) this.glowRT = new THREE.WebGLRenderTarget(Math.ceil(s.x / 2), Math.ceil(s.y / 2), { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.uniforms.tGlow.value = this.glowRT ? this.glowRT.texture : null;
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
      U.uMood.value = look.mood || 0; U.uPunch.value = look.punch || 0;
      if (look.haze) U.uHaze.value.copy(look.haze);
      // where the sun is on screen, and whether anything hides it
      const p = look.sunDir.clone().multiplyScalar(1000).add(camera.position).project(camera);
      const front = p.z < 1 && look.sunDir.y > -0.05;
      U.uSun.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
      U.uSunVis.value = front ? Math.max(0, Math.min(1, look.sunDir.y * 4 + 0.2)) * (1 - look.night) : 0;
      U.uSunCol.value.copy(look.sunCol);
    }
    if (this.glowRT) { r.setRenderTarget(this.glowRT); r.render(this.glowScene, this.cam); r.setRenderTarget(null); }
    r.render(this.scene, this.cam);
  }
}

const VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

// Kuwahara: split the neighbourhood in four, and keep the average of the calmest quarter.
// Edges stay sharp and flat areas turn into soft patches of colour, like brush strokes.
// The brush is written out here texel by texel, for the sizes its setting can reach, so the shader has no loop
// or quarter test left to run. Each texel is read once and added to every quarter it belongs to: the middle row
// and column belong to two quarters, the centre to all four. A broader brush only adds rings around the
// smallest one, so pixels with different sizes side by side cost no more than the broadest.
const tap = (i, j) => {
  const inside = [i <= 0 && j <= 0, i >= 0 && j <= 0, i <= 0 && j >= 0, i >= 0 && j >= 0];
  return `  c = texture2D(tColor, uv + vec2(${i}.0, ${j}.0) * px).rgb; cc = c * c;` + inside.map((b, k) => (b ? ` m${k} += c; s${k} += cc;` : "")).join("") + "\n";
};
const brush = (q) => {
  const top = q.radius + (q.farR || 0), base = Math.max(1, q.radius);
  if (top < 1) return q.fxaa ? FXAA : "vec3 brush(vec2 uv, float R, vec2 px, bool sky, float soft) { return texture2D(tColor, uv).rgb; }";
  let taps = "";
  for (let j = -base; j <= base; j++) for (let i = -base; i <= base; i++) taps += tap(i, j);
  // each broader size adds a ring: its left and right columns, then the rest of its top and bottom rows
  for (let r = base + 1; r <= top; r++) {
    taps += `  if (R > ${r - 1}.5) {\n`;
    for (let j = -r; j <= r; j++) taps += "  " + tap(-r, j) + "  " + tap(r, j);
    for (let i = 1 - r; i < r; i++) taps += "  " + tap(i, -r) + "  " + tap(i, r);
    taps += "  }\n";
  }
  return /* glsl */ `
void calm(vec3 m, vec3 s, float n, inout vec3 best, inout float bv) {
  vec3 mu = m / n; vec3 v = abs(s / n - mu * mu);
  float vv = v.r + v.g + v.b;
  if (vv < bv) { bv = vv; best = mu; }
}
vec3 brush(vec2 uv, float R, vec2 px, bool sky, float soft) {
  // Open sky that is flat across the whole brush comes out as its own colour anyway, so it skips the brush.
  // The centre and the four corners tell: they must be within one 8-bit step of each other.
  if (sky) {
    vec2 o = R * px;
    vec3 c = texture2D(tColor, uv).rgb;
    vec3 a = texture2D(tColor, uv - o).rgb, b = texture2D(tColor, uv + o).rgb;
    vec3 e = texture2D(tColor, uv + vec2(o.x, -o.y)).rgb, f = texture2D(tColor, uv + vec2(-o.x, o.y)).rgb;
    vec3 d = max(max(c, a), max(b, max(e, f))) - min(min(c, a), min(b, min(e, f)));
    if (max(d.r, max(d.g, d.b)) < 1.5 / 255.0) return c;
  }
  vec3 m0 = vec3(0.0), m1 = m0, m2 = m0, m3 = m0, s0 = m0, s1 = m0, s2 = m0, s3 = m0, c, cc;
${taps}  float n = (R + 1.0) * (R + 1.0);
  vec3 best = m0 / n; float bv = 1e9;
  calm(m0, s0, n, best, bv); calm(m1, s1, n, best, bv); calm(m2, s2, n, best, bv); calm(m3, s3, n, best, bv);
  // soft: the calmest quarter gives crisp strokes, but far hills turn blocky with it. There, and in the lens blur
  // right in front of the camera, it fades into the plain average of all four quarters: a smooth wash.
  return soft > 0.0 ? mix(best, (m0 + m1 + m2 + m3) / (4.0 * n), soft) : best;
}`;
};

// FXAA for Low, which has no brush: find the direction of an edge from the four diagonal neighbours and blend
// along it. Flat areas return after five reads, and an edge costs four more.
const FXAA = /* glsl */ `
vec3 brush(vec2 uv, float R, vec2 px, bool sky, float soft) {
  vec3 cM = texture2D(tColor, uv).rgb;
  if (sky) return cM;
  float lM = luma(cM);
  float lNW = luma(texture2D(tColor, uv + vec2(-1.0, -1.0) * px).rgb), lNE = luma(texture2D(tColor, uv + vec2(1.0, -1.0) * px).rgb);
  float lSW = luma(texture2D(tColor, uv + vec2(-1.0, 1.0) * px).rgb), lSE = luma(texture2D(tColor, uv + vec2(1.0, 1.0) * px).rgb);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.03, lMax * 0.12)) return cM;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -8.0, 8.0) * px;
  vec3 a = 0.5 * (texture2D(tColor, uv - dir * 0.1667).rgb + texture2D(tColor, uv + dir * 0.1667).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tColor, uv - dir * 0.5).rgb + texture2D(tColor, uv + dir * 0.5).rgb);
  float lB = luma(b);
  return (lB < lMin || lB > lMax) ? a : b;
}`;

// The glow ring, worked out once for each texel of a half-size picture. Each half-size texel stands on one
// full-size texel, so the thresholds see the same colours as before, and the steps are full-size pixels.
const GLOW = /* glsl */ `
uniform sampler2D tColor; uniform vec2 uRes;
void main() {
  vec2 px = 1.0 / uRes, uv = (floor(gl_FragCoord.xy) * 2.0 + 0.5) * px;
  vec3 g = vec3(0.0);
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.785398;
    vec2 o = vec2(cos(a), sin(a)) * px;
    vec3 c1 = texture2D(tColor, uv + o * 5.0).rgb, c2 = texture2D(tColor, uv + o * 13.0).rgb;
    g += max(c1 - 0.78, 0.0) + max(c2 - 0.8, 0.0) * 0.7;
  }
  gl_FragColor = vec4(g * 0.16, 1.0);
}`;

const frag = (q) => /* glsl */ `
uniform sampler2D tColor, tDepth, tGlow; uniform vec2 uRes, uSun; uniform float uNear, uFar, uRadius, uFarR, uGlow, uTime, uSunVis, uNight, uMood, uPunch;
#define DOF ${q.dof ? "1.0" : "0.0"}
uniform vec3 uSunCol, uInk, uHaze; varying vec2 vUv;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
${brush(q)}
void main() {
  vec2 uv = vUv, px = 1.0 / uRes;
  float d0 = texture2D(tDepth, uv).r;
  float z0 = lin(d0);
  // far away, the brush gets broader, so distant hills turn into soft painted shapes
  float far = d0 < 1.0 ? smoothstep(70.0, 380.0, z0) : 0.0;
  float R = uRadius + floor(uFarR * far + 0.5);
  // far hills become a soft wash; with DOF, so does the first few metres in front of the lens
  float soft = max(far * 0.7, DOF * smoothstep(2.8, 1.2, z0));
  vec3 col = R > 0.5 || ${q.fxaa ? "true" : "false"} ? brush(uv, R, px, d0 >= 1.0, soft) : texture2D(tColor, uv).rgb;
  // a big hit: the colours split for a moment, out from the middle of the screen
  if (uPunch > 0.01) { vec2 o = (uv - 0.5) * uPunch * 0.012; col.r = mix(col.r, texture2D(tColor, uv + o).r, 0.8); col.b = mix(col.b, texture2D(tColor, uv - o).b, 0.8); }
  // aerial perspective: the farther away, the more it fades into a clear, cool blue
  float haze = d0 < 1.0 ? (1.0 - exp(-max(z0 - 50.0, 0.0) / 520.0)) : 0.0;
  vec3 hz = uHaze; hz = clamp(mix(vec3(dot(hz, vec3(0.299, 0.587, 0.114))), hz, 1.5) * 0.93, 0.0, 1.0);
  col = mix(col, hz * (1.0 - uNight * 0.6), haze * 0.42);
  col = mix(col, col * vec3(0.9, 0.98, 1.08), haze);
  // ink lines where the depth jumps: silhouettes of hills, trees, people, and buildings
  float zl = lin(texture2D(tDepth, uv - vec2(px.x, 0.0)).r), zr = lin(texture2D(tDepth, uv + vec2(px.x, 0.0)).r);
  float zd = lin(texture2D(tDepth, uv - vec2(0.0, px.y)).r), zu = lin(texture2D(tDepth, uv + vec2(0.0, px.y)).r);
  // an outline is where the depth bends sharply compared with how fast it already changes.
  // Long ground seen at a low angle changes fast but bends little, so it gets no line.
  float gx = abs(zr - zl) * 0.5, gy = abs(zu - zd) * 0.5;
  float sx = abs(zl + zr - 2.0 * z0), sy = abs(zd + zu - 2.0 * z0);
  float bendR = max(sx / (gx + z0 * 0.004), sy / (gy + z0 * 0.004));
  float size = max(sx, sy) / max(z0, 0.001);
  float ink = smoothstep(1.0, 1.8, bendR) * smoothstep(0.02, 0.07, size) * (1.0 - smoothstep(40.0, 320.0, z0)) * (d0 < 1.0 ? 1.0 : 0.0);
  // no ink between grass blades: the grass writes 0 in alpha, and thousands of dark lines in a field look scratchy
  if (ink > 0.001) ink *= min(texture2D(tColor, uv).a, min(min(texture2D(tColor, uv - vec2(px.x, 0.0)).a, texture2D(tColor, uv + vec2(px.x, 0.0)).a),
    min(texture2D(tColor, uv - vec2(0.0, px.y)).a, texture2D(tColor, uv + vec2(0.0, px.y)).a)));
  col = mix(col, col * uInk * 2.2, ink * 0.42);
  // soft glow on bright things: sunlit clouds, water sparkles, fire, the King's eyes. It comes from the half-size
  // glow picture; half a pixel over, each even pixel reads exactly the texel made for it.
  if (uGlow > 0.5) col += texture2D(tGlow, uv + 0.5 * px).rgb;
  // haze around the sun, like light in the air on a summer afternoon
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float sd = length((uv - uSun) * asp);
  col += uSunCol * uSunVis * (exp(-sd * 3.2) * 0.28 + exp(-sd * 12.0) * 0.25);
  // colour grade: cool, lifted shadows, warm highlights, a touch more colour
  float l = luma(col);
  col = mix(vec3(l), col, 1.12 - uNight * 0.26);
  col = mix(col * vec3(0.9, 0.97, 1.08) + vec3(0.02, 0.03, 0.05), col, smoothstep(0.0, 0.45, l));
  col = mix(col, col * vec3(1.05, 1.01, 0.92), smoothstep(0.55, 1.0, l));
  // paper grain and a soft vignette
  float grain = vnoise(uv * uRes * 0.5) * 0.6 + vnoise(uv * uRes * 0.12) * 0.4;
  col *= 0.965 + 0.05 * grain;
  float v = length((uv - 0.5) * asp);
  col *= mix(1.0, 0.8 - uMood * 0.18, smoothstep(0.45 - uMood * 0.12, 1.05, v));
  // the King's storm: a cool purple grade with less colour
  col = mix(col, vec3(luma(col)) * vec3(0.92, 0.86, 1.08), uMood * 0.3);
  col += vec3(1.0, 0.96, 0.9) * uPunch * 0.18;
  gl_FragColor = vec4(col, 1.0);
}`;
