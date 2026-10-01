// js/story/cast/talk.js : talking mouths. When a line is spoken (a dialogue box, a subtitle, a cine line),
// the speaker's mouth opens and closes with the words, and the head gives a small nod on stressed words.
//
// - The voice: the line's text becomes a track of mouth shapes at a speaking pace (about six syllables a
//   second): each syllable opens from its first consonant (m, b and p close the lips, f and v nearly) to
//   its vowel (a: open, o and u: round, e, i and y: wide), a short rest between words, the mouth shut on a
//   comma (0.2 s) and at a full stop (0.35 s). Stressed words (ALL CAPS, before a '!', or the longest word
//   of a sentence) open wider and nod the head. A line in parentheses is a thought: no mouth moves.
// - The mouth: a small mesh on the Head bone at the lips (an opening, a strip of upper teeth and the lower
//   lip's shadow), scaled per frame and eased towards the shape (about 50 ms), hidden when closed so the
//   painted mouth shows. It works on every body: the code-built bodies say where their painted mouth is
//   (bodygen.js userData.mouth); on a GLB the lips are found once per geometry from the face's profile
//   (the nose tip, the chin, the mouth a third of the way down between them). Nothing is uploaded per
//   frame: three shared geometries, three shared materials, one Group per actor that has spoken.
// - Who speaks: the UI's voices (S.ui.voices: the box and the subtitle), resolved to the nearest visible
//   actor of that cast id ('pick' and 'hero' are the player's friend; 'all' is the crew near the camera).
//   Only speakers move. The mouth stops when the track ends, when the box line is skipped to its end (it
//   finishes the word), and when the line goes away.
import * as THREE from 'three';
import { CREW_IDS } from '../types.js';
import { rigOf, findSkinned } from './rig.js';

