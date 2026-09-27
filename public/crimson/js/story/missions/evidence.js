// js/story/missions/evidence.js : S.evidence, the four things Agent Vance needs (FACE, PLACE, DATE) and the
// optional LINK, each the id of one of the player's own photos. It also paints Gabe's evidence wall in the
// Airstream (S.world.interiors.wall('airstream')): a cork board with the four slots as pinned prints, the
// player's F5 photo pinned beside Gabe's own shot of their van (P1: "Two photos. Same minute. Wrong
// people."), and crimson string between them. A slot whose picture is gone shows a 'PHOTO LOST' card (D7).
// The prints come from S.photo.thumb(id), or the small copy kept in the save.
import { EVIDENCE } from '../types.js';

const W = 1024, H = 600;
const LABEL = { face: 'FACE', place: 'PLACE', date: 'DATE', link: 'LINK' };
const NOTE = { face: 'Who runs it?', place: 'Where are they?', date: 'When do they move?', link: 'Who owns the vans?' };

export function createEvidence(S, K) {
  const slots = { face: null, place: null, date: null, link: null };
  const imgs = new Map(); // data URL -> Image (loading or loaded)
  let dirty = true, wall = null, tex = null, canvas = null, lastPaint = -9;
  const E = S.evidence = {
    slots,
    set(slot, id) {
      if (!EVIDENCE.includes(slot)) { console.warn(`S.evidence.set: unknown slot '${slot}'`); return; }
      const v = id == null ? null : typeof id === 'object' ? id.id ?? null : String(id);
      if (slots[slot] === v) return;
      slots[slot] = v; dirty = true;
      K.log('evidence', slot, !!v);
      if (v && S.ui && S.ui.toast) S.ui.toast(`${LABEL[slot]} ADDED TO THE EVIDENCE`);
    },
    get: (slot) => slots[slot] ?? null,
    // extras: how many of FACE, PLACE and DATE are in, and a repaint request
    get count() { return ['face', 'place', 'date'].filter((k) => slots[k]).length; },
    touch() { dirty = true; },
  };

  function thumbUrl(id) {
    if (!id) return '';
    let u = '';
    try { u = (S.photo && S.photo.thumb(id)) || ''; } catch (e) { u = ''; }
    if (!u) { try { const t = S.save.get().thumbs; u = (t && t[id]) || ''; } catch (e) { u = ''; } }
    return u;
  }
  // an image for a data URL; it repaints the wall once it has loaded (asset loading, not game flow)
  function image(url) {
    if (!url) return null;
    let im = imgs.get(url);
    if (!im) { im = new Image(); im.onload = () => { dirty = true; }; im.src = url; imgs.set(url, im); if (imgs.size > 40) imgs.delete(imgs.keys().next().value); }
    return im.complete && im.naturalWidth ? im : null;
  }
  const rnd = (i) => { const x = Math.sin(i * 91.7 + 3.1) * 43758.5; return x - Math.floor(x); };

  function cork(g) {
    g.fillStyle = '#9a7248'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 2600; k++) { const r = rnd(k), q = rnd(k + 7000); g.fillStyle = `rgba(${60 + r * 70 | 0},${38 + q * 34 | 0},18,0.28)`; g.fillRect(rnd(k + 11) * W, rnd(k + 23) * H, 2 + r * 3, 2 + q * 2); }
    g.strokeStyle = '#4a3220'; g.lineWidth = 26; g.strokeRect(0, 0, W, H);
    g.fillStyle = 'rgba(30,18,10,0.85)'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'left';
    g.fillText('THE BEAR · SEVEN MONTHS', 34, 56);
  }
  // one pinned print: a white border, the picture (or a note card), a caption, a pin
  function print(g, x, y, w, h, tilt, id, caption, sub) {
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(tilt); g.translate(-w / 2, -h / 2);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(6, 8, w, h + 34);
    g.fillStyle = '#f2ede2'; g.fillRect(0, 0, w, h + 34);
    const url = thumbUrl(id), im = image(url);
    if (im) g.drawImage(im, 8, 8, w - 16, h - 16);
    else {
      g.fillStyle = id ? '#3a3430' : '#d8d0c0'; g.fillRect(8, 8, w - 16, h - 16);
      g.fillStyle = id ? '#e8e0d0' : '#6a5a4a'; g.font = `bold ${Math.round(h * 0.13)}px Georgia, serif`; g.textAlign = 'center';
      g.fillText(id ? (url ? '...' : 'PHOTO LOST') : '?', w / 2, h / 2 + h * 0.05);
    }
    g.fillStyle = '#2a2420'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.fillText(caption, w / 2, h + 16);
    if (sub) { g.font = 'italic 16px Georgia, serif'; g.fillStyle = '#5a4a3a'; g.fillText(sub, w / 2, h + 31); }
    g.restore();
    g.fillStyle = '#8a0f22'; g.beginPath(); g.arc(x + w / 2, y + 4, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x + w / 2 - 2.5, y + 1.5, 2.5, 0, Math.PI * 2); g.fill();
    return [x + w / 2, y + 4];
  }
  // Gabe's own photo of their van: an ink sketch of a white van under the bridge at night
  function gabeShot(g, x, y, w, h, tilt) {
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(tilt); g.translate(-w / 2, -h / 2);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(6, 8, w, h + 34);
    g.fillStyle = '#f2ede2'; g.fillRect(0, 0, w, h + 34);
    g.fillStyle = '#15171b'; g.fillRect(8, 8, w - 16, h - 16);
    g.strokeStyle = '#3a3e46'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h * 1.25, w * 0.62, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.fillStyle = '#d8d6d0'; g.fillRect(w * 0.26, h * 0.5, w * 0.48, h * 0.2); g.fillRect(w * 0.22, h * 0.56, w * 0.1, h * 0.14);
    g.fillStyle = '#20242a'; g.fillRect(w * 0.3, h * 0.53, w * 0.09, h * 0.06); g.fillRect(w * 0.42, h * 0.53, w * 0.09, h * 0.06); g.fillRect(w * 0.54, h * 0.53, w * 0.09, h * 0.06);
    g.fillStyle = '#0c0c0c'; g.beginPath(); g.arc(w * 0.33, h * 0.71, h * 0.045, 0, 7); g.arc(w * 0.66, h * 0.71, h * 0.045, 0, 7); g.fill();
    g.fillStyle = '#e8e2d6'; g.font = '14px monospace'; g.textAlign = 'right'; g.fillText('SUN 2:54 AM', w - 14, h - 14);
    g.fillStyle = '#2a2420'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.fillText("GABE'S", w / 2, h + 16);
    g.font = 'italic 16px Georgia, serif'; g.fillStyle = '#5a4a3a'; g.fillText('their van', w / 2, h + 31);
    g.restore();
    g.fillStyle = '#8a0f22'; g.beginPath(); g.arc(x + w / 2, y + 4, 8, 0, Math.PI * 2); g.fill();
    return [x + w / 2, y + 4];
  }
  function paint() {
    if (!canvas) { canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; }
    const g = canvas.getContext('2d');
    cork(g);
    const pins = [];
    const pw = 190, ph = 118;
    EVIDENCE.forEach((k, i) => {
      const x = 40 + i * 240, y = 110 + (i % 2) * 26, id = slots[k];
      const p = S.photo && id ? S.photo.gallery.find((q) => q.id === id) : null;
      pins.push(print(g, x, y, pw, ph, (rnd(i + 3) - 0.5) * 0.12, id, LABEL[k], id ? (p && p.label) || '' : NOTE[k]));
    });
    // the night the crew met the Bear: their photo of him, his photo of them
    const f5 = S.flags.f5Photo;
    if (f5 || K.doneSet.has('f5') || K.doneSet.has('p1')) {
      pins.push(print(g, 250, 370, pw, ph, -0.05, f5 || null, 'YOURS', 'the Perch, 2:54 AM'));
      pins.push(gabeShot(g, 520, 380, pw, ph, 0.06));
      g.fillStyle = 'rgba(20,12,8,0.85)'; g.font = 'italic 24px Georgia, serif'; g.textAlign = 'left';
      g.fillText('Same minute. Wrong people.', 740, 450);
    }
    // crimson string from pin to pin
    g.strokeStyle = '#a8102a'; g.lineWidth = 3;
    g.beginPath(); pins.forEach(([x, y], i) => { if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
    if (!tex) { tex = new S.THREE.CanvasTexture(canvas); tex.colorSpace = S.THREE.SRGBColorSpace; tex.anisotropy = 4; }
    tex.needsUpdate = true;
    lastPaint = S.time;
  }
  function attach() {
    const I = S.world && S.world.interiors;
    const w = I && I.wall ? I.wall('airstream') : null;
    if (!w || !w.material) return null;
    if (w !== wall) { wall = w; dirty = true; }
    return wall;
  }
  // repaint when something changed, at most twice a second, and only while the wall can be seen
  function update() {
    if (!dirty || S.time - lastPaint < 0.5 || !S.world || !S.world.visible) return;
    const w = attach(); if (!w) return;
    const cam = S.camera.position, wp = w.getWorldPosition(new S.THREE.Vector3());
    if (cam.distanceTo(wp) > 40 && !K.forcePaint) return;
    dirty = false; paint();
    const m = w.material;
    if (m.map !== tex) { m.map = tex; if (m.color) m.color.set(0xffffff); m.needsUpdate = true; }
  }
  function reset(save) {
    for (const k of EVIDENCE) slots[k] = save && save.evidence ? save.evidence[k] ?? null : null;
    dirty = true;
  }
  return { E, update, reset, paint: () => { dirty = false; paint(); return canvas; }, get canvas() { return canvas; }, get texture() { return tex; }, markDirty: () => { dirty = true; } };
}
