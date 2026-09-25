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
  boss(name, frac) { const b = $("#bossbar"); if (name == null) { b.hidden = true; return; } b.hidden = false; $("#bossName").textContent = name; $("#bossFill").style.width = Math.max(0, frac * 100) + "%"; }
  tick(dt) {
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) $("#banner").classList.remove("show");
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) $("#toast").classList.remove("show");
    if (this.typing) {
      this.typing.t += dt * 45;
      const n = Math.min(this.typing.text.length, Math.floor(this.typing.t));
      if (n !== this.typing.n) { this.typing.n = n; $("#dtext").textContent = this.typing.text.slice(0, n); if (n % 3 === 0) this.G.sfx("talk"); }
      if (n >= this.typing.text.length) this.typing = null;
    }
  }

  // dialog: a list of [name, line]. Resolves when the last line is closed.
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
      options.forEach((o, i) => { const b = document.createElement("button"); b.className = "btn" + (i ? " ghost" : ""); b.type = "button"; b.textContent = o; b.onclick = () => { this.hide("choice"); this.modal = null; res(i); }; box.appendChild(b); });
      this.open("choice");
      box.firstChild.focus();
    });
  }

  /* ---------------- the map ---------------- */
  paintMap() {
    const G = this.G, w = G.world, R = 384;
    const c = document.createElement("canvas"); c.width = c.height = R;
    const x = c.getContext("2d"), img = x.createImageData(R, R), d = img.data;
    const col = new THREE.Color(), nrm = new THREE.Vector3();
    this.regionOf = new Uint8Array(R * R);
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const wx = ((i + 0.5) / R) * SIZE - SIZE / 2, wz = ((j + 0.5) / R) * SIZE - SIZE / 2;
      const h = w.height(wx, wz); w.normal(wx, wz, nrm);
      if (h < 0) col.setRGB(0.42, 0.72, 0.8).lerp(new THREE.Color(0.2, 0.45, 0.66), Math.min(1, -h / 12));
      else { w.groundColor(wx, wz, h, nrm.y, col); const sh = 0.75 + (nrm.x * -0.6 + nrm.z * -0.5 + nrm.y) * 0.3; col.multiplyScalar(sh); if (Math.abs((h % 20) - 10) > 9.4 && h > 4) col.multiplyScalar(0.85); }
      const k = (j * R + i) * 4;
      d[k] = Math.min(255, col.r * 255); d[k + 1] = Math.min(255, col.g * 255); d[k + 2] = Math.min(255, col.b * 255); d[k + 3] = 255;
      this.regionOf[j * R + i] = TOWERS.findIndex((t) => t.id === w.towerOf(wx, wz));
    }
    x.putImageData(img, 0, 0);
    this.base = c; this.R = R;
    this.renderMap();
  }
  // the map with unexplored parts left as blank paper
  renderMap() {
    const R = this.R, G = this.G;
    const c = document.createElement("canvas"); c.width = c.height = R;
    const x = c.getContext("2d");
    x.drawImage(this.base, 0, 0);
    const img = x.getImageData(0, 0, R, R), d = img.data;
    const lit = TOWERS.map((t) => G.save.towers.includes(t.id));
    for (let k = 0; k < R * R; k++) {
      if (lit[this.regionOf[k]]) continue;
      const i = k % R, j = (k / R) | 0, hatch = (i + j) % 7 === 0 ? 0.92 : 1;
      const g = (d[k * 4] + d[k * 4 + 1] + d[k * 4 + 2]) / 3;
      d[k * 4] = (236 + (g - 150) * 0.08) * hatch; d[k * 4 + 1] = (222 + (g - 150) * 0.08) * hatch; d[k * 4 + 2] = (186 + (g - 150) * 0.08) * hatch;
    }
    x.putImageData(img, 0, 0);
    this.map = c;
  }
  toMap(wx, wz, S) { return [((wx + SIZE / 2) / SIZE) * S, ((wz + SIZE / 2) / SIZE) * S]; }
  markers() {
    const G = this.G, out = [];
    out.push({ kind: "home", x: G.world.cottage.x, z: G.world.cottage.z, travel: true, name: "The Cottage" });
    for (const t of G.world.towers) { const on = G.save.towers.includes(t.id); out.push({ kind: "tower", on, x: t.x, z: t.z, travel: on, name: t.name + " Tower", tower: t }); }
    for (const s of G.world.shrines) { const seen = G.save.seen.includes(s.id) || G.save.towers.includes(G.world.towerOf(s.x, s.z)); if (!seen) continue; const done = G.save.shrines.includes(s.id); out.push({ kind: "shrine", on: done, x: s.x, z: s.z, travel: done, name: s.name, shrine: s }); }
    for (const b of G.bosses) out.push({ kind: "boss", on: !b.alive, x: b.center.x, z: b.center.z, name: b.def.name });
    return out;
  }
  drawIcon(x, m, px, py, s) {
    x.save(); x.translate(px, py);
    x.lineWidth = 2; x.strokeStyle = "#3a2a1a";
    if (m.kind === "tower") { x.fillStyle = m.on ? "#ff9a3a" : "#8a8a8a"; x.beginPath(); x.moveTo(0, -s); x.lineTo(s * 0.6, s); x.lineTo(-s * 0.6, s); x.closePath(); x.fill(); x.stroke(); }
    else if (m.kind === "shrine") { x.fillStyle = m.on ? "#ff9a3a" : "#5ad8e8"; x.fillRect(-s * 0.55, -s * 0.7, s * 1.1, s * 1.4); x.strokeRect(-s * 0.55, -s * 0.7, s * 1.1, s * 1.4); x.fillStyle = "#3a2a1a"; x.beginPath(); x.arc(0, -s * 0.2, s * 0.22, 0.5, 5.2); x.fill(); }
    else if (m.kind === "boss") { x.fillStyle = m.on ? "#9a9a9a" : "#c0203a"; x.beginPath(); x.ellipse(0, 0, s, s * 0.6, 0, 0, 7); x.fill(); x.stroke(); x.fillStyle = m.on ? "#fff" : "#ffd84a"; x.beginPath(); x.arc(0, 0, s * 0.3, 0, 7); x.fill(); }
    else if (m.kind === "home") { x.fillStyle = "#e0453a"; x.beginPath(); x.moveTo(0, -s); x.lineTo(s, 0); x.lineTo(s * 0.7, 0); x.lineTo(s * 0.7, s * 0.8); x.lineTo(-s * 0.7, s * 0.8); x.lineTo(-s * 0.7, 0); x.lineTo(-s, 0); x.closePath(); x.fill(); x.stroke(); }
    x.restore();
  }
  openMap() {
    const G = this.G, cv = this.mapCv, x = cv.getContext("2d"), S = cv.width;
    x.imageSmoothingEnabled = true;
    x.drawImage(this.map, 0, 0, S, S);
    x.font = "italic 700 22px 'Cormorant Garamond', serif"; x.textAlign = "center"; x.fillStyle = "rgba(40,30,20,.75)";
    for (const t of TOWERS) if (G.save.towers.includes(t.id)) { const [px, py] = this.toMap(t.x, t.z, S); x.fillText(t.name, px, py + 34); }
    const [lx, ly] = this.toMap(0, -40, S); x.fillText("Loon Lake", lx, ly + 60);
    const [ix, iy] = this.toMap(ISLAND.x, ISLAND.z, S); x.fillStyle = "rgba(90,30,90,.8)"; x.fillText("Clog Island", ix, iy - 24);
    this.hits = [];
    for (const m of this.markers()) { const [px, py] = this.toMap(m.x, m.z, S); this.drawIcon(x, m, px, py, 11); this.hits.push({ ...m, px, py }); }
    for (const [lx2, lz] of G.save.loonies.map((i) => [G.loonies[i].x, G.loonies[i].z])) { const [px, py] = this.toMap(lx2, lz, S); x.fillStyle = "#ffd84a"; x.beginPath(); x.arc(px, py, 3, 0, 7); x.fill(); }
    const P = G.player, [pxp, pyp] = this.toMap(P.x, P.z, S);
    x.save(); x.translate(pxp, pyp); x.rotate(-P.yaw + Math.PI); x.fillStyle = "#fff"; x.strokeStyle = "#1a3a8a"; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -12); x.lineTo(8, 9); x.lineTo(0, 4); x.lineTo(-8, 9); x.closePath(); x.fill(); x.stroke(); x.restore();
    this.open("map");
  }
  async mapClick(e) {
    const r = this.mapCv.getBoundingClientRect(), S = this.mapCv.width;
    const mx = ((e.clientX - r.left) / r.width) * S, my = ((e.clientY - r.top) / r.height) * S;
    let best = null, bd = 30;
    for (const h of this.hits || []) { const d = Math.hypot(h.px - mx, h.py - my); if (d < bd) { bd = d; best = h; } }
    if (!best) return;
    if (!best.travel) { $("#mapInfo").textContent = best.name + (best.kind === "tower" ? ": climb it to light it up." : best.kind === "shrine" ? ": clear the trial to travel here." : ""); return; }
    this.hide("map");
    const go = await this.choose("Travel", "Travel to " + best.name + "?", ["Travel", "Cancel"]);
    if (go === 0) this.G.travel(best); else this.open("map");
    if (go === 0) this.G.resume();
  }
  minimap() {
    const G = this.G, P = G.player, x = this.mini, S = 200, R = this.R;
    const view = 260, scale = S / ((view / SIZE) * R);
    const [cx, cy] = this.toMap(P.x, P.z, R);
    x.save();
    x.clearRect(0, 0, S, S);
    x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, 7); x.clip();
    x.imageSmoothingEnabled = true;
    x.drawImage(this.map, cx - S / 2 / scale, cy - S / 2 / scale, S / scale, S / scale, 0, 0, S, S);
    const to = (wx, wz) => { const [a, b] = this.toMap(wx, wz, R); return [(a - cx) * scale + S / 2, (b - cy) * scale + S / 2]; };
    for (const m of this.markers()) { const [px, py] = to(m.x, m.z); if (Math.hypot(px - S / 2, py - S / 2) < S / 2 - 6) this.drawIcon(x, m, px, py, 8); }
    for (const f of G.foes) if (f.alive && f.state !== "idle" && f.state !== "return") { const [px, py] = to(f.x, f.z); x.fillStyle = "#e0453a"; x.beginPath(); x.arc(px, py, 3, 0, 7); x.fill(); }
    x.translate(S / 2, S / 2); x.rotate(-P.yaw + Math.PI);
    x.fillStyle = "#fff"; x.strokeStyle = "#1a3a8a"; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -11); x.lineTo(7, 8); x.lineTo(0, 4); x.lineTo(-7, 8); x.closePath(); x.fill(); x.stroke();
    x.restore();
    // which way the camera looks
    x.save(); x.translate(S / 2, S / 2); x.rotate(-G.cam.yaw);
    x.fillStyle = "rgba(255,255,255,.18)"; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 70, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); x.closePath(); x.fill();
    x.restore();
  }
}
