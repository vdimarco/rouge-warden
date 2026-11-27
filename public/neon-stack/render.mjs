// WebGL2 sprite-stack renderer. One instanced quad, nearest sampling, no mipmaps.

const VERT = `#version 300 es
layout(location=0) in vec2 aC;
layout(location=1) in vec4 i0;
layout(location=2) in vec4 i1;
layout(location=3) in vec4 i2;
uniform mat4 uVP;
uniform float uHead;
out vec2 vUV;
out vec3 vW;
flat out float vKind;
flat out float vSign;
flat out float vOrient;
flat out vec4 vRect;
out vec2 vCorner;
void main() {
  float upright = step(0.5, i2.w);
  float faceZ = step(1.5, i2.w);
  float lx = (0.5 - aC.x) * i0.w * 2.0;
  float lz = (aC.y - 0.5) * i1.x * 2.0;
  // Kind 1 lying flat is the runner stack. Buildings stay axis-aligned.
  if (abs(i2.y - 1.0) < 0.25 && upright < 0.5) {
    float c = cos(uHead);
    float s = sin(uHead);
    float rx = lx * c - lz * s;
    float rz = lx * s + lz * c;
    lx = rx;
    lz = rz;
  }
  vec3 horiz = vec3(i0.x + lx, i0.z, i0.y + lz);
  vec3 faceX = vec3(i0.x, i0.z + (aC.y - 0.5) * i1.x * 2.0, i0.y + (aC.x - 0.5) * i0.w * 2.0);
  vec3 faceZv = vec3(i0.x + (aC.x - 0.5) * i0.w * 2.0, i0.z + (aC.y - 0.5) * i1.x * 2.0, i0.y);
  vW = mix(horiz, mix(faceX, faceZv, faceZ), upright);
  vec2 uvA = vec2(i1.y, i1.z);
  vec2 uvB = vec2(i1.w, i2.x);
  vUV = mix(uvA, uvB, aC);
  vRect = vec4(min(uvA, uvB), max(uvA, uvB));
  vKind = i2.y;
  vSign = i2.z;
  vOrient = i2.w;
  vCorner = aC;
  gl_Position = uVP * vec4(vW, 1.0);
  if (abs(i2.y - 1.0) < 0.25) gl_Position.z -= 0.02 * gl_Position.w;
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform vec3 uSun;
uniform vec3 uHaze;
uniform float uTile;
uniform vec3 uOutline;
uniform float uOutlineOn;
uniform vec2 uCam;
uniform vec2 uRunner;
uniform float uFade[8];
uniform vec4 uL[8];
uniform vec4 uC[8];
uniform float uI[8];
in vec2 vUV;
in vec3 vW;
flat in float vKind;
flat in float vSign;
flat in float vOrient;
flat in vec4 vRect;
in vec2 vCorner;
layout(location=0) out vec4 o;

float fadeOf(float s) {
  float f = 1.0;
  f = mix(f, uFade[1], step(0.5, s) * step(s, 1.5));
  f = mix(f, uFade[2], step(1.5, s) * step(s, 2.5));
  f = mix(f, uFade[3], step(2.5, s) * step(s, 3.5));
  f = mix(f, uFade[4], step(3.5, s) * step(s, 4.5));
  f = mix(f, uFade[5], step(4.5, s) * step(s, 5.5));
  f = mix(f, uFade[6], step(5.5, s) * step(s, 6.5));
  return f;
}

float sdBox(vec2 p, vec2 a, vec2 b) {
  vec2 c = (a + b) * 0.5;
  vec2 h = (b - a) * 0.5;
  vec2 d = abs(p - c) - h;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float lotGap(vec2 p) {
  float d = 4.0;
  d = min(d, sdBox(p, vec2(0.0, 0.0), vec2(2.0, 2.0)));
  d = min(d, sdBox(p, vec2(4.0, 0.0), vec2(6.0, 2.0)));
  d = min(d, sdBox(p, vec2(0.0, 3.0), vec2(2.0, 4.0)));
  d = min(d, sdBox(p, vec2(4.0, 3.0), vec2(6.0, 4.0)));
  d = min(d, sdBox(p, vec2(0.0, 5.0), vec2(2.0, 6.0)));
  d = min(d, sdBox(p, vec2(4.0, 5.0), vec2(6.0, 6.0)));
  return d;
}
float ovalShade(vec2 d, float rx, float ry) {
  float e = d.x * d.x / (rx * rx) + d.y * d.y / (ry * ry);
  return e < 1.0 ? 0.78 : 1.0;
}
float falloff(vec2 p, vec4 L, float I) {
  float live = step(0.15, I) * step(0.5, L.w);
  float r = length(p - L.xz / uTile);
  return (1.0 - smoothstep(1.0, 2.0, r)) * live;
}

void main() {
  vec4 t = texture(uAtlas, vUV);
  float runner = step(abs(vKind - 1.0), 0.25);
  if (runner > 0.5 && t.a < 0.5) {
    if (uOutlineOn < 0.5) discard;
    vec2 one = vec2(1.0 / 1024.0);
    vec2 lo = vRect.xy + one * 0.5;
    vec2 hi = vRect.zw - one * 0.5;
    float edge = 0.0;
    for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
      int ax = x < 0 ? -x : x;
      int ay = y < 0 ? -y : y;
      int cheb = ax > ay ? ax : ay;
      if (cheb < 1 || cheb > 2) continue;
      vec2 s = vUV + one * vec2(float(x), float(y));
      if (s.x < lo.x || s.y < lo.y || s.x > hi.x || s.y > hi.y) continue;
      edge = max(edge, texture(uAtlas, s).a);
    }
    if (edge < 0.5) discard;
    o = vec4(uOutline, 1.0);
    return;
  }
  if (t.a < 0.5) discard;
  vec3 col = t.rgb;
  if (abs(vKind - 8.0) < 0.25 && t.r > 0.55 && t.g > 0.25 && t.b < 0.45 && t.r > t.b + 0.25) {
    float lumT = dot(t.rgb, vec3(0.299, 0.587, 0.114));
    col = clamp(vec3(201.0, 133.0, 58.0) / 255.0 * (0.82 + 0.36 * lumT), vec3(187.0, 119.0, 44.0) / 255.0, vec3(215.0, 147.0, 72.0) / 255.0);
  }
  float hi = max(col.r, max(col.g, col.b));
  float lo = min(col.r, min(col.g, col.b));
  float neon = step(0.25, hi - lo) * step(0.45, hi);
  vec3 dark = vec3(0.290, 0.282, 0.322);
  if (runner > 0.5) { o = vec4(col, 1.0); return; }
  vec3 ink = vec3(0.102, 0.102, 0.133);
  if (abs(vKind - 5.0) < 0.25) {
    float u = vCorner.x;
    float v = vCorner.y;
    float h = 0.16;
    h = max(h, step(abs(u - 0.07), 0.028) * 0.58);
    h = max(h, step(abs(u - 0.16), 0.045) * 0.82);
    h = max(h, step(abs(u - 0.28), 0.03) * 0.46);
    h = max(h, step(abs(u - 0.40), 0.05) * 0.68);
    h = max(h, step(abs(u - 0.52), 0.018) * 0.94);
    h = max(h, step(abs(u - 0.64), 0.042) * 0.52);
    h = max(h, step(abs(u - 0.76), 0.032) * 0.74);
    h = max(h, step(abs(u - 0.88), 0.036) * 0.42);
    float tower = max(step(v, h), step(abs(u - 0.52), 0.007) * step(v, 0.99));
    vec3 sky = vec3(16.0, 26.0, 46.0) / 255.0;
    vec3 sil = vec3(8.0, 9.0, 14.0) / 255.0;
    col = mix(sky, sil, tower);
    o = vec4(col, 1.0);
    return;
  }
  if (abs(vKind - 10.0) < 0.25) { o = vec4(ink, 1.0); return; }
  if (abs(vKind - 11.0) < 0.25) {
    vec3 roof = vec3(74.0, 72.0, 82.0) / 255.0;
    float edgeDist = min(min(vCorner.x, 1.0 - vCorner.x), min(vCorner.y, 1.0 - vCorner.y));
    float lip = step(edgeDist, 1.0 / 16.0);
    col = mix(roof, vec3(94.0, 91.0, 102.0) / 255.0, lip);
    o = vec4(col, 1.0);
    return;
  }
  if (abs(vKind - 12.0) < 0.25) {
    col *= 0.45;
    o = vec4(col, 1.0);
    return;
  }
  if (abs(vKind - 14.0) < 0.25) { o = vec4(vec3(43.0, 42.0, 51.0) / 255.0, 1.0); return; }
  if (abs(vKind - 15.0) < 0.25) { o = vec4(vec3(74.0, 72.0, 82.0) / 255.0, 1.0); return; }
  if (abs(vKind - 16.0) < 0.25) {
    vec3 hot = vec3(255.0, 170.0, 24.0) / 255.0;
    o = vec4(mix(vec3(242.0, 163.0, 58.0) / 255.0, hot, clamp(vSign, 0.0, 1.0)), 1.0);
    return;
  }
  if (abs(vKind - 7.0) < 0.25) {
    int i = int(clamp(vSign - 0.5, 0.0, 6.0));
    col = mix(col, uC[i].rgb, 0.4 * fadeOf(vSign));
    o = vec4(col, 1.0);
    return;
  }
  float wall = step(abs(vKind - 8.0), 0.25);
  if (wall > 0.5 && !(t.r > 0.55 && t.g > 0.25 && t.b < 0.45 && t.r > t.b + 0.25)) {
    if (vSign < 0.0) {
      float cell = 4.0;
      float cx = floor(vW.x / cell);
      float cy = floor(vW.y / cell);
      float n = fract(sin(cx * 12.9898 + cy * 78.233 + floor(vW.z) * 45.164) * 43758.5453);
      float n2 = fract(sin(cx * 39.346 + cy * 11.135) * 24634.6345);
      float ox = floor(n2 * cell);
      float oy = floor(fract(n2 * 7.13) * cell);
      float here = step(abs(mod(floor(vW.x), cell) - ox), 0.0) * step(abs(mod(floor(vW.y), cell) - oy), 0.0);
      o = vec4((here * step(0.833, n) > 0.5 ? vec3(201.0, 133.0, 58.0) : vec3(43.0, 42.0, 51.0)) / 255.0, 1.0);
      return;
    } else {
    float kd = vKind - 8.0;
    float tint = floor(kd / 0.03 + 0.001);
    float rem = mod(kd + 0.0001, 0.03);
    float bottom = step(0.005, rem) * step(rem, 0.015);
    float top = step(0.015, rem);
    vec3 face = vec3(43.0, 42.0, 51.0) / 255.0;
    if (top > 0.5) face = vec3(48.0, 47.0, 56.0) / 255.0;
    vec3 dye = tint < 0.5 ? vec3(1.10, 0.84, 0.90) : tint < 1.5 ? vec3(0.84, 1.08, 0.90) : vec3(0.90, 0.94, 1.10);
    float lum = dot(face, vec3(0.299, 0.587, 0.114));
    vec3 dyed = face * dye;
    dyed *= lum / max(0.001, dot(dyed, vec3(0.299, 0.587, 0.114)));
    col = top > 0.5 ? dyed : mix(dyed, dyed * 0.92, bottom);
    }
  }
  float dim = step(abs(vKind - 4.0), 0.25);
  col = mix(col, col * 0.38, dim);
  if (abs(vKind) < 0.25) {
    vec2 p = vW.xz / uTile;
    float gap = lotGap(p);
    float shade = 1.0;
    if (gap > 0.0 && gap < 0.3) shade = 0.72;
    vec2 sun = normalize(vec2(0.48, 0.26));
    if (lotGap(p + sun * 0.5) < 0.0 || lotGap(p + sun) < 0.0) shade = min(shade, 0.85);
    shade = min(shade, ovalShade(p - uRunner, 0.46, 0.30));
    shade = min(shade, ovalShade(p - vec2(1.15, 2.5), 0.22, 0.14));
    shade = min(shade, ovalShade(p - vec2(1.6, 4.5), 0.22, 0.14));
    shade = min(shade, ovalShade(p - vec2(2.35, 1.2), 0.18, 0.12));
    shade = min(shade, ovalShade(p - vec2(3.55, 4.5), 0.22, 0.14));
    col *= shade;
    float w0 = falloff(p, uL[0], uI[0]);
    float w1 = falloff(p, uL[1], uI[1]);
    float w2 = falloff(p, uL[2], uI[2]);
    float w3 = falloff(p, uL[3], uI[3]);
    float w4 = falloff(p, uL[4], uI[4]);
    float w5 = falloff(p, uL[5], uI[5]);
    vec3 glow = uC[0].rgb * w0 + uC[1].rgb * w1 + uC[2].rgb * w2
      + uC[3].rgb * w3 + uC[4].rgb * w4 + uC[5].rgb * w5;
    float cover = min(1.0, w0 + w1 + w2 + w3 + w4 + w5);
    col = mix(col, clamp(glow, 0.0, 1.0), cover * 0.62);
  }
  float fade = fadeOf(vSign);
  col = mix(col, mix(dark, col, fade), neon * (1.0 - dim) * (1.0 - wall));
  col = mix(col, uHaze, clamp(vW.y / 220.0, 0.0, 1.0) * 0.18 * (1.0 - neon) * (1.0 - runner) * (1.0 - wall));
  o = vec4(col, 1.0);
}`;

