// Fish and junk, built in code from species.js: a lofted body per look.shape, the pattern painted into a small
// canvas texture, fins with rays, glassy eyes. Every mesh is 1 unit long (nose at -z); the caller scales it by length.
// A fish is 3 draw calls: body (a hooked jaw is part of it), eyes, fins (barbels are part of them).
import * as THREE from "three";
import { byId } from "./species.js";
import { bake, merge, hex, clamp, lerp, smooth } from "./world-env.js";

// Body forms, as fractions of the total length. top/bot = back and belly height, wid = half width,
// peak = where the body is deepest (0 nose .. 1 tail root), ped = how thin the tail root is, zp = where the tail fin starts.
const FORM = {
  sunfish: { top: 0.25, bot: 0.215, wid: 0.068, peak: 0.44, ped: 0.22, zp: 0.27, nose: 0.34, eye: 0.03, eyeT: 0.14, tailH: 0.12, fork: 0.018,
    dorsal: [{ z0: -0.19, z1: 0.02, h: 0.1, n: 10 }, { z0: 0.02, z1: 0.25, h: 0.12 }], anal: [{ z0: 0.02, z1: 0.24, h: 0.11, n: 3 }], pec: 0.13 },
  perch: { top: 0.115, bot: 0.085, wid: 0.062, peak: 0.36, ped: 0.27, zp: 0.3, nose: 0.28, eye: 0.024, eyeT: 0.11, tailH: 0.1, fork: 0.07,
    dorsal: [{ z0: -0.2, z1: 0.03, h: 0.1, n: 13, blotch: true }, { z0: 0.07, z1: 0.23, h: 0.075 }], anal: [{ z0: 0.1, z1: 0.23, h: 0.065, n: 2 }], pec: 0.09 },
  bass: { top: 0.13, bot: 0.105, wid: 0.074, peak: 0.42, ped: 0.28, zp: 0.3, nose: 0.38, eye: 0.022, eyeT: 0.1, tailH: 0.11, fork: 0.035,
    dorsal: [{ z0: -0.14, z1: 0.06, h: 0.08, n: 10 }, { z0: 0.06, z1: 0.24, h: 0.09 }], anal: [{ z0: 0.1, z1: 0.24, h: 0.07, n: 3 }], pec: 0.1 },
  walleye: { top: 0.092, bot: 0.08, wid: 0.066, peak: 0.4, ped: 0.3, zp: 0.3, nose: 0.3, eye: 0.03, eyeT: 0.095, tailH: 0.1, fork: 0.075,
    dorsal: [{ z0: -0.16, z1: 0.04, h: 0.085, n: 13, blotch: true }, { z0: 0.08, z1: 0.25, h: 0.065 }], anal: [{ z0: 0.12, z1: 0.25, h: 0.065, n: 2 }], pec: 0.08 },
  pike: { top: 0.066, bot: 0.064, wid: 0.057, peak: 0.58, ped: 0.45, zp: 0.34, nose: 0.2, eye: 0.019, eyeT: 0.1, tailH: 0.085, fork: 0.055, snout: true,
    dorsal: [{ z0: 0.15, z1: 0.31, h: 0.075 }], anal: [{ z0: 0.17, z1: 0.31, h: 0.06 }], pec: 0.07 },
  trout: { top: 0.094, bot: 0.086, wid: 0.068, peak: 0.42, ped: 0.26, zp: 0.3, nose: 0.3, eye: 0.021, eyeT: 0.09, tailH: 0.115, fork: 0.1,
    dorsal: [{ z0: -0.07, z1: 0.09, h: 0.085 }, { z0: 0.2, z1: 0.25, h: 0.022, adipose: true }], anal: [{ z0: 0.13, z1: 0.24, h: 0.065 }], pec: 0.085 },
  // The big-water shapes. Fin options: n = ray points along the edge, valley = how deep between them (of h), rake = tip swept
  // back (a sickle fin), adipose = the small fat fin. Body options: beak = the front t fraction is a thin jaw, flatHead = a wide,
  // low head, cone = how sharp the nose is (default 0.8, more is pointier), eyeC = the eye's height on the head (0 side .. 1 top,
  // default 0.34), finlets = [z0, z1, h, n] little fins on the tail root, top and belly. Tail options: fork < 0 = a round tail,
  // crescent = how hollow the back edge is (default 0.6), lunate = where the front edge bends.
  tuna: { top: 0.14, bot: 0.13, wid: 0.1, peak: 0.42, ped: 0.12, zp: 0.36, nose: 0.16, cone: 1.25, eye: 0.019, eyeT: 0.085, tailH: 0.18, fork: 0.09, crescent: 1, lunate: 0.4, eyeC: 0.12,
    dorsal: [{ z0: -0.14, z1: -0.02, h: 0.085, rake: 0.8 }, { z0: 0.05, z1: 0.14, h: 0.11, rake: 1 }], anal: [{ z0: 0.09, z1: 0.17, h: 0.09, rake: 1 }],
    finlets: [0.18, 0.335, 0.036, 6], pec: 0.15 },
  cod: { top: 0.12, bot: 0.11, wid: 0.075, peak: 0.34, ped: 0.22, zp: 0.3, nose: 0.4, eye: 0.03, eyeT: 0.09, tailH: 0.11, fork: -0.01,
    dorsal: [{ z0: -0.27, z1: -0.13, h: 0.075 }, { z0: -0.1, z1: 0.05, h: 0.08 }, { z0: 0.08, z1: 0.22, h: 0.065 }],
    anal: [{ z0: -0.02, z1: 0.11, h: 0.07 }, { z0: 0.13, z1: 0.24, h: 0.06 }], pec: 0.1 },
  striper: { top: 0.115, bot: 0.1, wid: 0.07, peak: 0.4, ped: 0.24, zp: 0.3, nose: 0.34, eye: 0.022, eyeT: 0.1, tailH: 0.105, fork: 0.06,
    dorsal: [{ z0: -0.17, z1: 0.0, h: 0.085, n: 10 }, { z0: 0.07, z1: 0.23, h: 0.08 }], anal: [{ z0: 0.09, z1: 0.24, h: 0.07, n: 3 }], pec: 0.1 },
  salmon: { top: 0.115, bot: 0.1, wid: 0.075, peak: 0.42, ped: 0.26, zp: 0.3, nose: 0.3, eye: 0.021, eyeT: 0.09, tailH: 0.115, fork: 0.07,
    dorsal: [{ z0: -0.08, z1: 0.08, h: 0.09 }, { z0: 0.2, z1: 0.25, h: 0.024, adipose: true }], anal: [{ z0: 0.12, z1: 0.24, h: 0.07, n: 4 }], pec: 0.09 },
  catfish: { top: 0.1, bot: 0.1, wid: 0.09, peak: 0.3, ped: 0.3, zp: 0.3, nose: 0.55, eye: 0.014, eyeT: 0.1, tailH: 0.105, fork: 0.09, flatHead: true,
    dorsal: [{ z0: -0.24, z1: -0.14, h: 0.1 }, { z0: 0.2, z1: 0.26, h: 0.03, adipose: true }], anal: [{ z0: 0.0, z1: 0.24, h: 0.07, n: 14 }], pec: 0.11 },
  gar: { top: 0.055, bot: 0.05, wid: 0.045, peak: 0.55, ped: 0.4, zp: 0.36, nose: 0.9, eye: 0.015, eyeT: 0.3, tailH: 0.07, fork: -0.02, beak: 0.28,
    dorsal: [{ z0: 0.17, z1: 0.32, h: 0.06 }], anal: [{ z0: 0.17, z1: 0.31, h: 0.05 }], pec: 0.06 },
  bowfin: { top: 0.1, bot: 0.09, wid: 0.075, peak: 0.35, ped: 0.35, zp: 0.34, nose: 0.38, eye: 0.02, eyeT: 0.1, tailH: 0.1, fork: -0.03,
    dorsal: [{ z0: -0.1, z1: 0.3, h: 0.065, n: 26, valley: 0.8 }], anal: [{ z0: 0.12, z1: 0.2, h: 0.04 }], pec: 0.09 },
};
export const FORMS = FORM;
// the form for a species: the shape, with the girth (body depth x) from its look
function formOf(sp) {
  const lk = sp.look, F = FORM[lk.shape] || FORM.bass, g = lk.girth || 1;
  return g === 1 && !lk.kype && !lk.barbels ? F : { ...F, top: F.top * g, bot: F.bot * g, wid: F.wid * (0.4 + 0.6 * g), kype: !!lk.kype, barbels: lk.barbels || 0 };
}

