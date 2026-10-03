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
  c = mix(c, vec3(1.0, 0.72, 0.55), smoothstep(0.6, 0.98, b));
  return c;
}

void main() {
  vec2 uv = vUv;
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
  col += vec3(0.75, 0.05, 0.3) * (g1.g * 0.6 + g2.g * 0.7);

  float pa = smoothstep(0.04, 0.3, a), pb = smoothstep(0.04, 0.3, b);
  vec3 pc = preyRamp(a) * (0.55 + 0.6 * diff) + spec * 0.55 * vec3(0.8, 1.0, 1.0);
  vec3 hc = hunterRamp(b) * (0.55 + 0.6 * diff) + spec * 0.5 * vec3(1.0, 0.85, 0.8);
  // hunters pulse with a slow heartbeat
  hc *= 0.9 + 0.12 * sin(uTime * 5.0 + b * 8.0);
  col = mix(col, pc, pa * 0.92);
  col = mix(col, hc, pb * 0.95);

  // in Frenzy the hunters look edible: gold edges
  col += uFrenzy * vec3(1.0, 0.75, 0.2) * smoothstep(0.05, 0.25, b) * (1.0 - smoothstep(0.3, 0.7, b)) * 0.9;

  // a soft light around the player
  vec2 pd = (vUv - uPlayer.xy) / uTexel / 40.0;
  col += vec3(0.25, 0.35, 0.3) * uPlayer.z * exp(-dot(pd, pd) * 3.0) * 0.35;

  // vignette at the dish rim
  vec2 e = min(vUv, 1.0 - vUv) / vec2(uTexel.x * 10.0, uTexel.y * 10.0);
  float rim = smoothstep(0.0, 1.0, min(e.x, e.y));
  col *= 0.55 + 0.45 * rim;

  col = mix(col, vec3(0.9, 0.1, 0.2), uHurt * 0.18);
  col += uFlash * vec3(0.5, 0.9, 0.85);
  col = col / (1.0 + col * 0.35); // soft tone map
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
    for (const name of ["uPrev", "uCur", "uMix", "uTime", "uFrenzy", "uHurt", "uFlash", "uTexel", "uPlayer", "uRect"]) this.u[name] = gl.getUniformLocation(p, name);
    this.tex = [this.makeTex(), this.makeTex()];
    this.size = [0, 0];
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
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
    const d = this.img.data;
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      const a = A[i], b = B[i], n = N[i];
      d[j] = Math.min(255, 12 + b * 255 + a * 60);
      d[j + 1] = Math.min(255, 8 + n * 14 + a * 230 + b * 40);
      d[j + 2] = Math.min(255, 18 + n * 18 + a * 220 + b * 110);
      d[j + 3] = 255;
    }
    this.octx.putImageData(this.img, 0, 0);
  }
  draw(rect, view) {
    const c = this.ctx, dpr = this.canvas.width / view.w;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#030206";
    c.fillRect(0, 0, view.w, view.h);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.off, rect.x, rect.y, rect.w, rect.h);
  }
}
