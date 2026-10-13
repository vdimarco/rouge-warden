// Light Years Home: the telescope view on a candidate's card. A narrow camera at the view's own position looks at one
// object through the real scene (render/view.js renderCamera) into a small render target, framed to the object's
// size: a galaxy, cluster or nebula fills about three quarters of the frame, a planet a little less, a double star
// is shown wide enough to split the pair, a single star sits among its neighbours. The pixels come back as a canvas
// for the card, brightened when the view is faint (a telescope gathers more light than the eye) and darkened toward
// the corners like an eyepiece. No outside source fits this; it is a plain render target with a narrow camera.
import * as THREE from 'three';
import { OBJECTS, AU_LY, KM_PER_LY } from '../core/objects.js';
import { blackbodyRGB, srgbEncode } from '../core/physics.js';
import { mulberry32, hashSeed } from '../core/rng.js';

export const LENS_SIZE = 192;
const D2R = Math.PI / 180;
const FILL = 0.74;              // share of the frame an extended object spans
const STAR_FOV = 1.2;           // degrees, for a single star
const MIN_FOV = 1e-4, MAX_FOV = 60;
const GAIN_MAX = 4;             // most the auto-exposure brightens a faint view
const MIN_LIT = 50;             // under this many lit pixels the lens draws the object itself
// Layers drawn behind an object of each layer (render/view.js layer names).
const BEHIND = { cosmic: { cosmic: 1 }, group: { cosmic: 1, group: 1 }, galaxy: { galaxy: 1, stars: 1 },
  stars: { stars: 1 }, solar: { stars: 1, solar: 1 } };

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

// sRGB byte ↔ linear tables for the exposure step.
const TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const toByte = (l) => {
  const c = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.round(clamp(c, 0, 1) * 255);
};

// Where the view's camera is (ly): from the last camera it synced, else from its layers' roots (each root sits at
// −position / unit after a sync).
function viewPosition(view) {
  const cam = view.cam || view.lastCam;
  if (cam && Array.isArray(cam.pos)) return cam.pos;
  const L = view.layers || {};
  for (const name of ['stars', 'galaxy', 'solar', 'group', 'cosmic']) {
    const layer = L[name];
    if (layer && layer.root && finite(layer.unit)) {
      const p = layer.root.position;
      return [-p.x * layer.unit, -p.y * layer.unit, -p.z * layer.unit];
    }
  }
  return null;
}

// The telescope's field (vertical, degrees) for an object seen from `from`.
export function lensFov(id, from) {
  const o = OBJECTS[id];
  if (!o || !from) return STAR_FOV;
  const dist = len(sub(o.pos, from));
  if (!(dist > 0)) return MAX_FOV;
  let r = 0;
  if (finite(o.radiusLy)) r = o.radiusLy;
  else if (finite(o.radiusKm)) r = o.radiusKm / KM_PER_LY;
  if (o.kind === 'pair' && o.companion && finite(o.companion.sepAu)) {
    // Wide enough to split the pair: the companion about a quarter of the frame from the primary.
    const sep = Math.atan(o.companion.sepAu * AU_LY / dist) / D2R;
    return clamp(Math.max(sep * 4, 2e-4), MIN_FOV, STAR_FOV);
  }
  if (o.kind === 'star' || r <= 0) return o.kind === 'point' ? 20 : STAR_FOV;
  const a = Math.asin(Math.min(1, r / dist)) / D2R;
  const fill = o.kind === 'planet' || o.kind === 'moon' ? 0.62 : FILL;
  return clamp((2 * a) / fill, MIN_FOV, MAX_FOV);
}

