// Gloam Downs: the foes' pool. A place's pool is a set of slots, each a copy of one figure's splats (a foe type, the Barrow Reeve, or
// the carried light) appended to the place's data with bone ids after the lamplighter's. A parked slot is at density 0 and is not in
// world.anim.boned, so the sorter does not pay for it; waking a slot puts it on the bones first and then brings its density back.
// No DOM and no imports: the bake's previews and the Node tests pose figures with the same code the page draws with.
//
// A figure's JSON (foes.json.gz or boss.json.gz) gives, for each type: its splat range in its file, its bones { name, parent, pivot,
// hidden }, its markers and its clips. A clip is { dur, loop, at: [shares 0..1], keys: { bone: [[rx, ry, rz, sx, sy, sz, tx, ty, tz],
// one row a key] } }. A bone's key turns it about its pivot (Y, then X, then Z), scales it there and moves it, in its parent's rest
// frame; a bone with no keys in a clip stays at rest (or hidden, if the bone is hidden by default). Bones whose parent is 'ground'
// (the shadow and the markers) are placed by the page, not by a clip.

/* ---------------- 12 numbers a bone: a 3x3 turn by rows, then the move (x' = A x + t), as the renderer reads them ---------------- */
const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
];
const app = (a, v) => [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2]];
export const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
export const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
export const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const scl = (x, y, z) => [x, 0, 0, 0, y, 0, 0, 0, z];
// a bone's transform: { A, t }
const compose = (p, q) => { const t = app(p.A, q.t); return { A: mul(p.A, q.A), t: [t[0] + p.t[0], t[1] + p.t[1], t[2] + p.t[2]] }; };
export const REST_KEY = [0, 0, 0, 1, 1, 1, 0, 0, 0];
export const HIDDEN_KEY = [0, 0, 0, 0, 0, 0, 0, 0, 0];
// below this scale a bone is put away: scaled to 0 and moved far below (a bone at scale 0 still draws a dot, through u_dilate)
const HIDE = 1e-3;
export const PUT_AWAY = { A: [0, 0, 0, 0, 0, 0, 0, 0, 0], t: [0, -500, 0] };
export function writeBone(out, b, { A, t }) {
  const o = 12 * b;
  for (let i = 0; i < 9; i++) out[o + i] = A[i];
  out[o + 9] = t[0]; out[o + 10] = t[1]; out[o + 11] = t[2];
}
const localOf = (pv, k) => {
  const A = mul(mul(rotY(k[1]), mul(rotX(k[0]), rotZ(k[2]))), scl(k[3], k[4], k[5])), ap = app(A, pv);
  return { A, t: [pv[0] + k[6] - ap[0], pv[1] + k[7] - ap[1], pv[2] + k[8] - ap[2]] };
};

/* ---------------- clips ----------------
   A key between keys is a Catmull-Rom blend of its neighbours (wrapped in a loop, held at the ends otherwise), so a few keys give a
   smooth move. Times are in seconds; a clip that does not loop holds its last key after its end. */
export function sampleKey(out, clip, bone, t) {
  const rows = clip.keys[bone];
  if (!rows) return null;
  const at = clip.at, n = at.length;
  if (n === 1) { out.set(rows[0]); return out; }
  let u = clip.dur > 0 ? t / clip.dur : 0;
  u = clip.loop ? u - Math.floor(u) : Math.max(0, Math.min(1, u));
  let i = 0;
  while (i < n - 2 && u > at[i + 1]) i++;
  const span = at[i + 1] - at[i], s = span > 0 ? Math.max(0, Math.min(1, (u - at[i]) / span)) : 0;
  const pick = j => rows[clip.loop ? ((j % n) + n) % n : Math.max(0, Math.min(n - 1, j))];
  // a loop's last key is its first again: step over it when wrapping
  const wrap = j => (clip.loop && (j < 0 || j > n - 1) ? pick(j < 0 ? j - 1 : j + 1) : pick(j));
  const p0 = wrap(i - 1), p1 = rows[i], p2 = rows[i + 1], p3 = wrap(i + 2);
  const s2 = s * s, s3 = s2 * s;
  for (let c = 0; c < 9; c++)
    out[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * s + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * s2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * s3);
  return out;
}

/* Pose one figure: out is the whole bone array, base its first bone. at = { x, y, z, yaw } (the feet, and the way it faces: yaw 0
   faces +z, as the figure was sculpted). Bones placed by the page ('ground') are left as they are. size scales the whole figure, and
   grow ({ bone: k }) scales those bones about their pivots on top of their keys (a tell on a small screen). */
