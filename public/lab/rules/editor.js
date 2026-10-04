// House Rules: the editor. You are the Cottage: paint a layer of Down the Drain, test it in the game, and share it
// once you reach a drain in it yourself. layer.js turns the layer into ground and into a link; sand.js runs the
// game's own sand, water, fire and propane tank rules for the preview ("Settle"), which your brush can poke.
// A link with #L= (a friend's "Remix this layer") opens that layer here.
import * as Layer from "./layer.js";
import { makeSand, MATS, NMAT, THEMES as LOOKS } from "./sand.js";
import { labBar, startCard, toast, shareLink, onUi } from "../kit/start.js";
import { startLoop, fitCanvas } from "../kit/loop.js";
import { Sfx, tone, hiss } from "../kit/sfx.js";
import { stats } from "../kit/stats.js";

const { W, H, TOP, PAINTS, SIZES, CRITTERS, THEMES, LIMIT } = Layer;
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const S = stats("rules");
const DRAFT = "lab.rules.draft", SEEN = "lab.rules.seen";
const CRITTER_COL = ["#a8a298", "#f2c230", "#e8ecf0", "#6a5a8a", "#f2efe8", "#8a5a36", "#8a7a66"];
const hex = (c) => "#" + c.toString(16).padStart(6, "0");

/* ---------------- the layer ---------------- */
const fresh = () => Layer.blank((Math.random() * 2 ** 32) >>> 0);
function loadDraft() {
  try {
    const L = JSON.parse(localStorage.getItem(DRAFT) || "null");
    if (L && Array.isArray(L.strokes) && Array.isArray(L.drains)) return Object.assign(Layer.blank(L.seed), L);
  } catch (e) { /* no draft */ }
  return null;
}
let L = loadDraft() || fresh();
let mat = Layer.build(L);
const history = [];
function remember() { history.push(JSON.stringify(L)); if (history.length > 200) history.shift(); }
function changed(rebuild) {
  if (rebuild) mat = Layer.build(L);
  stopSettle();
  dirty = true;
  try { localStorage.setItem(DRAFT, JSON.stringify(L)); } catch (e) { /* storage off */ }
  relink();
}
function undo() {
  if (!history.length) { toast("Nothing to undo."); return; }
  L = JSON.parse(history.pop());
  $("#name").value = L.name;
  changed(true);
  paintChips();
  Sfx.play(sndUndo);
}