const COMP = `#version 300 es
precision highp float;
uniform sampler2D uAlb;
uniform vec2 uDrop[60];
uniform vec3 uSmog;
uniform vec4 uHalo[8];
uniform vec4 uHaloC[8];
uniform highp float uTime;
in vec2 vUV;
vec3 streak(vec3 col, vec2 pix, vec4 h, vec4 c, float gap, float ground) {
  float y0 = min(h.y, c.w);
  float y1 = max(h.y, c.w);
  float s = step(abs(pix.x - h.x), 0.5) * step(y0, pix.y) * step(pix.y, y1) * gap * step(0.2, h.z);
  return mix(col, c.rgb, s * ground * 0.35);
}
layout(location=0) out vec4 o;
void main() {
  vec3 col = texture(uAlb, vUV).rgb;
  vec2 pix = floor(gl_FragCoord.xy);
  float rain = 0.0;
  for (int i = 0; i < 60; i++) {
    vec2 d = pix - uDrop[i];
    rain = max(rain, step(0.0, d.x) * step(d.x, 2.01) * step(abs(d.y + d.x), 0.1));
  }
  float amber = step(abs(col.r - 201.0 / 255.0), 18.0 / 255.0);
  amber *= step(abs(col.g - 139.0 / 255.0), 18.0 / 255.0);
  amber *= step(abs(col.b - 60.0 / 255.0), 18.0 / 255.0);
  col = mix(col, uSmog, rain * 0.4 * (1.0 - amber));
  float mx = max(col.r, max(col.g, col.b));
  vec3 sky = vec3(14.0, 16.0, 32.0) / 255.0;
  vec3 ink = vec3(26.0, 26.0, 34.0) / 255.0;
  float ground = step(0.045, length(col - sky)) * step(mx, 0.24) * step(0.06, length(col - ink));
  float gap = 1.0 - step(0.5, mod(pix.y, 2.0));
  col = streak(col, pix, uHalo[0], uHaloC[0], gap, ground);
  col = streak(col, pix, uHalo[1], uHaloC[1], gap, ground);
  col = streak(col, pix, uHalo[2], uHaloC[2], gap, ground);
  col = streak(col, pix, uHalo[3], uHaloC[3], gap, ground);
  col = streak(col, pix, uHalo[4], uHaloC[4], gap, ground);
  col = streak(col, pix, uHalo[5], uHaloC[5], gap, ground);
  o = vec4(col, 1.0);
}`;

