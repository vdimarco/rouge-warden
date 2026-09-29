// In Full Swing: the city view. It draws what city.js lays out: towers with lit windows, streets, autumn trees, traffic,
// the lake, the golden-hour sky, the Needle, the Dome and the expressway (spec §9). It builds in small steps, start view
// first. One facade shader draws every building; the sun, the long shadows and the haze are faked in the shaders.
import * as THREE from "three";
import { WORLD, PERF, COLORS, SUN_DIR } from "./config.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- tuning ---------------- */
const KIND = { glass: 0, gold: 1, brick: 2, stone: 3, concrete: 4, loft: 5 };
const CHUNK = WORLD.chunk;
const MAX_UNITS = 4; // work units per build() call: under a paused test clock performance.now() does not move
// The height and shadow map: 4 m cells over the land and a margin. R = shadow height, G = building height (2 m steps).
const MAP = { x0: -704, z0: -824, cell: 4, nx: 352, nz: 282 };
// The shadow sun stands a little higher than the light sun, so golden hour leaves some streets in the sun.
const SHADOW_TAN = 0.3;
const PARAPET = 0.8, PARAPET_T = 0.3;
const PROMENADE = 272; // south of this the streets stop: the waterfront walk under the expressway
const FAR = 3400; // the ground and the lake reach this far, past the hills ring
// the far skyline (1.8-2.7 km from the middle of the city) and the hills behind it; all inside the 4 km far plane
const RING = { x: 0, z: -230, r0: 1800, r1: 2700, hills: 2900 };
const XWAY_EXT = 1400; // the expressway runs on into the haze past the land
// Colours of the hour (display values: no colour management, no tone mapping)
const SUN_COL = [1.12, 0.7, 0.42];
const AMB_SKY = [0.5, 0.52, 0.68];
const AMB_GND = [0.46, 0.36, 0.32];
const GLOW = [1.0, 0.62, 0.32];
const CITY_REFL = [0.3, 0.25, 0.28];

/* ---------------- GLSL ---------------- */
// Uniforms, noise, the sky colour, the shadow map, lighting and fog, shared by every city material.
const COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir, uSunCol, uSkyTop, uSkyMid, uSkyHor, uGlow, uAmbSky, uAmbGnd;
uniform vec2 uSunXZ;
uniform vec3 uFog; // near, density, haze height
uniform sampler2D uMap;
uniform vec4 uMapBox; // x0, z0, 1 / width, 1 / depth
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
// The golden-hour sky in a direction: gold on the horizon, orange, then deep blue; rose on the side away from the sun.
vec3 skyColor(vec3 d) {
  float y = max(d.y, 0.0);
  float toward = dot(normalize(d.xz + vec2(1e-5)), uSunXZ) * 0.5 + 0.5;
  vec3 c = mix(uSkyHor, uSkyMid, smoothstep(0.0, 0.25, y));
  c = mix(c, uSkyTop, smoothstep(0.08, 0.75, y));
  c = mix(c, c * vec3(0.9, 0.8, 1.04) + vec3(0.02, 0.0, 0.06), (1.0 - toward) * (1.0 - smoothstep(0.0, 0.7, y)) * 0.75);
  float s = max(dot(d, uSunDir), 0.0);
  c += uGlow * (pow(s, 6.0) * 0.32 + pow(s, 48.0) * 0.4) * (1.0 - 0.5 * smoothstep(0.0, 0.5, y));
  // Broad cloud banks give the skyline scale, with a warm sunward rim.
  // Two noise samples avoid a full-screen volumetric pass on phone and headset GPUs.
  vec2 cloudUV = d.xz / max(d.y + 0.22, 0.08) * 1.4;
  float cloud = vnoise(cloudUV) * 0.7 + vnoise(cloudUV * 2.8 + 9.1) * 0.3;
  float bank = smoothstep(0.48, 0.7, cloud) * smoothstep(0.015, 0.18, d.y);
  vec3 cloudCol = mix(uSkyMid * 0.83, uSkyHor * 0.8 + uGlow * 0.35, toward);
  c = mix(c, cloudCol, bank * 0.65);
  return c;
}
// In the sun or in a shadow, from the map's shadow height over the point: 1 in the sun, 0 in shade, soft at the edge.
float sunVis(vec3 p) {
  vec2 uv = (p.xz - uMapBox.xy) * uMapBox.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
  float h = texture2D(uMap, uv).r * 510.0;
  return smoothstep(h - 2.5, h + 0.5, p.y);
}
// Sun (lambert) plus a hemisphere. Level surfaces take the low sun as if it stood higher: stylized, so the long
// shadows read on the streets and roofs instead of vanishing in the sky light.
vec3 shade(vec3 alb, vec3 N, float vis) {
  float ndl = max(dot(N, uSunDir), 0.0);
  ndl = mix(ndl, 0.45, smoothstep(0.5, 0.9, N.y)) * vis;
  // up-facing surfaces also get a warm bounce from the sunlit city round them
  return alb * (uSunCol * ndl + mix(uAmbGnd, uAmbSky, N.y * 0.5 + 0.5) + vec3(0.1, 0.06, 0.02) * max(N.y, 0.0));
}
// Haze to the sky colour behind the point. It is thick near the ground and thin up high (height fog), so the Needle
// and the aerial view keep their shapes. maxF caps it (the Needle uses 0.6).
float fogAmount(vec3 wp) {
  vec3 v = wp - cameraPosition;
  float d = length(v);
  float H = uFog.z, yc = max(cameraPosition.y, 0.0), yp = max(wp.y, 0.0);
  float dy = yc - yp;
  float hf = abs(dy) < 1.0 ? exp(-0.5 * (yc + yp) / H) : H * (exp(-yp / H) - exp(-yc / H)) / dy;
  float f = 1.0 - exp(-uFog.y * max(d - uFog.x, 0.0) * hf);
  return max(f, 0.08 * smoothstep(12.0, uFog.x, d));
}
vec3 fogMix(vec3 col, vec3 wp, float maxF) {
  vec3 v = normalize(wp - cameraPosition);
  vec3 fc = skyColor(vec3(v.x, clamp(v.y, 0.0, 0.1), v.z));
  return mix(col, fc, fogAmount(wp) * maxF);
}
`;

// The same sky, fog and shadow maths for vertex shaders: objects whose triangles are small take their haze (and small
// ones their sun) per vertex, which spares every pixel a sky colour and the fog's exponentials.
const VERTEX_FOG = /* glsl */ `
uniform vec3 uSunDir, uSkyTop, uSkyMid, uSkyHor, uGlow;
uniform vec2 uSunXZ;
uniform vec3 uFog;
uniform sampler2D uMap;
uniform vec4 uMapBox;
varying vec4 vFog;
${COMMON.slice(COMMON.indexOf("// The golden-hour sky"), COMMON.indexOf("// Sun (lambert)"))}
${COMMON.slice(COMMON.indexOf("float fogAmount"), COMMON.indexOf("vec3 fogMix"))}
float sunVisV(vec3 p) {
  vec2 uv = (p.xz - uMapBox.xy) * uMapBox.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
  float h = texture2D(uMap, uv).r * 510.0;
  return smoothstep(h - 2.5, h + 0.5, p.y);
}
void fogVertex(vec3 wp) {
  vec3 v = normalize(wp - cameraPosition);
  vFog = vec4(skyColor(vec3(v.x, clamp(v.y, 0.0, 0.1), v.z)), fogAmount(wp));
}
`;

// Buildings. Attributes: aInfo (kind code, seed, floor height, bay width), aFace (walls: u along the face, face width,
// a salt, the tier top; roofs: x, z in the roof, its width and depth; parapet tops: w < 0), aDist (district).
const FACADE_VS = /* glsl */ `
${VERTEX_FOG}
attribute vec4 aInfo;
attribute vec4 aFace;
attribute float aDist;
uniform float uClog[6];
varying vec3 vW;
varying vec3 vN;
varying vec4 vInfo;
varying vec4 vFace;
varying float vClog;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normal; vInfo = aInfo; vFace = aFace;
  vClog = uClog[int(aDist + 0.5)];
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FACADE_FS = /* glsl */ `
${COMMON}
varying vec4 vFog;
uniform float uFinale;
uniform vec3 uCityRefl;
varying vec3 vW;
varying vec3 vN;
varying vec4 vInfo;
varying vec4 vFace;
varying float vClog;
// window rectangles in a cell (x from, y from, x to, y to), per kind: glass, gold, brick, stone, concrete, loft
const vec4 WIN[6] = vec4[6](
  vec4(0.035, 0.26, 0.965, 1.0),
  vec4(0.05, 0.24, 0.95, 1.0),
  vec4(0.3, 0.26, 0.7, 0.74),
  vec4(0.33, 0.2, 0.67, 0.8),
  vec4(0.02, 0.4, 0.98, 0.86),
  vec4(0.16, 0.14, 0.84, 0.84)
);
// What glass mirrors: the sky, and other towers on the horizon as a ragged dark band.
vec3 envColor(vec3 R) {
  vec3 c = skyColor(R);
  // towers on the horizon: a height per slice of azimuth, some slices empty (two hashes, cheap on every wall pixel)
  float cell = floor(atan(R.x, R.z) * 18.0);
  float sk = 0.015 + 0.08 * hash12(vec2(cell, 3.0)) * step(0.3, hash12(vec2(cell, 9.0)));
  float city = 1.0 - smoothstep(sk - 0.015, sk + 0.015, R.y);
  return mix(c, uCityRefl * (0.85 + 0.35 * smoothstep(-0.3, sk, R.y)), city);
}
float box2(vec2 f, vec4 r, vec2 aa) {
  vec2 a = smoothstep(r.xy - aa, r.xy + aa, f) * (1.0 - smoothstep(r.zw - aa, r.zw + aa, f));
  return a.x * a.y;
}
float bar(float x, float at, float w, float aa) { return 1.0 - smoothstep(w - aa, w + aa, abs(x - at)); }
vec3 wallColor(int k, float shop, float sd, float salt, float h1, float h2, float h3, vec3 N, vec3 V, float vis) {
  float fh = vInfo.z, bay = vInfo.w;
  float u = vFace.x, faceW = vFace.y, top = vFace.w, y = vW.y;
  bool glassy = k <= 1;
  vec3 wall;
  if (k == 0) wall = mix(vec3(0.46, 0.5, 0.54), vec3(0.62, 0.64, 0.66), h1);
  else if (k == 1) wall = vec3(0.66, 0.5, 0.22);
  else if (k == 2) wall = h2 > 0.8 ? mix(vec3(0.66, 0.55, 0.38), vec3(0.76, 0.64, 0.46), h1) : mix(vec3(0.46, 0.2, 0.13), vec3(0.62, 0.3, 0.19), h1);
  else if (k == 3) wall = mix(vec3(0.7, 0.64, 0.52), vec3(0.82, 0.76, 0.63), h1);
  else if (k == 4) wall = mix(vec3(0.52, 0.51, 0.5), vec3(0.66, 0.63, 0.58), h1);
  else wall = mix(vec3(0.42, 0.22, 0.14), vec3(0.55, 0.32, 0.21), h1);
  // weathering streaks, slow enough never to shimmer
  wall *= 0.88 + 0.22 * vnoise(vec2(u * 0.21 + salt * 7.0, y * 0.04));
  // brick courses and stone blocks up close, fading out long before they could shimmer (not in the low setting)
  #ifndef LOW
  if (k == 2 || k == 5 || k == 3) {
    vec2 bs = k == 3 ? vec2(0.9, 0.45) : vec2(0.36, 0.15);
    vec2 bq = vec2(u / bs.x, y / bs.y);
    bq.x += 0.5 * mod(floor(bq.y), 2.0);
    vec2 bfw = fwidth(bq);
    float bdet = 1.0 - smoothstep(0.12, 0.4, max(bfw.x, bfw.y));
    if (bdet > 0.01) {
      vec2 bf = fract(bq);
      vec2 mw = vec2(0.012) / bs + bfw * 0.5;
      vec2 e = smoothstep(vec2(0.0), mw, bf) * smoothstep(vec2(0.0), mw, 1.0 - bf);
      float mortar = 1.0 - e.x * e.y;
      float bv = hash12(floor(bq) + sd * 0.37);
      vec3 bw = wall * (0.86 + 0.28 * bv);
      bw = mix(bw, k == 3 ? wall * 0.82 : vec3(0.64, 0.6, 0.54), mortar * (k == 3 ? 0.5 : 0.7));
      wall = mix(wall, bw, bdet);
    }
  }
  #endif
  // the street floors see less of the sky
  float hao = mix(0.66, 1.0, smoothstep(0.0, 40.0, y));
  float gH = glassy ? 6.5 : 4.6;
  float cols = max(1.0, floor(faceW / bay + 0.5));
  float cw = faceW / cols;
  vec2 q = vec2(u / cw, (y - gH) / fh);
  vec2 fq = fwidth(q);
  // per axis: 1 while a cell spans several pixels, 0 where it would shimmer. Each axis fades to its own average,
  // so the floor lines stay after the columns have gone (the separable way to filter a grid)
  vec2 det2 = 1.0 - smoothstep(vec2(DETAIL0), vec2(DETAIL1), fq);
  float detail = min(det2.x, det2.y);
  vec2 id = floor(q), f = fract(q);
  vec4 wr = WIN[k];
  // no windows in a floor the tier top cuts; plain masonry keeps windows on its street floor too
  float low = (shop < 0.5 && !glassy) ? -1.0 : 0.0;
  float inFloors = step((id.y + 1.0) * fh + gH, top - 0.5) * step(low, id.y);
  vec2 aa = max(fq * 0.75, vec2(1e-4));
  vec2 wa = smoothstep(wr.xy - aa, wr.xy + aa, f) * (1.0 - smoothstep(wr.zw - aa, wr.zw + aa, f));
  wa = mix(wr.zw - wr.xy, wa, det2);
  float win = wa.x * wa.y * inFloors;
  float m = win;
  // the rooms: dark, or lit (offices cool and fewer, homes warm); greener in a clogged district; all lit at the finale
  float r = hash13(vec3(id, sd * 0.618 + salt * 7.31));
  float litP = clamp(((glassy ? mix(0.12, 0.3, h2) : mix(0.22, 0.48, h2)) + uFinale * 0.6) * (1.0 - 0.45 * vClog), 0.0, 0.95);
  float lit = step(r, litP);
  float fl = step(0.975, fract(r * 57.3));
  lit = mix(lit, step(0.55, fract(uTime * (0.02 + 0.04 * fract(r * 91.0)) + r * 7.0)), fl);
  vec3 green = vec3(0.5, 0.85, 0.3);
  bool condo = vInfo.x > 15.5;
  vec3 warm = glassy ? (fract(r * 13.7) < 0.75 ? mix(vec3(1.0, 0.78, 0.5), vec3(1.0, 0.88, 0.66), fract(r * 5.3)) * 0.8 : vec3(0.78, 0.86, 1.0) * 0.7) : mix(vec3(1.0, 0.6, 0.3), vec3(1.0, 0.8, 0.52), fract(r * 13.7)) * 0.86;
  vec3 warmAvg = glassy ? vec3(0.9, 0.76, 0.56) * 0.78 : vec3(0.86, 0.6, 0.36);
  warm = mix(warm, green * 0.8, vClog * 0.5); warmAvg = mix(warmAvg, green * 0.8, vClog * 0.5);
  vec3 dark = vec3(0.06, 0.065, 0.08) + wall * 0.05;
  // the glass: a fake fresnel over the sky, each pane tilted a hair so the reflections break up
  vec3 Nw = N;
  if (glassy) {
    vec3 T = vec3(N.z, 0.0, -N.x);
    Nw = normalize(N + (T * (hash12(id + sd * 0.57) - 0.5) * 0.07 + vec3(0.0, (hash12(id.yx + sd * 0.13) - 0.5) * 0.05, 0.0)) * detail);
  }
  vec3 R = reflect(-V, Nw);
  vec3 env = envColor(R);
  float ndv = max(dot(Nw, V), 0.0);
  float F0 = k == 1 ? 0.42 : glassy ? 0.3 : 0.1;
  float fres = F0 + (1.0 - F0) * pow(1.0 - ndv, 4.0);
  // glass families: blue-green, silver, bronze, smoke
  vec3 tint = k == 1 ? vec3(1.0, 0.74, 0.36) : !glassy ? vec3(0.85) : h3 < 0.35 ? vec3(0.62, 0.82, 0.92) : h3 < 0.6 ? vec3(0.86, 0.9, 0.95) : h3 < 0.8 ? vec3(0.96, 0.8, 0.6) : vec3(0.6, 0.63, 0.68);
  // each pane mirrors a touch brighter or darker, the way real curtain walls look patchy
  if (glassy) tint *= mix(1.0, 0.8 + 0.4 * hash12(id * 1.37 + sd * 0.11), detail);
  float glint = pow(max(dot(R, uSunDir), 0.0), 300.0) * 2.5 * vis;
  vec3 mirror = (env + uSunCol * glint) * tint;
  vec3 frameC = k == 2 ? vec3(0.84, 0.82, 0.76) : k == 3 ? vec3(0.2, 0.23, 0.2) : k == 5 ? vec3(0.1, 0.1, 0.1) : vec3(0.58, 0.58, 0.6);
  vec3 wallLit = shade(wall, N, vis) * hao;
  vec3 glassCol;
  if (detail > 0.01) {
    // up close: frames, glazing bars, sills and lintels, lamps and curtains in the rooms
    vec2 wl = (f - wr.xy) / (wr.zw - wr.xy);
    vec2 px = fq / (wr.zw - wr.xy);
    // View-dependent room depth. Recessed walls and a ceiling slide behind the pane
    // as the player swings past, without adding geometry or draw calls.
    vec3 tangent = vec3(N.z, 0.0, -N.x);
    vec2 roomShift = vec2(dot(V, tangent), V.y) / max(dot(V, N), 0.25) * 0.16;
    vec2 backUV = (wl - 0.5) * 0.72 + 0.5 - roomShift;
    float backWall = box2(backUV, vec4(0.08, 0.08, 0.92, 0.92), max(px, vec2(0.008)));
    float roomDepth = mix(0.42, 1.0, backWall);
    float ceiling = smoothstep(0.76, 0.94, backUV.y);
    float lamp = (0.72 + 0.4 * wl.y) * roomDepth * (1.0 - ceiling * 0.28);
    float curtain = step(0.6, fract(r * 31.7)) * (bar(wl.x, 0.0, 0.18 + 0.2 * fract(r * 7.9), px.x) + bar(wl.x, 1.0, 0.12 + 0.2 * fract(r * 3.3), px.x));
    vec3 roomNear = lit > 0.5 ? warm * lamp * (1.0 - 0.45 * clamp(curtain, 0.0, 1.0)) + vec3(0.2, 0.08, 0.06) * clamp(curtain, 0.0, 1.0) * lit : dark * (0.8 + 0.6 * wl.y);
    if (glassy && lit > 0.5) roomNear = mix(roomNear, vec3(0.62, 0.6, 0.56) * 0.7, step(0.72, wl.y) * step(0.5, fract(r * 5.1)));
    glassCol = roomNear * (1.0 - fres) + mirror * fres;
    // glazing bars: sashes on brick, a cross on stone, a factory grid on lofts
    vec2 fr = vec2(0.06) / vec2(cw, fh) / (wr.zw - wr.xy) + px;
    float bars = 0.0;
    if (k == 2) bars = bar(wl.y, 0.5, fr.y * 0.6, px.y);
    else if (k == 3) bars = max(bar(wl.x, 0.5, fr.x * 0.5, px.x), bar(wl.y, 0.72, fr.y * 0.5, px.y));
    else if (k == 5) bars = max(bar(fract(wl.x * 3.0), 0.0, fr.x * 1.5, px.x * 3.0) + bar(fract(wl.x * 3.0), 1.0, fr.x * 1.5, px.x * 3.0), bar(fract(wl.y * 4.0), 0.0, fr.y * 2.0, px.y * 4.0) + bar(fract(wl.y * 4.0), 1.0, fr.y * 2.0, px.y * 4.0));
    else if (k == 4) bars = bar(wl.x, 0.5, fr.x * 0.4, px.x);
    float frame = 1.0 - box2(wl, vec4(fr, 1.0 - fr), px);
    glassCol = mix(glassCol, shade(frameC, N, vis) * hao, clamp(max(frame, bars), 0.0, 1.0) * step(2.0, float(k)));
    if (!glassy) {
      // a stone sill under each window, a lintel over it on brick
      float sw = (wr.z - wr.x) * 0.08;
      float sill = box2(f, vec4(wr.x - sw, wr.y - 0.12 / fh, wr.z + sw, wr.y), fq) * inFloors;
      float lint = k == 2 ? box2(f, vec4(wr.x - sw * 0.5, wr.w, wr.z + sw * 0.5, wr.w + 0.2 / fh), fq) * inFloors : 0.0;
      vec3 stone = shade(vec3(0.8, 0.76, 0.68), N, vis) * hao;
      wallLit = mix(wallLit, stone, sill * detail);
      wallLit = mix(wallLit, shade(wall * vec3(1.12, 1.02, 0.95), N, vis) * hao * 0.92, lint * detail);
    }
  } else glassCol = mix(dark, warmAvg, litP) * (1.0 - fres) + mirror * fres;
  // far away the room colour is the average of lit and dark rooms
  if (detail < 0.99) glassCol = mix(mix(dark, warmAvg, litP) * (1.0 - fres) + mirror * fres, glassCol, detail);
  // curtain walls: spandrel glass at the floor line, metal mullions between the panes
  if (glassy) {
    vec3 metal = k == 1 ? vec3(0.8, 0.6, 0.26) : mix(vec3(0.5, 0.52, 0.55), vec3(0.24, 0.25, 0.27), step(0.5, h3));
    // offices: dark spandrel glass; lakefront condos: pale balcony slabs at every floor
    vec3 spandrel = condo ? shade(vec3(0.78, 0.78, 0.76), N, vis) * hao * 0.9 + mirror * 0.08 : dark * 0.6 + mirror * (fres * 0.85 + 0.06);
    float isMull = (1.0 - smoothstep(wr.x - fq.x, wr.x + fq.x, f.x) + smoothstep(wr.z - fq.x, wr.z + fq.x, f.x)) * det2.x * step(wr.y, f.y);
    wallLit = mix(spandrel, shade(metal, N, vis), mix(0.1, clamp(isMull, 0.0, 1.0), det2.x));
  }
  // the top of a tier: a cornice on masonry, a metal band on glass
  float yfw = fwidth(y) + 1e-4;
  if (!glassy) {
    float corn = smoothstep(top - 0.9 - yfw, top - 0.9 + yfw, y) * (1.0 - step(top, y));
    float sh = smoothstep(top - 1.25 - yfw, top - 1.25 + yfw, y) * (1.0 - corn) * (1.0 - step(top, y));
    wallLit = mix(wallLit, shade(mix(wall, vec3(0.8, 0.76, 0.68), 0.55), N, vis), corn);
    wallLit *= 1.0 - 0.35 * sh;
  } else {
    float band = smoothstep(top - 1.4 - yfw, top - 1.4 + yfw, y) * (1.0 - step(top, y));
    wallLit = mix(wallLit, shade(vec3(0.5, 0.52, 0.55), N, vis), band);
    m *= 1.0 - band;
  }
  if (y > top) { wallLit = shade(glassy ? vec3(0.5, 0.52, 0.55) : mix(wall, vec3(0.72, 0.69, 0.62), 0.4), N, vis); m = 0.0; }
  vec3 col = mix(wallLit, glassCol, m);
  // the street floor: shops with lit windows and awnings, or a tower lobby
  if (y < gH) {
    if (shop > 0.5 || glassy) {
      float sw = glassy ? 3.0 : 5.5;
      float sc = max(1.0, floor(faceW / sw + 0.5));
      float sx = u / (faceW / sc);
      float sid = floor(sx), sf = fract(sx);
      float sfw = fwidth(sx) + 1e-4;
      float sdet = 1.0 - smoothstep(0.12, 0.45, max(sfw, yfw / 4.0));
      float rs = hash12(vec2(sid, sd * 0.97 + salt * 3.1));
      float wx = smoothstep(0.07 - sfw, 0.07 + sfw, sf) * (1.0 - smoothstep(0.93 - sfw, 0.93 + sfw, sf));
      float y0 = glassy ? 0.15 : 0.4, y1 = glassy ? gH - 0.7 : 3.1;
      float wy = smoothstep(y0 - yfw, y0 + yfw, y) * (1.0 - smoothstep(y1 - yfw, y1 + yfw, y));
      float wm = mix(0.86 * (y1 - y0) / gH * (glassy ? 1.0 : 1.3), wx * wy, sdet);
      vec3 shopCol = mix(vec3(1.0, 0.74, 0.46), vec3(0.98, 0.9, 0.74), fract(rs * 7.1)) * (rs < (glassy ? 0.55 : 0.85) ? (glassy ? 0.6 : 0.92) : 0.1) * (0.8 + 0.25 * (y - y0) / (y1 - y0));
      shopCol = mix(shopCol, vec3(0.94, 0.8, 0.58) * (glassy ? 0.4 : 0.82), 1.0 - sdet);
      vec3 sg = shopCol * (1.0 - fres) + mirror * fres * 0.8;
      vec3 base = shade(glassy ? vec3(0.34, 0.33, 0.32) : mix(wall, vec3(0.3, 0.28, 0.27), 0.3), N, vis) * hao;
      col = mix(base, sg, wm);
      if (!glassy) {
        // awnings in shop colours, and a sign board above them
        float aw = smoothstep(3.3 - yfw, 3.3 + yfw, y) * (1.0 - smoothstep(4.0 - yfw, 4.0 + yfw, y));
        float pk = fract(rs * 3.7);
        vec3 ac = pk < 0.25 ? vec3(0.62, 0.1, 0.08) : pk < 0.45 ? vec3(0.1, 0.32, 0.18) : pk < 0.65 ? vec3(0.1, 0.16, 0.34) : pk < 0.82 ? vec3(0.8, 0.52, 0.12) : vec3(0.2, 0.2, 0.22);
        float stripe = mix(0.5, smoothstep(0.5 - sfw * 9.0, 0.5 + sfw * 9.0, fract(sf * 9.0)), 1.0 - smoothstep(0.1, 0.3, sfw * 9.0)) * step(0.7, fract(rs * 11.0)) * sdet;
        ac = mix(ac, vec3(0.85, 0.82, 0.76), stripe * 0.8);
        vec3 awn = shade(ac, normalize(vec3(N.x, 0.7, N.z)), vis);
        col = mix(col, awn, aw * mix(0.8, wx, sdet));
        float board = smoothstep(4.05 - yfw, 4.05 + yfw, y) * (1.0 - smoothstep(4.55 - yfw, 4.55 + yfw, y)) * mix(0.8, wx, sdet);
        col = mix(col, mix(vec3(0.06, 0.05, 0.05), vec3(1.0, 0.86, 0.6) * 0.9, step(0.55, fract(rs * 5.3)) * 0.8), board);
      }
    } else {
      // no shops: a darker plinth at the foot of the wall
      col *= mix(0.72, 1.0, smoothstep(0.9 - yfw, 0.9 + yfw, y));
    }
  }
  // tower crowns: a short top tier on a glass tower is a louvred plant screen
  if (glassy && salt > 50.0 && y < top) {
    float lv = fract(y / 0.6);
    float lfw = fwidth(y / 0.6);
    float louvre = mix(0.5, smoothstep(0.3 - lfw, 0.3 + lfw, lv), 1.0 - smoothstep(0.2, 0.5, lfw));
    col = shade(vec3(0.42, 0.44, 0.46), N, vis) * (0.7 + 0.4 * louvre);
  }
  return col;
}
vec3 roofColor(int k, float h1, float h2, vec3 N, float vis) {
  // parapet tops: pale coping stone
  if (vFace.w < 0.0) return shade(vec3(0.7, 0.67, 0.62), N, vis);
  vec2 rp = vFace.xy;
  float ew = min(min(rp.x, vFace.z - rp.x), min(rp.y, vFace.w - rp.y));
  vec3 base = k <= 1 ? mix(vec3(0.4, 0.41, 0.43), vec3(0.72, 0.72, 0.7), step(0.55, h2)) : k == 4 ? vec3(0.58, 0.57, 0.54) : mix(vec3(0.56, 0.52, 0.46), vec3(0.68, 0.63, 0.55), h2);
  float fp = max(length(fwidth(vW.xz)), 1e-4);
  float n1 = vnoise(vW.xz * 0.13 + h1 * 40.0);
  // gravel grain up close, fading out before it can shimmer
  float g = (vnoise(vW.xz * 7.0) - 0.5) * (1.0 - smoothstep(0.03, 0.1, fp)) + (vnoise(vW.xz * 17.0) - 0.5) * (1.0 - smoothstep(0.012, 0.045, fp));
  base *= 0.93 + 0.1 * n1 + 0.16 * g;
  // roof membrane seams
  float sq = fract(rp.x / 2.0);
  float sfw = fwidth(rp.x / 2.0);
  base *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.06 + sfw, abs(sq - 0.5) - 0.45)) * (1.0 - smoothstep(0.1, 0.4, sfw)) * step(0.5, h1);
  // dark flashing where the roof meets the parapet, and a drain or two in the corners
  float fe = fwidth(ew);
  base = mix(base, vec3(0.22, 0.21, 0.22), 1.0 - smoothstep(0.35 - fe, 0.35 + fe, ew));
  vec2 dc = vec2(min(rp.x, vFace.z - rp.x), min(rp.y, vFace.w - rp.y)) - vec2(1.2);
  base = mix(base, vec3(0.12, 0.12, 0.13), (1.0 - smoothstep(0.18 - fe, 0.18 + fe, length(dc))) * (1.0 - smoothstep(0.1, 0.3, fe)));
  float ao = mix(0.7, 1.0, smoothstep(0.2, 2.4, ew));
  return shade(base, N, vis) * ao;
}
void main() {
  vec3 N = normalize(vN);
  vec3 toCam = cameraPosition - vW;
  vec3 V = toCam / max(length(toCam), 1e-3);
  float code = mod(floor(vInfo.x + 0.5), 16.0);
  float shop = step(7.5, code);
  int k = int(code - shop * 8.0 + 0.5);
  // hash inputs are rounded: a varying is never exactly constant across a triangle, and a hash amplifies the noise
  float sd = floor(vInfo.y * 4096.0 + 0.5);
  float salt = floor(vFace.z + 0.5);
  float h1 = fract(sd * 0.0913), h2 = fract(sd * 0.3771), h3 = fract(sd * 0.1313);
  vec3 col;
  if (N.y > 0.5) {
    col = roofColor(k, h1, h2, N, sunVis(vW));
  } else {
    float vis = dot(N, uSunDir) > 0.0 ? sunVis(vW + N * 2.5) : 0.0;
    col = wallColor(k, shop, sd, salt, h1, h2, h3, N, V, vis);
  }
  // a clogged district goes grey-green; the finale warms everything
  col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.82, 0.98, 0.62), vClog * 0.38);
  col *= mix(vec3(1.0), vec3(1.08, 1.0, 0.9), uFinale);
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), 1.0);
}`;

