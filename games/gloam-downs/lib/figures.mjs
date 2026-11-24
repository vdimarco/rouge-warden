// Gloam Downs: the figures of the combat run, baked once each, apart from any place. The four foes and the carried light go into
// worlds/foes.bin.gz and worlds/foes.json.gz, the Barrow Reeve into worlds/boss.bin.gz and worlds/boss.json.gz. A page adds a copy
// of a figure to a place for each pool slot (public/lab/gloam-downs/pool.js), so a figure takes that place's palette, dither and
// outlines in the resolve: its own dark tones are in no place's palette and snap to each place's darks.
//   node bake.mjs foes [--check] [--preview --out DIR]      node bake.mjs boss [--check] [--preview --out DIR]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { lib, K, palette, INK_VERSION } from './common.mjs';
import { POOLS } from './zones.mjs';
import { readFigures, makePool, poseFigure, poseShadow, poseMarker, writeBone, PUT_AWAY } from '../../../public/lab/gloam-downs/pool.js';
import { fileChecks, colourChecks, placeChecks } from './check.mjs';

/* ---------------- the figures' palette ----------------
   Dark tones in no place's palette, so the resolve snaps them to each place's own darks; and the 16 shared slots, so eyes and tells
   are the places' own fire, the Mirelight and the caged light their wisp colours, blades their iron. Nothing uses the cloak slots:
   they are the lamplighter's. */
export const FIG = palette([
  ['sky', [0x04050b]], ['ink', [0x020308]], ['shade', [0x06080e]],
  ['soot', [0x09090c, 0x12141b, 0x201f27, 0x302e38]],      // a grey-black: rags and hoods
  ['rag', [0x110b0a, 0x20160f, 0x34211c, 0x4a3026]],       // a dark earth: wraps, belts
  ['feather', [0x07080d, 0x101219, 0x1b1e2a, 0x2a2e3e]],   // a blue-black: feathers, hide
  ['bone', [0x24211c, 0x3d382f, 0x5a5446]],                // a dull old bone: the beaked mask, the Reeve's face
  ['bronze', [0x1c150c, 0x2b1d10, 0x3d2a15, 0x52391d]],    // an old bronze, gone dark: the bell
  ['earth', [0x0c0b09, 0x1a1712, 0x2b261d, 0x3e372a]],     // barrow earth: the Reeve's cloak
  ['root', [0x140f0b, 0x261c13, 0x3a2b1c]]                 // old roots
]);
const ramp = FIG.ramp;
export const MAT = {
  soot: { r: ramp('soot') }, rag: { r: ramp('rag') }, feather: { r: ramp('feather') }, bone: { r: ramp('bone') },
  bronze: { r: ramp('bronze') }, earth: { r: ramp('earth') }, root: { r: ramp('root') }, iron: { r: ramp('iron') },
  ink: { r: [ramp('ink')[0]] },
  // what glows. Fire only on eyes and tells; the wisp colours only on the Mirelight and the caged light; never slot 40. A glow a few
  // art pixels across is mostly edge, where the resolve sees it mixed with the dark round it: slots 36 and 37 mixed that way are pale
  // tans and greys that snap to each place's own straw, moss or moon colours, while slots 34 and 35 mixed that way stay fire or turn
  // dark. So the figures' glows keep to slots 34 and 35 (measured in the page: qa/lab/gloam-downs-run.lineup.e2e.mjs)
  eye: { r: [ramp('fire')[3]], em: true },
  ember: { r: [ramp('fire')[1]], em: true },                 // a dull ember (slot 33): coals and pitch at rest
  tell: { r: ramp('fire').slice(2, 4), em: true },           // a tell: slots 34 and 35
  hot: { r: [ramp('fire')[3]], em: true },                   // the heart of a tell (slot 35)
  white: { r: [ramp('fire')[3]], em: true },                 // the Ironback's blazing crack (slot 35)
  wisp: { r: [ramp('wisp')[0], ramp('wisp')[1]], em: true }, // slots 38, 39
  wispDim: { r: [ramp('wisp')[0]], em: true }, wispPale: { r: [ramp('wisp')[1]], em: true }
};
export const FIRE = ramp('fire'), WISP = ramp('wisp');
// a neutral moonlight from above and in front: a figure turns with its baked light, so the light must read from any side
const LIGHT = { sun: [-0.35, 0.85, 0.4], amb: 0.2, sky: 0.24, sunK: 0.5, shK: 7 };