// the body outline: grows from a blunt nose to the deepest point, then thins to the tail root
function env(t, pk, nose, ped, cone = 0.8) {
  if (t < pk) return nose + (1 - nose) * Math.sin((t / pk) * Math.PI / 2) ** cone;
  const u = (t - pk) / (1 - pk);
  return ped + (1 - ped) * (0.5 + 0.5 * Math.cos(u * Math.PI));
}
function profile(F, t) {
  let top = F.top * env(t, F.peak, F.nose, F.ped, F.cone), bot = F.bot * env(t, Math.min(0.8, F.peak + 0.1), F.nose * 0.9, F.ped * 1.05, F.cone);
  let wid = F.wid * env(t, Math.max(0.2, F.peak - 0.12), Math.min(1, F.nose * 1.5), F.ped * 0.55, F.cone);
  if (F.snout) { const k = smooth(0, 0.24, t); top *= 0.42 + 0.58 * k; bot *= 0.55 + 0.45 * k; wid *= 0.78 + 0.22 * k; }
  if (F.beak) { const k = 0.3 + 0.7 * smooth(F.beak * 0.72, F.beak * 1.2, t); top *= k; bot *= k; wid *= k; }
  if (F.kype) top *= 0.75 + 0.25 * smooth(0, 0.16, t);
  if (F.flatHead) { const k = smooth(0.16, 0.4, t); top *= 0.5 + 0.5 * k; wid *= 1.22 - 0.22 * k; }
  return { top, bot, wid, z: -0.5 + t * (F.zp + 0.5) };
}
const tAt = (F, z) => clamp((z + 0.5) / (F.zp + 0.5), 0, 1);

/* ---------------- the painted skin ---------------- */

