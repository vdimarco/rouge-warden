// Shared draw and resolve shaders extracted from Inkwell Rebirth's WebGL renderer.
// Hosts provide the ASCII shader hooks and Ink Studio's shared PixelLook GLSL.
import { waterGLSL } from './water-optics.mjs';

export function splatShaderSources(ascii, sampleCoverage, { water = false } = {}) {
  const SPLAT_VS = `#version 300 es
precision highp float; precision highp int;
uniform highp sampler2D u_data;
uniform mat4 u_view, u_proj;
uniform vec2 u_viewport;
uniform float u_focal, u_time, u_scale, u_snap, u_dilate, u_near, u_ortho, u_idx;
uniform vec4 u_actor; uniform float u_reveal, u_fade; uniform vec3 u_camdir; uniform ivec2 u_dyn;
uniform vec4 u_rev, u_rbox;   // the lit part of the world: centre x, z, sin and cos of the view's turn; then near, far, near half-width, far half-width
uniform vec4 u_sh[16]; uniform int u_shn;
uniform vec4 u_wc[4]; uniform vec4 u_wd[4];   // where a blow is about to land: painted on the ground itself (a disc that fills, or a lane), so grass cannot hide it
uniform vec4 u_hitf[4]; uniform vec3 u_fl[8];   // places just struck (a ball each), and bodies just hurt (a run of splats each): both go white for an instant
uniform highp sampler2D u_eco; uniform highp sampler2D u_bones; uniform float u_ecoOn;   // what the ground remembers, a texel to each unit of it: burnt, burning, frozen, and how high the ground is there   // round shadows: x, z, ground height, radius
uniform vec2 u_season;   // how far autumn, and how far winter, has come
${sampleCoverage ? 'uniform float u_sampleWithdrawal;\n'+sampleCoverage.glsl : ''}
uniform vec4 u_born;   // growth you can watch: when the diorama was shown, how fast its clock runs, how long a dab takes to grow, and the loop (0: once)
uniform vec2 u_cut;       // how wide a view is cleared between you and the eye, and how low it reaches
uniform float u_wl, u_slice; uniform vec2 u_lid; uniform vec4 u_pit; uniform vec4 u_portal; uniform vec2 u_pdoor; uniform vec3 u_eye;   // a doorway standing square to z (centre x, sill y, z, and which side of it this place is on), its half-width and height, and where the eye is
uniform vec3 u_fog;
uniform vec4 u_fogp;   // haze start, haze max, depth range near, depth range far
layout(location=0) in vec2 a_corner;
layout(location=1) in int a_index;
out vec2 v_d; out vec3 v_conic; out vec4 v_color; out float v_depth; flat out float v_ownerDepth;
out float v_gl; out float v_as; out float v_ast; uniform vec4 u_az[4]; uniform int u_azn; uniform float u_asoft, u_azst;
${water ? 'flat out float v_waterAxial;' : ''}
${ascii ? ascii.vsDecl : ''}// Inked detail (an option, off unless asked for): a dab may carry a 4 by 4 picture of the surface under it. Its two half-axes are
// carried to the screen here and turned inside out, so each pixel can find where on the surface it is looking.
uniform highp sampler2D u_fine; uniform float u_fineOn;
// Carried lights (the game's lantern, things on fire): where each is and how far it reaches, how strong, the palette, and for each palette
// colour the next lighter one of its own family. What is near a light steps up its own colours; nothing is tinted.
uniform vec4 u_lamp[8]; uniform float u_lamps[8]; uniform int u_lampN; uniform float u_lampGain; uniform vec3 u_lpal[48]; uniform int u_lup[48];
flat out vec4 v_fm; flat out vec4 v_ft; flat out float v_fk; flat out float v_lit; flat out float v_ix;
void main(){
  int row = a_index >> 9, col = (a_index & 511) << 2; v_ix = float(a_index);
  vec4 t0 = texelFetch(u_data, ivec2(col, row), 0);
  vec4 t1 = texelFetch(u_data, ivec2(col + 1, row), 0);
  vec4 t2 = texelFetch(u_data, ivec2(col + 2, row), 0);
  vec4 t3 = texelFetch(u_data, ivec2(col + 3, row), 0);
  vec3 pos = t0.xyz; float alpha = t0.w;
  if (alpha <= 0.0 || pos.y < -30.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // (what is put away is put far below: it is not drawn from there)
  mat3 cov = mat3(t1.x, t1.y, t1.z,  t1.y, t2.x, t2.y,  t1.z, t2.y, t2.z);
  vec3 color = vec3(mod(t1.w, 256.0), mod(floor(t1.w / 256.0), 256.0), floor(t1.w / 65536.0)) / 255.0;
  vec3 color0 = color; mat3 FM = mat3(1.0); v_fk = -1.0; v_lit = 0.0; v_fm = vec4(0.0); v_ft = vec4(0.0);
  int kraw = int(t2.w), flags = kraw / 16, kind = kraw - flags * 16;
  ${sampleCoverage ? 'if (!sampleCoverageVisible(kraw, u_sampleWithdrawal)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }' : ''}
  float ph = t3.x, sp = t3.y, rg = t3.z, ex = t3.w, sc = u_scale;
  bool snap = false, stat = a_index < u_dyn.x || a_index >= u_dyn.y, pv = (flags & 8) != 0, green = (flags & 2) == 0 && color.g - max(color.r, color.b) > 0.06, veg = green || (flags & 6) == 0 && color.b - color.g > 0.15 && color.r - color.g > 0.08, fire = false;   // what grows: green things, and the purple grass
  if (u_ecoOn > 0.5 && stat && !pv && abs(t0.x) < 80.0 && t0.z > -208.0 && t0.z < 80.0) {
    vec4 eco = texelFetch(u_eco, ivec2(clamp(floor(t0.xz) + vec2(80.0, 208.0), vec2(0.0), vec2(159.0, 287.0))), 0);
    float hb = fract(sin(dot(floor(t0.xyz / 0.4), vec3(27.1, 61.7, 13.3))) * 4375.85), up = t0.y - (eco.a * 25.5 - 8.0);
    if ((flags & 4) != 0) { if (eco.b > hb * 0.8 + 0.1) { float h2 = fract(hb * 17.3), lm = dot(color, vec3(0.3, 0.59, 0.11)); kind = 0;   // water under frost: ice, still, with pale cracks in it
        color = h2 < 0.1 ? vec3(0.54, 0.52, 0.58) : lm < 0.34 || h2 < 0.7 ? vec3(0.56, 0.77, 0.96) : vec3(0.96, 0.95, 0.92); } }
    else if (eco.g > 0.9 && veg) { float fl = fract(hb * 7.0 + u_time * (2.0 + hb * 3.0)); fire = true; flags = flags | 2;   // alight
      color = fl < 0.33 ? vec3(1.0, 0.82, 0.29) : fl < 0.7 ? vec3(0.94, 0.54, 0.14) : vec3(0.72, 0.31, 0.10); }
    else if (eco.r > hb * 0.9 + 0.05 && (flags & 2) == 0) {   // burnt: leaves are gone, grass is black stubble, and everything else there is sooted
      if (veg) { if (up > 1.1) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } veg = false; green = false; sc *= 0.72;
        color = eco.g > 0.1 && fract(hb * 13.0 + u_time * 0.7) < 0.12 ? vec3(0.94, 0.54, 0.14) : hb < 0.5 ? vec3(0.07, 0.06, 0.07) : vec3(0.17, 0.13, 0.12); }
      else color *= 0.5; }
    else if (veg && eco.b > hb * 0.8 + 0.1 && up < 1.2) { float lm = dot(color, vec3(0.3, 0.59, 0.11)); veg = false; green = false; color = lm < 0.45 ? vec3(0.54, 0.52, 0.58) : lm < 0.62 ? vec3(0.56, 0.77, 0.96) : vec3(0.96, 0.95, 0.92); }   // rime on the grass
  }
  if (kind == 1) { alpha *= 0.62 + 0.38 * sin(u_time * sp + ph); snap = u_snap > 0.5; }                      // twinkle
  else if (kind == 2) { float pr = fract(u_time * sp / rg + ph); pos.y -= pr * rg; alpha *= 1.0 - pr * pr; sc *= 1.0 + pr * ex; }   // fall
  else if (kind == 3) { float pr = fract(u_time * sp / rg + ph); pos.y += pr * rg; pos.x += sin(pr * 7.0 + ph * 50.0) * 0.25 * pr;
                        alpha *= (1.0 - pr) * smoothstep(0.0, 0.1, pr); sc *= 0.6 + pr * ex; }                 // rise
  else if (kind == 4) { color += vec3(0.3) * smoothstep(0.75, 1.0, sin(u_time * sp + ph)); }                   // shimmer
  else if (kind == 5) { float a = u_time * sp, c = cos(a), s = sin(a);
                        mat3 R = mat3(c, 0.0, -s,  0.0, 1.0, 0.0,  s, 0.0, c); pos = R * pos; cov = R * cov * transpose(R); FM = R; } // orbit
  else if (kind == 6) { pos.y += sin(u_time * sp + ph) * rg; }                                                 // bob
  else if (kind == 7) { alpha *= 0.82 + 0.18 * sin(u_time * sp + ph); }                                        // glow
  else if (kind == 8) { float f = 0.2 + 0.8 * abs(sin(u_time * sp + ph)); pos.x = rg + (pos.x - rg) * f; pos.z = ex + (pos.z - ex) * f; pos.y += 0.14 * sin(u_time * sp * 0.31 + ph); }   // flap about a pivot
  else if (kind == 9) { pos.xz *= 1.0 + rg * sin(u_time * sp + ph - pos.y * ex); }                                                         // swell about the centre line
  else if (kind == 10) { float q = length(pos.xz), w = min(1.0, q * 0.22); pos.y += rg * w * sin(u_time * sp + ph - q * ex);
                         pos.xz += rg * 0.6 * w * vec2(-pos.z, pos.x) / max(q, 0.01) * sin(u_time * sp * 0.7 + ph - q * ex * 0.6); }                 // writhe outward from the centre
  else if (kind == 11) { pos.x += rg * sin(u_time * sp + pos.y * 1.3 + pos.z * 0.9 + ph); pos.y += rg * 0.6 * sin(u_time * sp * 1.3 + pos.x * 1.1 + ph);
    vec2 dv = pos.xz - u_actor.xy; float q = length(dv); if (u_actor.z > 0.0 && q < u_actor.z && pos.y - u_actor.w < 2.3 && pos.y - u_actor.w > -0.4) { float pf = 1.0 - q / u_actor.z; pos.xz += dv / max(q, 0.05) * pf * pf * 0.5; pos.y -= pf * pf * 0.07; } }
  else if (kind == 12 || kind == 13) { int bi = int(ph + 0.5) * 3; ivec2 bq = ivec2(bi % 768, bi / 768); vec4 b0 = texelFetch(u_bones, bq, 0), b1 = texelFetch(u_bones, bq + ivec2(1, 0), 0), b2 = texelFetch(u_bones, bq + ivec2(2, 0), 0);   // carried by a bone: the splat is kept as it was made, and turned and moved here
                         mat3 A = mat3(b0.x, b1.x, b2.x, b0.y, b1.y, b2.y, b0.z, b1.z, b2.z); vec3 p1 = A * pos + vec3(b0.w, b1.w, b2.w); cov = A * cov * transpose(A); FM = A;
                         if (rg > 0.0) { int ci = int(sp + 0.5) * 3; ivec2 cq = ivec2(ci % 768, ci / 768); vec4 c0 = texelFetch(u_bones, cq, 0), c1 = texelFetch(u_bones, cq + ivec2(1, 0), 0), c2 = texelFetch(u_bones, cq + ivec2(2, 0), 0);   // shared with a second bone: its place is blended
                           p1 = mix(p1, vec3(dot(c0.xyz, pos) + c0.w, dot(c1.xyz, pos) + c1.w, dot(c2.xyz, pos) + c2.w), rg); }
                         pos = p1;
                         if (kind == 13) { pos.x += 0.022 * sin(u_time * 1.9 + pos.y * 1.3 + pos.z * 0.9 + 1.0); pos.y += 0.0132 * sin(u_time * 2.47 + pos.x * 1.1 + 1.0); } }   /* carried, and then stirred by the wind as hair and grass are */
  else if (kind == 15) { float pr = fract(u_time * sp / rg + ph); pos.y -= pr * rg; pos.x += sin(pr * 11.0 + ph * 40.0) * ex; pos.z += cos(pr * 7.0 + ph * 23.0) * ex * 0.6;   // flutter down: a leaf or a flake, swinging as it falls
                         alpha *= smoothstep(0.0, 0.05, pr) * (1.0 - smoothstep(0.92, 1.0, pr)); }
  else if (kind == 14) { float hg = max(0.0, pos.y - ex); pos.x += rg * hg * sin(u_time * sp + ph); pos.z += rg * 0.6 * hg * sin(u_time * sp * 0.73 + ph * 1.7); }   // sways as a whole from its foot (a placed copy: ex is where its foot is)
  if ((flags & 32) != 0) { float gt = (u_time - u_born.x) * u_born.y; if (u_born.w > 0.0) gt = mod(gt, u_born.w); float gs = clamp((gt - ex) / u_born.z, 0.0, 1.0);   // born: not there till its time, then it grows to its size
                           if (gs <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } sc *= gs * (2.0 - gs); }
  else if ((flags & 64) != 0) { float wt = clamp(((u_time - u_born.x) * u_born.y - ex) / 2.0, 0.0, 1.0); color = mix(color, color * vec3(0.58, 0.62, 0.7), wt); }   // wet: from its time on it darkens, as rain soaks it
  // The portal is not a picture. A piece of the other place really stands beyond the ring; of it, only what the eye sees through the
  // ring is drawn, and of this place, whatever lies beyond the ring on that same line of sight is left out.
  if (u_portal.w != 0.0) { bool thr = false; float sg = u_portal.w;
    if ((pos.z - u_portal.z) * sg < -0.12 && (u_eye.z - u_portal.z) * sg > 0.05) { vec3 hp = u_eye + (pos - u_eye) * ((u_eye.z - u_portal.z) / (u_eye.z - pos.z)); thr = abs(hp.x - u_portal.x) < u_pdoor.x && hp.y > u_portal.y && hp.y < u_portal.y + u_pdoor.y; }
    if (pv ? !thr : (thr && stat)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } }
  else if (pv) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // under a roof, the storey over your head is not drawn at all: the cut comes down from above to just over head height, block by block
  if (u_lid.y > 0.0 && !pv) { float hl = fract(sin(dot(floor(pos.xyz / 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453); if (pos.y > u_lid.x + (stat ? 0.0 : 0.9) + (1.0 - u_lid.y) * (7.0 + 3.0 * hl)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } }
  // what moves (an enemy, a barrel, a saw, a rail's lights) is held to the same lit circle as the ground it stands on: nothing shows out in the black where there is no floor
  if (u_reveal > 0.0 && !stat && !pv && u_rbox.x > 0.5) { float hv2 = fract(sin(dot(floor(pos.xyz / 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453); if (clamp((u_rbox.x - distance(pos.xz, u_rev.xy)) / 2.2, 0.0, 1.0) <= hv2 * 0.86 + 0.04) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } }
  if (u_reveal > 0.0 && stat) {
    // The world exists only around you. Scenery stays exactly where it stands and comes up out of black, patch by patch:
    // when its cell arrives, and again at the edge of the lit ground, which trails a little behind as you run.
    // It forms in solid half-unit blocks, not as loose specks: every splat in a block appears at the same moment, low blocks before
    // high ones, so a tree arrives trunk first and its crown in clumps.
    float hv = fract(sin(dot(floor(t0.xyz / 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453), hs = fract(float(a_index) * 0.6180339), yr = clamp(t0.y - u_actor.w, 0.0, 9.0);
    float de = pv ? 9.0 : u_rbox.x - distance(pos.xz, u_rev.xy) - (1.0 - u_fade) * 50.0;   // how far inside the circle of world round you this is
    bool own = kind == 2 || kind == 3 || kind == 8 || kind == 9 || kind == 10 || kind == 14 || kind == 15;   // these use the last number for their own motion, so they carry no arrival time
    float te = min(clamp((de - yr * 0.1) / 2.2, 0.0, 1.0), own ? 1.0 : clamp((u_time - ex) / 0.7 - yr * 0.06, 0.0, 1.0));
    if (te <= hv * 0.86 + 0.04) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // not formed yet: nothing is drawn, so what shows is plain black
    // seasons: everything green turns, a patch at a time: to amber and rust in autumn, to snow in winter
    if (green && !fire && u_season.x + u_season.y > 0.0) {
      float lm = dot(color, vec3(0.3, 0.59, 0.11)), hp = fract(sin(dot(floor(pos.xz / 0.7), vec2(41.3, 17.7))) * 9731.1) * 0.999;
      if (hp < u_season.y) color = lm < 0.3 ? vec3(0.34, 0.31, 0.42) : lm < 0.45 ? vec3(0.54, 0.52, 0.58) : lm < 0.62 ? vec3(0.56, 0.77, 0.96) : vec3(0.96, 0.95, 0.92);
      else if (hp < u_season.x) color = lm < 0.3 ? vec3(0.42, 0.27, 0.15) : lm < 0.45 ? vec3(0.72, 0.31, 0.10) : lm < 0.62 ? vec3(0.94, 0.54, 0.14) : vec3(1.0, 0.82, 0.29);
    }
    // round shadows under whoever is standing on this
    if ((flags & 6) == 0) for (int i = 0; i < 16; i++) { if (i >= u_shn) break; vec4 s4 = u_sh[i]; if (distance(pos.xz, s4.xy) < s4.w && pos.y > s4.z - 0.35 && pos.y < s4.z + 0.55) {   // the shadow is a darker colour of the same family, never a tint that lands on some other hue
      float lm = dot(color, vec3(0.3, 0.59, 0.11)); color = color.g - max(color.r, color.b) > 0.06 ? (lm > 0.62 ? vec3(0.227, 0.478, 0.235) : vec3(0.118, 0.29, 0.204)) : color * 0.45; break; } }
    for (int i = 0; i < 4; i++) { vec4 wc = u_wc[i], wd = u_wd[i]; if (wc.w > 0.0 && abs(pos.y - wc.y - 0.35) < 1.2) { vec2 ab = wd.zw - wc.xz; float tt = wd.y < 0.5 ? 0.0 : clamp(dot(pos.xz - wc.xz, ab) / max(dot(ab, ab), 0.001), 0.0, 1.0), dd = distance(pos.xz, wc.xz + ab * tt);
      if (dd < wc.w) { bool rim = dd > wc.w - 0.2 || (wd.y > 0.5 && (tt < 0.02 || tt > 0.98)), fill = wd.y < 0.5 ? dd < wc.w * wd.x : tt < wd.x; color = rim ? vec3(1.0, 0.64, 0.3) : mix(color, vec3(0.84, 0.17, 0.15), fill ? 0.62 : 0.26); } } }
    // whatever stands between you and the eye is simply not drawn
    vec3 rel = pos - vec3(u_actor.x, u_actor.w + 0.9, u_actor.y); float al = dot(rel, u_camdir), pr2 = length(rel - al * u_camdir);
    vec2 hc = normalize(u_camdir.xz + vec2(0.0, 1e-5));   // (only what is on the eye's side of you: a wall you have your back to is behind you however tall it is, and stays whole)
    if (al > 0.4 && dot(rel.xz, hc) > 0.2 + 0.25 * hs && pos.y > u_actor.w + u_cut.y && pr2 < u_cut.x - 0.4 * hs) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    // and, underground, whatever stands well to the eye's side of you is cut down to knee height right across: the back of the next
    // room's wall, its railings and its statues would otherwise fill the bottom of the picture
    if (u_slice > 0.0 && dot(rel.xz, hc) > u_slice + 0.8 * hv && pos.y > u_actor.w + u_cut.y) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    // What lies under the water (a reflection, the bed) is seen only through water: the line from the eye to it has to cross the
    // surface where there is water, inside the lit circle. Otherwise it would hang in the dark under the edge of the world.
    // And a reflection goes when the thing it is the reflection of has been cut away.
    if (!pv && pos.y < u_wl - 0.02 && u_eye.y > u_wl + 0.1 && !(pos.x > u_pit.x && pos.x < u_pit.y && pos.z > u_pit.z && pos.z < u_pit.w)) { vec3 dd = pos - u_eye; vec2 q = u_eye.xz + dd.xz * ((u_wl - u_eye.y) / dd.y);
      if (distance(q, u_rev.xy) > u_rbox.x - 0.3 || (u_ecoOn > 0.5 && texelFetch(u_eco, ivec2(clamp(floor(q) + vec2(80.0, 208.0), vec2(0.0), vec2(159.0, 287.0))), 0).a * 25.5 - 8.0 > u_wl - 0.03)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec3 rs = vec3(pos.x, 2.0 * u_wl - pos.y, pos.z) - vec3(u_actor.x, u_actor.w + 0.9, u_actor.y); float as2 = dot(rs, u_camdir);
      if ((flags & 1) != 0 && rs.y + 0.9 > u_cut.y && (as2 > 0.4 && length(rs - as2 * u_camdir) < u_cut.x || u_slice > 0.0 && dot(rs.xz, hc) > u_slice)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } }
  }
  cov *= sc * sc;

  vec4 cam = u_view * vec4(pos, 1.0);
  if (cam.z > -u_near) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
${water ? '  v_waterAxial = -cam.z;' : ''}
  vec4 clip = u_proj * cam;
  v_ownerDepth = u_idx > 1.5 ? clip.z / clip.w * 0.5 + 0.5 : 0.0;
  float dn = clamp((-cam.z - u_fogp.z) / (u_fogp.w - u_fogp.z), 0.0, 1.0);
  if (u_lampN > 0 && (flags & 22) == 0 && alpha >= 1.0) {
    float tr = cov[0][0] + cov[1][1] + cov[2][2], pp = tr / 2.4253, add = 0.0;   // (a dab is a disc, thin the way it faces: from its shape, how squarely it faces a light)
    for (int i = 0; i < 8; i++) { if (i >= u_lampN) break; vec4 Lq = u_lamp[i]; vec3 dl = Lq.xyz - pos; float d2 = dot(dl, dl);
      if (d2 < Lq.w * Lq.w) { float fa = 1.0 - sqrt(d2) / Lq.w, nd = sqrt(clamp(dot(dl, (cov - mat3(pp)) * dl) / (-0.5747 * pp * max(d2, 1e-4)), 0.0, 1.0)); add += fa * fa * u_lamps[i] * (0.3 + 0.7 * nd); } }
    if (add > 0.0) { float hb = fract(sin(dot(floor(pos.xyz / 0.22), vec3(12.9898, 78.233, 37.719))) * 43758.5453); int steps = int(floor(add * u_lampGain + (hb - 0.5) * 0.5)); v_lit = clamp(add * 1.8, 0.0, 1.0);   // (how lit it is also goes to the last pass, which shows lit things in the colours they have by day)
      if (steps > 0) { int ci = -1; for (int k = 0; k < 48; k++) { vec3 dc = abs(color - u_lpal[k]); if (max(dc.r, max(dc.g, dc.b)) < 0.004) { ci = k; break; } }
        if (ci >= 0) { if (!stat) steps = min(steps, 1);   /* (whoever carries the light is not washed out by it) */
          for (int k = 0; k < 3; k++) { if (k >= steps) break; ci = u_lup[ci]; } color = u_lpal[ci]; color0 = color; } } } }
  bool plain = color == color0; float fogk = (flags & 2) == 0 && u_fogp.y > 0.0 && u_fogp.x < 1.0 ? smoothstep(u_fogp.x, 1.0, dn) * u_fogp.y : 0.0;   // (smoothstep from 1 to 1 is undefined: some cards give NaN, a black pixel)
  if (fogk > 0.0) color = mix(color, u_fog, fogk);   // distance haze
  vec3 colorF = color;
  v_depth = (flags & 1) != 0 ? -1.0 : dn;
  float iz = -1.0 / cam.z;
  vec2 lim = 1.3 * 0.5 * u_viewport / u_focal;
  float tx = clamp(cam.x * iz, -lim.x, lim.x) / iz, ty = clamp(cam.y * iz, -lim.y, lim.y) / iz;
  // Jacobian of the perspective projection, then covariance into screen space
  mat3 J = u_ortho > 0.5 ? mat3(u_focal, 0.0, 0.0,   0.0, u_focal, 0.0,   0.0, 0.0, 0.0)   // (orthographic: u_focal is pixels to a unit)
    : mat3(u_focal * iz, 0.0, 0.0,   0.0, u_focal * iz, 0.0,   u_focal * tx * iz * iz, u_focal * ty * iz * iz, 0.0);
  mat3 T = J * mat3(u_view);
  mat3 c2 = T * cov * transpose(T);
  float A = c2[0][0] + u_dilate, B = c2[0][1], C = c2[1][1] + u_dilate;
  float det = A * C - B * B;
  if (det <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  v_conic = vec3(C, -B, A) / det;
  vec2 ext = min(3.0 * sqrt(vec2(A, C)), vec2(2048.0));
  vec2 ndc = clip.xy / clip.w;
  if (snap) { vec2 px = floor((ndc * 0.5 + 0.5) * u_viewport) + 0.5; ndc = px / u_viewport * 2.0 - 1.0; }
  vec2 extN = ext * 2.0 / u_viewport;
  if (any(greaterThan(abs(ndc) - extN, vec2(1.0)))) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  v_d = a_corner * ext;
  if (stat) { for (int i = 0; i < 4; i++) { vec4 h4 = u_hitf[i]; if (h4.w > 0.0 && distance(pos, h4.xyz) < h4.w) color = vec3(1.0, 0.97, 0.88); } }
  else { float ai = float(a_index); for (int i = 0; i < 8; i++) { vec3 f3 = u_fl[i]; if (f3.z > 0.0 && ai >= f3.x && ai < f3.y) color = vec3(1.0, 0.97, 0.88); } }
  if (u_fineOn > 0.5 && plain && color == colorF) {   // (a dab that has been recoloured since it was baked, by anything, is drawn plain)
    ivec2 fq = ivec2((a_index & 511) * 3, row); vec4 f1 = texelFetch(u_fine, fq + ivec2(1, 0), 0), f2 = texelFetch(u_fine, fq + ivec2(2, 0), 0);
    if (f2.w > 0.5 && f1.w == t1.w) { vec3 pu = T * (FM * f1.xyz) * sc, pw = T * (FM * f2.xyz) * sc; float dt = pu.x * pw.y - pw.x * pu.y;
      if (abs(dt) > 1e-4 * (abs(pu.x * pw.y) + abs(pw.x * pu.y) + 1e-9)) { v_fm = vec4(pw.y, -pw.x, -pu.y, pu.x) / dt; v_ft = texelFetch(u_fine, fq, 0); v_fk = fogk; } } }
  v_color = vec4(min(color, 1.0), alpha);
  v_gl = (flags & 16) != 0 ? 1.0 : 0.0;   // glass
  v_as = (flags & 128) != 0 ? 1.0 : 0.0; v_ast = v_as > 0.5 ? float(((kraw >> 12) & 1) | (((kraw >> 14) & 1) << 1)) : 0.0;   // text (K.ascii): the dab asks for it (and maybe for a set of its own), or it lies inside a zone (0.5 on the zone's surface)
  for (int i = 0; i < 4; i++) { if (i >= u_azn) break; vec4 z4 = u_az[i]; float zm = clamp(0.5 + (z4.w - distance(pos, z4.xyz)) / (2.0 * u_asoft), 0.0, 1.0); if (zm > v_as) { v_as = zm; v_ast = u_azst; } }

${ascii ? ascii.vsMain : ''}  gl_Position = vec4(ndc + a_corner * extN, 0.0, 1.0);
}`;
  const SPLAT_FS = `#version 300 es
precision highp float;
in vec2 v_d; in vec3 v_conic; in vec4 v_color; in float v_depth; flat in float v_ownerDepth;
in float v_gl; in float v_as; in float v_ast;
${ascii ? ascii.fsDecl : 'uniform float u_gly;\n'}uniform float u_crisp, u_hard;
flat in vec4 v_fm; flat in vec4 v_ft; flat in float v_fk; flat in float v_lit; flat in float v_ix; uniform vec3 u_fpal[64]; uniform vec3 u_fog;
uniform float u_idx;
layout(location=0) out vec4 o;
layout(location=1) out vec4 od;
layout(location=2) out vec4 oa;
${water ? waterGLSL + 'flat in float v_waterAxial; uniform vec2 u_viewport;' : ''}
void main(){
${ascii ? ascii.fsMain : ''}  float power = -0.5 * (v_conic.x * v_d.x * v_d.x + v_conic.z * v_d.y * v_d.y) - v_conic.y * v_d.x * v_d.y;
  if (power > 0.0 || power < -4.5) discard;
  float g = v_color.a * exp(power);
  if (u_idx > 1.5) {
    if (v_color.a < 0.5 || g < 0.38) discard;
    float k = v_ix + 1.0, z = round(clamp(v_ownerDepth, 0.0, 1.0) * 16777215.0);
    o = vec4(mod(k, 256.0), mod(floor(k / 256.0), 256.0), floor(k / 65536.0), 255.0) / 255.0;
    od = vec4(mod(z, 256.0), mod(floor(z / 256.0), 256.0), floor(z / 65536.0), 255.0) / 255.0;
    oa = vec4(0);
    return;
  }
  if (u_idx > 0.5) {   // the index pass (colour per pixel): which solid dab is in front here, its number in three bytes
    if (v_color.a < 1.0 || g < 0.5 || v_depth < 0.0) discard;
    float k = v_ix + 1.0;
    o = vec4(mod(k, 256.0), mod(floor(k / 256.0), 256.0), floor(k / 65536.0), 255.0) / 255.0; od = vec4(0.0); oa = vec4(0.0); return; }
  float a = min(0.99, g);
  // pixel-art mode: solid splats get a tight falloff so shapes read cleanly; soft ones stay soft
  if (u_crisp > 0.5 && v_color.a >= 1.0) a = u_hard > 0.5 ? (g > 0.5 ? 1.0 : 0.0) : 0.99 * smoothstep(0.38, 0.62, g);
  if (a < 0.004) discard;
  vec3 rgb = v_color.rgb;
  if (v_fk >= 0.0) {   // inked detail: this pixel's own place on the dab's tile
    ivec2 ij = clamp(ivec2(floor(vec2(dot(v_fm.xy, v_d), dot(v_fm.zw, v_d)) * 2.0 + 2.0)), ivec2(0), ivec2(3));
    float f = ij.y == 0 ? v_ft.x : ij.y == 1 ? v_ft.y : ij.y == 2 ? v_ft.z : v_ft.w;
    int ci = int(mod(floor(f / (ij.x == 0 ? 1.0 : ij.x == 1 ? 64.0 : ij.x == 2 ? 4096.0 : 262144.0)), 64.0));
    rgb = mix(u_fpal[min(ci, 63)], u_fog, v_fk); }
${water ? '  vec3 mark; rgb = waterPaint(rgb, gl_FragCoord.xy, u_viewport, v_waterAxial, mark);' : ''}
  o = vec4(rgb * a, a);
  float a2 = v_color.a >= 1.0 && v_depth >= 0.0 ? a : 0.0;   // only solid splats write depth
  od = vec4(v_depth * a2, v_gl * a * 0.5, v_lit * a2, a2);   // (green: how much glass lies over this pixel, in front of the last solid thing; a solid splat wipes it)
  oa = ${water ? 'vec4(mark * a, a)' : 'vec4(v_as * a, v_ast * 0.25 * a, 0.0, a)'};
}`;
  return { vertex: SPLAT_VS, fragment: SPLAT_FS };
}