/* ---------------- clips ----------------
   k(o) is one key of a bone: { rx, ry, rz, s or sx/sy/sz, tx, ty, tz }. clip(dur, at, fn, loop) calls fn(u) at each share u of at
   and keeps, for each bone that fn names, one row a key. acts(kind, u, H) samples Ink Studio's own body keys (K.acts.frames: x and y
   in pixels of a 512 pixel figure, r in degrees) at share u, for a figure H tall: a lean, a squash and a little move. */
export const k = (o = {}) => [o.rx || 0, o.ry || 0, o.rz || 0, o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1, o.tx || 0, o.ty || 0, o.tz || 0];
export const lerp = (a, b, u) => a + (b - a) * u;
export const ease = u => u * u * (3 - 2 * u);
export function acts(kind, u, H) {
  const fr = K.acts.frames(kind, 1);
  let i = 0;
  while (i < fr.length - 2 && u > fr[i + 1].at) i++;
  const a = fr[i], b = fr[i + 1], s = Math.max(0, Math.min(1, (u - a.at) / (b.at - a.at || 1))), m = (p, q) => p + (q - p) * s;
  const px = H / 512;
  return { rx: (m(a.r, b.r) * Math.PI) / 180, sx: m(a.sx, b.sx), sy: m(a.sy, b.sy), sz: m(a.sx, b.sx), tz: m(a.x, b.x) * px, ty: -m(a.y, b.y) * px };
}
export function clip(dur, at, fn, loop = false) {
  const keys = {}, rows = at.map(u => fn(u));
  const names = new Set(rows.flatMap(r => Object.keys(r)));
  for (const n of names) keys[n] = rows.map(r => (r[n] ? k(r[n]) : null));
  return { dur, loop, at, keys };
}
// a key that is missing in some rows takes the bone's rest (or hidden) key; numbers are kept to 3 decimals
function finishClips(clips, bones) {
  const hidden = new Set(bones.filter(b => b.hidden).map(b => b.name)), known = new Set(bones.map(b => b.name));
  for (const [name, c] of Object.entries(clips)) {
    for (const [bn, rows] of Object.entries(c.keys)) {
      if (!known.has(bn)) throw new Error(`clip ${name} keys a bone that does not exist: ${bn}`);
      c.keys[bn] = rows.map(r => (r || (hidden.has(bn) ? k({ s: 0 }) : k())).map(v => Math.round(v * 1000) / 1000 + 0));
    }
    c.at = c.at.map(v => Math.round(v * 1e4) / 1e4);
  }
  return clips;
}

/* ---------------- sculpt helpers ---------------- */
// a figure's own point: o is its feet at rest
export const atOf = o => (x, y, z) => [o[0] + x, o[1] + y, o[2] + z];
export const tag = (name, opt) => ({ tag: name, ...opt });
// a frame (rows) whose long axis (y) runs along d: for S.lathe / tubes that must point somewhere
export function axisAlong(d) {
  const l = Math.hypot(d[0], d[1], d[2]), y = [d[0] / l, d[1] / l, d[2] / l];
  const a = Math.abs(y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let x = [a[1] * y[2] - a[2] * y[1], a[2] * y[0] - a[0] * y[2], a[0] * y[1] - a[1] * y[0]];
  const lx = Math.hypot(...x);
  x = x.map(v => v / lx);
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return [x, y, z];
}
// the round shadow under a figure: flat dabs in a disc, laid at its own place 40 m over the feet (the shadow bone's pivot)
export function shadowDabs(B, o, r) {
  const ids = [], col = ramp('shade')[0];
  for (let q = 0; q <= r - 0.03; q += 0.1) {
    const n = Math.max(1, Math.round((Math.PI * 2 * q) / 0.1));
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + q; ids.push(dab(B, o[0] + Math.sin(a) * q, o[1] + 40, o[2] + Math.cos(a) * q, 0.075, col)); }
  }
  return ids;
}
/* Ground markers, laid as flat dabs straight into the builder: fire slot 34 inside, a rim in slot 35. A ring is six slices of 60°,
   each its own bone; a lane is pieces along +z from the feet, each its own bone. The inside is dashed rings (or dashed bars across a
   lane), so the ground still shows through. Returns { bone: [splat ids] }. */
