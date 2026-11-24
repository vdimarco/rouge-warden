// Gloam Downs: the Barrow Reeve, the boss at Barrow Crown, baked by lib/figures.mjs into worlds/boss.bin.gz and worlds/boss.json.gz,
// with the twelve grave candles that ring its arena. Data and poses only: the fight is the page's.
// 3.4 m tall and gaunt, in a long cloak of barrow earth hung with roots, a crown of six iron spikes (the summit's six stones), a
// rib-cage lantern in its chest that holds a pale-green caged light, and a long iron crook whose hook glows fire in a wind-up.
// It is never brighter than the beacon's fire: the light uses wisp slots 38 and 39, the hook's glow fire slots 34 to 36.
import { MAT, FIRE, WISP, lerp, ease, acts, clip, tag, ring, lane, axisAlong } from './figures.mjs';

export const TARGETS = { B: 12600, C: 120 };
const TAU = Math.PI * 2;
const six = p => [1, 2, 3, 4, 5, 6].map(i => `${p}${i}`);
const marker = (name, pivot = [0, 0, 0]) => ({ name, parent: 'ground', pivot, hidden: true });
// the crook: held upright in the right hand, its hook curling forward at the top
const GRIP = [-0.56, 1.66, 0.46], BUTT = [-0.58, 0.18, 0.5], TOP = [-0.55, 3.55, 0.4];
const HOOK = [TOP, [-0.55, 3.78, 0.55], [-0.55, 3.8, 0.82], [-0.55, 3.6, 0.98], [-0.55, 3.34, 0.92]];
const CAGE = [0, 2.12, 0.3], LIGHT = [0, 2.1, 0.36];
const tube = (S, pts, r0, r1, mat, bone, res) => S.tube(pts, r0, r1, mat, tag(bone, { res }));