// where the gill cover and the mouth end on the skin (0..1 along the body), by shape
const GILL = { pike: 0.2, sunfish: 0.24, tuna: 0.21, cod: 0.22, salmon: 0.21, catfish: 0.23, gar: 0.38, bowfin: 0.22, striper: 0.22 };
const MOUTH = { bass: 0.13, pike: 0.16, walleye: 0.1, sunfish: 0.04, tuna: 0.09, cod: 0.11, striper: 0.12, salmon: 0.09, catfish: 0.12, gar: 0.27, bowfin: 0.1 };
const texCache = new Map(), eyeCache = new Map();
function skinTexture(sp) {
  if (texCache.has(sp.id)) return texCache.get(sp.id);
  const W = 512, H = 192, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d"), lk = sp.look, shape = lk.shape;
  let seed = [...sp.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // back to belly
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, lk.back); g.addColorStop(0.16, lk.back); g.addColorStop(0.42, lk.body); g.addColorStop(0.64, lk.body); g.addColorStop(0.84, lk.belly); g.addColorStop(1, lk.belly);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const U = (u) => u * W, V = (v) => v * H;
  const blob = (u, v, rw, rh, col, a = 1, rot = 0) => { x.save(); x.globalAlpha = a; x.fillStyle = col; x.translate(U(u), V(v)); x.rotate(rot); x.beginPath(); x.ellipse(0, 0, rw * W, rh * H, 0, 0, Math.PI * 2); x.fill(); x.restore(); };
  const soft = (a) => { x.filter = a ? "blur(" + a + "px)" : "none"; };
  // patterns
  const p = lk.pattern;
  if (p === "bars" && shape === "tuna") {
    // mackerel: dark wavy lines down the blue back, fading out before the belly
    soft(1);
    x.strokeStyle = lk.accent; x.lineWidth = 3.4; x.lineCap = "round";
    for (let i = 0; i < 21; i++) {
      const u0 = 0.2 + i * 0.038 + rnd() * 0.006;
      x.globalAlpha = 0.8; x.beginPath();
      for (let k = 0; k <= 12; k++) { const v = 0.03 + k / 12 * 0.4, u = u0 + v * 0.05 + Math.sin(k * 1.25 + i * 2.1) * 0.011; k ? x.lineTo(U(u), V(v)) : x.moveTo(U(u), V(v)); }
      x.stroke();
    }
    soft(0); x.globalAlpha = 1;
  } else if (p === "bars") {
    const n = shape === "perch" ? 7 : shape === "pike" ? 11 : 10, faint = shape === "bass";
    soft(faint ? 3 : 1.5);
    for (let i = 0; i < n; i++) {
      const u = 0.24 + (i + 0.5) / n * 0.7, w = (shape === "perch" ? 0.045 : 0.028) * (1 - i / n * 0.3);
      x.globalAlpha = faint ? 0.5 : shape === "pike" ? 0.5 : 0.75;
      // bass bars are dark bronze (their accent colour is the red eye)
      x.fillStyle = shape === "pike" ? "#3e3a24" : shape === "bass" ? "#3a2a14" : lk.accent;
      x.beginPath();
      x.moveTo(U(u - w), V(0.05)); x.lineTo(U(u + w), V(0.05)); x.lineTo(U(u + w * 0.35 + 0.01), V(shape === "perch" ? 0.66 : 0.72)); x.lineTo(U(u - w * 0.35 + 0.01), V(shape === "perch" ? 0.66 : 0.72));
      x.closePath(); x.fill();
    }
    soft(0); x.globalAlpha = 1;
    if (shape === "bass") for (let i = 0; i < 3; i++) { x.strokeStyle = "rgba(60,40,20,0.6)"; x.lineWidth = 4; x.beginPath(); x.moveTo(U(0.1), V(0.32 + i * 0.07)); x.lineTo(U(0.2), V(0.36 + i * 0.1)); x.stroke(); }
  } else if (p === "lines") {
    // striped bass: 7 dark lines along the flank, from the gill to the tail root
    soft(1); x.strokeStyle = lk.accent; x.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const v = 0.25 + i * 0.066;
      x.globalAlpha = 0.95 - i * 0.03; x.lineWidth = 4.6 - i * 0.2;
      x.beginPath();
      for (let k = 0; k <= 30; k++) { const u = 0.22 + k / 30 * 0.76, w = v + Math.sin(k * 0.55 + i * 1.9) * 0.004 - (u - 0.22) * 0.05; k ? x.lineTo(U(u), V(w)) : x.moveTo(U(u), V(w)); }
      x.stroke();
    }
    soft(0); x.globalAlpha = 1;
  } else if (p === "redspots") {
    // brown trout: black spots on the back, red spots with a pale ring on the flank
    for (let i = 0; i < 110; i++) blob(0.12 + rnd() * 0.86, 0.06 + rnd() * 0.36, 0.0035 + rnd() * 0.0035, 0.01 + rnd() * 0.01, lk.accent, 0.85);
    for (let i = 0; i < 48; i++) { const u = 0.24 + rnd() * 0.73, v = 0.3 + rnd() * 0.28; blob(u, v, 0.0105, 0.028, "#d4e0ea", 0.85); blob(u, v, 0.0062, 0.017, "#d0341f", 1); }
  } else if (p === "spots" && shape === "sunfish") {
    for (let i = 0; i < 110; i++) { const u = 0.15 + rnd() * 0.8, v = 0.12 + rnd() * 0.6; blob(u, v, 0.008 + rnd() * 0.006, 0.02 + rnd() * 0.012, rnd() < 0.6 ? "#e8962e" : "#5aa0a0", 0.75); }
    x.strokeStyle = "rgba(80,190,210,0.85)"; x.lineWidth = 3;
    for (let i = 0; i < 4; i++) { x.beginPath(); for (let k = 0; k <= 10; k++) { const u = 0.02 + k * 0.02, v = 0.34 + i * 0.1 + Math.sin(k * 1.3 + i) * 0.025; k ? x.lineTo(U(u), V(v)) : x.moveTo(U(u), V(v)); } x.stroke(); }
  } else if (p === "spots") {
    // gar: big spots, mostly on the back half; catfish: small and sparse; the rest: many small ones
    const n = shape === "gar" ? 80 : shape === "catfish" ? 120 : 360, k = shape === "gar" ? 1.7 : shape === "catfish" ? 0.75 : 1, u0 = shape === "gar" ? 0.3 : 0;
    for (let i = 0; i < n; i++) { const u = u0 + rnd() * (1 - u0), v = rnd() * 0.72; if (v > 0.55 && rnd() < 0.6) continue; blob(u, v, (0.004 + rnd() * 0.005) * k, (0.012 + rnd() * 0.014) * k, lk.accent, 0.85); }
  } else if (p === "mottled" && shape === "sunfish") {
    // crappie: silver, with ragged black blotches and specks, thickest on the back
    soft(1.5);
    for (let i = 0; i < 44; i++) { const v = Math.pow(rnd(), 1.3) * 0.62; blob(0.16 + rnd() * 0.82, v, 0.008 + rnd() * 0.018, 0.02 + rnd() * 0.05, lk.accent, 0.5 + rnd() * 0.35, (rnd() - 0.5) * 0.9); }
    soft(0);
    for (let i = 0; i < 140; i++) blob(0.14 + rnd() * 0.84, rnd() * 0.7, 0.003 + rnd() * 0.003, 0.009 + rnd() * 0.009, lk.accent, 0.7);
  } else if (p === "mottled" && (shape === "bowfin" || shape === "catfish")) {
    // big soft blotches, darker on the back; the bowfin gets a net of pale gaps
    soft(3);
    for (let i = 0; i < 46; i++) blob(0.16 + rnd() * 0.84, rnd() * 0.5, 0.02 + rnd() * 0.035, 0.05 + rnd() * 0.09, i % 3 ? "#1c2010" : lk.body, 0.34 + rnd() * 0.2, (rnd() - 0.5) * 0.6);
    soft(1.5);
    for (let i = 0; i < 60; i++) blob(0.18 + rnd() * 0.8, 0.1 + rnd() * 0.5, 0.008 + rnd() * 0.01, 0.02 + rnd() * 0.03, "#141808", 0.3);
    soft(0);
  } else if (p === "mottled" && shape === "walleye") {
    soft(4);
    for (let i = 0; i < 6; i++) blob(0.28 + i * 0.12, 0.1, 0.04, 0.18, "#2e3016", 0.55, 0.2);
    soft(2);
    for (let i = 0; i < 90; i++) blob(0.2 + rnd() * 0.78, 0.12 + rnd() * 0.45, 0.01 + rnd() * 0.012, 0.02 + rnd() * 0.02, rnd() < 0.5 ? "#c8b04a" : "#4a4a24", 0.45);
    soft(0);
  } else if (p === "mottled") {
    // rows of dark squares along the scale rows
    for (let r = 0; r < 7; r++) for (let i = 0; i < 26; i++) { const u = 0.2 + i * 0.03 + (r % 2) * 0.015, v = 0.16 + r * 0.075; if (rnd() < 0.2) continue; blob(u, v, 0.009, 0.024, "#2a1e14", 0.6); }
    soft(5);
    for (let i = 0; i < 5; i++) blob(0.3 + i * 0.13, 0.25, 0.04, 0.15, "#2a1e14", 0.35);
    soft(0);
  } else if (p === "stripe") {
    soft(2);
    x.fillStyle = lk.accent; x.globalAlpha = 0.85;
    x.beginPath();
    for (let k = 0; k <= 30; k++) { const u = 0.18 + k / 30 * 0.82; x.lineTo(U(u), V(0.36 + Math.sin(k * 2.1) * 0.03 - 0.05)); }
    for (let k = 30; k >= 0; k--) { const u = 0.18 + k / 30 * 0.82; x.lineTo(U(u), V(0.47 + Math.cos(k * 1.7) * 0.035 + 0.02 * (1 - k / 30))); }
    x.closePath(); x.fill();
    for (let i = 0; i < 26; i++) blob(0.25 + rnd() * 0.7, 0.22 + rnd() * 0.1, 0.01, 0.02, lk.accent, 0.35);
    soft(0); x.globalAlpha = 1;
  } else if (p === "beans") {
    for (let r = 0; r < 6; r++) for (let i = 0; i < 20; i++) {
      const u = 0.16 + i * 0.042 + (r % 2) * 0.021 + (rnd() - 0.5) * 0.01, v = 0.14 + r * 0.085 + (rnd() - 0.5) * 0.02;
      blob(u, v, 0.014 + rnd() * 0.006, 0.02 + rnd() * 0.008, lk.accent, 0.85, (rnd() - 0.5) * 0.4);
    }
  } else if (p === "gold") {
    x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 260; i++) blob(rnd(), rnd() * 0.8, 0.004, 0.012, "#fff2b0", 0.35);
    x.globalCompositeOperation = "source-over";
    const sh = x.createLinearGradient(0, V(0.2), 0, V(0.4));
    sh.addColorStop(0, "rgba(255,255,220,0)"); sh.addColorStop(0.5, "rgba(255,255,230,0.45)"); sh.addColorStop(1, "rgba(255,255,220,0)");
    x.fillStyle = sh; x.fillRect(0, V(0.2), W, V(0.2));
  }
  // scales: fine crescents
  x.globalAlpha = p === "gold" ? 0.28 : 0.13; x.strokeStyle = p === "gold" ? "#fff6c0" : "#000"; x.lineWidth = 1;
  for (let v = 0.06; v < 0.9; v += 0.04) for (let u = 0.2 + (Math.round(v * 25) % 2) * 0.008; u < 1; u += 0.016) { x.beginPath(); x.arc(U(u), V(v), 3.2, -1.2, 1.2); x.stroke(); }
  x.globalAlpha = 1;
  // lateral line, gill cover, mouth
  const gill = GILL[shape] || 0.23;
  // the cod's lateral line is pale; every other fish has a dark one
  x.strokeStyle = shape === "cod" ? "rgba(245,245,225,0.7)" : "rgba(20,20,10,0.35)"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(U(gill > 0.3 ? gill - 0.01 : 0.22), V(0.3)); x.quadraticCurveTo(U(0.6), V(0.24), U(1), V(0.4)); x.stroke();
  x.strokeStyle = "rgba(20,15,10,0.45)"; x.lineWidth = 3;
  x.beginPath(); x.moveTo(U(gill - 0.02), V(0.1)); x.quadraticCurveTo(U(gill + 0.035), V(0.45), U(gill - 0.03), V(0.85)); x.stroke();
  const mouth = MOUTH[shape] ?? 0.07;
  x.strokeStyle = "rgba(25,15,10,0.8)"; x.lineWidth = 4;
  x.beginPath(); x.moveTo(U(0), V(0.5)); x.quadraticCurveTo(U(mouth * 0.5), V(0.53), U(mouth), V(0.56)); x.stroke();
  // head: darker top, and the pumpkinseed's black ear flap with its red spot
  const hd = x.createLinearGradient(0, 0, U(0.3), 0);
  hd.addColorStop(0, "rgba(0,0,0,0.18)"); hd.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = hd; x.fillRect(0, 0, U(0.3), V(0.45));
  if (shape === "sunfish" && p === "spots") { blob(gill + 0.005, 0.36, 0.022, 0.07, "#141410", 1); blob(gill + 0.018, 0.36, 0.009, 0.032, lk.accent, 1); }
  if (shape === "walleye") { x.fillStyle = "rgba(255,255,255,0.8)"; x.fillRect(U(0.93), V(0.82), U(0.07), V(0.18)); }
  // the bowfin's false eye at the tail root
  if (shape === "bowfin") { blob(0.945, 0.26, 0.026, 0.07, "#e69a2a", 0.95); blob(0.945, 0.26, 0.016, 0.043, "#0e0e08", 1); }
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  texCache.set(sp.id, t);
  return t;
}

