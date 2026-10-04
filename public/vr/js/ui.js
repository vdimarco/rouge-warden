// In Full Swing: the interface (spec §10). Text panels on canvas textures (subtitles, toasts, the wrist HUD, the pause
// menu, the map, the stance question, the credits), the laser pointer, the fade, the city map on your table, and on a
// flat screen a DOM HUD and Esc menu. All of it is drawn like the comic title page: paper caption boxes with thick ink
// borders and hard drop shadows, speech balloons for the Cottage, Bangers lettering. Panels follow you lazily and are never head-locked.
import * as THREE from "three";
import * as CONFIG from "./config.js";
import { PAL } from "./comic.js";

const { COMFORT, COLORS, GAME, LINES, LINES_HANDS, LINES_DESKTOP, SWING } = CONFIG;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const sideOf = (s) => (s === 1 || s === "right" ? 1 : 0);
const hex = (n) => "#" + n.toString(16).padStart(6, "0");

/* ---------------- look ---------------- */
// The colours and faces of the 2D page (index.html), so the headset panels and the flat-screen menu feel like one game.
const C = { ink: hex(PAL.ink), paper: "#fff9ea", cream: "#fff4d8", yellow: "#ffd84a", gold: "#ffb32a", orange: "#ff7a2a", red: "#e0482c", magenta: "#d8457a", violet: "#3b2380", sludge: "#9cff3a", blue: hex(COLORS.clean), coin: "#f2c14e", dots: "rgba(216,69,122,0.5)" };
const F_UI = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", system-ui, sans-serif';
const F_LOGO = '"Bangers", Impact, "Arial Black", system-ui, sans-serif'; // the comic lettering
const RO = { hud: 996, panel: 995, laser: 997, dim: 994, fade: 1001 }; // render orders: panels above the world, the fade over everything
const TILT = { sub: -0.9, toast: 1.1, modal: -0.7, hud: 2.2, tip: 1.4 }; // degrees a panel is turned, like the boxes of a page

/* ---------------- placement numbers ---------------- */
const SUB = { dist: 1.4, drop: 12 * DEG, width: 1.5, wpx: 1500, hpx: 260, dead: 20 * DEG, settle: 7 * DEG, rate: 2.2 }; // subtitles: 1.4 m ahead, 12° below eye level
const TOAST = { drop: 3 * DEG, width: 1.0, wpx: 1000, hpx: 200, secs: 2.4 }; // 200 px: two lines of 54 px lettering, the 8 px ink border and the shadow
const MENU = { dist: 1.1, drop: 0.05, dead: 38 * DEG, settle: 12 * DEG, rate: 2.5, slack: 0.45 };
const HUDP = { w: 0.2, wpx: 512, hpx: 344, upPad: 0.11, upHand: 0.1, show: 0.55, hide: 0.3, poke: 0.014, arm: 0.03, hover: 0.05 };
const PIN_SNAP = 0.03; // the laser snaps to a map pin within 3 cm
const STANCE_SECS = 6;
const SHADOW = 12; // the hard drop shadow of a card, in canvas pixels

/* ---------------- canvas drawing ---------------- */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function font(px, weight = 700, face = F_UI) { return weight + " " + px + "px " + face; }
const spacing = (ctx, px) => { if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px"; };
// Splits text into lines no wider than maxW.
function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const t = line ? line + " " + word : word;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}
// Ben-Day dots over a rectangle: a screen of dots that thin out toward the far corner, like the caption boxes on the title page.
function dotsIn(ctx, x, y, w, h, corner = "tr", col = C.dots, pitch = 15) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = col;
  const cx = corner[1] === "r" ? x + w : x, cy = corner[0] === "b" ? y + h : y, reach = Math.min(Math.max(w, h), 260);
  for (let gy = 0; gy * pitch < reach; gy++) for (let gx = 0; gx * pitch < reach; gx++) {
    const px = cx + (corner[1] === "r" ? -1 : 1) * (gx * pitch + (gy % 2) * pitch / 2), py = cy + (corner[0] === "b" ? -1 : 1) * gy * pitch * 0.87;
    const t = 1 - Math.hypot(gx * pitch, gy * pitch) / reach;
    if (t <= 0.05) continue;
    ctx.beginPath(); ctx.arc(px, py, 1.2 + t * 4.2, 0, 7); ctx.fill();
  }
  ctx.restore();
}
// A comic caption box: an ink shadow, paper, dots in one corner and a thick ink border. (x, y, w, h) is the box itself.
function box(ctx, x, y, w, h, o = {}) {
  const sh = o.shadow == null ? SHADOW : o.shadow;
  if (sh) { ctx.fillStyle = C.ink; ctx.fillRect(x + sh, y + sh, w, h); }
  ctx.fillStyle = o.fill || C.paper; ctx.fillRect(x, y, w, h);
  if (o.dots !== false) dotsIn(ctx, x, y, w, h, o.corner || "tr", o.dotCol || C.dots);
  ctx.lineWidth = o.border || 10; ctx.strokeStyle = C.ink; ctx.lineJoin = "miter"; ctx.strokeRect(x, y, w, h);
}
// The card under every page and the HUD: a caption box with room left for its shadow.
function card(ctx, w, h, o = {}) {
  const m = 6, sh = o.shadow == null ? SHADOW : o.shadow;
  box(ctx, m, m, w - m * 2 - sh, h - m * 2 - sh, { border: o.border || 10, shadow: sh, fill: o.fill });
}
// The page title: a yellow caption box, turned a little, in Bangers.
function heading(ctx, text, x, y, size = 56) {
  text = String(text).toUpperCase();
  ctx.font = font(size, 400, F_LOGO); spacing(ctx, 3); ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const bw = ctx.measureText(text).width + size * 0.8, bh = size * 1.16, bx = x - 8, by = y - bh / 2 - 2;
  ctx.save();
  ctx.translate(bx + bw / 2, y); ctx.rotate(-0.024); ctx.translate(-(bx + bw / 2), -y);
  ctx.fillStyle = C.ink; ctx.fillRect(bx + 8, by + 8, bw, bh);
  ctx.fillStyle = C.yellow; ctx.fillRect(bx, by, bw, bh);
  ctx.lineWidth = 7; ctx.strokeStyle = C.ink; ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = C.ink; ctx.fillText(text, bx + size * 0.4, y + size * 0.05);
  ctx.restore();
  spacing(ctx, 0);
}
// A speech balloon for the Cottage: a white rounded body with a thick ink border and a tail toward the lower left.
function balloon(ctx, x, y, w, h, tailX) {
  const r = Math.min(h / 2, 72);
  ctx.lineWidth = 9; ctx.strokeStyle = C.ink; ctx.lineJoin = "round"; ctx.fillStyle = "#fffdf5";
  rr(ctx, x, y, w, h, r); ctx.fill(); ctx.stroke();
  const ty = y + h;
  ctx.beginPath(); ctx.moveTo(tailX - 34, ty - 5); ctx.lineTo(tailX - 84, ty + 52); ctx.lineTo(tailX + 22, ty - 5); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // wipe the border where the tail joins the body
  ctx.fillStyle = "#fffdf5"; ctx.fillRect(tailX - 30, ty - 13, 48, 15);
}
// The icons the HUD shares with the pause and map pages: flat colour with an ink outline.
function iconCoin(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = C.coin; ctx.fill();
  ctx.lineWidth = r * 0.2; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, 7); ctx.lineWidth = r * 0.09; ctx.stroke();
  ctx.fillStyle = C.ink; ctx.font = font(r * 1.05, 400, F_LOGO); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("L", x, y + r * 0.08);
  ctx.beginPath(); ctx.arc(x - r * 0.5, y - r * 0.5, r * 0.13, 0, 7); ctx.fillStyle = "#fff4d8"; ctx.fill();
}
function iconDrop(ctx, x, y, r, col = C.sludge) {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.25);
  ctx.bezierCurveTo(x + r * 0.2, y - r * 0.6, x + r, y - r * 0.2, x + r, y + r * 0.3);
  ctx.arc(x, y + r * 0.3, r, 0, Math.PI);
  ctx.bezierCurveTo(x - r, y - r * 0.2, x - r * 0.2, y - r * 0.6, x, y - r * 1.25);
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = r * 0.22; ctx.lineJoin = "round"; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.beginPath(); ctx.arc(x - r * 0.35, y + r * 0.1, r * 0.2, 0, 7); ctx.fillStyle = "#fff9ea"; ctx.fill();
}
function iconHeart(ctx, x, y, r, on) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.1, x - r * 0.9, y - r * 1.3, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.9, y - r * 1.3, x + r * 1.6, y - r * 0.1, x, y + r * 0.9);
  ctx.closePath();
  ctx.fillStyle = on ? "#ff3a4a" : "#d9cfb8"; ctx.fill();
  ctx.lineWidth = r * 0.24; ctx.lineJoin = "round"; ctx.strokeStyle = C.ink; ctx.stroke();
  if (on) { ctx.beginPath(); ctx.arc(x - r * 0.55, y - r * 0.3, r * 0.17, 0, 7); ctx.fillStyle = "#fff4d8"; ctx.fill(); }
}
function iconTick(ctx, x, y, r, col = C.blue) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = r * 0.16; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.05); ctx.lineTo(x - r * 0.12, y + r * 0.42); ctx.lineTo(x + r * 0.55, y - r * 0.38);
  ctx.lineWidth = r * 0.28; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = C.ink; ctx.stroke();
}
function iconMenu(ctx, x, y, r) {
  ctx.lineCap = "round"; ctx.strokeStyle = C.ink; ctx.lineWidth = r * 0.2;
  for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(x - r * 0.42, y + k * r * 0.34); ctx.lineTo(x + r * 0.42, y + k * r * 0.34); ctx.stroke(); }
}
function iconArrow(ctx, x, y, r, dir) {
  ctx.beginPath(); ctx.moveTo(x + dir * r * 0.5, y - r * 0.6); ctx.lineTo(x - dir * r * 0.5, y); ctx.lineTo(x + dir * r * 0.5, y + r * 0.6);
  ctx.lineWidth = r * 0.3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = C.ink; ctx.stroke();
}

/* ---------------- pages: the pause menu, the comfort options, the confirm, the stance question, the credits ---------------- */
// A page is plain data. The headset panel and the flat-screen dialog both draw from it, so they always agree.
// rows: { cols: [{ id, label, kind }] }  a row of buttons
//       { seg: { id, label, opts: [[value, label]], value } }  a labelled group where one option is picked
//       { text, small }  a paragraph
const btn = (id, label, kind = "normal") => ({ id, label, kind });
const row = (...cols) => ({ cols });
const seg = (id, label, opts, value) => ({ seg: { id, label, opts, value } });
const para = (text, small = false) => ({ text, small });

// The vignette, turn, snap and aim keys of a preset, so the option rows show the truth after a preset change.
const TURN_VALUE = (s) => (s.turn === "smooth" ? "smooth" : String([30, 45, 90].includes(s.snap) ? s.snap : 45));