const DAB = 3; // a dab's density, as the sculptor's own
function dab(B, x, y, z, r, col) {
  const n0 = B.count();
  B.disc(x, y, z, [0, 1, 0], r, 0.012, B.P[col], DAB, { em: true });
  return n0;
}
export function ring(B, o, R, names, { gap = 0.42, rim = 0.09 } = {}) {
  const ids = Object.fromEntries(names.map(n => [n, []]));
  const slice = a => names[Math.min(5, Math.floor((((a / (Math.PI * 2)) % 1) + 1) % 1 * 6))];
  const lay = (r, step, col, size, dash) => {
    const n = Math.max(6, Math.round((Math.PI * 2 * r) / step));
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2;
      if (dash && i % 3 === 2) continue;
      ids[slice(a)].push(dab(B, o[0] + Math.sin(a) * r, o[1], o[2] + Math.cos(a) * r, size, col));
    }
  };
  lay(R - rim * 0.5, rim * 0.95, FIRE[3], rim * 0.62, false);                  // the rim, slot 35
  for (let r = R - gap; r > 0.3; r -= gap) lay(r, 0.13, FIRE[2], 0.06, true);  // the inside, slot 34
  return ids;
}
export function lane(B, o, width, piece, names, { rim = 0.09, gap = 0.4 } = {}) {
  const ids = Object.fromEntries(names.map(n => [n, []]));
  const hw = width / 2, len = piece * names.length;
  const at = z => names[Math.min(names.length - 1, Math.floor(z / piece))];
  for (let z = rim * 0.5; z < len; z += rim * 0.95)
    for (const x of [-hw + rim * 0.5, hw - rim * 0.5]) ids[at(z)].push(dab(B, o[0] + x, o[1], o[2] + z, rim * 0.62, FIRE[3]));
  for (let x = -hw + rim; x < hw - rim * 0.5; x += rim * 0.95) ids[at(len - 0.01)].push(dab(B, o[0] + x, o[1], o[2] + len - rim * 0.5, rim * 0.62, FIRE[3]));
  for (let z = gap; z < len - 0.2; z += gap)
    for (let x = -hw + 0.22, i = 0; x < hw - 0.15; x += 0.13, i++) if (i % 3 !== 2) ids[at(z)].push(dab(B, o[0] + x, o[1], o[2] + z, 0.06, FIRE[2]));
  return ids;
}

/* ---------------- the bake of a set of figures ----------------
   Each figure def: { code, name, title, height, radius, bones: [{ name, parent, pivot (from its feet), hidden }], sculpt(S, at, o),
   lay(B, o) -> { bone: [ids] } for the flat dabs, shadow (its radius), res (a spacing factor), apart (tags baked apart),
   weights(x, y, z, bone) -> [bone2, share] for a second bone, clips }; or { plain: true, lay, info } for splats on no bone. Each
   figure has its own sculptors (and so its own bakes and shadows) at its own place, 8 m from the next. */