// The Needle, the Dome, the expressway and the King's perch: one mesh, a kind per vertex.
const LANDMARK_VS = /* glsl */ `
attribute float aKind;
varying vec3 vW;
varying vec3 vN;
varying float vKind;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normal; vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const LANDMARK_FS = /* glsl */ `
${COMMON}
uniform float uKing, uFinale;
uniform vec4 uNeedle; // x, z, pod bottom, (unused)
uniform vec4 uDome;   // x, z, radius, expressway centre z
uniform vec3 uCityRefl;
varying vec3 vW;
varying vec3 vN;
varying float vKind;
float aaLine(float d, float w, float fw) { return (1.0 - smoothstep(w - fw, w + fw, abs(d))) * (1.0 - smoothstep(w * 1.5, w * 5.0, fw)); }
void main() {
  vec3 N = normalize(vN);
  vec3 toCam = cameraPosition - vW;
  vec3 V = toCam / max(length(toCam), 1e-3);
  int k = int(vKind + 0.5);
  float vis = dot(N, uSunDir) > 0.0 || N.y > 0.5 ? sunVis(vW + vec3(N.x, 0.0, N.z) * 2.5) : 0.0;
  vec3 col;
  float maxF = 1.0;
  vec2 rel = vW.xz - uNeedle.xy;
  float az = atan(rel.y, rel.x);
  if (k <= 15) maxF = 0.6;
  if (k == 10) {
    // the Needle's concrete shaft: faint vertical flutes and pour lines
    float fl = fract(az * 24.0 / 6.2832);
    float ffw = fwidth(az * 24.0 / 6.2832);
    float flute = mix(0.5, smoothstep(0.1, 0.5, abs(fl - 0.5)), 1.0 - smoothstep(0.2, 0.6, ffw));
    vec3 alb = vec3(0.78, 0.74, 0.68) * (0.92 + 0.1 * flute) * (0.94 + 0.08 * vnoise(vec2(az * 3.0, vW.y * 0.05)));
    col = shade(alb, N, vis);
  } else if (k == 11) {
    // the pod's concrete, with a dark reveal line every few metres
    float rv = aaLine(fract(vW.y / 4.0) - 0.5, 0.03, fwidth(vW.y / 4.0));
    col = shade(vec3(0.66, 0.64, 0.61) * (1.0 - 0.3 * rv * step(abs(N.y), 0.5)), N, vis);
  } else if (k == 12) {
    // the pod's window band: mullions round the ring, lit warm (green when the King wakes)
    float m = fract(az * 64.0 / 6.2832);
    float mfw = fwidth(az * 64.0 / 6.2832);
    float mull = mix(0.12, smoothstep(0.06 - mfw, 0.06 + mfw, abs(m - 0.5) - 0.38), 1.0 - smoothstep(0.2, 0.5, mfw));
    float band = fract((vW.y - uNeedle.z) / 3.0);
    float bfw = fwidth((vW.y - uNeedle.z) / 3.0);
    float floorLine = aaLine(band - 0.5, 0.04, bfw);
    vec3 R = reflect(-V, N);
    float fres = 0.12 + 0.88 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
    float pulse = 0.75 + 0.25 * sin(uTime * 3.0);
    vec3 glow = mix(vec3(1.0, 0.76, 0.46), vec3(0.35, 1.0, 0.25) * pulse, uKing);
    vec3 inter = glow * (0.75 + 0.25 * uFinale + 0.4 * uKing);
    col = mix(inter * (1.0 - fres) + skyColor(R) * fres * 0.8, vec3(0.2, 0.2, 0.22), mull * 0.85 + floorLine * 0.6);
  } else if (k == 13) {
    // collars and the deck: metal, with a ring of warm lights on the rim
    col = shade(vec3(0.62, 0.61, 0.6), N, vis);
    float t = az * 72.0 / 6.2832;
    float tfw = fwidth(t);
    float dotL = (1.0 - smoothstep(0.18 - tfw, 0.18 + tfw, abs(fract(t) - 0.5))) * (1.0 - smoothstep(0.15, 0.5, tfw));
    float rim = step(abs(N.y), 0.5) * mix(0.2, dotL, 1.0 - smoothstep(0.15, 0.5, tfw));
    col = mix(col, mix(vec3(1.0, 0.82, 0.55), vec3(0.4, 1.0, 0.3), uKing * 0.8), rim * 0.8);
  } else if (k == 14) {
    // the antenna mast: grey with red and white bands near the top
    float bq = vW.y / 6.0, bfw = fwidth(bq);
    float band = mix(0.5, smoothstep(0.5 - bfw, 0.5 + bfw, fract(bq)), 1.0 - smoothstep(0.2, 0.5, bfw)) * step(330.0, vW.y);
    col = shade(mix(vec3(0.58, 0.58, 0.6), vec3(0.75, 0.16, 0.12), band), N, vis);
  } else if (k == 16 || k == 17) {
    // the Dome: pale roof panels on ribs, arched openings round the base
    float a = atan(vW.z - uDome.y, vW.x - uDome.x);
    float t = a * 32.0 / 6.2832;
    float tfw = fwidth(t);
    float rib = aaLine(fract(t) - 0.5, 0.05, tfw);
    float lat = aaLine(fract(vW.y / 8.0) - 0.5, 0.03, fwidth(vW.y / 8.0));
    vec3 alb = vec3(0.84, 0.83, 0.8) * (0.93 + 0.07 * vnoise(vec2(t * 0.5, vW.y * 0.2)));
    alb = mix(alb, vec3(0.55, 0.56, 0.58), max(rib, lat * 0.6));
    if (k == 17) {
      float ar = fract(t * 2.0), afw = fwidth(t * 2.0);
      float yy = vW.y / 7.5;
      float arch = (1.0 - smoothstep(0.32 - afw, 0.32 + afw, abs(ar - 0.5))) * step(0.08, yy) * (1.0 - smoothstep(0.7 - fwidth(yy), 0.7 + fwidth(yy), yy + pow(abs(ar - 0.5) * 2.4, 2.0) * 0.3));
      alb = mix(vec3(0.72, 0.68, 0.62), vec3(0.08, 0.07, 0.08), arch * (1.0 - smoothstep(0.2, 0.5, afw)));
      col = shade(alb, N, vis) + vec3(1.0, 0.7, 0.4) * arch * 0.25 * (1.0 - smoothstep(0.2, 0.5, afw));
    } else col = shade(alb, N, vis);
  } else if (k == 18) {
    // the expressway deck: asphalt, lane lines, edge lines
    float dz = vW.z - uDome.w;
    float fz = fwidth(vW.z) + 1e-4;
    vec3 alb = vec3(0.2, 0.2, 0.21) * (0.9 + 0.2 * vnoise(vW.xz * 0.3));
    float dash = mix(0.5, step(0.5, fract(vW.x / 9.0)), 1.0 - smoothstep(0.5, 2.0, fwidth(vW.x)));
    float lines = aaLine(abs(dz) - 3.5, 0.08, fz) * dash + aaLine(abs(dz) - 7.0, 0.08, fz) * dash + aaLine(abs(dz) - 10.2, 0.1, fz) + aaLine(dz, 0.25, fz) * 0.8;
    alb = mix(alb, vec3(0.8, 0.78, 0.72), clamp(lines, 0.0, 1.0));
    col = shade(alb, N, vis);
  } else if (k == 19) {
    vec3 alb = vec3(0.56, 0.54, 0.5) * (0.88 + 0.2 * vnoise(vec2(vW.x * 0.08, vW.y * 0.4)));
    if (N.y < -0.5) alb *= 0.45;
    col = shade(alb, N, vis);
  } else if (k == 20) {
    col = shade(vec3(0.7, 0.68, 0.64), N, vis);
  } else {
    // the King's perch: a gold plinth on the pod roof
    vec3 R = reflect(-V, N);
    col = shade(vec3(0.7, 0.52, 0.2), N, vis) * 0.7 + skyColor(R) * vec3(1.0, 0.75, 0.35) * 0.45;
  }
  gl_FragColor = vec4(fogMix(col, vW, maxF), 1.0);
}`;

// The ground: streets, sidewalks, crosswalks, parks, plazas and the promenade, all from one flat mesh.
const GROUND_VS = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const GROUND_PATTERN = /* glsl */ `
uniform sampler2D uStreets; // row 0: north-south lines, row 1: east-west lines (centre, half width, sidewalk, flags)
uniform vec4 uAvA[4];       // partial avenues: axis (0 = north-south), centre, half width, sidewalk
uniform vec4 uAvB[4];       // their extent (from, to) and flags
uniform vec4 uParks[4];
uniform vec4 uPlaza[2];
uniform vec4 uLand;         // min x, min z, max x, shore z
float aaLine(float d, float w, float fw) { return (1.0 - smoothstep(w - fw, w + fw, abs(d))) * (1.0 - smoothstep(w * 1.5, w * 5.0, fw)); }
// stripes along t with duty 0.5, fading to their average where they would shimmer
float stripes(float t, float fw) { float s = smoothstep(0.25 - fw, 0.25 + fw, abs(fract(t) - 0.5)); return mix(0.5, s, 1.0 - smoothstep(0.2, 0.5, fw)); }
float gGloss = 0.0; // how glossy the surface groundAlbedo() last returned is (the asphalt catches the sky)
vec3 asphalt(vec2 p, float fp) {
  float near = 1.0 - smoothstep(0.03, 0.15, fp);
  float n = vnoise(p * 0.11) * 0.6 + vnoise(p * 0.9) * 0.4 * (1.0 - smoothstep(0.3, 1.0, fp));
  // fine grit up close, and repaired patches on a loose grid
  float grit = (vnoise(p * 9.0) - 0.5) * near;
  vec2 cell = floor(p / vec2(7.0, 5.0));
  float patchv = step(0.84, hash12(cell)) * (hash12(cell + 3.1) - 0.5);
  vec2 pf = fract(p / vec2(7.0, 5.0));
  float inPatch = step(0.12, pf.x) * step(pf.x, 0.8) * step(0.2, pf.y) * step(pf.y, 0.75) * (1.0 - smoothstep(0.25, 0.8, fp));
  gGloss = 0.14;
  return vec3(0.25, 0.25, 0.265) * (0.86 + 0.26 * n + 0.18 * grit + 0.3 * patchv * inPatch);
}
vec3 pavers(vec2 p, float fp, vec3 c, float size) {
  vec2 g = abs(fract(p / size) - 0.5);
  float fw = fp / size;
  float joint = mix(0.08, smoothstep(0.46 - fw, 0.46 + fw, max(g.x, g.y)), 1.0 - smoothstep(0.1, 0.35, fw));
  return c * (0.94 + 0.1 * vnoise(p * 0.35)) * (1.0 - 0.18 * joint);
}
vec3 parkColor(vec2 p, vec4 r, float fp) {
  vec2 c = (r.xy + r.zw) * 0.5, hs = (r.zw - r.xy) * 0.5;
  vec2 q = (p - c) / hs;
  float n = vnoise(p * 0.15), n2 = vnoise(p * 1.3 + 7.0) * (1.0 - smoothstep(0.2, 0.8, fp));
  vec3 grass = mix(vec3(0.27, 0.33, 0.13), vec3(0.4, 0.4, 0.16), n) * (0.9 + 0.2 * n2);
  // fallen leaves under the trees
  float leaves = smoothstep(0.55, 0.8, vnoise(p * 0.4 + 3.0));
  grass = mix(grass, vec3(0.62, 0.34, 0.12), leaves * 0.55);
  // paths: the two diagonals and a ring
  float d1 = abs(q.x * hs.x - q.y * hs.y * (hs.x / hs.y)) / 1.4;
  float d2 = abs(q.x * hs.x + q.y * hs.y * (hs.x / hs.y)) / 1.4;
  float ring = abs(length(q * hs) - min(hs.x, hs.y) * 0.55);
  float path = 1.0 - smoothstep(1.3 - fp, 1.3 + fp, min(min(d1, d2), ring));
  return mix(grass, vec3(0.64, 0.56, 0.44) * (0.92 + 0.1 * n), path);
}
vec3 cityGround(vec2 p, float fp) {
  for (int i = 0; i < 4; i++) {
    vec4 r = uParks[i];
    if (p.x > r.x && p.x < r.z && p.y > r.y && p.y < r.w) return parkColor(p, r, fp);
  }
  for (int i = 0; i < 2; i++) {
    vec4 c = uPlaza[i];
    float d = length(p - c.xy);
    if (d < c.z) {
      float ring = aaLine(fract(d / 4.0) - 0.5, 0.05, fp / 4.0);
      return mix(vec3(0.66, 0.61, 0.54), vec3(0.5, 0.46, 0.42), ring * 0.7) * (0.93 + 0.1 * vnoise(p * 0.3));
    }
  }
  vec4 sx = texture2D(uStreets, vec2((p.x + 1024.0) / 2048.0, 0.25));
  vec4 sz = texture2D(uStreets, vec2((p.y + 1024.0) / 2048.0, 0.75));
  float dx = p.x - sx.x, hx = sx.y, wx = sx.z, fx = sx.w;
  float dz = p.y - sz.x, hz = sz.y, wz = sz.z, fz = sz.w;
  for (int i = 0; i < 4; i++) {
    vec4 a = uAvA[i], b = uAvB[i];
    if (a.z <= 0.0) continue;
    if (a.x < 0.5) {
      float d = p.x - a.y;
      if (p.y > b.x && p.y < b.y && abs(d) - a.z < abs(dx) - hx) { dx = d; hx = a.z; wx = a.w; fx = b.z; }
    } else {
      float d = p.y - a.y;
      if (p.x > b.x && p.x < b.y && abs(d) - a.z < abs(dz) - hz) { dz = d; hz = a.z; wz = a.w; fz = b.z; }
    }
  }
  float ax = abs(dx), az = abs(dz);
  bool onX = ax < hx && p.y < float(${PROMENADE}.0);
  bool onZ = az < hz;
  if (!onX && !onZ) {
    // inside a block: alleys and courtyards
    return vec3(0.5, 0.47, 0.43) * (0.86 + 0.24 * vnoise(p * 0.2));
  }
  bool roadX = onX && ax < hx - wx;
  bool roadZ = onZ && az < hz - wz;
  vec3 c;
  if (roadX && roadZ) return asphalt(p, fp) * 0.97;
  if (roadX || roadZ) {
    // lanes along the street: dx, dz are across and along it
    float across = roadX ? dx : dz, along = roadX ? p.y : p.x, aw = roadX ? ax : az;
    float hw = roadX ? hx - wx : hz - wz, flags = roadX ? fx : fz;
    bool atCross = roadX ? onZ : onX;
    c = asphalt(p, fp);
    // darker wheel paths in every lane, and a manhole cover now and then
    float ln = fract(max(aw - (flags > 1.5 ? 3.0 : 0.0), 0.0) / 3.5) - 0.5;
    float wheels = aaLine(abs(ln) - 0.26, 0.07, fp / 3.5) * (1.0 - smoothstep(0.1, 0.5, fp));
    c *= 1.0 - 0.14 * wheels;
    float mh = length(vec2(ln * 3.5, fract(along / 37.0 + floor(aw / 3.5) * 0.37) * 37.0 - 18.5));
    c = mix(c, vec3(0.16, 0.16, 0.17), (1.0 - smoothstep(0.34 - fp, 0.34 + fp, mh)) * (1.0 - smoothstep(0.05, 0.2, fp)) * step(hw, 12.0));
    if (atCross) {
      // a zebra crossing where the other street's sidewalk crosses this one
      float z = stripes(across / 1.2, fp / 1.2);
      c = mix(c, vec3(0.8, 0.8, 0.76), z * 0.9);
      return c;
    }
    float lines = 0.0;
    vec3 lc = vec3(0.82, 0.81, 0.76);
    if (flags > 1.5) {
      // the boulevard: a planted median
      if (aw < 3.0) {
        float n = vnoise(p * 0.5);
        return mix(vec3(0.3, 0.33, 0.14), vec3(0.6, 0.34, 0.12), smoothstep(0.5, 0.8, n) * 0.6) * (0.85 + 0.2 * n);
      }
      lines += aaLine(aw - 3.2, 0.12, fp);
      lines += aaLine(aw - 6.5, 0.08, fp) * step(0.55, fract(along / 9.0));
      lines += aaLine(aw - 10.0, 0.08, fp) * step(0.55, fract(along / 9.0));
    } else {
      float dash = step(0.55, fract(along / 9.0));
      lines += aaLine(aw - 3.5, 0.075, fp) * dash;
      if (hw > 9.0) lines += aaLine(aw - 7.0, 0.075, fp) * dash;
      // double yellow centre line
      float yl = aaLine(aw - 0.18, 0.06, fp);
      c = mix(c, vec3(0.86, 0.64, 0.14), yl * (flags > 0.5 ? 0.0 : 1.0));
      if (flags > 0.5) {
        // streetcar tracks: two rails per track, set in the lanes next to the centre
        float t1 = abs(aw - 1.75);
        float rails = aaLine(t1 - 0.72, 0.05, fp);
        c = mix(c, vec3(0.1, 0.1, 0.11), aaLine(t1, 0.95, fp) * 0.35);
        c = mix(c, vec3(0.62, 0.6, 0.58), rails);
      }
    }
    // stop lines before the crossings
    float dzn = roadX ? dz : dx, hzn = roadX ? hz : hx;
    float sideOk = roadX ? step(0.0, dx * dz) : step(0.0, -dz * dx);
    lines += aaLine(abs(dzn) - hzn - 0.9, 0.25, fp) * sideOk * step(abs(dzn), hzn + 3.0);
    c = mix(c, lc, clamp(lines, 0.0, 1.0));
    return c;
  }
  // sidewalks: pale slabs and a kerb along the road
  float toRoad = min(onX ? ax - (hx - wx) : 99.0, onZ ? az - (hz - wz) : 99.0);
  gGloss = 0.05;
  c = pavers(p, fp, vec3(0.6, 0.575, 0.54), 1.5);
  c = mix(c, vec3(0.74, 0.72, 0.68), 1.0 - smoothstep(0.3 - fp, 0.3 + fp, toRoad));
  return c;
}
vec3 promenade(vec2 p, float fp) {
  // boardwalk planks along the shore, a granite edge at the water
  float t = p.y / 0.18;
  float fw = fp / 0.18;
  float plank = mix(0.5, smoothstep(0.35 - fw, 0.35 + fw, abs(fract(t) - 0.5)), 1.0 - smoothstep(0.2, 0.5, fw));
  float n = vnoise(vec2(p.x * 0.08, floor(t) * 0.7));
  vec3 wood = vec3(0.52, 0.36, 0.22) * (0.84 + 0.25 * n) * (0.9 + 0.1 * plank);
  vec3 stone = pavers(p, fp, vec3(0.66, 0.62, 0.56), 2.0);
  vec3 c = p.y < 294.0 ? pavers(p, fp, vec3(0.55, 0.52, 0.48), 1.2) : wood;
  return mix(c, stone, smoothstep(uLand.w - 2.2 - fp, uLand.w - 2.2 + fp, p.y));
}
vec3 suburb(vec2 p, float fp) {
  // beyond the city: a patchwork of low roofs, yards and autumn woods, with a few long roads
  float n = vnoise(p * 0.012), n2 = vnoise(p * 0.07 + 3.0), n3 = vnoise(p * 0.35) * (1.0 - smoothstep(0.5, 2.0, fp));
  vec3 homes = mix(vec3(0.44, 0.38, 0.34), vec3(0.52, 0.47, 0.42), n3);
  vec3 woods = mix(vec3(0.46, 0.3, 0.14), vec3(0.34, 0.35, 0.18), n2);
  vec3 c = mix(homes, woods, smoothstep(0.4, 0.7, n) * 0.7);
  vec2 g = abs(fract((p + vec2(200.0)) / 400.0) - 0.5) * 400.0;
  float road = (1.0 - smoothstep(6.0 - fp, 6.0 + fp, min(g.x, g.y))) * (1.0 - smoothstep(4.0, 12.0, fp));
  return mix(c, vec3(0.26, 0.26, 0.27), road);
}
vec3 groundAlbedo(vec3 wp, vec3 N, float fp) {
  vec2 p = wp.xz;
  gGloss = 0.0;
  if (N.y < 0.5) return vec3(0.52, 0.5, 0.47) * (0.9 + 0.15 * vnoise(p * 0.5 + wp.y));
  if (p.x < uLand.x || p.x > uLand.z || p.y < uLand.y) return suburb(p, fp);
  if (p.y > float(${PROMENADE}.0)) return promenade(p, fp);
  return cityGround(p, fp);
}
`;
const GROUND_FS = /* glsl */ `
${COMMON}
${GROUND_PATTERN}
uniform float uClog[6];
uniform vec4 uDist[6];
varying vec3 vW;
varying vec3 vN;
float clogAt(vec2 p) {
  if (p.y > 110.0) return uClog[0];
  float best = 1e9, v = 0.0;
  for (int i = 1; i < 6; i++) { float d = length(p - uDist[i].xy) / uDist[i].z; if (d < best) { best = d; v = uClog[i]; } }
  return v;
}
void main() {
  vec3 N = normalize(vN);
  vec2 fw2 = fwidth(vW.xz);
  float fp = max(max(fw2.x, fw2.y), 1e-4);
  vec3 alb = groundAlbedo(vW, N, fp);
  vec2 uv = (vW.xz - uMapBox.xy) * uMapBox.zw;
  float vis = sunVis(vW + vec3(0.0, 0.1, 0.0) + N * 1.0);
  // a soft dark line where the walls meet the street
  float hb = texture2D(uMap, clamp(uv, 0.0, 1.0)).g * 510.0;
  float ao = 1.0 - 0.32 * smoothstep(0.0, 10.0, hb) * step(0.5, N.y);
  vec3 col = shade(alb, N, vis) * ao;
  // asphalt and paving catch the bright sky at a grazing angle, so streets toward the sunset shine
  vec3 V = normalize(cameraPosition - vW);
  col += skyColor(reflect(-V, N)) * gGloss * pow(1.0 - max(dot(N, V), 0.0), 4.0);
  // sludge in the gutters of a clogged district
  float cl = clogAt(vW.xz);
  if (cl > 0.01) {
    float s = smoothstep(0.62, 0.8, vnoise(vW.xz * 0.12)) * cl;
    col = mix(col, vec3(0.22, 0.28, 0.08) + vec3(0.2, 0.3, 0.05) * pow(max(dot(reflect(normalize(vW - cameraPosition), N), uSunDir), 0.0), 20.0), s * 0.8);
  }
  gl_FragColor = vec4(fogMix(col, vW, 1.0), 1.0);
}`;

// The lake: slow waves, the sky and the skyline mirrored, the sun's road of glitter.
const WATER_FS = /* glsl */ `
${COMMON}
uniform vec3 uWater, uCityRefl;
varying vec3 vW;
vec2 vgrad(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 du = 6.0 * f * (1.0 - f), u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return du * vec2(b - a + (a - b - c + d) * u.y, c - a + (a - b - c + d) * u.x);
}
// the city in the water: march the mirrored ray over the height map
vec3 cityRefl(vec3 o, vec3 R, vec3 sky, float dist) {
  if (R.z > 0.05) return sky;
  float t = 6.0;
  for (int i = 0; i < STEPS; i++) {
    vec3 q = o + R * t;
    if (q.y > 380.0) break;
    vec2 uv = (q.xz - uMapBox.xy) * uMapBox.zw;
    if (uv.y < 0.0) break;
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0) {
      float h = texture2D(uMap, uv).g * 510.0;
      if (q.y < h) {
        float lit = step(0.8, hash12(floor(vec2(q.x + q.z, q.y * 1.4) / 3.5)));
        vec3 c = mix(vec3(0.62, 0.44, 0.34), vec3(0.34, 0.3, 0.36), smoothstep(0.0, 1.0, q.y / 200.0));
        c += vec3(1.0, 0.72, 0.42) * lit * 0.35;
        float f = 1.0 - exp(-uFog.y * max(t + dist - uFog.x, 0.0) * 0.6);
        return mix(c, sky, clamp(f, 0.0, 1.0));
      }
    }
    t *= STEP_GROW;
  }
  return sky;
}
void main() {
  vec2 p = vW.xz;
  vec3 toCam = cameraPosition - vW;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 fw = fwidth(p);
  float fp = max(fw.x, fw.y);
  // waves, each octave faded out before it gets smaller than a pixel
  vec2 g = vec2(0.0);
  // a slow swell, bent by noise so it never lines up into stripes, then two octaves of chop
  vec2 wq = p + vec2(vnoise(p * 0.013), vnoise(p * 0.013 + 7.0)) * 40.0;
  g += vec2(cos(dot(wq, vec2(0.8, 0.6)) * 0.3 + uTime * 1.1), cos(dot(wq, vec2(-0.3, 0.95)) * 0.42 + uTime * 1.4)) * 0.016 * (1.0 - smoothstep(1.5, 6.0, fp));
  g += vgrad(p * 0.21 + vec2(uTime * 0.07, uTime * 0.05)) * 0.075 * (1.0 - smoothstep(0.8, 3.0, fp));
  g += vgrad(p * 0.83 - vec2(uTime * 0.21, -uTime * 0.13)) * 0.035 * (1.0 - smoothstep(0.25, 0.9, fp));
  float keep = 1.0 - smoothstep(0.25, 3.0, fp);
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  float ndv = max(dot(N, V), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 sky = skyColor(R);
  vec3 refl = cityRefl(vW, normalize(vec3(R.x, R.y, R.z)), sky, dist);
  vec3 body = uWater * (0.5 + 0.35 * uSunCol * max(uSunDir.y, 0.0) + 0.3 * uAmbSky);
  vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0));
  // sun glitter: sharp sparkles close by, a broad road of light far away
  float sd = max(dot(R, uSunDir), 0.0);
  float rough = 1.0 - keep;
  float spec = pow(sd, mix(900.0, 60.0, rough)) * mix(7.0, 1.2, rough);
  vec2 gq = p * 1.6;
  spec += pow(sd, 30.0) * step(0.93, hash12(floor(gq) + floor(uTime * 5.0))) * smoothstep(0.35, 0.05, length(fract(gq) - 0.5)) * 2.5 * (1.0 - smoothstep(0.08, 0.3, fp));
  col += uSunCol * spec;
  // a pale lip of foam along the quay
  col = mix(col, vec3(0.85, 0.78, 0.7), (1.0 - smoothstep(0.0, 1.2 + fp, p.y - ${WORLD.shoreZ}.0)) * 0.35);
  gl_FragColor = vec4(fogMix(col, vW, 1.0), 1.0);
}`;

// The sky dome: the gradient, the sun and its glow, soft golden clouds, and aircraft lights. It draws last, at the far
// plane, so the depth test skips every pixel something else covers.
const SKY_VS = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 p = projectionMatrix * viewMatrix * w;
  gl_Position = vec4(p.xy, p.w * 0.999999, p.w);
}`;
const SKY_FS = /* glsl */ `
${COMMON}
varying vec3 vW;
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 3.7); a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vW - cameraPosition);
  vec3 col = skyColor(d);
  float s = dot(d, uSunDir);
  // the sun: a soft bright disc
  col += vec3(1.0, 0.86, 0.6) * smoothstep(0.99955, 0.99975, s) * 1.2 + uGlow * smoothstep(0.994, 0.9997, s) * 0.3;
  if (d.y > -0.02) {
    // clouds on a high flat layer, lit gold and rose from below, lavender in their shade
    vec2 uv = d.xz / (max(d.y, 0.0) + 0.1);
    uv = vec2(uv.x * 0.8 + uv.y * 0.3, uv.y * 1.8 - uv.x * 0.2) * 0.55 + vec2(uTime * 0.004, uTime * 0.0015);
    float n = fbm(uv);
    float body = smoothstep(0.5, 0.72, n) * smoothstep(0.0, 0.12, d.y);
    float thick = smoothstep(0.6, 0.9, n);
    float toward = pow(max(s, 0.0), 3.0);
    vec3 lit = mix(vec3(1.0, 0.66, 0.5), vec3(1.0, 0.82, 0.55), toward);
    vec3 cc = mix(lit, vec3(0.52, 0.42, 0.58), thick * 0.7 * (1.0 - toward * 0.6));
    cc = mix(cc, skyColor(d), smoothstep(0.35, 0.0, d.y) * 0.5);
    col = mix(col, cc, body * 0.85);
  }
  // two aircraft crossing, a steady red light and a white strobe each, never smaller than a pixel
  float px = length(fwidth(d)) * 1.2;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float a = uTime * (0.006 + 0.004 * fi) + fi * 2.4;
    vec3 pd = normalize(vec3(cos(a) * 3.0, 0.35 + 0.12 * fi, sin(a) * 3.0 + 0.8));
    float r = length(d - pd);
    float strobe = step(0.9, fract(uTime * 0.8 + fi * 0.37));
    col = mix(col, vec3(1.0, 0.2, 0.15), 1.0 - smoothstep(px, px * 2.0, r));
    col = mix(col, vec3(1.0), (1.0 - smoothstep(px, px * 2.0, length(d - pd - vec3(0.0015, 0.0, 0.0)))) * strobe);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// Trees: a trunk and two lumpy crown lobes, one instance each; the crowns glow when the sun is behind them.
const TREE_VS = /* glsl */ `
${VERTEX_FOG}
varying float vVis;
attribute float aPart;
attribute vec4 aT;  // x, y, z, scale
attribute vec4 aTc; // colour, turn
uniform float uTime;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
varying float vPart;
void main() {
  float c = cos(aTc.w), s = sin(aTc.w);
  vec3 p = position * aT.w;
  p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  vec3 n = vec3(normal.x * c + normal.z * s, normal.y, -normal.x * s + normal.z * c);
  // a slow sway in the evening breeze
  float k = max(position.y - 2.0, 0.0) * 0.012 * aT.w;
  p.x += k * sin(uTime * 1.1 + aT.x * 0.13 + aT.z * 0.07);
  p.z += k * sin(uTime * 0.9 + aT.z * 0.11);
  vec4 w = modelMatrix * vec4(aT.xyz + p, 1.0);
  vW = w.xyz; vN = n; vC = aTc.rgb; vPart = aPart;
  vVis = sunVisV(w.xyz);
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const TREE_FS = /* glsl */ `
${COMMON}
varying vec4 vFog;
varying float vVis;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
varying float vPart;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float vis = vVis;
  vec3 col;
  if (vPart < 0.5) {
    col = shade(vec3(0.3, 0.22, 0.16), N, vis);
  } else {
    // clumps of leaves: two scales of noise, dark gaps between the clumps; each scale fades before it can shimmer
    float fp = length(fwidth(vW));
    float c1 = vnoise(vW.xz * 1.4 + vW.y * 1.1), c2 = vnoise(vW.xz * 3.7 - vW.y * 2.9);
    float leaf = mix(0.5, smoothstep(0.3, 0.7, c1), 1.0 - smoothstep(0.25, 0.8, fp)) * 0.65 + mix(0.5, c2, 1.0 - smoothstep(0.1, 0.35, fp)) * 0.35;
    vec3 alb = vC * (0.62 + 0.62 * leaf) * (0.72 + 0.28 * smoothstep(-0.6, 0.8, N.y));
    // leaves wrap the light round, and glow when the sun shines through them
    float ndl = clamp(dot(N, uSunDir) * 0.6 + 0.4, 0.0, 1.0) * vis;
    float thru = pow(max(dot(-V, uSunDir), 0.0), 4.0) * vis;
    col = alb * (uSunCol * ndl * 0.9 + mix(uAmbGnd, uAmbSky, N.y * 0.5 + 0.5) * 0.85) + vC * uSunCol * thru * 0.55;
  }
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), 1.0);
}`;

// Cars and streetcars: they drive their lanes in the vertex shader, from uTime, with head and tail lights.
const CAR_VS = /* glsl */ `
${VERTEX_FOG}
varying float vVis;
attribute vec4 aLane; // start x, y, z, heading (0 +x, 1 -x, 2 +z, 3 -z)
attribute vec4 aMove; // lane length, speed, phase, (unused)
attribute vec3 aColor;
attribute float aPart;
uniform float uTime;
varying vec3 vW;
varying vec3 vN;
varying vec3 vL;
varying vec3 vLN;
varying vec3 vC;
varying float vPart;
void main() {
  vPart = aPart;
  float s = mod(aMove.z + aMove.y * uTime, aMove.x);
  float h = aLane.w;
  vec3 f = h < 0.5 ? vec3(1.0, 0.0, 0.0) : h < 1.5 ? vec3(-1.0, 0.0, 0.0) : h < 2.5 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 0.0, -1.0);
  vec3 side = vec3(-f.z, 0.0, f.x);
  // cars shrink away at the very ends of their lane, out in the haze or under the expressway
  float e = smoothstep(0.0, 8.0, min(s, aMove.x - s));
  vec3 lp = position * e;
  vec3 wp = aLane.xyz + f * s + f * lp.x + vec3(0.0, lp.y, 0.0) + side * lp.z;
  vec4 w = modelMatrix * vec4(wp, 1.0);
  vW = w.xyz; vL = position; vLN = normal; vC = aColor;
  vN = f * normal.x + vec3(0.0, normal.y, 0.0) + side * normal.z;
  vVis = sunVisV(aLane.xyz + f * s + vec3(0.0, 1.0, 0.0));
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CAR_FS = /* glsl */ `
${COMMON}
varying vec4 vFog;
varying float vVis;
uniform vec3 uHalf; // half length, half width, height of the lamps
varying vec3 vW;
varying vec3 vN;
varying vec3 vL;
varying vec3 vLN;
varying vec3 vC;
varying float vPart;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float vis = vVis;
  vec3 alb = vC;
  float fp = length(fwidth(vL)) + 1e-4;
  #ifdef STREETCAR
  // red body, a white band, a strip of lit windows
  float win = smoothstep(1.35 - fp, 1.35 + fp, vL.y) * (1.0 - smoothstep(2.55 - fp, 2.55 + fp, vL.y));
  float band = smoothstep(0.95 - fp, 0.95 + fp, vL.y) * (1.0 - smoothstep(1.2 - fp, 1.2 + fp, vL.y));
  alb = mix(alb, vec3(0.9, 0.88, 0.84), band);
  vec3 col = shade(alb, N, vis);
  vec3 R = reflect(-V, N);
  col = mix(col, vec3(1.0, 0.8, 0.55) * 0.75 + skyColor(R) * 0.2, win * step(abs(vLN.y), 0.5));
  #else
  // glass: the windscreen and rear window (part 1), and the side windows between the pillars
  float sideF = step(0.5, abs(vLN.z));
  float xw = 1.05 - (vL.y - 0.98) * 1.49, xr = -1.85 + (vL.y - 1.02) * 1.875;
  float sideWin = sideF * step(1.04, vL.y) * step(vL.y, 1.42) * step(vL.x, xw - 0.1) * step(xr + 0.1, vL.x) * step(0.07, abs(vL.x + 0.3));
  float glass = max(step(0.5, vPart), sideWin);
  // wheels: dark tyres with a pale hub, on the sides
  float wd = min(length(vL.xy - vec2(1.45, 0.34)), length(vL.xy - vec2(-1.45, 0.34)));
  float tyre = sideF * (1.0 - smoothstep(0.34 - fp, 0.34 + fp, wd));
  float hub = sideF * (1.0 - smoothstep(0.16 - fp, 0.16 + fp, wd));
  alb = mix(alb, vec3(0.05), tyre);
  alb = mix(alb, vec3(0.55, 0.55, 0.56), hub);
  alb *= mix(1.0, 0.45, (1.0 - smoothstep(0.1, 0.25, vL.y)) * (1.0 - tyre));
  vec3 col = shade(alb, N, vis);
  vec3 R = reflect(-V, N);
  float fres = 0.1 + 0.9 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col = mix(col, vec3(0.05, 0.06, 0.08) + skyColor(R) * fres, glass * 0.92);
  // a glossy paint sheen
  col += skyColor(R) * (0.06 + 0.2 * fres) * (1.0 - glass) * (1.0 - tyre);
  #endif
  // lights on the front and back faces
  float lx = abs(vL.z) - uHalf.y * 0.62;
  float light = (1.0 - smoothstep(0.2 - fp, 0.2 + fp, abs(lx))) * (1.0 - smoothstep(0.08 - fp, 0.08 + fp, abs(vL.y - uHalf.z)));
  float front = step(0.5, vLN.x), back = step(0.5, -vLN.x);
  col = mix(col, vec3(1.0, 0.95, 0.78) * 1.4, light * front);
  col = mix(col, vec3(1.0, 0.1, 0.06), light * back);
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), 1.0);
}`;

// Roof props: boxes (plant rooms and air conditioners), water towers, masts and gardens. aPart: 0 plain, 2 fan top,
// 3 wood staves, 4 leaves, 5 metal.
const PROP_VS = /* glsl */ `
${VERTEX_FOG}
varying float vVis;
attribute float aPart;
uniform float uTime;
attribute vec3 aCol;
attribute vec4 aP; // x, y, z, turn
attribute vec4 aS; // scale x, y, z, hash
varying vec3 vW;
varying vec3 vN;
varying vec3 vL;
varying vec3 vC;
varying vec3 vS;
varying vec3 vLN;
varying float vPart;
varying float vHash;
void main() {
  float c = cos(aP.w), s = sin(aP.w);
  vec3 p = position * aS.xyz;
  // street lamps shrink away in the distance: a thin pole far off would only flicker
  if (aPart > 5.5) p *= 1.0 - smoothstep(170.0, 240.0, length(aP.xyz - cameraPosition));
  p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  vec3 n = vec3(normal.x * c + normal.z * s, normal.y, -normal.x * s + normal.z * c);
  vec4 w = modelMatrix * vec4(aP.xyz + p, 1.0);
  vW = w.xyz; vN = n; vL = position; vC = aCol; vPart = aPart; vHash = aS.w; vS = aS.xyz; vLN = normal;
  vVis = sunVisV(w.xyz + vec3(n.x, 0.0, n.z));
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const PROP_FS = /* glsl */ `
${COMMON}
varying vec4 vFog;
varying float vVis;
varying vec3 vW;
varying vec3 vN;
varying vec3 vL;
varying vec3 vC;
varying vec3 vS;
varying vec3 vLN;
varying float vPart;
varying float vHash;
void main() {
  vec3 N = normalize(vN);
  float vis = vVis;
  vec3 alb = vC * mix(vec3(0.9), vec3(1.1), vHash);
  int part = int(vPart + 0.5);
  float fp = length(fwidth(vL)) + 1e-4;
  if (part == 2) {
    // boxes: plant rooms (big) with a door and louvres; air conditioners (small) with grilles and a fan on top
    bool big = vS.x > 2.4;
    vec3 m = vL * vS;
    vec3 mfw = fwidth(m) + 1e-4;
    float d = 1.0 - smoothstep(0.03, 0.1, max(mfw.x, max(mfw.y, mfw.z)));
    if (big) alb = mix(vec3(0.62, 0.56, 0.5), vec3(0.5, 0.52, 0.54), step(0.5, vHash));
    if (vLN.y > 0.5) {
      if (!big) alb *= mix(0.55, 1.0, smoothstep(0.34 - fp, 0.34 + fp, length(vL.xz)));
      else alb *= 0.8;
    } else if (vLN.y > -0.5) {
      float h = abs(vLN.z) > 0.5 ? m.x : m.z;
      alb *= mix(0.72, 1.0, smoothstep(0.0, 0.25, m.y));
      if (big) {
        float door = step(abs(h), 0.5) * step(m.y, 2.1) * step(vLN.z, -0.5);
        alb = mix(alb, vec3(0.2, 0.27, 0.24), door);
        float louv = step(vS.y - 0.9, m.y) * step(m.y, vS.y - 0.2) * step(abs(h), 0.9) * step(0.5, vLN.x);
        alb *= 1.0 - louv * mix(0.25, 0.45 * step(0.5, fract(m.y / 0.12)), d);
      } else {
        alb *= mix(0.9, 0.78 + 0.3 * step(0.5, fract(h / 0.09)), d * step(0.25, m.y) * step(m.y, vS.y - 0.15));
      }
    }
  } else if (part == 3) {
    // wooden staves and steel hoops
    float a = atan(vL.z, vL.x) * 12.0;
    float st = mix(0.5, smoothstep(0.1, 0.4, abs(fract(a) - 0.5)), 1.0 - smoothstep(0.2, 0.6, fwidth(a)));
    float hoop = step(0.85, fract(vL.y * 2.2));
    alb = mix(vec3(0.46, 0.32, 0.22) * (0.85 + 0.2 * st), vec3(0.2, 0.2, 0.2), hoop * (1.0 - smoothstep(0.2, 0.5, fp * 2.2)));
  } else if (part == 4) {
    alb = vC * (0.75 + 0.5 * vnoise(vW.xz * 2.0 + vW.y));
  }
  vec3 col = shade(alb, N, vis);
  if (part == 5 || part == 7) col += skyColor(reflect(normalize(vW - cameraPosition), N)) * 0.15;
  // a lamp head: its glass glows warm underneath
  if (part == 6) col = mix(col, vec3(1.0, 0.8, 0.5) * 1.15, step(vLN.y, -0.5));
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), 1.0);
}`;

// Red aviation beacons on the Needle and the tall towers: they blink, and never shrink below a couple of pixels.
const BEACON_VS = /* glsl */ `
attribute vec4 aB; // x, y, z, size
uniform float uTime;
varying float vOn;
varying vec3 vW;
void main() {
  float d = length(aB.xyz - cameraPosition);
  float k = max(aB.w, d * 0.0028);
  vec4 w = modelMatrix * vec4(aB.xyz + position * k, 1.0);
  vW = w.xyz;
  float ph = fract(aB.x * 0.013 + aB.z * 0.007);
  vOn = 0.25 + 0.75 * step(0.45, fract(uTime * 0.5 + ph));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const BEACON_FS = /* glsl */ `
${COMMON}
uniform float uKing;
varying float vOn;
varying vec3 vW;
void main() {
  vec3 c = vec3(1.0, 0.12, 0.06) * vOn;
  gl_FragColor = vec4(mix(c, fogMix(c, vW, 1.0), 0.35), 1.0);
}`;

// The far skyline and the hills round the lake: haze silhouettes with a few lit windows.
const FAR_VS = /* glsl */ `
${VERTEX_FOG}
attribute float aKind;
varying vec3 vW;
varying vec3 vN;
varying float vKind;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normal; vKind = aKind;
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FAR_FS = /* glsl */ `
${COMMON}
varying vec4 vFog;
varying vec3 vW;
varying vec3 vN;
varying float vKind;
void main() {
  vec3 col;
  if (vKind < 0.5) {
    // towers: shaded walls, warm dots while they are big enough to see; the same haze as the ground round them
    vec2 c = vec2((vW.x + vW.z) / 5.0, vW.y / 4.0);
    vec2 fw = fwidth(c);
    float wallF = step(abs(vN.y), 0.5);
    float det = (1.0 - smoothstep(0.25, 0.6, max(fw.x, fw.y))) * wallF;
    float lit = mix(0.14, step(0.86, hash12(floor(c))), det) * step(4.0, vW.y) * wallF;
    col = shade(vec3(0.46, 0.44, 0.46), normalize(vN), 1.0) + vec3(1.0, 0.75, 0.45) * lit * 0.5;
    col = mix(col, vFog.rgb, vFog.a * 0.86);
  } else {
    col = mix(shade(vec3(0.34, 0.36, 0.3), normalize(vN), 1.0), vFog.rgb, vFog.a * 0.9);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/* ---------------- the diorama (spec §9: shared geometry, a simple unlit material, no fog) ---------------- */
const DIO_BUILD_FS = /* glsl */ `
uniform float uClog[6];
varying vec3 vN;
varying vec4 vInfo;
varying float vClog;
void main() {
  vec3 N = normalize(vN);
  float code = mod(floor(vInfo.x + 0.5), 16.0);
  int k = int(code - step(7.5, code) * 8.0 + 0.5);
  vec3 c = k == 0 ? vec3(0.42, 0.55, 0.64) : k == 1 ? vec3(0.85, 0.66, 0.3) : k == 2 ? vec3(0.62, 0.34, 0.25) : k == 3 ? vec3(0.8, 0.74, 0.62) : k == 4 ? vec3(0.62, 0.61, 0.6) : vec3(0.56, 0.36, 0.26);
  if (N.y > 0.5) c = mix(c, vec3(0.7, 0.68, 0.64), 0.45);
  c *= 0.62 + 0.38 * max(dot(N, normalize(vec3(-0.5, 0.8, 0.45))), 0.0) + 0.12 * N.y;
  c = mix(c, vec3(dot(c, vec3(0.3, 0.5, 0.2))) * vec3(0.7, 1.0, 0.45), vClog * 0.55);
  gl_FragColor = vec4(c, 1.0);
}`;
const DIO_BUILD_VS = /* glsl */ `
attribute vec4 aInfo;
attribute float aDist;
uniform float uClog[6];
varying vec3 vN;
varying vec4 vInfo;
varying float vClog;
void main() {
  vN = normal; vInfo = aInfo;
  vClog = uClog[int(aDist + 0.5)];
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const DIO_SIMPLE_VS = /* glsl */ `
attribute float aKind;
varying vec3 vN;
varying vec3 vP;
varying float vKind;
void main() {
  vN = normal; vP = position; vKind = aKind;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const DIO_GROUND_FS = /* glsl */ `
uniform float uTime;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
${GROUND_PATTERN}
uniform vec3 uWater;
varying vec3 vN;
varying vec3 vP;
varying float vKind;
void main() {
  vec3 N = normalize(vN);
  vec3 c;
  if (vKind > 1.5) c = uWater * 1.25;
  else if (N.y < 0.5) c = vec3(0.24, 0.17, 0.14);
  else {
    vec2 fw = fwidth(vP.xz);
    c = groundAlbedo(vP, N, max(max(fw.x, fw.y), 0.4) * 2.0) * 1.15;
  }
  gl_FragColor = vec4(c, 1.0);
}`;
const DIO_LAND_FS = /* glsl */ `
uniform vec4 uLand;
varying vec3 vN;
varying vec3 vP;
varying float vKind;
void main() {
  // the expressway runs on past the land in the city; the model stops at its edge
  if (vP.x < uLand.x || vP.x > uLand.z) discard;
  vec3 N = normalize(vN);
  int k = int(vKind + 0.5);
  vec3 c = k <= 11 || k == 13 || k == 14 ? vec3(0.86, 0.82, 0.76) : k == 12 ? vec3(1.0, 0.78, 0.45) : k == 16 || k == 17 ? vec3(0.9, 0.9, 0.88) : k == 21 ? vec3(0.95, 0.72, 0.3) : vec3(0.62, 0.6, 0.57);
  c *= 0.62 + 0.38 * max(dot(N, normalize(vec3(-0.5, 0.8, 0.45))), 0.0) + 0.12 * N.y;
  gl_FragColor = vec4(c, 1.0);
}`;
const DIO_TREE_VS = /* glsl */ `
attribute float aPart;
attribute vec4 aT;
attribute vec4 aTc;
varying vec3 vC;
varying vec3 vN;
void main() {
  float c = cos(aTc.w), s = sin(aTc.w);
  vec3 p = position * aT.w;
  p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  vN = normal;
  vC = aPart < 0.5 ? vec3(0.3, 0.22, 0.16) : aTc.rgb;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aT.xyz + p, 1.0);
}`;
const DIO_TREE_FS = /* glsl */ `
varying vec3 vC;
varying vec3 vN;
void main() {
  vec3 N = normalize(vN);
  gl_FragColor = vec4(vC * (0.7 + 0.4 * max(dot(N, normalize(vec3(-0.5, 0.8, 0.45))), 0.0)), 1.0);
}`;

/* ---------------- geometry helpers ---------------- */
// A growable vertex buffer on typed arrays for one merged mesh; finish() turns it into a BufferGeometry.
// The build runs inside XR frames, so the helpers write straight into the arrays and allocate little.
function Buf(extra, cap = 2048) {
  const b = { v: 0, ni: 0, cap, p: new Float32Array(cap * 3), n: new Float32Array(cap * 3), i: new Uint32Array(cap * 2), x: {} };
  for (const k in extra) b.x[k] = { size: extra[k], a: new Float32Array(cap * extra[k]) };
  return b;
}
function growF(a, n) { const t = new Float32Array(n); t.set(a); return t; }
// room for nv more vertices and ni more indices
function reserve(b, nv, ni = nv * 1.5) {
  if (b.v + nv > b.cap) {
    const cap = Math.max(b.cap * 2, b.v + nv + 1024);
    b.p = growF(b.p, cap * 3); b.n = growF(b.n, cap * 3);
    for (const k in b.x) b.x[k].a = growF(b.x[k].a, cap * b.x[k].size);
    b.cap = cap;
  }
  if (b.ni + ni > b.i.length) { const t = new Uint32Array(Math.max(b.i.length * 2, b.ni + ni + 2048)); t.set(b.i); b.i = t; }
}
function vtx(b, x, y, z, nx, ny, nz) {
  const o = b.v * 3;
  b.p[o] = x; b.p[o + 1] = y; b.p[o + 2] = z;
  b.n[o] = nx; b.n[o + 1] = ny; b.n[o + 2] = nz;
  return b.v++;
}
// one attribute value for vertex v (up to four numbers)
function av(b, k, v, a0, a1, a2, a3) {
  const e = b.x[k], o = v * e.size, a = e.a;
  a[o] = a0;
  if (e.size > 1) { a[o + 1] = a1; if (e.size > 2) { a[o + 2] = a2; if (e.size > 3) a[o + 3] = a3; } }
}
function quadIdx(b, v) {
  const i = b.i, o = b.ni;
  i[o] = v; i[o + 1] = v + 1; i[o + 2] = v + 2; i[o + 3] = v; i[o + 4] = v + 2; i[o + 5] = v + 3;
  b.ni += 6;
}
function finish(b, center) {
  const g = new THREE.BufferGeometry();
  const pos = b.p.slice(0, b.v * 3);
  if (center) for (let i = 0; i < pos.length; i += 3) { pos[i] -= center[0]; pos[i + 1] -= center[1]; pos[i + 2] -= center[2]; }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(b.n.slice(0, b.v * 3), 3));
  for (const k in b.x) { const e = b.x[k]; g.setAttribute(k, new THREE.BufferAttribute(e.a.slice(0, b.v * e.size), e.size)); }
  const idx = b.v > 65535 ? b.i.slice(0, b.ni) : new Uint16Array(b.i.subarray(0, b.ni));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}
// One quad: corners CCW seen from the front, one normal, extra attribute values (one list, or one list per corner).
function quad(b, c, n, ex) {
  reserve(b, 4);
  const v = b.v;
  for (let j = 0; j < 4; j++) { const q = c[j]; vtx(b, q[0], q[1], q[2], n[0], n[1], n[2]); }
  for (const k in ex) {
    const vals = ex[k], per = typeof vals[0] !== "number";
    for (let j = 0; j < 4; j++) { const w = per ? vals[j] : vals; av(b, k, v + j, w[0], w[1], w[2], w[3]); }
  }
  quadIdx(b, v);
}
// An axis-aligned box (no bottom unless asked) with one kind value.
function boxQuads(b, x0, y0, z0, x1, y1, z1, ex, bottom = false) {
  const k = ex.aKind !== undefined ? ex.aKind[0] : 0;
  const face = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz) => {
    reserve(b, 4);
    const v = b.v;
    vtx(b, ax, ay, az, nx, ny, nz); vtx(b, bx, by, bz, nx, ny, nz); vtx(b, cx, cy, cz, nx, ny, nz); vtx(b, dx, dy, dz, nx, ny, nz);
    if (b.x.aKind) for (let j = 0; j < 4; j++) b.x.aKind.a[v + j] = k;
    quadIdx(b, v);
  };
  face(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1);
  face(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1);
  face(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0);
  face(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0);
  face(x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0, 0, 1, 0);
  if (bottom) face(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0);
}
// A surface of revolution round (cx, cz): prof = [[r, y, kind], ...]; each segment takes the kind of its first point.
// Normals are smooth round the axis and flat along the profile, so every ledge reads crisp.
const TRIG = new Map();
function trig(segs) {
  let t = TRIG.get(segs);
  if (!t) { t = new Float32Array((segs + 1) * 2); for (let j = 0; j <= segs; j++) { t[j * 2] = Math.cos((j / segs) * Math.PI * 2); t[j * 2 + 1] = Math.sin((j / segs) * Math.PI * 2); } TRIG.set(segs, t); }
  return t;
}
function lathe(b, prof, segs, cx, cz) {
  const T = trig(segs), K = b.x.aKind.a;
  for (let s = 0; s < prof.length - 1; s++) {
    const r0 = prof[s][0], y0 = prof[s][1], kind = prof[s][2], r1 = prof[s + 1][0], y1 = prof[s + 1][1];
    const dr = r1 - r0, dy = y1 - y0, l = Math.hypot(dr, dy);
    if (l < 1e-6) continue;
    const nr = dy / l, ny = -dr / l;
    reserve(b, segs * 4);
    for (let j = 0; j < segs; j++) {
      const c0 = T[j * 2], s0 = T[j * 2 + 1], c1 = T[j * 2 + 2], s1 = T[j * 2 + 3];
      // corners: bottom at a1, bottom at a0, top at a0, top at a1 (CCW from outside)
      const v = vtx(b, cx + r0 * c1, y0, cz + r0 * s1, nr * c1, ny, nr * s1);
      vtx(b, cx + r0 * c0, y0, cz + r0 * s0, nr * c0, ny, nr * s0);
      vtx(b, cx + r1 * c0, y1, cz + r1 * s0, nr * c0, ny, nr * s0);
      vtx(b, cx + r1 * c1, y1, cz + r1 * s1, nr * c1, ny, nr * s1);
      K[v] = K[v + 1] = K[v + 2] = K[v + 3] = kind;
      quadIdx(b, v);
    }
  }
}
// A three geometry after a matrix, into the buffer with a part id and extra per-vertex values. Its index is kept;
// weld = true joins the corners a non-indexed geometry repeats (for smooth ones), so each is shaded once.
function addGeo(b, geo, m, part, extra = {}, weld = false) {
  geo.applyMatrix4(m);
  const p = geo.attributes.position.array, n = geo.attributes.normal.array, cnt = geo.attributes.position.count;
  const idx = geo.index ? geo.index.array : null, ni = idx ? idx.length : cnt;
  reserve(b, cnt, ni);
  const map = new Int32Array(cnt), seen = weld ? new Map() : null;
  for (let i = 0; i < cnt; i++) {
    if (weld) {
      const key = Math.round(p[i * 3] * 1000) + "," + Math.round(p[i * 3 + 1] * 1000) + "," + Math.round(p[i * 3 + 2] * 1000);
      const at = seen.get(key);
      if (at !== undefined) { map[i] = at; continue; }
      seen.set(key, b.v);
    }
    const v = vtx(b, p[i * 3], p[i * 3 + 1], p[i * 3 + 2], n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
    map[i] = v;
    b.x.aPart.a[v] = part;
    for (const k in extra) { const w = extra[k](p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); av(b, k, v, w[0], w[1], w[2], w[3]); }
  }
  for (let i = 0; i < ni; i++) b.i[b.ni++] = map[idx ? idx[i] : i];
  geo.dispose();
}

/* ---------------- the view ---------------- */
export function createCityView(renderer, scene, city, opts = {}) {
  const low = !!opts.low;
  const root = new THREE.Group();
  root.name = "cityview";
  scene.add(root);
  scene.fog = null; // the city fogs itself in its shaders, toward the sky colour behind each point
  const B = city.bounds, N0 = city.needle, D0 = city.dome, X0 = city.expressway, S0 = city.start;
  const col3 = (h) => { const c = new THREE.Color(h); return new THREE.Vector3(c.r, c.g, c.b); };
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

  /* ---- shared uniforms ---- */
  const sunLen = Math.hypot(SUN_DIR.x, SUN_DIR.z);
  const clogNow = new Float32Array(6), clogWant = new Float32Array(6);
  const U = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z) },
    uSunXZ: { value: new THREE.Vector2(SUN_DIR.x / sunLen, SUN_DIR.z / sunLen) },
    uSunCol: { value: v3(SUN_COL) },
    uSkyTop: { value: col3(COLORS.skyTop) }, uSkyMid: { value: col3(COLORS.skyMid) }, uSkyHor: { value: col3(COLORS.skyHorizon) },
    uGlow: { value: v3(GLOW) },
    uAmbSky: { value: v3(AMB_SKY) }, uAmbGnd: { value: v3(AMB_GND) },
    // fog (spec §9): it starts at PERF.fogNear and hides 90 % by PERF.fogFar at street level; thinner higher up
    uFog: { value: new THREE.Vector3(PERF.fogNear, Math.LN10 / (PERF.fogFar - PERF.fogNear), 110) },
    uMap: { value: null }, uMapBox: { value: new THREE.Vector4(MAP.x0, MAP.z0, 1 / (MAP.nx * MAP.cell), 1 / (MAP.nz * MAP.cell)) },
    uClog: { value: clogNow },
    uKing: { value: 0 }, uFinale: { value: 0 },
    uCityRefl: { value: v3(CITY_REFL) },
    uWater: { value: col3(COLORS.water) },
  };
  const pick = (...names) => Object.fromEntries(names.map((n) => [n, U[n]]));
  const COMMON_U = ["uTime", "uSunDir", "uSunXZ", "uSunCol", "uSkyTop", "uSkyMid", "uSkyHor", "uGlow", "uAmbSky", "uAmbGnd", "uFog", "uMap", "uMapBox"];

  // Height (G) and shadow height (R) over the city, 2 m per step. Filled by the build, uploaded once when done.
  const mapData = new Uint8Array(MAP.nx * MAP.nz * 2);
  const mapTex = new THREE.DataTexture(mapData, MAP.nx, MAP.nz, THREE.RGFormat, THREE.UnsignedByteType);
  mapTex.magFilter = mapTex.minFilter = THREE.LinearFilter;
  mapTex.generateMipmaps = false;
  mapTex.unpackAlignment = 1;
  mapTex.needsUpdate = true;
  U.uMap.value = mapTex;
  renderer.initTexture(mapTex);
  const H = new Float32Array(MAP.nx * MAP.nz); // building heights
  const S = new Float32Array(MAP.nx * MAP.nz); // shadow heights
  const hAt = (x, z) => {
    const i = Math.floor((x - MAP.x0) / MAP.cell), k = Math.floor((z - MAP.z0) / MAP.cell);
    return i < 0 || k < 0 || i >= MAP.nx || k >= MAP.nz ? 0 : H[k * MAP.nx + i];
  };

  /* ---- the street model (shared by the ground shader, the trees and the traffic) ---- */
  const ST = city.streets;
  const fullAv = ST.avenues.filter((a) => a.to - a.from > 900), partAv = ST.avenues.filter((a) => a.to - a.from <= 900);
  const lineW = (at, axis) => { for (const a of fullAv) if (a.axis === axis && a.at === at) return a.w; return ST.width; };
  const walkW = (w) => (w <= 20 ? 3 : w <= 30 ? 4 : 5);
  // streetcar lines: the widest east-west avenue nearest the middle, and the north-south avenue west of downtown
  const tramZ = fullAv.filter((a) => a.axis === "z").sort((a, b) => Math.abs(a.at) - Math.abs(b.at))[0];
  const tramX = fullAv.filter((a) => a.axis === "x").sort((a, b) => a.at - b.at)[0];
  const lines = {
    x: ST.xs.map((at) => ({ at, w: lineW(at, "x"), tram: !!tramX && tramX.at === at, from: B.minZ, to: PROMENADE })),
    z: ST.zs.map((at) => ({ at, w: lineW(at, "z"), tram: !!tramZ && tramZ.at === at, from: B.minX, to: B.maxX })),
  };
  const partial = partAv.map((a) => ({ axis: a.axis, at: a.at, w: a.w, from: a.from, to: Math.min(a.to, a.axis === "x" ? PROMENADE : a.to), boulevard: a.w > 40 }));
  const streetTex = (() => {
    const W = 2048, d = new Float32Array(W * 2 * 4);
    for (let row = 0; row < 2; row++) {
      const L = row === 0 ? lines.x : lines.z;
      for (let i = 0; i < W; i++) {
        const c = i - 1024 + 0.5;
        let best = null, bd = Infinity;
        for (const l of L) { const dd = Math.abs(c - l.at) - l.w / 2; if (dd < bd) { bd = dd; best = l; } }
        const o = (row * W + i) * 4;
        d[o] = best.at; d[o + 1] = best.w / 2; d[o + 2] = walkW(best.w); d[o + 3] = best.tram ? 1 : 0;
      }
    }
    const t = new THREE.DataTexture(d, W, 2, THREE.RGBAFormat, THREE.FloatType);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    renderer.initTexture(t);
    return t;
  })();
  const GU = {
    uStreets: { value: streetTex },
    uAvA: { value: [0, 1, 2, 3].map((i) => { const a = partial[i]; return a ? new THREE.Vector4(a.axis === "x" ? 0 : 1, a.at, a.w / 2, walkW(a.w)) : new THREE.Vector4(0, 0, 0, 0); }) },
    uAvB: { value: [0, 1, 2, 3].map((i) => { const a = partial[i]; return a ? new THREE.Vector4(a.from, a.to, a.boulevard ? 2 : 0, 0) : new THREE.Vector4(); }) },
    uParks: { value: [0, 1, 2, 3].map((i) => { const p = city.parks[i]; return p ? new THREE.Vector4(p.minX, p.minZ, p.maxX, p.maxZ) : new THREE.Vector4(); }) },
    uPlaza: { value: [new THREE.Vector4(N0.x, N0.z, 34, 0), new THREE.Vector4(D0.x, D0.z, D0.r + 8, 0)] },
    uLand: { value: new THREE.Vector4(B.minX, B.minZ, B.maxX, city.shoreZ) },
    uDist: { value: [0, 1, 2, 3, 4, 5].map((i) => { const d = city.districts[i]; return d ? new THREE.Vector4(d.cx, d.cz, d.r, 0) : new THREE.Vector4(0, 0, 1, 0); }) },
  };
  const inPark = (x, z, m = 0) => city.parks.some((p) => x > p.minX - m && x < p.maxX + m && z > p.minZ - m && z < p.maxZ + m);

  /* ---- materials ---- */
  const mats = [];
  function mat(vs, fs, uniforms, extra = {}) {
    const m = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms, fog: false, ...extra });
    mats.push(m);
    return m;
  }
  // low: window details fade out sooner and brick courses are off, for a slower GPU
  const facadeMat = mat(FACADE_VS, FACADE_FS, pick(...COMMON_U, "uClog", "uFinale", "uCityRefl"), { defines: low ? { LOW: 1, DETAIL0: "0.1", DETAIL1: "0.3" } : { DETAIL0: "0.16", DETAIL1: "0.5" } });
  const landMat = mat(LANDMARK_VS, LANDMARK_FS, { ...pick(...COMMON_U, "uKing", "uFinale", "uCityRefl"),
    uNeedle: { value: new THREE.Vector4(N0.x, N0.z, N0.podY0, 0) }, uDome: { value: new THREE.Vector4(D0.x, D0.z, D0.r, X0.z) } });
  const groundMat = mat(GROUND_VS, GROUND_FS, { ...pick(...COMMON_U, "uClog"), ...GU });
  const waterMat = mat(GROUND_VS, WATER_FS, pick(...COMMON_U, "uWater", "uCityRefl"), { defines: { STEPS: low ? 10 : 16, STEP_GROW: low ? "1.9" : "1.5" } });
  const skyMat = mat(SKY_VS, SKY_FS, pick(...COMMON_U), { side: THREE.BackSide, depthWrite: false, defines: { OCT: low ? 3 : 4 } });
  const treeMat = mat(TREE_VS, TREE_FS, pick(...COMMON_U));
  const carMat = mat(CAR_VS, CAR_FS, { ...pick(...COMMON_U), uHalf: { value: new THREE.Vector3(2.2, 0.88, 0.62) } });
  const tramMat = mat(CAR_VS, CAR_FS, { ...pick(...COMMON_U), uHalf: { value: new THREE.Vector3(15, 1.3, 0.9) } }, { defines: { STREETCAR: 1 } });
  const propMat = mat(PROP_VS, PROP_FS, pick(...COMMON_U));
  const beaconMat = mat(BEACON_VS, BEACON_FS, pick(...COMMON_U, "uKing"));
  const farMat = mat(FAR_VS, FAR_FS, pick(...COMMON_U));

  /* ---- bookkeeping ---- */
  const info = { meshes: 0, tris: 0 };
  let staticTris = 0;
  function add(mesh, order = 0) {
    mesh.renderOrder = order;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    root.add(mesh);
    info.meshes++;
    const g = mesh.geometry;
    const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
    mesh.userData.tris = t;
    if (!g.isInstancedBufferGeometry) staticTris += t;
    return mesh;
  }
  const instTris = () => { let t = 0; for (const m of instMeshes) t += m.userData.tris * m.geometry.instanceCount; return t; };
  const instMeshes = [];

  const perch = { x: 0, y: 0, z: 0, yaw: 0 };

  /* ---------------- 1. the sky, the lake, the ground, the far ring ---------------- */
  let sky = null;
  function buildSky() {
    sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = 10; // after every opaque thing: early depth rejects the covered sky
    sky.matrixAutoUpdate = true;
    root.add(sky);
    info.meshes++; staticTris += 32 * 16 * 2;

    // the lake to the hills: it starts exactly at the quay, so it never fights the ground for depth
    const wg = new THREE.PlaneGeometry(FAR * 2, FAR - city.shoreZ + 300).rotateX(-Math.PI / 2);
    wg.translate(0, PERF.waterY, (city.shoreZ + FAR + 300) / 2);
    const water = new THREE.Mesh(wg, waterMat);
    water.frustumCulled = false;
    add(water, 3);

    // the ground to the horizon, and the granite quay wall down into the lake
    const gb = Buf({});
    const s = city.shoreZ;
    quad(gb, [[-FAR, 0, -FAR], [-FAR, 0, s], [FAR, 0, s], [FAR, 0, -FAR]], [0, 1, 0], {});
    quad(gb, [[-FAR, -1.4, s], [FAR, -1.4, s], [FAR, 0, s], [-FAR, 0, s]], [0, 0, 1], {});
    const ground = new THREE.Mesh(finish(gb), groundMat);
    ground.frustumCulled = false;
    add(ground, 2);
  }
  // the far skyline: towers on a ring inland; the hills round the whole lake behind them
  const fb = Buf({ aKind: 1 }, 8192), farRng = rng(4242);
  function buildFar(part) {
    const r = farRng;
    for (let i = part * 90; i < (part + 1) * 90 && part < 6; i++) {
      const a = r() * Math.PI * 2, R = lerp(RING.r0, RING.r1, Math.pow(r(), 0.8));
      const x = RING.x + Math.cos(a) * R, z = RING.z + Math.sin(a) * R;
      if (z > city.shoreZ - 40) continue;
      // taller clusters to the north (an uptown far away) and on the shore to the east and west
      const cl = Math.max(Math.pow(Math.max(0, -Math.sin(a)), 6), 0.4 * Math.pow(Math.abs(Math.cos(a)), 12));
      const h = 12 + 50 * Math.pow(r(), 2.2) + 130 * cl * Math.pow(r(), 1.5);
      const w = 18 + 40 * r(), d = 18 + 40 * r();
      boxQuads(fb, x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, { aKind: [0] });
    }
    if (part < 6) return;
    const hr = rng(99), SEG = 180;
    const hh = [];
    for (let j = 0; j <= SEG; j++) {
      const a = (j / SEG) * Math.PI * 2, z = RING.z + Math.sin(a) * RING.hills;
      const lake = z > city.shoreZ ? 1 : 0;
      hh.push((lake ? 22 : 38) + (lake ? 26 : 55) * (0.5 + 0.5 * Math.sin(a * 5 + 1.3)) * (0.6 + 0.4 * hr()) + 14 * hr());
    }
    hh[SEG] = hh[0];
    for (let j = 0; j < SEG; j++) {
      const a0 = (j / SEG) * Math.PI * 2, a1 = ((j + 1) / SEG) * Math.PI * 2, R = RING.hills;
      const p0 = [RING.x + Math.cos(a0) * R, RING.z + Math.sin(a0) * R], p1 = [RING.x + Math.cos(a1) * R, RING.z + Math.sin(a1) * R];
      const nx = -Math.cos((a0 + a1) / 2), nz = -Math.sin((a0 + a1) / 2);
      // inward-facing: CCW seen from the middle
      quad(fb, [[p0[0], -2, p0[1]], [p1[0], -2, p1[1]], [p1[0], hh[j + 1], p1[1]], [p0[0], hh[j], p0[1]]], [nx, 0.3, nz], { aKind: [1] });
    }
    const far = new THREE.Mesh(finish(fb), farMat);
    far.frustumCulled = false;
    add(far, 4);
  }

  /* ---------------- 2. the height map ---------------- */
  function buildHeights(part) {
    const put = (x0, z0, x1, z1, h) => {
      const i0 = Math.max(0, Math.ceil((x0 - MAP.x0) / MAP.cell - 0.5)), i1 = Math.min(MAP.nx - 1, Math.floor((x1 - MAP.x0) / MAP.cell - 0.5));
      const k0 = Math.max(0, Math.ceil((z0 - MAP.z0) / MAP.cell - 0.5)), k1 = Math.min(MAP.nz - 1, Math.floor((z1 - MAP.z0) / MAP.cell - 0.5));
      for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) { const o = k * MAP.nx + i; if (h > H[o]) H[o] = h; }
    };
    const n = city.buildings.length, half = Math.floor(n / 2);
    for (let i = part === 0 ? 0 : half; i < (part === 0 ? half : n); i++) for (const t of city.buildings[i].tiers) put(t.minX, t.minZ, t.maxX, t.maxZ, t.y1);
    if (part === 0) return;
    const disc = (cx, cz, r, hf) => {
      const i0 = Math.max(0, Math.floor((cx - r - MAP.x0) / MAP.cell)), i1 = Math.min(MAP.nx - 1, Math.ceil((cx + r - MAP.x0) / MAP.cell));
      const k0 = Math.max(0, Math.floor((cz - r - MAP.z0) / MAP.cell)), k1 = Math.min(MAP.nz - 1, Math.ceil((cz + r - MAP.z0) / MAP.cell));
      for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
        const x = MAP.x0 + (i + 0.5) * MAP.cell, z = MAP.z0 + (k + 0.5) * MAP.cell, d = Math.hypot(x - cx, z - cz);
        if (d <= r) { const o = k * MAP.nx + i; H[o] = Math.max(H[o], hf(d)); }
      }
    };
    // the Needle's shaft (its pod overhangs, so only the shaft is solid), the Dome, the expressway deck
    disc(N0.x, N0.z, N0.shaftR + 1, () => 322);
    disc(D0.x, D0.z, D0.r, (d) => D0.h * Math.sqrt(Math.max(0, 1 - (d / D0.r) ** 2)));
    put(-XWAY_EXT, X0.z - X0.w / 2, XWAY_EXT, X0.z + X0.w / 2, X0.y);
  }

  /* ---------------- 3. long shadows: a sweep from the sun side ---------------- */
  // S(p) = max(H(p1), S(p1)) − ds·tan, with p1 one row toward the sun. Rows are done from the sun side first,
  // so p1 is always ready. It costs a few lookups per cell and gives shadows from every tower, any length.
  const sdx = SUN_DIR.x / sunLen, sdz = SUN_DIR.z / sunLen;
  const rowStep = sdz >= 0 ? -1 : 1, rowFirst = sdz >= 0 ? MAP.nz - 1 : 0;
  const ox = sdx / Math.abs(sdz), ds = MAP.cell / Math.abs(sdz), drop = ds * SHADOW_TAN;
  let shadowRow = rowFirst;
  const fo = Math.floor(ox), ft = ox - fo;
  // Rows up to the end of slice `slice`. It stops early once 2 ms have gone by (then it returns false and the build
  // calls it again); under a stopped test clock the slice size alone bounds it.
  let shadowDone = 0;
  function buildShadowRows(slice, per) {
    const nx = MAP.nx, t0 = performance.now(), want = Math.min(MAP.nz, (slice + 1) * per);
    for (let r = 0; shadowDone < want && (r < 4 || performance.now() - t0 < 2); r++, shadowDone++, shadowRow += rowStep) {
      const k = shadowRow, kp = k - rowStep, row = k * nx;
      if (kp < 0 || kp >= MAP.nz) { S.fill(0, row, row + nx); continue; }
      const prow = kp * nx;
      for (let i = 0; i < nx; i++) {
        const i0 = i + fo, i1 = i0 + 1;
        const h0 = i0 >= 0 && i0 < nx ? Math.max(H[prow + i0], S[prow + i0]) : 0;
        const h1 = i1 >= 0 && i1 < nx ? Math.max(H[prow + i1], S[prow + i1]) : 0;
        const s = h0 + (h1 - h0) * ft - drop;
        S[row + i] = s > 0 ? s : 0;
      }
    }
    return shadowDone >= want;
  }
  // the map goes to the GPU once, when every row is done
  // A 1-2-1 blur softens the shadow edges first (without it a shadow line on a wall steps with the 4 m cells). It
  // mixes open cells with open cells only, so no building's own shadow height leaks onto its sunlit walls.
  const Sblur = new Float32Array(S.length);
  // parts 0-3: across the rows, quarters of the map; parts 4-7: along the columns, straight into the texture
  function packMap(part) {
    const nx = MAP.nx, nz = MAP.nz, h = Math.ceil(nz / 4), k0 = (part % 4) * h, k1 = Math.min(nz, k0 + h);
    if (part < 4) {
      for (let k = k0; k < k1; k++) {
        const row = k * nx;
        for (let i = 0; i < nx; i++) {
          const o = row + i;
          if (H[o] >= 0.5) { Sblur[o] = S[o]; continue; }
          let sum = 2 * S[o], w = 2;
          if (i > 0 && H[o - 1] < 0.5) { sum += S[o - 1]; w++; }
          if (i < nx - 1 && H[o + 1] < 0.5) { sum += S[o + 1]; w++; }
          Sblur[o] = sum / w;
        }
      }
      return;
    }
    for (let k = k0; k < k1; k++) {
      const row = k * nx;
      for (let i = 0; i < nx; i++) {
        const o = row + i;
        let v = Sblur[o];
        if (H[o] < 0.5) {
          let sum = 2 * v, w = 2;
          if (k > 0 && H[o - nx] < 0.5) { sum += Sblur[o - nx]; w++; }
          if (k < nz - 1 && H[o + nx] < 0.5) { sum += Sblur[o + nx]; w++; }
          v = sum / w;
        }
        mapData[o * 2] = Math.min(255, Math.round(v / 2)); mapData[o * 2 + 1] = Math.min(255, Math.ceil(H[o] / 2));
      }
    }
    if (part === 7) mapTex.needsUpdate = true;
  }

  /* ---------------- 4. the Needle, the Dome, the expressway ---------------- */
  const beacons = [];
  const lb = Buf({ aKind: 1 }, 16384);
  // the King's perch: a gold plinth on the pod roof, on the side that faces the start (known before the build)
  const perchR = 9.5, perchA = Math.atan2(S0.z - N0.z, S0.x - N0.x);
  perch.x = N0.x + Math.cos(perchA) * perchR; perch.z = N0.z + Math.sin(perchA) * perchR; perch.y = N0.podY1 + 1.1;
  perch.yaw = Math.atan2(-(S0.x - perch.x), -(S0.z - perch.z));
  function buildNeedle(part) {
    const b = lb;
    const N = N0, R = N.shaftR;
    if (part === 2) { needleLegs(b, N, R); return; }
    const dr = N.deck.r, dy = N.deck.y;
    if (part === 1) { needlePod(b, N, dr, dy); return; }
    // the shaft: a flared foot, then straight at the collider radius
    const prof = [];
    for (let i = 0; i <= 6; i++) { const y = (i / 6) * 45; prof.push([R + 3.2 * (1 - y / 45) ** 2, y, 10]); }
    prof.push([R, N.collars[0].y - 0.75, 10]);
    lathe(b, prof, 32, N.x, N.z);
    let y0 = N.collars[0].y + 0.75;
    for (let c = 0; c < N.collars.length; c++) {
      const C = N.collars[c], cy = C.y;
      // a collar: a ring of metal with lights on its rim
      lathe(b, [[R - 0.1, cy - 0.75, 13], [C.r, cy - 0.75, 13], [C.r, cy + 0.75, 13], [R - 0.1, cy + 0.75, 13]], 32, N.x, N.z);
      const next = N.collars[c + 1] ? N.collars[c + 1].y - 0.75 : N.deck.y - 1.8;
      lathe(b, [[R, cy + 0.75, 10], [R, next, 10]], 32, N.x, N.z);
      y0 = next;
    }
    // the deck under the pod, with a rail round it
    lathe(b, [[R, y0, 13], [dr - 2, dy - 1, 13], [dr, dy - 1, 13], [dr, dy, 13], [dr - 0.35, dy, 13]], 40, N.x, N.z);
    lathe(b, [[dr - 0.3, dy, 20], [dr - 0.3, dy + 1.1, 20], [dr - 0.45, dy + 1.1, 20], [dr - 0.45, dy, 20]], 40, N.x, N.z);
  }
  // the pod: a wall, the window band, a sloped top, the roof the King sits on; the antenna; the perch
  function needlePod(b, N, dr, dy) {
    const pr = N.podR, p0 = N.podY0, p1 = N.podY1;
    lathe(b, [[dr - 0.35, dy, 11], [pr, p0 + 0.2, 11], [pr + 0.3, p0 + 3, 11], [pr + 0.3, p0 + 7, 12], [pr + 0.3, p0 + 17, 11], [pr + 0.3, p1 - 2.5, 11], [pr - 1, p1, 11], [4, p1, 11], [3.4, p1 + 0.6, 14]], 48, N.x, N.z);
    // the antenna: a mast to 322, a thin spike to the top
    lathe(b, [[3.4, p1 + 0.6, 14], [3.2, 322, 14], [1.5, 322.4, 14], [1.4, N.top - 2, 14], [0.25, N.top, 14]], 16, N.x, N.z);
    lathe(b, [[5.2, p1, 21], [5.2, p1 + 0.6, 21], [4.6, p1 + 1.1, 21], [0, p1 + 1.1, 21]], 24, perch.x, perch.z);
    for (const y of [300, 322.6, 341, N.top + 0.3]) beacons.push([N.x, y, N.z, 1.4]);
  }
  // three flat legs at the foot of the shaft, in the Needle's own style
  function needleLegs(b, N, R) {
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * Math.PI * 2 + 0.3, ca = Math.cos(a), sa = Math.sin(a), th = 0.8;
      const px = -sa * th, pz = ca * th; // across the leg
      const P = (r, y, side) => [N.x + ca * r + px * side, y, N.z + sa * r + pz * side];
      const top = 150, rOut = (y) => R + 4.5 * Math.pow(1 - y / top, 1.3);
      const steps = 6;
      for (let s = 0; s < steps; s++) {
        const ya = (s / steps) * top, yb = ((s + 1) / steps) * top, ra = rOut(ya), rb = rOut(yb);
        const nOut = [ca, (ra - rb) / (yb - ya), sa], l = Math.hypot(...nOut);
        quad(b, [P(ra, ya, 1), P(ra, ya, -1), P(rb, yb, -1), P(rb, yb, 1)], nOut.map((v) => v / l), { aKind: [10] });
        quad(b, [P(R - 0.5, ya, 1), P(ra, ya, 1), P(rb, yb, 1), P(R - 0.5, yb, 1)], [-sa, 0, ca], { aKind: [10] });
        quad(b, [P(ra, ya, -1), P(R - 0.5, ya, -1), P(R - 0.5, yb, -1), P(rb, yb, -1)], [sa, 0, -ca], { aKind: [10] });
      }
    }
  }
  // the Dome: a ribbed half-shell, arches round its foot
  function buildDome() {
    const dp = [];
    const DS = 18;
    for (let i = 0; i <= DS; i++) {
      const th = (i / DS) * Math.PI / 2, y = D0.h * Math.sin(th);
      dp.push([Math.max(0.01, D0.r * Math.cos(th)), y, y < 7.5 ? 17 : 16]);
    }
    lathe(lb, dp, 64, D0.x, D0.z);
  }
  // the expressway: a deck on piers every 40 m, jersey barriers, on past the land into the haze
  function buildXway(part) {
    const b = lb;
    const X = X0, z0 = X.z - X.w / 2, z1 = X.z + X.w / 2, yb = X.y - 1.5, yt = X.y;
    const e = { aKind: [19] };
    if (part === 1) {
      for (let x = X.x0 + 20 - Math.ceil((XWAY_EXT + X.x0) / 40) * 40; x < XWAY_EXT; x += 40) {
        boxQuads(b, x - 1.5, 0, X.z - 5, x + 1.5, yb, X.z + 5, e);
        boxQuads(b, x - 1.8, yb - 1.4, z0 + 2, x + 1.8, yb, z1 - 2, e, true);
      }
      return;
    }
    if (part === 2) {
      const m = new THREE.Mesh(finish(b), landMat);
      m.frustumCulled = false;
      add(m, 0);
      return;
    }
    quad(b, [[-XWAY_EXT, yt, z0], [-XWAY_EXT, yt, z1], [XWAY_EXT, yt, z1], [XWAY_EXT, yt, z0]], [0, 1, 0], { aKind: [18] });
    quad(b, [[-XWAY_EXT, yb, z1], [XWAY_EXT, yb, z1], [XWAY_EXT, yt, z1], [-XWAY_EXT, yt, z1]], [0, 0, 1], e);
    quad(b, [[XWAY_EXT, yb, z0], [-XWAY_EXT, yb, z0], [-XWAY_EXT, yt, z0], [XWAY_EXT, yt, z0]], [0, 0, -1], e);
    quad(b, [[-XWAY_EXT, yb, z0], [XWAY_EXT, yb, z0], [XWAY_EXT, yb, z1], [-XWAY_EXT, yb, z1]], [0, -1, 0], e);
    for (const zz of [z0, z1 - 0.5]) boxQuads(b, -XWAY_EXT, yt, zz, XWAY_EXT, yt + 0.9, zz + 0.5, { aKind: [20] });
  }

  /* ---------------- 5. chunks of buildings, with their props and trees ---------------- */
  const nxC = Math.ceil((B.maxX - B.minX) / CHUNK), nzC = Math.ceil((city.shoreZ - B.minZ) / CHUNK);
  const chunkList = [];
  for (let k = 0; k < nzC; k++) for (let i = 0; i < nxC; i++) chunkList.push({ i, k, x0: B.minX + i * CHUNK, z0: B.minZ + k * CHUNK, buildings: [], trees: [], lamps: [], mesh: null });
  const chunkOf = (x, z) => chunkList[clamp(Math.floor((z - B.minZ) / CHUNK), 0, nzC - 1) * nxC + clamp(Math.floor((x - B.minX) / CHUNK), 0, nxC - 1)];
  for (const b of city.buildings) chunkOf(b.x, b.z).buildings.push(b);
  // start view first: the chunks in front of the start roof, near to far, then the rest by distance
  const fwd = [-Math.sin(S0.yaw), -Math.cos(S0.yaw)];
  for (const c of chunkList) {
    const cx = c.x0 + CHUNK / 2, cz = c.z0 + CHUNK / 2, dx = cx - S0.x, dz = cz - S0.z, d = Math.hypot(dx, dz);
    const inView = d < CHUNK || (dx * fwd[0] + dz * fwd[1]) / d > Math.cos((70 * Math.PI) / 180);
    c.start = inView && d < 520;
    c.order = d * (inView ? 1 : 2.5);
  }
  const chunksSorted = chunkList.filter((c) => c.buildings.length).sort((a, b) => a.order - b.order);

  // spots where nothing may stand on a roof: the start, clogs, safe spots, roof Loonies, trial pads
  const keepOut = [[S0.x, S0.y, S0.z, 6.5]];
  for (const c of city.clogs) keepOut.push([c.x, c.y, c.z, 7]);
  for (const s of city.safe) keepOut.push([s.x, s.y, s.z, 4]);
  for (const l of city.loonies) keepOut.push([l.x, l.y - 1.7, l.z, 3]);
  for (const t of city.trials) if (t.start) keepOut.push([t.start.x, t.start.y, t.start.z, 7]);
  const blocked = (x, y, z, r) => keepOut.some((k) => Math.abs(k[1] - y) < 4 && Math.hypot(k[0] - x, k[2] - z) < k[3] + r);

  // The four sides of a tier: outward normal, the plane's coordinate, and the span along the face.
  const SIDES = [
    { nx: -1, nz: 0, fix: (t) => t.minX, a0: (t) => t.minZ, a1: (t) => t.maxZ },
    { nx: 1, nz: 0, fix: (t) => t.maxX, a0: (t) => t.minZ, a1: (t) => t.maxZ },
    { nx: 0, nz: -1, fix: (t) => t.minZ, a0: (t) => t.minX, a1: (t) => t.maxX },
    { nx: 0, nz: 1, fix: (t) => t.maxZ, a0: (t) => t.minX, a1: (t) => t.maxX },
  ];
  // Per-building numbers for the shader: kind code (+8 with shops on the street floor), seed, floor height, bay.
  function buildingInfo(b) {
    const k = KIND[b.kind] ?? 4, r = rng(b.seed + 1);
    const fh = [lerp(3.7, 4.2, r()), 4.2, lerp(3.3, 3.8, r()), lerp(3.9, 4.5, r()), lerp(3.5, 3.9, r()), lerp(4.5, 5.2, r())][k];
    const bay = [lerp(1.5, 1.9, r()), 1.7, lerp(2.6, 3.2, r()), lerp(2.4, 3.0, r()), lerp(1.7, 2.2, r()), lerp(3.6, 4.4, r())][k];
    const shopP = [0.5, 0, 0.9, 0.9, 0.9, 0.6][b.district] ?? 0.6;
    const shop = k >= 2 && r() < shopP;
    const condo = k === 0 && b.district === 0;
    return [k + (shop ? 8 : 0) + (condo ? 16 : 0), (b.seed % 100003) / 100003, fh, bay];
  }
  // Walls, parapets and roofs of one building into a chunk buffer.
  function addBuilding(buf, b) {
    const inf = buildingInfo(b), dist = b.district;
    const T = b.tiers, r = rng(b.seed + 7);
    const salts = [Math.floor(r() * 50), Math.floor(r() * 50), Math.floor(r() * 50), Math.floor(r() * 50)];
    // a horizontal quad (x0, z0)–(x1, z1) at y: parapet tops (w < 0) or a roof (roof = true: per-corner x, z)
    const flat = (x0, z0, x1, z1, y, a, bb, w, d, roof = false) => {
      reserve(buf, 4);
      const v = buf.v;
      vtx(buf, x0, y, z0, 0, 1, 0); vtx(buf, x0, y, z1, 0, 1, 0); vtx(buf, x1, y, z1, 0, 1, 0); vtx(buf, x1, y, z0, 0, 1, 0);
      for (let j = 0; j < 4; j++) {
        av(buf, "aInfo", v + j, inf[0], inf[1], inf[2], inf[3]);
        if (roof) av(buf, "aFace", v + j, j < 2 ? 0 : x1 - x0, j === 0 || j === 3 ? 0 : z1 - z0, w, d); else av(buf, "aFace", v + j, a, bb, w, d);
        buf.x.aDist.a[v + j] = dist;
      }
      quadIdx(buf, v);
    };
    for (let ti = 0; ti < T.length; ti++) {
      const t = T[ti], next = T[ti + 1], top = t.y1, isTop = !next;
      const ph = isTop ? (inf[0] % 8 <= 1 ? 1.2 : PARAPET) : 1.0, th = PARAPET_T;
      const crown = isTop && ti > 0 && t.y1 - t.y0 < 12 && (inf[0] % 8) <= 1;
      SIDES.forEach((sd, si) => {
        const fix = sd.fix(t), a0 = sd.a0(t), a1 = sd.a1(t);
        // the window grid follows the lowest tier this face is flush with, so windows line up up the whole tower
        let ref = t;
        for (let j = ti - 1; j >= 0 && sd.fix(T[j]) === sd.fix(ref); j--) ref = T[j];
        const r0 = sd.a0(ref), r1 = sd.a1(ref);
        const salt = salts[si] + (crown ? 60 : 0);
        const fw = r1 - r0;
        const wall = (lo, hi, y0, y1, n, fixAt) => {
          // u runs along T = (nz, 0, −nx); the quad starts where T points from, so it winds CCW seen from outside
          const nx = n[0], nz = n[2], tpos = nz !== 0 ? nz > 0 : nx < 0;
          const s = tpos ? lo : hi, e = tpos ? hi : lo, us = tpos ? s - r0 : r1 - s, ue = tpos ? e - r0 : r1 - e;
          reserve(buf, 4);
          const v = buf.v;
          if (nx !== 0) { vtx(buf, fixAt, y0, s, nx, 0, 0); vtx(buf, fixAt, y0, e, nx, 0, 0); vtx(buf, fixAt, y1, e, nx, 0, 0); vtx(buf, fixAt, y1, s, nx, 0, 0); }
          else { vtx(buf, s, y0, fixAt, 0, 0, nz); vtx(buf, e, y0, fixAt, 0, 0, nz); vtx(buf, e, y1, fixAt, 0, 0, nz); vtx(buf, s, y1, fixAt, 0, 0, nz); }
          for (let j = 0; j < 4; j++) {
            av(buf, "aInfo", v + j, inf[0], inf[1], inf[2], inf[3]);
            av(buf, "aFace", v + j, j === 0 || j === 3 ? us : ue, fw, salt, top);
            buf.x.aDist.a[v + j] = dist;
          }
          quadIdx(buf, v);
        };
        const out = [sd.nx, 0, sd.nz];
        wall(a0, a1, t.y0, t.y1, out, fix);
        // parapet: the parts of this edge the next tier does not stand flush on
        let spans = [[a0, a1]];
        if (next && sd.fix(next) === fix) {
          const c0 = sd.a0(next), c1 = sd.a1(next);
          spans = [[a0, c0], [c1, a1]].filter(([p, q]) => q - p > 0.05);
        }
        const ew = sd.nx !== 0; // east and west strips stop short of the corners
        for (const [p, q] of spans) {
          wall(p, q, t.y1, t.y1 + ph, out, fix);
          const lo = Math.max(p, a0 + th), hi = Math.min(q, a1 - th);
          const inFix = fix - sd.nx * th - sd.nz * th;
          if (hi > lo) wall(lo, hi, t.y1, t.y1 + ph, [-sd.nx, 0, -sd.nz], inFix);
          const sl = ew ? lo : p, sh = ew ? hi : q;
          if (sh > sl) {
            const f0 = Math.min(fix, inFix), f1 = Math.max(fix, inFix), yy = t.y1 + ph;
            if (sd.nx !== 0) flat(f0, sl, f1, sh, yy, 0, 0, 0, -1);
            else flat(sl, f0, sh, f1, yy, 0, 0, 0, -1);
          }
        }
      });
      // the roof: its own x, z and size go to the shader for the edge shade and the membrane seams
      flat(t.minX, t.minZ, t.maxX, t.maxZ, top, 0, 0, t.maxX - t.minX, t.maxZ - t.minZ, true);
    }
  }

  /* ---- roof props ---- */
  const PROP_TYPES = ["box", "tower", "mast", "garden", "lamp"];
  const PROP_MAX = { box: 6000, tower: 500, mast: 900, garden: 1400, lamp: 2400 };
  const props = {};
  const BEACON_MAX = 900;
  let beaconMesh = null;
  function propGeometry(type) {
    const b = Buf({ aPart: 1, aCol: 3 });
    const M = new THREE.Matrix4();
    const white = () => [1, 1, 1];
    if (type === "box") {
      addGeo(b, new THREE.BoxGeometry(1, 1, 1), M.makeTranslation(0, 0.5, 0), 2, { aCol: () => [0.48, 0.47, 0.46] });
    } else if (type === "tower") {
      for (const [x, z] of [[-0.62, -0.62], [0.62, -0.62], [0.62, 0.62], [-0.62, 0.62]]) addGeo(b, new THREE.BoxGeometry(0.12, 1.5, 0.12), M.makeTranslation(x, 0.75, z), 5, { aCol: () => [0.25, 0.24, 0.24] });
      addGeo(b, new THREE.CylinderGeometry(1.05, 1.05, 0.08, 8), M.makeTranslation(0, 1.52, 0), 5, { aCol: () => [0.3, 0.28, 0.26] });
      addGeo(b, new THREE.CylinderGeometry(1, 1, 1.7, 10, 1, true), M.makeTranslation(0, 2.41, 0), 3, { aCol: white });
      addGeo(b, new THREE.ConeGeometry(1.08, 0.7, 10), M.makeTranslation(0, 3.6, 0), 0, { aCol: () => [0.24, 0.2, 0.18] });
    } else if (type === "mast") {
      addGeo(b, new THREE.CylinderGeometry(0.03, 0.08, 1, 4, 1, true), M.makeTranslation(0, 0.5, 0), 5, { aCol: () => [0.55, 0.55, 0.57] });
      addGeo(b, new THREE.BoxGeometry(0.22, 0.03, 0.22), M.makeTranslation(0, 0.3, 0), 5, { aCol: () => [0.5, 0.5, 0.52] });
    } else if (type === "lamp") {
      // a street lamp: a pole, an arm over the road, a head that glows
      const dark = () => [0.2, 0.21, 0.22];
      addGeo(b, new THREE.CylinderGeometry(0.06, 0.09, 6.6, 6, 1, true), M.makeTranslation(0, 3.3, 0), 7, { aCol: dark });
      addGeo(b, new THREE.BoxGeometry(1.5, 0.08, 0.08), M.makeTranslation(0.72, 6.55, 0), 7, { aCol: dark });
      addGeo(b, new THREE.BoxGeometry(0.62, 0.16, 0.3), M.makeTranslation(1.4, 6.5, 0), 6, { aCol: dark });
    } else {
      addGeo(b, new THREE.BoxGeometry(1, 0.45, 1), M.makeTranslation(0, 0.225, 0), 0, { aCol: () => [0.42, 0.34, 0.28] });
      for (const [x, z, s] of [[-0.22, -0.2, 0.36], [0.24, 0.1, 0.32], [-0.05, 0.28, 0.26]]) {
        const g = new THREE.IcosahedronGeometry(1, 0);
        addGeo(b, g, M.compose(new THREE.Vector3(x, 0.55, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.9, s)), 4, { aCol: white });
      }
    }
    return finish(b);
  }
  function instancedMesh(base, attrs, max, material, order = 0) {
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a);
    const arrays = {};
    for (const [k, size] of Object.entries(attrs)) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(max * size), size);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(k, a);
      arrays[k] = a;
    }
    g.instanceCount = 0;
    const m = new THREE.Mesh(g, material);
    m.frustumCulled = false;
    m.visible = false;
    add(m, order);
    instMeshes.push(m);
    return { mesh: m, geo: g, attrs: arrays, n: 0, sent: 0, max };
  }
  function push(I, vals) {
    if (I.n >= I.max) return false;
    for (const k in vals) I.attrs[k].array.set(vals[k], I.n * I.attrs[k].itemSize);
    I.n++;
    return true;
  }
  // the next free instance slot, or -1; put() writes one attribute of it
  const slot = (I) => (I.n < I.max ? I.n++ : -1);
  function put(I, name, i, a, b, c, d) {
    const at = I.attrs[name], o = i * at.itemSize, arr = at.array;
    arr[o] = a; arr[o + 1] = b; arr[o + 2] = c; if (at.itemSize > 3) arr[o + 3] = d;
  }
  // only the new instances go to the GPU
  function flush(I) {
    I.geo.instanceCount = I.n;
    I.mesh.visible = I.n > 0;
    if (I.n === I.sent) return;
    const lo = Math.min(I.sent, I.n);
    for (const a of Object.values(I.attrs)) { a.addUpdateRange(lo * a.itemSize, (I.n - lo) * a.itemSize); a.needsUpdate = true; }
    I.sent = I.n;
  }
  function makeProps(t) { props[t] = instancedMesh(propGeometry(t), { aP: 4, aS: 4 }, PROP_MAX[t], propMat); }
  function makeBeacons() { beaconMesh = instancedMesh(new THREE.OctahedronGeometry(1, 0), { aB: 4 }, BEACON_MAX, beaconMat, 1); }
  // Props on one building's roofs, placed away from the edges, from each other and from every keep-out spot.
  function addProps(b) {
    const r = rng(b.seed + 31), T = b.tiers, t = T[T.length - 1], y = t.y1, k = KIND[b.kind] ?? 4;
    const w = t.maxX - t.minX, d = t.maxZ - t.minZ;
    if (w < 8 || d < 8) return;
    const placed = [];
    const spot = (rad) => {
      for (let tries = 0; tries < 8; tries++) {
        const x = lerp(t.minX + 1.4 + rad, t.maxX - 1.4 - rad, r()), z = lerp(t.minZ + 1.4 + rad, t.maxZ - 1.4 - rad, r());
        if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < p[2] + rad + 0.8)) continue;
        if (blocked(x, y, z, rad)) continue;
        placed.push([x, z, rad]);
        return [x, z];
      }
      return null;
    };
    const turn = () => (Math.floor(r() * 4) * Math.PI) / 2;
    const tall = b.roofY > 60;
    // a plant room or stair head on most roofs
    if (b.roofY > 16 && r() < 0.8) {
      const sx = lerp(3, Math.min(8, w * 0.35), r()), sz = lerp(3, Math.min(7, d * 0.35), r()), sy = lerp(2.6, tall ? 5 : 3.4, r());
      const s = spot(Math.hypot(sx, sz) / 2);
      if (s) push(props.box, { aP: [s[0], y, s[1], 0], aS: [sx, sy, sz, r()] });
    }
    // air conditioners
    const nAC = Math.floor(lerp(1, Math.min(4, (w * d) / 120), r()));
    for (let i = 0; i < nAC; i++) {
      const s = spot(1.1);
      if (s) push(props.box, { aP: [s[0], y, s[1], turn()], aS: [lerp(1.4, 2.2, r()), lerp(0.9, 1.4, r()), lerp(1.1, 1.6, r()), 0.4 + 0.6 * r()] });
    }
    // wooden water towers on the older roofs
    if ((k === 2 || k === 5 || k === 3) && b.roofY < 100 && w * d > 180 && r() < 0.55) {
      const s = spot(2.4);
      const sr = lerp(1.9, 2.5, r());
      if (s) push(props.tower, { aP: [s[0], y, s[1], r() * 6.28], aS: [sr, lerp(2.4, 3.2, r()), sr, r()] });
    }
    // masts with red lights on the tall ones
    if (tall) {
      const n = 1 + Math.floor(r() * (b.roofY > 150 ? 3 : 2));
      for (let i = 0; i < n; i++) {
        const s = spot(0.6);
        if (!s) continue;
        const h = lerp(6, b.roofY > 180 ? 26 : 14, r());
        push(props.mast, { aP: [s[0], y, s[1], r() * 6.28], aS: [lerp(1, 2.2, r()), h, lerp(1, 2.2, r()), r()] });
        if (i === 0 && b.roofY > 150 && beacons.length < BEACON_MAX) beacons.push([s[0], y + h + 0.15, s[1], 0.35]);
      }
    }
    // roof gardens, and gardens on the setback terraces
    if ((b.district === 0 || b.district === 4 || b.district === 3) && r() < 0.35) {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const s = spot(1.8);
        if (s) push(props.garden, { aP: [s[0], y, s[1], turn()], aS: [lerp(2.4, 4, r()), lerp(0.8, 1.2, r()), lerp(1.4, 2.4, r()), r()] });
      }
    }
    for (let ti = 0; ti < T.length - 1; ti++) {
      const lo = T[ti], up = T[ti + 1];
      const ring = [[lo.minX + 2, lo.minZ + 2, up.minX - 1, lo.maxZ - 2], [up.maxX + 1, lo.minZ + 2, lo.maxX - 2, lo.maxZ - 2]];
      for (const [x0, z0, x1, z1] of ring) {
        if (x1 - x0 < 3 || z1 - z0 < 3 || r() > 0.6) continue;
        const gx = (x0 + x1) / 2, gz = (z0 + z1) / 2;
        if (!blocked(gx, lo.y1, gz, 2)) push(props.garden, { aP: [gx, lo.y1, gz, 0], aS: [Math.min(x1 - x0, 3.5), 1, Math.min(z1 - z0 - 1, 8), r()] });
      }
    }
  }

  /* ---- trees ---- */
  const AUTUMN = [[0.93, 0.46, 0.1, 5], [0.8, 0.2, 0.08, 3], [0.96, 0.74, 0.18, 4], [0.84, 0.58, 0.14, 3], [0.6, 0.28, 0.1, 2], [0.36, 0.48, 0.16, 2], [0.56, 0.54, 0.18, 1.5]];
  const autumnW = AUTUMN.reduce((s, c) => s + c[3], 0);
  let trees = null;
  function treeGeometry() {
    const b = Buf({ aPart: 1 });
    const M = new THREE.Matrix4();
    addGeo(b, new THREE.CylinderGeometry(0.1, 0.17, 3.0, 5, 1, true), M.makeTranslation(0, 1.5, 0), 0);
    const lobe = (cx, cy, cz, rx, ry, detail) => {
      const g = new THREE.IcosahedronGeometry(1, detail);
      const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        // a lumpy crown: shared corners move together, so the surface stays closed
        const j = 0.82 + 0.3 * (((Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1 + 1) % 1);
        p.setXYZ(i, cx + x * rx * j, cy + y * ry * j, cz + z * rx * j);
        n.setXYZ(i, x, y * 0.8 + 0.2, z);
      }
      addGeo(b, g, M.identity(), 1, {}, true);
    };
    lobe(0, 3.9, 0, 2.0, 1.75, 1);
    lobe(0.35, 5.4, -0.2, 1.35, 1.2, 0);
    return finish(b);
  }
  function treeColor(r) {
    let t = r() * autumnW;
    for (const c of AUTUMN) { t -= c[3]; if (t <= 0) return c; }
    return AUTUMN[0];
  }
  // Every tree spot in the city, sorted into chunks: street trees at the kerb, park groves, the plazas, the waterfront.
  const treeRng = rng(777);
  function layoutTrees(part) {
    const r = treeRng;
    const dens = [0.8, 0.3, 0.7, 0.62, 0.55, 0.28];
    const put = (x, z, s) => {
      if (hAt(x, z) > 0.5) return;
      const c = treeColor(r);
      chunkOf(x, z).trees.push(x, 0, z, s * lerp(0.85, 1.2, r()), c[0] * lerp(0.9, 1.08, r()), c[1] * lerp(0.9, 1.08, r()), c[2], r() * 6.28);
    };
    // a street lamp every 32 m or so, sides taking turns, its arm over the road
    const lamps = (axis, l, from, to) => {
      const curb = l.w / 2 - walkW(l.w) + 0.35;
      let k = 0;
      for (let s = from + 10; s < to - 6; s += 32, k++) {
        const side = k % 2 ? 1 : -1;
        const x = axis === "x" ? l.at + side * curb : s, z = axis === "x" ? s : l.at + side * curb;
        if (hAt(x, z) > 0.5 || inPark(x, z, 1)) continue;
        if (axis === "x" ? lines.z.some((q) => Math.abs(z - q.at) < q.w / 2 + 2) : lines.x.some((q) => Math.abs(x - q.at) < q.w / 2 + 2)) continue;
        if (Math.hypot(x - N0.x, z - N0.z) < 36 || Math.hypot(x - D0.x, z - D0.z) < D0.r + 9) continue;
        chunkOf(x, z).lamps.push(x, z, axis === "x" ? (side > 0 ? Math.PI : 0) : (side * Math.PI) / 2);
      }
    };
    const along = (axis, l, from, to, step) => {
      lamps(axis, l, from, to);
      const hw = l.w / 2, curb = hw - walkW(l.w) + 0.9;
      for (const side of [-1, 1]) {
        for (let s = from + r() * step; s < to; s += step * lerp(0.85, 1.2, r())) {
          const x = axis === "x" ? l.at + side * curb : s, z = axis === "x" ? s : l.at + side * curb;
          const dist = city.districtAt ? city.districtAt(x, z) : 1;
          if (r() > dens[dist]) continue;
          if (inPark(x, z, 2)) continue;
          if (axis === "x" ? lines.z.some((q) => Math.abs(z - q.at) < q.w / 2 + 3) || partial.some((q) => q.axis === "z" && Math.abs(z - q.at) < q.w / 2 + 3) : lines.x.some((q) => Math.abs(x - q.at) < q.w / 2 + 3) || partial.some((q) => q.axis === "x" && z > q.from && z < q.to && Math.abs(x - q.at) < q.w / 2 + 3)) continue;
          if (Math.hypot(x - N0.x, z - N0.z) < 36 || Math.hypot(x - D0.x, z - D0.z) < D0.r + 10) continue;
          put(x, z, l.w > 25 ? 1.1 : 0.9);
        }
        if (l.boulevard) for (let s = from + 4; s < to - 4; s += 9) if (Math.hypot(l.at - N0.x, s - N0.z) > 38) put(l.at, s, 1.05);
      }
    };
    // parts 0-3: north-south streets in quarters, 4-5: east-west streets in halves, 6: the partial avenues
    const q = (list, i, n) => list.slice(Math.floor((i * list.length) / n), Math.floor(((i + 1) * list.length) / n));
    if (part < 4) { for (const l of q(lines.x, part, 4)) along("x", l, B.minZ + 6, PROMENADE - 12, 11); return; }
    if (part < 6) { for (const l of q(lines.z, part - 4, 2)) along("z", l, B.minX + 6, B.maxX - 6, 11); return; }
    if (part === 6) { for (const a of partial) along(a.axis, a, a.from + 6, a.to - 6, a.boulevard ? 9 : 11); return; }
    // park groves round the paths
    for (const p of city.parks) {
      const cx = (p.minX + p.maxX) / 2, cz = (p.minZ + p.maxZ) / 2, hx = (p.maxX - p.minX) / 2, hz = (p.maxZ - p.minZ) / 2;
      for (let x = p.minX + 4; x < p.maxX - 3; x += 7) for (let z = p.minZ + 4; z < p.maxZ - 3; z += 7) {
        const jx = x + (r() - 0.5) * 4, jz = z + (r() - 0.5) * 4;
        const qx = (jx - cx), qz = (jz - cz) * (hx / hz);
        const nearPath = Math.abs(qx - qz) / 1.4 < 3 || Math.abs(qx + qz) / 1.4 < 3 || Math.abs(Math.hypot(jx - cx, jz - cz) - Math.min(hx, hz) * 0.55) < 3;
        if (nearPath || r() < 0.2) continue;
        put(jx, jz, lerp(1.0, 1.5, r()));
      }
    }
    // rings round the Needle and the Dome, rows along the waterfront
    for (let a = 0; a < 360; a += 20) put(N0.x + Math.cos((a * Math.PI) / 180) * 29, N0.z + Math.sin((a * Math.PI) / 180) * 29, 1.1);
    for (let a = 0; a < 360; a += 11) if (Math.sin((a * Math.PI) / 180) < 0.6) put(D0.x + Math.cos((a * Math.PI) / 180) * (D0.r + 4.5), D0.z + Math.sin((a * Math.PI) / 180) * (D0.r + 4.5), 1.05);
    for (let x = B.minX + 8; x < B.maxX - 8; x += lerp(10, 14, r())) {
      if (lines.x.some((l) => Math.abs(x - l.at) < l.w / 2 + 2)) continue;
      if (r() < 0.85) put(x, city.shoreZ - 4.5, 1.1);
    }
  }
  function makeTrees() {
    trees = instancedMesh(treeGeometry(), { aT: 4, aTc: 4 }, 4200, treeMat);
  }
  // lamps: runs of 3 numbers (x, z, turn)
  function addLamps(c) {
    const l = c.lamps, I = props.lamp;
    for (let o = 0; o < l.length; o += 3) {
      const i = slot(I);
      if (i < 0) break;
      put(I, "aP", i, l[o], 0, l[o + 1], l[o + 2]); put(I, "aS", i, 1, 1, 1, 0.5);
    }
  }
  // a chunk's trees are flat runs of 8 numbers: x, y, z, scale, r, g, b, turn
  function addTrees(c) {
    const t = c.trees;
    for (let o = 0; o < t.length; o += 8) {
      const i = slot(trees);
      if (i < 0) break;
      put(trees, "aT", i, t[o], t[o + 1], t[o + 2], t[o + 3]); put(trees, "aTc", i, t[o + 4], t[o + 5], t[o + 6], t[o + 7]);
    }
  }

  /* ---- traffic ---- */
  const CAR_COLS = [[0.9, 0.9, 0.88, 4], [0.12, 0.12, 0.13, 4], [0.6, 0.62, 0.64, 4], [0.7, 0.12, 0.1, 2], [0.14, 0.24, 0.5, 2], [0.95, 0.72, 0.1, 1.5], [0.25, 0.36, 0.3, 1], [0.8, 0.45, 0.2, 0.7]];
  let cars = null, trams = null;
  // A car: its side profile (hood, windscreen, roof, rear window, boot) pushed out across its width. The windscreen
  // and rear window are part 1 (glass); side windows and wheels are drawn by the shader.
  const CAR_PROFILE = [[-2.2, 0.05], [2.2, 0.05], [2.26, 0.62], [2.1, 0.86], [1.05, 0.98], [0.35, 1.45], [-0.95, 1.5], [-1.85, 1.02], [-2.25, 0.92], [-2.3, 0.5]];
  function carBody(b) {
    const P = CAR_PROFILE, w = 0.88, n = P.length;
    reserve(b, n * 4 + n * 6, n * 12);
    for (let i = 0; i < n; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % n], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
      const nx = dy / l, ny = -dx / l, glass = i === 4 || i === 6 ? 1 : 0;
      // CCW seen from outside: the edge's far corner at +w first
      const v = b.v;
      vtx(b, x1, y1, w, nx, ny, 0); vtx(b, x0, y0, w, nx, ny, 0); vtx(b, x0, y0, -w, nx, ny, 0); vtx(b, x1, y1, -w, nx, ny, 0);
      for (let j = 0; j < 4; j++) b.x.aPart.a[v + j] = glass;
      quadIdx(b, v);
    }
    for (const side of [1, -1]) {
      const c = vtx(b, 0, 0.75, side * w, 0, 0, side);
      b.x.aPart.a[c] = 0;
      for (let i = 0; i < n; i++) {
        const a = vtx(b, P[i][0], P[i][1], side * w, 0, 0, side), d = vtx(b, P[(i + 1) % n][0], P[(i + 1) % n][1], side * w, 0, 0, side);
        b.x.aPart.a[a] = b.x.aPart.a[d] = 0;
        if (side > 0) { b.i[b.ni++] = c; b.i[b.ni++] = a; b.i[b.ni++] = d; } else { b.i[b.ni++] = c; b.i[b.ni++] = d; b.i[b.ni++] = a; }
      }
    }
  }
  const carRng = rng(2025), colW = CAR_COLS.reduce((s, c) => s + c[3], 0);
  const carCol = () => { let t = carRng() * colW; for (const c of CAR_COLS) { t -= c[3]; if (t <= 0) return c; } return CAR_COLS[0]; };
  function trafficInit() {
    const cb = Buf({ aPart: 1 }, 64);
    const M = new THREE.Matrix4();
    carBody(cb);
    cars = instancedMesh(finish(cb), { aLane: 4, aMove: 4, aColor: 3 }, 1800, carMat);
    const tb = Buf({ aPart: 1 }, 64);
    addGeo(tb, new THREE.BoxGeometry(30, 3.2, 2.6), M.makeTranslation(0, 1.9, 0), 0);
    trams = instancedMesh(finish(tb), { aLane: 4, aMove: 4, aColor: 3 }, 40, tramMat);
  }
  function trafficLanes(part) {
    const r = carRng;
    // lanes: right-hand traffic; north-south streets carry northbound (−z) east of the centre line
    const lane = (axis, at, off, from, to, y, dirPos, tram) => {
      const len = to - from, speed = tram ? 7 : y > 1 ? lerp(19, 26, r()) : lerp(8, 13, r());
      const n = tram ? 4 : Math.max(1, Math.floor(len / lerp(80, 150, r())));
      for (let i = 0; i < n; i++) {
        const ph = ((i + r() * 0.6) / n) * len;
        const start = dirPos ? from : to;
        const heading = axis === "x" ? (dirPos ? 2 : 3) : dirPos ? 0 : 1;
        const I = tram ? trams : cars, s = slot(I);
        if (s < 0) return;
        if (axis === "x") put(I, "aLane", s, at + off, y, start, heading); else put(I, "aLane", s, start, y, at + off, heading);
        put(I, "aMove", s, len, speed, ph, 0);
        if (tram) put(I, "aColor", s, 0.78, 0.1, 0.08); else { const c = carCol(); put(I, "aColor", s, c[0], c[1], c[2]); }
      }
    };
    const street = (axis, l, from, to) => {
      const road = l.w / 2 - walkW(l.w), boul = l.w > 40;
      const n = boul ? 3 : Math.max(1, Math.floor(road / 3.5));
      for (let j = 0; j < n; j++) {
        const off = (boul ? 3 : 0) + 1.75 + 3.5 * j;
        const tram = l.tram && j === 0;
        // east of a north-south centre line runs north (−z); south of an east-west line runs east (+x)
        lane(axis, l.at, off, from, to, 0, axis === "z", tram);
        lane(axis, l.at, -off, from, to, 0, axis === "x", tram);
      }
    };
    if (part === 0) {
      // the expressway first: it is on show from the lake
      for (let j = 0; j < 3; j++) {
        const off = 1.75 + 3.5 * j;
        lane("z", X0.z, off, -XWAY_EXT, XWAY_EXT, X0.y, true, false);
        lane("z", X0.z, -off, -XWAY_EXT, XWAY_EXT, X0.y, false, false);
      }
      for (const a of partial) street(a.axis, a, a.from, a.axis === "x" ? Math.min(a.to, a.boulevard ? N0.z - 36 : a.to) : a.to);
    }
    if (part === 1) for (const l of lines.x) street("x", l, B.minZ, PROMENADE);
    if (part === 2) for (const l of lines.z) street("z", l, B.minX, B.maxX);
    flush(cars); flush(trams);
  }

  /* ---- one chunk ---- */
  const chunkGroup = [];
  // one scratch buffer serves every chunk in turn (finish() copies out of it), so the build makes little garbage
  const chunkBuf = Buf({ aInfo: 4, aFace: 4, aDist: 1 }, 8192);
  function buildChunkPart(c, part, parts) {
    const buf = chunkBuf, n = c.buildings.length;
    if (part === 0) buf.v = buf.ni = 0;
    for (let i = Math.floor((part * n) / parts); i < Math.floor(((part + 1) * n) / parts); i++) { addBuilding(buf, c.buildings[i]); addProps(c.buildings[i]); }
    if (part < parts - 1) { for (const t of PROP_TYPES) flush(props[t]); return; }
    const center = [c.x0 + CHUNK / 2, 0, c.z0 + CHUNK / 2];
    const g = finish(buf, center);
    const m = new THREE.Mesh(g, facadeMat);
    m.position.set(center[0], 0, center[2]);
    add(m, 0);
    c.mesh = m;
    chunkGroup.push(m);
    addTrees(c);
    addLamps(c);
    for (const t of PROP_TYPES) flush(props[t]);
    flush(trees);
    for (const dio of dioramas) dio.addChunk(m);
  }
  function flushBeacons() {
    for (let i = beaconMesh.n; i < beacons.length; i++) push(beaconMesh, { aB: beacons[i] });
    flush(beaconMesh);
  }

  /* ---------------- the build queue ---------------- */
  const units = [];
  const unit = (name, weight, fn, start = false) => units.push({ name, weight, fn, start });
  unit("sky", 1, buildSky, true);
  for (const t of PROP_TYPES) unit("props", 0.4, () => makeProps(t), true);
  unit("props", 0.5, makeBeacons, true);
  unit("trees", 1, makeTrees, true);
  for (let i = 0; i < 2; i++) unit("heights", 1, () => buildHeights(i), true);
  const SLICE = 36;
  for (let i = 0; i < Math.ceil(MAP.nz / SLICE); i++) unit("shadow", 0.4, () => buildShadowRows(i, SLICE), true);
  for (let i = 0; i < 8; i++) unit("pack", 0.1, () => packMap(i), true);
  for (let i = 0; i < 8; i++) unit("layout", 0.3, () => layoutTrees(i), true);
  for (let i = 0; i < 3; i++) unit("needle", 0.5, () => buildNeedle(i), true);
  unit("dome", 0.5, buildDome, true);
  for (let i = 0; i < 3; i++) unit("xway", 0.4, () => { buildXway(i); if (i === 2) flushBeacons(); }, true);
  unit("traffic", 0.5, trafficInit, true);
  for (let i = 0; i < 3; i++) unit("traffic", 0.5, () => trafficLanes(i), true);
  // chunks in parts of about 8 buildings; the last part makes the mesh. The far skyline comes after the start
  // view's chunks (still part of the start view), when the geometry code is warm.
  const chunkUnits = (c) => {
    const parts = Math.ceil(c.buildings.length / 8);
    for (let p = 0; p < parts; p++) unit("chunk", 1 / parts, () => { buildChunkPart(c, p, parts); if (beacons.length !== beaconMesh.n) flushBeacons(); }, c.start);
  };
  for (const c of chunksSorted) if (c.start) chunkUnits(c);
  for (let i = 0; i < 7; i++) unit("far", 0.3, () => buildFar(i), true);
  for (const c of chunksSorted) if (!c.start) chunkUnits(c);
  const total = units.reduce((s, u) => s + u.weight, 0);
  let next = 0, doneW = 0;

  /* ---------------- the diorama ---------------- */
  const dioramas = [];
  const dioU = { uClog: U.uClog };
  let dioBuildMat = null, dioGroundMat = null, dioLandMat = null, dioTreeMat = null;
  function dioMaterials() {
    if (dioBuildMat) return;
    dioBuildMat = new THREE.ShaderMaterial({ vertexShader: DIO_BUILD_VS, fragmentShader: DIO_BUILD_FS, uniforms: dioU });
    dioGroundMat = new THREE.ShaderMaterial({ vertexShader: DIO_SIMPLE_VS, fragmentShader: DIO_GROUND_FS, uniforms: { ...GU, uTime: U.uTime, uWater: U.uWater } });
    dioLandMat = new THREE.ShaderMaterial({ vertexShader: DIO_SIMPLE_VS, fragmentShader: DIO_LAND_FS, uniforms: { uLand: GU.uLand } });
    dioTreeMat = new THREE.ShaderMaterial({ vertexShader: DIO_TREE_VS, fragmentShader: DIO_TREE_FS, uniforms: {} });
  }
  let dioBaseGeo = null;
  function dioBase() {
    if (dioBaseGeo) return dioBaseGeo;
    // the land as a slab with the street pattern on top, and a strip of lake along the shore
    const b = Buf({ aKind: 1 });
    boxQuads(b, B.minX, -10, B.minZ, B.maxX, 0, city.shoreZ, { aKind: [0] });
    boxQuads(b, B.minX, -10, city.shoreZ, B.maxX, -1.5, city.shoreZ + 110, { aKind: [2] });
    dioBaseGeo = finish(b);
    return dioBaseGeo;
  }

  /* ---------------- the API ---------------- */
  const stats = { calls: 0, maxMs: 0, totalMs: 0, units: {} };
  const V = {
    root,
    progress: 0,
    startReady: false,
    info,
    perch,
    stats,
    // Builds a few units per call within the time budget and a hard count (the clock can stand still in tests).
    build(budgetMs = 6) {
      if (next >= units.length) return true;
      const t0 = performance.now();
      for (let n = 0; n < MAX_UNITS && next < units.length; n++) {
        const u = units[next];
        const tu = performance.now();
        const more = u.fn() === false;
        stats.units[u.name] = Math.max(stats.units[u.name] || 0, performance.now() - tu);
        if (!more) { doneW += u.weight; next++; }
        // past half the budget, a new unit could overrun it: leave it for the next frame
        if (performance.now() - t0 > budgetMs * 0.5) break;
      }
      V.progress = next >= units.length ? 1 : doneW / total;
      if (!V.startReady) V.startReady = units.every((u, i) => i < next || !u.start);
      info.tris = staticTris + instTris();
      const ms = performance.now() - t0;
      stats.calls++; stats.totalMs += ms; stats.maxMs = Math.max(stats.maxMs, ms);
      return next >= units.length;
    },
    update(dt, time, camPos) {
      U.uTime.value = time;
      const k = 1 - Math.exp(-dt * 1.5);
      for (let i = 0; i < 6; i++) clogNow[i] += (clogWant[i] - clogNow[i]) * k;
      U.uKing.value += (kingWant - U.uKing.value) * (1 - Math.exp(-dt * 2));
      U.uFinale.value += (finaleWant - U.uFinale.value) * (1 - Math.exp(-dt * 0.8));
      if (sky && camPos) sky.position.set(camPos.x, camPos.y, camPos.z);
    },
    setDistrictClog(id, v) { if (id >= 0 && id < 6) clogWant[id] = clamp(+v || 0, 0, 1); },
    setKing(v) { kingWant = clamp(+v || 0, 0, 1); },
    setFinale(v) { finaleWant = clamp(+v || 0, 0, 1); },
    // The portal's hole: every material under root draws only where the stencil holds ref.
    stencil(ref) {
      // every city material, including those of meshes the build has not made yet
      for (const m of mats) {
        if (ref == null) { m.stencilWrite = false; continue; }
        m.stencilWrite = true; m.stencilRef = ref; m.stencilFunc = THREE.EqualStencilFunc;
        m.stencilFail = m.stencilZFail = m.stencilZPass = THREE.KeepStencilOp;
      }
    },
    // Draws the whole city once with colour and depth writes off, so every program compiles and every buffer
    // uploads now (during the crack) instead of as a hitch when the wall bursts.
    warm(r, camera) {
      const saved = [];
      root.traverse((o) => { if (o.isMesh) { saved.push([o, o.frustumCulled]); o.frustumCulled = false; } });
      const ms = new Set(); root.traverse((o) => { if (o.material) ms.add(o.material); });
      const mm = [...ms].map((m) => [m, m.colorWrite, m.depthWrite]);
      for (const [m] of mm) { m.colorWrite = false; m.depthWrite = false; }
      const vis = root.visible, ac = r.autoClear;
      root.visible = true; r.autoClear = false;
      try { r.render(root, camera); } catch (e) { console.warn("cityview warm:", e && e.message); }
      r.autoClear = ac; root.visible = vis;
      for (const [m, c, d] of mm) { m.colorWrite = c; m.depthWrite = d; }
      for (const [o, f] of saved) o.frustumCulled = f;
    },
    // A live miniature: the city's long side fits sizeMetres. It shares the chunk, tree and landmark geometry.
    makeDiorama(size = 1) {
      dioMaterials();
      const holder = new THREE.Group();
      holder.name = "diorama";
      const g = new THREE.Group();
      const s = size / Math.max(B.maxX - B.minX, city.shoreZ - B.minZ);
      g.scale.setScalar(s);
      g.position.set(-((B.minX + B.maxX) / 2) * s, 0, -((B.minZ + city.shoreZ) / 2) * s);
      holder.add(g);
      const put = (geo, m, pos) => { const x = new THREE.Mesh(geo, m); if (pos) x.position.copy(pos); x.matrixAutoUpdate = false; x.updateMatrix(); x.frustumCulled = false; g.add(x); return x; };
      put(dioBase(), dioGroundMat);
      root.traverse((o) => { if (o.isMesh && o.material === landMat) put(o.geometry, dioLandMat); });
      if (trees && trees.n) put(trees.geo, dioTreeMat);
      const dio = { addChunk: (m) => put(m.geometry, dioBuildMat, m.position) };
      for (const m of chunkGroup) dio.addChunk(m);
      dioramas.push(dio);
      holder.addEventListener("removed", () => { const i = dioramas.indexOf(dio); if (i >= 0) dioramas.splice(i, 1); });
      return holder;
    },
    // The sky colour in a direction (a THREE.Vector3 or {x, y, z}), the same as the shader without clouds or sun disc.
    skyColorAt(dir, out = new THREE.Color()) { return skyJS(dir, out); },
  };
  let kingWant = 0, finaleWant = 0;

  // JS twin of skyColor() in the shaders
  const cTop = new THREE.Color(COLORS.skyTop), cMid = new THREE.Color(COLORS.skyMid), cHor = new THREE.Color(COLORS.skyHorizon);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function skyJS(dir, out) {
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1, dx = dir.x / l, dy = dir.y / l, dz = dir.z / l;
    const y = Math.max(dy, 0);
    const hl = Math.hypot(dx, dz) || 1;
    const toward = ((dx / hl) * U.uSunXZ.value.x + (dz / hl) * U.uSunXZ.value.y) * 0.5 + 0.5;
    const t1 = ss(0, 0.25, y), t2 = ss(0.08, 0.75, y);
    let r = lerp(lerp(cHor.r, cMid.r, t1), cTop.r, t2), g = lerp(lerp(cHor.g, cMid.g, t1), cTop.g, t2), b = lerp(lerp(cHor.b, cMid.b, t1), cTop.b, t2);
    const aw = (1 - toward) * (1 - ss(0, 0.7, y)) * 0.75;
    r = lerp(r, r * 0.9 + 0.02, aw); g = lerp(g, g * 0.8, aw); b = lerp(b, b * 1.04 + 0.06, aw);
    const s = Math.max(dx * SUN_DIR.x + dy * SUN_DIR.y + dz * SUN_DIR.z, 0);
    const k = (Math.pow(s, 6) * 0.32 + Math.pow(s, 48) * 0.4) * (1 - 0.5 * ss(0, 0.5, y));
    return out.setRGB(r + GLOW[0] * k, g + GLOW[1] * k, b + GLOW[2] * k);
  }

  return V;
}
