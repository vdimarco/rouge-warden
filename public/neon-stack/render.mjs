// WebGL2 sprite-stack renderer. One instanced quad, nearest sampling, no mipmaps.
// Point lights are a second geometry pass (half resolution on narrow viewports).
// The 4 light steps are applied after that pass is sampled, so the bands stay square.

const VERT = `#version 300 es
layout(location=0) in vec2 aC;
layout(location=1) in vec4 i0;
layout(location=2) in vec4 i1;
layout(location=3) in vec4 i2;
uniform mat4 uVP;
out vec2 vUV;
out vec3 vW;
flat out float vKind;
flat out float vSign;
void main() {
  float upright = step(0.5, i2.w);
  float faceZ = step(1.5, i2.w);
  vec3 horiz = vec3(i0.x + (aC.x - 0.5) * i0.w * 2.0, i0.z, i0.y + (aC.y - 0.5) * i1.x * 2.0);
  vec3 faceX = vec3(i0.x, i0.z + (aC.y - 0.5) * i1.x * 2.0, i0.y + (aC.x - 0.5) * i0.w * 2.0);
  vec3 faceZv = vec3(i0.x + (aC.x - 0.5) * i0.w * 2.0, i0.z + (aC.y - 0.5) * i1.x * 2.0, i0.y);
  vW = mix(horiz, mix(faceX, faceZv, faceZ), upright);
  vUV = mix(vec2(i1.y, i1.z), vec2(i1.w, i2.x), aC);
  vKind = i2.y;
  vSign = i2.z;
  gl_Position = uVP * vec4(vW, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform vec3 uSun;
uniform vec3 uHaze;
uniform float uTile;
uniform vec3 uOutline;
uniform float uFade[8];
uniform vec4 uL[8];
uniform vec4 uC[8];
uniform float uI[8];
in vec2 vUV;
in vec3 vW;
flat in float vKind;
flat in float vSign;
layout(location=0) out vec4 o;

float fadeOf(float s) {
  float f = uFade[0];
  f = mix(f, uFade[1], step(0.5, s) * step(s, 1.5));
  f = mix(f, uFade[2], step(1.5, s) * step(s, 2.5));
  f = mix(f, uFade[3], step(2.5, s) * step(s, 3.5));
  f = mix(f, uFade[4], step(3.5, s) * step(s, 4.5));
  f = mix(f, uFade[5], step(4.5, s) * step(s, 5.5));
  f = mix(f, uFade[6], step(5.5, s) * step(s, 6.5));
  return f;
}

void main() {
  vec4 t = texture(uAtlas, vUV);
  float runner = step(abs(vKind - 1.0), 0.25);
  if (runner > 0.5 && t.a < 0.5) {
    float edge = 0.0;
    vec2 one = vec2(1.0 / 1024.0);
    for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
      edge = max(edge, texture(uAtlas, vUV + one * vec2(float(x), float(y))).a);
    }
    if (edge < 0.5) discard;
    o = vec4(uOutline, 1.0);
    return;
  }
  if (t.a < 0.5) discard;
  vec3 col = t.rgb;
  float hi = max(col.r, max(col.g, col.b));
  float lo = min(col.r, min(col.g, col.b));
  float neon = step(0.25, hi - lo) * step(0.45, hi);
  vec3 dark = vec3(0.290, 0.282, 0.322);
  if (runner > 0.5) { o = vec4(col, 1.0); return; }
  if (abs(vKind - 5.0) < 0.25) {
    col = mix(dark, col, max(uFade[0], 1.0 - neon));
    o = vec4(col, 1.0);
    return;
  }
  float dim = step(abs(vKind - 4.0), 0.25);
  col = mix(col, col * 0.38, dim);
  float wall = step(abs(vKind - 8.0), 0.25) * (1.0 - neon);
  vec2 tile = floor(vW.xz / uTile);
  float best = 0.0;
  vec3 lcol = col;
  for (int i = 0; i < 8; i++) {
    float live = step(0.15, uI[i]) * step(0.5, uL[i].w);
    vec2 st = floor(uL[i].xz / uTile);
    float horiz = max(abs(tile.x - st.x), abs(tile.y - st.y));
    float vert = abs(floor(vW.y / uTile) - floor(uL[i].y / uTile));
    float amt = 0.0;
    amt = mix(amt, 0.10, step(horiz, 0.5) * step(0.5, vert) * step(vert, 3.5));
    amt = mix(amt, 0.40, step(horiz, 0.5) * step(vert, 0.5));
    float win = step(best, amt * live);
    best = max(best, amt * live);
    lcol = mix(lcol, uC[i].rgb, win);
  }
  col = mix(col, lcol, 0.0);
  float fade = fadeOf(vSign);
  col = mix(col, mix(dark, col, fade), neon * (1.0 - dim));
  col = mix(col, uHaze, clamp(vW.y / 220.0, 0.0, 1.0) * 0.18 * (1.0 - neon) * (1.0 - runner));
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
layout(location=0) out vec4 o;
void main() {
  vec3 col = texture(uAlb, vUV).rgb;
  vec2 pix = floor(gl_FragCoord.xy);
  float rain = 0.0;
  for (int i = 0; i < 60; i++) {
    vec2 d = pix - uDrop[i];
    rain = max(rain, step(0.0, d.x) * step(d.x, 2.01) * step(abs(d.y + d.x), 0.1));
  }
  col = mix(col, uSmog, rain * 0.4);
  float mx = max(col.r, max(col.g, col.b));
  vec3 sky = vec3(14.0, 16.0, 32.0) / 255.0;
  float ground = step(0.045, length(col - sky)) * step(mx, 0.24);
  float gap = 1.0 - step(0.5, mod(pix.y, 2.0));
  for (int i = 0; i < 8; i++) {
    float y0 = min(uHalo[i].y, uHaloC[i].w);
    float y1 = max(uHalo[i].y, uHaloC[i].w);
    float streak = step(abs(pix.x - uHalo[i].x), 0.5) * step(y0, pix.y) * step(pix.y, y1) * gap * step(0.2, uHalo[i].z);
    col = mix(col, uHaloC[i].rgb, streak * ground * 0.35);
  }
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
    gl.uniformMatrix4fv(gl.getUniformLocation(stackProg, "uVP"), false, api.vp);
    gl.uniform3fv(gl.getUniformLocation(stackProg, "uSun"), api.sun);
    gl.uniform3fv(gl.getUniformLocation(stackProg, "uHaze"), api.haze);
    gl.uniform1f(gl.getUniformLocation(stackProg, "uTile"), api.tile || 32);
    gl.uniform3fv(gl.getUniformLocation(stackProg, "uOutline"), api.outline || [0.24, 0.88, 0.91]);
    gl.uniform1fv(gl.getUniformLocation(stackProg, "uFade"), api.fade);
    gl.uniform4fv(gl.getUniformLocation(stackProg, "uL"), api.lights);
    gl.uniform4fv(gl.getUniformLocation(stackProg, "uC"), api.lightColor);
    gl.uniform1fv(gl.getUniformLocation(stackProg, "uI"), api.intensity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform1i(gl.getUniformLocation(stackProg, "uAtlas"), 0);
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
    api.lights = scene.lights;
    api.lightColor = scene.lightColor;
    api.intensity = scene.intensity;
    const { artW, artH, scale, ox, oy, backW, backH } = api.view;
    const count = upload(scene.slices);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, alb.fb);
    gl.viewport(0, 0, artW, artH);
    gl.clearColor(14 / 255, 16 / 255, 32 / 255, 1);
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
    gl.uniform1i(gl.getUniformLocation(compProg, "uAlb"), 0);
    gl.uniform2fv(gl.getUniformLocation(compProg, "uDrop"), scene.drops);
    gl.uniform3fv(gl.getUniformLocation(compProg, "uSmog"), scene.smog);
    gl.uniform4fv(gl.getUniformLocation(compProg, "uHalo"), scene.halo);
    gl.uniform4fv(gl.getUniformLocation(compProg, "uHaloC"), scene.haloColor);
    gl.uniform1f(gl.getUniformLocation(compProg, "uTime"), scene.time);
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    api.drawCalls++;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, backW, backH);
    gl.clearColor(14 / 255, 16 / 255, 32 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const x0 = ox, y0 = oy, x1 = ox + artW * scale, y1 = oy + artH * scale;
    const quadData = new Float32Array([
      x0, y0, 0, 0, x1, y0, 1, 0, x0, y1, 0, 1, x1, y1, 1, 1,
    ]);
    gl.useProgram(blitProg);
    gl.bindVertexArray(blitVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, blitBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.DYNAMIC_DRAW);
    gl.uniform2f(gl.getUniformLocation(blitProg, "uBack"), backW, backH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, comp.color);
    gl.uniform1i(gl.getUniformLocation(blitProg, "uArt"), 0);
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