// fin rays: pale lines from the base to the edge, the edge a little see-through
let finTex = null;
function finTexture() {
  if (finTex) return finTex;
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
  const x = cv.getContext("2d");
  const g = x.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, "rgba(235,235,235,0.9)"); g.addColorStop(0.6, "rgba(225,225,225,0.62)"); g.addColorStop(1, "rgba(215,215,215,0.3)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.globalCompositeOperation = "source-atop";
  for (let i = 2; i < 64; i += 6) { x.fillStyle = "rgba(255,255,245,0.75)"; x.fillRect(i, 0, 1.2, 64); x.fillStyle = "rgba(40,30,20,0.25)"; x.fillRect(i + 1.2, 0, 1, 64); }
  finTex = new THREE.CanvasTexture(cv);
  return finTex;
}

const eyeKey = (sp) => (sp.look.iris || "#d0a038") + (sp.look.eyeshine ? "g" : "");
function eyeTexture(iris, glassy) {
  const key = iris + (glassy ? "g" : "");
  if (eyeCache.has(key)) return eyeCache.get(key);
  const cv = document.createElement("canvas"); cv.width = 8; cv.height = 64;
  const x = cv.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, glassy ? "#6a7070" : "#050505"); g.addColorStop(0.2, glassy ? "#6a7070" : "#050505"); g.addColorStop(0.23, iris); g.addColorStop(0.42, iris); g.addColorStop(0.5, "#3a3020"); g.addColorStop(1, "#2a2418");
  x.fillStyle = g; x.fillRect(0, 0, 8, 64);
  const t = new THREE.CanvasTexture(cv);
  eyeCache.set(key, t);
  return t;
}

