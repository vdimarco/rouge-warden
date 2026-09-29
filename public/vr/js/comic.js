// In Full Swing: the comic-book look, shared by every module. Palette, GLSL chunks (cel bands, Ben-Day dots, ink
// lines, posterising), a cel-shading patch for built-in materials, an inverted-hull outline and the cached art loader.
// The look is set by public/vr/art/keyart.webp: inked lines, three light bands, world-anchored dots, no smooth gradients.
import * as THREE from "three";
import { SUN_DIR } from "./config.js";

/* ---------------- the API ----------------
INK, PAL              hex numbers (a hex in code is the colour on screen). INK is the line colour: never pure black.
GLSL.posterize        float comicPoster(float x, float n): x in 0..1 snapped to n + 1 levels, a step about 1 px wide at each edge.
GLSL.halftone         float comicDots(vec2 p, float cell, float cover): Ben-Day dots on a 45 degree screen. p is in world (or
                      face) metres, cell the pitch in metres, cover 0..1 the share of the cell a dot fills. Below about 3 px per
                      cell the dots fade to their average (so they never shimmer), above about 30 px they fade out (so a
                      surface is clean up close). float comicHatch(vec2 p, float cell, float cover) does diagonal lines the
                      same way. Never feed them screen coordinates: dots must stay in the world (stereo rivalry in VR).
GLSL.ink              float comicInk(float d, float wpx): a line mask from any distance d in metres (0 on the line); wpx is
                      the half width in pixels. float comicInkW(float dist, float k): a width, thick near and thin far.
GLSL.toon             float comicStep(float e, float x) (anti-aliased step), float comicBand(float l, float t0, float t1)
                      (0 shade, 1 mid, 2 lit), float comicLight(vec3 n, vec3 sun), vec3 comicCel(vec3 albedo, float band),
                      vec3 comicCelX(vec3 albedo, float band, vec3 litMul, vec3 litAdd): shade is pushed to blue-violet, lit to
                      orange. Needs no other chunk.
toonify(material, opts)   onBeforeCompile patch for MeshLambert, MeshStandard, MeshPhong and MeshBasic. Ignores scene lights:
                      the sun is SUN_DIR. opts: { dots: 0.05 (dot pitch in m, 0 = off), bands: [0.14, 0.5], lit: 1 (0 = keep
                      the material colour flat), sun: {x, y, z} }. Returns the material. Works with InstancedMesh.
outlineOf(mesh, opts)     an inverted-hull outline for a Mesh or InstancedMesh, sharing its geometry and instance matrices.
                      Add it as a CHILD of the mesh: mesh.add(outlineOf(mesh)). opts: { width: 0.02 (m, the line at close
                      range), grow: true (keep about px pixels on screen further away), px: 2, color: INK }.
                      The hull is pushed out along smoothed normals (attribute "aOutline", made once), so hard-edged
                      boxes stay closed.
smoothNormals(geometry)   adds the welded-normal attribute "aOutline" (used by outlineOf); returns it. smoothNormalsSteps(geometry)
                      gives { step(n) } to do it a few thousand vertices per frame in an incremental build.
syncInk(renderer, camera) sets the shared radians-per-pixel for hulls (outlineOf does it in onBeforeRender by itself);
                      inkK is that uniform ({ value }) for custom hull shaders: offset = px * inkK.value * distance.
loadArt(renderer)         Promise of { sky, windows, words, wordRects }. Loaded once, cached, mipmapped, uploaded. Each entry is
                      null when its file failed, so callers keep a procedural look. artNow() returns the result once loaded.
   sky: 4096 x 880 strip, x = azimuth (the sun at u 0.2515), the bottom row is the horizon, the top row 72 degrees up.
   windows: 2048 x 2048 atlas, 4 x 4 tiles, index = row * 4 + col from the top. words: RGBA sound words; wordRects has
   { THWIP: { u0, v0, u1, v1, aspect }, ... } with v up (a texture with flipY, like all of these). */

export const INK = 0x140a18;
export const PAL = {
  ink: INK,
  zenith: 0x3b2380, magenta: 0xd8457a, orange: 0xff7a2a, sun: 0xffd84a,
  shadow: 0x1f3f6e, shadowViolet: 0x3a2a6a, lit: 0xffb45a,
  window: 0xffcf5a, windowWarm: 0xffb32a, windowDark: 0x1f3a66,
  sludge: 0x9cff3a, porcelain: 0xf4f1ea, porcelainShade: 0x8d86b8,
  dot: 0x2a1560,
};

