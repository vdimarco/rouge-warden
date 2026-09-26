// The HUD, the dialog box, the paper map, and the menus.
import * as THREE from "three";
import { SIZE, TOWERS, ISLAND } from "./world.js";
import { WEAPONS } from "./player.js";

const $ = (s) => document.querySelector(s);
const HEART = (fill, gold) => {
  const f = Math.max(0, Math.min(4, fill));
  const col = gold ? "#ffd84a" : "#ff4a5a";
  // a heart filled in quarters, like the real thing
  const clip = ["", "M12 21 L12 2 L2 2 L2 12 Z", "M12 21 L12 2 L2 2 L2 21 Z", "M12 21 L12 2 L2 2 L2 21 L22 21 L22 12 L12 12 Z", ""][f];
  const path = "M12 21s-8-5.2-9.6-10.2C1.2 6.9 3.8 3 7.6 3c2 0 3.4 1 4.4 2.5C13 4 14.4 3 16.4 3c3.8 0 6.4 3.9 5.2 7.8C20 15.8 12 21 12 21z";
  const inner = f === 4 ? `<path d="${path}" fill="${col}"/>` : f === 0 ? "" : `<clipPath id="q${f}"><path d="${clip}"/></clipPath><path d="${path}" fill="${col}" clip-path="url(#q${f})"/>`;
  return `<svg viewBox="0 0 24 24"><path d="${path}" fill="rgba(0,0,0,.35)" stroke="#fff" stroke-width="1.6"/>${inner}</svg>`;
};
const WICO = { plunger: "🪠", paddle: "🛶", stick: "🏒", rod: "🎣", pan: "🍳", golden: "🏆" };

