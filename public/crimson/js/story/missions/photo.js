// js/story/missions/photo.js : S.photo, the phone camera (design 4.3).
// - V (the 'camera' action) opens a viewfinder on foot, as a passenger, or at the wheel when stopped. The
//   camera (priority 90) sits at the hero's eyes; the look input aims it, the zoom goes 1x to 8x (FOV 52 to
//   7 degrees). The UI draws the frame (S.ui.photoFrame) with the live score and the focus ring.
// - Subjects (subject(id, spec)) are actors, fighters, vehicles, places or points. A score (0..100) is:
//   framing 20 (the key points inside the inner 80% of the frame), size 30 (full at 0.12 of the screen
//   height, half at 0.06), facing 20 (a face within 60 degrees of the lens; places always get it),
//   visibility 30 (three rays through the colliders and the ground; a subject fully behind something keeps
//   only 35% of the rest). Moving the camera faster than 0.5 rad/s costs 15 ('Hold still'). At night
//   without light on the subject (headlights, a flashlight, a lamp, neon, the ranch floodlights, Uptown's
//   street lights) it costs 40 ('Too dark').
// - shoot(): the photo's record goes in the gallery and the save; its picture is copied from the canvas
//   right after the next frame is drawn (render.js afterDraw) into a 256x144 JPEG, kept in IndexedDB
//   'crimson.photos' (at most 60, the oldest the story does not need go first) with a small copy for the
//   save (D7). Without IndexedDB (or when it throws) the pictures live for the session only.
// - A photo match (F4): reference(placeId) is the pose a picture was taken from (captured behind a card at
//   the start of the step). A shot within 6 m and 12 degrees of it matches.
// - Timer photos (P7, E1): open({timer: 10}) props the phone where the hero stands; the shutter starts the
//   count and the hero walks into the frame.
import { afterDraw } from '../../render.js';
import { CAMERA_PRIO, PHASE_ORDER } from '../types.js';