/* ---------------- shared shader bits ---------------- */

// Every fish, junk and lure material gets: a swimming wag, a water tint when under the surface, and a studio key light for the trophy.
export function fxUniforms() {
  return { uWag: { value: new THREE.Vector4(0, 0, 0, 0) }, uUnder: { value: 0 }, uWater: { value: new THREE.Color(0x224455) }, uAlpha: { value: 1 }, uKey: { value: 0 } };
}
export function fx(mat, u, { wag = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    if (wag) sh.vertexShader = "uniform vec4 uWag;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      {
        float zz = transformed.z, k = smoothstep(-0.3, 0.5, zz);
        transformed.x += uWag.y * sin(uWag.x - zz * 7.0) * k * k * 0.11 + uWag.z * (zz + 0.15) * (zz + 0.15) * 0.7;
        transformed.y += uWag.w * (zz + 0.1) * (zz + 0.1) * 0.5;
      }`);
    sh.fragmentShader = "uniform float uUnder, uAlpha, uKey; uniform vec3 uWater;\n" + sh.fragmentShader.replace("#include <opaque_fragment>", `
      {
        vec3 kd = normalize(vec3(0.35, 0.6, 0.75));
        outgoingLight += uKey * diffuseColor.rgb * (0.3 + 0.55 * max(dot(normal, kd), 0.0));
        float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        outgoingLight += uKey * rim * vec3(0.4, 0.38, 0.33);
        outgoingLight = mix(outgoingLight, uWater, uUnder);
        diffuseColor.a *= uAlpha;
      }
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => "fishfx" + (wag ? 1 : 0);
  return mat;
}

/* ---------------- fish ---------------- */

