// The reel you touch: four small canvas widgets.
// ReelPanel: the spinning reel face in the cast. Swipe the bail arm to open or close it; a thumb anywhere pins the line.
// Crank: the handle you turn with your thumb to reel in (landscape).
// RodPad: the rod for touch play. Drag it up and down, swipe up fast to set the hook.
// Gauge: the line tension with the drag and break marks, the line out, the depth, and the fish.
//
// main.js may turn #game 90° with CSS when the phone is sideways, so every pointer position goes through the
// toLocal() it passes in. We never call preventDefault() on pointer or touch events: the iOS haptic switch pads
// under the thumb need their default handling, and the page's touch-action: none already stops scrolling and zooming.

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapPi = (a) => { a %= TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };
const now = () => performance.now();
const FONT = "Nunito, system-ui, -apple-system, 'Segoe UI', sans-serif";
// the page palette (index.html :root)
const INK = "246,239,217", BRASS = "232,182,74", RED = "224,69,58", GREEN = "122,200,74", AMBER = "240,165,42", DANGER = "255,90,74";
const rgba = (c, a) => "rgba(" + c + "," + a + ")";

// Tunables. Exported so a test or a settings screen can read them.
export const REEL_UI = {
  maxDpr: 2,           // canvas pixel ratio cap; main.js lowers it on low quality
  pinHoldMs: 90,       // bail closed: a press becomes a pin after this long without a big move
  pinSlopPx: 12,       // "a big move"
  bailSwipePx: 40,     // the bail swipe: at least this far...
  bailVertical: 1.4,   // ...and this many times more vertical than sideways
  crankWinMs: 100,     // crank speed = the angle the thumb swept over this window
  crankStaleMs: 35,    // no new sample for this long: the thumb has stopped, so the window slides on past it
                       // (longer when the events come slower: a busy phone delivers touch moves once per frame)
  crankTau: 0.035,     // s, light smoothing on top of the window
  crankMinR: 0.12,     // of the crank size: nearer the hub than this, the angle is noise
  flingKeep: 0.55,     // a thumb that lets go while cranking fast leaves this much spin on the handle...
  flingDecay: 3.5,     // ...which dies away at this rate (1/s)
  keyRps: 1.6,         // R held
  wheelPxPerRev: 400,  // a 100 px scroll flick turns the handle a quarter turn
  maxRps: 8,
  rodMin: 10, rodMax: 110, rodStart: 55,
  rodKeyDps: 120,      // W/S held
  yankPxs: 900,        // an upward swipe faster than this sets the hook
  steerDead: 0.1,      // no steer this close to the pad centre
};
const T = REEL_UI;

/* ---------------- shared bits ---------------- */
class Emitter {
  constructor() { this._fns = {}; }
  on(type, fn) { (this._fns[type] || (this._fns[type] = [])).push(fn); return this; }
  off(type, fn) { const a = this._fns[type]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } return this; }
  emit(type, e) {
    const a = this._fns[type];
    if (!a) return;
    // a throwing listener must not leave our pointer bookkeeping half done
    for (const fn of a.slice()) { try { fn(e); } catch (err) { console.error(err); } }
  }
}

// Used only when main.js passes no toLocal: the unrotated offset of el inside the page.
function offsetLocal(cx, cy, el) {
  let x = cx, y = cy;
  for (let e = el; e && e !== document.body; e = e.offsetParent) { x -= e.offsetLeft; y -= e.offsetTop; }
  return { x, y };
}

// A press on a control is not a pin. The invisible iOS haptic switches are the exception: they sit on top of the
// reel and the crank on purpose, and their events bubble up to us.
function isSwitch(e) { return e.tagName === "INPUT" && e.hasAttribute("switch"); }
function blocked(target, stop) {
  for (let e = target; e && e !== stop && e.nodeType === 1; e = e.parentElement) {
    if (isSwitch(e) || (e.tagName === "LABEL" && e.querySelector("input[switch]"))) continue;
    if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL)$/.test(e.tagName)) return true;
    if (e.id === "hud" || e.hasAttribute("data-nopin") || (e.classList && e.classList.contains("screen"))) return true;
  }
  return false;
}

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function font(px, weight = 900) { return weight + " " + px + "px " + FONT; }
function spaced(ctx, em) { if ("letterSpacing" in ctx) ctx.letterSpacing = em ? em + "em" : "0px"; }

// A canvas that fills its container, drawn at the device pixel ratio (capped at 2).
class Widget extends Emitter {
  constructor(container, cls) {
    super();
    this.el = container;
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    const cv = (this.cv = document.createElement("canvas"));
    cv.className = cls;
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
    // first child, so overlays added later (the haptic switch pads) sit on top and get the touch
    container.insertBefore(cv, container.firstChild);
    this.ctx = cv.getContext("2d");
    this.w = 0; this.h = 0; this.dpr = 1;
    this.time = 0;
    this._offs = [];
    // while the box animates its size, keep the canvas as it is and scale it; reallocate once at the end
    this.anim = false;
    container.addEventListener("transitionrun", (e) => { if (e.target === container) this.anim = true; });
    const done = (e) => { if (e.target === container) { this.anim = false; this.resize(); } };
    container.addEventListener("transitionend", done);
    container.addEventListener("transitioncancel", done);
  }
  get hidden() { return !(this.el.clientWidth > 0 && this.el.clientHeight > 0); }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight, dpr = Math.min(T.maxDpr, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return false;
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.max(1, Math.round(w * dpr));
    this.cv.height = Math.max(1, Math.round(h * dpr));
    // a new size clears the canvas: paint it again even if the scene did not change
    this._drawn = null;
    this.layout();
    return true;
  }
  layout() {}
  // The container can change size without a resize() call (the reel box animates its height during the flight).
  fit() {
    if (this.anim) return this.w > 0 && this.h > 0;
    const dpr = Math.min(T.maxDpr, window.devicePixelRatio || 1);
    if (this.el.clientWidth !== this.w || this.el.clientHeight !== this.h || dpr !== this.dpr) this.resize();
    return this.w > 0 && this.h > 0;
  }
  begin() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    return c;
  }
  // An offscreen canvas the size of ours, for the parts that do not change every frame: cheap to copy, dear to draw
  // (phones without a GPU canvas raster every gradient and blur on the main thread).
  layer(name) {
    const L = this._layers || (this._layers = {});
    let c = L[name];
    if (!c) { c = L[name] = document.createElement("canvas"); c.key = null; }
    if (c.width !== this.cv.width || c.height !== this.cv.height) { c.width = this.cv.width; c.height = this.cv.height; c.key = null; }
    return c;
  }
  // draw into a layer; the drawing helpers all use this.ctx, so point it there for the duration
  paint(c, key, fn) {
    if (c.key === key) return;
    const main = this.ctx, lc = c.getContext("2d");
    this.ctx = lc;
    lc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    lc.clearRect(0, 0, this.w, this.h);
    try { fn(lc); } finally { this.ctx = main; }
    c.key = key;
  }
  blit(c) { const x = this.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(c, 0, 0); x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
  // true when this frame would look the same as the last one we drew
  same(key) { if (key === this._drawn) return true; this._drawn = key; return false; }
  listen(target, type, fn, opt) { target.addEventListener(type, fn, opt); this._offs.push(() => target.removeEventListener(type, fn, opt)); }
  dispose() { for (const f of this._offs) f(); this._offs = []; this.cv.remove(); }
  // a soft glowing spot under a thumb
  thumbGlow(c, x, y, r, a = 1) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba("255,248,226", 0.8 * a));
    g.addColorStop(0.28, rgba("255,220,140", 0.55 * a));
    g.addColorStop(0.6, rgba(BRASS, 0.2 * a));
    g.addColorStop(1, rgba(BRASS, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = rgba("6,22,27", 0.35 * a);
    c.lineWidth = 5;
    c.beginPath(); c.arc(x, y, r * 0.46 + 2, 0, TAU); c.stroke();
    c.strokeStyle = rgba("255,236,190", 0.9 * a);
    c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, r * 0.46, 0, TAU); c.stroke();
  }
  glass(c, x, y, w, h, r, alarm = 0) {
    c.beginPath(); rrect(c, x, y, w, h, r);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(19,68,81,0.84)");
    g.addColorStop(1, "rgba(8,28,34,0.86)");
    c.fillStyle = g; c.fill();
    c.lineWidth = 1;
    c.strokeStyle = alarm > 0 ? rgba(DANGER, 0.3 + 0.6 * alarm) : "rgba(246,239,217,0.18)";
    c.stroke();
    // a faint top sheen, like the glass chips in the HUD
    c.save(); c.beginPath(); rrect(c, x + 1, y + 1, w - 2, h * 0.45, r - 1); c.clip();
    const s = c.createLinearGradient(0, y, 0, y + h * 0.45);
    s.addColorStop(0, "rgba(255,255,255,0.07)"); s.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = s; c.fillRect(x, y, w, h * 0.45);
    c.restore();
  }
}

/* ---------------- a tiny 3D view for the reel face ---------------- */
// Model units. x runs along the spool axis, from the front of the spool (−) back to the body (+); y is up (the rod is
// on top); z comes toward the near side. We look from the front, a little to the side and from above, so the spool face,
// the line on the spool, and the bail wire all read at once.
const YAW = 40 * DEG, PITCH = 20 * DEG;
const CY = Math.cos(YAW), SY = Math.sin(YAW), CP = Math.cos(PITCH), SP = Math.sin(PITCH);
const n3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const VIEW = [-SY * CP, SP, CY * CP];              // toward the eye
const LIGHT = n3([-0.5, 0.8, 0.35]);               // a key light from the front, above
const HALF = n3([VIEW[0] + LIGHT[0], VIEW[1] + LIGHT[1], VIEW[2] + LIGHT[2]]);
const ENV_HI = [0.93, 0.98, 0.97], ENV_LO = [0.07, 0.17, 0.19];   // what polished metal reflects: sky above, the lake below
const MAT = {
  silver: { base: [0.84, 0.86, 0.87], metal: 0.82, amb: 0.3, dif: 0.6, spec: 0.85, shin: 60 },
  steel: { base: [0.6, 0.64, 0.66], metal: 0.7, amb: 0.3, dif: 0.6, spec: 0.7, shin: 40 },
  gun: { base: [0.25, 0.28, 0.3], metal: 0.55, amb: 0.35, dif: 0.55, spec: 0.5, shin: 28 },
  body: { base: [0.17, 0.19, 0.2], metal: 0.45, amb: 0.4, dif: 0.55, spec: 0.45, shin: 22 },
  red: { base: [0.92, 0.27, 0.22], metal: 0.35, amb: 0.42, dif: 0.6, spec: 0.55, shin: 36 },
  line: { base: [0.97, 0.92, 0.74], metal: 0, amb: 0.5, dif: 0.55, spec: 0.22, shin: 14 },
  cork: { base: [0.74, 0.56, 0.36], metal: 0, amb: 0.48, dif: 0.55, spec: 0.06, shin: 8 },
  blank: { base: [0.13, 0.17, 0.19], metal: 0.35, amb: 0.4, dif: 0.5, spec: 0.6, shin: 30 },
};
function shade(n, m, k = 1, a = 1) {
  const nl = Math.max(0, dot3(n, LIGHT)), nh = Math.max(0, dot3(n, HALF)), nv = dot3(n, VIEW);
  const ry = 2 * nv * n[1] - VIEW[1];                                   // the reflected view ray
  const sky = smooth(-0.2, 0.45, ry), band = Math.exp(-((ry - 0.05) ** 2) / 0.006) * 0.3;  // a bright horizon line
  const sp = m.spec * Math.pow(nh, m.shin), rim = Math.pow(1 - Math.abs(nv), 4) * 0.12;
  let s = "rgba(";
  for (let i = 0; i < 3; i++) {
    const env = (ENV_LO[i] + (ENV_HI[i] - ENV_LO[i]) * sky + band) * m.base[i];
    const v = (m.base[i] * (m.amb + m.dif * nl) * (1 - m.metal) + env * m.metal + sp + rim) * k;
    s += Math.round(clamp(v, 0, 1) * 255) + ",";
  }
  return s + a + ")";
}
// two unit vectors across an axis
function across(ax) {
  if (Math.abs(ax[0]) > 0.9) return [[0, 1, 0], [0, 0, 1]];     // along x: up, near
  if (Math.abs(ax[2]) > 0.9) return [[1, 0, 0], [0, 1, 0]];     // along z: back, up
  const u = n3([ax[1], -ax[0], 0]);
  return [u, [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]]];
}