const keyTmp = new Float32Array(9), growTmp = new Float32Array(9);
export function poseFigure(out, base, type, at, clipName, t = 0, { size = 1, keys, grow } = {}) {
  const clip = clipName ? type.clips[clipName] : null;
  if (clipName && !clip) throw new Error(`${type.name} has no clip ${clipName}`);
  const feet = type.feet, s = size;
  const A0 = mul(rotY(at.yaw || 0), scl(s, s, s)), af = app(A0, feet);
  const root = { A: A0, t: [at.x - af[0], at.y - af[1], at.z - af[2]] };
  const world = [];
  for (const b of type.order) {
    const bone = type.bones[b];
    let k = keys?.[bone.name] || (clip && sampleKey(keyTmp, clip, bone.name, t));
    if (!k) k = bone.hidden ? HIDDEN_KEY : REST_KEY;
    const g = grow?.[bone.name];
    if (g && g !== 1) { growTmp.set(k); growTmp[3] *= g; growTmp[4] *= g; growTmp[5] *= g; k = growTmp; }
    const par = bone.parent ? world[type.index[bone.parent]] : root;
    if (!par || par.hidden || Math.min(Math.abs(k[3]), Math.abs(k[4]), Math.abs(k[5])) < HIDE) {
      world[b] = { hidden: true };
      writeBone(out, base + b, PUT_AWAY);
      continue;
    }
    world[b] = compose(par, localOf(bone.pivot, k));
    writeBone(out, base + b, world[b]);
  }
  return world;
}
// the round shadow, flat on the floor under the feet, smaller as the feet rise over it
export function poseShadow(out, base, type, x, floor, z, height = 0, size = 1) {
  const b = type.index.shadow;
  if (b === undefined) return;
  const pv = type.bones[b].pivot, k = size / (1 + 0.45 * Math.max(0, height));
  const A = scl(k, 1, k), ap = app(A, pv);
  writeBone(out, base + b, { A, t: [x - ap[0], floor + 0.04 - ap[1], z - ap[2]] });
}
/* A marker piece laid flat with its pivot at a point on the ground: a ring slice's pivot is the ring's centre, a lane piece's the
   middle of its near end (the lane runs along +z from the figure's feet at rest). yaw turns it, k grows it (kx across and kz along
   default to k), tilt is the ground plane's slope as [dy/dx, dy/dz] in the world, so the piece lies along that plane, and lift is how
   far over the plane it lies. */
export function poseMarker(out, base, type, name, { x, y, z, yaw = 0, k = 1, kx = k, kz = k, tilt = [0, 0], lift = 0.05 }) {
  const b = type.index[name];
  if (b === undefined) throw new Error(`${type.name} has no marker bone ${name}`);
  if (Math.min(kx, kz) < HIDE) { writeBone(out, base + b, PUT_AWAY); return; }
  const shear = [1, 0, 0, tilt[0], 1, tilt[1], 0, 0, 1];
  const A = mul(shear, mul(rotY(yaw), scl(kx, 1, kz))), ap = app(A, type.bones[b].pivot);
  writeBone(out, base + b, { A, t: [x - ap[0], y + lift - ap[1], z - ap[2]] });
}
// a bone set straight in the world, for what flies on its own (the Pitchrook's coal, the lamp-shards, the light carried after the
// fall): its pivot at p, turned by yaw, scaled by s
export function placeBone(out, base, type, name, p, yaw = 0, s = 1) {
  const b = type.index[name], A = mul(rotY(yaw), scl(s, s, s)), ap = app(A, type.bones[b].pivot);
  writeBone(out, base + b, { A, t: [p[0] - ap[0], p[1] - ap[1], p[2] - ap[2]] });
}
export const hideBone = (out, base, type, name) => writeBone(out, base + type.index[name], PUT_AWAY);

/* ---------------- the figures' JSON, ready to pose ----------------
   Each type gets index (bone name -> number) and order: the bones a clip poses, each after its parent */
export function readFigures(json) {
  for (const type of Object.values(json.types)) {
    type.index = Object.fromEntries(type.bones.map((b, i) => [b.name, i]));
    const order = [], seen = new Set();
    const visit = b => {
      if (seen.has(b)) return;
      seen.add(b);
      const p = type.bones[b].parent;
      if (p && p !== 'ground') visit(type.index[p]);
      order.push(b);
    };
    type.bones.forEach((bone, b) => { if (bone.parent !== 'ground') visit(b); });
    type.order = order;
  }
  return json;
}

