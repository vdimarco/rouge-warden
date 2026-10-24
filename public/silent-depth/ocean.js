// Traveling wave heights/slopes: GPU Gems ch. 1. The photograph supplies the sea's fine detail.
const vertex = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = vec2(position.x * .5 + .5, .5 - position.y * .5);
  gl_Position = vec4(position, 0., 1.);
}`;
const fragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D scene;
uniform vec4 crop;
uniform float time;
varying vec2 uv;
void main() {
  vec2 sampleUV = uv * crop.xy + crop.zw;
  float nearWater = max(0., (uv.y - .5) * 2.);
  float fade = smoothstep(0., .10, nearWater);
  float perspective = 1. / (nearWater + .18);
  vec2 p = vec2((uv.x - .5) * 12. * perspective, 8. * perspective);
  vec2 d1 = vec2(.94, .34), d2 = vec2(-.38, .92), d3 = vec2(.61, -.79);
  float a = dot(p, d1) * 1.3 - time * 1.25;
  float b = dot(p, d2) * 2.7 - time * 1.85;
  float c = dot(p, d3) * 6.2 - time * 2.9;
  float height = sin(a) * .65 + sin(b) * .24 + sin(c) * .09;
  vec2 slope = d1 * cos(a) * .845 + d2 * cos(b) * .648 + d3 * cos(c) * .558;
  vec2 displacement = vec2(slope.x * .0024, height * .007) * nearWater * fade;
  sampleUV += displacement * crop.xy;
  vec3 color = texture2D(scene, clamp(sampleUV, .001, .999)).rgb;
  float reflection = clamp(slope.y * .07, -.09, .09);
  float glint = pow(max(0., .5 + slope.y * .3), 9.) * .025;
  color = color * (1. + reflection * nearWater * fade) + vec3(.9, .84, .68) * glint * nearWater * fade;
  gl_FragColor = vec4(color, 1.);
}`;

export class Ocean {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.gl = null; });
    this.canvas.addEventListener('webglcontextrestored', () => this.init());
    this.init();
  }
  init() {
    this.gl = null;
    this.image = null;
    const gl = this.canvas.getContext('webgl', {alpha: false, depth: false, antialias: false, preserveDrawingBuffer: false});
    if (!gl) return;
    const shaders = [];
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Ocean shader unavailable');
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const program = gl.createProgram();
    try {
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const buffer = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.texture = gl.createTexture();gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.time = gl.getUniformLocation(program, 'time');this.crop = gl.getUniformLocation(program, 'crop');
      gl.uniform1i(gl.getUniformLocation(program, 'scene'), 0);
      this.gl = gl;
    } catch (error) {
      gl.deleteProgram(program);
      console.warn('Animated ocean unavailable; using the static sea.', error.message);
    } finally {
      for (const shader of shaders) gl.deleteShader(shader);
    }
  }
  draw(image, time, width, height, left, top, imageWidth, imageHeight) {
    const gl = this.gl;
    if (!gl || !image.complete || !image.naturalWidth) return null;
    const scale = Math.min(1, 1440 / width);
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {this.canvas.width = w;this.canvas.height = h;gl.viewport(0, 0, w, h);}
    if (this.image !== image) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      this.image = image;
    }
    gl.uniform1f(this.time, time);
    gl.uniform4f(this.crop, width / imageWidth, height / imageHeight, -left / imageWidth, -top / imageHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return this.canvas;
  }
}