export function bakeSet(defs, seed = 11) {
  const B = lib.makeBuilder(seed, FIG.pal, { renderMetadata: false });
  const types = {}, ids = [], bid = [], bid2 = [], w2 = [];
  defs.forEach((def, n) => {
    const o = [n * 8, 0, 0], at = atOf(o);
    /* Two sculptors, each with its own bake: the figure, and what glows over it (def.apart: the tells and the lights). A sculptor makes
       one surface of all its solids, so a tell that wraps a cup or a coal would leave nothing of the cup or the coal; and a light that
       rides out of the figure later must be whole */
    const sculptor = () => { const q = K.sculpt(lib.makeSculpt(B)); q.sun = B.norm(LIGHT.sun); q.amb = LIGHT.amb; q.sky = LIGHT.sky; q.sunK = LIGHT.sunK; q.shK = LIGHT.shK; return q; };
    const S0 = sculptor(), S1 = sculptor(), apart = new Set(def.apart || []), first = B.count();
    const tags = K.deform.tags(S0), tags1 = K.deform.tags(S1);
    // def.res spaces every solid's dabs by that factor: the knob that keeps a figure inside its splat target
    const SOLIDS = ['ball', 'box', 'tube', 'lathe', 'torus'];
    const S = new Proxy(S0, {
      get: (t, key) => (typeof t[key] !== 'function' || !SOLIDS.includes(key) ? t[key]
        : (...a) => {
          const opt = a[a.length - 1], own = opt && typeof opt === 'object' && !Array.isArray(opt);
          if (own && opt.res && def.res) a[a.length - 1] = { ...opt, res: opt.res * def.res };
          return (own && apart.has(opt.tag) ? S1 : t)[key](...a);
        })
    });
    def.sculpt(S, at, o);
    S0.bake();
    S1.bake();
    for (const [name, list] of Object.entries(tags1)) (tags[name] ||= []).push(...list);
    const laid = def.lay ? def.lay(B, o) : {};
    if (def.shadow) laid.shadow = shadowDabs(B, o, def.shadow);
    const end = B.count();
    const index = Object.fromEntries(def.bones.map((b, i) => [b.name, i]));
    // a plain figure (the grave candles) rides no bone: its groups are moved by the page, splat by splat
    if (def.plain) {
      types[def.code] = { code: def.code, name: def.name, title: def.title, first, end, feet: o, bones: [], clips: {}, ...(def.info ? def.info(o, first) : {}), _def: def };
      return;
    }
    const own = new Int32Array(end - first).fill(-1);
    for (const [name, list] of [...Object.entries(tags), ...Object.entries(laid)]) {
      if (index[name] === undefined) throw new Error(`${def.name}: splats tagged ${name}, which is not a bone`);
      for (const i of list) own[i - first] = index[name];
    }
    const lost = own.reduce((c, v) => c + (v < 0), 0);
    if (lost) throw new Error(`${def.name}: ${lost} splats are on no bone`);
    for (let i = first; i < end; i++) { ids.push(i); bid.push(own[i - first]); bid2.push(0); w2.push(0); }
    const bones = def.bones.map(b => ({ name: b.name, parent: b.parent ?? null, pivot: (b.at || at)(...b.pivot).map(v => +v.toFixed(4)), ...(b.hidden ? { hidden: true } : {}) }));
    types[def.code] = {
      code: def.code, name: def.name, title: def.title, height: def.height, radius: def.radius, first, end, feet: o,
      bones, clips: finishClips(def.clips, def.bones), ...(def.info ? def.info(o) : {}), _def: def
    };
  });
  const world = B.finish({ cam: { target: [0, 1, 0], dist: 6, pitch: 0.2, yaw: 0.5 }, detail: 9 });
  // a second bone where a figure asks for one (the Reeve's cloak), in steps of 1/8, which the codec keeps in fewer bytes
  for (const T of Object.values(types)) {
    if (!T._def.weights) continue;
    for (let j = 0; j < ids.length; j++) {
      const i = ids[j];
      if (i < T.first || i >= T.end) continue;
      const o = i * 16, w = T._def.weights(world.data[o] - T.feet[0], world.data[o + 1] - T.feet[1], world.data[o + 2] - T.feet[2], T.bones[bid[j]].name);
      if (!w) continue;
      const share = Math.round(w[1] * 8) / 8;
      if (share > 0) { bid2[j] = T.bones.findIndex(b => b.name === w[0]); w2[j] = share; }
    }
  }
  const tagged = K.bones.tag(world, Int32Array.from(ids), Int32Array.from(bid), Int32Array.from(bid2), Float32Array.from(w2));
  if (tagged.cpu.length) throw new Error(`${tagged.cpu.length} figure splats could not ride a bone`);
  for (const T of Object.values(types)) delete T._def;
  return { world, types };
}