/* ---------------- GLSL chunks ---------------- */
const POSTERIZE = /* glsl */ `
// x in 0..1 rounded to the nearest of n + 1 levels, with a step about one pixel wide at each edge
float comicPoster(float x, float n) {
  float y = clamp(x, 0.0, 1.0) * n;
  float i = floor(y);
  float w = max(fwidth(y), 1e-4) * 0.75;
  return (i + smoothstep(0.5 - w, 0.5 + w, y - i)) / n;
}
`;

const HALFTONE = /* glsl */ `
// Ben-Day dots on a 45 degree screen. p: world metres. cell: pitch in metres. cover: share of the cell the dot fills.
// A cell under about 3 px is faded to its average tone (cover), so the pattern never shimmers or differs per eye. A cell over
// about 30 px fades out (the surface is clean up close), so a big polka pattern never fills the view.
float comicDots(vec2 p, float cell, float cover) {
  vec2 q = vec2(p.x + p.y, p.x - p.y) * (0.70710678 / cell);
  float px = max(fwidth(q.x), fwidth(q.y));
  float c = clamp(cover, 0.0, 0.95);
  float r = sqrt(c * 0.31831);
  float aa = max(px, 1e-4);
  float d = 1.0 - smoothstep(r - aa, r + aa, length(fract(q) - 0.5));
  return mix(c, d, 1.0 - smoothstep(0.2, 0.38, px)) * smoothstep(0.02, 0.05, px);
}
// diagonal hatching, same rule: lines fill cover of the pitch and fade to their average when they get too fine
float comicHatch(vec2 p, float cell, float cover) {
  float t = (p.x + p.y) / cell;
  float px = fwidth(t);
  float aa = max(px, 1e-4);
  float d = 1.0 - smoothstep(cover * 0.5 - aa, cover * 0.5 + aa, abs(fract(t) - 0.5));
  return mix(cover, d, 1.0 - smoothstep(0.2, 0.38, px)) * smoothstep(0.02, 0.05, px);
}
`;

const INKGLSL = /* glsl */ `
// A line mask from d, a distance in metres to an edge (0 on the edge). The pixel size comes from d's own slope, so
// the line is wpx pixels wide (each side) whatever the distance, with a 1.5 px anti-aliased rim.
float comicInk(float d, float wpx) {
  float g = max(length(vec2(dFdx(d), dFdy(d))), 1e-6);
  return 1.0 - smoothstep(wpx - 0.75, wpx + 0.75, d / g);
}
// half width in pixels by distance: bold near, fine far, never under 1 px; k scales it for the display
float comicInkW(float dist, float k) { return k * mix(2.8, 1.5, smoothstep(20.0, 260.0, dist)); }
`;

const TOON = /* glsl */ `
float comicStep(float e, float x) {
  float w = max(fwidth(x), 1e-4) * 0.75;
  return smoothstep(e - w, e + w, x);
}
// light l into three bands, 0 shade, 1 mid, 2 lit: a step 1-2 px wide at each edge, flat in between
float comicBand(float l, float t0, float t1) { return comicStep(t0, l) + comicStep(t1, l); }
// sun light on a normal; a level surface takes the low sun as if it stood higher, so roofs and streets read as lit
float comicLight(vec3 n, vec3 sun) {
  float d = dot(n, sun);
  return max(mix(d, 0.66, smoothstep(0.5, 0.9, n.y)), 0.0);
}
// the three tones of one albedo: shade toward blue-violet, lit toward orange
vec3 comicCelX(vec3 a, float band, vec3 litMul, vec3 litAdd) {
  vec3 sh = a * vec3(0.30, 0.40, 0.68) + vec3(0.010, 0.020, 0.075);
  vec3 mi = a * vec3(0.66, 0.62, 0.80) + vec3(0.012, 0.006, 0.045);
  vec3 li = a * litMul + litAdd;
  return band < 1.0 ? mix(sh, mi, band) : mix(mi, li, band - 1.0);
}
vec3 comicCel(vec3 a, float band) { return comicCelX(a, band, vec3(1.22, 1.02, 0.74), vec3(0.09, 0.045, 0.0)); }
`;

export const GLSL = { toon: TOON, halftone: HALFTONE, ink: INKGLSL, posterize: POSTERIZE };