export function createUI({ scene, camera, rig, renderer, city, view, save, settings, comfort, audio, xr, hands, saveNow, haptic, setWorldVisible }) {
  const fns = { travel: [], skip: [], exit: [], restart: [], frame: [] };
  const emit = (list, a) => { for (let i = 0; i < list.length; i++) { try { list[i](a); } catch (e) { console.error(e); } } };
  const G = () => window.G || {};
  const isAR = () => !!(xr && xr.session && xr.mode === "ar");
  const isIntro = () => { const g = G(); return g.state === "intro" || (g.state === "paused" && g.pausedFrom === "intro"); };

  /* ---------------- state ---------------- */
  let inp = null, Pl = null, prog = null, frameN = 0;
  let modal = null; // "pause" | "comfort" | "confirm" | "map" | "stance" | "credits" | null
  let paused = false;
  let skipFn = null; // the portal sets it while the opening may be skipped
  const blocked = [false, false];
  const HD = { pos: new THREE.Vector3(), yaw: 0 };
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), V5 = new THREE.Vector3();
  const M1 = new THREE.Matrix4();
  const NOPROG = { clogs: 0, clogsTotal: 12, loonies: 0, looniesTotal: 80, bank: 0, king: "sleeping", hearts: GAME.king.hearts, trial: null, tutorial: -1 };
  const hudSide = () => (settings.hand === "left" ? 1 : 0); // the HUD wrist: left, or right for a left-handed player
  const isDesktopNow = () => !!(inp && inp.mode === "desktop") || (!inp && G().mode === "desktop");
  const dom = { built: false };

  /* ---------------- text panels on canvas textures ---------------- */
  // About 1 px per mm at 1 m (spec §10). A panel is a plane with a CanvasTexture; its widgets are rectangles in canvas
  // pixels, so a ray that hits the plane gives the pixel and the pixel gives the widget.
  const measure = document.createElement("canvas").getContext("2d");
  const panelList = [];
  function makePanel(name, wpx, hpx, width, order = RO.panel) {
    const canvas = document.createElement("canvas");
    canvas.width = wpx; canvas.height = hpx;
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, (width * hpx) / wpx), mat);
    mesh.name = "ui:" + name;
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    const p = { name, canvas, ctx: canvas.getContext("2d"), tex, mat, mesh, wpx, hpx, w: width, h: (width * hpx) / wpx, rects: [], hover: null, down: null, paint: null, dirty: true, uploaded: false };
    panelList.push(p);
    return p;
  }
  function disposePanel(p) {
    if (!p) return;
    const i = panelList.indexOf(p);
    if (i >= 0) panelList.splice(i, 1);
    p.mesh.removeFromParent(); p.mesh.geometry.dispose(); p.mat.dispose(); p.tex.dispose();
  }
  // Draws the panel again when something changed. The texture goes up once at creation (initTexture), then on change.
  function repaint(p) {
    p.ctx.clearRect(0, 0, p.wpx, p.hpx);
    p.paint(p);
    p.tex.needsUpdate = true;
    if (!p.uploaded) { renderer.initTexture(p.tex); p.uploaded = true; }
    p.dirty = false;
  }
  // The fonts load from /vr/fonts before any panel is drawn with them; when they arrive every panel draws again. Bangers is the
  // comic lettering: it comes through the FontFace API from its own file, so a headset page needs no other site.
  const redrawAll = () => { for (const p of panelList) p.dirty = true; };
  try {
    if (document.fonts && typeof FontFace !== "undefined") {
      const bangers = new FontFace("Bangers", "url(" + new URL("../fonts/bangers-400.woff2", import.meta.url).href + ")", { weight: "400" });
      bangers.load().then((f) => { document.fonts.add(f); redrawAll(); }).catch(() => {});
      Promise.all([document.fonts.load(font(40, 700)), document.fonts.load(font(40, 800))]).then(redrawAll).catch(() => {});
    }
  } catch (e) { /* no font loading here: the fallback faces draw the panels */ }

  // A ray against a panel: the pixel it hits, or false. o and d are world space, d has unit length.
  const HIT = { px: 0, py: 0, t: 0 };
  function hitPanel(p, o, d) {
    p.mesh.updateMatrixWorld();
    M1.copy(p.mesh.matrixWorld).invert();
    V3.copy(o).applyMatrix4(M1);
    V4.copy(d).transformDirection(M1);
    if (Math.abs(V4.z) < 1e-6) return false;
    const t = -V3.z / V4.z;
    if (t < 0) return false;
    const x = V3.x + V4.x * t, y = V3.y + V4.y * t;
    if (Math.abs(x) > p.w / 2 || Math.abs(y) > p.h / 2) return false;
    HIT.px = (x / p.w + 0.5) * p.wpx; HIT.py = (0.5 - y / p.h) * p.hpx; HIT.t = t;
    return true;
  }
  const rectAt = (p, px, py, slop = 6) => { for (const r of p.rects) if (px >= r.x - slop && px <= r.x + r.w + slop && py >= r.y - slop && py <= r.y + r.h + slop) return r; return null; };
  // The world position of a widget's centre, for the tests.
  function rectWorld(p, r, out) {
    p.mesh.updateMatrixWorld();
    return out.set(((r.x + r.w / 2) / p.wpx - 0.5) * p.w, (0.5 - (r.y + r.h / 2) / p.hpx) * p.h, 0).applyMatrix4(p.mesh.matrixWorld);
  }
  const round4 = (v) => ({ x: +v.x.toFixed(4), y: +v.y.toFixed(4), z: +v.z.toFixed(4) });
  const toTracking = (w) => { rig.updateMatrixWorld(); return round4(rig.worldToLocal(V5.copy(w))); };

  /* ---------------- the fade (an inward sphere, r 0.9) ---------------- */
  // "black" and "fog" colour the view; "room" scales what is drawn by 1 − alpha, so the passthrough shows (the same
  // reality blend as comfort.js). In mixed reality every fade goes to your room, never to black.
  const fadeMats = {};
  for (const [k, c] of [["black", 0x0b0710], ["fog", COLORS.fog], ["room", 0x000000]]) {
    const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    if (k === "room") { m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.ZeroFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = null; m.blendDstAlpha = null; m.blendEquationAlpha = null; }
    fadeMats[k] = m;
  }
  const fadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), fadeMats.black);
  fadeMesh.name = "ui:fade";
  fadeMesh.renderOrder = RO.fade;
  fadeMesh.frustumCulled = false;
  fadeMesh.visible = false;
  camera.add(fadeMesh);
  const fade = { v: 0, to: 0, rate: 0, look: "black", resolve: null };
  function fadeApply() {
    const k = isAR() ? "room" : fade.look === "room" ? "black" : fade.look;
    if (fadeMesh.material !== fadeMats[k]) fadeMesh.material = fadeMats[k];
    fadeMats[k].opacity = fade.v;
    fadeMesh.visible = fade.v > 0.002;
  }
  function fadeStep(dt) {
    if (fade.v === fade.to) return;
    const d = fade.to - fade.v, s = fade.rate * dt;
    if (Math.abs(d) <= s) { fade.v = fade.to; if (fade.resolve) { const r = fade.resolve; fade.resolve = null; r(); } } else fade.v += Math.sign(d) * s;
    fadeApply();
  }
  // A dim layer behind the pause panel in VR, so the city stays in view but the menu reads well.
  const dimMat = new THREE.MeshBasicMaterial({ color: 0x0b0710, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  const dimMesh = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), dimMat);
  dimMesh.name = "ui:dim"; dimMesh.renderOrder = RO.dim; dimMesh.frustumCulled = false; dimMesh.visible = false;
  camera.add(dimMesh);
  let dim = 0;

  /* ---------------- lazy follow: subtitles and toasts ---------------- */
  // The yaw of the text lags behind your head and only catches up when you look well away; its distance and height
  // follow you exactly, so it never swims when you swing. It is never fixed to the head.
  const follow = { yaw: 0, init: false, rig: null };
  // A turn of the rig (a snap turn, the portal placing the rig) turns the text with the view, so it never jumps to the side.
  function followRig() {
    const ry = G().rigYaw;
    if (typeof ry !== "number") return;
    if (follow.rig != null) {
      const d = wrap(ry - follow.rig);
      if (d !== 0) { follow.yaw += d; if (cur) placed = false; }
    }
    follow.rig = ry;
  }
  function followYaw(f, dt, dead, settle, rate) {
    if (!f.init) { f.yaw = HD.yaw; f.init = true; return; }
    const d = wrap(HD.yaw - f.yaw);
    if (Math.abs(d) > dead) f.yaw += (d - Math.sign(d) * settle) * (1 - Math.exp(-dt * rate));
  }
  // The point dist metres ahead of the head along yaw, drop radians below eye level, into out.
  function ahead(out, yaw, dist, drop) {
    const c = Math.cos(drop);
    return out.set(HD.pos.x - Math.sin(yaw) * dist * c, HD.pos.y - Math.sin(drop) * dist, HD.pos.z - Math.cos(yaw) * dist * c);
  }
  // the panel stands at pos, turned to your head and then a degree or two off level, like the boxes of a page
  const face = (mesh, pos, tilt = 0) => { mesh.position.copy(pos); mesh.lookAt(HD.pos); if (tilt) mesh.rotateZ(tilt * DEG); };

  const sub = { text: "", t: 0, a: 0, p: null };
  const toasts = [];
  const toast = { text: "", t: 0, a: 0, p: null };
  // The subtitle is a speech balloon (the Cottage is talking) and the toast a yellow caption box, both lettered in Bangers.
  function textPanel(p, text, size, maxW, kind) {
    p.text = text; p.dirty = true;
    p.paint = (q) => {
      const c = q.ctx, up = String(p.text).toUpperCase();
      c.font = font(size, 400, F_LOGO); spacing(c, 2); c.textAlign = "center"; c.textBaseline = "middle";
      const lines = wrapText(c, up, maxW), lh = size * 1.12;
      const tw = Math.min(maxW, Math.max(...lines.map((l) => c.measureText(l).width)));
      const padX = size * 0.75, padY = size * 0.42, bw = tw + padX * 2, bh = lines.length * lh + padY * 2;
      if (kind === "balloon") {
        const x = (q.wpx - bw) / 2, y = Math.max(14, (q.hpx - 66 - bh) / 2);
        balloon(c, x, y, bw, bh, x + Math.min(bw * 0.28, 330));
        c.fillStyle = C.ink; lines.forEach((l, i) => c.fillText(l, q.wpx / 2, y + padY + lh * (i + 0.5) + size * 0.04));
      } else {
        const x = (q.wpx - bw - SHADOW) / 2, y = (q.hpx - bh - SHADOW) / 2;
        box(c, x, y, bw, bh, { fill: C.yellow, border: 8, shadow: 10, dotCol: "rgba(255,122,42,0.55)" });
        c.fillStyle = C.ink; lines.forEach((l, i) => c.fillText(l, x + bw / 2, y + padY + lh * (i + 0.5) + size * 0.04));
      }
      spacing(c, 0);
    };
  }
  function say(text, secs = 4) {
    text = String(text || "");
    if (!text) { sub.t = 0; return; }
    if (sub.text === text && sub.t > 0) { sub.t = Math.max(sub.t, secs); return; }
    sub.text = text; sub.t = secs;
    if (isDesktopNow()) domSay(text);
  }
  function sayLine(group, i, kind) {
    const k = kind || (inp && inp.kind) || "controller";
    // a phone gets its own lines when config.js has them; a gamepad and the mouse read the desktop lines
    const table = k === "hand" ? LINES_HANDS : k === "touch" ? (CONFIG.LINES_TOUCH || LINES_DESKTOP) : k === "mouse" || k === "desktop" || k === "pad" ? LINES_DESKTOP : LINES;
    const line = table[group] && table[group][i];
    if (line) say(line, 6);
    return line || null;
  }
  function nextToast() { if (!toasts.length) return; toast.text = toasts.shift(); toast.t = TOAST.secs; if (isDesktopNow()) domToast(toast.text); }
  function toastSay(text) {
    text = String(text || "");
    if (!text) return;
    if (toast.text === text && toast.t > 0) { toast.t = TOAST.secs; return; }
    if (toasts.length < 4 && !toasts.includes(text)) toasts.push(text);
    if (toast.t <= 0) nextToast();
  }
  function textStep(dt) {
    if (sub.t > 0) sub.t -= dt;
    const want = sub.t > 0 ? 1 : 0;
    sub.a += Math.sign(want - sub.a) * Math.min(Math.abs(want - sub.a), dt / (want ? 0.2 : 0.45));
    if (toast.t > 0) { toast.t -= dt; if (toast.t <= 0) { toast.text = ""; nextToast(); } }
    const wantT = toast.t > 0 ? 1 : 0;
    toast.a += Math.sign(wantT - toast.a) * Math.min(Math.abs(wantT - toast.a), dt / (wantT ? 0.15 : 0.3));
  }
  function textPlace(dt) {
    followYaw(follow, dt, SUB.dead, SUB.settle, SUB.rate);
    if (sub.a > 0.001) {
      if (!sub.p) sub.p = makePanel("subtitle", SUB.wpx, SUB.hpx, SUB.width);
      const p = sub.p;
      if (p.text !== sub.text) textPanel(p, sub.text, 64, SUB.wpx - 240, "balloon");
      if (p.dirty) repaint(p);
      ahead(V1, follow.yaw, SUB.dist, SUB.drop); face(p.mesh, V1, TILT.sub);
      p.mat.opacity = sub.a; p.mesh.visible = true;
    } else if (sub.p) sub.p.mesh.visible = false;
    if (toast.a > 0.001 && toast.text) {
      if (!toast.p) toast.p = makePanel("toast", TOAST.wpx, TOAST.hpx, TOAST.width);
      const p = toast.p;
      if (p.text !== toast.text) textPanel(p, toast.text, 54, TOAST.wpx - 170, "caption");
      if (p.dirty) repaint(p);
      ahead(V1, follow.yaw, SUB.dist * 0.92, TOAST.drop); face(p.mesh, V1, TILT.toast);
      p.mat.opacity = toast.a; p.mesh.visible = true;
    } else if (toast.p) toast.p.mesh.visible = false;
  }

  /* ---------------- the pages ---------------- */
  const stance = { on: false, resolve: null, t: 0, pre: "standing", age: 0 };
  const skipLabel = () => (isIntro() ? "Skip the opening" : "Skip the tutorial");
  const canSkip = () => !!skipFn || (!!prog && prog.tutorial >= 0 && !isIntro());
  function pageDef(name) {
    const ar = isAR(), desk = isDesktopNow(), intro = isIntro();
    if (name === "pause") {
      const rows = [row(btn("resume", "Resume", "primary"))];
      rows.push(intro ? row(btn("comfort", "Comfort")) : row(btn("map", "Map"), btn("comfort", "Comfort")));
      rows.push(row(btn("sound", "Sound: " + (audio.isOn ? "on" : "off")), btn("music", "Music: " + (audio.musicOn ? "on" : "off"))));
      const extra = [];
      if (ar) extra.push(btn("scan", "Scan your room"));
      if (canSkip()) extra.push(btn("skip", skipLabel()));
      if (extra.length) rows.push(row(...extra));
      rows.push(row(btn("reset", "Reset progress", "danger"), btn("exit", "Exit", "danger")));
      return { name, title: "Paused", w: 900, rows };
    }
    if (name === "comfort") {
      const rows = [seg("preset", desk ? "Headset preset" : "Preset", [["comfortable", "Comfortable"], ["moderate", "Moderate"], ["intense", "Intense"]], settings.preset)];
      if (!desk) {
        rows.push(seg("vignette", "Vignette", [["off", "Off"], ["low", "Low"], ["med", "Medium"], ["high", "High"]], settings.vignette));
        if (ar) rows.push(seg("look", "Vignette look", [["room", "Room"], ["black", "Black"]], settings.vignetteLook));
        rows.push(seg("turn", "Turning", [["30", "Snap 30"], ["45", "Snap 45"], ["90", "Snap 90"], ["smooth", "Smooth"]], TURN_VALUE(settings)));
      }
      rows.push(seg("aim", "Aim assist", [["low", "Low"], ["med", "Medium"], ["high", "High"]], settings.aim));
      if (!desk) {
        rows.push(seg("hand", "Dominant hand", [["left", "Left"], ["right", "Right"]], settings.hand));
        rows.push(seg("hold", "Rope trigger", [["hold", "Hold"], ["toggle", "Toggle"]], settings.hold));
        rows.push(seg("hz", "Frame rate", [["72", "72 Hz"], ["90", "90 Hz"]], String(settings.hz === 90 ? 90 : 72)));
        rows.push(seg("seated", "Play seated", [["off", "Off"], ["on", "On"]], settings.seated ? "on" : "off"));
        rows.push(row(btn("calibrate", "Calibrate height"), btn("back", "Back")));
      } else rows.push(row(btn("back", "Back")));
      return { name, title: "Comfort", w: desk ? 900 : 1200, rows };
    }
    if (name === "confirm") {
      return { name, title: "Reset progress?", w: 900, rows: [para("This deletes your Loonies, flushes and best times. Your settings stay."), row(btn("resetNo", "Cancel"), btn("resetYes", "Reset progress", "danger"))] };
    }
    if (name === "stance") {
      const pre = stance.pre;
      return { name, title: "How do you play?", sub: "Pick one. The game sets your height.", w: 1000, rows: [row(btn("stance:standing", "Standing", pre === "standing" ? "primary" : "normal"), btn("stance:seated", "Seated", pre === "seated" ? "primary" : "normal")), para("Starting by itself in " + Math.max(1, Math.ceil(stance.t)) + " s.", true)] };
    }
    if (name === "credits") {
      return {
        name, title: "In Full Swing", sub: "The Porcelain King is flushed.", w: 1200,
        rows: [
          para("The crew: eight Claude agents, one job each. The city and the physics. The loop and WebXR. The city view. The ropes and hands. The game. The sound. The menus and the opening. The Quest pack."),
          para("How it was made: plain JavaScript and three.js, with no build step. The city, the ropes, the sound and the music are all made in code. The King is a friend from Wild, another Cottage Arcade game."),
          para("Thanks for playing. Your Loonies are saved.", true),
          row(btn("credits:keep", "Keep swinging", "primary"), btn("credits:arcade", "Back to the arcade")),
        ],
      };
    }
    if (name === "map") {
      return { name, title: "City map", w: 900, rows: [para("Point at a pin and pull the trigger to travel there. A green drop is a clog. A blue tick is a clean roof.", true), row(btn("back", "Back"))] };
    }
    return null;
  }

  // Layout numbers of a headset panel.
  const LAY = { pad: 52, title: 116, row: 96, gap: 18, label: 340, text: 40, small: 32 };
  function pageHeight(def) {
    let h = LAY.pad + LAY.title + (def.sub ? 46 : 0);
    for (const r of def.rows) {
      if (r.text != null) { measure.font = font(r.small ? LAY.small : LAY.text, 500); h += wrapText(measure, r.text, def.w - LAY.pad * 2).length * (r.small ? 42 : 52) + 8; } else h += LAY.row;
      h += LAY.gap;
    }
    return Math.ceil(h - LAY.gap + LAY.pad);
  }
  // Draws one page and records its widgets: paper, the title box, ink text, comic buttons.
  function paintPage(p, def) {
    const c = p.ctx, w = p.wpx, h = p.hpx;
    p.rects.length = 0;
    card(c, w, h);
    heading(c, def.title, LAY.pad, LAY.pad + 34, 58);
    let y = LAY.pad + LAY.title;
    // the line under the title sits in the 46 px that pageHeight keeps for it, clear of the title box and its shadow
    if (def.sub) { c.font = font(36, 700); c.fillStyle = C.ink; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(def.sub, LAY.pad, y + 14); y += 46; }
    const inner = w - LAY.pad * 2 - SHADOW;
    for (const r of def.rows) {
      if (r.text != null) {
        c.font = font(r.small ? LAY.small : LAY.text, r.small ? 600 : 700); c.fillStyle = r.small ? "rgba(20,10,24,0.72)" : C.ink; c.textAlign = "left"; c.textBaseline = "middle";
        const lh = r.small ? 42 : 52;
        for (const line of wrapText(c, r.text, inner)) { c.fillText(line, LAY.pad, y + lh / 2); y += lh; }
        y += 8 + LAY.gap;
      } else if (r.cols) {
        const n = r.cols.length, bw = (inner - LAY.gap * (n - 1)) / n;
        r.cols.forEach((b, i) => paintButton(p, b, LAY.pad + i * (bw + LAY.gap), y, bw, LAY.row - 8));
        y += LAY.row + LAY.gap;
      } else if (r.seg) {
        const s = r.seg, n = s.opts.length, ox = LAY.pad + LAY.label, bw = (inner - LAY.label - LAY.gap * (n - 1)) / n;
        c.font = font(38, 800); spacing(c, 2); c.fillStyle = C.ink; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(s.label.toUpperCase(), LAY.pad, y + (LAY.row - 8) / 2, LAY.label - 20);
        spacing(c, 0);
        s.opts.forEach(([val, lab], i) => paintButton(p, { id: s.id + ":" + val, label: lab, kind: String(s.value) === val ? "on" : "normal" }, ox + i * (bw + LAY.gap), y, bw, LAY.row - 8));
        y += LAY.row + LAY.gap;
      }
    }
  }
  // One button, like the title page's: a paper box with a thick ink border and a hard shadow. Primary is yellow with orange dots,
  // "on" (a picked option) is orange, danger red, and normal cream. A hovered one lifts off the page; a pressed one sinks into it.
  function paintButton(p, b, x, y, w, h) {
    const c = p.ctx, hv = p.hover === b.id, dn = p.down === b.id;
    p.rects.push({ id: b.id, x, y, w, h, label: b.label });
    const dx = dn ? 5 : hv ? -2 : 0, sh = dn ? 2 : hv ? 10 : 7;
    let fill = C.cream, ink = C.ink, dot = null;
    if (b.kind === "primary") { fill = hv ? "#ffe883" : C.yellow; dot = "rgba(255,122,42,0.75)"; }
    else if (b.kind === "on") { fill = hv ? "#ffb04a" : "#ff9a2a"; dot = "rgba(255,244,216,0.55)"; }
    else if (b.kind === "danger") { fill = hv ? "#f0603c" : C.red; ink = C.ink; }
    else if (hv) fill = "#ffe883";
    box(c, x + dx, y + dx, w - 7, h - 7, { fill, shadow: sh, border: b.kind === "primary" || b.kind === "on" ? 9 : 7, dots: !!dot, dotCol: dot || C.dots });
    c.font = font(Math.min(48, h * 0.56), 400, F_LOGO); spacing(c, 3); c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = b.kind === "danger" ? "#fff9ea" : ink;
    c.fillText(String(b.label).toUpperCase(), x + dx + (w - 7) / 2, y + dx + (h - 7) / 2 + 3, w - 40);
    spacing(c, 0);
  }

  // The modal panel of a page. Its height follows the page, so a page with a row more is a taller panel.
  const pagePanels = {};
  let cur = null; // the panel on show
  let placed = false; // the modal has a spot in the world
  const anchor = { yaw: 0, pos: new THREE.Vector3() };
  function modalPanel(name) {
    const def = pageDef(name);
    if (!def) return null;
    const hpx = pageHeight(def);
    let p = pagePanels[name];
    if (!p || p.hpx !== hpx || p.wpx !== def.w) { disposePanel(p); p = pagePanels[name] = makePanel(name, def.w, hpx, def.w / 1000); }
    p.def = def;
    p.paint = (q) => paintPage(q, q.def);
    p.dirty = true;
    return p;
  }
  function hidePanels() { for (const k in pagePanels) pagePanels[k].mesh.visible = false; cur = null; placed = false; }
  function showPage(name) {
    if (!name) return;
    modal = name;
    if (isDesktopNow()) { domShow(name); return; }
    if (!inp && !(xr && xr.session)) return; // no session: nothing to show
    for (const k in pagePanels) if (k !== name) pagePanels[k].mesh.visible = false;
    const p = modalPanel(name);
    if (!p) return;
    if (cur !== p) { p.hover = null; p.down = null; }
    cur = p;
    if (!placed) placeModal(true, 0);
    p.mesh.visible = true;
    repaint(p);
  }
  // Puts the modal panel 1.1 m ahead of you. While it is open it follows lazily: only when you look well away or walk off.
  function placeModal(first, dt) {
    if (!cur) return;
    if (first) {
      anchor.yaw = HD.yaw;
      ahead(anchor.pos, anchor.yaw, MENU.dist, 0);
      anchor.pos.y = HD.pos.y - MENU.drop;
      placed = true;
    } else if (dt > 0) {
      const aiming = cur.hover != null || cur.down != null; // no chasing while you aim at it
      const d = wrap(HD.yaw - anchor.yaw);
      const dx = HD.pos.x - anchor.pos.x, dz = HD.pos.z - anchor.pos.z, far = Math.abs(Math.sqrt(dx * dx + dz * dz) - MENU.dist);
      if (!aiming && (Math.abs(d) > MENU.dead || far > MENU.slack)) {
        anchor.yaw += (d - Math.sign(d) * Math.min(Math.abs(d), MENU.settle)) * (1 - Math.exp(-dt * MENU.rate));
        ahead(V1, anchor.yaw, MENU.dist, 0); V1.y = HD.pos.y - MENU.drop;
        anchor.pos.lerp(V1, 1 - Math.exp(-dt * MENU.rate));
      }
    }
    face(cur.mesh, anchor.pos, TILT.modal);
  }

  /* ---------------- the wrist HUD ---------------- */
  // A small panel that floats over the HUD wrist (left, or right when you are left-handed) while that wrist faces your
  // head. That pose is the system gesture zone, so the HUD is poked, never pinched: the other index tip touches it
  // (hands), or the other controller points at it and pulls the trigger.
  const hud = { p: null, arrow: null, a: 0, on: false, shownFor: 0, pos: new THREE.Vector3(), init: false, hover: null, down: null, key: {}, armed: true, turn: 0, dist: 0, angle: 0, near: null, nearAt: 0, list: [], listAt: -9 };
  const ARROW_XY = [(452 / HUDP.wpx - 0.5) * HUDP.w, (0.5 - 92 / HUDP.hpx) * ((HUDP.w * HUDP.hpx) / HUDP.wpx)];
  function hudPanel() {
    if (hud.p) return hud.p;
    const p = hud.p = makePanel("hud", HUDP.wpx, HUDP.hpx, HUDP.w, RO.hud);
    p.paint = paintHud;
    // the compass arrow is a small mesh, so it turns without drawing the texture again
    const s = new THREE.Shape();
    s.moveTo(0, 0.027); s.lineTo(0.019, -0.017); s.lineTo(0, -0.008); s.lineTo(-0.019, -0.017); s.closePath();
    const flat = (col) => new THREE.MeshBasicMaterial({ color: col, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    hud.arrow = new THREE.Mesh(new THREE.ShapeGeometry(s), flat(0xe0482c));
    hud.arrow.renderOrder = RO.hud + 2; hud.arrow.frustumCulled = false; hud.arrow.position.set(ARROW_XY[0], ARROW_XY[1], 0.001);
    // the ink outline: the same arrow, bigger, behind (it turns and hides with the red one)
    const ink = new THREE.Mesh(new THREE.ShapeGeometry(s), flat(PAL.ink));
    ink.scale.setScalar(1.25); ink.position.z = -0.0004; ink.renderOrder = RO.hud + 1; ink.frustumCulled = false;
    hud.arrow.scale.setScalar(0.5); // the ink tip reaches 0.0169 m, inside the ring's inner edge at 0.0176 m
    hud.arrow.add(ink); hud.arrow.userData.ink = ink;
    p.mesh.add(hud.arrow);
    return p;
  }
  const handMode = () => !!inp && inp.kind === "hand";
  // A HUD button: round menu, the turn arrows in hand mode, Skip while there is something to skip.
  function paintHud(q) {
    const c = q.ctx, w = q.wpx, h = q.hpx, pg = prog || NOPROG;
    q.rects.length = 0;
    card(c, w, h, { shadow: 10 });
    // Loonies and the bank
    iconCoin(c, 58, 66, 30);
    c.textAlign = "left"; c.textBaseline = "middle";
    c.font = font(76, 400, F_LOGO); c.fillStyle = C.ink; c.fillText(String(pg.loonies), 100, 68);
    const lw = c.measureText(String(pg.loonies)).width;
    c.font = font(42, 700); c.fillStyle = "rgba(20,10,24,0.6)"; c.fillText("/" + pg.looniesTotal, 104 + lw, 78);
    c.font = font(34, 400, F_LOGO); spacing(c, 2); c.fillStyle = C.magenta; c.fillText("BANK " + pg.bank, 100, 122); spacing(c, 0);
    // clogs
    iconDrop(c, 292, 66, 24);
    c.font = font(76, 400, F_LOGO); c.fillStyle = C.ink; c.fillText(String(pg.clogs), 326, 68);
    const cw = c.measureText(String(pg.clogs)).width;
    c.font = font(42, 700); c.fillStyle = "rgba(20,10,24,0.6)"; c.fillText("/" + pg.clogsTotal, 330 + cw, 78);
    // the compass ring (the arrow is a mesh on top) and its distance
    c.beginPath(); c.arc(452, 92, 48, 0, 7); c.fillStyle = C.cream; c.fill(); c.lineWidth = 6; c.strokeStyle = C.ink; c.stroke();
    if (hud.dist > 0) { c.font = font(32, 400, F_LOGO); spacing(c, 1); c.textAlign = "center"; c.fillStyle = C.ink; c.fillText(hud.dist >= 1000 ? (hud.dist / 1000).toFixed(1) + " km" : Math.round(hud.dist / 5) * 5 + " m", 452, 158); spacing(c, 0); }
    // the middle row: hearts while the King is awake, the trial timer during a trial
    c.textAlign = "left";
    if (pg.trial) {
      c.font = font(56, 400, F_LOGO); c.fillStyle = C.red; c.fillText(pg.trial.time.toFixed(1) + " s", 34, 176);
      c.font = font(34, 400, F_LOGO); spacing(c, 2); c.fillStyle = C.ink; c.fillText("RING " + (pg.trial.ring + 1), 210, 180); spacing(c, 0);
    } else if (pg.king === "awake") {
      for (let i = 0; i < GAME.king.hearts; i++) iconHeart(c, 62 + i * 68, 176, 24, i < pg.hearts);
    }
    // the buttons
    const by = 234;
    hudButton(q, "hud:menu", 18, by, 96, 84, 8, () => iconMenu(c, 66, by + 42, 40));
    let x = 128;
    if (handMode()) {
      hudButton(q, "hud:left", x, by, 92, 84, 8, () => iconArrow(c, x + 46, by + 42, 38, 1));
      x += 102;
      hudButton(q, "hud:right", x, by, 92, 84, 8, () => iconArrow(c, x + 46, by + 42, 38, -1));
      x += 102;
    }
    if (canSkip()) {
      const sw = w - 30 - Math.max(x, 350);
      hudButton(q, "hud:skip", w - 30 - sw, by, sw, 84, 8, null, "SKIP");
    }
  }
  function hudButton(q, id, x, y, w, h, r, icon, label) {
    const c = q.ctx, hv = q.hover === id, dn = q.down === id;
    q.rects.push({ id, x, y, w, h, label: label || id });
    const dx = dn ? 4 : hv ? -2 : 0, sh = dn ? 1 : hv ? 8 : 6;
    box(c, x + dx, y + dx, w - 6, h - 6, { fill: dn ? "#ff9a2a" : hv ? "#ffe883" : C.yellow, shadow: sh, border: 6, dots: false });
    if (icon) icon();
    if (label) { c.font = font(46, 400, F_LOGO); spacing(c, 3); c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = C.ink; c.fillText(label, x + dx + (w - 6) / 2, y + dx + (h - 6) / 2 + 3); spacing(c, 0); }
  }
  // The nearest clog that is still clogged, refreshed twice a second from the game's target list (or the King, once they are all clear).
  function nearestTarget() {
    const g = G().game;
    if (!g || !g.targets || !Pl) return null;
    if (frameN - hud.listAt > 30) { hud.list = g.targets() || []; hud.listAt = frameN; }
    let best = null, bd = Infinity;
    for (const t of hud.list) {
      if (t.kind !== "clog" || t.done) continue;
      const dx = t.x - Pl.pos.x, dz = t.z - Pl.pos.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = t; }
    }
    if (!best) for (const t of hud.list) if (t.kind === "king") best = t;
    return best;
  }
  const HV = [0, 1, 2, 3, 4].map(() => new THREE.Vector3());
  const TRK = (J, i, out) => out.set(J[i * 4], J[i * 4 + 1], J[i * 4 + 2]).applyMatrix4(rig.matrixWorld);

  // Where the HUD floats and whether its wrist faces you. Returns true (and sets hud.want in HV[0], the facing in hud.facing).
  const hudPose = { want: HV[0], facing: 0 };
  function hudPlacement(h) {
    const [want, a, b, n, t] = HV;
    if (h.kind === "hand" && h.joints) {
      // the palm normal: (index metacarpal − wrist) × (little metacarpal − wrist), mirrored for the left hand
      const J = h.joints;
      TRK(J, 0, a); TRK(J, 5, b); TRK(J, 20, t);
      b.sub(a); t.sub(a); n.crossVectors(b, t);
      if (h.side === "left") n.negate();
      if (n.lengthSq() < 1e-9) return false;
      n.normalize();
      TRK(J, 10, want);
      // the palm zone is the system gesture zone: the input's own palmUp flag says the palm is in it
      hudPose.facing = n.dot(t.copy(HD.pos).sub(want).normalize());
      if (h.palmUp && hudPose.facing < HUDP.show + 0.05) hudPose.facing = HUDP.show + 0.05;
      want.addScaledVector(n, HUDP.upHand);
    } else if (h.kind === "controller") {
      // the top of the controller (the face with the thumbstick) turns toward you when you look at your wrist
      n.set(0, 1, 0).applyQuaternion(h.gripQuat);
      want.copy(h.gripPos);
      hudPose.facing = n.dot(t.copy(HD.pos).sub(want).normalize());
      want.addScaledVector(n, HUDP.upPad);
    } else return false;
    const d = want.distanceTo(HD.pos);
    hud.wristDist = d;
    return d > 0.12 && d < 0.85;
  }
  function updateHud(dt) {
    const side = hudSide(), h = inp.hands[side];
    let show = false;
    if (!modal && h.connected && inp.visible !== false && G().state !== "title") {
      rig.updateMatrixWorld();
      const ok = hudPlacement(h);
      show = ok && hudPose.facing > (hud.on ? HUDP.hide : HUDP.show);
    }
    hud.on = show;
    hud.a += Math.sign((show ? 1 : 0) - hud.a) * Math.min(Math.abs((show ? 1 : 0) - hud.a), dt / 0.12);
    hud.shownFor = hud.a > 0.9 ? hud.shownFor + dt : 0;
    if (hud.a <= 0.001) {
      if (hud.p) hud.p.mesh.visible = false;
      hud.init = false; hud.hover = hud.down = null; hud.turn = 0; hud.armed = true;
      return;
    }
    const p = hudPanel();
    // follow the wrist a little softly, so a shaky hand does not shake the numbers
    if (!hud.init) { hud.pos.copy(hudPose.want); hud.init = true; } else hud.pos.lerp(hudPose.want, 1 - Math.exp(-dt * 28));
    p.mesh.position.copy(hud.pos); p.mesh.lookAt(HD.pos); p.mesh.rotateZ(TILT.hud * DEG);
    // the compass to the nearest clog, relative to where you look
    const tg = nearestTarget();
    if (tg && Pl) {
      const dx = tg.x - Pl.pos.x, dz = tg.z - Pl.pos.z;
      hud.angle = wrap(Math.atan2(-dx, -dz) - HD.yaw);
      const d = Math.sqrt(dx * dx + dz * dz);
      if (Math.abs(d - hud.dist) > 4) { hud.dist = d; p.dirty = true; }
      hud.arrow.visible = true; hud.arrow.rotation.z = hud.angle;
    } else { hud.arrow.visible = false; if (hud.dist !== 0) { hud.dist = 0; p.dirty = true; } }
    const pg = prog || NOPROG, K = hud.key;
    const tt = pg.trial ? Math.floor(pg.trial.time * 10) : -1, tr = pg.trial ? pg.trial.ring : -1, hs = pg.king === "awake" ? pg.hearts : -1, hm = handMode(), sk = canSkip();
    if (K.l !== pg.loonies || K.b !== pg.bank || K.c !== pg.clogs || K.h !== hs || K.t !== tt || K.r !== tr || K.m !== hm || K.s !== sk || K.hv !== hud.hover || K.dn !== hud.down) {
      K.l = pg.loonies; K.b = pg.bank; K.c = pg.clogs; K.h = hs; K.t = tt; K.r = tr; K.m = hm; K.s = sk; K.hv = hud.hover; K.dn = hud.down;
      p.dirty = true;
    }
    p.hover = hud.hover; p.down = hud.down;
    if (p.dirty) repaint(p);
    p.mat.opacity = hud.a; hud.arrow.material.opacity = hud.a; hud.arrow.userData.ink.material.opacity = hud.a;
    p.mesh.visible = true;
    hudTouch(dt, side, p);
  }
  function activateHud(id) {
    if (id === "hud:menu") { inp.menuDown = true; audio.sfx("ui"); }
    else if (id === "hud:skip") { audio.sfx("ui"); if (skipFn) skipFn(); else emit(fns.skip); }
  }
  // The other hand presses the HUD: a fingertip that reaches the panel (hands), or its ray and trigger (controllers).
  function hudTouch(dt, side, p) {
    const pk = 1 - side, ph = inp.hands[pk];
    let hv = null, touching = false;
    if (hud.a < 0.6 || !ph.connected) { hud.hover = hud.down = null; hud.turn = 0; return; }
    if (ph.kind === "hand" && ph.joints) {
      // the index tip (joint 9) in the panel's own space: z is its distance in front of the panel
      rig.updateMatrixWorld(); p.mesh.updateMatrixWorld();
      M1.copy(p.mesh.matrixWorld).invert();
      const t = TRK(ph.joints, 9, HV[4]).applyMatrix4(M1);
      const px = (t.x / p.w + 0.5) * p.wpx, py = (0.5 - t.y / p.h) * p.hpx;
      const r = t.z > -0.04 && t.z < HUDP.hover ? rectAt(p, px, py, 10) : null;
      if (t.z > HUDP.arm) hud.armed = true;
      hv = r ? r.id : null;
      if (r && hud.armed && t.z < HUDP.poke) { hud.armed = false; hud.down = r.id; if (r.id === "hud:left" || r.id === "hud:right") hud.turn = r.id === "hud:left" ? -1 : 1; else activateHud(r.id); }
      if (hud.down && (t.z > HUDP.arm || !r || r.id !== hud.down)) { hud.down = null; hud.turn = 0; }
      blocked[pk] = Math.abs(t.z) < 0.09 && Math.abs(t.x) < p.w && Math.abs(t.y) < p.h;
      touching = blocked[pk];
    } else if (ph.kind === "controller") {
      V1.copy(ph.aimPos); V2.copy(ph.aimDir).normalize();
      if (hitPanel(p, V1, V2)) {
        const r = rectAt(p, HIT.px, HIT.py, 10);
        hv = r ? r.id : null;
        blocked[pk] = true; touching = true;
        if (ph.triggerDown && r) { hud.down = r.id; if (r.id === "hud:left" || r.id === "hud:right") hud.turn = r.id === "hud:left" ? -1 : 1; haptic(pk, 0.3, 20); }
        ph.triggerDown = false;
        if (ph.triggerUp) { if (hud.down && hud.down === hv && hud.turn === 0) activateHud(hud.down); hud.down = null; hud.turn = 0; ph.triggerUp = false; }
        laserOn(pk, HIT.t);
      } else if (hud.down && ph.triggerUp) { hud.down = null; hud.turn = 0; ph.triggerUp = false; blocked[pk] = true; }
    }
    if (hv !== hud.hover) { hud.hover = hv; if (hv && ph.kind === "controller") haptic(pk, 0.1, 8); }
    if (hud.turn && inp.mode === "xr") inp.turn = hud.turn;
    void touching;
  }

  /* ---------------- the laser pointer ---------------- */
  const laser = { mesh: null, dot: null, side: -1, until: -1 };
  function laserBuild() {
    if (laser.mesh) return;
    const g = new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    laser.mesh = new THREE.Mesh(g, mat);
    laser.dot = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff4d8, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
    for (const m of [laser.mesh, laser.dot]) { m.renderOrder = RO.laser; m.frustumCulled = false; m.visible = false; scene.add(m); }
  }
  // Draws the beam of hand `side` to distance t along its aim ray (called while it points at something, or while a panel is open).
  function laserOn(side, t) {
    laserBuild();
    const h = inp.hands[side];
    V1.copy(h.aimDir).normalize();
    V2.copy(h.aimPos).addScaledVector(V1, t);
    laser.mesh.position.copy(h.aimPos); laser.mesh.lookAt(V2); laser.mesh.scale.set(1, 1, t);
    laser.dot.position.copy(V2); laser.dot.scale.setScalar(Math.max(0.004, t * 0.0055));
    laser.mesh.visible = laser.dot.visible = true;
    laser.side = side; laser.until = frameN;
  }
  function laserOff() { if (laser.mesh) laser.mesh.visible = laser.dot.visible = false; laser.side = -1; }

  /* ---------------- talking to the panels: hover, press, release ---------------- */
  // The hand that holds the laser while a panel is open: your dominant hand, or the other one when it is not there.
  function laserSide() {
    const d = settings.hand === "left" ? 0 : 1;
    if (inp.hands[d].connected) return d;
    return inp.hands[1 - d].connected ? 1 - d : -1;
  }
  function modalTouch(dt) {
    const p = cur;
    if (!p || !p.mesh.visible) return;
    const L = laserSide();
    if (L < 0) return;
    const h = inp.hands[L];
    blocked[L] = true;
    V1.copy(h.aimPos); V2.copy(h.aimDir).normalize();
    let hit = hitPanel(p, V1, V2), id = null, t = 2.5;
    if (hit) { const r = rectAt(p, HIT.px, HIT.py); id = r ? r.id : null; t = HIT.t; }
    // the map: a pin within 3 cm of the beam wins over the panel behind it
    let pin = -1;
    if (map.on) { pin = pickPin(V1, V2, PIN_SNAP); if (pin >= 0) { id = "pin:" + (map.pins[pin].spot ? map.pins[pin].spot.id : "info" + pin); t = map.pinT; } }
    if (pin !== map.hover) setPinHover(pin);
    if (id !== p.hover) { p.hover = id; p.dirty = true; if (id) haptic(L, 0.1, 8); }
    if (h.triggerDown) { if (id) { p.down = id; p.dirty = true; haptic(L, 0.3, 20); } h.triggerDown = false; }
    if (h.triggerUp) {
      if (p.down) {
        const fire = p.down === id;
        const d = p.down;
        p.down = null; p.dirty = true;
        if (fire) act(d);
      }
      h.triggerUp = false;
    }
    if (cur === p && p.dirty) repaint(p);
    laserOn(L, t);
  }
  /* ---------------- what the buttons do ---------------- */
  function updateChest() {
    if (!Pl || !inp || inp.mode === "desktop") return;
    const hh = settings.seated ? COMFORT.standingHead : settings.height > 0 ? settings.height : COMFORT.standingHead;
    Pl.chest = SWING.chestH * clamp(hh / COMFORT.standingHead, 0.8, 1.2);
  }
  function headY() { const i = inp || G().input; return i ? i.head.local.pos.y : 0; }
  function act(id) {
    const cut = id.indexOf(":"), k = cut < 0 ? id : id.slice(0, cut), v = cut < 0 ? "" : id.slice(cut + 1);
    switch (k) {
      case "resume": closePause(); return;
      case "map": openMap(); audio.sfx("ui"); return;
      case "comfort": showPage("comfort"); audio.sfx("ui"); return;
      case "back": if (map.on) closeMap(); showPage("pause"); audio.sfx("uiBack"); return;
      case "sound": audio.toggle(); saveNow(); audio.sfx("ui"); showPage(modal); return;
      case "music": audio.music(!audio.musicOn); settings.music = audio.musicOn; saveNow(); audio.sfx("ui"); showPage(modal); return;
      case "scan": scanRoom(); return;
      case "skip": audio.sfx("ui"); closePause(); if (skipFn) skipFn(); else emit(fns.skip); return;
      case "reset": showPage("confirm"); audio.sfx("ui"); return;
      case "resetNo": showPage("pause"); audio.sfx("uiBack"); return;
      case "resetYes": closePause(); emit(fns.restart); return;
      case "exit": closePause(); emit(fns.exit); return;
      case "preset": {
        if (!COMFORT.presets[v] || v === "desktop") return;
        if (isDesktopNow()) settings.preset = v; else { comfort.applyPreset(v); if (Pl) { Pl.speedCap = COMFORT.presets[v].speedCap; Pl.fallCap = COMFORT.presets[v].fallCap; } }
        break;
      }
      case "vignette": if (v in COMFORT.vignetteMinFov) settings.vignette = v; break;
      case "look": if (v === "room" || v === "black") settings.vignetteLook = v; break;
      case "turn": if (v === "smooth") settings.turn = "smooth"; else if ([30, 45, 90].includes(+v)) { settings.turn = "snap"; settings.snap = +v; } break;
      case "aim": if (v in SWING.aimCone) settings.aim = v; break;
      case "hand": if (v === "left" || v === "right") { settings.hand = v; hud.init = false; } break;
      case "hold": if (v === "hold" || v === "toggle") settings.hold = v; break;
      case "hz": settings.hz = +v === 90 ? 90 : 72; if (xr && xr.setFrameRate) Promise.resolve(xr.setFrameRate(settings.hz)).catch(() => {}); break;
      case "seated": {
        settings.seated = v === "on";
        if (settings.seated) comfort.calibrate(headY()); else settings.height = 0;
        updateChest();
        break;
      }
      case "calibrate": {
        const y = headY();
        comfort.calibrate(y); updateChest();
        toastSay("Height saved: " + (y > 0 ? y.toFixed(2) : "?") + " m");
        break;
      }
      case "stance": resolveStance(v === "seated" ? "seated" : "standing"); return;
      case "credits":
        if (v === "arcade") backToArcade(); else closeCredits();
        return;
      case "pin": travelToId(v); return;
      default: return;
    }
    saveNow();
    audio.sfx("ui");
    showPage(modal);
  }
  function scanRoom() {
    const s = xr && xr.session;
    audio.sfx("ui");
    if (s && typeof s.initiateRoomCapture === "function") {
      // the system takes over for the scan; when it hands back, main opens the pause menu
      Promise.resolve().then(() => s.initiateRoomCapture()).catch(() => toastSay("The room scan did not start."));
      toastSay("Follow the steps in the scan.");
    } else toastSay("The room scan is not available here.");
  }
  function backToArcade() {
    const go = () => { try { location.assign("/"); } catch (e) { /* leaving the page failed: stay */ } };
    if (xr && xr.session && xr.end) Promise.resolve(xr.end()).then(go, go); else go();
  }
  function closeCredits() {
    if (isDesktopNow()) { closePause(); return; }
    hidePanels(); modal = null;
    audio.sfx("uiBack");
  }

  /* ---------------- open and close ---------------- */
  function hideModal() {
    hidePanels();
    if (dom.built) domClose();
    modal = null;
  }
  function openPause() {
    if (paused) return;
    paused = true;
    if (isDesktopNow()) { try { document.exitPointerLock(); } catch (e) { /* not locked */ } }
    showPage("pause");
    audio.sfx("ui");
  }
  function closePause() {
    if (!paused) return;
    paused = false;
    if (map.on) closeMap();
    hideModal();
    audio.sfx("uiBack");
    if (stance.on && !isDesktopNow()) showPage("stance");
  }

  /* ---------------- the stance question ---------------- */
  const preStance = () => { const y = headY(); return y > 0.3 && y < COMFORT.seatedBelow ? "seated" : "standing"; };
  function askStance() {
    if (stance.on && stance.promise) return stance.promise;
    if (isDesktopNow()) return Promise.resolve("standing");
    stance.promise = new Promise((res) => { stance.resolve = res; });
    stance.on = true; stance.t = STANCE_SECS; stance.age = 0; stance.pre = preStance(); stance.shown = Math.ceil(STANCE_SECS);
    if (!paused) showPage("stance");
    return stance.promise;
  }
  function resolveStance(kind) {
    if (!stance.on) return;
    stance.on = false;
    const y = headY();
    settings.stance = kind; settings.seated = kind === "seated";
    if (y > 0.3) comfort.calibrate(y);
    if (!settings.seated && !(settings.height > 0)) settings.height = 0;
    updateChest();
    saveNow();
    audio.sfx("ui");
    if (modal === "stance") { hidePanels(); modal = null; if (paused) showPage("pause"); }
    const r = stance.resolve; stance.resolve = null; stance.promise = null;
    if (r) r(kind);
  }
  function stanceStep(dt) {
    if (!stance.on || paused) return;
    stance.age += dt; stance.t -= dt;
    let refresh = false;
    // the head may not be tracked in the first frames: the preselection settles over the first second and a half
    if (stance.age < 1.5) { const p = preStance(); if (p !== stance.pre) { stance.pre = p; refresh = true; } }
    if (Math.ceil(stance.t) !== stance.shown) { stance.shown = Math.ceil(stance.t); refresh = true; }
    if (stance.t <= 0) { resolveStance(stance.pre); return; }
    if (refresh && modal === "stance") showPage("stance");
  }

  function showCredits() {
    if (isDesktopNow()) { if (!paused) { paused = true; try { document.exitPointerLock(); } catch (e) { /* not locked */ } } showPage("credits"); return; }
    showPage("credits");
  }

  /* ---------------- the map ---------------- */
  // The city as a diorama. In mixed reality it stands on your nearest table or desk and the world is hidden, so the
  // passthrough shows around it. In VR and on a flat screen it stands on a plinth in a dark void. Pins mark the clogs,
  // the King, the trials and the places you can travel to; the laser snaps to a pin within 3 cm.
  const B = city.bounds;
  const map = { on: false, root: null, tilt: null, holder: null, pinRoot: null, pins: [], hover: -1, plinth: null, prevClear: null, size: 0.7, scale: 1, pinT: 1, you: null, stems: null, tip: null, mode: "float", table: false, sprites: null };
  function pinSprites() {
    if (map.sprites) return map.sprites;
    const make = (draw) => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 128;
      const c = cv.getContext("2d");
      c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fillStyle = C.paper; c.fill(); c.lineWidth = 8; c.strokeStyle = C.ink; c.stroke();
      draw(c);
      const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
      renderer.initTexture(t);
      return t;
    };
    const ring = (c, col) => { c.beginPath(); c.arc(64, 64, 45, 0, 7); c.lineWidth = 8; c.strokeStyle = col; c.stroke(); };
    map.sprites = {
      drop: make((c) => { ring(c, C.sludge); iconDrop(c, 64, 66, 24, C.sludge); }),
      tick: make((c) => { ring(c, C.blue); iconTick(c, 64, 64, 30, C.blue); }),
      king: make((c) => {
        ring(c, C.coin);
        c.beginPath(); c.moveTo(34, 84); c.lineTo(30, 48); c.lineTo(48, 64); c.lineTo(64, 40); c.lineTo(80, 64); c.lineTo(98, 48); c.lineTo(94, 84); c.closePath();
        c.fillStyle = C.coin; c.fill(); c.lineWidth = 6; c.lineJoin = "round"; c.strokeStyle = C.ink; c.stroke();
      }),
      trial: make((c) => { ring(c, C.orange); c.beginPath(); c.arc(64, 64, 22, 0, 7); c.lineWidth = 10; c.strokeStyle = C.orange; c.stroke(); c.beginPath(); c.arc(64, 64, 8, 0, 7); c.fillStyle = C.ink; c.fill(); }),
      start: make((c) => { ring(c, C.magenta); c.beginPath(); c.moveTo(30, 68); c.lineTo(64, 36); c.lineTo(98, 68); c.lineTo(88, 68); c.lineTo(88, 92); c.lineTo(40, 92); c.lineTo(40, 68); c.closePath(); c.fillStyle = C.yellow; c.fill(); c.lineWidth = 6; c.lineJoin = "round"; c.strokeStyle = C.ink; c.stroke(); }),
      spot: make((c) => { ring(c, C.gold); c.beginPath(); c.moveTo(64, 34); c.lineTo(88, 64); c.lineTo(64, 94); c.lineTo(40, 64); c.closePath(); c.fillStyle = C.yellow; c.fill(); c.lineWidth = 6; c.lineJoin = "round"; c.strokeStyle = C.ink; c.stroke(); }),
    };
    return map.sprites;
  }
  // The nearest table or desk within 1.5 m of the head (tracking space), from the planes the headset found.
  function findTable() {
    if (!xr || !xr.planes || !inp) return null;
    const hl = inp.head.local.pos;
    let best = null, bd = 1.5;
    for (const e of xr.planes.values()) {
      if (e.label !== "table" && e.label !== "desk") continue;
      const m = e.matrix.elements, y = m[13];
      if (y < 0.4 || y > 1.3 || e.polygon.length < 3) continue;
      const d = Math.hypot(m[12] - hl.x, m[14] - hl.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  const SLAB = 10; // metres of slab under the street in the diorama (cityview)
  // Chooses where the diorama stands (tracking space) and how big and how turned it is: { x, y, z, yaw, size, tilt }.
  function mapSpot() {
    const hl = inp.head.local.pos, f = V1.set(0, 0, -1).applyQuaternion(inp.head.local.quat), psi = Math.atan2(-f.x, -f.z);
    const long = Math.max(B.maxX - B.minX, city.shoreZ - B.minZ), ratio = (city.shoreZ - B.minZ) / (B.maxX - B.minX);
    if (isAR()) {
      const t = findTable();
      if (t) {
        const m = t.matrix.elements;
        let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
        for (const q of t.polygon) { minx = Math.min(minx, q.x); maxx = Math.max(maxx, q.x); minz = Math.min(minz, q.z); maxz = Math.max(maxz, q.z); }
        const ex = maxx - minx, ez = maxz - minz;
        // the map's long side lies along the table's long side, and north (the far side of the map) faces away from you
        let ax = ex >= ez ? m[0] : m[8], az = ex >= ez ? m[2] : m[10];
        const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
        const cx = m[12], cz = m[14], away = Math.atan2(cx - hl.x, cz - hl.z);
        const th = (rx, rz) => { const a = Math.atan2(-rz, rx); return { a, dot: -Math.sin(a) * Math.sin(away) + -Math.cos(a) * Math.cos(away) }; };
        const c1 = th(ax, az), c2 = th(-ax, -az), pick = c1.dot >= c2.dot ? c1 : c2;
        const size = clamp(Math.min(0.7, Math.max(ex, ez) * 0.92, (Math.min(ex, ez) * 0.92) / ratio), 0.4, 0.7);
        map.table = true;
        return { x: cx, y: m[13] + SLAB * (size / long) + 0.004, z: cz, yaw: pick.a, size, tilt: 0, plinth: false };
      }
      map.table = false;
      return { x: hl.x - Math.sin(psi) * 1.0, y: 0.9, z: hl.z - Math.cos(psi) * 1.0, yaw: psi, size: 0.7, tilt: 0, plinth: true };
    }
    map.table = false;
    if (isDesktopNow()) {
      // flat play: in third person the camera hangs behind the hero, so the map stands 2 m in front of the camera (not of the head),
      // a little to the right of the list of places
      rig.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      const cp = rig.worldToLocal(V2.setFromMatrixPosition(camera.matrixWorld));
      const cf = V3.set(0, 0, -1).transformDirection(camera.matrixWorld).transformDirection(M1.copy(rig.matrixWorld).invert());
      const cpsi = Math.atan2(-cf.x, -cf.z), sx = -Math.sin(cpsi), sz = -Math.cos(cpsi);
      return { x: cp.x + sx * 2.0 - sz * 0.3, y: cp.y - 0.45, z: cp.z + sz * 2.0 + sx * 0.3, yaw: cpsi, size: 1.1, tilt: 24 * DEG, plinth: true };
    }
    return { x: hl.x - Math.sin(psi) * 1.25, y: 0.9, z: hl.z - Math.cos(psi) * 1.25, yaw: psi, size: 1.0, tilt: 0, plinth: true };
  }
  function openMap() {
    if (map.on || !view || !view.makeDiorama || !inp) return;
    if (isIntro()) return;
    map.on = true;
    if (!paused) paused = true;
    if (isDesktopNow()) { try { document.exitPointerLock(); } catch (e) { /* not locked */ } }
    const s = mapSpot();
    map.size = s.size; map.scale = s.size / Math.max(B.maxX - B.minX, city.shoreZ - B.minZ);
    map.root = new THREE.Group(); map.root.name = "ui:map";
    map.root.position.set(s.x, s.y, s.z); map.root.rotation.y = s.yaw;
    map.tilt = new THREE.Group(); map.tilt.rotation.x = s.tilt;
    map.root.add(map.tilt);
    map.holder = view.makeDiorama(s.size);
    map.tilt.add(map.holder);
    map.pinRoot = new THREE.Group();
    map.tilt.add(map.pinRoot);
    if (s.plinth) {
      // a slab under the diorama, dark plum with a gold edge, on a column to the floor (a floating slab when it is tilted)
      const w = s.size * 1.08, d = s.size * 0.86 * 1.08, top = -SLAB * map.scale - 0.004;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), new THREE.MeshBasicMaterial({ color: 0x3a2244 }));
      slab.position.y = top - 0.02;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.012, 0.008, d + 0.012), new THREE.MeshBasicMaterial({ color: 0xc9a44a }));
      edge.position.y = top - 0.002;
      map.plinth = new THREE.Group(); map.plinth.add(slab, edge);
      if (!s.tilt) {
        const h = s.y + top - 0.04, col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, Math.max(0.1, h), 20, 1), new THREE.MeshBasicMaterial({ color: 0x24142c }));
        col.position.y = -s.y + h / 2;
        map.plinth.add(col);
      }
      map.tilt.add(map.plinth);
    }
    rig.add(map.root);
    buildPins();
    // the void: the world goes away, the sky clears to plum (VR and flat screen; in mixed reality the passthrough shows)
    setWorldVisible(false);
    if (!isAR()) { map.prevClear = { c: renderer.getClearColor(new THREE.Color()).getHex(), a: renderer.getClearAlpha() }; renderer.setClearColor(0x1a1020, 1); }
    showPage("map");
    if (isDesktopNow()) domMapList();
  }
  function closeMap() {
    if (!map.on) return;
    map.on = false;
    setPinHover(-1);
    if (map.root) {
      map.root.removeFromParent();
    }
    for (const pin of map.pins) { pin.sprite.material.dispose(); }
    if (map.stems) { map.stems.geometry.dispose(); map.stems.material.dispose(); }
    if (map.plinth) map.plinth.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    if (map.you) { map.you.geometry.dispose(); map.you.material.dispose(); }
    map.pins = []; map.root = map.holder = map.pinRoot = map.plinth = map.stems = map.you = null; map.tilt = null;
    if (map.tipPanel) map.tipPanel.mesh.visible = false;
    if (map.prevClear) { renderer.setClearColor(map.prevClear.c, map.prevClear.a); map.prevClear = null; }
    // in VR and on a flat screen the city comes back under the pause menu; in mixed reality main shows it on resume
    if (!isAR()) setWorldVisible(true);
  }
  // Builds one pin per target and per place you can travel to.
  function buildPins() {
    const g = G().game, sp = pinSprites();
    const targets = g && g.targets ? g.targets() || [] : [];
    const spots = g && g.travelSpots ? g.travelSpots() || [] : [{ id: "start", name: "The start roof", x: city.start.x, y: city.start.y, z: city.start.z }];
    const s = map.scale, cx = (B.minX + B.maxX) / 2, cz = (B.minZ + city.shoreZ) / 2;
    const want = [];
    for (const t of targets) {
      const kind = t.kind === "clog" ? (t.done ? "tick" : "drop") : t.kind === "king" ? "king" : t.kind === "trial" ? "trial" : "start";
      const dn = city.districts && t.district != null && city.districts[t.district] ? city.districts[t.district].name : "";
      const name = t.kind === "clog" ? (t.done ? "Flushed clog" : "Clog") + (dn ? ": " + dn : "") : t.kind === "king" ? "The Porcelain King" : t.kind === "trial" ? "Trial start" : "The start roof";
      want.push({ kind, x: t.x, y: t.y, z: t.z, name, spot: null, target: t });
    }
    // a place to travel to belongs to the pin under it, or gets a pin of its own
    for (const sPot of spots) {
      const hit = want.find((w) => !w.spot && w.kind !== "drop" && w.kind !== "tick" && Math.hypot(w.x - sPot.x, w.z - sPot.z) < 6 && Math.abs(w.y - sPot.y) < 8);
      if (hit) { hit.spot = sPot; hit.name = sPot.name || hit.name; } else want.push({ kind: sPot.id === "start" ? "start" : "spot", x: sPot.x, y: sPot.y, z: sPot.z, name: sPot.name || "A rooftop", spot: sPot });
    }
    const stem = [];
    const size = map.size * 0.052;
    for (const w of want) {
      const px = (w.x - cx) * s, pz = (w.z - cz) * s, py = w.y * s;
      const mat = new THREE.SpriteMaterial({ map: sp[w.kind], transparent: true, depthWrite: false, fog: false, toneMapped: false });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(px, py + size * 0.95, pz); sprite.scale.set(size, size, 1); sprite.renderOrder = 5;
      map.pinRoot.add(sprite);
      stem.push(px, py, pz, px, py + size * 0.5, pz);
      map.pins.push({ ...w, sprite, base: size });
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(stem, 3));
    map.stems = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xfff4d8, transparent: true, opacity: 0.7, fog: false }));
    map.stems.frustumCulled = false;
    map.pinRoot.add(map.stems);
    // you: a cone that points where you look, on your roof
    if (Pl) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(size * 0.28, size * 0.8, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff4d8 }));
      const f = V1.set(0, 0, -1).applyQuaternion(inp.head.quat), yaw = Math.atan2(-f.x, -f.z);
      cone.position.set((Pl.pos.x - cx) * s, Pl.pos.y * s + size * 0.55, (Pl.pos.z - cz) * s);
      cone.rotation.y = yaw; cone.renderOrder = 6;
      map.pinRoot.add(cone); map.you = cone;
    }
    map.pinRoot.updateMatrixWorld(true);
  }
  // The pin nearest to a ray, if it is within tol metres of it. Fills map.pinT with the distance along the ray.
  function pickPin(o, d, tol) {
    let best = -1, bd = tol;
    map.pinRoot.updateMatrixWorld(true);
    for (let i = 0; i < map.pins.length; i++) {
      map.pins[i].sprite.getWorldPosition(V3);
      V4.copy(V3).sub(o);
      const t = V4.dot(d);
      if (t < 0.05) continue;
      const dist = V4.addScaledVector(d, -t).length();
      if (dist < bd) { bd = dist; best = i; map.pinT = t; }
    }
    return best;
  }
  function setPinHover(i) {
    if (map.hover >= 0 && map.pins[map.hover]) { const p = map.pins[map.hover]; p.sprite.scale.set(p.base, p.base, 1); }
    map.hover = i;
    if (i < 0) { if (map.tipPanel) map.tipPanel.mesh.visible = false; if (isDesktopNow()) domTip(null); return; }
    const p = map.pins[i];
    p.sprite.scale.set(p.base * 1.4, p.base * 1.4, 1);
    if (isDesktopNow()) { domTip(p.name + (p.spot ? "" : " (not a travel spot)")); return; }
    // a tooltip above the pin
    if (!map.tipPanel) map.tipPanel = makePanel("tip", 520, 110, 0.26, RO.hud);
    const q = map.tipPanel;
    const text = p.name;
    if (q.text !== text) {
      q.text = text;
      q.paint = (c2) => { const c = c2.ctx; box(c, 8, 8, c2.wpx - 8 - 16, c2.hpx - 8 - 16, { fill: C.yellow, border: 7, shadow: 8, dots: false }); c.font = font(52, 400, F_LOGO); spacing(c, 2); c.fillStyle = C.ink; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text.toUpperCase(), c2.wpx / 2 - 4, c2.hpx / 2 - 2, c2.wpx - 60); spacing(c, 0); };
      repaint(q);
    }
    q.mesh.visible = true;
  }
  function tipPlace() {
    const q = map.tipPanel;
    if (!q || !q.mesh.visible || map.hover < 0 || !map.pins[map.hover]) return;
    map.pins[map.hover].sprite.getWorldPosition(V1);
    V1.y += map.size * 0.09;
    q.mesh.position.copy(V1); q.mesh.lookAt(HD.pos); q.mesh.rotateZ(TILT.tip * DEG);
  }
  function travelToId(id) {
    const pin = map.pins.find((p) => p.spot && String(p.spot.id) === String(id));
    if (!pin) return;
    audio.sfx("travel");
    Promise.resolve(fadeTo(1, 0.25, isAR() ? "room" : "black")).then(() => { closePause(); emit(fns.travel, pin.spot); });
  }
  const fadeTo = (to, secs, look) => U.fade(to, secs, look);

  /* ---------------- the flat screen: a DOM HUD and Esc menu in the comic title page's style ---------------- */
  // Styles reuse the page's own variables (index.html), each with a fallback, so the menu belongs to the same game as the title:
  // yellow and cream caption boxes with thick ink borders, hard drop shadows, a little tilt, Bangers lettering, dots.
  const CSS = `
.fs-hud{position:fixed;inset:0;z-index:12;pointer-events:none;display:none;font:400 22px/1.1 var(--comic,"Bangers",Impact,"Arial Black",system-ui,sans-serif);letter-spacing:.05em;color:var(--ink,#140a18)}
body[data-mode="desktop"] .fs-hud{display:block}
.fs-cross{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:4px solid var(--yellow,#ffd84a);box-shadow:0 0 0 2.5px var(--ink,#140a18),inset 0 0 0 2.5px var(--ink,#140a18);background:radial-gradient(circle,var(--yellow,#ffd84a) 0 2.5px,var(--ink,#140a18) 2.5px 5.5px,transparent 6px)}
.fs-cross i{position:absolute;background:var(--yellow,#ffd84a);box-shadow:0 0 0 2px var(--ink,#140a18)}
.fs-cross i:nth-child(1){left:50%;top:-14px;width:4px;height:9px;margin-left:-2px}
.fs-cross i:nth-child(2){left:50%;bottom:-14px;width:4px;height:9px;margin-left:-2px}
.fs-cross i:nth-child(3){top:50%;left:-14px;height:4px;width:9px;margin-top:-2px}
.fs-cross i:nth-child(4){top:50%;right:-14px;height:4px;width:9px;margin-top:-2px}
.fs-top{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);left:50%;transform:translateX(-50%);display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:96vw}
.fs-pill{display:flex;align-items:center;gap:8px;padding:6px 16px 3px 10px;background:var(--yellow,#ffd84a);border:3px solid var(--ink,#140a18);border-radius:3px;box-shadow:4px 4px 0 var(--ink,#140a18);transform:rotate(-1.4deg)}
.fs-pill:nth-child(2){transform:rotate(1deg);background:var(--cream,#fff4d8)}
.fs-pill:nth-child(3){transform:rotate(-0.6deg)}
.fs-pill:nth-child(n+4){transform:rotate(1.2deg)}
.fs-pill b{font:400 30px/1 var(--comic,"Bangers",Impact,"Arial Black",sans-serif)}
.fs-pill small{font:700 21px/1 var(--ui,"Barlow Condensed","Arial Narrow",system-ui,sans-serif);opacity:.6}
.fs-pill em{font-style:normal;font-size:21px;letter-spacing:.1em;color:var(--magenta,#d8457a)}
.fs-coin{width:24px;height:24px;border-radius:50%;background:#f2c14e;border:3px solid var(--ink,#140a18);box-sizing:border-box}
.fs-drop{width:16px;height:21px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:#9cff3a;border:3px solid var(--ink,#140a18);box-sizing:border-box}
.fs-heart{color:#ff3a4a;font-size:26px;margin:0 1px;text-shadow:2px 0 var(--ink,#140a18),-2px 0 var(--ink,#140a18),0 2px var(--ink,#140a18),0 -2px var(--ink,#140a18)}.fs-heart.off{color:#d9cfb8}
.fs-compass svg{width:28px;height:28px;fill:var(--red,#e0482c);stroke:var(--ink,#140a18);stroke-width:2.6;stroke-linejoin:round;transition:transform .08s linear}
.fs-time b{color:var(--red,#e0482c)}
.fs-sub,.fs-toast{position:absolute;left:50%;margin:0;max-width:min(880px,90vw);text-align:center;opacity:0;transition:opacity .25s;text-transform:uppercase}
.fs-sub{bottom:calc(12vh + 6px);transform:translateX(-50%) rotate(-0.5deg);padding:10px 28px 6px;font:400 clamp(24px,2.9vw,36px)/1.1 var(--comic,"Bangers",Impact,"Arial Black",sans-serif);letter-spacing:.05em;color:var(--ink,#140a18);background:#fffdf5;border:4px solid var(--ink,#140a18);border-radius:30px}
.fs-sub::before,.fs-sub::after{content:"";position:absolute;border-style:solid;border-color:transparent;border-bottom-width:0}
.fs-sub::before{left:20%;bottom:-27px;border-width:27px 4px 0 24px;border-top-color:var(--ink,#140a18);border-right-color:transparent}
.fs-sub::after{left:calc(20% + 4px);bottom:-19px;border-width:22px 2px 0 17px;border-top-color:#fffdf5}
.fs-toast{bottom:calc(12vh + 96px);transform:translateX(-50%) rotate(1deg);padding:6px 22px 3px;font:400 clamp(20px,2.3vw,28px)/1.1 var(--comic,"Bangers",Impact,"Arial Black",sans-serif);letter-spacing:.06em;color:var(--ink,#140a18);background:var(--yellow,#ffd84a);border:3px solid var(--ink,#140a18);border-radius:3px;box-shadow:5px 5px 0 var(--ink,#140a18)}
.fs-sub.on,.fs-toast.on{opacity:1}
dialog.fs-menu{width:min(660px,calc(100vw - 32px));max-height:calc(100dvh - 28px);padding:20px 24px 20px;border:5px solid var(--ink,#140a18);border-radius:4px;background:var(--paper,#fff9ea);color:var(--ink,#140a18);box-shadow:10px 10px 0 var(--ink,#140a18);overflow:auto;font:600 19px/1.3 var(--ui,"Barlow Condensed","Arial Narrow",system-ui,sans-serif);color-scheme:light}
dialog.fs-menu::before{content:"";position:absolute;right:0;top:0;width:46%;height:150px;background:radial-gradient(circle at 50% 50%,rgba(216,69,122,.55) 0 1.4px,rgba(216,69,122,0) 2.1px) 0 0/7px 7px;-webkit-mask-image:radial-gradient(ellipse at 100% 0%,#000 0%,rgba(0,0,0,0) 72%);mask-image:radial-gradient(ellipse at 100% 0%,#000 0%,rgba(0,0,0,0) 72%);pointer-events:none}
dialog.fs-menu::backdrop{background:radial-gradient(circle at 50% 50%,rgba(255,216,74,.2) 0 1.3px,rgba(255,216,74,0) 1.9px) 0 0/9px 9px,rgba(20,10,24,.78)}
.fs-menu>*{position:relative}
.fs-menu h2,.fs-map h2{display:inline-block;margin:0 0 10px;padding:6px 18px 3px;background:var(--yellow,#ffd84a);border:4px solid var(--ink,#140a18);box-shadow:5px 5px 0 var(--ink,#140a18);transform:rotate(-1.4deg);font:400 clamp(28px,3.8vw,40px)/1.05 var(--comic,"Bangers",Impact,"Arial Black",sans-serif);letter-spacing:.06em;color:var(--ink,#140a18);text-transform:uppercase}
.fs-menu .lead{margin:0 0 14px;font-weight:700;font-size:19px}
.fs-menu .btn,.fs-map .btn{--tilt:-.8deg;min-height:52px;padding:8px 14px 5px;border:4px solid var(--ink,#140a18);border-radius:3px;background:var(--cream,#fff4d8);color:var(--ink,#140a18);font:400 clamp(19px,2.1vw,23px)/1 var(--comic,"Bangers",Impact,"Arial Black",sans-serif);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:5px 5px 0 var(--ink,#140a18);transform:rotate(var(--tilt));transition:transform .1s,box-shadow .1s,background .12s}
.fs-menu .btn:hover,.fs-map .btn:hover{background:#ffe883;transform:rotate(var(--tilt)) translate(-2px,-2px);box-shadow:8px 8px 0 var(--ink,#140a18)}
.fs-menu .btn:active,.fs-map .btn:active{transform:rotate(var(--tilt)) translate(4px,4px);box-shadow:1px 1px 0 var(--ink,#140a18)}
.fs-menu .btn.primary{background:linear-gradient(180deg,#ffe867 0%,rgba(255,232,103,0) 62%),radial-gradient(circle at 50% 50%,rgba(255,122,42,.85) 0 1.4px,rgba(255,122,42,0) 2px) 0 0/6px 6px,var(--yellow,#ffd84a);border-width:5px;box-shadow:6px 6px 0 var(--ink,#140a18)}
.fs-menu .btn.danger{background:var(--red,#e0482c);color:#fff9ea}
.fs-menu .btn[aria-pressed=true]{background:#ff9a2a;border-width:5px;transform:rotate(-.6deg)}
.fs-menu .fs-row{display:flex;gap:14px;margin:14px 0}
.fs-menu .fs-row .btn{flex:1}
.fs-menu .fs-row .btn:nth-child(2){--tilt:.7deg}
.fs-menu .fs-seg{display:flex;align-items:center;gap:12px;margin:14px 0}
.fs-menu .fs-seg>span{flex:0 0 34%;font-weight:800;font-size:19px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink,#140a18)}
.fs-menu .fs-seg>div{display:flex;flex:1;gap:8px}
.fs-menu .fs-seg .btn{flex:1;min-height:44px;padding:6px 8px 3px;font-size:18px;letter-spacing:.06em}
.fs-menu p{margin:10px 0;line-height:1.35}.fs-menu p.small{opacity:.78;font-size:17px}
.fs-map{position:fixed;left:16px;top:16px;z-index:14;width:min(330px,82vw);max-height:calc(100dvh - 32px);overflow:auto;padding:14px 16px 16px;border:5px solid var(--ink,#140a18);border-radius:4px;background:var(--paper,#fff9ea);box-shadow:8px 8px 0 var(--ink,#140a18);color:var(--ink,#140a18);font:600 18px/1.3 var(--ui,"Barlow Condensed",system-ui,sans-serif)}
.fs-map h2{font-size:28px;margin-bottom:8px}
.fs-map p{margin:0 0 10px;font-size:17px;font-weight:700}
.fs-map .btn{display:block;width:100%;margin:8px 0;min-height:42px;padding:6px 12px 3px;font-size:18px;text-align:left;box-shadow:4px 4px 0 var(--ink,#140a18)}
.fs-tip{position:fixed;z-index:15;pointer-events:none;padding:5px 12px 2px;background:var(--yellow,#ffd84a);border:3px solid var(--ink,#140a18);border-radius:3px;box-shadow:4px 4px 0 var(--ink,#140a18);color:var(--ink,#140a18);font:400 20px/1.15 var(--comic,"Bangers",Impact,"Arial Black",sans-serif);letter-spacing:.06em;text-transform:uppercase;transform:rotate(1deg)}
@media (pointer:coarse) and (min-height:461px){.fs-menu .btn{min-height:58px}.fs-menu .fs-seg .btn{min-height:52px}}
@media (max-height:460px){.fs-pill b{font-size:24px}.fs-pill small,.fs-pill em{font-size:17px}.fs-sub{bottom:calc(9vh + 6px);font-size:22px}.fs-toast{bottom:calc(9vh + 84px)}
dialog.fs-menu{padding:10px 18px 14px;box-shadow:7px 7px 0 var(--ink,#140a18)}.fs-menu h2{font-size:24px;padding:4px 14px 1px;margin-bottom:4px}.fs-menu .lead{margin-bottom:6px}.fs-menu .fs-row,.fs-menu .fs-seg{margin:8px 0;gap:10px}.fs-menu .btn{min-height:42px;padding:5px 10px 2px;font-size:18px;border-width:3px;box-shadow:4px 4px 0 var(--ink,#140a18)}.fs-menu .fs-seg .btn{min-height:38px;font-size:16px}.fs-menu .fs-seg>span{font-size:16px}.fs-menu p{margin:6px 0}}
@media (prefers-reduced-motion:reduce){.fs-sub,.fs-toast{transition:none}.fs-compass svg{transition:none}.fs-menu .btn,.fs-map .btn{transition:none}}`;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const dh = { loon: -1, bank: -1, clog: -1, hearts: -2, trial: "", dist: -1, ang: 999, king: "" };
  function domBuild() {
    if (dom.built) return;
    dom.built = true;
    const st = el("style"); st.textContent = CSS; document.head.appendChild(st);
    dom.hud = el("div", "fs-hud"); dom.hud.id = "fsHud";
    dom.hud.innerHTML =
      '<div class="fs-cross"><i></i><i></i><i></i><i></i></div><div class="fs-top">' +
      '<div class="fs-pill" title="Loonies"><i class="fs-coin"></i><b data-k="loon">0</b><small data-k="loonT">/80</small><em data-k="bank">BANK 0</em></div>' +
      '<div class="fs-pill" title="Clogs"><i class="fs-drop"></i><b data-k="clog">0</b><small data-k="clogT">/12</small></div>' +
      '<div class="fs-pill fs-time" data-k="trialBox" hidden><b data-k="trial">0.0</b><small>s</small></div>' +
      '<div class="fs-pill" data-k="heartBox" hidden></div>' +
      '<div class="fs-pill fs-compass" data-k="compassBox" title="The nearest clog"><svg viewBox="-12 -12 24 24" data-k="arrow"><path d="M0 -10 L7 8 L0 4 L-7 8 Z"/></svg><small data-k="dist"></small></div>' +
      '</div><p class="fs-sub" data-k="sub" role="status"></p><p class="fs-toast" data-k="toast" role="status"></p>';
    document.body.appendChild(dom.hud);
    dom.k = {};
    for (const n of dom.hud.querySelectorAll("[data-k]")) dom.k[n.dataset.k] = n;
    dom.menu = el("dialog", "fs-menu"); dom.menu.id = "fsMenu";
    dom.menu.addEventListener("cancel", (e) => e.preventDefault()); // Esc goes through the game's own key, so it toggles once
    // on the pause page a click that misses the buttons goes back to play, like a click on the city (main takes it from there)
    // (main listens for pointerdown, so mouse, pen and touch all count)
    dom.menu.addEventListener("pointerdown", (e) => {
      if (dom.name === "pause" && !e.target.closest("button")) renderer.domElement.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: e.pointerId, pointerType: e.pointerType }));
    });
    document.body.appendChild(dom.menu);
    dom.map = el("div", "fs-map"); dom.map.id = "fsMap"; dom.map.hidden = true;
    document.body.appendChild(dom.map);
    dom.tip = el("div", "fs-tip"); dom.tip.hidden = true;
    document.body.appendChild(dom.tip);
    // the map on a flat screen: point at a pin with the mouse, click to travel
    const cv = renderer.domElement, ray = new THREE.Raycaster(), nd = new THREE.Vector2();
    const aim = (e) => {
      if (!map.on || !isDesktopNow()) return -1;
      const r = cv.getBoundingClientRect();
      nd.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(nd, camera);
      return pickPin(ray.ray.origin, ray.ray.direction, PIN_SNAP + 0.02); // a mouse is less exact than a hand
    };
    cv.addEventListener("pointermove", (e) => {
      const i = aim(e);
      if (i !== map.hover) setPinHover(i);
      if (i >= 0) { dom.tip.style.left = e.clientX + 14 + "px"; dom.tip.style.top = e.clientY + 14 + "px"; }
    });
    cv.addEventListener("click", (e) => { const i = aim(e); if (i >= 0 && map.pins[i].spot) travelToId(map.pins[i].spot.id); });
  }
  const domSay = (t) => { domBuild(); dom.k.sub.textContent = t; };
  const domToast = (t) => { domBuild(); dom.k.toast.textContent = t; };
  function domTip(text) { domBuild(); dom.tip.hidden = !text; if (text) dom.tip.textContent = text; }
  // One page as DOM: the same rows as the headset panel.
  function domPage(def) {
    dom.menu.textContent = "";
    dom.menu.appendChild(el("h2", null, def.title));
    if (def.sub) dom.menu.appendChild(el("p", "lead", def.sub));
    const mk = (id, label, kind, pressed) => {
      const b = el("button", "btn" + (kind === "primary" ? " primary" : kind === "danger" ? " danger" : ""), String(label).toUpperCase());
      b.type = "button"; b.dataset.id = id;
      if (pressed != null) b.setAttribute("aria-pressed", pressed ? "true" : "false");
      b.addEventListener("click", () => act(id));
      return b;
    };
    for (const r of def.rows) {
      if (r.text != null) dom.menu.appendChild(el("p", r.small ? "small" : "", r.text));
      else if (r.cols) { const d = el("div", "fs-row"); for (const b of r.cols) d.appendChild(mk(b.id, b.label, b.kind)); dom.menu.appendChild(d); }
      else if (r.seg) {
        const d = el("div", "fs-seg"), g = el("div");
        d.appendChild(el("span", null, r.seg.label));
        for (const [val, lab] of r.seg.opts) g.appendChild(mk(r.seg.id + ":" + val, lab, "normal", String(r.seg.value) === val));
        d.appendChild(g); dom.menu.appendChild(d);
      }
    }
  }
  function domShow(name) {
    domBuild();
    if (name === "map") {
      // the map is not modal: the mouse must reach the canvas
      if (dom.menu.open) dom.menu.close();
      dom.map.hidden = false; domMapList();
      return;
    }
    dom.map.hidden = true;
    const def = pageDef(name);
    if (!def) return;
    domPage(def);
    dom.name = name;
    if (!dom.menu.open) { if (dom.menu.showModal) dom.menu.showModal(); else dom.menu.setAttribute("open", ""); }
    const first = dom.menu.querySelector("button.primary") || dom.menu.querySelector("button");
    if (first) first.focus({ preventScroll: true });
  }
  function domMapList() {
    domBuild();
    dom.map.textContent = "";
    dom.map.appendChild(el("h2", null, "City map"));
    dom.map.appendChild(el("p", null, "Click a pin, or pick a place. A green drop is a clog. A blue tick is a clean roof."));
    for (const p of map.pins) {
      if (!p.spot) continue;
      const b = el("button", "btn", p.name); b.type = "button"; b.dataset.id = "pin:" + p.spot.id;
      b.addEventListener("click", () => act("pin:" + p.spot.id));
      b.addEventListener("pointerenter", () => setPinHover(map.pins.indexOf(p)));
      b.addEventListener("pointerleave", () => setPinHover(-1));
      dom.map.appendChild(b);
    }
    const back = el("button", "btn", "Back"); back.type = "button"; back.dataset.id = "back";
    back.addEventListener("click", () => act("back"));
    dom.map.appendChild(back);
  }
  function domClose() {
    if (dom.menu && dom.menu.open) dom.menu.close();
    if (dom.map) dom.map.hidden = true;
    if (dom.tip) dom.tip.hidden = true;
  }
  // The HUD numbers, only when they change.
  function domUpdate(dt) {
    domBuild();
    readHead();
    const pg = prog || NOPROG, k = dom.k;
    if (dh.loon !== pg.loonies) { dh.loon = pg.loonies; k.loon.textContent = pg.loonies; }
    if (dh.bank !== pg.bank) { dh.bank = pg.bank; k.bank.textContent = "BANK " + pg.bank; }
    if (dh.clog !== pg.clogs) { dh.clog = pg.clogs; k.clog.textContent = pg.clogs; }
    const hs = pg.king === "awake" ? pg.hearts : -1;
    if (dh.hearts !== hs) {
      dh.hearts = hs; k.heartBox.hidden = hs < 0; k.heartBox.textContent = "";
      for (let i = 0; i < GAME.king.hearts; i++) k.heartBox.appendChild(el("span", "fs-heart" + (i < hs ? "" : " off"), "♥"));
    }
    const tr = pg.trial ? pg.trial.time.toFixed(1) : "";
    if (dh.trial !== tr) { dh.trial = tr; k.trialBox.hidden = !tr; if (tr) k.trial.textContent = tr; }
    const tg = nearestTarget();
    k.compassBox.hidden = !tg;
    if (tg && Pl) {
      const dx = tg.x - Pl.pos.x, dz = tg.z - Pl.pos.z, d = Math.sqrt(dx * dx + dz * dz), a = Math.round(wrap(Math.atan2(-dx, -dz) - HD.yaw) / DEG / 3) * 3;
      if (a !== dh.ang) { dh.ang = a; k.arrow.style.transform = "rotate(" + -a + "deg)"; }
      const dd = Math.round(d / 5) * 5;
      if (dd !== dh.dist) { dh.dist = dd; k.dist.textContent = dd >= 1000 ? (dd / 1000).toFixed(1) + " km" : dd + " m"; }
    }
    k.sub.classList.toggle("on", sub.a > 0.02);
    if (sub.a > 0.02 && k.sub.textContent !== sub.text) k.sub.textContent = sub.text;
    k.toast.classList.toggle("on", toast.a > 0.02);
    if (toast.a > 0.02 && k.toast.textContent !== toast.text) k.toast.textContent = toast.text;
    if (map.on) { map.root.updateMatrixWorld(true); tipPlace(); }
  }

  /* ---------------- the frame ---------------- */
  function readHead() {
    HD.pos.copy(inp.head.pos);
    V1.set(0, 0, -1).applyQuaternion(inp.head.quat);
    HD.yaw = Math.atan2(-V1.x, -V1.z);
  }
  function update(dt, input, P, progress) {
    frameN++;
    inp = input; Pl = P; prog = progress || NOPROG;
    blocked[0] = blocked[1] = false;
    fadeStep(dt);
    textStep(dt);
    emit(fns.frame, dt);
    if (input.mode === "desktop") { stanceStep(dt); domUpdate(dt); return; }
    readHead();
    followRig();
    stanceStep(dt);
    textPlace(dt);
    // the dim behind the pause menu (VR only: in mixed reality the world is hidden already)
    const wantDim = paused && !isAR() && modal !== "map" ? 0.5 : 0;
    dim += Math.sign(wantDim - dim) * Math.min(Math.abs(wantDim - dim), dt * 3);
    dimMat.opacity = dim; dimMesh.visible = dim > 0.002;
    if (modal && cur) { placeModal(false, dt); modalTouch(dt); if (map.on) tipPlace(); }
    updateHud(dt);
    if (laser.mesh && laser.until !== frameN) laserOff();
  }

  /* ---------------- the session ends ---------------- */
  if (xr && xr.onEnd) {
    xr.onEnd(() => {
      paused = false;
      if (map.on) closeMap();
      hideModal();
      if (stance.on) { stance.on = false; const r = stance.resolve; stance.resolve = null; stance.promise = null; if (r) r("standing"); }
      fade.v = fade.to = 0; if (fade.resolve) { const r = fade.resolve; fade.resolve = null; r(); }
      fadeApply();
      if (hud.p) hud.p.mesh.visible = false;
      hud.a = 0; hud.on = false; hud.init = false;
      if (sub.p) sub.p.mesh.visible = false;
      if (toast.p) toast.p.mesh.visible = false;
      sub.t = 0; sub.a = 0; toast.t = 0; toast.a = 0; toasts.length = 0;
      dimMesh.visible = false; dim = 0;
      laserOff();
      inp = null;
    });
  }

  /* ---------------- the API (spec §10) ---------------- */
  const U = {
    get paused() { return paused; },
    get hudVisible() { return hud.a > 0.5; },
    get hudShown() { return hud.shownFor; },
    update,
    blocking: (side) => blocked[sideOf(side)],
    say, sayLine, toast: toastSay,
    fade(to, secs = 0.3, look = "black") {
      fade.look = look === "room" || look === "fog" ? look : "black";
      // a newer fade takes over: the older one is done at once, so nothing waits on it for ever
      if (fade.resolve) { const r = fade.resolve; fade.resolve = null; r(); }
      to = clamp(+to || 0, 0, 1);
      if (!(secs > 0) || fade.v === to) { fade.v = fade.to = to; fadeApply(); return Promise.resolve(); }
      fade.to = to; fade.rate = Math.abs(to - fade.v) / secs;
      fadeApply();
      return new Promise((res) => { fade.resolve = res; });
    },
    openPause, closePause, openMap,
    onTravel: (fn) => fns.travel.push(fn),
    onSkipTutorial: (fn) => fns.skip.push(fn),
    onExit: (fn) => fns.exit.push(fn),
    onRestart: (fn) => fns.restart.push(fn),
    askStance, showCredits,
    // for the portal: a per-frame hook, and the Skip button (on the wrist and in the pause menu) while the opening may be skipped
    onFrame: (fn) => fns.frame.push(fn),
    setSkip(fn) { skipFn = typeof fn === "function" ? fn : null; if (modal === "pause") showPage("pause"); },
    // test hooks (G.test.ui / uiPress)
    info() {
      const buttons = [];
      const add = (p, prefix) => { for (const r of p.rects) { rectWorld(p, r, V3); buttons.push({ id: r.id, label: r.label, local: toTracking(V3), world: round4(V3) }); } void prefix; };
      if (cur && cur.mesh.visible) add(cur);
      if (hud.p && hud.p.mesh.visible) add(hud.p);
      if (map.on && map.pins) {
        map.pinRoot.updateMatrixWorld(true);
        for (const p of map.pins) { if (!p.spot) continue; p.sprite.getWorldPosition(V3); buttons.push({ id: "pin:" + p.spot.id, label: p.name, local: toTracking(V3), world: round4(V3) }); }
      }
      if (dom.built && !dom.menu.hidden) for (const b of dom.menu.querySelectorAll("button[data-id]")) buttons.push({ id: b.dataset.id, label: b.textContent, local: null, world: null });
      if (dom.built && !dom.map.hidden) for (const b of dom.map.querySelectorAll("button[data-id]")) buttons.push({ id: b.dataset.id, label: b.textContent, local: null, world: null });
      const sp = sub.p && sub.p.mesh.visible ? round4(sub.p.mesh.position) : null;
      return {
        paused, panel: modal, buttons, dom: isDesktopNow(),
        hud: { visible: hud.a > 0.5, alpha: hud.a, world: hud.p && hud.p.mesh.visible ? round4(hud.p.mesh.position) : null, local: hud.p && hud.p.mesh.visible ? toTracking(hud.p.mesh.position) : null, shownFor: hud.shownFor, hover: hud.hover },
        subtitle: { text: sub.text, active: sub.t > 0, alpha: sub.a, world: sp, yaw: follow.yaw },
        toast: { text: toast.text, active: toast.t > 0 },
        fade: { value: fade.v, target: fade.to, look: fadeMesh.material === fadeMats.room ? "room" : fadeMesh.material === fadeMats.fog ? "fog" : "black", visible: fadeMesh.visible },
        map: { open: map.on, pins: map.pins.length, hover: map.hover, table: map.table, size: map.size, world: map.root ? round4(map.root.getWorldPosition(V3)) : null, local: map.root ? round4(map.root.position) : null },
        stance: { on: stance.on, pre: stance.pre, left: stance.t },
        laser: { visible: !!(laser.mesh && laser.mesh.visible), side: laser.side },
        skip: canSkip(), dim,
      };
    },
    press(id) {
      if (id === "restart") { emit(fns.restart); return; }
      if (id.startsWith("hud:")) { if (!inp) return; activateHud(id); return; }
      act(id);
    },
  };
  return U;
}