/* ---------------- the link, and whether you may share it ---------------- */
let code = "", linking = 0, carried = Promise.resolve();
async function relink() {
  const n = ++linking, c = await Layer.encode(L);
  // a new name gives a new code: wait until the clear has gone over to it (see the name box below)
  await carried;
  if (n !== linking) return;
  code = c;
  meter();
}
// "4 tries: 3 lava, 1 moose." from your test runs of this exact layer
function triesLine(t) {
  if (!t || !t.n) return "";
  const by = Object.entries(t.by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`).join(", ");
  return `${t.n} ${t.n === 1 ? "try" : "tries"}${by ? ": " + by : ""}.`;
}
function meter() {
  const full = code.length > LIMIT, cleared = full ? null : Layer.clearOf(code), tries = full ? "" : triesLine(Layer.triesOf(code));
  $("#size").textContent = `${code.length.toLocaleString("en-US")} / ${LIMIT.toLocaleString("en-US")}`;
  $("#size").title = "How long the link is, in characters";
  $("#bar").style.width = Math.min(100, (100 * code.length) / LIMIT) + "%";
  $("#meter").classList.toggle("full", full);
  $("#test").disabled = full;
  $("#share").disabled = cleared == null;
  $("#status").textContent = full ? "The link is too long. Undo some strokes."
    : cleared != null ? `${tries ? tries + " " : ""}You cleared this layer in ${Layer.fmtSecs(cleared)}. Share it with the crew.`
    : tries ? `${tries} Reach a drain, and Share opens.`
    : "Test it and reach a drain. Then you can share it.";
}
// back from a test run (the page may come back from the cache): a new clear unlocks Share
addEventListener("pageshow", () => { if (code) meter(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && code) meter(); });

/* ---------------- the preview: the game's rules, running ---------------- */
// The preview runs at twice the game's speed. A tank that blows lights the layer, booms, shakes the view and slows the
// rules for a moment, so you see the blast go.
const heard = [];
const sand = makeSand(W, H, (what, big) => {
  heard.push(what);
  if (heard.length > 200) heard.splice(0, 100);
  if (what === "boom") { Sfx.play(sndBoom, big); flashT = 0.3; slowT = 0.7; }
  else Sfx.play(sndFuse);
});
let settling = false, flashT = 0, slowT = 0;
function startSettle() { sand.load(mat, L.tanks); settling = true; $("#settle").textContent = "Stop"; $("#settle").setAttribute("aria-pressed", "true"); S.act("settle"); Sfx.play(sndSettle, true); }
function stopSettle() { if (!settling) return; settling = false; dirty = true; flashT = slowT = 0; $("#settle").textContent = "Settle"; $("#settle").setAttribute("aria-pressed", "false"); Sfx.play(sndSettle, false); }

/* ---------------- tools ---------------- */
let tool = "paint", paint = 0, size = 1, critterK = 0;
function setTool(t, p) {
  tool = t;
  if (p != null) paint = p;
  for (const b of document.querySelectorAll("#paints button")) b.setAttribute("aria-pressed", String(tool === "paint" && +b.dataset.i === paint));
  for (const b of document.querySelectorAll("[data-tool]")) b.setAttribute("aria-pressed", String(tool === b.dataset.tool));
  $("#critter").classList.toggle("on", tool === "critter");
}
function setSize(i) { size = clamp(i, 0, SIZES.length - 1); for (const b of document.querySelectorAll("#sizes button")) b.setAttribute("aria-pressed", String(+b.dataset.i === size)); }
// a name too long for a chip on a phone, and the short one it shows there
const SHORT = { gas: "Gas" };
function paintChips() {
  const box = $("#paints");
  box.innerHTML = "";
  PAINTS.forEach((P, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "paint"; b.dataset.i = i; b.dataset.p = P.id;
    b.innerHTML = SHORT[P.id] ? '<i></i><span class="long"></span><span class="short"></span>' : "<i></i><span></span>";
    b.querySelector("span").textContent = P.name;
    if (SHORT[P.id]) b.querySelector(".short").textContent = SHORT[P.id];
    if (P.m) b.querySelector("i").style.background = hex(colsOf(P.m)[0]);
    b.title = `${P.name} (key ${i < 9 ? i + 1 : i === 9 ? 0 : "-"})`;
    b.onclick = () => setTool("paint", i);
    box.append(b);
  });
  setTool(tool);
}
{
  const sel = $("#critter");
  CRITTERS.forEach((c, i) => { const o = document.createElement("option"); o.value = i; o.textContent = c.name; sel.append(o); });
  // picking a critter (or just opening the list) makes taps place that critter
  sel.onchange = sel.onclick = () => { critterK = +sel.value; setTool("critter"); };
  for (const b of document.querySelectorAll("[data-tool]")) b.onclick = () => setTool(b.dataset.tool);
  const sz = $("#sizes");
  SIZES.forEach((r, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.i = i; b.title = `Brush ${["small", "medium", "large", "huge"][i]} ([ and ])`;
    b.innerHTML = `<b style="width:${4 + i * 4}px;height:${4 + i * 4}px"></b>`;
    b.onclick = () => setSize(i);
    sz.append(b);
  });
}
// the middle of a critter or a tank, where its marker sits
const midOf = (q) => (q.k == null ? [q.x, q.y - 4] : ((b) => [b.x + b.w / 2, b.y + b.h / 2])(Layer.critterBox(q)));
// the thing closest to (x, y) within d layer pixels, or -1
function nearest(list, x, y, d) {
  let k = -1;
  list.forEach((q, i) => { const [qx, qy] = midOf(q), e = Math.hypot(qx - x, qy - y); if (e < d) { d = e; k = i; } });
  return k;
}
// a finger is not a pixel: a tap within 22 screen pixels of a thing takes it away
const reach = () => Math.max(9, 22 / view.s);
// a tap with a placing tool
function place(x, y) {
  if (y < TOP) return;
  remember();
  if (tool === "critter") {
    const k = nearest(L.critters, x, y, reach());
    if (k >= 0) { L.critters.splice(k, 1); changed(true); Sfx.play(sndUndo); return; }
    L.critters.push({ k: critterK, x: clamp(x, 8, W - 9), y: clamp(y, TOP + 14, H - 16) });
    Layer.finish(L, mat);
    S.act("critter");
    Sfx.play(sndCritter);
  } else if (tool === "tank") {
    const k = nearest(L.tanks, x, y, reach());
    if (k >= 0) { L.tanks.splice(k, 1); changed(true); Sfx.play(sndUndo); return; }
    L.tanks.push({ x: clamp(x, 5, W - 6), y: clamp(y, TOP + 8, H - 16) });
    Layer.finish(L, mat);
    S.act("tank");
    Sfx.play(sndTank);
  } else if (tool === "drain") {
    const d = L.drains, k = Math.abs(d[0] - x) < Math.abs(d[1] - x) ? 0 : 1, o = d[1 - k];
    let nx = clamp(x, 34, W - 34);
    if (Math.abs(nx - o) < 60) nx = clamp(o + (nx < o ? -60 : 60), 34, W - 34);
    if (Math.abs(nx - o) < 60) { history.pop(); toast("The drains need room between them."); return; }
    d[k] = nx;
    changed(true);
    Sfx.play(sndTank);
    return;
  }
  changed(false);
}
// a stroke: points land where the finger goes, spaced by the brush, and paint as they land
let stroke = null, poked = false;
function strokeStart(x, y) {
  if (settling) {
    // Settle runs: the brush goes into the preview, and the layer stays as you painted it. The copy of the preview
    // takes the touch back if a second finger makes it a pinch.
    stroke = { p: paint, r: size, pts: [[x, y]], preview: sand.snapshot() };
    Layer.paintStroke(null, { p: paint, r: size, pts: [[x, y]] }, sand.put);
    return;
  }
  remember();
  stroke = { p: paint, r: size, pts: [[x, y]] };
  Layer.paintStroke(mat, { p: paint, r: size, pts: [[x, y]] });
  dirty = true;
}
function strokeMove(x, y) {
  const last = stroke.pts[stroke.pts.length - 1];
  if (Math.hypot(x - last[0], y - last[1]) < Math.max(2, SIZES[size] * 0.6)) return;
  if (stroke.preview) { Layer.paintStroke(null, { p: stroke.p, r: stroke.r, pts: [last, [x, y]] }, sand.put); stroke.pts = [[x, y]]; return; }
  stroke.pts.push([x, y]);
  Layer.paintStroke(mat, { p: stroke.p, r: stroke.r, pts: [last, [x, y]] });
  dirty = true;
  if (stroke.pts.length >= 590) strokeEnd();
}
function strokeEnd() {
  if (!stroke) return;
  const s = stroke;
  stroke = null;
  Sfx.play(sndStroke, PAINTS[s.p].id);
  if (s.preview) {
    S.act("poke");
    if (!poked) { poked = true; toast("The brush changes the preview only. Stop to paint the layer.", 2600); }
    return;
  }
  L.strokes.push(s);
  Layer.finish(L, mat);
  S.act("stroke");
  changed(false);
}
function strokeCancel() {
  if (!stroke) return;
  const s = stroke;
  stroke = null;
  if (s.preview) { sand.restore(s.preview); return; }
  history.pop();
  changed(true);
}

/* ---------------- the view: fit, zoom, pan ---------------- */
const canvas = $("#view"), g = canvas.getContext("2d");
let CW = 1, CH = 1, DPR = 1;
const view = { s: 0, ox: 0, oy: 0 };
let area = { x: 0, y: 0, w: 1, h: 1 };
function measure() {
  const tools = $("#tools").getBoundingClientRect();
  const top = 50, bottom = innerWidth >= 900 ? innerHeight - tools.top + 10 : tools.height + 6;
  area = { x: 8, y: top, w: innerWidth - 16, h: Math.max(80, innerHeight - top - bottom) };
  const fitS = Math.min(area.w / W, area.h / H);
  if (!view.s || view.s < fitS * 1.001 || view.fit) { view.s = fitS; view.fit = true; }
  pin();
}
// keep the layer on screen: centred when it is smaller than the space, else never past its edges
function pin() {
  const w = W * view.s, h = H * view.s;
  view.ox = w <= area.w ? area.x + (area.w - w) / 2 : clamp(view.ox, area.x + area.w - w, area.x);
  view.oy = h <= area.h ? area.y + (area.h - h) / 2 : clamp(view.oy, area.y + area.h - h, area.y);
}
function zoomAt(sx, sy, k) {
  const fitS = Math.min(area.w / W, area.h / H), s = clamp(view.s * k, fitS, 12);
  const wx = (sx - view.ox) / view.s, wy = (sy - view.oy) / view.s;
  view.s = s; view.fit = s <= fitS * 1.001;
  view.ox = sx - wx * s; view.oy = sy - wy * s;
  pin();
}
const toWorld = (sx, sy) => [Math.round((sx - view.ox) / view.s), Math.round((sy - view.oy) / view.s)];
const toScreen = (x, y) => [view.ox + x * view.s, view.oy + y * view.s];
fitCanvas(canvas, (w, h, r) => { CW = w; CH = h; DPR = r; measure(); });
addEventListener("resize", measure);
new ResizeObserver(measure).observe($("#tools"));

/* ---------------- fingers, mouse, keys ---------------- */
const ptrs = new Map();
let gest = null, hover = null, spaceHeld = false;
const inside = (x, y) => x >= 2 && x < W - 2 && y >= TOP && y < H - 2;
canvas.addEventListener("pointerdown", (e) => {
  if (onUi(e)) return;
  e.preventDefault();
  Sfx.init();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) {
    // a second finger: pinch and pan. A stroke the first finger began is taken back.
    strokeCancel();
    const [a, b] = [...ptrs.values()];
    gest = { kind: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    return;
  }
  if (ptrs.size > 2) return;
  if (e.button === 1 || e.button === 2 || spaceHeld) { gest = { kind: "pan", x: e.clientX, y: e.clientY }; return; }
  const [x, y] = toWorld(e.clientX, e.clientY);
  if (tool === "paint") {
    if (!inside(x, y) && y < TOP) { gest = null; return; }
    strokeStart(clamp(x, 2, W - 3), clamp(y, TOP, H - 3));
    gest = { kind: "paint" };
  } else { gest = { kind: "tap", x: e.clientX, y: e.clientY }; }
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") hover = toWorld(e.clientX, e.clientY);
  if (!ptrs.has(e.pointerId)) return;
  const p = ptrs.get(e.pointerId);
  p.x = e.clientX; p.y = e.clientY;
  if (!gest) return;
  if (gest.kind === "pinch" && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    view.ox += mx - gest.mx; view.oy += my - gest.my;
    zoomAt(mx, my, d / gest.d);
    gest.d = d; gest.mx = mx; gest.my = my;
  } else if (gest.kind === "pan") {
    view.ox += e.clientX - gest.x; view.oy += e.clientY - gest.y;
    gest.x = e.clientX; gest.y = e.clientY;
    pin();
  } else if (gest.kind === "paint" && stroke) {
    const [x, y] = toWorld(e.clientX, e.clientY);
    strokeMove(clamp(x, 2, W - 3), clamp(y, TOP, H - 3));
  }
});
function lift(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (gest && gest.kind === "paint") strokeEnd();
  else if (gest && gest.kind === "tap" && Math.hypot(e.clientX - gest.x, e.clientY - gest.y) < 12) { const [x, y] = toWorld(e.clientX, e.clientY); place(x, y); }
  if (ptrs.size === 0) gest = null;
  else if (gest && gest.kind === "pinch") gest = { kind: "pan", x: [...ptrs.values()][0].x, y: [...ptrs.values()][0].y };
}
addEventListener("pointerup", lift);
addEventListener("pointercancel", (e) => { if (gest && gest.kind === "paint") strokeCancel(); ptrs.delete(e.pointerId); if (!ptrs.size) gest = null; });
canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.pow(1.0015, -e.deltaY)); }, { passive: false });
addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
  const k = e.key;
  if ((k === "z" || k === "Z") && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (k === " ") { e.preventDefault(); if (!e.repeat) spaceHeld = true; }
  else if (/^[0-9-]$/.test(k)) setTool("paint", k === "0" ? 9 : k === "-" ? 10 : +k - 1);
  else if (k === "[") setSize(size - 1);
  else if (k === "]") setSize(size + 1);
  else if (k === "c") setTool("critter");
  else if (k === "t") setTool("tank");
  else if (k === "d") setTool("drain");
  else if (k === "s") settleToggle();
  else if (k === "=" || k === "+") zoomAt(innerWidth / 2, area.y + area.h / 2, 1.25);
  else if (k === "_") zoomAt(innerWidth / 2, area.y + area.h / 2, 0.8);
});
addEventListener("keyup", (e) => { if (e.key === " ") spaceHeld = false; });

/* ---------------- buttons ---------------- */
function settleToggle() { if (settling) stopSettle(); else startSettle(); }
$("#undo").onclick = undo;
$("#settle").onclick = settleToggle;
$("#look").onclick = () => { remember(); L.theme = (L.theme + 1) % THEMES.length; changed(true); paintChips(); toast(Layer.THEME_NAMES[L.theme], 1100); };
$("#fresh").onclick = () => {
  if (L.strokes.length + L.critters.length + L.tanks.length && !confirm("Start a new layer? The one you have now goes away.")) return;
  remember();
  const n = fresh();
  n.theme = L.theme;
  L = n;
  $("#name").value = "";
  changed(true);
};
$("#name").addEventListener("input", (e) => {
  // 24 bytes of UTF-8, the most a link keeps
  let v = Array.from(e.target.value);
  while (new TextEncoder().encode(v.join("")).length > 24) v.pop();
  if (L.name === v.join("")) return;
  // The name is part of the code, but the ground stays the same: your clear and your tries go to the new code.
  // encode reads the layer at once, so each pair is this layer before and after this one change of name.
  const from = Layer.encode(L);
  L.name = v.join("");
  const to = Layer.encode(L);
  carried = carried.then(async () => Layer.carry(await from, await to)).catch(() => {});
  changed(false);
});
$("#test").onclick = async () => {
  const c = await Layer.encode(L);
  if (c.length > LIMIT) { toast("The link is too long. Undo some strokes."); return; }
  try { localStorage.setItem(DRAFT, JSON.stringify(L)); } catch (e) { /* storage off */ }
  S.act("test");
  S.stop();
  location.href = "/fall/#L=" + c + "&edit=1";
};
$("#share").onclick = async () => {
  const secs = Layer.clearOf(code);
  if (secs == null) return;
  const url = `${location.origin}/fall/#L=${code}&c=${Layer.stampFor(code, secs)}`;
  S.act("share");
  const r = await shareLink(url, `${L.name || "A layer"}: I made this Down the Drain layer and cleared it in ${Layer.fmtSecs(secs)}. Can you?`);
  if (r) toast(r);
};

/* ---------------- sounds ---------------- */
function sndStroke(e, t, id) {
  const wet = id === "water" || id === "oil" || id === "acid" || id === "lava";
  hiss(e, t, { type: "bandpass", f: wet ? 900 : 2400, f2: wet ? 500 : 1400, q: 0.8, dur: 0.16, peak: 0.07 });
}
function sndCritter(e, t) { tone(e, t, { f: 900, f2: 1400, dur: 0.08, peak: 0.07, wave: "triangle" }); }
function sndTank(e, t) { tone(e, t, { f: 220, f2: 180, dur: 0.1, peak: 0.1 }); }
function sndUndo(e, t) { tone(e, t, { f: 600, f2: 400, dur: 0.06, peak: 0.05 }); }
// Settle on: a rising trickle. Stop: a falling one.
function sndSettle(e, t, on) {
  hiss(e, t, { type: "bandpass", f: on ? 500 : 1400, f2: on ? 1400 : 500, q: 1.2, dur: 0.22, peak: 0.05 });
  tone(e, t, { f: on ? 330 : 495, f2: on ? 495 : 330, dur: 0.14, peak: 0.04, wave: "triangle" });
}
// a tank's fuse: a hiss that climbs for the 1.1 game seconds it burns (half that in the preview)
function sndFuse(e, t) { hiss(e, t, { type: "highpass", f: 2600, f2: 6200, q: 0.7, dur: 0.55, sweep: 0.55, att: 0.02, peak: 0.08 }); }
// the blast: a deep thud under a roar of noise
function sndBoom(e, t, big) {
  hiss(e, t, { type: "lowpass", f: 1600, f2: 140, q: 0.6, dur: big ? 0.9 : 0.55, att: 0.004, peak: 0.42, buf: e.brown, send: 0.3 });
  hiss(e, t, { type: "bandpass", f: 2400, f2: 600, q: 0.7, dur: 0.25, peak: 0.12 });
  tone(e, t, { f: 120, f2: 38, glide: 0.35, dur: 0.6, peak: 0.45 });
}

/* ---------------- drawing ---------------- */
const img = new ImageData(W, H), px = new Uint32Array(img.data.buffer);
const buf = document.createElement("canvas");
buf.width = W; buf.height = H;
const bg = buf.getContext("2d");
const shadeOf = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) shadeOf[i] = (Math.random() * 4) | 0;
const abgr = (c) => (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0;
const look = () => LOOKS[THEMES[L.theme]];
const colsOf = (m) => (m === 2 ? look().rock : m === 3 ? look().earth : MATS[m].cols);
let PAL = new Uint32Array(NMAT * 4), WALL = [0, 0], SKY = [], palFor = -1;
// the plain ground is drawn dim, so the tunnels and what you poured stand out
const GROUND = new Set([1, 2, 3, 5, 9]);
const dimc = (c, k) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
function palette() {
  if (palFor === L.theme) return;
  palFor = L.theme;
  for (let m = 0; m < NMAT; m++) { const c = colsOf(m); for (let s = 0; s < 4; s++) PAL[m * 4 + s] = abgr(GROUND.has(m) ? dimc(c[s % c.length], 0.85) : c[s % c.length]); }
  // open space is darker than any ground, so a tunnel reads as a hole
  WALL = look().bg.map((c) => abgr(dimc(c, 0.45)));
  SKY = [0x0a1026, 0x101a3a, 0x18264e, 0x223360].map(abgr);
}
let dirty = true;
function paintImage() {
  palette();
  const src = settling ? sand.mat : mat, sh = settling ? sand.shade : shadeOf;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = row + x, m = src[i];
      if (y < TOP) {
        // the sky over the cottage, the ground under the outhouse, and the hole in it (the game draws these)
        px[i] = y >= 31 && y > 1 && x > 1 && x < W - 2 && Math.abs(x - W / 2) > 4 ? PAL[3 * 4 + sh[i]] : SKY[y < 14 ? 0 : y < 24 ? 1 : 2];
        continue;
      }
      px[i] = m ? PAL[m * 4 + sh[i]] : WALL[((x >> 3) + (y >> 3)) & 1];
    }
  }
  // the outhouse, as a dark shape
  for (let y = 9; y < 31; y++) for (let x = W / 2 - 10; x <= W / 2 + 10; x++) if (Math.abs(x - W / 2) > 8 || y < 11) px[y * W + x] = abgr(0x5a3e26);
  bg.putImageData(img, 0, 0);
}
// the preview's clock: one game tick (1/60 s) per step, at twice the game's speed, and slower for a moment after a blast
function stepPreview() { if (settling) { sand.play(1 / 60); dirty = true; } }
const lerpc = (a, b, k) => "#" + [16, 8, 0].map((s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k).toString(16).padStart(2, "0")).join("");
function draw(alpha, dt) {
  flashT = Math.max(0, flashT - dt); slowT = Math.max(0, slowT - dt);
  if (dirty) { paintImage(); dirty = false; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#07090d";
  g.fillRect(0, 0, CW, CH);
  // a blast shakes the view (the preview's own camera shake, in screen pixels)
  const sh = settling ? Math.min(6, sand.cam.shake) : 0;
  sand.cam.shake *= 0.86;
  const ox = view.ox + (Math.random() - 0.5) * sh, oy = view.oy + (Math.random() - 0.5) * sh;
  g.setTransform(DPR * view.s, 0, 0, DPR * view.s, DPR * ox, DPR * oy);
  g.imageSmoothingEnabled = false;
  g.drawImage(buf, 0, 0);
  const u = 1 / view.s;   // one screen pixel, in layer pixels
  const big = 9 * u;      // the least size of a marker: 9 screen pixels, so a finger can find it
  // the start, the drains, the critters, the tanks
  {
    const w = Math.max(12, big * 1.3), h = Math.max(8, big);
    g.fillStyle = "#79c85a";
    g.beginPath(); g.moveTo(W / 2 - w / 2, TOP - 8 - h); g.lineTo(W / 2 + w / 2, TOP - 8 - h); g.lineTo(W / 2, TOP - 8); g.fill();
  }
  g.lineWidth = Math.max(1, 2 * u);
  for (const x of L.drains) {
    g.strokeStyle = "#e6c35c";
    g.beginPath(); g.ellipse(x, H - 21, Math.max(9, big * 0.8), Math.max(5, big * 0.45), 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(x, H - 21, 26, 26 * 0.5, 0, Math.PI, Math.PI * 2); g.setLineDash([4 * u, 4 * u]); g.stroke(); g.setLineDash([]);
  }
  for (const c of L.critters) {
    // its own size when you are close; a marker you can see and tap when you are far
    const b = Layer.critterBox(c), w = Math.max(b.w, big), h = Math.max(b.h, big), x = b.x + (b.w - w) / 2, y = b.y + (b.h - h) / 2;
    if (w > b.w || h > b.h) { g.fillStyle = "rgba(243,236,216,0.85)"; g.fillRect(x - u, y - u, w + 2 * u, h + 2 * u); }
    g.fillStyle = CRITTER_COL[c.k];
    g.fillRect(x, y, w, h);
    g.strokeStyle = "rgba(0,0,0,0.8)"; g.lineWidth = Math.max(0.5, u);
    g.strokeRect(x, y, w, h);
    const e = Math.max(1, 2 * u);
    g.fillStyle = "#e0553f";
    g.fillRect(x + (w > 6 ? w - e - Math.max(1, 1.5 * u) : 1), y + Math.max(1, 1.5 * u), e, e);
  }
  L.tanks.forEach((t, i) => {
    // in the preview, a tank warms from red to yellow as the heat builds, its fuse blinks, and a blown tank is gone
    const p = settling ? sand.props[i] : null;
    if (p && p.dead) return;
    const heat = p ? Math.min(1, (p.heat || 0) / 14) : 0, lit = p && p.fuse > 0 && ((performance.now() / 80) | 0) % 2 === 0;
    const col = lit ? "#fff6d0" : lerpc(0xd8302c, 0xffd040, heat);
    if (p && p.fuse > 0) {
      // the warning: a ring closes in on the tank while its fuse burns
      const k = Math.max(0, 1 - p.fuse / 1.1);
      g.strokeStyle = `rgba(255,214,90,${(0.55 + 0.45 * k).toFixed(2)})`; g.lineWidth = Math.max(1, 2 * u);
      g.beginPath(); g.arc(t.x, t.y - 4, Math.max(10, big * 1.2) * (2 - k), 0, Math.PI * 2); g.stroke();
    }
    if (big <= 7) { g.fillStyle = col; g.fillRect(t.x - 2, t.y - 5, 5, 1); return; }
    const w = big * 0.75, h = big * 1.1, x = t.x + 0.5 - w / 2, y = t.y - h;
    g.fillStyle = "rgba(243,236,216,0.85)"; g.fillRect(x - u, y - u, w + 2 * u, h + 2 * u);
    g.fillStyle = col; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,0.75)"; g.fillRect(x, y + h * 0.3, w, Math.max(1, u));
  });
  if (settling) {
    // the preview's sparks, the ground a blast throws, and the blast's flash
    for (const f of sand.fx) { g.fillStyle = "#" + f.c.toString(16).padStart(6, "0"); g.fillRect(f.x - u, f.y - u, Math.max(1, 2 * u), Math.max(1, 2 * u)); }
    for (const d of sand.debris) { g.fillStyle = "#" + colsOf(d.m)[0].toString(16).padStart(6, "0"); g.fillRect(d.x - 0.5, d.y - 0.5, Math.max(1.5, 1.5 * u), Math.max(1.5, 1.5 * u)); }
    g.globalCompositeOperation = "lighter";
    for (const f of sand.flashes) {
      const k = Math.min(1, f.t / 0.25), r = Math.max(f.r, 14 * u), gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      gr.addColorStop(0, `rgba(255,244,210,${0.95 * k})`); gr.addColorStop(0.4, `rgba(255,170,70,${0.6 * k})`); gr.addColorStop(1, "rgba(255,120,40,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = "source-over";
  }
  // labels once you zoom in far enough to read them
  if (view.s >= 2.5) {
    g.font = `600 ${11 * u}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.fillStyle = "rgba(243,236,216,0.9)";
    for (const c of L.critters) { const b = Layer.critterBox(c); g.fillText(CRITTERS[c.k].name, c.x, b.y - 3 * u); }
    for (const x of L.drains) g.fillText("Drain", x, H - 30);
    g.fillText("Start", W / 2, TOP - 20);
  }
  // the brush under a mouse
  if (hover && tool === "paint" && !ptrs.size) {
    g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = u;
    g.beginPath(); g.arc(hover[0], hover[1], SIZES[size], 0, Math.PI * 2); g.stroke();
  }
  // a blast lights the whole layer for a moment
  if (flashT > 0) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = `rgba(255,232,180,${flashT.toFixed(3)})`;
    g.fillRect(DPR * ox, DPR * oy, DPR * W * view.s, DPR * H * view.s);
  }
}
startLoop({ step: stepPreview, draw, h: 1 / 120, maxSteps: 4, scale: () => (slowT > 0 ? 0.3 : 1) });

/* ---------------- a layer from a link: remix it ---------------- */
// /lab/rules/#L=<code> (the friend's "Remix this layer") opens that layer here, so you can add your trap and send it
// back. Undo brings back the layer you had.
async function fromLink() {
  const c = new URLSearchParams(location.hash.slice(1)).get("L");
  if (!c) return false;
  window.history.replaceState(null, "", location.pathname + location.search);
  const got = await Layer.decode(c);
  if (!got) { toast("That link is broken. Ask its maker to send it again.", 2600); return false; }
  const mine = L.strokes.length + L.critters.length + L.tanks.length > 0 && JSON.stringify(L) !== JSON.stringify(got);
  if (mine && !confirm("Open the layer from the link? The layer you have now goes away. Undo brings it back.")) return false;
  remember();
  L = Object.assign(Layer.blank(got.seed), got);
  $("#name").value = L.name;
  changed(true);
  paintChips();
  S.act("remix");
  return true;
}

/* ---------------- start ---------------- */
labBar();
paintChips();
setSize(1);
setTool("paint", 0);
$("#name").value = L.name;
relink();
let seen = false;
try { seen = !!localStorage.getItem(SEEN); } catch (e) { /* storage off */ }
const remixed = fromLink();
// After the start card: a remix says what to do with it, and a first visit on a touch screen says how to zoom.
// Later visits say nothing, so the toast never covers the layer when you come back from a test.
function hello(first) {
  remixed.then((ok) => {
    if (ok) toast("Add your trap and send it back", 2600);
    if (first && matchMedia("(pointer: coarse)").matches) setTimeout(() => toast("Pinch with two fingers to zoom in.", 2400), ok ? 2800 : 400);
  });
}
if (!seen) {
  startCard({
    title: "House Rules",
    pitch: "You are the Cottage. Paint a layer of Down the Drain, clear it yourself, then send it to the crew.",
    how: [
      "<b>Paint:</b> pick Dig to cut tunnels, or sand, water, lava and more, then draw on the layer.",
      "<b>Place:</b> critters, propane tanks, and the two drains at the bottom. Tap a thing again to take it away.",
      "<b>Zoom:</b> pinch with two fingers, or turn the mouse wheel. Hold Space and drag to move the view.",
      "<b>Settle</b> runs the game's own rules, and tanks blow. Drag while it runs to dig or pour into it.",
      "<b>Test it</b> opens your layer in Down the Drain. Reach a drain, and Share opens.",
    ],
    button: "Start painting",
    onStart: () => { try { localStorage.setItem(SEEN, "1"); } catch (e) { /* storage off */ } S.play(); hello(true); },
  });
} else { S.play(); hello(false); }
S.run();

// hooks for the tests in qa/lab/
window.QA = {
  get L() { return L; },
  get mat() { return mat; },
  get code() { return code; },
  get view() { return view; },
  get settling() { return settling; },
  get remixed() { return remixed; },
  heard, sand, toScreen, toWorld, setTool, setSize, undo, reach,
  relink: async () => { await relink(); return code; },
};