function loft(F, NT, NA) {
  const pos = [], uv = [], idx = [];
  // a closing point at the nose, then rings back to the tail root
  const p0 = profile(F, 0);
  for (let i = 0; i <= NT; i++) {
    const t = i === 0 ? 0 : (i / NT) ** 1.15, pr = i === 0 ? { top: 0, bot: 0, wid: 0, z: p0.z - F.top * F.nose * 0.35 } : profile(F, t);
    for (let a = 0; a <= NA; a++) {
      const ang = (a / NA) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
      const y = (c >= 0 ? pr.top : pr.bot) * c;
      const xw = pr.wid * s * (c >= 0 ? 1 - 0.28 * c * c : 1 + 0.05 * c);
      pos.push(xw, y, pr.z);
      uv.push(t, 1 - (ang <= Math.PI ? ang / Math.PI : 2 - ang / Math.PI));
    }
  }
  const row = NA + 1;
  for (let i = 0; i < NT; i++) for (let a = 0; a < NA; a++) {
    const p = i * row + a, q = p + row;
    idx.push(p, p + 1, q, p + 1, q + 1, q);
  }
  // a hooked lower jaw (the salmon's kype): a bent, tapering tube that grows out of the chin and turns up
  if (F.kype) {
    const path = [[0, -0.02, -0.45], [0, -0.027, -0.495], [0, -0.03, -0.522], [0, -0.021, -0.538], [0, -0.003, -0.538]], rad = [0.024, 0.021, 0.017, 0.011, 0.004], S = 6;
    path.forEach((c, i) => {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
      let ty = b[1] - a[1], tz = b[2] - a[2]; const l = Math.hypot(ty, tz); ty /= l; tz /= l;
      // the ring lies in the plane across the path: one axis is x, the other is perpendicular to the path in y-z
      for (let k = 0; k <= S; k++) {
        const ang = (k / S) * Math.PI * 2, cx = Math.cos(ang) * rad[i], cn = Math.sin(ang) * rad[i];
        pos.push(cx, c[1] + -tz * cn, c[2] + ty * cn);
        uv.push(0.05, 0.5);
      }
    });
    const base = (NT + 1) * row;
    for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < S; k++) { const p = base + i * (S + 1) + k, q = p + S + 1; idx.push(p, p + 1, q, p + 1, q + 1, q); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the seam runs along the back: give both sides of it the same normal
  const n = g.attributes.normal;
  for (let i = 0; i <= NT; i++) {
    const a = i * row, b = a + NA;
    const nx = (n.getX(a) + n.getX(b)) / 2, ny = (n.getY(a) + n.getY(b)) / 2, nz = (n.getZ(a) + n.getZ(b)) / 2, l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
  }
  return g;
}

// A flat fin in the fish's middle plane (x = 0), from a 2D outline in (z, y).
function flatFin(outline, uvFn, colorFn) {
  const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
  const sg = new THREE.ShapeGeometry(shape, 1);
  const p = sg.attributes.position, n = p.count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uvs = new Float32Array(n * 2), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const z = p.getX(i), y = p.getY(i);
    pos[i * 3] = 0; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    nrm[i * 3] = 1;
    const [u, v] = uvFn(z, y); uvs[i * 2] = u; uvs[i * 2 + 1] = v;
    const c = colorFn(z, y, u, v); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(sg.index);
  return g.toNonIndexed();
}

function finsGeo(F, sp) {
  const lk = sp.look, fin = hex(lk.fins), acc = hex(lk.accent), bel = hex(lk.belly), parts = [];
  const topAt = (z) => profile(F, tAt(F, z)).top, botAt = (z) => profile(F, tAt(F, z)).bot;
  // dorsal and anal fins
  const along = (d, up) => {
    const out = [], span = d.z1 - d.z0, base = (z) => (up ? topAt(z) - 0.006 : -botAt(z) + 0.006), s = up ? 1 : -1;
    for (let k = 0; k <= 6; k++) { const z = d.z0 + (k / 6) * span; out.push([z, base(z)]); }
    const edge = [];
    if (d.rake) {
      // a sickle fin: tall at the front, the tip swept back, a hollow trailing edge
      for (let k = 8; k >= 0; k--) { const u = k / 8; edge.push([d.z0 + u * span + d.h * d.rake * (1 - u), base(d.z0 + u * span) + s * d.h * (1 - u) ** 1.7]); }
    } else if (d.adipose) { for (let k = 6; k >= 0; k--) { const u = k / 6, z = d.z0 + u * span; edge.push([z + 0.01, base(z) + s * d.h * Math.sin(u * Math.PI) ** 0.7]); } }
    else if (d.n) {
      for (let k = d.n; k >= 0; k--) {
        const u = k / d.n, z = d.z0 + u * span, hh = d.h * (0.55 + 0.45 * Math.sin(Math.min(1, u * 1.4 + 0.15) * Math.PI) ** 0.6);
        edge.push([z + d.h * 0.25, base(z) + s * hh]);
        if (k > 0) { const zm = z - span / d.n * 0.5; edge.push([zm + d.h * 0.15, base(zm) + s * hh * (d.valley ?? 0.62)]); }
      }
    } else {
      for (let k = 8; k >= 0; k--) { const u = k / 8, z = d.z0 + u * span; edge.push([z + d.h * 0.35 * u, base(z) + s * d.h * (Math.sin(u * Math.PI * 0.9 + 0.2) ** 0.55) * (1 - 0.3 * u)]); }
    }
    const uvFn = (z, y) => [clamp((z - d.z0) / span, 0, 1), clamp(Math.abs(y - base(clamp(z, d.z0, d.z1))) / d.h, 0, 1)];
    parts.push(flatFin(out.concat(edge), uvFn, (z, y, u) => (d.blotch && u > 0.7 ? [fin[0] * 0.25, fin[1] * 0.25, fin[2] * 0.25] : fin)));
  };
  for (const d of F.dorsal) along(d, true);
  for (const d of F.anal) along(d, false);
  // the tail fin
  // a forked tail has its tips at the end and the notch in front of them; a round tail (fork < 0) has its middle at the end
  const zp = F.zp - 0.02, hp = topAt(F.zp) * 0.9, bp = botAt(F.zp) * 0.9, H = F.tailH, fk = F.fork, zt = 0.5 + Math.min(0, fk);
  const tail = [[zp, hp]];
  const curve = (a, b, c, n, outArr) => { for (let k = 1; k <= n; k++) { const t = k / n; outArr.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]]); } };
  const lunate = F.lunate ?? 0.42;
  curve([zp, hp], [lunate, H * 0.55], [zt, H], 5, tail);
  const cr = F.crescent ?? 0.6;
  curve([zt, H], [zt - fk * cr, H * 0.3], [zt - fk, 0], 4, tail);
  curve([zt - fk, 0], [zt - fk * cr, -H * 0.3], [zt, -H * 0.95], 4, tail);
  curve([zt, -H * 0.95], [lunate, -H * 0.55], [zp, -bp], 5, tail);
  parts.push(flatFin(tail, (z, y) => [clamp((y + H) / (2 * H), 0, 1), clamp((z - zp) / (0.5 - zp), 0, 1)], (z, y) => (sp.look.shape === "walleye" && y < -H * 0.55 && z > 0.44 ? acc : fin)));
  // finlets: a row of little fins on the tail root, top and belly
  if (F.finlets) {
    const [z0, z1, h, n] = F.finlets;
    along({ z0, z1, h, n, valley: 0.15 }, true); along({ z0, z1, h, n, valley: 0.15 }, false);
  }
  // paired fins: pectorals behind the gill, pelvics under the belly, turned out from the body
  const pair = (z, y, len, wid, yaw, roll) => {
    const out = [[0, 0.012], [len * 0.55, wid * 0.55], [len, wid * 0.12], [len * 0.9, -wid * 0.35], [len * 0.4, -wid * 0.3], [0, -0.012]];
    // paired fins are thin and see-through: tint them toward the belly so they do not read as dark patches
    const pc = [lerp(fin[0], bel[0], 0.45), lerp(fin[1], bel[1], 0.45), lerp(fin[2], bel[2], 0.45)];
    for (const s of [-1, 1]) {
      const g = flatFin(out, (a, b) => [clamp(b / wid + 0.5, 0, 1), clamp(a / len, 0, 1)], () => pc);
      const pr = profile(F, tAt(F, z));
      const m = new THREE.Matrix4().makeTranslation(s * pr.wid * 0.9, y, z).multiply(new THREE.Matrix4().makeRotationY(s * yaw)).multiply(new THREE.Matrix4().makeRotationZ(s * roll));
      g.applyMatrix4(m);
      parts.push(g);
    }
  };
  const zPec = -0.5 + (F.eyeT + 0.13) * (F.zp + 0.5), pb = profile(F, tAt(F, zPec));
  pair(zPec, -pb.bot * 0.35, F.pec * 0.8, F.pec * 0.4, 0.85, 0.35);
  pair(zPec + 0.07, -pb.bot * 0.97, F.pec * 0.6, F.pec * 0.28, 0.35, 1.25);
  for (const b of barbelGeos(F, lerpc(fin, acc, 0.3), lerpc(bel, fin, 0.25))) parts.push(b);
  const g = merge(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; return q; }));
  return g;
}