/* ------------------------------------------------------------------ the voice: text to a track */
// shapes: [width, height] of the opening, as a share of the mouth's width
export const SHAPES = Object.freeze({ closed: [0.7, 0], slight: [0.78, 0.13], open: [0.86, 0.4], O: [0.52, 0.42], wide: [1, 0.24] });
const VOWEL = { a: 'open', o: 'O', u: 'O', e: 'wide', i: 'wide', y: 'wide' };
const ONSET = { m: 'closed', b: 'closed', p: 'closed', f: 'slight', v: 'slight', w: 'O', q: 'O' };
const trackCache = new Map();
// -> { keys: [{t, shape, amp}], dur, nods: [{t, k}] }; t in seconds from the start of the line
export function speechTrack(text) {
  text = String(text || '');
  let tr = trackCache.get(text);
  if (tr) return tr;
  const keys = [], nods = [];
  let t = 0.06;
  const key = (shape, amp = 1) => keys.push({ t, shape, amp });
  const silent = /^\s*\(.*\)\s*$/.test(text) || !/[a-z0-9]/i.test(text);
  if (!silent) {
    // sentences, for the one stressed long word each
    const tokens = text.match(/[A-Za-z0-9'’]+|[.!?…]+|[,;:]|[-–—]/g) || [];
    const stressAt = new Set();
    let best = -1, bestLen = 4;
    tokens.forEach((w, i) => {
      if (/^[.!?…]+$/.test(w)) { if (best >= 0) stressAt.add(best); best = -1; bestLen = 4; return; }
      const n = w.replace(/[^a-z]/gi, '').length;
      if (n > bestLen) { best = i; bestLen = n; }
      if (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) stressAt.add(i);
      if (tokens[i + 1] === '!' || (tokens[i + 1] && tokens[i + 1][0] === '!')) stressAt.add(i);
    });
    if (best >= 0) stressAt.add(best);
    tokens.forEach((w, i) => {
      if (/^[,;:]$/.test(w)) { key('closed'); t += 0.2; return; }
      if (/^[-–—]$/.test(w)) { key('closed'); t += 0.12; return; }
      if (/^[.!?…]+$/.test(w)) { key('closed'); t += w.length > 1 || w === '…' ? 0.45 : 0.34; return; }
      const low = w.toLowerCase().replace(/[’']/g, '');
      // digits say about a syllable each
      const sylls = /^[0-9]+$/.test(low) ? low.split('').map((d) => ({ on: 't', v: 'a', n: 3 })) : syllables(low);
      const stress = stressAt.has(i);
      sylls.forEach((s, k) => {
        const d = Math.min(0.26, Math.max(0.13, 0.1 + 0.022 * s.n)) * (stress ? 1.12 : 1);
        const t0 = t;
        const on = ONSET[s.on] || 'slight';
        key(on, 1);
        if (stress && k === 0) nods.push({ t: t0, k: tokens[i + 1] && tokens[i + 1][0] === '!' ? 1.3 : 1 });
        t = t0 + d * (on === 'closed' ? 0.3 : 0.22);
        key(VOWEL[s.v] || 'open', stress ? 1.22 : 1);
        t = t0 + d * 0.78;
        key(VOWEL[s.v] || 'open', stress ? 0.9 : 0.72);
        t = t0 + d;
      });
      // a short rest between words
      const nx = tokens[i + 1];
      if (nx && /^[A-Za-z0-9]/.test(nx)) { key('slight', 0.8); t += 0.04; }
    });
  }
  key('closed');
  tr = { keys, dur: t, nods, silent };
  if (trackCache.size > 400) trackCache.clear();
  trackCache.set(text, tr);
  return tr;
}
// a word into syllables: vowel groups with their leading consonant; a final silent 'e' joins the one before
function syllables(w) {
  const out = [];
  const re = /([^aeiouy]*)([aeiouy]+)/g;
  let m, last = 0;
  while ((m = re.exec(w))) { out.push({ on: m[1] ? m[1][0] : '', v: m[2][0], n: m[0].length }); last = re.lastIndex; }
  if (!out.length) return [{ on: w[0] || '', v: 'e', n: w.length }]; // "hm", "ssh"
  if (out.length > 1 && /[^aeiouy]e$/.test(w) && out[out.length - 1].v === 'e' && out[out.length - 1].n <= 2) { const e = out.pop(); out[out.length - 1].n += e.n; }
  out[out.length - 1].n += w.length - last; // the trailing consonants
  return out;
}
// the target shape at time t of a track (step targets; the mouth eases between them)
export function shapeAt(tr, t) {
  const K = tr.keys;
  if (t < 0 || t >= tr.dur || !K.length) return { shape: 'closed', amp: 1 };
  let lo = 0, hi = K.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (K[mid].t <= t) lo = mid; else hi = mid - 1; }
  return K[lo].t <= t ? K[lo] : { shape: 'closed', amp: 1 };
}
// the nod (radians) at time t: a quick dip on each stressed word that eases back
export function nodAt(tr, t) {
  let n = 0;
  for (const d of tr.nods) {
    const u = t - d.t;
    if (u < 0 || u > 0.7) continue;
    n += d.k * (u < 0.1 ? Math.sin((u / 0.1) * Math.PI / 2) : Math.exp(-(u - 0.1) / 0.2));
  }
  return 0.05 * Math.min(1.4, n);
}

/* ------------------------------------------------------------------ where the lips are */
const tv = new THREE.Vector3();
// rig-space mouth {x, y, z, w} of a skinned body, found once per geometry
export function mouthSpot(mesh, rig, ud = {}) {
  if (ud.mouth) return ud.mouth; // code-built: where bodygen painted it
  const g = mesh.geometry;
  if (g.userData.mouthSpot) return g.userData.mouthSpot;
  const P = g.attributes.position, sk = mesh.skeleton, hi = rig.index.Hips;
  // skin space -> rig space, as rig.js does it
  const bindInv = new THREE.Matrix4().copy(mesh.bindMatrix).invert();
  const hw = new THREE.Matrix4().copy(bindInv).multiply(new THREE.Matrix4().copy(sk.boneInverses[hi]).invert());
  const gpH = new THREE.Vector3().setFromMatrixPosition(hw), s = rig.skinScale;
  const H = rig.worldP.Head, top = H.y + 12, bot = H.y - 11, step = 0.5, n = Math.ceil((top - bot) / step);
  const zmax = new Array(n).fill(null);
  for (let i = 0; i < P.count; i++) {
    tv.fromBufferAttribute(P, i).sub(gpH).divideScalar(s); tv.y += rig.hipsY;
    if (tv.y >= top || tv.y < bot || Math.abs(tv.x - H.x) > 1.6 || tv.z < H.z) continue;
    const k = Math.floor((top - tv.y) / step);
    if (zmax[k] == null || tv.z > zmax[k]) zmax[k] = tv.z;
  }
  const yOf = (k) => top - (k + 0.5) * step;
  // the nose tip: the most forward point from a little under the Head joint to 7.5 cm over it (not as
  // high as a cap's brim)
  let nk = -1;
  for (let k = 0; k < n; k++) { const y = yOf(k); if (zmax[k] == null || y > H.y + 7.5 || y < H.y - 3) continue; if (nk < 0 || zmax[k] > zmax[nk] + 0.05) nk = k; }
  if (nk < 0) { const r = { x: H.x, y: H.y - 1, z: (rig.worldP.headfront ? rig.worldP.headfront.z : H.z + 10), w: 4.6, guess: true }; g.userData.mouthSpot = r; return r; }
  const noseZ = zmax[nk];
  // the chin: going down, the last slice before the face steps back to the neck (three slices in a row
  // more than 3 cm behind the one above; a sparse mesh skips slices, so empty ones do not count)
  const valid = []; for (let k = nk; k < n; k++) if (zmax[k] != null) valid.push(k);
  let ck = -1;
  for (let j = 1; j < valid.length; j++) {
    const ref = zmax[valid[j - 1]];
    const low = (q) => q < valid.length && zmax[valid[q]] < ref - 3;
    if (low(j) && low(j + 1) && low(j + 2)) { ck = valid[j - 1]; break; }
  }
  if (ck < 0) for (const k of valid) if (zmax[k] > noseZ - 6) ck = k;
  const tipY = yOf(nk), chinY = yOf(ck), D = Math.max(4, tipY - chinY);
  const y = tipY - D * 0.58; // lip line between the nose tip and chin
  // the lips: the front of the face around that height
  let z = -Infinity;
  for (let k = 0; k < n; k++) if (zmax[k] != null && Math.abs(yOf(k) - y) <= 1) z = Math.max(z, zmax[k]);
  if (!Number.isFinite(z)) z = noseZ - 1.5;
  const r = { x: H.x, y, z: z + 0.12, w: 4.6 };
  g.userData.mouthSpot = r;
  return r;
}

/* ------------------------------------------------------------------ facial deformation */
// Move the existing lips and jaw in the character's own skinned mesh. There
// is no second mouth plane to position or draw over the painted lips.
function buildMouth(a) {
  const mesh = findSkinned(a.model || a.root); if (!mesh) return null;
  const rig = rigOf(mesh); if (!rig) return null;
  const b = a.bone ? a.bone('Head') : a.bones?.Head; if (!b) return null;
  const ud = a.body?.template?.scene?.userData || a.template?.scene?.userData || a.model?.userData || {};
  const spot = mouthSpot(mesh, rig, ud), original = mesh.geometry;
  const geometry = original.clone(), pos = geometry.attributes.position;
  // GLB positions can be interleaved with normals and UVs. Read through
  // the attribute accessors instead of treating their buffer as packed XYZ.
  const base = new Float32Array(pos.count * 3), affected = [];
  for (let i = 0; i < pos.count; i++) { base[i * 3] = pos.getX(i); base[i * 3 + 1] = pos.getY(i); base[i * 3 + 2] = pos.getZ(i); }
  const gpH = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(mesh.bindMatrix).invert().multiply(new THREE.Matrix4().copy(mesh.skeleton.boneInverses[rig.index.Hips]).invert()));
  const si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight;
  for (let i = 0; i < pos.count; i++) {
    let head = 0;
    for (let j = 0; j < 4; j++) if (si.getComponent(i, j) === rig.index.Head) head += sw.getComponent(i, j);
    if (head < 0.5) continue;
    tv.fromBufferAttribute(pos, i).sub(gpH).divideScalar(rig.skinScale); tv.y += rig.hipsY;
    const dx = tv.x - spot.x, dy = tv.y - spot.y;
    if (Math.abs(dx) > 8 || dy > 2.2 || dy < -9 || tv.z < spot.z - 6) continue;
    const side = 1 - THREE.MathUtils.smoothstep(Math.abs(dx), 3, 8);
    const upper = 1 - THREE.MathUtils.smoothstep(dy, -0.5, 2.2);
    const lower = THREE.MathUtils.smoothstep(dy, -9, -5);
    affected.push({ i, weight: side * upper * lower * head, dx });
  }
  mesh.geometry = geometry;
  const hulls = [];
  (a.model || a.root).traverse(o => { if (o !== mesh && o.isMesh && o.geometry === original) { hulls.push(o); o.geometry = geometry; } });
  // A state marker for QA, with no visible surface of its own.
  const g = new THREE.Group(); g.name = 'face:jaw'; g.visible = false; b.add(g);
  return { g, mesh, geometry, original, hulls, base, affected, w: spot.w, bone: b, rig, spot, cur: { w: SHAPES.closed[0], h: 0 }, nod: 0, nodQ: null, nodSet: null };
}
function shapeMouth(M, w, h) {
  M.g.visible = h > 0.006;
  const p = M.geometry.attributes.position, scale = M.rig.skinScale;
  for (const v of M.affected) {
    const i = v.i, k = v.weight;
    p.setXYZ(i, M.base[i * 3] + v.dx * (w - 0.7) * 0.12 * k * scale,
      M.base[i * 3 + 1] - h * 4.2 * k * scale,
      M.base[i * 3 + 2] + h * 0.7 * k * scale);
  }
  p.needsUpdate = true;
}
function restoreFace(M) {
  if (M.mesh.geometry === M.geometry) M.mesh.geometry = M.original;
  for (const hull of M.hulls) if (hull.geometry === M.geometry) hull.geometry = M.original;
  M.geometry.dispose(); M.g.removeFromParent();
}

/* ------------------------------------------------------------------ the driver */
export function createTalk(S, cast) {
  const mouths = new Map(); // actor -> mouth
  const speakers = new Map(); // actor -> {track, t0, end}
  const xAxis = new THREE.Vector3(), dq = new THREE.Quaternion(), inv = new THREE.Quaternion();
  function mouthOf(a) {
    if (!a || a.disposed) return null;
    let M = mouths.get(a);
    // a body that arrived since (a placeholder swapped for its body) needs its own mouth
    if (M && (M.model !== (a.model || a.root) || M.mesh.geometry !== M.geometry)) { restoreFace(M); mouths.delete(a); M = null; }
    if (!M) {
      if (a.body === null && a.ph) return null; // still the capsule
      M = buildMouth(a); if (!M) return null;
      M.model = a.model || a.root;
      M.gestures = ['Spine', 'RightForeArm'].map((name) => ({ name, bone: a.bone?.(name), q: new THREE.Quaternion(), set: null })).filter((g) => g.bone);
      M.gesture = 0;
      mouths.set(a, M);
    }
    return M;
  }
  // who (a line's speaker) -> the actors that say it
  function actorsOf(who) {
    if (!who) return [];
    const cam = S.camera.position;
    const vis = (a) => {
      if (!a?.root?.parent || a.model?.visible === false || a.lodHidden) return false;
      for (let p = a.root; p; p = p.parent) if (!p.visible) return false;
      return true;
    };
    // The cinematic owns its cast, including the arena's stand-in for the selected friend.
    const directed = S.cine?.actor?.(who);
    if (vis(directed)) return [directed];
    if (who === 'all') return cast.all().filter((a) => CREW_IDS.includes(a.id) && vis(a) && a.root.getWorldPosition(tv).distanceTo(cam) < 14);
    const id = who === 'pick' || who === 'hero' ? CREW_IDS[S.ctx.crewPick] || 'shades' : who;
    let best = null, bd = 40;
    for (const a of cast.all()) {
      if (a.id !== id || !vis(a)) continue;
      const d = a.root.getWorldPosition(tv).distanceTo(cam);
      if (d < bd) { bd = d; best = a; }
    }
    return best ? [best] : [];
  }
  const voiceTime = () => (S.timers ? S.timers.now : S.time || 0);
  // is this voice (from S.ui.voices) still speaking? (the box holds its ▼ until it is done)
  function talking(v) {
    if (!v) return false;
    if (v.audio) return !v.audio.pending && !v.audio.done;
    const tr = speechTrack(v.text);
    if (tr.silent) return false;
    return voiceTime() - v.t0 < endOf(v, tr);
  }
  const endOf = (v, tr) => Math.min(tr.dur, v.cut != null ? Math.max(0, v.cut - v.t0) + 0.18 : Infinity, v.until != null ? v.until - v.t0 : Infinity);
  function update(dt) {
    const now = voiceTime();
    // who speaks now
    const want = new Map();
    const voices = (S.ui && S.ui.voices) || [];
    for (const v of voices) {
      if (!v || !v.text) continue;
      if (v.audio && (v.audio.pending || v.audio.done)) continue;
      const tr = speechTrack(v.text);
      if (tr.silent) continue;
      const audio = v.audio || null;
      for (const a of actorsOf(v.who)) want.set(a, { tr, t: audio ? audio.pending ? 0 : audio.elapsed / Math.max(.01, audio.duration) * tr.dur : now - v.t0, end: audio ? tr.dur : endOf(v, tr), audio });
    }
    for (const [a, s] of speakers) if (!want.has(a) && s.manual) want.set(a, { tr: s.tr, t: now - s.t0, end: s.tr.dur, manual: s });
    // step every mouth: speakers toward their shape, the rest shut
    const k1 = 1 - Math.exp(-dt / 0.045), k2 = 1 - Math.exp(-dt / 0.06);
    for (const a of new Set([...mouths.keys(), ...want.keys()])) {
      if (a.disposed || (a.root && !a.root.parent)) { drop(a); continue; }
      const sp = want.get(a);
      const M = sp || (mouths.get(a) && (mouths.get(a).cur.h > 0.001 || mouths.get(a).nod || mouths.get(a).gesture)) ? mouthOf(a) : null;
      if (!M) continue;
      let tw = SHAPES.closed[0], th = 0, nod = 0;
      if (sp && sp.t < sp.end && !(a.inkK > 0)) {
        const k = shapeAt(sp.tr, sp.t), sh = SHAPES[k.shape] || SHAPES.closed;
        tw = sh[0] * (0.85 + 0.15 * Math.min(1.2, k.amp)); th = sh[1] * k.amp;
        if (sp.audio) th = sp.audio.done ? 0 : Math.max(th * 0.4, sp.audio.energy * 0.36);
        nod = nodAt(sp.tr, sp.t);
      }
      if (sp && sp.manual && sp.t >= sp.end) speakers.delete(a);
      const kk = th > M.cur.h ? k1 : k2;
      M.cur.w += (tw - M.cur.w) * kk; M.cur.h += (th - M.cur.h) * kk;
      if (M.cur.h < 0.004 && th === 0) M.cur.h = 0;
      shapeMouth(M, M.cur.w, M.cur.h);
      M.nod += (nod - M.nod) * (1 - Math.exp(-dt / 0.05));
      if (Math.abs(M.nod) < 1e-4 && nod === 0) M.nod = 0;
      applyNod(M);
      const speaking = sp && sp.t >= 0 && sp.t < sp.end && !sp.tr.silent;
      const gesture = speaking ? Math.sin(sp.t * 4.8) * 0.018 + nod * 0.65 : 0;
      M.gesture += (gesture - M.gesture) * (1 - Math.exp(-dt / 0.12));
      if (!speaking && Math.abs(M.gesture) < 1e-4) M.gesture = 0;
      for (const g of M.gestures) {
        if (g.set && g.bone.quaternion.equals(g.set)) g.bone.quaternion.multiply(inv.copy(g.q).invert());
        xAxis.set(g.name === 'Spine' ? 0 : 1, g.name === 'Spine' ? 1 : 0, 0).applyQuaternion(inv.copy(M.rig.worldQ[g.name]).invert());
        g.q.setFromAxisAngle(xAxis, M.gesture * (g.name === 'Spine' ? 1 : 3));
        g.bone.quaternion.multiply(g.q);
        g.set = (g.set || new THREE.Quaternion()).copy(g.bone.quaternion);
      }
      M.speaking = !!(sp && sp.t < sp.end);
    }
  }
  // the nod: a turn of the Head about the body's left-right axis, laid over whatever the clip set (it
  // takes the last one back first when no clip wrote the bone since)
  function applyNod(M) {
    const b = M.bone;
    if (M.nodSet && M.nodQ && b.quaternion.equals(M.nodSet)) b.quaternion.multiply(inv.copy(M.nodQ).invert());
    if (!M.nod) { M.nodQ = null; M.nodSet = null; return; }
    xAxis.set(1, 0, 0).applyQuaternion(inv.copy(M.rig.worldQ.Head).invert());
    M.nodQ = (M.nodQ || new THREE.Quaternion()).setFromAxisAngle(xAxis, M.nod);
    b.quaternion.multiply(M.nodQ);
    M.nodSet = (M.nodSet || new THREE.Quaternion()).copy(b.quaternion);
  }
  function drop(a) {
    const M = mouths.get(a);
    if (M) { if (M.nodSet && M.nodQ && M.bone.quaternion.equals(M.nodSet)) M.bone.quaternion.multiply(inv.copy(M.nodQ).invert()); restoreFace(M); }
    if (M) for (const g of M.gestures) if (g.set && g.bone.quaternion.equals(g.set)) g.bone.quaternion.multiply(inv.copy(g.q).invert());
    mouths.delete(a); speakers.delete(a);
  }
  return {
    update, talking, drop, mouthOf, actorsOf,
    // a line said by an actor directly (not through the UI): S.cast.talk.say(actor, text)
    say(a, text) { if (!a) return null; const tr = speechTrack(text); speakers.set(a, { tr, t0: voiceTime(), manual: true }); return { get done() { return !speakers.has(a); }, dur: tr.dur }; },
    stop(a) { speakers.delete(a); },
    // QA: how open an actor's mouth is (0 shut, about 0.4 wide open) and its nod
    state(a) { const M = mouths.get(a); return M ? { h: M.cur.h, w: M.cur.w, nod: M.nod, visible: M.g.visible, speaking: !!M.speaking } : { h: 0, w: 0, nod: 0, visible: false, speaking: false }; },
    get count() { return mouths.size; },
    clear() { for (const a of [...mouths.keys()]) drop(a); speakers.clear(); },
  };
}
