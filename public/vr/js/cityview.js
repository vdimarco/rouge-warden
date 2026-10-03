// In Full Swing: the city view, drawn as a comic book (the look of public/vr/art/keyart.webp). It draws what city.js lays out:
// towers, streets, trees, traffic, the lake, the painted sunset sky, the Needle, the Dome and the expressway (spec §9).
// It builds in small steps, start view first. Every face is cel-shaded in three bands with ink edges and world-anchored dots.
import * as THREE from "three";
import { WORLD, PERF, COLORS, SUN_DIR } from "./config.js";
import { INK, PAL, GLSL, smoothNormals, smoothNormalsSteps, syncInk, loadArt, inkK } from "./comic.js";

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
const BIG = 1000; // an edge distance that never draws a ink line
const SKY_SUN_U = 0.2515; // where the painted sun sits along the sky strip (art/sky.webp)
const INK_PX = 2.2; // half width of the outline hulls in pixels

const hexv = (h) => `vec3(${((h >> 16) & 255) / 255}, ${((h >> 8) & 255) / 255}, ${(h & 255) / 255})`;
const hexf = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/* ---------------- GLSL ---------------- */
const NOISE_FN = /* glsl */ `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
// Uniforms shared by every city material (vertex and fragment stage alike)
const COMMON_UNI = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec2 uSunXZ;
uniform vec3 uFog; // near, density, haze height
uniform sampler2D uMap;
uniform vec4 uMapBox; // x0, z0, 1 / width, 1 / depth
uniform sampler2D uSky;
uniform float uHaveSky;
uniform float uSkyU; // shifts the strip so the painted sun sits at the azimuth of SUN_DIR
uniform float uInkS; // ink width scale for the display
const float TAU = 6.2831853;
const vec3 INKC = ${hexv(INK)};
`;
// Maths with no derivatives, so vertex shaders can use it too: the painted sky lookup, the procedural sky, fog, shadows.
const COMMON_FN = /* glsl */ `
${NOISE_FN}
// The strip: x = azimuth (turning right goes right), y = elevation, 72 degrees at the top row.
vec2 skyUV(vec3 d) {
  vec3 n = normalize(d);
  return vec2(atan(-n.x, n.z) * 0.15915494 + uSkyU, clamp(asin(clamp(n.y, -1.0, 1.0)) * 0.7958, 0.0, 1.0));
}
// With no art: a banded sunset, sun yellow, orange, magenta, violet, indigo, zenith violet
const vec3 SKYR[6] = vec3[6](vec3(1.0, 0.72, 0.22), vec3(1.0, 0.478, 0.165), vec3(0.847, 0.271, 0.478), vec3(0.55, 0.2, 0.55), vec3(0.32, 0.16, 0.52), ${hexv(PAL.zenith)});
vec3 skyRamp(float t) { float x = clamp(t, 0.0, 1.0) * 5.0; int i = int(min(floor(x), 4.0)); return mix(SKYR[i], SKYR[i + 1], x - float(i)); }
float skyT(vec3 d) {
  float y = max(normalize(d).y, 0.0);
  float toward = dot(normalize(d.xz + vec2(1e-5)), uSunXZ) * 0.5 + 0.5;
  return clamp(pow(y, 0.55) + (1.0 - toward) * 0.24 * (1.0 - y), 0.0, 1.0);
}
// The haze colour toward a direction: the strip just above its horizon row, or the ramp
vec3 skyHaze(vec3 d) {
  vec3 h = vec3(d.x, clamp(d.y, 0.0, 0.1) * length(d.xz) * 10.0, d.z);
  vec3 c = uHaveSky > 0.5 ? textureLod(uSky, skyUV(h), 3.0).rgb : skyRamp(skyT(h));
  // far things go violet, like the far shore in the key art: darker than the sky behind them
  return mix(c, vec3(0.3, 0.16, 0.5), 0.42);
}
// Haze toward the sky colour behind the point. It is thick near the ground and thin up high (height fog), so the Needle
// and the aerial view keep their shapes. The fragment stage snaps it to four print-like steps.
float fogAmount(vec3 wp) {
  vec3 v = wp - cameraPosition;
  float d = length(v);
  float H = uFog.z, yc = max(cameraPosition.y, 0.0), yp = max(wp.y, 0.0);
  float dy = yc - yp;
  float hf = abs(dy) < 1.0 ? exp(-0.5 * (yc + yp) / H) : H * (exp(-yp / H) - exp(-yc / H)) / dy;
  float f = 1.0 - exp(-uFog.y * max(d - uFog.x, 0.0) * hf);
  return max(f, 0.06 * smoothstep(12.0, uFog.x, d));
}
// Metres under the shadow surface at a point (the map's shadow height minus its height): above 0 in another tower's shadow
float shadowDepthAt(vec3 p) {
  vec2 uv = (p.xz - uMapBox.xy) * uMapBox.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -10.0;
  return texture2D(uMap, uv).r * 510.0 - p.y;
}
// 1 in the sun, 0.5 in the edge of a shadow (the mid band), 0 deep in it
float sunT(float depth) { return 1.0 - 0.5 * smoothstep(-0.3, 0.7, depth) - 0.5 * smoothstep(3.0, 9.0, depth); }
`;
const COMMON_FS = /* glsl */ `
${COMMON_UNI}
${GLSL.posterize}${GLSL.halftone}${GLSL.ink}${GLSL.toon}
${COMMON_FN}
const vec3 DOTC = vec3(0.10, 0.05, 0.22);
// The painted sky. The turn from one end of the strip to the other jumps by a whole turn, so the gradients used for the
// mip level come from a shifted coordinate there.
vec3 skyStrip(vec3 d) {
  vec2 uv = skyUV(d);
  float uw = fract(uv.x + 0.5);
  vec2 gx = vec2(dFdx(uv.x), dFdx(uv.y)), gy = vec2(dFdy(uv.x), dFdy(uv.y));
  if (abs(gx.x) > 0.5) gx.x = dFdx(uw);
  if (abs(gy.x) > 0.5) gy.x = dFdy(uw);
  return textureGrad(uSky, uv, gx, gy).rgb;
}
vec3 skyAt(vec3 d) {
  if (uHaveSky > 0.5) return skyStrip(d);
  return skyRamp(comicPoster(skyT(d), 5.0));
}
// Haze in four print-like steps toward the sky's own colour in that direction
vec3 fogMix(vec3 col, vec3 wp, float maxF) {
  vec3 v = normalize(wp - cameraPosition);
  return mix(col, skyHaze(v), comicPoster(fogAmount(wp) * maxF, 4.0));
}
`;

// The same haze and shadow maths for vertex shaders: objects whose triangles are small take their haze (and small
// ones their sun) per vertex, which spares every pixel a sky lookup and the fog's exponentials.
const VERTEX_FOG = /* glsl */ `
${COMMON_UNI}
${COMMON_FN}
varying vec4 vFog;
void fogVertex(vec3 wp) {
  vec3 v = normalize(wp - cameraPosition);
  vFog = vec4(skyHaze(v), fogAmount(wp));
}
`;
// An outline hull (a twin of an instanced mesh, back faces, pushed out along the normal so the line stays INK_PX wide)
const HULL_UNI = /* glsl */ `
uniform float uInkW, uInkPx, uInkK;
`;