export function pixelShaderSources(PixelLook, { water = false } = {}) {
  const POST_VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const POST_FS = `#version 300 es
precision highp float;
uniform sampler2D u_scene, u_depth, u_crispScene, u_crispDepth;
uniform vec3 u_line;
uniform float u_edge;
// the tone look (a diorama's look.tone, or the Tone option: PixelLook's stipple): brightness below the cutoff is black, the rest
// mapped onto the stops (u_toneStops: colour, and its place in .a), each pixel between two stops taking one or the other by its rank
// in a fixed pattern (Bayer or blue noise) on the screen's art grid
uniform float u_toneOn, u_toneCut, u_toneAmt; uniform int u_toneN; uniform highp sampler2D u_toneStops, u_toneTh;
uniform vec3 u_pal[64], u_out[64], u_outl[64];   // (u_outl: what each colour is shown as where a carried light falls on it)
uniform int u_n;
uniform float u_grade; uniform float u_bars;
uniform float u_dither, u_luma, u_bypass, u_colored, u_refract, u_ao, u_aor;
uniform float u_lines, u_lineGap, u_lineK, u_lineLit;
out vec4 o;
${water ? waterGLSL + `
uniform highp sampler2D u_waterMask;
ivec2 waterPixel(ivec2 p) {
  vec3 mark = texelFetch(u_waterMask, p, 0).rgb;
  if (mark.x < 0.98) return p;
  int code = int(round(mark.y * 255.0));
  ivec2 shift = ivec2(clamp((code % 16) - 4, -4, 4), int(round(mark.z * 8.0)) - 4);
  ivec2 dest = clamp(p + shift, ivec2(0), textureSize(u_waterMask, 0) - 1);
  vec3 other = texelFetch(u_waterMask, dest, 0).rgb;
  return other.x >= 0.98 && int(round(other.y * 255.0)) / 16 == code / 16 ? dest : p;
}
` : ''}
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
const ivec2 AOT[8] = ivec2[8](ivec2(2, 0), ivec2(-2, 0), ivec2(0, 2), ivec2(0, -2), ivec2(1, 1), ivec2(-1, 1), ivec2(1, -1), ivec2(-1, -1));
// light in the air behind a round stained window (a diorama's .glass): the window's centre and radius, the way its light travels, six glass
// colours, and the eye. Each pixel's line of sight is walked where it crosses the beam; every step adds the colour of the pane it lies behind,
// thinned or thickened by a haze that drifts, and the sum is added to the finished picture: this is light, so it is not held to the palette.
uniform mat4 u_gview; uniform vec3 u_geye, u_gd; uniform vec4 u_gw, u_gcam; uniform float u_gk, u_gtime, u_gortho; uniform vec3 u_gc[6];
// colour per pixel (a diorama's look.pixel): the solid dab in front at each pixel (u_idxTex), what it is coloured from (u_pixTex: its
// ramp, how lit, its pattern, the way its surface truly faces), its middle (u_data); the camera, to meet each pixel's line of sight
// with the dab's plane; the patterns and ramps. The pixel is coloured at that exact place, its light the mean of the pixels round
// it on the same ramp and surface, and a stone, tile or board's edge is drawn where the cell changes from this pixel to the next
uniform highp sampler2D u_idxTex, u_pixTex, u_dat; uniform float u_pixOn, u_tanF, u_asp, u_fpG, u_ol, u_olEps, u_olGap, u_ptime, u_portho, u_shape; uniform int u_olK; uniform mat4 u_pview; uniform vec3 u_peye;
uniform vec4 u_patK4[8], u_patP[128], u_rmp4[128], u_rmpN4[16]; uniform float u_detail;
int jm2(int v) { return v - 2 * int(trunc(float(v) * 0.5)); }   // (v % 2 as script does it, negative for a negative odd v)
int dabAt(ivec2 q) { ivec2 s = textureSize(u_idxTex, 0); if (q.x < 0 || q.y < 0 || q.x >= s.x || q.y >= s.y) return -1;
  vec4 e = texelFetch(u_idxTex, q, 0) * 255.0; return int(e.r + 0.5) + int(e.g + 0.5) * 256 + int(e.b + 0.5) * 65536 - 1; }
vec4 pixA(int i) { return texelFetch(u_pixTex, ivec2((i & 1023) * 2, i >> 10), 0); }
vec4 pixB(int i) { return texelFetch(u_pixTex, ivec2((i & 1023) * 2 + 1, i >> 10), 0); }
uint hsh(int i, int j, int k, int s) { uint h = uint(i) * 374761393u + uint(j) * 668265263u + uint(k) * 1440662683u + uint(s) * 1274126177u;
  h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u; h *= 2246822519u; h ^= h >> 13u; return h; }
float hsf(int i, int j, int k, int s) { return float(hsh(i, j, k, s)) / 4294967296.0; }
int rlen(int r) { return int(u_rmpN4[r >> 2][r & 3] + 0.5) & 15; }
bool lineOff(int r) { return (int(u_rmpN4[r >> 2][r & 3] + 0.5) & 16) != 0; }
// two ramps of one material (its shade ramp and its lit one share colours where they meet): not an edge between things
bool sameStuff(int a, int b) { return a == b || (int(u_rmpN4[a >> 2][a & 3] + 0.5) >> 5) == (int(u_rmpN4[b >> 2][b & 3] + 0.5) >> 5); }
int rampAt(int r, int b) { int x = r * 8 + clamp(b, 0, rlen(r) - 1); return int(u_rmp4[x >> 2][x & 3] + 0.5); }
int bandOf(int r, float t) { return clamp(int(floor(t * float(rlen(r)))), 0, rlen(r) - 1); }
float lvl(float px0, float fp) { return fp > 0.0 ? px0 * exp2(floor(log2(fp / px0) + 0.5)) : px0; }
// where this pixel's line of sight meets the plane of dab i, and how big a screen pixel is there
vec4 hitOf(ivec2 q, int i, vec3 n) { ivec2 sz = textureSize(u_idxTex, 0);
  vec3 v = vec3(((float(q.x) + 0.5) / float(sz.x) * 2.0 - 1.0) * u_tanF * u_asp, ((float(q.y) + 0.5) / float(sz.y) * 2.0 - 1.0) * u_tanF, -1.0);
  // (orthographic: each line of sight starts at its own point on the picture's plane and all run straight ahead)
  vec3 o0 = u_portho > 0.5 ? u_peye + transpose(mat3(u_pview)) * vec3(v.xy, 0.0) : u_peye;
  vec3 d = transpose(mat3(u_pview)) * (u_portho > 0.5 ? vec3(0.0, 0.0, -1.0) : v); vec3 c = texelFetch(u_dat, ivec2((i & 511) << 2, i >> 9), 0).xyz;
  float den = dot(n, d), s = abs(den) > 1e-6 ? dot(n, c - o0) / den : 0.0;
  // (a pixel's size on the surface, for the pattern's level: the same over a whole face, from the camera's distance and the face's slant)
  float ce = abs(dot(n, vec3(u_pview[0][2], u_pview[1][2], u_pview[2][2])));
  return s > 0.0 ? vec4(o0 + d * s, u_fpG / max(0.3, ce)) : vec4(c, 0.0); }
// a pattern's cell where the pixel lands (the same over one stone, tile or board), and the colours of its body and edges
struct Cell { ivec3 key, sel; int body, below, above, left; };
ivec2 g_q;   // (the pixel being coloured, for patterns drawn as upright pixel pictures)
float g_fp;   // (and the size of a screen pixel on its surface)
/* points pinned to the world, nested over detail levels. Level L's cells (a size times 2^L) each show one point: the one its chosen
   child shows, and so down to the finest level (LMIN). So a point shown at one level is shown at every finer one, in the same place:
   zooming out takes points away one by one (between L and L + 1 the cells not chosen by their parent go, each at its own moment)
   and zooming in brings them back; none ever moves */
const int LMIN = -2;
bool shown2(ivec2 c, int L, float f, int sd) { ivec2 pa = ivec2(floor(vec2(c) * 0.5)); int ch = int(hsf(pa.x, pa.y, 21 + L, sd) * 4.0);
  return c - pa * 2 == ivec2(ch & 1, ch >> 1) || hsf(c.x, c.y, 41 + L, sd) >= f; }
ivec2 atom2(ivec2 c, int L, int sd) { for (int l = 0; l < 8; l++) { if (L - l <= LMIN) break; int ch = int(hsf(c.x, c.y, 20 + L - l, sd) * 4.0); c = c * 2 + ivec2(ch & 1, ch >> 1); } return c; }
bool shown3(ivec3 c, int L, float f, int sd) { ivec3 pa = ivec3(floor(vec3(c) * 0.5)); int ch = int(hsf(pa.x + 7 * pa.z, pa.y, 21 + L, sd) * 8.0);
  return c - pa * 2 == ivec3(ch & 1, (ch >> 1) & 1, ch >> 2) || hsf(c.x + 7 * c.z, c.y, 41 + L, sd) >= f; }
ivec3 atom3(ivec3 c, int L, int sd) { for (int l = 0; l < 8; l++) { if (L - l <= LMIN) break; int ch = int(hsf(c.x + 7 * c.z, c.y, 20 + L - l, sd) * 8.0); c = c * 2 + ivec3(ch & 1, (ch >> 1) & 1, ch >> 2); } return c; }
// (the level for a surface's pixel size: L and how far toward L + 1)
int nestL(float p, out float f) { float lam = clamp(log2(max(g_fp, 1e-6) / p), float(LMIN), 4.0); int L = int(floor(lam)); f = lam - float(L); return L; }
const int TUFTS[6] = int[6](17732, 4782, 324, 11118, 2700, 8524); const int LEAFM[4] = int[4](2274, 4812, 10692, 5312); const int CLUMPS[4] = int[4](42975166, 17211164, 38797084, 9150366); const int NEEDLES[4] = int[4](21956, 3268, 24964, 10368); const int CRACKS[4] = int[4](1100, 4289, 368, 192); const int RIPPLES[4] = int[4](14, 108, 7, 22);
vec3 unfoldN(vec2 q, vec3 dflt) { if (q.x > 8.0) return dflt; float y = 1.0 - abs(q.x) - abs(q.y); vec2 xz = q;
  if (y < 0.0) xz = (1.0 - abs(q.yx)) * vec2(q.x >= 0.0 ? 1.0 : -1.0, q.y >= 0.0 ? 1.0 : -1.0); return normalize(vec3(xz.x, y, xz.y)); }
Cell cellAtL(int k, int r, vec3 P, vec3 n, vec3 fn, float t, float p) {
  Cell C; C.key = ivec3(-99999); C.sel = ivec3(0); int b = bandOf(r, t); C.body = rampAt(r, b); C.below = C.body; C.above = C.body; C.left = C.body;
  int kind = int(u_patK4[k >> 2][k & 3] + 0.5); vec4 a = u_patP[k * 4], e = u_patP[k * 4 + 1]; int sd = int(e.x + 0.5);
  if (kind == 1) {   // stones in courses
    float sl = a.x * p, sh = a.y * p; vec3 uvf = abs(n.y) > 0.7 ? vec3(P.x, P.z, 0.0) : abs(n.x) > abs(n.z) ? vec3(P.z * sign(n.x == 0.0 ? 1.0 : n.x), P.y, 1.0) : vec3(-P.x * sign(n.z == 0.0 ? 1.0 : n.z), P.y, 2.0);
    int face = int(uvf.z), row = int(floor(uvf.y / sh)); float off = float(jm2(row)) * 0.5 * sl + hsf(row, face, 0, sd) * sl * 0.3;
    int slot = int(floor((uvf.x + off) / sl)); float su = uvf.x + off - float(slot) * sl;
    bool halfS = hsf(slot, row, face, sd + 9) > 0.86, keepS = hsf(slot, row, face, sd + 7) > 0.28; int col;
    if (halfS && su > sl * 0.5) col = slot * 2 + 1; else if (keepS) col = slot * 2;
    else { int s2 = slot - 1; col = s2 * 2; for (int g = 0; g < 4; g++) { if (hsf(s2, row, face, sd + 9) > 0.86) { col = s2 * 2 + 1; break; } if (hsf(s2, row, face, sd + 7) > 0.28 || g == 3) { col = s2 * 2; break; } s2--; } }
    float hv = hsf(col, row, face, sd + 3); int dd = hv < a.w * 0.6 ? -1 : hv > 1.0 - a.w * 0.4 ? 1 : 0; int n0 = rlen(r);
    C.body = rampAt(r, b + dd); C.below = rampAt(r, b - int(a.z + 0.5)); C.left = C.below; C.above = rampAt(r, b + dd + (b < n0 - 1 ? 1 : 0));
    C.key = ivec3(face, row, col);
  } else if (kind == 2) {   // boards
    float w = a.x * p; int ax = int(a.y + 0.5); float al = ax == 0 ? P.x : ax == 1 ? P.z : P.y;
    float cc = ax == 2 ? (abs(n.x) > abs(n.z) ? P.z : P.x) : abs(n.y) > 0.7 ? (ax == 0 ? P.z : P.x) : P.y;
    int k0 = int(floor(cc / w)); bool wide = hsf(k0, 9, 0, sd) < 0.3; int kk = wide && jm2(k0) != 0 ? k0 - 1 : k0;
    float len = (6.0 + 10.0 * hsf(kk, 0, 0, sd)) * p * 4.0, ee = al + hsf(kk, 1, 0, sd) * len; int seg = int(floor(ee / len));
    C.body = rampAt(r, b + (hsf(kk, seg, 4, sd) < 0.2 ? -1 : 0)); C.below = rampAt(r, b - 2); C.left = C.below; C.above = C.body;
    C.key = ivec3(kk, seg, 0);
  } else if (kind == 3) {   // tiles: the lower edge a lit lip, the upper edge in the row above's shadow, the sides seams
    float tw = a.x * p, th = a.y * p, u = abs(n.x) > abs(n.z) ? P.z : P.x; int row = int(floor(P.y / th));
    float off = float(jm2(row)) * 0.5 * tw; int col = int(floor((u + off) / tw));
    C.body = rampAt(r, b + (hsf(col, row, 0, sd) < 0.08 ? -1 : 0)); C.below = rampAt(r, b + 1); C.above = rampAt(r, b - 2);
    C.left = P.y - float(row) * th < th * 0.5 ? rampAt(r, b - 1) : C.body;   // (seams only on a tile's lower half: shingles, not a grid)
    C.key = ivec3(row, col, 1);
  } else if (kind == 6) {   // thatch: courses along the eaves, bundles shading them, ragged feet; a course is one cell
    float ch = a.x * p, bw = a.y * p, u = abs(n.x) > abs(n.z) ? P.z : P.x; int row = int(floor(P.y / ch)); float f = P.y - float(row) * ch;
    int cU = int(floor((u + hsf(row + 1, 0, 2, sd) * bw) / bw)); float sagU = floor(hsf(cU, row + 1, 1, sd) * (a.z + 0.999)) * p; int col;
    if (f >= ch - sagU) { row++; col = cU; } else col = int(floor((u + hsf(row, 0, 2, sd) * bw) / bw));
    float hv = hsf(col, row, 3, sd); int dd = hv < 0.28 ? -1 : hv > 0.82 ? 1 : 0;
    C.body = rampAt(r, b + dd); C.below = rampAt(r, b + 1); C.above = rampAt(r, b - 2); C.left = rampAt(r, b - 1);
    C.key = ivec3(row, 0, 6);
  } else if (kind == 5) {   // leaves: clusters round Worley points, each lit as a dome and as the crown's shape: scalloped band edges
    float cl = a.x * p; vec3 g = P / cl; ivec3 ig = ivec3(floor(g)); float best = 1e9; vec3 fq = vec3(0.0);
    for (int kz = -1; kz <= 1; kz++) for (int ky = -1; ky <= 1; ky++) for (int kx = -1; kx <= 1; kx++) { ivec3 c3 = ig + ivec3(kx, ky, kz);
      vec3 q = vec3(c3) + 0.15 + 0.7 * vec3(hsf(c3.x, c3.y, c3.z, sd), hsf(c3.x, c3.y, c3.z, sd + 1), hsf(c3.x, c3.y, c3.z, sd + 2)); vec3 dq = q - g; float d2 = dot(dq, dq);
      if (d2 < best) { best = d2; fq = q; } }
    vec3 L = e.yzw, dd = normalize(P - fq * cl), nc = normalize(fn * (1.0 - a.y) + dd * a.y);
    float t2 = t + a.z * (max(0.0, dot(nc, L)) - max(0.0, dot(fn, L))); int b2 = bandOf(r, t2), body = rampAt(r, b2);
    // leaf marks: little upright pixel pictures of leaves at points over the crown, darker in the light and lighter in the shade
    if (a.w > 0.0) { float fr; int L = nestL(p, fr); float mc = u_patP[k * 4 + 2].x * p * exp2(float(L)), mA = u_patP[k * 4 + 2].x * p * exp2(float(LMIN)); ivec3 mg = ivec3(floor(P / mc)); int best = -9, col = -1; ivec2 sz = textureSize(u_idxTex, 0); mat3 V = mat3(u_pview);
      for (int kz = -1; kz <= 1; kz++) for (int ky = -1; ky <= 1; ky++) for (int kx = -1; kx <= 1; kx++) { ivec3 cL = mg + ivec3(kx, ky, kz); if (!shown3(cL, L, fr, sd)) continue; ivec3 c3 = atom3(cL, L, sd);
        if (hsf(c3.x, c3.y, c3.z, sd + 5) > a.w) continue;
        vec3 Q = (vec3(c3) + 0.15 + 0.7 * vec3(hsf(c3.x, c3.y, c3.z, sd), hsf(c3.x, c3.y, c3.z, sd + 1), hsf(c3.x, c3.y, c3.z, sd + 2))) * mA;
        if (dot(Q - P, Q - P) > mc * mc * 1.5) continue;
        vec3 vs = V * (Q - u_peye); float iw = u_portho > 0.5 ? 1.0 : 1.0 / max(-vs.z, 1e-6);
        vec2 sc = vec2((vs.x * iw / (u_tanF * u_asp) + 1.0) * 0.5 * float(sz.x) - 0.5, (vs.y * iw / u_tanF + 1.0) * 0.5 * float(sz.y) - 0.5);
        int ox = int(floor(float(g_q.x) - sc.x + 0.5)), oy = int(floor(float(g_q.y) - sc.y + 0.5));
        if (abs(ox) > 2 || oy < 0 || oy > 2 || oy <= best) continue;
        int m = LEAFM[int(hsf(c3.x, c3.y, c3.z, sd + 6) * 4.0) % 4]; if (((m >> (oy * 5 + ox + 2)) & 1) == 0) continue;
        best = oy; col = rampAt(r, b2 + (float(b2) >= float(rlen(r)) * 0.5 ? -1 : 1)); }
      if (col >= 0) body = col; }
    C.body = body; C.below = body; C.above = body; C.left = body; C.key = ivec3(floor(fq));
  } else if (kind == 7) {   // turf: an even ground (darker in big patches) scattered with upright tufts, each a little pixel picture anchored to the ground
    float ps = a.z, pn = sin(P.x / ps + 1.3 * sin(P.z / (ps * 1.7))) * sin(P.z / ps + 0.9 * sin(P.x / (ps * 1.3)));
    float fr; int L = nestL(p, fr); float cl = a.x * p * exp2(float(L)), cA = a.x * p * exp2(float(LMIN));
    int bb = max(0, b - (pn > 0.55 ? 1 : 0) + int(floor(e.z + 0.5))), body = rampAt(r, bb); int ix = int(floor(P.x / cl)), iz = int(floor(P.z / cl));
    if (n.y >= 0.5) {
      int d = bb <= rlen(r) - 2 ? 1 : -1, best = -9, col = -1, nf = int(a.w + 0.5); bool shade = false; vec4 F0 = u_patP[k * 4 + 2], F1 = u_patP[k * 4 + 3];
      ivec2 sz = textureSize(u_idxTex, 0); mat3 V = mat3(u_pview);
      for (int kz = -1; kz <= 1; kz++) for (int kx = -1; kx <= 1; kx++) { ivec2 c2 = ivec2(ix + kx, iz + kz); if (!shown2(c2, L, fr, sd)) continue;
        ivec2 at2 = atom2(c2, L, sd); int ax = at2.x, cz = at2.y;
        if (hsf(ax, cz, 4, sd) > a.y) continue;
        vec2 qw = vec2((float(ax) + 0.15 + 0.7 * hsf(ax, cz, 0, sd)) * cA, (float(cz) + 0.15 + 0.7 * hsf(ax, cz, 1, sd)) * cA);
        vec3 vs = V * (vec3(qw.x, P.y, qw.y) - u_peye); float iw = u_portho > 0.5 ? 1.0 : 1.0 / max(-vs.z, 1e-6);
        vec2 sc = vec2((vs.x * iw / (u_tanF * u_asp) + 1.0) * 0.5 * float(sz.x) - 0.5, (vs.y * iw / u_tanF + 1.0) * 0.5 * float(sz.y) - 0.5);
        int oy = int(floor(float(g_q.y) - sc.y + 0.5));
        int lean = e.w > 0.5 && oy >= 2 && sin(u_ptime * 1.5 - (qw.x * 0.8 + qw.y * 0.6) * 3.0) > 0.5 ? 1 : 0;   // (gusts over the lawn: tops lean a pixel)
        int ox = int(floor(float(g_q.x) - sc.x + 0.5)) - lean;
        if (hsf(ax, cz, 8, sd) < e.y) {   // (a clump: bigger, a step lighter, its top two, a dark line under it)
          if (oy == -1 && abs(ox) <= 2) shade = true;
          if (abs(ox) > 3 || oy < 0 || oy > 3 || oy <= best) continue;
          int m = CLUMPS[int(hsf(ax, cz, 6, sd) * 4.0) % 4], bit = oy * 7 + ox + 3; if (((m >> bit) & 1) == 0) continue;
          best = oy; col = rampAt(r, bb + (d > 0 ? (oy == 3 || ((m >> (bit + 7)) & 1) == 0 ? 2 : 1) : d)); continue; }
        if (oy == -1 && abs(ox) <= 1) shade = true;
        if (abs(ox) > 2 || oy < 0 || oy > 2 || oy <= best) continue;
        float hf = hsf(ax, cz, 5, sd); int fl = -1; if (nf > 0 && hf < F0.y) fl = 0; else if (nf > 1 && hf < F0.y + F1.x) fl = 1;
        int m = fl >= 0 ? 4548 : TUFTS[int(hsf(ax, cz, 6, sd) * 6.0) % 6];
        if (((m >> (oy * 5 + ox + 2)) & 1) == 0) continue;
        best = oy;
        if (fl == 0) col = int((ox == 0 && oy == 1 ? F0.z : F0.x) + 0.5); else if (fl == 1) col = int((ox == 0 && oy == 1 ? F1.y : F0.w) + 0.5);
        else col = rampAt(r, bb + (oy == 2 && d > 0 ? 2 : d)); }
      if (col >= 0) body = col; else if (shade) body = rampAt(r, bb - 1);
    }
    C.body = body; C.below = body; C.above = body; C.left = body; C.sel = ivec3(0, 0, 7);
  } else if (kind == 9) {   // needles: a conifer's tier lit as its cone, needle marks a step lighter, dark under the tier above
    int body = C.body; float fr; int L = nestL(p, fr); float mc = a.z * p * exp2(float(L)), mA = a.z * p * exp2(float(LMIN)); ivec3 mg = ivec3(floor(P / mc)); int best = -9; ivec2 sz = textureSize(u_idxTex, 0); mat3 V = mat3(u_pview);
    for (int kz = -1; kz <= 1; kz++) for (int ky = -1; ky <= 1; ky++) for (int kx = -1; kx <= 1; kx++) { ivec3 cL = mg + ivec3(kx, ky, kz); if (!shown3(cL, L, fr, sd)) continue; ivec3 c3 = atom3(cL, L, sd);
      if (hsf(c3.x, c3.y, c3.z, sd + 5) > a.y) continue;
      vec3 Q = (vec3(c3) + 0.15 + 0.7 * vec3(hsf(c3.x, c3.y, c3.z, sd), hsf(c3.x, c3.y, c3.z, sd + 1), hsf(c3.x, c3.y, c3.z, sd + 2))) * mA;
      if (dot(Q - P, Q - P) > mc * mc * 1.5) continue;
      vec3 vs = V * (Q - u_peye); float iw = u_portho > 0.5 ? 1.0 : 1.0 / max(-vs.z, 1e-6);
      vec2 sc = vec2((vs.x * iw / (u_tanF * u_asp) + 1.0) * 0.5 * float(sz.x) - 0.5, (vs.y * iw / u_tanF + 1.0) * 0.5 * float(sz.y) - 0.5);
      int ox = int(floor(float(g_q.x) - sc.x + 0.5)), oy = int(floor(float(g_q.y) - sc.y + 0.5));
      if (abs(ox) > 2 || oy < 0 || oy > 2 || oy <= best) continue;
      int m = NEEDLES[int(hsf(c3.x, c3.y, c3.z, sd + 6) * 4.0) % 4]; if (((m >> (oy * 5 + ox + 2)) & 1) == 0) continue;
      best = oy; body = rampAt(r, b + (b >= rlen(r) - 1 ? -1 : 1)); }
    C.body = body; C.below = body; C.left = body; C.above = rampAt(r, b - 2); C.key = ivec3(int(a.x + 0.5), 0, 9);
  } else if (kind == 10) {   // rock: plain stone with upright marks of cracks (two steps darker) and now and then a pebble of light
    int body = C.body; float fr; int L = nestL(p, fr); float mc = a.x * p * exp2(float(L)), mA = a.x * p * exp2(float(LMIN)); ivec3 mg = ivec3(floor(P / mc)); int best = -9; ivec2 sz = textureSize(u_idxTex, 0); mat3 V = mat3(u_pview);
    for (int kz = -1; kz <= 1; kz++) for (int ky = -1; ky <= 1; ky++) for (int kx = -1; kx <= 1; kx++) { ivec3 cL = mg + ivec3(kx, ky, kz); if (!shown3(cL, L, fr, sd)) continue; ivec3 c3 = atom3(cL, L, sd);
      if (hsf(c3.x, c3.y, c3.z, sd + 5) > a.y) continue;
      vec3 Q = (vec3(c3) + 0.15 + 0.7 * vec3(hsf(c3.x, c3.y, c3.z, sd), hsf(c3.x, c3.y, c3.z, sd + 1), hsf(c3.x, c3.y, c3.z, sd + 2))) * mA;
      if (dot(Q - P, Q - P) > mc * mc * 1.5) continue;
      vec3 vs = V * (Q - u_peye); float iw = u_portho > 0.5 ? 1.0 : 1.0 / max(-vs.z, 1e-6);
      vec2 sc = vec2((vs.x * iw / (u_tanF * u_asp) + 1.0) * 0.5 * float(sz.x) - 0.5, (vs.y * iw / u_tanF + 1.0) * 0.5 * float(sz.y) - 0.5);
      int ox = int(floor(float(g_q.x) - sc.x + 0.5)), oy = int(floor(float(g_q.y) - sc.y + 0.5));
      if (abs(ox) > 2 || oy < 0 || oy > 2 || oy <= best) continue;
      int mi = int(hsf(c3.x, c3.y, c3.z, sd + 6) * 4.0) % 4; if (((CRACKS[mi] >> (oy * 5 + ox + 2)) & 1) == 0) continue;
      best = oy; body = rampAt(r, b + (mi == 3 ? 1 : -2)); }
    C.body = body; C.below = body; C.above = body; C.left = body;
  } else if (kind == 8) {   // water: its own colour as it was made (shallows, foam), with ripples twinkling on it
    float fr; int L = nestL(p, fr); float cl = a.x * p * exp2(float(L)), cA = a.x * p * exp2(float(LMIN));
    C.body = -2; int ix = int(floor(P.x / cl)), iz = int(floor(P.z / cl)); C.sel = ivec3(0, 0, 8);
    ivec2 sz = textureSize(u_idxTex, 0); mat3 V = mat3(u_pview);
    for (int kz = -1; kz <= 1; kz++) for (int kx = -1; kx <= 1; kx++) { ivec2 c2 = ivec2(ix + kx, iz + kz); if (!shown2(c2, L, fr, sd)) continue;
      ivec2 at2 = atom2(c2, L, sd); int ax = at2.x, cz = at2.y;
      if (hsf(ax, cz, 4, sd) > a.y) continue; float ph = u_ptime * a.z + hsf(ax, cz, 7, sd); if (fract(ph) > 0.6) continue;
      vec3 vs = V * (vec3((float(ax) + 0.15 + 0.7 * hsf(ax, cz, 0, sd)) * cA, P.y, (float(cz) + 0.15 + 0.7 * hsf(ax, cz, 1, sd)) * cA) - u_peye); float iw = u_portho > 0.5 ? 1.0 : 1.0 / max(-vs.z, 1e-6);
      vec2 sc = vec2((vs.x * iw / (u_tanF * u_asp) + 1.0) * 0.5 * float(sz.x) - 0.5, (vs.y * iw / u_tanF + 1.0) * 0.5 * float(sz.y) - 0.5);
      int ox = int(floor(float(g_q.x) - sc.x + 0.5)), oy = int(floor(float(g_q.y) - sc.y + 0.5)), m = RIPPLES[int(hsf(ax, cz, 6, sd) * 4.0) % 4];
      if (abs(ox) <= 2 && oy >= 0 && oy <= 1 && ((m >> (oy * 5 + ox + 2)) & 1) != 0) { C.body = rampAt(r, b + 2); break; } }
    C.below = C.body; C.above = C.body; C.left = C.body;
  } else if (kind == 4) {   // grass: darker patches, tufts, flowers
    float ps = a.z, pn = sin(P.x / ps + 1.3 * sin(P.z / (ps * 1.7))) * sin(P.z / ps + 0.9 * sin(P.x / (ps * 1.3)));
    int bb = pn > 0.55 ? max(0, b - 1) : b; float cl = a.y * p; int ii = int(floor(P.x / cl)), kz = int(floor(P.z / cl));
    float h = hsf(ii, kz, 0, sd), cx = (float(ii) + 0.25 + 0.5 * hsf(ii, kz, 1, sd)) * cl, cz = (float(kz) + 0.25 + 0.5 * hsf(ii, kz, 2, sd)) * cl;
    float dx = (P.x - cx) / p, dz = (P.z - cz) / p, f = 0.0; int body = rampAt(r, bb); int nf = int(a.w + 0.5);
    vec4 F0 = u_patP[k * 4 + 1], F1 = u_patP[k * 4 + 2], F2 = u_patP[k * 4 + 3];
    float fc[3] = float[3](F0.y, F1.x, F1.w), fs[3] = float[3](F0.z, F1.y, F2.x), fm[3] = float[3](F0.w, F1.z, F2.y);
    bool done = false;
    for (int q = 0; q < 3; q++) { if (q >= nf || done) break; f += fs[q];
      if (h < f) { done = true; if (abs(dx) + abs(dz) < 1.1) body = int((abs(dx) < 0.5 && abs(dz) < 0.5 ? fm[q] : fc[q]) + 0.5); } }
    if (!done && h < f + a.x && abs(dz) < 0.6 && abs(dx) < 1.6) body = rampAt(r, bb + (bb >= rlen(r) - 2 ? -1 : 1));
    C.body = body; C.below = body; C.above = body; C.left = body; C.sel = ivec3(ii, kz, 4);
  }
  if (kind != 4 && kind != 7 && kind != 8) C.sel = C.key;
  return C; }
/* a pattern's detail, pinned to the world: stones, boards, tiles and thatch keep their real size at every zoom. Seen from far, where
   a screen pixel is bigger than the pattern's own, their seams go one by one: each cell joins its neighbour (along the course first,
   then course to course), each pair at its own moment as the camera draws back, so the stones merge and nothing moves; coming back in,
   the seams come back where they were. Points drawn as little pictures (tufts, marks, cracks, ripples) are pinned the same way,
   in nested sets (shown2/shown3). g_fp carries the size of a screen pixel on the surface to them */
ivec3 mergeKey(int kind, ivec3 k, int m) { if (m <= 0) return k;
  if (kind == 1) return ivec3(k.x, k.y >> max(0, m - 1), k.z >> (m + 1));   // stones: along the course first, then courses
  if (kind == 2) return ivec3(k.x >> max(0, m - 1), k.y >> m, k.z);          // boards: their ends first, then board to board
  if (kind == 3) return ivec3(k.x >> max(0, m - 1), k.y >> m, k.z);          // tiles: along the row, then rows
  if (kind == 6) return ivec3(k.x >> m, k.y, k.z);                           // thatch: course to course
  return k; }
Cell cellOf(int k, int r, vec3 P, vec3 n, vec3 fn, float t, float fp0) {
  /* (the level of detail is one for the whole picture, from the camera's distance alone: taken from each surface's slant it would
     differ from pixel to pixel, and change as the view turns, and the details would flicker) */
  float px0 = 1.0 / u_detail, fp = u_fpG; g_fp = fp;
  Cell C = cellAtL(k, r, P, n, fn, t, px0);
  if (C.key.x != -99999 && fp > px0) { int kind = int(u_patK4[k >> 2][k & 3] + 0.5); float lam = min(log2(fp / px0), 3.99); int m = int(floor(lam));
    ivec3 kn = mergeKey(kind, C.key, m + 1); C.key = hsf(kn.x, kn.y, kn.z, 4099) < lam - float(m) ? kn : mergeKey(kind, C.key, m); }
  return C; }
/* (smoothness: the cell of every pixel is worked out once, in a pass of its own (KEY_FS), and read here for the pixels round
   each one, instead of being worked out again for each of them) */
uniform highp isampler2D u_keyTex; uniform float u_keyOn;
ivec3 keyCalc(ivec2 q);
ivec3 keyAt(ivec2 q) { if (u_keyOn > 0.5) { ivec2 s = textureSize(u_keyTex, 0); if (q.x < 0 || q.y < 0 || q.x >= s.x || q.y >= s.y) return ivec3(-99999);
    ivec4 k = texelFetch(u_keyTex, q, 0); return k.w == 1 ? k.xyz : ivec3(-99999); } return keyCalc(q); }
ivec3 keyCalc(ivec2 q) { g_q = q; int i = dabAt(q); if (i < 0) return ivec3(-99999); vec4 A = pixA(i); if (A.x < 0.5 || A.z < 0.5) return ivec3(-99999);
  vec4 Bq = pixB(i); vec3 n = vec3(A.w, Bq.x, Bq.y); vec4 h = hitOf(q, i, n); return cellOf(int(A.z + 0.5) - 1, int(A.x + 0.5) - 1, h.xyz, n, unfoldN(Bq.zw, n), 0.5, h.w).key; }
bool differs(ivec3 k, ivec3 q) { return q.x != -99999 && q != k; }
const ivec2 N4o[4] = ivec2[4](ivec2(-1, 0), ivec2(1, 0), ivec2(0, -1), ivec2(0, 1)); bool g_pixed = false;
/* edge sprites (K.pixel.edge, an option): drawn first in a pass of their own (SPR_VS / SPR_FS: each stands on a point pinned to its
   surface), into u_sprLayer: which cell (8 + steps from the edge's own colour, or 100 + a palette colour), ramp and band */
uniform highp sampler2D u_sprLayer; uniform float u_sprOn, u_markA; bool g_spr = false;
vec3 pixColour(ivec2 p, vec3 c) {
  int i = dabAt(p); if (i < 0) return c; vec4 A = pixA(i); if (A.x < 0.5) return c;
  // (only where the dab is what shows: nothing soft in front of it, no light carried onto it)
  vec4 t1 = texelFetch(u_dat, ivec2(((i & 511) << 2) + 1, i >> 9), 0); float pk = t1.w;
  vec3 baked = vec3(mod(pk, 256.0), mod(floor(pk / 256.0), 256.0), floor(pk / 65536.0)) / 255.0;
${water ? `  vec3 mark;
  vec3 center = texelFetch(u_dat, ivec2((i & 511) << 2, i >> 9), 0).xyz;
  float axial = -(u_waterView * vec4(center, 1.0)).z;
  vec2 size = vec2(textureSize(u_scene, 0));
  baked = waterPaint(baked, vec2(p) + 0.5, size, axial, mark);` : ''}
  if (max(abs(baked.r - c.r), max(abs(baked.g - c.g), abs(baked.b - c.b))) > 0.03) return c;
  int r = int(A.x + 0.5) - 1; float dc = texelFetch(u_depth, p, 0).r, sum = 0.0, cnt = 0.0;
  vec4 Bq = pixB(i); vec3 n = vec3(A.w, Bq.x, Bq.y);
  /* the light, smoothed over the same surface round the pixel (the same ramp, near in depth): over three by three; with the light
     shaper (an option), over seven by seven and only where the surface faces much the same way, so the light and the shade fall in a
     few big shapes with smooth edges, not wherever the light of each dab happens to cross a step */
  // (near the edge of a surface the big window is cut in half, and its mean would pull a lit rim toward the middle, shading that
  // follows the outline: there the three by three is kept, and the two are blended by how much of the big window is surface)
  bool shp = u_shape > 0.5; float s7 = 0.0, c7 = 0.0;
  for (int dy = -3; dy <= 3; dy++) for (int dx = -3; dx <= 3; dx++) { bool small = abs(dx) <= 1 && abs(dy) <= 1, wide = shp && ((dx + dy) & 1) == 0; if (!small && !wide) continue;
    ivec2 q = p + ivec2(dx, dy); int j = dabAt(q); if (j < 0) continue; vec4 Aj = pixA(j);
    if (abs(Aj.x - A.x) > 0.5 || abs(texelFetch(u_depth, q, 0).r - dc) > 0.03) continue;
    if (small) { sum += Aj.y; cnt += 1.0; }
    if (wide) { vec4 Bj = pixB(j); if (dot(n, vec3(Aj.w, Bj.x, Bj.y)) >= 0.8) { s7 += Aj.y; c7 += 1.0; } } }
  float t = cnt > 0.0 ? sum / cnt : A.y;
  if (shp && c7 > 0.0) t = mix(t, s7 / c7, smoothstep(0.5, 0.85, c7 / 25.0));
  int ci;
  if (A.z < 0.5) ci = rampAt(r, bandOf(r, t));
  else { vec4 h = hitOf(p, i, n); g_q = p; Cell C = cellOf(int(A.z + 0.5) - 1, r, h.xyz, n, unfoldN(Bq.zw, n), t, h.w); ci = C.body;
    if (C.key.x != -99999) { if (differs(C.key, keyAt(p - ivec2(0, 1)))) ci = C.below; else if (differs(C.key, keyAt(p - ivec2(1, 0)))) ci = C.left; else if (differs(C.key, keyAt(p + ivec2(0, 1)))) ci = C.above; } }
  if (ci == -2) return c;   // (a pattern that keeps the colour the dab was made with, here and there drawn over)
  /* outlines (look.outline): at the edge of a thing, where it meets another material, the background or something well behind it,
     the nearer pixel takes a darker step of its own ramp, so each thing is ringed in its own darker colour (a lit one more softly) */
  if (u_ol > 0.5 && !lineOff(r) && dc > -0.5) { bool edge = false, sky = false;
    ivec2 omx = textureSize(u_depth, 0) - 1;
    for (int k = 0; k < 4; k++) { ivec2 q = p + N4o[k]; if (texelFetch(u_depth, q, 0).r < -0.5) continue; float dd = texelFetch(u_depth, q, 0).r - dc; if (dd <= u_olEps) continue;
      // (a break must carry on past the next pixel or two: a hole in a surface, where what lies under it shows through, is not an edge)
      if (texelFetch(u_depth, clamp(p + 2 * N4o[k], ivec2(0), omx), 0).r - dc <= u_olEps || texelFetch(u_depth, clamp(p + 3 * N4o[k], ivec2(0), omx), 0).r - dc <= u_olEps) continue;
      int j = dabAt(q); if (j < 0 || dd > u_olGap) { edge = true; sky = sky || texelFetch(u_depth, q, 0).r >= 0.995; break; } vec4 Aj = pixA(j); if (!sameStuff(int(Aj.x + 0.5) - 1, r)) { edge = true; break; } }
    // (and a crease: where its own surface turns sharply, the lit side a step lighter, the other a step darker; not in leaves or grass)
    int ck = 0; bool soft = false; if (A.z > 0.5) { int kk = int(A.z + 0.5) - 1; int kd = int(u_patK4[kk >> 2][kk & 3] + 0.5); soft = kd == 5 || kd == 7; }
    if (!edge && !soft) for (int k = 0; k < 4; k++) { ivec2 q = p + N4o[k]; int j = dabAt(q); if (j < 0) continue; vec4 Aj = pixA(j);
      if (abs(Aj.x - A.x) > 0.5 || abs(texelFetch(u_depth, q, 0).r - dc) > u_olGap) continue; vec4 Bj = pixB(j);
      if (dot(n, vec3(Aj.w, Bj.x, Bj.y)) > 0.7) continue; ck = A.y >= Aj.y ? 1 : -1; break; }
    if (edge || ck != 0) { int bb = -1; for (int k = 0; k < 8; k++) { if (k >= rlen(r)) break; if (rampAt(r, k) == ci) { bb = k; break; } }
      // (a rim in the light takes a softer line than one in shade, or none against another thing: so the outline does not darken a
      // shape all round, whichever way it faces, which is pillow shading)
      int kk2 = bb * 2 >= rlen(r) ? (sky ? 1 : 0) : u_olK;
      if (bb >= 0) ci = rampAt(r, edge ? max(0, bb - kk2) : bb + ck); } }
  g_pixed = true;
  return ${water ? 'waterPaint(u_pal[clamp(ci, 0, 63)], vec2(p) + 0.5, size, axial, mark)' : 'u_pal[clamp(ci, 0, 63)]'}; }
const int GPET[12] = int[12](0, 3, 1, 4, 0, 3, 2, 4, 0, 3, 1, 4); const int GOUT[6] = int[6](3, 1, 4, 2, 0, 1);
vec3 glassPane(vec2 q) {
  float r = length(q) / u_gw.w * 2.6, a = fract(atan(q.y, q.x) / 6.2831853 + 1.0);
  if (r > 2.52) return vec3(0.0); if (r < 0.5) return u_gc[5]; if (r < 0.64) return vec3(0.0);
  if (r < 1.72) { float s = a * 12.0, k = floor(s), f = s - k, w = 0.07 / r; if (f < w || f > 1.0 - w) return vec3(0.0); if (r > 1.2 && abs(f - 0.5) > 0.5 - (r - 1.2) * 0.75) return vec3(0.0); return r < 0.98 ? u_gc[5] : u_gc[GPET[int(k) % 12]]; }
  if (r < 1.86) return vec3(0.0); float s = a * 24.0 + 0.5, k = floor(s), f = s - k; if (f < 0.07 || f > 0.93) return vec3(0.0);
  return length(vec2((f - 0.5) * 0.6, (r - 2.19) * 1.25)) < 0.36 ? u_gc[GOUT[int(k) % 6]] : vec3(0.0);
}
float glassHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float glassHaze(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(glassHash(i), glassHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(glassHash(i + vec3(0.0, 1.0, 0.0)), glassHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(glassHash(i + vec3(0.0, 0.0, 1.0)), glassHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(glassHash(i + vec3(0.0, 1.0, 1.0)), glassHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
// sunlight through gaps in a canopy (a diorama's .glass with mode 'gaps', from K.dapple): each gap lets down a shaft along the light. A line
// of sight lights up by how much of a shaft it passes through, but only until it is well inside: a shaft is a flat, even band of light.
// Four looks along the part it passes through say how strong the band is there: it eases in just under its gap, thins as it goes down,
// is thicker where the haze drifts, and fades out toward the ground and toward the edge of the stand (the diorama's .glass at and r), so
// a shaft never ends on a hard line whatever it is seen from. With steps, the light is banded into that many levels, dithered only where
// one level gives way to the next, so a shaft is drawn as flat pixel tones are, with a stippled edge
uniform float u_gm, u_gq, u_gfl; uniform vec4 u_gh[24]; uniform int u_ghn;
vec3 glassGaps(vec3 c, ivec2 p, float dn, vec2 res) {
  vec2 ndc = (vec2(p) + 0.5) / res * 2.0 - 1.0; vec3 rv = u_gortho > 0.5 ? vec3(0.0, 0.0, -1.0) : normalize(vec3(ndc.x * u_gcam.x, ndc.y * u_gcam.y, -1.0)), dir = transpose(mat3(u_gview)) * rv;
  vec3 ge = u_gortho > 0.5 ? u_geye + transpose(mat3(u_gview)) * vec3(ndc.x * u_gcam.x, ndc.y * u_gcam.y, 0.0) : u_geye;   // (orthographic: parallel lines of sight)
  // (where nothing is drawn the line of sight goes on through the air: it is not stopped at the far side of the stand)
  float tmax = dn >= 0.999 ? 1e4 : (u_gcam.z + min(dn, 1.0) * (u_gcam.w - u_gcam.z)) / max(-rv.z, 0.05), sw = 0.0; vec3 sc = vec3(0.0);
  for (int i = 0; i < 24; i++) { if (i >= u_ghn) break;
    vec4 h = u_gh[i]; vec3 hc = h.xyz + vec3(sin(u_gtime * 0.7 + float(i) * 1.7), 0.0, cos(u_gtime * 0.6 + float(i) * 2.3)) * 0.05 * h.w;
    vec3 oc = ge - hc; float dd = dot(dir, u_gd), od = dot(oc, u_gd), A = 1.0 - dd * dd, Bq = dot(oc, dir) - od * dd, C = dot(oc, oc) - od * od - h.w * h.w, disc = Bq * Bq - A * C;
    if (A < 1e-5 || disc <= 0.0) continue;
    float sq = sqrt(disc), t0 = max((-Bq - sq) / A, 0.0), t1 = min((-Bq + sq) / A, tmax), lo = u_gfl - 0.6;
    if (abs(dir.y) > 1e-5) { float ty = (hc.y - ge.y) / dir.y, tf = (lo - ge.y) / dir.y; if (dir.y < 0.0) { t0 = max(t0, ty); t1 = min(t1, tf); } else { t0 = max(t0, tf); t1 = min(t1, ty); } }
    else if (ge.y > hc.y || ge.y < lo) continue;
    if (t1 <= t0) continue;
    float f = 0.0;
    for (int k = 0; k < 4; k++) { vec3 Q = ge + dir * mix(t0, t1, (float(k) + 0.5) / 4.0); float s = (hc.y - Q.y) / max(-u_gd.y, 0.05);
      f += smoothstep(0.0, 0.9, s) * smoothstep(lo, u_gfl + 0.6, Q.y) * (1.0 - smoothstep(u_gw.w * 0.72, u_gw.w, length(Q.xz - u_gw.xz))) * exp(-s * 0.09)
         * (0.8 + 0.45 * glassHaze(Q * 0.6 + vec3(u_gtime * 0.11, -u_gtime * 0.05, u_gtime * 0.07))); }
    float w = min(1.0, (t1 - t0) / (0.6 * h.w)) * f * 0.25 * (0.88 + 0.12 * sin(u_gtime * 1.3 + float(i) * 2.1));
    sc += u_gc[i - (i / 6) * 6] * w; sw += w; }
  if (sw <= 0.0) return c;
  vec3 col = sc / sw; float a = min(sw, 1.6);
  if (u_gq > 0.0) { float th = (BAYER[(p.x & 3) + ((p.y & 3) << 2)] + 0.5) / 16.0 - 0.5; a = floor(a * u_gq + 0.5 + th * 0.5) / u_gq; }   // (stippled only near a level's edge)
  return c + col * a * u_gk;
}
vec3 glassAir(vec3 c, ivec2 p, float dn, vec2 res) {
  if (u_gk <= 0.0) return c;
  if (u_gm > 0.5) return glassGaps(c, p, dn, res);
  vec2 ndc = (vec2(p) + 0.5) / res * 2.0 - 1.0; vec3 rv = u_gortho > 0.5 ? vec3(0.0, 0.0, -1.0) : normalize(vec3(ndc.x * u_gcam.x, ndc.y * u_gcam.y, -1.0)), dir = transpose(mat3(u_gview)) * rv;
  vec3 ge = u_gortho > 0.5 ? u_geye + transpose(mat3(u_gview)) * vec3(ndc.x * u_gcam.x, ndc.y * u_gcam.y, 0.0) : u_geye;   // (orthographic: parallel lines of sight)
  float tmax = (u_gcam.z + min(dn, 1.0) * (u_gcam.w - u_gcam.z)) / max(-rv.z, 0.05);
  vec3 oc = ge - u_gw.xyz; float dd = dot(dir, u_gd), od = dot(oc, u_gd), A = 1.0 - dd * dd, Bq = dot(oc, dir) - od * dd, C = dot(oc, oc) - od * od - u_gw.w * u_gw.w, disc = Bq * Bq - A * C;
  if (A < 1e-5 || disc <= 0.0) return c;
  float sq = sqrt(disc), t0 = max((-Bq - sq) / A, 0.0), t1 = min((-Bq + sq) / A, tmax), tm = -Bq / A, tw = 0.3 * sq / A; if (t1 <= t0) return c;
  // (the middle of the beam counts for most: what is seen is mainly the row of panes straight through its axis, drawn out along the light, so the
  // shafts keep their own colours side by side; the rest of the depth adds a little of everything, which is the haze)
  float jit = fract(52.9829189 * fract(dot(vec2(p), vec2(0.06711056, 0.00583715)))), dt = (t1 - t0) / 32.0, T = 1.0; vec3 sc = vec3(0.0);
  for (int i = 0; i < 32; i++) { vec3 P = ge + dir * (t0 + (float(i) + jit) * dt); float s = (P.z - u_gw.z) / u_gd.z; if (s < 0.05 || P.y < -0.05) continue;
    float dens = (0.45 + 1.0 * glassHaze(P * 0.5 + vec3(u_gtime * 0.07, -u_gtime * 0.04, u_gtime * 0.05))) * exp(-s * 0.02);
    float tt = (t0 + (float(i) + jit) * dt - tm) / tw; sc += T * glassPane(P.xy - u_gd.xy * s - u_gw.xy) * dens * dt * (0.22 + 1.9 * exp(-tt * tt)); T *= exp(-dens * dt * 0.03); }
  float lum = dot(sc, vec3(0.3, 0.55, 0.15)); sc = max(vec3(0.0), mix(vec3(lum), sc, 1.45));
  return c * mix(1.0, T, 0.7) + sc * u_gk;
}
// with coloured contours on, the inside of things comes from the picture drawn at its own size: glass bends that picture and contact shade
// darkens it here, exactly as they do in the plain look below
#define PIXEL_NATIVE
vec3 pixelNative(ivec2 p) {
  ivec2 mx = textureSize(u_crispDepth, 0) - 1; vec3 c = texelFetch(u_crispScene, p, 0).rgb; vec4 dm = texelFetch(u_crispDepth, p, 0);
  vec2 gg = vec2(texelFetch(u_crispDepth, clamp(p + ivec2(1, 0), ivec2(0), mx), 0).g - texelFetch(u_crispDepth, clamp(p - ivec2(1, 0), ivec2(0), mx), 0).g, texelFetch(u_crispDepth, clamp(p + ivec2(0, 1), ivec2(0), mx), 0).g - texelFetch(u_crispDepth, clamp(p - ivec2(0, 1), ivec2(0), mx), 0).g);
  if (dm.g + abs(gg.x) + abs(gg.y) > 0.0) c = texelFetch(u_crispScene, clamp(p + ivec2(round(gg * u_refract)), ivec2(0), mx), 0).rgb;
  if (u_ao > 0.0) { float occ = 0.0; for (int i = 0; i < 8; i++) { float dd = (dm.r - texelFetch(u_crispDepth, clamp(p + AOT[i], ivec2(0), mx), 0).r) / u_aor; if (dd > 0.08 && dd < 3.0) occ += min(1.0, dd); } c *= 1.0 - u_ao * min(1.0, occ / 4.0); }
  return c;
}
${PixelLook.glsl}
// a hole a pixel across in a surface (its dabs, seen nearly edge on, leave gaps, and what lies under it or far behind shows through, as
// dark broken lines across the ground): it is drawn as the nearer of the pixels either side of it, which lie on the surface
ivec2 holeFill(ivec2 p) { ivec2 ms = textureSize(u_depth, 0) - 1; float d0 = texelFetch(u_depth, p, 0).r;
  // (colour per pixel knows which dab is in front at each pixel: a pixel with none, between two that have one, is a hole whatever the
  // depths say: dabs left out of outlines write none)
  if (u_pixOn > 0.5 && dabAt(p) < 0) for (int ax = 0; ax < 2; ax++) { ivec2 o = ax == 0 ? ivec2(0, 1) : ivec2(1, 0); if (dabAt(p + o) >= 0 && dabAt(p - o) >= 0) return p + o; }
  for (int ax = 0; ax < 2; ax++) { ivec2 o = ax == 0 ? ivec2(0, 1) : ivec2(1, 0), qa = clamp(p + o, ivec2(0), ms), qb = clamp(p - o, ivec2(0), ms);
    float da = texelFetch(u_depth, qa, 0).r, db = texelFetch(u_depth, qb, 0).r, gap = d0 - max(da, db);
    if (min(d0, min(da, db)) > -0.5 && gap > 0.004 && abs(da - db) < 0.6 * gap) return da < db ? qa : qb; }
  return p; }
// the finished colour of one pixel of the picture, in whichever look is on
vec3 plainAt(ivec2 p) {
  p = holeFill(p);
  vec3 c = texelFetch(u_scene, p, 0).rgb;
  g_pixed = false;
  if (u_pixOn > 0.5) { if (u_sprOn > 0.5) {
${water ? '      vec4 sl = texelFetch(u_sprLayer, p, 0); if (sl.a > 0.5) { g_spr = true; g_pixed = true; return sl.rgb; }' :
      '      vec4 sl = texelFetch(u_sprLayer, p, 0) * 255.0; if (sl.a > 127.0) { int v = int(sl.r + 0.5), ci = v >= 100 ? v - 100 : rampAt(int(sl.g + 0.5), int(sl.b + 0.5) + v - 8); g_spr = true; g_pixed = true; return u_pal[clamp(ci, 0, 63)]; }'} }
    c = pixColour(p, c); }
  // outline: this pixel sits clearly behind a neighbour, so it is the edge of something nearer
  ivec2 mx = textureSize(u_depth, 0) - 1;
  float dc = texelFetch(u_depth, p, 0).r;
  float dl = texelFetch(u_depth, clamp(p - ivec2(1, 0), ivec2(0), mx), 0).r, dr = texelFetch(u_depth, clamp(p + ivec2(1, 0), ivec2(0), mx), 0).r;
  float du = texelFetch(u_depth, clamp(p + ivec2(0, 1), ivec2(0), mx), 0).r, db = texelFetch(u_depth, clamp(p - ivec2(0, 1), ivec2(0), mx), 0).r;
  // glass bends what is behind it: the picture is looked up a little to one side, by how the thickness of glass changes across this pixel
  { vec2 gg = vec2(texelFetch(u_depth, clamp(p + ivec2(1, 0), ivec2(0), mx), 0).g - texelFetch(u_depth, clamp(p - ivec2(1, 0), ivec2(0), mx), 0).g, texelFetch(u_depth, clamp(p + ivec2(0, 1), ivec2(0), mx), 0).g - texelFetch(u_depth, clamp(p - ivec2(0, 1), ivec2(0), mx), 0).g);
    if (texelFetch(u_depth, p, 0).g + abs(gg.x) + abs(gg.y) > 0.0) c = texelFetch(u_scene, clamp(p + ivec2(round(gg * u_refract)), ivec2(0), mx), 0).rgb; }
  // where a diorama asks for it, a pixel with nearer things close round it is shaded: what moves still sits in its own shadow
  if (u_ao > 0.0) { float occ = 0.0;
    for (int i = 0; i < 8; i++) { float dd = (dc - texelFetch(u_depth, clamp(p + AOT[i], ivec2(0), mx), 0).r) / u_aor; if (dd > 0.08 && dd < 3.0) occ += min(1.0, dd); } c *= 1.0 - u_ao * min(1.0, occ / 4.0); }
  // part lines (a diorama's look.lines): the near side of a break in depth takes a darker shade of its own colour, or a lighter one
  // where the break is toward the light (up or to the left), as pixel art outlines a thing. (Second differences, so a floor that
  // only recedes is not a break)
  float dl2 = texelFetch(u_depth, clamp(p - ivec2(2, 0), ivec2(0), mx), 0).r, dr2 = texelFetch(u_depth, clamp(p + ivec2(2, 0), ivec2(0), mx), 0).r;
  float du2 = texelFetch(u_depth, clamp(p + ivec2(0, 2), ivec2(0), mx), 0).r, db2 = texelFetch(u_depth, clamp(p - ivec2(0, 2), ivec2(0), mx), 0).r;
  // (a dab left out of outlines writes no depth, -1: a neighbour like that is taken as level with this pixel, and such a pixel takes
  // no line, so where one ground that is left out meets one that is not, no line runs along the seam)
  if (dl < -0.5) dl = dc; if (dr < -0.5) dr = dc; if (du < -0.5) du = dc; if (db < -0.5) db = dc; if (dl2 < -0.5) dl2 = dc; if (dr2 < -0.5) dr2 = dc; if (du2 < -0.5) du2 = dc; if (db2 < -0.5) db2 = dc;
  // (a break in depth must show two pixels out as well as one: a hole in a surface, a pixel wide, where what lies under it shows
  // through, is not the edge of anything)
  if (u_lines > 0.0 && dc > -0.5 && !(g_pixed && u_ol > 0.5)) { float sx = min(dl + dr, dl2 + dr2) - 2.0 * dc, sy = min(du + db, du2 + db2) - 2.0 * dc;
    if (max(sx, sy) > u_lineGap) { bool litSide = sx >= sy ? dl > dr : du > db; c *= litSide ? u_lineLit : u_lineK; } }
  float dm = dc - max(2.0 * dc - min(dl + dr, dl2 + dr2), 2.0 * dc - min(du + db, du2 + db2));   // second difference, so a receding floor is not an edge
  if (u_edge > 0.0 && dc > -0.5 && dc - dm > u_edge) c = u_line;
  else {
    float th = (BAYER[(p.x & 3) + ((p.y & 3) << 2)] + 0.5) / 16.0 - 0.5;
    c = clamp(c + th * u_dither, 0.0, 1.0);
  }
  if (u_toneOn > 0.5) { float lu = dot(c, vec3(0.30, 0.55, 0.15)); if (lu <= u_toneCut) return vec3(0.0);
    float v = (lu - u_toneCut) / (1.0 - u_toneCut); int lo = 0; for (int i = 0; i < 46; i++) { if (lo >= u_toneN - 2 || v <= texelFetch(u_toneStops, ivec2(lo + 1, 0), 0).a) break; lo++; }
    vec4 s0 = texelFetch(u_toneStops, ivec2(lo, 0), 0), s1 = texelFetch(u_toneStops, ivec2(lo + 1, 0), 0); ivec2 th = textureSize(u_toneTh, 0), sz = textureSize(u_depth, 0);
    float share = (v - s0.a) / max(1e-5, s1.a - s0.a), rank = texelFetch(u_toneTh, ivec2(p.x % th.x, (sz.y - 1 - p.y) % th.y), 0).r;
    return share >= 0.5 + (rank - 0.5) * u_toneAmt ? s1.rgb : s0.rgb; }
  vec3 best = u_pal[0]; float bd = 1e9; int bi = 0;
  for (int i = 0; i < 64; i++) {
    if (i >= u_n) break;
    vec3 df = c - u_pal[i];
    float d = u_luma > 0.5 ? abs(dot(df, vec3(0.299, 0.587, 0.114))) : dot(df * df, vec3(0.30, 0.55, 0.15));
    if (d < bd) { bd = d; best = u_pal[i]; bi = i; }
  }
  bool lit = texelFetch(u_depth, p, 0).b > 0.3 + ((BAYER[(p.x & 3) + ((p.y & 3) << 2)] + 0.5) / 16.0 - 0.5) * 0.3;
  return glassAir(u_grade > 0.5 ? (lit ? u_outl[bi] : u_out[bi]) : best, p, dc, vec2(textureSize(u_depth, 0)));
}
bool like(vec3 a, vec3 b) { vec3 d = abs(a - b); return max(d.r, max(d.g, d.b)) < 0.004; }
vec3 lookAt(ivec2 p) {
  if (u_colored > 0.5) { vec3 c = pixelResolve(p); vec4 dq = texelFetch(u_crispDepth, p, 0);
    if (u_grade > 0.5 && dq.b > 0.3 + ((BAYER[(p.x & 3) + ((p.y & 3) << 2)] + 0.5) / 16.0 - 0.5) * 0.3) { for (int j = 0; j < 64; j++) { if (j >= u_n) break; if (like(c, u_out[j])) { c = u_outl[j]; break; } } }   // under a carried light
    return glassAir(c, p, dq.r, vec2(textureSize(u_crispScene, 0))); }
  return plainAt(p);
}
float depthAt(ivec2 p) { return u_colored > 0.5 ? texelFetch(u_crispDepth, p, 0).r : texelFetch(u_depth, p, 0).r; }
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (u_bars > 0.0 && abs(gl_FragCoord.y / float(textureSize(u_crispScene, 0).y) - 0.5) > 0.5 - u_bars) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }   /* letterbox bars, when a diorama asks for them */
${water ? '  p = waterPixel(p);' : ''}
  if (u_bypass > 0.5) { o = vec4(texelFetch(u_scene, p, 0).rgb, 1.0); return; }
  vec3 c0 = lookAt(p);
  o = vec4(c0, g_spr && u_markA > 0.5 ? 0.5 : 1.0);   // (an edge sprite is marked for the clean-up pass, which leaves it as drawn)
}`;
  const CLEAN_FS = `#version 300 es
precision highp float;
uniform sampler2D u_look, u_dep;
uniform float u_keep, u_lineClean;
out vec4 o;
bool like(vec3 a, vec3 b) { vec3 d = abs(a - b); return max(d.r, max(d.g, d.b)) < 0.004; }
vec3 at(ivec2 p) { return texelFetch(u_look, clamp(p, ivec2(0), textureSize(u_look, 0) - 1), 0).rgb; }
float dp(ivec2 p) { ivec2 q = clamp(p, ivec2(0), textureSize(u_dep, 0) - 1); return texelFetch(u_look, q, 0).a < 0.75 ? 0.5 : texelFetch(u_dep, q, 0).r; }
const ivec2 N8[8] = ivec2[8](ivec2(-1, 0), ivec2(1, 0), ivec2(0, -1), ivec2(0, 1), ivec2(-1, -1), ivec2(1, -1), ivec2(-1, 1), ivec2(1, 1));
int likes(ivec2 p, vec3 c, out ivec2 one) { int n = 0; one = p; for (int i = 0; i < 8; i++) if (like(c, at(p + N8[i]))) { n++; one = p + N8[i]; } return n; }
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy); vec3 c0 = at(p); ivec2 q, q2;
  if (texelFetch(u_look, p, 0).a < 0.75) { o = vec4(c0, 1.0); return; }   // (an edge sprite, drawn as its author drew it)
  // outlines: a notch (an empty pixel with things on three or four sides) is filled from them, a bump (a pixel of a thing with
  // nothing on three or four sides) is taken off, so the edge of a thing against the background runs clean
  { bool e0 = dp(p) >= 0.995; int en = 0, ni = -1; for (int i = 0; i < 4; i++) { bool ei = dp(p + N8[i]) >= 0.995; if (ei) en++; if (ei != e0) ni = i; }
    if (e0 && en <= 1) { int kb = 0, ib = -1; for (int i = 0; i < 4; i++) { if (dp(p + N8[i]) >= 0.995) continue; int k = 0; for (int j = 0; j < 4; j++) if (like(at(p + N8[i]), at(p + N8[j]))) k++; if (k > kb) { kb = k; ib = i; } }
      if (ib >= 0) { o = vec4(at(p + N8[ib]), 1.0); return; } }
    if (!e0 && en >= 3) { for (int i = 0; i < 4; i++) if (dp(p + N8[i]) >= 0.995) { o = vec4(at(p + N8[i]), 1.0); return; } } }
  /* the line cleaner (an option): a one-pixel kink in a straight edge between two colours is taken off (a pixel with one colour across
     from it and on both sides, its own colour carrying on straight behind it, takes the other colour: a bump, or a dent, filled);
     and on a dark line one pixel thick, the extra pixel at the inside corner of a step (a double) takes the colour beside it, so the
     line meets corner to corner as a pixel artist draws it */
  if (u_lineClean > 0.5) {
    for (int k = 0; k < 4; k++) { ivec2 d = N8[k], e = ivec2(d.y, d.x); vec3 X = at(p + d);
      if (like(X, c0) || !like(at(p + e), X) || !like(at(p - e), X)) continue;
      if (like(at(p - d), c0) && like(at(p - d + e), c0) && like(at(p - d - e), c0)) { o = vec4(X, 1.0); return; } }
    float l0 = dot(c0, vec3(0.3, 0.55, 0.15));
    for (int k = 4; k < 8; k++) { ivec2 dg = N8[k], h = ivec2(dg.x, 0), v = ivec2(0, dg.y);
      if (!like(at(p + h), c0) || !like(at(p + v), c0) || like(at(p + dg), c0) || like(at(p - h), c0) || like(at(p - v), c0)) continue;
      // (the line goes on past both arms, and is darker than what lies on the other side of the corner)
      bool goH = like(at(p + 2 * h), c0) || like(at(p + 2 * h - v), c0), goV = like(at(p + 2 * v), c0) || like(at(p + 2 * v - h), c0);
      vec3 a = at(p - h), b = at(p - v);
      if (goH && goV && dot(a, vec3(0.3, 0.55, 0.15)) > l0 + 0.06 && dot(b, vec3(0.3, 0.55, 0.15)) > l0 + 0.06) { o = vec4(like(a, b) ? a : at(p - h - v), 1.0); return; } } }
  int n = likes(p, c0, q);
  bool speck = n == 0 || (n == 1 && likes(q, c0, q2) == 1);
  if (speck) {
    vec3 nb[8]; for (int i = 0; i < 8; i++) nb[i] = at(p + N8[i]);
    int kb = 0; int ib = 0;
    for (int i = 0; i < 8; i++) { if (like(nb[i], c0)) continue; int k = 0; for (int j = 0; j < 8; j++) if (like(nb[i], nb[j])) k++; if (k > kb) { kb = k; ib = i; } }
    float lum0 = dot(c0, vec3(0.3, 0.55, 0.15)), lum1 = dot(nb[ib], vec3(0.3, 0.55, 0.15));
    if (kb >= 3 && abs(dp(p) - dp(p + N8[ib])) < 0.03 && abs(lum0 - lum1) < u_keep) c0 = nb[ib];
  }
  o = vec4(c0, 1.0);
}`;
  const DAMP_FS = `#version 300 es
precision highp float;
uniform sampler2D u_cur, u_hist, u_dep; uniform vec3 u_pal[64]; uniform int u_n; uniform float u_have;
uniform mat4 u_iview, u_pvp; uniform vec4 u_cam; uniform vec2 u_rng;
out vec4 o;
int idxOf(vec3 c) { for (int i = 0; i < 64; i++) { if (i >= u_n) break; vec3 d = abs(c - u_pal[i]); if (max(d.r, max(d.g, d.b)) < 0.006) return i; } return -1; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy), sz = textureSize(u_cur, 0); vec3 c = texelFetch(u_cur, p, 0).rgb; int ci = idxOf(c);
  o = vec4(c, float(ci + 1) / 255.0);
  if (u_have < 0.5 || ci < 0) return;
  float dn = texelFetch(u_dep, p, 0).r; ivec2 q = p;
  if (dn < 0.995) { float z = -(u_rng.x + dn * (u_rng.y - u_rng.x)); vec2 ndc = (vec2(p) + 0.5) / vec2(sz) * 2.0 - 1.0;
    vec3 v = u_cam.z > 0.5 ? vec3(ndc.x * u_cam.x * u_cam.y, ndc.y * u_cam.x, z) : vec3(ndc.x * u_cam.x * u_cam.y * -z, ndc.y * u_cam.x * -z, z);
    vec4 pc = u_pvp * (u_iview * vec4(v, 1.0)); q = ivec2(floor((pc.xy / pc.w * 0.5 + 0.5) * vec2(sz))); }
  if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) return;
  vec4 h = texelFetch(u_hist, q, 0); int prev = int(h.a * 255.0 + 0.5) - 1;
  if (prev >= 0 && ci != prev) o.rgb = h.rgb; }`;
  const COPY_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src; out vec4 o;
void main() { o = vec4(texelFetch(u_src, ivec2(gl_FragCoord.xy), 0).rgb, 1.0); }`;
  const SPR_VS = `#version 300 es
precision highp float; precision highp int;
uniform highp sampler2D u_anc, u_dat, u_sprTex; uniform mat4 u_view, u_proj; uniform vec2 u_vp, u_rng; uniform float u_time, u_keep, u_ortho; uniform vec4 u_rmpN4[16];
flat out ivec2 v_a; flat out ivec4 v_i; flat out float v_dA; flat out vec3 v_P, v_N;
vec4 sprT(int x, int y) { return texelFetch(u_sprTex, ivec2(x, y), 0); }
int rlen(int r) { return int(u_rmpN4[r >> 2][r & 3] + 0.5) & 15; }
void main() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  int i = gl_InstanceID; ivec2 b = ivec2((i & 255) * 3, i >> 8);
  vec4 t0 = texelFetch(u_anc, b, 0), t1 = texelFetch(u_anc, b + ivec2(1, 0), 0), t2 = texelFetch(u_anc, b + ivec2(2, 0), 0);
  int k = int(t2.x + 0.5); vec4 E0 = sprT(0, k), E1 = sprT(1, k);
  if (t1.w >= u_keep * E1.w) return;
  int j = int(t0.w + 0.5); vec4 m2 = texelFetch(u_dat, ivec2(((j & 511) << 2) + 2, j >> 9), 0), m3 = texelFetch(u_dat, ivec2(((j & 511) << 2) + 3, j >> 9), 0);
  vec3 pos = t0.xyz;
  if (int(m2.w + 0.5) % 16 == 11) { pos.x += m3.z * sin(u_time * m3.y + pos.y * 1.3 + pos.z * 0.9 + m3.x); pos.y += m3.z * 0.6 * sin(u_time * m3.y * 1.3 + pos.x * 1.1 + m3.x); }
  vec4 cam = u_view * vec4(pos, 1.0); if (cam.z > -0.05) return;
  vec4 clip = u_proj * cam; ivec2 a = ivec2(floor((clip.xy / clip.w * 0.5 + 0.5) * u_vp));
  vec3 N = t1.xyz, vn = mat3(u_view) * N, c = cam.xyz;
  float facing = u_ortho > 0.5 ? -vn.z : dot(vn, c) / length(c); if (abs(facing) > 0.95) return;
  vec2 dir = u_ortho > 0.5 ? vn.xy : vec2(-vn.x * c.z + c.x * vn.z, -vn.y * c.z + c.y * vn.z); float dl = length(dir); if (dl < 1e-12) return; dir /= dl;
  int cat = dir.y > 0.38 ? 0 : dir.y < -0.38 ? 3 : dir.x > 0.0 ? 1 : 2;
  float first = cat == 0 ? E0.x : cat == 3 ? E1.x : E0.z, cnt = cat == 0 ? E0.y : cat == 3 ? E1.y : E0.w; if (cnt < 0.5) return;
  int s = int(first + 0.5) + min(int(cnt + 0.5) - 1, int(floor(t2.w * cnt))), r = int(t2.y + 0.5), band = clamp(int(floor(t2.z * float(rlen(r)))), 0, rlen(r) - 1);
  float dA = clamp((-cam.z - u_rng.x) / (u_rng.y - u_rng.x), 0.0, 1.0);
  vec2 corner = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  gl_Position = vec4((vec2(a) + 0.5 + corner * 8.0) / u_vp * 2.0 - 1.0, dA * 2.0 - 1.0, 1.0);
  v_a = a; v_i = ivec4(s, cat, r, band); v_dA = dA; v_P = pos; v_N = N; }`;
  const SPR_FS = `#version 300 es