/* ---------------- files ---------------- */
const FORMAT = { foes: 'gloam-downs-foes/1', boss: 'gloam-downs-boss/1' };
export function figureJson(which, { world, types }, more = {}) {
  return { format: FORMAT[which], ink: INK_VERSION, count: world.count, types, ...more };
}
export function writeFigures(which, built, json, worlds) {
  fs.mkdirSync(worlds, { recursive: true });
  const bin = zlib.gzipSync(K.procedural.splatCodec.encode(built.world.data, built.world.count), { level: 9 });
  const js = zlib.gzipSync(Buffer.from(JSON.stringify(json)), { level: 9 });
  fs.writeFileSync(path.join(worlds, `${which}.bin.gz`), bin);
  fs.writeFileSync(path.join(worlds, `${which}.json.gz`), js);
  return { bin: bin.length, json: js.length };
}
// read a figure file pair back as the page does: { json (ready to pose), data, count }
export function readFigureFiles(which, worlds) {
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(worlds, `${which}.bin.gz`)));
  const dec = K.procedural.splatCodec.decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength), { maxRows: 1_000_000 });
  const json = readFigures(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(worlds, `${which}.json.gz`))).toString()));
  return { json, data: dec.data, count: dec.count };
}
export function readPlace(id, worlds) {
  const meta = JSON.parse(fs.readFileSync(path.join(worlds, `${id}.json`), 'utf8'));
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(worlds, `${id}.bin.gz`)));
  const dec = K.procedural.splatCodec.decode(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength), { maxRows: 1_000_000 });
  const wr = zlib.gunzipSync(fs.readFileSync(path.join(worlds, `${id}.walk.bin.gz`)));
  return { meta, data: dec.data, count: dec.count, walk: new Int16Array(wr.buffer.slice(wr.byteOffset, wr.byteOffset + wr.byteLength)) };
}

/* ---------------- pictures ----------------
   lineup(): figures posed in a row on the floor of a place, in front of the lamplighter at its start, drawn by Ink Studio's CPU
   resolve at an art size, from the page's follow camera. The pool is made by the page's own makePool. */