// The bail wire: a half loop around the spool, pivoting on the two rotor arms. Angle 0 = straight up.
const BAIL = { x: -0.28, r: 0.86, closed: 26 * DEG, open: -150 * DEG };
const SPOOL = { front: -1.0, lip: 0.655, back: -0.14, arbor: 0.4, full: 0.6, knob: 0.29, knobFront: -1.34, skirt: 0.665 };
const ROD_Y = 1.5;              // the rod runs along the top, above the reel
const GUIDE = [-2.2, ROD_Y - 0.32, 0];   // the first rod guide, off to the left: the line runs up to it
const HANDLE = { x: 1.02, y: -0.05, len: 0.8, ang: -58 * DEG };

export class ReelPanel extends Widget {
  constructor(container, { toLocal, hand = "right", area = null } = {}) {
    super(container, "reel-face");
    this.area = area || container;
    this.toLocal = toLocal || offsetLocal;
    this.mx = hand === "left" ? -1 : 1;
    // grab: a press takes the line at once even with the bail shut (the game opens the bail on the pin).
    // "all": anywhere the panel listens; "panel": only on the reel face itself (the lake is for aiming then)
    this.s = { bail: "closed", pinned: false, spool: 0, line: 0.85, hint: "", glow: "", touchCast: false, grab: "" };
    this.fx = { bail: 0, bailV: 0, spin: 0, glow: 0, clack: 0, thumbA: 0, guide: 0, wasOpen: false };
    this.ptrs = new Map();
    this.pinId = null;
    this.thumb = null;       // where the pinning finger is, in our css px
    this.S = 100; this.ox = 0; this.oy = 0;
    this.listen(this.area, "pointerdown", (e) => this._down(e));
    this.listen(window, "pointermove", (e) => this._move(e));
    this.listen(window, "pointerup", (e) => this._up(e));
    this.listen(window, "pointercancel", (e) => this._up(e, true));
    this.listen(window, "blur", () => this._cancelAll());
    this.resize();
  }

  set(o) {
    if (!o) return;
    for (const k in o) if (o[k] !== undefined && k in this.s) this.s[k] = o[k];
  }