const FULL = `#version 300 es
precision highp float;
out vec2 vUV;
void main() {
  // p is 0 or 2. The visible half of this triangle is UV 0..1, so vUV stays p.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const BLITV = `#version 300 es
layout(location=0) in vec2 aP;
layout(location=1) in vec2 aU;
uniform vec2 uBack;
out vec2 vUV;
void main() {
  vec2 c = (aP / uBack) * 2.0 - 1.0;
  gl_Position = vec4(c, 0.0, 1.0);
  vUV = aU;
}`;

const BLITF = `#version 300 es
precision highp float;
uniform sampler2D uArt;
in vec2 vUV;
layout(location=0) out vec4 o;
void main() { o = vec4(texture(uArt, vUV).rgb, 1.0); }`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
  return p;
}
function texParams(gl, filter) {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
function target(gl, w, h, depth) {
  const color = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, color);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  texParams(gl, gl.NEAREST);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  let dep = null;
  if (depth) {
    dep = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, dep);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, dep);
  }
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("framebuffer incomplete");
  return { fb, color, dep, w, h };
}

export function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
export function lookAt(eye, at, up) {
  const z = norm([eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]]);
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}
export function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}
export function invert(m) {
  const o = new Float32Array(16);
  o[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  o[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  o[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  o[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  o[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  o[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  o[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  o[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  o[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  o[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  o[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  o[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  o[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  o[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  o[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  o[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
  let det = m[0] * o[0] + m[1] * o[4] + m[2] * o[8] + m[3] * o[12];
  if (!det) return o;
  det = 1 / det;
  for (let i = 0; i < 16; i++) o[i] *= det;
  return o;
}
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function xform(m, v) {
  const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3];
  const y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3];
  const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3];
  const w = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3];
  return [x / w, y / w, z / w];
}

export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL2 is not available");
  let stackProg, compProg, blitProg, quad, inst, vao, blitVao, blitBuf, atlasTex;
  let stackU = null, compU = null, blitU = null;
  let atlasImg = null;
  const data = new Float32Array(4096 * 12);
  function boot() {
    stackProg = program(gl, VERT, FRAG);
    compProg = program(gl, FULL, COMP);
    blitProg = program(gl, BLITV, BLITF);
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    inst = gl.createBuffer();
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(1 + i);
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, 48, i * 16);
      gl.vertexAttribDivisor(1 + i, 1);
    }
    blitVao = gl.createVertexArray();
    blitBuf = gl.createBuffer();
    gl.bindVertexArray(blitVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, blitBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
    atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    texParams(gl, gl.NEAREST);
    if (atlasImg) uploadAtlas();
    const loc = (prog, names) => {
      const out = {};
      for (const name of names) out[name] = gl.getUniformLocation(prog, name);
      return out;
    };
    stackU = loc(stackProg, ["uVP", "uHead", "uSun", "uHaze", "uTile", "uOutline", "uOutlineOn", "uCam", "uRunner", "uFade", "uL", "uC", "uI", "uAtlas"]);
    compU = loc(compProg, ["uAlb", "uDrop", "uSmog", "uHalo", "uHaloC", "uTime"]);
    blitU = loc(blitProg, ["uBack", "uArt"]);
  }
  function uploadAtlas() {
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImg);
    texParams(gl, gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  boot();

  const api = {
    gl, drawCalls: 0, slices: 0,
    view: { artW: 2, artH: 2, scale: 1, ox: 0, oy: 0, backW: 2, backH: 2 },
    vp: new Float32Array(16),
    tile: 32,
    outline: [0.24, 0.88, 0.91],
    outlineOn: 0,
    frame: [0, 0, 1, 1],
    setAtlas: (img) => { atlasImg = img; uploadAtlas(); },
  };
  let alb = null, light = null, comp = null, lost = false;
  const drop = () => {
    for (const t of [alb, light, comp]) if (t) {
      gl.deleteFramebuffer(t.fb);
      gl.deleteTexture(t.color);
      if (t.dep) gl.deleteRenderbuffer(t.dep);
    }
    alb = light = comp = null;
  };
  function ensure(artW, artH, half) {
    if (!alb || alb.w !== artW || alb.h !== artH) {
      drop();
      alb = target(gl, artW, artH, true);
      comp = target(gl, artW, artH, false);
    }
    const lw = Math.max(1, half ? Math.floor(artW / 2) : artW);
    const lh = Math.max(1, half ? Math.floor(artH / 2) : artH);
    if (!light || light.w !== lw || light.h !== lh) {
      if (light) { gl.deleteFramebuffer(light.fb); gl.deleteTexture(light.color); gl.deleteRenderbuffer(light.dep); }
      light = target(gl, lw, lh, true);
    }
  }
  function upload(slices) {
    const n = Math.min(slices.length, 4096);
    for (let i = 0; i < n; i++) {
      const s = slices[i], o = i * 12;
      data[o] = s.x; data[o + 1] = s.z; data[o + 2] = s.y; data[o + 3] = s.hx;
      data[o + 4] = s.hz; data[o + 5] = s.uv[0]; data[o + 6] = s.uv[1]; data[o + 7] = s.uv[2];
      data[o + 8] = s.uv[3]; data[o + 9] = s.kind; data[o + 10] = s.sign; data[o + 11] = s.orient || 0;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * 12), gl.DYNAMIC_DRAW);
    return n;
  }
  function drawStack(pass, count) {
    gl.useProgram(stackProg);
    gl.uniformMatrix4fv(stackU.uVP, false, api.vp);
    gl.uniform1f(stackU.uHead, api.head || 0);
    gl.uniform3fv(stackU.uSun, api.sun);
    gl.uniform3fv(stackU.uHaze, api.haze);
    gl.uniform1f(stackU.uTile, api.tile || 32);
    gl.uniform3fv(stackU.uOutline, api.outline || [0, 0, 0]);
    gl.uniform1f(stackU.uOutlineOn, api.outlineOn || 0);
    gl.uniform2fv(stackU.uCam, api.camXZ || [0, 0]);
    gl.uniform2fv(stackU.uRunner, api.runnerXZ || [0, 0]);
    gl.uniform1fv(stackU.uFade, api.fade);
    gl.uniform4fv(stackU.uL, api.lights);
    gl.uniform4fv(stackU.uC, api.lightColor);
    gl.uniform1fv(stackU.uI, api.intensity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform1i(stackU.uAtlas, 0);
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    api.drawCalls++;
    api.slices += count;
  }
  api.resize = (cssW, cssH, dpr, ratio) => {
    const ref = Math.min(dpr || 1, 2);
    const targetW = Math.max(1, cssW * ref);
    let step = Math.max(1, Math.ceil(targetW / 320));
    let artW = Math.floor(targetW / step);
    while (artW > 320 && step < 32) {
      step++;
      artW = Math.floor(targetW / step);
    }
    if (artW < 256) artW = 256;
    const artH = Math.max(2, Math.round(artW * cssH / Math.max(1, cssW)));
    const blit = Math.max(1, Math.floor((cssW * (ratio || 1)) / artW));
    const backW = artW * blit;
    const backH = artH * blit;
    api.view = { artW, artH, scale: blit, ox: 0, oy: 0, backW, backH, cssW, cssH, ratio: ratio || 1 };
    ensure(artW, artH, cssW < 800);
  };
  api.draw = (scene) => {
    if (lost || !alb) return;
    api.drawCalls = 0;
    api.slices = 0;
    api.vp = scene.vp;
    api.sun = scene.sun;
    api.haze = scene.haze;
    api.rim = scene.rim;
    api.fade = scene.fade;
    api.outline = scene.outline;
    api.outlineOn = scene.outlineOn;
    api.camXZ = scene.camXZ;
    api.runnerXZ = scene.runnerXZ;
    api.head = scene.head || 0;
    api.lights = scene.lights;
    api.lightColor = scene.lightColor;
    api.intensity = scene.intensity;
    const { artW, artH, scale, ox, oy, backW, backH } = api.view;
    const count = upload(scene.slices);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, alb.fb);
    gl.viewport(0, 0, artW, artH);
    gl.clearColor(26 / 255, 26 / 255, 34 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawStack(0, count);
    if (scene.runnerPaper && scene.runnerCount > 0) {
      gl.depthFunc(gl.GREATER);
      gl.depthMask(false);
      const kept = api.slices;
      drawStack(1, scene.runnerCount);
      gl.depthFunc(gl.LEQUAL);
      drawStack(0, scene.runnerCount);
      api.slices = kept;
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
    }
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, comp.fb);
    gl.viewport(0, 0, artW, artH);
    gl.useProgram(compProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, alb.color);
    gl.uniform1i(compU.uAlb, 0);
    gl.uniform2fv(compU.uDrop, scene.drops);
    gl.uniform3fv(compU.uSmog, scene.smog);
    gl.uniform4fv(compU.uHalo, scene.halo);
    gl.uniform4fv(compU.uHaloC, scene.haloColor);
    gl.uniform1f(compU.uTime, scene.time);
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    api.drawCalls++;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, backW, backH);
    gl.clearColor(26 / 255, 26 / 255, 34 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const x0 = ox, y0 = oy, x1 = ox + artW * scale, y1 = oy + artH * scale;
    const quadData = new Float32Array([
      x0, y0, 0, 0, x1, y0, 1, 0, x0, y1, 0, 1, x1, y1, 1, 1,
    ]);
    gl.useProgram(blitProg);
    gl.bindVertexArray(blitVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, blitBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.DYNAMIC_DRAW);
    gl.uniform2f(blitU.uBack, backW, backH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, comp.color);
    gl.uniform1i(blitU.uArt, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    api.drawCalls++;
  };
  api.project = (world) => {
    const p = xform(api.vp, [world[0], world[1], world[2], 1]);
    return { x: (p[0] * 0.5 + 0.5) * api.view.artW, y: (0.5 - p[1] * 0.5) * api.view.artH, z: p[2] };
  };
  api.pixel = (ax, ay) => {
    const { scale, ox, oy, artH } = api.view;
    const bx = Math.floor(ox + (ax + 0.5) * scale);
    const by = Math.floor(oy + (artH - ay - 0.5) * scale);
    const buf = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(bx, by, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return [buf[0], buf[1], buf[2]];
  };
  api.client = (ax, ay, rect) => {
    const { scale, ox, oy, artH, backW, backH } = api.view;
    const bx = ox + ax * scale;
    const byTop = backH - (oy + (artH - ay) * scale);
    return { x: rect.left + bx * rect.width / backW, y: rect.top + byTop * rect.height / backH };
  };
  api.unproject = (ax, ay) => {
    const { artW, artH } = api.view;
    const nx = ((ax + 0.5) / artW) * 2 - 1;
    const ny = (1 - (ay + 0.5) / artH) * 2 - 1;
    const inv = invert(api.vp);
    const a = xform(inv, [nx, ny, 0, 1]);
    const b = xform(inv, [nx, ny, 1, 1]);
    const dy = b[1] - a[1];
    if (Math.abs(dy) < 1e-6) return null;
    const t = (0.05 - a[1]) / dy;
    return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t];
  };
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    alb = light = comp = null;
    boot();
    api.resize(api.view.cssW, api.view.cssH, window.devicePixelRatio || 1, api.view.ratio || 1);
  });
  api.lost = () => lost;
  return api;
}