// Buildings. Attributes: aInfo (kind code, seed, floor height, bay width), aFace (walls: u along the face, face width,
// a salt, the tier top; roofs: x, z in the roof, its width and depth; parapet tops: w < 0), aEdge (metres to the quad's
// four edges, BIG where an edge draws no ink line), aDist (district).
const FACADE_VS = /* glsl */ `
${VERTEX_FOG}
attribute vec4 aInfo;
attribute vec4 aFace;
attribute vec4 aEdge;
attribute float aDist;
uniform float uClog[6];
varying vec3 vW;
varying vec3 vN;
varying vec4 vInfo;
varying vec4 vFace;
varying vec4 vEdge;
varying float vClog;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normal; vInfo = aInfo; vFace = aFace; vEdge = aEdge;
  vClog = uClog[int(aDist + 0.5)];
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FACADE_FS = /* glsl */ `
${COMMON_FS}
varying vec4 vFog;
uniform sampler2D uWin;
uniform float uHaveWin;
uniform float uFinale;
varying vec3 vW;
varying vec3 vN;
varying vec4 vInfo;
varying vec4 vFace;
varying vec4 vEdge;
varying float vClog;
// window rectangles in a cell (x from, y from, x to, y to) per kind: glass, gold, brick, stone, concrete, loft, condo
const vec4 WRECT[7] = vec4[7](vec4(0.13, 0.15, 0.86, 0.87), vec4(0.14, 0.15, 0.85, 0.86), vec4(0.3, 0.19, 0.69, 0.78), vec4(0.3, 0.17, 0.66, 0.79), vec4(0.08, 0.44, 0.9, 0.66), vec4(0.17, 0.15, 0.83, 0.83), vec4(0.14, 0.12, 0.85, 0.82));
// the wall colour round the windows in the atlas tiles, per kind (the average of their wall strips)
const vec3 WALLC[7] = vec3[7](vec3(0.16, 0.27, 0.37), vec3(0.18, 0.26, 0.34), vec3(0.56, 0.2, 0.13), vec3(0.69, 0.58, 0.51), vec3(0.42, 0.39, 0.41), vec3(0.34, 0.16, 0.13), vec3(0.26, 0.29, 0.35));
const vec3 LITMUL = vec3(1.75, 1.3, 0.85);
const vec3 LITADD = vec3(0.1, 0.045, 0.0);
// One tile of the window atlas (index = row * 4 + col, row 0 at the top). The gradients come from the cell coordinate before
// its fract(), so the mip level stays right across the cell edges; the level stops at 6 so tiles never bleed into each other.
vec4 tileSample(float tile, vec2 f, vec2 gx, vec2 gy) {
  vec2 uv = (vec2(mod(tile, 4.0), 3.0 - floor(tile * 0.25)) + clamp(f, 0.004, 0.996)) * 0.25;
  float m = max(length(gx), length(gy)) * 512.0;
  float s = min(1.0, 64.0 / max(m, 1e-3));
  return textureGrad(uWin, uv, gx * (0.25 * s), gy * (0.25 * s));
}
float stripe(float t, float w) { float fw = fwidth(t); return (1.0 - smoothstep(w - fw, w + fw, abs(fract(t) - 0.5))) * (1.0 - smoothstep(0.2, 0.5, fw)); }
vec3 wallColor(int k, float shop, float sd, float salt, float h1, float h2, float h3, vec3 N, vec3 V, float dist, out float lineY) {
  float fh = vInfo.z, bay = vInfo.w;
  float u = vFace.x, faceW = vFace.y, top = vFace.w, y = vW.y;
  bool glassy = k <= 1;
  bool condo = vInfo.x > 15.5;
  int kk = condo ? 6 : k;
  float gH = glassy ? 6.5 : 4.6;
  // Light in three bands: facing the sun and clear of other towers' shadows is lit, in a shadow's edge is mid, turned away is shade.
  float L = max(dot(N, uSunDir), 0.0) * sunT(shadowDepthAt(vW + N * 2.5));
  float band = comicBand(L, 0.12, 0.5);
  // The grid of window cells: one row per floor, and a tall row for the street floor (id.y = -1).
  float cols = max(1.0, floor(faceW / bay + 0.5));
  float cw = faceW / cols;
  bool street = y < gH;
  vec2 q = vec2(u / cw, street ? y / gH - 1.0 : (y - gH) / fh);
  vec2 gx = dFdx(q), gy = dFdy(q);
  vec2 fq = abs(gx) + abs(gy);
  // per axis: 1 while a cell spans several pixels, 0 where it would shimmer (then each axis fades to its own average)
  vec2 det2 = 1.0 - smoothstep(vec2(DETAIL0), vec2(DETAIL1), fq);
  float detail = min(det2.x, det2.y);
  float nearD = uHaveWin > 0.5 ? 1.0 - smoothstep(NEAR0, NEAR1, max(fq.x, fq.y)) : 0.0;
  vec2 id = floor(q), f = fract(q);
  float inFloors = street ? step(gH, top) : step((id.y + 1.0) * fh + gH, top - 0.5);
  // the rooms: dark or lit (offices fewer, homes more); greener in a clogged district; all lit at the finale
  float r = hash13(vec3(id, sd * 0.618 + salt * 7.31));
  float rs = hash12(vec2(id.x, sd * 0.97 + salt * 3.1));
  float litP = clamp(((glassy ? mix(0.25, 0.52, h2) : mix(0.32, 0.62, h2)) + uFinale * 0.6) * (1.0 - 0.45 * vClog), 0.0, 0.95);
  float lit = step(r, litP);
  float fl = step(0.975, fract(r * 57.3));
  lit = mix(lit, step(0.55, fract(uTime * (0.02 + 0.04 * fract(r * 91.0)) + r * 7.0)), fl);
  bool shopRow = street && shop > 0.5;
  if (street) lit = step(rs, shopRow ? 0.92 : glassy ? 0.72 : 0.55);
  float litAvg = street ? (shopRow ? 0.92 : glassy ? 0.72 : 0.55) : litP;
  float baseTile = condo ? 10.0 : k == 0 ? 0.0 : k == 1 ? 2.0 : k == 2 ? 4.0 : k == 3 ? 6.0 : k == 4 ? 14.0 : 8.0;
  float tile = shopRow && lit > 0.5 ? (rs < 0.62 ? 12.0 : 13.0) : baseTile + lit;
  vec3 wallAlb = WALLC[kk];
  vec3 celWall = comicCelX(wallAlb, band, LITMUL, LITADD);
  vec3 green = vec3(0.5, 0.9, 0.25);
  vec3 litWin = mix(mix(vec3(1.0, 0.81, 0.35), vec3(1.0, 0.7, 0.18), fract(r * 13.7)), green, vClog * 0.5) * mix(vec3(1.0), vec3(1.06, 1.0, 0.88), uFinale);
  vec3 darkWin = vec3(0.06, 0.17, 0.32);
  // Glass mirrors the painted sky: the sunset side glows orange, the far side stays violet.
  vec3 skyR = vec3(0.0);
  float mirror = 0.0;
  #ifndef LOW
  if (glassy) {
    vec3 R = reflect(-V, N);
    skyR = skyAt(vec3(R.x, abs(R.y) * 0.5 + 0.07, R.z)) * mix(vec3(1.0), vec3(0.78, 0.9, 1.0), step(0.5, h3)) * (0.7 + 0.3 * min(band, 1.0));
    mirror = k == 1 ? 0.3 : 0.55;
  }
  #endif
  // -- flat blocks: a window rectangle in each cell, flat lit or dark (also the look without the atlas)
  vec4 wr = shopRow ? vec4(0.08, 0.06, 0.92, 0.56) : WRECT[kk];
  vec2 aa = max(fq * 0.75, vec2(1e-4));
  vec2 wa = smoothstep(wr.xy - aa, wr.xy + aa, f) * (1.0 - smoothstep(wr.zw - aa, wr.zw + aa, f));
  wa = mix(wr.zw - wr.xy, wa, det2);
  float wmask = wa.x * wa.y * inFloors;
  vec3 glassDark = mix(darkWin, skyR, mirror);
  vec3 roomDark = comicCelX(glassDark * (0.85 + 0.4 * f.y), band, LITMUL, LITADD);
  vec3 roomNow = lit > 0.5 ? litWin : roomDark;
  vec3 roomAvg = mix(comicCelX(glassDark, band, LITMUL, LITADD), litWin, litAvg);
  vec3 room = mix(roomAvg, roomNow, detail);
  float emBlock = wmask * mix(litAvg, lit, detail);
  vec3 col = mix(celWall, room, wmask);
  float em = emBlock;
  // an awning over the shop windows in the flat look
  if (shopRow && nearD < 0.5) {
    float ay = smoothstep(0.58 - aa.y, 0.58 + aa.y, f.y) * (1.0 - smoothstep(0.96 - aa.y, 0.96 + aa.y, f.y));
    vec3 aw = comicCelX(rs < 0.5 ? vec3(0.7, 0.14, 0.1) : vec3(0.1, 0.4, 0.4), band, LITMUL, LITADD);
    col = mix(col, aw, ay * detail);
  }
  // -- the painted tile: the atlas cell for this window, lit or dark
  if (nearD > 0.001) {
    vec2 fx = vec2(mix(f.x, 1.0 - f.x, step(0.5, fract(r * 37.1))), f.y);
    vec3 tc = tileSample(tile, fx, gx, gy).rgb;
    float yy = min(tc.r, tc.g) - tc.b;
    float e = lit * smoothstep(0.12, 0.34, yy);
    if (tile > 12.5 && tile < 13.5) e = max(e, smoothstep(0.3, 0.55, max(tc.r, max(tc.g, tc.b))));
    // dark glass shows the sky, the way the towers in the key art do
    vec2 ww = smoothstep(wr.xy - aa, wr.xy + aa, f) * (1.0 - smoothstep(wr.zw - aa, wr.zw + aa, f));
    tc = mix(tc, skyR, (1.0 - lit) * mirror * 0.7 * ww.x * ww.y);
    vec3 glow = tc * e * (0.94 + 0.12 * fract(r * 5.3)) * mix(vec3(1.0), vec3(1.06, 1.0, 0.9), uFinale);
    glow = mix(glow, glow * green * 1.4, vClog * 0.4);
    vec3 tcol = comicCelX(tc * (1.0 - e), band, LITMUL, LITADD) + glow;
    col = mix(col, mix(celWall, tcol, inFloors), nearD);
    em = mix(em, e * inFloors, nearD);
  }
  // world-anchored Ben-Day dots on the walls that are not fully lit, in face metres so they hold still in both eyes
  #ifndef LOW
  float dw = 1.0 - clamp(band - 1.0, 0.0, 1.0);
  col = mix(col, DOTC, comicDots(vec2(u, y), 0.22, mix(0.62, 0.3, clamp(band, 0.0, 1.0))) * dw * 0.5 * (1.0 - em));
  #endif
  // the street floor is cut from the floors above by a course line
  lineY = (glassy || shop > 0.5) ? gH : -1.0;
  // tower crowns: a short top tier on a glass tower is a louvred plant screen
  if (glassy && salt > 50.0 && y < top) {
    col = mix(comicCel(vec3(0.3, 0.32, 0.4), band), INKC, stripe(y / 0.6, 0.06) * 0.8);
  }
  // above the last window row, and the parapet: plain wall
  if (y > top) col = comicCel(mix(wallAlb, vec3(0.62, 0.6, 0.64), 0.4), band);
  return col;
}
vec3 roofColor(int k, float h1, float h2, vec3 N) {
  float L = 0.66 * sunT(shadowDepthAt(vW + vec3(0.0, 0.1, 0.0)));
  float band = comicBand(L, 0.12, 0.5);
  // parapet tops: pale coping stone
  vec3 base;
  if (vFace.w < 0.0) base = vec3(0.7, 0.66, 0.66);
  else {
    vec2 rp = vFace.xy;
    float ew = min(min(rp.x, vFace.z - rp.x), min(rp.y, vFace.w - rp.y));
    base = k <= 1 ? mix(vec3(0.3, 0.32, 0.4), vec3(0.6, 0.6, 0.66), step(0.55, h2)) : k == 4 ? vec3(0.5, 0.48, 0.5) : mix(vec3(0.48, 0.38, 0.36), vec3(0.6, 0.5, 0.42), h2);
    // big flat patches, two tones (no gradients), and a dark flashing along the parapet
    float n1 = vnoise(vW.xz * 0.11 + h1 * 40.0);
    float wn = max(fwidth(n1), 1e-4);
    base *= 0.92 + 0.14 * smoothstep(0.55 - wn, 0.55 + wn, n1);
    float fe = fwidth(ew);
    base = mix(base, base * 0.55, 1.0 - smoothstep(0.35 - fe, 0.35 + fe, ew));
    // roll seams every 2.5 m on some roofs: a flow of lines under a swinging player, fading before they shimmer
    base *= 1.0 - 0.3 * stripe(rp.x / 2.5, 0.025) * step(0.4, h1);
  }
  vec3 col = comicCelX(base, band, vec3(1.55, 1.2, 0.85), vec3(0.08, 0.035, 0.0));
  float dw = 1.0 - clamp(band - 1.0, 0.0, 1.0);
  #ifndef LOW
  col = mix(col, DOTC, comicDots(vW.xz, 0.16, mix(0.62, 0.3, clamp(band, 0.0, 1.0))) * dw * 0.45);
  #endif
  return col;
}
void main() {
  vec3 N = normalize(vN);
  vec3 toCam = cameraPosition - vW;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-3);
  float code = mod(floor(vInfo.x + 0.5), 16.0);
  float shop = step(7.5, code);
  int k = int(code - shop * 8.0 + 0.5);
  // hash inputs are rounded: a varying is never exactly constant across a triangle, and a hash amplifies the noise
  float sd = floor(vInfo.y * 4096.0 + 0.5);
  float salt = floor(vFace.z + 0.5);
  float h1 = fract(sd * 0.0913), h2 = fract(sd * 0.3771), h3 = fract(sd * 0.1313);
  vec3 col;
  float lineY = -1.0;
  if (N.y > 0.5) col = roofColor(k, h1, h2, N);
  else col = wallColor(k, shop, sd, salt, h1, h2, h3, N, V, dist, lineY);
  // a clogged district goes grey-green; the finale warms everything
  col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.82, 0.98, 0.62), vClog * 0.38);
  col *= mix(vec3(1.0), vec3(1.08, 1.0, 0.9), uFinale);
  // ink on every face edge: the pixel distance to the nearest inked edge of this quad
  vec4 ge = sqrt(dFdx(vEdge) * dFdx(vEdge) + dFdy(vEdge) * dFdy(vEdge));
  vec4 pe = vEdge / max(ge, vec4(1e-6));
  float dp = min(min(pe.x, pe.y), min(pe.z, pe.w));
  float wpx = comicInkW(dist, uInkS);
  float ink = 1.0 - smoothstep(wpx - 0.75, wpx + 0.75, dp);
  if (lineY > 0.0) ink = max(ink, comicInk(abs(vW.y - lineY), wpx * 0.8));
  col = mix(col, INKC, ink);
  gl_FragColor = vec4(mix(col, vFog.rgb, comicPoster(vFog.a, 4.0)), 1.0);
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
${COMMON_FS}
uniform float uKing, uFinale;
uniform vec4 uNeedle; // x, z, pod bottom, (unused)
uniform vec4 uDome;   // x, z, radius, expressway centre z
varying vec3 vW;
varying vec3 vN;
varying float vKind;
float aaLine(float d, float w, float fw) { return (1.0 - smoothstep(w - fw, w + fw, abs(d))) * (1.0 - smoothstep(w * 1.5, w * 5.0, fw)); }
void main() {
  vec3 N = normalize(vN);
  vec3 toCam = cameraPosition - vW;
  vec3 V = toCam / max(length(toCam), 1e-3);
  int k = int(vKind + 0.5);
  float L = comicLight(N, uSunDir) * sunT(shadowDepthAt(vW + vec3(N.x, 0.0, N.z) * 2.5));
  float band = comicBand(L, 0.12, 0.5);
  float maxF = 1.0;
  vec2 rel = vW.xz - uNeedle.xy;
  float az = atan(rel.y, rel.x);
  if (k <= 15) maxF = 0.6;
  vec3 alb = vec3(0.6);
  vec3 emit = vec3(0.0);
  float ink = 0.0;
  vec3 lm = vec3(1.6, 1.22, 0.85);
  if (k == 10) {
    // the Needle's shaft: blue-grey concrete with pour lines, and the King's sludge running down from the pod
    alb = vec3(0.55, 0.55, 0.68);
    ink = aaLine(fract(vW.y / 22.0) - 0.5, 0.02, fwidth(vW.y / 22.0)) * 0.7;
    float t = az * 5.0 / TAU;
    float slot = floor(t + 0.5);
    float hh = hash12(vec2(slot, 3.0));
    float dw = 1.0 - smoothstep(0.06 + 0.06 * hh, 0.12 + 0.1 * hh, abs(t - slot));
    float len = 30.0 + 90.0 * hh;
    float dy = uNeedle.z - 2.0 - vW.y;
    float drip = dw * step(0.0, dy) * (1.0 - smoothstep(len - 4.0, len, dy));
    alb = mix(alb, vec3(0.55, 0.82, 0.14), drip * (1.0 - uFinale));
    emit = vec3(0.3, 0.62, 0.08) * drip * (1.0 - uFinale);
  } else if (k == 11) {
    // the pod's concrete, with a dark reveal line every few metres
    alb = vec3(0.7, 0.68, 0.76);
    ink = aaLine(fract(vW.y / 4.0) - 0.5, 0.03, fwidth(vW.y / 4.0)) * step(abs(N.y), 0.5) * 0.7;
  } else if (k == 12) {
    // the pod's window band: mullions round the ring, lit warm (green when the King wakes)
    float m = fract(az * 64.0 / TAU);
    float mfw = fwidth(az * 64.0 / TAU);
    float mull = mix(0.12, smoothstep(0.06 - mfw, 0.06 + mfw, abs(m - 0.5) - 0.38), 1.0 - smoothstep(0.2, 0.5, mfw));
    float bandY = fract((vW.y - uNeedle.z) / 3.0);
    float bfw = fwidth((vW.y - uNeedle.z) / 3.0);
    float floorLine = aaLine(bandY - 0.5, 0.04, bfw);
    float pulse = 0.75 + 0.25 * sin(uTime * 3.0);
    vec3 glow = mix(vec3(1.0, 0.8, 0.36), vec3(0.45, 1.0, 0.2) * pulse, uKing);
    emit = glow * (0.85 + 0.2 * uFinale + 0.3 * uKing);
    alb = vec3(0.1);
    ink = clamp(mull * 0.9 + floorLine * 0.7, 0.0, 1.0);
  } else if (k == 13) {
    // collars and the deck: metal, with a ring of warm lights on the rim
    alb = vec3(0.5, 0.5, 0.62);
    float t = az * 72.0 / TAU;
    float tfw = fwidth(t);
    float dotL = (1.0 - smoothstep(0.18 - tfw, 0.18 + tfw, abs(fract(t) - 0.5))) * (1.0 - smoothstep(0.15, 0.5, tfw));
    float rim = step(abs(N.y), 0.5) * mix(0.2, dotL, 1.0 - smoothstep(0.15, 0.5, tfw));
    emit = mix(vec3(1.0, 0.82, 0.4), vec3(0.4, 1.0, 0.25), uKing * 0.8) * rim * 0.9;
  } else if (k == 14) {
    // the antenna mast: grey with red and white bands near the top
    float bq = vW.y / 6.0, bfw = fwidth(bq);
    float bnd = mix(0.5, smoothstep(0.5 - bfw, 0.5 + bfw, fract(bq)), 1.0 - smoothstep(0.2, 0.5, bfw)) * step(330.0, vW.y);
    alb = mix(vec3(0.5, 0.5, 0.62), vec3(0.85, 0.16, 0.12), bnd);
  } else if (k == 15) {
    // the tower model's graphite steel (Higgsfield 3D): dark violet-grey, so its ink lines read
    alb = vec3(0.16, 0.18, 0.24);
  } else if (k == 16 || k == 17) {
    // the Dome: pale lilac panels on inked ribs, dark arches round the base
    float a = atan(vW.z - uDome.y, vW.x - uDome.x);
    float t = a * 32.0 / TAU;
    float tfw = fwidth(t);
    float rib = aaLine(fract(t) - 0.5, 0.05, tfw);
    float lat = aaLine(fract(vW.y / 8.0) - 0.5, 0.03, fwidth(vW.y / 8.0));
    alb = vec3(0.9, 0.88, 0.96);
    ink = max(rib, lat * 0.7) * 0.75;
    if (k == 17) {
      float ar = fract(t * 2.0), afw = fwidth(t * 2.0);
      float yy = vW.y / 7.5;
      float arch = (1.0 - smoothstep(0.32 - afw, 0.32 + afw, abs(ar - 0.5))) * step(0.08, yy) * (1.0 - smoothstep(0.7 - fwidth(yy), 0.7 + fwidth(yy), yy + pow(abs(ar - 0.5) * 2.4, 2.0) * 0.3));
      arch *= 1.0 - smoothstep(0.2, 0.5, afw);
      alb = mix(vec3(0.7, 0.66, 0.72), vec3(0.06, 0.05, 0.1), arch);
      emit = vec3(1.0, 0.7, 0.35) * arch * 0.3;
    }
  } else if (k == 18) {
    // the expressway deck: violet asphalt, cream lane lines, edge lines
    float dz = vW.z - uDome.w;
    float fz = fwidth(vW.z) + 1e-4;
    alb = vec3(0.3, 0.28, 0.42);
    float dash = mix(0.5, step(0.5, fract(vW.x / 9.0)), 1.0 - smoothstep(0.5, 2.0, fwidth(vW.x)));
    float lines = aaLine(abs(dz) - 3.5, 0.1, fz) * dash + aaLine(abs(dz) - 7.0, 0.1, fz) * dash + aaLine(abs(dz) - 10.2, 0.12, fz) + aaLine(dz, 0.28, fz) * 0.8;
    alb = mix(alb, vec3(0.96, 0.86, 0.6), clamp(lines, 0.0, 1.0));
  } else if (k == 19) {
    alb = vec3(0.5, 0.5, 0.6);
    if (N.y < -0.5) alb *= 0.6;
  } else if (k == 20) {
    alb = vec3(0.66, 0.62, 0.62);
  } else {
    // the King's perch: a gold plinth on the pod roof
    alb = vec3(0.8, 0.6, 0.2);
    lm = vec3(1.3, 1.15, 0.9);
  }
  vec3 col = comicCelX(alb, band, lm, vec3(0.09, 0.04, 0.0));
  float dw = 1.0 - clamp(band - 1.0, 0.0, 1.0);
  col = mix(col, DOTC, comicDots(vec2(az * 12.0 + vW.x * 0.0, vW.y), 0.34, mix(0.62, 0.3, clamp(band, 0.0, 1.0))) * dw * 0.5 * step(float(k), 15.5));
  col += emit;
  col = mix(col, INKC, clamp(ink, 0.0, 1.0));
  gl_FragColor = vec4(fogMix(col, vW, maxF), 1.0);
}`;
// its ink hull: the mesh again as back faces, pushed out along the welded normals so the line stays INK_PX wide
const LANDMARK_HULL_VS = /* glsl */ `
attribute vec3 aOutline;
attribute float aKind;
${HULL_UNI}
varying vec3 vW;
varying float vKind;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.xyz += normalize(aOutline) * max(uInkW, uInkPx * uInkK * length(w.xyz - cameraPosition));
  vW = w.xyz; vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const LANDMARK_HULL_FS = /* glsl */ `
${COMMON_FS}
varying vec3 vW;
varying float vKind;
void main() { gl_FragColor = vec4(fogMix(INKC, vW, vKind < 15.5 ? 0.6 : 1.0), 1.0); }`;

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
// an ink line where a pattern draws one (kerbs, park edges, the quay), as pixels: d metres to the edge over metres per pixel
float gInk = 0.0;
float inkD(float d, float fp) { return 1.0 - smoothstep(1.05, 2.55, d / fp); }
vec3 asphalt(vec2 p, float fp) {
  // repair patches on a loose grid, flat, in a slightly lighter violet
  vec2 cell = floor(p / vec2(9.0, 6.0));
  float patchv = step(0.86, hash12(cell));
  vec2 pf = fract(p / vec2(9.0, 6.0));
  float inP = step(0.12, pf.x) * step(pf.x, 0.8) * step(0.2, pf.y) * step(pf.y, 0.75);
  return vec3(0.3, 0.28, 0.42) * (1.0 + 0.1 * patchv * inP);
}
vec3 pavers(vec2 p, float fp, vec3 c, float size) {
  vec2 g = abs(fract(p / size) - 0.5);
  float fw = fp / size;
  float e = 0.5 - max(g.x, g.y);
  float joint = (1.0 - smoothstep(0.012 - fw, 0.012 + fw, e)) * (1.0 - smoothstep(0.08, 0.3, fw));
  return mix(c, c * 0.6, joint);
}
vec3 parkColor(vec2 p, vec4 r, float fp) {
  vec2 c = (r.xy + r.zw) * 0.5, hs = (r.zw - r.xy) * 0.5;
  vec2 q = (p - c) / hs;
  vec3 grass = mix(vec3(0.4, 0.5, 0.15), vec3(0.5, 0.52, 0.16), step(0.6, vnoise(p * 0.08)));
  // fallen leaves under the trees: flat orange patches
  float ln = vnoise(p * 0.3 + 3.0);
  float lw = max(fwidth(ln), 1e-4);
  grass = mix(grass, vec3(0.86, 0.42, 0.1), smoothstep(0.66 - lw, 0.66 + lw, ln));
  // paths: the two diagonals and a ring
  float d1 = abs(q.x * hs.x - q.y * hs.y * (hs.x / hs.y)) / 1.4;
  float d2 = abs(q.x * hs.x + q.y * hs.y * (hs.x / hs.y)) / 1.4;
  float ring = abs(length(q * hs) - min(hs.x, hs.y) * 0.55);
  float dpath = min(min(d1, d2), ring) - 1.3;
  float path = 1.0 - smoothstep(-fp, fp, dpath);
  gInk = max(gInk, inkD(abs(dpath), fp) * 0.6);
  // the park's own edge
  vec2 e = hs - abs(p - c);
  gInk = max(gInk, inkD(min(e.x, e.y), fp));
  return mix(grass, vec3(0.74, 0.64, 0.5), path);
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
      gInk = max(gInk, inkD(c.z - d, fp));
      return mix(vec3(0.66, 0.58, 0.58), vec3(0.46, 0.4, 0.46), ring * 0.8);
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
    return vec3(0.34, 0.3, 0.42);
  }
  bool roadX = onX && ax < hx - wx;
  bool roadZ = onZ && az < hz - wz;
  vec3 c;
  if (roadX && roadZ) return asphalt(p, fp);
  if (roadX || roadZ) {
    // lanes along the street: dx, dz are across and along it
    float across = roadX ? dx : dz, along = roadX ? p.y : p.x, aw = roadX ? ax : az;
    float hw = roadX ? hx - wx : hz - wz, flags = roadX ? fx : fz;
    bool atCross = roadX ? onZ : onX;
    c = asphalt(p, fp);
    gInk = max(gInk, inkD(hw - aw, fp));
    if (atCross) {
      // a zebra crossing where the other street's sidewalk crosses this one
      float z = stripes(across / 1.2, fp / 1.2);
      c = mix(c, vec3(0.96, 0.88, 0.66), z * 0.9);
      return c;
    }
    float lines = 0.0;
    vec3 lc = vec3(0.96, 0.88, 0.66);
    if (flags > 1.5) {
      // the boulevard: a planted median
      if (aw < 3.0) {
        gInk = max(gInk, inkD(3.0 - aw, fp));
        return mix(vec3(0.4, 0.5, 0.15), vec3(0.86, 0.42, 0.1), step(0.72, vnoise(p * 0.5)));
      }
      lines += aaLine(aw - 3.2, 0.14, fp);
      lines += aaLine(aw - 6.5, 0.1, fp) * step(0.55, fract(along / 9.0));
      lines += aaLine(aw - 10.0, 0.1, fp) * step(0.55, fract(along / 9.0));
    } else {
      float dash = step(0.55, fract(along / 9.0));
      lines += aaLine(aw - 3.5, 0.09, fp) * dash;
      if (hw > 9.0) lines += aaLine(aw - 7.0, 0.09, fp) * dash;
      // double yellow centre line
      float yl = aaLine(aw - 0.2, 0.07, fp);
      c = mix(c, vec3(1.0, 0.72, 0.14), yl * (flags > 0.5 ? 0.0 : 1.0));
      if (flags > 0.5) {
        // streetcar tracks: two rails per track, set in the lanes next to the centre
        float t1 = abs(aw - 1.75);
        float rails = aaLine(t1 - 0.72, 0.06, fp);
        c = mix(c, vec3(0.18, 0.14, 0.28), aaLine(t1, 0.95, fp) * 0.5);
        c = mix(c, vec3(0.7, 0.66, 0.7), rails);
      }
    }
    // stop lines before the crossings
    float dzn = roadX ? dz : dx, hzn = roadX ? hz : hx;
    float sideOk = roadX ? step(0.0, dx * dz) : step(0.0, -dz * dx);
    lines += aaLine(abs(dzn) - hzn - 0.9, 0.28, fp) * sideOk * step(abs(dzn), hzn + 3.0);
    return mix(c, lc, clamp(lines, 0.0, 1.0));
  }
  // sidewalks: pale slabs and an inked kerb along the road
  float toRoad = min(onX ? ax - (hx - wx) : 99.0, onZ ? az - (hz - wz) : 99.0);
  gInk = max(gInk, inkD(toRoad, fp));
  return pavers(p, fp, vec3(0.62, 0.55, 0.58), 1.5);
}
vec3 promenade(vec2 p, float fp) {
  // boardwalk planks along the shore, a granite edge at the water
  float t = p.y / 0.4;
  float fw = fp / 0.4;
  float plank = (1.0 - smoothstep(0.04 - fw, 0.04 + fw, abs(fract(t) - 0.5) - 0.46)) * (1.0 - smoothstep(0.1, 0.3, fw));
  vec3 wood = mix(vec3(0.6, 0.4, 0.26), vec3(0.4, 0.26, 0.2), plank * 0.7);
  vec3 stone = pavers(p, fp, vec3(0.62, 0.56, 0.6), 2.0);
  vec3 c = p.y < 294.0 ? pavers(p, fp, vec3(0.55, 0.5, 0.56), 1.2) : wood;
  gInk = max(gInk, inkD(abs(p.y - (uLand.w - 2.2)), fp) * 0.7);
  gInk = max(gInk, inkD(uLand.w - p.y, fp));
  return mix(c, stone, smoothstep(uLand.w - 2.2 - fp, uLand.w - 2.2 + fp, p.y));
}
vec3 suburb(vec2 p, float fp) {
  // beyond the city: a patchwork of low roofs, yards and autumn woods, with a few long roads
  float n = vnoise(p * 0.008);
  vec3 homes = vec3(0.4, 0.33, 0.44);
  vec3 woods = mix(vec3(0.52, 0.34, 0.24), vec3(0.42, 0.4, 0.26), step(0.5, vnoise(p * 0.006 + 3.0)));
  vec3 c = mix(homes, woods, step(0.62, n));
  vec2 g = abs(fract((p + vec2(200.0)) / 400.0) - 0.5) * 400.0;
  float road = (1.0 - smoothstep(6.0 - fp, 6.0 + fp, min(g.x, g.y))) * (1.0 - smoothstep(4.0, 12.0, fp));
  return mix(c, vec3(0.28, 0.25, 0.4), road);
}
vec3 groundAlbedo(vec3 wp, vec3 N, float fp) {
  vec2 p = wp.xz;
  gInk = 0.0;
  if (N.y < 0.5) return vec3(0.5, 0.46, 0.56);
  if (p.x < uLand.x || p.x > uLand.z || p.y < uLand.y) return suburb(p, fp);
  if (p.y > float(${PROMENADE}.0)) return promenade(p, fp);
  return cityGround(p, fp);
}
`;
const GROUND_FS = /* glsl */ `
${COMMON_FS}
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
  float ink = gInk;
  // sludge in the gutters of a clogged district: flat green blobs
  float cl = clogAt(vW.xz);
  if (cl > 0.01) {
    float sn = vnoise(vW.xz * 0.12);
    float sw = max(fwidth(sn), 1e-4);
    float s = smoothstep(0.66 - sw, 0.66 + sw, sn) * step(0.5, cl + 0.3 * sn);
    alb = mix(alb, vec3(0.5, 0.78, 0.16), s * cl);
  }
  float L = comicLight(N, uSunDir) * sunT(shadowDepthAt(vW + vec3(0.0, 0.1, 0.0)));
  float band = comicBand(L, 0.12, 0.5);
  vec3 col = comicCelX(alb, band, vec3(1.7, 1.22, 0.8), vec3(0.08, 0.03, 0.0));
  float dw = 1.0 - clamp(band - 1.0, 0.0, 1.0);
  col = mix(col, DOTC, comicDots(vW.xz, 0.3, mix(0.62, 0.3, clamp(band, 0.0, 1.0))) * dw * 0.5);
  col = mix(col, INKC, clamp(ink, 0.0, 1.0));
  gl_FragColor = vec4(fogMix(col, vW, 1.0), 1.0);
}`;

// The lake: flat violet bands of mirror, inked wave strokes, the sun's road of light, print dots.
const WATER_FS = /* glsl */ `
${COMMON_FS}
uniform vec3 uWater;
varying vec3 vW;
// dashes about 6 s long and 1.7 s thick, in the world (they drift slowly with the current), fading before they shimmer
float strokes(vec2 p, float s) {
  vec2 cell = vec2(9.0, 2.4) * s;
  vec2 q = vec2(p.x + uTime * 0.3 * s, p.y) / cell;
  vec2 id = floor(q), f = fract(q);
  float has = step(0.5, hash12(id + s));
  float yc = 0.3 + 0.4 * hash12(id + 5.7);
  float w = 0.11 * (0.5 + 0.5 * hash12(id + 2.1));
  float xe = 1.0 - pow(abs(f.x * 2.0 - 1.0), 2.5);
  float d = abs(f.y - yc) - w * xe;
  float fy = max(fwidth(q.y), 1e-4);
  return has * (1.0 - smoothstep(-fy, fy, d)) * (1.0 - smoothstep(0.1, 0.25, fy));
}
void main() {
  vec2 p = vW.xz;
  vec3 toCam = cameraPosition - vW;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 fw = fwidth(p);
  float fp = max(fw.x, fw.y);
  // a slow swell tilts the mirror a little (only the sky seen in it, so the bands stay straight)
  vec2 g = vec2(cos(dot(p, vec2(0.8, 0.6)) * 0.21 + uTime * 0.9), cos(dot(p, vec2(-0.3, 0.95)) * 0.33 + uTime * 1.2)) * 0.012 * (1.0 - smoothstep(1.0, 5.0, fp));
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  // flat bands of mirror: deep violet water near, more sky toward the horizon
  float fres = comicPoster(pow(1.0 - V.y, 2.2), 4.0);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 sky = skyAt(R);
  // the bands are painted, not mixed: deep blue, violet-blue, violet, magenta, and the horizon's hot pink; the sky's clouds tint them
  float lv = fres * 4.0;
  vec3 body = mix(mix(mix(mix(vec3(0.05, 0.08, 0.36), vec3(0.14, 0.11, 0.5), clamp(lv, 0.0, 1.0)), vec3(0.3, 0.13, 0.52), clamp(lv - 1.0, 0.0, 1.0)), vec3(0.6, 0.18, 0.5), clamp(lv - 2.0, 0.0, 1.0)), vec3(0.95, 0.42, 0.3), clamp(lv - 3.0, 0.0, 1.0));
  vec3 col = mix(body, sky * vec3(0.9, 0.7, 1.0), 0.28 * step(0.5, lv));
  // inked wave strokes, near and far scales crossfaded by distance
  // (the dash size follows the pixel footprint in octaves, so a dash stays a few pixels thick whatever the distance)
  float lg = log2(max(fp * 18.0 / 2.4, 1.0));
  float l0 = floor(lg);
  float st = mix(strokes(p, exp2(l0)), strokes(p, exp2(l0 + 1.0)), smoothstep(0.0, 1.0, fract(lg)));
  // the sun's road: a column of light under the painted sun, broken up by the strokes
  vec2 hd = normalize(vW.xz - cameraPosition.xz + vec2(1e-5));
  float toSun = dot(hd, uSunXZ);
  float ang = acos(clamp(toSun, -1.0, 1.0));
  float hw = 0.03 + 0.1 * smoothstep(0.02, 0.3, V.y);
  float road = (1.0 - smoothstep(hw * 0.55, hw, ang)) * step(0.0, toSun);
  float rm = comicPoster(road * (0.55 + 0.45 * st), 3.0);
  col = mix(col, mix(vec3(1.0, 0.5, 0.16), vec3(1.0, 0.86, 0.32), st), rm);
  // dark dashes on the body, print dots in the deep water
  col = mix(col, vec3(0.05, 0.04, 0.2), st * (1.0 - road) * 0.75);
  col = mix(col, DOTC, comicDots(p, 2.4, 0.3) * (1.0 - fres) * 0.5);
  // a pale lip of foam along the quay, with its ink line
  float qd = p.y - ${WORLD.shoreZ}.0;
  col = mix(col, vec3(0.95, 0.86, 0.82), 1.0 - smoothstep(0.9 - fp, 0.9 + fp, qd));
  col = mix(col, INKC, 1.0 - smoothstep(1.05, 2.55, abs(qd - 0.9) / max(fp, 1e-4)));
  gl_FragColor = vec4(fogMix(col, vW, mix(0.5, 0.25, road)), 1.0);
}`;

// The sky dome: the painted strip (art/sky.webp) turned so its sun sits at SUN_DIR's azimuth, flat zenith violet with sky
// dots above it and a few sparkle stars on the dusk side. It draws last, at the far plane, so early depth skips covered pixels.
const SKY_VS = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 p = projectionMatrix * viewMatrix * w;
  gl_Position = vec4(p.xy, p.w * 0.999999, p.w);
}`;
const SKY_FS = /* glsl */ `
${COMMON_FS}
varying vec3 vW;
void main() {
  vec3 d = normalize(vW - cameraPosition);
  vec3 col = skyAt(d);
  if (uHaveSky > 0.5) {
    float el = asin(clamp(d.y, -1.0, 1.0)) * 0.7958; // 1 at the strip's top row
    // stereographic from the nadir: dots and stars keep one size across the sky
    vec2 sp = d.xz / (1.0 + max(d.y, -0.9));
    float zt = smoothstep(0.86, 1.1, el);
    vec3 zen = mix(${hexv(PAL.zenith)}, vec3(0.13, 0.06, 0.34), comicDots(sp, 0.022, 0.42) * 0.7);
    col = mix(col, zen, zt);
    // sparkle stars on the dusk side: four-pointed, never under 2 px
    vec2 sq = sp / 0.085;
    vec2 sid = floor(sq), sf = fract(sq) - 0.5;
    float h = hash12(sid + 11.0);
    vec2 c = sf - (vec2(hash12(sid + 3.0), hash12(sid + 7.0)) - 0.5) * 0.5;
    float px = max(fwidth(sq.x), 1e-4);
    float R0 = max(0.05 + 0.22 * h * h, 2.2 * px);
    float sd = pow(abs(c.x) + 1e-4, 0.5) + pow(abs(c.y) + 1e-4, 0.5);
    float star = step(0.7, h) * (1.0 - smoothstep(sqrt(R0) * 0.75, sqrt(R0), sd));
    float dusk = smoothstep(0.1, -0.5, dot(normalize(d.xz + vec2(1e-5)), uSunXZ));
    col = mix(col, vec3(1.0, 0.96, 0.8), star * dusk * smoothstep(0.55, 0.9, el));
  } else {
    // no art: a flat comic sun and its ring round SUN_DIR
    float s = dot(d, uSunDir);
    col = mix(col, vec3(1.0, 0.72, 0.3), 1.0 - smoothstep(0.9935 - 0.0008, 0.9935 + 0.0008, s));
    col = mix(col, ${hexv(PAL.sun)}, 1.0 - smoothstep(0.9985 - 0.0004, 0.9985 + 0.0004, s));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// Trees: a trunk and two lumpy crown lobes, one instance each. Cel colours, leaf clumps in two flat tones, and an ink hull.
const TREE_VS = /* glsl */ `
${VERTEX_FOG}
varying float vDepth;
attribute float aPart;
attribute vec4 aT;  // x, y, z, scale
attribute vec4 aTc; // colour, turn
#ifdef OUTLINE
${HULL_UNI}
#endif
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
  #ifdef OUTLINE
  w.xyz += normalize(n) * max(uInkW, uInkPx * uInkK * length(w.xyz - cameraPosition));
  #endif
  vW = w.xyz; vN = n; vC = aTc.rgb; vPart = aPart;
  vDepth = shadowDepthAt(w.xyz);
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const TREE_FS = /* glsl */ `
${COMMON_FS}
varying vec4 vFog;
varying float vDepth;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
varying float vPart;
void main() {
  #ifdef OUTLINE
  gl_FragColor = vec4(mix(INKC, vFog.rgb, comicPoster(vFog.a, 4.0) * 0.9), 1.0);
  return;
  #endif
  vec3 N = normalize(vN);
  vec3 alb;
  if (vPart < 0.5) alb = vec3(0.32, 0.22, 0.22);
  else {
    // leaf clumps: two flat tones; the clumps fade out before they can shimmer
    float fp = length(fwidth(vW));
    float c1 = vnoise(vW.xz * 1.5 + vW.y * 1.2);
    float cw = max(fwidth(c1), 1e-4);
    float leaf = mix(0.5, smoothstep(0.5 - cw, 0.5 + cw, c1), 1.0 - smoothstep(0.25, 0.8, fp));
    alb = vC * (0.94 + 0.16 * leaf);
  }
  float L = comicLight(vec3(N.x, N.y * 0.6, N.z), uSunDir) * sunT(vDepth);
  float band = comicBand(L, 0.1, 0.42);
  // autumn leaves stay lively in the shade: a lighter mid tone than the walls get
  vec3 shd = alb * vec3(0.42, 0.34, 0.62) + vec3(0.02, 0.02, 0.08), mid = alb * vec3(0.88, 0.74, 0.9), lit = alb * vec3(1.25, 1.05, 0.7) + vec3(0.06, 0.03, 0.0);
  vec3 col = band < 1.0 ? mix(shd, mid, band) : mix(mid, lit, band - 1.0);
  float dw = 1.0 - clamp(band - 1.0, 0.0, 1.0);
  col = mix(col, DOTC, comicDots(vW.xz + vW.y * 0.5, 0.4, mix(0.6, 0.3, clamp(band, 0.0, 1.0))) * dw * 0.45);
  gl_FragColor = vec4(mix(col, vFog.rgb, comicPoster(vFog.a, 4.0)), 1.0);
}`;