const lerpc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Barbels (a catfish has 8, a cod has 1): thin curved strips that hang from the mouth, 12 triangles each. Each path is a
// few points (x, y, z) from the root inside the head out to the tip; a strip is wide across the side view and tapers to the tip.
// The long ones on the upper lip are dark like the fins; the ones under the chin are pale like the belly.
function barbelGeos(F, dark, pale) {
  const n = F.barbels || 0;
  if (!n) return [];
  const list = [];
  if (n === 1) list.push({ path: [[0, -0.05, -0.44], [0, -0.078, -0.462], [0, -0.1, -0.446], [0, -0.115, -0.42]], col: pale, w: 0.0075 });
  else {
    // a pair at a time: long ones from the corners of the mouth, then the chin, the nose, and the outer chin
    const pairs = [
      (s) => ({ path: [[s * 0.05, -0.012, -0.45], [s * 0.086, -0.018, -0.5], [s * 0.118, -0.05, -0.48], [s * 0.128, -0.1, -0.43], [s * 0.128, -0.14, -0.375]], col: dark, w: 0.009 }),
      (s) => ({ path: [[s * 0.03, -0.045, -0.46], [s * 0.04, -0.07, -0.484], [s * 0.046, -0.1, -0.47], [s * 0.048, -0.128, -0.45]], col: pale, w: 0.0075 }),
      (s) => ({ path: [[s * 0.03, 0.014, -0.47], [s * 0.05, 0.034, -0.506], [s * 0.078, 0.045, -0.494], [s * 0.098, 0.036, -0.46]], col: dark, w: 0.007 }),
      (s) => ({ path: [[s * 0.065, -0.038, -0.435], [s * 0.078, -0.062, -0.452], [s * 0.086, -0.09, -0.428], [s * 0.086, -0.115, -0.4]], col: pale, w: 0.0075 }),
    ];
    for (const mk of pairs) for (const s of [-1, 1]) list.push(mk(s));
  }
  return list.slice(0, n).map((b) => ribbon(smoothPath(b.path, 6), b.w, b.w * 0.22, b.col));
}
// A Catmull-Rom curve through the points, as n + 1 points
function smoothPath(c, n) {
  const out = [], m = c.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * m, k = Math.min(m - 1, Math.floor(u)), t = u - k;
    const P = (j) => c[clamp(j, 0, m)];
    const p0 = P(k - 1), p1 = P(k), p2 = P(k + 1), p3 = P(k + 2);
    out.push([0, 1, 2].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t * t + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t * t * t)));
  }
  return out;
}