const reeve = {
  apart: ['crookTip', 'light'], code: 'B', name: 'reeve', title: 'Barrow Reeve', height: 3.4, radius: 0.9, shadow: 0.95, res: 1.3,
  bones: [
    { name: 'body', pivot: [0, 0.1, 0] },
    { name: 'cloak', parent: 'body', pivot: [0, 2.6, -0.05] },
    { name: 'head', parent: 'body', pivot: [0, 2.72, 0.06] },
    { name: 'cage', parent: 'body', pivot: CAGE },
    { name: 'light', parent: 'cage', pivot: LIGHT },
    { name: 'armL', parent: 'body', pivot: [0.44, 2.58, 0] },
    { name: 'handL', parent: 'armL', pivot: [0.6, 1.55, 0.24] },
    { name: 'armR', parent: 'body', pivot: [-0.44, 2.58, 0] },
    { name: 'crook', parent: 'armR', pivot: GRIP },
    { name: 'crookTip', parent: 'crook', pivot: HOOK[2], hidden: true },
    { name: 'legL', parent: 'body', pivot: [0.18, 1.36, 0] },
    { name: 'legR', parent: 'body', pivot: [-0.18, 1.36, 0] },
    { name: 'shadow', parent: 'ground', pivot: [0, 40, 0] },
    // the markers, posed by the page: the cage slam's ring of 3.4 m, the lunge's lane of 9 m in six pieces, the three lamp-shards and
    // the three rings of 1.3 m they fall into
    ...six('ring').map(n => marker(n)),
    ...six('lane').map((n, i) => marker(n, [0, 0, i * 1.5])),
    ...[1, 2, 3].map(i => marker(`shard${i}`, CAGE)),
    ...[1, 2, 3].flatMap(r => six(`shardRing${r}_`).map(n => marker(n)))
  ],
  sculpt(S, at) {
    const { earth, root, bone, iron, ink } = MAT;
    // long thin legs under the cloak, long feet
    for (const s of [-1, 1]) {
      const b = s > 0 ? 'legL' : 'legR';
      tube(S, [at(0.18 * s, 1.36, 0), at(0.22 * s, 0.76, 0.08), at(0.2 * s, 0.1, 0)], 0.07, 0.05, root, b, 0.05);
      S.ball(at(0.2 * s, 0.06, 0.1), [0.08, 0.05, 0.2], root, tag(b, { res: 0.04 }));
    }
    // the cloak: from the shoulders to the ground, wider at the hem, open over the chest, its front edges hanging straight down;
    // roots hang from its hem and run down its back
    S.lathe(at(0, 0.12, -0.16), 2.45, t => 0.64 - 0.4 * Math.pow(t, 0.8), earth, tag('cloak', { res: 0.075 }));
    for (const s of [-1, 1]) tube(S, [at(0.24 * s, 2.55, 0.1), at(0.34 * s, 1.6, 0.25), at(0.46 * s, 0.2, 0.34)], 0.06, 0.085, earth, 'cloak', 0.06);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.2, r = 0.62, l = 0.28 + 0.22 * Math.abs(Math.sin(i * 1.7));
      const p0 = at(Math.sin(a) * r, 0.5, -0.16 + Math.cos(a) * r), p1 = at(Math.sin(a) * (r + 0.1), 0.5 - l, -0.16 + Math.cos(a) * (r + 0.12));
      tube(S, [p0, p1], 0.04, 0.012, root, 'cloak', 0.035);
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 1.4 + 2.4, x = Math.sin(a), z = Math.cos(a);
      tube(S, [at(x * 0.3, 2.4, -0.16 + z * 0.3), at(x * 0.46, 1.6, -0.16 + z * 0.46), at(x * 0.6, 0.7, -0.16 + z * 0.6), at(x * 0.7, 0.12, -0.16 + z * 0.76)], 0.035, 0.018, root, 'cloak', 0.04);
    }
    // a gaunt chest, bony shoulders under a mantle of earth and roots
    S.ball(at(0, 2.18, 0.1), [0.26, 0.4, 0.17], earth, tag('body', { res: 0.05 }));
    S.ball(at(0, 2.6, -0.02), [0.56, 0.15, 0.3], earth, tag('body', { res: 0.055 }));
    for (const s of [-1, 1]) S.ball(at(0.44 * s, 2.6, 0), 0.15, root, tag('body', { res: 0.045 }));
    // the rib-cage lantern: four iron ribs round a hollow in the chest, a ring above and below. The ribs have no outline: at this size
    // the outlines would close the gaps where the light shows
    for (let i = 0; i < 4; i++) {
      const a = -1.05 + (i / 3) * 2.1, x = Math.sin(a) * 0.2, z = Math.cos(a) * 0.2;
      tube(S, [at(CAGE[0] + x * 0.5, CAGE[1] + 0.27, CAGE[2] + z * 0.35 - 0.06), at(CAGE[0] + x, CAGE[1], CAGE[2] + z), at(CAGE[0] + x * 0.55, CAGE[1] - 0.26, CAGE[2] + z * 0.4 - 0.06)], 0.024, 0.02, { ...iron, fl: { nd: true } }, 'cage', 0.022);
    }
    for (const dy of [0.25, -0.24]) S.torus(at(CAGE[0], CAGE[1] + dy, CAGE[2] - 0.05), 0.11, 0.02, iron, tag('cage', { res: 0.02 }));
    S.ball(at(CAGE[0], CAGE[1], CAGE[2] - 0.13), [0.16, 0.2, 0.05], ink, tag('cage', { res: 0.035 })); // the dark hollow behind the light
    // the caged light: pale green, never the brightest wisp step
    // (no outline round it, as the places' wisps have none: at this size an outline would eat it between the ribs)
    S.ball(at(...LIGHT), 0.16, { ...MAT.wispPale, fl: { em: true, nd: true } }, tag('light', { res: 0.028 }));
    S.ball(at(LIGHT[0], LIGHT[1] + 0.08, LIGHT[2] - 0.07), 0.15, { ...MAT.wispDim, fl: { em: true, nd: true } }, tag('light', { res: 0.035 }));
    // the head: a long face of old bone, deep sockets with pale points in them, a jaw; the crown of six iron spikes, roots down the back
    S.ball(at(0, 2.92, 0.08), [0.14, 0.19, 0.16], bone, tag('head', { res: 0.035 }));
    S.ball(at(0, 2.76, 0.14), [0.09, 0.07, 0.09], bone, tag('head', { res: 0.03 }));
    for (const s of [-1, 1]) {
      S.ball(at(0.055 * s, 2.95, 0.2), [0.045, 0.04, 0.03], ink, tag('head', { res: 0.015 }));
      S.ball(at(0.055 * s, 2.95, 0.225), 0.016, MAT.wispPale, tag('head', { res: 0.01 }));
    }
    S.ball(at(0, 2.97, -0.05), [0.17, 0.2, 0.15], earth, tag('head', { res: 0.04 })); // a cowl of earth behind the face
    S.torus(at(0, 3.08, 0.04), 0.16, 0.025, iron, tag('head', { res: 0.02 }));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6, x = Math.sin(a), z = Math.cos(a);
      tube(S, [at(x * 0.16, 3.07, 0.04 + z * 0.16), at(x * 0.24, 3.42 - 0.04 * (i % 2), 0.04 + z * 0.24)], 0.032, 0.004, iron, 'head', 0.018);
    }
    for (const s of [-1, 0, 1]) tube(S, [at(0.08 * s, 2.98, -0.15), at(0.14 * s, 2.6, -0.3), at(0.18 * s, 2.2, -0.36)], 0.03, 0.01, root, 'head', 0.03);
    // the left arm, long and thin, with rags of root hanging from it; a hand of long fingers
    tube(S, [at(0.44, 2.58, 0), at(0.62, 2.0, 0.12), at(0.6, 1.55, 0.24)], 0.075, 0.05, root, 'armL', 0.045);
    for (let i = 0; i < 4; i++) tube(S, [at(0.5 + i * 0.04, 2.3 - i * 0.2, 0.04 + i * 0.05), at(0.58 + i * 0.04, 1.95 - i * 0.2, 0.0 + i * 0.05)], 0.03, 0.008, earth, 'armL', 0.03);
    S.ball(at(0.6, 1.53, 0.25), [0.06, 0.07, 0.06], bone, tag('handL', { res: 0.025 }));
    for (const d of [-1, -0.33, 0.33, 1]) tube(S, [at(0.6 + d * 0.04, 1.48, 0.27), at(0.62 + d * 0.06, 1.3, 0.34), at(0.6 + d * 0.06, 1.18, 0.3)], 0.016, 0.006, bone, 'handL', 0.014);
    // the right arm, its fist round the crook
    tube(S, [at(-0.44, 2.58, 0), at(-0.62, 2.05, 0.18), at(...GRIP)], 0.075, 0.055, root, 'armR', 0.045);
    S.ball(at(...GRIP), 0.075, bone, tag('armR', { res: 0.03 }));
    // the crook: an iron staff taller than the Reeve, a ferrule, the hook with an edge
    tube(S, [at(...BUTT), at(...TOP)], 0.035, 0.03, iron, 'crook', 0.035);
    S.torus(at(GRIP[0], GRIP[1] + 0.35, GRIP[2] - 0.01), 0.045, 0.014, iron, tag('crook', { res: 0.016, ax: axisAlong([0, 1, -0.03]) }));
    tube(S, HOOK.map(p => at(...p)), 0.032, 0.014, iron, 'crook', 0.025);
    tube(S, [at(...HOOK[3]), at(-0.55, 3.42, 1.04), at(-0.55, 3.3, 0.98)], 0.018, 0.005, iron, 'crook', 0.016);
    // the hook's glow, grown over a wind-up
    tube(S, HOOK.map(p => at(...p)), 0.06, 0.04, { r: [FIRE[2], FIRE[3]], em: true }, 'crookTip', 0.03);
    S.ball(at(...HOOK[3]), 0.07, { r: [FIRE[3]], em: true }, tag('crookTip', { res: 0.025 }));
  },
  // the lamp-shards: three green glass splinters, at the cage at rest (the page flies them)
  lay(B, o) {
    const ids = { ...ring(B, o, 3.4, six('ring'), { gap: 0.6 }), ...lane(B, o, 1.6, 1.5, six('lane'), { gap: 0.45 }) };
    for (let r = 1; r <= 3; r++) Object.assign(ids, ring(B, o, 1.3, six(`shardRing${r}_`)));
    for (let k = 1; k <= 3; k++) {
      const list = (ids[`shard${k}`] = []);
      for (let i = 0; i < 9; i++) {
        const n0 = B.count(), t = i / 8;
        B.disc(o[0] + CAGE[0] + (Math.sin(i * 2.1 + k) * 0.03), o[1] + CAGE[1] + (t - 0.5) * 0.3, o[2] + CAGE[2] + Math.cos(i * 1.3 + k) * 0.03, [0, 0, 1], 0.045 - 0.02 * Math.abs(t - 0.5), 0.02, B.P[i % 3 ? WISP[0] : WISP[1]], 3, { em: true });
        list.push(n0);
      }
    }
    return ids;
  },
  // the cloak's lower part follows its own bone (it swings), the upper part the body; in steps of 1/8 (lib/figures.mjs)
  weights: (x, y, z, b) => (b === 'cloak' ? ['body', Math.max(0, Math.min(1, (y - 0.6) / 1.8))] : null),
  clips: {
    rest: clip(3.2, [0, 0.25, 0.5, 0.75, 1], u => ({
      body: { sy: 1 + 0.012 * Math.sin(u * TAU), rx: 0.03 + 0.015 * Math.sin(u * TAU) }, head: { ry: 0.15 * Math.sin(u * TAU), rx: 0.05 },
      cloak: { rz: 0.02 * Math.sin(u * TAU), rx: -0.02 * Math.sin(u * TAU) }, light: { s: 1 + 0.06 * Math.sin(u * TAU * 2) },
      armL: { rx: 0.04 * Math.sin(u * TAU + 1) }, armR: { rx: 0.03 * Math.sin(u * TAU) }
    }), true),
    walk: clip(1.3, [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], u => {
      const a = u * TAU, sw = Math.sin(a);
      return { body: { ty: 0.05 * Math.abs(sw), rz: 0.03 * sw, rx: 0.06 }, legL: { rx: -0.4 * sw }, legR: { rx: 0.4 * sw }, cloak: { rx: -0.06 - 0.03 * Math.abs(sw), rz: -0.03 * sw }, armL: { rx: 0.25 * sw }, armR: { rx: -0.08 * sw }, head: { rx: 0.05 } };
    }, true),
    // the crook sweep: raised out to the right side with the hook glowing beside the head, where it shows from the front, then a flat
    // sweep through ±90° in front
    'sweep.windup': clip(0.8, [0, 0.3, 0.6, 1], u => {
      const e = ease(u);
      return { body: { ry: -0.3 * e, rx: -0.05 * e }, armR: { rx: -0.3 * e, rz: -1.0 * e }, crook: { rx: -0.3 * e, rz: 0.75 * e }, armL: { rz: 0.4 * e }, cloak: { ry: 0.15 * e }, crookTip: { s: Math.min(1, u * 1.1) } };
    }),
    'sweep.attack': clip(0.2, [0, 0.35, 0.7, 1], u => {
      const e = ease(u);
      return { body: { ry: lerp(-0.3, 0.9, e), rx: lerp(-0.05, 0.12, e) }, armR: { rx: lerp(-0.3, -1.45, e), rz: lerp(-1.0, -0.2, e), ry: lerp(0, 1.2, e) }, crook: { rx: lerp(-0.3, 0.6, e), rz: lerp(0.75, 0, e) }, armL: { rz: lerp(0.4, 0.1, e) }, cloak: { ry: lerp(0.15, -0.3, e) }, crookTip: { s: 1 } };
    }),
    'sweep.recover': clip(1.0, [0, 0.4, 1], u => {
      const e = ease(u);
      return { body: { ry: lerp(0.9, 0, e), rx: lerp(0.12, 0, e) }, armR: { rx: lerp(-1.45, 0, e), rz: lerp(-0.2, 0, e), ry: lerp(1.2, 0, e) }, crook: { rx: lerp(0.6, 0, e) }, armL: { rz: lerp(0.1, 0, e) }, cloak: { ry: lerp(-0.3, 0, e) }, crookTip: { s: Math.max(0, 1 - u * 3) } };
    }),
    // the second sweep of the double sweep: a wind-up of 0.6 s the other way, a sweep back, a recovery of 1.2 s
    'dsweep.windup': clip(0.6, [0, 0.4, 1], u => {
      const e = ease(u);
      return { body: { ry: lerp(0.9, 1.1, e), rx: 0.12 }, armR: { rx: -1.45, rz: lerp(-0.2, -0.4, e), ry: lerp(1.2, 1.5, e) }, crook: { rx: 0.6 }, cloak: { ry: -0.3 }, crookTip: { s: 1 } };
    }),
    'dsweep.attack': clip(0.2, [0, 0.35, 0.7, 1], u => {
      const e = ease(u);
      return { body: { ry: lerp(1.1, -0.5, e), rx: 0.12 }, armR: { rx: -1.45, rz: lerp(-0.4, 0.3, e), ry: lerp(1.5, -0.2, e) }, crook: { rx: 0.6 }, cloak: { ry: lerp(-0.3, 0.25, e) }, crookTip: { s: 1 } };
    }),
    'dsweep.recover': clip(1.2, [0, 0.4, 1], u => {
      const e = ease(u);
      return { body: { ry: lerp(-0.5, 0, e), rx: lerp(0.12, 0, e) }, armR: { rx: lerp(-1.45, 0, e), rz: lerp(0.3, 0, e), ry: lerp(-0.2, 0, e) }, crook: { rx: lerp(0.6, 0, e) }, cloak: { ry: lerp(0.25, 0, e) }, crookTip: { s: Math.max(0, 1 - u * 3) } };
    }),
    // the cage slam: it rears up and lifts the cage; then drops onto one knee
    'slam.windup': clip(1.0, [0, 0.3, 0.6, 0.85, 1], u => {
      const e = ease(u), b = acts('windup', u * 0.55, 3.4);
      return { body: { rx: -0.32 * e, ty: 0.15 * e, ...{ sx: b.sx, sy: b.sy, sz: b.sz } }, armL: { rx: -2.4 * e, rz: -0.3 * e }, armR: { rx: -1.2 * e }, crook: { rx: 0.4 * e }, head: { rx: -0.25 * e }, cage: { s: 1 + 0.12 * e }, light: { s: 1 + 0.25 * e }, cloak: { rx: 0.15 * e } };
    }),
    'slam.attack': clip(0.15, [0, 0.5, 1], u => {
      const e = ease(Math.min(1, u * 1.5));
      return { body: { rx: lerp(-0.32, 0.45, e), ty: lerp(0.15, -0.55, e) }, legL: { rx: lerp(0, -1.3, e) }, legR: { rx: lerp(0, 0.5, e) }, armL: { rx: lerp(-2.4, 0.6, e), rz: lerp(-0.3, 0, e) }, armR: { rx: lerp(-1.2, 0.2, e) }, crook: { rx: lerp(0.4, 0.2, e) }, head: { rx: lerp(-0.25, 0.3, e) }, cage: { s: lerp(1.12, 1, e) }, light: { s: lerp(1.25, 1.4, e) }, cloak: { rx: lerp(0.15, -0.3, e) } };
    }),
    // 1.5 s on one knee, open
    'slam.recover': clip(1.5, [0, 0.6, 1], u => {
      const e = ease(Math.max(0, (u - 0.6) / 0.4));
      return { body: { rx: lerp(0.45, 0, e), ty: lerp(-0.55, 0, e) }, legL: { rx: lerp(-1.3, 0, e) }, legR: { rx: lerp(0.5, 0, e) }, armL: { rx: lerp(0.6, 0, e) }, armR: { rx: lerp(0.2, 0, e) }, crook: { rx: lerp(0.2, 0, e) }, head: { rx: lerp(0.3, 0, e) }, light: { s: lerp(1.4, 1, Math.min(1, u * 2)) }, cloak: { rx: lerp(-0.3, 0, e) } };
    }),
    // the lamp-shards: the cage pulses three times and the light swells; then it bursts (the page flies the shards)
    'shards.windup': clip(0.9, [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1], u => {
      const p = Math.abs(Math.sin(u * Math.PI * 3)), e = ease(u);
      return { body: { rx: -0.12 * e }, cage: { s: 1 + 0.1 * p }, light: { s: 1 + 0.35 * p + 0.2 * e }, armL: { rz: 0.6 * e, rx: -0.4 * e }, head: { rx: -0.15 * e } };
    }),
    'shards.attack': clip(0.2, [0, 0.5, 1], u => ({ body: { rx: lerp(-0.12, 0.15, u) }, cage: { s: lerp(1.1, 0.95, u) }, light: { s: lerp(1.5, 0.6, u) }, armL: { rz: lerp(0.6, 0.3, u), rx: lerp(-0.4, -0.9, u) }, head: { rx: lerp(-0.15, 0.1, u) } })),
    'shards.recover': clip(0.8, [0, 0.5, 1], u => { const e = ease(u); return { body: { rx: lerp(0.15, 0, e) }, light: { s: lerp(0.6, 1, e) }, armL: { rz: lerp(0.3, 0, e), rx: lerp(-0.9, 0, e) }, head: { rx: lerp(0.1, 0, e) } }; }),
    // the stalking lunge: a crouch with the crook levelled forward; then the lunge held while it runs
    'lunge.windup': clip(0.7, [0, 0.4, 0.75, 1], u => {
      const e = ease(u);
      return { body: { rx: 0.4 * e, ty: -0.35 * e }, legL: { rx: -0.6 * e }, legR: { rx: 0.4 * e }, armR: { rx: -1.3 * e, ry: 0.4 * e }, crook: { rx: 1.2 * e }, armL: { rx: 0.4 * e }, head: { rx: -0.3 * e }, cloak: { rx: -0.25 * e }, crookTip: { s: Math.min(1, u * 1.1) } };
    }),
    'lunge.attack': clip(0.69, [0, 0.25, 0.5, 0.75, 1], u => {
      const sw = Math.sin(u * TAU * 1.5);
      return { body: { rx: 0.55, ty: -0.25 }, legL: { rx: -0.8 * sw }, legR: { rx: 0.8 * sw }, armR: { rx: -1.4, ry: 0.4 }, crook: { rx: 1.25 }, armL: { rx: 0.6 }, head: { rx: -0.35 }, cloak: { rx: -0.45 }, crookTip: { s: 1 } };
    }),
    'lunge.recover': clip(1.0, [0, 0.4, 1], u => {
      const e = ease(u);
      return { body: { rx: lerp(0.55, 0, e), ty: lerp(-0.25, 0, e) }, armR: { rx: lerp(-1.4, 0, e), ry: lerp(0.4, 0, e) }, crook: { rx: lerp(1.25, 0, e) }, armL: { rx: lerp(0.6, 0, e) }, head: { rx: lerp(-0.35, 0, e) }, cloak: { rx: lerp(-0.45, 0, e) }, crookTip: { s: Math.max(0, 1 - u * 3) } };
    }),
    // a phase change: it staggers for 2 s, the cage flaring
    stumble: clip(2.0, [0, 0.1, 0.3, 0.5, 0.7, 0.85, 1], u => {
      const w = Math.sin(u * TAU * 2) * (1 - u), d = u < 0.85 ? 1 : 1 - ease((u - 0.85) / 0.15);
      return { body: { rx: -0.2 * d, rz: 0.12 * w, ty: -0.15 * d }, head: { rx: 0.3 * d, rz: -0.2 * w }, cage: { s: 1 + 0.15 * Math.abs(w) }, light: { s: 1 + 0.5 * Math.abs(w) }, armL: { rz: 0.5 * d }, armR: { rz: -0.3 * d }, cloak: { rz: -0.1 * w } };
    }),
    // the arrival: from a stoop it straightens and lifts the crook
    intro: clip(2.4, [0, 0.3, 0.6, 0.85, 1], u => {
      const e = ease(u);
      return { body: { rx: lerp(0.55, 0, e), ty: lerp(-0.4, 0, e) }, head: { rx: lerp(0.7, -0.15 * Math.sin(u * Math.PI), e) }, armR: { rx: -0.6 * Math.sin(u * Math.PI) }, light: { s: lerp(0.3, 1, e) }, cloak: { rx: lerp(-0.3, 0, e) } };
    }),
    // the fall: down onto its knees, the light lifting out of the cage (then the page breaks it into its parts)
    fall: clip(0.6, [0, 0.4, 1], u => {
      const e = ease(u);
      return { body: { rx: 0.35 * e, ty: -0.8 * e }, legL: { rx: -1.4 * e }, legR: { rx: -1.4 * e }, head: { rx: 0.5 * e }, armL: { rz: 0.4 * e }, armR: { rz: -0.4 * e }, light: { ty: 0.3 * e } };
    })
  }
};