// Cars and streetcars: they drive their lanes in the vertex shader, from uTime, with head and tail lights and an ink hull.
const CAR_VS = /* glsl */ `
${VERTEX_FOG}
varying float vDepth;
attribute vec4 aLane; // start x, y, z, heading (0 +x, 1 -x, 2 +z, 3 -z)
attribute vec4 aMove; // lane length, speed, phase, (unused)
attribute vec3 aColor;
attribute float aPart;
#ifdef OUTLINE
attribute vec3 aOutline;
${HULL_UNI}
#endif
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
  vN = f * normal.x + vec3(0.0, normal.y, 0.0) + side * normal.z;
  #ifdef OUTLINE
  vec3 on = f * aOutline.x + vec3(0.0, aOutline.y, 0.0) + side * aOutline.z;
  wp += normalize(on) * max(uInkW, uInkPx * uInkK * length(wp - cameraPosition));
  #endif
  vec4 w = modelMatrix * vec4(wp, 1.0);
  vW = w.xyz; vL = position; vLN = normal; vC = aColor;
  vDepth = shadowDepthAt(aLane.xyz + f * s + vec3(0.0, 1.0, 0.0));
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CAR_FS = /* glsl */ `
${COMMON_FS}
varying vec4 vFog;
varying float vDepth;
uniform vec3 uHalf; // half length, half width, height of the lamps
varying vec3 vW;
varying vec3 vN;
varying vec3 vL;
varying vec3 vLN;
varying vec3 vC;
varying float vPart;
void main() {
  #ifdef OUTLINE
  gl_FragColor = vec4(mix(INKC, vFog.rgb, comicPoster(vFog.a, 4.0) * 0.9), 1.0);
  return;
  #endif
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 alb = vC;
  float fp = length(fwidth(vL)) + 1e-4;
  float L = comicLight(N, uSunDir) * sunT(vDepth);
  float band = comicBand(L, 0.12, 0.45);
  vec3 col;
  #ifdef STREETCAR
  // red body, a cream band, a strip of lit windows
  float win = smoothstep(1.35 - fp, 1.35 + fp, vL.y) * (1.0 - smoothstep(2.55 - fp, 2.55 + fp, vL.y));
  float bnd = smoothstep(0.95 - fp, 0.95 + fp, vL.y) * (1.0 - smoothstep(1.2 - fp, 1.2 + fp, vL.y));
  alb = mix(alb, vec3(0.96, 0.88, 0.7), bnd);
  col = comicCel(alb, band);
  col = mix(col, vec3(1.0, 0.8, 0.36), win * step(abs(vLN.y), 0.5));
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
  col = comicCel(alb, band);
  col = mix(col, vec3(0.1, 0.14, 0.34) + vec3(0.5, 0.25, 0.2) * step(0.5, V.y + N.x * 0.3), glass * 0.9);
  col = mix(col, INKC, tyre);
  col = mix(col, vec3(0.6, 0.58, 0.66), hub);
  #endif
  // lights on the front and back faces
  float lx = abs(vL.z) - uHalf.y * 0.62;
  float light = (1.0 - smoothstep(0.2 - fp, 0.2 + fp, abs(lx))) * (1.0 - smoothstep(0.08 - fp, 0.08 + fp, abs(vL.y - uHalf.z)));
  float front = step(0.5, vLN.x), back = step(0.5, -vLN.x);
  col = mix(col, vec3(1.0, 0.95, 0.7), light * front);
  col = mix(col, vec3(1.0, 0.1, 0.08), light * back);
  gl_FragColor = vec4(mix(col, vFog.rgb, comicPoster(vFog.a, 4.0)), 1.0);
}`;

// Roof props: boxes (plant rooms and air conditioners), water towers, masts and gardens. aPart: 0 plain, 2 fan top,
// 3 wood staves, 4 leaves, 5 metal, 6 lamp head, 7 lamp pole.
const PROP_VS = /* glsl */ `
${VERTEX_FOG}
varying float vDepth;
attribute float aPart;
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
  vDepth = shadowDepthAt(w.xyz + vec3(n.x, 0.0, n.z));
  fogVertex(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const PROP_FS = /* glsl */ `
${COMMON_FS}
varying vec4 vFog;
varying float vDepth;
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
  vec3 alb = vC * mix(vec3(0.9), vec3(1.1), vHash);
  int part = int(vPart + 0.5);
  float fp = length(fwidth(vL)) + 1e-4;
  float ink = 0.0;
  float L = comicLight(N, uSunDir) * sunT(vDepth);
  float band = comicBand(L, 0.12, 0.5);
  if (part == 2) {
    // boxes: plant rooms (big) with a door and louvres; air conditioners (small) with grilles and a fan on top
    bool big = vS.x > 2.4;
    vec3 m = vL * vS;
    vec3 mfw = fwidth(m) + 1e-4;
    float d = 1.0 - smoothstep(0.03, 0.1, max(mfw.x, max(mfw.y, mfw.z)));
    alb = big ? mix(vec3(0.6, 0.52, 0.5), vec3(0.46, 0.5, 0.56), step(0.5, vHash)) : vec3(0.5, 0.5, 0.58);
    if (vLN.y > 0.5) {
      if (!big) alb *= mix(0.5, 1.0, smoothstep(0.34 - fp, 0.34 + fp, length(vL.xz)));
    } else if (vLN.y > -0.5) {
      float h = abs(vLN.z) > 0.5 ? m.x : m.z;
      if (big) {
        float door = step(abs(h), 0.5) * step(m.y, 2.1) * step(vLN.z, -0.5);
        alb = mix(alb, vec3(0.16, 0.2, 0.3), door);
        float louv = step(vS.y - 0.9, m.y) * step(m.y, vS.y - 0.2) * step(abs(h), 0.9) * step(0.5, vLN.x);
        alb *= 1.0 - louv * mix(0.25, 0.45 * step(0.5, fract(m.y / 0.12)), d);
      } else {
        alb *= mix(0.9, 0.7 + 0.3 * step(0.5, fract(h / 0.09)), d * step(0.25, m.y) * step(m.y, vS.y - 0.15));
      }
    }
    // ink on the edges of the box faces: the distance to the two edges of each face, in metres
    vec3 an = abs(vLN);
    float ex = (0.5 - abs(vL.x)) * vS.x, ez = (0.5 - abs(vL.z)) * vS.z, ey = min(vL.y, 1.0 - vL.y) * vS.y;
    float de = an.y > 0.5 ? min(ex, ez) : an.x > 0.5 ? min(ez, ey) : min(ex, ey);
    ink = 1.0 - smoothstep(1.05, 2.4, de / max(length(fwidth(vW)) * 0.6, 1e-4));
  } else if (part == 3) {
    // wooden staves and steel hoops
    float a = atan(vL.z, vL.x) * 12.0;
    float st = mix(0.5, smoothstep(0.1, 0.4, abs(fract(a) - 0.5)), 1.0 - smoothstep(0.2, 0.6, fwidth(a)));
    float hoop = step(0.85, fract(vL.y * 2.2));
    alb = mix(vec3(0.55, 0.36, 0.25) * (0.85 + 0.2 * st), vec3(0.16, 0.12, 0.2), hoop * (1.0 - smoothstep(0.2, 0.5, fp * 2.2)));
  } else if (part == 4) {
    alb = vC * (0.8 + 0.4 * step(0.5, vnoise(vW.xz * 2.0 + vW.y)));
  }
  vec3 col = comicCel(alb, band);
  // a lamp head: its glass glows warm underneath
  if (part == 6) col = mix(col, vec3(1.0, 0.82, 0.4), step(vLN.y, -0.5));
  // thin things (masts, poles, tower legs) take a dark rim where they turn away from the eye
  float rim = part == 5 || part == 7 ? 1.0 - smoothstep(0.2, 0.5, abs(dot(N, normalize(cameraPosition - vW)))) : 0.0;
  col = mix(col, INKC, clamp(max(ink, rim * 0.8), 0.0, 1.0));
  gl_FragColor = vec4(mix(col, vFog.rgb, comicPoster(vFog.a, 4.0)), 1.0);
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
${COMMON_FS}
uniform float uKing;
varying float vOn;
varying vec3 vW;
void main() {
  vec3 c = vec3(1.0, 0.12, 0.06) * vOn;
  gl_FragColor = vec4(mix(c, fogMix(c, vW, 1.0), 0.35), 1.0);
}`;

// The far skyline and the hills round the lake: layered violet silhouettes with a few lit windows, in print-like haze.
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
${COMMON_FS}
varying vec4 vFog;
varying vec3 vW;
varying vec3 vN;
varying float vKind;
void main() {
  vec3 N = normalize(vN);
  float band = comicBand(comicLight(N, uSunDir), 0.12, 0.5);
  vec3 col;
  if (vKind < 0.5) {
    // towers: cel walls, warm dots while they are big enough to see
    vec2 c = vec2((vW.x + vW.z) / 5.0, vW.y / 4.0);
    vec2 fw = fwidth(c);
    float wallF = step(abs(N.y), 0.5);
    float det = (1.0 - smoothstep(0.25, 0.6, max(fw.x, fw.y))) * wallF;
    float lit = mix(0.12, step(0.84, hash12(floor(c))), det) * step(4.0, vW.y) * wallF;
    col = comicCelX(vec3(0.3, 0.26, 0.5), band, vec3(1.5, 1.15, 0.8), vec3(0.08, 0.03, 0.0));
    col = mix(col, vec3(1.0, 0.8, 0.36), lit * 0.8);
  } else {
    col = comicCelX(vec3(0.24, 0.24, 0.42), band, vec3(1.4, 1.1, 0.8), vec3(0.06, 0.025, 0.0));
  }
  gl_FragColor = vec4(mix(col, vFog.rgb, min(comicPoster(vFog.a, 4.0), 0.75)), 1.0);
}`;

/* ---------------- the diorama (spec §9: shared geometry, a simple unlit material, no fog) ---------------- */
// Toy colours in three flat tones, with an ink line on every edge.
const DIO_BUILD_VS = /* glsl */ `
attribute vec4 aInfo;
attribute vec4 aEdge;
attribute float aDist;
uniform float uClog[6];
varying vec3 vN;
varying vec4 vInfo;
varying vec4 vEdge;
varying float vClog;
void main() {
  vN = normal; vInfo = aInfo; vEdge = aEdge;
  vClog = uClog[int(aDist + 0.5)];
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const DIO_BUILD_FS = /* glsl */ `
${GLSL.posterize}${GLSL.halftone}${GLSL.ink}${GLSL.toon}
uniform float uClog[6];
varying vec3 vN;
varying vec4 vInfo;
varying vec4 vEdge;
varying float vClog;
const vec3 INKC = ${hexv(INK)};
void main() {
  vec3 N = normalize(vN);
  float code = mod(floor(vInfo.x + 0.5), 16.0);
  int k = int(code - step(7.5, code) * 8.0 + 0.5);
  vec3 c = k == 0 ? vec3(0.34, 0.5, 0.66) : k == 1 ? vec3(0.9, 0.66, 0.24) : k == 2 ? vec3(0.72, 0.3, 0.2) : k == 3 ? vec3(0.82, 0.72, 0.6) : k == 4 ? vec3(0.6, 0.58, 0.64) : vec3(0.6, 0.34, 0.24);
  float l = N.y > 0.5 ? 0.66 : max(dot(N, normalize(vec3(-0.5, 0.35, 0.8))), 0.0);
  c = comicCel(c, comicBand(l, 0.12, 0.5));
  c = mix(c, vec3(dot(c, vec3(0.3, 0.5, 0.2))) * vec3(0.7, 1.0, 0.45), vClog * 0.55);
  vec4 ge = sqrt(dFdx(vEdge) * dFdx(vEdge) + dFdy(vEdge) * dFdy(vEdge));
  vec4 pe = vEdge / max(ge, vec4(1e-6));
  float dp = min(min(pe.x, pe.y), min(pe.z, pe.w));
  c = mix(c, INKC, 1.0 - smoothstep(0.9, 2.1, dp));
  gl_FragColor = vec4(c, 1.0);
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
${NOISE_FN}
${GLSL.posterize}${GLSL.halftone}${GLSL.ink}${GLSL.toon}
${GROUND_PATTERN}
uniform vec3 uWater;
varying vec3 vN;
varying vec3 vP;
varying float vKind;
void main() {
  vec3 N = normalize(vN);
  vec3 c;
  if (vKind > 1.5) c = uWater * 1.4;
  else if (N.y < 0.5) c = vec3(0.24, 0.17, 0.3);
  else {
    vec2 fw = fwidth(vP.xz);
    float fp = max(max(fw.x, fw.y), 0.4) * 2.0;
    c = comicCel(groundAlbedo(vP, N, fp), 2.0);
    c = mix(c, vec3(0.08, 0.04, 0.09), clamp(gInk, 0.0, 1.0));
  }
  gl_FragColor = vec4(c, 1.0);
}`;
const DIO_LAND_FS = /* glsl */ `
${GLSL.posterize}${GLSL.halftone}${GLSL.ink}${GLSL.toon}
uniform vec4 uLand;
varying vec3 vN;
varying vec3 vP;
varying float vKind;
void main() {
  // the expressway runs on past the land in the city; the model stops at its edge
  if (vP.x < uLand.x || vP.x > uLand.z) discard;
  vec3 N = normalize(vN);
  int k = int(vKind + 0.5);
  vec3 c = k <= 11 || k == 13 || k == 14 ? vec3(0.8, 0.76, 0.84) : k == 12 ? vec3(1.0, 0.78, 0.4) : k == 16 || k == 17 ? vec3(0.92, 0.9, 0.96) : k == 21 ? vec3(0.95, 0.72, 0.3) : vec3(0.56, 0.54, 0.64);
  float l = N.y > 0.5 ? 0.66 : max(dot(N, normalize(vec3(-0.5, 0.35, 0.8))), 0.0);
  gl_FragColor = vec4(comicCel(c, comicBand(l, 0.12, 0.5)), 1.0);
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
  vC = aPart < 0.5 ? vec3(0.32, 0.22, 0.22) : aTc.rgb;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aT.xyz + p, 1.0);
}`;
const DIO_TREE_FS = /* glsl */ `
${GLSL.posterize}${GLSL.halftone}${GLSL.ink}${GLSL.toon}
varying vec3 vC;
varying vec3 vN;
void main() {
  vec3 N = normalize(vN);
  float l = max(dot(N, normalize(vec3(-0.5, 0.35, 0.8))), 0.0) + 0.2 * N.y;
  gl_FragColor = vec4(comicCel(vC, comicBand(l, 0.12, 0.5)), 1.0);
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
// The four edge distances of a quad (from the start side, the end side, the bottom, the top), BIG where an edge draws no line.
// v is the quad's first vertex: (start, bottom), (end, bottom), (end, top), (start, top).
function edgeQuad(b, v, w, h, fs, fe, fb, ft) {
  const B = BIG;
  av(b, "aEdge", v, fs ? 0 : B, fe ? w : B, fb ? 0 : B, ft ? h : B);
  av(b, "aEdge", v + 1, fs ? w : B, fe ? 0 : B, fb ? 0 : B, ft ? h : B);
  av(b, "aEdge", v + 2, fs ? w : B, fe ? 0 : B, fb ? h : B, ft ? 0 : B);
  av(b, "aEdge", v + 3, fs ? 0 : B, fe ? w : B, fb ? h : B, ft ? 0 : B);
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
  // a 1 x 1 stand-in for the art textures, so the samplers are bound before the files arrive
  const blankTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blankTex.needsUpdate = true;
  renderer.initTexture(blankTex);

  /* ---- shared uniforms ---- */
  const sunLen = Math.hypot(SUN_DIR.x, SUN_DIR.z);
  const clogNow = new Float32Array(6), clogWant = new Float32Array(6);
  const U = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z) },
    uSunXZ: { value: new THREE.Vector2(SUN_DIR.x / sunLen, SUN_DIR.z / sunLen) },
    // the art (art/sky.webp, art/windows.webp) arrives later; until then (or if a file fails) the shaders draw the procedural look
    uSky: { value: blankTex }, uHaveSky: { value: 0 },
    // the strip's sun sits at u = SKY_SUN_U: shift the azimuth so it lands on SUN_DIR
    uSkyU: { value: SKY_SUN_U - Math.atan2(-SUN_DIR.x, SUN_DIR.z) / (Math.PI * 2) },
    uWin: { value: blankTex }, uHaveWin: { value: 0 },
    uInkS: { value: 1 },
    // fog (spec §9): it starts at PERF.fogNear and hides 90 % by PERF.fogFar at street level; thinner higher up
    uFog: { value: new THREE.Vector3(PERF.fogNear, Math.LN10 / (PERF.fogFar - PERF.fogNear), 110) },
    uMap: { value: null }, uMapBox: { value: new THREE.Vector4(MAP.x0, MAP.z0, 1 / (MAP.nx * MAP.cell), 1 / (MAP.nz * MAP.cell)) },
    uClog: { value: clogNow },
    uKing: { value: 0 }, uFinale: { value: 0 },
    uWater: { value: col3(COLORS.water) },
  };
  const pick = (...names) => Object.fromEntries(names.map((n) => [n, U[n]]));
  const COMMON_U = ["uTime", "uSunDir", "uSunXZ", "uFog", "uMap", "uMapBox", "uSky", "uHaveSky", "uSkyU", "uInkS"];

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
  // low: window tiles fade to flat blocks sooner, and no dots or sky mirrors on the walls, for a slower GPU
  const facadeMat = mat(FACADE_VS, FACADE_FS, { ...pick(...COMMON_U, "uClog", "uFinale"), uWin: U.uWin, uHaveWin: U.uHaveWin }, { defines: low ? { LOW: 1, DETAIL0: "0.14", DETAIL1: "0.34", NEAR0: "0.03", NEAR1: "0.06" } : { DETAIL0: "0.2", DETAIL1: "0.5", NEAR0: "0.05", NEAR1: "0.1" } });
  const landMat = mat(LANDMARK_VS, LANDMARK_FS, { ...pick(...COMMON_U, "uKing", "uFinale"),
    uNeedle: { value: new THREE.Vector4(N0.x, N0.z, N0.podY0, 0) }, uDome: { value: new THREE.Vector4(D0.x, D0.z, D0.r, X0.z) } });
  const landInk = mat(LANDMARK_HULL_VS, LANDMARK_HULL_FS, { ...pick(...COMMON_U), uInkK: inkK, uInkPx: { value: INK_PX }, uInkW: { value: 0 } }, { side: THREE.BackSide });
  const groundMat = mat(GROUND_VS, GROUND_FS, { ...pick(...COMMON_U, "uClog"), ...GU });
  const waterMat = mat(GROUND_VS, WATER_FS, pick(...COMMON_U, "uWater"));
  const skyMat = mat(SKY_VS, SKY_FS, pick(...COMMON_U), { side: THREE.BackSide, depthWrite: false });
  // instanced meshes get an ink twin: the same geometry drawn again as back faces pushed out along the normals
  const hullU = { uInkK: inkK, uInkPx: { value: INK_PX }, uInkW: { value: 0 } };
  const twinMat = (vs, fs, uniforms, defines = {}) => mat(vs, fs, { ...uniforms, ...hullU }, { side: THREE.BackSide, defines: { ...defines, OUTLINE: 1 } });
  const treeMat = mat(TREE_VS, TREE_FS, pick(...COMMON_U));
  const treeInk = twinMat(TREE_VS, TREE_FS, pick(...COMMON_U));
  const carU = { ...pick(...COMMON_U), uHalf: { value: new THREE.Vector3(2.2, 0.88, 0.62) } };
  const tramU = { ...pick(...COMMON_U), uHalf: { value: new THREE.Vector3(15, 1.3, 0.9) } };
  const carMat = mat(CAR_VS, CAR_FS, carU);
  const carInk = twinMat(CAR_VS, CAR_FS, carU);
  const tramMat = mat(CAR_VS, CAR_FS, tramU, { defines: { STREETCAR: 1 } });
  const tramInk = twinMat(CAR_VS, CAR_FS, tramU, { STREETCAR: 1 });
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
  // parts 0-7: across the rows, eighths of the map; parts 8-15: along the columns, straight into the texture
  function packMap(part) {
    const nx = MAP.nx, nz = MAP.nz, h = Math.ceil(nz / 8), k0 = (part % 8) * h, k1 = Math.min(nz, k0 + h);
    if (part < 8) {
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
    if (part === 15) mapTex.needsUpdate = true;
  }

  /* ---------------- 4. the Needle, the Dome, the expressway ---------------- */
  const beacons = [];
  const lb = Buf({ aKind: 1 }, 16384);
  const needleBuffer = Buf({ aKind: 1 }, 16384);
  // the King's perch: a gold plinth on the pod roof, on the side that faces the start (known before the build)
  const perchR = 9.5, perchA = Math.atan2(S0.z - N0.z, S0.x - N0.x);
  perch.x = N0.x + Math.cos(perchA) * perchR; perch.z = N0.z + Math.sin(perchA) * perchR; perch.y = N0.podY1 + 1.1;
  perch.yaw = Math.atan2(-(S0.x - perch.x), -(S0.z - perch.z));
  function buildNeedle(part) {
    const b = needleBuffer;
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
    // A tapered observation saucer with two continuous glazing bands and a thin crown.
    lathe(b, [[N.shaftR, dy - 5, 11], [pr - 2, p0 + .2, 11],
      [pr + .3, p0 + 3, 13], [pr + .3, p0 + 3.6, 12], [pr + .3, p0 + 9, 12],
      [pr + .65, p0 + 9.3, 13], [pr + .65, p0 + 10.1, 13],
      [pr + .1, p0 + 10.5, 12], [pr - .6, p0 + 17.5, 12],
      [pr - 1, p0 + 18.2, 13], [pr - 2.5, p1 - 1, 11],
      [pr - 4.5, p1, 11], [4, p1, 11], [3.4, p1 + .6, 14]], 96, N.x, N.z);
    // Upper SkyPod, steel mast shoulders and the red-white broadcast antenna.
    lathe(b, [[3.4, p1 + .6, 10], [3.0, 310, 10], [5.8, 311.5, 13],
      [6.2, 313, 12], [6.2, 315.2, 12], [5.4, 316, 13],
      [2.7, 317, 14], [2.3, 325, 14], [1.5, 326, 14],
      [1.05, N.top - 4, 14], [.22, N.top, 14]], 48, N.x, N.z);
    lathe(b, [[5.2, p1, 21], [5.2, p1 + 0.6, 21], [4.6, p1 + 1.1, 21], [0, p1 + 1.1, 21]], 24, perch.x, perch.z);
    for (const y of [300, 322.6, 341, N.top + 0.3]) beacons.push([N.x, y, N.z, 1.4]);
  }
  // three flat legs at the foot of the shaft, in the Needle's own style
  function needleLegs(b, N, R) {
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * Math.PI * 2 + 0.3, ca = Math.cos(a), sa = Math.sin(a), th = 0.8;
      const px = -sa * th, pz = ca * th; // across the leg
      const P = (r, y, side) => [N.x + ca * r + px * side, y, N.z + sa * r + pz * side];
      const top = N.deck.y - 9, rOut = (y) => R + 8.5 * Math.pow(1 - y / top, 1.7);
      const steps = 18;
      for (let s = 0; s < steps; s++) {
        const ya = (s / steps) * top, yb = ((s + 1) / steps) * top, ra = rOut(ya), rb = rOut(yb);
        const nOut = [ca, (ra - rb) / (yb - ya), sa], l = Math.hypot(...nOut);
        quad(b, [P(ra, ya, 1), P(ra, ya, -1), P(rb, yb, -1), P(rb, yb, 1)], nOut.map((v) => v / l), { aKind: [10] });
        quad(b, [P(R - 0.5, ya, 1), P(ra, ya, 1), P(rb, yb, 1), P(R - 0.5, yb, 1)], [-sa, 0, ca], { aKind: [10] });
        quad(b, [P(ra, ya, -1), P(R - 0.5, ya, -1), P(R - 0.5, yb, -1), P(rb, yb, -1)], [sa, 0, -ca], { aKind: [10] });
      }
    }
  }
  // Higgsfield 3D Jutsu revision 2. Batch its semantic parts into our landmark
  // shader, preserving sunset reflections, fog and a single draw call.
  async function loadTower(fallback) {
    try {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync(new URL("../models/cn-tower.glb", import.meta.url).href);
      gltf.scene.updateMatrixWorld(true);
      const b = Buf({ aKind: 1 }, 16384), N = N0;
      const levels = [[0,0],[325,N.deck.y-9],[340,N.podY0],[361,N.podY1],[505,322],[553,N.top]];
      const height = y => {
        let i=1; while(i<levels.length-1 && y>levels[i][0]) i++;
        const [a,u]=levels[i-1], [z,v]=levels[i]; return u+(v-u)*(y-a)/(z-a);
      };
      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        const g=o.geometry.clone().applyMatrix4(o.matrixWorld), p=g.attributes.position;
        for(let i=0;i<p.count;i++) {
          const y=p.getY(i);
          const scale=/Tapered_central/.test(o.name) && y<=325 ? N.shaftR/Math.max(.001,Math.hypot(p.getX(i),p.getZ(i))) : N.podR/22;
          p.setXYZ(i,N.x+p.getX(i)*scale,height(y),N.z+p.getZ(i)*scale);
        }
        g.computeVertexNormals();
        const name=o.material.name;
        const kind=/Antenna_band/i.test(o.name)?14:/glass/i.test(name)?12:/graphite/i.test(name)?15:/red/i.test(name)?14:/aluminum/i.test(name)?13:10;
        const normals=g.attributes.normal, offset=b.v;
        reserve(b,p.count,g.index?g.index.count:p.count);
        for(let i=0;i<p.count;i++) {
          const v=vtx(b,p.getX(i),p.getY(i),p.getZ(i),normals.getX(i),normals.getY(i),normals.getZ(i));
          b.x.aKind.a[v]=kind;
        }
        for(let i=0;i<(g.index?g.index.count:p.count);i++) b.i[b.ni++]=offset+(g.index?g.index.getX(i):i);
        g.dispose();o.geometry.dispose();o.material.dispose();
      });
      if(!b.v) throw new Error("CN Tower model contains no mesh");
      // Playable collar ledges, deck and King's perch retain their collision dimensions.
      for(const C of N.collars) lathe(b,[[N.shaftR-.1,C.y-.75,13],[C.r,C.y-.75,13],[C.r,C.y+.75,13],[N.shaftR-.1,C.y+.75,13]],32,N.x,N.z);
      lathe(b,[[N.shaftR,N.deck.y-1,13],[N.deck.r,N.deck.y-1,13],[N.deck.r,N.deck.y,13],[N.shaftR,N.deck.y,13]],64,N.x,N.z);
      lathe(b,[[5.2,N.podY1,21],[5.2,N.podY1+.6,21],[4.6,N.podY1+1.1,21],[0,N.podY1+1.1,21]],24,perch.x,perch.z);
      const mesh=add(new THREE.Mesh(finish(b),landMat));mesh.name="CN Tower Higgsfield";
      root.remove(fallback);staticTris-=fallback.userData.tris;info.meshes--;fallback.geometry.dispose();
    } catch(error) { console.warn("CN Tower model unavailable; retaining built-in tower",error); }
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
  // the ink hull round the Needle, the Dome and the expressway: its own build units, because welding the normals (so the hull
  // stays closed at the hard edges) is a few ms of work
  let landMesh = null, hullSteps = null, hullDone = false;
  function buildLandHull(last) {
    if (hullDone) return;
    hullSteps = hullSteps || smoothNormalsSteps(landMesh.geometry);
    // four units of about 0.4 of the vertex count each (the work is 1.4 of it), so a call that stops on the clock
    // after one of them still moves the progress on; the last unit finishes whatever is left
    if (!hullSteps.step(last ? Infinity : Math.ceil(landMesh.geometry.attributes.position.count * 0.4))) return;
    hullDone = true;
    const hull = new THREE.Mesh(landMesh.geometry, landInk);
    hull.frustumCulled = false;
    hull.onBeforeRender = (r, sc, cam) => syncInk(r, cam);
    landMesh.add(hull);
  }
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
      const fallback = add(new THREE.Mesh(finish(needleBuffer), landMat));
      fallback.name = "CN Tower fallback";
      loadTower(fallback);
      const m = new THREE.Mesh(finish(b), landMat);
      m.frustumCulled = false;
      add(m, 0);
      landMesh = m;
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
    // near-square cells (about 0.8 of the floor height), so the painted window tiles keep their proportions
    const bay = [lerp(2.9, 3.4, r()), 3.2, lerp(3.0, 3.5, r()), lerp(3.4, 3.9, r()), lerp(3.6, 4.2, r()), lerp(4.0, 4.6, r())][k];
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
        av(buf, "aEdge", v + j, BIG, BIG, BIG, BIG);
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
        // fl: ink lines on the edges of the quad: 1 the lo side, 2 the hi side, 4 the bottom, 8 the top
        const wall = (lo, hi, y0, y1, n, fixAt, fl = 0) => {
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
          edgeQuad(buf, v, hi - lo, y1 - y0, tpos ? fl & 1 : fl & 2, tpos ? fl & 2 : fl & 1, fl & 4, fl & 8);
          quadIdx(buf, v);
        };
        const out = [sd.nx, 0, sd.nz];
        // the corners always show an ink line; the foot too, unless this tier stands flush on the one below (one plane, no seam)
        const flushBelow = ti > 0 && sd.fix(T[ti - 1]) === fix;
        wall(a0, a1, t.y0, t.y1, out, fix, 3 | (flushBelow ? 0 : 4));
        // parapet: the parts of this edge the next tier does not stand flush on
        let spans = [[a0, a1]];
        if (next && sd.fix(next) === fix) {
          const c0 = sd.a0(next), c1 = sd.a1(next);
          spans = [[a0, c0], [c1, a1]].filter(([p, q]) => q - p > 0.05);
        }
        const ew = sd.nx !== 0; // east and west strips stop short of the corners
        for (const [p, q] of spans) {
          wall(p, q, t.y1, t.y1 + ph, out, fix, (p <= a0 + 0.01 ? 1 : 0) | (q >= a1 - 0.01 ? 2 : 0) | 4 | 8);
          const lo = Math.max(p, a0 + th), hi = Math.min(q, a1 - th);
          const inFix = fix - sd.nx * th - sd.nz * th;
          if (hi > lo) wall(lo, hi, t.y1, t.y1 + ph, [-sd.nx, 0, -sd.nz], inFix, 4 | 8);
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
  // ink: a material for the outline twin (the same geometry and instances, drawn again as pushed-out back faces)
  function instancedMesh(base, attrs, max, material, order = 0, ink = null) {
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
    let twin = null;
    if (ink) {
      twin = new THREE.Mesh(g, ink);
      twin.frustumCulled = false;
      twin.visible = false;
      twin.onBeforeRender = (r, sc, cam) => syncInk(r, cam);
      add(twin, order);
      instMeshes.push(twin);
    }
    return { mesh: m, twin, geo: g, attrs: arrays, n: 0, sent: 0, max };
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
    if (I.twin) I.twin.visible = I.n > 0;
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
    trees = instancedMesh(treeGeometry(), { aT: 4, aTc: 4 }, 4200, treeMat, 0, treeInk);
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
    const cg = finish(cb);
    smoothNormals(cg); // welded normals, so the hard-edged car body keeps a closed ink hull
    cars = instancedMesh(cg, { aLane: 4, aMove: 4, aColor: 3 }, 1800, carMat, 0, carInk);
    const tb = Buf({ aPart: 1 }, 64);
    addGeo(tb, new THREE.BoxGeometry(30, 3.2, 2.6), M.makeTranslation(0, 1.9, 0), 0);
    const tg = finish(tb);
    smoothNormals(tg);
    trams = instancedMesh(tg, { aLane: 4, aMove: 4, aColor: 3 }, 40, tramMat, 0, tramInk);
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
  const chunkBuf = Buf({ aInfo: 4, aFace: 4, aEdge: 4, aDist: 1 }, 8192);
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
  for (let i = 0; i < 16; i++) unit("pack", 0.05, () => packMap(i), true);
  for (let i = 0; i < 8; i++) unit("layout", 0.3, () => layoutTrees(i), true);
  for (let i = 0; i < 3; i++) unit("needle", 0.5, () => buildNeedle(i), true);
  unit("dome", 0.5, buildDome, true);
  for (let i = 0; i < 3; i++) unit("xway", 0.4, () => { buildXway(i); if (i === 2) flushBeacons(); }, true);
  for (let i = 0; i < 4; i++) unit("hull", 0.075, () => buildLandHull(i === 3), true);
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
  const stats = { calls: 0, maxMs: 0, totalMs: 0, units: {}, last: [] }; // last: the units the latest build() call ran
  const V = {
    root,
    progress: 0,
    startReady: false,
    info,
    perch,
    stats,
    // which art files arrived (art/sky.webp, art/windows.webp): the tests read this
    art: { loaded: false, sky: false, windows: false },
    // Builds a few units per call within the time budget and a hard count (the clock can stand still in tests).
    build(budgetMs = 6) {
      if (next >= units.length) return true;
      const t0 = performance.now();
      stats.last.length = 0;
      for (let n = 0; n < MAX_UNITS && next < units.length; n++) {
        const u = units[next];
        stats.last.push(u.name);
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
      // ink lines are a few pixels wide: a touch wider on the headset's finer pixels and on a big flat window
      renderer.getDrawingBufferSize(inkSize);
      U.uInkS.value = renderer.xr.isPresenting ? 1.15 : clamp(inkSize.y / 540, 1, 1.5);
    },
    setDistrictClog(id, v) { if (id >= 0 && id < 6) clogWant[id] = clamp(+v || 0, 0, 1); },
    setKing(v) { kingWant = clamp(+v || 0, 0, 1); },
    setFinale(v) { finaleWant = clamp(+v || 0, 0, 1); },
    // Jumps the eased tints (clogs, King, finale) to their targets at once: for the tests, and for a cut between scenes.
    snap() { clogNow.set(clogWant); U.uKing.value = kingWant; U.uFinale.value = finaleWant; },
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
    // The sky colour in a direction (a THREE.Vector3 or {x, y, z}), read from the same painted strip (or the same banded ramp).
    skyColorAt(dir, out = new THREE.Color()) { return skyJS(dir, out); },
  };
  let kingWant = 0, finaleWant = 0;
  const inkSize = new THREE.Vector2();

  /* ---- the art: each file is optional; without it the shaders draw the procedural comic look ---- */
  // 512 x 110 pixels of the strip, for skyColorAt
  const SKY_W = 512, SKY_H = 110;
  let skyPix = null;
  function readSky(img) {
    try {
      const c = document.createElement("canvas");
      c.width = SKY_W; c.height = SKY_H;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, SKY_W, SKY_H);
      skyPix = g.getImageData(0, 0, SKY_W, SKY_H).data;
    } catch (e) { skyPix = null; }
  }
  loadArt(renderer).then((art) => {
    if (art.sky) { U.uSky.value = art.sky; U.uHaveSky.value = 1; readSky(art.sky.image); V.art.sky = true; }
    if (art.windows) { U.uWin.value = art.windows; U.uHaveWin.value = 1; V.art.windows = true; }
    V.art.loaded = true;
  }).catch((e) => { console.warn("cityview art:", e && e.message); V.art.loaded = true; });

  // JS twin of the sky in the shaders
  const RAMP = [[1, 0.72, 0.22], [1, 0.478, 0.165], [0.847, 0.271, 0.478], [0.55, 0.2, 0.55], [0.32, 0.16, 0.52], hexf(PAL.zenith)];
  const ZEN = hexf(PAL.zenith);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function skyJS(dir, out) {
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1, nx = dir.x / l, ny = dir.y / l, nz = dir.z / l;
    const el = Math.asin(clamp(ny, -1, 1)) * 0.7958;
    if (skyPix) {
      let u = Math.atan2(-nx, nz) / (Math.PI * 2) + U.uSkyU.value;
      u -= Math.floor(u);
      const xi = Math.min(SKY_W - 1, Math.floor(u * SKY_W)), yi = Math.min(SKY_H - 1, Math.floor((1 - clamp(el, 0, 1)) * SKY_H)), o = (yi * SKY_W + xi) * 4;
      const zt = ss(0.86, 1.1, el);
      return out.setRGB(lerp(skyPix[o] / 255, ZEN[0], zt), lerp(skyPix[o + 1] / 255, ZEN[1], zt), lerp(skyPix[o + 2] / 255, ZEN[2], zt));
    }
    const y = Math.max(ny, 0), hl = Math.hypot(nx, nz) || 1;
    const toward = ((nx / hl) * U.uSunXZ.value.x + (nz / hl) * U.uSunXZ.value.y) * 0.5 + 0.5;
    const t = clamp(Math.pow(y, 0.55) + (1 - toward) * 0.24 * (1 - y), 0, 1);
    const c = RAMP[Math.round(t * 5)];
    return out.setRGB(c[0], c[1], c[2]);
  }

  return V;
}