// A strip along a path, always wide across the side view, tapering to the tip.
function ribbon(path, w0, w1, col) {
  const pos = [], nrm = [], uvs = [], cols = [], m = path.length - 1;
  const at = path.map((c, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(m, i + 1)];
    let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    // width direction: across the tangent and the x axis, so the strip faces the side
    let w = [0, t[2], -t[1]]; const l = Math.hypot(w[0], w[1], w[2]) || 1;
    w = [w[0] / l, w[1] / l, w[2] / l];
    const hw = lerp(w0, w1, i / m);
    return [[c[0] + w[0] * hw, c[1] + w[1] * hw, c[2] + w[2] * hw], [c[0] - w[0] * hw, c[1] - w[1] * hw, c[2] - w[2] * hw]];
  });
  const side = path[m][0] < 0 ? -1 : 1;
  const tri = (a, b, c) => { for (const v of [a, b, c]) { pos.push(...v); nrm.push(side, 0, 0); uvs.push(0.04, 0.03); cols.push(col[0], col[1], col[2]); } };
  for (let i = 0; i < m; i++) { const [a, b] = at[i], [c, d] = at[i + 1]; tri(a, b, c); tri(b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  return g;
}

function eyesGeo(F) {
  const t = F.eyeT, pr = profile(F, t), c = F.eyeC ?? 0.34, s = Math.sqrt(1 - c * c);
  const y = pr.top * c, x = pr.wid * s * (1 - 0.28 * c * c) - F.eye * 0.3;
  const parts = [];
  for (const side of [-1, 1]) {
    const g = new THREE.SphereGeometry(F.eye, 12, 8);
    g.rotateZ(-side * Math.PI / 2);
    g.translate(side * x, y, pr.z);
    parts.push(g.toNonIndexed());
  }
  const out = new THREE.BufferGeometry();
  for (const k of ["position", "normal", "uv"]) {
    const size = parts[0].attributes[k].itemSize, arr = new Float32Array(parts[0].attributes[k].array.length * 2);
    arr.set(parts[0].attributes[k].array, 0); arr.set(parts[1].attributes[k].array, parts[0].attributes[k].array.length);
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

// geometry made once per species id (a released species is built again the next time it is asked for)
const geoCache = new Map();
function fishParts(sp) {
  if (geoCache.has(sp.id)) return geoCache.get(sp.id);
  const F = formOf(sp);
  const g = { body: loft(F, 26, 18), fins: finsGeo(F, sp), eyes: eyesGeo(F) };
  for (const k in g) g[k].computeBoundingSphere();
  geoCache.set(sp.id, g);
  return g;
}

function buildFish(sp) {
  const u = fxUniforms(), lk = sp.look, gold = lk.pattern === "gold";
  const G = fishParts(sp);
  const body = fx(new THREE.MeshPhongMaterial({ map: skinTexture(sp), shininess: gold ? 80 : 45, specular: gold ? 0x806020 : 0x383838, emissive: gold ? 0x6a4a08 : 0x000000, transparent: true }), u);
  const fins = fx(new THREE.MeshPhongMaterial({ map: finTexture(), vertexColors: true, shininess: 20, specular: 0x222222, side: THREE.DoubleSide, transparent: true, depthWrite: false, alphaTest: 0.02, emissive: gold ? 0x4a3400 : 0x000000 }), u);
  fins.userData.fin = true;
  // flat sheets: one pass is enough, so a fish is 3 draw calls (three.js draws a see-through, double-sided material twice)
  fins.forceSinglePass = true;
  // the eye: look.iris is the colour; look.eyeshine gives a pale, glassy eye that catches the light in the dark
  const eyes = fx(new THREE.MeshPhongMaterial({ map: eyeTexture(lk.iris || "#d0a038", !!lk.eyeshine), shininess: 120, specular: 0xffffff, transparent: true, emissive: lk.eyeshine ? 0x1a1e14 : 0 }), u);
  const grp = new THREE.Group();
  const mb = new THREE.Mesh(G.body, body), mf = new THREE.Mesh(G.fins, fins), me = new THREE.Mesh(G.eyes, eyes);
  mb.renderOrder = 10; me.renderOrder = 11; mf.renderOrder = 12;
  grp.add(mb, me, mf);
  grp.userData = { fx: u, id: sp.id, kind: "fish", mats: [body, fins, eyes] };
  return grp;
}

/* ---------------- junk ---------------- */

function junkGeo(j) {
  if (geoCache.has(j.id)) return geoCache.get(j.id).body;
  const parts = [], M = () => new THREE.Matrix4();
  const body = hex(j.look.body), acc = hex(j.look.accent);
  if (j.look.shape === "boot") {
    // an old leather boot, toe forward (-z), about 0.3 m long
    const foot = new THREE.CapsuleGeometry(0.055, 0.2, 4, 10);
    foot.rotateX(Math.PI / 2); foot.scale(1, 0.75, 1);
    parts.push(bake(foot, { matrix: M().makeTranslation(0, 0.045, -0.02), color: body }));
    parts.push(bake(new THREE.BoxGeometry(0.115, 0.025, 0.3), { matrix: M().makeTranslation(0, 0.0, -0.01), color: acc }));
    parts.push(bake(new THREE.CylinderGeometry(0.058, 0.064, 0.22, 12), { matrix: M().makeTranslation(0, 0.16, 0.085), colorFn: (x, y) => (y > 0.25 ? hex("#5a4632") : body) }));
    for (let i = 0; i < 5; i++) parts.push(bake(new THREE.BoxGeometry(0.07, 0.008, 0.01), { matrix: M().makeTranslation(0, 0.08 + i * 0.035, 0.025 - i * 0.004), color: hex("#d8cfb0") }));
    for (let i = 0; i < 4; i++) { const w = new THREE.CylinderGeometry(0.004, 0.002, 0.16, 3); w.translate(0, -0.08, 0); parts.push(bake(w, { matrix: M().makeRotationZ((i - 1.5) * 0.3).setPosition(-0.03 + i * 0.02, 0.02, 0.1 - i * 0.05), color: hex("#4f7a30") })); }
  } else if (j.look.shape === "plunger") {
    // the King's plunger: a red rubber cup, a long wooden handle, and a little gold crown on the end
    const cup = new THREE.LatheGeometry([[0.079, 0], [0.082, 0.008], [0.08, 0.035], [0.068, 0.07], [0.04, 0.095], [0.018, 0.108], [0.015, 0.118]].map(([r, y]) => new THREE.Vector2(r, y)), 18);
    cup.rotateX(Math.PI / 2);
    parts.push(bake(cup, { matrix: M().makeTranslation(0, 0, -0.235), colorFn: (x, y, z) => (z < -0.225 ? hex("#8a1c18") : body) }));
    parts.push(bake(new THREE.CylinderGeometry(0.013, 0.014, 0.44, 8).rotateX(Math.PI / 2), { matrix: M().makeTranslation(0, 0, 0.1), color: acc }));
    parts.push(bake(new THREE.SphereGeometry(0.018, 8, 6), { matrix: M().makeTranslation(0, 0, 0.32), color: acc }));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const c = new THREE.ConeGeometry(0.008, 0.03, 4); c.rotateX(Math.PI / 2); parts.push(bake(c, { matrix: M().makeTranslation(Math.cos(a) * 0.018, Math.sin(a) * 0.018, 0.35), color: hex("#f2c230") })); }
    parts.push(bake(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 10).rotateX(Math.PI / 2), { matrix: M().makeTranslation(0, 0, 0.335), color: hex("#f2c230") }));
  } else {
    // Pip's frisbee: a yellow disc with an orange stripe
    // extra rings where the colour changes, so the stripes stay crisp
    const prof = [[0, 0.018], [0.028, 0.018], [0.031, 0.018], [0.083, 0.0166], [0.086, 0.0164], [0.099, 0.0156], [0.102, 0.0153], [0.125, 0.01], [0.135, -0.004], [0.13, -0.018], [0.122, -0.012], [0.124, 0.002], [0.11, 0.006], [0, 0.008]];
    const d = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
    parts.push(bake(d, { colorFn: (x, y, z) => { const r = Math.hypot(x, z); return y > 0.012 && ((r > 0.085 && r < 0.1) || r < 0.03) ? acc : body; } }));
  }
  const g = merge(parts);
  geoCache.set(j.id, { body: g });
  return g;
}
function buildJunk(j) {
  const u = fxUniforms();
  const mat = fx(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 50, specular: 0x333333, transparent: true, side: THREE.DoubleSide }), u, { wag: false });
  const m = new THREE.Mesh(junkGeo(j), mat);
  m.renderOrder = 10;
  const grp = new THREE.Group();
  grp.add(m);
  grp.userData = { fx: u, id: j.id, kind: "junk", mats: [mat] };
  return grp;
}
// The real sizes of the junk, in meters (length of the long side).
export const JUNK_LEN = { boot: 0.3, plunger: 0.57, frisbee: 0.27 };

// A fish or junk mesh for a species id: a Group, 1 unit long, nose toward -z. userData.fx holds its shader uniforms.
export function fishMesh(id) {
  const sp = byId(id);
  if (!sp) return null;
  return sp.look.shape === "boot" || sp.look.shape === "plunger" || sp.look.shape === "frisbee" ? buildJunk(sp) : buildFish(sp);
}

// Frees the GPU memory and the cached skins and geometry of every species that is not in keepIds (species ids, junk ids
// included). world.setPlace calls it with the fish of the new place. Meshes already made keep working: three.js uploads
// their textures and buffers again if they are drawn, but the caller should drop the ones it no longer needs.
// Returns how many skins, geometries and eye textures it freed.
export function releaseFish(keepIds = []) {
  const keep = new Set(keepIds), out = { skins: 0, geometries: 0, eyes: 0 };
  for (const [id, g] of geoCache) {
    if (keep.has(id)) continue;
    for (const k in g) { g[k].dispose(); out.geometries++; }
    geoCache.delete(id);
  }
  for (const [id, t] of texCache) {
    if (keep.has(id)) continue;
    t.dispose(); texCache.delete(id); out.skins++;
  }
  // an eye texture is shared by the species with the same iris, so it stays while one of them is kept
  const eyes = new Set();
  for (const id of keep) { const sp = byId(id); if (sp && sp.look && !JUNK_LEN[id]) eyes.add(eyeKey(sp)); }
  for (const [k, t] of eyeCache) if (!eyes.has(k)) { t.dispose(); eyeCache.delete(k); out.eyes++; }
  // the fin ray texture is shared by every fish: it goes only when nothing is kept
  if (!keep.size && finTex) { finTex.dispose(); finTex = null; }
  return out;
}