/* ---------------- the grave candles ----------------
   Twelve: each a short stub of old bone and a flame of 5 splats that flickers (Ink Studio's glow kind, its density on a sine), ride no
   bone. The page moves each one's base to its point on the ring of 7.0 m round the arena once, and lights them at the intro. */
const CANDLES = 12, groups = [];
const candles = {
  code: 'C', name: 'candles', title: 'grave candles', plain: true, bones: [],
  sculpt() {},
  lay(B, o) {
    groups.length = 0;
    for (let c = 0; c < CANDLES; c++) {
      const x = o[0] + c * 0.5, y = o[1], z = o[2], a = B.count();
      for (let i = 0; i < 4; i++) B.iso(x + (i % 2 ? 0.02 : -0.02), y + 0.05 + i * 0.07, z + (i > 1 ? 0.02 : -0.02), 0.045, B.P[MAT.bone.r[i > 1 ? 1 : 0]], 3);
      for (let i = 0; i < 5; i++) B.iso(x + Math.sin(i * 2.4) * 0.02, y + 0.34 + i * 0.035, z + Math.cos(i * 2.4) * 0.02, 0.035 - i * 0.004, B.P[FIRE[i < 2 ? 3 : i < 4 ? 2 : 4]], 3, { em: true, k: 7, sp: 9 + c * 0.7, ph: c * 1.3 + i });
      groups.push([a, B.count(), x, y, z]);
    }
    return {};
  },
  info: () => ({ groups: groups.map(g => g.map(v => +(+v).toFixed(4))), n: CANDLES, r: 7.0 })
};