/* ---------------- the pool ----------------
   makePool(world, meta, slots): world is the place as world.js loads it (its anim holds the lamplighter's bones); slots is a list of
   { code, type, src } with src the figure file's decoded { data } (foes or boss), or { code, reserve: { count, bones } } for a figure
   whose file has not come in yet (the Barrow Reeve and its candles: foes.json.gz holds their counts). The world's data, count and anim
   are replaced with ones that hold the slots. Every slot starts parked; a reserved slot's rows are empty (density 0) and its bones put
   away until fill() copies its figure in. A place's pool is built once: the beacon, the wisps and the awake slots keep their state.
   pool.rows holds the 512-splat rows changed since the page last drew; the page passes them to the renderer as changedRows and clears
   the set. extra splats after the slots are a reserve on no bone, parked at density 0 (the spark pool of sparks.js): pool.extra is
   their range { first, end }. */
// the hit flash: fire slot 35 (ff9a32). Steps 4 and 5, darkened by the outlines and the contact shade, snap to each place's pale greys
// and tans; slot 35 stays fire (qa/lab/gloam-downs-run.lineup.e2e.mjs measures it in the page)
export const FLASH = 0xff + 0x9a * 256 + 0x32 * 65536;
// a figure's rows copied into its slot, parked, with its bone ids moved after the bones before it
function copyIn(data, s) {
  data.set(s.src.data.subarray(s.type.first * 16, s.type.end * 16), s.first * 16);
  for (let i = s.first; i < s.end; i++) {
    const o = i * 16, kind = data[o + 11] % 16;
    data[o + 3] = 0; // parked
    if (kind !== 12 && kind !== 13) continue; // a plain splat (a grave candle) rides no bone: its numbers there are its flicker
    data[o + 12] += s.base;
    if (data[o + 14] > 0) data[o + 13] += s.base;
  }
}
export function makePool(world, meta, slots, { extra = 0 } = {}) {
  const base0 = meta.bones.names.length, lampFirst = meta.bones.first, lampEnd = meta.bones.end, placeCount = world.count;
  let count = placeCount, nb = base0;
  const list = slots.map(({ code, type, src, reserve }, i) => {
    const n = type ? type.end - type.first : reserve.count, nbones = type ? type.bones.length : reserve.bones;
    const s = { i, code, type: type || null, src: src || null, first: count, end: count + n, base: nb, nbones, awake: false, flash: false };
    count += n;
    nb += nbones;
    return s;
  });
  const reserve = { first: count, end: count + extra };
  count += extra;
  const data = new Float32Array(count * 16);
  data.set(world.data.subarray(0, placeCount * 16));
  for (let i = reserve.first; i < reserve.end; i++) { data[i * 16 + 1] = -50; data[i * 16 + 11] = 48; data[i * 16 + 15] = -100; }
  for (const s of list) if (s.type) copyIn(data, s);
  const bones = new Float32Array(12 * nb);
  bones.set(world.anim.bones.subarray(0, 12 * base0));
  for (const s of list) {
    s.bones = bones.subarray(12 * s.base, 12 * (s.base + s.nbones));
    for (let b = 0; b < s.nbones; b++) writeBone(bones, s.base + b, PUT_AWAY);
  }
  world.data = data;
  world.count = count;
  world.anim = { bones, boned: new Int32Array(0) };
  const rows = new Set();
  const touch = s => { for (let r = s.first >> 9; r <= (s.end - 1) >> 9; r++) rows.add(r); };
  // the lamplighter and the awake slots ride the bones; a parked slot is at density 0, so its order does not matter
  const rebuild = () => {
    const on = list.filter(s => s.awake && s.nbones);
    const out = new Int32Array(on.reduce((n, s) => n + s.end - s.first, lampEnd - lampFirst));
    let k = 0;
    for (let i = lampFirst; i < lampEnd; i++) out[k++] = i;
    for (const s of on) for (let i = s.first; i < s.end; i++) out[k++] = i;
    world.anim.boned = out;
  };
  rebuild();
  const density = (s, on) => {
    const src = s.src.data, off = (s.type.first - s.first) * 16;
    for (let i = s.first; i < s.end; i++) data[i * 16 + 3] = on ? src[i * 16 + off + 3] : 0;
    touch(s);
  };
  const slotOf = q => (typeof q === 'number' ? list[q] : q);
  const pool = {
    slots: list, rows, bones, placeCount, extra: reserve,
    // a free slot of this type (code 'S', 'P', 'M', 'I', 'B' or 'L') whose figure is in, or null
    free: code => list.find(s => s.code === code && !s.awake && s.type) || null,
    /* the figure file of a reserved slot has come in: copy its rows into each slot of that code that waits for it, parked. src is the
       file ({ json, data } as figures.js loads it). Nothing else in the place changes */
    fill(code, src) {
      const type = src.json.types[code];
      for (const s of list) {
        if (s.code !== code || s.type) continue;
        if (!type || type.end - type.first !== s.end - s.first || type.bones.length !== s.nbones)
          throw new Error(`the ${code} slot holds ${s.end - s.first} splats on ${s.nbones} bones, the file ${type ? `${type.end - type.first} on ${type.bones.length}` : 'none'}`);
        s.type = type;
        s.src = src;
        type.groundBones ||= groundOf(type);
        copyIn(data, s);
        touch(s);
      }
    },
    // wake a slot at a point: on the bones first, then its density back; it stands at rest until posed again
    wake(q, at, clip = 'rest', t = 0) {
      const s = slotOf(q);
      if (!s.type) throw new Error(`the ${s.code} slot waits for its figure file`);
      s.awake = true;
      rebuild();
      pool.pose(s, at, clip, t);
      density(s, true);
      return s;
    },
    // park a slot: its density to 0 first, then off the bones
    park(q) {
      const s = slotOf(q);
      if (s.flash) pool.flash(s, false);
      density(s, false);
      s.awake = false;
      for (let b = 0; b < s.nbones; b++) writeBone(bones, s.base + b, PUT_AWAY);
      rebuild();
    },
    /* pose a slot from its clip at time t (seconds) at { x, y, z, yaw, floor? }; the shadow lies on floor (default: the feet). The
       markers keep what marker() and hide() last gave them: they are hidden when a slot wakes */
    pose(q, at, clip, t = 0, o = {}) {
      const s = slotOf(q);
      s.at = at;
      const w = poseFigure(bones, s.base, s.type, at, clip, t, o);
      if (s.type.index.shadow !== undefined) poseShadow(bones, s.base, s.type, at.x, at.floor ?? at.y, at.z, at.y - (at.floor ?? at.y), o.size);
      return w;
    },
    marker: (q, name, o) => { const s = slotOf(q); poseMarker(bones, s.base, s.type, name, o); },
    /* move the groups of a plain slot (the grave candles: type.groups is [[first, end, x, y, z], ...], each group's range in its file
       and its base at rest) so each group's base stands at points[g] */
    placeGroups(q, points) {
      const s = slotOf(q), src = s.src.data, shift = s.first - s.type.first;
      s.type.groups.forEach(([a, b, x, y, z], g) => {
        const p = points[g];
        if (!p) return;
        for (let i = a; i < b; i++) {
          const o = (i + shift) * 16, so = i * 16;
          data[o] = src[so] - x + p[0]; data[o + 1] = src[so + 1] - y + p[1]; data[o + 2] = src[so + 2] - z + p[2];
        }
      });
      touch(s);
    },
    place: (q, name, p, yaw, size) => { const s = slotOf(q); placeBone(bones, s.base, s.type, name, p, yaw, size); },
    hide: (q, name) => { const s = slotOf(q); hideBone(bones, s.base, s.type, name); },
    // the hit flash: the figure's packed colour turns fire slot 35, then its own colour comes back (one upload of its rows each way).
    // The shadow and the markers keep their colour.
    flash(q, on) {
      const s = slotOf(q);
      if (s.flash === on) return;
      s.flash = on;
      const src = s.src.data, off = (s.type.first - s.first) * 16, keep = s.type.groundBones;
      for (let i = s.first; i < s.end; i++) {
        const o = i * 16;
        if (keep.has(data[o + 12] - s.base)) continue;
        data[o + 7] = on ? FLASH : src[o + off + 7];
      }
      touch(s);
    }
  };
  for (const s of list) if (s.type) s.type.groundBones ||= groundOf(s.type);
  return pool;
}
const groundOf = type => new Set(type.bones.map((b, i) => (b.parent === 'ground' ? i : -1)).filter(i => i >= 0));