/* ---------------- toonify ---------------- */
// The patch works on the stock shaders: it adds a world position and normal varying, and replaces the lit colour just
// before opaque_fragment with the cel colour (bands from the fake sun, colour shift, world-anchored dots in shade).
const f5 = (v) => (+v).toFixed(5);
export function toonify(material, opts = {}) {
  const o = { dots: 0.05, bands: [0.14, 0.5], lit: 1, sun: SUN_DIR, ...opts };
  const uDot = { value: o.dots };
  const sun = `vec3(${f5(o.sun.x)}, ${f5(o.sun.y)}, ${f5(o.sun.z)})`;
  const bands = `${f5(o.bands[0])}, ${f5(o.bands[1])}`;
  material.userData.comic = { uDot };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uComicDot = uDot;
    const emit = shader.fragmentShader.includes("totalEmissiveRadiance") ? "totalEmissiveRadiance" : "vec3(0.0)";
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vComicW;\nvarying vec3 vComicN;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        {
          vec4 cw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          cw = instanceMatrix * cw;
          #endif
          vComicW = (modelMatrix * cw).xyz;
          vec3 wn = normal;
          #ifdef USE_INSTANCING
          wn = mat3(instanceMatrix) * wn;
          #endif
          vComicN = normalize(mat3(modelMatrix) * wn);
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vComicW;
        varying vec3 vComicN;
        uniform float uComicDot;
        ${POSTERIZE}${HALFTONE}${TOON}`)
      .replace("#include <opaque_fragment>", `{
          vec3 wn = normalize(vComicN) * (gl_FrontFacing ? 1.0 : -1.0);
          float l = ${o.lit ? `comicLight(wn, ${sun})` : "1.0"};
          float b = comicBand(l, ${bands});
          vec3 col = ${o.lit ? "comicCel(diffuseColor.rgb, b)" : "diffuseColor.rgb"};
          if (uComicDot > 0.0) {
            vec3 an = abs(wn);
            vec2 p = an.y > max(an.x, an.z) ? vComicW.xz : (an.x > an.z ? vComicW.zy : vComicW.xy);
            float w = 1.0 - clamp(b - 1.0, 0.0, 1.0);
            col = mix(col, vec3(0.10, 0.05, 0.22), comicDots(p, uComicDot, mix(0.6, 0.3, clamp(b, 0.0, 1.0))) * w * 0.55);
          }
          outgoingLight = col + ${emit};
        }
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `comic-toon-${o.lit}-${o.bands}-${o.sun.x}-${o.sun.y}-${o.sun.z}`;
  material.needsUpdate = true;
  return material;
}

/* ---------------- outlines ---------------- */
// Welds the normals of coincident vertices (a grid of 1 / 131071 of the mesh's largest extent, 2 cm on a 2.8 km mesh), so the
// hull of a hard-edged mesh is pushed out along the corner's mean direction and stays closed. Stored once per geometry. The
// grid cell is one number (51 bits), so a big mesh welds in a few ms with no strings. smoothNormalsSteps(geo) returns
// { step(n) } for a build that must not stall a frame: step() does about n vertices of work (the two cheap passes count a
// fifth each, so 1.4 x the vertex count finishes the job) and returns true when done.
export function smoothNormalsSteps(geo, name = "aOutline") {
  if (geo.getAttribute(name)) return { step: () => true };
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox, q = 131071 / (Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 1);
  const ids = new Int32Array(n), map = new Map();
  let groups = 0, sum = null, out = null, phase = 0, i = 0;
  const step = (max = Infinity) => {
    let left = max;
    if (phase === 0) {
      for (; i < n && left > 0; i++, left--) {
        const key = (Math.round((pos.getX(i) - bb.min.x) * q) * 131072 + Math.round((pos.getY(i) - bb.min.y) * q)) * 131072 + Math.round((pos.getZ(i) - bb.min.z) * q);
        let g = map.get(key);
        if (g === undefined) { g = groups++; map.set(key, g); }
        ids[i] = g;
      }
      if (i >= n) { phase = 1; i = 0; sum = new Float32Array(groups * 3); map.clear(); }
    }
    if (phase === 1 && left > 0) {
      for (; i < n && left > 0; i++, left -= 0.2) { const g = ids[i] * 3; sum[g] += nor.getX(i); sum[g + 1] += nor.getY(i); sum[g + 2] += nor.getZ(i); }
      if (i >= n) { phase = 2; i = 0; out = new Float32Array(n * 3); }
    }
    if (phase === 2 && left > 0) {
      for (; i < n && left > 0; i++, left -= 0.2) {
        const g = ids[i] * 3, l = Math.hypot(sum[g], sum[g + 1], sum[g + 2]) || 1;
        out[i * 3] = sum[g] / l; out[i * 3 + 1] = sum[g + 1] / l; out[i * 3 + 2] = sum[g + 2] / l;
      }
      if (i >= n) { geo.setAttribute(name, new THREE.BufferAttribute(out, 3)); phase = 3; }
    }
    return phase === 3;
  };
  return { step };
}
export function smoothNormals(geo, name = "aOutline") {
  smoothNormalsSteps(geo, name).step();
  return geo.getAttribute(name);
}

// Radians per pixel of the view being drawn: the hull is pushed out by px * radPerPx * distance, so its line stays px wide.
const INK_K = { value: 0.0015 };
export const inkK = INK_K; // the shared uniform, for shaders that grow their own hulls
const sz = new THREE.Vector2();
export function syncInk(renderer, camera) {
  const c = camera.isArrayCamera && camera.cameras.length ? camera.cameras[0] : camera;
  const e5 = c.projectionMatrix.elements[5];
  if (!(e5 > 0)) return;
  let h = c.viewport ? c.viewport.w : 0;
  if (!(h > 0)) { renderer.getDrawingBufferSize(sz); h = sz.y; }
  if (h > 0) INK_K.value = (2 * Math.atan(1 / e5)) / h;
}

const HULL_VS = /* glsl */ `
attribute vec3 aOutline;
uniform float uInkW, uInkPx, uInkGrow;
uniform float uInkK;
`;
export function outlineOf(mesh, opts = {}) {
  const o = { width: 0.02, grow: true, px: 2, color: INK, ...opts };
  smoothNormals(mesh.geometry);
  const mat = new THREE.MeshBasicMaterial({ color: o.color, side: THREE.BackSide, fog: false, toneMapped: false });
  mat.userData.comicInk = true;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uInkW = { value: o.width };
    shader.uniforms.uInkPx = { value: o.px };
    shader.uniforms.uInkGrow = { value: o.grow ? 1 : 0 };
    shader.uniforms.uInkK = INK_K;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + HULL_VS)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        {
          mat4 im = modelMatrix;
          #ifdef USE_INSTANCING
          im = im * instanceMatrix;
          #endif
          vec3 wp = (im * vec4(transformed, 1.0)).xyz;
          float dist = length(cameraPosition - wp);
          float off = uInkGrow > 0.5 ? max(uInkW, uInkPx * uInkK * dist) : uInkW;
          transformed += normalize(aOutline) * (off / max(length(im[0].xyz), 1e-4));
        }`);
  };
  mat.customProgramCacheKey = () => "comic-ink";
  const out = mesh.isInstancedMesh ? new THREE.InstancedMesh(mesh.geometry, mat, mesh.count) : new THREE.Mesh(mesh.geometry, mat);
  if (mesh.isInstancedMesh) {
    // the same matrices, not a copy: a move of one instance moves its outline
    out.instanceMatrix = mesh.instanceMatrix;
    out.frustumCulled = mesh.frustumCulled;
  }
  out.renderOrder = mesh.renderOrder;
  out.frustumCulled = mesh.frustumCulled;
  out.name = (mesh.name || "mesh") + ":outline";
  out.onBeforeRender = (renderer, scene, camera) => {
    syncInk(renderer, camera);
    if (out.isInstancedMesh) out.count = mesh.count;
  };
  return out;
}

/* ---------------- art ---------------- */
// Every file is optional: one that fails to load gives null and the caller draws its procedural comic look.
let artPromise = null, artDone = null;
export const artNow = () => artDone;
export function loadArt(renderer) {
  if (artPromise) return artPromise;
  const base = new URL("../art/", import.meta.url);
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(4, (renderer.capabilities && renderer.capabilities.getMaxAnisotropy && renderer.capabilities.getMaxAnisotropy()) || 1);
  const tex = (name, cfg) => new Promise((resolve) => {
    loader.load(new URL(name, base).href, (t) => {
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      cfg(t);
      try { renderer.initTexture(t); } catch (e) { /* the upload happens on first use instead */ }
      resolve(t);
    }, undefined, () => resolve(null));
  });
  const rects = fetch(new URL("words.json", base).href).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  artPromise = Promise.all([
    tex("sky.webp", (t) => { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; }),
    tex("windows.webp", (t) => { t.anisotropy = aniso; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }),
    tex("words.webp", (t) => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }),
    rects,
  ]).then(([sky, windows, words, wordRects]) => (artDone = { sky, windows, words, wordRects }));
  return artPromise;
}