// A drawn stand-in for a view too faint to show: a galaxy cluster as a swarm of small elliptical galaxies thickening
// toward the middle (with its giants), a star as a glow in its blackbody colour, anything else as a soft glow.
function portrait(canvas, o, id) {
  const ctx = canvas.getContext('2d'), s = canvas.width, c = s / 2;
  const rnd = mulberry32(hashSeed('lens', id));
  const rgb = (T, k = 1) => blackbodyRGB(T).map((v) => Math.round(255 * srgbEncode(clamp(v * k, 0, 1))));
  const blob = (x, y, r, col, a = 1, e = 1, ang = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(1, e);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
    g.addColorStop(0.35, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.45})`);
    g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  ctx.globalCompositeOperation = 'lighter';
  if (o.kind === 'cluster' || o.kind === 'supercluster' || o.kind === 'wall') {
    const n = clamp(Math.round(Math.sqrt(o.members || 400) * 5), 60, 220);
    for (let i = 0; i < n; i++) {
      const r = s * 0.42 * Math.sqrt(-Math.log(1 - rnd() * 0.97)) * 0.45, t = rnd() * Math.PI * 2;
      blob(c + r * Math.cos(t), c + r * Math.sin(t), 1.2 + 2.4 * rnd() ** 2, rgb(4200 + 3500 * rnd()), 0.9,
        0.4 + 0.6 * rnd(), rnd() * Math.PI);
    }
    for (let i = 0; i < (o.giants || 0); i++) {
      blob(c + (rnd() - 0.5) * s * 0.18, c + (rnd() - 0.5) * s * 0.18, s * 0.06, rgb(4300), 1, 0.75, rnd() * Math.PI);
    }
  } else if (finite(o.T)) {
    // A double star is drawn split, the companion a quarter of the frame away, sized by its own radius.
    const pair = o.kind === 'pair' && o.companion && finite(o.companion.T);
    const x = pair ? c - s * 0.1 : c;
    blob(x, c, s * 0.22, rgb(o.T, 0.6), 0.6);
    blob(x, c, s * 0.06, rgb(o.T), 1);
    if (pair) {
      const k = clamp(Math.sqrt((o.companion.radiusSun || 1) / (o.radiusSun || 1)), 0.25, 1);
      blob(c + s * 0.15, c - s * 0.05, s * 0.14 * k, rgb(o.companion.T, 0.6), 0.6);
      blob(c + s * 0.15, c - s * 0.05, s * 0.045 * Math.max(k, 0.5), rgb(o.companion.T), 1);
    }
  } else {
    blob(c, c, s * 0.3, [200, 200, 220], 0.5);
  }
  canvas.dataset.portrait = '1';
}

// createLens(renderer) → { shot(view, objectId, size), dispose() }. shot renders the telescope view and returns a
// canvas (size × size, default 192) with dataset { fov (degrees), lit (pixels brighter than 0.1), gain }, or null
// when the view cannot draw (lost context, unknown object). view: render/view.js's View (renderCamera, describeAt,
// layers; cam when it has one).
export function createLens(renderer) {
  let rt = null, rtSize = 0, buf = null;
  const target = (s) => {
    if (!rt || rtSize !== s) {
      if (rt) rt.dispose();
      // An sRGB target: light blends in linear and comes back with its precision in the darks.
      rt = new THREE.WebGLRenderTarget(s, s, { colorSpace: THREE.SRGBColorSpace, depthBuffer: true });
      rtSize = s;
      buf = new Uint8Array(s * s * 4);
    }
    return rt;
  };

  function shot(view, objectId, size = LENS_SIZE) {
    const o = OBJECTS[objectId];
    const s = clamp(Math.round(finite(size) ? size : LENS_SIZE), 16, 1024);
    if (!o || !view || view.lost || typeof view.renderCamera !== 'function' || typeof view.describeAt !== 'function') {
      return null;
    }
    const from = viewPosition(view);
    if (!from) return null;
    const dir = sub(o.pos, from);
    if (!(len(dir) > 0)) return null;
    const fov = lensFov(objectId, from);
    const desc = view.describeAt(from, dir, fov, 1);
    // Only the object's own layer and what lies behind it: the galactic band is one flat colour at this
    // magnification and would fill the frame.
    desc.layerWeights = { cosmic: 0, group: 0, galaxy: 0, stars: 0, solar: 0, ...BEHIND[o.layer] };
    const force = [o.layer];
    view.renderCamera(desc, target(s), { width: s, height: s, force });
    (view.renderer || renderer).readRenderTargetPixels(rt, 0, 0, s, s, buf);
    const out = toCanvas(buf, s, fov);
    // Too faint to see from here (the view culls far, dim points): draw the object instead, so a card is never black.
    if (Number(out.dataset.lit) < MIN_LIT) portrait(out, o, objectId);
    return out;
  }

  // Bytes (bottom-up, sRGB) → a canvas: brightened when faint, an eyepiece vignette, rows flipped.
  function toCanvas(src, s, fov) {
    const n = s * s;
    // The 99.5th percentile of brightness in the middle of the frame (where the object is) sets the gain, so a few
    // bright stars do not hold the rest down and a bright surrounding is not what decides it.
    const hist = new Uint32Array(256);
    const lo = Math.floor(s * 0.3), hi = Math.ceil(s * 0.7);
    let m = 0;
    for (let y = lo; y < hi; y++) for (let x = lo; x < hi; x++) {
      const k = (y * s + x) * 4;
      hist[Math.max(src[k], src[k + 1], src[k + 2])]++;
      m++;
    }
    let acc = 0, top = 255;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= m * 0.005) { top = v; break; } }
    const topLin = Math.max(TO_LIN[top], 1e-4);
    const gain = clamp(0.8 / topLin, 1, GAIN_MAX);
    const out = document.createElement('canvas');
    out.width = out.height = s;
    const ctx = out.getContext('2d');
    const img = ctx.createImageData(s, s);
    const c = (s - 1) / 2;
    let lit = 0;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const from = ((s - 1 - y) * s + x) * 4, to = (y * s + x) * 4;
        const r = Math.hypot(x - c, y - c) / (c * Math.SQRT2);
        const v = gain * (1 - 0.45 * Math.min(1, Math.max(0, (r - 0.55) / 0.45)) ** 2);
        let bright = 0;
        for (let k = 0; k < 3; k++) {
          const b = toByte(TO_LIN[src[from + k]] * v);
          img.data[to + k] = b;
          bright = Math.max(bright, b);
        }
        img.data[to + 3] = 255;
        if (bright > 25) lit++;
      }
    }
    ctx.putImageData(img, 0, 0);
    out.dataset.fov = String(+fov.toPrecision(4));
    out.dataset.lit = String(lit);
    out.dataset.gain = String(+gain.toFixed(2));
    return out;
  }

  function dispose() {
    if (rt) rt.dispose();
    rt = null;
  }

  return { shot, dispose, size: LENS_SIZE };
}
