// Field renderer: draws the Lenia dish as lit, glowing jelly on living agar.
// The texture holds prey (R), hunters (G) and agar (B). Two textures blend between sim steps.

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
uniform vec4 uRect; // dish rect in clip space: x, y, w, h
void main() {
  vUv = aPos;
  gl_Position = vec4(uRect.xy + aPos * uRect.zw, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPrev, uCur;
uniform float uMix, uTime, uFrenzy, uHurt, uFlash;
uniform vec2 uTexel;
uniform vec3 uPlayer; // uv.x, uv.y, light 0..1
// combat feedback; every radius is in dish cells and a radius of 0 marks an empty slot
uniform vec4 uMark[8]; // uv.x, uv.y, radius, code + progress (1 heat, 2 glint, 3 stagger, 4 exposed, 5 collapse, 6 egg crack)
uniform vec4 uHit[8];  // uv.x, uv.y, radius, strength
uniform vec4 uRing;    // uv.x, uv.y, radius, strength
uniform float uStasis;
uniform float uCalm; // 1 with reduced motion: steady tints, no pulses or flicker
uniform float uZoom; // the dish growing: 0.5 shows the middle quarter at full size, 1 the whole dish
uniform vec4 uConvert; // the molt wave: uv.x, uv.y, radius in cells, strength (hunter tissue inside turns prey-coloured)
uniform float uTier; // the size: hunters' heartbeat quickens and their hot core grows

const float TAU = 6.2831853;
const vec3 GOLD = vec3(1.0, 0.78, 0.25);

// torus distance in cells from this pixel to a point in uv
float cellDist(vec2 uv, vec2 c) {
  vec2 d = uv - c;
  d -= floor(d + 0.5);
  return length(d / uTexel);
}

vec4 F(vec2 uv, float lod) { return mix(textureLod(uPrev, uv, lod), textureLod(uCur, uv, lod), uMix); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

vec3 preyRamp(float a) {
  vec3 c = mix(vec3(0.02, 0.25, 0.32), vec3(0.08, 0.85, 0.85), smoothstep(0.08, 0.45, a));
  c = mix(c, vec3(0.75, 1.0, 0.92), smoothstep(0.55, 0.95, a));
  return c;
}
vec3 hunterRamp(float b) {
  vec3 c = mix(vec3(0.35, 0.02, 0.12), vec3(1.0, 0.16, 0.45), smoothstep(0.08, 0.5, b));
  float hot = 0.6 - 0.04 * clamp(uTier - 1.0, 0.0, 4.0);
  c = mix(c, vec3(1.0, 0.72, 0.55), smoothstep(hot, 0.98, b));
  return c;
}

void main() {
  vec2 uv = 0.5 + (vUv - 0.5) * uZoom;
  // gentle wobble, like looking through a drop of water
  uv += 0.0012 * vec2(sin(uv.y * 40.0 + uTime * 0.8), cos(uv.x * 34.0 + uTime * 0.7));
  vec4 f = F(uv, 0.0);
  float a = f.r, b = f.g, n = f.b;

  // agar: fresh agar is deep teal, depleted agar turns murky violet
  vec2 cell = uv / uTexel; // dish cells, so the texture keeps its shape in both orientations
  float caust = noise(cell / 14.0 + uTime * 0.05) * noise(cell / 8.0 - uTime * 0.04);
  vec3 col = mix(vec3(0.05, 0.02, 0.07), vec3(0.015, 0.07, 0.085), n);
  col += vec3(0.02, 0.09, 0.1) * caust * n;
  col += 0.018 * (hash(cell * 2.0 + floor(uTime * 12.0)) - 0.5);

  // relief lighting from the field gradient
  vec2 dx = vec2(uTexel.x, 0.0), dy = vec2(0.0, uTexel.y);
  // the current step alone is enough for lighting
  vec4 xp = textureLod(uCur, uv + dx, 0.0), xm = textureLod(uCur, uv - dx, 0.0);
  vec4 yp = textureLod(uCur, uv + dy, 0.0), ym = textureLod(uCur, uv - dy, 0.0);
  float gx = (xp.r + xp.g) - (xm.r + xm.g);
  float gy = (yp.r + yp.g) - (ym.r + ym.g);
  vec3 nrm = normalize(vec3(-gx * 2.2, -gy * 2.2, 1.0));
  vec3 L = normalize(vec3(-0.5, -0.6, 0.8));
  float diff = clamp(dot(nrm, L), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-L, nrm), vec3(0, 0, 1)), 0.0, 1.0), 24.0);

  // soft glow from blurred mip levels
  vec4 g1 = F(uv, 1.6), g2 = F(uv, 3.2);
  col += vec3(0.05, 0.55, 0.6) * (g1.r * 0.55 + g2.r * 0.6);
  // the molt wave: hunter tissue it has passed takes the prey colours
  float cv = uConvert.w * (1.0 - smoothstep(uConvert.z - 8.0, uConvert.z, cellDist(uv, uConvert.xy)));
  col += mix(vec3(0.75, 0.05, 0.3), vec3(0.05, 0.55, 0.6), cv) * (g1.g * 0.6 + g2.g * 0.7);

  float pa = smoothstep(0.04, 0.3, a), pb = smoothstep(0.04, 0.3, b);
  vec3 pc = preyRamp(a) * (0.55 + 0.6 * diff) + spec * 0.55 * vec3(0.8, 1.0, 1.0);
  vec3 hc = hunterRamp(b) * (0.55 + 0.6 * diff) + spec * 0.5 * vec3(1.0, 0.85, 0.8);
  // hunters pulse with a heartbeat that quickens with each size
  hc *= 0.9 + 0.12 * sin(uTime * (5.0 + 0.8 * clamp(uTier - 1.0, 0.0, 4.0)) + b * 8.0);
  hc = mix(hc, preyRamp(b) * (0.55 + 0.6 * diff) + spec * 0.55 * vec3(0.8, 1.0, 1.0), cv);
  col = mix(col, pc, pa * 0.92);
  col = mix(col, hc, pb * 0.95);

  // in Frenzy the hunters look edible: gold edges
  float edge = smoothstep(0.05, 0.25, b) * (1.0 - smoothstep(0.3, 0.7, b));
  col += uFrenzy * vec3(1.0, 0.75, 0.2) * edge * 0.9;

  // hunter marks: only hunter tissue takes the tint
  float pop = 0.0; // staggered, Exposed and collapsing bodies keep full color in Stasis
  for (int i = 0; i < 8; i++) {
    vec4 m = uMark[i];
    if (m.z <= 0.0) continue;
    float k = 1.0 - smoothstep(m.z * 0.7, m.z, cellDist(uv, m.xy));
    float w = k * pb;
    if (w <= 0.0) continue;
    float code = floor(m.w + 0.001), p = clamp(m.w - code, 0.0, 1.0);
    if (code == 1.0) { // windup: red heating toward white-red, 6 Hz pulse
      float pulse = mix(0.5 + 0.5 * sin(uTime * 6.0 * TAU), 0.5, uCalm);
      vec3 hot = mix(vec3(1.0, 0.2, 0.12), vec3(1.0, 0.88, 0.82), p * p);
      col = mix(col, hot * (0.7 + 0.45 * diff), w * (0.3 + 0.55 * p));
      col += hot * w * pulse * (0.08 + 0.3 * p);
    } else if (code == 2.0) { // glint
      col = mix(col, vec3(1.0, 0.97, 0.95), w * 0.85);
      col += vec3(0.4) * w;
    } else if (code == 3.0) { // stagger: gold rim, 6 Hz pulse
      float pulse = mix(0.5 + 0.5 * sin(uTime * 6.0 * TAU), 0.5, uCalm);
      col = mix(col, GOLD * (0.55 + 0.5 * diff), w * 0.3);
      col += GOLD * k * edge * (0.5 + 0.9 * pulse);
      pop = max(pop, w);
    } else if (code == 4.0) { // Exposed: dimmed and cooled
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      // dim rose-grey: cooled, but never the blue of food
      col = mix(col, vec3(l) * vec3(1.0, 0.8, 0.85), w * 0.7);
      pop = max(pop, w);
    } else if (code == 5.0) { // collapse: whole body gold, 3 Hz pulse
      float pulse = mix(0.5 + 0.5 * sin(uTime * 3.0 * TAU), 0.5, uCalm);
      col = mix(col, GOLD * (0.6 + 0.5 * diff), w * (0.45 + 0.35 * pulse));
      col += GOLD * w * pulse * 0.25;
      pop = max(pop, w);
    } else if (code == 6.0) { // egg crack: fast flicker, quicker as it nears hatching
      // stepped rate (9, 13.5, 18 Hz): a rate that slides with p would scramble the phase at large uTime
      float flick = uCalm > 0.5 ? 0.5 : step(0.5, fract(uTime * (9.0 + 4.5 * floor(p * 3.0))));
      col += vec3(1.0, 0.65, 0.8) * w * flick * (0.25 + 0.5 * p);
    }
  }

  // cut flashes: white on torn hunter tissue
  for (int i = 0; i < 8; i++) {
    vec4 hz = uHit[i];
    if (hz.z <= 0.0) continue;
    float k = 1.0 - smoothstep(hz.z * 0.35, hz.z, cellDist(uv, hz.xy));
    col += vec3(1.0, 0.96, 0.92) * pb * k * clamp(hz.w, 0.0, 1.0) * 1.1;
  }

  // Burst ring: hunter tissue inside the front lights up, plus a faint gold band at the front
  if (uRing.z > 0.0 && uRing.w > 0.0) {
    float d = cellDist(uv, uRing.xy) - uRing.z;
    float band = exp(-d * d / 2.5), front = exp(-d * d / 18.0);
    float inside = 1.0 - smoothstep(-1.0, 1.0, d);
    col += vec3(1.0, 0.82, 0.5) * pb * uRing.w * (0.25 * inside + 0.6 * front);
    col += GOLD * band * uRing.w * 0.22;
  }

  // a soft light around the player
  vec2 pd = uv - uPlayer.xy;
  pd = (pd - floor(pd + 0.5)) / uTexel / 40.0;
  col += vec3(0.25, 0.35, 0.3) * uPlayer.z * exp(-dot(pd, pd) * 3.0) * 0.35;

  // vignette at the dish rim
  vec2 e = min(vUv, 1.0 - vUv) / vec2(uTexel.x * 10.0, uTexel.y * 10.0);
  float rim = smoothstep(0.0, 1.0, min(e.x, e.y));
  col *= 0.55 + 0.45 * rim;

  col = mix(col, vec3(0.9, 0.1, 0.2), uHurt * 0.18);
  col += uFlash * vec3(0.5, 0.9, 0.85);
  col = col / (1.0 + col * 0.35); // soft tone map
  // Stasis grade: 60% grey plus a violet tint at 25%
  if (uStasis > 0.0) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 graded = mix(col, vec3(l), 0.6);
    graded = mix(graded, vec3(0.55, 0.45, 1.0) * (0.3 + l), 0.25);
    col = mix(col, graded, uStasis * (1.0 - pop));
  }
  outColor = vec4(pow(col, vec3(0.92)), 1.0);
}`;

export class FieldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    this.gl = gl;
    if (!gl) return;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.prog = p;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, "aPos");
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const name of ["uPrev", "uCur", "uMix", "uTime", "uFrenzy", "uHurt", "uFlash", "uTexel", "uPlayer", "uRect", "uMark", "uHit", "uRing", "uStasis", "uCalm", "uZoom", "uConvert", "uTier"]) this.u[name] = gl.getUniformLocation(p, name);
    this.tex = [this.makeTex(), this.makeTex()];
    this.size = [0, 0];
    this.marks = new Float32Array(32);
    this.hits = new Float32Array(32);
  }

  get ok() { return !!this.gl; }

  makeTex() {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  // Pack the world into RGBA bytes and upload.
  // mode "step": the current texture becomes "previous" first; "touch": refresh the current one; "reset": both.
  upload(world, mode = "touch") {
    const gl = this.gl;
    if (!gl) return;
    const { w, h, A, B, N } = world;
    if (this.size[0] !== w || this.size[1] !== h) {
      const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
      gl.deleteTexture(this.tex[0]); gl.deleteTexture(this.tex[1]);
      this.tex = [this.makeTex(), this.makeTex()];
      for (const t of this.tex) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, w, h); }
      this.size = [w, h];
      this.bytes = new Uint8Array(w * h * 4);
      mode = "reset";
    }
    const px = this.bytes;
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      px[j] = A[i] * 255; px[j + 1] = B[i] * 255; px[j + 2] = N[i] * 255; px[j + 3] = 255;
    }
    if (mode === "step") this.tex.reverse();
    const targets = mode === "reset" ? this.tex : [this.tex[1]];
    for (const t of targets) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  }

  // rect: dish rectangle in CSS pixels; view: canvas CSS size
  draw(rect, view, mix, time, fx) {
    const gl = this.gl;
    if (!gl) return;
    fx = fx || {};
    const c = this.canvas;
    gl.viewport(0, 0, c.width, c.height);
    gl.clearColor(0.012, 0.01, 0.025, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    // map CSS rect to clip space; uv y runs down the screen
    const x0 = (rect.x / view.w) * 2 - 1, y0 = 1 - (rect.y / view.h) * 2;
    gl.uniform4f(this.u.uRect, x0, y0, (rect.w / view.w) * 2, -(rect.h / view.h) * 2);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex[0]); gl.uniform1i(this.u.uPrev, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex[1]); gl.uniform1i(this.u.uCur, 1);
    gl.uniform1f(this.u.uMix, mix);
    gl.uniform1f(this.u.uTime, time);
    gl.uniform1f(this.u.uFrenzy, fx.frenzy || 0);
    gl.uniform1f(this.u.uHurt, fx.hurt || 0);
    gl.uniform1f(this.u.uFlash, fx.flash || 0);
    gl.uniform2f(this.u.uTexel, 1 / this.size[0], 1 / this.size[1]);
    gl.uniform3f(this.u.uPlayer, fx.px || 0, fx.py || 0, fx.light || 0);
    // combat feedback, given in dish cells; old callers leave these out
    const [w, h] = this.size;
    // p stays under 0.99 so the shader's floor(code + p + 0.001) never rounds up into the next code
    this.pack(this.marks, fx.marks, w, h, (m) => (m.code | 0) + Math.min(0.99, Math.max(0, m.p || 0)));
    this.pack(this.hits, fx.hits, w, h, (m) => Math.min(1, Math.max(0, m.s || 0)));
    gl.uniform4fv(this.u.uMark, this.marks);
    gl.uniform4fv(this.u.uHit, this.hits);
    const r = fx.ring;
    if (r && r.r > 0 && r.s > 0 && w) gl.uniform4f(this.u.uRing, r.x / w, r.y / h, r.r, Math.min(1, r.s));
    else gl.uniform4f(this.u.uRing, 0, 0, 0, 0);
    gl.uniform1f(this.u.uStasis, Math.min(1, Math.max(0, fx.stasis || 0)));
    gl.uniform1f(this.u.uCalm, fx.calm ? 1 : 0);
    gl.uniform1f(this.u.uZoom, fx.zoom || 1);
    const cv = fx.convert;
    if (cv && cv.s > 0 && w) gl.uniform4f(this.u.uConvert, cv.x / w, cv.y / h, cv.r, Math.min(1, cv.s));
    else gl.uniform4f(this.u.uConvert, 0, 0, 0, 0);
    gl.uniform1f(this.u.uTier, fx.tier || 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // up to 8 entries of { x, y, r } in cells into vec4 slots; unused slots get radius 0
  pack(out, list, w, h, last) {
    out.fill(0);
    if (!list || !w) return;
    for (let i = 0, n = Math.min(8, list.length); i < n; i++) {
      const m = list[i], j = i * 4;
      if (!m || !(m.r > 0)) continue;
      out[j] = m.x / w; out[j + 1] = m.y / h; out[j + 2] = m.r; out[j + 3] = last(m);
    }
  }
}

// Canvas 2D fallback for browsers without WebGL2.
export class FlatRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.off = document.createElement("canvas");
    this.octx = this.off.getContext("2d");
  }
  get ok() { return !!this.ctx; }
  upload(world) {
    const { w, h, A, B, N } = world;
    if (this.off.width !== w || this.off.height !== h) { this.off.width = w; this.off.height = h; this.img = this.octx.createImageData(w, h); }
    const d = this.img.data, cv = this.convert ? 1 : 0;
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      // the molt wave: hunter tissue takes the prey colours (the flat path turns all of it at once)
      const a = A[i] + B[i] * cv, b = B[i] * (1 - cv), n = N[i];
      d[j] = Math.min(255, 12 + b * 255 + a * 60);
      d[j + 1] = Math.min(255, 8 + n * 14 + a * 230 + b * 40);
      d[j + 2] = Math.min(255, 18 + n * 18 + a * 220 + b * 110);
      d[j + 3] = 255;
    }
    this.octx.putImageData(this.img, 0, 0);
  }
  draw(rect, view, mix, time, fx) {
    // Stasis: grey the dish and tint it violet. The two opposite hue turns move only the sepia tint.
    this.convert = !!(fx && fx.convert && fx.convert.s > 0);
    const s = Math.round(Math.min(1, Math.max(0, (fx && fx.stasis) || 0)) * 50) / 50;
    const filter = s > 0 ? `saturate(${1 - 0.6 * s}) hue-rotate(-210deg) sepia(${0.25 * s}) hue-rotate(210deg)` : "";
    if (filter !== this.filter) { this.filter = filter; this.canvas.style.filter = filter; }
    const c = this.ctx, dpr = this.canvas.width / view.w;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#030206";
    c.fillRect(0, 0, view.w, view.h);
    c.imageSmoothingEnabled = true;
    const z = (fx && fx.zoom) || 1, w = this.off.width, h = this.off.height;
    c.drawImage(this.off, (w * (1 - z)) / 2, (h * (1 - z)) / 2, w * z, h * z, rect.x, rect.y, rect.w, rect.h);
  }
}