const inkCli = () => createRequire(import.meta.url)('@shapeshift-labs/ink-studio/cli/render.js');
const pngCli = () => createRequire(import.meta.url)('@shapeshift-labs/ink-studio/cli/png.js');
export async function lineup({ place, worlds, file, figures, w = 320, h = 180, dist = 8.5, pitch = 0.32, poses, spread = 1.7, ahead = 4.5, side = 0, target, yawOff = 0, from, close }) {
  const { makeWalk, pose: poseLamp } = await import('../../../public/lab/gloam-downs/play.js');
  const P = readPlace(place, worlds);
  const walk = makeWalk(P.meta.walk, P.walk);
  const nb = P.meta.bones.names.length;
  const world = { data: P.data, count: P.count, pal: P.meta.pal, radius: P.meta.radius, fog: { ...P.meta.fog }, dither: P.meta.dither, outline: P.meta.outline, ao: P.meta.ao, seed: P.meta.seed, moving: Int32Array.from(P.meta.moving), back: Int32Array.from(P.meta.back), detail: 9 };
  world.anim = { bones: new Float32Array(12 * nb), boned: new Int32Array(0) };
  const slots = figures.map(f => ({ code: f.code, type: f.src.json.types[f.code], src: f.src }));
  const pool = makePool(world, P.meta, slots);
  // the lamplighter at the start, or at from = [x, z, yaw]
  const sp = from ? { p: [from[0], walk.top(from[0], from[1]) + 0.5, from[1]], yaw: from[2] } : P.meta.spawn;
  const yaw = sp.yaw, fwd = [Math.sin(yaw), Math.cos(yaw)], right = [Math.cos(yaw), -Math.sin(yaw)];
  const lamp = { x: sp.p[0], y: walk.support(sp.p[0], sp.p[2], sp.p[1] + 1), z: sp.p[2], yaw, phase: 0, moveK: 0, runK: 0, landK: 0, landAge: 9, ground: true, vy: 0, floor: 0 };
  lamp.floor = lamp.y;
  poseLamp(world.anim.bones, P.meta.bones, lamp, 0.3, true);
  let last = null;
  pool.slots.forEach((s, i) => {
    const f = figures[i], a = (i - (figures.length - 1) / 2) * spread + side, d = ahead + (f.ahead || 0);
    const x = sp.p[0] + fwd[0] * d + right[0] * a, z = sp.p[2] + fwd[1] * d + right[1] * a;
    const floor = walk.support(x, z, walk.top(x, z) + 0.01) ?? walk.top(x, z);
    last = [x, floor, z];
    const up = f.float || 0;
    pool.wake(s, { x, y: floor + up, z, yaw: yaw + Math.PI + (f.turn || 0), floor }, s.type.bones.length ? f.clip || 'rest' : null, f.t || 0);
    for (const m of f.markers || []) pool.marker(s, m.name, { x: x + (m.dx || 0), y: floor, z: z + (m.dz || 0), yaw: yaw + Math.PI + (m.yaw || 0), k: m.k ?? 1 });
  });
  if (poses) poses(pool, world, walk);
  const posed = K.bones.posed(world);
  // the follow camera's aim, or a close look at the last figure (close = its height to aim at)
  const tg = target || (close ? [last[0], last[1] + close, last[2]] : [sp.p[0] + fwd[0] * (ahead * 0.45), lamp.y + 1, sp.p[2] + fwd[1] * (ahead * 0.45)]);
  const W2 = { ...world, data: posed, anim: undefined, cam: { target: tg, dist, pitch, yaw: yaw + Math.PI + yawOff } };
  W2.radius = Math.max(8, P.meta.fogFar - dist);
  const R = inkCli();
  const art = R.render(W2, { w, h, px: 1, colored: true });
  if (file) { const big = R.upscale(art, 3); pngCli().write(file, big.w, big.h, big.rgb); }
  return art;
}
// a sheet of one figure set: each figure in a few poses on a flat dark floor, lit by nothing but its own bake, at the desktop art size
export function sheet(built, json, { file, codes, poses, w = 320, h = 180, pal, dist = 7, pitch = 0.2, yaw = 0.35 }) {
  const types = readFigures(JSON.parse(JSON.stringify(json))).types;
  const list = [];
  for (const code of codes) for (const p of poses[code]) list.push({ code, ...p });
  const total = list.reduce((s, f) => s + (types[f.code].end - types[f.code].first), 0);
  const data = new Float32Array(total * 16);
  let n = 0, nb = 0;
  const bones = [], boned = [], plan = [];
  for (const f of list) {
    const T = types[f.code], c = T.end - T.first;
    data.set(built.world.data.subarray(T.first * 16, T.end * 16), n * 16);
    for (let i = n; i < n + c; i++) { const o = i * 16; data[o + 12] += nb; if (data[o + 14] > 0) data[o + 13] += nb; boned.push(i); }
    plan.push({ T, nb, f });
    n += c; nb += T.bones.length;
  }
  const B = new Float32Array(12 * nb);
  const step = Math.max(1.6, ...list.map(f => types[f.code].radius * 2.6));
  plan.forEach(({ T, nb: b0, f }, i) => {
    const x = (i - (plan.length - 1) / 2) * step, at = { x, y: f.up || 0, z: 0, yaw: f.yaw ?? 0 };
    for (let b = 0; b < T.bones.length; b++) writeBone(B, b0 + b, PUT_AWAY);
    poseFigure(B, b0, T, at, f.clip, f.t || 0);
    poseShadow(B, b0, T, x, 0, 0, f.up || 0);
    for (const m of f.markers || []) poseMarker(B, b0, T, m, { x, y: 0, z: 0, yaw: f.yaw ?? 0, k: f.k ?? 1 });
  });
  const world = { data, count: total, pal: pal || FIG.pal, radius: 30, fog: { c: 0, start: 1, max: 0 }, dither: 0.4, outline: { c: 1, edge: 0.45 }, ao: { k: 0.5, range: 0.6 }, seed: 3, detail: 9, anim: { bones: B, boned: Int32Array.from(boned) } };
  const W2 = { ...world, data: K.bones.posed(world), anim: undefined, cam: { target: [0, 1, 0], dist: Math.max(dist, plan.length * step * 0.62), pitch, yaw } };
  const R = inkCli();
  const art = R.render(W2, { w, h, px: 1, colored: true });
  if (file) { const big = R.upscale(art, 3); pngCli().write(file, big.w, big.h, big.rgb); }
  return art;
}