const DEG = Math.PI / 180;
const FOV0 = 52, MAXZ = 8, MAX_PHOTOS = 60;
const DARK_LOOKS = new Set(['NIGHT', 'MEMORY_NIGHT', 'DEEP_INK', 'VORTEX', 'ARENA']);
export const fovOf = (zoom) => (2 * Math.atan(Math.tan((FOV0 / 2) * DEG) / Math.max(1, Math.min(MAXZ, zoom)))) / DEG;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createPhoto(S, K) {
  const { THREE } = S;
  const st = { active: false, zoom: 1, yaw: 0, pitch: 0, prev: 'foot', min: 50, label: '', note: '', score: null, best: null,
    steady: 0, lastDir: new THREE.Vector3(), timer: 0, countdown: null, propped: null, pose: null, refShot: null, refTicks: 0, flashT: -9, hidHero: false, db: 'none', shots: 0 };
  const subjects = new Map(), gallery = [], thumbs = new Map(), smalls = new Map(), refs = new Map();
  const listeners = [];
  const v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), eye = new THREE.Vector3(), dir = new THREE.Vector3();
  const rng = S.rng('photo');

  /* ---------------- IndexedDB (asset storage; no game flow waits on it) ---------------- */
  let dbP = null, db = null;
  function openDb() {
    if (dbP) return dbP;
    dbP = new Promise((res) => {
      try {
        const I = typeof indexedDB !== 'undefined' ? indexedDB : null;
        if (!I) { st.db = 'none'; res(null); return; }
        const rq = I.open('crimson.photos', 1);
        rq.onupgradeneeded = () => { try { rq.result.createObjectStore('photos', { keyPath: 'id' }); } catch (e) { /* exists */ } };
        rq.onsuccess = () => { db = rq.result; st.db = 'ok'; res(db); };
        rq.onerror = () => { st.db = 'error'; res(null); };
        rq.onblocked = () => { st.db = 'error'; res(null); };
      } catch (e) { st.db = 'error'; res(null); }
    });
    return dbP;
  }
  function dbDo(mode, fn) {
    openDb().then((d) => { if (!d) return; try { const tx = d.transaction('photos', mode); fn(tx.objectStore('photos')); tx.onerror = () => {}; } catch (e) { st.db = 'error'; } }, () => {});
  }
  // load the stored pictures of the saved photos into memory (the board and the wall read them)
  function loadStored(ids) {
    const want = new Set(ids);
    openDb().then((d) => {
      if (!d) return;
      try {
        const rq = d.transaction('photos', 'readonly').objectStore('photos').getAll();
        rq.onsuccess = () => { for (const r of rq.result || []) if (r && want.has(r.id) && typeof r.url === 'string' && !thumbs.has(r.id)) thumbs.set(r.id, r.url); K.evidenceDirty(); };
      } catch (e) { st.db = 'error'; }
    }, () => {});
  }

  /* ---------------- subjects ---------------- */
  // spec: {actor} | {fighter} | {vehicle} | {x, y?, z, h?, w?} | {place}; kind 'face' | 'place' | 'thing'; label;
  // lit / neon (light of its own); group: [actors] (every one of them should be in the picture)
  function subject(id, spec = {}) {
    const s = { id, label: spec.label || '', kind: spec.kind || (spec.actor || spec.fighter ? 'face' : spec.vehicle ? 'thing' : 'place'), lit: !!spec.lit, neon: !!spec.neon, h: spec.h, w: spec.w };
    if (spec.fighter) s.actor = spec.fighter.a, s.fighter = spec.fighter;
    else if (spec.actor) s.actor = spec.actor;
    else if (spec.vehicle) s.vehicle = spec.vehicle;
    else if (spec.group) s.group = spec.group.filter(Boolean);
    else if (spec.place) { const p = S.world.place(spec.place); if (p) { s.point = { x: p.x, y: p.y, z: p.z }; s.h = s.h ?? Math.max(4, (p.r || 8) * 0.8); s.w = s.w ?? p.r; } }
    else if (Number.isFinite(spec.x)) s.point = { x: spec.x, y: Number.isFinite(spec.y) ? spec.y : S.world.surface(spec.x, spec.z), z: spec.z };
    subjects.set(id, s);
    return s;
  }
  // the points to check on a subject: [feet or base, middle, head or top], its height, its facing
  function pointsOf(s, out) {
    out.length = 0;
    if (s.actor || s.fighter) {
      const a = s.fighter ? s.fighter.a : s.actor;
      if (!a || !a.root) return null;
      const r = a.root.position, sc = a.root.scale ? a.root.scale.y : 1, hgt = (s.h || 1.8) * sc;
      const head = a.bone && a.bone('Head');
      let hx = r.x, hy = r.y + hgt * 0.93, hz = r.z;
      if (head) { head.getWorldPosition(v4); if (Number.isFinite(v4.y) && Math.abs(v4.y - r.y) < 4) { hx = v4.x; hy = v4.y + 0.08; hz = v4.z; } }
      out.push([r.x, r.y + 0.12, r.z], [r.x, r.y + hgt * 0.62, r.z], [hx, hy, hz]);
      return { h: hgt, yaw: a.root.rotation.y, x: r.x, y: r.y, z: r.z, visible: a.visible !== false };
    }
    if (s.vehicle) {
      const v = s.vehicle; if (!v.pos) return null;
      const hh = v.h || 2.2, f = Math.sin(v.yaw), c = Math.cos(v.yaw), hd = v.hd || 2.5;
      out.push([v.pos.x - f * hd * 0.8, v.pos.y + 0.6, v.pos.z - c * hd * 0.8], [v.pos.x, v.pos.y + hh * 0.6, v.pos.z], [v.pos.x + f * hd * 0.8, v.pos.y + hh * 0.9, v.pos.z + c * hd * 0.8]);
      return { h: hh, yaw: v.yaw, x: v.pos.x, y: v.pos.y, z: v.pos.z, visible: true };
    }
    if (s.point) {
      const p = s.point, hh = s.h || 3;
      out.push([p.x, p.y + Math.min(0.5, hh * 0.1), p.z], [p.x, p.y + hh * 0.5, p.z], [p.x, p.y + hh, p.z]);
      return { h: hh, yaw: 0, x: p.x, y: p.y, z: p.z, visible: true };
    }
    return null;
  }
  const dark = () => {
    const L = S.look || {};
    if (L.clockDriven) return !!S.day.night;
    return DARK_LOOKS.has(L.name) || (L.name === 'DUSK' && (S.day.hour > 19.6 || S.day.hour < 5.4));
  };
  // is there light on the subject at (x, y, z)?
  function lit(s, info) {
    if (s.lit || s.neon) return true;
    const a = s.fighter ? s.fighter.a : s.actor;
    if (a && a.limbGlow && Object.keys(a.limbGlow).length && (a.drainK ?? 0) < 0.5) return true; // the Bear's neon
    if (s.fighter && (s.fighter.flashlight || (s.fighter.def && s.fighter.def.neon))) return true;
    const x = info.x, y = info.y, z = info.z;
    if (y < -200) return true; // in a room, the lamps are on
    const L = S.look && S.look.lights;
    if (L) {
      for (const sp of L.spots || []) {
        if (!(sp.intensity > 0) || !sp.visible) continue;
        const d = Math.hypot(sp.position.x - x, sp.position.z - z); if (d > 45) continue;
        if (sp.target) { dir.subVectors(sp.target.getWorldPosition(v4), sp.position).normalize(); v4.set(x - sp.position.x, y + 1 - sp.position.y, z - sp.position.z).normalize(); if (dir.dot(v4) < Math.cos(Math.min(1.2, (sp.angle || 0.6) * 1.5))) continue; }
        return true;
      }
      for (const p of L.points || []) if (p.intensity > 0 && Math.hypot(p.position.x - x, p.position.z - z) < 12 && Math.abs(p.position.y - y) < 8) return true;
    }
    for (const w of (S.stealth && S.stealth.list) || []) { const f = w.f || w; if (f && (w.flashlight || f.flashlight) && !f.downed && f.pos && Math.hypot(f.pos.x - x, f.pos.z - z) < 26) return true; }
    for (const v of (S.vehicles && S.vehicles.list) || []) {
      if (!v.lights || !v.pos) continue;
      const dx = x - v.pos.x, dz = z - v.pos.z, d = Math.hypot(dx, dz);
      if (d < 35 && (dx * Math.sin(v.yaw) + dz * Math.cos(v.yaw)) > d * 0.7) return true;
    }
    if (S.world && S.world.ranch && S.world.ranch.on) { const r = S.world.place('hart_ranch'); if (r && Math.hypot(r.x - x, r.z - z) < 70) return true; }
    if (S.world && S.world.regionAt && S.world.regionAt(x, z) === 'uptown' && S.world.roadDist(x, z) < 22) return true; // street lights
    return false;
  }
  const pts = [], scr = [];
  // score one subject from the current camera
  function scoreOf(s, cam = S.camera) {
    if (s.group) {
      if (!s.group.length) return { score: 0, note: '', frame: 0 };
      let sum = 0, fr = 0, note = '', cx = 0, cy = 0, n = 0;
      for (const a of s.group) { const r = scoreOf({ id: s.id, actor: a, kind: 'face', label: s.label }, cam); sum += r.score; fr += r.frame; if (r.note && !note) note = r.note; if (r.center) { cx += r.center.x; cy += r.center.y; n++; } }
      return { score: sum / s.group.length, note, frame: fr / s.group.length, center: n ? { x: cx / n, y: cy / n, r: 0.2 } : null };
    }
    const info = pointsOf(s, pts);
    if (!info || !info.visible) return { score: 0, note: '', frame: 0 };
    cam.updateMatrixWorld(); cam.getWorldDirection(dir);
    let inFrame = 0, front = 0;
    scr.length = 0;
    for (const p of pts) {
      v3.set(p[0], p[1], p[2]);
      const ahead = (v3.x - cam.position.x) * dir.x + (v3.y - cam.position.y) * dir.y + (v3.z - cam.position.z) * dir.z > 0.2;
      v3.project(cam);
      scr.push([v3.x, v3.y, ahead]);
      if (ahead) { front++; if (Math.abs(v3.x) <= 0.8 && Math.abs(v3.y) <= 0.8) inFrame++; }
    }
    const frameK = inFrame / pts.length;
    if (!front || !inFrame) return { score: 0, note: front ? '' : '', frame: 0 };
    // size: the height it covers on screen (NDC spans 2)
    const hFrac = Math.abs(scr[2][1] - scr[0][1]) / 2;
    const sizeK = clamp(hFrac / 0.12, 0, 1);
    // three rays from the lens; a subject far out gets a little slack at the end of the ray
    // (a place is seen when the ray reaches its own bulk: a butte's middle is inside the rock)
    const slack = s.point ? Math.max(0.6, (s.w || 1.2) * 0.9) : 0.6;
    let seen = 0;
    for (const p of pts) {
      v4.set(p[0], p[1], p[2]);
      const len = cam.position.distanceTo(v4);
      const t = S.world.colliders.raycast(cam.position, v4);
      if (t == null || t * len > len - slack) seen++;
    }
    const visK = seen / pts.length;
    let faceK = 1;
    if (s.kind === 'face') {
      const toCam = Math.atan2(cam.position.x - info.x, cam.position.z - info.z);
      const off = Math.abs(wrap(toCam - info.yaw)) / DEG;
      faceK = off <= 60 ? 1 : Math.max(0, 1 - (off - 60) / 30);
    }
    let score = 20 * frameK + 30 * sizeK + 20 * faceK + 30 * visK;
    if (seen === 0) score *= 0.35;
    let note = '';
    if (seen === 0) note = 'Something is in the way';
    else if (sizeK < 0.5) note = 'Too far. Zoom in.';
    else if (s.kind === 'face' && faceK < 1) note = 'Get the face';
    if (st.steady > 0.5 && !st.propped) { score -= 15; note = 'Hold still'; }
    if (dark() && !lit(s, info)) { score -= 40; note = 'Too dark'; }
    const cx = (scr[1][0] + 1) / 2, cy = (1 - scr[1][1]) / 2;
    return { score: clamp(score, 0, 100), note, frame: frameK, size: hFrac, vis: visK, face: faceK, center: { x: clamp(cx, 0, 1), y: clamp(cy, 0, 1), r: clamp(hFrac * 0.6, 0.04, 0.3) } };
  }
  // the subject in the picture that scores best (nearest the middle breaks a tie)
  function bestNow() {
    let best = null;
    for (const s of subjects.values()) {
      const r = scoreOf(s);
      if (!r.frame) continue;
      const mid = r.center ? Math.hypot(r.center.x - 0.5, r.center.y - 0.5) : 1;
      if (!best || r.score > best.r.score + 0.5 || (Math.abs(r.score - best.r.score) <= 0.5 && mid < best.mid)) best = { s, r, mid };
    }
    return best;
  }

  /* ---------------- the viewfinder camera ---------------- */
  function eyeOf(out) {
    const H = S.hero;
    if (st.pose) return out.set(st.pose.x, st.pose.y, st.pose.z);
    if (st.propped) return out.copy(st.propped);
    const a = H.actor, head = a && a.bone && a.bone('Head');
    if ((H.mode === 'photo' && st.prev !== 'foot') && head) { head.getWorldPosition(out); if (Number.isFinite(out.y)) return out.addScaledVector(dir.set(Math.sin(st.yaw), 0, Math.cos(st.yaw)), 0.3); }
    const v = S.drive && S.drive.riding;
    if (v) return out.set(v.pos.x, v.pos.y + 1.75, v.pos.z);
    return out.set(H.pos.x + Math.sin(st.yaw) * 0.28, H.pos.y + (H.crouch ? 1.05 : 1.62), H.pos.z + Math.cos(st.yaw) * 0.28);
  }
  function aimCamera() {
    eyeOf(eye);
    const cp = Math.cos(st.pitch);
    S.camera.position.copy(eye);
    S.camera.lookAt(eye.x + Math.sin(st.yaw) * cp, eye.y + Math.sin(st.pitch), eye.z + Math.cos(st.yaw) * cp);
    const f = fovOf(st.zoom);
    if (Math.abs(S.camera.fov - f) > 1e-4) { S.camera.fov = f; S.camera.updateProjectionMatrix(); }
  }
  S.cameras.add('photo', CAMERA_PRIO.photo, () => st.active && !!S.world && S.world.visible, () => aimCamera());
  // a reference shot for a photo match: one frame from the reference pose, copied after it is drawn
  S.cameras.add('photoRef', CAMERA_PRIO.photo + 5, () => !!st.refShot, () => {
    const r = st.refShot, cp = Math.cos(r.pitch || 0);
    S.camera.position.set(r.x, r.y, r.z);
    S.camera.lookAt(r.x + Math.sin(r.yaw) * cp, r.y + Math.sin(r.pitch || 0), r.z + Math.cos(r.yaw) * cp);
    if (Math.abs(S.camera.fov - FOV0) > 1e-4) { S.camera.fov = FOV0; S.camera.updateProjectionMatrix(); }
  });

  const canOpen = () => {
    const H = S.hero;
    if (!H || !H.actor || !S.world || !S.world.visible || S.mode !== 'play' || S.lockControl || (S.cine && S.cine.active) || H.down || S.modal) return false;
    if (H.mode === 'drive') { const v = S.drive && S.drive.riding; if (v && Math.abs(v.speed) > 1) { if (S.ui) S.ui.toast('Stop the van first.'); return false; } }
    if (H.mode === 'foot' && H.state && H.state !== 'move') return false;
    return true;
  };
  function open(o = {}) {
    if (st.active) { apply(o); return true; }
    if (!o.force && !canOpen()) return false;
    const H = S.hero;
    st.active = true; P.active = true;
    st.prev = H.mode === 'photo' ? 'foot' : H.mode;
    S.camera.getWorldDirection(dir);
    st.yaw = Math.atan2(dir.x, dir.z); st.pitch = clamp(Math.asin(clamp(dir.y, -1, 1)), -0.6, 0.6);
    st.zoom = 1; st.steady = 0; st.lastDir.copy(dir); st.countdown = null; st.propped = null; st.pose = null; st.note = ''; st.best = null;
    apply(o);
    if (o.timer) {
      // the phone stands where the hero is, looking back the way the camera looked; the hero stays on foot
      eyeOf(eye); st.propped = eye.clone();
      st.timerSec = o.timer;
    } else {
      H.setMode('photo');
      if (H.actor && st.prev === 'foot') { S.cast.pose(H.actor, 'photo', 1); H.actor.visible = false; st.hidHero = true; }
    }
    S.ui.photoFrame(true, { zoom: 1, score: null, min: st.min, subject: st.label, note: '', countdown: null, selfie: false });
    if (S.audio) S.audio.sfx('phoneBuzz', { gain: 0.3 });
    return true;
  }
  function apply(o) { if (o.min != null) st.min = o.min; if (o.subject != null || o.label != null) st.label = o.subject ?? o.label ?? ''; if (o.zoom) st.zoom = clamp(o.zoom, 1, MAXZ); }
  function close() {
    if (!st.active) return;
    const H = S.hero;
    st.active = false; P.active = false; st.countdown = null; st.pose = null;
    if (st.propped) { st.propped = null; if (S.input && S.input.setContext) S.input.setContext(null); }
    if (H && H.mode === 'photo') H.setMode(st.prev === 'photo' ? 'foot' : st.prev);
    if (H && H.actor) { if (st.hidHero) H.actor.visible = true; if (st.prev === 'foot') S.cast.pose(H.actor, 'photo', 0); }
    st.hidHero = false; st.min = 50; st.label = '';
    S.ui.photoFrame(false);
  }

  /* ---------------- the shot ---------------- */
  function shoot(o = {}) {
    if (!st.active && !o.force) return null;
    if (st.active) aimCamera();
    const b = bestNow();
    const n = ++st.shots;
    const id = `ph${String(K.photoCount() + 1).padStart(3, '0')}${Math.floor(rng() * 1296).toString(36).padStart(2, '0')}`;
    const cam = S.camera; cam.getWorldDirection(dir);
    const photo = { id, subject: b ? b.s.id : 'scene', label: b ? b.s.label || '' : '', kind: b ? b.s.kind : 'scene', score: b ? Math.round(b.r.score) : 0, note: b ? b.r.note : '',
      mission: S.missions.active ? S.missions.active.id : null, t: S.time, x: cam.position.x, y: cam.position.y, z: cam.position.z, yaw: Math.atan2(dir.x, dir.z), pitch: Math.asin(clamp(dir.y, -1, 1)), zoom: st.zoom,
      day: S.day.day, hour: S.day.hour, n };
    // a photo match: near a stored reference pose
    for (const [place, r] of refs) {
      const d = Math.hypot(photo.x - r.x, photo.z - r.z), a = Math.abs(wrap(photo.yaw - r.yaw)) / DEG, pa = Math.abs(photo.pitch - (r.pitch || 0)) / DEG;
      if (d <= 6 && a <= 12 && pa <= 15) { photo.match = place; photo.score = Math.max(photo.score, Math.round(100 - d * 4 - a * 2)); if (!b) { photo.subject = place; photo.kind = 'place'; } }
    }
    if (o.score != null) photo.score = o.score; // QA only
    gallery.push(photo);
    K.bumpPhotoCount();
    evict();
    request(photo);
    st.flashT = S.time;
    if (st.active) S.ui.photoFrame(true, { flash: { score: photo.score, text: photo.match ? 'MATCH' : photo.note || photo.label || '' } });
    if (S.audio) S.audio.sfx('shutter', {});
    if (S.look && S.look.base) S.look.base.flash = Math.max(S.look.base.flash || 0, 0.25);
    K.log('photo', photo.subject, photo.score);
    for (const f of listeners.slice()) { try { f(photo); } catch (e) { console.error('[photo] listener', e); } }
    return photo;
  }
  // copy the picture off the canvas right after the next frame reaches it
  function request(photo) {
    afterDraw((canvas) => {
      try {
        const w = canvas.width, h = canvas.height, tw = 256, th = 144;
        const sw = Math.min(w, h * 16 / 9), sh = sw * 9 / 16;
        const c = document.createElement('canvas'); c.width = tw; c.height = th;
        c.getContext('2d').drawImage(canvas, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, tw, th);
        const url = c.toDataURL('image/jpeg', 0.82);
        thumbs.set(photo.id, url);
        const s = document.createElement('canvas'); s.width = 112; s.height = 63;
        s.getContext('2d').drawImage(c, 0, 0, 112, 63);
        smalls.set(photo.id, s.toDataURL('image/jpeg', 0.6));
        photo.w = tw; photo.h = th;
        dbDo('readwrite', (os) => os.put({ id: photo.id, url, t: Date.now() }));
        K.evidenceDirty();
      } catch (e) { console.warn('[photo] capture failed', e); }
    });
  }
  function evict() {
    if (gallery.length <= MAX_PHOTOS) return;
    const keep = K.neededPhotos();
    while (gallery.length > MAX_PHOTOS) {
      const i = gallery.findIndex((p) => !keep.has(p.id));
      if (i < 0) break;
      const [p] = gallery.splice(i, 1);
      thumbs.delete(p.id); smalls.delete(p.id);
      dbDo('readwrite', (os) => os.delete(p.id));
    }
  }
  // a reference pose for a photo match: the place, facing its yaw, at eye height; its picture is copied
  // from one frame drawn from there (behind the step's card)
  function captureReference(placeId, pose) {
    const p = pose || S.world.place(placeId);
    if (!p) return null;
    const r = { place: placeId, x: p.x, y: (p.y ?? S.world.surface(p.x, p.z)) + (pose && pose.eye != null ? pose.eye : 1.6), z: p.z, yaw: p.yaw || 0, pitch: pose && pose.pitch || 0, thumb: '' };
    refs.set(placeId, r);
    st.refShot = r; st.refTicks = 0;
    afterDraw((canvas) => {
      try {
        const c = document.createElement('canvas'); c.width = 256; c.height = 144;
        const w = canvas.width, h = canvas.height, sw = Math.min(w, h * 16 / 9), sh = sw * 9 / 16;
        c.getContext('2d').drawImage(canvas, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, 256, 144);
        r.thumb = c.toDataURL('image/jpeg', 0.8);
      } catch (e) { /* no picture */ }
      if (st.refShot === r) st.refShot = null;
    });
    return r;
  }

  /* ---------------- per tick ---------------- */
  // open and close on V, aim, zoom, the shutter, the self-timer
  S.register('control', (cdt, rdt) => {
    const I = S.input;
    if (!st.active) {
      if (I.pressed('camera') && !K.photoLocked()) { if (open()) I.consume('camera'); }
      return;
    }
    if (st.propped && st.countdown != null) return; // the hero is walking into the picture
    if (I.pressed('camera') || I.pressed('back')) { I.consume('camera', 'back'); close(); return; }
    const lk = I.axis('look'), z = I.axis('zoom');
    const rate = 1.25 / Math.sqrt(st.zoom);
    st.yaw -= lk.x * rate * rdt; st.pitch = clamp(st.pitch - lk.y * rate * 0.8 * rdt, -1.2, 1.2);
    if (z.y) st.zoom = clamp(st.zoom * Math.exp(z.y * 0.99 * rdt), 1, MAXZ);
    if (I.pressed('shutter')) {
      I.consume('shutter');
      if (st.propped) { st.countdown = st.timerSec || 10; if (I.setContext) I.setContext('foot'); if (S.ui) S.ui.toast('Get in the picture.'); }
      else shoot();
    }
  }, PHASE_ORDER.control.interact + 2);
  // the live score, the focus ring, steadiness and the count; the hero's body faces the lens
  S.register('script', (cdt, rdt) => {
    if (st.refShot && ++st.refTicks > 3) st.refShot = null; // no frame was drawn (a stepped test): give the view back
    if (!st.active) return;
    const H = S.hero;
    if (!H || !S.world.visible || (S.cine && S.cine.active) || H.down) { close(); return; }
    if (H.mode !== 'photo' && !st.propped) { close(); return; }
    S.camera.getWorldDirection(dir);
    const ang = Math.acos(clamp(dir.dot(st.lastDir), -1, 1));
    st.lastDir.copy(dir);
    if (rdt > 0) st.steady += (ang / rdt - st.steady) * Math.min(1, rdt * 8);
    if (H.actor && st.prev === 'foot' && !st.propped) { H.face = st.yaw; H.actor.root.rotation.y = st.yaw; }
    if (st.countdown != null) {
      st.countdown -= rdt;
      if (st.countdown <= 0) { st.countdown = null; if (S.input.setContext) S.input.setContext(null); shoot(); }
    }
    const b = bestNow();
    st.best = b; st.score = b ? b.r.score : null; st.note = b ? b.r.note : '';
    S.ui.photoFrame(true, { zoom: st.zoom, score: st.score, min: st.min, subject: st.label, note: st.note, focus: b && b.r.center ? b.r.center : null, countdown: st.countdown });
  }, 5);

  const P = S.photo = {
    active: false, gallery,
    open, close, shoot: () => shoot(),
    best(slot) {
      const id = slot && S.evidence.slots[slot];
      if (id) return gallery.find((p) => p.id === id) || null;
      let b = null; for (const p of gallery) if (!slot || p.subject === slot) if (!b || p.score > b.score) b = p; return b;
    },
    thumb: (id) => thumbs.get(id) || '',
    reference: (placeId) => refs.get(placeId) || null,
    // extras for missions and content: subjects, shot listeners, reference captures
    subject, unsubject: (id) => subjects.delete(id), get subjects() { return subjects; },
    onShot(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    captureReference, scoreOf: (id) => { const s = subjects.get(id); return s ? scoreOf(s) : null; },
    get zoom() { return st.zoom; }, get score() { return st.score; }, get note() { return st.note; }, get countdown() { return st.countdown; },
  };
  return {
    P, st, subjects, gallery, thumbs, smalls, refs, open, close, shoot, subject, scoreOf, captureReference,
    unsubject: (id) => subjects.delete(id), info: (s) => pointsOf(s, []),
    get active() { return st.active; },
    prevMode: () => (st.active ? st.prev : S.hero ? S.hero.mode : 'foot'),
    list: () => gallery,
    small: (id) => smalls.get(id) || '',
    // put the camera at a pose (QA and aim): {x, y, z, yaw, pitch, zoom}
    pose(p) { st.pose = p ? { ...p } : null; if (p) { st.yaw = p.yaw ?? st.yaw; st.pitch = p.pitch ?? 0; if (p.zoom) st.zoom = p.zoom; aimCamera(); } },
    aimCamera,
    // a new session: the gallery from the save, the pictures from IndexedDB
    reset(save) {
      if (st.active) close();
      subjects.clear(); refs.clear(); gallery.length = 0; st.shots = 0; st.refShot = null;
      for (const p of (save && save.photos) || []) gallery.push({ ...p });
      for (const [id, u] of Object.entries((save && save.thumbs) || {})) { smalls.set(id, u); }
      loadStored(gallery.map((p) => p.id));
    },
    openDb,
  };
}