const TMPC = new THREE.Color();
export class UI {
  constructor(G) {
    this.G = G;
    this.modal = null;
    this.bannerT = 0; this.toastT = 0;
    this.last = {};
    this.stamArc = $("#stamArc");
    this.mini = $("#mini").getContext("2d");
    this.mapCv = $("#mapCv");
    document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => this.close(b.closest(".screen").id)));
    this.mapCv.addEventListener("pointerup", (e) => this.mapClick(e));
    $("#mini").addEventListener("click", () => G.openMap());
    $("#wslot").addEventListener("click", () => G.cycleWeapon(1));
    $("#fslot").addEventListener("click", () => G.eat());
    $("#dialog").addEventListener("pointerup", () => this.advance());
  }
  show(id) { $("#" + id).hidden = false; }
  hide(id) { $("#" + id).hidden = true; }
  close(id) { this.hide(id); if (this.modal === id) this.modal = null; if (id === "map" || id === "help" || id === "pause") this.G.resume(); }
  open(id) { this.show(id); this.modal = id; }

  hud() {
    const G = this.G, P = G.player;
    const key = P.hp + "/" + P.maxHp + "/" + P.bonusHp;
    if (key !== this.last.hearts) {
      this.last.hearts = key;
      let h = "";
      for (let k = 0; k < P.maxHp / 4; k++) h += HEART(P.hp - k * 4);
      for (let k = 0; k < Math.ceil(P.bonusHp / 4); k++) h += HEART(P.bonusHp - k * 4, true);
      $("#hearts").innerHTML = h;
    }
    const w = G.inv.weapons[G.inv.cur];
    const wk = w.id + w.dur;
    if (wk !== this.last.w) { this.last.w = wk; $("#wico").textContent = WICO[w.id]; $("#wname").textContent = WEAPONS[w.id].name; $("#wdur").style.width = w.dur === Infinity ? "100%" : Math.max(0, (w.dur / WEAPONS[w.id].dur) * 100) + "%"; $("#wdur").style.background = w.dur !== Infinity && w.dur / WEAPONS[w.id].dur < 0.25 ? "#e0453a" : ""; }
    const f = G.foodCount();
    $("#fcount").textContent = f.total + (f.stew ? " · " + f.stew + "🍲" : "");
    $("#lcount").textContent = G.save.loonies.length + "/" + G.loonies.length;
    $("#ocount").textContent = G.save.orbs;
    // the stamina wheel sits beside the hero and hides when full
    const full = P.stamina >= P.staminaMax && !P.exhausted;
    const el = $("#stamina");
    el.style.opacity = full ? 0 : 1;
    if (!full) {
      const v = new THREE.Vector3(P.x, P.y + 1.6, P.z).project(G.camera);
      el.style.left = ((v.x + 1) / 2) * innerWidth + 48 + "px";
      el.style.top = ((1 - v.y) / 2) * innerHeight - 20 + "px";
      this.stamArc.setAttribute("stroke-dashoffset", String(113.1 * (1 - P.stamina / P.staminaMax)));
      this.stamArc.setAttribute("stroke", P.exhausted ? "#e0453a" : P.stamina < 30 ? "#ffb03a" : "#7ac84a");
    }
    // abilities
    const A = G.abilities, ak = JSON.stringify([A.grit && [A.grit.charges, Math.ceil(A.grit.cd)], A.lift && Math.ceil(A.lift.cd), A.fury && Math.ceil(A.fury.cd)]);
    if (ak !== this.last.ab) {
      this.last.ab = ak;
      let h = "";
      if (A.grit) h += `<div class="ab" title="Gabe's Grit" style="--cd:${A.grit.cd > 0 ? (A.grit.cd / 60) * 100 : 0}%">🛡<i></i><b>${A.grit.charges}</b></div>`;
      if (A.lift) h += `<div class="ab" title="Mystic Updraft (R)" style="--cd:${(A.lift.cd / 25) * 100}%">🌪<i></i><b>R</b></div>`;
      if (A.fury) h += `<div class="ab" title="Ryu's Fury (F)" style="--cd:${(A.fury.cd / 40) * 100}%">⚡<i></i><b>F</b></div>`;
      $("#abil").innerHTML = h;
      $("#tlift").hidden = !A.lift; $("#tfury").hidden = !A.fury;
    }
    $("#clock").textContent = G.clockText();
    const goal = G.goal();
    if (goal !== this.last.goal) { this.last.goal = goal; $("#goal").innerHTML = goal; }
  }
  prompt(text, key) {
    const p = $("#prompt");
    if (!text) { p.hidden = true; $("#tact").hidden = true; return; }
    p.hidden = false; $("#ptext").textContent = text; $("#pkey").textContent = key || (this.G.pad ? "Y" : "E");
    $("#tact").hidden = false; $("#tact").textContent = text.split(" ")[0].toUpperCase().slice(0, 6);
  }
  banner(title, sub, time = 3.5) { $("#btitle").textContent = title; $("#bsub").textContent = sub || ""; $("#banner").classList.add("show"); this.bannerT = time; }
  toast(msg, time = 2.2) { $("#toast").textContent = msg; $("#toast").classList.add("show"); this.toastT = time; }
  flash() { const f = $("#flash"); f.classList.add("on"); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove("on"))); }
  slow(on) { $("#slow").classList.toggle("on", on); }
  // The boss bar: the red bar drops at once and a pale chunk follows it down, so every hit shows what it took.
  // Bosses that can be staggered have a gold bar under it that fills as you hit them.
  boss(name, frac, poise = null, marks = false) {
    const b = $("#bossbar");
    if (name == null) { if (!b.hidden) { b.hidden = true; $("#hud").classList.remove("fighting"); } this.bossLag = 1; this.bossKey = null; return; }
    if (b.hidden) { b.hidden = false; $("#hud").classList.add("fighting"); }
    if (this.bossKey !== name) { this.bossKey = name; $("#bossName").textContent = name; this.bossLag = frac; b.classList.toggle("marks", marks); }
    this.bossFrac = Math.max(0, frac);
    $("#bossFill").style.width = this.bossFrac * 100 + "%";
    const pw = $("#bossPoise");
    pw.parentElement.hidden = poise == null;
    if (poise != null) { pw.style.width = poise * 100 + "%"; pw.parentElement.classList.toggle("full", poise >= 1); }
  }
  // a big word that pops up in the middle of the screen: Stagger! Plunge! Flurry!
  pop(text, kind = "gold") {
    const el = $("#pop");
    el.textContent = text; el.className = ""; void el.offsetWidth; el.className = "go " + kind;
  }
  tick(dt) {
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) $("#banner").classList.remove("show");
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) $("#toast").classList.remove("show");
    if (this.bossKey && this.bossLag > this.bossFrac) { this.bossLag = Math.max(this.bossFrac, this.bossLag - dt * 0.3); $("#bossLag").style.width = this.bossLag * 100 + "%"; }
    if (this.typing) {
      this.typing.t += dt * 45;
      const n = Math.min(this.typing.text.length, Math.floor(this.typing.t));
      if (n !== this.typing.n) { this.typing.n = n; $("#dtext").textContent = this.typing.text.slice(0, n); if (n % 3 === 0) this.G.sfx("talk"); }
      if (n >= this.typing.text.length) this.typing = null;
    }
  }

  // dialog: a list of [name, line]. Resolves when the last line is closed.
  // close every open card and dialog; pending promises resolve so nothing waits forever
  closeAll() {
    if (this.dq) { const r = this.dq.res; this.dq = null; this.typing = null; document.querySelector("#dialog").hidden = true; r(); }
    if (this.chRes) { const r = this.chRes; this.chRes = null; this.hide("choice"); r(-1); }
    for (const id of ["map", "pause", "help"]) this.hide(id);
    this.modal = null;
  }
  say(lines) {
    return new Promise((res) => {
      this.dq = { lines: lines.slice(), res };
      this.modal = "dialog";
      $("#dialog").hidden = false;
      this.nextLine();
    });
  }
  nextLine() {
    const [name, text] = this.dq.lines.shift();
    $("#dname").textContent = name; $("#dtext").textContent = "";
    this.typing = { text, t: 0, n: 0 };
  }
  advance() {
    if (!this.dq) return;
    if (this.typing) { $("#dtext").textContent = this.typing.text; this.typing = null; return; }
    if (this.dq.lines.length) { this.nextLine(); return; }
    $("#dialog").hidden = true; this.modal = null;
    const r = this.dq.res; this.dq = null; r();
  }
  choose(title, text, options) {
    return new Promise((res) => {
      $("#chTitle").textContent = title; $("#chText").textContent = text;
      const box = $("#chBtns"); box.innerHTML = "";
      if (this.chRes) { const r = this.chRes; this.chRes = null; r(-1); }
      this.chRes = res;
      options.forEach((o, i) => { const b = document.createElement("button"); b.className = "btn" + (i ? " ghost" : ""); b.type = "button"; b.textContent = o; b.onclick = () => { if (this.chRes !== res) return; this.chRes = null; this.hide("choice"); this.modal = null; res(i); }; box.appendChild(b); });
      this.open("choice");
      box.firstChild.focus();
    });
  }

  /* ---------------- the map ---------------- */
  // A painted map, like a page from an illustrated storybook: watercolour land with soft hill shading,
  // contour lines, water rings along the shore, little painted trees, dotted paths, and paper grain.
  paintMap() {
    const G = this.G, w = G.world, R = 512;
    const c = document.createElement("canvas"); c.width = c.height = R;
    const x = c.getContext("2d"), img = x.createImageData(R, R), d = img.data;
    const col = new THREE.Color(), nrm = new THREE.Vector3();
    const H = new Float32Array(R * R);
    this.regionOf = new Uint8Array(R * R);
    const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const wx = ((i + 0.5) / R) * SIZE - SIZE / 2, wz = ((j + 0.5) / R) * SIZE - SIZE / 2;
      H[j * R + i] = w.height(wx, wz);
      this.regionOf[j * R + i] = TOWERS.findIndex((t) => t.id === w.towerOf(wx, wz));
    }
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const k = j * R + i, h = H[k];
      const wx = ((i + 0.5) / R) * SIZE - SIZE / 2, wz = ((j + 0.5) / R) * SIZE - SIZE / 2;
      const grain = hash(i, j) * 0.06 + hash(i >> 3, j >> 3) * 0.05;
      if (h < 0) {
        // water: pale at the shore, deep blue in the middle, with rings that follow the shoreline
        const depth = -h;
        col.setRGB(0.62, 0.84, 0.86).lerp(TMPC.setRGB(0.26, 0.5, 0.72), Math.min(1, depth / 10));
        const ring = [0.6, 2.2, 4.5].some((r) => Math.abs(depth - r) < 0.16);
        if (ring) col.lerp(TMPC.setRGB(0.9, 0.97, 1), 0.55);
        if (depth < 0.25) col.lerp(TMPC.setRGB(1, 1, 0.97), 0.7);
      } else {
        w.normal(wx, wz, nrm);
        w.groundColor(wx, wz, h, nrm.y, col);
        // soften toward a storybook palette
        const l = (col.r + col.g + col.b) / 3;
        col.lerp(TMPC.setRGB(l * 1.02, l * 1.08, l * 0.9), 0.18).multiplyScalar(1.06);
        // light from the upper left: warm lit slopes, cool blue shadows
        const light = -nrm.x * 0.55 - nrm.z * 0.55 + nrm.y * 0.45;
        if (light > 0.45) col.lerp(TMPC.setRGB(1, 0.95, 0.78), Math.min(0.35, (light - 0.45) * 1.2));
        else col.lerp(TMPC.setRGB(0.36, 0.42, 0.62), Math.min(0.45, (0.45 - light) * 1.1));
        // contour lines: fine every 12 m, stronger every 48 m
        const hl = H[Math.max(0, k - 1)], hu = H[Math.max(0, k - R)];
        if (Math.floor(h / 12) !== Math.floor(hl / 12) || Math.floor(h / 12) !== Math.floor(hu / 12)) col.multiplyScalar(Math.floor(h / 48) !== Math.floor(hl / 48) || Math.floor(h / 48) !== Math.floor(hu / 48) ? 0.72 : 0.86);
        // a darker rim at the shore, like pigment pooling at the edge of a wash
        if (h < 1.2) col.lerp(TMPC.setRGB(0.86, 0.78, 0.55), 0.35);
      }
      col.multiplyScalar(0.97 + grain);
      d[k * 4] = Math.min(255, col.r * 255); d[k * 4 + 1] = Math.min(255, col.g * 255); d[k * 4 + 2] = Math.min(255, col.b * 255); d[k * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const to = (wx, wz) => this.toMap(wx, wz, R);
    // dotted paths
    if (w.paths) {
      x.save(); x.strokeStyle = "rgba(120,80,40,.75)"; x.lineWidth = 1.6; x.setLineDash([3, 3]); x.lineCap = "round";
      for (const [p0, p1] of w.paths) { const [ax, ay] = to(p0[0], p0[1]), [bx, by] = to(p1[0], p1[1]); x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); }
      x.restore();
    }
    // little painted trees: round crowns with a light side, pines as small triangles
    const trees = [];
    for (const list of w.colliders.values()) for (const t of list) if (t.kind === "tree") trees.push(t);
    let n = 0;
    for (const t of trees) {
      if (n++ % 3) continue;
      const [px, py] = to(t.x, t.z), r = Math.min(3.2, 1.6 + t.r * 0.35);
      const west = t.x < -200;
      x.fillStyle = "rgba(20,40,20,.25)"; x.beginPath(); x.ellipse(px + 1, py + 1.4, r, r * 0.6, 0, 0, 7); x.fill();
      if (west) { x.fillStyle = "#2f5a36"; x.beginPath(); x.moveTo(px, py - r * 1.6); x.lineTo(px + r, py + r * 0.6); x.lineTo(px - r, py + r * 0.6); x.closePath(); x.fill(); }
      else { x.fillStyle = "#4f8a44"; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.fillStyle = "rgba(200,230,140,.55)"; x.beginPath(); x.arc(px - r * 0.3, py - r * 0.35, r * 0.45, 0, 7); x.fill(); }
    }
    // paper grain over everything, and a soft darker edge
    const pg = x.createRadialGradient(R / 2, R / 2, R * 0.35, R / 2, R / 2, R * 0.75);
    pg.addColorStop(0, "rgba(120,90,50,0)"); pg.addColorStop(1, "rgba(120,90,50,.28)");
    x.fillStyle = pg; x.fillRect(0, 0, R, R);
    this.base = c; this.R = R;
    // the cloud cover for land you have not mapped yet
    const cc = document.createElement("canvas"); cc.width = cc.height = R;
    const cx = cc.getContext("2d");
    cx.fillStyle = "#efe6d0"; cx.fillRect(0, 0, R, R);
    const rr = (a) => hash(a, a * 1.7 + 3);
    for (let k = 0; k < 520; k++) {
      const px = rr(k) * R, py = rr(k + 999) * R, rad = 8 + rr(k + 55) * 26;
      const g = cx.createRadialGradient(px - rad * 0.3, py - rad * 0.35, rad * 0.1, px, py, rad);
      g.addColorStop(0, "rgba(255,252,242,.9)"); g.addColorStop(0.7, "rgba(236,228,210,.55)"); g.addColorStop(1, "rgba(200,196,200,0)");
      cx.fillStyle = g; cx.beginPath(); cx.arc(px, py, rad, 0, 7); cx.fill();
    }
    // a few swirls, like clouds in an old scroll painting
    cx.strokeStyle = "rgba(170,160,150,.35)"; cx.lineWidth = 1.4;
    for (let k = 0; k < 40; k++) { const px = rr(k + 300) * R, py = rr(k + 700) * R, rad = 6 + rr(k + 900) * 10; cx.beginPath(); for (let a = 0; a < 9; a += 0.2) { const q = rad * (1 - a / 11); cx.lineTo(px + Math.cos(a) * q, py + Math.sin(a) * q * 0.7); } cx.stroke(); }
    this.clouds = cc;
    this.renderMap();
  }
  // the map with unmapped land hidden under soft painted clouds
  renderMap() {
    const R = this.R, G = this.G;
    this.prevMap = this.map;
    // a soft mask: 1 where the land is mapped, fading over a few pixels at the edges
    const lit = TOWERS.map((t) => G.save.towers.includes(t.id));
    const m = document.createElement("canvas"); m.width = m.height = R;
    const mx = m.getContext("2d"), mi = mx.createImageData(R, R), md = mi.data;
    for (let k = 0; k < R * R; k++) { md[k * 4 + 3] = lit[this.regionOf[k]] ? 0 : 255; }
    mx.putImageData(mi, 0, 0);
    const soft = document.createElement("canvas"); soft.width = soft.height = R;
    const sx = soft.getContext("2d");
    sx.filter = "blur(6px)"; sx.drawImage(m, 0, 0); sx.filter = "none";
    sx.globalCompositeOperation = "source-in"; sx.drawImage(this.clouds, 0, 0);
    const c = document.createElement("canvas"); c.width = c.height = R;
    const x = c.getContext("2d");
    x.drawImage(this.base, 0, 0);
    x.drawImage(soft, 0, 0);
    this.map = c;
  }
  toMap(wx, wz, S) { return [((wx + SIZE / 2) / SIZE) * S, ((wz + SIZE / 2) / SIZE) * S]; }
  markers() {
    const G = this.G, out = [];
    out.push({ kind: "home", x: G.world.cottage.x, z: G.world.cottage.z, travel: true, name: "The Cottage" });
    for (const t of G.world.towers) { const on = G.save.towers.includes(t.id); out.push({ kind: "tower", on, x: t.x, z: t.z, travel: on, name: t.name + " Lookout", tower: t }); }
    for (const s of G.world.shrines) { const seen = G.save.seen.includes(s.id) || G.save.towers.includes(G.world.towerOf(s.x, s.z)); if (!seen) continue; const done = G.save.shrines.includes(s.id); out.push({ kind: "shrine", on: done, x: s.x, z: s.z, travel: done, name: s.name, shrine: s }); }
    for (const b of G.bosses) out.push({ kind: "boss", on: !b.alive, x: b.center.x, z: b.center.z, name: b.def.name });
    // fishing spots show once the nearest tower is lit; the kayak always shows
    for (const f of G.world.fishSpots || []) if (G.save.towers.includes(G.world.towerOf(f.x, f.z))) out.push({ kind: "fish", on: f.rest <= 0, x: f.x, z: f.z, name: "Fishing spot" });
    const K = G.world.kayak; if (K && !K.rider) out.push({ kind: "kayak", x: K.x, z: K.z, name: "Kayak" });
    return out;
  }
  // Map icons, drawn like little stamps: a soft shadow, a coloured badge, and a clear symbol.
  drawIcon(x, m, px, py, s, time = 0) {
    x.save(); x.translate(px, py);
    x.lineWidth = Math.max(1.5, s * 0.16); x.strokeStyle = "#3a2a1a"; x.lineJoin = "round";
    const badge = (fill) => { x.fillStyle = "rgba(30,20,10,.3)"; x.beginPath(); x.arc(0.8, 1.4, s, 0, 7); x.fill(); x.fillStyle = fill; x.beginPath(); x.arc(0, 0, s, 0, 7); x.fill(); x.stroke(); };
    if (m.kind === "tower") {
      // a lookout: legs, deck, roof; lit ones carry a flame
      badge(m.on ? "#f6e2b0" : "#d8d0c0");
      x.strokeStyle = "#4a2e18"; x.lineWidth = Math.max(1, s * 0.13);
      x.beginPath(); x.moveTo(-s * 0.45, s * 0.6); x.lineTo(-s * 0.2, -s * 0.2); x.moveTo(s * 0.45, s * 0.6); x.lineTo(s * 0.2, -s * 0.2); x.moveTo(-s * 0.35, s * 0.2); x.lineTo(s * 0.35, s * 0.2); x.stroke();
      x.fillStyle = "#9a4a32"; x.beginPath(); x.moveTo(-s * 0.5, -s * 0.2); x.lineTo(0, -s * 0.62); x.lineTo(s * 0.5, -s * 0.2); x.closePath(); x.fill();
      if (m.on) { const f = 1 + Math.sin(time * 8) * 0.12; x.fillStyle = "#ff8a2a"; x.beginPath(); x.ellipse(0, -s * 0.95, s * 0.22, s * 0.36 * f, 0, 0, 7); x.fill(); x.fillStyle = "#ffe08a"; x.beginPath(); x.ellipse(0, -s * 0.9, s * 0.1, s * 0.18 * f, 0, 0, 7); x.fill(); }
    } else if (m.kind === "shrine") {
      badge(m.on ? "#ffcf7a" : "#bfeaf2");
      x.fillStyle = m.on ? "#a8542e" : "#2a7a9a"; x.fillRect(-s * 0.35, -s * 0.5, s * 0.7, s * 1.0);
      x.fillStyle = "#fff8ea"; x.beginPath(); x.arc(0, -s * 0.18, s * 0.14, 0, 7); x.fill();
    } else if (m.kind === "boss") {
      badge(m.on ? "#d8d0c0" : "#e8a0a0");
      x.fillStyle = m.on ? "#8a8a8a" : "#b02030"; x.beginPath(); x.moveTo(0, -s * 0.6); x.lineTo(s * 0.5, s * 0.45); x.lineTo(-s * 0.5, s * 0.45); x.closePath(); x.fill();
      x.fillStyle = "#fff"; x.fillRect(-s * 0.06, -s * 0.2, s * 0.12, s * 0.35); x.fillRect(-s * 0.06, s * 0.22, s * 0.12, s * 0.1);
    } else if (m.kind === "fish") {
      x.globalAlpha = m.on ? 1 : 0.45;
      x.fillStyle = "#3a8ac8"; x.beginPath(); x.ellipse(-s * 0.1, 0, s * 0.62, s * 0.34, 0, 0, 7); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(s * 0.45, 0); x.lineTo(s * 0.9, -s * 0.36); x.lineTo(s * 0.9, s * 0.36); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = "#fff"; x.beginPath(); x.arc(-s * 0.4, -s * 0.06, s * 0.08, 0, 7); x.fill();
    } else if (m.kind === "kayak") {
      x.fillStyle = "#e0602a"; x.beginPath(); x.ellipse(0, 0, s * 0.28, s * 0.95, 0, 0, 7); x.fill(); x.stroke();
      x.fillStyle = "#f2e6c8"; x.beginPath(); x.ellipse(0, 0, s * 0.12, s * 0.22, 0, 0, 7); x.fill();
    } else if (m.kind === "home") {
      badge("#fff1d8");
      x.fillStyle = "#c8442e"; x.beginPath(); x.moveTo(0, -s * 0.65); x.lineTo(s * 0.62, -s * 0.05); x.lineTo(-s * 0.62, -s * 0.05); x.closePath(); x.fill();
      x.fillStyle = "#8a5a32"; x.fillRect(-s * 0.42, -s * 0.05, s * 0.84, s * 0.6);
      x.fillStyle = "#ffe08a"; x.fillRect(-s * 0.12, s * 0.12, s * 0.24, s * 0.43);
    }
    x.restore();
  }
  // Draw the full map page: the painted map inside a storybook frame, with a title, a compass, labels, and markers.
  drawMap(x, S, img, time = 0) {
    const G = this.G, M = Math.round(S * 0.055), I = S - M * 2;
    const at = (wx, wz) => { const [a, b] = this.toMap(wx, wz, I); return [M + a, M + b]; };
    // paper and frame
    x.fillStyle = "#e9dcbc"; x.fillRect(0, 0, S, S);
    x.imageSmoothingEnabled = true;
    x.drawImage(img, M, M, I, I);
    x.strokeStyle = "#5a3e24"; x.lineWidth = 3; x.strokeRect(M - 2, M - 2, I + 4, I + 4);
    x.strokeStyle = "rgba(90,62,36,.55)"; x.lineWidth = 1.2; x.strokeRect(M - 9, M - 9, I + 18, I + 18);
    for (const [cx, cy] of [[M - 9, M - 9], [S - M + 9, M - 9], [M - 9, S - M + 9], [S - M + 9, S - M + 9]]) {
      x.fillStyle = "#e9dcbc"; x.strokeStyle = "#5a3e24"; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(cx, cy - 9); x.lineTo(cx + 9, cy); x.lineTo(cx, cy + 9); x.lineTo(cx - 9, cy); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = "#a8542e"; x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill();
    }
    const label = (text, px, py, size, color = "rgba(52,36,20,.9)", italic = true) => {
      x.font = (italic ? "italic " : "") + "700 " + size + "px 'Cormorant Garamond', Georgia, serif"; x.textAlign = "center"; x.textBaseline = "middle";
      x.lineWidth = Math.max(3, size * 0.22); x.strokeStyle = "rgba(245,236,212,.85)"; x.lineJoin = "round"; x.strokeText(text, px, py); x.fillStyle = color; x.fillText(text, px, py);
    };
    // title ribbon
    const tw = Math.min(I * 0.52, 360), ty = M + S * 0.045;
    x.fillStyle = "rgba(246,238,216,.94)"; x.strokeStyle = "#5a3e24"; x.lineWidth = 1.8;
    x.beginPath(); x.moveTo(S / 2 - tw / 2 - 16, ty); x.lineTo(S / 2 - tw / 2, ty - S * 0.028); x.lineTo(S / 2 + tw / 2, ty - S * 0.028); x.lineTo(S / 2 + tw / 2 + 16, ty); x.lineTo(S / 2 + tw / 2, ty + S * 0.028); x.lineTo(S / 2 - tw / 2, ty + S * 0.028); x.closePath(); x.fill(); x.stroke();
    label("Loon Lake Valley", S / 2, ty + 1, Math.round(S * 0.036), "#4a2e18");
    // place names
    const F = Math.round(S * 0.026);
    for (const t of TOWERS) if (G.save.towers.includes(t.id)) { const [px, py] = at(t.x, t.z); label(t.name, px, py + F * 1.5, F); }
    { const [lx, ly] = at(0, 40); label("Loon Lake", lx, ly + F * 2.5, Math.round(F * 1.3), "rgba(30,70,110,.85)"); }
    { const [ix, iy] = at(ISLAND.x, ISLAND.z); label("Clog Island", ix, iy - F * 1.3, F, "rgba(100,40,100,.9)"); }
    { const [cx2, cy2] = at(G.world.cottage.x, G.world.cottage.z); label("The Cottage", cx2, cy2 + F * 1.4, Math.round(F * 0.85)); }
    // compass rose
    const rx = S - M - S * 0.075, ry = S - M - S * 0.075, rs = S * 0.05;
    x.save(); x.translate(rx, ry);
    x.fillStyle = "rgba(246,238,216,.8)"; x.beginPath(); x.arc(0, 0, rs * 1.25, 0, 7); x.fill();
    x.strokeStyle = "#5a3e24"; x.lineWidth = 1.2; x.beginPath(); x.arc(0, 0, rs * 1.05, 0, 7); x.stroke();
    for (let k = 0; k < 8; k++) {
      const long = k % 2 === 0, L = long ? rs : rs * 0.55;
      x.save(); x.rotate((k * Math.PI) / 4);
      x.fillStyle = k === 0 ? "#a8542e" : long ? "#5a3e24" : "#9a8060";
      x.beginPath(); x.moveTo(0, -L); x.lineTo(rs * 0.16, 0); x.lineTo(0, rs * 0.12); x.lineTo(-rs * 0.16, 0); x.closePath(); x.fill();
      x.restore();
    }
    x.restore();
    label("N", rx, ry - rs * 1.55, Math.round(F * 0.9), "#a8542e", false);
    // markers, Loonies, and you
    this.hits = [];
    for (const m of this.markers()) { const [px, py] = at(m.x, m.z); this.drawIcon(x, m, px, py, Math.round(S * 0.0145), time); this.hits.push({ ...m, px, py }); }
    for (const [lx2, lz] of G.save.loonies.map((i) => [G.loonies[i].x, G.loonies[i].z])) { const [px, py] = at(lx2, lz); x.fillStyle = "#ffd84a"; x.strokeStyle = "#7a5a10"; x.lineWidth = 1; x.beginPath(); x.arc(px, py, 3, 0, 7); x.fill(); x.stroke(); }
    const P = G.player, [pxp, pyp] = at(P.x, P.z);
    this.drawHero(x, pxp, pyp, P.yaw, Math.round(S * 0.016), time);
  }
  drawHero(x, px, py, yaw, s, time = 0) {
    x.save(); x.translate(px, py);
    x.fillStyle = "rgba(255,255,255,.25)"; x.beginPath(); x.arc(0, 0, s * (1.6 + 0.3 * Math.sin(time * 4)), 0, 7); x.fill();
    x.rotate(-yaw + Math.PI);
    x.shadowColor = "rgba(0,0,0,.4)"; x.shadowBlur = 4; x.shadowOffsetY = 1;
    x.fillStyle = "#fff8ea"; x.strokeStyle = "#a8342e"; x.lineWidth = 2.5; x.lineJoin = "round";
    x.beginPath(); x.moveTo(0, -s * 1.1); x.lineTo(s * 0.72, s * 0.8); x.lineTo(0, s * 0.38); x.lineTo(-s * 0.72, s * 0.8); x.closePath(); x.fill(); x.stroke();
    x.restore();
  }
  openMap() {
    const cv = this.mapCv;
    this.drawMap(cv.getContext("2d"), cv.width, this.map, this.G.time);
    this.open("map");
  }
  // After lighting a beacon: open the map and let the clouds part around that lookout
  mapReveal(t) {
    if (!this.prevMap || this.modal) return;
    const cv = this.mapCv, x = cv.getContext("2d"), S = cv.width, R = this.R;
    const before = this.prevMap, after = this.map;
    const mix = document.createElement("canvas"); mix.width = mix.height = R;
    const mx = mix.getContext("2d");
    const [cx, cy] = this.toMap(t.x, t.z, R);
    this.open("map");
    const t0 = performance.now();
    const frame = (now) => {
      if (this.modal !== "map") return;
      const u = Math.min(1, (now - t0) / 2400), e = 1 - Math.pow(1 - u, 3);
      mx.globalCompositeOperation = "source-over"; mx.clearRect(0, 0, R, R); mx.drawImage(after, 0, 0);
      const g = mx.createRadialGradient(cx, cy, 0, cx, cy, 20 + e * R * 0.6);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.8, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      mx.globalCompositeOperation = "destination-in"; mx.fillStyle = g; mx.fillRect(0, 0, R, R);
      mx.globalCompositeOperation = "destination-over"; mx.drawImage(before, 0, 0);
      this.drawMap(x, S, mix, now / 1000);
      if (u < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  async mapClick(e) {
    const r = this.mapCv.getBoundingClientRect(), S = this.mapCv.width;
    const mx = ((e.clientX - r.left) / r.width) * S, my = ((e.clientY - r.top) / r.height) * S;
    let best = null, bd = 30;
    for (const h of this.hits || []) { const d = Math.hypot(h.px - mx, h.py - my); if (d < bd) { bd = d; best = h; } }
    if (!best) return;
    if (!best.travel) { $("#mapInfo").textContent = best.name + (best.kind === "tower" ? ": climb it and light the beacon to map this land." : best.kind === "shrine" ? ": clear the trial to travel here." : ""); return; }
    this.hide("map");
    const go = await this.choose("Travel", "Travel to " + best.name + "?", ["Travel", "Cancel"]);
    if (go === 0) this.G.travel(best); else this.open("map");
    if (go === 0) this.G.resume();
  }
  // The HUD map: a round window onto the painted map, in a brass-and-wood ring with a north mark.
  minimap() {
    const G = this.G, P = G.player, x = this.mini, S = this.mini.canvas.width, R = this.R;
    const rad = S / 2 - S * 0.07, view = 240, scale = (rad * 2) / ((view / SIZE) * R);
    const [cx, cy] = this.toMap(P.x, P.z, R);
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath(); x.arc(S / 2, S / 2, rad, 0, 7); x.clip();
    x.fillStyle = "#e9dcbc"; x.fillRect(0, 0, S, S);
    x.imageSmoothingEnabled = true;
    x.drawImage(this.map, cx - S / 2 / scale, cy - S / 2 / scale, S / scale, S / scale, 0, 0, S, S);
    const to = (wx, wz) => { const [a, b] = this.toMap(wx, wz, R); return [(a - cx) * scale + S / 2, (b - cy) * scale + S / 2]; };
    // which way the camera looks: a soft wedge of light
    x.save(); x.translate(S / 2, S / 2); x.rotate(-G.cam.yaw);
    const cg = x.createRadialGradient(0, 0, 0, 0, 0, rad * 0.9); cg.addColorStop(0, "rgba(255,250,230,.45)"); cg.addColorStop(1, "rgba(255,250,230,0)");
    x.fillStyle = cg; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, rad * 0.9, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); x.closePath(); x.fill();
    x.restore();
    for (const m of this.markers()) { const [px, py] = to(m.x, m.z); if (Math.hypot(px - S / 2, py - S / 2) < rad - 8) this.drawIcon(x, m, px, py, S * 0.04, G.time); }
    for (const f of G.foes) if (f.alive && f.state !== "idle" && f.state !== "return") { const [px, py] = to(f.x, f.z); x.fillStyle = "#c8302a"; x.strokeStyle = "#fff"; x.lineWidth = 1.2; x.beginPath(); x.arc(px, py, S * 0.018, 0, 7); x.fill(); x.stroke(); }
    // an inner shadow, so the map sits under glass
    const ig = x.createRadialGradient(S / 2, S / 2, rad * 0.7, S / 2, S / 2, rad);
    ig.addColorStop(0, "rgba(40,25,10,0)"); ig.addColorStop(1, "rgba(40,25,10,.35)");
    x.fillStyle = ig; x.fillRect(0, 0, S, S);
    x.restore();
    this.drawHero(x, S / 2, S / 2, P.yaw, S * 0.055, G.time);
    // the ring: dark wood with a brass rim and tick marks
    x.save(); x.translate(S / 2, S / 2);
    const ring = x.createLinearGradient(0, -S / 2, 0, S / 2); ring.addColorStop(0, "#8a5a32"); ring.addColorStop(1, "#4a2e18");
    x.strokeStyle = ring; x.lineWidth = S * 0.075; x.beginPath(); x.arc(0, 0, rad + S * 0.035, 0, 7); x.stroke();
    x.strokeStyle = "#e0b460"; x.lineWidth = S * 0.012; x.beginPath(); x.arc(0, 0, rad + 1, 0, 7); x.stroke();
    x.strokeStyle = "rgba(240,210,140,.8)"; x.lineWidth = S * 0.008; x.beginPath(); x.arc(0, 0, rad + S * 0.07, 0, 7); x.stroke();
    for (let k = 0; k < 24; k++) { x.save(); x.rotate((k / 24) * Math.PI * 2); x.fillStyle = k % 6 === 0 ? "#f2d38a" : "rgba(240,210,140,.6)"; x.fillRect(-S * 0.004, -rad - S * 0.055, S * 0.008, k % 6 === 0 ? S * 0.03 : S * 0.015); x.restore(); }
    // north
    x.fillStyle = "#c8442e"; x.strokeStyle = "#f2d38a"; x.lineWidth = S * 0.01;
    x.beginPath(); x.moveTo(0, -rad - S * 0.075); x.lineTo(S * 0.035, -rad - S * 0.02); x.lineTo(-S * 0.035, -rad - S * 0.02); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = "#fff4d8"; x.font = "700 " + Math.round(S * 0.07) + "px 'Cormorant Garamond', Georgia, serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("N", 0, -rad - S * 0.042);
    x.restore();
  }
}