export const FIGURES = [reeve, candles];
// what boss.json.gz holds beside the types: the arena it waits in (Barrow Crown's zone 'arena', lib/zones.mjs)
export const extra = () => ({ arena: { c: [18, 0.68, -22], r: 7.0, intro: 11 } });

/* ---------------- pictures: node bake.mjs boss --preview --out DIR ----------------
   A sheet of the Reeve's poses, and the Reeve in its arena at Barrow Crown at the phone and desktop art sizes, seen as the boss camera
   sees it (from behind the lamplighter, at the distances the frame needs: 15.9 m on a phone, 12 m in landscape), with its candles. */
export async function previews({ built, json, worlds, places, out, sheet, lineup, readFigureFiles }) {
  const fs = await import('node:fs');
  const pal = JSON.parse(fs.readFileSync(`${places}/barrows.json`, 'utf8')).pal;
  const P = l => l.map(([c, t]) => ({ clip: c, t }));
  sheet(built, json, { file: `${out}/sheet-B.png`, codes: ['B'], poses: { B: P([['rest', 0], ['sweep.windup', 0.79], ['sweep.attack', 0.12], ['slam.windup', 0.99], ['slam.recover', 0.3], ['shards.windup', 0.15], ['lunge.windup', 0.69], ['stumble', 0.3]]) }, pal, dist: 12, pitch: 0.12 });
  const src = readFigureFiles('boss', worlds);
  const arena = [18, -22];
  // the lamplighter on the arena's open ground, the Reeve 4.5 m beyond it, the candles round the ring
  const candlesAt = walk => Array.from({ length: CANDLES }, (_, c) => { const a = (c / CANDLES) * TAU, x = arena[0] + Math.sin(a) * 7, z = arena[1] + Math.cos(a) * 7; return [x, walk.top(x, z), z]; });
  for (const [name, w, h, dist, pitch] of [['desktop', 320, 180, 12, 0.3], ['phone', 147, 317, 15.9, 0.34]]) {
    for (const [tag2, clipName, t] of [['', 'rest', 0], ['-sweep', 'sweep.windup', 0.79], ['-slam', 'slam.windup', 0.99]]) {
      await lineup({
        place: 'barrows', worlds: places, file: `${out}/barrows-${name}${tag2}.png`, w, h, dist, pitch, ahead: 4.5, from: [22.5, -22, -Math.PI / 2],
        figures: [{ code: 'B', src, clip: clipName, t, markers: clipName === 'slam.windup' ? six('ring').map(n => ({ name: n })) : [] }, { code: 'C', src }],
        spread: 0, poses: (pool, world, walk) => pool.placeGroups(pool.slots.find(s => s.code === 'C'), candlesAt(walk))
      });
    }
  }
}