precision highp float; precision highp int;
uniform highp sampler2D u_sprTex, u_depth, u_idxTex, u_pixTex, u_dat; uniform mat4 u_pview; uniform vec3 u_peye; uniform float u_tanF, u_asp, u_portho, u_eGap, u_tol;
flat in ivec2 v_a; flat in ivec4 v_i; flat in float v_dA; flat in vec3 v_P, v_N;
out vec4 o;
${water ? waterGLSL + `
uniform vec3 u_waterSpritePalette[64];
uniform vec4 u_rmp4[128], u_rmpN4[16];
int spriteColor(int v) {
  if (v >= 100) return clamp(v - 100, 0, 63);
  int index = v_i.z;
  int count = int(u_rmpN4[index >> 2][index & 3] + 0.5) & 15;
  int offset = index * 8 + clamp(v_i.w + v - 8, 0, max(0, count - 1));
  return clamp(int(u_rmp4[offset >> 2][offset & 3] + 0.5), 0, 63);
}
` : ''}
const ivec2 EOD[4] = ivec2[4](ivec2(0, 1), ivec2(1, 0), ivec2(-1, 0), ivec2(0, -1)), ETD[4] = ivec2[4](ivec2(1, 0), ivec2(0, -1), ivec2(0, 1), ivec2(1, 0));
vec4 sprT(int x, int y) { return texelFetch(u_sprTex, ivec2(x, y), 0); }
int dabAt(ivec2 q) { ivec2 s = textureSize(u_idxTex, 0); if (q.x < 0 || q.y < 0 || q.x >= s.x || q.y >= s.y) return -1;
  vec4 e = texelFetch(u_idxTex, q, 0) * 255.0; return int(e.r + 0.5) + int(e.g + 0.5) * 256 + int(e.b + 0.5) * 65536 - 1; }