  /* ----- touch ----- */
  _local(e) { return this.toLocal(e.clientX, e.clientY, this.el); }
  _down(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!this.fit() || blocked(e.target, this.area)) return;
    // the same id again means we missed its end (a lost pointerup): close the old one first
    if (this.ptrs.has(e.pointerId)) this._up(e, true);
    const q = this._local(e);
    const open = this.s.bail === "open";
    const inFace = q.x >= 0 && q.y >= 0 && q.x <= this.w && q.y <= this.h;
    const grab = this.s.grab === "all" || (this.s.grab === "panel" && inFace);
    // a grab press is never a bail swipe: the press itself opens the bail
    const p = { id: e.pointerId, x0: q.x, y0: q.y, x: q.x, y: q.y, onBail: !grab && this._onBail(q.x, q.y), open: open || grab, state: "wait", timer: 0, swiped: false };
    this.ptrs.set(p.id, p);
    if (open || grab) {
      // the bail is open and the line runs free (or the game grabs it on a press): any press holds it, at once
      if (this.pinId == null) this._pin(p, e.timeStamp); else p.state = "extra";
    } else {
      p.timer = setTimeout(() => {
        p.timer = 0;
        if (this.ptrs.get(p.id) !== p || p.state !== "wait") return;
        if (this.pinId == null) this._pin(p, now()); else p.state = "extra";
      }, T.pinHoldMs);
    }
  }
  _pin(p, t) {
    p.state = "pin";
    this.pinId = p.id;
    this.thumb = { x: p.x, y: p.y, x0: p.x, y0: p.y };
    this.emit("pin", { id: p.id, x: p.x, y: p.y, t });
  }
  // cancel: the browser took the touch away (pointercancel, the page lost focus), or a hold turned into a bail swipe.
  // That is not a thumb lifting off the line, so it must not count as a cast.
  _unpin(p, t, cancel = false) {
    p.state = "done";
    if (this.pinId === p.id) { this.pinId = null; this.thumb = null; }
    this.emit("unpin", { id: p.id, x: p.x, y: p.y, t, cancel });
  }
  _move(e) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    const q = this._local(e);
    p.x = q.x; p.y = q.y;
    const dx = p.x - p.x0, dy = p.y - p.y0;
    if (p.state === "wait" && Math.hypot(dx, dy) > T.pinSlopPx) {
      clearTimeout(p.timer); p.timer = 0;
      p.state = p.onBail ? "swipe" : "drag";
    }
    // the bail swipe: long enough, mostly vertical, and it started on the bail arm
    if (p.onBail && !p.swiped && Math.abs(dy) > T.bailSwipePx && Math.abs(dy) > T.bailVertical * Math.abs(dx)) {
      p.swiped = true;
      // a closed-bail hold that turns into a swipe never held any line: it ends here
      if (p.state === "pin" && !p.open) this._unpin(p, e.timeStamp, true);
      else if (p.state !== "pin") p.state = "swipe";
      this.emit("bail", { open: dy > 0 });
    }
    if (p.state === "pin") {
      if (this.thumb) { this.thumb.x = p.x; this.thumb.y = p.y; }
      this.emit("pinmove", { id: p.id, x: p.x, y: p.y, t: e.timeStamp });
    }
  }
  _up(e, cancel = false) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(p.id);
    if (p.timer) { clearTimeout(p.timer); p.timer = 0; }
    // a cancel may carry no position: keep the last one we saw
    if (!cancel || e.clientX || e.clientY) { const q = this._local(e); p.x = q.x; p.y = q.y; }
    if (p.state === "pin") this._unpin(p, e.timeStamp, cancel);
  }
  _cancelAll() {
    for (const p of [...this.ptrs.values()]) {
      this.ptrs.delete(p.id);
      if (p.timer) clearTimeout(p.timer);
      if (p.state === "pin") this._unpin(p, now(), true);
    }
  }
  _onBail(x, y) { const b = this.bailArea; return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
  // the touch target of the bail arm, in our css px, for the bail as it is now (not mid-swing)
  get bailArea() {
    const phi = this.s.bail === "open" ? BAIL.open : BAIL.closed;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of this._wire(phi, 0, Math.PI, 16)) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const pad = 22, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const w = Math.max(x1 - x0 + pad * 2, 120), h = Math.max(y1 - y0 + pad * 2, 96);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  /* ----- the view ----- */
  layout() {
    // fit the reel (not the rod, which runs off both sides) into the box
    const pts = [[-1.34, 0.3, 0.3], [-1.34, -0.3, 0.3], [-1, 0.66, -0.66], [-1, -0.66, 0.66], [0.5, -0.72, 0.72], [1.62, -0.05, 0.34],
      [1.5, -0.8, 1.05], [-0.66, 0.78, 0], [0.15, -0.76, 0], [1.1, ROD_Y + 0.14, 0], [-0.3, ROD_Y + 0.14, 0], [0.34, 0, 0.9]];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y, z] of pts) {
      const zc = -x * SY + z * CY, px = x * CY + z * SY, py = -y * CP + zc * SP;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    const w = this.w, h = this.h;
    const bottom = h > 300 ? 34 : 14;    // room for a hint line in a tall panel
    this.S = Math.max(20, Math.min((w * 0.9) / (x1 - x0), (h - 10 - bottom) / (y1 - y0), 175));
    this.ox = w / 2 - this.mx * this.S * (x0 + x1) / 2;
    this.oy = 6 + (h - bottom - 6) / 2 - this.S * (y0 + y1) / 2;
  }
  _p(x, y, z) {
    const zc = -x * SY + z * CY;
    return { x: this.ox + this.mx * this.S * (x * CY + z * SY), y: this.oy + this.S * (-y * CP + zc * SP) };
  }
  _v(v) {
    const zc = -v[0] * SY + v[2] * CY;
    return { x: this.mx * this.S * (v[0] * CY + v[2] * SY), y: this.S * (-v[1] * CP + zc * SP) };
  }
  // a circle in 3D (centre c, in the plane of e1 and e2, radius r) becomes the unit circle of a 2D frame
  _frame(c, e1, e2, r) {
    const a = this._v(e1), b = this._v(e2);
    return { O: this._p(c[0], c[1], c[2]), A: { x: a.x * r, y: a.y * r }, B: { x: b.x * r, y: b.y * r }, c, e1, e2, r };
  }
  _use(f) { const d = this.dpr; this.ctx.setTransform(d * f.A.x, d * f.A.y, d * f.B.x, d * f.B.y, d * f.O.x, d * f.O.y); }
  _flat() { const d = this.dpr; this.ctx.setTransform(d, 0, 0, d, 0, 0); }
  _at(f, u, v) { return { x: f.O.x + u * f.A.x + v * f.B.x, y: f.O.y + u * f.A.y + v * f.B.y }; }
  _inv(f, dx, dy) { const det = f.A.x * f.B.y - f.B.x * f.A.y; return [(dx * f.B.y - f.B.x * dy) / det, (f.A.x * dy - dx * f.A.y) / det]; }

  // A shaded cylinder: front centre c, unit axis ax, length L, radius r. Returns what the caps need.
  _cyl(c, ax, L, r, mat, k = 1) {
    const ctx = this.ctx, [e1, e2] = across(ax);
    const f = this._frame(c, e1, e2, r);
    const back = this._p(c[0] + ax[0] * L, c[1] + ax[1] * L, c[2] + ax[2] * L);
    const D = { x: back.x - f.O.x, y: back.y - f.O.y };
    const w = this._inv(f, D.x, D.y);
    const phi = Math.atan2(w[1], w[0]);
    // the outline: both end circles and the two lines that touch them
    ctx.beginPath();
    this._use(f);
    ctx.arc(0, 0, 1, phi + Math.PI / 2, phi + Math.PI * 1.5);
    ctx.arc(w[0], w[1], 1, phi - Math.PI / 2, phi + Math.PI / 2);
    ctx.closePath();
    this._flat();
    // shade across the cylinder, sampling the half that faces us
    const vis = dot3(VIEW, ax) < 0 ? phi : phi + Math.PI;
    const dl = Math.hypot(D.x, D.y) || 1, N = { x: -D.y / dl, y: D.x / dl };
    const T1 = this._at(f, Math.cos(vis - Math.PI / 2), Math.sin(vis - Math.PI / 2));
    const T2 = this._at(f, Math.cos(vis + Math.PI / 2), Math.sin(vis + Math.PI / 2));
    const span = (T2.x - T1.x) * N.x + (T2.y - T1.y) * N.y || 1;
    const g = ctx.createLinearGradient(T1.x, T1.y, T1.x + N.x * span, T1.y + N.y * span);
    for (let i = 0; i <= 12; i++) {
      const th = vis - Math.PI / 2 + (Math.PI * i) / 12, P = this._at(f, Math.cos(th), Math.sin(th));
      const s = ((P.x - T1.x) * N.x + (P.y - T1.y) * N.y) / span;
      const nn = [Math.cos(th) * e1[0] + Math.sin(th) * e2[0], Math.cos(th) * e1[1] + Math.sin(th) * e2[1], Math.cos(th) * e1[2] + Math.sin(th) * e2[2]];
      g.addColorStop(clamp(s, 0, 1), shade(nn, mat, k));
    }
    ctx.fillStyle = g;
    ctx.fill();
    return { f, w, phi, vis, e1, e2, back };
  }
  // A flat disc (or ring, with rIn) on a frame, brushed like turned metal: the highlight is a reflection and does not turn.
  _face(f, rIn, mat, k = 1, facing = [-1, 0, 0]) {
    const ctx = this.ctx;
    ctx.beginPath();
    this._use(f);
    ctx.arc(0, 0, 1, 0, TAU);
    if (rIn > 0) { ctx.moveTo(rIn, 0); ctx.arc(0, 0, rIn, 0, TAU, true); }
    const base = shade(facing, mat, k);
    if (ctx.createConicGradient) {
      const g = ctx.createConicGradient(-0.6, 0, 0);
      const hi = shade(facing, mat, k * 1.35), lo = shade(facing, mat, k * 0.72);
      g.addColorStop(0, base); g.addColorStop(0.1, hi); g.addColorStop(0.22, lo); g.addColorStop(0.36, base);
      g.addColorStop(0.5, base); g.addColorStop(0.6, hi); g.addColorStop(0.72, lo); g.addColorStop(0.86, base); g.addColorStop(1, base);
      ctx.fillStyle = g;
    } else ctx.fillStyle = base;
    ctx.fill("evenodd");
    this._flat();
  }
  // points of the bail wire loop, for t from t0 to t1 (0 = the near pivot, π = the far pivot)
  _wire(phi, t0, t1, n) {
    const out = [], ux = -Math.sin(phi), uy = Math.cos(phi);
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n, c = Math.cos(t) * BAIL.r, s = Math.sin(t) * BAIL.r;
      out.push(this._p(BAIL.x + s * ux, s * uy, c));
    }
    return out;
  }
  _strokePts(pts, w, style) {
    const ctx = this.ctx;
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.lineWidth = w; ctx.strokeStyle = style; ctx.stroke();
  }
  // a silver wire: dark edge, body, and a highlight on the lit side
  _wireStroke(pts, w, glow) {
    const ctx = this.ctx;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (glow > 0) {
      this._strokePts(pts, w + 26, rgba(BRASS, 0.07 * glow));
      this._strokePts(pts, w + 16, rgba(BRASS, 0.12 * glow));
      this._strokePts(pts, w + 9, rgba("255,214,120", 0.3 * glow));
      this._strokePts(pts, w + 4, rgba("255,224,150", 0.8 * glow));
    }
    this._strokePts(pts, w + 1.6, "rgba(10,20,24,0.8)");
    this._strokePts(pts, w, glow > 0.3 ? "#e9dcb4" : "#b9c3c7");
    ctx.save(); ctx.translate(-w * 0.18, -w * 0.22);
    this._strokePts(pts, w * 0.38, "rgba(255,255,255,0.9)");
    ctx.restore();
  }

  draw(dt = 0.016) {
    if (!this.fit()) return;
    dt = clamp(dt || 0, 0, 0.1);
    this.time += dt;
    const s = this.s, fx = this.fx;
    // the bail swings with a little overshoot, like the real snap
    const target = s.bail === "open" ? 1 : 0;
    if ((target === 1) !== fx.wasOpen) { fx.wasOpen = target === 1; fx.clack = 1; }
    const acc = 900 * (target - fx.bail) - 36 * fx.bailV;
    fx.bailV += acc * dt; fx.bail = clamp(fx.bail + fx.bailV * dt, -0.12, 1.12);
    fx.clack = Math.max(0, fx.clack - dt * 3.5);
    const spool = Math.max(0, +s.spool || 0);
    // what you see turn is capped: past a few turns a second a spinning part only strobes; the streaks show the speed
    fx.spin += Math.min(spool, 2.5) * TAU * dt;
    fx.glow = lerp(fx.glow, s.glow ? 1 : 0, 1 - Math.exp(-dt * 8));
    // full glow once the game takes the pin (set({pinned})); a dim one while it does not (the bail is still shut)
    fx.thumbA = lerp(fx.thumbA, this.thumb ? (s.pinned ? 1 : 0.35) : 0, 1 - Math.exp(-dt * 14));
    const guideOn = s.touchCast && s.bail === "open" && (this.pinId != null || spool < 0.5) && s.glow !== "bail";
    fx.guide = lerp(fx.guide, guideOn ? 1 : 0, 1 - Math.exp(-dt * (guideOn ? 6 : 14)));
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5.2);
    const phi = lerp(BAIL.closed, BAIL.open, fx.bail);
    const S = this.S, wireW = Math.max(3, S * 0.05);
    const moving = Math.abs(fx.bailV) > 0.01 || Math.abs(fx.bail - target) > 0.002;
    if (!moving) { fx.bail = target; fx.bailV = 0; }
    const spinning = spool > 0.02;
    // nothing moves and nothing glows: keep the last frame
    const idle = !moving && !spinning && fx.glow < 0.01 && fx.thumbA < 0.01 && fx.guide < 0.01 && fx.clack <= 0 && !s.hint;
    // a spinning spool repaints 20 times a second: the ports strobe at that speed anyway, and the coils move every frame
    const sceneKey = [this.w, this.h, this.dpr, Math.round(fx.bail * 500), spinning ? Math.floor(this.time * 20) : -1, s.line].join();
    if (idle && this.same(sceneKey)) return;
    if (!idle) this._drawn = null;
    // the parts that never move, then the reel as it stands now; each is redrawn only when it changes
    const back = this.layer("back"), scene = this.layer("scene");
    this.paint(back, [this.w, this.h, this.dpr, this.mx].join(), (c) => {
      this._backdrop(c); this._rod(c); this._body(c);
      this._arm(c, -1);   // behind the spool: the far rotor arm
    });
    this.paint(scene, sceneKey, (c) => {
      this.blit(back);
      this._wireStroke(this._wire(phi, Math.PI / 2, Math.PI, 20), wireW, 0);   // the far half of the bail
      this._rotor(c);
      this._spool(c, spool);
      this._arm(c, 1);
      // the line roller on the near pivot, and the near half of the bail in front of everything
      this._cyl([BAIL.x, 0, BAIL.r - 0.07], [0, 0, 1], 0.17, 0.075, MAT.silver);
      this._face(this._frame([BAIL.x, 0, BAIL.r + 0.1], [1, 0, 0], [0, 1, 0], 0.075), 0, MAT.silver, 1, [0, 0, 1]);
      this._wireStroke(this._wire(phi, 0, Math.PI / 2 + 0.02, 20), wireW, 0);
    });
    const ctx = this.begin();
    this.blit(scene);
    if (fx.clack > 0) {
      const q = this._p(BAIL.x, 0, BAIL.r + 0.05);
      ctx.strokeStyle = rgba("255,250,230", fx.clack * 0.8); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q.x, q.y, S * (0.12 + (1 - fx.clack) * 0.35), 0, TAU); ctx.stroke();
    }
    this._line(ctx, spool, fx.bail);
    // the bail glows where you touch it: the near half, over the finished reel
    const bailGlow = s.glow === "bail" ? fx.glow * (0.55 + 0.45 * pulse) : 0;
    if (bailGlow > 0.01) this._wireStroke(this._wire(phi, 0, Math.PI / 2 + 0.25, 24), wireW, bailGlow);
    this._overlays(ctx, pulse, phi);
  }

  _backdrop(ctx) {
    const w = this.w, h = this.h;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#134451"); g.addColorStop(0.5, "#0d2f38"); g.addColorStop(1, "#08202a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // a pool of light behind the reel, so the metal reads
    const c = this._p(-0.3, 0, 0), R = this.S * 2.1;
    const r = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
    r.addColorStop(0, "rgba(120,196,204,0.2)"); r.addColorStop(0.6, "rgba(90,160,170,0.06)"); r.addColorStop(1, "rgba(90,160,170,0)");
    ctx.fillStyle = r; ctx.fillRect(0, 0, w, h);
    // the lake view ends here: a hairline and a soft shadow
    const t = ctx.createLinearGradient(0, 0, 0, 14);
    t.addColorStop(0, "rgba(0,0,0,0.35)"); t.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = t; ctx.fillRect(0, 0, w, 14);
    ctx.fillStyle = "rgba(246,239,217,0.16)"; ctx.fillRect(0, 0, w, 1);
  }

  _rod(ctx) {
    const Y = ROD_Y;
    // the blank toward the tip, the reel seat, and the cork grip behind it
    this._cyl([-4.6, Y, 0], [1, 0, 0], 4.95, 0.06, MAT.blank);
    // the first guide and its foot: the line runs up through it
    const g = this._p(GUIDE[0], GUIDE[1], GUIDE[2]), gt = this._p(GUIDE[0], Y - 0.04, 0);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#8e9aa0"; ctx.lineWidth = Math.max(1.5, this.S * 0.025);
    ctx.beginPath(); ctx.moveTo(gt.x, gt.y); ctx.lineTo(g.x, g.y - this.S * 0.08); ctx.stroke();
    ctx.strokeStyle = "#dfe6e8"; ctx.lineWidth = Math.max(1.5, this.S * 0.022);
    ctx.beginPath(); ctx.ellipse(g.x, g.y, this.S * 0.05, this.S * 0.09, 0, 0, TAU); ctx.stroke();
    this._cyl([1.72, Y, 0], [1, 0, 0], 3.6, 0.165, MAT.cork);
    // cork has pores
    ctx.fillStyle = "rgba(70,45,20,0.35)";
    for (let i = 0; i < 70; i++) {
      const x = 1.78 + ((i * 0.618) % 1) * 3.3, a = ((i * 0.377) % 1) * 1.6 - 0.35;
      const q = this._p(x, Y + Math.cos(a) * 0.16, Math.sin(a) * 0.16);
      ctx.fillRect(q.x, q.y, 1.4, 1.1);
    }
    this._cyl([0.32, Y, 0], [1, 0, 0], 1.42, 0.125, MAT.gun);
    // hood rings at both ends of the seat, one in the accent colour
    this._cyl([0.3, Y, 0], [1, 0, 0], 0.16, 0.14, MAT.silver);
    this._cyl([1.6, Y, 0], [1, 0, 0], 0.14, 0.145, MAT.red);
  }

  _body(ctx) {
    // the stem that hangs the reel from the rod
    const q = [[0.66, 0.38], [1.18, 0.38], [1.3, ROD_Y - 0.1], [0.82, ROD_Y - 0.1]].map(([x, y]) => this._p(x, y, 0.07));
    const g = ctx.createLinearGradient(q[0].x, 0, q[1].x, 0);
    g.addColorStop(0, "#394247"); g.addColorStop(0.35, "#5c676c"); g.addColorStop(1, "#1a2023");
    ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    // the foot under the rod
    this._cyl([0.55, ROD_Y - 0.12, 0], [1, 0, 0], 1.1, 0.06, MAT.gun);
    // the gearbox: a short fat cylinder across the reel, and its side plate facing us
    const c = [HANDLE.x, HANDLE.y, -0.34];
    this._cyl([0.62, -0.02, 0], [1, 0, 0], 0.5, 0.44, MAT.body);
    this._cyl(c, [0, 0, 1], 0.68, 0.6, MAT.body);
    const plate = this._frame([HANDLE.x, HANDLE.y, 0.34], [1, 0, 0], [0, 1, 0], 0.6);
    this._face(plate, 0, MAT.body, 1.05, [0, 0, 1]);
    // a thin accent ring and four screws on the plate
    ctx.beginPath(); this._use(plate); ctx.arc(0, 0, 0.82, 0, TAU); ctx.moveTo(0.76, 0); ctx.arc(0, 0, 0.76, 0, TAU, true); this._flat();
    ctx.fillStyle = rgba(RED, 0.85); ctx.fill("evenodd");
    for (let i = 0; i < 4; i++) {
      const a = 0.6 + (i * TAU) / 4, p = this._at(plate, Math.cos(a) * 0.62, Math.sin(a) * 0.62);
      ctx.fillStyle = "#0b1012"; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, this.S * 0.03), 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(200,210,214,0.45)"; ctx.beginPath(); ctx.arc(p.x - 0.5, p.y - 0.5, Math.max(0.8, this.S * 0.013), 0, TAU); ctx.fill();
    }
    // the handle: a stub, a flat arm, and a knob that sticks out toward us
    this._cyl([HANDLE.x, HANDLE.y, 0.34], [0, 0, 1], 0.2, 0.13, MAT.silver);
    const a = HANDLE.ang, kx = HANDLE.x + Math.cos(a) * HANDLE.len, ky = HANDLE.y + Math.sin(a) * HANDLE.len;
    const nx = -Math.sin(a) * 0.075, ny = Math.cos(a) * 0.075;
    const arm = [[HANDLE.x + nx * 1.3, HANDLE.y + ny * 1.3, 0.55], [kx + nx, ky + ny, 0.62], [kx - nx, ky - ny, 0.62], [HANDLE.x - nx * 1.3, HANDLE.y - ny * 1.3, 0.55]].map(([x, y, z]) => this._p(x, y, z));
    const ag = ctx.createLinearGradient(arm[0].x, arm[0].y, arm[3].x, arm[3].y);
    ag.addColorStop(0, "#eef2f3"); ag.addColorStop(0.45, "#9aa5aa"); ag.addColorStop(1, "#4b5559");
    ctx.beginPath(); arm.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = ag; ctx.fill();
    const hub = this._frame([HANDLE.x, HANDLE.y, 0.56], [1, 0, 0], [0, 1, 0], 0.1);
    this._face(hub, 0, MAT.silver, 1.1, [0, 0, 1]);
    this._cyl([kx, ky, 0.6], [0, 0, 1], 0.4, 0.14, MAT.red);
    this._face(this._frame([kx, ky, 1.0], [1, 0, 0], [0, 1, 0], 0.14), 0, MAT.red, 1.05, [0, 0, 1]);
  }

  // a rotor arm, near (+1) or far (−1): it carries a bail pivot out past the spool
  _arm(ctx, side) {
    const z0 = side * 0.6, z1 = side * (BAIL.r - 0.02), hb = 0.15, ht = 0.085;
    const q = [[0.46, hb, z0], [BAIL.x - 0.03, ht, z1], [BAIL.x - 0.03, -ht, z1], [0.46, -hb, z0]].map(([x, y, z]) => this._p(x, y, z));
    // bow the long edges out a little, and round off the end at the pivot
    const bow = (a, b, k) => ({ x: (a.x + b.x) / 2 - (b.y - a.y) * k, y: (a.y + b.y) / 2 + (b.x - a.x) * k });
    const tipC = this._p(BAIL.x - 0.13, 0, z1 + side * 0.02);
    // shaded top to bottom like a rounded bar: the lit top edge, a dark belly
    const m0 = { x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[1].y) / 2 }, m1 = { x: (q[2].x + q[3].x) / 2, y: (q[2].y + q[3].y) / 2 };
    const g = ctx.createLinearGradient(m0.x, m0.y, m1.x, m1.y);
    const k = side > 0 ? 1 : 0.55, m = side > 0 ? MAT.steel : MAT.gun;
    g.addColorStop(0, shade(n3([0, 0.9, 0.45 * side]), m, k));
    g.addColorStop(0.4, shade(n3([0, 0.2, side]), m, k * 0.8));
    g.addColorStop(1, shade(n3([0, -0.8, 0.6 * side]), MAT.gun, k * 0.7));
    const top = bow(q[0], q[1], 0.12), bot = bow(q[2], q[3], 0.1);
    ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y);
    ctx.quadraticCurveTo(top.x, top.y, q[1].x, q[1].y);
    ctx.quadraticCurveTo(tipC.x, tipC.y, q[2].x, q[2].y);
    ctx.quadraticCurveTo(bot.x, bot.y, q[3].x, q[3].y);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.3; ctx.lineCap = "round";
    ctx.strokeStyle = side > 0 ? "rgba(235,242,244,0.6)" : "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); ctx.quadraticCurveTo(top.x, top.y, q[1].x, q[1].y); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath(); ctx.moveTo(q[2].x, q[2].y); ctx.quadraticCurveTo(bot.x, bot.y, q[3].x, q[3].y); ctx.stroke();
    // an accent pinstripe along the arm on the near side
    if (side > 0) {
      const p0 = this._p(0.3, 0.02, z0 + 0.03), p1 = this._p(BAIL.x + 0.08, 0.01, z1 - 0.02);
      ctx.strokeStyle = rgba(RED, 0.8); ctx.lineWidth = Math.max(1, this.S * 0.012);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    // the pivot boss
    const b = this._frame([BAIL.x, 0, z1], [1, 0, 0], [0, 1, 0], 0.1);
    this._face(b, 0, side > 0 ? MAT.gun : MAT.body, 1.1, [0, 0, side]);
  }

  _rotor(ctx) {
    const cup = this._cyl([0.02, 0, 0], [1, 0, 0], 0.52, 0.7, MAT.gun);
    this._face(cup.f, 0.9, MAT.gun, 0.8);
    // the accent ring on the lip of the rotor cup
    this._cyl([0.02, 0, 0], [1, 0, 0], 0.07, 0.712, MAT.red);
  }

  _spool(ctx, spool) {
    const s = this.s, fx = this.fx, S = this.S;
    const rl = SPOOL.arbor + (SPOOL.full - SPOOL.arbor) * clamp(+s.line || 0, 0, 1);
    // the skirt at the back of the spool
    const sk = this._cyl([SPOOL.back, 0, 0], [1, 0, 0], 0.18, SPOOL.skirt, MAT.silver, 0.95);
    this._face(sk.f, rl / SPOOL.skirt, MAT.silver, 0.9);
    // the arbor, then the line wound on it
    const len = SPOOL.back - (SPOOL.front + 0.1);
    this._cyl([SPOOL.front + 0.1, 0, 0], [1, 0, 0], len, SPOOL.arbor, MAT.steel);
    const band = this._cyl([SPOOL.front + 0.1, 0, 0], [1, 0, 0], len, rl, MAT.line);
    // the wraps: fine crossing turns across the visible half of the line
    const n = Math.max(10, Math.round((len * S * 0.9) / 3));
    ctx.lineWidth = 1;
    for (let i = 1; i < n; i++) {
      const x = SPOOL.front + 0.1 + (len * i) / n, tilt = (i % 2 ? 1 : -1) * 0.05;
      ctx.beginPath();
      for (let j = 0; j <= 12; j++) {
        const th = band.vis - Math.PI / 2 + (Math.PI * j) / 12;
        const q = this._p(x + tilt * (j / 12 - 0.5), Math.cos(th) * rl, Math.sin(th) * rl);
        j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
      ctx.strokeStyle = i % 2 ? "rgba(120,96,50,0.22)" : "rgba(255,255,240,0.22)";
      ctx.stroke();
    }
    // spinning: bright streaks run round the line
    const k = clamp(spool / 5, 0, 1);
    if (k > 0.02) {
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        const x = SPOOL.front + 0.1 + len * (0.2 + 0.2 * i);
        const a0 = fx.spin * (1 + i * 0.13) + i * 1.7, L = 0.5 + 1.4 * k;
        ctx.beginPath(); this._use(this._frame([x, 0, 0], [0, 1, 0], [0, 0, 1], rl * 1.004));
        ctx.arc(0, 0, 1, a0, a0 + L); this._flat();
        ctx.strokeStyle = rgba("255,255,250", 0.18 + 0.35 * k); ctx.lineWidth = 1.5 + 1.5 * k; ctx.stroke();
      }
    }
    // the front lip and the spool face with its ported holes
    const lip = this._cyl([SPOOL.front, 0, 0], [1, 0, 0], 0.1, SPOOL.lip, MAT.silver);
    this._face(lip.f, SPOOL.knob / SPOOL.lip + 0.04, MAT.silver);
    const face = lip.f, blur = spool > 1.5 ? 4 : 1;
    for (let b = 0; b < blur; b++) {
      const a = blur > 1 ? 0.5 / blur : 1;
      for (let i = 0; i < 5; i++) {
        const th = fx.spin + (i * TAU) / 5 - b * Math.min(0.5, spool * 0.02);
        ctx.beginPath(); this._use(face);
        ctx.arc(Math.cos(th) * 0.7, Math.sin(th) * 0.7, 0.12, 0, TAU);
        this._flat();
        ctx.fillStyle = rgba("16,26,30", 0.85 * a); ctx.fill();
      }
    }
    if (k > 0.02) {
      ctx.beginPath(); this._use(face); ctx.arc(0, 0, 0.7, fx.spin * 1.1, fx.spin * 1.1 + 0.8 + 2 * k); this._flat();
      ctx.strokeStyle = rgba("255,255,255", 0.25 * k); ctx.lineWidth = 2 + 3 * k; ctx.stroke();
    }
    // a rim light on the edge of the lip
    ctx.beginPath(); this._use(face); ctx.arc(0, 0, 1, Math.PI * 1.1, Math.PI * 1.7); this._flat();
    ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.2; ctx.stroke();
    // the drag knob: knurled, with the accent ring and a cap
    const kn = this._cyl([SPOOL.knobFront, 0, 0], [1, 0, 0], SPOOL.front - SPOOL.knobFront, SPOOL.knob, MAT.gun);
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const th = kn.vis - Math.PI / 2 + (Math.PI * (i + 0.5)) / 14;
      const a = this._p(SPOOL.knobFront + 0.04, Math.cos(th) * SPOOL.knob, Math.sin(th) * SPOOL.knob);
      const b = this._p(SPOOL.front - 0.02, Math.cos(th) * SPOOL.knob, Math.sin(th) * SPOOL.knob);
      ctx.strokeStyle = i % 2 ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.14)";
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const cap = this._frame([SPOOL.knobFront, 0, 0], [0, 1, 0], [0, 0, 1], SPOOL.knob);
    this._face(cap, 0, MAT.gun, 1.15);
    ctx.beginPath(); this._use(cap); ctx.arc(0, 0, 0.8, 0, TAU); ctx.moveTo(0.62, 0); ctx.arc(0, 0, 0.62, 0, TAU, true); this._flat();
    ctx.fillStyle = rgba(RED, 0.95); ctx.fill("evenodd");
    // a raised grip bar across the cap; it turns with the spool, so you can see it spin
    const t = fx.spin, c0 = Math.cos(t), s0 = Math.sin(t);
    ctx.beginPath(); this._use(cap);
    ctx.moveTo(c0 * 0.5 - s0 * 0.09, s0 * 0.5 + c0 * 0.09); ctx.lineTo(-c0 * 0.5 - s0 * 0.09, -s0 * 0.5 + c0 * 0.09);
    ctx.lineTo(-c0 * 0.5 + s0 * 0.09, -s0 * 0.5 - c0 * 0.09); ctx.lineTo(c0 * 0.5 + s0 * 0.09, s0 * 0.5 - c0 * 0.09);
    ctx.closePath(); this._flat();
    ctx.fillStyle = shade([-1, 0, 0], MAT.gun, 1.5); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1; ctx.stroke();
    this._band = { rl, vis: band.vis };
  }

  // the line: off the spool (through the roller when the bail is shut), up to the first guide
  _line(ctx, spool, bail) {
    const rl = this._band ? this._band.rl : 0.55, S = this.S;
    const G = this._p(GUIDE[0], GUIDE[1], GUIDE[2]);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const stroke = (pts, a = 1) => {
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.strokeStyle = rgba("20,30,30", 0.35 * a); ctx.lineWidth = 2.4; ctx.stroke();
      ctx.strokeStyle = rgba("250,242,205", 0.85 * a); ctx.lineWidth = 1.1; ctx.stroke();
    };
    const thumb = this.thumb && this.s.pinned && this.thumb.x > 0 && this.thumb.x < this.w && this.thumb.y > 0 && this.thumb.y < this.h ? this.thumb : null;
    if (bail < 0.5) {
      // shut: from the near side of the spool, over the roller, up to the guide
      const a = this._p(-0.34, 0.1, rl), r = this._p(BAIL.x, 0.04, BAIL.r + 0.02);
      stroke([a, r, G], 1 - bail);
      return;
    }
    const top = this._p(SPOOL.front - 0.02, SPOOL.lip * 0.93, 0.12);
    if (spool > 0.3) {
      // open and paying out: loose coils leave the lip and straighten toward the guide
      const k = clamp(spool / 6, 0.2, 1), pts = [], n = 160;
      for (let i = 0; i <= n; i++) {
        const u = i / n, amp = S * 0.26 * k * Math.pow(1 - u, 1.3);
        const ph = -this.fx.spin * 2.2 + u * 24;
        pts.push({ x: lerp(top.x, G.x, u) + Math.cos(ph) * amp, y: lerp(top.y, G.y, u) + Math.sin(ph) * amp * 0.55 });
      }
      stroke(pts, 0.9);
      return;
    }
    // open and held: if the thumb is on the reel, the line bends round it
    stroke(thumb ? [top, { x: thumb.x, y: thumb.y }, G] : [top, G]);
  }

  _overlays(ctx, pulse, phi) {
    const s = this.s, fx = this.fx, w = this.w, h = this.h, S = this.S;
    // "touch here": the bail wire glows (drawn with it); chevrons run the way to swipe
    if (s.glow === "bail" && fx.glow > 0.05) {
      const open = s.bail === "open", dir = open ? -1 : 1;
      const apex = this._wire(phi, Math.PI / 2, Math.PI / 2, 1)[0];
      const x = clamp(apex.x - S * 0.12, 26, w - 26);
      const len = Math.min(h * 0.32, S * 0.95), y0 = open ? apex.y + S * 0.15 : apex.y - S * 0.22;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let i = 0; i < 3; i++) {
        const u = (this.time * 1.1 + i / 3) % 1, y = y0 + dir * len * u, a = Math.sin(u * Math.PI) * fx.glow;
        const path = () => { ctx.beginPath(); ctx.moveTo(x - 13, y - dir * 8); ctx.lineTo(x, y + dir * 4); ctx.lineTo(x + 13, y - dir * 8); };
        path(); ctx.strokeStyle = rgba("6,22,27", 0.55 * a); ctx.lineWidth = 7.5; ctx.stroke();
        path(); ctx.strokeStyle = rgba("255,214,120", a); ctx.lineWidth = 4; ctx.stroke();
      }
      const label = open ? "SWIPE UP" : "SWIPE DOWN";
      ctx.font = font(13); spaced(ctx, 0.12); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const tw = ctx.measureText(label).width, ly = open ? y0 + 22 : y0 - 20, lx = clamp(x, tw / 2 + 10, w - tw / 2 - 10);
      ctx.beginPath(); rrect(ctx, lx - tw / 2 - 10, ly - 12, tw + 20, 24, 12);
      ctx.fillStyle = rgba("9,34,41", 0.72 * fx.glow); ctx.fill();
      ctx.strokeStyle = rgba(BRASS, 0.5 * fx.glow); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = rgba("255,224,150", fx.glow);
      ctx.fillText(label, lx, ly + 0.5);
      spaced(ctx, 0);
    }
    // "hold the line here": a soft ring on the spool
    if (s.glow === "pin" && fx.glow > 0.05 && !this.thumb) {
      const c = this._p(-0.55, 0.05, 0.35), r = S * (0.52 + 0.06 * pulse);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 1.25);
      g.addColorStop(0, rgba("255,224,150", 0.26 * fx.glow)); g.addColorStop(0.7, rgba(BRASS, 0.1 * fx.glow)); g.addColorStop(1, rgba(BRASS, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.25, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba("255,214,120", (0.45 + 0.45 * pulse) * fx.glow); ctx.lineWidth = 3;
      ctx.setLineDash([8, 7]); ctx.lineDashOffset = -this.time * 14;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = font(13); spaced(ctx, 0.14); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const ly = Math.min(h - 14, c.y + r + 16), tw = ctx.measureText("HOLD HERE").width;
      ctx.beginPath(); rrect(ctx, c.x - tw / 2 - 10, ly - 12, tw + 20, 24, 12);
      ctx.fillStyle = rgba("9,34,41", 0.72 * fx.glow); ctx.fill();
      ctx.fillStyle = rgba("255,224,150", fx.glow);
      ctx.fillText("HOLD HERE", c.x, ly + 0.5);
      spaced(ctx, 0);
    }
    // the thumb that holds the line
    if (this.thumb && fx.thumbA > 0.02) this.thumbGlow(ctx, this.thumb.x, this.thumb.y, 52 + 5 * pulse, fx.thumbA);
    // touch casting: drag down, then flick up
    if (fx.guide > 0.02) this._guide(ctx, fx.guide, pulse);
    if (s.hint) {
      ctx.font = font(13, 800); spaced(ctx, 0);
      const tw = Math.min(w - 20, ctx.measureText(s.hint).width + 26), x = (w - tw) / 2, y = h - 30;
      ctx.beginPath(); rrect(ctx, x, y, tw, 24, 12);
      ctx.fillStyle = "rgba(9,34,41,0.82)"; ctx.fill(); ctx.strokeStyle = "rgba(246,239,217,0.18)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#f6efd9"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s.hint, w / 2, y + 12.5, tw - 16);
    }
  }
  // The touch cast guide: a rail on the free edge. With a thumb down, its bead is the rod: drag down past the brass
  // LOAD mark, then flick up. With no thumb it shows the rhythm by itself.
  _guide(ctx, a, pulse) {
    const w = this.w, h = this.h, th = this.thumb, right = this.mx > 0;
    const x = right ? w - 24 : 24;
    const y0 = clamp(h * 0.16, 26, 60), y1 = Math.max(y0 + 80, Math.min(h - 26, y0 + h * 0.45));
    const at = (theta) => lerp(y0, y1, clamp((theta - 80) / 80, 0, 1));
    // the same mapping main.js uses for touch casting: 150° of rod over one panel height of drag
    const theta = th ? 80 + ((th.y - th.y0) / Math.max(160, h)) * 150 : null;
    let by;
    if (th) by = at(theta);
    else { const u = (this.time * 0.55) % 1; by = u < 0.7 ? lerp(y0, at(125), smooth(0, 0.7, u)) : lerp(at(125), y0, smooth(0.7, 0.8, u)); }
    const loaded = th ? theta >= 105 : false;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(6,22,27,0.45)";
    ctx.beginPath(); rrect(ctx, x - 9, y0 - 12, 18, y1 - y0 + 24, 9); ctx.fill();
    ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); ctx.setLineDash([]);
    // the load mark
    const ly = at(105);
    ctx.strokeStyle = rgba(BRASS, 0.95); ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - 9, ly); ctx.lineTo(x + 9, ly); ctx.stroke();
    // the bead
    if (loaded) {
      const g = ctx.createRadialGradient(x, by, 0, x, by, 18);
      g.addColorStop(0, rgba("255,224,150", 0.7)); g.addColorStop(1, rgba(BRASS, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, by, 18, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = loaded ? "#ffe29a" : rgba(INK, 0.9);
    ctx.beginPath(); ctx.arc(x, by, 6, 0, TAU); ctx.fill();
    // labels on the inside of the rail
    ctx.font = font(11); spaced(ctx, 0.1); ctx.textBaseline = "middle"; ctx.textAlign = right ? "right" : "left";
    const tx = x + (right ? -16 : 16);
    ctx.fillStyle = rgba(INK, 0.85);
    ctx.fillText("DRAG DOWN", tx, lerp(y0, ly, 0.45));
    ctx.fillStyle = rgba(BRASS, loaded ? 0.7 + 0.3 * pulse : 0.9);
    ctx.fillText(loaded ? "NOW FLICK UP" : "FLICK UP", tx, Math.min(y1, ly + 18));
    ctx.fillStyle = rgba(BRASS, 0.9);
    ctx.font = font(9); ctx.fillText("LOAD", tx, ly);
    spaced(ctx, 0);
    ctx.restore();
  }
}

/* ---------------- the crank ---------------- */
export class Crank extends Widget {
  constructor(container, { toLocal, hand = "right" } = {}) {
    super(container, "crank");
    this.toLocal = toLocal || offsetLocal;
    this.dir = hand === "left" ? -1 : 1;   // which way the idle arrow points
    this.ang = -Math.PI / 3;                // the handle, clockwise on screen
    this.drag = null;
    this.hist = [];
    this.v = 0;        // smoothed rev/s from the thumb, the wheel, the key and a fling
    this.out = 0;
    this.coast = 0;    // signed rev/s left over from a fling
    this.bank = 0;     // wheel turns waiting to be played out
    this.key = false;
    this.snap = 0;     // radians the handle still has to swing to reach the thumb
    this.gap = 16; this.step = 16;   // ms between move events as delivered, and between samples
    this.travel = 0; this.quarters = 0;
    this.lit = [0, 0, 0, 0];
    this.last = now();
    this.listen(container, "pointerdown", (e) => this._down(e));
    this.listen(window, "pointermove", (e) => this._move(e));
    this.listen(window, "pointerup", (e) => this._up(e));
    this.listen(window, "pointercancel", (e) => this._up(e, true));
    this.listen(window, "blur", () => { this.drag = null; this.key = false; });
    this.resize();
  }
  get rate() { this._update(); return this.out; }
  get angle() { return this.ang; }
  keyHold(b) { this.key = !!b; }
  wheel(deltaY) {
    const d = Math.abs(+deltaY || 0);
    if (d > 0) this.bank = Math.min(3, this.bank + d / T.wheelPxPerRev);
  }
  _size() { return Math.min(this.el.clientWidth, this.el.clientHeight) || 1; }
  _polar(e) {
    const q = this.toLocal(e.clientX, e.clientY, this.el);
    const x = q.x - this.el.clientWidth / 2, y = q.y - this.el.clientHeight / 2;
    return { x: q.x, y: q.y, a: Math.atan2(y, x), r: Math.hypot(x, y) };
  }
  _down(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (this.drag && this.drag.id !== e.pointerId) return;   // one thumb turns the handle
    if (blocked(e.target, this.el)) return;
    const p = this._polar(e), ok = p.r > T.crankMinR * this._size();
    this.drag = { id: e.pointerId, raw: ok ? p.a : null, a: 0, x: p.x, y: p.y, lastT: e.timeStamp };
    this.hist = [{ t: e.timeStamp, a: 0 }];
    this.coast = 0;
    // the handle swings to the thumb
    if (ok) this.snap = wrapPi(p.a - this.ang);
  }
  _move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    // how often moves reach us; a pause (a still thumb) is not a cadence
    const tn = now();
    if (d.seen) { const g = tn - d.seen; if (g < 120) this.gap = lerp(this.gap, g, 0.25); }
    d.seen = tn;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    for (const ev of evs && evs.length ? evs : [e]) this._sample(ev);
  }
  _sample(e) {
    const d = this.drag, p = this._polar(e);
    d.x = p.x; d.y = p.y;
    if (p.r < T.crankMinR * this._size()) { d.raw = null; return; }   // too near the hub: wait until it comes out again
    if (d.raw == null) { d.raw = p.a; return; }
    const da = wrapPi(p.a - d.raw);
    d.raw = p.a;
    d.a += da;
    this.ang += da;
    this._travel(Math.abs(da) / TAU);
    const t = Math.max(e.timeStamp, d.lastT);
    if (t - d.lastT < 120) this.step = lerp(this.step, t - d.lastT, 0.25);
    d.lastT = t;
    this.hist.push({ t, a: d.a });
    while (this.hist.length > 2 && this.hist[1].t < t - 400) this.hist.shift();
  }
  _up(e, cancel) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!cancel) {
      // a fling leaves a little spin on the handle
      const last = this.hist[this.hist.length - 1];
      const v = this._thumbRate(e.timeStamp);
      if (last && e.timeStamp - last.t < Math.max(60, this._stale()) && Math.abs(v) > 0.8) this.coast = v * T.flingKeep;
    }
    this.drag = null;
    this.hist = [];
  }
  // how long without a sample before we call the thumb stopped
  _stale() { return clamp(Math.max(1.3 * this.gap, 1.5 * this.step), T.crankStaleMs, 150); }
  // signed rev/s: the angle the thumb swept over the last window
  _thumbRate(t) {
    const h = this.hist;
    if (h.length < 2) return 0;
    const last = h[h.length - 1];
    const tEnd = Math.max(last.t, t - this._stale()), t0 = tEnd - T.crankWinMs;
    let a0 = h[0].a;
    if (t0 > h[0].t) {
      for (let i = h.length - 1; i > 0; i--) {
        if (h[i - 1].t <= t0) { const A = h[i - 1], B = h[i], u = B.t > A.t ? (t0 - A.t) / (B.t - A.t) : 1; a0 = A.a + (B.a - A.a) * clamp(u, 0, 1); break; }
      }
    }
    return (last.a - a0) / (T.crankWinMs / 1000) / TAU;
  }
  _travel(rev) {
    this.travel += rev;
    while (this.travel >= (this.quarters + 1) * 0.25) {
      this.quarters++;
      // light the quarter mark the knob is passing
      this.lit[((Math.round((this.ang + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4] = 1;
      this.emit("turn", { n: this.quarters, turns: this.quarters / 4 });
    }
  }
  _update() {
    const t = now();
    let dt = (t - this.last) / 1000;
    if (!(dt > 0.0005)) return;
    this.last = t;
    dt = Math.min(dt, 0.1);
    let raw = 0, free = 0;
    if (this.drag) raw += Math.abs(this._thumbRate(t));
    if (this.bank > 0) {
      let take = this.bank * (1 - Math.exp(-dt / 0.09));
      if (this.bank - take < 0.002) take = this.bank;
      this.bank -= take;
      raw += take / dt; free += take * this.dir;
    }
    if (this.key) { raw += T.keyRps; free += T.keyRps * dt * this.dir; }
    if (this.coast) {
      raw += Math.abs(this.coast);
      free += this.coast * dt;
      this.coast *= Math.exp(-dt * T.flingDecay);
      if (Math.abs(this.coast) < 0.06) this.coast = 0;
    }
    // a thumb that stops holds the handle: let go of the speed faster than we pick it up
    this.v += (raw - this.v) * (1 - Math.exp(-dt / (raw < 0.01 ? T.crankTau * 0.55 : T.crankTau)));
    this.out = this.v < 0.03 ? 0 : Math.min(T.maxRps, this.v);
    if (free) { this.ang += free * TAU; this._travel(Math.abs(free)); }
    if (this.snap) {
      const k = 1 - Math.exp(-dt * 22), s = this.snap * k;
      this.ang += s; this.snap -= s;
      if (Math.abs(this.snap) < 0.002) this.snap = 0;
    }
  }
  draw(dt = 0.016) {
    this._update();
    if (!this.fit()) return;
    dt = clamp(dt || 0, 0, 0.1);
    this.time += dt;
    const w = this.w, h = this.h, s = Math.min(w, h), cx = w / 2, cy = h / 2;
    const R0 = s * 0.49, Rt = s * 0.335, kr = Math.max(15, s * 0.1), hubR = s * 0.11;
    const rate = this.out, a = this.ang;
    let lit = 0;
    for (let i = 0; i < 4; i++) { this.lit[i] = Math.max(0, this.lit[i] - dt * 3); lit += this.lit[i]; }
    const hint = this.quarters < 8;
    const key = [w, h, this.dpr, a.toFixed(3), rate > 0.15 ? rate.toFixed(2) : 0, lit.toFixed(2), this.drag ? Math.round(this.drag.x) + ":" + Math.round(this.drag.y) : "", hint ? this.quarters : 8].join();
    if (this.same(key)) return;
    // the dial: drawn once, then copied
    const back = this.layer("back");
    this.paint(back, [w, h, this.dpr, this.dir, hint].join(), (ctx) => {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
      const g = ctx.createRadialGradient(cx, cy - R0 * 0.3, R0 * 0.1, cx, cy, R0);
      g.addColorStop(0, "rgba(27,84,98,0.86)"); g.addColorStop(1, "rgba(8,28,34,0.9)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(246,239,217,0.2)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R0 - 0.5, 0, TAU); ctx.stroke();
      // the track the knob runs in
      ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = kr * 2 + 8;
      ctx.beginPath(); ctx.arc(cx, cy, Rt, 0, TAU); ctx.stroke();
      ctx.strokeStyle = "rgba(246,239,217,0.1)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, Rt + kr + 4, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, Rt - kr - 4, 0, TAU); ctx.stroke();
      // fine knurling round the rim, like a real reel handle's dial
      ctx.strokeStyle = "rgba(246,239,217,0.07)"; ctx.lineWidth = 1;
      for (let i = 0; i < 72; i++) {
        const q = (i * TAU) / 72;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(q) * (R0 - 4), cy + Math.sin(q) * (R0 - 4)); ctx.lineTo(cx + Math.cos(q) * (R0 - 8), cy + Math.sin(q) * (R0 - 8)); ctx.stroke();
      }
      this._ticks(ctx, cx, cy, Rt, kr, R0, null);
      // the arrow: which way to turn (either way works; the hint says so for the first few turns)
      const idle = hint ? 1 : 0.4, ar = Rt + kr + 7 + (R0 - Rt - kr - 12) / 2, d = this.dir;
      const a0 = d > 0 ? -Math.PI * 0.95 : -Math.PI * 0.05, a1 = d > 0 ? -Math.PI * 0.62 : -Math.PI * 0.38;
      ctx.strokeStyle = rgba(INK, 0.35 * idle); ctx.lineWidth = 2.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, cy, ar, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
      const hx = cx + Math.cos(a1) * ar, hy = cy + Math.sin(a1) * ar, tg = a1 + (d * Math.PI) / 2;
      ctx.fillStyle = rgba(INK, 0.5 * idle);
      ctx.beginPath(); ctx.moveTo(hx + Math.cos(tg) * 7, hy + Math.sin(tg) * 7);
      ctx.lineTo(hx + Math.cos(tg + 2.3) * 6, hy + Math.sin(tg + 2.3) * 6); ctx.lineTo(hx + Math.cos(tg - 2.3) * 6, hy + Math.sin(tg - 2.3) * 6); ctx.closePath(); ctx.fill();
    });
    const ctx = this.begin();
    this.blit(back);
    if (lit > 0) this._ticks(ctx, cx, cy, Rt, kr, R0, this.lit);
    // motion trail behind the knob
    if (rate > 0.15) {
      const len = Math.min(2.8, rate * 0.9), sgn = this._spinSign(), k = Math.min(1, rate / 1.2);
      const from = sgn > 0 ? a - len : a, f = len / TAU;
      if (ctx.createConicGradient) {
        const g = ctx.createConicGradient(from, cx, cy);
        const head = rgba("255,226,160", 0.42 * k), tail = rgba("255,226,160", 0);
        if (sgn > 0) { g.addColorStop(0, tail); g.addColorStop(f, head); g.addColorStop(Math.min(1, f + 0.001), tail); }
        else { g.addColorStop(0, head); g.addColorStop(f, tail); }
        g.addColorStop(1, tail);
        ctx.strokeStyle = g;
      } else ctx.strokeStyle = rgba("255,226,160", 0.2 * k);
      ctx.lineWidth = kr * 1.7; ctx.lineCap = "butt";
      ctx.beginPath(); ctx.arc(cx, cy, Rt, from, from + len); ctx.stroke();
    }
    const kx = cx + Math.cos(a) * Rt, ky = cy + Math.sin(a) * Rt;
    const nx = -Math.sin(a), ny = Math.cos(a), w0 = s * 0.05, w1 = s * 0.034;
    const armPath = (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(cx + ox + nx * w0, cy + oy + ny * w0); ctx.lineTo(kx + ox + nx * w1, ky + oy + ny * w1);
      ctx.arc(kx + ox, ky + oy, w1, a + Math.PI / 2, a - Math.PI / 2, true);
      ctx.lineTo(cx + ox - nx * w0, cy + oy - ny * w0);
      ctx.arc(cx + ox, cy + oy, w0, a - Math.PI / 2, a + Math.PI / 2, true);
      ctx.closePath();
    };
    // soft shadows, faked with offset copies (a blur per frame costs too much without a GPU)
    ctx.fillStyle = "rgba(0,0,0,0.16)"; armPath(1, 5); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.22)"; armPath(0.5, 3); ctx.fill();
    // the arm: a tapered bar from the hub to the knob
    const ag = ctx.createLinearGradient(cx + nx * w0, cy + ny * w0, cx - nx * w0, cy - ny * w0);
    ag.addColorStop(0, "#e9eef0"); ag.addColorStop(0.4, "#98a4a9"); ag.addColorStop(1, "#3b4549");
    ctx.fillStyle = ag; armPath(0, 0); ctx.fill();
    // the hub: turned metal with a screw
    const hg = ctx.createConicGradient ? ctx.createConicGradient(-0.6, cx, cy) : null;
    if (hg) { for (const [o, c] of [[0, "#8e999e"], [0.12, "#f2f5f6"], [0.25, "#6a757a"], [0.5, "#8e999e"], [0.62, "#f2f5f6"], [0.75, "#6a757a"], [1, "#8e999e"]]) hg.addColorStop(o, c); }
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.arc(cx + 1, cy + 3, hubR + 1, 0, TAU); ctx.fill();
    ctx.fillStyle = hg || "#aab4b8";
    ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#1b2326"; ctx.beginPath(); ctx.arc(cx, cy, hubR * 0.36, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#7d898e"; ctx.lineWidth = Math.max(1.5, hubR * 0.12);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * hubR * 0.26, cy + Math.sin(a) * hubR * 0.26); ctx.lineTo(cx - Math.cos(a) * hubR * 0.26, cy - Math.sin(a) * hubR * 0.26); ctx.stroke();
    // the knob: the one red thing, big enough for a thumb
    ctx.fillStyle = "rgba(0,0,0,0.14)"; ctx.beginPath(); ctx.arc(kx + 1.5, ky + 6, kr + 2, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.arc(kx + 1, ky + 3.5, kr, 0, TAU); ctx.fill();
    const kg = ctx.createRadialGradient(kx - kr * 0.35, ky - kr * 0.4, kr * 0.1, kx, ky, kr);
    kg.addColorStop(0, "#ffb0a4"); kg.addColorStop(0.35, "#ef5a4c"); kg.addColorStop(0.8, "#b8342a"); kg.addColorStop(1, "#7e1d15");
    ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(60,10,6,0.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(kx, ky, kr - 0.5, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.ellipse(kx - kr * 0.32, ky - kr * 0.42, kr * 0.28, kr * 0.16, -0.5, 0, TAU); ctx.fill();
    // the hint, the first few turns: over the handle, each word on its own dark pill, so the arm never hides it
    if (hint) {
      const fp = Math.max(9, Math.round(s * 0.052)), fade = 0.6 * (1 - this.quarters / 8) + 0.1;
      ctx.font = font(fp); spaced(ctx, 0.12); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const [t, y] of [["TURN", cy - hubR - s * 0.055], ["EITHER WAY", cy + hubR + s * 0.06]]) {
        const tw = ctx.measureText(t).width + fp * 1.1, th = fp * 1.7;
        ctx.fillStyle = rgba("9,34,41", 0.72 * Math.min(1, fade * 1.6));
        ctx.beginPath(); rrect(ctx, cx - tw / 2, y - th / 2, tw, th, Math.min(10, th / 2)); ctx.fill();
        ctx.fillStyle = rgba(INK, fade + 0.2);
        ctx.fillText(t, cx, y);
      }
      spaced(ctx, 0);
    }
    if (this.drag) this.thumbGlow(ctx, this.drag.x, this.drag.y, Math.max(34, kr * 2), 0.8);
  }
  // the quarter marks; lit (brass) as the handle passes them, at the same moments as the gear ticks
  _ticks(ctx, cx, cy, Rt, kr, R0, lit) {
    for (let i = 0; i < 4; i++) {
      const l = lit ? lit[i] : 0;
      if (lit && l <= 0) continue;
      const q = -Math.PI / 2 + (i * Math.PI) / 2;
      ctx.strokeStyle = l > 0 ? rgba(BRASS, 0.35 + 0.65 * l) : "rgba(246,239,217,0.3)";
      ctx.lineWidth = 2.5 + 1.5 * l; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(q) * (Rt + kr + 7), cy + Math.sin(q) * (Rt + kr + 7));
      ctx.lineTo(cx + Math.cos(q) * (R0 - 5), cy + Math.sin(q) * (R0 - 5)); ctx.stroke();
    }
  }
  _spinSign() {
    if (this.drag) { const r = this._thumbRate(now()); return r < 0 ? -1 : 1; }
    return this.coast < 0 ? -1 : this.dir;
  }
}

/* ---------------- the rod pad ---------------- */
export class RodPad extends Widget {
  constructor(container, { toLocal } = {}) {
    super(container, "rodpad");
    this.toLocal = toLocal || offsetLocal;
    this._theta = T.rodStart;
    this._steer = 0;
    this.drag = null;
    this.k = { up: false, down: false, left: false, right: false };
    this.yankA = 0;
    this.last = now();
    this.listen(container, "pointerdown", (e) => this._down(e));
    this.listen(window, "pointermove", (e) => this._move(e));
    this.listen(window, "pointerup", (e) => this._up(e));
    this.listen(window, "pointercancel", (e) => this._up(e, true));
    this.listen(window, "blur", () => { this.drag = null; this.keys({}); });
    this.resize();
  }
  get theta() { this._update(); return this._theta; }
  get steer() { this._update(); return this._steer; }
  keys(st) {
    st = st || {};
    this._update();
    this.k = { up: !!st.up, down: !!st.down, left: !!st.left, right: !!st.right };
  }
  _degPerPx() { return (T.rodMax - T.rodMin) / Math.max(120, this.el.clientHeight * 0.8); }
  _steerAt(x) {
    const half = Math.max(30, this.el.clientWidth * 0.42), o = clamp((x - this.el.clientWidth / 2) / half, -1, 1);
    return Math.sign(o) * Math.max(0, Math.abs(o) - T.steerDead) / (1 - T.steerDead);
  }
  _down(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (this.drag || blocked(e.target, this.el)) return;
    this._update();
    const q = this.toLocal(e.clientX, e.clientY, this.el);
    this.drag = { id: e.pointerId, y0: q.y, th0: this._theta, x: q.x, y: q.y, hist: [{ t: e.timeStamp, y: q.y }], armed: true };
    this._steer = this._steerAt(q.x);
  }
  _move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const q = this.toLocal(e.clientX, e.clientY, this.el);
    d.x = q.x; d.y = q.y;
    // relative: the rod stays where you leave it, like holding a real one
    this._theta = clamp(d.th0 - (q.y - d.y0) * this._degPerPx(), T.rodMin, T.rodMax);
    if (this._theta === T.rodMin || this._theta === T.rodMax) { d.th0 = this._theta; d.y0 = q.y; }
    this._steer = this._steerAt(q.x);
    d.hist.push({ t: e.timeStamp, y: q.y });
    while (d.hist.length > 2 && d.hist[0].t < e.timeStamp - 150) d.hist.shift();
    this._yankCheck(e.timeStamp);
  }
  // an upward swipe faster than yankPxs sets the hook, once per stroke
  _yankCheck(t) {
    const d = this.drag, h = d.hist;
    let i = h.length - 1;
    while (i > 0 && h[i].t > t - 70) i--;
    const A = h[i], B = h[h.length - 1], span = (B.t - A.t) / 1000;
    if (span < 0.012) return;
    const v = (A.y - B.y) / span;   // + = up
    if (v > T.yankPxs && d.armed) { d.armed = false; this.yankA = 1; this.emit("yank", { v }); }
    else if (v < T.yankPxs * 0.35) d.armed = true;
  }
  _up(e, cancel = false) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    // a flick that lets go mid-stroke: the lift point still counts toward the speed
    if (!cancel) { const q = this.toLocal(e.clientX, e.clientY, this.el); d.hist.push({ t: e.timeStamp, y: q.y }); this._yankCheck(e.timeStamp); }
    this.drag = null;
  }
  _update() {
    const t = now();
    let dt = (t - this.last) / 1000;
    if (!(dt > 0.0005)) return;
    this.last = t;
    dt = Math.min(dt, 0.1);
    const k = this.k, dv = ((k.up ? 1 : 0) - (k.down ? 1 : 0)) * T.rodKeyDps * dt;
    if (dv) {
      this._theta = clamp(this._theta + dv, T.rodMin, T.rodMax);
      if (this.drag) this.drag.th0 = clamp(this.drag.th0 + dv, T.rodMin, T.rodMax);
    }
    const ks = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    if (ks) this._steer = ks;
    else if (!this.drag) { this._steer *= Math.exp(-dt * 22); if (Math.abs(this._steer) < 0.02) this._steer = 0; }
  }
  draw(dt = 0.016) {
    this._update();
    if (!this.fit()) return;
    dt = clamp(dt || 0, 0, 0.1);
    this.time += dt;
    this.yankA = Math.max(0, this.yankA - dt * 1.8);
    const w = this.w, h = this.h, th = this._theta, d = this.drag;
    if (this.same([w, h, this.dpr, th.toFixed(2), this._steer.toFixed(3), d ? Math.round(d.x) + ":" + Math.round(d.y) : "", this.yankA.toFixed(2), this.jump ? 1 : 0].join())) return;
    const back = this.layer("back");
    this.paint(back, [w, h, this.dpr].join(), (c) => this.glass(c, 0.5, 0.5, w - 1, h - 1, 16));
    const ctx = this.begin();
    this.blit(back);
    // the header
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.font = font(12); spaced(ctx, 0.14); ctx.fillStyle = rgba(BRASS, 1);
    ctx.fillText("ROD", 12, 16);
    const low = th < 28, high = th > 70;
    if (h > 230) {
      ctx.font = font(10, 800); spaced(ctx, 0.04); ctx.fillStyle = rgba(INK, 0.5);
      ctx.fillText("Drag it up and down.", 12, 34);
      ctx.fillText("Swipe up fast to hook.", 12, 48);
    }
    ctx.textAlign = "right"; ctx.font = font(10); spaced(ctx, 0.1);
    // main.js sets jump while a fish leaps: then a low rod is the right move
    ctx.fillStyle = low && !this.jump ? rgba(DANGER, 0.95) : rgba(GREEN, 0.95);
    if (low || high) ctx.fillText(low ? (this.jump ? "LOW: GOOD" : "TOO LOW") : "LIFT", w - 12, 16);
    spaced(ctx, 0);
    // the rod seen from your right side: a pivot, the arc it can swing through, and the rod
    const steerY = h - 17;
    const yTop = h > 230 ? 60 : 34, yBot = steerY - 22, L = Math.max(20, Math.min(w * 0.56, (yBot - yTop) * 0.78));
    const px = w * 0.3, py = Math.min(yBot - 12, (yTop + yBot) / 2 + L * 0.45);
    const ang = (d) => -d * DEG;
    // zones: too low (red), lifting (green)
    const band = (d0, d1, col) => { ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.lineCap = "butt"; ctx.beginPath(); ctx.arc(px, py, L + 8, ang(d1), ang(d0)); ctx.stroke(); };
    band(T.rodMin, 28, rgba(DANGER, 0.28));
    band(28, 70, rgba(INK, 0.1));
    band(70, T.rodMax, rgba(GREEN, 0.3));
    ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 1.5;
    for (let d = 10; d <= 110; d += 20) {
      const a = ang(d);
      ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * (L + 3), py + Math.sin(a) * (L + 3)); ctx.lineTo(px + Math.cos(a) * (L + 13), py + Math.sin(a) * (L + 13)); ctx.stroke();
    }
    // the water line, far below the tip
    ctx.strokeStyle = "rgba(120,196,204,0.25)"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(10, py + 14); ctx.lineTo(w - 10, py + 14); ctx.stroke(); ctx.setLineDash([]);
    const a = ang(th), tx = px + Math.cos(a) * L, ty = py + Math.sin(a) * L;
    // the line from the tip out to the water
    ctx.strokeStyle = "rgba(250,242,205,0.55)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(lerp(tx, w - 8, 0.6), lerp(ty, py + 14, 0.8), w - 8, py + 14); ctx.stroke();
    // the grip behind the pivot
    const ga = a + Math.PI, gl = L * 0.26;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#8a6a44"; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(ga) * gl, py + Math.sin(ga) * gl); ctx.stroke();
    ctx.strokeStyle = "rgba(255,230,190,0.35)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px + Math.cos(ga) * 4, py + Math.sin(ga) * 4 - 2); ctx.lineTo(px + Math.cos(ga) * gl, py + Math.sin(ga) * gl - 2); ctx.stroke();
    // the blank, bending a little under its own weight
    const bend = 0.06 * L * Math.cos(a), mx = lerp(px, tx, 0.55) + Math.sin(a) * -bend, my = lerp(py, ty, 0.55) + Math.cos(a) * bend;
    for (const [lw, col] of [[5, "#0b1417"], [3.4, "#2d3a3f"], [1.2, "rgba(200,220,224,0.6)"]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
    }
    // the reel hanging under the pivot
    ctx.fillStyle = "#1f292d"; ctx.strokeStyle = "rgba(246,239,217,0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px + Math.cos(a - Math.PI / 2) * -9, py + Math.sin(a - Math.PI / 2) * -9, 7, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rgba(RED, 1); ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill();
    // the tip, and the flash when you strike
    ctx.fillStyle = rgba(BRASS, 1); ctx.beginPath(); ctx.arc(tx, ty, 3.2, 0, TAU); ctx.fill();
    if (this.yankA > 0) {
      const r = 10 + 30 * (1 - this.yankA);
      ctx.strokeStyle = rgba(BRASS, this.yankA); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tx, ty, r, 0, TAU); ctx.stroke();
      ctx.font = font(15); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = rgba("255,244,214", this.yankA);
      ctx.fillText("HOOK!", clamp(tx, 30, w - 30), clamp(ty + 26, 30, h - 40));
    }
    // how to drag it: a quiet up and down arrow on the free side
    if (!this.drag) {
      const x = w - 12, y0 = Math.max(34, py - L * 0.9), y1 = py - 10;
      ctx.strokeStyle = rgba(INK, 0.28); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1);
      ctx.moveTo(x - 5, y0 + 6); ctx.lineTo(x, y0); ctx.lineTo(x + 5, y0 + 6);
      ctx.moveTo(x - 5, y1 - 6); ctx.lineTo(x, y1); ctx.lineTo(x + 5, y1 - 6); ctx.stroke();
    }
    // steer: a bar along the bottom
    const sx0 = 18, sx1 = w - 18, scx = (sx0 + sx1) / 2, st = this._steer;
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); rrect(ctx, sx0, steerY - 3, sx1 - sx0, 6, 3); ctx.fill();
    ctx.fillStyle = rgba(INK, 0.35); ctx.fillRect(scx - 1, steerY - 6, 2, 12);
    ctx.fillStyle = rgba(INK, 0.4); ctx.font = font(11); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("‹", sx0 - 8, steerY); ctx.fillText("›", sx1 + 8, steerY);
    if (Math.abs(st) > 0.01) {
      ctx.fillStyle = rgba(BRASS, 0.55); ctx.fillRect(Math.min(scx, scx + st * (sx1 - scx)), steerY - 3, Math.abs(st) * (sx1 - scx), 6);
    }
    const dx = scx + st * (sx1 - scx - 6);
    ctx.fillStyle = rgba(BRASS, 1); ctx.beginPath(); ctx.arc(dx, steerY, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(40,24,0,0.6)"; ctx.lineWidth = 1; ctx.stroke();
    if (this.drag) this.thumbGlow(ctx, this.drag.x, this.drag.y, 36, 0.8);
  }
}

