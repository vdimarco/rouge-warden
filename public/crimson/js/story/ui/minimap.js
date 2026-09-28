// js/story/ui/minimap.js : the round minimap (design 4.4). 200 px at the bottom left, 130 px at the top
// right on touch. It shows a 240 m window of the world's paper map (S.world.mapImage), turned so the view
// points up, with the objective and other markers (the edge holds the far ones), neon dots for alerted
// foes, the van when the hero is out of it, and a crimson GPS line along the roads to the objective or the
// waypoint. It redraws at 15 Hz. A tap or click opens the full map.
import { GLYPHS } from '../types.js';

const WINDOW = 240, HZ = 15, CRIMSON = '#d2263f', NEON = '#c6ff1a', INK = '#1b120d';

export function createMinimap(U, hud) {
  const { S, make, root } = U;
  const el = make('div', 'sMini hidden', root, '<canvas></canvas><b class="n">N</b>');
  el.id = 'sMini';
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), nEl = el.querySelector('.n');
  el.addEventListener('click', (e) => { e.stopPropagation(); if (S.mode === 'play' && U.pieces.map) U.pieces.map.api.open(); });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  const dir = new S.THREE.Vector3();
  let acc = 1, size = 0, gps = { key: '', pts: null, t: -99, from: null };

  function fit() {
    const css = el.clientWidth || 200, dpr = Math.min(2, devicePixelRatio || 1), px = Math.round(css * dpr);
    if (px !== size) { size = px; cv.width = cv.height = px; }
  }
  // the objective the GPS line leads to: the first objective marker, else the waypoint
  function target() {
    const list = hud.allMarkers();
    return list.find((m) => hud.kindOf(m) === 'objective' && !m.hidden) || list.find((m) => m.kind === 'waypoint') || null;
  }
  function route(hp, tg) {
    const R = S.world && S.world.roads; if (!R || !R.route || !tg) { gps.pts = null; return; }
    const key = `${Math.round(tg.x / 10)},${Math.round(tg.z / 10)}`;
    const moved = !gps.from || Math.hypot(hp.x - gps.from.x, hp.z - gps.from.z) > 30;
    if (key === gps.key && !moved && S.time - gps.t < 4) return;
    if (Math.hypot(tg.x - hp.x, tg.z - hp.z) < 90) { gps.pts = null; gps.key = key; return; }
    try { gps.pts = R.route({ x: hp.x, z: hp.z }, { x: tg.x, z: tg.z }) || null; } catch (e) { gps.pts = null; }
    gps.key = key; gps.t = S.time; gps.from = { x: hp.x, z: hp.z };
  }
  function draw() {
    fit();
    const D = size, r = D / 2, k = D / WINDOW; // px per meter
    const hp = S.hero ? S.hero.pos : S.focus;
    S.camera.getWorldDirection(dir);
    const rot = -Math.PI / 2 - Math.atan2(dir.z, dir.x);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, D, D);
    g.save();
    g.beginPath(); g.arc(r, r, r - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#d9c7a4'; g.fillRect(0, 0, D, D);
    g.translate(r, r); g.rotate(rot);
    // the paper map under the hero
    const img = S.world && S.world.mapImage, half = (S.world && S.world.HALF) || 1000;
    if (img && img.width) {
      const mpp = (2 * half) / img.width; // meters per map pixel
      g.save(); g.scale(k * mpp, k * mpp);
      g.drawImage(img, -(hp.x + half) / mpp, -(hp.z + half) / mpp);
      g.restore();
    }
    const W = (x, z) => [(x - hp.x) * k, (z - hp.z) * k];
    // the GPS line
    const tg = target();
    route(hp, tg);
    if (gps.pts && gps.pts.length > 1) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(20,6,8,0.55)'; g.lineWidth = D * 0.034; line(gps.pts, W);
      g.strokeStyle = CRIMSON; g.lineWidth = D * 0.02; line(gps.pts, W);
    }
    // the van, when the hero is not in it
    const van = S.vehicles && S.vehicles.player;
    if (van && !(S.drive && S.drive.riding === van)) { const [x, y] = W(van.pos.x, van.pos.z); g.save(); g.translate(x, y); g.rotate(-van.yaw + Math.PI); g.fillStyle = '#f4efe4'; g.strokeStyle = INK; g.lineWidth = 1.5; g.fillRect(-D * 0.018, -D * 0.04, D * 0.036, D * 0.08); g.strokeRect(-D * 0.018, -D * 0.04, D * 0.036, D * 0.08); g.restore(); }
    // alerted foes: neon dots
    for (const f of (S.combat && S.combat.enemies) || []) {
      if (!f || f.downed || f.tied || !f.pos) continue;
      if (!f.alert && !(S.combat.active && Math.hypot(f.pos.x - hp.x, f.pos.z - hp.z) < 40)) continue;
      const [x, y] = W(f.pos.x, f.pos.z); g.fillStyle = NEON; g.beginPath(); g.arc(x, y, D * 0.022, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // markers (upright, so glyphs read): far ones sit on the rim
    g.save(); g.translate(r, r);
    const cs = Math.cos(rot), sn = Math.sin(rot);
    for (const m of hud.allMarkers()) {
      if (m.hidden) continue;
      const kind = hud.kindOf(m);
      let [x, y] = W(m.x, m.z); [x, y] = [x * cs - y * sn, x * sn + y * cs];
      const d = Math.hypot(x, y), rim = r - D * 0.07, edge = d > rim;
      if (edge) { x *= rim / d; y *= rim / d; }
      const s = D * (edge ? 0.04 : 0.05);
      if (kind === 'giver' || kind === 'cairn') {
        g.fillStyle = 'rgba(12,8,6,0.85)'; g.strokeStyle = CRIMSON; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, s * 1.25, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#f4efe4'; g.font = `${Math.round(s * 1.6)}px "Zhi Mang Xing", "Ma Shan Zheng", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(kind === 'cairn' ? '渦' : GLYPHS[m.who] || m.glyph || '●', x, y + 1);
      } else if (kind === 'danger') { g.fillStyle = NEON; g.beginPath(); g.arc(x, y, s * 0.8, 0, Math.PI * 2); g.fill(); }
      else {
        // the objective (and the waypoint): a crimson diamond with an ink edge
        g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
        g.fillStyle = CRIMSON; g.strokeStyle = '#f4efe4'; g.lineWidth = 2;
        g.fillRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6); g.strokeRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
        g.restore();
      }
    }
    // the hero: an arrow pointing where the hero faces, relative to the view
    const face = S.hero ? S.hero.face : 0, fa = rot + Math.atan2(Math.cos(face), Math.sin(face));
    g.rotate(fa);
    g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(D * 0.06, 0); g.lineTo(-D * 0.04, D * 0.04); g.lineTo(-D * 0.02, 0); g.lineTo(-D * 0.04, -D * 0.04); g.closePath(); g.stroke(); g.fill();
    g.restore();
    // north on the rim
    const na = rot - Math.PI / 2;
    nEl.style.transform = `translate(${(Math.cos(na) * (0.5 * el.clientWidth - 9)).toFixed(1)}px, ${(Math.sin(na) * (0.5 * el.clientWidth - 9)).toFixed(1)}px)`;
  }
  function line(pts, W) { g.beginPath(); pts.forEach((p, i) => { const [x, y] = W(p.x, p.z); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); }

  let shown = false;
  return {
    el,
    tick(raw) {
      const H = S.hero, mode = H ? H.mode : 'foot';
      const cine = !!(S.cine && S.cine.active) || document.body.classList.contains('cine');
      // (inside an interior the paper map would show the empty corner the rooms sit in, so it steps aside)
      const hp = H && H.pos, I = S.world && S.world.interiors;
      const inside = !!(hp && I && I.roomAt && I.roomAt(hp.x, hp.y, hp.z));
      const on = S.mode === 'play' && !!(S.world && S.world.visible) && !cine && !inside && mode !== 'photo' && !(S.photo && S.photo.active);
      if (on !== shown) { shown = on; el.classList.toggle('hidden', !on); acc = 1; }
      if (!on) return;
      acc += raw || 1 / 60;
      if (acc < 1 / HZ) return;
      acc = 0;
      draw();
    },
    get route() { return gps.pts; },
    boxes() { const r = U.box(el); return r ? [['minimap', r]] : []; },
    rect: () => U.box(el),
    reset() { gps = { key: '', pts: null, t: -99, from: null }; shown = false; el.classList.add('hidden'); },
  };
}