/* ---------------- node bake.mjs foes | boss ---------------- */
const PUBLIC = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../public/lab/gloam-downs/worlds');
/* The boss's rows and bones are reserved in Barrow Crown's pool from the start, parked, so the pool is never built twice in a place
   (pool.js fill()). foes.json.gz holds their counts as reserve: { B: { count, bones }, C: { count, bones } }: the foes bake reads them
   from the boss files, and the boss bake writes them into foes.json.gz, so either may be baked first */
const reserveOf = types => Object.fromEntries(['B', 'C'].filter(c => types[c]).map(c => [c, { count: types[c].end - types[c].first, bones: types[c].bones.length }]));
const gunzipJson = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
function writeReserve(worlds, reserve) {
  const f = path.join(worlds, 'foes.json.gz');
  if (!fs.existsSync(f)) return false;
  const json = gunzipJson(f);
  if (JSON.stringify(json.reserve) === JSON.stringify(reserve)) return false;
  json.reserve = reserve;
  fs.writeFileSync(f, zlib.gzipSync(Buffer.from(JSON.stringify(json)), { level: 9 }));
  return true;
}
// the boss files' counts against the reserve in foes.json.gz
export function reserveChecks(worlds) {
  const ff = path.join(worlds, 'foes.json.gz'), bf = path.join(worlds, 'boss.json.gz');
  if (!fs.existsSync(ff) || !fs.existsSync(bf)) return [{ ok: true, what: `the boss reserve: not checked (no ${fs.existsSync(ff) ? 'boss' : 'foe'} files in ${worlds})` }];
  const want = reserveOf(gunzipJson(bf).types), got = gunzipJson(ff).reserve;
  return [{ ok: JSON.stringify(want) === JSON.stringify(got), what: `foes.json.gz reserves the boss files' rows and bones in Barrow Crown's pool: ${JSON.stringify(got)}${JSON.stringify(want) === JSON.stringify(got) ? '' : `, the boss files hold ${JSON.stringify(want)}`}` }];
}
export async function bakeFigures(which, { worlds, preview }) {
  const mod = await import(which === 'foes' ? './foes.mjs' : './boss.mjs');
  // the places' palettes and files: from the folder written to, or the committed ones when it has none
  const places = fs.existsSync(path.join(worlds, 'gaol.json')) ? worlds : PUBLIC;
  const t0 = Date.now();
  const built = bakeSet(mod.FIGURES);
  const bossJson = [worlds, PUBLIC].map(w => path.join(w, 'boss.json.gz')).find(f => fs.existsSync(f));
  const json = figureJson(which, built, which === 'foes' ? { pools: POOLS, reserve: bossJson ? reserveOf(gunzipJson(bossJson).types) : {} } : mod.extra(built));
  const sizes = writeFigures(which, built, json, worlds);
  if (which === 'boss') writeReserve(worlds, reserveOf(built.types));
  const lines = [`${which}: ${built.world.count} splats in ${Date.now() - t0} ms; files ${(sizes.bin / 1024).toFixed(1)} + ${(sizes.json / 1024).toFixed(1)} KB`];
  for (const T of Object.values(built.types)) {
    const per = {};
    for (let i = T.first; i < T.end; i++) { const b = T.bones.length ? T.bones[built.world.data[i * 16 + 12]].name : 'plain'; per[b] = (per[b] || 0) + 1; }
    lines.push(`  ${T.title}: ${T.end - T.first} splats on ${T.bones.length} bones ${JSON.stringify(per)}`);
  }
  const checks = fileChecks(worlds, which);
  checks.push(...colourChecks(built.world.data, built.types, places));
  for (const T of Object.values(built.types)) if (mod.TARGETS?.[T.code]) {
    const n = T.end - T.first, want = mod.TARGETS[T.code];
    checks.push({ ok: n <= want * 1.1, what: `${T.title}: ${n} splats, no more than 10% over its target of ${want}` });
  }
  checks.push(...reserveChecks(worlds));
  checks.push(...placeChecks(worlds, places));
  if (preview) {
    fs.mkdirSync(preview, { recursive: true });
    await mod.previews({ built, json, worlds, places, out: preview, sheet, lineup, readFigureFiles });
    lines.push(`  previews in ${preview}`);
  }
  return { lines, checks, built, json, sizes };
}