/* ---------------- the gauge ---------------- */
export class Gauge extends Widget {
  constructor(container) {
    super(container, "gauge");
    this.s = { tfrac: 0, dragFrac: 0.4, slip: 0, lineOut: 0, depth: 0, stamina: null, name: "" };
    this.v = { t: 0, peak: 0, peakHold: 0, fish: 0, st: 0, slip: 0 };
    this.resize();
  }
  set(o) {
    if (!o) return;
    for (const k in o) if (o[k] !== undefined && k in this.s) this.s[k] = o[k];
  }
  draw(dt = 0.016) {
    if (!this.fit()) return;
    dt = clamp(dt || 0, 0, 0.1);
    this.time += dt;
    const s = this.s, v = this.v, w = this.w, h = this.h;
    const tf = clamp(+s.tfrac || 0, 0, 1.2), drag = clamp(+s.dragFrac || 0, 0, 1);
    v.t = lerp(v.t, tf, 1 - Math.exp(-dt * 16));
    // a peak marker that lingers, so a spike you missed still shows
    if (tf >= v.peak) { v.peak = tf; v.peakHold = 0.9; } else { v.peakHold -= dt; if (v.peakHold <= 0) v.peak = Math.max(tf, v.peak - dt * 0.5); }
    const fishOn = s.stamina != null || !!s.name;
    v.fish = lerp(v.fish, fishOn ? 1 : 0, 1 - Math.exp(-dt * 8));
    if (s.stamina != null) v.st = lerp(v.st, clamp(+s.stamina, 0, 1), 1 - Math.exp(-dt * 6));
    v.slip = lerp(v.slip, (+s.slip || 0) > 0.05 ? 1 : 0, 1 - Math.exp(-dt * 10));
    const danger = v.t > 0.85 ? 0.5 + 0.5 * Math.sin(this.time * 34) : 0;
    const tired = s.stamina != null && v.st < 0.3;
    const key = [w, h, this.dpr, v.t.toFixed(3), v.peak.toFixed(3), v.fish.toFixed(2), v.st.toFixed(3), drag.toFixed(3), s.name, (+s.lineOut || 0).toFixed(1), (+s.depth || 0).toFixed(1),
      v.slip > 0.02 || danger || tired ? this.time.toFixed(3) : 0].join();
    if (this.same(key)) return;
    const back = this.layer("back");
    this.paint(back, [w, h, this.dpr].join(), (c) => this.glass(c, 0.5, 0.5, w - 1, h - 1, 14));
    const ctx = this.begin();
    this.blit(back);
    if (danger) {
      ctx.beginPath(); rrect(ctx, 0.5, 0.5, w - 1, h - 1, 14);
      ctx.strokeStyle = rgba(DANGER, (0.3 + 0.6 * danger) * clamp((v.t - 0.85) / 0.1, 0, 1)); ctx.lineWidth = 1.5; ctx.stroke();
    }
    const strip = 32 * v.fish, top = h - strip;
    // the tension arc: 240° from the lower left, over the top, to the lower right
    const R = Math.max(18, Math.min(top * 0.4, w * 0.2)), lw = Math.max(5, R * 0.22);
    const cx = 12 + R + lw / 2, cy = Math.max(R + lw / 2 + 6, top / 2 + R * 0.25);
    const A0 = 150 * DEG, SW = 240 * DEG, at = (f) => A0 + SW * clamp(f, 0, 1);
    ctx.lineCap = "butt";
    ctx.strokeStyle = "rgba(0,0,0,0.38)"; ctx.lineWidth = lw + 4;
    ctx.beginPath(); ctx.arc(cx, cy, R, A0, A0 + SW); ctx.stroke();
    // faint zones: fine up to the drag, amber past it, red near the break
    const zone = (f0, f1, col) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, R, at(f0), at(f1)); ctx.stroke(); };
    zone(0, drag, rgba(GREEN, 0.16)); zone(drag, 0.85, rgba(AMBER, 0.16)); zone(0.85, 1, rgba(DANGER, 0.3));
    // the fill, coloured by how close it is to the break
    if (v.t > 0.004) {
      let st;
      if (ctx.createConicGradient) {
        st = ctx.createConicGradient(A0, cx, cy);
        const k = SW / TAU;
        st.addColorStop(0, rgba(GREEN, 1)); st.addColorStop(k * Math.max(0.05, drag * 0.9), rgba(GREEN, 1));
        st.addColorStop(k * Math.min(0.8, Math.max(drag + 0.1, 0.6)), rgba(AMBER, 1)); st.addColorStop(k * 0.9, rgba(DANGER, 1)); st.addColorStop(1, rgba(DANGER, 1));
      } else st = v.t > 0.85 ? rgba(DANGER, 1) : v.t > drag ? rgba(AMBER, 1) : rgba(GREEN, 1);
      if (danger) {
        ctx.strokeStyle = rgba(DANGER, 0.25 * danger); ctx.lineWidth = lw + 10; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(cx, cy, R, at(Math.max(0, v.t - 0.25)), at(v.t)); ctx.stroke();
      }
      ctx.strokeStyle = st; ctx.lineWidth = lw; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, cy, R, A0, at(v.t)); ctx.stroke();
    }
    // the drag slips: a ratchet of dashes runs round the outside
    if (v.slip > 0.02) {
      ctx.strokeStyle = rgba(AMBER, 0.95 * v.slip); ctx.lineWidth = 3; ctx.setLineDash([3, 4]); ctx.lineDashOffset = -this.time * 60;
      ctx.beginPath(); ctx.arc(cx, cy, R + lw / 2 + 4, at(Math.max(0, drag - 0.14)), at(Math.min(1, drag + 0.14))); ctx.stroke(); ctx.setLineDash([]);
    }
    // marks: the drag setting (cream) and the break point (red)
    const tick = (f, col, len, lw2) => {
      const a = at(f), c = Math.cos(a), sn = Math.sin(a);
      ctx.strokeStyle = col; ctx.lineWidth = lw2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx + c * (R - lw / 2 - 2), cy + sn * (R - lw / 2 - 2)); ctx.lineTo(cx + c * (R + lw / 2 + len), cy + sn * (R + lw / 2 + len)); ctx.stroke();
    };
    if (v.peak > v.t + 0.03) tick(v.peak, rgba("255,244,214", 0.6), 0, 1.5);
    tick(drag, rgba(INK, 0.95), 4, 2.5);
    tick(1, rgba(DANGER, 1), 4, 3);
    // the centre: the tension as a share of what the line can take
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const pct = Math.round(clamp(v.t, 0, 1) * 100);
    ctx.font = font(Math.max(12, Math.round(R * 0.5)));
    ctx.fillStyle = v.t > 0.85 ? rgba(DANGER, 1) : "#f6efd9";
    ctx.fillText(pct + "%", cx, cy - R * 0.1, (R - lw) * 1.8);
    ctx.font = font(Math.max(7, Math.round(R * 0.21))); spaced(ctx, 0.08);
    const label = v.t > 0.85 ? "TOO TIGHT" : v.slip > 0.5 ? "SLIPPING" : "TENSION";
    ctx.fillStyle = v.t > 0.85 ? rgba(DANGER, 1) : v.slip > 0.5 ? rgba(AMBER, 1) : rgba(INK, 0.55);
    ctx.fillText(label, cx, cy + R * 0.3, (R - lw) * 1.9);
    spaced(ctx, 0);
    // the right column: the line out and the depth
    const x = cx + R + lw / 2 + 12, colW = w - x - 10;
    if (colW > 30) {
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const lo = (+s.lineOut || 0).toFixed(1);
      // as big as the column allows: "123.4 m" must fit as well as "8.2 m"
      let big = Math.max(13, Math.min(24, Math.round(top * 0.22)));
      for (; big > 13; big--) {
        ctx.font = font(big); const a = ctx.measureText(lo).width;
        ctx.font = font(Math.round(big * 0.55), 800);
        if (a + ctx.measureText(" m").width <= colW) break;
      }
      const y0 = top / 2 - big * 1.45 + 2;
      ctx.font = font(9); spaced(ctx, 0.14); ctx.fillStyle = rgba(INK, 0.55);
      ctx.fillText("LINE OUT", x, y0, colW);
      spaced(ctx, 0);
      ctx.font = font(big); ctx.fillStyle = "#f6efd9";
      ctx.fillText(lo, x, y0 + big * 0.95);
      const lw3 = ctx.measureText(lo).width;
      ctx.font = font(Math.round(big * 0.55), 800); ctx.fillStyle = rgba(INK, 0.7);
      ctx.fillText(" m", x + lw3, y0 + big * 1.05);
      ctx.font = font(9); spaced(ctx, 0.14); ctx.fillStyle = rgba(INK, 0.55);
      ctx.fillText("DEPTH", x, y0 + big * 2.05, colW);
      spaced(ctx, 0);
      ctx.font = font(Math.round(big * 0.7)); ctx.fillStyle = "#cfe3e0";
      ctx.fillText((+s.depth || 0).toFixed(1) + " m", x, y0 + big * 2.8);
    }
    // the fish: its name, and a bar of how much fight it has left
    if (v.fish > 0.02) {
      ctx.save(); ctx.globalAlpha = v.fish;
      const bx = 12, bw = w - 24, ny = h - 23, by = h - 11;
      ctx.font = font(12); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = rgba(BRASS, 1);
      ctx.fillText(String(s.name || "Fish on!"), bx, ny, tired ? bw - 50 : bw);
      if (tired) {
        ctx.font = font(9); spaced(ctx, 0.12); ctx.textAlign = "right"; ctx.fillStyle = rgba(GREEN, 0.6 + 0.4 * Math.sin(this.time * 6));
        ctx.fillText("TIRED", bx + bw, ny); spaced(ctx, 0);
      }
      ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.beginPath(); rrect(ctx, bx, by - 3, bw, 6, 3); ctx.fill();
      if (s.stamina != null) {
        const fw = Math.max(0, bw * v.st);
        if (fw > 1) {
          const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
          if (tired) { g.addColorStop(0, rgba(GREEN, 1)); g.addColorStop(1, rgba(GREEN, 0.8)); } else { g.addColorStop(0, rgba(AMBER, 1)); g.addColorStop(1, rgba(RED, 1)); }
          ctx.fillStyle = g; ctx.beginPath(); rrect(ctx, bx, by - 3, fw, 6, 3); ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}