vec4 pixA(int i) { return texelFetch(u_pixTex, ivec2((i & 1023) * 2, i >> 10), 0); }
vec4 pixB(int i) { return texelFetch(u_pixTex, ivec2((i & 1023) * 2 + 1, i >> 10), 0); }
vec3 hitAt(ivec2 q, int i, vec3 n) { ivec2 sz = textureSize(u_idxTex, 0);
  vec3 v = vec3(((float(q.x) + 0.5) / float(sz.x) * 2.0 - 1.0) * u_tanF * u_asp, ((float(q.y) + 0.5) / float(sz.y) * 2.0 - 1.0) * u_tanF, -1.0);
  vec3 o0 = u_portho > 0.5 ? u_peye + transpose(mat3(u_pview)) * vec3(v.xy, 0.0) : u_peye;
  vec3 d = transpose(mat3(u_pview)) * (u_portho > 0.5 ? vec3(0.0, 0.0, -1.0) : v); vec3 c = texelFetch(u_dat, ivec2((i & 511) << 2, i >> 9), 0).xyz;
  float den = dot(n, d), s = abs(den) > 1e-6 ? dot(n, c - o0) / den : 0.0; return s > 0.0 ? o0 + d * s : c; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy), d = p - v_a, od = EOD[v_i.y], td = ETD[v_i.y]; int s = v_i.x;
  vec4 I = sprT(0, 32 + s); int w = int(I.x + 0.5), h = int(I.y + 0.5), sk = int(I.w + 0.5), rr = d.x * od.x + d.y * od.y - 1 + sk, cc = d.x * td.x + d.y * td.y + int(I.z + 0.5);
  if (rr < 0 || rr >= h || cc < 0 || cc >= w) discard;
  int k = rr * w + cc; vec4 t = sprT(1 + (k >> 2), 32 + s); int v = int(t[k & 3] + 0.5); if (v == 0) discard;
  float dp = texelFetch(u_depth, p, 0).r;
  if (dp < 0.995) {
    if (dp < v_dA - 0.008) discard;   // (something nearer stands here)
    if (rr >= sk) { int j = dabAt(p); bool other;   // (the root rows lie over the thing itself; the rest only past its own surface)
      if (j < 0 || pixA(j).x < 0.5) other = dp - v_dA > u_eGap;
      else { vec4 A = pixA(j), B = pixB(j); other = abs(dot(hitAt(p, j, vec3(A.w, B.x, B.y)) - v_P, v_N)) > u_tol; }
      if (!other) discard; } }
  ${water ? `vec3 mark;
  float axial = -(u_waterView * vec4(v_P, 1.0)).z;
  o = vec4(waterPaint(u_waterSpritePalette[spriteColor(v)], gl_FragCoord.xy,
    vec2(textureSize(u_depth, 0)), axial, mark), 1.0);` :
    'o = vec4(float(v), float(v_i.z), float(v_i.w), 255.0) / 255.0;'} }`;
  const KEY_FS = POST_FS.replace('out vec4 o;', 'out ivec4 o;').replace(/void main\(\)\{[\s\S]*$/, 'void main(){ ivec2 p = ivec2(gl_FragCoord.xy); ivec3 k = keyCalc(p); o = ivec4(k, k.x == -99999 ? 0 : 1); }');
  return { POST_VS, POST_FS, KEY_FS, CLEAN_FS, DAMP_FS, COPY_FS, SPR_VS, SPR_FS };
}
